import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, Calendar, Check, ChevronDown, ChevronsUpDown, MoreHorizontal, Search } from 'lucide-react'
import ActionMenu from '../../components/audit/ActionMenu'
import SiteLogo from '../../components/ui/SiteLogo'
import { EngineMark } from '../insights/parts'
import { navigate } from '../../router'
import { PERIODS, periodLabel } from '../../data/reports'
import { menuItem } from './parts'

// The standard report frame, the same for every kind. Header (the question as the H1, one finding sentence, for a custom
// question one "How I read your question" line; the date range, the frequency, Export as a menu) · band 1: the KPI strip
// (one card, equal cells, the only place numbers live) · band 2: two visuals, 2/3 + 1/3, equal height, each a 14px label
// and a legend, no numbers · band 3: a slim table, every cell on one line, rows that open to their prompts · band 4 (the
// CEO summary): the pages AI cites most. 24px between bands, 16px between cards, 24px card padding, left edges aligned.
// Flat cards on a 1px hairline (a 1px shadow in light), weights 400 / 600 (the KPI value 500), sentence case, tabular
// numbers. The dashboard's own chart colours: us (ink), the competitor (the first competitor line), the tint and the
// neutral (the graphite data steps); green / red only in the change chips and losing values. Nothing below full opacity
// at rest; the 35% dim applies only to the other column groups while one is hovered. No motion on load.
const TONE = { primary: 'var(--rep-primary)', tint: 'var(--rep-primary-tint)', rival: 'var(--rep-rival)', neutral: 'var(--rep-neutral)', bad: 'var(--rep-down-fg)', good: 'var(--rep-up-fg)' }
const CARD = 'rounded-xl border border-[var(--rep-line)] bg-surface [box-shadow:var(--rep-shadow)]'
const OUTLINE = 'inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-[10px] border border-[var(--rep-line)] bg-surface px-4 text-[15px] leading-5 text-stone-900 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus'
const LABEL = 'text-[14px] leading-5 text-stone-600'
const META = 'text-[13px] leading-[18px] text-stone-500'
const T = 'text-[15px] leading-[22px]'
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const fmt = (n) => new Intl.NumberFormat('en-US').format(n)
const signed = (n, unit = '') => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}${unit}`

function useWidth(initial = 720) {
  const ref = useRef(null)
  const [w, setW] = useState(initial)
  useLayoutEffect(() => {
    if (!ref.current) return undefined
    setW(ref.current.clientWidth)
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// ---- small parts ---------------------------------------------------------------------------------------------------
// the change chip: tinted, 13px, an arrow; green when it's good for you, red when it isn't (worseUp: a rise is bad);
// after it, muted, what it's against ("vs Sep 28")
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
    {items.map((l) => <li key={l.key} className={`inline-flex items-center gap-2 ${LABEL}`}><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TONE[l.tone] }} aria-hidden /><span className="truncate">{l.label}</span></li>)}
  </ul>
)
const CardLabel = ({ children, legend }) => (
  <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-6 gap-y-1">
    <p className={LABEL}>{children}</p>
    {legend && <Legend items={legend} />}
  </div>
)

// ---- band 1: the KPI strip ------------------------------------------------------------------------------------------
function KpiStrip({ kpis }) {
  return (
    <section aria-label="Key numbers" className={`${CARD} grid grid-cols-2 gap-y-5 p-6 max-md:p-5 md:grid-cols-3 lg:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]`} style={{ '--n': kpis.length }}>
      {kpis.map((k, i) => (
        <div key={k.label} className={`min-w-0 px-6 first:pl-0 last:pr-0 ${i ? 'border-l border-[var(--rep-line)]' : ''}`}>
          <p className={`${LABEL} truncate`} title={k.label}>{k.label}</p>
          <p className={`mt-1 truncate text-[32px] leading-10 font-medium tracking-[-0.01em] tabular-nums ${k.bad ? 'text-negative' : 'text-stone-900'}`} title={k.text}>
            {k.text ?? `${k.signed ? (k.value > 0 ? '+' : k.value < 0 ? '−' : '') : ''}${fmt(Math.abs(k.value))}${k.unit ?? ''}`}
            {k.of != null && <span className="text-[14px] font-normal text-stone-500"> of {fmt(k.of)}</span>}
          </p>
          {/* the second line: the change and what it's against, or a muted note; kept even when empty so the cells line up */}
          <p className="mt-1 flex min-h-6 items-center">
            {k.delta != null ? <ChangeChip delta={k.delta} worseUp={k.worseUp} since={k.since} /> : k.sub ? <span className={`${META} truncate`}>{k.sub}</span> : null}
          </p>
        </div>
      ))}
    </section>
  )
}

// ---- band 2, left: columns or lines ---------------------------------------------------------------------------------
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
  const bar = (x, v) => { const yy = y(v); const r = Math.min(2, Math.max(0, base - yy)); return v <= 0 ? '' : `M${x},${yy + r} a${r},${r} 0 0 1 ${r},-${r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${base} H${x} Z` }
  const tip = hover != null ? c.bands[hover] : null
  const name = (x, i) => x.label ?? c.legend[i]?.label ?? ''
  return (
    <div ref={ref} className="relative mt-4 w-full">
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
                {b.bars.map((x, k) => <path key={x.key} d={bar(x0 + k * (bw + 3), x.value)} fill={TONE[x.tone]} />)}
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
// lines over the weeks (share of voice): up to 3 series with dots, the y axis 0–100%, one tooltip per week
function Lines({ c }) {
  const [ref, w] = useWidth(720)
  const [hover, setHover] = useState(null)
  const H = PLOT + TOP + BOT
  const n = c.dates.length
  const hi = c.max ?? 100
  const x = (i) => PAD_L + (i * (w - PAD_L - PAD_R)) / Math.max(1, n - 1)
  const y = (v) => TOP + (1 - v / hi) * PLOT
  const ticks = [0, 25, 50, 75, 100].filter((t) => t <= hi)
  const band = (w - PAD_L - PAD_R) / Math.max(1, n - 1)
  return (
    <div ref={ref} className="relative mt-4 w-full">
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
              <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={TONE[s.tone]} strokeWidth={s.width} strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 4.5 : 3} fill={TONE[s.tone]} stroke="var(--color-surface)" strokeWidth="1.5" />)}
            </g>
          ))}
          {c.dates.map((d, i) => <rect key={d} x={x(i) - band / 2} y={TOP} width={band} height={PLOT} fill="transparent" onMouseEnter={() => setHover(i)} />)}
        </svg>
      )}
      {hover != null && <Tip x={x(hover)} y={y(Math.max(...c.series.map((s) => s.values[hover])))} title={c.dates[hover]} rows={c.series.map((s) => ({ label: s.label, value: `${s.values[hover]}${c.unit}`, tone: s.tone }))} />}
    </div>
  )
}
function LeftCard({ c }) {
  return (
    <section aria-label={c.label} className={`${CARD} p-6 max-md:p-5`}>
      <CardLabel legend={c.legend}>{c.label}</CardLabel>
      {c.kind === 'lines' ? <Lines c={c} /> : <Columns c={c} />}
    </section>
  )
}

// ---- band 2, right: a stacked bar, a diverging bar per topic, or where you stand; then a hairline and By engine -------
function StackedBar({ segs, h = 12, label }) {
  return (
    <div role="img" aria-label={label ?? segs.map((s) => `${s.label ?? s.key} ${s.n}`).join(', ')} className="flex w-full overflow-hidden rounded-[4px]" style={{ height: h, gap: 2 }}>
      {segs.filter((s) => s.n > 0).map((s) => <span key={s.key} style={{ flex: `${s.n} 1 0`, background: TONE[s.tone] }} />)}
    </div>
  )
}
function Stacked({ r }) {
  return (
    <div>
      <StackedBar segs={r.bar} />
      <ul className="mt-3 flex flex-col gap-1.5">
        {r.bar.map((d) => (
          <li key={d.key} className="flex items-center gap-2.5 text-[14px] leading-5 tabular-nums">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TONE[d.tone] }} aria-hidden />
            <span className="min-w-0 truncate text-stone-600">{d.label}</span>
            <span className="ml-auto whitespace-nowrap pl-3 font-semibold text-stone-900">{fmt(d.n)} <span className="font-normal text-stone-500">· {d.share}%</span></span>
          </li>
        ))}
      </ul>
    </div>
  )
}
// a diverging bar per topic from a centre line: gains right in the brand colour, losses left in red, the value at the end
function Diverging({ r }) {
  const max = Math.max(1, ...r.rows.map((x) => Math.abs(x.d)))
  const HALF = 'calc(50% - 28px)' // the room each side of the centre line, leaving space for the value
  return (
    <ul className="flex flex-col gap-1">
      {r.rows.map((x) => {
        const pct = Math.abs(x.d) / max
        return (
          <li key={x.label} className="grid min-h-7 grid-cols-[minmax(0,120px)_minmax(0,1fr)] items-center gap-3">
            <span className={`truncate text-[14px] leading-5 ${x.d === 0 ? 'text-stone-500' : 'text-stone-800'}`} title={x.label}>{x.label}</span>
            <span className="relative h-5" role="img" aria-label={`${x.label} ${signed(x.d)}`}>
              <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--color-line-strong)]" aria-hidden />
              {x.d > 0 && <span className="absolute left-1/2 top-1/2 h-2.5 -translate-y-1/2 rounded-r-[3px]" style={{ width: `calc(${HALF} * ${pct})`, background: TONE.primary }} />}
              {x.d < 0 && <span className="absolute right-1/2 top-1/2 h-2.5 -translate-y-1/2 rounded-l-[3px]" style={{ width: `calc(${HALF} * ${pct})`, background: TONE.bad }} />}
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
// where you stand: a 0–100 track per brand, a hollow start dot → a filled now dot joined by a line, the value at the end
function Standings({ r }) {
  return (
    <ul className="flex flex-col gap-2">
      {r.rows.map((x) => {
        const col = TONE[x.tone]
        const lo = Math.min(x.from, x.now)
        return (
          <li key={x.key} className="grid min-h-7 grid-cols-[minmax(0,132px)_minmax(0,1fr)_44px] items-center gap-3">
            <span className="flex min-w-0 items-center gap-2"><SiteLogo domain={x.domain} name={x.name} className="h-4 w-4 shrink-0 rounded" imgPad="p-0" initialClass="text-[8px]" plate /><span className={`truncate text-[14px] leading-5 ${x.tone === 'primary' ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>{x.name}</span></span>
            <span className="relative h-5" role="img" aria-label={`${x.name}: ${x.from}% to ${x.now}%`}>
              <span className="absolute inset-x-0 top-1/2 h-px bg-[var(--rep-line)]" aria-hidden />
              <span className="absolute top-1/2 h-0.5 -translate-y-1/2" style={{ left: `${lo}%`, width: `${Math.abs(x.now - x.from)}%`, background: col }} aria-hidden />
              <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-surface" style={{ left: `${x.from}%`, borderColor: col }} aria-hidden />
              <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${x.now}%`, background: col }} aria-hidden />
            </span>
            <span className={`text-right text-[14px] tabular-nums ${x.tone === 'primary' ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>{x.now}{r.unit}</span>
          </li>
        )
      })}
    </ul>
  )
}
function RightCard({ r }) {
  const Body = { stacked: Stacked, diverging: Diverging, standings: Standings }[r.kind]
  const by = r.byEngine
  return (
    <section aria-label={r.label} className={`${CARD} flex flex-col p-6 max-md:p-5`}>
      <CardLabel legend={r.legend}>{r.label}</CardLabel>
      <div className="mt-4">{Body && <Body r={r} />}</div>
      {(by || r.list) && (
        <div className="mt-5 border-t border-[var(--rep-line)] pt-4">
          <p className={LABEL}>{r.list ? r.list.label : 'By engine'}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {by?.rows.map((e) => (
              e.segs
                ? <li key={e.id} className="grid grid-cols-[112px_minmax(0,1fr)_auto] items-center gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-[14px] leading-5 text-stone-900"><EngineMark id={e.id} size={16} /><span className="truncate">{e.name}</span></span>
                    <StackedBar segs={e.segs} h={8} label={`${e.name}: ${e.segs.map((x) => `${x.key} ${x.n}`).join(', ')}`} />
                    <span className={`${META} whitespace-nowrap tabular-nums`}>{e.note}</span>
                  </li>
                : <li key={e.id} className="flex items-center gap-2 text-[14px] leading-5 tabular-nums text-stone-900"><EngineMark id={e.id} size={16} />{e.text}</li>
            ))}
            {r.list?.rows.map((x) => (
              <li key={x.key} className="flex items-center gap-2 text-[14px] leading-5 tabular-nums"><SiteLogo domain={x.domain} name={x.name} className="h-4 w-4 shrink-0 rounded" imgPad="p-0" initialClass="text-[8px]" plate /><span className="min-w-0 truncate text-stone-900">{x.name}</span><span className="ml-auto pl-3 text-stone-600">{fmt(x.n)} prompts</span></li>
            ))}
            {by?.off?.length > 0 && <li className={`${META}`}>{by.off.join(', ')} · didn’t run</li>}
          </ul>
        </div>
      )}
    </section>
  )
}

// ---- band 3: the slim table -----------------------------------------------------------------------------------------
const SORT_KEY = { engine: 'engineName', step: 'id' }
function TableCard({ t, source, notes = [] }) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState({})
  const [sort, setSort] = useState({ key: null, dir: 1 })
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState(() => new Set())
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    let out = t.rows.filter((r) => (!s || `${r.text} ${r.topic ?? ''} ${r.result ?? ''}`.toLowerCase().includes(s)) && t.filters.every((f) => !picked[f.key] || r[f.by ?? f.key] === picked[f.key]))
    if (sort.key) {
      const k = SORT_KEY[sort.key] ?? sort.key
      out = [...out].sort((a, b) => (typeof a[k] === 'number' ? a[k] - b[k] : String(a[k]).localeCompare(String(b[k]))) * sort.dir)
    }
    return out
  }, [t, q, picked, sort])
  const shown = all ? rows : rows.slice(0, t.pageSize)
  const right = (c) => c.kind === 'num'
  const toggle = (id) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const th = (c) => (
    <th key={c.key} scope="col" className={`whitespace-nowrap px-4 py-3 text-[14px] leading-5 font-semibold text-stone-900 first:pl-6 ${right(c) ? 'text-right' : 'text-left'}`}>
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
      case 'lead': {
        const max = Math.max(1, ...t.rows.map((x) => Math.abs(x.lead ?? 0)))
        const pct = (Math.abs(v) / max) * 50
        return (
          <span className="inline-flex items-center gap-3">
            <span className="relative h-2.5 w-[120px]" role="img" aria-label={`${signed(v)} points`}>
              <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--color-line-strong)]" aria-hidden />
              <span className={`absolute inset-y-0 ${v >= 0 ? 'left-1/2 rounded-r-[3px]' : 'right-1/2 rounded-l-[3px]'}`} style={{ width: `${pct}%`, background: v >= 0 ? TONE.primary : TONE.bad }} />
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
      <div className="flex flex-wrap items-center gap-3 p-6 max-md:p-5">
        <label className="relative flex h-11 min-w-[240px] flex-1 items-center">
          <Search size={16} className="pointer-events-none absolute left-3.5 text-stone-500" aria-hidden />
          <span className="sr-only">{t.searchLabel}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchLabel}
            className="h-11 w-full rounded-[10px] border border-[var(--rep-line)] bg-surface pl-10 pr-3 text-[15px] text-stone-900 outline-none placeholder:text-stone-500 focus:border-line-strong" />
        </label>
        {t.filters.map((f) => (
          <FrameMenu key={f.key} label={f.label} value={picked[f.key] ?? null} onChange={(id) => setPicked((p) => ({ ...p, [f.key]: id }))} options={[{ id: null, label: f.all }, ...f.options]} />
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead><tr className="border-y border-[var(--rep-line)]" style={{ background: 'var(--rep-head)' }}>{t.columns.map(th)}<th scope="col" className="w-14 pr-4"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {shown.map((r) => {
              const isOpen = t.expandable && open.has(r.id)
              return [
                <tr key={r.id} onClick={t.expandable ? () => toggle(r.id) : undefined} aria-expanded={t.expandable ? isOpen : undefined}
                  className={`h-14 border-b border-[var(--rep-line)] transition-colors duration-100 last:border-0 hover:bg-tint ${t.expandable ? 'cursor-pointer' : ''} ${isOpen ? 'bg-tint' : ''}`}>
                  {t.columns.map((c) => <td key={c.key} className={`whitespace-nowrap px-4 py-1.5 align-middle first:pl-6 ${c.kind === 'text' ? 'max-w-[360px]' : 'w-[1%]'} ${right(c) ? 'text-right' : ''}`}>{cell(r, c)}</td>)}
                  <td className="pr-4 align-middle" onClick={(e) => e.stopPropagation()}>
                    <ActionMenu label={`Actions for ${r.text}`} className="grid h-9 w-9 place-items-center rounded-lg text-stone-500 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"
                      items={[{ label: 'Open in Prompt Hub', onClick: () => navigate(r.href) }, { label: 'Copy', onClick: () => { try { navigator.clipboard?.writeText(r.text) } catch { /* no clipboard */ } } }]}>
                      <MoreHorizontal size={16} aria-hidden />
                    </ActionMenu>
                  </td>
                </tr>,
                isOpen && (
                  <tr key={`${r.id}-x`} className="border-b border-[var(--rep-line)]">
                    <td colSpan={t.columns.length + 1} className="px-6 py-4">
                      <div className="grid gap-x-8 gap-y-3 md:grid-cols-[minmax(0,1fr)_240px]">
                        <ul className="columns-2 gap-x-8 text-[14px] leading-6 text-stone-500">{r.expand?.prompts?.map((p) => <li key={p} className="truncate" title={p}>{p}</li>)}{!r.expand?.prompts?.length && <li>No prompts listed for this topic.</li>}</ul>
                        {r.expand?.lines?.length > 0 && <ul className="flex flex-col gap-1 text-[14px] leading-6 tabular-nums text-stone-700">{r.expand.lines.map((l) => <li key={l}>{l}</li>)}</ul>}
                      </div>
                    </td>
                  </tr>
                ),
              ]
            })}
            {shown.length === 0 && <tr><td colSpan={t.columns.length + 1} className={`px-6 py-10 text-center ${LABEL}`}>Nothing matches</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-[var(--rep-line)] px-6 py-3.5">
        <div className="min-w-0">
          {source && <p className={`${META} tabular-nums`}>{source}</p>}
          {t.note && <p className={`${META} tabular-nums`}>{t.note}</p>}
          {notes.map((n) => <p key={n} className={`${META}`}>Not in your data: {n}</p>)}
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
  return (
    <section aria-label={p.label} className={`${CARD} p-6 max-md:p-5`}>
      <CardLabel>{p.label}</CardLabel>
      <ul className="mt-3 flex flex-col divide-y divide-[var(--rep-line)]">
        {p.rows.map((r) => (
          <li key={r.path} className="grid min-h-11 grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_104px] items-center gap-4 py-1.5 max-md:grid-cols-[minmax(0,1fr)_88px]">
            <span className={`truncate ${T} text-stone-900`} title={r.path}>{r.path}</span>
            <span className={`truncate ${T} text-stone-500 max-md:hidden`}>{r.type}</span>
            <span className="relative h-2.5 max-md:hidden" aria-hidden><span className="absolute inset-y-0 left-0 rounded-[3px]" style={{ width: `${(r.n / max) * 100}%`, background: TONE.primary }} /></span>
            <span className={`text-right ${T} tabular-nums text-stone-900`}>{fmt(r.n)} <span className="text-stone-500">answers</span></span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---- the frame ------------------------------------------------------------------------------------------------------
const FREQ = [{ id: 'once', label: 'One-off' }, { id: 'week', label: 'Weekly' }, { id: 'month', label: 'Monthly' }]
export default function ReportFrame({ built, onPeriod, onSchedule, actions = [], print = false }) {
  const f = built.frame
  const o = built.opts
  const periods = PERIODS.filter((p) => p.id !== 'custom').map((p) => ({ id: p.id, label: p.id === o.period ? f.range : p.label }))
  const src = built.blocks.find((b) => b.type === 'sources')?.data
  const source = src ? `Source: ${src.syncs} weekly syncs, ${src.span} · ${src.engines.join(', ')}${src.off?.length ? ` · ${src.off.join(' and ')} didn’t run` : ''}` : null
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 lg:flex-nowrap">
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
      <KpiStrip kpis={f.kpis} />
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <LeftCard c={f.left} />
        <RightCard r={f.right} />
      </div>
      <TableCard t={f.table} source={source} notes={f.notInData ?? []} />
      {f.pages && <PagesCard p={f.pages} />}
    </div>
  )
}
