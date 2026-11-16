// Walkthrough progress for this browser (mock only). Saved: what tour.js's OFF lists. Not saved: the pointers that are
// up (tour, step), whether the Getting started list is open, and the task that has just ticked itself.
// ?walkthrough=new | reset | progress | scanning | done is read once, when the page loads (tour.js fromParam).
import { useSyncExternalStore } from 'react'
import { navigate } from '../router'
import { OFF, TASKS, TOURS, allDone, complete, fresh, fromParam, move, restore, tourDone, visit } from './tour.js'
import { FADE, LARGE, MOVE, ms, reduced } from './motion.js'

const KEY = 'kraffic:walkthrough'
const read = () => { try { return restore(JSON.parse(localStorage.getItem(KEY) ?? 'null')) } catch { return { ...OFF } } }
const write = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode: this visit only */ } }

let saved = read()
const param = fromParam(new URLSearchParams(window.location.search).get('walkthrough'))
if (param) { saved = param; write(saved) }

// tour: the pointers showing (a TOURS key) · step · dir: the way the last move went (a pointer whose element isn't
// on the page is passed over in that direction) · dimmed: the page was already dim (straight after Welcome), so the
// dim layer doesn't fade in again · list: the Getting started list is open · ticked: the task that just ticked ·
// leaving: the card is fading out after the last message
// welcomeOut: Welcome is leaving ('start': toward the sidebar as the first pointer opens; 'skip': a fade) · closing: the
// pointers are closing (the hole grows until the dim is gone), { finished } · wait: the pointers hold off 250ms after
// their page has settled (a step was chosen and the page changed)
let live = { welcomeOut: null, closing: null, wait: false, tour: null, step: 0, dir: 'next', dimmed: false, list: Boolean(param && allDone(param)), ticked: null, leaving: false }
let snap = { ...saved, ...live }
const listeners = new Set()
const emit = () => { snap = { ...saved, ...live }; listeners.forEach((l) => l()) }
const setSaved = (next) => { if (next === saved) return; saved = next; write(saved); emit() }
const setLive = (patch) => { live = { ...live, ...patch }; emit() }

export const useWalkthrough = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => snap, () => snap)

// ---------------------------------------------------------------- pointers
export function startTour(name, { dimmed = false } = {}) {
  const tour = TOURS[name]
  if (!tour) return
  const moved = Boolean(tour.href && window.location.pathname !== tour.href)
  if (moved) navigate(tour.href)
  setLive({ tour: name, step: 0, dir: 'next', dimmed, list: false, closing: null, wait: moved })
}
// Skip, Esc, or the last pointer's Next (finished). The pointers close first (Walkthrough.jsx: the hole grows until the
// dim is gone, 300ms), then tourClosed does the rest.
export function endTour(finished = false) {
  if (!live.tour || live.closing) return
  setLive({ closing: { finished } })
}
// After the menu's pointers the list opens: the last one said "Start with the first one". A step that ticked while the
// pointers were up (its page was opened) ticks now, where it can be seen; so does the step that asked for these
// pointers to be finished.
export function tourClosed() {
  const name = live.tour
  if (!name) return
  const finished = Boolean(live.closing?.finished)
  setLive({ tour: null, step: 0, dimmed: false, closing: null, wait: false, list: finished && name === 'orientation' && saved.show && !saved.closed })
  const held = pending
  pending = null
  if (held) apply(held(saved))
  if (finished) apply(tourDone(saved, name))
}
export function stepTour(action) {
  if (!live.tour || live.closing) return
  if (action === 'close') { endTour(false); return }
  const next = move(live.step, TOURS[live.tour].steps.length, action)
  if (next === null) endTour(true)
  else setLive({ step: next, dir: action })
}
// a pointer's element isn't on this page (a section that is switched off): pass over it
export function skipMissing() {
  if (!live.tour || live.closing) return
  const n = TOURS[live.tour].steps.length
  const next = live.dir === 'back' ? live.step - 1 : live.step + 1
  if (next < 0 || next >= n) endTour(live.dir !== 'back')
  else setLive({ step: next })
}

// ---------------------------------------------------------------- welcome
// Start: Welcome shrinks and fades toward the sidebar while the first pointer's lit area opens (one move, 320ms)
export function startWalkthrough() {
  setSaved({ ...saved, welcome: false })
  setLive({ welcomeOut: 'start' })
  startTour('orientation', { dimmed: true })
  setTimeout(() => setLive({ welcomeOut: null }), reduced() ? ms(FADE) : ms(MOVE) + 40)
}
export function skipWelcome() {
  if (live.welcomeOut) return
  setSaved({ ...saved, welcome: false })
  setLive({ welcomeOut: 'skip' })
  setTimeout(() => setLive({ welcomeOut: null }), ms(FADE) + 20)
}
// Settings → Restart the walkthrough: everything from the start
export const restart = () => { clearTimeout(doneTimer); pending = null; setLive({ welcomeOut: null, closing: null, wait: false, tour: null, step: 0, list: false, ticked: null, leaving: false }); setSaved({ ...fresh(), hints: saved.hints }) }
// the brand menu's "Walkthrough": the menu's pointers again (and the Getting started card back, if it was hidden)
export const startFromMenu = () => { setSaved({ ...saved, welcome: false, show: true, closed: false }); startTour('orientation') }

// ---------------------------------------------------------------- getting started
// A step ticking: the board opens so it can be seen (its trail tile fills with its result, the hero moves on to the
// next step: Board.jsx, for as long as `ticked` names the step). While pointers are up the tick waits
// for them to close (endTour).
let tickTimer, doneTimer, openTimer
let pending = null
function apply(next) {
  if (next === saved) return
  setSaved(next)
  clearTimeout(tickTimer)
  // the sidebar card makes its move first (its top card slides away, 450ms), then the board grows out of the new one
  setLive({ ticked: next.done.at(-1) })
  clearTimeout(openTimer)
  if (!live.list) openTimer = setTimeout(() => { if (saved.show && !live.tour) setLive({ list: true }) }, reduced() ? 0 : ms(LARGE))
  tickTimer = setTimeout(() => setLive({ ticked: null }), ms(1950) + 700) // as long as the tick's animations take (GettingStarted.jsx)
}
const tickWith = (fn) => { if (fn(saved) === saved) return; if (live.tour) pending = fn; else apply(fn(saved)) }
export const tick = (id) => tickWith((s) => complete(s, id))
// a page opened: the current step ticks if that is all it asks (not while Welcome is still up, and not the page a
// ?walkthrough= link lands on: that link shows a state, which shouldn't change as it draws)
let landing = param ? window.location.pathname : null
export function onPath(path) {
  if (path === landing) return
  landing = null
  if (saved.welcome) return
  tickWith((s) => visit(s, path))
}
// Start on the current step: its page, and its pointers if it has some
export function openTask(task) {
  setLive({ list: false })
  if (task.tour) startTour(task.tour)
  else navigate(task.href)
  // the list folds back into the card, the page changes, and the pointers start 250ms after it has settled
  if (task.tour) setLive({ wait: true })
  if (task.how === 'open') tick(task.id) // already on that page: there is no "opened" to wait for
}
export const toggleList = () => setLive({ list: !live.list })
export const closeList = () => { if (live.list) setLive({ list: false }) }
export const setShow = (on) => { clearTimeout(doneTimer); setLive({ list: false, leaving: false }); setSaved({ ...saved, show: on, closed: on ? false : saved.closed, done: on && saved.closed ? [] : saved.done }) }
export const setHints = (on) => setSaved({ ...saved, hints: on })
// the board's last screen: Done. The board closes, the card fades out and the sidebar closes the gap, then it is gone
export function finish() {
  clearTimeout(doneTimer)
  if (!saved.show || live.leaving) return
  setLive({ list: false, leaving: true })
  setTimeout(() => { setLive({ leaving: false }); setSaved({ ...saved, show: false, closed: true }) }, ms(MOVE) + 40)
}
if (saved.show && allDone(saved)) { live.list = true; snap = { ...saved, ...live } }

// for looking at states by hand (the console) and the screenshots: window.__walkthrough.tick('brand')
if (import.meta.env?.DEV) window.__walkthrough = { tick, restart, startTour, toggleList, setShow, state: () => snap, tasks: TASKS }
