import { app, BrowserWindow, protocol, net, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createMainWindow, calculateWebViewBounds } from './window'
import { setupSessionHooks, setTabUrl, getScriptUrls } from './session'
import { loadTrackerList } from './trackerEngine'
import { getSnapshotForUrl } from './cookies'
import { registerIpcHandlers, recordHistory, getLockdownMode, getClearHistoryOnClose, clearHistoryStore } from './ipcHandlers'
import { detectFromHtml, detectFromGlobals, mergeDetections } from './techDetector'
import {
  createTab, showTab, getWcvByTabId,
  updateTabMeta, getTabMeta
} from './tabManager'
import { IPC } from '../shared/ipcEvents'

// Register sentinel:// as a privileged scheme (must be called before app.whenReady)
protocol.registerSchemesAsPrivileged([
  { scheme: 'sentinel', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

// Fingerprint observer injected into every page
const FINGERPRINT_SCRIPT = `(function() {
  function report(type, detail) {
    window.dispatchEvent(new CustomEvent('__sentinel_fp__', { detail: { type, detail } }));
  }
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function(...args) {
    report('canvas', 'canvas.toDataURL called');
    return origToDataURL.apply(this, args);
  };
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...rest) {
    const ctx = origGetContext.apply(this, [type, ...rest]);
    if ((type === '2d' || type === 'webgl' || type === 'webgl2') && ctx) {
      const origGetParam = ctx.getParameter;
      if (origGetParam) {
        ctx.getParameter = function(...a) {
          report(type === '2d' ? 'canvas' : 'webgl', type + '.getParameter called');
          return origGetParam.apply(this, a);
        };
      }
    }
    return ctx;
  };
  const origAC = window.AudioContext || window.webkitAudioContext;
  if (origAC) {
    const ACWrapper = function(...args) { report('audio', 'AudioContext created'); return new origAC(...args); };
    ACWrapper.prototype = origAC.prototype;
    window.AudioContext = ACWrapper;
  }
  const nav = navigator;
  const origGetBattery = nav.getBattery;
  if (origGetBattery) {
    nav.getBattery = function() { report('battery', 'navigator.getBattery called'); return origGetBattery.call(nav); };
  }
})();`

// Fingerprint spoofing — injected in Lockdown mode to return neutral/blank data
const SPOOF_SCRIPT = `(function() {
  // Canvas — return data from an identically-sized blank canvas so fingerprinting
  // reads get noise, but the original canvas pixels are left untouched (preserving
  // rendered UI like CAPTCHA widgets that draw on canvas).
  const _toDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function(type, ...args) {
    const blank = document.createElement('canvas');
    blank.width = this.width || 1;
    blank.height = this.height || 1;
    return _toDataURL.apply(blank, [type, ...args]);
  };
  // WebGL — return generic renderer/vendor strings
  const _getParam = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(p) {
    if (p === 37445) return 'Generic Vendor';
    if (p === 37446) return 'Generic Renderer';
    return _getParam.apply(this, [p]);
  };
  if (typeof WebGL2RenderingContext !== 'undefined') {
    const _getParam2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function(p) {
      if (p === 37445) return 'Generic Vendor';
      if (p === 37446) return 'Generic Renderer';
      return _getParam2.apply(this, [p]);
    };
  }
  // Battery — return static neutral values
  if (navigator.getBattery) {
    navigator.getBattery = () => Promise.resolve({
      charging: true, chargingTime: 0, dischargingTime: Infinity, level: 1,
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false
    });
  }
})();`

const DOM_SIGNAL_SCRIPT = `(function() {
  const KNOWN_GLOBALS = ['React','__REACT_DEVTOOLS_GLOBAL_HOOK__','Vue','angular','ng','jQuery','$','Ember',
    '__NEXT_DATA__','__next','__nuxt','$nuxt','__gatsby','Shopify','__st','woocommerce_params','Drupal',
    'Webflow','Ghost','Static','wixBiSession','ga','gtag','mixpanel','amplitude','hj','heap','FS','DD_RUM',
    'newrelic','fbq','_fbq','twq','ttq','Intercom','zE','HubSpotConversations','_hsq','drift','optimizely',
    'LDClient','VWO','webpackChunk','__webpack_modules__','google_tag_manager','Segment','analytics'];
  const foundGlobals = KNOWN_GLOBALS.filter(g => {
    try { return typeof window[g] !== 'undefined'; } catch { return false; }
  });
  const html = document.documentElement.outerHTML.slice(0, 50000);
  return JSON.stringify({ globals: foundGlobals, html });
})()`

// Wire all per-tab navigation events for a single tab
export function setupTabEvents(win: BrowserWindow, tabId: string) {
  const wcv = getWcvByTabId(tabId)
  if (!wcv) return

  wcv.webContents.on('did-start-loading', () => {
    win.webContents.send(IPC.NAV_PAGE_LOADING, { tabId, url: wcv.webContents.getURL() })
  })

  wcv.webContents.on('did-navigate', async (_e, url) => {
    setTabUrl(tabId, url)
    updateTabMeta(tabId, { url })
    win.webContents.send(IPC.NAV_URL_CHANGED, { tabId, url })
    win.webContents.send(IPC.NAV_HISTORY_CHANGED, {
      tabId,
      canGoBack: wcv.webContents.navigationHistory.canGoBack(),
      canGoForward: wcv.webContents.navigationHistory.canGoForward(),
    })
    const cookies = await getSnapshotForUrl(url)
    win.webContents.send(IPC.COOKIES_SNAPSHOT, { cookies, tabId })
  })

  wcv.webContents.on('did-navigate-in-page', (_e, url) => {
    updateTabMeta(tabId, { url })
    win.webContents.send(IPC.NAV_URL_CHANGED, { tabId, url })
  })

  wcv.webContents.on('page-title-updated', (_e, title) => {
    updateTabMeta(tabId, { title })
    win.webContents.send(IPC.NAV_TITLE_CHANGED, { tabId, title })
    const m = getTabMeta(tabId)
    if (m) {
      win.webContents.send(IPC.TAB_UPDATED, { id: m.id, url: m.url, title: m.title, favicon: m.favicon })
      recordHistory({ url: m.url, title, favicon: m.favicon, visitedAt: Date.now() })
    }
  })

  wcv.webContents.on('did-finish-load', async () => {
    win.webContents.send(IPC.NAV_PAGE_LOADED, { tabId })

    await wcv.webContents.executeJavaScript(FINGERPRINT_SCRIPT).catch(() => {})
    if (getLockdownMode()) {
      await wcv.webContents.executeJavaScript(SPOOF_SCRIPT).catch(() => {})
    }

    const result = await wcv.webContents.executeJavaScript(DOM_SIGNAL_SCRIPT).catch(() => null)
    if (result) {
      const { globals, html } = JSON.parse(result)
      const techHtml = detectFromHtml(html, getScriptUrls(tabId))
      const techGlobals = detectFromGlobals(globals)
      const merged = mergeDetections([...techHtml, ...techGlobals])
      if (merged.length > 0) {
        win.webContents.send(IPC.TECH_DETECTED, { items: merged, tabId })
      }
    }
  })

  wcv.webContents.on('ipc-message', (_e, channel, ...args) => {
    if (channel === '__sentinel_fp__') {
      win.webContents.send(IPC.FINGERPRINT_ATTEMPT, { ...args[0], timestamp: Date.now(), tabId })
    }
  })

  wcv.webContents.on('page-favicon-updated', (_e, favicons) => {
    if (favicons.length > 0) {
      updateTabMeta(tabId, { favicon: favicons[0] })
      win.webContents.send(IPC.NAV_FAVICON, { tabId, url: favicons[0] })
      const m = getTabMeta(tabId)
      if (m) {
        win.webContents.send(IPC.TAB_UPDATED, { id: m.id, url: m.url, title: m.title, favicon: m.favicon })
        recordHistory({ url: m.url, title: m.title, favicon: favicons[0], visitedAt: Date.now() })
      }
    }
  })
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.sentinel.browser')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Serve resources/newtab.html at sentinel://newtab
  protocol.handle('sentinel', (request) => {
    const resourcesPath = app.isPackaged
      ? process.resourcesPath
      : join(__dirname, '../../resources')
    if (new URL(request.url).hostname === 'newtab') {
      const filePath = join(resourcesPath, 'newtab.html').replace(/\\/g, '/')
      return net.fetch('file://' + filePath)
    }
    return new Response('Not found', { status: 404 })
  })

  // Load tracker database
  const resourcesPath = app.isPackaged ? process.resourcesPath : join(__dirname, '../../resources')
  loadTrackerList(resourcesPath)

  const { win, updateWebViewBounds, getPanelWidth, setPanelWidth, setOverlayHeight } = createMainWindow()

  // Create the initial tab
  const { tabId, wcv } = createTab(win)

  // Setup session hooks ONCE (shared session across all tabs)
  setupSessionHooks(win, wcv)

  // Wire navigation events for the initial tab
  setupTabEvents(win, tabId)

  // Register all IPC handlers, passing setupTabEvents so TAB_CREATE can wire new tabs
  registerIpcHandlers(win, setupTabEvents, calculateWebViewBounds, getPanelWidth, setPanelWidth, updateWebViewBounds, setOverlayHeight)

  // Show the initial tab with correct bounds
  const [w, h] = win.getContentSize()
  const bounds = calculateWebViewBounds({ width: w, height: h, panelWidth: getPanelWidth() })
  showTab(tabId, bounds)

  // Notify renderer of the initial tab (once renderer has loaded)
  win.webContents.on('did-finish-load', () => {
    const meta = getTabMeta(tabId)
    if (meta) {
      win.webContents.send(IPC.TAB_CREATED, {
        tabId: meta.id,
        url: meta.url,
        title: meta.title,
        favicon: meta.favicon,
        isActive: true,
      })
    }
  })

  // Load initial page
  await wcv.webContents.loadURL('sentinel://newtab')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

// Privacy cleanup on exit — always clear cache/cookies/storage, optionally clear history
app.on('before-quit', async (e) => {
  e.preventDefault()
  const ses = session.defaultSession
  try {
    await Promise.all([
      ses.clearCache(),
      ses.clearAuthCache(),
      ses.clearStorageData({
        storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage', 'serviceworkers', 'shadercache', 'websql', 'filesystem'],
      }),
    ])
    if (getClearHistoryOnClose()) {
      clearHistoryStore()
    }
  } catch {
    // Never block shutdown on cleanup errors
  }
  app.exit(0)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
