import { useSiteStore, type PanelTab } from '../../store/siteStore'
import { ipc } from '../../lib/ipc'
import { CookieInspector } from '../cookies/CookieInspector'
import { NetworkMonitor } from '../network/NetworkMonitor'
import { TrackerPanel } from '../trackers/TrackerPanel'
import { TechStack } from '../tech/TechStack'
import { AIPanel } from '../ai/AIPanel'
interface Tab { id: PanelTab; label: string; icon: string; getCount?: () => number }

export function SidePanel() {
  const activePanel = useSiteStore(s => s.activePanel)
  const isPanelCollapsed = useSiteStore(s => s.isPanelCollapsed)
  const panelWidth = useSiteStore(s => s.panelWidth)
  const setActivePanel = useSiteStore(s => s.setActivePanel)
  const togglePanel = useSiteStore(s => s.togglePanel)
  const activeTabId = useSiteStore(s => s.activeTabId)

  // Collapsed icon strip is 48px; expanded uses the stored panelWidth.
  // Always sync the effective width to the main process so WebContentsView resizes.
  const COLLAPSED_W = 48
  function collapse() { togglePanel(); ipc.setPanelWidth(COLLAPSED_W) }
  function expand()   { togglePanel(); ipc.setPanelWidth(panelWidth) }
  const cookieCount = useSiteStore(s => s.tabs[activeTabId]?.cookies.size ?? 0)
  const requestCount = useSiteStore(s => s.tabs[activeTabId]?.networkRequests.length ?? 0)
  const trackerCount = useSiteStore(s => s.tabs[activeTabId]?.trackers.size ?? 0)
  const techCount = useSiteStore(s => s.tabs[activeTabId]?.techStack.length ?? 0)

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
          onClick={expand}
          className="w-10 h-8 flex items-center justify-center rounded hover:bg-[var(--shell-hover-bg)] text-[var(--shell-text-muted)] text-sm"
          title="Expand panel"
        >
          ◀
        </button>
        {tabs.map(tab => {
          const count = tab.getCount?.() ?? 0
          return (
            <button
              key={tab.id}
              onClick={() => { setActivePanel(tab.id); expand() }}
              className="w-10 h-10 flex flex-col items-center justify-center rounded hover:bg-[var(--shell-hover-bg)] text-[var(--shell-text-muted)] relative"
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
      <div className="flex items-center border-b border-[var(--shell-border)] bg-[var(--shell-bg)] overflow-x-auto shrink-0">
        <button
          onClick={collapse}
          className="px-2 py-2 text-[var(--shell-text-muted)] hover:text-gray-300 shrink-0"
          title="Collapse panel"
        >
          ▶
        </button>
        {tabs.map(tab => {
          const count = tab.getCount?.() ?? 0
          const isActive = activePanel === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id)}
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
        {activePanel === 'cookies' && <CookieInspector />}
        {activePanel === 'network' && <NetworkMonitor />}
        {activePanel === 'trackers' && <TrackerPanel />}
        {activePanel === 'tech' && <TechStack />}
        {activePanel === 'ai' && <AIPanel />}
      </div>
    </div>
  )
}
