import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALL_DONE, OFF, TASKS, TOURS, WELCOME, allDone, complete, doneCount, fill, fresh, fromParam, keyAction, move, nextTask, overlaps, placeCard, restore, sheetSide, taskStatus, tourForPath, union, visit } from './tour.js'

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
  assert.equal(tourForPath('/overview'), 'overview')
  assert.equal(tourForPath('/tracker'), null)
})

test('?walkthrough= states', () => {
  assert.deepEqual(fromParam('new'), { ...OFF, show: true, welcome: true })
  assert.deepEqual(fromParam('reset'), OFF)
  assert.equal(doneCount(fromParam('progress')), 2)
  assert.equal(fromParam('scanning').scanning, true)
  assert.ok(allDone(fromParam('done')))
  assert.equal(fromParam('nonsense'), null)
  assert.equal(fromParam(null), null)
})

test('saved progress is read back whole, whatever was stored', () => {
  assert.deepEqual(restore(null), OFF)
  assert.deepEqual(restore('x'), OFF)
  assert.deepEqual(restore({ show: 1, done: ['prompts', 'gone', 'brand'] }), { ...OFF, show: true, done: ['brand', 'prompts'] })
  assert.equal(restore({ hints: false }).hints, false)
})

test('tasks tick in any order; the next task is the first one left', () => {
  let s = fresh()
  assert.equal(nextTask(s).id, 'brand')
  s = complete(s, 'prompts')
  assert.deepEqual(s.done, ['prompts'])
  assert.equal(nextTask(s).id, 'brand')
  assert.deepEqual(TASKS.map((t) => taskStatus(s, t)), ['next', 'done', 'todo', 'todo', 'todo', 'todo'])
  s = complete(s, 'brand')
  assert.deepEqual(s.done, ['brand', 'prompts'])
  assert.equal(nextTask(s).id, 'results')
  assert.equal(complete(s, 'brand'), s) // already ticked: nothing changes
  assert.equal(complete(s, 'nope'), s)
})

test('while the first scan runs, the tasks that need results wait and cannot tick', () => {
  const s = fromParam('scanning')
  assert.deepEqual(TASKS.map((t) => taskStatus(s, t)), ['done', 'done', 'waiting', 'waiting', 'waiting', 'waiting'])
  assert.equal(nextTask(s), null)
  assert.equal(complete(s, 'results'), s)
  assert.equal(visit(s, '/overview'), s)
})

test('opening a page ticks its task; Brand Setup waits for Save', () => {
  const s = { ...fresh(), welcome: false }
  assert.equal(visit(s, '/brands'), s)
  assert.deepEqual(visit(s, '/tracker').done, ['prompts'])
  assert.deepEqual(visit(s, '/overview').done, ['results'])
  // two tasks share Content: the first open one ticks, then the other
  const one = visit(s, '/opportunities/content')
  assert.deepEqual(one.done, ['content'])
  assert.deepEqual(visit(one, '/opportunities/content').done, ['content', 'outreach'])
  // hidden or closed: nothing ticks
  assert.equal(visit(OFF, '/tracker'), OFF)
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

test('the card sits beside the lit box and never over it when a side has room', () => {
  const view = { width: 1440, height: 900 }, card = { width: 300, height: 150 }
  // a sidebar group: to its right
  const nav = { left: 12, top: 80, width: 208, height: 150 }
  const a = placeCard(nav, card, view, 'right')
  assert.equal(a.side, 'right')
  assert.ok(!overlaps({ ...card, ...a }, nav))
  // a KPI card: under it
  const kpi = { left: 256, top: 120, width: 280, height: 150 }
  const b = placeCard(kpi, card, view, 'bottom')
  assert.equal(b.side, 'bottom')
  assert.ok(!overlaps({ ...card, ...b }, kpi))
  // no room under a box at the bottom of the window: another side, still not over it
  const low = { left: 400, top: 700, width: 600, height: 180 }
  const c = placeCard(low, card, view, 'bottom')
  assert.notEqual(c.side, 'bottom')
  assert.ok(!overlaps({ ...card, ...c }, low))
  // always inside the window
  for (const p of [a, b, c]) assert.ok(p.left >= 12 && p.top >= 12 && p.left + card.width <= view.width - 12 && p.top + card.height <= view.height - 12)
  // a box that fills the window: the card stays inside the window
  const d = placeCard({ left: 0, top: 0, width: 1440, height: 900 }, card, view, 'bottom')
  assert.ok(d.left >= 12 && d.top >= 12 && d.top + card.height <= 888)
})

test('phones: the sheet is at the bottom, at the top when the lit box is down there', () => {
  assert.equal(sheetSide({ top: 100, height: 120 }, 180, 844), 'bottom')
  assert.equal(sheetSide({ top: 700, height: 60 }, 180, 844), 'top')
})

test('several boxes are lit as one', () => {
  assert.deepEqual(union([{ left: 10, top: 10, width: 100, height: 50 }, { left: 130, top: 10, width: 100, height: 60 }]), { left: 10, top: 10, width: 220, height: 60 })
  assert.equal(union([]), null)
})
