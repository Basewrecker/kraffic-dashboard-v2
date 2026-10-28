// Run with: npm test. The logic and wording match the app's lib/citation-history.ts (app PRs #55, #56).
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  citationWeeks, enginesNotRun, loadWeeks, resetWeeks, setHistoryMock, setLoadDelay, setLoadTimeout, setToday,
  weekChanges, weekInsight, weekRows, weekSummary, weekTotals,
} from './citationHistory.js'
import { pagePath } from './brandViews.js'
import { citationsMentions } from './mock.js'

const ALL = ['aio', 'gemini', 'chatgpt', 'claude', 'grok']
const D = 'dermasuri.com'
const rowsOf = () => weekRows(D, 'all', ALL)
const changesOf = (rows, metric = 'mentions') => rows.map((r) => weekChanges({ domain: D, metric, row: r, engine: 'all' }))
afterEach(() => { setHistoryMock(undefined); setToday(null); setLoadTimeout(15000); setLoadDelay(null); resetWeeks() })

test('the newest week is the Now view', () => {
  const { weeks } = citationWeeks(D)
  const now = Object.values(citationsMentions[D])
  const t = weekTotals(weeks[0], 'all', ALL)
  assert.equal(t.mentions, now.reduce((n, [m]) => n + m, 0))
  assert.equal(t.citations, now.reduce((n, [, c]) => n + c, 0))
})

test('weekTotals counts the engines that ran and names the rest (ran, failed, approx)', () => {
  const { weeks } = citationWeeks(D)
  const t = weekTotals(weeks[4], 'all', ALL) // Sep 7 – 13: Gemini didn't run
  assert.deepEqual(t.failed, ['gemini'])
  assert.deepEqual(t.ran, ['aio', 'chatgpt', 'claude', 'grok'])
  assert.equal(t.approx, false)
  assert.equal(t.mentions, ['aio', 'chatgpt', 'claude', 'grok'].reduce((n, e) => n + weeks[4].engines[e].mentions, 0))
  // one engine in scope that didn't run: nothing is known, never 0
  assert.equal(weekTotals(weeks[4], 'gemini', ALL).mentions, null)
  setHistoryMock('approx')
  const a = weekTotals(citationWeeks(D).weeks[8], 'all', ALL)
  assert.equal(a.approx, true)
  assert.equal(a.citations, null) // the daily counts don't have citations
  assert.ok(a.mentions > 0)
})

test('a change only between weeks counted the same way: no delta when the engines differ ("counted differently")', () => {
  const rows = rowsOf()
  assert.equal(rows[4].differently, true) // Gemini didn't run
  assert.equal(rows[4].delta.mentions, null)
  assert.equal(rows[3].differently, true) // compared with that week
  assert.equal(rows[3].delta.mentions, null)
  assert.equal(rows[2].differently, false)
  assert.equal(rows[2].delta.mentions, rows[2].totals.mentions - rows[3].totals.mentions)
  assert.deepEqual(rows[2].compared, ALL)
  // exact vs daily counts: no delta either
  setHistoryMock('approx')
  const a = rowsOf()
  assert.equal(a[6].differently, true)
  assert.equal(a[6].delta.mentions, null)
  assert.equal(a[7].differently, false) // two approximate weeks compare
})

test('this week before its scan: "Scan due" a week after the last scan, no number, no change, never best / worst', () => {
  setToday('2026-10-14')
  const rows = rowsOf()
  assert.equal(rows[0].week.label, 'Oct 12 – 18')
  assert.equal(rows[0].scanDue, 'Oct 12') // the last scan (Oct 5) + 7 days
  assert.equal(rows[0].totals.mentions, null)
  assert.equal(rows[0].delta.mentions, null)
  assert.deepEqual(rows[0].totals.failed, [])
  assert.equal(weekSummary({ metric: 'mentions', row: rows[0], changes: null }), 'Scan due Oct 12')
  assert.equal(weekChanges({ domain: D, metric: 'mentions', row: rows[0], engine: 'all' }), null)
  assert.equal(rows[1].week.current, false) // the last scanned week isn't "this week" any more
})

test('a run of weeks with no data is one row, labelled from the oldest start to the newest end', () => {
  setHistoryMock('nodata')
  const rows = rowsOf()
  const row = rows.find((r) => r.week.empty)
  assert.equal(row.week.weeksSpanned, 3)
  assert.equal(row.week.label, 'Aug 17 – Sep 6')
  assert.equal(row.week.month, 'August') // the month the run ends in (Aug 31 – Sep 6 starts in August)
  assert.equal(rows.filter((r) => r.week.empty).length, 1)
  assert.equal(weekSummary({ metric: 'mentions', row, changes: null }), 'No data for 3 weeks')
  // the week after it compares with the last week before it
  const after = rows[rows.indexOf(row) - 1]
  assert.equal(after.skipped, true)
})

test('weekChanges is null unless both weeks were counted the same way with per-prompt detail', () => {
  const rows = rowsOf()
  assert.equal(weekChanges({ domain: D, metric: 'mentions', row: rows[4], engine: 'all' }), null) // an engine didn't run
  assert.equal(weekChanges({ domain: D, metric: 'mentions', row: rows[3], engine: 'all' }), null) // compared with it
  assert.equal(weekChanges({ domain: D, metric: 'mentions', row: rows.at(-1), engine: 'all' }), null) // nothing before
  assert.ok(weekChanges({ domain: D, metric: 'mentions', row: rows[2], engine: 'all' }))
  setHistoryMock('approx')
  const a = rowsOf()
  assert.equal(a[7].differently, false)
  assert.equal(weekChanges({ domain: D, metric: 'mentions', row: a[7], engine: 'all' }), null) // daily counts: no prompts
})

test('gained − lost matches the week’s change for citations and cited pages', () => {
  const rows = rowsOf()
  for (const metric of ['citations', 'pages']) {
    for (const row of rows) {
      const c = weekChanges({ domain: D, metric, row, engine: 'all' })
      if (!c) continue
      assert.equal(c.gained.length - c.lost.length, row.delta[metric], `${metric} week ${row.index}`)
    }
  }
})

test('week summaries (the app’s wording)', () => {
  const rows = rowsOf()
  const c = changesOf(rows)
  assert.equal(weekSummary({ metric: 'mentions', row: rows[0], changes: c[0] }), `This week so far · +${c[0].gained.length} prompts now mention you · ${c[0].lost.length} dropped`)
  assert.equal(weekSummary({ metric: 'mentions', row: rows[3], changes: null }), 'Details not available for this week · counted differently')
  assert.equal(weekSummary({ metric: 'mentions', row: rows[4], changes: null }), 'Details not available for this week · Gemini didn’t run · counted differently')
  assert.equal(weekSummary({ metric: 'mentions', row: rows.at(-1), changes: null }), 'Earliest week in this history')
  setHistoryMock('notrun')
  const n = rowsOf()
  assert.equal(weekSummary({ metric: 'mentions', row: n[0], changes: null }), 'This week so far · Claude didn’t run · counted differently')
  setHistoryMock('approx')
  const a = rowsOf()
  assert.equal(weekSummary({ metric: 'mentions', row: a[8], changes: null }), 'Details not available for this week · from the daily counts, counted the old way')
  assert.equal(weekSummary({ metric: 'citations', row: a[8], changes: null }), 'Details not available for this week · citations not known for this week')
})

test('the insight line: skips a scan-due week, names engines that didn’t run, never a 0', () => {
  const rows = rowsOf()
  const up = weekInsight({ metric: 'mentions', rows, changes: changesOf(rows) })
  assert.match(up.text, /^Your best week in 10 weeks: \d+ prompts started mentioning you$/)
  // a scan-due first row: the insight reads from the latest week with numbers
  setToday('2026-10-14')
  const due = rowsOf()
  assert.equal(weekInsight({ metric: 'mentions', rows: due, changes: changesOf(due) }).text, up.text)
  setToday(null)
  // an engine that didn't run this week is named
  setHistoryMock('notrun')
  const n = rowsOf()
  assert.match(weekInsight({ metric: 'mentions', rows: n, changes: changesOf(n) }).text, /^255 mentions this week so far \(Claude didn’t run\); the week before has nothing to compare$/)
  // no engine finished
  const none = { ...rows[1], totals: { ...rows[1].totals, ran: [], mentions: null } }
  assert.match(weekInsight({ metric: 'mentions', rows: [none, ...rows.slice(2)], changes: [null, ...changesOf(rows).slice(2)] }).text, /^No engine finished this week: the last week with numbers was /)
  assert.equal(rows[0].week.month, 'October')
})

test('the card: engines that didn’t run this week are named and left out', () => {
  assert.deepEqual(enginesNotRun(ALL), [])
  setHistoryMock('notrun')
  assert.deepEqual(enginesNotRun(ALL), ['claude'])
})

test('loadWeeks rejects after the timeout instead of spinning forever; resetWeeks clears the read', async () => {
  setLoadTimeout(20)
  setLoadDelay(200)
  await assert.rejects(loadWeeks(), /took longer than/)
  resetWeeks()
  setLoadTimeout(1000)
  setLoadDelay(5)
  await loadWeeks()
  // ?cmMock=fail: the first read fails, Retry loads
  setHistoryMock('fail')
  await assert.rejects(loadWeeks(), /couldn’t load/)
  await loadWeeks()
})

test('a page with or without utm_ parameters counts once', () => {
  assert.equal(pagePath('/products/serum?utm_source=chatgpt.com'), '/products/serum')
  assert.equal(pagePath('/products/serum?utm_source=x&utm_medium=y#top'), '/products/serum')
  assert.equal(pagePath('/products/serum?variant=2&utm_source=x'), '/products/serum?variant=2')
})
