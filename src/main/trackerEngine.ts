import { readFileSync } from 'fs'
import { join } from 'path'
import { parse } from 'tldts'

interface TrackerMeta { category: string; company: string }

// Actual format: categories[cat] is array of { CompanyName: { homeUrl: [domains] } }
interface DisconnectList {
  categories: Record<string, Array<Record<string, Record<string, string[]>>>>
}

let trackerMap: Map<string, TrackerMeta> | null = null

export function loadTrackerList(resourcesPath: string): void {
  const listPath = join(resourcesPath, 'trackers', 'disconnect-trackers.json')
  try {
    const raw = readFileSync(listPath, 'utf-8')
    const data = JSON.parse(raw) as DisconnectList
    trackerMap = new Map()
    for (const [category, companyList] of Object.entries(data.categories)) {
      for (const companyEntry of companyList) {
        for (const [company, urlMap] of Object.entries(companyEntry)) {
          for (const domains of Object.values(urlMap)) {
            for (const domain of domains) {
              trackerMap.set(domain.toLowerCase(), { category, company })
            }
          }
        }
      }
    }
    console.log('[TrackerEngine] Loaded ' + trackerMap.size + ' tracker domains')
  } catch (err) {
    console.error('[TrackerEngine] Failed to load tracker list:', err)
    trackerMap = new Map()
  }
}

export interface TrackerMatch { category: string; company: string; domain: string }

export function matchTracker(url: string): TrackerMatch | null {
  if (!trackerMap) return null
  try {
    const parsed = parse(url, { allowPrivateDomains: false })
    const domain = parsed.domain?.toLowerCase()
    const hostname = parsed.hostname?.toLowerCase()
    if (domain && trackerMap.has(domain)) {
      const meta = trackerMap.get(domain)!
      return { ...meta, domain }
    }
    if (hostname && trackerMap.has(hostname)) {
      const meta = trackerMap.get(hostname)!
      return { ...meta, domain: hostname }
    }
    return null
  } catch { return null }
}
