// app (owner, 2026-11-14): Missed opportunities' custom date range. The app had no date-range calendar (Site Kit's
// "Custom" uses two plain date inputs), so this is a small one in the app's style, no new dependency.
// Anchored under the date dropdown: "From" / "To" fields (typed dates accepted), two months side by side; click a start
// then an end, the days between are highlighted; a small dot under a day that has a found page; future days disabled.
// Apply / Clear at the bottom; Esc or a click outside closes without applying. Keyboard: arrows move between days
// (±1 day, ±1 week), Enter picks; Tab reaches the fields and the buttons. Fades and scales in (mock.src.css
// .k-pop-in; reduced motion: a fade).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const iso = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
const fromIso = (s) => new Date(`${s}T12:00:00Z`)
const addDays = (s, n) => { const d = fromIso(s); d.setUTCDate(d.getUTCDate() + n); return iso(d) }
export const fmtRangeDay = (s, year = true) => fromIso(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' })
// "Sep 2 – Nov 2, 2026" (both years when they differ)
export const fmtRange = (a, b) => (a.slice(0, 4) === b.slice(0, 4) ? `${fmtRangeDay(a, false)} – ${fmtRangeDay(b)}` : `${fmtRangeDay(a)} – ${fmtRangeDay(b)}`)
// a typed date: "2026-09-02", "Sep 2, 2026", "9/2/2026" → ISO day, else null
function parseTyped(text) {
  const t = String(text || '').trim()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : iso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12)))
}
const monthStart = (s) => `${s.slice(0, 7)}-01`
const addMonths = (first, n) => { const d = fromIso(first); d.setUTCMonth(d.getUTCMonth() + n, 1); return iso(d) }
const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export default function MissedRangePicker({ start = null, end = null, marks = new Set(), today, onApply, onClose }) {
  const [a, setA] = useState(start)
  const [b, setB] = useState(end)
  const [hover, setHover] = useState(null)
  const [left, setLeft] = useState(() => addMonths(monthStart(end || today), -1))
  const [focus, setFocus] = useState(end || start || today)
  const [fromText, setFromText] = useState(start ? fmtRangeDay(start) : '')
  const [toText, setToText] = useState(end ? fmtRangeDay(end) : '')
  const box = useRef(null)
  const grid = useRef(null)
  // Esc / a click outside: close without applying
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) onClose() }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onDown, true)
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('pointerdown', onDown, true) }
  }, [onClose])
  useEffect(() => { setFromText(a ? fmtRangeDay(a) : '') }, [a])
  useEffect(() => { setToText(b ? fmtRangeDay(b) : '') }, [b])
  const pick = (day) => {
    if (day > today) return
    if (!a || b) { setA(day); setB(null) } else if (day < a) { setA(day) } else { setB(day) }
    setFocus(day)
  }
  // keyboard focus follows the roving day; the shown months follow it
  const moveFocus = (day) => {
    if (day > today) day = today
    setFocus(day)
    const m = monthStart(day)
    if (m < left) setLeft(m)
    else if (m > addMonths(left, 1)) setLeft(addMonths(m, -1))
  }
  useLayoutEffect(() => { if (grid.current?.contains(document.activeElement)) grid.current.querySelector(`[data-day="${focus}"]`)?.focus() }, [focus, left])
  const onGridKey = (e) => {
    if (!e.target.matches?.('[data-day]')) return
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
    if (step) { e.preventDefault(); moveFocus(addDays(focus, step)) }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(focus) }
  }
  const other = b || hover
  const lo = a && other ? (a <= other ? a : other) : a
  const hi = a && other ? (a <= other ? other : a) : a
  const commitTyped = (which, text) => {
    const d = parseTyped(text)
    if (!d || d > today) { if (which === 'from') setFromText(a ? fmtRangeDay(a) : ''); else setToText(b ? fmtRangeDay(b) : ''); return }
    if (which === 'from') { setA(d); if (b && d > b) setB(null) } else if (!a || d >= a) setB(d)
    moveFocus(d)
  }
  const month = (first) => {
    const d0 = fromIso(first)
    const name = d0.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    const lead = (d0.getUTCDay() + 6) % 7 // Monday first
    const days = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 0)).getUTCDate()
    const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, k) => addDays(first, k))]
    return (
      <div className="w-[224px]">
        <p className="mb-2 text-center text-[13px] leading-[18px] font-semibold text-stone-900">{name}</p>
        <div className="grid grid-cols-7 text-center text-[11px] leading-4 text-stone-500" aria-hidden>{WEEK.map((w) => <span key={w} className="py-1">{w}</span>)}</div>
        <div className="grid grid-cols-7" role="grid" aria-label={name}>
          {cells.map((day, k) => {
            if (!day) return <span key={`e${k}`} />
            const future = day > today
            const edge = day === lo || day === hi
            const inRange = lo && hi && day > lo && day < hi
            return (
              <button key={day} type="button" data-day={day} disabled={future} tabIndex={day === focus ? 0 : -1}
                aria-label={`${fmtRangeDay(day)}${marks.has(day) ? ', pages found' : ''}`} aria-pressed={edge || undefined}
                onClick={() => pick(day)} onMouseEnter={() => a && !b && setHover(day)} onMouseLeave={() => setHover(null)}
                className={`relative grid h-8 place-items-center text-[13px] leading-[18px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus disabled:cursor-default disabled:text-stone-300 ${edge ? 'rounded-md bg-ink font-semibold text-on-ink' : inRange ? 'bg-tint text-stone-900' : 'rounded-md text-stone-900 enabled:hover:bg-tint'}`}>
                {Number(day.slice(8))}
                {marks.has(day) && <span aria-hidden className={`absolute bottom-[3px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${edge ? 'bg-[var(--on-ink)]' : 'bg-ink'}`} />}
              </button>
            )
          })}
        </div>
      </div>
    )
  }
  const field = 'h-9 w-full rounded-lg border border-line bg-raised px-2.5 text-small text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-400 focus-visible:ring-2 focus-visible:ring-focus'
  return (
    <div ref={box} role="dialog" aria-label="Custom date range" data-range-picker
      className="k-pop-in absolute left-0 top-full z-40 mt-1 rounded-xl border border-line bg-raised p-4 shadow-lg">
      <div className="flex gap-3">
        <label className="flex-1"><span className="mb-1 block text-[12px] leading-4 font-semibold text-stone-600">From</span>
          <input value={fromText} onChange={(e) => setFromText(e.target.value)} onBlur={(e) => commitTyped('from', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commitTyped('from', e.currentTarget.value) }} placeholder="Start date" className={field} /></label>
        <label className="flex-1"><span className="mb-1 block text-[12px] leading-4 font-semibold text-stone-600">To</span>
          <input value={toText} onChange={(e) => setToText(e.target.value)} onBlur={(e) => commitTyped('to', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commitTyped('to', e.currentTarget.value) }} placeholder="End date" className={field} /></label>
      </div>
      <div className="relative mt-4" ref={grid} onKeyDown={onGridKey}>
        <button type="button" aria-label="Previous month" onClick={() => setLeft(addMonths(left, -1))} className="absolute left-0 top-0 grid h-6 w-6 place-items-center rounded-md text-stone-600 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><ChevronLeft size={14} aria-hidden /></button>
        <button type="button" aria-label="Next month" disabled={addMonths(left, 1) >= monthStart(today)} onClick={() => setLeft(addMonths(left, 1))} className="absolute right-0 top-0 grid h-6 w-6 place-items-center rounded-md text-stone-600 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:text-stone-300"><ChevronRight size={14} aria-hidden /></button>
        <div className="flex gap-6">{month(left)}{month(addMonths(left, 1))}</div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-6 border-t border-line pt-3">
        <span className="flex items-center gap-1.5 text-[12px] leading-4 text-stone-600"><span aria-hidden className="h-1 w-1 rounded-full bg-ink" />Pages found that day</span>
        <span className="flex items-center gap-2">
          <button type="button" onClick={() => { setA(null); setB(null); setHover(null) }} className="inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium text-stone-600 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Clear</button>
          <button type="button" disabled={Boolean(a) !== Boolean(b)} onClick={() => onApply(a && b ? { from: a, to: b } : null)}
            className="inline-flex h-8 items-center rounded-lg bg-ink px-3 text-[13px] font-semibold text-on-ink outline-none hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:bg-[var(--color-line-strong)] disabled:text-stone-600">Apply</button>
        </span>
      </div>
    </div>
  )
}
