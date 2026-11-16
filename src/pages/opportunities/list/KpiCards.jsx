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
import { ENGINES, ENGINE_SHORT as SHORT, engineIcon } from '@/lib/mock-adapter-content'
import { competitorName } from '@/lib/mock-adapter-content' // app (owner, 2026-11-10): the Drafts card's sites, by name
import { scaled } from '@/lib/ui-scale' // app (owner, 2026-11-10): the opportunities ring follows the UI scale
import { FLAGS } from '@/lib/mock-adapter-content'
import { EdgeTip } from '@/components/mock-overview/content-tip'
import { CONTENT_HIDDEN } from '@/lib/mock-adapter-content' // app: the Drafts card's flag count hidden for now (owner, 2026-11-05)
import { LogoPlate, Ring } from '../parts'
import { useCountUp } from '../../../hooks/useBrandView'
import Card from '../../../components/dashboard/Card'
import { NEXT_CHECK, trackingFor } from '@/lib/mock-adapter-content'
import { trackedPrompts } from '@/lib/mock-adapter'

const TRACKED_TOTAL = trackedPrompts.length
// app (owner, 2026-11-10: "less washed out"): the sublines in the secondary colour (was muted stone-500)
const context = 'whitespace-nowrap text-[14px] leading-[18px] text-stone-600 tabular-nums'
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

// a small tooltip on hover / focus (no browser title tooltip). app (owner, 2026-11-05): the Content pages' one tooltip,
// drawn outside the card and kept on screen (components/mock-overview/content-tip.jsx)
function Tip({ text, children }) {
  return <EdgeTip tip={text} label={text} className="inline-flex items-center">{children}</EdgeTip>
}

// Published & monitoring: the tracked engines' icons, all in full colour (app, owner 2026-11-10: the ones that didn't
// name you this week were greyed out, 35% and greyscale). Tooltip per icon says which named you. Five engines (Google is two): 14px with 4px gaps (86px), the width four
// 16px icons took, so the row still fits the card at 1280 (Slot hides a visual that doesn't fit whole).
function EnginesThisWeek({ rows }) {
  const named = new Set(rows.flatMap((r) => { const w = trackingFor(r.draft)[r.draft.week - 1]; return w?.engines ? Object.keys(w.engines).filter((e) => w.engines[e]) : [] }))
  return (
    <span className="flex items-center gap-1">
      {ENGINES.map((e) => (
        <Tip key={e} text={named.has(e) ? `Named on ${SHORT[e]} this week` : `Not named on ${SHORT[e]} this week`}>
          <span className="flex"><PlatformIcon id={engineIcon(e)} size={14} /></span>
        </Tip>
      ))}
    </span>
  )
}

// app (owner, 2026-11-10): the engines that miss the listed prompts most (row.platforms: the engines a prompt is
// missed on), most first, ties in the engines' order, at most 3; engines that miss none are left out
export function missedMost(rows, engines = ENGINES, max = 3) {
  const list = engines.length ? engines : [...new Set(rows.flatMap((r) => r.platforms ?? []))]
  const n = new Map(list.map((e) => [e, 0]))
  for (const r of rows) for (const e of new Set(r.platforms ?? [])) if (n.has(e)) n.set(e, n.get(e) + 1)
  return list.filter((e) => n.get(e) > 0).sort((a, b) => n.get(b) - n.get(a)).slice(0, max)
}
const and = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0] ?? '')
function MissedMost({ rows }) {
  const most = missedMost(rows)
  if (!most.length) return null
  const text = `Missed most on ${and(most.map((e) => SHORT[e] ?? e))}`
  return (
    <span className="ml-2 flex self-center" data-missed-most={most.join(' ')}>
      <Tip text={text}><span className="flex items-center gap-1">{most.map((e) => <PlatformIcon key={e} id={engineIcon(e)} size={16} />)}</span></Tip>
    </span>
  )
}

// app (owner, 2026-11-10): the share of the tracked prompts that are opportunities, as a full ring (the Insights
// panel's: the track in the stronger border colour, the fill in ink, square ends), 32px, the card's visual slot height;
// it replaces the round-capped arc on the faint track that read as a spinner
function ShareRing({ value, total, size = 32, stroke = 4 }) {
  const r = (size - stroke) / 2
  const f = total ? Math.min(1, value / total) : 0
  return (
    <span role="img" aria-label={`${value} of ${total} tracked prompts`} data-share-ring={`${value}/${total}`} className="relative grid shrink-0" style={{ width: scaled(size), height: scaled(size) }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" aria-hidden className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: 'var(--color-line-strong)' }} />
        {f > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} pathLength="100" strokeDasharray="100"
          style={{ stroke: 'var(--ink)', strokeDashoffset: 100 - f * 100 }} />}
      </svg>
    </span>
  )
}

// app (owner, 2026-11-10): the sites the drafts are written to beat (each draft row's competitors: what the draft step's
// "Written to beat" lists), the most-named first, ties in the order met, at most 3
export function draftRivals(rows, max = 3) {
  const n = new Map()
  for (const r of rows) if (r.stage === 'draft') for (const d of new Set(r.competitors ?? [])) if (d) n.set(d, (n.get(d) ?? 0) + 1)
  return [...n.keys()].sort((a, b) => n.get(b) - n.get(a)).slice(0, max)
}
function BeatLogos({ rows }) {
  const sites = draftRivals(rows)
  if (!sites.length) return null
  return (
    <Tip text={`Written to beat ${and(sites.map(competitorName))}`}>
      <span className="flex -space-x-1.5" data-beat={sites.join(' ')}>
        {sites.map((d) => <span key={d} className="rounded-full ring-2 ring-surface"><LogoPlate domain={d} name={competitorName(d)} size={24} logoClass="h-4 w-4" initialClass="text-[10px]" /></span>)}
      </span>
    </Tip>
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

function FilterCard({ label, icon: Icon, selected, onClick, number, children, aside, badge = null }) {
  const shown = useCountUp(number)
  return (
    <Card role="button" tabIndex={0} aria-pressed={selected} aria-label={`${label}: show these prompts`}
      onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className={`@container group flex cursor-pointer flex-col px-5 py-[18px] outline-none transition-[border-color,transform] duration-[160ms] ease-out hover:-translate-y-px active:translate-y-0 focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transform-none motion-reduce:transition-none ${
        selected ? '!border-ink' : 'hover:border-[var(--color-line-strong)]'}`}>
      <div className="flex h-5 items-center justify-between gap-3">
        {/* the label keeps its full width: the hover arrow overlays after it (no space of its own), and the icon tile
            steps aside in a narrow card (1280 with four cards), so "Published & monitoring" is never cut */}
        {/* app (owner, 2026-11-10): the label in the primary colour, weight 500 (was muted) */}
        <span className="relative flex min-w-0 items-center text-[14px] leading-5 font-medium text-stone-900">
          <span className="truncate">{label}</span>
          <ArrowRight size={14} aria-hidden className="pointer-events-none absolute left-full ml-1 shrink-0 -translate-x-1 opacity-0 transition-[opacity,transform] duration-[160ms] ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none" />
        </span>
        {/* app (owner, 2026-11-10): a badge (the opportunities ring) takes the icon tile's 32px slot, so the card keeps its size */}
        {badge ? <span className="-my-1.5 grid h-8 w-8 shrink-0 place-items-center @max-[224px]:hidden">{badge}</span>
          : <span className="-my-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-tint text-stone-600 @max-[224px]:hidden" aria-hidden><Icon size={16} /></span>}
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

// → n, or null when there's no previous sync to compare with
export function newSinceLastSync(rows) {
  const prev = (r) => (r.history?.length > 1 ? r.history[r.history.length - 2] : null)
  if (!rows.some((r) => prev(r) != null)) return null
  return rows.filter((r) => prev(r) === 'visible').length
}

export default function KpiCards({ rows, value, onChange }) {
  const count = (stage) => rows.filter((r) => r.stage === stage).length
  const improved = rows.filter((r) => r.stage === 'improved')
  // app (owner, 2026-11-05): "+n since last sync" counts only prompts the previous sync has an answer for and that were
  // visible then (history: the loaded syncs, oldest first). A sync with no data for a prompt is no comparison (it read as
  // "new" before, so +31 matched the whole count); no previous sync at all → no change line, just "of 113"
  const newThisSync = newSinceLastSync(rows)
  const gained = [...new Set(improved.flatMap((r) => r.draft.gained))]
  const resolved = FLAGS.filter((f) => f.resolved).length
  const pick = (id) => () => onChange(id)
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <FilterCard label="Content opportunities" icon={EyeOff} number={rows.length} selected={value === 'all'} onClick={pick('all')} badge={<ShareRing value={rows.length} total={TRACKED_TOTAL} />}>
        <span className={context}>of {TRACKED_TOTAL}{newThisSync > 0 && <> · <span className="font-semibold text-negative">+{newThisSync}</span> since last sync</>}</span>
        <MissedMost rows={rows} />
      </FilterCard>
      <FilterCard label="Drafts" icon={FileText} number={count('draft')} selected={value === 'draft'} onClick={pick('draft')}
        aside={CONTENT_HIDDEN.draftChecks ? <BeatLogos rows={rows} /> : <span className="flex items-center gap-2"><Ring value={resolved} total={FLAGS.length} size={24} stroke={3} /><span className="text-[13px] leading-4 tabular-nums"><span className="text-stone-900">{resolved}/{FLAGS.length}</span> <span className="text-stone-500">flags</span></span></span>}>
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
