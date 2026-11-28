// Copied from the app (components/mock-overview/content-guidelines.jsx, develop, synced 2026-11-15); only the paths to
// the mock's own components changed. The grouped control and its preview (app #233) were ported from the handoff of
// 2026-11-27 (visuals only).
'use client'
// Brand guidelines in the app (lib/mock-adapter-guidelines.ts): a failed save, skip or remove, shown inline with Retry
// (CLAUDE.md §2 Saves: the page already shows the change; this says it didn't reach the server). The server's message
// for a 400 (e.g. a phrase over 200 characters), a plain one otherwise. Nothing when the last write went through.
import { useEffect, useId, useRef, useState } from 'react'
import { Eye } from 'lucide-react'
import GuidelinesPreview, { openGuidelinesPreview } from './guidelines-preview'
import { EMPTY_GUIDELINES, guidelinesStateOf, hasGuidelines, loadGuidelines, removeGuidelines, saveGuidelines, useBrandGuidelines } from '@/lib/mock-adapter-guidelines'
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

// The Content list's Brand Guidelines control (as the app, #233), top-right of the page header, level with the title.
//   none, skipped or removed  one outline button, "Add Brand Guidelines", with the brand's logo
//   saved                     a grouped control: the button (logo · "Brand Guidelines" · a green check) joined to a
//                             36px eye button ("Preview guidelines" in the dark tip) that opens the preview pull-out
// After a first save in this visit the check draws in and the eye slides out (--motion-morph; reduced motion: a fade).
// The button opens the same form as the prompt's guidelines screen, pre-filled: Save / Cancel, and Remove when saved.
// Saving updates the brand's guidelines for the drafts written from now on; written drafts don't change.
export function GuidelinesButton({ domain, brand, className = '' }) {
  useBrandGuidelines(domain)
  const state = guidelinesStateOf(domain)
  const [form, setForm] = useState(null) // the form while the dialog is open
  const [fresh, setFresh] = useState(false) // saved for the first time in this visit: the check and the eye animate in
  const [tip, setTip] = useState(false)
  if (!state) return null
  const g = loadGuidelines(domain)
  const open = () => setForm(g ?? EMPTY_GUIDELINES)
  const save = () => { if (!g) setFresh(true); saveGuidelines(domain, form); setForm(null) }
  const remove = () => { removeGuidelines(domain); setFresh(false); setForm(null) }
  // saved guidelines with every field now empty: the button removes them (owner, 2026-11-05)
  const clearedAll = Boolean(g) && Boolean(form) && !hasGuidelines(form)
  return (
    <div className={`flex shrink-0 flex-col items-end gap-1 ${className}`}>
      <div className="relative inline-flex" data-guidelines-control={g ? 'saved' : 'add'}>
        <button type="button" onClick={open} className={`${lineBtn} ${g ? 'relative rounded-r-none focus-visible:z-10' : ''}`} data-guidelines-button={g ? 'saved' : 'add'}>
          {/* app (owner, 2026-11-07): the brand's own logo, 16px, the account switcher's loader (letter tile only if every
              source fails) */}
          <span aria-hidden className="inline-flex"><SiteLogo domain={domain} name={brand} className="h-4 w-4 rounded-[4px]" initialClass="text-[9px]" /></span>
          {g ? 'Brand Guidelines' : 'Add Brand Guidelines'}
          {g && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--connected)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`-ml-0.5 shrink-0 ${fresh ? 'gl-check-in' : ''}`}>
              <path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1" />
            </svg>
          )}
          {g && <span className="sr-only">saved</span>}
        </button>
        {g && (
          <span className={`inline-flex ${fresh ? 'gl-eye-in' : ''}`}>
            <button type="button" onClick={openGuidelinesPreview} aria-label="Preview guidelines" data-guidelines-eye
              onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)} onFocus={(e) => setTip(e.currentTarget.matches(':focus-visible'))} onBlur={() => setTip(false)}
              className="relative -ml-px grid h-9 w-9 shrink-0 place-items-center rounded-r-lg border border-line bg-surface text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-focus">
              <Eye size={16} aria-hidden />
            </button>
          </span>
        )}
        {g && <span role="tooltip" className={`tip-dark pointer-events-none absolute right-0 top-full z-40 mt-2 w-max transition-opacity duration-150 ${tip ? 'opacity-100' : 'opacity-0'}`}>Preview guidelines</span>}
      </div>
      <GuidelinesError domain={domain} className="" />
      <GuidelinesPreview domain={domain} onReplace={open} />
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
