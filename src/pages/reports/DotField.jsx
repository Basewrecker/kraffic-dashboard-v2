import { useEffect, useRef } from 'react'
import { dotCounts, restLayout, rng, shapeFor } from '../../data/dotShapes'

// "The data becomes the report": one dot per tracked prompt (ink: AI names the brand, grey: it doesn't).
// DotField: behind the New report greeting and composer they drift; hovering a template gathers them into a faint
// version of that report's hero. DotAssemble: after you send, the same dots stream into the report and settle into its
// hero while it's written. Canvas only (no DOM per dot); it stops while the tab is hidden or the canvas is off screen,
// and with reduced motion the dots stand still and only fade.

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const step = (p, tx, ty, k, c, dt) => {
  p.vx += (k * (tx - p.x) - c * p.vx) * dt
  p.vy += (k * (ty - p.y) - c * p.vy) * dt
  p.x += p.vx * dt
  p.y += p.vy * dt
}
// the theme's ink and grey, as the canvas needs them (re-read twice a second, so a theme switch follows)
const colors = (el) => { const cs = getComputedStyle(el); return { ink: cs.color, grey: cs.outlineColor } }
const size = (canvas, ctx, w, h) => {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}
const dot = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill() }

// a frame loop that only runs while the tab is visible and the canvas is on screen
function runLoop(canvas, frame) {
  let raf = 0
  let last = 0
  let visible = !document.hidden
  let onScreen = true
  const tick = (t) => {
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60
    last = t
    raf = frame(t, dt) === false ? 0 : requestAnimationFrame(tick)
  }
  const update = () => {
    const go = visible && onScreen
    if (go && !raf) { last = 0; raf = requestAnimationFrame(tick) } else if (!go && raf) { cancelAnimationFrame(raf); raf = 0 }
  }
  const onVis = () => { visible = !document.hidden; update() }
  document.addEventListener('visibilitychange', onVis)
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; update() })
  io.observe(canvas)
  update()
  return () => { cancelAnimationFrame(raf); raf = 0; document.removeEventListener('visibilitychange', onVis); io.disconnect() }
}

// the hand-off from the home page to the report page: where every dot was on screen when you sent
let handoff = null
const takeHandoff = (brandId) => {
  const h = handoff
  handoff = null
  return h && h.brandId === brandId && performance.now() - h.at < 4000 ? h.pts : null
}
const canvasStyle = { color: 'var(--ink)', outlineColor: 'var(--color-stone-500)' }

// quietRef: an element (the greeting) the dots pass behind more faintly, so its text stays easy to read
export function DotField({ brandId, target, anchorRef, quietRef, apiRef, className = '' }) {
  const ref = useRef(null)
  const want = useRef(target)
  useEffect(() => { want.current = target }, [target])
  useEffect(() => {
    const canvas = ref.current
    const { total, named } = dotCounts(brandId)
    if (!canvas || !total) return undefined
    const ctx = canvas.getContext('2d')
    const reduced = reducedMotion()
    const r = rng(total)
    const dots = Array.from({ length: total }, (_, i) => ({ x: 0, y: 0, vx: 0, vy: 0, ph: r() * 6.2832, sp: 0.6 + r() * 0.8, lag: r() * 160, named: i < named }))
    let W = 0
    let H = 0
    let rest = []
    let box = null
    let quiet = null
    let shapes = {}
    let placed = false
    let col = colors(canvas)
    let colAt = 0
    let cur = null
    let since = 0
    let mix = 0
    const layout = () => {
      const rect = canvas.getBoundingClientRect()
      W = rect.width
      H = rect.height
      size(canvas, ctx, W, H)
      rest = restLayout(total, W, H, 7)
      const q = quietRef?.current?.getBoundingClientRect()
      quiet = q ? { x0: q.left - rect.left - 8, x1: q.right - rect.left + 8, y0: q.top - rect.top - 6, y1: q.bottom - rect.top + 6 } : null
      // the hero shape forms in the open space above the greeting, clear of any text; where there's no room for it
      // (short or narrow screens) it forms around the composer, showing either side and faintly through it
      const above = quiet ? quiet.y0 - 40 : 0
      if (above >= 130) {
        const bw = Math.min(W - 48, 960)
        box = { x: (W - bw) / 2, y: 24, w: bw, h: Math.min(above, 260) }
      } else {
        const a = anchorRef?.current?.getBoundingClientRect()
        const cy = a ? a.top - rect.top + a.height / 2 : H * 0.45
        const bw = Math.min(W - 48, 1160)
        const bh = Math.min(440, Math.max(220, H * 0.5))
        box = { x: (W - bw) / 2, y: Math.max(8, cy - bh / 2), w: bw, h: bh }
      }
      shapes = {}
      if (!placed) { dots.forEach((d, i) => { d.x = rest[i].x; d.y = rest[i].y }); placed = true }
    }
    const shape = (k) => {
      if (!k || !box) return null
      if (!(k in shapes)) { const s = shapeFor(k, brandId, box.w, box.h); shapes[k] = s && s.map((p) => ({ x: p.x + box.x, y: p.y + box.y })) }
      return shapes[k]
    }
    const ro = new ResizeObserver(layout)
    ro.observe(canvas)
    layout()
    if (apiRef) {
      apiRef.current = {
        snapshot: () => {
          const rect = canvas.getBoundingClientRect()
          handoff = { at: performance.now(), brandId, pts: dots.map((d) => ({ x: d.x + rect.left, y: d.y + rect.top })) }
        },
      }
    }
    const stop = runLoop(canvas, (t, dt) => {
      if (t - colAt > 500) { col = colors(canvas); colAt = t }
      if (want.current !== cur) { cur = want.current; since = t }
      const s = shape(cur)
      mix += ((s ? 1 : 0) - mix) * Math.min(1, dt * 4)
      const fade = reduced ? Math.min(1, (t - since) / 250) : 1 // reduced motion: the dots swap places under a short fade
      ctx.clearRect(0, 0, W, H)
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i]
        const on = s && (reduced || t - since >= d.lag)
        let tx
        let ty
        if (on) { tx = s[i].x; ty = s[i].y } else if (reduced) { tx = rest[i].x; ty = rest[i].y } else {
          tx = rest[i].x + Math.sin(t * 0.00023 * d.sp + d.ph) * 10
          ty = rest[i].y + Math.cos(t * 0.00019 * d.sp + d.ph * 1.3) * 8
        }
        if (reduced) { d.x = tx; d.y = ty } else if (on) { step(d, tx, ty, 58, 11, dt) } else { step(d, tx, ty, 9, 5.5, dt) }
        // fade out toward the edges, so the field has no hard border
        const edge = Math.max(0, Math.min(1, d.x / 80, (W - d.x) / 80, d.y / 60, (H - d.y) / 120))
        const lo = d.named ? 0.24 : 0.18
        const hi = d.named ? 0.62 : 0.4
        const hush = quiet && d.x > quiet.x0 && d.x < quiet.x1 && d.y > quiet.y0 && d.y < quiet.y1 ? 0.3 : 1
        ctx.globalAlpha = (lo + (hi - lo) * mix) * edge * fade * hush
        ctx.fillStyle = d.named ? col.ink : col.grey
        dot(ctx, d.x, d.y, 1.6 + 0.5 * mix)
      }
    })
    return () => { stop(); ro.disconnect(); if (apiRef) apiRef.current = null }
  }, [brandId, anchorRef, quietRef, apiRef])
  return <canvas ref={ref} aria-hidden className={className} style={canvasStyle} />
}

// the report page while it's written: the dots stream in (from where they were on the home page, else from above) and
// settle into the hero, a few at a time; once the report is there they fade out under it
export function DotAssemble({ brandId, kind, targetRef, done }) {
  const ref = useRef(null)
  const doneRef = useRef(done)
  useEffect(() => { doneRef.current = done }, [done])
  useEffect(() => {
    const canvas = ref.current
    const { total, named } = dotCounts(brandId)
    if (!canvas || !total) return undefined
    const ctx = canvas.getContext('2d')
    const reduced = reducedMotion()
    const from = takeHandoff(brandId)
    const r = rng(total + 3)
    const rank = Array.from({ length: total }, (_, i) => i)
    for (let i = rank.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rank[i], rank[j]] = [rank[j], rank[i]] }
    const dots = rank.map((k, i) => ({ x: from?.[i]?.x ?? NaN, y: from?.[i]?.y ?? NaN, vx: 0, vy: 0, release: 100 + (k / total) * 2100, named: i < named, sy: r() }))
    let W = 0
    let H = 0
    const resize = () => { W = window.innerWidth; H = window.innerHeight; size(canvas, ctx, W, H) }
    resize()
    window.addEventListener('resize', resize)
    let col = colors(canvas)
    let colAt = 0
    let shape = null
    let sw = 0
    let sh = 0
    let box = null
    let t0 = 0
    let doneAt = 0
    const stop = runLoop(canvas, (t, dt) => {
      if (!t0) t0 = t
      if (t - colAt > 500) { col = colors(canvas); colAt = t }
      const el = targetRef.current
      if (el) box = el.getBoundingClientRect()
      if (!box) return true
      if (box.width !== sw || box.height !== sh) { shape = shapeFor(kind, brandId, box.width, box.height); sw = box.width; sh = box.height }
      if (!shape) return true
      if (doneRef.current && !doneAt) doneAt = t
      const out = doneAt ? Math.max(0, 1 - (t - doneAt) / 500) : 1
      const elapsed = t - t0
      ctx.clearRect(0, 0, W, H)
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i]
        if (Number.isNaN(d.x)) { d.x = box.left + r() * box.width; d.y = Math.max(-20, box.top - 120 - d.sy * 240) }
        const tx = box.left + shape[i].x
        const ty = box.top + shape[i].y
        const go = elapsed >= d.release
        let a
        if (reduced) {
          d.x = tx
          d.y = ty
          a = go ? 1 : 0
        } else {
          if (go) step(d, tx, ty, 30, 8.5, dt)
          // brighter as it arrives
          a = go ? 0.35 + 0.65 * Math.max(0, 1 - Math.hypot(tx - d.x, ty - d.y) / 260) : 0.3
        }
        ctx.globalAlpha = a * (d.named ? 0.62 : 0.42) * out
        ctx.fillStyle = d.named ? col.ink : col.grey
        dot(ctx, d.x, d.y, 1.8)
      }
      return !(doneAt && out <= 0)
    })
    return () => { stop(); window.removeEventListener('resize', resize) }
  }, [brandId, kind, targetRef])
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[5] h-full w-full" style={canvasStyle} />
}

// the empty library: a few dots scattered on the left gather into a report page on the right (static)
export function DotIllustration({ className = '' }) {
  const r = rng(11)
  const loose = Array.from({ length: 34 }, (_, i) => ({ x: 8 + r() * 92, y: 12 + r() * 96, ink: i % 3 === 0, o: 0.25 + r() * 0.35 }))
  const page = []
  for (const [row, n] of [[0, 9], [1, 7], [3, 9], [4, 9], [5, 6]]) for (let c = 0; c < n; c++) page.push({ x: 158 + c * 9, y: 34 + row * 12, ink: row < 2 })
  ;[10, 18, 14, 24, 20].forEach((hgt, c) => { for (let k = 0; k < hgt / 6; k++) page.push({ x: 162 + c * 18, y: 120 - k * 6, ink: true }) })
  const drift = Array.from({ length: 12 }, (_, i) => ({ x: 104 + i * 3.6, y: 64 + Math.sin(i * 0.9) * 10 + (r() - 0.5) * 8, o: 0.15 + i * 0.04 }))
  return (
    <svg viewBox="0 0 260 140" className={className} aria-hidden>
      <rect x="146" y="18" width="104" height="114" rx="10" fill="var(--tint)" />
      {loose.map((p, i) => <circle key={`l${i}`} cx={p.x} cy={p.y} r="1.8" fill={p.ink ? 'var(--ink)' : 'var(--color-stone-500)'} opacity={p.o} />)}
      {drift.map((p, i) => <circle key={`d${i}`} cx={p.x} cy={p.y} r="1.8" fill="var(--color-stone-500)" opacity={p.o} />)}
      {page.map((p, i) => <circle key={`p${i}`} cx={p.x} cy={p.y} r="1.8" fill={p.ink ? 'var(--ink)' : 'var(--color-stone-500)'} opacity={p.ink ? 0.75 : 0.5} />)}
    </svg>
  )
}
