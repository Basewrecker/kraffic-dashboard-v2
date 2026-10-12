import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, Check } from 'lucide-react'
import { IMPACT, PAGE_COUNT, STATUS } from '../../data/audit'

// Shared pieces of /audit: the check status icon (--negative only for Failing), the ▪▪▪ impact meter, and the page's URL state.

// 3 bars 4×12px: High = 3 in ink, Medium = 2 + 1 track, Low = 1 + 2 track. label: "High" etc. beside it (12 t3)
export function ImpactMeter({ impact, label = false }) {
  const n = IMPACT[impact].level
  const bars = (
    <span role="img" aria-label={`${IMPACT[impact].label} impact`} className="inline-flex shrink-0 items-end gap-0.5">
      {[0, 1, 2].map((i) => <span key={i} className="h-3 w-1 rounded-[1px]" style={{ background: i < n ? 'var(--ink)' : 'var(--data-track)' }} />)}
    </span>
  )
  if (!label) return bars
  return <span className="inline-flex w-[72px] shrink-0 items-center gap-2" aria-hidden={false}>{bars}<span className="text-[12px] leading-4 text-stone-500" aria-hidden>{IMPACT[impact].label}</span></span>
}

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
export function openDrawer(key, id) {
  const had = new URLSearchParams(window.location.search).has(key)
  setParams({ [key]: id }, { push: !had })
  if (!had) pushed[key] = true
}
export function closeDrawer(key) {
  if (pushed[key]) { pushed[key] = false; window.history.back() } else setParams({ [key]: null })
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
