import { useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useSiteStore } from '../../store/siteStore'
import type { NetworkRequest } from '../../../../../shared/ipcEvents'

type Filter = 'all' | 'third' | 'xhr' | 'script' | 'image'

const RESOURCE_COLORS: Record<string, string> = {
  xhr: 'text-blue-400',
  fetch: 'text-blue-400',
  script: 'text-yellow-400',
  stylesheet: 'text-purple-400',
  image: 'text-green-400',
  media: 'text-pink-400',
  font: 'text-orange-400',
  document: 'text-gray-300',
}

export function NetworkMonitor() {
  const requests = useSiteStore(s => s.networkRequests)
  const responses = useSiteStore(s => s.networkResponses)
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<NetworkRequest | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)

  const filtered = requests.filter(r => {
    if (filter === 'third') return !r.firstParty
    if (filter === 'xhr') return r.resourceType === 'xhr' || r.resourceType === 'fetch'
    if (filter === 'script') return r.resourceType === 'script'
    if (filter === 'image') return r.resourceType === 'image'
    return true
  })

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  })

  const selectedResponse = selected ? responses.get(selected.id) : null

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex gap-1 p-2 border-b border-gray-800 shrink-0 overflow-x-auto">
        {(['all', 'third', 'xhr', 'script', 'image'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={['text-xs px-2 py-1 rounded whitespace-nowrap transition-colors', filter === f ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800'].join(' ')}
          >
            {f === 'all' ? 'All (' + requests.length + ')' :
             f === 'third' ? '3rd Party' :
             f === 'xhr' ? 'XHR/Fetch' :
             f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">No requests</div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div ref={parentRef} className="flex-1 overflow-y-auto">
            <div style={{ height: virtualizer.getTotalSize() + 'px', position: 'relative' }}>
              {virtualizer.getVirtualItems().map(virtualItem => {
                const req = filtered[virtualItem.index]
                const resp = responses.get(req.id)
                return (
                  <div
                    key={req.id}
                    style={{ position: 'absolute', top: virtualItem.start + 'px', width: '100%', height: '36px' }}
                    onClick={() => setSelected(selected?.id === req.id ? null : req)}
                    className={['flex items-center gap-2 px-3 py-1 border-b border-gray-800/50 cursor-pointer hover:bg-gray-800/50', selected?.id === req.id ? 'bg-gray-800' : '', req.trackerMatch ? 'border-l-2 border-orange-500' : ''].join(' ')}
                  >
                    <span className={['text-xs font-mono w-8 shrink-0', resp ? (resp.statusCode >= 400 ? 'text-red-400' : 'text-green-400') : 'text-gray-500'].join(' ')}>
                      {resp?.statusCode ?? '...'}
                    </span>
                    <span className={['text-xs w-12 shrink-0', RESOURCE_COLORS[req.resourceType] ?? 'text-gray-400'].join(' ')}>
                      {req.resourceType.slice(0, 6)}
                    </span>
                    <span className="text-xs text-gray-300 truncate flex-1 font-mono">
                      {req.url.replace(/^https?:\/\//, '')}
                    </span>
                    {req.trackerMatch && (
                      <span className="sentinel-badge badge-tracker shrink-0 text-[10px]">tracker</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Request detail */}
          {selected && (
            <div className="border-t border-gray-700 bg-gray-900 p-3 shrink-0 max-h-48 overflow-y-auto text-xs space-y-1">
              <div className="font-medium text-gray-300 break-all font-mono">{selected.url}</div>
              <div className="flex gap-4 text-gray-400">
                <span>Method: <span className="text-blue-400">{selected.method}</span></span>
                <span>Type: <span className="text-yellow-400">{selected.resourceType}</span></span>
                {selectedResponse && <span>Status: <span className={selectedResponse.statusCode >= 400 ? 'text-red-400' : 'text-green-400'}>{selectedResponse.statusCode}</span></span>}
                {selectedResponse?.timing && <span>Time: <span className="text-gray-300">{selectedResponse.timing}ms</span></span>}
              </div>
              {selected.trackerMatch && (
                <div className="text-orange-400">⚠ Tracker: {selected.trackerMatch} ({selected.trackerCategory})</div>
              )}
              {selectedResponse?.headers && (
                <div>
                  <div className="text-gray-500 mb-1">Response Headers:</div>
                  {Object.entries(selectedResponse.headers).slice(0, 10).map(([k, v]) => (
                    <div key={k} className="flex gap-2 font-mono">
                      <span className="text-gray-500 shrink-0">{k}:</span>
                      <span className="text-gray-300 truncate">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
