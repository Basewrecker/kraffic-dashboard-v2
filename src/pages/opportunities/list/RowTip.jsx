// Hover on a row with a content status (owner, 2026-11-04, round 5): the 4-week mini timeline in a tooltip. A grid:
// one row per engine (its icon), one column per week, a separate ✓ / ✕ in each cell (no overlapping badges), then the
// visibility per week. Before publishing (draft ready, waiting) the weeks are still to come. Portalled (table cells
// clip), below the row or above it near the bottom, fading in over 150ms.
import { createPortal } from 'react-dom'
import { Check, Minus, X } from 'lucide-react'
import { PlatformIcon } from '../../../components/dashboard/icons'
import { ENGINES, ENGINE_NAME, engineIcon } from '../../../data/contentOpportunities'
import { trackingFor } from '../../../data/contentOpportunities-proposed'

const W = 320
const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const HEAD = { draft: 'Draft ready · not published yet', waiting: 'Waiting to publish' }

function Mark({ s, engine }) {
  if (s.pending) return <span className="h-1 w-1 rounded-full bg-stone-300" aria-label="not run yet" />
  if (s.engines == null) return <Minus size={12} className="text-stone-400" aria-label="sync failed" />
  return s.engines[engine]
    ? <Check size={13} strokeWidth={2.5} className="text-[var(--co-improved)]" aria-label="named" />
    : <X size={13} strokeWidth={2.5} className="text-negative" aria-label="not named" />
}

export default function RowTip({ tip }) {
  if (!tip || !tip.row.draft) return null // no tooltip on "Create content" rows
  const { row, rect } = tip
  const d = row.draft
  const syncs = d.published_at ? trackingFor(d) : trackingFor({ ...d, week: 0 })
  const above = rect.bottom + 8 + 170 > window.innerHeight
  const left = Math.max(8, Math.min(rect.right - W - 16, window.innerWidth - W - 8))
  const cols = 'grid grid-cols-[28px_repeat(4,minmax(0,1fr))] items-center'
  return createPortal(
    <div role="tooltip" style={{ left, top: above ? rect.top - 8 : rect.bottom + 8, width: W }}
      className={`pointer-events-none fixed z-[70] rounded-lg border border-line bg-raised p-3 text-left shadow-md motion-safe:animate-[fade-in_150ms_ease-out] ${above ? '-translate-y-full' : ''}`}>
      <div className="mb-2 flex items-center justify-between gap-3 text-[12px] leading-4 text-stone-500 tabular-nums">
        <span>{d.published_at ? `Published ${fmtDay(d.published_at)}` : HEAD[row.stage]}</span>
        {d.published_at && <span>Week {d.week} of 4</span>}
      </div>
      <div className={`${cols} pb-1.5 text-[12px] leading-4 text-stone-500`}>
        <span />
        {syncs.map((s, i) => <span key={s.date} className="text-center tabular-nums">Wk {i + 1}</span>)}
      </div>
      {ENGINES.map((e) => (
        <div key={e} className={`${cols} h-6 border-t border-[var(--div)]`}>
          <span className="flex" title={ENGINE_NAME[e]}><PlatformIcon id={engineIcon(e)} size={14} /></span>
          {syncs.map((s) => <span key={s.date} className="grid place-items-center"><Mark s={s} engine={e} /></span>)}
        </div>
      ))}
      <div className={`${cols} h-6 border-t border-[var(--div)] text-[12px] leading-4 tabular-nums`}>
        <span className="text-stone-500">Vis.</span>
        {syncs.map((s) => (
          <span key={s.date} className="text-center text-stone-900">{s.pending ? <span className="text-stone-400">—</span> : s.visibility == null ? <span className="text-stone-400">gap</span> : `${s.visibility.after}%`}</span>
        ))}
      </div>
    </div>,
    document.body,
  )
}
