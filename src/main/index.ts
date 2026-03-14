import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createMainWindow, calculateWebViewBounds } from './window'
import { setupSessionHooks, setTabUrl, getScriptUrls } from './session'
import { loadTrackerList } from './trackerEngine'
import { getSnapshotForUrl } from './cookies'
import { registerIpcHandlers } from './ipcHandlers'
import { detectFromHtml, detectFromGlobals, mergeDetections } from './techDetector'
import {
  createTab, showTab, getWcvByTabId,
  updateTabMeta, getTabMeta
} from './tabManager'
import { IPC } from '../shared/ipcEvents'

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
    if (m) win.webContents.send(IPC.TAB_UPDATED, { id: m.id, url: m.url, title: m.title, favicon: m.favicon })
  })

  wcv.webContents.on('did-finish-load', async () => {
    win.webContents.send(IPC.NAV_PAGE_LOADED, { tabId })

    await wcv.webContents.executeJavaScript(FINGERPRINT_SCRIPT).catch(() => {})

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
      if (m) win.webContents.send(IPC.TAB_UPDATED, { id: m.id, url: m.url, title: m.title, favicon: m.favicon })
    }
  })
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.sentinel.browser')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Load tracker database
  const resourcesPath = app.isPackaged ? process.resourcesPath : join(__dirname, '../../resources')
  loadTrackerList(resourcesPath)

  const { win, updateWebViewBounds, getPanelWidth, setPanelWidth } = createMainWindow()

  // Create the initial tab
  const { tabId, wcv } = createTab(win)

  // Setup session hooks ONCE (shared session across all tabs)
  setupSessionHooks(win, wcv)

  // Wire navigation events for the initial tab
  setupTabEvents(win, tabId)

  // Register all IPC handlers, passing setupTabEvents so TAB_CREATE can wire new tabs
  registerIpcHandlers(win, setupTabEvents, calculateWebViewBounds, getPanelWidth, setPanelWidth, updateWebViewBounds)

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
  await wcv.webContents.loadURL('https://example.com')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
