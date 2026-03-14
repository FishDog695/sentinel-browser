import type { TechDetection } from '../shared/ipcEvents'

interface TechPattern {
  name: string; category: string
  headers?: Record<string, string>
  html?: string; scripts?: string; js?: string[]
}

const P: TechPattern[] = [
  { name: 'nginx', category: 'Server', headers: { server: 'nginx' } },
  { name: 'Apache', category: 'Server', headers: { server: 'Apache' } },
  { name: 'Cloudflare', category: 'CDN', headers: { server: 'cloudflare' } },
  { name: 'AWS CloudFront', category: 'CDN', headers: { via: 'CloudFront' } },
  { name: 'Fastly', category: 'CDN', headers: { 'x-served-by': 'cache-' } },
  { name: 'Vercel', category: 'Hosting', headers: { 'x-vercel-id': '.' } },
  { name: 'Netlify', category: 'Hosting', headers: { 'x-nf-request-id': '.' } },
  { name: 'Next.js', category: 'Framework', js: ['__NEXT_DATA__', '__next'], html: '__next' },
  { name: 'Nuxt.js', category: 'Framework', js: ['__nuxt', '$nuxt'], html: '__nuxt' },
  { name: 'React', category: 'Library', js: ['React', '__REACT_DEVTOOLS_GLOBAL_HOOK__'] },
  { name: 'Vue.js', category: 'Library', js: ['Vue', '__vue_store__'] },
  { name: 'Angular', category: 'Framework', js: ['ng', 'getAllAngularRootElements'] },
  { name: 'Svelte', category: 'Framework', html: '__svelte' },
  { name: 'jQuery', category: 'Library', js: ['jQuery'] },
  { name: 'Gatsby', category: 'Framework', js: ['__gatsby'], html: 'gatsby' },
  { name: 'Ember.js', category: 'Framework', js: ['Ember'] },
  { name: 'WordPress', category: 'CMS', html: 'wp-content|wp-includes', scripts: 'wp-content' },
  { name: 'Drupal', category: 'CMS', html: 'Drupal.settings', js: ['Drupal'] },
  { name: 'Shopify', category: 'E-commerce', js: ['Shopify', '__st'], html: 'cdn.shopify' },
  { name: 'WooCommerce', category: 'E-commerce', js: ['woocommerce_params'] },
  { name: 'Magento', category: 'E-commerce', js: ['Mage', 'MAGE'] },
  { name: 'Squarespace', category: 'CMS', html: 'squarespace', js: ['Static'] },
  { name: 'Wix', category: 'CMS', html: 'wix.com', js: ['wixBiSession'] },
  { name: 'Webflow', category: 'CMS', js: ['Webflow'] },
  { name: 'Ghost', category: 'CMS', js: ['Ghost'] },
  { name: 'Google Analytics', category: 'Analytics', js: ['ga', 'gtag'], scripts: 'google-analytics.com' },
  { name: 'Google Tag Manager', category: 'Tag Manager', scripts: 'googletagmanager.com', js: ['google_tag_manager'] },
  { name: 'Segment', category: 'Analytics', js: ['analytics', 'AnalyticsNextWriteKey'] },
  { name: 'Mixpanel', category: 'Analytics', js: ['mixpanel'] },
  { name: 'Amplitude', category: 'Analytics', js: ['amplitude'] },
  { name: 'Hotjar', category: 'Analytics', js: ['hj', 'hjBootstrap'] },
  { name: 'Heap', category: 'Analytics', js: ['heap'] },
  { name: 'FullStory', category: 'Session Recording', js: ['FS', '_fs_debug'] },
  { name: 'Datadog RUM', category: 'Analytics', js: ['DD_RUM'] },
  { name: 'New Relic', category: 'Monitoring', js: ['newrelic', 'NREUM'] },
  { name: 'Meta Pixel', category: 'Advertising', js: ['fbq', '_fbq'] },
  { name: 'Google Ads', category: 'Advertising', scripts: 'googleadservices.com' },
  { name: 'LinkedIn Insight', category: 'Advertising', js: ['_linkedin_data_partner_id'] },
  { name: 'TikTok Pixel', category: 'Advertising', js: ['ttq'] },
  { name: 'Intercom', category: 'Support', js: ['Intercom', 'intercomSettings'] },
  { name: 'Zendesk', category: 'Support', js: ['zE', 'zEACLoaded'] },
  { name: 'HubSpot', category: 'CRM', js: ['HubSpotConversations', '_hsq'] },
  { name: 'Drift', category: 'Support', js: ['drift'] },
  { name: 'Salesforce', category: 'CRM', js: ['Sfdc', 'sforce'] },
  { name: 'Optimizely', category: 'A/B Testing', js: ['optimizely'] },
  { name: 'LaunchDarkly', category: 'Feature Flags', js: ['LDClient'] },
  { name: 'VWO', category: 'A/B Testing', js: ['VWO', '_vwo_code'] },
  { name: 'Webpack', category: 'Build Tool', js: ['webpackChunk', '__webpack_modules__'] },
  { name: 'Vite', category: 'Build Tool', scripts: '@vite' },
]

export function detectFromHeaders(headers: Record<string, string>): TechDetection[] {
  const results: TechDetection[] = []
  const norm: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) norm[k.toLowerCase()] = v.toLowerCase()
  for (const tech of P) {
    if (!tech.headers) continue
    for (const [hName, pat] of Object.entries(tech.headers)) {
      const val = norm[hName.toLowerCase()]
      if (val && new RegExp(pat, 'i').test(val)) {
        results.push({ name: tech.name, category: tech.category, confidence: 90 })
        break
      }
    }
  }
  const pb = norm['x-powered-by']
  if (pb) {
    const m = pb.match(/php\/([\d.]+)/i)
    if (m) results.push({ name: 'PHP', category: 'Language', version: m[1], confidence: 100 })
    if (/express/i.test(pb)) results.push({ name: 'Express.js', category: 'Framework', confidence: 95 })
    if (/asp\.net/i.test(pb)) results.push({ name: 'ASP.NET', category: 'Framework', confidence: 100 })
  }
  return dedup(results)
}

export function detectFromHtml(html: string, scriptUrls: string[]): TechDetection[] {
  const results: TechDetection[] = []
  const sj = scriptUrls.join('\n')
  for (const tech of P) {
    if (tech.html && new RegExp(tech.html, 'i').test(html))
      results.push({ name: tech.name, category: tech.category, confidence: 70 })
    if (tech.scripts && new RegExp(tech.scripts, 'i').test(sj))
      results.push({ name: tech.name, category: tech.category, confidence: 85 })
  }
  return dedup(results)
}

export function detectFromGlobals(globals: string[]): TechDetection[] {
  const results: TechDetection[] = []
  const gs = new Set(globals)
  for (const tech of P) {
    if (!tech.js) continue
    for (const g of tech.js) {
      if (gs.has(g)) { results.push({ name: tech.name, category: tech.category, confidence: 95 }); break }
    }
  }
  return dedup(results)
}

function dedup(d: TechDetection[]): TechDetection[] {
  const seen = new Map<string, TechDetection>()
  for (const x of d) {
    const e = seen.get(x.name)
    if (!e || x.confidence > e.confidence) seen.set(x.name, x)
  }
  return Array.from(seen.values())
}

export function mergeDetections(all: TechDetection[]): TechDetection[] {
  return dedup(all).sort((a, b) => b.confidence - a.confidence)
}
