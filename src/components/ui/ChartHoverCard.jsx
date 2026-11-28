import { useLayoutEffect, useRef, useState } from 'react'
import { reducedMotion } from '../../lib/motionTokens'

// The one hover card for line charts (as the app, #216 / #223): Trends now; Visibility history, Share of voice history
// and Sentiment history are meant to move onto it. The same dark card in light and dark (--hc-* tokens, index.css):
// a period title, then one row per series, highest first: a colour dash, an optional logo, the name (muted; the
// hovered series white), the value, and the change since the compared point as ↑n / ↓n. No value reads "—".
// It follows the pointer inside its chart (flipping to the pointer's left near the right edge) and fades in 120ms.
//   <div className="relative"> <svg>… <HoverMarks …/></svg> <ChartHoverCard show x y bounds title rows activeId /> </div>
//   rows: [{ id, name, color, value, valueText?, change?, logo? }] · x, y: the pointer, in the wrapper's pixels
export default function ChartHoverCard({ show, x = 0, y = 0, bounds, title, rows = [], activeId }) {
  const box = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  // keep the last content on screen while the card fades out
  const last = useRef({ title, rows, activeId })
  if (show) last.current = { title, rows, activeId }
  const data = last.current
  // glide between points only while it is already showing: the first appearance starts at the pointer
  const wasShown = useRef(false)
  const glide = show && wasShown.current && !reducedMotion()
  useLayoutEffect(() => { wasShown.current = show }, [show])
  useLayoutEffect(() => {
    if (!box.current) return
    const w = box.current.offsetWidth, h = box.current.offsetHeight
    if (w !== size.w || h !== size.h) setSize({ w, h })
  })
  const GAP = 14
  const W = bounds?.width ?? 0, H = bounds?.height ?? 0
  const left = Math.max(0, x + GAP + size.w > W ? x - GAP - size.w : x + GAP)
  const top = Math.max(0, Math.min(y - size.h / 2, H - size.h))
  const sorted = [...data.rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity))
  return (
    <div ref={box} aria-hidden
      className="chart-hover-card pointer-events-none absolute left-0 top-0 z-20 w-max max-w-[320px] rounded-xl border border-[var(--hc-line)] bg-[var(--hc-surface)] px-3.5 py-3 text-[var(--hc-ink)] shadow-[var(--hc-shadow)]"
      style={{
        opacity: show ? 1 : 0,
        transform: `translate(${Math.round(left)}px, ${Math.round(top)}px)`,
        transition: `opacity var(--motion-menu-out) var(--motion-ease-out)${glide ? ', transform var(--motion-menu-out) var(--motion-ease-out)' : ''}`,
      }}>
      <div className="text-[12px] leading-4 font-medium tabular-nums">{data.title}</div>
      <ul className="mt-2 flex flex-col gap-1.5">
        {sorted.map((r) => {
          const on = r.id === data.activeId
          return (
            <li key={r.id} className="flex items-center gap-2 text-[13px] leading-[18px]">
              <span className="h-[3px] w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
              {r.logo}
              <span className={`min-w-0 flex-1 truncate ${on ? 'font-semibold text-[var(--hc-ink)]' : 'text-[var(--hc-muted)]'}`}>{r.name}</span>
              <span className="ml-4 shrink-0 font-semibold tabular-nums">{r.value == null ? '—' : r.valueText ?? r.value}</span>
              {r.change != null && r.change !== 0 && (
                <span className={`w-9 shrink-0 text-right text-[12px] font-medium tabular-nums ${r.change > 0 ? 'text-[var(--hc-up)]' : 'text-[var(--hc-down)]'}`}>{r.change > 0 ? '↑' : '↓'}{Math.abs(r.change)}</span>
              )}
              {r.change === 0 && <span className="w-9 shrink-0 text-right text-[12px] text-[var(--hc-muted)]">—</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// What the chart itself shows under the pointer: a light hairline at the hovered point and a hollow ring on each line.
// Drawn inside the chart's <svg>. dots: [{ id, y, color }]; ring: the page colour inside the ring; r: its radius
export function HoverMarks({ x, top, bottom, dots, r = 4, ring = 'var(--color-page)' }) {
  return (
    <g pointerEvents="none">
      <line x1={x} x2={x} y1={top} y2={bottom} stroke="var(--color-line-strong)" strokeWidth="1" />
      {dots.map((d) => <circle key={d.id} cx={x} cy={d.y} r={r} fill={ring} stroke={d.color} strokeWidth={r / 2} />)}
    </g>
  )
}
