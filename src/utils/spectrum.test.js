// Run with: npm test. The Sentiment spectrum: dots never overlap and stay in their tone's band, the score marker,
// keyboard neighbours, engine lanes, filters, theme → page links and the "no number twice" check.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PAGES, RUNS, SWOT, withScores } from '../data/sentiment.js'
import { BAND, biggestChange, groupThemes, hash01, layoutSwarm, lanesFor, listPage, matchIds, neighbour, numbersIn, repeatedNumbers, runAt, scoreX, stepKey, tellingSentence, themeDetail, themeEngines, themeQuote } from './spectrum.js'

const ENGINES = [{ id: 'google', name: 'Google search' }, { id: 'chatgpt', name: 'ChatGPT' }, { id: 'claude', name: 'Claude' }]

for (const [width, r] of [[860, 14], [330, 11], [200, 11]]) {
  test(`beeswarm at ${width}px: no two dots overlap, each stays in its band`, () => {
    const { pos, extent } = layoutSwarm(PAGES, { width, r, gap: 3 })
    const pts = PAGES.map((p) => ({ ...pos[p.id], tone: p.tone }))
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
        assert.ok(d >= 2 * r + 3 - 1e-6, `dots ${i} and ${j} are ${d.toFixed(1)}px apart`)
      }
      const b = BAND[pts[i].tone]
      assert.ok(pts[i].x >= (b * width) / 3 && pts[i].x <= ((b + 1) * width) / 3, `dot ${i} left its band`)
      assert.ok(Math.abs(pts[i].y) + r <= extent + 1e-6)
    }
  })
}

test('layout is stable: same pages, same places', () => {
  assert.deepEqual(layoutSwarm(PAGES, { width: 600 }).pos, layoutSwarm([...PAGES].reverse(), { width: 600 }).pos)
  assert.ok(hash01('p1') >= 0 && hash01('p1') < 1)
})

test('score marker: 0 far left, 50 in the middle, 100 far right, clamped', () => {
  assert.equal(scoreX(0, 900), 0)
  assert.equal(scoreX(50, 900), 450)
  assert.equal(scoreX(100, 900), 900)
  assert.equal(scoreX(130, 900), 900)
})

test('arrow keys move to the nearest dot that way, and stay at the edge', () => {
  const pts = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 30, y: 0 }, { id: 'c', x: 31, y: 40 }, { id: 'd', x: 90, y: 0 }]
  assert.equal(neighbour(pts, 'a', 'ArrowRight'), 'b')
  assert.equal(neighbour(pts, 'b', 'ArrowDown'), 'c')
  assert.equal(neighbour(pts, 'c', 'ArrowUp'), 'b')
  assert.equal(neighbour(pts, 'a', 'ArrowLeft'), 'a')
  assert.equal(neighbour(pts, 'd', 'ArrowRight'), 'd')
})

test('lanes: one per engine, each with its own pages and score', () => {
  const lanes = lanesFor(PAGES, ENGINES)
  assert.deepEqual(lanes.map((l) => l.id), ['google', 'chatgpt', 'claude'])
  for (const l of lanes) {
    assert.ok(l.pages.every((p) => p.engines.includes(l.id)))
    assert.ok(l.score >= 0 && l.score <= 100)
  }
})

test('filters: engine, tone and theme combine', () => {
  assert.equal(matchIds(PAGES).size, PAGES.length)
  assert.ok([...matchIds(PAGES, { tone: 'negative' })].every((id) => PAGES.find((p) => p.id === id).tone === 'negative'))
  const theme = SWOT.weaknesses[0]
  assert.deepEqual([...matchIds(PAGES, { theme })], theme.sources)
  assert.equal(matchIds(PAGES, { engine: 'claude', tone: 'negative' }).size, 0)
})

test('every theme links to pages that exist', () => {
  const ids = new Set(PAGES.map((p) => p.id))
  for (const items of Object.values(SWOT)) for (const t of items) {
    assert.ok(t.sources.length > 0, t.theme)
    for (const id of t.sources) assert.ok(ids.has(id), `${t.theme} → ${id}`)
  }
})

test('the hover card quotes a sentence in the page’s own tone; none for pages without quotes', () => {
  for (const p of PAGES) assert.equal(Boolean(tellingSentence(p)), !p.noQuote, p.domain)
  const tp = PAGES.find((p) => p.domain === 'trustpilot.com')
  assert.equal(tellingSentence(tp).tone, 'negative')
})

test('number check: dates and times are not numbers; repeats are found', () => {
  assert.deepEqual(numbersIn('▲4 since Oct 6'), ['4'])
  assert.deepEqual(numbersIn('Paid run 0:42'), [])
  assert.deepEqual(numbersIn('5 positive · 14 neutral · 2 negative'), ['5', '14', '2'])
  assert.deepEqual(repeatedNumbers(['57', 'Google search 55', 'Claude 57']).map((x) => x.n), ['57'])
  assert.deepEqual(repeatedNumbers(['All 21 pages', '5 positive']), [])
})

test('themes: weaknesses + threats hurt, strengths + opportunities work; the side’s tone ranks them', () => {
  const g = groupThemes(SWOT, PAGES)
  assert.ok(g.hurting.every((x) => x.kind === 'weakness' || x.kind === 'threat'))
  assert.ok(g.working.every((x) => x.kind === 'strength' || x.kind === 'opportunity'))
  assert.equal(g.hurting.length, SWOT.weaknesses.length + SWOT.threats.length)
  for (const side of [g.hurting, g.working]) for (let i = 1; i < side.length; i++) assert.ok(side[i - 1].hits >= side[i].hits)
  assert.equal(g.hurting[0].theme, 'Cleanser runs out fast') // two pages say it, one of them negative
  assert.deepEqual(groupThemes(null, PAGES), { hurting: [], working: [] })
})

test('a theme quotes the sentence about it, and lists its engines in order', () => {
  const [pumps] = groupThemes(SWOT, PAGES).hurting.filter((x) => x.theme.startsWith('Pumps'))
  assert.match(themeQuote(pumps.pages[0], pumps).text, /pump/)
  const cs = groupThemes(SWOT, PAGES).hurting.find((x) => x.theme.startsWith('Slow customer'))
  assert.match(themeQuote(cs.pages[0], cs).text, /Customer service/)
  assert.deepEqual(themeEngines(pumps), ['google', 'chatgpt'])
})

test('theme detail: one quote about the theme, its page, and the others that also say it', () => {
  const g = groupThemes(SWOT, PAGES)
  const gentle = g.working.find((x) => x.theme.startsWith('Gentle'))
  const d = themeDetail(gentle)
  assert.match(d.quote.text, /gentl|sensitive|irritat|react/i)
  assert.equal(d.also.length, gentle.pages.length - 1)
  assert.ok(!d.also.includes(d.page))
  // every page behind it analysed before quotes were stored: no quote, the page still shown
  const few = g.working.find((x) => x.theme.startsWith('Few marketplace'))
  const f = themeDetail(few)
  assert.equal(f.quote, null)
  assert.ok(f.page.noQuote)
  assert.equal(themeDetail({ theme: 'x', pages: [], sources: [] }), null)
})

test('theme list: at most five rows, then pages', () => {
  const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  assert.deepEqual(listPage(list, 0), { items: ['a', 'b', 'c', 'd', 'e'], page: 0, pages: 2, rest: 2 })
  assert.deepEqual(listPage(list, 1), { items: ['f', 'g'], page: 1, pages: 2, rest: 0 })
  assert.deepEqual(listPage(list, 9).page, 1)
  assert.deepEqual(listPage(['a', 'b'], 0), { items: ['a', 'b'], page: 0, pages: 1, rest: 0 })
})

test('keys: arrows step and stop at the ends, Home / End jump; other keys are not ours', () => {
  assert.equal(stepKey(0, 'ArrowDown', 5), 1)
  assert.equal(stepKey(0, 'ArrowUp', 5), 0)
  assert.equal(stepKey(4, 'ArrowRight', 5), 4)
  assert.equal(stepKey(3, 'ArrowLeft', 5), 2)
  assert.equal(stepKey(2, 'Home', 5), 0)
  assert.equal(stepKey(2, 'End', 6), 5)
  assert.equal(stepKey(2, 'Enter', 5), null)
  assert.equal(stepKey(0, 'ArrowDown', 0), null)
})

test('scrubber: a point on the track picks the nearest run', () => {
  assert.equal(runAt(0, 500, 6), 0)
  assert.equal(runAt(500, 500, 6), 5)
  assert.equal(runAt(140, 500, 6), 1) // 140 / 100 per step → 1.4 → 1
  assert.equal(runAt(160, 500, 6), 2)
  assert.equal(runAt(-40, 500, 6), 0)
  assert.equal(runAt(900, 500, 6), 5)
  assert.equal(runAt(200, 500, 1), 0)
})

test('biggest change: the largest move, said without digits', () => {
  const runs = withScores(RUNS)
  const big = biggestChange(runs)
  assert.equal(runs[big.index].date, '2026-09-08')
  assert.equal(big.delta, runs[big.index].score - runs[big.index - 1].score)
  assert.ok(big.delta > 0)
  assert.equal(big.what, 'two more positive pages and three fewer negative')
  assert.ok(!/\d/.test(big.what))
  assert.equal(biggestChange(runs.slice(0, 1)), null)
  // a tie goes to the later run
  const tie = [{ score: 50, counts: { positive: 1, neutral: 1, negative: 1 } }, { score: 53, counts: { positive: 2, neutral: 1, negative: 1 } }, { score: 56, counts: { positive: 3, neutral: 1, negative: 1 } }]
  assert.equal(biggestChange(tie).index, 2)
})
