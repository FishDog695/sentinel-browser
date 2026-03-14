import { useSiteStore, type PanelTab } from '../../store/siteStore'
import { ipc } from '../../lib/ipc'
import { CookieInspector } from '../cookies/CookieInspector'
import { NetworkMonitor } from '../network/NetworkMonitor'
import { TrackerPanel } from '../trackers/TrackerPanel'
import { TechStack } from '../tech/TechStack'
import { AIPanel } from '../ai/AIPanel'

interface Tab { id: PanelTab; label: string; icon: string; getCount?: () => number }

export function SidePanel() {
  const activeTab = useSiteStore(s => s.activeTab)
  const isPanelCollapsed = useSiteStore(s => s.isPanelCollapsed)
  const setActiveTab = useSiteStore(s => s.setActiveTab)
  const togglePanel = useSiteStore(s => s.togglePanel)
  const cookieCount = useSiteStore(s => s.cookies.size)
  const requestCount = useSiteStore(s => s.networkRequests.length)
  const trackerCount = useSiteStore(s => s.trackers.size)
  const techCount = useSiteStore(s => s.techStack.length)

  const tabs: Tab[] = [
    { id: 'cookies', icon: '🍪', label: 'Cookies', getCount: () => cookieCount },
    { id: 'network', icon: '📡', label: 'Network', getCount: () => requestCount },
    { id: 'trackers', icon: '🛡', label: 'Trackers', getCount: () => trackerCount },
    { id: 'tech', icon: '⚙', label: 'Tech', getCount: () => techCount },
    { id: 'ai', icon: '🤖', label: 'AI', getCount: () => 0 },
  ]

  if (isPanelCollapsed) {
    return (
      <div className="flex flex-col items-center py-2 gap-1 w-full">
        <button
          onClick={() => { togglePanel(); ipc.setPanelWidth(360) }}
          className="w-10 h-8 flex items-center justify-center rounded hover:bg-gray-800 text-gray-400 text-sm"
          title="Expand panel"
        >
          ◀
        </button>
        {tabs.map(tab => {
          const count = tab.getCount?.() ?? 0
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); togglePanel() }}
              className="w-10 h-10 flex flex-col items-center justify-center rounded hover:bg-gray-800 text-gray-400 relative"
              title={tab.label}
            >
              <span className="text-base">{tab.icon}</span>
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-blue-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-gray-800 bg-gray-950 overflow-x-auto shrink-0">
        <button
          onClick={togglePanel}
          className="px-2 py-2 text-gray-500 hover:text-gray-300 shrink-0"
          title="Collapse panel"
        >
          ▶
        </button>
        {tabs.map(tab => {
          const count = tab.getCount?.() ?? 0
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={['panel-tab', isActive ? 'panel-tab-active' : ''].join(' ')}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {count > 0 && (
                <span className={[
                  'sentinel-badge text-[10px] px-1 py-0',
                  tab.id === 'trackers' ? 'badge-tracker' : 'bg-gray-700 text-gray-300'
                ].join(' ')}>
                  {count > 999 ? '999+' : count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'cookies' && <CookieInspector />}
        {activeTab === 'network' && <NetworkMonitor />}
        {activeTab === 'trackers' && <TrackerPanel />}
        {activeTab === 'tech' && <TechStack />}
        {activeTab === 'ai' && <AIPanel />}
      </div>
    </div>
  )
}
