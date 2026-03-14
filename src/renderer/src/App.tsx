import { useIpcEvents } from './hooks/useIpcEvents'
import { BrowserChrome } from './components/layout/BrowserChrome'
import { SidePanel } from './components/layout/SidePanel'
import { useSiteStore } from './store/siteStore'

export default function App() {
  useIpcEvents()
  const isPanelCollapsed = useSiteStore(s => s.isPanelCollapsed)
  const panelWidth = useSiteStore(s => s.panelWidth)

  const effectivePanelWidth = isPanelCollapsed ? 48 : panelWidth

  return (
    <div className="flex flex-col h-screen bg-gray-950 select-none overflow-hidden">
      {/* Custom title bar drag region */}
      <div
        className="h-8 bg-gray-950 flex items-center px-4 shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-xs text-gray-600 font-medium ml-16">Sentinel</span>
      </div>

      {/* Browser chrome (address bar) */}
      <BrowserChrome />

      {/* Main area: WebContentsView placeholder + side panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* The WebContentsView is positioned absolutely by the main process.
            This div is just a visual placeholder to reserve the space. */}
        <div className="flex-1 bg-transparent" />

        {/* Side panel */}
        <div
          className="flex flex-col border-l border-gray-800 bg-gray-900 shrink-0 transition-[width] duration-200 overflow-hidden"
          style={{ width: effectivePanelWidth }}
        >
          <SidePanel />
        </div>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  )
}

function StatusBar() {
  const loading = useSiteStore(s => s.nav.loading)
  const trackerCount = useSiteStore(s => s.trackers.size)
  const requestCount = useSiteStore(s => s.networkRequests.length)

  return (
    <div className="h-5 bg-gray-950 border-t border-gray-800 flex items-center px-3 gap-4 text-xs text-gray-500 shrink-0">
      {loading && (
        <span className="flex items-center gap-1">
          <span className="animate-spin">⟳</span> Loading...
        </span>
      )}
      {trackerCount > 0 && (
        <span className="text-orange-400">{trackerCount} tracker{trackerCount !== 1 ? 's' : ''}</span>
      )}
      <span className="ml-auto">{requestCount} requests</span>
    </div>
  )
}
