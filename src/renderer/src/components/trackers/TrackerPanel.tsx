import { useMemo } from 'react'
import { useSiteStore } from '../../store/siteStore'

const CATEGORY_COLORS: Record<string, string> = {
  Advertising: 'text-red-400',
  Analytics: 'text-yellow-400',
  Social: 'text-blue-400',
  Fingerprinting: 'text-purple-400',
  Cryptomining: 'text-orange-400',
}

const FP_LABELS: Record<string, string> = {
  canvas: 'Canvas fingerprinting',
  webgl: 'WebGL fingerprinting',
  audio: 'Audio fingerprinting',
  font: 'Font enumeration',
  battery: 'Battery status API',
}

export function TrackerPanel() {
  const trackersMap = useSiteStore(s => s.trackers)
  const trackers = useMemo(() => Array.from(trackersMap.values()), [trackersMap])
  const fps = useSiteStore(s => s.fingerprintAttempts)

  // Group trackers by category
  const byCategory = trackers.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {} as Record<string, typeof trackers>)

  // Deduplicate fingerprint types
  const fpTypes = [...new Set(fps.map(f => f.type))]

  const empty = trackers.length === 0 && fps.length === 0

  return (
    <div className="h-full overflow-y-auto p-3 space-y-4">
      {empty && (
        <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
          No trackers detected
        </div>
      )}

      {/* Fingerprinting section */}
      {fpTypes.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-wide mb-2">
            Fingerprinting ({fpTypes.length})
          </h3>
          <div className="space-y-1">
            {fpTypes.map(type => (
              <div key={type} className="flex items-center gap-2 px-2 py-1.5 rounded bg-purple-500/10 border border-purple-500/20">
                <span className="text-purple-400">⚠</span>
                <div>
                  <div className="text-xs font-medium text-gray-200">{FP_LABELS[type] ?? type}</div>
                  <div className="text-xs text-gray-500">Detected {fps.filter(f => f.type === type).length}x</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tracker categories */}
      {Object.entries(byCategory).map(([category, items]) => (
        <section key={category}>
          <h3 className={['text-xs font-semibold uppercase tracking-wide mb-2', CATEGORY_COLORS[category] ?? 'text-gray-400'].join(' ')}>
            {category} ({items.length})
          </h3>
          <div className="space-y-1">
            {items.map(tracker => (
              <div key={tracker.domain} className="px-2 py-1.5 rounded bg-gray-800/50 border border-gray-700/50">
                <div className="text-xs font-medium text-gray-200">{tracker.name}</div>
                <div className="text-xs text-gray-500 font-mono">{tracker.domain}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
