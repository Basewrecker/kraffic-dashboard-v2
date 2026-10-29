import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TODAY, parseDay, schedules } from './reports.js'
import { emailStats, cadenceLabel, cadenceSentence, daysBetween, fmtDay, initials, nextSend, nextUp, parseCadence, peopleLabel, relDays, scheduleRow, sendsBetween, timeline } from './schedules.js'

const day = (d) => `${d.getMonth() + 1}/${d.getDate()}`

test('cadences are read the way the data writes them', () => {
  assert.deepEqual(parseCadence('Mondays 9am'), { every: 'week', weekday: 1, time: '9am' })
  assert.deepEqual(parseCadence('Every other Friday 10am'), { every: '2weeks', weekday: 5, time: '10am' })
  assert.deepEqual(parseCadence('1st of the month 8am'), { every: 'month', monthDay: 1, time: '8am' })
  assert.equal(parseCadence('whenever'), null)
  assert.equal(cadenceLabel('Mondays 9am'), 'Every Monday · 9am')
  assert.equal(cadenceLabel('1st of the month 8am'), '1st of each month · 8am')
  assert.equal(cadenceSentence('Every other Friday 10am'), 'every other Friday at 10am')
})

test('the next send matches the next date each schedule keeps in the data', () => {
  for (const s of schedules) assert.equal(day(nextSend(s, TODAY)), day(parseDay(s.next)), s.id)
})

test('a send on today counts; weekly, fortnightly and monthly repeat on their own step', () => {
  const mon = { cadence: 'Mondays 9am' }
  assert.deepEqual(sendsBetween(mon, new Date(2026, 10, 2), 14).map(day), ['11/2', '11/9', '11/16'])
  const fort = { cadence: 'Every other Friday 10am', next: 'Nov 6' }
  assert.deepEqual(sendsBetween(fort, TODAY, 30).map(day), ['11/6', '11/20'])
  assert.deepEqual(sendsBetween(fort, new Date(2026, 10, 7), 14).map(day), ['11/20'])
  const month = { cadence: '1st of the month 8am' }
  assert.deepEqual(sendsBetween(month, TODAY, 40).map(day), ['11/1', '12/1'])
})

test('the 14-day timeline: 15 ticks from today, weekends marked, paused schedules left out', () => {
  const t = timeline(schedules, TODAY, 14)
  assert.equal(t.ticks.length, 15)
  assert.equal(t.ticks[0].today, true)
  assert.equal(day(t.ticks[14].date), '11/11')
  assert.deepEqual(t.ticks.filter((x) => x.weekend).map((x) => day(x.date)), ['10/31', '11/1', '11/7', '11/8'])
  assert.deepEqual(t.ticks.filter((x) => x.monthStart).map((x) => day(x.date)), ['10/28', '11/1'])
  // FOA weekly ×2, FOA CEO, Dermasuri weekly ×2, Dermasuri client update
  assert.equal(t.items.length, 6)
  assert.equal(t.items[0].label, 'CEO summary · Finance of America · Sun 8am · 1 person')
  const paused = timeline(schedules.map((s) => ({ ...s, paused: s.id === 's-foa-week' })), TODAY, 14)
  assert.equal(paused.items.length, 4)
})

test('next up skips paused schedules', () => {
  const n = nextUp(schedules)
  assert.equal(n.s.id, 's-foa-ceo')
  assert.equal(n.inDays, 4)
  const n2 = nextUp(schedules.map((s) => ({ ...s, paused: s.id === 's-foa-ceo' })))
  assert.equal(day(n2.date), '11/2')
  assert.equal(nextUp([]), null)
})

test('a row: the last report sent, the earlier ones, at most 8 verdict dots oldest first', () => {
  const r = scheduleRow(schedules[0])
  assert.ok(r.last.headline)
  assert.deepEqual(r.dots.map((x) => x.id), [r.last, ...r.past].slice(0, 8).reverse().map((x) => x.id))
  assert.ok(r.dots.length <= 8)
  assert.equal(r.inDays, daysBetween(TODAY, parseDay(schedules[0].next)))
  assert.equal(scheduleRow({ ...schedules[0], paused: true }).next, null)
})

test('small words', () => {
  assert.equal(initials('Dana Wells'), 'DW')
  assert.equal(initials('Ana Maria Ruiz'), 'AR')
  assert.equal(initials('mia.chen@dermasuri.com'), 'MC')
  assert.equal(initials(''), '?')
  assert.equal(relDays(0), 'today')
  assert.equal(relDays(1), 'tomorrow')
  assert.equal(relDays(5), 'in 5 days')
  assert.equal(peopleLabel(1), '1 person')
  assert.equal(peopleLabel(3), '3 people')
  assert.equal(fmtDay(new Date(2026, 10, 2)), 'Mon, Nov 2')
})

test('the email leaves out a key number the hero visual already shows', () => {
  const stats = [{ id: 'score', value: 70 }, { id: 'named', value: 111 }, { id: 'sov', value: 73, unit: '%' }]
  assert.deepEqual(emailStats(stats, { kind: 'scoreLine', series: [64, 66, 70] }).map((x) => x.id), ['named', 'sov'])
  assert.deepEqual(emailStats(stats, { kind: 'lead', lead: 12, you: { series: [70, 73] } }).map((x) => x.id), ['score', 'named'])
  assert.equal(emailStats(stats, { kind: 'strip', won: 6, held: 65 }).length, 3)
})
