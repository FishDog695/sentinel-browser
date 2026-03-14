import { create } from 'zustand'
import type { CookieEvent, NetworkRequest, NetworkResponse, TrackerDetection, FingerprintEvent, TechDetection } from '../../../shared/ipcEvents'

export type PanelTab = 'cookies' | 'network' | 'trackers' | 'tech' | 'ai'

interface NavState {
  url: string
  title: string
  favicon: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

interface SiteStore {
  // Navigation
  nav: NavState
  setNav: (partial: Partial<NavState>) => void

  // Cookies
  cookies: Map<string, CookieEvent>
  setCookieSnapshot: (cookies: CookieEvent[]) => void
  upsertCookie: (cookie: CookieEvent) => void
  removeCookie: (id: string) => void

  // Network
  networkRequests: NetworkRequest[]
  networkResponses: Map<string, NetworkResponse>
  addNetworkRequest: (req: NetworkRequest) => void
  addNetworkResponse: (resp: NetworkResponse) => void
  clearNetwork: () => void

  // Trackers
  trackers: Map<string, TrackerDetection>
  fingerprintAttempts: FingerprintEvent[]
  addTracker: (t: TrackerDetection) => void
  addFingerprintAttempt: (f: FingerprintEvent) => void

  // Tech
  techStack: TechDetection[]
  mergeTech: (detected: TechDetection[]) => void

  // Panel UI state
  activeTab: PanelTab
  panelWidth: number
  isPanelCollapsed: boolean
  setActiveTab: (tab: PanelTab) => void
  setPanelWidth: (w: number) => void
  togglePanel: () => void

  // AI
  aiAnalysis: string
  aiStreaming: boolean
  aiError: string | null
  appendAiChunk: (text: string) => void
  setAiStreaming: (v: boolean) => void
  setAiError: (e: string | null) => void
  clearAiAnalysis: () => void

  // Reset all site data (called on new page load)
  resetSiteData: () => void
}

export const useSiteStore = create<SiteStore>((set, get) => ({
  nav: { url: '', title: '', favicon: '', loading: false, canGoBack: false, canGoForward: false },
  setNav: (partial) => set((s) => ({ nav: { ...s.nav, ...partial } })),

  cookies: new Map(),
  setCookieSnapshot: (cookies) => set({ cookies: new Map(cookies.map(c => [c.id, c])) }),
  upsertCookie: (cookie) => set((s) => { const m = new Map(s.cookies); m.set(cookie.id, cookie); return { cookies: m } }),
  removeCookie: (id) => set((s) => { const m = new Map(s.cookies); m.delete(id); return { cookies: m } }),

  networkRequests: [],
  networkResponses: new Map(),
  addNetworkRequest: (req) => set((s) => ({ networkRequests: [...s.networkRequests, req] })),
  addNetworkResponse: (resp) => set((s) => { const m = new Map(s.networkResponses); m.set(resp.id, resp); return { networkResponses: m } }),
  clearNetwork: () => set({ networkRequests: [], networkResponses: new Map() }),

  trackers: new Map(),
  fingerprintAttempts: [],
  addTracker: (t) => set((s) => { const m = new Map(s.trackers); m.set(t.domain, t); return { trackers: m } }),
  addFingerprintAttempt: (f) => set((s) => ({ fingerprintAttempts: [...s.fingerprintAttempts, f] })),

  techStack: [],
  mergeTech: (detected) => set((s) => {
    const merged = new Map(s.techStack.map(t => [t.name, t]))
    for (const d of detected) {
      const existing = merged.get(d.name)
      if (!existing || d.confidence > existing.confidence) merged.set(d.name, d)
    }
    return { techStack: Array.from(merged.values()).sort((a, b) => b.confidence - a.confidence) }
  }),

  activeTab: 'cookies',
  panelWidth: 360,
  isPanelCollapsed: false,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setPanelWidth: (w) => set({ panelWidth: w }),
  togglePanel: () => set((s) => ({ isPanelCollapsed: !s.isPanelCollapsed })),

  aiAnalysis: '',
  aiStreaming: false,
  aiError: null,
  appendAiChunk: (text) => set((s) => ({ aiAnalysis: s.aiAnalysis + text })),
  setAiStreaming: (v) => set({ aiStreaming: v }),
  setAiError: (e) => set({ aiError: e }),
  clearAiAnalysis: () => set({ aiAnalysis: '', aiError: null }),

  resetSiteData: () => set({
    cookies: new Map(),
    networkRequests: [],
    networkResponses: new Map(),
    trackers: new Map(),
    fingerprintAttempts: [],
    techStack: [],
    aiAnalysis: '',
    aiError: null,
    aiStreaming: false,
  }),
}))
