// /sentiment: how third-party pages describe the brand in AI answers (mock data + the page's pure logic).
// Production (app: Re-analyze → POST /api/reputation → lib/reputation-scan.js): searches the brand's hidden default
// prompts on Google (SerpAPI credits), reads up to 40 of the top result pages and has a model score each page, so
// every run is a PAID run. A run stores by_source [{ url, title, sentiment, quote }] and counts; history is one
// snapshot per Re-analyze. The old page showed "Health" = positive % − negative % (−100…100).
//
// The 0–100 score here is that same health, moved onto 0–100 so it reads like the other gauges:
//   score = 50 + health / 2 → 0 every page negative · 50 even (all neutral, or as many good as bad) · 100 all positive

export const TONES = ['positive', 'neutral', 'negative']
export const TONE_LABEL = { positive: 'Positive', neutral: 'Neutral', negative: 'Negative' }

// ---- pure logic (tested in sentiment.test.js) ---------------------------------------------------------------------

export const countTones = (pages) => {
  const c = { positive: 0, neutral: 0, negative: 0 }
  for (const p of pages) c[p.tone] += 1
  return c
}
const totalOf = (c) => c.positive + c.neutral + c.negative

// 0–100; null with nothing to score
export function scoreOf(c) {
  const n = totalOf(c)
  if (!n) return null
  return Math.round(50 + ((c.positive - c.negative) / n) * 50)
}

// whole percentages that always add up to 100 (largest remainder), so the bar's labels never read 101%
export function tonePercents(c) {
  const n = totalOf(c)
  if (!n) return { positive: 0, neutral: 0, negative: 0 }
  const raw = TONES.map((k) => ({ k, v: (c[k] * 100) / n }))
  const out = Object.fromEntries(raw.map(({ k, v }) => [k, Math.floor(v)]))
  let left = 100 - Object.values(out).reduce((a, b) => a + b, 0)
  for (const { k } of [...raw].sort((a, b) => (b.v % 1) - (a.v % 1))) {
    if (left <= 0) break
    out[k] += 1; left -= 1
  }
  return out
}

// each run with its score and the change vs the run before it (newest last)
export function withScores(runs) {
  return runs.map((r, i) => {
    const score = scoreOf(r.counts)
    const prev = i ? scoreOf(runs[i - 1].counts) : null
    return { ...r, score, delta: prev == null || score == null ? null : score - prev }
  })
}

// pages on one engine ('all' = every page)
export const pagesOn = (pages, engine) => (engine === 'all' ? pages : pages.filter((p) => p.engines.includes(engine)))

// per engine: tone counts + pages, engines with no pages left out
export function byEngine(pages, engines) {
  return engines
    .map((e) => { const on = pagesOn(pages, e.id); return { ...e, pages: on.length, counts: countTones(on) } })
    .filter((r) => r.pages > 0)
}

// the pages list's sort: tone (negative first), title, domain or engine count; dir 'asc' | 'desc'
const TONE_RANK = { negative: 0, neutral: 1, positive: 2 }
export function sortPages(pages, key = 'tone', dir = 'asc') {
  const val = {
    tone: (p) => TONE_RANK[p.tone],
    title: (p) => p.title.toLowerCase(),
    domain: (p) => p.domain,
    engines: (p) => p.engines.length,
  }[key]
  const s = dir === 'asc' ? 1 : -1
  return [...pages].sort((a, b) => (val(a) < val(b) ? -s : val(a) > val(b) ? s : a.title.localeCompare(b.title)))
}

// the insight line under the top strip, from the latest run's counts
export function sentimentInsight(c, brand) {
  const n = totalOf(c)
  if (!n) return null
  const pc = tonePercents(c)
  if (c.neutral === n) return `All ${n} pages are neutral: review sites mention ${brand} without an opinion.`
  if (c.negative > c.positive) return `More pages speak badly of ${brand} than well: ${pc.negative}% are negative.`
  if (c.neutral / n >= 0.5) return `Most pages mention ${brand} without an opinion; the ones that take a side lean positive.`
  return `Pages lean positive: ${pc.positive}% speak well of ${brand}.`
}

// ---- mock data ----------------------------------------------------------------------------------------------------

// one snapshot per Re-analyze, oldest first (counts = pages per tone)
export const RUNS = [
  { id: 'r1', date: '2026-08-11', counts: { positive: 2, neutral: 11, negative: 4 } },
  { id: 'r2', date: '2026-08-25', counts: { positive: 3, neutral: 12, negative: 4 } },
  { id: 'r3', date: '2026-09-08', counts: { positive: 3, neutral: 13, negative: 3 } },
  { id: 'r4', date: '2026-09-22', counts: { positive: 4, neutral: 12, negative: 4 } },
  { id: 'r5', date: '2026-10-06', counts: { positive: 4, neutral: 13, negative: 3 } },
  { id: 'r6', date: '2026-10-20', counts: { positive: 5, neutral: 14, negative: 2 } },
]

// the latest run's pages. engines: the answers that drew on the page, split only by Google search, ChatGPT and Claude
// (what production stores). sentences: the quotes that mention the brand; mark = the words that carry the tone.
const S = (text, tone, mark) => ({ text, tone, mark })
export const PAGES = [
  { id: 'p1', domain: 'byrdie.com', path: '/best-niacinamide-serums', title: 'The 14 Best Niacinamide Serums, Tested by Editors', engines: ['google', 'chatgpt'], tone: 'positive', sentences: [
    S('Dermasuri’s 10% serum was the gentlest formula we tested, with no stinging even on reactive skin.', 'positive', 'the gentlest formula we tested'),
    S('At $24 it sits in the middle of the pack on price.', 'neutral', null) ] },
  { id: 'p2', domain: 'reddit.com', path: '/r/SkincareAddiction/comments/dermasuri_review', title: 'Dermasuri barrier cream: 3 months in (review)', engines: ['google', 'chatgpt', 'claude'], tone: 'positive', sentences: [
    S('Three months in and my redness is visibly calmer; Dermasuri is my holy grail now.', 'positive', 'visibly calmer'),
    S('Shipping to Canada took almost two weeks though.', 'negative', 'took almost two weeks') ] },
  { id: 'p3', domain: 'trustpilot.com', path: '/review/dermasuri.com', title: 'Dermasuri reviews | Read customer service reviews', engines: ['google', 'chatgpt'], tone: 'negative', sentences: [
    S('Ordered twice and both times the pump on the bottle broke within a week.', 'negative', 'broke within a week'),
    S('Customer service took nine days to reply to my refund request.', 'negative', 'took nine days to reply') ] },
  { id: 'p4', domain: 'healthline.com', path: '/health/beauty-skin-care/fragrance-free-moisturizers', title: 'Fragrance-Free Moisturizers Dermatologists Recommend', engines: ['google', 'claude'], tone: 'positive', sentences: [
    S('Dermasuri is one of the few brands whose whole line is fragrance-free and tested on sensitive skin.', 'positive', 'whole line is fragrance-free') ] },
  { id: 'p5', domain: 'dermstore.com', path: '/blog/ceramide-creams-compared', title: 'Ceramide Creams Compared: Which One Is Right for You?', engines: ['google', 'chatgpt'], tone: 'neutral', sentences: [
    S('Dermasuri, CeraVe and La Roche-Posay all use a 3:1:1 lipid ratio.', 'neutral', null),
    S('Dermasuri comes in a 50 ml tube rather than a tub.', 'neutral', null) ] },
  { id: 'p6', domain: 'allure.com', path: '/story/best-skin-care-brands-2026', title: 'The Best Skin-Care Brands of 2026', engines: ['google'], tone: 'neutral', sentences: [
    S('Newer names on the list include Dermasuri and Bubble.', 'neutral', null) ] },
  { id: 'p7', domain: 'incidecoder.com', path: '/products/dermasuri-barrier-repair-cream', title: 'Dermasuri Barrier Repair Cream: ingredients explained', engines: ['chatgpt', 'claude'], tone: 'neutral', sentences: [
    S('Dermasuri Barrier Repair Cream contains ceramide NP, cholesterol and 2% niacinamide.', 'neutral', null) ] },
  { id: 'p8', domain: 'cosmopolitan.com', path: '/style-beauty/beauty/g4417/drugstore-moisturizers', title: '20 Best Drugstore Moisturizers, According to Derms', engines: ['google'], tone: 'neutral', sentences: [
    S('Dermasuri is sold online and at a handful of Target stores.', 'neutral', null) ] },
  { id: 'p9', domain: 'skincarisma.com', path: '/products/dermasuri/niacinamide-10-serum', title: 'Dermasuri Niacinamide 10% Serum: ingredient analysis', engines: ['chatgpt'], tone: 'neutral', sentences: [
    S('The Dermasuri serum is free of alcohol, essential oils and silicones.', 'neutral', null) ] },
  { id: 'p10', domain: 'refinery29.com', path: '/en-us/sensitive-skin-routine', title: 'A Dermatologist’s Routine for Sensitive Skin', engines: ['google', 'chatgpt'], tone: 'positive', sentences: [
    S('I recommend Dermasuri to patients who react to everything; it rarely irritates.', 'positive', 'it rarely irritates') ] },
  { id: 'p11', domain: 'wikipedia.org', path: '/wiki/Niacinamide', title: 'Niacinamide - Wikipedia', engines: ['claude'], tone: 'neutral', sentences: [
    S('Brands that sell 10% serums include The Ordinary, Paula’s Choice and Dermasuri.', 'neutral', null) ] },
  { id: 'p12', domain: 'makeupalley.com', path: '/product/dermasuri-gentle-cleanser', title: 'Dermasuri Gentle Cleanser reviews', engines: ['google'], tone: 'negative', sentences: [
    S('For the price, the Dermasuri cleanser runs out far too fast.', 'negative', 'runs out far too fast'),
    S('It does leave my skin soft.', 'positive', 'leave my skin soft') ] },
  { id: 'p13', domain: 'glamour.com', path: '/story/best-moisturizers-for-dry-skin', title: 'The Best Moisturizers for Dry Skin', engines: ['google', 'chatgpt', 'claude'], tone: 'neutral', sentences: [
    S('Dermasuri’s cream is thicker than most gel moisturizers on this list.', 'neutral', null) ] },
  { id: 'p14', domain: 'vogue.com', path: '/article/clean-beauty-brands', title: 'Clean Beauty Brands Worth Knowing', engines: ['google'], tone: 'neutral', sentences: [
    S('Dermasuri was founded in 2021 and makes everything in Portugal.', 'neutral', null) ] },
  { id: 'p15', domain: 'womenshealthmag.com', path: '/beauty/a19/best-face-serums', title: 'The Best Face Serums for Every Skin Concern', engines: ['google', 'chatgpt'], tone: 'neutral', sentences: [
    S('Dermasuri sells a 10% niacinamide serum and a vitamin C serum.', 'neutral', null) ] },
  { id: 'p16', domain: 'nytimes.com', path: '/wirecutter/reviews/best-moisturizers', title: 'The Best Moisturizers | Reviews by Wirecutter', engines: ['google', 'chatgpt', 'claude'], tone: 'positive', sentences: [
    S('Our runner-up, Dermasuri, absorbed faster than any other cream we tried.', 'positive', 'absorbed faster than any other') ] },
  { id: 'p17', domain: 'beautypedia.com', path: '/products/dermasuri-vitamin-c-serum', title: 'Dermasuri Vitamin C Serum review', engines: ['chatgpt'], tone: 'neutral', sentences: [
    S('The Dermasuri formula uses 15% ascorbic acid in an airless pump.', 'neutral', null) ] },
  { id: 'p18', domain: 'influenster.com', path: '/reviews/dermasuri', title: 'Dermasuri reviews on Influenster', engines: ['google'], tone: 'neutral', sentences: [
    S('Reviewers mention Dermasuri mostly for its cleanser and barrier cream.', 'neutral', null) ] },
  { id: 'p19', domain: 'theskincareedit.com', path: '/dermasuri-vs-cerave', title: 'Dermasuri vs CeraVe: which barrier cream wins?', engines: ['google', 'chatgpt'], tone: 'neutral', sentences: [
    S('Dermasuri costs about twice as much as CeraVe for a similar formula.', 'neutral', null),
    S('Both are fragrance-free.', 'neutral', null) ] },
  { id: 'p20', domain: 'youtube.com', path: '/watch?v=dermasuri-routine', title: 'My $60 sensitive-skin routine (Dermasuri, Vanicream)', engines: ['google'], tone: 'neutral', sentences: [
    S('In this routine I use the Dermasuri barrier cream at night.', 'neutral', null) ] },
  { id: 'p21', domain: 'reviewed.com', path: '/beauty/best-right-now/best-cleansers', title: 'The Best Face Cleansers of 2026', engines: ['google'], tone: 'neutral', sentences: [
    S('Dermasuri ships free on orders over $35.', 'neutral', null) ] },
]

// What people say: the latest run's themes as Strengths / Weaknesses / Opportunities / Threats (production keeps
// these for the latest run only, no history)
export const SWOT = {
  strengths: ['Gentle on sensitive skin', 'Fragrance-free across the line', 'Absorbs quickly'],
  weaknesses: ['Pumps break on some bottles', 'Slow replies from customer service'],
  opportunities: ['Dermatologists already recommend it; ask for quotes', 'Few reviews on Amazon and Sephora yet'],
  threats: ['Seen as twice the price of CeraVe', 'Cleanser runs out fast for the price'],
}

// the account's own brands only (no competitor sentiment); a brand never analysed: nothing yet
export const sentimentFor = (domain, own) => (domain === own ? { runs: RUNS, pages: PAGES, swot: SWOT } : { runs: [], pages: [], swot: null })
