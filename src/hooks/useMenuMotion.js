import { useEffect, useState } from 'react'
import { motionMs, reducedMotion } from '../lib/motionTokens'

// One motion for every menu (as the app, #232 / #234): opens in 150ms from 0.96 scale, growing from the trigger's
// corner; closes in 120ms; inert while closing. Reduced motion: the fade only.
//   const m = useMenuMotion(open, { align: 'right', side: 'bottom' })
//   {m.mounted && <div {...m.props} style={{ ...m.style }}>…</div>}
export function useMenuMotion(open, { align = 'right', side = 'bottom' } = {}) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(raf)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), motionMs('--motion-menu-out'))
    return () => clearTimeout(t)
  }, [open])
  const reduced = reducedMotion()
  const style = {
    transformOrigin: `${side === 'top' ? 'bottom' : 'top'} ${align === 'left' ? 'left' : align === 'center' ? 'center' : 'right'}`,
    opacity: shown ? 1 : 0,
    transform: shown || reduced ? 'none' : 'scale(var(--motion-menu-scale))',
    transition: shown
      ? 'opacity var(--motion-menu-in) var(--motion-ease-out), transform var(--motion-menu-in) var(--motion-ease-out)'
      : 'opacity var(--motion-menu-out) var(--motion-ease-in), transform var(--motion-menu-out) var(--motion-ease-in)',
  }
  const closing = mounted && !open
  return { mounted, shown, closing, style, props: closing ? { inert: '' } : {} }
}
