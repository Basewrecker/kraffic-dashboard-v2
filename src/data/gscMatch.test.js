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

test('best query: the highest adjusted × log10(impressions + 1), only with ≥ 10 impressions', () => {
  const a = analyzeRows('niacinamide serum dry skin', [
    ROW('niacinamide serum dry skin routine', 9), // a full match, but too few impressions to be best
    ROW('niacinamide serum', 900, 'https://ex.com/b/'),
    ROW('niacinamide', 2000, 'https://ex.com/c/'),
  ], { suggestedPath: '/x' })
  assert.ok(a.bestQuery.impressions >= BEST_MIN_IMPRESSIONS)
  const score = (q) => q.adjusted * Math.log10(q.impressions + 1)
  for (const q of a.queries.filter((x) => x.impressions >= BEST_MIN_IMPRESSIONS)) assert.ok(score(a.bestQuery) >= score(q))
  assert.equal(a.queries.filter((q) => q.best).length, 1)
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
  assert.equal(r.bestQuery.query, 'reverse mortgage line of credit')
  assert.equal(r.publishOn.path, '/learn/reverse-mortgage-line-of-credit')
  assert.match(r.siteUrl, /harborlinehome\.com/)
  assert.ok(!JSON.stringify(r).includes('example-lender'))
  assert.deepEqual(bestPageFor(RM_ROW, { state: 'connected' }), { prompt: RM_ROW.prompt, action: 'update', path: '/learn/reverse-mortgage-line-of-credit', url: r.publishOn.url, match: 60, query: 'reverse mortgage line of credit' })
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

test('the best query follows the prompt\'s intent (PROPOSED rule): a clashing kind is ×0.7 and never Best while one that fits exists', async () => {
  const { MISFIT, intentFits, searchKind } = await import('./gscMatch.js')
  assert.equal(searchKind('how to use tinted sunscreen in a routine'), 'question')
  assert.equal(searchKind('best face mist for dry skin'), 'compare')
  assert.equal(searchKind('tinted sunscreen price'), 'shop')
  assert.equal(intentFits('how to use tinted sunscreen in a routine', 'tinted sunscreen deal'), false)
  assert.equal(intentFits('best face mist for dry skin', 'how to apply face mist'), false)
  assert.equal(intentFits('best face mist for dry skin', 'face mist'), true)
  // a question prompt: the busy shopping query clashes, scored ×0.7, and the how-to query is Best
  const a = analyzeRows('how to use tinted sunscreen in a routine', [
    ROW('buy tinted sunscreen deal', 9000, 'https://ex.com/products/tinted/'),
    ROW('how to use tinted sunscreen', 300, 'https://ex.com/blog/tinted-routine/'),
    ROW('tinted sunscreen', 4000, 'https://ex.com/products/tinted/'),
  ], { suggestedPath: '/x' })
  const shop = a.queries.find((q) => q.query === 'buy tinted sunscreen deal')
  assert.equal(shop.intentFit, false)
  assert.equal(shop.adjusted, Math.round(shop.match * MISFIT))
  assert.equal(a.bestQuery.query, 'how to use tinted sunscreen', 'the prompt\'s own kind wins when it matches well')
  assert.equal(a.publishOn.path, '/blog/tinted-routine')
  // the sample: every question / comparison prompt with a page to update has a best query of its own kind
  for (const r of missedPrompts) {
    const g = gscMatchFor(r, { state: 'connected' })
    const kind = searchKind(r.prompt)
    if (!kind || g.publishOn.action !== 'update') continue
    assert.equal(searchKind(g.bestQuery.query), kind, `${r.prompt} → ${g.bestQuery.query}`)
  }
})
