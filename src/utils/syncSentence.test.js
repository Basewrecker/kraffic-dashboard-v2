// Run with: npm test. Sync history's sentences and filter counts (as the app, #223).
import test from 'node:test'
import assert from 'node:assert/strict'
import { promptsAdded, syncCounts, syncKind, syncMatches, syncSentence } from './syncSentence.js'

const rows = [
  { date: 'Nov 25, 2026', visibility: 46, visible: 75, total: 121, delta: -4 },
  { date: 'Oct 28, 2026', visibility: 50, visible: 75, total: 121, delta: 1 },
  { date: 'Oct 27, 2026', visibility: 49, visible: 73, total: 113, delta: 0 },
  { date: 'Oct 26, 2026', visibility: 49, visible: 73, total: 113, delta: null },
]

test('one sentence per sync: fell, prompts added, no change, first sync', () => {
  assert.equal(syncSentence(rows[0], rows[1]), 'Visibility fell 4 points to 46%, with all 121 prompts checked')
  assert.equal(syncSentence(rows[1], rows[2]), '8 new prompts added (113 → 121) and visibility rose 1 point to 50%')
  assert.equal(syncSentence(rows[2], rows[3]), 'No change since Oct 26: 73 of 113 prompts still visible')
  assert.equal(syncSentence(rows[3], undefined), 'First sync: 73 of 113 prompts visible from the start')
})

test('a scan with no result is never a 0: it says so, and the sync after it compares with nothing', () => {
  const gap = { date: 'Sep 7, 2026', visibility: null, visible: null, total: 152, delta: null }
  assert.equal(syncSentence(gap, rows[3], { engineName: 'Gemini' }), 'No result from Gemini in this scan')
  assert.equal(syncKind(gap, rows[3]), 'none')
  assert.equal(syncKind({ ...rows[0], delta: null }, gap), 'first')
})

test('the filter pills count what each filter shows', () => {
  assert.deepEqual(syncCounts(rows), { all: 4, up: 1, down: 1, same: 1, added: 1 })
  assert.equal(promptsAdded(rows[1], rows[2]), 8)
  assert.equal(syncMatches('added', rows[1], rows[2]), true)
  assert.equal(syncMatches('up', rows[0], rows[1]), false)
  assert.equal(syncMatches('all', rows[3], undefined), true)
})
