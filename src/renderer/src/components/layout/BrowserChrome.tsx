import { useState, useRef, useEffect, useCallback } from 'react'
import { useSiteStore } from '../../store/siteStore'
import { ipc } from '../../lib/ipc'
import type { Favorite, HistoryEntry } from '../../store/siteStore'

// Height to push WebContentsView down when a toolbar dropdown is open.
// Covers the tallest possible dropdown (max-h-80 = 320px + button + spacing).
const DROPDOWN_OVERLAY_PX = 340

function getHostname(url: string): string {
  try {
    return new URL(url).hostname || url
  } catch {
    return url
  }
}

// ─── SVG icons ───────────────────────────────────────────────────────────────

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

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={['w-3.5 h-3.5 transition-colors', filled ? 'fill-yellow-400' : 'fill-none'].join(' ')}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="1.5"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  )
}

// ─── Favs dropdown ───────────────────────────────────────────────────────────

function FavsDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const favorites = useSiteStore(s => s.favorites)

  const toggle = useCallback((next: boolean) => {
    setOpen(next)
    ipc.setToolbarOverlay(next ? DROPDOWN_OVERLAY_PX : 0)
  }, [])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) toggle(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, toggle])

  // Clear overlay on unmount
  useEffect(() => () => { ipc.setToolbarOverlay(0) }, [])

  async function handleRemove(e: React.MouseEvent, url: string) {
    e.stopPropagation()
    const updated = await ipc.removeFavorite(url)
    useSiteStore.getState().setFavorites(updated)
  }

  function handleNavigate(url: string) {
    ipc.navigateTo(url)
    toggle(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => toggle(!open)}
        className={[
          'flex items-center gap-1 px-2 h-7 rounded text-xs font-medium transition-colors',
          open
            ? 'bg-gray-700 text-gray-200'
            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200',
        ].join(' ')}
        title="Favorites"
      >
        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <span>Favs</span>
        <svg viewBox="0 0 20 20" className="w-3 h-3 fill-current opacity-60" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {favorites.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">No favorites yet.<br />Click the ★ in the URL bar to add one.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {favorites.slice().reverse().map((fav: Favorite) => (
                <div
                  key={fav.url}
                  onClick={() => handleNavigate(fav.url)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 cursor-pointer group"
                >
                  {fav.favicon ? (
                    <img src={fav.favicon} className="w-4 h-4 shrink-0" alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <div className="w-4 h-4 shrink-0 rounded-sm bg-gray-700" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200 truncate">{fav.title || fav.url}</div>
                    <div className="text-xs text-gray-500 truncate">{getHostname(fav.url)}</div>
                  </div>
                  <button
                    onClick={(e) => handleRemove(e, fav.url)}
                    className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-gray-500 hover:text-red-400 transition-opacity text-xs shrink-0"
                    title="Remove"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── History dropdown ─────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function HistoryDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const history = useSiteStore(s => s.history)

  const toggle = useCallback((next: boolean) => {
    setOpen(next)
    ipc.setToolbarOverlay(next ? DROPDOWN_OVERLAY_PX : 0)
  }, [])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) toggle(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, toggle])

  // Clear overlay on unmount
  useEffect(() => () => { ipc.setToolbarOverlay(0) }, [])

  async function handleClear() {
    const updated = await ipc.clearHistory()
    useSiteStore.getState().setHistory(updated)
  }

  function handleNavigate(url: string) {
    ipc.navigateTo(url)
    toggle(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => toggle(!open)}
        className={[
          'flex items-center gap-1 px-2 h-7 rounded text-xs font-medium transition-colors',
          open
            ? 'bg-gray-700 text-gray-200'
            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200',
        ].join(' ')}
        title="History"
      >
        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
        </svg>
        <span>History</span>
        <svg viewBox="0 0 20 20" className="w-3 h-3 fill-current opacity-60" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {history.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">No browsing history yet.</div>
          ) : (
            <>
              <div className="max-h-80 overflow-y-auto">
                {history.map((entry: HistoryEntry) => (
                  <div
                    key={entry.url + entry.visitedAt}
                    onClick={() => handleNavigate(entry.url)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 cursor-pointer"
                  >
                    {entry.favicon ? (
                      <img src={entry.favicon} className="w-4 h-4 shrink-0" alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    ) : (
                      <div className="w-4 h-4 shrink-0 rounded-sm bg-gray-700" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-200 truncate">{entry.title || entry.url}</div>
                      <div className="text-xs text-gray-500 truncate">{getHostname(entry.url)}</div>
                    </div>
                    <span className="text-xs text-gray-600 shrink-0 ml-1">{formatTime(entry.visitedAt)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-700 px-3 py-2">
                <button
                  onClick={handleClear}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear history
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main BrowserChrome ───────────────────────────────────────────────────────

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

  const favorites = useSiteStore(s => s.favorites)
  const isFavorited = !!url && favorites.some(f => f.url === url)

  async function handleToggleFavorite(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!url) return
    const fav: Favorite = { url, title: nav?.title ?? url, favicon: nav?.favicon || undefined, addedAt: Date.now() }
    const newFavs = isFavorited ? await ipc.removeFavorite(url) : await ipc.addFavorite(fav)
    useSiteStore.getState().setFavorites(newFavs)
  }

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

      {/* URL bar with star inside */}
      <form onSubmit={handleNavigate} className="flex-1 max-w-[560px]">
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
          {/* Star button inside URL bar */}
          {url && (
            <button
              type="button"
              onClick={handleToggleFavorite}
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-600 transition-colors"
              title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              <StarIcon filled={isFavorited} />
            </button>
          )}
        </div>
      </form>

      {/* Favs dropdown */}
      <FavsDropdown />

      {/* History dropdown */}
      <HistoryDropdown />

      {/* Sentinel Browser branding */}
      <div className="flex items-center gap-1.5 shrink-0 ml-auto select-none">
        <svg viewBox="0 0 20 20" className="w-4 h-4 fill-blue-400 shrink-0" fill="currentColor">
          <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 01.678 0 11.947 11.947 0 007.078 2.749.5.5 0 01.479.425c.069.52.104 1.05.104 1.589 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 01-.332 0C5.26 16.563 2 12.162 2 7c0-.539.035-1.069.104-1.589a.5.5 0 01.48-.425 11.947 11.947 0 007.077-2.749z" clipRule="evenodd" />
        </svg>
        <span className="text-xs font-semibold text-gray-400 whitespace-nowrap tracking-wide">Sentinel Browser</span>
      </div>

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
