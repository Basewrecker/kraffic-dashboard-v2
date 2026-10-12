import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, Droplet, Eye, Globe, Hand, MoreHorizontal, Pencil, Plus, ShieldCheck, Sparkles, Sun, Tag, Type, X } from 'lucide-react'
import PromptTable from '../dashboard/PromptTable'
import { MarketplaceIcon } from '../dashboard/icons'
import { PrimaryButton, useToast } from '../dashboard/overlays'
import ConfirmPopover from '../prompts/ConfirmPopover'
import SiteLogo from '../ui/SiteLogo'
import BrandModal from './BrandModal'
import { toEntry } from './ChipField'
import { useInlineEdit } from '../../hooks/useInlineEdit'
import { useAnimatedList } from '../../hooks/useAnimatedList'
import { linkClick, navigate } from '../../router'
import { fmtDay, trackingSummary, useTracking } from '../../store/trackingSettings'
import { brandName, isDomain } from '../../utils/brand'
import { isValidDomain, normalizeDomain } from '../../utils/domain'
import { aliasAnswers, aliasSuggestions, MAX_COMPETITORS, setupBrands, topicSuggestions } from '../../data/mock'
import { SUGGESTED_NAMES, operatesIn } from '../../data/marketSuggestions'
import { sharedAnswers } from '../../data/brandViews'
import { guessTopicType, topicPromptCount } from '../../data/topics'
import { useMarketSuggestions } from '../../hooks/useMarketSuggestions'

// /setup: what Kraffic tracks for a brand, in the same settings layout as /llm-settings —
// cards of 60px rows (name + meta left, one quiet value + hover-only Edit / Remove right),
// a "+ Add" that opens an input row at the top, and a "Suggested" strip at the foot of a card.
// Every add / edit / remove gives an Undo toast.

const CARDS_MAX = 6 // more brands than this → a table with pagination instead of cards
const fieldCls = 'h-8 w-full min-w-0 appearance-none rounded-md border border-line bg-raised px-2.5 text-[14px] text-stone-900 outline-none placeholder:text-stone-500 transition-[border-color,box-shadow] duration-150 ease-out focus:border-[color-mix(in_srgb,var(--ink)_35%,transparent)] focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--ink)_8%,transparent)]'
const iconBtn = 'grid h-7 w-7 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 ease-out hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
const textBtn = 'inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 ease-out hover:text-ink focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-40'
const smallBtn = 'inline-flex h-8 shrink-0 items-center rounded-md px-3 text-[13px] font-medium outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-40'
const today = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const sinceNow = () => new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
// suggested brands carry their real names ("beminimalist.co" → "Minimalist", not "Beminimalist")
const label = (v) => SUGGESTED_NAMES[v] ?? (isDomain(v) ? brandName(v) : v)
// Amazon / Target keep their marks; anything else uses its favicon
const storeMark = (domain) => (/(^|\.)amazon\./.test(domain) ? 'Amazon' : /(^|\.)target\.com$/.test(domain) ? 'Target' : null)
const rowAnim = (state) => (state === 'enter' ? 'srow-in' : state === 'leaving' ? 'srow-out' : '')
// favicons sit on a white plate in both themes so white / light logos stay visible
const Logo = ({ domain, name }) => <SiteLogo domain={domain} name={name} className="h-7 w-7 rounded-md" imgPad="p-1" initialClass="text-[12px]" plate />

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
function SettingsCard({ title, count, description, action, footer, children, body, id, label: aria, compact }) {
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
function Row({ logo, name, meta, value, valueTitle, muted, onEdit, onRemove, state }) {
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
// fields: [{ name, label, placeholder }]; validate(values) → error message or null.
function InputRow({ logo, fields, initial, validate, submitLabel, onSubmit, onClose, onDiscard }) {
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
        <button type="button" disabled={!valid || !dirty} onClick={submit} title="Enter saves · Esc cancels" className={`${smallBtn} border border-line bg-surface text-stone-700 hover:bg-tint hover:text-stone-900`}>{submitLabel}</button>
        <button type="button" onClick={onClose} className={`${smallBtn} text-stone-600 hover:bg-tint hover:text-stone-900`}>Cancel</button>
      </div>
      {error && <p role="alert" className="-mt-2 pb-2.5 pl-10 text-[12px] leading-4 text-negative">{error}</p>}
    </li>
  )
}

// "Suggested" strip at the foot of a card; the reason is the chip's tooltip. With a market, the label names it and
// a market change crossfades the chips: out (150ms), swap, back in.
function Suggested({ items, onPick, market, label: lead }) {
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
        <button
          key={it.key}
          type="button"
          title={it.reason}
          aria-label={`Add ${it.label} · ${it.reason}`}
          onClick={() => onPick(it)}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2.5 text-[13px] leading-[18px] text-stone-700 outline-none transition-colors duration-150 ease-out hover:border-[var(--color-line-strong)] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Plus size={12} aria-hidden /> {it.label}
        </button>
      ))}
    </div>
  )
}

// which row is open: null | 'new' | a row key; draft = values to reopen with after a discard's Undo
function useEditing(toast) {
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

// ---------------------------------------------------------------- cards

function BrandIdentity({ brand, syncing, onEdit, onDelete }) {
  const status = syncing ? 'Syncing…' : brand.lastSync ? `Tracking · updated ${brand.lastSync}` : 'First sync running'
  return (
    <SettingsCard label={`${brand.name} brand`}>
      <div className="flex min-h-[72px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3">
        <span className="flex min-w-0 items-center gap-3">
          <SiteLogo domain={brand.domain} name={brand.name} className="h-10 w-10 rounded-lg" imgPad="p-1.5" initialClass="text-[16px]" />
          <span className="min-w-0">
            <h2 className="truncate text-[16px] leading-6 font-semibold text-stone-900">{brand.name}</h2>
            <span className="flex items-center gap-1 text-[13px] leading-[18px] text-stone-600">
              {brand.domain && (
                <a href={`https://${brand.domain}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 rounded underline-offset-4 outline-none hover:text-stone-900 hover:underline focus-visible:ring-2 focus-visible:ring-focus">
                  {brand.domain}<ArrowUpRight size={12} aria-hidden />
                </a>
              )}
              {brand.domain && <span aria-hidden>·</span>}
              {brand.type === 'website' ? 'Website' : 'Brand name'}
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

// a dashed "+ name" chip that adds a suggestion
const SuggestChip = ({ label, reason, shape, onPick }) => (
  <button type="button" title={reason} aria-label={`Add ${label} · ${reason}`} onClick={onPick}
    className={`${shape} inline-flex items-center gap-1.5 border border-dashed border-[var(--dashed-border)] px-3 font-medium text-stone-600 outline-none transition-colors duration-150 hover:border-[var(--color-line-strong)] hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus`}>
    <Plus size={14} aria-hidden />{label}
  </button>
)

// a removable chip: X slides in on hover / focus
const removeBtn = '-ml-1 grid h-6 w-0 place-items-center overflow-hidden rounded text-stone-500 opacity-0 outline-none transition-[width,opacity,margin] duration-150 hover:text-stone-900 focus-visible:ml-0 focus-visible:w-6 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus group-hover:ml-0 group-hover:w-6 group-hover:opacity-100 touch:opacity-100 [@media(hover:none)]:ml-0 [@media(hover:none)]:w-6 [@media(hover:none)]:opacity-100'
const animClass = (state) => (state === 'enter' ? 'chip-in' : state === 'leaving' ? 'chip-out' : '')

// "Also counts as": one line of chips — aliases (with how many answers used them), suggestions, "+ Add alias"
function NamesCard({ brand, update, toast }) {
  const aliases = brand.aliases ?? []
  const chips = useAnimatedList(aliases, (a) => a, 150)
  const problem = (v) => (v.toLowerCase() === brand.name.toLowerCase() ? 'That’s already the brand name'
    : aliases.some((a) => a.toLowerCase() === v.toLowerCase()) ? 'Already added' : null)
  const add = (v) => {
    update((b) => ({ ...b, aliases: [...(b.aliases ?? []), v], addedOn: { ...b.addedOn, [`alias:${v}`]: today() } }))
    toast(`“${v}” added`, { duration: 5000, action: { label: 'Undo', onClick: () => update((b) => ({ ...b, aliases: b.aliases.filter((x) => x !== v) })) } })
  }
  const remove = (a) => {
    const i = aliases.indexOf(a)
    update((b) => ({ ...b, aliases: b.aliases.filter((x) => x !== a) }))
    toast(`“${a}” removed`, { duration: 5000, action: { label: 'Undo', onClick: () => update((b) => (b.aliases.includes(a) ? b : { ...b, aliases: [...b.aliases.slice(0, i), a, ...b.aliases.slice(i)] })) } })
  }
  const suggestions = (brand.id === setupBrands[0].id ? aliasSuggestions : []).filter((x) => !aliases.some((a) => a.toLowerCase() === x.toLowerCase()))
  const seen = (a) => aliasAnswers[a] ?? 0
  const shape = 'h-9 rounded-lg text-[14px]'

  return (
    <SettingsCard id={`aliases-${brand.id}`} title="Also counts as" count={aliases.length} description={`Name variants that count as a ${brand.name} mention`} compact
      body={(
        <div className="flex flex-wrap items-center gap-2.5 px-5 pb-4">
          {chips.map(({ item: a, key, state }) => {
            const Icon = isDomain(a) ? Globe : Type // what kind of variant: a domain / URL, or a name
            return (
            <span key={key} className={`group ${shape} inline-flex items-center gap-2 border border-line bg-surface pl-2.5 pr-3 font-medium text-stone-900 transition-colors duration-150 hover:border-[var(--color-line-strong)] ${animClass(state)}`}>
              <Icon size={16} className="shrink-0 text-stone-500" aria-label={isDomain(a) ? 'Domain' : 'Name'} />
              {a}
              <span title={seen(a) ? `Counted in ${seen(a)} answer${seen(a) === 1 ? '' : 's'}` : 'Not seen in answers yet'}
                className="inline-flex h-5 items-center rounded bg-tint px-1.5 text-[12px] leading-none font-medium text-stone-600 tabular-nums">{seen(a)}</span>
              <button type="button" aria-label={`Remove ${a}`} onClick={() => remove(a)} className={removeBtn}><X size={14} aria-hidden /></button>
            </span>
            )
          })}
          {suggestions.map((x) => (
            <SuggestChip key={x} label={x} shape={shape} reason={`Seen in ${seen(x)} answer${seen(x) === 1 ? '' : 's'}`} onPick={() => add(x)} />
          ))}
          <ChipAdder label="Add alias" placeholder="Derma Suri" shape={shape} add={(v) => problem(v) ?? add(v) ?? null} />
        </div>
      )}
    />
  )
}

// "Products & topics": what the brand sells, grouped Products / Topics. Chip = visual (product image, or a
// category icon) + name + tracked-prompt count; click → /prompts filtered to it. Adding offers "Run research".
const TOPIC_ICONS = [[/under.?eye|eye/i, Eye], [/body|hand|lotion/i, Hand], [/sun|spf/i, Sun], [/retinol|retinoid/i, Sparkles], [/serum|vitamin|niacinamide|hyaluronic/i, Droplet], [/moistur|cream|ceramide/i, ShieldCheck]]
function TopicVisual({ t }) {
  if (t.thumb) return <img src={t.thumb} alt="" className="h-6 w-6 shrink-0 rounded-md object-cover" />
  const Icon = TOPIC_ICONS.find(([re]) => re.test(t.name))?.[1] ?? Tag
  return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-tint text-stone-600"><Icon size={14} aria-hidden /></span>
}

function TopicsCard({ brand, update, toast }) {
  const topics = brand.topics ?? []
  const chips = useAnimatedList(topics, (t) => t.name, 150)
  const problem = (v) => (topics.some((t) => t.name.toLowerCase() === v.toLowerCase()) ? 'Already added' : null)
  const add = (item) => {
    update((b) => ({ ...b, topics: [...(b.topics ?? []), item] }))
    toast('Added · Research will suggest prompts for it', { duration: 6000, action: { label: 'Run research', onClick: () => navigate(`/tracker?research=${encodeURIComponent(item.name)}`) } })
  }
  const remove = (t) => {
    const i = topics.findIndex((x) => x.name === t.name)
    update((b) => ({ ...b, topics: b.topics.filter((x) => x.name !== t.name) }))
    toast(`${t.name} removed`, { duration: 5000, action: { label: 'Undo', onClick: () => update((b) => (b.topics.some((x) => x.name === t.name) ? b : { ...b, topics: [...b.topics.slice(0, i), t, ...b.topics.slice(i)] })) } })
  }
  const suggestions = (brand.id === setupBrands[0].id ? topicSuggestions : []).filter((x) => !topics.some((t) => t.name.toLowerCase() === x.name.toLowerCase()))
  const shape = 'h-9 rounded-lg text-[14px]'
  const groups = [['Products', 'product'], ['Topics', 'topic']]
    .map(([label, type]) => [label, chips.filter(({ item }) => item.type === type)]).filter(([, items]) => items.length)
  const tail = (
    <>
      {suggestions.map((x) => <SuggestChip key={x.name} label={x.name} reason={x.reason} shape={shape} onPick={() => add({ name: x.name, type: x.type })} />)}
      <ChipAdder label="Add" placeholder="e.g. Face mist" shape={shape} add={(v) => problem(v) ?? add({ name: v, type: guessTopicType(v) }) ?? null} />
    </>
  )

  return (
    <SettingsCard id={`topics-${brand.id}`} title="Products & topics" count={topics.length} description={`What ${brand.name} sells — used to suggest prompts and research`} compact
      body={(
        <div className="px-5 pb-4">
          {groups.map(([label, items], gi) => (
            <div key={label} className={gi > 0 ? 'mt-3' : ''}>
              <div className="mb-1.5 text-[12px] leading-4 font-medium text-stone-500">{label}</div>
              <div className="flex flex-wrap items-center gap-2.5">
                {items.map(({ item: t, key, state }) => {
                  const n = topicPromptCount(t.name)
                  return (
                    <span key={key} className={`group ${shape} inline-flex items-center border border-line bg-surface pr-2.5 transition-colors duration-150 hover:border-[var(--color-line-strong)] ${animClass(state)}`}>
                      <button type="button" onClick={() => navigate(`/tracker?topic=${encodeURIComponent(t.name)}`)} aria-label={`${t.name}: ${n} tracked prompts — view them`}
                        className="inline-flex h-full items-center gap-2 rounded-l-lg pl-1.5 pr-1 font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                        <TopicVisual t={t} />
                        {t.name}
                        <span title={`${n} tracked prompt${n === 1 ? '' : 's'}`} className="text-[12px] font-normal text-stone-500 tabular-nums">{n}</span>
                      </button>
                      <button type="button" aria-label={`Remove ${t.name}`} onClick={() => remove(t)} className={removeBtn}><X size={14} aria-hidden /></button>
                    </span>
                  )
                })}
                {gi === groups.length - 1 && tail}
              </div>
            </div>
          ))}
          {!groups.length && <div className="flex flex-wrap items-center gap-2.5">{tail}</div>}
        </div>
      )}
    />
  )
}

function CompetitorsCard({ brand, update, toast }) {
  const list = brand.competitors
  const ed = useEditing(toast)
  // tracked prompts where this competitor appears alongside the brand (null: not a tracked brand yet); most first
  const shared = (c) => (isDomain(c) ? sharedAnswers(c, brand.domain) : null)
  const sorted = useMemo(() => [...list].sort((a, b) => (shared(b) ?? -1) - (shared(a) ?? -1)), [list, brand.domain]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useAnimatedList(sorted, (c) => c, 150)
  const full = list.length >= MAX_COMPETITORS
  const validate = (self) => ({ entry }) => {
    const raw = entry.trim()
    const v = toEntry(raw)
    if (/\./.test(raw) && !/\s/.test(raw) && !isDomain(v)) return 'Enter a domain like competitor.com, or a brand name'
    if (v === brand.domain) return 'That’s this brand’s own site'
    if (list.some((c) => c !== self && label(c).toLowerCase() === label(v).toLowerCase())) return 'Already tracked'
    return null
  }
  const add = (c) => {
    update((b) => (b.competitors.includes(c) || b.competitors.length >= MAX_COMPETITORS ? b : { ...b, competitors: [...b.competitors, c], addedOn: { ...b.addedOn, [`competitor:${c}`]: today() } }))
    toast(`${label(c)} added`, { duration: 5000, action: { label: 'Undo', onClick: () => update((b) => ({ ...b, competitors: b.competitors.filter((x) => x !== c) })) } })
  }
  const replace = (from, to) => {
    const swap = (a, b) => (x) => (x === a ? b : x)
    update((b) => ({ ...b, competitors: b.competitors.map(swap(from, to)), addedOn: { ...b.addedOn, [`competitor:${to}`]: b.addedOn?.[`competitor:${from}`] ?? today() } }))
    toast(`${label(to)} updated`, { duration: 5000, action: { label: 'Undo', onClick: () => update((b) => ({ ...b, competitors: b.competitors.map(swap(to, from)) })) } })
  }
  const remove = (c) => {
    const i = list.indexOf(c)
    update((b) => ({ ...b, competitors: b.competitors.filter((x) => x !== c) }))
    toast(`${label(c)} removed`, { duration: 5000, action: { label: 'Undo', onClick: () => update((b) => (b.competitors.includes(c) ? b : { ...b, competitors: [...b.competitors.slice(0, i), c, ...b.competitors.slice(i)] })) } })
  }
  const market = useMarketSuggestions('competitors', list.map((c) => (isDomain(c) ? { domain: c, name: label(c) } : { name: c })))
  const suggestions = full ? [] : market.items
    .map((x) => ({ key: x.domain, label: x.name, value: x.domain, reason: `Appears in ${x.answers} answers` }))
  const field = [{ name: 'entry', label: 'Competitor domain or name', placeholder: 'competitor.com or brand name' }]

  return (
    <SettingsCard
      id={`competitors-${brand.id}`}
      title="Competitors"
      count={`${list.length} of ${MAX_COMPETITORS}`}
      description="Brands AI answers compare you with"
      action={<AddButton onClick={() => ed.open('new')} disabled={full} disabledTitle="Limit reached" />}
      footer={<Suggested items={suggestions} market={market.country} onPick={(s) => add(s.value)} />}
    >
      {ed.editing === 'new' && !full && (
        <InputRow logo={<Logo name="+" />} fields={field} initial={ed.draft ?? { entry: '' }} validate={validate(null)} submitLabel="Add"
          onSubmit={({ entry }) => { add(toEntry(entry)); ed.close() }} onClose={ed.close} onDiscard={ed.discard('new')} />
      )}
      {rows.map(({ item: c, key, state }) => (ed.editing === c ? (
        <InputRow key={key} logo={<Logo domain={isDomain(c) ? c : null} name={label(c)} />} fields={field} initial={ed.draft ?? { entry: c }} validate={validate(c)} submitLabel="Save"
          onSubmit={({ entry }) => { replace(c, toEntry(entry)); ed.close() }} onClose={ed.close} onDiscard={ed.discard(c)} />
      ) : (
        <Row key={key} state={state} logo={<Logo domain={isDomain(c) ? c : null} name={label(c)} />} name={label(c)}
          meta={isDomain(c) ? c : 'Brand name'}
          value={shared(c) != null ? `In ${shared(c)} answer${shared(c) === 1 ? '' : 's'} with you` : 'No shared answers yet'}
          valueTitle={brand.addedOn?.[`competitor:${c}`] ? `Added ${brand.addedOn[`competitor:${c}`]}` : undefined}
          onEdit={() => ed.open(c)} onRemove={() => remove(c)} />
      )))}
      {!list.length && ed.editing !== 'new' && rows.length === 0 && (
        <li className="flex h-[60px] items-center px-5 text-[13px] leading-[18px] text-stone-500">No competitors yet</li>
      )}
    </SettingsCard>
  )
}

function MarketplacesCard({ brand, update, toast }) {
  const items = brand.marketplaces
  const ed = useEditing(toast)
  const rows = useAnimatedList(items, (m) => m.id, 150)
  const setMarketplaces = (fn) => update((b) => ({ ...b, marketplaces: fn(b.marketplaces) }))
  const storeLogo = (domain, name) => {
    const mark = storeMark(domain ?? '')
    return mark
      ? <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line bg-white"><MarketplaceIcon name={mark} size={16} /></span>
      : <Logo domain={domain && isValidDomain(domain) ? domain : null} name={name} />
  }
  const domainError = (raw, selfId) => {
    const d = normalizeDomain(raw)
    if (!isValidDomain(d)) return 'Enter a valid domain, e.g. amazon.com'
    if (items.some((m) => m.id !== selfId && m.domain === d)) return 'Already added'
    return null
  }
  const add = (d, name = brandName(d)) => {
    setMarketplaces((ms) => [...ms, { id: `m${Date.now()}`, name, domain: d, cited: 0 }])
    toast(`${name} added`, { duration: 5000, action: { label: 'Undo', onClick: () => setMarketplaces((ms) => ms.filter((m) => m.domain !== d)) } })
  }
  const save = (prev, next) => {
    setMarketplaces((ms) => ms.map((x) => (x.id === prev.id ? next : x)))
    toast(`${next.name} updated`, { duration: 5000, action: { label: 'Undo', onClick: () => setMarketplaces((ms) => ms.map((x) => (x.id === prev.id ? prev : x))) } })
  }
  const remove = (m) => {
    const i = items.findIndex((x) => x.id === m.id)
    setMarketplaces((ms) => ms.filter((x) => x.id !== m.id))
    toast(`${m.name} removed`, { duration: 5000, action: { label: 'Undo', onClick: () => setMarketplaces((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms.slice(0, i), m, ...ms.slice(i)])) } })
  }
  const market = useMarketSuggestions('marketplaces', items)
  const suggestions = market.items
    .map((x) => ({ key: x.domain, label: x.name, value: x.domain, reason: `Cited in ${x.answers} answers` }))
  // tracked stores stay put when the market changes; ones that don't sell there say so and show no count
  const inMarket = (m) => operatesIn(m.domain, market.country)

  return (
    <SettingsCard
      id={`marketplaces-${brand.id}`}
      title="Marketplaces"
      count={items.length}
      description={`Where ${brand.domain ?? brand.name} also sells`}
      action={<AddButton onClick={() => ed.open('new')} />}
      footer={<Suggested items={suggestions} market={market.country} onPick={(s) => add(s.value, s.label)} />}
    >
      {ed.editing === 'new' && (
        <InputRow logo={<Logo name="+" />} fields={[{ name: 'domain', label: 'Marketplace domain', placeholder: 'amazon.com' }]} initial={ed.draft ?? { domain: '' }}
          validate={({ domain }) => domainError(domain, null)} submitLabel="Add"
          onSubmit={({ domain }) => { add(normalizeDomain(domain)); ed.close() }} onClose={ed.close} onDiscard={ed.discard('new')} />
      )}
      {rows.map(({ item: m, key, state }) => (ed.editing === m.id ? (
        <InputRow key={key} logo={storeLogo(m.domain, m.name)}
          fields={[{ name: 'name', label: 'Marketplace name', placeholder: 'Amazon' }, { name: 'domain', label: 'Marketplace domain', placeholder: 'amazon.com' }]}
          initial={ed.draft ?? { name: m.name, domain: m.domain }} validate={({ domain }) => domainError(domain, m.id)} submitLabel="Save"
          onSubmit={({ name, domain }) => { save(m, { ...m, name: name.trim(), domain: normalizeDomain(domain) }); ed.close() }} onClose={ed.close} onDiscard={ed.discard(m.id)} />
      ) : (
        <Row key={key} state={state} logo={storeLogo(m.domain, m.name)} name={m.name} muted={!inMarket(m)}
          meta={inMarket(m) ? m.domain : <span className="text-stone-500">Not tracked in {market.country}</span>}
          value={!inMarket(m) ? <span className="text-stone-500">—</span> : m.cited > 0 ? `${m.cited} listing${m.cited === 1 ? '' : 's'} cited` : 'No listings yet'}
          valueTitle={!inMarket(m) ? `${m.name} isn’t available in ${market.country}` : undefined}
          onEdit={() => ed.open(m.id)} onRemove={() => remove(m)} />
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
  const deleteBrand = (brand, anchor) => setConfirmState({
    anchor,
    title: `Delete ${brand.name}?`,
    body: 'This removes its prompts and history.',
    label: 'Delete',
    onConfirm: () => {
      const i = brands.findIndex((b) => b.id === brand.id)
      setBrands((bs) => bs.filter((b) => b.id !== brand.id))
      toast(`${brand.name} deleted`, { duration: 5000, action: { label: 'Undo', onClick: () => setBrands((bs) => { const n = [...bs]; n.splice(i, 0, brand); return n }) } })
    },
  })
  const saveBrand = (form) => {
    if (modal.brand) {
      updateBrand(modal.brand.id, (b) => ({ ...b, ...form }))
      toast(`${form.name} updated`)
    } else {
      const id = `b${Date.now()}`
      const addedOn = Object.fromEntries([...form.competitors.map((c) => `competitor:${c}`), ...(form.aliases ?? []).map((a) => `alias:${a}`)].map((k) => [k, today()]))
      setBrands((bs) => [...bs, { id, logo: null, ...form, addedOn, marketplaces: [], prompts: 0, visible: null, visibility: null, visibilityDelta: null, since: sinceNow(), lastSync: null }])
      setNewId(id)
      toast(`${form.name} added · first sync starts now`)
    }
    setModal(null)
  }

  const brandColumns = [
    { key: 'name', label: 'Brand', sort: { value: (b) => b.name.toLowerCase(), first: 'asc' }, cell: (b) => <span className="font-medium text-stone-900">{b.name}</span> },
    { key: 'domain', label: 'Website', width: 220, cell: (b) => <span className="text-[13px] text-stone-600">{b.domain ?? '—'}</span> },
    { key: 'competitors', label: 'Competitors', width: 140, cell: (b) => <span className="text-[13px] text-stone-600 tabular-nums">{b.competitors.length} of {MAX_COMPETITORS}</span> },
    { key: 'marketplaces', label: 'Marketplaces', width: 140, cell: (b) => <span className="text-[13px] text-stone-600 tabular-nums">{b.marketplaces.length}</span> },
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
          const brand = b.id === primary?.id ? { ...b, lastSync: fmtDay(tracking.schedule.lastSync) } : b
          const update = (fn) => updateBrand(b.id, fn)
          return (
            <div key={b.id} className={`flex flex-col gap-4 ${i > 0 ? 'mt-6' : ''} ${b.id === newId ? 'card-in' : ''}`}>
              <BrandIdentity brand={brand} syncing={b.id === primary?.id && tracking.syncing} onEdit={(x) => setModal({ brand: x })} onDelete={deleteBrand} />
              <NamesCard brand={brand} update={update} toast={toast} />
              <TopicsCard brand={brand} update={update} toast={toast} />
              <CompetitorsCard brand={brand} update={update} toast={toast} />
              <MarketplacesCard brand={brand} update={update} toast={toast} />
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
              Edit in LLM settings <ArrowRight size={12} aria-hidden />
            </a>
          )}
        />
      )}

      <BrandModal
        open={Boolean(modal)}
        mode={modal?.brand ? 'edit' : 'add'}
        brand={modal?.brand ?? null}
        onDelete={(brand) => {
          // deleted from the modal's danger zone (already confirmed there; no undo)
          setModal(null)
          setBrands((bs) => bs.filter((b) => b.id !== brand.id))
          toast(`${brand.name} deleted`)
        }}
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
