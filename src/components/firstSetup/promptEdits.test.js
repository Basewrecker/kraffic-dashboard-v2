// First-time setup's prompt list and Prompt Hub: edit, remove, bulk remove, and the history warning on scanned
// prompts (promptEdits.js). Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EDIT_HISTORY_WARNING, editProblem, editWarning, hasScanHistory, keepSelected, needsConfirm, removePrompts, renamePrompt, savedIds, toggleId } from './promptEdits.js'

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')
const list = [
  { id: 'tmp1', text: 'best natural face oil', unsaved: true },
  { id: 'tmp2', text: 'rosehip oil for scars', unsaved: true },
  { id: 'sp1', text: 'bakuchiol serum vs retinol' },
]

test('edit: empty, unchanged and duplicate texts are refused; a new text is trimmed in place', () => {
  assert.equal(editProblem(list, 'tmp1', '   '), 'empty')
  assert.equal(editProblem(list, 'tmp1', ' best natural face oil '), 'same')
  assert.equal(editProblem(list, 'tmp1', 'Rosehip oil for scars'), 'dupe')
  assert.equal(editProblem(list, 'tmp1', 'best face oil'), null)
  const next = renamePrompt(list, 'tmp1', '  best face oil ')
  assert.deepEqual(next.map((p) => p.text), ['best face oil', 'rosehip oil for scars', 'bakuchiol serum vs retinol'])
  assert.equal(next[0].unsaved, true)
  assert.equal(next[1], list[1])
})

test('remove: unsaved prompts go at once; a saved one (scan history) asks first', () => {
  assert.deepEqual(removePrompts(list, ['tmp2']).map((p) => p.id), ['tmp1', 'sp1'])
  assert.equal(needsConfirm(list, ['tmp1', 'tmp2']), false)
  assert.equal(needsConfirm(list, ['tmp1', 'sp1']), true)
  assert.deepEqual(savedIds(list, ['tmp1', 'sp1']), ['sp1'])
})

test('bulk: a checkbox toggles, and the selection drops rows that are gone', () => {
  let sel = toggleId(new Set(), 'tmp1')
  sel = toggleId(sel, 'sp1')
  assert.deepEqual([...sel], ['tmp1', 'sp1'])
  assert.deepEqual([...toggleId(sel, 'tmp1')], ['sp1'])
  assert.deepEqual([...keepSelected(sel, removePrompts(list, ['sp1']))], ['tmp1'])
})

test('history warning: scanned prompts warn (Prompt Hub by status, setup by scanned); others edit freely', () => {
  assert.equal(EDIT_HISTORY_WARNING, 'Editing starts a new history for this prompt')
  for (const status of ['visible', 'missed', 'lost']) assert.equal(editWarning({ id: 'v1', status }), EDIT_HISTORY_WARNING, status)
  assert.equal(editWarning({ id: 'p0', status: 'pending' }), null)
  assert.equal(hasScanHistory({ id: 'p0', status: 'pending' }), false)
  assert.equal(editWarning({ id: '41', text: 'x', scanned: true }), EDIT_HISTORY_WARNING)
  assert.equal(editWarning({ id: '42', text: 'x', scanned: false }), null)
  assert.equal(editWarning({ id: 'tmp1', text: 'x', unsaved: true, scanned: true }), null)
  assert.equal(editWarning(null), null)
})

test('setup and Prompt Hub carry Edit, a remove ×, Remove selected, the scan-history confirm and the warning', () => {
  const step = src('src/components/firstSetup/PromptsStep.jsx')
  assert.match(step, /aria-label=\{`Edit “\$\{p\.text\}”`\}/)
  assert.match(step, /aria-label=\{`Remove “\$\{p\.text\}”`\}[^\n]*<X size=\{14\}/)
  assert.match(step, />Remove selected</)
  assert.match(step, /It has scan history/)
  assert.match(step, /useInlineEdit\(/)
  assert.match(step, /editWarning\(p\) && <span[^>]*>\{editWarning\(p\)\}<\/span>/)
  const hub = src('src/components/prompts/PromptsPage.jsx')
  assert.match(hub, /aria-label=\{`Remove “\$\{r\.prompt\}”`\}/)
  assert.match(hub, /group-hover:opacity-100/)
  assert.match(hub, /Remove selected/)
  assert.match(hub, /It has scan history/)
  assert.match(hub, /editWarning\(r\) && <span[^>]*>\{editWarning\(r\)\}<\/span>/)
})
