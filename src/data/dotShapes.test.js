import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SHAPE_KINDS, dotCounts, restLayout, shapeFor } from './dotShapes.js'
import { dataFor } from './reports.js'

const inside = (pts, w, h) => pts.every((p) => p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h)

test('the field has one dot per tracked prompt, named ones first', () => {
  assert.deepEqual(dotCounts('foa'), { total: 113, named: 71 })
  assert.deepEqual(dotCounts('dermasuri'), { total: 152, named: 111 })
  assert.deepEqual(dotCounts('brightside'), { total: 0, named: 0 })
})

test('every hero shape places exactly one dot per prompt, inside its box', () => {
  for (const brand of ['foa', 'dermasuri']) {
    for (const kind of SHAPE_KINDS) {
      for (const [w, h] of [[1100, 300], [358, 220]]) {
        const pts = shapeFor(kind, brand, w, h)
        assert.equal(pts.length, dataFor(brand).prompts, `${brand} ${kind} ${w}`)
        assert.ok(inside(pts, w, h), `${brand} ${kind} ${w}: inside the box`)
      }
    }
  }
  assert.equal(shapeFor('weekly', 'brightside', 100, 100), null)
  assert.ok(inside(restLayout(113, 900, 400), 900, 400))
})

test('named dots land where AI names you: held and won bands, the you-named quadrants, the axis', () => {
  const { named } = dotCounts('foa')
  const flow = shapeFor('weekly', 'foa', 1000, 300)
  assert.ok(flow.slice(0, named).every((p) => p.band === 'held' || p.band === 'won'))
  assert.ok(flow.slice(named).every((p) => p.band === 'lost' || p.band === 'missing'))
  const grid = shapeFor('rival', 'foa', 1000, 300)
  assert.ok(grid.slice(0, named).every((p) => ['youFirst', 'themFirst', 'onlyYou'].includes(p.group)))
  assert.ok(grid.slice(named).every((p) => ['onlyThem', 'neither'].includes(p.group)))
  const bubbles = shapeFor('content', 'foa', 1000, 300)
  assert.ok(bubbles.slice(0, named).every((p) => p.axis))
  assert.ok(bubbles.slice(named).every((p) => p.theme))
})
