import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import SheetHandle, { SHEET_FOOTER_PAD } from './SheetHandle'
import { useBackClose } from '../../hooks/useOverlay'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
const SIZE = { md: 'md:max-w-[520px]', lg: 'md:max-w-[760px]' }

// Mount on open, unmount after the exit animation (150ms).
function usePresence(open) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(raf)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), 150)
    return () => clearTimeout(t)
  }, [open])
  return [mounted, shown]
}

// Dialog: portal, focus trap (focus returns to the trigger), Esc / overlay / X to close, body scroll lock.
//   header: title + subtitle (+ `meta` line) · `toolbar` (pinned, doesn't scroll) · body (scrolls) · footer (border-t)
export default function Modal({ open, onClose, title, subtitle, meta, toolbar, footer, size = 'md', children }) {
  const [mounted, shown] = usePresence(open)
  const panel = useRef(null)
  const close = useRef(onClose)
  close.current = onClose
  const titleId = useId()
  useBackClose(open, () => close.current()) // Back closes the dialog first

  // focus trap + Esc + return focus + scroll lock, for as long as it's open
  useEffect(() => {
    if (!open || !mounted) return
    const before = document.activeElement
    const el = panel.current
    const items = () => [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null)
    ;(el.querySelector('[data-autofocus]') ?? el).focus()

    const onKey = (e) => {
      if (e.key === 'Escape') { close.current(); return }
      if (e.key !== 'Tab') return
      const f = items()
      if (!f.length) { e.preventDefault(); return }
      const inside = el.contains(document.activeElement)
      if (e.shiftKey && (!inside || document.activeElement === f[0] || document.activeElement === el)) { e.preventDefault(); f[f.length - 1].focus() }
      else if (!e.shiftKey && (!inside || document.activeElement === f[f.length - 1])) { e.preventDefault(); f[0].focus() }
    }
    document.addEventListener('keydown', onKey) // bubble phase: popovers inside handle their own Esc first (capture + stopPropagation)

    // lock the page behind, keeping its width (no jump when the scrollbar disappears)
    const { overflow, paddingRight } = document.body.style
    const gap = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (gap) document.body.style.paddingRight = `${gap}px`

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
      before?.focus?.()
    }
  }, [open, mounted])

  if (!mounted) return null
  return createPortal(
    // phones: a bottom sheet (grab handle, drag down to close); md+: the centred dialog
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4">
      <div
        onClick={() => close.current()}
        aria-hidden
        className={`absolute inset-0 bg-[var(--modal-scrim)] backdrop-blur-[2px] transition-opacity duration-150 motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-xl outline-none transition-[opacity,transform,translate,scale] motion-reduce:transition-none md:max-h-[85vh] md:rounded-2xl ${SIZE[size]} ${
          shown ? 'translate-y-0 scale-100 opacity-100 duration-[280ms] ease-[cubic-bezier(.2,.8,.2,1)] md:duration-200 md:ease-out' : 'translate-y-full md:translate-y-1 md:scale-[.98] md:opacity-0 duration-150 ease-in'
        }`}
      >
        <SheetHandle panelRef={panel} onClose={() => close.current()} />
        <header className="flex items-start justify-between gap-4 px-4 pb-4 pt-2 md:px-6 md:pt-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[20px] leading-7 font-semibold text-stone-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600">{subtitle}</p>}
            {meta && <p className="mt-1 text-[12px] leading-4 text-stone-500">{meta}</p>}
          </div>
          <button
            type="button"
            onClick={() => close.current()}
            aria-label="Close"
            className="-mr-2 -mt-1 grid h-10 w-10 shrink-0 md:h-8 md:w-8 place-items-center rounded-md text-stone-500 outline-none transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        {toolbar && <div className="px-4 pb-3 md:px-6">{toolbar}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-6">{children}</div>
        {footer && <footer className={`flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 pt-4 md:px-6 md:pb-4 ${SHEET_FOOTER_PAD}`}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
