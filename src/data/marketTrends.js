// Trends: sample Google Trends market data for the mock brand (skincare), in the shape the app's adapter returns
// (as the app, #203: lib/google-trends-view.js). Everything is generated from the term's text and the date, so the
// same controls always give the same numbers and nothing is random between renders.
//   interestOverTime({ terms, range, compared, country, region, type })  → the chart's points
//   relatedQueries(term, { … })                                          → { top, rising } (25 each)
// Interest is Google's 0–100 scale: the highest point of the shown terms in the shown range is 100.
import { DAY } from '../lib/trendsCompare.js'

// Google refreshes weekly data on Mondays; the mock's "today"
export const marketToday = '2026-11-23'
export const marketUpdatedAt = '2026-11-23'
export const marketNextUpdate = '2026-11-30'
export const marketStaleSince = '2026-11-16' // ?state=stale: the last refresh that worked
export const marketStaleReason = 'Google Trends didn’t answer in time. We’ll try again on Monday.'

export const MAX_TERMS = 5
// the brand's terms (from its topics; the user can remove these and add their own, up to MAX_TERMS)
export const marketTerms = ['ceramide moisturizer', 'niacinamide serum', 'mineral sunscreen', 'barrier repair cream']

export const marketCountries = [
  { id: 'US', label: 'United States' },
  { id: 'GB', label: 'United Kingdom' },
  { id: 'CA', label: 'Canada' },
  { id: 'AU', label: 'Australia' },
  { id: 'IN', label: 'India' },
  { id: 'WW', label: 'Worldwide' },
]
export const marketRegions = {
  US: ['California', 'Texas', 'Florida', 'New York', 'Illinois', 'Pennsylvania', 'Ohio', 'Georgia', 'North Carolina', 'Michigan', 'Washington', 'Arizona'],
  GB: ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  CA: ['Ontario', 'Quebec', 'British Columbia', 'Alberta'],
  AU: ['New South Wales', 'Victoria', 'Queensland', 'Western Australia'],
  IN: ['Maharashtra', 'Karnataka', 'Delhi', 'Tamil Nadu'],
  WW: [],
}
export const marketSearchTypes = [
  { id: 'web', label: 'Web search' },
  { id: 'youtube', label: 'YouTube search' },
  { id: 'news', label: 'News search' },
  { id: 'shopping', label: 'Shopping search' },
]

// ---- deterministic numbers from text
// (FNV-1a, then a final mix so texts that differ only at the end still land far apart)
const hash = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
const at = (d) => Date.parse(`${d}T12:00:00Z`)
const isoOf = (t) => new Date(t).toISOString().slice(0, 10)
const TAU = Math.PI * 2

// a term's raw search volume on a day: a level that drifts, a yearly season, two slower waves and a little day-to-day noise
function rawAt(term, t, scope) {
  const k = `${term}|${scope}`
  const d = t / DAY
  // interest drifts a little year to year (up for most terms), so a period differs from the one before it
  const drift = 1 + ((d - at(marketToday) / DAY) / 365) * (hash(`${term}|drift`) - 0.3) * 0.22
  const level = (52 + hash(`${k}|level`) * 26) * drift
  const season = Math.sin((d / 365) * TAU + hash(`${term}|season`) * TAU) * (5 + hash(`${k}|sa`) * 9)
  const wave = Math.sin((d / 67) * TAU + hash(`${k}|w1`) * TAU) * (5 + hash(`${k}|wa`) * 6)
  const ripple = Math.sin((d / 29) * TAU + hash(`${k}|w2`) * TAU) * (3 + hash(`${k}|ra`) * 5)
  const noise = (hash(`${k}|${Math.round(d)}`) - 0.5) * 9
  return Math.max(4, level + season + wave + ripple + noise)
}

// daily points up to about 3 months, weekly beyond (as Google Trends does)
export const stepOf = (days) => (days <= 92 ? 1 : 7)

// Small regions don't have enough searches for every term: Google returns nothing for it (a gap, never 0)
const noData = (term, region) => region !== 'all' && hash(`${term}|${region}|gap`) < 0.08

// range / compared: { from, to, days } (lib/trendsCompare.js). previews: [{ query, term, share }] related searches
// drawn on the chart (their volume is a share of their term's).
// → { step, points: [{ iso, partial, values: { [term]: n | null }, before: { [term]: n | null } }], change: { [term]: % | null } }
//   before: the same point of the compared range; partial: Google marks the newest point as incomplete
export function interestOverTime({ terms, range, compared, country = 'US', region = 'all', type = 'web', previews = [] }) {
  const scope = `${country}|${region}|${type}`
  const step = stepOf(range.days)
  const n = Math.max(2, Math.ceil(range.days / step))
  const end = at(range.to)
  const shift = compared ? at(range.from) - at(compared.from) : 0
  const stamps = Array.from({ length: n }, (_, i) => end - (n - 1 - i) * step * DAY)
  const series = [
    ...terms.map((term) => ({ id: term, of: term, share: 1 })),
    ...previews.map((p) => ({ id: p.query, of: p.term, share: 0.55 + 0.4 * p.share, wobble: p.query })),
  ]
  const raw = (s, t) => (noData(s.of, region) ? null : rawAt(s.of, t, scope) * s.share * (s.wobble ? 0.9 + 0.2 * Math.sin((t / DAY / 41) * TAU + hash(s.wobble) * TAU) : 1))
  // 100 = the highest point of the brand's terms in this range (previews and the compared range use the same scale)
  const top = Math.max(1, ...stamps.flatMap((t) => terms.map((term) => raw({ of: term, share: 1 }, t) ?? 0)))
  const scale = (v) => (v == null ? null : Math.max(1, Math.round((v * 100) / top)))
  const points = stamps.map((t, i) => ({
    iso: isoOf(t),
    partial: i === n - 1 && range.to === marketToday,
    values: Object.fromEntries(series.map((s) => [s.id, scale(raw(s, t))])),
    before: compared ? Object.fromEntries(series.map((s) => [s.id, scale(raw(s, t - shift))])) : null,
  }))
  const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null)
  const change = Object.fromEntries(terms.map((term) => {
    const now = avg(points.map((p) => p.values[term]).filter((v) => v != null))
    const then = compared ? avg(points.map((p) => p.before[term]).filter((v) => v != null)) : null
    return [term, now == null || !then ? null : Math.round(((now - then) / then) * 1000) / 10]
  }))
  return { step, points, change }
}

// ---- related searches (Google's "related queries": Top is scored against the most-searched one = 100; Rising is the
// growth over the period, or "Breakout" when it grew by more than 5,000%)
const TOP = ['{t} for sensitive skin', 'best {t}', '{t} for oily skin', '{t} benefits', '{t} near me', '{t} for dry skin', 'best drugstore {t}', 'how to use {t}', 'what does {t} do', '{t} reviews',
  '{t} for acne', '{t} for face', 'fragrance free {t}', '{t} with spf', '{t} before and after', '{t} side effects', 'korean {t}', '{t} for men', '{t} for rosacea', 'affordable {t}',
  '{t} ingredients', 'is {t} safe in pregnancy', '{t} for eczema', '{t} for mature skin', 'dermatologist recommended {t}']
const TOP_SCORES = [100, 87, 75, 73, 58, 50, 48, 44, 35, 34, 31, 29, 27, 24, 22, 21, 19, 17, 15, 14, 12, 11, 9, 8, 6]
const RISING = ['{t} 2026', '{t} stick', '{t} for teens', '{t} dupes', 'tinted {t}', '{t} refill', '{t} for perimenopause', 'vegan {t}', '{t} for melasma', '{t} routine order',
  '{t} mist', '{t} for dark spots', 'best {t} 2026', '{t} travel size', '{t} for kids', '{t} gel', '{t} over makeup', 'clean {t}', '{t} for hands', '{t} for scalp',
  '{t} patches', '{t} sample size', '{t} for neck', '{t} for runners', '{t} subscription']
const RISING_GROWTH = [null, null, null, null, 3830, 2880, 2600, 2190, 1440, 1180, 950, 820, 640, 510, 430, 350, 290, 240, 190, 160, 130, 110, 90, 70, 50] // null: Breakout

// Is the search already a tracked prompt, and did the AI answers name the brand for it?
//   'named' | 'missed' | null (not tracked)
export const promptStatus = (query) => { const h = hash(`${query}|status`); return h < 0.2 ? 'named' : h < 0.36 ? 'missed' : null }

export function relatedQueries(term, { country = 'US', region = 'all', type = 'web', period = '12m' } = {}) {
  if (noData(term, region)) return { top: [], rising: [] }
  const scope = `${term}|${country}|${region}|${type}|${period}`
  // the same searches in every scope, in an order and with scores that depend on it
  const order = (list) => list.map((q, i) => ({ q, k: i + (hash(`${scope}|${q}`) - 0.5) * 3 })).sort((a, b) => a.k - b.k).map((x) => x.q)
  const row = (text) => { const query = text.replace('{t}', term); return { query, term, status: promptStatus(query) } }
  return {
    top: order(TOP).map((q, i) => ({ ...row(q), score: TOP_SCORES[i] })),
    rising: order(RISING).map((q, i) => ({ ...row(q), growth: RISING_GROWTH[i], breakout: RISING_GROWTH[i] == null, score: TOP_SCORES[Math.min(24, i + 2)] })),
  }
}
