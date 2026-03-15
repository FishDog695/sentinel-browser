import { useState, useEffect, useMemo } from 'react'
import { useSiteStore } from '../../store/siteStore'
import { ipc } from '../../lib/ipc'
import type { AIAnalysisRequest, CookieEvent, NetworkRequest, TrackerDetection, FingerprintEvent, TechDetection } from '../../../../../shared/ipcEvents'

const EMPTY_COOKIES = new Map<string, CookieEvent>()
const EMPTY_REQUESTS: NetworkRequest[] = []
const EMPTY_TRACKERS = new Map<string, TrackerDetection>()
const EMPTY_FP: FingerprintEvent[] = []
const EMPTY_TECH: TechDetection[] = []

const CLAUDE_MODELS = [
  { id: 'claude-opus-4-5',   label: 'Opus (Most Capable)' },
  { id: 'claude-sonnet-4-5', label: 'Sonnet (Balanced)' },
]

const GEMINI_MODELS = [
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Fast)' },
  { id: 'gemini-2.0-pro',   label: 'Gemini 2.0 Pro' },
  { id: 'gemini-1.5-pro',   label: 'Gemini 1.5 Pro' },
]

export function AIPanel() {
  const activeTabId = useSiteStore(s => s.activeTabId)
  const nav = useSiteStore(s => s.tabs[activeTabId]?.nav)
  const cookiesMap = useSiteStore(s => s.tabs[activeTabId]?.cookies ?? EMPTY_COOKIES)
  const cookies = useMemo(() => Array.from(cookiesMap.values()), [cookiesMap])
  const requests = useSiteStore(s => s.tabs[activeTabId]?.networkRequests ?? EMPTY_REQUESTS)
  const trackersMap = useSiteStore(s => s.tabs[activeTabId]?.trackers ?? EMPTY_TRACKERS)
  const trackers = useMemo(() => Array.from(trackersMap.values()), [trackersMap])
  const fps = useSiteStore(s => s.tabs[activeTabId]?.fingerprintAttempts ?? EMPTY_FP)
  const tech = useSiteStore(s => s.tabs[activeTabId]?.techStack ?? EMPTY_TECH)
  const aiAnalysis = useSiteStore(s => s.tabs[activeTabId]?.aiAnalysis ?? '')
  const aiStreaming = useSiteStore(s => s.tabs[activeTabId]?.aiStreaming ?? false)
  const aiError = useSiteStore(s => s.tabs[activeTabId]?.aiError ?? null)

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean | null>(null)
  const [provider, setProvider] = useState<'claude' | 'gemini'>('claude')
  const [selectedModel, setSelectedModel] = useState<string>('claude-opus-4-5')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [aiDomainsAdded, setAiDomainsAdded] = useState(false)

  // Parse [BLOCK: ...] tag from completed AI analysis
  const blockMatch = !aiStreaming ? aiAnalysis.match(/\[BLOCK:\s*([^\]]+)\]/) : null
  const aiDomains = blockMatch
    ? blockMatch[1].split(',').map(d => d.trim()).filter(Boolean)
    : []

  useEffect(() => {
    Promise.all([ipc.getApiKey(), ipc.getGeminiKey(), ipc.getAiProvider(), ipc.getAiModel()])
      .then(([claude, gemini, prov, model]) => {
        setHasApiKey(claude)
        setHasGeminiKey(gemini)
        setProvider(prov)
        setSelectedModel(model)
      })
  }, [])

  const hasCurrentKey = provider === 'claude' ? hasApiKey : hasGeminiKey

  async function handleSaveKey() {
    if (!keyInput.trim()) return
    setSavingKey(true)
    if (provider === 'claude') {
      await ipc.setApiKey(keyInput.trim())
      setHasApiKey(true)
    } else {
      await ipc.setGeminiKey(keyInput.trim())
      setHasGeminiKey(true)
    }
    setShowKeyInput(false)
    setKeyInput('')
    setSavingKey(false)
  }

  async function handleAnalyze() {
    if (!nav?.url) return
    useSiteStore.getState().clearTabAiAnalysis(activeTabId)
    useSiteStore.getState().setTabAiStreaming(activeTabId, true)
    setAiDomainsAdded(false)

    const thirdPartyDomains = [...new Set(
      requests.filter(r => !r.firstParty).map(r => {
        try { return new URL(r.url).hostname } catch { return r.url }
      })
    )]

    const req: AIAnalysisRequest = {
      url: nav.url,
      pageTitle: nav.title,
      cookies,
      networkRequests: requests,
      trackers,
      fingerprintAttempts: fps,
      techStack: tech,
      thirdPartyDomains,
      cookieCount: {
        firstParty: cookies.filter(c => c.firstParty).length,
        thirdParty: cookies.filter(c => !c.firstParty).length,
      },
    }

    await ipc.analyzeCurrentSite(req)
  }

  function handleCancel() {
    ipc.cancelAnalysis()
    useSiteStore.getState().setTabAiStreaming(activeTabId, false)
  }

  if (hasApiKey === null) {
    return <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Loading...</div>
  }

  const keyPlaceholder = provider === 'claude' ? 'sk-ant-...' : 'AIza...'
  const keyLabel = provider === 'claude'
    ? 'Enter your Anthropic API key to enable AI analysis. Stored encrypted on your device.'
    : 'Enter your Google Gemini API key to enable AI analysis. Stored encrypted on your device.'
  const keyUpdateLabel = provider === 'claude' ? 'Update your Anthropic API key:' : 'Update your Google Gemini API key:'

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Provider toggle + model selector */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {(['claude', 'gemini'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={async () => {
                setProvider(p)
                await ipc.setAiProvider(p)
                // Load the saved model for the newly selected provider
                const model = await ipc.getAiModel()
                setSelectedModel(model)
                setShowKeyInput(false)
                setKeyInput('')
              }}
              className={provider === p
                ? 'flex-1 py-1 text-xs font-medium bg-blue-600 text-white'
                : 'flex-1 py-1 text-xs font-medium bg-gray-800 text-gray-400 hover:text-gray-200'}
            >
              {p === 'claude' ? '🤖 Claude' : '✨ Gemini'}
            </button>
          ))}
        </div>
        <select
          value={selectedModel}
          onChange={async (e) => {
            setSelectedModel(e.target.value)
            await ipc.setAiModel(e.target.value)
          }}
          className="w-full bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 px-2 py-1 focus:outline-none focus:border-blue-500"
        >
          {(provider === 'claude' ? CLAUDE_MODELS : GEMINI_MODELS).map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      {!hasCurrentKey || showKeyInput ? (
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <p className="text-xs text-gray-300 mb-2">
            {hasCurrentKey ? keyUpdateLabel : keyLabel}
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
              placeholder={keyPlaceholder}
              className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
            />
            <button
              onClick={handleSaveKey}
              disabled={savingKey || !keyInput.trim()}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded"
            >
              {savingKey ? '...' : 'Save'}
            </button>
            {hasCurrentKey && (
              <button onClick={() => { setShowKeyInput(false); setKeyInput('') }} className="px-2 py-1 text-gray-400 hover:text-gray-200 text-xs">
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : null}

      {hasCurrentKey && !showKeyInput && (
        <div className="flex gap-2 shrink-0">
          {aiStreaming ? (
            <button
              onClick={handleCancel}
              className="flex-1 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-sm rounded-lg"
            >
              Stop Analysis
            </button>
          ) : (
            <button
              onClick={handleAnalyze}
              disabled={!nav?.url}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium"
            >
              Analyze This Site
            </button>
          )}
          <button
            onClick={() => setShowKeyInput(true)}
            className="w-8 h-9 flex items-center justify-center text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-800 text-sm"
            title="Change API key"
          >
            ⚙
          </button>
        </div>
      )}

      {!aiAnalysis && !aiStreaming && hasCurrentKey && !showKeyInput && (
        <div className="text-xs text-gray-500 space-y-1">
          <div>Ready to analyze: <span className="text-gray-300">{nav?.title || nav?.url}</span></div>
          <div className="flex gap-3">
            <span>{cookies.length} cookies</span>
            <span>{requests.length} requests</span>
            <span className={trackers.length > 0 ? 'text-orange-400' : ''}>{trackers.length} trackers</span>
          </div>
        </div>
      )}

      {(aiAnalysis || aiStreaming) && (
        <div className="flex-1 overflow-y-auto">
          <AnalysisOutput text={aiAnalysis} streaming={aiStreaming} />
        </div>
      )}

      {/* AI-identified domains block button — shown after analysis completes */}
      {aiDomains.length > 0 && !aiStreaming && (
        <button
          onClick={async () => {
            await ipc.addAiBlocklist(aiDomains)
            setAiDomainsAdded(true)
          }}
          disabled={aiDomainsAdded}
          className="shrink-0 w-full py-1.5 text-xs bg-red-600/20 border border-red-500/30 text-red-400 rounded hover:bg-red-600/30 disabled:opacity-60 transition-colors"
        >
          {aiDomainsAdded
            ? `✓ ${aiDomains.length} domain${aiDomains.length > 1 ? 's' : ''} added to block list`
            : `Block ${aiDomains.length} AI-identified domain${aiDomains.length > 1 ? 's' : ''}`}
        </button>
      )}

      {aiError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded p-2 text-xs text-red-400">
          {aiError}
        </div>
      )}
    </div>
  )
}

function AnalysisOutput({ text, streaming }: { text: string; streaming: boolean }) {
  const lines = text.split('\n')
  return (
    <div className="text-sm text-gray-200 space-y-2">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />
        const parts = line.split(/(\*\*[^*]+\*\*)/)
        return (
          <p key={i} className="leading-relaxed">
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j} className="text-white font-semibold">{part.slice(2, -2)}</strong>
                : part
            )}
          </p>
        )
      })}
      {streaming && <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5 align-text-bottom" />}
    </div>
  )
}
