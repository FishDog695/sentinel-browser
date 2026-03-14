import { create } from 'zustand'
import type {
  CookieEvent, NetworkRequest, NetworkResponse,
  TrackerDetection, FingerprintEvent, TechDetection
} from '../../../shared/ipcEvents'

export type PanelTab = 'cookies' | 'network' | 'trackers' | 'tech' | 'ai'

export interface NavState {
  url: string
  title: string
  favicon: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

export interface TabState {
  id: string
  nav: NavState
  cookies: Map<string, CookieEvent>
  networkRequests: NetworkRequest[]
  networkResponses: Map<string, NetworkResponse>
  trackers: Map<string, TrackerDetection>
  fingerprintAttempts: FingerprintEvent[]
  techStack: TechDetection[]
  aiAnalysis: string
  aiStreaming: boolean
  aiError: string | null
}

function emptyNavState(): NavState {
  return { url: '', title: 'New Tab', favicon: '', loading: false, canGoBack: false, canGoForward: false }
}

export function createEmptyTabState(id: string): TabState {
  return {
    id,
    nav: emptyNavState(),
    cookies: new Map(),
    networkRequests: [],
    networkResponses: new Map(),
    trackers: new Map(),
    fingerprintAttempts: [],
    techStack: [],
    aiAnalysis: '',
    aiStreaming: false,
    aiError: null,
  }
}

interface SiteStore {
  // Tab management
  tabs: Record<string, TabState>
  activeTabId: string
  tabOrder: string[]

  // Global UI state
  activePanel: PanelTab
  panelWidth: number
  isPanelCollapsed: boolean

  // Tab lifecycle
  createTabState: (tabId: string) => void
  closeTabState: (tabId: string, nextTabId: string | null) => void
  setActiveTabId: (tabId: string) => void

  // Per-tab nav
  setTabNav: (tabId: string, partial: Partial<NavState>) => void
  resetTabSiteData: (tabId: string) => void

  // Per-tab cookies
  setTabCookieSnapshot: (tabId: string, cookies: CookieEvent[]) => void
  upsertTabCookie: (tabId: string, cookie: CookieEvent) => void
  removeTabCookie: (tabId: string, id: string) => void

  // Per-tab network
  addTabNetworkRequest: (tabId: string, req: NetworkRequest) => void
  addTabNetworkResponse: (tabId: string, resp: NetworkResponse) => void

  // Per-tab trackers
  addTabTracker: (tabId: string, t: TrackerDetection) => void
  addTabFingerprintAttempt: (tabId: string, f: FingerprintEvent) => void

  // Per-tab tech
  mergeTabTech: (tabId: string, detected: TechDetection[]) => void

  // Per-tab AI
  appendTabAiChunk: (tabId: string, text: string) => void
  setTabAiStreaming: (tabId: string, v: boolean) => void
  setTabAiError: (tabId: string, e: string | null) => void
  clearTabAiAnalysis: (tabId: string) => void

  // Global UI actions
  setActivePanel: (tab: PanelTab) => void
  setPanelWidth: (w: number) => void
  togglePanel: () => void
}

// Helper: immutably update a single tab in the tabs map
function patchTab(
  tabs: Record<string, TabState>,
  tabId: string,
  updater: (tab: TabState) => Partial<TabState>
): Record<string, TabState> {
  const tab = tabs[tabId]
  if (!tab) return tabs
  return { ...tabs, [tabId]: { ...tab, ...updater(tab) } }
}

export const useSiteStore = create<SiteStore>((set) => ({
  tabs: {},
  activeTabId: '',
  tabOrder: [],

  activePanel: 'cookies',
  panelWidth: 360,
  isPanelCollapsed: false,

  // ─── Tab lifecycle ───────────────────────────────────────────────────────────
  createTabState: (tabId) => set((s) => ({
    tabs: { ...s.tabs, [tabId]: createEmptyTabState(tabId) },
    tabOrder: s.tabOrder.includes(tabId) ? s.tabOrder : [...s.tabOrder, tabId],
  })),

  closeTabState: (tabId, nextTabId) => set((s) => {
    const { [tabId]: _, ...rest } = s.tabs
    return {
      tabs: rest,
      tabOrder: s.tabOrder.filter(id => id !== tabId),
      activeTabId: nextTabId ?? s.activeTabId,
    }
  }),

  setActiveTabId: (tabId) => set({ activeTabId: tabId }),

  // ─── Per-tab nav ─────────────────────────────────────────────────────────────
  setTabNav: (tabId, partial) => set((s) => ({
    tabs: patchTab(s.tabs, tabId, (tab) => ({ nav: { ...tab.nav, ...partial } })),
  })),

  resetTabSiteData: (tabId) => set((s) => ({
    tabs: patchTab(s.tabs, tabId, () => ({
      cookies: new Map(),
      networkRequests: [],
      networkResponses: new Map(),
      trackers: new Map(),
      fingerprintAttempts: [],
      techStack: [],
      aiAnalysis: '',
      aiError: null,
      aiStreaming: false,
    })),
  })),

  // ─── Per-tab cookies ─────────────────────────────────────────────────────────
  setTabCookieSnapshot: (tabId, cookies) => set((s) => ({
    tabs: patchTab(s.tabs, tabId, () => ({
      cookies: new Map(cookies.map(c => [c.id, c])),
    })),
  })),

  upsertTabCookie: (tabId, cookie) => set((s) => ({
    tabs: patchTab(s.tabs, tabId, (tab) => {
      const m = new Map(tab.cookies)
      m.set(cookie.id, cookie)
      return { cookies: m }
    }),
  })),

  removeTabCookie: (tabId, id) => set((s) => ({
    tabs: patchTab(s.tabs, tabId, (tab) => {
      const m = new Map(tab.cookies)
      m.delete(id)
      return { cookies: m }
    }),
  })),

  // ─── Per-tab network ─────────────────────────────────────────────────────────
  addTabNetworkRequest: (tabId, req) => set((s) => ({
    tabs: patchTab(s.tabs, tabId, (tab) => ({
      networkRequests: [...tab.networkRequests, req],
    })),
  })),

  addTabNetworkResponse: (tabId, resp) => set((s) => ({
    tabs: patchTab(s.tabs, tabId, (tab) => {
      const m = new Map(tab.networkResponses)
      m.set(resp.id, resp)
      return { networkResponses: m }
    }),
  })),

  // ─── Per-tab trackers ────────────────────────────────────────────────────────
  addTabTracker: (tabId, t) => set((s) => ({
    tabs: patchTab(s.tabs, tabId, (tab) => {
      const m = new Map(tab.trackers)
      m.set(t.domain, t)
      return { trackers: m }
    }),
  })),

  addTabFingerprintAttempt: (tabId, f) => set((s) => ({
    tabs: patchTab(s.tabs, tabId, (tab) => ({
      fingerprintAttempts: [...tab.fingerprintAttempts, f],
    })),
  })),

  // ─── Per-tab tech ────────────────────────────────────────────────────────────
  mergeTabTech: (tabId, detected) => set((s) => ({
    tabs: patchTab(s.tabs, tabId, (tab) => {
      const merged = new Map(tab.techStack.map(t => [t.name, t]))
      for (const d of detected) {
        const existing = merged.get(d.name)
        if (!existing || d.confidence > existing.confidence) merged.set(d.name, d)
      }
      return { techStack: Array.from(merged.values()).sort((a, b) => b.confidence - a.confidence) }
    }),
  })),

  // ─── Per-tab AI ──────────────────────────────────────────────────────────────
  appendTabAiChunk: (tabId, text) => set((s) => ({
    tabs: patchTab(s.tabs, tabId, (tab) => ({ aiAnalysis: tab.aiAnalysis + text })),
  })),

  setTabAiStreaming: (tabId, v) => set((s) => ({
    tabs: patchTab(s.tabs, tabId, () => ({ aiStreaming: v })),
  })),

  setTabAiError: (tabId, e) => set((s) => ({
    tabs: patchTab(s.tabs, tabId, () => ({ aiError: e })),
  })),

  clearTabAiAnalysis: (tabId) => set((s) => ({
    tabs: patchTab(s.tabs, tabId, () => ({ aiAnalysis: '', aiError: null })),
  })),

  // ─── Global UI ───────────────────────────────────────────────────────────────
  setActivePanel: (tab) => set({ activePanel: tab }),
  setPanelWidth: (w) => set({ panelWidth: w }),
  togglePanel: () => set((s) => ({ isPanelCollapsed: !s.isPanelCollapsed })),
}))
