import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADDED_VIA, activeFilters, addedCsv, addedDate, addedLabel, addedSortValue, addedTip, matchesSearch, showingLine, statusCounts,
  topicColumnWidth, withoutStatus,
} from './hub-filters.js'

const rows = [
  { id: 1, prompt: 'best reverse mortgage', category: 'Loan Types & HECM', status: 'visible' },
  { id: 2, prompt: 'reverse mortgage costs', category: 'Loan Types & HECM', status: 'missed' },
  { id: 3, prompt: 'reverse mortgage reviews', category: 'Reviews', status: 'visible' },
  { id: 4, prompt: 'is a HECM worth it', category: 'Loan Types & HECM', status: 'lost' },
  { id: 5, prompt: 'heloc vs reverse mortgage', category: null, status: 'pending' },
]

test('status counts with no filter on count every prompt', () => {
  assert.deepEqual(statusCounts(rows), { all: 5, visible: 2, missed: 1, lost: 1, pending: 1 })
})
test('status counts follow the topic', () => {
  assert.deepEqual(statusCounts(rows, { category: 'Loan Types & HECM' }), { all: 3, visible: 1, missed: 1, lost: 1, pending: 0 })
})
test('status counts follow the search, over the keys the table searches', () => {
  assert.deepEqual(statusCounts(rows, { query: ' REVIEWS ' }, ['prompt', 'category']), { all: 1, visible: 1, missed: 0, lost: 0, pending: 0 })
  assert.equal(statusCounts(rows, { query: 'hecm' }, ['prompt']).all, 1)
  assert.equal(statusCounts(rows, { query: 'hecm' }, ['prompt', 'category']).all, 3)
})
test('status counts follow the engine (it changes each row’s status first) and any other filter', () => {
  const onEngine = rows.map((r) => (r.id === 1 ? { ...r, status: 'missed' } : r))
  assert.deepEqual(statusCounts(onEngine), { all: 5, visible: 1, missed: 2, lost: 1, pending: 1 })
  assert.equal(statusCounts(rows, { also: (r) => r.id > 3 }).all, 2)
})
test('the status tab itself never changes the counts: they are what the other filters leave', () => {
  assert.equal(withoutStatus(rows, { category: 'Reviews', query: 'mortgage' }).length, 1)
  assert.equal(withoutStatus(rows, { category: 'all', query: '' }).length, 5)
})
test('a missing topic never matches a search (not the word "null")', () => {
  assert.equal(matchesSearch(rows[4], 'null', ['prompt', 'category']), false)
  assert.equal(matchesSearch(rows[4], '', ['prompt', 'category']), true)
})

test('one chip per filter that is on, the search in quotes; none when nothing is on', () => {
  assert.deepEqual(activeFilters({ category: 'all', engineLabel: null, query: '  ' }), [])
  assert.deepEqual(
    activeFilters({ category: 'Loan Types & HECM', engineLabel: 'ChatGPT', query: ' costs ' }).map((c) => [c.key, c.label]),
    [['search', '“costs”'], ['topic', 'Loan Types & HECM'], ['engine', 'ChatGPT']],
  )
  assert.equal(showingLine(13, 114), 'Showing 13 of 114 prompts')
  assert.equal(showingLine(1, 1), 'Showing 1 of 1 prompt')
})

test('Added: Today, Yesterday, then the short date; the year only when it differs; a dash when missing', () => {
  const today = '2026-11-27T12:00:00Z'
  assert.equal(addedLabel('2026-11-27T03:00:00Z', today), 'Today')
  assert.equal(addedLabel('2026-11-26T23:00:00Z', today), 'Yesterday')
  assert.equal(addedLabel('2026-11-18T09:00:00Z', today), 'Nov 18')
  assert.equal(addedLabel('2025-12-30T09:00:00Z', today), 'Dec 30, 2025')
  assert.equal(addedLabel(null, today), '—')
  assert.equal(addedLabel('not a date', today), '—')
})
test('Added: the tip and the CSV carry the full date and how it was added', () => {
  assert.equal(addedDate('2026-11-18T09:00:00Z'), 'Nov 18, 2026')
  assert.equal(addedTip('2026-11-18T09:00:00Z', 'csv'), 'Added Nov 18, 2026 · Imported from a file')
  assert.equal(addedTip('2026-11-18T09:00:00Z', 'manual'), `Added Nov 18, 2026 · ${ADDED_VIA.manual}`)
  assert.equal(addedTip('2026-11-18T09:00:00Z', 'research'), 'Added Nov 18, 2026 · From Research')
  assert.equal(addedTip('2026-11-18T09:00:00Z', undefined), 'Added Nov 18, 2026')
  assert.equal(addedTip(undefined, 'csv'), null)
  assert.equal(addedCsv('2026-11-18T09:00:00Z', 'csv'), 'Nov 18, 2026 · Imported from a file')
  assert.equal(addedCsv(null, 'csv'), '—')
})
test('Added sorts by time, a missing date as the oldest', () => {
  const list = ['2026-11-01T00:00:00Z', null, '2026-11-20T00:00:00Z']
  assert.deepEqual([...list].sort((a, b) => addedSortValue(b) - addedSortValue(a)), ['2026-11-20T00:00:00Z', '2026-11-01T00:00:00Z', null])
})

test('the Topic column fits its longest topic, between the floor and the cap', () => {
  assert.equal(topicColumnWidth([40, 71.2, 55]), 112)
  assert.equal(topicColumnWidth([20]), 88)
  assert.equal(topicColumnWidth([400]), 220)
  assert.equal(topicColumnWidth([]), 88)
})
