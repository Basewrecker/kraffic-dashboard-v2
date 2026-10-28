import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildReport, dataFor, inferOpts, refine, resolveOpts, savedReports, stepsFor, suggestionsFor } from './reports.js'

const types = (r) => r.blocks.map((b) => b.type)
const block = (r, type) => r.blocks.find((b) => b.type === type)?.data
const sum = (gs) => gs.reduce((a, g) => a + g.n, 0)

test('weekly memo: headline, lede, one hero; no KPI row', () => {
  const r = buildReport({ brand: 'foa', period: 'week', audience: 'team', length: 'one' })
  assert.equal(r.kind, 'weekly')
  assert.deepEqual(types(r), ['headline', 'lede', 'hero', 'where', 'next', 'sources'])
  assert.match(block(r, 'headline').text, /^A good week/)
  // the key numbers live in the lede's sentences
  assert.match(block(r, 'lede').text, /71 of the 113 tracked prompts, up from 67/)
  assert.match(block(r, 'lede').text, /from 28% to 31%/)
})

test('every hero grid accounts for every tracked prompt exactly once', () => {
  for (const [opts, prompt] of [[{ brand: 'foa', period: 'week' }, ''], [{ brand: 'foa', period: 'quarter' }, ''], [{ brand: 'foa', compare: ['longbridge'] }, ''], [{ brand: 'dermasuri' }, ''], [{ brand: 'dermasuri', compare: ['cerave'] }, '']]) {
    const r = buildReport(opts, prompt)
    const h = block(r, 'hero')
    assert.equal(sum(h.groups), dataFor(opts.brand).prompts, JSON.stringify(opts))
    assert.ok(h.groups.every((g) => g.n >= 0))
  }
})

test('the Longbridge memo: grouped by who AI names; where / why / what to do tied to prompts', () => {
  const r = buildReport({ brand: 'foa', period: '30d', length: 'detailed' }, 'Where is Longbridge beating us?')
  assert.equal(r.kind, 'rival')
  assert.match(block(r, 'headline').text, /beats Finance of America on 23 of 113 prompts/)
  assert.deepEqual(block(r, 'hero').groups.map((g) => g.n), [9, 14, 12, 45, 33])
  // the where groups add up to the prompts it wins
  assert.equal(sum(block(r, 'where').groups[0].themes), 23)
  assert.ok(block(r, 'next').items.every((a) => a.about.includes('longbridge') && a.wins.prompts.length > 0))
})

test('an engine that didn’t run is left out and named in the footer, never estimated', () => {
  const r = buildReport({ brand: 'foa', period: 'week', length: 'detailed' })
  assert.ok(block(r, 'engines').rows.every((e) => e.name !== 'Claude'))
  assert.ok(block(r, 'sources').left.some((s) => /Claude/.test(s)))
  const ds = buildReport({ brand: 'dermasuri', engines: ['chatgpt', 'gemini'], length: 'detailed' })
  assert.deepEqual(block(ds, 'engines').rows.map((e) => e.name), ['ChatGPT'])
  assert.ok(block(ds, 'sources').left.some((s) => /Gemini/.test(s)))
})

test('a competitor we hold no breakdown for: the grid only, and the footer says so', () => {
  const r = buildReport({ brand: 'foa', compare: ['rocket'] })
  assert.equal(r.kind, 'rival')
  assert.equal(block(r, 'where'), undefined)
  assert.ok(block(r, 'sources').left.some((s) => /Rocket Mortgage/.test(s)))
})

test('CEO memo: a verdict in the headline, share of voice as the hero, three decisions', () => {
  const r = buildReport({ brand: 'foa', audience: 'ceo', period: '30d' })
  assert.equal(r.kind, 'ceo')
  assert.equal(block(r, 'headline').verdict, 'mostly winning') // Longbridge is ahead on more shared prompts
  assert.equal(block(r, 'hero').kind, 'slope')
  assert.ok(block(r, 'next').items.length <= 3)
  assert.equal(buildReport({ brand: 'foa', audience: 'ceo', compare: ['rocket', 'omaha'] }).blocks[0].data.verdict, 'winning')
})

test('not enough data: fewer than 2 syncs → no report, and why', () => {
  assert.equal(buildReport({ brand: 'northwind-derm' }).ok, false)
  assert.equal(buildReport({ brand: 'northwind-derm' }).syncs, 1)
  assert.equal(buildReport({ brand: 'brightside' }).syncs, 0)
})

test('the question fills chips that are still unset; a set chip wins', () => {
  assert.equal(inferOpts('How did we do this week?').period, 'week')
  assert.deepEqual(inferOpts('Where is Longbridge beating us?', dataFor('foa')).compare, ['longbridge'])
  assert.equal(resolveOpts({ brand: 'foa', period: 'quarter' }, 'how did we do this week').period, 'quarter')
  assert.equal(resolveOpts({ brand: 'foa' }, 'CEO summary').audience, 'ceo')
})

test('a content question leads with what to do', () => {
  const r = buildReport({ brand: 'foa', length: 'detailed' }, 'Which prompts should we write content for next?')
  assert.deepEqual(types(r).slice(0, 3), ['headline', 'lede', 'next'])
})

test('refine: short instructions become a new version; anything else is not understood', () => {
  const o = resolveOpts({ brand: 'foa', length: 'detailed' }, '')
  assert.equal(refine(o, 'make it shorter').opts.length, 'one')
  assert.deepEqual(refine(o, 'focus on Longbridge').opts.compare, ['longbridge'])
  assert.equal(refine(o, 'rewrite for a client').opts.audience, 'client')
  assert.match(refine(o, 'add Gemini').change, /Gemini/)
  assert.equal(refine(o, 'make it purple'), null)
})

test('generating steps count the real prompts and brands', () => {
  assert.deepEqual(stepsFor({ brand: 'foa', period: 'week' }), ['Reading 113 prompts', 'Comparing 7 brands', 'Checking this week’s wins and gaps', 'Writing the summary'])
  assert.equal(stepsFor({ brand: 'foa', compare: ['longbridge'] })[1], 'Comparing 2 brands')
})

test('every saved report and suggestion builds', () => {
  for (const s of savedReports) assert.equal(buildReport(s.opts, s.prompt).ok, true, s.id)
  for (const b of ['foa', 'dermasuri', 'lumen']) for (const s of suggestionsFor(b)) assert.equal(buildReport({ brand: b, ...s.sets }, s.text).ok, true, `${b} ${s.id}`)
  assert.equal(suggestionsFor('foa')[2].text, 'Where is Longbridge beating us?')
})
