// Ported from the app (lib/share-of-voice.js, 2026-11-03); the app keeps its copy in lib/, the same functions and names.
// Share of voice's ranked list (src/components/dashboard/PromptCoverage.jsx): the brands by appearances,
// most first, each with its place and the share it shows.
//   · places come from the exact appearance counts, never the rounded %: gold, silver and bronze go to the top three
//     distinct counts (dense ranking: 30, 30, 20, 10 → 1, 1, 2, 3); only an exact tie shares a medal
//   · brands that don't appear (0) get no place
//   · shares are whole percentages adding up to 100 (largest remainder); when brands with different counts would show
//     the same whole %, those show one decimal (13.4% vs 12.9%), so the order on screen makes sense
// medal colours (owner, 2026-11-03): a richer gold, silver and bronze, the same in both themes
export const MEDALS = { 1: { name: 'Gold', fill: '#E0A200' }, 2: { name: 'Silver', fill: '#9CA3AF' }, 3: { name: 'Bronze', fill: '#B4703A' } }
// the #1 row's background and the "Top share" pill's: gold at 12%
export const TOP_TINT = `color-mix(in srgb, ${MEDALS[1].fill} 12%, transparent)`
// the "Top share" pill's text: a darker gold, so the small text reads on the 12% tint (owner, 2026-11-03); the
// medal and the tint keep #E0A200
export const TOP_TEXT = '#A87700'

// rows: [{ domain, prompts, … }] → the same rows, sorted (most first; a tie keeps the order it came in), each with
// rank (1-based dense place, or null for 0 appearances) and medal (MEDALS entry, or null)
export function rankShares(rows) {
  const sorted = (rows ?? []).map((r, i) => ({ r, i })).sort((a, b) => (b.r.prompts ?? 0) - (a.r.prompts ?? 0) || a.i - b.i).map((x) => x.r)
  let rank = 0
  let prev = null
  return sorted.map((r) => {
    const n = r.prompts ?? 0
    if (!(n > 0)) return { ...r, rank: null, medal: null }
    if (n !== prev) { rank++; prev = n }
    return { ...r, rank, medal: MEDALS[rank] ?? null }
  })
}

// whole percentages that add up to 100 (largest remainder); equal counts always get the same one
export function wholeShares(values) {
  const total = values.reduce((a, b) => a + b, 0)
  if (!total) return values.map(() => 0)
  const raw = values.map((v) => (v / total) * 100)
  const out = raw.map(Math.floor)
  let left = 100 - out.reduce((a, b) => a + b, 0)
  raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i]++; left-- } })
  return values.map((v) => out[values.indexOf(v)])
}

// the share each brand shows: its whole % (wholeShares), or one decimal when a brand with a different count shows the
// same whole % (two decimals if one isn't enough to tell them apart)
export function displayShares(values) {
  const whole = wholeShares(values)
  const total = values.reduce((a, b) => a + b, 0)
  if (!total) return whole
  return values.map((v, i) => {
    const clash = values.some((w, j) => w !== v && whole[j] === whole[i])
    if (!clash) return whole[i]
    const at = (d) => Math.round((v / total) * 100 * 10 ** d) / 10 ** d
    const differs = (d) => values.every((w) => w === v || whole[values.indexOf(w)] !== whole[i] || Math.round((w / total) * 100 * 10 ** d) / 10 ** d !== at(d))
    return differs(1) ? at(1) : at(2)
  })
}

// the #1 brand (owner, 2026-11-03 "gold medal stands out"): rank 1 (an exact tie for first is #1 too). Its row has the
// 22px gold medal (silver and bronze stay 16px), 600 weight, gold at 12% (TOP_TINT) and a 2px gold bar on its left
// edge; the hero's medal, with a gold "Top share" pill beside it, shows only for #1. (Your own brand's slice is the
// pulled-out one, not #1's.)
export const topShare = (r) => r?.rank === 1
export const medalSize = (r) => (!r?.medal ? 0 : topShare(r) ? 22 : 16)
