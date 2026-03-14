import { useState, useRef, useEffect } from 'react'
import { useSiteStore } from '../../store/siteStore'
import { ipc } from '../../lib/ipc'

export function BrowserChrome() {
  const nav = useSiteStore(s => s.nav)
  const [inputUrl, setInputUrl] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isEditing) setInputUrl(nav.url)
  }, [nav.url, isEditing])

  function handleNavigate(e: React.FormEvent) {
    e.preventDefault()
    ipc.navigateTo(inputUrl)
    setIsEditing(false)
    inputRef.current?.blur()
  }

  const isSecure = nav.url.startsWith('https://')

  return (
    <div
      className="h-12 bg-gray-950 border-b border-gray-800 flex items-center gap-2 px-3 shrink-0"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Navigation buttons */}
      <button
        onClick={() => ipc.navigateBack()}
        disabled={!nav.canGoBack}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 text-sm"
        title="Back"
      >
        ←
      </button>
      <button
        onClick={() => ipc.navigateForward()}
        disabled={!nav.canGoForward}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 text-sm"
        title="Forward"
      >
        →
      </button>
      <button
        onClick={() => ipc.navigateReload()}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-800 text-gray-300 text-sm"
        title="Reload"
      >
        {nav.loading ? '✕' : '↻'}
      </button>

      {/* URL bar */}
      <form onSubmit={handleNavigate} className="flex-1">
        <div className="flex items-center bg-gray-800 rounded-md border border-gray-700 focus-within:border-blue-500 px-2 h-8 gap-1.5">
          {/* Security indicator */}
          <span className={isSecure ? 'text-green-400' : 'text-gray-500'} title={isSecure ? 'Secure connection' : 'Not secure'}>
            {isSecure ? '🔒' : '🔓'}
          </span>
          {/* Favicon */}
          {nav.favicon && !isEditing && (
            <img src={nav.favicon} className="w-4 h-4" alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          )}
          <input
            ref={inputRef}
            value={isEditing ? inputUrl : nav.url}
            onChange={e => setInputUrl(e.target.value)}
            onFocus={() => { setIsEditing(true); setInputUrl(nav.url); setTimeout(() => inputRef.current?.select(), 0) }}
            onBlur={() => setIsEditing(false)}
            placeholder="Enter URL or search..."
            className="flex-1 bg-transparent text-gray-200 text-sm outline-none placeholder:text-gray-500 min-w-0"
            spellCheck={false}
          />
          {nav.loading && (
            <span className="text-blue-400 text-xs animate-spin">⟳</span>
          )}
        </div>
      </form>
    </div>
  )
}
