// The first-time walkthrough (mock only): the Welcome card and the pointers. Words and rules: tour.js.
//
// Pointers: one dim layer over the whole window (an SVG path, the modal scrim) with a hole cut in it. The hole is the
// lit area: nothing is drawn in it, so the element shows exactly as it always looks. It is the element plus 4px, with
// 10px corners, and never touches a neighbour (tour.js fitHole). A small card sits beside it with a caret on the
// area's middle, 12px from it (tour.js placeCard). Below lg the card is a sheet at the bottom (at the top when the lit
// area is down there), with no caret.
// Motion: the dim fades in over 200ms; from one pointer to the next the hole glides and resizes in one move (260ms
// ease-out) and the card follows 40ms behind. Reduced motion: no fades and no glide.
// Keys: → ↓ Enter next · ← ↑ back · Esc closes. Tab stays inside the card. The buttons show a 2px focus ring only
// while the keyboard is being used (.wt-keys in index.css).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleHelp } from 'lucide-react'
import { account } from '../data/mock'
import { usePath } from '../router'
import { useIsCompact } from '../hooks/useMedia'
import { TOURS, WELCOME, fill, fitHole, keyAction, placeCard, sheetSide, union } from './tour.js'
import { uiScale } from '@/lib/ui-scale'
import { endTour, onPath, skipMissing, skipWelcome, startTour, startWalkthrough, stepTour, useWalkthrough } from './store.js'

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
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

// 1. Welcome: centred, the page dim behind it
function Welcome() {
  const box = useRef(null)
  const keys = useKeys()
  useEffect(() => {
    box.current?.querySelector('button')?.focus()
    const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); skipWelcome() } else trapTab(e, box.current) }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])
  return createPortal(
    <div className={`wt-fade fixed inset-0 z-[90] grid place-items-center bg-scrim-modal p-4 ${keys ? 'wt-keys' : ''}`}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="wt-welcome-title" aria-describedby="wt-welcome-text"
        className="w-full max-w-[440px] rounded-2xl border border-line bg-overlay p-6 shadow-xl">
        <h2 id="wt-welcome-title" className="text-[20px] leading-7 font-semibold tracking-[-0.01em] text-stone-900">{fill(WELCOME.title, names())}</h2>
        <p id="wt-welcome-text" className="mt-2 text-body text-stone-600">{fill(WELCOME.text, names())}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button type="button" onClick={startWalkthrough} className={`${ink} h-10 px-4 text-small`}>{WELCOME.start}</button>
          <button type="button" onClick={skipWelcome} className={`${plain} h-10 px-3 text-small`}>{WELCOME.skip}</button>
        </div>
        <p className="mt-5 border-t border-[var(--div)] pt-4 text-[12px] leading-4 text-stone-500">{WELCOME.note}</p>
      </div>
    </div>,
    document.body,
  )
}

const visible = (el) => el.getClientRects().length > 0
const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height } }
// the pointer's element(s) and the hole around them, clear of whatever else is marked on the page
const holeOf = (step) => {
  const els = [...document.querySelectorAll(step.target)].filter(visible)
  const lit = step.all ? els : els.slice(0, 1)
  if (!lit.length) return null
  const near = [...document.querySelectorAll('[data-tour], [data-tour-near]')].filter((el) => visible(el) && !lit.some((l) => l === el || l.contains(el) || el.contains(l)))
  return { el: lit[0], hole: fitHole(union(lit.map(box)), near.map(box), 4, step.maxHeight ? step.maxHeight * uiScale() : null) /* the page is drawn at the UI scale, so the cut-off follows it */ }
}
const same = (a, b) => a && b && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5
const RADIUS = 10
// a rounded box as a path (drawn the other way round from the window's box, so it is cut out of it)
const cut = ({ left: x, top: y, width: w, height: h }) => {
  const r = Math.min(RADIUS, w / 2, h / 2)
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
}
// the caret: a small square turned 45°, half out of the card's edge that faces the lit area
const CARET_SIDE = { right: 'border-b border-l', left: 'border-r border-t', bottom: 'border-l border-t', top: 'border-b border-r' }
// (-6: half the square, and the card's 1px border, which its inside is measured from)
const caretAt = (side, at) => (side === 'right' ? { left: -6, top: at - 6 } : side === 'left' ? { right: -6, top: at - 6 } : side === 'bottom' ? { top: -6, left: at - 6 } : { bottom: -6, left: at - 6 })

// 2. Pointers
function Pointers({ name, step, dimmed }) {
  const tour = TOURS[name]
  const compact = useIsCompact()
  const keys = useKeys()
  const card = useRef(null)
  // what is on screen: the pointer shown, its hole, and whether the move to it glides. Set together, once the element
  // has been found and has stopped moving (a page that is still drawing, the menu drawer sliding in).
  const [view, setView] = useState(null)
  const [pos, setPos] = useState(null) // the card: { side, left, top, caret } beside the hole, or { sheet: 'bottom' | 'top' }
  const [drawn, setDrawn] = useState(null) // the hole as drawn this frame (it glides from one pointer's to the next's)
  const [win, setWin] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const shown = useRef(null)
  const drawnNow = useRef(null)

  useEffect(() => {
    const s = tour.steps[step]
    let raf, last = null, still = 0, scrolled = false
    const t0 = performance.now()
    const loop = () => {
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
      if (still >= 2 && !(shown.current?.step === step && same(shown.current.hole, last))) {
        const glide = shown.current != null && shown.current.step !== step && !reduced()
        shown.current = { step, hole: last }
        setView({ step, hole: last, glide })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [tour, step])

  // the hole glides and resizes in one move: every edge goes from where it is drawn now to the new place together
  useEffect(() => {
    if (!view) return undefined
    const from = drawnNow.current, to = view.hole
    const put = (h) => { drawnNow.current = h; setDrawn(h) }
    if (!from || !view.glide) { put(to); return undefined }
    const t0 = performance.now()
    let raf
    const frame = (t) => {
      const k = Math.min(1, (t - t0) / 260), e = 1 - (1 - k) ** 3
      put({ left: from.left + (to.left - from.left) * e, top: from.top + (to.top - from.top) * e, width: from.width + (to.width - from.width) * e, height: from.height + (to.height - from.height) * e })
      if (k < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [view])

  // the card's place, from its own size with this pointer's words in it
  useLayoutEffect(() => {
    if (!view || !card.current) return
    const size = card.current.getBoundingClientRect()
    setPos(compact
      ? { sheet: sheetSide(view.hole, size.height, window.innerHeight) }
      : placeCard(view.hole, { width: size.width, height: size.height }, { width: window.innerWidth, height: window.innerHeight }, tour.steps[view.step].side))
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
  const follow = view?.glide ? 'left 260ms ease-out 40ms, top 260ms ease-out 40ms' : 'none'
  const sheet = pos?.sheet
  return createPortal(
    <div className={`fixed inset-0 z-[90] ${dimmed ? '' : 'wt-fade'} ${keys ? 'wt-keys' : ''}`} data-walkthrough={name}>
      {/* the one dim layer, with the lit area cut out of it (before the element is found: no hole yet) */}
      <svg className="absolute inset-0 h-full w-full" width={win.w} height={win.h} aria-hidden>
        <path data-dim fillRule="evenodd" fill="var(--color-scrim-modal)" d={`M0 0H${win.w}V${win.h}H0Z${drawn ? cut(drawn) : ''}`} />
      </svg>
      {/* nothing on the page can be clicked while a pointer is up, the lit element included */}
      <div className="absolute inset-0" aria-hidden data-hole={drawn ? [drawn.left, drawn.top, drawn.width, drawn.height].map((v) => Math.round(v * 10) / 10).join(' ') : undefined} />
      {view && (
        <div ref={card} role="dialog" aria-modal="true" aria-label={`${tour.label}: ${i + 1} of ${n}`} data-side={sheet ? 'sheet' : pos?.side}
          style={sheet || !pos ? { visibility: pos ? undefined : 'hidden' } : { left: pos.left, top: pos.top, transition: follow }}
          className={sheet
            ? `fixed inset-x-0 border-line bg-overlay p-4 shadow-xl ${sheet === 'top' ? 'top-0 rounded-b-2xl border-b pt-[max(16px,env(safe-area-inset-top))]' : 'bottom-0 rounded-t-2xl border-t pb-[max(16px,env(safe-area-inset-bottom))]'}`
            : 'fixed w-[300px] max-w-[calc(100vw-24px)] rounded-xl border border-line bg-overlay p-4 shadow-lg'}>
          {!sheet && pos && <span aria-hidden data-caret className={`absolute rotate-45 border-line bg-overlay ${CARET_SIDE[pos.side]}`} style={{ width: 10, height: 10, ...caretAt(pos.side, pos.caret), /* 10px whatever the UI scale: its place is worked out in px */ transition: view.glide ? 'left 260ms ease-out 40ms, top 260ms ease-out 40ms' : 'none' }} />}
          <p aria-live="polite" className="text-[14px] leading-5 text-stone-900">{fill(tour.steps[i].text, names())}</p>
          <div className={`flex items-center gap-2 ${sheet ? 'mt-4' : 'mt-3.5'}`}>
            <span className="text-[12px] leading-4 text-stone-500 tabular-nums">{i + 1} of {n}</span>
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

// mounted once (App.jsx): Welcome, the pointers, and "a page was opened" for the tasks that tick themselves
export default function Walkthrough() {
  const w = useWalkthrough()
  const path = usePath()
  // only when a page is opened: closing Welcome on a page doesn't tick that page's task
  useEffect(() => { onPath(path) }, [path])
  if (w.welcome) return <Welcome />
  return w.tour ? <Pointers key={w.tour} name={w.tour} step={w.step} dimmed={w.dimmed} /> : null
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
