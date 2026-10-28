import { forwardRef, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart as RBarChart, CartesianGrid, Cell, LabelList, Line, LineChart as RLineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, usePlotArea, useXAxisScale } from 'recharts'
import { useIsMobile } from '../../hooks/useMedia'
import { BarChart3, Check, ChevronDown, LineChart, TrendingUp } from 'lucide-react'
import Card from './Card'
import { chart } from '../../theme/chart'
import { defaultRange, getHistory, historyManyPreview, historyRanges } from '../../data/mock'
import { historyMany } from '../../data/historyMany'
import { drawnRivals, groupedBarSize } from '../../utils/historyChart'
import { brandName } from '../../utils/brand'
import Segmented from './Segmented'
import Switch from '../ui/Switch'
import { useBrandView } from '../../hooks/useBrandView'
import Insight, { hlOpacity, useExplain } from '../ui/Insight'
import { sourceLine } from './insights'
import { useTracking } from '../../store/trackingSettings'
import { engineName, engineScale } from '../../data/brandViews'

// colours follow the slots, set once per render by the card: the focal brand ("Viewing as") is ink; the 3 competitors
// drawn are slots 0–2 (by share; a brand swapped in from "+N more" takes slot 2). Trend and Share views: indigo, red,
// green. Growth view: the graphite steps c1–c3, since red there means a drop. Never more than 3 colours + ink.
let FOCAL = { key: null }
let SLOT = {} // series key → 0 | 1 | 2
const slotOf = (s) => SLOT[s.key] ?? 2
const color = (s) => (s.key === FOCAL.key ? chart.you : chart[`c${slotOf(s) + 1}`])
const lineColor = (s) => (s.key === FOCAL.key ? chart.lineYou : chart[`line${slotOf(s) + 1}`])
const barColor = (s) => ({ fill: lineColor(s), opacity: 1 })
const ANIM = { animationDuration: 500, animationEasing: 'ease-out' }

// no fontFamily: ticks inherit --font-sans so they follow the font switcher
const tick = { fontSize: 13, fontWeight: 400, fill: 'var(--color-stone-500)', className: 'num' }

// ---- ALL view state lives in one object, mirrored to the URL so the view is shareable and survives refresh:
//      ?compare=off&hide=ordinary&period=monthly&chart=line&range=last-6m
const DEFAULT_VIEW = { compare: true, hidden: [], granularity: 'weekly', chart: 'line', range: defaultRange.weekly, swap: null }
// ?swap=<key>: the brand from "+N more" shown in the 3rd competitor slot
function readView(historySeries) {
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
    swap: historySeries.some((c) => c.key === q.get('swap')) ? q.get('swap') : null,
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
  set('swap', v.swap ?? '', '')
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

function HistoryTooltip({ active, payload, label, series, compare, unit, line = false }) {
  if (!active || !payload?.length) return null
  const delta = payload[0]?.payload?.delta
  // line mode: vibrant swatches, 8px rounded-[2px], your row first at 500
  const YOU = FOCAL.key
  const rows = line ? [...series].sort((a, b) => (b.key === YOU) - (a.key === YOU)) : series
  return (
    <div className="rounded-lg border border-stone-200 bg-raised px-3 py-2 text-small shadow-sm">
      <div className="mb-1 font-semibold text-stone-900">{label}</div>
      {rows.map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-6">
          <span className={`inline-flex items-center gap-1.5 ${line && s.key === YOU ? 'font-medium text-stone-900' : 'text-stone-600'}`}>
            {/* Trend and Share views share the colours */}
            {line
              ? <span className="h-2 w-2 rounded-[2px]" style={{ background: lineColor(s) }} />
              : <span className="h-2.5 w-2.5 rounded-sm" style={{ background: lineColor(s) }} />}
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
function GrowthBar({ x, y, width, height, value, fill, fillOpacity, you, outline = 0 }) {
  if (value == null || !(width > 0)) return null
  // a 0-value bar has height 0 and sits exactly on the zero line
  if (value === 0) return <rect x={x} y={y - 1} width={width} height={2} fill={chart.c3} />
  const top = Math.min(y, y + height), h = Math.abs(height)
  const r = Math.min(6, width / 2, h)
  const neg = value < 0
  const d = neg
    ? `M${x},${top} H${x + width} V${top + h - r} A${r},${r} 0 0 1 ${x + width - r},${top + h} H${x + r} A${r},${r} 0 0 1 ${x},${top + h - r} Z`
    : `M${x},${top + h} V${top + r} A${r},${r} 0 0 1 ${x + r},${top} H${x + width - r} A${r},${r} 0 0 1 ${x + width},${top + r} V${top + h} Z`
  const c = neg && you ? 'var(--color-negative)' : fill
  // outline: a point scored before the scoring change (its outline's opacity)
  return <path d={d} fill={c} fillOpacity={neg && you ? 0.85 * fillOpacity : fillOpacity} stroke={outline ? c : 'none'} strokeOpacity={outline} strokeWidth={1} />
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
// one sync date: every bar's value above it
function TopValueLabel({ x, y, width = 0, value }) {
  if (value == null) return null
  return (
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={12} fontWeight={500} className="num" fill="var(--color-stone-700)">
      {value}%
    </text>
  )
}

// The legend chips on one line, never wrapped or cut mid-name: 14px labels with gap-4; if they don't fit, 13px with
// gap-3; if they still don't, as many as fit (brand first) and a "+N more" chip with the rest. Measured
// from the row's own width, again on every resize and once the web fonts have loaded.
const GAP = { md: 16, sm: 12 }
function FitChips({ items, chip, more, measureKey, extra = 0, wrap = false }) {
  // tablet and desktop: the brand + its 3 competitors always show by name; with long names the row wraps to a second
  // line (the chart takes the height that's left) and "+N more" holds only the brands that aren't drawn
  if (wrap) {
    return (
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
        {items.map((s) => chip(s, false))}
        {extra > 0 && more([], false)}
      </div>
    )
  }
  return <FitChipsRow items={items} chip={chip} more={more} measureKey={measureKey} extra={extra} />
}
function FitChipsRow({ items, chip, more, measureKey, extra }) {
  const row = useRef(null)
  const probe = useRef(null)
  const [fit, setFit] = useState({ small: false, count: items.length })
  const keys = items.map((s) => s.key).join('|')
  useLayoutEffect(() => {
    const measure = () => {
      if (!row.current || !probe.current) return
      const avail = row.current.clientWidth
      const widths = (size) => [...probe.current.querySelectorAll(`[data-probe="${size}"]`)].map((n) => n.getBoundingClientRect().width)
      const md = widths('md')
      const sm = widths('sm')
      const moreW = probe.current.querySelector('[data-probe="more"]')?.getBoundingClientRect().width ?? 0
      const span = (w, n, gap) => w.slice(0, n).reduce((a, b) => a + b, 0) + gap * Math.max(0, n - 1)
      // brands outside the drawn 4 always have a "+N more", so its width is always kept
      const room = extra > 0 ? avail - moreW - GAP.sm : avail
      let next
      if (span(md, md.length, GAP.md) <= room) next = { small: false, count: items.length }
      else if (span(sm, sm.length, GAP.sm) <= room) next = { small: true, count: items.length }
      else {
        // as many as fit next to "+N more"; on a phone that can be none (then "+N more" holds every brand)
        let n = items.length - 1
        while (n > 0 && span(sm, n, GAP.sm) + GAP.sm + moreW > avail) n--
        next = { small: true, count: n }
      }
      setFit((f) => (f.small === next.small && f.count === next.count ? f : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(row.current)
    document.fonts?.ready.then(measure)
    return () => ro.disconnect()
  }, [keys, measureKey, extra]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = items.slice(0, fit.count)
  const rest = items.slice(fit.count)
  return (
    <div ref={row} className="relative min-w-0 flex-1">
      <div className={`flex items-center ${fit.small ? 'gap-3' : 'gap-4'}`}>
        {shown.map((s) => chip(s, fit.small))}
        {rest.length + extra > 0 && more(rest, fit.small)}
      </div>
      {/* off-screen copies at both sizes, for the widths; clipped, so the copies never widen the page (on phones that
          made the whole layout, and every drawer, wider than the screen) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div ref={probe} aria-hidden inert="" className="invisible absolute left-0 top-0 flex w-max whitespace-nowrap">
          {items.map((s) => <span key={`md-${s.key}`} data-probe="md" className="inline-flex">{chip(s, false)}</span>)}
          {items.map((s) => <span key={`sm-${s.key}`} data-probe="sm" className="inline-flex">{chip(s, true)}</span>)}
          <span data-probe="more" className="inline-flex"><MoreTrigger n={items.length + extra} small /></span>
        </div>
      </div>
    </div>
  )
}

const MoreTrigger = forwardRef(function MoreTrigger({ n, small, open, ...rest }, ref) {
  return (
  <button ref={ref} type="button" aria-haspopup="menu" aria-expanded={!!open} {...rest}
    className={`inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 ${small ? 'text-[13px] leading-[18px]' : 'text-[14px] leading-5'} font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-[var(--tint)] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus`}>
    +{n} more <ChevronDown size={14} className="text-stone-500" aria-hidden />
  </button>
  )
})

// "+N more": the drawn brands' chips that didn't fit (show / hide, the same marks), then every brand outside the 4
// drawn, by share; picking one swaps it in for the 3rd competitor (`swapOut`), which moves into this list
function MoreChips({ rest, small, hidden, marker, onToggle, swaps = [], swapOut, onSwap }) {
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState({ left: false, shift: 0 })
  const wrap = useRef(null)
  const btn = useRef(null)
  const menu = useRef(null)
  const ITEM = '[role=menuitemcheckbox],[role=menuitem]'
  // the list opens toward the side with room (a phone's "+N more" can sit near the left edge)
  useLayoutEffect(() => {
    if (!open || !menu.current || !btn.current) return
    const b = btn.current.getBoundingClientRect()
    const w = menu.current.offsetWidth
    if (b.right - w >= 16) setPlace({ left: false, shift: 0 })
    else setPlace({ left: true, shift: Math.min(0, window.innerWidth - 16 - (b.left + w)) })
  }, [open])
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector(ITEM)?.focus()
    const out = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [open])
  const onKey = (e) => {
    const els = [...(menu.current?.querySelectorAll(ITEM) ?? [])]
    const i = els.indexOf(document.activeElement)
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); btn.current?.focus() }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus() }
    else if (e.key === 'Tab') setOpen(false)
  }
  const n = rest.length + swaps.length
  const row = 'flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] leading-[18px] outline-none hover:bg-tint focus-visible:bg-tint'
  return (
    <div ref={wrap} className="relative shrink-0" onKeyDown={open ? onKey : undefined}>
      <MoreTrigger ref={btn} n={n} small={small} open={open} onClick={() => setOpen((o) => !o)} aria-label={`${n} more brands`} />
      {open && (
        <div ref={menu} role="menu" aria-label="More brands" style={place.shift ? { transform: `translateX(${place.shift}px)` } : undefined}
          className={`absolute ${place.left ? 'left-0' : 'right-0'} top-full z-30 mt-1 w-max min-w-56 max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-line bg-raised p-1 shadow-md`}>
          {rest.map((s) => {
            const shown = !hidden.includes(s.key)
            return (
              <button key={s.key} type="button" role="menuitemcheckbox" aria-checked={shown} onClick={() => onToggle(s.key)}
                className={`${row} ${shown ? 'font-medium text-stone-900' : 'text-stone-600'}`}>
                {marker(s, shown)}
                <span className="flex-1">{brandName(s.label)}</span>
              </button>
            )
          })}
          {swaps.length > 0 && (
            <>
              {rest.length > 0 && <div className="mx-2 my-1 h-px bg-stone-100" aria-hidden />}
              <div className="px-2 pb-1 pt-1.5 text-[12px] leading-4 text-stone-500">
                Pick one to show instead of {brandName(swapOut.label)}
              </div>
              {swaps.map((s) => (
                <button key={s.key} type="button" role="menuitem" onClick={() => { onSwap(s.key); setOpen(false); btn.current?.focus() }}
                  className={`${row} text-stone-700`}>
                  <span className="h-2 w-2 shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_var(--color-stone-400)]" aria-hidden />
                  <span className="flex-1">{brandName(s.label)}</span>
                  <span className="num pl-3 text-stone-500">{s.share}%</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// "Scoring updated Oct 21": a dashed line on the x axis where the scoring changed, its label in the plot's top margin
// (left of the line near the right edge). `at` is in point-index units (3.29 = between the 4th and 5th dates).
function ScoringMarker({ at, dates, label, gradients = [] }) {
  const scale = useXAxisScale()
  const plot = usePlotArea()
  if (at == null || !scale || !plot) return null
  const i = Math.floor(at)
  const x0 = scale(dates[i], { position: 'middle' })
  const x1 = scale(dates[i + 1], { position: 'middle' })
  if (x0 == null || x1 == null) return null
  const x = x0 + (x1 - x0) * (at - i)
  const right = x > plot.x + plot.width * 0.6
  return (
    <g className="pointer-events-none">
      {/* lines: lighter before the change (userSpaceOnUse, so flat lines keep their stroke) */}
      <defs>
        {gradients.map((g) => (
          <linearGradient key={g.id} id={g.id} gradientUnits="userSpaceOnUse" x1={x - 0.5} x2={x + 0.5} y1={0} y2={0}>
            <stop offset="0" stopColor={g.color} stopOpacity={0.4} />
            <stop offset="1" stopColor={g.color} stopOpacity={1} />
          </linearGradient>
        ))}
      </defs>
      <line x1={x} x2={x} y1={plot.y - 4} y2={plot.y + plot.height} stroke="var(--color-stone-400)" strokeWidth={1} strokeDasharray="3 3" />
      <text x={right ? x - 6 : x + 6} y={plot.y - 8} textAnchor={right ? 'end' : 'start'} fontSize={12} fill="var(--color-stone-500)" className="num">{label}</text>
    </g>
  )
}

// the plot's width in px, for the bar sizes (groupedBarSize)
function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

export default function VisibilityHistory() {
  const mobile = useIsMobile()
  const view0 = useBrandView()
  // ?history=many: the 6-competitor preview brand (data/historyMany.js) in place of the dashboard's brand, this card only
  const dataset = historyManyPreview ? historyMany : null
  const { focal, isOwnBrand, engine } = dataset ? { focal: historyMany.focal, isOwnBrand: true, engine: 'all' } : view0
  const historySeries = useMemo(() => (dataset ? dataset.series : getHistory().series), [dataset])
  FOCAL = { key: focal.key }
  const YOU = focal.key
  const [view, setView] = useState(() => readView(historySeries))
  const [hovered, setHovered] = useState(null) // series key highlighted from the legend
  useEffect(() => writeView(view), [view])

  // competitors by share (highest first); the top 3 are drawn (or 2 + the one swapped in), the rest sit under "+N more"
  const ranked = historySeries.filter((s) => s.key !== YOU).sort((a, b) => b.share - a.share)
  const { drawn, rest: notDrawn } = drawnRivals(ranked.map((s) => s.key), view.swap)
  const byKey = (k) => historySeries.find((s) => s.key === k)
  const COMPETITORS = drawn.map(byKey) // the competitors on the chart (and in the legend), in slot order
  const SWAPS = notDrawn.map(byKey)
  SLOT = Object.fromEntries(drawn.map((k, i) => [k, i]))

  // the chart reads ONLY this. Brands under "+N more" are left out like hidden ones.
  // engine filter: every series is that engine's share
  const h = useMemo(
    () => getHistory({ ...view, hidden: [...view.hidden, ...notDrawn], focal: YOU, dataset, scale: engine === 'all' ? null : engineScale(engine) }),
    [view, notDrawn.join(','), YOU, engine, dataset], // eslint-disable-line react-hooks/exhaustive-deps
  )
  // switching brand: the new focal brand is never hidden; nothing left to compare → Compare off
  useEffect(() => {
    setView((v) => {
      const hidden = v.hidden.filter((k) => k !== YOU)
      if (hidden.length && COMPETITORS.every((c) => hidden.includes(c.key))) return { ...v, hidden: [], compare: false }
      return hidden.length === v.hidden.length ? v : { ...v, hidden }
    })
  }, [YOU]) // eslint-disable-line react-hooks/exhaustive-deps
  const { points, series, stats, domain, ticks, youHidden, scoring } = h
  // one sync date in range: nothing to draw a line between, so bars (one group, a value on every bar, the brands in
  // their line colours); Trend and Growth come back from the second date
  const single = points.length === 1
  // no point in range (no sync yet, or every day at 0%, which the history leaves out): an empty state, no axes
  const empty = points.length === 0
  const chartType = single ? 'bar' : view.chart
  const barFill = (s) => (single ? { fill: lineColor(s), opacity: 1 } : barColor(s))

  const update = (patch) => setView((v) => ({ ...v, ...patch }))
  const setGranularity = (granularity) => update({ granularity, range: defaultRange[granularity] })
  const setCompare = (compare) =>
    // turning Compare back on after every competitor was hidden brings them back
    setView((v) => (compare && COMPETITORS.every((c) => v.hidden.includes(c.key)) ? { ...v, compare, hidden: [] } : { ...v, compare }))
  const toggleHidden = (key) =>
    setView((v) => {
      const hidden = v.hidden.includes(key) ? v.hidden.filter((k) => k !== key) : [...v.hidden, key]
      // something must stay on the chart: the last visible series can't be hidden
      if ([YOU, ...drawn].every((k) => hidden.includes(k))) return v
      // only the brand left = nothing to compare → switch Compare off (the brand alone, with its summary)
      if (COMPETITORS.every((c) => hidden.includes(c.key))) return { ...v, hidden: [], compare: false }
      return { ...v, hidden }
    })
  // "+N more" → a brand swapped in for the 3rd competitor (shown, even if it was hidden before)
  const swapIn = (key) => setView((v) => ({ ...v, swap: key === ranked[2]?.key ? null : key, hidden: v.hidden.filter((k) => k !== key) }))

  const compare = view.compare
  const isGrowth = chartType === 'growth'
  const showGrowthLabels = !compare && view.granularity === 'monthly' && chartType === 'line'
  const last = points.length - 1
  const isLine = chartType === 'line'
  // hovering a pill: line mode drops the others to 25%, bar/growth keep 30%
  // explain mode ("Why?"): the series the insight is about stay, the rest dim
  const explain = useExplain(`${chartType}|${view.granularity}|${view.range}|${view.compare}|${engine}|${YOU}|${view.swap}`)
  const dim = (key) => (hovered && hovered !== key ? (isLine ? 0.25 : 0.3) : 1) * (hlOpacity(explain, `series:${key}`) ?? 1)
  // points scored before the scoring change: lighter
  // (lines at 40%; bars as a 25% fill with a full-colour outline, so ink and the greys stay told apart)
  const early = (p) => (p?.beforeScoring ? (isLine ? 0.4 : 0.25) : 1)
  const g = h.growth
  const [plotRef, plotWidth] = useWidth()
  const gid = useId().replace(/:/g, '')
  const scoringAt = scoring?.at ?? null
  const dates = points.map((p) => p.date)

  // ---- shared plot furniture; returned as a keyed array so Recharts sees direct children
  const furniture = ({ yDomain, yTicks, yFormat, tooltip, cursor, xPadding, interval, gradients }) => [
    <CartesianGrid key="grid" vertical={false} stroke={chart.track} strokeWidth={1} />,
    // phones: at most 4 date labels, a 28px Y axis
    <XAxis key="x" dataKey="date" height={26} tickMargin={10} tickLine={false} axisLine={false} tick={tick} padding={xPadding} interval={interval ?? (mobile ? Math.max(0, Math.ceil(points.length / 4) - 1) : 'preserveEnd')} />,
    <YAxis key="y" width={mobile ? 30 : 36} tickMargin={mobile ? 4 : 8} domain={yDomain} ticks={yTicks} tickFormatter={yFormat} allowDataOverflow tickLine={false} axisLine={false} tick={tick} />,
    <Tooltip key="tip" cursor={cursor} content={tooltip} />,
    scoringAt != null && <ScoringMarker key="scoring" at={scoringAt} dates={dates} label={mobile ? scoring.label.replace('Scoring updated', 'Scoring') : scoring.label} gradients={gradients} />,
  ].filter(Boolean)
  // Line view: label inside the plot, right-aligned above the line. Bar/Growth: the last column reaches the right edge,
  // so the label sits just outside the plot at the end of the line (a right gutter is reserved for it).
  const avgLine = (y, text, outside = false) => (
    <ReferenceLine key="avg" y={y} stroke={chart.c3} strokeWidth={1} strokeDasharray="4 4"
      label={{ value: text, position: outside ? 'right' : 'insideBottomRight', offset: outside ? 8 : 6, fontSize: 12, fill: 'var(--color-stone-600)', className: 'num' }} />
  )
  const AVG_GUTTER = 84
  const shareTooltip = <HistoryTooltip series={series} compare={compare} unit={stats.unit} line={isLine} />
  // the same margins in every view, so Trend, Share and Growth draw the same plot height; the top margin holds the
  // value labels above a first sync's bars / growth bars and the scoring marker's label
  const margin = { top: 24, right: 8, bottom: 0, left: 0 }

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
    // a move across the scoring change is partly the new scoring: say so in the evidence
    const across = scoringAt != null && points[points.length - 2]?.beforeScoring && !end.beforeScoring
    const calc = [
      `${name}: ${d == null ? '' : `${end.prevs[YOU]}% → `}${end[YOU]}% (${end.date})`,
      leader && leader.key !== YOU ? `${brandName(leader.label)}: ${end[leader.key]}%, the highest share` : null,
      across ? `${scoring.label}: part of this move is the new scoring` : null,
    ].filter(Boolean).join('. ')
    return { text, evidence: { keys: [`series:${YOU}`, ...(leader && leader.key !== YOU ? [`series:${leader.key}`] : [])], calc: `${calc}.`, source: sourceLine(tracking) } }
  })()

  // ---- one real Recharts chart per type
  const renderChart = () => {
    if (chartType === 'line') {
      // trend: lines only (no fills). All lines 2.5px, round caps, full opacity; a dot on the last point only.
      // Before a scoring change each line is drawn lighter (a gradient set by ScoringMarker).
      const stroke = (s) => (scoringAt != null ? `url(#${gid}-${s.key})` : lineColor(s))
      return (
        <RLineChart data={points} margin={margin}>
          {furniture({ yDomain: domain, yTicks: ticks, tooltip: shareTooltip, cursor: { stroke: chart.c3, strokeWidth: 1 }, xPadding: { left: 16, right: 16 },
            gradients: series.map((s) => ({ id: `${gid}-${s.key}`, color: lineColor(s) })) })}
          {!compare && avgLine(stats.average, `Avg ${stats.average}%`)}
          {[...series].reverse().map((s) => {
            const you = s.key === YOU
            const c = lineColor(s)
            const dot = (p) => (p.index === last
              ? <circle key={`d${p.index}`} cx={p.cx} cy={p.cy} r={4} fill={c} stroke="var(--color-surface)" strokeWidth={2} opacity={dim(s.key)} />
              : <g key={`d${p.index}`} />)
            return (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={stroke(s)} strokeOpacity={dim(s.key)} strokeWidth={2.5} strokeLinecap="round"
                dot={dot} activeDot={{ r: 5, fill: c, stroke: 'var(--color-surface)', strokeWidth: 2 }} {...ANIM}>
                {you && showGrowthLabels && <LabelList dataKey="delta" content={GrowthLabel} />}
              </Line>
            )
          })}
        </RLineChart>
      )
    }
    if (chartType === 'bar') {
      // share per period: grouped bars (Compare on) / one bar (off), at most 4 per date. Each bar at most 20px wide
      // (phones 10), with at least a third of every date's slot left empty, so the dates read as groups. Values only in
      // the hover tooltip (a first sync's single group keeps its values above the bars).
      const plotW = Math.max(0, plotWidth - (mobile ? 30 : 36) - (compare ? margin.right : AVG_GUTTER))
      const barSize = groupedBarSize({ width: plotW, groups: points.length, bars: series.length, cap: single ? 44 : mobile ? 10 : 20, gap: 2 })
      return (
        <RBarChart data={points} barSize={barSize} barGap={2} margin={{ ...margin, right: compare ? margin.right : AVG_GUTTER }}>
          {furniture({ yDomain: domain, yTicks: ticks, tooltip: shareTooltip, cursor: { fill: chart.track, fillOpacity: 0.6, radius: 6 } })}
          {!compare && !single && avgLine(stats.average, `Avg ${stats.average}%`, true)}
          {series.map((s) => {
            const c = barFill(s)
            return (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={c.fill} fillOpacity={dim(s.key) * c.opacity} radius={[Math.min(4, barSize / 2), Math.min(4, barSize / 2), 0, 0]}
                animationDuration={200} animationEasing="ease-out">
                {points.map((p) => <Cell key={p.date} fillOpacity={dim(s.key) * c.opacity * early(p)} stroke={p.beforeScoring ? c.fill : 'none'} strokeOpacity={dim(s.key)} strokeWidth={1} />)}
                {single && <LabelList dataKey={s.key} content={TopValueLabel} />}
              </Bar>
            )
          })}
        </RBarChart>
      )
    }
    // growth per period: change vs previous period, on a round symmetric axis (−20, −10, 0, +10, +20)
    const avgText = `Avg ${g.average > 0 ? '+' : g.average < 0 ? '−' : ''}${Math.abs(g.average)}`
    const gPlotW = Math.max(0, plotWidth - (mobile ? 30 : 36) - AVG_GUTTER)
    const gBar = groupedBarSize({ width: gPlotW, groups: g.points.length, bars: series.length, cap: mobile ? 10 : 20, gap: 3 })
    return (
      <RBarChart data={g.points} barSize={gBar} barGap={3} margin={{ ...margin, right: AVG_GUTTER }}>
        {furniture({ yDomain: g.domain, yTicks: g.ticks, yFormat: fmtDelta, tooltip: <GrowthTooltip series={series} compare={compare} />, cursor: { fill: chart.track, fillOpacity: 0.6, radius: 6 } })}
        <ReferenceLine key="zero" y={0} stroke="var(--color-stone-600)" strokeOpacity={0.4} strokeWidth={1} />
        {!youHidden && avgLine(g.average, avgText, true)}
        {series.map((s) => {
          const you = s.key === YOU
          return (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={color(s)} fillOpacity={dim(s.key)} {...ANIM}
              shape={(props) => <GrowthBar {...props} value={props.payload[s.key]} you={you} fillOpacity={dim(s.key) * early(props.payload.values)} outline={props.payload.values?.beforeScoring ? dim(s.key) : 0} />}>
              {you && <LabelList dataKey={s.key} content={GrowthValueLabel} />}
            </Bar>
          )
        })}
      </RBarChart>
    )
  }

  // a series' mark: the line checkbox, or the bar / dot swatch (filled when shown, outlined when hidden)
  const marker = (s, shown) => (isLine
    ? <LegendBox color={lineColor(s)} checked={shown} />
    : <span className="h-2 w-2 shrink-0 rounded-full" style={chartType === 'bar'
      ? (shown ? { background: barFill(s).fill, opacity: barFill(s).opacity } : { boxShadow: `inset 0 0 0 1.5px ${barFill(s).fill}`, opacity: barFill(s).opacity })
      : (shown ? { background: color(s) } : { boxShadow: `inset 0 0 0 1.5px ${color(s)}` })} />)
  // one legend chip = a show/hide toggle for that series; small: the 13px step (FitChips)
  const chip = (s, small = false) => {
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
                  ? `inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2 ${small ? 'text-[13px] leading-[18px]' : 'text-[14px] leading-5'} outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-focus ${
                    shown ? 'font-medium text-stone-900' : 'font-normal text-stone-600'
                  }`
                  : `inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 ${small ? 'text-[13px] leading-[18px]' : 'text-[14px] leading-5'} outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${
                    shown ? 'bg-tint text-stone-900' : 'bg-transparent text-stone-600/60 hover:text-stone-600'
                  }`}
                title={lastOne ? 'At least one brand stays on the chart' : shown ? `Hide ${brandName(s.label)}` : `Show ${brandName(s.label)}`}
              >
                {marker(s, shown)}
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
            value={chartType}
            onChange={(chart) => update({ chart })}
            options={[
              ...(single ? [] : [{ value: 'line', label: 'Trend', icon: LineChart }]),
              { value: 'bar', label: 'Share per period', icon: BarChart3 },
              ...(single ? [] : [{ value: 'growth', label: 'Growth per period', icon: TrendingUp }]),
            ]}
          />
          <RangeSelect granularity={view.granularity} value={view.range} onChange={(range) => update({ range })} />
        </div>
      </div>

      {/* legend = filter: one line, never wrapped (FitChips). At most 4 brands: the brand + 3 competitors; the others
          are under "+N more", where picking one swaps it in for the 3rd */}
      <div className="mt-3 flex min-w-0 items-start">
        {/* top-aligned: when the chips wrap to a second line, Compare stays on the first */}
        <span className="flex h-8 shrink-0 items-center"><Switch checked={compare} onChange={setCompare} className="shrink-0">Compare</Switch></span>
        <span className="mx-3 mt-1.5 h-5 w-px shrink-0 bg-stone-200" aria-hidden />
        {compare ? (
          <FitChips
            items={[byKey(YOU), ...COMPETITORS]}
            extra={SWAPS.length}
            wrap={!mobile}
            measureKey={`${chartType}|${view.hidden.join(',')}|${view.swap}`}
            chip={chip}
            more={(rest, small) => <MoreChips rest={rest} small={small} hidden={view.hidden} marker={marker} onToggle={toggleHidden}
              swaps={SWAPS} swapOut={COMPETITORS[COMPETITORS.length - 1]} onSwap={swapIn} />}
          />
        ) : isLine ? (
          <span className="inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap px-1 text-[14px] leading-5 font-medium text-stone-900">
            <LegendBox color={chart.lineYou} checked /> {focal.name}
          </span>
        ) : (
          <span className="inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap px-1 text-small font-medium text-stone-900">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: chart.you }} /> {focal.name}
          </span>
        )}
      </div>

      {/* summary strip slides in when Compare is off */}
      <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${compare ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`} aria-hidden={compare}>
        <div className="overflow-hidden">
          <div className="flex flex-wrap gap-x-8 gap-y-2 pt-3">
            <Stat label="Current">{stats.current == null ? '—' : `${stats.current}%`}</Stat>
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
                {stats.best == null ? '—' : <>{stats.best}% <span className="text-[13px] font-normal text-stone-600">{stats.bestLabel?.startsWith('this') ? `· ${stats.bestLabel}` : `(${stats.bestLabel})`}</span></>}
              </Stat>
            )}
          </div>
        </div>
      </div>

      {/* phones / tablets: 180px. Desktop: fills whatever the row leaves (at least 200px), so there's no empty band
          between the axis and the insight; the same box in every chart type, so switching type never moves anything */}
      <div ref={plotRef} className="mt-3 h-[180px] min-h-0 lg:h-auto lg:min-h-[200px] lg:flex-1">
        {empty ? (
          <div className="grid h-full place-items-center rounded-lg bg-tint/50 px-4 text-center text-[13px] leading-[18px] text-stone-500">
            No visibility on record for this range yet.
          </div>
        ) : (
          <ResponsiveContainer key={`${chartType}-${view.granularity}-${view.compare}`} width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        )}
      </div>
      {single && <p className="mt-1 text-[12px] leading-4 text-stone-500">Showing your first sync. Trend lines appear after the next sync.</p>}

      {insight && <div className="mt-auto pb-3 pt-2"><Insight explain={explain} {...insight} /></div>}
    </Card>
  )
}
