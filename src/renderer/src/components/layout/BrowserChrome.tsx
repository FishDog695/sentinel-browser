import { useState, useRef, useEffect } from 'react'
import { useSiteStore } from '../../store/siteStore'
import { ipc } from '../../lib/ipc'

function getHostname(url: string): string {
  try {
    return new URL(url).hostname || url
  } catch {
    return url
  }
}

// SVG icons
function IconBack({ disabled }: { disabled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={['w-4 h-4', disabled ? 'opacity-30' : 'fill-gray-300'].join(' ')} fill="currentColor">
      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
    </svg>
  )
}

function IconForward({ disabled }: { disabled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={['w-4 h-4', disabled ? 'opacity-30' : 'fill-gray-300'].join(' ')} fill="currentColor">
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
    </svg>
  )
}

function IconReload() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4 fill-gray-300" fill="currentColor">
      <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.389zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
    </svg>
  )
}

function IconStop() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4 fill-gray-300" fill="currentColor">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  )
}

export function BrowserChrome() {
  const activeTabId = useSiteStore(s => s.activeTabId)
  const nav = useSiteStore(s => s.tabs[activeTabId]?.nav)

  const [inputUrl, setInputUrl] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Sync display URL when nav.url changes (not while editing)
  useEffect(() => {
    if (!isEditing && nav?.url != null) {
      setInputUrl(nav.url)
    }
  }, [nav?.url, isEditing])

  // Animate loading progress bar
  useEffect(() => {
    if (nav?.loading) {
      setLoadProgress(5)
      progressTimerRef.current = setInterval(() => {
        setLoadProgress(p => {
          if (p >= 85) { clearInterval(progressTimerRef.current!); return p }
          return p + Math.random() * 8
        })
      }, 300)
    } else {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      setLoadProgress(100)
      const t = setTimeout(() => setLoadProgress(0), 300)
      return () => clearTimeout(t)
    }
    return () => { if (progressTimerRef.current) clearInterval(progressTimerRef.current) }
  }, [nav?.loading])

  function handleNavigate(e: React.FormEvent) {
    e.preventDefault()
    ipc.navigateTo(inputUrl)
    setIsEditing(false)
    inputRef.current?.blur()
  }

  const url = nav?.url ?? ''
  const isSecure = url.startsWith('https://')
  const displayUrl = isEditing ? inputUrl : (url ? getHostname(url) : '')

  return (
    <div
      className="h-11 bg-gray-950 border-b border-gray-800 flex items-center gap-1.5 px-2 shrink-0 relative"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Back */}
      <button
        onClick={() => ipc.navigateBack()}
        disabled={!nav?.canGoBack}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-800 disabled:cursor-not-allowed transition-colors"
        title="Back"
      >
        <IconBack disabled={!nav?.canGoBack} />
      </button>

      {/* Forward */}
      <button
        onClick={() => ipc.navigateForward()}
        disabled={!nav?.canGoForward}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-800 disabled:cursor-not-allowed transition-colors"
        title="Forward"
      >
        <IconForward disabled={!nav?.canGoForward} />
      </button>

      {/* Reload/Stop */}
      <button
        onClick={() => nav?.loading ? ipc.navigateTo(url) : ipc.navigateReload()}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-800 transition-colors"
        title={nav?.loading ? 'Stop' : 'Reload'}
      >
        {nav?.loading ? <IconStop /> : <IconReload />}
      </button>

      {/* URL bar */}
      <form onSubmit={handleNavigate} className="flex-1">
        <div className="flex items-center bg-gray-800 rounded-md border border-gray-700 focus-within:border-blue-500 px-2 h-8 gap-1.5 transition-colors">
          {/* HTTPS badge */}
          {url && (
            <span
              className={[
                'text-[10px] font-medium px-1 py-0.5 rounded shrink-0',
                isSecure
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-700 text-gray-500',
              ].join(' ')}
              title={isSecure ? 'Secure connection' : 'Not secure'}
            >
              {isSecure ? 'HTTPS' : 'HTTP'}
            </span>
          )}
          {/* Favicon (idle only) */}
          {nav?.favicon && !isEditing && (
            <img
              src={nav.favicon}
              className="w-4 h-4 shrink-0"
              alt=""
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <input
            ref={inputRef}
            value={displayUrl}
            onChange={e => setInputUrl(e.target.value)}
            onFocus={() => {
              setIsEditing(true)
              setInputUrl(url)
              setTimeout(() => inputRef.current?.select(), 0)
            }}
            onBlur={() => setIsEditing(false)}
            placeholder="Enter URL or search…"
            className="flex-1 bg-transparent text-gray-200 text-sm outline-none placeholder:text-gray-500 min-w-0"
            spellCheck={false}
          />
        </div>
      </form>

      {/* Loading progress bar — absolute at bottom of chrome */}
      {loadProgress > 0 && loadProgress < 100 && (
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-blue-500 transition-[width] duration-300 ease-out"
          style={{ width: loadProgress + '%' }}
        />
      )}
    </div>
  )
}
