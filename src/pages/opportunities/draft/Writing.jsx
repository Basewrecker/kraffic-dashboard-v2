// Draft step v1 while content-recommend runs: honest, and worth looking at. The route sends nothing until the draft is
// done, so there are no steps, ticks or "done" states:
//   - one line from the data we have: "Adding FAQ and How-to guide, the 2 formats the winners use" (the formats in
//     ink: draft/recommend.js R21, what the route drafts) and the competitors it's written to beat (the request's,
//     names from settings);
//   - the status: the app's two loading lines (the second after its fixed 4.5s, crossfading) and an elapsed timer
//     ("0:12", client-side time) in muted text;
//   - the skeleton of the draft it will write: the expected section headings (R21) as labels, each with shimmering
//     lines; the shimmer moves through them top to bottom, in a loop (the owner's exception; static under reduced
//     motion: the skeleton and the timer stay).
// When the draft arrives, DraftStep fades this out while the draft's sections fade in, top to bottom (60ms apart).
import { useEffect, useState } from 'react'
import { LOADING_LINES, LOADING_SWITCH_MS, formatLabel } from '../../../data/contentRecommend'
import { CrossFade } from '../../../components/ui/motion'
import { LogoPlate } from '../parts'

const LINES = { 'Direct answer': ['92%', '64%'], 'Key points': ['88%', '80%', '72%'], Steps: ['90%', '84%', '76%'], Comparison: ['30%', '30%', '30%'], 'Detailed explanation': ['96%', '90%', '58%'], FAQ: ['70%', '94%', '66%'], Sources: ['44%', '40%'] }
const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const andList = (xs) => (xs.length < 2 ? xs : [...xs.slice(0, -1).flatMap((x, i) => (i ? [', ', x] : [x])), ' and ', xs.at(-1)])

// plan: draftPlan() (R21) · competitors: the request's domains · nameOf: a competitor's display name
// overlay: drawn over the arriving draft, in its column (left, 8/12) so each skeleton section sits near its section
export default function Writing({ startedAt, plan, competitors = [], nameOf = (d) => d, overlay = false }) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(id)
  }, [])
  const elapsed = startedAt != null ? now - startedAt : 0
  const line = elapsed >= LOADING_SWITCH_MS ? 1 : 0
  const formats = plan.missing.map((m) => formatLabel(m.id))
  const total = plan.sections.reduce((n, s) => n + 1 + (LINES[s]?.length ?? 2), 0)
  let k = 0 // the shimmer's position down the skeleton
  const wave = () => ({ animationDelay: `${(k++) * 110}ms`, animationDuration: `${total * 110 + 700}ms` })
  return (
    <div className={overlay ? 'w-[66%] py-2' : 'mx-auto max-w-[760px] py-2'} role={overlay ? undefined : 'status'} aria-live={overlay ? undefined : 'polite'}>
      <p className="text-[15px] leading-[22px] text-stone-700">
        Adding {andList(formats.map((f) => <span key={f} className="font-semibold text-ink">{f}</span>))}, the {formats.length} {formats.length === 1 ? 'format' : 'formats'} the winners use
      </p>
      {competitors.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] leading-[18px] text-stone-500">
          <span>Written to beat</span>
          {competitors.map((d) => <span key={d} className="inline-flex items-center gap-1.5 text-stone-800"><LogoPlate domain={d} name={nameOf(d)} size={18} logoClass="h-3 w-3" initialClass="text-[8px]" />{nameOf(d)}</span>)}
        </p>
      )}
      <div className="mt-4 flex items-center gap-3 border-t border-[var(--div)] pt-3 text-[14px] leading-5 text-stone-600">
        <span className="min-w-0 flex-1"><CrossFade k={line} ms={250}><span className="block">{LOADING_LINES[line]}</span></CrossFade></span>
        <span className="shrink-0 tabular-nums text-stone-500" aria-label={`Elapsed ${clock(elapsed)}`}>{clock(elapsed)}</span>
      </div>
      <div aria-hidden className="mt-6 flex flex-col gap-6" data-skeleton>
        {plan.sections.map((s) => (
          <div key={s} data-section={s}>
            <p className="co-skel-wave text-[15px] leading-[22px] font-semibold text-stone-500" style={wave()}>{s}</p>
            <div className={`mt-2.5 ${s === 'Comparison' ? 'grid grid-cols-3 gap-3' : 'flex flex-col gap-2'}`}>
              {(LINES[s] ?? ['90%', '70%']).map((w, i) => (
                <span key={i} className={`co-skel-wave block bg-[var(--color-line)] ${s === 'Comparison' ? 'h-16 rounded-lg' : 'h-3 rounded-full'}`} style={{ width: s === 'Comparison' ? '100%' : w, ...wave() }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
