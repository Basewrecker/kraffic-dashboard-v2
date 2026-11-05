// The Content list's brand guidelines button (owner, 2026-11-05; as the app's components/mock-overview/
// content-guidelines.jsx), top-right of the page header, level with the title: an outline button with a document icon,
// the height of Export CSV.
//   none, skipped or removed  "Add brand guidelines"
//   saved                     "Brand guidelines · Added Nov 5" (or "· Updated Nov 7" after an edit), the uploaded
//                             file's name small and muted under it
// It opens the same form as the prompt's guidelines screen, pre-filled: Save / Cancel, and Remove when saved. Saving
// updates the brand's guidelines for the drafts written from now on; written drafts don't change.
import { useState } from 'react'
import { FileText } from 'lucide-react'
import { EMPTY_GUIDELINES, guidelinesStamp, hasGuidelines, loadGuidelines, removeGuidelines, saveGuidelines } from '../../../data/brandGuidelines'
import { lineBtn } from '../../../components/tool/ToolPage'
import Modal from '../../../components/ui/Modal'
import { PrimaryButton, SecondaryButton } from '../../../components/dashboard/overlays'
import GuidelinesForm from '../workspace/Guidelines'

export default function GuidelinesButton({ domain, brand, className = '' }) {
  const [g, setG] = useState(() => loadGuidelines(domain))
  const [form, setForm] = useState(null) // the form while the dialog is open
  const open = () => setForm(g ?? EMPTY_GUIDELINES)
  const save = () => { setG(saveGuidelines(domain, form)); setForm(null) }
  const remove = () => { removeGuidelines(domain); setG(null); setForm(null) }
  // saved guidelines with every field now empty: the button removes them
  const clearedAll = Boolean(g) && Boolean(form) && !hasGuidelines(form)
  return (
    <div className={`flex shrink-0 flex-col items-end gap-1 ${className}`}>
      <button type="button" onClick={open} className={lineBtn} data-guidelines-button={g ? 'saved' : 'add'}>
        <FileText size={16} aria-hidden />
        {g ? <span>Brand guidelines <span aria-hidden className="text-stone-400">·</span> <span className="tabular-nums">{guidelinesStamp(g)}</span></span> : 'Add brand guidelines'}
      </button>
      {g?.file?.name && <span className="max-w-[260px] truncate text-[12px] leading-4 text-stone-500" title={g.file.name}>{g.file.name}</span>}
      <Modal open={Boolean(form)} onClose={() => setForm(null)} title="Your brand guidelines" subtitle={`Every new draft for ${brand} follows them. Drafts already written don’t change.`} size="lg"
        footer={<div className="flex w-full items-center gap-2">
          {g && <button type="button" onClick={remove} data-remove-guidelines className="mr-auto rounded text-[13px] leading-[18px] font-medium text-stone-600 underline decoration-[var(--color-line-strong)] underline-offset-[3px] outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">Remove guidelines</button>}
          <span className="ml-auto flex gap-2"><SecondaryButton size="sm" onClick={() => setForm(null)}>Cancel</SecondaryButton>
          {clearedAll ? <PrimaryButton size="sm" onClick={remove}>Remove guidelines</PrimaryButton> : <PrimaryButton size="sm" onClick={save} disabled={!form || !hasGuidelines(form)}>Save</PrimaryButton>}</span>
        </div>}>
        {form && <GuidelinesForm value={form} onChange={(p) => setForm((f) => ({ ...f, ...p }))} note={`Saved to ${brand}. Edit anytime here or in Brand Setup.`} />}
      </Modal>
    </div>
  )
}
