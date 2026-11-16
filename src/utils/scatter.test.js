import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QUADRANT, quadrantScatter, scatterMinH } from './spectrum.js'

const R = 18, GAP = 10, EDGE = 24, W = 760
const H = Math.max(scatterMinH(R), 240)
const urls = (tone, n) => Array.from({ length: n }, (_, i) => ({ key: `${tone}${i}`, tone, seed: `https://site${i}.com/${tone}/page-${i}` }))
const all = [...urls('neutral', 10), ...urls('positive', 6), ...urls('negative', 2), ...urls('mixed', 1)]
const LABELS = { neutral: 75, positive: 75, negative: 78, mixed: 60 }
const lay = () => quadrantScatter(all, { width: W, height: H, r: R, labelW: LABELS })

test('no two dots closer than 10px; every dot 24px clear of its quadrant edges (and so of the cross)', () => {
  const { pos } = lay()
  const ps = Object.entries(pos)
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const [, a] = ps[i], [, b] = ps[j]
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 2 * R + GAP - 0.01, `${ps[i][0]} and ${ps[j][0]} too close`)
  }
  for (const it of all) {
    const [cx, cy] = QUADRANT[it.tone], p = pos[it.key]
    assert.ok(p.x - R >= cx * W / 2 + EDGE - 0.01 && p.x + R <= (cx + 1) * W / 2 - EDGE + 0.01, `${it.key} x clear of the edges`)
    assert.ok(p.y - R >= cy * H / 2 + EDGE - 0.01 && p.y + R <= (cy + 1) * H / 2 - EDGE + 0.01, `${it.key} y clear of the edges`)
  }
})

test('dots stay 24px clear of the corner labels', () => {
  const { pos } = lay()
  for (const it of all) {
    const [cx, cy] = QUADRANT[it.tone], p = pos[it.key]
    const lw = LABELS[it.tone] + EDGE, lh = 18 + EDGE
    const lx = cx ? (cx + 1) * W / 2 - lw : 0, ly = cy ? H - lh : 0
    const clear = p.x + R <= lx || p.x - R >= lx + lw || p.y + R <= ly || p.y - R >= ly + lh
    assert.ok(clear, `${it.key} overlaps the ${it.tone} label`)
  }
})

test('the same layout on every load (seeded by the page URL)', () => {
  assert.deepEqual(lay(), lay())
})

test('1–2 dots sit near their quadrant\'s centre; more spread over x and y', () => {
  const { pos } = lay()
  const near = (key, tone) => { const [cx, cy] = QUADRANT[tone]; const p = pos[key]; return Math.hypot(p.x - (cx + 0.5) * W / 2, p.y - (cy + 0.5) * H / 2) }
  assert.ok(near('mixed0', 'mixed') < 60, 'one dot: near the centre')
  for (const k of ['negative0', 'negative1']) assert.ok(near(k, 'negative') < 80, `${k}: near the centre`)
  const xs = urls('neutral', 10).map((it) => pos[it.key].x), ys = urls('neutral', 10).map((it) => pos[it.key].y)
  assert.ok(Math.max(...xs) - Math.min(...xs) > W / 4, 'spread across the width')
  assert.ok(Math.max(...ys) - Math.min(...ys) > 20, 'and up and down')
  assert.ok(new Set(ys.map(Math.round)).size > 3, 'not one straight row')
})

test('more than fit: "+n more" takes the place of the last dots, and no dot sits on it', () => {
  const crowd = urls('positive', 40)
  const { pos, more } = quadrantScatter(crowd, { width: W, height: H, r: R, labelW: LABELS })
  assert.ok(more.positive && more.positive.n > 0)
  assert.equal(Object.keys(pos).length + more.positive.n, 40)
  for (const p of Object.values(pos)) {
    const m = more.positive
    const overlap = Math.abs(p.x - m.x) < m.w / 2 + R + GAP - 1 && Math.abs(p.y - m.y) < 2 * R + GAP - 1
    assert.ok(!overlap, 'a dot on the +n more pill')
  }
})
