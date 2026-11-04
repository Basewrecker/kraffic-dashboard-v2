// Run with: npm test. The Sentiment page's numbers (the app's lib/sentiment-adapter.js pure logic, same names): the
// 0–100 score, percentages that add up to 100, run deltas, the per-engine roll-up (Google search, ChatGPT, Claude only),
// the SWOT groups and the pages list's sort; and the mock data, in the shape the app's adapter returns.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PAGES, RUNS, SWOT, runPages, sentimentFor, unscoredNote } from './sentiment.js'
import { byEngine, freshPageIds, heroLine, scoredLine, scoreInfo, countTones, pagesOn, reasonLine, reputationLine, scoreOf, sentimentInsight, shareTrendLine, sortPages, sourceCloud, toneAxis, toneAxisMax, tonePercents, withScores } from './sentiment.js'

const filled = (c) => ({ positive: 0, neutral: 0, mixed: 0, negative: 0, unscored: 0, ...c })

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
  assert.equal(p.positive + p.neutral + p.mixed + p.negative, 100)
  assert.deepEqual(p, { positive: 24, neutral: 67, mixed: 0, negative: 9 })
  assert.deepEqual(tonePercents({ positive: 0, neutral: 0, negative: 0 }), { positive: 0, neutral: 0, mixed: 0, negative: 0 })
})

test('the mock pages match the latest run, and each run has a change vs the one before', () => {
  assert.deepEqual(countTones(PAGES), filled(RUNS.at(-1).counts))
  const runs = withScores(RUNS)
  assert.equal(runs[0].delta, null)
  assert.equal(runs.at(-1).score, 60)
  assert.equal(runs.at(-1).delta, runs.at(-1).score - runs.at(-2).score)
})

test('engine filter and per-engine rows', () => {
  const engines = [{ id: 'google', name: 'Google search' }, { id: 'claude', name: 'Claude' }, { id: 'grok', name: 'Grok' }]
  const rows = byEngine(PAGES, engines)
  assert.deepEqual(rows.map((r) => r.id), ['google', 'claude']) // no pages on Grok: no row
  for (const r of rows) assert.equal(r.pages, r.counts.positive + r.counts.neutral + r.counts.mixed + r.counts.negative + r.counts.unscored)
  assert.equal(pagesOn(PAGES, 'all').length, PAGES.length)
  assert.ok(pagesOn(PAGES, 'claude').every((p) => p.engines.includes('claude')))
})

test('engines: Google AI Overview, Google AI Mode, ChatGPT and Claude (what production splits by)', () => {
  const ids = new Set(PAGES.flatMap((p) => p.engines))
  assert.deepEqual([...ids].sort(), ['aimode', 'chatgpt', 'claude', 'google'])
})

test('themes: the four SWOT groups, each with themes', () => {
  assert.deepEqual(Object.keys(SWOT), ['strengths', 'weaknesses', 'opportunities', 'threats'])
  for (const k of Object.keys(SWOT)) assert.ok(SWOT[k].length > 0 && SWOT[k].every((t) => t.theme), k)
})

test('a past run: its own stored pages and tone counts', () => {
  for (const r of RUNS) assert.deepEqual(countTones(runPages(PAGES, r.counts, r.id)), filled(r.counts), r.date)
  assert.equal(runPages(PAGES, RUNS[0].counts, RUNS[0].id).length, 20)
  assert.deepEqual(runPages(PAGES, RUNS.at(-1).counts, RUNS.at(-1).id), PAGES)
  assert.deepEqual(runPages(PAGES, {}, 'no-such-run'), [])
  // a page a run calls negative has a negative quote to show; a mixed page has both sides
  for (const r of RUNS) {
    for (const p of runPages(PAGES, r.counts, r.id)) {
      if (p.tone === 'negative') assert.ok(p.sentences.some((x) => x.tone === 'negative'), `${r.date} ${p.domain}`)
      if (p.tone === 'mixed') assert.ok(['positive', 'negative'].every((t) => p.sentences.some((x) => x.tone === t)), `${r.date} ${p.domain}`)
    }
  }
})

test('hero line', () => {
  // score bands (app, 2026-10-30; 2026-11-02 the middle band reads Balanced): 80–100 Very positive · 60–79 Mostly positive · 41–59 Balanced · 21–40 Mostly negative · 0–20 Very negative
  const bands = [[100, 'Very positive'], [80, 'Very positive'], [79, 'Mostly positive'], [60, 'Mostly positive'],
    [59, 'Balanced'], [41, 'Balanced'], [40, 'Mostly negative'], [21, 'Mostly negative'],
    [20, 'Very negative'], [0, 'Very negative']]
  for (const [s, line] of bands) assert.equal(heroLine(s), line, String(s))
  assert.equal(heroLine(null), 'No pages scored yet')
  assert.equal(heroLine(scoreOf({ positive: 5, neutral: 14, negative: 2 })), 'Balanced')
  assert.equal(scoredLine({ positive: 21 }), 'Scored 21 pages.')
  assert.equal(scoredLine({ positive: 1 }), 'Scored 1 page.')
  const neutral = { positive: 0, neutral: 17, negative: 0 }
  assert.equal(scoreOf({ positive: 1, neutral: 20, negative: 0 }), 52)
  assert.equal(scoreOf(neutral), 50)
  assert.equal(heroLine(50, neutral), 'Neutral')
  assert.equal(heroLine(50, { positive: 3, neutral: 0, negative: 3 }), 'Balanced')
  assert.equal(scoredLine(neutral), 'Scored 17 pages.')
  assert.match(scoreInfo(neutral), /not a confidence level/)
  assert.equal(scoredLine({ ...neutral, unscored: 2 }), 'Scored 17 of 19 pages.')
  assert.match(scoreInfo({ ...neutral, unscored: 2 }), /2 pages were not scored/)
})

test('a score of 50 after 52 is not positive coverage falling when every page is neutral', () => {
  const prev = { positive: 1, neutral: 20, negative: 0 }
  const next = { positive: 0, neutral: 17, negative: 0 }
  assert.equal(reputationLine(prev, next, 'Oct 27'), 'Neutral since Oct 27')
  assert.equal(reputationLine(null, next, 'Oct 27'), 'First run')
  assert.equal(reputationLine({ positive: 0, neutral: 10, negative: 0 }, { positive: 0, neutral: 8, negative: 2 }, 'Oct 27', { toPositive: 0, toNegative: 1 }), 'Moving negative since Oct 27')
  assert.equal(reputationLine({ positive: 1, neutral: 10, negative: 0 }, { positive: 3, neutral: 10, negative: 0 }, 'Oct 27', { toPositive: 2, toNegative: 0 }), 'Moving positive since Oct 27')
  assert.equal(reputationLine(prev, { positive: 5, neutral: 14, negative: 2 }, 'Oct 27', { toPositive: 0, toNegative: 0 }), 'No change since Oct 27')
  const line = reasonLine({ counts: next, since: 'Oct 27', brand: 'Finance of America', changes: [], gone: 3 })
  assert.match(line, /Still neutral since Oct 27/)
  assert.match(line, /No cited page turned positive or negative/)
  assert.match(line, /3 pages are no longer cited/)
  assert.doesNotMatch(line, /positive coverage|▼|fell/)
  const named = reasonLine({ counts: next, since: 'Oct 27', brand: 'Finance of America', changes: [], gone: 13, gonePages: [{ domain: 'bankrate.com', tone: 'positive' }, { domain: 'aol.com', tone: 'neutral' }] })
  assert.match(named, /bankrate.com was positive on Oct 27 and is no longer cited/)
  assert.match(named, /did not turn negative/)
  assert.match(named, /Still neutral/)
  const turned = reasonLine({ counts: { positive: 0, neutral: 8, negative: 2 }, since: 'Oct 27', brand: 'Finance of America', changes: [{ page: { domain: 'bankrate.com', sentences: [{ text: 'Rates look worse.', tone: 'negative' }] }, from: 'neutral', to: 'negative' }] })
  assert.match(turned, /bankrate.com turned negative/)
  assert.match(turned, /Rates look worse/)
  const steady = reasonLine({ counts: { positive: 1, neutral: 8, negative: 1 }, since: 'Oct 27', brand: 'Finance of America', changes: [], negative: { domain: 'nerdwallet.com', sentences: [{ text: 'Fees are high.', tone: 'negative' }] } })
  assert.match(steady, /nerdwallet.com is negative/)
  assert.match(steady, /Fees are high/)
})

test('over time compares each sync by share, not by how many pages were cited', () => {
  const cols = [
    { counts: { positive: 1, neutral: 20, negative: 0 } },
    { counts: { positive: 0, neutral: 17, negative: 0 } },
    { counts: { positive: 0, neutral: 22, negative: 0 } },
  ]
  assert.deepEqual(cols.map((c) => tonePercents(c.counts)), [
    { positive: 5, neutral: 95, mixed: 0, negative: 0 },
    { positive: 0, neutral: 100, mixed: 0, negative: 0 },
    { positive: 0, neutral: 100, mixed: 0, negative: 0 },
  ])
  assert.equal(shareTrendLine(cols), 'Share of scored pages in each sync. Positive 5% → 0% → 0% · Neutral 95% → 100% → 100% · Mixed 0% → 0% → 0% · Negative 0% → 0% → 0%.')
  assert.equal(shareTrendLine(cols, 'positive'), 'Positive 5% → 0% → 0%')
  assert.equal(shareTrendLine(cols.slice(0, 1)), null)
  assert.equal(toneAxisMax([5, 0, 0]), 10)
  assert.equal(toneAxisMax([95, 100, 100]), 100)
  assert.deepEqual(toneAxis([95, 100, 100]), { min: 90, max: 100, ticks: [90, 95, 100] })
  assert.deepEqual(toneAxis([5, 0, 0]), { min: 0, max: 10, ticks: [0, 5, 10] })
  assert.deepEqual(toneAxis([5, 0, 0], { locked: true }), { min: 0, max: 100, ticks: [0, 50, 100] })
})

test('a url is new only on the first sync it appears', () => {
  const cols = [
    { pages: [{ id: 'a' }, { id: 'b' }] },
    { pages: [{ id: 'a' }, { id: 'c' }] },
    { pages: [{ id: 'b' }, { id: 'c' }, { id: 'd' }] },
  ]
  assert.deepEqual([...freshPageIds(cols, 0)], ['a', 'b'])
  assert.deepEqual([...freshPageIds(cols, 1)], ['c'])
  assert.deepEqual([...freshPageIds(cols, 2)], ['d'])
  assert.equal(freshPageIds(cols, 1).has('a'), false)
})

test('source cloud is history, and a source that is only neutral is left out', () => {
  const cols = [
    { date: '2026-10-27', pages: [
      { id: 'a', domain: 'bankrate.com', url: 'https://bankrate.com/a', title: 'A', tone: 'positive' },
      { id: 'f', domain: 'finder.com', url: 'https://finder.com/a', title: 'F', tone: 'neutral' },
    ] },
    { date: '2026-10-28', pages: [
      { id: 'a', domain: 'bankrate.com', url: 'https://bankrate.com/a', title: 'A', tone: 'positive' },
      { id: 'b', domain: 'nerdwallet.com', url: 'https://nerdwallet.com/b', title: 'B', tone: 'negative' },
    ] },
    { date: '2026-10-31', pages: [
      { id: 'f', domain: 'finder.com', url: 'https://finder.com/a', title: 'F', tone: 'neutral' },
    ] },
  ]
  const cloud = sourceCloud(cols)
  assert.deepEqual(cloud.map((s) => s.domain), ['bankrate.com', 'nerdwallet.com'])
  assert.equal(cloud[0].positive, 2)
  assert.equal(cloud[0].weight, 2)
  assert.equal(cloud[0].lean, 'positive')
  assert.equal(cloud[0].hits.length, 2)
  assert.equal(cloud[1].lean, 'negative')
  assert.equal(cloud[1].hits[0].date, '2026-10-28')
  assert.equal(sourceCloud([]).length, 0)
  const mixed = sourceCloud([
    { date: '2026-10-27', pages: [{ id: 'm', domain: 'example.com', url: 'https://example.com/a', title: 'A', tone: 'positive' }] },
    { date: '2026-10-28', pages: [{ id: 'm', domain: 'example.com', url: 'https://example.com/a', title: 'A', tone: 'negative' }] },
  ])
  assert.equal(mixed[0].lean, 'mixed')
  assert.equal(mixed[0].weight, 2)
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
  assert.equal(sentimentInsight({ positive: 0, neutral: 21, negative: 0 }, 'Dermasuri'), '0 positive, 21 neutral, 0 mixed, 0 negative, out of 21 scored pages about Dermasuri.')
  assert.equal(sentimentInsight({ positive: 1, neutral: 2, negative: 5 }, 'Dermasuri'), '1 positive, 2 neutral, 0 mixed, 5 negative, out of 8 scored pages about Dermasuri.')
  assert.equal(sentimentInsight({ positive: 5, neutral: 14, negative: 2 }, 'Dermasuri'), '5 positive, 14 neutral, 0 mixed, 2 negative, out of 21 scored pages about Dermasuri.')
  assert.equal(sentimentInsight({ positive: 6, neutral: 2, negative: 1 }, 'Dermasuri'), '6 positive, 2 neutral, 0 mixed, 1 negative, out of 9 scored pages about Dermasuri.')
  // no informal phrasing left
  for (const c of [{ positive: 0, neutral: 21, negative: 0 }, { positive: 1, neutral: 2, negative: 5 }, { positive: 6, neutral: 2, negative: 1 }]) assert.doesNotMatch(sentimentInsight(c, 'X'), /speak|badly|well of/)
  assert.equal(sentimentInsight({ positive: 0, neutral: 0, negative: 0 }, 'Dermasuri'), null)
})

// ---- the mock data: the app adapter's shape, and every state the page draws ----------------------------------------
const TONE_SET = new Set(['positive', 'neutral', 'mixed', 'negative', 'unscored'])

test('data shape: runs { id, createdAt, date, counts } oldest first; pages and themes as the app adapter returns them', () => {
  assert.ok(RUNS.length >= 6, 'several syncs (Over time, Compare, the score change)')
  for (const [i, r] of RUNS.entries()) {
    assert.deepEqual(Object.keys(r).sort(), ['counts', 'createdAt', 'date', 'id'])
    assert.equal(r.date, r.createdAt.slice(0, 10))
    assert.deepEqual(Object.keys(r.counts).sort(), ['mixed', 'negative', 'neutral', 'positive', 'unscored'])
    if (i) assert.ok(r.createdAt > RUNS[i - 1].createdAt, 'oldest → newest')
  }
  for (const r of RUNS) {
    const pages = runPages(PAGES, r.counts, r.id)
    assert.equal(new Set(pages.map((p) => p.id)).size, pages.length, `${r.date}: one row per page`)
    for (const p of pages) {
      assert.deepEqual(Object.keys(p).sort(), ['domain', 'engines', 'id', 'noQuote', 'path', 'sentences', 'title', 'tone', 'url'])
      assert.ok(TONE_SET.has(p.tone), p.tone)
      assert.equal(p.noQuote, !p.sentences.length)
      for (const q of p.sentences) assert.deepEqual(Object.keys(q).sort(), ['mark', 'text', 'tone'])
    }
  }
  assert.deepEqual(Object.keys(SWOT), ['strengths', 'weaknesses', 'opportunities', 'threats'])
  const ids = new Set(PAGES.map((p) => p.id))
  for (const t of Object.values(SWOT).flat()) {
    assert.deepEqual(Object.keys(t).sort(), ['evidence', 'match', 'sources', 'theme'])
    assert.ok(t.sources.every((id) => ids.has(id)), `${t.theme}: its pages are in the latest run`)
  }
  assert.deepEqual(sentimentFor('a.com', 'a.com'), { runs: RUNS, pages: PAGES, swot: SWOT })
  assert.deepEqual(sentimentFor('b.com', 'a.com'), { runs: [], pages: [], swot: null }, 'a brand never analysed: the empty state')
})

test('the mock covers every tone, the scoring change, new and dropped pages, and every engine', () => {
  const latest = filled(RUNS.at(-1).counts)
  for (const t of ['positive', 'neutral', 'mixed', 'negative', 'unscored']) assert.ok(latest[t] > 0, `the latest run has ${t} pages`)
  assert.equal(unscoredNote(latest), '2 pages not scored')
  // runs before and after the Nov 2 scoring change (Mixed and Not scored only after it)
  const cut = '2026-11-02T08:35:42Z'
  const before = RUNS.filter((r) => r.createdAt < cut)
  const after = RUNS.filter((r) => r.createdAt >= cut)
  assert.ok(before.length >= 2 && after.length >= 2)
  for (const r of before) assert.equal(r.counts.mixed + r.counts.unscored, 0, `${r.date} was scored the old way`)
  // pages that join (New) and pages that leave (dropped) between runs
  const ids = RUNS.map((r) => new Set(runPages(PAGES, r.counts, r.id).map((p) => p.id)))
  assert.ok(ids.some((s, i) => i && [...s].some((id) => !ids.slice(0, i).some((b) => b.has(id)))), 'a page new in a later run')
  assert.ok(ids.some((s, i) => i && [...ids[i - 1]].some((id) => !s.has(id))), 'a page dropped in a later run')
  // the score moves up, down and not at all between runs (the arrow and the "since …" line)
  const scores = withScores(RUNS).map((r) => r.delta).filter((d) => d != null)
  assert.ok(scores.some((d) => d > 0) && scores.some((d) => d < 0) && scores.some((d) => d === 0))
  assert.deepEqual([...new Set(PAGES.flatMap((p) => p.engines))].sort(), ['aimode', 'chatgpt', 'claude', 'google'])
  assert.ok(PAGES.some((p) => p.url === null), 'a page with no stored URL (no link)')
  assert.ok(PAGES.some((p) => p.noQuote), 'a page with no quote')
})
