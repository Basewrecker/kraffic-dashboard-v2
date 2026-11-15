// The first-time walkthrough's words and rules (mock only: nothing here exists in the app yet). No React in this file,
// so every rule is tested (tour.test.js). The moving parts are in store.js (saved progress) and Walkthrough.jsx /
// GettingStarted.jsx (what you see).
//
// Five sets of pointers (TOURS): the sidebar straight after Welcome, Brand Setup, Prompt Hub, Sentiment and Visibility
// Overview.
// Each pointer names the element it lights (a CSS selector; `all` lights every match as one box; `maxHeight` lights
// only the top of a tall element) and the side its card prefers. Six Getting started steps (TASKS), done in order.

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
  // (these three texts are ours: the brief gave none for Prompt Hub)
  'prompt-hub': {
    label: 'Prompt Hub',
    href: '/tracker',
    steps: [
      { target: '#tracked-prompts', maxHeight: 319, side: 'bottom', text: 'These are the questions we ask AI about {brand}. Open one to read the answers.' },
      { target: '[data-tour="prompts-add"]', side: 'bottom', text: 'Add a question your customers would ask.' },
      { target: '[data-tour="prompts-find"]', side: 'bottom', text: 'Or let us find prompts from your site, or import a list.' },
    ],
  },
  // Sentiment is the app's own page file, so its pointers find their elements by what the page already has (no
  // data-tour marks in it). The four texts are the owner's (2026-11-15); the fourth lights the Opportunities button.
  sentiment: {
    label: 'Sentiment',
    href: '/sentiment',
    steps: [
      { target: 'section[aria-label="Sentiment spectrum"] > div:first-child > div:first-child', side: 'right', text: 'This is the tone of the sources AI relies on when it talks about {brand}.' },
      { target: 'section[aria-label="Sentiment spectrum"] > div:first-child > div.min-w-0', side: 'bottom', text: 'Each logo is a publication, placed by its tone.' },
      { target: '#pages-on-h, li[data-row="sync"]', all: true, side: 'left', text: 'Open any page to see what it says about you.' },
      { target: '.k-mo-btn', side: 'bottom', text: 'Neutral and mixed pages are your chance to win a better mention. This opens the list.' },
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

// Getting started: six steps, done in order (only the current step can be started or ticked). href: the page a step
// opens; tour: that page's pointers; results: it needs the first scan's results. how a step ticks itself:
//   save: Brand Setup's Save · tour: its page's pointers were finished · open: its page was opened ·
//   demo: "Mark as done" on its page (mock only: the real triggers for these three aren't decided)
// (There is no outreach page in the mock yet: step 6 opens Content.)
export const TASKS = [
  { id: 'brand', title: 'Confirm your brand and competitors', why: 'We track what you tell us here.', href: '/brands', tour: 'brand-setup', how: 'save', pages: ['Brand Setup'] },
  { id: 'prompts', title: 'Review the prompts we track', why: 'These are the questions people ask AI.', href: '/tracker', tour: 'prompt-hub', how: 'tour', pages: ['Prompt Hub'] },
  { id: 'results', title: 'See where you stand', why: 'Your first results are in.', href: '/overview', tour: 'overview', how: 'open', results: true, pages: ['Visibility Overview'] },
  { id: 'tone', title: 'Check what AI says about you', why: 'See the tone, and fix wrong facts.', href: '/sentiment', tour: 'sentiment', how: 'demo', results: true, pages: ['Sentiment', 'Fact Check'] },
  { id: 'content', title: 'Create your first content', why: 'Write a page for a prompt you’re missing.', href: '/opportunities/content', how: 'demo', results: true, pages: ['Content'] },
  { id: 'outreach', title: 'Reach out on one opportunity', why: 'Ask a publication to mention you.', href: '/sentiment', how: 'demo', results: true, pages: ['Sentiment', 'Opportunities'] }, // the Opportunities view opens from Sentiment (synced from the app)
]
export const WAITING = 'Waiting for your first results'
export const ALL_DONE = 'You’re set up. {app} keeps checking AI for you. Come back each week to see what changed.'

// ---------------------------------------------------------------- saved progress
// show: the Getting started card is in the sidebar · welcome: the Welcome card is up · done: ticked task ids ·
// hints: the "?" beside page titles · scanning: a first scan is running (no results yet) · closed: the last message
// was read and the card has gone
export const OFF = { show: false, welcome: false, done: [], hints: true, scanning: false, closed: false }
export const fresh = () => ({ ...OFF, show: true, welcome: true })

// ?walkthrough=<value>: new (first time, from the start) · slow (the same, in slow motion) · reset (clears progress) ·
// and three more for looking at
// states: progress (2 of 6) · scanning (2 of 6, a first scan running) · done (6 of 6, the last message)
export function fromParam(value) {
  if (value === 'new' || value === 'slow') return fresh() // slow: the same run with every animation at 4x (motion.js)
  if (value === 'reset') return { ...OFF }
  if (value === 'progress') return { ...OFF, show: true, done: ['brand', 'prompts'] }
  if (value === 'scanning') return { ...OFF, show: true, done: ['brand', 'prompts'], scanning: true }
  if (value === 'done') return { ...OFF, show: true, done: TASKS.map((t) => t.id) }
  return null
}

// the steps are done in order: the ticked ones are always the first few
const firstDone = (ids) => { const n = TASKS.findIndex((t) => !ids.includes(t.id)); return TASKS.slice(0, n < 0 ? TASKS.length : n).map((t) => t.id) }

// what was saved → a whole state (unknown ids and missing fields are dropped / filled)
export function restore(saved) {
  if (!saved || typeof saved !== 'object') return { ...OFF }
  return {
    show: Boolean(saved.show),
    welcome: Boolean(saved.welcome),
    done: Array.isArray(saved.done) ? firstDone(saved.done) : [],
    hints: saved.hints !== false,
    scanning: Boolean(saved.scanning),
    closed: Boolean(saved.closed),
  }
}

export const isDone = (state, id) => state.done.includes(id)
export const doneCount = (state) => TASKS.filter((t) => isDone(state, t.id)).length
export const allDone = (state) => doneCount(state) === TASKS.length
// the current step: the first one not ticked (null when all six are)
export const currentTask = (state) => TASKS.find((t) => !isDone(state, t.id)) ?? null
// a step that needs results waits while the first scan runs
export const isWaiting = (state, task) => Boolean(state.scanning && task.results && !isDone(state, task.id))
// 'done' | 'current' (open, with Start) | 'waiting' (on the first scan) | 'later'
export function taskStatus(state, task) {
  if (isDone(state, task.id)) return 'done'
  if (isWaiting(state, task)) return 'waiting'
  return currentTask(state)?.id === task.id ? 'current' : 'later'
}
// the step that can be started now (null: all done, or the current one is waiting)
export const nextTask = (state) => { const t = currentTask(state); return t && !isWaiting(state, t) ? t : null }
// the collapsed card's line under its bar
export const nextLine = (state) => (allDone(state) ? 'All six steps done' : nextTask(state) ? `Next: ${nextTask(state).title}` : WAITING)

// tick a step: only the current one, and not while it waits (the same state back when there is nothing to tick)
export function complete(state, id) {
  if (nextTask(state)?.id !== id) return state
  return { ...state, done: [...state.done, id] }
}
const tickIf = (state, test) => { const t = state.show && !state.closed ? nextTask(state) : null; return t && test(t) ? complete(state, t.id) : state }
// a page was opened: the current step ticks if opening its page is all it asks (See where you stand)
export const visit = (state, path) => tickIf(state, (t) => t.how === 'open' && t.href === path)
// a page's pointers were finished (the last Next, not Skip): the current step ticks if that is what it asks
export const tourDone = (state, tour) => tickIf(state, (t) => t.how === 'tour' && t.tour === tour)
// the step a page shows its demo "Mark as done" for
export const demoTask = (state, path) => { const t = state.show && !state.closed ? nextTask(state) : null; return t && t.how === 'demo' && t.href === path ? t : null }

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

// The lit area: a hole in the dim layer around the element, `pad` px bigger on each side. It never touches a
// neighbour: where the gap to one is smaller than the padding, that side's padding shrinks to leave 1px between them.
// target / neighbours: { left, top, width, height }. maxHeight: light only the top of a tall element.
export function fitHole(target, neighbours = [], pad = 4, maxHeight = null) {
  const t = { ...target, height: maxHeight ? Math.min(target.height, maxHeight) : target.height }
  const r = t.left + t.width, b = t.top + t.height
  const side = { left: pad, right: pad, top: pad, bottom: pad }
  const shrink = (k, gap) => { if (gap >= 0) side[k] = Math.min(side[k], Math.max(0, Math.floor(gap) - 1)) }
  for (const n of neighbours) {
    const nr = n.left + n.width, nb = n.top + n.height
    const besideX = n.left < r + pad && nr > t.left - pad // shares some of the width (with the padding on)
    const besideY = n.top < b + pad && nb > t.top - pad
    if (besideX && n.top >= b) shrink('bottom', n.top - b)
    if (besideX && nb <= t.top) shrink('top', t.top - nb)
    if (besideY && n.left >= r) shrink('right', n.left - r)
    if (besideY && nr <= t.left) shrink('left', t.left - nr)
  }
  return { left: t.left - side.left, top: t.top - side.top, width: t.width + side.left + side.right, height: t.height + side.top + side.bottom }
}

// Where a pointer's card goes: beside the lit area, never over it when a side has room, with a small caret on the
// side facing it. hole / card: { left, top, width, height } (card: width and height only); view: { width, height }.
// The caret's tip is `gap` px from the lit area and sits on its middle (kept `inset` px off the card's corners); the
// card is centred on that middle too, and kept `edge` px inside the window. Tries the preferred side, then bottom,
// top, right, left. When no side has room (an area nearly as big as the window) it takes the side with the most
// space and stays inside the window.
// → { side, left, top, caret } · caret: its centre along the card's facing edge, from the card's top (left / right)
// or left (top / bottom)
export const CARET = 7 // how far the caret sticks out of the card
export function placeCard(hole, card, view, prefer = 'bottom', gap = 12, edge = 12, inset = 18) {
  const off = gap + CARET
  const midX = hole.left + hole.width / 2, midY = hole.top + hole.height / 2
  const clampX = (x) => Math.min(Math.max(edge, x), Math.max(edge, view.width - card.width - edge))
  const clampY = (y) => Math.min(Math.max(edge, y), Math.max(edge, view.height - card.height - edge))
  const at = {
    right: { left: hole.left + hole.width + off, top: clampY(midY - card.height / 2) },
    left: { left: hole.left - off - card.width, top: clampY(midY - card.height / 2) },
    bottom: { left: clampX(midX - card.width / 2), top: hole.top + hole.height + off },
    top: { left: clampX(midX - card.width / 2), top: hole.top - off - card.height },
  }
  const room = {
    right: view.width - (hole.left + hole.width) - off - edge - card.width,
    left: hole.left - off - edge - card.width,
    bottom: view.height - (hole.top + hole.height) - off - edge - card.height,
    top: hole.top - off - edge - card.height,
  }
  const order = [prefer, 'bottom', 'top', 'right', 'left'].filter((s, i, a) => at[s] && a.indexOf(s) === i)
  const side = order.find((s) => room[s] >= 0) ?? order.slice().sort((a, b) => room[b] - room[a])[0]
  const left = Math.round(clampX(at[side].left)), top = Math.round(clampY(at[side].top))
  const along = side === 'left' || side === 'right' ? [midY - top, card.height] : [midX - left, card.width]
  return { side, left, top, caret: Math.round(Math.min(Math.max(inset, along[0]), along[1] - inset)) }
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
