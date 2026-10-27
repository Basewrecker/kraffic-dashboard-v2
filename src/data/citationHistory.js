// Citations and Mentions → History: mentions, citations and cited pages per week, per engine, for every tracked brand.
// Mock only. One row per weekly scan (the syncs in Sync history, newest first). Weeks run Monday to Sunday and are
// labelled by the week the scan ran in ("Sep 28 – Oct 4").
//   · the newest week is exactly the Now view (citationsMentions; cited pages from the Engine drawer's pages)
//   · older weeks follow the brand's own sync history (visible prompts → mentions, cited prompts → citations)
//   · Mentions' gained / lost are the sync's own lists, so "View all" in the Sync drawer shows the same prompts
//   · one scan failed: Gemini in the week of Sep 7 (FAILED below). That week shows "—" wherever Gemini counts
// PORT NOTE: production should return these per week from the scans table; a failed engine scan is null, never 0.
// Previews: ?cmMock=loading (History stays on its skeleton) · ?cmMock=empty (one week of data: the empty state)
import { ENGINE_ORDER, appearances, engineDetail, getBrandView } from './brandViews.js'
import { citationsMentions, citedPages, citedPagesOther, trackedPrompts, uncitedPages } from './mock.js'

export const METRICS = [
  { id: 'mentions', label: 'Mentions', one: 'mention' },
  { id: 'citations', label: 'Citations', one: 'citation' },
  { id: 'pages', label: 'Cited pages', one: 'cited page' },
]
export const FAILED = { gemini: [4] } // engine → week indexes (0 = newest) whose scan didn't complete

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY = 864e5
// "Sep 28, 2026" → { label: "Sep 28 – Oct 4" } (Monday to Sunday)
function weekOf(date) {
  const d = new Date(`${date} 12:00`)
  const start = new Date(d.getTime() - ((d.getDay() + 6) % 7) * DAY)
  const end = new Date(start.getTime() + 6 * DAY)
  const md = (x) => `${MONTHS[x.getMonth()]} ${x.getDate()}`
  return { label: start.getMonth() === end.getMonth() ? `${md(start)} – ${end.getDate()}` : `${md(start)} – ${md(end)}` }
}

// deterministic noise per brand / week / engine
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
const jitter = (key, spread) => (hash(key) % (spread * 2 + 1)) - spread
const rotate = (list, n, seed) => (list.length ? Array.from({ length: Math.min(n, list.length) }, (_, k) => list[(seed + k) % list.length]) : [])

const cache = new Map()

// weeks for one brand: [{ id, syncId, label, engines: { aio: { mentions, citations, pages } | null (scan failed), … }, allPages }]
export function citationWeeks(domain) {
  if (cache.has(domain)) return cache.get(domain)
  const syncs = getBrandView(domain).syncHistory
  const now = citationsMentions[domain] ?? {}
  const base = syncs[0]
  const weeks = syncs.map((s, i) => {
    const engines = {}
    for (const e of ENGINE_ORDER) {
      if ((FAILED[e] ?? []).includes(i)) { engines[e] = null; continue }
      const [m0 = 0, c0 = 0] = now[e] ?? []
      const p0 = engineDetail(domain, e).pages.length
      const k = `${domain}|${e}|${i}`
      // the newest week is the Now view, exactly; older weeks scale with that sync and wander a little
      const scale = (v0, ratio, spread) => (i === 0 || v0 === 0 ? v0 : Math.max(0, Math.round(v0 * ratio) + jitter(k + v0, spread)))
      const citedRatio = base.cited ? s.cited / base.cited : 1
      engines[e] = { mentions: scale(m0, s.visible / base.visible, 1), citations: scale(c0, citedRatio, 1), pages: scale(p0, citedRatio, 0) }
    }
    return { id: s.id, syncId: s.id, ...weekOf(s.date), engines }
  })
  // cited pages across engines: a page cited by two engines counts once, so "all" isn't the sum of the engines
  const allPages0 = engineDetail(domain, 'all').pages.length
  const pageSum = (w) => ENGINE_ORDER.reduce((n, e) => n + (w.engines[e]?.pages ?? 0), 0)
  const sum0 = Math.max(1, pageSum(weeks[0]))
  weeks.forEach((w, i) => { w.allPages = i === 0 ? allPages0 : Math.max(1, Math.round(pageSum(w) * (allPages0 / sum0))) })
  const out = { weeks, syncs }
  cache.set(domain, out)
  return out
}

// one week's numbers in an engine scope ('all' or one engine id): { mentions, citations, pages, failed: [engine ids] }
// a failed engine in scope makes every number unknown (null): a partial total would read as a drop
export function weekTotals(week, engine, enabled) {
  const ids = engine === 'all' ? enabled : [engine]
  const failed = ids.filter((e) => week.engines[e] === null)
  if (failed.length) return { mentions: null, citations: null, pages: null, failed }
  const sum = (k) => ids.reduce((n, e) => n + (week.engines[e]?.[k] ?? 0), 0)
  return { mentions: sum('mentions'), citations: sum('citations'), pages: engine === 'all' ? week.allPages : sum('pages'), failed }
}

// per-engine split for the tooltip: [{ id, value }] (null = that engine's scan didn't complete); engines at 0 left out
export function weekSplit(week, metric, ids) {
  return ids
    .map((e) => ({ id: e, value: week.engines[e] === null ? null : week.engines[e]?.[metric] ?? 0 }))
    .filter((x) => x.value !== 0)
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
}

// ---- what changed in a week for the selected metric: { gained: [{ key, label }], lost } or null (nothing to compare)
// mentions: the sync's own prompt lists (engine-scoped by the brand view) · citations: prompts newly cited / no
// longer cited · cited pages: page paths. Citations and pages keep gained − lost = the week's change.
const poolCache = new Map()
function pools(domain) {
  if (poolCache.has(domain)) return poolCache.get(domain)
  const a = (p) => appearances[p.id][domain]
  const nowPages = engineDetail(domain, 'all').pages.map((p) => p.path)
  const otherPages = [...citedPages.filter((p) => p.path), ...citedPagesOther, ...uncitedPages].map((p) => p.path).filter((p) => !nowPages.includes(p))
  const out = {
    cited: trackedPrompts.filter((p) => a(p)?.cited).map((p) => ({ key: p.id, label: p.prompt })),
    notCited: trackedPrompts.filter((p) => a(p)?.visible && !a(p)?.cited).map((p) => ({ key: p.id, label: p.prompt })),
    pages: nowPages.map((p) => ({ key: p, label: p })),
    otherPages: otherPages.map((p) => ({ key: p, label: p })),
  }
  poolCache.set(domain, out)
  return out
}

export function weekChanges({ domain, metric, index, totals, prevTotals, sync }) {
  if (!prevTotals || totals[metric] == null || prevTotals[metric] == null) return null
  if (metric === 'mentions') {
    if (!sync?.changes) return null
    const map = (list) => list.map((p) => ({ key: String(p.id), label: p.prompt }))
    return { gained: map(sync.changes.gained), lost: map(sync.changes.lost) }
  }
  const d = totals[metric] - prevTotals[metric]
  const lostN = hash(`${domain}|${metric}|${index}`) % 3 // 0–2 lost, even in a good week
  const gainedN = Math.max(0, lostN + d)
  const p = pools(domain)
  const [inPool, outPool] = metric === 'pages' ? [p.pages, p.otherPages] : [p.cited, p.notCited]
  return { gained: rotate(inPool, gainedN, index * 3), lost: rotate(outPool, gainedN - d, index * 2) }
}

// mock states (?cmMock=loading | empty)
export const historyMock = () => {
  try { return new URLSearchParams(window.location.search).get('cmMock') } catch { return null }
}
