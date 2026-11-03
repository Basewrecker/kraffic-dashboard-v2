// Softer report verdicts (verdicts.js): no report says "Tough week" / "Losing" any more; the softer words are Slower
// week / Slower month / Room to grow (and Dipped), with a muted amber dot (var(--caution)), never red. Good week /
// Good month / Winning / Opportunity / Mixed are unchanged. Reports saved before the change keep their stored word,
// so every place that shows a verdict maps the old word to the new one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VERDICT_RENAME, VERDICT_TONE, verdictTone, verdictWord } from './verdicts.js'
import { buildReport, libraryItems, savedReports, schedules, seriesRuns, weeklyRuns } from './reports.js'
import { buildLiveReport } from './live-report.js'

const OLD = /\b(Tough|Losing)\b/
const SOFT = ['Slower week', 'Slower month', 'Room to grow', 'Dipped']
const KEPT = { 'Good week': 'up', 'Good month': 'up', Winning: 'up', Opportunity: 'mid', Mixed: 'mid' }
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

test('old stored words display as the new ones; kept words are unchanged', () => {
  assert.equal(verdictWord('Tough week'), 'Slower week')
  assert.equal(verdictWord('Tough month'), 'Slower month')
  assert.equal(verdictWord('Losing'), 'Room to grow')
  for (const w of [...Object.keys(KEPT), ...SOFT]) assert.equal(verdictWord(w), w)
  assert.equal(verdictWord(null), null)
  assert.equal(verdictTone('Something new'), 'mid')
  for (const [w, tone] of Object.entries(KEPT)) assert.equal(verdictTone(w), tone, w)
})

test('the softer words (and the old ones they replace) take the amber tone, never red', () => {
  for (const w of [...SOFT, ...Object.keys(VERDICT_RENAME)]) assert.equal(verdictTone(w), 'caution', w)
  assert.ok(!Object.values(VERDICT_TONE).includes('down'))
  for (const w of Object.keys(VERDICT_TONE)) assert.doesNotMatch(w, OLD)
})

test('no verdict producer writes an old word', () => {
  for (const p of ['./reports.js', './live-report.js']) {
    const src = read(p)
    assert.doesNotMatch(src, /verdict[^\n]*['`](Tough|Losing)/, p)
    assert.doesNotMatch(src, /word = [^\n]*['`](Tough|Losing)/, p)
  }
  const seen = new Set()
  const look = (v, at) => { if (v == null) return; const w = typeof v === 'string' ? v : v.word; seen.add(w); assert.doesNotMatch(w, OLD, at) }
  for (const brand of ['foa', 'dermasuri']) {
    for (const kind of ['weekly', 'ceo', 'rival', 'content', 'custom']) for (const period of ['week', '30d', 'quarter']) {
      const r = buildReport({ brand, kind, period })
      if (r.ok) look(r.verdict, `${brand} ${kind} ${period}`)
    }
    for (const r of weeklyRuns(brand)) look(r.verdict, `${brand} run ${r.id}`)
  }
  for (const s of schedules) for (const r of seriesRuns(s)) look(r.verdict, `series ${s.id}`)
  for (const s of savedReports) look(buildReport(s.opts, s.prompt).verdict, s.id)
  for (const r of libraryItems()) look(r.verdict, `library ${r.id}`)
  assert.ok(seen.has('Slower week'), 'the mock data still has a slower week to show')
})

test('live reports: a down week / month and a behind brand read as Slower week / Slower month / Room to grow', () => {
  const facts = {
    brandId: 'b-acme', name: 'Acme Lending', domain: 'acme-lending.test', prompts: 50, scans: 6, score: 40, visible: 20, missed: 30, youShare: 20,
    compared: true, since: 'Oct 19', gained: [], lost: ['refinance calculator', 'cash out refinance rates'], ran: ['aio'], engines: [{ id: 'aio', name: 'AI Overview', visible: 20 }],
    competitors: [{ key: 'northbeam', domain: 'northbeam.test', name: 'Northbeam', share: 48 }],
    missedRows: [{ prompt: 'refinance calculator', competitors: ['northbeam.test'], topic: null, engines: ['aio'], named: [{ domain: 'northbeam.test', engines: ['aio'] }] }],
    gainedRows: [], lostRows: [{ prompt: 'refinance calculator', topic: null, engines: ['aio'] }], cited: [],
    points: [{ iso: '2026-10-19', date: 'Oct 19', score: 44, visible: 22 }, { iso: '2026-10-26', date: 'Oct 26', score: 40, visible: 20 }],
  }
  const opts = (kind, period) => ({ brand: facts.brandId, kind, audience: 'team', period, compare: kind === 'rival' ? ['northbeam'] : [], engines: [] })
  assert.equal(buildLiveReport(facts, '', opts('weekly', 'week')).verdict, 'Slower week')
  assert.equal(buildLiveReport(facts, '', opts('weekly', '30d')).verdict, 'Slower month')
  assert.equal(buildLiveReport(facts, '', opts('ceo', '30d')).verdict, 'Room to grow')
  assert.equal(buildLiveReport(facts, '', opts('rival', '30d')).verdict, 'Room to grow')
})

test('the CEO report behind a competitor: "the gap is holding steady", never "isn’t closing"', () => {
  const src = read('./reports.js')
  assert.match(src, /and the gap is holding steady\./)
  assert.doesNotMatch(src, /gap isn.t closing/)
})

test('verdict labels are never red: no text-negative / --negative on the verdict; the dot is var(--caution)', () => {
  const blocks = read('../pages/reports/blocks.jsx')
  for (const name of ['VerdictChip', 'VerdictDot']) {
    const at = blocks.indexOf(`export function ${name}`)
    const body = blocks.slice(at, blocks.indexOf('\n}\n', at))
    assert.doesNotMatch(body, /negative|\bRED\b/, name)
    assert.match(body, /verdictWord\(verdict\)/, name)
  }
  assert.match(blocks, /caution: 'var\(--caution\)'/)
  const lib = read('../pages/reports/library.jsx')
  const at = lib.indexOf('export function Verdict(')
  const verdict = lib.slice(at, lib.indexOf('\n}\n', at))
  assert.doesNotMatch(verdict, /negative|\bRED\b/)
  assert.match(verdict, /var\(--caution\)/)
  for (const p of ['../pages/reports/ReportsPages.jsx', '../pages/reports/ScheduledPage.jsx']) {
    const src = read(p)
    const dot = src.match(/const TONE_DOT = \{[^}]*\}/)[0]
    assert.doesNotMatch(dot, /negative/, p)
    assert.match(dot, /caution: 'var\(--caution\)'/, p)
    assert.match(src, /verdictWord\(/, p)
  }
})
