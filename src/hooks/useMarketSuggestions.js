import { suggestionsFor } from '../data/marketSuggestions'
import { useTracking } from '../store/trackingSettings'

// Setup's "Suggested" chips for the selected market (country from the shared tracking store, so a change on
// /llm-settings shows here at once). type: 'competitors' | 'marketplaces'; tracked: [{ domain?, name? }]
// already on the brand — dropped by domain or by name, so Sephora (sephora.com) also hides sephora.sg.
export function useMarketSuggestions(type, tracked) {
  const { country } = useTracking().market
  const has = (x) => tracked.some((t) => (t.domain && t.domain === x.domain) || (t.name && t.name.toLowerCase() === x.name.toLowerCase()))
  return { country, items: suggestionsFor(country)[type].filter((x) => !has(x)) }
}
