import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, Download, FileText, UploadCloud } from 'lucide-react'
import Modal from '../ui/Modal'
import { PrimaryButton } from '../dashboard/overlays'
import { promptCategories, trackedPrompts } from '../../data/mock'
// the CSV reading and the main button (utils/promptImport.js, tested without a browser)
import { PREVIEW_ROWS, importButton, parseCsvFile } from '../../utils/promptImport'

const fmtSize = (b) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)
const ghostBtn = 'inline-flex h-9 items-center rounded-lg px-3 text-small font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
const fieldCls = 'h-9 w-full rounded-lg border border-line bg-raised px-2.5 text-small text-stone-900 outline-none focus:border-stone-400 focus-visible:ring-2 focus-visible:ring-focus'

// the sample is the mock's prompts-sample.csv as a real file (public/prompts-sample.csv: the mock's rows, a UTF-8
// BOM so Excel and Numbers read it cleanly, served as text/csv;charset=utf-8), downloaded through a plain named link
// so it always saves as prompts-sample.csv
const SAMPLE_URL = '/prompts-sample.csv'

// one window for picking and checking: the drop zone, then (a file read) its name, row count and first 3 prompts
// with Remove, in place of the drop zone. Footer: Cancel (left) · the main button (right): "Upload" opens the file
// picker (the same as "browse"); with a file read it's "Import n prompts". An unreadable file (not a CSV, no Prompt
// column, over 1,000 rows) says why under the drop zone, and Upload still works.
export default function ImportModal({ open, onClose, trackedTexts, onImport, onView }) {
  const [step, setStep] = useState('upload') // upload | done
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState(null)
  const [drag, setDrag] = useState(false)
  // rows without a category get the project's most used one (changeable below)
  const usual = () => {
    const n = {}
    trackedPrompts.forEach((p) => { if (p.category) n[p.category] = (n[p.category] ?? 0) + 1 })
    return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] ?? promptCategories[0] ?? ''
  }
  const [defaultCategory, setDefaultCategory] = useState(usual)
  const [imported, setImported] = useState(null) // { count }
  const input = useRef(null)

  // fresh start each time it opens
  useEffect(() => {
    if (!open) return
    setStep('upload'); setFile(null); setParsed(null); setError(null); setDrag(false); setImported(null); setDefaultCategory(usual())
  }, [open])

  const accept = async (f) => {
    if (!f) return
    setError(null)
    const res = await parseCsvFile(f, trackedTexts)
    if (res.error) { setError(res.error); setFile(null); setParsed(null); return }
    setFile(f)
    setParsed(res)
  }
  const pick = () => input.current?.click()
  const removeFile = () => { setFile(null); setParsed(null); setError(null) }
  // the category a row will actually get: its own if we know it, else the default
  const known = new Map(promptCategories.map((c) => [c.toLowerCase(), c]))
  const resolve = (c) => known.get(c.toLowerCase()) ?? defaultCategory

  const doImport = () => {
    const rows = parsed.rows.map((r) => ({ text: r.text, category: resolve(r.category) }))
    onImport(rows)
    setImported({ count: rows.length })
    setStep('done')
  }

  const fileInput = (
    <input ref={input} type="file" accept=".csv,text/csv" className="hidden" data-import-file onChange={(e) => { accept(e.target.files?.[0]); e.target.value = '' }} />
  )

  const titles = {
    upload: ['Import prompts', parsed ? 'Check the prompts, then import them.' : 'Upload a CSV with one prompt per row.'],
    done: ['Import complete', null],
  }

  const main = importButton(parsed)
  const footer = {
    upload: (
      <>
        <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
        <PrimaryButton size="sm" disabled={main.disabled} onClick={main.action === 'import' ? doImport : pick} data-import-main="">{main.label}</PrimaryButton>
      </>
    ),
    done: (
      <>
        <button type="button" onClick={onClose} className={ghostBtn}>Close</button>
        <PrimaryButton size="sm" onClick={() => onView()}>View prompts</PrimaryButton>
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
              <a
                href={SAMPLE_URL}
                download="prompts-sample.csv"
                type="text/csv"
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-stone-50 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Download size={14} aria-hidden /> Download
              </a>
            </div>
            {!parsed ? (
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
            ) : (
              <div className="mt-3 rounded-lg border border-line" data-import-picked="">
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2 text-[13px] leading-[18px]">
                    <FileText size={14} className="shrink-0 text-stone-500" aria-hidden />
                    <span className="truncate font-medium text-stone-900">{file.name}</span>
                    <span className="shrink-0 text-stone-600 tabular-nums">{parsed.found} {parsed.found === 1 ? 'row' : 'rows'}</span>
                  </span>
                  <button type="button" onClick={removeFile} className="shrink-0 rounded text-[13px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">Remove</button>
                </div>
                {/* the first 3 that will be imported (duplicates already left out) */}
                <ul className="divide-y divide-[var(--color-line-soft)] border-t border-line" aria-label="First prompts">
                  {parsed.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                    <li key={i} title={r.text} className="flex h-8 items-center gap-3 px-3 text-[13px] leading-[18px]">
                      <span className="min-w-0 flex-1 truncate text-stone-900">{r.text}</span>
                      {promptCategories.length > 0 && <span className="shrink-0 text-[12px] text-stone-500">{resolve(r.category)}</span>}
                    </li>
                  ))}
                </ul>
                {(parsed.rows.length > PREVIEW_ROWS || parsed.duplicates > 0 || parsed.empty > 0) && (
                  <p className="border-t border-line px-3 py-2 text-[12px] leading-4 text-stone-500 tabular-nums">
                    {[
                      parsed.rows.length > PREVIEW_ROWS && `+${parsed.rows.length - PREVIEW_ROWS} more`,
                      parsed.duplicates > 0 && `${parsed.duplicates} duplicate${parsed.duplicates === 1 ? '' : 's'} skipped`,
                      parsed.empty > 0 && `${parsed.empty} empty row${parsed.empty === 1 ? '' : 's'}`,
                      fmtSize(file.size),
                    ].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            )}
            {error && (
              <p role="alert" className="mt-2 flex items-center gap-1.5 text-[13px] leading-[18px] text-negative">
                <AlertCircle size={14} className="shrink-0" aria-hidden /> {error}
              </p>
            )}
            {/* Prompt Hub: rows without a category get this one (First-time setup has no categories yet) */}
            {parsed && promptCategories.length > 0 && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[13px] leading-[18px] font-medium text-stone-700">Default category</span>
                  <select value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)} className={fieldCls}>
                    {promptCategories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <span className="mt-1 block text-[12px] leading-4 text-stone-500">Used when a row has no category</span>
                </label>
              </div>
            )}
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
