// The Sentiment spectrum's pure logic: the beeswarm layout (dots placed by tone, never overlapping), the score marker,
// keyboard neighbours, engine lanes, the filters and the "no number twice" check. Tested in spectrum.test.js.
import { countTones, scoreOf } from '../data/sentiment.js'

// a stable 0…1 from an id, so a page keeps its place between renders and runs
export function hash01(id) {
  let h = 2166136261
  for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 10007) / 10007
}

// production has no per-page number, only a tone: three bands, Negative | Neutral | Positive
export const BAND = { negative: 0, neutral: 1, positive: 2 }

// Beeswarm: each dot's x is spread evenly (in a stable order) across its tone band, with a little jitter; y is the
// smallest offset from the centre line that keeps it clear of every dot already placed (centres ≥ 2r + gap apart).
//   items: [{ id, tone }] · returns { pos: { [id]: { x, y } }, extent } (extent = the swarm's half-height, dot included)
export function layoutSwarm(items, { width, r = 14, gap = 3, pad = 8 }) {
  const band = width / 3
  const D = 2 * r + gap
  const pos = {}
  const targets = []
  for (const [tone, b] of Object.entries(BAND)) {
    const inBand = items.filter((it) => it.tone === tone).sort((a, c) => hash01(a.id) - hash01(c.id))
    // a few dots gather round the band's middle; many spread across it (and stack)
    const mid = (b + 0.5) * band
    const half = Math.max(0, Math.min(band / 2 - pad - r, ((inBand.length - 1) * D * 1.15) / 2))
    const lo = mid - half, hi = mid + half
    const span = hi - lo
    inBand.forEach((it, i) => {
      const even = inBand.length === 1 ? 0.5 : i / (inBand.length - 1)
      const jitter = (hash01(`${it.id}:j`) - 0.5) * Math.min(span / Math.max(inBand.length, 1), D) * 0.6
      targets.push({ id: it.id, x: Math.min(hi, Math.max(lo, lo + even * span + jitter)) })
    })
  }
  const placed = []
  let extent = items.length ? r : 0
  for (const t of targets.sort((a, b) => a.x - b.x)) {
    // forbidden y ranges from the dots within reach
    const blocks = placed.filter((p) => Math.abs(p.x - t.x) < D).map((p) => {
      const h = Math.sqrt(D * D - (p.x - t.x) ** 2)
      return [p.y - h, p.y + h]
    })
    const free = (y) => blocks.every(([a, b]) => y <= a + 1e-6 || y >= b - 1e-6)
    const candidates = [0, ...blocks.flat()].sort((a, b) => Math.abs(a) - Math.abs(b))
    const y = candidates.find(free) ?? 0
    placed.push({ x: t.x, y })
    pos[t.id] = { x: t.x, y }
    extent = Math.max(extent, Math.abs(y) + r)
  }
  return { pos, extent }
}

// the score marker: 0 at the far left, 50 (even) in the middle, 100 at the far right
export const scoreX = (score, width) => (Math.max(0, Math.min(100, score)) / 100) * width

// arrow-key neighbour: the nearest dot in that direction (the cross-axis distance counts double); none → stay
export function neighbour(points, fromId, dir) {
  const cur = points.find((p) => p.id === fromId)
  if (!cur) return points[0]?.id ?? null
  const ahead = { ArrowRight: (p) => p.x > cur.x + 0.5, ArrowLeft: (p) => p.x < cur.x - 0.5, ArrowDown: (p) => p.y > cur.y + 0.5, ArrowUp: (p) => p.y < cur.y - 0.5 }[dir]
  if (!ahead) return fromId
  const horiz = dir === 'ArrowRight' || dir === 'ArrowLeft'
  const cost = (p) => (horiz ? Math.abs(p.x - cur.x) + 2 * Math.abs(p.y - cur.y) : Math.abs(p.y - cur.y) + 2 * Math.abs(p.x - cur.x))
  const best = points.filter((p) => p.id !== fromId && ahead(p)).sort((a, b) => cost(a) - cost(b))[0]
  return best ? best.id : fromId
}

// "Split by engine": one lane per engine with its pages and its own score
export const lanesFor = (pages, engines) => engines.map((e) => {
  const on = pages.filter((p) => p.engines.includes(e.id))
  return { ...e, pages: on, score: scoreOf(countTones(on)) }
})

// which pages the filters keep: engine, tone (the legend) and a theme's pages; null = no filter
export function matchIds(pages, { engine = 'all', tone = null, theme = null } = {}) {
  return new Set(pages
    .filter((p) => engine === 'all' || p.engines.includes(engine))
    .filter((p) => !tone || p.tone === tone)
    .filter((p) => !theme || theme.sources.includes(p.id))
    .map((p) => p.id))
}

// the sentence a hover card shows: the first in the page's own tone with a marked phrase, then any in its tone, else the first
export const tellingSentence = (page) => page.sentences.find((s) => s.tone === page.tone && s.mark) ?? page.sentences.find((s) => s.tone === page.tone) ?? page.sentences[0]

// "No number twice": the numbers in some visible text (dates and times are left out: "Oct 20", "0:42")
export function numbersIn(text) {
  const clean = String(text)
    .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
  return (clean.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', ''))
}
// numbers that appear in more than one of the texts (or twice in one): [{ n, texts }]
export function repeatedNumbers(texts) {
  const seen = new Map()
  texts.forEach((t) => { for (const n of numbersIn(t)) seen.set(n, [...(seen.get(n) ?? []), t]) })
  return [...seen].filter(([, ts]) => ts.length > 1).map(([n, ts]) => ({ n, texts: ts }))
}
