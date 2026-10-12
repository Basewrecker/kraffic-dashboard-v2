import { useEffect, useState } from 'react'

// A real pie (no hole): slices from 12 o'clock, clockwise, cut apart by a 2px card-coloured stroke.
// slices: [{ key, value, fill, name, pct? }] — fill is a CSS colour (var(--ink), var(--data-c1)…); pct overrides the
// label (pass the card's rounded shares so the pie and its legend never disagree).
// hover (key | null) pushes that slice out 6px along its mid-angle and dims the rest; onHover / onSelect report
// the slice under the pointer. dim(key) → opacity override (explain mode). % labels sit inside slices ≥ 8%.
// Sweeps in once, 600ms ease-out, on first mount.
const LABEL_ON = {
  'var(--ink)': 'var(--on-ink)', 'var(--data-c1)': 'var(--pie-on-c1)', 'var(--data-c2)': 'var(--pie-on-c2)',
  'var(--data-c3)': 'var(--pie-on-c3)', 'var(--data-track)': 'var(--ink)',
}
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const SWEEP_MS = 600

export default function Pie({ slices, radius = 96, hover = null, onHover, onSelect, dim, label, labels = true, separator = 2 }) {
  const pad = 8 // room for the 6px push-out
  const size = (radius + pad) * 2
  const c = radius + pad
  const [t, setT] = useState(() => (reduced() ? 1 : 0)) // sweep progress, first mount only
  useEffect(() => {
    if (t === 1) return
    const start = performance.now()
    let raf
    const tick = (now) => {
      const k = Math.min(1, (now - start) / SWEEP_MS)
      setT(1 - (1 - k) ** 3)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const total = slices.reduce((n, s) => n + s.value, 0) || 1
  const pt = (a, r = radius) => [c + r * Math.cos(a), c + r * Math.sin(a)]
  let acc = 0
  const arcs = slices.filter((s) => s.value > 0).map((s) => {
    const a0 = -Math.PI / 2 + (acc / total) * 2 * Math.PI * t
    acc += s.value
    const a1 = -Math.PI / 2 + (acc / total) * 2 * Math.PI * t
    return { ...s, a0, a1, pct: s.pct ?? Math.round((s.value / total) * 100) }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0 overflow-visible" onMouseLeave={() => onHover?.(null)}>
      {arcs.map((s) => {
        const mid = (s.a0 + s.a1) / 2
        const out = hover === s.key ? 6 : 0
        const full = s.a1 - s.a0 >= 2 * Math.PI - 1e-6
        const [x0, y0] = pt(s.a0), [x1, y1] = pt(s.a1)
        const d = full
          ? `M ${c - radius} ${c} a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0`
          : `M ${c} ${c} L ${x0} ${y0} A ${radius} ${radius} 0 ${s.a1 - s.a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1} Z`
        const opacity = dim?.(s.key) ?? (hover && hover !== s.key ? 0.5 : 1)
        const [lx, ly] = pt(mid, radius * 0.62)
        return (
          <g key={s.key} style={{ transform: `translate(${Math.cos(mid) * out}px, ${Math.sin(mid) * out}px)`, transition: 'transform 200ms ease-out' }}
            onMouseEnter={() => onHover?.(s.key)} onClick={() => onSelect?.(s.key)} className={onSelect ? 'cursor-pointer' : undefined}>
            <path d={d} fill={s.fill} fillOpacity={opacity} stroke="var(--color-surface)" strokeWidth={separator} strokeLinejoin="round"
              data-insight-key={s.insightKey} style={{ transition: 'fill-opacity 200ms ease-out' }}>
              <title>{`${s.name}: ${s.pct}%`}</title>
            </path>
            {labels && s.pct >= 8 && t === 1 && (
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fill={LABEL_ON[s.fill] ?? 'var(--ink)'} fillOpacity={opacity}
                className="pointer-events-none text-[12px] font-semibold tabular-nums motion-safe:animate-[fade-in_200ms_ease-out]" style={{ transition: 'fill-opacity 200ms ease-out' }}>
                {s.pct}%
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
