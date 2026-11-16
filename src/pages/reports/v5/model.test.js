// Reports (final design): every report type × data situation × path (live + topic/engine, all proposed fields)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { proposedFacts } from '../../../data/live-facts-proposed.js'
import { buildReport5 } from './model.js'

const BRANDS = { foa: 'longbridge', lumen: 'cerave', 'northwind-derm': 'longbridge', brightside: 'cerave' }
const KINDS = [['rival'], ['weekly'], ['weekly', 'client'], ['ceo'], ['content']]
// the period's points as the adapter's pointsIn keeps them for 30 days (one for a one-scan brand), and the syncs before
const in30d = (f) => f.points.filter((p) => p.iso >= '2026-09-26')
const cases = []
for (const [brand, rival] of Object.entries(BRANDS)) for (const [kind, audience] of KINDS) for (const all of [false, true]) {
  const facts = proposedFacts(brand, undefined, { all })
  const points = in30d(facts)
  const prev = facts.points.filter((p) => p.iso < points[0].iso)
  const opts = { brand, kind, audience: audience ?? 'team', period: '30d', compare: kind === 'rival' ? [rival] : [], engines: [] }
  cases.push({ at: `${brand} ${kind}${audience ? ' client' : ''} ${all ? 'proposed' : 'live'}`, brand, facts, points, v: buildReport5({ facts, built: { ok: true, kind, opts }, points, prev }) })
}

test('3–4 KPI tabs (2 with one scan, where gained and lost have no meaning); every series matches the period', () => {
  for (const { at, brand, points, v } of cases) {
    assert.ok(v.kpis.length >= (brand === 'lumen' ? 2 : 3) && v.kpis.length <= 4, at)
    for (const k of v.kpis) if (k.series) assert.equal(k.series.length, points.length - (k.offset ?? 0), `${at}: ${k.id}`)
  }
})

test('no empty panel: a panel without rows is dropped', () => {
  for (const { at, v } of cases) for (const p of v.blocks.filter((b) => b.panel).map((b) => b.panel)) for (const t of p.tabs) assert.ok(t.rows.length > 0, `${at}: ${p.id}/${t.key}`)
})

test('one scan: no deltas, no charts', () => {
  for (const { at, v } of cases.filter((c) => c.brand === 'lumen')) for (const k of v.kpis) { assert.equal(k.delta, null, at); assert.equal(k.series, null, at) }
})

test('the comparison series lines up with the main one', () => {
  for (const { at, v } of cases) for (const k of v.kpis) if (k.series && k.compare) assert.equal(k.compare.values.length, k.series.length, `${at}: ${k.id}`)
})

test('the prototype numbers: FoA vs Longbridge with the proposed fields', () => {
  const { v } = cases.find((c) => c.at === 'foa rival proposed')
  assert.equal(v.kpis.find((k) => k.id === 'wins').value, '23')
  assert.deepEqual(v.blocks.find((b) => b.panel?.id === 'engines').panel.tabs[0].rows.filter((r) => !r.muted).map((r) => r.vals[1].v), [8, 5, 7, 3])
  assert.deepEqual(v.steps.rows.map((r) => r.n), [8, 6, 5])
})

test('layout: an expandable list (more than 7 rows, What moved, Open prompts) never shares a row', () => {
  for (const { at, v } of cases) {
    for (const b of v.blocks) if (b.panel) assert.ok(b.panel.tabs.length, at)
    assert.ok(v.blocks.every((b) => b.panel || b.moved || b.open || b.table), at)
  }
})
