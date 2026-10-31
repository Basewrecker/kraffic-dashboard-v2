// The main chart (Reports): the prototype's blue area chart, with a comparison series (dashed grey: the rival, or the
// previous period for a number that's only about you), a dot on every sync, a y axis fitted to the data with ~15%
// headroom (from 0 when the data is near it), the latest value of each series at the right edge, and a hover that
// glides between syncs: a soft column highlight, the rest dimmed, a hairline, a dot that grows with one ring, and a
// tooltip that slides with it (each series, and the change vs the sync before). Arrow keys move it. The line draws in
// on first view and on a tab switch; nothing moves under reduced motion.
import { useLayoutEffect, useMemo, useRef, useState } from 'react'

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const H = 300, PT = 14, PB = 26, PL = 44, PR = 104

// round ticks fitted to the data: ~15% headroom, from 0 when the data is near it
export function fitAxis(values) {
  const lo0 = Math.min(...values), hi0 = Math.max(...values)
  const nearZero = lo0 <= (hi0 - lo0) * 1.2 || lo0 <= 0
  const pad = Math.max((hi0 - lo0) * 0.15, hi0 * 0.03, 1)
  const lo = nearZero ? 0 : lo0 - pad, hi = hi0 + pad
  const raw = (hi - lo) / 4
  const p = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p
  const bottom = nearZero ? 0 : Math.floor(lo / step) * step
  const top = Math.ceil(hi / step) * step
  const ticks = []
  for (let v = bottom; v <= top + step / 1000; v += step) ticks.push(Math.round(v * 100) / 100)
  return { bottom, top, ticks }
}

// x labels on the 1st and 15th; with weekly syncs, on the first sync on or after each
function labelled(isos) {
  const seen = new Set()
  return isos.map((iso) => {
    const d = new Date(`${iso}T00:00:00`)
    const k = `${d.getMonth()}-${d.getDate() >= 15 ? 15 : 1}`
    if (seen.has(k)) return false
    seen.add(k); return true
  })
}

const fmt = (v, unit) => `${v.toLocaleString()}${unit === '%' ? '%' : ''}`
const signed = (n, unit) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}${unit === '%' ? ' pts' : ''}`

export default function Chart5({ kpi, dates, isos, anim }) {
  const wrap = useRef(null)
  const lineRef = useRef(null)
  const [W, setW] = useState(900)
  const [idx, setIdx] = useState(null)
  const [ring, setRing] = useState(0)
  const s = kpi.series, c = kpi.compare
  const N = s.length
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    setW(el.clientWidth || 900) // the real width before the first paint, so the draw-in measures the real line
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const iw = W - PL - PR, ih = H - PT - PB
  const all = [...s, ...(c?.values ?? []).filter((v) => v != null)]
  const { bottom, top, ticks } = useMemo(() => fitAxis(all), [kpi]) // eslint-disable-line react-hooks/exhaustive-deps
  const x = (i) => PL + (N === 1 ? iw / 2 : (i * iw) / (N - 1))
  const y = (v) => PT + ih - ((v - bottom) / (top - bottom)) * ih
  const step = N > 1 ? iw / (N - 1) : iw
  const pts = s.map((v, i) => [x(i), y(v)])
  const d = `M${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join('L')}`
  const cmp = c ? c.values.map((v, i) => (v == null ? null : [x(i), y(v)])) : null
  let cmpD = null
  if (cmp) { cmpD = ''; let pen = false; cmp.forEach((p) => { if (!p) { pen = false; return } cmpD += `${pen ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`; pen = true }) }
  const show = labelled(isos)
  const motion = !reduce()

  // the line draws in (first view and tab switch)
  useLayoutEffect(() => {
    const ln = lineRef.current
    if (!ln || !anim || !motion) return
    const L = ln.getTotalLength()
    ln.style.strokeDasharray = L; ln.style.setProperty('--len', L)
    ln.classList.remove('draw'); void ln.getBoundingClientRect(); ln.classList.add('draw')
    // once drawn, the dash is cleared so a resize never cuts the line short
    const done = () => { ln.style.strokeDasharray = ''; ln.classList.remove('draw') }
    ln.addEventListener('animationend', done, { once: true })
    return () => ln.removeEventListener('animationend', done)
  }, [kpi]) // eslint-disable-line react-hooks/exhaustive-deps

  const move = (i) => { setIdx((cur) => { if (cur !== i) setRing((r) => r + 1); return i }) }
  const onMove = (e) => {
    const r = wrap.current.getBoundingClientRect()
    move(Math.max(0, Math.min(N - 1, Math.round((e.clientX - r.left - PL) / Math.max(1, step)))))
  }
  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); move(Math.max(0, Math.min(N - 1, (idx ?? N - 1) + (e.key === 'ArrowRight' ? 1 : -1)))) }
    else if (e.key === 'Escape') setIdx(null)
  }
  const on = idx != null
  const hx = on ? x(idx) : 0, hy = on ? y(s[idx]) : 0
  const glide = motion ? 'transform 180ms ease-out' : 'none'
  const tipLeft = on ? (hx + 200 > W ? hx - 196 : hx + 16) : 0
  const prev = on && idx > 0 ? s[idx] - s[idx - 1] : null
  const prevTone = prev == null || prev === 0 ? '' : (prev > 0) !== !!kpi.lowerIsBetter ? 'good' : 'bad'

  // end labels: the latest value of each series at the right edge (moved apart when they'd overlap)
  const ends = [{ v: s[N - 1], label: kpi.short, main: true }, ...(c && c.values[N - 1] != null ? [{ v: c.values[N - 1], label: c.short }] : [])].map((e) => ({ ...e, y: y(e.v) }))
  if (ends.length === 2 && Math.abs(ends[0].y - ends[1].y) < 14) { const [a, b] = ends[0].y <= ends[1].y ? [ends[0], ends[1]] : [ends[1], ends[0]]; const mid = (a.y + b.y) / 2; a.y = mid - 7; b.y = mid + 7 }

  return (
    <div ref={wrap} className="chart5" onMouseMove={onMove} onMouseLeave={() => setIdx(null)}>
      <svg role="img" aria-label={`${kpi.label}, by sync. Use the arrow keys to read each sync.`} tabIndex={0} onKeyDown={onKey} onFocus={() => idx == null && move(N - 1)} onBlur={() => setIdx(null)}
        width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs><linearGradient id="r5gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--plot)" stopOpacity="var(--plot-a)" /><stop offset="1" stopColor="var(--plot)" stopOpacity="0" /></linearGradient></defs>
        {ticks.map((v) => (
          <g key={v}><line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="var(--grid)" /><text x={PL - 10} y={y(v) + 4} textAnchor="end">{fmt(v, kpi.unit)}</text></g>
        ))}
        {dates.map((dt, i) => show[i] && <text key={dt} x={x(i)} y={H - 6} textAnchor="middle">{dt}</text>)}
        {/* the hovered sync: a soft column; the rest dims slightly */}
        <g style={{ opacity: on ? 1 : 0, transition: motion ? 'opacity 150ms ease-out' : 'none' }} pointerEvents="none">
          <rect x={-step / 2} y={PT} width={step} height={ih} fill="var(--plot)" fillOpacity=".06" style={{ transform: `translateX(${hx}px)`, transition: glide }} />
        </g>
        <path className={`area ${anim && motion ? 'fade' : ''}`} fill="url(#r5gf)" d={`${d}L${x(N - 1)},${PT + ih}L${x(0)},${PT + ih}Z`} />
        {cmpD && <path className={`cmp ${anim && motion ? 'fade' : ''}`} d={cmpD} />}
        <path ref={lineRef} className="line" d={d} />
        {cmp && cmp.map((p, i) => p && <circle key={`c${i}`} cx={p[0]} cy={p[1]} r="2.5" className="cdot" />)}
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" className="sdot" />)}
        <g pointerEvents="none" style={{ opacity: on ? 1 : 0, transition: motion ? 'opacity 150ms ease-out' : 'none' }}>
          <rect x={PL} y={PT} width={Math.max(0, hx - step / 2 - PL)} height={ih} fill="var(--card)" fillOpacity=".35" />
          <rect x={hx + step / 2} y={PT} width={Math.max(0, W - PR - hx - step / 2)} height={ih} fill="var(--card)" fillOpacity=".35" />
          <line x1="0" x2="0" y1={PT} y2={PT + ih} stroke="var(--ink3)" strokeDasharray="3 3" style={{ transform: `translateX(${hx}px)`, transition: glide }} />
          <g style={{ transform: `translate(${hx}px, ${hy}px)`, transition: glide }}>
            {on && motion && <circle key={ring} r="5" className="ring" />}
            <circle r={on ? 5 : 0} fill="var(--plot)" stroke="var(--card)" strokeWidth="2" style={{ transition: motion ? 'r 150ms ease-out' : 'none' }} />
          </g>
        </g>
        {ends.map((e) => (
          <text key={e.label} x={W - PR + 10} y={e.y + 4} className={e.main ? 'end main' : 'end'}><tspan className="num">{fmt(e.v, kpi.unit)}</tspan> {e.label}</text>
        ))}
      </svg>
      <div className="tip" role="status" style={{ opacity: on ? 1 : 0, transform: `translate(${tipLeft}px, ${hy + 10}px) translateY(-100%)`, transition: motion ? 'transform 150ms ease-out, opacity 100ms' : 'none' }}>
        {on && (
          <>
            <span>{dates[idx]}</span>
            <div className="trow"><i className="sw" /><em>{kpi.short}</em><b className="num">{fmt(s[idx], kpi.unit)}</b></div>
            {c && c.values[idx] != null && <div className="trow"><i className="sw dash" /><em>{c.short}</em><b className="num">{fmt(c.values[idx], kpi.unit)}</b></div>}
            {prev != null && <div className={`tchg ${prevTone}`}>{signed(prev, kpi.unit)} vs {dates[idx - 1]}</div>}
          </>
        )}
      </div>
    </div>
  )
}
