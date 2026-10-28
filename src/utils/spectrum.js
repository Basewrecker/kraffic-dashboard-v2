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

// the sentence a hover card shows: the first in the page's own tone with a marked phrase, then any in its tone, else the
// first; null for a page analysed before quotes were kept (it shows its title + "Quote appears after the next analysis")
export const tellingSentence = (page) => page.sentences.find((s) => s.tone === page.tone && s.mark) ?? page.sentences.find((s) => s.tone === page.tone) ?? page.sentences[0] ?? null

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

// ---- "What AI reads about you" ------------------------------------------------------------------------------------

// SWOT → two columns: Hurting you (weaknesses + threats) and Working for you (strengths + opportunities). Within each,
// the themes most of whose pages carry that side's tone come first (negative for hurting, positive for working).
const KIND = { strengths: 'strength', opportunities: 'opportunity', weaknesses: 'weakness', threats: 'threat' }
export function groupThemes(swot, pages) {
  const byId = new Map(pages.map((p) => [p.id, p]))
  const side = (keys, tone) => keys
    .flatMap((k) => (swot?.[k] ?? []).map((t, i) => ({ ...t, kind: KIND[k], order: i, pages: t.sources.map((id) => byId.get(id)).filter(Boolean) })))
    .filter((t) => t.pages.length)
    .map((t) => ({ ...t, hits: t.pages.filter((p) => p.tone === tone).length }))
    .sort((a, b) => b.hits - a.hits || b.pages.length - a.pages.length || keys.indexOf(`${a.kind}s`.replace('opportunitys', 'opportunities')) - keys.indexOf(`${b.kind}s`.replace('opportunitys', 'opportunities')) || a.order - b.order)
  return { hurting: side(['weaknesses', 'threats'], 'negative'), working: side(['strengths', 'opportunities'], 'positive') }
}

// the sentence on a page that's about the theme (its match), else the page's most telling one; null without quotes
export const themeQuote = (page, theme) => page.sentences.find((s) => theme.match?.test(s.text)) ?? tellingSentence(page)

// a theme's ONE quote: the first page with a sentence about it, else the first page with any quote, else the first page
// (quote-less); `others` = the rest of its pages
export function themeQuoteOf(theme) {
  const page = theme.pages.find((p) => p.sentences.some((s) => theme.match?.test(s.text))) ?? theme.pages.find((p) => p.sentences.length) ?? theme.pages[0]
  if (!page) return null
  return { page, quote: themeQuote(page, theme), others: theme.pages.filter((p) => p !== page) }
}

// the lead quote above the columns: the most important Hurting theme (groupThemes ranks it first) and its quote
export const leadTheme = (groups) => {
  const theme = groups.hurting[0]
  return theme ? { theme, ...themeQuoteOf(theme) } : null
}

// a column shows at most `cap` rows; the rest sit behind "+N more" until it's expanded (in place)
export function capRows(list, expanded, cap = 5) {
  return expanded || list.length <= cap ? { rows: list, more: 0 } : { rows: list.slice(0, cap), more: list.length - cap }
}

// one open row across both columns: opening one closes the other; opening the open one closes it
export const toggleOpen = (open, key) => (open === key ? null : key)

// engines behind a theme's pages, in a fixed order
export const themeEngines = (theme, order = ['google', 'chatgpt', 'claude']) => order.filter((e) => theme.pages.some((p) => p.engines.includes(e)))

// ---- Over time ----------------------------------------------------------------------------------------------------

// the score strip above the dots: a y for each score, fitted to the runs (and to 50, so the even line is always in it)
export function scoreStrip(scores, { height, pad = 6 }) {
  const lo = Math.min(50, ...scores) - 3, hi = Math.max(50, ...scores) + 3
  const y = (v) => pad + (1 - (v - lo) / (hi - lo)) * (height - 2 * pad)
  return { y, evenY: y(50), lo, hi }
}

// a run's dots of one tone, wrapping into rows of at most `perRow`, each row centred; x from the column's centre, y from
// the top of the tone's row band. → [{ x, y }]
export function dotGrid(n, { perRow = 6, pitch = 12 }) {
  const out = []
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow)
    const inRow = Math.min(perRow, n - row * perRow)
    out.push({ x: ((i % perRow) - (inRow - 1) / 2) * pitch, y: row * pitch + pitch / 2 })
  }
  return out
}
export const dotRows = (n, perRow = 6) => Math.ceil(n / perRow)

// the biggest move between two runs (the latest wins a tie): its index (the run after the change), the change and
// what moved, in words without digits: "one more positive page and one fewer negative"
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
export function biggestChange(runs) {
  let best = null
  for (let i = 1; i < runs.length; i++) {
    const d = runs[i].score - runs[i - 1].score
    if (d !== 0 && (!best || Math.abs(d) >= Math.abs(best.delta))) best = { index: i, delta: d }
  }
  if (!best) return null
  const a = runs[best.index - 1].counts, b = runs[best.index].counts
  const part = (tone) => {
    const d = b[tone] - a[tone]
    if (!d) return null
    return `${WORDS[Math.abs(d)] ?? Math.abs(d)} ${d > 0 ? 'more' : 'fewer'} ${tone}`
  }
  const parts = ['positive', 'negative'].map(part).filter(Boolean)
  const what = parts.length ? `${parts[0]} page${/^one /.test(parts[0]) ? '' : 's'}${parts[1] ? ` and ${parts[1]}` : ''}` : 'the same split of pages'
  return { ...best, what }
}

// the note under the biggest move's two columns, from the data: "+13 · 2 more positive, 3 fewer negative"
export function moveNote(runs, big) {
  if (!big) return null
  const a = runs[big.index - 1].counts, b = runs[big.index].counts
  const part = (tone) => { const d = b[tone] - a[tone]; return d ? `${Math.abs(d)} ${d > 0 ? 'more' : 'fewer'} ${tone}` : null }
  const parts = ['positive', 'negative'].map(part).filter(Boolean)
  return `${big.delta > 0 ? '+' : '−'}${Math.abs(big.delta)}${parts.length ? ` · ${parts.join(', ')}` : ''}`
}
