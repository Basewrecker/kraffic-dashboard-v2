// Import prompts (src/components/prompts/ImportModal.jsx, Prompt Hub and First-time setup): reading the CSV and the
// window's main button. Pure functions, so they're tested without a browser (promptImport.test.js).
import Papa from 'papaparse'

export const MAX_ROWS = 1000
export const PREVIEW_ROWS = 3

// ---- the file --------------------------------------------------------------------------------------------------
// { name, type, size } → an error message, or null when it can be read
export function fileProblem(file) {
  if (!file) return 'No file chosen.'
  if (!/\.csv$/i.test(file.name || '') && file.type !== 'text/csv') return 'Only CSV files can be imported.'
  if (file.size === 0) return 'This file is empty.'
  return null
}

// Papa.parse's result ({ data, meta }) → { error } or { rows, found, duplicates, empty }. Duplicates: repeated within
// the file or already tracked (case-insensitive). rows: what will be imported ({ text, category }).
export function readRecords({ data, meta }, trackedTexts = []) {
  const fields = (meta?.fields ?? []).map((f) => String(f).trim()).filter(Boolean)
  if (!fields.length) return { error: 'This file is empty.' }
  const promptKey = (meta.fields ?? []).find((f) => String(f).trim().toLowerCase() === 'prompt')
  if (!promptKey) return { error: 'No “Prompt” column found. Add a header row with Prompt.' }
  const categoryKey = (meta.fields ?? []).find((f) => String(f).trim().toLowerCase() === 'category')
  // a trailing newline gives one blank record: not a user-visible "empty row"
  const blank = (rec) => Object.values(rec ?? {}).every((v) => !String(v ?? '').trim())
  const records = data.length && blank(data.at(-1)) ? data.slice(0, -1) : data
  if (records.length > MAX_ROWS) return { error: `This file has ${records.length.toLocaleString('en-US')} rows. The limit is 1,000.` }
  const seen = new Set(Array.from(trackedTexts ?? [], (t) => String(t).toLowerCase()))
  let empty = 0, duplicates = 0, found = 0
  const rows = []
  for (const rec of records) {
    const text = String(rec[promptKey] ?? '').trim().replace(/\s+/g, ' ')
    if (!text) { empty++; continue }
    found++
    const k = text.toLowerCase()
    if (seen.has(k)) { duplicates++; continue }
    seen.add(k)
    rows.push({ text, category: categoryKey ? String(rec[categoryKey] ?? '').trim() : '' })
  }
  if (!found) return { error: 'No prompts found in the Prompt column.' }
  return { rows, found, duplicates, empty }
}

const PAPA = { header: true, skipEmptyLines: false }
// CSV text → the same as readRecords
export function parseCsvText(text, trackedTexts) {
  return readRecords(Papa.parse(String(text ?? ''), PAPA), trackedTexts)
}
// a File (browser) → Promise of the same, or { error } for a file that isn't a CSV
export function parseCsvFile(file, trackedTexts) {
  const problem = fileProblem(file)
  if (problem) return Promise.resolve({ error: problem })
  return new Promise((resolve) => {
    Papa.parse(file, {
      ...PAPA,
      complete: (res) => resolve(readRecords(res, trackedTexts)),
      error: () => resolve({ error: 'This file couldn’t be read as CSV.' }),
    })
  })
}

// ---- the window's main button -----------------------------------------------------------------------------------
// Before a file: "Upload", which opens the file picker (the same as "browse"); also after an error, so it's never a
// dead end. With a file read: "Import n prompts" (disabled only when every row is already tracked).
export function importButton(parsed) {
  if (!parsed?.rows) return { label: 'Upload', action: 'pick', disabled: false }
  const n = parsed.rows.length
  return { label: `Import ${n} prompt${n === 1 ? '' : 's'}`, action: 'import', disabled: n === 0 }
}
