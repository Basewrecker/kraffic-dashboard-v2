import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, MoreHorizontal } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import SiteLogo from '../../components/ui/SiteLogo'

// Shared pieces of /trends: tones, the 100% stacked bar, the 4-step progress, a row ⋯ menu and a confirm dialog.
// Graphite only. --negative marks negative tone (and errors), nothing else.
export const t2 = 'text-stone-600'
export const t3 = 'text-stone-500'
export const cardTitle = 'text-[15px] leading-5 font-semibold text-stone-900'
export const subtitleCls = `mt-0.5 text-[13px] leading-[18px] ${t2}`
export const inkBtn = 'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-ink px-4 text-small font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-60'
export const lineBtn = 'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-small font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60'
export const iconBtn = 'grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'

// sentiment + stance: label, fill, text tone
export const SENTIMENT = {
  positive: { label: 'Positive', fill: 'var(--ink)', text: t2 },
  neutral: { label: 'Neutral', fill: 'var(--data-c3)', text: t2 },
  negative: { label: 'Negative', fill: 'var(--negative)', text: 'text-negative' },
}
// stance never uses red: it's a side, not a problem
export const STANCE = {
  for: { label: 'For', fill: 'var(--ink)', text: t2 },
  neutral: { label: 'No side', fill: 'var(--data-c3)', text: t2 },
  against: { label: 'Against', fill: 'var(--data-c1)', text: t2 },
}

// 100% stacked bar: parts = [{ key, value, fill }]; zero parts are skipped, 1px gaps between the rest
export function StackBar({ parts, className = 'h-1.5 w-20', label }) {
  const total = parts.reduce((n, p) => n + p.value, 0)
  return (
    <span className={`flex shrink-0 gap-px overflow-hidden rounded-full bg-tint ${className}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {total > 0 && parts.filter((p) => p.value > 0).map((p) => <span key={p.key} className="h-full" style={{ width: `${(p.value / total) * 100}%`, background: p.fill }} />)}
    </span>
  )
}
export const sentimentParts = (s) => ['positive', 'neutral', 'negative'].map((k) => ({ key: k, value: s?.[k] ?? 0, fill: SENTIMENT[k].fill }))
export const stanceParts = (s) => ['for', 'neutral', 'against'].map((k) => ({ key: k, value: s?.[k] ?? 0, fill: STANCE[k].fill }))

export const Spinner = ({ size = 12, className = '' }) => <Loader2 size={size} className={`shrink-0 animate-spin motion-reduce:animate-none ${className}`} aria-hidden />

// Collecting sources → Reading mentions → Scoring sentiment → Done. step = index of the current step (0–3).
export const STEPS = ['Collecting sources', 'Reading mentions', 'Scoring sentiment', 'Done']
export function Progress({ step, className = '' }) {
  return (
    <ol className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] leading-[18px] ${className}`} aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < step || (i === STEPS.length - 1 && step >= STEPS.length - 1)
        const current = i === step && !done
        return (
          <li key={s} className={`flex items-center gap-1.5 ${done ? 'text-ink' : current ? 'font-medium text-stone-900' : t3}`} aria-current={current ? 'step' : undefined}>
            {done ? <Check size={14} className="text-ink" aria-hidden /> : current ? <Spinner size={14} /> : <span className="h-3.5 w-3.5 rounded-full border border-[var(--color-line-strong)]" aria-hidden />}
            {s}
          </li>
        )
      })}
    </ol>
  )
}

// ⋯ menu on a row or card: items [{ label, onClick, danger? }]. Esc / outside click close; ↑/↓ move.
export function RowMenu({ label = 'More actions', items, className = '' }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const btn = useRef(null)
  const menu = useRef(null)
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector('[role=menuitem]')?.focus()
    const out = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [open])
  const onKey = (e) => {
    const els = [...menu.current.querySelectorAll('[role=menuitem]')]
    const i = els.indexOf(document.activeElement)
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); btn.current?.focus() }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus() }
    else if (e.key === 'Tab') setOpen(false)
  }
  return (
    <div ref={wrap} className={`relative ${className}`} onKeyDown={open ? onKey : undefined} onClick={(e) => e.stopPropagation()}>
      <button ref={btn} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="grid h-8 w-8 place-items-center rounded-md text-stone-500 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
        <MoreHorizontal size={16} aria-hidden />
      </button>
      {open && (
        <div ref={menu} role="menu" aria-label={label} className="absolute right-0 top-full z-30 mt-1 w-44 rounded-lg border border-line bg-raised p-1 shadow-md">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" onClick={() => { setOpen(false); it.onClick() }}
              className={`flex h-8 w-full items-center rounded-md px-2 text-left text-[13px] leading-[18px] outline-none hover:bg-tint focus-visible:bg-tint ${it.danger ? 'text-negative' : 'text-stone-900'}`}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// confirm dialog: { title, body, confirmLabel, onConfirm } or null
export function Confirm({ ask, onClose }) {
  return (
    <Modal open={Boolean(ask)} onClose={onClose} title={ask?.title ?? ''} subtitle={ask?.body}
      footer={(
        <div className="flex w-full justify-end gap-2">
          <button type="button" onClick={onClose} className={lineBtn}>Cancel</button>
          <button type="button" onClick={() => { ask.onConfirm(); onClose() }}
            className="inline-flex h-9 items-center rounded-lg bg-negative px-3.5 text-small font-medium text-on-ink outline-none transition-opacity duration-150 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">
            {ask?.confirmLabel ?? 'Delete'}
          </button>
        </div>
      )}>
      <span />
    </Modal>
  )
}

// "6 days ago" relative to the mock's today
export function ago(iso, now) {
  const d = Math.round((new Date(now) - new Date(iso)) / 86400000)
  if (d <= 0) {
    const h = Math.round((new Date(now) - new Date(iso)) / 3600000)
    return h <= 0 ? 'Just now' : `${h} ${h === 1 ? 'hour' : 'hours'} ago`
  }
  if (d < 30) return `${d} ${d === 1 ? 'day' : 'days'} ago`
  const m = Math.round(d / 30)
  return `${m} ${m === 1 ? 'month' : 'months'} ago`
}
export const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
export const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
export const pct = (n, of) => (of ? Math.round((n * 100) / of) : 0)

// BrandLogo for /trends: the shared SiteLogo with no border, ring or outline
export const Logo = ({ className = '', ...p }) => <SiteLogo {...p} className={`${className} !border-0`} />
