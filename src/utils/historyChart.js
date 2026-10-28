// Visibility history: the pure rules behind the chart (unit-tested in historyChart.test.js; plain JS for Node).

// At most 4 series are drawn: the focal brand + 3 competitors. Only 3 competitor colours exist (indigo, red, green).
export const MAX_RIVALS = 3

// ranked: competitor keys by share, highest first. swap: one key from outside the top 3, shown in the 3rd slot instead
// (the top 3's last one goes back to the "+N more" list). → { drawn: keys in slot order, rest: keys by share }
export function drawnRivals(ranked, swap = null, max = MAX_RIVALS) {
  const top = ranked.slice(0, max)
  if (!swap || top.includes(swap) || !ranked.includes(swap)) return { drawn: top, rest: ranked.slice(max) }
  const drawn = [...top.slice(0, max - 1), swap]
  return { drawn, rest: ranked.filter((k) => !drawn.includes(k)) }
}

// Change view: a symmetric axis on round steps, 2 ticks a side (−20, −10, 0, +10, +20). The largest change plus 1 always
// fits, so a bar never touches the edge.
const STEPS = [1, 2, 5, 10, 20, 25, 50]
export function symmetricTicks(maxAbs, perSide = 2) {
  const need = Math.max(1, Math.ceil(Math.abs(maxAbs ?? 0)) + 1)
  const step = STEPS.find((s) => s * perSide >= need) ?? Math.ceil(need / perSide / 50) * 50
  const lim = step * perSide
  return { domain: [-lim, lim], ticks: Array.from({ length: perSide * 2 + 1 }, (_, i) => (i - perSide) * step) }
}

// Share axis with Compare on: 0–100 when anyone is above 50%; otherwise 0 to the next 10 above the top value (+3), in
// steps of 10, so a market where everyone sits under a third isn't squashed along the floor.
export function shareAxis(maxValue) {
  if (maxValue > 50) return { domain: [0, 100], ticks: [0, 25, 50, 75, 100] }
  const hi = Math.max(20, Math.ceil(((maxValue ?? 0) + 3) / 10) * 10)
  return { domain: [0, hi], ticks: Array.from({ length: hi / 10 + 1 }, (_, i) => i * 10) }
}

// Bar view: grouped bars, each at most `cap` px wide, leaving at least `groupGap` of every date's slot empty so dates
// read as separate groups. width = the plot's width in px.
export function groupedBarSize({ width, groups, bars, cap = 20, min = 3, gap = 2, groupGap = 0.35 }) {
  if (!(width > 0) || !groups || !bars) return cap
  const room = (width / groups) * (1 - groupGap) - gap * (bars - 1)
  return Math.max(min, Math.min(cap, Math.floor(room / bars)))
}

// Where a scoring change falls on the x axis, in point-index units (3.29 = between the 4th and 5th points), or null
// when the window has no point on both sides of it. marker: { after: the last date scored the old way, frac: 0–1 }.
export function scoringPosition(dates, marker) {
  if (!marker) return null
  const i = dates.indexOf(marker.after)
  if (i === -1 || i === dates.length - 1) return null
  return i + marker.frac
}
