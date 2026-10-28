import { useId, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

// The report's fixed block library. Same rhythm for every kind: header · scoreline · hero · numbered sections · action
// cards · sources. Graphite only; red only for what's going against the brand.
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

// ---- the type scale (the only sizes in a report): headline 30/600 · section titles 17/600 · body 15 · labels 13 t2 ·
// meta 12 t3 · values 28/600. Numbers are tabular.
const LABEL = 'text-[13px] leading-[18px] text-stone-600'
const META = 'text-[12px] leading-4 text-stone-500'
const BODY = 'text-[15px] leading-6'
const VALUE = 'text-[28px] leading-8 font-semibold tracking-[-0.01em] tabular-nums'
const pad2 = (n) => String(n).padStart(2, '0')
const joinAnd = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

// a section's head: "01  What moved", then its one takeaway
function SectionHead({ n, title, takeaway }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-3">
        {n != null && <span className="text-[13px] leading-[18px] tabular-nums text-stone-500">{pad2(n)}</span>}
        <h2 className="text-[17px] leading-6 font-semibold text-stone-900">{title}</h2>
      </div>
      {takeaway && <p className={`mt-1 ${BODY} text-stone-600 [text-wrap:pretty]`}>{takeaway}</p>}
    </div>
  )
}

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

// ---- 1. header: the verdict before the meta line, the headline, an optional lede
function Header({ data: d }) {
  return (
    <header>
      <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${META} tabular-nums`}>
        <VerdictDot verdict={d.verdict} />
        <span>· {d.brand} · {d.span ?? d.period} · {(d.counted?.length ? d.counted.join(', ') : d.engines)} · {AUDIENCE[d.audience]}</span>
      </p>
      <h1 className="mt-3 max-w-[40ch] text-[30px] leading-[38px] font-semibold tracking-[-0.01em] text-stone-900 [text-wrap:balance] max-md:text-[24px] max-md:leading-[31px]">{d.headline}</h1>
      {d.lede && <p className={`mt-2 ${BODY} text-stone-600`}>{d.lede}</p>}
    </header>
  )
}

// ---- 2. scoreline: 4 columns, hairlines between, a sparkline under each value; "vs Oct 19 · last 8 weeks" on hover
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

// ---- 3. hero visuals (section 01) ----------------------------------------------------------------------------------
// weekly: what moved. The held prompts are a thin neutral band (context); won (ink) and lost (red) carry the story,
// labelled on the ribbons. Columns: named (ink) over not named (grey), last sync → this one.
function Flow({ d }) {
  const [ref, w] = useWidth()
  const H = 168
  const k = H / d.total
  const bw = 10
  const narrow = w < 520
  const x1 = narrow ? 0 : 8
  const x2 = w - bw - (narrow ? 0 : 8)
  const g = 8
  const L = { named: d.held + d.lost, not: d.won + d.missing }
  const R = { named: d.held + d.won, not: d.lost + d.missing }
  const notL = L.named * k + g
  const notR = R.named * k + g
  const xa = x1 + bw
  const xb = x2
  const m = (xa + xb) / 2
  const rib = (ya, ha, yb, hb) => `M${xa},${ya} C${m},${ya} ${m},${yb} ${xb},${yb} L${xb},${yb + hb} C${m},${yb + hb} ${m},${ya + ha} ${xa},${ya + ha} Z`
  const wonH = Math.max(d.won * k, 4)
  const lostH = Math.max(d.lost * k, 3)
  const heldY = (d.held * k) / 2 - 2
  const halo = { paintOrder: 'stroke', stroke: 'var(--color-surface)', strokeWidth: 4, strokeLinejoin: 'round' }
  const at = (t, ya, yb) => ya + (yb - ya) * (t * t * (3 - 2 * t))
  return (
    <figure className="m-0" aria-label={`Prompts named: ${L.named} on ${d.from}, ${R.named} on ${d.to}. Won ${d.won}, lost ${d.lost}, held ${d.held}.`}>
      <div className="mb-3 flex items-baseline justify-between gap-3 tabular-nums">
        <span className={META}>{d.from}</span>
        <span className={LABEL}><b className="font-semibold text-stone-900">{L.named}</b> → <b className="font-semibold text-stone-900">{R.named}</b> named</span>
        <span className={META}>{d.to}</span>
      </div>
      <div ref={ref}>
        <svg width={w} height={H + g} className="block overflow-visible" aria-hidden>
          <path d={rib(heldY, 4, heldY, 4)} fill="var(--color-stone-300)" />
          <path d={rib(notL, wonH, d.held * k, wonH)} fill={INK} opacity="0.85" />
          <path d={rib(d.held * k, lostH, notR, lostH)} fill={RED} opacity="0.85" />
          <rect x={x1} y={0} width={bw} height={L.named * k} rx="2" fill={INK} /><rect x={x1} y={notL} width={bw} height={L.not * k} rx="2" fill="var(--color-stone-300)" />
          <rect x={x2} y={0} width={bw} height={R.named * k} rx="2" fill={INK} /><rect x={x2} y={notR} width={bw} height={R.not * k} rx="2" fill="var(--color-stone-300)" />
          <text x={m} y={heldY - 6} textAnchor="middle" fontSize="12" fill="var(--color-stone-500)" className="tabular-nums" style={halo}>{d.held} held</text>
          {/* the ribbons cross mid-way: each is labelled just above itself, won near the right end and lost near the left */}
          <text x={xa + (xb - xa) * 0.84} y={at(0.84, notL, d.held * k) - 7} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--color-stone-900)" className="tabular-nums" style={halo}>+{d.won} won</text>
          <text x={xa + (xb - xa) * 0.16} y={at(0.16, d.held * k, notR) - 7} textAnchor="middle" fontSize="13" fontWeight="600" fill={RED} className="tabular-nums" style={halo}>−{d.lost} lost</text>
        </svg>
      </div>
    </figure>
  )
}

// CEO: share of voice, start → now: you (ink) vs the top competitors (grey; red when gaining on you)
function Slope({ d }) {
  const [ref, w] = useWidth()
  const H = 200
  const top = Math.ceil(Math.max(...d.rows.flatMap((r) => [r.from, r.now])) / 10) * 10
  const narrow = w < 520
  const x1 = 44
  const x2 = narrow ? w - 150 : Math.min(w - 260, 520)
  const y = (v) => 12 + (1 - v / top) * (H - 24)
  const place = (key) => {
    const rows = [...d.rows].sort((a, b) => b[key] - a[key]).map((r) => ({ r, y: y(r[key]) }))
    for (let i = 1; i < rows.length; i++) if (rows[i].y - rows[i - 1].y < 18) rows[i].y = rows[i - 1].y + 18
    return Object.fromEntries(rows.map((x) => [x.r.key, x.y]))
  }
  const Lp = place('from')
  const Rp = place('now')
  const col = (r) => (r.you ? INK : r.now > r.from ? RED : 'var(--color-stone-400)')
  return (
    <figure className="m-0">
      <div ref={ref}>
        <svg width={w} height={H + 22} className="block overflow-visible" role="img" aria-label={`Share of voice, ${d.from} to ${d.to}. A competitor in red gained on you.`}>
          <text x={x1} y={10} textAnchor="middle" fontSize="12" fill="var(--color-stone-500)">{d.from}</text>
          <text x={x2} y={10} textAnchor="middle" fontSize="12" fill="var(--color-stone-500)">{d.to}</text>
          <g transform="translate(0,18)">
            <line x1={x1} x2={x1} y1={0} y2={H} stroke="var(--div)" />
            <line x1={x2} x2={x2} y1={0} y2={H} stroke="var(--div)" />
            {[...d.rows].sort((a) => (a.you ? 1 : -1)).map((r) => (
              <g key={r.key}>
                <line x1={x1} x2={x2} y1={y(r.from)} y2={y(r.now)} stroke={col(r)} strokeWidth={r.you ? 3 : 1.5} strokeLinecap="round" />
                <circle cx={x1} cy={y(r.from)} r={r.you ? 4 : 2.5} fill={col(r)} />
                <circle cx={x2} cy={y(r.now)} r={r.you ? 4.5 : 3} fill={col(r)} />
                <text x={x1 - 10} y={Lp[r.key] + 4} textAnchor="end" fontSize="12" fill={r.you ? 'var(--color-stone-900)' : 'var(--color-stone-500)'} fontWeight={r.you ? 600 : 400} className="tabular-nums">{r.from}%</text>
                <text x={x2 + 10} y={Rp[r.key] + 4} fontSize="13" fill={r.you ? 'var(--color-stone-900)' : 'var(--color-stone-600)'} fontWeight={r.you ? 600 : 400} className="tabular-nums">
                  <tspan fill={r.you ? 'var(--color-stone-900)' : r.now > r.from ? RED : 'var(--color-stone-600)'}>{r.now}%</tspan>  {r.name}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    </figure>
  )
}

// competitor: who AI names, prompt by prompt (rows: them / not; columns: you / not). Their wins in red.
function Squares({ n, color, size = 9 }) {
  return (
    <div className="flex max-w-full flex-wrap" style={{ gap: 2, width: 10 * (size + 2) }}>
      {Array.from({ length: n }, (_, i) => <span key={i} style={{ width: size, height: size, borderRadius: 2, background: color }} />)}
    </div>
  )
}
function Quadrant({ d }) {
  const rv = d.rival.split(' ')[0]
  const cell = 'flex min-h-[132px] flex-col gap-2 p-4 max-md:p-3'
  const Num = ({ n, red, label }) => (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={`${VALUE} ${red ? 'text-negative' : 'text-stone-900'}`}>{n}</span>
      <span className={`min-w-0 text-[13px] leading-[18px] ${red ? 'text-negative' : 'text-stone-600'}`}>{label}</span>
    </div>
  )
  return (
    <figure className="m-0">
      <div className="grid grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)] max-md:grid-cols-2">
        <span className="max-md:hidden" />
        <span className={`px-4 pb-2 ${META} max-md:px-3`}>AI names you</span>
        <span className={`px-4 pb-2 ${META} max-md:px-3`}>AI doesn’t name you</span>
        <span className={`self-center pr-2 text-right ${META} max-md:col-span-2 max-md:pb-1 max-md:pt-1 max-md:text-left`}>Names {rv}</span>
        <div className={`${cell} border-l border-t border-line`}>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <div className="flex flex-col gap-1.5"><Num n={d.youFirst} label="you first" /><Squares n={d.youFirst} color={INK} /></div>
            <div className="flex flex-col gap-1.5"><Num n={d.themFirst} red label={`${rv} first`} /><Squares n={d.themFirst} color={soft(RED, 60)} /></div>
          </div>
        </div>
        <div className={`${cell} border-l border-r border-t border-line`} style={{ background: soft(RED, 5) }}>
          <Num n={d.onlyThem} red label={`only ${rv}`} /><Squares n={d.onlyThem} color={RED} />
        </div>
        <span className={`self-center pr-2 text-right ${META} max-md:col-span-2 max-md:pb-1 max-md:pt-3 max-md:text-left`}>Doesn’t name {rv}</span>
        <div className={`${cell} border-b border-l border-t border-line`}>
          <Num n={d.onlyYou} label="only you" /><Squares n={d.onlyYou} color={INK} />
        </div>
        <div className={`${cell} border border-line`}>
          <Num n={d.neither} label="neither" /><Squares n={d.neither} color={soft(INK, 10)} />
        </div>
      </div>
      <figcaption className={`mt-2 ${META}`}>All {d.total} tracked prompts. Red: prompts {rv} wins.</figcaption>
    </figure>
  )
}

// content plan: topics as bubbles (prompts you're missing × how strongly competitors own them)
function Bubbles({ d }) {
  const [ref, w] = useWidth()
  const H = 240
  const pad = { l: 36, r: 16, t: 16, b: 34 }
  const maxX = Math.max(...d.rows.map((r) => r.missing)) + 1
  const x = (v) => pad.l + (v / maxX) * (w - pad.l - pad.r)
  const y = (v) => pad.t + (1 - v / 100) * (H - pad.t - pad.b)
  const rr = (n) => 6 + Math.sqrt(n) * (w < 520 ? 3 : 5)
  return (
    <figure className="m-0">
      <div ref={ref}>
        <svg width={w} height={H} className="block overflow-visible" role="img" aria-label="Topics by prompts missing and how strongly competitors own them">
          <rect x={x(maxX / 2)} y={pad.t} width={x(maxX) - x(maxX / 2)} height={y(50) - pad.t} fill={soft(RED, 4)} />
          <text x={x(maxX) - 6} y={pad.t + 14} textAnchor="end" fontSize="12" fontWeight="600" fill={RED}>Write these first</text>
          <line x1={pad.l} x2={x(maxX)} y1={y(50)} y2={y(50)} stroke="var(--div)" strokeDasharray="3 3" />
          <line x1={x(maxX / 2)} x2={x(maxX / 2)} y1={pad.t} y2={H - pad.b} stroke="var(--div)" strokeDasharray="3 3" />
          <line x1={pad.l} x2={x(maxX)} y1={H - pad.b} y2={H - pad.b} stroke="var(--color-stone-300)" />
          {[0, 50, 100].map((v) => <text key={v} x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--color-stone-500)">{v}%</text>)}
          <text x={x(maxX)} y={H - 10} textAnchor="end" fontSize="12" fill="var(--color-stone-500)">Prompts you’re missing →</text>
          {d.rows.map((r) => {
            const hot = r.own >= 60 && r.missing >= maxX / 2
            return (
              <g key={r.theme}>
                <circle cx={x(r.missing)} cy={y(r.own)} r={rr(r.missing)} fill={hot ? soft(RED, 22) : soft(INK, 10)} stroke={hot ? RED : 'var(--color-stone-400)'} strokeWidth="1.25" />
                <text x={x(r.missing)} y={y(r.own) + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill={hot ? RED : 'var(--color-stone-700)'} className="tabular-nums">{r.missing}</text>
                <text x={x(r.missing)} y={y(r.own) + rr(r.missing) + 14} textAnchor="middle" fontSize="13" fill="var(--color-stone-800)">{r.theme}</text>
              </g>
            )
          })}
        </svg>
      </div>
      <figcaption className={`mt-1 ${META}`}>Up: the share of those prompts where a competitor is named instead. Size: prompts missing.</figcaption>
    </figure>
  )
}

const HERO_TITLE = { flow: 'What moved', slope: 'Share of voice', quadrant: 'Head to head', bubbles: 'Where to write' }
function Hero({ data: d, n }) {
  return (
    <section>
      <SectionHead n={n} title={HERO_TITLE[d.kind]} />
      {d.kind === 'flow' ? <Flow d={d} /> : d.kind === 'slope' ? <Slope d={d} /> : d.kind === 'quadrant' ? <Quadrant d={d} /> : <Bubbles d={d} />}
    </section>
  )
}

// ---- 4. section visuals --------------------------------------------------------------------------------------------
// a row with its prompts behind a quiet "4 prompts ▾" at the end; opening lists them under the row
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
const ROW = 'grid min-h-11 grid-cols-[minmax(0,200px)_minmax(0,220px)_auto_minmax(0,1fr)] items-center gap-x-4 max-md:grid-cols-[minmax(0,1fr)_96px_auto] max-md:gap-x-3 max-md:py-2'
const plural = (n) => `${n} ${n === 1 ? 'prompt' : 'prompts'}`

// by topic: a diverging bar on one centre axis, right after the topic name (gains right in ink, losses left in red)
function TopicRow({ r, max, unit }) {
  const t = useToggle()
  const lossW = r.d < 0 ? (Math.abs(r.d) / max) * 100 : 0
  const gainW = r.d > 0 ? (r.d / max) * 100 : 0
  return (
    <li className="border-b border-[var(--div)] last:border-0">
      <div className={ROW}>
        <span className={`truncate ${BODY} text-stone-900`}>{r.theme}</span>
        <span className="grid h-3 grid-cols-2" aria-hidden>
          <span className="flex justify-end">{lossW > 0 && <span className="h-3 rounded-l-sm" style={{ width: `${lossW}%`, background: RED }} />}</span>
          <span className="flex border-l border-stone-400">{gainW > 0 && <span className="h-3 rounded-r-sm" style={{ width: `${gainW}%`, background: INK }} />}</span>
        </span>
        <span className={`whitespace-nowrap ${BODY} font-semibold tabular-nums ${r.d < 0 ? 'text-negative' : 'text-stone-900'}`}>
          {signed(r.d, unit)}{r.note && <span className={`ml-1.5 font-normal ${LABEL}`}>{r.note}</span>}
        </span>
        {r.prompts?.length > 0 ? <span className="flex justify-end max-md:col-span-3">{t.button(plural(r.prompts.length))}</span> : <span className="max-md:hidden" />}
      </div>
      {t.open && <PromptList id={t.id} prompts={r.prompts} />}
    </li>
  )
}
function Diverging({ v }) {
  const max = Math.max(...v.rows.map((r) => Math.abs(r.d)))
  return <ul className="flex flex-col border-t border-[var(--div)]">{v.rows.map((r) => <TopicRow key={r.theme} r={r} max={max} unit={v.unit} />)}</ul>
}
// counts per topic (competitor, content plan): the same row, a one-way bar; a red part where a competitor is named
function CountRow({ r, max, against }) {
  const t = useToggle()
  return (
    <li className="border-b border-[var(--div)] last:border-0">
      <div className={ROW}>
        <span className={`truncate ${BODY} text-stone-900`}>{r.theme}</span>
        <span className="flex h-3 overflow-hidden rounded-sm" style={{ width: `${(r.n / max) * 100}%` }} aria-hidden>
          {r.part != null ? <><span style={{ width: `${(r.part / r.n) * 100}%`, background: RED }} /><span className="flex-1" style={{ background: soft(INK, 22) }} /></> : <span className="flex-1" style={{ background: against ? RED : INK }} />}
        </span>
        <span className={`whitespace-nowrap ${BODY} font-semibold tabular-nums ${against ? 'text-negative' : 'text-stone-900'}`}>
          {r.n}{r.part != null && <span className={`ml-1.5 font-normal ${LABEL}`}><span className="text-negative">{r.part}</span> to {r.note}</span>}
        </span>
        {r.prompts?.length > 0 ? <span className="flex justify-end max-md:col-span-3">{t.button('Prompts')}</span> : <span className="max-md:hidden" />}
      </div>
      {t.open && <PromptList id={t.id} prompts={r.prompts} />}
    </li>
  )
}
function TopicBars({ v }) {
  const max = Math.max(...v.rows.map((r) => r.n))
  return <ul className="flex flex-col border-t border-[var(--div)]">{v.rows.map((r) => <CountRow key={r.theme} r={r} max={max} against={v.against} />)}</ul>
}
// by engine: a column per engine that ran (the scoreline's style); the ones that didn't, in one line under
function Engines({ v }) {
  const ran = v.rows.filter((e) => !e.off)
  const off = v.rows.filter((e) => e.off).map((e) => e.name)
  return (
    <div>
      <MetricCols cols={Math.min(4, Math.max(2, ran.length))} items={ran.map((e) => ({
        id: e.id, label: e.name, value: `${e.value}${v.unit}`, against: e.against, series: e.series, bad: false,
        delta: e.won != null ? <>+{e.won} won{e.lost ? <> · <span className="font-medium text-negative">−{e.lost} lost</span></> : null}</> : v.label,
      }))} />
      {off.length > 0 && <p className={`mt-3 ${META}`}>{joinAnd(off)} didn’t run {v.when ?? 'in this period'}.</p>}
    </div>
  )
}
function ShareBars({ v }) {
  const max = Math.max(...v.rows.map((r) => r.now))
  return (
    <ul className="flex flex-col">
      {v.rows.map((r) => {
        const ch = r.now - r.from
        const bad = r.you ? ch < 0 : ch > 0
        return (
          <li key={r.key} className="grid min-h-10 grid-cols-[minmax(0,160px)_1fr_auto] items-center gap-3 border-b border-[var(--div)] last:border-0 tabular-nums">
            <span className={`truncate ${BODY} ${r.you ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>{r.name}</span>
            <span className="h-2.5 rounded-sm" style={{ width: `${(r.now / max) * 100}%`, background: r.you ? INK : GREY }} />
            <span className="text-right"><span className={`${BODY} ${r.you ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>{r.now}%</span> <span className={`text-[13px] ${bad ? 'font-medium text-negative' : 'text-stone-500'}`}>{signed(ch)}</span></span>
          </li>
        )
      })}
    </ul>
  )
}
function Bars({ v }) {
  const max = Math.max(...v.rows.map((r) => r.n))
  return (
    <ul className="flex flex-col">
      {v.rows.map((r) => (
        <li key={r.name} className="grid min-h-10 grid-cols-[minmax(0,160px)_1fr_32px] items-center gap-3 border-b border-[var(--div)] last:border-0 tabular-nums">
          <span className={`truncate ${BODY} text-stone-700`}>{r.name}</span>
          <span className="h-2.5 rounded-sm" style={{ width: `${(r.n / max) * 100}%`, background: v.against ? RED : INK }} />
          <span className={`text-right ${BODY} font-semibold ${v.against ? 'text-negative' : 'text-stone-900'}`}>{r.n}</span>
        </li>
      ))}
    </ul>
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
    <div className="grid gap-6 md:grid-cols-2">
      {v.sides.map((s) => (
        <div key={s.name} className="min-w-0">
          <p className={`mb-1 text-[13px] font-medium ${s.against ? 'text-negative' : 'text-stone-600'}`}>{s.name}</p>
          <CitedList rows={s.rows} domain={s.domain} against={s.against} />
        </div>
      ))}
    </div>
  )
}
const VISUAL = { diverging: Diverging, topicBars: TopicBars, engines: Engines, shareBars: ShareBars, bars: Bars, cited: ({ v }) => <CitedList rows={v.rows} domain={v.domain} />, citedPair: CitedPair }
export const WIDE = new Set(['diverging', 'topicBars', 'citedPair', 'engines'])

function Section({ data: s, n }) {
  const V = VISUAL[s.visual.kind]
  return (
    <section>
      <SectionHead n={n} title={s.title} takeaway={s.takeaway} />
      {V && <V v={s.visual} />}
    </section>
  )
}

// ---- what to do: 3 numbered rows; "could win" with a bar scaled to the biggest action, so they compare
function ActionRow({ a, i, max }) {
  const t = useToggle()
  return (
    <li className="border-b border-[var(--div)] last:border-0">
      <div className="grid grid-cols-[24px_minmax(0,1fr)_168px_auto] items-center gap-x-4 py-3 max-md:grid-cols-[20px_minmax(0,1fr)] max-md:gap-y-2">
        <span className="self-start pt-0.5 text-[13px] leading-[18px] tabular-nums text-stone-500">{i + 1}</span>
        <span className="min-w-0">
          <span className={`block ${META}`}>{a.type} · {a.theme}</span>
          <span className={`mt-0.5 block truncate ${BODY} font-semibold text-stone-900 max-md:whitespace-normal`}>{a.title}</span>
        </span>
        <span className="min-w-0 max-md:col-start-2">
          <span className={`block ${LABEL} tabular-nums`}>Could win <b className="font-semibold text-stone-900">{plural(a.n)}</b></span>
          <span className="mt-1.5 block h-1.5 w-full rounded-sm bg-[var(--div)]"><span className="block h-full rounded-sm bg-ink" style={{ width: `${(a.n / max) * 100}%` }} /></span>
        </span>
        {a.prompts?.length > 0 && <span className="flex justify-end max-md:col-start-2 max-md:justify-start">{t.button('View prompts')}</span>}
      </div>
      {t.open && <PromptList id={t.id} prompts={a.prompts} />}
    </li>
  )
}
function Actions({ data: d, n }) {
  const max = Math.max(...d.items.map((a) => a.n))
  return (
    <section>
      <SectionHead n={n} title={d.title} />
      <ol className="flex flex-col border-t border-[var(--div)]">{d.items.map((a, i) => <ActionRow key={a.title} a={a} i={i} max={max} />)}</ol>
    </section>
  )
}

// ---- footer: one line; the details behind "Methodology"
function Sources({ data: d }) {
  const [tip, setTip] = useState(false)
  const id = useId()
  return (
    <footer className={`flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--div)] pt-4 ${META} tabular-nums`}>
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

const RENDER = { header: Header, scoreline: Scoreline, hero: Hero, section: Section, actions: Actions, sources: Sources }
export function Block({ block, title, n }) {
  const C = RENDER[block.type]
  return C ? <C data={block.data} title={title} n={n} /> : null
}
export const blockName = (b) => (b.type === 'section' ? b.data.title : { header: 'Header', scoreline: 'Scoreline', hero: HERO_TITLE[b.data.kind], actions: b.data.title, sources: 'Sources' }[b.type])

// "Explain this": how a block was worked out, in a sentence or two
export function explainFor(block) {
  const d = block.data
  switch (block.type) {
    case 'header': return 'The verdict compares the start of the period with the latest sync. Good week: you won at least twice as many prompts as you lost. Winning: first in share of voice and gaining.'
    case 'scoreline': return `Each number is the latest sync; the change is against ${d.since}. The line shows the last 8 weekly syncs.`
    case 'hero': return {
      flow: 'Every tracked prompt, once: named last week and still named (held), newly named (won), no longer named (lost), or not named either time.',
      slope: 'Of all brand mentions in AI answers to your prompts, the share each brand got at the start of the period and now.',
      quadrant: 'Every tracked prompt, by whether AI names you, them, both or neither. Where both are named, “first” is whoever the answer names first.',
      bubbles: 'Each topic’s prompts where you aren’t named, against how many of those name a competitor instead. Top right: many prompts, firmly owned.',
    }[d.kind]
    case 'section': return {
      diverging: 'Prompts gained (right) and lost (left) per topic. Topics come from grouping the prompt texts.',
      topicBars: 'Prompts per topic; open a topic for its prompts.',
      engines: 'The same measure per engine. An engine that didn’t run shows a dash, not an estimate.',
      shareBars: 'Share of voice in the latest sync, and the change since the period began.',
      bars: 'How many of your missing prompts name each competitor instead.',
      cited: 'Your pages that AI answers link to most in the latest sync.',
      citedPair: 'The pages AI cites on the prompts you both compete for, by how many answers cite each.',
    }[d.visual.kind]
    case 'actions': return 'Each action targets one topic; “could win” counts the prompts in that topic you aren’t named on today.'
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
