import { BrowserWindow, WebContentsView } from 'electron'
import { randomUUID } from 'crypto'

export interface TabMeta {
  id: string
  wcv: WebContentsView
  url: string
  title: string
  favicon: string
}

const tabs = new Map<string, TabMeta>()
let activeTabId = ''
const tabOrder: string[] = []

// webContents.id → tabId for routing network events
const wcIdToTabId = new Map<number, string>()

export function createTab(win: BrowserWindow): { tabId: string; wcv: WebContentsView } {
  const tabId = randomUUID()
  const wcv = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  })

  win.contentView.addChildView(wcv)
  // Start hidden — caller must call showTab() with correct bounds
  wcv.setBounds({ x: 0, y: 0, width: 0, height: 0 })

  const meta: TabMeta = { id: tabId, wcv, url: '', title: 'New Tab', favicon: '' }
  tabs.set(tabId, meta)
  tabOrder.push(tabId)
  wcIdToTabId.set(wcv.webContents.id, tabId)

  return { tabId, wcv }
}

export function showTab(tabId: string, bounds: Electron.Rectangle) {
  // Hide the currently active tab
  if (activeTabId && activeTabId !== tabId) {
    const cur = tabs.get(activeTabId)
    if (cur) cur.wcv.setBounds({ x: 0, y: 0, width: 0, height: 0 })
  }
  const tab = tabs.get(tabId)
  if (tab) {
    tab.wcv.setBounds(bounds)
    activeTabId = tabId
  }
}

export function resizeActiveTab(bounds: Electron.Rectangle) {
  const tab = tabs.get(activeTabId)
  if (tab) tab.wcv.setBounds(bounds)
}

export function closeTab(win: BrowserWindow, tabId: string): string | null {
  const tab = tabs.get(tabId)
  if (!tab) return null

  win.contentView.removeChildView(tab.wcv)
  wcIdToTabId.delete(tab.wcv.webContents.id)
  tabs.delete(tabId)
  const idx = tabOrder.indexOf(tabId)
  if (idx !== -1) tabOrder.splice(idx, 1)

  // If closing the active tab, switch to adjacent
  if (activeTabId === tabId) {
    activeTabId = ''
    if (tabOrder.length > 0) {
      const nextIdx = Math.min(idx, tabOrder.length - 1)
      return tabOrder[nextIdx]
    }
    return null
  }
  return activeTabId
}

export function getActiveTabId(): string { return activeTabId }
export function getActiveWcv(): WebContentsView | null {
  return tabs.get(activeTabId)?.wcv ?? null
}
export function getWcvByTabId(tabId: string): WebContentsView | null {
  return tabs.get(tabId)?.wcv ?? null
}
export function getTabIdByWcId(wcId: number): string {
  return wcIdToTabId.get(wcId) ?? activeTabId
}
export function getTabOrder(): string[] { return [...tabOrder] }
export function getTabMeta(tabId: string): TabMeta | undefined { return tabs.get(tabId) }

export function updateTabMeta(tabId: string, patch: Partial<Pick<TabMeta, 'url' | 'title' | 'favicon'>>) {
  const tab = tabs.get(tabId)
  if (tab) Object.assign(tab, patch)
}
