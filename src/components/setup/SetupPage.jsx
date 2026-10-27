import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, Droplet, Eye, Globe, Hand, MoreHorizontal, Pencil, Plus, ShieldCheck, Sparkles, Sun, Tag, Type, X } from 'lucide-react'
import PromptTable from '../dashboard/PromptTable'
import { PrimaryButton, useToast } from '../dashboard/overlays'
import ConfirmPopover from '../prompts/ConfirmPopover'
import SiteLogo from '../ui/SiteLogo'
import BrandModal from './BrandModal'
import { useInlineEdit } from '../../hooks/useInlineEdit'
import { useAnimatedList } from '../../hooks/useAnimatedList'
import { linkClick, navigate } from '../../router'
import { fmtDay, trackingSummary, useTracking } from '../../store/trackingSettings'
import { brandName, isDomain } from '../../utils/brand'
import { isValidDomain, normalizeDomain } from '../../utils/domain'
import { MAX_COMPETITORS, account, setupActions, setupBrands } from '../../data/mock'
import { sharedAnswers } from '../../data/brandViews'
import { guessTopicType } from '../../data/topics'

// /setup: what Kraffic tracks for a brand, in the same settings layout as /llm-settings —
// cards of 60px rows (name + meta left, one quiet value + hover-only Edit / Remove right),
// a "+ Add" that opens an input row at the top, and a "Suggested" strip at the foot of a card.
// Every add / edit / remove gives an Undo toast. Saves go through setupActions (data/mock.js): the page changes first;
// a save that fails puts it back and the card says so, with Retry.

const CARDS_MAX = 6 // more brands than this → a table with pagination instead of cards
const fieldCls = 'h-8 w-full min-w-0 appearance-none rounded-md border border-line bg-raised px-2.5 text-[14px] text-stone-900 outline-none placeholder:text-stone-500 transition-[border-color,box-shadow] duration-150 ease-out focus:border-[color-mix(in_srgb,var(--ink)_35%,transparent)] focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--ink)_8%,transparent)]'
const iconBtn = 'grid h-7 w-7 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 ease-out hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
const textBtn = 'inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 ease-out hover:text-ink focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-40'
const smallBtn = 'inline-flex h-8 shrink-0 items-center rounded-md px-3 text-[13px] font-medium outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-40'
const rowAnim = (state) => (state === 'enter' ? 'srow-in' : state === 'leaving' ? 'srow-out' : '')
// favicons sit on a white plate in both themes so white / light logos stay visible
export const Logo = ({ domain, name }) => <SiteLogo domain={domain} name={name} className="h-7 w-7 rounded-md" imgPad="p-1" initialClass="text-[12px]" plate bordered={false} />

// ---------------------------------------------------------------- frame

function Menu({ items, label: aria }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const trigger = useRef(null)
  useEffect(() => {
    if (!open) return
    ref.current?.querySelector('[role=menuitem]')?.focus()
    const onDown = (e) => { if (!ref.current?.parentElement.contains(e.target)) setOpen(false) }
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); trigger.current?.focus() }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const all = [...ref.current.querySelectorAll('[role=menuitem]')], i = all.indexOf(document.activeElement)
        all[(i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length]?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className="relative">
      <button ref={trigger} type="button" aria-label={aria} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`${iconBtn} !h-8 !w-8`}>
        <MoreHorizontal size={16} aria-hidden />
      </button>
      {open && (
        <div ref={ref} role="menu" className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-line bg-overlay p-1 shadow-lg">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); it.onSelect(trigger.current) }}
              className={`flex h-8 w-full items-center rounded-md px-2.5 text-left text-[13px] font-medium outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint ${it.danger ? 'text-negative' : 'text-stone-700 hover:text-stone-900'}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// compact: header pt-4 pb-3 with no rule under it, and `body` (a chip line) instead of a list of rows
export function SettingsCard({ title, count, description, action, footer, children, body, id, label: aria, compact }) {
  return (
    <section id={id} aria-label={aria ?? title} className="scroll-mt-6 overflow-hidden rounded-[14px] border border-line bg-surface">
      {title && (
        <header className={`flex items-start justify-between gap-4 px-5 ${compact ? 'pb-3 pt-4' : `pb-3.5 pt-[18px] ${children ? 'border-b border-[var(--div)]' : ''}`}`}>
          <div className="min-w-0">
            <h2 className="text-[15px] leading-5 font-semibold text-stone-900">
              {title}
              {count != null && <span className="ml-1.5 text-[13px] font-normal text-stone-500 tabular-nums">{count}</span>}
            </h2>
            <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600 tabular-nums">{description}</p>
          </div>
          {action && <div className="shrink-0 pt-0.5">{action}</div>}
        </header>
      )}
      {body}
      {children && <ul className="divide-y divide-[var(--div)]">{children}</ul>}
      {footer}
    </section>
  )
}

// header "+ Add"; at the limit it's disabled and the wrapper carries the tooltip (disabled buttons don't)
const AddButton = ({ onClick, disabled, disabledTitle }) => (
  <span title={disabled ? disabledTitle : undefined}>
    <button type="button" onClick={onClick} disabled={disabled} className={textBtn}><Plus size={14} aria-hidden /> Add</button>
  </span>
)

// one read-only row: [logo] name / meta … quiet value + hover-only Edit / Remove
export function Row({ logo, name, meta, value, valueTitle, muted, onEdit, onRemove, state }) {
  return (
    <li className={rowAnim(state)}>
      <div className="group flex h-[60px] items-center justify-between gap-4 px-5">
        <span className="flex min-w-0 items-center gap-3">
          {logo}
          <span className="min-w-0">
            <span className={`block truncate text-[14px] leading-5 font-medium ${muted ? 'text-stone-600' : 'text-stone-900'}`}>{name}</span>
            {meta && <span className="block truncate text-[12.5px] leading-[18px] text-stone-600 tabular-nums">{meta}</span>}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {value && <span title={valueTitle} className="whitespace-nowrap text-[13px] leading-[18px] text-stone-600 tabular-nums">{value}</span>}
          {(onEdit || onRemove) && (
            <span className="flex gap-0.5 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 touch:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
              {onEdit && <button type="button" aria-label={`Edit ${name}`} onClick={onEdit} className={iconBtn}><Pencil size={14} aria-hidden /></button>}
              {onRemove && <button type="button" aria-label={`Remove ${name}`} onClick={onRemove} className={iconBtn}><X size={14} aria-hidden /></button>}
            </span>
          )}
        </span>
      </div>
    </li>
  )
}

// an input row (add at the top, or a row being edited), on the shared inline-edit rules:
// Enter saves, Esc cancels, a click away saves (valid) / closes (clean) / discards with Undo (invalid).
// fields: [{ name, label, placeholder }]; validate(values) → error message or null; fixed: read-only text after the
// fields (what can't be changed, e.g. a competitor's domain).
export function InputRow({ logo, fields, fixed, initial, validate, submitLabel, onSubmit, onClose, onDiscard }) {
  const [values, setValues] = useState(initial)
  const ref = useRef(null)
  const clean = (v) => String(v ?? '').trim()
  const dirty = fields.some((f) => clean(values[f.name]) !== clean(initial[f.name]) || (initial.__draft && clean(values[f.name])))
  const filled = fields.every((f) => clean(values[f.name]))
  const error = filled ? validate(values) : null
  const valid = filled && !error
  const submit = () => { if (valid) onSubmit(values) }
  const { onKeyDown } = useInlineEdit({ ref, isDirty: dirty, isValid: valid, onSave: submit, onCancel: onClose, onDiscard: () => (onDiscard ?? onClose)(values) })
  return (
    <li ref={ref} onKeyDown={onKeyDown} className="srow-in px-5">
      <div className="flex h-[60px] items-center gap-3">
        {logo}
        {fields.map((f, i) => (
          <input
            key={f.name}
            autoFocus={i === 0}
            aria-label={f.label}
            aria-invalid={Boolean(error)}
            placeholder={f.placeholder}
            value={values[f.name] ?? ''}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            className={`${fieldCls} flex-1 ${error ? '!border-negative' : ''}`}
          />
        ))}
        {fixed && <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] text-stone-600">{fixed}</span>}
        <button type="button" disabled={!valid || !dirty} onClick={submit} title="Enter saves · Esc cancels" className={`${smallBtn} border border-line bg-surface text-stone-700 hover:bg-tint hover:text-stone-900`}>{submitLabel}</button>
        <button type="button" onClick={onClose} className={`${smallBtn} text-stone-600 hover:bg-tint hover:text-stone-900`}>Cancel</button>
      </div>
      {error && <p role="alert" className="-mt-2 pb-2.5 pl-10 text-[12px] leading-4 text-negative">{error}</p>}
    </li>
  )
}

// "Suggested" strip at the foot of a card; the reason is the chip's tooltip. With a market, the label names it and
// a market change crossfades the chips: out (150ms), swap, back in. onDismiss: each chip also has an X.
export function Suggested({ items, onPick, onDismiss, market, label: lead }) {
  const [shown, setShown] = useState({ items, market })
  const [fading, setFading] = useState(false)
  const sig = items.map((it) => it.key).join('|') // items is rebuilt every render; react to what's in it
  useEffect(() => {
    if (market === shown.market || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown({ items, market }); return }
    setFading(true)
    const t = setTimeout(() => { setShown({ items, market }); setFading(false) }, 150)
    return () => clearTimeout(t)
  }, [sig, market]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown.items.length) return null
  return (
    <div className={`flex flex-wrap items-center gap-2 border-t border-[var(--div)] bg-tint px-5 py-3 transition-opacity duration-150 ease-out ${fading ? 'opacity-0' : 'opacity-100'}`}>
      <span className="text-[12px] leading-4 font-medium text-stone-500">{lead ?? (shown.market ? `Suggested for ${shown.market}` : 'Suggested')}</span>
      {shown.items.map((it) => (
        <span key={it.key} className="inline-flex h-7 items-center rounded-md border border-line bg-surface text-[13px] leading-[18px] text-stone-700 transition-colors duration-150 ease-out hover:border-[var(--color-line-strong)]">
          <button
            type="button"
            title={it.reason}
            aria-label={`Add ${it.label}${it.reason ? ` · ${it.reason}` : ''}`}
            onClick={() => onPick(it)}
            className={`inline-flex h-full items-center gap-1 rounded-md pl-2.5 ${onDismiss ? 'pr-1' : 'pr-2.5'} outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus`}
          >
            <Plus size={12} aria-hidden /> {it.label}
          </button>
          {onDismiss && (
            <button type="button" aria-label={`Dismiss ${it.label}`} onClick={() => onDismiss(it)}
              className="mr-1 grid h-5 w-5 place-items-center rounded text-stone-500 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
              <X size={12} aria-hidden />
            </button>
          )}
        </span>
      ))}
    </div>
  )
}

// which row is open: null | 'new' | a row key; draft = values to reopen with after a discard's Undo
export function useEditing(toast) {
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(null)
  const open = (key) => { setDraft(null); setEditing(key) }
  const close = () => { setEditing(null); setDraft(null) }
  const discard = (key) => (values) => {
    close()
    toast('Changes discarded', { duration: 5000, action: { label: 'Undo', onClick: () => { setDraft({ ...values, __draft: true }); setEditing(key) } } })
  }
  return { editing, draft, open, close, discard }
}

// a card's save: the change shows at once (apply); the save runs (call); if it fails the change is taken back
// (revert) and the card says what failed, with Retry. call() may resolve with the saved item (done(saved)).
function useCardSave() {
  const [failed, setFailed] = useState(null) // { what, retry }
  const run = (what, { apply, revert, call, done }) => {
    setFailed(null)
    apply()
    return call().then((saved) => done?.(saved), () => { revert(); setFailed({ what, retry: () => run(what, { apply, revert, call, done }) }) })
  }
  return [failed, run]
}
const SaveFailed = ({ failed }) => (failed ? (
  <p role="alert" className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--div)] px-5 py-2.5 text-[12.5px] leading-[18px]">
    <span className="text-negative">Couldn’t save · {failed.what}</span>
    <button type="button" onClick={failed.retry} className="rounded font-medium text-stone-900 underline underline-offset-4 outline-none hover:opacity-75 focus-visible:ring-2 focus-visible:ring-focus">Retry</button>
  </p>
) : null)

// ---------------------------------------------------------------- cards

function BrandIdentity({ brand, syncing, onEdit, onDelete }) {
  const status = syncing ? 'Syncing…' : brand.lastSync ? `Tracking · updated ${brand.lastSync}` : 'Not synced yet'
  return (
    <SettingsCard label={`${brand.name} brand`}>
      <div className="flex min-h-[72px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3">
        <span className="flex min-w-0 items-center gap-3">
          <SiteLogo domain={brand.domain} name={brand.name} className="h-10 w-10 rounded-lg" imgPad="p-1.5" initialClass="text-[16px]" bordered={false} />
          <span className="min-w-0">
            <h2 className="truncate text-[16px] leading-6 font-semibold text-stone-900">{brand.name}</h2>
            <span className="flex items-center gap-1 text-[13px] leading-[18px] text-stone-600">
              {brand.domain && (
                <a href={`https://${brand.domain}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 rounded underline-offset-4 outline-none hover:text-stone-900 hover:underline focus-visible:ring-2 focus-visible:ring-focus">
                  {brand.domain}<ArrowUpRight size={12} aria-hidden />
                </a>
              )}
              {/* what's tracked: a website, or a name with no site of its own */}
              {brand.type && <>{brand.domain && <span aria-hidden>·</span>}{brand.type === 'website' ? 'Website' : 'Brand name'}</>}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] leading-[18px] text-stone-600">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink" />{status}
          </span>
          <button type="button" onClick={() => onEdit(brand)} className={`${smallBtn} border border-line bg-surface text-stone-700 hover:bg-tint hover:text-stone-900`}>Edit</button>
          <Menu
            label={`${brand.name} actions`}
            items={[
              { label: 'View dashboard', onSelect: () => navigate('/overview') },
              { label: 'Delete brand', danger: true, onSelect: (anchor) => onDelete(brand, anchor) },
            ]}
          />
        </span>
      </div>
    </SettingsCard>
  )
}

// a chip line's add control: a ghost "+ label" chip that turns into an input. Enter / comma adds and keeps it open;
// Esc or a click away closes it (a click away also adds what's typed, if valid). add(value) → error message or null.
function ChipAdder({ label, placeholder, shape, add }) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)
  const ref = useRef(null)
  const input = useRef(null)
  const tidy = (raw) => String(raw).trim().replace(/\s+/g, ' ')
  const tryAdd = () => {
    const v = tidy(draft)
    if (!v) return true
    const err = add(v)
    if (err) { setError(err); return false }
    setDraft(''); setError(null)
    return true
  }
  const close = () => { setAdding(false); setDraft(''); setError(null) }
  const { onKeyDown: editKeys } = useInlineEdit({ ref, active: adding, isDirty: Boolean(draft.trim()), isValid: true, onSave: () => { if (tryAdd()) close() }, onCancel: close })
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (draft.trim()) tryAdd(); else close(); return }
    editKeys(e)
  }
  return (
    <span ref={ref} className="relative inline-flex">
      {adding ? (
        <input ref={input} autoFocus aria-label={label} aria-invalid={Boolean(error)} placeholder={placeholder} value={draft}
          onChange={(e) => { setDraft(e.target.value.replace(/,/g, '')); setError(null) }} onKeyDown={onKeyDown}
          className={`${shape} w-44 border bg-raised px-2.5 text-stone-900 outline-none placeholder:text-stone-500 transition-[border-color,box-shadow] duration-150 focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--ink)_8%,transparent)] ${error ? 'border-negative' : 'border-line focus:border-[color-mix(in_srgb,var(--ink)_35%,transparent)]'}`} />
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className={`${shape} inline-flex items-center gap-1.5 border border-dashed border-[var(--dashed-border)] px-3 font-medium text-stone-600 outline-none transition-colors duration-150 hover:border-[var(--color-line-strong)] hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus`}>
          <Plus size={14} aria-hidden />{label}
        </button>
      )}
      {error && <span role="alert" className="absolute left-0 top-full mt-1 whitespace-nowrap text-[12px] leading-4 text-negative">{error}</span>}
    </span>
  )
}

const animClass = (state) => (state === 'enter' ? 'chip-in' : state === 'leaving' ? 'chip-out' : '')

// "Also counts as": one line of chips, the brand's name variants (an answer naming one counts as a mention of the brand),
// each with how many answers counted it when that's known. Add one with Add; remove one with its × (Undo in the toast).
// A backend that can't save them (no onAddAlias) shows them read-only, and nothing when there are none.
function NamesCard({ brand, update, toast }) {
  const aliases = brand.aliases ?? []
  const editable = Boolean(setupActions.onAddAlias)
  const chips = useAnimatedList(aliases, (a) => a, 150)
  const [failed, save] = useCardSave()
  // no aliases and nothing to add with: no card (nothing to show or add)
  if (!aliases.length && !editable) return null
  const counts = brand.aliasAnswers // null: not known, so no counts
  const shape = 'h-9 rounded-lg text-[14px]'
  const setList = (fn) => update((b) => ({ ...b, aliases: fn(b.aliases ?? []) }))
  const problem = (v) => {
    const low = v.toLowerCase()
    if (low === String(brand.name).toLowerCase() || low === String(brand.domain ?? '').toLowerCase()) return 'That’s the brand itself'
    return aliases.some((x) => x.toLowerCase() === low) ? 'Already added' : null
  }
  const add = (name) => save(`“${name}”`, {
    apply: () => setList((xs) => [...xs, name]),
    revert: () => setList((xs) => xs.filter((x) => x !== name)),
    call: () => setupActions.onAddAlias(brand.id, name),
    done: () => toast(`“${name}” added`),
  })
  const restore = (name, i) => save(`“${name}”`, {
    apply: () => setList((xs) => (xs.includes(name) ? xs : [...xs.slice(0, i), name, ...xs.slice(i)])),
    revert: () => setList((xs) => xs.filter((x) => x !== name)),
    call: () => setupActions.onAddAlias(brand.id, name),
  })
  const remove = (name) => {
    const i = aliases.indexOf(name)
    save(`“${name}”`, {
      apply: () => setList((xs) => xs.filter((x) => x !== name)),
      revert: () => setList((xs) => (xs.includes(name) ? xs : [...xs.slice(0, i), name, ...xs.slice(i)])),
      call: () => setupActions.onRemoveAlias(brand.id, name),
      done: () => toast(`“${name}” removed`, { duration: 5000, action: { label: 'Undo', onClick: () => restore(name, i) } }),
    })
  }

  return (
    <SettingsCard id={`aliases-${brand.id}`} title="Also counts as" count={aliases.length} description={`Name variants that count as a ${brand.name} mention`} compact
      body={(
        <>
          <div className="flex flex-wrap items-center gap-2.5 px-5 pb-4">
            {chips.map(({ item: a, key, state }) => {
              const Icon = isDomain(a) ? Globe : Type // what kind of variant: a domain / URL, or a name
              const seen = counts?.[a] ?? 0
              return (
              <span key={key} className={`${shape} inline-flex items-center gap-2 border border-line bg-surface pl-2.5 ${editable ? 'pr-1' : 'pr-3'} font-medium text-stone-900 ${animClass(state)}`}>
                <Icon size={16} className="shrink-0 text-stone-500" aria-label={isDomain(a) ? 'Domain' : 'Name'} />
                {a}
                {counts && (
                  <span title={seen ? `Counted in ${seen} answer${seen === 1 ? '' : 's'}` : 'Not seen in answers yet'}
                    className="inline-flex h-5 items-center rounded bg-tint px-1.5 text-[12px] leading-none font-medium text-stone-600 tabular-nums">{seen}</span>
                )}
                {editable && (
                  <button type="button" onClick={() => remove(a)} aria-label={`Remove ${a}`}
                    className="grid h-7 w-7 place-items-center rounded-md text-stone-500 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
                    <X size={14} aria-hidden />
                  </button>
                )}
              </span>
              )
            })}
            {editable && <ChipAdder label="Add" placeholder="e.g. Derma Suri" shape={shape} add={(v) => problem(v) ?? add(v) ?? null} />}
          </div>
          <SaveFailed failed={failed} />
        </>
      )}
    />
  )
}

// "Topics": what the brand's prompts are about (the Prompt Hub's categories). Chip = category icon + name +
// tracked-prompt count; click → /prompts filtered to it. Adding one offers "Run research". Topics can't be removed here.
const TOPIC_ICONS = [[/under.?eye|eye/i, Eye], [/body|hand|lotion/i, Hand], [/sun|spf/i, Sun], [/retinol|retinoid/i, Sparkles], [/serum|vitamin|niacinamide|hyaluronic/i, Droplet], [/moistur|cream|ceramide/i, ShieldCheck]]
function TopicVisual({ t }) {
  const Icon = TOPIC_ICONS.find(([re]) => re.test(t.name))?.[1] ?? Tag
  return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-tint text-stone-600"><Icon size={14} aria-hidden /></span>
}

function TopicsCard({ brand, update, toast }) {
  const topics = brand.topics ?? []
  const chips = useAnimatedList(topics, (t) => t.name, 150)
  const [failed, save] = useCardSave()
  const problem = (v) => (topics.some((t) => t.name.toLowerCase() === v.toLowerCase()) ? 'Already added' : null)
  const add = (name) => {
    save(`“${name}”`, {
      apply: () => update((b) => ({ ...b, topics: [...(b.topics ?? []), { name, promptCount: 0, type: guessTopicType(name) }] })),
      revert: () => update((b) => ({ ...b, topics: b.topics.filter((x) => x.name !== name) })),
      call: () => setupActions.onAddTopic(brand.id, name),
      done: () => toast('Added · Research will suggest prompts for it', { duration: 6000, action: { label: 'Run research', onClick: () => navigate(`/tracker?research=${encodeURIComponent(name)}`) } }),
    })
  }
  const shape = 'h-9 rounded-lg text-[14px]'

  return (
    <SettingsCard id={`topics-${brand.id}`} title="Topics" count={topics.length} description={`What ${brand.name}’s prompts are about — used to suggest prompts and research`} compact
      body={(
        <>
          <div className="flex flex-wrap items-center gap-2.5 px-5 pb-4">
            {chips.map(({ item: t, key, state }) => {
              const n = t.promptCount
              return (
                <span key={key} className={`${shape} inline-flex items-center border border-line bg-surface pr-2.5 transition-colors duration-150 hover:border-[var(--color-line-strong)] ${animClass(state)}`}>
                  <button type="button" onClick={() => navigate(`/tracker?topic=${encodeURIComponent(t.name)}`)} aria-label={`${t.name}: ${n} tracked prompts — view them`}
                    className="inline-flex h-full items-center gap-2 rounded-lg pl-1.5 pr-1 font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                    <TopicVisual t={t} />
                    {t.name}
                    <span title={`${n} tracked prompt${n === 1 ? '' : 's'}`} className="text-[12px] font-normal text-stone-500 tabular-nums">{n}</span>
                  </button>
                </span>
              )
            })}
            <ChipAdder label="Add" placeholder="e.g. Face mist" shape={shape} add={(v) => problem(v) ?? add(v) ?? null} />
          </div>
          <SaveFailed failed={failed} />
        </>
      )}
    />
  )
}

function CompetitorsCard({ brand, update, toast }) {
  const list = brand.competitors
  const ed = useEditing(toast)
  const [failed, save] = useCardSave()
  // tracked prompts where this competitor appears alongside the brand (null: not a tracked brand yet); most first
  const shared = (c) => (c.domain ? sharedAnswers(c.domain, brand.domain) : null)
  const sorted = useMemo(() => [...list].sort((a, b) => (shared(b) ?? -1) - (shared(a) ?? -1)), [list, brand.domain]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useAnimatedList(sorted, (c) => c.id, 150)
  // a limit only when the app sets one (none while billing isn't live)
  const full = MAX_COMPETITORS != null && list.length >= MAX_COMPETITORS
  const setList = (fn) => update((b) => ({ ...b, competitors: fn(b.competitors) }))
  const setSuggested = (fn) => update((b) => ({ ...b, suggested: fn(b.suggested ?? []) }))
  const validateNew = ({ name, domain }) => {
    const d = normalizeDomain(domain)
    if (!isValidDomain(d)) return 'Enter a domain like competitor.com'
    if (d === brand.domain) return 'That’s this brand’s own site'
    if (list.some((c) => c.domain === d)) return 'Already tracked'
    if (list.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) return 'Already tracked'
    return null
  }
  const validateName = (self) => ({ name }) => (list.some((c) => c.id !== self.id && c.name.toLowerCase() === name.trim().toLowerCase()) ? 'Already tracked' : null)
  const add = ({ name, domain }) => {
    const temp = { id: `new-${Date.now()}`, name: name.trim(), domain: normalizeDomain(domain) }
    save(temp.name, {
      apply: () => setList((cs) => [...cs, temp]),
      revert: () => setList((cs) => cs.filter((x) => x.id !== temp.id)),
      call: () => setupActions.onAddCompetitor(brand.id, temp),
      done: (saved) => { setList((cs) => cs.map((x) => (x.id === temp.id ? { ...temp, ...saved } : x))); toast(`${temp.name} added`) },
    })
  }
  const rename = (c, name) => {
    const next = { ...c, name: name.trim() }
    save(next.name, {
      apply: () => setList((cs) => cs.map((x) => (x.id === c.id ? next : x))),
      revert: () => setList((cs) => cs.map((x) => (x.id === c.id ? c : x))),
      call: () => setupActions.onRenameCompetitor(brand.id, c, next.name),
      done: () => toast(`${next.name} updated`),
    })
  }
  const restore = (c, i) => save(c.name, {
    apply: () => setList((cs) => (cs.some((x) => x.id === c.id) ? cs : [...cs.slice(0, i), c, ...cs.slice(i)])),
    revert: () => setList((cs) => cs.filter((x) => x.id !== c.id)),
    call: () => setupActions.onRestoreCompetitor(brand.id, c),
  })
  const remove = (c) => {
    const i = list.findIndex((x) => x.id === c.id)
    save(c.name, {
      apply: () => setList((cs) => cs.filter((x) => x.id !== c.id)),
      revert: () => setList((cs) => (cs.some((x) => x.id === c.id) ? cs : [...cs.slice(0, i), c, ...cs.slice(i)])),
      call: () => setupActions.onRemoveCompetitor(brand.id, c),
      done: () => toast(`${c.name} removed`, { duration: 5000, action: { label: 'Undo', onClick: () => restore(c, i) } }),
    })
  }
  // research candidates: accept = track it, dismiss = research won't suggest it again
  const accept = (sg) => save(sg.name, {
    apply: () => { setSuggested((ss) => ss.filter((x) => x.id !== sg.id)); setList((cs) => [...cs, { id: sg.id, name: sg.name, domain: sg.domain }]) },
    revert: () => { setList((cs) => cs.filter((x) => x.id !== sg.id)); setSuggested((ss) => [...ss, sg]) },
    call: () => setupActions.onAcceptSuggestion(brand.id, sg),
    done: () => toast(`${sg.name} added`),
  })
  const dismiss = (sg) => save(sg.name, {
    apply: () => setSuggested((ss) => ss.filter((x) => x.id !== sg.id)),
    revert: () => setSuggested((ss) => [...ss, sg]),
    call: () => setupActions.onDismissSuggestion(brand.id, sg),
  })
  const suggestions = full ? [] : (brand.suggested ?? []).map((x) => ({ key: x.id, label: x.name, value: x, reason: x.reason }))
  const addFields = [
    { name: 'name', label: 'Competitor name', placeholder: 'Brand name' },
    { name: 'domain', label: 'Competitor domain', placeholder: 'competitor.com' },
  ]
  const nameField = [{ name: 'name', label: 'Competitor name', placeholder: 'Brand name' }]

  return (
    <SettingsCard
      id={`competitors-${brand.id}`}
      title="Competitors"
      count={MAX_COMPETITORS != null ? `${list.length} of ${MAX_COMPETITORS}` : list.length}
      description="Brands AI answers compare you with"
      action={<AddButton onClick={() => ed.open('new')} disabled={full} disabledTitle="Limit reached" />}
      footer={(
        <>
          <Suggested items={suggestions} label="Suggested from research" onPick={(sg) => accept(sg.value)} onDismiss={(sg) => dismiss(sg.value)} />
          <SaveFailed failed={failed} />
        </>
      )}
    >
      {ed.editing === 'new' && !full && (
        <InputRow logo={<Logo name="+" />} fields={addFields} initial={ed.draft ?? { name: '', domain: '' }} validate={validateNew} submitLabel="Add"
          onSubmit={(v) => { add(v); ed.close() }} onClose={ed.close} onDiscard={ed.discard('new')} />
      )}
      {rows.map(({ item: c, key, state }) => (ed.editing === c.id ? (
        <InputRow key={key} logo={<Logo domain={c.domain} name={c.name} />} fields={nameField} fixed={c.domain} initial={ed.draft ?? { name: c.name }} validate={validateName(c)} submitLabel="Save"
          onSubmit={({ name }) => { rename(c, name); ed.close() }} onClose={ed.close} onDiscard={ed.discard(c.id)} />
      ) : (
        <Row key={key} state={state} logo={<Logo domain={c.domain} name={c.name} />} name={c.name}
          meta={c.domain}
          value={shared(c) != null ? `In ${shared(c)} answer${shared(c) === 1 ? '' : 's'} with you` : 'No shared answers yet'}
          onEdit={() => ed.open(c.id)} onRemove={() => remove(c)} />
      )))}
      {!list.length && ed.editing !== 'new' && rows.length === 0 && (
        <li className="flex h-[60px] items-center px-5 text-[13px] leading-[18px] text-stone-500">No competitors yet</li>
      )}
    </SettingsCard>
  )
}

// "Marketplaces": where the brand also sells (accounts with ecommerce). Row = store, its domain, and how many listings
// of the brand AI answers cited (null: not known for this brand). + Add opens a domain row; Edit renames or moves it;
// Remove has Undo. Suggested: stores AI cites in the market where the brand isn't listed, when the backend has them.
function MarketplacesCard({ brand, update, toast }) {
  const items = brand.marketplaces ?? []
  const ed = useEditing(toast)
  const [failed, save] = useCardSave()
  const tracking = useTracking()
  const rows = useAnimatedList(items, (m) => m.id, 150)
  const setList = (fn) => update((b) => ({ ...b, marketplaces: fn(b.marketplaces ?? []) }))
  const domainError = (raw, selfId) => {
    const d = normalizeDomain(raw)
    if (!isValidDomain(d)) return 'Enter a valid domain, e.g. amazon.com'
    if (d === brand.domain) return 'That’s this brand’s own site'
    if (items.some((m) => m.id !== selfId && m.domain === d)) return 'Already added'
    return null
  }
  const add = (domain, name = brandName(domain)) => {
    const temp = { id: `new-${Date.now()}`, name, domain, cited: null }
    save(name, {
      apply: () => setList((ms) => [...ms, temp]),
      revert: () => setList((ms) => ms.filter((x) => x.id !== temp.id)),
      call: () => setupActions.onAddMarketplace(brand.id, temp),
      done: (saved) => { setList((ms) => ms.map((x) => (x.id === temp.id ? { ...temp, ...saved } : x))); toast(`${name} added`) },
    })
  }
  const edit = (prev, next) => save(next.name, {
    apply: () => setList((ms) => ms.map((x) => (x.id === prev.id ? next : x))),
    revert: () => setList((ms) => ms.map((x) => (x.id === prev.id ? prev : x))),
    call: () => setupActions.onUpdateMarketplace(brand.id, prev, next),
    done: (saved) => { if (saved) setList((ms) => ms.map((x) => (x.id === prev.id ? { ...next, ...saved } : x))); toast(`${next.name} updated`) },
  })
  const restore = (m, i) => save(m.name, {
    apply: () => setList((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms.slice(0, i), m, ...ms.slice(i)])),
    revert: () => setList((ms) => ms.filter((x) => x.id !== m.id)),
    call: () => setupActions.onRestoreMarketplace(brand.id, m),
  })
  const remove = (m) => {
    const i = items.findIndex((x) => x.id === m.id)
    save(m.name, {
      apply: () => setList((ms) => ms.filter((x) => x.id !== m.id)),
      revert: () => setList((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms.slice(0, i), m, ...ms.slice(i)])),
      call: () => setupActions.onRemoveMarketplace(brand.id, m),
      done: () => toast(`${m.name} removed`, { duration: 5000, action: { label: 'Undo', onClick: () => restore(m, i) } }),
    })
  }
  const country = tracking.market.country
  const suggestions = (setupActions.marketplaceSuggestions?.(brand, country) ?? [])
    .map((x) => ({ key: x.domain, label: x.name, value: x, reason: x.answers ? `Cited in ${x.answers} answers` : undefined }))
  const cited = (m) => (m.cited == null ? <span className="text-stone-500">—</span> : m.cited > 0 ? `${m.cited} listing${m.cited === 1 ? '' : 's'} cited` : 'No listings yet')

  return (
    <SettingsCard
      id={`marketplaces-${brand.id}`}
      title="Marketplaces"
      count={items.length}
      description={`Where ${brand.domain ?? brand.name} also sells`}
      action={<AddButton onClick={() => ed.open('new')} />}
      footer={(
        <>
          <Suggested items={suggestions} market={country} onPick={(s) => add(s.value.domain, s.value.name)} />
          <SaveFailed failed={failed} />
        </>
      )}
    >
      {ed.editing === 'new' && (
        <InputRow logo={<Logo name="+" />} fields={[{ name: 'domain', label: 'Marketplace domain', placeholder: 'amazon.com' }]} initial={ed.draft ?? { domain: '' }}
          validate={({ domain }) => domainError(domain, null)} submitLabel="Add"
          onSubmit={({ domain }) => { add(normalizeDomain(domain)); ed.close() }} onClose={ed.close} onDiscard={ed.discard('new')} />
      )}
      {rows.map(({ item: m, key, state }) => (ed.editing === m.id ? (
        <InputRow key={key} logo={<Logo domain={m.domain} name={m.name} />}
          fields={[{ name: 'name', label: 'Marketplace name', placeholder: 'Amazon' }, { name: 'domain', label: 'Marketplace domain', placeholder: 'amazon.com' }]}
          initial={ed.draft ?? { name: m.name, domain: m.domain }} validate={({ domain }) => domainError(domain, m.id)} submitLabel="Save"
          onSubmit={({ name, domain }) => { edit(m, { ...m, name: name.trim() || brandName(normalizeDomain(domain)), domain: normalizeDomain(domain) }); ed.close() }} onClose={ed.close} onDiscard={ed.discard(m.id)} />
      ) : (
        <Row key={key} state={state} logo={<Logo domain={m.domain} name={m.name} />} name={m.name} meta={m.domain}
          value={cited(m)} onEdit={() => ed.open(m.id)} onRemove={() => remove(m)} />
      )))}
      {!items.length && ed.editing !== 'new' && rows.length === 0 && (
        <li className="flex h-[60px] items-center px-5 text-[13px] leading-[18px] text-stone-500">No marketplaces yet</li>
      )}
    </SettingsCard>
  )
}

// ---------------------------------------------------------------- page

// kept outside the component so edits survive leaving /setup (e.g. to change the market on /llm-settings)
let savedBrands = setupBrands

export default function SetupPage() {
  useEffect(() => { document.title = 'Brand Setup · Kraffic' }, [])
  const [brands, setBrands] = useState(() => savedBrands)
  useEffect(() => { savedBrands = brands }, [brands])
  const [modal, setModal] = useState(null) // { brand: null | brand }
  const [confirmState, setConfirmState] = useState(null)
  const [newId, setNewId] = useState(null)
  const [toastNode, toast] = useToast({ position: 'center' })
  const tracking = useTracking()
  const primary = brands[0]

  const updateBrand = (id, fn) => setBrands((bs) => bs.map((b) => (b.id === id ? fn(b) : b)))
  // deleting asks first; it can't be undone (the brand, its prompts and history go)
  const removeBrand = (brand) => setupActions.onDeleteBrand(brand.id).then(() => {
    setBrands((bs) => bs.filter((b) => b.id !== brand.id))
    toast(`${brand.name} deleted`)
  })
  const deleteBrand = (brand, anchor) => setConfirmState({
    anchor,
    title: `Delete ${brand.name}?`,
    body: 'This removes its prompts and history.',
    label: 'Delete',
    onConfirm: () => removeBrand(brand).catch(() => toast(`Couldn’t delete ${brand.name}`, { duration: 6000, action: { label: 'Retry', onClick: () => deleteBrand(brand, anchor) } })),
  })
  // the modal's save (it waits, and shows the error if this rejects). Edit: name / domain, then the competitors
  // added (by domain) and removed in the field. Add: one create with its aliases and competitors.
  const saveBrand = async (form) => {
    if (modal.brand) {
      const b = modal.brand
      if (form.name !== b.name || form.domain !== b.domain) await setupActions.onUpdateBrand(b.id, { name: form.name, domain: form.domain })
      const kept = b.competitors.filter((c) => form.competitors.includes(c.domain))
      const removed = b.competitors.filter((c) => !form.competitors.includes(c.domain))
      const added = form.competitors.filter((d) => !b.competitors.some((c) => c.domain === d))
      for (const c of removed) await setupActions.onRemoveCompetitor(b.id, c)
      const saved = []
      for (const d of added) saved.push(await setupActions.onAddCompetitor(b.id, { name: brandName(d), domain: d }))
      updateBrand(b.id, (x) => ({ ...x, name: form.name, domain: form.domain, competitors: [...kept, ...saved] }))
      toast(`${form.name} updated`)
    } else {
      const created = await setupActions.onCreateBrand({ name: form.name, domain: form.domain, aliases: form.aliases, competitors: form.competitors.map((d) => ({ name: brandName(d), domain: d })) })
      setBrands((bs) => [...bs, { aliasAnswers: null, topics: [], suggested: [], prompts: 0, lastSync: null, ...created }])
      setNewId(created.id)
      toast(`${form.name} added · first sync starts now`)
    }
    setModal(null)
  }

  const brandColumns = [
    { key: 'name', label: 'Brand', sort: { value: (b) => b.name.toLowerCase(), first: 'asc' }, cell: (b) => <span className="font-medium text-stone-900">{b.name}</span> },
    { key: 'domain', label: 'Website', width: 220, cell: (b) => <span className="text-[13px] text-stone-600">{b.domain ?? '—'}</span> },
    { key: 'competitors', label: 'Competitors', width: 140, cell: (b) => <span className="text-[13px] text-stone-600 tabular-nums">{MAX_COMPETITORS != null ? `${b.competitors.length} of ${MAX_COMPETITORS}` : b.competitors.length}</span> },
    { key: 'edit', label: '', width: 96, align: 'right', cell: (b) => <button type="button" onClick={() => setModal({ brand: b })} className="text-[13px] font-medium text-stone-600 hover:text-stone-900">Edit</button> },
  ]

  return (
    // same frame as /llm-settings: narrow column, cards stacked gap-4
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4 pt-2">
      <div className="mb-2 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start md:justify-between md:gap-4">
        <div>
          <h1 className="text-[22px] leading-7 font-semibold text-stone-900 lg:text-[28px] lg:leading-9">Brand Setup</h1>
          <p className="mt-1 text-[13px] leading-[18px] text-stone-600 md:text-[14px] md:leading-5">What Kraffic tracks for your brand</p>
        </div>
        <div className="md:pt-1 max-md:[&>button]:h-10 max-md:[&>button]:w-full max-md:[&>button]:justify-center">
          <PrimaryButton size="sm" icon={Plus} onClick={() => setModal({ brand: null })}>Add brand</PrimaryButton>
        </div>
      </div>

      {brands.length > CARDS_MAX ? (
        <PromptTable id="brands" title="Brands" subtitle="Every brand this workspace tracks" rows={brands} columns={brandColumns} filterKeys={['name', 'domain']} csvName="brands.csv" />
      ) : (
        brands.map((b, i) => {
          // primary brand: sync state comes from the tracking store
          const brand = b.id === primary?.id ? { ...b, lastSync: tracking.schedule.lastSync ? fmtDay(tracking.schedule.lastSync) : null } : b
          const update = (fn) => updateBrand(b.id, fn)
          return (
            <div key={b.id} className={`flex flex-col gap-4 ${i > 0 ? 'mt-6' : ''} ${b.id === newId ? 'card-in' : ''}`}>
              <BrandIdentity brand={brand} syncing={b.id === primary?.id && tracking.syncing} onEdit={(x) => setModal({ brand: x })} onDelete={deleteBrand} />
              <NamesCard brand={brand} update={update} toast={toast} />
              <TopicsCard brand={brand} update={update} toast={toast} />
              <CompetitorsCard brand={brand} update={update} toast={toast} />
              {/* marketplaces: accounts with ecommerce, when the backend keeps the brand's stores */}
              {account.features?.ecommerce !== false && Array.isArray(brand.marketplaces) && <MarketplacesCard brand={brand} update={update} toast={toast} />}
            </div>
          )
        })
      )}

      {/* tracking config lives on /llm-settings; this is a read-only summary from the shared store */}
      {primary && (
        <SettingsCard
          title="Tracking"
          description={trackingSummary(tracking)}
          action={(
            <a href="/tracking" onClick={linkClick('/tracking')} className={`${textBtn} text-stone-700`}>
              Edit in Tracking <ArrowRight size={12} aria-hidden />
            </a>
          )}
        />
      )}

      <BrandModal
        open={Boolean(modal)}
        mode={modal?.brand ? 'edit' : 'add'}
        brand={modal?.brand ?? null}
        // deleted from the modal's danger zone (already confirmed there; no undo); the modal waits and shows a failure
        onDelete={(brand) => removeBrand(brand).then(() => setModal(null))}
        takenDomains={brands.filter((b) => b.id !== modal?.brand?.id).map((b) => b.domain).filter(Boolean)}
        onClose={() => setModal(null)}
        onSave={saveBrand}
      />
      {confirmState && (
        <ConfirmPopover
          anchor={confirmState.anchor}
          title={confirmState.title}
          body={confirmState.body}
          confirmLabel={confirmState.label}
          onCancel={() => setConfirmState(null)}
          onConfirm={() => { confirmState.onConfirm(); setConfirmState(null) }}
        />
      )}
      {toastNode}
    </div>
  )
}
