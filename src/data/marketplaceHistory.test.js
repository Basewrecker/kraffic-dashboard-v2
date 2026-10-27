// Run with: npm test. Marketplace visibility, week by week: the newest week is the card, a failed scan is unknown
// (never 0), gained − lost is the week's change, and the week rows read as the brief says.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MARKET_METRICS, marketChanges, marketInsight, marketRows, marketSummary, rivalRows } from './marketplaceHistory.js'
import { marketplace } from './mock.js'

const ALL = ['aio', 'gemini', 'chatgpt', 'claude', 'grok']
const rows = marketRows('all', ALL, 10)

test('the newest week is the card: 18 linking prompts, Target 12, Amazon 8, +3 vs last week', () => {
  assert.equal(rows[0].totals.linking, marketplace.yours)
  assert.equal(rows[0].totals.target, 12)
  assert.equal(rows[0].totals.amazon, 8)
  assert.equal(rows[0].totals.share, 11.8)
  assert.equal(rows[0].delta.linking, 3)
})

test('a failed engine scan is unknown, never 0; the next week compares with the last complete one', () => {
  assert.equal(rows[4].totals.linking, null)
  assert.deepEqual(rows[4].totals.failed, ['gemini'])
  assert.ok(marketRows('aio', ALL, 10)[4].totals.linking > 0)
  assert.equal(rows[3].skipped, true)
  assert.equal(rows[3].prevWeek, rows[5].week)
})

test('gained − lost matches the week’s change for every metric and engine', () => {
  for (const engine of ['all', 'aio', 'chatgpt', 'gemini']) {
    for (const r of marketRows(engine, ALL, 10)) {
      for (const m of MARKET_METRICS.filter((x) => !x.pct)) {
        const c = marketChanges({ metric: m.id, row: r, engine })
        if (!c) continue
        assert.equal(c.gained.length - c.lost.length, r.delta[m.id], `${engine} ${m.id} week ${r.index}`)
      }
    }
  }
})

test('week rows: "+3 prompts now link to your Target listing · 1 dropped"; drill-in rows name the marketplace and listing', () => {
  const c = marketChanges({ metric: 'linking', row: rows[2], engine: 'all' })
  assert.equal(marketSummary({ metric: 'linking', row: rows[2], changes: c }), '+3 prompts now link to your Target listing · 1 dropped')
  assert.equal(marketSummary({ metric: 'linking', row: rows[4], changes: null }), 'Scan didn’t complete this week')
  for (const it of [...c.gained, ...c.lost]) assert.match(it.meta, /(Target|Amazon) listing.* (target|amazon)\.com\//)
})

test('the insight line and Compare with', () => {
  const changes = rows.map((r) => marketChanges({ metric: 'linking', row: r, engine: 'all' }))
  assert.match(marketInsight({ metric: 'linking', rows, changes }).text, /^Your best week since \w+: 3 prompts started linking to your listings$/)
  const cerave = rivalRows('cerave.com', 'all', ALL, 10)
  assert.equal(cerave[0].totals.linking, 41) // the card's "Who gets the link" row
  assert.equal(cerave[4].totals.linking, null)
})

test('no marketplace links yet: every week is 0 (the empty state), never invented', () => {
  assert.ok(marketRows('all', ALL, 10, 'empty').every((r) => r.totals.linking === 0 || r.totals.linking === null))
})
