// Run with: npm test. Visibility history with many competitors: at most 4 series, round symmetric change ticks,
// capped bar widths, and where the scoring change sits.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chipCap, drawnRivals, groupedBarSize, pickRival, picksFrom, scoringPosition, shareAxis, symmetricTicks } from './historyChart.js'

const ranked = ['rocket', 'omaha', 'aag', 'longbridge', 'liberty', 'guild']

test('the top 3 by share are drawn; the rest sit under "+N more"', () => {
  assert.deepEqual(drawnRivals(ranked), { drawn: ['rocket', 'omaha', 'aag'], rest: ['longbridge', 'liberty', 'guild'] })
  assert.deepEqual(drawnRivals(['a', 'b']), { drawn: ['a', 'b'], rest: [] })
})

test('picking one from "+N more" swaps it into the 3rd slot; the swapped-out brand goes back in share order', () => {
  assert.deepEqual(drawnRivals(ranked, 'liberty'), { drawn: ['rocket', 'omaha', 'liberty'], rest: ['aag', 'longbridge', 'guild'] })
  // a key already drawn, or unknown, changes nothing
  assert.deepEqual(drawnRivals(ranked, 'omaha').drawn, ['rocket', 'omaha', 'aag'])
  assert.deepEqual(drawnRivals(ranked, 'nope').drawn, ['rocket', 'omaha', 'aag'])
  // never more than 3 competitors
  assert.equal(drawnRivals(ranked, 'guild').drawn.length, 3)
})

test('the brands checklist: check adds, uncheck removes, a 4th competitor swaps out the last one', () => {
  assert.deepEqual(pickRival(['rocket', 'omaha'], 'aag'), { drawn: ['rocket', 'omaha', 'aag'], out: null })
  assert.deepEqual(pickRival(['rocket', 'omaha', 'aag'], 'omaha'), { drawn: ['rocket', 'aag'], out: null })
  // full (the brand + 3): the new one takes the last slot, and says which one left
  assert.deepEqual(pickRival(['rocket', 'omaha', 'aag'], 'liberty'), { drawn: ['rocket', 'omaha', 'liberty'], out: 'aag' })
  // the last competitor stays
  assert.deepEqual(pickRival(['rocket'], 'rocket'), { drawn: ['rocket'], out: null })
})

test('?brands= keeps known keys only, at most 3; nothing valid → the top 3 by share', () => {
  assert.deepEqual(picksFrom(ranked, ['guild', 'nope', 'guild', 'aag']), ['guild', 'aag'])
  assert.deepEqual(picksFrom(ranked, ['guild', 'aag', 'liberty', 'omaha']), ['guild', 'aag', 'liberty'])
  assert.deepEqual(picksFrom(ranked, []), ['rocket', 'omaha', 'aag'])
  assert.deepEqual(picksFrom(ranked, null), ['rocket', 'omaha', 'aag'])
})

test('legend chips: short names stay whole, only the longest are cut, to one width', () => {
  assert.equal(chipCap([100, 120, 140], 400, 10), Infinity) // everything fits
  // 300 px for 100 + 150 + 200 (no gaps): 100 stays, the other two get 100 each
  assert.equal(chipCap([100, 150, 200], 300), 100)
  // 360: 100 stays; 100 + 2 × 130 = 360, so the two long ones get 130 each
  assert.equal(chipCap([200, 100, 150], 360), 130)
  const widths = [150, 140, 220, 200], cap = chipCap(widths, 600, 4)
  assert.ok(widths.reduce((a, w) => a + Math.min(w, cap), 0) + 12 <= 600)
  assert.ok(widths.filter((w) => w <= cap).length >= 1, 'a short name keeps its full width')
})

test('change view ticks are round and symmetric', () => {
  assert.deepEqual(symmetricTicks(17), { domain: [-20, 20], ticks: [-20, -10, 0, 10, 20] })
  assert.deepEqual(symmetricTicks(3).ticks, [-4, -2, 0, 2, 4])
  assert.deepEqual(symmetricTicks(0).ticks, [-2, -1, 0, 1, 2])
  assert.deepEqual(symmetricTicks(-7).ticks, [-10, -5, 0, 5, 10])
  for (const m of [1, 4, 9, 19, 33, 61]) {
    const { domain, ticks } = symmetricTicks(m)
    assert.equal(domain[0], -domain[1])
    assert.ok(domain[1] > m, `${m} fits inside ${domain[1]}`)
    assert.ok(ticks.every((t) => Number.isInteger(t)))
  }
})

test('share axis: 0–100 above 50%, otherwise fitted to the next 10', () => {
  assert.deepEqual(shareAxis(74).domain, [0, 100])
  assert.deepEqual(shareAxis(31), { domain: [0, 40], ticks: [0, 10, 20, 30, 40] })
  assert.deepEqual(shareAxis(4).domain, [0, 20])
})

test('grouped bars are capped and leave a gap between dates', () => {
  assert.equal(groupedBarSize({ width: 800, groups: 5, bars: 4 }), 20) // plenty of room → the cap
  const narrow = groupedBarSize({ width: 300, groups: 13, bars: 4 })
  assert.ok(narrow >= 3 && narrow < 20)
  assert.ok(narrow * 4 + 2 * 3 <= (300 / 13) * 0.65 + 0.001 || narrow === 3)
  assert.equal(groupedBarSize({ width: 0, groups: 5, bars: 4 }), 20)
})

test('the scoring marker sits between the dates around it, or not at all', () => {
  const dates = ['Sep 28', 'Oct 5', 'Oct 12', 'Oct 19', 'Oct 26']
  assert.equal(scoringPosition(dates, { after: 'Oct 19', frac: 2 / 7 }), 3 + 2 / 7)
  assert.equal(scoringPosition(dates, { after: 'Oct 26', frac: 0.5 }), null) // nothing after it yet
  assert.equal(scoringPosition(dates, { after: 'Aug 3', frac: 0.5 }), null) // outside the window
  assert.equal(scoringPosition(dates, null), null)
})
