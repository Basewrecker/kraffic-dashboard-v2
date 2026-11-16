// Opportunities → Content workspace: the answers' order per engine (rankGrid) and namedSummary. Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { getAnswer } from '../../../data/answers.js'
import { missedPrompts } from '../../../data/mock.js'
import { namedSummary, rankGrid } from './heroData.js'

const ENGINES = ['google', 'chatgpt', 'gemini', 'claude']
const opts = { engines: ENGINES, own: 'dermasuri.com', ownName: 'Dermasuri', getAnswer }

test('rankGrid: each engine\'s brands in the stored answer\'s order, position = index + 1', () => {
  for (const row of missedPrompts) {
    const grid = rankGrid(row, opts)
    assert.equal(grid.length, 4)
    for (const r of grid) {
      const a = getAnswer(`m${row.id}`, r.engine === 'google' ? 'aio' : r.engine)
      assert.deepEqual(r.listed.map((b) => b.name), a.brands.map((b) => b.name))
      r.listed.forEach((b, i) => assert.equal(b.position, i + 1))
      assert.equal(r.named, !row.platforms.includes(r.engine))
      // where the row says you're named but the answer's list doesn't have you: "Named, no position"
      if (r.named && !r.listed.some((b) => b.you)) assert.ok(r.unranked[0]?.you)
      if (!r.named) assert.ok(!r.unranked.some((b) => b.you))
      for (const u of r.unranked) assert.equal(u.position, null)
    }
  }
})

test('a missed prompt\'s answers agree with its row: the row\'s brands first, in its order; you only where named', () => {
  for (const row of missedPrompts) {
    for (const r of rankGrid(row, opts)) {
      const pid = r.engine
      const expected = row.competitors.filter((d) => row.brandsMentioned.find((b) => b.domain === d)?.platforms.includes(pid))
      assert.deepEqual(r.listed.slice(0, expected.length).map((b) => b.domain), expected, `${row.prompt} · ${pid}`)
      assert.equal(r.listed.some((b) => b.you), r.named, `${row.prompt} · ${pid}`)
      assert.deepEqual(r.unranked, [], `${row.prompt} · ${pid}: everything the row names has a position`)
    }
  }
})

test('namedSummary: 1st on N engines, else the best position, else not named', () => {
  const grid = [
    { engine: 'google', listed: [{ domain: 'a.com', position: 1 }, { domain: 'b.com', position: 2 }] },
    { engine: 'claude', listed: [{ domain: 'a.com', position: 1 }, { domain: 'b.com', position: 4 }] },
  ]
  assert.equal(namedSummary(grid, 'a.com'), '1st on 2 engines')
  assert.equal(namedSummary(grid, 'b.com', (e) => e.toUpperCase()), '2nd on GOOGLE')
  assert.equal(namedSummary(grid, 'c.com'), 'Not named')
})
