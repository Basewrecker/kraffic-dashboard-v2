import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hubLink, syncSlug } from './hub-link.js'
import { slugOf } from '../data/syncChanges.js'

test('one scan: the link opens the hub on that scan’s won / lost prompts', () => {
  assert.equal(hubLink({ kind: 'won', iso: '2026-10-05' }), '/tracker?sync=oct-5&change=gained')
  assert.equal(hubLink({ kind: 'lost', iso: '2026-09-28' }), '/tracker?sync=sep-28&change=lost')
})

test('a longer period: the hub’s status tab', () => {
  assert.equal(hubLink({ kind: 'won' }), '/tracker?visibility=visible')
  assert.equal(hubLink({ kind: 'lost' }), '/tracker?visibility=lost')
})

test('no kind, or one the hub has no view for: the hub as it is', () => {
  assert.equal(hubLink(), '/tracker')
  assert.equal(hubLink({ kind: 'moved', iso: '2026-10-05' }), '/tracker')
})

test('the slug is the one the hub matches sync rows with', () => {
  assert.equal(syncSlug('2026-10-05'), slugOf('Oct 5, 2026'))
  assert.equal(syncSlug('2026-12-14'), slugOf('Dec 14, 2026'))
  assert.equal(syncSlug('not a day'), null)
  assert.equal(syncSlug(null), null)
})
