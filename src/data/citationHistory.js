// Mentions and citations, week by week (the drawer opened from the Citations and Mentions card).
// Mock only. One week per weekly scan (the syncs in Sync history, newest first); weeks run Monday to Sunday and
// are labelled by the week the scan ran in ("Sep 28 – Oct 4").
//   · the newest week is exactly the card (citationsMentions; cited pages from the Engine drawer's pages)
//   · older weeks follow the brand's own sync history (visible prompts → mentions, cited prompts → citations)
//   · Mentions' lost / gained are the sync's own lists (syncChanges), the same rows the Sync drawer shows
//   · one scan failed: Gemini in the week of Sep 7 (FAILED). Any number that counts Gemini that week is unknown
// PORT NOTE: production should return these per week from the scans table; a failed engine scan is null, never 0.
// Previews: ?cmMock=loading (the drawer stays on its skeleton) · ?cmMock=empty (one week of data: the empty state)
import { ENGINE_ORDER, appearances, engineDetail, engineName, getBrandView } from './brandViews.js'
import { syncChanges } from './syncChanges.js'
import { citationsMentions, citedPages, citedPagesOther, trackedPrompts, uncitedPages } from './mock.js'

export const METRICS = [
  { id: 'mentions', label: 'Mentions', one: 'mention' },
  { id: 'citations', label: 'Citations', one: 'citation' },
  { id: 'pages', label: 'Cited pages', one: 'cited page' },
]
export const FAILED = { gemini: [4] } // engine → week indexes (0 = newest) whose scan didn't complete

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY = 864e5
// "Sep 28, 2026" → "Sep 28 – Oct 4" (Monday to Sunday)
function weekLabel(date) {
  const d = new Date(`${date} 12:00`)
  const start = new Date(d.getTime() - ((d.getDay() + 6) % 7) * DAY)
  const end = new Date(start.getTime() + 6 * DAY)
  const md = (x) => `${MONTHS[x.getMonth()]} ${x.getDate()}`
  return start.getMonth() === end.getMonth() ? `${md(start)} – ${end.getDate()}` : `${md(start)} – ${md(end)}`
}

// deterministic noise per brand / week / engine
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
const jitter = (key, spread) => (hash(key) % (spread * 2 + 1)) - spread
const rotate = (list, n, seed) => (list.length ? Array.from({ length: Math.min(n, list.length) }, (_, k) => list[(seed + k) % list.length]) : [])
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

const cache = new Map()

// weeks for one brand: { weeks: [{ id, syncId, date, label, engines: { aio: { mentions, citations, pages } | null }, allPages }], syncs }
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
      // the newest week is the card, exactly; older weeks scale with that sync and wander a little
      const scale = (v0, ratio, spread) => (i === 0 || v0 === 0 ? v0 : Math.max(0, Math.round(v0 * ratio) + jitter(k + v0, spread)))
      const citedRatio = base.cited ? s.cited / base.cited : 1
      engines[e] = { mentions: scale(m0, s.visible / base.visible, 1), citations: scale(c0, citedRatio, 1), pages: scale(p0, citedRatio, 0) }
    }
    return { id: s.id, syncId: s.id, date: s.date, label: weekLabel(s.date), engines }
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

// engines a brand shows up on at all (the drawer's engine filter lists these)
export const brandEngines = (domain) => ENGINE_ORDER.filter((e) => (citationsMentions[domain]?.[e] ?? []).some((v) => v > 0))

// one week's numbers in an engine scope ('all' or one engine id): { mentions, citations, pages, failed: [engine ids] }
// a failed engine in scope makes every number unknown (null): a partial total would read as a drop
export function weekTotals(week, engine, enabled) {
  const ids = engine === 'all' ? enabled : [engine]
  const failed = ids.filter((e) => week.engines[e] === null)
  if (failed.length) return { mentions: null, citations: null, pages: null, failed }
  const sum = (k) => ids.reduce((n, e) => n + (week.engines[e]?.[k] ?? 0), 0)
  return { mentions: sum('mentions'), citations: sum('citations'), pages: engine === 'all' ? week.allPages : sum('pages'), failed }
}

// every week of a brand in a scope, newest first: [{ week, totals, prev, delta: { mentions, … } }]
export function weekRows(domain, engine, enabled, count) {
  const { weeks } = citationWeeks(domain)
  const list = count ? weeks.slice(0, count) : weeks
  return list.map((w, i) => {
    const totals = weekTotals(w, engine, enabled)
    const prev = list[i + 1] ? weekTotals(list[i + 1], engine, enabled) : null
    const d = (k) => (prev && totals[k] != null && prev[k] != null ? totals[k] - prev[k] : null)
    return { week: w, index: i, totals, prev, delta: { mentions: d('mentions'), citations: d('citations'), pages: d('pages') } }
  })
}

// ---- what changed in a week for one metric: { lost: [{ key, prompt, meta, engine, page? }], gained } or null
// mentions: the sync's own prompt lists (as in the Sync drawer) · citations: prompts newly cited / no longer cited
// · cited pages: page paths (rows with nothing to open). Citations and pages keep gained − lost = the week's change.
const poolCache = new Map()
function pools(domain) {
  if (poolCache.has(domain)) return poolCache.get(domain)
  const a = (p) => appearances[p.id][domain]
  const nowPages = engineDetail(domain, 'all').pages
  const otherPages = [...citedPages.filter((p) => p.path), ...citedPagesOther, ...uncitedPages].map((p) => p.path).filter((p) => !nowPages.some((x) => x.path === p))
  const out = {
    cited: trackedPrompts.filter((p) => a(p)?.cited).map((p) => ({ key: p.id, prompt: p.prompt, page: a(p).citedPage })),
    notCited: trackedPrompts.filter((p) => a(p)?.visible && !a(p)?.cited).map((p) => ({ key: p.id, prompt: p.prompt })),
    pages: nowPages.map((p) => ({ path: p.path, prompts: p.prompts.length })),
    otherPages: otherPages.map((path) => ({ path, prompts: 1 + (hash(path) % 3) })),
  }
  poolCache.set(domain, out)
  return out
}

export function weekChanges({ domain, metric, row, engine, sync }) {
  const { totals, prev, index } = row
  if (!prev || totals[metric] == null || prev[metric] == null) return null
  const scoped = (list) => (engine === 'all' ? list : list.filter((x) => x.engine === engine))
  if (metric === 'mentions') {
    const c = syncChanges(sync, domain)
    return c && { lost: scoped(c.lost), gained: scoped(c.gained) }
  }
  const d = totals[metric] - prev[metric]
  const lostN = hash(`${domain}|${metric}|${index}`) % 3 // 0–2 lost, even in a good week
  const gainedN = Math.max(0, lostN + d)
  const p = pools(domain)
  const e = engine === 'all' ? 'aio' : engine
  const on = engineName(e)
  if (metric === 'citations') {
    return {
      gained: rotate(p.cited, gainedN, index * 3).map((x) => ({ ...x, engine: e, meta: `Now cited on ${on} · ${x.page}` })),
      lost: rotate(p.notCited, gainedN - d, index * 2).map((x, k) => ({ ...x, engine: e, meta: `No longer cited on ${on} · was ${p.pages[(index + k) % p.pages.length]?.path ?? '/'}` })),
    }
  }
  return {
    gained: rotate(p.pages, gainedN, index * 3).map((x) => ({ key: x.path, prompt: x.path, plain: true, meta: `First cited on ${on} · ${plural(x.prompts, 'prompt')}` })),
    lost: rotate(p.otherPages, gainedN - d, index * 2).map((x) => ({ key: x.path, prompt: x.path, plain: true, meta: `Not cited this week · was in ${plural(x.prompts, 'prompt')}` })),
  }
}

// line 2 of a week row: that week in plain words, for one metric
export function weekSummary({ metric, row, changes, you = true, name }) {
  if (row.totals.failed.length) return 'Scan didn’t complete this week'
  if (!row.prev) return 'First week in this history'
  if (!changes) return 'The week before didn’t complete: nothing to compare'
  const g = changes.gained.length, l = changes.lost.length
  if (!g && !l) return `No change in ${metric === 'pages' ? 'cited pages' : metric === 'citations' ? 'citations' : 'mentions'}`
  if (metric === 'mentions') {
    const parts = [g && `+${plural(g, 'prompt')} now ${g === 1 ? 'mentions' : 'mention'} ${you ? 'you' : name}`, l && `${l} dropped`]
    return parts.filter(Boolean).join(' · ')
  }
  if (metric === 'citations') {
    const first = changes.gained[0]?.page
    return [g && `Newly cited: ${first}${g > 1 ? ` and ${g - 1} more` : ''}`, l && `${l} lost`].filter(Boolean).join(' · ')
  }
  return [g && `${plural(g, 'new page')} · ${changes.gained[0].prompt} first cited`, l && `${l} no longer cited`].filter(Boolean).join(' · ')
}

// mock states (?cmMock=loading | empty)
export const historyMock = () => {
  try { return new URLSearchParams(window.location.search).get('cmMock') } catch { return null }
}
