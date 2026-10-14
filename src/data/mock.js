// All dashboard data. No backend.
// NOTE: rows marked PLACEHOLDER must be replaced with the exact rows from the live-site screenshots.
import { brandName } from '../utils/brand.js' // .js: the unit tests load this file in plain Node

export const account = {
  name: 'Dermasuri',
  plan: 'PTA · Agency',
  domain: 'dermasuri.com',
  llm: 'Google AI Overview',
  lastSync: 'Oct 5, 2026',
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
  { domain: 'dermasuri.com', share: 73, you: true },
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
export function getHistory({ compare = true, hidden = [], granularity = 'weekly', range, focal = 'dermasuri', scale = null } = {}) {
  const gran = granularity === 'monthly' ? 'monthly' : 'weekly'
  const raw = gran === 'monthly' ? historyMonthly : [...historyEarlier, ...history]
  const all = !scale ? raw : raw.map((p) => ({ ...p, ...Object.fromEntries(historySeries.map((s) => [s.key, Math.round(p[s.key] * (scale[s.key] ?? 1))])) }))
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
  const you = points.map((p) => p[focal])
  const last = points[points.length - 1]
  const best = points.reduce((a, p) => (p[focal] > a[focal] ? p : a), points[0])
  const unit = gran === 'monthly' ? 'month' : 'week'
  // competitors alone sit at 3–21%: on 0–100 they'd be flat lines along the floor, so fit them
  const axis = !compare ? fitDomain(you)
    : youHidden ? fitDomain(points.flatMap((p) => series.map((s) => p[s.key])))
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
      current: last[focal],
      change: last.delta,
      unit,
      best: best[focal],
      bestLabel: best === last ? `this ${unit}` : gran === 'monthly' ? best.date : `${best.date}, 2026`,
      average: Math.round(you.reduce((a, b) => a + b, 0) / you.length),
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
// /setup: tracked brands (with competitors) and the marketplaces they sell on.
// Marketplace stats come from the Marketplace visibility card (Target 12, Amazon 8).
// ---------------------------------------------------------------------------
export const MAX_COMPETITORS = 5 // same limit on the Setup card and in the brand modal
// marketplaces belong to the brand; stats from the Marketplace visibility card (Target 12, Amazon 8)
const brandMarketplaces = (() => {
  const listings = Object.fromEntries(marketplace.segments.find((s) => s.key === 'yours').rows.map((r) => [r.label, r.value]))
  return [
    { id: 'm1', name: 'Amazon', domain: 'amazon.com', cited: listings.Amazon ?? 0 },
    { id: 'm2', name: 'Target', domain: 'target.com', cited: listings.Target ?? 0 },
    { id: 'm3', name: 'Ulta', domain: 'ulta.com', cited: 0 },
  ]
})()
// (platforms, market, schedule and quota live in src/store/trackingSettings.js, edited on /llm-settings)

// "Citations and Mentions" card: per brand → per engine [mentions, citations] (engines not listed = 0).
// Totals are always summed from these rows.
export const citationsMentions = {
  'dermasuri.com': { aio: [111, 30], gemini: [90, 2], chatgpt: [54, 4] },
  'cerave.com': { aio: [33, 9], gemini: [23, 3], chatgpt: [18, 2] },
  'theordinary.com': { aio: [8, 2], gemini: [5, 0], chatgpt: [6, 0] },
  'paulaschoice.com': { aio: [6, 1], gemini: [3, 0], chatgpt: [5, 0] },
}

// name variants spotted in AI answers that aren't aliases yet (Setup → "Suggested")
export const aliasSuggestions = ['Derma Suri', 'dermasuri.co']
// answers each name variant was seen in (alias chip "· 6", suggestion tooltip "Seen in 3 answers")
// the agency's other client workspaces (sidebar workspace switcher); not loaded in this demo
export const agencyClients = [
  { name: 'Lumen Skin', domain: 'lumenskin.com' },
  { name: 'Brightside Botanics', domain: 'brightsidebotanics.com' },
]

export const aliasAnswers = { 'Derma Suri': 6, 'dermasuri.co': 3 }

// Setup → Products & topics. type: 'product' (has a product page) | 'topic'; thumb: the product page's image (mock).
const thumb = (bg, fill, shape) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="${bg}"/>${shape(fill)}</svg>`)}`
const dropper = (f) => `<rect x="21" y="7" width="6" height="9" rx="2" fill="#3f3a36"/><rect x="16" y="15" width="16" height="26" rx="4" fill="${f}"/><rect x="19" y="23" width="10" height="9" rx="1.5" fill="#fff" opacity=".85"/>`
const jar = (f) => `<rect x="11" y="15" width="26" height="7" rx="2" fill="#3f3a36"/><rect x="9" y="21" width="30" height="17" rx="5" fill="${f}"/><rect x="17" y="26" width="14" height="7" rx="1.5" fill="#fff" opacity=".85"/>`
export const productsTopics = [
  { name: 'Vitamin C serum', type: 'product', thumb: thumb('#FBEEDC', '#E8A33D', dropper) },
  { name: 'Ceramide moisturizer', type: 'product', thumb: thumb('#EEF1F4', '#B9C6D3', jar) },
  { name: 'Niacinamide serum', type: 'product', thumb: thumb('#EFEDF6', '#A79FC9', dropper) },
  { name: 'Under-eye cream', type: 'product' }, // no image on its page: category icon
  { name: 'Body lotion', type: 'product' },
  { name: 'Sunscreen', type: 'topic' },
  { name: 'Retinol', type: 'topic' },
]
// pages found on the site that no product/topic covers yet
export const topicSuggestions = [{ name: 'Hyaluronic serum', type: 'product', reason: 'Found on your site, not in your list yet' }]

export const setupBrands = [
  {
    // displayName: what the user typed (null = never set → name falls back to brandName(domain))
    id: 'b1', name: account.name, displayName: account.name, type: 'website', domain: account.domain, logo: null,
    prompts: trackedPrompts.length, visible: kpis.visible, visibility: kpis.score, visibilityDelta: kpis.scoreDelta,
    since: 'Mar 2026', lastSync: account.lastSync.replace(/, \d{4}$/, ''),
    aliases: [], // none yet: Setup suggests the variants seen in answers
    topics: productsTopics.map((t) => ({ ...t })), // Products & topics
    // when each alias / competitor was added ("alias:<name>" / "competitor:<entry>"), shown on the Setup rows
    addedOn: { 'competitor:cerave.com': 'Sep 12', 'competitor:theordinary.com': 'Sep 12', 'competitor:paulaschoice.com': 'Sep 21' },
    marketplaceCitations: { total: marketplace.cited, yours: marketplace.yours },
    competitors: competitors.filter((c) => !c.you).sort((a, b) => b.share - a.share).map((c) => c.domain),
    marketplaces: brandMarketplaces,
  },
]
