import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react'
import ConfirmPopover from './ConfirmPopover'
import {
  UNCATEGORIZED, categoryError, createCategory, deleteCategory, isCustom, renameCategory, tidyCategory, useCategories,
} from '../../store/categories'

// Category combobox (toolbar filter, add-prompt row, inline edit): search the categories, or create one.
//   value / onChange(name)      the selected category ('all' when allLabel is set and nothing is picked)
//   counts                      prompts per category shown in the list; usage = prompts per category overall
//                               (what a delete would move); defaults to counts
//   allLabel                    adds an "All categories" option (filter mode)
//   onCreated(name) / onRenamed(from, to) / onDeleted(name, moved)   the page updates prompts + toasts
// The menu renders in a portal (tables clip), marked data-popover so open inline edits ignore its clicks.
// ↑/↓ move, Enter picks / creates, Esc closes.
const row = 'flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[13px] leading-[18px] text-stone-900 outline-none'
const iconBtn = 'grid h-6 w-6 shrink-0 place-items-center rounded text-stone-500 outline-none hover:bg-surface hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'

export default function CategorySelect({
  value, onChange, counts = {}, usage, allLabel = null, label = 'Category', triggerClassName, onCreated, onRenamed, onDeleted,
}) {
  const { all } = useCategories()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [error, setError] = useState(null)
  const [renaming, setRenaming] = useState(null) // { name, draft, error }
  const [confirm, setConfirm] = useState(null) // { name, n }
  const [pos, setPos] = useState(null)
  const trigger = useRef(null)
  const menu = useRef(null)
  const input = useRef(null)
  const used = usage ?? counts

  const names = [...all, ...((counts[UNCATEGORIZED] || used[UNCATEGORIZED] || value === UNCATEGORIZED) ? [UNCATEGORIZED] : [])]
  const term = tidyCategory(q).toLowerCase()
  const matches = names
    .filter((c) => !term || c.toLowerCase().includes(term))
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b))
  const exact = term && names.some((c) => c.toLowerCase() === term)
  const create = Boolean(term) && !exact
  // the keyboard walks: [All] + matches + the footer action
  const items = [...(allLabel && !term ? ['all'] : []), ...matches, create ? '__create' : '__new']
  const createIdx = items.length - 1

  const place = () => {
    const r = trigger.current.getBoundingClientRect()
    const h = 320
    setPos({ left: Math.min(r.left, window.innerWidth - 248), top: r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4 })
  }
  useLayoutEffect(() => { if (open) place() }, [open])
  useEffect(() => {
    if (!open) return
    setQ(''); setError(null); setRenaming(null)
    const sel = Math.max(0, [...(allLabel ? ['all'] : []), ...matches].indexOf(value))
    setActive(sel)
    requestAnimationFrame(() => input.current?.focus())
    const out = (e) => { if (!menu.current?.contains(e.target) && !trigger.current?.contains(e.target)) setOpen(false) }
    const onScroll = (e) => { if (!menu.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', out)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', place)
    return () => { document.removeEventListener('mousedown', out); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', place) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  // typing: highlight the first match, or "Create" when nothing matches (set with the text, so a fast Enter never
  // sees an index from the longer, unfiltered list)
  const onType = (text) => {
    const t = tidyCategory(text).toLowerCase()
    const n = names.filter((c) => !t || c.toLowerCase().includes(t)).length
    setQ(text); setError(null)
    setActive(t && !n ? (allLabel && !t ? 1 : 0) + n : 0)
  }
  useEffect(() => { menu.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' }) }, [active])

  const close = (refocus = true) => { setOpen(false); if (refocus) trigger.current?.focus() }
  const pick = (name) => { onChange(name); close() }
  const doCreate = () => {
    const err = categoryError(q)
    if (err) { setError(err); return }
    const name = tidyCategory(q)
    createCategory(name)
    onChange(name)
    onCreated?.(name)
    close()
  }
  const choose = (i) => {
    const it = items[Math.min(Math.max(i, 0), items.length - 1)]
    if (it === '__create') doCreate()
    else if (it === '__new') { setQ(''); input.current?.focus() }
    else pick(it)
  }
  const saveRename = () => {
    const err = categoryError(renaming.draft, renaming.name)
    if (err) { setRenaming((r) => ({ ...r, error: err })); return }
    const to = tidyCategory(renaming.draft)
    if (to !== renaming.name) { renameCategory(renaming.name, to); onRenamed?.(renaming.name, to) }
    setRenaming(null)
    input.current?.focus()
  }
  const askDelete = (name) => {
    const n = used[name] ?? 0
    if (!n) { deleteCategory(name); onDeleted?.(name, 0); return }
    setConfirm({ name, n })
    setOpen(false)
  }

  const onKey = (e) => {
    if (renaming) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length) }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); choose(active) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    else if (e.key === 'Tab') close(false)
  }
  const shown = value === 'all' ? allLabel : value

  return (
    <>
      <button
        ref={trigger}
        type="button"
        data-popover
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${shown}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if ((e.key === 'ArrowDown' || e.key === 'Enter') && !open) { e.preventDefault(); e.stopPropagation(); setOpen(true) } }}
        className={triggerClassName ?? 'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-line bg-raised px-2.5 text-small font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus'}
      >
        <span className="min-w-0 truncate">{shown}</span>
        <ChevronDown size={14} className="ml-auto shrink-0 text-ink-3" aria-hidden />
      </button>

      {open && createPortal(
        <div ref={menu} data-popover onKeyDown={onKey} style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
          className="fixed z-[60] w-60 rounded-lg border border-line bg-raised p-1 shadow-md">
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls="category-options"
            aria-activedescendant={`category-opt-${active}`}
            aria-label={`Search or create a ${label.toLowerCase()}`}
            aria-invalid={Boolean(error)}
            placeholder="Search or create…"
            value={q}
            onChange={(e) => onType(e.target.value)}
            className={`h-8 w-full rounded-md border bg-surface px-2.5 text-[13px] text-stone-900 outline-none placeholder:text-stone-500 ${error ? 'border-negative' : 'border-line focus:border-[color-mix(in_srgb,var(--ink)_35%,transparent)]'}`}
          />
          {error && <p role="alert" className="px-1 pt-1 text-[12px] leading-4 text-negative">{error}</p>}

          <div id="category-options" role="listbox" aria-label={label} className="mt-1 max-h-60 overflow-y-auto">
            {items.slice(0, -1).map((it, i) => {
              const on = it === value
              const custom = it !== 'all' && isCustom(it)
              if (renaming?.name === it) {
                return (
                  <div key={it} className="px-1 py-0.5">
                    <input
                      autoFocus
                      aria-label={`Rename ${it}`}
                      value={renaming.draft}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setRenaming((r) => ({ ...r, draft: e.target.value, error: null }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); saveRename() }
                        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setRenaming(null); input.current?.focus() }
                      }}
                      onBlur={() => setRenaming(null)}
                      className={`h-8 w-full rounded-md border bg-surface px-2 text-[13px] text-stone-900 outline-none ${renaming.error ? 'border-negative' : 'border-line'}`}
                    />
                    {renaming.error && <p role="alert" className="px-1 pt-1 text-[12px] leading-4 text-negative">{renaming.error}</p>}
                  </div>
                )
              }
              return (
                <div key={it} id={`category-opt-${i}`} data-idx={i} role="option" aria-selected={on}
                  onMouseEnter={() => setActive(i)} onClick={() => choose(i)}
                  className={`group ${row} ${active === i ? 'bg-tint' : ''}`}>
                  {on ? <Check size={14} className="shrink-0 text-ink" aria-hidden /> : <span className="w-3.5 shrink-0" aria-hidden />}
                  <span className={`min-w-0 flex-1 truncate ${on ? 'font-medium' : ''}`}>{it === 'all' ? allLabel : it}</span>
                  {custom && <span className="text-[11px] leading-4 text-stone-500">Custom</span>}
                  {custom && (
                    <span className="hidden items-center group-hover:flex">
                      <button type="button" aria-label={`Rename ${it}`} onClick={(e) => { e.stopPropagation(); setRenaming({ name: it, draft: it, error: null }) }} className={iconBtn}><Pencil size={14} aria-hidden /></button>
                      <button type="button" aria-label={`Delete ${it}`} onClick={(e) => { e.stopPropagation(); askDelete(it) }} className={`${iconBtn} hover:!text-negative`}><Trash2 size={14} aria-hidden /></button>
                    </span>
                  )}
                  {it !== 'all' && <span className={`text-[12px] leading-4 text-stone-500 tabular-nums ${custom ? 'group-hover:hidden' : ''}`}>{counts[it] ?? 0}</span>}
                </div>
              )
            })}
            {!matches.length && !create && <p className="px-2 py-2 text-[13px] text-stone-500">No categories</p>}
          </div>

          <div className="mt-1 border-t border-line pt-1">
            <div id={`category-opt-${createIdx}`} data-idx={createIdx} role="option" aria-selected={false}
              onMouseEnter={() => setActive(createIdx)} onClick={() => choose(createIdx)}
              className={`${row} gap-1.5 font-medium ${create ? 'text-ink' : 'text-stone-600'} ${active === createIdx ? 'bg-tint' : ''}`}>
              <Plus size={14} className="shrink-0" aria-hidden />
              <span className="truncate">{create ? `Create “${tidyCategory(q)}”` : 'New category'}</span>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {confirm && (
        <ConfirmPopover
          anchor={trigger.current}
          title={`Move ${confirm.n} prompt${confirm.n === 1 ? '' : 's'} to ${UNCATEGORIZED}?`}
          body={`“${confirm.name}” will be deleted.`}
          confirmLabel="Delete"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { deleteCategory(confirm.name); onDeleted?.(confirm.name, confirm.n); if (value === confirm.name) onChange(allLabel ? 'all' : UNCATEGORIZED); setConfirm(null) }}
        />
      )}
    </>
  )
}
