// "vs last sync" adds up on screen: the score card's and Sync history's change in points is the difference of the
// shown scores, and the change in prompts is gained − lost. Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { changeParts, netPrompts, pointsBetween, promptsText, withSyncChanges } from './syncChange.js'
import { ENGINES, TRACKED_BRANDS, getBrandView } from '../data/brandViews.js'

const items = (n) => Array.from({ length: n }, (_, i) => ({ id: i, prompt: `p${i}` }))

test('the card delta is the shown score minus the previous sync row, whatever the data said', () => {
  const view = withSyncChanges({
    kpis: { score: 73, scoreDelta: 6 }, // a separately worked-out 6 (the bug)
    syncHistory: [
      { visibility: 73, delta: 6, changes: { gained: items(14), lost: items(4) } },
      { visibility: 66, delta: -5, changes: null },
    ],
  })
  assert.equal(view.kpis.scoreDelta, 7)
  assert.equal(view.kpis.netPrompts, 10)
  assert.equal(view.syncHistory[0].delta, 7)
  assert.equal(view.syncHistory[0].netPrompts, 10)
  // the oldest row keeps its own delta (its "before" is outside the list) and has nothing to net
  assert.equal(view.syncHistory[1].delta, -5)
  assert.equal(view.syncHistory[1].netPrompts, null)
})

test('no delta when there is no previous sync, or the latest row is not the score the card shows', () => {
  assert.equal(withSyncChanges({ kpis: { score: 40, scoreDelta: 3 }, syncHistory: [{ visibility: 40, changes: null }] }).kpis.scoreDelta, null)
  assert.equal(withSyncChanges({ kpis: { score: 40, scoreDelta: 3 }, syncHistory: [] }).kpis.scoreDelta, null)
  const stale = withSyncChanges({ kpis: { score: 40 }, syncHistory: [{ visibility: 35 }, { visibility: 30 }] })
  assert.equal(stale.kpis.scoreDelta, null)
  assert.equal(stale.kpis.netPrompts, null)
})

test('rounded as shown: 72.6 vs 66.4 shows 73 and 66, so the change is 7', () => {
  assert.equal(pointsBetween(72.6, 66.4), 7)
  assert.equal(pointsBetween(null, 66), null)
  assert.equal(netPrompts({ gained: items(2), lost: items(5) }), -3)
})

test('labels: points and net prompts', () => {
  assert.deepEqual(changeParts(7, 10), { arrow: '▲', text: '7 pts vs last sync · +10 prompts' })
  assert.deepEqual(changeParts(-1, -1), { arrow: '▼', text: '1 pt vs last sync · −1 prompt' })
  assert.deepEqual(changeParts(0, 2), { arrow: null, text: 'No change vs last sync · +2 prompts' })
  assert.deepEqual(changeParts(4, null), { arrow: '▲', text: '4 pts vs last sync' })
  assert.deepEqual(changeParts(7, 10, { suffix: '' }), { arrow: '▲', text: '7 pts · +10 prompts' })
  assert.equal(changeParts(null, 10), null)
  assert.equal(promptsText(0), '0 prompts')
})

test('every brand and engine in the mock: the card and Sync history agree and add up', () => {
  for (const b of TRACKED_BRANDS) {
    for (const e of ['all', ...ENGINES.map((x) => x.id)]) {
      const v = withSyncChanges(getBrandView(b.domain, e))
      const rows = v.syncHistory
      const at = `${b.key} / ${e}`
      assert.equal(rows[0].visibility, v.kpis.score, `${at}: latest row = the card's score`)
      assert.equal(v.kpis.scoreDelta, v.kpis.score - rows[1].visibility, `${at}: card delta = shown now − shown before`)
      rows.slice(0, -1).forEach((r, i) => assert.equal(r.delta, r.visibility - rows[i + 1].visibility, `${at}: row ${i} delta`))
      rows.forEach((r, i) => assert.equal(r.netPrompts, r.changes ? r.changes.gained.length - r.changes.lost.length : null, `${at}: row ${i} net`))
      assert.equal(v.kpis.netPrompts, rows[0].netPrompts, `${at}: card net = the latest row's`)
    }
  }
})

test("Dermasuri's latest sync: 73 vs 66 → ▲ 7 pts, +14 gained −4 lost → +10 prompts, and the visible counts agree", () => {
  const v = withSyncChanges(getBrandView(TRACKED_BRANDS.find((b) => b.you).domain, 'all'))
  const [now, before] = v.syncHistory
  assert.deepEqual(changeParts(v.kpis.scoreDelta, v.kpis.netPrompts), { arrow: '▲', text: '7 pts vs last sync · +10 prompts' })
  assert.equal(now.changes.gained.length, 14)
  assert.equal(now.changes.lost.length, 4)
  assert.equal(now.visible - before.visible, now.netPrompts, '111 / 152 vs 101 / 152 on screen = +10')
})
