import { useState, useEffect } from 'react'
import { useSiteStore } from '../../store/siteStore'
import { ipc } from '../../lib/ipc'
import type { AIAnalysisRequest } from '../../../../../shared/ipcEvents'

export function AIPanel() {
  const nav = useSiteStore(s => s.nav)
  const cookies = useSiteStore(s => Array.from(s.cookies.values()))
  const requests = useSiteStore(s => s.networkRequests)
  const trackers = useSiteStore(s => Array.from(s.trackers.values()))
  const fps = useSiteStore(s => s.fingerprintAttempts)
  const tech = useSiteStore(s => s.techStack)
  const aiAnalysis = useSiteStore(s => s.aiAnalysis)
  const aiStreaming = useSiteStore(s => s.aiStreaming)
  const aiError = useSiteStore(s => s.aiError)
  const setAiStreaming = useSiteStore(s => s.setAiStreaming)
  const clearAiAnalysis = useSiteStore(s => s.clearAiAnalysis)

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [savingKey, setSavingKey] = useState(false)

  useEffect(() => {
    ipc.getApiKey().then(setHasApiKey)
  }, [])

  async function handleSaveKey() {
    if (!keyInput.trim()) return
    setSavingKey(true)
    await ipc.setApiKey(keyInput.trim())
    setHasApiKey(true)
    setShowKeyInput(false)
    setKeyInput('')
    setSavingKey(false)
  }

  async function handleAnalyze() {
    if (!nav.url) return
    clearAiAnalysis()
    setAiStreaming(true)

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
    setAiStreaming(false)
  }

  if (hasApiKey === null) {
    return <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Loading...</div>
  }

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* API key setup */}
      {!hasApiKey || showKeyInput ? (
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <p className="text-xs text-gray-300 mb-2">
            {hasApiKey ? 'Update your Anthropic API key:' : 'Enter your Anthropic API key to enable AI analysis. Your key is stored encrypted on your device and never leaves it.'}
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
              placeholder="sk-ant-..."
              className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
            />
            <button
              onClick={handleSaveKey}
              disabled={savingKey || !keyInput.trim()}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded"
            >
              {savingKey ? '...' : 'Save'}
            </button>
            {hasApiKey && (
              <button onClick={() => setShowKeyInput(false)} className="px-2 py-1 text-gray-400 hover:text-gray-200 text-xs">
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* Analyze button */}
      {hasApiKey && !showKeyInput && (
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
              disabled={!nav.url}
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

      {/* Context summary */}
      {!aiAnalysis && !aiStreaming && hasApiKey && !showKeyInput && (
        <div className="text-xs text-gray-500 space-y-1">
          <div>Ready to analyze: <span className="text-gray-300">{nav.title || nav.url}</span></div>
          <div className="flex gap-3">
            <span>{cookies.length} cookies</span>
            <span>{requests.length} requests</span>
            <span className={trackers.length > 0 ? 'text-orange-400' : ''}>{trackers.length} trackers</span>
          </div>
        </div>
      )}

      {/* Analysis output */}
      {(aiAnalysis || aiStreaming) && (
        <div className="flex-1 overflow-y-auto">
          <AnalysisOutput text={aiAnalysis} streaming={aiStreaming} />
        </div>
      )}

      {/* Error */}
      {aiError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded p-2 text-xs text-red-400">
          {aiError}
        </div>
      )}
    </div>
  )
}

function AnalysisOutput({ text, streaming }: { text: string; streaming: boolean }) {
  // Simple markdown rendering: bold headers (**text**) and line breaks
  const lines = text.split('\n')

  return (
    <div className="text-sm text-gray-200 space-y-2">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />
        // Render **bold** text
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
