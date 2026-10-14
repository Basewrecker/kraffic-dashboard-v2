import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { curveMonotoneX, line as d3line } from 'd3-shape'
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import Segmented from '../../components/dashboard/Segmented'
import Select from '../../components/ui/Select'
import Insight, { hl, useExplain } from '../../components/ui/Insight'
import { openDrawer } from '../../components/audit/parts'
import { useIsMobile } from '../../hooks/useMedia'
import { CHANNELS, analyze, dayOf, displayText, enrich, fractionWord, leanWord, sourceName } from './analyze'
import MentionDrawer from './MentionDrawer'
import { ComparePanel, SourcesPanel } from './Panels'
import { SENTIMENT, STANCE, cardTitle, fmtDay, pct, subtitleCls, t2, t3, Logo } from './parts'

// The done-run body. Each card answers one question with its own kind of visual:
//   KPIs (each opens something) · Coverage (bars) · Talking points (numbered list) · Tone × stance (matrix)
//   · Who's talking (split bar + source tiles) · Mentions (filtered list).
const TONES = ['positive', 'neutral', 'negative']
const SIDES = ['for', 'neutral', 'against']
const NO_FILTERS = { q: '', channel: 'all', sentiment: 'all', stance: 'all', day: 'all', sort: 'newest', theme: 'all' }

export default function Results({ run, previous }) {
  const a = useMemo(() => { const base = analyze(run, previous); return enrich(run, base, previous) }, [run, previous])
  const [filters, setFilters] = useState(NO_FILTERS)
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }))
  const listRef = useRef(null)
  const toList = () => requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  const filterAndGo = (patch) => { set(patch); toList() }
  return (
    <>
      <Kpis a={a} onPeak={() => filterAndGo({ day: a.peak.day })} />
      {/* rows are paired by height: the chart stretches beside the matrix; the talking points match the accounts list */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2"><Coverage a={a} day={filters.day} onDay={(d) => set({ day: d })} /></div>
        <Matrix a={a} onPick={(tone, side) => filterAndGo({ sentiment: tone, stance: side })} />
      </div>
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <TalkingPoints a={a} active={filters.theme} onPick={(k) => filterAndGo({ theme: k })} />
        <div className="min-w-0 lg:col-span-2"><WhosTalking a={a} /></div>
      </div>
      <div ref={listRef} className="scroll-mt-6"><Mentions run={run} a={a} filters={filters} set={set} /></div>
      <MentionDrawer run={run} />
      <SourcesPanel a={a} />
      <ComparePanel a={a} />
    </>
  )
}

// ---- KPI strip: the Overview tile pattern; every tile opens something
function Tile({ label, value, meta, link, onOpen }) {
  const open = onOpen && ((e) => { if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } })
  return (
    <div {...(onOpen && { role: 'link', tabIndex: 0, onClick: open, onKeyDown: open, 'aria-label': `${label}: ${link}` })}
      className={`group flex min-w-0 flex-col rounded-xl p-4 ${onOpen ? 'cursor-pointer outline-none transition-colors duration-150 ease-out hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus' : ''}`}>
      <div className={`text-[13px] leading-[18px] ${t2}`}>{label}</div>
      <div className="mt-1 text-[32px] leading-10 font-semibold text-stone-900 tabular-nums">{value}</div>
      <div className={`mt-0.5 text-[13px] leading-[18px] ${t3} tabular-nums`}>{meta}</div>
      {onOpen && (
        <div className={`mt-auto inline-flex items-center gap-1 pt-3 text-[13px] leading-[18px] font-medium ${t2} transition-colors duration-150 group-hover:text-ink`}>
          {link}<ArrowRight size={14} className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
        </div>
      )}
    </div>
  )
}
function Kpis({ a, onPeak }) {
  const c = a.compare
  return (
    <Card className="p-1">
      <div className="grid grid-cols-1 sm:grid-cols-3 sm:divide-x sm:divide-[var(--div)]">
        <Tile label="Peak day" value={fmtDay(a.peak.day)} meta={`${a.peak.total} ${a.peak.total === 1 ? 'mention' : 'mentions'} · mostly on ${CHANNELS[a.peakDriver].label}`}
          link="See that day" onOpen={onPeak} />
        <Tile label="Sources" value={a.sources.length} meta={a.sources.length > 3 ? `3 account for ${fractionWord(a.top3Share)} of mentions` : 'Every site and account'}
          link="See all sources" onOpen={() => openDrawer('panel', 'sources')} />
        {c ? (
          <Tile label="Change vs last run" value={<span>{a.delta > 0 ? '+' : a.delta < 0 ? '−' : ''}{Math.abs(a.delta)}</span>}
            meta={`vs ${fmtDay(c.previous.createdAt)} · ${c.toneWord}`} link="Compare runs" onOpen={() => openDrawer('panel', 'compare')} />
        ) : (
          <Tile label="Change vs last run" value={<span className={`block text-[20px] leading-10 font-medium ${t3}`}>First run</span>} meta="Run it again to see changes" />
        )}
      </div>
    </Card>
  )
}

// ---- Coverage over time: Volume (ink bars, avg line, peak label) or Tone (net tone line over faint volume bars)
// Net tone per day = (positive − negative) ÷ mentions, −100%…+100%, centred on a zero line. Days with no mentions
// break the line; days with fewer than 3 mentions get a hollow point (one post can swing them to ±100%).
const MIN_SOLID = 3
const net = (d) => (d.total ? (d.positive - d.negative) / d.total : 0)
// the sentence for Tone mode, and the days it's about (Why? highlights them)
function toneStory(days) {
  const pts = days.filter((d) => d.total > 0)
  const all = (k) => pts.reduce((n, d) => n + d[k], 0)
  if (!all('positive') && !all('negative')) return { text: 'Every mention was neutral.', days: pts.map((d) => d.day) }
  const w = (list) => (list.reduce((n, d) => n + d.positive - d.negative, 0) / Math.max(1, list.reduce((n, d) => n + d.total, 0)))
  let best = null
  for (let k = 1; k < pts.length; k++) {
    const before = pts.slice(0, k), after = pts.slice(k)
    if (before.reduce((n, d) => n + d.total, 0) < MIN_SOLID || after.reduce((n, d) => n + d.total, 0) < MIN_SOLID) continue
    const diff = w(after) - w(before)
    if (!best || Math.abs(diff) > Math.abs(best.diff)) best = { k, diff, before: w(before), after: w(after) }
  }
  if (best && Math.abs(best.diff) >= 0.3 && Math.sign(best.after) !== Math.sign(best.before) && best.after !== 0) {
    return { text: `Tone turned ${best.after < 0 ? 'negative' : 'positive'} after ${fmtDay(pts[best.k - 1].day)}.`, days: pts.slice(best.k).map((d) => d.day) }
  }
  const overall = w(pts)
  return { text: Math.abs(overall) < 0.15 ? 'Tone stayed mostly even.' : `Tone stayed mostly ${overall > 0 ? 'positive' : 'negative'}.`, days: pts.map((d) => d.day) }
}

function Coverage({ a, day, onDay }) {
  const [mode, setMode] = useState('volume')
  const explain = useExplain(`${day}|${mode}`)
  const [tip, setTip] = useState(null) // { d, i }
  const box = useRef(null)
  const lineRef = useRef(null)
  const gid = `tone-${useId().replace(/:/g, '')}`
  const n = a.days.length
  const max = Math.max(...a.days.map((d) => d.total), 1)
  const [{ w, h: boxH }, setSize] = useState({ w: 600, h: 200 })
  const H = Math.max(160, boxH - 22) // plot height; 22px under it for dates
  useEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])
  const top = 22 // headroom for the peak label
  const y = (v) => H - (v / max) * (H - top)
  const slot = w / Math.max(n, 1)
  const bw = Math.max(4, Math.min(12, Math.floor(slot - 2)))
  const x = (i) => (n === 1 ? w / 2 : slot * i + slot / 2)
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 72))))
  const driver = CHANNELS[a.peakDriver].label
  const avg = Math.round(a.avg * 10) / 10
  const tone = mode === 'tone'

  // tone scale: zero in the middle, ±100% 20px from the top / bottom (room for the side labels)
  const y0 = H / 2
  const amp = H / 2 - 20
  const ty = (v) => y0 - v * amp
  const story = useMemo(() => toneStory(a.days), [a.days])
  const path = useMemo(() => d3line().defined((d) => d.total > 0).x((_, i) => x(i)).y((d) => ty(net(d))).curve(curveMonotoneX)(a.days), [a.days, w, H]) // eslint-disable-line react-hooks/exhaustive-deps
  const stretch = useMemo(() => d3line().defined((d) => d.total > 0 && story.days.includes(d.day)).x((_, i) => x(i)).y((d) => ty(net(d))).curve(curveMonotoneX)(a.days), [a.days, story, w, H]) // eslint-disable-line react-hooks/exhaustive-deps
  // the line draws in left → right when Tone is switched on
  useEffect(() => {
    if (!tone || !lineRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    lineRef.current.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 260, easing: 'ease-out' })
  }, [tone])

  const insight = tone
    ? { text: story.text, keys: story.days.map((d) => `tone:${d}`), calc: 'Net tone per day: (positive − negative) ÷ mentions. Highlighted: the days the sentence is about.' }
    : { text: `Coverage peaked on ${fmtDay(a.peak.day)}, driven by ${driver}.`, keys: ['peak'], calc: `Highlighted: the busiest day. ${driver} posted most of that day’s mentions.` }
  const hoverD = tip?.d

  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5 pb-3">
      <div className="flex items-start justify-between gap-3 max-sm:flex-wrap">
        <div className="min-w-0">
          <h2 className={cardTitle}>Coverage over time</h2>
          <p className={subtitleCls}>Mentions per day. Click a day to filter the list.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {day !== 'all' && (
            <button type="button" onClick={() => onDay('all')} className="inline-flex h-8 items-center gap-1 rounded-full bg-tint pl-2.5 pr-2 text-[13px] font-medium text-stone-900 outline-none hover:bg-[var(--color-line)] focus-visible:ring-2 focus-visible:ring-focus">
              {fmtDay(day)} · Clear<X size={13} aria-hidden />
            </button>
          )}
          <Segmented size="sm" label="Show" value={mode} onChange={setMode} options={[{ value: 'volume', label: 'Volume' }, { value: 'tone', label: 'Tone' }]} />
        </div>
      </div>

      <div ref={box} className="relative mt-4 flex-1" style={{ minHeight: 182 }} onMouseLeave={() => setTip(null)}>
        <div className="absolute inset-x-0 border-b border-line" style={{ top: H }} aria-hidden />
        {/* Volume: the average, dashed */}
        {!tone && (
          <div className="absolute inset-x-0 border-t border-dashed border-stone-500" style={{ top: y(a.avg) }} aria-hidden>
            <span className={`absolute -top-[18px] left-0 bg-surface pr-1 text-[12px] leading-4 ${t3} tabular-nums`}>Avg {avg}/day</span>
          </div>
        )}
        {/* Tone: the zero line */}
        {tone && <div className="absolute inset-x-0 border-t border-line" style={{ top: y0 }} aria-hidden />}
        {/* Tone: the hover guide */}
        {tone && hoverD && <div className="pointer-events-none absolute w-px bg-stone-500 transition-[left] duration-150 ease-out" style={{ left: x(tip.i), top: 0, height: H }} aria-hidden />}

        {/* the bars: same place in both modes; colour cross-fades */}
        {a.days.map((d, i) => {
          const on = day === 'all' || day === d.day
          const isPeak = d.day === a.peak.day
          const selected = day === d.day
          const fill = tone ? (selected ? 'var(--data-c2)' : 'var(--data-c3)') : 'var(--ink)'
          return (
            <button key={d.day} type="button" disabled={!d.total}
              onClick={() => onDay(day === d.day ? 'all' : d.day)}
              onMouseEnter={() => setTip({ d, i })} onFocus={() => setTip({ d, i })} onBlur={() => setTip(null)}
              aria-pressed={selected}
              aria-label={`${fmtDay(d.day)}: ${d.total} mentions — ${d.positive} positive, ${d.neutral} neutral, ${d.negative} negative`}
              {...hl(explain, tone ? `bar:${d.day}` : isPeak ? 'peak' : `day:${d.day}`)}
              className="absolute flex -translate-x-1/2 flex-col-reverse outline-none transition-opacity duration-150 focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none"
              style={{ left: x(i), top: 0, height: H, width: Math.max(bw, 12), paddingInline: (Math.max(bw, 12) - bw) / 2, opacity: explain.on ? undefined : tone || on ? 1 : 0.35 }}>
              {d.total > 0 && (
                <span className="rounded-t-[3px] transition-[background-color,opacity] duration-[260ms] ease-out"
                  style={{ height: H - y(d.total), background: fill, opacity: tone && !selected ? 0.6 : 1 }} />
              )}
              {isPeak && !tone && <span className="absolute left-1/2 -translate-x-1/2 text-[13px] leading-4 font-semibold text-stone-900 tabular-nums" style={{ top: y(d.total) - 18 }}>{d.total}</span>}
            </button>
          )
        })}

        {/* Tone: the net tone line + points (pointer events go to the bars underneath) */}
        {tone && (
          <svg className="pointer-events-none absolute inset-x-0 top-0 overflow-visible" width={w} height={H} aria-hidden>
            <defs>
              <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={H}>
                {/* split at zero; 1px under it so a day that's exactly even (on the line) stays ink */}
                <stop offset={(y0 + 1) / H} stopColor="var(--ink)" />
                <stop offset={(y0 + 1) / H} stopColor="var(--negative)" />
              </linearGradient>
            </defs>
            {path && a.days.filter((d) => d.total).length > 1 && <path ref={lineRef} d={path} fill="none" stroke={`url(#${gid})`} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1"
              style={{ opacity: explain.on ? 0.3 : 1, transition: 'opacity 150ms ease-out' }} />}
            {explain.on && stretch && <path d={stretch} fill="none" stroke={`url(#${gid})`} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
            {a.days.map((d, i) => {
              if (!d.total) return null
              const v = net(d)
              const c = v < 0 ? 'var(--negative)' : 'var(--ink)'
              const solid = d.total >= MIN_SOLID
              const big = hoverD?.day === d.day
              const r = big ? 4 : 3
              return (
                <g key={d.day} {...hl(explain, `tone:${d.day}`)}>
                  {day === d.day && <circle cx={x(i)} cy={ty(v)} r={r + 3} fill="none" stroke="var(--ink)" strokeWidth={2} />}
                  <circle cx={x(i)} cy={ty(v)} r={solid ? r : r - 1} fill={solid ? c : 'var(--color-surface)'} stroke={c} strokeWidth={solid ? 0 : 2}
                    style={{ transition: 'r 150ms ease-out' }} />
                </g>
              )
            })}
          </svg>
        )}
        {/* Tone: the side labels */}
        {tone && (
          <div className={`pointer-events-none absolute right-0 top-0 text-right text-[13px] leading-4 ${t3}`} style={{ height: H }} aria-hidden>
            {/* each label sits just above its line, with no backing, so it never hides a point */}
            <span className="absolute right-0 top-0 whitespace-nowrap">More positive</span>
            <span className="absolute right-0 whitespace-nowrap" style={{ top: y0 - 20 }}>Even</span>
            <span className="absolute right-0 whitespace-nowrap" style={{ top: H - 20 }}>More negative</span>
          </div>
        )}

        <div className="absolute inset-x-0 h-4" style={{ top: H + 6 }} aria-hidden>
          {a.days.map((d, i) => (i % labelEvery === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= labelEvery / 2 || i === 0) && (
            <span key={d.day} className={`absolute -translate-x-1/2 whitespace-nowrap text-[12px] leading-4 ${t3}`} style={{ left: x(i) }}>{fmtDay(d.day)}</span>
          ))}
        </div>

        {tip && (tone ? (
          <div role="tooltip" className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line bg-raised px-2.5 py-2 text-[12px] leading-4 shadow-md tabular-nums motion-safe:animate-[fade-in_150ms_ease-out]"
            style={{ left: Math.min(Math.max(x(tip.i), 100), w - 100), top: Math.min(ty(net(tip.d)), y0) - 12 }}>
            <div className="font-semibold text-stone-900">{fmtDay(tip.d.day)} · {tip.d.total} {tip.d.total === 1 ? 'mention' : 'mentions'}</div>
            <div className={`mt-0.5 ${t2}`}>{tip.d.positive} positive · {tip.d.neutral} neutral · <span className={tip.d.negative ? 'text-negative' : undefined}>{tip.d.negative} negative</span></div>
            {tip.d.total < MIN_SOLID && <div className={`mt-0.5 ${t3}`}>Only {tip.d.total} {tip.d.total === 1 ? 'mention' : 'mentions'}</div>}
          </div>
        ) : (
          <div role="tooltip" className="pointer-events-none absolute z-20 w-40 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-raised px-2.5 py-2 shadow-md" style={{ left: Math.min(Math.max(x(tip.i), 80), w - 80), top: y(tip.d.total) - 6 }}>
            <div className="text-[12px] leading-4 font-semibold text-stone-900">{fmtDay(tip.d.day)}</div>
            {TONES.map((k) => (
              <div key={k} className="mt-1 flex items-center justify-between text-[12px] leading-4 tabular-nums">
                <span className={`flex items-center gap-1.5 ${t2}`}><span className="h-2 w-2 rounded-sm" style={{ background: SENTIMENT[k].fill }} />{SENTIMENT[k].label}</span>
                <span className={k === 'negative' && tip.d[k] ? 'text-negative' : 'text-stone-900'}>{tip.d[k]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-3">
        <Insight explain={explain} text={insight.text} evidence={{ keys: insight.keys, calc: insight.calc }} />
      </div>
    </Card>
  )
}

// ---- What people are saying: the talking points, numbered, no bars
function TalkingPoints({ a, active, onPick }) {
  const explain = useExplain('themes')
  const list = a.themes
  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5 pb-3">
      <h2 className={cardTitle}>What people are saying</h2>
      <p className={subtitleCls}>Which points come up again and again?</p>
      {!list?.length ? (
        <p className={`my-auto py-8 text-center text-[14px] leading-5 ${t2}`}>Talking points aren’t available for this run.</p>
      ) : (
        <>
          <ol className="mt-3 flex flex-col">
            {list.map((t, i) => (
              <li key={t.themeKey}>
                <button type="button" onClick={() => onPick(active === t.themeKey ? 'all' : t.themeKey)} aria-pressed={active === t.themeKey}
                  {...hl(explain, i === 0 ? 'top' : t.themeKey, { row: true, flush: true })}
                  className={`group -mx-2 grid w-[calc(100%+16px)] grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus ${active === t.themeKey ? 'bg-tint' : ''}`}>
                  <span className={`self-start pt-px text-[13px] leading-5 ${t3} tabular-nums`}>{i + 1}</span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[14px] leading-5 font-medium text-stone-900">{t.theme}</span>
                    <span className={`block text-[13px] leading-[18px] ${t3} tabular-nums`}>{t.count} {t.count === 1 ? 'mention' : 'mentions'} · leans {leanWord(t.lean)}</span>
                  </span>
                  <span className="flex items-center" aria-hidden>
                    {t.logos.map((l, j) => <Logo key={l.name} domain={l.domain} name={l.name} className={`h-4 w-4 rounded-full ${j ? '-ml-1.5' : ''}`} imgPad="p-0" initialClass="text-[9px]" />)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-auto pt-3">
            <Insight explain={explain} text={`The most repeated point leans ${leanWord(list[0].lean)}.`} evidence={{
              keys: ['top'], calc: `Highlighted: “${list[0].theme}”, made in the most mentions.`,
            }} />
          </div>
        </>
      )}
    </Card>
  )
}

// ---- Tone vs stance: a 3×3 matrix of counts, shade = share (6% → 60%; the Negative row in the negative ramp).
// Hover / focus: an ink ring on the cell, its row label + column header go ink 600, and a fixed readout line under the
// grid says what the cell is. Nothing else changes.
const SIDE_PHRASE = { for: 'argue for it', neutral: 'take no side', against: 'argue against' }
function Matrix({ a, onPick }) {
  const explain = useExplain('matrix')
  const [hover, setHover] = useState(null) // [r, c]
  const total = a.total
  const maxCell = Math.max(...a.matrix.flat(), 1)
  const rowTot = a.matrix.map((r) => r.reduce((x, y) => x + y, 0))
  const colTot = SIDES.map((_, c) => a.matrix.reduce((x, r) => x + r[c], 0))
  const topTone = rowTot.indexOf(Math.max(...rowTot))
  const side = a.stance.against === a.stance.for ? null : a.stance.against > a.stance.for ? 2 : 0
  const text = `Mostly ${TONES[topTone]}; ${side == null ? 'sides are even.' : `sides lean ${side === 2 ? 'against' : 'for'}.`}`
  const keys = [...SIDES.map((_, c) => `cell:${topTone}:${c}`), ...(side == null ? [] : TONES.map((_, r) => `cell:${r}:${side}`))]
  const on = (cls) => `${cls} transition-colors duration-150 ease-out`
  const readout = hover && (() => { const [r, c] = hover; const n = a.matrix[r][c]; return `${n} ${TONES[r]} ${n === 1 ? 'post' : 'posts'} ${SIDE_PHRASE[SIDES[c]]} · ${pct(n, total)}%` })()
  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5 pb-3">
      <h2 className={cardTitle}>Tone vs stance</h2>
      <p className={subtitleCls}>Which tone, which side? Click a cell to filter.</p>
      <div className="mt-3 max-w-[420px]">
        <div className="grid grid-cols-[88px_repeat(3,minmax(0,1fr))_48px] items-center gap-1">
          <span />
          {SIDES.map((sd, c) => (
            <span key={sd} className={on(`truncate pb-0.5 text-center text-[13px] leading-[18px] ${hover?.[1] === c ? 'font-semibold text-ink' : t3}`)}>{STANCE[sd].label}</span>
          ))}
          <span />
          {TONES.map((tone, r) => (
            <MatrixRow key={tone} r={r} tone={tone} a={a} maxCell={maxCell} explain={explain} hover={hover} setHover={setHover} onPick={onPick} rowPct={pct(rowTot[r], total)} on={on} />
          ))}
          <span />
          {colTot.map((n, c) => <span key={c} className={`pt-0.5 text-center text-[13px] leading-[18px] ${t3} tabular-nums`}>{pct(n, total)}%</span>)}
          <span />
        </div>
        {/* the readout: always 20px tall so nothing moves when it fills */}
        <p className={`mt-2 h-5 text-[13px] leading-5 ${t2} tabular-nums transition-opacity duration-150 ease-out ${readout ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">{readout ?? ''}</p>
      </div>
      <div className="mt-auto pt-2">
        <Insight explain={explain} text={text} evidence={{ keys, calc: 'Highlighted: the most common tone (row) and the side that outnumbers the other (column), leaving out No side.' }} />
      </div>
    </Card>
  )
}
function MatrixRow({ r, tone, a, maxCell, explain, hover, setHover, onPick, rowPct, on }) {
  const rowOn = hover?.[0] === r
  return (
    <>
      <span className={on(`text-[13px] leading-[18px] ${rowOn ? 'font-semibold' : ''} ${r === 2 ? 'text-negative' : rowOn ? 'text-ink' : t3}`)}>{SENTIMENT[tone].label}</span>
      {SIDES.map((sd, c) => {
        const n = a.matrix[r][c]
        if (!n) return <span key={sd} className={`grid h-10 place-items-center text-[14px] ${t3}`} {...hl(explain, `cell:${r}:${c}`)} aria-label={`No ${tone} mentions ${SIDE_PHRASE[sd]}`}>—</span>
        const o = 6 + (n / maxCell) * 54 // 6% → 60%; text: ink up to 45%, the page colour above
        const active = hover?.[0] === r && hover?.[1] === c
        return (
          <button key={sd} type="button" onClick={() => onPick(tone, sd)}
            onMouseEnter={() => setHover([r, c])} onMouseLeave={() => setHover(null)} onFocus={() => setHover([r, c])} onBlur={() => setHover(null)}
            aria-label={`${n} ${tone} mentions ${SIDE_PHRASE[sd]}, ${pct(n, a.total)}%. Filter the list`}
            {...hl(explain, `cell:${r}:${c}`)}
            className={`h-10 rounded-md text-center text-[14px] leading-5 font-semibold tabular-nums outline-none ring-inset transition-[box-shadow] duration-150 ease-out ${active ? 'ring-[1.5px] ring-ink' : 'ring-0'} ${o > 45 ? 'text-[var(--color-page)]' : 'text-ink'}`}
            style={{ background: `color-mix(in srgb, ${r === 2 ? 'var(--negative)' : 'var(--ink)'} ${o}%, transparent)` }}>
            {n}
          </button>
        )
      })}
      <span className={`text-right text-[13px] leading-[18px] ${t3} tabular-nums`}>{rowPct}%</span>
    </>
  )
}

// ---- Who's talking: two panels — Channels (pick one) | Top accounts for it
function WhosTalking({ a }) {
  const [ch, setCh] = useState('all')
  const rows = a.sources.filter((s) => ch === 'all' || s.channel === ch).slice(0, 6)
  const channels = [{ id: 'all', label: 'All channels', count: a.total }, ...a.channels]
  const label = `text-[13px] leading-[18px] ${t3}`
  return (
    <Card className="flex h-full min-w-0 flex-col px-5 pt-5 pb-3">
      <h2 className={cardTitle}>Who’s talking</h2>
      <p className={subtitleCls}>Which channels and accounts carry the conversation?</p>
      <div className="mt-4 grid grid-cols-1 gap-y-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-x-8">
        <section aria-label="Channels" className="min-w-0">
          <h3 className={label}>Channels</h3>
          <div role="radiogroup" aria-label="Channel" className="mt-1">
            {channels.map((c) => {
              const sel = ch === c.id
              return (
                <button key={c.id} type="button" role="radio" aria-checked={sel} onClick={() => setCh(c.id)}
                  className={`-mx-2 grid h-10 w-[calc(100%+16px)] grid-cols-[16px_minmax(0,1fr)_48px] items-center gap-2.5 rounded-md px-2 text-left outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-focus ${sel ? 'bg-tint' : 'hover:bg-tint'}`}>
                  {c.id === 'all'
                    ? <span className="h-4 w-4" aria-hidden />
                    : <Logo domain={CHANNELS[c.id].domain} name={c.label} className="h-4 w-4 rounded-[3px]" imgPad="p-0" initialClass="text-[9px]" />}
                  <span className={`truncate text-[14px] leading-5 text-stone-900 ${sel ? 'font-medium' : ''}`}>{c.label}</span>
                  <span className={`text-right text-[13px] leading-[18px] ${t2} tabular-nums`}>{c.id === 'all' ? '100%' : `${pct(c.count, a.total)}%`}</span>
                </button>
              )
            })}
          </div>
        </section>
        <section aria-label="Top accounts" className="min-w-0 border-[var(--div)] max-md:border-t max-md:pt-4 md:border-l md:pl-8">
          <h3 className={label}>Top accounts</h3>
          <ul className="mt-1 divide-y divide-[var(--div)]">
            {rows.map((s) => (
              <li key={s.key}>
                <a href={s.url} target="_blank" rel="noreferrer" aria-label={`${s.name}, ${CHANNELS[s.channel].label}: ${s.count} mentions, ${STANCE_LOWER[s.lean]}. Opens in a new tab`}
                  className="group -mx-2 grid h-10 grid-cols-[20px_minmax(0,1fr)_88px_64px_16px] items-center gap-3 rounded-md px-2 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus max-sm:grid-cols-[20px_minmax(0,1fr)_76px_56px_14px] max-sm:gap-2">
                  <Logo domain={s.domain} name={s.name} className="h-5 w-5 rounded" imgPad="p-0" initialClass="text-[10px]" />
                  <span className="truncate text-[14px] leading-5 font-medium text-stone-900">{s.name}</span>
                  <span className={`text-right text-[13px] leading-[18px] ${t3} tabular-nums`}>{s.count} {s.count === 1 ? 'mention' : 'mentions'}</span>
                  <span className={`text-[13px] leading-[18px] ${t3}`}>{STANCE_LOWER[s.lean]}</span>
                  <ArrowUpRight size={14} className={`${t3} transition-colors group-hover:text-stone-900`} aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {/* same box as an Insight footer (31px, hairline on top) so it lines up with Tone vs stance */}
      <div className="mt-auto flex h-[39px] items-end pt-2">
        <div className="w-full border-t border-[var(--color-line)] pt-3 leading-[18px]">
          <button type="button" onClick={() => openDrawer('panel', 'sources')} className={`inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-medium ${t2} outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-focus`}>
            All {a.sources.length} sources <ArrowRight size={14} aria-hidden />
          </button>
        </div>
      </div>
    </Card>
  )
}
const STANCE_LOWER = { for: 'for', neutral: 'no side', against: 'against' }

// ---- Mentions: toolbar, active-filter chips, divided rows, pagination
function Mentions({ run, a, filters, set }) {
  const mobile = useIsMobile()
  const [size, setSize] = useState(10)
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [filters])
  const f = filters
  const list = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    return run.raw.mentions
      .filter((m) => (f.channel === 'all' || m.channel === f.channel) && (f.sentiment === 'all' || m.sentiment === f.sentiment)
        && (f.stance === 'all' || m.stance === f.stance) && (f.day === 'all' || dayOf(m.publishedAt) === f.day)
        && (f.theme === 'all' || m.themeKey === f.theme)
        && (!q || `${displayText(m)} ${m.text ?? ''} ${sourceName(m)}`.toLowerCase().includes(q)))
      .sort((x, y) => (f.sort === 'newest' ? y.publishedAt.localeCompare(x.publishedAt) : x.publishedAt.localeCompare(y.publishedAt)))
  }, [run, f])
  const pages = Math.max(1, Math.ceil(list.length / size))
  const cur = Math.min(page, pages)
  const shown = mobile ? list.slice(0, cur * size) : list.slice((cur - 1) * size, cur * size)
  const channelOpts = [{ value: 'all', label: 'All' }, ...Object.keys(CHANNELS).filter((id) => a.channels.some((c) => c.id === id)).map((id) => ({ value: id, label: CHANNELS[id].label }))]
  // chips: what the KPIs, chart, matrix and talking points set
  const chips = [
    f.day !== 'all' && { key: 'day', label: fmtDay(f.day), clear: { day: 'all' } },
    f.sentiment !== 'all' && f.stance !== 'all' && { key: 'cell', label: `${SENTIMENT[f.sentiment].label} · ${STANCE[f.stance].label}`, clear: { sentiment: 'all', stance: 'all' } },
    f.theme !== 'all' && { key: 'theme', label: a.themes?.find((t) => t.themeKey === f.theme)?.theme ?? 'Talking point', clear: { theme: 'all' } },
  ].filter(Boolean)
  const anyFilter = f.q || f.channel !== 'all' || f.sentiment !== 'all' || f.stance !== 'all' || f.day !== 'all' || f.theme !== 'all'

  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5 max-md:px-4">
        <h2 className={cardTitle}>Mentions</h2>
        <p className={subtitleCls}>Every post and article we found.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-5 pt-3 max-md:px-4">
        <label className="relative w-[280px] max-md:w-full">
          <span className="sr-only">Search mentions</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden />
          <input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search mentions"
            className="h-9 w-full rounded-lg border border-line bg-raised pl-9 pr-3 text-small text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-400 max-md:h-10" />
        </label>
        {channelOpts.length > 2 && <Segmented label="Channel" value={f.channel} onChange={(v) => set({ channel: v })} options={channelOpts} />}
        <div className="flex flex-wrap items-center gap-2">
          <Select label="Tone" size="md" className="w-[124px]" value={f.sentiment} onChange={(v) => set({ sentiment: v })} options={[['all', 'All tones'], ...TONES.map((k) => [k, SENTIMENT[k].label])]} />
          <Select label="Stance" size="md" className="w-[124px]" value={f.stance} onChange={(v) => set({ stance: v })} options={[['all', 'All stances'], ...SIDES.map((k) => [k, STANCE[k].label])]} />
          <Select label="Date" size="md" className="w-[112px]" value={f.day} onChange={(v) => set({ day: v })} options={[['all', 'All dates'], ...a.days.filter((d) => d.total).map((d) => [d.day, fmtDay(d.day)])]} />
          <Select label="Sort" size="md" className="w-[104px]" value={f.sort} onChange={(v) => set({ sort: v })} options={[['newest', 'Newest'], ['oldest', 'Oldest']]} />
        </div>
      </div>
      <div className="flex min-h-3 flex-wrap items-center gap-1.5 px-5 pb-3 pt-2 max-md:px-4">
        {chips.map((c) => (
          <button key={c.key} type="button" onClick={() => set(c.clear)} aria-label={`Remove filter: ${c.label}`}
            className="inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-tint pl-2.5 pr-2 text-[13px] font-medium text-stone-900 outline-none hover:bg-[var(--color-line)] focus-visible:ring-2 focus-visible:ring-focus">
            <span className="truncate">{c.label}</span><X size={13} className="shrink-0" aria-hidden />
          </button>
        ))}
        {chips.length > 1 && <button type="button" onClick={() => set({ day: 'all', sentiment: 'all', stance: 'all', theme: 'all' })} className={`ml-1 rounded text-[13px] font-medium ${t2} outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus`}>Clear all</button>}
      </div>

      {list.length === 0 ? (
        <div className="border-t border-[var(--div)] px-5 py-10 text-center">
          <p className={`text-[14px] leading-5 ${t2}`}>No mentions match these filters.</p>
          {anyFilter && <button type="button" onClick={() => set({ q: '', channel: 'all', sentiment: 'all', stance: 'all', day: 'all', theme: 'all' })} className="mt-2 inline-flex h-8 items-center rounded-md px-2.5 text-small font-medium text-stone-700 hover:bg-tint">Clear filters</button>}
        </div>
      ) : (
        <ul className="divide-y divide-[var(--div)] border-t border-[var(--div)]">
          {shown.map((m) => <MentionRow key={m.id} m={m} />)}
        </ul>
      )}

      {list.length > 0 && (mobile ? (
        cur * size < list.length && (
          <div className="border-t border-[var(--div)] p-3">
            <button type="button" onClick={() => setPage(cur + 1)} className="flex h-11 w-full items-center justify-center rounded-lg border border-line text-small font-medium text-stone-700 outline-none active:bg-tint focus-visible:ring-2 focus-visible:ring-focus">
              Load {Math.min(size, list.length - cur * size)} more <span className="ml-1.5 font-normal text-stone-500 tabular-nums">· {shown.length} of {list.length}</span>
            </button>
          </div>
        )
      ) : (
        <div className="flex h-12 items-center justify-between border-t border-[var(--div)] px-5 text-[13px] text-stone-500 tabular-nums">
          <span>Showing {(cur - 1) * size + 1}–{(cur - 1) * size + shown.length} of {list.length}</span>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">Rows per page
              <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(1) }} className="h-8 rounded-md border border-line bg-raised px-2 text-[13px] font-medium text-stone-900 outline-none">
                {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <span>Page {cur} of {pages}</span>
            <div className="flex items-center gap-1.5">
              <PageBtn label="Previous page" disabled={cur === 1} onClick={() => setPage(cur - 1)}><ChevronLeft size={16} /></PageBtn>
              <PageBtn label="Next page" disabled={cur === pages} onClick={() => setPage(cur + 1)}><ChevronRight size={16} /></PageBtn>
            </div>
          </div>
        </div>
      ))}
    </Card>
  )
}
function PageBtn({ label, disabled, onClick, children }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-md border border-line text-stone-600 transition-colors duration-150 hover:bg-tint hover:text-stone-900 disabled:pointer-events-none disabled:text-stone-300">
      {children}
    </button>
  )
}
function MentionRow({ m }) {
  return (
    <li>
      <button type="button" onClick={() => openDrawer('mention', m.id)}
        className="block w-full px-5 py-3 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus max-md:px-4">
        <span className={`flex items-center gap-2 text-[13px] leading-[18px] ${t3}`}>
          <Logo domain={m.domain} name={sourceName(m)} className="h-4 w-4 rounded-[4px]" imgPad="p-0" initialClass="text-[10px]" />
          <span className="min-w-0 truncate">{sourceName(m)}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0 tabular-nums">{fmtDay(m.publishedAt)}</span>
          <span className="ml-auto shrink-0 pl-3"><span className={m.sentiment === 'negative' ? 'text-negative' : t2}>{SENTIMENT[m.sentiment].label} tone</span><span className={t2}> · {STANCE[m.stance].label}</span></span>
        </span>
        <span className="mt-1 line-clamp-2 text-[14px] leading-5 text-stone-900">{displayText(m)}</span>
      </button>
    </li>
  )
}
