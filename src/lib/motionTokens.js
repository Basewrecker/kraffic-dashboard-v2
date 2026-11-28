// The shared motion tokens (index.css, :root), read from script so CSS and JS move the same way (as the app, #232).
//   motionValue('--motion-ease-out') → 'cubic-bezier(0.22, 1, 0.36, 1)' · motionMs('--motion-dialog-in') → 240
//   reducedMotion() → fades only (no slide, rise, scale or stagger)
const FALLBACK = {
  '--motion-ease-out': 'cubic-bezier(0.22, 1, 0.36, 1)', '--motion-ease-in': 'ease-in',
  '--motion-backdrop-in': '200ms', '--motion-dialog-in': '240ms', '--motion-dialog-out': '160ms',
  '--motion-dialog-rise': '8px', '--motion-dialog-sink': '4px', '--motion-dialog-scale': '0.98',
  '--motion-menu-in': '150ms', '--motion-menu-out': '120ms', '--motion-menu-scale': '0.96',
  '--motion-step': '200ms', '--motion-step-slide': '12px', '--motion-morph': '250ms', '--motion-stagger': '30ms',
}
export const motionValue = (name) => {
  if (typeof window === 'undefined') return FALLBACK[name] ?? ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || FALLBACK[name] || ''
}
export const motionMs = (name) => parseFloat(motionValue(name)) || 0
export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
