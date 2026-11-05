import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { guideReject, guidelinesLabel, guidelinesPreview, hasGuidelines, loadGuidelines, needsGuidelines, removeGuidelines, saveGuidelines, skipGuidelines } from './brandGuidelines.js'

// a stand-in for the browser's localStorage
const mem = new Map()
globalThis.window = { localStorage: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) } }
beforeEach(() => mem.clear())

test('asked once per brand: until saved or skipped', () => {
  assert.equal(needsGuidelines('a.com'), true)
  skipGuidelines('a.com')
  assert.equal(needsGuidelines('a.com'), false, 'skipped: not asked again')
  assert.equal(needsGuidelines('b.com'), true, 'per brand')
  saveGuidelines('b.com', { tone: 'warm' })
  assert.equal(needsGuidelines('b.com'), false, 'saved: not asked again')
})

test('save clears an earlier skip; remove asks again only if not skipped', () => {
  skipGuidelines('a.com')
  const g = saveGuidelines('a.com', { never: 'miracle' })
  assert.equal(g.never, 'miracle')
  assert.ok(g.savedAt)
  assert.deepEqual(loadGuidelines('a.com').never, 'miracle')
  removeGuidelines('a.com')
  assert.equal(loadGuidelines('a.com'), null)
  assert.equal(needsGuidelines('a.com'), true, 'the skip went with the save')
})

test('empty guidelines are not guidelines', () => {
  assert.equal(hasGuidelines({ file: null, text: '  ', tone: '', always: '', never: '' }), false)
  assert.equal(hasGuidelines({ text: 'Be warm' }), true)
  assert.equal(hasGuidelines({ file: { name: 'v.pdf', words: 3, text: 'a b c' } }), true)
})

test('files: PDF, DOCX, TXT or MD up to 10 MB', () => {
  assert.equal(guideReject({ name: 'voice.md', size: 10 }), null)
  assert.equal(guideReject({ name: 'voice.PDF', size: 10 }), null)
  assert.equal(guideReject({ name: 'voice.csv', size: 10 }), 'Not a PDF, DOCX, TXT or MD file')
  assert.equal(guideReject({ name: 'voice', size: 10 }), 'Not a PDF, DOCX, TXT or MD file')
  assert.equal(guideReject({ name: 'voice.pdf', size: 11 * 1024 * 1024 }), 'Over 10 MB')
})

test('label and preview', () => {
  assert.equal(guidelinesLabel({ file: { name: 'voice.pdf' }, text: '', tone: 'warm', always: '', never: 'cure' }), 'voice.pdf · Tone, Never say')
  assert.equal(guidelinesLabel({ file: null, text: 'Be warm', tone: '', always: '', never: '' }), 'Pasted text')
  assert.equal(guidelinesLabel({ file: null, text: '', tone: 'warm', always: '', never: '' }), 'Tone')
  assert.equal(guidelinesPreview({ text: 'a'.repeat(200) }, 20).length, 20)
})
