// Run with: npm test. The Insights panel's order and its "New" rule.
import test from 'node:test'
import assert from 'node:assert/strict'
import { orderInsights, stamp } from './cardInsights.js'

const map = {
  sync: { key: 'sync', text: 'Best sync: Sep 16 (74%).' },
  history: { key: 'history', text: 'Dermasuri rose 7 points.' },
  share: { key: 'share', text: 'You appear in 4× more answers than CeraVe.' },
}

test('new insights first, then the page order; one already seen is not new', () => {
  const seen = new Set([stamp(map.history)])
  const list = orderInsights(map, seen)
  assert.deepEqual(list.map((i) => i.key), ['share', 'sync', 'history'])
  assert.deepEqual(list.map((i) => i.isNew), [true, true, false])
})

test('a card whose sentence changed is new again', () => {
  const seen = new Set([stamp({ key: 'history', text: 'Dermasuri held steady.' })])
  assert.equal(orderInsights(map, seen).find((i) => i.key === 'history').isNew, true)
})

test('nothing reported: an empty list', () => {
  assert.deepEqual(orderInsights({}, new Set()), [])
  assert.deepEqual(orderInsights(null), [])
})
