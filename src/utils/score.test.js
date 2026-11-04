// An engine whose latest scan didn't answer has no score: null, shown as "—", never 0 (CLAUDE.md §3, DESIGN.md §7).
// Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { NO_SCORE, fmtScore, isScore, noResultText } from './score.js'
import { changeParts, pointsBetween, withSyncChanges } from './syncChange.js'
import { ENGINES, TRACKED_BRANDS, engineGaps, getBrandView, setNoResult } from '../data/brandViews.js'
import { getHistory } from '../data/mock.js'

test('fmtScore: no score is "—", never "0"', () => {
  for (const v of [null, undefined, NaN, Infinity, '73']) {
    assert.equal(fmtScore(v), '—')
    assert.equal(fmtScore(v, '%'), '—')
    assert.notEqual(fmtScore(v), '0')
    assert.equal(isScore(v), false)
  }
  assert.equal(NO_SCORE, '—')
  // a real 0 is still 0
  assert.equal(fmtScore(0), '0')
  assert.equal(fmtScore(0, '%'), '0%')
  assert.equal(fmtScore(73, '%'), '73%')
  assert.equal(fmtScore(72.6), '73')
  assert.equal(isScore(0), true)
})

test('the ⓘ names the engine', () => {
  assert.equal(noResultText('gemini'), 'No result from Gemini in the latest scan')
  assert.equal(noResultText('aio'), `No result from ${ENGINES.find((e) => e.id === 'aio').name} in the latest scan`)
})

test('no change line when either score is missing', () => {
  assert.equal(changeParts(pointsBetween(null, 66), 10), null)
  assert.equal(changeParts(pointsBetween(73, null)), null)
  assert.equal(changeParts(pointsBetween(undefined, NaN)), null)
  assert.equal(changeParts(null, 4), null)
  // a missing latest row: the card has no delta and no prompts change
  const v = withSyncChanges({ kpis: { score: null }, syncHistory: [{ visibility: null, changes: null }, { visibility: 66 }] })
  assert.equal(v.kpis.scoreDelta, null)
  assert.equal(v.kpis.netPrompts, null)
  assert.equal(v.syncHistory[0].delta, null)
})

test('?noresult=gemini: Gemini\'s score is null on every brand, and nothing else moves', () => {
  setNoResult([])
  const before = Object.fromEntries(TRACKED_BRANDS.flatMap((b) => ['all', ...ENGINES.map((e) => e.id)].map((e) => [`${b.domain}|${e}`, getBrandView(b.domain, e)])))
  setNoResult(['gemini'])
  try {
    for (const b of TRACKED_BRANDS) {
      const g = withSyncChanges(getBrandView(b.domain, 'gemini'))
      assert.equal(g.kpis.score, null, `${b.name}: Gemini's score`)
      assert.equal(g.kpis.scoreDelta, null, `${b.name}: no change line`)
      for (const k of ['visible', 'missed', 'citedSources']) assert.equal(g.kpis[k], null, `${b.name}: ${k}`)
      assert.equal(g.syncHistory[0].visibility, null, `${b.name}: the latest sync row`)
      assert.equal(g.syncHistory[0].delta, null)
      // the syncs before it keep their scores
      assert.deepEqual(g.syncHistory.slice(1).map((r) => r.visibility), before[`${b.domain}|gemini`].syncHistory.slice(1).map((r) => r.visibility))
      // the All-engines score is the same number as before (it averages only the engines that answered)
      assert.equal(getBrandView(b.domain, 'all').kpis.score, before[`${b.domain}|all`].kpis.score, `${b.name}: All engines`)
      // the other engines are unchanged
      for (const e of ENGINES.filter((x) => x.id !== 'gemini')) assert.deepEqual(getBrandView(b.domain, e.id).kpis, before[`${b.domain}|${e.id}`].kpis)
    }
    assert.equal(getBrandView(TRACKED_BRANDS[0].domain, 'all').kpis.score, 73)
  } finally {
    setNoResult(undefined)
  }
})

test('the history chart leaves a gap for the latest scan with no result, never a drop to 0', () => {
  setNoResult(['gemini'])
  try {
    const gaps = engineGaps('gemini')
    assert.equal(gaps.length, 1)
    const scale = { dermasuri: 0.8, cerave: 0.5, ordinary: 0.5, paulas: 0.5 }
    for (const granularity of ['weekly', 'monthly']) {
      const h = getHistory({ granularity, scale, gaps })
      const plain = getHistory({ granularity, scale })
      const last = h.points.at(-1)
      for (const s of h.series) assert.equal(last[s.key], null, `${granularity}: ${s.key} on the latest point`)
      assert.equal(h.stats.current, null)
      assert.equal(h.stats.change, null)
      assert.equal(last.delta, null)
      // the points before it are untouched
      assert.deepEqual(h.points.slice(0, -1).map((p) => p.dermasuri), plain.points.slice(0, -1).map((p) => p.dermasuri))
    }
    assert.deepEqual(engineGaps('chatgpt'), [])
    assert.deepEqual(engineGaps('all'), [])
  } finally {
    setNoResult(undefined)
  }
})
