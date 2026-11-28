// Prompt Hub's filter maths and the Added column's words (as the app, #223 / #224). Pure: no React, no data imports.
//
// A row is { prompt, category, status, addedAt?, addedVia? }. The filters are
//   { category: 'all' | name, query: string, also?: (row) => boolean }
// where `also` is whatever else narrows the list (a brand, a sync, a Setup topic). The engine filter changes each
// row's status before it gets here, so the counts follow it too.

export const HUB_STATUSES = ['all', 'visible', 'missed', 'lost', 'pending']

// the table's search: any of the keys contains the text; a missing value never matches
export function matchesSearch(row, query, keys = ['prompt']) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return true
  return keys.some((k) => String(row[k] ?? '').toLowerCase().includes(q))
}

// every filter except the status tab: what the status tabs count
export function withoutStatus(rows, { category = 'all', query = '', also = null } = {}, keys = ['prompt']) {
  return rows.filter((r) => (category === 'all' || r.category === category) && matchesSearch(r, query, keys) && (!also || also(r)))
}

// All / Visible / Missed / Lost / Pending: how many prompts the other filters leave in each
export function statusCounts(rows, filters = {}, keys = ['prompt']) {
  const left = withoutStatus(rows, filters, keys)
  const n = Object.fromEntries(HUB_STATUSES.map((s) => [s, 0]))
  n.all = left.length
  left.forEach((r) => { if (r.status in n && r.status !== 'all') n[r.status] += 1 })
  return n
}

// the chips on the "Showing 13 of 114 prompts" line: one per filter that is on, in the filter row's order
// (search, topic, engine). engineLabel: the picked engine's name, or null for all engines.
export function activeFilters({ category = 'all', engineLabel = null, query = '' } = {}) {
  const q = String(query ?? '').trim()
  return [
    q && { key: 'search', label: `“${q}”`, clear: 'Clear search' },
    category !== 'all' && category && { key: 'topic', label: category, clear: `Clear topic ${category}` },
    engineLabel && { key: 'engine', label: engineLabel, clear: `Clear engine ${engineLabel}` },
  ].filter(Boolean)
}

// "Showing 13 of 114 prompts"
export const showingLine = (shown, total) => `Showing ${shown} of ${total} prompt${total === 1 ? '' : 's'}`

// ---- the Added column
const DAY = 86400000
const dayOf = (iso) => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : Math.floor(t / DAY)
}
const fmt = (iso, opts) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts })

// "Today", "Yesterday", else "Nov 18" (with the year when it isn't this year's); a missing date is a dash
export function addedLabel(iso, todayIso) {
  const d = dayOf(iso)
  if (d == null) return '—'
  const t = dayOf(todayIso)
  if (t != null && d === t) return 'Today'
  if (t != null && d === t - 1) return 'Yesterday'
  const sameYear = t == null || String(iso).slice(0, 4) === String(todayIso).slice(0, 4)
  return fmt(iso, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
}
// "Nov 18, 2026"
export const addedDate = (iso) => (dayOf(iso) == null ? '—' : fmt(iso, { month: 'short', day: 'numeric', year: 'numeric' }))

// how a prompt got here (the API's addedVia)
export const ADDED_VIA = { manual: 'Added by hand', csv: 'Imported from a file', research: 'From Research' }
// the hover tip: "Added Nov 18, 2026 · Imported from a file"; nothing when there is no date
export function addedTip(iso, via) {
  if (dayOf(iso) == null) return null
  return [`Added ${addedDate(iso)}`, ADDED_VIA[via]].filter(Boolean).join(' · ')
}
// the CSV cell: the full date and how
export function addedCsv(iso, via) {
  if (dayOf(iso) == null) return '—'
  return [addedDate(iso), ADDED_VIA[via]].filter(Boolean).join(' · ')
}
// newest first on a "desc" sort; a prompt with no date sorts as the oldest
export const addedSortValue = (iso) => { const t = Date.parse(iso); return Number.isNaN(t) ? 0 : t }

// The Topic column is as wide as its longest topic needs, between a floor (the header) and a cap; a longer topic
// is cut with "…". textWidths: each topic's drawn width in px; chrome: the pill's and the cell's padding.
export function topicColumnWidth(textWidths, { chrome = 40, min = 88, max = 220 } = {}) {
  const longest = Math.max(0, ...textWidths.filter((w) => Number.isFinite(w)))
  return Math.min(max, Math.max(min, Math.ceil(longest + chrome)))
}
