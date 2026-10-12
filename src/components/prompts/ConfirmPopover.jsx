import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Small confirm popover anchored to a button. Rendered in a portal so the table card's
// overflow-hidden can't clip it; flips above the anchor near the bottom of the viewport.
// Closes on Escape, outside click or scroll.
export default function ConfirmPopover({ anchor, title, body, confirmLabel = 'Delete', cancelLabel = 'Cancel', onConfirm, onCancel }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  const cancel = useRef(onCancel) // latest callback without re-running the listener effect each render
  cancel.current = onCancel

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return
    const a = anchor.getBoundingClientRect(), p = ref.current.getBoundingClientRect()
    const below = a.bottom + 6 + p.height <= window.innerHeight - 8
    setPos({
      top: below ? a.bottom + 6 : a.top - 6 - p.height,
      left: Math.max(8, Math.min(a.right - p.width, window.innerWidth - p.width - 8)),
    })
  }, [anchor])

  useEffect(() => {
    ref.current?.querySelector('[data-autofocus]')?.focus()
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); cancel.current() } }
    const onDown = (e) => { if (!ref.current?.contains(e.target) && !anchor?.contains(e.target)) cancel.current() }
    // ignore the tail of a scroll that brought the trigger into view (momentum / scrollIntoView)
    const opened = performance.now()
    const onScroll = () => { if (performance.now() - opened > 150) cancel.current() }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll)
      anchor?.focus?.()
    }
  }, [anchor])

  return createPortal(
    <div
      ref={ref}
      data-popover
      role="alertdialog"
      aria-label={title}
      style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
      className="fixed z-[60] w-64 rounded-xl border border-line bg-overlay p-3 shadow-lg"
    >
      <p className="text-[14px] leading-5 font-medium text-stone-900">{title}</p>
      <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600">{body}</p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          data-autofocus
          onClick={onCancel}
          className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-[13px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-stone-50 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex h-8 items-center rounded-lg bg-ink px-3 text-[13px] font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          {confirmLabel}
        </button>
      </div>
    </div>,
    document.body,
  )
}
