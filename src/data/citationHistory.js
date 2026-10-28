// Mentions and citations, week by week (the drawer opened from the Citations and Mentions card).
// Mock only; the logic and wording match the app's lib/citation-history.ts (app PRs #55, #56). One week per weekly
// scan (the syncs in Sync history, newest first); weeks run Monday to Sunday and are labelled by the week the scan ran
// in ("Sep 28 – Oct 4").
//   · the newest week is exactly the card (citationsMentions; cited pages from the Engine drawer's pages)
//   · older weeks follow the brand's own sync history (visible prompts → mentions, cited prompts → citations)
//   · Mentions' lost / gained are the sync's own lists (syncChanges), the same rows the Sync drawer shows
//   · one scan failed: Gemini in the week of Sep 7 (FAILED): Gemini didn't run that week
//   · a week's totals are the engines that ran: an engine that didn't is left out and named ("Claude and Gemini
//     didn't run"), never a blank week; only a week where no shown engine ran is blank. A change is shown only between
//     weeks counted the same way (the same engines, both exact or both approximate), so a missing engine never reads
//     as a drop ("counted differently")
//   · weeks from the daily counts (approx: the app's score-history metrics, counted by the rule of that time):
//     mentions and cited pages approximate, citations unknown, no prompts behind them (not drillable)
//   · the current calendar week before its scan: a row with no numbers ("Scan due Oct 12": the last scan day + 7)
//   · a run of weeks with no data on any engine is one row ("No data for 3 weeks")
// PORT NOTE: production returns these per week from the scans table; a failed engine scan is null, never 0.
// Previews (?cmMock=): loading (skeleton) · empty (one week: the empty state) · due (this week's scan is due) ·
//   notrun (Claude didn't run this week) · nodata (3 weeks with no data) · approx (3 older weeks from the daily counts)
//   · fail (the weeks don't load: the error with Retry; Retry loads them)
import { ENGINE_ORDER, OWN, appearances, engineDetail, engineName, getBrandView } from './brandViews.js'
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
const at = (date) => new Date(`${date} 12:00`)
const mondayOf = (d) => new Date(d.getTime() - ((d.getDay() + 6) % 7) * DAY)
const md = (x) => `${MONTHS[x.getMonth()]} ${x.getDate()}`
const longOf = (x) => `${md(x)}, ${x.getFullYear()}`
// "Sep 28, 2026" → "Sep 28 – Oct 4" (Monday to Sunday)
export function weekLabel(date) {
  const start = mondayOf(at(date))
  const end = new Date(start.getTime() + 6 * DAY)
  return start.getMonth() === end.getMonth() ? `${md(start)} – ${end.getDate()}` : `${md(start)} – ${md(end)}`
}
// the month a week starts in ("October"): the drawer groups weeks by it
const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export function weekMonth(date) {
  return LONG[mondayOf(at(date)).getMonth()]
}
const weekStart = (date) => md(mondayOf(at(date)))
const weekEnd = (date) => md(new Date(mondayOf(at(date)).getTime() + 6 * DAY))

// deterministic noise per brand / week / engine
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
const jitter = (key, spread) => (hash(key) % (spread * 2 + 1)) - spread
const rotate = (list, n, seed) => (list.length ? Array.from({ length: Math.min(n, list.length) }, (_, k) => list[(seed + k) % list.length]) : [])
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const nameOf = (e) => engineName(e)
const listOf = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`)

// mock states (?cmMock=…); tests set one with setHistoryMock
let mockOverride
export const historyMock = () => {
  if (mockOverride !== undefined) return mockOverride
  try { return new URLSearchParams(window.location.search).get('cmMock') } catch { return null }
}
export const setHistoryMock = (m) => { mockOverride = m; cache.clear() }
// today (tests set it): the current calendar week shows before its scan ("Scan due …"), never as 0. The mock's
// default today is the last scan's week (so nothing is due); ?cmMock=due is 8 days after the last scan
let nowIso = null
export const setToday = (iso) => { nowIso = iso; cache.clear() }

const cache = new Map()
const NO_DATA = [5, 6, 7] // ?cmMock=nodata: weeks with no data on any engine (one row)
const APPROX = [7, 8, 9] // ?cmMock=approx: weeks from the daily counts

// weeks for one brand, newest first: { weeks: [{ id, syncId, sync, date, label, month, engines: { aio: { mentions,
// citations, pages, approx? } | null | undefined }, detail: { aio: true | null }, allPages, current?, pending?, lastScan?,
// empty?, weeksSpanned? }], syncs }
export function citationWeeks(domain) {
  const mock = historyMock()
  const k = `${domain}|${mock}|${nowIso}`
  if (cache.has(k)) return cache.get(k)
  const syncs = getBrandView(domain).syncHistory
  const now = citationsMentions[domain] ?? {}
  const base = syncs[0]
  const own = domain === OWN.domain
  const built = syncs.map((s, i) => {
    const engines = {}
    const detail = {}
    for (const e of ENGINE_ORDER) {
      // didn't run / no data / failed: null (left out, named); never 0
      if ((FAILED[e] ?? []).includes(i) || (mock === 'notrun' && i === 0 && e === 'claude') || (mock === 'nodata' && NO_DATA.includes(i))) {
        engines[e] = null; detail[e] = null; continue
      }
      const [m0 = 0, c0 = 0] = now[e] ?? []
      const p0 = engineDetail(domain, e).pages.length
      const key = `${domain}|${e}|${i}`
      // the newest week is the card, exactly; older weeks scale with that sync and wander a little
      const scale = (v0, ratio, spread) => (i === 0 || v0 === 0 ? v0 : Math.max(0, Math.round(v0 * ratio) + jitter(key + v0, spread)))
      const citedRatio = base.cited ? s.cited / base.cited : 1
      if (mock === 'approx' && own && APPROX.includes(i)) {
        // the daily counts: mentions and cited pages by the rule of that time, citations not known, no prompts behind them
        engines[e] = { mentions: scale(m0, s.visible / base.visible, 3), citations: null, pages: scale(p0, citedRatio, 1), approx: true }
        detail[e] = null
        continue
      }
      engines[e] = { mentions: scale(m0, s.visible / base.visible, 1), citations: scale(c0, citedRatio, 1), pages: scale(p0, citedRatio, 0) }
      detail[e] = true
    }
    return { sync: s, date: s.date, label: weekLabel(s.date), month: weekMonth(s.date), engines, detail, current: i === 0, empty: i > 0 && ENGINE_ORDER.every((e) => !engines[e]) }
  })
  // cited pages across engines: a page cited by two engines counts once, so "all" isn't the sum of the engines
  const allPages0 = engineDetail(domain, 'all').pages.length
  const pageSum = (w) => ENGINE_ORDER.reduce((n, e) => n + (w.engines[e]?.pages ?? 0), 0)
  const sum0 = Math.max(1, pageSum(built[0]))
  built.forEach((w, i) => { w.allPages = i === 0 ? allPages0 : Math.max(1, Math.round(pageSum(w) * (allPages0 / sum0))) })

  // this calendar week before its scan: a row with no numbers ("Scan due …"); the latest scanned week is then not current
  const today = nowIso ? new Date(`${nowIso}T12:00`) : mock === 'due' ? new Date(at(base.date).getTime() + 8 * DAY) : null
  const pendingMonday = today && mondayOf(today) > mondayOf(at(base.date)) ? mondayOf(today) : null
  const weeks = []
  if (pendingMonday) {
    const date = longOf(pendingMonday)
    weeks.push({ sync: null, date, label: weekLabel(date), month: weekMonth(date), engines: {}, detail: {}, allPages: 0, current: true, pending: true, lastScan: base.date, empty: false })
    built[0].current = false
  }
  // a run of weeks with no data on any engine: one row ("Aug 10 – Sep 6"), the oldest week's start to the newest
  // week's end, grouped under the month it ends in (the newest week's)
  for (const wk of built) {
    const last = weeks.at(-1)
    if (wk.empty && last?.empty) {
      last.label = `${weekStart(wk.date)} – ${weekEnd(last.endDate)}`
      last.weeksSpanned += 1
      continue
    }
    weeks.push(wk.empty ? { ...wk, weeksSpanned: 1, endDate: wk.date } : wk)
  }
  weeks.forEach((w, i) => { w.id = i; w.syncId = i })
  const out = { weeks, syncs: weeks }
  cache.set(k, out)
  return out
}

// engines a brand shows up on at all (the drawer's engine filter lists these)
export const brandEngines = (domain) => ENGINE_ORDER.filter((e) => (citationsMentions[domain]?.[e] ?? []).some((v) => v > 0))
// the account's engines with no complete scan this week (the card leaves them out and names them)
export function enginesNotRun(enabled) {
  const w = citationWeeks(OWN.domain).weeks.find((x) => !x.pending)
  return w ? enabled.filter((e) => w.engines[e] === null) : []
}

// one week's numbers in an engine scope ('all' or one engine id), over the engines that ran:
//   { mentions, citations, pages, failed: [engines shown that didn't run or complete], ran: [engines counted], approx }
// numbers are null only when no engine in scope ran (or, for citations, when the counts that week don't have them)
export function weekTotals(week, engine, enabled, only) {
  const ids = (engine === 'all' ? enabled : [engine]).filter((e) => !only || only.includes(e))
  const ran = ids.filter((e) => !!week.engines[e])
  // an engine that's shown but has no complete scan that week (failed, didn't finish, or didn't run at all)
  const failed = week.pending ? [] : ids.filter((e) => !week.engines[e] && (week.engines[e] === null || !week.current))
  if (!ran.length) return { mentions: null, citations: null, pages: null, failed, ran, approx: false }
  const approx = ran.some((e) => week.engines[e].approx)
  const sum = (k) => {
    let n = 0
    for (const e of ran) {
      const v = week.engines[e][k]
      if (v == null) return null
      n += v
    }
    return n
  }
  // pages: distinct pages across every engine (allPages) when all of them ran, exactly; else the per-engine sum
  const pages = engine === 'all' && !only && !failed.length && !approx && week.allPages ? week.allPages : sum('pages')
  return { mentions: sum('mentions'), citations: sum('citations'), pages, failed, ran, approx }
}

// every week of a brand in a scope, newest first: [{ week, totals, prev, prevWeek, skipped, compared, differently,
// scanDue, delta: { mentions, … } }]. A week compares with the last week before it that has numbers, on the engines
// that ran in both (so a missing engine never reads as a drop); after an empty week that's further back (skipped)
export function weekRows(domain, engine, enabled, count) {
  const { weeks } = citationWeeks(domain)
  const list = count ? weeks.slice(0, count) : weeks
  return list.map((w, i) => {
    const totals = weekTotals(w, engine, enabled)
    let prev = null, prevWeek = null
    for (let j = i + 1; j < weeks.length; j++) {
      const t = weekTotals(weeks[j], engine, enabled)
      if (t.ran.length) { prev = t; prevWeek = weeks[j]; break }
    }
    const skipped = prevWeek != null && prevWeek !== weeks[i + 1]
    // a change only between weeks counted the same way: the same engines, and both exact or both from the daily
    // counts. Otherwise the number shows without a change ("counted differently")
    const sameEngines = !!prev && totals.ran.length === prev.ran.length && totals.ran.every((e) => prev.ran.includes(e))
    const comparable = !!prev && totals.ran.length > 0 && sameEngines && !!totals.approx === !!prev.approx
    const differently = !!prev && totals.ran.length > 0 && !comparable
    const d = (k) => (comparable && totals[k] != null && prev[k] != null ? totals[k] - prev[k] : null)
    // the current week before its scan: no number, no change; its scan is due a week after the last scanned week
    const lastScan = w.lastScan ?? prevWeek?.date ?? null
    const scanDue = w.current && !totals.ran.length ? (lastScan ? md(new Date(at(lastScan).getTime() + 7 * DAY)) : null) : undefined
    return { week: w, index: i, totals, prev, prevWeek, skipped, compared: comparable ? totals.ran : [], differently, scanDue, delta: { mentions: d('mentions'), citations: d('citations'), pages: d('pages') } }
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
  const { totals, prev, prevWeek, week, index } = row
  // drillable only when both weeks were counted the same way (row.compared: the engines both ran) and both have the
  // per-prompt answers for every one of those engines; the current week before its scan never is
  if (!prev || !prevWeek || row.scanDue !== undefined || totals[metric] == null || prev[metric] == null) return null
  if (Array.isArray(row.compared) && !row.compared.length) return null
  if (row.compared?.some((e) => !week.detail?.[e] || !prevWeek.detail?.[e])) return null
  const scoped = (list) => (engine === 'all' ? list : list.filter((x) => x.engine === engine))
  if (metric === 'mentions') {
    const c = syncChanges(week.sync ?? sync, domain)
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

// line 2 of a week row: that week in plain words, for one metric. Notes after the change: the engines that didn't run
// (left out of the totals), and numbers taken from the daily counts (approximate, citations not known)
export function weekSummary({ metric, row, changes, you = true, name }) {
  const notes = []
  if (row.totals.ran?.length && row.totals.failed.length) notes.push(`${listOf(row.totals.failed.map(nameOf))} didn’t run`)
  if (row.totals.approx) notes.push(metric === 'citations' ? 'citations not known for this week' : 'from the daily counts, counted the old way')
  const withNotes = (text) => [text, ...notes].filter(Boolean).join(' · ')
  if (row.week.empty) return row.week.weeksSpanned > 1 ? `No data for ${row.week.weeksSpanned} weeks` : 'No data'
  if (row.scanDue !== undefined) return row.scanDue ? `Scan due ${row.scanDue}` : 'Scan due'
  if (!row.totals.ran?.length) return 'Scan didn’t complete this week'
  if (row.differently) notes.push('counted differently')
  if (row.week.current && (!row.prev || !changes)) return withNotes('This week so far')
  if (!row.prev) return withNotes('Earliest week in this history')
  if (!changes) return withNotes('Details not available for this week')
  if (row.week.current) return withNotes(`This week so far · ${weekSummary({ metric, row: { ...row, week: { ...row.week, current: false }, totals: { ...row.totals, failed: [], approx: false } }, changes, you, name })}`)
  if (row.skipped) {
    const d = row.delta[metric]
    const rest = weekSummary({ metric, row: { ...row, skipped: false, totals: { ...row.totals, failed: [], approx: false } }, changes, you, name })
    return withNotes(d == null ? rest : `${d === 0 ? 'No change' : d > 0 ? `+${d}` : `−${Math.abs(d)}`} vs ${row.prevWeek.label} · ${rest}`)
  }
  const g = changes.gained.length, l = changes.lost.length
  if (!g && !l) return withNotes(`No change in ${metric === 'pages' ? 'cited pages' : metric === 'citations' ? 'citations' : 'mentions'}`)
  if (metric === 'mentions') {
    const parts = [g && `+${plural(g, 'prompt')} now ${g === 1 ? 'mentions' : 'mention'} ${you ? 'you' : name}`, l && `${l} dropped`]
    return withNotes(parts.filter(Boolean).join(' · '))
  }
  if (metric === 'citations') {
    const first = changes.gained[0]?.page
    return withNotes([g && `Newly cited: ${first}${g > 1 ? ` and ${g - 1} more` : ''}`, l && `${l} lost`].filter(Boolean).join(' · '))
  }
  return withNotes([g && `${plural(g, 'new page')} · ${changes.gained[0].prompt} first cited`, l && `${l} no longer cited`].filter(Boolean).join(' · '))
}

// the drawer's insight line (under the chart): the newest week against the period, for one metric.
// changes: weekChanges per row (same order as rows). Returns { text, calc, keys: [row indexes it's about] } or null.
//   up:   "Your best week since August: 14 prompts started mentioning you" (since = the last week that did as well)
//   down: "Your biggest drop since Aug 24: 7 prompts stopped mentioning you"
export function weekInsight({ metric, rows: all, changes: allChanges, you = true, name }) {
  // the current week before its scan isn't a week yet: the insight reads from the latest week with numbers
  const skip = all[0]?.scanDue !== undefined ? 1 : 0
  const rows = all.slice(skip)
  const changes = (allChanges || []).slice(skip)
  const now = rows[0]
  if (!now || rows.length < 2) return null
  const label = METRICS.find((m) => m.id === metric).label.toLowerCase()
  const whose = you ? 'Your' : `${name}’s`
  if (!now.totals.ran?.length) {
    const last = rows.find((r) => r.totals.ran?.length)
    return { text: `No engine finished this week${last ? `: the last week with numbers was ${last.week.label}` : ''}`, calc: `${now.week.label} has no ${label}: no engine’s scan finished, so it isn’t counted as 0.`, keys: [0] }
  }
  if (now.totals[metric] == null) return { text: `${METRICS.find((m) => m.id === metric).label} aren’t known for this week`, calc: `This week’s numbers come from the daily counts, which don’t include ${label}.`, keys: [0] }
  const missing = now.totals.failed.length ? ` (${listOf(now.totals.failed.map(nameOf))} didn’t run)` : ''
  const d = now.delta[metric]
  const c = changes[0]
  if (d == null || !c) return { text: `${now.totals[metric]} ${label} ${now.week.current ? 'this week so far' : 'this week'}${missing}; the week before has nothing to compare`, calc: `No earlier week has numbers on the same engines, so this week has no change to show.`, keys: [0] }
  const who = you ? 'you' : name
  const g = c.gained.length, l = c.lost.length
  const gainLine = { mentions: `${plural(g, 'prompt')} started mentioning ${who}`, citations: `${plural(g, 'prompt')} started citing ${who}`, pages: `${plural(g, 'page')} cited for the first time` }[metric]
  const lossLine = { mentions: `${plural(l, 'prompt')} stopped mentioning ${who}`, citations: `${plural(l, 'prompt')} stopped citing ${who}`, pages: `${plural(l, 'page')} no longer cited` }[metric]
  const span = `${rows.length} weeks`
  if (d === 0) return { text: `No change in ${label} this week${g ? `: ${g} gained, ${l} dropped` : ''}${missing}`, calc: `${now.week.label} has as many ${label} as ${now.prevWeek.label}.`, keys: [0, rows.findIndex((r) => r.week === now.prevWeek)].filter((k) => k >= 0) }
  const up = d > 0
  const j = rows.findIndex((r, i) => i > 0 && r.delta[metric] != null && (up ? r.delta[metric] >= d : r.delta[metric] <= d))
  const since = j === -1 ? `in ${span}` : `since ${rows[j].week.month === now.week.month ? rows[j].week.label.split(' – ')[0] : rows[j].week.month}`
  const what = up ? (g ? gainLine : `${label} up ${d} to ${now.totals[metric]}`) : (l ? lossLine : `${label} down ${Math.abs(d)} to ${now.totals[metric]}`)
  const fmt = (n) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`)
  return {
    text: `${whose} ${up ? 'best week' : 'biggest drop'} ${since}: ${what}${missing}`,
    calc: `Each week’s ${label} against the week before: ${now.week.label} is ${fmt(d)}${j === -1 ? `, the ${up ? 'most' : 'largest drop'} in the last ${span}` : `; the last week ${up ? 'as good' : 'as bad'} was ${rows[j].week.label} (${fmt(rows[j].delta[metric])})`}.`,
    keys: j === -1 ? [0] : [0, j],
  }
}

// the drawer waits on this each time it opens (production: reads the weeks from the server; here, a short pause so the
// skeleton shows). Never spins forever: after the timeout (15s) it rejects and the drawer shows its error with Retry
// (the read carries on; a Retry reuses it or starts again). ?cmMock=fail: the first read fails, Retry loads.
const LOAD_MS = 450
let loadTimeoutMs = 15000
let loadMs = LOAD_MS
let reading = null
let failNext = true
// tests: a shorter wait, a slower read
export const setLoadTimeout = (ms) => { loadTimeoutMs = ms }
export const setLoadDelay = (ms) => { loadMs = ms ?? LOAD_MS }
const withTimeout = (p) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`the weeks took longer than ${Math.round(loadTimeoutMs / 1000)}s`)), loadTimeoutMs)
  p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
})
export function loadWeeks() {
  if (reading) return withTimeout(reading)
  const fail = historyMock() === 'fail' && failNext
  if (fail) failNext = false
  const ms = loadMs
  reading = new Promise((resolve, reject) => setTimeout(() => (fail ? reject(new Error('the weeks couldn’t load')) : resolve()), ms))
    .finally(() => { reading = null })
  return withTimeout(reading)
}
// forget what was read (tests)
export function resetWeeks() {
  reading = null
  failNext = true
  cache.clear()
}
