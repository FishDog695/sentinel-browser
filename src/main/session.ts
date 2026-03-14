import { BrowserWindow, WebContentsView } from 'electron'
import { parse } from 'tldts'
import { IPC, NetworkRequest, NetworkResponse } from '../shared/ipcEvents'
import { matchTracker } from './trackerEngine'
import { electronCookieToEvent, isFirstParty } from './cookies'
import { detectFromHeaders } from './techDetector'

let currentPageUrl = ''
const requestTimestamps = new Map<string, number>()
const requestFirstPartyCache = new Map<string, boolean>()
const scriptUrlsByPage = new Set<string>()

export function setCurrentPageUrl(url: string) {
  currentPageUrl = url
  scriptUrlsByPage.clear()
}

export function getScriptUrls(): string[] {
  return Array.from(scriptUrlsByPage)
}

function getEtldPlusOne(url: string): string {
  try {
    const parsed = parse(url, { allowPrivateDomains: false })
    return parsed.domain ?? ''
  } catch { return '' }
}

export function setupSessionHooks(win: BrowserWindow, wcv: WebContentsView) {
  const ses = wcv.webContents.session

  // ─── Cookies ────────────────────────────────────────────────────────────────
  ses.cookies.on('changed', (_event, cookie, cause, removed) => {
    const event = electronCookieToEvent(cookie, currentPageUrl)
    if (removed) {
      win.webContents.send(IPC.COOKIE_REMOVED, event)
    } else if (cause === 'explicit' || cause === 'overwrite') {
      win.webContents.send(IPC.COOKIE_ADDED, event)
    } else {
      win.webContents.send(IPC.COOKIE_CHANGED, event)
    }
  })

  // ─── Network requests ────────────────────────────────────────────────────────
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    const firstParty = isFirstParty(getEtldPlusOne(details.url), currentPageUrl)
    requestFirstPartyCache.set(details.id.toString(), firstParty)
    requestTimestamps.set(details.id.toString(), Date.now())

    // Track script src URLs for tech detection
    if (details.resourceType === 'script') {
      scriptUrlsByPage.add(details.url)
    }

    const trackerMatch = matchTracker(details.url)

    const req: NetworkRequest = {
      id: details.id.toString(),
      url: details.url,
      method: details.method,
      resourceType: details.resourceType,
      initiator: details.initiator ?? '',
      timestamp: Date.now(),
      firstParty,
      trackerMatch: trackerMatch?.company,
      trackerCategory: trackerMatch?.category,
    }

    win.webContents.send(IPC.NETWORK_REQUEST, req)

    if (trackerMatch) {
      win.webContents.send(IPC.TRACKER_DETECTED, {
        url: details.url,
        category: trackerMatch.category,
        name: trackerMatch.company,
        domain: trackerMatch.domain,
      })
    }

    callback({})
  })

  // ─── Network responses ───────────────────────────────────────────────────────
  ses.webRequest.onResponseStarted({ urls: ['<all_urls>'] }, (details) => {
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

    win.webContents.send(IPC.NETWORK_RESPONSE, resp)

    // Tech detection from response headers (main document only)
    if (details.resourceType === 'mainFrame' && details.statusCode < 400) {
      const techFromHeaders = detectFromHeaders(headers)
      if (techFromHeaders.length > 0) {
        win.webContents.send(IPC.TECH_DETECTED, techFromHeaders)
      }
    }
  })
}
