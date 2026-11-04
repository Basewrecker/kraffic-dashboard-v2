// Step 5 (Publish and track): pure helpers, no React. Tested in model.test.js.
import { ENGINES, ENGINE_NAME } from '../../../data/contentOpportunities.js'

// short engine names for sentences ("now named on Google and ChatGPT")
export const shortEngine = (e) => (e === 'google' ? 'Google' : ENGINE_NAME[e] ?? e)

// ['google', 'chatgpt', 'gemini'] → "Google, ChatGPT and Gemini"
export function listNames(engines) {
  const names = engines.filter((e) => ENGINES.includes(e)).map(shortEngine)
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// ISO or "Oct 12, 2026" → Date (UTC midnight for day strings, so the day never shifts with the time zone)
export function toDate(v) {
  if (v instanceof Date) return v
  const m = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(v ?? '')
  if (m) return new Date(Date.UTC(+m[3], MONTHS.indexOf(m[1]), +m[2]))
  return new Date(v)
}
// "Nov 5, 2026"; short: "Nov 5"
export function fmtDay(v, { short = false } = {}) {
  const d = toDate(v)
  if (Number.isNaN(d.getTime())) return '—'
  const s = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
  return short ? s : `${s}, ${d.getUTCFullYear()}`
}

// 0.92 → 92 (whole percent, clamped)
export const matchPct = (m) => (m == null || Number.isNaN(m) ? null : Math.max(0, Math.min(100, Math.round(m * 100))))

// the four weekly syncs after a page goes live: the next Mondays (syncs run on Mondays), all pending
export function syncsAfter(publishedAt, count = 4) {
  const d = toDate(publishedAt)
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const toMonday = ((8 - day.getUTCDay()) % 7) || 7
  return Array.from({ length: count }, (_, i) => ({ date: fmtDay(new Date(day.getTime() + (toMonday + 7 * i) * 864e5)), pending: true }))
}

// one engine in one sync: 'named' · 'missed' · 'gap' (the sync failed) · 'pending' (not run yet)
export function cellState(sync, engine) {
  if (sync.pending) return 'pending'
  if (sync.engines == null) return 'gap'
  return sync.engines[engine] ? 'named' : 'missed'
}
// 'done' · 'gap' · 'next' (the first pending sync) · 'later'
export function columnKinds(syncs) {
  const firstPending = syncs.findIndex((s) => s.pending)
  return syncs.map((s, i) => (s.pending ? (i === firstPending ? 'next' : 'later') : s.engines == null ? 'gap' : 'done'))
}
// syncs that ran (a failed sync still used up its week)
export const weeksDone = (syncs) => syncs.filter((s) => !s.pending).length

// the end of the four weeks: running (with the date of the last sync) · improved (engines gained) · nochange
export function resultOf(syncs, gained = []) {
  if (syncs.some((s) => s.pending)) return { kind: 'running', date: syncs[syncs.length - 1]?.date ?? null }
  const names = gained.filter((e) => ENGINES.includes(e))
  return names.length ? { kind: 'improved', engines: names, label: listNames(names) } : { kind: 'nochange' }
}

// which card the step opens on: waiting · notfound (the preview state, page not found after 14 days) · tracking
export function initialPhase(draft, check) {
  if (!draft || draft.stage === 'draft' || draft.stage === 'waiting') return check?.status === 'not_found' ? 'notfound' : 'waiting'
  return 'tracking'
}
