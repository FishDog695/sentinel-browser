import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createMainWindow } from './window'
import { setupSessionHooks, setCurrentPageUrl, getScriptUrls } from './session'
import { loadTrackerList } from './trackerEngine'
import { getSnapshotForUrl } from './cookies'
import { registerIpcHandlers } from './ipcHandlers'
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

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.sentinel.browser')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Load tracker database
  const resourcesPath = app.isPackaged ? process.resourcesPath : join(__dirname, '../../resources')
  loadTrackerList(resourcesPath)

  const { win, wcv, updateWebViewBounds, setPanelWidth } = createMainWindow()

  // Setup network/cookie hooks
  setupSessionHooks(win, wcv)

  // Register all IPC handlers
  registerIpcHandlers(win, wcv, setPanelWidth, updateWebViewBounds)

  // ─── WebContentsView navigation events ─────────────────────────────────────
  wcv.webContents.on('did-start-loading', () => {
    win.webContents.send(IPC.NAV_PAGE_LOADING, { url: wcv.webContents.getURL() })
  })

  wcv.webContents.on('did-navigate', async (_e, url) => {
    setCurrentPageUrl(url)
    win.webContents.send(IPC.NAV_URL_CHANGED, { url })
    win.webContents.send(IPC.NAV_HISTORY_CHANGED, {
      canGoBack: wcv.webContents.navigationHistory.canGoBack(),
      canGoForward: wcv.webContents.navigationHistory.canGoForward(),
    })
    // Send cookie snapshot for the new page
    const cookies = await getSnapshotForUrl(url)
    win.webContents.send(IPC.COOKIES_SNAPSHOT, cookies)
  })

  wcv.webContents.on('did-navigate-in-page', (_e, url) => {
    win.webContents.send(IPC.NAV_URL_CHANGED, { url })
  })

  wcv.webContents.on('page-title-updated', (_e, title) => {
    win.webContents.send(IPC.NAV_TITLE_CHANGED, { title })
  })

  wcv.webContents.on('did-finish-load', async () => {
    // Inject fingerprint observer
    await wcv.webContents.executeJavaScript(FINGERPRINT_SCRIPT).catch(() => {})

    // Collect DOM signals for tech detection
    const result = await wcv.webContents.executeJavaScript(DOM_SIGNAL_SCRIPT).catch(() => null)
    if (result) {
      const { globals, html } = JSON.parse(result)
      // Send to ipcHandlers via internal IPC
      win.webContents.emit('tech-dom-signals', { globals, html, scriptUrls: getScriptUrls() })
    }
  })

  // Forward fingerprint events from WebContentsView preload
  wcv.webContents.on('ipc-message', (_e, channel, ...args) => {
    if (channel === '__sentinel_fp__') {
      win.webContents.send(IPC.FINGERPRINT_ATTEMPT, { ...args[0], timestamp: Date.now() })
    }
  })

  // Page favicon
  wcv.webContents.on('page-favicon-updated', (_e, favicons) => {
    if (favicons.length > 0) win.webContents.send(IPC.NAV_FAVICON, { url: favicons[0] })
  })

  // Load initial page
  await wcv.webContents.loadURL('https://example.com')
  updateWebViewBounds()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
