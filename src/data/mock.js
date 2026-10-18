// All dashboard data. No backend.
// NOTE: rows marked PLACEHOLDER must be replaced with the exact rows from the live-site screenshots.
import { brandName } from '../utils/brand.js' // .js: the unit tests load this file in plain Node
import { GLOBAL, MARKET_SUGGESTIONS } from './marketSuggestions.js'

// ---- Workspace: the agency, its clients and their brands. Two brands have demo data (Dermasuri; Lumen Skin reuses the
// same dataset under its own name); the rest have none yet and show empty states. The current brand is kept in this
// browser (store/workspace.js) and read here at load, so every page sees it as `account`.
export const workspaceAgency = { name: 'PTA Agency', domain: 'pta.agency' }
export const workspaceUser = { name: 'Alex Morgan', email: 'alex@pta.agency' } // the signed-in user (mock)
export const workspaceDirectory = [
  { id: 'dermasuri-co', client: 'Dermasuri Skincare', brands: [
    { id: 'dermasuri', name: 'Dermasuri', domain: 'dermasuri.com', data: 'full' },
    { id: 'dermasuri-men', name: 'Dermasuri Men', domain: 'dermasurimen.com', data: 'empty' },
  ] },
  { id: 'lumen-co', client: 'Lumen Beauty Group', brands: [
    { id: 'lumen', name: 'Lumen Skin', domain: 'lumenskin.com', data: 'full' },
  ] },
  { id: 'brightside-co', client: 'Brightside', brands: [
    { id: 'brightside', name: 'Brightside Botanics', domain: 'brightsidebotanics.com', data: 'empty', setUp: true }, // prompts and competitors in, first sync pending
  ] },
  { id: 'northwind-co', client: 'Northwind Pharmacy', brands: [
    { id: 'northwind-derm', name: 'Northwind Derm', domain: 'northwindderm.com', data: 'empty' },
    { id: 'northwind-sun', name: 'Northwind Sun', domain: 'northwindsun.com', data: 'empty' },
  ] },
]
const storedBrandId = (() => { try { return typeof localStorage !== 'undefined' ? localStorage.getItem('kraffic:brand') : null } catch { return null } })()
export const currentBrand = workspaceDirectory.flatMap((c) => c.brands.map((b) => ({ ...b, client: c.client, clientId: c.id }))).find((b) => b.id === storedBrandId)
  ?? { ...workspaceDirectory[0].brands[0], client: workspaceDirectory[0].client, clientId: workspaceDirectory[0].id }

// The features switched on for the account (the backend's per-account flags). Off: the Overview drops the marketplace
// cards (ecommerce); Structured Data and Site Audit show FeatureOff. Preview: ?off=ecommerce,structuredData,siteAudit
const featuresOff = (() => { try { return (new URLSearchParams(window.location.search).get('off') || '').split(',') } catch { return [] } })()
export const account = {
  name: currentBrand.name,
  plan: 'PTA · Agency',
  domain: currentBrand.domain,
  llm: 'Google AI Overview',
  lastSync: 'Oct 5, 2026',
  features: {
    ecommerce: !featuresOff.includes('ecommerce'),
    structuredData: !featuresOff.includes('structuredData'),
    siteAudit: !featuresOff.includes('siteAudit'),
  },
}

export const kpis = {
  score: 73,
  scoreDelta: 6,
  visible: 111,
  missed: 41,
  total: 152,
  citedSources: 30,
}

export const competitors = [
  // colors come from getCompetitorColor (src/theme/colors.js): you → teal 700, others by share rank → c1..c3
  { domain: account.domain, share: 73, you: true }, // the current brand (Lumen Skin reuses this dataset)
  { domain: 'cerave.com', share: 18 },
  { domain: 'paulaschoice.com', share: 3 },
  { domain: 'theordinary.com', share: 4 },
]

export const history = [
  { date: 'Sep 7', dermasuri: 71, paulas: 2, cerave: 20, ordinary: 12 },
  { date: 'Sep 16', dermasuri: 74, paulas: 2, cerave: 21, ordinary: 9 },
  { date: 'Sep 21', dermasuri: 71, paulas: 3, cerave: 19, ordinary: 6 },
  { date: 'Sep 28', dermasuri: 67, paulas: 3, cerave: 17, ordinary: 9 },
  { date: 'Oct 5', dermasuri: 73, paulas: 3, cerave: 18, ordinary: 4 },
]

// legend + bar order is fixed: you, then competitors ranked by share
// Earlier weekly syncs (Aug: dermasuri = the sync-history visibility for those dates; Jul averages to the Jul month); feeds "Last 90 days".
export const historyEarlier = [
  { date: 'Jul 13', dermasuri: 65, paulas: 2, cerave: 21, ordinary: 10 },
  { date: 'Jul 20', dermasuri: 66, paulas: 3, cerave: 20, ordinary: 11 },
  { date: 'Jul 27', dermasuri: 67, paulas: 2, cerave: 21, ordinary: 9 },
  { date: 'Aug 3', dermasuri: 66, paulas: 2, cerave: 19, ordinary: 11 },
  { date: 'Aug 10', dermasuri: 66, paulas: 3, cerave: 20, ordinary: 10 },
  { date: 'Aug 17', dermasuri: 70, paulas: 2, cerave: 19, ordinary: 12 },
  { date: 'Aug 24', dermasuri: 68, paulas: 3, cerave: 21, ordinary: 11 },
  { date: 'Aug 31', dermasuri: 69, paulas: 2, cerave: 20, ordinary: 10 },
]

// Monthly average share, last 12 months. Aug–Oct 2026 are the averages of the weekly syncs above
// (Aug 67.8 → 68, Sep 70.75 → 71, Oct 73); earlier months trend gently up from 58. Competitors roughly flat.
export const historyMonthly = [
  { date: 'Nov 2025', dermasuri: 58, cerave: 20, ordinary: 9, paulas: 3 },
  { date: 'Dec 2025', dermasuri: 59, cerave: 21, ordinary: 10, paulas: 2 },
  { date: 'Jan 2026', dermasuri: 61, cerave: 19, ordinary: 11, paulas: 3 },
  { date: 'Feb 2026', dermasuri: 60, cerave: 20, ordinary: 10, paulas: 3 },
  { date: 'Mar 2026', dermasuri: 62, cerave: 21, ordinary: 9, paulas: 2 },
  { date: 'Apr 2026', dermasuri: 63, cerave: 20, ordinary: 11, paulas: 3 },
  { date: 'May 2026', dermasuri: 65, cerave: 19, ordinary: 10, paulas: 2 },
  { date: 'Jun 2026', dermasuri: 64, cerave: 20, ordinary: 11, paulas: 3 },
  { date: 'Jul 2026', dermasuri: 66, cerave: 21, ordinary: 10, paulas: 2 },
  { date: 'Aug 2026', dermasuri: 68, cerave: 20, ordinary: 11, paulas: 2 },
  { date: 'Sep 2026', dermasuri: 71, cerave: 19, ordinary: 9, paulas: 3 },
  { date: 'Oct 2026', dermasuri: 73, cerave: 18, ordinary: 4, paulas: 3 },
]

export const historyRanges = {
  weekly: [{ id: 'last-30d', label: 'Last 30 days', count: 5 }, { id: 'last-90d', label: 'Last 90 days', count: 13 }],
  monthly: [{ id: 'last-3m', label: 'Last 3 months', count: 3 }, { id: 'last-6m', label: 'Last 6 months', count: 6 }, { id: 'last-12m', label: 'Last 12 months', count: 12 }],
}
export const defaultRange = { weekly: 'last-30d', monthly: 'last-6m' }

// Nice auto-fit domain for "your share only": [floor(min − 5) to 5, ceil(max + 5) to 5], 4 evenly spaced ticks.
function fitDomain(values) {
  const lo = Math.max(0, Math.floor((Math.min(...values) - 5) / 5) * 5)
  let hi = Math.min(100, Math.ceil((Math.max(...values) + 5) / 5) * 5)
  const step = Math.max(5, Math.ceil((hi - lo) / 3 / 5) * 5)
  hi = lo + step * 3
  return { domain: [lo, hi], ticks: [0, 1, 2, 3].map((i) => lo + step * i) }
}

// The one selector for the history chart. `view` = { compare, hidden, granularity, range }.
//   granularity 'weekly' → weekly sync points, 'monthly' → monthly averages
//   range       → slices to the selected window (falls back to the granularity's default)
//   compare     → false: only dermasuri; true: every series not in `hidden` (dermasuri can be hidden too,
//                 to look at competitors alone; the axis then fits their values)
// Each point carries `delta` = change of dermasuri vs the previous period (even across the window edge).
// scale: { seriesKey: factor } — an engine filter's share relative to all engines (see brandViews.engineScale)
const historyPreview = (() => { try { return new URLSearchParams(window.location.search).get('history') } catch { return null } })()
const singleSync = historyPreview === 'single'
export function getHistory({ compare = true, hidden = [], granularity = 'weekly', range, focal = 'dermasuri', scale = null } = {}) {
  const gran = granularity === 'monthly' ? 'monthly' : 'weekly'
  const raw = gran === 'monthly' ? historyMonthly : [...historyEarlier, ...history]
  const scaled = !scale ? raw : raw.map((p) => ({ ...p, ...Object.fromEntries(historySeries.map((s) => [s.key, Math.round(p[s.key] * (scale[s.key] ?? 1))])) }))
  // ?history=single: a brand with one sync so far (the chart's first-sync state)
  // ?history=empty: nothing on record yet (no sync, or every day at 0%)
  const all = historyPreview === 'empty' ? [] : singleSync ? scaled.slice(-1) : scaled
  const opts = historyRanges[gran]
  const opt = opts.find((r) => r.id === range) ?? opts.find((r) => r.id === defaultRange[gran])
  const start = Math.max(0, all.length - opt.count)
  const points = all.slice(start).map((p, i) => {
    const prev = all[start + i - 1] // the period before the window, when it exists
    const deltas = Object.fromEntries(historySeries.map((s) => [s.key, prev ? p[s.key] - prev[s.key] : null]))
    const prevs = Object.fromEntries(historySeries.map((s) => [s.key, prev ? prev[s.key] : null]))
    return { ...p, delta: deltas[focal], deltas, prevs }
  })
  const youHidden = compare && hidden.includes(focal)
  const series = (compare ? historySeries.filter((s) => !hidden.includes(s.key)) : historySeries.filter((s) => s.key === focal))
    .sort((a, b) => (b.key === focal) - (a.key === focal)) // focal brand first (legend, bars, tooltip)

  // Growth view: change vs the previous period, per visible series. Periods with no previous period are omitted.
  const growthPoints = points
    .filter((p) => p.delta != null)
    .map((p) => ({ date: p.date, ...Object.fromEntries(series.map((s) => [s.key, p.deltas[s.key]])), prevs: p.prevs, values: p }))
  const maxAbs = Math.max(1, ...growthPoints.flatMap((p) => series.map((s) => Math.abs(p[s.key]))))
  const gStep = maxAbs + 1 <= 3 ? 1 : 2
  const gLim = Math.ceil((maxAbs + 1) / gStep) * gStep // symmetric, whole numbers, on the tick grid
  const growth = {
    points: growthPoints,
    domain: [-gLim, gLim],
    ticks: Array.from({ length: (gLim * 2) / gStep + 1 }, (_, i) => -gLim + i * gStep),
    // the focal brand's average growth (read from the raw deltas, so it exists even when it is hidden)
    average: growthPoints.length ? Math.round((growthPoints.reduce((a, p) => a + p.values.delta, 0) / growthPoints.length) * 10) / 10 : 0,
  }
  const you = points.map((p) => p[focal]).filter((v) => v != null)
  const last = points[points.length - 1] || {}
  const valued = points.filter((p) => p[focal] != null)
  const best = valued.reduce((a, p) => (p[focal] > a[focal] ? p : a), valued[0] || null)
  const unit = gran === 'monthly' ? 'month' : 'week'
  // competitors alone sit at 3–21%: on 0–100 they'd be flat lines along the floor, so fit them
  const axis = !compare ? fitDomain(you.length ? you : [0])
    : youHidden ? fitDomain(points.flatMap((p) => series.map((s) => p[s.key])).filter((v) => v != null).concat(points.length ? [] : [0]))
    : { domain: [0, 100], ticks: [0, 25, 50, 75, 100] }
  return {
    granularity: gran,
    range: opt.id,
    points,
    series,
    youHidden,
    ...axis,
    growth,
    stats: {
      current: last[focal] ?? null,
      change: last.delta ?? null,
      unit,
      best: best ? best[focal] : null,
      bestLabel: !best ? null : best === last ? `this ${unit}` : gran === 'monthly' ? best.date : `${best.date}, 2026`,
      average: you.length ? Math.round(you.reduce((a, b) => a + b, 0) / you.length) : null,
    },
  }
}

export const historySeries = [
  { key: 'dermasuri', label: 'dermasuri.com' },
  { key: 'cerave', label: 'cerave.com' },
  { key: 'ordinary', label: 'theordinary.com' },
  { key: 'paulas', label: 'paulaschoice.com' },
]

export const platforms = [
  { id: 'chatgpt', name: 'ChatGPT', visible: 54, cited: 4 },
  { id: 'aio', name: 'AI Overview', visible: 111, cited: 30 },
  { id: 'gemini', name: 'Gemini', visible: 90, cited: 1 },
  { id: 'claude', name: 'Claude', visible: 0, cited: 0 },
  { id: 'grok', name: 'Grok', visible: 0, cited: 0 },
]

// ---- filler generation (deterministic) ----
const topics = [
  'niacinamide serum', 'vitamin C serum', 'retinol for beginners', 'sunscreen for oily skin',
  'hyaluronic acid moisturizer', 'acne scar treatment', 'dark spot corrector', 'gentle cleanser',
  'ceramide cream', 'pigmentation serum', 'under eye cream', 'exfoliating toner',
  'salicylic acid face wash', 'barrier repair cream', 'tinted sunscreen', 'night cream for dry skin',
]
const frames = [
  (t) => `best ${t} for everyday use`,
  (t) => `which ${t} is good for sensitive skin`,
  (t) => `${t} for dermatologist recommended brands`,
  (t) => `affordable ${t} that actually works`,
  (t) => `is ${t} safe for daily use`,
  (t) => `top rated ${t} 2026`,
  (t) => `${t} vs alternatives comparison`,
]
const fillerPrompt = (i) => frames[i % frames.length](topics[(i * 5) % topics.length])
const syncDates = ['Oct 5, 2026', 'Sep 28, 2026', 'Sep 21, 2026', 'Sep 16, 2026', 'Sep 7, 2026', 'Aug 31, 2026']
const fill = (seed, n, make) => Array.from({ length: n }, (_, i) => make(seed + i))

// PLACEHOLDER: replace these 10 with the rows in the screenshot.
const visibleTop = [
  { prompt: 'best niacinamide serum for oily skin', firstVisible: 'Sep 7, 2026' },
  { prompt: 'dermatologist recommended sunscreen', firstVisible: 'Sep 7, 2026' },
  { prompt: 'vitamin c serum for dark spots', firstVisible: 'Sep 7, 2026' },
  { prompt: 'best moisturizer for acne prone skin', firstVisible: 'Sep 16, 2026' },
  { prompt: 'how to reduce pigmentation naturally', firstVisible: 'Sep 16, 2026' },
  { prompt: 'retinol serum for beginners', firstVisible: 'Sep 16, 2026' },
  { prompt: 'gentle face wash for sensitive skin', firstVisible: 'Sep 21, 2026' },
  { prompt: 'best under eye cream for dark circles', firstVisible: 'Sep 21, 2026' },
  { prompt: 'ceramide moisturizer for dry skin', firstVisible: 'Sep 28, 2026' },
  { prompt: 'sunscreen without white cast', firstVisible: 'Oct 5, 2026' },
]
export const visiblePrompts = [
  ...visibleTop,
  ...fill(0, 111 - visibleTop.length, (i) => ({ prompt: fillerPrompt(i), firstVisible: syncDates[i % 5] })),
].map((r, id) => ({ id, ...r, discovery: 'google' }))

// ---------------------------------------------------------------------------
// Missed prompts: an action list. Everything below is mock, generated
// deterministically (seeded) so screenshots are reproducible.
// ---------------------------------------------------------------------------

// tiny seeded PRNG so the mock never changes between reloads
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(41)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const sample = (arr, n) => [...arr].sort(() => rand() - 0.5).slice(0, n)

// last 8 syncs, oldest → newest (same dates as the sync history table)
export const recentSyncs = ['Aug 17, 2026', 'Aug 24, 2026', 'Aug 31, 2026', 'Sep 7, 2026', 'Sep 16, 2026', 'Sep 21, 2026', 'Sep 28, 2026', 'Oct 5, 2026']

// brands that win the answers instead of Dermasuri: the 3 tracked competitors first
export const brands = {
  'cerave.com': { name: 'CeraVe' },
  'theordinary.com': { name: 'The Ordinary' },
  'paulaschoice.com': { name: 'Paula’s Choice' },
  'lumiere-labs.com': { name: 'Lumière Labs' },
  'dewdrop-skin.com': { name: 'Dewdrop' },
}
const brandWeights = ['cerave.com', 'cerave.com', 'cerave.com', 'theordinary.com', 'theordinary.com', 'paulaschoice.com', 'lumiere-labs.com', 'dewdrop-skin.com']

// logos stored for a brand or marketplace, by domain (Setup uploads); SiteLogo falls back to the favicon, then the initial.
// None stored in this demo.
export const brandLogos = {}

// platform ids match PlatformIcon (google = AI Overview)
export const platformNames = { google: 'Google AI Overview', chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude', grok: 'Grok' }

const topicOf = (p) =>
  /blush|highlighter|cheek tint/.test(p) ? 'Makeup'
  : /hair|scrunchie/.test(p) ? 'Hair'
  : /skincare brands|clean beauty/.test(p) ? 'Clean beauty'
  : /eye|lip/.test(p) ? 'Eye & lip'
  : /body/.test(p) ? 'Body care'
  : /sunscreen|spf/.test(p) ? 'Sunscreen'
  : /acne|salicylic|azelaic|rosacea/.test(p) ? 'Acne'
  : /pigment|dark spot|kojic|arbutin|tranexamic/.test(p) ? 'Pigmentation'
  : /cleanser|face wash|toner/.test(p) ? 'Cleansers'
  : /serum|retinol|peptide/.test(p) ? 'Serums'
  : 'Moisturizers'

const topicDetails = {
  Sunscreen: { product: 'SPF 50 gel sunscreen', claim: 'leaves no white cast on deeper skin tones', ingredient: 'broad-spectrum filters like Tinosorb', slug: 'sunscreen',
    angle: 'Show lab-verified SPF 50 / PA++++ results and a no-white-cast swatch test on deeper skin tones (Fitzpatrick IV–VI), with a dermatologist quote on daily reapplication.' },
  Serums: { product: 'serum', claim: 'is gentle enough for daily use', ingredient: 'a stable, clinically-dosed active', slug: 'serums',
    angle: 'Publish a concentration-and-pH comparison against the top 3 serums AI cites, with a 4-week before/after diary and clear "who it is not for" guidance.' },
  Acne: { product: 'acne treatment', claim: 'calms breakouts without over-drying', ingredient: 'azelaic or salicylic acid', slug: 'acne',
    angle: 'Write a dermatologist-reviewed routine guide for acne-prone skin, naming the exact percentage of each active and how to introduce it without purging.' },
  Pigmentation: { product: 'pigmentation serum', claim: 'fades dark spots in 8–12 weeks', ingredient: 'tranexamic acid, kojic acid or alpha arbutin', slug: 'pigmentation',
    angle: 'Create an evidence-led explainer comparing tranexamic acid, alpha arbutin and kojic acid for melasma and PIH, with a realistic 12-week timeline.' },
  Cleansers: { product: 'gentle cleanser', claim: 'keeps the skin barrier intact', ingredient: 'a low-pH, sulfate-free base', slug: 'cleansers',
    angle: 'Publish a pH-tested cleanser roundup (with Dermasuri’s pH on the label) and a short video of the after-wash tightness test.' },
  Moisturizers: { product: 'barrier cream', claim: 'repairs a damaged moisture barrier', ingredient: 'ceramides, cholesterol and fatty acids in a 3:1:1 ratio', slug: 'moisturizers',
    angle: 'Explain barrier repair with the ceramide ratio front and centre, plus a humid-vs-dry climate routine that AI answers can quote directly.' },
  'Eye & lip': { product: 'treatment balm', claim: 'visibly brightens within a month', ingredient: 'niacinamide and caffeine', slug: 'eye-lip',
    angle: 'Answer the question directly in the first paragraph, then back it with a small consumer study and ingredient-by-ingredient breakdown.' },
  Makeup: { product: 'cheek tint', claim: 'blends well on medium to deep skin tones', ingredient: 'buildable, skin-safe pigments', slug: 'makeup',
    angle: 'Show swatches across light to deep skin tones and pair the product with a skincare-first claim (non-comedogenic, dermatologist tested) the competitor can’t match.' },
  Hair: { product: 'hair accessory', claim: 'avoids breakage on curly hair', ingredient: 'satin or silk', slug: 'hair',
    angle: 'Off-category for Dermasuri: only target it with a scalp-care angle, otherwise mark as not relevant.' },
  'Clean beauty': { product: 'skincare range', claim: 'uses clean, vegan formulas', ingredient: 'fragrance-free, vegan-certified ingredients', slug: 'clean-beauty',
    angle: 'Publish a transparent full-ingredient page with certifications and a “what we leave out” list that AI answers can cite verbatim.' },
  'Body care': { product: 'body lotion', claim: 'smooths rough, bumpy skin', ingredient: 'urea and lactic acid', slug: 'body-care',
    angle: 'Target the condition by name (keratosis pilaris) with a clinical-style FAQ and a weekly exfoliation schedule.' },
}

const publishers = ['skinwiki.org', 'dermdaily.com', 'beautyedit.co', 'thecosmeticchemist.blog']
const publisherPaths = (slug) => [`/guides/best-${slug}`, `/reviews/${slug}-2026`, `/ingredients/${slug}-explained`, `/top-picks/${slug}`]

function answerFor(prompt, topic, winners) {
  const d = topicDetails[topic]
  const [a, b, c] = winners.map((w) => brands[w].name)
  if (!a) {
    return `There is no single brand that stands out for "${prompt}". Dermatologists generally suggest looking for ${d.ingredient}, choosing a fragrance-free formula, and patch testing for a week before full use. A product that ${d.claim} tends to be rated highest in reviews, but results vary by skin type, climate and how consistently the routine is followed. If irritation persists, a consultation with a dermatologist is recommended before adding more actives.`
  }
  return `For "${prompt}", the most frequently recommended option is ${a}'s ${d.product}, which reviewers say ${d.claim} and is formulated with ${d.ingredient}. ${b ? `${b} is often mentioned as a close alternative, especially for sensitive or combination skin, and is praised for its lightweight texture and fair pricing. ` : ''}${c ? `Some sources also point to ${c} as a budget pick, though it has fewer clinical claims. ` : ''}When choosing, look for ${d.ingredient}, avoid added fragrance, and introduce any new product slowly. Most users report visible results after four to eight weeks of consistent use, and patch testing is advised before applying to the whole face.`
}

// PLACEHOLDER: the first 10 prompts mirror the live-site screenshot rows.
const missedTopPrompts = [
  'best azelaic acid cream for rosacea',
  'kojic acid soap benefits',
  'alpha arbutin serum review',
  'best spf 50 gel sunscreen',
  'peptide serum for wrinkles',
  'how to fix damaged skin barrier',
  'best lip balm for pigmented lips',
  'tranexamic acid serum for melasma',
  'body lotion for keratosis pilaris',
  'best face mist for dry skin',
]
// fillers use their own phrasings so they never repeat a visible prompt
const missedFrames = [
  (t) => `how to use ${t} in a routine`,
  (t) => `${t} for humid weather`,
  (t) => `${t} under $15`,
  (t) => `can ${t} cause breakouts`,
  (t) => `${t} for teenagers`,
]
const visibleTexts = new Set(visiblePrompts.map((r) => r.prompt))
const missedTexts = [...missedTopPrompts]
// bounded: 5 frames × 16 topics = 80 candidates, we need 31
for (let i = 0; i < missedFrames.length * topics.length && missedTexts.length < 41; i++) {
  const t = missedFrames[i % missedFrames.length](topics[(i * 3) % topics.length])
  if (!visibleTexts.has(t) && !missedTexts.includes(t)) missedTexts.push(t)
}

// some prompts already have content work in flight
const initialStatus = { 3: 'in_progress', 5: 'in_progress', 12: 'in_progress', 7: 'waiting', 18: 'waiting', 9: 'published' }

export const missedPrompts = missedTexts.map((prompt, id) => {
  const topic = topicOf(prompt)
  // 1 in 8 prompts was first tracked this sync; the rest have a missing streak of 1–8
  const isNew = id > 0 && id % 8 === 0
  const streak = isNew ? 1 : 1 + Math.floor(rand() * 8)
  const history = recentSyncs.map((_, i) => {
    const fromEnd = recentSyncs.length - 1 - i
    if (isNew) return fromEnd === 0 ? 'missed' : null
    if (fromEnd < streak) return 'missed'
    if (fromEnd === streak) return 'visible' // the sync right before the streak was a hit: a near miss
    return rand() < 0.55 ? 'visible' : 'missed'
  })
  const nWinners = rand() < 0.12 ? 0 : 1 + Math.floor(rand() * (rand() < 0.2 ? 5 : 3))
  // 1–3 winners lean on the tracked competitors; 4–5 means the whole field beats us
  const winners = nWinners >= 4
    ? sample(Object.keys(brands), nWinners)
    : [...new Set(Array.from({ length: nWinners * 2 }, () => pick(brandWeights)))].slice(0, nWinners)
  const platforms = ['google', ...sample(['chatgpt', 'gemini', 'claude'], Math.floor(rand() * 3))]
  const d = topicDetails[topic]
  return {
    id,
    prompt,
    topic,
    discovery: 'google',
    platforms, // where Dermasuri is missing
    competitors: winners,
    streak,
    firstSeen: isNew ? recentSyncs[7] : recentSyncs[Math.max(0, 7 - streak - 2)],
    history,
    answer: answerFor(prompt, topic, winners),
    brandsMentioned: winners.map((domain) => {
      const seen = platforms.filter(() => rand() < 0.75)
      return { domain, platforms: seen.length ? seen : ['google'] }
    }),
    sources: [
      ...winners.slice(0, 2).map((w) => ({ domain: w, path: `/blog/${d.slug}-guide` })),
      ...sample(publishers, 2).map((p, i) => ({ domain: p, path: publisherPaths(d.slug)[(id + i) % 4] })),
    ],
    angle: d.angle,
    status: initialStatus[id] ?? null,
  }
})

export const missedTopics = Object.entries(
  missedPrompts.reduce((acc, r) => ({ ...acc, [r.topic]: (acc[r.topic] ?? 0) + 1 }), {}),
).sort((a, b) => b[1] - a[1])

// Recovered loop: briefs that were published and whose prompt then showed up as visible in a later sync.
export const publishedContent = [
  { prompt: 'best vitamin c serum for glowing skin', publishedOn: 'Sep 24, 2026' },
  { prompt: 'spf 50 sunscreen for sensitive skin', publishedOn: 'Sep 26, 2026' },
]
{
  // swap two of the latest-sync visible fillers for the recovered prompts (count stays 111)
  const slots = visiblePrompts.filter((r) => r.id >= 10 && r.firstVisible === 'Oct 5, 2026').slice(0, publishedContent.length)
  slots.forEach((r, i) => { r.prompt = publishedContent[i].prompt })
}

// Latest sync (Oct 5 vs Sep 28), live product values: 14 prompts gained, 4 lost.
// gained = visible prompts first seen this sync (the "New" / "Recovered" tags); lost = missed prompts
// that were visible last sync. Trim the generated data to exactly those counts so the Sync history
// lists and the filtered Visible / Missed tables always agree.
const SYNC_GAINED = 14
const SYNC_LOST = 4
const wasLostThisSync = (r) => r.history.at(-2) === 'visible' && r.history.at(-1) === 'missed'
{
  // keep the curated + recovered rows; move the surplus fillers back one sync
  const recovered = new Set(publishedContent.map((p) => p.prompt))
  const latest = visiblePrompts.filter((r) => r.firstVisible === account.lastSync)
  latest.filter((r) => r.id >= visibleTop.length && !recovered.has(r.prompt))
    .slice(0, Math.max(0, latest.length - SYNC_GAINED))
    .forEach((r) => { r.firstVisible = recentSyncs.at(-2) })

  const setStreak = (r, n) => {
    r.streak = n
    for (let k = 1; k <= n; k++) r.history[r.history.length - k] = 'missed'
    r.history[r.history.length - 1 - n] = 'visible'
    r.firstSeen = recentSyncs[Math.max(0, recentSyncs.length - 1 - n - 2)]
  }
  // lost: three prompts a competitor took, plus one where no brand is cited any more ("Dropped").
  // Topped up from older misses if the generated data flipped too few (shuffle order varies by engine).
  const tracked = (r) => r.history.at(-2) !== null // not first seen this sync
  const flipped = missedPrompts.filter(wasLostThisSync)
  const taken = flipped.filter((r) => r.competitors.length).slice(0, SYNC_LOST - 1)
  for (const r of missedPrompts) {
    if (taken.length >= SYNC_LOST - 1) break
    if (r.competitors.length && tracked(r) && !taken.includes(r)) taken.push(r)
  }
  const dropped = missedPrompts.find((r) => !r.competitors.length && tracked(r) && !taken.includes(r))
  flipped.filter((r) => !taken.includes(r) && r !== dropped).forEach((r) => setStreak(r, 2)) // flipped a week earlier instead
  ;[...taken, dropped].forEach((r) => setStreak(r, 1))
}

// PLACEHOLDER: replace these 10 with the rows in the screenshot.
const competitorTop = [
  { prompt: 'best korean sunscreen for oily skin', competitor: 'cerave.com' },
  { prompt: 'vegan skincare brands', competitor: 'cerave.com' },
  { prompt: 'best blush for brown skin', competitor: 'paulaschoice.com' },
  { prompt: 'glow serum for dull skin', competitor: 'theordinary.com' },
  { prompt: 'clean beauty moisturizer', competitor: 'cerave.com' },
  { prompt: 'hair scrunchies for curly hair', competitor: 'paulaschoice.com' },
  { prompt: 'best highlighter for everyday', competitor: 'theordinary.com' },
  { prompt: 'face oil for combination skin', competitor: 'cerave.com' },
  { prompt: 'bakuchiol serum alternative to retinol', competitor: 'cerave.com' },
  { prompt: 'cheek tint for natural look', competitor: 'theordinary.com' },
]

// Competitor prompts: per-competitor totals 22 / 10 / 7, with new wins this sync 3 / 0 / 1.
// "You" is derived from the visible list: if Dermasuri is visible for the prompt it's "Also cited", else "Missing".
const crand = mulberry32(39)
const cpick = (arr) => arr[Math.floor(crand() * arr.length)]
const fillerDomains = [
  ...Array(17).fill('cerave.com'), ...Array(7).fill('theordinary.com'), ...Array(5).fill('paulaschoice.com'),
].sort(() => crand() - 0.5)
const newWins = new Set(['best korean sunscreen for oily skin', 'bakuchiol serum alternative to retinol', 'best blush for brown skin'])
const stop = new Set(['best', 'for', 'in', 'the', 'a', 'is', 'which', 'that', 'to', 'vs', 'and', 'top', 'rated', 'affordable', 'actually', 'works', 'good', 'safe', 'daily', 'use', '2026'])
const slugOf = (p) => p.toLowerCase().split(/\W+/).filter((w) => w && !stop.has(w)).slice(0, 3).join('-')
const titleCase = (p) => p.replace(/\b\w/g, (c) => c.toUpperCase())

export const competitorPrompts = [
  ...competitorTop,
  ...fill(400, 39 - competitorTop.length, (i) => ({ prompt: fillerPrompt(i), competitor: fillerDomains[i - 400] })),
].map((r, id) => {
  const topic = topicOf(r.prompt)
  const you = visibleTexts.has(r.prompt) ? 'cited' : 'missing'
  // one extra cerave new win among the fillers so the totals read ▲3
  const isNew = newWins.has(r.prompt) || (r.competitor === 'cerave.com' && id === 12)
  const streak = isNew ? 1 : 2 + Math.floor(crand() * 7)
  const brand = brands[r.competitor].name
  const slug = slugOf(r.prompt)
  const them = recentSyncs.map((_, i) => {
    const fromEnd = recentSyncs.length - 1 - i
    if (isNew) return fromEnd === 0 // first won this sync: no earlier wins
    return fromEnd < streak ? true : fromEnd === streak ? false : crand() < 0.4
  })
  const youHistory = recentSyncs.map((_, i) => (i === recentSyncs.length - 1 ? you === 'cited' : you === 'cited' ? crand() < 0.8 : crand() < 0.2))
  const hasPage = you === 'cited' || crand() < 0.4
  return {
    id,
    ...r,
    topic,
    discovery: 'google',
    platforms: ['google', ...['chatgpt', 'gemini'].filter(() => crand() < 0.45)],
    isNew,
    streak, // consecutive syncs the competitor has won this prompt
    you, // 'cited' | 'missing'
    theirPage: { domain: r.competitor, path: `/blog/${slug}-guide`, title: `${titleCase(r.prompt)}: the ${brand} guide`, lastSeen: recentSyncs[7] },
    yourPage: hasPage ? { domain: 'dermasuri.com', path: `/journal/${slug}`, title: `${titleCase(r.prompt)} | Dermasuri`, cited: you === 'cited' } : null,
    history: { them, you: youHistory },
    answer: `For "${r.prompt}", ${brand} is the most cited choice: its guide covers ${topicDetails[topic].ingredient} and says the product ${topicDetails[topic].claim}. ` +
      (you === 'cited'
        ? `Dermasuri is also mentioned as a dermatologist-backed alternative, though usually second and with less detail. `
        : `Other options are listed briefly, but no dermatologist-led brand is named. `) +
      `Reviewers highlight texture, price and how quickly results show, and most answers link straight to ${brand}'s page as the main source.`,
    angle: topicDetails[topic].angle,
    tracked: r.prompt === 'glow serum for dull skin',
  }
})

// per-competitor counts + new wins this sync, sorted by count (feeds the tabs and the alert)
export const competitorSummary = Object.entries(
  competitorPrompts.reduce((acc, r) => {
    const c = (acc[r.competitor] ??= { total: 0, newWins: 0 })
    c.total++
    if (r.isNew) c.newWins++
    return acc
  }, {}),
).map(([domain, c]) => ({ domain, ...c })).sort((a, b) => b.total - a.total)

const SYNC_PLATFORMS = ['aio', 'gemini', 'chatgpt', 'claude', 'grok'] // display order
const srand = mulberry32(440)
// PLACEHOLDER: the first 5 scores come from the weekly history; everything else must be
// replaced with the exact screenshot values.
export const syncHistory = [
  { date: 'Oct 5, 2026', visibility: 73, mentions: 111, cited: 30, visible: 111, missed: 41, delta: 6 },
  { date: 'Sep 28, 2026', visibility: 67, mentions: 102, cited: 27, visible: 102, missed: 50, delta: -4 },
  { date: 'Sep 21, 2026', visibility: 71, mentions: 108, cited: 29, visible: 108, missed: 44, delta: -3 },
  { date: 'Sep 16, 2026', visibility: 74, mentions: 112, cited: 31, visible: 112, missed: 40, delta: 3 },
  { date: 'Sep 7, 2026', visibility: 71, mentions: 108, cited: 28, visible: 108, missed: 44, delta: 2 },
  { date: 'Aug 31, 2026', visibility: 69, mentions: 105, cited: 26, visible: 105, missed: 47, delta: 1 },
  { date: 'Aug 24, 2026', visibility: 68, mentions: 103, cited: 25, visible: 103, missed: 49, delta: -2 },
  { date: 'Aug 17, 2026', visibility: 70, mentions: 106, cited: 27, visible: 106, missed: 46, delta: 4 },
  { date: 'Aug 10, 2026', visibility: 66, mentions: 100, cited: 24, visible: 100, missed: 52, delta: 0 },
  { date: 'Aug 3, 2026', visibility: 66, mentions: 100, cited: 23, visible: 100, missed: 52, delta: -1 },
].map((r, i) => {
  const total = r.visible + r.missed
  return {
    ...r,
    id: i,
    total,
    // per-platform breakdown (Sync history mini bars + expanded row; Platform visibility history).
    // Mention % wanders ±5 around today's platform values; the latest sync is exact so it matches
    // Platform visibility, and platforms at 0% stay at 0.
    breakdown: SYNC_PLATFORMS.map((id) => {
      const p = platforms.find((x) => x.id === id)
      const base = Math.round((p.visible / total) * 100)
      const mentionPct = i === 0 || base === 0 ? base : Math.min(100, Math.max(0, base + Math.round(srand() * 10 - 5)))
      const cited = i === 0 ? p.cited : p.cited === 0 ? 0 : Math.max(0, Math.round(p.cited * (r.cited / 30)))
      return { id, platform: p.name, mentionPct, citedPct: Math.round((cited / total) * 100), visible: i === 0 ? p.visible : Math.round((mentionPct / 100) * total), cited }
    }),
  }
})
export const syncTotal = 40

// Sync history expanded rows: deltas vs the previous sync + the prompts gained / lost.
// Latest sync = live product values; older syncs are generated, smaller, and keep
// gained − lost = the change in visible prompts. Prompt ids point into visiblePrompts (gained)
// and missedPrompts (lost) so "+N more" can filter those tables.
{
  const crand = mulberry32(512)
  const gainedLatest = visiblePrompts.filter((r) => r.firstVisible === account.lastSync)
  const lostLatest = missedPrompts.filter(wasLostThisSync)
  // pools for older syncs: everything not already used by the latest one, handed out in turn
  const gPool = visiblePrompts.filter((r) => !gainedLatest.includes(r))
  const lPool = missedPrompts.filter((r) => !lostLatest.includes(r))
  let gi = 0, li = 0
  const take = (pool, n, at) => Array.from({ length: n }, (_, k) => pool[(at + k) % pool.length])
  const item = (r) => ({ id: r.id, prompt: r.prompt })
  const short = (d) => d.replace(/, \d{4}$/, '')
  syncHistory.forEach((r, i) => {
    const prev = syncHistory[i + 1]
    if (!prev) { r.changes = null; return } // oldest sync in the mock: nothing to compare against
    if (i === 0) {
      r.changes = { vs: short(prev.date), deltas: { mentions: 16, citedPages: 10, missed: -9 }, gained: gainedLatest.map(item), lost: lostLatest.map(item) }
      return
    }
    const dVisible = r.visible - prev.visible
    const lostN = 1 + Math.floor(crand() * 3)
    const gainedN = Math.max(1, lostN + dVisible) // even a bad sync picks up a prompt or two
    const lostFinal = gainedN - dVisible // keeps gained − lost = dVisible when gained hits its floor
    const gained = take(gPool, gainedN, gi).map(item); gi += gainedN
    const lost = take(lPool, lostFinal, li).map(item); li += lostFinal
    r.changes = {
      vs: short(prev.date),
      deltas: {
        mentions: dVisible + Math.round(crand() * 4), // mentions also count repeat platforms, so they run a little ahead
        citedPages: (r.cited - prev.cited) + Math.round(crand() * 2),
        missed: -dVisible,
      },
      gained,
      lost,
    }
  })
}

// ---------------------------------------------------------------------------
// Platform visibility: derived from the sync history breakdown above, so the
// cards, sparklines and deltas always agree with the rest of the dashboard.
// ---------------------------------------------------------------------------
const platformByName = Object.fromEntries(platforms.map((p) => [p.name, p.id]))
const last8 = syncHistory.slice(0, 8).reverse() // oldest → newest
export const platformStats = platforms.map((p) => ({
  ...p,
  total: kpis.total,
  history: last8.map((s) => {
    const b = s.breakdown.find((x) => platformByName[x.platform] === p.id)
    return { date: s.date, visible: b.visible, cited: b.cited, total: s.visible + s.missed }
  }),
}))

// Which platforms each visible prompt shows up on (AI Overview has all 111; Gemini 90; ChatGPT 54).
{
  const prand = mulberry32(152)
  const pickIds = (n) => new Set([...visiblePrompts.map((r) => r.id)].sort(() => prand() - 0.5).slice(0, n))
  const counts = Object.fromEntries(platforms.map((p) => [p.id, p.visible]))
  const chosen = Object.fromEntries(Object.entries(counts).map(([id, n]) => [id, n >= visiblePrompts.length ? null : pickIds(n)]))
  visiblePrompts.forEach((r) => {
    r.platforms = platforms
      .filter((p) => p.visible > 0 && (chosen[p.id] === null || chosen[p.id].has(r.id)))
      .map((p) => (p.id === 'aio' ? 'google' : p.id))
  })
}

// Top cited pages: Dermasuri URLs cited in the latest sync. Counts = prompts citing the page, summing to the
// sync's 30 citations; deltas sum to +3 (27 → 30). Platforms follow the per-platform cited counts:
// AI Overview cites in all 30 prompts, ChatGPT in 4, Gemini in 1.
export const citedPages = [
  { path: '/products/vitamin-c-serum', count: 9, delta: 3, platforms: ['google', 'chatgpt', 'gemini'] },
  { path: '/blog/sunscreen-without-white-cast', count: 7, delta: 2, platforms: ['google', 'chatgpt'] },
  { path: '/products/ceramide-barrier-cream', count: 5, delta: 0, platforms: ['google', 'chatgpt'] },
  { path: '/blog/retinol-for-beginners', count: 4, delta: -1, platforms: ['google', 'chatgpt'] },
  { path: '/collections/serums', count: 3, delta: 1, platforms: ['google'] },
  { path: null, label: '2 other pages', count: 2, delta: -2, platforms: [] },
]
// the "2 other pages" above, one by one (Top cited pages lists them when the card has room)
export const citedPagesOther = [
  { path: '/blog/ceramides-explained', count: 1, delta: -1, platforms: ['google'] },
  { path: '/products/lip-balm-spf', count: 1, delta: -1, platforms: ['google'] },
]

// ---------------------------------------------------------------------------
// Marketplace visibility: how each tracked prompt's AI answer links to Amazon or Target.
// yours = cites Dermasuri's own listing; others = someone else's listing or a category page;
// none = no marketplace cited at all. yours + others + none = every tracked prompt (152).
// Target 12 + Amazon 8 = 20 listings across 18 prompts (2 prompts link to both).
// ---------------------------------------------------------------------------
const YOU = brandName(account.domain) // "Dermasuri": the account's own segment is named after the brand
const MARKET_TOTAL = visiblePrompts.length + missedPrompts.length // = trackedPrompts.length (built from these below)
const MARKET_YOURS = 18
const MARKET_OTHERS = [{ label: 'cerave.com', value: 41 }, { label: 'theordinary.com', value: 29 }, { label: 'paulaschoice.com', value: 18 }, { label: 'Category pages', icon: 'category', value: 24, muted: true }]
const MARKET_OTHERS_N = MARKET_OTHERS.reduce((n, r) => n + r.value, 0) // 112
const MARKET_NONE = MARKET_TOTAL - MARKET_YOURS - MARKET_OTHERS_N // 22
export const marketplace = {
  total: MARKET_TOTAL,
  cited: MARKET_YOURS + MARKET_OTHERS_N, // 130
  yours: MARKET_YOURS,
  both: 2,
  lastChecked: '16:52',
  segments: [
    { key: 'yours', label: YOU, count: MARKET_YOURS, color: 'var(--donut-yours)',
      headline: `link to a ${YOU} listing`,
      breakdownTitle: 'By marketplace',
      rows: [{ label: 'Target', icon: 'target', domain: 'target.com', value: 12 },
             { label: 'Amazon', icon: 'amazon', domain: 'amazon.com', value: 8 }],
      note: '2 prompts link to both',
      action: { label: `View ${MARKET_YOURS} prompts`, filter: 'yours' } },
    // every marketplace citation, yours included: the slice is the others (112), the panel counts all of them (130)
    // and lights both slices. Rows: you first, then who gets the link instead.
    { key: 'others', label: 'Marketplace citations', count: MARKET_OTHERS_N, panelCount: MARKET_YOURS + MARKET_OTHERS_N, color: 'var(--donut-others)',
      highlight: ['yours', 'others'],
      headline: 'marketplace links',
      breakdownTitle: 'Who gets the link',
      rows: [{ label: account.domain, value: MARKET_YOURS, you: true }, ...MARKET_OTHERS],
      action: { label: `View ${MARKET_OTHERS_N} prompts`, filter: 'others' } },
    { key: 'none', label: 'No marketplace', count: MARKET_NONE, color: 'var(--donut-none)',
      headline: 'cite no marketplace at all',
      breakdownTitle: 'What AI cites instead',
      rows: [{ label: 'Brand websites', icon: 'web', value: MARKET_NONE - 12 },
             { label: 'Review sites', icon: 'reviews', value: 7 },
             { label: 'Reddit & forums', icon: 'forums', value: 5 }],
      action: { label: `View ${MARKET_NONE} prompts`, filter: 'none' } },
  ],
}

{
  const mrand = mulberry32(130)
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(mrand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
  const products = ['niacinamide serum', 'vitamin C serum', 'gel sunscreen SPF 50', 'ceramide moisturizer', 'retinol night cream', 'salicylic face wash',
    'under eye cream', 'hyaluronic serum', 'dark spot corrector', 'barrier repair cream', 'tinted sunscreen', 'exfoliating toner', 'lip balm SPF', 'body lotion with urea']
  const frames = [
    (p) => `buy ${p} online`, (p) => `${p} best price`, (p) => `${p} on Amazon`, (p) => `where to buy ${p}`,
    (p) => `${p} reviews and ratings`, (p) => `best rated ${p} under $20`, (p) => `${p} for sensitive skin to buy`,
    (p) => `dermatologist ${p} in stock`, (p) => `${p} gift set`, (p) => `${p} bundle deal`, (p) => `is ${p} worth it`, (p) => `${p} for oily skin`,
  ]
  const texts = shuffle(frames.flatMap((f) => products.map(f))).slice(0, marketplace.total)
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const host = { Amazon: 'amazon.com', Target: 'target.com' }

  // one "who/what gets cited" bucket per prompt, straight from the segment breakdowns
  const seg = Object.fromEntries(marketplace.segments.map((x) => [x.key, x]))
  // yours: 10 Target-only, 6 Amazon-only, 2 both → Target 12, Amazon 8 listings over 18 prompts
  const yourMarkets = [...Array(10).fill(['Target']), ...Array(6).fill(['Amazon']), ['Target', 'Amazon'], ['Target', 'Amazon']]
  const buckets = shuffle([
    ...yourMarkets.map((markets) => ({ result: 'yours', markets, source: 'dermasuri' })),
    ...seg.others.rows.filter((r) => !r.you).flatMap((r) => Array(r.value).fill(r.label)).map((label) =>
      label === 'Category pages'
        ? { result: 'category', source: 'category' }
        : { result: 'competitor', source: label.replace('.com', ''), brand: label }),
    ...seg.none.rows.flatMap((r) => Array(r.value).fill(r.label)).map((label) => ({ result: 'none', source: label })),
  ])
  const NONE_SITES = {
    'Brand websites': ['cerave.com', 'theordinary.com', 'paulaschoice.com', 'dermasuri.com'],
    'Review sites': ['byrdie.com', 'allure.com', 'healthline.com'],
    'Reddit & forums': ['reddit.com'],
  }

  marketplace.prompts = texts.map((prompt, id) => {
    const b = buckets[id]
    const tail = slug(prompt).split('-').slice(-3).join('-')
    if (b.result === 'none') {
      const sites = NONE_SITES[b.source]
      const domain = sites[id % sites.length]
      const path = domain === 'reddit.com' ? `/r/SkincareAddiction/comments/${tail}` : b.source === 'Review sites' ? `/best-${tail}` : `/products/${tail}`
      return { id, prompt, result: 'none', markets: [], cites: b.source, page: { domain, path } }
    }
    const markets = b.markets ?? (mrand() < 0.12 ? ['Amazon', 'Target'] : [mrand() < 0.6 ? 'Amazon' : 'Target'])
    const m = markets[0]
    const item = `${b.source}-${tail}`
    // product page per store (Amazon /dp/…, Target /p/…/-/A-…); category = a search/browse page
    const path = b.result === 'category'
      ? (m === 'Amazon' ? `/s?k=${slug(prompt)}` : `/s/${slug(prompt)}`)
      : (m === 'Amazon' ? `/${item}/dp/B0${7000 + id}` : `/p/${item}/-/A-${81000 + id}`)
    return { id, prompt, result: b.result, markets, ...(b.brand && { brand: b.brand }), page: { domain: host[m], path } }
  })
  // the marketplaces the answers link to, most prompts first (Marketplace visibility subtitle)
  const n = {}
  marketplace.prompts.forEach((r) => r.markets.forEach((m) => { n[m] = (n[m] ?? 0) + 1 }))
  marketplace.stores = Object.keys(n).sort((a, b) => n[b] - n[a])
}

// ---------------------------------------------------------------------------
// /prompts page: every tracked prompt (111 visible + 41 missed = 152, matching the dashboard).
// Adds category, list, status, platforms and the date it was added.
// ---------------------------------------------------------------------------
export const promptLists = ['Manual entry', 'Sunscreen launch', 'Q3 import', 'Competitor gaps']
export const trackedPrompts = (() => {
  const trand = mulberry32(152)
  // weighted toward manual entry; imported lists are smaller
  const pickList = () => { const x = trand(); return x < 0.55 ? 'Manual entry' : x < 0.72 ? 'Q3 import' : x < 0.87 ? 'Sunscreen launch' : 'Competitor gaps' }
  const DAY = 86400000
  const lastSync = Date.parse(account.lastSync)
  // added before the prompt was first seen (or first visible); "Oct 2" style
  const addedBefore = (date) => {
    const t = Date.parse(date) - Math.floor(trand() * 21) * DAY - 2 * DAY
    return new Date(Math.min(t, lastSync)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const visible = visiblePrompts.map((r) => ({
    id: `v${r.id}`, prompt: r.prompt, category: topicOf(r.prompt), list: pickList(), status: 'visible', platforms: r.platforms, added: addedBefore(r.firstVisible),
  }))
  const missed = missedPrompts.map((r) => ({
    // lost = visible in the sync before, missed in the latest one
    id: `m${r.id}`, prompt: r.prompt, category: r.topic, list: pickList(), status: wasLostThisSync(r) ? 'lost' : 'missed', platforms: [], added: addedBefore(r.firstSeen),
  }))
  return [...visible, ...missed]
})()

// Prompt Hub saves: every change on /prompts goes through one of these (the page updates first, then calls it; a
// rejected promise rolls the row back with an inline error). Here they keep the change in memory and resolve.
// can*: which controls the page shows (an app without that save hides the control).
let nextPromptId = 1
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const promptActions = {
  canEditText: true, // edit a prompt's wording
  canManageCategories: true, // rename / delete custom categories
  canRescan: true, // bulk "Rescan"
  canCheckNewPages: true, // research: "Check for new pages"
  canRerunResearch: true, // research: "Re-run research"
  // → { id } of the saved prompt
  async onAddPrompt({ text, category }) {
    await sleep(150)
    const row = { id: `new${nextPromptId++}`, prompt: text, category, list: 'Manual entry', status: 'pending', platforms: [], added: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    trackedPrompts.unshift(row)
    return { id: row.id }
  },
  async onEditPrompt(id, { text, category }) {
    await sleep(150)
    const r = trackedPrompts.find((p) => p.id === id)
    if (r) Object.assign(r, { prompt: text, category })
  },
  async onDeletePrompt(ids) {
    await sleep(150)
    ids.forEach((id) => { const i = trackedPrompts.findIndex((p) => p.id === id); if (i !== -1) trackedPrompts.splice(i, 1) })
  },
  // rows: [{ text, category }] → [{ id } | { error }] in the same order
  async onImportPrompts(rows) {
    return Promise.all(rows.map((r) => promptActions.onAddPrompt(r)))
  },
  // items: research suggestions [{ id, text, category }] → [{ id } | { error }]
  async onAddFromResearch(items) {
    return Promise.all(items.map((r) => promptActions.onAddPrompt(r)))
  },
  async onAddCategory(name) {
    await sleep(150)
    if (!promptCategories.includes(name)) promptCategories.push(name)
  },
  async onRerunResearch() {
    await sleep(600)
  },
}
// Top cited pages → "Not cited yet": Dermasuri pages that match tracked prompts but no AI answer links to.
// relevant = tracked prompts about the page's subject (visible or missed); keys = their tracked ids.
export const uncitedPages = [
  { path: '/products/niacinamide-serum', subject: 'niacinamide serum', match: /niacinamide|oil control/ },
  { path: '/products/spf-50-sunscreen', subject: 'SPF 50 sunscreen', match: /spf|sunscreen/ },
  { path: '/blog/how-to-layer-serums', subject: 'layering serums', match: /serum.*(routine|daily|with)|routine|layer/ },
  { path: '/products/salicylic-face-wash', subject: 'salicylic face wash', match: /salicylic|face wash/ },
  { path: '/blog/under-eye-care-guide', subject: 'under eye care', match: /under eye|dark circles/ },
  { path: '/products/hyaluronic-moisturizer', subject: 'hyaluronic moisturizer', match: /hyaluronic|gel moisturizer/ },
].map(({ match, ...p }) => {
  const keys = trackedPrompts.filter((t) => match.test(t.prompt.toLowerCase())).map((t) => t.id)
  return { ...p, relevant: keys.length, keys }
}).sort((a, b) => b.relevant - a.relevant)

export const promptCategories = [...new Set(trackedPrompts.map((r) => r.category))].sort()
// best-guess category for a newly typed prompt (same keyword rules as the generated data)
export const guessCategory = topicOf

// ---------------------------------------------------------------------------
// Brand Setup (/brands), shaped like the production API. The workspace's brands, the current one first:
//   brand        a project: id, name, domain (primaryDomain), lastSync (its latest scan), prompts (tracked)
//   aliases      project.brandAliases (added and removed in Brand Setup: setupActions.onAddAlias / onRemoveAlias)
//   aliasAnswers answers each alias was counted in (left out when the app can't count them)
//   topics       prompt clusters (GET /projects/:id/prompts/clusters): name, promptCount
//   competitors  approved competitors (GET /projects/:id/competitors/evidence): id, name, domain
//   suggested    research candidates not decided yet (status DISCOVERED): id, name, domain, reason
// MAX_COMPETITORS: how many competitors a brand can track ("3 of 5"); null = no limit
// ---------------------------------------------------------------------------
export const MAX_COMPETITORS = 5

// "Citations and Mentions" card: per brand → per engine [mentions, citations] (engines not listed = 0).
// Totals are always summed from these rows.
export const citationsMentions = {
  'dermasuri.com': { aio: [111, 30], gemini: [90, 2], chatgpt: [54, 4] },
  'cerave.com': { aio: [33, 9], gemini: [23, 3], chatgpt: [18, 2] },
  'theordinary.com': { aio: [8, 2], gemini: [5, 0], chatgpt: [6, 0] },
  'paulaschoice.com': { aio: [6, 1], gemini: [3, 0], chatgpt: [5, 0] },
}

// the agency's other client workspaces (sidebar workspace switcher); not loaded in this demo
// the other brands in the agency (kept for older callers; the switcher uses workspaceDirectory)
export const agencyClients = workspaceDirectory.flatMap((c) => c.brands).filter((b) => b.domain !== account.domain).map((b) => ({ name: b.name, domain: b.domain }))

// answers each alias was counted in (alias chip count)
export const aliasAnswers = { 'Derma Suri': 6 }

// Brand Setup → Topics: the prompt clusters (the Prompt Hub's categories) with their tracked prompts
const setupTopics = promptCategories.map((name) => ({ name, promptCount: trackedPrompts.filter((p) => p.category === name).length }))

// Brand Setup → Marketplaces: the stores the brand sells on, with the listings of it AI answers cited (the
// Marketplace visibility card's "By marketplace" rows)
const setupMarketplaces = marketplace.segments.find((s) => s.key === 'yours').rows.map((r, i) => ({ id: `m${i + 1}`, name: r.label, domain: r.domain, cited: r.value }))

export const setupBrands = [
  {
    id: 'b1', name: account.name, domain: account.domain, type: 'website', lastSync: account.lastSync.replace(/, \d{4}$/, ''), prompts: trackedPrompts.length,
    aliases: ['Derma Suri'],
    aliasAnswers,
    topics: setupTopics,
    competitors: competitors.filter((c) => !c.you).sort((a, b) => b.share - a.share).map((c, i) => ({ id: `c${i + 1}`, name: brands[c.domain]?.name ?? c.domain, domain: c.domain })),
    suggested: [
      { id: 's1', name: 'La Roche-Posay', domain: 'laroche-posay.us', reason: 'Sells sunscreen and barrier creams to the same shoppers' },
      { id: 's2', name: 'Neutrogena', domain: 'neutrogena.com', reason: 'Named next to you in answers about daily SPF' },
    ],
    marketplaces: setupMarketplaces,
  },
]

// ---------------------------------------------------------------------------------------------------------------
// First-time setup (/first-setup): a brand, its competitors, its first prompts, then the first scan. ?mock=<state>:
//   new · brand (no competitors yet) · competitors (no prompts yet) · prompts (scan not started) · scanning · done ·
//   name-only (a brand tracked by its name, no website; competitors next)
// brand: { name, domain } (domain null = name only) · competitors: [{ id, name, domain }] · suggested: research
// candidates (Suggested chips) · prompts: newest first · scan: { status: idle | running | done, startedAt }
// scanMinutes: how long a first scan usually takes (GAP: no estimate in the API; the mock's number).
const setupPromptTexts = [
  'best natural face oil for dry skin', 'plant based retinol alternative', 'clean skincare brands for sensitive skin',
  'bakuchiol serum vs retinol', 'organic moisturizer for combination skin', 'rosehip oil for acne scars',
  'non toxic sunscreen for face', 'vegan night cream for wrinkles', 'calendula cream for eczema',
  'best botanical toner for oily skin', 'squalane vs jojoba oil', 'fragrance free natural cleanser',
]
const setupPrompts = setupPromptTexts.map((text, i) => ({ id: `sp${i + 1}`, text })).reverse()
const setupBrand = { name: 'Brightside Botanics', domain: 'brightsidebotanics.com' }
const setupCompetitors = [
  { id: 'sc1', name: 'Herbivore', domain: 'herbivorebotanicals.com' },
  { id: 'sc2', name: 'Pai Skincare', domain: 'paiskincare.com' },
  { id: 'sc3', name: 'Tata Harper', domain: 'tataharperskincare.com' },
]
const setupSuggested = [
  { id: 'ss1', name: 'Youth to the People', domain: 'youthtothepeople.com', reason: 'Named next to you in answers about plant-based serums' },
  { id: 'ss2', name: 'Drunk Elephant', domain: 'drunkelephant.com', reason: 'Sells clean skincare to the same shoppers' },
  { id: 'ss3', name: 'Kiehl’s', domain: 'kiehls.com', reason: 'Cited in answers about botanical moisturizers' },
]
const setupState = (brand, competitors, prompts, scan) => ({ brand, competitors, suggested: setupSuggested.filter((x) => !competitors.some((c) => c.domain === x.domain)), prompts, scan })
const minutesAgo = (m) => new Date(Date.now() - m * 60e3).toISOString()
export const firstSetupStates = {
  new: setupState(null, [], [], { status: 'idle' }),
  brand: setupState(setupBrand, [], [], { status: 'idle' }),
  competitors: setupState(setupBrand, setupCompetitors, [], { status: 'idle' }),
  prompts: setupState(setupBrand, setupCompetitors, setupPrompts, { status: 'idle' }),
  scanning: setupState(setupBrand, setupCompetitors, setupPrompts, { status: 'running', startedAt: minutesAgo(2.2) }),
  done: setupState(setupBrand, setupCompetitors, setupPrompts, { status: 'done' }),
  'name-only': setupState({ name: 'Brightside Botanics', domain: null }, [], [], { status: 'idle' }),
}
export const firstSetupScanMinutes = 10
// the client the brand belongs to (the agency / superadmin "Viewing … as" banner)
export const firstSetupClient = 'Brightside'
// First-time setup saves. Here: they settle after a moment; the mock's first scan finishes after 8s.
// A brand, competitors and research go through setupActions / promptActions (Brand Setup, Prompt Hub).
export const firstSetupActions = {
  onAddPrompts: (items) => new Promise((resolve) => setTimeout(() => resolve(items.map((it, i) => ({ id: `np${Date.now()}${i}`, text: it.text }))), 300)),
  onStartScan: () => new Promise((resolve) => setTimeout(() => resolve({ startedAt: new Date().toISOString() }), 300)),
  // → resolves when the scan has finished
  onScanDone: () => new Promise((resolve) => setTimeout(resolve, 8000)),
}

// Brand Setup saves. Here: they settle after a moment (the page updates first and keeps the change).
const settle = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 300))
let setupSeq = 100
export const setupActions = {
  onAddTopic: (brandId, name) => settle({ name, promptCount: 0 }),
  onAddCompetitor: (brandId, { name, domain }) => settle({ id: `c${++setupSeq}`, name, domain }),
  onRenameCompetitor: (brandId, competitor, name) => settle({ ...competitor, name }),
  onRemoveCompetitor: (brandId, competitor) => settle(competitor),
  onRestoreCompetitor: (brandId, competitor) => settle(competitor),
  onAcceptSuggestion: (brandId, s) => settle({ id: s.id, name: s.name, domain: s.domain }),
  onDismissSuggestion: (brandId, s) => settle(s),
  onCreateBrand: ({ name, domain, aliases, competitors: list }) => settle({ id: `b${++setupSeq}`, name, domain, aliases, competitors: list.map((c, i) => ({ id: `c${++setupSeq + i}`, ...c })) }),
  onUpdateBrand: (id, { name, domain }) => settle({ id, name, domain }),
  // "Also counts as": one name variant at a time
  onAddAlias: (brandId, name) => settle(name),
  onRemoveAlias: (brandId, name) => settle(name),
  onDeleteBrand: (id) => settle(id),
  // Marketplaces (shown when the account has ecommerce): the brand's stores, saved one change at a time
  onAddMarketplace: (brandId, { name, domain }) => settle({ id: `m${++setupSeq}`, name, domain, cited: 0 }),
  onUpdateMarketplace: (brandId, prev, next) => settle(next),
  onRemoveMarketplace: (brandId, m) => settle(m),
  onRestoreMarketplace: (brandId, m) => settle(m),
  // stores AI cites in the market where the brand isn't listed (none: no Suggested strip)
  marketplaceSuggestions: (brand, country) => (MARKET_SUGGESTIONS[country] ?? GLOBAL).marketplaces
    .filter((x) => !(brand.marketplaces ?? []).some((m) => m.domain === x.domain)),
}

// ---------------------------------------------------------------------------
// Tracking (/tracking). One page, two backends; each passes only the rows it can save (LlmSettingsPage props).
// kraffic.ai, shaped like its API:
//   platforms  the engines: enabled = it has answers in the scans (the dashboard's engines); ready = it can run now
//              (GET /projects/:id/visibility/engines/ready; the Tracking page)
//   market     the project's primary market country and first language (project.markets / project.languages)
//   schedule   daily: daily monitoring on / off (PUT /projects/:id/ask-geo/monitoring); lastSync: the latest scan;
//              nextScanAt: when Sync now is allowed again (GET visibility/scan-allowance; null = now)
//   quota      used: tracked prompts (the prompt count on the AI platforms card; no quota row: billing isn't live)
// trackingOptions: the countries and languages the app supports (GET /projects/taxonomy)
// ---------------------------------------------------------------------------
export const initialTracking = {
  platforms: [
    { id: 'aio', name: 'AI Overview', enabled: true, ready: true },
    { id: 'gemini', name: 'Gemini', enabled: true, ready: true },
    { id: 'chatgpt', name: 'ChatGPT', enabled: true, ready: true },
    { id: 'claude', name: 'Claude', enabled: true, ready: true },
    { id: 'grok', name: 'Grok', enabled: true, ready: true },
  ],
  market: { country: 'United States', language: 'English' },
  schedule: { daily: true, lastSync: '2026-10-05', nextScanAt: null },
  quota: { used: trackedPrompts.length },
}
export const trackingOptions = {
  countries: ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Singapore', 'United Arab Emirates', 'Germany', 'France', 'Japan', 'Brazil', 'Netherlands'],
  languages: ['English', 'Hindi', 'Hinglish', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Spanish', 'French', 'German', 'Portuguese', 'Japanese', 'Chinese (Simplified)', 'Arabic'],
}
// Sync now's modes: the app's agency Sync menu (components/ClientSyncDropdown.js), word for word. engines: the ones a mode
// runs; prompts: 'all' or 'missed' (Google's missed prompts only); calls: paid API calls per prompt per engine, low–high,
// read from the app's scan routes: Google 1 SerpAPI search on a hit, up to 3 tries on a miss, each with a possible AI
// Overview fetch (6), +1 AI Mode call when the client's AI Mode is on (7); ChatGPT 1 (2 with the gpt-4o fallback);
// Gemini 1 (2 on the retry without location); Claude 1 call with up to 5 web searches inside it (6). After a sync, each
// branded domain gets about 8 more SerpAPI searches and 1 LLM call (SYNC_AFTER).
export const SYNC_CALLS = { aio: [1, 6], chatgpt: [1, 2], gemini: [1, 2], claude: [1, 6] }
export const SYNC_AI_MODE = 1
export const SYNC_AFTER = 9
// roughly how many paid calls a mode makes: { n: prompts it runs, lo, hi }. counts: { prompts, missed, domains, aiMode }
export const estimateSync = (m, { prompts, missed, domains = 1, aiMode = false }) => {
  const n = m.prompts === 'missed' ? missed : prompts
  if (!m.engines.length || !n) return { n, lo: 0, hi: 0 }
  const [lo, hi] = m.engines.reduce(([a, b], e) => [a + SYNC_CALLS[e][0] * n, b + (SYNC_CALLS[e][1] + (e === 'aio' && aiMode ? SYNC_AI_MODE : 0)) * n], [0, 0])
  return { n, lo: lo + SYNC_AFTER * domains, hi: hi + SYNC_AFTER * domains }
}
export const syncModes = {
  website: [
    { id: 'full', title: 'Full sync', description: 'Runs Google (SERP + AI Mode), ChatGPT, Gemini, and Claude for every prompt.', engines: ['aio', 'chatgpt', 'gemini', 'claude'], prompts: 'all' },
    { id: 'missed_google', title: 'Missed prompts (Google only)', description: 'Only re-checks prompts still marked missed on Google. Skips ChatGPT, Gemini, and Claude.', engines: ['aio'], prompts: 'missed' },
    { id: 'chatgpt_only', title: 'ChatGPT sync', description: 'Runs ChatGPT for every prompt. Skips Google, Gemini, and Claude.', engines: ['chatgpt'], prompts: 'all' },
    { id: 'gemini_only', title: 'Gemini sync', description: 'Runs Gemini for every prompt. Skips Google, ChatGPT, and Claude.', engines: ['gemini'], prompts: 'all' },
    { id: 'claude_only', title: 'Claude sync', description: 'Runs Claude for every prompt. Skips Google, ChatGPT, and Gemini.', engines: ['claude'], prompts: 'all' },
  ],
  brand: [
    { id: 'brand_full', title: 'Full brand sync', description: 'Runs every platform for this brand and its competitors, then rebuilds the Brand vs Brand comparison.', engines: ['aio', 'chatgpt', 'gemini', 'claude'], prompts: 'all' },
    { id: 'brand_insights', title: 'Rebuild insights only', description: 'Re-reads the answers already stored and regenerates the topic comparison and recommendations. No new scans, no scan cost.', engines: [], prompts: 'all' },
    { id: 'gemini_only', title: 'Gemini only', description: 'Runs Gemini for every prompt. Skips Google, ChatGPT, and Claude.', engines: ['gemini'], prompts: 'all' },
    { id: 'chatgpt_only', title: 'ChatGPT only', description: 'Runs ChatGPT for every prompt. Skips Google, Gemini, and Claude.', engines: ['chatgpt'], prompts: 'all' },
    { id: 'claude_only', title: 'Claude only', description: 'Runs Claude for every prompt. Skips Google, ChatGPT, and Gemini.', engines: ['claude'], prompts: 'all' },
  ],
}
// a sync here: accepted after a moment, then each engine works through its prompts (progress). ?sync=slow: it outlasts
// the page's wait, so the page says it's still running in the background and keeps following it until it finishes
// (onDone); ?sync=fail: refused (a sync already running for the brand)
const syncPreview = (() => { try { return new URLSearchParams(window.location.search).get('sync') } catch { return null } })()
const syncSettle = ({ mode = 'full', onAccepted, onProgress, onDone, waitMs = 6000, preview = syncPreview } = {}) => new Promise((resolve, reject) => {
  if (preview === 'fail') { setTimeout(() => reject(new Error('A sync is already running for this brand')), 600); return }
  const m = [...syncModes.website, ...syncModes.brand].find((x) => x.id === mode) || syncModes.website[0]
  const total = m.prompts === 'missed' ? missedPrompts.length : trackedPrompts.length
  const done = Object.fromEntries(m.engines.map((e) => [e, 0]))
  const step = preview === 'slow' ? 1 : Math.max(1, Math.ceil(total / 8))
  setTimeout(() => {
    onAccepted?.()
    const started = Date.now()
    let waiting = true
    const tick = setInterval(() => {
      for (const e of m.engines) done[e] = Math.min(total, done[e] + step + (e === 'aio' ? 0 : 1))
      onProgress?.(Object.fromEntries(m.engines.map((e) => [e, { done: done[e], total }])))
      const finished = m.engines.every((e) => done[e] >= total)
      const d = new Date()
      const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
      if (finished) {
        clearInterval(tick)
        const res = { status: 'complete', lastSync: iso(d), nextScanAt: null }
        if (waiting) resolve(res); else onDone?.(res)
      } else if (waiting && Date.now() - started > waitMs) {
        waiting = false
        resolve({ status: 'running' })
      }
    }, 400)
  }, 600)
})
export const trackingActions = {
  onSaveMarket: (patch) => settle(patch),
  onSetDaily: (daily) => settle({ daily }),
  onSyncNow: syncSettle,
}
// kraffic.ai's Tracking page props: country + language, the daily check, Sync now (engines are read-only)
export const krafficTracking = {
  countries: trackingOptions.countries,
  languages: trackingOptions.languages,
  onSaveMarket: trackingActions.onSaveMarket,
  onSetDaily: trackingActions.onSetDaily,
  onSyncNow: trackingActions.onSyncNow,
}

// app.kraffic.ai, shaped like its API: GET / PUT /api/user/llm-settings (table user_llm_settings, per user)
//   { default_region, default_country, default_currency, default_language, sync_frequency, enabled_engines }
// Options: lib/llm-region-options.js (REGIONS, COUNTRIES, COUNTRY_TO_REGION, CURRENCIES) and the language and
// frequency lists in app/admin/llm-settings/LLMSettingsForm.js. Every row saves through the one PUT.
// Engines: enabled_engines { aio, gemini, chatgpt, claude, grok } (at least one stays on; the API turns AI Overview
// back on otherwise). Sync now: not a settings field (the app's scans run from its own routes), so it's left out.
export const appTrackingOptions = {
  regions: [
    { value: 'North America', countries: ['USA', 'Canada', 'Mexico'] },
    { value: 'Europe', countries: ['United Kingdom', 'Germany', 'France'] },
    { value: 'Asia Pacific', countries: ['Australia', 'India', 'Japan'] },
    { value: 'Latin America', countries: ['Brazil'] },
    // Middle East & Africa: no country maps to it (COUNTRY_TO_REGION), so it isn't offered
  ],
  languages: ['English (US)', 'English (UK)', 'Japanese', 'German', 'French', 'Arabic'],
  currencies: [['Dollar', 'Dollar (USD)'], ['Euro', 'Euro (EUR)'], ['Pound', 'Pound (GBP)'], ['Yen', 'Yen (JPY)'], ['Rupee', 'Rupee (INR)'], ['Canadian Dollar', 'Canadian Dollar (CAD)'], ['Australian Dollar', 'Australian Dollar (AUD)']],
  frequencies: [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']],
}
export const appInitialTracking = {
  ...initialTracking,
  platforms: initialTracking.platforms.map((p) => ({ ...p, enabled: p.id !== 'grok' })),
  market: { region: 'North America', country: 'USA', language: 'English (US)', currency: 'Dollar' },
  schedule: { frequency: 'weekly', lastSync: '2026-10-05', nextScanAt: null },
}
export const appTracking = {
  ...appTrackingOptions,
  onSetEngine: (id, enabled) => settle({ [id]: enabled }),
  onSaveMarket: (patch) => settle(patch),
  onSetFrequency: (frequency) => settle({ frequency }),
}

// ---------------------------------------------------------------------------------------------------------------
// Site Audit (/audit). Shaped like the production API (harshranjandas/kraffic.ai, apps/api):
//   GET  /projects/:id/pages/checks   → { checks: CheckDefinition[] }  { id, group, label, rule, fix, heuristic }
//   GET  /projects/:id/pages/sync     → { running, lastFinished: SyncView, website, found, read }
//   GET  /projects/:id/pages          → { items: [{ id, url, path, title, pageType, state, words, failedChecks, … }] }
//   GET  /projects/:id/crawl/pages    → WebPage { status (HTTP), crawlDepth } + snapshots[0].responseTimeMs
//   GET  /projects/:id/technical-geo/audits/latest → site-level results (llms.txt, robots), not per page
// Fields marked GAP don't exist in the API today (see the Site Audit report): the UI needs them, the mock invents them.
// States: full · first (no previous run) · clean (0 failing, all 200) · never (no audit yet) · errors (three 404s). /audit?mock=<state>.
// redirectTarget: SiteUrl.redirectTarget (where a 3xx address points).

// CheckDefinition + GAP fields: category (API has group seo|geo only), impact, effort (minutes), problem / action
// (UI copy), pageBased (false = a site-level result), finding(n, total) (API evidence is per page), why, example.
// fix is a list of steps (API: one string). appliesTo: page types the check runs on (elsewhere the API reports status 'na').
export const auditChecks = [
  // technical
  {
    id: 'seo.meta_description', group: 'seo', category: 'technical', impact: 'high', effort: 30, heuristic: false, pageBased: true,
    label: 'Meta descriptions', problem: 'Missing meta descriptions', action: (n) => `Add meta descriptions to ${n} pages`,
    rule: 'The page has a meta description of 70–160 characters.',
    finding: (n, of) => `${n} of ${of} pages have no meta description`,
    why: 'Answer engines often quote the meta description as the page summary. Without one they pick a random paragraph, which can be a shipping note or a cookie banner.',
    example: '<meta name="description"\n  content="A 15% vitamin C serum for dull, uneven skin. Fragrance-free, 30 ml.">',
    fix: ['In the theme template, fall back to the first 155 characters of the product description.', 'Then rewrite the top sellers by hand: lead with what the page answers, e.g. “A 15% vitamin C serum for dull, uneven skin.”'],
  },
  {
    id: 'seo.image_alt', group: 'seo', category: 'technical', impact: 'medium', effort: 60, heuristic: false, pageBased: true,
    label: 'Image alt text', problem: 'Images without alt text', action: (n) => `Describe the product photos on ${n} pages`,
    rule: 'At least 90% of images have a text description.',
    finding: (n) => `Product photos on ${n} pages have no description AI can read`,
    why: 'Multimodal answers and shopping results describe products from their images. Alt text is the only description they can rely on.',
    fix: ['Describe each product photo in one sentence: product, size, texture.', 'Leave decorative images with an empty alt="" on purpose.', 'Add an alt field to the product image upload form.'],
  },
  {
    id: 'crawl.http_errors', group: 'seo', category: 'technical', impact: 'medium', effort: 15, heuristic: false, pageBased: true,
    label: 'Broken pages', problem: 'Broken pages', action: (n) => `Fix or redirect ${n === 1 ? 'a broken page' : `${n} broken pages`}`,
    rule: 'Every linked page returns 200 OK (CrawlIssue HTTP_404 / HTTP_5XX).',
    finding: (n) => `${n === 1 ? 'A linked page returns' : `${n} linked pages return`} 404 Not Found`,
    why: 'A crawler that hits a dead link stops there. The products it would have found from that page may never be read.',
    fix: ['Redirect the page to its closest live replacement (301).', 'Or remove the links to it from menus and other pages.'],
  },
  {
    id: 'site.llms_txt', group: 'geo', category: 'technical', impact: 'medium', effort: 20, heuristic: false, pageBased: false,
    label: 'llms.txt', problem: 'No llms.txt file', action: () => 'Publish an llms.txt file',
    rule: 'The site serves /llms.txt (technical-geo llmsTxtStatus).',
    finding: () => 'dermasuri.com/llms.txt returns 404',
    why: 'llms.txt gives AI crawlers a short map of the site and the pages you most want cited.',
    fix: ['Create /llms.txt with a one-paragraph brand summary.', 'List your top product, collection and guide pages with one line each.'],
  },
  {
    id: 'seo.unique', group: 'seo', category: 'technical', impact: 'medium', effort: 30, heuristic: false, pageBased: true,
    label: 'Unique titles', problem: 'Duplicate titles', action: (n) => `Give ${n} pages their own title`,
    rule: 'The title and main heading are not used on another page.',
    finding: (n) => `${n} pages share “Dermasuri | Clinical Skincare”`,
    why: 'When titles repeat, engines can’t tell the pages apart and tend to cite only one of them.',
    fix: ['Give each page a title that names its subject first, then the brand.', 'Use “Serums | Dermasuri” style titles for collections.'],
  },
  {
    id: 'seo.canonical', group: 'seo', category: 'technical', impact: 'low', effort: 15, heuristic: false, pageBased: true,
    label: 'Canonical tags', problem: 'Missing canonical tags', action: (n) => `Add canonical tags to ${n} pages`,
    rule: 'The page names its own official address.',
    finding: (n) => `${n} pages don’t say which URL is the original`,
    why: 'Without a canonical URL, mentions and links can be split between duplicates of the same page.',
    fix: ['Add a self-referencing canonical tag to every page in the theme layout.'],
  },
  {
    id: 'geo.ai_crawlers', group: 'geo', category: 'technical', impact: 'high', effort: 10, heuristic: false, pageBased: true,
    label: 'AI crawler access', problem: 'AI crawlers blocked', action: (n) => `Let AI crawlers read ${n} pages`,
    rule: 'robots.txt allows GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot and Google-Extended.',
    finding: () => 'robots.txt lets GPTBot, ClaudeBot and PerplexityBot in',
    why: 'If robots.txt blocks AI crawlers, engines can only cite you from second-hand sources.',
    fix: ['Nothing to fix. Re-check after any robots.txt change.'],
  },
  {
    id: 'site.sitemap', group: 'seo', category: 'technical', impact: 'medium', effort: 20, heuristic: false, pageBased: false,
    label: 'XML sitemap', problem: 'Incomplete sitemap', action: () => 'Regenerate the XML sitemap',
    rule: 'The sitemap lists every live page.',
    finding: () => 'The sitemap lists every live page',
    why: 'A complete sitemap is how crawlers find pages that few links point to.',
    fix: ['Keep the sitemap generated by the store platform.'],
  },
  {
    id: 'site.https', group: 'seo', category: 'technical', impact: 'low', effort: 30, heuristic: false, pageBased: false,
    label: 'HTTPS', problem: 'Pages served over HTTP', action: () => 'Serve every page over HTTPS',
    rule: 'Every page is served over HTTPS.',
    finding: () => 'Every page is served over HTTPS',
    why: 'Engines distrust pages that load over plain HTTP or mix secure and insecure content.',
    fix: ['Nothing to fix.'],
  },
  // content
  {
    id: 'seo.headings', group: 'seo', category: 'content', impact: 'high', effort: 45, heuristic: false, pageBased: true,
    label: 'Heading order', problem: 'Broken heading order', action: (n) => `Fix the heading order on ${n} pages`,
    rule: 'One H1, then H2s, with H3s only inside an H2.',
    finding: (n) => `${n} pages skip from H1 to H3 or have more than one H1`,
    why: 'Engines use headings to split a page into answerable sections. Broken nesting merges unrelated sections together.',
    example: 'H1  Vitamin C Serum 15%\n├ H2  What it does\n│ └ H3  Who it’s for\n├ H2  How to use it\n└ H2  Ingredients',
    fix: ['Use one H1 per page.', 'Use H2 for each section and H3 only inside an H2.'],
  },
  {
    id: 'geo.direct_answers', group: 'geo', category: 'content', appliesTo: ['ARTICLE'], impact: 'high', effort: 120, heuristic: true, pageBased: true,
    label: 'Direct answers', problem: 'No direct answers', action: (n) => `Open ${n} articles with a direct answer`,
    rule: 'Questions are answered in the first paragraph under them.',
    finding: (n) => `${n} articles don’t answer the title question in the first paragraph`,
    why: 'AI answers quote short, self-contained passages. A 40–60 word answer right under the heading is the easiest thing to cite.',
    example: 'H1  Can you use vitamin C with niacinamide?\nYes. Modern formulas are stable together, so you can layer them\nin the same routine. Apply vitamin C first, then niacinamide.',
    fix: ['Open each article with a 2–3 sentence answer to its title.', 'Then go into detail below it.'],
  },
  {
    id: 'geo.author_date', group: 'geo', category: 'content', appliesTo: ['ARTICLE'], impact: 'high', effort: 30, heuristic: false, pageBased: true,
    label: 'Author & date', problem: 'No author or date', action: (n) => `Add an author and date to ${n} articles`,
    rule: 'Articles show an author and a published or updated date.',
    finding: (n) => `${n} articles name no author or reviewer`,
    why: 'For skincare advice, engines weigh who wrote it and when. Unattributed, undated health content is cited less.',
    fix: ['Add an author byline to every article.', 'Add a “Reviewed by” line with the dermatologist’s name and credentials.', 'Show “Updated <date>” and set dateModified in the article markup.'],
  },
  {
    id: 'geo.question_headings', group: 'geo', category: 'content', appliesTo: ['ARTICLE'], impact: 'medium', effort: 60, heuristic: true, pageBased: true,
    label: 'Question headings', problem: 'Few question headings', action: (n) => `Phrase H2s as questions in ${n} articles`,
    rule: 'Section headings are phrased the way people ask.',
    finding: () => 'Only 6 of 74 article H2s are phrased as questions',
    why: 'People ask AI questions. Headings that match the question make the section easy to match to a prompt.',
    example: 'Before  H2  Layering\nAfter   H2  Can I use vitamin C with niacinamide?',
    fix: ['Rewrite H2s as the questions customers ask.', 'Keep the answer in the first sentence under each one.'],
  },
  {
    id: 'seo.links_out', group: 'seo', category: 'content', impact: 'low', effort: 45, heuristic: false, pageBased: true,
    label: 'Internal links', problem: 'No links to guides', action: (n) => `Link ${n} products to their guides`,
    rule: 'The page links to other pages of your site.',
    finding: (n) => `${n} product pages link to no related guide`,
    why: 'Links between products and guides help crawlers see which page is the authority on a topic.',
    fix: ['Link each product to the one or two guides that explain its main ingredient.'],
  },
  {
    id: 'geo.summary', group: 'geo', category: 'content', impact: 'low', effort: 30, heuristic: true, pageBased: true,
    label: 'Summary up top', problem: 'No summary up top', action: (n) => `Add a summary to ${n} pages`,
    rule: 'A short summary near the top of the page.',
    finding: () => 'Every article opens with a short summary',
    why: '“What is…” prompts are answered with a one-sentence definition. Put it where it’s found first.',
    fix: ['Nothing to fix. Keep opening new pages with a one-line summary.'],
  },
  {
    id: 'seo.text_length', group: 'seo', category: 'content', impact: 'low', effort: 60, heuristic: false, pageBased: true,
    label: 'Enough text', problem: 'Thin pages', action: (n) => `Add text to ${n} thin pages`,
    rule: 'At least 300 words on the page.',
    finding: () => 'Every page has at least 300 words',
    why: 'Thin pages give an engine too little to quote, so it cites a page that says more.',
    fix: ['Nothing to fix.'],
  },
  // speed (GAP: production has no speed checks; response times exist only as CrawlJobPage.responseTimeMs)
  {
    id: 'speed.response_time', group: 'seo', category: 'speed', impact: 'high', effort: 60, heuristic: false, pageBased: true,
    label: 'Response time', problem: 'Slow pages', action: (n) => `Speed up ${n} slow pages`,
    rule: 'The page responds in 500 ms or less.',
    finding: (n) => `${n} pages take over 500 ms to respond`,
    why: 'Slow pages get dropped from crawls before they’re read in full.',
    fix: ['Compress the hero images on the slowest pages.', 'Cache collection pages at the CDN.'],
  },
  {
    id: 'speed.page_weight', group: 'seo', category: 'speed', impact: 'medium', effort: 60, heuristic: false, pageBased: false,
    label: 'Page weight', problem: 'Heavy pages', action: () => 'Reduce page weight',
    rule: 'The median page is under 2 MB.',
    finding: () => 'The median page is 1.2 MB',
    why: 'Heavy pages take longer to fetch and are more likely to time out for crawlers.',
    fix: ['Nothing to fix.'],
  },
  {
    id: 'speed.render_blocking', group: 'seo', category: 'speed', impact: 'low', effort: 90, heuristic: false, pageBased: false,
    label: 'Render-blocking scripts', problem: 'Render-blocking scripts', action: () => 'Defer render-blocking scripts',
    rule: 'Main content renders without waiting on scripts.',
    finding: () => 'Main content renders without waiting on scripts',
    why: 'Crawlers that don’t run JavaScript only see what renders without it.',
    fix: ['Nothing to fix.'],
  },
]

// ---- crawled pages: WebPage + PageAudit.failedChecks (+ GAP warnChecks: the API has no "needs work" status)
const auditProducts = ['vitamin-c-serum', 'niacinamide-booster', 'retinol-night-cream', 'hyaluronic-moisturizer', 'mineral-sunscreen-spf-50', 'gentle-gel-cleanser',
  'azelaic-acid-cream', 'peptide-eye-cream', 'barrier-repair-balm', 'bha-exfoliant', 'tinted-spf-30', 'ceramide-toner',
  'brightening-mask', 'clarifying-clay-mask', 'overnight-lip-mask', 'squalane-oil', 'snail-mucin-essence', 'sensitive-skin-kit']
const auditCollections = ['serums', 'moisturizers', 'sunscreen', 'cleansers', 'acne', 'bestsellers']
const auditPosts = ['vitamin-c-vs-niacinamide', 'how-to-layer-skincare', 'best-sunscreen-for-oily-skin', 'retinol-for-beginners', 'what-is-azelaic-acid',
  'skin-barrier-guide', 'morning-vs-night-routine', 'fragrance-free-skincare', 'dark-spots-treatment', 'is-mineral-sunscreen-better']
const auditInfo = [['about', 'ABOUT'], ['shipping', 'OTHER'], ['ingredients', 'OTHER'], ['contact', 'CONTACT']]
const AUDIT_MS = [142, 188, 171, 165, 120, 199, 156, 133, 181, 177, 149, 160,
  240, 310, 285, 420, 365, 230, 455, 275, 330, 390, 260, 480, 345, 300, 410, 255, 370, 295, 440, 320, 215, 385, 470,
  620, 740, 880, 560, 1320]

// broken: extra paths that return 404 (the default full site has one: a discontinued product)
function auditPages({ clean = false, broken = [] } = {}) {
  const raw = [
    { path: '/', pageType: 'HOME', crawlDepth: 0, title: 'Dermasuri | Clinical Skincare' },
    { path: '/index.html', pageType: 'HOME', crawlDepth: 0, title: null, status: clean ? 200 : 301, redirectTarget: clean ? null : '/' },
    ...auditProducts.map((s) => ({ path: `/products/${s}`, pageType: 'PRODUCT', crawlDepth: 2, status: !clean && s === 'sensitive-skin-kit' ? 404 : 200 })),
    ...auditCollections.map((s) => ({ path: `/collections/${s}`, pageType: 'CATEGORY', crawlDepth: 1 })),
    ...auditPosts.map((s) => ({ path: `/blogs/journal/${s}`, pageType: 'ARTICLE', crawlDepth: 2 })),
    ...auditInfo.map(([s, t]) => ({ path: `/pages/${s}`, pageType: t, crawlDepth: 1 })),
  ]
  // clean site: every page under 500 ms. Full: the slow tail lands on collections, the home redirect and one article.
  const slowOrder = ['/collections/bestsellers', '/collections/serums', '/blogs/journal/skin-barrier-guide', '/collections/sunscreen', '/collections/moisturizers']
  return raw.filter((p) => !(clean && p.path === '/index.html')).map((p, i) => { // a clean site has no duplicate home URL
    let ms = AUDIT_MS[i % 35]
    const slow = slowOrder.indexOf(p.path)
    if (slow >= 0) ms = clean ? 280 + slow * 40 : [1320, 880, 740, 620, 560][slow]
    const status = broken.includes(p.path) ? 404 : p.status ?? 200
    return {
      id: `wp_${i + 1}`, url: `https://dermasuri.com${p.path}`, path: p.path, title: p.title ?? null,
      pageType: p.pageType, state: status === 404 ? 'removed' : 'live',
      httpStatus: status, redirectTarget: p.redirectTarget ?? null, crawlDepth: p.crawlDepth, responseTimeMs: ms, words: p.pageType === 'ARTICLE' ? 1400 : 380,
      failedChecks: [], warnChecks: [],
    }
  })
}

// which pages fail / need work on which check
function applyResults(pages, results) {
  const live = pages.filter((p) => p.httpStatus === 200)
  for (const [id, status, test] of results) {
    for (const p of (id === 'crawl.http_errors' ? pages : live)) if (test(p)) (status === 'fail' ? p.failedChecks : p.warnChecks).push(id)
  }
  return pages
}
const isType = (t) => (p) => p.pageType === t
const FULL_RESULTS = [
  ['seo.meta_description', 'fail', (p) => ['PRODUCT', 'ABOUT', 'CONTACT', 'OTHER'].includes(p.pageType)], // collections + articles get one from their description / excerpt
  ['seo.image_alt', 'fail', (p) => ['PRODUCT', 'CATEGORY'].includes(p.pageType) || p.path === '/'],
  ['crawl.http_errors', 'fail', (p) => p.httpStatus === 404],
  ['seo.unique', 'warn', (p) => p.pageType === 'CATEGORY' || ['/', '/pages/about', '/pages/contact'].includes(p.path)],
  ['seo.canonical', 'warn', (p) => p.path.startsWith('/pages/')],
  ['seo.headings', 'fail', (p) => p.pageType === 'CATEGORY' || auditProducts.slice(0, 8).some((s) => p.path === `/products/${s}`)],
  ['geo.direct_answers', 'fail', (p) => p.pageType === 'ARTICLE' && p.path !== '/blogs/journal/what-is-azelaic-acid'],
  ['geo.author_date', 'warn', isType('ARTICLE')],
  ['geo.question_headings', 'warn', isType('ARTICLE')],
  ['seo.links_out', 'warn', isType('PRODUCT')],
  ['speed.response_time', 'warn', (p) => p.responseTimeMs > 500],
]
const CLEAN_RESULTS = [
  ['seo.canonical', 'warn', (p) => p.path.startsWith('/pages/')],
  ['geo.question_headings', 'warn', (p) => p.pageType === 'ARTICLE' && p.path.includes('-vs-')],
]

// site-level results (technical-geo audit): pageBased: false checks. Page-based checks roll up from the pages.
const siteResults = (llms) => [
  { id: 'site.llms_txt', status: llms }, { id: 'site.sitemap', status: 'pass' }, { id: 'site.https', status: 'pass' },
  { id: 'speed.page_weight', status: 'pass' }, { id: 'speed.render_blocking', status: 'pass' },
]

// SyncView (GET pages/sync → lastFinished)
const syncView = (id, startedAt, finishedAt, pages) => ({
  id, phase: 'done', result: 'finished', trigger: 'manual', message: null, startedAt, finishedAt,
  pagesReadThisSync: pages, addressesChecked: pages, currentUrl: null, durationSeconds: 412,
})

// GAP: run history. PageAudit is overwritten each sync, so the API can't say what changed. The mock keeps the previous
// run's site-level status per check, its score and its page list.
function previousRun(pages) {
  const now = new Map(pages.map((p) => [p.path, p]))
  const paths = [...now.keys()].filter((p) => !['/blogs/journal/dark-spots-treatment', '/blogs/journal/is-mineral-sunscreen-better'].includes(p))
  return {
    sync: syncView('sync_0914', '2026-09-14T09:02:00Z', '2026-09-14T09:09:00Z', paths.length + 1),
    paths: [...paths, '/pages/press'],
    checkStatus: { 'seo.headings': 'warn', 'crawl.http_errors': 'pass', 'site.sitemap': 'fail', 'seo.text_length': 'warn', 'seo.links_out': 'fail' }, // the rest: as now
    // GAP: earlier runs' scores (for the sparkline). Production keeps no run history (PageAudit is overwritten).
    history: [{ finishedAt: '2026-08-03T09:10:00Z', score: 38 }, { finishedAt: '2026-08-17T09:10:00Z', score: 41 }, { finishedAt: '2026-08-31T09:10:00Z', score: 46 }],
  }
}

function auditProject(state) {
  if (state === 'errors') { // the full site with two more dead links (4xx = 3)
    return { ...auditProject('full'), pages: applyResults(auditPages({ broken: ['/products/overnight-lip-mask', '/blogs/journal/fragrance-free-skincare'] }), FULL_RESULTS) }
  }
  if (state === 'never') return { website: 'dermasuri.com', running: false, lastFinished: null, previous: null, checks: auditChecks, pages: [], siteResults: [] }
  const clean = state === 'clean'
  const pages = applyResults(auditPages({ clean }), clean ? CLEAN_RESULTS : FULL_RESULTS)
  return {
    website: 'dermasuri.com',
    running: false,
    lastFinished: syncView('sync_1012', '2026-10-12T09:07:00Z', '2026-10-12T09:14:00Z', pages.length),
    previous: state === 'first' ? null : clean ? { ...previousRun(pages), checkStatus: { 'seo.canonical': 'fail' } } : previousRun(pages),
    checks: auditChecks,
    pages,
    siteResults: siteResults(clean ? 'pass' : 'fail'),
  }
}
export const siteAudit = { full: auditProject('full'), first: auditProject('first'), clean: auditProject('clean'), never: auditProject('never'), errors: auditProject('errors') }
// the check groups the page splits checks by (Checks tab chips, the Overview heat grid)
export const auditCategories = { technical: 'Technical', content: 'Content', speed: 'Speed' }
// Run audit: resolves when the run has finished (→ the state to show next: the first audit lands on a never-run site);
// rejects with the reason when it fails
export const auditActions = {
  canMarkFixed: true, // the Check drawer's "Mark as fixed" (kept in this browser: components/audit/context.jsx)
  async onRunAudit({ never = false } = {}) {
    await sleep(1800)
    return { mock: never ? 'first' : null }
  },
}

// ---------------------------------------------------------------------------------------------------------------
// Trends (/trends): how news and social channels talk about a question. NO production API exists for this yet
// (harshranjandas/kraffic.ai has no prompt-trend / narrative-analysis module), so every field here is invented,
// named after the closest house conventions:
//   run      ← CompetitorStatementRun: status RUNNING | DONE | FAILED, error, startedAt, finishedAt
//   region   ← ProjectMarket { countryCode, countryName, isPrimary } (+ a state/region label from ProjectLocation.region)
//   channel  ← SourceType NEWS / SOCIAL, split by platform: NEWS | X | INSTAGRAM
//   sentiment← CompetitorStatement.sentiment 'positive' | 'neutral' | 'negative'; sentimentDistribution {positive,neutral,negative}
// States: /trends?mock=empty shows an empty run list.
export const trendNow = '2026-10-14T12:00:00Z'
export const trendMarket = { countryCode: 'US', countryName: 'United States', isPrimary: true }
export const trendRegions = ['United States', 'California', 'New York', 'United Kingdom', 'Canada', 'India']

// [publishedAt day, channel, domain or handle, author, sentiment, stance, title (news) | text (social), snippet?, entities]
const PROP45 = [
  ['09-26', 'NEWS', 'calmatters.org', 'CalMatters', 'neutral', 'neutral', 'What is Prop 45? The health insurance rate measure, explained', 'Prop 45 would give California’s insurance commissioner the power to reject health insurance rate hikes. Here is what a yes and a no vote mean.', ['Ricardo Lara']],
  ['09-26', 'X', '@CalNurses', 'California Nurses', 'positive', 'for', 'Prop 45 puts a check on runaway premiums. Families deserve someone who can say no to a 20% hike. Vote yes https://t.co/a8Kd02', null, []],
  ['09-27', 'NEWS', 'latimes.com', 'Los Angeles Times', 'neutral', 'neutral', 'Insurers and consumer groups square off over Prop 45', 'Insurers and consumer groups square off over Prop 45', ['Covered California']],
  ['09-28', 'INSTAGRAM', '@cahealthvoters', 'CA Health Voters', 'positive', 'for', 'Three things Prop 45 changes about your health plan. Swipe for the short version and share with someone who votes. #Prop45', null, []],
  ['09-29', 'NEWS', 'sacbee.com', 'The Sacramento Bee', 'negative', 'against', 'Opinion: Prop 45 hands one elected official too much power over your coverage', 'An elected commissioner would control rates for 6 million Californians, critics say, and campaign donors would follow.', ['Ricardo Lara']],
  ['09-30', 'X', '@KFF', 'KFF', 'neutral', 'neutral', 'New explainer: how prior approval of health rates works in 35 states, and what Prop 45 would change in California https://t.co/kx81Lp', null, ['Covered California']],
  ['09-30', 'X', '@CAInsureWatch', 'Insurance Watch', 'negative', 'against', 'Prop 45 adds a political layer to a system that already works. Covered California negotiates rates today. Why change it?', null, ['Covered California']],
  ['10-01', 'NEWS', 'politico.com', 'Politico', 'neutral', 'against', 'Business groups pour $30M into fight against Prop 45', 'The No campaign has outraised supporters ten to one, with most of the money from the state’s largest insurers.', ['Anthem Blue Cross', 'Kaiser Permanente']],
  ['10-02', 'X', '@sfchronicle', 'San Francisco Chronicle', 'neutral', 'neutral', 'Live: the Prop 45 debate is underway in Sacramento. Follow along for the key moments https://t.co/q09Lx1', null, []],
  ['10-02', 'X', '@DrMaya_Policy', 'Maya Ortiz', 'negative', 'against', 'Watching the Prop 45 debate. Still no answer on how one office reviews thousands of plans without delays.', null, []],
  ['10-02', 'X', '@CalNurses', 'California Nurses', 'positive', 'for', 'Tonight the Yes side made the case plainly: rate hikes should have to be justified. #Prop45 https://t.co/Lm2k0', null, []],
  ['10-02', 'X', '@CAInsureWatch', 'Insurance Watch', 'negative', 'against', 'The No side landed it: Prop 45 lets a politician set your premiums. Hard pass.', null, []],
  ['10-02', 'X', '@votesmartCA', 'VoteSmart CA', 'neutral', 'neutral', 'Debate recap thread: what each side said about Prop 45, in plain English. 1/7', null, []],
  ['10-02', 'NEWS', 'kqed.org', 'KQED', 'neutral', 'neutral', 'Prop 45 debate: five takeaways', 'Supporters focused on premiums; opponents on who gets the power to approve them.', []],
  ['10-02', 'INSTAGRAM', '@kqednews', 'KQED News', 'neutral', 'neutral', 'Missed the Prop 45 debate? Here are the 60 seconds that matter. Full recap at the link in bio.', null, []],
  ['10-03', 'NEWS', 'sfchronicle.com', 'San Francisco Chronicle', 'negative', 'against', 'Editorial: Vote no on Prop 45', 'The measure’s goal is right, but the fix is wrong. It concentrates rate power in one elected office.', []],
  ['10-03', 'X', '@health_access', 'Health Access CA', 'positive', 'for', 'Fact check: 35 states already let regulators reject unjustified rate hikes. Prop 45 brings California in line https://t.co/Uv0a2', null, []],
  ['10-04', 'X', '@smallbizCA', 'CA Small Business', 'negative', 'against', 'Our members already struggle with premiums. Prop 45 adds review delays that land on small employers first.', null, []],
  ['10-04', 'NEWS', 'latimes.com', 'Los Angeles Times', 'neutral', 'against', 'Prop 45 trails in new poll as undecided voters break no', 'Support has slipped to 38% among likely voters, down from 52% in August.', []],
  ['10-05', 'INSTAGRAM', '@cahealthvoters', 'CA Health Voters', 'positive', 'for', 'Your premium went up 9% this year. Who signed off on that? Nobody had to. That’s what Prop 45 changes.', null, []],
  ['10-05', 'X', '@KFF', 'KFF', 'neutral', 'neutral', 'Poll: 4 in 10 California voters say they haven’t heard enough about Prop 45 to decide.', null, []],
  ['10-05', 'X', '@CAInsureWatch', 'Insurance Watch', 'negative', 'against', 'Every major newspaper editorial board in the state now opposes Prop 45. Pay attention.', null, []],
  ['10-06', 'NEWS', 'calmatters.org', 'CalMatters', 'neutral', 'neutral', 'Who is paying for the Prop 45 campaigns?', 'A look at the donors on both sides of the health insurance rate measure.', ['Anthem Blue Cross', 'Kaiser Permanente']],
  ['10-06', 'X', '@votesmartCA', 'VoteSmart CA', 'neutral', 'against', 'Prop 45 update: the No campaign has now booked $12M in TV ads through election day.', null, []],
  ['10-06', 'X', '@DrMaya_Policy', 'Maya Ortiz', 'neutral', 'neutral', 'Reading the Prop 45 fiscal analysis. Admin cost is small; the real question is review capacity. Thread.', null, []],
  ['10-07', 'NEWS', 'politico.com', 'Politico', 'negative', 'against', 'Prop 45 backers concede an uphill climb', 'Prop 45 backers concede an uphill climb', []],
  ['10-07', 'X', '@health_access', 'Health Access CA', 'positive', 'for', 'Down in the polls, not in the argument. Rate hikes should be justified. Vote yes on 45.', null, []],
  ['10-07', 'INSTAGRAM', '@kqednews', 'KQED News', 'neutral', 'neutral', 'Prop 45 in one chart: what you pay now vs. what rate review could change.', null, []],
]
// talking points (GAP: no theme/narrative extraction for news or social exists; named after CompetitorStatement
// { theme, themeKey }). Mention i of PROP45 → its themeKey (null = no clear point).
export const PROP45_THEMES = [
  { themeKey: 'rate-review', theme: 'Rate reviews would slow insurance hikes' },
  { themeKey: 'too-much-power', theme: 'One elected official gets too much power' },
  { themeKey: 'campaign-money', theme: 'Insurers are outspending supporters' },
  { themeKey: 'polls-slipping', theme: 'Support is slipping in the polls' },
  { themeKey: 'voters-unsure', theme: 'Voters don’t know enough to decide' },
]
const PROP45_THEME_OF = ['rate-review', 'rate-review', 'campaign-money', 'rate-review', 'too-much-power', 'rate-review', 'too-much-power', 'campaign-money',
  null, 'too-much-power', 'rate-review', 'too-much-power', null, null, null, 'too-much-power', 'rate-review', 'too-much-power', 'polls-slipping',
  'rate-review', 'voters-unsure', 'polls-slipping', 'campaign-money', 'campaign-money', 'too-much-power', 'polls-slipping', 'rate-review', 'rate-review']
const SUN = [
  ['09-29', 'calmatters.org', 'neutral', 'neutral', 'Mineral vs chemical sunscreen: what the FDA actually says'],
  ['09-30', 'nytimes.com', 'neutral', 'neutral', 'Are chemical sunscreens safe? Dermatologists weigh in'],
  ['10-01', 'allure.com', 'positive', 'for', 'Why derms keep recommending mineral SPF for sensitive skin'],
  ['10-01', 'healthline.com', 'neutral', 'neutral', 'Mineral sunscreen: benefits, drawbacks and how to choose'],
  ['10-02', 'consumerreports.org', 'negative', 'against', 'Many mineral sunscreens fail SPF claims in new tests'],
  ['10-03', 'byrdie.com', 'positive', 'for', 'The best mineral sunscreens that don’t leave a white cast'],
  ['10-03', 'washingtonpost.com', 'neutral', 'neutral', 'The sunscreen ingredient debate, explained'],
  ['10-04', 'self.com', 'positive', 'for', 'Is mineral sunscreen better for acne-prone skin?'],
  ['10-04', 'theguardian.com', 'negative', 'against', 'Reef-safe labels on sunscreen are mostly marketing, study finds'],
]
const REASONS = {
  sentiment: { positive: 'Upbeat framing; presents the measure as a fix for rising costs.', neutral: 'Reports facts and quotes both sides without taking a tone.', negative: 'Critical framing; stresses risks, cost or loss of control.' },
  stance: { for: 'Argues voters should support the measure.', neutral: 'Explains or reports without urging a vote either way.', against: 'Argues the measure should be rejected.' },
}
const NEWS_TITLES = { 'calmatters.org': 'CalMatters', 'latimes.com': 'Los Angeles Times', 'sacbee.com': 'The Sacramento Bee', 'politico.com': 'Politico', 'kqed.org': 'KQED', 'sfchronicle.com': 'San Francisco Chronicle' }
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
const at = (md, h) => `2026-${md}T${String(h).padStart(2, '0')}:${String((h * 17) % 60).padStart(2, '0')}:00Z`
// an earlier run of the same question: shifted back in time, without some sources, a few tones milder
function prop45Mentions({ shiftDays = 0, take = PROP45.length, without = [], milder = 0 } = {}) {
  let softened = 0
  return PROP45.map((row, i) => [row, i]).filter(([row]) => !without.includes(row[2])).slice(0, take).map(([[md, channel, src, author, sentimentRaw, stance, body, snippet, entities], i]) => {
    const sentiment = sentimentRaw === 'negative' && softened < milder ? (softened++, 'neutral') : sentimentRaw
    const d = new Date(at(md, 8 + (i % 12)))
    d.setUTCDate(d.getUTCDate() - shiftDays)
    const handle = src.startsWith('@')
    const domain = channel === 'NEWS' ? src : channel === 'X' ? 'x.com' : 'instagram.com'
    return {
      id: `m_${shiftDays}_${i + 1}`, channel, sourceType: channel === 'NEWS' ? 'NEWS' : 'SOCIAL',
      domain, handle: handle ? src : null, author: author ?? NEWS_TITLES[src],
      url: channel === 'NEWS' ? `https://${src}/2026/${slug(body)}` : channel === 'X' ? `https://x.com/${src.slice(1)}/status/18${i}4410${i}` : `https://instagram.com/p/C${i}x45${i}/`,
      title: channel === 'NEWS' ? body : null, text: channel === 'NEWS' ? snippet : body,
      publishedAt: d.toISOString(), sentiment, stance,
      sentimentReason: REASONS.sentiment[sentiment], stanceReason: REASONS.stance[stance], // GAP: no reason fields anywhere in production
      entities, // GAP: people / organisations named in the mention
      themeKey: PROP45_THEME_OF[i], // GAP: talking point
    }
  })
}
const sunMentions = SUN.map(([md, domain, sentiment, stance, title], i) => ({
  id: `s_${i + 1}`, channel: 'NEWS', sourceType: 'NEWS', domain, handle: null, author: null,
  url: `https://${domain}/2026/${slug(title)}`, title, text: null, publishedAt: at(md, 9 + i), sentiment, stance, themeKey: null,
  sentimentReason: REASONS.sentiment[sentiment], stanceReason: { for: 'Recommends mineral sunscreen over chemical filters.', neutral: 'Compares the two without recommending either.', against: 'Questions the claimed benefits of mineral sunscreen.' }[stance], entities: sentiment === 'neutral' ? ['FDA'] : [],
}))

const distribution = (ms) => ({ positive: ms.filter((m) => m.sentiment === 'positive').length, neutral: ms.filter((m) => m.sentiment === 'neutral').length, negative: ms.filter((m) => m.sentiment === 'negative').length })
const trendRun = (r, ms = []) => ({
  countryCode: 'US', previousRunId: null, error: null, phase: r.status === 'DONE' ? 'done' : null,
  mentionCount: ms.length, sentimentDistribution: distribution(ms), mentions: ms, themes: null, ...r,
})
// the run before (Sep 24): no Health Access / KQED yet, and milder tone
const prevProp = prop45Mentions({ shiftDays: 14, take: 21, without: ['@health_access', 'kqed.org', '@kqednews'], milder: 3 })
const firstProp = prop45Mentions({ shiftDays: 28, take: 12, without: ['@health_access', 'kqed.org', '@kqednews', '@smallbizCA'], milder: 2 })
// newest first
export const trendRuns = [
  trendRun({ id: 'tr_7', query: 'Will tariffs raise skincare prices?', region: 'United States', status: 'RUNNING', phase: 'reading', startedAt: '2026-10-14T11:58:00Z', finishedAt: null }),
  trendRun({ id: 'tr_6', query: 'What is California Prop 45?', region: 'California', status: 'DONE', startedAt: '2026-10-08T15:20:00Z', finishedAt: '2026-10-08T15:21:40Z', previousRunId: 'tr_2', themes: PROP45_THEMES }, prop45Mentions()),
  trendRun({ id: 'tr_5', query: 'Is mineral sunscreen safer than chemical sunscreen?', region: 'United States', status: 'DONE', startedAt: '2026-10-05T10:02:00Z', finishedAt: '2026-10-05T10:03:12Z' }, sunMentions),
  trendRun({ id: 'tr_4', query: 'Are there new FDA rules for sunscreen filters?', region: 'United States', status: 'FAILED', phase: 'collecting', error: 'The news source didn’t respond after 3 tries, so nothing was saved.', startedAt: '2026-10-03T09:40:00Z', finishedAt: '2026-10-03T09:42:05Z' }),
  trendRun({ id: 'tr_3', query: 'Is niacinamide safe during pregnancy?', region: 'United Kingdom', countryCode: 'GB', status: 'DONE', startedAt: '2026-09-30T08:10:00Z', finishedAt: '2026-09-30T08:11:02Z' }),
  trendRun({ id: 'tr_2', query: 'What is California Prop 45?', region: 'California', status: 'DONE', startedAt: '2026-09-24T14:00:00Z', finishedAt: '2026-09-24T14:01:30Z', previousRunId: 'tr_1', themes: PROP45_THEMES }, prevProp),
  trendRun({ id: 'tr_1', query: 'What is California Prop 45?', region: 'California', status: 'DONE', startedAt: '2026-09-10T13:30:00Z', finishedAt: '2026-09-10T13:31:10Z', themes: PROP45_THEMES }, firstProp),
]

// ---------------------------------------------------------------------------------------------------------------
// Toolkit (/more-tools) + Site Kit (/more-tools/site-kit). Production (harshranjandas/kraffic.ai) has the
// "Search & Analytics Connectors" tool (apps/api/src/modules/integrations): ProjectIntegration rows per provider and
// SearchPerformanceMetric / AiReferralTrafficMetric rows. Field names below match those models. GAP-marked fields
// don't exist there. States: /more-tools/site-kit?mock=none (default) | gsc | expired | connected | empty.
// The tools, as production's more-tools.tsx TOOLS lists them (path = route segment). "Site Kit" is the mock's name for
// "Search & Analytics Connectors". Technical GEO & Crawlers is left out: /audit covers it.
export const toolkitTools = [
  { id: 'integrations', section: 'Connect', name: 'Site Kit', prodName: 'Search & Analytics Connectors', icon: 'plug', href: '/more-tools/site-kit',
    desc: 'Search Console and Analytics data next to your AI visibility' },
  { id: 'crm-attribution', href: '/more-tools/crm-attribution', section: 'Connect', name: 'CRM & Revenue Attribution', icon: 'wallet', desc: 'Sales in your CRM linked to the AI answers that started them' },
  { id: 'content', href: '/more-tools/content', section: 'Analyze', name: 'Content Intelligence', icon: 'file-search', desc: 'Topics your website doesn’t cover yet, and pages that compete with each other' },
  { id: 'evidence', href: '/more-tools/evidence', section: 'Analyze', name: 'Evidence Vault', icon: 'library', desc: 'Sources that back up the claims your site makes' },
  { id: 'entity-intelligence', href: '/fact-check', section: 'Analyze', // production's own page calls it the older, sample version of Fact Check
    name: 'Entity & Hallucinations', icon: 'shield-alert', desc: 'Claims AI engines make about your brand that are wrong or out of date' },
  { id: 'competitor-alerts', href: '/more-tools/competitor-alerts', section: 'Analyze', name: 'Competitor Alerts', icon: 'bell', desc: 'Changes on competitor websites: new pages, prices and claims' },
  { id: 'action-mappings', movedTo: 'Recommendations', section: 'Improve', // the same GeoRecommendation rows, re-indexed by prompt
    name: 'Action Mappings', icon: 'route', desc: 'Recommendations linked to the prompts and pages they help' },
  { id: 'experiments', href: '/more-tools/experiments', section: 'Improve', name: 'GEO Experiment Lab', icon: 'flask', desc: 'Before-and-after tests of content changes on AI visibility' },
  { id: 'executive-reports', href: '/more-tools/executive-reports', section: 'Report', name: 'Executive Reports', icon: 'presentation', desc: 'Branded summary reports for managers and clients' },
]

// Each tool's summary response, named as in production (…/overview or …/metrics). `lastRunAt` and
// `lastAcknowledgedAt` are GAP fields: no summary response carries a run date (only integrations.lastSyncAt and
// executive-reports exports[].createdAt do). null = never run / nothing connected.
const TK_FULL = {
  integrations: { connectedProviders: [], lastSyncAt: null }, // SearchPerformanceOverviewStats (not connected: nothing synced)
  'crm-attribution': { connected: true, totalConversions: 22, totalAttributedRevenue: 31800, lastRunAt: '2026-10-11' }, // CrmAttributionMetrics
  content: { totalGapsIdentified: 6, coveragePercentage: 64, actionableOpportunitiesCount: 7, lastRunAt: '2026-10-05' }, // ContentOverviewStats
  evidence: { totalEvidenceCount: 13, userVerifiedCount: 11, lastRunAt: '2026-10-03' }, // EvidenceStatsDto
  'entity-intelligence': { totalIncidents: 5, contradictedCount: 3, criticalCount: 1, resolvedCount: 2, lastRunAt: '2026-10-09' }, // HallucinationMetrics
  'competitor-alerts': { totalChangesDetected: 11, unacknowledgedChanges: 4, highImpactChanges: 1, lastRunAt: '2026-10-14', lastAcknowledgedAt: '2026-10-12' }, // CompetitorAlertsMetrics
  'action-mappings': { coverageMetrics: { totalActionsCount: 9, promptsAddressedCount: 31, coveragePercentage: 20 }, lastRunAt: '2026-10-05' }, // ActionMappingsOverviewDto
  experiments: { totalExperiments: 0, runningCount: 0, concludedCount: 0, lastRunAt: null }, // ExperimentLabMetrics
  'executive-reports': { exports: [{ createdAt: '2026-10-02' }] }, // GET …/executive-reports/exports
}
const TK_NEW = {
  integrations: { connectedProviders: [], lastSyncAt: null },
  'crm-attribution': { connected: false },
  content: { lastRunAt: null }, evidence: { lastRunAt: null }, 'entity-intelligence': { lastRunAt: null },
  'competitor-alerts': { lastRunAt: null }, 'action-mappings': { lastRunAt: null }, experiments: { totalExperiments: 0, lastRunAt: null },
  'executive-reports': { exports: [] },
}
const TK_HEALTHY = {
  ...TK_FULL,
  integrations: { connectedProviders: [{ provider: 'GOOGLE_SEARCH_CONSOLE', status: 'CONNECTED' }, { provider: 'GOOGLE_ANALYTICS_4', status: 'CONNECTED' }], totalClicks: 1828, lastSyncAt: '2026-10-14' },
  'entity-intelligence': { totalIncidents: 5, contradictedCount: 0, criticalCount: 0, resolvedCount: 5, lastRunAt: '2026-10-09' },
  'competitor-alerts': { totalChangesDetected: 11, unacknowledgedChanges: 0, highImpactChanges: 0, lastRunAt: '2026-10-14', lastAcknowledgedAt: '2026-10-14' },
  experiments: { totalExperiments: 3, runningCount: 2, concludedCount: 1, averageVisibilityLift: 6.4, lastRunAt: '2026-10-08' },
}
// soon: tools not available yet show as inert "Coming soon" rows (?mock=soon: only Site Kit is live)
const TK_SOON = {
  ...Object.fromEntries(Object.keys(TK_NEW).map((id) => [id, { soon: true }])),
  integrations: { connectedProviders: [], lastSyncAt: null },
}
export const toolkitSummaries = { full: TK_FULL, new: TK_NEW, healthy: TK_HEALTHY, soon: TK_SOON }

const SK_TODAY = '2026-10-13' // last full day of data
const skDays = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(`${SK_TODAY}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - (n - 1 - i)); return d.toISOString().slice(0, 10) })
const SK_DAYS = skDays(180) // 90 days + the 90 before them (for deltas)
// [query, landing page, share of clicks, base position]
const SK_QUERIES = [
  ['dermasuri', '/', 0.22, 1.2], ['vitamin c serum for dark spots', '/products/vitamin-c-serum', 0.12, 6.8], ['sunscreen without white cast', '/products/mineral-sunscreen-spf-50', 0.09, 8.4],
  ['dermasuri vitamin c serum review', '/products/vitamin-c-serum', 0.08, 2.9], ['best niacinamide serum for oily skin', '/products/niacinamide-booster', 0.07, 11.2],
  ['niacinamide vs vitamin c', '/blogs/journal/vitamin-c-vs-niacinamide', 0.07, 5.6], ['how to layer skincare', '/blogs/journal/how-to-layer-skincare', 0.06, 9.1],
  ['retinol serum for beginners', '/blogs/journal/retinol-for-beginners', 0.06, 12.4], ['mineral sunscreen spf 50', '/products/mineral-sunscreen-spf-50', 0.05, 14.7],
  ['what is azelaic acid', '/blogs/journal/what-is-azelaic-acid', 0.05, 7.3], ['ceramide moisturizer for dry skin', '/products/barrier-repair-balm', 0.04, 18.9],
  ['skin barrier repair', '/blogs/journal/skin-barrier-guide', 0.04, 15.2],
]
const skRand = mulberry32(2026)
// daily clicks: ~48/day 90+ days ago, rising to ~70/day now, weekends lower
const skDaily = SK_DAYS.map((date, i) => {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
  const trend = 46 + (i / SK_DAYS.length) * 26
  const clicks = Math.round(trend * (dow === 0 || dow === 6 ? 0.78 : 1.06) * (0.9 + skRand() * 0.2))
  return { date, clicks, impressions: Math.round(clicks * (24 + skRand() * 6)) }
})
// SearchPerformanceMetric rows { date, query, pageUrl, device, country, clicks, impressions, ctr, position }
export const skSearchMetrics = skDaily.flatMap((d) => SK_QUERIES.map(([query, page, share, pos]) => {
  const clicks = Math.round(d.clicks * share * (0.8 + skRand() * 0.4))
  const impressions = Math.max(clicks, Math.round(d.impressions * share * (pos > 10 ? 1.6 : 0.9) * (0.85 + skRand() * 0.3)))
  return { date: d.date, provider: 'GOOGLE_SEARCH_CONSOLE', query, pageUrl: `https://dermasuri.com${page}`, device: null, country: 'US', clicks, impressions, ctr: impressions ? Math.round((clicks / impressions) * 10000) / 100 : 0, position: Math.round((pos * (0.92 + skRand() * 0.16)) * 10) / 10 }
}))
// GAP: GA4 site totals per day (production stores AI-referral rows only)
export const skGa4Daily = SK_DAYS.map((date, i) => {
  const sessions = Math.round((220 + (i / SK_DAYS.length) * 70) * (0.88 + skRand() * 0.24))
  const users = Math.round(sessions * 0.81)
  return { date, users, sessions, engagedSessions: Math.round(sessions * (0.58 + skRand() * 0.06)), keyEvents: Math.round(sessions * 0.031 * (0.7 + skRand() * 0.6)) }
})
// AiReferralTrafficMetric rows { date, aiEngine, sourceDomain, landingPage, sessions, engagedSessions, conversions }
const SK_AI = [['ChatGPT', 'chatgpt.com', 9.5], ['Perplexity', 'perplexity.ai', 4.2], ['Gemini', 'gemini.google.com', 2.6], ['Copilot', 'copilot.microsoft.com', 1.4], ['Claude', 'claude.ai', 1.1]]
const SK_AI_PAGES = ['/products/vitamin-c-serum', '/blogs/journal/vitamin-c-vs-niacinamide', '/products/mineral-sunscreen-spf-50', '/blogs/journal/how-to-layer-skincare', '/pages/ingredients', '/products/niacinamide-booster']
export const skAiReferrals = SK_DAYS.flatMap((date, i) => SK_AI.map(([aiEngine, sourceDomain, base], k) => {
  const sessions = Math.max(0, Math.round(base * (0.55 + (i / SK_DAYS.length) * 0.9) * (0.7 + skRand() * 0.6)))
  return { date, aiEngine, sourceDomain, landingPage: SK_AI_PAGES[(i + k * 2) % SK_AI_PAGES.length], sessions, engagedSessions: Math.round(sessions * (0.62 + skRand() * 0.15)), conversions: skRand() < 0.06 ? 1 : 0 }
}))

// ProjectIntegration rows per state. accountName stands in for the account email (GAP: no email field).
const skIntegration = (provider, status, accountIdentifier) => ({
  id: `int_${provider}`, provider, status, accountIdentifier, accountName: status === 'DISCONNECTED' ? null : 'marketing@dermasuri.com',
  lastSyncAt: status === 'CONNECTED' ? '2026-10-14T06:00:00Z' : null, lastSyncStatus: status === 'CONNECTED' ? 'SUCCESS' : null, lastErrorMessage: null,
  tokenExpiresAt: status === 'EXPIRED' ? '2026-10-02T09:00:00Z' : null,
})
const GSC = 'GOOGLE_SEARCH_CONSOLE', GA4 = 'GOOGLE_ANALYTICS_4'
// canConnect: Connect / Reconnect lead somewhere (else the connection card is read-only) · canShowData: the connected
// sources' data can be shown (else the page is the connection card only)
export const siteKit = {
  canConnect: true,
  canShowData: true,
  today: SK_TODAY,
  states: {
    none: [skIntegration(GSC, 'DISCONNECTED', null), skIntegration(GA4, 'DISCONNECTED', null)],
    gsc: [skIntegration(GSC, 'CONNECTED', 'sc-domain:dermasuri.com'), skIntegration(GA4, 'DISCONNECTED', null)],
    expired: [skIntegration(GSC, 'EXPIRED', 'sc-domain:dermasuri.com'), skIntegration(GA4, 'DISCONNECTED', null)],
    connected: [skIntegration(GSC, 'CONNECTED', 'sc-domain:dermasuri.com'), skIntegration(GA4, 'CONNECTED', 'properties/318204771')],
    empty: [skIntegration(GSC, 'CONNECTED', 'sc-domain:dermasuri.com'), skIntegration(GA4, 'CONNECTED', 'properties/318204771')],
  },
}

// ---------------------------------------------------------------------------------------------------------------
// Toolkit tools, batch 1. Shaped from production (apps/api/src/modules/{crm-attribution,experiments,competitor-alerts});
// every result there is sample/simulated. GAP = the field doesn't exist in production. ?mock= picks a state per tool.

// ---- CRM & Revenue Attribution: CrmIntegrationConfig + AiConversionEvent
export const crmProviders = [ // enum CrmProvider (UI shows HubSpot, Salesforce, Pipedrive; Custom webhook in settings)
  { provider: 'HUBSPOT', name: 'HubSpot', domain: 'hubspot.com' },
  { provider: 'SALESFORCE', name: 'Salesforce', domain: 'salesforce.com' },
  { provider: 'PIPEDRIVE', name: 'Pipedrive', domain: 'pipedrive.com' },
  { provider: 'CUSTOM_WEBHOOK', name: 'Custom webhook', domain: null },
]
const CRM_ENGINES = [['chatgpt', 'chatgpt.com', 0.46], ['perplexity', 'perplexity.ai', 0.22], ['gemini', 'gemini.google.com', 0.15], ['copilot', 'copilot.microsoft.com', 0.09], ['claude', 'claude.ai', 0.08]]
// tracked prompts whose text matches, by id (keeps the mock's links on topic)
const promptsAbout = (re, n) => trackedPrompts.filter((p) => re.test(p.prompt)).slice(0, n).map((p) => p.id)
const CRM_PROMPTS = [...promptsAbout(/vitamin c/i, 3), ...promptsAbout(/sunscreen/i, 2), ...promptsAbout(/niacinamide/i, 2), ...promptsAbout(/moisturi/i, 1)] // GAP: no prompt on a conversion
const crmRand = mulberry32(77)
// AiConversionEvent { occurredAt, referralEngine, landingPageUrl, conversionType, conversionValue, currency } + promptKey (GAP)
export const crmConversions = SK_DAYS.slice(-60).flatMap((date, i) => {
  const n = Math.round((1.2 + i / 30) * (0.5 + crmRand()))
  return Array.from({ length: n }, (_, k) => {
    const x = crmRand()
    let acc = 0
    const [engine, domain] = CRM_ENGINES.find(([, , w]) => (acc += w) >= x) ?? CRM_ENGINES[0]
    return {
      id: `cv_${date}_${k}`, occurredAt: `${date}T${String(9 + k * 3).padStart(2, '0')}:20:00Z`, referralEngine: engine, sourceDomain: domain,
      landingPageUrl: `https://dermasuri.com${SK_AI_PAGES[Math.floor(crmRand() * SK_AI_PAGES.length)]}`,
      conversionType: 'PURCHASE', conversionValue: Math.round(32 + crmRand() * 64), currency: 'USD', crmSyncStatus: 'SYNCED',
      promptKey: CRM_PROMPTS[Math.floor(crmRand() * CRM_PROMPTS.length)],
    }
  })
})
const crmConfig = (status) => ({ id: 'cfg_hubspot', provider: 'HUBSPOT', status, endpointUrl: null, lastSyncedAt: status === 'ACTIVE' ? '2026-10-14T06:10:00Z' : null })
export const crmStates = {
  none: { configs: [], conversions: [] },
  empty: { configs: [crmConfig('ACTIVE')], conversions: [] }, // connected, nothing synced yet
  running: { configs: [crmConfig('ACTIVE')], conversions: crmConversions, syncing: { startedAt: '2026-10-14T11:58:20Z' } }, // GAP: no sync status
  error: { configs: [crmConfig('ERROR')], conversions: [], error: 'HubSpot didn’t accept the API key. Check it in HubSpot, then reconnect.' }, // GAP: status is a free string, only ACTIVE is set
  full: { configs: [crmConfig('ACTIVE')], conversions: crmConversions },
}

// ---- GEO Experiment Lab: GeoExperiment (+ GAP: pageUrl, promptKeys, windowDays, changedAt, per-prompt before/after)
const expSeries = (start, days, changeDay, before, after, seed) => {
  const r = mulberry32(seed)
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(`${start}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + i)
    const base = i < changeDay ? before : before + (after - before) * Math.min(1, (i - changeDay + 1) / 4)
    return { recordedAt: d.toISOString().slice(0, 10), visibilityScore: Math.round(base + (r() - 0.5) * 6) }
  })
}
export const experiments = [
  { id: 'exp_1', name: 'Answer capsule on the vitamin C serum page', status: 'RUNNING', experimentType: 'CONTENT_REVISION',
    hypothesis: 'A 50-word answer under the H1 gets the page quoted for “best vitamin C serum” prompts.',
    pageUrl: '/products/vitamin-c-serum', promptKeys: promptsAbout(/vitamin c/i, 6), windowDays: 14,
    startDate: '2026-10-01', changedAt: '2026-10-08', endDate: null, series: expSeries('2026-10-01', 14, 7, 41, 47, 3) },
  { id: 'exp_2', name: 'FAQ schema on the sunscreen collection', status: 'CONCLUDED', experimentType: 'SCHEMA_UPDATE',
    hypothesis: 'FAQ markup lets AI engines lift the answers straight from the collection page.',
    pageUrl: '/collections/sunscreen', promptKeys: promptsAbout(/sunscreen|spf/i, 8), windowDays: 14,
    startDate: '2026-09-03', changedAt: '2026-09-10', endDate: '2026-09-24', series: expSeries('2026-09-03', 22, 7, 38, 56, 5),
    perPrompt: [[34, 58], [41, 62], [29, 51], [44, 60], [36, 49], [40, 55], [52, 50], [33, 33]] }, // GAP: before/after per prompt
  { id: 'exp_3', name: 'Comparison table on the niacinamide guide', status: 'CONCLUDED', experimentType: 'CONTENT_REVISION',
    hypothesis: 'A side-by-side table helps “niacinamide vs vitamin C” answers cite the guide.',
    pageUrl: '/blogs/journal/vitamin-c-vs-niacinamide', promptKeys: promptsAbout(/niacinamide/i, 4), windowDays: 7,
    startDate: '2026-08-20', changedAt: '2026-08-27', endDate: '2026-09-03', series: expSeries('2026-08-20', 15, 7, 47, 43, 9),
    perPrompt: [[48, 45], [51, 44], [42, 40], [47, 43]] },
  { id: 'exp_4', name: 'Author bylines on journal articles', status: 'DRAFT', experimentType: 'CONTENT_REVISION',
    hypothesis: 'Naming the dermatologist who reviewed each article makes AI engines trust it more.',
    pageUrl: '/blogs/journal/skin-barrier-guide', promptKeys: promptsAbout(/barrier|ceramide/i, 3), windowDays: 14, startDate: null, changedAt: null, endDate: null, series: [] },
]
export const experimentStates = {
  none: { experiments: [] },
  running: { experiments, iterating: { startedAt: '2026-10-14T11:59:10Z' } }, // a check round in progress (production: run-iteration)
  error: { experiments, error: 'The last check round stopped: ChatGPT didn’t answer in time. Nothing was saved.' },
  full: { experiments },
}

// ---- Competitor Alerts: CompetitorContentChange (+ GAP: touchesPromptKeys, lastCheckedAt)
// changeType: NEW_PAGE CONTENT_UPDATE PRICING_CHANGE SCHEMA_UPDATE FACT_ADDITION (no "removed page" in the API)
export const watchedCompetitors = [ // CompetitorCandidate with isTracked
  { id: 'cc_cerave', name: 'CeraVe', domain: 'cerave.com' },
  { id: 'cc_ordinary', name: 'The Ordinary', domain: 'theordinary.com' },
  { id: 'cc_paulas', name: 'Paula’s Choice', domain: 'paulaschoice.com' },
]
export const competitorChanges = [
  { id: 'chg_1', competitorId: 'cc_ordinary', changeType: 'PRICING_CHANGE', url: 'https://theordinary.com/en-us/niacinamide-10-zinc-1', title: 'Price cut on Niacinamide 10% + Zinc 1%', summary: 'Price dropped from $6.50 to $5.90.', detectedAt: '2026-10-14T07:40:00Z', impactScore: 85, isAcknowledged: false,
    diffSnippet: '- Price: $6.50\n+ Price: $5.90\n+ Now 10% off in October', touchesPromptKeys: promptsAbout(/niacinamide/i, 3) },
  { id: 'chg_2', competitorId: 'cc_cerave', changeType: 'NEW_PAGE', url: 'https://cerave.com/skincare/vitamin-c-vs-niacinamide', title: 'New guide: Vitamin C vs niacinamide', summary: 'A new comparison guide with a FAQ section.', detectedAt: '2026-10-13T15:10:00Z', impactScore: 92, isAcknowledged: false,
    diffSnippet: '+ H1  Vitamin C vs niacinamide: can you use them together?\n+ H2  What does vitamin C do?\n+ H2  What does niacinamide do?\n+ FAQ  6 questions', touchesPromptKeys: [...promptsAbout(/vitamin c/i, 2), ...promptsAbout(/niacinamide/i, 2)] },
  { id: 'chg_3', competitorId: 'cc_paulas', changeType: 'SCHEMA_UPDATE', url: 'https://paulaschoice.com/skin-perfecting-2pct-bha', title: 'Review markup added to their BHA exfoliant', summary: 'Product page now publishes AggregateRating (4.6, 5,210 reviews).', detectedAt: '2026-10-13T09:25:00Z', impactScore: 74, isAcknowledged: false,
    diffSnippet: '+ "@type": "AggregateRating"\n+ "ratingValue": 4.6\n+ "reviewCount": 5210', touchesPromptKeys: promptsAbout(/salicylic|exfoliat/i, 2) },
  { id: 'chg_4', competitorId: 'cc_cerave', changeType: 'CONTENT_UPDATE', url: 'https://cerave.com/sunscreen/hydrating-mineral-sunscreen-spf-50', title: 'Mineral sunscreen page rewritten', summary: 'New “no white cast” claim and a dermatologist quote at the top.', detectedAt: '2026-10-12T18:05:00Z', impactScore: 68, isAcknowledged: false,
    diffSnippet: '- Gentle mineral protection for sensitive skin.\n+ Sheer, no white cast: tested on all skin tones.\n+ “Our go-to SPF for sensitive skin.” Dr. A. Patel, dermatologist', touchesPromptKeys: promptsAbout(/sunscreen/i, 3) },
  { id: 'chg_5', competitorId: 'cc_ordinary', changeType: 'FACT_ADDITION', url: 'https://theordinary.com/en-us/azelaic-acid-suspension-10', title: 'New claim on Azelaic Acid 10%', summary: 'Adds “visibly brightens in 4 weeks”.', detectedAt: '2026-10-11T11:30:00Z', impactScore: 61, isAcknowledged: true,
    diffSnippet: '+ Visibly brightens skin tone in 4 weeks*\n+ *Clinical study, 30 participants', touchesPromptKeys: [] },
  { id: 'chg_6', competitorId: 'cc_paulas', changeType: 'NEW_PAGE', url: 'https://paulaschoice.com/expert-advice/skincare-advice/basics/retinol-for-beginners', title: 'New guide: Retinol for beginners', summary: 'Step-by-step routine with a weekly schedule table.', detectedAt: '2026-10-10T08:45:00Z', impactScore: 79, isAcknowledged: true,
    diffSnippet: '+ H1  Retinol for beginners: how to start without irritation\n+ Table  Week 1–8 schedule', touchesPromptKeys: promptsAbout(/retinol/i, 3) },
  { id: 'chg_7', competitorId: 'cc_cerave', changeType: 'PRICING_CHANGE', url: 'https://cerave.com/moisturizers/daily-moisturizing-lotion', title: 'Price rise on Daily Moisturizing Lotion', summary: 'Price rose from $15.99 to $17.49.', detectedAt: '2026-10-09T13:00:00Z', impactScore: 55, isAcknowledged: true,
    diffSnippet: '- Price: $15.99\n+ Price: $17.49', touchesPromptKeys: [] },
]
export const competitorAlertStates = {
  none: { competitors: watchedCompetitors, changes: [], lastCheckedAt: null },
  running: { competitors: watchedCompetitors, changes: competitorChanges, lastCheckedAt: '2026-10-14T07:40:00Z', scanning: { startedAt: '2026-10-14T11:59:40Z' } },
  error: { competitors: watchedCompetitors, changes: competitorChanges, lastCheckedAt: '2026-10-14T07:40:00Z', error: 'cerave.com blocked our check (HTTP 403). The other two were checked.' },
  full: { competitors: watchedCompetitors, changes: competitorChanges, lastCheckedAt: '2026-10-14T07:40:00Z' }, // GAP: lastCheckedAt
}

// ---------------------------------------------------------------------------------------------------------------
// Billing (/billing, /billing/plans). Production (apps/api/src/modules/billing): Plan + Subscription + entitlements,
// seeded plans below (prices in USD cents, limits from PlanEntitlement `limit.*`, -1 = unlimited). NOT live there:
// no payment provider, invoices, payment methods, billing details or self-serve plan changes; limits are off unless
// BILLING_ENFORCEMENT is set. GAP = invented here. ?mock=trial|paid|near|failed|agency (default paid).
export const billingPlans = [
  { id: 'starter', slug: 'starter', tier: 'STARTER', name: 'Starter', priceMonthly: 9900, priceYearly: 99000,
    description: 'One brand, getting started with AI visibility', // GAP: seed has a description, this wording is the mock's
    limits: { prompts: 50, projects: 1, clients: 1, users: 3, competitors: 3, countries: 1, languages: 1, research_runs_monthly: 25, ai_runs_monthly: 100, crawl_pages_monthly: 500, content_generations_monthly: 10, mimic_runs_monthly: 0, reports_monthly: 5 },
    settings: { monitoring_frequency: 'weekly', data_retention_days: 30 },
    features: { competitor_monitoring: true } },
  { id: 'growth', slug: 'growth', tier: 'GROWTH', name: 'Growth', priceMonthly: 29900, priceYearly: 299000,
    description: 'A growing brand tracking several markets',
    limits: { prompts: 500, projects: 5, clients: 1, users: 10, competitors: 10, countries: 5, languages: 5, research_runs_monthly: 150, ai_runs_monthly: 3000, crawl_pages_monthly: 10000, content_generations_monthly: 50, mimic_runs_monthly: 100, reports_monthly: 25 },
    settings: { monitoring_frequency: 'daily', data_retention_days: 90 },
    features: { competitor_monitoring: true, citation_intelligence: true, content_intelligence: true, mimic_bot: true, experiments: true, advanced_reports: true, local_geo: true, multilingual_geo: true } },
  { id: 'agency-pro', slug: 'agency-pro', tier: 'AGENCY', name: 'Agency', priceMonthly: 59900, priceYearly: 599000, agencyOnly: true,
    description: 'Agencies running AI visibility for many clients',
    limits: { prompts: 5000, projects: 100, clients: 25, users: 20, competitors: 25, countries: 25, languages: 25, research_runs_monthly: 500, ai_runs_monthly: 15000, crawl_pages_monthly: 50000, content_generations_monthly: 250, mimic_runs_monthly: 500, reports_monthly: 100 },
    settings: { monitoring_frequency: 'daily', data_retention_days: 180 },
    features: { competitor_monitoring: true, citation_intelligence: true, content_intelligence: true, mimic_bot: true, experiments: true, advanced_reports: true, local_geo: true, multilingual_geo: true, white_label: true, ai_crawler_intelligence: true, api_access: true, content_studio: true } },
  { id: 'enterprise', slug: 'enterprise', tier: 'ENTERPRISE', name: 'Enterprise', priceMonthly: 199900, priceYearly: 1999000, contactSales: true, // GAP: seed isCustom=false; "Talk to us" is the mock's call
    description: 'Large teams that need everything, everywhere',
    limits: { prompts: -1, projects: -1, clients: -1, users: -1, competitors: -1, countries: -1, languages: -1, research_runs_monthly: -1, ai_runs_monthly: -1, crawl_pages_monthly: -1, content_generations_monthly: -1, mimic_runs_monthly: -1, reports_monthly: -1 },
    settings: { monitoring_frequency: 'realtime', data_retention_days: 730 },
    features: { competitor_monitoring: true, citation_intelligence: true, content_intelligence: true, mimic_bot: true, experiments: true, advanced_reports: true, local_geo: true, multilingual_geo: true, white_label: true, ai_crawler_intelligence: true, api_access: true, content_studio: true, sso: true, crm_attribution: true } },
]

const BILL_CARD = { brand: 'visa', last4: '4417', expMonth: 8, expYear: 2028 } // GAP: no PaymentMethod model
const BILL_DETAILS = { company: 'Dermasuri Skincare Inc.', email: 'billing@dermasuri.com', address: '1220 Abbot Kinney Blvd, Venice, CA 90291, USA', taxId: 'US EIN 84-2917360' } // GAP: only Agency.billingEmail exists
const bInvoices = (planName, cents, n, failedFirst = false) => Array.from({ length: n }, (_, i) => { // GAP: no Invoice model
  const d = new Date(Date.UTC(2026, 9 - i, 1))
  return { id: `in_${2026}${String(10 - i).padStart(2, '0')}`, date: d.toISOString().slice(0, 10), description: `${planName} plan · ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`, amount: cents, currency: 'usd', status: i === 0 && failedFirst ? 'failed' : 'paid' }
})
// tracked prompts by day for the last 30 days (GAP: no usage time series; UsageEvent is a raw ledger)
const promptHistory = (from, to) => Array.from({ length: 14 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10), prompts: Math.round(from + ((to - from) * i) / 13) }))
// usage = getBillingPeriodUsage items (current values); projects / users are live counts
export const billingStates = {
  trial: { workspace: 'Dermasuri', orgType: 'CLIENT', planId: 'starter', status: 'TRIALING', interval: 'month', currentPeriodStart: '2026-10-07', currentPeriodEnd: '2026-11-07', trialEnd: '2026-10-21',
    usage: { prompts: 38, projects: 1, users: 2, crawl_pages_monthly: 210, ai_runs_monthly: 46 }, paymentMethod: null, details: { ...BILL_DETAILS, taxId: null }, invoices: [], history: null },
  paid: { workspace: 'Dermasuri', orgType: 'CLIENT', planId: 'growth', status: 'ACTIVE', interval: 'month', currentPeriodStart: '2026-10-01', currentPeriodEnd: '2026-11-01',
    usage: { prompts: 152, projects: 2, users: 4, crawl_pages_monthly: 3120, ai_runs_monthly: 1240 }, paymentMethod: BILL_CARD, details: BILL_DETAILS, invoices: bInvoices('Growth', 29900, 8), history: promptHistory(141, 152) },
  near: { workspace: 'Dermasuri', orgType: 'CLIENT', planId: 'growth', status: 'ACTIVE', interval: 'month', currentPeriodStart: '2026-10-01', currentPeriodEnd: '2026-11-01',
    usage: { prompts: 468, projects: 4, users: 9, crawl_pages_monthly: 9310, ai_runs_monthly: 2210 }, paymentMethod: BILL_CARD, details: BILL_DETAILS, invoices: bInvoices('Growth', 29900, 8), history: promptHistory(402, 468) },
  failed: { workspace: 'Dermasuri', orgType: 'CLIENT', planId: 'growth', status: 'PAST_DUE', interval: 'month', currentPeriodStart: '2026-10-01', currentPeriodEnd: '2026-11-01',
    usage: { prompts: 152, projects: 2, users: 4, crawl_pages_monthly: 3120, ai_runs_monthly: 1240 }, paymentMethod: { ...BILL_CARD, last4: '0341', expMonth: 9, expYear: 2026 }, details: BILL_DETAILS, invoices: bInvoices('Growth', 29900, 8, true), history: promptHistory(141, 152) },
  agency: { workspace: 'PTA Agency', orgType: 'AGENCY', planId: 'agency-pro', status: 'ACTIVE', interval: 'year', currentPeriodStart: '2026-03-01', currentPeriodEnd: '2027-03-01',
    usage: { prompts: 1460, projects: 9, clients: 4, users: 7, crawl_pages_monthly: 18400, ai_runs_monthly: 6120 }, paymentMethod: { ...BILL_CARD, brand: 'mastercard', last4: '8802', expMonth: 3, expYear: 2029 },
    details: { company: 'PTA Agency LLC', email: 'accounts@pta.agency', address: '55 Water St, Brooklyn, NY 11201, USA', taxId: 'US EIN 93-1182044' }, invoices: [{ id: 'in_202603', date: '2026-03-01', description: 'Agency plan · yearly, Mar 2026 – Feb 2027', amount: 599000, currency: 'usd', status: 'paid' }], history: null },
}
export const billingToday = '2026-10-14'

// Billing is not live in production (no payment provider; limits off unless BILLING_ENFORCEMENT is set).
// billingLive = false matches that. Flip it here, or add ?live=1 to a billing URL, to see the paid-billing design.
export const billingLive = false

// "Talk to us" about Enterprise → production's generic contact endpoint, POST /auth/contact
// (ContactMessageDto { name, email, company?, website?, message 10–4000 chars }). It only writes an audit-log row today:
// no email goes out and no sales address is configured (GAP). The mock resolves after a short wait.
export async function sendSalesInquiry({ plan, name, email, company, size, need }) {
  const body = { name, email, company, message: `Enterprise inquiry (${plan}) · team size ${size}\n\n${need}` } // POST /auth/contact
  await sleep(600)
  return { ok: true, body }
}

// ---------------------------------------------------------------------------------------------------------------
// Toolkit batch 2. Shaped from production (apps/api/src/modules/{content,evidence,executive-reports}). GAP = invented.
// ?mock=none|running|error|full per tool (default full).

// ---- Content Intelligence: ContentGap (+ cluster topic), ContentDecayAudit, matches (page ↔ prompt)
// recommendedAction → suggested page wording; competitorEvidence.observedCompetitors = domains only (no URLs)
export const contentGaps = [
  { id: 'cg_1', clusterName: 'Vitamin C vs niacinamide', gapType: 'MISSING_COMPARISON', recommendedAction: 'COMPARISON', severity: 'HIGH', promptIds: promptsAbout(/vitamin c|niacinamide/i, 7), competitorEvidence: { observedCompetitors: ['cerave.com', 'theordinary.com', 'paulaschoice.com', 'byrdie.com'] },
    description: 'No page compares the two, and AI answers cite competitor comparison guides.', outline: null },
  { id: 'cg_2', clusterName: 'Sunscreen for oily skin', gapType: 'WEAK_TOPIC_COVERAGE', recommendedAction: 'CREATE', severity: 'HIGH', promptIds: promptsAbout(/oily/i, 5), competitorEvidence: { observedCompetitors: ['cerave.com', 'laroche-posay.us'] },
    description: 'The sunscreen pages don’t mention oily skin, which most of these prompts ask about.', outline: null },
  { id: 'cg_3', clusterName: 'Retinol for beginners', gapType: 'MISSING_FAQ', recommendedAction: 'FAQ', severity: 'MEDIUM', promptIds: promptsAbout(/retinol/i, 4), competitorEvidence: { observedCompetitors: ['paulaschoice.com', 'theordinary.com'] },
    description: 'People ask how often and how much; the guide has no FAQ answering that.', outline: null },
  { id: 'cg_4', clusterName: 'Dark spots and pigmentation', gapType: 'NO_RELEVANT_PAGE', recommendedAction: 'CREATE', severity: 'MEDIUM', promptIds: promptsAbout(/pigment|dark spot/i, 5), competitorEvidence: { observedCompetitors: ['cerave.com', 'theordinary.com', 'paulaschoice.com'] },
    description: 'There’s no page about treating dark spots at all.', outline: null },
  { id: 'cg_5', clusterName: 'Products for sensitive skin', gapType: 'WEAK_EVIDENCE', recommendedAction: 'STRUCTURED_EVIDENCE', severity: 'LOW', promptIds: promptsAbout(/sensitive/i, 4), competitorEvidence: { observedCompetitors: ['cerave.com'] },
    description: 'Claims of “gentle” have no test or dermatologist backing on the page.', outline: null },
  { id: 'cg_6', clusterName: 'Under-eye care', gapType: 'WEAK_INTENT_MATCH', recommendedAction: 'UPDATE', severity: 'LOW', promptIds: promptsAbout(/eye/i, 3), competitorEvidence: { observedCompetitors: ['theordinary.com', 'byrdie.com'] },
    description: 'The eye cream page sells the product but doesn’t answer “which is best for dark circles”.', outline: null },
]
// ContentDecayAuditDto { pageUrl, pageTitle, decayRisk, daysSinceLastUpdate, recommendation } + GAP: targetPromptId, suggestions[]
export const contentPages = [
  { id: 'cp_1', pageUrl: 'https://dermasuri.com/products/vitamin-c-serum', decayRisk: 'HIGH', daysSinceLastUpdate: 214, targetPromptId: promptsAbout(/vitamin c serum for dark/i, 1)[0], recommendation: 'No answer to the question in the first paragraph',
    suggestions: ['Open with a 40–60 word answer: what it does, for whom, how to use it.', 'Add the 15% concentration and pH in a short spec list.', 'Link the vitamin C vs niacinamide guide.'] },
  { id: 'cp_2', pageUrl: 'https://dermasuri.com/collections/sunscreen', decayRisk: 'MEDIUM', daysSinceLastUpdate: 160, targetPromptId: promptsAbout(/sunscreen without white cast/i, 1)[0], recommendation: 'Doesn’t say which sunscreen leaves no white cast',
    suggestions: ['Add a one-line “no white cast” note to each product card.', 'Add an FAQ: “Which sunscreen doesn’t leave a white cast?”'] },
  { id: 'cp_3', pageUrl: 'https://dermasuri.com/blogs/journal/retinol-for-beginners', decayRisk: 'MEDIUM', daysSinceLastUpdate: 402, targetPromptId: promptsAbout(/retinol serum for beginners/i, 1)[0], recommendation: 'Out of date: last updated over a year ago',
    suggestions: ['Show an “Updated” date and a reviewer.', 'Replace the 2024 product list with current ones.', 'Answer “how often should beginners use retinol” in one sentence.'] },
  { id: 'cp_4', pageUrl: 'https://dermasuri.com/products/niacinamide-booster', decayRisk: 'LOW', daysSinceLastUpdate: 96, targetPromptId: promptsAbout(/niacinamide serum for oily/i, 1)[0], recommendation: 'Never mentions oily skin, the main use people ask about',
    suggestions: ['Say who it’s for in the first line: oily, acne-prone skin.', 'Add the 10% concentration.'] },
]
export const contentStates = {
  none: { gaps: [], pages: [], lastRunAt: null },
  running: { gaps: contentGaps, pages: contentPages, lastRunAt: '2026-10-05T09:00:00Z', diagnosing: { startedAt: '2026-10-14T11:59:30Z' } },
  error: { gaps: contentGaps, pages: contentPages, lastRunAt: '2026-10-05T09:00:00Z', error: 'The diagnosis stopped: the latest visibility scan isn’t finished yet. Try again when it is.' },
  full: { gaps: contentGaps, pages: contentPages, lastRunAt: '2026-10-05T09:00:00Z' }, // GAP: lastRunAt
}

// ---- Evidence Vault: CentralEvidenceItem { claim, evidenceType, source, url, extract, confidenceTier, isUserVerified }
// GAP: backed / weak / unbacked (mapped from confidenceTier HIGH / MEDIUM+LOW / UNVERIFIED), several sources per claim,
// source titles, the page a claim is on.
const ev = (id, claim, page, tier, sources) => ({ id, claim, pageUrl: `https://dermasuri.com${page}`, confidenceTier: tier, isUserVerified: tier === 'HIGH', sources })
const src = (domain, title, path = '') => ({ domain, title, url: `https://${domain}${path}` })
export const evidenceItems = [
  ev('ev_1', '15% L-ascorbic acid brightens skin in 8 weeks', '/products/vitamin-c-serum', 'HIGH', [src('pubmed.ncbi.nlm.nih.gov', 'Topical vitamin C in skin pigmentation: a review', '/28155427'), src('aad.org', 'How to treat dark spots', '/public/everyday-care/dark-spots')]),
  ev('ev_2', 'Fragrance-free and safe for sensitive skin', '/products/gentle-gel-cleanser', 'MEDIUM', [src('aad.org', 'Sensitive skin: what to look for', '/public/everyday-care/sensitive-skin')]),
  ev('ev_3', 'Dermatologist tested on 120 people', '/products/barrier-repair-balm', 'UNVERIFIED', []),
  ev('ev_4', 'SPF 50 with no white cast on any skin tone', '/products/mineral-sunscreen-spf-50', 'LOW', [src('consumerreports.org', 'Best mineral sunscreens', '/sunscreens/mineral')]),
  ev('ev_5', 'Niacinamide 10% reduces oil in 4 weeks', '/products/niacinamide-booster', 'HIGH', [src('pubmed.ncbi.nlm.nih.gov', 'Niacinamide and sebum excretion rate', '/16766484'), src('healthline.com', 'Niacinamide: benefits and uses', '/health/niacinamide')]),
  ev('ev_6', 'Retinol at night only; start twice a week', '/blogs/journal/retinol-for-beginners', 'HIGH', [src('aad.org', 'How to use retinoids', '/public/everyday-care/retinoids'), src('mayoclinic.org', 'Retinoids for skin', '/retinoids')]),
  ev('ev_7', 'Vegan and cruelty-free', '/pages/about', 'UNVERIFIED', []),
  ev('ev_8', 'Azelaic acid is safe in pregnancy', '/blogs/journal/what-is-azelaic-acid', 'MEDIUM', [src('acog.org', 'Skin care during pregnancy', '/womens-health/skin')]),
  ev('ev_9', 'Ceramides repair the skin barrier', '/blogs/journal/skin-barrier-guide', 'HIGH', [src('pubmed.ncbi.nlm.nih.gov', 'Ceramides and barrier function', '/30117349'), src('aad.org', 'Dry skin care', '/public/everyday-care/dry-skin')]),
  ev('ev_10', 'Best-selling vitamin C serum in the US', '/products/vitamin-c-serum', 'UNVERIFIED', []),
  ev('ev_11', 'Mineral filters are gentler than chemical ones', '/blogs/journal/is-mineral-sunscreen-better', 'LOW', [src('healthline.com', 'Mineral vs chemical sunscreen', '/health/mineral-sunscreen')]),
  ev('ev_12', 'Hyaluronic acid holds 1,000× its weight in water', '/products/hyaluronic-moisturizer', 'MEDIUM', [src('healthline.com', 'Hyaluronic acid uses', '/health/hyaluronic-acid')]),
]
export const evidenceStates = {
  none: { items: [] },
  running: { items: evidenceItems, syncing: { startedAt: '2026-10-14T11:59:40Z' } },
  error: { items: evidenceItems, error: 'Sync stopped: the crawl for 4 pages is still running.' },
  full: { items: evidenceItems },
}

// ---- Executive Reports: ReportExportLog + ExecutiveReportSchedule (+ GAP: period, draft/scheduled/sent, sections used)
export const execReports = [
  { id: 'rep_3', title: 'October performance', period: { from: '2026-10-01', to: '2026-10-31' }, createdAt: '2026-10-12T10:00:00Z', recipients: [], status: 'DRAFT', sections: ['visibility', 'prompts', 'citations', 'audit'] },
  { id: 'rep_2', title: 'Q3 review for the board', period: { from: '2026-07-01', to: '2026-09-30' }, createdAt: '2026-10-02T09:00:00Z', recipients: ['ceo@dermasuri.com', 'cmo@dermasuri.com', 'growth@dermasuri.com'], status: 'SENT', sections: ['visibility', 'prompts', 'citations', 'audit', 'structured', 'trends'] },
  { id: 'rep_1', title: 'Monthly visibility', period: { from: '2026-09-01', to: '2026-09-30' }, createdAt: '2026-09-28T08:00:00Z', recipients: ['marketing@dermasuri.com', 'cmo@dermasuri.com'], status: 'SCHEDULED', cadence: 'MONTHLY', sections: ['visibility', 'prompts', 'citations'] },
]
export const execReportStates = {
  none: { reports: [] },
  running: { reports: execReports, generating: { startedAt: '2026-10-14T11:59:50Z' } },
  error: { reports: execReports, error: 'The PDF for “October performance” didn’t generate. Nothing was sent.' },
  full: { reports: execReports },
}
// What a report shows per section. GAP: production's report is one fixed list of six summary metrics
// (ExecutiveReportSummaryMetrics; includeSections is accepted but ignored), so every section below is invented.
export const execReportSections = {
  visibility: { label: 'Visibility', summary: 'You appeared in 73% of AI answers, up 6 points, and still lead every competitor.', items: [
    { label: 'Visibility score', value: 73, meta: '▲ 6 vs last period' }, { label: 'Prompts you appear in', value: 111, unit: 'of 152', meta: 'Across 4 engines' },
    { label: 'Share of answers', value: '75%', meta: 'CeraVe is next at 18%' }, { label: 'Best engine', value: 'Google', meta: 'AI Overviews' }] },
  prompts: { label: 'Prompts', summary: 'You won 9 prompts and lost 3. Most of the wins are sunscreen questions.', items: [
    { label: 'Prompts won', value: 9, meta: 'New this period' }, { label: 'Prompts lost', value: 3, meta: 'To CeraVe and The Ordinary' },
    { label: 'Still missed', value: 41, meta: '12 are pigmentation' }, { label: 'Prompts added', value: 12, meta: 'From the Sunscreen launch list' }] },
  citations: { label: 'Citations', summary: 'AI cited your pages 36 times. 14 sites cite competitors but not you yet.', items: [
    { label: 'Citations to your site', value: 36, meta: '▲ 8 vs last period' }, { label: 'Your pages cited', value: 7, meta: 'The vitamin C serum leads' },
    { label: 'Share of citations', value: '18%', meta: 'Of all sources cited' }, { label: 'Sites to win', value: 14, meta: 'Cite competitors only' }] },
  audit: { label: 'Site Audit', summary: 'Your site scores 82. 23 issues were fixed; 6 pages still fail a check AI relies on.', items: [
    { label: 'Site score', value: 82, meta: '▲ 4 vs last period' }, { label: 'Pages crawled', value: 412, meta: 'Every page on the sitemap' },
    { label: 'Issues fixed', value: 23, meta: 'Since the last report' }, { label: 'Pages still failing', value: 6, meta: 'Mostly missing answers' }] },
  structured: { label: 'Structured Data', summary: '64% of pages now describe themselves to AI with schema, up from 51%.', items: [
    { label: 'Pages with schema', value: '64%', meta: '▲ 13 points' }, { label: 'Schema errors', value: 4, meta: 'On product pages' },
    { label: 'Types added', value: 5, meta: 'FAQ, Product, Review…' }, { label: 'Rich results', value: 128, meta: 'Eligible pages' }] },
  trends: { label: 'Trends', summary: 'News and social talk about you is mostly positive (net +32), driven by the SPF launch.', items: [
    { label: 'Net tone', value: '+32', meta: 'Mostly positive' }, { label: 'Questions watched', value: 8, meta: 'In the United States' },
    { label: 'Mentions', value: '2.4k', meta: 'News, X and Instagram' }, { label: 'Biggest topic', value: 'SPF', meta: 'The launch in September' }] },
}

// ---------------------------------------------------------------------------
// Preview: a brand on its first sync with nothing visible yet (?preview=first-sync): one sync, no deltas or "vs last
// sync", every tracked prompt missed, no citations, competitors still in the answers. The data above is trimmed in
// place so every page (and brandViews, which reads it after) sees the same brand.
const PREVIEW = (() => { try { return new URLSearchParams(window.location.search).get('preview') } catch { return null } })()
if (PREVIEW === 'first-sync') {
  const keepLast = (arr) => arr.splice(0, Math.max(0, arr.length - 1))
  keepLast(recentSyncs); keepLast(history); keepLast(historyMonthly); syncHistory.splice(1)
  syncHistory.forEach((r) => { r.visibility = 0; r.mentions = 0; r.cited = 0; r.missed += r.visible; r.visible = 0; r.delta = null; r.changes = null })
  history.forEach((p) => { p.dermasuri = 0 }); historyMonthly.forEach((p) => { p.dermasuri = 0 })
  visiblePrompts.splice(0)
  for (let i = trackedPrompts.length - 1; i >= 0; i--) if (trackedPrompts[i].status === 'visible') trackedPrompts.splice(i, 1)
  Object.assign(kpis, { score: 0, scoreDelta: null, visible: 0, missed: trackedPrompts.length, total: trackedPrompts.length, citedSources: 0 })
  platforms.forEach((p) => { p.visible = 0; p.cited = 0 })
  if (citationsMentions[account.domain]) Object.keys(citationsMentions[account.domain]).forEach((e) => { citationsMentions[account.domain][e] = [0, 0] })
  competitors.forEach((c) => { if (c.you) c.share = 0 })
}
