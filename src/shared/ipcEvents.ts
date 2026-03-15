// IPC channel constants and payload types shared between main and renderer.

export const IPC = {
  // Navigation — Main → Renderer (all include tabId)
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

  // Tabs — Main → Renderer (push)
  TAB_CREATED: 'tab:created',
  TAB_CLOSED:  'tab:closed',
  TAB_UPDATED: 'tab:updated',

  // Window state — Main → Renderer (push)
  WIN_MAXIMIZED: 'win:maximized',

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
  GET_GEMINI_KEY:   'settings:get-gemini-key',
  SET_GEMINI_KEY:   'settings:set-gemini-key',
  GET_AI_PROVIDER:  'settings:get-ai-provider',
  SET_AI_PROVIDER:  'settings:set-ai-provider',
  GET_AI_MODEL:     'settings:get-ai-model',
  SET_AI_MODEL:     'settings:set-ai-model',

  // Tabs — Renderer → Main (invoke)
  TAB_CREATE: 'tab:create',
  TAB_CLOSE:  'tab:close',
  TAB_SWITCH: 'tab:switch',

  // Window controls — Renderer → Main (invoke)
  WIN_MINIMIZE:     'win:minimize',
  WIN_MAXIMIZE:     'win:maximize',
  WIN_CLOSE:        'win:close',
  WIN_IS_MAXIMIZED: 'win:is-maximized',

  // Favorites — Renderer → Main (invoke, each returns updated Favorite[])
  FAV_GET:    'fav:get',
  FAV_ADD:    'fav:add',
  FAV_REMOVE: 'fav:remove',

  // History — Renderer → Main (invoke)
  HISTORY_GET:   'history:get',
  HISTORY_CLEAR: 'history:clear',

  // Toolbar overlay — Renderer → Main (invoke): temporarily shifts WebContentsView down
  TOOLBAR_OVERLAY: 'toolbar:overlay',

  // Lockdown mode — bidirectional
  GET_MODE:        'settings:get-mode',
  SET_MODE:        'settings:set-mode',
  MODE_CHANGED:    'settings:mode-changed',   // Main → Renderer push
  BLOCKED_REQUEST: 'network:blocked',          // Main → Renderer push

  // Privacy cleanup settings
  GET_CLEAR_ON_CLOSE: 'settings:get-clear-on-close',
  SET_CLEAR_ON_CLOSE: 'settings:set-clear-on-close',

  // Renderer → Main: pull current tab list on startup (avoids push race condition)
  GET_TABS: 'tabs:get-all',
} as const

export type IpcChannel = typeof IPC[keyof typeof IPC]

// ─── Payload types ───────────────────────────────────────────────────────────

export interface NavUrlChanged     { tabId: string; url: string }
export interface NavTitleChanged   { tabId: string; title: string }
export interface NavHistoryChanged { tabId: string; canGoBack: boolean; canGoForward: boolean }
export interface NavPageLoading    { tabId: string; url: string }
export interface NavFavicon        { tabId: string; url: string }

export interface CookieEvent {
  id: string
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
  size: number
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
  timing: number
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

export interface Favorite {
  url: string
  title: string
  favicon?: string
  addedAt: number
}

export interface HistoryEntry {
  url: string
  title: string
  favicon?: string
  visitedAt: number
}

export interface TabInfo {
  tabId: string
  title: string
  url: string
  favicon: string
}

export interface BlockedRequest {
  tabId: string
  url: string
  reason: 'tracker' | 'ai-blocklist'
}
