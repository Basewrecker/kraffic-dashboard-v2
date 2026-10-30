import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, Calendar, Check, ChevronDown, ChevronsUpDown, Loader2, MoreHorizontal, Search } from 'lucide-react'
import ActionMenu from '../../components/audit/ActionMenu'
import Segmented from '../../components/dashboard/Segmented'
import SiteLogo from '../../components/ui/SiteLogo'
import { EngineMark } from '../insights/parts'
import { navigate } from '../../router'
import { ENGINE_NAMES, PERIODS, periodLabel } from '../../data/reports'
import { menuItem } from './parts'

// The standard report frame, the same for every kind. Header (the question as the H1, one finding sentence, for a custom
// question one "How I read your question" line; the date range, the frequency, Export as a menu) · band 1: the KPI strip
// (one card, equal cells: label, a 28/500 number with its change under it, a small chart of real data on the right) ·
// band 2: two visuals, 2/3 + 1/3, equal height (left: columns, lines or the topic map; right: the square grid with its
// legend and the By engine mini table, or the net change by topic) · band 3: a slim table, every cell on one line, rows
// that open to their prompts · band 4 (the CEO summary): the pages AI cites most. 16px between bands and cards, 20px
// card padding, left edges aligned. Flat cards on a 1px hairline (a 1px shadow in light), weights 400 / 600 (the KPI
// number 500), sentence case, tabular numbers. The dashboard's own chart colours. Motion: charts draw once on first
// view (bars grow, lines draw, squares fill in order), bands fade up 60ms apart when a report is ready, filter changes
// move the marks in 200ms; nothing loops, nothing under prefers-reduced-motion.
const TONE = { primary: 'var(--rep-primary)', tint: 'var(--rep-primary-tint)', rival: 'var(--rep-rival)', neutral: 'var(--rep-neutral)', bad: 'var(--rep-down-fg)', good: 'var(--rep-up-fg)' }
const CARD = 'rounded-xl border border-[var(--rep-line)] bg-surface [box-shadow:var(--rep-shadow)]'
const OUTLINE = 'inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-[10px] border border-[var(--rep-line)] bg-surface px-4 text-[15px] leading-5 text-stone-900 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus'
const LABEL = 'text-[14px] leading-5 text-stone-600'
const META = 'text-[13px] leading-[18px] text-stone-500'
const T = 'text-[15px] leading-[22px]'
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const fmt = (n) => new Intl.NumberFormat('en-US').format(n)
const signed = (n, unit = '') => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}${unit}`
// a mark animates once, on first view; nothing with reduced motion
const useDraw = () => { const [on] = useState(() => !reducedMotion()); return on }

function useWidth(initial = 720) {
  const ref = useRef(null)
  const [w, setW] = useState(initial)
  const [h, setH] = useState(0)
  useLayoutEffect(() => {
    if (!ref.current) return undefined
    setW(ref.current.clientWidth)
    setH(ref.current.clientHeight)
    const ro = new ResizeObserver(([e]) => { setW(e.contentRect.width); setH(e.contentRect.height) })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w, h]
}

// ---- small parts ---------------------------------------------------------------------------------------------------
export function ChangeChip({ delta, worseUp = false, unit = '', since = null, className = '' }) {
  if (delta == null) return null
  const good = delta === 0 ? null : worseUp ? delta < 0 : delta > 0
  const style = good == null ? { background: 'var(--tint)', color: 'var(--color-stone-600)' } : good ? { background: 'var(--rep-up-bg)', color: 'var(--rep-up-fg)' } : { background: 'var(--rep-down-bg)', color: 'var(--rep-down-fg)' }
  const Arrow = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : null
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="inline-flex h-6 items-center gap-0.5 rounded-md px-1.5 text-[13px] leading-none tabular-nums" style={style}>
        {Arrow && <Arrow size={12} strokeWidth={2.25} aria-hidden />}{fmt(Math.abs(delta))}{unit}
      </span>
      {since && <span className={`${META} whitespace-nowrap`}>vs {since}</span>}
    </span>
  )
}
// the dark tooltip with its arrow
function Tip({ x, y, title, rows }) {
  return (
    <div role="tooltip" className="pointer-events-none absolute z-20 rounded-lg border px-3 py-2.5 text-[13px] leading-[18px]"
      style={{ left: x, top: y - 12, transform: 'translate(-50%, -100%)', background: 'var(--rep-tip)', borderColor: 'var(--rep-tip-line)', color: 'var(--rep-tip-fg)', animation: reducedMotion() ? 'none' : 'rep-tip 120ms ease-out' }}>
      <p className="whitespace-nowrap" style={{ color: 'var(--rep-tip-meta)' }}>{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="mt-1 flex items-center gap-2 whitespace-nowrap tabular-nums" style={r.muted ? { color: 'var(--rep-tip-meta)' } : undefined}>
          {r.tone && <span className="h-2.5 w-2.5 rounded-full" style={{ background: TONE[r.tone] }} aria-hidden />}{r.label}<b className="ml-auto pl-4 font-semibold" style={r.color ? { color: r.color } : undefined}>{r.value}</b>
        </p>
      ))}
      <span aria-hidden className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r" style={{ background: 'var(--rep-tip)', borderColor: 'var(--rep-tip-line)' }} />
    </div>
  )
}
// an outline button (44px, 10px radius) with a menu: a radio list of options (value / onChange), or a list of actions (items)
function FrameMenu({ icon: Icon, label, value, options, onChange, items, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const btn = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const out = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus() } }
    document.addEventListener('mousedown', out)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc) }
  }, [open])
  const cur = options?.find((o) => o.id === value)
  const text = items ? label : cur?.label ?? value
  return (
    <div ref={wrap} className="relative">
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={items ? label : `${label}: ${text}`} onClick={() => setOpen((o) => !o)} className={OUTLINE}>
        {Icon && <Icon size={16} className="text-stone-600" aria-hidden />}{text}<ChevronDown size={16} className={`text-stone-500 transition-transform duration-100 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label={label} className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full z-40 mt-1.5 w-56 rounded-[10px] border border-[var(--rep-line)] bg-raised p-1 motion-safe:animate-[fade-in_120ms_ease-out]`}>
          {items
            ? items.map((it) => (
              <button key={it.label} type="button" role="menuitem" onClick={() => { setOpen(false); it.onClick(); btn.current?.focus() }} className={`${menuItem} text-stone-900`}>
                {it.icon && <it.icon size={15} className="shrink-0 text-stone-500" aria-hidden />}<span className="min-w-0 flex-1 truncate">{it.label}</span>
              </button>
            ))
            : options.map((o) => (
              <button key={o.id ?? 'all'} type="button" role="menuitemradio" aria-checked={o.id === value} onClick={() => { setOpen(false); onChange?.(o.id); btn.current?.focus() }} className={`${menuItem} text-stone-900`}>
                <span className="min-w-0 flex-1 truncate">{o.label}</span>{o.id === value && <Check size={14} className="shrink-0 text-ink" aria-hidden />}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
const Legend = ({ items }) => (
  <ul className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1" aria-label="Legend">
    {items.map((l) => <li key={l.key} className={`inline-flex items-center gap-2 ${LABEL}`}><span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: TONE[l.tone] }} aria-hidden /><span className="truncate">{l.label}</span></li>)}
  </ul>
)
const CardLabel = ({ children, legend, right }) => (
  <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-6 gap-y-2">
    <p className={LABEL}>{children}</p>
    {right ?? (legend && <Legend items={legend} />)}
  </div>
)

// ---- the small charts: an 8-week sparkline, a row of segments, tiny weekly columns ------------------------------------
function Spark({ series, w = 96, h = 28, tone = 'primary', redIfDown = false, draw = false }) {
  const pts = series.map((v, i) => [i, v]).filter(([, v]) => v != null)
  if (pts.length < 2) return null
  const vals = pts.map(([, v]) => v)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const x = (i) => 1.5 + (i * (w - 3)) / (series.length - 1)
  const y = (v) => (hi === lo ? h / 2 : 1.5 + (1 - (v - lo) / (hi - lo)) * (h - 3))
  const down = redIfDown && vals.at(-1) < vals.at(-2)
  const color = down ? TONE.bad : TONE[tone]
  const d = pts.map(([i, v]) => `${x(i)},${y(v)}`).join(' ')
  return (
    <svg width={w} height={h} aria-hidden className="block shrink-0 overflow-visible">
      <polyline points={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" pathLength="1" style={draw ? { animation: 'rep-draw 500ms ease-out both' } : undefined} />
      <circle cx={x(pts.at(-1)[0])} cy={y(vals.at(-1))} r="2" fill={color} style={draw ? { animation: 'rep-fill 150ms ease-out 450ms both' } : undefined} />
    </svg>
  )
}
function Segments({ n, of, tone = 'primary', draw = false }) {
  return (
    <span className="flex w-20 gap-[3px]" role="img" aria-label={`${n} of ${of}`}>
      {Array.from({ length: of }, (_, i) => <span key={i} className="h-2.5 flex-1 rounded-[2px]" style={{ background: i < n ? TONE[tone] : 'var(--rep-neutral)', animation: draw ? `rep-fill 150ms ease-out ${i * 40}ms both` : undefined }} />)}
    </span>
  )
}
function MiniCols({ columns, show, draw = false }) {
  const vals = columns.map((c) => c[show])
  const max = Math.max(1, ...vals.filter((v) => v != null))
  const tone = show === 'lost' ? TONE.bad : TONE.primary
  return (
    <span className="flex h-7 w-20 items-end gap-[3px]" role="img" aria-label={`${show} per week: ${vals.map((v) => v ?? '–').join(', ')}`}>
      {vals.map((v, i) => <span key={i} className="flex-1 rounded-[1.5px]" style={{ height: v == null ? 2 : `${Math.max(8, (v / max) * 100)}%`, background: v == null ? 'var(--rep-neutral)' : tone, transformOrigin: 'bottom', animation: draw ? `rep-grow 400ms ease-out ${i * 30}ms both` : undefined }} />)}
    </span>
  )
}

// ---- band 1: the KPI strip ------------------------------------------------------------------------------------------
function KpiStrip({ kpis }) {
  const draw = useDraw()
  return (
    <section aria-label="Key numbers" className={`${CARD} grid grid-cols-2 gap-y-4 p-5 md:grid-cols-3 lg:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]`} style={{ '--n': kpis.length }}>
      {kpis.map((k, i) => (
        <div key={k.label} className={`min-w-0 px-5 first:pl-0 last:pr-0 ${i ? 'border-l border-[var(--rep-line)]' : ''}`}>
          <p className={`${LABEL} truncate`} title={k.label}>{k.label}</p>
          <div className="mt-1 flex items-center justify-between gap-2 overflow-hidden">
            <p className={`whitespace-nowrap text-[28px] leading-8 font-medium tracking-[-0.01em] tabular-nums ${k.bad ? 'text-negative' : 'text-stone-900'}`} title={k.text}>
              {k.text ?? `${k.signed ? (k.value > 0 ? '+' : k.value < 0 ? '−' : '') : ''}${fmt(Math.abs(k.value))}${k.unit ?? ''}`}
              {k.of != null && <span className="text-[14px] font-normal text-stone-500"> of {fmt(k.of)}</span>}
            </p>
            <span className="shrink-0">
              {k.spark && <Spark series={k.spark} w={80} tone={k.sparkTone ?? 'primary'} draw={draw} />}
              {k.segments && <Segments n={k.segments.n} of={k.segments.of} tone={k.segments.tone} draw={draw} />}
              {k.columns && <MiniCols columns={k.columns} show={k.columnsShow} draw={draw} />}
            </span>
          </div>
          <p className="mt-1 flex min-h-6 items-center">
            {k.delta != null ? <ChangeChip delta={k.delta} worseUp={k.worseUp} since={k.since} /> : k.sub ? <span className={`${META} truncate`}>{k.sub}</span> : null}
          </p>
        </div>
      ))}
    </section>
  )
}

// ---- band 2, left: columns, lines or the topic map --------------------------------------------------------------------
const splitLabel = (s) => {
  if (s.length <= 13) return [s]
  const words = s.split(' ')
  let best = [s, '']
  let gap = Infinity
  for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(' '); const b = words.slice(i).join(' '); const g = Math.abs(a.length - b.length); if (g < gap) { gap = g; best = [a, b] } }
  return best
}
const PLOT = 240
const TOP = 12
const BOT = 44
const PAD_L = 44
const PAD_R = 8
function Columns({ c }) {
  const [ref, w] = useWidth(720)
  const [hover, setHover] = useState(null)
  const draw = useDraw()
  const H = PLOT + TOP + BOT
  const n = c.bands.length
  const per = c.bands[0]?.bars.length ?? 1
  const max = Math.max(1, ...c.bands.flatMap((b) => b.bars.map((x) => x.value)))
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200].find((s) => max / s <= 5) ?? 200
  let hi = Math.ceil(max / step) * step
  if (hi <= max) hi += step
  const ticks = []
  for (let t = 0; t <= hi; t += step) ticks.push(t)
  const band = (w - PAD_L - PAD_R) / n
  const pair = band * 0.55
  const bw = (pair - 3 * (per - 1)) / per
  const y = (v) => TOP + (1 - v / hi) * PLOT
  const base = y(0)
  const tip = hover != null ? c.bands[hover] : null
  const name = (x, i) => x.label ?? c.legend[i]?.label ?? ''
  return (
    <div ref={ref} className="relative mt-3 w-full">
      {w > 0 && (
        <svg width={w} height={H} role="img" aria-label={`${c.label}: ${c.bands.map((b) => `${b.label} ${b.bars.map((x, i) => `${name(x, i)} ${x.value}`).join(', ')}`).join('; ')}`} className="block overflow-visible" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              {t > 0 && <line x1={PAD_L} x2={w - PAD_R} y1={y(t)} y2={y(t)} stroke="var(--rep-line)" strokeDasharray="3 3" />}
              <text x={PAD_L - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-stone-500 text-[13px] tabular-nums">{fmt(t)}</text>
            </g>
          ))}
          <line x1={PAD_L} x2={w - PAD_R} y1={base} y2={base} stroke="var(--color-line-strong)" />
          {c.bands.map((b, i) => {
            const x0 = PAD_L + i * band + band / 2 - pair / 2
            const lines = splitLabel(b.label)
            return (
              <g key={b.label} onMouseEnter={() => setHover(i)} style={{ opacity: hover != null && hover !== i ? 0.35 : 1, transition: reducedMotion() ? 'none' : 'opacity 120ms ease-out' }}>
                <rect x={PAD_L + i * band} y={TOP} width={band} height={PLOT} fill="transparent" />
                {b.bars.map((x, k) => (
                  <rect key={x.key} x={x0 + k * (bw + 3)} y={y(x.value)} width={Math.max(0, bw)} height={Math.max(0, base - y(x.value))} rx="2" fill={TONE[x.tone]}
                    style={{ transformBox: 'fill-box', transformOrigin: 'bottom', transition: reducedMotion() ? 'none' : 'y 200ms ease-out, height 200ms ease-out, fill 200ms ease-out', animation: draw ? `rep-grow 400ms ease-out ${i * 30}ms both` : undefined }} />
                ))}
                {lines.map((l, k) => <text key={k} x={PAD_L + i * band + band / 2} y={base + 20 + k * 16} textAnchor="middle" className="fill-stone-600 text-[13px]">{l}</text>)}
              </g>
            )
          })}
        </svg>
      )}
      {tip && <Tip x={PAD_L + hover * band + band / 2} y={y(Math.max(...tip.bars.map((x) => x.value)))} title={tip.label}
        rows={[...tip.bars.map((x, i) => ({ label: name(x, i), value: fmt(x.value), tone: x.tone })), ...(tip.delta != null ? [{ label: 'Change', value: signed(tip.delta), muted: true, color: tip.delta < 0 ? 'var(--rep-down-fg)' : tip.delta > 0 ? 'var(--rep-up-fg)' : undefined }] : [])]} />}
    </div>
  )
}
function Lines({ c }) {
  const [ref, w] = useWidth(720)
  const [hover, setHover] = useState(null)
  const draw = useDraw()
  const H = PLOT + TOP + BOT
  const n = c.dates.length
  const hi = c.max ?? 100
  const x = (i) => PAD_L + (i * (w - PAD_L - PAD_R)) / Math.max(1, n - 1)
  const y = (v) => TOP + (1 - v / hi) * PLOT
  const ticks = [0, 25, 50, 75, 100].filter((t) => t <= hi)
  const band = (w - PAD_L - PAD_R) / Math.max(1, n - 1)
  return (
    <div ref={ref} className="relative mt-3 w-full">
      {w > 0 && (
        <svg width={w} height={H} role="img" aria-label={`${c.label}: ${c.series.map((s) => `${s.label} ${s.values.at(-1)}${c.unit}`).join(', ')} at the latest sync`} className="block overflow-visible" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              {t > 0 && <line x1={PAD_L} x2={w - PAD_R} y1={y(t)} y2={y(t)} stroke="var(--rep-line)" strokeDasharray="3 3" />}
              <text x={PAD_L - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-stone-500 text-[13px] tabular-nums">{t}{c.unit}</text>
            </g>
          ))}
          <line x1={PAD_L} x2={w - PAD_R} y1={y(0)} y2={y(0)} stroke="var(--color-line-strong)" />
          {c.dates.map((d, i) => <text key={d} x={x(i)} y={y(0) + 20} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="fill-stone-600 text-[13px]">{d}</text>)}
          {[...c.series].reverse().map((s) => (
            <g key={s.key}>
              <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={TONE[s.tone]} strokeWidth={s.width} strokeLinejoin="round" strokeLinecap="round" pathLength="1" style={draw ? { animation: 'rep-draw 500ms ease-out both' } : undefined} />
              {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 4.5 : 3} fill={TONE[s.tone]} stroke="var(--color-surface)" strokeWidth="1.5" style={draw ? { animation: `rep-fill 150ms ease-out ${(i / Math.max(1, n - 1)) * 500}ms both` } : undefined} />)}
            </g>
          ))}
          {c.dates.map((d, i) => <rect key={d} x={x(i) - band / 2} y={TOP} width={band} height={PLOT} fill="transparent" onMouseEnter={() => setHover(i)} />)}
        </svg>
      )}
      {hover != null && <Tip x={x(hover)} y={y(Math.max(...c.series.map((s) => s.values[hover])))} title={c.dates[hover]} rows={c.series.map((s) => ({ label: s.label, value: `${s.values[hover]}${c.unit}`, tone: s.tone }))} />}
    </div>
  )
}
// the topic map: a squarified treemap, one tile per topic, area = its prompts (or answers), the colour of whoever leads
// in three steps by the lead's margin. Engines re-colour it; a click filters the table to that topic
function squarify(items, x, y, w, h) {
  const total = items.reduce((a, it) => a + it.size, 0)
  const out = []
  let rest = [...items]
  let rx = x
  let ry = y
  let rw = w
  let rh = h
  let left = total
  while (rest.length) {
    const vertical = rw >= rh // lay the row along the shorter side
    const side = vertical ? rh : rw
    const area = (it) => (it.size / left) * rw * rh
    let row = []
    let worst = Infinity
    for (const it of rest) {
      const cand = [...row, it]
      const sum = cand.reduce((a, c) => a + area(c), 0)
      const thick = sum / side
      const ratio = Math.max(...cand.map((c) => Math.max(thick / (area(c) / thick), (area(c) / thick) / thick)))
      if (ratio <= worst) { row = cand; worst = ratio } else break
    }
    const sum = row.reduce((a, c) => a + area(c), 0)
    const thick = sum / side
    let at = vertical ? ry : rx
    for (const it of row) {
      const len = area(it) / thick
      out.push(vertical ? { ...it, x: rx, y: at, w: thick, h: len } : { ...it, x: at, y: ry, w: len, h: thick })
      at += len
    }
    if (vertical) { rx += thick; rw -= thick } else { ry += thick; rh -= thick }
    left -= row.reduce((a, c) => a + c.size, 0)
    rest = rest.slice(row.length)
  }
  return out
}
const LEAD_STEP = (lead) => (Math.abs(lead) < 10 ? 40 : Math.abs(lead) < 20 ? 70 : 100)
const fillFor = (leader, lead) => `color-mix(in srgb, ${TONE[leader === 'you' ? 'primary' : leader === 'rival' ? 'rival' : 'neutral']} ${LEAD_STEP(lead)}%, var(--color-surface))`
const onFill = (leader, lead) => (leader === 'other' || LEAD_STEP(lead) < 70 ? 'var(--color-stone-900)' : leader === 'you' ? 'var(--on-ink)' : 'var(--pie-on-c1)')
function TopicMap({ c, picked, onPick }) {
  const [ref, w, h] = useWidth(720)
  const [engine, setEngine] = useState('all')
  const [sizeBy, setSizeBy] = useState('prompts')
  const [hover, setHover] = useState(null)
  const draw = useDraw()
  const H = Math.max(240, h) // the map fills its card
  const tiles = useMemo(() => {
    const items = c.tiles.map((t) => ({ ...t, size: Math.max(1, t[sizeBy]) })).sort((a, b) => b.size - a.size)
    return w > 0 ? squarify(items, 0, 0, w, H) : []
  }, [c.tiles, sizeBy, w, H])
  const of = (t) => (engine === 'all' ? { leader: t.leader, lead: t.lead, leaderName: t.leaderName } : t.byEngine[engine] ?? { leader: t.leader, lead: t.lead, leaderName: t.leaderName })
  const tip = hover != null ? tiles.find((t) => t.id === hover) : null
  const you = c.legend[0].label.replace(/ leads$/, '')
  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Segmented size="sm" label="Engine" value={engine} onChange={setEngine} options={[{ value: 'all', label: 'All engines' }, ...c.engines.map((e) => ({ value: e, label: ENGINE_NAMES[e] }))]} />
        <span className="flex items-center gap-2"><span className={META}>Size by</span><Segmented size="sm" label="Size by" value={sizeBy} onChange={setSizeBy} options={[{ value: 'prompts', label: 'Prompts' }, { value: 'answers', label: 'Answers' }]} /></span>
      </div>
      <div ref={ref} className="relative mt-3 min-h-[240px] w-full flex-1" onMouseLeave={() => setHover(null)}>
        {tiles.map((t, i) => {
          const v = of(t)
          const roomy = t.w > 96 && t.h > 44
          const sel = picked === t.id
          return (
            <button key={t.id} type="button" onClick={() => onPick?.(sel ? null : t.id)} onMouseEnter={() => setHover(t.id)} aria-pressed={sel} aria-label={`${t.label}: ${v.leaderName} leads by ${Math.abs(v.lead)} points, ${t.prompts} prompts`}
              className="absolute overflow-hidden rounded-[4px] text-left outline-none focus-visible:ring-2 focus-visible:ring-focus"
              style={{ left: t.x + 1.5, top: t.y + 1.5, width: Math.max(0, t.w - 3), height: Math.max(0, t.h - 3), background: fillFor(v.leader, v.lead), color: onFill(v.leader, v.lead), boxShadow: sel ? 'inset 0 0 0 2px var(--ink)' : picked ? 'none' : undefined, opacity: picked && !sel ? 0.45 : 1, transition: reducedMotion() ? 'none' : 'background-color 200ms ease-out, opacity 200ms ease-out, left 200ms ease-out, top 200ms ease-out, width 200ms ease-out, height 200ms ease-out', animation: draw ? `rep-fill 200ms ease-out ${i * 40}ms both` : undefined }}>
              {roomy && (
                <span className="block p-2.5">
                  <span className="block truncate text-[13px] leading-[18px] font-semibold">{t.label}</span>
                  <span className="block truncate text-[13px] leading-[18px] tabular-nums">{v.leader === 'you' ? signed(v.lead, ' pts') : `${v.leaderName} ${signed(Math.abs(v.lead))}`}</span>
                </span>
              )}
            </button>
          )
        })}
        {tip && <Tip x={tip.x + tip.w / 2} y={tip.y + 8} title={`${tip.label} · ${fmt(tip.prompts)} prompts`} rows={[...tip.shares.map((s) => ({ label: s.name, value: `${s.share}%`, tone: s.name === you ? 'primary' : s.name === c.rival ? 'rival' : 'neutral' })), { label: engine === 'all' ? 'Lead' : `Lead on ${ENGINE_NAMES[engine]}`, value: `${of(tip).leaderName} ${signed(Math.abs(of(tip).lead), ' pts')}`, muted: true }]} />}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Legend items={c.legend} />
        <span className={`inline-flex items-center gap-2 ${META}`}>narrow<span className="inline-flex gap-[3px]">{[40, 70, 100].map((p) => <span key={p} className="h-2.5 w-4 rounded-[2px]" style={{ background: `color-mix(in srgb, ${TONE.primary} ${p}%, var(--color-surface))` }} aria-hidden />)}</span>wide lead</span>
      </div>
    </div>
  )
}
function LeftCard({ c, picked, onPick }) {
  return (
    <section aria-label={c.label} className={`${CARD} flex flex-col p-5`}>
      <CardLabel legend={c.kind === 'treemap' ? null : c.legend}>{c.label}</CardLabel>
      {c.kind === 'lines' ? <Lines c={c} /> : c.kind === 'treemap' ? <TopicMap c={c} picked={picked} onPick={onPick} /> : <Columns c={c} />}
    </section>
  )
}

// ---- band 2, right: the square grid with its legend, or the net change by topic; then By engine as a mini table -----
function Grid({ r }) {
  const [hi, setHi] = useState(null) // a legend row's key, or null
  const [tip, setTip] = useState(null) // { key, x, y }
  const draw = useDraw()
  const box = useRef(null)
  const cells = useMemo(() => r.cells.flatMap((c) => Array.from({ length: c.cells }, () => c)), [r.cells])
  const total = r.cells.reduce((a, c) => a + c.n, 0)
  return (
    <div>
      <div ref={box} className="relative grid grid-cols-10 gap-[3px]" role="img" aria-label={r.cells.map((c) => `${c.label} ${c.n}${r.unit === '%' ? '%' : ''}`).join(', ')} onMouseLeave={() => setTip(null)}>
        {cells.map((c, i) => (
          <span key={i} className="aspect-square rounded-[2px]" style={{ background: TONE[c.tone], opacity: hi && hi !== c.key ? 0.25 : 1, transition: reducedMotion() ? 'none' : 'opacity 150ms ease-out', animation: draw ? `rep-fill 150ms ease-out ${i * 3}ms both` : undefined }}
            onMouseEnter={(e) => { const b = box.current.getBoundingClientRect(); const t = e.currentTarget.getBoundingClientRect(); setTip({ key: c.key, x: t.left - b.left + t.width / 2, y: t.top - b.top }) }} />
        ))}
        {tip && (() => { const c = r.cells.find((x) => x.key === tip.key); return <Tip x={tip.x} y={tip.y} title={c.label} rows={[{ label: r.unit === '%' ? 'Share of voice' : 'Prompts', value: r.unit === '%' ? `${c.n}%` : fmt(c.n), tone: c.tone }, { label: 'Of the grid', value: `${c.share}%`, muted: true }]} /> })()}
      </div>
      <ul className="mt-3 flex flex-col gap-1">
        {r.cells.map((c, i) => (
          <li key={c.key} onMouseEnter={() => setHi(c.key)} onMouseLeave={() => setHi(null)} className="flex h-6 items-center gap-2 text-[14px] leading-5 tabular-nums">
            <span className="h-3 w-3 shrink-0 rounded-[2px]" style={{ background: TONE[c.tone] }} aria-hidden />
            {r.ranked && <span className={`w-4 shrink-0 ${META}`}>{i + 1}</span>}
            {r.ranked && c.domain && <SiteLogo domain={c.domain} name={c.label} className="h-4 w-4 shrink-0 rounded" imgPad="p-0" initialClass="text-[8px]" plate />}
            <span className="min-w-0 truncate text-stone-700">{c.label}</span>
            <span className="ml-auto whitespace-nowrap pl-2 text-stone-900">{r.unit === '%' ? `${c.n}%` : <>{fmt(c.n)} <span className="text-stone-500">· {c.share}%</span></>}</span>
            {c.delta != null ? <ChangeChip delta={c.delta} worseUp={c.worseUp} /> : <span className="w-[42px]" aria-hidden />}
          </li>
        ))}
      </ul>
      {total === 0 && <p className={`mt-2 ${META}`}>Nothing to show yet.</p>}
    </div>
  )
}
function Diverging({ r }) {
  const max = Math.max(1, ...r.rows.map((x) => Math.abs(x.d)))
  const HALF = 'calc(50% - 28px)'
  const draw = useDraw()
  return (
    <ul className="flex flex-col gap-1">
      {r.rows.map((x, i) => {
        const pct = Math.abs(x.d) / max
        return (
          <li key={x.label} className="grid min-h-7 grid-cols-[minmax(0,120px)_minmax(0,1fr)] items-center gap-3">
            <span className={`truncate text-[14px] leading-5 ${x.d === 0 ? 'text-stone-500' : 'text-stone-800'}`} title={x.label}>{x.label}</span>
            <span className="relative h-5" role="img" aria-label={`${x.label} ${signed(x.d)}`}>
              <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--color-line-strong)]" aria-hidden />
              {x.d > 0 && <span className="absolute left-1/2 top-1/2 h-2.5 -translate-y-1/2 rounded-r-[3px]" style={{ width: `calc(${HALF} * ${pct})`, background: TONE.primary, transformOrigin: 'left', animation: draw ? `rep-grow-x 400ms ease-out ${i * 40}ms both` : undefined }} />}
              {x.d < 0 && <span className="absolute right-1/2 top-1/2 h-2.5 -translate-y-1/2 rounded-l-[3px]" style={{ width: `calc(${HALF} * ${pct})`, background: TONE.bad, transformOrigin: 'right', animation: draw ? `rep-grow-x 400ms ease-out ${i * 40}ms both` : undefined }} />}
              <span className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[13px] font-medium tabular-nums ${x.d === 0 ? 'text-stone-500' : ''}`}
                style={x.d >= 0 ? { left: `calc(50% + ${HALF} * ${pct} + 6px)`, color: x.d > 0 ? 'var(--rep-up-fg)' : undefined } : { right: `calc(50% + ${HALF} * ${pct} + 6px)`, color: 'var(--rep-down-fg)' }}>
                {x.d === 0 ? '0' : signed(x.d)}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
function ByEngine({ by }) {
  return (
    <div className="mt-4 border-t border-[var(--rep-line)] pt-3">
      <table className="w-full border-collapse text-[14px] leading-5 tabular-nums">
        <thead><tr className={META}><th scope="col" className="pb-1 text-left font-normal">By engine</th>{by.cols.map((c) => <th key={c} scope="col" className="w-16 pb-1 text-right font-normal">{c}</th>)}</tr></thead>
        <tbody>
          {by.rows.map((e) => (
            <tr key={e.id} className="h-7">
              <td className="pr-2"><span className="flex min-w-0 items-center gap-2 text-stone-900"><EngineMark id={e.id} size={16} /><span className="truncate">{e.name}</span></span></td>
              <td className="text-right text-stone-900">{fmt(e.won)}</td>
              <td className={`text-right ${e.lost > 0 ? 'text-negative' : 'text-stone-500'}`}>{fmt(e.lost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {by.off?.length > 0 && <p className={`mt-1 ${META}`}>{by.off.join(', ')} · didn’t run</p>}
    </div>
  )
}
function RightCard({ r }) {
  return (
    <section aria-label={r.label} className={`${CARD} flex flex-col p-5`}>
      <CardLabel legend={r.legend}>{r.label}</CardLabel>
      <div className="mt-3">{r.kind === 'grid' ? <Grid r={r} /> : r.kind === 'diverging' ? <Diverging r={r} /> : null}</div>
      {r.byEngine && <ByEngine by={r.byEngine} />}
      {r.list && (
        <div className="mt-4 border-t border-[var(--rep-line)] pt-3">
          <p className={META}>{r.list.label}</p>
          <ul className="mt-1 flex flex-col gap-1">
            {r.list.rows.map((x) => <li key={x.key} className="flex h-6 items-center gap-2 text-[14px] leading-5 tabular-nums"><SiteLogo domain={x.domain} name={x.name} className="h-4 w-4 shrink-0 rounded" imgPad="p-0" initialClass="text-[8px]" plate /><span className="min-w-0 truncate text-stone-900">{x.name}</span><span className="ml-auto pl-3 text-stone-600">{fmt(x.n)} prompts</span></li>)}
          </ul>
        </div>
      )}
    </section>
  )
}

// ---- band 3: the slim table -----------------------------------------------------------------------------------------
const SORT_KEY = { engine: 'engineName', step: 'id' }
function TableCard({ t, source, notes = [], picked = null }) {
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({})
  const [sort, setSort] = useState({ key: null, dir: 1 })
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState(() => new Set())
  const draw = useDraw()
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    let out = t.rows.filter((r) => (!picked || r.id === picked) && (!s || `${r.text} ${r.topic ?? ''} ${r.result ?? ''}`.toLowerCase().includes(s)) && t.filters.every((f) => !filters[f.key] || r[f.by ?? f.key] === filters[f.key]))
    if (sort.key) {
      const k = SORT_KEY[sort.key] ?? sort.key
      out = [...out].sort((a, b) => (typeof a[k] === 'number' ? a[k] - b[k] : String(a[k]).localeCompare(String(b[k]))) * sort.dir)
    }
    return out
  }, [t, q, filters, sort, picked])
  const shown = all ? rows : rows.slice(0, t.pageSize)
  const right = (c) => c.kind === 'num'
  const toggle = (id) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const th = (c) => (
    <th key={c.key} scope="col" className={`whitespace-nowrap px-4 py-2.5 text-[14px] leading-5 font-semibold text-stone-900 first:pl-5 ${right(c) ? 'text-right' : 'text-left'}`}>
      {c.sort
        ? <button type="button" onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : 1 }))} aria-sort={sort.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}
            className="inline-flex items-center gap-1.5 rounded outline-none hover:text-stone-700 focus-visible:ring-2 focus-visible:ring-focus">{c.label}<ChevronsUpDown size={14} className="text-stone-500" aria-hidden /></button>
        : c.label}
    </th>
  )
  const cell = (r, c) => {
    const v = r[c.key]
    switch (c.kind) {
      case 'text': return <span className={`block truncate ${T} text-stone-900`} title={r.text}>{r.text}</span>
      case 'muted': return v ? <span className={`block truncate ${T} text-stone-500`} title={v}>{v}</span> : <span className={`${T} text-stone-500`}>—</span>
      case 'num': return <span className={`${T} tabular-nums text-stone-900`}>{fmt(v)}</span>
      case 'change': return v === 0 ? <span className={`${T} text-stone-500`}>No change</span> : <span className={`${T} font-medium tabular-nums`} style={{ color: v > 0 ? 'var(--rep-up-fg)' : 'var(--rep-down-fg)' }}>{signed(v)}{c.unit ? ` ${c.unit}` : ''}</span>
      case 'trend': return v ? <Spark series={v} w={60} h={20} redIfDown draw={draw} /> : <span className={`${T} text-stone-500`}>—</span>
      case 'lead': {
        const max = Math.max(1, ...t.rows.map((x) => Math.abs(x.lead ?? 0)))
        const pct = (Math.abs(v) / max) * 50
        return (
          <span className="inline-flex items-center gap-3">
            <span className="relative h-2.5 w-[120px]" role="img" aria-label={`${signed(v)} points`}>
              <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--color-line-strong)]" aria-hidden />
              <span className={`absolute inset-y-0 ${v >= 0 ? 'left-1/2 rounded-r-[3px]' : 'right-1/2 rounded-l-[3px]'}`} style={{ width: `${pct}%`, background: v >= 0 ? TONE.primary : TONE.bad, transformOrigin: v >= 0 ? 'left' : 'right', animation: draw ? 'rep-grow-x 400ms ease-out both' : undefined }} />
            </span>
            <span className={`${T} w-16 tabular-nums ${v < 0 ? 'font-medium text-negative' : 'text-stone-900'}`}>{signed(v, ' pts')}</span>
          </span>
        )
      }
      case 'leader': return <span className={`inline-flex items-center gap-2 ${T} text-stone-900`}><SiteLogo domain={v.domain} name={v.name} className="h-4 w-4 shrink-0 rounded" imgPad="p-0" initialClass="text-[8px]" plate />{v.name}</span>
      case 'step': return v
        ? <a href={v.href} onClick={(e) => { e.stopPropagation(); e.preventDefault(); navigate(v.href) }} className={`inline-flex items-center gap-1 rounded ${T} font-medium text-stone-900 outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-focus`}>{v.label}<ArrowRight size={14} aria-hidden /></a>
        : <span className={`${T} text-stone-500`}>—</span>
      case 'engine': return <span className={`inline-flex items-center gap-2 ${T} text-stone-900`}><EngineMark id={r.engine} size={16} />{r.engineName}</span>
      case 'engines': return v?.length ? <span className="inline-flex items-center gap-1.5">{v.map((e) => <EngineMark key={e} id={e} size={16} />)}</span> : <span className={`${T} text-stone-500`}>—</span>
      case 'page': return v ? <span className={`${T} text-stone-900`} title={`${v.domain}${v.path}`}>{v.path} <span className="text-stone-500 tabular-nums">· {v.n} answers</span></span> : <span className={`${T} text-stone-500`}>None</span>
      case 'strong': return <span className={`${T} ${r.strong ? 'font-medium' : ''} text-stone-900`}>{v}</span>
      default: return <span className={`${T} text-stone-900`}>{v}</span>
    }
  }
  return (
    <section aria-label={t.title} className={`${CARD} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-3 p-5">
        <label className="relative flex h-11 min-w-[240px] flex-1 items-center">
          <Search size={16} className="pointer-events-none absolute left-3.5 text-stone-500" aria-hidden />
          <span className="sr-only">{t.searchLabel}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchLabel}
            className="h-11 w-full rounded-[10px] border border-[var(--rep-line)] bg-surface pl-10 pr-3 text-[15px] text-stone-900 outline-none placeholder:text-stone-500 focus:border-line-strong" />
        </label>
        {t.filters.map((f) => (
          <FrameMenu key={f.key} label={f.label} value={filters[f.key] ?? null} onChange={(id) => setFilters((p) => ({ ...p, [f.key]: id }))} options={[{ id: null, label: f.all }, ...f.options]} />
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead><tr className="border-y border-[var(--rep-line)]" style={{ background: 'var(--rep-head)' }}>{t.columns.map(th)}<th scope="col" className="w-14 pr-3"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {shown.map((r) => {
              const isOpen = t.expandable && open.has(r.id)
              const lit = picked && r.id === picked
              return [
                <tr key={r.id} onClick={t.expandable ? () => toggle(r.id) : undefined} aria-expanded={t.expandable ? isOpen : undefined}
                  className={`h-[52px] border-b border-[var(--rep-line)] transition-colors duration-100 last:border-0 hover:bg-tint ${t.expandable ? 'cursor-pointer' : ''} ${isOpen || lit ? 'bg-tint' : ''}`}>
                  {t.columns.map((c) => <td key={c.key} className={`whitespace-nowrap px-4 py-1 align-middle first:pl-5 ${c.kind === 'text' ? 'max-w-[360px]' : 'w-[1%]'} ${right(c) ? 'text-right' : ''}`}>{cell(r, c)}</td>)}
                  <td className="pr-3 align-middle" onClick={(e) => e.stopPropagation()}>
                    <ActionMenu label={`Actions for ${r.text}`} className="grid h-8 w-8 place-items-center rounded-lg text-stone-500 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"
                      items={[{ label: 'Open in Prompt Hub', onClick: () => navigate(r.href) }, { label: 'Copy', onClick: () => { try { navigator.clipboard?.writeText(r.text) } catch { /* no clipboard */ } } }]}>
                      <MoreHorizontal size={16} aria-hidden />
                    </ActionMenu>
                  </td>
                </tr>,
                isOpen && (
                  <tr key={`${r.id}-x`} className="border-b border-[var(--rep-line)]">
                    <td colSpan={t.columns.length + 1} className="px-5 py-3">
                      <div className="grid gap-x-8 gap-y-3 md:grid-cols-[minmax(0,1fr)_240px]">
                        <ul className="columns-2 gap-x-8 text-[14px] leading-6 text-stone-500">{r.expand?.prompts?.map((p) => <li key={p} className="truncate" title={p}>{p}</li>)}{!r.expand?.prompts?.length && <li>No prompts listed for this topic.</li>}</ul>
                        {r.expand?.lines?.length > 0 && <ul className="flex flex-col gap-1 text-[14px] leading-6 tabular-nums text-stone-700">{r.expand.lines.map((l) => <li key={l}>{l}</li>)}</ul>}
                      </div>
                    </td>
                  </tr>
                ),
              ]
            })}
            {shown.length === 0 && <tr><td colSpan={t.columns.length + 1} className={`px-5 py-8 text-center ${LABEL}`}>Nothing matches</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-[var(--rep-line)] px-5 py-3">
        <div className="min-w-0">
          {source && <p className={`${META} tabular-nums`}>{source}</p>}
          {notes.map((n) => <p key={n} className={META}>Not in your data: {n}</p>)}
        </div>
        <p className={`${META} whitespace-nowrap tabular-nums`}>
          Showing {Math.min(shown.length, rows.length)} of {rows.length}
          {rows.length > t.pageSize && <> · <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all} className="rounded font-medium text-stone-700 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">{all ? 'Show fewer' : 'Show all'}</button></>}
        </p>
      </div>
    </section>
  )
}

// ---- band 4: the pages AI cites most -------------------------------------------------------------------------------
function PagesCard({ p }) {
  const max = Math.max(1, ...p.rows.map((r) => r.n))
  const draw = useDraw()
  return (
    <section aria-label={p.label} className={`${CARD} p-5`}>
      <CardLabel>{p.label}</CardLabel>
      <ul className="mt-2 flex flex-col divide-y divide-[var(--rep-line)]">
        {p.rows.map((r, i) => (
          <li key={r.path} className="grid min-h-10 grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_104px] items-center gap-4 py-1 max-md:grid-cols-[minmax(0,1fr)_88px]">
            <span className={`truncate ${T} text-stone-900`} title={r.path}>{r.path}</span>
            <span className={`truncate ${T} text-stone-500 max-md:hidden`}>{r.type}</span>
            <span className="relative h-2.5 max-md:hidden" aria-hidden><span className="absolute inset-y-0 left-0 rounded-[3px]" style={{ width: `${(r.n / max) * 100}%`, background: TONE.primary, transformOrigin: 'left', animation: draw ? `rep-grow-x 400ms ease-out ${i * 60}ms both` : undefined }} /></span>
            <span className={`text-right ${T} tabular-nums text-stone-900`}>{fmt(r.n)} <span className="text-stone-500">answers</span></span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---- while a report is written: the three bands as a skeleton with a soft shimmer, and one status line that steps ---
export function FrameSkeleton({ steps = [], step = 0 }) {
  const Block = ({ className, style }) => <div className={`shimmer rounded-md ${className}`} style={style} aria-hidden />
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <p aria-live="polite" className="flex flex-wrap items-center gap-x-2 text-[14px] leading-5">
        {steps.map((s, i) => (
          <span key={s} className="inline-flex items-center gap-2">
            {i > 0 && <span className="text-stone-400" aria-hidden>→</span>}
            <span className={`inline-flex items-center gap-1.5 ${i < step ? 'text-stone-500' : i === step ? 'text-stone-900' : 'text-stone-400'}`}>
              {i < step ? <Check size={14} strokeWidth={2.5} className="text-stone-500" aria-hidden /> : i === step ? <Loader2 size={14} className="animate-spin text-stone-700 motion-reduce:animate-none" aria-hidden /> : null}{s}{i === step ? '…' : ''}
            </span>
          </span>
        ))}
      </p>
      <div className={`${CARD} grid gap-x-10 p-5 lg:grid-cols-5`}>{Array.from({ length: 5 }, (_, i) => <div key={i} className="flex flex-col gap-2"><Block className="h-4 w-24" /><Block className="h-7 w-16" /><Block className="h-5 w-28" /></div>)}</div>
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className={`${CARD} p-5`}><Block className="h-4 w-40" /><div className="mt-5 flex h-[240px] items-end gap-6 px-6">{[55, 70, 45, 80, 60, 75, 50, 90].map((h, i) => <Block key={i} className="flex-1" style={{ height: `${h}%` }} />)}</div></div>
        <div className={`${CARD} p-5`}><Block className="h-4 w-32" /><Block className="mt-4 aspect-square w-full" /><div className="mt-3 flex flex-col gap-2"><Block className="h-4 w-full" /><Block className="h-4 w-5/6" /><Block className="h-4 w-2/3" /></div></div>
      </div>
      <div className={`${CARD} p-5`}><Block className="h-11 w-full" /><div className="mt-4 flex flex-col gap-3">{Array.from({ length: 5 }, (_, i) => <Block key={i} className="h-8 w-full" />)}</div></div>
    </div>
  )
}

// ---- the frame ------------------------------------------------------------------------------------------------------
const FREQ = [{ id: 'once', label: 'One-off' }, { id: 'week', label: 'Weekly' }, { id: 'month', label: 'Monthly' }]
export default function ReportFrame({ built, onPeriod, onSchedule, actions = [], print = false, live = false }) {
  const f = built.frame
  const o = built.opts
  const [picked, setPicked] = useState(null) // a topic picked on the topic map: the table shows that topic
  const periods = PERIODS.filter((p) => p.id !== 'custom').map((p) => ({ id: p.id, label: p.id === o.period ? f.range : p.label }))
  const src = built.blocks.find((b) => b.type === 'sources')?.data
  const source = src ? `Source: ${src.syncs} weekly syncs, ${src.span} · ${src.engines.join(', ')}${src.off?.length ? ` · ${src.off.join(' and ')} didn’t run` : ''}` : null
  // when a report is ready its bands fade up, 60ms apart; nothing with reduced motion
  const band = (i) => (live && !reducedMotion() ? { animation: `rep-up 400ms ease-out ${i * 60}ms both` } : undefined)
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 lg:flex-nowrap" style={band(0)}>
        <div className="min-w-0 max-w-[760px] flex-1">
          <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.01em] text-stone-900 [text-wrap:balance] max-md:text-[26px] max-md:leading-8">{f.question}</h1>
          <p className="mt-2 text-[16px] leading-6 font-normal text-stone-600 [text-wrap:pretty]">{f.finding}</p>
          {f.read && <p className={`mt-2 ${LABEL} text-stone-500 [text-wrap:pretty]`}>{f.read}</p>}
        </div>
        {!print && (
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <FrameMenu icon={Calendar} label="Date range" value={o.period} options={periods} onChange={(id) => id !== o.period && onPeriod?.(id, periodLabel(id))} />
            <FrameMenu label="Frequency" value={f.frequency ?? 'once'} options={FREQ} onChange={(id) => id !== (f.frequency ?? 'once') && onSchedule?.(id)} />
            <FrameMenu label="Export" items={actions} />
          </div>
        )}
      </header>
      <div style={band(1)}><KpiStrip kpis={f.kpis} /></div>
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" style={band(2)}>
        <LeftCard c={f.left} picked={picked} onPick={setPicked} />
        <RightCard r={f.right} />
      </div>
      <div style={band(3)}><TableCard t={f.table} source={source} notes={f.notInData ?? []} picked={picked} /></div>
      {f.pages && <div style={band(4)}><PagesCard p={f.pages} /></div>}
    </div>
  )
}
