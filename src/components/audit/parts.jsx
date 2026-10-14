import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, Check, ChevronRight } from 'lucide-react'
import { IMPACT, STATUS } from '../../data/audit'

// Shared pieces of /audit (status icon, impact text, bars, URL state). ImpactMeter / RowIcon / ViewFix are /structured-data's.

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

// The status system, used everywhere on /audit and nothing else:
//   Failing    → AlertCircle, --negative
//   Needs work → AlertTriangle, t3
//   Passing    → Check, ink
const CHECK_ICONS = { fail: [AlertCircle, 'text-negative'], warn: [AlertTriangle, 'text-stone-500'], pass: [Check, 'text-ink'] }
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
// Impact: plain words in t2 ("High" / "Medium" / "Low"), no glyph
export const Impact = ({ impact }) => <span title={IMPACT_HINT} className="text-[13px] leading-[18px] text-stone-600">{IMPACT[impact].label}</span>

// Horizontal bar, the only bar shape on /audit: h-1.5, rounded, track tint, ink fill. Fixed width per column (className).
// color: only where the bar itself shows a status (e.g. --negative for an error count)
export function HBar({ value, max, className = 'w-16', color = 'var(--ink)', label }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <span className={`block h-1.5 shrink-0 overflow-hidden rounded-full bg-[var(--data-track)] ${className}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {w > 0 && <span className="block h-full rounded-full" style={{ width: `${Math.max(w, 4)}%`, background: color }} />}
    </span>
  )
}

export const pct = (n, of) => Math.round((n * 100) / of) // 23/40 → 58 (not 57: float error)
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
export function useTab(ids = ['overview', 'checks', 'pages', 'crawl']) {
  const q = useParams()
  const tab = ids.includes(q.get('tab')) ? q.get('tab') : ids[0]
  const setTab = useCallback((t, extra = {}) => setParams({ tab: t === ids[0] ? null : t, ...extra }), [ids[0]]) // eslint-disable-line react-hooks/exhaustive-deps
  return [tab, setTab, q]
}

// ---- a compact card table: single-line rows on desktop (fixed column widths), two-line rows on phones
//   columns: [{ key, label, width?, align?: 'right', cell(row), mobile?: 'primary' | 'meta' | false, mobileText?(row) }]
//   The column without a width flexes. Rows open something via onRowClick (Enter too).
export function MiniTable({ columns, rows, rowKey, onRowClick, rowLabel, mobile }) {
  const primary = columns.find((c) => c.mobile === 'primary') ?? columns[0]
  const meta = columns.filter((c) => c !== primary && c.mobile !== false && c.label)
  if (mobile) {
    return (
      <ul className="divide-y divide-[var(--div)] border-t border-[var(--div)]">
        {rows.map((r) => (
          <li key={rowKey(r)}>
            <button type="button" onClick={() => onRowClick?.(r)} aria-label={rowLabel?.(r)}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left outline-none active:bg-tint focus-visible:bg-tint">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{primary.mobileText ? primary.mobileText(r) : primary.cell(r)}</span>
                <span className="mt-0.5 flex min-w-0 items-center gap-x-1.5 overflow-hidden whitespace-nowrap text-[13px] leading-[18px] text-stone-600 tabular-nums">
                  {meta.map((c, i) => (
                    <span key={c.key} className={i === meta.length - 1 ? 'block min-w-0 truncate' : 'inline-flex shrink-0 items-center gap-1.5'}>
                      {i > 0 && <span className="text-stone-400" aria-hidden>·{i === meta.length - 1 ? ' ' : ''}</span>}
                      {c.mobileText ? c.mobileText(r) : c.cell(r)}
                    </span>
                  ))}
                </span>
              </span>
              {onRowClick && <ChevronRight size={14} className="shrink-0 text-stone-500" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
    )
  }
  const pad = (i) => (i === 0 ? 'pl-5 pr-3' : i === columns.length - 1 ? 'pl-3 pr-5' : 'px-3')
  return (
    <table className="w-full table-fixed">
      <thead>
        <tr className="h-9 border-y border-[var(--div)] bg-tint">
          {columns.map((c, i) => (
            <th key={c.key} style={{ width: c.width }} className={`${pad(i)} ${c.align === 'right' ? 'text-right' : 'text-left'} whitespace-nowrap text-[13px] leading-5 font-medium text-stone-500`}>
              {c.label || <span className="sr-only">Open</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={rowKey(r)} tabIndex={onRowClick ? 0 : undefined} aria-label={rowLabel?.(r)}
            onClick={onRowClick ? () => onRowClick(r) : undefined}
            onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(r) } : undefined}
            className={`group h-11 border-b border-[var(--div)] last:border-0 ${onRowClick ? 'cursor-pointer outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus' : ''}`}>
            {columns.map((c, i) => <td key={c.key} className={`${pad(i)} ${c.align === 'right' ? 'text-right' : ''} truncate`}>{c.cell(r)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
export const Chevron = () => <ChevronRight size={14} className="ml-auto shrink-0 text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />

// status → the pip / dot fill (Failing --negative · Needs work t3 · Passing ink)
export const STATUS_FILL = { fail: 'var(--negative)', warn: 'var(--color-stone-500)', pass: 'var(--ink)' }
export const fmtMs = (ms) => `${ms.toLocaleString('en-US')} ms`

// filter chips (same look as the topic chips on the dashboard): ink when on, tint when off
export function Chips({ label, value, onChange, options }) {
  const chip = (on) => `inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-small font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${
    on ? 'border-ink bg-ink text-on-ink' : 'border-transparent bg-tint text-stone-700 hover:text-stone-900'}`
  return (
    <div role="toolbar" aria-label={label} className="flex shrink-0 gap-1.5">
      {options.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={chip(value === v)}>{l}</button>)}
    </div>
  )
}
