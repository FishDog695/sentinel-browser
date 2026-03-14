import { ipcMain, BrowserWindow, safeStorage } from 'electron'
import Anthropic from '@anthropic-ai/sdk'
import Store from 'electron-store'
import { IPC, AIAnalysisRequest, Favorite, HistoryEntry } from '../shared/ipcEvents'
import {
  createTab, showTab, closeTab, getActiveWcv, getTabMeta,
} from './tabManager'
import { WindowDimensions } from './window'

const store = new Store<{ apiKey: string; favorites: Favorite[]; history: HistoryEntry[] }>()
let anthropic: Anthropic | null = null
let currentAnalysisController: AbortController | null = null

function getAnthropicClient(): Anthropic | null {
  if (anthropic) return anthropic
  const encKey = store.get('apiKey')
  if (!encKey) return null
  try {
    const key = safeStorage.decryptString(Buffer.from(encKey, 'base64'))
    anthropic = new Anthropic({ apiKey: key })
    return anthropic
  } catch { return null }
}

const SYSTEM_PROMPT = `You are a privacy and security analyst built into a browser. Explain in plain English what a website is doing behind the scenes — what data it collects, who it shares it with, and what technologies it uses.

Be direct and specific. Use short paragraphs. Lead with what matters most to a privacy-conscious user. Do not pad your response.

Structure your response with these sections:
1. **Summary** (2-3 sentences)
2. **What this site collects**
3. **Who it shares data with**
4. **Technologies powering this site**
5. **Geographic & Jurisdiction Risk** — identify any third-party domains, trackers, or services linked to entities operating under Chinese, Russian, Iranian, North Korean, Belarusian, Syrian, or other high-risk government jurisdictions. Name the specific companies/domains and their country. Also use your own knowledge to flag any tracker or company names that are associated with high-risk jurisdictions even if not in the domain list. If none detected, state "No high-risk jurisdiction connections detected."
6. **Privacy risk level**: Low / Medium / High — one sentence justification`

// Known high-risk company base domains → jurisdiction label
const HIGH_RISK_DOMAINS: Record<string, string> = {
  // China
  'baidu.com': 'China (Baidu)',
  'bdstatic.com': 'China (Baidu)',
  'bcebos.com': 'China (Baidu Cloud)',
  'baidustatic.com': 'China (Baidu)',
  'alibaba.com': 'China (Alibaba)',
  'aliyun.com': 'China (Alibaba Cloud)',
  'alicdn.com': 'China (Alibaba CDN)',
  'alipay.com': 'China (Alipay/Ant Group)',
  'taobao.com': 'China (Alibaba/Taobao)',
  'tmall.com': 'China (Alibaba/Tmall)',
  'tencent.com': 'China (Tencent)',
  'tencentcloud.com': 'China (Tencent Cloud)',
  'qq.com': 'China (Tencent/QQ)',
  'wechat.com': 'China (Tencent/WeChat)',
  'qpic.cn': 'China (Tencent)',
  'bytedance.com': 'China (ByteDance)',
  'tiktok.com': 'China (ByteDance/TikTok)',
  'tiktokv.com': 'China (ByteDance/TikTok)',
  'musical.ly': 'China (ByteDance)',
  'ibytedtos.com': 'China (ByteDance)',
  'weibo.com': 'China (Sina Weibo)',
  'sina.com': 'China (Sina)',
  'sinaimg.cn': 'China (Sina)',
  'huawei.com': 'China (Huawei)',
  'hicloud.com': 'China (Huawei Cloud)',
  'jd.com': 'China (JD.com)',
  'pinduoduo.com': 'China (PDD Holdings)',
  'xiaomi.com': 'China (Xiaomi)',
  'miui.com': 'China (Xiaomi)',
  'clouddn.com': 'China (Qiniu Cloud)',
  'qbox.me': 'China (Qiniu Cloud)',
  // Russia
  'yandex.ru': 'Russia (Yandex)',
  'yandex.net': 'Russia (Yandex)',
  'yandex.com': 'Russia (Yandex)',
  'yandex.st': 'Russia (Yandex static)',
  'mail.ru': 'Russia (Mail.ru/VK Group)',
  'vk.com': 'Russia (VK)',
  'vk.me': 'Russia (VK)',
  'userapi.com': 'Russia (VK)',
  'ok.ru': 'Russia (Odnoklassniki/VK Group)',
  'mycdn.me': 'Russia (VK Group CDN)',
  'kaspersky.com': 'Russia (Kaspersky Lab)',
  'drweb.com': 'Russia (Dr.Web)',
  'rambler.ru': 'Russia (Rambler)',
  // Iran
  'aparat.com': 'Iran (Aparat)',
}

// High-risk country-code TLDs
const HIGH_RISK_CCTLDS: Record<string, string> = {
  cn: 'China', ru: 'Russia', ir: 'Iran', kp: 'North Korea',
  by: 'Belarus', sy: 'Syria', cu: 'Cuba', ve: 'Venezuela',
  sd: 'Sudan', ly: 'Libya',
}

function buildGeoSection(thirdPartyDomains: string[], trackerDomains: string[]): string {
  const allDomains = [...new Set([...thirdPartyDomains, ...trackerDomains])]
  const hits = new Map<string, string[]>()

  for (const hostname of allDomains) {
    for (const [baseDomain, label] of Object.entries(HIGH_RISK_DOMAINS)) {
      if (hostname === baseDomain || hostname.endsWith('.' + baseDomain)) {
        const existing = hits.get(label) ?? []
        if (!existing.includes(hostname)) hits.set(label, [...existing, hostname])
        break
      }
    }
    const tld = hostname.split('.').pop()?.toLowerCase() ?? ''
    const country = HIGH_RISK_CCTLDS[tld]
    if (country) {
      const label = country + ' (ccTLD .' + tld + ')'
      const existing = hits.get(label) ?? []
      if (!existing.includes(hostname)) hits.set(label, [...existing, hostname])
    }
  }

  if (hits.size === 0) {
    return 'GEOGRAPHIC CONNECTIONS: None detected via domain analysis — use your knowledge to assess any tracker or company names above.'
  }
  const lines = ['GEOGRAPHIC CONNECTIONS (detected via domain analysis):']
  for (const [label, domains] of hits) {
    lines.push('- ' + label + ': ' + domains.join(', '))
  }
  return lines.join('\n')
}

function buildUserPrompt(req: AIAnalysisRequest): string {
  const trackerList = req.trackers.map(t => t.name + ' (' + t.category + ')').slice(0, 20).join(', ')
  const techList = req.techStack.map(t => t.name + (t.version ? ' ' + t.version : '') + ' [' + t.category + ']').join(', ')
  const fpList = [...new Set(req.fingerprintAttempts.map(f => f.type))].join(', ')
  const thirdParty = req.thirdPartyDomains.slice(0, 30).join(', ')
  const trackerDomains = req.trackers.map(t => t.domain)
  const geoSection = buildGeoSection(req.thirdPartyDomains, trackerDomains)

  return [
    'Analyze this website for privacy and security transparency.',
    '',
    'URL: ' + req.url,
    'Page Title: ' + req.pageTitle,
    '',
    'COOKIES:',
    '- First-party: ' + req.cookieCount.firstParty,
    '- Third-party: ' + req.cookieCount.thirdParty,
    '- Notable third-party cookies: ' + req.cookies.filter(c => !c.firstParty).slice(0, 15).map(c => c.name + ' (' + c.domain + ')').join('; '),
    '',
    'NETWORK:',
    '- Total requests: ' + req.networkRequests.length,
    '- Third-party requests: ' + req.networkRequests.filter(r => !r.firstParty).length,
    '- Third-party domains: ' + thirdParty,
    '',
    'TRACKERS DETECTED: ' + (trackerList || 'None'),
    '',
    'FINGERPRINTING ATTEMPTS: ' + (fpList || 'None'),
    '',
    'TECHNOLOGY STACK: ' + (techList || 'Unknown'),
    '',
    geoSection,
  ].join('\n')
}

function normalizeInput(input: string): string {
  const t = input.trim()
  if (!t) return t
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  // Looks like a plain domain: no spaces, has dot + TLD
  if (!/\s/.test(t) && /^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}([/?#].*)?$/.test(t)) {
    return 'https://' + t
  }
  // Treat as Google search query
  return 'https://www.google.com/search?q=' + encodeURIComponent(t)
}

export function recordHistory(entry: HistoryEntry): void {
  if (entry.url.startsWith('sentinel://')) return
  const all = store.get('history', [])
  const idx = all.findIndex(h => h.url === entry.url)
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...entry }
  } else {
    all.unshift(entry)
  }
  store.set('history', all.slice(0, 500))
}

export function registerIpcHandlers(
  win: BrowserWindow,
  // Passed from index.ts so TAB_CREATE can wire events for new tabs without circular deps
  setupTabEvents: (win: BrowserWindow, tabId: string) => void,
  calculateWebViewBounds: (dims: WindowDimensions) => Electron.Rectangle,
  getPanelWidth: () => number,
  setPanelWidth: (w: number) => void,
  updateWebViewBounds: () => void,
  setOverlayHeight: (h: number) => void,
) {
  // ─── Navigation ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.NAVIGATE_TO, async (_e, url: string) => {
    const wcv = getActiveWcv()
    if (!wcv) return
    // Ignore navigation errors (ERR_ABORTED, redirects, etc.) — they're normal browser events
    await wcv.webContents.loadURL(normalizeInput(url)).catch(() => {})
  })
  ipcMain.handle(IPC.NAVIGATE_BACK, () => getActiveWcv()?.webContents.navigationHistory.goBack())
  ipcMain.handle(IPC.NAVIGATE_FORWARD, () => getActiveWcv()?.webContents.navigationHistory.goForward())
  ipcMain.handle(IPC.NAVIGATE_RELOAD, () => getActiveWcv()?.webContents.reload())

  // ─── Panel resize ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.PANEL_RESIZE, (_e, width: number) => {
    setPanelWidth(width)
  })

  // ─── Toolbar overlay (dropdown open/close) ───────────────────────────────────
  ipcMain.handle(IPC.TOOLBAR_OVERLAY, (_e, height: number) => {
    setOverlayHeight(height)
  })

  // ─── Tabs ────────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.TAB_CREATE, async () => {
    const { tabId, wcv } = createTab(win)
    setupTabEvents(win, tabId)
    const [w, h] = win.getContentSize()
    const bounds = calculateWebViewBounds({ width: w, height: h, panelWidth: getPanelWidth() })
    showTab(tabId, bounds)
    await wcv.webContents.loadURL('sentinel://newtab')
    const meta = getTabMeta(tabId)!
    win.webContents.send(IPC.TAB_CREATED, {
      tabId: meta.id, url: meta.url, title: meta.title, favicon: meta.favicon, isActive: true,
    })
    return tabId
  })

  ipcMain.handle(IPC.TAB_SWITCH, (_e, tabId: string) => {
    const [w, h] = win.getContentSize()
    const bounds = calculateWebViewBounds({ width: w, height: h, panelWidth: getPanelWidth() })
    showTab(tabId, bounds)
  })

  ipcMain.handle(IPC.TAB_CLOSE, (_e, tabId: string) => {
    const nextTabId = closeTab(win, tabId)
    if (nextTabId) {
      const [w, h] = win.getContentSize()
      const bounds = calculateWebViewBounds({ width: w, height: h, panelWidth: getPanelWidth() })
      showTab(nextTabId, bounds)
      win.webContents.send(IPC.TAB_CLOSED, { tabId, nextActiveTabId: nextTabId })
    } else {
      win.close()
    }
  })

  // ─── Window controls ─────────────────────────────────────────────────────────
  ipcMain.handle(IPC.WIN_MINIMIZE, () => win.minimize())
  ipcMain.handle(IPC.WIN_MAXIMIZE, () => win.isMaximized() ? win.unmaximize() : win.maximize())
  ipcMain.handle(IPC.WIN_CLOSE, () => win.close())
  ipcMain.handle(IPC.WIN_IS_MAXIMIZED, () => win.isMaximized())

  // ─── API key management ──────────────────────────────────────────────────────
  ipcMain.handle(IPC.GET_API_KEY, () => {
    const encKey = store.get('apiKey')
    return !!encKey
  })
  ipcMain.handle(IPC.SET_API_KEY, (_e, apiKey: string) => {
    const encrypted = safeStorage.encryptString(apiKey)
    store.set('apiKey', encrypted.toString('base64'))
    anthropic = null
  })

  // ─── Favorites ───────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.FAV_GET, () => store.get('favorites', []))

  ipcMain.handle(IPC.FAV_ADD, (_e, fav: Favorite) => {
    const favs = store.get('favorites', [])
    if (!favs.find(f => f.url === fav.url)) favs.push(fav)
    store.set('favorites', favs)
    return favs
  })

  ipcMain.handle(IPC.FAV_REMOVE, (_e, url: string) => {
    const favs = store.get('favorites', []).filter(f => f.url !== url)
    store.set('favorites', favs)
    return favs
  })

  // ─── History ─────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.HISTORY_GET, () => store.get('history', []))

  ipcMain.handle(IPC.HISTORY_CLEAR, () => {
    store.set('history', [])
    return []
  })

  // ─── AI Analysis ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.AI_ANALYZE, async (event, req: AIAnalysisRequest) => {
    const client = getAnthropicClient()
    if (!client) {
      event.sender.send(IPC.AI_STREAM_ERROR, { message: 'No API key configured. Please add your Anthropic API key in settings.' })
      return
    }

    if (currentAnalysisController) currentAnalysisController.abort()
    currentAnalysisController = new AbortController()

    try {
      const stream = await client.messages.stream({
        model: 'claude-opus-4-6',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(req) }],
      })

      stream.on('text', (text) => {
        if (!currentAnalysisController?.signal.aborted) {
          event.sender.send(IPC.AI_STREAM_CHUNK, { text })
        }
      })

      await stream.finalMessage()
      event.sender.send(IPC.AI_STREAM_DONE, {})
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Analysis failed'
      event.sender.send(IPC.AI_STREAM_ERROR, { message })
    }
  })

  ipcMain.handle(IPC.AI_CANCEL, () => {
    currentAnalysisController?.abort()
    currentAnalysisController = null
  })
}
