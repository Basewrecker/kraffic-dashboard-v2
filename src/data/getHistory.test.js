// Run with: npm test   (Node's built-in test runner, no extra dependencies)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getHistory } from './mock.js'

test('weekly and monthly return different points and labels', () => {
  const weekly = getHistory({ granularity: 'weekly', range: 'last-30d' })
  const monthly = getHistory({ granularity: 'monthly', range: 'last-6m' })
  assert.equal(weekly.points.length, 5)
  assert.equal(monthly.points.length, 6)
  assert.deepEqual(weekly.points.map((p) => p.date), ['Sep 7', 'Sep 16', 'Sep 21', 'Sep 28', 'Oct 5'])
  assert.deepEqual(monthly.points.map((p) => p.date), ['May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026'])
  assert.notDeepEqual(weekly.points.map((p) => p.dermasuri), monthly.points.map((p) => p.dermasuri).slice(-5))
})

test('range slices the window', () => {
  assert.equal(getHistory({ granularity: 'weekly', range: 'last-90d' }).points.length, 13)
  assert.equal(getHistory({ granularity: 'monthly', range: 'last-3m' }).points.length, 3)
  assert.equal(getHistory({ granularity: 'monthly', range: 'last-12m' }).points.length, 12)
  // a range id from the other granularity falls back to that granularity's default
  assert.equal(getHistory({ granularity: 'monthly', range: 'last-30d' }).points.length, 6)
})

test('compare false returns only dermasuri, with an auto-fit axis', () => {
  const h = getHistory({ compare: false, granularity: 'monthly', range: 'last-6m' })
  assert.deepEqual(h.series.map((s) => s.key), ['dermasuri'])
  assert.deepEqual(h.domain, [55, 85])
  assert.equal(h.ticks.length, 4)
})

test('compare true uses 0–100 and hidden removes a series', () => {
  const all = getHistory({ compare: true })
  assert.deepEqual(all.domain, [0, 100])
  assert.equal(all.series.length, 4)
  const h = getHistory({ compare: true, hidden: ['ordinary'] })
  assert.deepEqual(h.series.map((s) => s.key), ['dermasuri', 'cerave', 'paulas'])
})

test('best reflects the selected range; equal to current reads "this <unit>"', () => {
  assert.deepEqual(getHistory({ granularity: 'monthly', range: 'last-6m' }).stats.bestLabel, 'this month')
  const w = getHistory({ granularity: 'weekly', range: 'last-30d' }).stats
  assert.equal(w.best, 74)
  assert.equal(w.bestLabel, 'Sep 16, 2026')
})

test('growth: change vs previous period, symmetric axis, average', () => {
  const g = getHistory({ compare: false, granularity: 'monthly', range: 'last-6m' }).growth
  // May uses April (the period before the window)
  assert.deepEqual(g.points.map((p) => p.dermasuri), [2, -1, 2, 2, 3, 2])
  assert.deepEqual(g.domain, [-4, 4])
  assert.deepEqual(g.ticks, [-4, -2, 0, 2, 4])
  assert.equal(g.average, 1.7)
  // the first month of the 12-month window has no previous month → omitted
  assert.equal(getHistory({ compare: false, granularity: 'monthly', range: 'last-12m' }).growth.points.length, 11)
})

test('dermasuri can be hidden while comparing: competitors only, axis fits them', () => {
  const h = getHistory({ compare: true, hidden: ['dermasuri'], granularity: 'monthly', range: 'last-6m' })
  assert.equal(h.youHidden, true)
  assert.deepEqual(h.series.map((s) => s.key), ['cerave', 'ordinary', 'paulas'])
  assert.ok(h.domain[1] < 100) // fitted, not 0–100
  const max = Math.max(...h.points.flatMap((p) => h.series.map((s) => p[s.key])))
  assert.ok(h.domain[1] >= max)
  // growth average is still dermasuri's
  assert.equal(h.growth.average, getHistory({ compare: false, granularity: 'monthly', range: 'last-6m' }).growth.average)
  // Compare off always shows dermasuri, whatever is hidden
  assert.deepEqual(getHistory({ compare: false, hidden: ['dermasuri'] }).series.map((s) => s.key), ['dermasuri'])
})

test('a competitor can be the focal brand', () => {
  const h = getHistory({ focal: 'cerave' })
  assert.equal(h.series[0].key, 'cerave')
  assert.equal(h.stats.current, h.points.at(-1).cerave)
  const solo = getHistory({ focal: 'cerave', compare: false })
  assert.deepEqual(solo.series.map((s) => s.key), ['cerave'])
})
