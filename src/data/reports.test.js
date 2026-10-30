import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DATES, library, seriesRuns, scoreStrip, shortRange, addReport, optsLine, followUpsFor, reportById, updateReport, buildReport, dataFor, glance, inferOpts, libraryItems, refine, resolveOpts, runSummary, savedReports, schedules, stepsFor, suggestionsFor, templatesFor, weekGroup, weeklyRuns } from './reports.js'

const types = (r) => r.blocks.map((b) => b.type)
const block = (r, type) => r.blocks.find((b) => b.type === type)?.data
const sections = (r) => r.blocks.filter((b) => b.type === 'section').map((b) => b.data)

const hero = (r) => block(r, 'hero')
const v2sections = (r) => r.blocks.filter((b) => b.type === 'v2section').map((b) => b.data)

const RIVAL = { foa: 'longbridge', dermasuri: 'cerave' }
const ALL = () => [{ kind: 'ceo', period: '30d' }, { kind: 'content' }]
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

test('each old-band kind has its own hero', () => {
  const visual = (o) => hero(buildReport({ brand: 'foa', ...o })).visual.kind
  assert.deepEqual(ALL('foa').map(visual), ['lead', 'promptStrip'])
})

test('the prompt strip holds every tracked prompt once (content plan); the weekly frame: the donut holds every prompt once and the table’s won / lost add up to it', () => {
  for (const brand of ['foa', 'dermasuri']) {
    const d = dataFor(brand)
    const hr = hero(buildReport({ brand, kind: 'content' }))
    assert.equal(hr.visual.segs.reduce((a, x) => a + x.n, 0), d.prompts, `${brand} content`)
    for (const period of ['week', '30d']) {
      const f = buildReport({ brand, kind: 'weekly', period, length: 'detailed' }).frame
      const n = Object.fromEntries(f.summary.donut.map((x) => [x.key, x.n]))
      assert.deepEqual([n.won, n.held, n.lost, n.missed], [d.flow[period].won, d.flow[period].held, d.flow[period].lost, d.flow[period].missing])
      assert.equal(f.summary.donut.reduce((a, x) => a + x.n, 0), d.prompts, `${brand} ${period}: every prompt once`)
      assert.equal(f.table.rows.reduce((a, x) => a + x.won, 0), n.won, `${brand} ${period}: won`)
      assert.equal(f.table.rows.reduce((a, x) => a + x.lost, 0), n.lost, `${brand} ${period}: lost`)
      for (const x of f.table.rows) assert.equal(x.net, x.won - x.lost)
      // the plan's three actions, each on its topic's row; a topic with no change still has its row
      assert.equal(f.table.rows.filter((x) => x.next).length, 3)
      assert.ok(f.table.rows.filter((x) => x.change === 'none').every((x) => x.won === 0 && x.lost === 0 && x.engines.length === 0))
      // the engines that moved a topic add up to the engine line
      const won = {}
      const lost = {}
      for (const m of d.moved[period]) for (const [e, k] of Object.entries(m.engines)) { if (m.d > 0) won[e] = (won[e] ?? 0) + k; else lost[e] = (lost[e] ?? 0) + k }
      for (const [e, x] of Object.entries(d.engines)) { assert.equal(won[e] ?? 0, x[period][0], `${brand} ${period} ${e} won`); assert.equal(lost[e] ?? 0, x[period][1], `${brand} ${period} ${e} lost`) }
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

test('the weekly frame: the chart is the last 8 weeks of answers naming you (this week in the primary), the stats carry their change since the start; competitors outside the competitor report have no brand colour', () => {
  const r = buildReport({ brand: 'foa', kind: 'weekly', period: 'week', length: 'detailed' })
  const d = dataFor('foa')
  const f = r.frame
  assert.equal(f.question, 'What moved this week?')
  assert.deepEqual(f.chart.bands.map((b) => b.bars[0].value), d.series.named)
  assert.deepEqual(f.chart.bands.map((b) => b.bars[0].tone), [...Array(7).fill('tint'), 'primary'])
  assert.equal(f.chart.bands.at(-1).delta, d.series.named.at(-1) - d.series.named.at(-2))
  assert.equal(f.chart.value, d.series.named.at(-1))
  assert.equal(f.chart.since, 'last week')
  assert.deepEqual(f.summary.stats[0], { label: 'Visibility score', value: d.series.score.at(-1), delta: d.series.score.at(-1) - d.series.score[6], since: 'last week' })
  assert.equal(f.summary.stats[1].unit, '%')
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
    const note = buildReport({ brand, kind: 'weekly', period: 'week', length: 'detailed' }).frame.table.note
    for (const e of Object.values(d.engines)) assert.ok(note.includes(`won ${e.week[0]}, lost ${e.week[1]}`), `${brand}: ${note}`)
  }
})

test('competitor gap (frame): the question and one finding; the chart is us vs them per topic (the sums are the prompts naming each); the donut holds every prompt once; two stats; the table of the prompts they win, with filters', () => {
  for (const [brand, rival] of Object.entries(RIVAL)) {
    const r = buildReport({ brand, kind: 'rival', compare: [rival], length: 'detailed' }, `Where is ${rival} beating us?`)
    const h = dataFor(brand).h2h[rival]
    const f = r.frame
    assert.equal(r.v3, true)
    assert.ok(f.question)
    assert.ok(f.finding.split(' ').length <= 22, f.finding)
    assert.equal(f.chart.bands.reduce((a, b) => a + b.bars[0].value, 0), h.onlyYou + h.youFirst + h.themFirst, 'the prompts naming you')
    assert.equal(f.chart.bands.reduce((a, b) => a + b.bars[1].value, 0), h.onlyThem + h.themFirst + h.youFirst, 'the prompts naming them')
    // the main card leads with the answer: the prompts they win, with its change against the start
    assert.equal(f.chart.value, h.onlyThem + h.themFirst)
    assert.equal(f.chart.delta, h.theyWin.at(-1) - h.theyWin[3])
    assert.equal(f.chart.worseUp, true)
    assert.equal(f.chart.since, DATES[3])
    assert.deepEqual(f.chart.legend.map((l) => l.tone), ['primary', 'teal'])
    assert.deepEqual(f.summary.donut.map((x) => x.n), [h.onlyYou + h.youFirst, h.onlyThem + h.themFirst, h.neither])
    assert.equal(f.summary.donut.reduce((a, x) => a + x.n, 0), dataFor(brand).prompts, 'every prompt once')
    // the stats don't repeat the donut or the main card
    assert.deepEqual(f.summary.stats[0], { label: 'Topics they lead', value: h.byTopic.filter((t) => t.them > t.you).length, of: h.byTopic.length })
    assert.equal(f.summary.stats[1].value, h.citedYou.length)
    for (const x of f.table.rows) assert.equal(x.marker.solid, x.result.startsWith('Only '), x.text)
    assert.equal(f.table.rows.length, h.onlyThem + h.themFirst)
    for (const x of f.table.rows) { assert.ok(x.topic && x.engineName && x.result, x.text); assert.ok(x.page?.n, `${x.text}: their cited page`) }
    for (const [e, c] of Object.entries(h.engines)) assert.equal(f.table.rows.filter((x) => x.engine === e).length, c.n, e)
    assert.deepEqual(f.table.filters.map((x) => x.key), ['topic', 'engine'])
    assert.ok(!f.table.filters[1].options.some((o) => /Claude|Gemini/.test(o.label)) || brand === 'foa', 'no engine that didn’t run')
    assert.equal(f.table.pageSize, 10)
    assert.ok(f.steps.every((st) => /^\/tracker\?topic=/.test(st.action.href)))
    assert.equal(block(r, 'sources').syncs, 5)
  }
  assert.match(buildReport({ brand: 'foa', kind: 'rival', compare: ['longbridge'] }).headline, /^Longbridge wins 23 of your 113 prompts/)
})

test('custom report (v2): the question read back (interpreted, scope, data), a verdict, the blocks that fit, and “Not in your data” for what isn’t', () => {
  const c = buildReport({ brand: 'foa', length: 'detailed' }, 'Show the answers where Longbridge is named')
  assert.equal(c.kind, 'custom')
  assert.equal(c.v2, true)
  const read = block(c, 'v2read')
  assert.match(read.question, /^Prompts where AI names Longbridge/)
  assert.match(read.scope, /^Finance of America · Sep 28 – Oct 26 · AI Overview, ChatGPT, Gemini · vs Longbridge/)
  assert.match(read.data, /^113 tracked prompts · 5 weekly syncs/)
  assert.ok(block(c, 'v2hero').verdict.word)
  assert.deepEqual(v2sections(c).map((x) => x.id), ['stats', 'named', 'youFirst', 'pages', 'steps'])
  assert.deepEqual(v2sections(buildReport({ brand: 'foa', length: 'one' }, 'Show the answers where Longbridge is named')).map((x) => x.id), ['stats', 'named', 'youFirst', 'steps'], 'one page keeps the note and the next steps')
  assert.ok(v2sections(c)[0].block.items.length <= 4, 'a stat row holds at most 4')
  assert.equal(v2sections(c)[2].block.kind, 'notInData')
  assert.deepEqual(stepsFor(c.opts)[0], 'Reading your question')
  // a topic: its prompts, with who's named instead; the total the data doesn't hold is said
  const t = buildReport({ brand: 'foa' }, 'How are we doing on calculators?')
  assert.equal(t.kind, 'custom')
  assert.match(block(t, 'v2read').question, /calculators/)
  const pg = v2sections(t).find((x) => x.block.kind === 'promptGroups')
  assert.equal(pg.block.groups[0].theme, 'Calculators')
  assert.ok(pg.block.groups[0].rows.every((x) => x.named.length > 0))
  assert.ok(v2sections(t).some((x) => x.block.kind === 'notInData'))
  // a trend: the chart's lines are the engines that ran, never one that didn't
  const chart = v2sections(buildReport({ brand: 'foa' }, 'How has our visibility changed since September?')).find((x) => x.block.kind === 'trend').block
  assert.deepEqual(chart.lines.map((l) => l.key), ['score', 'aio', 'chatgpt', 'gemini'])
  assert.equal(chart.dates.length, chart.lines[0].series.length)
  // sentiment isn't in the report data: said, with where it is
  const se = v2sections(buildReport({ brand: 'foa' }, 'What do people think of us?')).at(-1).block
  assert.equal(se.kind, 'notInData')
  assert.equal(se.href, '/sentiment')
  // nothing read: the overview, and the strip says so
  assert.match(block(buildReport({ brand: 'foa' }, 'Tell me something'), 'v2read').note, /^Couldn’t read a narrower question/)
  // a weekly-style question stays the weekly; a question with no kind is custom; an empty question is the weekly
  assert.equal(resolveOpts({ brand: 'foa' }, 'How did we do this week?').kind, 'weekly')
  assert.equal(resolveOpts({ brand: 'foa' }, 'Which of our pages get cited?').kind, 'custom')
  assert.equal(resolveOpts({ brand: 'foa' }, '').kind, 'weekly')
})

test('follow-up chips: per report, from what its data can answer; never an engine that didn’t run; nothing adds an engine', () => {
  const r = buildReport({ brand: 'foa', kind: 'rival', compare: ['longbridge'] })
  const chips = followUpsFor(r)
  assert.deepEqual(chips.map((c) => c.text), ['Show the answers where Longbridge is named', 'Which pages should we write?', 'Make a client version', 'Only AI Overview answers'])
  for (const c of chips) assert.ok(c.ask || refine(r.opts, c.text), `${c.text}: a change the box understands`)
  // Dermasuri ran AI Overview and ChatGPT only
  for (const o of [{ kind: 'weekly', period: 'week' }, { kind: 'rival', compare: ['cerave'] }, { kind: 'content' }]) {
    const texts = followUpsFor(buildReport({ brand: 'dermasuri', ...o })).map((c) => c.text)
    assert.ok(texts.length > 0)
    assert.ok(!texts.some((x) => /Gemini|Claude|^Add /.test(x)), texts.join(' | '))
  }
  // one engine already and a client audience: no "Only" chip for it, no client version
  assert.ok(!followUpsFor(buildReport({ brand: 'foa', kind: 'weekly', engines: ['aio'], audience: 'client' })).some((c) => /client|Only AI Overview/.test(c.text)))
  assert.equal(followUpsFor(buildReport({ brand: 'foa' }, 'Show the answers where Longbridge is named'))[0].text, 'Where is Longbridge beating us?')
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
  assert.match(r.frame.table.note, /Claude didn’t run/)
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
  assert.deepEqual(refine(o, 'Only ChatGPT answers').opts.engines, ['chatgpt'])
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

test('the thread: the options line, the follow-up chips (each one understood), and a new report kept with the saved ones', () => {
  assert.equal(optsLine({ period: 'week', audience: 'team', length: 'one' }), 'This week · Team · One page')
  assert.deepEqual(stepsFor({ brand: 'foa', period: 'week' }), ['Reading 113 prompts', 'Comparing 7 brands', 'Writing the summary'])
  const w = buildReport({ brand: 'dermasuri', kind: 'weekly', period: 'week', length: 'detailed' })
  assert.deepEqual(followUpsFor(w).map((c) => c.text), ['Make it shorter', 'Focus on CeraVe', 'Make a client version', 'Only AI Overview answers'])
  for (const c of followUpsFor(w)) assert.ok(refine(w.opts, c.text), c.text)
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
  assert.equal(r.frame.range, 'Oct 19–26')
  assert.equal(r.frame.frequency, 'week', 'the weekly summary is scheduled weekly')
  const f = r.blocks.find((b) => b.type === 'sources').data
  assert.deepEqual(f.engines, ['AI Overview', 'ChatGPT'])
  assert.deepEqual(f.off, ['Gemini', 'Claude'])
  assert.match(r.frame.table.note, /Gemini and Claude didn’t run\.$/)
  assert.equal(r.frame.table.title, 'Topics')
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
  const titles = (o) => { const r = buildReport({ brand: 'dermasuri', length: 'detailed', ...o }); return r.v3 ? r.frame.steps.map((a) => a.title) : r.v2 ? v2sections(r).find((x) => x.block.kind === 'steps').block.items.map((a) => a.title) : table(r).rows.map((a) => a.action).filter(Boolean) }
  const sets = [titles({ kind: 'weekly', period: 'week' }), titles({ kind: 'ceo' }), titles({ kind: 'rival', compare: ['cerave'] }), titles({ kind: 'content' })]
  for (const x of sets) assert.ok(x.length > 0)
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) assert.ok(!sets[i].some((t) => sets[j].includes(t)), `${i} and ${j} share an action`)
})

test('v7: the client update speaks to the client in the same frame', () => {
  const r = buildReport({ brand: 'dermasuri', kind: 'weekly', period: '30d', audience: 'client', length: 'detailed' })
  assert.equal(r.frame.question, 'What moved this month?')
  assert.match(r.frame.finding, /^You’re in \d+ more AI answers than Sep 28/)
  assert.equal(r.frame.chart.since, 'Sep 28')
  assert.equal(r.frame.table.columns.at(-1).label, 'What we’re doing next')
  assert.ok(r.frame.table.rows.filter((x) => x.next).every((x) => x.next.startsWith('We’ll ')))
})
