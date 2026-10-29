import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DATES, library, seriesRuns, scoreStrip, shortRange, addReport, optsLine, refineSuggestions, reportById, updateReport, buildReport, dataFor, glance, inferOpts, libraryItems, refine, resolveOpts, runSummary, savedReports, schedules, stepsFor, suggestionsFor, templatesFor, weekGroup, weeklyRuns } from './reports.js'

const types = (r) => r.blocks.map((b) => b.type)
const block = (r, type) => r.blocks.find((b) => b.type === type)?.data
const sections = (r) => r.blocks.filter((b) => b.type === 'section').map((b) => b.data)

const hero = (r) => block(r, 'hero')

const RIVAL = { foa: 'longbridge', dermasuri: 'cerave' }
const ALL = (brand) => [
  { kind: 'weekly', period: 'week' }, { kind: 'weekly', period: '30d', audience: 'client' }, { kind: 'ceo', period: '30d' },
  { kind: 'rival', compare: [RIVAL[brand]] }, { kind: 'content' },
]
const table = (r) => sections(r).find((s) => s.visual.kind === 'topicTable').visual
const MOMENTUM = new Set(['momentum', 'leadLines'])
const momentum = (r) => sections(r).find((s) => MOMENTUM.has(s.visual.kind)).visual
const dots = (v, tone) => v.rows.reduce((a, x) => a + x.dots.filter((t) => t === tone).length, 0)

test('merge, don’t repeat: every report is a hero (the answer, no stat row) · sections · footer; the actions live in its one table', () => {
  for (const brand of ['foa', 'dermasuri']) {
    for (const o of ALL(brand)) {
      const r = buildReport({ brand, length: 'detailed', ...o })
      const k = `${brand} ${o.kind} ${o.audience ?? ''}`
      assert.equal(r.ok, true, k)
      assert.deepEqual(types(r).filter((t) => t !== 'section'), ['hero', 'sources'], k)
      assert.equal(hero(r).chips.length, 0, `${k}: no stat row`)
      assert.equal(sections(r).filter((s) => s.visual.kind === 'topicTable').length, 1, `${k}: one table`)
      assert.ok(MOMENTUM.has(sections(r).at(-1).visual.kind), `${k}: momentum last`)
      assert.ok(sections(r).filter((s) => s.visual.kind !== 'momentum').every((s) => s.takeaway), `${k}: a takeaway`)
      // every row: a topic, an example from its own prompts, "+N more" counting the rest
      for (const row of table(r).rows) {
        assert.equal(row.example, row.prompts[0]?.text ?? null, `${k} ${row.theme}`)
        assert.equal(row.more, Math.max(0, row.prompts.length - 1), `${k} ${row.theme}`)
      }
    }
  }
})

test('each kind has its own hero; the weekly is What moved, then Momentum', () => {
  const visual = (o) => hero(buildReport({ brand: 'foa', ...o })).visual.kind
  assert.deepEqual(ALL('foa').map(visual), ['promptStrip', 'scoreLine', 'lead', 'split', 'promptStrip'])
  const w = buildReport({ brand: 'dermasuri', kind: 'weekly', period: 'week', length: 'detailed' })
  assert.deepEqual(sections(w).map((s) => s.title), ['What moved', 'Momentum'])
})

test('the prompt strip holds every tracked prompt once; the weekly table’s dots are the prompts won and lost', () => {
  for (const brand of ['foa', 'dermasuri']) {
    const d = dataFor(brand)
    for (const o of ALL(brand).filter((x) => x.audience !== 'client' && x.kind !== 'ceo')) {
      const hr = hero(buildReport({ brand, ...o }))
      const v = hr.strip ?? hr.visual
      assert.equal(v.segs.reduce((a, x) => a + x.n, 0), d.prompts, `${brand} ${o.kind}`)
    }
    for (const period of ['week', '30d']) {
      const r = buildReport({ brand, kind: 'weekly', period, length: 'detailed' })
      const n = Object.fromEntries(hero(r).visual.segs.map((x) => [x.key, x.n]))
      assert.deepEqual([n.won, n.held, n.lost, n.missing], [d.flow[period].won, d.flow[period].held, d.flow[period].lost, d.flow[period].missing])
      assert.equal(dots(table(r), 'you'), n.won, `${brand} ${period}: won`)
      assert.equal(dots(table(r), 'red'), n.lost, `${brand} ${period}: lost`)
      // the plan's three actions, each on its topic's row
      assert.equal(table(r).rows.filter((x) => x.action).length, 3)
    }
  }
})

test('the score strip: 8 weeks from history; an unscanned week stays empty, never 0; compared with the last scanned week', () => {
  const s = scoreStrip([61, 62, 61, 64, 65, 64, 66, 73])
  assert.deepEqual(s.weeks.map((w) => w.date), DATES)
  assert.equal(s.value, 73)
  assert.equal(s.delta, 7)
  const gap = scoreStrip([61, 62, 61, 64, 65, 64, null, 73])
  assert.equal(gap.weeks[6].score, null)
  assert.equal(gap.delta, 9) // against Oct 5, the last week that was scanned
  assert.equal(scoreStrip([61, 62, 61, 64, 65, 64, 66, undefined]).delta, null)
})

test('momentum: one line, each number now with its change since the start; competitors outside the competitor report have no brand colour', () => {
  const r = buildReport({ brand: 'foa', kind: 'weekly', period: 'week', length: 'detailed' })
  const m = momentum(r)
  const d = dataFor('foa')
  assert.equal(m.since, 'last week')
  assert.deepEqual(m.items[0], { label: 'Visibility score', value: d.series.score.at(-1), d: d.series.score.at(-1) - d.series.score[6] })
  const rivals = m.items.filter((x) => x.them)
  assert.equal(rivals.length, 3)
  assert.deepEqual(rivals.map((x) => parseInt(x.value)), [...rivals.map((x) => parseInt(x.value))].sort((a, b) => b - a))
  assert.ok(rivals.every((x) => !x.color))
  assert.ok(table(buildReport({ brand: 'foa', kind: 'content' })).rows.every((x) => !x.cells.owner.color))
})

test('CEO: the lead chart, where you stand, then one table of topics with the decisions in it', () => {
  const one = buildReport({ brand: 'dermasuri', kind: 'ceo', period: '30d', length: 'one' })
  assert.deepEqual(sections(one).map((s) => s.visual.kind), ['dumbbell', 'topicTable'])
  const r = buildReport({ brand: 'dermasuri', kind: 'ceo', period: '30d', length: 'detailed' })
  assert.deepEqual(sections(r).map((s) => s.visual.kind), ['dumbbell', 'topicTable', 'momentum'])
  const v = hero(r).visual
  assert.equal(v.kind, 'lead')
  assert.equal(v.dates.length, 5)
  assert.equal(v.them.name, 'CeraVe')
  assert.equal(v.lead, v.you.series.at(-1) - v.them.series.at(-1))
  assert.equal(v.label, 'Lead over CeraVe · last 30 days')
  // one row per topic, in the data's order; a topic another brand leads is red and carries its decision
  const t = table(r)
  const d = dataFor('dermasuri')
  assert.deepEqual(t.rows.map((x) => x.theme), d.topicLead.map((x) => x.theme))
  for (const [i, x] of t.rows.entries()) {
    assert.equal(x.cells.lead.neg, d.topicLead[i].d < 0, x.theme)
    if (d.topicLead[i].d < 0) assert.match(x.action, /^Win back /, x.theme)
  }
  // share of voice only in Where you stand
  assert.equal(sections(r).filter((s) => s.visual.rows?.some((x) => x.you && x.now != null)).length, 1)
})

test('engines: the prompts each engine names match its share; the table’s engine line reads won / lost from the data', () => {
  for (const brand of ['foa', 'dermasuri']) {
    const d = dataFor(brand)
    for (const [id, e] of Object.entries(d.engines)) assert.equal(Math.round((e.named / d.prompts) * 100), e.now, `${brand} ${id}`)
    const note = table(buildReport({ brand, kind: 'weekly', period: 'week', length: 'detailed' })).notes[0]
    for (const e of Object.values(d.engines)) assert.ok(note.includes(`won ${e.week[0]}, lost ${e.week[1]}`), `${brand}: ${note}`)
  }
})

test('competitor v9: the head-to-head and the strip; per topic the dots, the engines and the page battle; the lead chart', () => {
  for (const [brand, rival] of Object.entries(RIVAL)) {
    const r = buildReport({ brand, kind: 'rival', compare: [rival], length: 'detailed' })
    const h = dataFor(brand).h2h[rival]
    // the hero's head-to-head: the one place the two counts and their changes appear
    const v = hero(r).visual
    assert.equal(v.kind, 'split')
    assert.equal(v.you.n, h.onlyYou + h.youFirst)
    assert.equal(v.them.n, h.onlyThem + h.themFirst)
    assert.equal(v.you.n, h.youWin.at(-1), 'the head-to-head and the weekly wins agree')
    assert.equal(v.them.delta, h.theyWin.at(-1) - h.theyWin[3])
    assert.ok(!r.headline.includes(String(v.them.n)) && !r.headline.includes(String(v.you.n)), 'the counts aren’t repeated in the headline')
    // the strip: every prompt once; hovering their segments lists exactly their prompts
    const n = Object.fromEntries(hero(r).strip.segs.map((x) => [x.key, x]))
    assert.deepEqual(Object.fromEntries(Object.entries(n).map(([k, x]) => [k, x.n])), { onlyYou: h.onlyYou, youFirst: h.youFirst, themFirst: h.themFirst, onlyThem: h.onlyThem, neither: h.neither })
    assert.equal(n.onlyThem.prompts.length, h.onlyThem)
    assert.equal(n.themFirst.prompts.length, h.themFirst)
    // per topic: a dot per prompt they win, split by engine; the pages on one scale; No page where you have none
    const t = table(r)
    assert.equal(dots(t, 'them'), v.them.n)
    assert.deepEqual(t.rows.map((x) => x.dots.length), [...t.rows.map((x) => x.dots.length)].sort((a, b) => b - a), 'sorted by their wins')
    assert.equal(t.notes, undefined, 'the engines are in the rows, not a footnote')
    for (const x of t.rows) {
      const w = h.why.find((y) => y.theme === x.theme)
      assert.equal(x.engines.reduce((a, e) => a + e.n, 0), x.dots.length, x.theme)
      assert.equal(x.cells.battle.them.n, w.them.n)
      assert.equal(x.cells.battle.you?.n ?? null, w.you?.n ?? null, `${x.theme}: no page`)
      assert.ok(x.cells.battle.them.n <= t.scale && (x.cells.battle.you?.n ?? 0) <= t.scale)
      assert.ok(x.action, x.theme)
    }
    for (const [e, c] of Object.entries(h.engines)) assert.equal(t.rows.reduce((a, x) => a + (x.engines.find((y) => y.id === e)?.n ?? 0), 0), c.n, e)
    // momentum: the weekly wins over the period, the lead and its change
    const m = momentum(r)
    assert.equal(m.kind, 'leadLines')
    assert.deepEqual(m.you.series, h.youWin.slice(3))
    assert.equal(m.lead, h.youWin.at(-1) - h.theyWin.at(-1))
    assert.equal(m.leadDelta, m.lead - (h.youWin[3] - h.theyWin[3]))
    // the competitor in its brand colour everywhere, never red
    assert.match(t.color, /^var\(--line-\d\)$/)
    assert.ok([v.color, hero(r).strip.color, m.them.color].every((c) => c === t.color))
  }
  assert.match(buildReport({ brand: 'foa', kind: 'rival', compare: ['longbridge'] }).headline, /^Longbridge’s wins come mostly from/)
})

test('content plan: the strip’s red part is the red dots; a page to build on every topic', () => {
  const r = buildReport({ brand: 'foa', kind: 'content', length: 'detailed' })
  const n = Object.fromEntries(hero(r).visual.segs.map((x) => [x.key, x.n]))
  const t = table(r)
  assert.equal(dots(t, 'red'), n.owned)
  assert.equal(t.rows.reduce((a, x) => a + x.dots.length, 0), n.owned + n.open)
  assert.match(r.headline, /^Calculators first: Longbridge holds 7 of its 8 prompts/)
  assert.ok(t.rows.every((x) => /^Build the .+ page AI is missing$/.test(x.action)))
  assert.equal(t.rows[0].theme, 'Calculators')
})

test('verdicts: Good week / Mixed / Tough week; Winning / Mixed / Losing', () => {
  assert.equal(buildReport({ brand: 'foa', kind: 'weekly', period: 'week' }).verdict, 'Good week')
  assert.equal(buildReport({ brand: 'foa', kind: 'ceo' }).verdict, 'Winning')
  assert.equal(buildReport({ brand: 'foa', kind: 'rival', compare: ['longbridge'] }).verdict, 'Mixed')
})

test('an engine that didn’t run is said so and named in the footer, never estimated', () => {
  const r = buildReport({ brand: 'foa', kind: 'weekly', length: 'detailed' })
  assert.match(table(r).notes[0], /Claude didn’t run/)
  assert.ok(block(r, 'sources').left.some((s) => /Claude/.test(s)))
})

test('one page keeps the first two sections', () => {
  assert.equal(sections(buildReport({ brand: 'foa', kind: 'ceo', length: 'one' })).length, 2)
  assert.equal(sections(buildReport({ brand: 'foa', kind: 'ceo', length: 'detailed' })).length, 3)
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

test('the report hero and footer: the engines that ran, a compact range, what didn’t run', () => {
  assert.equal(shortRange('Oct 19', 'Oct 26'), 'Oct 19–26')
  assert.equal(shortRange('Sep 28', 'Oct 26'), 'Sep 28 – Oct 26')
  const r = buildReport({ brand: 'dermasuri', kind: 'weekly', period: 'week', length: 'detailed' })
  const h = r.blocks.find((b) => b.type === 'hero').data
  assert.equal(h.span, 'Oct 19–26')
  assert.deepEqual(h.counted, ['AI Overview', 'ChatGPT'])
  assert.equal(h.since, 'last week')
  const f = r.blocks.find((b) => b.type === 'sources').data
  assert.deepEqual(f.off, ['Gemini', 'Claude'])
  assert.equal(r.blocks.find((b) => b.type === 'section').data.title, 'What moved')
})

test('the library: brand-scoped series (with their runs) and one-off reports', () => {
  const ds = library('dermasuri')
  assert.deepEqual(ds.series.map((x) => x.title), ['Weekly summary', 'Client update'])
  assert.equal(ds.scheduled, 2)
  assert.ok(ds.oneOffs.every((r) => r.brand === 'dermasuri'))
  assert.ok(ds.oneOffs.some((r) => r.id === 'r-ds-cerave'))
  assert.ok(!ds.oneOffs.some((r) => ['r-ds-week', 'r-ds-client'].includes(r.id)), 'a scheduled report is a series, not a one-off')
  const all = library()
  assert.equal(all.series.length, 4)
  assert.equal(all.scheduled, 4)
  assert.deepEqual(new Set(all.oneOffs.map((r) => r.brand)), new Set(['foa', 'dermasuri']))
  assert.deepEqual(library('lumen').series, [])
})

test('series runs: one per run of the schedule, newest first; the newest is the saved report itself', () => {
  const week = seriesRuns(schedules.find((x) => x.id === 's-ds-week'))
  assert.equal(week.length, 7)
  assert.equal(week[0].id, 'r-ds-week')
  assert.equal(week[0].headline, buildReport(reportById('r-ds-week').opts).headline)
  assert.deepEqual(week.map((r) => r.date), [...DATES].reverse().slice(0, 7))
  assert.ok(week.slice(1).every((r) => r.run && r.from === r.idx - 1))
  assert.equal(week[1].change, `+${dataFor('dermasuri').series.named[6] - dataFor('dermasuri').series.named[5]} answers`)
  const client = seriesRuns(schedules.find((x) => x.id === 's-ds-client'))
  assert.deepEqual(client.map((r) => r.idx), [7, 5, 3, 1])
  const ceo = seriesRuns(schedules.find((x) => x.id === 's-foa-ceo'))
  assert.deepEqual(ceo.map((r) => r.idx), [7, 3])
  assert.match(ceo[1].change, /pts share$/)
  for (const r of [...week, ...client, ...ceo]) assert.ok(['Good week', 'Good month', 'Mixed', 'Tough week', 'Tough month', 'Winning', 'Losing'].includes(r.verdict), r.verdict)
})

const BAR_KINDS = new Set(['ranking', 'diverging', 'topicBars', 'engineStack', 'engineBars', 'bars'])
test('v7: at most one horizontal-bar section in any report', () => {
  for (const brand of ['foa', 'dermasuri']) {
    for (const o of ALL(brand)) {
      const r = buildReport({ brand, length: 'detailed', ...o })
      const bars = sections(r).filter((x) => BAR_KINDS.has(x.visual.kind)).map((x) => x.visual.kind)
      assert.ok(bars.length <= 1, `${brand} ${o.kind} ${o.audience ?? ''}: ${bars}`)
    }
  }
})

test('v7: what to do follows the question: no two kinds of report suggest the same actions', () => {
  const titles = (o) => table(buildReport({ brand: 'dermasuri', length: 'detailed', ...o })).rows.map((a) => a.action).filter(Boolean)
  const sets = [titles({ kind: 'weekly', period: 'week' }), titles({ kind: 'ceo' }), titles({ kind: 'rival', compare: ['cerave'] }), titles({ kind: 'content' })]
  for (const x of sets) assert.ok(x.length > 0)
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) assert.ok(!sets[i].some((t) => sets[j].includes(t)), `${i} and ${j} share an action`)
})

test('v7: the client update speaks to the client, with its own hero and no prompt lists to open', () => {
  const r = buildReport({ brand: 'dermasuri', kind: 'weekly', period: '30d', audience: 'client', length: 'detailed' })
  assert.equal(hero(r).client, true)
  assert.equal(hero(r).visual.kind, 'scoreLine')
  assert.equal(hero(r).visual.span, 'this month')
  assert.equal(hero(r).visual.series.length, 5)
  assert.match(r.headline, /^You’re in \d+ more AI answers than a month ago/)
  assert.deepEqual(sections(r).map((x) => x.visual.kind), ['topicTable', 'momentum'])
  assert.ok(sections(r).every((x) => x.client))
  assert.equal(table(r).actionLabel, 'What we’re doing next')
  assert.ok(table(r).rows.filter((x) => x.action).every((x) => x.action.startsWith('We’ll ')))
  // the score is the hero's; the momentum line doesn't repeat it
  assert.ok(!momentum(r).items.some((x) => x.label === 'Visibility score'))
})
