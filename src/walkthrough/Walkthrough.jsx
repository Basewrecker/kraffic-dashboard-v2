// The first-time walkthrough (mock only): the Welcome card and the pointers. Words and rules: tour.js. Motion: motion.js
// (one easing; fades 200ms, moves 320ms, large moves 450ms; ?walkthrough=slow plays it all at 4x; reduced motion: fades
// only).
//
// Welcome: the page dims over 300ms; the card fades in, rises 12px and scales from 0.96; its title, text, buttons and
// note follow 50ms apart. Start: the card shrinks and fades toward the sidebar while the first lit area opens.
//
// Pointers: one dim layer over the whole window (an SVG path, the modal scrim) with a hole cut in it. The hole is the
// lit area: nothing is drawn in it, so the element shows exactly as it always looks. It is the element plus 4px, with
// 10px corners, and never touches a neighbour (tour.js fitHole). A small card sits beside it with a caret on the
// area's middle, 12px from it (tour.js placeCard). Below lg the card is a sheet at the bottom (at the top when the lit
// area is down there), with no caret.
//   opening            the hole opens outward from the middle of the first element (after Welcome the page is already
//                      dim; otherwise the dim fades in with it). A step chosen from the list: 250ms after its page
//                      has settled.
//   between pointers   the hole glides and resizes in one move; the card travels with it (a transform); its text
//                      swaps (out and up 4px, in from 4px below) and "2 of 5" rolls; on arrival one soft ring pulses
//                      once around the lit area
//   closing            the hole grows until the dim is gone (300ms), the card fades
// Keys: → ↓ Enter next · ← ↑ back · Esc closes. Tab stays inside the card. The buttons show a 2px focus ring only
// while the keyboard is being used (.wt-keys in index.css).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleHelp } from 'lucide-react'
import { account } from '../data/mock'
import { usePath } from '../router'
import { useIsCompact } from '../hooks/useMedia'
import { uiScale } from '@/lib/ui-scale'
import { TOURS, WELCOME, fill, fitHole, keyAction, placeCard, sheetSide, union } from './tour.js'
import { FADE, LARGE, MOVE, ms, reduced, tween } from './motion.js'
import Swap from './Swap'
import { endTour, onPath, skipMissing, skipWelcome, startTour, startWalkthrough, stepTour, tourClosed, useWalkthrough } from './store.js'

const names = () => ({ brand: account.name })
const ink = 'inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-ink font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover wt-btn'
const line = 'inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-line bg-surface font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 wt-btn disabled:pointer-events-none disabled:opacity-40'
const plain = 'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-stone-900 wt-btn'

// true while the keyboard is being used (a key was pressed since the last click or tap): the focus ring shows only then
function useKeys() {
  const [keys, setKeys] = useState(false)
  useEffect(() => {
    const down = () => setKeys(true), point = () => setKeys(false)
    document.addEventListener('keydown', down, true)
    document.addEventListener('pointerdown', point, true)
    return () => { document.removeEventListener('keydown', down, true); document.removeEventListener('pointerdown', point, true) }
  }, [])
  return keys
}

// keep Tab inside a box
const trapTab = (e, box) => {
  if (e.key !== 'Tab' || !box) return
  const items = [...box.querySelectorAll('button:not([disabled])')]
  if (!items.length) return
  const first = items[0], last = items.at(-1)
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

const visible = (el) => el.getClientRects().length > 0
const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height } }
// the pointer's element(s) and the hole around them, clear of whatever else is marked on the page
const holeOf = (step) => {
  const els = [...document.querySelectorAll(step.target)].filter(visible)
  const lit = step.all ? els : els.slice(0, 1)
  if (!lit.length) return null
  const near = [...document.querySelectorAll('[data-tour], [data-tour-near]')].filter((el) => visible(el) && !lit.some((l) => l === el || l.contains(el) || el.contains(l)))
  // the page is drawn at the UI scale, so a tall element's cut-off follows it
  return { el: lit[0], hole: fitHole(union(lit.map(box)), near.map(box), 4, step.maxHeight ? step.maxHeight * uiScale() : null) }
}

// 1. Welcome: centred, the page dim behind it. out: 'start' (it leaves toward the sidebar; the pointers' own dim layer
// has taken over, so this one's is gone at once) or 'skip' (a fade)
function Welcome({ out }) {
  const cardRef = useRef(null)
  const keys = useKeys()
  const [toward, setToward] = useState(null) // where the card leaves to, in px from where it is
  useEffect(() => {
    cardRef.current?.querySelector('button')?.focus()
    const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); skipWelcome() } else trapTab(e, cardRef.current) }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])
  const start = () => {
    // a third of the way toward the first group in the sidebar
    const to = [...document.querySelectorAll(TOURS.orientation.steps[0].target)].find(visible)?.getBoundingClientRect()
    const from = cardRef.current?.getBoundingClientRect()
    if (to && from) setToward({ x: ((to.left + to.width / 2) - (from.left + from.width / 2)) * 0.35, y: ((to.top + to.height / 2) - (from.top + from.height / 2)) * 0.35 })
    startWalkthrough()
  }
  const leaving = out === 'start'
    ? { opacity: 0, transform: reduced() ? undefined : `translate3d(${toward?.x ?? -120}px, ${toward?.y ?? 0}px, 0) scale(0.9)`, transition: 'opacity var(--wt-move) var(--wt-ease), transform var(--wt-move) var(--wt-ease)' }
    : out === 'skip' ? { opacity: 0, transition: 'opacity var(--wt-fade) var(--wt-ease)' } : undefined
  return createPortal(
    <div className={`fixed inset-0 z-[95] grid place-items-center p-4 ${out ? 'pointer-events-none' : ''} ${keys ? 'wt-keys' : ''}`} data-welcome={out ?? 'in'}>
      {/* the dim: in over 300ms; gone at once on Start (the pointers' layer is under this one), a fade on Skip */}
      {out !== 'start' && <div aria-hidden className="wt-scrim absolute inset-0 bg-scrim-modal" style={out === 'skip' ? { opacity: 0, transition: 'opacity var(--wt-fade) var(--wt-ease)' } : undefined} />}
      <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="wt-welcome-title" aria-describedby="wt-welcome-text" style={leaving}
        className={`relative w-full max-w-[440px] rounded-2xl border border-line bg-overlay p-6 shadow-xl ${out ? '' : 'wt-welcome'}`}>
        <div className={out ? '' : 'wt-stagger'}>
          <h2 id="wt-welcome-title" style={{ '--i': 0 }} className="text-[20px] leading-7 font-semibold tracking-[-0.01em] text-stone-900">{fill(WELCOME.title, names())}</h2>
          <p id="wt-welcome-text" style={{ '--i': 1 }} className="mt-2 text-body text-stone-600">{fill(WELCOME.text, names())}</p>
          <div style={{ '--i': 2 }} className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button type="button" onClick={start} className={`${ink} h-10 px-4 text-small`}>{WELCOME.start}</button>
            <button type="button" onClick={skipWelcome} className={`${plain} h-10 px-3 text-small`}>{WELCOME.skip}</button>
          </div>
          <p style={{ '--i': 3 }} className="mt-5 border-t border-[var(--div)] pt-4 text-[12px] leading-4 text-stone-500">{WELCOME.note}</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const same = (a, b) => a && b && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5
const RADIUS = 10
// a rounded box as a path (drawn the other way round from the window's box, so it is cut out of it)
const cut = ({ left: x, top: y, width: w, height: h }) => {
  if (w <= 0 || h <= 0) return ''
  const r = Math.min(RADIUS, w / 2, h / 2)
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
}
const middle = (h) => ({ left: h.left + h.width / 2, top: h.top + h.height / 2, width: 0, height: 0 })
// the caret: a small square turned 45°, half out of the card's edge that faces the lit area
// (-6: half the square, and the card's 1px border, which its inside is measured from)
const CARET_SIDE = { right: 'border-b border-l', left: 'border-r border-t', bottom: 'border-l border-t', top: 'border-b border-r' }
const caretAt = (side, at) => (side === 'right' ? { left: -6, top: at - 6 } : side === 'left' ? { right: -6, top: at - 6 } : side === 'bottom' ? { top: -6, left: at - 6 } : { bottom: -6, left: at - 6 })

// 2. Pointers
function Pointers({ name, step, dimmed, closing, wait }) {
  const tour = TOURS[name]
  const compact = useIsCompact()
  const keys = useKeys()
  const card = useRef(null)
  // what is on screen: the pointer shown, its hole, and whether the move to it glides. Set together, once the element
  // has been found and has stopped moving (a page that is still drawing, the menu drawer sliding in).
  const [view, setView] = useState(null)
  const [pos, setPos] = useState(null) // the card: { side, left, top, caret } beside the hole, or { sheet: 'bottom' | 'top' }
  const [drawn, setDrawn] = useState(null) // the hole as drawn this frame
  const [pulse, setPulse] = useState(null) // the arrival ring: { step, hole }
  const [win, setWin] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const shown = useRef(null)
  const drawnNow = useRef(null)
  const stopTween = useRef(() => {})
  const closingRef = useRef(false)
  closingRef.current = Boolean(closing)

  useEffect(() => {
    const s = tour.steps[step]
    let raf, last = null, still = 0, scrolled = false, settledAt = null
    const t0 = performance.now()
    const loop = () => {
      if (closingRef.current) return
      const found = holeOf(s)
      if (!found) {
        if (performance.now() - t0 > 2500) { skipMissing(); return }
        raf = requestAnimationFrame(loop); return
      }
      if (!scrolled) {
        scrolled = true
        // a group the sidebar has scrolled part of out of sight: all of it into view (nothing moves if it already is)
        if (!s.maxHeight) found.el.scrollIntoView({ block: 'nearest', behavior: 'instant' })
        const r = holeOf(s)?.hole ?? found.hole
        // under the phone top bar, or at the window's edge: to the middle (a tall element: its top)
        if (r.top < 64 || r.top + r.height > window.innerHeight - 16) found.el.scrollIntoView({ block: s.maxHeight ? 'start' : 'center', behavior: 'instant' })
        raf = requestAnimationFrame(loop); return
      }
      still = same(found.hole, last) ? still + 1 : 0
      last = found.hole
      if (still >= 2 && settledAt == null) settledAt = performance.now()
      if (still < 2) settledAt = null
      // the first pointer of a step chosen from the list waits 250ms after its page has settled
      const held = shown.current == null && wait && settledAt != null && performance.now() - settledAt < ms(250)
      if (still >= 2 && !held && !(shown.current?.step === step && same(shown.current.hole, last))) {
        const first = shown.current == null
        const moved = !first && shown.current.step !== step
        shown.current = { step, hole: last }
        setView({ step, hole: last, first, glide: moved })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [tour, step, wait])

  // the hole: it opens outward from the middle of the first element, then glides and resizes in one move from where it
  // is drawn now to each new place (a large move takes a little longer); a page that only shifted: at once
  useEffect(() => {
    if (!view || closingRef.current) return undefined
    const to = view.hole
    const put = (h) => { drawnNow.current = h; setDrawn(h) }
    stopTween.current()
    if (!view.first && !view.glide) { put(to); return undefined }
    const from = view.first ? middle(to) : drawnNow.current
    const far = from && Math.hypot(to.left - from.left, to.top - from.top) > 480
    stopTween.current = tween(from, to, ms(far ? LARGE : MOVE), put, () => { if (!view.first || true) setPulse({ step: view.step, hole: to }) })
    return () => stopTween.current()
  }, [view])

  // closing: the hole grows until the dim layer is gone (300ms), then the store finishes the rest
  useEffect(() => {
    if (!closing) return undefined
    stopTween.current()
    setPulse(null)
    const from = drawnNow.current
    const pad = Math.max(win.w, win.h)
    const done = () => tourClosed()
    if (!from || reduced()) { const t = setTimeout(done, from ? ms(FADE) : 0); return () => clearTimeout(t) }
    stopTween.current = tween(from, { left: -pad, top: -pad, width: win.w + pad * 2, height: win.h + pad * 2 }, ms(300), (h) => { drawnNow.current = h; setDrawn(h) }, done)
    return () => stopTween.current()
  }, [closing]) // eslint-disable-line react-hooks/exhaustive-deps

  // the card's place, from its own size with this pointer's words in it
  useLayoutEffect(() => {
    if (!view || !card.current) return
    const size = { width: card.current.offsetWidth, height: card.current.offsetHeight }
    setPos(compact
      ? { sheet: sheetSide(view.hole, size.height, window.innerHeight) }
      : placeCard(view.hole, size, { width: window.innerWidth, height: window.innerHeight }, tour.steps[view.step].side))
  }, [view, compact, tour, win])

  useEffect(() => {
    const key = (e) => {
      trapTab(e, card.current)
      const action = keyAction(e.key)
      if (!action) return
      // Enter on one of the card's buttons presses that button
      if (e.key === 'Enter' && card.current?.contains(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      stepTour(action)
    }
    const resize = () => setWin({ w: window.innerWidth, h: window.innerHeight })
    document.addEventListener('keydown', key, true)
    window.addEventListener('resize', resize)
    return () => { document.removeEventListener('keydown', key, true); window.removeEventListener('resize', resize) }
  }, [])
  useEffect(() => { if (pos) card.current?.querySelector('[data-next]')?.focus({ preventScroll: true }) }, [pos != null, view?.step]) // eslint-disable-line react-hooks/exhaustive-deps

  const i = view?.step ?? step
  const n = tour.steps.length
  const sheet = pos?.sheet
  const travel = 'transform var(--wt-move) var(--wt-ease), opacity var(--wt-fade) var(--wt-ease)'
  // the page is already dim after Welcome; otherwise the dim comes in with the first pointer (not before it is found)
  const up = dimmed || view != null
  return createPortal(
    <div className={`fixed inset-0 z-[90] ${keys ? 'wt-keys' : ''}`} data-walkthrough={name} data-closing={closing ? '' : undefined}
      style={{ opacity: up && !(closing && reduced()) ? 1 : 0, transition: dimmed && !closing ? 'none' : 'opacity var(--wt-fade) var(--wt-ease)' }}>
      {/* the one dim layer, with the lit area cut out of it (before the element is found: no hole yet) */}
      <svg className="absolute inset-0 h-full w-full" width={win.w} height={win.h} aria-hidden>
        <path data-dim fillRule="evenodd" fill="var(--color-scrim-modal)" d={`M0 0H${win.w}V${win.h}H0Z${drawn ? cut(drawn) : ''}`} />
      </svg>
      {/* nothing on the page can be clicked while a pointer is up, the lit element included */}
      <div className="absolute inset-0" aria-hidden data-hole={drawn ? [drawn.left, drawn.top, drawn.width, drawn.height].map((v) => Math.round(v * 10) / 10).join(' ') : undefined} />
      {/* on arrival: one soft ring, once, around the lit area */}
      {pulse && !closing && <span key={pulse.step} aria-hidden className="wt-pulse pointer-events-none absolute rounded-[12px]" style={{ left: pulse.hole.left - 2, top: pulse.hole.top - 2, width: pulse.hole.width + 4, height: pulse.hole.height + 4 }} />}
      {view && (
        <div ref={card} role="dialog" aria-modal="true" aria-label={`${tour.label}: ${i + 1} of ${n}`} data-side={sheet ? 'sheet' : pos?.side}
          style={sheet ? { opacity: closing ? 0 : 1, transition: travel }
            : { left: 0, top: 0, transform: `translate3d(${pos?.left ?? 0}px, ${pos?.top ?? 0}px, 0)`, opacity: pos && !closing ? 1 : 0, transition: pos && shown.current && view.glide ? travel : 'opacity var(--wt-fade) var(--wt-ease)' }}
          className={sheet
            ? `fixed inset-x-0 border-line bg-overlay p-4 shadow-xl ${sheet === 'top' ? 'top-0 rounded-b-2xl border-b pt-[max(16px,env(safe-area-inset-top))]' : 'bottom-0 rounded-t-2xl border-t pb-[max(16px,env(safe-area-inset-bottom))]'}`
            : 'fixed w-[300px] max-w-[calc(100vw-24px)] rounded-xl border border-line bg-overlay p-4 shadow-lg'}>
          {/* 10px whatever the UI scale: its place is worked out in px */}
          {!sheet && pos && <span aria-hidden data-caret className={`absolute rotate-45 border-line bg-overlay ${CARET_SIDE[pos.side]}`} style={{ width: 10, height: 10, ...caretAt(pos.side, pos.caret) }} />}
          <Swap k={i} block className="text-[14px] leading-5 text-stone-900"><p aria-live="polite" data-pointer-text>{fill(tour.steps[i].text, names())}</p></Swap>
          <div className={`flex items-center gap-2 ${sheet ? 'mt-4' : 'mt-3.5'}`}>
            <span className="text-[12px] leading-4 text-stone-500 tabular-nums" data-count={`${i + 1} of ${n}`}><Swap k={i} roll>{i + 1}</Swap> of {n}</span>
            <button type="button" onClick={() => endTour(false)} className={`${plain} ${sheet ? 'h-10' : 'h-8'} px-2 text-[13px]`}>Skip</button>
            <span className="ml-auto flex items-center gap-2">
              <button type="button" disabled={i === 0} onClick={() => stepTour('back')} className={`${line} ${sheet ? 'h-10 px-4' : 'h-8 px-3'} text-[13px]`}>Back</button>
              <button type="button" data-next onClick={() => stepTour('next')} className={`${ink} ${sheet ? 'h-10 px-5' : 'h-8 px-3.5'} text-[13px]`}>{i === n - 1 ? 'Done' : 'Next'}</button>
            </span>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

// mounted once (App.jsx): Welcome, the pointers, and "a page was opened" for the steps that tick themselves
export default function Walkthrough() {
  const w = useWalkthrough()
  const path = usePath()
  // only when a page is opened: closing Welcome on a page doesn't tick that page's step
  useEffect(() => { onPath(path) }, [path])
  return (
    <>
      {(w.welcome || w.welcomeOut) && <Welcome out={w.welcome ? null : w.welcomeOut} />}
      {w.tour && <Pointers key={w.tour} name={w.tour} step={w.step} dimmed={w.dimmed} closing={w.closing} wait={w.wait} />}
    </>
  )
}

// the small "?" beside a page title: replays that page's pointers (Settings → Show hints on pages)
export function TourHelp({ tour, className = '' }) {
  const w = useWalkthrough()
  if (!w.hints) return null
  return (
    <button type="button" onClick={() => startTour(tour)} aria-label={`Show me around ${TOURS[tour].label}`} title="Show me around"
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-stone-500 outline-none transition-colors duration-150 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus ${className}`}>
      <CircleHelp size={14} aria-hidden />
    </button>
  )
}
