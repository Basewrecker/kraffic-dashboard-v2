import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addMonths, daysLeftParts, daysUntil, money, period, shortDate } from './format.js'

test('money: comma, no cents when whole, two decimals otherwise, a gap when missing', () => {
  assert.equal(money(3500), '$3,500')
  assert.equal(money(49.5), '$49.50')
  assert.equal(money(0), '$0')
  assert.equal(money(null), '—')
})
test('dates: short month and day, the year only when it is not this year', () => {
  assert.equal(shortDate('2026-12-27', '2026-11-27'), 'Dec 27')
  assert.equal(shortDate('2027-01-10', '2026-11-27'), 'Jan 10, 2027')
  assert.equal(shortDate(null), '—')
  assert.equal(period('2026-11-27', '2026-12-27', '2026-11-27'), 'Nov 27 – Dec 27')
  assert.equal(addMonths('2026-11-27', 1), '2026-12-27')
})
test('days left: whole days, never negative, "today" on the last day', () => {
  assert.equal(daysUntil('2026-12-08', '2026-11-27'), 11)
  assert.equal(daysUntil('2026-11-20', '2026-11-27'), 0)
  assert.deepEqual(daysLeftParts(11), { before: '', bold: '11', after: ' days left to pay' })
  assert.deepEqual(daysLeftParts(1), { before: '', bold: '1', after: ' day left to pay' })
  assert.deepEqual(daysLeftParts(0), { before: 'Pay ', bold: 'today', after: ' to keep your plan' })
})
