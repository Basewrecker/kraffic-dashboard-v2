// The spring easing behind the Content deck. Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { SETTLE, SNAPPY, settleTime, spring, springAt } from './spring.js'

test('springAt: starts at 0 at rest, ends at 1', () => {
  assert.equal(springAt(0, SNAPPY), 0)
  assert.ok(Math.abs(springAt(2, SNAPPY) - 1) < 1e-4)
  assert.ok(springAt(0.001, SNAPPY) < 0.01) // starts still (no jump)
})

test('300 / 26: snappy, a slight overshoot, settled within 600ms', () => {
  const peak = Math.max(...Array.from({ length: 1200 }, (_, i) => springAt(i / 1000, SNAPPY)))
  assert.ok(peak > 1.005 && peak < 1.06, `overshoot ${peak}`)
  const t = settleTime(SNAPPY)
  assert.ok(t > 0.3 && t <= 0.6, `settles in ${t}s`)
})

test('the landing spring bounces a little more but still settles within 600ms', () => {
  const peak = (o) => Math.max(...Array.from({ length: 1200 }, (_, i) => springAt(i / 1000, o)))
  assert.ok(peak(SETTLE) > peak(SNAPPY))
  assert.ok(settleTime(SETTLE) <= 0.6)
})

test('spring(): a CSS linear() curve from 0 to 1 and its duration', () => {
  const s = spring(SNAPPY)
  assert.match(s.easing, /^linear\(0, .*, 1\)$/)
  const pts = s.easing.slice(7, -1).split(', ').map(Number)
  assert.equal(pts.length, 41)
  assert.ok(pts.some((v) => v > 1)) // the overshoot is in the curve
  assert.ok(s.duration > 300 && s.duration <= 600)
  // overdamped and critically damped springs work too, without overshoot
  for (const o of [{ stiffness: 300, damping: 60 }, { stiffness: 100, damping: 20 }]) {
    const c = spring(o).easing.slice(7, -1).split(', ').map(Number)
    assert.ok(c.every((v) => v <= 1.0001))
  }
})
