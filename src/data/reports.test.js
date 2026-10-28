import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DATES, shortRange, addReport, optsLine, refineSuggestions, reportById, updateReport, buildReport, dataFor, glance, inferOpts, libraryItems, refine, resolveOpts, runSummary, savedReports, schedules, stepsFor, suggestionsFor, templatesFor, weekGroup, weeklyRuns } from './reports.js'

const types = (r) => r.blocks.map((b) => b.type)
const block = (r, type) => r.blocks.find((b) => b.type === type)?.data
const sections = (r) => r.blocks.filter((b) => b.type === 'section').map((b) => b.data)

test('every report has the same rhythm: header · scoreline · hero · sections · actions · sources', () => {
  for (const kind of ['weekly', 'ceo', 'rival', 'content']) {
    const r = buildReport({ brand: 'foa', kind, period: '30d', length: 'detailed' })
    assert.equal(r.ok, true, kind)
    assert.deepEqual(types(r).filter((t) => t !== 'section'), ['header', 'scoreline', 'hero', 'actions', 'sources'], kind)
    assert.equal(block(r, 'scoreline').items.length, 4, kind)
    assert.ok(block(r, 'scoreline').items.every((m) => m.series.length === 8), `${kind}: 8-point sparklines`)
    assert.ok(block(r, 'actions').items.length <= 3, kind)
    assert.ok(sections(r).every((s) => s.takeaway && !s.takeaway.includes('. ', s.takeaway.length - 2) && s.visual), `${kind}: one takeaway + a visual`)
  }
})

test('each kind has its own hero', () => {
  const hero = (kind) => block(buildReport({ brand: 'foa', kind }), 'hero').kind
  assert.deepEqual(['weekly', 'ceo', 'rival', 'content'].map(hero), ['flow', 'slope', 'quadrant', 'bubbles'])
})

test('the weekly flow accounts for every prompt, and matches the scoreline', () => {
  for (const brand of ['foa', 'dermasuri']) {
    for (const period of ['week', '30d', 'quarter']) {
      const r = buildReport({ brand, kind: 'weekly', period })
      const f = block(r, 'hero')
      const named = block(r, 'scoreline').items.find((m) => m.id === 'named')
      assert.equal(f.held + f.won + f.lost + f.missing, dataFor(brand).prompts, `${brand} ${period}`)
      assert.equal(f.held + f.won, named.value, `${brand} ${period}: named now`)
      assert.equal(f.held + f.lost, named.value - named.delta, `${brand} ${period}: named at the start`)
    }
  }
})

test('head-to-head quadrants add up; their wins match the topics and the scoreline', () => {
  for (const [brand, rival] of [['foa', 'longbridge'], ['dermasuri', 'cerave']]) {
    const r = buildReport({ brand, kind: 'rival', compare: [rival], length: 'detailed' })
    const h = block(r, 'hero')
    assert.equal(h.onlyThem + h.themFirst + h.youFirst + h.onlyYou + h.neither, dataFor(brand).prompts)
    const theirs = h.onlyThem + h.themFirst
    assert.equal(block(r, 'scoreline').items[1].value, theirs)
    assert.equal(sections(r)[0].visual.rows.reduce((a, t) => a + t.n, 0), theirs)
  }
  assert.match(buildReport({ brand: 'foa', kind: 'rival', compare: ['longbridge'] }).headline, /beats Finance of America on 23 prompts/)
})

test('content plan: topic gaps add up to the prompts missing; the headline names the most-owned topic', () => {
  const r = buildReport({ brand: 'foa', kind: 'content', length: 'detailed' })
  const missing = block(r, 'scoreline').items.find((m) => m.id === 'missing').value
  assert.equal(block(r, 'hero').rows.reduce((a, t) => a + t.missing, 0), missing)
  assert.match(r.headline, /^Write for calculators first/)
  assert.deepEqual(block(r, 'actions').items.map((a) => a.type), ['New page', 'Add to FAQ', 'Outreach'])
})

test('verdicts: Good week / Mixed / Tough week; Winning / Mixed / Losing', () => {
  assert.equal(buildReport({ brand: 'foa', kind: 'weekly', period: 'week' }).verdict, 'Good week')
  assert.equal(buildReport({ brand: 'foa', kind: 'ceo' }).verdict, 'Winning')
  assert.equal(buildReport({ brand: 'foa', kind: 'rival', compare: ['longbridge'] }).verdict, 'Mixed')
})

test('an engine that didn’t run shows as such and is named in the footer, never estimated', () => {
  const r = buildReport({ brand: 'foa', kind: 'weekly', length: 'detailed' })
  const eng = sections(r).find((s) => s.id === 'engines').visual.rows
  assert.deepEqual(eng.find((e) => e.id === 'claude'), { id: 'claude', name: 'Claude', off: true })
  assert.ok(block(r, 'sources').left.some((s) => /Claude/.test(s)))
})

test('one page keeps the first two sections', () => {
  assert.equal(sections(buildReport({ brand: 'foa', kind: 'weekly', length: 'one' })).length, 2)
  assert.equal(sections(buildReport({ brand: 'foa', kind: 'weekly', length: 'detailed' })).length, 4)
})

test('not enough data, and no breakdown for a competitor: no report, and why', () => {
  assert.equal(buildReport({ brand: 'northwind-derm' }).syncs, 1)
  assert.equal(buildReport({ brand: 'foa', kind: 'rival', compare: ['rocket'] }).reason, 'nobreakdown')
})

test('the question and templates set the kind; a set chip wins', () => {
  assert.equal(resolveOpts({ brand: 'foa' }, 'Where is Longbridge beating us?').kind, 'rival')
  assert.equal(resolveOpts({ brand: 'foa' }, 'Which prompts should we write content for next?').kind, 'content')
  assert.equal(resolveOpts({ brand: 'foa' }, 'CEO summary: are we winning in AI search?').kind, 'ceo')
  assert.equal(resolveOpts({ brand: 'foa', period: 'quarter' }, 'how did we do this week').period, 'quarter')
  assert.equal(inferOpts('How did we do this week?').period, 'week')
  for (const b of ['foa', 'dermasuri']) for (const t of templatesFor(b)) assert.equal(buildReport({ brand: b, ...t.sets }, t.prompt).kind, t.kind, `${b} ${t.id}`)
})

test('refine: short instructions become a new version; anything else is not understood', () => {
  const o = resolveOpts({ brand: 'foa', kind: 'weekly', length: 'detailed' }, '')
  assert.equal(refine(o, 'make it shorter').opts.length, 'one')
  assert.equal(refine(o, 'focus on Longbridge').opts.kind, 'rival')
  assert.equal(refine(o, 'rewrite for a client').opts.audience, 'client')
  assert.equal(refine(o, 'make it purple'), null)
})

test('glance, steps, and every saved report builds', () => {
  assert.deepEqual(glance('foa').items.map((g) => g.value), [64, 71, 31])
  assert.equal(stepsFor({ brand: 'foa', period: 'week' })[1], 'Comparing 7 brands')
  for (const s of savedReports) assert.equal(buildReport(s.opts, s.prompt).ok, true, s.id)
})

test('weekly runs: one per sync after the first, each verdict from that week; the newest is the saved weekly report', () => {
  const runs = weeklyRuns('foa')
  assert.equal(runs.length, DATES.length - 1)
  assert.deepEqual(runs.map((r) => r.verdict), ['Good week', 'Tough week', 'Good week', 'Good week', 'Mixed', 'Good week', 'Good week'])
  const last = runs.at(-1)
  const saved = buildReport(savedReports.find((r) => r.id === 'r-foa-week').opts)
  assert.equal(last.id, 'r-foa-week')
  assert.equal(last.verdict, saved.verdict)
  assert.equal(last.headline, saved.headline)
  // the newest run's change in prompts named is the flow's won − lost
  const f = dataFor('foa').flow.week
  assert.equal(last.net, f.won - f.lost)
  assert.match(runs[1].headline, /1 fewer AI answer than/)
  assert.equal(runSummary(runs[1]).scoreline.items[1].delta, -1)
  assert.deepEqual(weeklyRuns('brightside'), [])
})

test('the library: saved reports and earlier runs, newest first; groups by week from today (Oct 28)', () => {
  const items = libraryItems()
  assert.equal(items.length, savedReports.length + 12)
  assert.equal(new Set(items.map((i) => i.id)).size, items.length)
  assert.ok(items.every((i) => i.headline && i.verdict && i.stats.length === 3))
  assert.deepEqual(['Oct 26', 'Oct 22', 'Oct 20', 'Oct 9', 'Sep 28'].map((d) => weekGroup(d)), ['This week', 'Last week', 'Last week', 'Earlier in October', 'September'])
  // every weekly report that says it's scheduled has a schedule
  for (const r of savedReports.filter((x) => x.scheduled)) assert.ok(schedules.some((s) => s.reportId === r.id), r.id)
})

test('suggestions: four, the competitor one names the closest tracked rival; each one’s settings give that kind', () => {
  const s = suggestionsFor('dermasuri')
  assert.deepEqual(s.map((x) => x.text), ['Weekly summary: what moved this week', 'CEO summary: are we winning in AI search?', 'Where is CeraVe beating us?', 'What should we write next?'])
  for (const x of s) assert.equal(buildReport({ brand: 'dermasuri', ...x.sets }, x.text).kind, x.kind, x.id)
  assert.equal(suggestionsFor('foa')[2].text, 'Where is Longbridge beating us?')
})

test('the thread: the options line, the refine suggestions (each one understood), and a new report kept with the saved ones', () => {
  assert.equal(optsLine({ period: 'week', audience: 'team', length: 'one' }), 'This week · Team · One page')
  assert.deepEqual(stepsFor({ brand: 'foa', period: 'week' }), ['Reading 113 prompts', 'Comparing 7 brands', 'Writing the summary'])
  const s = refineSuggestions('dermasuri')
  assert.deepEqual(s, ['Make it shorter', 'Add Gemini', 'Focus on CeraVe', 'Rewrite for a client'])
  for (const x of s) assert.ok(refine({ brand: 'dermasuri', engines: ['aio'], compare: [], length: 'detailed', audience: 'team' }, x), x)
  const before = libraryItems().length
  const id = addReport('Where is CeraVe beating us?', { brand: 'dermasuri', period: '30d', audience: 'team', length: 'one' })
  assert.equal(reportById(id).title, 'Where is CeraVe beating us?')
  assert.equal(libraryItems().length, before + 1)
  assert.equal(libraryItems()[0].id, id)
  updateReport(id, { length: 'detailed' })
  assert.equal(reportById(id).opts.length, 'detailed')
})

test('the report header and footer: the engines that ran, a compact range, what didn’t run', () => {
  assert.equal(shortRange('Oct 19', 'Oct 26'), 'Oct 19–26')
  assert.equal(shortRange('Sep 28', 'Oct 26'), 'Sep 28 – Oct 26')
  const r = buildReport({ brand: 'dermasuri', kind: 'weekly', period: 'week', length: 'detailed' })
  const h = r.blocks.find((b) => b.type === 'header').data
  assert.equal(h.span, 'Oct 19–26')
  assert.deepEqual(h.counted, ['AI Overview', 'ChatGPT'])
  const f = r.blocks.find((b) => b.type === 'sources').data
  assert.deepEqual(f.off, ['Gemini', 'Claude'])
  assert.equal(r.blocks.find((b) => b.type === 'section').data.title, 'By topic')
})
