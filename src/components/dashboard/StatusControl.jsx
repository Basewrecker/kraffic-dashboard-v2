import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Clock, Sparkles } from 'lucide-react'
import { RowAction } from './PromptTable'

export const STATUSES = {
  in_progress: { label: 'In progress', className: 'bg-tint text-stone-600' },
  waiting: { label: 'Waiting for sync', className: 'bg-tint text-stone-600', icon: Clock },
  published: { label: 'Published', className: 'bg-tint text-stone-600' },
}

// No status → the muted "Create content" action. Status set → a pill that opens a status menu.
export default function StatusControl({ status, onChange, onCreate }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const menu = useRef(null)

  useEffect(() => {
    if (!open) return
    menu.current?.querySelector('button')?.focus()
    const close = (e) => {
      if (e.type === 'keydown' && e.key !== 'Escape') return
      if (e.type === 'mousedown' && (menu.current?.contains(e.target) || btn.current?.contains(e.target))) return
      setOpen(false)
      if (e.type === 'keydown') btn.current?.focus()
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  if (!status) return <RowAction icon={Sparkles} onClick={onCreate}>Create content</RowAction>

  const s = STATUSES[status]
  const toggle = () => {
    // fixed position so the menu isn't clipped by the card's overflow-hidden
    const r = btn.current.getBoundingClientRect()
    setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    setOpen((o) => !o)
  }
  const choose = (next) => { onChange(next); setOpen(false); btn.current?.focus() }

  return (
    <>
      <button
        ref={btn}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full pl-2.5 pr-2 text-[13px] font-medium outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-focus ${s.className}`}
      >
        {s.icon && <s.icon size={12} aria-hidden />}
        {s.label}
        <ChevronDown size={12} aria-hidden className="opacity-70" />
      </button>
      {open && (
        <div
          ref={menu}
          role="menu"
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-30 w-48 rounded-lg border border-line bg-raised p-1 text-left shadow-lg"
        >
          {Object.entries(STATUSES).map(([key, v]) => (
            <button
              key={key}
              role="menuitemradio"
              aria-checked={status === key}
              onClick={() => choose(key)}
              className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-small text-stone-700 outline-none hover:bg-stone-100 focus-visible:bg-stone-100"
            >
              <span className="w-4">{status === key && <Check size={14} />}</span>
              {v.label}
            </button>
          ))}
          <div className="my-1 border-t border-stone-100" />
          <button role="menuitem" onClick={() => choose(null)} className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-small text-stone-500 outline-none hover:bg-stone-100 focus-visible:bg-stone-100">
            <span className="w-4" />
            Clear status
          </button>
        </div>
      )}
    </>
  )
}

export function PriorityLabel({ level }) {
  const dot = { high: 'bg-ink', medium: 'bg-stone-500', low: 'bg-stone-300' }[level]
  return (
    <span className="inline-flex items-center gap-2 text-small font-medium text-stone-700">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      {level[0].toUpperCase() + level.slice(1)}
    </span>
  )
}
