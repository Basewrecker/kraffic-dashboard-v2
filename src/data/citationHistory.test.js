// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { citationWeeks, weekChanges, weekTotals } from './citationHistory.js'
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
  const { weeks, syncs } = citationWeeks('dermasuri.com')
  for (const metric of ['citations', 'pages']) {
    for (let i = 0; i < weeks.length - 1; i++) {
      const totals = weekTotals(weeks[i], 'all', ALL), prev = weekTotals(weeks[i + 1], 'all', ALL)
      const c = weekChanges({ domain: 'dermasuri.com', metric, index: i, totals, prevTotals: prev, sync: syncs[i] })
      if (!c) continue
      assert.equal(c.gained.length - c.lost.length, totals[metric] - prev[metric], `${metric} week ${i}`)
    }
  }
})

test('a page with or without utm_ parameters counts once', () => {
  assert.equal(pagePath('/products/serum?utm_source=chatgpt.com'), '/products/serum')
  assert.equal(pagePath('/products/serum?utm_source=x&utm_medium=y#top'), '/products/serum')
  assert.equal(pagePath('/products/serum?variant=2&utm_source=x'), '/products/serum?variant=2')
})
