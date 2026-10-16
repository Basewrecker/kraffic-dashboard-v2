import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Loader2, Sparkles, Upload } from 'lucide-react'
import { PrimaryButton, SecondaryButton } from '../dashboard/overlays'
import ImportModal from '../prompts/ImportModal'
import ResearchModal from '../prompts/ResearchModal'
import { linkClick } from '../../router'
import { firstSetupActions } from '../../data/mock'
import { fieldCls, stepCard, stepFooter, t2, t3, textBtn } from './ui'

const RECENT = 5
const STEP_MS = 900
const Spinner = (props) => <Loader2 {...props} className="animate-spin motion-reduce:animate-none" />

// Step 3 — prompts (at least one), all without leaving the page: type one, import a CSV (Prompt Hub's Import, with its
// drop zone) or find them (Prompt Hub's research, after a step-by-step read of the site). Shows how many are in and
// the last 5 added. New ones stay in the page (and a local draft, so a refresh keeps them) until Continue saves them all
// in one request — saving prompts starts the first scan, so it happens once.
const draftKey = (brand) => `kraffic:first-setup:prompts:${brand?.id ?? brand?.name ?? 'new'}`
const readDraft = (brand) => { try { return JSON.parse(localStorage.getItem(draftKey(brand))) || [] } catch { return [] } }
const writeDraft = (brand, items) => { try { if (items.length) localStorage.setItem(draftKey(brand), JSON.stringify(items)); else localStorage.removeItem(draftKey(brand)) } catch { /* private mode */ } }

export default function PromptsStep({ brand, prompts, competitors, update, toast, onContinue }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const unsaved = prompts.filter((p) => p.unsaved)
  // a draft from before a refresh comes back (the ones not saved since)
  useEffect(() => {
    const draft = readDraft(brand).filter((d) => !prompts.some((p) => p.text.toLowerCase() === d.text.toLowerCase()))
    if (draft.length) update((s) => ({ prompts: [...draft.map((d, i) => ({ id: `draft${i}`, text: d.text, unsaved: true })), ...s.prompts] }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { writeDraft(brand, unsaved.map((p) => ({ text: p.text }))) }, [unsaved.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const [modal, setModal] = useState(null) // 'import' | 'research'
  const [finding, setFinding] = useState(null) // the research step that's running (index), null when idle
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const trackedTexts = useMemo(() => new Set(prompts.map((p) => p.text.toLowerCase())), [prompts])
  const dupe = text.trim() && trackedTexts.has(text.trim().toLowerCase())

  // the page shows them at once, not saved yet (Continue saves them together)
  const insert = (items) => {
    const fresh = items.filter((it) => !trackedTexts.has(it.text.toLowerCase())).map((it, i) => ({ id: `tmp${Date.now()}${i}`, text: it.text, unsaved: true }))
    if (!fresh.length) return 0
    update((s) => ({ prompts: [...fresh.slice().reverse(), ...s.prompts] }))
    return fresh.length
  }
  // Continue: the unsaved ones in one request (it can't run twice: the button waits for it); a failure keeps the list
  const saveAndContinue = () => {
    if (saving) return
    if (!unsaved.length) { onContinue(); return }
    setSaving(true)
    setFailed(false)
    firstSetupActions.onSavePrompts(unsaved.map((p) => ({ text: p.text }))).then(
      (saved) => {
        update((s) => ({ prompts: s.prompts.map((p) => { const i = unsaved.findIndex((u) => u.id === p.id); return i < 0 ? p : { id: saved[i]?.id ?? p.id, text: p.text } }) }))
        writeDraft(brand, [])
        setSaving(false)
        onContinue()
      },
      () => { setSaving(false); setFailed(true) },
    )
  }
  const addTyped = (e) => {
    e.preventDefault()
    if (!text.trim() || dupe) return
    insert([{ text: text.trim() }])
    setText('')
  }

  // Find prompts: what research reads, one step at a time, then its results to pick from
  const steps = [
    brand?.domain ? `Reading ${brand.domain}` : `Reading answers that name ${brand?.name ?? 'your brand'}`,
    competitors.length ? `Reading ${competitors.length === 1 ? competitors[0].name : `${competitors.length} competitors’ sites`}` : 'Reading competitors’ sites',
    'Writing the questions people ask',
  ]
  const find = () => {
    setFinding(0)
    const tick = (i) => {
      timer.current = setTimeout(() => {
        if (i + 1 < steps.length) { setFinding(i + 1); tick(i + 1) } else { setFinding(null); setModal('research') }
      }, STEP_MS)
    }
    tick(0)
  }

  const recent = prompts.slice(0, RECENT)
  return (
    <section aria-label="Prompts" className={stepCard}>
      <div className="flex flex-col gap-3 px-5 py-4 max-md:px-4">
        <form onSubmit={addTyped} className="flex gap-2">
          <input aria-label="Prompt" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a prompt and press Enter" className={`${fieldCls} flex-1`} aria-invalid={Boolean(dupe)} />
          <SecondaryButton size="sm" type="submit" disabled={!text.trim() || dupe}>Add</SecondaryButton>
        </form>
        {dupe && <p role="alert" className={`-mt-1 text-[12px] leading-4 ${t2}`}>Already added</p>}
        {finding == null ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className={`text-[13px] leading-[18px] ${t3}`}>or</span>
            <button type="button" onClick={() => setModal('import')} className={`${textBtn} h-8`}><Upload size={14} aria-hidden />Import CSV</button>
            <button type="button" onClick={find} className={`${textBtn} h-8`}><Sparkles size={14} aria-hidden />Find prompts</button>
          </div>
        ) : (
          <ol aria-label="Finding prompts" aria-live="polite" className="flex flex-col gap-1.5 py-1">
            {steps.map((label, i) => (
              <li key={label} className={`flex h-6 items-center gap-2.5 text-[13px] leading-[18px] ${i < finding ? t2 : i === finding ? 'text-stone-900' : t3}`}>
                <span className="grid w-4 place-items-center" aria-hidden>
                  {i < finding ? <Check size={14} className="text-ink" /> : i === finding ? <Spinner size={14} /> : <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-track)]" />}
                </span>
                {label}{i === finding && '…'}
              </li>
            ))}
          </ol>
        )}
      </div>

      {prompts.length > 0 ? (
        <div className="border-t border-[var(--div)]">
          <div className="flex h-11 items-center justify-between gap-3 px-5 max-md:px-4">
            <span className="text-[14px] leading-5 font-medium text-stone-900 tabular-nums">{prompts.length} {prompts.length === 1 ? 'prompt' : 'prompts'} added{unsaved.length > 0 && <span className={`font-normal ${t3}`}> · {unsaved.length === prompts.length ? 'saved' : `${unsaved.length} saved`} when you continue</span>}</span>
            <a href="/tracker" onClick={linkClick('/tracker')} className={textBtn}>View all in Prompt Hub <ArrowRight size={14} aria-hidden /></a>
          </div>
          <ul aria-label={`Last ${recent.length} added`} className="divide-y divide-[var(--div)] border-t border-[var(--div)]">
            {recent.map((p) => <li key={p.id} className="flex h-11 items-center truncate px-5 text-[14px] leading-5 text-stone-900 max-md:px-4" title={p.text}><span className="truncate">{p.text}</span></li>)}
          </ul>
        </div>
      ) : null}
      <div className={`${stepFooter} ${prompts.length && !failed ? '!justify-end' : ''}`}>
        {!prompts.length && <span className={`text-[13px] leading-[18px] ${t3}`}>No prompts yet</span>}
        {failed && <span role="alert" className="text-[13px] leading-[18px] text-negative">Couldn’t save the prompts. Try again.</span>}
        <PrimaryButton size="sm" disabled={!prompts.length || saving} onClick={saveAndContinue} icon={saving ? Spinner : undefined} aria-busy={saving || undefined}>
          {saving ? 'Saving…' : failed ? 'Try again' : 'Continue'}
        </PrimaryButton>
      </div>

      <ImportModal open={modal === 'import'} onClose={() => setModal(null)} trackedTexts={trackedTexts}
        onImport={(rows) => insert(rows)} onView={() => setModal(null)} />
      <ResearchModal open={modal === 'research'} onClose={() => setModal(null)} trackedTexts={trackedTexts}
        onAdd={(items) => { const n = insert(items); setModal(null); if (n) toast(`${n} ${n === 1 ? 'prompt' : 'prompts'} added`) }} />
    </section>
  )
}
