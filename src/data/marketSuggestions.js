// Setup "Suggested" chips per market (the country in the shared tracking store, edited on /llm-settings):
// brands that show up in answers you're missing from, and stores AI cites where you aren't listed.
// answers = how many answers they appear / are cited in (the chip's tooltip). Any other country → GLOBAL.
const S = (name, domain, answers) => ({ name, domain, answers })

export const MARKET_SUGGESTIONS = {
  'United States': {
    // CeraVe, The Ordinary and Paula's Choice are already tracked; these show up in answers you're missing from
    competitors: [S('La Roche-Posay', 'laroche-posay.us', 28), S('Neutrogena', 'neutrogena.com', 24), S('Supergoop!', 'supergoop.com', 15)],
    marketplaces: [S('Sephora', 'sephora.com', 34), S('Ulta', 'ulta.com', 21), S('Walmart', 'walmart.com', 12)],
  },
  'United Kingdom': {
    competitors: [S('The Inkey List', 'theinkeylist.com', 19), S('The Ordinary', 'theordinary.com', 17), S('Glow Recipe', 'glowrecipe.com', 9)],
    marketplaces: [S('Boots', 'boots.com', 27), S('LookFantastic', 'lookfantastic.com', 18), S('Cult Beauty', 'cultbeauty.co.uk', 11)],
  },
  'United Arab Emirates': {
    competitors: [S('The Ordinary', 'theordinary.com', 14), S('Huda Beauty', 'hudabeauty.com', 12), S('Dr. Jart+', 'drjart.com', 7)],
    marketplaces: [S('Noon', 'noon.com', 22), S('Faces', 'faces.ae', 13), S('Namshi', 'namshi.com', 6)],
  },
  Australia: {
    competitors: [S('Go-To', 'gotoskincare.com', 16), S('Mecca Cosmetica', 'meccacosmetica.com.au', 12), S('The Ordinary', 'theordinary.com', 10)],
    marketplaces: [S('Mecca', 'mecca.com', 25), S('Adore Beauty', 'adorebeauty.com.au', 17), S('Chemist Warehouse', 'chemistwarehouse.com.au', 14)],
  },
  Singapore: {
    competitors: [S('Some By Mi', 'somebymi.com', 13), S('COSRX', 'cosrx.com', 11), S('Laneige', 'laneige.com', 8)],
    marketplaces: [S('Shopee', 'shopee.sg', 24), S('Lazada', 'lazada.sg', 19), S('Sephora', 'sephora.sg', 10)],
  },
}
export const GLOBAL = MARKET_SUGGESTIONS['United States']
export const suggestionsFor = (country) => MARKET_SUGGESTIONS[country] ?? GLOBAL

// display names for every suggested domain ("beminimalist.co" → "Minimalist")
export const SUGGESTED_NAMES = Object.fromEntries(
  Object.values(MARKET_SUGGESTIONS).flatMap((m) => [...m.competitors, ...m.marketplaces]).map((x) => [x.domain, x.name]),
)

// where each known marketplace operates (matched on the domain's name, so amazon.in / amazon.com are both Amazon).
// Unknown stores (added by hand) get no note.
const ALL = Object.keys(MARKET_SUGGESTIONS)
const OPERATES = {
  amazon: ALL, sephora: ['United States', 'Singapore', 'United Arab Emirates', 'Australia'],
  target: ['United States'], ulta: ['United States'], walmart: ['United States'],
  boots: ['United Kingdom'], lookfantastic: ['United Kingdom', 'Australia', 'Singapore', 'United Arab Emirates'], cultbeauty: ['United Kingdom'],
  noon: ['United Arab Emirates'], faces: ['United Arab Emirates'], namshi: ['United Arab Emirates'],
  mecca: ['Australia'], adorebeauty: ['Australia'], chemistwarehouse: ['Australia'],
  shopee: ['Singapore'], lazada: ['Singapore'],
}
const storeKey = (domain) => domain.replace(/^www\./, '').split('.')[0].toLowerCase()
// false only when we know both the store and the market, and the store isn't there
export const operatesIn = (domain, country) => {
  const where = OPERATES[storeKey(domain)]
  return !where || !ALL.includes(country) || where.includes(country)
}
