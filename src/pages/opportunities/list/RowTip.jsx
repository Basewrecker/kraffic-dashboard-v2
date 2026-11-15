// Hover on a row with a content status (owner, 2026-11-04, round 5): the 4-week mini timeline in a tooltip. A grid:
// one row per engine (its icon), one column per week, a separate ✓ / ✕ in each cell (no overlapping badges), then the
// visibility per week. Before publishing (draft ready, waiting) the weeks are still to come. Portalled (table cells
// clip), below the row or above it near the bottom, fading in over 150ms.
// app (owner, 2026-11-05): only on published rows (Week n of 4, Improved, No change yet); opens after ~150ms and fades
// in; placed with the Content pages' tooltip rule (components/mock-overview/content-tip.jsx placeTip: kept inside the
// window, flipped above near the bottom); the header is one line, "Published Nov 5 · Week 2 of 4"; a missed sync is
// "—" (never 0), weeks still to come are dots.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { PlatformIcon } from '../../../components/dashboard/icons'
import { ENGINES, ENGINE_NAME, engineIcon } from '@/lib/mock-adapter-content'
import { trackingFor } from '@/lib/mock-adapter-content'
import { placeTip } from '@/components/mock-overview/content-tip' // app

const W = 320
const DELAY = 150
export const PUBLISHED = ['monitoring', 'nochange', 'improved'] // app: the stages that get the card
const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const dot = <span className="h-1 w-1 rounded-full bg-stone-300" aria-label="not run yet" />
const gap = <span className="text-[12px] leading-4 text-stone-400" aria-label="sync missed">—</span>

function Mark({ s, engine }) {
  if (s.pending) return dot
  if (s.engines == null) return gap
  return s.engines[engine]
    ? <Check size={13} strokeWidth={2.5} className="text-[var(--co-improved)]" aria-label="named" />
    : <X size={13} strokeWidth={2.5} className="text-negative" aria-label="not named" />
}

// the published row's card, or nothing (Create content, Draft ready, Waiting to publish)
export const tipFor = (tip) => (tip?.row?.draft?.published_at && PUBLISHED.includes(tip.row.stage) ? tip : null)
export const tipHeader = (d) => `Published ${fmtDay(d.published_at)}${d.week ? ` · Week ${d.week} of 4` : ''}`

export default function RowTip({ tip: raw }) {
  const tip = tipFor(raw)
  const key = tip ? tip.row.id : null
  const [shown, setShown] = useState(null)
  useEffect(() => {
    if (key == null) { setShown(null); return undefined }
    const t = setTimeout(() => setShown(key), DELAY)
    return () => clearTimeout(t)
  }, [key])
  if (!tip || shown !== key) return null
  return <Card tip={tip} />
}

export function Card({ tip }) {
  const { row, rect } = tip
  const d = row.draft
  const box = useRef(null)
  const [pos, setPos] = useState(null)
  useLayoutEffect(() => {
    if (!box.current) return
    const r = box.current.getBoundingClientRect()
    // anchored near the row's right end (over the status), then kept on screen
    const at = { left: rect.right - 16 - W, width: W, top: rect.top, bottom: rect.bottom }
    setPos(placeTip(at, r.width, r.height, window.innerWidth, window.innerHeight, 8))
  }, [rect])
  const syncs = trackingFor(d)
  const cols = 'grid grid-cols-[28px_repeat(4,minmax(0,1fr))] items-center'
  return createPortal(
    <div ref={box} role="tooltip" data-row-tip style={{ ...(pos ?? { left: -9999, top: 0 }), width: W }}
      className="pointer-events-none fixed z-[70] rounded-lg border border-line bg-raised p-3 text-left shadow-md motion-safe:animate-[fade-in_150ms_ease-out]">
      {/* app (owner, 2026-11-10): nothing in the card lighter than the secondary colour (was stone-500) */}
      <div className="mb-2 text-[12px] leading-4 text-stone-600 tabular-nums">{tipHeader(d)}</div>
      <div className={`${cols} pb-1.5 text-[12px] leading-4 text-stone-600`}>
        <span />
        {syncs.map((s, i) => <span key={s.date ?? i} className="text-center tabular-nums">Wk {i + 1}</span>)}
      </div>
      {ENGINES.map((e) => (
        <div key={e} className={`${cols} h-6 border-t border-[var(--div)]`}>
          <span className="flex" title={ENGINE_NAME[e]}><PlatformIcon id={engineIcon(e)} size={14} /></span>
          {syncs.map((s, i) => <span key={s.date ?? i} className="grid place-items-center"><Mark s={s} engine={e} /></span>)}
        </div>
      ))}
      <div className={`${cols} h-6 border-t border-[var(--div)] text-[12px] leading-4 tabular-nums`}>
        <span className="text-stone-600">Vis.</span>
        {syncs.map((s, i) => (
          <span key={s.date ?? i} className="grid place-items-center text-stone-900">{s.pending ? dot : s.visibility == null ? gap : `${s.visibility.after}%`}</span>
        ))}
      </div>
    </div>,
    document.body,
  )
}
