import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { placeTip } from '../ui/EdgeTip'

// A small ⓘ whose words open in the dark tip (hover or keyboard focus). Drawn in <body> as a fixed box and kept inside
// the window (EdgeTip's placing), so a card never cuts it. For the rest of a one-line footnote, or the notes that
// belong to a number. label: what the ⓘ is about, for screen readers. children: the tip (text or lines).
export default function InfoTip({ label, children, size = 14, className = '' }) {
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
  }, [at])
  useEffect(() => {
    if (!at) return undefined
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [at])
  return (
    <>
      <button ref={ref} type="button" aria-label={label} aria-describedby={at ? id : undefined} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
        className={`inline-grid h-5 w-5 shrink-0 place-items-center rounded-full align-middle text-stone-500 outline-none transition-colors duration-150 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus ${className}`}>
        <Info size={size} aria-hidden />
      </button>
      {at && typeof document !== 'undefined' && createPortal(
        <span ref={box} id={id} role="tooltip" style={pos ?? { left: -9999, top: 0 }}
          className="tip-dark pointer-events-none fixed z-[70] block w-max !max-w-[280px] text-left font-normal [overflow-wrap:anywhere] motion-safe:animate-[fade-in_120ms_ease-out]">
          {children}
        </span>,
        document.body,
      )}
    </>
  )
}
