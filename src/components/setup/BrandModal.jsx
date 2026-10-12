import { useEffect, useRef, useState } from 'react'
import { Check, Globe, Info, Loader2, Tag } from 'lucide-react'
import Modal from '../ui/Modal'
import { PrimaryButton } from '../dashboard/overlays'
import ChipField from './ChipField'
import ConfirmPopover from '../prompts/ConfirmPopover'
import { brandName } from '../../utils/brand'
import { isValidDomain, normalizeDomain } from '../../utils/domain'
import { MAX_COMPETITORS } from '../../data/mock'

const SAVE_MS = 600 // mock round-trip so "Adding…" is visible
const fieldCls = 'h-9 w-full appearance-none rounded-md border bg-raised px-3 text-[14px] text-stone-900 outline-none placeholder:text-stone-500 transition-[border-color,box-shadow] duration-150 ease-out'
const focusRing = 'focus-within:ring-[3px] focus-within:ring-[color-mix(in_srgb,var(--ink)_8%,transparent)]'
const okBorder = 'border-line focus-within:border-[color-mix(in_srgb,var(--ink)_35%,transparent)]'
const badBorder = 'border-negative'
const ghostBtn = 'inline-flex h-9 items-center rounded-lg px-3 text-small font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
const TYPES = [
  { value: 'website', icon: Globe, title: 'Website', sub: 'You have a domain' },
  { value: 'name', icon: Tag, title: 'Brand name', sub: 'No website needed' },
]
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

const blank = { type: 'website', site: '', displayName: '', brand: '', aliases: [], competitors: [] }

// What the form looks like for a saved brand (also the baseline for the edit dirty check).
const fromBrand = (b) => ({
  type: b.type,
  site: b.domain ?? '',
  displayName: b.type === 'website' ? (b.displayName ?? '') : '', // never set → empty, the placeholder shows brandName(domain)
  brand: b.type === 'name' ? b.name : '',
  aliases: b.aliases ?? [],
  competitors: [...b.competitors],
})
const snapshot = (f) => JSON.stringify({ ...f, site: normalizeDomain(f.site), displayName: f.displayName.trim(), brand: f.brand.trim() })

// mode 'add' | 'edit' (edit needs `brand`). takenDomains: domains other brands already use.
// Edit: fixed type (pill), dirty-checked Save, a danger zone, and a "Discard changes?" guard on close.
export default function BrandModal({ open, mode = 'add', brand, takenDomains, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(blank)
  const [guard, setGuard] = useState(null) // { kind: 'discard' | 'delete', anchor }
  const baseline = useRef(snapshot(blank))
  const cancelRef = useRef(null)
  const [touched, setTouched] = useState({}) // errors only show after blur or a submit attempt
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const timer = useRef(null)
  const editing = mode === 'edit' && Boolean(brand)

  useEffect(() => {
    if (!open) return
    clearTimeout(timer.current)
    setSaving(false); setTouched({}); setSubmitted(false); setGuard(null)
    const start = editing ? fromBrand(brand) : blank
    setForm(start)
    baseline.current = snapshot(start)
  }, [open, brand, editing])
  useEffect(() => () => clearTimeout(timer.current), [])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  // a blur only flags what was actually typed (e.g. a bad domain); empty required fields wait for a submit attempt
  const touch = (k, val) => { if (String(val ?? '').trim()) setTouched((t) => ({ ...t, [k]: true })) }
  const domain = normalizeDomain(form.site)
  const domainOk = isValidDomain(domain)

  // validation (computed always; shown only when touched / submitted)
  const errs = {}
  if (form.type === 'website') {
    if (!domainOk) errs.site = 'Enter a valid domain, e.g. dermasuri.com'
    else if (takenDomains.includes(domain)) errs.site = 'This site is already tracked'
  } else if (!form.brand.trim()) errs.brand = 'Enter the brand name'
  if (!form.competitors.length) errs.competitors = 'Add at least one competitor'
  const valid = !Object.keys(errs).length
  const dirty = snapshot(form) !== baseline.current
  const domainChanged = editing && form.type === 'website' && domainOk && domain !== brand.domain
  const show = (k) => (touched[k] || submitted) && errs[k]

  const finalName = form.type === 'website' ? (form.displayName.trim() || brandName(domain)) : form.brand.trim()
  const submit = () => {
    setSubmitted(true)
    if (!valid || saving || (editing && !dirty)) return
    setSaving(true)
    timer.current = setTimeout(() => {
      onSave({
        type: form.type,
        name: finalName,
        displayName: form.type === 'website' ? (form.displayName.trim() || null) : null,
        domain: form.type === 'website' ? domain : null,
        aliases: form.aliases, // website brands edit aliases on the card; keep them
        competitors: form.competitors,
      })
    }, SAVE_MS)
  }

  // arrow keys move between the two type cards (radiogroup)
  const onTypeKey = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    e.preventDefault()
    const next = form.type === 'website' ? 'name' : 'website'
    set({ type: next })
    e.currentTarget.querySelector(`[data-type="${next}"]`)?.focus()
  }

  // Esc / X / overlay / Cancel: ask first if there are unsaved edits
  const requestClose = () => {
    if (saving) return
    if (editing && dirty) setGuard({ kind: 'discard', anchor: cancelRef.current })
    else onClose()
  }

  const counterFull = form.competitors.length >= MAX_COMPETITORS
  const footer = (
    <>
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
      title={editing ? (
        <span className="flex items-center gap-2">
          Edit brand
          <span className="inline-flex h-5 items-center rounded bg-tint px-1.5 text-[11px] leading-none font-medium text-stone-600">{brand.type === 'website' ? 'Website' : 'Brand name'}</span>
        </span>
      ) : 'Add brand'}
      subtitle={editing ? (brand.domain ?? 'No website') : 'Track a website, or a brand without one.'}
      footer={footer}
    >
      <form noValidate onSubmit={(e) => { e.preventDefault(); submit() }} className="flex flex-col gap-4">
        {/* type: chosen when adding, fixed when editing (shown as the pill by the title) */}
        {!editing && <div role="radiogroup" aria-label="Brand type" onKeyDown={onTypeKey} className="grid grid-cols-2 gap-3">
          {TYPES.map(({ value, icon: Icon, title, sub }) => {
            const on = form.type === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                data-type={value}
                tabIndex={on ? 0 : -1}
                onClick={() => set({ type: value })}
                // selected = 1.5px ink edge: 1px border + a 0.5px shadow (browsers snap a 1.5px border down to 1px)
                className={`relative rounded-lg border p-3.5 text-left outline-none transition-[border-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'border-ink shadow-[0_0_0_0.5px_var(--ink)]' : 'border-line hover:border-[var(--color-line-strong)]'}`}
              >
                {on && (
                  <span aria-hidden className="absolute right-2.5 top-2.5 grid h-4 w-4 place-items-center rounded-full bg-ink text-on-ink">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
                <Icon size={16} className="text-stone-700" aria-hidden />
                <div className="mt-2 text-[14px] leading-5 font-medium text-stone-900">{title}</div>
                <div className="text-[12px] leading-4 text-stone-600">{sub}</div>
              </button>
            )
          })}
        </div>}

        {/* fields: both layouts reserve the same height, so switching type doesn't jump */}
        <div key={form.type} className={`fade-in flex flex-col gap-4 ${editing ? '' : 'min-h-[142px]'}`}>
          {form.type === 'website' ? (
            <>
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
                    placeholder="dermasuri.com"
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
                  placeholder={domainOk ? brandName(domain) : 'Dermasuri'}
                  value={form.displayName}
                  onChange={(e) => set({ displayName: e.target.value })}
                  className={`${fieldCls} ${okBorder} focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--ink)_8%,transparent)] focus:border-[color-mix(in_srgb,var(--ink)_35%,transparent)]`}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label htmlFor="brand-name">Brand name</Label>
                <input
                  id="brand-name"
                  data-autofocus
                  placeholder="Dermasuri"
                  value={form.brand}
                  aria-invalid={Boolean(show('brand'))}
                  onChange={(e) => set({ brand: e.target.value })}
                  onBlur={() => touch('brand', form.brand)}
                  className={`${fieldCls} ${show('brand') ? badBorder : okBorder} focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--ink)_8%,transparent)]`}
                />
                <Err>{show('brand')}</Err>
              </div>
              <div>
                <Label htmlFor="brand-aliases" optional>Aliases</Label>
                <ChipField id="brand-aliases" ariaLabel="Aliases" value={form.aliases} onChange={(aliases) => set({ aliases })} placeholder="Derma Suri" max={5} />
              </div>
            </>
          )}
        </div>

        {/* competitors */}
        <div>
          <Label
            htmlFor="brand-competitors"
            right={<span className={`text-[12px] leading-4 tabular-nums ${counterFull ? 'text-stone-900' : 'text-stone-500'}`}>{form.competitors.length} / {MAX_COMPETITORS}</span>}
          >
            Competitors
          </Label>
          <ChipField
            id="brand-competitors"
            ariaLabel="Competitors"
            ariaDescribedBy="brand-competitors-help"
            value={form.competitors}
            onChange={(competitors) => set({ competitors })}
            max={MAX_COMPETITORS}
            placeholder="cerave.com"
            reject={(v) => form.type === 'website' && v === domain} // the brand's own site
            onBlur={() => touch('competitors', form.competitors.join(''))}
          />
          {show('competitors') && !form.competitors.length
            ? <Err>{errs.competitors}</Err>
            : <p id="brand-competitors-help" className="mt-1.5 text-[12px] leading-4 text-stone-600">{counterFull ? 'Maximum reached' : `Add 1–${MAX_COMPETITORS} brands you compete with. Domain or name.`}</p>}
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
            : { title: `Delete ${brand.name}?`, body: 'This can’t be undone.', confirmLabel: 'Delete', onConfirm: () => { setGuard(null); onDelete?.(brand) } })}
          onCancel={() => setGuard(null)}
        />
      )}
    </Modal>
  )
}
