import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import Card from './Card'
import SectionHeader from './SectionHeader'
import Insight, { hl, hlOpacity, useExplain } from '../ui/Insight'
import NoResult from '../ui/NoResult'
import { useCountUp } from '../ui/motion'
import { sourceLine } from './insights'
import { openFolderDrawer } from '../answer/FolderDrawer'
import { FOLDER_WEEKS, folderWeeks } from '../../data/citedFolders'
import { hasResult } from '../../data/brandViews'
import { useBrandView } from '../../hooks/useBrandView'
import { useTracking } from '../../store/trackingSettings'
import { folderColor } from './folderColors'
import { OTHER, folderChange, folderInsight, folderLabel, otherChange, topFolders, wholePercents } from '../../utils/citedFolders'

// "Cited pages by folder" (replaces Top cited pages, owner 2026-11-04): the brand's cited URLs grouped by their first
// path segment (utils/citedFolders.js: no query string or #anchor, "/" = Homepage, PDFs together), the top 6 folders
// and "Other n folders". A donut (200px; Share of voice's palette by rank, solid fills, 2px card-colour gaps), its
// centre the biggest folder's share, a legend (dot · folder · citations · % · change vs the sync before) and the
// insight line. The centre is ONLY the percentage (owner, 2026-11-04: a name, a count and a trend made it cramped;
// the legend row carries the name and count, the drawer the trend). Hover a slice or a row: that slice springs out
// 6px, the others dim to 35%, the row highlights, the centre counts to that folder's share (250ms); leaving: back to
// the biggest folder's. Click: the drawer on that folder.
const HOVER_DELAY = 60 // ms: sweeping across slices doesn't flicker through each one
const SIZE = 200, C = 100, R = 92, HOLE = 62, PUSH = 6
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const SPRING = 'cubic-bezier(.34,1.56,.64,1)' // a small overshoot, settles in ~250ms
const short = (d) => String(d ?? '').replace(/, \d{4}$/, '')

// one annular slice from a0 to a1 (radians, 0 = 12 o'clock, clockwise)
function arc(a0, a1) {
  const pt = (r, a) => [C + r * Math.sin(a), C - r * Math.cos(a)]
  const large = a1 - a0 > Math.PI ? 1 : 0
  if (a1 - a0 >= Math.PI * 2 - 1e-6) {
    // a single folder: a whole ring (two half arcs)
    return `M${C} ${C - R}A${R} ${R} 0 1 1 ${C} ${C + R}A${R} ${R} 0 1 1 ${C} ${C - R}ZM${C} ${C - HOLE}A${HOLE} ${HOLE} 0 1 0 ${C} ${C + HOLE}A${HOLE} ${HOLE} 0 1 0 ${C} ${C - HOLE}Z`
  }
  const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(HOLE, a1), [x3, y3] = pt(HOLE, a0)
  return `M${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${HOLE} ${HOLE} 0 ${large} 0 ${x3} ${y3}Z`
}

// "▲3" green · "▼2" red · nothing when unchanged or unknown
export function FolderDelta({ d, className = 'text-[12px] leading-4' }) {
  if (!d) return <span className={`${className} text-stone-500`} aria-hidden>—</span>
  return <span className={`${className} whitespace-nowrap font-medium tabular-nums ${d > 0 ? 'text-[var(--rep-up-fg)]' : 'text-negative'}`}>{d > 0 ? '▲' : '▼'}{Math.abs(d)}</span>
}

// the card's model, shared with the drawer: the latest sync's folders, the slices (top 6 + Other), whole %, changes
export function folderModel(domain, engine) {
  const weeks = folderWeeks(domain, engine)
  const now = weeks[0]?.groups ?? null
  const prev = weeks[1]?.groups ?? null
  if (!now || !now.total) return { weeks, now, prev, slices: [], pct: [] }
  const slices = topFolders(now.folders).map((f, i) => ({ ...f, label: folderLabel(f), color: folderColor(i, f.key), rank: i }))
  const pct = wholePercents(slices.map((s) => s.count))
  slices.forEach((s, i) => {
    s.pct = pct[i]
    s.change = s.key === OTHER ? otherChange(s, now, prev) : folderChange(s.key, now, prev)
  })
  return { weeks, now, prev, slices, pct }
}

export default function CitedFolders() {
  const view = useBrandView()
  const tracking = useTracking()
  const { focal, isOwnBrand, engine } = view
  const explain = useExplain(`${focal.domain}|${engine}|folders`)
  const noResult = !hasResult(engine)
  const m = useMemo(() => folderModel(focal.domain, engine), [focal.domain, engine])
  const { now, slices } = m
  const total = now?.total ?? 0
  const pages = now?.pageCount ?? 0
  // less than 10 weeks stored: say since when; one sync only: no changes, no trend (nothing to compare with)
  const single = m.weeks.length === 1
  const history = single
    ? `First sync with citations (${short(m.weeks[0].date)}). Changes and trends show after the next one.`
    : m.weeks.length < FOLDER_WEEKS ? `History since ${short(m.weeks.at(-1).date)} · ${m.weeks.length} weeks` : null

  const [hover, setHover] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const preview = (k) => { if (explain.on) return; clearTimeout(timer.current); timer.current = setTimeout(() => setHover(k), k == null ? 0 : HOVER_DELAY) }
  const hovered = slices.find((s) => s.key === hover) ?? null
  const shown = hovered ?? slices[0] ?? null
  const shownPct = useCountUp(shown?.pct ?? null, 250)
  const open = (folder, e) => openFolderDrawer({ folder: folder === OTHER ? null : folder, brand: focal.domain, opener: e?.currentTarget })

  const text = noResult ? null : folderInsight(slices, slices.map((s) => s.pct), { you: isOwnBrand, name: focal.name })
  const insight = text && {
    text,
    evidence: {
      keys: [`folder:${slices[0].key}`],
      calc: `${slices[0].count} of ${total} citations link a page in ${slices[0].label} (${pages} cited pages in ${now.folders.length} folders).`,
      source: sourceLine(tracking),
      action: { label: `Open ${slices[0].label}`, onClick: () => open(slices[0].key) },
    },
  }
  // the slices' angles (from 12 o'clock, clockwise)
  let at = 0
  const geo = slices.map((s) => { const a0 = at; at += (s.count / Math.max(1, total)) * Math.PI * 2; return { a0, a1: at, mid: (a0 + at) / 2 } })

  return (
    // a narrow card (1280, two cards to a row): the donut steps down to 172px so the folder names stay whole
    <Card ref={explain.cardRef} id="cited-folders" className="@container flex h-full min-w-0 flex-col p-5">
      <SectionHeader
        title="Cited pages by folder"
        subtitle={`${isOwnBrand ? 'Your' : `${focal.name}’s`} URLs that AI answers cite · ${noResult ? '—' : total} citations`}
        right={(
          <button type="button" onClick={(e) => open(null, e)} aria-label={`All ${pages} cited pages`}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
            All {pages} <ArrowRight size={14} aria-hidden />
          </button>
        )}
      />

      {noResult || !slices.length ? (
        <div className="flex flex-1 items-center gap-6 py-6">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Cited pages by folder: no result" className="shrink-0">
            <path d={arc(0, Math.PI * 2)} fill="var(--data-track)" fillRule="evenodd" />
          </svg>
          <p className="text-[14px] leading-5 text-stone-600">{noResult ? <NoResult engine={engine} /> : 'No cited pages in the latest sync'}</p>
        </div>
      ) : (
        <div className="mt-4 flex min-h-0 flex-1 items-center gap-6 @max-[520px]:gap-4 max-sm:flex-col max-sm:items-stretch" onMouseLeave={() => preview(null)}>
          {/* the donut: slices are pointer targets; the legend rows are the keyboard's way in */}
          <div className="relative mx-auto h-[200px] w-[200px] shrink-0 @max-[520px]:h-[172px] @max-[520px]:w-[172px]">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" className="h-full w-full overflow-visible"
              aria-label={`Citations by folder: ${slices.map((s) => `${s.label} ${s.pct}%`).join(', ')}`}>
              {slices.map((s, i) => {
                const g = geo[i]
                const on = hover === s.key
                const dx = on ? Math.sin(g.mid) * PUSH : 0, dy = on ? -Math.cos(g.mid) * PUSH : 0
                const dim = explain.on ? hlOpacity(explain, `folder:${s.key}`) : hover && !on ? 0.35 : 1
                return (
                  <path key={s.key} d={arc(g.a0, g.a1)} fill={s.color} fillRule="evenodd" stroke="var(--color-surface)" strokeWidth={2} strokeLinejoin="round"
                    className="cursor-pointer motion-safe:animate-[fade-in_400ms_ease-out_both]"
                    style={{ transform: `translate(${dx}px, ${dy}px)`, opacity: dim, transition: reduced() ? 'none' : `transform 250ms ${SPRING}, opacity 150ms ease-out` }}
                    onMouseEnter={() => preview(s.key)} onClick={() => open(s.key)} />
                )
              })}
            </svg>
            {/* the centre: only the share of the biggest folder, or of the hovered one (it counts there); the folder's
                name and count are in its legend row. Screen readers still hear which folder the number is. */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-live="polite">
              <span className="text-[32px] leading-9 font-semibold text-stone-900 tabular-nums">{shownPct ?? '—'}%<span className="sr-only">, {shown.label}: {shown.count} of {total} citations</span></span>
            </div>
          </div>

          {/* the legend: dot · folder · citations · % · change vs the sync before */}
          <ul className="flex min-w-0 flex-1 flex-col gap-y-0.5" aria-label="Folders">
            {slices.map((s) => (
              <li key={s.key} {...hl(explain, `folder:${s.key}`, { row: true })}>
                <button type="button" data-folder={s.key}
                  onMouseEnter={() => preview(s.key)} onFocus={() => preview(s.key)} onBlur={() => preview(null)} onClick={(e) => open(s.key, e)}
                  aria-label={`${s.label}: ${s.count} citations, ${s.pct}%${s.change ? `, ${s.change > 0 ? 'up' : 'down'} ${Math.abs(s.change)} since the last sync` : ''}. Open its pages`}
                  className={`-mx-2 grid min-h-8 w-[calc(100%+16px)] ${single ? 'grid-cols-[8px_minmax(0,1fr)_24px_34px]' : 'grid-cols-[8px_minmax(0,1fr)_24px_34px_30px]'} items-center gap-x-2 rounded-lg px-2 py-1 text-left outline-none transition-[background-color,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-focus ${hover === s.key ? 'bg-tint' : 'hover:bg-tint'} ${hover && hover !== s.key ? 'opacity-60' : ''}`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
                  <span className="truncate text-[14px] leading-5 font-medium text-stone-900" title={s.label}>{s.label}</span>
                  <span className="text-right text-[14px] leading-5 font-semibold text-ink tabular-nums">{s.count}</span>
                  <span className="text-right text-[13px] leading-5 text-stone-600 tabular-nums">{s.pct}%</span>
                  {!single && <span className="text-right"><FolderDelta d={s.change} /></span>}
                </button>
              </li>
            ))}
            {history && <li className="mt-1.5 text-[12px] leading-4 text-stone-500 tabular-nums" data-folder-history>{history}</li>}
          </ul>
        </div>
      )}

      {insight && <div className="mt-auto pt-3"><Insight explain={explain} {...insight} wrap /></div>}
    </Card>
  )
}
