// Step 5 (Publish and track) helpers: names, dates, the 4-sync columns, the result and the opening card.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cellState, columnKinds, fmtDay, initialPhase, listNames, matchPct, resultOf, shortEngine, syncsAfter, weeksDone } from './model.js'

test('engine names: Google\'s two engines by name, lists read in plain English', () => {
  // Google's two engines by their own names, never a bare "Google"
  assert.equal(shortEngine('google'), 'AI Overview')
  assert.equal(shortEngine('aimode'), 'AI Mode')
  assert.equal(shortEngine('chatgpt'), 'ChatGPT')
  assert.equal(listNames(['google', 'chatgpt']), 'AI Overview and ChatGPT')
  assert.equal(listNames(['google', 'aimode', 'chatgpt']), 'AI Overview, AI Mode and ChatGPT')
  assert.equal(listNames(['google', 'chatgpt', 'claude']), 'AI Overview, ChatGPT and Claude')
  assert.equal(listNames(['gemini']), 'Gemini')
  assert.equal(listNames([]), '')
})

test('dates never shift with the time zone', () => {
  assert.equal(fmtDay('2026-11-05T07:40:00Z'), 'Nov 5, 2026')
  assert.equal(fmtDay('Oct 12, 2026'), 'Oct 12, 2026')
  assert.equal(fmtDay('Oct 12, 2026', { short: true }), 'Oct 12')
  assert.equal(fmtDay('nope'), '—')
})

test('match is a whole percent', () => {
  assert.equal(matchPct(0.92), 92)
  assert.equal(matchPct(1.2), 100)
  assert.equal(matchPct(null), null)
})

test('the four syncs after publishing are the next Mondays', () => {
  const s = syncsAfter('2026-11-05T07:40:00Z') // a Thursday
  assert.deepEqual(s.map((x) => x.date), ['Nov 9, 2026', 'Nov 16, 2026', 'Nov 23, 2026', 'Nov 30, 2026'])
  assert.ok(s.every((x) => x.pending))
  assert.equal(syncsAfter('2026-11-02T08:00:00Z')[0].date, 'Nov 9, 2026') // published on a Monday: next week's
})

const named = { google: true, chatgpt: false, gemini: false, claude: false }
const syncs = [
  { date: 'Oct 12, 2026', engines: named, visibility: { before: 0, after: 25 } },
  { date: 'Oct 19, 2026', engines: null, visibility: null },
  { date: 'Oct 26, 2026', pending: true },
  { date: 'Nov 2, 2026', pending: true },
]

test('a failed sync is a gap, never a miss; pending is its own state', () => {
  assert.equal(cellState(syncs[0], 'google'), 'named')
  assert.equal(cellState(syncs[0], 'chatgpt'), 'missed')
  assert.equal(cellState(syncs[1], 'google'), 'gap')
  assert.equal(cellState(syncs[2], 'google'), 'pending')
  assert.deepEqual(columnKinds(syncs), ['done', 'gap', 'next', 'later'])
  assert.equal(weeksDone(syncs), 2)
})

test('result: running until week 4, then improved or no change', () => {
  assert.deepEqual(resultOf(syncs, ['google']), { kind: 'running', date: 'Nov 2, 2026' })
  const done = syncs.map((s) => ({ ...s, pending: false, engines: s.engines ?? named }))
  assert.deepEqual(resultOf(done, ['google', 'chatgpt']), { kind: 'improved', engines: ['google', 'chatgpt'], label: 'AI Overview and ChatGPT' })
  assert.deepEqual(resultOf(done, []), { kind: 'nochange' })
})

test('opening card follows the stage and the publish check', () => {
  const published = { status: 'published', match: 0.92 }
  const missing = { status: 'not_found', checked_days: 14 }
  assert.equal(initialPhase({ stage: 'waiting' }, published), 'waiting')
  assert.equal(initialPhase({ stage: 'waiting' }, missing), 'notfound')
  assert.equal(initialPhase({ stage: 'monitoring' }, missing), 'tracking')
  assert.equal(initialPhase({ stage: 'improved' }, published), 'tracking')
})
