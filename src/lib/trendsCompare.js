// The comparison picker's periods and dates (as the app's lib/trends-compare.js, #216): last 7 days / 28 days /
// 3 months / 6 months / 12 months, or a custom range; against the previous period or the same dates a year earlier.
// Pure functions, shared by Trends (components/dashboard/CompareMenu.jsx) and, later, Benchmark.
export const DAY = 86400000
export const PERIOD_OPTIONS = [
  { id: '7d', label: 'Last 7 days', past: 'Past 7 days', short: 'past 7 days', days: 7 },
  { id: '28d', label: 'Last 28 days', past: 'Past 28 days', short: 'past 28 days', days: 28 },
  { id: '3m', label: 'Last 3 months', past: 'Past 3 months', short: 'past 3 months', days: 91 },
  { id: '6m', label: 'Last 6 months', past: 'Past 6 months', short: 'past 6 months', days: 182 },
  { id: '12m', label: 'Last 12 months', past: 'Past 12 months', short: 'past 12 months', days: 364 },
]
export const AGAINST_OPTIONS = [
  { id: 'off', label: 'Off' },
  { id: 'previous', label: 'Previous period' },
  { id: 'year', label: 'Year over year' },
]
export const DEFAULT_COMPARE = { period: '12m', against: 'off', from: null, to: null }

const iso = (t) => new Date(t).toISOString().slice(0, 10)
const at = (d) => Date.parse(`${d}T12:00:00Z`)
export const fmtDate = (d, year = false) => new Date(at(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' })

// a custom range is usable when both ends are set, in order, and not after today
export const validCustom = ({ from, to }, today) => Boolean(from && to && from <= to && to <= today)

// { from, to, days } of the picked period, ending today (a custom range keeps its own ends)
export function rangeOf(value, today) {
  if (value.period === 'custom' && validCustom(value, today)) {
    return { from: value.from, to: value.to, days: Math.round((at(value.to) - at(value.from)) / DAY) + 1 }
  }
  const p = PERIOD_OPTIONS.find((o) => o.id === value.period) ?? PERIOD_OPTIONS.at(-1)
  return { from: iso(at(today) - (p.days - 1) * DAY), to: today, days: p.days }
}

// the range the period is compared with: the same number of days just before it, or the same dates a year earlier
// (364 days, so weekdays line up). 'off' still returns the preceding period: the page's change line uses it.
export function comparedRange(value, today) {
  const r = rangeOf(value, today)
  const back = value.against === 'year' ? 364 : r.days
  return { from: iso(at(r.from) - back * DAY), to: iso(at(r.to) - back * DAY), days: r.days }
}

// words for the page: "past 12 months" / "Nov 3 – Nov 23"; "vs preceding period" / "vs a year earlier"
export function periodWords(value, today) {
  if (value.period === 'custom' && validCustom(value, today)) return `${fmtDate(value.from)} – ${fmtDate(value.to)}`
  return (PERIOD_OPTIONS.find((o) => o.id === value.period) ?? PERIOD_OPTIONS.at(-1)).short
}
export const againstWords = (value) => (value.against === 'year' ? 'vs a year earlier' : 'vs preceding period')
