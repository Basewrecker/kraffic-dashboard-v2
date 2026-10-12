// Priority for missed prompts. Pure: same rows in → same priorities out.
//   score = competitors winning × 3 + platforms missing × 2 + missing streak × 1
// Rows are ranked by score (ties: longer streak first, then id); top 25% High, next 40% Medium, rest Low.

export const PRIORITY_RANK = { high: 3, medium: 2, low: 1 }

export function priorityScore(row) {
  return row.competitors.length * 3 + row.platforms.length * 2 + row.streak
}

export function assignPriorities(rows) {
  const ranked = rows
    .map((r) => ({ id: r.id, score: priorityScore(r), streak: r.streak }))
    .sort((a, b) => b.score - a.score || b.streak - a.streak || a.id - b.id)
  const highCut = Math.round(rows.length * 0.25)
  const mediumCut = highCut + Math.round(rows.length * 0.4)
  const out = {}
  ranked.forEach((r, i) => {
    out[r.id] = { score: r.score, level: i < highCut ? 'high' : i < mediumCut ? 'medium' : 'low' }
  })
  return out
}
