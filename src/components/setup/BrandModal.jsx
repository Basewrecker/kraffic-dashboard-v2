import { useEffect, useRef, useState } from 'react'
import { Globe, Info, Loader2, Type } from 'lucide-react'
import Modal from '../ui/Modal'
import { PrimaryButton } from '../dashboard/overlays'
import ChipField from './ChipField'
import ConfirmPopover from '../prompts/ConfirmPopover'
import { brandName, isDomain } from '../../utils/brand'
import { isValidDomain, normalizeDomain } from '../../utils/domain'
import { MAX_COMPETITORS } from '../../data/mock'

const fieldCls = 'h-9 w-full appearance-none rounded-md border bg-raised px-3 text-[14px] text-stone-900 outline-none placeholder:text-stone-500 transition-[border-color,box-shadow] duration-150 ease-out'
const focusRing = 'focus-within:ring-[3px] focus-within:ring-[color-mix(in_srgb,var(--ink)_8%,transparent)]'
const okBorder = 'border-line focus-within:border-[color-mix(in_srgb,var(--ink)_35%,transparent)]'
const badBorder = 'border-negative'
const ghostBtn = 'inline-flex h-9 items-center rounded-lg px-3 text-small font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
const Spinner = (props) => <Loader2 {...props} size={14} className="animate-spin motion-reduce:animate-none" />

function Label({ htmlFor, children, optional, right }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-[13px] leading-[18px] font-medium text-stone-900">
        {children}{optional && <span className="font-normal text-stone-500"> (optional)</span>}
      </label>
      {right}
    </div>
  )
}
const Err = ({ id, children }) => children ? <p id={id} role="alert" className="mt-1.5 text-[12px] leading-4 text-negative">{children}</p> : null

// Favicon for a valid domain; a letter tile if it can't load (offline, unknown site).
function SiteIcon({ domain }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [domain])
  if (failed) return <span aria-hidden className="grid h-4 w-4 place-items-center rounded-sm bg-tint text-[10px] font-semibold text-stone-600">{brandName(domain)[0]}</span>
  return <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`} alt="" width={16} height={16} className="h-4 w-4 rounded-sm" onError={() => setFailed(true)} />
}

// every brand has a website (the app tracks a brand by its site)
const blank = { site: '', displayName: '', aliases: [], competitors: [] }

// What the form looks like for a saved brand (also the baseline for the edit dirty check).
const fromBrand = (b) => ({
  site: b.domain ?? '',
  displayName: b.name && b.name !== brandName(b.domain ?? '') ? b.name : '', // the name the domain suggests → empty
  aliases: b.aliases ?? [],
  competitors: b.competitors.map((c) => c.domain),
})
const snapshot = (f) => JSON.stringify({ ...f, site: normalizeDomain(f.site), displayName: f.displayName.trim() })

// mode 'add' | 'edit' (edit needs `brand`). takenDomains: domains other brands already use.
// Edit: dirty-checked Save, a danger zone, and a "Discard changes?" guard on close. Aliases are set when a brand is
// added; in Edit they're shown, not edited. onSave / onDelete return promises: the modal waits ("Saving…") and says
// so if they fail, so the user can try again. Competitors are domains (a name alone can't be tracked).
export default function BrandModal({ open, mode = 'add', brand, takenDomains, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(blank)
  const [guard, setGuard] = useState(null) // { kind: 'discard' | 'delete', anchor }
  const baseline = useRef(snapshot(blank))
  const cancelRef = useRef(null)
  const [touched, setTouched] = useState({}) // errors only show after blur or a submit attempt
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(null) // what couldn't be saved
  const editing = mode === 'edit' && Boolean(brand)

  useEffect(() => {
    if (!open) return
    setSaving(false); setFailed(null); setTouched({}); setSubmitted(false); setGuard(null)
    const start = editing ? fromBrand(brand) : blank
    setForm(start)
    baseline.current = snapshot(start)
  }, [open, brand, editing])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  // a blur only flags what was actually typed (e.g. a bad domain); empty required fields wait for a submit attempt
  const touch = (k, val) => { if (String(val ?? '').trim()) setTouched((t) => ({ ...t, [k]: true })) }
  const domain = normalizeDomain(form.site)
  const domainOk = isValidDomain(domain)

  // validation (computed always; shown only when touched / submitted)
  const errs = {}
  if (!domainOk) errs.site = 'Enter a valid domain, e.g. yourbrand.com'
  else if (takenDomains.includes(domain)) errs.site = 'This site is already tracked'
  if (!form.competitors.length) errs.competitors = 'Add at least one competitor'
  const valid = !Object.keys(errs).length
  const dirty = snapshot(form) !== baseline.current
  const domainChanged = editing && domainOk && domain !== brand.domain
  const show = (k) => (touched[k] || submitted) && errs[k]

  const finalName = form.displayName.trim() || brandName(domain)
  const submit = () => {
    setSubmitted(true)
    if (!valid || saving || (editing && !dirty)) return
    setSaving(true); setFailed(null)
    Promise.resolve(onSave({ name: finalName, domain, aliases: form.aliases, competitors: form.competitors }))
      .catch(() => { setSaving(false); setFailed(editing ? 'Couldn’t save your changes. Try again.' : 'Couldn’t add this brand. Try again.') })
  }
  const remove = () => {
    setGuard(null); setSaving(true); setFailed(null)
    Promise.resolve(onDelete?.(brand)).catch(() => { setSaving(false); setFailed(`Couldn’t delete ${brand.name}. Try again.`) })
  }

  // Esc / X / overlay / Cancel: ask first if there are unsaved edits
  const requestClose = () => {
    if (saving) return
    if (editing && dirty) setGuard({ kind: 'discard', anchor: cancelRef.current })
    else onClose()
  }

  // a limit only when the app sets one (none while billing isn't live)
  const counterFull = MAX_COMPETITORS != null && form.competitors.length >= MAX_COMPETITORS
  const footer = (
    <>
      {failed && <p role="alert" className="mr-auto text-[12.5px] leading-[18px] text-negative">{failed}</p>}
      <button ref={cancelRef} type="button" onClick={requestClose} className={ghostBtn}>Cancel</button>
      <PrimaryButton size="sm" disabled={!valid || saving || (editing && !dirty)} onClick={submit} icon={saving ? Spinner : undefined} aria-busy={saving || undefined}>
        {saving ? (editing ? 'Saving…' : 'Adding…') : editing ? 'Save changes' : 'Add brand'}
      </PrimaryButton>
    </>
  )

  return (
    <Modal
      open={open}
      onClose={requestClose}
      size="md"
      title={editing ? 'Edit brand' : 'Add brand'}
      subtitle={editing ? brand.domain : 'Track a brand by its website.'}
      footer={footer}
    >
      <form noValidate onSubmit={(e) => { e.preventDefault(); submit() }} className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="brand-site">Website</Label>
            <div className={`flex h-9 items-center overflow-hidden rounded-md border bg-raised transition-[border-color,box-shadow] duration-150 ease-out ${focusRing} ${show('site') ? badBorder : okBorder}`}>
              <span className="flex h-full shrink-0 items-center border-r border-line px-2.5 text-[13px] text-stone-500 select-none">https://</span>
              <input
                id="brand-site"
                data-autofocus
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="yourbrand.com"
                value={form.site}
                aria-invalid={Boolean(show('site'))}
                aria-describedby={show('site') ? 'brand-site-err' : undefined}
                onChange={(e) => set({ site: e.target.value })}
                onBlur={() => { touch('site', form.site); if (domain) set({ site: domain }) }} // normalise: no protocol, www or path
                className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-[14px] text-stone-900 outline-none placeholder:text-stone-500"
              />
              {domainOk && !errs.site && <span className="pr-2.5"><SiteIcon domain={domain} /></span>}
            </div>
            <Err id="brand-site-err">{show('site')}</Err>
            {domainChanged && !show('site') && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-4 text-stone-600">
                <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
                Changing the domain starts a fresh sync. Past results stay under {brand.domain}.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="brand-display" optional>Display name</Label>
            <input
              id="brand-display"
              placeholder={domainOk ? brandName(domain) : 'Your brand'}
              value={form.displayName}
              onChange={(e) => set({ displayName: e.target.value })}
              className={`${fieldCls} ${okBorder} focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--ink)_8%,transparent)] focus:border-[color-mix(in_srgb,var(--ink)_35%,transparent)]`}
            />
          </div>
          {/* aliases: chosen when adding; shown read-only when editing (the app can't change them yet) */}
          <div>
            <Label htmlFor="brand-aliases" optional={!editing}>Aliases</Label>
            {editing ? (
              form.aliases.length ? (
                <div id="brand-aliases" className="flex flex-wrap gap-1.5">
                  {form.aliases.map((a) => (
                    <span key={a} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[13px] text-stone-900">
                      {isDomain(a) ? <Globe size={13} className="text-stone-500" aria-hidden /> : <Type size={13} className="text-stone-500" aria-hidden />}{a}
                    </span>
                  ))}
                </div>
              ) : <p id="brand-aliases" className="text-[13px] leading-[18px] text-stone-500">No other names</p>
            ) : (
              <ChipField id="brand-aliases" ariaLabel="Aliases" value={form.aliases} onChange={(aliases) => set({ aliases })} placeholder="Derma Suri" max={5} />
            )}
          </div>
        </div>

        {/* competitors */}
        <div>
          <Label
            htmlFor="brand-competitors"
            right={MAX_COMPETITORS != null ? <span className={`text-[12px] leading-4 tabular-nums ${counterFull ? 'text-stone-900' : 'text-stone-500'}`}>{form.competitors.length} / {MAX_COMPETITORS}</span> : null}
          >
            Competitors
          </Label>
          <ChipField
            id="brand-competitors"
            ariaLabel="Competitors"
            ariaDescribedBy="brand-competitors-help"
            value={form.competitors}
            onChange={(competitors) => set({ competitors })}
            max={MAX_COMPETITORS ?? Infinity}
            placeholder="competitor.com"
            reject={(v) => !isDomain(v) || v === domain} // a domain, and not the brand's own site
            onBlur={() => touch('competitors', form.competitors.join(''))}
          />
          {show('competitors') && !form.competitors.length
            ? <Err>{errs.competitors}</Err>
            : <p id="brand-competitors-help" className="mt-1.5 text-[12px] leading-4 text-stone-600">{counterFull ? 'Maximum reached' : 'Add the sites of brands you compete with, e.g. competitor.com.'}</p>}
        </div>
        {editing && (
          <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
            <div className="min-w-0">
              <p className="text-[13px] leading-[18px] font-medium text-stone-900">Delete brand</p>
              <p className="text-[12px] leading-4 text-stone-600 tabular-nums">Removes {brand.name}, its {brand.prompts} prompt{brand.prompts === 1 ? '' : 's'} and history.</p>
            </div>
            <button
              type="button"
              onClick={(e) => setGuard({ kind: 'delete', anchor: e.currentTarget })}
              className="inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-[13px] font-medium text-negative outline-none transition-colors duration-150 hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-focus"
            >
              Delete
            </button>
          </div>
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
      {guard && (
        <ConfirmPopover
          anchor={guard.anchor}
          {...(guard.kind === 'discard'
            ? { title: 'Discard changes?', body: 'Your edits to this brand will be lost.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', onConfirm: () => { setGuard(null); onClose() } }
            : { title: `Delete ${brand.name}?`, body: 'This can’t be undone.', confirmLabel: 'Delete', onConfirm: remove })}
          onCancel={() => setGuard(null)}
        />
      )}
    </Modal>
  )
}
