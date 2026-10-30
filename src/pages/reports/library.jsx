import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, Info } from 'lucide-react'
import SiteLogo from '../../components/ui/SiteLogo'
import { EngineMark } from '../insights/parts'
import { linkClick } from '../../router'

// The report block library (v2). One question, one hero built for it; every section is title · one-line takeaway ·
// the visual · details 5 at a time ("Show all N"). The reading column is 760px; a figure can go wide (the article's
// 1100px). Graphite, Manrope, tabular numbers; red only for a loss of yours; the competitor in its line colour.
export const t2 = 'text-stone-600'
export const t3 = 'text-stone-500'
export const READ = 'max-w-[760px]'
const INK = 'var(--ink)'
const RED = 'var(--negative)'
const TRACK = 'color-mix(in srgb, var(--ink) 9%, transparent)'
const LABEL = 'text-[13px] leading-[18px] text-stone-600'
const META = 'text-[12px] leading-4 text-stone-500'
const PAGE_SIZE = 5
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function useWidth(initial = 640) {
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

// ▲ / ▼ with the change; red only when it goes against you
export function Delta({ n, unit = '', bad = n < 0, className = '' }) {
  if (n == null) return null
  return <span className={`whitespace-nowrap tabular-nums ${bad && n !== 0 ? 'font-medium text-negative' : 'text-stone-600'} ${className}`}>{n > 0 ? '▲' : n < 0 ? '▼' : '±'}{Math.abs(n)}{n === 0 ? '' : unit}</span>
}

// ---- verdict: the word with its dot, then the headline sentence -----------------------------------------------------
export function Verdict({ v, headline }) {
  const tone = v?.tone ?? 'mid'
  return (
    <div>
      {v && (
        <p className={`inline-flex items-center gap-2 text-[15px] leading-5 font-semibold ${tone === 'down' ? 'text-negative' : 'text-stone-900'}`}>
          <span className="h-2 w-2 rounded-full" style={{ background: tone === 'down' ? RED : tone === 'up' ? INK : 'var(--color-stone-400)' }} aria-hidden />{v.word}
        </p>
      )}
      <h1 className={`mt-2 ${READ} text-[26px] leading-[34px] font-semibold tracking-[-0.01em] text-stone-900 [text-wrap:balance] max-md:text-[22px] max-md:leading-[29px]`}>{headline}</h1>
    </div>
  )
}

// ---- stat row: at most 4, hairlines between, no boxes ---------------------------------------------------------------
export function StatRow({ v }) {
  const items = v.items.slice(0, 4)
  const cols = { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' }[items.length] ?? 'md:grid-cols-4'
  return (
    <dl className={`grid grid-cols-2 gap-y-5 ${cols}`}>
      {items.map((m, i) => (
        <div key={m.label} className={`min-w-0 pr-4 ${i % 2 ? 'border-l border-line pl-4 md:pl-5' : ''} ${i > 0 && i % 2 === 0 ? 'md:border-l md:border-line md:pl-5' : ''}`}>
          <dt className={LABEL}>{m.label}</dt>
          <dd className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className={`text-[28px] leading-8 font-semibold tracking-[-0.01em] tabular-nums ${m.bad ? 'text-negative' : 'text-stone-900'}`}>
              {m.value}{m.unit ?? ''}{m.of != null && <span className="text-[15px] font-normal tracking-normal text-stone-500">/{m.of}</span>}
            </span>
            {m.delta != null && <Delta n={m.delta} bad={m.worseUp ? m.delta > 0 : m.delta < 0} className="text-[13px] leading-[18px]" />}
            {m.sub && <span className={`${META} tabular-nums`}>{m.sub}</span>}
          </dd>
          {m.since && <span className={`block ${META} tabular-nums`}>since {m.since}</span>}
        </div>
      ))}
    </dl>
  )
}

// ---- head-to-head bar: every tracked prompt once, in four parts (only them · both · only you · neither), on an axis ---
const SEG = (color) => ({ them: color, both: 'color-mix(in srgb, var(--ink) 38%, transparent)', you: INK, none: TRACK })
export function HeadToHead({ v }) {
  const c = SEG(v.color)
  const [hi, setHi] = useState(null)
  const segs = v.segs.filter((s) => s.n > 0)
  let at = 0
  const spans = segs.map((s) => { const from = at; at += s.n; return { ...s, mid: ((from + s.n / 2) / v.total) * 100 } })
  const tip = hi != null ? spans[hi] : null
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ f, n: Math.round(v.total * f) }))
  const fg = (s) => (s.tone === 'none' ? 'var(--color-stone-600)' : s.tone === 'both' ? 'var(--color-stone-900)' : s.tone === 'you' ? 'var(--on-ink)' : 'var(--pie-on-c1)')
  return (
    <figure className="w-full">
      <figcaption className={LABEL}>Every tracked prompt, once: who AI names on it</figcaption>
      <div className="relative mt-3">
        <div role="img" aria-label={`${v.total} tracked prompts: ${v.segs.map((s) => `${s.label} ${s.n}`).join(', ')}`} className="flex h-8 w-full gap-[2px] overflow-hidden rounded-md">
          {spans.map((s, k) => (
            <span key={s.key} tabIndex={0} aria-label={`${s.label}: ${s.n}`} onMouseEnter={() => setHi(k)} onMouseLeave={() => setHi(null)} onFocus={() => setHi(k)} onBlur={() => setHi(null)}
              className="relative h-full min-w-0 outline-none transition-opacity duration-150 focus-visible:ring-2 focus-visible:ring-focus" style={{ flex: `${s.n} 1 0`, background: c[s.tone], opacity: hi != null && hi !== k ? 0.45 : 1 }}>
              <span className="absolute inset-0 flex items-center justify-center overflow-hidden text-[13px] font-semibold tabular-nums" style={{ color: fg(s) }}>{s.n}</span>
            </span>
          ))}
        </div>
        {tip?.prompts?.length > 0 && (
          <span role="tooltip" className={`pointer-events-none absolute top-full z-20 mt-2 block w-max max-w-[320px] rounded-lg border border-line bg-raised px-3 py-2 text-[12px] leading-[18px] text-stone-700 shadow-md ${tip.mid < 18 ? '' : tip.mid > 82 ? '-translate-x-full' : '-translate-x-1/2'}`}
            style={{ left: tip.mid < 18 ? 0 : tip.mid > 82 ? '100%' : `${tip.mid}%` }}>
            <b className="block font-semibold text-stone-900">{tip.label}</b>
            {tip.prompts.slice(0, 6).map((p) => <span key={p} className="block truncate">{p}</span>)}
            {tip.prompts.length > 6 && <span className={`block ${t3}`}>+{tip.prompts.length - 6} more below</span>}
          </span>
        )}
      </div>
      {/* the axis: from none to every tracked prompt */}
      <div className="relative mt-1.5 h-6 border-t border-line-strong" aria-hidden>
        {ticks.map((t) => (
          <span key={t.f} className={`absolute top-0 flex flex-col items-center text-[11px] leading-4 tabular-nums text-stone-500 ${t.f === 0 ? 'items-start' : t.f === 1 ? '-translate-x-full items-end' : '-translate-x-1/2'}`} style={{ left: `${t.f * 100}%` }}>
            <span className="h-1 w-px bg-line-strong" />{t.n}
          </span>
        ))}
      </div>
      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-[13px] leading-[18px] tabular-nums">
        {v.segs.map((s) => (
          <div key={s.key} className="inline-flex flex-wrap items-baseline gap-x-1.5">
            <span className="h-2 w-2 shrink-0 self-center rounded-full" style={{ background: c[s.tone], boxShadow: s.tone === 'none' ? 'inset 0 0 0 1px var(--color-line-strong)' : undefined }} aria-hidden />
            <dt className="text-stone-600">{s.label}</dt><dd className="font-semibold text-stone-900">{s.n}</dd>
            {s.sub && <dd className={META}>{s.sub}</dd>}
          </div>
        ))}
      </dl>
      {v.deltas && (
        <p className={`mt-2 ${META} tabular-nums`}>
          Prompts won since {v.since}: {v.deltas.map((x, i) => <span key={x.name}>{i ? ' · ' : ''}{x.name} <Delta n={x.d} bad={!!x.you && x.d < 0} /></span>)}
        </p>
      )}
    </figure>
  )
}

// ---- trend chart: lines over the weekly syncs, both axes drawn, the lines named at their ends ----------------------
export function TrendChart({ v }) {
  const [ref, w] = useWidth(800)
  const H = 220
  const padL = 36
  const padR = 124
  const top = 12
  const bot = 28
  const vals = v.lines.flatMap((l) => l.series)
  const lo0 = Math.min(...vals)
  const hi0 = Math.max(...vals)
  const range = Math.max(4, hi0 - lo0)
  const step = [1, 2, 5, 10, 20, 25, 50].find((s) => range / s <= 4) ?? 50
  const lo = Math.max(0, Math.floor(lo0 / step) * step)
  const hi = Math.ceil(hi0 / step) * step
  const ticks = []
  for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(t)
  const n = v.dates.length
  const x = (i) => padL + (i * (w - padL - padR)) / Math.max(1, n - 1)
  const y = (val) => top + (1 - (val - lo) / (hi - lo || 1)) * (H - top - bot)
  const ends = v.lines.map((l) => ({ l, y: y(l.series.at(-1)) })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16
  const color = (l) => (l.you ? INK : l.color ?? 'var(--color-stone-400)')
  const every = (w - padL - padR) / Math.max(1, n - 1) < 64 ? 2 : 1
  return (
    <figure className="w-full">
      <p className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${LABEL}`}>
        {v.lines.map((l) => <span key={l.key} className={`inline-flex items-center gap-1.5 ${l.you ? 'font-medium text-stone-900' : ''}`}><span className="w-3.5 rounded-full" style={{ background: color(l), height: l.you ? 3 : 2 }} aria-hidden />{l.name}</span>)}
      </p>
      <div ref={ref} className="mt-3 w-full">
        {w > 0 && (
          <svg width={w} height={H} role="img" aria-label={v.lines.map((l) => `${l.name}: ${l.series.at(-1)}${v.unit} at the latest sync`).join('; ')} className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--div)" />
                <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-stone-500 text-[11px] tabular-nums">{t}{v.unit}</text>
              </g>
            ))}
            <line x1={padL} x2={padL} y1={top} y2={H - bot} stroke="var(--color-line-strong)" />
            <line x1={padL} x2={w - padR} y1={H - bot} y2={H - bot} stroke="var(--color-line-strong)" />
            {v.dates.map((d, i) => ((i % every === 0 || i === n - 1) ? <text key={d} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="fill-stone-500 text-[11px]">{d}</text> : null))}
            {[...v.lines].reverse().map((l) => (
              <g key={l.key}>
                <polyline points={l.series.map((s, i) => `${x(i)},${y(s)}`).join(' ')} fill="none" stroke={color(l)} strokeWidth={l.you ? 2.5 : 1.75} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(n - 1)} cy={y(l.series.at(-1))} r={l.you ? 4 : 3} fill={color(l)} stroke="var(--color-surface)" strokeWidth="2" />
              </g>
            ))}
            {ends.map(({ l, y: ly }) => <text key={l.key} x={x(n - 1) + 10} y={ly} dy="0.32em" className={`text-[12px] tabular-nums ${l.you ? 'fill-stone-900 font-semibold' : 'fill-stone-600'}`}>{l.name} {l.series.at(-1)}{v.unit}</text>)}
          </svg>
        )}
      </div>
    </figure>
  )
}

// ---- topic coverage bars: named x of y per topic, on a 0–100% axis ------------------------------------------------
export function CoverageBars({ v, shown = Infinity }) {
  const rows = v.rows.slice(0, shown)
  return (
    <div>
      <ul className="flex flex-col divide-y divide-[var(--div)]">
        {rows.map((r) => (
          <li key={r.label} className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-1.5 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_96px]">
            <span className={`truncate text-[14px] leading-5 ${r.highlight ? 'font-semibold text-stone-900' : 'text-stone-800'}`}>{r.label}</span>
            <span className="relative col-span-2 h-2.5 overflow-hidden rounded-full md:col-span-1" style={{ background: TRACK }} aria-hidden>
              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(r.n / Math.max(1, r.of)) * 100}%`, background: r.highlight ? INK : 'var(--color-stone-500)' }} />
            </span>
            <span className="text-right text-[13px] tabular-nums text-stone-600"><b className="font-semibold text-stone-900">{r.n}</b> of {r.of}</span>
          </li>
        ))}
      </ul>
      <div className="mt-1 hidden grid-cols-[minmax(0,220px)_minmax(0,1fr)_96px] gap-x-4 md:grid" aria-hidden>
        <span /><span className="flex justify-between border-t border-line-strong pt-1 text-[11px] leading-4 tabular-nums text-stone-500"><span>0%</span><span>50%</span><span>100%</span></span>
      </div>
    </div>
  )
}

// ---- prompt groups: every prompt in full (it wraps; never cut mid-word), grouped by topic with the page AI cites for
// them and for you; each row shows the engines that named them and who's named instead ------------------------------
export function PromptGroups({ v, shown = Infinity }) {
  let left = shown
  const named = (r) => {
    if (!r.named?.length) return <span className={t3}>No one named</span>
    const [who, ...rest] = r.named
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1.5">
        {v.them && who === v.them && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: v.color }} aria-hidden />}
        <span className="text-stone-900">{who}{rest.length > 0 && <span className={t3}>, then {rest.join(', ')}</span>}</span>
      </span>
    )
  }
  return (
    <div className="flex flex-col gap-7">
      {v.engines?.length > 0 && (
        <p className={`flex flex-wrap items-center gap-x-5 gap-y-1 ${LABEL}`}>
          {v.engines.map((e) => <span key={e.id} className="inline-flex items-center gap-1.5"><EngineMark id={e.id} size={14} />{e.name}<b className="font-semibold tabular-nums text-stone-900">{e.n}</b></span>)}
        </p>
      )}
      {v.groups.map((g) => {
        if (left <= 0) return null
        const rows = g.rows.slice(0, left)
        left -= rows.length
        return (
          <section key={g.theme} aria-label={g.theme}>
            <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line pb-2">
              <h3 className="text-[15px] leading-5 font-semibold text-stone-900">{g.theme} <span className={`ml-1 text-[13px] font-normal tabular-nums ${t3}`}>{plural(g.rows.length, 'prompt')}</span></h3>
              {(g.page || g.yourPage) && (
                <span className={`flex flex-wrap items-center gap-x-4 gap-y-0.5 ${META} tabular-nums`}>
                  {g.page && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: v.color }} aria-hidden /><span className="truncate" title={g.page.path}>{g.page.text}</span>· {g.page.n} answers</span>}
                  {g.yourPage
                    ? <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-ink" aria-hidden /><span className="truncate" title={g.yourPage.path}>{g.yourPage.text}</span>· {g.yourPage.n}</span>
                    : <span className="font-medium text-negative">No page of yours cited</span>}
                </span>
              )}
            </header>
            <ul className="divide-y divide-[var(--div)]">
              {rows.map((r) => (
                <li key={r.text} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-5 gap-y-1 py-2.5 md:grid-cols-[minmax(0,1fr)_64px_minmax(0,220px)]">
                  <span className="text-[14px] leading-5 text-stone-900 [text-wrap:pretty]">{r.text}</span>
                  <span className="flex min-h-5 items-center gap-1.5">{r.engines.map((e) => <EngineMark key={e} id={e} size={14} />)}</span>
                  <span className={`col-span-2 text-[13px] leading-5 md:col-span-1 ${t2}`}>{named(r)}</span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

// ---- page leaderboard: distinct pages, the answers citing each, one scale with its axis -----------------------------
const PAGE_COLS = 'md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_88px]'
export function PageLeaderboard({ v, shown = Infinity }) {
  const rows = v.rows.slice(0, shown)
  const max = Math.max(1, ...v.rows.map((r) => r.n))
  return (
    <div>
      <ul className="flex flex-col divide-y divide-[var(--div)]">
        {rows.map((r) => (
          <li key={`${r.domain}${r.path}`} className={`grid grid-cols-[minmax(0,1fr)_72px] items-center gap-x-4 py-2.5 ${PAGE_COLS}`}>
            <span className="flex min-w-0 items-center gap-2.5">
              <SiteLogo domain={r.domain} name={r.who} className="h-5 w-5 shrink-0 rounded" imgPad="p-0" initialClass="text-[9px]" plate />
              <span className="min-w-0">
                <span className="block truncate text-[13px] leading-[18px] text-stone-900" title={`${r.domain}${r.path}`}>{r.path}</span>
                <span className={`block ${META}`}>{r.who}{r.isNew ? ' · new' : ''}</span>
              </span>
            </span>
            <span className="relative h-2 max-md:hidden" aria-hidden>
              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(r.n / max) * 100}%`, background: r.you ? INK : r.color ?? 'var(--color-stone-400)' }} />
            </span>
            <span className="text-right text-[13px] tabular-nums"><b className="font-semibold text-stone-900">{r.n}</b> <span className={t3}>{v.unit}</span></span>
          </li>
        ))}
      </ul>
      <div className={`mt-1 hidden gap-x-4 md:grid ${PAGE_COLS}`} aria-hidden>
        <span /><span className="flex justify-between border-t border-line-strong pt-1 text-[11px] leading-4 tabular-nums text-stone-500"><span>0</span><span>{max} {v.unit}</span></span>
      </div>
    </div>
  )
}

// ---- quote cards: what an answer said, with the engine and the prompt it answered -----------------------------------
export function QuoteCards({ v }) {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {v.items.slice(0, 3).map((q) => (
        <li key={q.text} className="flex flex-col rounded-xl border border-line p-4">
          <p className="flex-1 text-[15px] leading-6 text-stone-900 [text-wrap:pretty]">“{q.text}”</p>
          <p className={`mt-3 flex items-center gap-2 ${META}`}><EngineMark id={q.engine} size={14} /><span className="truncate" title={q.prompt}>{q.prompt}</span></p>
        </li>
      ))}
    </ul>
  )
}

// ---- gained / lost: two columns, the lost side in red ---------------------------------------------------------------
export function GainedLost({ v, shown = Infinity }) {
  const col = (title, rows, bad) => (
    <div className="min-w-0">
      <p className={`flex items-baseline gap-2 border-b border-line pb-2 text-[14px] font-semibold ${bad ? 'text-negative' : 'text-stone-900'}`}>{title}<span className={`text-[13px] font-normal tabular-nums ${t3}`}>{rows.length}</span></p>
      <ul className="divide-y divide-[var(--div)]">
        {rows.slice(0, shown).map((r) => <li key={r.text} className="flex items-start gap-2 py-2 text-[14px] leading-5 text-stone-900 [text-wrap:pretty]"><span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${bad ? 'bg-negative' : 'bg-ink'}`} aria-hidden />{r.text}</li>)}
        {rows.length === 0 && <li className={`py-2 ${LABEL}`}>None</li>}
      </ul>
    </div>
  )
  return <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">{col('Gained', v.gained, false)}{col('Lost', v.lost, true)}</div>
}

// ---- next steps: numbered, each one a link to where it's done ------------------------------------------------------
export function NextSteps({ v }) {
  return (
    <ol className="flex flex-col divide-y divide-[var(--div)]">
      {v.items.map((s, i) => (
        <li key={s.id ?? s.title} className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-x-4 py-4 first:pt-0 last:pb-0 md:grid-cols-[28px_minmax(0,1fr)_auto]">
          <span className="grid h-7 w-7 place-items-center rounded-full border border-ink text-[13px] leading-none font-semibold tabular-nums text-ink" aria-hidden>{i + 1}</span>
          <span className="min-w-0 pt-0.5">
            <span className="block text-[15px] leading-[22px] font-medium text-stone-900 [text-wrap:pretty]">{s.title}</span>
            <span className={`mt-0.5 block ${LABEL} tabular-nums`}>{s.meta}{s.n ? ` · ${plural(s.n, 'prompt')}` : ''}</span>
          </span>
          {s.action && (
            <a href={s.action.href} onClick={linkClick(s.action.href)}
              className="inline-flex h-8 w-fit items-center gap-1 whitespace-nowrap rounded-lg border border-line px-3 text-[13px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus max-md:col-start-2 max-md:mt-2">
              {s.action.label}<ArrowRight size={14} aria-hidden />
            </a>
          )}
        </li>
      ))}
    </ol>
  )
}

// ---- "How I read your question": what was asked, the scope, the data used (the custom report's first band) ----------
export function ReadStrip({ data: d }) {
  return (
    <section aria-label="How I read your question" className="rounded-xl bg-tint px-5 py-4 max-md:px-4">
      <p className="text-[13px] leading-[18px] font-semibold text-stone-900">How I read your question</p>
      <dl className="mt-3 grid gap-x-8 gap-y-3 md:grid-cols-3">
        {[['Question', d.question], ['Scope', d.scope], ['Data used', d.data]].map(([k, val]) => (
          <div key={k} className="min-w-0"><dt className={META}>{k}</dt><dd className="mt-0.5 text-[14px] leading-5 text-stone-900 [text-wrap:pretty] tabular-nums">{val}</dd></div>
        ))}
      </dl>
      {d.note && <p className={`mt-3 ${LABEL} [text-wrap:pretty]`}>{d.note}</p>}
    </section>
  )
}

// ---- "Not in your data": a part of the question the data can't answer, said plainly, with where it is --------------
export function NotInData({ v }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3">
      <Info size={16} className="mt-0.5 shrink-0 text-stone-500" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-[18px] font-semibold text-stone-900">Not in your data</p>
        <p className={`mt-0.5 text-[14px] leading-5 ${t2} [text-wrap:pretty]`}>{v.text}</p>
        {v.href && <a href={v.href} onClick={linkClick(v.href)} className="mt-2 inline-flex items-center gap-1 rounded text-[13px] font-medium text-stone-700 underline underline-offset-4 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">{v.label}<ArrowRight size={13} aria-hidden /></a>}
      </div>
    </div>
  )
}

// ---- the bands ------------------------------------------------------------------------------------------------------
const BLOCKS = { stats: StatRow, h2h: HeadToHead, trend: TrendChart, coverage: CoverageBars, promptGroups: PromptGroups, pages: PageLeaderboard, quotes: QuoteCards, gainedLost: GainedLost, steps: NextSteps, notInData: NotInData }
const HERO = { h2h: HeadToHead, trend: TrendChart, coverage: CoverageBars, pages: PageLeaderboard }

// the hero band: one plain line (brand · period · engines), the verdict and headline, then the one visual built for the question
export function Hero2({ data: d }) {
  const V = HERO[d.visual?.kind]
  return (
    <header>
      {d.kind !== 'custom' && <p className={`${META} tabular-nums`}>{d.line}</p>}
      <div className={d.kind !== 'custom' ? 'mt-4' : ''}><Verdict v={d.verdict} headline={d.headline} /></div>
      {V && <div className="mt-8"><V v={d.visual} /></div>}
    </header>
  )
}

// a section: title, one-line takeaway, the visual, details 5 at a time with "Show all N"
export function Section({ data: s }) {
  const [all, setAll] = useState(false)
  const B = BLOCKS[s.block?.kind]
  const paged = (s.total ?? 0) > PAGE_SIZE
  const shown = all || !paged ? Infinity : PAGE_SIZE
  return (
    <section data-sec={s.id} className="scroll-mt-6">
      <h2 className="text-[17px] leading-6 font-semibold text-stone-900">{s.title}</h2>
      {s.takeaway && <p className={`mt-1 ${READ} text-[14px] leading-5 ${t2} [text-wrap:pretty]`}>{s.takeaway}</p>}
      <div className={`mt-5 ${s.wide ? '' : READ}`}>{B && <B v={s.block} shown={shown} />}</div>
      {paged && (
        <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all}
          className="-ml-1.5 mt-3 h-8 rounded-md px-1.5 text-[13px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
          {all ? 'Show fewer' : `Show all ${s.total}${s.unit ? ` ${s.unit}` : ''}`}
        </button>
      )}
    </section>
  )
}

// the contents rail (long reports): the sections, the one in view marked; sticky beside the reading column
export function ContentsRail({ articleRef, items }) {
  const [active, setActive] = useState(items[0]?.id)
  const key = items.map((i) => i.id).join('|')
  useEffect(() => {
    const root = articleRef.current
    if (!root) return undefined
    const els = [...root.querySelectorAll('[data-sec]')]
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (vis[0]) setActive(vis[0].target.dataset.sec)
    }, { root: root.closest('[data-scroll]'), rootMargin: '-8% 0px -72% 0px', threshold: 0 })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const go = (id) => (e) => { e.preventDefault(); articleRef.current?.querySelector(`[data-sec="${id}"]`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }) }
  return (
    <nav aria-label="Contents" className="sticky top-4 hidden self-start lg:block">
      <p className={META}>Contents</p>
      <ol className="mt-2 flex flex-col gap-0.5">
        {items.map((it) => (
          <li key={it.id}>
            <a href={`#${it.id}`} onClick={go(it.id)} aria-current={active === it.id ? 'true' : undefined}
              className={`block rounded-r-md border-l-2 py-1 pl-2.5 pr-2 text-[13px] leading-[18px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${active === it.id ? 'border-ink font-medium text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900'}`}>
              {it.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

// follow-up chips under a report: made from what its data can answer; clicking one sends it
export function FollowUps({ items, onPick }) {
  if (!items?.length) return null
  return (
    <div role="group" aria-label="Follow-ups" className="flex flex-wrap gap-2">
      {items.map((c) => (
        <button key={c.id} type="button" onClick={() => onPick(c)}
          className="inline-flex h-8 items-center rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:border-line-strong hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
          {c.text}
        </button>
      ))}
    </div>
  )
}

// "Explain this" for the v2 bands
export function explainV2(block) {
  const d = block.data
  if (block.type === 'v2read') return 'The question as it was read: the competitor, topic, pages or period it names set what the report counts. Nothing it names that isn’t in the data is estimated; it’s said in a “Not in your data” note.'
  if (block.type === 'v2hero') return { h2h: 'Every tracked prompt, once: only them (AI names them and not you), both (names you both; “first” is whoever the answer names first), only you, neither.' }[d.visual?.kind] ?? 'The verdict and the one-line answer, from the latest sync against the start of the period.'
  return {
    stats: 'Each number at the latest sync, with its change since the start of the period.',
    h2h: 'Every tracked prompt, once, by who AI names on it.',
    trend: 'The visibility score at each weekly sync in the period; the score is the average of the engines shown. The y axis is fitted to the data.',
    coverage: 'Per topic, the prompts that name you out of the prompts tracked for it.',
    promptGroups: 'The prompts, by topic, with the engine whose answer named them and who’s named on it. The page AI cites most for each of you on that topic is in the topic’s line.',
    pages: 'Distinct pages after URL normalisation, by how many answers cite each.',
    quotes: 'What an answer said about you, with the engine and the prompt it answered.',
    gainedLost: 'Prompts newly named (gained) and no longer named (lost) between the start of the period and the latest sync.',
    steps: 'One step per topic, by the prompts it could win; each opens the prompts behind it.',
    notInData: 'This part of your question isn’t in the report data, so it isn’t estimated; the link goes where it is.',
  }[d.block?.kind] ?? ''
}
