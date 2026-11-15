// Walkthrough progress for this browser (mock only). Saved: what tour.js's OFF lists. Not saved: the pointers that are
// up (tour, step), whether the Getting started list is open, and the task that has just ticked itself.
// ?walkthrough=new | reset | progress | scanning | done is read once, when the page loads (tour.js fromParam).
import { useSyncExternalStore } from 'react'
import { navigate } from '../router'
import { OFF, TASKS, TOURS, allDone, complete, fresh, fromParam, move, restore, visit } from './tour.js'

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
let live = { tour: null, step: 0, dir: 'next', dimmed: false, list: Boolean(param && allDone(param)), ticked: null, leaving: false }
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
  if (tour.href && window.location.pathname !== tour.href) navigate(tour.href)
  setLive({ tour: name, step: 0, dir: 'next', dimmed, list: false })
}
// finished: the last pointer's Next (not Skip / Esc). After the menu's pointers the list opens: the last one said
// "Start with the first one".
export function endTour(finished = false) {
  const name = live.tour
  setLive({ tour: null, step: 0, dimmed: false, list: finished && name === 'orientation' && saved.show && !saved.closed })
}
export function stepTour(action) {
  if (!live.tour) return
  if (action === 'close') { endTour(false); return }
  const next = move(live.step, TOURS[live.tour].steps.length, action)
  if (next === null) endTour(true)
  else setLive({ step: next, dir: action })
}
// a pointer's element isn't on this page (a section that is switched off): pass over it
export function skipMissing() {
  if (!live.tour) return
  const n = TOURS[live.tour].steps.length
  const next = live.dir === 'back' ? live.step - 1 : live.step + 1
  if (next < 0 || next >= n) endTour(live.dir !== 'back')
  else setLive({ step: next })
}

// ---------------------------------------------------------------- welcome
export const startWalkthrough = () => { setSaved({ ...saved, welcome: false }); startTour('orientation', { dimmed: true }) }
export const skipWelcome = () => setSaved({ ...saved, welcome: false })
// Settings → Restart the walkthrough: everything from the start
export const restart = () => { setLive({ tour: null, step: 0, list: false, ticked: null, leaving: false }); setSaved({ ...fresh(), hints: saved.hints }) }
// the brand menu's "Walkthrough": the menu's pointers again (and the Getting started card back, if it was hidden)
export const startFromMenu = () => { setSaved({ ...saved, welcome: false, show: true, closed: false }); startTour('orientation') }

// ---------------------------------------------------------------- getting started
let tickTimer
const afterTick = (before) => {
  if (saved === before) return
  const id = saved.done.find((x) => !before.done.includes(x))
  clearTimeout(tickTimer)
  // all six: the list opens with the last message
  setLive({ ticked: id, ...(allDone(saved) ? { list: true } : {}) })
  tickTimer = setTimeout(() => setLive({ ticked: null }), 1800)
}
export function tick(id) { const before = saved; setSaved(complete(saved, id)); afterTick(before) }
// a page opened: its task ticks itself (not while Welcome is still up, and not the page a ?walkthrough= link lands on:
// that link shows a state, which shouldn't change as it draws)
let landing = param ? window.location.pathname : null
export function onPath(path) {
  if (path === landing) return
  landing = null
  if (saved.welcome) return
  const before = saved
  setSaved(visit(saved, path))
  afterTick(before)
}
export function openTask(task) {
  setLive({ list: false })
  if (task.tour) startTour(task.tour)
  else navigate(task.href)
}
export const toggleList = () => setLive({ list: !live.list })
export const closeList = () => { if (live.list) setLive({ list: false }) }
export const setShow = (on) => { setLive({ list: false, leaving: false }); setSaved({ ...saved, show: on, closed: on ? false : saved.closed, done: on && saved.closed ? [] : saved.done }) }
export const setHints = (on) => setSaved({ ...saved, hints: on })
// the last message's Close: the card fades out (200ms), then it is gone
export function finish() {
  setLive({ list: false, leaving: true })
  setTimeout(() => { setLive({ leaving: false }); setSaved({ ...saved, show: false, closed: true }) }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220)
}

// for looking at states by hand (the console) and the screenshots: window.__walkthrough.tick('brand')
if (import.meta.env?.DEV) window.__walkthrough = { tick, restart, startTour, toggleList, setShow, state: () => snap, tasks: TASKS }
