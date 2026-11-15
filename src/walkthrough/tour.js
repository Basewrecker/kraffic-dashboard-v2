// The first-time walkthrough's words and rules (mock only: nothing here exists in the app yet). No React in this file,
// so every rule is tested (tour.test.js). The moving parts are in store.js (saved progress) and Walkthrough.jsx /
// GettingStarted.jsx (what you see).
//
// Three sets of pointers (TOURS): the sidebar straight after Welcome, Brand Setup and Visibility Overview. Each
// pointer names the element it lights (a CSS selector; `all` lights every match as one box) and the side its card
// prefers. Six Getting started tasks (TASKS), in order.

export const APP = 'Kraffic'

// {app} and {brand} in a text → the real names
export const fill = (text, { app = APP, brand = '' } = {}) => text.replaceAll('{app}', app).replaceAll('{brand}', brand)

export const WELCOME = {
  title: 'Welcome to {app}',
  text: 'Let’s get {brand} set up. It takes about five minutes. We’ll show you where things are and what to do first.',
  start: 'Start walkthrough',
  skip: 'Skip, I know my way around',
  note: 'You can start it any time from the menu at the bottom left.',
}

export const TOURS = {
  orientation: {
    label: 'The menu',
    nav: true, // its pointers sit on the sidebar (the menu drawer on phones)
    steps: [
      { target: '[data-tour="nav-insights"]', side: 'right', text: 'This is where you see how AI talks about {brand}.' },
      { target: '[data-tour="nav-opportunities"]', side: 'right', text: 'This is where you write pages for the prompts you’re missing.' },
      { target: '[data-tour="nav-optimize"]', side: 'right', text: 'This is where you fix what holds you back: your site’s data, facts and pages.' },
      { target: '[data-tour="nav-settings"]', side: 'right', text: 'Your brand, your competitors and what we track live here.' },
      { target: '[data-tour="getting-started"]', side: 'right', text: 'This is your plan. Six steps, in order. Start with the first one.' },
    ],
  },
  'brand-setup': {
    label: 'Brand Setup',
    href: '/brands',
    steps: [
      { target: '[data-tour="setup-brand"]', side: 'bottom', text: 'Check these are right. We look for this name in AI answers.' },
      { target: '[data-tour="setup-names"]', side: 'bottom', text: 'Add other names people use for {brand}, so we don’t miss mentions.' },
      { target: '[data-tour="setup-competitors"]', side: 'bottom', text: 'Add the brands you compete with. We compare you with them.' },
      { target: '[data-tour="setup-save"]', side: 'top', text: 'Save when it looks right. You can change it later.' },
    ],
  },
  overview: {
    label: 'Visibility Overview',
    href: '/overview',
    steps: [
      { target: '[data-tour="overview-score"]', side: 'bottom', text: 'This is how often AI names {brand} for your prompts.' },
      { target: '[data-tour="overview-prompts"]', all: true, side: 'bottom', text: 'Visible means AI names you. Missed means it names someone else.' },
      { target: '[data-tour="overview-engine"]', side: 'bottom', text: 'See one AI engine at a time.' },
      { target: '#history', side: 'right', text: 'This shows how your visibility changes over time.' },
    ],
  },
}

// the pointers a page has (its "?" replays them)
export const tourForPath = (path) => Object.keys(TOURS).find((k) => TOURS[k].href === path) ?? null

// Getting started, in order. href: the page a task opens; tour: that page's pointers; results: it needs the first
// scan's results. A task ticks itself when its page is opened, except `brand`, which ticks on Brand Setup's Save.
// (There is no outreach page in the mock yet: task 6 opens Content.)
export const TASKS = [
  { id: 'brand', title: 'Confirm your brand and competitors', why: 'We track what you tell us here.', href: '/brands', tour: 'brand-setup', manual: true },
  { id: 'prompts', title: 'Review the prompts we track', why: 'These are the questions people ask AI.', href: '/tracker' },
  { id: 'results', title: 'See where you stand', why: 'Your first results are in.', href: '/overview', tour: 'overview', results: true },
  { id: 'tone', title: 'Check what AI says about you', why: 'See the tone, and fix wrong facts.', href: '/sentiment', results: true },
  { id: 'content', title: 'Create your first content', why: 'Write a page for a prompt you’re missing.', href: '/opportunities/content', results: true },
  { id: 'outreach', title: 'Reach out on one opportunity', why: 'Ask a publication to mention you.', href: '/opportunities/content', results: true },
]
export const WAITING = 'Waiting for your first results'
export const ALL_DONE = 'You’re set up. {app} keeps checking AI for you. Come back each week to see what changed.'

// ---------------------------------------------------------------- saved progress
// show: the Getting started card is in the sidebar · welcome: the Welcome card is up · done: ticked task ids ·
// hints: the "?" beside page titles · scanning: a first scan is running (no results yet) · closed: the last message
// was read and the card has gone
export const OFF = { show: false, welcome: false, done: [], hints: true, scanning: false, closed: false }
export const fresh = () => ({ ...OFF, show: true, welcome: true })

// ?walkthrough=<value>: new (first time, from the start) · reset (clears progress) · and three more for looking at
// states: progress (2 of 6) · scanning (2 of 6, a first scan running) · done (6 of 6, the last message)
export function fromParam(value) {
  if (value === 'new') return fresh()
  if (value === 'reset') return { ...OFF }
  if (value === 'progress') return { ...OFF, show: true, done: ['brand', 'prompts'] }
  if (value === 'scanning') return { ...OFF, show: true, done: ['brand', 'prompts'], scanning: true }
  if (value === 'done') return { ...OFF, show: true, done: TASKS.map((t) => t.id) }
  return null
}

// what was saved → a whole state (unknown ids and missing fields are dropped / filled)
export function restore(saved) {
  if (!saved || typeof saved !== 'object') return { ...OFF }
  return {
    show: Boolean(saved.show),
    welcome: Boolean(saved.welcome),
    done: Array.isArray(saved.done) ? TASKS.map((t) => t.id).filter((id) => saved.done.includes(id)) : [],
    hints: saved.hints !== false,
    scanning: Boolean(saved.scanning),
    closed: Boolean(saved.closed),
  }
}

export const isDone = (state, id) => state.done.includes(id)
export const doneCount = (state) => TASKS.filter((t) => isDone(state, t.id)).length
export const allDone = (state) => doneCount(state) === TASKS.length
// a task that needs results can't be started while the first scan runs
export const isWaiting = (state, task) => Boolean(state.scanning && task.results && !isDone(state, task.id))
// the next task: the first one not ticked that can be started
export const nextTask = (state) => TASKS.find((t) => !isDone(state, t.id) && !isWaiting(state, t)) ?? null
// 'done' | 'waiting' | 'next' | 'todo'
export function taskStatus(state, task) {
  if (isDone(state, task.id)) return 'done'
  if (isWaiting(state, task)) return 'waiting'
  return nextTask(state)?.id === task.id ? 'next' : 'todo'
}

// tick a task (the same state back when there is nothing to tick)
export function complete(state, id) {
  const task = TASKS.find((t) => t.id === id)
  if (!task || isDone(state, id) || isWaiting(state, task)) return state
  return { ...state, done: TASKS.map((t) => t.id).filter((x) => x === id || state.done.includes(x)) }
}

// opening a page ticks the first open task that lives there (not the ones ticked by hand, not while it waits)
export function visit(state, path) {
  if (!state.show || state.closed) return state
  const task = TASKS.find((t) => !t.manual && t.href === path && !isDone(state, t.id) && !isWaiting(state, t))
  return task ? complete(state, task.id) : state
}

// ---------------------------------------------------------------- pointers
// keys while a pointer is up: → ↓ Enter = next · ← ↑ = back · Esc = close
export function keyAction(key) {
  if (key === 'Escape') return 'close'
  if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'Enter') return 'next'
  if (key === 'ArrowLeft' || key === 'ArrowUp') return 'back'
  return null
}

// one step on: 'next' past the last pointer ends the walkthrough (null); 'back' stops at the first
export function move(i, count, action) {
  if (action === 'next') return i + 1 < count ? i + 1 : null
  if (action === 'back') return Math.max(0, i - 1)
  return i
}

export const overlaps = (a, b) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height

// Where a pointer's card goes: beside the lit box, never over it when a side has room. target / card: { left, top,
// width, height } (card: width and height only); view: { width, height }. Tries the preferred side, then
// bottom, top, right, left; the card is lined up with the box's start and kept `edge` px inside the window. When no side has
// room (a box nearly as big as the window) it takes the side with the most space and stays inside the window.
export function placeCard(target, card, view, prefer = 'bottom', gap = 12, edge = 12) {
  const clampX = (x) => Math.min(Math.max(edge, x), Math.max(edge, view.width - card.width - edge))
  const clampY = (y) => Math.min(Math.max(edge, y), Math.max(edge, view.height - card.height - edge))
  const at = {
    right: { left: target.left + target.width + gap, top: clampY(target.top) },
    left: { left: target.left - gap - card.width, top: clampY(target.top) },
    bottom: { left: clampX(target.left), top: target.top + target.height + gap },
    top: { left: clampX(target.left), top: target.top - gap - card.height },
  }
  const room = {
    right: view.width - (target.left + target.width) - gap - edge - card.width,
    left: target.left - gap - edge - card.width,
    bottom: view.height - (target.top + target.height) - gap - edge - card.height,
    top: target.top - gap - edge - card.height,
  }
  const order = [prefer, 'bottom', 'top', 'right', 'left'].filter((s, i, a) => at[s] && a.indexOf(s) === i)
  const side = order.find((s) => room[s] >= 0) ?? order.slice().sort((a, b) => room[b] - room[a])[0]
  return { side, left: Math.round(clampX(at[side].left)), top: Math.round(clampY(at[side].top)) }
}

// phones: the card is a sheet at the bottom; at the top when the lit box sits where the sheet would be
export const sheetSide = (target, sheetHeight, viewHeight, gap = 12) => (target.top + target.height > viewHeight - sheetHeight - gap ? 'top' : 'bottom')

// the box around several elements' boxes (Visible and Missed prompts are lit as one)
export function union(rects) {
  if (!rects.length) return null
  const left = Math.min(...rects.map((r) => r.left)), top = Math.min(...rects.map((r) => r.top))
  const right = Math.max(...rects.map((r) => r.left + r.width)), bottom = Math.max(...rects.map((r) => r.top + r.height))
  return { left, top, width: right - left, height: bottom - top }
}
