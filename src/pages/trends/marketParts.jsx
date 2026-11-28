import { useEffect, useRef, useState } from 'react'
import { Check, Info, Plus, X } from 'lucide-react'
import { fmtGrowth } from './view'

// Small pieces the Trends page, its lists and its drawer share (as the app's marketParts.jsx).

export const termColor = (i) => `var(--trend-${(i % 5) + 1})`

// ⓘ after a heading: its words in the dark tip, on hover and keyboard focus. The tip hangs from the heading's left
// edge (the wrapper is the anchor), so it stays on screen on a phone too.
export function InfoTip({ label, children }) {
  return (
    <>
      <span tabIndex={0} aria-label={label} className="peer inline-grid shrink-0 rounded-full text-stone-500 outline-none transition-colors duration-150 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
        <Info size={14} strokeWidth={1.75} aria-hidden />
      </span>
      <span role="tooltip" className="tip-dark pointer-events-none absolute left-0 top-full z-30 mt-2 w-[min(320px,calc(100vw-48px))] text-left font-normal opacity-0 transition-opacity duration-150 peer-hover:opacity-100 peer-focus-visible:opacity-100">{children}</span>
    </>
  )
}

// The term chips under the header: up to `max` terms, one "Add term" input, and the "4 of 5" count.
// A chip picks its term (the lists below follow it); the selected one is ink-filled with a ring; × removes it (the
// last term can't be removed). Hovering a chip brings its line forward on the chart. A term Google has no data for in
// this region is muted and says so.
export function TermChips({ terms, selected, max, empty = [], onSelect, onRemove, onAdd, onFocus }) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const input = useRef(null)
  useEffect(() => { if (adding) input.current?.focus() }, [adding])
  const submit = () => { const t = text.trim().toLowerCase(); if (t) onAdd(t); setText(''); setAdding(false) }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {terms.map((t, i) => {
        const on = t === selected
        const none = empty.includes(t)
        return (
          <span key={t} onPointerEnter={() => onFocus?.(t)} onPointerLeave={() => onFocus?.(null)}
            className={`inline-flex h-8 max-w-full items-center rounded-full text-[13px] leading-[18px] transition-colors duration-150 ${on ? 'bg-ink font-semibold text-on-ink' : 'bg-tint font-medium text-stone-700 hover:text-stone-900'}`}>
            <button type="button" aria-pressed={on} onClick={() => onSelect(t)} onFocus={() => onFocus?.(t)} onBlur={() => onFocus?.(null)}
              className={`inline-flex h-8 min-w-0 items-center gap-2 rounded-full pl-3 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 ${terms.length > 1 ? 'pr-1.5' : 'pr-3'}`}>
              {on
                ? <span aria-hidden className="size-2.5 shrink-0 rounded-full border-[1.5px] border-on-ink" />
                : <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: termColor(i) }} />}
              <span className="truncate">{t}</span>
              {none && <span className={`font-normal ${on ? 'opacity-70' : 'text-stone-500'}`}>· no data</span>}
            </button>
            {terms.length > 1 && (
              <button type="button" aria-label={`Remove ${t}`} onClick={() => onRemove(t)}
                className={`mr-1.5 grid size-5 shrink-0 place-items-center rounded-full outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'text-on-ink opacity-70 hover:opacity-100' : 'text-stone-500 hover:text-stone-900'}`}>
                <X size={12} aria-hidden />
              </button>
            )}
          </span>
        )
      })}
      {terms.length < max && (adding ? (
        <form onSubmit={(e) => { e.preventDefault(); submit() }} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-line-strong)] bg-raised pl-3 pr-1">
          <input ref={input} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => { if (!text.trim()) setAdding(false) }}
            onKeyDown={(e) => { if (e.key === 'Escape') { setText(''); setAdding(false) } }} maxLength={60} aria-label="Add a term" placeholder="A topic people search for"
            className="w-48 bg-transparent text-[13px] leading-[18px] text-stone-900 outline-none placeholder:text-stone-500" />
          <button type="submit" disabled={!text.trim()} className="h-6 rounded-full bg-ink px-2.5 text-[12px] leading-4 font-semibold text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40">Add</button>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-[var(--dashed-border)] px-3 text-[13px] leading-[18px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:border-[var(--color-line-strong)] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
          <Plus size={14} aria-hidden />Add term
        </button>
      ))}
      <span className="ml-1 text-[13px] leading-[18px] text-stone-500 tabular-nums">{terms.length} of {max}</span>
    </div>
  )
}

// the drawer's term chips: pick a term, nothing else
export function TermPills({ terms, selected, onSelect }) {
  return (
    <div role="radiogroup" aria-label="Term" className="flex flex-wrap gap-2">
      {terms.map((t, i) => {
        const on = t === selected
        return (
          <button key={t} type="button" role="radio" aria-checked={on} onClick={() => onSelect(t)}
            className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-[13px] leading-[18px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 ${on ? 'bg-ink font-semibold text-on-ink' : 'bg-tint font-medium text-stone-700 hover:text-stone-900'}`}>
            {on ? <span aria-hidden className="size-2.5 rounded-full border-[1.5px] border-on-ink" /> : <span aria-hidden className="size-2 rounded-full" style={{ background: termColor(i) }} />}
            {t}
          </button>
        )
      })}
    </div>
  )
}

// A row's number. Top: an interest bar and the score out of 100. Rising: the growth with an arrow, or the outlined
// "Breakout" pill (Google's word for growth over 5,000%).
export function Metric({ row, rising }) {
  if (!rising) {
    return (
      <span className="flex shrink-0 items-center gap-3.5">
        <span aria-hidden className="hidden h-1 w-24 overflow-hidden rounded-full bg-[var(--data-track)] sm:block"><span className="block h-full rounded-full bg-ink" style={{ width: `${row.score}%` }} /></span>
        <span className="w-8 text-[14px] leading-5 font-semibold text-stone-900 tabular-nums">{row.score ?? '—'}</span>
      </span>
    )
  }
  return (
    <span className="w-[80px] shrink-0 sm:w-[88px]">
      {row.breakout
        ? <span className="inline-flex h-5 items-center rounded-full border-[1.5px] border-stone-900 px-2 text-[12px] leading-4 font-semibold text-stone-900">Breakout</span>
        : row.growth == null
          ? <span className="text-[14px] text-stone-500">—</span>
          : <span className="text-[14px] leading-5 font-medium text-[var(--rep-up-fg)] tabular-nums"><span aria-hidden>↑ </span><span className="sr-only">up </span>{fmtGrowth(row)}</span>}
    </span>
  )
}

// A row's last column: is the search a tracked prompt, and did AI name the brand for it? Named / Missed; not tracked:
// a grey "Track" that becomes "+ Track" when the row is hovered (the row is `group/row`); just tracked: "Tracking".
export function StatusCell({ status, query, onTrack }) {
  const box = 'flex w-[68px] shrink-0 justify-end text-[13px] leading-[18px] sm:w-[92px]'
  if (status === 'named') return <span className={`${box} items-center gap-1 font-medium text-stone-900`}><Check size={13} aria-hidden />Named</span>
  if (status === 'missed') return <span className={`${box} text-stone-500`}>Missed</span>
  if (status === 'tracking') return <span className={`${box} text-stone-500`}>Tracking</span>
  return (
    <span className={box}>
      <button type="button" aria-label={`Track ${query}`} onClick={(e) => { e.stopPropagation(); onTrack(query) }} onKeyDown={(e) => e.stopPropagation()}
        className="-mr-2 inline-flex h-7 items-center rounded-md px-2 font-medium text-stone-500 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus group-hover/row:text-stone-900">
        <span aria-hidden className="hidden group-hover/row:inline">+&nbsp;</span>Track
      </button>
    </span>
  )
}
