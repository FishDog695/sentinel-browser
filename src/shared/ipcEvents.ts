// IPC channel constants and payload types shared between main and renderer.
// Author this first — it is the contract all other code depends on.

export const IPC = {
  // Navigation — Main → Renderer
  NAV_URL_CHANGED:     'nav:url-changed',
  NAV_TITLE_CHANGED:   'nav:title-changed',
  NAV_HISTORY_CHANGED: 'nav:history-changed',
  NAV_PAGE_LOADED:     'nav:page-loaded',
  NAV_PAGE_LOADING:    'nav:page-loading',
  NAV_FAVICON:         'nav:favicon',

  // Cookies — Main → Renderer
  COOKIE_ADDED:     'cookie:added',
  COOKIE_CHANGED:   'cookie:changed',
  COOKIE_REMOVED:   'cookie:removed',
  COOKIES_SNAPSHOT: 'cookie:snapshot',

  // Network — Main → Renderer
  NETWORK_REQUEST:  'network:request',
  NETWORK_RESPONSE: 'network:response',

  // Trackers — Main → Renderer
  TRACKER_DETECTED:    'tracker:detected',
  FINGERPRINT_ATTEMPT: 'tracker:fingerprint',

  // Tech Stack — Main → Renderer
  TECH_DETECTED: 'tech:detected',

  // AI — bidirectional
  AI_STREAM_CHUNK: 'ai:stream-chunk',
  AI_STREAM_DONE:  'ai:stream-done',
  AI_STREAM_ERROR: 'ai:stream-error',

  // Renderer → Main (invoke)
  NAVIGATE_TO:      'nav:navigate-to',
  NAVIGATE_BACK:    'nav:back',
  NAVIGATE_FORWARD: 'nav:forward',
  NAVIGATE_RELOAD:  'nav:reload',
  PANEL_RESIZE:     'panel:resize',
  AI_ANALYZE:       'ai:analyze',
  AI_CANCEL:        'ai:cancel',
  GET_API_KEY:      'settings:get-api-key',
  SET_API_KEY:      'settings:set-api-key',
} as const

export type IpcChannel = typeof IPC[keyof typeof IPC]

// ─── Payload types ───────────────────────────────────────────────────────────

export interface NavUrlChanged { url: string }
export interface NavTitleChanged { title: string }
export interface NavHistoryChanged { canGoBack: boolean; canGoForward: boolean }
export interface NavPageLoaded { url: string }
export interface NavFavicon { url: string }

export interface CookieEvent {
  id: string            // `${name}@${domain}`
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  sameSite: 'no_restriction' | 'lax' | 'strict' | undefined
  expirationDate?: number
  firstParty: boolean
  session: boolean
  size: number          // byte estimate
}

export interface NetworkRequest {
  id: string
  url: string
  method: string
  resourceType: string
  initiator: string
  timestamp: number
  firstParty: boolean
  trackerMatch?: string
  trackerCategory?: string
}

export interface NetworkResponse {
  id: string
  statusCode: number
  headers: Record<string, string>
  size?: number
  timing: number        // ms from request start
}

export interface TrackerDetection {
  url: string
  category: string
  name: string
  domain: string
}

export interface FingerprintEvent {
  type: 'canvas' | 'webgl' | 'audio' | 'font' | 'battery'
  detail: string
  scriptUrl?: string
  timestamp: number
}

export interface TechDetection {
  name: string
  category: string
  version?: string
  confidence: number
  icon?: string
}

export interface AIAnalysisRequest {
  url: string
  pageTitle: string
  cookies: CookieEvent[]
  networkRequests: NetworkRequest[]
  trackers: TrackerDetection[]
  fingerprintAttempts: FingerprintEvent[]
  techStack: TechDetection[]
  thirdPartyDomains: string[]
  cookieCount: { firstParty: number; thirdParty: number }
}

export interface AIStreamChunk { text: string }
export interface AIStreamError { message: string }
