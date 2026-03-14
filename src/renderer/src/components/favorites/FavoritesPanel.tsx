import { useMemo } from 'react'
import { useSiteStore } from '../../store/siteStore'
import { ipc } from '../../lib/ipc'

function getHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

export function FavoritesPanel() {
  const favorites = useSiteStore(s => s.favorites)

  // Show newest first
  const sorted = useMemo(
    () => [...favorites].sort((a, b) => b.addedAt - a.addedAt),
    [favorites]
  )

  async function handleRemove(e: React.MouseEvent, url: string) {
    e.stopPropagation()
    const newFavs = await ipc.removeFavorite(url)
    useSiteStore.getState().setFavorites(newFavs)
  }

  function handleNavigate(url: string) {
    ipc.navigateTo(url)
  }

  return (
    <div className="flex flex-col h-full">
      {sorted.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
          <span className="text-3xl">⭐</span>
          <p className="text-gray-400 text-sm font-medium">No favorites yet</p>
          <p className="text-gray-600 text-xs leading-relaxed">
            Navigate to any page and click the star icon in the toolbar to save it here.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {sorted.map(fav => (
            <button
              key={fav.url}
              onClick={() => handleNavigate(fav.url)}
              className="w-full text-left flex items-center gap-2 px-3 py-2.5 border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors group"
              title={fav.url}
            >
              {/* Favicon */}
              {fav.favicon ? (
                <img
                  src={fav.favicon}
                  className="w-4 h-4 shrink-0"
                  alt=""
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <span className="w-4 h-4 shrink-0 flex items-center justify-center text-gray-600">
                  <svg viewBox="0 0 16 16" className="w-3 h-3" stroke="currentColor" strokeWidth="1.5" fill="none">
                    <circle cx="8" cy="8" r="6" />
                  </svg>
                </span>
              )}

              {/* Title + domain */}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 truncate">{fav.title || getHostname(fav.url)}</div>
                <div className="text-xs text-gray-500 truncate">{getHostname(fav.url)}</div>
              </div>

              {/* Remove button */}
              <span
                role="button"
                onClick={(e) => handleRemove(e, fav.url)}
                className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-opacity shrink-0"
                title="Remove from favorites"
              >
                <svg viewBox="0 0 10 10" className="w-2 h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" />
                </svg>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
