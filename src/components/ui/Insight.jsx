import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ArrowRight, Info, Lightbulb, X } from 'lucide-react'

// Lightbulb footer with an in-card "explain mode". Default: the insight sentence + "Why?".
// Explain mode: the same line says in plain English what we counted (+ a quiet "(Oct 5 update)"), and the card highlights the data it came from
// (elements tagged with hl(explain, key)) while everything else tagged in the card dims to 0.35.
//
//   const explain = useExplain(selectionKey)            // exits when the card's selection changes
//   <Card ref={explain.cardRef}> … <li {...hl(explain, 'row:Target', { row: true })}> … </Card>
//   <Insight explain={explain} text="…" evidence={{ keys: ['row:Target'], calc, source, action: { label, onClick } }} />
//
// Exit: X, Esc, clicking the line again, clicking outside the card, or a selection change.
// Only one card explains at a time.
const OPEN_EVENT = 'insight:explain'

export function useExplain(resetKey) {
  const id = useId()
  const cardRef = useRef(null)
  const [on, setOn] = useState(false)
  const [keys, setKeys] = useState([])
  const off = useCallback(() => setOn(false), [])

  useEffect(() => {
    const other = (e) => { if (e.detail !== id) setOn(false) }
    window.addEventListener(OPEN_EVENT, other)
    return () => window.removeEventListener(OPEN_EVENT, other)
  }, [id])
  useEffect(() => {
    if (!on) return
    const out = (e) => { if (!cardRef.current?.contains(e.target)) setOn(false) }
    const esc = (e) => { if (e.key === 'Escape') setOn(false) }
    document.addEventListener('mousedown', out)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc) }
  }, [on])
  useEffect(() => setOn(false), [resetKey])

  const start = useCallback((k) => {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }))
    setKeys(k)
    setOn(true)
  }, [id])
  return { on, keys, start, off, cardRef, lineId: `${id}-evidence` }
}

// Props for a piece of card data: tags it, and in explain mode highlights or dims it.
// row: matching rows also get a tint background (see [data-hl-row] in index.css).
// flush: the element already bleeds into the padding itself, so no extra inset.
export function hl(explain, key, { row = false, flush = false } = {}) {
  const props = { 'data-insight-key': key }
  if (row) props['data-hl-row'] = flush ? 'flush' : ''
  if (explain?.on) {
    const match = explain.keys.includes(key)
    props['data-hl'] = match ? 'on' : 'off'
    if (match) props['aria-describedby'] = explain.lineId
  }
  return props
}
// fill/stroke opacity for chart marks (pie slices, columns) in explain mode; null = not explaining
export const hlOpacity = (explain, key) => (explain?.on ? (explain.keys.includes(key) ? 1 : 0.35) : null)

// wrap: the line wraps instead of truncating (the week-by-week drawer)
export default function Insight({ explain, text, evidence, wrap = false }) {
  const on = explain.on
  const full = [evidence.calc, evidence.source].filter(Boolean).join(' ')
  const fade = 'transition-opacity duration-150 ease-out motion-reduce:transition-none'

  return (
    <div className="mt-auto flex h-[31px] items-end">
      <div className="grid w-full border-t border-[var(--color-line)] pt-3 text-[13px] leading-[18px]">
        {/* default: the sentence; the whole line opens explain mode */}
        <button
          type="button"
          aria-expanded={on}
          aria-controls={explain.lineId}
          aria-label={`${text} Why?`}
          tabIndex={on ? -1 : 0}
          onClick={() => explain.start(evidence.keys ?? [])}
          className={`group/ins [grid-area:1/1] -mx-1 flex min-w-0 cursor-pointer items-center gap-2 rounded px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus ${fade} ${on ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        >
          <Lightbulb size={16} className="shrink-0 text-stone-500" aria-hidden />
          <span key={text} className={`min-w-0 flex-1 ${wrap ? '[text-wrap:pretty]' : 'truncate'} text-stone-900 motion-safe:animate-[fade-in_200ms_ease-out]`} title={text}>{text}</span>
          <span className="shrink-0 font-medium text-stone-600 transition-colors duration-150 group-hover/ins:text-ink">Why?</span>
        </button>

        {/* explain mode: what we counted, in plain English; clicking the line (not its buttons) exits */}
        <div
          aria-hidden={!on}
          inert={on ? undefined : ''}
          onClick={(e) => { if (e.target === e.currentTarget || e.target.dataset.exit != null) explain.off() }}
          className={`[grid-area:1/1] flex min-w-0 cursor-pointer items-center gap-2 ${fade} ${on ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          <Info size={16} className="shrink-0 text-stone-500" aria-hidden />
          {/* one line, never wraps: if the date suffix doesn't fit it drops to a hidden second line (it's in the title) */}
          <span id={explain.lineId} data-exit="" role="status" title={full} className="flex h-[18px] min-w-0 flex-1 flex-wrap overflow-hidden text-stone-600 tabular-nums">
            <span data-exit="" className="min-w-0 max-w-full truncate">{evidence.calc}</span>
            {evidence.source && <span data-exit="" className="whitespace-nowrap pl-1 text-stone-500">{evidence.source}</span>}
          </span>
          {evidence.action && (
            <button
              type="button"
              onClick={() => { explain.off(); evidence.action.onClick() }}
              className="inline-flex shrink-0 items-center gap-1 rounded font-medium text-ink outline-none hover:opacity-75 focus-visible:ring-2 focus-visible:ring-focus"
            >
              {evidence.action.label} <ArrowRight size={14} aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={explain.off}
            aria-label="Close explanation"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-stone-500 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
