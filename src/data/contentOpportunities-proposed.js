// Opportunities → Content: PROPOSED data. None of this exists in the app yet (app docs/content-opportunities-data.md
// §2 "Does not exist" and §4). Shapes follow the doc's suggestions where it has them (content_drafts, the publish check,
// prompt_visibility_snapshot for tracking); the rest are named here for Harsh. Made-up values only.
import { CO_BRAND, ENGINES, SYNCS } from './contentOpportunities.js' // .js: the unit tests load this file in plain Node

// ---- preview states: ?co=<state>[,<state>] ----------------------------------------------------------------------
// gsc-declined · no-candidates · gen-failed · not-found · missed-sync · gsc-new (Search Console not asked yet)
export const coStates = () => new Set((typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('co') ?? '').split(',').filter(Boolean))

// ---- content_drafts (doc §4 (2)): one per prompt that has work ----------------------------------------------------
// status: 'draft' | 'published' | 'not_found'; stage adds the page's list state on top of it.
// stage: 'draft' (Draft ready) · 'waiting' (copied, not found on the page yet) · 'monitoring' · 'improved' · 'nochange'
// keyed by the Overview's missed prompt ids (data/mock.js missedPrompts)
const DRAFTS = {
  2: { stage: 'draft', action: 'update', target_url: `https://${CO_BRAND.domain}/products/alpha-arbutin-serum`, updated_at: '2026-11-04T10:00:00Z' },
  5: { stage: 'draft', action: 'create', target_url: `https://${CO_BRAND.domain}/guides/fix-damaged-skin-barrier`, updated_at: '2026-11-03T16:00:00Z' },
  3: { stage: 'waiting', action: 'create', target_url: `https://${CO_BRAND.domain}/guides/best-spf-50-gel-sunscreen`, copied_at: '2026-10-30T09:12:00Z' },
  4: { stage: 'monitoring', action: 'update', target_url: `https://${CO_BRAND.domain}/products/peptide-serum`, published_at: '2026-10-14T08:00:00Z', week: 2, gained: ['google'] },
  7: { stage: 'monitoring', action: 'create', target_url: `https://${CO_BRAND.domain}/guides/tranexamic-acid-for-melasma`, published_at: '2026-10-21T08:00:00Z', week: 1, gained: [] },
  1: { stage: 'improved', action: 'update', target_url: `https://${CO_BRAND.domain}/blog/kojic-acid-soap`, published_at: '2026-09-29T08:00:00Z', week: 4, gained: ['google', 'chatgpt'] },
  8: { stage: 'nochange', action: 'create', target_url: `https://${CO_BRAND.domain}/guides/keratosis-pilaris-body-lotion`, published_at: '2026-09-29T08:00:00Z', week: 4, gained: [] },
}
// the mock's "now" (relative times: "Saved 2h ago", "checked today") and the next tracking check
export const NOW = '2026-11-04T12:00:00Z'
export const NEXT_CHECK = 'Fri'
// what this visit changed (the workspace copies a draft or publishes it): the list and a reopened prompt read it back.
// In-memory only (the mock); the app keeps it in content_drafts.
const CHANGED = {}
export const setDraftState = (id, d) => { CHANGED[id] = { ...(CHANGED[id] ?? DRAFTS[id] ?? {}), ...d } }
export const draftFor = (id, row) => {
  const d = CHANGED[id] ?? DRAFTS[id]
  if (!d) return null
  return {
    id: `d${id}`, prompt: row?.prompt ?? '', target_url: d.target_url, action: d.action, inputs: {}, content_md: '', sources: row?.sources ?? [],
    status: ['draft', 'waiting'].includes(d.stage) ? 'draft' : 'published',
    created_at: '2026-10-28T10:00:00Z', updated_at: d.updated_at ?? '2026-11-03T10:15:00Z',
    published_checked_at: d.stage === 'waiting' ? '2026-11-04T06:00:00Z' : null,
    published_at: d.published_at ?? null,
    // list state (derived; see stage above)
    stage: d.stage, week: d.week ?? 0, gained: d.gained ?? [],
  }
}

// ---- Search Console connection, once per brand ------------------------------------------------------------------
// 'connected' | 'declined' | 'new' (not asked yet). The real connect flow exists (gsc_tokens); asking per brand inside
// this flow doesn't.
export const gscStatus = () => (coStates().has('gsc-declined') ? 'declined' : coStates().has('gsc-new') ? 'new' : 'connected')

// ---- page recommendation, per prompt (doc §2 "Does not exist") ---------------------------------------------------
// Sample Search Console data that MATCHES the prompt: a deterministic generator keyed on the row (prompt text, topic).
// It reads the prompt's frame ("can X cause breakouts", "how to use X in a routine", "best X for Y", …) for its
// subject, then builds 5–6 of the brand's pages about that subject, each with its top 5 queries as gsc_keywords rows
// ({ keyword, clicks, impressions, ctr, position, url }, the app's real shape: one row per query, url = the page with
// the most clicks for it). The app would build the same from gsc_keywords grouped by url; ranking and the 8-week
// trend don't exist there yet.
const STOP = new Set(['a', 'an', 'the', 'for', 'to', 'of', 'in', 'on', 'and', 'or', 'with', 'is', 'are', 'can', 'do', 'does', 'how', 'what', 'best', 'use', 'under', 'your', 'my', 'vs', 'it', 'its', 'cause'])
// the words of a prompt that carry its subject ("can pigmentation serum cause breakouts" → pigmentation, serum, breakouts)
export const promptWords = (s) => (String(s).toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !STOP.has(w))
export const slugify = (s) => String(s).toLowerCase().replace(/&/g, ' and ').replace(/\$/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// FNV-1a: the same row always gets the same numbers
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
const rnd = (key, salt) => (hash(`${key}|${salt}`) % 10000) / 10000

// the prompt's frame → its subject and angle (the mock's prompts are written from these frames; anything else is "other")
const FRAMES = [
  [/^can (.+) cause breakouts$/, 'breakouts'],
  [/^how to use (.+) in a routine$/, 'routine'],
  [/^(.+) for teenagers$/, 'teens'],
  [/^(.+) for humid weather$/, 'humid'],
  [/^(.+) under \$?\d+$/, 'budget'],
  [/^(.+) review$/, 'review'],
  [/^(.+) benefits$/, 'benefits'],
  [/^best (.+?) for (.+)$/, 'best-for'],
  [/^best (.+)$/, 'best'],
  [/^how to (\w+) (.+)$/, 'howto'],
  [/^(.+?) vs (.+)$/, 'versus'],
  [/^(.+?) for (.+)$/, 'for'],
]
export function parsePrompt(prompt) {
  const p = String(prompt).toLowerCase().trim()
  for (const [re, angle] of FRAMES) {
    const m = p.match(re)
    if (!m) continue
    if (angle === 'howto') return { angle, verb: m[1], subject: m[2], qualifier: null }
    if (angle === 'best-for' || angle === 'for' || angle === 'versus') return { angle, subject: m[1], qualifier: m[2] }
    return { angle, subject: m[1], qualifier: null }
  }
  return { angle: 'other', subject: p, qualifier: null }
}

// per topic: the problem word the brand's product name swaps out ("pigmentation serum" → brightening serum), the adjective the brand's own product uses, its hub guide and explainer, the
// default product noun
const TOPICS = {
  Pigmentation: { swap: ['pigmentation'], adj: 'brightening', hub: 'dark-spots-and-pigmentation', learn: 'what-causes-hyperpigmentation', noun: 'serum' },
  Acne: { swap: ['acne'], adj: 'clarifying', hub: 'calming-acne-and-rosacea', learn: 'what-causes-breakouts', noun: 'gel' },
  Sunscreen: { adj: 'daily', hub: 'how-to-choose-a-sunscreen', learn: 'spf-and-pa-ratings', noun: 'sunscreen' },
  Serums: { adj: 'daily', hub: 'serum-layering-order', learn: 'how-actives-work', noun: 'serum' },
  Moisturizers: { adj: 'barrier', hub: 'skin-barrier-repair', learn: 'what-is-the-skin-barrier', noun: 'cream' },
  Cleansers: { adj: 'gentle', hub: 'how-to-cleanse-sensitive-skin', learn: 'cleanser-ph', noun: 'cleanser' },
  'Eye & lip': { adj: 'soothing', hub: 'eye-and-lip-care', learn: 'thin-skin-care', noun: 'balm' },
  'Body care': { adj: 'smoothing', hub: 'body-care-routine', learn: 'rough-bumpy-skin', noun: 'lotion' },
  Makeup: { adj: 'sheer', hub: 'skin-first-makeup', learn: 'non-comedogenic-makeup', noun: 'tint' },
  Hair: { adj: 'scalp', hub: 'scalp-care', learn: 'scalp-skin', noun: 'serum' },
  'Clean beauty': { adj: 'fragrance-free', hub: 'what-we-leave-out', learn: 'clean-formulas', noun: 'range' },
}
const topicOf = (t) => TOPICS[t] ?? { adj: 'everyday', hub: 'skincare-basics', learn: 'skincare-ingredients', noun: 'cream' }
// another way people search for the same subject (the first rule that applies)
const SYNONYMS = [[/\bpigmentation\b/, 'dark spot'], [/\bdark spot\b/, 'pigmentation'], [/\bbreakouts\b/, 'acne'], [/\bface wash\b/, 'cleanser'],
  [/\bmoisturizer\b/, 'cream'], [/\bsunscreen\b/, 'spf'], [/\bnight cream\b/, 'overnight cream'], [/\bunder eye\b/, 'eye'], [/\bvitamin c\b/, 'ascorbic acid']]
const INGREDIENTS = /\b(azelaic acid|kojic acid|alpha arbutin|tranexamic acid|salicylic acid|hyaluronic acid|vitamin c|niacinamide|retinol|peptide|ceramide|squalane|rosehip oil|bha|aha|pha)\b/
// (only in a subject of 2+ words, so the other words keep it about the same thing: "sunscreen" stays as it is)
const altOf = (s) => { if (!s.includes(' ')) return s; for (const [re, w] of SYNONYMS) if (re.test(s)) return s.replace(re, w); return s }
const plural = (s) => s.replace(/(\w+)$/, (w) => (/(s|x|sh|ch)$/.test(w) ? (w.endsWith('s') ? w : `${w}es`) : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : `${w}s`))

// the plan for a row: its subject, the pages (path + query ideas, most relevant first) and the path a new page would take
export function planFor(row) {
  const prompt = String(row?.prompt ?? '').trim()
  const { angle, subject, qualifier, verb } = parsePrompt(prompt)
  const topic = topicOf(row?.topic)
  const core = subject.split(' for ')[0].trim() // "retinol for beginners" → "retinol"
  const tail = subject.slice(core.length).trim() // "for beginners"
  const words = core.split(' ')
  const s = slugify(subject)
  const alt = altOf(core)
  const q = qualifier
  // a "how to" prompt names a condition, not a product ("fix damaged skin barrier")
  const condition = angle === 'howto'
  // the brand's own product page for the subject: its full name when it has one ("azelaic acid cream"), else the
  // topic's adjective on the noun ("pigmentation serum" → brightening serum)
  const product = condition ? `${topic.adj} ${topic.noun}`
    : words.length >= 3 ? core
      : words.length === 1 ? (words[0] === topic.noun ? `${topic.adj} ${topic.noun}` : `${core} ${topic.noun}`)
        : topic.swap?.includes(words[0]) ? `${topic.adj} ${words[words.length - 1]}` : core
  // the explainer: the subject's ingredient ("azelaic acid cream" → azelaic acid), else the topic's own explainer
  const ingredient = core.match(INGREDIENTS)?.[0] ?? null
  const versus = ingredient === 'niacinamide' ? 'retinol' : 'niacinamide'
  const lead = {
    breakouts: [`/blog/do-${slugify(plural(alt))}-cause-acne`, [`${core} breakouts`, `does ${core} cause acne`, `${alt} purging`, `${core} side effects`, `can ${core} clog pores`]],
    routine: [`/blog/how-to-use-${s}`, [`how to use ${core}`, `${core} routine order`, `when to apply ${core}`, `${core} morning or night`, `${core} before or after moisturizer`]],
    teens: [`/blog/${slugify(core)}-for-teens`, [`${core} for teens`, `best ${core} for teenagers`, `is ${core} safe for teens`, `${core} for 13 year olds`, `teen ${core} routine`]],
    humid: [`/blog/${s}-in-humid-weather`, [`${subject} humid weather`, `lightweight ${core}`, `${core} for summer`, `non sticky ${core}`, `${core} hot climate`]],
    budget: [`/blog/affordable-${slugify(`${plural(core)} ${tail}`)}`, [`cheap ${subject}`, `${core} under 15`, `affordable ${core}`, `drugstore ${core}`, `budget ${core}`]],
    review: [`/blog/${s}-review`, [`${core} review`, `does ${core} work`, `${core} before and after`, `${core} results`, `${core} reddit`]],
    benefits: [`/blog/${s}-benefits`, [`${core} benefits`, `what does ${core} do`, `${core} for face`, `is ${core} good for skin`, `${core} side effects`]],
    'best-for': [`/blog/best-${slugify(plural(core))}-for-${slugify(q ?? '')}`, [`best ${core} for ${q}`, `${core} for ${q}`, `${ingredient ?? core} ${q}`, `dermatologist recommended ${core}`, `${core} ${q} reddit`]],
    best: [`/blog/best-${slugify(plural(core))}`, [`best ${core}`, `top rated ${core}`, `${core} dermatologist recommended`, `${core} reviews`, `${core} for sensitive skin`]],
    howto: [`/blog/how-to-${slugify(`${verb} ${subject}`)}`, [`how to ${verb} ${subject}`, `${subject} symptoms`, `how long to ${verb} ${subject}`, `signs of ${subject}`, `${subject} repair`]],
    versus: [`/blog/${slugify(core)}-vs-${slugify(q ?? '')}`, [`${core} vs ${q}`, `${core} or ${q}`, `difference between ${core} and ${q}`, `${q} vs ${core}`, `${core} and ${q} together`]],
    for: [`/blog/${slugify(core)}-for-${slugify(q ?? '')}`, [`${core} for ${q}`, `best ${core} for ${q}`, `does ${core} help ${q}`, `${q} treatment`, `${core} ${q} results`]],
    other: [`/blog/${s}`, [core, `${core} guide`, `${core} tips`, `${core} reddit`, `${core} for sensitive skin`]],
  }[angle]
  const pages = [
    { path: lead[0], queries: lead[1] },
    { path: `/products/${slugify(product)}`, queries: condition
      ? [`${product} for ${subject}`, `best cream for ${subject}`, `${subject} treatment`, `${subject} at home`, `${subject} fast`]
      : [core, `${product}`, `${core} for sensitive skin`, `${core} price`, `${core} ingredients`] },
    { path: `/guides/${topic.hub}`, queries: condition
      ? [`${subject} routine`, `${subject} products`, `${subject} tips`, `${subject} recovery time`, `${subject} dermatologist`]
      : [`${core} ${angle === 'breakouts' ? 'acne' : angle === 'humid' ? 'summer' : 'guide'}`, `how to choose ${core}`, `${alt} routine`, `${core} tips`, `${core} dermatologist`] },
    { path: `/learn/${ingredient ? slugify(ingredient) : topic.learn}`, queries: ingredient
      ? [`what is ${ingredient}`, `${ingredient} for skin`, `${ingredient} how often`, `${ingredient} side effects`, `${ingredient} vs ${versus}`]
      : condition ? [`what causes ${subject}`, `${subject} causes`, `is ${subject} permanent`, `how long does ${subject} last`, `${subject} explained`]
        : [`what does ${core} do`, `${core} how it works`, `${core} how often`, `${core} side effects`, `${core} explained`] },
    { path: `/collections/${slugify(row?.topic ?? topic.noun)}`, queries: condition
      ? [`${subject} kit`, `${subject} cream`, `${subject} serum`, `${subject} set`, `${subject} products uk`]
      : [`${core} set`, `buy ${core}`, `${core} uk`, `${alt} products`, `${core} sale`] },
    { path: `/faq/${slugify(condition ? subject : core)}`, queries: condition
      ? [`is ${subject} serious`, `${subject} questions`, `can ${subject} heal on its own`, `${subject} or allergy`, `${subject} faq`]
      : [`is ${core} safe`, `${core} questions`, `how long does ${core} take to work`, `can you use ${core} every day`, `${core} with retinol`] },
  ]
  return { prompt, angle, subject, core, alt, pages, newSlug: `/guides/${slugify(prompt)}`, redirect: `/blog/${slugify(core)}` }
}

// the 8-week impressions trend for a page: rising, flat or falling, scaled so its last 4 weeks add up to the page's
// impressions (the list's number, Search Console's last 28 days)
function trendOf(key, total) {
  const slope = -0.2 + rnd(key, 'slope') * 0.55
  const raw = Array.from({ length: 8 }, (_, i) => (1 + slope * ((i - 3.5) / 3.5)) * (0.94 + rnd(key, `w${i}`) * 0.12))
  const k = total / raw.slice(4).reduce((a, b) => a + b, 0)
  const weeks = raw.map((v) => Math.max(1, Math.round(v * k)))
  weeks[7] += total - weeks.slice(4).reduce((a, b) => a + b, 0) // rounding: the last 4 weeks add up exactly
  return weeks
}
// the 8 weeks' start dates (Mondays), the last ending with Search Console's range (gscConnection.endDate)
export const WEEKS = Array.from({ length: 8 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 10, 3 - 7 * (8 - i) + 1))
  return d.toISOString().slice(0, 10)
})
const SHARE = [0.44, 0.22, 0.15, 0.11, 0.08] // a page's impressions over its top 5 queries
const BASE = [9600, 5200, 3100, 1800, 900, 520] // the pages' impressions, most relevant first

// gsc_keywords rows for the prompt (the app's shape), the top 5 per page; queries never repeat (one row per query)
export function gscKeywordsFor(row) {
  const plan = planFor(row)
  const n = rnd(plan.prompt, 'pages') < 0.4 ? 5 : 6
  const seen = new Set()
  return plan.pages.slice(0, n).flatMap((page, pi) => {
    const url = `https://${CO_BRAND.domain}${page.path}`
    const total = BASE[pi] * (0.7 + rnd(plan.prompt, `p${pi}`) * 0.6)
    const ctr = 0.6 + rnd(plan.prompt, `ctr${pi}`) * 2.8
    const pos = 5 + pi * 3 + rnd(plan.prompt, `pos${pi}`) * 8
    const fillers = [`${plan.core} dermatologist`, `${plan.core} reddit`, `${plan.core} how to apply`, `${plan.alt} benefits`, `${plan.core} at night`]
    const kws = []
    for (const k of [...page.queries, ...fillers].map((x) => x.replace(/\s+/g, ' ').trim())) {
      if (kws.length === 5) break
      if (k && !seen.has(k)) { seen.add(k); kws.push(k) }
    }
    const row1 = (keyword, impressions, qctr, position) => ({ keyword, clicks: Math.round((impressions * qctr) / 100), impressions, ctr: qctr, position, url })
    const matching = kws.map((keyword, qi) => {
      const impressions = Math.max(10, Math.round((total * SHARE[qi] * (0.9 + rnd(keyword, 'i') * 0.2)) / 10) * 10)
      return row1(keyword, impressions, +(ctr * (0.7 + rnd(keyword, 'c') * 0.6)).toFixed(1), +(pos + (rnd(keyword, 'p') - 0.5) * 4).toFixed(1))
    })
    // the page's impressions from queries that aren't about the prompt (the brand's name, shipping, a sale): two
    // rows, about a fifth of the page's impressions, the first sized among its top queries
    const words = new Set(promptWords(plan.prompt))
    const pool = OTHER_QUERIES.map((q) => q.replace('{brand}', CO_BRAND.name.toLowerCase())).filter((q) => !promptWords(q).some((w) => words.has(w)) && !seen.has(q))
    const others = [0, 1].map((k) => {
      const free = pool.filter((q) => !seen.has(q))
      const keyword = free[Math.floor(rnd(`${plan.prompt}|${url}`, `o${k}`) * free.length)]
      seen.add(keyword)
      const impressions = Math.max(10, Math.round((total * (k ? 0.07 : 0.18) * (0.85 + rnd(keyword + url, 'i') * 0.3)) / 10) * 10)
      return row1(keyword, impressions, +(ctr * (0.4 + rnd(keyword + url, 'c') * 0.5)).toFixed(1), +(pos + 4 + rnd(keyword + url, 'p') * 10).toFixed(1))
    })
    return [...matching, ...others]
  })
}
// queries a page gets that aren't about any prompt
const OTHER_QUERIES = ['{brand}', '{brand} discount code', '{brand} reviews', '{brand} shipping', '{brand} near me', '{brand} returns', '{brand} login', '{brand} stockists', '{brand} gift card', '{brand} sample kit',
  'skincare gift set', 'cruelty free skincare brands', 'korean skincare', 'skincare sale', 'best skincare brands 2026', 'vegan skincare uk', 'skincare advent calendar', 'travel size skincare', 'skincare fridge', 'minimalist skincare routine']

// candidates: the brand's pages that get impressions for the prompt's queries, ranked by impressions; each with its
// top 5 queries, totals, average position (weighted by impressions) and an 8-week trend. ?co=no-candidates: none.
export function candidatesFor(row) {
  if (coStates().has('no-candidates')) return []
  const words = new Set(promptWords(row?.prompt ?? ''))
  const matches = (k) => promptWords(k.keyword).some((w) => words.has(w))
  const byUrl = new Map()
  for (const k of gscKeywordsFor(row)) {
    if (!byUrl.has(k.url)) byUrl.set(k.url, { url: k.url, all: [] })
    byUrl.get(k.url).all.push({ ...k, match: matches(k) })
  }
  return [...byUrl.values()]
    .map((c) => {
      const all = [...c.all].sort((a, b) => b.impressions - a.impressions)
      const queries = all.filter((k) => k.match) // the prompt's queries
      const others = all.filter((k) => !k.match)
      const sum = (ks, f) => ks.reduce((a, k) => a + k[f], 0)
      const impressions = sum(all, 'impressions')
      const matchImpressions = sum(queries, 'impressions')
      const clicks = sum(all, 'clicks')
      const position = +(all.reduce((a, k) => a + k.position * k.impressions, 0) / impressions).toFixed(1)
      const key = `${row?.prompt}|${c.url}`
      const trend = trendOf(key, impressions)
      // the 4 weeks before (Clicks · CTR · Avg position "vs the previous 4 weeks"): impressions from the trend; clicks
      // at a CTR a little off this period's; the position a little off
      const prevImpr = trend.slice(0, 4).reduce((a, b) => a + b, 0)
      const prev = {
        impressions: prevImpr,
        clicks: Math.round((prevImpr * clicks) / impressions * (0.8 + rnd(key, 'pc') * 0.4)),
        position: +Math.max(1, position + (rnd(key, 'pp') - 0.45) * 5).toFixed(1),
      }
      return { url: c.url, impressions, matchImpressions, clicks, position, queries, others, trend, prev, weeks: weeksOf(key, trend, { matchImpressions, impressions, clicks, position, prev }) }
    })
    .sort((a, b) => b.impressions - a.impressions)
    .map((c, i) => ({ ...c, bestMatch: i === 0 }))
}

// the page week by week (the Search Console column's Mix and Position views): impressions (the trend) split into the
// prompt's queries and the rest, clicks, average position. The last 4 weeks add up to the page's clicks and the
// 4 before to prev.clicks; positions wander around prev.position, then position.
function weeksOf(key, trend, { matchImpressions, impressions, clicks, position, prev }) {
  const share = matchImpressions / impressions
  const spread = (total, ws) => {
    const raw = ws.map((i) => trend[i] * (0.85 + rnd(key, `c${i}`) * 0.3))
    const k = total / raw.reduce((a, b) => a + b, 0)
    const out = raw.map((v) => Math.max(0, Math.round(v * k)))
    out[out.length - 1] += total - out.reduce((a, b) => a + b, 0)
    return out
  }
  const clicksBy = [...spread(prev.clicks, [0, 1, 2, 3]), ...spread(clicks, [4, 5, 6, 7])]
  return trend.map((imp, i) => {
    const matched = Math.min(imp, Math.round(imp * Math.min(0.97, Math.max(0.3, share + (rnd(key, `m${i}`) - 0.5) * 0.12))))
    const base = i < 4 ? prev.position : position
    return { start: WEEKS[i], impressions: imp, matched, other: imp - matched, clicks: Math.max(0, clicksBy[i]), position: +Math.max(1, base + (rnd(key, `q${i}`) - 0.5) * 2.4).toFixed(1) }
  })
}


// "Or create a new page": the suggested slug (the prompt, slugified) and why, naming the path it means (redirect
// detection doesn't exist either)
export function newPageFor(row) {
  const plan = planFor(row)
  return {
    slug: plan.newSlug,
    reason: coStates().has('no-candidates')
      ? 'None of your pages gets impressions for this topic yet.'
      : `${plan.redirect} redirects to the homepage, so a new page is cleaner.`,
  }
}

// "Page winning it": the competitor page AI cites most for the prompt. The row's sources come in citation order
// (data/mock.js: the winners' pages first); a competitor's page is preferred over a publisher's. Its formats (How-to,
// FAQ, Comparison, Listicle) don't exist in the app: derived from the prompt's frame here.
const ANGLE_FORMATS = {
  breakouts: ['FAQ', 'Comparison'], routine: ['How-to', 'FAQ'], howto: ['How-to', 'FAQ'], teens: ['Listicle', 'FAQ'],
  humid: ['Listicle', 'Comparison'], budget: ['Listicle', 'Comparison'], review: ['Comparison', 'FAQ'], benefits: ['FAQ', 'How-to'],
  'best-for': ['Comparison', 'Listicle'], best: ['Listicle', 'Comparison'], versus: ['Comparison', 'FAQ'], for: ['How-to', 'Comparison'], other: ['How-to', 'FAQ'],
}
export function winningPageFor(row) {
  const sources = row?.sources ?? []
  if (!sources.length) return null
  const own = CO_BRAND.domain
  const src = sources.find((x) => x.domain !== own && (row.competitors ?? []).includes(x.domain)) ?? sources.find((x) => x.domain !== own) ?? null
  if (!src) return null
  const { angle } = parsePrompt(row.prompt)
  const formats = [...ANGLE_FORMATS[angle]]
  const extra = ['How-to', 'FAQ', 'Comparison'].find((f) => !formats.includes(f))
  if (rnd(row.prompt, 'formats') < 0.5 && extra) formats.push(extra)
  return { domain: src.domain, path: src.path, formats }
}

// ---- your data (doc §4 (1): the route takes no user input today) --------------------------------------------------
// flags turned into questions the user can answer here
// each question answers one of content-recommend's flag rules (data/contentRecommend.js FLAG_RULES, the draft lib's
// buildReviewFlags): flag = the rule's id. locations → Missing brand info (6) · fees → Needs verification (5) · stats →
// reviews, Needs verification (5). (Your data is behind ?backend=full: the route takes no answers yet.)
export const QUESTIONS = [
  { id: 'locations', label: 'Office locations', placeholder: 'e.g. London, Manchester', answer: '', flag: 'locations' },
  { id: 'fees', label: 'How you quote prices', placeholder: 'e.g. from $24, free shipping over $40', answer: 'From $24; free shipping over $40', flag: 'fees' },
  { id: 'stats', label: 'Approved stats or reviews', placeholder: 'e.g. 4.8 from 2,140 reviews', answer: '', flag: 'reviews' },
]
// addedAt: when the upload started (performance.now(); 0 = long done): it reads for UPLOAD_MS, then shows the facts found
export const UPLOAD_MS = 1000
export const UPLOADS = [
  { id: 'u1', name: 'clinical-study-2025.pdf', type: 'pdf', size: '1.2 MB', addedAt: 0 },
  { id: 'u2', name: 'ingredient-percentages.csv', type: 'csv', size: '8 KB', addedAt: 0 },
]
export const FACTS = [{ label: 'Niacinamide %', value: '10%' }, { label: 'Vitamin C form', value: 'Ethyl ascorbic acid, 15%' }]
// ?co=data-empty: Your data with nothing added (no files, facts or answers)
export const dataEmpty = () => coStates().has('data-empty')

// facts "found" in an uploaded file (proposed: the app reads files server-side and returns no facts), by the file's kind:
// each one is offered as a suggestion in the facts table, so the file row's "Read · n facts" is that list's length.
// Labels are unique across kinds and don't repeat FACTS, so every fact found is offered once.
const FILE_FACTS = {
  pdf: [['Study length', '12 weeks'], ['Participants', '64 adults'], ['Visible change', '-38% dark-spot area']],
  csv: [['Alpha arbutin', '2%'], ['Tranexamic acid', '3%'], ['Kojic acid', '1%'], ['Licorice root extract', '0.5%'], ['Azelaic acid', '10%'],
    ['Glycerin', '5%'], ['Panthenol', '1%'], ['Hyaluronic acid', '0.2%'], ['pH', '5.5'], ['Preservative', 'Phenoxyethanol, 0.8%'], ['Fragrance', 'None']],
  docx: [['Launch date', 'March 2025'], ['Dermatologist tested', 'Yes'], ['Vegan', 'Yes'], ['Made in', 'France']],
  image: [['Packaging', 'Airless pump'], ['Size', '30 ml']],
}
export const factsFound = (file) => {
  const suggestions = (FILE_FACTS[file.type] ?? FILE_FACTS.docx).map(([label, value]) => ({ label, value, from: file.name, key: `${file.id}:${label}` }))
  return { n: suggestions.length, suggestions }
}

// ---- draft generation steps (the route does these in one request and returns no progress) ------------------------
export const GEN_STEPS = [
  { id: 'read', label: 'Reading page-1 results', count: (n) => `${n} pages read`, total: 7, ms: 1100 },
  { id: 'formats', label: 'Comparing formats', count: (n) => `${n} formats`, total: 5, ms: 800 },
  { id: 'competitors', label: 'Checking competitors', count: (n) => `${n} competitors`, total: 2, ms: 700 },
  { id: 'write', label: 'Writing', count: (n) => `${n} sections`, total: 8, ms: 1500 },
  { id: 'claims', label: 'Checking claims', count: (n) => `${n} claims`, total: 6, ms: 900 },
]
export const genFails = () => coStates().has('gen-failed')
// ?co=gen-hold: the writing's clock stops during "Reading page-1 results" (5 of 7 pages read); ?co=gen-hold-N (1–5):
// it stops 60% into step N, for screenshots of each step's live view → the ms to stop at, or false
export function genHold(steps = GEN_STEPS) {
  const co = coStates()
  const n = [1, 2, 3, 4, 5].find((k) => co.has(`gen-hold-${k}`))
  if (n) return steps.slice(0, n - 1).reduce((a, x) => a + x.ms, 0) + steps[n - 1].ms * 0.6
  return co.has('gen-hold') ? 820 : false
}
// the writing's steps with their counts from the data they work through (the pages read, the formats, the competitors,
// the outline's sections, the claims), so the rail, the live view, the summary line and the flags agree
export const genStepsFor = ({ pages, formats, competitors, outline, claims }) => GEN_STEPS.map((x) => ({
  ...x, total: { read: pages, formats, competitors, write: outline, claims }[x.id].length ?? x.total,
}))

// the pages "Reading page-1 results" reads: the prompt's cited sources, then its competitors, each domain once, with a
// page title (proposed: the generate response has pages[].title for its 4; extended per prompt, deterministically)
const TITLE_FORMS = [
  (p) => `${p}: what dermatologists recommend`,
  (p) => `${p}, explained`,
  (p) => `The complete guide: ${p.toLowerCase()}`,
  (p) => `${p} (tested and compared)`,
  (p) => `${p}: a step-by-step routine`,
]
export function readPages(row) {
  const topic = String(row?.prompt ?? '').replace(/\?$/, '').replace(/^./, (c) => c.toUpperCase())
  const seen = new Set()
  return [...(row?.sources ?? []).map((x) => ({ domain: x.domain, path: x.path ?? '' })), ...(row?.competitors ?? []).map((d) => ({ domain: d, path: '' }))]
    .filter((x) => !seen.has(x.domain) && seen.add(x.domain))
    .map((x) => ({ ...x, title: TITLE_FORMS[Math.floor(rnd(`${row?.prompt}|${x.domain}`, 'title') * TITLE_FORMS.length)](topic) }))
}

// ---- the draft, as sections (the route returns one Markdown string; no sections[] exists) ------------------------
// [[c:domain]] marks a competitor name; [[confirm]] marks a "Confirm with your team" line.
export const DRAFT = {
  title: 'How to layer niacinamide and vitamin C',
  answer: 'You can use niacinamide and vitamin C in the same routine. Apply vitamin C first on clean, dry skin, wait about a minute, then apply niacinamide. If your skin flushes, use vitamin C in the morning and niacinamide at night.',
  keyPoints: [
    'The two don\'t cancel each other out at today\'s formulas and pH levels.',
    'Thinnest texture first: vitamin C serum, then niacinamide, then moisturizer.',
    'Start with 5% niacinamide if your skin is sensitive. [[confirm]]',
    'Always finish with SPF in the morning; vitamin C works best under it.',
  ],
  steps: [
    'Cleanse and pat skin dry.',
    'Apply 3–4 drops of vitamin C serum.',
    'Wait 60 seconds so it absorbs.',
    'Apply 2–3 drops of niacinamide serum.',
    'Seal with moisturizer, then SPF in the morning.',
  ],
  comparison: {
    columns: ['Same routine', 'Split AM / PM', 'Alternate days'],
    rows: [
      ['Fastest results', [true, false, false]],
      ['Lowest irritation', [false, true, true]],
      ['Works with retinol at night', [false, true, true]],
      ['Fewest products per routine', [false, true, true]],
    ],
  },
  explanation: [
    'Older advice said the two react into niacin and cause flushing. That happened with pure L-ascorbic acid at high heat, not on skin at room temperature.',
    'Most people tolerate both together. Unlike [[c:cerave.com]]\'s routine, which stacks three actives, this keeps it to two.',
  ],
  example: {
    text: 'Average visible-spot score in a 12-week routine using both serums (lower is better). [[confirm]]',
    unit: 'score',
    series: [[0, 62], [2, 58], [4, 52], [6, 47], [8, 43], [10, 40], [12, 38]],
    xLabel: 'week',
  },
  faq: [
    ['Can I use them with retinol?', 'Yes, but keep retinol for the night and vitamin C for the morning.'],
    ['Which percentage should I start with?', 'Try 5% niacinamide and 10% vitamin C, then step up after four weeks.'],
    ['Is a tingle normal?', 'A light tingle for a few seconds is normal. Redness that lasts is not: split them AM / PM.'],
    ['Do I need to wait between them?', 'About a minute is enough for most serums.'],
  ],
  sources: ['healthline.com', 'allure.com', 'verywellhealth.com', 'byrdie.com'],
}

// flags (doc: "Does not exist"): what blocks publishing; resolved = ticked by the user
export const FLAGS = [
  { id: 'f1', label: 'Competitor named in the draft', score: 8, text: 'CeraVe is named in "Detailed explanation".', resolved: false },
  { id: 'f2', label: 'Unverified stat', score: 7, text: 'The 12-week score needs a source you approve.', resolved: false },
  { id: 'f3', label: 'Percentage advice', score: 5, text: 'Starting at 5% is a claim your team should confirm.', resolved: false },
  { id: 'f4', label: 'Prices', score: 3, text: 'Matches what you entered in Your data.', resolved: true },
  { id: 'f5', label: 'Medical wording', score: 2, text: 'No treatment claims found.', resolved: true },
]

// the draft's checkable claims ("Checking claims"), in the draft's order: flag = the draft-check flag that names it (it
// needs your OK); the rest were verified against the sources (proposed: the app checks claims inside one request)
export const CLAIMS = [
  { id: 'c1', text: 'You can use niacinamide and vitamin C in the same routine.' },
  { id: 'c2', text: 'The two don\'t cancel each other out at today\'s formulas and pH levels.' },
  { id: 'c3', text: 'Start with 5% niacinamide if your skin is sensitive.', flag: 'f3' },
  { id: 'c4', text: 'Older advice said the two react into niacin and cause flushing.' },
  { id: 'c5', text: 'Average visible-spot score in a 12-week routine using both serums (lower is better).', flag: 'f2' },
]

// format coverage (doc: only intent.expected_format exists)
export const FORMATS = [
  { type: 'How-to', covered: true, competitors: ['cerave.com', 'theordinary.com'] },
  { type: 'Comparison', covered: true, competitors: ['cerave.com'] },
  { type: 'Stats', covered: true, competitors: [] },
  { type: 'FAQ', covered: true, competitors: ['theordinary.com'] },
  { type: 'Listicle', covered: false, competitors: ['cerave.com', 'theordinary.com'] },
]

// sources to outrank, with rank, AI badge and formats (doc: only { domain, path } exists)
export const SOURCE_RANKS = [
  { domain: 'healthline.com', path: '/niacinamide-vitamin-c', rank: 1, ai: true, formats: ['How-to', 'FAQ'] },
  { domain: 'cerave.com', path: '/blog/layering-guide', rank: 2, ai: true, formats: ['How-to', 'Comparison'] },
  { domain: 'allure.com', path: '/guides/serum-order', rank: 4, ai: false, formats: ['Listicle'] },
  { domain: 'byrdie.com', path: '/t/4821', rank: 6, ai: true, formats: ['FAQ'] },
]

// ---- publish check (doc §4 (2)) and tracking (doc §4 (3): prompt_visibility_snapshot is_visible per engine) -------
export const publishCheck = () => (coStates().has('not-found')
  ? { status: 'not_found', checked_days: 14, target_url: `https://${CO_BRAND.domain}/guides/niacinamide-and-vitamin-c` }
  : { status: 'published', published_at: '2026-11-05T07:40:00Z', match: 0.92 })

// 4 syncs after publishing; engines: { engine: true (named) | false (not named) }; null = the sync failed (a gap, "—")
export function trackingFor(draft) {
  const week = draft?.week ?? 4
  const gained = draft?.gained ?? ['google', 'chatgpt']
  const before = 0
  const missedSync = coStates().has('missed-sync')
  return SYNCS.slice(4).map((date, i) => {
    if (i >= week) return { date, pending: true }
    if (missedSync && i === 1) return { date, engines: null, visibility: null }
    const engines = Object.fromEntries(ENGINES.map((e) => [e, gained.includes(e) && i >= (e === 'google' ? 0 : 2)]))
    const named = Object.values(engines).filter(Boolean).length
    return { date, engines, visibility: { before, after: Math.round((named / ENGINES.length) * 100) } }
  })
}
export const NEXT_TRIES = [
  { title: 'Add a comparison table', text: 'Both pages AI cites for this prompt have one.' },
  { title: 'Answer in the first 40 words', text: 'Move the direct answer above the intro image.' },
]

// ---- Who you're up against: each cited page's formats and the engines that cite it ---------------------------------
// The row's sources are real ({ domain, path }); neither formats nor which engine cites a source exist in the app.
// Engines: a competitor's page → the engines its brand is named on for the prompt (row.brandsMentioned); a
// publisher's page → 1–3 engines picked deterministically. Formats: winningPageFor's for the winning page, else 1–2
// picked deterministically from the prompt's frame.
const ALL_FORMATS = ['How-to', 'FAQ', 'Comparison', 'Listicle']
export function citedBy(row, source, engines = ENGINES) {
  const brand = (row?.brandsMentioned ?? []).find((b) => b.domain === source.domain)
  if (brand?.platforms?.length) return engines.filter((e) => brand.platforms.includes(e))
  const key = `${row?.prompt}|${source.domain}${source.path}`
  const n = 1 + Math.floor(rnd(key, 'n') * 3)
  return [...engines].sort((a, b) => rnd(key, a) - rnd(key, b)).slice(0, n).sort((a, b) => engines.indexOf(a) - engines.indexOf(b))
}
export function formatsOf(row, source) {
  const w = winningPageFor(row)
  if (w && w.domain === source.domain && w.path === source.path) return w.formats
  const key = `${row?.prompt}|${source.domain}${source.path}`
  const { angle } = parsePrompt(row?.prompt ?? '')
  const first = ANGLE_FORMATS[angle][rnd(key, 'f') < 0.5 ? 0 : 1]
  const second = ALL_FORMATS.filter((f) => f !== first)[Math.floor(rnd(key, 'g') * 3)]
  return rnd(key, 'two') < 0.5 ? [first] : [first, second]
}

// ---- Your pages: the AI engines that cite each of the brand's pages for this prompt (doc: no per-page citation data
// for a prompt exists). Only engines where the brand is named for the prompt (not in row.platforms) can cite its page;
// each of those cites a page with a chance that falls with the page's rank (the best match most often). Deterministic.
export function enginesCitingPage(row, url, rank = 0, engines = ENGINES) {
  const named = engines.filter((e) => !(row?.platforms ?? []).includes(e))
  return named.filter((e) => rnd(`${row?.prompt}|${url}`, `cite-${e}`) < Math.max(0.15, 0.75 - rank * 0.15))
}
