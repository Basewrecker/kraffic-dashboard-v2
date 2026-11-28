// Billing's money and date formats (the brief, section 3). One place, so every screen and dialog says them the same way.
// Amounts are whole US dollars or dollars and cents; dates are ISO days ('2026-12-27').
// "Today" in the mock is fixed (TODAY), so the sample states read the same every day.
export const TODAY = '2026-11-27'
const day = (iso) => new Date(`${iso.slice(0, 10)}T12:00:00Z`)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// "$3,500", "$49.50": dollar sign, thousands comma, no cents when whole, two decimals otherwise. A missing value: "—"
export function money(n) {
  if (n == null || Number.isNaN(n)) return '—'
  const whole = Math.round(n * 100) % 100 === 0
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`
}
// "Dec 27"; the year only when it is not this year: "Jan 10, 2027". A missing value: "—"
export function shortDate(iso, today = TODAY) {
  if (!iso) return '—'
  const d = day(iso)
  const base = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
  return d.getUTCFullYear() === day(today).getUTCFullYear() ? base : `${base}, ${d.getUTCFullYear()}`
}
// the full date for the dark tip: "Sunday, December 27, 2026"
export function fullDate(iso) {
  if (!iso) return ''
  const d = day(iso)
  return `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()]}, ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}
export const monthName = (iso) => MONTHS_LONG[day(iso).getUTCMonth()]
// an invoice's period: two short dates with an en dash, "Nov 27 – Dec 27"
export const period = (from, to, today = TODAY) => `${shortDate(from, today)} – ${shortDate(to, today)}`
// add whole months / days to an ISO day
export function addMonths(iso, n) { const d = day(iso); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10) }
export function addDays(iso, n) { const d = day(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
// whole days from today to a date, never negative
export const daysUntil = (iso, today = TODAY) => Math.max(0, Math.round((day(iso) - day(today)) / 86400000))
// the past-due day count, as [bold, rest] or with the bold word inside: "11 days left to pay", "1 day left to pay",
// and on the last day "Pay today to keep your plan"
export function daysLeftParts(n) {
  if (n <= 0) return { before: 'Pay ', bold: 'today', after: ' to keep your plan' }
  return { before: '', bold: String(n), after: n === 1 ? ' day left to pay' : ' days left to pay' }
}
// "Visa ending 4242" as [regular, bold]
export const cardParts = (card) => (card ? { before: `${card.brand} ending `, bold: card.last4 } : null)
