// Copied from the app (components/mock-overview/content-guidelines.jsx, develop, synced 2026-11-15); only the paths to
// the mock's own components changed.
'use client'
// Brand guidelines in the app (lib/mock-adapter-guidelines.ts): a failed save, skip or remove, shown inline with Retry
// (CLAUDE.md §2 Saves: the page already shows the change; this says it didn't reach the server). The server's message
// for a 400 (e.g. a phrase over 200 characters), a plain one otherwise. Nothing when the last write went through.
import { useEffect, useId, useRef, useState } from 'react'
import { EMPTY_GUIDELINES, guidelinesStamp, guidelinesStateOf, hasGuidelines, loadGuidelines, removeGuidelines, saveGuidelines, useBrandGuidelines } from '@/lib/mock-adapter-guidelines'
import { lineBtn } from '../../../components/tool/ToolPage'
import Modal from '../../../components/ui/Modal'
import SiteLogo from '../../../components/ui/SiteLogo'
import { PrimaryButton, SecondaryButton } from '../../../components/dashboard/overlays'
import GuidelinesForm from '../../../pages/opportunities/workspace/Guidelines'

const LINK = 'rounded font-semibold text-stone-900 underline decoration-[var(--color-line-strong)] underline-offset-2 outline-none hover:decoration-ink focus-visible:ring-2 focus-visible:ring-focus'

export function GuidelinesError({ domain, className = 'px-6 pb-6 max-md:px-4' }) {
  const { error } = useBrandGuidelines(domain)
  if (!error) return null
  return (
    <div className={className} data-guidelines-error>
      <p role="alert" className="flex flex-wrap items-center gap-x-2 text-[13px] leading-[18px] text-negative">
        <span>{error.message}</span>
        <button type="button" onClick={error.retry} className={LINK}>Retry</button>
      </p>
    </div>
  )
}

// "How we use this" (owner, 2026-11-07): a text link beside the guidelines dialog's title, opening a small popover
// with what the guidelines do. Every line is checked against the code (lib/content-brand-guidelines.js, the
// content-recommend route, lib/mock-adapter-guidelines.ts); keep them true if that changes.
export const howGuidelinesWork = (brand) => [
  `Every new Content draft for ${brand} reads these before it’s written.`,
  'Tone sets how the writing sounds.',
  'Always say: names and terms we ask the draft to use.',
  'Never say: words the draft is told to avoid. Any it still uses are flagged.',
  'Uploaded files: we keep the text only (with any pasted text, up to 20,000 characters) and the file’s name, not the file.',
  'Guidelines shape tone and wording only. They never add facts or claims.',
  'Drafts already written don’t change. Regenerate a draft to apply new guidelines.',
]

export function HowWeUseThis({ brand }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const id = useId()
  useEffect(() => {
    if (!open) return undefined
    const away = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    // Esc closes the popover only, not the dialog under it
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc, true) }
  }, [open])
  return (
    <span ref={wrap} className="relative inline-flex">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id} data-how-guidelines
        className="rounded text-[13px] leading-[18px] font-medium text-stone-600 underline decoration-[var(--color-line-strong)] underline-offset-[3px] outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
        How we use this
      </button>
      {open && (
        <div id={id} role="dialog" aria-label="How your guidelines shape drafts" data-how-guidelines-popover
          className="absolute left-0 top-full z-20 mt-2 w-[380px] max-w-[calc(100vw-48px)] rounded-xl border border-line bg-surface p-4 text-left shadow-lg motion-safe:animate-[fade-in_.15s_ease-out]">
          <p className="text-[14px] leading-5 font-semibold text-stone-900">How your guidelines shape drafts</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {howGuidelinesWork(brand).map((line) => (
              <li key={line} className="flex gap-2 text-[13px] leading-[18px] font-normal text-stone-600">
                <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-stone-400" />{line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  )
}

// The Content list's brand guidelines button (owner, 2026-11-05), top-right of the page header, level with the title:
// an outline button with the brand's logo (owner, 2026-11-07; was a document icon), the height of Export CSV.
//   none, skipped or removed  "Add Brand guidelines" (owner, 2026-11-09: capital B)
//   saved                     "Brand guidelines · Added Nov 5" (or "· Updated Nov 7" after an edit), the uploaded
//                             file's name small and muted under it
// It opens the same form as the prompt's guidelines screen, pre-filled: Save / Cancel, and Remove when saved. Saving
// updates the brand's guidelines for the drafts written from now on; written drafts don't change. Hidden until the
// route has answered.
export function GuidelinesButton({ domain, brand, className = '' }) {
  useBrandGuidelines(domain)
  const state = guidelinesStateOf(domain)
  const [form, setForm] = useState(null) // the form while the dialog is open
  if (!state) return null
  const g = loadGuidelines(domain)
  const open = () => setForm(g ?? EMPTY_GUIDELINES)
  const save = () => { saveGuidelines(domain, form); setForm(null) }
  const remove = () => { removeGuidelines(domain); setForm(null) }
  // saved guidelines with every field now empty: the button removes them (owner, 2026-11-05)
  const clearedAll = Boolean(g) && Boolean(form) && !hasGuidelines(form)
  return (
    <div className={`flex shrink-0 flex-col items-end gap-1 ${className}`}>
      <button type="button" onClick={open} className={lineBtn} data-guidelines-button={g ? 'saved' : 'add'}>
        {/* app (owner, 2026-11-07): the brand's own logo, 16px, the account switcher's loader (letter tile only if every
            source fails) */}
        <span aria-hidden className="inline-flex"><SiteLogo domain={domain} name={brand} className="h-4 w-4 rounded-[4px]" initialClass="text-[9px]" /></span>
        {g ? <span>Brand Guidelines <span aria-hidden className="text-stone-400">·</span> <span className="tabular-nums">{guidelinesStamp(g)}</span></span> : 'Add Brand Guidelines'}
      </button>
      {g?.file?.name && <span className="max-w-[260px] truncate text-[12px] leading-4 text-stone-500" title={g.file.name}>{g.file.name}</span>}
      <GuidelinesError domain={domain} className="" />
      <Modal open={Boolean(form)} onClose={() => setForm(null)} title={<span className="flex flex-wrap items-baseline gap-x-3">Your Brand Guidelines <HowWeUseThis brand={brand} /></span>} subtitle={`Every new draft for ${brand} follows them. Drafts already written don’t change.`} size="lg"
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
