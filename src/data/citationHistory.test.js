// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { citationWeeks, weekChanges, weekInsight, weekRows, weekSummary, weekTotals } from './citationHistory.js'
import { pagePath } from './brandViews.js'
import { citationsMentions } from './mock.js'

const ALL = ['aio', 'gemini', 'chatgpt', 'claude', 'grok']

test('the newest week is the Now view', () => {
  const { weeks } = citationWeeks('dermasuri.com')
  const now = Object.values(citationsMentions['dermasuri.com'])
  const t = weekTotals(weeks[0], 'all', ALL)
  assert.equal(t.mentions, now.reduce((n, [m]) => n + m, 0))
  assert.equal(t.citations, now.reduce((n, [, c]) => n + c, 0))
})

test('a failed engine scan is unknown, never 0', () => {
  const { weeks } = citationWeeks('dermasuri.com')
  const failed = weekTotals(weeks[4], 'all', ALL)
  assert.deepEqual([failed.mentions, failed.citations, failed.pages], [null, null, null])
  assert.deepEqual(failed.failed, ['gemini'])
  // the other engines still have their numbers that week
  assert.ok(weekTotals(weeks[4], 'aio', ALL).mentions > 0)
})

test('gained − lost matches the week’s change for citations and cited pages', () => {
  const { syncs } = citationWeeks('dermasuri.com')
  const rows = weekRows('dermasuri.com', 'all', ALL)
  for (const metric of ['citations', 'pages']) {
    for (const row of rows) {
      const c = weekChanges({ domain: 'dermasuri.com', metric, row, engine: 'all', sync: syncs[row.index] })
      if (!c) continue
      assert.equal(c.gained.length - c.lost.length, row.delta[metric], `${metric} week ${row.index}`)
    }
  }
})

test('week summaries: a failed week says so; mentions count the sync’s prompts', () => {
  const { syncs } = citationWeeks('dermasuri.com')
  const rows = weekRows('dermasuri.com', 'all', ALL)
  assert.equal(weekSummary({ metric: 'mentions', row: rows[4], changes: null }), 'Scan didn’t complete this week')
  const c = weekChanges({ domain: 'dermasuri.com', metric: 'mentions', row: rows[0], engine: 'all', sync: syncs[0] })
  assert.equal(weekSummary({ metric: 'mentions', row: rows[0], changes: c }), `+${c.gained.length} prompts now mention you · ${c.lost.length} dropped`)
})

test('a page with or without utm_ parameters counts once', () => {
  assert.equal(pagePath('/products/serum?utm_source=chatgpt.com'), '/products/serum')
  assert.equal(pagePath('/products/serum?utm_source=x&utm_medium=y#top'), '/products/serum')
  assert.equal(pagePath('/products/serum?variant=2&utm_source=x'), '/products/serum?variant=2')
})

test('the insight line: the newest week against the period, never a 0 for a failed scan', () => {
  const { syncs } = citationWeeks('dermasuri.com')
  const rows = weekRows('dermasuri.com', 'all', ALL)
  const changes = rows.map((r) => weekChanges({ domain: 'dermasuri.com', metric: 'mentions', row: r, engine: 'all', sync: syncs[r.index] }))
  const up = weekInsight({ metric: 'mentions', rows, changes })
  assert.match(up.text, /^Your best week in 10 weeks: \d+ prompts started mentioning you$/)
  // one week earlier: −17, the period's biggest drop
  const down = weekInsight({ metric: 'mentions', rows: rows.slice(1), changes: changes.slice(1) })
  assert.match(down.text, /^Your biggest drop in 9 weeks: \d+ prompts stopped mentioning you$/)
  // a failed newest week says so
  const failed = weekInsight({ metric: 'mentions', rows: rows.slice(4), changes: changes.slice(4) })
  assert.match(failed.text, /^This week’s scan didn’t complete/)
  // months for grouping
  assert.equal(rows[0].week.month, 'October')
})
