import { BrowserWindow, WebContentsView } from 'electron'
import { parse } from 'tldts'
import { IPC, NetworkRequest, NetworkResponse } from '../shared/ipcEvents'
import { matchTracker } from './trackerEngine'
import { electronCookieToEvent, isFirstParty } from './cookies'
import { detectFromHeaders } from './techDetector'
import { getTabIdByWcId, getActiveTabId } from './tabManager'
import { getLockdownMode, aiBlocklist } from './ipcHandlers'

// Per-tab URL tracking (for first-party determination)
const tabUrls = new Map<string, string>()
// Per-tab script URLs for tech detection
const tabScriptUrls = new Map<string, Set<string>>()
const requestTimestamps = new Map<string, number>()
const requestFirstPartyCache = new Map<string, boolean>()

export function setTabUrl(tabId: string, url: string) {
  tabUrls.set(tabId, url)
  tabScriptUrls.set(tabId, new Set())
}

export function getTabUrl(tabId: string): string {
  return tabUrls.get(tabId) ?? ''
}

export function getScriptUrls(tabId?: string): string[] {
  const id = tabId ?? getActiveTabId()
  return Array.from(tabScriptUrls.get(id) ?? [])
}

function getEtldPlusOne(url: string): string {
  try {
    const parsed = parse(url, { allowPrivateDomains: false })
    return parsed.domain ?? ''
  } catch { return '' }
}

// setupSessionHooks is called ONCE per window — the session is shared across all tabs
export function setupSessionHooks(win: BrowserWindow, wcv: WebContentsView) {
  const ses = wcv.webContents.session

  // Override the Electron user agent so sites like Google don't block navigation
  ses.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  )

  // Helper — returns true if the window and its webContents are still alive
  function winAlive(): boolean {
    return !win.isDestroyed() && !win.webContents.isDestroyed()
  }

  // ─── Cookies ────────────────────────────────────────────────────────────────
  // Cookie events are session-level; route them to the currently active tab
  ses.cookies.on('changed', (_event, cookie, cause, removed) => {
    if (!winAlive()) return   // window already destroyed (e.g. cleanup on exit)
    const activeId = getActiveTabId()
    const pageUrl = tabUrls.get(activeId) ?? ''
    const event = electronCookieToEvent(cookie, pageUrl)
    if (removed) {
      win.webContents.send(IPC.COOKIE_REMOVED, { ...event, tabId: activeId })
    } else if (cause === 'explicit' || cause === 'overwrite') {
      win.webContents.send(IPC.COOKIE_ADDED, { ...event, tabId: activeId })
    } else {
      win.webContents.send(IPC.COOKIE_CHANGED, { ...event, tabId: activeId })
    }
  })

  // ─── Network requests ────────────────────────────────────────────────────────
  // Route each request to the tab that made it via webContentsId
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    // webContentsId is available in Electron 33+ onBeforeRequest details
    const wcId = (details as unknown as { webContentsId?: number }).webContentsId ?? 0
    const tabId = getTabIdByWcId(wcId)
    const pageUrl = tabUrls.get(tabId) ?? ''
    const firstParty = isFirstParty(getEtldPlusOne(details.url), pageUrl)
    requestFirstPartyCache.set(details.id.toString(), firstParty)
    requestTimestamps.set(details.id.toString(), Date.now())

    if (details.resourceType === 'script') {
      if (!tabScriptUrls.has(tabId)) tabScriptUrls.set(tabId, new Set())
      tabScriptUrls.get(tabId)!.add(details.url)
    }

    const trackerMatch = matchTracker(details.url)

    const req: NetworkRequest = {
      id: details.id.toString(),
      url: details.url,
      method: details.method,
      resourceType: details.resourceType,
      initiator: (details as unknown as { initiator?: string }).initiator ?? '',
      timestamp: Date.now(),
      firstParty,
      trackerMatch: trackerMatch?.company,
      trackerCategory: trackerMatch?.category,
    }

    if (winAlive()) {
      win.webContents.send(IPC.NETWORK_REQUEST, { ...req, tabId })

      if (trackerMatch) {
        win.webContents.send(IPC.TRACKER_DETECTED, {
          url: details.url,
          category: trackerMatch.category,
          name: trackerMatch.company,
          domain: trackerMatch.domain,
          tabId,
        })
      }
    }

    // In Lockdown mode: block tracker requests and AI-identified domains
    if (getLockdownMode()) {
      let hostname = ''
      try { hostname = new URL(details.url).hostname } catch { /* ignore */ }

      if (trackerMatch) {
        if (winAlive()) win.webContents.send(IPC.BLOCKED_REQUEST, { tabId, url: details.url, reason: 'tracker' })
        return callback({ cancel: true })
      }
      if (hostname && aiBlocklist.has(hostname)) {
        if (winAlive()) win.webContents.send(IPC.BLOCKED_REQUEST, { tabId, url: details.url, reason: 'ai-blocklist' })
        return callback({ cancel: true })
      }
    }

    callback({})
  })

  // ─── Third-party cookie blocking (Lockdown mode only) ────────────────────────
  ses.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, callback) => {
    if (!getLockdownMode()) return callback({})

    const pageUrl = (details as unknown as { referrer?: string }).referrer || details.url
    const pageEtld = getEtldPlusOne(pageUrl)
    const reqEtld = getEtldPlusOne(details.url)
    const isThirdParty = !!(pageEtld && reqEtld && pageEtld !== reqEtld)

    if (!isThirdParty) return callback({})

    const headers = { ...details.responseHeaders }
    const cookieKeys = Object.keys(headers).filter(k => k.toLowerCase() === 'set-cookie')
    if (cookieKeys.length > 0) {
      cookieKeys.forEach(k => delete headers[k])
      return callback({ responseHeaders: headers })
    }
    callback({})
  })

  // ─── Network responses ───────────────────────────────────────────────────────
  ses.webRequest.onResponseStarted({ urls: ['<all_urls>'] }, (details) => {
    const wcId = (details as unknown as { webContentsId?: number }).webContentsId ?? 0
    const tabId = getTabIdByWcId(wcId)
    const start = requestTimestamps.get(details.id.toString()) ?? Date.now()
    const timing = Date.now() - start

    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(details.responseHeaders ?? {})) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v
    }

    const resp: NetworkResponse = {
      id: details.id.toString(),
      statusCode: details.statusCode,
      headers,
      size: headers['content-length'] ? parseInt(headers['content-length']) : undefined,
      timing,
    }

    if (!winAlive()) return

    win.webContents.send(IPC.NETWORK_RESPONSE, { ...resp, tabId })

    if (details.resourceType === 'mainFrame' && details.statusCode < 400) {
      const techFromHeaders = detectFromHeaders(headers)
      if (techFromHeaders.length > 0) {
        win.webContents.send(IPC.TECH_DETECTED, { items: techFromHeaders, tabId })
      }
    }
  })
}
