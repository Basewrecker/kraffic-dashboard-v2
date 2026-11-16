// Run with: npm test. Visibility history's ranges and the "Since <first sync>" note (ported from the app's
// scripts/mock-unit/next-round.test.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MONTHLY_RANGES, WEEKLY_RANGES, longDay, sinceNote } from './historyRanges.js'

test('ranges: 30, 90, 180 days, a year and All time; monthly keeps 3 / 6 / 12 months and gets All time too', () => {
  assert.deepEqual(WEEKLY_RANGES.map((r) => r.label), ['Last 30 days', 'Last 90 days', 'Last 180 days', 'Last year', 'All time'])
  assert.deepEqual(MONTHLY_RANGES.map((r) => r.label), ['Last 3 months', 'Last 6 months', 'Last 12 months', 'All time'])
})

test('"Since <first sync>" when the history is shorter than the range; All time always says where it starts', () => {
  const r = (id) => WEEKLY_RANGES.find((x) => x.id === id)
  assert.equal(sinceNote({ range: r('last-180d'), firstIso: '2026-08-01', lastIso: '2026-10-28' }), 'Since Aug 1, 2026')
  assert.equal(sinceNote({ range: r('last-30d'), firstIso: '2026-08-01', lastIso: '2026-10-28' }), null, 'covered: no note')
  assert.equal(sinceNote({ range: r('all'), firstIso: '2026-08-01', lastIso: '2026-10-28' }), 'Since Aug 1, 2026')
  assert.equal(sinceNote({ range: MONTHLY_RANGES[2], firstIso: '2026-08-01', lastIso: '2026-10-28', periods: 3 }), 'Since Aug 1, 2026')
  assert.equal(sinceNote({ range: MONTHLY_RANGES[0], firstIso: '2026-08-01', lastIso: '2026-10-28', periods: 3 }), null)
  assert.equal(sinceNote({ range: r('last-90d'), firstIso: null, lastIso: null }), null, 'no history: the empty state says it')
})

test('longDay: an ISO day as "Oct 14, 2026"; anything else null', () => {
  assert.equal(longDay('2026-10-14T09:00:00Z'), 'Oct 14, 2026')
  assert.equal(longDay('Oct 14'), null)
})
