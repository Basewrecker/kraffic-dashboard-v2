// Mock AI answers for the Answer drawer: one per prompt × engine × sync, generated deterministically.
//   getAnswer(key, engine, date, focalDomain) → { prompt, engine, date, response (markdown), units, brands[], sources[],
//                                                visible, cited, position }
// key: a tracked prompt id ("v12" / "m3") or a marketplace prompt ("mp7").
// Who appears comes from the dashboard's appearances table (so the drawer agrees with the tables);
// older syncs are the current answer perturbed: some sentences reworded, some brands/sources in or out.
import { appearances, TRACKED_BRANDS, enginePid } from './brandViews.js'
import { account, guessCategory, marketplace, recentSyncs, trackedPrompts } from './mock.js'

export const ANSWER_SYNCS = [...recentSyncs].reverse() // newest first: "Oct 5, 2026", "Sep 28, 2026", …
export const LATEST = ANSWER_SYNCS[0]

// other brands AI answers name (fictional, like the tracked ones)
const OTHER_BRANDS = ['La Roche-Posay', 'Neutrogena', 'Supergoop!', 'EltaMD', 'Cetaphil', 'First Aid Beauty', 'Drunk Elephant']
const EDITORIAL = [
  ['healthline.com', '/health/beauty-skin-care/'], ['byrdie.com', '/best-'], ['reddit.com', '/r/SkincareAddiction/comments/'],
  ['sephora.com', '/shop/'], ['ulta.com', '/shop/skin-care/'], ['vogue.com', '/article/'], ['allure.com', '/story/'],
  ['amazon.com', '/s?k='], ['target.com', '/s?searchTerm='],
]
const PRODUCT = { // what each brand is "known for", by topic
  Serums: ['lightweight serum', 'niacinamide serum', 'vitamin C serum'], Moisturizers: ['gel moisturizer', 'ceramide cream', 'barrier cream'],
  Sunscreen: ['gel sunscreen', 'tinted SPF', 'mineral sunscreen'], Cleansers: ['gentle face wash', 'foaming cleanser', 'cream cleanser'],
  Acne: ['salicylic gel', 'spot treatment', 'clarifying toner'], Pigmentation: ['dark spot serum', 'brightening cream', 'tranexamic serum'],
  'Eye & lip': ['under eye cream', 'lip balm', 'eye gel'], 'Body care': ['body lotion', 'exfoliating scrub', 'urea cream'], Makeup: ['cheek tint', 'highlighter', 'skin tint'],
}
const LOOK_FOR = {
  Serums: ['Niacinamide at 5–10% for oil control', 'A stable vitamin C derivative', 'Fragrance-free formulas for sensitive skin'],
  Moisturizers: ['Ceramides to repair the barrier', 'Glycerin or hyaluronic acid for hydration', 'Non-comedogenic textures'],
  Sunscreen: ['SPF 50 and PA++++', 'A gel or fluid texture with no white cast', 'Reapplication every two to three hours'],
  Cleansers: ['A pH close to 5.5', 'No harsh sulphates', 'A low-foam formula for dry skin'],
  Acne: ['Salicylic acid at 1–2%', 'Benzoyl peroxide for inflamed spots', 'Oil-free, non-comedogenic labels'],
  Pigmentation: ['Tranexamic acid or alpha arbutin', 'Daily sunscreen alongside it', 'Patience: results take 8–12 weeks'],
  'Eye & lip': ['Caffeine for puffiness', 'Peptides for fine lines', 'Fragrance-free formulas near the eyes'],
  'Body care': ['Urea or lactic acid for rough skin', 'Gentle exfoliation once or twice a week', 'A rich cream after showering'],
  Makeup: ['Buildable, sheer pigment', 'Skin-care ingredients in the formula', 'Shades tested on deeper skin tones'],
}

function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 } }
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
const pick = (arr, r) => arr[Math.floor(r() * arr.length)]
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

const trackedById = Object.fromEntries(trackedPrompts.map((p) => [p.id, p]))
export function answerPrompt(key) {
  if (key.startsWith('mp')) {
    const m = marketplace.prompts[Number(key.slice(2))]
    return m && { key, prompt: m.prompt, topic: guessCategory(m.prompt), market: m }
  }
  const p = trackedById[key]
  return p && { key, prompt: p.prompt, topic: p.category }
}

// which tracked brands appear in this prompt's answer on this engine (current sync)
function trackedMentions(item, engine) {
  const pid = enginePid(engine)
  if (item.market) {
    const m = item.market
    return TRACKED_BRANDS.filter((b) => (b.you ? m.result === 'yours' : m.brand === b.domain) && pid === 'google').map((b) => ({ ...b, cited: true, page: m.page.path }))
  }
  const a = appearances[item.key]
  return TRACKED_BRANDS.filter((b) => a[b.domain].platforms.includes(pid)).map((b) => ({ ...b, cited: a[b.domain].citedPlatforms.includes(pid), page: a[b.domain].citedPage }))
}

// --- sentence pools: each slot has variants; older syncs pick a different variant for some slots
function slots(item, r) {
  const topic = item.topic in LOOK_FOR ? item.topic : 'Serums'
  const subject = item.prompt.replace(/^(best|top rated|which|is|how to|what is|should i)\s+/i, '').replace(/\?$/, '')
  return {
    topic,
    heading: [`${cap(subject)}: what to know`, `Choosing ${subject}`, `${cap(subject)}, explained`],
    intro: [
      [`The right pick depends on your skin type and what you want to fix first.`, `Most dermatologists suggest starting simple and adding one active at a time.`],
      [`There isn’t one best option for everyone; skin type matters most.`, `Start with one new product and give it a few weeks before judging it.`],
      [`Your skin type and main concern should guide the choice.`, `Introduce one product at a time so you can tell what works.`],
    ],
    look: LOOK_FOR[topic],
    lookAlt: LOOK_FOR[topic].map((x) => x.replace(/^A /, 'Look for a ').replace(/^(?!Look)/, '')),
    why: [`well reviewed for gentle, everyday use`, `often recommended for sensitive skin`, `a popular pick at its price`, `praised for a light texture`, `a dermatologist favourite`],
    closing: [
      [`Patch test anything new and wear sunscreen daily, especially with actives.`],
      [`Whatever you choose, patch test first and pair it with daily SPF.`],
      [`Patch test before full use, and keep sunscreen in your routine.`],
    ],
    r,
  }
}

// one rendered answer from a "state" (brands, sources, chosen variants)
function render(item, state) {
  const units = []
  const push = (kind, text, block) => units.push({ kind, text, block })
  push('h2', state.heading, 0)
  state.intro.forEach((t) => push('p', t, 1))
  push('h3', 'What to look for', 2)
  state.look.forEach((t, i) => push('li', t, 3 + i * 0)) // one list block
  push('h3', 'Brands worth trying', 4)
  state.brands.forEach((b) => push('li', `**${b.name}** — ${b.product}, ${b.why}.`, 5))
  state.closing.forEach((t) => push('p', t, 6))
  // markdown, for the data contract (and copy/export)
  let md = ''
  let last = null
  units.forEach((u) => {
    const gap = last !== null && (u.block !== last || u.kind.startsWith('h')) ? '\n\n' : u.kind === 'p' && last !== null ? ' ' : '\n'
    md += (md ? gap : '') + (u.kind === 'h2' ? `## ${u.text}` : u.kind === 'h3' ? `### ${u.text}` : u.kind === 'li' ? `- ${u.text}` : u.text)
    last = u.block
  })
  return { units, response: md }
}

function baseState(item, engine) {
  const r = rng(hash(`${item.key}|${engine}`))
  const s = slots(item, r)
  const products = PRODUCT[s.topic]
  const tracked = trackedMentions(item, engine)
  const others = OTHER_BRANDS.filter(() => r() < 0.55).slice(0, 3 + Math.floor(r() * 3))
  // tracked brands land early in the list (they're the ones the dashboard tracks); others fill around them
  const names = [...others.map((n) => ({ name: n }))]
  tracked.forEach((b) => names.splice(Math.floor(r() * Math.min(3, names.length + 1)), 0, b))
  const brands = names.map((b) => ({ ...b, product: pick(products, r), why: pick(s.why, r) }))
  const v = Math.floor(r() * 3)
  const sources = [
    ...tracked.filter((b) => b.cited).map((b) => ({ domain: b.domain, path: b.page ?? '/' })),
    ...tracked.filter((b) => !b.cited && !b.you && r() < 0.4).map((b) => ({ domain: b.domain, path: `/products/${slug(pick(products, r))}` })),
    ...EDITORIAL.filter(() => r() < 0.6).slice(0, 4 + Math.floor(r() * 4)).map(([d, p]) => ({ domain: d, path: `${p}${slug(item.prompt).slice(0, 40)}` })),
  ]
  return { heading: s.heading[v], intro: s.intro[v], look: s.look, closing: s.closing[v], brands, sources, s }
}

// an older sync: same prompt, partly rewritten; a few brands/sources swapped
function olderState(item, engine, base, date) {
  const r = rng(hash(`${item.key}|${engine}|${date}`))
  if (r() < 0.12) return base // nothing changed that week
  const s = base.s
  const alt = (cur, arr) => (r() < 0.45 ? arr.find((x) => x !== cur) ?? cur : cur)
  const v = Math.floor(r() * 3)
  const keepBrands = base.brands.filter((b) => b.you || r() > 0.2) // some brands are new this week
  const extra = OTHER_BRANDS.filter((n) => !base.brands.some((b) => b.name === n) && r() < 0.35).slice(0, 4)
    .map((n) => ({ name: n, product: pick(PRODUCT[s.topic], r), why: pick(s.why, r) }))
  // the focal brand's history: occasionally it wasn't in the older answer (newly visible)
  const brands = [...keepBrands.filter((b) => !(b.you && r() < 0.12)), ...extra]
  const keepSources = base.sources.filter(() => r() > 0.35)
  const moreSources = EDITORIAL.filter(([d]) => !base.sources.some((x) => x.domain === d) && r() < 0.5).slice(0, 5)
    .map(([d, p]) => ({ domain: d, path: `${p}${slug(item.prompt).slice(0, 32)}` }))
  return {
    heading: alt(base.heading, s.heading),
    intro: r() < 0.5 ? s.intro[v] : base.intro,
    look: base.look.map((t, i) => (r() < 0.3 ? s.lookAlt[i] || t : t)),
    closing: r() < 0.5 ? s.closing[(v + 1) % 3] : base.closing,
    brands,
    sources: [...keepSources, ...moreSources],
    s,
  }
}

const cache = new Map()
export function getAnswer(key, engine, date = LATEST, focalDomain = account.domain) {
  const ck = `${key}|${engine}|${date}|${focalDomain}`
  if (cache.has(ck)) return cache.get(ck)
  const item = answerPrompt(key)
  if (!item) return null
  const base = baseState(item, engine)
  const state = date === LATEST ? base : olderState(item, engine, base, date)
  const { units, response } = render(item, state)
  const brands = state.brands.map((b) => ({ name: b.name, domain: b.domain ?? null, focal: b.domain === focalDomain, tracked: !!b.domain }))
  const focalIdx = brands.findIndex((b) => b.focal)
  const ownSite = (s) => s.domain === focalDomain
  const sources = [...state.sources.filter(ownSite), ...state.sources.filter((s) => !ownSite(s))]
  const out = {
    key, prompt: item.prompt, engine, date, response, units, brands, sources,
    visible: focalIdx !== -1,
    cited: sources.some(ownSite),
    position: focalIdx === -1 ? null : focalIdx + 1,
  }
  cache.set(ck, out)
  return out
}

// ---------------------------------------------------------------- What changed
const sentences = (units) => units.flatMap((u) => (u.kind === 'p' ? u.text.split(/(?<=[.!?])\s+/).map((t) => ({ ...u, text: t })) : [u]))
const words = (t) => t.split(/\s+/).filter(Boolean).length

// LCS over sentence units → [{ op: 'same' | 'add' | 'del', kind, text, block }] in reading order
function diffUnits(a, b) {
  const n = a.length, m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    dp[i][j] = a[i].text === b[j].text && a[i].kind === b[j].kind ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  }
  const out = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i].text === b[j].text && a[i].kind === b[j].kind) { out.push({ op: 'same', ...b[j] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ op: 'del', ...a[i] }); i++ }
    else { out.push({ op: 'add', ...b[j] }); j++ }
  }
  while (i < n) out.push({ op: 'del', ...a[i++] })
  while (j < m) out.push({ op: 'add', ...b[j++] })
  return out
}

export function compareAnswers(cur, prev) {
  const diff = diffUnits(sentences(prev.units), sentences(cur.units))
  const changedWords = diff.filter((d) => d.op !== 'same').reduce((n, d) => n + words(d.text), 0)
  const allWords = diff.reduce((n, d) => n + words(d.text), 0)
  const names = (x) => x.brands.map((b) => b.name)
  const srcKey = (s) => `${s.domain}${s.path}`
  return {
    diff,
    rewritten: allWords ? Math.round((changedWords / allWords) * 100) : 0,
    visibility: cur.visible && prev.visible ? 'still' : cur.visible ? 'new' : prev.visible ? 'lost' : 'none',
    brandsNew: cur.brands.filter((b) => !names(prev).includes(b.name)),
    brandsDropped: prev.brands.filter((b) => !names(cur).includes(b.name)),
    sourcesNew: cur.sources.filter((s) => !prev.sources.some((p) => srcKey(p) === srcKey(s))),
    sourcesDropped: prev.sources.filter((s) => !cur.sources.some((c) => srcKey(c) === srcKey(s))),
    unchanged: diff.every((d) => d.op === 'same') && cur.sources.length === prev.sources.length && cur.brands.length === prev.brands.length,
  }
}
