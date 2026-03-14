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
  on: (channel: string, cb: (...args: unknown[]) => void) => window.electronAPI.on(channel, cb),
  IPC: () => window.electronAPI.IPC,
}
