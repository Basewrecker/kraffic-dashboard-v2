// Run with: npm test. The Sentiment spectrum: dots never overlap and stay in their tone's band, the score marker,
// keyboard neighbours, engine lanes, filters, theme → page links and the "no number twice" check.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PAGES, RUNS, SWOT, runPages, withScores } from '../data/sentiment.js'
import { BAND, biggestChange, capRows, dotGrid, dotRows, groupThemes, hash01, layoutSwarm, lanesFor, leadTheme, matchIds, moveNote, neighbour, numbersIn, repeatedNumbers, scoreStrip, scoreX, tellingSentence, themeEngines, themeQuote, themeQuoteOf, toggleOpen } from './spectrum.js'
import { byReach, divergingStack, dotPlan, fromCurrent, leadQuote, parseMatrix, reachOf, springAt, springEasing, staggerDelays, toneChanges, topChange, urlKey } from './spectrum.js'

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

test('pages match across runs by URL (www, trailing slash and query ignored)', () => {
  assert.equal(urlKey('https://www.Trustpilot.com/review/dermasuri.com/?utm=x'), urlKey('trustpilot.com/review/dermasuri.com'))
  assert.notEqual(urlKey('reddit.com/r/a'), urlKey('reddit.com/r/b'))
})

test('tone changes: only pages in both runs whose tone changed', () => {
  const a = [{ id: 'x', domain: 'a.com', path: '/1', tone: 'neutral' }, { id: 'y', domain: 'b.com', path: '/2', tone: 'positive' }, { id: 'z', domain: 'c.com', path: '/3', tone: 'neutral' }]
  const b = [{ id: 'x', domain: 'www.a.com', path: '/1/', tone: 'negative' }, { id: 'y', domain: 'b.com', path: '/2', tone: 'positive' }, { id: 'n', domain: 'd.com', path: '/4', tone: 'negative' }]
  const c = toneChanges(a, b)
  assert.deepEqual(c.map((x) => [x.page.id, x.from, x.to]), [['x', 'neutral', 'negative']])
  assert.equal(topChange(c).page.id, 'x')
  assert.equal(topChange([]), null)
  // the mock's runs are consistent by URL: every change is a real flip between two runs
  const runs = RUNS.map((r, i) => (i === RUNS.length - 1 ? PAGES : runPages(PAGES, r.counts, r.id)))
  for (let i = 1; i < runs.length; i++) for (const ch of toneChanges(runs[i - 1], runs[i])) assert.notEqual(ch.from, ch.to)
  assert.ok(toneChanges(runs[1], runs[2]).length > 0)
})

test('diverging stack: positive up, negative down, rows of two, the same page in the same place', () => {
  const pages = [
    { id: 'a', domain: 'a.com', path: '/', tone: 'positive' }, { id: 'b', domain: 'b.com', path: '/', tone: 'positive' }, { id: 'c', domain: 'c.com', path: '/', tone: 'positive' },
    { id: 'd', domain: 'd.com', path: '/', tone: 'negative' }, { id: 'e', domain: 'e.com', path: '/', tone: 'neutral' },
  ]
  const s = divergingStack(pages, { perRow: 2, pitch: 18, gap: 12 })
  assert.equal(s.up, 2)
  assert.equal(s.down, 1)
  for (const id of ['a', 'b', 'c']) assert.ok(s.slots[id].y < 0)
  assert.ok(s.slots.d.y > 0)
  assert.equal(s.slots.e, undefined) // neutral: in the band
  assert.deepEqual([s.slots.a.x, s.slots.b.x, s.slots.c.x], [-9, 9, 0]) // the last row centred
  assert.deepEqual(divergingStack([...pages].reverse(), { perRow: 2 }).slots, divergingStack(pages, { perRow: 2 }).slots)
})

test('reach: pages saying a theme ÷ all pages; most widespread first', () => {
  const g = groupThemes(SWOT, PAGES)
  for (const t of g.hurting) assert.equal(reachOf(t, PAGES.length), t.pages.length / PAGES.length)
  assert.equal(reachOf(g.hurting[0], 0), 0)
  const sorted = byReach(g.working)
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i - 1].pages.length >= sorted[i].pages.length)
  assert.equal(byReach(g.working).length, g.working.length)
})

test('lead quote per side: the page most themes cite, a quote in that tone', () => {
  const g = groupThemes(SWOT, PAGES)
  const hurt = leadQuote(g.hurting, PAGES, 'negative')
  assert.equal(hurt.page.domain, 'trustpilot.com') // two Hurting themes cite it
  assert.equal(hurt.quote.tone, 'negative')
  const work = leadQuote(g.working, PAGES, 'positive')
  assert.equal(work.quote.tone, 'positive')
  assert.equal(leadQuote(g.hurting, PAGES.map((p) => ({ ...p, tone: 'neutral' })), 'negative'), null)
  const bare = leadQuote(g.working, PAGES.map((p) => ({ ...p, sentences: [] })), 'positive')
  assert.equal(bare.quote, null) // analysed before quotes: the page, no quote
})

test('split plan: one dot per citing engine, the original to the first lane, copies hidden when merged', () => {
  const engines = [{ id: 'google' }, { id: 'chatgpt' }, { id: 'claude' }]
  const pages = [{ id: 'a', engines: ['claude', 'google'] }, { id: 'b', engines: ['chatgpt'] }, { id: 'c', engines: [] }]
  const split = dotPlan(pages, engines, true)
  assert.deepEqual(split.map((d) => [d.key, d.lane, d.shown]), [['a#0', 'google', true], ['a#1', 'claude', true], ['b#0', 'chatgpt', true], ['c#0', 'all', true]])
  const merged = dotPlan(pages, engines, false)
  assert.deepEqual(merged.map((d) => d.key), split.map((d) => d.key)) // the same elements both ways: nothing mounts or unmounts
  assert.deepEqual(merged.map((d) => d.shown), [true, false, true, true])
  assert.ok(merged.every((d) => d.lane === 'all'))
  // the mock: every page's copies = its engines
  const plan = dotPlan(PAGES, engines, true)
  assert.equal(plan.length, PAGES.reduce((n, p) => n + p.engines.length, 0))
})

test('stagger: 8ms a dot, the whole spread never past 250ms', () => {
  assert.deepEqual(staggerDelays(4), [0, 8, 16, 24])
  const many = staggerDelays(60)
  assert.equal(many[0], 0)
  assert.ok(many.at(-1) <= 250 && many.at(-1) > 240)
  for (let i = 1; i < many.length; i++) assert.ok(many[i] > many[i - 1])
  assert.deepEqual(staggerDelays(1), [0])
  assert.deepEqual(staggerDelays(0), [])
})

test('reverse from the current point: read the live matrix, interpolate from there', () => {
  assert.deepEqual(parseMatrix('matrix(1, 0, 0, 1, 120.5, -32)'), { a: 1, b: 0, c: 0, d: 1, x: 120.5, y: -32 })
  assert.deepEqual(parseMatrix('none'), { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 })
  // interrupted at x = 80 on the way from 0 to 200: going back to 0 starts at 80, not at 200 (no snap)
  assert.equal(fromCurrent(80, 0, 0), 80)
  assert.equal(fromCurrent(80, 0, 1), 0)
  assert.equal(fromCurrent(80, 0, 0.5), 40)
})

test('spring settle: starts at 0, ends at 1, overshoots a little', () => {
  assert.equal(springAt(0), 0)
  assert.ok(Math.abs(springAt(1) - 1) < 1e-9)
  const peak = Math.max(...Array.from({ length: 101 }, (_, i) => springAt(i / 100)))
  assert.ok(peak > 1.01 && peak < 1.08, `peak ${peak}`)
  assert.ok(springAt(0.3) > 0.6) // ease-out: most of the way early
  assert.match(springEasing(), /^linear\(0, .*, 1\)$/)
})

import { alsoSaidOn, capStack, changeSummary, normalizeUrl, pageHref, ribbonsInto } from './spectrum.js'

test('links: normalised cited URLs, tracking stripped, path kept, nothing unsafe', () => {
  assert.equal(normalizeUrl('https://www.byrdie.com/best-niacinamide-serums-5089123?utm_source=chatgpt.com'), 'https://www.byrdie.com/best-niacinamide-serums-5089123')
  assert.equal(normalizeUrl('https://www.youtube.com/watch?v=Qd8sR3ofxLk&utm_source=chatgpt.com'), 'https://www.youtube.com/watch?v=Qd8sR3ofxLk')
  assert.equal(normalizeUrl('https://x.com/a?gclid=1&fbclid=2&ref=search&page=2#top'), 'https://x.com/a?page=2')
  for (const bad of [null, '', '#', 'javascript:alert(1)', 'mailto:a@b.c', 'not a url', '/relative']) assert.equal(normalizeUrl(bad), null, String(bad))
})

test('every mock page: an exact http(s) link to its article, or no link at all', () => {
  let none = 0
  for (const p of PAGES) {
    const href = pageHref(p)
    if (!href) { none++; assert.equal(p.url, null, p.domain); continue }
    assert.match(href, /^https?:\/\//, p.domain)
    assert.ok(new URL(href).pathname.length > 1, `${p.domain} links to its home page`)
    assert.ok(!/[?&](utm_|gclid|fbclid|ref=)/.test(href), `${p.domain} keeps tracking`)
    assert.ok(new URL(href).hostname.endsWith(p.domain), `${p.domain} → ${href}`)
  }
  assert.equal(none, 1) // one page has no stored URL
})

test('favicon stacks: four, then "+N"', () => {
  assert.deepEqual(capStack([1, 2, 3]), { shown: [1, 2, 3], more: 0 })
  assert.deepEqual(capStack([1, 2, 3, 4, 5, 6]), { shown: [1, 2, 3, 4], more: 2 })
})

test('"Also said on": the lead theme’s other pages, else the other pages in that tone', () => {
  const g = groupThemes(SWOT, PAGES)
  const work = leadQuote(g.working, PAGES, 'positive')
  const also = alsoSaidOn(work, g.working, PAGES, 'positive')
  assert.ok(also.length > 0 && !also.includes(work.page))
  const hurt = leadQuote(g.hurting, PAGES, 'negative') // trustpilot: its themes have no other page
  assert.deepEqual(alsoSaidOn(hurt, g.hurting, PAGES, 'negative').map((p) => p.tone), ['negative'])
  assert.deepEqual(alsoSaidOn(null, [], PAGES, 'negative'), [])
})

test('the change line under each run, and the ribbons into a column', () => {
  assert.equal(changeSummary(null, { positive: 1, neutral: 1, negative: 1 }), null)
  assert.deepEqual(changeSummary({ positive: 2, neutral: 12, negative: 5 }, { positive: 4, neutral: 13, negative: 2 }), [{ tone: 'positive', d: 2 }, { tone: 'negative', d: -3 }])
  assert.deepEqual(changeSummary({ positive: 2, neutral: 1, negative: 1 }, { positive: 2, neutral: 3, negative: 1 }), [])
  const runs = RUNS.map((r, i) => (i === RUNS.length - 1 ? PAGES : runPages(PAGES, r.counts, r.id)))
  assert.deepEqual(ribbonsInto(runs, 0), [])
  assert.deepEqual(ribbonsInto(runs, 2), toneChanges(runs[1], runs[2]))
})

import { chartLayout } from './spectrum.js'

test('Over time sizing: fits at desktop widths, scrolls only when it must; the height covers everything', () => {
  for (const width of [1144, 984, 728, 700]) { // the chart's own width at 1440, 1280, 1024 and a tight 1024
    const l = chartLayout({ width, n: 6, up: 3, down: 3 })
    assert.equal(l.scroll, false, `scrolls at ${width}`)
    assert.ok(l.contentW <= width, `${l.contentW} > ${width}`)
    assert.ok(l.colW >= 96)
  }
  const phone = chartLayout({ width: 358, n: 6, up: 3, down: 3 })
  assert.equal(phone.scroll, true)
  assert.equal(phone.colW, 96)
  // the height: score labels (above the tallest stack), the stacks, dates, change line, padding
  const l = chartLayout({ width: 1000, n: 6, up: 3, down: 3, pitch: 16, gap: 14, scoreH: 22, dates: 22, change: 20, pad: 8 })
  assert.ok(l.scoreY - 18 >= 8, 'the tallest score label is inside the top')            // an 18px label above its baseline
  assert.ok(l.base - 14 - 3 * 16 >= l.scoreY, 'the score sits above the tallest stack')
  assert.ok(l.dotsBottom >= l.base + 14 + 3 * 16, 'the deepest stack is inside')
  assert.equal(l.H, l.dotsBottom + 22 + 20 + 8)
  // more rows → taller
  assert.ok(chartLayout({ width: 1000, n: 6, up: 5, down: 3 }).H > l.H)
})
