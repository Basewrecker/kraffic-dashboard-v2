// Trends: the page's rules as plain functions (as the app's lib/google-trends-view.js), so the chart, the lists and
// the drawer agree and the rules can be tested without a browser.

// ---- the chart
// y-axis fitted to the data: the smallest "nice" step that covers min..max in at most 4 gaps, so a chart whose lines
// live between 45 and 100 doesn't waste half its height on an empty 0–40 band.
export function fitAxis(values, maxGaps = 4) {
  const nums = values.filter((v) => v != null)
  if (!nums.length) return { lo: 0, hi: 100, ticks: [0, 25, 50, 75, 100] }
  const min = Math.min(...nums), max = Math.max(...nums)
  for (const step of [5, 10, 20, 25, 50]) {
    const lo = Math.max(0, Math.floor((min - 1) / step) * step)
    const hi = Math.max(lo + step, Math.ceil(max / step) * step)
    if ((hi - lo) / step <= maxGaps) return { lo, hi, ticks: Array.from({ length: (hi - lo) / step + 1 }, (_, i) => lo + i * step) }
  }
  const hi = Math.ceil(max / 100) * 100
  return { lo: 0, hi, ticks: [0, hi / 2, hi] }
}

// End labels never overlap: each label wants its line's last y; labels closer than `gap` are pushed apart (keeping
// their order), then the whole column is nudged back inside lo..hi. items: [{ id, y }] → { [id]: y }
export function spreadLabels(items, gap, lo, hi) {
  const list = items.map((x) => ({ ...x })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < list.length; i++) if (list[i].y - list[i - 1].y < gap) list[i].y = list[i - 1].y + gap
  const over = list.length ? list.at(-1).y - hi : 0
  if (over > 0) {
    list.at(-1).y -= over
    for (let i = list.length - 2; i >= 0; i--) if (list[i + 1].y - list[i].y < gap) list[i].y = list[i + 1].y - gap
  }
  if (list.length && list[0].y < lo) {
    list[0].y = lo
    for (let i = 1; i < list.length; i++) if (list[i].y - list[i - 1].y < gap) list[i].y = list[i - 1].y + gap
  }
  return Object.fromEntries(list.map((x) => [x.id, x.y]))
}

// A smooth line through the points that never overshoots them (monotone cubic), so a curve can't dip below a value
// that was never there. pts: [[x, y]] → an SVG path
export function smoothPath(pts) {
  const n = pts.length
  if (!n) return ''
  if (n < 3) return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  const dx = [], slope = []
  for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1][0] - pts[i][0]); slope.push((pts[i + 1][1] - pts[i][1]) / dx[i]) }
  const m = [slope[0]]
  for (let i = 1; i < n - 1; i++) m.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2)
  m.push(slope[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    const a = m[i] / slope[i], b = m[i + 1] / slope[i], h = Math.hypot(a, b)
    if (h > 3) { m[i] = (3 * a * slope[i]) / h; m[i + 1] = (3 * b * slope[i]) / h }
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]
    d += `C${(x0 + dx[i] / 3).toFixed(1)},${(y0 + (m[i] * dx[i]) / 3).toFixed(1)} ${(x1 - dx[i] / 3).toFixed(1)},${(y1 - (m[i + 1] * dx[i]) / 3).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`
  }
  return d
}

// which points get a date under the axis: `count` of them, evenly spread, first and last included
export function tickIndexes(n, count) {
  if (n <= count) return Array.from({ length: n }, (_, i) => i)
  return Array.from({ length: count }, (_, i) => Math.round((i * (n - 1)) / (count - 1)))
}

// ---- the lists
export const PAGE_SIZE = 10
export const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'untracked', label: 'Not tracked' },
  { id: 'named', label: 'Named' },
  { id: 'missed', label: 'Missed' },
]
// a row's last column: Named / Missed for a tracked prompt, 'tracking' once the user tracks it here (no answer
// checked yet), null = not tracked
export const statusOf = (row, tracked) => row.status ?? (tracked?.has(row.query) ? 'tracking' : null)
export function filterRows(rows, filter, tracked) {
  if (filter === 'all') return rows
  return rows.filter((r) => { const s = statusOf(r, tracked); return filter === 'untracked' ? s == null : s === filter })
}
export const countFilters = (rows, tracked) => Object.fromEntries(FILTERS.map((f) => [f.id, filterRows(rows, f.id, tracked).length]))
export const fmtGrowth = (row) => (row.breakout ? 'Breakout' : row.growth == null ? '—' : `${row.growth.toLocaleString('en-US')}%`)
const byGrowth = (a, b) => (b.breakout ? 1 : 0) - (a.breakout ? 1 : 0) || (b.growth ?? 0) - (a.growth ?? 0)

// The Rising column is never empty (as the app, #209).
//   own rising rows fill a page                → those rows                         "With <term>"
//   fewer                                       → + the brand's other terms' rising   "With <term> + your other terms"
//   nothing rising for any term                 → "Worth tracking next": the most-searched prompts not tracked yet,
//                                                 and `strip`: one slim line above Top prompts that says so
// own: the selected term's rising rows; others: every other term's rising rows; top: all terms' top rows
export function fillRising({ own, others, top, tracked, size = PAGE_SIZE }) {
  if (own.length >= size) return { kind: 'own', rows: own }
  const seen = new Set(own.map((r) => r.query))
  const extra = others.filter((r) => !seen.has(r.query) && seen.add(r.query)).sort(byGrowth)
  if (own.length + extra.length > 0) return { kind: extra.length ? 'filled' : 'own', rows: [...own, ...extra] }
  const taken = new Set()
  const next = top.filter((r) => statusOf(r, tracked) == null && !taken.has(r.query) && taken.add(r.query)).sort((a, b) => b.score - a.score)
  return { kind: 'next', rows: next, strip: true }
}

// the drawer's two sorts
export const SORTS = {
  top: [{ id: 'score', label: 'Most searched' }, { id: 'az', label: 'A to Z' }],
  rising: [{ id: 'growth', label: 'Fastest rising' }, { id: 'az', label: 'A to Z' }],
}
export function sortRows(rows, sort) {
  const list = [...rows]
  if (sort === 'az') return list.sort((a, b) => a.query.localeCompare(b.query))
  if (sort === 'growth') return list.sort(byGrowth)
  return list.sort((a, b) => b.score - a.score)
}
