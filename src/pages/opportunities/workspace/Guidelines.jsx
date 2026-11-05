// Brand guidelines (owner, 2026-11-05): the form behind the one-time screen on the Content page (in the focus panel,
// before "Add your data"; not a numbered step) and Brand Setup's editor. In Add your data's style: one file in the same
// drop zone (PDF, DOCX, TXT or MD, read in the browser like Add your data's files, nothing uploaded) or pasted text,
// then three optional one-line fields: Tone, Always say, Never say. value: data/brandGuidelines.js's shape (without
// savedAt); onChange(patch). note: the small muted line at the bottom ("Saved to <brand>. Edit anytime in Brand Setup.").
import { useState } from 'react'
import { Check, ClipboardType, FileText, X } from 'lucide-react'
import { readFile, wordsLabel } from '../data/extract'
import { GUIDE_ACCEPT, guideReject } from '../../../data/brandGuidelines'
import { DropZone } from './DataStep'
import { Collapse } from './ui'

const ROW = 'group/row flex h-12 items-center gap-3 border-b border-[var(--div)]'
const xBtn = 'grid h-7 w-7 shrink-0 place-items-center rounded-md text-stone-500 outline-none transition-colors duration-150 hover:bg-tint hover:text-ink focus-visible:ring-2 focus-visible:ring-focus'
const field = 'h-10 w-full min-w-0 rounded-[10px] border border-line bg-surface px-3 text-[14px] leading-5 text-stone-900 outline-none placeholder:text-stone-400 transition-[border-color] duration-150 focus:border-[var(--color-line-strong)]'
const H = 'text-[15px] leading-[22px] font-semibold text-stone-900'
const FIELDS = [
  { key: 'tone', label: 'Tone', placeholder: 'e.g. warm, expert, no hype' },
  { key: 'always', label: 'Always say', placeholder: 'Product names, terms' },
  { key: 'never', label: 'Never say', placeholder: 'Words to avoid' },
]

export default function GuidelinesForm({ value, onChange, note = null }) {
  const [reading, setReading] = useState(null) // { name, status: 'reading' | 'error', error }
  const [pasting, setPasting] = useState(Boolean(value.text?.trim()))
  const add = (list) => {
    const f = list?.[0]
    if (!f) return
    const why = guideReject(f)
    if (why) { setReading({ name: f.name, status: 'error', error: why }); return }
    setReading({ name: f.name, status: 'reading' })
    readFile(f).then(({ text, words }) => { setReading(null); onChange({ file: { name: f.name, words, text } }) },
      (e) => setReading({ name: f.name, status: 'error', error: e.message || 'Couldn’t read this file' }))
  }
  const shown = reading ?? (value.file ? { name: value.file.name, status: 'read', words: value.file.words } : null)

  return (
    <div data-guidelines-form>
      <h4 className={H}>Upload or paste</h4>
      <div className="mt-3">
        <DropZone slim={Boolean(shown)} v1 one={{ formats: 'PDF, DOCX, TXT or MD · one file, up to 10 MB', accept: GUIDE_ACCEPT }} onFiles={add} onPaste={() => setPasting(true)} />
      </div>
      {shown && (
        <div className={`${ROW} motion-safe:animate-[fade-in_160ms_ease-out]`} data-guidelines-file={shown.status}>
          <FileText size={18} className="shrink-0 text-stone-600" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[15px] leading-[22px] font-medium text-stone-900" title={shown.name}>{shown.name}</span>
          {shown.status === 'reading' ? (
            <span role="progressbar" aria-label={`Reading ${shown.name}`} className="relative h-1 w-24 overflow-hidden rounded-full bg-[var(--color-line)]"><span className="co-read-wait absolute inset-0 rounded-full bg-ink" /></span>
          ) : shown.status === 'read' ? (
            <span className="flex items-center gap-1.5 text-[13px] leading-[18px] tabular-nums text-stone-500"><Check size={14} className="text-[var(--rep-up-fg)]" aria-hidden />Read · {wordsLabel(shown.words)}</span>
          ) : (
            <span className="truncate text-[13px] leading-[18px] text-negative">{shown.error}</span>
          )}
          <button type="button" aria-label={`Remove ${shown.name}`} onClick={() => { setReading(null); if (value.file) onChange({ file: null }) }} className={xBtn}><X size={14} aria-hidden /></button>
        </div>
      )}
      <Collapse open={pasting}>
        <div className="pt-3">
          <label className="mb-1.5 flex items-center gap-1.5 text-[13px] leading-[18px] font-medium text-stone-600"><ClipboardType size={14} aria-hidden />Pasted text</label>
          <textarea value={value.text} onChange={(e) => onChange({ text: e.target.value })} rows={4} aria-label="Pasted guidelines" placeholder="Paste your brand voice notes or style guide"
            className="w-full resize-y rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] leading-5 text-stone-900 outline-none placeholder:text-stone-400 focus:border-[var(--color-line-strong)]" />
        </div>
      </Collapse>

      <div className="mt-8 flex items-baseline justify-between gap-4">
        <h4 className={H}>Quick rules</h4>
        <span className="text-[13px] leading-[18px] text-stone-500">Optional</span>
      </div>
      <div className="mt-3 grid grid-cols-[112px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 max-sm:grid-cols-1 max-sm:gap-y-1.5">
        {FIELDS.map((f) => (
          <label key={f.key} className="contents">
            <span className="text-[14px] leading-5 font-medium text-stone-700">{f.label}</span>
            <input value={value[f.key]} onChange={(e) => onChange({ [f.key]: e.target.value })} placeholder={f.placeholder} maxLength={300} className={field} data-guide-field={f.key} />
          </label>
        ))}
      </div>
      {note && <p className="mt-6 text-[13px] leading-[18px] text-stone-500" data-guidelines-note>{note}</p>}
    </div>
  )
}
