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

// The "All N brands" checklist: toggle one competitor on or off the chart. drawn: keys in slot order. Checking one
// while the chart is full swaps out the last one (it takes that slot, so it keeps that colour); the last competitor
// can't be unchecked. → { drawn, out: the key swapped out, or null }
export function pickRival(drawn, key, max = MAX_RIVALS) {
  if (drawn.includes(key)) return drawn.length > 1 ? { drawn: drawn.filter((k) => k !== key), out: null } : { drawn, out: null }
  if (drawn.length < max) return { drawn: [...drawn, key], out: null }
  return { drawn: [...drawn.slice(0, max - 1), key], out: drawn[max - 1] }
}

// The drawn competitors from the URL's ?brands=a,b,c: known keys only, no repeats, at most `max`; none → the top ones
export function picksFrom(ranked, picks, max = MAX_RIVALS) {
  const ok = [...new Set(picks ?? [])].filter((k) => ranked.includes(k)).slice(0, max)
  return ok.length ? ok : ranked.slice(0, max)
}

// Legend chips on one line: the widest a chip may be so they all fit `avail` px. Short names stay whole; only the
// longest ones are cut, all to the same width. widths: each chip's full width; gap between chips. → px, or Infinity
export function chipCap(widths, avail, gap = 0) {
  const room = avail - gap * Math.max(0, widths.length - 1)
  const w = [...widths].sort((a, b) => a - b)
  let used = 0
  for (let i = 0; i < w.length; i++) {
    const cap = (room - used) / (w.length - i)
    if (w[i] > cap) return Math.max(0, Math.floor(cap))
    used += w[i]
  }
  return Infinity
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

// Brands with a single point in range → { [key]: { index, date, why } }. why: there's no earlier point because the
// old scoring miscounted the brand (an earlier period before the scoring change has other brands but not this one), or
// because it has no earlier scan in range. points: the chart's points; series: [{ key, label }]; nameOf(series) → name.
export function lonePoints(points, series, unit, nameOf) {
  if (!points || points.length < 2) return {}
  const out = {}
  for (const s of series) {
    const at = points.map((p, i) => (p[s.key] != null ? i : -1)).filter((i) => i >= 0)
    if (at.length !== 1) continue
    const hiddenBefore = points.slice(0, at[0]).some((p) => p.beforeScoring && p[s.key] == null && series.some((o) => p[o.key] != null))
    const name = nameOf(s)
    out[s.key] = {
      index: at[0],
      date: points[at[0]].date,
      why: hiddenBefore ? `${name}: earlier ${unit}s are hidden, the old scoring miscounted this brand` : `${name}: no earlier ${unit} on record in this range`,
    }
  }
  return out
}

// The Visibility history insight, one plain line about the range's last point: who leads and the focal brand's
// share, with its move when the period before was counted the same way (end.deltas). No methodology.
// "Finance of America leads at 60% this month, ahead of Reverse at 28%."
export function historyInsight({ end, series, youKey, name, unit, nameOf }) {
  if (!end || end[youKey] == null) return null
  const when = `this ${unit}`
  const d = end.deltas?.[youKey]
  const you = end[youKey]
  const moved = d == null ? null : d > 0 ? `rose ${d} point${d === 1 ? '' : 's'} to ${you}%` : d < 0 ? `fell ${-d} point${d === -1 ? '' : 's'} to ${you}%` : `held steady at ${you}%`
  const ranked = series.filter((x) => end[x.key] != null).sort((a, b) => end[b.key] - end[a.key])
  const [leader, runner] = ranked
  if (!leader || ranked.length < 2) return { text: moved ? `${name} ${moved} ${when}.` : `${name} is at ${you}% ${when}.`, other: null }
  // a tie at the top: "level", never "ahead of … at the same %"
  if (end[leader.key] === end[runner.key]) {
    const youTop = leader.key === youKey || runner.key === youKey
    const other = leader.key === youKey ? runner : runner.key === youKey ? leader : null
    if (youTop) return { text: moved ? `${name} ${moved} ${when}, level with ${nameOf(other)}.` : `${name} and ${nameOf(other)} are level at ${you}% ${when}.`, other }
    return { text: `${nameOf(leader)} and ${nameOf(runner)} lead at ${end[leader.key]}% ${when}; ${name} is at ${you}%.`, other: leader }
  }
  if (leader.key === youKey) {
    return {
      text: moved
        ? `${name} ${moved} ${when} and leads, ahead of ${nameOf(runner)} at ${end[runner.key]}%.`
        : `${name} leads at ${you}% ${when}, ahead of ${nameOf(runner)} at ${end[runner.key]}%.`,
      other: runner,
    }
  }
  return {
    text: moved
      ? `${name} ${moved} ${when}; ${nameOf(leader)} leads at ${end[leader.key]}%.`
      : runner.key === youKey
        ? `${nameOf(leader)} leads at ${end[leader.key]}% ${when}, ahead of ${name} at ${you}%.`
        : `${nameOf(leader)} leads at ${end[leader.key]}% ${when}; ${name} is at ${you}%.`,
    other: leader,
  }
}
