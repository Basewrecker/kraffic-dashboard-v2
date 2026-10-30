import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DATES, library, seriesRuns, scoreStrip, shares, shortRange, addReport, optsLine, followUpsFor, reportById, updateReport, buildReport, dataFor, glance, inferOpts, libraryItems, refine, resolveOpts, runSummary, savedReports, schedules, stepsFor, suggestionsFor, templatesFor, weekGroup, weeklyRuns } from './reports.js'

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

test('shares add up to 100 by largest remainder', () => {
  assert.deepEqual(shares([57, 23, 33]), [51, 20, 29])
  assert.deepEqual(shares([9, 102, 2, 39]), [6, 67, 1, 26])
  assert.deepEqual(shares([1, 1, 1]), [34, 33, 33])
  assert.deepEqual(shares([0, 0]), [0, 0])
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

test('verdicts: Good week / Mixed / Tough week; Winning / Mixed / Losing', () => {
  assert.equal(buildReport({ brand: 'foa', kind: 'weekly', period: 'week' }).verdict, 'Good week')
  assert.equal(buildReport({ brand: 'foa', kind: 'ceo' }).verdict, 'Winning')
  assert.equal(buildReport({ brand: 'foa', kind: 'rival', compare: ['longbridge'] }).verdict, 'Mixed')
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


// ---- the standard frame ------------------------------------------------------------------------------------------
const ENGINE_NAME = { aio: 'AI Overview', chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude' }
const FRAMES = (brand) => [{ kind: 'weekly', period: 'week' }, { kind: 'weekly', period: '30d', audience: 'client' }, { kind: 'ceo', period: '30d' }, { kind: 'rival', compare: [RIVAL[brand]] }, { kind: 'content' }]
const words = (s) => s.split(/\s+/).length

test('the standard frame: every kind is a header · KPI strip · two visuals · a slim table; engines that didn’t run are named, never estimated', () => {
  for (const brand of ['foa', 'dermasuri']) {
    const d = dataFor(brand)
    for (const o of FRAMES(brand)) {
      const r = buildReport({ brand, length: 'detailed', ...o })
      const f = r.frame
      const k = `${brand} ${o.kind} ${o.audience ?? ''}`
      assert.equal(r.v3, true, k)
      assert.ok(f.question && f.finding, k)
      assert.ok(f.kpis.length >= 4 && f.kpis.length <= 5, k)
      for (const x of f.kpis) assert.ok(x.label && (x.value != null || x.text), `${k}: ${x.label}`)
      assert.ok(['columns', 'lines'].includes(f.left.kind), k)
      assert.ok(f.left.label && f.left.legend.length >= 1 && f.left.legend.length <= 3, k)
      assert.ok(['stacked', 'diverging', 'standings'].includes(f.right.kind) && f.right.label, k)
      if (f.right.byEngine) {
        assert.ok(f.right.byEngine.rows.every((e) => d.ran.includes(e.id)), `${k}: only engines that ran`)
        assert.deepEqual(f.right.byEngine.off, Object.keys(ENGINE_NAME).filter((e) => !d.ran.includes(e)).map((e) => ENGINE_NAME[e]), `${k}: the ones that didn’t`)
      }
      assert.ok(f.table.rows.length > 0 && f.table.rows.every((x) => x.id && x.text), k)
      assert.ok(f.steps.length > 0 && f.steps.every((st) => /^\/tracker\?topic=/.test(st.action.href)), k)
      assert.equal(block(r, 'sources').syncs, o.period === 'week' ? 2 : 5, k)
      assert.deepEqual(block(r, 'sources').off, Object.keys(ENGINE_NAME).filter((e) => !d.ran.includes(e)).map((e) => ENGINE_NAME[e]), k)
    }
  }
})

test('weekly summary (frame): the KPIs, the 8-week chart, the net change by topic, the engine lines, the topics table with short next steps and prompts to open', () => {
  const d = dataFor('dermasuri')
  const r = buildReport({ brand: 'dermasuri', kind: 'weekly', period: 'week', length: 'detailed' })
  const f = r.frame
  assert.equal(f.question, 'What moved this week?')
  assert.equal(f.finding, 'Dermasuri is in 7 more AI answers than last week, led by keratosis pilaris. Sensitive skin slipped.')
  assert.deepEqual(f.kpis.map((x) => [x.label, x.value, x.delta ?? null]), [['Answers naming Dermasuri', 111, 7], ['Won this week', 9, null], ['Lost this week', 2, null], ['Visibility score', 70, 4], ['Share of voice', 73, 3]])
  assert.ok(f.kpis.filter((x) => x.delta != null).every((x) => x.since === 'last week'))
  assert.deepEqual(f.left.bands.map((b) => b.bars[0].value), d.series.named)
  assert.deepEqual(f.left.bands.map((b) => b.bars[0].tone), [...Array(7).fill('tint'), 'primary'])
  assert.equal(f.right.kind, 'diverging')
  assert.equal(f.right.rows.reduce((a, x) => a + x.d, 0), d.flow.week.won - d.flow.week.lost, 'the topic changes add up to the net')
  assert.deepEqual(f.right.rows.filter((x) => x.d === 0).map((x) => x.label), ['Moisturising', 'Body wash'])
  assert.deepEqual(f.right.byEngine.rows.map((e) => e.text), ['AI Overview +6', 'ChatGPT +1 (3 won, 2 lost)'])
  assert.deepEqual(f.right.byEngine.off, ['Gemini', 'Claude'])
  assert.deepEqual(f.table.columns.map((c) => c.key), ['text', 'net', 'engines', 'step'])
  assert.equal(f.table.expandable, true)
  const rows = Object.fromEntries(f.table.rows.map((x) => [x.text, x]))
  assert.equal(rows['Keratosis pilaris'].net, 4)
  assert.deepEqual(rows['Keratosis pilaris'].engines, ['aio', 'chatgpt'])
  assert.equal(rows['Keratosis pilaris'].step, null)
  assert.equal(rows['Sensitive skin'].step.label, 'Write a sensitive-skin guide')
  assert.equal(rows['Moisturising'].step.label, 'Add ‘after exfoliating’ to how-to')
  assert.equal(rows['Body wash'].step.label, 'Pitch the mitt to dermatologists')
  for (const x of f.table.rows) if (x.step) assert.ok(words(x.step.label) <= 6, x.step.label)
  assert.deepEqual(rows['Sensitive skin'].expand.lines, ['ChatGPT · 2 lost'])
  assert.ok(rows['Sensitive skin'].expand.prompts.length > 0)
  // every topic's engine moves add up to the engine lines
  for (const period of ['week', '30d']) {
    const won = {}
    const lost = {}
    for (const m of d.moved[period]) for (const [e, n] of Object.entries(m.engines)) { if (m.d > 0) won[e] = (won[e] ?? 0) + n; else lost[e] = (lost[e] ?? 0) + n }
    for (const [e, x] of Object.entries(d.engines)) { assert.equal(won[e] ?? 0, x[period][0], `${period} ${e} won`); assert.equal(lost[e] ?? 0, x[period][1], `${period} ${e} lost`) }
  }
  // the client's version speaks to the client
  const c = buildReport({ brand: 'dermasuri', kind: 'weekly', period: '30d', audience: 'client', length: 'detailed' }).frame
  assert.equal(c.question, 'What moved this month?')
  assert.match(c.finding, /^You’re in \d+ more AI answers than Sep 28/)
  assert.equal(c.table.columns.at(-1).label, 'What we’re doing next')
  assert.ok(c.table.rows.filter((x) => x.step).every((x) => x.step.label.startsWith('We’ll ')))
})

test('competitor gap (frame): the KPIs lead with the prompts they win; the chart is us vs them per topic by our lead; head to head holds every prompt once; the table of the prompts they win', () => {
  for (const [brand, rival] of Object.entries(RIVAL)) {
    const d = dataFor(brand)
    const h = d.h2h[rival]
    const f = buildReport({ brand, kind: 'rival', compare: [rival], length: 'detailed' }).frame
    const theirs = h.onlyThem + h.themFirst
    const ours = h.onlyYou + h.youFirst
    assert.equal(f.kpis[0].value, theirs)
    assert.equal(f.kpis[0].worseUp, true)
    assert.equal(f.kpis[0].delta, h.theyWin.at(-1) - h.theyWin[3])
    assert.equal(f.kpis[0].since, DATES[3])
    assert.deepEqual(f.kpis.slice(1).map((x) => x.value), [ours, h.neither, h.byTopic.filter((t) => t.them > t.you).length, h.citedYou.length])
    assert.equal(f.left.bands.reduce((a, b) => a + b.bars[0].value, 0), h.onlyYou + h.youFirst + h.themFirst)
    assert.equal(f.left.bands.reduce((a, b) => a + b.bars[1].value, 0), h.onlyThem + h.themFirst + h.youFirst)
    const leads = f.left.bands.map((b) => b.bars[0].value - b.bars[1].value)
    assert.deepEqual(leads, [...leads].sort((a, b) => b - a), 'by our lead')
    assert.deepEqual(f.left.legend.map((l) => l.tone), ['primary', 'rival'])
    assert.deepEqual(f.right.bar.map((x) => x.n), [ours, theirs, h.neither])
    assert.equal(f.right.bar.reduce((a, x) => a + x.n, 0), d.prompts, 'every prompt once')
    assert.equal(f.right.bar.reduce((a, x) => a + x.share, 0), 100)
    for (const e of f.right.byEngine.rows) { assert.equal(e.segs.reduce((a, x) => a + x.n, 0), d.prompts, e.name); assert.equal(e.note, `${h.engines[e.id].n} lost`) }
    assert.equal(f.table.rows.length, theirs)
    for (const x of f.table.rows) { assert.ok(x.topic && x.engineName && x.result && x.page?.n, x.text); assert.equal(x.strong, x.result.startsWith('Only ')) }
    for (const [e, c] of Object.entries(h.engines)) assert.equal(f.table.rows.filter((x) => x.engine === e).length, c.n, e)
    assert.deepEqual(f.table.filters.map((x) => x.key), ['topic', 'engine'])
    assert.equal(f.table.pageSize, 10)
  }
  assert.match(buildReport({ brand: 'dermasuri', kind: 'rival', compare: ['cerave'] }).frame.finding, /^CeraVe wins 18 of your 152 prompts/)
})

test('CEO summary (frame): the finding, the KPIs, share of voice by week (3 lines, 0–100), where you stand, the topics table with the lead and the change, the pages AI cites most', () => {
  const d = dataFor('dermasuri')
  const f = buildReport({ brand: 'dermasuri', kind: 'ceo', period: '30d', length: 'detailed' }).frame
  assert.equal(f.question, 'Are we winning in AI search?')
  assert.equal(f.finding, 'Yes. Dermasuri is in 73% of AI answers, four times CeraVe, and the lead grew 10 points.')
  assert.deepEqual(f.kpis.map((x) => [x.label, x.value, x.delta ?? null]), [['Share of voice', 73, 7], ['Lead over CeraVe', 55, 10], ['Topics you lead', 4, null], ['Answers won', 18, null], ['Answers lost', 4, null]])
  assert.ok(f.kpis.filter((x) => x.delta != null).every((x) => x.since === 'Sep 28'))
  assert.equal(f.kpis[2].of, 6)
  assert.equal(f.left.kind, 'lines')
  assert.equal(f.left.max, 100)
  assert.deepEqual(f.left.series.map((s) => [s.label, s.tone, s.width]), [['Dermasuri', 'primary', 2.5], ['CeraVe', 'rival', 2], ['All other brands', 'tint', 1.5]])
  assert.equal(f.left.series[0].values.length, f.left.dates.length)
  assert.deepEqual(f.left.series[2].values, d.share.theordinary.slice(3).map((v, i) => v + d.share.paulaschoice.slice(3)[i]))
  assert.equal(f.right.kind, 'standings')
  assert.deepEqual(f.right.rows.map((x) => x.tone), ['primary', 'rival', 'tint', 'tint'])
  assert.deepEqual(f.right.rows.map((x) => x.now), [...f.right.rows.map((x) => x.now)].sort((a, b) => b - a))
  assert.deepEqual(f.right.byEngine.rows.map((e) => e.text), ['AI Overview · 11 won · 1 lost', 'ChatGPT · 7 won · 3 lost'])
  assert.deepEqual(f.table.columns.map((c) => c.key), ['text', 'prompts', 'leader', 'lead', 'net', 'step'])
  assert.deepEqual(f.table.rows.map((x) => x.text), d.topicLead.map((t) => t.theme))
  for (const [i, x] of f.table.rows.entries()) {
    const t = d.topicLead[i]
    assert.equal(x.lead, t.d)
    assert.equal(x.prompts, t.prompts)
    assert.equal(x.leader.name, t.d > 0 ? 'Dermasuri' : t.who)
    assert.ok(x.leader.domain, x.text)
    if (t.d < 0) { assert.match(x.step.label, /^Win back /); assert.ok(words(x.step.label) <= 6) } else assert.equal(x.step, null)
  }
  assert.equal(f.table.rows.find((x) => x.text === 'Keratosis pilaris').net, 7)
  assert.equal(f.table.rows.find((x) => x.text === 'Ingrown hairs').net, 0)
  assert.equal(f.pages.rows.length, 3)
  assert.deepEqual(f.pages.rows[0], { path: '/products/dermasuri-deep-exfoliating-mitt', type: 'Product page', n: 21 })
  // behind: the finding says so
  assert.match(buildReport({ brand: 'foa', kind: 'ceo', period: '30d' }).frame.finding, /^(Yes|Not yet)\./)
})

test('missing prompts (frame): the KPIs add up; missing by topic; who’s named; the topics to write for with short next steps', () => {
  for (const brand of ['foa', 'dermasuri']) {
    const d = dataFor(brand)
    const f = buildReport({ brand, kind: 'content', length: 'detailed' }).frame
    const missing = d.prompts - d.series.named.at(-1)
    const owned = d.ownedSeries.at(-1)
    assert.equal(f.question, 'Which prompts are we missing?')
    assert.deepEqual(f.kpis.slice(0, 4).map((x) => x.value), [missing, owned, missing - owned, d.gaps.length])
    assert.ok(f.kpis[4].text)
    assert.equal(f.left.bands.length, d.gaps.length)
    for (const b of f.left.bands) { const g = d.gaps.find((x) => x.theme === b.label); assert.equal(b.bars[0].value + b.bars[1].value, g.missing, b.label) }
    assert.equal(f.right.bar.reduce((a, x) => a + x.n, 0), d.prompts)
    assert.ok(f.right.list.rows.length > 0)
    assert.equal(f.table.rows.length, d.gaps.length)
    for (const x of f.table.rows) { assert.ok(x.leader.name && x.step.label && words(x.step.label) <= 6, x.text); assert.ok(x.expand.prompts.length > 0) }
    assert.deepEqual(f.table.filters.map((x) => x.key), ['owner'])
  }
})

test('custom question (frame): the frame that answers it, one "How I read your question" line, and a "Not in your data" note for what isn’t', () => {
  const c = buildReport({ brand: 'foa', length: 'detailed' }, 'Show the answers where Longbridge is named')
  assert.equal(c.kind, 'custom')
  assert.equal(c.v3, true)
  assert.match(c.frame.read, /^How I read your question: Prompts where AI names Longbridge Financial/)
  assert.match(c.frame.read, /vs Longbridge Financial · Sep 28 – Oct 26 · AI Overview, ChatGPT, Gemini$/)
  assert.equal(c.frame.question, 'Show the answers where Longbridge is named')
  assert.equal(c.frame.right.kind, 'stacked')
  assert.equal(c.frame.frequency, 'once')
  assert.deepEqual(stepsFor(c.opts)[0], 'Reading your question')
  // a topic: that topic alone, and what the data doesn't hold
  const t = buildReport({ brand: 'foa' }, 'How are we doing on calculators?')
  assert.match(t.frame.read, /calculators/)
  assert.deepEqual(t.frame.table.rows.map((x) => x.text), ['Calculators'])
  assert.match(t.frame.notInData[0], /^The total prompts in calculators/)
  // sentiment isn't in the report data
  assert.match(buildReport({ brand: 'foa' }, 'What do people think of us?').frame.notInData.at(-1), /^Sentiment isn’t in the report data/)
  // nothing read: the overview, and the note says so
  assert.match(buildReport({ brand: 'foa' }, 'Tell me something').frame.notInData[0], /^Couldn’t read a narrower question/)
  assert.equal(resolveOpts({ brand: 'foa' }, 'How did we do this week?').kind, 'weekly')
  assert.equal(resolveOpts({ brand: 'foa' }, 'Which of our pages get cited?').kind, 'custom')
  assert.equal(resolveOpts({ brand: 'foa' }, '').kind, 'weekly')
})

test('what to do follows the question: no two kinds of report suggest the same steps', () => {
  const titles = (o) => buildReport({ brand: 'dermasuri', length: 'detailed', ...o }).frame.steps.map((a) => a.title)
  const sets = [titles({ kind: 'weekly', period: 'week' }), titles({ kind: 'ceo' }), titles({ kind: 'rival', compare: ['cerave'] }), titles({ kind: 'content' })]
  for (const x of sets) assert.ok(x.length > 0)
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) assert.ok(!sets[i].some((t) => sets[j].includes(t)), `${i} and ${j} share a step`)
})
