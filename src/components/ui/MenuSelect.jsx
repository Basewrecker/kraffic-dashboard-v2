import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useMenuMotion } from '../../hooks/useMenuMotion'

// size 'sm' = h-8 (header and page toolbars), 'md' = h-10; label optional
export const triggerClass = (size) =>
  `inline-flex ${size === 'sm' ? 'h-8 rounded-md px-3 text-[13px]' : 'h-10 rounded-lg px-3.5 text-small'} shrink-0 items-center gap-2 whitespace-nowrap border border-line bg-raised outline-none transition-[border-color] duration-150 hover:border-[var(--color-line-strong)] focus-visible:ring-2 focus-visible:ring-focus`

// header selects: full width, 40px tall below lg; exactly the old h-8 trigger from lg
export const MOBILE_TRIGGER = `${triggerClass('sm')} max-lg:h-10 max-lg:w-full max-lg:rounded-lg max-lg:text-[14px] [&>svg:last-child]:max-lg:ml-auto`

// The header dropdown: the one select a client sees (no native <select> anywhere; as the app, #209 / #216).
// Trigger like the other selects ("Prefix  Value ▾"), grouped listbox, optional footer. A check on the picked item.
// ↓ opens; ↑/↓ move, Enter/Space pick, typing jumps to the item that starts with it, Esc closes only the list and
// returns focus to the trigger. Opens and closes with the shared menu motion (hooks/useMenuMotion).
// groups: [{ label?, divider?, items: [{ id, label, short?, icon?, meta }] }] (short: the trigger's text, if shorter);
// prefix optional (aria-label falls back to listLabel); showIcon puts the current item's icon in the trigger;
// align 'left' opens from the trigger's left edge; portal draws the list in <body>, flipped above the trigger when
// there's no room under it (table footers, dialogs); search adds a filter box over a long list;
// triggerClassName replaces the trigger's size / shape classes; width: the list's width class.
export function MenuSelect({ prefix = '', value, onChange, groups, footer, title, listLabel, showIcon, align = 'right', portal = false, search = false, triggerClassName, className = '', width = 'w-72', disabled = false }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [q, setQ] = useState('')
  const [pos, setPos] = useState(null) // portal: { left|right, top|bottom, side }
  const wrap = useRef(null)
  const trigger = useRef(null)
  const list = useRef(null)
  const typed = useRef({ s: '', t: 0 })
  const all = groups.flatMap((g) => g.items)
  const match = (x) => !q || String(x.label).toLowerCase().includes(q.toLowerCase())
  const shownGroups = groups.map((g) => ({ ...g, items: g.items.filter(match) })).filter((g) => g.items.length)
  const order = shownGroups.flatMap((g) => g.items)
  const current = all.find((x) => x.id === value) ?? all[0]
  const uid = (prefix || listLabel || 'select').replace(/\W+/g, '-').toLowerCase()
  const side = pos?.side ?? 'bottom'
  const m = useMenuMotion(open, { align, side })

  useLayoutEffect(() => {
    if (!open || !portal || !trigger.current) return
    const r = trigger.current.getBoundingClientRect()
    const need = Math.min(360, 16 + all.length * 32 + (footer ? 40 : 0) + (search ? 40 : 0))
    const up = window.innerHeight - r.bottom < need && r.top > window.innerHeight - r.bottom
    setPos({
      side: up ? 'top' : 'bottom',
      ...(align === 'left' ? { left: r.left } : { right: window.innerWidth - r.right }),
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      minWidth: r.width,
    })
  }, [open, portal]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    setQ('')
    setActive(Math.max(0, all.findIndex((x) => x.id === value)))
    requestAnimationFrame(() => (list.current?.querySelector('input') ?? list.current)?.focus())
    const close = (e) => { if (!wrap.current?.contains(e.target) && !list.current?.contains(e.target)) setOpen(false) }
    const away = () => { if (portal) setOpen(false) }
    document.addEventListener('mousedown', close)
    window.addEventListener('resize', away)
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('resize', away) }
  }, [open, value]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (x) => { onChange(x.id, trigger.current); setOpen(false); trigger.current?.focus() }
  const onKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + order.length) % Math.max(1, order.length))
    } else if (e.key === 'Enter' || (e.key === ' ' && !search)) {
      e.preventDefault(); if (order[active]) pick(order[active])
    } else if (e.key === 'Escape') {
      // Esc closes only the list, never the dialog or drawer it sits in
      e.preventDefault(); e.stopPropagation(); setOpen(false); trigger.current?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    } else if (!search && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      // type-ahead: letters typed within 600ms build a prefix
      const now = Date.now()
      typed.current = { s: (now - typed.current.t < 600 ? typed.current.s : '') + e.key.toLowerCase(), t: now }
      const i = order.findIndex((x) => String(x.label).toLowerCase().startsWith(typed.current.s))
      if (i >= 0) setActive(i)
    }
  }

  const panel = m.mounted && (
    <div
      ref={list}
      role="listbox"
      tabIndex={-1}
      aria-label={listLabel}
      aria-activedescendant={order.length ? `${uid}-opt-${active}` : undefined}
      onKeyDown={onKey}
      {...m.props}
      style={{ ...m.style, ...(portal && pos ? { position: 'fixed', left: pos.left, right: pos.right, top: pos.top, bottom: pos.bottom, minWidth: pos.minWidth } : {}) }}
      className={`${portal ? 'z-[90]' : `absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full z-30 mt-1 max-lg:left-0 max-lg:right-0 max-lg:w-auto`} ${width} max-h-[360px] overflow-y-auto rounded-lg border border-line bg-raised p-1 shadow-md outline-none`}
    >
      {search && (
        <label className="mb-1 flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2 focus-within:border-[var(--color-line-strong)]">
          <Search size={14} className="shrink-0 text-ink-3" aria-hidden />
          <input value={q} onChange={(e) => { setQ(e.target.value); setActive(0) }} placeholder="Search" aria-label="Search the list" className="min-w-0 flex-1 bg-transparent text-[13px] leading-[18px] text-stone-900 outline-none placeholder:text-stone-500" />
        </label>
      )}
      {shownGroups.map((g, gi) => (
        <div key={g.label ?? gi} role="group" aria-label={g.label}>
          {gi > 0 && g.divider && <div aria-hidden className="mx-1 my-1 h-px bg-line" />}
          {g.label && <div className="px-2 pb-1 pt-1.5 text-[11px] leading-4 font-medium text-stone-500">{g.label}</div>}
          {g.items.map((x) => {
            const i = order.indexOf(x)
            const selected = x.id === value
            return (
              <div
                key={x.id}
                id={`${uid}-opt-${i}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(x)}
                className={`flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] leading-[18px] text-stone-900 ${active === i ? 'bg-tint' : ''}`}
              >
                {selected ? <Check size={14} className="shrink-0 text-ink" aria-hidden /> : <span className="w-3.5 shrink-0" aria-hidden />}
                {x.icon}
                <span className={`flex-1 truncate ${selected ? 'font-medium' : ''}`}>{x.label}</span>
                {x.meta != null && <span className="shrink-0 text-[12px] leading-4 text-stone-500 tabular-nums">{x.meta}</span>}
              </div>
            )
          })}
        </div>
      ))}
      {search && !order.length && <div className="px-2 py-2 text-[13px] leading-[18px] text-stone-500">Nothing matches.</div>}
      {footer && <div className="mt-1 border-t border-line px-2 py-2 text-[12px] leading-4 text-stone-500">{footer}</div>}
    </div>
  )

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${prefix || listLabel}: ${current?.label ?? ''}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true) } }}
        className={`${triggerClassName ?? triggerClass('sm')} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {prefix && <span className="font-normal text-stone-500">{prefix}</span>}
        {showIcon && current?.icon}
        {/* a narrow trigger ends the label with an ellipsis */}
        <span className={`${prefix ? '-ml-0.5 ' : ''}min-w-0 truncate font-medium text-stone-900`}>{current?.short ?? current?.label}</span>
        <ChevronDown size={14} className="shrink-0 text-ink-3" />
      </button>
      {portal ? panel && createPortal(panel, document.body) : panel}
    </div>
  )
}

export default MenuSelect
