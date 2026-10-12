import { useSheetDrag } from '../../hooks/useOverlay'

// Side drawers become bottom sheets below md: these are the shared pieces.
// SHEET_BASE + (shown ? SHEET_IN : SHEET_OUT) on the panel, plus the drawer's own md:w-[…] width class.
//   phones: bottom sheet, 92dvh, rounded top, slides up 280ms
//   md+:   the right-hand drawer as before (slide 6px + fade, 250ms)
export const SHEET_BASE = 'absolute flex flex-col bg-surface shadow-xl outline-none motion-reduce:transition-none inset-x-0 bottom-0 h-[92dvh] rounded-t-2xl border-t border-line transition-[translate,opacity] duration-[280ms] ease-[cubic-bezier(.2,.8,.2,1)] md:inset-x-auto md:inset-y-0 md:right-0 md:h-auto md:rounded-none md:border-t-0 md:border-l md:duration-[250ms] md:ease-out'
export const SHEET_IN = 'translate-y-0 md:translate-x-0 opacity-100'
export const SHEET_OUT = 'translate-y-full md:translate-y-0 md:translate-x-6 md:opacity-0'
// footers inside a sheet clear the home indicator
export const SHEET_FOOTER_PAD = 'pb-[max(12px,env(safe-area-inset-bottom))] md:pb-3'

// the grab handle (phones only): drag down past 120px or flick to close
export default function SheetHandle({ panelRef, onClose }) {
  const drag = useSheetDrag(panelRef, onClose)
  return (
    <div className="shrink-0 cursor-grab touch-none pb-1 pt-2 md:hidden" {...drag} aria-hidden>
      <div className="mx-auto h-1 w-9 rounded-full bg-[var(--color-line-strong)]" />
    </div>
  )
}
