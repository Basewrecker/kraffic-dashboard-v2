import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countFilters, fillRising, filterRows, fitAxis, fmtGrowth, smoothPath, sortRows, spreadLabels, tickIndexes } from './view.js'
import { interestOverTime, marketTerms, marketToday, relatedQueries } from '../../data/marketTrends.js'
import { comparedRange, rangeOf } from '../../lib/trendsCompare.js'

test('the y-axis fits the data instead of starting at 0', () => {
  assert.deepEqual(fitAxis([44, 67, 100, 51]), { lo: 40, hi: 100, ticks: [40, 60, 80, 100] })
  assert.deepEqual(fitAxis([82, 96]), { lo: 80, hi: 100, ticks: [80, 85, 90, 95, 100] })
  assert.deepEqual(fitAxis([3, 100]), { lo: 0, hi: 100, ticks: [0, 25, 50, 75, 100] })
  // gaps are skipped, and no data at all still gives an axis
  assert.equal(fitAxis([null, 50, null]).lo, 45)
  assert.deepEqual(fitAxis([null]).ticks, [0, 25, 50, 75, 100])
})

test('end labels are pushed apart and stay inside the chart', () => {
  const y = spreadLabels([{ id: 'a', y: 50 }, { id: 'b', y: 52 }, { id: 'c', y: 53 }], 16, 0, 200)
  assert.deepEqual(y, { a: 50, b: 66, c: 82 })
  const low = spreadLabels([{ id: 'a', y: 190 }, { id: 'b', y: 195 }, { id: 'c', y: 199 }], 16, 0, 200)
  assert.deepEqual(low, { a: 168, b: 184, c: 200 })
  const high = spreadLabels([{ id: 'a', y: -5 }, { id: 'b', y: 2 }], 16, 0, 200)
  assert.deepEqual(high, { a: 0, b: 16 })
})

test('the smooth line passes through every point and never overshoots a flat run', () => {
  const d = smoothPath([[0, 10], [10, 10], [20, 30], [30, 30]])
  assert.match(d, /^M0\.0,10\.0C/)
  assert.ok(d.endsWith('30.0,30.0'))
  // every y in the path stays between the lowest and highest point
  const ys = [...d.matchAll(/,(-?\d+\.\d)/g)].map((m) => +m[1])
  assert.ok(ys.every((v) => v >= 10 && v <= 30))
  assert.equal(smoothPath([]), '')
})

test('axis dates: evenly spread, first and last included', () => {
  assert.deepEqual(tickIndexes(52, 6), [0, 10, 20, 31, 41, 51])
  assert.deepEqual(tickIndexes(3, 6), [0, 1, 2])
})

const rows = [
  { query: 'a', status: 'named', score: 90 }, { query: 'b', status: 'missed', score: 80 },
  { query: 'c', status: null, score: 70 }, { query: 'd', status: null, score: 60 },
]
test('the list filter: a prompt tracked here is no longer "Not tracked"', () => {
  assert.deepEqual(countFilters(rows, new Set()), { all: 4, untracked: 2, named: 1, missed: 1 })
  assert.deepEqual(filterRows(rows, 'untracked', new Set(['c'])).map((r) => r.query), ['d'])
})

test('rising shows growth, Breakout, or a dash for no value', () => {
  assert.equal(fmtGrowth({ growth: 3830 }), '3,830%')
  assert.equal(fmtGrowth({ breakout: true, growth: null }), 'Breakout')
  assert.equal(fmtGrowth({ growth: null }), '—')
})

test('the Rising column is never empty', () => {
  const own = Array.from({ length: 10 }, (_, i) => ({ query: `own ${i}`, growth: 100 - i }))
  const others = [{ query: 'x', growth: 50 }, { query: 'y', breakout: true, growth: null }, { query: 'own 1', growth: 9 }]
  assert.equal(fillRising({ own, others, top: rows }).kind, 'own')
  // too few of its own: the other terms' rising rows follow, fastest first, without repeats
  const filled = fillRising({ own: own.slice(0, 2), others, top: rows })
  assert.equal(filled.kind, 'filled')
  assert.deepEqual(filled.rows.map((r) => r.query), ['own 0', 'own 1', 'y', 'x'])
  // nothing rising anywhere: the untracked top prompts, most searched first, and the strip
  const next = fillRising({ own: [], others: [], top: rows, tracked: new Set(['d']) })
  assert.deepEqual([next.kind, next.strip, next.rows.map((r) => r.query)], ['next', true, ['c']])
})

test('the drawer sorts', () => {
  assert.deepEqual(sortRows(rows, 'az').map((r) => r.query), ['a', 'b', 'c', 'd'])
  assert.deepEqual(sortRows([{ query: 'p', growth: 5 }, { query: 'q', breakout: true }, { query: 'r', growth: 50 }], 'growth').map((r) => r.query), ['q', 'r', 'p'])
})

test('sample data: 100 is the highest point of the shown terms, only the newest point is incomplete, gaps are null', () => {
  const v = { period: '12m', against: 'off' }
  const r = interestOverTime({ terms: marketTerms, range: rangeOf(v, marketToday), compared: comparedRange(v, marketToday) })
  assert.equal(r.points.length, 52)
  assert.equal(Math.max(...r.points.flatMap((p) => Object.values(p.values))), 100)
  assert.deepEqual(r.points.filter((p) => p.partial).map((p) => p.iso), [marketToday])
  assert.equal(relatedQueries(marketTerms[0]).top.length, 25)
  assert.equal(relatedQueries(marketTerms[0]).top[0].score, 100)
  // a small region with too few searches for a term: every value is null (drawn as a gap and "—"), never 0
  const gap = interestOverTime({ terms: marketTerms, range: rangeOf(v, marketToday), compared: null, region: 'Illinois' })
  const empty = marketTerms.filter((t) => gap.points.every((p) => p.values[t] == null))
  assert.ok(gap.points.every((p) => Object.values(p.values).every((x) => x == null || x > 0)))
  assert.deepEqual(empty, ['barrier repair cream'])
})
