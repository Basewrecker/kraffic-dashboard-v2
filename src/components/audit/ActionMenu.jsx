import { useEffect, useRef, useState } from 'react'

// A trigger button + a small menu of actions (the ⋯ on /audit, Export ▾ on /structured-data).
// items: [{ label, onClick }]. ↓/↑ move, Esc closes and refocuses the trigger, click-outside closes.
export default function ActionMenu({ label, items, className, align = 'right', children }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const btn = useRef(null)
  const menu = useRef(null)
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector('[role=menuitem]')?.focus()
    const out = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [open])
  const pick = (fn) => { setOpen(false); btn.current?.focus(); fn() }
  const onKey = (e) => {
    const els = [...menu.current.querySelectorAll('[role=menuitem]')]
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
          {items.map((it) => <button key={it.label} type="button" role="menuitem" onClick={() => pick(it.onClick)} className={item}>{it.label}</button>)}
        </div>
      )}
    </div>
  )
}
