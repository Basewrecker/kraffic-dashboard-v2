import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { useMenuMotion } from '../../hooks/useMenuMotion'

// A trigger button + a small menu of actions (the ⋯ on /audit, Export ▾ on /structured-data).
// items: [{ label, onClick, checked?, danger?, icon?, disabled? }] (danger: a destructive action, in the negative
// colour; checked: a choice, ticked when it's the current one; the first ticked item gets focus; icon: a 14px icon
// before the label). heading: a small title over the items. ↓/↑ move, Esc closes and refocuses the trigger,
// click-outside closes.
// side: 'bottom' (default) or 'top' (opens upward, e.g. from a footer at a panel's bottom edge)
// portal: draw the menu in <body> (or the open dialog), 4px under the trigger (above it near the bottom edge), so a
// dialog row or a scrolling card never clips it.
// Motion (as the app, #232 / #234): opens in 150ms from 0.96 scale, growing from the trigger's corner; closes in
// 120ms; inert while closing.
export default function ActionMenu({ label, items, heading, className, align = 'right', side = 'bottom', portal = false, width = 'w-48', disabled = false, onOpenChange, children }) {
  const [open, setOpenState] = useState(false)
  const [pos, setPos] = useState(null)
  const wrap = useRef(null)
  const btn = useRef(null)
  const menu = useRef(null)
  const setOpen = (v) => { setOpenState(v); onOpenChange?.(typeof v === 'function' ? v(open) : v) }
  const at = portal ? pos?.side ?? side : side
  const m = useMenuMotion(open, { align, side: at })
  useLayoutEffect(() => {
    if (!open || !portal || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    const need = 16 + items.length * 32 + (heading ? 28 : 0)
    const up = side === 'top' || (window.innerHeight - r.bottom < need + 8 && r.top > need)
    setPos({
      side: up ? 'top' : 'bottom',
      ...(align === 'right' ? { right: window.innerWidth - r.right } : { left: r.left }),
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    })
  }, [open, portal]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      const first = menu.current?.querySelector('[aria-checked=true]') ?? menu.current?.querySelector('[role^=menuitem]:not([disabled])')
      first?.focus()
    })
    const out = (e) => { if (!wrap.current?.contains(e.target) && !menu.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (fn) => { setOpen(false); btn.current?.focus(); fn?.() }
  const onKey = (e) => {
    const els = [...(menu.current?.querySelectorAll('[role^=menuitem]:not([disabled])') ?? [])]
    const i = els.indexOf(document.activeElement)
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); btn.current?.focus() }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus() }
    else if (e.key === 'Tab') setOpen(false)
  }
  const item = 'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] leading-[18px] outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent'
  const panel = m.mounted && (
    <div ref={menu} role="menu" aria-label={label} onKeyDown={onKey} {...m.props}
      style={{ ...m.style, ...(portal && pos ? { position: 'fixed', left: pos.left, right: pos.right, top: pos.top, bottom: pos.bottom } : {}) }}
      className={`${portal ? 'z-[90]' : `absolute ${align === 'right' ? 'right-0' : 'left-0'} ${side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} z-30`} ${width} rounded-lg border border-line bg-raised p-1 shadow-md`}>
      {heading && <div className="px-2 pb-1 pt-1.5 text-[12px] leading-4 font-medium text-stone-500">{heading}</div>}
      {items.map((it) => (
        <button key={it.label} type="button" disabled={it.disabled} role={it.checked == null ? 'menuitem' : 'menuitemradio'} aria-checked={it.checked ?? undefined} onClick={() => pick(it.onClick)} className={`${item} ${it.danger ? 'font-medium text-negative' : 'text-stone-900'}`}>
          {it.checked != null && <Check size={14} className={it.checked ? 'text-ink' : 'invisible'} aria-hidden />}
          {it.icon && <it.icon size={14} className="shrink-0 text-stone-600" aria-hidden />}
          {it.label}
        </button>
      ))}
    </div>
  )
  // a portal menu inside an open dialog is drawn in that dialog (its focus trap and stacking keep working)
  const root = portal && (wrap.current?.closest('[role=dialog]') ?? document.body)
  return (
    <div ref={wrap} className="relative" onKeyDown={open && !portal ? onKey : undefined}>
      <button ref={btn} type="button" disabled={disabled} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={className}>
        {children}
      </button>
      {portal ? panel && root && createPortal(panel, root) : panel}
    </div>
  )
}
