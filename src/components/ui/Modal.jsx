import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import SheetHandle, { SHEET_FOOTER_PAD } from './SheetHandle'
import { useBackClose, useDialogFocus } from '../../hooks/useOverlay'
import { motionMs, reducedMotion } from '../../lib/motionTokens'

// 520 / 760 / 980px (billing's review step, plan picker and wide tables)
const SIZE = { md: 'md:max-w-[520px]', lg: 'md:max-w-[760px]', xl: 'md:max-w-[980px]' }

// Mount on open, unmount after the close has played (the shared tokens: index.css, --motion-dialog-*).
// state: 'enter' (mounted, about to show) → 'shown' → 'exit' (closing) → unmounted
function usePresence(open) {
  const [mounted, setMounted] = useState(open)
  const [state, setState] = useState('enter')
  useEffect(() => {
    if (open) {
      setMounted(true)
      setState('enter')
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setState('shown')))
      return () => cancelAnimationFrame(raf)
    }
    setState('exit')
    // phones: the sheet slides all the way down, so it gets the open's time
    const t = setTimeout(() => setMounted(false), window.matchMedia('(min-width: 768px)').matches ? motionMs('--motion-dialog-out') : 240)
    return () => clearTimeout(t)
  }, [open])
  return [mounted, state]
}

// A dialog with steps: the body cross-fades and slides 12px to the new step and the dialog's height follows it
// (200ms). Reduced motion: the fade only (the .modal-step rule in index.css).
function StepBody({ stepKey, children }) {
  const inner = useRef(null)
  const [h, setH] = useState(null)
  useLayoutEffect(() => {
    if (!inner.current) return
    const ro = new ResizeObserver(() => setH(inner.current.offsetHeight))
    ro.observe(inner.current)
    return () => ro.disconnect()
  }, [])
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 md:px-6" style={h == null || reducedMotion() ? undefined : { height: h, transition: 'height var(--motion-step) var(--motion-ease-out)' }}>
      <div ref={inner} className="pb-4"><div key={stepKey} className="modal-step">{children}</div></div>
    </div>
  )
}

// Dialog: portal, focus trap (focus returns to the trigger), Esc / overlay / X to close, body scroll lock.
//   header: title + subtitle (+ `meta` line) · `toolbar` (pinned, doesn't scroll) · body (scrolls) · footer (border-t)
// Motion (as the app, #232 / #234; every dialog gets it by default): the scrim fades in 200ms; the panel rises 8px
// from 0.98 scale in 240ms; it closes in 160ms sinking 4px, then unmounts. stepKey: a dialog with steps (see
// StepBody). motion={false} keeps a plain fade. Reduced motion: fades only. Phones: a bottom sheet that slides up.
// panelRef: a callback given the dialog's panel once it mounts (the upgrade flow animates it). morph: the opener animates
// the panel itself (from a plan card), so the CSS rise is skipped while it opens.
export default function Modal({ open: wanted, onClose, title, subtitle, meta, toolbar, footer, size = 'md', stepKey, motion = true, panelRef, morph = false, children }) {
  // a dialog that is already open on the first render (a link straight to it: ?review=, ?change=, ?cancel=) opens once
  // the page has settled, so its Back handling starts from a settled history entry
  const [armed, setArmed] = useState(false)
  useEffect(() => { const t = setTimeout(() => setArmed(true), 60); return () => clearTimeout(t) }, [])
  const open = wanted && armed
  const [mounted, state] = usePresence(open)
  const panel = useRef(null)
  const outer = useRef(panelRef)
  outer.current = panelRef
  // one stable callback, so the outer one is called once when the panel mounts (and with null when it goes)
  const setPanel = useCallback((n) => { panel.current = n; outer.current?.(n) }, [])
  const close = useRef(onClose)
  close.current = onClose
  const titleId = useId()
  useBackClose(open, () => close.current()) // Back closes the dialog first

  // focus trap + Esc + return focus + scroll lock, for as long as it's open (hooks/useOverlay.js, shared)
  useDialogFocus(panel, open && mounted, close)

  if (!mounted) return null
  return createPortal(
    // phones: a bottom sheet (grab handle, drag down to close); md+: the centred dialog
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4">
      <div onClick={() => close.current()} aria-hidden data-state={state} className="modal-scrim absolute inset-0 bg-[var(--modal-scrim)] backdrop-blur-[2px]" />
      <div
        ref={setPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-state={state}
        data-plain={motion ? undefined : ''}
        data-morph={morph && state !== 'exit' ? '' : undefined}
        className={`modal-panel relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-xl outline-none md:max-h-[85vh] md:rounded-2xl ${SIZE[size]}`}
      >
        <SheetHandle panelRef={panel} onClose={() => close.current()} />
        <header data-morph-fade className="flex items-start justify-between gap-4 px-4 pb-4 pt-2 md:px-6 md:pt-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[20px] leading-7 font-semibold text-stone-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600 text-pretty">{subtitle}</p>}
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
        {stepKey != null
          ? <StepBody stepKey={stepKey}>{children}</StepBody>
          : <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-6">{children}</div>}
        {footer && <footer data-morph-fade className={`flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 pt-4 md:px-6 md:pb-4 ${SHEET_FOOTER_PAD}`}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
