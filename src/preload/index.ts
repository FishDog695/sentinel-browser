import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipcEvents'
import type { AIAnalysisRequest } from '../shared/ipcEvents'

// Expose safe API surface to renderer — this is the ONLY way renderer accesses Electron
contextBridge.exposeInMainWorld('electronAPI', {
  // Navigation
  navigateTo: (url: string) => ipcRenderer.invoke(IPC.NAVIGATE_TO, url),
  navigateBack: () => ipcRenderer.invoke(IPC.NAVIGATE_BACK),
  navigateForward: () => ipcRenderer.invoke(IPC.NAVIGATE_FORWARD),
  navigateReload: () => ipcRenderer.invoke(IPC.NAVIGATE_RELOAD),

  // Panel
  setPanelWidth: (width: number) => ipcRenderer.invoke(IPC.PANEL_RESIZE, width),

  // AI
  analyzeCurrentSite: (req: AIAnalysisRequest) => ipcRenderer.invoke(IPC.AI_ANALYZE, req),
  cancelAnalysis: () => ipcRenderer.invoke(IPC.AI_CANCEL),
  getApiKey: () => ipcRenderer.invoke(IPC.GET_API_KEY),
  setApiKey: (key: string) => ipcRenderer.invoke(IPC.SET_API_KEY, key),

  // Tabs
  createTab: () => ipcRenderer.invoke(IPC.TAB_CREATE),
  closeTab: (tabId: string) => ipcRenderer.invoke(IPC.TAB_CLOSE, tabId),
  switchTab: (tabId: string) => ipcRenderer.invoke(IPC.TAB_SWITCH, tabId),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke(IPC.WIN_MINIMIZE),
  maximizeWindow: () => ipcRenderer.invoke(IPC.WIN_MAXIMIZE),
  closeWindow: () => ipcRenderer.invoke(IPC.WIN_CLOSE),
  isMaximized: () => ipcRenderer.invoke(IPC.WIN_IS_MAXIMIZED),

  // Platform
  platform: process.platform,

  // Event listeners — renderer subscribes to push events from main
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)  // returns unsubscribe fn
  },

  // IPC channel constants exposed so renderer doesn't import from main
  IPC,
})
