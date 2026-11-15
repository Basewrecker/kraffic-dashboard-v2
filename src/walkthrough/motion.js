// The walkthrough's one motion system (owner, 2026-11-15). Everything that moves in src/walkthrough uses it.
//   one easing            cubic-bezier(0.22, 1, 0.36, 1)
//   three lengths         fades 200ms · moves 320ms · large moves 450ms
//   transform and opacity only, with three exceptions that can't be: the hole in the dim layer (an SVG path, drawn each
//   frame), the ring's stroke, and a step's height as it opens or folds
//   interruptible         CSS transitions and tweens start from where the last one is
//   reduced motion        fades only, no movement
//   ?walkthrough=slow     every length 4x, for review
// CSS reads the same values as custom properties (index.css: --wt-ease, --wt-fade, --wt-move, --wt-large, each
// multiplied by --wt-k, which this file sets).
export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
export const FADE = 200
export const MOVE = 320
export const LARGE = 450

const hasWindow = typeof window !== 'undefined'
export const SLOW = hasWindow && new URLSearchParams(window.location.search).get('walkthrough') === 'slow'
export const K = SLOW ? 4 : 1
if (hasWindow) document.documentElement.style.setProperty('--wt-k', String(K))
// a length in this run's time (4x in slow motion)
export const ms = (n) => n * K
export const reduced = () => hasWindow && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// cubic-bezier(x1, y1, x2, y2) as a function of time 0..1, for the tweens drawn in JavaScript
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const sx = (t) => ((ax * t + bx) * t + cx) * t
  const sy = (t) => ((ay * t + by) * t + cy) * t
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x
      if (Math.abs(e) < 1e-5) break
      const d = dx(t)
      if (Math.abs(d) < 1e-6) break
      t -= e / d
    }
    return sy(t)
  }
}
export const ease = bezier(0.22, 1, 0.36, 1)

// A value that runs from where it is to a new place: tween(from, to, duration, onFrame) → stop(). `from` and `to` are
// objects of numbers with the same keys. Starting a new one from the last frame's value is what makes a move
// interruptible. Reduced motion (or a zero length): the end, at once.
export function tween(from, to, duration, onFrame, onEnd = () => {}) {
  if (!from || duration <= 0 || reduced()) { onFrame(to); onEnd(); return () => {} }
  const t0 = performance.now()
  let raf
  const frame = (t) => {
    const k = Math.min(1, (t - t0) / duration), e = ease(k)
    const at = {}
    for (const key of Object.keys(to)) at[key] = from[key] + (to[key] - from[key]) * e
    onFrame(at)
    if (k < 1) raf = requestAnimationFrame(frame)
    else onEnd()
  }
  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}
