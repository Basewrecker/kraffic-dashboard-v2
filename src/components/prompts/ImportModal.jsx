import { useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import { AlertCircle, Check, Download, FileText, UploadCloud } from 'lucide-react'
import Modal from '../ui/Modal'
import { PrimaryButton } from '../dashboard/overlays'
import { promptCategories } from '../../data/mock'

const MAX_ROWS = 1000
const PREVIEW = 6
const SAMPLE = 'Prompt,Category\nbest sunscreen for oily skin,Sunscreen\nniacinamide serum for acne marks,Serums\nceramide moisturizer for dry winter skin,Moisturizers\n'
const fmtSize = (b) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)
const ghostBtn = 'inline-flex h-9 items-center rounded-lg px-3 text-small font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
const fieldCls = 'h-9 w-full rounded-lg border border-line bg-raised px-2.5 text-small text-stone-900 outline-none focus:border-stone-400 focus-visible:ring-2 focus-visible:ring-focus'

function downloadSample() {
  const url = URL.createObjectURL(new Blob([SAMPLE], { type: 'text/csv' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: 'prompts-sample.csv' })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

// Parse a CSV File → { error } or { rows, found, duplicates, empty }.
// Duplicates = repeated within the file or already tracked (case-insensitive).
function parseCsv(file, trackedTexts) {
  return new Promise((resolve) => {
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') return resolve({ error: 'Only CSV files can be imported.' })
    if (file.size === 0) return resolve({ error: 'This file is empty.' })
    Papa.parse(file, {
      header: true,
      skipEmptyLines: false,
      transformHeader: (h) => h.trim(),
      complete: ({ data, meta }) => {
        const fields = (meta.fields ?? []).filter(Boolean)
        if (!fields.length) return resolve({ error: 'This file is empty.' })
        const promptKey = fields.find((f) => f.toLowerCase() === 'prompt')
        if (!promptKey) return resolve({ error: 'No “Prompt” column found. Add a header row with Prompt.' })
        const categoryKey = fields.find((f) => f.toLowerCase() === 'category')
        // a trailing newline gives one blank record: not a user-visible "empty row"
        const records = data.at(-1) && Object.values(data.at(-1)).every((v) => !String(v ?? '').trim()) && data.length > 0 ? data.slice(0, -1) : data
        if (records.length > MAX_ROWS) return resolve({ error: `This file has ${records.length.toLocaleString()} rows. The limit is 1,000.` })
        const seen = new Set(trackedTexts)
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
        if (!found) return resolve({ error: 'No prompts found in the Prompt column.' })
        resolve({ rows, found, duplicates, empty })
      },
      error: () => resolve({ error: 'This file couldn’t be read as CSV.' }),
    })
  })
}

export default function ImportModal({ open, onClose, trackedTexts, onImport, onView }) {
  const [step, setStep] = useState('upload') // upload | preview | done
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState(null)
  const [drag, setDrag] = useState(false)
  const [listName, setListName] = useState('')
  const [defaultCategory, setDefaultCategory] = useState('Moisturizers')
  const [imported, setImported] = useState(null) // { count, list }
  const input = useRef(null)

  // fresh start each time it opens
  useEffect(() => {
    if (!open) return
    setStep('upload'); setFile(null); setParsed(null); setError(null); setDrag(false); setImported(null)
  }, [open])

  const accept = async (f) => {
    if (!f) return
    setError(null)
    const res = await parseCsv(f, trackedTexts)
    if (res.error) { setError(res.error); return }
    setFile(f)
    setParsed(res)
    setListName(f.name.replace(/\.csv$/i, ''))
    setStep('preview')
  }
  const pick = () => input.current?.click()
  // the category a row will actually get: its own if we know it, else the default
  const known = new Map(promptCategories.map((c) => [c.toLowerCase(), c]))
  const resolve = (c) => known.get(c.toLowerCase()) ?? defaultCategory

  const doImport = () => {
    const list = listName.trim() || file.name.replace(/\.csv$/i, '')
    const rows = parsed.rows.map((r) => ({ text: r.text, category: resolve(r.category) }))
    onImport(rows, list)
    setImported({ count: rows.length, list })
    setStep('done')
  }

  const fileInput = (
    <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { accept(e.target.files?.[0]); e.target.value = '' }} />
  )

  const titles = {
    upload: ['Import prompts', 'Upload a CSV with one prompt per row.'],
    preview: ['Import prompts', 'Check the prompts, then import them into a list.'],
    done: ['Import complete', null],
  }

  const footer = {
    upload: <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>,
    preview: (
      <>
        <button type="button" onClick={() => setStep('upload')} className={ghostBtn}>Back</button>
        <PrimaryButton size="sm" disabled={!parsed?.rows.length || !listName.trim()} onClick={doImport}>
          Import {parsed?.rows.length ?? 0} prompt{parsed?.rows.length === 1 ? '' : 's'}
        </PrimaryButton>
      </>
    ),
    done: (
      <>
        <button type="button" onClick={onClose} className={ghostBtn}>Close</button>
        <PrimaryButton size="sm" onClick={() => onView(imported.list)}>View prompts</PrimaryButton>
      </>
    ),
  }[step]

  return (
    <Modal open={open} onClose={onClose} size="md" title={titles[step][0]} subtitle={titles[step][1]} footer={footer}>
      {fileInput}
      {/* key = step: each step fades in (150ms) */}
      <div key={step} className="fade-in">
        {step === 'upload' && (
          <>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText size={16} className="shrink-0 text-stone-500" aria-hidden />
                <div className="min-w-0">
                  <div className="truncate text-[14px] leading-5 font-medium text-stone-900">prompts-sample.csv</div>
                  <div className="text-[12px] leading-4 text-stone-600">Column: Prompt, optional: Category</div>
                </div>
              </div>
              <button
                type="button"
                onClick={downloadSample}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-stone-50 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Download size={14} aria-hidden /> Download
              </button>
            </div>
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload a CSV file"
              onClick={pick}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick() } }}
              onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files?.[0]) }}
              className={`mt-3 grid h-40 cursor-pointer place-items-center rounded-lg border-[1.5px] border-dashed text-center outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${
                drag ? 'border-[color-mix(in_srgb,var(--ink)_40%,transparent)] bg-tint' : 'border-line hover:bg-[var(--subtle-bg)]'
              }`}
            >
              <div className="flex flex-col items-center">
                <UploadCloud size={20} className="text-stone-500" aria-hidden />
                <p className="mt-2 text-[14px] leading-5 text-stone-700">
                  Drop a CSV here or <span className="font-medium text-ink underline underline-offset-4">browse</span>
                </p>
                <p className="mt-1 text-[12px] leading-4 text-stone-500">CSV only · max 1,000 rows</p>
              </div>
            </div>
            {error && (
              <p role="alert" className="mt-2 flex items-center gap-1.5 text-[13px] leading-[18px] text-negative">
                <AlertCircle size={14} className="shrink-0" aria-hidden /> {error}
              </p>
            )}
          </>
        )}

        {step === 'preview' && parsed && (
          <>
            <p className="text-[13px] leading-5 text-stone-600 tabular-nums">
              <span className="text-[14px] font-medium text-stone-900">{parsed.found} prompt{parsed.found === 1 ? '' : 's'} found</span>
              {parsed.duplicates > 0 && <> · {parsed.duplicates} duplicate{parsed.duplicates === 1 ? '' : 's'} skipped</>}
              {parsed.empty > 0 && <> · {parsed.empty} empty row{parsed.empty === 1 ? '' : 's'}</>}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-tint px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-[13px] leading-[18px]">
                <FileText size={14} className="shrink-0 text-stone-500" aria-hidden />
                <span className="truncate font-medium text-stone-900">{file.name}</span>
                <span className="shrink-0 text-stone-600 tabular-nums">{fmtSize(file.size)}</span>
              </span>
              <button type="button" onClick={pick} className="shrink-0 rounded text-[13px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">Replace</button>
            </div>
            {error && (
              <p role="alert" className="mt-2 flex items-center gap-1.5 text-[13px] leading-[18px] text-negative">
                <AlertCircle size={14} className="shrink-0" aria-hidden /> {error}
              </p>
            )}
            {/* preview = what will actually be imported (duplicates already removed) */}
            <ul className="mt-3 divide-y divide-[var(--color-line-soft)] rounded-lg border border-line">
              {parsed.rows.slice(0, PREVIEW).map((r, i) => (
                <li key={i} title={r.text} className="flex h-8 items-center gap-3 px-3 text-[13px] leading-[18px]">
                  <span className="min-w-0 flex-1 truncate text-stone-900">{r.text}</span>
                  <span className="shrink-0 text-[12px] text-stone-500">{resolve(r.category)}</span>
                </li>
              ))}
            </ul>
            {parsed.rows.length > PREVIEW && <p className="mt-1.5 text-[12px] leading-4 text-stone-500 tabular-nums">+{parsed.rows.length - PREVIEW} more</p>}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[13px] leading-[18px] font-medium text-stone-700">List name</span>
                <input value={listName} onChange={(e) => setListName(e.target.value)} className={fieldCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] leading-[18px] font-medium text-stone-700">Default category</span>
                <select value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)} className={fieldCls}>
                  {promptCategories.map((c) => <option key={c}>{c}</option>)}
                </select>
                <span className="mt-1 block text-[12px] leading-4 text-stone-500">Used when a row has no category</span>
              </label>
            </div>
          </>
        )}

        {step === 'done' && imported && (
          <div className="py-2">
            <Check size={20} className="text-ink" aria-hidden />
            <p className="mt-2 text-[16px] leading-6 font-semibold text-stone-900 tabular-nums">{imported.count} prompt{imported.count === 1 ? '' : 's'} imported</p>
            <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600">They’ll be scanned in the next sync.</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
