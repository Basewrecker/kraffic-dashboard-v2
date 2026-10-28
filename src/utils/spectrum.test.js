// Run with: npm test. The Sentiment spectrum: dots never overlap and stay in their tone's band, the score marker,
// keyboard neighbours, engine lanes, filters, theme → page links and the "no number twice" check.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PAGES, RUNS, SWOT, withScores } from '../data/sentiment.js'
import { BAND, biggestChange, capRows, dotGrid, dotRows, groupThemes, hash01, layoutSwarm, lanesFor, leadTheme, matchIds, moveNote, neighbour, numbersIn, repeatedNumbers, scoreStrip, scoreX, tellingSentence, themeEngines, themeQuote, themeQuoteOf, toggleOpen } from './spectrum.js'

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
  assert.equal(tellingSentence(PAGES.find((p) => p.domain === 'trustpilot.com')).tone, 'negative')
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

test('lead quote: the top Hurting theme, its quote about it, and its other pages', () => {
  const g = groupThemes(SWOT, PAGES)
  const lead = leadTheme(g)
  assert.equal(lead.theme, g.hurting[0])
  assert.equal(lead.theme.theme, 'Cleanser runs out fast')
  assert.match(lead.quote.text, /runs out|ran out/)
  assert.equal(lead.others.length, lead.theme.pages.length - 1)
  assert.equal(leadTheme({ hurting: [], working: [] }), null)
})

test('a theme with only quote-less pages: no quote, its page still named', () => {
  const few = groupThemes(SWOT, PAGES).working.find((x) => x.theme.startsWith('Few marketplace'))
  const q = themeQuoteOf(few)
  assert.equal(q.quote, null)
  assert.ok(q.page.noQuote)
})

test('columns: at most five rows, the rest behind "+N more" until expanded', () => {
  const g = groupThemes(SWOT, PAGES)
  assert.equal(g.hurting.length, 7)
  assert.equal(g.working.length, 5)
  assert.deepEqual(capRows(g.hurting, false).more, 2)
  assert.equal(capRows(g.hurting, false).rows.length, 5)
  assert.deepEqual(capRows(g.hurting, true), { rows: g.hurting, more: 0 })
  assert.deepEqual(capRows(g.working, false), { rows: g.working, more: 0 })
})

test('one open row across both columns', () => {
  assert.equal(toggleOpen(null, 'a'), 'a')
  assert.equal(toggleOpen('a', 'b'), 'b')
  assert.equal(toggleOpen('b', 'b'), null)
})

test('score strip: fitted to the scores and to 50, higher scores higher up, inside the strip', () => {
  const scores = withScores(RUNS).map((r) => r.score)
  const s = scoreStrip(scores, { height: 56 })
  for (const v of scores) assert.ok(s.y(v) >= 0 && s.y(v) <= 56)
  assert.ok(s.y(57) < s.y(44))
  assert.ok(s.evenY > 0 && s.evenY < 56)
  const high = scoreStrip([80, 90], { height: 40 })
  assert.ok(high.evenY <= 40 && high.evenY > high.y(80)) // 50 stays in the strip
})

test('dots wrap into centred rows of at most six, 8px dots 4px apart', () => {
  const d = dotGrid(14, { perRow: 6, pitch: 12 })
  assert.equal(d.length, 14)
  assert.equal(dotRows(14), 3)
  assert.deepEqual(d.slice(0, 6).map((p) => p.x), [-30, -18, -6, 6, 18, 30])
  assert.deepEqual(d.slice(12).map((p) => p.x), [-6, 6]) // the last row centred
  for (let i = 0; i < d.length; i++) for (let j = i + 1; j < d.length; j++) assert.ok(Math.hypot(d[i].x - d[j].x, d[i].y - d[j].y) >= 12)
  assert.deepEqual(dotGrid(0, {}), [])
})

test('biggest move: the largest change and its note from the data', () => {
  const runs = withScores(RUNS)
  const big = biggestChange(runs)
  assert.equal(runs[big.index].date, '2026-09-08')
  assert.equal(moveNote(runs, big), '+13 · 2 more positive, 3 fewer negative')
  assert.equal(moveNote(runs, null), null)
  const tie = [{ score: 50, counts: { positive: 1, neutral: 1, negative: 1 } }, { score: 53, counts: { positive: 2, neutral: 1, negative: 1 } }, { score: 56, counts: { positive: 3, neutral: 1, negative: 1 } }]
  assert.equal(biggestChange(tie).index, 2)
})
