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

// ---- 1. header -----------------------------------------------------------------------------------------------------
function Header({ data: d, title }) {
  return (
    <header>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className={`text-[13px] leading-[18px] ${t3} tabular-nums`}>{d.brand} · {d.period} · {d.engines} · {AUDIENCE[d.audience]}</p>
        <VerdictChip verdict={d.verdict} />
      </div>
      <p className={`mt-3 text-[13px] leading-[18px] ${t2}`}>{title}</p>
      <h1 className="mt-1 line-clamp-2 max-md:line-clamp-none max-w-[44ch] text-[26px] leading-[34px] font-semibold tracking-[-0.02em] text-stone-900 [text-wrap:balance] max-md:text-[21px] max-md:leading-7">{d.headline}</h1>
    </header>
  )
}

// ---- 2. scoreline: 4 metrics in one strip, each with a value, a delta and a sparkline -----------------------------
function Scoreline({ data: d }) {
  return (
    <div>
    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-line md:grid-cols-4">
      {d.items.map((m, i) => {
        const good = m.lowerIsBetter ? m.delta < 0 : m.delta > 0
        const bad = m.delta !== 0 && (m.against ? m.delta > 0 : !good)
        return (
          <div key={m.id} className={`flex min-w-0 flex-col gap-1 px-4 py-3 ${i % 2 ? 'border-l border-line' : ''} ${i > 1 ? 'max-md:border-t max-md:border-line' : ''} ${i === 2 ? 'md:border-l md:border-line' : ''}`}>
            <span className={`truncate text-[12px] leading-4 ${t3}`}>{m.label}</span>
            <div className="flex items-end justify-between gap-2">
              <span className="min-w-0">
                <span className="flex items-baseline gap-1.5 whitespace-nowrap tabular-nums">
                  <span className="text-[24px] leading-7 font-semibold text-stone-900">{m.value}{m.unit === '%' ? '%' : ''}</span>
                  {m.of != null && <span className={`text-[12px] ${t3}`}>/ {m.of}</span>}
                  <span className={`text-[12px] ${bad ? 'font-medium text-negative' : t2}`}>{signed(m.delta, m.unit === '%' ? ' pts' : m.unit ?? '')}</span>
                </span>
              </span>
              <span className="max-md:hidden"><Sparkline series={m.series} w={72} h={26} color={m.against ? RED : INK} /></span>
              <span className="md:hidden"><Sparkline series={m.series} w={52} h={22} color={m.against ? RED : INK} /></span>
            </div>
          </div>
        )
      })}
    </div>
    <p className={`mt-1.5 text-[12px] leading-4 ${t3}`}>Change since {d.since}. Lines: the last 8 weekly syncs.</p>
    </div>
  )
}

// ---- 3. hero visuals -----------------------------------------------------------------------------------------------
// weekly: prompt flow, last week → this week (held / won / lost / still missing)
function Flow({ d }) {
  const [ref, w] = useWidth()
  const H = 230
  const gap = 18
  const bw = 12
  const k = (H - gap) / d.total
  const x1 = 112
  const x2 = w - 128
  const L = { named: d.held + d.lost, not: d.won + d.missing }
  const R = { named: d.held + d.won, not: d.lost + d.missing }
  const yL = { held: 0, lost: d.held * k, won: L.named * k + gap, missing: (L.named + d.won) * k + gap }
  const yR = { held: 0, won: d.held * k, lost: R.named * k + gap, missing: (R.named + d.lost) * k + gap }
  const ribbon = (a, b, n) => {
    const h = n * k
    const xa = x1 + bw / 2
    const xb = x2 - bw / 2
    const m = (xa + xb) / 2
    return `M${xa},${a} C${m},${a} ${m},${b} ${xb},${b} L${xb},${b + h} C${m},${b + h} ${m},${a + h} ${xa},${a + h} Z`
  }
  const flows = [
    { id: 'held', n: d.held, fill: soft(INK, 16), label: 'Held' },
    { id: 'missing', n: d.missing, fill: soft(INK, 6), label: 'Still missing' },
    { id: 'won', n: d.won, fill: soft(INK, 75), label: 'Won' },
    { id: 'lost', n: d.lost, fill: soft(RED, 80), label: 'Lost', red: true },
  ]
  const bar = (x, y, n, c) => <rect x={x - bw / 2} y={y} width={bw} height={Math.max(1.5, n * k)} rx="2" fill={c} />
  return (
    <figure className="m-0" aria-label={`Prompt flow: held ${d.held}, won ${d.won}, lost ${d.lost}, still missing ${d.missing}`}>
      <div ref={ref}>
        <svg width={w} height={H + 28} className="block overflow-visible" role="img" aria-hidden>
          <text x={x1} y={12} textAnchor="middle" fontSize="12" fill="var(--color-stone-500)">{d.from}</text>
          <text x={x2} y={12} textAnchor="middle" fontSize="12" fill="var(--color-stone-500)">{d.to}</text>
          <g transform="translate(0,24)">
            {flows.map((f) => <path key={f.id} d={ribbon(yL[f.id], yR[f.id], f.n)} fill={f.fill} />)}
            {bar(x1, yL.held, L.named, INK)}{bar(x1, yL.won, L.not, GREY)}
            {bar(x2, yR.held, R.named, INK)}{bar(x2, yR.lost, R.not, GREY)}
            <text x={x1 - 14} y={(L.named * k) / 2 + 4} textAnchor="end" fontSize="13" fill="var(--color-stone-900)" fontWeight="600" className="tabular-nums">{L.named}<tspan fontWeight="400" fill="var(--color-stone-600)"> named</tspan></text>
            <text x={x1 - 14} y={yL.won + (L.not * k) / 2 + 4} textAnchor="end" fontSize="13" fill="var(--color-stone-900)" fontWeight="600" className="tabular-nums">{L.not}<tspan fontWeight="400" fill="var(--color-stone-600)"> not</tspan></text>
            <text x={x2 + 14} y={(R.named * k) / 2 + 4} fontSize="13" fill="var(--color-stone-900)" fontWeight="600" className="tabular-nums">{R.named}<tspan fontWeight="400" fill="var(--color-stone-600)"> named</tspan></text>
            <text x={x2 + 14} y={yR.lost + (R.not * k) / 2 + 4} fontSize="13" fill="var(--color-stone-900)" fontWeight="600" className="tabular-nums">{R.not}<tspan fontWeight="400" fill="var(--color-stone-600)"> not</tspan></text>
            <text x={(x1 + x2) / 2} y={(d.held * k) / 2 + 4} textAnchor="middle" fontSize="12" fill="var(--color-stone-600)" className="tabular-nums">Held {d.held}</text>
            <text x={(x1 + x2) / 2} y={yR.missing + (d.missing * k) / 2 + 4} textAnchor="middle" fontSize="12" fill="var(--color-stone-600)" className="tabular-nums">Still missing {d.missing}</text>
          </g>
        </svg>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] leading-[18px] tabular-nums">
        <span className="inline-flex items-center gap-1.5 text-stone-900"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: soft(INK, 75) }} />Won <b className="font-semibold">{d.won}</b></span>
        <span className="inline-flex items-center gap-1.5 text-negative"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: soft(RED, 80) }} />Lost <b className="font-semibold">{d.lost}</b></span>
        <span className={`inline-flex items-center gap-1.5 ${t2}`}><span className="h-2.5 w-2.5 rounded-sm" style={{ background: soft(INK, 16) }} />Held {d.held}</span>
        <span className={`inline-flex items-center gap-1.5 ${t2}`}><span className="h-2.5 w-2.5 rounded-sm border border-line" style={{ background: soft(INK, 6) }} />Still missing {d.missing}</span>
      </figcaption>
    </figure>
  )
}

// CEO: share of voice, start → now: you (ink) vs the top competitors (grey; red when gaining on you)
function Slope({ d }) {
  const [ref, w] = useWidth()
  const H = 220
  const top = Math.ceil(Math.max(...d.rows.flatMap((r) => [r.from, r.now])) / 10) * 10
  const narrow = w < 520
  const x1 = 44
  const x2 = narrow ? w - 150 : Math.min(w - 260, 520)
  const y = (v) => 14 + (1 - v / top) * (H - 28)
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
        <svg width={w} height={H + 22} className="block overflow-visible" role="img" aria-label={`Share of voice, ${d.from} to ${d.to}`}>
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
      <figcaption className={`mt-1 text-[12px] ${t3}`}>Share of voice. A competitor in red gained on you.</figcaption>
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
      <span className={`text-[22px] leading-7 font-semibold tabular-nums ${red ? 'text-negative' : 'text-stone-900'}`}>{n}</span>
      <span className={`min-w-0 text-[13px] leading-[18px] max-md:text-[12px] ${red ? 'text-negative' : t2}`}>{label}</span>
    </div>
  )
  return (
    <figure className="m-0">
      <div className="grid grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)] text-[12px] max-md:grid-cols-2">
        <span className="max-md:hidden" />
        <span className={`px-4 pb-2 ${t3} max-md:px-3`}>AI names you</span>
        <span className={`px-4 pb-2 ${t3} max-md:px-3`}>AI doesn’t name you</span>
        <span className={`self-center pr-2 text-right ${t3} max-md:col-span-2 max-md:pb-1 max-md:pt-1 max-md:text-left`}>Names {rv}</span>
        <div className={`${cell} border-l border-t border-line`}>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <div className="flex flex-col gap-1.5"><Num n={d.youFirst} label="you first" /><Squares n={d.youFirst} color={INK} /></div>
            <div className="flex flex-col gap-1.5"><Num n={d.themFirst} red label={`${rv} first`} /><Squares n={d.themFirst} color={soft(RED, 60)} /></div>
          </div>
        </div>
        <div className={`${cell} border-l border-r border-t border-line`} style={{ background: soft(RED, 5) }}>
          <Num n={d.onlyThem} red label={`only ${rv}`} /><Squares n={d.onlyThem} color={RED} />
        </div>
        <span className={`self-center pr-2 text-right ${t3} max-md:col-span-2 max-md:pb-1 max-md:pt-3 max-md:text-left`}>Doesn’t name {rv}</span>
        <div className={`${cell} border-b border-l border-t border-line`}>
          <Num n={d.onlyYou} label="only you" /><Squares n={d.onlyYou} color={INK} />
        </div>
        <div className={`${cell} border border-line`}>
          <Num n={d.neither} label="neither" /><Squares n={d.neither} color={soft(INK, 10)} />
        </div>
      </div>
      <figcaption className={`mt-2 text-[12px] ${t3}`}>All {d.total} tracked prompts. Red: prompts {rv} wins.</figcaption>
    </figure>
  )
}

// content plan: topics as bubbles (prompts you're missing × how strongly competitors own them)
function Bubbles({ d }) {
  const [ref, w] = useWidth()
  const H = 260
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
          {[0, 50, 100].map((v) => <text key={v} x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-stone-500)">{v}%</text>)}
          <text x={x(maxX)} y={H - 10} textAnchor="end" fontSize="11" fill="var(--color-stone-500)">Prompts you’re missing →</text>
          <text x={pad.l} y={H - 10} fontSize="11" fill="var(--color-stone-500)">0</text>
          {d.rows.map((r) => {
            const hot = r.own >= 60 && r.missing >= maxX / 2
            return (
              <g key={r.theme}>
                <circle cx={x(r.missing)} cy={y(r.own)} r={rr(r.missing)} fill={hot ? soft(RED, 22) : soft(INK, 10)} stroke={hot ? RED : 'var(--color-stone-400)'} strokeWidth="1.25" />
                <text x={x(r.missing)} y={y(r.own) + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={hot ? RED : 'var(--color-stone-700)'} className="tabular-nums">{r.missing}</text>
                <text x={x(r.missing)} y={y(r.own) + rr(r.missing) + 13} textAnchor="middle" fontSize="12" fill="var(--color-stone-800)">{r.theme}</text>
              </g>
            )
          })}
        </svg>
      </div>
      <figcaption className={`mt-1 text-[12px] ${t3}`}>Up: the share of those prompts where a competitor is named instead. Size: prompts missing.</figcaption>
    </figure>
  )
}

const HERO_TITLE = { flow: 'Prompt flow', slope: 'Share of voice', quadrant: 'Head to head', bubbles: 'Opportunity map' }
function Hero({ data: d }) {
  return (
    <section>
      <p className={`mb-3 text-[13px] leading-[18px] font-medium ${t2}`}>{HERO_TITLE[d.kind]}</p>
      {d.kind === 'flow' ? <Flow d={d} /> : d.kind === 'slope' ? <Slope d={d} /> : d.kind === 'quadrant' ? <Quadrant d={d} /> : <Bubbles d={d} />}
    </section>
  )
}

// ---- 4. section visuals --------------------------------------------------------------------------------------------
function Diverging({ v }) {
  const max = Math.max(...v.rows.map((r) => Math.abs(r.d)))
  return (
    <ul className="flex flex-col">
      {v.rows.map((r) => (
        <li key={r.theme} className="grid grid-cols-[minmax(0,180px)_1fr] items-start gap-x-4 border-b border-[var(--div)] py-2 last:border-0 max-md:grid-cols-1">
          <div className="min-w-0 pt-0.5">
            <span className="block truncate text-[14px] leading-5 text-stone-900">{r.theme}</span>
            {r.prompts && <PromptsToggle prompts={r.prompts} />}
          </div>
          <div className="grid grid-cols-2 items-center pt-1 max-md:pt-1.5">
            <div className="flex items-center justify-end gap-2 border-r border-stone-300 pr-0">
              {r.d < 0 && <><span className="text-[12px] font-medium text-negative tabular-nums">{signed(r.d, v.unit)}{r.note ? <span className="font-normal"> · {r.note}</span> : null}</span><span className="h-3 rounded-l-sm" style={{ width: `${(Math.abs(r.d) / max) * 80}%`, background: RED }} /></>}
            </div>
            <div className="flex items-center gap-2">
              {r.d > 0 && <><span className="h-3 rounded-r-sm" style={{ width: `${(r.d / max) * 80}%`, background: INK }} /><span className="text-[12px] font-medium text-stone-900 tabular-nums">{signed(r.d, v.unit)}</span></>}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
function TopicBars({ v }) {
  const max = Math.max(...v.rows.map((r) => r.n))
  return (
    <ul className="flex flex-col">
      {v.rows.map((r) => (
        <li key={r.theme} className="border-b border-[var(--div)] py-2 last:border-0">
          <div className="grid grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-x-4 max-md:grid-cols-[minmax(0,1fr)_auto]">
            <span className="truncate text-[14px] leading-5 text-stone-900">{r.theme}</span>
            <span className="flex h-3 overflow-hidden rounded-sm max-md:order-3 max-md:col-span-2 max-md:mt-1.5" style={{ width: `${(r.n / max) * 100}%` }}>
              {r.part != null ? <><span style={{ width: `${(r.part / r.n) * 100}%`, background: RED }} /><span className="flex-1" style={{ background: soft(INK, 22) }} /></> : <span className="flex-1" style={{ background: v.against ? RED : INK }} />}
            </span>
            <span className="text-right text-[13px] tabular-nums">
              <span className={`font-semibold ${v.against ? 'text-negative' : 'text-stone-900'}`}>{r.n}</span>
              {r.part != null && <span className={t3}> · <span className="text-negative">{r.part}</span> to {r.note}</span>}
            </span>
          </div>
          <div className="mt-0.5"><PromptsToggle prompts={r.prompts} /></div>
        </li>
      ))}
    </ul>
  )
}
function Engines({ v }) {
  return (
    <div className="grid grid-cols-2 border-y border-[var(--div)] sm:grid-cols-4">
      {v.rows.map((e, i) => (
        <div key={e.id} className={`flex flex-col gap-1 py-3 ${i % 2 ? 'border-l border-[var(--div)] pl-3' : 'pr-3'} sm:border-l sm:border-[var(--div)] sm:px-3 ${i === 0 ? 'sm:!border-l-0 sm:!pl-0' : ''} ${i > 1 ? 'max-sm:border-t max-sm:border-[var(--div)]' : ''}`}>
          <span className="text-[13px] leading-[18px] text-stone-900">{e.name}</span>
          {e.off ? (
            <>
              <span className={`text-[20px] leading-7 ${t3}`}>—</span>
              <span className={`text-[12px] leading-4 ${t3}`}>Didn’t run</span>
            </>
          ) : (
            <>
              <div className="flex items-end justify-between gap-2">
                <span className={`text-[20px] leading-7 font-semibold tabular-nums ${e.against ? 'text-negative' : 'text-stone-900'}`}>{e.value}{v.unit}</span>
                <Sparkline series={e.series} w={56} h={22} color={e.against ? RED : INK} fill={false} />
              </div>
              <span className={`text-[12px] leading-4 tabular-nums ${t3}`}>
                {e.won != null ? <><span className="text-stone-700">+{e.won} won</span>{e.lost ? <> · <span className="font-medium text-negative">−{e.lost} lost</span></> : null}</> : v.label}
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
function ShareBars({ v }) {
  const max = Math.max(...v.rows.map((r) => r.now))
  return (
    <ul className="flex flex-col gap-2.5">
      {v.rows.map((r) => {
        const ch = r.now - r.from
        const bad = r.you ? ch < 0 : ch > 0
        return (
          <li key={r.key} className="grid grid-cols-[minmax(0,150px)_1fr_76px] items-center gap-3 text-[13px] tabular-nums">
            <span className={`truncate ${r.you ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>{r.name}</span>
            <span className="h-2.5 rounded-sm" style={{ width: `${(r.now / max) * 100}%`, background: r.you ? INK : GREY }} />
            <span className="text-right"><span className={r.you ? 'font-semibold text-stone-900' : 'text-stone-700'}>{r.now}%</span> <span className={`text-[12px] ${bad ? 'font-medium text-negative' : t3}`}>{signed(ch)}</span></span>
          </li>
        )
      })}
    </ul>
  )
}
function Bars({ v }) {
  const max = Math.max(...v.rows.map((r) => r.n))
  return (
    <ul className="flex flex-col gap-2.5">
      {v.rows.map((r) => (
        <li key={r.name} className="grid grid-cols-[minmax(0,150px)_1fr_32px] items-center gap-3 text-[13px] tabular-nums">
          <span className="truncate text-stone-700">{r.name}</span>
          <span className="h-2.5 rounded-sm" style={{ width: `${(r.n / max) * 100}%`, background: v.against ? RED : INK }} />
          <span className={`text-right font-semibold ${v.against ? 'text-negative' : 'text-stone-900'}`}>{r.n}</span>
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
          <div className="flex items-baseline justify-between gap-3 text-[13px] tabular-nums">
            <span className="min-w-0 truncate"><span className={t3}>{domain}</span><span className="text-stone-900">{r.path}</span>{r.isNew && <span className={`ml-2 text-[12px] ${t3}`}>new</span>}</span>
            <span className={`shrink-0 ${against ? 'font-medium text-negative' : t2}`}>{r.n} answers</span>
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
          <p className={`mb-1 text-[12px] font-medium ${s.against ? 'text-negative' : t2}`}>{s.name}</p>
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
      <div className="flex items-baseline gap-3">
        <span className={`text-[13px] font-semibold tabular-nums ${t3}`}>{String(n).padStart(2, '0')}</span>
        <h2 className="text-[17px] leading-6 font-semibold text-stone-900">{s.title}</h2>
      </div>
      <p className={`mt-1 mb-4 text-[14px] leading-5 ${t2} [text-wrap:pretty]`}>{s.takeaway}</p>
      {V && <V v={s.visual} />}
    </section>
  )
}

// ---- 6. what to do: 3 action cards ---------------------------------------------------------------------------------
function Actions({ data: d }) {
  const max = Math.max(...d.items.map((a) => a.n))
  return (
    <section>
      <h2 className="mb-4 text-[17px] leading-6 font-semibold text-stone-900">{d.title}</h2>
      <ol className="grid gap-3 md:grid-cols-3">
        {d.items.map((a, i) => (
          <li key={a.title} className="flex flex-col gap-3 rounded-xl border border-line p-4">
            <span className={`text-[12px] leading-4 ${t3}`}><span className="tabular-nums">{i + 1}</span> · {a.type}</span>
            <span className="text-[15px] leading-[22px] font-semibold text-stone-900 [text-wrap:pretty]">{a.title}</span>
            <div className="mt-auto">
              <div className="flex items-baseline justify-between text-[12px] leading-4 tabular-nums">
                <span className={t2}>Could win</span><span className="font-semibold text-stone-900">{a.n} prompts</span>
              </div>
              <span className="mt-1.5 block h-1.5 rounded-sm bg-[var(--div)]"><span className="block h-full rounded-sm bg-ink" style={{ width: `${(a.n / max) * 100}%` }} /></span>
              <p className={`mt-2 text-[12px] leading-4 ${t3}`}>{a.theme}</p>
            </div>
            <PromptsToggle prompts={a.prompts} />
          </li>
        ))}
      </ol>
    </section>
  )
}

function Sources({ data: d }) {
  return (
    <footer className={`border-t border-[var(--div)] pt-4 text-[12px] leading-[18px] ${t3}`}>
      <p className="max-w-[90ch]">Sources: Kraffic AI visibility data (tracked prompts, AI answers and their citations) from {d.syncs} weekly syncs, {d.from} – {d.to}, 2026. Engines counted: {d.engines.join(', ') || 'none'}.</p>
      {d.left.length > 0 && <p className="mt-1 max-w-[90ch]">Not in this report: {d.left.join(' ')}</p>}
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

// ---- thumbnails (home: templates and report cards) -----------------------------------------------------------------
export function Thumb({ kind, className = 'h-16 w-28' }) {
  const ink = INK
  const grey = 'var(--color-stone-300)'
  return (
    <svg viewBox="0 0 112 64" className={className} aria-hidden>
      {kind === 'weekly' && (
        <g>
          <rect x="14" y="6" width="5" height="30" rx="1.5" fill={ink} /><rect x="14" y="40" width="5" height="18" rx="1.5" fill={grey} />
          <rect x="93" y="6" width="5" height="34" rx="1.5" fill={ink} /><rect x="93" y="44" width="5" height="14" rx="1.5" fill={grey} />
          <path d="M19 6 C56 6 56 6 93 6 L93 34 C56 34 56 32 19 32 Z" fill={soft(ink, 16)} />
          <path d="M19 40 C56 40 56 34 93 34 L93 40 C56 40 56 46 19 46 Z" fill={soft(ink, 75)} />
          <path d="M19 32 C56 32 56 44 93 44 L93 46 C56 46 56 36 19 36 Z" fill={soft(RED, 80)} />
          <path d="M19 46 C56 46 56 46 93 46 L93 58 C56 58 56 58 19 58 Z" fill={soft(ink, 6)} />
        </g>
      )}
      {kind === 'ceo' && (
        <g strokeLinecap="round">
          <line x1="16" x2="16" y1="4" y2="60" stroke="var(--div)" /><line x1="96" x2="96" y1="4" y2="60" stroke="var(--div)" />
          <line x1="16" y1="24" x2="96" y2="10" stroke={ink} strokeWidth="3" />
          <line x1="16" y1="20" x2="96" y2="22" stroke={RED} strokeWidth="1.5" />
          <line x1="16" y1="38" x2="96" y2="40" stroke={grey} strokeWidth="1.5" />
          <line x1="16" y1="48" x2="96" y2="52" stroke={grey} strokeWidth="1.5" />
          <circle cx="96" cy="10" r="3.5" fill={ink} />
        </g>
      )}
      {kind === 'rival' && (
        <g>
          {[[10, 6, ink, 18], [58, 6, RED, 7], [10, 36, ink, 14], [58, 36, soft(ink, 12), 12]].map(([x, y, c, n], qi) => (
            <g key={qi}>{Array.from({ length: n }, (_, i) => <rect key={i} x={x + (i % 6) * 7} y={y + Math.floor(i / 6) * 7} width="5" height="5" rx="1" fill={c} />)}</g>
          ))}
          <line x1="54" x2="54" y1="2" y2="62" stroke="var(--div)" /><line x1="4" x2="108" y1="32" y2="32" stroke="var(--div)" />
        </g>
      )}
      {kind === 'content' && (
        <g>
          <rect x="58" y="4" width="50" height="26" fill={soft(RED, 6)} />
          <circle cx="86" cy="14" r="9" fill={soft(RED, 25)} stroke={RED} /><circle cx="70" cy="22" r="7" fill={soft(RED, 25)} stroke={RED} />
          <circle cx="42" cy="40" r="6" fill={soft(ink, 10)} stroke="var(--color-stone-400)" /><circle cx="24" cy="50" r="4.5" fill={soft(ink, 10)} stroke="var(--color-stone-400)" />
          <circle cx="58" cy="46" r="5" fill={soft(ink, 10)} stroke="var(--color-stone-400)" />
          <line x1="6" x2="108" y1="60" y2="60" stroke={grey} />
        </g>
      )}
    </svg>
  )
}
