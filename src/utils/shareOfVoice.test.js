// Run with: npm test. Share of voice's ranked list (owner, 2026-11-02 / 11-03): medals by exact counts (dense ranking,
// only identical counts share), the #1 brand's gold, whole % adding to 100 and one decimal where different counts would
// show the same %. Ported from the app's scripts/mock-unit/next-round, sov-polish and palette-by-rank tests.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MEDALS, TOP_TEXT, TOP_TINT, displayShares, medalSize, rankShares, topShare, wholeShares } from './shareOfVoice.js'

test('medals by exact counts: gold, silver, bronze for the top three distinct counts; only an exact tie shares', () => {
  const r = rankShares([{ domain: 'a', prompts: 10 }, { domain: 'b', prompts: 30 }, { domain: 'c', prompts: 30 }, { domain: 'd', prompts: 20 }, { domain: 'e', prompts: 5 }, { domain: 'f', prompts: 0 }])
  assert.deepEqual(r.map((x) => [x.domain, x.rank]), [['b', 1], ['c', 1], ['d', 2], ['a', 3], ['e', 4], ['f', null]])
  assert.deepEqual(r.map((x) => x.medal?.name ?? null), ['Gold', 'Gold', 'Silver', 'Bronze', null, null])
  // 27 and 26 show the same % but aren't a tie: different medals
  const close = rankShares([{ domain: 'a', prompts: 100 }, { domain: 'b', prompts: 27 }, { domain: 'c', prompts: 26 }, { domain: 'd', prompts: 1 }])
  assert.deepEqual(close.map((x) => x.medal?.name ?? null), ['Gold', 'Silver', 'Bronze', null])
})

test('medal colours and sizes: gold #E0A200 at 22px, silver #9CA3AF and bronze #B4703A at 16px; a tie for first is #1 too', () => {
  assert.deepEqual([MEDALS[1].fill, MEDALS[2].fill, MEDALS[3].fill], ['#E0A200', '#9CA3AF', '#B4703A'])
  const r = rankShares([{ domain: 'a', prompts: 30 }, { domain: 'b', prompts: 30 }, { domain: 'c', prompts: 20 }, { domain: 'd', prompts: 10 }, { domain: 'e', prompts: 5 }, { domain: 'f', prompts: 0 }])
  assert.deepEqual(r.map(medalSize), [22, 22, 16, 16, 0, 0])
  assert.deepEqual(r.map(topShare), [true, true, false, false, false, false])
  assert.equal(topShare(null), false)
})

test('#1 row and "Top share": gold at 12%; the pill text the darker gold #A87700', () => {
  assert.equal(TOP_TINT, 'color-mix(in srgb, #E0A200 12%, transparent)')
  assert.equal(TOP_TEXT, '#A87700')
})

test('shares: whole % adding to 100; one decimal only where different counts would show the same %', () => {
  const counts = [100, 27, 26, 1]
  assert.deepEqual(wholeShares(counts), [65, 17, 17, 1])
  assert.equal(wholeShares(counts).reduce((a, b) => a + b, 0), 100)
  assert.deepEqual(displayShares(counts), [65, 17.5, 16.9, 1])
  assert.deepEqual(displayShares([30, 30, 20, 20]), [30, 30, 20, 20], 'an exact tie keeps the same whole number')
  assert.deepEqual(displayShares([0, 0]), [0, 0])
  // close counts get real silver / bronze and one decimal
  assert.deepEqual(displayShares([600, 134, 131, 128, 7]), [60, 13.4, 13.1, 12.8, 1])
})
