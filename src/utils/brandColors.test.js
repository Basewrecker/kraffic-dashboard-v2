// Run with: npm test. Brand colours in Share of voice and Visibility history (owner, 2026-11-03; DESIGN.md §3): a fixed
// cool palette by rank, dark +8% lightness, one map for both cards, brands past the 7th in "Other brands".
// Ported from the app's scripts/mock-unit/palette-by-rank.test.mjs (the pure parts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BRAND_PALETTE, BRAND_PALETTE_DARK, DARK_STEP, OTHER_COLOR, darkStep, hexToRgb, rankColors, rgbToHsl } from './brandColors.js'

const hsl = (hex) => rgbToHsl(hexToRgb(hex))

test('palette: the owner\'s seven colours as given, in order', () => {
  assert.deepEqual(BRAND_PALETTE, ['#4F46E5', '#6366F1', '#38BDF8', '#818CF8', '#A78BFA', '#C084FC', '#E879F9'])
  assert.deepEqual(BRAND_PALETTE_DARK, ['#716AEA', '#888BF4', '#5FCAF9', '#A8AFFA', '#C5B2FC', '#D4ACFD', '#EFA0FB'])
})

test('palette dark: the same hues, HSL lightness +8%', () => {
  assert.equal(DARK_STEP, 0.08)
  assert.deepEqual(BRAND_PALETTE_DARK, BRAND_PALETTE.map(darkStep))
  BRAND_PALETTE.forEach((hex, i) => {
    const [h0, s0, l0] = hsl(hex), [h1, s1, l1] = hsl(BRAND_PALETTE_DARK[i])
    assert.ok(Math.abs(h1 - h0) < 1.5, `${hex}: hue kept`)
    assert.ok(Math.abs(s1 - s0) < 0.02, `${hex}: saturation kept`)
    assert.ok(Math.abs(l1 - l0 - 0.08) < 0.005, `${hex}: +8% lightness`)
  })
})

test('by rank: the biggest exact count gets the first colour; a tie keeps the tracked order; 8th and later get none', () => {
  const brands = [
    { domain: 'own.com', count: 20 }, { domain: 'a.com', count: 50 }, { domain: 'b.com', count: 20 }, { domain: 'c.com', count: 21 },
    { domain: 'd.com', count: 5 }, { domain: 'e.com', count: 4 }, { domain: 'f.com', count: 3 }, { domain: 'g.com', count: 2 }, { domain: 'h.com', count: 0 },
  ]
  const m = rankColors(brands)
  assert.deepEqual(['a.com', 'c.com', 'own.com', 'b.com', 'd.com', 'e.com', 'f.com'].map((d) => m[d].light), BRAND_PALETTE)
  assert.equal(m['own.com'].dark, BRAND_PALETTE_DARK[2])
  assert.equal(m['a.com'].css, `light-dark(${BRAND_PALETTE[0]}, ${BRAND_PALETTE_DARK[0]})`)
  assert.equal(m['a.com'].rank, 1)
  assert.equal(m['g.com'], undefined, '8th: no palette colour (Other brands)')
  assert.equal(m['h.com'], undefined)
  assert.deepEqual(rankColors(brands), m, 'stable')
  assert.deepEqual(rankColors(null), {})
})

test('"Other brands": mid graphite, never the near-white tint', () => {
  assert.equal(OTHER_COLOR, 'var(--color-stone-500)')
})
