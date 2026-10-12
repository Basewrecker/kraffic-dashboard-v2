// Light / dark theme. The user's choice ('light' | 'dark' | 'system') is persisted under localStorage 'theme';
// 'system' follows the OS live. The resolved theme goes on <html data-theme> + color-scheme.
// index.html runs the same resolution inline before first paint, so there's no flash on load.
import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

const KEY = 'theme'
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const listeners = new Set()
const notify = () => listeners.forEach((l) => l())

const read = () => {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
    const old = localStorage.getItem('kraffic-theme') // pre-rename key
    return old === 'light' || old === 'dark' ? old : 'system'
  } catch { return 'system' }
}
let choice = read()

const resolve = (c) => (c === 'system' ? (media?.matches ? 'dark' : 'light') : c)
export function applyTheme() {
  const t = resolve(choice)
  document.documentElement.dataset.theme = t
  document.documentElement.style.colorScheme = t
}

// Fallback (no View Transitions): colours fade for 200ms, then the global transition rule is removed again.
let fadeTimer
function withColorFade(apply) {
  const el = document.documentElement
  el.classList.add('theme-transition')
  apply()
  clearTimeout(fadeTimer)
  fadeTimer = setTimeout(() => el.classList.remove('theme-transition'), 250)
}

// from: { x, y } viewport point the reveal grows out of (the clicked toggle button)
export async function setTheme(next, from) {
  const before = resolve(choice)
  choice = next
  try { localStorage.setItem(KEY, next); localStorage.removeItem('kraffic-theme') } catch {}
  const apply = () => { applyTheme(); notify() }

  // nothing visible changes (e.g. dark → system while the OS is dark): just update the toggle
  if (resolve(next) === before || reducedMotion()) return apply()
  if (!document.startViewTransition) return withColorFade(apply)

  const t = document.startViewTransition(() => flushSync(apply))
  if (!from) return
  const { x, y } = from
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  try {
    await t.ready
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 450, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
    )
  } catch { /* transition skipped (e.g. tab hidden): the theme is already applied */ }
}

// keep following the OS while the choice is 'system'
media?.addEventListener('change', () => {
  if (choice !== 'system') return
  reducedMotion() ? (applyTheme(), notify()) : withColorFade(() => { applyTheme(); notify() })
})

export function useTheme() {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => choice)
}
