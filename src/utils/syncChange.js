// "vs last sync" must add up on screen. The change in points is the score shown now minus the score shown for the
// sync before (both rounded, as displayed), never a separately worked-out number. The change in prompts is that
// sync's gained minus lost. The Visibility score card and the Sync history rows both read these.

export const pointsBetween = (now, before) =>
  Number.isFinite(now) && Number.isFinite(before) ? Math.round(now) - Math.round(before) : null

export const netPrompts = (changes) => (changes ? (changes.gained?.length || 0) - (changes.lost?.length || 0) : null)

// one brand view (KPIs + Sync history, newest row first), made to agree: each row's delta is its score minus the row
// below it; the card's delta is its score minus the previous sync's row, and only when the latest row is the score
// the card shows (otherwise there is no honest "before" to compare with, so no delta line)
export function withSyncChanges(view) {
  const list = view.syncHistory || []
  const rows = list.map((r, i) => {
    const below = list[i + 1]
    return {
      ...r,
      delta: below ? pointsBetween(r.visibility, below.visibility) : (r.delta ?? null),
      netPrompts: netPrompts(r.changes),
    }
  })
  const [latest, before] = rows
  const sameScore = !!latest && pointsBetween(view.kpis.score, latest.visibility) === 0
  const kpis = {
    ...view.kpis,
    scoreDelta: sameScore && before ? pointsBetween(view.kpis.score, before.visibility) : null,
    netPrompts: sameScore && before ? latest.netPrompts : null,
  }
  return { ...view, kpis, syncHistory: rows }
}

const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')

// "+10 prompts" / "−1 prompt" / "0 prompts"
export const promptsText = (n) => `${signed(n)} ${Math.abs(n) === 1 ? 'prompt' : 'prompts'}`

// the words after the arrow: { arrow: '▲' | '▼' | null, text: '7 pts vs last sync · +10 prompts' }
export function changeParts(points, prompts, { suffix = ' vs last sync' } = {}) {
  if (points == null) return null
  const tail = prompts == null ? '' : ` · ${promptsText(prompts)}`
  if (points === 0) return { arrow: null, text: `No change${suffix}${tail}` }
  return { arrow: points > 0 ? '▲' : '▼', text: `${Math.abs(points)} ${Math.abs(points) === 1 ? 'pt' : 'pts'}${suffix}${tail}` }
}
