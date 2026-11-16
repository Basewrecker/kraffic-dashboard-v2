import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LINE, MAX_LINES, pageFit, textHeight } from './composer.js'

test('an empty box is one line, whatever the placeholder measures', () => {
  // the bug: measured while the dock was 0px wide, the wrapped placeholder locked the box at 200px
  assert.deepEqual(textHeight('', 200), { height: LINE, scroll: false })
})

test('the text grows with its lines, then stops at 8 and scrolls inside', () => {
  assert.deepEqual(textHeight('one line', 24), { height: 24, scroll: false })
  assert.deepEqual(textHeight('three\nlines\nhere', 72), { height: 72, scroll: false })
  assert.deepEqual(textHeight('x', LINE * MAX_LINES), { height: 192, scroll: false })
  assert.deepEqual(textHeight('ten lines', 240), { height: 192, scroll: true })
})

test('the thread page is exactly the visible viewport below its top, so the window itself never scrolls', () => {
  // the bug: the window scrolled, and the box moved with the report. Now: 900 tall, the page starts 32 down and pads 40 below
  assert.deepEqual(pageFit(900, 32, 40), { height: 868, marginBottom: -40 })
  // the phone keyboard open: the visible viewport shrinks, and so does the page (the box stays above the keyboard)
  assert.deepEqual(pageFit(508, 88, 40), { height: 420, marginBottom: -40 })
  assert.equal(pageFit(50, 88).height, 0)
})
