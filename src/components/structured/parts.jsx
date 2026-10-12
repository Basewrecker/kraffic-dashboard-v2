import { CheckCircle2, CircleDashed, XCircle } from 'lucide-react'
import { STATUS } from '../../data/structuredData'

// Status icon: Valid = ink check, Invalid = --negative (the page's only red), Missing = dashed circle t3
const ICONS = {
  valid: [CheckCircle2, 'text-ink'],
  invalid: [XCircle, 'text-negative'],
  missing: [CircleDashed, 'text-stone-500'],
}
export function StatusIcon({ status, size = 16 }) {
  const [Icon, cls] = ICONS[status]
  return <Icon size={size} className={`shrink-0 ${cls}`} aria-hidden />
}
export function StatusLabel({ status }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] leading-[18px] text-stone-600">
      <StatusIcon status={status} size={14} />{STATUS[status]}
    </span>
  )
}

const pages = (n) => `${n} ${n === 1 ? 'page' : 'pages'}`
// "Missing on 8 pages" / "Invalid on 2 pages" / "On all 20 pages"
export function pagesLine(s) {
  if (s.status === 'invalid') return `Invalid on ${pages(s.invalid.length)}`
  if (s.status === 'missing') return `Missing on ${pages(s.missing.length)}`
  return s.found.length === 1 ? 'On 1 page' : `On all ${pages(s.found.length)}`
}
