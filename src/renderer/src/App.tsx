import { useEffect } from 'react'
import { useIpcEvents } from './hooks/useIpcEvents'
import { BrowserChrome } from './components/layout/BrowserChrome'
import { SidePanel } from './components/layout/SidePanel'
import { TabBar } from './components/layout/TabBar'
import { useSiteStore } from './store/siteStore'
import { ipc } from './lib/ipc'

export default function App() {
  useIpcEvents()

  // Load persisted favorites and history from disk on startup
  useEffect(() => {
    ipc.getFavorites().then(favs => useSiteStore.getState().setFavorites(favs))
    ipc.getHistory().then(entries => useSiteStore.getState().setHistory(entries))
  }, [])
  const isPanelCollapsed = useSiteStore(s => s.isPanelCollapsed)
  const panelWidth = useSiteStore(s => s.panelWidth)
  const effectivePanelWidth = isPanelCollapsed ? 48 : panelWidth

  return (
    <div className="flex flex-col h-screen bg-gray-950 select-none overflow-hidden">
      {/* Tab bar (40px) — includes drag region + window controls */}
      <TabBar />

      {/* Browser chrome — address bar (44px) */}
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
  const activeTabId = useSiteStore(s => s.activeTabId)
  const loading = useSiteStore(s => s.tabs[activeTabId]?.nav.loading ?? false)
  const trackerCount = useSiteStore(s => s.tabs[activeTabId]?.trackers.size ?? 0)
  const requestCount = useSiteStore(s => s.tabs[activeTabId]?.networkRequests.length ?? 0)
  const blockedCount = useSiteStore(s => s.tabs[activeTabId]?.blockedCount ?? 0)
  const mode = useSiteStore(s => s.mode)

  return (
    <div className="h-5 bg-gray-950 border-t border-gray-800 flex items-center px-3 gap-4 text-xs text-gray-500 shrink-0">
      {loading && (
        <span className="flex items-center gap-1">
          <span className="animate-spin inline-block">↻</span> Loading…
        </span>
      )}
      {mode === 'lockdown' && (
        <span className="text-green-400 flex items-center gap-1">
          🛡 Lockdown{blockedCount > 0 ? ` · ${blockedCount} blocked` : ''}
        </span>
      )}
      {trackerCount > 0 && mode !== 'lockdown' && (
        <span className="text-orange-400">{trackerCount} tracker{trackerCount !== 1 ? 's' : ''}</span>
      )}
      <span className="ml-auto">{requestCount} requests</span>
    </div>
  )
}
