// The Reports dot field: one dot per tracked prompt, the prompts AI names first (ink), then the ones it misses (grey).
// These place the dots, inside a w × h box, as a faint version of each report's hero, from the brand's own counts:
// weekly = the prompt flow bands · ceo = share-of-voice slope lines · rival = the head-to-head grid ·
// content = the opportunity bubbles. Plain JS (unit-tested in dotShapes.test.js).
import { dataFor } from './reports.js'

// a small seeded random, so a brand's dots land in the same places every time
export function rng(seed = 1) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// how many dots, and how many of them are named (they come first)
export function dotCounts(brandId) {
  const d = dataFor(brandId)
  return d ? { total: d.prompts, named: d.series.named.at(-1) } : { total: 0, named: 0 }
}

// at rest: spread evenly over the box (a jittered grid, so there are no clumps or holes)
export function restLayout(n, w, h, seed = 7) {
  const r = rng(seed)
  const cols = Math.max(1, Math.round(Math.sqrt((n * w) / h)))
  const rows = Math.ceil(n / cols)
  const cw = w / cols
  const ch = h / rows
  const cells = Array.from({ length: cols * rows }, (_, i) => i)
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]] }
  return Array.from({ length: n }, (_, i) => {
    const c = cells[i]
    return { x: (c % cols + 0.15 + r() * 0.7) * cw, y: (Math.floor(c / cols) + 0.15 + r() * 0.7) * ch }
  })
}

const smooth = (t) => t * t * (3 - 2 * t)

// weekly: four bands from last week (left) to this week (right): held, won (named now), lost, still missing
function flowShape(d, w, h, r) {
  const n = d.prompts
  const f = d.flow.week
  const gap = h * 0.08
  const unit = (h - gap) / n
  const at = (units, afterGap) => units * unit + (afterGap ? gap : 0)
  const bands = {
    held: { count: f.held, L: at(0), R: at(0) },
    won: { count: f.won, L: at(f.held + f.lost, true), R: at(f.held) },
    lost: { count: f.lost, L: at(f.held), R: at(f.held + f.won, true) },
    missing: { count: f.missing, L: at(f.held + f.lost + f.won, true), R: at(f.held + f.won + f.lost, true) },
  }
  const order = [...Array(f.held).fill('held'), ...Array(f.won).fill('won'), ...Array(f.lost).fill('lost'), ...Array(f.missing).fill('missing')]
  const seen = { held: 0, won: 0, lost: 0, missing: 0 }
  const x0 = w * 0.03
  const x1 = w * 0.97
  // each band is rows of evenly spaced dots following its curve (so it reads as a band, not a scatter)
  const COLS = 22
  return order.map((k) => {
    const b = bands[k]
    const j = seen[k]++
    const cols = Math.min(COLS, b.count)
    const lanes = Math.ceil(b.count / cols)
    const t = (j % cols + 0.5 + (r() - 0.5) * 0.2) / cols
    const u = (Math.floor(j / cols) + 0.5) / lanes
    const yl = b.L + u * b.count * unit
    const yr = b.R + u * b.count * unit
    return { x: x0 + t * (x1 - x0), y: yl + (yr - yl) * smooth(t), band: k }
  })
}

// ceo: share of voice a month ago (left) and now (right): you and the top three competitors, one line each
function slopeShape(d, w, h, r) {
  const n = d.prompts
  const named = d.series.named.at(-1)
  const keys = Object.keys(d.share)
  const you = keys[0]
  const top = keys.slice(1).sort((a, b) => d.share[b].at(-1) - d.share[a].at(-1)).slice(0, 3)
  const lines = [you, ...top].map((k) => ({ k, from: d.share[k][3], now: d.share[k].at(-1) }))
  const vals = lines.flatMap((l) => [l.from, l.now])
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const pad = h * 0.1
  const y = (v) => pad + (1 - (v - lo) / (hi - lo || 1)) * (h - pad * 2)
  // your line gets the named prompts' dots (it's the ink line); the rest share the others
  const counts = [Math.min(named, Math.round(n * 0.4))]
  const rest = n - counts[0]
  top.forEach((_, i) => counts.push(Math.floor(rest / top.length) + (i < rest % top.length ? 1 : 0)))
  const out = []
  const x0 = w * 0.08
  const x1 = w * 0.92
  lines.forEach((l, li) => {
    const m = counts[li]
    for (let j = 0; j < m; j++) {
      const t = (j + 0.5) / m
      out.push({ x: x0 + t * (x1 - x0), y: y(l.from) + (y(l.now) - y(l.from)) * t + (r() - 0.5) * 2, line: l.k })
    }
  })
  return out
}

// rival: the 2 × 2 grid — names you / doesn't (columns) × names them / doesn't (rows), as squares filled from the top
function quadrantShape(d, w, h) {
  const rival = Object.keys(d.h2h)[0]
  const q = d.h2h[rival]
  const gap = Math.min(w, h) * 0.06
  const qw = (w - gap) / 2
  const qh = (h - gap) / 2
  const cells = [
    { x: 0, y: 0, groups: [['youFirst', q.youFirst], ['themFirst', q.themFirst]] },
    { x: 0, y: qh + gap, groups: [['onlyYou', q.onlyYou]] },
    { x: qw + gap, y: 0, groups: [['onlyThem', q.onlyThem]] },
    { x: qw + gap, y: qh + gap, groups: [['neither', q.neither]] },
  ]
  const most = Math.max(...cells.map((c) => c.groups.reduce((a, [, k]) => a + k, 0)))
  const inner = 0.12
  let p = Math.min(qw, qh)
  while (p > 2) {
    const cols = Math.floor((qw * (1 - inner)) / p)
    if (cols > 0 && Math.ceil(most / cols) * p <= qh * (1 - inner)) break
    p -= 0.5
  }
  const cols = Math.max(1, Math.floor((qw * (1 - inner)) / p))
  // named first (you first, they're first, only you), then missed (only them, neither): the dots' own order
  const byGroup = {}
  for (const c of cells) {
    let k = 0
    for (const [g, count] of c.groups) {
      byGroup[g] = Array.from({ length: count }, () => {
        const i = k++
        return { x: c.x + qw * inner * 0.5 + (i % cols + 0.5) * p, y: c.y + qh * inner * 0.5 + (Math.floor(i / cols) + 0.5) * p, group: g }
      })
    }
  }
  return [...byGroup.youFirst, ...byGroup.themFirst, ...byGroup.onlyYou, ...byGroup.onlyThem, ...byGroup.neither]
}

// content: the prompts you're missing gather into one bubble per topic (x: how many, y: how strongly a competitor
// owns them); the named prompts lie along the bottom as the axis
function bubbleShape(d, w, h, r) {
  const named = d.series.named.at(-1)
  const maxX = Math.max(...d.gaps.map((g) => g.missing)) + 1
  const pl = w * 0.08
  const pr = w * 0.06
  const pt = h * 0.12
  const pb = h * 0.14
  const X = (v) => pl + (v / maxX) * (w - pl - pr)
  const Y = (v) => pt + (1 - v / 100) * (h - pt - pb)
  const rMax = Math.min(w * 0.07, h * 0.16)
  const big = Math.sqrt(maxX)
  const axis = Array.from({ length: named }, (_, j) => ({ x: pl + ((j + 0.5) / named) * (w - pl - pr), y: h - pb * 0.35 + (r() - 0.5) * 3, axis: true }))
  const bubbles = d.gaps.flatMap((g) => {
    const cx = X(g.missing)
    const cy = Y((g.owned / g.missing) * 100)
    const rad = (rMax * Math.sqrt(g.missing)) / big
    return Array.from({ length: g.missing }, (_, j) => {
      const rr = rad * Math.sqrt((j + 0.5) / g.missing)
      const a = j * 2.399963
      return { x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a), theme: g.theme }
    })
  })
  return [...axis, ...bubbles]
}

const SHAPES = { weekly: flowShape, ceo: slopeShape, rival: quadrantShape, content: bubbleShape }
export const SHAPE_KINDS = Object.keys(SHAPES)

// → one point per prompt (named first), inside 0..w × 0..h; null when the brand has no data or the kind is unknown
export function shapeFor(kind, brandId, w, h) {
  const d = dataFor(brandId)
  const make = SHAPES[kind]
  if (!d || !make) return null
  return make(d, w, h, rng(kind.length * 97 + d.prompts))
}
