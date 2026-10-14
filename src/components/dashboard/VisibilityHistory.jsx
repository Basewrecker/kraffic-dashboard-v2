import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Bar, BarChart as RBarChart, CartesianGrid, Cell, LabelList, Line, LineChart as RLineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useIsMobile } from '../../hooks/useMedia'
import { BarChart3, Check, ChevronDown, LineChart, TrendingUp } from 'lucide-react'
import Card from './Card'
import { chart } from '../../theme/chart'
import { getBarColor, getCompetitorColor, getLineColor } from '../../theme/colors'
import { defaultRange, getHistory, historyRanges, historySeries } from '../../data/mock'
import { brandName } from '../../utils/brand'
import Segmented from './Segmented'
import Switch from '../ui/Switch'
import { useBrandView } from '../../hooks/useBrandView'
import Insight, { hlOpacity, useExplain } from '../ui/Insight'
import { sourceLine } from './insights'
import { useTracking } from '../../store/trackingSettings'
import { engineName, engineScale } from '../../data/brandViews'

// colours and "you" follow the focal brand ("Viewing as"); set once per render by the card
let FOCAL = { key: 'dermasuri', domain: 'dermasuri.com' }
const color = (s) => getCompetitorColor(s.label, FOCAL.domain).fill
const lineColor = (s) => getLineColor(s.label, FOCAL.domain)
const barColor = (s) => getBarColor(s.label, FOCAL.domain) // { fill, opacity }
const ANIM = { animationDuration: 500, animationEasing: 'ease-out' }

// no fontFamily: ticks inherit --font-sans so they follow the font switcher
const tick = { fontSize: 13, fontWeight: 400, fill: 'var(--color-stone-500)', className: 'num' }

// ---- ALL view state lives in one object, mirrored to the URL so the view is shareable and survives refresh:
//      ?compare=off&hide=ordinary&period=monthly&chart=line&range=last-6m
const DEFAULT_VIEW = { compare: true, hidden: [], granularity: 'weekly', chart: 'line', range: defaultRange.weekly }
function readView() {
  const q = new URLSearchParams(window.location.search)
  const granularity = q.get('period') === 'monthly' ? 'monthly' : 'weekly'
  const range = historyRanges[granularity].some((r) => r.id === q.get('range')) ? q.get('range') : defaultRange[granularity]
  const hidden = (q.get('hide') ?? '').split(',').filter((k) => historySeries.some((c) => c.key === k))
  return {
    compare: q.get('compare') !== 'off',
    hidden,
    granularity,
    chart: ['line', 'bar', 'growth'].includes(q.get('chart')) ? q.get('chart') : DEFAULT_VIEW.chart,
    range,
  }
}
function writeView(v) {
  const q = new URLSearchParams(window.location.search)
  const set = (k, val, def) => (val === def ? q.delete(k) : q.set(k, val))
  set('compare', v.compare ? 'on' : 'off', 'on')
  set('hide', v.hidden.join(','), '')
  set('period', v.granularity, DEFAULT_VIEW.granularity)
  set('chart', v.chart, DEFAULT_VIEW.chart)
  set('range', v.range, defaultRange[v.granularity])
  const qs = q.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`)
}

function RangeSelect({ granularity, value, onChange }) {
  const id = useId()
  return (
    <label htmlFor={id} className="relative inline-flex h-9 shrink-0 items-center">
      <span className="sr-only">Time range</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-lg border border-line bg-raised pl-3.5 pr-8 text-small font-medium text-stone-600 outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {historyRanges[granularity].map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-3 text-stone-500" aria-hidden />
    </label>
  )
}

// line-mode legend checkbox: filled + check when on, colored outline when off
function LegendBox({ color: c, checked }) {
  return (
    <span
      aria-hidden
      className="grid h-4 w-4 shrink-0 place-items-center rounded-[4px] transition-[background-color,box-shadow] duration-150 ease-out"
      style={checked ? { background: c } : { boxShadow: `inset 0 0 0 1.5px ${c}` }}
    >
      {/* white in light; near-black in dark, where the ink box is near-white */}
      {checked && <Check size={12} strokeWidth={3} style={{ color: 'var(--line-check)' }} />}
    </span>
  )
}

const fmtDelta = (d) => (d > 0 ? `+${d}` : d < 0 ? `−${Math.abs(d)}` : '0')

function HistoryTooltip({ active, payload, label, series, compare, unit, line = false, graphite = false }) {
  if (!active || !payload?.length) return null
  const delta = payload[0]?.payload?.delta
  // line mode: vibrant swatches, 8px rounded-[2px], your row first at 500
  // graphite (thin bar view): the same layout, others by value (highest first), swatches in the bars' colours
  const YOU = FOCAL.key
  const value = (s) => payload.find((p) => p.dataKey === s.key)?.value ?? -1
  const rows = line ? [...series].sort((a, b) => (b.key === YOU) - (a.key === YOU) || (graphite ? value(b) - value(a) : 0)) : series
  return (
    <div className="rounded-lg border border-stone-200 bg-raised px-3 py-2 text-small shadow-sm">
      <div className="mb-1 font-semibold text-stone-900">{label}</div>
      {rows.map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-6">
          <span className={`inline-flex items-center gap-1.5 ${line && s.key === YOU ? 'font-medium text-stone-900' : 'text-stone-600'}`}>
            {line
              ? <span className="h-2 w-2 rounded-[2px]" style={graphite ? { background: barColor(s).fill, opacity: barColor(s).opacity } : { background: lineColor(s) }} />
              : <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color(s) }} />}
            {brandName(s.label)}
          </span>
          <span className={`num text-stone-900 ${line && s.key !== YOU ? 'font-normal' : 'font-semibold'}`}>{payload.find((p) => p.dataKey === s.key)?.value}%</span>
        </div>
      ))}
      {!compare && delta != null && (
        <div className="mt-1 flex justify-between gap-6 border-t border-stone-100 pt-1 text-stone-600">
          <span>vs last {unit}</span>
          <span className={`num font-semibold ${delta < 0 ? 'text-negative' : 'text-stone-900'}`}>{fmtDelta(delta)}</span>
        </div>
      )}
    </div>
  )
}

function Stat({ label, children }) {
  return (
    <div>
      <div className="text-[13px] leading-[18px] text-stone-600">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1.5 text-[22px] leading-7 font-semibold text-stone-900 tabular-nums">{children}</div>
    </div>
  )
}

// growth label above each bar / point ("+3", "−1"); negative in --negative
function GrowthLabel({ x, y, width = 0, value }) {
  if (value == null) return null
  return (
    <text x={x + width / 2} y={y - 10} textAnchor="middle" fontSize={12} fontWeight={500} className="num" fill={value < 0 ? 'var(--color-negative)' : 'var(--color-stone-600)'}>
      {fmtDelta(value)}
    </text>
  )
}

const signClass = (d) => (d < 0 ? 'text-negative' : 'text-stone-900')

// Growth tooltip: "Jul 2026 · +2 (64% → 66%)", one line per visible series
function GrowthTooltip({ active, payload, label, series, compare }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const YOU = FOCAL.key
  const line = (s) => (
    <>
      <span className={`num font-semibold ${s.key === YOU ? signClass(p[s.key]) : 'text-stone-900'}`}>{fmtDelta(p[s.key])}</span>{' '}
      <span className="num text-stone-600">({p.prevs[s.key]}% → {p.values[s.key]}%)</span>
    </>
  )
  if (!compare) return <div className="rounded-lg border border-stone-200 bg-raised px-3 py-2 text-small shadow-sm"><span className="font-semibold text-stone-900">{label}</span> · {line(series[0])}</div>
  return (
    <div className="rounded-lg border border-stone-200 bg-raised px-3 py-2 text-small shadow-sm">
      <div className="mb-1 font-semibold text-stone-900">{label}</div>
      {series.map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-6">
          <span className="inline-flex items-center gap-1.5 text-stone-600"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: color(s) }} /> {brandName(s.label)}</span>
          <span>{line(s)}</span>
        </div>
      ))}
    </div>
  )
}

// Growth bar: positive → rounded top; negative → rounded bottom (and red for "you"); zero → 2px stub on the zero line
function GrowthBar({ x, y, width, height, value, fill, fillOpacity, you }) {
  if (value == null || !(width > 0)) return null
  // a 0-value bar has height 0 and sits exactly on the zero line
  if (value === 0) return <rect x={x} y={y - 1} width={width} height={2} fill={chart.c3} />
  const top = Math.min(y, y + height), h = Math.abs(height)
  const r = Math.min(6, width / 2, h)
  const neg = value < 0
  const d = neg
    ? `M${x},${top} H${x + width} V${top + h - r} A${r},${r} 0 0 1 ${x + width - r},${top + h} H${x + r} A${r},${r} 0 0 1 ${x},${top + h - r} Z`
    : `M${x},${top + h} V${top + r} A${r},${r} 0 0 1 ${x + r},${top} H${x + width - r} A${r},${r} 0 0 1 ${x + width},${top + r} V${top + h} Z`
  return <path d={d} fill={neg && you ? 'var(--color-negative)' : fill} fillOpacity={neg && you ? 0.85 * fillOpacity : fillOpacity} />
}

// value label on a growth bar: above positive, below negative
function GrowthValueLabel({ x, y, width = 0, height = 0, value }) {
  if (value == null) return null
  const top = Math.min(y, y + height), bottom = Math.max(y, y + height)
  return (
    <text x={x + width / 2} y={value < 0 ? bottom + 15 : top - 7} textAnchor="middle" fontSize={12} fontWeight={500} className="num" fill={value < 0 ? 'var(--color-negative)' : 'var(--color-stone-900)'}>
      {fmtDelta(value)}
    </text>
  )
}

// share value inside the top of a "you" bar (Bar view)
function InsideValueLabel({ x, y, width = 0, height = 0, value }) {
  if (value == null || height < 24) return null
  return (
    <text x={x + width / 2} y={y + 17} textAnchor="middle" fontSize={12} fontWeight={500} className="num" fill="var(--color-on-ink)">
      {value}
    </text>
  )
}

export default function VisibilityHistory() {
  const mobile = useIsMobile()
  const { focal, isOwnBrand, engine } = useBrandView()
  FOCAL = { key: focal.key, domain: focal.domain }
  const YOU = focal.key
  const COMPETITORS = historySeries.filter((s) => s.key !== YOU)
  const [view, setView] = useState(readView)
  const [hovered, setHovered] = useState(null) // series key highlighted from the legend
  const [barGroup, setBarGroup] = useState(null) // thin bar view: index of the date group under the pointer
  useEffect(() => writeView(view), [view])

  // the chart reads ONLY this
  // engine filter: every series is that engine's share
  const h = useMemo(() => getHistory({ ...view, focal: YOU, scale: engine === 'all' ? null : engineScale(engine) }), [view, YOU, engine])
  // switching brand: the new focal brand is never hidden; nothing left to compare → Compare off
  useEffect(() => {
    setView((v) => {
      const hidden = v.hidden.filter((k) => k !== YOU)
      if (hidden.length && historySeries.filter((s) => s.key !== YOU).every((c) => hidden.includes(c.key))) return { ...v, hidden: [], compare: false }
      return hidden.length === v.hidden.length ? v : { ...v, hidden }
    })
  }, [YOU])
  const { points, series, stats, domain, ticks, youHidden } = h

  const update = (patch) => setView((v) => ({ ...v, ...patch }))
  const setGranularity = (granularity) => update({ granularity, range: defaultRange[granularity] })
  const setCompare = (compare) =>
    // turning Compare back on after every competitor was hidden brings them back
    setView((v) => (compare && COMPETITORS.every((c) => v.hidden.includes(c.key)) ? { ...v, compare, hidden: [] } : { ...v, compare }))
  const toggleHidden = (key) =>
    setView((v) => {
      const hidden = v.hidden.includes(key) ? v.hidden.filter((k) => k !== key) : [...v.hidden, key]
      // something must stay on the chart: the last visible series can't be hidden
      if (historySeries.every((s) => hidden.includes(s.key))) return v
      // only Dermasuri left = nothing to compare → switch Compare off (Dermasuri alone, with its summary)
      if (COMPETITORS.every((c) => hidden.includes(c.key))) return { ...v, hidden: [], compare: false }
      return { ...v, hidden }
    })

  const compare = view.compare
  const isGrowth = view.chart === 'growth'
  const showGrowthLabels = !compare && view.granularity === 'monthly' && view.chart === 'line'
  const last = points.length - 1
  const isLine = view.chart === 'line'
  // hovering a pill: line mode drops the others to 25%, bar/growth keep 30%
  // explain mode ("Why?"): the series the insight is about stay, the rest dim
  const explain = useExplain(`${view.chart}|${view.granularity}|${view.range}|${view.compare}|${engine}|${YOU}`)
  const dim = (key) => (hovered && hovered !== key ? (isLine ? 0.25 : 0.3) : 1) * (hlOpacity(explain, `series:${key}`) ?? 1)
  const g = h.growth

  // ---- shared plot furniture; returned as a keyed array so Recharts sees direct children
  const furniture = ({ yDomain, yTicks, yFormat, tooltip, cursor, xPadding, interval }) => [
    <CartesianGrid key="grid" vertical={false} stroke={chart.track} strokeWidth={1} />,
    // phones: at most 4 date labels, a 28px Y axis
    <XAxis key="x" dataKey="date" tickMargin={12} tickLine={false} axisLine={false} tick={tick} padding={xPadding} interval={interval ?? (mobile ? Math.max(0, Math.ceil(points.length / 4) - 1) : 'preserveEnd')} />,
    <YAxis key="y" width={mobile ? 30 : 36} tickMargin={mobile ? 4 : 8} domain={yDomain} ticks={yTicks} tickFormatter={yFormat} allowDataOverflow tickLine={false} axisLine={false} tick={tick} />,
    <Tooltip key="tip" cursor={cursor} content={tooltip} />,
  ]
  // Line view: label inside the plot, right-aligned above the line. Bar/Growth: the last column reaches the right edge,
  // so the label sits just outside the plot at the end of the line (a right gutter is reserved for it).
  const avgLine = (y, text, outside = false) => (
    <ReferenceLine key="avg" y={y} stroke={chart.c3} strokeWidth={1} strokeDasharray="4 4"
      label={{ value: text, position: outside ? 'right' : 'insideBottomRight', offset: outside ? 8 : 6, fontSize: 12, fill: 'var(--color-stone-600)', className: 'num' }} />
  )
  const AVG_GUTTER = 84
  const shareTooltip = <HistoryTooltip series={series} compare={compare} unit={stats.unit} line={isLine} />
  const margin = { top: showGrowthLabels ? 24 : 8, right: 8, bottom: 0, left: 0 }

  // insight: the focal brand's move over the last period of the range, and who leads at its end
  // ("Lumen Skincare rose 1 point this week. Aurelia Labs still leads.")
  const tracking = useTracking()
  const insight = (() => {
    const end = points[points.length - 1]
    if (!end || end[YOU] == null) return null
    const name = focal.name
    const d = end.deltas?.[YOU]
    const move = d == null ? `is at ${end[YOU]}%` : d > 0 ? `rose ${d} point${d === 1 ? '' : 's'}` : d < 0 ? `fell ${-d} point${d === -1 ? '' : 's'}` : 'held steady'
    const when = d == null ? '' : ` this ${stats.unit}`
    const top = (p, val) => historySeries.filter((x) => val(p, x) != null).sort((a, b) => val(p, b) - val(p, a))[0]
    const leader = top(end, (p, x) => p[x.key])
    const before = end.prevs ? top(end, (p, x) => p.prevs[x.key]) : null
    const leads = leader && (before && before.key === leader.key ? 'still leads' : before ? 'now leads' : 'leads')
    const text = !leader ? `${name} ${move}${when}.`
      : leader.key === YOU ? `${name} ${move}${when} and ${leads}.`
        : `${name} ${move}${when}. ${brandName(leader.label)} ${leads}.`
    const calc = [
      `${name}: ${d == null ? '' : `${end.prevs[YOU]}% → `}${end[YOU]}% (${end.date})`,
      leader && leader.key !== YOU ? `${brandName(leader.label)}: ${end[leader.key]}%, the highest share` : null,
    ].filter(Boolean).join('. ')
    return { text, evidence: { keys: [`series:${YOU}`, ...(leader && leader.key !== YOU ? [`series:${leader.key}`] : [])], calc: `${calc}.`, source: sourceLine(tracking) } }
  })()

  // ---- one real Recharts chart per type
  const renderChart = () => {
    if (view.chart === 'line') {
      // trend: lines only (no fills). All lines 2.5px, round caps, full opacity; a dot on the last point only.
      return (
        <RLineChart data={points} margin={margin}>
          {furniture({ yDomain: domain, yTicks: ticks, tooltip: shareTooltip, cursor: { stroke: chart.c3, strokeWidth: 1 }, xPadding: { left: 16, right: 16 } })}
          {!compare && avgLine(stats.average, `Avg ${stats.average}%`)}
          {[...series].reverse().map((s) => {
            const you = s.key === YOU
            const c = lineColor(s)
            const dot = (p) => (p.index === last
              ? <circle key={`d${p.index}`} cx={p.cx} cy={p.cy} r={4} fill={c} stroke="var(--color-surface)" strokeWidth={2} opacity={dim(s.key)} />
              : <g key={`d${p.index}`} />)
            return (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={c} strokeOpacity={dim(s.key)} strokeWidth={2.5} strokeLinecap="round"
                dot={dot} activeDot={{ r: 5, fill: c, stroke: 'var(--color-surface)', strokeWidth: 2 }} {...ANIM}>
                {you && showGrowthLabels && <LabelList dataKey="delta" content={GrowthLabel} />}
              </Line>
            )
          })}
        </RLineChart>
      )
    }
    if (view.chart === 'bar') {
      // share per period: grouped (Compare on) / single (off), graphite by share rank (getBarColor).
      // Up to 4 brands showing: the regular bars, share value inside the top of each "you" bar.
      // 5 or more: thin bars (8px, 2px apart; phones 6 / 1), no labels; hovering a date group dims the others to 35%
      // and shows the tooltip. Bars resize over 200ms when the number of brands showing crosses 4 / 5.
      const thin = series.length >= 5
      const groupOpacity = (i) => (!thin || barGroup == null || String(barGroup) === String(i) ? 1 : 0.35)
      return (
        <RBarChart data={points} {...(thin ? { barSize: mobile ? 6 : 8, barGap: mobile ? 1 : 2 } : { barCategoryGap: '11%', barGap: 4 })}
          margin={{ ...margin, right: compare ? margin.right : AVG_GUTTER }}
          onMouseMove={(st) => setBarGroup(thin && st?.isTooltipActive ? st.activeTooltipIndex : null)} onMouseLeave={() => setBarGroup(null)}>
          {furniture({
            yDomain: domain, yTicks: ticks,
            tooltip: thin ? <HistoryTooltip series={series} compare={compare} unit={stats.unit} line graphite /> : shareTooltip,
            cursor: thin ? false : { fill: chart.track, fillOpacity: 0.6, radius: 8 },
            interval: thin && mobile ? (points.length > 6 ? 1 : 0) : undefined,
          })}
          {!compare && avgLine(stats.average, `Avg ${stats.average}%`, true)}
          {series.map((s) => {
            const c = barColor(s)
            return (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={c.fill} fillOpacity={dim(s.key) * c.opacity} radius={thin ? [3, 3, 0, 0] : [6, 6, 0, 0]}
                maxBarSize={thin ? undefined : 44} animationDuration={200} animationEasing="ease-out">
                {thin && points.map((p, i) => (
                  <Cell key={p.date} fillOpacity={dim(s.key) * c.opacity * groupOpacity(i)} style={{ transition: 'fill-opacity 150ms ease-out' }} />
                ))}
                {!thin && s.key === YOU && <LabelList dataKey={s.key} content={InsideValueLabel} />}
              </Bar>
            )
          })}
        </RBarChart>
      )
    }
    // growth per period: change vs previous period, symmetric axis around 0
    const avgText = `Avg ${g.average > 0 ? '+' : g.average < 0 ? '−' : ''}${Math.abs(g.average)}`
    return (
      <RBarChart data={g.points} barCategoryGap={compare ? '14%' : '24%'} barGap={3} margin={{ top: 22, right: AVG_GUTTER, bottom: 6, left: 0 }}>
        {furniture({ yDomain: g.domain, yTicks: g.ticks, yFormat: fmtDelta, tooltip: <GrowthTooltip series={series} compare={compare} />, cursor: { fill: chart.track, fillOpacity: 0.6, radius: 8 } })}
        <ReferenceLine key="zero" y={0} stroke="var(--color-stone-600)" strokeOpacity={0.4} strokeWidth={1} />
        {!youHidden && avgLine(g.average, avgText, true)}
        {series.map((s) => {
          const you = s.key === YOU
          return (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={color(s)} fillOpacity={dim(s.key)} maxBarSize={you ? 40 : 14} {...ANIM}
              shape={(props) => <GrowthBar {...props} value={props.payload[s.key]} you={you} fillOpacity={dim(s.key)} />}>
              {you && <LabelList dataKey={s.key} content={GrowthValueLabel} />}
            </Bar>
          )
        })}
      </RBarChart>
    )
  }

  // one legend chip = a show/hide toggle for that series
  const chip = (s) => {
    const shown = !view.hidden.includes(s.key)
    const lastOne = shown && series.length === 1 // the last visible series can't be hidden
    return (
              <button
                key={s.key}
                type="button"
                aria-pressed={shown}
                tabIndex={compare ? 0 : -1}
                onClick={() => toggleHidden(s.key)}
                onMouseEnter={() => shown && setHovered(s.key)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => shown && setHovered(s.key)}
                onBlur={() => setHovered(null)}
                className={isLine
                  ? `inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2 text-[14px] leading-5 outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-focus ${
                    shown ? 'font-medium text-stone-900' : 'font-normal text-stone-600'
                  }`
                  : `inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 text-small outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${
                    shown ? 'bg-tint text-stone-900' : 'bg-transparent text-stone-600/60 hover:text-stone-600'
                  }`}
                title={lastOne ? 'At least one brand stays on the chart' : shown ? `Hide ${brandName(s.label)}` : `Show ${brandName(s.label)}`}
              >
                {isLine
                  ? <LegendBox color={lineColor(s)} checked={shown} />
                  : <span className="h-2 w-2 rounded-full" style={view.chart === 'bar'
                    ? (shown ? { background: barColor(s).fill, opacity: barColor(s).opacity } : { boxShadow: `inset 0 0 0 1.5px ${barColor(s).fill}`, opacity: barColor(s).opacity })
                    : (shown ? { background: color(s) } : { boxShadow: `inset 0 0 0 1.5px ${color(s)}` })} />}
                {brandName(s.label)}
              </button>
    )
  }

  return (
    <Card ref={explain.cardRef} id="history" className="flex h-full min-w-0 scroll-mt-6 flex-col px-5 pt-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="whitespace-nowrap text-title font-semibold text-stone-900">Visibility history</h2>
          <p className="mt-0.5 text-[13px] leading-[18px] font-normal text-stone-600">{isOwnBrand
            ? (!compare ? 'Your share of prompts over time' : youHidden ? 'Competitors’ share of prompts' : 'Your share of prompts vs competitors')
            : (!compare ? `${focal.name}’s share over time` : youHidden ? 'Other brands’ share of prompts' : `${focal.name} vs other brands`)}
            {engine !== 'all' && ` · ${engineName(engine)}`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Period" value={view.granularity} onChange={setGranularity} options={[{ value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />
          <Segmented
            label="Chart type"
            value={view.chart}
            onChange={(chart) => update({ chart })}
            options={[
              { value: 'line', label: 'Trend', icon: LineChart },
              { value: 'bar', label: 'Share per period', icon: BarChart3 },
              { value: 'growth', label: 'Growth per period', icon: TrendingUp },
            ]}
          />
          <RangeSelect granularity={view.granularity} value={view.range} onChange={(range) => update({ range })} />
        </div>
      </div>

      {/* legend = filter */}
      {/* phones: one sideways-scrolling row */}
      <div className="no-scrollbar mt-3 flex items-center gap-y-2 max-md:-mx-4 max-md:overflow-x-auto max-md:px-4 md:flex-wrap">
        <Switch checked={compare} onChange={setCompare} className="shrink-0">Compare</Switch>
        <span className="mx-3 h-5 w-px bg-stone-200" aria-hidden />
        {/* focal brand: a toggle like the others while comparing (hide it to see the rest alone); fixed otherwise */}
        {compare ? chip(historySeries.find((s) => s.key === YOU)) : isLine ? (
          <span className="inline-flex h-8 items-center gap-2 px-1 text-[14px] leading-5 font-medium text-stone-900">
            <LegendBox color={chart.lineYou} checked /> {focal.name}
          </span>
        ) : (
          <span className="inline-flex h-8 items-center gap-2 px-1 text-small font-medium text-stone-900">
            <span className="h-2 w-2 rounded-full" style={{ background: chart.you }} /> {focal.name}
          </span>
        )}
        <div
          className={`flex items-center overflow-hidden transition-[max-width,opacity] duration-200 ease-out ${isLine ? 'gap-0.5' : 'gap-1.5'} ${compare ? `${isLine ? 'ml-0.5' : 'ml-2'} max-w-[640px] opacity-100` : 'max-w-0 opacity-0'}`}
          aria-hidden={!compare}
        >
          {COMPETITORS.map((s) => chip(s))}
        </div>
      </div>

      {/* summary strip slides in when Compare is off */}
      <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${compare ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`} aria-hidden={compare}>
        <div className="overflow-hidden">
          <div className="flex flex-wrap gap-x-8 gap-y-2 pt-3">
            <Stat label="Current">{stats.current}%</Stat>
            <Stat label="Change">
              {stats.change != null && (
                <>
                  <span className={stats.change < 0 ? 'text-negative' : 'text-ink'}>{stats.change < 0 ? '▼' : '▲'}</span>
                  <span>{Math.abs(stats.change)}</span>
                  <span className="text-[13px] font-normal text-stone-600">vs last {stats.unit}</span>
                </>
              )}
            </Stat>
            {isGrowth ? (
              <Stat label="Avg growth">
                <span className={g.average < 0 ? 'text-negative' : undefined}>{g.average > 0 ? '+' : g.average < 0 ? '−' : ''}{Math.abs(g.average)}</span>
                <span className="text-[13px] font-normal text-stone-600">/ {stats.unit}</span>
              </Stat>
            ) : (
              <Stat label="Best">
                {stats.best}% <span className="text-[13px] font-normal text-stone-600">{stats.bestLabel.startsWith('this') ? `· ${stats.bestLabel}` : `(${stats.bestLabel})`}</span>
              </Stat>
            )}
          </div>
        </div>
      </div>

      {/* grows with the row (Prompt coverage beside it), so there's no empty space under the x-axis */}
      {/* fixed height on phones (reserved, so nothing shifts when it draws) */}
      {/* one plot height in every chart type, so switching type never changes the card (phones 200, desktop 240) */}
      <div className="mt-3 h-[200px] lg:h-[240px]">
        <ResponsiveContainer key={`${view.chart}-${view.granularity}-${view.compare}`} width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {insight && <div className="mt-auto pb-3 pt-2"><Insight explain={explain} {...insight} /></div>}
    </Card>
  )
}
