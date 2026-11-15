import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALL_DONE, CARET, OFF, TASKS, TOURS, WELCOME, allDone, complete, currentTask, demoTask, doneCount, fill, fitHole, fresh, fromParam, keyAction, move, nextLine, nextTask, overlaps, placeCard, restore, sheetSide, taskStatus, tourDone, tourForPath, union, visit } from './tour.js'
import { bezier, ease } from './motion.js'

const on = { ...fresh(), welcome: false }
const after = (...ids) => ids.reduce((s, id) => complete(s, id), on)

test('the words are the ones asked for, with the names filled in', () => {
  assert.equal(fill(WELCOME.title, { brand: 'Dermasuri' }), 'Welcome to Kraffic')
  assert.equal(fill(WELCOME.text, { brand: 'Dermasuri' }), 'Let’s get Dermasuri set up. It takes about five minutes. We’ll show you where things are and what to do first.')
  assert.equal(fill(ALL_DONE), 'You’re set up. Kraffic keeps checking AI for you. Come back each week to see what changed.')
  assert.deepEqual([TOURS.orientation.steps.length, TOURS['brand-setup'].steps.length, TOURS.overview.steps.length], [5, 4, 4])
  assert.equal(TASKS.length, 6)
  // no text is left with a blank to fill
  const texts = Object.values(TOURS).flatMap((t) => t.steps.map((s) => fill(s.text, { brand: 'Dermasuri' })))
  assert.ok(texts.every((t) => !/[{}]/.test(t)))
})

test('each page with pointers is found by its path', () => {
  assert.equal(tourForPath('/brands'), 'brand-setup')
  assert.equal(tourForPath('/tracker'), 'prompt-hub')
  assert.equal(tourForPath('/overview'), 'overview')
  assert.equal(tourForPath('/sentiment'), 'sentiment')
  assert.equal(TOURS.sentiment.steps.length, 4)
  assert.equal(TOURS.sentiment.steps[3].target, '.k-mo-btn') // the Opportunities button is the fourth
  assert.equal(tourForPath('/team'), null)
})

test('?walkthrough= states', () => {
  assert.deepEqual(fromParam('new'), { ...OFF, show: true, welcome: true })
  assert.deepEqual(fromParam('slow'), fromParam('new')) // the same run, in slow motion
  assert.deepEqual(fromParam('reset'), OFF)
  assert.equal(doneCount(fromParam('progress')), 2)
  assert.equal(fromParam('scanning').scanning, true)
  assert.ok(allDone(fromParam('done')))
  assert.equal(fromParam('nonsense'), null)
  assert.equal(fromParam(null), null)
})

test('saved progress is read back whole; the ticked steps are always the first few', () => {
  assert.deepEqual(restore(null), OFF)
  assert.deepEqual(restore('x'), OFF)
  assert.deepEqual(restore({ show: 1, done: ['prompts', 'gone', 'brand'] }), { ...OFF, show: true, done: ['brand', 'prompts'] })
  assert.deepEqual(restore({ done: ['prompts', 'results'] }).done, []) // step 1 isn't ticked: nothing after it counts
  assert.equal(restore({ hints: false }).hints, false)
})

test('steps are done in order: only the current one ticks', () => {
  assert.equal(currentTask(on).id, 'brand')
  assert.equal(complete(on, 'prompts'), on) // not its turn
  const one = complete(on, 'brand')
  assert.deepEqual(one.done, ['brand'])
  assert.deepEqual(TASKS.map((t) => taskStatus(one, t)), ['done', 'current', 'later', 'later', 'later', 'later'])
  assert.equal(complete(one, 'brand'), one) // already ticked
  assert.equal(complete(one, 'nope'), one)
  assert.equal(nextLine(on), 'Next: Confirm your brand and competitors')
  assert.equal(nextLine(one), 'Next: Review the prompts we track')
  assert.equal(nextLine(fromParam('done')), 'All six steps done')
})

test('how each step ticks: Save, the pointers finished, the page opened, the demo action', () => {
  // 1: Save only (opening Brand Setup or finishing its pointers doesn't tick it)
  assert.equal(visit(on, '/brands'), on)
  assert.equal(tourDone(on, 'brand-setup'), on)
  // 2: Prompt Hub's pointers finished (opening the page doesn't)
  const one = after('brand')
  assert.equal(visit(one, '/tracker'), one)
  assert.equal(tourDone(one, 'overview'), one)
  assert.deepEqual(tourDone(one, 'prompt-hub').done, ['brand', 'prompts'])
  // 3: Visibility Overview opened, once it is the current step
  assert.equal(visit(one, '/overview'), one)
  const two = after('brand', 'prompts')
  assert.deepEqual(visit(two, '/overview').done, ['brand', 'prompts', 'results'])
  // 4 to 6: a demo action on their page, one step at a time (4 and 6 are both on Sentiment)
  const three = after('brand', 'prompts', 'results')
  assert.equal(demoTask(three, '/sentiment').id, 'tone')
  assert.equal(demoTask(three, '/opportunities/content'), null)
  assert.equal(demoTask(after('brand', 'prompts', 'results', 'tone'), '/opportunities/content').id, 'content')
  assert.equal(demoTask(after('brand', 'prompts', 'results', 'tone', 'content'), '/sentiment').id, 'outreach')
  assert.equal(demoTask(after('brand', 'prompts', 'results', 'tone', 'content'), '/opportunities/content'), null)
  assert.ok(allDone(after('brand', 'prompts', 'results', 'tone', 'content', 'outreach')))
  // hidden: nothing ticks
  assert.equal(visit({ ...two, show: false }, '/overview').done.length, 2)
})

test('while the first scan runs, the steps that need results wait and cannot tick', () => {
  const s = fromParam('scanning')
  assert.deepEqual(TASKS.map((t) => taskStatus(s, t)), ['done', 'done', 'waiting', 'waiting', 'waiting', 'waiting'])
  assert.equal(nextTask(s), null)
  assert.equal(complete(s, 'results'), s)
  assert.equal(visit(s, '/overview'), s)
  assert.equal(nextLine(s), 'Waiting for your first results')
})

test('keys: arrows and Enter move, Esc closes', () => {
  assert.equal(keyAction('ArrowRight'), 'next')
  assert.equal(keyAction('Enter'), 'next')
  assert.equal(keyAction('ArrowLeft'), 'back')
  assert.equal(keyAction('Escape'), 'close')
  assert.equal(keyAction('a'), null)
  assert.equal(move(0, 5, 'next'), 1)
  assert.equal(move(4, 5, 'next'), null) // past the last: the walkthrough ends
  assert.equal(move(0, 5, 'back'), 0)
  assert.equal(move(3, 5, 'back'), 2)
})

test('the lit area is the element plus 4px, and never touches a neighbour', () => {
  const group = { left: 12, top: 100, width: 208, height: 130 }
  // 16px to the groups above and below: the full padding
  assert.deepEqual(fitHole(group, [{ left: 12, top: 246, width: 208, height: 60 }, { left: 12, top: 20, width: 208, height: 64 }]), { left: 8, top: 96, width: 216, height: 138 })
  // 3px to the group below: that side keeps 1px clear of it
  const tight = fitHole(group, [{ left: 12, top: 233, width: 208, height: 60 }])
  assert.equal(tight.top + tight.height, 232)
  assert.equal(tight.top, 96)
  // touching already: no padding on that side
  assert.equal(fitHole(group, [{ left: 12, top: 230, width: 208, height: 60 }]).height, 134)
  // something far to the side or not in line doesn't matter
  assert.deepEqual(fitHole(group, [{ left: 400, top: 100, width: 50, height: 50 }, { left: 12, top: 600, width: 208, height: 40 }]), { left: 8, top: 96, width: 216, height: 138 })
  // a tall element: only its top is lit
  assert.equal(fitHole({ left: 0, top: 0, width: 100, height: 2000 }, [], 4, 340).height, 348)
})

test('the card sits beside the lit area with its caret on the area’s middle, 12px away', () => {
  const view = { width: 1440, height: 900 }, card = { width: 300, height: 120 }
  // a sidebar group: to its right
  const nav = { left: 8, top: 96, width: 216, height: 138 }
  const a = placeCard(nav, card, view, 'right')
  assert.equal(a.side, 'right')
  assert.equal(a.left - CARET - (nav.left + nav.width), 12) // the caret's tip
  assert.equal(a.top + a.caret, nav.top + nav.height / 2) // on the area's middle
  assert.ok(!overlaps({ ...card, ...a }, nav))
  // a group at the very top: the card can't go higher, the caret still points at the middle
  const first = { left: 8, top: 8, width: 216, height: 60 }
  const f = placeCard(first, card, view, 'right')
  assert.equal(f.top, 12)
  assert.equal(f.top + f.caret, 38)
  // a KPI card: under it, the caret on its middle
  const kpi = { left: 256, top: 120, width: 280, height: 150 }
  const b = placeCard(kpi, card, view, 'bottom')
  assert.equal(b.side, 'bottom')
  assert.equal(b.top - CARET - (kpi.top + kpi.height), 12)
  assert.equal(b.left + b.caret, kpi.left + kpi.width / 2)
  // no room under an area at the bottom of the window: another side, still not over it
  const low = { left: 400, top: 700, width: 600, height: 180 }
  const c = placeCard(low, card, view, 'bottom')
  assert.notEqual(c.side, 'bottom')
  assert.ok(!overlaps({ ...card, ...c }, low))
  // always inside the window, the caret off the card's corners
  for (const p of [a, b, c, f]) {
    assert.ok(p.left >= 12 && p.top >= 12 && p.left + card.width <= view.width - 12 && p.top + card.height <= view.height - 12)
    assert.ok(p.caret >= 18)
  }
  // an area that fills the window: the card stays inside the window
  const d = placeCard({ left: 0, top: 0, width: 1440, height: 900 }, card, view, 'bottom')
  assert.ok(d.left >= 12 && d.top >= 12 && d.top + card.height <= 888)
})

test('phones: the sheet is at the bottom, at the top when the lit area is down there', () => {
  assert.equal(sheetSide({ top: 100, height: 120 }, 180, 844), 'bottom')
  assert.equal(sheetSide({ top: 700, height: 60 }, 180, 844), 'top')
})

test('several boxes are lit as one', () => {
  assert.deepEqual(union([{ left: 10, top: 10, width: 100, height: 50 }, { left: 130, top: 10, width: 100, height: 60 }]), { left: 10, top: 10, width: 220, height: 60 })
  assert.equal(union([]), null)
})

test('the one easing: cubic-bezier(0.22, 1, 0.36, 1), fast out and settling with no overshoot', () => {
  assert.equal(ease(0), 0)
  assert.equal(ease(1), 1)
  let last = 0
  for (let i = 1; i <= 20; i++) { const v = ease(i / 20); assert.ok(v >= last && v <= 1, `rises without passing 1 (${v})`); last = v }
  assert.ok(ease(0.25) > 0.6, 'most of the way a quarter of the time in')
  assert.ok(Math.abs(bezier(0, 0, 1, 1)(0.3) - 0.3) < 0.001) // a straight line stays one
})
