// Import prompts (src/components/prompts/ImportModal.jsx): reading the CSV (wrong file type, no Prompt column, over
// 1,000 rows, duplicates, blanks), the footer's main button, and the sample file Download saves. Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MAX_ROWS, fileProblem, importButton, parseCsvText, readRecords } from './promptImport.js'

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')

test('the main button: Upload (opens the picker) before a file or after an error, Import n prompts with one', () => {
  assert.deepEqual(importButton(null), { label: 'Upload', action: 'pick', disabled: false })
  assert.deepEqual(importButton({ error: 'x' }), { label: 'Upload', action: 'pick', disabled: false })
  assert.deepEqual(importButton({ rows: [{ text: 'a' }, { text: 'b' }], found: 2 }), { label: 'Import 2 prompts', action: 'import', disabled: false })
  assert.deepEqual(importButton({ rows: [{ text: 'a' }], found: 1 }), { label: 'Import 1 prompt', action: 'import', disabled: false })
  assert.equal(importButton({ rows: [], found: 3, duplicates: 3 }).disabled, true, 'all already tracked: nothing to import')
})

test('the window: Cancel left, the main button right; a read file shows its name, rows, first 3 prompts and Remove', () => {
  const modal = src('src/components/prompts/ImportModal.jsx')
  const upload = modal.slice(modal.indexOf('upload: ('), modal.indexOf('done: ('))
  assert.match(upload, /onClick=\{onClose\} className=\{ghostBtn\}>Cancel</)
  assert.match(upload, /<PrimaryButton [^>]*onClick=\{main\.action === 'import' \? doImport : pick\}[^>]*>\{main\.label\}<\/PrimaryButton>/)
  assert.match(modal, /\{file\.name\}/)
  assert.match(modal, /\{parsed\.found\} \{parsed\.found === 1 \? 'row' : 'rows'\}/)
  assert.match(modal, /parsed\.rows\.slice\(0, PREVIEW_ROWS\)/)
  assert.match(modal, />Remove<\/button>/)
  assert.match(modal, /\{error && \(\s*<p role="alert"/)
})

test('reading the CSV: wrong file type, no Prompt column, over 1,000 rows, duplicates and blanks', () => {
  assert.equal(fileProblem({ name: 'notes.txt', type: 'text/plain', size: 10 }), 'Only CSV files can be imported.')
  assert.equal(fileProblem({ name: 'prompts.xlsx', type: 'application/vnd.ms-excel', size: 10 }), 'Only CSV files can be imported.')
  assert.equal(fileProblem({ name: 'prompts.csv', type: '', size: 0 }), 'This file is empty.')
  assert.equal(fileProblem({ name: 'PROMPTS.CSV', type: '', size: 4 }), null)
  assert.equal(fileProblem({ name: 'export', type: 'text/csv', size: 4 }), null)
  assert.match(parseCsvText('Question,Topic\nfoo,bar\n').error, /No “Prompt” column found/)
  const big = `Prompt\n${Array.from({ length: MAX_ROWS + 1 }, (_, i) => `p${i}`).join('\n')}\n`
  assert.equal(parseCsvText(big).error, 'This file has 1,001 rows. The limit is 1,000.')
  assert.equal(parseCsvText(`Prompt\n${Array.from({ length: MAX_ROWS }, (_, i) => `p${i}`).join('\n')}\n`).rows.length, MAX_ROWS, '1,000 is fine')
  const r = parseCsvText(' prompt ,CATEGORY\nbest  sunscreen,Sun\nBest sunscreen,Sun\n,x\ntracked one,\n', ['Tracked one'])
  assert.deepEqual(r.rows, [{ text: 'best sunscreen', category: 'Sun' }])
  assert.equal(r.found, 3)
  assert.equal(r.duplicates, 2)
  assert.equal(r.empty, 1)
  assert.equal(parseCsvText('Prompt\n\n').error, 'No prompts found in the Prompt column.')
  assert.equal(readRecords({ data: [], meta: { fields: [] } }).error, 'This file is empty.')
})

test('Download saves prompts-sample.csv: a named link to a real CSV with a BOM, and it imports back', () => {
  const ROWS = 'Prompt,Category\nbest sunscreen for oily skin,Sunscreen\nniacinamide serum for acne marks,Serums\nceramide moisturizer for dry winter skin,Moisturizers\n'
  const file = readFileSync(new URL('../../public/prompts-sample.csv', import.meta.url))
  assert.deepEqual([...file.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'starts with a UTF-8 BOM (Excel / Numbers)')
  assert.equal(file.subarray(3).toString('utf8'), ROWS)
  const modal = src('src/components/prompts/ImportModal.jsx')
  assert.match(modal, /href=\{SAMPLE_URL\}\s+download="prompts-sample\.csv"/)
  assert.doesNotMatch(modal, /createObjectURL/, 'no blob URL')
  const back = parseCsvText(file.toString('utf8'))
  assert.deepEqual(back.rows.map((r) => r.category), ['Sunscreen', 'Serums', 'Moisturizers'])
})
