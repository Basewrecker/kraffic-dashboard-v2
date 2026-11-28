import { useId, useMemo, useState } from 'react'
import { useWidth } from '../../components/ui/motion'
import ChartHoverCard, { HoverMarks } from '../../components/ui/ChartHoverCard'
import { useUiScale } from '../../app/lib/ui-scale'
import { fitAxis, smoothPath, spreadLabels, tickIndexes } from './view'

// Interest over time (as the app's MarketChart, #203 / #207): one chart, a line per term in its --trend-n colour.
//   · the y-axis is fitted to the data (view.js fitAxis), not 0–100
//   · the selected term is bold; hovering a line, an end label or a chip (`focus`) brings that term forward and the
//     rest go to 25%
//   · lines draw in when the data changes (`drawKey`); only the stretch up to a point Google marks incomplete is dotted
//   · end labels sit at each line's last value and are pushed apart so they never overlap (wide screens; on phones the
//     chips above are the legend)
//   · a related search previewed from the lists is one more line: dashed while a row is hovered, solid once pinned
//   · with a comparison on, the selected term's compared period is a thin grey line and the hover card shows the change
// Sizes are design pixels times the UI scale (useUiScale), because the drawing is computed in script.
//   series: [{ id, name, color, kind: 'term' | 'preview' | 'pinned' }] · data: interestOverTime()'s result
const dayTitle = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const weekTitle = (iso) => `Week of ${new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`
const axisDate = (iso, step, days) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', step === 7 && days > 200 ? { month: 'short', year: 'numeric', timeZone: 'UTC' } : { month: 'short', day: 'numeric', timeZone: 'UTC' })

export default function MarketChart({ data, series, selected, focus, onFocus, onSelect, showBefore = false, days, drawKey, label }) {
  const [ref, w] = useWidth()
  const s = useUiScale()
  const clip = useId()
  const [hover, setHover] = useState(null) // { i, x, y }: the hovered point and the pointer
  const { points, step } = data
  const n = points.length
  const wide = w >= 620 * s // room for end labels beside the plot

  const font = 14 * s
  const top = 10 * s, plotH = (wide ? 325 : 230) * s, axisH = 30 * s // shorter on a phone
  const H = top + plotH + axisH
  const left = 38 * s
  const labelGap = 18 * s
  const longest = Math.max(0, ...series.filter((x) => x.kind !== 'preview').map((x) => x.name.length))
  const right = wide ? Math.min(225 * s, labelGap + longest * font * 0.6 + 4) : 6 * s
  const plotW = Math.max(10, w - left - right)

  const drawn = series.filter((x) => points.some((p) => p.values[x.id] != null))
  const before = showBefore && selected ? points.map((p) => p.before?.[selected] ?? null) : []
  const axis = useMemo(
    // a hovered preview doesn't move the axis (the chart would jump under the pointer); a pinned one does
    () => fitAxis([...points.flatMap((p) => series.filter((x) => x.kind !== 'preview').map((x) => p.values[x.id])), ...before]),
    [points, series, showBefore, selected], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const X = (i) => left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2)
  const Y = (v) => top + ((axis.hi - v) / (axis.hi - axis.lo)) * plotH
  const pathOf = (values) => smoothPath(values.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean))
  // everything after the last complete point is incomplete: dotted
  const firstPartial = points.findIndex((p) => p.partial)
  const splitX = firstPartial > 0 ? X(firstPartial - 1) : null

  const lastOf = (id) => { for (let i = n - 1; i >= 0; i--) if (points[i].values[id] != null) return points[i].values[id]; return null }
  const labelled = drawn.filter((x) => x.kind !== 'preview')
  const labelY = spreadLabels(labelled.map((x) => ({ id: x.id, y: Y(lastOf(x.id)) })), 20 * s, top + 6 * s, top + plotH)
  const maxChars = Math.max(6, Math.floor((right - labelGap) / (font * 0.56)))
  const short = (t) => (t.length > maxChars ? `${t.slice(0, maxChars - 1).trimEnd()}…` : t)

  // back to front: the dimmed lines, then the selected term, then the hovered one
  const order = [...drawn].sort((a, b) => Number(a.id === focus) - Number(b.id === focus) || Number(a.id === selected) - Number(b.id === selected))
  const dim = (id) => (focus && focus !== id ? 0.25 : 1)
  // thinner on a phone, where a year of weekly points is packed into a narrow plot
  const stroke = (x) => (x.id === selected ? (wide ? 3.5 : 2.5) : x.kind === 'term' ? (wide ? 1.75 : 1.25) : 2) * s

  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left, py = e.clientY - r.top
    if (px < left - 8 || px > left + plotW + 8 || py > top + plotH + 4) return setHover(null)
    setHover({ i: Math.max(0, Math.min(n - 1, Math.round(((px - left) / plotW) * (n - 1)))), x: px, y: py })
  }
  const hp = hover ? points[hover.i] : null
  const cardRows = hp ? series.filter((x) => x.kind !== 'preview').map((x) => {
    const v = hp.values[x.id], b = showBefore ? hp.before?.[x.id] : null
    return { id: x.id, name: x.name, color: x.color, value: v, change: v != null && b != null ? v - b : undefined }
  }) : []
  const ticks = tickIndexes(n, wide ? 6 : 3)

  return (
    <div ref={ref} className="relative select-none" onPointerMove={move} onPointerLeave={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={H} role="img" aria-label={label} className="block overflow-visible">
          <defs>
            <clipPath id={`${clip}-solid`}><rect x={0} y={0} width={splitX ?? w} height={H} /></clipPath>
            <clipPath id={`${clip}-tail`}><rect x={splitX ?? w} y={0} width={w} height={H} /></clipPath>
            <clipPath id={`${clip}-plot`}><rect x={left} y={0} width={plotW} height={top + plotH} /></clipPath>
          </defs>
          {/* y-axis: a hairline and a number per step; the baseline a shade stronger */}
          {axis.ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={left + plotW} y1={Y(t)} y2={Y(t)} stroke={t === axis.lo ? 'var(--color-line-strong)' : 'var(--color-line)'} strokeWidth="1" />
              <text x={0} y={Y(t) + font * 0.35} fontSize={font} fill="var(--color-stone-500)" className="tabular-nums">{t}</text>
            </g>
          ))}
          {ticks.map((i, k) => (
            <text key={i} x={X(i)} y={top + plotH + 20 * s} fontSize={font} fill="var(--color-stone-500)" className="tabular-nums"
              textAnchor={k === 0 ? 'start' : k === ticks.length - 1 ? 'end' : 'middle'}>{axisDate(points[i].iso, step, days)}</text>
          ))}

          {/* the compared period of the selected term: thin and grey, behind the lines */}
          {before.some((v) => v != null) && (
            <path key={`before-${drawKey}`} d={pathOf(before)} fill="none" stroke="var(--color-stone-400)" strokeWidth={1.5 * s} strokeLinecap="round" strokeLinejoin="round" className="trend-fade" />
          )}

          {order.map((x) => {
            const d = pathOf(points.map((p) => p.values[x.id]))
            const common = { d, fill: 'none', stroke: x.color, strokeWidth: stroke(x), strokeLinecap: 'round', strokeLinejoin: 'round' }
            return (
              <g key={x.id} opacity={dim(x.id)} className="transition-opacity duration-150" clipPath={x.kind === 'preview' ? `url(#${clip}-plot)` : undefined}>
                {x.kind === 'preview'
                  ? <path {...common} strokeDasharray={`${5 * s} ${5 * s}`} className="trend-fade" />
                  : (
                    <>
                      <path key={`solid-${drawKey}`} {...common} pathLength="1" clipPath={`url(#${clip}-solid)`} className="trend-draw" />
                      {splitX != null && <path key={`tail-${drawKey}`} {...common} strokeDasharray={`0.1 ${stroke(x) * 2.2}`} clipPath={`url(#${clip}-tail)`} className="trend-tail" />}
                    </>
                  )}
                {/* a wide invisible stroke, so a thin line is easy to point at */}
                {x.kind === 'term' && (
                  <path d={d} fill="none" stroke="transparent" strokeWidth={14 * s} className="cursor-pointer"
                    onPointerEnter={() => onFocus(x.id)} onPointerLeave={() => onFocus(null)} onClick={() => onSelect(x.id)} />
                )}
              </g>
            )
          })}

          {/* end labels: at each line's last value, pushed apart; a short tick joins a moved label to its line */}
          {wide && labelled.map((x) => {
            const y0 = Y(lastOf(x.id)), y1 = labelY[x.id]
            const isTerm = x.kind === 'term'
            return (
              <g key={x.id} aria-hidden opacity={dim(x.id)} className={`transition-opacity duration-150 ${isTerm ? 'cursor-pointer' : ''}`}
                onPointerEnter={isTerm ? () => onFocus(x.id) : undefined} onPointerLeave={isTerm ? () => onFocus(null) : undefined} onClick={isTerm ? () => onSelect(x.id) : undefined}>
                {x.id !== selected && <line x1={left + plotW + 4 * s} x2={left + plotW + 11 * s} y1={y0} y2={y1} stroke={x.color} strokeWidth={1.25 * s} strokeLinecap="round" />}
                <text x={left + plotW + labelGap} y={y1 + font * 0.35} fontSize={font} fontWeight={x.id === selected ? 700 : 500}
                  fill={x.id === selected || x.id === focus ? 'var(--color-stone-900)' : 'var(--color-stone-600)'}>{short(x.name)}</text>
              </g>
            )
          })}

          {hp && (
            <HoverMarks x={X(hover.i)} top={top} bottom={top + plotH} r={4 * s}
              dots={drawn.filter((x) => x.kind !== 'preview' && hp.values[x.id] != null).map((x) => ({ id: x.id, y: Y(hp.values[x.id]), color: x.color }))} />
          )}
        </svg>
      )}
      <ChartHoverCard show={Boolean(hp)} x={hover?.x} y={hover?.y} bounds={{ width: w, height: H }}
        title={hp ? `${step === 7 ? weekTitle(hp.iso) : dayTitle(hp.iso)}${hp.partial ? ' · incomplete' : ''}` : ''}
        rows={cardRows} activeId={focus ?? selected} />
      {/* keeps the chart's height while the width is measured */}
      {w === 0 && <div style={{ height: H }} />}
    </div>
  )
}
