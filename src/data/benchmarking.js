// Benchmarking (mock only, 2026-11-18): how the brand compares with its competitors in AI answers. No React here, so
// every rule is tested (benchmarking.test.js). The numbers are the Overview's own: visibility and its change from the
// brand views (data/brandViews.js), share of voice by the Share of voice card's rule (utils/shareOfVoice.js), mentions
// and citations from the Citations and Mentions card's counts (data/mock.js citationsMentions), prompts and cited pages
// from the appearances table. Competitor sentiment isn't collected, so there is none here.
//
// Previews (mock only; don't port them as they are):
//   ?competitors=none  no competitors yet (the page invites adding them in Brand Setup)
//   ?history=single    only one sync so far (no change column, no history)
//   ?never=claude      an engine that has never run (a comma list works); ?noresult=<engine> is one that didn't run in
//                      the latest sync (brandViews.hasResult)
import { citationsMentions, trackedPrompts } from './mock.js'
import { ENGINE_ORDER, OWN, TRACKED_BRANDS, appearances, engineDetail, enginePid, getBrandView, hasResult } from './brandViews.js'
import { displayShares } from '../utils/shareOfVoice.js'
import { csvLine } from '../app/lib/csv-cell.js'

const params = () => { try { return new URLSearchParams(window.location.search) } catch { return new URLSearchParams() } }
// opts: the previews, from the URL unless given (tests pass them)
export function previews(opts = {}) {
  const q = params()
  return {
    none: opts.none ?? q.get('competitors') === 'none',
    oneSync: opts.oneSync ?? q.get('history') === 'single',
    never: opts.never ?? (q.get('never') ?? '').split(',').filter((e) => ENGINE_ORDER.includes(e)),
  }
}

// the engines the grid shows, in the brief's order (AI Mode only where the account has it)
export const BENCH_ENGINES = ['chatgpt', 'aio', 'aimode', 'claude', 'gemini'].filter((e) => ENGINE_ORDER.includes(e))

// 'ran' | 'missed' (didn't run in the latest sync) | 'never' (has never run). 'all' always ran: it is the engines that did.
export function engineStatus(engine, p = previews()) {
  if (!engine || engine === 'all') return 'ran'
  if (p.never.includes(engine)) return 'never'
  return hasResult(engine) ? 'ran' : 'missed'
}

// the brands compared: the brand and its competitors (none yet: the brand alone)
export const benchBrands = (p = previews()) => (p.none ? [OWN] : TRACKED_BRANDS)

// a brand's mentions and citations (AI answers that name it / cite a page of its site) on one engine or all of them.
// The Citations and Mentions card's counts where it has them; otherwise counted from the appearances table.
// null: that engine has no result (never 0).
function countOn(domain, engine) {
  const row = citationsMentions[domain]
  if (row) return row[engine] ?? [0, 0]
  const pid = enginePid(engine)
  let m = 0, c = 0
  trackedPrompts.forEach((pr) => { const a = appearances[pr.id][domain]; if (a.platforms.includes(pid)) m++; if (a.citedPlatforms.includes(pid)) c++ })
  return [m, c]
}
export function counts(domain, engine = 'all', p = previews()) {
  if (engineStatus(engine, p) !== 'ran') return { mentions: null, citations: null }
  const engines = engine === 'all' ? ENGINE_ORDER.filter((e) => engineStatus(e, p) === 'ran') : [engine]
  const sum = engines.map((e) => countOn(domain, e)).reduce((a, [m, c]) => [a[0] + m, a[1] + c], [0, 0])
  return { mentions: sum[0], citations: sum[1] }
}

// a brand's visibility (% of tracked prompts whose answers name it) on the engine: null when it has no result
export const visibilityOf = (domain, engine = 'all', p = previews()) => (engineStatus(engine, p) === 'ran' ? getBrandView(domain, engine).kpis.score : null)

// dense places by exact visibility, most first (an exact tie shares a place; no result: no place)
export function rankRows(rows) {
  const sorted = [...rows].filter((r) => r.visibility != null).sort((a, b) => b.visibility - a.visibility)
  let place = 0, prev = null
  const at = new Map()
  sorted.forEach((r) => { if (r.visibility !== prev) { place++; prev = r.visibility } at.set(r.domain, place) })
  return rows.map((r) => ({ ...r, rank: at.get(r.domain) ?? null }))
}

// The leaderboard: one row per brand, by place. share: the Share of voice card's rule, over every brand compared.
// change: visibility points since the last sync (null with one sync, or no result).
export function leaderboard(engine = 'all', p = previews()) {
  const brands = benchBrands(p)
  const ran = engineStatus(engine, p) === 'ran'
  const views = brands.map((b) => getBrandView(b.domain, engine))
  const shares = ran ? displayShares(views.map((v) => v.kpis.visible)) : brands.map(() => null)
  const rows = brands.map((b, i) => {
    const visibility = ran ? views[i].kpis.score : null
    return {
      domain: b.domain, key: b.key, name: b.name, you: Boolean(b.you),
      visibility,
      share: shares[i],
      ...counts(b.domain, engine, p),
      change: p.oneSync || visibility == null ? null : views[i].kpis.scoreDelta ?? null,
      prompts: ran ? views[i].kpis.visible : null,
    }
  })
  return rankRows(rows).sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || (b.you ? 1 : 0) - (a.you ? 1 : 0))
}

// sorting the leaderboard by a column: no value always last, whichever way
export const SORTS = ['rank', 'name', 'visibility', 'share', 'mentions', 'citations', 'change']
export function sortRows(rows, key = 'rank', dir = 'asc') {
  const k = SORTS.includes(key) ? key : 'rank'
  const sign = dir === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const x = a[k], y = b[k]
    if (x == null && y == null) return (a.rank ?? 99) - (b.rank ?? 99)
    if (x == null) return 1
    if (y == null) return -1
    const d = typeof x === 'string' ? x.localeCompare(y) : x - y
    return d * sign || (a.rank ?? 99) - (b.rank ?? 99)
  })
}

const points = (n) => `${n} point${n === 1 ? '' : 's'}`
// "Where you rank", one line: { text, you, other, gap } (other: the leader, or the brand just behind when you lead)
export function rankLine(rows, brandName = OWN.name) {
  const you = rows.find((r) => r.you)
  const ranked = rows.filter((r) => r.rank != null)
  if (!you || you.rank == null || ranked.length < 2) return null
  const of = rows.length
  if (you.rank === 1) {
    const tied = ranked.filter((r) => !r.you && r.rank === 1)
    if (tied.length) return { text: `${brandName} shares #1 of ${of} with ${tied.map((r) => r.name).join(' and ')}.`, you, other: tied[0], gap: 0, lead: true }
    const next = ranked.find((r) => !r.you)
    const gap = you.visibility - next.visibility
    return { text: `${brandName} is #1 of ${of}. It leads ${next.name} by ${points(gap)}.`, you, other: next, gap, lead: true }
  }
  const leader = ranked[0]
  const gap = leader.visibility - you.visibility
  return { text: `${brandName} is #${you.rank} of ${of}. ${leader.name} leads by ${points(gap)}.`, you, other: leader, gap, lead: false }
}

// By engine: per engine its status and each brand's visibility there; best: the brands with the highest value (none
// when every value is 0 or there is none)
export function engineGrid(p = previews()) {
  const brands = benchBrands(p)
  return BENCH_ENGINES.map((e) => {
    const status = engineStatus(e, p)
    const values = Object.fromEntries(brands.map((b) => [b.domain, status === 'ran' ? getBrandView(b.domain, e).kpis.score : null]))
    const top = Math.max(0, ...Object.values(values).filter((v) => v != null))
    const best = top > 0 ? brands.filter((b) => values[b.domain] === top).map((b) => b.domain) : []
    return { engine: e, status, values, best }
  })
}

// the prompts a competitor wins and the brand doesn't (on the engine, or on any engine), most engines first. id: the
// prompt's page in Content (/opportunities/content/<id>); engines: how many engines name the competitor there
export function promptsTheyWin(domain, engine = 'all', p = previews()) {
  if (engineStatus(engine, p) !== 'ran') return []
  const pid = engine === 'all' ? null : enginePid(engine)
  const on = (a) => (pid ? a.platforms.includes(pid) : a.visible)
  return trackedPrompts
    .filter((pr) => on(appearances[pr.id][domain]) && !on(appearances[pr.id][OWN.domain]))
    .map((pr) => ({ key: pr.id, id: Number(String(pr.id).replace(/^m/, '')), prompt: pr.prompt, engines: appearances[pr.id][domain].platforms.length }))
    .sort((a, b) => b.engines - a.engines || a.prompt.localeCompare(b.prompt))
}

// Where they beat you: per competitor (most prompts first), the prompts it wins that the brand misses
export function beats(engine = 'all', p = previews()) {
  return benchBrands(p).filter((b) => !b.you)
    .map((b) => ({ domain: b.domain, key: b.key, name: b.name, prompts: promptsTheyWin(b.domain, engine, p) }))
    .sort((a, b) => b.prompts.length - a.prompts.length)
}

// Who gets cited: per brand its citations and mentions, whether it's cited more often than named, and its most cited pages
export function citedBrands(engine = 'all', p = previews()) {
  const ran = engineStatus(engine, p) === 'ran'
  return benchBrands(p).map((b) => {
    const c = counts(b.domain, engine, p)
    const pages = ran ? engineDetail(b.domain, engine).pages.map((pg) => ({ path: pg.path, count: pg.prompts.length })) : []
    return { domain: b.domain, key: b.key, name: b.name, you: Boolean(b.you), ...c, citedMore: c.citations != null && c.citations > c.mentions, pages }
  }).sort((a, b) => (b.citations ?? -1) - (a.citations ?? -1))
}

// You vs them, for the drawer: each measure for both, and the prompts they win
export function versus(domain, engine = 'all', p = previews()) {
  const rows = leaderboard(engine, p)
  return { you: rows.find((r) => r.you), them: rows.find((r) => r.domain === domain) ?? null, prompts: promptsTheyWin(domain, engine, p) }
}

// Download: the leaderboard, then visibility by engine, as one CSV ("—" values are empty cells)
export function benchCsv(engine = 'all', p = previews(), engineLabel = (e) => e) {
  const v = (x) => (x == null ? '' : x)
  const rows = leaderboard(engine, p)
  const grid = engineGrid(p)
  const lines = [
    csvLine(['Rank', 'Brand', 'Domain', 'Visibility %', 'Share of voice %', 'Mentions', 'Citations', ...(p.oneSync ? [] : ['Change since last sync (points)'])]),
    ...rows.map((r) => csvLine([v(r.rank), r.name, r.domain, v(r.visibility), v(r.share), v(r.mentions), v(r.citations), ...(p.oneSync ? [] : [v(r.change)])])),
    '',
    csvLine(['Brand', ...grid.map((g) => `${engineLabel(g.engine)} visibility %`)]),
    ...rows.map((r) => csvLine([r.name, ...grid.map((g) => v(g.values[r.domain]))])),
  ]
  return `${lines.join('\n')}\n`
}
