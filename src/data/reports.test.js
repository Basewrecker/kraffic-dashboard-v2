import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DATES, library, seriesRuns, scoreStrip, shortRange, addReport, optsLine, refineSuggestions, reportById, updateReport, buildReport, dataFor, glance, inferOpts, libraryItems, refine, resolveOpts, runSummary, savedReports, schedules, stepsFor, suggestionsFor, templatesFor, weekGroup, weeklyRuns } from './reports.js'

const types = (r) => r.blocks.map((b) => b.type)
const block = (r, type) => r.blocks.find((b) => b.type === type)?.data
const sections = (r) => r.blocks.filter((b) => b.type === 'section').map((b) => b.data)

const hero = (r) => block(r, 'hero')
const chipOf = (r, id) => hero(r).chips.find((c) => c.id === id)

test('every report has the same bands: hero · sections · action cards · footer', () => {
  for (const kind of ['weekly', 'ceo', 'rival', 'content']) {
    const r = buildReport({ brand: 'foa', kind, period: '30d', length: 'detailed', compare: kind === 'rival' ? ['longbridge'] : [] })
    assert.equal(r.ok, true, kind)
    assert.deepEqual(types(r).filter((t) => t !== 'section'), ['hero', 'actions', 'sources'], kind)
    assert.equal(hero(r).chips.length, 3, `${kind}: 3 stat chips`)
    assert.ok(block(r, 'actions').items.length <= 3, kind)
    assert.ok(sections(r).every((s) => s.takeaway && !s.takeaway.includes('. ', s.takeaway.length - 2) && s.visual), `${kind}: one takeaway + a visual`)
    // the weekly's history is the hero's score strip; the others keep one trend chart
    assert.equal(sections(r).filter((s) => s.visual.kind === 'trend').length, ['weekly', 'ceo'].includes(kind) ? 0 : 1, `${kind}: trend`)
  }
})

test('each kind has its own hero visual; the weekly sections are in the agreed order', () => {
  const visual = (kind) => hero(buildReport({ brand: 'foa', kind, compare: kind === 'rival' ? ['longbridge'] : [] })).visual.kind
  assert.deepEqual(['weekly', 'ceo', 'rival', 'content'].map(visual), ['strip', 'lead', 'split', 'gap'])
  const w = buildReport({ brand: 'dermasuri', kind: 'weekly', period: 'week', length: 'detailed' })
  assert.deepEqual(sections(w).map((s) => s.title), ['What moved', 'Where you stand', 'By topic', 'By engine'])
  assert.equal(block(w, 'actions').title, 'What to do')
})

test('the weekly waffle accounts for every prompt, and matches the ring and the chips', () => {
  for (const brand of ['foa', 'dermasuri']) {
    for (const period of ['week', '30d', 'quarter']) {
      const r = buildReport({ brand, kind: 'weekly', period, length: 'detailed' })
      const g = Object.fromEntries(sections(r)[0].visual.groups.map((x) => [x.key, x.n]))
      const named = chipOf(r, 'named')
      assert.equal(g.won + g.held + g.lost + g.missing, dataFor(brand).prompts, `${brand} ${period}`)
      assert.equal(g.won + g.held, named.value, `${brand} ${period}: named now`)
      assert.equal(g.held + g.lost, named.value - named.delta, `${brand} ${period}: named at the start`)
      assert.equal(named.of, dataFor(brand).prompts)
      assert.equal(hero(r).visual.value, dataFor(brand).series.score.at(-1))
      assert.equal(hero(r).visual.weeks.length, 8)
    }
  }
  // a square's prompt is only shown when the report holds exactly that group's prompts
  const groups = sections(buildReport({ brand: 'dermasuri', kind: 'weekly', period: 'week' }))[0].visual.groups
  assert.equal(groups.find((x) => x.key === 'won').prompts.length, 9)
  assert.equal(groups.find((x) => x.key === 'lost').prompts.length, 2)
  assert.equal(groups.find((x) => x.key === 'held').prompts, undefined)
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

test('where you stand: every brand by share, you included, sorted; the CEO trend is you and the top 2 in brand colours', () => {
  const r = buildReport({ brand: 'foa', kind: 'weekly', period: 'week', length: 'detailed' })
  const rows = sections(r).find((s) => s.id === 'stand').visual.rows
  assert.equal(rows.length, dataFor('foa').rivals.length + 1)
  assert.ok(rows.some((x) => x.you))
  assert.deepEqual(rows.map((x) => x.now), [...rows.map((x) => x.now)].sort((a, b) => b - a))
  const lines = sections(buildReport({ brand: 'foa', kind: 'rival', compare: ['longbridge'], length: 'detailed' })).find((s) => s.id === 'trend').visual.lines
  assert.equal(lines.length, 2)
  assert.ok(lines[0].you && /^var\(--line-[123]\)$/.test(lines[1].color))
  assert.ok(lines.every((l) => l.series.length === 8))
})

test('CEO v6: one visual type per section; share of voice, visibility and prompts named each in one place', () => {
  const one = buildReport({ brand: 'dermasuri', kind: 'ceo', period: '30d', length: 'one' })
  assert.deepEqual(sections(one).map((s) => s.visual.kind), ['dumbbell', 'engineCols'])
  const r = buildReport({ brand: 'dermasuri', kind: 'ceo', period: '30d', length: 'detailed' })
  const kinds = sections(r).map((s) => s.visual.kind)
  assert.deepEqual(kinds, ['dumbbell', 'engineCols', 'diverging', 'citeShare', 'changeTable'])
  assert.equal(new Set(kinds).size, kinds.length)
  // the hero's lead chart: 30 days (5 syncs), you and the closest competitor; the stat row has no share of voice
  const v = hero(r).visual
  assert.equal(v.kind, 'lead')
  assert.equal(v.dates.length, 5)
  assert.equal(v.them.name, 'CeraVe')
  assert.equal(v.you.series.at(-1) - v.them.series.at(-1), chipOf(r, 'lead').value)
  assert.deepEqual(hero(r).chips.map((c) => c.id), ['lead', 'named', 'score'])
  assert.equal(v.lead, chipOf(r, 'lead').value)
  assert.equal(v.leadDelta, chipOf(r, 'lead').delta)
  assert.equal(v.label, 'Lead over CeraVe · last 30 days')
  // by engine: a slot for each of the 4 engines; the two that didn't run say so, with no number
  const eng = sections(r).find((s) => s.id === 'engines').visual.rows
  assert.deepEqual(eng.map((e) => e.id), ['aio', 'chatgpt', 'gemini', 'claude'])
  assert.deepEqual(eng.filter((e) => e.off).map((e) => e.id), ['gemini', 'claude'])
  assert.equal(eng[0].change, dataFor('dermasuri').engines.aio.now - dataFor('dermasuri').engines.aio.series[3])
  assert.equal(sections(r).filter((s) => s.visual.rows?.some((x) => x.you && x.now != null)).length, 1, 'share of voice in one section')
  // the decisions, by impact
  const n = block(r, 'actions').items.map((a) => a.n)
  assert.deepEqual(n, [...n].sort((a, b) => b - a))
  assert.equal(block(r, 'actions').layout, 'ranked')
  // what changed: the topics that moved, biggest first
  const moves = sections(r).find((s) => s.id === 'changed').visual.rows.map((x) => Math.abs(x.d))
  assert.deepEqual(moves, [...moves].sort((a, b) => b - a))
})

test('engines: the prompts each engine names match its share; the scoreboard reads won / lost and the change from the data', () => {
  for (const brand of ['foa', 'dermasuri']) {
    const d = dataFor(brand)
    for (const [id, e] of Object.entries(d.engines)) assert.equal(Math.round((e.named / d.prompts) * 100), e.now, `${brand} ${id}`)
    const r = buildReport({ brand, kind: 'weekly', period: 'week', length: 'detailed' })
    for (const e of sections(r).find((x) => x.id === 'engines').visual.rows.filter((x) => !x.off)) {
      assert.deepEqual([e.won, e.lost], d.engines[e.id].week, `${brand} ${e.id}`)
      assert.equal(e.change, d.engines[e.id].series[7] - d.engines[e.id].series[6])
    }
  }
})

test('head-to-head: the quadrant adds up; the split, the topics and the per-prompt data match', () => {
  for (const [brand, rival] of [['foa', 'longbridge'], ['dermasuri', 'cerave']]) {
    const r = buildReport({ brand, kind: 'rival', compare: [rival], length: 'detailed' })
    const q = sections(r)[0].visual
    assert.equal(q.kind, 'quadrant')
    assert.equal(q.onlyYou + q.youFirst + q.themFirst + q.onlyThem + q.neither, dataFor(brand).prompts)
    const theirs = q.onlyThem + q.themFirst
    assert.equal(hero(r).visual.them.n, theirs)
    assert.equal(hero(r).visual.you.n, q.onlyYou + q.youFirst)
    // the prompts they win: as many as the topics hold; each engine's share and the "only them" ones match the counts
    const where = sections(r).find((x) => x.id === 'where').visual
    assert.equal(where.groups.reduce((a, g) => a + g.items.length, 0), theirs)
    const h = dataFor(brand).h2h[rival]
    for (const e of where.engines) assert.equal(e.n, h.engines[e.id].n, `${brand} ${e.id}`)
    assert.equal(q.prompts.onlyThem.length, q.onlyThem)
    assert.equal(q.prompts.both.length, q.themFirst)
    assert.ok(!sections(r).some((x) => x.id === 'engines'), 'the per-engine counts live in Where they win')
    // why they win: one row per topic they win
    assert.deepEqual(sections(r).find((x) => x.id === 'why').visual.rows.map((w) => w.theme), h.themes.map((t) => t.theme))
    // the competitor in its brand colour, never red
    assert.match(hero(r).visual.color, /^var\(--line-\d\)$/)
  }
  assert.match(buildReport({ brand: 'foa', kind: 'rival', compare: ['longbridge'] }).headline, /^Longbridge wins 23 prompts/)
})

test('content plan: topic gaps add up to the prompts missing; the red part to those a competitor takes', () => {
  const r = buildReport({ brand: 'foa', kind: 'content', length: 'detailed' })
  const v = hero(r).visual
  assert.equal(sections(r)[0].visual.rows.reduce((a, t) => a + t.n, 0), v.missing)
  assert.equal(sections(r)[0].visual.rows.reduce((a, t) => a + t.part, 0), v.owned)
  assert.equal(sections(r)[1].visual.kind, 'ownerBoard')
  assert.equal(sections(r)[1].visual.rows.reduce((a, t) => a + t.n, 0), v.owned)
  assert.match(r.headline, /^Calculators first: Longbridge holds 7 of its 8 prompts/)
  assert.ok(block(r, 'actions').items.every((a) => a.type === 'New page'))
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
    const opts = [
      { kind: 'weekly', period: 'week' }, { kind: 'weekly', period: '30d', audience: 'client' }, { kind: 'ceo', period: '30d' },
      { kind: 'rival', compare: [brand === 'foa' ? 'longbridge' : 'cerave'] }, { kind: 'content' },
    ]
    for (const o of opts) {
      const r = buildReport({ brand, length: 'detailed', ...o })
      const bars = sections(r).filter((x) => BAR_KINDS.has(x.visual.kind)).map((x) => x.visual.kind)
      assert.ok(bars.length <= 1, `${brand} ${o.kind} ${o.audience ?? ''}: ${bars}`)
    }
  }
})

test('v7: what to do follows the question: no two kinds of report suggest the same actions', () => {
  const titles = (o) => block(buildReport({ brand: 'dermasuri', length: 'detailed', ...o }), 'actions').items.map((a) => a.title)
  const sets = [titles({ kind: 'weekly', period: 'week' }), titles({ kind: 'ceo' }), titles({ kind: 'rival', compare: ['cerave'] }), titles({ kind: 'content' })]
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) assert.ok(!sets[i].some((t) => sets[j].includes(t)), `${i} and ${j} share an action`)
  // the competitor's actions each close one of the gaps where they win, biggest first
  const rival = block(buildReport({ brand: 'dermasuri', kind: 'rival', compare: ['cerave'], length: 'detailed' }), 'actions').items
  assert.deepEqual(rival.map((a) => a.theme), ['Sensitive skin', 'Body wash', 'Moisturising'])
  assert.ok(rival.every((a) => /closes the .+ gap$/.test(a.meta)))
})

test('v7: the client update speaks to the client, with its own hero and sections', () => {
  const r = buildReport({ brand: 'dermasuri', kind: 'weekly', period: '30d', audience: 'client', length: 'detailed' })
  assert.equal(hero(r).client, true)
  assert.equal(hero(r).visual.kind, 'scoreLine')
  assert.equal(hero(r).visual.span, 'this month')
  assert.equal(hero(r).visual.series.length, 5)
  assert.match(r.headline, /^You’re in \d+ more AI answers than a month ago/)
  assert.deepEqual(sections(r).map((x) => x.visual.kind), ['waffle', 'dumbbell', 'diverging', 'engineCols'])
  assert.ok(sections(r).every((x) => x.client))
  const acts = block(r, 'actions')
  assert.equal(acts.title, 'What we’re doing next')
  assert.equal(acts.layout, 'ranked')
  assert.ok(acts.items.every((a) => a.title.startsWith('We’ll ')))
})
