import { useSyncExternalStore } from 'react'
import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from 'lucide-react'
import { STATUS } from './analyze'

// Status icon: Valid = ink check, Invalid = --negative (the page's only red), Missing = dashed circle t3,
// Warning (a Fix item that isn't an error) = ink triangle
const ICONS = {
  valid: [CheckCircle2, 'text-ink'],
  invalid: [XCircle, 'text-negative'],
  missing: [CircleDashed, 'text-stone-500'],
  warning: [AlertTriangle, 'text-ink'],
}
const LABELS = { ...STATUS, warning: 'Warning' }
export function StatusIcon({ status, size = 16 }) {
  const [Icon, cls] = ICONS[status]
  return <Icon size={size} className={`shrink-0 ${cls}`} aria-hidden />
}
export function StatusLabel({ status }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] leading-[18px] text-stone-600">
      <StatusIcon status={status} size={14} />{LABELS[status]}
    </span>
  )
}

const pages = (n) => `${n} ${n === 1 ? 'page' : 'pages'}`
// "Missing on 8 pages" / "Invalid on 2 pages" / "On all 20 pages" / a Fix item: "Affects 4 pages"
export function pagesLine(s) {
  if (s.kind === 'fix') return `Affects ${pages(s.affected.length)}`
  if (s.status === 'invalid') return `Invalid on ${pages(s.invalid.length)}`
  if (s.status === 'missing') return `Missing on ${pages(s.missing.length)}`
  return s.found.length === 1 ? 'On 1 page' : `On all ${pages(s.found.length)}`
}

// impact as plain text (What to do next): High = 500 ink, Medium = t2, Low = t3
const IMPACT_TEXT = { high: 'font-medium text-ink', medium: 'text-stone-600', low: 'text-stone-500' }
export const ImpactText = ({ impact, className = '' }) => (
  <span className={`shrink-0 whitespace-nowrap text-[13px] leading-[18px] ${IMPACT_TEXT[impact]} ${className}`}>{impact[0].toUpperCase() + impact.slice(1)} impact</span>
)

// "Mark as added": ids waiting for the next run to confirm them (this browser only)
const KEY = 'kraffic:structured-data:pending'
let pending = (() => { try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]')) } catch { return new Set() } })()
const subs = new Set()
export function markPending(id) {
  pending = new Set(pending).add(id)
  try { localStorage.setItem(KEY, JSON.stringify([...pending])) } catch { /* private mode: keep it for this visit */ }
  subs.forEach((f) => f())
}
export const usePending = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => pending)
// shown on a row once it's been marked as added
export const PendingCheck = () => <span className="shrink-0 text-[13px] leading-[18px] text-stone-500">Pending check</span>
