import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DATES, scoreStrip, shortRange, addReport, optsLine, refineSuggestions, reportById, updateReport, buildReport, dataFor, glance, inferOpts, libraryItems, refine, resolveOpts, runSummary, savedReports, schedules, stepsFor, suggestionsFor, templatesFor, weekGroup, weeklyRuns } from './reports.js'

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
  assert.equal(sections(r).filter((s) => s.visual.rows?.some((x) => x.you && x.now != null)).length, 1, 'share of voice in one section')
  // the decisions, by impact
  const n = block(r, 'actions').items.map((a) => a.n)
  assert.deepEqual(n, [...n].sort((a, b) => b - a))
  assert.equal(block(r, 'actions').layout, 'ranked')
  // what changed: the topics that moved, biggest first
  const moves = sections(r).find((s) => s.id === 'changed').visual.rows.map((x) => Math.abs(x.d))
  assert.deepEqual(moves, [...moves].sort((a, b) => b - a))
})

test('engines: won + held = the prompts each engine names; that matches its share', () => {
  for (const brand of ['foa', 'dermasuri']) {
    const r = buildReport({ brand, kind: 'weekly', period: 'week', length: 'detailed' })
    for (const e of sections(r).find((s) => s.id === 'engines').visual.rows.filter((x) => !x.off)) {
      assert.equal(e.won + e.held, e.named, `${brand} ${e.id}`)
      assert.equal(Math.round((e.named / dataFor(brand).prompts) * 100), e.now, `${brand} ${e.id}`)
    }
  }
})

test('head-to-head: the waffle adds up; the split and the topics match', () => {
  for (const [brand, rival] of [['foa', 'longbridge'], ['dermasuri', 'cerave']]) {
    const r = buildReport({ brand, kind: 'rival', compare: [rival], length: 'detailed' })
    const g = Object.fromEntries(sections(r)[0].visual.groups.map((x) => [x.key, x.n]))
    assert.equal(Object.values(g).reduce((a, b) => a + b, 0), dataFor(brand).prompts)
    const theirs = g.onlyThem + g.themFirst
    assert.equal(hero(r).visual.them.n, theirs)
    assert.equal(hero(r).visual.you.n, g.onlyYou + g.youFirst)
    assert.equal(sections(r)[1].visual.rows.reduce((a, t) => a + t.n, 0), theirs)
  }
  assert.match(buildReport({ brand: 'foa', kind: 'rival', compare: ['longbridge'] }).headline, /^Longbridge wins 23 prompts/)
})

test('content plan: topic gaps add up to the prompts missing; the red part to those a competitor takes', () => {
  const r = buildReport({ brand: 'foa', kind: 'content', length: 'detailed' })
  const v = hero(r).visual
  assert.equal(sections(r)[0].visual.rows.reduce((a, t) => a + t.n, 0), v.missing)
  assert.equal(sections(r)[0].visual.rows.reduce((a, t) => a + t.part, 0), v.owned)
  assert.equal(sections(r)[1].visual.rows.reduce((a, t) => a + t.now, 0), v.owned)
  assert.match(r.headline, /^Calculators first: Longbridge holds 7 of its 8 prompts/)
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
