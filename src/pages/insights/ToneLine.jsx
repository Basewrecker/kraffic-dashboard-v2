import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { curveMonotoneX, line as d3line } from 'd3-shape'
import { hl } from '../../components/ui/Insight'
import { fmtDay, t2, t3 } from './parts'

// The Trends net tone line (Trends → Coverage over time → Tone), as its own piece: net tone per point =
// (positive − negative) ÷ statements, −100%…+100% around a zero line; ink above zero, --negative below; faint volume
// bars (data-c3) underneath; hollow points under 3 statements. Same scale, labels and tooltip as Trends.
// points: [{ day, total, positive, neutral, negative }]
const MIN_SOLID = 3
const net = (d) => (d.total ? (d.positive - d.negative) / d.total : 0)

export default function ToneLine({ points, explain, unit = 'statement' }) {
  const [tip, setTip] = useState(null)
  const box = useRef(null)
  const gid = `tl-${useId().replace(/:/g, '')}`
  const n = points.length
  const max = Math.max(...points.map((d) => d.total), 1)
  const [{ w, h: boxH }, setSize] = useState({ w: 600, h: 220 })
  const H = Math.max(160, boxH - 22)
  useEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])
  const slot = w / Math.max(n, 1)
  const bw = Math.max(4, Math.min(24, Math.floor(slot * 0.35)))
  const x = (i) => (n === 1 ? w / 2 : slot * i + slot / 2)
  const y = (v) => H - (v / max) * (H * 0.45) // volume bars use the lower 45% so the line stays readable
  const y0 = H / 2
  const amp = H / 2 - 20
  const ty = (v) => y0 - v * amp
  const path = useMemo(() => d3line().x((_, i) => x(i)).y((d) => ty(net(d))).curve(curveMonotoneX)(points), [points, w, H]) // eslint-disable-line react-hooks/exhaustive-deps
  const plural = (k) => `${k} ${k === 1 ? unit : `${unit}s`}`

  return (
    <div ref={box} className="relative flex-1" style={{ minHeight: 200 }} onMouseLeave={() => setTip(null)}>
      <div className="absolute inset-x-0 border-b border-line" style={{ top: H }} aria-hidden />
      <div className="absolute inset-x-0 border-t border-line" style={{ top: y0 }} aria-hidden />
      {tip && <div className="pointer-events-none absolute w-px bg-stone-500" style={{ left: x(tip.i), top: 0, height: H }} aria-hidden />}
      {points.map((d, i) => (
        <button key={d.day} type="button" onMouseEnter={() => setTip({ d, i })} onFocus={() => setTip({ d, i })} onBlur={() => setTip(null)}
          aria-label={`${fmtDay(d.day)}: ${plural(d.total)} — ${d.positive} positive, ${d.neutral} neutral, ${d.negative} negative`}
          {...(explain ? hl(explain, `tone:${d.day}`) : {})}
          className="absolute flex -translate-x-1/2 flex-col-reverse outline-none focus-visible:ring-2 focus-visible:ring-focus"
          style={{ left: x(i), top: 0, height: H, width: Math.max(bw, 16), paddingInline: (Math.max(bw, 16) - bw) / 2 }}>
          <span className="rounded-t-[3px]" style={{ height: H - y(d.total), background: 'var(--data-c3)', opacity: 0.6 }} />
        </button>
      ))}
      <svg className="pointer-events-none absolute inset-x-0 top-0 overflow-visible" width={w} height={H} aria-hidden>
        <defs>
          <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={H}>
            <stop offset={(y0 + 1) / H} stopColor="var(--ink)" />
            <stop offset={(y0 + 1) / H} stopColor="var(--negative)" />
          </linearGradient>
        </defs>
        {n > 1 && path && <path d={path} fill="none" stroke={`url(#${gid})`} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
        {points.map((d, i) => {
          const v = net(d)
          const c = v < 0 ? 'var(--negative)' : 'var(--ink)'
          const solid = d.total >= MIN_SOLID
          const r = tip?.i === i ? 4 : 3
          return <circle key={d.day} cx={x(i)} cy={ty(v)} r={solid ? r : r - 1} fill={solid ? c : 'var(--color-surface)'} stroke={c} strokeWidth={solid ? 0 : 2} />
        })}
      </svg>
      <div className={`pointer-events-none absolute right-0 top-0 text-right text-[13px] leading-4 ${t3}`} style={{ height: H }} aria-hidden>
        <span className="absolute right-0 top-0 whitespace-nowrap">More positive</span>
        <span className="absolute right-0 whitespace-nowrap" style={{ top: y0 - 20 }}>Even</span>
        <span className="absolute right-0 whitespace-nowrap" style={{ top: H - 20 }}>More negative</span>
      </div>
      <div className="absolute inset-x-0 h-4" style={{ top: H + 6 }} aria-hidden>
        {points.map((d, i) => <span key={d.day} className={`absolute -translate-x-1/2 whitespace-nowrap text-[12px] leading-4 ${t3}`} style={{ left: x(i) }}>{fmtDay(d.day)}</span>)}
      </div>
      {tip && (
        <div role="tooltip" className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line bg-raised px-2.5 py-2 text-[12px] leading-4 shadow-md tabular-nums"
          style={{ left: Math.min(Math.max(x(tip.i), 100), w - 100), top: Math.min(ty(net(tip.d)), y0) - 12 }}>
          <div className="font-semibold text-stone-900">{fmtDay(tip.d.day)} · {plural(tip.d.total)}</div>
          <div className={`mt-0.5 ${t2}`}>{tip.d.positive} positive · {tip.d.neutral} neutral · <span className={tip.d.negative ? 'text-negative' : undefined}>{tip.d.negative} negative</span></div>
          <div className={`mt-0.5 ${t3}`}>Net tone {Math.round(net(tip.d) * 100) > 0 ? '+' : ''}{Math.round(net(tip.d) * 100)}%</div>
        </div>
      )}
    </div>
  )
}
