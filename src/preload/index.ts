import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipcEvents'
import type { AIAnalysisRequest, Favorite, HistoryEntry } from '../shared/ipcEvents'

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
  getGeminiKey: (): Promise<boolean> => ipcRenderer.invoke(IPC.GET_GEMINI_KEY),
  setGeminiKey: (key: string) => ipcRenderer.invoke(IPC.SET_GEMINI_KEY, key),
  getAiProvider: (): Promise<'claude' | 'gemini'> => ipcRenderer.invoke(IPC.GET_AI_PROVIDER),
  setAiProvider: (p: 'claude' | 'gemini') => ipcRenderer.invoke(IPC.SET_AI_PROVIDER, p),
  getAiModel: (): Promise<string> => ipcRenderer.invoke(IPC.GET_AI_MODEL),
  setAiModel: (model: string) => ipcRenderer.invoke(IPC.SET_AI_MODEL, model),

  // Tabs
  createTab: () => ipcRenderer.invoke(IPC.TAB_CREATE),
  closeTab: (tabId: string) => ipcRenderer.invoke(IPC.TAB_CLOSE, tabId),
  switchTab: (tabId: string) => ipcRenderer.invoke(IPC.TAB_SWITCH, tabId),

  // Favorites
  getFavorites: (): Promise<Favorite[]> => ipcRenderer.invoke(IPC.FAV_GET),
  addFavorite: (fav: Favorite): Promise<Favorite[]> => ipcRenderer.invoke(IPC.FAV_ADD, fav),
  removeFavorite: (url: string): Promise<Favorite[]> => ipcRenderer.invoke(IPC.FAV_REMOVE, url),

  // History
  getHistory: (): Promise<HistoryEntry[]> => ipcRenderer.invoke(IPC.HISTORY_GET),
  clearHistory: (): Promise<HistoryEntry[]> => ipcRenderer.invoke(IPC.HISTORY_CLEAR),

  // Toolbar overlay — shifts WebContentsView down so dropdowns aren't hidden behind it
  setToolbarOverlay: (height: number) => ipcRenderer.invoke(IPC.TOOLBAR_OVERLAY, height),

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
