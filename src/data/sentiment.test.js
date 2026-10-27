// Run with: npm test. The Sentiment page's numbers: the 0–100 score, percentages that add up to 100, run deltas,
// the per-engine roll-up (Google search, ChatGPT, Claude only), the SWOT groups and the pages list's sort.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PAGES, RUNS, SWOT, byEngine, countTones, pagesOn, scoreOf, sentimentInsight, sortPages, tonePercents, withScores } from './sentiment.js'

test('score: 0 all negative, 50 even or all neutral, 100 all positive, null with no pages', () => {
  assert.equal(scoreOf({ positive: 0, neutral: 0, negative: 4 }), 0)
  assert.equal(scoreOf({ positive: 0, neutral: 21, negative: 0 }), 50)
  assert.equal(scoreOf({ positive: 3, neutral: 0, negative: 3 }), 50)
  assert.equal(scoreOf({ positive: 7, neutral: 0, negative: 0 }), 100)
  assert.equal(scoreOf({ positive: 0, neutral: 0, negative: 0 }), null)
})

test('percentages always add up to 100', () => {
  const c = { positive: 5, neutral: 14, negative: 2 } // 23.8 / 66.7 / 9.5 → rounding each gives 101
  const p = tonePercents(c)
  assert.equal(p.positive + p.neutral + p.negative, 100)
  assert.deepEqual(p, { positive: 24, neutral: 67, negative: 9 })
  assert.deepEqual(tonePercents({ positive: 0, neutral: 0, negative: 0 }), { positive: 0, neutral: 0, negative: 0 })
})

test('the mock pages match the latest run, and each run has a change vs the one before', () => {
  assert.deepEqual(countTones(PAGES), RUNS.at(-1).counts)
  const runs = withScores(RUNS)
  assert.equal(runs[0].delta, null)
  assert.equal(runs.at(-1).score, 57)
  assert.equal(runs.at(-1).delta, runs.at(-1).score - runs.at(-2).score)
})

test('engine filter and per-engine rows', () => {
  const engines = [{ id: 'google', name: 'Google search' }, { id: 'claude', name: 'Claude' }, { id: 'grok', name: 'Grok' }]
  const rows = byEngine(PAGES, engines)
  assert.deepEqual(rows.map((r) => r.id), ['google', 'claude']) // no pages on Grok: no row
  for (const r of rows) assert.equal(r.pages, r.counts.positive + r.counts.neutral + r.counts.negative)
  assert.equal(pagesOn(PAGES, 'all').length, PAGES.length)
  assert.ok(pagesOn(PAGES, 'claude').every((p) => p.engines.includes('claude')))
})

test('engines: only Google search, ChatGPT and Claude (what production splits by)', () => {
  const ids = new Set(PAGES.flatMap((p) => p.engines))
  assert.deepEqual([...ids].sort(), ['chatgpt', 'claude', 'google'])
})

test('themes: the four SWOT groups, each with something in it', () => {
  assert.deepEqual(Object.keys(SWOT), ['strengths', 'weaknesses', 'opportunities', 'threats'])
  for (const k of Object.keys(SWOT)) assert.ok(SWOT[k].length > 0, k)
})

test('sort: negative first by default, then by title; descending flips it', () => {
  const s = sortPages(PAGES)
  assert.equal(s[0].tone, 'negative')
  assert.equal(s.at(-1).tone, 'positive')
  assert.equal(sortPages(PAGES, 'tone', 'desc')[0].tone, 'positive')
  const byEngines = sortPages(PAGES, 'engines', 'desc')
  assert.ok(byEngines[0].engines.length >= byEngines.at(-1).engines.length)
})

test('insight line', () => {
  assert.match(sentimentInsight({ positive: 0, neutral: 21, negative: 0 }, 'Dermasuri'), /^All 21 pages are neutral/)
  assert.match(sentimentInsight({ positive: 1, neutral: 2, negative: 5 }, 'Dermasuri'), /badly/)
  assert.equal(sentimentInsight({ positive: 0, neutral: 0, negative: 0 }, 'Dermasuri'), null)
})
