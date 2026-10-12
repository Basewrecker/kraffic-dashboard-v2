import { createContext, useContext, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useBackClose, useSheetDrag } from '../../hooks/useOverlay'

// Bottom sheet (phones): action menus, sort options, the workspace switcher, small forms.
// Portal · scrim bg-black/40 · rounded-t-2xl · grab handle (drag down to close) · Esc / scrim / X close ·
// Back closes it first · safe-area padding at the bottom · slides up 280ms.
//   <Sheet open onClose title>…</Sheet>        content height (max 92dvh)
//   <SheetItem icon onClick>Label</SheetItem>  a 48px menu row
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
// a menu item's action runs after the sheet has closed and its history entry is gone, so an action that
// navigates or opens another overlay isn't undone by the sheet's own Back
const SheetContext = createContext(null)

export default function Sheet({ open, onClose, title, children, footer, tall = false }) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const panel = useRef(null)
  const titleId = useId()
  const [close] = useBackClose(open, onClose)
  const drag = useSheetDrag(panel, close)
  const pick = (fn) => {
    let done = false
    const run = () => { if (done) return; done = true; window.removeEventListener('popstate', run); setTimeout(() => fn?.(), 0) }
    window.addEventListener('popstate', run)
    setTimeout(run, 400) // in case there was no history entry to pop
    close()
  }

  useEffect(() => {
    if (open) {
      setMounted(true)
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(r)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), reduced() ? 0 : 280)
    return () => clearTimeout(t)
  }, [open])
  useEffect(() => {
    if (!open || !mounted) return
    const before = document.activeElement
    panel.current?.focus()
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close() } }
    document.addEventListener('keydown', esc)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = overflow; before?.focus?.() }
  }, [open, mounted, close])

  if (!mounted) return null
  return createPortal(
    <SheetContext.Provider value={pick}>
    <div className="fixed inset-0 z-[80]">
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-[280ms] ease-out motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`} onClick={close} aria-hidden />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} tabIndex={-1}
        className={`absolute inset-x-0 bottom-0 flex ${tall ? 'h-[92dvh]' : 'max-h-[92dvh]'} flex-col rounded-t-2xl border-t border-line bg-surface shadow-xl outline-none transition-transform duration-[280ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ${shown ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="shrink-0 cursor-grab touch-none pb-1 pt-2 active:cursor-grabbing" {...drag}>
          <div className="mx-auto h-1 w-9 rounded-full bg-[var(--color-line-strong)]" aria-hidden />
          {title && (
            <div className="flex h-11 items-center justify-between gap-3 px-4">
              <h2 id={titleId} className="truncate text-[15px] leading-5 font-semibold text-stone-900">{title}</h2>
              <button type="button" onClick={close} aria-label="Close" className="-mr-2 grid h-10 w-10 place-items-center rounded-md text-stone-600 outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus"><X size={18} aria-hidden /></button>
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-[max(12px,env(safe-area-inset-bottom))]">{children}</div>
        {footer && <div className="shrink-0 border-t border-line px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
    </SheetContext.Provider>,
    document.body,
  )
}

export function SheetItem({ icon: Icon, children, onClick, active = false, meta, disabled = false, keepOpen = false, ...rest }) {
  const pick = useContext(SheetContext)
  return (
    <button type="button" onClick={() => (keepOpen || !pick ? onClick?.() : pick(onClick))} disabled={disabled} {...rest}
      className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] leading-5 outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint disabled:opacity-50 ${active ? 'font-semibold text-ink' : 'text-stone-900'}`}>
      {Icon && <Icon size={18} className="shrink-0 text-stone-600" aria-hidden />}
      <span className="min-w-0 flex-1">{children}</span>
      {meta}
    </button>
  )
}
