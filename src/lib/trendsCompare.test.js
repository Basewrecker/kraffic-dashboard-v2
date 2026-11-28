import { test } from 'node:test'
import assert from 'node:assert/strict'
import { comparedRange, periodWords, rangeOf, validCustom } from './trendsCompare.js'

const TODAY = '2026-11-23'

test('a preset period ends today and is its number of days long', () => {
  assert.deepEqual(rangeOf({ period: '7d' }, TODAY), { from: '2026-11-17', to: TODAY, days: 7 })
  assert.equal(rangeOf({ period: '12m' }, TODAY).from, '2025-11-25')
})

test('the previous period is the same length, ending the day before the period starts', () => {
  assert.deepEqual(comparedRange({ period: '28d', against: 'previous' }, TODAY), { from: '2026-09-29', to: '2026-10-26', days: 28 })
  // Off still compares with the preceding period (the change line under the chart title)
  assert.deepEqual(comparedRange({ period: '28d', against: 'off' }, TODAY), comparedRange({ period: '28d', against: 'previous' }, TODAY))
})

test('year over year goes back 364 days so weekdays line up', () => {
  assert.deepEqual(comparedRange({ period: '7d', against: 'year' }, TODAY), { from: '2025-11-18', to: '2025-11-24', days: 7 })
})

test('a custom range needs both ends, in order, not in the future; otherwise the preset applies', () => {
  assert.equal(validCustom({ from: '2026-11-01', to: '2026-11-10' }, TODAY), true)
  assert.equal(validCustom({ from: '2026-11-10', to: '2026-11-01' }, TODAY), false)
  assert.equal(validCustom({ from: '2026-11-01', to: '2026-12-01' }, TODAY), false)
  assert.equal(validCustom({ from: '2026-11-01', to: null }, TODAY), false)
  assert.deepEqual(rangeOf({ period: 'custom', from: '2026-11-01', to: '2026-11-10' }, TODAY), { from: '2026-11-01', to: '2026-11-10', days: 10 })
  assert.equal(periodWords({ period: 'custom', from: '2026-11-01', to: '2026-11-10' }, TODAY), 'Nov 1 – Nov 10')
  assert.equal(periodWords({ period: '3m' }, TODAY), 'past 3 months')
})
