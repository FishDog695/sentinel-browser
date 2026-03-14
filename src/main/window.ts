import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC } from '../shared/ipcEvents'
import { resizeActiveTab } from './tabManager'

export const TITLE_BAR_HEIGHT = 40
export const CHROME_HEIGHT = 44
const STATUS_BAR_HEIGHT = 20
const DEFAULT_PANEL_WIDTH = 360

export interface WindowDimensions {
  width: number
  height: number
  panelWidth: number
}

export function calculateWebViewBounds(dims: WindowDimensions): Electron.Rectangle {
  const topOffset = TITLE_BAR_HEIGHT + CHROME_HEIGHT
  const bottomOffset = STATUS_BAR_HEIGHT
  return {
    x: 0,
    y: topOffset,
    width: Math.max(100, dims.width - dims.panelWidth),
    height: Math.max(100, dims.height - topOffset - bottomOffset),
  }
}

export function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 12, y: TITLE_BAR_HEIGHT / 2 - 6 },
    backgroundColor: '#030712',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  let panelWidth = DEFAULT_PANEL_WIDTH

  function updateWebViewBounds() {
    const [w, h] = win.getContentSize()
    const bounds = calculateWebViewBounds({ width: w, height: h, panelWidth })
    resizeActiveTab(bounds)
  }

  win.on('resize', updateWebViewBounds)

  // Forward maximize/restore state to renderer for window control buttons
  win.on('maximize', () => win.webContents.send(IPC.WIN_MAXIMIZED, true))
  win.on('unmaximize', () => win.webContents.send(IPC.WIN_MAXIMIZED, false))

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('panel:initial-width', DEFAULT_PANEL_WIDTH)
  })

  win.once('ready-to-show', () => {
    win.show()
    if (is.dev) {
      win.webContents.openDevTools({ mode: 'detach' })
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return {
    win,
    updateWebViewBounds,
    getPanelWidth: () => panelWidth,
    setPanelWidth: (w: number) => { panelWidth = w; updateWebViewBounds() },
  }
}
