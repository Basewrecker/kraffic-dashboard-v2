import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, Check, ChevronRight } from 'lucide-react'
import { IMPACT, PAGE_COUNT, STATUS } from '../../data/audit'

// Shared pieces of /audit: the check status icon (--negative only for Failing), the ▪▪▪ impact meter, and the page's URL state.

// Impact, always labelled: [▮▮▮] High impact · [▮▮▯] Medium impact · [▮▯▯] Low impact (3 bars 3×10px, ink / track).
// fixed: a set width so the labels line up down a list (off in a drawer's meta line).
export const IMPACT_HINT = 'How much fixing this helps AI read your site'
export function ImpactMeter({ impact, fixed = true }) {
  const n = IMPACT[impact].level
  return (
    <span title={IMPACT_HINT} className={`inline-flex shrink-0 items-center gap-2 text-[13px] leading-[18px] text-stone-600 ${fixed ? 'w-[118px]' : ''}`}>
      <span className="inline-flex items-end gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-[3px] rounded-[1px]" style={{ background: i < n ? 'var(--ink)' : 'var(--data-track)' }} />)}
      </span>
      {IMPACT[impact].label} impact
    </span>
  )
}

// the 32px type box at the start of an action row: 1px border, no fill (it labels the row, it isn't a button)
export const RowIcon = ({ children }) => (
  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-stone-600" aria-hidden>{children}</span>
)
// "View fix ›": the visible call to action at the end of a row whose whole surface is the button
export const ViewFix = ({ label = 'View fix' }) => (
  <span className="inline-flex shrink-0 items-center gap-0.5 text-[13px] leading-[18px] font-medium text-ink">{label}<ChevronRight size={14} aria-hidden /></span>
)
// the row-as-button look: tint on hover, ring on keyboard focus, bleeding 8px past the card padding
export const rowBtn = 'group -mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-lg px-2 text-left outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-focus'

// check status: AlertCircle --negative = failing · AlertTriangle ink = needs work · Check ink = passing
const CHECK_ICONS = { fail: [AlertCircle, 'text-negative'], warn: [AlertTriangle, 'text-ink'], pass: [Check, 'text-ink'] }
export function CheckIcon({ status, size = 16 }) {
  const [Icon, cls] = CHECK_ICONS[status]
  return <Icon size={size} className={`shrink-0 ${cls}`} aria-hidden />
}
export function StatusLabel({ status }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] leading-[18px] text-stone-600">
      <CheckIcon status={status} size={14} />{STATUS[status].label}
    </span>
  )
}

export const pct = (n, of = PAGE_COUNT) => Math.round((n * 100) / of) // 23/40 → 58 (not 57: float error)
export const plural = (n, w, ws = `${w}s`) => `${n} ${n === 1 ? w : ws}`

// ---- URL state: ?tab= / ?type= are replaced; ?issue= (the drawer) is pushed, so Back closes it
const EVENT = 'audit:url'
export function setParams(patch, { push = false } = {}) {
  const url = new URL(window.location.href)
  for (const [k, v] of Object.entries(patch)) (v == null || v === '' ? url.searchParams.delete(k) : url.searchParams.set(k, v))
  if (url.href === window.location.href) return
  window.history[push ? 'pushState' : 'replaceState'](window.history.state, '', url)
  window.dispatchEvent(new Event(EVENT))
}
export function useParams() {
  const [q, setQ] = useState(() => new URLSearchParams(window.location.search))
  useEffect(() => {
    const sync = () => setQ(new URLSearchParams(window.location.search))
    window.addEventListener('popstate', sync)
    window.addEventListener(EVENT, sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener(EVENT, sync) }
  }, [])
  return q
}

// a drawer param (?check= / ?page= / ?schema=): pushed on open; closing goes Back when we pushed it (else just drops the
// param, e.g. after a deep link). Back itself clears the flag.
const pushed = {}
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const q = new URLSearchParams(window.location.search)
    for (const k of Object.keys(pushed)) if (!q.has(k)) pushed[k] = false
  })
}
// extra: params that belong to this drawer (e.g. { schemaType: 'product' }); they go and come with it
const extras = { schema: ['schemaType'] } // known ones, so a deep link's extras clear on close too
export function openDrawer(key, id, extra = {}) {
  const had = new URLSearchParams(window.location.search).has(key)
  const clear = Object.fromEntries((extras[key] ?? []).map((k) => [k, null]))
  extras[key] = [...new Set([...(extras[key] ?? []), ...Object.keys(extra)])]
  setParams({ ...clear, ...extra, [key]: id }, { push: !had })
  if (!had) pushed[key] = true
}
export function closeDrawer(key) {
  if (pushed[key]) { pushed[key] = false; window.history.back() }
  else setParams({ [key]: null, ...Object.fromEntries((extras[key] ?? []).map((k) => [k, null])) })
}
// one drawer stands in for another (same history entry): Back / close still lands where the first one opened from
export function swapDrawer(from, to, id) {
  setParams({ [from]: null, [to]: id })
  pushed[to] = pushed[from]; pushed[from] = false
}
export const openIssue = (id) => openDrawer('check', id) // the Check drawer: ?check=<id>
export const closeIssue = () => closeDrawer('check')

// ?tab= (the first id is the default and isn't written to the URL)
export function useTab(ids = ['overview', 'issues', 'content', 'crawl']) {
  const q = useParams()
  const tab = ids.includes(q.get('tab')) ? q.get('tab') : ids[0]
  const setTab = useCallback((t, extra = {}) => setParams({ tab: t === ids[0] ? null : t, ...extra }), [ids[0]]) // eslint-disable-line react-hooks/exhaustive-deps
  return [tab, setTab, q]
}
