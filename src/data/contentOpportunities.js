// Opportunities → Content: the data that EXISTS in the app today, in its real shapes (app docs/content-opportunities-data.md).
// The brands are the Overview's own sample set (Dermasuri and its competitors, the same logos); values are made up. What the page shows beyond these shapes is in
// ./contentOpportunities-proposed.js, which the app can't supply yet.

export const ENGINES = ['google', 'chatgpt', 'gemini', 'claude']
export const ENGINE_NAME = { google: 'Google AI Overview', chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude' }
export const engineIcon = (e) => (e === 'google' ? 'aio' : e) // PlatformIcon ids

export const CO_BRAND = { name: 'Dermasuri', domain: 'dermasuri.com' } // the mock's own brand (data/mock.js account)
// tracked competitors (brief.competitors are domains of these)
export const CO_BRANDS = {
  'cerave.com': { name: 'CeraVe' },
  'theordinary.com': { name: 'The Ordinary' },
  'paulaschoice.com': { name: 'Paula’s Choice' },
  'glowrecipe.com': { name: 'Glow Recipe' },
  'naturium.com': { name: 'Naturium' },
}
export const coBrandName = (d) => CO_BRANDS[d]?.name ?? (d === CO_BRAND.domain ? CO_BRAND.name : d)

export const TRACKED_TOTAL = 48 // prompts tracked for the brand (the app's kpis.total)
export const SYNCS = ['Sep 14, 2026', 'Sep 21, 2026', 'Sep 28, 2026', 'Oct 5, 2026', 'Oct 12, 2026', 'Oct 19, 2026', 'Oct 26, 2026', 'Nov 2, 2026']

// ---- Missed prompts rows: lib/mock-adapter.ts missedItem ----------------------------------------------------------
// topic, discovery, angle and status are always null in the app today.
const P = [
  // [prompt, platforms (missing on), streak, competitors (named instead), sources]
  ['how to layer niacinamide and vitamin c', ['google', 'chatgpt', 'gemini'], 6, ['cerave.com', 'theordinary.com'], [['healthline.com', '/niacinamide-vitamin-c'], ['cerave.com', '/blog/layering-guide'], ['byrdie.com', '/t/4821'], ['allure.com', '/guides/serum-order']]],
  ['best moisturizer for eczema prone skin', ['google', 'chatgpt'], 4, ['paulaschoice.com', 'cerave.com', 'glowrecipe.com'], [['paulaschoice.com', '/eczema-cream'], ['healthline.com', '/best-eczema-moisturizers'], ['verywellhealth.com', '/eczema/moisturizers']]],
  ['is azelaic acid safe during pregnancy', ['google', 'claude'], 8, ['theordinary.com'], [['verywellhealth.com', '/pregnancy-skincare'], ['theordinary.com', '/learn/azelaic-acid']]],
  ['ceramide cream vs hyaluronic acid', ['chatgpt', 'gemini'], 3, ['cerave.com', 'naturium.com'], [['allure.com', '/ceramides-vs-ha'], ['naturium.com', '/compare']]],
  ['how long does retinol take to work', ['google'], 2, ['glowrecipe.com'], [['healthline.com', '/retinol-timeline'], ['glowrecipe.com', '/retinol-results']]],
  ['fragrance free sunscreen for sensitive skin', ['google', 'chatgpt', 'gemini', 'claude'], 7, ['paulaschoice.com', 'theordinary.com', 'cerave.com', 'glowrecipe.com'], [['healthline.com', '/fragrance-free-spf'], ['paulaschoice.com', '/spf50']]],
  ['can you use bha and retinol together', ['gemini'], 1, [], [['byrdie.com', '/t/9930']]],
  ['how to fade dark spots on the face', ['google', 'chatgpt', 'gemini', 'claude'], 5, ['naturium.com', 'cerave.com'], [['verywellhealth.com', '/dark-spots'], ['naturium.com', '/blog/dark-spots']]],
  ['barrier repair routine for winter', ['google', 'claude'], 3, ['paulaschoice.com'], [['allure.com', '/winter-barrier'], ['paulaschoice.com', '/winter']]],
  ['what percentage of niacinamide is best', ['chatgpt'], 1, ['theordinary.com', 'glowrecipe.com'], [['healthline.com', '/niacinamide-percent']]],
  ['gentle exfoliant for sensitive skin', ['google', 'gemini'], 6, ['cerave.com'], [['healthline.com', '/gentle-exfoliants'], ['cerave.com', '/pha-toner']]],
  ['best serum for large pores', ['google', 'chatgpt', 'claude'], 4, ['glowrecipe.com', 'naturium.com', 'paulaschoice.com'], [['allure.com', '/pore-serums'], ['glowrecipe.com', '/pores']]],
  ['how to treat fungal acne', ['google'], 8, ['theordinary.com'], [['verywellhealth.com', '/fungal-acne']]],
  ['squalane oil vs rosehip oil', ['chatgpt', 'gemini'], 1, ['naturium.com'], [['allure.com', '/squalane-vs-rosehip']]],
]

const historyFor = (streak) => SYNCS.map((_, i) => {
  const fromEnd = SYNCS.length - 1 - i
  if (fromEnd < streak) return 'missed'
  if (fromEnd === streak) return 'visible'
  return (i * 7 + streak) % 3 === 0 ? 'visible' : 'missed'
})

export const missedItems = P.map(([prompt, platforms, streak, competitors, sources], id) => ({
  id,
  prompt,
  platforms,
  streak,
  firstSeen: SYNCS[Math.max(0, SYNCS.length - 1 - streak - 1)],
  history: historyFor(streak),
  answer: competitors.length
    ? `For "${prompt}", most answers point to ${competitors.map(coBrandName).join(' and ')}.`
    : `Answers for "${prompt}" don't name a brand yet.`,
  brandsMentioned: competitors.map((domain, i) => ({ domain, platforms: platforms.filter((_, j) => (i + j) % 3 !== 2) })),
  competitors,
  sources: sources.map(([domain, path]) => ({ domain, path })),
  topic: null,
  discovery: null,
  angle: null,
  status: null,
}))

// ---- the brief: utils/brief.js buildBrief(rows, account) ------------------------------------------------------------
export const briefFor = (row) => ({
  prompts: [row.prompt],
  competitors: row.competitors,
  sources: row.sources.slice(0, 8),
  angles: [],
})

// ---- Search Console (Site Kit): POST /api/site-kit/gsc and gsc_keywords ---------------------------------------------
export const gscConnection = { success: true, domain: CO_BRAND.domain, siteUrl: `sc-domain:${CO_BRAND.domain}`, startDate: '2026-10-04', endDate: '2026-11-03' }
// gsc_keywords.keywords[]: one row per query; url = the page with the most clicks for it
export const gscKeywords = [
  { keyword: 'niacinamide and vitamin c together', clicks: 212, impressions: 9840, ctr: 2.2, position: 7.8, url: `https://${CO_BRAND.domain}/blog/niacinamide-vitamin-c-routine` },
  { keyword: 'can i use niacinamide with vitamin c', clicks: 96, impressions: 6120, ctr: 1.6, position: 9.4, url: `https://${CO_BRAND.domain}/blog/niacinamide-vitamin-c-routine` },
  { keyword: 'vitamin c serum layering', clicks: 41, impressions: 3310, ctr: 1.2, position: 12.6, url: `https://${CO_BRAND.domain}/products/vitamin-c-brightening-serum` },
  { keyword: 'serum order morning routine', clicks: 18, impressions: 2480, ctr: 0.7, position: 18.1, url: `https://${CO_BRAND.domain}/guides/morning-routine-order` },
  { keyword: 'niacinamide serum', clicks: 64, impressions: 1960, ctr: 3.3, position: 6.2, url: `https://${CO_BRAND.domain}/products/niacinamide-10-serum` },
  { keyword: 'skincare layering guide', clicks: 7, impressions: 1120, ctr: 0.6, position: 24.3, url: `https://${CO_BRAND.domain}/skincare-layering` },
]

// ---- the old "Generate content" route's response (POST /api/missed-prompts/generate-content) -------------------------
// Not reachable from the app's UI today; its fields feed the draft step here. content is one Markdown string.
export const generateResponse = {
  ok: true,
  prompt: P[0][0],
  analyzedAt: '2026-11-03T10:15:00.000Z',
  brand: { name: CO_BRAND.name, domain: CO_BRAND.domain, about: 'Barrier-first skincare for sensitive skin.' },
  intent: {
    intent_type: 'informational',
    user_need: 'Use niacinamide and vitamin C in one routine without irritation.',
    audience: 'Skincare beginners with sensitive skin',
    expected_format: 'how-to',
    key_subtopics: ['order of application', 'wait time', 'morning vs night', 'percentages'],
    content_gaps: 'Top results skip what to do if the skin flushes.',
    tone: 'helpful',
  },
  topUrls: ['https://healthline.com/niacinamide-vitamin-c', 'https://cerave.com/blog/layering-guide', 'https://allure.com/guides/serum-order', 'https://byrdie.com/t/4821'],
  pages: [
    { url: 'https://healthline.com/niacinamide-vitamin-c', ok: true, status: 200, title: 'Niacinamide and Vitamin C: Can You Use Them Together?', description: 'We asked dermatologists…', h1: 'Niacinamide and vitamin C', charCount: 9210 },
    { url: 'https://cerave.com/blog/layering-guide', ok: true, status: 200, title: 'The Layering Guide', description: 'Order matters…', h1: 'How to layer serums', charCount: 6480 },
    { url: 'https://allure.com/guides/serum-order', ok: true, status: 200, title: 'Serum Order, Explained', description: 'Thin to thick…', h1: 'Serum order', charCount: 5120 },
    { url: 'https://byrdie.com/t/4821', ok: false, status: 403, title: '', description: '', h1: '', charCount: 0, error: 'HTTP 403' },
  ],
  chatgpt: { citationCount: 5, sourceCount: 7, responseSnippet: 'You can use both. Apply vitamin C first…' },
  serp: { urlCount: 12, hasAiOverview: true },
  content: '# How to layer niacinamide and vitamin C\n\n**Quick answer:** …',
}
