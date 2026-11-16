// Walkthrough progress for this browser (mock only). Saved: what tour.js's OFF lists. Not saved: the pointers that are
// up (tour, step), whether the Getting started list is open, and the task that has just ticked itself.
// ?walkthrough=new | reset | progress | scanning | done is read once, when the page loads (tour.js fromParam).
import { useSyncExternalStore } from 'react'
import { navigate } from '../router'
import { OFF, TASKS, TOURS, allDone, atOf, complete, flowDone, fresh, fromParam, isDone, move, onPage, restore, resumeStep, startOf, taskOfTour, tourDone, visit } from './tour.js'
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
// gap: counts the times the next pointer starts from nothing (after a click, or on another page) · hold: that pointer
// waits for its element for as long as it takes (what the click opened is still drawing) · note: a small confirmation
let live = { welcomeOut: null, closing: null, wait: false, gap: 0, hold: false, note: null, tour: null, step: 0, dir: 'next', dimmed: false, list: Boolean(param && allDone(param)), ticked: null, leaving: false }
let snap = { ...saved, ...live }
const listeners = new Set()
const emit = () => { snap = { ...saved, ...live }; listeners.forEach((l) => l()) }
const setSaved = (next) => { if (next === saved) return; saved = next; write(saved); emit() }
const setLive = (patch) => { live = { ...live, ...patch }; emit() }

export const useWalkthrough = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => snap, () => snap)

// ---------------------------------------------------------------- pointers
// from: the pointer to start on · href: the page to open first (a flow resumed on the page it stopped on)
export function startTour(name, { dimmed = false, from = 0, href = null } = {}) {
  const tour = TOURS[name]
  if (!tour) return
  const to = href ?? startOf(tour, from)
  const moved = Boolean(to && window.location.pathname + window.location.search !== to)
  if (moved) navigate(to)
  stopped = to ?? window.location.pathname
  setLive({ tour: name, step: from, dir: 'next', dimmed, list: false, closing: null, wait: moved, hold: from > 0, gap: live.gap + 1 })
}
// Skip, Esc, or the last pointer's Next (finished). The pointers close first (Walkthrough.jsx: the hole grows until the
// dim is gone, 300ms), then tourClosed does the rest. A flow left midway is remembered: Start resumes from the first
// pointer of the page it stopped on.
const resume = {}
let stopped = null // the last page the pointers were on
export function endTour(finished = false) {
  if (!live.tour || live.closing) return
  if (finished) delete resume[live.tour]
  else if (taskOfTour(live.tour)) resume[live.tour] = { from: resumeStep(TOURS[live.tour], live.step), href: stopped }
  setLive({ closing: { finished } })
}
// After the menu's pointers the board opens: the last one said "Start with the first one". After a step's own run it
// opens again, showing the step ticking and the next one sliding in. A step that ticked while the pointers were up
// ticks now, where it can be seen; so does the step that asked for these pointers to be finished.
export function tourClosed() {
  const name = live.tour
  if (!name) return
  const finished = Boolean(live.closing?.finished)
  const back = finished && (name === 'orientation' || Boolean(taskOfTour(name))) && saved.show && !saved.closed
  setLive({ tour: null, step: 0, dimmed: false, closing: null, wait: false, hold: false, list: back })
  const held = pending
  pending = null
  if (held) apply(held(saved))
  if (finished) apply(tourDone(saved, name))
}
// the next pointer starts from nothing: after a click, or when it is on another page
const go = (next, action, { hold = false } = {}) => {
  const tour = TOURS[live.tour]
  const to = startOf(tour, next)
  const moved = Boolean(to && atOf(tour, next) !== atOf(tour, live.step) && window.location.pathname !== to)
  if (moved) navigate(to)
  setLive({ step: next, dir: action, hold, ...(hold || moved ? { gap: live.gap + 1, wait: true } : {}) })
}
export function stepTour(action) {
  if (!live.tour || live.closing) return
  if (action === 'close') { endTour(false); return }
  const next = move(live.step, TOURS[live.tour].steps.length, action)
  if (next === null) endTour(true)
  else go(next, action)
}
// a "do this" pointer's element was clicked: its step ticks if it says so, and the next pointer waits for what the click
// opened
export function didStep() {
  if (!live.tour || live.closing) return
  const tour = TOURS[live.tour], s = tour.steps[live.step]
  if (s.ticks) reached(live.step)
  if (s.confirm) note(s.confirm)
  if (live.step + 1 >= tour.steps.length) endTour(true)
  else go(live.step + 1, 'next', { hold: true })
}
// a pointer was reached: its step ticks if it says so (held until the pointers close, where it can be seen)
export function reached(i) {
  const name = live.tour
  if (name && TOURS[name].steps[i]?.ticks) tickWith((st) => flowDone(st, name))
}
// while a pointer waits, a later one's element showed up first (the draft was already there): go to that one
export function jumpTo(i) { if (live.tour && !live.closing && i > live.step) setLive({ step: i, hold: true }) }
let noteTimer
export function note(text) { clearTimeout(noteTimer); setLive({ note: text }); noteTimer = setTimeout(() => setLive({ note: null }), 3600) }
// a pointer's element isn't on this page (a section that is switched off): pass over it
export function skipMissing() {
  if (!live.tour || live.closing) return
  const n = TOURS[live.tour].steps.length
  const next = live.dir === 'back' ? live.step - 1 : live.step + 1
  if (next < 0 || next >= n) endTour(live.dir !== 'back')
  else go(next, live.dir)
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
export const restart = () => { clearTimeout(doneTimer); pending = null; for (const k of Object.keys(resume)) delete resume[k]; setLive({ welcomeOut: null, closing: null, wait: false, tour: null, step: 0, list: false, ticked: null, leaving: false }); setSaved(fresh()) }
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
  // pointers are up and the page changed: fine when it is the pointer's own page, or the one its click opens; any
  // other page ends the run there (the step stays not done)
  // (a path the window has already moved on from says nothing: the phone menu closes as the page changes)
  if (live.tour && !live.closing && path === window.location.pathname) {
    const tour = TOURS[live.tour]
    if (onPage(atOf(tour, live.step), path)) stopped = path
    else if (!(tour.steps[live.step].do && onPage(atOf(tour, live.step + 1), path))) {
      // only if it is still somewhere else a moment later (the phone menu steps back and forth as it closes)
      const name = live.tour
      setTimeout(() => { if (live.tour === name && !live.closing && !onPage(atOf(TOURS[name], live.step), window.location.pathname)) endTour(false) }, 300)
    }
  }
  if (path === landing) return
  landing = null
  if (saved.welcome) return
  tickWith((s) => visit(s, path))
}
// Start on the current step: its page, and its pointers if it has some
// (a flow left midway: from the page it stopped on; Replay on a done step: from its first pointer)
export function openTask(task) {
  setLive({ list: false })
  if (task.tour) startTour(task.tour, isDone(saved, task.id) ? {} : resume[task.tour] ?? {})
  else navigate(task.href)
  // the list folds back into the card, the page changes, and the pointers start 250ms after it has settled
  if (task.tour) setLive({ wait: true })
  if (task.how === 'open') tick(task.id) // already on that page: there is no "opened" to wait for
}
export const toggleList = () => setLive({ list: !live.list })
export const closeList = () => { if (live.list) setLive({ list: false }) }
export const setShow = (on) => { clearTimeout(doneTimer); setLive({ list: false, leaving: false }); setSaved({ ...saved, show: on, closed: on ? false : saved.closed, done: on && saved.closed ? [] : saved.done }) }
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
