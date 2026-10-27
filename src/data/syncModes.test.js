// Run with: npm test. Sync now stays a real paid scan: no mode without engines ("Rebuild insights only" is gone), and
// Tracking's Sync now is always the full scan on every engine for every prompt.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estimateSync, syncModes, trackingSyncMode } from './mock.js'

const ALL = ['aio', 'chatgpt', 'gemini', 'claude']
const every = [...syncModes.website, ...syncModes.brand]

test('every sync mode is a paid scan (runs at least one engine)', () => {
  for (const m of every) assert.ok(m.engines.length > 0, `${m.id} runs no engine`)
})

test('"Rebuild insights only" is gone', () => {
  assert.ok(!every.some((m) => m.id === 'brand_insights' || /insights only/i.test(m.title)))
})

test("Tracking's Sync now is the full scan: every engine, every prompt (website and name-only brands)", () => {
  for (const hasDomain of [true, false]) {
    const m = trackingSyncMode(hasDomain)
    assert.deepEqual([...m.engines].sort(), [...ALL].sort())
    assert.equal(m.prompts, 'all')
  }
  assert.equal(trackingSyncMode(true).id, 'full')
  assert.equal(trackingSyncMode(false).id, 'brand_full')
})

test('partial syncs (missed prompts, one engine) exist only in the Clients list modes', () => {
  assert.deepEqual(syncModes.brand.map((m) => m.id), ['brand_full'])
  const partial = syncModes.website.filter((m) => m.id !== 'full').map((m) => m.id)
  assert.deepEqual(partial, ['missed_google', 'chatgpt_only', 'gemini_only', 'claude_only'])
})

test('a full scan of 152 prompts estimates paid calls (never zero)', () => {
  const { n, lo, hi } = estimateSync(trackingSyncMode(true), { prompts: 152, missed: 12 })
  assert.equal(n, 152)
  assert.ok(lo > 0 && hi >= lo)
})
