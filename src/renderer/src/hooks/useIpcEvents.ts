import { useEffect } from 'react'
import { useSiteStore } from '../store/siteStore'
import { ipc } from '../lib/ipc'
import type {
  CookieEvent, NetworkRequest, NetworkResponse,
  TrackerDetection, FingerprintEvent, TechDetection, TabInfo
} from '../../../../shared/ipcEvents'

// Single hook that wires up ALL IPC push events to the Zustand store
export function useIpcEvents() {
  const store = useSiteStore()

  useEffect(() => {
    const IPC = ipc.IPC()

    const unsubs = [
      // ─── Navigation ───────────────────────────────────────────────────────────
      ipc.on(IPC.NAV_URL_CHANGED, (data) => {
        const { tabId, url } = data as { tabId: string; url: string }
        store.setTabNav(tabId, { url })
      }),
      ipc.on(IPC.NAV_TITLE_CHANGED, (data) => {
        const { tabId, title } = data as { tabId: string; title: string }
        store.setTabNav(tabId, { title })
      }),
      ipc.on(IPC.NAV_HISTORY_CHANGED, (data) => {
        const { tabId, canGoBack, canGoForward } = data as { tabId: string; canGoBack: boolean; canGoForward: boolean }
        store.setTabNav(tabId, { canGoBack, canGoForward })
      }),
      ipc.on(IPC.NAV_PAGE_LOADING, (data) => {
        const { tabId, url } = data as { tabId: string; url: string }
        store.setTabNav(tabId, { loading: true, url })
        store.resetTabSiteData(tabId)
      }),
      ipc.on(IPC.NAV_PAGE_LOADED, (data) => {
        const { tabId } = data as { tabId: string }
        store.setTabNav(tabId, { loading: false })
      }),
      ipc.on(IPC.NAV_FAVICON, (data) => {
        const { tabId, url } = data as { tabId: string; url: string }
        store.setTabNav(tabId, { favicon: url })
      }),

      // ─── Cookies ─────────────────────────────────────────────────────────────
      ipc.on(IPC.COOKIES_SNAPSHOT, (data) => {
        const { tabId, cookies } = data as { tabId: string; cookies: CookieEvent[] }
        store.setTabCookieSnapshot(tabId, cookies)
      }),
      ipc.on(IPC.COOKIE_ADDED, (data) => {
        const { tabId, ...cookie } = data as CookieEvent & { tabId: string }
        store.upsertTabCookie(tabId, cookie as CookieEvent)
      }),
      ipc.on(IPC.COOKIE_CHANGED, (data) => {
        const { tabId, ...cookie } = data as CookieEvent & { tabId: string }
        store.upsertTabCookie(tabId, cookie as CookieEvent)
      }),
      ipc.on(IPC.COOKIE_REMOVED, (data) => {
        const { tabId, id } = data as { tabId: string; id: string }
        store.removeTabCookie(tabId, id)
      }),

      // ─── Network ─────────────────────────────────────────────────────────────
      ipc.on(IPC.NETWORK_REQUEST, (data) => {
        const { tabId, ...req } = data as NetworkRequest & { tabId: string }
        store.addTabNetworkRequest(tabId, req as NetworkRequest)
      }),
      ipc.on(IPC.NETWORK_RESPONSE, (data) => {
        const { tabId, ...resp } = data as NetworkResponse & { tabId: string }
        store.addTabNetworkResponse(tabId, resp as NetworkResponse)
      }),

      // ─── Trackers ────────────────────────────────────────────────────────────
      ipc.on(IPC.TRACKER_DETECTED, (data) => {
        const { tabId, ...tracker } = data as TrackerDetection & { tabId: string }
        store.addTabTracker(tabId, tracker as TrackerDetection)
      }),
      ipc.on(IPC.FINGERPRINT_ATTEMPT, (data) => {
        const { tabId, ...fp } = data as FingerprintEvent & { tabId: string }
        store.addTabFingerprintAttempt(tabId, fp as FingerprintEvent)
      }),

      // ─── Tech ────────────────────────────────────────────────────────────────
      ipc.on(IPC.TECH_DETECTED, (data) => {
        const { tabId, items } = data as { tabId: string; items: TechDetection[] }
        store.mergeTabTech(tabId, items)
      }),

      // ─── AI — routed to whichever tab is currently active ────────────────────
      ipc.on(IPC.AI_STREAM_CHUNK, (data) => {
        const { text } = data as { text: string }
        const activeTabId = useSiteStore.getState().activeTabId
        useSiteStore.getState().appendTabAiChunk(activeTabId, text)
      }),
      ipc.on(IPC.AI_STREAM_DONE, () => {
        const activeTabId = useSiteStore.getState().activeTabId
        useSiteStore.getState().setTabAiStreaming(activeTabId, false)
      }),
      ipc.on(IPC.AI_STREAM_ERROR, (data) => {
        const { message } = data as { message: string }
        const activeTabId = useSiteStore.getState().activeTabId
        useSiteStore.getState().setTabAiError(activeTabId, message)
        useSiteStore.getState().setTabAiStreaming(activeTabId, false)
      }),

      // ─── Tab management ──────────────────────────────────────────────────────
      ipc.on(IPC.TAB_CREATED, (data) => {
        const { tabId, isActive } = data as { tabId: string; isActive?: boolean }
        store.createTabState(tabId)
        if (isActive) store.setActiveTabId(tabId)
      }),
      ipc.on(IPC.TAB_CLOSED, (data) => {
        const { tabId, nextActiveTabId } = data as { tabId: string; nextActiveTabId: string }
        store.closeTabState(tabId, nextActiveTabId)
      }),
      ipc.on(IPC.TAB_UPDATED, (data) => {
        const info = data as TabInfo
        if (info?.tabId) {
          store.setTabNav(info.tabId, {
            title: info.title,
            url: info.url,
            favicon: info.favicon,
          })
        }
      }),
    ]

    return () => unsubs.forEach(fn => fn())
  }, [])
}
