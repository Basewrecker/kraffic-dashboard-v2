import { useId, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, FilePlus2, Megaphone, MessageCircleQuestion } from 'lucide-react'
import SiteLogo from '../../components/ui/SiteLogo'
import { EngineMark } from '../insights/parts'

// The report's block library, on a 12-column grid. Same bands for every kind: a hero band (headline, stat chips, one big
// visual answer) · numbered sections (7 + 5 side by side, or full width) · action cards · a one-line footer. Graphite;
// red only for what's going against the brand; brand colours only in the trend lines and the logos.
export const t2 = 'text-stone-600'
export const t3 = 'text-stone-500'
const AUDIENCE = { team: 'For the team', ceo: 'For the CEO', client: 'For the client' }
const signed = (n, unit = '') => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}${unit}`
const INK = 'var(--ink)'
const RED = 'var(--negative)'
const soft = (c, p) => `color-mix(in srgb, ${c} ${p}%, transparent)`
const GREY = 'var(--color-stone-300)'

function useWidth(initial = 640) {
  const ref = useRef(null)
  const [w, setW] = useState(initial)
  useLayoutEffect(() => {
    if (!ref.current) return
    setW(ref.current.clientWidth)
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// ---- small parts ---------------------------------------------------------------------------------------------------
const TONE = { 'Good week': 'up', 'Good month': 'up', Winning: 'up', Mixed: 'mid', Opportunity: 'mid', 'Tough week': 'down', 'Tough month': 'down', Losing: 'down' }
export function VerdictChip({ verdict, small = false }) {
  const tone = TONE[verdict] ?? 'mid'
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border ${small ? 'h-6 px-2 text-[12px]' : 'h-7 px-2.5 text-[13px]'} font-medium leading-none ${tone === 'down' ? 'border-[color-mix(in_srgb,var(--negative)_35%,transparent)] text-negative' : tone === 'up' ? 'border-line-strong text-stone-900' : 'border-line text-stone-700'}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone === 'down' ? RED : tone === 'up' ? INK : 'var(--color-stone-400)' }} aria-hidden />
      {verdict}
    </span>
  )
}

export function VerdictDot({ verdict, className = '' }) {
  const tone = TONE[verdict] ?? 'mid'
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] leading-4 font-medium ${tone === 'down' ? 'text-negative' : tone === 'up' ? 'text-stone-900' : 'text-stone-600'} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone === 'down' ? RED : tone === 'up' ? INK : 'var(--color-stone-400)' }} aria-hidden />
      {verdict}
    </span>
  )
}

export function Sparkline({ series, w = 96, h = 28, color = INK, fill = true }) {
  const id = useId()
  if (!series?.length) return null
  const lo = Math.min(...series)
  const hi = Math.max(...series)
  const x = (i) => 1 + (i * (w - 2)) / (series.length - 1)
  const y = (v) => (hi === lo ? h / 2 : 2 + (1 - (v - lo) / (hi - lo)) * (h - 4))
  const pts = series.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  return (
    <svg width={w} height={h} aria-hidden className="block shrink-0 overflow-visible">
      {fill && (
        <>
          <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.14" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          <polygon points={`${x(0)},${h} ${pts} ${x(series.length - 1)},${h}`} fill={`url(#${id})`} />
        </>
      )}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(series.length - 1)} cy={y(series.at(-1))} r="2.25" fill={color} />
    </svg>
  )
}

// "8 prompts ▾" → a clean list (prompts never run on in a sentence)
export function PromptsToggle({ prompts, n = prompts.length, label }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  if (!prompts?.length) return null
  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
        className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 -mx-1.5 text-[12px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
        {label ?? `${n} ${n === 1 ? 'prompt' : 'prompts'}`}<ChevronDown size={12} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <ul id={id} className="mt-1 divide-y divide-[var(--div)] border-y border-[var(--div)] motion-safe:animate-[fade-in_150ms_ease-out]">
          {prompts.map((p) => <li key={p} className="py-1.5 text-[13px] leading-[18px] text-stone-800">{p}</li>)}
          {n > prompts.length && <li className={`py-1.5 text-[12px] ${t3}`}>+{n - prompts.length} more in Prompt Hub</li>}
        </ul>
      )}
    </div>
  )
}

// ---- the type scale (the only sizes in a report): headline 28/600 · big numbers 44 and 24/600 · section titles 17/600 · body 15 · labels 13 t2 ·
// meta 12 t3 · values 28/600. Numbers are tabular.
const LABEL = 'text-[13px] leading-[18px] text-stone-600'
const META = 'text-[12px] leading-4 text-stone-500'
const BODY = 'text-[15px] leading-6'
const VALUE = 'text-[28px] leading-8 font-semibold tracking-[-0.01em] tabular-nums'
const pad2 = (n) => String(n).padStart(2, '0')
const joinAnd = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

// a sparkline as wide as its column, 24px tall
function LineFill({ series, color = INK, h = 24 }) {
  const [ref, w] = useWidth(160)
  return <div ref={ref} className="mt-2 w-full">{w > 0 && <Sparkline series={series} w={w} h={h} color={color} fill={false} />}</div>
}
// metric columns separated by hairlines, no outer box (the scoreline, and the engines)
function MetricCols({ items, cols = 4 }) {
  const md = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' }[cols] ?? 'md:grid-cols-4'
  return (
    <div className={`grid grid-cols-2 ${md}`}>
      {items.map((m, i) => (
        <div key={m.id} className={`min-w-0 py-1 ${i % 2 ? 'border-l border-line pl-4 md:pl-5' : 'pr-4 md:pr-5'} ${i > 1 ? 'max-md:mt-4 max-md:border-t max-md:pt-4' : ''} ${i > 0 && i % 2 === 0 ? 'md:border-l md:border-line md:pl-5' : ''}`}>
          <span className={`block truncate ${LABEL} ${m.tip ? 'cursor-help underline decoration-dotted decoration-stone-400 underline-offset-[3px]' : ''}`} title={m.tip}>{m.label}</span>
          <span className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className={`${VALUE} ${m.against ? 'text-negative' : 'text-stone-900'}`}>{m.value}</span>
            {m.of != null && <span className={`${LABEL} tabular-nums`}>/ {m.of}</span>}
            <span className={`text-[13px] leading-[18px] tabular-nums ${m.bad ? 'font-medium text-negative' : 'text-stone-600'}`}>{m.delta}</span>
          </span>
          <LineFill series={m.series} color={m.against ? RED : INK} />
        </div>
      ))}
    </div>
  )
}

// ---- 1. header (the library's and the email's previews of an earlier run)
function Header({ data: d }) {
  return (
    <header>
      <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${META} tabular-nums`}>
        <VerdictDot verdict={d.verdict} />
        <span>· {d.brand} · {d.span ?? d.period} · {(d.counted?.length ? d.counted.join(', ') : d.engines)} · {AUDIENCE[d.audience]}</span>
      </p>
      <h1 className="mt-3 max-w-[40ch] text-[28px] leading-9 font-semibold tracking-[-0.01em] text-stone-900 [text-wrap:balance] max-md:text-[24px] max-md:leading-[31px]">{d.headline}</h1>
    </header>
  )
}
// ---- 2. scoreline (the same previews): 4 columns, hairlines between, a sparkline under each value
function Scoreline({ data: d }) {
  return (
    <MetricCols items={d.items.map((m) => {
      const good = m.lowerIsBetter ? m.delta < 0 : m.delta > 0
      return {
        id: m.id, label: m.label, tip: `vs ${d.since} · last 8 weeks`, value: `${m.value}${m.unit === '%' ? '%' : ''}`, of: m.of, against: false,
        delta: signed(m.delta, m.unit === '%' ? ' pts' : m.unit ?? ''), bad: m.delta !== 0 && (m.against ? m.delta > 0 : !good), series: m.series,
      }
    })} />
  )
}

// ---- the hero (no panel): the verdict, the headline, one inline stat row; on the right one visual answer ------------
// ▲ / ▼ with the change; red only when it's going against the brand
function Delta({ n, unit = '', bad, className = '' }) {
  if (n == null) return null
  return <span className={`whitespace-nowrap tabular-nums ${bad ? 'font-medium text-negative' : 'text-stone-600'} ${className}`}>{n > 0 ? '▲' : n < 0 ? '▼' : '±'}{Math.abs(n)}{n === 0 ? '' : unit}</span>
}
// the stats under the headline: one row, vertical hairlines between, no boxes
function StatRow({ chips }) {
  return (
    <dl className="mt-6 grid grid-cols-3">
      {chips.map((c, i) => {
        const unit = c.unit === '%' ? '%' : c.unit ?? ''
        const bad = c.delta != null && c.delta !== 0 && (c.against ? c.delta > 0 : c.delta < 0)
        return (
          <div key={c.id} className={`min-w-0 ${i ? 'border-l border-line pl-5 max-md:pl-3' : ''} pr-5 max-md:pr-3`}>
            <dt className={`${META} text-stone-600 md:truncate`}>{c.label}</dt>
            <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-[17px] leading-6 font-semibold tabular-nums text-stone-900">{c.value}{unit}{c.of != null && <span className="font-normal text-stone-500">/{c.of}</span>}</span>
              <Delta n={c.delta} bad={bad} className="text-[12px] leading-4" />
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
// an arc on a ring: from 12 o'clock, clockwise, as fractions of the whole
function Arc({ r, from, to, color, w }) {
  const C = 2 * Math.PI * r
  return <circle r={r} cx="0" cy="0" fill="none" stroke={color} strokeWidth={w} strokeDasharray={`${Math.max(0, (to - from) * C)} ${C}`} strokeDashoffset={-from * C} transform="rotate(-90)" />
}
const RING = 164
const RW = 14
const TRACK = 'color-mix(in srgb, var(--ink) 9%, transparent)'
const BIG = 'text-[44px] leading-[48px] font-semibold tracking-[-0.02em] tabular-nums'
function RingFrame({ children, label, sub, center }) {
  return (
    <figure className="flex flex-col items-center text-center">
      {label && <figcaption className={LABEL}>{label}</figcaption>}
      <div className="relative mt-3" style={{ width: RING, height: RING }}>
        <svg viewBox={`${-RING / 2} ${-RING / 2} ${RING} ${RING}`} width={RING} height={RING} aria-hidden className="block">{children}</svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">{center}</div>
      </div>
      {sub && <p className={`mt-3 ${LABEL}`}>{sub}</p>}
    </figure>
  )
}
// weekly: the visibility score, last 8 weeks. One slim column per weekly sync (height = the score, out of 100); this
// week in ink with its number above it, earlier weeks in the border tint. A week that wasn't scanned: an empty outline
function Strip({ v }) {
  const [hov, setHov] = useState(null)
  const last = v.weeks.length - 1
  const tip = hov != null ? v.weeks[hov] : null
  return (
    <figure className="w-full max-w-[380px]">
      <div className="flex items-end justify-between gap-4">
        <figcaption className={META}>{v.label}</figcaption>
        <span className="text-right">
          <span className="block text-[28px] leading-8 font-semibold tracking-[-0.01em] tabular-nums text-stone-900">{v.value ?? '–'}</span>
          <span className="block text-[13px] leading-[18px]"><Delta n={v.delta} bad={v.delta < 0} /> <span className="text-stone-500">vs last week</span></span>
        </span>
      </div>
      <div className="relative mt-3 flex h-24 items-end gap-1.5" onMouseLeave={() => setHov(null)} role="img"
        aria-label={`Visibility score by week: ${v.weeks.map((w) => `${w.date} ${w.score ?? 'not scanned'}`).join(', ')}`}>
        {v.weeks.map((w, i) => (
          <span key={w.date} data-week={w.date} onMouseEnter={() => setHov(i)} className="relative flex h-full flex-1 cursor-default items-end">
            {w.score == null
              ? <span className="h-full w-full rounded-[3px] border border-dashed border-stone-300" />
              : <span className="w-full rounded-[3px] transition-colors duration-150" style={{ height: `${w.score}%`, background: i === last ? INK : hov === i ? 'var(--color-stone-400)' : 'var(--color-line-strong)' }} />}
          </span>
        ))}
        {tip && (
          <span role="tooltip" className="pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-raised px-2 py-1 text-[12px] leading-4 text-stone-800 shadow-sm"
            style={{ left: `${((hov + 0.5) / v.weeks.length) * 100}%`, bottom: `calc(${tip.score ?? 100}% + 6px)` }}>
            {tip.date} · {tip.score == null ? 'not scanned' : <b className="font-semibold tabular-nums text-stone-900">{tip.score}</b>}
          </span>
        )}
      </div>
      <div className="mt-2 flex gap-1.5">
        {v.weeks.map((w, i) => <span key={w.date} className={`flex-1 text-center text-[11px] leading-4 whitespace-nowrap max-md:text-[10px] ${i === last ? 'font-medium text-stone-900' : 'text-stone-500'}`}>{w.date}</span>)}
      </div>
    </figure>
  )
}
// CEO: everyone's share of voice, you in ink
function Donut({ v }) {
  const r = (RING - RW) / 2
  const greys = ['var(--color-stone-400)', 'var(--color-stone-300)', 'var(--color-stone-200)', TRACK]
  const gap = 0.006
  let at = 0
  return (
    <RingFrame label="Share of voice" sub="of every brand mention in AI answers"
      center={<><span className={`${BIG} text-stone-900`}>{v.you.now}%</span><Delta n={v.you.delta} unit=" pts" bad={v.you.delta < 0} className="mt-1 text-[13px] leading-[18px]" /><span className={META}>vs {v.since}</span></>}>
      {v.parts.map((p, i) => {
        const from = at
        at += p.v / 100
        return <g key={p.key}><title>{p.name}: {p.v}%</title><Arc r={r} from={from + gap} to={at - gap} color={p.you ? INK : greys[Math.min(i - 1, greys.length - 1)]} w={RW} /></g>
      })}
    </RingFrame>
  )
}
// competitor: the prompts each of you wins, on one bar
function Split({ v }) {
  const all = v.you.n + v.them.n
  return (
    <figure className="w-full max-w-[340px]">
      <figcaption className={LABEL}>Prompts each of you wins, of {v.total}</figcaption>
      <div className="mt-4 flex items-end justify-between gap-4">
        <span className="min-w-0"><span className={`block ${BIG} text-stone-900`}>{v.you.n}</span><span className={`block truncate ${LABEL}`}>{v.you.name}</span></span>
        <span className="min-w-0 text-right"><span className={`block ${BIG} text-negative`}>{v.them.n}</span><span className={`block truncate ${LABEL}`}>{v.them.name}</span></span>
      </div>
      <div className="mt-3 flex h-3 gap-1" aria-hidden>
        <span className="rounded-l-full" style={{ width: `${(v.you.n / all) * 100}%`, background: INK }} />
        <span className="flex-1 rounded-r-full" style={{ background: RED }} />
      </div>
      <div className="mt-2 flex justify-between gap-4 text-[13px] leading-[18px]">
        <Delta n={v.you.delta} bad={v.you.delta < 0} />
        <span className={META}>vs {v.since}</span>
        <Delta n={v.them.delta} bad={v.them.delta > 0} />
      </div>
    </figure>
  )
}
// content plan: the prompts you're missing; the red part names a competitor instead
function Gap({ v }) {
  const r = (RING - RW) / 2
  const m = v.missing / v.total
  const o = v.owned / v.total
  return (
    <RingFrame label="Prompts you’re missing" sub={<><b className="font-semibold tabular-nums text-negative">{v.owned}</b> of them name a competitor instead</>}
      center={<><span className={`${BIG} text-stone-900`}>{v.missing}</span><span className={META}>of {v.total}</span><Delta n={v.delta} bad={v.delta > 0} className="mt-1 text-[13px] leading-[18px]" /></>}>
      <circle r={r} fill="none" stroke={TRACK} strokeWidth={RW} />
      <Arc r={r} from={0} to={o} color={RED} w={RW} />
      <Arc r={r} from={o + 0.006} to={m} color="var(--color-stone-400)" w={RW} />
    </RingFrame>
  )
}
const HERO_VISUAL = { strip: Strip, donut: Donut, split: Split, gap: Gap }
function HeroBand({ data: d }) {
  const V = HERO_VISUAL[d.visual?.kind]
  return (
    <header className="grid items-end gap-x-8 gap-y-8 md:grid-cols-12">
      <div className="min-w-0 md:col-span-7">
        {/* one line of text, so a long one wraps between words, never at a separator */}
        <p className={`${META} tabular-nums`}>
          <VerdictDot verdict={d.verdict} className="mr-1.5 align-[-1px]" />
          · {d.brand} · {d.span ?? d.period} · {(d.counted?.length ? d.counted.join(', ') : 'no engines')} · {AUDIENCE[d.audience]}
        </p>
        <h1 className="mt-3 text-[30px] leading-[38px] font-semibold tracking-[-0.01em] text-stone-900 [text-wrap:balance] max-md:text-[24px] max-md:leading-[31px]">{d.headline}</h1>
        <StatRow chips={d.chips} />
      </div>
      {V && <div className="flex min-w-0 md:col-span-5 md:justify-end"><V v={d.visual} /></div>}
    </header>
  )
}

// ---- sections -------------------------------------------------------------------------------------------------------
// a row with its prompts behind a quiet "4 prompts ▾"; opening lists them under the row
function useToggle() {
  const [open, setOpen] = useState(false)
  const id = useId()
  return { open, id, button: (label) => (
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
      className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-[13px] leading-[18px] text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
      {label}<ChevronDown size={13} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden />
    </button>
  ) }
}
function PromptList({ id, prompts }) {
  return (
    <ul id={id} className="mb-3 flex flex-col border-l border-line pl-4 motion-safe:animate-[fade-in_150ms_ease-out]">
      {prompts.map((p) => <li key={p} className={`py-1 ${LABEL} text-stone-800`}>{p}</li>)}
    </ul>
  )
}
const plural = (n) => `${n} ${n === 1 ? 'prompt' : 'prompts'}`

// what moved: one square per tracked prompt, grouped (won · held · lost · missed). Hover a square for its prompt (or its
// group, where the report doesn't hold the prompt's text); click a group, or a square, to list that group below
const TONES = {
  ink: { background: INK },
  ink2: { background: soft(INK, 40) },
  held: { background: 'var(--color-line-strong)' },
  red: { background: RED },
  red2: { background: soft(RED, 40) },
  empty: { boxShadow: 'inset 0 0 0 1px var(--color-stone-300)' },
}
function Waffle({ v }) {
  const [pick, setPick] = useState(null)
  const [hover, setHover] = useState(null) // { i, x, y }
  const box = useRef(null)
  const cells = v.groups.flatMap((g) => Array.from({ length: g.n }, (_, k) => ({ g, k })))
  const sel = v.groups.find((g) => g.key === pick)
  const tip = hover && cells[hover.i]
  const tipText = tip?.g.prompts ? tip.g.prompts[tip.k] : null
  const toggle = (key) => setPick((p) => (p === key ? null : key))
  return (
    <div className="flex flex-1 flex-col">
      <p className="-mx-1.5 flex flex-wrap items-center gap-y-1 text-[13px] leading-[18px]">
        {v.groups.map((g, i) => (
          <span key={g.key} className="inline-flex items-center">
            {i > 0 && <span className="px-0.5 text-stone-400" aria-hidden>·</span>}
            <button type="button" aria-pressed={pick === g.key} onClick={() => toggle(g.key)}
              className={`inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 tabular-nums outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus ${pick === g.key ? 'bg-tint text-stone-900' : pick ? 'text-stone-500' : 'text-stone-700'}`}>
              <span className="h-2.5 w-2.5 rounded-[2px]" style={TONES[g.tone]} aria-hidden />
              <b className={`font-semibold ${g.tone === 'red' ? 'text-negative' : 'text-stone-900'}`}>{g.sign ?? ''}{g.n}</b>{g.label}
            </button>
          </span>
        ))}
      </p>
      <div ref={box} className="relative mt-3 grid w-full gap-[3px]" style={{ gridTemplateColumns: 'repeat(auto-fill, 10px)', justifyContent: 'space-between' }} onMouseLeave={() => setHover(null)}
        role="img" aria-label={`${v.total} prompts: ${v.groups.map((g) => `${g.n} ${g.label}`).join(', ')}`}>
        {cells.map((c, i) => (
          <span key={i} data-cell={c.g.key} className="h-2.5 w-2.5 cursor-pointer rounded-[2px] transition-[opacity,transform] duration-150"
            style={{ ...TONES[c.g.tone], opacity: pick && pick !== c.g.key ? 0.2 : 1, transform: hover?.i === i ? 'scale(1.35)' : undefined }}
            onMouseEnter={(e) => setHover({ i, x: e.currentTarget.offsetLeft + e.currentTarget.offsetWidth / 2, y: e.currentTarget.offsetTop })}
            onClick={() => toggle(c.g.key)} />
        ))}
        {tip && (
          <span role="tooltip" className="pointer-events-none absolute z-20 w-max max-w-[260px] -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 text-stone-800 shadow-sm"
            style={{ left: Math.min(Math.max(hover.x, 130), Math.max(130, (box.current?.clientWidth ?? 0) - 130)), top: hover.y - 6 }}>
            <span className={`block font-medium ${tip.g.tone === 'red' ? 'text-negative' : 'text-stone-900'}`}>{tip.g.label.charAt(0).toUpperCase() + tip.g.label.slice(1)}</span>
            {tipText ? <span className="block">{tipText}</span> : <span className={`block ${t3}`}>One of {tip.g.n}; click to see where they’re listed</span>}
          </span>
        )}
      </div>
      <div className="pt-3">
        {!sel && <p className={META}>Click a group to list its prompts.</p>}
        {sel && (sel.prompts
          ? <PromptList id={`w-${sel.key}`} prompts={sel.prompts} />
          : <p className={META}>The {sel.n} prompts {sel.key === 'missing' ? 'missed' : sel.label} are listed in <a href="/tracker" className="text-stone-700 underline underline-offset-[3px] hover:text-stone-900">Prompt Hub</a>.</p>)}
      </div>
    </div>
  )
}

// where you stand: share of voice by brand, you in ink and bold; at most 5 rows, then "+N more"
function Ranking({ v }) {
  const [all, setAll] = useState(false)
  const max = Math.max(...v.rows.map((r) => r.now))
  const shown = all ? v.rows : v.rows.slice(0, 5)
  return (
    <div className="flex flex-1 flex-col">
      <ul className="flex flex-col">
        {shown.map((r) => {
          const ch = r.from != null ? r.now - r.from : null
          const bad = ch != null && ch !== 0 && (r.you ? ch < 0 : ch > 0)
          return (
            <li key={r.key} className="-mx-2 grid min-h-10 grid-cols-[minmax(0,184px)_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 tabular-nums transition-colors duration-150 hover:bg-tint">
              <span className="flex min-w-0 items-center gap-2">
                <SiteLogo domain={r.domain} name={r.name} className="h-5 w-5 shrink-0 rounded" imgPad="p-0" initialClass="text-[9px]" plate />
                <span className={`truncate ${BODY} ${r.you ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>{r.name}</span>
              </span>
              <span className="h-2 rounded-full" style={{ width: `${Math.max(2, (r.now / max) * 100)}%`, background: r.you ? INK : GREY }} />
              <span className="flex items-baseline justify-end gap-2">
                <span className={`${BODY} ${r.you ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>{r.now}{v.unit}</span>
                {ch != null && <Delta n={ch} bad={bad} className="w-10 text-right text-[12px] leading-4" />}
              </span>
            </li>
          )
        })}
      </ul>
      {v.rows.length > 5 && <div className="pt-2"><button type="button" onClick={() => setAll((a) => !a)} className="-mx-1.5 h-7 rounded-md px-1.5 text-[13px] text-stone-600 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">{all ? 'Show fewer' : `+${v.rows.length - 5} more`}</button></div>}
    </div>
  )
}

// the trend: one 8-week line chart, you in ink and the others in their brand colours; this week's points labelled.
// The y axis is fitted to the data
function Trend({ v }) {
  const [ref, w] = useWidth(800)
  const H = 180
  const padL = 36
  const padR = 52
  const top = 10
  const bot = 24
  const vals = v.lines.flatMap((l) => l.series)
  const lo0 = Math.min(...vals)
  const hi0 = Math.max(...vals)
  const range = Math.max(4, hi0 - lo0)
  const step = [1, 2, 5, 10, 20, 25, 50].find((s) => range / s <= 4) ?? 50
  const lo = Math.max(0, Math.floor((lo0 - range * 0.06) / step) * step)
  const hi = Math.ceil((hi0 + range * 0.06) / step) * step
  const ticks = []
  for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(t)
  const n = v.dates.length
  const x = (i) => padL + (i * (w - padL - padR)) / (n - 1)
  const y = (val) => top + (1 - (val - lo) / (hi - lo)) * (H - top - bot)
  const ends = v.lines.map((l) => ({ l, y: y(l.series.at(-1)) })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16
  const color = (l) => (l.you ? INK : l.color)
  return (
    <div className="flex flex-1 flex-col">
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {v.lines.map((l) => (
          <span key={l.key} className={`inline-flex items-center gap-1.5 ${LABEL} ${l.you ? 'font-medium text-stone-900' : ''}`}>
            <span className="w-3.5 rounded-full" style={{ background: color(l), height: l.you ? 3 : 2 }} aria-hidden />{l.name}
          </span>
        ))}
      </p>
      <div ref={ref} className="mt-3 w-full">
        {w > 0 && (
          <svg width={w} height={H} role="img" aria-label={v.lines.map((l) => `${l.name}: ${l.series.at(-1)}${v.unit} this week`).join('; ')} className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--div)" />
                <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-stone-500 text-[11px] tabular-nums">{t}{v.unit}</text>
              </g>
            ))}
            {v.dates.map((d, i) => {
              // narrow: the first and last week only
              const show = w < 520 ? i === 0 || i === n - 1 : i % 2 === 1
              if (!show) return null
              return <text key={d} x={x(i)} y={H - 4} textAnchor={i === n - 1 ? 'end' : i === 0 && w < 520 ? 'start' : 'middle'} className="fill-stone-500 text-[11px]">{i === n - 1 ? (w < 520 ? d : `This week, ${d}`) : d}</text>
            })}
            {[...v.lines].reverse().map((l) => (
              <g key={l.key}>
                <polyline points={l.series.map((s, i) => `${x(i)},${y(s)}`).join(' ')} fill="none" stroke={color(l)} strokeWidth={l.you ? 2.5 : 2} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(n - 1)} cy={y(l.series.at(-1))} r={l.you ? 4 : 3.5} fill={color(l)} stroke="var(--color-surface)" strokeWidth="2" />
              </g>
            ))}
            {ends.map(({ l, y: ly }) => (
              <text key={l.key} x={x(n - 1) + 10} y={ly} dy="0.32em" className={`text-[13px] tabular-nums ${l.you ? 'fill-stone-900 font-semibold' : 'fill-stone-600'}`}>{l.series.at(-1)}{v.unit}</text>
            ))}
          </svg>
        )}
      </div>
    </div>
  )
}

// by topic: diverging bars on one centre axis right after the name; the net number at the bar's end, "4 prompts" inline
function TopicRow({ r, max, unit }) {
  const t = useToggle()
  const w = `calc((100% - 72px) * ${Math.abs(r.d) / max})`
  const num = <span className={`whitespace-nowrap px-2 ${BODY} font-semibold tabular-nums ${r.d < 0 ? 'text-negative' : 'text-stone-900'}`}>{signed(r.d, unit)}</span>
  const more = (r.note || r.prompts?.length > 0) ? (
    <span className="inline-flex min-w-0 items-center whitespace-nowrap pl-1">
      {r.note && <span className={`truncate ${LABEL}`}>{r.note}</span>}
      {r.prompts?.length > 0 && t.button(plural(r.prompts.length))}
    </span>
  ) : null
  return (
    <li className="border-b border-[var(--div)] last:border-0">
      <div className="grid min-h-11 grid-cols-[minmax(0,30%)_minmax(0,1fr)] items-center gap-x-3 max-md:grid-cols-1 max-md:pb-1 max-md:pt-2.5">
        <span className={`truncate ${BODY} text-stone-900`}>{r.theme}</span>
        <span className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] items-center">
          <span className="flex min-w-0 items-center justify-end">{r.d < 0 && <>{num}<span className="h-3 shrink-0 rounded-l-[3px]" style={{ width: w, background: RED }} /></>}</span>
          <span className="flex min-h-7 min-w-0 items-center border-l border-stone-400">{r.d > 0 && <><span className="h-3 shrink-0 rounded-r-[3px]" style={{ width: `calc((100% - 72px) * ${Math.abs(r.d) / max} / 1.6)`, background: INK }} />{num}</>}{more}</span>
        </span>
      </div>
      {t.open && <PromptList id={t.id} prompts={r.prompts} />}
    </li>
  )
}
function Diverging({ v }) {
  const max = Math.max(...v.rows.map((r) => Math.abs(r.d)))
  return <ul className="flex flex-col border-t border-[var(--div)]">{v.rows.map((r) => <TopicRow key={r.theme} r={r} max={max} unit={v.unit} />)}</ul>
}
// counts per topic (competitor, content plan): a one-way bar, the number at its end; red where a competitor is named
function CountRow({ r, max, against }) {
  const t = useToggle()
  return (
    <li className="border-b border-[var(--div)] last:border-0">
      <div className="grid min-h-11 grid-cols-[minmax(0,36%)_minmax(0,1fr)] items-center gap-x-3 max-md:grid-cols-1 max-md:pb-1 max-md:pt-2.5">
        <span className={`truncate ${BODY} text-stone-900`}>{r.theme}</span>
        <span className="flex min-w-0 items-center">
          <span className="flex h-3 shrink-0 gap-px overflow-hidden rounded-[3px]" style={{ width: `calc((100% - ${r.part != null ? 190 : 110}px) * ${r.n / max})` }} aria-hidden>
            {r.part != null ? <><span style={{ width: `${(r.part / r.n) * 100}%`, background: RED }} /><span className="flex-1" style={{ background: GREY }} /></> : <span className="flex-1" style={{ background: against ? RED : INK }} />}
          </span>
          <span className={`whitespace-nowrap px-2 ${BODY} font-semibold tabular-nums ${against ? 'text-negative' : 'text-stone-900'}`}>{r.n}</span>
          {r.part != null && <span className={`min-w-0 truncate ${LABEL}`}><span className="text-negative">{r.part}</span> to {r.note}</span>}
          {r.prompts?.length > 0 && <span className="ml-auto pl-1">{t.button('Prompts')}</span>}
        </span>
      </div>
      {t.open && <PromptList id={t.id} prompts={r.prompts} />}
    </li>
  )
}
function TopicBars({ v }) {
  const max = Math.max(...v.rows.map((r) => r.n))
  return <ul className="flex flex-col border-t border-[var(--div)]">{v.rows.map((r) => <CountRow key={r.theme} r={r} max={max} against={v.against} />)}</ul>
}
// by engine: per engine that ran, its mark and name, won / held / lost stacked across every tracked prompt, and the
// share of prompts it names you on. The ones that didn't run: one line under
const HELD = 'var(--color-line-strong)'
function EngineStack({ v }) {
  const ran = v.rows.filter((e) => !e.off)
  const off = v.rows.filter((e) => e.off).map((e) => e.name)
  const seg = (n, bg) => (n > 0 ? <span style={{ width: `${(n / v.total) * 100}%`, background: bg }} /> : null)
  return (
    <div className="flex flex-1 flex-col">
      <p className={`flex flex-wrap items-center gap-x-3 ${META}`}>
        {[['won', INK], ['held', HELD], ['lost', RED]].map(([l, c]) => <span key={l} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px]" style={{ background: c }} aria-hidden />{l}</span>)}
        <span>of {v.total} prompts</span>
      </p>
      <ul className="mt-2 flex flex-col">
        {ran.map((e) => (
          <li key={e.id} className="grid min-h-11 grid-cols-[minmax(0,112px)_minmax(0,1fr)_44px] items-center gap-3 border-b border-[var(--div)] last:border-0">
            <span className="flex min-w-0 items-center gap-2"><EngineMark id={e.id} size={16} /><span className={`truncate ${BODY} text-stone-900`}>{e.name}</span></span>
            <span className="flex h-3 gap-px overflow-hidden rounded-[3px]" title={`${e.won} won · ${e.held} held · ${e.lost} lost`}>
              {seg(e.won, INK)}{seg(e.held, HELD)}{seg(e.lost, RED)}
            </span>
            <span className={`text-right ${BODY} font-semibold tabular-nums text-stone-900`}>{e.now}%</span>
          </li>
        ))}
      </ul>
      {off.length > 0 && <p className={`mt-auto pt-3 ${META}`}>{joinAnd(off)} didn’t run {v.when ?? 'in this period'}.</p>}
    </div>
  )
}
// competitor: the prompts they win, per engine
function EngineBars({ v }) {
  const ran = v.rows.filter((e) => !e.off)
  const off = v.rows.filter((e) => e.off).map((e) => e.name)
  const max = Math.max(...ran.map((e) => e.n))
  return (
    <div className="flex flex-1 flex-col">
      <ul className="flex flex-col border-t border-[var(--div)]">
        {ran.map((e) => (
          <li key={e.id} className="grid min-h-11 grid-cols-[minmax(0,136px)_minmax(0,1fr)] items-center gap-3 border-b border-[var(--div)] last:border-0">
            <span className="flex min-w-0 items-center gap-2"><EngineMark id={e.id} size={16} /><span className={`truncate ${BODY} text-stone-900`}>{e.name}</span></span>
            <span className="flex min-w-0 items-center">
              <span className="h-3 shrink-0 rounded-[3px]" style={{ width: `calc((100% - 160px) * ${e.n / max})`, background: v.against ? RED : INK }} />
              <span className={`whitespace-nowrap px-2 ${BODY} font-semibold tabular-nums ${v.against ? 'text-negative' : 'text-stone-900'}`}>{e.n}</span>
              <span className={`truncate ${LABEL}`}>{v.label}</span>
            </span>
          </li>
        ))}
      </ul>
      {off.length > 0 && <p className={`mt-auto pt-3 ${META}`}>{joinAnd(off)} didn’t run {v.when ?? 'in this period'}.</p>}
    </div>
  )
}
function CitedList({ rows, domain, against }) {
  const max = Math.max(...rows.map((r) => r.n))
  return (
    <ul className="flex flex-col">
      {rows.map((r) => (
        <li key={r.path} className="border-b border-[var(--div)] py-2 last:border-0">
          <div className="flex items-baseline justify-between gap-3 tabular-nums">
            <span className={`min-w-0 truncate ${LABEL}`}><span className="text-stone-500">{domain}</span><span className="text-stone-900">{r.path}</span>{r.isNew && <span className={`ml-2 ${META}`}>new</span>}</span>
            <span className={`shrink-0 text-[13px] ${against ? 'font-medium text-negative' : 'text-stone-600'}`}>{r.n} answers</span>
          </div>
          <span className="mt-1.5 block h-1.5 rounded-sm" style={{ width: `${(r.n / max) * 100}%`, background: against ? soft(RED, 70) : soft(INK, 70) }} />
        </li>
      ))}
    </ul>
  )
}
function CitedPair({ v }) {
  return (
    <div className="flex flex-col gap-5">
      {v.sides.map((s) => (
        <div key={s.name} className="min-w-0">
          <p className={`mb-1 text-[13px] font-medium ${s.against ? 'text-negative' : 'text-stone-600'}`}>{s.name}</p>
          <CitedList rows={s.rows} domain={s.domain} against={s.against} />
        </div>
      ))}
    </div>
  )
}
const VISUAL = { waffle: Waffle, ranking: Ranking, trend: Trend, diverging: Diverging, topicBars: TopicBars, engineStack: EngineStack, engineBars: EngineBars, cited: ({ v }) => <CitedList rows={v.rows} domain={v.domain} />, citedPair: CitedPair }

// the spine: every section is one row of the 12-column grid. Left 3 columns: the number, the title, one takeaway
// (top-aligned, repeated down the page); right 9: the visual. On phones the spine stacks above the visual
const SPINE_ROW = 'grid gap-x-8 gap-y-4 md:grid-cols-12'
function Spine({ n, title, takeaway }) {
  return (
    <div className="min-w-0 md:col-span-3">
      <div className="flex items-baseline gap-2.5">
        {n != null && <span className="text-[13px] leading-[18px] tabular-nums text-stone-500">{pad2(n)}</span>}
        <h2 className="text-[17px] leading-6 font-semibold text-stone-900">{title}</h2>
      </div>
      {takeaway && <p className="mt-1.5 text-[14px] leading-5 text-stone-600 [text-wrap:pretty]">{takeaway}</p>}
    </div>
  )
}
function Section({ data: s, n }) {
  const V = VISUAL[s.visual.kind]
  return (
    <section className={SPINE_ROW}>
      <Spine n={n} title={s.title} takeaway={s.takeaway} />
      <div className="flex min-w-0 flex-col md:col-span-9">{V && <V v={s.visual} />}</div>
    </section>
  )
}

// ---- what to do: three open columns, vertical hairlines between, no fills. The rows are shared (subgrid), so the
// tallest title sets the height and the impact numbers sit on one line across all three
const ACTION_ICON = { 'New page': FilePlus2, 'Add to FAQ': MessageCircleQuestion, Outreach: Megaphone }
function ActionCol({ a }) {
  const t = useToggle()
  const Icon = ACTION_ICON[a.type] ?? FilePlus2
  return (
    <li className="flex min-w-0 flex-col border-line max-md:border-t max-md:py-5 max-md:first:border-t-0 max-md:first:pt-0 md:row-span-4 md:grid md:grid-rows-subgrid md:gap-y-0 md:border-l md:px-6 md:first:border-l-0 md:first:pl-0 md:last:pr-0">
      <span className={`flex items-center gap-2 ${META}`}><Icon size={15} strokeWidth={1.75} className="text-stone-500" aria-hidden />{a.type}</span>
      <span className="mt-2 text-[16px] leading-[22px] font-semibold text-stone-900 [text-wrap:pretty]">{a.title}</span>
      <span className="mt-4 md:self-end">
        <span className="block text-[24px] leading-8 font-semibold tracking-[-0.01em] tabular-nums text-stone-900">{plural(a.n)}</span>
        <span className={`block ${META}`}>could be won · {a.theme}</span>
      </span>
      <span className="mt-2 flex flex-col items-start">
        {a.prompts?.length > 0 && <span className="-mx-1.5">{t.button(t.open ? 'Hide prompts' : 'View prompts')}</span>}
        {t.open && <div className="mt-2 w-full"><PromptList id={t.id} prompts={a.prompts} /></div>}
      </span>
    </li>
  )
}
function Actions({ data: d, n }) {
  return (
    <section className={SPINE_ROW}>
      <Spine n={n} title={d.title} takeaway={d.takeaway} />
      <ol className="flex min-w-0 flex-col md:col-span-9 md:grid md:grid-cols-3 md:grid-rows-[repeat(4,auto)]">{d.items.map((a) => <ActionCol key={a.title} a={a} />)}</ol>
    </section>
  )
}

// ---- footer: one line; the details behind "Methodology"
function Sources({ data: d }) {
  const [tip, setTip] = useState(false)
  const id = useId()
  return (
    <footer className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${META} tabular-nums`}>
      <span>Source: {d.syncs} weekly syncs, {d.span ?? `${d.from} – ${d.to}`} · {d.engines.join(', ') || 'no engines'}{d.off?.length ? ` · ${joinAnd(d.off)} didn’t run` : ''}</span>
      <span className="relative" onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
        <button type="button" aria-describedby={tip ? id : undefined} onFocus={() => setTip(true)} onBlur={() => setTip(false)} onClick={() => setTip((x) => !x)}
          className="rounded text-stone-600 underline decoration-dotted underline-offset-[3px] outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Methodology</button>
        {tip && (
          <span id={id} role="tooltip" className="absolute bottom-full left-0 z-20 mb-2 block w-[min(360px,80vw)] rounded-lg border border-line bg-raised p-3 text-[12px] leading-[18px] text-stone-700 shadow-md">
            Kraffic AI visibility data: the tracked prompts, the AI answers to them and the pages they cite, from {d.syncs} weekly syncs, {d.from} – {d.to}, 2026. Engines counted: {d.engines.join(', ') || 'none'}.
            {d.left.length > 0 && <> Not in this report: {d.left.join(' ')}</>} Nothing missing is estimated.
          </span>
        )}
      </span>
    </footer>
  )
}

const RENDER = { header: Header, scoreline: Scoreline, hero: HeroBand, section: Section, actions: Actions, sources: Sources }
export function Block({ block, title, n }) {
  const C = RENDER[block.type]
  return C ? <C data={block.data} title={title} n={n} /> : null
}
export const blockName = (b) => (b.type === 'section' ? b.data.title : { header: 'Header', scoreline: 'Scoreline', hero: 'Summary', actions: b.data.title, sources: 'Sources' }[b.type])
// "Explain this": how a block was worked out, in a sentence or two
export function explainFor(block) {
  const d = block.data
  switch (block.type) {
    case 'hero': return {
      strip: 'The visibility score at each of the last 8 weekly syncs; this week’s is compared with the last week that was scanned. A week without a scan is left empty, not counted as 0. Good week: you won at least twice as many prompts as you lost.',
      donut: 'Of all brand mentions in AI answers to your prompts, the share each brand got in the latest sync. Winning: first in share of voice and gaining.',
      split: 'Every tracked prompt where AI names only you, or names you first, is yours; where it names only them, or them first, is theirs.',
      gap: 'Tracked prompts where AI doesn’t name you in the latest sync; in red, those that name a competitor instead.',
    }[d.visual?.kind] ?? ''
    case 'section': return {
      waffle: 'Every tracked prompt, once. Won: newly named. Held: named both times. Lost: no longer named. Missed: not named either time.',
      ranking: 'Share of voice in the latest sync, and the change since the period began.',
      trend: 'The last 8 weekly syncs. The y axis is fitted to the data, so it doesn’t start at zero.',
      diverging: 'Prompts gained (right) and lost (left) per topic. Topics come from grouping the prompt texts.',
      topicBars: 'Prompts per topic; open a topic for its prompts.',
      engineStack: 'Per engine, across every tracked prompt: newly named (won), named both times (held), no longer named (lost). The number is the share of prompts it names you on. An engine that didn’t run isn’t estimated.',
      engineBars: 'Prompts the competitor wins, per engine. An engine that didn’t run isn’t estimated.',
      cited: 'Your pages that AI answers link to most in the latest sync.',
      citedPair: 'The pages AI cites on the prompts you both compete for, by how many answers cite each.',
    }[d.visual.kind]
    case 'actions': return 'Each action targets one topic; the number counts the prompts in that topic you aren’t named on today.'
    case 'sources': return 'Everything above comes from these syncs. Anything without data is listed here instead of being estimated.'
    default: return ''
  }
}

// ---- thumbnails (templates, report rows and tiles). Inside a .thumb-live parent, hovering it replays the mini visual:
// bands sweep in, lines draw, squares settle, bubbles pop (index.css; nothing moves with reduced motion)
export function Thumb({ kind, net = null, className = 'h-16 w-28' }) {
  const ink = INK
  const grey = 'var(--color-stone-300)'
  const at = (i) => ({ '--i': i })
  return (
    <svg viewBox="0 0 112 64" className={className} aria-hidden>
      {kind === 'weekly' && net != null && <WeeklyThumb net={net} at={at} />}
      {kind === 'weekly' && net == null && (
        <g>
          <rect x="14" y="6" width="5" height="30" rx="1.5" fill={ink} /><rect x="14" y="40" width="5" height="18" rx="1.5" fill={grey} />
          <rect x="93" y="6" width="5" height="34" rx="1.5" fill={ink} data-a="pop" style={at(4)} /><rect x="93" y="44" width="5" height="14" rx="1.5" fill={grey} data-a="pop" style={at(5)} />
          <path d="M19 6 C56 6 56 6 93 6 L93 34 C56 34 56 32 19 32 Z" fill={soft(ink, 16)} data-a="sweep" style={at(0)} />
          <path d="M19 40 C56 40 56 34 93 34 L93 40 C56 40 56 46 19 46 Z" fill={soft(ink, 75)} data-a="sweep" style={at(1)} />
          <path d="M19 32 C56 32 56 44 93 44 L93 46 C56 46 56 36 19 36 Z" fill={soft(RED, 80)} data-a="sweep" style={at(2)} />
          <path d="M19 46 C56 46 56 46 93 46 L93 58 C56 58 56 58 19 58 Z" fill={soft(ink, 6)} data-a="sweep" style={at(3)} />
        </g>
      )}
      {kind === 'ceo' && (
        <g strokeLinecap="round">
          <line x1="16" x2="16" y1="4" y2="60" stroke="var(--div)" /><line x1="96" x2="96" y1="4" y2="60" stroke="var(--div)" />
          <line x1="16" y1="48" x2="96" y2="52" stroke={grey} strokeWidth="1.5" pathLength="1" data-a="draw" style={at(3)} />
          <line x1="16" y1="38" x2="96" y2="40" stroke={grey} strokeWidth="1.5" pathLength="1" data-a="draw" style={at(2)} />
          <line x1="16" y1="20" x2="96" y2="22" stroke={RED} strokeWidth="1.5" pathLength="1" data-a="draw" style={at(1)} />
          <line x1="16" y1="24" x2="96" y2="10" stroke={ink} strokeWidth="3" pathLength="1" data-a="draw" style={at(0)} />
          <circle cx="96" cy="10" r="3.5" fill={ink} data-a="pop" style={at(6)} />
        </g>
      )}
      {kind === 'rival' && (
        <g>
          {[[10, 6, ink, 18], [58, 6, RED, 7], [10, 36, ink, 14], [58, 36, soft(ink, 12), 12]].map(([x, y, c, n], qi) => (
            <g key={qi}>{Array.from({ length: n }, (_, i) => <rect key={i} x={x + (i % 6) * 7} y={y + Math.floor(i / 6) * 7} width="5" height="5" rx="1" fill={c} data-a="settle" style={at(qi * 3 + (i % 6) * 0.6 + Math.floor(i / 6))} />)}</g>
          ))}
          <line x1="54" x2="54" y1="2" y2="62" stroke="var(--div)" /><line x1="4" x2="108" y1="32" y2="32" stroke="var(--div)" />
        </g>
      )}
      {kind === 'content' && (
        <g>
          <rect x="58" y="4" width="50" height="26" fill={soft(RED, 6)} />
          <circle cx="86" cy="14" r="9" fill={soft(RED, 25)} stroke={RED} data-a="pop" style={at(3)} /><circle cx="70" cy="22" r="7" fill={soft(RED, 25)} stroke={RED} data-a="pop" style={at(4)} />
          <circle cx="42" cy="40" r="6" fill={soft(ink, 10)} stroke="var(--color-stone-400)" data-a="pop" style={at(1)} /><circle cx="24" cy="50" r="4.5" fill={soft(ink, 10)} stroke="var(--color-stone-400)" data-a="pop" style={at(0)} />
          <circle cx="58" cy="46" r="5" fill={soft(ink, 10)} stroke="var(--color-stone-400)" data-a="pop" style={at(2)} />
          <line x1="6" x2="108" y1="60" y2="60" stroke={grey} />
        </g>
      )}
    </svg>
  )
}

// a weekly thumbnail for one week: the prompts named last week (left) and this week (right); the dark band is what was
// won, the red one what was lost, each as wide as that week's change
function WeeklyThumb({ net, at }) {
  const won = 2 + Math.min(8, Math.max(0, net)) * 2.2 // capped so a big month still fits
  const lost = 2 + Math.min(6, Math.max(0, -net)) * 2.6
  const held = 26
  const top = 6
  const gap = 4
  const L1 = top + held + lost // left: held, lost | won, missing
  const R1 = top + held + won // right: held, won | lost, missing
  const b = (yl0, yl1, yr0, yr1) => `M19 ${yl0} C56 ${yl0} 56 ${yr0} 93 ${yr0} L93 ${yr1} C56 ${yr1} 56 ${yl1} 19 ${yl1} Z`
  return (
    <g>
      <rect x="14" y={top} width="5" height={held + lost} rx="1.5" fill={INK} /><rect x="14" y={L1 + gap} width="5" height={58 - L1 - gap} rx="1.5" fill="var(--color-stone-300)" />
      <rect x="93" y={top} width="5" height={held + won} rx="1.5" fill={INK} data-a="pop" style={at(4)} /><rect x="93" y={R1 + gap} width="5" height={58 - R1 - gap} rx="1.5" fill="var(--color-stone-300)" data-a="pop" style={at(5)} />
      <path d={b(top, top + held, top, top + held)} fill={soft(INK, 16)} data-a="sweep" style={at(0)} />
      <path d={b(L1 + gap, L1 + gap + won, top + held, top + held + won)} fill={soft(INK, 75)} data-a="sweep" style={at(1)} />
      <path d={b(top + held, top + held + lost, R1 + gap, R1 + gap + lost)} fill={soft(RED, 80)} data-a="sweep" style={at(2)} />
      <path d={b(L1 + gap + won, 58, R1 + gap + lost, 58)} fill={soft(INK, 6)} data-a="sweep" style={at(3)} />
    </g>
  )
}
