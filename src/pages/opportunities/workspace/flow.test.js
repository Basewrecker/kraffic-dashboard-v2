// Opportunities → Content workspace helpers (flow.js). Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { barPct, dataSummary, fileKind, fileSize, sparkPoints, startOf, startTarget } from './flow.js'

test('startOf: no draft opens step 1 until Search Console is connected', () => {
  assert.deepEqual(startOf(null, 'new'), { current: 0, ready: false })
  assert.deepEqual(startOf(null, 'declined'), { current: 0, ready: false })
  assert.deepEqual(startOf(null, 'connected'), { current: 1, ready: false })
})

test('startOf: a written draft opens step 4, anything later step 5', () => {
  assert.deepEqual(startOf({ stage: 'draft' }, 'new'), { current: 3, ready: true })
  for (const stage of ['waiting', 'monitoring', 'improved', 'nochange']) assert.equal(startOf({ stage }, 'connected').current, 4)
})

test('startTarget: draft page, then best candidate, then a new page', () => {
  const pathOf = (u) => new URL(u).pathname
  const np = { slug: '/guides/new' }
  assert.deepEqual(startTarget({ target_url: 'https://a.example/x', action: 'update' }, [], np, pathOf), { kind: 'page', url: 'https://a.example/x' })
  assert.deepEqual(startTarget({ target_url: 'https://a.example/y', action: 'create' }, [], np, pathOf), { kind: 'new', slug: '/y' })
  assert.deepEqual(startTarget(null, [{ url: 'u1' }, { url: 'u2' }], np, pathOf), { kind: 'page', url: 'u1' })
  assert.deepEqual(startTarget(null, [], np, pathOf), { kind: 'new', slug: '/guides/new' })
})

test('barPct: one shared scale, small rows stay visible', () => {
  assert.equal(barPct(100, 100), 100)
  assert.equal(barPct(50, 100), 50)
  assert.equal(barPct(1, 1000), 2)
  assert.equal(barPct(0, 100), 0)
  assert.equal(barPct(5, 0), 0)
})

test('sparkPoints: fits the box, flat data in the middle', () => {
  const pts = sparkPoints([0, 10], 24, 8, 1).split(' ')
  assert.deepEqual(pts, ['1,7', '23,1'])
  assert.deepEqual(sparkPoints([3, 3, 3], 24, 8, 1).split(' ').map((p) => p.split(',')[1]), ['4', '4', '4'])
  assert.equal(sparkPoints([]), '')
})

test('dataSummary', () => {
  const q = (answer) => ({ answer })
  assert.equal(dataSummary({ uploads: [], facts: [], questions: [q('')], pasted: '' }), null)
  assert.equal(dataSummary({ uploads: [{}, {}], facts: [{ label: 'a', value: 'b' }, { label: 'c', value: '' }], questions: [q('x'), q(''), q('')], pasted: ' hi ' }),
    '2 files · pasted text · 1 fact · 1 of 3 answered')
})

test('fileKind and fileSize', () => {
  assert.equal(fileKind('a.PDF'), 'pdf')
  assert.equal(fileKind('b.docx'), 'docx')
  assert.equal(fileKind('c.csv'), 'csv')
  assert.equal(fileKind('d.jpeg'), 'image')
  assert.equal(fileSize(800), '800 B')
  assert.equal(fileSize(8 * 1024), '8 KB')
  assert.equal(fileSize(1.25 * 1024 * 1024), '1.3 MB')
})

import { compactNum, engineVerdicts, stepValue } from './flow.js'

test('compactNum: thousands as k, one decimal under 10k', () => {
  assert.equal(compactNum(940), '940')
  assert.equal(compactNum(4210), '4.2k')
  assert.equal(compactNum(1000), '1k')
  assert.equal(compactNum(12400), '12k')
})

test('engineVerdicts: named where not missing; else the first other brand seen on that engine', () => {
  const row = { platforms: ['google', 'claude'], brandsMentioned: [{ domain: 'me.com', platforms: ['google'] }, { domain: 'cerave.com', platforms: ['claude'] }, { domain: 'theordinary.com', platforms: ['google', 'claude'] }] }
  assert.deepEqual(engineVerdicts(row, ['google', 'chatgpt', 'gemini', 'claude'], 'me.com'), [
    { engine: 'google', named: false, first: 'theordinary.com' },
    { engine: 'chatgpt', named: true, first: null },
    { engine: 'gemini', named: true, first: null },
    { engine: 'claude', named: false, first: 'cerave.com' },
  ])
  assert.deepEqual(engineVerdicts({ platforms: ['gemini'], brandsMentioned: [] }, ['gemini'], 'me.com'), [{ engine: 'gemini', named: false, first: null }])
})

test('stepValue: what each finished step chose', () => {
  const base = { gsc: 'connected', gscDomain: 'dermasuri.com', target: { kind: 'page', path: '/blog/x' }, data: { uploads: [], facts: [], questions: [], pasted: '' }, dataSkipped: false, draft: null }
  assert.equal(stepValue(0, base), 'dermasuri.com')
  assert.equal(stepValue(0, { ...base, gsc: 'skipped' }), 'Not connected')
  assert.equal(stepValue(1, base), '/blog/x')
  assert.equal(stepValue(1, { ...base, target: { kind: 'new', slug: '/guides/y' } }), 'New: /guides/y')
  assert.equal(stepValue(2, base), 'Skipped')
  assert.equal(stepValue(2, { ...base, data: { ...base.data, uploads: [{}] } }), '1 file')
  assert.equal(stepValue(3, { ...base, draft: { stage: 'waiting' } }), 'Copied')
})

import { niceStep } from './flow.js'

test('niceStep: round steps (1, 2, 2.5, 5 × 10^n), at most 4 to clear the tallest column', () => {
  assert.equal(niceStep(2250), 1000)
  assert.equal(niceStep(1900), 500)
  assert.equal(niceStep(380), 100)
  assert.equal(niceStep(9100), 2500)
  for (const m of [7, 95, 1234, 56789]) assert.ok(Math.ceil(m / niceStep(m)) <= 4)
})

import { exitAfter, inFocus, startExited } from './flow.js'

test('focus mode: on for steps 3–5 (index 2–4) unless exited on that step; a step change clears the exit', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((o) => inFocus(o, null)), [false, false, true, true, true])
  assert.equal(inFocus(2, 2), false) // exited on step 3: the page view
  // Use this page (1 → 2), Skip to draft (1 → 3), a pill back to 2 (→ 1 closes), Exit then a pill to 4 (re-opens)
  assert.equal(inFocus(2, exitAfter(1, 2, null)), true)
  assert.equal(inFocus(3, exitAfter(1, 3, null)), true)
  assert.equal(inFocus(1, exitAfter(3, 1, null)), false)
  assert.equal(inFocus(3, exitAfter(2, 3, 2)), true)
  assert.equal(exitAfter(3, 3, 3), 3) // same step: still exited
})

test('focus mode on load: a draft-ready or copied prompt opens in focus; a published one opens on the page', () => {
  assert.equal(inFocus(3, startExited({ stage: 'draft' }, 3)), true)
  assert.equal(inFocus(4, startExited({ stage: 'waiting' }, 4)), true)
  for (const stage of ['monitoring', 'improved', 'nochange']) assert.equal(inFocus(4, startExited({ stage }, 4)), false)
  assert.equal(inFocus(0, startExited(null, 0)), false)
})

import { resumeState } from './flow.js'

test('resumeState: the page bar says what step 3–5 is doing, live', () => {
  const data = { uploads: [], facts: [], questions: [{ answer: 'x' }, { answer: '' }, { answer: '' }], pasted: '' }
  assert.equal(resumeState({ open: 2, data }).line, '1 of 3 answered')
  const rows = (s) => s.split('').map((c) => ({ status: { d: 'done', c: 'current', u: 'upcoming', f: 'failed' }[c] }))
  const steps = ['A', 'B', 'C', 'D', 'E'].map((label) => ({ label }))
  const w = resumeState({ open: 3, phase: 'generating', gen: { rows: rows('dddcu'), failed: false }, steps })
  assert.deepEqual(w, { kind: 'writing', headline: 'Writing the draft…', line: '4 of 5 · D', busy: true })
  assert.equal(resumeState({ open: 3, phase: 'generating', gen: { rows: rows('dddfu'), failed: true }, steps }).kind, 'failed')
  assert.equal(resumeState({ open: 3, phase: 'draft', flags: [{ resolved: true }, { resolved: false }, { resolved: false }, { resolved: false }] }).headline, 'Draft ready · 3 flags to resolve')
  assert.equal(resumeState({ open: 4, stage: 'waiting', path: '/x' }).headline, 'Waiting for you to publish')
  assert.equal(resumeState({ open: 4, stage: 'monitoring', week: 2, path: '/x' }).line, '/x · week 2 of 4')
})

import { FACTS, UPLOADS, factsFound } from '../../../data/contentOpportunities-proposed.js'

test('Your data sample: each file row\'s "Read · n facts" = its suggestions; "Add all n" = the total offered', () => {
  const data = { uploads: UPLOADS, facts: FACTS, dismissed: [] }
  const all = suggestionsFor(data, factsFound, 1e9, 1000)
  for (const u of UPLOADS) assert.equal(all.filter((s) => s.key.startsWith(`${u.id}:`)).length, factsFound(u).n, u.name)
  assert.equal(all.length, UPLOADS.reduce((a, u) => a + factsFound(u).n, 0))
})

import { dataTasks, suggestionsFor, uploadState } from './flow.js'

test('Your data tasks: uploads read for a second, their facts become suggestions, each task knows when it is done', () => {
  assert.deepEqual(uploadState({ addedAt: 1000 }, 1500, 1000), { reading: true, frac: 0.5 })
  assert.deepEqual(uploadState({ addedAt: 0 }, 5000, 1000), { reading: false, frac: 1 })
  const found = (f) => ({ n: 2, suggestions: [{ label: 'Size', value: '30 ml', from: f.name, key: `${f.id}:Size` }, { label: 'pH', value: '5.5', from: f.name, key: `${f.id}:pH` }] })
  const uploads = [{ id: 'a', name: 'a.pdf', addedAt: 0 }, { id: 'b', name: 'b.csv', addedAt: 4900 }]
  // b is still reading; "pH" is already a fact; a's Size is offered once
  assert.deepEqual(suggestionsFor({ uploads, facts: [{ label: 'ph', value: '5' }] }, found, 5000, 1000).map((s) => s.key), ['a:Size'])
  assert.deepEqual(suggestionsFor({ uploads, facts: [], dismissed: ['a:Size'] }, found, 5000, 1000).map((s) => s.key), ['a:pH'])
  const empty = { uploads: [], facts: [], questions: [{ answer: '' }], pasted: '' }
  assert.deepEqual(dataTasks(empty), [false, false, false])
  assert.deepEqual(dataTasks({ ...empty, pasted: 'x', facts: [{ label: 'a', value: 'b' }], questions: [{ answer: 'y' }] }), [true, true, true])
})

import { nextVisible, stepPos, stepsFor } from './flow.js'

test('v1 steps: Target page → Your data → Draft → Copy & publish; ?backend=full: all five', () => {
  const v1 = stepsFor(false)
  assert.deepEqual(v1.map((s) => [s.i, s.title]), [[1, 'Target page'], [2, 'Your data'], [3, 'Draft'], [4, 'Copy & publish']])
  assert.equal(nextVisible(v1, 1), 2)
  assert.equal(nextVisible(v1, 2), 3)
  assert.equal(nextVisible(v1, 3), 4)
  assert.equal(nextVisible(v1, 4), 4)
  assert.deepEqual(stepPos(v1, 2), { n: 2, of: 4 })
  assert.deepEqual(stepPos(v1, 3), { n: 3, of: 4 })
  // Your data opens in the focus panel like the Draft (index 2 ≥ FOCUS_FROM)
  assert.equal(inFocus(2, null), true)
  const full = stepsFor(true)
  assert.equal(full.length, 5)
  assert.deepEqual(full.map((s) => s.id), ['connect', 'target', 'data', 'draft', 'publish'])
  assert.equal(nextVisible(full, 0), 1)
  assert.equal(nextVisible(full, 1), 2)
  assert.deepEqual(stepPos(full, 3), { n: 4, of: 5 })
})

import { backLabel } from './flow.js'

test('"Back to step n" counts the visible steps (v1: Draft is step 3 of 4; full: step 4 of 5)', () => {
  assert.equal(backLabel(stepsFor(false), 3), 'Back to step 3')
  assert.equal(backLabel(stepsFor(false), 4), 'Back to step 4')
  assert.equal(backLabel(stepsFor(true), 3), 'Back to step 4')
})
