import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIVE_FACTS_FIELDS, sampleFacts } from './live-facts-sample.js'
import { DATES, dataFor } from './reports.js'

test('the live-facts sample has exactly the app’s accountFacts fields, in order, for every sample brand', () => {
  for (const b of ['foa', 'dermasuri', 'lumen']) assert.deepEqual(Object.keys(sampleFacts(b)), LIVE_FACTS_FIELDS, b)
  assert.equal(sampleFacts('nobody'), null, 'a brand without a dataset has no facts')
  for (const b of ['brightside', 'northwind-derm']) { const f = sampleFacts(b); assert.deepEqual(Object.keys(f), LIVE_FACTS_FIELDS, b); assert.equal(f.missedRows.length, f.missed, `${b}: missed = its rows`); assert.equal(f.visible + f.missed, f.prompts); assert.equal(f.points.at(-1).visible, f.visible, `${b}: the latest point agrees with the count`) }
  assert.equal(sampleFacts('brightside').missed, 0, 'every prompt named')
  assert.ok(sampleFacts('northwind-derm').missed / sampleFacts('northwind-derm').prompts >= 0.4, 'missing 40%+')
})

test('every number agrees with the sample datasets: prompts, visible, missed, shares, the week’s gained and lost, the engines that ran', () => {
  for (const b of ['foa', 'dermasuri']) {
    const d = dataFor(b)
    const f = sampleFacts(b)
    assert.equal(f.prompts, d.prompts)
    assert.equal(f.visible, d.series.named.at(-1))
    assert.equal(f.missed, d.prompts - d.series.named.at(-1))
    assert.equal(f.visible + f.missed, f.prompts, 'visible + missed = tracked prompts')
    assert.equal(f.score, d.series.score.at(-1))
    assert.equal(f.youShare, d.share[Object.keys(d.share)[0]].at(-1))
    assert.equal(f.gained.length, d.flow.week.won, `${b}: gained prompts = the week’s won`)
    assert.equal(f.lost.length, d.flow.week.lost, `${b}: lost prompts = the week’s lost`)
    assert.deepEqual(f.ran, d.ran)
    assert.ok(f.engines.every((e) => d.ran.includes(e.id) && e.visible > 0))
    assert.equal(f.competitors.length, d.rivals.length)
    assert.ok(f.competitors.every((c) => c.name && !c.name.includes('.') && c.share != null), 'display names, never domains')
    assert.equal(f.missedRows.length, d.gaps.reduce((a, g) => a + g.prompts.length, 0))
    assert.equal(f.missedRows.filter((r) => r.competitors.length).length, d.gaps.reduce((a, g) => a + g.owned, 0), 'rows with a competitor named = the owned counts')
    assert.ok(f.missedRows.every((r) => r.competitors.every((c) => f.competitors.some((x) => x.domain === c))), 'a missed row names its winners by domain, as the app does')
    assert.deepEqual(f.cited, d.cited.map((c) => ({ path: c.path, n: c.n })))
    assert.equal(f.points.length, DATES.length)
    assert.deepEqual(f.points.at(-1), { date: 'Oct 26', iso: '2026-10-26', score: d.series.score.at(-1), visible: d.series.named.at(-1) })
    assert.equal(f.compared, true)
    assert.equal(f.since, 'Oct 19')
  }
})

test('Lumen Skin has one scan and so no history: not compared, no since, nothing gained or lost, one point', () => {
  const f = sampleFacts('lumen')
  assert.equal(f.scans, 1)
  assert.equal(f.compared, false)
  assert.equal(f.since, null)
  assert.deepEqual([f.gained, f.lost], [[], []])
  assert.equal(f.points.length, 1)
  assert.equal(sampleFacts('foa', 1).scans, 1, 'any brand can be asked for its single-sync facts')
})
