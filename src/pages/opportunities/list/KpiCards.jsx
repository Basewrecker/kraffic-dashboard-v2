// The Content list's top row (owner, 2026-11-04, round 7): four filter cards, about 116px tall. The whole card is the
// filter (no link row): hover = --line-strong border and a small → beside the label; selected = a 1px ink border.
// Header: label (14 muted) + a 32px icon square; 10px; the number (36/600); 4px; one 14px muted context line.
// Round 8: every card has a right-aligned visual slot (about 120×32), vertically centred: missed per engine, the
// drafts' flags ring, the engines named this week, the improved prompt's sparkline. Hover (160ms): --line-strong
// border, lifted 1px, → beside the label; pressed: back down. Ink and grey; red only for "+n" more missed, green only
// for ▲ and ✓.
import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, EyeOff, FileText, LineChart, TrendingUp } from 'lucide-react'
import { PlatformIcon } from '../../../components/dashboard/icons'
import { ENGINES, engineIcon } from '../../../data/contentOpportunities'
import { FLAGS } from '../../../data/contentOpportunities-proposed'
import { Ring } from '../parts'
import { useCountUp } from '../../../hooks/useBrandView'
import Card from '../../../components/dashboard/Card'
import { NEXT_CHECK, trackingFor } from '../../../data/contentOpportunities-proposed'
import { trackedPrompts } from '../../../data/mock'

const TRACKED_TOTAL = trackedPrompts.length
const context = 'whitespace-nowrap text-[14px] leading-[18px] text-stone-500 tabular-nums'
const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

// 64×20: the improved prompt's real visibility, the publish point then its 4 syncs, a dot on each sync, the publish
// date as a dashed mark. Ink only.
function Sparkline({ draft }) {
  const syncs = trackingFor(draft)
  const values = [syncs.find((s) => s.visibility)?.visibility.before ?? 0, ...syncs.map((s) => s.visibility?.after ?? null)]
  const W = 64, H = 20, pad = 3
  const max = Math.max(...values.filter((v) => v != null), 1)
  const pts = values.map((v, i) => (v == null ? null : [pad + (i * (W - 2 * pad)) / (values.length - 1), H - pad - (v / max) * (H - 2 * pad)]))
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0" role="img"
      aria-label={`Visibility since publishing on ${fmtDay(draft.published_at)}: ${values.map((v) => (v == null ? 'no data' : `${v}%`)).join(', ')}`}>
      <title>{`Published ${fmtDay(draft.published_at)}`}</title>
      <line x1={pts[0][0]} x2={pts[0][0]} y1={1} y2={H - 1} stroke="var(--color-stone-400)" strokeWidth={1} strokeDasharray="2 2" />
      <polyline points={pts.filter(Boolean).map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--ink)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={2} fill={i === 0 ? 'var(--color-surface)' : 'var(--ink)'} stroke="var(--ink)" strokeWidth={i === 0 ? 1.25 : 0} />)}
    </svg>
  )
}

const SHORT = { google: 'Google', chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude' }

// a small tooltip on hover / focus (no browser title tooltip)
function Tip({ text, children, align = 'center' }) {
  return (
    <span tabIndex={0} aria-label={text} className="group/tip relative inline-flex items-center rounded outline-none focus-visible:ring-2 focus-visible:ring-focus">
      {children}
      <span role="tooltip" className={`pointer-events-none absolute bottom-full z-20 mb-1.5 ${align === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2'} whitespace-nowrap rounded-md border border-line bg-raised px-2 py-1 text-[12px] leading-4 text-stone-700 opacity-0 shadow-sm transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-visible/tip:opacity-100`}>{text}</span>
    </span>
  )
}

// Published & monitoring: the tracked engines' icons; the ones that named you this week in full colour, the others
// greyed out (35%, greyscale). Tooltip per icon.
function EnginesThisWeek({ rows }) {
  const named = new Set(rows.flatMap((r) => { const w = trackingFor(r.draft)[r.draft.week - 1]; return w?.engines ? Object.keys(w.engines).filter((e) => w.engines[e]) : [] }))
  return (
    <span className="flex items-center gap-2">
      {ENGINES.map((e) => (
        <Tip key={e} text={named.has(e) ? `Named on ${SHORT[e]} this week` : `Not named on ${SHORT[e]} this week`}>
          <span className={`flex transition-[opacity,filter] duration-150 ${named.has(e) ? '' : 'opacity-35 grayscale'}`}><PlatformIcon id={engineIcon(e)} size={16} /></span>
        </Tip>
      ))}
    </span>
  )
}

// the visual's slot: the space left beside number + context, right-aligned; the visual hides when it doesn't fit whole
function Slot({ children }) {
  const box = useRef(null)
  const [fits, setFits] = useState(true)
  useLayoutEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const check = () => { const c = el.firstElementChild; setFits(!c || c.offsetWidth <= el.clientWidth) } // offsetWidth: tooltips inside are absolute and don't count
    const ro = new ResizeObserver(check)
    ro.observe(el); check()
    return () => ro.disconnect()
  }, [])
  if (!children) return null
  return (
    <div ref={box} className="flex h-8 min-w-0 flex-1 items-center justify-end overflow-hidden" aria-hidden={!fits || undefined}>
      <span className={`inline-flex shrink-0 items-center transition-opacity duration-150 ${fits ? 'opacity-100' : 'invisible opacity-0'}`}>{children}</span>
    </div>
  )
}

function FilterCard({ label, icon: Icon, selected, onClick, number, children, aside }) {
  const shown = useCountUp(number)
  return (
    <Card role="button" tabIndex={0} aria-pressed={selected} aria-label={`${label}: show these prompts`}
      onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className={`group flex cursor-pointer flex-col px-5 py-[18px] outline-none transition-[border-color,transform] duration-[160ms] ease-out hover:-translate-y-px active:translate-y-0 focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transform-none motion-reduce:transition-none ${
        selected ? '!border-ink' : 'hover:border-[var(--color-line-strong)]'}`}>
      <div className="flex h-5 items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1 text-[14px] leading-5 text-stone-500">
          <span className="truncate">{label}</span>
          <ArrowRight size={14} aria-hidden className="shrink-0 -translate-x-1 opacity-0 transition-[opacity,transform] duration-[160ms] ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none" />
        </span>
        <span className="-my-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-tint text-stone-600" aria-hidden><Icon size={16} /></span>
      </div>
      {/* number + context take the width they need (never cut off); the visual gets what's left, right-aligned, and
          hides when it can't fit whole (round 9) */}
      <div className="mt-2.5 flex items-center gap-3">
        <div className="flex-none">
          <div className="text-[36px] leading-7 font-semibold tracking-[-0.03em] text-stone-900 proportional-nums">{shown}</div>
          <div className="mt-1 flex whitespace-nowrap">{children}</div>
        </div>
        <Slot>{aside}</Slot>
      </div>
    </Card>
  )
}

export default function KpiCards({ rows, value, onChange }) {
  const count = (stage) => rows.filter((r) => r.stage === stage).length
  const improved = rows.filter((r) => r.stage === 'improved')
  const newThisSync = rows.filter((r) => r.streak === 1).length
  const gained = [...new Set(improved.flatMap((r) => r.draft.gained))]
  const resolved = FLAGS.filter((f) => f.resolved).length
  const pick = (id) => () => onChange(id)
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <FilterCard label="Missed prompts" icon={EyeOff} number={rows.length} selected={value === 'all'} onClick={pick('all')} aside={<Ring value={rows.length} total={TRACKED_TOTAL} size={28} stroke={4} />}>
        <span className={context}>of {TRACKED_TOTAL}{newThisSync > 0 && <> · <span className="font-semibold text-negative">+{newThisSync}</span> since last sync</>}</span>
      </FilterCard>
      <FilterCard label="Drafts" icon={FileText} number={count('draft')} selected={value === 'draft'} onClick={pick('draft')}
        aside={<span className="flex items-center gap-2"><Ring value={resolved} total={FLAGS.length} size={24} stroke={3} /><span className="text-[13px] leading-4 tabular-nums"><span className="text-stone-900">{resolved}/{FLAGS.length}</span> <span className="text-stone-500">flags</span></span></span>}>
        <span className={context}>Ready to review</span>
      </FilterCard>
      <FilterCard label="Published & monitoring" icon={LineChart} number={count('monitoring')} selected={value === 'monitoring'} onClick={pick('monitoring')}
        aside={<EnginesThisWeek rows={rows.filter((r) => r.stage === 'monitoring')} />}>
        <span className={context}>Next check {NEXT_CHECK}</span>
      </FilterCard>
      <FilterCard label="Improved" icon={TrendingUp} number={improved.length} selected={value === 'improved'} onClick={pick('improved')}
        aside={improved[0] && <Sparkline draft={improved[0].draft} />}>
        {gained.length > 0 && (
          <Tip text={`Now named on ${gained.map((e) => SHORT[e]).join(' and ')}`} align="left">
            <span className={`${context} font-semibold !text-[var(--co-improved)]`}>▲ +{gained.length} {gained.length === 1 ? 'engine' : 'engines'}</span>
          </Tip>
        )}
      </FilterCard>
    </div>
  )
}
