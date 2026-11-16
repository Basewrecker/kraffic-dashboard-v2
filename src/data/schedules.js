// Scheduled reports: when each schedule sends next, the next 14 days as a timeline, and the small words the
// Scheduled page shows (the cadence, "in 4 days", initials). Pure functions over `schedules` (reports.js), so the
// app's adapter can feed the same shapes.
import { KINDS, TODAY, brandLabel, parseDay, seriesRuns } from './reports.js'

const DAY = 864e5
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayOnly = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays = (d, n) => { const x = dayOnly(d); x.setDate(x.getDate() + n); return x }
export const daysBetween = (a, b) => Math.round((dayOnly(b) - dayOnly(a)) / DAY)

// "Mondays 9am" → { every: 'week', weekday: 1, time: '9am' } · "Every other Friday 10am" → every: '2weeks' ·
// "1st of the month 8am" → { every: 'month', monthDay: 1, time: '8am' }. null when it can't be read.
export function parseCadence(cadence) {
  const s = String(cadence ?? '').trim()
  if (/after each sync/i.test(s)) return { every: 'week', weekday: 1, time: null, sync: true } // syncs run on Mondays
  const time = s.match(/(\d{1,2}(?::\d{2})?\s?[ap]m)$/i)?.[1]?.replace(/\s/g, '').toLowerCase() ?? null
  const m = s.match(/^(\d{1,2})(?:st|nd|rd|th) of (?:the|each) month/i)
  if (m) return { every: 'month', monthDay: Number(m[1]), time }
  const wd = WEEKDAYS.findIndex((w) => new RegExp(`\\b${w}s?\\b`, 'i').test(s))
  if (wd < 0) return null
  return { every: /every other|fortnight|2 weeks/i.test(s) ? '2weeks' : 'week', weekday: wd, time }
}

// how a row says it: "Every Monday · 9am", "Every other Friday · 10am", "1st of each month · 8am"
export function cadenceLabel(cadence) {
  const c = parseCadence(cadence)
  if (!c) return cadence
  if (c.sync) return 'After each sync'
  const when = c.every === 'month' ? `${ordinal(c.monthDay)} of each month` : `${c.every === '2weeks' ? 'Every other' : 'Every'} ${WEEKDAYS[c.weekday]}`
  return c.time ? `${when} · ${c.time}` : when
}
// how an email says it: "every Monday at 9am", "on the 1st of each month at 8am"
export function cadenceSentence(cadence) {
  const c = parseCadence(cadence)
  if (!c) return cadence
  if (c.sync) return 'after each sync'
  const when = c.every === 'month' ? `on the ${ordinal(c.monthDay)} of each month` : `${c.every === '2weeks' ? 'every other' : 'every'} ${WEEKDAYS[c.weekday]}`
  return c.time ? `${when} at ${c.time}` : when
}
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`

// the sends of one schedule from `from` (that day included) for `days` days, oldest first. A fortnightly schedule
// keeps its rhythm from the schedule's own next send (`next`, from the data)
export function sendsBetween(s, from = TODAY, days = 14) {
  const c = parseCadence(s.cadence)
  if (!c) return []
  const start = dayOnly(from)
  const end = addDays(start, days)
  const out = []
  if (c.every === 'month') {
    for (let y = start.getFullYear(), mo = start.getMonth(); ; mo++) {
      const d = new Date(y, mo, c.monthDay)
      if (d > end) break
      if (d >= start) out.push(d)
    }
    return out
  }
  let d
  if (c.every === '2weeks' && s.next) {
    d = parseDay(s.next)
    while (d > start) d = addDays(d, -14)
    while (d < start) d = addDays(d, 14)
  } else d = addDays(start, (c.weekday - start.getDay() + 7) % 7)
  for (; d <= end; d = addDays(d, c.every === '2weeks' ? 14 : 7)) out.push(d)
  return out
}
// the next send on or after `from` (looks up to a year ahead), or null
export function nextSend(s, from = TODAY) {
  return sendsBetween(s, from, 366)[0] ?? null
}

// "Mon, Nov 2" · "Mon 9am" · "today" / "tomorrow" / "in 4 days"
export const fmtDay = (d) => `${WEEKDAYS[d.getDay()].slice(0, 3)}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
export const shortDay = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}`
export const sendWhen = (d, cadence) => { const t = parseCadence(cadence)?.time; return `${WEEKDAYS[d.getDay()].slice(0, 3)}${t ? ` ${t}` : ''}` }
export function relDays(n) {
  if (n <= 0) return 'today'
  if (n === 1) return 'tomorrow'
  return `in ${n} days`
}
export const peopleLabel = (n) => `${n} ${n === 1 ? 'person' : 'people'}`

// "Dana Wells" → "DW" · "mia@brand.com" → "M" · "Cher" → "C"
export function initials(name) {
  const s = String(name ?? '').trim()
  if (!s) return '?'
  const words = (s.includes('@') ? s.split('@')[0].split(/[._-]+/) : s.split(/\s+/)).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words.at(-1)[0] : words[0][0]).toUpperCase()
}

// the 14-day timeline: one entry per day from today (day 0) to 14 days out, and every send on it from the
// schedules that aren't paused. Items on the same day keep the list's order.
export function timeline(list, from = TODAY, days = 14) {
  const start = dayOnly(from)
  const ticks = Array.from({ length: days + 1 }, (_, i) => {
    const d = addDays(start, i)
    return { i, date: d, day: d.getDate(), month: MONTHS[d.getMonth()], weekend: d.getDay() === 0 || d.getDay() === 6, today: i === 0, monthStart: i === 0 || d.getDate() === 1 }
  })
  const items = list.filter((s) => !s.paused).flatMap((s) => sendsBetween(s, start, days).map((d) => ({
    id: `${s.id}@${d.getMonth() + 1}-${d.getDate()}`, scheduleId: s.id, brand: s.brand, date: d, day: daysBetween(start, d),
    label: [s.title, brandLabel(s.brand), sendWhen(d, s.cadence), peopleLabel(s.recipients.length)].join(' · '),
  }))).sort((a, b) => a.day - b.day)
  return { ticks, items }
}

// the first send coming up across the schedules that aren't paused: { s, date, inDays } or null
export function nextUp(list, from = TODAY) {
  let best = null
  for (const s of list) {
    if (s.paused) continue
    const d = nextSend(s, from)
    if (d && (!best || d < best.date)) best = { s, date: d, inDays: daysBetween(from, d) }
  }
  return best
}

// a schedule's row: the last report it sent (its headline and verdict), and its last 8 verdicts, oldest → newest
export function scheduleRow(s, from = TODAY) {
  const runs = seriesRuns(s)
  const next = s.paused ? null : nextSend(s, from)
  return { last: runs[0] ?? null, past: runs.slice(1), dots: runs.slice(0, 8).reverse(), next, inDays: next ? daysBetween(from, next) : null }
}

// the empty state's three starting points: the most common scheduled reports
export function scheduleTemplates() {
  return [
    { id: 'weekly', name: KINDS.weekly.name, prompt: 'How did we do this week?', sets: { period: 'week', audience: 'team', length: 'one' } },
    { id: 'ceo', name: KINDS.ceo.name, prompt: 'CEO summary: are we winning in AI search?', sets: { period: '30d', audience: 'ceo', length: 'one' } },
    { id: 'client', name: 'Client update', prompt: 'Client update', sets: { period: '30d', audience: 'client', length: 'detailed' } },
  ]
}

// the email's key numbers, less any the hero visual already shows (a number is never said twice): every finite number
// in the visual, and the last point of each series in it
export function emailStats(stats, visual) {
  const seen = new Set()
  const walk = (v) => {
    if (typeof v === 'number' && Number.isFinite(v)) seen.add(v)
    else if (Array.isArray(v)) { if (typeof v.at(-1) === 'number') seen.add(v.at(-1)); else v.forEach(walk) }
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(visual)
  return stats.filter((s) => !seen.has(s.value))
}
