import { useEffect, useRef, useState } from 'react'
import SheetHandle, { SHEET_BASE, SHEET_FOOTER_PAD, SHEET_IN, SHEET_OUT } from '../ui/SheetHandle'
import { X } from 'lucide-react'
import SiteLogo from '../ui/SiteLogo'
import { brandName } from '../../utils/brand'

// A brand's real logo (favicon on a white plate, letter fallback) in a round 20px / 16px box — same source as Setup.
export function Favicon({ domain, size = 20, className = '' }) {
  return (
    <span title={brandName(domain)} className={`inline-flex shrink-0 rounded-full ${className}`} aria-hidden>
      <SiteLogo domain={domain} name={brandName(domain)} className={`${size === 16 ? 'h-4 w-4' : 'h-5 w-5'} rounded-full`} imgPad="p-0.5" initialClass="text-[10px]" plate />
    </span>
  )
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

// Traps Tab inside `ref`, closes on Escape, and restores focus to whatever was focused before.
export function useFocusTrap(ref, active, onClose) {
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!active) return
    const el = ref.current
    const before = document.activeElement
    const items = () => [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null)
    ;(el.querySelector('[data-autofocus]') ?? items()[0] ?? el).focus()
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current() }
      if (e.key !== 'Tab') return
      const f = items()
      if (!f.length) return
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
    }
    el.addEventListener('keydown', onKey)
    return () => { el.removeEventListener('keydown', onKey); before?.focus?.() }
  }, [active, ref])
}

// Mount → animate in; close → animate out, then unmount.
function usePresence(open, ms) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(raf)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(t)
  }, [open, ms])
  return [mounted, shown]
}

// Right-side sheet: 480px, slides in over 250ms ease-out, stone-900/20 backdrop.
export function Sheet({ open, onClose, label, children, footer }) {
  const [mounted, shown] = usePresence(open, 250)
  const ref = useRef(null)
  useFocusTrap(ref, mounted && open, onClose)
  if (!mounted) return null
  return (
    <div className="fixed inset-0 z-40">
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-scrim-sheet transition-opacity duration-[250ms] ease-out motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`}
      />
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`${SHEET_BASE} bg-overlay md:w-[480px] ${shown ? SHEET_IN : SHEET_OUT}`}
      >
        <SheetHandle panelRef={ref} onClose={onClose} />
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-4 z-10 grid h-10 w-10 md:right-5 md:top-5 md:h-8 md:w-8 place-items-center rounded-md text-stone-500 transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
        >
          <X size={18} />
        </button>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className={`sticky bottom-0 border-t border-stone-100 bg-overlay px-4 pt-4 md:px-7 ${SHEET_FOOTER_PAD} md:pb-4`}>{footer}</div>}
      </aside>
    </div>
  )
}

// Centered dialog; stacks above the sheet.
export function Modal({ open, onClose, title, children, footer }) {
  const [mounted, shown] = usePresence(open, 200)
  const ref = useRef(null)
  useFocusTrap(ref, mounted && open, onClose)
  if (!mounted) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-end md:place-items-center md:p-6">
      <div onClick={onClose} className={`absolute inset-0 bg-scrim-modal transition-opacity duration-200 motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-line bg-overlay shadow-xl outline-none transition duration-200 ease-out motion-reduce:transition-none md:max-h-[85vh] md:max-w-[640px] md:rounded-2xl ${shown ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-100 md:translate-y-2 md:opacity-0'}`}
      >
        <SheetHandle panelRef={ref} onClose={onClose} />
        <div className="flex items-center justify-between px-4 pt-2 md:px-7 md:pt-6">
          <h2 className="text-title font-semibold text-stone-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-stone-500 transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-7">{children}</div>
        {footer && <div className={`flex justify-end gap-2 border-t border-stone-100 px-4 pt-4 md:px-7 md:pb-4 ${SHEET_FOOTER_PAD} [&>*]:max-md:flex-1`}>{footer}</div>}
      </div>
    </div>
  )
}

// Toast; auto-hides (3s, or `duration`). toast(text, { action: { label, onClick }, duration }).
// position 'right' (dashboard default) or 'center' (bottom-centre, used on /prompts).
export function useToast({ position = 'right' } = {}) {
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), msg.duration ?? 3000)
    return () => clearTimeout(t)
  }, [msg])
  const node = (
    <div aria-live="polite" className={`pointer-events-none fixed bottom-6 z-[70] ${position === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-6'}`}>
      {msg && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-stone-900 px-4 py-3 text-small font-medium text-white shadow-lg">
          {msg.text}
          {msg.action && (
            <button
              type="button"
              onClick={() => { msg.action.onClick(); setMsg(null) }}
              className="-my-1 rounded px-1 font-semibold underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {msg.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
  // object wrapper so the same text twice still re-triggers the timer
  return [node, (text, opts = {}) => setMsg({ text, ...opts })]
}

export function PrimaryButton({ children, onClick, icon: Icon, size = 'md', ...rest }) {
  return (
    <button
      onClick={onClick}
      {...rest}
      className={`inline-flex ${size === 'sm' ? 'h-9 px-3.5' : 'h-10 px-4'} items-center gap-2 whitespace-nowrap rounded-lg bg-ink text-small font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40`}
    >
      {Icon && <Icon size={16} aria-hidden />}
      {children}
    </button>
  )
}

export function SecondaryButton({ children, onClick, icon: Icon, size = 'md', ...rest }) {
  return (
    <button
      onClick={onClick}
      {...rest}
      className={`inline-flex ${size === 'sm' ? 'h-9 px-3.5' : 'h-10 px-4'} items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-transparent text-small font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-stone-50 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:text-stone-400`}
    >
      {Icon && <Icon size={16} aria-hidden />}
      {children}
    </button>
  )
}
