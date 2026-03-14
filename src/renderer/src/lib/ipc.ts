// Typed wrappers around window.electronAPI
// The renderer never imports from 'electron' directly

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
