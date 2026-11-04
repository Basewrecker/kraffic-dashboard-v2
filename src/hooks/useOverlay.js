import { useCallback, useEffect, useRef } from 'react'

// Back closes an open overlay first (nav drawer, sheets, menus): opening pushes a history entry; the browser's Back
// (or a swipe-back) pops it and calls onClose. Closing from the UI goes Back too, so history stays balanced.
//   const [close, release] = useBackClose(open, onClose)  → close() from the X / scrim / Esc;
//   release() first when the overlay closes because of a navigation (keeps the new page's history entry)
export function useBackClose(open, onClose) {
  const pushed = useRef(false)
  const cb = useRef(onClose)
  cb.current = onClose
  useEffect(() => {
    if (!open) return
    window.history.pushState({ ...(window.history.state ?? {}), overlay: true }, '')
    pushed.current = true
    const pop = () => { if (pushed.current) { pushed.current = false; cb.current() } }
    window.addEventListener('popstate', pop)
    return () => {
      window.removeEventListener('popstate', pop)
      // closed from the UI (or unmounted): drop our history entry. Anything the overlay changed in the URL meanwhile
      // (a filter, a tab) lives on that entry, so carry the current URL over to the entry we land on.
      if (pushed.current) {
        pushed.current = false
        const url = window.location.href
        const landed = () => {
          window.removeEventListener('popstate', landed)
          if (window.location.href !== url) {
            window.history.replaceState(window.history.state, '', url)
            window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
          }
        }
        window.addEventListener('popstate', landed)
        window.history.back()
      }
    }
  }, [open])
  const close = useCallback(() => cb.current(), [])
  const release = useCallback(() => { pushed.current = false }, [])
  return [close, release]
}

// Drag a bottom sheet down to close it: attach the returned handlers to the grab handle / header.
// Follows the finger; past 120px or a fast flick (>0.6 px/ms) it closes, otherwise it springs back.
export function useSheetDrag(panelRef, onClose) {
  const start = useRef(null)
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    start.current = { y: e.clientY, t: performance.now(), dy: 0 }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (panelRef.current) panelRef.current.style.transition = 'none'
  }
  const onPointerMove = (e) => {
    if (!start.current || !panelRef.current) return
    const dy = Math.max(0, e.clientY - start.current.y)
    start.current.dy = dy
    panelRef.current.style.transform = `translateY(${dy}px)`
  }
  const onPointerUp = () => {
    const s = start.current
    start.current = null
    const el = panelRef.current
    if (!s || !el) return
    const v = s.dy / Math.max(1, performance.now() - s.t)
    el.style.transition = 'transform 220ms cubic-bezier(.2,.8,.2,1)'
    el.style.transform = ''
    if (s.dy > 120 || v > 0.6) onClose()
  }
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, style: { touchAction: 'none' } }
}

// A dialog's focus handling, shared by ui/Modal and the Content workspace's focus panel: while `active`, focus moves in
// (to [data-autofocus] or the panel) and is trapped (Tab / Shift+Tab wrap), Esc calls onCloseRef.current(), the page
// behind stops scrolling (keeping its width), and focus returns to where it was when it ends.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
export function useDialogFocus(panelRef, active, onCloseRef, { returnTo = null } = {}) {
  useEffect(() => {
    if (!active) return undefined
    const before = document.activeElement
    const el = panelRef.current
    if (!el) return undefined
    const items = () => [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null)
    ;(el.querySelector('[data-autofocus]') ?? el).focus()

    const onKey = (e) => {
      if (e.key === 'Escape') { onCloseRef.current(); return }
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
      ;(returnTo?.current ?? before)?.focus?.()
    }
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps
}
