// POST /api/missed-prompts/content-recommend (Harsh's branch fix/demo-qa-stability: app/api/missed-prompts/
// content-recommend/route.js, lib/content-format-recommend.js, lib/content-draft-for-prompt.js). Sample responses, one
// per missed prompt (data/mock.js missedPrompts), on its topic. The shape mirrors the route exactly; no field the route
// doesn't return.
//   request:  { prompt, brandDomain, brandName, competitors, sources, targetUserId }   (requestFor below)
//     + PROPOSED userFacts { facts, answers, documentsText } (Your data, pages/opportunities/data/userFacts.js): the
//     route doesn't take it yet. The mock's response for prompt 0 (best azelaic acid cream for rosacea, the "clinic"
//     variant) uses a location from it, and every sample drops the flags it answers (see reviewFlags).
//   response: { ok, analyzedAt, brandDomain, brandName, prompt, coverage, ourFormats, formats, recommendations, angles,
//     citedPages, pageRecommendation, evidence, contentMarkdown, contentSource, contentComplete, contentIssues,
//     expertReview, brandFactsAvailable, flags, reviewScore }
// Each sample is built the way the server builds it, so the fields agree with each other: the format scores follow
// recommendContentFormats (base × who uses it), the page choice follows the route (update a deep brand page with ≥3
// prompt words, else create /guides/<slug>), the Markdown follows the draft lib's structure (and its fallback for the
// template sample), and the flags follow buildReviewFlags' rules and scores. The words are made up; the competitor
// domains are the mock's tracked brands. ?co=hostile serves a draft with hostile Markdown (script, img onerror,
// javascript: links) for the safe-rendering check.
import { brands as MOCK_BRANDS, missedPrompts } from './mock.js'
import { RM_COMPETITOR_NAMES, RM_RESPONSE, RM_ROW } from './contentRecommendRm.js'
import { CO_BRAND } from './contentOpportunities.js'
import { coStates } from './contentOpportunities-proposed.js'

// lib/content-format-recommend.js CONTENT_FORMATS (the 10 format ids)
export const CONTENT_FORMATS = [
  { id: 'listicle', label: 'Best-of / listicle' },
  { id: 'how_to', label: 'How-to guide' },
  { id: 'research', label: 'Original research / data' },
  { id: 'faq', label: 'FAQ' },
  { id: 'comparison', label: 'Comparison / vs' },
  { id: 'tutorial', label: 'Step-by-step tutorial' },
  { id: 'stats', label: 'Statistical roundup' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'case_study', label: 'Case study' },
  { id: 'template', label: 'Template / framework' },
]
const FORMAT_IDS = CONTENT_FORMATS.map((f) => f.id)
export const formatLabel = (id) => CONTENT_FORMATS.find((f) => f.id === id)?.label ?? id
const DEFAULT_BASE = { listicle: 2, how_to: 3, research: 2, faq: 3, comparison: 2, tutorial: 3, stats: 2, checklist: 1, case_study: 2, template: 1 }
// the lib's industryBaseForPrompt (the how/steps bump)
const baseFor = (prompt) => {
  const base = { ...DEFAULT_BASE }
  if (/\b(how|grow|steps?|process|works?)\b/.test(prompt.toLowerCase())) Object.assign(base, { how_to: 3, tutorial: 3, checklist: 2 })
  if (/\b(best|top|vs|under)\b/.test(prompt.toLowerCase())) Object.assign(base, { listicle: 3, comparison: 3 })
  return base
}
const rankWeight = (rank) => (rank === 1 ? 3 : rank <= 3 ? 2 : rank <= 10 ? 1 : 0)

// deterministic numbers per key
const hash = (s) => [...String(s)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261) // FNV-1a
const rnd = (key, salt) => (hash(`${key}|${salt}`) % 10000) / 10000
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }
const pathOf = (url) => { try { return new URL(url).pathname } catch { return url } }
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ---- the topics: what each product is, how it's used, what to watch, and its forms (made up, plain advice) --------
const PRODUCTS = {
  'azelaic acid cream': { what: 'a cream with azelaic acid, which calms redness and evens tone', use: 'a thin layer once a day after cleansing', watch: 'a short tingle in the first week', pick: 'a 10% leave-on cream with a fragrance-free base', forms: [['Cream', 'richer, suits dry skin'], ['Gel', 'lighter, suits oily skin'], ['Serum', 'layers under moisturiser']] },
  'kojic acid soap': { what: 'a cleansing bar with kojic acid, which fades uneven tone over weeks', use: 'a 30-second lather on damp skin, then rinse', watch: 'dryness if you use it twice a day', pick: 'a bar with glycerin and no added fragrance', forms: [['Bar soap', 'quick, but rinses off fast'], ['Serum', 'stays on skin longer'], ['Cream', 'gentler for dry skin']] },
  'alpha arbutin serum': { what: 'a serum with alpha arbutin, a gentle brightener for dark spots', use: '2–3 drops morning and night before moisturiser', watch: 'slow results: give it 8 weeks', pick: 'a 2% serum in an opaque bottle', forms: [['2% serum', 'the usual starting strength'], ['Serum with niacinamide', 'pairs brightening with oil control'], ['Cream', 'for dry skin that dislikes serums']] },
  'spf 50 gel sunscreen': { what: 'a broad-spectrum sunscreen in a light gel texture', use: 'two finger-lengths for face and neck, every morning', watch: 'reapplying every two hours outdoors', pick: 'SPF 50, broad spectrum, and a matte finish', forms: [['Gel', 'light and quick to absorb'], ['Fluid', 'thin and easy under makeup'], ['Cream', 'more moisture for dry skin']] },
  'peptide serum': { what: 'a serum with peptides that support firmer-looking skin', use: '2–3 drops at night after cleansing', watch: 'patience: changes show over 8–12 weeks', pick: 'a fragrance-free serum with a short ingredient list', forms: [['Peptide serum', 'the lightest option'], ['Peptide cream', 'adds moisture'], ['Eye cream', 'for the under-eye area only']] },
  'skin barrier': { what: 'the outer layer that keeps moisture in and irritants out', use: 'a gentle cleanser and a ceramide moisturiser twice a day', watch: 'too many actives at once', pick: 'a moisturiser with ceramides, cholesterol and fatty acids', forms: [['Ceramide cream', 'rebuilds the barrier'], ['Balm', 'seals in moisture overnight'], ['Gentle cleanser', 'stops the damage first']] },
  'lip balm': { what: 'a balm that protects and conditions the lips', use: 'a thin coat through the day and a thicker one at night', watch: 'flavoured balms that sting', pick: 'a balm with SPF for daytime and shea butter for night', forms: [['SPF balm', 'daytime protection'], ['Night balm', 'richer repair'], ['Tinted balm', 'evens colour a little']] },
  'tranexamic acid serum': { what: 'a serum with tranexamic acid that targets stubborn dark patches', use: '2–3 drops once or twice a day under sunscreen', watch: 'results fade without daily sunscreen', pick: 'a 2–5% serum that also has niacinamide', forms: [['Serum', 'the most common form'], ['Toner', 'lighter, for layering'], ['Cream', 'for dry skin']] },
  'body lotion': { what: 'a body lotion that softens rough, bumpy skin', use: 'a palmful on damp skin after showering', watch: 'scrubbing the bumps, which makes them worse', pick: 'a lotion with urea or lactic acid', forms: [['Lotion', 'spreads easily'], ['Cream', 'richer for very dry skin'], ['Exfoliating wash', 'a gentle start in the shower']] },
  'face mist': { what: 'a spray that adds a quick layer of hydration', use: 'a few sprays, then moisturiser on top', watch: 'mists with alcohol, which dry the skin', pick: 'a mist with glycerin or hyaluronic acid', forms: [['Hydrating mist', 'water-light moisture'], ['Setting mist', 'holds makeup'], ['Toner mist', 'adds a gentle active']] },
  'niacinamide serum': { what: 'a serum with niacinamide that balances oil and evens tone', use: '2–3 drops morning or night before moisturiser', watch: 'starting too strong: 5% is plenty', pick: 'a 5–10% serum with zinc for oily skin', forms: [['5% serum', 'gentle start'], ['10% serum', 'stronger oil control'], ['Moisturiser with niacinamide', 'one step instead of two']] },
  'sunscreen for oily skin': { what: 'a sunscreen made to stay matte on oily skin', use: 'two finger-lengths every morning as the last step', watch: 'heavy creams that clog pores', pick: 'an oil-free, non-comedogenic SPF 30–50', forms: [['Gel', 'stays matte'], ['Fluid', 'light under makeup'], ['Stick', 'easy to reapply']] },
  'dark spot corrector': { what: 'a treatment that fades dark spots over time', use: 'a thin layer on the spots once or twice a day', watch: 'skipping sunscreen, which undoes the progress', pick: 'one with niacinamide, vitamin C or alpha arbutin', forms: [['Spot treatment', 'targets single spots'], ['Serum', 'evens the whole face'], ['Cream', 'for dry skin']] },
  'pigmentation serum': { what: 'a serum that fades dark spots and uneven tone', use: '2–3 drops at night, sunscreen in the morning', watch: 'stacking several brighteners at once', pick: 'a single-active serum to start', forms: [['Single-active serum', 'easy to tell what works'], ['Multi-active serum', 'faster, but more to tolerate'], ['Cream', 'for dry or sensitive skin']] },
  'salicylic acid face wash': { what: 'a cleanser with salicylic acid that clears pores', use: 'a 30-second massage, once a day', watch: 'using it twice a day at first, which can dry the skin', pick: 'a 0.5–2% wash without harsh scrubs', forms: [['Gel wash', 'for oily skin'], ['Cream wash', 'gentler on dry patches'], ['Foam', 'light and quick']] },
  'night cream': { what: 'a richer cream that repairs skin overnight', use: 'a pea-sized amount as the last step at night', watch: 'very heavy creams on acne-prone skin', pick: 'ceramides, glycerin and a fragrance-free formula', forms: [['Cream', 'balanced moisture'], ['Balm', 'for very dry skin'], ['Gel cream', 'lighter for humid nights']] },
  'retinol': { what: 'a vitamin A ingredient that smooths texture and fine lines', use: 'a pea-sized amount two nights a week to start', watch: 'peeling if you start every night', pick: 'a 0.1–0.3% retinol in a moisturising base', forms: [['Low-strength serum', 'the gentlest start'], ['Cream', 'buffers irritation'], ['Encapsulated retinol', 'slower release']] },
  'acne scar treatment': { what: 'a treatment that softens the look of marks and scars', use: 'as directed, usually at night, with sunscreen by day', watch: 'expecting deep scars to fade from a cream alone', pick: 'retinoids or acids for marks; a professional for deep scars', forms: [['Serum', 'for flat marks'], ['Exfoliating treatment', 'smooths texture'], ['In-clinic treatment', 'for deeper scars']] },
  'ceramide cream': { what: 'a moisturiser with ceramides that supports the skin barrier', use: 'a thin layer morning and night', watch: 'very thick textures on oily skin', pick: 'a non-comedogenic cream with three ceramides', forms: [['Cream', 'all-round barrier care'], ['Lotion', 'lighter for oily skin'], ['Balm', 'for very dry patches']] },
  'exfoliating toner': { what: 'a toner with mild acids that clears dead skin', use: 'a cotton pad over the face two or three nights a week', watch: 'using it every day at first', pick: 'a low-strength lactic or salicylic acid toner', forms: [['Lactic acid toner', 'gentle for dry skin'], ['Salicylic acid toner', 'for oily skin'], ['PHA toner', 'for sensitive skin']] },
  'tinted sunscreen': { what: 'a sunscreen with a sheer tint that evens skin tone', use: 'two finger-lengths every morning, blended out', watch: 'thin layers that don’t reach the stated SPF', pick: 'SPF 30–50 with iron oxides for visible light', forms: [['Tinted fluid', 'sheer coverage'], ['Tinted cream', 'more moisture'], ['Tinted stick', 'easy top-ups']] },
  'vitamin C serum': { what: 'a serum with vitamin C that brightens and protects', use: '3–4 drops in the morning under sunscreen', watch: 'serums that turn dark orange, which have oxidised', pick: 'a stable form in an opaque, airtight bottle', forms: [['L-ascorbic acid', 'strongest, least stable'], ['Ethyl ascorbic acid', 'stable and gentle'], ['Vitamin C cream', 'for dry skin']] },
  'hyaluronic acid moisturizer': { what: 'a moisturiser with hyaluronic acid that holds water in the skin', use: 'on damp skin, morning and night', watch: 'very dry rooms, where it helps to seal it with a cream', pick: 'a moisturiser with several weights of hyaluronic acid', forms: [['Gel cream', 'light for oily skin'], ['Cream', 'for dry skin'], ['Serum + cream', 'two steps for the driest skin']] },
  'gentle cleanser': { what: 'a low-foam cleanser that doesn’t strip the skin', use: 'a 30-second massage on damp skin, rinse with lukewarm water', watch: 'hot water and rough cloths', pick: 'a fragrance-free cleanser with a skin-friendly pH', forms: [['Cream cleanser', 'for dry skin'], ['Gel cleanser', 'for oily skin'], ['Micellar water', 'no rinse needed']] },
  'under eye cream': { what: 'a light cream made for the thin skin under the eyes', use: 'a rice-grain amount tapped in with the ring finger', watch: 'rubbing, which tugs the skin', pick: 'a fragrance-free cream with peptides or caffeine', forms: [['Cream', 'moisture and comfort'], ['Gel', 'cools and depuffs'], ['Serum', 'light under concealer']] },
  'barrier repair cream': { what: 'a cream that restores the skin barrier with lipids', use: 'a thin layer as the last step, morning and night', watch: 'pairing it with strong acids while skin is sore', pick: 'ceramides, cholesterol and fatty acids together', forms: [['Cream', 'daily repair'], ['Balm', 'overnight rescue'], ['Lotion', 'lighter for oily skin']] },
}
const productOf = (prompt) => {
  const p = prompt.toLowerCase()
  const keys = Object.keys(PRODUCTS).sort((a, b) => b.length - a.length)
  return keys.find((k) => p.includes(k)) ?? (p.includes('barrier') ? 'skin barrier' : p.includes('keratosis') ? 'body lotion' : p.includes('sunscreen') ? 'sunscreen for oily skin' : 'niacinamide serum')
}
// the family of question: shapes the direct answer and which formats are missing
const familyOf = (prompt) => {
  const p = prompt.toLowerCase()
  if (p.startsWith('can ')) return 'breakouts'
  if (p.startsWith('how to')) return 'howto'
  if (p.includes('under $')) return 'budget'
  if (p.startsWith('best ')) return 'best'
  if (p.includes('review')) return 'review'
  if (p.includes('benefits')) return 'benefits'
  return 'for' // "<product> for <who / weather>"
}

// ---- the request (the client sends these) ------------------------------------------------------------------------
// userFacts (proposed, Your data): sent only when there's something in it
export const requestFor = (row, userFacts = null) => ({
  prompt: row.prompt,
  brandDomain: CO_BRAND.domain,
  brandName: CO_BRAND.name,
  competitors: row.competitors ?? [],
  sources: (row.sources ?? []).map((s) => ({ url: `https://${s.domain}${s.path ?? ''}`, title: '' })),
  targetUserId: 'user_3f9a',
  ...(hasUserFacts(userFacts) ? { userFacts } : {}),
})
const hasUserFacts = (u) => Boolean(u && (u.facts?.length || u.answers?.length || u.documentsText))
// the location the user gave (the locations answer, else a fact labelled like one), or null
const LOCATION_LABEL = /location|address|office|clinic/i
export const userLocation = (u) => u?.answers?.find((a) => a.flagId === 'locations')?.answer?.trim() || u?.facts?.find((f) => LOCATION_LABEL.test(f.label))?.value?.trim() || null

// ---- citedPages: the client's sources + Google's organic top 10 + AI Overview references (one per host) ----------
const ORGANIC = ['healthline.com', 'allure.com', 'byrdie.com', 'verywellhealth.com', 'glamour.com', 'womenshealthmag.com']
const FORMAT_POOL = {
  breakouts: ['faq', 'research', 'listicle', 'how_to'],
  howto: ['how_to', 'tutorial', 'faq', 'checklist'],
  budget: ['listicle', 'comparison', 'faq', 'stats'],
  best: ['listicle', 'comparison', 'faq', 'how_to'],
  review: ['comparison', 'case_study', 'faq', 'listicle'],
  benefits: ['faq', 'listicle', 'research', 'how_to'],
  for: ['listicle', 'how_to', 'faq', 'comparison'],
}
function citedPagesFor(row, family) {
  const key = row.prompt
  const slug = slugify(row.prompt)
  const pages = []
  const seen = new Set()
  const add = (url, extra) => { const host = hostOf(url); if (seen.has(host)) return; seen.add(host); pages.push({ url, host, ...extra }) }
  // the client's sources (AI answers cite them): rank from Google, or null when only AI cites them
  ;(row.sources ?? []).forEach((s, i) => {
    const rank = rnd(key, `r${i}`) < 0.75 ? 1 + i * 2 + Math.floor(rnd(key, `rr${i}`) * 2) : null
    add(`https://${s.domain}${s.path ?? ''}`, { rank, src: true })
  })
  // more organic results from Google page 1
  ORGANIC.filter((h) => !seen.has(h)).slice(0, 3).forEach((h, i) => add(`https://${h}/${family === 'howto' ? 'guides' : 'reviews'}/${slug}`, { rank: 3 + i * 2 + Math.floor(rnd(key, `o${i}`) * 2), src: false }))
  // our own page when there is one (some prompts): a blog post on the topic
  const own = rnd(key, 'own') < 0.45
  if (own) add(`https://${CO_BRAND.domain}/blog/${slugify(productOf(row.prompt))}-guide`, { rank: 6 + Math.floor(rnd(key, 'ownr') * 5), src: false })
  const pool = FORMAT_POOL[family]
  // Google ranks are unique: a page whose rank is taken moves to the next free slot (past #10: not on page 1)
  const used = new Set()
  for (const p of pages) {
    if (p.rank == null) continue
    let r = p.rank
    while (used.has(r)) r += 1
    p.rank = r
    used.add(r)
  }
  return pages.slice(0, 12).map((p, i) => {
    const isOurs = p.host === CO_BRAND.domain
    const aiCited = p.src || rnd(key, `ai${i}`) < 0.2
    const rank = p.rank != null && p.rank > 10 ? null : p.rank // Google's organic top 10 only
    const nf = isOurs ? 1 + Math.floor(rnd(key, 'ownf') * 2) : 1 + Math.floor(rnd(key, `nf${i}`) * 2)
    const formats = [...new Set(Array.from({ length: nf }, (_, j) => pool[Math.floor(rnd(key, `f${i}${j}`) * pool.length)]))]
    const engines = [...(rank != null && rank <= 10 ? ['google'] : []), ...(aiCited ? (rnd(key, `aio${i}`) < 0.5 ? ['aio'] : ['ai']) : [])]
    const title = isOurs ? `${cap(productOf(row.prompt))}: the Dermasuri guide` : titleFor(row.prompt, p.host, i)
    return { url: p.url, host: p.host, rank, engines, aiCited, formats, isOurs, title }
  })
}
const TITLES = [(p) => `${cap(p)}: what to know`, (p) => `${cap(p)}, explained`, (p) => `The best picks: ${p}`, (p) => `${cap(p)} (tested)`, (p) => `${cap(p)}: a dermatologist’s view`]
const titleFor = (prompt, host, i) => TITLES[Math.floor(rnd(`${prompt}|${host}`, i) * TITLES.length)](prompt)

// ---- recommendContentFormats: the format scores, coverage, recommendations and angles -------------------------------
function recommend(prompt, citedPages) {
  const bases = baseFor(prompt)
  const rows = new Map(FORMAT_IDS.map((id) => [id, { id, label: formatLabel(id), score: 0, base: bases[id], onPage1: false, usages: [] }]))
  for (const p of citedPages) {
    const onPage1 = p.rank != null && p.rank >= 1 && p.rank <= 10
    if (!p.formats.length || (!onPage1 && !p.aiCited)) continue
    const who = (onPage1 ? rankWeight(p.rank) : 0) + (p.aiCited ? 2 : 0)
    if (who <= 0) continue
    for (const id of p.formats) {
      const row = rows.get(id)
      if (onPage1) row.onPage1 = true
      const add = row.base * who
      row.score += add
      row.usages.push({ url: p.url, host: p.host, rank: p.rank, aiCited: p.aiCited, who, add })
    }
  }
  const formats = [...rows.values()]
    .map((r) => { const needed = r.onPage1 || r.usages.some((u) => u.aiCited); return { ...r, score: needed ? r.score : 0, needed } })
    .filter((r) => r.needed && r.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .map(({ id, label, score, base, onPage1, needed, usages }) => ({ id, label, score, base, onPage1, needed, usages }))
  const ourFormats = [...new Set(citedPages.filter((p) => p.isOurs).flatMap((p) => p.formats))]
  const topIds = formats.slice(0, 5).map((r) => r.id)
  let coverage = 'missing'
  if (ourFormats.length) {
    const inTop = topIds.filter((id) => ourFormats.includes(id)).length
    if (inTop >= Math.min(2, topIds.length)) coverage = 'covered'
    else if (inTop || formats.some((r) => ourFormats.includes(r.id))) coverage = 'partial'
  }
  const order = { missing: 0, partial: 1, covered: 2 }
  const recommendations = formats.map((r) => {
    const have = ourFormats.includes(r.id)
    const status = !have ? 'missing' : coverage === 'covered' && topIds.includes(r.id) ? 'covered' : 'partial'
    return { id: r.id, label: r.label, score: r.score, status, why: r.usages.slice(0, 3).map((u) => `${u.host}${u.rank ? ` (#${u.rank})` : ''}${u.aiCited ? ' · AI' : ''}`).join(', ') }
  }).sort((a, b) => order[a.status] - order[b.status] || b.score - a.score)
  const angles = recommendations.filter((r) => r.status !== 'covered').slice(0, 6).map((r) => (r.status === 'missing'
    ? `Publish a ${r.label.toLowerCase()} (score ${r.score}) — used by ${r.why || 'page-1 / AI answers'}, and you do not cover this format yet.`
    : `Strengthen your ${r.label.toLowerCase()} (score ${r.score}) — you only partially match what ranks for this prompt.`))
  return { coverage, ourFormats, formats, recommendations, angles }
}

// ---- the route's page choice (update a deep brand page that matches ≥3 prompt words, else create) ----------------
function pageRecommendationFor(prompt, citedPages) {
  const evidence = citedPages
    .filter((p) => !p.isOurs && ((p.rank != null && p.rank >= 1 && p.rank <= 10) || p.aiCited))
    .slice(0, 5)
    .map((p) => ({ url: p.url, host: p.host, rank: p.rank ?? null, aiCited: p.aiCited, formats: p.formats, title: p.title }))
  const terms = prompt.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3)
  const ours = citedPages.filter((p) => p.isOurs).map((p) => {
    const path = pathOf(p.url)
    const depth = path.split('/').filter(Boolean).length
    const hay = `${path} ${p.title}`.toLowerCase()
    return { ...p, relevance: depth + terms.filter((t) => hay.includes(t)).length * 3 }
  }).sort((a, b) => b.relevance - a.relevance)
  const best = ours[0] && ours[0].relevance >= 3 ? ours[0] : null
  if (best) return { pageRecommendation: { action: 'update', url: best.url, title: best.title, evidence, reason: 'Page-1 / AI-cited competitors already publish this format on a dedicated URL.' }, evidence }
  const createPath = `/guides/${slugify(prompt)}`
  const url = `https://${CO_BRAND.domain}${createPath}`
  return {
    pageRecommendation: { action: 'create', suggestedPath: createPath, suggestedUrl: url, url, slug: createPath.slice(1), evidence, reason: 'No dedicated on-site page answers this prompt yet (homepage does not count).' },
    evidence,
  }
}

// ---- the draft (lib/content-draft-for-prompt.js structure) ---------------------------------------------------------
const NOTICE = '> **Draft for client review** — verify fees, sources, and claims before publishing.'
const NOTICE_TEMPLATE = '> **Draft for client review** — verify the checklist items before publishing. Not final live copy.'
const WHO = { teenagers: 'teenagers', 'humid weather': 'humid weather', 'dry skin': 'dry skin', 'oily skin': 'oily skin', rosacea: 'rosacea', melasma: 'melasma', wrinkles: 'wrinkles', 'pigmented lips': 'pigmented lips', 'keratosis pilaris': 'keratosis pilaris' }
const whoOf = (prompt) => Object.keys(WHO).find((k) => prompt.toLowerCase().includes(k))

// the first FAQ question, phrased as a real question (never just the prompt with a "?")
function firstQuestion(family, name, who) {
  switch (family) {
    case 'breakouts': return `Why does ${name} sometimes cause breakouts?`
    case 'howto': return `How often should I use ${name}?`
    case 'budget': return `Is a cheaper ${name} as good as an expensive one?`
    case 'best': return `What makes a ${name} good for ${who ?? 'my skin'}?`
    case 'review': return `Is ${name} worth it?`
    case 'benefits': return `What does ${name} actually do?`
    default: return `Is ${name} a good fit for ${who ?? 'my skin'}?`
  }
}

function directAnswer(prompt, family, P, who) {
  const name = productOf(prompt)
  switch (family) {
    case 'breakouts': return `It can, but rarely: a breakout after starting ${name} is usually irritation or purging, not the product clogging pores. Start slowly and patch-test.`
    case 'howto': return `Use ${name} as ${P.use}. Keep the rest of the routine simple and add sunscreen in the morning.`
    case 'budget': return `Yes: under $15 you can get ${P.what}. Look for ${P.pick}, and skip extras you don’t need.`
    case 'best': return `The best ${name} for ${who ?? 'most people'} is ${P.pick}. Use ${P.use}.`
    case 'review': return `${cap(name)} is ${P.what}. It works best as ${P.use}; expect ${P.watch}.`
    case 'benefits': return `${cap(name)} is ${P.what}. Use ${P.use}, and watch for ${P.watch}.`
    default: return `For ${who ?? 'your skin'}, choose ${P.pick}. Use ${P.use}.`
  }
}

// the Markdown a Claude run returns after the lib's clean-up (sections, Sources with full URLs, Page recommendation at
// the top, Flags at the end). opts: { brandFacts, competitorSlip, publishingNotes }
function writeDraft(row, family, P, missing, pageRec, citedPages, opts) {
  const name = productOf(row.prompt)
  const who = whoOf(row.prompt)
  const brand = CO_BRAND.name
  // the clinic variant: with a location from Your data the draft names it; without, it asks (the locations flag)
  const clinic = opts.clinic ? (opts.location ? ` If redness lasts more than two weeks, book a skin check at our clinic at ${opts.location}.` : '') : ''
  const parts = [`# ${row.prompt}`, '', NOTICE, '', pageRecBlock(pageRec), '## Direct answer', '', directAnswer(row.prompt, family, P, who) + clinic, '', '## Key points', '']
  parts.push(`- ${cap(P.what)}.`)
  parts.push(`- Use ${P.use}.`)
  parts.push(`- What to watch: ${P.watch}.`)
  parts.push(`- Look for ${P.pick}.`)
  parts.push(`- Confirm with your team: Which ${brand} product you recommend here, and its exact strength.`)
  if (opts.clinic) parts.push(opts.location ? `- See us in person: our clinic at ${opts.location} checks redness and patch-tests new actives.` : '- Confirm with your team: Which clinic location offers in-person skin checks.')
  parts.push('')
  if (missing.some((m) => ['how_to', 'tutorial', 'checklist'].includes(m.id)) || family === 'howto') {
    parts.push('## Steps', '')
    parts.push(`1. **Start clean** — Wash with a gentle cleanser and pat the skin dry before ${name}.`, '')
    parts.push(`2. **Apply the right amount** — Use ${P.use}; more doesn’t work faster.`, '')
    parts.push(`3. **Layer in order** — Thinnest texture first, then moisturiser, then sunscreen in the morning.`, '')
    parts.push(`4. **Give it time** — Check your skin after four weeks before changing anything.`, '')
  }
  if (missing.some((m) => ['comparison', 'listicle'].includes(m.id)) || family === 'budget' || family === 'best') {
    parts.push('## How the options compare', '')
    // each option's values differ (one "Label: value" set per option, as the lib writes them)
    const TEXTURE = ['Lightest of the three', 'In between', 'Richest of the three']
    const START = ['Every other day for two weeks', 'Once a day', 'Morning and night once your skin is used to it']
    P.forms.forEach(([form, note], i) => {
      parts.push(`**${form}**`, '')
      parts.push(`- Best for: ${note}`)
      parts.push(`- Texture: ${TEXTURE[i] ?? TEXTURE[1]}`)
      parts.push(`- How to start: ${START[i] ?? START[1]}`)
      parts.push('')
    })
  }
  parts.push('## Detailed explanation', '')
  parts.push(`${cap(name)} is ${P.what}. Most people see the best results when they use it consistently rather than heavily: ${P.use}. ${who ? `For ${who}, keep the rest of the routine short so it’s easy to tell what helps.` : ''}`.trim(), '')
  parts.push(`One thing to keep an eye on: ${P.watch}. If your skin stings for more than a few minutes, or turns red, go back to every other day and add a plain moisturiser.${opts.competitorSlip ? ` Unlike ${opts.competitorSlip}’s routine, this keeps it to one active.` : ''}`, '')
  parts.push('## FAQ', '')
  parts.push(`### ${firstQuestion(family, name, who)}`, '', `It depends on how your skin reacts in the first two weeks. Look for ${P.pick}, and start every other day. If your skin stays calm, use it as part of your daily routine.`, '')
  parts.push(`### How long until I see a difference?`, '', `Most people notice a change in four to eight weeks. Take a photo in the same light at the start, and compare after a month rather than day to day.`, '')
  parts.push(`### Can I use it with other actives?`, '', `Yes, but add one new product at a time and leave two weeks between them. If you use retinol or strong acids, keep them on different nights at first.`, '')
  parts.push(`### What should I do if my skin gets irritated?`, '', `Stop for a few days, use only a gentle cleanser and moisturiser, then restart every third day. Confirm with your team: Which ${brand} moisturiser to suggest here.`, '')
  parts.push('## Sources', '')
  for (const p of citedPages.filter((x) => !x.isOurs).slice(0, 4)) parts.push(`- ${p.title}: ${p.url}${opts.expert && p === citedPages[0] ? ' (flag for expert review)' : ''}`)
  if (pageRec.action === 'update') parts.push(`- your page to update — ${pageRec.url}`)
  else parts.push(`- recommended new page — ${pageRec.suggestedUrl}`)
  parts.push('')
  if (opts.publishingNotes) {
    parts.push('## Publishing notes', '', '- Keep the missed prompt as the H1 / primary question.', '- No competitor names in the published body.', '- Confirm every fee, product claim, and source with your team before going live.', '')
  }
  return parts.join('\n')
}

// the lib's fallbackDraft (contentSource 'template')
function templateDraft(row, missing, pageRec) {
  const brand = CO_BRAND.name
  const prompt = row.prompt
  const parts = [`# ${prompt}`, '', NOTICE_TEMPLATE, '', pageRecBlock(pageRec), '## Direct answer', '',
    `For “${prompt.replace(/\?+$/, '')}?”, start with a clear ${brand} answer buyers can act on.`.slice(0, 140), '',
    '## Key points', '',
    '- Restate what the buyer is deciding in one line.',
    `- Give the practical criteria ${brand} can stand behind.`,
    `- Say what to do next on ${CO_BRAND.domain}.`,
    '- For any number or policy you cannot verify: Add an official source link.', '',
    '## Detailed explanation', '',
    `Open by answering “${prompt}” for a real person, not for rankings. Explain how it works, what changes the outcome, and where ${brand} helps — without naming competitors.`, '',
    `Verified product details, examples, reviews, and brand voice were not on file. Write “Confirm with your team: …” for product specifics instead of inventing claims.`, '']
  for (const fmt of missing) {
    if (fmt.id === 'faq') {
      parts.push('## FAQ', '', `### ${prompt}`, '', `**Answer:** Give a direct 2–4 sentence answer a buyer can use. Then add detail ${brand} can verify. Do not leave this blank.`, '',
        '### What should someone check before they decide?', '', 'List the documents, eligibility rules, or timing factors that change the answer. Where product specifics are required, write “Confirm with your team: …”', '',
        `### How does ${brand} help with this?`, '', `Describe the concrete next step (demo, quote, guide, or support) on ${CO_BRAND.domain} without inventing offers.`, '')
    } else if (fmt.id === 'how_to' || fmt.id === 'tutorial') {
      parts.push('## Steps', '', '1. **Clarify the goal** — Restate the buyer question and the outcome they want in one sentence.', '', '2. **Gather what changes the answer** — Documents, numbers, or constraints they need before choosing.', '', '3. **Compare the practical options** — Explain trade-offs in plain language; do not name rival brands.', '', `4. **Take the next step with ${brand}** — Point to the real page, form, or contact path on ${CO_BRAND.domain}.`, '')
    } else {
      parts.push(`## ${fmt.label}`, '', `Write a full section that answers “${prompt}” in this format. Every heading needs a useful paragraph, not a title alone.`, '')
    }
  }
  parts.push('## Sources', '', `- recommended new page — ${pageRec.url}`, '')
  parts.push('## Publishing notes', '', '- Keep the missed prompt as the H1 / primary question.', '- No competitor names in the published body.', '- No Claude, ChatGPT, or tool watermarks.', '- Confirm every fee, product claim, and source with your team before going live.', '')
  return parts.join('\n')
}

// the lib's pageRecommendationBlock
function pageRecBlock(rec) {
  const action = rec.action === 'update' ? `- **Update:** ${rec.url}${rec.title ? ` (“${rec.title}”)` : ''}` : `- **Create:** ${rec.suggestedUrl}`
  const ev = rec.evidence.slice(0, 5).map((e) => `- Page-1 evidence${e.rank ? ` (#${e.rank})` : e.aiCited ? ' (AI cited)' : ''}: ${e.url}${e.formats.length ? ` — ${e.formats.slice(0, 3).join(', ')}` : ''}`)
  return ['## Page recommendation', '', action, `- **Why:** ${rec.reason}`, ...ev, '', ''].join('\n')
}

// the lib's buildReviewFlags: each rule, its label, status and score (Expert review 10, credentials 8, locations 6,
// fees 5, reviews 5, contact 4, trademark 3, each draft gap 3); reviewScore.total = the sum of the scores.
// userFacts (PROPOSED, Your data): a rule isn't raised when the user answered it (answers[].flagId) or gave a fact
// labelled for it (RESOLVED_BY); Expert review and Draft gaps can't be answered away.
const RESOLVED_BY = { credentials: /registration|partner|credential|expert/i, locations: LOCATION_LABEL, contact: /phone|contact/i, fees: /fee|price|pricing|quote/i, reviews: /review|rating|testimonial/i, trademark: /trademark/i }
export const resolvedBy = (u, id) => Boolean(RESOLVED_BY[id] && (u?.answers?.some((a) => a.flagId === id && a.answer?.trim()) || u?.facts?.some((f) => RESOLVED_BY[id].test(f.label) && f.value?.trim())))
export function reviewFlags({ markdown, expertReview, brandFacts, brandName, contentIssues, userFacts = null }) {
  const text = String(markdown || '')
  const facts = String(brandFacts || '')
  const flags = []
  if (expertReview || /expert review|tax|legal|medical|GST|DTAA|transfer pricing/i.test(text)) flags.push({ id: 'expert_review', label: 'Expert review', status: 'required', score: 10, text: 'A qualified reviewer must check every tax, legal, and/or medical statement before publishing.' })
  if (!/ICAI|firm registration|partner/i.test(facts) && /ICAI|partner|credential/i.test(text)) flags.push({ id: 'credentials', label: 'Missing brand info', status: 'missing', score: 8, text: `Confirm ${brandName || 'brand'} firm registration / partner names you are willing to publish.` })
  if (!/Address \(from site\):/i.test(facts) && /office|Noida|Delhi|NCR|location|address/i.test(text)) flags.push({ id: 'locations', label: 'Missing brand info', status: 'missing', score: 6, text: 'Confirm office locations before publishing any location claim.' })
  if (!/Phone \(from site\):/i.test(facts) && /phone|call|contact/i.test(text)) flags.push({ id: 'contact', label: 'Missing brand info', status: 'partial', score: 4, text: 'Confirm the public phone / contact path you want on this page.' })
  if (/fee|pricing|quote|₹|\$/i.test(text) && !/fee|pricing|quote/i.test(facts)) flags.push({ id: 'fees', label: 'Needs verification', status: 'partial', score: 5, text: 'Confirm fee language or how quotes are given. Do not invent prices.' })
  if (/review|testimonial|rating|client names/i.test(text) && !/review|testimonial/i.test(facts)) flags.push({ id: 'reviews', label: 'Needs verification', status: 'partial', score: 5, text: 'Do not add client names, reviews, or statistics unless the team supplies them with permission.' })
  if (/trademark|®|registered/i.test(text)) flags.push({ id: 'trademark', label: 'Needs verification', status: 'partial', score: 3, text: 'Confirm trademark / registered wording matches legal brand usage.' })
  for (const issue of contentIssues || []) flags.push({ id: `issue_${flags.length}`, label: 'Draft gap', status: 'missing', score: 3, text: String(issue) })
  const seen = new Set()
  const unique = flags.filter((f) => { const k = `${f.label}|${f.text}`.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
    .filter((f) => !resolvedBy(userFacts, f.id))
  const total = unique.reduce((s, f) => s + f.score, 0)
  return { flags: unique, reviewScore: { done: 0, total, remaining: total } }
}
// the lib's rules by id (label, status, score, text), for Your data's questions (behind ?backend=full)
export const FLAG_RULES = Object.fromEntries(reviewFlags({ markdown: 'medical partner office call $ review ®', brandFacts: '', brandName: CO_BRAND.name }).flags.map((f) => [f.id, f]))
const flagsBlock = (flags) => (flags.length ? ['## Flags', '', ...flags.map((f) => `- **[${f.label}]** (score ${f.score}) — ${f.text}`), ''].join('\n') : '')

// brand facts on file (user_domains.entity_profile + the homepage scrape); prompts without them get none
const BRAND_FACTS = `${CO_BRAND.name} makes fragrance-free skincare for sensitive skin.\nPhone (from site): +1 415 555 0142\nAddress (from site): 210 Mission St, San Francisco`
// the clinic variant's: no address on the site (so a location claim needs the user's)
const BRAND_FACTS_NO_ADDRESS = BRAND_FACTS.split('\n').filter((l) => !l.startsWith('Address')).join('\n')

// per-prompt variants, so every case the route can return has a sample:
//   template: the Claude run failed twice → the lib's fallback (contentSource 'template', and the gate's issues)
//   incomplete: Claude's draft failed the quality gate (contentComplete false + contentIssues)
//   noFacts: no brand facts on file (brandFactsAvailable false)
//   expert: a sensitive topic (expertReview true)
//   clinic: the brand has a clinic but no address on its site: the draft asks for the location (the locations flag)
//     until Your data gives one, then names it (the userFacts fixture: ?co=data-sample)
const VARIANTS = { 0: ['clinic'], 23: ['template', 'noFacts'], 7: ['expert'], 17: ['expert', 'incomplete'], 20: ['noFacts'], 33: ['incomplete'] }

// userFacts: the request's (proposed); null = the route as it is today
export function buildResponse(row, userFacts = null) {
  const v = VARIANTS[row.id] ?? []
  const family = familyOf(row.prompt)
  const P = PRODUCTS[productOf(row.prompt)]
  const citedPages = citedPagesFor(row, family)
  const rec = recommend(row.prompt, citedPages)
  const { pageRecommendation, evidence } = pageRecommendationFor(row.prompt, citedPages)
  if (rec.coverage === 'missing' || !rec.angles.length) {
    rec.angles = [pageRecommendation.action === 'update' ? `Update ${pageRecommendation.url}` : `Create ${pageRecommendation.suggestedPath} on ${CO_BRAND.domain}`, ...rec.angles.slice(0, 5)]
  }
  // the route drafts FAQ always + up to 2 other gaps
  const gaps = rec.recommendations.filter((r) => r.status !== 'covered')
  const faq = gaps.find((r) => r.id === 'faq')
  const missing = [faq ?? { id: 'faq', label: 'FAQ', score: 3, status: 'missing' }, ...gaps.filter((r) => r !== faq).slice(0, 2)]
  const brandFacts = v.includes('noFacts') ? '' : v.includes('clinic') ? BRAND_FACTS_NO_ADDRESS : BRAND_FACTS
  const expertReview = v.includes('expert')
  let markdown
  let issues = []
  let source = 'claude'
  if (v.includes('template')) {
    source = 'template'
    markdown = templateDraft(row, missing, pageRecommendation)
    issues = ['Needs a direct answer of about 140 characters (60–200).', 'FAQ missing a useful answer: “What should someone check before they decide?”']
  } else {
    const slip = v.includes('incomplete') ? (row.competitors?.[0] ?? null) : null
    markdown = writeDraft(row, family, P, missing, pageRecommendation, citedPages, { expert: expertReview, competitorSlip: slip ? MOCK_BRANDS[slip]?.name ?? slip : null, publishingNotes: rnd(row.prompt, 'notes') < 0.4, clinic: v.includes('clinic'), location: userLocation(userFacts) })
    if (slip) issues.push(`Competitor “${slip}” appears in the draft — remove from publishable content.`)
    if (expertReview) markdown = markdown.replace('## Detailed explanation\n\n', '## Detailed explanation\n\nPigment and scarring can have medical causes; if marks spread or change, see a dermatologist before treating them at home.\n\n')
  }
  const built = reviewFlags({ markdown, expertReview, brandFacts, brandName: CO_BRAND.name, contentIssues: issues, userFacts })
  markdown = `${markdown.trim()}\n\n${flagsBlock(built.flags)}`.trim() + '\n'
  return {
    ok: true,
    analyzedAt: `2026-11-0${1 + (row.id % 4)}T${String(8 + (row.id % 10)).padStart(2, '0')}:${String((row.id * 7) % 60).padStart(2, '0')}:00.000Z`,
    brandDomain: CO_BRAND.domain,
    brandName: CO_BRAND.name,
    prompt: row.prompt,
    ...rec,
    citedPages,
    pageRecommendation,
    evidence,
    contentMarkdown: markdown,
    contentSource: source,
    contentComplete: issues.length === 0,
    contentIssues: issues,
    expertReview: expertReview || /medical/i.test(markdown),
    brandFactsAvailable: Boolean(brandFacts),
    flags: built.flags,
    reviewScore: built.reviewScore,
  }
}

// the hostile draft (?co=hostile): the prompt's own sample with raw HTML and script links added, for the safe-rendering
// check. None of it may run, render as HTML, or survive into Copy as HTML.
export const HOSTILE_LINES = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  'Read the [click](javascript:alert(1)) guide, the [x](JAVASCRIPT:alert(1)) one and the [y]( javascript:alert(1)) one.',
  'Or <a href="javascript:alert(1)">z</a>, or a [safe link](https://healthline.com/guides/safe).',
]
const hostile = (res) => ({ ...res, contentMarkdown: res.contentMarkdown.replace('## Key points\n\n', `## Key points\n\n${HOSTILE_LINES.map((l) => `- ${l}`).join('\n')}\n`).replace('## Detailed explanation\n\n', `## Detailed explanation\n\n${HOSTILE_LINES.join('\n\n')}\n\n`) })

export const CONTENT_RECOMMEND = Object.fromEntries(missedPrompts.map((row) => [row.id, buildResponse(row)]))
// samples outside the skincare list (the live reverse-mortgage run): their rows, reachable by id (/opportunities/content/rm-1)
export const SAMPLE_ROWS = [RM_ROW]
export const SAMPLES = { [RM_ROW.id]: RM_RESPONSE }
// userFacts (proposed): the draft request's Your data; empty → the response as the route returns it today. The live
// samples (rm-1) keep their text and only drop the flags it answers.
export const contentRecommendFor = (row, userFacts = null) => {
  let res = SAMPLES[row.id] ?? CONTENT_RECOMMEND[row.id] ?? buildResponse(row)
  if (hasUserFacts(userFacts)) res = SAMPLES[row.id] ? dropAnswered(res, userFacts) : buildResponse(row, userFacts)
  return coStates().has('hostile') ? hostile(res) : res
}
const dropAnswered = (res, u) => {
  const flags = res.flags.filter((f) => !resolvedBy(u, f.id))
  const total = flags.reduce((s, f) => s + f.score, 0)
  return { ...res, flags, reviewScore: { done: 0, total, remaining: total } }
}
export const hostileResponse = (row) => hostile(CONTENT_RECOMMEND[row.id] ?? buildResponse(row))

// a competitor's display name from the competitor settings (the mock's tracked brands, the sample accounts'); the
// domain itself when none is set. Never a name made from the domain ("Longbridge-financial").
const COMPETITOR_NAMES = { ...Object.fromEntries(Object.entries(MOCK_BRANDS).map(([d, b]) => [d, b.name])), ...RM_COMPETITOR_NAMES }
export const competitorName = (domain) => COMPETITOR_NAMES[domain] ?? domain

// ?backend=full: the parts that need backend work (Search Console, Your data, Publish & track, the live writing view).
// Off by default: v1 shows only what content-recommend returns.
export const backendFull = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('backend') === 'full'
// the mock's request time: the result "arrives" after this (?co=gen-hold keeps it writing, for screenshots)
export const RESPONSE_MS = 6500
// the client's two loading lines and the switch between them (the app's fixed 4.5s timer)
export const LOADING_LINES = ['Reading Google page 1 and AI citations for this prompt…', 'Drafting website copy for the formats you are missing…']
export const LOADING_SWITCH_MS = 4500
