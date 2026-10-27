// Marketplace visibility, week by week (the drawer opened from the Marketplace visibility card). Mock only.
// Same weeks as Mentions and citations (one per weekly scan, newest first, the brand's own sync history), and the same
// failed scan (Gemini in the week of Sep 7: any number that counts Gemini that week is unknown, never 0).
//   · a week is the SET of prompts whose answer links to one of your listings: { prompt id → { markets, engine } }
//   · the newest week is exactly the card: 18 prompts, Target 12, Amazon 8 (2 prompts link to both)
//   · gained / lost are set differences against the last complete week, so gained − lost is always the week's change
//   · Compare with: competitors' listings (CeraVe, The Ordinary, Paula's Choice) come from the same answers
//     (marketplace.prompts result 'competitor'); only their weekly totals are kept, no gained / lost
// PORT NOTE: production should store, per scan, which prompt's answer linked to which listing (marketplace, path,
// engine). A failed engine scan is null, never 0. Each linking prompt here links on one engine (the mock's
// simplification); production counts a prompt once in "All engines" however many engines link it.
// Previews: ?mktMock=loading (skeleton) · ?mktMock=empty (no marketplace links yet) · ?mktMock=short (3 weekly scans
// so far) · ?mktMock=one (the first scan only: nothing to compare) · ?off=ecommerce (flag off)
// History starts with the first scan and grows weekly: the drawer shows every week there is (no cap), and under
// COLLECTING weeks it says it's still collecting.
import { ENGINE_ORDER, OWN, TRACKED_BRANDS, getBrandView } from './brandViews.js'
import { FAILED, weekLabel, weekMonth } from './citationHistory.js'
import { marketplace } from './mock.js'

export const marketMock = () => {
  try { return new URLSearchParams(window.location.search).get('mktMock') } catch { return null }
}

const MARKETS = marketplace.segments.find((s) => s.key === 'yours').rows.map((r) => r.label) // ['Target', 'Amazon']
const HOST = { Target: 'target.com', Amazon: 'amazon.com' }
export const MARKET_METRICS = [
  { id: 'linking', label: 'Linking prompts', one: 'linking prompt' },
  { id: 'share', label: 'Share', one: 'share', pct: true },
  ...MARKETS.map((m) => ({ id: m.toLowerCase(), label: m, one: `${m} link`, market: m })),
]
const TOTAL = marketplace.total // 152
// the engines that link to marketplaces in the mock (a prompt links on one of them)
export const MARKET_ENGINES = ['aio', 'chatgpt', 'gemini']

const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const round1 = (x) => Math.round(x * 10) / 10
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// your listing on a marketplace for one prompt ("/p/dermasuri-niacinamide-serum/-/A-81012")
// the product named in the prompt, without the question around it ("buy vitamin C serum online" → "vitamin-c-serum")
const FRAME = new Set('buy online best price on amazon where to reviews and ratings rated under 20 for sensitive skin dermatologist in stock gift set bundle deal is worth it oily'.split(' '))
export function listingPath(p, market) {
  const item = `dermasuri-${slug(p.prompt).split('-').filter((w) => !FRAME.has(w)).join('-')}`
  return market === 'Amazon' ? `/${item}/dp/B0${7000 + p.id}` : `/p/${item}/-/A-${81000 + p.id}`
}

// gained / lost per week, newest first (the oldest week has nothing before it). Counts: 18, 15, 16, 14, 12, 11, 11, 9, 10, 8
const MOVES = [[3, 0], [1, 2], [3, 1], [2, 0], [2, 1], [1, 1], [2, 0], [0, 1], [2, 0]]

const cache = new Map()
// { weeks: [{ id, date, label, month, links: Map(id → { markets, engine }) }], syncs }
export function marketWeeks(mock = null) {
  const key = mock ?? ''
  if (cache.has(key)) return cache.get(key)
  const syncs = getBrandView(OWN.domain).syncHistory
  const byId = new Map(marketplace.prompts.map((p) => [p.id, p]))
  const engineOf = (id) => MARKET_ENGINES[hash(`e${id}`) % MARKET_ENGINES.length]
  // the newest week: the card's 18 prompts
  let set = mock === 'empty' ? new Map() : new Map(marketplace.prompts.filter((p) => p.result === 'yours').map((p) => [p.id, { markets: p.markets, engine: engineOf(p.id) }]))
  // prompts that linked to you in earlier weeks but don't now (they come back as "lost" rows)
  const pool = marketplace.prompts.filter((p) => p.result === 'none' || p.result === 'category').map((p) => p.id)
  let next = 0
  const sets = [set]
  for (let i = 0; i < syncs.length - 1 && mock !== 'empty'; i++) {
    const [g, l] = MOVES[i] ?? [0, 0]
    const prev = new Map(set)
    // gained this week: newest-week prompts first; week 0 and week 2 gain Target-only links (the brief's example rows)
    const ids = [...set.keys()].sort((a, b) => hash(`${i}|${a}`) - hash(`${i}|${b}`))
    const pick = i === 0 || i === 2 ? ids.filter((id) => set.get(id).markets.join() === 'Target') : ids
    pick.slice(0, g).forEach((id) => prev.delete(id))
    for (let k = 0; k < l; k++) {
      const id = pool[next++ % pool.length]
      prev.set(id, { markets: [MARKETS[hash(`m${id}`) % MARKETS.length]], engine: engineOf(id) })
    }
    sets.push(prev)
    set = prev
  }
  const scans = mock === 'one' ? 1 : mock === 'short' ? 3 : syncs.length
  const weeks = syncs.slice(0, scans).map((s, i) => ({ id: s.id, date: s.date, label: weekLabel(s.date), month: weekMonth(s.date), links: sets[i] ?? new Map() }))
  const out = { weeks, syncs, byId }
  cache.set(key, out)
  return out
}

// the links in an engine scope ('all' or one engine); a failed engine in scope → null
const failedIn = (i, engine, enabled) => (engine === 'all' ? enabled : [engine]).filter((e) => (FAILED[e] ?? []).includes(i))
function scoped(week, engine) {
  return [...week.links].filter(([, v]) => engine === 'all' || v.engine === engine)
}
export function marketTotals(week, i, engine, enabled) {
  const failed = failedIn(i, engine, enabled)
  if (failed.length) return { ...Object.fromEntries(MARKET_METRICS.map((m) => [m.id, null])), failed }
  const links = scoped(week, engine)
  const t = { linking: links.length, share: round1((links.length / TOTAL) * 100), failed }
  for (const m of MARKETS) t[m.toLowerCase()] = links.filter(([, v]) => v.markets.includes(m)).length
  return t
}

// every week in a scope, newest first; the same shape as citationHistory's weekRows
// (a week after a failed scan compares with the last complete one: skipped)
export function marketRows(engine, enabled, count, mock = null) {
  const { weeks } = marketWeeks(mock)
  const list = count ? weeks.slice(0, count) : weeks
  return list.map((w, i) => {
    const totals = marketTotals(w, i, engine, enabled)
    let prev = null, prevWeek = null, prevIndex = null
    for (let j = i + 1; j < weeks.length; j++) {
      const t = marketTotals(weeks[j], j, engine, enabled)
      if (!t.failed.length) { prev = t; prevWeek = weeks[j]; prevIndex = j; break }
    }
    const skipped = prevWeek != null && prevWeek !== weeks[i + 1]
    const delta = Object.fromEntries(MARKET_METRICS.map((m) => [m.id, prev && totals[m.id] != null ? round1(totals[m.id] - prev[m.id]) : null]))
    return { week: w, index: i, prevIndex, totals, prev, prevWeek, skipped, delta }
  })
}

const ENGINE_NAMES = { aio: 'AI Overview', chatgpt: 'ChatGPT', gemini: 'Gemini' }
const marketsText = (ms) => (ms.length > 1 ? `${ms.join(' and ')} listings` : `${ms[0]} listing`)
// what changed in a week for one metric: { gained: [{ key, prompt, meta, markets, engine }], lost } or null.
// Per-marketplace metrics count only links to that marketplace.
export function marketChanges({ metric, row, engine, mock = null }) {
  const { totals, prev, prevWeek } = row
  if (!prev || totals[metric] == null) return null
  const { byId } = marketWeeks(mock)
  const m = MARKET_METRICS.find((x) => x.id === metric)
  const keep = ([, v]) => !m.market || v.markets.includes(m.market)
  const now = new Map(scoped(row.week, engine).filter(keep))
  const before = new Map(scoped(prevWeek, engine).filter(keep))
  const item = (id, v, gained) => {
    const p = byId.get(id)
    const ms = m.market ? [m.market] : v.markets
    const paths = ms.map((x) => `${HOST[x]}${listingPath(p, x)}`).join(' · ')
    return {
      key: id, prompt: p.prompt, markets: ms, engine: v.engine, path: paths,
      meta: gained ? `${ENGINE_NAMES[v.engine]} links to your ${marketsText(ms)} · ${paths}` : `${ENGINE_NAMES[v.engine]} no longer links to your ${marketsText(ms)} · was ${paths}`,
      plain: true,
    }
  }
  return {
    gained: [...now].filter(([id]) => !before.has(id)).map(([id, v]) => item(id, v, true)),
    lost: [...before].filter(([id]) => !now.has(id)).map(([id, v]) => item(id, v, false)),
  }
}

const fmtD = (d, pct) => `${d > 0 ? '+' : '−'}${pct ? `${Math.abs(d).toFixed(1)} pts` : Math.abs(d)}`
// line 2 of a week row: "+3 prompts now link to your Target listing · 1 dropped"
export function marketSummary({ metric, row, changes }) {
  if (row.totals.failed.length) return 'Scan didn’t complete this week'
  if (!row.prev) return 'First week in this history'
  if (!changes) return 'The week before didn’t complete: nothing to compare'
  const m = MARKET_METRICS.find((x) => x.id === metric)
  if (row.skipped) {
    const d = row.delta[metric]
    const rest = marketSummary({ metric, row: { ...row, skipped: false }, changes })
    return `${d === 0 ? 'No change' : fmtD(d, m.pct)} vs ${row.prevWeek.label} · ${rest}`
  }
  const g = changes.gained.length, l = changes.lost.length
  if (!g && !l) return m.market ? `No change in ${m.market} links` : 'No change in linking prompts'
  const ms = [...new Set(changes.gained.flatMap((x) => x.markets))]
  const where = ms.length === 1 ? `your ${ms[0]} listing` : 'your listings'
  return [g && `+${plural(g, 'prompt')} now ${g === 1 ? 'links' : 'link'} to ${where}`, l && `${l} dropped`].filter(Boolean).join(' · ')
}

// the insight line under the chart: the newest week against the period. { text, calc, keys: [row indexes] } or null
export function marketInsight({ metric, rows, changes }) {
  const now = rows[0]
  if (!now || rows.length < 2) return null
  const m = MARKET_METRICS.find((x) => x.id === metric)
  const what = m.pct ? 'share of prompts linking to your listings' : m.market ? `${m.market} links` : 'linking prompts'
  if (now.totals.failed.length) {
    const last = rows.find((r) => !r.totals.failed.length)
    return { text: `This week’s scan didn’t complete${last ? `: the last full week was ${last.week.label}` : ''}`, calc: `${now.week.label} isn’t counted as 0: the scan didn’t finish on every engine.`, keys: [0] }
  }
  const d = now.delta[metric]
  const c = changes[0]
  if (d == null || !c) return { text: 'The week before didn’t complete, so this week has nothing to compare', calc: 'No earlier complete week.', keys: [0] }
  if (d === 0) return { text: `No change in ${what} this week`, calc: `${now.week.label} has as many ${what} as ${now.prevWeek.label}.`, keys: [0] }
  const up = d > 0
  const j = rows.findIndex((r, i) => i > 0 && r.delta[metric] != null && (up ? r.delta[metric] >= d : r.delta[metric] <= d))
  const since = j === -1 ? `in ${rows.length} weeks` : `since ${rows[j].week.month === now.week.month ? rows[j].week.label.split(' – ')[0] : rows[j].week.month}`
  const target = m.market ? `your ${m.market} listing` : 'your listings'
  const g = c.gained.length, l = c.lost.length
  const line = up ? `${plural(g, 'prompt')} started linking to ${target}` : `${plural(l, 'prompt')} stopped linking to ${target}`
  return {
    text: `Your ${up ? 'best week' : 'biggest drop'} ${since}: ${line}`,
    calc: `Each week’s ${what} against the week before: ${now.week.label} is ${fmtD(d, m.pct)}${j === -1 ? `, the ${up ? 'most' : 'largest drop'} in the last ${rows.length} weeks` : `; the last week ${up ? 'as good' : 'as bad'} was ${rows[j].week.label} (${fmtD(rows[j].delta[metric], m.pct)})`}.`,
    keys: j === -1 ? [0] : [0, j],
  }
}

// ---- Compare with: a competitor's listings in the same answers (weekly totals only)
export const MARKET_RIVALS = TRACKED_BRANDS.filter((b) => !b.you)
export function rivalRows(domain, engine, enabled, count, mock = null) {
  const { weeks } = marketWeeks(mock)
  const mine = marketplace.prompts.filter((p) => p.result === 'competitor' && p.brand === domain)
  return (count ? weeks.slice(0, count) : weeks).map((w, i) => {
    if (failedIn(i, engine, enabled).length) return { totals: Object.fromEntries(MARKET_METRICS.map((m) => [m.id, null])) }
    // the newest week is the card; older weeks drift down a little, with deterministic noise
    const scale = i === 0 ? 1 : 1 - i * 0.025 + ((hash(`${domain}|${i}`) % 7) - 3) / 100
    const inScope = mine.filter((p) => engine === 'all' || MARKET_ENGINES[hash(`r${p.id}`) % MARKET_ENGINES.length] === engine)
    const n = (list) => Math.max(0, Math.round(list.length * scale))
    const t = { linking: n(inScope) }
    t.share = round1((t.linking / TOTAL) * 100)
    for (const mk of MARKETS) t[mk.toLowerCase()] = n(inScope.filter((p) => p.markets.includes(mk)))
    return { totals: t }
  })
}

// a short history: "Collecting history: weekly from Sep 21. Trends get clearer after a few more weeks." (null when
// there are COLLECTING weeks or more). The subtitle counts what's there: "3 weekly scans so far" / "last 10 weeks".
export const COLLECTING = 6
const shortDate = (d) => d.replace(/, \d{4}$/, '')
export function collectingNote(rows) {
  if (!rows.length || rows.length >= COLLECTING) return null
  const from = shortDate(rows.at(-1).week.date)
  return rows.length === 1
    ? `Collecting history: weekly from ${from}. Changes show from the next scan.`
    : `Collecting history: weekly from ${from}. Trends get clearer after a few more weeks.`
}
export const historySpan = (rows) => (rows.length < COLLECTING ? `${plural(rows.length, 'weekly scan')} so far` : `last ${plural(rows.length, 'week')}`)

// the drawer waits on this each time it opens (production: the server; here a short pause so the skeleton shows)
export const loadMarketWeeks = () => new Promise((resolve) => setTimeout(resolve, 450))
