// Opportunities → Content, the Draft step, from content-recommend's response (data/contentRecommend.js).
//   While the route runs: v1 shows one honest state (draft/Writing.jsx); ?backend=full shows the live 5-step view
//   (draft/Generating.jsx, reading the same response) instead.
//   Then: the draft and its rail (draft/DraftView.jsx), and a full-width sticky footer: Copy content (primary; "Copied
//   ✓" for 2s, then step 3) · More ▾ (Copy as HTML, Export .md) | "Saved in this browser · Nov 2, 17:03" · Regenerate.
//   (Re-check score is in the rail’s readiness section.)
//
//   Export .md · Copy as HTML | "Saved in this browser · Nov 3, 20:03" · Re-check score (browser-only, as in the app's
//   recheckScore: the ticks re-scored, no server call) · Regenerate.
//   Copy content / Copy as HTML carry only the publishable sections; Export .md is the full brief (draft/recommend.js
//   R1–R3).
// session / setSession: the step's state, kept by the workspace so it survives the focus panel closing: the writing
// clock (startedAt), the user's ticks, when it was copied. newSession(ready, saved) makes one.
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, RefreshCw } from 'lucide-react'
import ActionMenu from '../../components/audit/ActionMenu'
import { competitorName } from '../../data/contentRecommend'
import { draftPlan } from './draft/recommend'
import { lineBtn } from '../../components/tool/ToolPage'
import { GEN_STEPS, genFails, genHold } from '../../data/contentOpportunities-proposed'
import Generating from './draft/Generating'
import Writing from './draft/Writing'
import DraftView from './draft/DraftView'
import { draftSession } from './draft/model'

const WRITE_STEP = GEN_STEPS.findIndex((s) => s.id === 'write')
export const newSession = (ready, saved = {}) => ({ ...draftSession({ ready, draft: null, flags: null, failAt: genFails() ? WRITE_STEP : -1 }), ticked: saved.ticked ?? [], copiedAt: saved.copiedAt ?? null, savedAt: saved.savedAt ?? null })
// "Nov 3, 20:03" (the app's saved-draft time)
export const savedLabel = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }) : '')

const ink = 'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-ink px-3.5 text-[14px] font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2'

// res: the response · competitors: the request's · full: ?backend=full · steps / live: the behind-flag live view ·
// onCopy / onCopyHtml / onExport: the workspace's actions (one copy path for the footer and the Copy & publish step) ·
// inPanel: in the focus panel
// savedAt: when it was last saved in this browser · onRecheck: "Re-check score" (recomputed in the browser from the ticks)
// resolve: the 'ai' engine tag's engines for a host (R20)
export default function DraftStep({ res, competitors, session, setSession, full = false, steps = GEN_STEPS, live, onCopy, onCopyHtml, onExport, onRecheck, savedAt, resolve, inPanel = false }) {
  const { phase, run, failAt, startedAt, ticked } = session
  const patch = (p) => setSession((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }))
  const regenerate = () => patch((s) => ({ phase: 'generating', run: s.run + 1, startedAt: performance.now(), summary: null, failAt: -1, copiedAt: null }))
  const retry = () => patch((s) => ({ failAt: -1, run: s.run + 1, startedAt: performance.now() }))
  const tick = (id) => patch((s) => ({ ticked: s.ticked.includes(id) ? s.ticked.filter((x) => x !== id) : [...s.ticked, id], savedAt: new Date().toISOString() }))

  // the draft arriving: for a moment the writing skeleton fades out over it while its sections fade in (60ms apart)
  const plan = draftPlan(res.recommendations)
  const writing = <Writing startedAt={startedAt} plan={plan} competitors={competitors} nameOf={competitorName} />
  // Copy content: "Copied ✓" for 2s (the workspace then moves to step 3)
  const [justCopied, setJustCopied] = useState(false)
  const copy = async () => { if (await onCopy({ advanceAfter: 2000 })) { setJustCopied(true); setTimeout(() => setJustCopied(false), 2000) } }
  const was = useRef(phase)
  const [arriving, setArriving] = useState(false)
  useEffect(() => {
    if (was.current === 'generating' && phase === 'draft' && !full) {
      setArriving(true)
      const t = setTimeout(() => setArriving(false), 900)
      was.current = phase
      return () => clearTimeout(t)
    }
    was.current = phase
    return undefined
  }, [phase, full])
  if (phase === 'generating') {
    return full
      ? <Generating key={run} steps={steps} failAt={failAt} onRetry={retry} live={live} hold={genHold(steps)} startedAt={startedAt} onDone={(line) => patch({ summary: line, phase: 'draft' })} />
      : writing
  }
  return (
    <div className="relative motion-safe:animate-[fade-in_.24s_ease-out]">
      <DraftView res={res} competitors={competitors} ticked={ticked} onTick={tick} arriving={arriving} onRecheck={onRecheck} resolve={resolve} />
      {arriving && <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bg-surface motion-safe:animate-[sent-fade-out_500ms_ease-out_both]"><Writing startedAt={startedAt} plan={plan} competitors={competitors} nameOf={competitorName} overlay /></div>}
      {/* the footer: full width, nothing clipped (wraps on narrow screens) */}
      <div data-draft-footer className={`@container sticky bottom-0 z-20 mt-8 border-t border-line py-3 ${inPanel ? '-mb-8 bg-surface pb-4' : 'bg-page'}`}>
        {/* left: Copy content (primary) + More (Copy as HTML, Export .md); right: when it was saved, Regenerate */}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={copy} className={`${ink} min-w-[132px] justify-center`}>{justCopied ? <><Check size={15} aria-hidden />Copied</> : 'Copy content'}</button>
          <ActionMenu label="More" side="top" align="left" items={[{ label: 'Copy as HTML', onClick: onCopyHtml }, { label: 'Export .md', onClick: onExport }]} className={lineBtn}>
            More<ChevronDown size={15} aria-hidden />
          </ActionMenu>
          <span className="flex-1" />
          <span className="text-[13px] leading-[18px] tabular-nums text-stone-500">Saved in this browser{savedAt ? ` · ${savedLabel(savedAt)}` : ''}</span>
          <button type="button" onClick={regenerate} className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-[14px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"><RefreshCw size={15} aria-hidden />Regenerate</button>
        </div>
      </div>
    </div>
  )
}
