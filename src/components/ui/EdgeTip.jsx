// One tooltip for the Content pages (owner, 2026-11-05, as the app's components/mock-overview/content-tip.jsx: the Best
// page one was cut off by the table, which hides what overflows it). It's drawn in <body> as a `fixed` box, so no
// container can clip it, under the trigger, then kept inside the viewport: shifted left/right to fit with 8px to spare,
// and flipped above when there's no room below. Max 260px wide (or `width`), the text wraps. Hover or keyboard focus
// shows it; scrolling hides it.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export const NO_SC_TIP = 'To match, connect your Google Search Console'
export const NO_MATCH_TIP = 'No matching page in Search Console yet'
const EDGE = 8
export function placeTip(at, w, h, vw, vh, gap = 6) {
  const left = Math.min(Math.max(EDGE, at.left + at.width / 2 - w / 2), Math.max(EDGE, vw - EDGE - w))
  const below = at.bottom + gap
  const top = below + h > vh - EDGE && at.top - gap - h >= EDGE ? at.top - gap - h : below
  return { left, top }
}

export default function EdgeTip({ tip, children, label, className = '', width = 260 }) {
  const ref = useRef(null)
  const box = useRef(null)
  const id = useId()
  const [at, setAt] = useState(null)
  const [pos, setPos] = useState(null)
  const show = () => setAt(ref.current?.getBoundingClientRect() ?? null)
  const hide = () => { setAt(null); setPos(null) }
  useLayoutEffect(() => {
    if (!at || !box.current) return
    const r = box.current.getBoundingClientRect()
    setPos(placeTip(at, r.width, r.height, window.innerWidth, window.innerHeight))
  }, [at, tip])
  useEffect(() => {
    if (!at) return undefined
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [at])
  return (
    <>
      <span ref={ref} tabIndex={0} aria-label={label} aria-describedby={at ? id : undefined} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
        className={`rounded outline-none focus-visible:ring-2 focus-visible:ring-focus ${className}`}>{children}</span>
      {at && typeof document !== 'undefined' && createPortal(
        <span ref={box} id={id} role="tooltip" style={{ ...(pos ?? { left: -9999, top: 0 }), maxWidth: width }}
          className="pointer-events-none fixed z-[70] w-max max-w-[260px] rounded-md border border-line bg-raised px-3 py-2 text-left text-[12px] leading-4 font-normal text-stone-700 shadow-md [overflow-wrap:anywhere]">
          {tip}
        </span>,
        document.body,
      )}
    </>
  )
}
