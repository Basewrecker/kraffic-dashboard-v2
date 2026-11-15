// The first-time walkthrough (mock only): the Welcome card and the pointers. Words and rules: tour.js.
//
// Pointers: the page dims and one element stays lit with its real look. The dim is the lit box's own shadow (.wt-hole
// in index.css), so nothing is drawn over the element. A small card sits beside the box (tour.js placeCard). Below lg
// the card is a sheet at the bottom (at the top when the lit box is down there).
// Motion: the dim fades in over 200ms; from one pointer to the next the lit box glides and resizes (260ms ease-out)
// and the card follows 40ms behind. Reduced motion: no fades and no glide.
// Keys: → ↓ Enter next · ← ↑ back · Esc closes. Tab stays inside the card.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleHelp } from 'lucide-react'
import { account } from '../data/mock'
import { usePath } from '../router'
import { useIsCompact } from '../hooks/useMedia'
import { TOURS, WELCOME, fill, keyAction, placeCard, sheetSide, union } from './tour.js'
import { endTour, onPath, skipMissing, skipWelcome, startTour, startWalkthrough, stepTour, useWalkthrough } from './store.js'

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const names = () => ({ brand: account.name })
const ink = 'inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-ink font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2'
const line = 'inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-line bg-surface font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-40'
const plain = 'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'

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
  useEffect(() => {
    box.current?.querySelector('button')?.focus()
    const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); skipWelcome() } else trapTab(e, box.current) }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])
  return createPortal(
    <div className="wt-fade fixed inset-0 z-[90] grid place-items-center bg-scrim-modal p-4">
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

const PAD = 6 // the lit box is this much bigger than its element
const visible = (el) => el.getClientRects().length > 0
const boxOf = (step) => {
  const els = [...document.querySelectorAll(step.target)].filter(visible)
  const lit = step.all ? els : els.slice(0, 1)
  return lit.length ? { els: lit, rect: union(lit.map((el) => el.getBoundingClientRect())) } : null
}
const same = (a, b) => a && b && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5

// 2. Pointers
function Pointers({ name, step, dimmed }) {
  const tour = TOURS[name]
  const compact = useIsCompact()
  const card = useRef(null)
  // what is on screen: the pointer shown, its lit box, and whether the move to it glides. Set together, once the
  // element has been found and has stopped moving (a page that is still drawing, the menu drawer sliding in).
  const [view, setView] = useState(null)
  const [pos, setPos] = useState(null) // the card: { left, top } beside the box, or { sheet: 'bottom' | 'top' }
  const shown = useRef(null)

  useEffect(() => {
    const s = tour.steps[step]
    let raf, last = null, still = 0, scrolled = false
    const t0 = performance.now()
    const loop = () => {
      const found = boxOf(s)
      if (!found) {
        if (performance.now() - t0 > 2500) { skipMissing(); return }
        raf = requestAnimationFrame(loop); return
      }
      if (!scrolled) {
        scrolled = true
        const r = found.rect
        // under the phone top bar, or off the window: bring it to the middle
        if (r.top < 64 || r.top + r.height > window.innerHeight - 16) found.els[0].scrollIntoView({ block: 'center', behavior: 'instant' })
      }
      still = same(found.rect, last) ? still + 1 : 0
      last = found.rect
      if (still >= 2 && !(shown.current?.step === step && same(shown.current.rect, last))) {
        const glide = shown.current != null && shown.current.step !== step && !reduced()
        shown.current = { step, rect: last }
        setView({ step, rect: last, glide })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [tour, step])

  // the card's place, from its own size with this pointer's words in it
  useLayoutEffect(() => {
    if (!view || !card.current) return
    const size = card.current.getBoundingClientRect()
    const target = { left: view.rect.left - PAD, top: view.rect.top - PAD, width: view.rect.width + PAD * 2, height: view.rect.height + PAD * 2 }
    setPos(compact
      ? { sheet: sheetSide(target, size.height, window.innerHeight) }
      : placeCard(target, { width: size.width, height: size.height }, { width: window.innerWidth, height: window.innerHeight }, tour.steps[view.step].side))
  }, [view, compact, tour])

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
    document.addEventListener('keydown', key, true)
    return () => document.removeEventListener('keydown', key, true)
  }, [])
  useEffect(() => { if (pos) card.current?.querySelector('[data-next]')?.focus({ preventScroll: true }) }, [pos != null, view?.step]) // eslint-disable-line react-hooks/exhaustive-deps

  const i = view?.step ?? step
  const n = tour.steps.length
  const glide = view?.glide
  const move = (delay) => (glide ? `left 260ms ease-out ${delay}ms, top 260ms ease-out ${delay}ms, width 260ms ease-out ${delay}ms, height 260ms ease-out ${delay}ms` : 'none')
  const sheet = pos?.sheet
  return createPortal(
    <div className={`fixed inset-0 z-[90] ${dimmed ? '' : 'wt-fade'}`} data-walkthrough={name}>
      {/* nothing under the dim can be clicked while a pointer is up */}
      <div className="absolute inset-0" aria-hidden />
      {/* before the element is found the whole page is dim (a box of no size in the middle) */}
      <div aria-hidden className="wt-hole" style={view
        ? { left: view.rect.left - PAD, top: view.rect.top - PAD, width: view.rect.width + PAD * 2, height: view.rect.height + PAD * 2, transition: move(0) }
        : { left: '50%', top: '50%', width: 0, height: 0, boxShadow: '0 0 0 200vmax var(--color-scrim-modal)' }} />
      {view && (
        <div ref={card} role="dialog" aria-modal="true" aria-label={`${tour.label}: ${i + 1} of ${n}`}
          style={sheet || !pos ? { visibility: pos ? undefined : 'hidden' } : { left: pos.left, top: pos.top, transition: move(40) }}
          className={sheet
            ? `fixed inset-x-0 border-line bg-overlay p-4 shadow-xl ${sheet === 'top' ? 'top-0 rounded-b-2xl border-b pt-[max(16px,env(safe-area-inset-top))]' : 'bottom-0 rounded-t-2xl border-t pb-[max(16px,env(safe-area-inset-bottom))]'}`
            : 'fixed w-[300px] max-w-[calc(100vw-24px)] rounded-xl border border-line bg-overlay p-4 shadow-lg'}>
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
