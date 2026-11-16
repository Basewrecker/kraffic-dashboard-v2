// Run with: npm test. The mock data behind Share of voice's states. Default: you're #1 of four brands.
// ?competitors=many (data/mock.js extraCompetitors): ten brands, a competitor ahead of you, an exact tie (a shared
// bronze), two different counts that show the same whole % (one decimal), three brands in "Other brands", and brands
// with and without a name set in Brand Setup.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { displayShares, rankShares, topShare } from '../utils/shareOfVoice.js'
import { rankColors } from '../utils/brandColors.js'

globalThis.window = { location: { search: '?competitors=many', href: 'http://localhost/?competitors=many' } }
const { TRACKED_BRANDS, OWN, getBrandView } = await import('./brandViews.js')
const rows = TRACKED_BRANDS.map((b) => ({ domain: b.domain, name: b.name, prompts: getBrandView(b.domain).kpis.visible }))

test('?competitors=many: more than 7 brands, so the 8th and later share "Other brands"', () => {
  assert.equal(rows.length, 10)
  const colours = rankColors(rows.map((r) => ({ domain: r.domain, count: r.prompts })))
  assert.equal(Object.keys(colours).length, 7)
  assert.deepEqual(rows.filter((r) => !colours[r.domain]).map((r) => r.name), ['The Ordinary', 'Paula’s Choice', 'The INKEY List'])
})

test('?competitors=many: you\'re not #1 (no "Top share"), a tie shares bronze, close counts show one decimal', () => {
  const ranked = rankShares(rows)
  assert.equal(ranked[0].name, 'Glow Recipe')
  assert.equal(topShare(ranked.find((r) => r.domain === OWN.domain)), false)
  assert.deepEqual(ranked.filter((r) => r.medal?.name === 'Bronze').map((r) => r.name), ['Byoma', 'Naturium'])
  const shown = displayShares(rows.map((r) => r.prompts))
  const of = (name) => shown[rows.findIndex((r) => r.name === name)]
  assert.equal(of('Good Molecules'), 3.9)
  assert.equal(of('Versedskin'), 3.7)
})

test('?competitors=many: names from Brand Setup, the domain tidied only when none is set', () => {
  assert.deepEqual(rows.slice(4).map((r) => r.name), ['Glow Recipe', 'Byoma', 'Naturium', 'Good Molecules', 'Versedskin', 'The INKEY List'])
})
