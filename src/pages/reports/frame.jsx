import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Calendar, Check, ChevronDown, ChevronsUpDown, MoreHorizontal, Search } from 'lucide-react'
import ActionMenu from '../../components/audit/ActionMenu'
import { EngineMark } from '../insights/parts'
import { navigate } from '../../router'
import { PERIODS, periodLabel } from '../../data/reports'
import { menuItem } from './parts'

// The report frame: the same for every report type. Header (the question as the H1, one finding sentence, the date range,
// the frequency, Export) · row 1: the chart card (2/3) and the summary card (1/3) · row 2: the table card. Flat cards on
// a 1px hairline, 12px radius, 28px padding, no shadow. Two weights (400 / 600), sentence case, tabular numbers. One hue
// in two shades (us), one accent (the main competitor), grey (nobody); green / red only in the change chips. No motion
// on load; the tooltip fades in, rows tint on hover, dropdowns open.
const TONE = { primary: 'var(--rep-primary)', tint: 'var(--rep-tint)', teal: 'var(--rep-teal)', grey: 'var(--rep-grey)' }
const CARD = 'rounded-xl border border-[var(--rep-line)] bg-surface'
const OUTLINE = 'inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-[10px] border border-[var(--rep-line)] bg-surface px-4 text-[15px] leading-5 text-stone-900 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus'
const LABEL = 'text-[14px] leading-5 text-stone-600'
const META = 'text-[13px] leading-[18px] text-stone-500'
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const fmt = (n) => new Intl.NumberFormat('en-US').format(n)

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
// the change chip: tinted, 13px, an arrow; green when it's good for you, red when it isn't (worseUp: a rise is bad)
export function ChangeChip({ delta, worseUp = false, unit = '', className = '' }) {
  if (delta == null) return null
  const good = delta === 0 ? null : worseUp ? delta < 0 : delta > 0
  const style = good == null ? { background: 'var(--tint)', color: 'var(--color-stone-600)' } : good ? { background: 'var(--rep-up-bg)', color: 'var(--rep-up-fg)' } : { background: 'var(--rep-down-bg)', color: 'var(--rep-down-fg)' }
  const Arrow = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : null
  return (
    <span className={`inline-flex h-6 items-center gap-0.5 rounded-md px-1.5 text-[13px] leading-none tabular-nums ${className}`} style={style}>
      {Arrow && <Arrow size={12} strokeWidth={2.25} aria-hidden />}{delta > 0 ? '+' : delta < 0 ? '−' : ''}{Math.abs(delta)}{unit}
    </span>
  )
}

// an outline dropdown (44px, 10px radius): the trigger shows its value; the menu lists the options
function FrameSelect({ icon: Icon, label, value, options, onChange, align = 'right' }) {
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
  const cur = options.find((o) => o.id === value)
  return (
    <div ref={wrap} className="relative">
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`${label}: ${cur?.label ?? value}`} onClick={() => setOpen((o) => !o)} className={OUTLINE}>
        {Icon && <Icon size={16} className="text-stone-600" aria-hidden />}{cur?.label ?? value}<ChevronDown size={16} className={`text-stone-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label={label} className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full z-40 mt-1.5 w-56 rounded-[10px] border border-[var(--rep-line)] bg-raised p-1 motion-safe:animate-[fade-in_120ms_ease-out]`}>
          {options.map((o) => (
            <button key={o.id ?? 'all'} type="button" role="menuitemradio" aria-checked={o.id === value} onClick={() => { setOpen(false); onChange?.(o.id); btn.current?.focus() }} className={`${menuItem} text-stone-900`}>
              <span className="min-w-0 flex-1 truncate">{o.label}</span>{o.id === value && <Check size={14} className="shrink-0 text-ink" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- the chart card: label, the value with its change, the legend; one columns chart with axes -----------------------
const splitLabel = (s) => {
  if (s.length <= 13) return [s]
  const words = s.split(' ')
  let best = [s, '']
  let gap = Infinity
  for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(' '); const b = words.slice(i).join(' '); const g = Math.abs(a.length - b.length); if (g < gap) { gap = g; best = [a, b] } }
  return best
}
function Columns({ c }) {
  const [ref, w] = useWidth(720)
  const [hover, setHover] = useState(null)
  const H = 300
  const padL = 44
  const padR = 8
  const top = 16
  const bot = 48
  const n = c.bands.length
  const max = Math.max(1, ...c.bands.flatMap((b) => [b.you, b.them]))
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => max / s <= 5) ?? 100
  const hi = Math.ceil(max / step) * step
  const ticks = []
  for (let t = 0; t <= hi; t += step) ticks.push(t)
  const band = (w - padL - padR) / n
  const pair = band * 0.55
  const bw = (pair - 3) / 2
  const y = (v) => top + (1 - v / hi) * (H - top - bot)
  const base = y(0)
  const bar = (x, v) => { const yy = y(v); const r = Math.min(2, Math.max(0, base - yy)); return v <= 0 ? '' : `M${x},${yy + r} a${r},${r} 0 0 1 ${r},-${r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${base} H${x} Z` }
  const tip = hover != null ? c.bands[hover] : null
  const tipX = hover != null ? padL + hover * band + band / 2 : 0
  const tipY = tip ? y(Math.max(tip.you, tip.them)) : 0
  return (
    <div ref={ref} className="relative mt-6 w-full">
      {w > 0 && (
        <svg width={w} height={H} role="img" aria-label={`${c.title}: ${c.bands.map((b) => `${b.topic} ${c.legend[0].label} ${b.you}, ${c.legend[1].label} ${b.them}`).join('; ')}`} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              {t > 0 && <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--rep-line)" strokeDasharray="3 3" />}
              <text x={padL - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-stone-500 text-[13px] tabular-nums">{fmt(t)}</text>
            </g>
          ))}
          <line x1={padL} x2={w - padR} y1={base} y2={base} stroke="var(--color-line-strong)" />
          {c.bands.map((b, i) => {
            const x0 = padL + i * band + band / 2 - pair / 2
            const lines = splitLabel(b.topic)
            return (
              <g key={b.topic} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={padL + i * band} y={top} width={band} height={H - top - bot} fill="transparent" />
                <path d={bar(x0, b.you)} fill={TONE.primary} />
                <path d={bar(x0 + bw + 3, b.them)} fill={TONE.teal} />
                {lines.map((l, k) => <text key={k} x={padL + i * band + band / 2} y={base + 20 + k * 16} textAnchor="middle" className="fill-stone-600 text-[13px]">{l}</text>)}
              </g>
            )
          })}
        </svg>
      )}
      {tip && (
        <div role="tooltip" className="pointer-events-none absolute z-20 rounded-lg border px-3 py-2.5 text-[13px] leading-[18px]"
          style={{ left: tipX, top: tipY - 12, transform: 'translate(-50%, -100%)', background: 'var(--rep-tip)', borderColor: 'var(--rep-tip-line)', color: 'var(--rep-tip-fg)', animation: reducedMotion() ? 'none' : 'rep-tip 120ms ease-out' }}>
          <p className="whitespace-nowrap" style={{ color: 'var(--rep-tip-meta)' }}>{tip.topic}</p>
          <p className="mt-1 flex items-center gap-2 whitespace-nowrap tabular-nums"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TONE.primary }} aria-hidden />{c.legend[0].label}<b className="ml-auto pl-4 font-semibold">{fmt(tip.you)}</b></p>
          <p className="mt-0.5 flex items-center gap-2 whitespace-nowrap tabular-nums"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TONE.teal }} aria-hidden />{c.legend[1].label}<b className="ml-auto pl-4 font-semibold">{fmt(tip.them)}</b></p>
          <span aria-hidden className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r" style={{ background: 'var(--rep-tip)', borderColor: 'var(--rep-tip-line)' }} />
        </div>
      )}
    </div>
  )
}
function ChartCard({ c }) {
  return (
    <section aria-label={c.title} className={`${CARD} p-7 max-md:p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className={LABEL}>{c.label}</p>
          <p className="mt-1 flex items-center gap-3">
            <span className="text-[40px] leading-[48px] font-normal tracking-[-0.01em] tabular-nums text-stone-900">{fmt(c.value)}</span>
            <ChangeChip delta={c.delta} />
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-1" aria-label="Legend">
          {c.legend.map((l) => <li key={l.key} className={`inline-flex items-center gap-2 ${LABEL}`}><span className="h-2.5 w-2.5 rounded-full" style={{ background: TONE[l.tone] }} aria-hidden />{l.label}</li>)}
        </ul>
      </div>
      <Columns c={c} />
    </section>
  )
}

// ---- the summary card: a title, a donut with its legend, two stat cells ---------------------------------------------
function Donut({ segs, size = 124, ring = 16 }) {
  const r = (size - ring) / 2
  const C = 2 * Math.PI * r
  const total = Math.max(1, segs.reduce((a, s) => a + s.n, 0))
  const gap = segs.filter((s) => s.n > 0).length > 1 ? 2 : 0
  let at = 0
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} role="img" aria-label={segs.map((s) => `${s.label} ${s.n}`).join(', ')} className="shrink-0">
      {segs.map((s) => {
        const len = (s.n / total) * C
        const from = at
        at += len
        if (s.n <= 0) return null
        return <circle key={s.key} r={r} cx="0" cy="0" fill="none" stroke={TONE[s.tone]} strokeWidth={ring} strokeDasharray={`${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}`} strokeDashoffset={-from} transform="rotate(-90)" />
      })}
    </svg>
  )
}
function SummaryCard({ s }) {
  return (
    <section aria-label={s.title} className={`${CARD} flex flex-col p-7 max-md:p-5`}>
      <h2 className="text-[20px] leading-7 font-semibold text-stone-900">{s.title}</h2>
      <div className="mt-6 flex items-center gap-6">
        <Donut segs={s.donut} />
        <ul className="flex min-w-0 flex-1 flex-col gap-2.5">
          {s.donut.map((d) => (
            <li key={d.key} className="flex items-center gap-2.5 text-[14px] leading-5 tabular-nums">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TONE[d.tone] }} aria-hidden />
              <span className="min-w-0 text-stone-600">{d.label}</span><span className="ml-auto pl-3 font-semibold text-stone-900">{fmt(d.n)}</span>
            </li>
          ))}
        </ul>
      </div>
      <dl className="mt-auto grid grid-cols-2 divide-x divide-[var(--rep-line)] border-t border-[var(--rep-line)] pt-6 max-md:mt-6">
        {s.stats.map((st, i) => (
          <div key={st.label} className={`min-w-0 ${i ? 'pl-6' : 'pr-6'}`}>
            <dt className={LABEL}>{st.label}</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-[22px] leading-7 font-semibold tabular-nums text-stone-900">{fmt(st.value)}{st.unit ?? ''}</span>
              <ChangeChip delta={st.delta} worseUp={st.worseUp} />
              {st.sub && <span className={`${META} tabular-nums`}>{st.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// ---- the table card: search and filters, a header on a light fill, rows with a status circle, 10 then Show all N ------
function TableCard({ t }) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState({})
  const [sort, setSort] = useState({ key: null, dir: 1 })
  const [all, setAll] = useState(false)
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    let out = t.rows.filter((r) => (!s || `${r.text} ${r.topic} ${r.result}`.toLowerCase().includes(s)) && t.filters.every((f) => !picked[f.key] || r[f.by ?? f.key] === picked[f.key]))
    if (sort.key) out = [...out].sort((a, b) => String(a[sort.key === 'engine' ? 'engineName' : sort.key]).localeCompare(String(b[sort.key === 'engine' ? 'engineName' : sort.key])) * sort.dir)
    return out
  }, [t, q, picked, sort])
  const shown = all ? rows : rows.slice(0, t.pageSize)
  const th = (c) => (
    <th key={c.key} scope="col" className={`whitespace-nowrap px-4 py-3 text-left text-[15px] leading-5 font-semibold text-stone-900 first:pl-7 ${c.align === 'right' ? 'text-right' : ''}`}>
      {c.sort
        ? <button type="button" onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : 1 }))} aria-sort={sort.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}
            className="inline-flex items-center gap-1.5 rounded outline-none hover:text-stone-700 focus-visible:ring-2 focus-visible:ring-focus">{c.label}<ChevronsUpDown size={14} className="text-stone-500" aria-hidden /></button>
        : c.label}
    </th>
  )
  const cell = (r, c) => {
    if (c.key === 'text') return (
      <span className="flex items-start gap-3">
        <span className="mt-[3px] h-4 w-4 shrink-0 rounded-full border-2" style={{ borderColor: TONE[r.tone] ?? TONE.grey }} aria-hidden />
        <span className="line-clamp-2 text-[15px] leading-[22px] text-stone-900 [overflow-wrap:normal]">{r.text}</span>
      </span>
    )
    if (c.key === 'engine') return <span className="inline-flex items-center gap-2 text-[15px] leading-5 text-stone-900"><EngineMark id={r.engine} size={16} />{r.engineName}</span>
    if (c.key === 'page') return r.page ? <span className="flex min-w-0 flex-col"><span className="truncate text-[15px] leading-5 text-stone-900" title={`${r.page.domain}${r.page.path}`}>{r.page.path}</span><span className={`${META} tabular-nums`}>{r.page.n} answers</span></span> : <span className={META}>None</span>
    return <span className={`text-[15px] leading-5 text-stone-900 ${c.align === 'right' ? 'tabular-nums' : ''}`}>{r[c.key]}</span>
  }
  return (
    <section aria-label={t.title} className={`${CARD} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-3 p-7 max-md:p-5">
        <label className="relative flex h-11 min-w-[240px] flex-1 items-center">
          <Search size={16} className="pointer-events-none absolute left-3.5 text-stone-500" aria-hidden />
          <span className="sr-only">{t.searchLabel}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchLabel}
            className="h-11 w-full rounded-[10px] border border-[var(--rep-line)] bg-surface pl-10 pr-3 text-[15px] text-stone-900 outline-none placeholder:text-stone-500 focus:border-line-strong" />
        </label>
        {t.filters.map((f) => (
          <FrameSelect key={f.key} label={f.label} value={picked[f.key] ?? null} onChange={(id) => setPicked((p) => ({ ...p, [f.key]: id }))}
            options={[{ id: null, label: `All ${f.label.toLowerCase()}s` }, ...f.options.map((o) => ({ id: o, label: o }))]} />
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead><tr className="border-y border-[var(--rep-line)]" style={{ background: 'var(--rep-head)' }}>{t.columns.map(th)}<th scope="col" className="w-14 pr-5"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-[var(--rep-line)] transition-colors duration-150 last:border-0 hover:bg-tint">
                {t.columns.map((c) => <td key={c.key} className={`px-4 py-4 align-top first:pl-7 ${c.key === 'text' ? 'min-w-[260px]' : 'w-[1%] whitespace-nowrap'} ${c.align === 'right' ? 'text-right' : ''}`}>{cell(r, c)}</td>)}
                <td className="pr-5 pt-2.5 align-top">
                  <ActionMenu label={`Actions for ${r.text}`} className="grid h-9 w-9 place-items-center rounded-lg text-stone-500 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"
                    items={[{ label: 'Open in Prompt Hub', onClick: () => navigate(r.href) }, { label: 'Copy prompt', onClick: () => { try { navigator.clipboard?.writeText(r.text) } catch { /* no clipboard */ } } }]}>
                    <MoreHorizontal size={16} aria-hidden />
                  </ActionMenu>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={t.columns.length + 1} className={`px-7 py-10 text-center ${LABEL}`}>No prompts match</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > t.pageSize && (
        <div className="border-t border-[var(--rep-line)] px-7 py-4">
          <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all} className={OUTLINE}>{all ? 'Show fewer' : `Show all ${rows.length}`}</button>
        </div>
      )}
    </section>
  )
}

// ---- the frame ------------------------------------------------------------------------------------------------------
const FREQ = [{ id: 'once', label: 'One-off' }, { id: 'week', label: 'Weekly' }, { id: 'month', label: 'Monthly' }]
export default function ReportFrame({ built, onPeriod, onExport, onSchedule, print = false }) {
  const f = built.frame
  const o = built.opts
  const periods = PERIODS.filter((p) => p.id !== 'custom').map((p) => ({ id: p.id, label: p.id === o.period ? f.range : p.label }))
  const src = built.blocks.find((b) => b.type === 'sources')?.data
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 lg:flex-nowrap">
        <div className="min-w-0 flex-1 max-w-[760px]">
          <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.01em] text-stone-900 [text-wrap:balance] max-md:text-[26px] max-md:leading-8">{f.question}</h1>
          <p className="mt-2 text-[16px] leading-6 font-normal text-stone-600 [text-wrap:pretty]">{f.finding}</p>
        </div>
        {!print && (
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <FrameSelect icon={Calendar} label="Date range" value={o.period} options={periods} onChange={(id) => id !== o.period && onPeriod?.(id, periodLabel(id))} />
            <FrameSelect label="Frequency" value="once" options={FREQ} onChange={(id) => id !== 'once' && onSchedule?.(id)} />
            <button type="button" onClick={onExport} className={OUTLINE}>Export</button>
          </div>
        )}
      </header>
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ChartCard c={f.chart} />
        <SummaryCard s={f.summary} />
      </div>
      <TableCard t={f.table} />
      {src && <p className={`${META} tabular-nums`}>Source: {src.syncs} weekly syncs, {src.span} · {src.engines.join(', ')}{src.off?.length ? ` · ${src.off.join(' and ')} didn’t run` : ''}</p>}
    </div>
  )
}
