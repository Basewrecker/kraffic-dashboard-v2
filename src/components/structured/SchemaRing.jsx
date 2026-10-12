import { useEffect, useRef, useState } from 'react'
import { arc as d3arc } from 'd3-shape'
import { StatusIcon } from './parts'

// Schema status ring: one slice per schema, clockwise from 12 o'clock (plain SVG + d3-shape).
// Hover is tracked on the wrapper by angle, so moving across the gaps never resets it; focus works the same.
//   hovered slice: pops out 8px + 6% (slight overshoot), drop shadow, a thin marker arc drawn outside it
//   same group 85% · other groups 25% · a faint halo around the hovered group
//   legendGroup (hovering a legend row): that group lifts 4px, staggered; the rest dim
//   pinned (clicked) slice keeps the pop + marker while nothing is hovered
export const RING_COLORS = { invalid: 'var(--negative)', missing: 'var(--data-c2)', valid: 'var(--ink)' }
// the ring itself is 224px across (outer 112); the SVG is 280 so the pop-out, marker and halo never clip:
// halo 128 + 6px push + 2px stroke = 136 < 140
const VIEW = 280
const INNER = 84, OUTER = 112, REQUIRED = 116
const PAD = 0.012
const MARK_GAP = 10, HALO_R = OUTER + 16
const PUSH = 6, POP_SCALE = 1.04
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const sliceArc = d3arc().innerRadius(INNER).padAngle(PAD).cornerRadius(4)
// a plain circular arc (for the marker and the halo), angles in radians clockwise from 12 o'clock
function arcPath(r, a0, a1) {
  const p = (a) => [Math.sin(a) * r, -Math.cos(a) * r]
  const [x0, y0] = p(a0), [x1, y1] = p(a1)
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`
}
const ringLine = (x, pages) => (x.status === 'invalid' ? `Invalid · ${pages(x)} ${pages(x) === 1 ? 'page' : 'pages'}` : x.status === 'missing' ? `Missing on ${pages(x)} ${pages(x) === 1 ? 'page' : 'pages'}` : `Valid on ${pages(x)} ${pages(x) === 1 ? 'page' : 'pages'}`)

// long names wrap at their camelCase seams, not mid-word: "SiteNavigation / Element"
const softBreaks = (name) => name.replace(/([a-z])([A-Z])/g, '$1\u200b$2')

// "9/24" counts up from 0 once, on mount
function useCountFromZero(target, ms = 600) {
  const [v, setV] = useState(() => (reduced() ? target : 0))
  useEffect(() => {
    if (reduced()) { setV(target); return }
    const t0 = performance.now()
    let raf
    const tick = (t) => { const k = Math.min(1, (t - t0) / ms); setV(Math.round(target * (1 - (1 - k) ** 3))); if (k < 1) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

export default function SchemaRing({ ring, hover, setHover, pinnedId, legendGroup, onSelect, pagesOf, size = VIEW }) {
  const wrap = useRef(null)
  const [still] = useState(reduced)
  const valid = ring.filter((x) => x.status === 'valid').length
  const shown = useCountFromZero(valid)
  const step = (2 * Math.PI) / ring.length
  const hovered = hover != null ? ring[hover] : null
  const pinnedIndex = ring.findIndex((x) => x.id === pinnedId)
  const popIndex = hover ?? (legendGroup ? -1 : pinnedIndex) // the slice shown "popped"
  const focusGroup = hovered?.status ?? legendGroup ?? null // the group the rest of the ring is dimmed around
  // where each group starts / ends on the ring (they're contiguous)
  const span = (st) => {
    const idx = ring.map((x, i) => (x.status === st ? i : -1)).filter((i) => i >= 0)
    return idx.length ? [idx[0] * step, (idx.at(-1) + 1) * step] : null
  }

  const onMove = (e) => {
    // pointer → viewBox units (the SVG may be drawn smaller on phones)
    const box = wrap.current.getBoundingClientRect()
    const k = VIEW / box.width
    const x = (e.clientX - box.left) * k - VIEW / 2, y = (e.clientY - box.top) * k - VIEW / 2
    const d = Math.hypot(x, y)
    if (d < INNER - 12 || d > HALO_R + 4) { setHover(null); return }
    const deg = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360
    setHover(Math.min(ring.length - 1, Math.floor(deg / (360 / ring.length))))
  }

  return (
    <div ref={wrap} className="relative overflow-visible" style={{ width: size, height: size }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}
      onClick={() => hovered && onSelect(hovered)}>
      <svg width={size} height={size} viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`} overflow="visible" role="group" aria-label="Schemas by status" className="overflow-visible">
        {/* group halo: faint, around the whole hovered (or legend-hovered) group */}
        {['invalid', 'missing', 'valid'].map((st) => {
          const s = span(st)
          if (!s) return null
          return <path key={st} d={arcPath(HALO_R, s[0] + 0.01, s[1] - 0.01)} fill="none" stroke={RING_COLORS[st]} strokeOpacity={0.12} strokeWidth={3} strokeLinecap="round"
            style={{ opacity: focusGroup === st ? 1 : 0, transition: 'opacity 220ms ease-out' }} />
        })}

        {ring.map((x, i) => {
          const a0 = i * step, a1 = (i + 1) * step, mid = (a0 + a1) / 2
          const pop = i === popIndex
          // legend hover lifts the whole group, one slice after another
          const lift = !pop && legendGroup && x.status === legendGroup ? 4 : 0
          const out = pop ? PUSH : lift
          const scale = pop && !still ? POP_SCALE : 1
          const opacity = focusGroup == null ? 1 : pop ? 1 : x.status === focusGroup ? 0.85 : 0.25
          const groupIndex = ring.slice(0, i).filter((y) => y.status === x.status).length
          const pages = pagesOf(x)
          return (
            <g key={x.id} tabIndex={0} role="button" aria-label={`${x.name}, ${x.status} ${x.status === 'valid' ? 'on' : 'on'} ${pages} ${pages === 1 ? 'page' : 'pages'}`}
              aria-pressed={x.id === pinnedId}
              onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(x) } }}
              className="cursor-pointer outline-none"
              style={{
                transform: `translate(${Math.sin(mid) * out}px, ${-Math.cos(mid) * out}px) scale(${scale})`,
                transformOrigin: '0 0',
                transition: still ? 'opacity 220ms ease-out' : `transform 260ms cubic-bezier(.2,.9,.3,1.2) ${lift ? groupIndex * 15 : 0}ms, opacity 220ms ease-out, filter 200ms ease-out`,
                opacity,
                filter: pop && hover != null ? 'drop-shadow(0 4px 10px rgb(0 0 0 / .18))' : 'drop-shadow(0 0 0 rgb(0 0 0 / 0))',
              }}>
              {/* entrance: clockwise, once */}
              <g className="ring-motion" style={still ? undefined : { animation: `slice-in 300ms ease-out ${i * 18}ms both`, transformOrigin: '0 0' }}>
                <path d={sliceArc.outerRadius(x.importance === 'required' ? REQUIRED : OUTER)({ startAngle: a0, endAngle: a1 })} fill={RING_COLORS[x.status]} />
              </g>
              {/* marker: a thin arc just outside the popped slice, drawn on; inside this <g>, so it moves out with it */}
              {pop && (() => {
                const r = (x.importance === 'required' ? REQUIRED : OUTER) + MARK_GAP
                const m0 = a0 + PAD / 2, m1 = a1 - PAD / 2
                const len = r * (m1 - m0)
                return (
                  <path key={`${x.id}-${hover != null}`} d={arcPath(r, m0, m1)} fill="none" stroke={RING_COLORS[x.status]} strokeWidth={2} strokeLinecap="round"
                    className="ring-motion pointer-events-none" strokeDasharray={len * 1.1}
                    style={still ? undefined : { '--len': len * 1.1, animation: 'ring-draw 240ms ease-out both' }} />
                )
              })()}
            </g>
          )
        })}

      </svg>

      {/* centre: two layers in one cell; the hover layer re-enters for every slice */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="grid h-[92px] w-[150px] text-center" aria-live="polite">
          <div className={`[grid-area:1/1] flex flex-col items-center justify-center transition-[opacity,transform] duration-[180ms] ease-out ${hovered ? '-translate-y-1 opacity-0' : 'translate-y-0 opacity-100'}`} aria-hidden={Boolean(hovered)}>
            <span className="text-[32px] leading-9 font-semibold text-stone-900 tabular-nums">{shown}/{ring.length}</span>
            <span className="text-[13px] leading-[18px] text-stone-600">schemas valid</span>
          </div>
          {hovered && (
            <div key={hovered.id} className="ring-motion [grid-area:1/1] flex flex-col items-center justify-center motion-safe:animate-[center-in_180ms_ease-out_both]">
              <span className="ring-motion motion-safe:animate-[icon-pop_200ms_ease-out_both]" style={{ color: RING_COLORS[hovered.status] }}>
                <StatusIcon status={hovered.status} />
              </span>
              <span className={`mt-1 line-clamp-2 leading-tight font-semibold text-stone-900 ${hovered.name.length > 18 ? 'text-[13px]' : 'text-[15px]'}`}>{softBreaks(hovered.name)}</span>
              <span className="mt-0.5 text-[12px] leading-4 text-stone-600 tabular-nums">{ringLine(hovered, pagesOf)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
