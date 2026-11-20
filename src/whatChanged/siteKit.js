// Site Kit's "What changed": Google clicks (Search Console, the page's first number) from the daily rows the page
// loads (skSearchMetrics; AI visits from skAiReferrals when Analytics is connected). Site Kit has no scans: its data
// comes in daily, so Last scan compares the last 7 days with the 7 before; 30 / 90 days compare that many days with
// the same number of days before (the page's own "vs previous N days").
import { siteKit, skAiReferrals, skSearchMetrics } from '../data/mock.js'
import { B, DAY, delta, fmtDay, fmtWeekday, noiseCount, preview } from './util.js'

const LEN = { scan: 7, '30d': 30, '90d': 90 }
const iso = (t) => new Date(t).toISOString().slice(0, 10)
const nf = new Intl.NumberFormat('en-US')
const inside = (d, a, b) => d >= a && d <= b
const pathOf = (url) => { try { return new URL(url).pathname || '/' } catch { return url || '/' } }
const sum = (list, k) => list.reduce((n, r) => n + r[k], 0)
// delta() with thousands separators ("+3,746")
const dl = (d, opts) => { const x = delta(d, opts); return x && !x.flat ? { ...x, text: x.text.replace(/\d+/, (m) => nf.format(Number(m))) } : x }
const pct = (d, base) => (base ? Math.round((d / base) * 100) : null)
const windowOf = (len) => {
  const endT = Date.parse(`${siteKit.today}T00:00:00Z`)
  return { start: iso(endT - (len - 1) * DAY), end: siteKit.today, prevStart: iso(endT - (2 * len - 1) * DAY), prevEnd: iso(endT - len * DAY) }
}
const position = (list) => { const imp = sum(list, 'impressions'); return imp ? list.reduce((n, r) => n + r.position * r.impressions, 0) / imp : null }
// clicks per key (query / page) in the window and the one before, biggest mover first
function movers(cur, prev, key) {
  const m = new Map()
  for (const r of cur) { const x = m.get(r[key]) ?? { key: r[key], now: 0, then: 0 }; x.now += r.clicks; m.set(r[key], x) }
  for (const r of prev) { const x = m.get(r[key]) ?? { key: r[key], now: 0, then: 0 }; x.then += r.clicks; m.set(r[key], x) }
  return [...m.values()].map((x) => ({ ...x, d: x.now - x.then })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d) || b.now - a.now)
}

function build(state, period) {
  const conns = siteKit.states[state] ?? siteKit.states.none
  const gsc = conns.some((c) => c.provider === 'GOOGLE_SEARCH_CONSOLE' && c.status === 'CONNECTED')
  const ga = conns.some((c) => c.provider === 'GOOGLE_ANALYTICS_4' && c.status === 'CONNECTED')
  const lastSync = conns.find((c) => c.lastSyncAt)?.lastSyncAt ?? `${siteKit.today}T00:00:00Z`
  const len = LEN[period]
  const w = windowOf(len)
  const rows = !gsc || state === 'empty' ? [] : skSearchMetrics
  const cur = rows.filter((r) => inside(r.date, w.start, w.end)), prev = rows.filter((r) => inside(r.date, w.prevStart, w.prevEnd))
  const footer = [`data to ${fmtDay(siteKit.today)}`, `synced ${fmtWeekday(lastSync)}`]
  if (!cur.length || !prev.length || preview() === 'one') {
    return { state: 'one', footer, latestIso: siteKit.today, trigger: { delta: null }, oneText: cur.length ? `Search Console data starts within the last ${len * 2} days. Changes show once there's a full ${len} days before to compare with.` : 'No Search Console data yet. It can take 2–3 days to show up.' }
  }
  const since = fmtDay(w.prevStart)
  const span = period === 'scan' ? 'the last 7 days' : `the last ${len} days`
  const clicks = sum(cur, 'clicks'), clicksThen = sum(prev, 'clicks'), d = clicks - clicksThen
  const flat = noiseCount(d, clicksThen)
  const imp = sum(cur, 'impressions'), impThen = sum(prev, 'impressions')
  const pos = position(cur), posThen = position(prev)
  const posD = pos != null && posThen != null ? Math.round((pos - posThen) * 10) / 10 : null
  const ai = ga ? skAiReferrals.filter((r) => inside(r.date, w.start, w.end)) : [], aiPrev = ga ? skAiReferrals.filter((r) => inside(r.date, w.prevStart, w.prevEnd)) : []
  const aiD = sum(ai, 'sessions') - sum(aiPrev, 'sessions')
  const glance = [
    { label: 'Clicks', value: nf.format(clicks), delta: dl(d, { noise: flat }) },
    { label: 'Impressions', value: nf.format(imp), delta: dl(imp - impThen, { noise: noiseCount(imp - impThen, impThen) }) },
    { label: 'Position', value: pos == null ? '—' : pos.toFixed(1), delta: dl(posD, { higherIsBetter: false, noise: posD == null || Math.abs(posD) < 0.5 }) },
    ...(ga ? [{ label: 'AI visits', value: nf.format(sum(ai, 'sessions')), delta: dl(aiD, { noise: noiseCount(aiD, sum(aiPrev, 'sessions')) }) }] : []),
  ]

  // ---- by page: clicks, their change
  const pages = movers(cur, prev, 'pageUrl').sort((a, b) => b.now - a.now).slice(0, 5).map((p) => ({
    id: p.key, mark: { status: noiseCount(p.d, p.then) ? 'neutral' : p.d > 0 ? 'good' : 'bad' }, name: pathOf(p.key), value: p.now, valueText: nf.format(p.now), share: clicks ? p.now / clicks : 0,
    delta: dl(p.d, { noise: noiseCount(p.d, p.then) }),
  }))

  // ---- headline: clicks, and the search that moved most the same way
  const queries = movers(cur, prev, 'query').filter((q) => !noiseCount(q.d, q.then))
  const driver = flat ? null : queries.find((q) => Math.sign(q.d) === Math.sign(d))
  const headline = flat
    ? [B(`Google clicks held at ${nf.format(clicks)}`), ` in ${span}, within 5% of the ${len} days before.`]
    : [B(`Google clicks ${d > 0 ? 'rose' : 'fell'} by ${nf.format(Math.abs(d))} (${Math.abs(pct(d, clicksThen))}%) to ${nf.format(clicks)}`), ` in ${span}`,
      ...(driver ? [', mostly ', B(`“${driver.key}”`), ` with ${nf.format(Math.abs(driver.d))} ${d > 0 ? 'more' : 'fewer'}.`] : ['.'])]

  // ---- what moved: searches by click change (not the headline's), then AI assistants' visits
  const moved = queries.filter((q) => q !== driver).slice(0, 4).map((q) => ({
    id: `q-${q.key}`, mark: { status: q.d > 0 ? 'good' : 'bad' }, target: '[data-wc="sk-queries"]', impact: Math.abs(q.d),
    text: [B(`“${q.key}”`), ` got ${nf.format(q.now)} clicks, from ${nf.format(q.then)}`], delta: dl(q.d),
  }))
  if (ga) {
    const eng = new Map()
    for (const r of ai) { const x = eng.get(r.sourceDomain) ?? { name: r.aiEngine, domain: r.sourceDomain, now: 0, then: 0 }; x.now += r.sessions; eng.set(r.sourceDomain, x) }
    for (const r of aiPrev) { const x = eng.get(r.sourceDomain) ?? { name: r.aiEngine, domain: r.sourceDomain, now: 0, then: 0 }; x.then += r.sessions; eng.set(r.sourceDomain, x) }
    ;[...eng.values()].filter((e) => !noiseCount(e.now - e.then, e.then)).forEach((e) => moved.push({
      id: `ai-${e.domain}`, mark: { domain: e.domain }, impact: Math.abs(e.now - e.then),
      text: [B(e.name), ` sent ${nf.format(e.now)} ${e.now === 1 ? 'visit' : 'visits'}, from ${nf.format(e.then)}`], delta: dl(e.now - e.then),
    }))
  }
  moved.sort((a, b) => b.impact - a.impact)

  // ---- hero: clicks a day (Last scan) or a week (30 / 90 days); grey, the window before
  const bucket = (list, from, n, size) => Array.from({ length: n }, (_, i) => {
    const a = iso(Date.parse(`${from}T00:00:00Z`) + i * size * DAY), b = iso(Date.parse(`${from}T00:00:00Z`) + ((i + 1) * size - 1) * DAY)
    return { date: fmtDay(a), value: sum(list.filter((r) => inside(r.date, a, b)), 'clicks') }
  })
  const size = period === 'scan' ? 1 : 7
  const n = Math.floor(len / size)
  const startT = Date.parse(`${w.end}T00:00:00Z`) - (n * size - 1) * DAY
  const points = bucket(rows, iso(startT), n, size)
  const ghost = bucket(rows, iso(startT - n * size * DAY), n, size).map((p) => p.value)

  return {
    state: 'changed', since, flat,
    headline, glance,
    hero: { points, ghost, compareAt: -1, caption: `Google clicks a ${size === 1 ? 'day' : 'week'}, ${span}. Grey: the ${size === 1 ? 'days' : 'weeks'} before.` },
    breakdown: { title: 'Clicks by page', rows: pages },
    lists: [{ id: 'moved', title: 'What moved', rows: moved.slice(0, 5) }],
    next: [],
    footer,
    latestIso: siteKit.today,
    trigger: { delta: flat ? null : { text: `${Math.abs(pct(d, clicksThen))}%`, up: d > 0, good: d > 0 }, flatText: `No change on the ${len} days before`, spark: points.slice(-6).map((p) => p.value) },
  }
}

const cache = {}
export const siteKitChanges = (state = 'none') => (cache[state] ??= { page: 'site-kit', title: 'Site Kit', build: (period) => build(state, period) })
