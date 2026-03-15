// Typed wrappers around window.electronAPI
// The renderer never imports from 'electron' directly

import type { Favorite, HistoryEntry } from '../../../shared/ipcEvents'

declare global {
  interface Window {
    electronAPI: {
      navigateTo: (url: string) => Promise<void>
      navigateBack: () => Promise<void>
      navigateForward: () => Promise<void>
      navigateReload: () => Promise<void>
      setPanelWidth: (width: number) => Promise<void>
      analyzeCurrentSite: (req: unknown) => Promise<void>
      cancelAnalysis: () => Promise<void>
      getApiKey: () => Promise<boolean>
      setApiKey: (key: string) => Promise<void>
      getGeminiKey: () => Promise<boolean>
      setGeminiKey: (key: string) => Promise<void>
      getAiProvider: () => Promise<'claude' | 'gemini'>
      setAiProvider: (p: 'claude' | 'gemini') => Promise<void>
      getAiModel: () => Promise<string>
      setAiModel: (model: string) => Promise<void>
      getFavorites: () => Promise<Favorite[]>
      addFavorite: (fav: Favorite) => Promise<Favorite[]>
      removeFavorite: (url: string) => Promise<Favorite[]>
      getHistory: () => Promise<HistoryEntry[]>
      clearHistory: () => Promise<HistoryEntry[]>
      setToolbarOverlay: (height: number) => Promise<void>
      getMode: () => Promise<'explore' | 'lockdown'>
      setMode: (mode: 'explore' | 'lockdown') => Promise<void>
      addAiBlocklist: (domains: string[]) => Promise<void>
      createTab: () => Promise<string>
      closeTab: (tabId: string) => Promise<void>
      switchTab: (tabId: string) => Promise<void>
      minimizeWindow: () => Promise<void>
      maximizeWindow: () => Promise<void>
      closeWindow: () => Promise<void>
      isMaximized: () => Promise<boolean>
      platform: string
      on: (channel: string, cb: (...args: unknown[]) => void) => () => void
      IPC: Record<string, string>
    }
  }
}

export const ipc = {
  navigateTo: (url: string) => window.electronAPI.navigateTo(url),
  navigateBack: () => window.electronAPI.navigateBack(),
  navigateForward: () => window.electronAPI.navigateForward(),
  navigateReload: () => window.electronAPI.navigateReload(),
  setPanelWidth: (w: number) => window.electronAPI.setPanelWidth(w),
  analyzeCurrentSite: (req: unknown) => window.electronAPI.analyzeCurrentSite(req),
  cancelAnalysis: () => window.electronAPI.cancelAnalysis(),
  getApiKey: () => window.electronAPI.getApiKey(),
  setApiKey: (key: string) => window.electronAPI.setApiKey(key),
  getGeminiKey: () => window.electronAPI.getGeminiKey(),
  setGeminiKey: (key: string) => window.electronAPI.setGeminiKey(key),
  getAiProvider: () => window.electronAPI.getAiProvider(),
  setAiProvider: (p: 'claude' | 'gemini') => window.electronAPI.setAiProvider(p),
  getAiModel: () => window.electronAPI.getAiModel(),
  setAiModel: (model: string) => window.electronAPI.setAiModel(model),
  getFavorites: () => window.electronAPI.getFavorites(),
  addFavorite: (fav: Favorite) => window.electronAPI.addFavorite(fav),
  removeFavorite: (url: string) => window.electronAPI.removeFavorite(url),
  getHistory: () => window.electronAPI.getHistory(),
  clearHistory: () => window.electronAPI.clearHistory(),
  setToolbarOverlay: (height: number) => window.electronAPI.setToolbarOverlay(height),
  getMode: () => window.electronAPI.getMode(),
  setMode: (mode: 'explore' | 'lockdown') => window.electronAPI.setMode(mode),
  addAiBlocklist: (domains: string[]) => window.electronAPI.addAiBlocklist(domains),
  createTab: () => window.electronAPI.createTab(),
  closeTab: (tabId: string) => window.electronAPI.closeTab(tabId),
  switchTab: (tabId: string) => window.electronAPI.switchTab(tabId),
  minimizeWindow: () => window.electronAPI.minimizeWindow(),
  maximizeWindow: () => window.electronAPI.maximizeWindow(),
  closeWindow: () => window.electronAPI.closeWindow(),
  isMaximized: () => window.electronAPI.isMaximized(),
  platform: () => window.electronAPI.platform,
  on: (channel: string, cb: (...args: unknown[]) => void) => window.electronAPI.on(channel, cb),
  IPC: () => window.electronAPI.IPC,
}
