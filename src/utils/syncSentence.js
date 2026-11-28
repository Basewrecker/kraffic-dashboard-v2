// Sync history's rows (as the app, #223): one plain sentence per sync, and the filter it falls under. Pure, so the
// card, the CSV and the tests read the same words.
//   row    { visibility, visible, total, delta } (delta: its score minus the sync before's, both as shown; null: none)
//   below  the sync before it (the next row down), or undefined for the first sync on record
const pts = (n) => `${n} point${n === 1 ? '' : 's'}`
const day = (date) => String(date ?? '').replace(/, \d{4}$/, '') // "Oct 5, 2026" → "Oct 5"

// 'up' | 'down' | 'same' | 'first' | 'none' (a scan with no result: nothing to compare)
export function syncKind(row, below) {
  if (row?.visibility == null) return 'none'
  // the oldest row on the page can still carry its change (the list holds the latest syncs, not all of them)
  if (row.delta == null || (below && below.visibility == null)) return 'first'
  return row.delta > 0 ? 'up' : row.delta < 0 ? 'down' : 'same'
}
// the prompts added since the sync before (0 when none, or when there's no sync before)
export const promptsAdded = (row, below) => (below && row?.total != null && below.total != null ? Math.max(0, row.total - below.total) : 0)

export function syncSentence(row, below, { engineName = null } = {}) {
  const kind = syncKind(row, below)
  if (kind === 'none') return engineName ? `No result from ${engineName} in this scan` : 'No result in this scan'
  const added = promptsAdded(row, below)
  if (kind === 'first') {
    return below && below.visibility == null
      ? `${row.visible} of ${row.total} prompts visible; the scan before had no result`
      : `First sync: ${row.visible} of ${row.total} prompts visible from the start`
  }
  const move = kind === 'up' ? `rose ${pts(row.delta)} to ${row.visibility}%` : kind === 'down' ? `fell ${pts(-row.delta)} to ${row.visibility}%` : `held at ${row.visibility}%`
  if (added > 0) return `${added} new prompt${added === 1 ? '' : 's'} added (${below.total} → ${row.total}) and visibility ${move}`
  if (kind === 'same') return `No change since ${below ? day(below.date) : 'the sync before'}: ${row.visible} of ${row.total} prompts still visible`
  return `Visibility ${move}, with all ${row.total} prompts checked`
}

// the filter pills: how many syncs went up, went down, didn't change, and had prompts added
export function syncCounts(rows) {
  const n = { all: rows.length, up: 0, down: 0, same: 0, added: 0 }
  rows.forEach((r, i) => {
    const k = syncKind(r, rows[i + 1])
    if (k in n) n[k] += 1
    if (promptsAdded(r, rows[i + 1]) > 0) n.added += 1
  })
  return n
}
export const syncMatches = (filter, row, below) => filter === 'all' || (filter === 'added' ? promptsAdded(row, below) > 0 : syncKind(row, below) === filter)
