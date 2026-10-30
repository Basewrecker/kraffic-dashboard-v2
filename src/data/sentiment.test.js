// Run with: npm test. The Sentiment page's numbers: the 0–100 score, percentages that add up to 100, run deltas,
// the per-engine roll-up (Google search, ChatGPT, Claude only), the SWOT groups and the pages list's sort.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PAGES, RUNS, SWOT, byEngine, heroLine, heroNote, runPages, countTones, pagesOn, scoreOf, sentimentInsight, sortPages, tonePercents, withScores } from './sentiment.js'

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

test('themes: the four SWOT groups, each with themes', () => {
  assert.deepEqual(Object.keys(SWOT), ['strengths', 'weaknesses', 'opportunities', 'threats'])
  for (const k of Object.keys(SWOT)) assert.ok(SWOT[k].length > 0 && SWOT[k].every((t) => t.theme), k)
})

test('a past run: its own number of pages and tone counts', () => {
  for (const r of RUNS) assert.deepEqual(countTones(runPages(PAGES, r.counts, r.id)), r.counts, r.date)
  assert.equal(runPages(PAGES, RUNS[0].counts).length, 17)
  // a page a past run calls negative has a negative quote to show
  for (const r of RUNS) for (const p of runPages(PAGES, r.counts, r.id)) if (p.tone === 'negative') assert.ok(p.sentences.some((x) => x.tone === 'negative'), `${r.date} ${p.domain}`)
})

test('hero line', () => {
  // score bands: 70–100 · 55–69 · 45–54 · 31–44 · 0–30
  const bands = [[100, 'Mostly positive coverage'], [70, 'Mostly positive coverage'], [69, 'Leaning positive'], [55, 'Leaning positive'],
    [54, 'Balanced: as much praise as criticism'], [45, 'Balanced: as much praise as criticism'], [44, 'Leaning negative'], [31, 'Leaning negative'],
    [30, 'Mostly negative coverage'], [0, 'Mostly negative coverage']]
  for (const [s, line] of bands) assert.equal(heroLine(s), line, String(s))
  assert.equal(heroLine(null), 'No pages scored yet')
  assert.equal(heroLine(scoreOf({ positive: 5, neutral: 14, negative: 2 })), 'Leaning positive')
  assert.equal(heroNote(21, 'Dermasuri'), 'Based on how the 21 pages AI cites describe Dermasuri. 50 means positive and negative mentions are even.')
  assert.equal(heroNote(1, 'Dermasuri'), 'Based on how the page AI cites describes Dermasuri. 50 means positive and negative mentions are even.')
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
  assert.equal(sentimentInsight({ positive: 0, neutral: 21, negative: 0 }, 'Dermasuri'), 'All 21 pages describe Dermasuri neutrally, with no praise or criticism.')
  assert.equal(sentimentInsight({ positive: 1, neutral: 2, negative: 5 }, 'Dermasuri'), 'Coverage leans negative: 62% of pages are critical of Dermasuri.')
  assert.equal(sentimentInsight({ positive: 5, neutral: 14, negative: 2 }, 'Dermasuri'), 'Most pages describe Dermasuri neutrally; those that take a position lean positive.')
  assert.equal(sentimentInsight({ positive: 6, neutral: 2, negative: 1 }, 'Dermasuri'), 'Coverage leans positive: 67% of pages are favourable to Dermasuri.')
  // no informal phrasing left
  for (const c of [{ positive: 0, neutral: 21, negative: 0 }, { positive: 1, neutral: 2, negative: 5 }, { positive: 6, neutral: 2, negative: 1 }]) assert.doesNotMatch(sentimentInsight(c, 'X'), /speak|badly|well of/)
  assert.equal(sentimentInsight({ positive: 0, neutral: 0, negative: 0 }, 'Dermasuri'), null)
})
