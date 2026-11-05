// Opportunities → Content workspace: focus mode ("centre stage") for steps 3–5. The page behind stays where it is but
// blurs (8px) and dims (.co-veil: --page at 55% light / 65% dark) and goes inert; the step moves into a centred panel
// above it: min(880px, viewport − 48px) wide for Your data and Publish, min(1200px, viewport − 48px) for the Draft, the
// viewport's height less 48px, centred both ways by layout (a fixed grid, 24px in from every edge), 16px radius, the card surface, a 1px line and a soft 2-layer shadow. The
// panel scrolls on its own; the page behind doesn't move.
// Motion: entering, the panel travels from the step band's place on the page to the centre (FLIP on transform, 450ms,
// a spring with under 1% overshoot) while the veil fades in (300ms); its content fades in 100ms after it lands. A step
// change resizes it smoothly (width, 300ms). Exiting runs it back into the band, then the veil fades out. Reduced
// motion: no travel; the panel and the veil crossfade in 150ms.
// A dialog: role="dialog", aria-modal, labelled by the prompt; focus moves in and is trapped, Esc exits and focus goes
// back to the step band (hooks/useOverlay.js useDialogFocus, shared with ui/Modal).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDialogFocus } from '../../../hooks/useOverlay'
import { spring } from '../../../utils/spring'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const TRAVEL = spring({ stiffness: 300, damping: 30 }) // under 1% overshoot (the owner allows 2%)
const MS = 450

// active: focus mode is on · width: 880 | 1200 · fromRef: the step band on the page (where it travels from and back to)
// scrollerRef: the panel's scrolling body (the dock's IntersectionObserver root) · onExit: ✕, Esc
// entrance: 'travel' (FLIP from the band) or 'fade' (opened as the page loads, e.g. arriving from the list on step 4)
// style: the workspace's palette (--co-a): the panel is portalled out of the workspace's root, so it carries its own
export default function FocusPanel({ active, width, fromRef, labelledBy, onExit, scrollerRef, onLanded = () => {}, entrance = 'travel', style, children }) {
  const [mounted, setMounted] = useState(active)
  const panel = useRef(null)
  const content = useRef(null)
  const veil = useRef(null)
  const exit = useRef(onExit)
  exit.current = onExit
  useEffect(() => { if (active) setMounted(true) }, [active])

  // the page behind: inert (not clickable, not focusable) while focus mode is on; lifted as the exit starts (before focus
  // goes back to the step band; this effect's cleanup runs before useDialogFocus's)
  const on = active && mounted
  useEffect(() => {
    if (!on) return undefined
    const root = document.getElementById('root')
    if (root) root.inert = true
    return () => { if (root) root.inert = false }
  }, [on])
  useDialogFocus(panel, on, exit, { returnTo: fromRef })

  // the transform that puts the panel where the band is (its top-left corner and size)
  const fromBand = () => {
    const el = panel.current
    const band = fromRef.current
    if (!el || !band) return null
    const a = band.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    if (!b.width || !b.height) return null
    return `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${Math.min(a.height, window.innerHeight) / b.height})`
  }

  // entering
  useLayoutEffect(() => {
    if (!active || !mounted) return
    const el = panel.current
    if (reduced() || entrance === 'fade') {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduced() ? 150 : 220, easing: 'ease-out' })
      veil.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' })
      onLanded()
      return
    }
    const from = fromBand()
    if (from) {
      // fill 'backwards' only: once it ends nothing stays on the transform (the final place comes from layout)
      const a = el.animate([{ transform: from, borderRadius: '8px' }, { transform: 'none', borderRadius: '16px' }], { duration: MS, easing: TRAVEL.easing, fill: 'backwards' })
      a.onfinish = () => { el.style.transform = '' }
    }
    veil.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out', fill: 'backwards' })
    content.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: MS + 100, easing: 'ease-out', fill: 'backwards' })
    const t = setTimeout(onLanded, MS + 100)
    return () => clearTimeout(t)
  }, [active, mounted]) // eslint-disable-line react-hooks/exhaustive-deps

  // exiting: back into the band, then the veil fades; then gone
  useEffect(() => {
    if (active || !mounted) return undefined
    const el = panel.current
    let cancelled = false
    const done = () => { if (!cancelled) setMounted(false) }
    if (!el || reduced()) {
      el?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'ease-out', fill: 'forwards' })
      veil.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'ease-out', fill: 'forwards' })
      const t = setTimeout(done, 160)
      return () => { cancelled = true; clearTimeout(t) }
    }
    content.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out', fill: 'forwards' })
    const to = fromBand()
    const a = to ? el.animate([{ transform: 'none', borderRadius: '16px' }, { transform: to, borderRadius: '8px', offset: 0.85, opacity: 1 }, { transform: to, borderRadius: '8px', opacity: 0 }], { duration: MS, delay: 80, easing: TRAVEL.easing, fill: 'forwards' }) : null
    veil.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: to ? MS - 40 : 0, easing: 'ease-out', fill: 'forwards' })
    const t = setTimeout(done, (to ? MS + 80 : 0) + 300)
    return () => { cancelled = true; clearTimeout(t); a?.cancel() }
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null
  return createPortal(
    // centred by layout only: a fixed full-viewport grid with 24px padding; the panel is min(width, 100%) wide and as
    // tall as its content up to viewport − 48px (then it scrolls inside). No translate: nothing stays on its transform.
    <div className="co-ws fixed inset-0 z-50 grid place-items-center p-6 print:hidden" style={style}>
      {/* the veil: blurs and dims the page; not clickable */}
      <div ref={veil} aria-hidden className="co-veil absolute inset-0" />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}
        className="co-panel relative flex max-h-full flex-col overflow-hidden rounded-[16px] border border-line bg-surface outline-none"
        style={{ width: `min(${width}px, 100%)`, transformOrigin: '0 0', transition: reduced() ? 'none' : 'width 300ms cubic-bezier(.2,.8,.2,1)' }}>
        <div ref={(el) => { content.current = el; if (scrollerRef) scrollerRef.current = el }} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
