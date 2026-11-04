import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart as RBarChart, CartesianGrid, Cell, LabelList, Line, LineChart as RLineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, usePlotArea, useXAxisScale, useYAxisScale } from 'recharts'
import { useIsMobile } from '../../hooks/useMedia'
import { BarChart3, Check, ChevronDown, LineChart, TrendingUp } from 'lucide-react'
import Card from './Card'
import { chart } from '../../theme/chart'
import { defaultRange, getHistory, historyManyPreview, historyRanges } from '../../data/mock'
import { historyMany } from '../../data/historyMany'
import { brandName } from '../../utils/brand'
import { drawnRivals, groupedBarSize, historyInsight, lonePoints as lonePointsOf, MAX_RIVALS, pickRival, picksFrom } from '../../utils/historyChart'
import Segmented from './Segmented'
import Switch from '../ui/Switch'
import SiteLogo from '../ui/SiteLogo'
import { useBrandView } from '../../hooks/useBrandView'
import Insight, { hlOpacity, useExplain } from '../ui/Insight'
import { sourceLine } from './insights'
import { useTracking } from '../../store/trackingSettings'
import { aiModeSplit, engineGaps, engineName, engineScale, hasResult, setupPreview } from '../../data/brandViews'
import NoResult from '../ui/NoResult'
import { useBrandColors } from '../../hooks/useBrandColors' // one colour per brand, the same as Share of voice

// colours follow the slots, set once per render by the card: the focal brand ("Viewing as") is ink; the 3 competitors
// drawn are slots 0–2 (by share, or as picked in "All N brands"). Trend and Share views: indigo, red,
// green. Growth view: the graphite steps c1–c3, since red there means a drop. Never more than 3 colours + ink.
let FOCAL = { key: null }
let SLOT = {} // series key → 0 | 1 | 2
const slotOf = (s) => SLOT[s.key] ?? 2
const color = (s) => (s.key === FOCAL.key ? chart.you : chart[`c${slotOf(s) + 1}`])
// the Overview's Trend and Share views (lines, bars, chips, tooltips) take each brand's palette colour by rank
// (utils/brandColors.js rankColors, the map Share of voice uses, the account's brand included); Growth keeps the graphite steps, and
// Reports (a dataset) the slot colours
let BRANDC = {} // series key → CSS colour, set per render
const lineColor = (s) => BRANDC[s.key] ?? (s.key === FOCAL.key ? chart.lineYou : chart[`line${slotOf(s) + 1}`])
const barColor = (s) => ({ fill: lineColor(s), opacity: 1 })
const ANIM = { animationDuration: 500, animationEasing: 'ease-out' }
// the unit of the values: '%' (share, the Overview) or a count (Reports: prompts named, prompts they win), set per render
let UNIT = { pct: true, one: 'point', many: 'points' }
const val = (v) => (v == null ? '—' : UNIT.pct ? `${v}%` : `${v}`) // no value (no result): "—", never "null%"
const units = (n) => `${n} ${Math.abs(n) === 1 ? UNIT.one : UNIT.many}`

// no fontFamily: ticks inherit --font-sans so they follow the font switcher
const tick = { fontSize: 13, fontWeight: 400, fill: 'var(--color-stone-500)', className: 'num' }

// ---- ALL view state lives in one object, mirrored to the URL so the view is shareable and survives refresh:
//      ?compare=off&hide=ordinary&period=monthly&chart=line&range=last-6m
const DEFAULT_VIEW = { compare: true, hidden: [], granularity: 'weekly', chart: 'line', range: defaultRange.weekly, picks: null }
// ?brands=a,b,c: the competitors on the chart, in slot order (none: the top 3 by share). An older link's ?swap=<key>
// still opens with that brand in the 3rd slot.
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
    picks: q.get('brands') ? q.get('brands').split(',').filter((k) => historySeries.some((c) => c.key === k))
      : historySeries.some((c) => c.key === q.get('swap')) ? { swap: q.get('swap') } : null,
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
  q.delete('swap')
  set('brands', Array.isArray(v.picks) ? v.picks.join(',') : '', '')
  const qs = q.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`)
}

// the range as a menu (the Brands menu's look): the neutral row tint on hover / focus and a check on the one picked,
// never the browser's own select colours (it showed a red fill). Esc, a click outside or Tab closes it; ↑↓ move.
function RangeSelect({ granularity, value, onChange }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const btn = useRef(null)
  const menu = useRef(null)
  const opts = historyRanges[granularity]
  const current = opts.find((r) => r.id === value) ?? opts[0]
  const ITEM = '[role=menuitemradio]'
  useEffect(() => {
    if (!open) return undefined
    ;(menu.current?.querySelector(`${ITEM}[aria-checked=true]`) ?? menu.current?.querySelector(ITEM))?.focus()
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
  const pick = (id) => { setOpen(false); btn.current?.focus(); if (id !== value) onChange(id) }
  return (
    <div ref={wrap} className="relative shrink-0" onKeyDown={open ? onKey : undefined}>
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Time range: ${current?.label}`} onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-raised pl-3.5 pr-3 text-small font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
        {current?.label}
        <ChevronDown size={13} className={`text-stone-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div ref={menu} role="menu" aria-label="Time range"
          className="absolute right-0 top-full z-30 mt-1 w-44 rounded-lg border border-line bg-raised p-1 shadow-md motion-safe:animate-[fade-in_120ms_ease-out]">
          {opts.map((r) => {
            const on = r.id === current?.id
            return (
              <button key={r.id} type="button" role="menuitemradio" aria-checked={on} onClick={() => pick(r.id)}
                className={`flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] leading-[18px] outline-none hover:bg-tint focus-visible:bg-tint ${on ? 'font-medium text-stone-900' : 'text-stone-600'}`}>
                <span className="min-w-0 flex-1">{r.label}</span>
                <Check size={14} strokeWidth={2.5} className={`shrink-0 text-ink ${on ? '' : 'invisible'}`} aria-hidden />
              </button>
            )
          })}
        </div>
      )}
    </div>
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

const fmtDelta = (d) => (d == null ? '—' : d > 0 ? `+${d}` : d < 0 ? `−${Math.abs(d)}` : '0') // a gap is "—", never 0
const listNames = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

function HistoryTooltip({ active, payload, label, series, compare, unit, line = false, lone = {} }) {
  if (!active || !payload?.length) return null
  const delta = payload[0]?.payload?.delta
  // line mode: vibrant swatches, 8px rounded-[2px], your row first at 500
  const YOU = FOCAL.key
  const rows = line ? [...series].sort((a, b) => (b.key === YOU) - (a.key === YOU)) : series
  return (
    <div className="rounded-lg border border-stone-200 bg-raised px-3 py-2 text-small shadow-sm">
      <div className="mb-1 font-semibold text-stone-900">{label}{payload[0]?.payload?.current ? ' · so far' : ''}</div>
      {rows.map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-6">
          <span className={`inline-flex items-center gap-1.5 ${line && s.key === YOU ? 'font-medium text-stone-900' : 'text-stone-600'}`}>
            {/* Trend and Share views share the colours */}
            {line
              ? <span className="h-2 w-2 rounded-[2px]" style={{ background: lineColor(s) }} />
              : <span className="h-2.5 w-2.5 rounded-sm" style={{ background: lineColor(s) }} />}
            {brandName(s.label)}
          </span>
          <span className={`num text-stone-900 ${line && s.key !== YOU ? 'font-normal' : 'font-semibold'}`}>{(() => { const v = payload[0]?.payload?.[s.key]; return v == null ? '—' : val(v) })()}</span>
        </div>
      ))}
      {/* why a brand with a single point has no earlier ones */}
      {series.filter((s) => lone[s.key] && lone[s.key].date === payload[0]?.payload?.date).map((s) => (
        <div key={`lone-${s.key}`} className="mt-1 max-w-[240px] border-t border-stone-100 pt-1 text-stone-600">{lone[s.key].why}</div>
      ))}
      {/* the engines left out of this period (they didn't run) */}
      {payload[0]?.payload?.notRun?.length > 0 && (
        <div className="mt-1 max-w-[240px] border-t border-stone-100 pt-1 text-stone-600">{listNames(payload[0].payload.notRun.map(engineName))} didn’t run</div>
      )}
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
      <span className={`num font-semibold ${p[s.key] == null ? 'text-stone-500' : s.key === YOU ? signClass(p[s.key]) : 'text-stone-900'}`}>{fmtDelta(p[s.key])}</span>{' '}
      {/* a period with no result (either side): no "a → b" */}
      {p[s.key] != null && <span className="num text-stone-600">({val(p.prevs[s.key])} → {val(p.values[s.key])})</span>}
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

// Growth bar: positive → rounded top; negative → rounded bottom (and red for "you"); zero → 2px stub on the zero line.
// solid on both sides of the scoring marker
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
  const c = neg && you ? 'var(--color-negative)' : fill
  return <path d={d} fill={c} fillOpacity={neg && you ? 0.85 * fillOpacity : fillOpacity} />
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
      {val(value)}
    </text>
  )
}

// the legend chips show every name in full (no ellipsis). Wider screens: 14px labels; if they don't fit on one
// line, 13px; then 13px with tighter padding and gaps (1280 with 4 brands); if they still don't, the row wraps to a second line (the chart takes the height that's left). Measured
// from off-screen copies at both sizes, again on resize and once the web fonts load. Phones: the chips scroll
// sideways, with a soft fade on the side(s) that have more. The "All N brands" menu stays at the end either way.
const CHIP_GAP = { md: 16, sm: 12, xs: 6 }
function ChipRow({ mobile, items, chip, menu, measureKey }) {
  const box = useRef(null)
  const probe = useRef(null)
  const menuRef = useRef(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  // the brand + its 3 competitors always show, whole: 14px; else 13px; else wrapped onto a second line. "+N more"
  // sits right after them.
  const [fit, setFit] = useState({ size: 'md', wrap: false })
  useLayoutEffect(() => {
    const el = box.current
    if (mobile || !el) return
    const measure = () => {
      if (!probe.current) return
      const widths = (size) => [...probe.current.querySelectorAll(`[data-probe="${size}"]`)].map((n) => n.getBoundingClientRect().width)
      const span = (w, size) => w.reduce((a, b) => a + b, 0) + CHIP_GAP[size] * Math.max(0, w.length - 1)
      const md = widths('md')
      const sm = widths('sm')
      const xs = widths('xs')
      const more = menuRef.current ? menuRef.current.getBoundingClientRect().width + CHIP_GAP.sm : 0
      const avail = el.clientWidth - more
      // whole names always: 14px, else 13px, else the row wraps to a second line (never cut)
      const next = span(md, 'md') <= avail ? { size: 'md', wrap: false }
        : span(sm, 'sm') <= avail ? { size: 'sm', wrap: false }
          : span(xs, 'xs') <= avail ? { size: 'xs', wrap: false }
            : { size: 'sm', wrap: true }
      setFit((f) => (f.size === next.size && f.wrap === next.wrap ? f : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    document.fonts?.ready.then(measure)
    return () => ro.disconnect()
  }, [mobile, measureKey, items.length])
  useLayoutEffect(() => {
    const el = box.current
    if (!mobile || !el) return
    const read = () => {
      const next = { left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 }
      setEdges((e) => (e.left === next.left && e.right === next.right ? e : next))
    }
    read()
    el.addEventListener('scroll', read, { passive: true })
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', read); ro.disconnect() }
  }, [mobile])
  const fade = mobile && (edges.left || edges.right)
    ? `linear-gradient(to right, ${edges.left ? 'transparent' : '#000'}, #000 24px, #000 calc(100% - 24px), ${edges.right ? 'transparent' : '#000'})`
    : undefined
  const small = mobile ? false : fit.size === 'xs' ? 'xs' : fit.size !== 'md'
  return (
    <div ref={box} style={fade ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
      className={`relative flex min-h-9 min-w-0 flex-1 items-center ${small === 'xs' ? 'gap-x-1.5' : small ? 'gap-x-3' : 'gap-x-4'} ${mobile ? 'overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : fit.wrap ? 'flex-wrap gap-y-1' : ''}`}>
      {items.map((s) => chip(s, small))}
      {menu && <span ref={menuRef} className="inline-flex shrink-0">{menu}</span>}
      {/* off-screen copies at both sizes, for the widths; clipped, so they never widen the page */}
      {!mobile && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div ref={probe} inert="" className="invisible absolute left-0 top-0 flex w-max whitespace-nowrap">
            {items.map((s) => <span key={`md-${s.key}`} data-probe="md" className="inline-flex">{chip(s, false, true)}</span>)}
            {items.map((s) => <span key={`sm-${s.key}`} data-probe="sm" className="inline-flex">{chip(s, true, true)}</span>)}
            {items.map((s) => <span key={`xs-${s.key}`} data-probe="xs" className="inline-flex">{chip(s, 'xs', true)}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}

// "Brands ▾" (a header control, after the range): every brand (logo, name, latest share) as a checklist of what's on
// the chart. At most 4: the brand (always on, locked) + 3 competitors. Checking a 4th competitor swaps out the last one,
// with a short note saying so.
function BrandsMenu({ brands, focalKey, drawn, onPick }) {
  const [open, setOpen] = useState(false)
  // a phone's header wraps, so the button can sit anywhere: the list opens toward the side with room, kept 16px inside
  const [place, setPlace] = useState({ left: false, shift: 0 })
  const [note, setNote] = useState('')
  const wrap = useRef(null)
  const btn = useRef(null)
  const menu = useRef(null)
  const ITEM = '[role=menuitemcheckbox]'
  useLayoutEffect(() => {
    if (!open || !menu.current || !btn.current) return
    const b = btn.current.getBoundingClientRect(), w = menu.current.offsetWidth
    if (b.right - w >= 16) setPlace({ left: false, shift: 0 })
    else setPlace({ left: true, shift: Math.min(0, window.innerWidth - 16 - (b.left + w)) })
  }, [open])
  useEffect(() => {
    if (!open) { setNote(''); return }
    menu.current?.querySelector(`${ITEM}:not([aria-disabled=true])`)?.focus()
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
  const name = (k) => brandName(brands.find((b) => b.key === k)?.label ?? k)
  const pick = (key) => {
    const r = pickRival(drawn, key)
    if (r.drawn === drawn) { setNote('At least one competitor stays on the chart'); return }
    onPick(r.drawn)
    setNote(r.out ? `Showing ${name(key)} instead of ${name(r.out)}. Up to 4 brands at a time.` : '')
  }
  return (
    <div ref={wrap} className="relative shrink-0" onKeyDown={open ? onKey : undefined}>
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        aria-label={`Brands: ${brands.length} brands, pick up to 4 for the chart`}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-raised pl-3.5 pr-3 text-small font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
        Brands
        <ChevronDown size={13} className={`text-stone-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div ref={menu} role="menu" aria-label="Brands on the chart" style={place.shift ? { transform: `translateX(${place.shift}px)` } : undefined}
          className={`absolute ${place.left ? 'left-0' : 'right-0'} top-full z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-line bg-raised p-1 shadow-md motion-safe:animate-[fade-in_120ms_ease-out]`}>
          <div className="px-2 pb-1 pt-1.5 text-[12px] leading-4 text-stone-500">Up to 4 on the chart</div>
          {brands.map((b) => {
            const you = b.key === focalKey
            const on = you || drawn.includes(b.key)
            return (
              <button key={b.key} type="button" role="menuitemcheckbox" aria-checked={on} aria-disabled={you || undefined}
                onClick={() => !you && pick(b.key)} title={brandName(b.label)}
                className={`flex min-h-9 w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] leading-[18px] outline-none focus-visible:bg-tint ${you ? 'cursor-default' : 'hover:bg-tint'} ${on ? 'text-stone-900' : 'text-stone-600'}`}>
                <span aria-hidden className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] ${on ? (you ? 'bg-stone-400' : 'bg-ink') : ''}`}
                  style={on ? undefined : { boxShadow: 'inset 0 0 0 1.5px var(--color-stone-500)' }}>
                  {on && <Check size={12} strokeWidth={3} style={{ color: 'var(--line-check)' }} />}
                </span>
                <SiteLogo domain={b.label} name={brandName(b.label)} className="h-5 w-5 shrink-0 rounded" initialClass="text-[10px]" />
                <span className={`min-w-0 flex-1 truncate ${on ? 'font-medium' : ''}`}>{brandName(b.label)}{you && <span className="font-normal text-stone-500"> · you</span>}</span>
                <span className="num shrink-0 pl-2 text-stone-500">{val(b.share)}</span>
              </button>
            )
          })}
          <div aria-live="polite" className={note ? 'mx-1 mt-1 border-t border-line px-1 pb-1 pt-2 text-[12px] leading-4 text-stone-600' : 'sr-only'}>{note}</div>
        </div>
      )}
    </div>
  )
}

// "Scoring updated Oct 21": a dashed line on the x axis where the scoring changed, its label in the plot's top margin
// (left of the line near the right edge). `at` is in point-index units (3.29 = between the 4th and 5th dates).
// hovering the line or its label opens the explanation (onHover gets its position, or null)
// a 12px label's width (Manrope, tabular figures), close enough to decide whether two labels collide
const labelW = (text) => Math.ceil(text.length * 6.6) + 4
function ScoringMarker({ at, dates, label, onHover, avoidAt = null, avoidLabel = '' }) {
  const scale = useXAxisScale()
  const plot = usePlotArea()
  if (at == null || !scale || !plot) return null
  const i = Math.floor(at)
  const x0 = scale(dates[i], { position: 'middle' })
  const x1 = scale(dates[i + 1], { position: 'middle' })
  if (x0 == null) return null
  // at the last point (a change after the latest scan): at the plot's right edge
  const x = x1 == null ? plot.x + plot.width - 1 : x0 + (x1 - x0) * (at - i)
  const right = x > plot.x + plot.width * 0.6
  // another marker's label close by (the scoring change next to a setup change): this one keeps its line and
  // tooltip, without a label on top of the other
  const otherX = avoidAt == null ? null : (() => {
    const j = Math.floor(avoidAt)
    const a0 = scale(dates[j], { position: 'middle' })
    const a1 = scale(dates[j + 1], { position: 'middle' })
    return a0 == null ? null : a1 == null ? plot.x + plot.width - 1 : a0 + (a1 - a0) * (avoidAt - j)
  })()
  // both labels always show; when they'd touch (their spans, each drawn toward the plot's middle), this one's label
  // sits a line higher (stacked), at every width
  const span = (cx, text) => { const w = labelW(text); return cx > plot.x + plot.width * 0.6 ? [cx - 6 - w, cx - 6] : [cx + 6, cx + 6 + w] }
  const stacked = otherX != null && (() => { const [a0, a1] = span(x, label), [b0, b1] = span(otherX, avoidLabel || label); return a0 < b1 + 12 && b0 < a1 + 12 })()
  const labelY = plot.y - 8 - (stacked ? 18 : 0) // 18: a 12px label's full box, so stacked labels never touch
  const enter = () => onHover?.({ x, y: plot.y, right, kind: 'scoring' })
  const leave = () => onHover?.(null)
  return (
    <g>
      <line className="pointer-events-none" x1={x} x2={x} y1={labelY + 4} y2={plot.y + plot.height} stroke="var(--color-stone-400)" strokeWidth={1} strokeDasharray="3 3" />
      <text className="pointer-events-none num" x={right ? x - 6 : x + 6} y={labelY} textAnchor={right ? 'end' : 'start'} fontSize={12} fill="var(--color-stone-500)">{label}</text>
      {/* hover targets: a strip along the line and the label */}
      <rect x={x - 6} y={plot.y - 4} width={12} height={plot.height + 4} fill="transparent" style={{ pointerEvents: 'all' }} onMouseEnter={enter} onMouseLeave={leave} />
      <rect x={right ? x - labelW(label) - 6 : x} y={labelY - 14} width={labelW(label) + 6} height={18} fill="transparent" style={{ pointerEvents: 'all' }} onMouseEnter={enter} onMouseLeave={leave} />
    </g>
  )
}

// compact (Reports): the labels at the right of the plot (each line's latest value, Avg, Best), placed with the chart's
// own y scale, so they sit exactly on their line; labels that would overlap are stacked 4px apart
function GutterLabels({ items }) {
  const y = useYAxisScale()
  const plot = usePlotArea()
  if (!y || !plot) return null
  const LH = 12, GAP = 4
  const placed = items.filter((i) => i.v != null).map((i) => ({ ...i, y: y(i.v) })).sort((a, b) => a.y - b.y)
  for (let k = 1; k < placed.length; k++) if (placed[k].y - placed[k - 1].y < LH + GAP) placed[k].y = placed[k - 1].y + LH + GAP
  const over = placed.length ? placed.at(-1).y - (plot.y + plot.height + 4) : 0
  if (over > 0) placed.forEach((p) => { p.y -= over })
  return (
    <g className="pointer-events-none">
      {placed.map((p) => <text key={p.key} x={plot.x + plot.width + 8} y={p.y + 4} fontSize={12} fontWeight={p.weight ?? 400} fill={p.color ?? 'var(--color-stone-600)'} className="num">{p.text}</text>)}
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

// Props (all optional; the Overview passes none): Reports reuse the card for one metric of one report.
//   dataset   { focal, series, weekly, monthly, unit?: 'count', one?, many? }: the data, in historyMany's shape
//   syncUrl   false: the view lives in the card only (the report's URL has its own period)
//   initial   the view it opens on ({ compare, chart, granularity, range, picks })
//   bare      no card chrome (it sits under the report's KPI tabs); title / subtitle: the heading
//   plotClass the plot's height; note: the line under a single sync
// compact (Reports): no title / subtitle (the KPI tab above says them); the toggle, chips and controls on one row; the
// best value as a dashed line; 4 round y ticks fitted to the data
// 4 round ticks fitted to the values with ~15% headroom (compact; the Overview keeps its own axis)
export function fit4(values) {
  const lo0 = Math.min(...values), hi0 = Math.max(...values)
  const pad = Math.max((hi0 - lo0) * 0.15, 1)
  const lo = Math.max(0, lo0 - pad), hi = hi0 + pad
  const p = 10 ** Math.floor(Math.log10(Math.max((hi - lo) / 3, 0.1)))
  for (const m of [1, 2, 2.5, 5, 10, 20]) {
    const step = m * p
    // the values are counts (prompts): whole-number steps only (12.5 / 17.5 also lost their first digit to the axis)
    if (!Number.isInteger(step)) continue
    const bottom = Math.floor(lo / step) * step
    if (bottom + 3 * step >= hi) return { domain: [bottom, bottom + 3 * step], ticks: [0, 1, 2, 3].map((i) => Math.round((bottom + i * step) * 100) / 100) }
  }
  return { domain: [0, hi], ticks: [0, hi / 3, (2 * hi) / 3, hi].map(Math.round) }
}

export default function VisibilityHistory({ dataset: given = null, syncUrl = true, initial = null, bare = false, title = 'Visibility history', subtitle = null, plotClass = null, note = null, compact = false } = {}) {
  const mobile = useIsMobile()
  const view0 = useBrandView()
  // ?history=many: the 6-competitor preview brand (data/historyMany.js) in place of the dashboard's brand, this card only
  const dataset = given ?? (historyManyPreview ? historyMany : null)
  UNIT = dataset?.unit === 'count' ? { pct: false, one: dataset.one ?? 'prompt', many: dataset.many ?? 'prompts' } : { pct: true, one: 'point', many: 'points' }
  const { focal, isOwnBrand, engine } = dataset ? { focal: dataset.focal, isOwnBrand: true, engine: 'all' } : view0
  const historySeries = useMemo(() => (dataset ? dataset.series : getHistory().series), [dataset])
  FOCAL = { key: focal.key }
  const brandColors = useBrandColors(engine)
  // every brand its palette colour by rank, the same map as Share of voice (owner, 2026-11-03)
  BRANDC = dataset ? {} : Object.fromEntries(historySeries.map((x) => [x.key, brandColors[x.label]?.css]).filter(([, c]) => c))
  const YOU = focal.key
  const [view, setView] = useState(() => (syncUrl ? readView(historySeries) : { ...DEFAULT_VIEW, ...initial }))
  const [hovered, setHovered] = useState(null) // series key highlighted from the legend
  const [markerTip, setMarkerTip] = useState(null) // the scoring marker's explanation, while hovered
  useEffect(() => { if (syncUrl) writeView(view) }, [view, syncUrl])

  // competitors by share (highest first); the top 3 are drawn unless others were picked in "All N brands"
  const ranked = historySeries.filter((s) => s.key !== YOU).sort((a, b) => b.share - a.share)
  const rankedKeys = ranked.map((s) => s.key)
  const drawn = view.picks?.swap ? drawnRivals(rankedKeys, view.picks.swap).drawn : picksFrom(rankedKeys, view.picks, MAX_RIVALS)
  const notDrawn = rankedKeys.filter((k) => !drawn.includes(k))
  const byKey = (k) => historySeries.find((s) => s.key === k)
  const COMPETITORS = drawn.map(byKey) // the competitors on the chart (and in the legend), in slot order
  SLOT = Object.fromEntries(drawn.map((k, i) => [k, i]))

  // the chart reads ONLY this. Brands not picked are left out like hidden ones.
  // engine filter: every series is that engine's share
  const h = useMemo(
    () => getHistory({ ...view, hidden: [...view.hidden, ...notDrawn], focal: YOU, dataset, scale: engine === 'all' ? null : engineScale(engine), gaps: dataset ? [] : engineGaps(engine), scoring: dataset ? null : aiModeSplit(engine)?.scoring ?? null, setup: dataset ? setupPreview(dataset.weekly, dataset.monthly) : setupPreview() }),
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
  const { points, series, stats, youHidden, scoring, bridges = [] } = h // bridges over missing periods
  const vals = points.flatMap((p) => series.map((x) => p[x.key])).filter((v) => v != null)
  // compact (Reports): a share is always 0–100%; a count is fitted to its values, its top a round number just above the largest
  const { domain, ticks } = compact && vals.length ? (UNIT.pct ? { domain: [0, 100], ticks: [0, 25, 50, 75, 100] } : fit4(vals)) : h
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
  // "All N brands" → the competitors on the chart (a newly picked one shows, even if it was hidden before)
  const setPicks = (next) => setView((v) => ({
    ...v,
    picks: next.join(',') === rankedKeys.slice(0, MAX_RIVALS).join(',') ? null : next,
    hidden: v.hidden.filter((k) => k === YOU || (next.includes(k) && drawn.includes(k))),
  }))

  const compare = view.compare
  const isGrowth = chartType === 'growth'
  // the change view with fewer than 2 periods to compare: a note instead of a lone bar
  const noChange = isGrowth && !empty && (h.growth?.points?.length ?? 0) < 2
  const showGrowthLabels = !compare && view.granularity === 'monthly' && chartType === 'line'
  const last = points.length - 1
  const isLine = chartType === 'line'
  // hovering a pill: line mode drops the others to 25%, bar/growth keep 30%
  // explain mode ("Why?"): the series the insight is about stay, the rest dim
  const explain = useExplain(`${chartType}|${view.granularity}|${view.range}|${view.compare}|${engine}|${YOU}|${drawn.join(',')}`)
  const dim = (key) => (hovered && hovered !== key ? (isLine ? 0.25 : 0.3) : 1) * (hlOpacity(explain, `series:${key}`) ?? 1)
  // points scored before the scoring change are drawn like every other point (solid, full colour); the marker
  // alone shows where the scoring changed
  const g = h.growth
  // brands with a single point in range: that point is drawn with its value, the tooltip says why it's alone
  const lonePoints = lonePointsOf(points, series, stats.unit, (s) => brandName(s.label))
  const [plotRef, plotWidth] = useWidth()
  const scoringAt = scoring?.at ?? null
  const dates = points.map((p) => p.date)

  // ---- shared plot furniture; returned as a keyed array so Recharts sees direct children
  const furniture = ({ yDomain, yTicks, yFormat, tooltip, cursor, xPadding, interval }) => [
    <CartesianGrid key="grid" vertical={false} stroke={chart.track} strokeWidth={1} />,
    // phones: at most 4 date labels, a 28px Y axis
    <XAxis key="x" dataKey="date" height={26} tickMargin={10} tickLine={false} axisLine={false} tick={tick} padding={xPadding} interval={interval ?? (mobile ? Math.max(0, Math.ceil(points.length / 4) - 1) : 'preserveEnd')} />,
    <YAxis key="y" width={mobile ? 30 : 36} tickMargin={mobile ? 4 : 8} domain={yDomain} ticks={yTicks} tickFormatter={yFormat} allowDataOverflow tickLine={false} axisLine={false} tick={tick} />,
    // filterNull off: a period with no result (null on every series) still gets its tooltip, reading "—"
    <Tooltip key="tip" cursor={cursor} content={tooltip} filterNull={false} {...(markerTip ? { active: false } : {})} />,
    scoringAt != null && <ScoringMarker key="scoring" at={scoringAt} dates={dates} label={mobile ? scoring.label.replace('Scoring updated', 'Scoring') : scoring.label} onHover={setMarkerTip} />,
    // a Brand Setup change (it applies from the next scan; earlier points stay as they were scored)
    h.setupChange && <ScoringMarker key="setup" at={h.setupChange.at ?? dates.length - 1} dates={dates} label={mobile ? h.setupChange.label.replace('Setup changed', 'Setup') : h.setupChange.label} onHover={(t) => setMarkerTip(t && { ...t, kind: 'setup' })} avoidAt={scoringAt} avoidLabel={scoring ? (mobile ? scoring.label.replace('Scoring updated', 'Scoring') : scoring.label) : ''} />,
  ].filter(Boolean)
  // Line view: label inside the plot, right-aligned above the line. Bar/Growth: the last column reaches the right edge,
  // so the label sits just outside the plot at the end of the line (a right gutter is reserved for it).
  const avgLine = (y, text, outside = false) => (
    <ReferenceLine key="avg" y={y} stroke={chart.c3} strokeWidth={1} strokeDasharray="4 4"
      label={compact ? undefined : { value: text, position: outside ? 'right' : 'insideBottomRight', offset: outside ? 8 : 6, fontSize: 12, fill: 'var(--color-stone-600)', className: 'num' }} />
  )
  // compact: the best value as a dashed reference line, like Avg ("Best 111 · this week")
  // only when the best was in an earlier week; when the latest is the best, its end label says "· best" instead
  const bestNow = stats.best != null && (stats.best === stats.current || stats.bestLabel?.startsWith('this'))
  const bestLine = (y) => (y == null || bestNow ? null : <ReferenceLine key="best" y={y} stroke={chart.c2} strokeWidth={1} strokeDasharray="2 4" />)
  const bestText = stats.best == null || bestNow ? null : `Best ${val(stats.best)} · ${stats.bestLabel?.replace(/^\(|\)$/g, '').replace(/, 2026$/, '')}`
  const refLabels = () => [
    ...(!compare ? [{ key: 'avg', v: stats.average, text: `Avg ${val(stats.average)}` }] : []),
    ...(!compare && bestText ? [{ key: 'best', v: stats.best, text: bestText }] : []),
  ]
  const AVG_GUTTER = compact ? 112 : 84
  const shareTooltip = <HistoryTooltip series={series} compare={compare} unit={stats.unit} line={isLine} lone={lonePoints} />
  // the same margins in every view, so Trend, Share and Growth draw the same plot height; the top margin holds the
  // value labels above a first sync's bars / growth bars and the scoring marker's label
  // room for two stacked marker labels when the scoring and setup changes sit close together
  const margin = { top: scoring && h.setupChange ? 42 : 24, right: compact ? 112 : 8, bottom: 0, left: 0 }
  // lines lying on top of each other (within 1 point at every point, so only one would show): each one in the
  // group redrawn on top in turn-taking dashes (its colour, then the next one's), so every colour shows
  const overlaps = (() => {
    const close = (x, y) => (x == null && y == null) || (x != null && y != null && Math.abs(x - y) <= 1)
    const same = (a, b) => points.every((p) => close(p[a.key], p[b.key])) && points.some((p) => p[a.key] != null)
    const seen = new Set()
    const out = []
    for (const s of series) {
      if (seen.has(s.key)) continue
      const group = series.filter((o) => !seen.has(o.key) && (o === s || same(s, o)))
      group.forEach((o) => seen.add(o.key))
      if (group.length > 1) group.forEach((o, k) => out.push({ s: o, k, n: group.length }))
    }
    return out
  })()

  // insight: one plain line about the end of the range: who leads and the focal brand's share (its move when the
  // period before was counted the same way). The brands on the chart only; no methodology (that's in the scoring
  // marker's tooltip). "Finance of America leads at 60% this month, ahead of Reverse at 28%."
  const tracking = useTracking()
  const insight = (() => {
    // a scoring change (or the AI Mode split) between the last two points: the period before was counted another way,
    // so the line states where things are and compares nothing across it (the marker's tooltip says so)
    const last = points[points.length - 1]
    const crossed = last && scoringAt != null && scoringAt > points.length - 2
    const end = crossed ? { ...last, deltas: {}, prevs: {}, delta: null } : last
    if (given) {
      // Reports: a number with one line (prompts missing, prompts they win): the sentence names the number, not the
      // brand, and says nothing about who leads
      if (!end || end[YOU] == null) return null
      const single = historySeries.length < 2
      const name = single && title ? title : focal.name
      const d = end.deltas?.[YOU]
      const move = d == null ? `is at ${val(end[YOU])}` : d > 0 ? `rose ${units(d)}` : d < 0 ? `fell ${units(-d)}` : 'held steady'
      const when = d == null ? '' : ` this ${stats.unit}`
      const top = (p, get) => historySeries.filter((x) => get(p, x) != null).sort((a, b) => get(p, b) - get(p, a))[0]
      const leader = single ? null : top(end, (p, x) => p[x.key])
      const before = end.prevs ? top(end, (p, x) => p.prevs[x.key]) : null
      const leads = leader && (before && before.key === leader.key ? 'still leads' : before ? 'now leads' : 'leads')
      const text = !leader ? `${name} ${move}${when}.`
        : leader.key === YOU ? `${name} ${move}${when} and ${leads}.`
          : `${name} ${move}${when}. ${brandName(leader.label)} ${leads}.`
      const calc = [
        `${name}: ${d == null ? '' : `${val(end.prevs[YOU])} → `}${val(end[YOU])} (${end.date})`,
        leader && leader.key !== YOU ? `${brandName(leader.label)}: ${val(end[leader.key])}, the highest${UNIT.pct ? ' share' : ''}` : null,
      ].filter(Boolean).join('. ')
      return { text, evidence: { keys: [`series:${YOU}`, ...(leader && leader.key !== YOU ? [`series:${leader.key}`] : [])], calc: `${calc}.`, source: tracking?.schedule?.lastSync ? sourceLine(tracking) : null } } // with no last sync on record (the app's Reports): no source line
    }
    const r = historyInsight({ end, series, youKey: YOU, name: focal.name, unit: stats.unit, nameOf: (x) => brandName(x.label) })
    if (!r) return null
    const d = end.deltas?.[YOU]
    const calc = [
      `${focal.name}: ${d == null ? '' : `${end.prevs[YOU]}% → `}${end[YOU]}% (${end.date})`,
      r.other ? `${brandName(r.other.label)}: ${end[r.other.key]}%` : null,
    ].filter(Boolean).join('. ')
    return { text: r.text, evidence: { keys: [`series:${YOU}`, ...(r.other ? [`series:${r.other.key}`] : [])], calc: `${calc}.`, source: sourceLine(tracking) } }
  })()

  // ---- one real Recharts chart per type
  const renderChart = () => {
    if (chartType === 'line') {
      // compact: weekly syncs are straight segments; monthly a monotone curve through every point
      const curve = compact ? (view.granularity === 'monthly' ? 'monotoneX' : 'linear') : 'monotone'
      // trend: lines only (no fills). All lines 2.5px, round caps, full opacity; a dot on the last point only (and on a
      // brand's only point). Solid on both sides of a scoring change
      return (
        <RLineChart data={points} margin={margin}>
          {furniture({ yDomain: domain, yTicks: ticks, tooltip: shareTooltip, cursor: { stroke: chart.c3, strokeWidth: 1 }, xPadding: { left: 16, right: 16 } })}
          {!compare && avgLine(stats.average, `Avg ${val(stats.average)}`)}
          {compact && !compare && bestLine(stats.best)}
          {compact && (
            <GutterLabels items={[
              ...series.map((s) => {
                const lastV = [...points].reverse().find((p) => p[s.key] != null)?.[s.key]
                return { key: `end-${s.key}`, v: lastV, text: `${val(lastV)}${s.key === YOU && bestNow && !compare ? ' · best' : ''}`, color: lineColor(s), weight: s.key === YOU ? 600 : 500 }
              }),
              ...refLabels(),
            ]} />
          )}
          {/* a missing period between two with values: a dashed segment across it, not a jump */}
          {bridges.filter((g) => series.some((s) => s.key === g.series)).map((g) => {
            const s = series.find((x) => x.key === g.series)
            return <Line key={g.key} type="linear" dataKey={g.key} connectNulls stroke={lineColor(s)} strokeOpacity={dim(s.key)} strokeWidth={1.5} strokeDasharray="4 4"
              dot={false} activeDot={false} legendType="none" isAnimationActive={false} />
          })}
          {[...series].reverse().map((s) => {
            const you = s.key === YOU
            const c = lineColor(s)
            // a brand with a single point in range gets that point drawn, with its value above it
            const lone = lonePoints[s.key]
            // compact (Reports): a 3px dot on every sync; the Overview: the last point (and a lone point) only
            const dot = (p) => (compact
              ? (p.value != null ? <circle key={`d${p.index}`} cx={p.cx} cy={p.cy} r={3} fill={c} opacity={dim(s.key)} /> : <g key={`d${p.index}`} />)
              : p.value != null && (p.index === last || p.index === lone?.index)
                ? <g key={`d${p.index}`} opacity={dim(s.key)}>
                    <circle cx={p.cx} cy={p.cy} r={4} fill={c} stroke="var(--color-surface)" strokeWidth={2} />
                  </g>
                : <g key={`d${p.index}`} />)
            return (
              <Line key={s.key} type={curve} dataKey={s.key} name={s.label} stroke={c} strokeOpacity={dim(s.key)} strokeWidth={2.5} strokeLinecap="round"
                dot={dot} activeDot={{ r: 5, fill: c, stroke: 'var(--color-surface)', strokeWidth: 2 }} {...ANIM}>
                {you && showGrowthLabels && <LabelList dataKey="delta" content={GrowthLabel} />}
              </Line>
            )
          })}
          {/* lines on top of each other: each one drawn again on top in turn-taking dashes, so every colour shows */}
          {overlaps.map(({ s, k, n }) => (
            // keyed on the lines and the data, so it mounts again after them: the chart stacks lines in mount order
            <Line key={`${s.key}~over~${series.map((x) => x.key).join(',')}`} type={curve} dataKey={s.key} stroke={lineColor(s)} strokeOpacity={dim(s.key)} strokeWidth={2.5}
              strokeDasharray={`0 ${8 * k} 8 ${8 * (n - 1 - k)}`}
              dot={false} activeDot={false} legendType="none" tooltipType="none" isAnimationActive={false} />
          ))}
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
          {!compare && !single && avgLine(stats.average, `Avg ${val(stats.average)}`, true)}
          {compact && !compare && !single && bestLine(stats.best)}
          {compact && !single && <GutterLabels items={refLabels()} />}
          {series.map((s) => {
            const c = barFill(s)
            return (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={c.fill} fillOpacity={dim(s.key) * c.opacity} radius={[Math.min(4, barSize / 2), Math.min(4, barSize / 2), 0, 0]}
                animationDuration={200} animationEasing="ease-out">
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
        {compact && !youHidden && <GutterLabels items={[{ key: 'avg', v: g.average, text: avgText }]} />}
        {series.map((s) => {
          const you = s.key === YOU
          return (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={color(s)} fillOpacity={dim(s.key)} {...ANIM}
              shape={(props) => <GrowthBar {...props} value={props.payload[s.key]} you={you} fill={color(s)} fillOpacity={dim(s.key)} />}>
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
  // one legend chip = a show/hide toggle for that series; the full name always (small: the 13px step, ChipRow).
  // probe: an off-screen copy, only measured
  const chip = (s, small = false, probe = false) => {
    const shown = !view.hidden.includes(s.key)
    const lastOne = shown && series.length === 1 // the last visible series can't be hidden
    if (probe) {
      return (
        <span key={s.key} className={`inline-flex h-8 shrink-0 items-center ${small === 'xs' ? 'gap-1.5 px-1' : `gap-2 ${isLine ? 'px-2' : 'px-3'}`} whitespace-nowrap font-medium ${small ? 'text-[13px] leading-[18px]' : 'text-[14px] leading-5'}`}>
          {marker(s, shown)}{brandName(s.label)}
        </span>
      )
    }
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
                  ? `inline-flex h-8 min-w-0 shrink-0 items-center whitespace-nowrap rounded-md ${small === 'xs' ? 'gap-1.5 px-1' : 'gap-2 px-2'} ${small ? 'text-[13px] leading-[18px]' : 'text-[14px] leading-5'} outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-focus ${
                    shown ? 'font-medium text-stone-900' : 'font-normal text-stone-600'
                  }`
                  : `inline-flex h-8 min-w-0 shrink-0 items-center whitespace-nowrap rounded-full ${small === 'xs' ? 'gap-1.5 px-2' : 'gap-2 px-3'} ${small ? 'text-[13px] leading-[18px]' : 'text-[14px] leading-5'} outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${
                    shown ? 'bg-tint font-medium text-stone-900' : 'bg-transparent font-medium text-stone-600/60 hover:text-stone-600'
                  }`}
                aria-label={`${brandName(s.label)}: ${shown ? 'shown' : 'hidden'}`}
                title={lastOne ? `${brandName(s.label)} · at least one brand stays on the chart` : shown ? `Hide ${brandName(s.label)}` : `Show ${brandName(s.label)}`}
              >
                {marker(s, shown)}
                <span>{brandName(s.label)}</span>
              </button>
    )
  }

  // legend = filter: the Compare toggle and the brand chips (compact: on the controls' row). Top-aligned: when the chips
  // wrap to a second line, Compare stays on the first
  const legend = (
    <div className={`flex min-h-9 min-w-0 items-start ${compact ? 'flex-1' : 'mt-3'}`}>
      <span className="flex h-9 shrink-0 items-center"><Switch checked={compare} onChange={setCompare} className="shrink-0">Compare</Switch></span>
      <span className="mx-3 mt-2 h-5 w-px shrink-0 bg-stone-200" aria-hidden />
      {compare ? (
        <ChipRow mobile={mobile} measureKey={`${chartType}|${drawn.join(',')}|${view.hidden.join(',')}`} items={[byKey(YOU), ...COMPETITORS]} chip={chip} />
      ) : (
        <span className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap px-1 text-[14px] leading-5 font-medium text-stone-900">
          <LegendBox color={byKey(YOU) ? lineColor(byKey(YOU)) : chart.lineYou} checked /> {focal.name}
        </span>
      )}
    </div>
  )

  return (
    // the same card for every brand (its height doesn't follow the row's other card)
    <Card ref={explain.cardRef} id={bare ? undefined : 'history'} bare={bare} className={bare ? 'flex min-w-0 flex-col' : 'flex h-full min-w-0 scroll-mt-6 flex-col px-5 pt-5'}>
      <div className={`flex flex-wrap justify-between gap-x-6 gap-y-3 ${compact ? 'items-center' : 'items-start'}`}>
        {compact ? legend : <div className="min-w-0">
          <h2 className="whitespace-nowrap text-title font-semibold text-stone-900">{title}</h2>
          <p className="mt-0.5 text-[13px] leading-[18px] font-normal text-stone-600">{subtitle ?? <>{isOwnBrand
            ? (!compare ? 'Your share of prompts over time' : youHidden ? 'Competitors’ share of prompts' : 'Your share of prompts vs competitors')
            : (!compare ? `${focal.name}’s share over time` : youHidden ? 'Other brands’ share of prompts' : `${focal.name} vs other brands`)}
            {engine !== 'all' && ` · ${engineName(engine)}`}
            {/* the engines left out of the latest period */}
            {points.at(-1)?.notRun?.length > 0 && ` · ${listNames(points.at(-1).notRun.map(engineName))} didn’t run this ${stats.unit}`}
          </>}</p>
        </div>}
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
          {compare && notDrawn.length > 0 && <BrandsMenu brands={[byKey(YOU), ...ranked]} focalKey={YOU} drawn={drawn} onPick={setPicks} />}
        </div>
      </div>

      {/* legend = filter. At most 4 brands: the brand + 3 competitors; "Brands" in the header picks which (checking a
          4th competitor swaps out the last one). names stay whole, the row wraps rather than cutting them */}
      {!compact && legend}

      {/* summary strip slides in when Compare is off (compact, Reports: the KPI tab above says these) */}
      {!compact && <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${compare ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`} aria-hidden={compare}>
        <div className="overflow-hidden">
          <div className="flex flex-wrap gap-x-8 gap-y-2 pt-3">
            {/* the engine shown had no result in the latest scan: "—" muted with the ⓘ (and no Change) */}
            <Stat label="Current">{stats.current != null ? val(stats.current) : !dataset && !hasResult(engine) ? <NoResult engine={engine} /> : '—'}</Stat>
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
                {stats.best == null ? '—' : <>{val(stats.best)} <span className="text-[13px] font-normal text-stone-600">{stats.bestLabel?.startsWith('this') ? `· ${stats.bestLabel}` : `(${stats.bestLabel})`}</span></>}
              </Stat>
            )}
          </div>
        </div>
      </div>}

      {/* the same box in every chart type, so switching type never moves anything */}
      {/* phones 180px; desktop at least 240px (200px on screens 800px tall or less, owner 2026-11-03: the next
          row peeks above the fold), and the chart takes whatever height the row gives the card (the insight stays at
          the bottom), so the cards in a row end level with no gap under either */}
      <div ref={plotRef} className={`relative mt-3 ${plotClass ?? 'h-[180px] min-h-0 lg:h-auto lg:min-h-[240px] lg:[@media(max-height:800px)]:min-h-[200px] lg:flex-1'}`}>
        {empty || noChange ? (
          <div className="grid h-full place-items-center rounded-lg bg-tint/50 px-4 text-center text-[13px] leading-[18px] text-stone-500">
            {empty ? 'No visibility on record for this range yet.' : 'Not enough history to show change yet'}
          </div>
        ) : (
          <ResponsiveContainer key={`${chartType}-${view.granularity}-${view.compare}`} width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        )}
        {/* the scoring marker's explanation, while its line or label is hovered */}
        {markerTip && (markerTip.kind === 'setup' ? h.setupChange : scoring) && !noChange && (
          <div role="tooltip" style={markerTip.right ? { right: `calc(100% - ${markerTip.x - 8}px)`, top: markerTip.y + 4 } : { left: markerTip.x + 8, top: markerTip.y + 4 }}
            className="pointer-events-none absolute z-10 w-[260px] rounded-lg border border-stone-200 bg-raised px-3 py-2 text-small shadow-sm">
            {markerTip.kind === 'setup' ? (
              <>
                <div className="mb-1 font-semibold text-stone-900">{h.setupChange?.label}</div>
                <div className="text-stone-600">Competitors, domain or brand profile changed in Brand Setup. Earlier points stay as they were scored; the new setup counts from the next scan.</div>
              </>
            ) : (
              <>
                <div className="mb-1 font-semibold text-stone-900">{scoring?.label}</div>
                <div className="text-stone-600">{scoring?.tip ?? `Points before this line were counted the old way, so changes across it aren’t compared. Competitors the old way miscounted are hidden there.`}</div>
              </>
            )}
          </div>
        )}
      </div>
      {single && <p className="mt-1 text-[12px] leading-4 text-stone-500">{note ?? 'Showing your first sync. Trend lines appear after the next sync.'}</p>}
      {/* less history than the range picked: what there is, and where it starts */}
      {!single && !empty && h.since && <p className="mt-1 text-[12px] leading-4 text-stone-500 tabular-nums">{h.since}</p>}

      {/* 16px between the dates and the insight's divider; the insight wraps, never cut off */}
      {insight && <div className="mt-auto pb-3 pt-4"><Insight explain={explain} {...insight} wrap /></div>}
    </Card>
  )
}
