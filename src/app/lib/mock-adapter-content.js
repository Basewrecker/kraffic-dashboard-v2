// Mock stand-in for the app's lib/mock-adapter-content.ts (synced 2026-11-15). In the app this one module holds
// everything the Content pages read (what its server returned, under the mock's names). Here each name comes from the
// mock data file that already defines it. Only the names the copied files import are listed.
import { CO_BRAND, CO_BRANDS } from '../../data/contentOpportunities.js'
import { competitorName } from '../../data/contentRecommend.js'
import { account } from '../../data/mock.js'
import { brandName } from '../../utils/brand.js'
import { looksLikeDomain } from './citation-rules.js'

export { CO_BRAND, CO_BRANDS, ENGINES, ENGINE_NAME, ENGINE_SHORT, coBrandName, engineIcon } from '../../data/contentOpportunities.js'
export { FLAGS, NEXT_CHECK, draftFor, trackingFor } from '../../data/contentOpportunities-proposed.js'
export { consumeFlash, pageSourceLabel, sampleProperties } from '../../data/contentApp.js'
export { bestPageFor, brandScState, setBrandScState } from '../../data/gscMatch.js'
export { competitorName, formatLabel } from '../../data/contentRecommend.js'
import { CONTENT_HIDDEN as MOCK_HIDDEN } from '../../data/contentApp.js'
// what the app hides for now (its values on 2026-11-15: the status hover card is back on published rows, and the
// Google searches section is hidden). ?co=searches (mock only) shows that section, so its browser tests still run on it.
const showSearches = typeof window !== 'undefined' && new Set((new URLSearchParams(window.location.search).get('co') ?? '').split(',')).has('searches')
export const CONTENT_HIDDEN = { ...MOCK_HIDDEN, statusCard: false, googleSearches: !showSearches }

// A site's display name (the app's one rule for the Content pages): a tracked brand's name, the brand on screen by its
// name, any other site by its tidied domain; never the raw domain
export const siteName = (host) => CO_BRANDS[host]?.name ?? (competitorName(host) !== host ? competitorName(host) : brandName(host))
// the brand's own name as sentences say it ("ChatGPT names Dermasuri"), never a domain
export function ownBrandShown() {
  const names = [CO_BRAND.name, account?.name].map((n) => String(n || '').trim())
  return names.find((n) => n && !looksLikeDomain(n)) || 'Your brand'
}
