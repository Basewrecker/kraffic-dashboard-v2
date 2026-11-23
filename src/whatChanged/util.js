// Shared by the "What changed" page configs (overview.js, sentiment.js, trends.js, …). Each config is
//   { page, title, build(period) } and build returns the panel's data (see WhatChanged.jsx for the shape):
//   { state: 'changed' | 'one', since, headline, glance, hero, breakdown, lists, next, footer, trigger, latestIso }
// Text is a list of segments: a string reads regular grey, B('…') semibold ink (the bold / regular rule).
// Colour follows what's good for the client: delta(…, { higherIsBetter }) — a competitor falling is good.
export const PERIOD_OPTIONS = [{ value: 'scan', label: 'Last scan' }, { value: '30d', label: '30 days' }, { value: '90d', label: '90 days' }]
export const PERIODS = PERIOD_OPTIONS.map((o) => o.value)
export const DAYS = { '30d': 30, '90d': 90 }
export const DAY = 86400000

export const B = (b) => ({ b })
export const plural = (n, w, ws = `${w}s`) => `${n} ${n === 1 ? w : ws}`
export const preview = () => { try { return new URLSearchParams(window.location.search).get('wc') } catch { return null } }

// "2026-09-28" → "Sep 28"; with the weekday "Mon Sep 28"
export const fmtDay = (iso) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
export const fmtWeekday = (iso) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).replace(',', '')
export const isoOf = (date) => new Date(Date.parse(`${date} UTC`)).toISOString().slice(0, 10) // "Oct 5, 2026" → "2026-10-05"

// noise: under 2 pts, or under 5% of a count, is not a change
export const noisePts = (d) => d == null || Math.abs(d) < 2
export const noiseCount = (d, base) => d == null || Math.abs(d) < 1 || (base > 0 && Math.abs(d) / base < 0.05)

// a change as the panel shows it: "+7 pts" / "−3"; good: true (green), false (red), null (grey "No change")
export const signed = (d) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}`
export function delta(d, { unit = '', higherIsBetter = true, noise = false } = {}) {
  if (d == null) return null
  if (noise || d === 0) return { text: 'No change', good: null, flat: true }
  return { text: `${signed(d)}${unit}`, good: higherIsBetter ? d > 0 : d < 0, up: d > 0 }
}

// newest-first list of { t }: the entry this period compares with. Last scan: the one before; 30 / 90 days: the entry
// closest to that many days before the latest. -1: nothing to compare with.
export function baseIndex(list, period) {
  if (list.length < 2) return -1
  if (period === 'scan') return 1
  const target = list[0].t - DAYS[period] * DAY
  let best = 1
  list.forEach((x, i) => { if (i > 0 && Math.abs(x.t - target) < Math.abs(list[best].t - target)) best = i })
  return best
}

// the hero chart from a newest-first series of { iso, value }: Last scan shows the last 6 points, 30 / 90 days the
// points since the compared one; the same number of points before them are the grey ghost.
export function heroOf(series, bi, period, caption) {
  const n = period === 'scan' ? Math.min(6, series.length) : bi + 1
  const ink = series.slice(0, n).reverse()
  const ghost = series.slice(n, n * 2).reverse()
  return {
    points: ink.map((p) => ({ date: fmtDay(p.iso), value: p.value })),
    ghost: ghost.length > 1 ? ghost.map((p) => p.value) : [],
    compareAt: n - 1 - bi,
    caption: caption(ink.length, ghost.length > 1 ? ghost.length : 0),
  }
}
