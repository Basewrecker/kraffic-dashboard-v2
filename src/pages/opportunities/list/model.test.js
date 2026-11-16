// Run with: npm test. The Content list's states, tabs and "Missed by".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CO_BRAND, CO_BRANDS } from '../../../data/contentOpportunities.js'
import { TABS, filterRows, hasTimeline, missedBy, stageOf, statusText, tabCounts, tabExtras, tabById, withStage } from './model.js'

const DRAFTS = {
  1: { stage: 'draft', week: 0, gained: [] },
  2: { stage: 'waiting', week: 0, gained: [] },
  3: { stage: 'monitoring', week: 2, gained: [] },
  4: { stage: 'monitoring', week: 1, gained: [] },
  5: { stage: 'improved', week: 4, gained: ['google', 'chatgpt'] },
  6: { stage: 'nochange', week: 4, gained: [] },
}
const rows = withStage([0, 1, 2, 3, 4, 5, 6].map((id) => ({ id, competitors: [] })), (id) => DRAFTS[id] ?? null)

test('no draft = nothing started; unknown stages fall back to none', () => {
  assert.equal(stageOf(null), 'none')
  assert.equal(stageOf({ stage: 'weird' }), 'none')
  assert.equal(rows[0].stage, 'none')
  assert.equal(rows[5].stage, 'improved')
})

test('tabs: Missed prompts counts every row; the others one stage each; No change only under Missed prompts', () => {
  assert.deepEqual(tabCounts(rows), { all: 7, draft: 1, waiting: 1, monitoring: 2, improved: 1 })
  assert.equal(filterRows(rows, 'monitoring').length, 2)
  assert.equal(filterRows(rows, 'nope').length, 7)
  assert.equal(tabById('nope').id, 'all')
  assert.deepEqual(TABS.map((t) => t.label), ['Missed', 'Drafts', 'Waiting', 'Monitoring', 'Improved'])
})

test('tile extras: rows to start, the monitoring weeks, engines gained', () => {
  assert.deepEqual(tabExtras(rows), { toStart: 1, weeks: [1, 2], gained: 2 })
  assert.deepEqual(tabExtras([]), { toStart: 0, weeks: null, gained: 0 })
})

test('Missed by: tracked competitors not named in the answer; never the own brand, never a repeat', () => {
  const named = Object.keys(CO_BRANDS).slice(0, 2)
  const m = missedBy({ competitors: named })
  assert.ok(!m.includes(CO_BRAND.domain))
  assert.equal(m.length, Object.keys(CO_BRANDS).length - 2)
  assert.equal(new Set(m).size, m.length)
  assert.ok(named.every((d) => !m.includes(d)))
})

test('status words and which states get the timeline', () => {
  assert.deepEqual(rows.map(statusText), ['Create content', 'Draft ready', 'Waiting for publish', 'Monitoring · week 2/4', 'Monitoring · week 1/4', 'Improved +2 engines', 'No change yet'])
  assert.deepEqual(rows.map((r) => hasTimeline(r.stage)), [false, false, false, true, true, true, true])
})
