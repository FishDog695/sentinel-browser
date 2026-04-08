import { useState, useEffect } from 'react'
import { useSiteStore } from '../../store/siteStore'
import { ipc } from '../../lib/ipc'

export function TabBar() {
  const tabOrder = useSiteStore(s => s.tabOrder)
  const tabs = useSiteStore(s => s.tabs)
  const activeTabId = useSiteStore(s => s.activeTabId)

  const [isMaximized, setIsMaximized] = useState(false)
  const isMac = ipc.platform() === 'darwin'
  const isWin = !isMac

  useEffect(() => {
    ipc.isMaximized().then(setIsMaximized)
    const IPC = ipc.IPC()
    const unsub = ipc.on(IPC.WIN_MAXIMIZED, (data) => setIsMaximized(data as boolean))
    return unsub
  }, [])

  async function handleNewTab() {
    // TAB_CREATED event (with isActive:true) will update the store
    await ipc.createTab()
  }

  async function handleSwitchTab(tabId: string) {
    if (tabId === activeTabId) return
    // Update renderer state immediately for snappy UI
    useSiteStore.getState().setActiveTabId(tabId)
    // Tell main process to show the new tab's WebContentsView
    await ipc.switchTab(tabId)
  }

  async function handleCloseTab(e: React.MouseEvent, tabId: string) {
    e.stopPropagation()
    await ipc.closeTab(tabId)
    // TAB_CLOSED event will update the store
  }

  return (
    <div
      className="h-10 [background-color:var(--shell-bg)] border-b border-[var(--shell-border)] flex items-stretch shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Tab pills — on macOS leave room for the native traffic-light buttons (~78px) */}
      <div
        className="flex items-end overflow-x-auto min-w-0 px-1"
        style={{ WebkitAppRegion: 'no-drag', paddingLeft: isMac ? '82px' : '4px' } as React.CSSProperties}
      >
        {tabOrder.map(tabId => {
          const tab = tabs[tabId]
          if (!tab) return null
          const isActive = tabId === activeTabId
          const title = tab.nav.title || 'New Tab'
          const favicon = tab.nav.favicon

          return (
            <button
              key={tabId}
              onClick={() => handleSwitchTab(tabId)}
              className={[
                'flex items-center gap-1.5 px-3 min-w-[80px] max-w-[160px] mx-0.5 rounded-t-md',
                'text-xs truncate transition-colors group relative shrink-0',
                isActive
                  ? 'h-9 [background-color:var(--shell-tab-active-bg)] [color:var(--shell-tab-active-text)] border-t-2 border-t-[var(--shell-tab-active-border)]'
                  : 'h-7 [background-color:var(--shell-tab-inactive-bg)] [color:var(--shell-text-muted)] hover:[background-color:var(--shell-hover-bg)] hover:text-gray-300 border-t-2 border-t-transparent',
              ].join(' ')}
              title={title}
            >
              {/* Favicon */}
              {favicon ? (
                <img
                  src={favicon}
                  className="w-3.5 h-3.5 shrink-0"
                  alt=""
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 16 16" className="w-3 h-3" stroke="currentColor" strokeWidth="1.5" fill="none">
                    <circle cx="8" cy="8" r="6" />
                  </svg>
                </span>
              )}

              <span className="truncate flex-1 text-left">{title}</span>

              {/* Loading dot */}
              {tab.nav.loading && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
              )}

              {/* Close button */}
              <span
                role="button"
                onClick={(e) => handleCloseTab(e, tabId)}
                className={[
                  'w-4 h-4 flex items-center justify-center rounded shrink-0 transition-opacity',
                  'opacity-0 group-hover:opacity-100 hover:[background-color:var(--shell-hover-bg)]',
                  isActive ? 'opacity-40' : '',
                ].join(' ')}
              >
                <svg viewBox="0 0 10 10" className="w-2 h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" />
                </svg>
              </span>
            </button>
          )
        })}

        {/* New tab button */}
        <button
          onClick={handleNewTab}
          className="flex items-center justify-center w-8 h-7 self-center shrink-0 rounded [color:var(--shell-text-muted)] hover:text-gray-300 hover:[background-color:var(--shell-hover-bg)] transition-colors"
          title="New tab"
        >
          <svg viewBox="0 0 12 12" className="w-3 h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none">
            <path d="M6 1v10M1 6h10" />
          </svg>
        </button>
      </div>

      {/* Spacer / drag region */}
      <div className="flex-1" />

      {/* Window controls — Windows/Linux only */}
      {isWin && (
        <div
          className="flex items-stretch"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={() => ipc.minimizeWindow()}
            className="w-11 flex items-center justify-center text-gray-400 hover:[background-color:var(--shell-hover-bg)] hover:text-gray-100 transition-colors"
            title="Minimize"
          >
            <svg viewBox="0 0 10 1" className="w-2.5" fill="currentColor">
              <rect width="10" height="1.5" y="0" />
            </svg>
          </button>
          <button
            onClick={() => ipc.maximizeWindow()}
            className="w-11 flex items-center justify-center text-gray-400 hover:[background-color:var(--shell-hover-bg)] hover:text-gray-100 transition-colors"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="2.5" y="0" width="7.5" height="7.5" />
                <path d="M0 2.5h7.5v7.5H0z" />
              </svg>
            ) : (
              <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="0.5" y="0.5" width="9" height="9" />
              </svg>
            )}
          </button>
          <button
            onClick={() => ipc.closeWindow()}
            className="w-11 flex items-center justify-center text-gray-400 hover:bg-red-600 hover:text-white transition-colors"
            title="Close"
          >
            <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none">
              <path d="M1 1l8 8M9 1L1 9" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
