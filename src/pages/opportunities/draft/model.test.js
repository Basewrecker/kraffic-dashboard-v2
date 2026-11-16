// Step 4 (Draft): markers, mention removal, flag re-check, the Markdown / HTML export, the generating progress and the
// chart's y-axis. The draft here is a small stand-in for DRAFT (contentOpportunities-proposed.js) in the same shape.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  competitorMentions, fmtSecs, genProgress, hasConfirm, niceAxis, parseMarkers, plainText, readiness, recheck, removeMention, slugify, toHtml, toMarkdown,
} from './model.js'

const NAMES = { 'lumenskin.example': 'Lumen Skin' }
const nameOf = (d) => NAMES[d] ?? d
const draft = {
  title: 'How to layer A & B',
  answer: 'Apply A first, then B.',
  keyPoints: ['They don\'t cancel out.', 'Start at 5%. [[confirm]]'],
  steps: ['Cleanse.', 'Apply A.'],
  comparison: { columns: ['Same routine', 'Split'], rows: [['Fastest', [true, false]]] },
  explanation: ['Unlike [[c:lumenskin.example]]\'s routine, this keeps it to two.', '[[c:lumenskin.example]] stacks three.'],
  example: { text: 'Score over 4 weeks. [[confirm]]', unit: 'score', series: [[0, 62], [4, 38]], xLabel: 'week' },
  faq: [['With retinol?', 'Yes, at night.']],
  sources: ['skin-review.example'],
}

test('markers parse into text, competitor and confirm segments', () => {
  assert.deepEqual(parseMarkers('Unlike [[c:lumenskin.example]]\'s routine [[confirm]]'), [
    { type: 'text', text: 'Unlike ' }, { type: 'competitor', domain: 'lumenskin.example', nth: 0 }, { type: 'text', text: '\'s routine ' }, { type: 'confirm' },
  ])
  assert.deepEqual(parseMarkers('plain'), [{ type: 'text', text: 'plain' }])
  assert.equal(hasConfirm('Start at 5%. [[confirm]]'), true)
  assert.equal(hasConfirm('Start at 5%.'), false)
  assert.equal(plainText('Unlike [[c:lumenskin.example]]\'s routine. [[confirm]]', nameOf), 'Unlike Lumen Skin\'s routine.')
})

test('removing a mention removes only that one, reads naturally and resolves the competitor flag on re-check', () => {
  assert.deepEqual(competitorMentions(draft), ['lumenskin.example', 'lumenskin.example'])
  const once = removeMention(draft, 'explanation.0', 0)
  assert.equal(once.explanation[0], 'Unlike another brand\'s routine, this keeps it to two.')
  assert.equal(once.explanation[1], draft.explanation[1])
  const flags = [{ id: 'f1', label: 'Competitor named in the draft', resolved: false }, { id: 'f2', label: 'Unverified stat', resolved: false }]
  assert.equal(recheck(flags, once)[0].resolved, false)
  const twice = removeMention(once, 'explanation.1', 0)
  assert.equal(twice.explanation[1], 'Another brand stacks three.')
  assert.deepEqual(recheck(flags, twice).map((f) => f.resolved), [true, false])
  assert.deepEqual(readiness(recheck(flags, twice)), { resolved: 1, total: 2 })
})

test('Markdown export: every section, names resolved, no markers left', () => {
  const md = toMarkdown(draft, nameOf)
  assert.ok(md.startsWith('# How to layer A & B\n\nApply A first, then B.'))
  for (const h of ['## Key points', '## Steps', '## Comparison', '## Detailed explanation', '## Worked example', '## FAQ', '## Sources']) assert.ok(md.includes(h), h)
  assert.ok(md.includes('| Fastest | ✓ | ✕ |'))
  assert.ok(md.includes('1. Cleanse.\n2. Apply A.'))
  assert.ok(md.includes('| Week | Score |') && md.includes('| 4 | 38 |'))
  assert.ok(md.includes('Lumen Skin\'s routine'))
  assert.ok(md.includes('- https://skin-review.example'))
  assert.ok(!md.includes('[['))
})

test('HTML export escapes text and has a real table', () => {
  const html = toHtml(draft, nameOf)
  assert.ok(html.includes('<h1>How to layer A &amp; B</h1>'))
  assert.ok(html.includes('<th scope="row">Fastest</th><td>✓</td><td>✕</td>'))
  assert.ok(html.includes('<li>Start at 5%.</li>'))
  assert.ok(!html.includes('[['))
  assert.equal(slugify(draft.title), 'how-to-layer-a-b')
})

test('generating progress: steps tick in order, counts rise to the total, a failure stops the rest', () => {
  const steps = [{ total: 7, ms: 1000 }, { total: 5, ms: 1000 }]
  const p0 = genProgress(steps, 500)
  assert.deepEqual(p0.rows.map((r) => r.status), ['current', 'upcoming'])
  assert.equal(p0.rows[0].n, 3)
  const p1 = genProgress(steps, 1500)
  assert.deepEqual(p1.rows.map((r) => r.status), ['done', 'current'])
  assert.equal(p1.rows[0].n, 7)
  assert.equal(genProgress(steps, 2000).done, true)
  const f = genProgress([...steps, { total: 2, ms: 500 }], 1700, 1)
  assert.deepEqual(f.rows.map((r) => r.status), ['done', 'failed', 'upcoming'])
  assert.equal(f.failed, true)
  assert.equal(f.done, false)
  assert.equal(genProgress([...steps, { total: 2, ms: 500 }], 9999, 1).failed, true)
  assert.equal(fmtSecs(1234), '1.2s')
})

test('chart axis: round steps, at most five ticks, the top past the largest value', () => {
  assert.deepEqual(niceAxis(62), { max: 80, step: 20, ticks: [0, 20, 40, 60, 80] })
  assert.deepEqual(niceAxis(40).ticks, [0, 20, 40, 60])
  assert.ok(niceAxis(3).ticks.length <= 5)
  assert.ok(niceAxis(1234).max > 1234)
})

import { genSummary, readDomains } from './model.js'

test('genSummary: the time, the pages read, the claims checked', () => {
  const steps = [{ id: 'read', total: 7, ms: 1100 }, { id: 'write', total: 8, ms: 1500 }, { id: 'claims', total: 6, ms: 900 }]
  assert.equal(genSummary(steps), 'Draft written in 3.5s · 7 pages · 6 claims checked')
  assert.equal(genSummary([{ id: 'write', total: 1, ms: 500 }]), 'Draft written in 0.5s')
})

test('readDomains: the row\'s sources, then its competitors, each once', () => {
  assert.deepEqual(readDomains({ sources: [{ domain: 'a.com' }, { domain: 'b.com' }, { domain: 'a.com' }], competitors: ['b.com', 'c.com'] }), ['a.com', 'b.com', 'c.com'])
  assert.deepEqual(readDomains(null), [])
})

import { draftSession, genElapsed, genProgress as gp } from './model.js'

test('draftSession + genElapsed: the writing clock runs from its start, whoever is watching', () => {
  const s = draftSession({ ready: false, draft: { title: 't' }, flags: [] })
  assert.equal(s.phase, 'generating')
  assert.equal(s.startedAt, null)
  assert.equal(draftSession({ ready: true, draft: {}, flags: [] }).phase, 'draft')
  assert.equal(genElapsed(null, 5000), 0)
  assert.equal(genElapsed(1000, 3500), 2500) // the panel closed at 1.2s and reopened at 2.5s: the same elapsed time
  assert.equal(genElapsed(1000, 9000, { hold: true }), 820)
  assert.equal(genElapsed(1000, 1000, { instant: true }), Infinity)
  const steps = [{ id: 'a', total: 2, ms: 1000 }, { id: 'b', total: 2, ms: 1000 }]
  assert.equal(gp(steps, genElapsed(0, 1500)).rows[0].status, 'done')
  assert.equal(gp(steps, genElapsed(0, 2100)).done, true)
})

import { toHtml as draftToHtml } from './model.js'

test('toHtml (security): hostile strings in every field, example.series included, never become HTML or script links', () => {
  const bad = '<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">z</a>'
  const draft = {
    title: bad, answer: bad, keyPoints: [bad, `[click](javascript:alert(1)) ${bad}`], steps: [bad],
    comparison: { columns: [bad, bad], rows: [[bad, [true, false]]] },
    explanation: [bad], example: { text: bad, unit: bad, xLabel: bad, series: [[bad, bad], ['<img src=x onerror=alert(1)>', '<script>x</script>']] },
    faq: [[bad, bad]], sources: ['healthline.com', 'javascript:alert(1)', 'evil.com"><script>alert(1)</script>', bad],
  }
  const html = draftToHtml(draft, (d) => d)
  assert.ok(!/<script/i.test(html), 'no raw <script')
  assert.ok(!/<img/i.test(html), 'no raw <img')
  assert.ok(!/href="javascript/i.test(html), 'no javascript: href')
  assert.ok(!/<[^>]+\son\w+=/i.test(html), 'no on* attribute inside a tag')
  for (const href of html.match(/href="[^"]*"/g) ?? []) assert.match(href, /^href="https?:\/\//)
  assert.ok(html.includes('<a href="https://healthline.com/" target="_blank" rel="noopener noreferrer">healthline.com</a>'))
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'the series cells are escaped text')
})
