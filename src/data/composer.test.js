import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LINE, MAX_LINES, dockSpace, textHeight } from './composer.js'

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

test('the thread keeps 32px clear above the fixed box; ↓ sits 12px above it', () => {
  // box 104 tall, 16 from the bottom; the page already pads 40 below its content
  assert.deepEqual(dockSpace(104, 40), { pad: 112, down: 132 })
  assert.equal(dockSpace(104, 400).pad, 0)
})
