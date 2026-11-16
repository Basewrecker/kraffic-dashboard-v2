// Opportunities → Content workspace: the right column of the step band, "Search Console · <path>" for the target page
// (or the page hovered in Your pages, as a preview). Built on Sentiment's Over time chart, in its own Mix tokens
// (owner, round 6: no other colours, no red anywhere in this chart):
//   Mix | Position (Sentiment's Mix | Score toggle). Mix: one stacked column per week, 8 weeks, Sentiment's Mix bars
//     (utils/mixBars.js: the 2px gap, the 3px rounded top): ink (Sentiment's Positive) = impressions from the
//     prompt's queries, grey (its Neutral, --sent-track) = the page's other queries; the picked week in full, the others
//     at 85%. Position: the weekly average position as an ink line with ink dots, inverted (higher is better).
//   The latest week is picked (Sentiment's picked date: ink 600 with a 2px underline); click a week to pick it; hover
//   shows a card beside the column (never over it): the week, the split with its swatches, clicks, ▲▼ vs the week
//   before. Under it Clicks · CTR · Avg position for the last 4 weeks, with their change vs the 4 before.
// A new page: no data yet. Not connected: the same layout in grey. (The "Top queries" list under the band was
// removed by the owner, 2026-11-04.)
// Data: contentOpportunities-proposed.js candidatesFor (weeks: proposed).
import { useState } from 'react'
import { CrossFade, Seg, useWidth } from '../../../components/ui/motion'
import { stackSegments } from '../../../utils/mixBars'
import { tipLeft } from '../../../utils/sentimentSections'
import { MidText, pathOf } from '../parts'
import { niceStep } from './flow'
import { COL_HEAD, COL_TITLE, ChangeLine, SECOND, changeParts, TONE_CLASS } from './ui'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const nf = new Intl.NumberFormat('en-US')
const num = (n) => nf.format(n)
const week = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const PLOT_H = 220 // fixed: the frame never resizes; changing the page only animates the bars (300ms)
const SINCE = 'vs prior 4 weeks'
const VIEWS = [{ value: 'mix', label: 'Mix' }, { value: 'position', label: 'Position' }]
export const ROW_H = 56 // Your pages' row height, fixed
const FILL = { matched: 'var(--ink)', other: 'var(--sent-track)' } // Sentiment's MIX_FILL positive / neutral

// mode: 'page' (a candidate) · 'new' (a new page) · 'off' (Search Console not connected); preview: a hovered page that
// isn't the selected one. scale: { impressions, posMin, posMax } over ALL the prompt's pages, so the axes stay put
// while previewing and switching pages is a real comparison. statsGap: px above the stats, so they sit level with the
// last row of the list beside the column.
export default function SearchConsolePanel({ mode, page, slug, preview = false, scale = null, statsGap = 8 }) {
  const title = mode === 'page' ? pathOf(page.url) : mode === 'new' ? slug : null
  return (
    <div className="min-w-0">
      <div className={COL_HEAD}>
        <h3 className={`${COL_TITLE} flex-1`}>
          <span className="shrink-0">Search Console</span>
          {title && (
            // the path, middle-truncated ("/learn/what-…hyperpigmentation"); the full path in a tooltip
            <span className="group/t relative flex min-w-0 flex-1 items-baseline gap-2 font-normal text-stone-500">
              <span aria-hidden>·</span>
              <MidText text={title} className="flex-1" tip={false} />
              <span role="tooltip" className="pointer-events-none absolute left-3 top-full z-30 mt-1 w-max max-w-[360px] rounded-md border border-line bg-raised px-3 py-2 text-[12px] leading-4 font-normal text-stone-700 opacity-0 shadow-md transition-opacity duration-150 group-hover/t:opacity-100">{title}</span>
            </span>
          )}
          {mode === 'off' && <span className="font-normal text-stone-500">· Not connected</span>}
        </h3>
        <span className={`shrink-0 pb-0.5 text-[12px] leading-4 text-stone-500 transition-opacity duration-150 ${preview ? 'opacity-100' : 'opacity-0'}`} aria-hidden={!preview}>Preview</span>
      </div>
      {/* the page's data stays mounted while the page changes: its bars animate to the new values */}
      <CrossFade k={mode} ms={180}>
        {mode === 'page' ? <PageData page={page} scale={scale} statsGap={statsGap} /> : mode === 'new' ? <NewPage /> : <Ghost />}
      </CrossFade>
    </div>
  )
}

function PageData({ page, scale, statsGap }) {
  const [view, setView] = useState('mix')
  const [picked, setPicked] = useState(page.weeks.length - 1) // the latest week, as Sentiment's latest sync
  const ctr = page.impressions ? (page.clicks / page.impressions) * 100 : null
  const prevCtr = page.prev.impressions ? (page.prev.clicks / page.prev.impressions) * 100 : null
  return (
    <div>
      <div className="flex h-14 items-center justify-between gap-3">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <span className="text-[15px] leading-[22px] font-semibold tabular-nums text-stone-900">{num(page.impressions)} impressions</span>
          <ChangeLine delta={page.impressions - page.prev.impressions} text={SINCE} className="text-[13px] leading-[18px]" />
        </span>
        <Seg label="Chart" value={view} onChange={setView} options={VIEWS} className="gap-1 [&>button]:px-3.5" />
      </div>
      <div className="-mt-1 mb-2 flex h-4 items-center gap-4 text-[12px] leading-4 text-stone-500" aria-hidden>
        {view === 'mix'
          ? <><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ink" />This prompt’s queries</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--sent-track)]" />Other queries</span></>
          : <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink" />Average position, higher is better</span>}
      </div>
      <WeekChart weeks={page.weeks} view={view} picked={picked} onPick={setPicked} scale={scale} />
      <dl className="grid grid-cols-3 gap-4 border-t border-[var(--div)] pt-3" style={{ marginTop: statsGap }}>
        <Stat label="Clicks" value={num(page.clicks)} change={<ChangeLine delta={page.clicks - page.prev.clicks} className="text-[12px] leading-4" />} />
        <Stat label="CTR" value={ctr == null ? '—' : `${ctr.toFixed(1)}%`} change={ctr != null && prevCtr != null && <ChangeLine delta={ctr - prevCtr} digits={1} unit=" pts" className="text-[12px] leading-4" />} />
        <Stat label="Avg position" value={page.position.toFixed(1)} change={<ChangeLine delta={page.position - page.prev.position} digits={1} good="down" className="text-[12px] leading-4" />} />
      </dl>
    </div>
  )
}

function Stat({ label, value, change }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-[13px] leading-[18px] text-stone-500">{label}</dt>
      <dd className="mt-0.5 text-[20px] leading-7 font-semibold tabular-nums text-stone-900">{value}</dd>
      <dd className="min-h-4">{change}</dd>
    </div>
  )
}

function NewPage() {
  return <p className={`pt-4 ${SECOND}`}>A new page has no Search Console data yet.</p>
}

// ---- the weekly chart, on Sentiment's SyncChart layout (left axis, dates under the plot, the picked one underlined) --
function WeekChart({ weeks, view, picked, onPick, scale = null }) {
  const PLOT = PLOT_H
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const still = reduced()
  const n = weeks.length
  const left = 40
  const right = 8
  const top = 1
  const bottom = 30
  const plotW = Math.max(0, width - left - right)
  const slot = n ? plotW / n : 0
  const colW = Math.max(6, Math.min(32, slot * 0.56))
  const bandW = Math.min(slot - 4, colW + 20)
  const x = (i) => left + slot * i + slot / 2
  // Mix: impressions on round ticks
  const peak = scale?.impressions ?? Math.max(...weeks.map((w) => w.impressions))
  const step = niceStep(peak)
  const yMax = step * Math.ceil(peak / step)
  const y = (v) => top + PLOT - (v / yMax) * PLOT
  // Position: inverted (1 at the top), a whole-number range around the weeks
  const ps = weeks.map((w) => w.position)
  const pMin = Math.max(1, Math.floor(scale?.posMin ?? Math.min(...ps)) - 1)
  const pMax = Math.ceil(scale?.posMax ?? Math.max(...ps)) + 1
  const yp = (v) => top + ((v - pMin) / (pMax - pMin)) * PLOT
  const pTicks = [pMin, Math.round((pMin + pMax) / 2), pMax]
  const fade = (on) => ({ opacity: on ? 1 : 0, transition: still ? 'none' : 'opacity 200ms ease-out', pointerEvents: 'none' })
  const move = still ? 'none' : 'y 300ms ease-out, height 300ms ease-out' // a new page's values: the bars move, the frame doesn't
  return (
    <div ref={ref} className="relative w-full" style={{ height: top + PLOT + bottom }} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={top + PLOT + bottom} role="img" className="block overflow-visible"
          aria-label={view === 'mix'
            ? `Impressions by week: ${weeks.map((w) => `${week(w.start)} ${num(w.matched)} from this prompt's queries, ${num(w.other)} other`).join('; ')}`
            : `Average position by week: ${weeks.map((w) => `${week(w.start)} ${w.position}`).join(', ')}`}>
          {/* the hover band, behind everything (Sentiment's) */}
          <rect x={0} y={top} width={bandW} height={PLOT} rx={6} fill="var(--tint)" aria-hidden
            style={{ transform: `translateX(${hover != null ? x(hover) - bandW / 2 : 0}px)`, opacity: hover != null ? 1 : 0, transition: still ? 'none' : 'transform 160ms cubic-bezier(.2,.8,.2,1), opacity 150ms ease-out' }} />
          <g style={fade(view === 'mix')} aria-hidden={view !== 'mix'}>
            {Array.from({ length: yMax / step + 1 }, (_, k) => k * step).map((t) => (
              <g key={t}>
                <line x1={left} x2={left + plotW} y1={y(t)} y2={y(t)} stroke="var(--div)" />
                <text x={left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={12} fill="var(--color-stone-500)" className="tabular-nums">{t >= 1000 ? `${+(t / 1000).toFixed(1)}k` : t}</text>
              </g>
            ))}
            {weeks.map((w, i) => {
              const x0 = x(i) - colW / 2
              const segs = stackSegments(['matched', 'other'], (k) => w[k], y)
              return (
                <g key={w.start} opacity={i === picked ? 1 : 0.85} style={still ? undefined : { transformBox: 'fill-box', transformOrigin: 'bottom', animation: `rep-grow 300ms ease-out ${i * 30}ms both` }}>
                  {segs.map(({ key, yTop, h, r }) => (
                    <g key={key}>
                      <rect x={x0} width={colW} rx={r} fill={FILL[key]} style={{ y: yTop, height: h, transition: move }} />
                      <rect x={x0} width={colW} fill={FILL[key]} style={{ y: yTop + r, height: Math.max(0, h - r), transition: move }} />
                    </g>
                  ))}
                </g>
              )
            })}
          </g>
          <g style={fade(view === 'position')} aria-hidden={view !== 'position'}>
            {pTicks.map((t) => (
              <g key={t}>
                <line x1={left} x2={left + plotW} y1={yp(t)} y2={yp(t)} stroke="var(--div)" />
                <text x={left - 8} y={yp(t)} dy="0.32em" textAnchor="end" fontSize={12} fill="var(--color-stone-500)" className="tabular-nums">{t}</text>
              </g>
            ))}
            {/* the line as a path whose d animates to a new page's values (300ms) */}
            <path fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round"
              style={{ d: `path('${weeks.map((w, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yp(w.position).toFixed(1)}`).join(' ')}')`, transition: still ? 'none' : 'd 300ms ease-out' }} />
            {weeks.map((w, i) => (
              <circle key={w.start} cx={x(i)} r={i === picked ? 5 : 4} fill="var(--ink)" stroke="var(--color-surface)" strokeWidth={2}
                style={{ cy: yp(w.position), transition: still ? 'none' : 'cy 300ms ease-out' }} />
            ))}
          </g>
          {weeks.map((w, i) => {
            const on = i === picked
            return (
              <g key={`d${w.start}`} aria-hidden>
                <text x={x(i)} y={top + PLOT + 18} textAnchor="middle" fontSize={12} fill={on ? 'var(--ink)' : 'var(--color-stone-500)'} fontWeight={on ? 600 : 400}>{week(w.start)}</text>
                {on && <rect x={x(i) - 18} y={top + PLOT + 23} width={36} height={2} fill="var(--ink)" />}
              </g>
            )
          })}
          {weeks.map((w, i) => (
            <rect key={`h${w.start}`} x={left + slot * i} y={top} width={slot} height={PLOT + bottom - 2} fill="transparent" className="cursor-pointer outline-none"
              role="button" tabIndex={0} aria-pressed={i === picked} aria-label={`Week of ${week(w.start)}: ${num(w.impressions)} impressions, ${num(w.clicks)} clicks, position ${w.position}`}
              onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onClick={() => onPick(i)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(i) } }} />
          ))}
        </svg>
      )}
      {hover != null && weeks[hover] && (
        <div className="pointer-events-none absolute left-0 top-0 z-30" style={{ transform: `translate(${tipLeft(x(hover), colW, width, 184)}px, ${top}px)`, transition: still ? 'none' : 'transform 160ms cubic-bezier(.2,.8,.2,1)' }}>
          <WeekTip w={weeks[hover]} prev={weeks[hover - 1] ?? null} />
        </div>
      )}
    </div>
  )
}

// the card beside a week's column (Sentiment's SyncTip look)
function WeekTip({ w, prev }) {
  const c = prev ? changeParts(w.impressions - prev.impressions) : null
  const line = (dot, name, v) => <div className="grid grid-cols-[10px_1fr_auto] items-center gap-x-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: dot }} /><span className="text-stone-700">{name}</span><span className="text-right">{num(v)}</span></div>
  return (
    <div role="tooltip" style={{ width: 184 }} className="rounded-md border border-line bg-raised px-3 py-2.5 text-[12px] leading-4 tabular-nums shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className="font-semibold text-stone-900">Week of {week(w.start)}</span>
        {c && c.tone !== 'same' && <span className={`font-medium ${TONE_CLASS[c.tone]}`}>{c.arrow} {c.sign}{c.abs}</span>}
      </div>
      <div className="mt-1.5 flex flex-col gap-0.5">
        {line('var(--ink)', 'This prompt’s queries', w.matched)}
        {line('var(--sent-track)', 'Other queries', w.other)}
        <div className="mt-1 flex justify-between border-t border-[var(--div)] pt-1 text-stone-700"><span>Clicks</span><span>{num(w.clicks)}</span></div>
        <div className="flex justify-between text-stone-700"><span>Avg position</span><span>{w.position.toFixed(1)}</span></div>
      </div>
    </div>
  )
}

// not connected: the same column in grey (no numbers)
function Ghost() {
  const g = 'bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]'
  const hs = [46, 58, 52, 70, 64, 82, 76, 92]
  return (
    <div aria-hidden className="pt-4">
      <span className={`block h-4 w-40 rounded-full ${g}`} />
      <div className="mt-6 flex h-[200px] items-end justify-around border-b border-[var(--div)] px-10">
        {hs.map((h, i) => <span key={i} className={`w-6 rounded-t-[3px] ${g}`} style={{ height: `${h}%` }} />)}
      </div>
      <div className="mt-10 grid grid-cols-3 gap-4 border-t border-[var(--div)] pt-4">
        {['Clicks', 'CTR', 'Avg position'].map((l) => (
          <div key={l} className="flex flex-col gap-1.5"><span className="text-[13px] leading-[18px] text-stone-500">{l}</span><span className={`h-5 w-12 rounded ${g}`} /></div>
        ))}
      </div>
    </div>
  )
}
