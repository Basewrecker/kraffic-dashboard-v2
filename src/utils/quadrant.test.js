import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QUADRANT, quadrantMinH, quadrantPack } from './spectrum.js'

const items = (tone, n, pre = tone) => Array.from({ length: n }, (_, i) => ({ key: `${pre}${i}`, tone }))
const R = 20, GAP = 8

test('each tone lands in its own quadrant: Neutral top-left, Positive top-right, Negative bottom-left, Mixed bottom-right', () => {
  const W = 760, H = 240
  const { pos } = quadrantPack([...items('neutral', 3), ...items('positive', 3), ...items('negative', 3), ...items('mixed', 3)], { width: W, height: H, r: R })
  for (const [tone, [cx, cy]] of Object.entries(QUADRANT)) {
    for (let i = 0; i < 3; i++) {
      const p = pos[`${tone}${i}`]
      assert.ok(p.x - R >= cx * W / 2 && p.x + R <= (cx + 1) * W / 2, `${tone}${i} x inside its column`)
      assert.ok(p.y - R >= cy * H / 2 && p.y + R <= (cy + 1) * H / 2, `${tone}${i} y inside its row`)
    }
  }
})

test('dots never overlap and sit 8px apart in a row; rows are centred', () => {
  const { pos, perRow } = quadrantPack(items('neutral', 10), { width: 760, height: 240, r: R })
  const ps = Object.values(pos)
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    assert.ok(Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y) >= 2 * R + GAP - 0.01, 'no overlap, gap kept')
  }
  const row0 = ps.slice(0, perRow)
  assert.equal(row0[1].x - row0[0].x, 2 * R + GAP)
  const left = row0[0].x - R, right = 380 - (row0.at(-1).x + R)
  assert.ok(Math.abs(left - right) < 0.01, 'first row centred in the quadrant')
})

test('more than two rows: the last two slots become "+n more", nothing is placed past them', () => {
  const { pos, more, perRow } = quadrantPack(items('positive', 40), { width: 760, height: 240, r: R })
  const cap = perRow * 2
  assert.equal(Object.keys(pos).length, cap - 2)
  assert.equal(more.positive.n, 40 - (cap - 2))
  assert.equal(more.positive.w, 4 * R + GAP)
  const ys = new Set(Object.values(pos).map((p) => p.y))
  assert.ok(ys.size <= 2, 'two rows at most')
  assert.ok(more.positive.x + more.positive.w / 2 <= 760 + 0.01 && more.positive.x - more.positive.w / 2 >= 380 - 0.01, '+n more inside its quadrant')
})

test('exactly two full rows fit without a "+n more"', () => {
  const { perRow } = quadrantPack([], { width: 760, height: 240, r: R })
  const { pos, more } = quadrantPack(items('mixed', perRow * 2), { width: 760, height: 240, r: R })
  assert.equal(Object.keys(pos).length, perRow * 2)
  assert.equal(more.mixed, undefined)
})

test('the label rows stay clear: top quadrants below their label, bottom ones above it', () => {
  const H = quadrantMinH(R)
  const { pos } = quadrantPack([...items('positive', 20), ...items('negative', 20)], { width: 760, height: H, r: R })
  for (const [k, p] of Object.entries(pos)) {
    if (k.startsWith('positive')) assert.ok(p.y - R >= 20, `${k} under the top label`)
    else assert.ok(p.y + R <= H - 20, `${k} above the bottom label`)
  }
  assert.ok(H <= 240, `two rows of 40px dots fit in about 240px (min ${H})`)
})
