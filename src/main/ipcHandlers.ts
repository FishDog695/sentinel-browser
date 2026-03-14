import { ipcMain, BrowserWindow, WebContentsView, safeStorage } from 'electron'
import Anthropic from '@anthropic-ai/sdk'
import Store from 'electron-store'
import { IPC, AIAnalysisRequest } from '../shared/ipcEvents'
import { getSnapshotForUrl } from './cookies'
import { detectFromHtml, detectFromGlobals, mergeDetections } from './techDetector'
import { getScriptUrls } from './session'

const store = new Store<{ apiKey: string }>()
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
5. **Privacy risk level**: Low / Medium / High — one sentence justification`

function buildUserPrompt(req: AIAnalysisRequest): string {
  const trackerList = req.trackers.map(t => t.name + ' (' + t.category + ')').slice(0, 20).join(', ')
  const techList = req.techStack.map(t => t.name + (t.version ? ' ' + t.version : '') + ' [' + t.category + ']').join(', ')
  const fpList = [...new Set(req.fingerprintAttempts.map(f => f.type))].join(', ')
  const thirdParty = req.thirdPartyDomains.slice(0, 30).join(', ')

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
  ].join('\n')
}

export function registerIpcHandlers(
  win: BrowserWindow,
  wcv: WebContentsView,
  setPanelWidth: (w: number) => void,
  updateWebViewBounds: () => void
) {
  // Navigation
  ipcMain.handle(IPC.NAVIGATE_TO, async (_e, url: string) => {
    const normalized = url.startsWith('http') ? url : 'https://' + url
    await wcv.webContents.loadURL(normalized)
  })
  ipcMain.handle(IPC.NAVIGATE_BACK, () => wcv.webContents.navigationHistory.goBack())
  ipcMain.handle(IPC.NAVIGATE_FORWARD, () => wcv.webContents.navigationHistory.goForward())
  ipcMain.handle(IPC.NAVIGATE_RELOAD, () => wcv.webContents.reload())

  // Panel resize
  ipcMain.handle(IPC.PANEL_RESIZE, (_e, width: number) => {
    setPanelWidth(width)
  })

  // Cookies snapshot (called on page load)
  ipcMain.handle('cookie:get-snapshot', async (_e, url: string) => {
    return getSnapshotForUrl(url)
  })

  // Tech detection from DOM/globals
  ipcMain.handle('tech:dom-signals', (_e, data: { html: string; globals: string[] }) => {
    const fromHtml = detectFromHtml(data.html, getScriptUrls())
    const fromGlobals = detectFromGlobals(data.globals)
    const merged = mergeDetections([...fromHtml, ...fromGlobals])
    if (merged.length > 0) win.webContents.send(IPC.TECH_DETECTED, merged)
  })

  // API key management
  ipcMain.handle(IPC.GET_API_KEY, () => {
    const encKey = store.get('apiKey')
    return !!encKey
  })
  ipcMain.handle(IPC.SET_API_KEY, (_e, apiKey: string) => {
    const encrypted = safeStorage.encryptString(apiKey)
    store.set('apiKey', encrypted.toString('base64'))
    anthropic = null  // reset client with new key
  })

  // AI Analysis
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
        max_tokens: 1024,
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
