// The shared Mix column geometry. Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { stackSegments } from './mixBars.js'

const y = (v) => 100 - v // a 100px plot, value = px
test('segments stack bottom up with a 2px gap above the lowest one, the top rounded', () => {
  const s = stackSegments(['a', 'b', 'c'], (k) => ({ a: 30, b: 0, c: 50 })[k], y)
  assert.deepEqual(s.map((x) => [x.key, x.on, x.yTop, x.h, x.r]), [['a', true, 70, 30, 0], ['b', false, 70, 0, 0], ['c', true, 20, 48, 3]])
})
test('a tiny top segment is rounded no more than its height; nothing shown → all 0 tall', () => {
  assert.equal(stackSegments(['a', 'b'], (k) => ({ a: 50, b: 3 })[k], y)[1].r, 1)
  assert.ok(stackSegments(['a', 'b'], () => 0, y).every((x) => x.h === 0 && !x.on))
})
