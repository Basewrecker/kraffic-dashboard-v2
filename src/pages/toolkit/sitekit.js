// Site Kit data for one date range, derived from the API-shaped rows in data/mock.js.
import { siteKit, skAiReferrals, skGa4Daily, skSearchMetrics } from '../../data/mock'
const singleDay = (() => { try { return new URLSearchParams(window.location.search).get('history') === 'single' } catch { return false } })()

export const RANGES = [['7', 'Last 7 days'], ['28', 'Last 28 days'], ['90', 'Last 90 days'], ['custom', 'Custom']]
const DAY = 86400000
const iso = (t) => new Date(t).toISOString().slice(0, 10)
export const fmtDay = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

// [start, end] inclusive ISO days + the window of equal length before it
export function windowOf(range, custom) {
  const end = range === 'custom' && custom?.end ? custom.end : siteKit.today
  const start = range === 'custom' && custom?.start ? custom.start : iso(Date.parse(`${end}T00:00:00Z`) - (Number(range) - 1) * DAY)
  const len = Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1
  const prevEnd = iso(Date.parse(`${start}T00:00:00Z`) - DAY)
  const prevStart = iso(Date.parse(`${prevEnd}T00:00:00Z`) - (len - 1) * DAY)
  return { start, end, prevStart, prevEnd, len }
}
const inside = (d, a, b) => d >= a && d <= b
// "https://site.com/products/x" → "/products/x" (any site: the page rows are the brand's own)
const pathOf = (url) => { try { return new URL(url).pathname || '/' } catch { return url || '/' } }
const delta = (now, before) => (before ? (now - before) / before : null)

export function searchConsole(w, empty) {
  const rows = empty ? [] : skSearchMetrics.filter((r) => inside(r.date, w.start, w.end))
  if (!rows.length) return null
  const prev = skSearchMetrics.filter((r) => inside(r.date, w.prevStart, w.prevEnd))
  const totals = (list) => {
    const clicks = list.reduce((n, r) => n + r.clicks, 0)
    const impressions = list.reduce((n, r) => n + r.impressions, 0)
    const position = impressions ? list.reduce((n, r) => n + r.position * r.impressions, 0) / impressions : 0
    return { clicks, impressions, ctr: impressions ? (clicks / impressions) * 100 : 0, position }
  }
  const now = totals(rows), before = totals(prev)
  const byDay = new Map()
  for (const r of rows) { const d = byDay.get(r.date) ?? { date: r.date, clicks: 0, impressions: 0 }; d.clicks += r.clicks; d.impressions += r.impressions; byDay.set(r.date, d) }
  const group = (key) => {
    const m = new Map()
    for (const r of rows) { const g = m.get(r[key]) ?? []; g.push(r); m.set(r[key], g) }
    return [...m].map(([k, list]) => ({ key: k, ...totals(list) })).sort((a, b) => b.clicks - a.clicks)
  }
  return {
    kpis: [
      { id: 'clicks', label: 'Clicks', value: now.clicks, change: delta(now.clicks, before.clicks), fmt: 'int' },
      { id: 'impressions', label: 'Impressions', value: now.impressions, change: delta(now.impressions, before.impressions), fmt: 'int' },
      { id: 'ctr', label: 'CTR', value: now.ctr, change: before.ctr ? now.ctr - before.ctr : null, fmt: 'pct', points: true },
      { id: 'position', label: 'Avg position', value: now.position, change: before.position ? now.position - before.position : null, fmt: 'pos', lowerIsBetter: true, points: true },
    ],
    // ?history=single: one day of data so far (the chart's first-day state)
    series: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(singleDay ? -1 : 0),
    queries: group('query').slice(0, 10),
    pages: group('pageUrl').map((p) => ({ ...p, path: pathOf(p.key) })).slice(0, 8),
  }
}

export function analytics(w, empty) {
  const days = empty ? [] : skGa4Daily.filter((r) => inside(r.date, w.start, w.end))
  if (!days.length) return null
  const prev = skGa4Daily.filter((r) => inside(r.date, w.prevStart, w.prevEnd))
  const sum = (list, k) => list.reduce((n, r) => n + r[k], 0)
  const engaged = (list) => (sum(list, 'sessions') ? (sum(list, 'engagedSessions') / sum(list, 'sessions')) * 100 : 0)
  const ai = skAiReferrals.filter((r) => inside(r.date, w.start, w.end))
  const engines = new Map()
  for (const r of ai) { const e = engines.get(r.sourceDomain) ?? { domain: r.sourceDomain, engine: r.aiEngine, sessions: 0, engaged: 0 }; e.sessions += r.sessions; e.engaged += r.engagedSessions; engines.set(r.sourceDomain, e) }
  const pages = new Map()
  for (const r of ai) { const p = pages.get(r.landingPage) ?? { path: r.landingPage, sessions: 0, engaged: 0 }; p.sessions += r.sessions; p.engaged += r.engagedSessions; pages.set(r.landingPage, p) }
  const aiPrev = skAiReferrals.filter((r) => inside(r.date, w.prevStart, w.prevEnd)).reduce((n, r) => n + r.sessions, 0)
  const aiNow = ai.reduce((n, r) => n + r.sessions, 0)
  return {
    kpis: [
      { id: 'users', label: 'Users', value: sum(days, 'users'), change: delta(sum(days, 'users'), sum(prev, 'users')), fmt: 'int' },
      { id: 'sessions', label: 'Sessions', value: sum(days, 'sessions'), change: delta(sum(days, 'sessions'), sum(prev, 'sessions')), fmt: 'int' },
      { id: 'engaged', label: 'Engaged sessions', value: engaged(days), change: prev.length ? engaged(days) - engaged(prev) : null, fmt: 'pct', points: true },
      { id: 'keyEvents', label: 'Key events', value: sum(days, 'keyEvents'), change: delta(sum(days, 'keyEvents'), sum(prev, 'keyEvents')), fmt: 'int' },
    ],
    engines: [...engines.values()].sort((a, b) => b.sessions - a.sessions),
    aiTotal: aiNow,
    aiChange: delta(aiNow, aiPrev),
    aiShare: sum(days, 'sessions') ? aiNow / sum(days, 'sessions') : 0,
    pages: [...pages.values()].sort((a, b) => b.sessions - a.sessions).slice(0, 6),
  }
}

export const integrationsFor = (state) => siteKit.states[state] ?? siteKit.states.none
