import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'

// A trigger button + a small menu of actions (the ⋯ on /audit, Export ▾ on /structured-data).
// items: [{ label, onClick, checked? }] (checked: a choice, ticked when it's the current one; the first ticked item
// gets focus). heading: a small title over the items. ↓/↑ move, Esc closes and refocuses the trigger, click-outside closes.
export default function ActionMenu({ label, items, heading, className, align = 'right', children }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const btn = useRef(null)
  const menu = useRef(null)
  useEffect(() => {
    if (!open) return
    const first = menu.current?.querySelector('[aria-checked=true]') ?? menu.current?.querySelector('[role^=menuitem]')
    first?.focus()
    const out = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [open])
  const pick = (fn) => { setOpen(false); btn.current?.focus(); fn() }
  const onKey = (e) => {
    const els = [...menu.current.querySelectorAll('[role^=menuitem]')]
    const i = els.indexOf(document.activeElement)
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); btn.current?.focus() }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus() }
    else if (e.key === 'Tab') setOpen(false)
  }
  const item = 'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] leading-[18px] text-stone-900 outline-none hover:bg-tint focus-visible:bg-tint'
  return (
    <div ref={wrap} className="relative" onKeyDown={open ? onKey : undefined}>
      <button ref={btn} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={className}>
        {children}
      </button>
      {open && (
        <div ref={menu} role="menu" aria-label={label} className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full z-30 mt-1 w-48 rounded-lg border border-line bg-raised p-1 shadow-md`}>
          {heading && <div className="px-2 pb-1 pt-1.5 text-[12px] leading-4 font-medium text-stone-500">{heading}</div>}
          {items.map((it) => (
            <button key={it.label} type="button" role={it.checked == null ? 'menuitem' : 'menuitemradio'} aria-checked={it.checked ?? undefined} onClick={() => pick(it.onClick)} className={item}>
              {it.checked != null && <Check size={14} className={it.checked ? 'text-ink' : 'invisible'} aria-hidden />}{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
