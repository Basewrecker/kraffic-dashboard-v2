import { useEffect, useState } from 'react'
import { ArrowRight, ChevronRight } from 'lucide-react'
import Card from './Card'
import Insight, { hl, useExplain } from '../ui/Insight'
import { syncEvidence } from './insights'
import { useTracking } from '../../store/trackingSettings'
import SectionHeader from './SectionHeader'
import { openSyncDrawer } from '../answer/SyncDrawer'
import { useBrandView } from '../../hooks/useBrandView'

const PREVIEW = 5
const short = (d) => d.replace(/, \d{4}$/, '') // "Oct 5, 2026" → "Oct 5"
// chevron | date | visibility | prompts split
// phones: narrower date / % columns and no bar (the count says it)
const ROW = 'grid grid-cols-[20px_92px_84px_minmax(0,1fr)] items-center gap-x-3 sm:grid-cols-[20px_112px_96px_minmax(0,1fr)]'

// ▲ ink · ▼ negative (the only hue in the system) · — muted
export function Delta({ d, className = 'text-[12px] leading-4' }) {
  if (d == null || d === 0) return <span className={`${className} font-medium text-stone-500`}>—</span>
  return (
    <span className={`${className} font-medium tabular-nums whitespace-nowrap ${d > 0 ? 'text-ink' : 'text-negative'}`}>
      {d > 0 ? '▲' : '▼'} {Math.abs(d)}
    </span>
  )
}

const LIST_MAX = 3
const fmtSigned = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')

// "+14 gained" / "−4 lost", the first 3 prompts, then "+11 more"; the header and "+N more" open the sync's drawer on this tab
function ChangeList({ kind, items, syncId }) {
  const gained = kind === 'gained'
  const more = items.length - LIST_MAX
  const open = (e) => openSyncDrawer({ syncId, tab: kind, opener: e.currentTarget })
  return (
    <div className="min-w-0 rounded-lg border border-[var(--subtle-border)] bg-[var(--subtle-bg)] p-3">
      <button type="button" onClick={open} disabled={!items.length} className="mb-1.5 inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-medium outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none">
        <span className={`tabular-nums ${gained ? 'text-ink' : 'text-negative'}`}>{gained ? '+' : '−'}{items.length}</span>
        <span className="text-stone-600"> {gained ? 'gained' : 'lost'}</span>
        {items.length > 0 && <ChevronRight size={12} className="text-stone-500" aria-hidden />}
      </button>
      <ul>
        {items.slice(0, LIST_MAX).map((p) => (
          <li key={p.id} title={p.prompt} className="flex h-6 items-center text-[13px] leading-[18px] text-stone-600 transition-colors duration-150 hover:text-stone-900">
            <span className="truncate">{p.prompt}</span>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <button
          type="button"
          onClick={open}
          className="mt-1 block rounded text-[12px] leading-4 font-medium text-stone-500 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
        >
          +{more} more
        </button>
      )}
    </div>
  )
}

// no box: indented to the date column, lists first, one quiet comparison line underneath
function Changes({ row }) {
  const c = row.changes
  if (!c) return <div className="pb-4 pl-8 pr-2 pt-1 text-[12px] leading-4 text-stone-500">First sync in this history: nothing to compare against.</div>
  const val = (n) => <span className="font-medium text-stone-600 tabular-nums">{fmtSigned(n)}</span>
  return (
    <div className="pb-4 pl-8 pr-2 pt-1">
      {/* minmax(0,1fr) rather than 1fr so long prompts truncate instead of widening the box; stacks below 640px */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ChangeList kind="gained" items={c.gained} syncId={row.id} />
        <ChangeList kind="lost" items={c.lost} syncId={row.id} />
      </div>
      <p className="mt-2.5 pl-0.5 text-[12px] leading-4 text-stone-500">
        vs {c.vs} · cited pages {val(c.deltas.citedPages)} · missed {val(c.deltas.missed)}
      </p>
    </div>
  )
}

export default function SyncHistory() {
  const view = useBrandView()
  const tracking = useTracking()
  const { syncHistory, syncTotal, focal, isOwnBrand, engine } = view
  const [openIds, setOpenIds] = useState(() => new Set()) // a click opens one row; "Compare" opens two
  const [showAll, setShowAll] = useState(false)
  useEffect(() => setOpenIds(new Set()), [focal.domain])
  const rows = showAll ? syncHistory : syncHistory.slice(0, PREVIEW)
  const explain = useExplain(`${focal.domain}|${engine}|${showAll}`)
  const toggle = (id) => setOpenIds((cur) => (cur.has(id) ? new Set() : new Set([id])))
  const insight = syncEvidence(rows, { view, tracking, openRows: (ids) => setOpenIds(new Set(ids)) })

  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col p-5">
      <SectionHeader
        title="Sync history"
        subtitle={isOwnBrand ? `Last ${rows.length} syncs` : `${focal.name} · last ${rows.length} syncs`}
        right={
          <button
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
          >
            {/* mock data holds the latest 10 of the account's 40 syncs */}
            {showAll ? `Latest ${PREVIEW}` : `All ${syncTotal}`} <ArrowRight size={14} aria-hidden />
          </button>
        }
      />

      {!rows.length && <p className="mt-4 pb-4 text-[14px] leading-5 text-stone-600">No syncs on record yet.</p>}
      <ul className="mt-4 divide-y divide-[var(--color-line-soft)] pb-4">
        {rows.map((r, i) => {
          const isOpen = openIds.has(r.id)
          return (
            <li key={r.id} {...hl(explain, `sync:${r.id}`)}>
              <button
                type="button"
                onClick={() => toggle(r.id)}
                aria-expanded={isOpen}
                aria-controls={`sync-${r.id}`}
                className={`${ROW} group -mx-2 h-11 w-[calc(100%+16px)] rounded-md px-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus ${explain.on && explain.keys.includes(`sync:${r.id}`) ? 'bg-tint' : ''}`}
              >
                <ChevronRight size={14} className={`text-stone-500 transition-transform duration-150 ease-out motion-reduce:transition-none ${isOpen ? 'rotate-90' : ''}`} aria-hidden />
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span className="text-[14px] leading-5 text-stone-900 tabular-nums">{short(r.date)}</span>
                  {/* row hover is bg-tint too, so the pill swaps to the card colour to stay visible */}
                  {i === 0 && <span className={`inline-flex h-5 items-center rounded px-1.5 text-[11px] leading-none font-medium text-stone-700 transition-colors duration-150 ${explain.on && explain.keys.includes(`sync:${r.id}`) ? 'bg-surface' : 'bg-tint group-hover:bg-surface'}`}>Latest</span>}
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="text-[14px] leading-5 font-semibold text-ink tabular-nums">{r.visibility}%</span>
                  <Delta d={r.delta} />
                </span>
                <span className="flex min-w-0 items-center justify-end gap-3 sm:justify-start">
                  <span className="hidden h-1.5 w-full max-w-[160px] min-w-[48px] overflow-hidden rounded-full sm:flex" style={{ background: 'var(--data-track)' }} aria-hidden>
                    <span className="h-full rounded-full bg-ink" style={{ width: `${(r.visible / r.total) * 100}%` }} />
                  </span>
                  <span className="shrink-0 text-[13px] leading-[18px] text-stone-600 tabular-nums" title={`${r.visible} visible · ${r.missed} missed`}>{r.visible} / {r.total}</span>
                </span>
              </button>
              {/* always rendered so it can animate closed: grid rows 0fr → 1fr + opacity, 200ms */}
              <div
                id={`sync-${r.id}`}
                aria-hidden={!isOpen}
                inert={isOpen ? undefined : ''}
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
              >
                <div className="overflow-hidden">
                  <Changes row={r} />
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {/* the footer at the bottom of the card (the row can be taller than the list) */}
      {insight && <div className="mt-auto"><Insight explain={explain} {...insight} /></div>}
    </Card>
  )
}
