import { useEffect, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { InfoTip, Metric, StatusCell } from './marketParts'
import { PAGE_SIZE, statusOf } from './view'

// One of the two lists under the chart (as the app's RelatedSearches, #203 / #207 / #231): "Top prompts" or "Rising
// prompts". A row: rank, the search, its number (bar + score, or growth / Breakout), then Named / Missed / Track.
// 10 rows a page. Hovering (or focusing) a row previews its line on the chart, dashed; a click pins it.
//   list: { id, title, tip, sub, rows, rising } · real: the brand's own data (sample data has no tracking column)
export default function PromptList({ list, real, tracked, onTrack, onPreview, onPin, pinned, onViewAll, resetKey }) {
  const [page, setPage] = useState(0)
  useEffect(() => setPage(0), [resetKey])
  const { rows } = list
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const at = Math.min(page, pages - 1)
  const shown = rows.slice(at * PAGE_SIZE, at * PAGE_SIZE + PAGE_SIZE)
  const pager = 'grid size-8 place-items-center rounded-md border border-line text-stone-700 outline-none transition-colors duration-150 hover:border-[var(--color-line-strong)] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-40'
  return (
    <section aria-labelledby={`trends-${list.id}`} className="min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div className="relative min-w-0">
          <h2 id={`trends-${list.id}`} className="flex items-center gap-2 text-[16px] leading-6 font-semibold text-stone-900">{list.title}<InfoTip label={`About ${list.title}`}>{list.tip}</InfoTip></h2>
          <p className="mt-0.5 text-[13px] leading-[18px] text-stone-500">{list.sub}</p>
        </div>
        {rows.length > 0 && (
          <button type="button" onClick={onViewAll} className="group/va -mr-1 inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1 text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
            <span className="tabular-nums">View all {rows.length}</span><ArrowRight size={13} aria-hidden className="transition-transform duration-150 group-hover/va:translate-x-0.5 motion-reduce:transition-none" />
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 border-t border-line py-8 text-[14px] leading-5 text-stone-600">{list.empty}</p>
      ) : (
        <>
          <ol className="mt-3 border-t border-line" onPointerLeave={() => onPreview(null)}>
            {shown.map((r, i) => {
              const isPinned = pinned === r.query
              return (
                <li key={r.query} className="border-b border-line">
                  <div role="button" tabIndex={0} aria-pressed={isPinned} aria-label={`${r.query}: show on the chart`}
                    onPointerEnter={() => onPreview(r)} onFocus={() => onPreview(r)} onBlur={() => onPreview(null)}
                    onClick={() => onPin(r)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPin(r) } }}
                    className={`group/row flex min-h-[51px] cursor-pointer items-center gap-3 outline-none transition-colors duration-150 hover:bg-[var(--subtle-bg)] focus-visible:bg-[var(--subtle-bg)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${isPinned ? 'bg-[var(--subtle-bg)]' : ''}`}>
                    <span className="w-6 shrink-0 text-right text-[13px] leading-[18px] text-stone-500 tabular-nums">{at * PAGE_SIZE + i + 1}</span>
                    {/* one line on wide screens; on a phone the search wraps to two lines rather than being cut to a few letters */}
                    <span className="line-clamp-2 min-w-0 flex-1 py-1.5 text-[14px] leading-5 font-semibold text-stone-900 sm:line-clamp-1">{r.query}</span>
                    <Metric row={r} rising={list.rising} />
                    {/* sample data: nothing to track yet; the column keeps its room on wide screens, as the app */}
                    {real ? <StatusCell status={statusOf(r, tracked)} query={r.query} onTrack={onTrack} /> : <span aria-hidden className="hidden w-[92px] shrink-0 lg:block" />}
                  </div>
                </li>
              )
            })}
          </ol>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[13px] leading-[18px] text-stone-500 tabular-nums">{at * PAGE_SIZE + 1}–{Math.min(rows.length, (at + 1) * PAGE_SIZE)} of {rows.length}</span>
            <span className="flex items-center gap-2">
              <button type="button" aria-label="Previous page" disabled={at === 0} onClick={() => setPage(at - 1)} className={pager}><ChevronLeft size={15} aria-hidden /></button>
              <button type="button" aria-label="Next page" disabled={at >= pages - 1} onClick={() => setPage(at + 1)} className={pager}><ChevronRight size={15} aria-hidden /></button>
            </span>
          </div>
        </>
      )}
    </section>
  )
}
