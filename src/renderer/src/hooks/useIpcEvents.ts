import { useEffect } from 'react'
import { useSiteStore } from '../store/siteStore'
import { ipc } from '../lib/ipc'
import type { CookieEvent, NetworkRequest, NetworkResponse, TrackerDetection, FingerprintEvent, TechDetection } from '../../../../shared/ipcEvents'

// Single hook that wires up ALL IPC push events to the Zustand store
export function useIpcEvents() {
  const store = useSiteStore()

  useEffect(() => {
    const IPC = ipc.IPC()

    const unsubs = [
      // Navigation
      ipc.on(IPC.NAV_URL_CHANGED, (data) => {
        const { url } = data as { url: string }
        store.setNav({ url })
      }),
      ipc.on(IPC.NAV_TITLE_CHANGED, (data) => {
        const { title } = data as { title: string }
        store.setNav({ title })
        document.title = title + ' — Sentinel'
      }),
      ipc.on(IPC.NAV_HISTORY_CHANGED, (data) => {
        const { canGoBack, canGoForward } = data as { canGoBack: boolean; canGoForward: boolean }
        store.setNav({ canGoBack, canGoForward })
      }),
      ipc.on(IPC.NAV_PAGE_LOADING, (data) => {
        const { url } = data as { url: string }
        store.setNav({ loading: true, url })
        store.resetSiteData()
      }),
      ipc.on(IPC.NAV_PAGE_LOADED, () => {
        store.setNav({ loading: false })
      }),
      ipc.on(IPC.NAV_FAVICON, (data) => {
        const { url } = data as { url: string }
        store.setNav({ favicon: url })
      }),

      // Cookies
      ipc.on(IPC.COOKIES_SNAPSHOT, (data) => {
        store.setCookieSnapshot(data as CookieEvent[])
      }),
      ipc.on(IPC.COOKIE_ADDED, (data) => store.upsertCookie(data as CookieEvent)),
      ipc.on(IPC.COOKIE_CHANGED, (data) => store.upsertCookie(data as CookieEvent)),
      ipc.on(IPC.COOKIE_REMOVED, (data) => store.removeCookie((data as CookieEvent).id)),

      // Network
      ipc.on(IPC.NETWORK_REQUEST, (data) => store.addNetworkRequest(data as NetworkRequest)),
      ipc.on(IPC.NETWORK_RESPONSE, (data) => store.addNetworkResponse(data as NetworkResponse)),

      // Trackers
      ipc.on(IPC.TRACKER_DETECTED, (data) => store.addTracker(data as TrackerDetection)),
      ipc.on(IPC.FINGERPRINT_ATTEMPT, (data) => store.addFingerprintAttempt(data as FingerprintEvent)),

      // Tech
      ipc.on(IPC.TECH_DETECTED, (data) => store.mergeTech(data as TechDetection[])),

      // AI
      ipc.on(IPC.AI_STREAM_CHUNK, (data) => {
        const { text } = data as { text: string }
        store.appendAiChunk(text)
      }),
      ipc.on(IPC.AI_STREAM_DONE, () => store.setAiStreaming(false)),
      ipc.on(IPC.AI_STREAM_ERROR, (data) => {
        const { message } = data as { message: string }
        store.setAiError(message)
        store.setAiStreaming(false)
      }),
    ]

    return () => unsubs.forEach(fn => fn())
  }, [])
}
