import { useId, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { NO_SCORE, noResultLine, noResultText } from '../../utils/score'

// The ⓘ beside a "—" score: "No result from Gemini in the latest scan" on hover or focus (KpiCard's hint, the same
// button and tooltip). align 'right' opens the tooltip leftwards, for a "—" near a card's right edge.
// inButton: inside a row that is itself a button (Sync history), the ⓘ is a labelled image with the hover tooltip
// (a button can't hold a button); the row's name carries the text.
// The tooltip is fixed to the viewport under the ⓘ, so a card or a collapsing strip with overflow hidden never cuts it.
// text: another explanation in the same ⓘ (the AI Mode split's "Scoring updated")
export function NoResultHint({ engine, date = null, align = 'left', inButton = false, text: override = null }) {
  const [tip, setTip] = useState(null) // { x, y } while shown
  const ref = useRef(null)
  const id = useId()
  const text = override ?? noResultText(engine, date)
  const Tag = inButton ? 'span' : 'button'
  const show = () => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setTip({ x: align === 'right' ? r.right : r.left, y: r.bottom + 4 })
  }
  const hide = () => setTip(null)
  return (
    <span className="inline-flex align-middle">
      <Tag ref={ref} {...(inButton ? { role: 'img' } : { type: 'button', 'aria-describedby': tip ? id : undefined, onFocus: show, onBlur: hide })}
        aria-label={text} onMouseEnter={show} onMouseLeave={hide}
        className="grid h-5 w-5 place-items-center rounded-full text-stone-500 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
        <Info size={14} aria-hidden />
      </Tag>
      {tip && (
        <span id={id} role="tooltip" style={{ top: tip.y, ...(align === 'right' ? { right: window.innerWidth - tip.x } : { left: tip.x }) }}
          className={`fixed z-[90] w-56 rounded-md border border-line bg-raised px-2.5 py-2 text-[12px] leading-4 font-normal tracking-normal text-stone-700 shadow-md`}>
          {text}
        </span>
      )}
    </span>
  )
}

// a score with no result: "—" in muted text, then the ⓘ. The caller's type size and weight apply to the dash.
// date: an older scan's day (Sync history's rows); none = the latest scan
export default function NoResult({ engine, date, align, inButton, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="text-stone-500">{NO_SCORE}</span>
      <NoResultHint engine={engine} date={date} align={align} inButton={inButton} />
    </span>
  )
}

// a list on an engine with no result (the prompt tables): one muted line and the ⓘ
export function NoResultLine({ engine }) {
  return (
    <span className="inline-flex items-center gap-1 text-small text-stone-500" data-no-result>
      {noResultLine(engine)}
      <NoResultHint engine={engine} />
    </span>
  )
}
