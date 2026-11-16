// Ported from the app (lib/history-ranges.js, 2026-11-03); the app keeps its copy in lib/, the same functions and names.
// Visibility history's range menu (data/mock.js historyRanges, src/components/dashboard/
// VisibilityHistory.jsx). Weekly: by days back from the latest sync; All time: every point. Monthly: by months.
export const WEEKLY_RANGES = [
  { id: 'last-30d', label: 'Last 30 days', days: 30 },
  { id: 'last-90d', label: 'Last 90 days', days: 90 },
  { id: 'last-180d', label: 'Last 180 days', days: 180 },
  { id: 'last-1y', label: 'Last year', days: 365 },
  { id: 'all', label: 'All time', days: null },
]
export const MONTHLY_RANGES = [
  { id: 'last-3m', label: 'Last 3 months', count: 3 },
  { id: 'last-6m', label: 'Last 6 months', count: 6 },
  { id: 'last-12m', label: 'Last 12 months', count: 12 },
  { id: 'all', label: 'All time', count: null },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY = 86400000
export const longDay = (iso) => {
  const s = String(iso || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return `${MONTHS[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}, ${s.slice(0, 4)}`
}

// The note under the chart when the brand's history is shorter than the range picked (the chart shows what there is;
// the option stays): "Since Oct 14, 2026", the first sync on record. All time always says where it starts. Nothing
// when the range is covered, or with no history at all (the empty state says that).
//   range      the option ({ id, days } weekly, { id, count } monthly; id 'all' = All time)
//   firstIso   the first sync on record (YYYY-MM-DD…), lastIso the latest; periods: how many periods there are (monthly)
export function sinceNote({ range, firstIso, lastIso, periods = 0 }) {
  const first = longDay(firstIso)
  if (!range || !first || !lastIso) return null
  if (range.id === 'all') return `Since ${first}`
  if (range.days != null) return Date.parse(String(lastIso).slice(0, 10)) - Date.parse(String(firstIso).slice(0, 10)) < range.days * DAY ? `Since ${first}` : null
  if (range.count != null) return periods < range.count ? `Since ${first}` : null
  return null
}
