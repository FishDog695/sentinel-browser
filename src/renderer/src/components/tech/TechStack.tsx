import { useSiteStore } from '../../store/siteStore'

const CATEGORY_ICONS: Record<string, string> = {
  Server: '🖥',
  CDN: '🌐',
  Hosting: '☁',
  Framework: '⚛',
  Library: '📦',
  CMS: '📝',
  'E-commerce': '🛒',
  Analytics: '📊',
  'Tag Manager': '🏷',
  Advertising: '📢',
  Support: '💬',
  CRM: '👥',
  'Session Recording': '🎥',
  Monitoring: '🔍',
  'A/B Testing': '🧪',
  'Feature Flags': '🚩',
  'Build Tool': '🔧',
  Language: '💻',
}

export function TechStack() {
  const activeTabId = useSiteStore(s => s.activeTabId)
  const tech = useSiteStore(s => s.tabs[activeTabId]?.techStack ?? [])

  if (tech.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        Navigating to a page will reveal its technology stack
      </div>
    )
  }

  const byCategory = tech.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {} as Record<string, typeof tech>)

  return (
    <div className="h-full overflow-y-auto p-3 space-y-4">
      {Object.entries(byCategory).map(([category, items]) => (
        <section key={category}>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <span>{CATEGORY_ICONS[category] ?? '🔧'}</span>
            <span>{category}</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {items.map(t => (
              <div
                key={t.name}
                className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-md px-2 py-1"
                title={t.confidence + '% confidence'}
              >
                <span className="text-xs font-medium text-gray-200">{t.name}</span>
                {t.version && (
                  <span className="text-xs text-gray-500">{t.version}</span>
                )}
                <span className={['w-1.5 h-1.5 rounded-full shrink-0', t.confidence >= 90 ? 'bg-green-400' : t.confidence >= 70 ? 'bg-yellow-400' : 'bg-gray-500'].join(' ')} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
