import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildReport, dataFor, glance, inferOpts, refine, resolveOpts, savedReports, stepsFor, templatesFor } from './reports.js'

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
