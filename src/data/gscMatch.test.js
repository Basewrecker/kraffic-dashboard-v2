// Run with: npm test. The Search Console match sample (data/gscMatch.js): the app's lib/gsc-match.js shapes and rules.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { missedPrompts } from './mock.js'
import { RM_ROW } from './contentRecommendRm.js'
import { BEST_MIN_IMPRESSIONS, CREATE_BELOW, analyzeRows, bestPageFor, gscMatchFor, intentOf, matchOf } from './gscMatch.js'

const ROW = (keyword, impressions, url = 'https://ex.com/a/', position = 10) => ({ keyword, impressions, clicks: Math.round(impressions / 50), position, url })

test('the route response has the app\'s fields and units', () => {
  const r = gscMatchFor(missedPrompts[1], { state: 'connected' })
  for (const k of ['connected', 'siteUrl', 'range', 'fetchedAt', 'lagNote', 'cached', 'totals', 'weeks', 'prompt', 'terms', 'queries', 'matchingQueries', 'bestQuery', 'publishOn', 'topQueryPages', 'pages']) assert.ok(k in r, k)
  assert.equal(r.lagNote, 'Search Console data is about 2 days behind.')
  for (const q of r.queries) {
    assert.ok(Number.isInteger(q.match) && q.match >= 0 && q.match <= 100)
    assert.ok(Number.isInteger(q.adjusted))
    assert.ok(q.topPage.share > 0 && q.topPage.share <= 1)
    assert.ok([null, 'account', 'local'].includes(q.intent))
  }
  for (const p of r.pages) assert.ok(Number.isInteger(p.score) && p.score <= 100 && typeof p.position === 'number')
  assert.ok(r.queries.length <= 5)
})

test('intent: account and local queries are tagged and scored at half', () => {
  assert.equal(intentOf('my dermasuri serum order'), 'account')
  assert.equal(intentOf('reverse mortgage statement login'), 'account')
  assert.equal(intentOf('serum near me'), 'local')
  assert.equal(intentOf('dermatologist houston'), 'local')
  assert.equal(intentOf('best niacinamide serum'), null)
  const a = analyzeRows('niacinamide serum dry skin', [ROW('niacinamide serum near me', 300)], { suggestedPath: '/x' })
  assert.equal(a.queries[0].adjusted, Math.round(a.queries[0].match * 0.5))
})

test('best query: an intent match with ≥ 10 impressions, the highest adjusted × log10(impressions + 1); none → no Best', () => {
  // topic: niacinamide, serum (in most queries); intent: dry, skin
  const a = analyzeRows('niacinamide serum dry skin', [
    ROW('niacinamide serum dry skin routine', 9), // the only intent match, too few impressions
    ROW('niacinamide serum', 900, 'https://ex.com/b/'),
    ROW('niacinamide', 2000, 'https://ex.com/c/'),
  ], { suggestedPath: '/x' })
  assert.equal(a.bestQuery, null, 'never a topic-only Best')
  const b = analyzeRows('niacinamide serum dry skin', [
    ROW('niacinamide serum for dry skin', 40), ROW('niacinamide serum dry skin review', 30), ROW('niacinamide serum', 900, 'https://ex.com/b/'), ROW('niacinamide', 2000, 'https://ex.com/c/'),
  ], { suggestedPath: '/x' })
  const score = (q) => q.adjusted * Math.log10(q.impressions + 1)
  assert.equal(b.bestQuery.intentMatch, true)
  for (const q of b.queries.filter((x) => x.intentMatch && x.impressions >= BEST_MIN_IMPRESSIONS)) assert.ok(score(b.bestQuery) >= score(q))
  assert.equal(b.queries.filter((q) => q.best).length, 1)
})

test('publish on: update the best query\'s page; create (with the suggested path) when the best match is under 30', () => {
  const up = analyzeRows('niacinamide serum dry skin', [ROW('niacinamide serum dry skin', 500, 'https://ex.com/serum/'), ROW('niacinamide serum for dry skin reviews', 200, 'https://ex.com/serum/')], { suggestedPath: '/new' })
  assert.equal(up.publishOn.action, 'update')
  assert.equal(up.publishOn.path, '/serum')
  assert.equal(up.publishOn.reason, 'several-queries')
  const create = analyzeRows('niacinamide serum dry skin', [ROW('gift cards', 900), ROW('niacinamide tips', 40)], { suggestedPath: '/new' })
  assert.ok(!create.bestQuery || create.bestQuery.adjusted < CREATE_BELOW)
  assert.deepEqual(create.publishOn, { action: 'create', suggestedPath: '/new' })
})

test('the sample list: some prompts create a new page, some show account / local queries, the rest update', () => {
  const all = missedPrompts.map((r) => gscMatchFor(r, { state: 'connected' }))
  assert.ok(all.some((a) => a.publishOn.action === 'create'))
  assert.ok(all.some((a) => a.publishOn.action === 'update'))
  assert.ok(all.some((a) => a.queries.some((q) => q.intent === 'account')))
  assert.ok(all.some((a) => a.queries.some((q) => q.intent === 'local')))
  assert.equal(matchOf('kojic acid soap benefits', 'kojic acid soap benefits'), 100)
})

test('rm-1: the app\'s sample chain on the account\'s made-up domain; bestPageFor; the states', () => {
  const r = gscMatchFor(RM_ROW, { state: 'connected' })
  assert.equal(r.bestQuery.query, 'reverse mortgage line of credit growth rate', 'grow = growth: the intent match is Best')
  assert.deepEqual(r.intentTerms, ['grow', 'time'])
  assert.equal(r.queries.at(-1).query, 'reverse mortgage line of credit', 'the topic-only head ranks below the intent matches')
  assert.equal(r.publishOn.path, '/learn/reverse-mortgage-line-of-credit')
  assert.match(r.siteUrl, /harborlinehome\.com/)
  assert.ok(!JSON.stringify(r).includes('example-lender'))
  assert.deepEqual(bestPageFor(RM_ROW, { state: 'connected' }), { prompt: RM_ROW.prompt, action: 'update', path: '/learn/reverse-mortgage-line-of-credit', url: r.publishOn.url, match: 75, query: 'reverse mortgage line of credit growth rate' })
  assert.deepEqual(gscMatchFor(RM_ROW, { state: 'new' }), { connected: false })
  assert.equal(gscMatchFor(RM_ROW, { state: 'reconnect' }).reason, 'reconnect')
  assert.equal(gscMatchFor(RM_ROW, { state: 'no-domain' }).reason, 'no-domain')
  const none = gscMatchFor(RM_ROW, { state: 'no-data' })
  assert.equal(none.connected, true); assert.equal(none.bestQuery, null); assert.equal(none.publishOn.action, 'create')
  assert.equal(bestPageFor(RM_ROW, { state: 'new' }), null)
})

test('site queries (a forum, a store, a competitor by name or domain): tagged "site", scored at half, never the Best query', async () => {
  const { analyzeRows, intentOf, siteRe } = await import('./gscMatch.js')
  const site = siteRe([{ name: 'CeraVe', domain: 'cerave.com' }, { name: 'Paula’s Choice', domain: 'paulaschoice.com' }])
  for (const q of ['face mist reddit', 'face mist amazon', 'cerave face mist', 'paula’s choice face mist', 'quora face mist']) assert.equal(intentOf(q, site), 'site', q)
  assert.equal(intentOf('face mist for dry skin', site), null)
  const url = 'https://dermasuri.com/products/face-mist/'
  const a = analyzeRows('best face mist for dry skin', [
    { keyword: 'face mist dry skin reddit', impressions: 5000, clicks: 50, position: 6, url: 'https://dermasuri.com/blog/reddit-roundup/' },
    { keyword: 'face mist for dry skin', impressions: 400, clicks: 9, position: 12, url },
  ], { suggestedPath: '/x', competitors: [{ name: 'CeraVe', domain: 'cerave.com' }] })
  const r = a.queries.find((q) => q.intent === 'site')
  assert.equal(r.adjusted, Math.round(r.match * 0.5))
  assert.equal(a.bestQuery.query, 'face mist for dry skin', 'the busier site query is never Best')
  assert.equal(a.publishOn.path, '/products/face-mist', 'and never decides where to publish')
})

test('owner\'s intent rule: topic words are in ≥ half the matching queries, the rest are intent words; synonyms count as one', async () => {
  const { canon, intentTerms, intentMatchOf } = await import('./gscMatch.js')
  for (const [a, b] of [['breakouts', 'acne'], ['purging', 'pimples'], ['cost', 'fees'], ['price', 'cost'], ['grow', 'growth'], ['increase', 'grow']]) assert.equal(canon(a), canon(b), `${a} = ${b}`)
  const prompt = 'can pigmentation serum cause breakouts'
  const qs = ['pigmentation serum', 'pigmentation serum benefits', 'does pigmentation serum cause acne', 'best pigmentation serum'].map((query) => ({ query }))
  assert.deepEqual(intentTerms(prompt, qs), ['breakout'], 'pigmentation and serum are topic words')
  assert.equal(intentMatchOf('does pigmentation serum cause acne', ['breakout']), true, 'acne = breakouts')
  assert.equal(intentMatchOf('pigmentation serum', ['breakout']), false)
  // local / account markers are never intent words
  assert.ok(!intentTerms('face mist near me', [{ query: 'face mist' }]).includes('near'))
  // topic-only queries keep their score (no penalty) but rank below every intent match, and are never Best
  const a = analyzeRows(prompt, [
    { keyword: 'pigmentation serum', impressions: 3000, clicks: 60, position: 6, url: 'https://ex.com/a/' },
    { keyword: 'does pigmentation serum cause acne', impressions: 120, clicks: 3, position: 11, url: 'https://ex.com/b/' },
    { keyword: 'pigmentation serum benefits', impressions: 800, clicks: 9, position: 9, url: 'https://ex.com/a/' },
  ], { suggestedPath: '/x' })
  assert.equal(a.bestQuery.query, 'does pigmentation serum cause acne')
  assert.equal(a.queries[0].intentMatch, true)
  assert.ok(a.queries.slice(1).every((q) => !q.intentMatch))
  const topic = a.queries.find((q) => q.query === 'pigmentation serum')
  assert.equal(topic.adjusted, topic.match, 'no penalty on topic-only queries')
})

test('the sample follows the rule: every Best is an intent match; the synonym case shows', () => {
  const all = missedPrompts.map((r) => gscMatchFor(r, { state: 'connected' }))
  for (const a of all) if (a.bestQuery) assert.equal(a.bestQuery.intentMatch, true, a.prompt)
  const p = all.find((a) => /cause breakouts/.test(a.prompt))
  assert.match(p.bestQuery.query, /acne/)
})
