import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useMenuMotion } from '../../hooks/useMenuMotion'
import { triggerClass } from '../ui/MenuSelect'
import { AGAINST_OPTIONS, PERIOD_OPTIONS, comparedRange, fmtDate, rangeOf, validCustom } from '../../lib/trendsCompare'

// The comparison picker (as the app's CompareMenu, #216; Trends now, Benchmark next): one menu with two choices.
//   Period        Last 7 days / 28 days / 3 months / 6 months / 12 months, or a custom range (two dates)
//   Compare with  Off, the previous period, or the same dates a year earlier (each shows the dates it means)
// The trigger is the header dropdown's ("Compare  Off ▾"). Picking a period keeps the menu open (the comparison is
// usually next); picking a comparison closes it. ↑/↓ move, Esc closes only the menu, click-outside closes.
//   value: { period, against, from, to } (lib/trendsCompare.js DEFAULT_COMPARE) · today: 'YYYY-MM-DD'
export default function CompareMenu({ value, onChange, today, align = 'right', triggerClassName, className = '' }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const trigger = useRef(null)
  const panel = useRef(null)
  const m = useMenuMotion(open, { align })
  // the custom dates being typed: applied once both are valid
  const [draft, setDraft] = useState({ from: value.from ?? '', to: value.to ?? '' })
  const custom = value.period === 'custom'
  const draftOk = validCustom(draft, today)

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => (panel.current?.querySelector('[aria-checked=true]') ?? panel.current)?.focus())
    const out = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [open])

  const onKey = (e) => {
    const els = [...(panel.current?.querySelectorAll('[role=menuitemradio]') ?? [])]
    const i = els.indexOf(document.activeElement)
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); trigger.current?.focus() }
    else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.tagName !== 'INPUT') { e.preventDefault(); els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus() }
  }
  const setDate = (key, v) => {
    const next = { ...draft, [key]: v }
    setDraft(next)
    if (validCustom(next, today)) onChange({ ...value, period: 'custom', ...next })
  }
  const pickAgainst = (id) => { onChange({ ...value, against: id }); setOpen(false); trigger.current?.focus() }
  const current = AGAINST_OPTIONS.find((o) => o.id === value.against) ?? AGAINST_OPTIONS[0]
  const span = (r) => `${fmtDate(r.from, true)} – ${fmtDate(r.to, true)}`
  const item = 'flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] leading-[18px] text-stone-900 outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint'
  const heading = 'px-2 pb-1 pt-1.5 text-[11px] leading-4 font-medium text-stone-500'
  const dateInput = 'h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-[13px] leading-[18px] text-stone-900 tabular-nums outline-none focus:border-[var(--color-line-strong)] focus-visible:ring-2 focus-visible:ring-focus'
  const tick = (on) => (on ? <Check size={14} className="shrink-0 text-ink" aria-hidden /> : <span className="w-3.5 shrink-0" aria-hidden />)

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Compare: ${current.label}`}
        onClick={() => setOpen((o) => !o)} onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true) } }}
        className={triggerClassName ?? triggerClass('sm')}>
        <span className="font-normal text-stone-500">Compare</span>
        <span className="-ml-0.5 min-w-0 truncate font-medium text-stone-900">{current.label}</span>
        <ChevronDown size={14} className="shrink-0 text-ink-3" />
      </button>
      {m.mounted && (
        <div ref={panel} role="menu" aria-label="Compare" tabIndex={-1} onKeyDown={onKey} {...m.props} style={m.style}
          className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full z-30 mt-1 w-72 rounded-lg border border-line bg-raised p-1 shadow-md outline-none max-lg:left-0 max-lg:right-0 max-lg:w-auto`}>
          <div role="group" aria-label="Period">
            <div className={heading}>Period</div>
            {PERIOD_OPTIONS.map((p) => (
              <button key={p.id} type="button" role="menuitemradio" aria-checked={value.period === p.id} onClick={() => onChange({ ...value, period: p.id })} className={item}>
                {tick(value.period === p.id)}
                <span className={value.period === p.id ? 'font-medium' : ''}>{p.label}</span>
              </button>
            ))}
            <button type="button" role="menuitemradio" aria-checked={custom}
              onClick={() => { if (draftOk) onChange({ ...value, period: 'custom', ...draft }); else panel.current?.querySelector('input')?.focus() }} className={item}>
              {tick(custom)}
              <span className={custom ? 'font-medium' : ''}>Custom range</span>
            </button>
            {/* the two dates: the range applies as soon as both make sense */}
            <div className="flex items-center gap-2 px-2 pb-1.5 pl-[30px] pt-0.5">
              <input type="date" aria-label="From" value={draft.from} max={draft.to || today} onChange={(e) => setDate('from', e.target.value)} className={dateInput} />
              <span aria-hidden className="text-stone-500">–</span>
              <input type="date" aria-label="To" value={draft.to} min={draft.from || undefined} max={today} onChange={(e) => setDate('to', e.target.value)} className={dateInput} />
            </div>
            {draft.from && draft.to && !draftOk && <p className="px-2 pb-1.5 pl-[30px] text-[12px] leading-4 text-negative">Pick a start date before the end date, up to today.</p>}
          </div>
          <div aria-hidden className="mx-1 my-1 h-px bg-line" />
          <div role="group" aria-label="Compare with">
            <div className={heading}>Compare with</div>
            {AGAINST_OPTIONS.map((o) => (
              <button key={o.id} type="button" role="menuitemradio" aria-checked={value.against === o.id} onClick={() => pickAgainst(o.id)} className={item}>
                {tick(value.against === o.id)}
                <span className="min-w-0 flex-1">
                  <span className={`block ${value.against === o.id ? 'font-medium' : ''}`}>{o.label}</span>
                  {o.id !== 'off' && <span className="block text-[12px] leading-4 text-stone-500 tabular-nums">{span(comparedRange({ ...value, against: o.id }, today))}</span>}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-1 border-t border-line px-2 py-2 text-[12px] leading-4 text-stone-500 tabular-nums">Showing {span(rangeOf(value, today))}</div>
        </div>
      )}
    </div>
  )
}
