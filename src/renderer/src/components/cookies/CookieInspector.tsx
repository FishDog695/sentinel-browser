import { useState, useMemo } from 'react'
import { useSiteStore } from '../../store/siteStore'
import type { CookieEvent } from '../../../../../shared/ipcEvents'

const EMPTY_MAP = new Map<string, CookieEvent>()

export function CookieInspector() {
  const activeTabId = useSiteStore(s => s.activeTabId)
  const cookiesMap = useSiteStore(s => s.tabs[activeTabId]?.cookies ?? EMPTY_MAP)
  const cookies = useMemo(() => Array.from(cookiesMap.values()), [cookiesMap])
  const [filter, setFilter] = useState<'all' | 'first' | 'third'>('all')
  const [selected, setSelected] = useState<CookieEvent | null>(null)

  const filtered = cookies.filter(c => {
    if (filter === 'first') return c.firstParty
    if (filter === 'third') return !c.firstParty
    return true
  })

  const firstCount = cookies.filter(c => c.firstParty).length
  const thirdCount = cookies.filter(c => !c.firstParty).length

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex gap-1 p-2 border-b border-gray-800 shrink-0">
        {([['all', 'All', cookies.length], ['first', '1st Party', firstCount], ['third', '3rd Party', thirdCount]] as const).map(([f, label, count]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={['text-xs px-2 py-1 rounded transition-colors', filter === f ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800'].join(' ')}
          >
            {label} <span className="text-gray-500">({count})</span>
          </button>
        ))}
      </div>

      {cookies.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">No cookies yet</div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {filtered.map(cookie => (
              <button
                key={cookie.id}
                onClick={() => setSelected(selected?.id === cookie.id ? null : cookie)}
                className={['w-full text-left px-3 py-2 border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors', selected?.id === cookie.id ? 'bg-gray-800' : ''].join(' ')}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={['sentinel-badge shrink-0', cookie.firstParty ? 'badge-first-party' : 'badge-third-party'].join(' ')}>
                    {cookie.firstParty ? '1st' : '3rd'}
                  </span>
                  <span className="text-sm text-gray-200 truncate font-medium">{cookie.name}</span>
                  <span className="text-xs text-gray-500 truncate ml-auto shrink-0">{cookie.domain}</span>
                </div>
                <div className="flex gap-1 mt-0.5 ml-8">
                  {cookie.httpOnly && <span className="sentinel-badge bg-gray-700 text-gray-400">HttpOnly</span>}
                  {cookie.secure && <span className="sentinel-badge bg-gray-700 text-gray-400">Secure</span>}
                  {cookie.sameSite && cookie.sameSite !== 'no_restriction' && (
                    <span className="sentinel-badge bg-gray-700 text-gray-400">SS:{cookie.sameSite}</span>
                  )}
                  {cookie.session && <span className="sentinel-badge bg-gray-700 text-gray-400">Session</span>}
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="border-t border-gray-700 bg-gray-900 p-3 shrink-0 max-h-48 overflow-y-auto">
              <div className="text-xs font-medium text-gray-300 mb-2">{selected.name}</div>
              <div className="space-y-1 text-xs">
                <Row label="Domain" value={selected.domain} />
                <Row label="Path" value={selected.path} />
                <Row label="Value" value={selected.value.slice(0, 80) + (selected.value.length > 80 ? '...' : '')} mono />
                <Row label="Size" value={selected.size + ' bytes'} />
                <Row label="Expires" value={selected.session ? 'Session' : selected.expirationDate ? new Date(selected.expirationDate * 1000).toLocaleString() : 'Unknown'} />
                <Row label="SameSite" value={selected.sameSite ?? 'Not set'} />
                <Row label="HttpOnly" value={selected.httpOnly ? 'Yes — not accessible via JavaScript' : 'No'} />
                <Row label="Secure" value={selected.secure ? 'Yes — HTTPS only' : 'No'} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 w-16 shrink-0">{label}</span>
      <span className={['text-gray-300 break-all', mono ? 'font-mono' : ''].join(' ')}>{value}</span>
    </div>
  )
}
