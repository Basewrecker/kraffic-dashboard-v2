// Run with: npm test. The Sentiment spectrum: dots never overlap and stay in their tone's band, the score marker,
// keyboard neighbours, engine lanes, filters, theme → page links and the "no number twice" check.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PAGES, RUNS, SWOT, runPages, withScores } from '../data/sentiment.js'
import { BAND, biggestChange, columnDots, groupThemes, hash01, layoutSwarm, lanesFor, matchIds, neighbour, numbersIn, repeatedNumbers, scoreX, tellingSentence, themeEngines, themeQuote, themeTrend } from './spectrum.js'

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

test('the hover card quotes a sentence in the page’s own tone', () => {
  for (const p of PAGES) assert.ok(tellingSentence(p).text)
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

test('trend word: new this run, since a run, or none', () => {
  const runs = RUNS.map((r, i) => ({ date: r.date, pages: i === RUNS.length - 1 ? PAGES : runPages(PAGES, r.counts, r.id) }))
  const g = groupThemes(SWOT, PAGES)
  const find = (name) => [...g.hurting, ...g.working].find((x) => x.theme.startsWith(name))
  assert.deepEqual(themeTrend(find('Cleanser'), runs, 'negative'), { kind: 'new' })
  assert.deepEqual(themeTrend(find('Pumps'), runs, 'negative'), { kind: 'since', date: '2026-09-22' })
  assert.equal(themeTrend(find('Gentle'), runs, 'positive'), null) // there from the first run
  assert.equal(themeTrend(find('Feels heavy'), runs, 'negative'), null) // not negative this run
  assert.equal(themeTrend(find('Pumps'), [], 'negative'), null)
})

test('column dots: three fixed bands, negative at the bottom, none overlapping', () => {
  const bandH = 60, pitch = 8
  const dots = columnDots({ positive: 5, neutral: 14, negative: 2 }, { bandH, pitch, perRow: 4 })
  assert.equal(dots.length, 21)
  const band = { positive: 0, neutral: 1, negative: 2 }
  for (const d of dots) assert.ok(d.y >= band[d.tone] * bandH && d.y <= (band[d.tone] + 1) * bandH, `${d.tone} out of its band`)
  for (let i = 0; i < dots.length; i++) for (let j = i + 1; j < dots.length; j++) assert.ok(Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y) >= pitch - 1e-6)
  assert.deepEqual(columnDots({ positive: 0, neutral: 0, negative: 0 }, { bandH }), [])
})

test('biggest change: the largest move (latest wins a tie), said without digits', () => {
  const big = biggestChange(withScores(RUNS))
  assert.equal(big.index, RUNS.length - 1)
  assert.equal(big.delta, 4)
  assert.equal(big.what, 'one more positive page and one fewer negative')
  assert.ok(!/\d/.test(big.what))
  assert.equal(biggestChange(withScores(RUNS.slice(0, 1))), null)
})
