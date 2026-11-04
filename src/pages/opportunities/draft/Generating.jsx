// Step 4 while the draft is written, in the focus panel (1200 wide): a live view in two columns, under the panel's header
// (its sub-line is the one total timer: "3.5s · Writing", Workspace BAR).
//   Left (300px): the step rail. A 2px line joins the 20px nodes and fills top-down as each step finishes (300ms).
//     Done: an ink node whose tick draws itself (250ms). Current: an indigo ring that turns, with a soft pulse around it
//     (the owner's exception to the no-looping-animation rule; the label in ink 600). Upcoming: a hollow --line-strong
//     ring, the label muted. Each row's count ticks up live, muted (no per-step times).
//   Right (the rest): the CURRENT step's real work, crossfading (200ms) as the steps change, in the page's row style:
//     1 Reading page-1 results: the pages stream in (favicon · domain · page title), each ticked once read.
//     2 Comparing formats: the 5 formats fill in with the competitors that have one, and ✓/✕ for your draft.
//     3 Checking competitors: the competitors to beat (logo · name · what they rank · the format they win with).
//     4 Writing: the draft's outline builds itself, heading by heading, a caret on the one being typed.
//     5 Checking claims: each claim ✓ Verified or an amber dot "Needs your OK" (the claims the flags name).
//   Finish: the last node closes into a tick, the view shows "Draft written in 5.0s · 7 pages · 5 claims checked" for
//   600ms, then the whole thing collapses (300ms) and onDone fires; the draft fades in (DraftStep).
// The clock runs from startedAt (the workspace keeps it), so reopening the panel mid-run shows the same moment. failAt
// stops at that step with an error line and Retry; hold stops the clock (?co=gen-hold, ?co=gen-hold-N). Motion:
// transforms and opacity, nothing over 300ms per element. Reduced motion: no streaming, straight to the draft.
// live: { pages: [{ domain, title }], formats: FORMATS, competitors: [{ domain, name, rank, format }], outline:
// draftOutline(), claims: [{ id, text, ok }] } (ok = verified; else needs your OK)
import { useEffect, useRef, useState } from 'react'
import { Check, RotateCw, X } from 'lucide-react'
import { LogoPlate } from '../parts'
import { inkBtn } from '../../../components/tool/ToolPage'
import { genElapsed, genProgress, genSummary } from './model'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const SHOW_SUMMARY = 600
const COLLAPSE = 300
const ROW = 'grid min-h-11 items-center gap-x-3 border-b border-[var(--div)] py-2'
const ROW_IN = 'motion-safe:animate-[co-row-in_200ms_ease-out_both]'

export default function Generating({ steps, failAt = -1, onDone, onRetry, live, hold = false, startedAt = null }) {
  const [elapsed, setElapsed] = useState(() => genElapsed(startedAt, performance.now(), { hold }))
  const [finished, setFinished] = useState(false) // the summary line shows
  const [closing, setClosing] = useState(false)
  const done = useRef(false)
  const p = genProgress(steps, elapsed, failAt)

  useEffect(() => {
    if (reduced()) { onDone(genSummary(steps)); return undefined }
    let raf
    const timers = []
    const t0 = startedAt ?? performance.now()
    const tick = (now) => {
      const e = genElapsed(t0, now, { hold })
      setElapsed(e)
      const s = genProgress(steps, e, failAt)
      if (s.failed) return
      if (s.done) {
        if (!done.current) {
          done.current = true
          setFinished(true)
          timers.push(setTimeout(() => setClosing(true), SHOW_SUMMARY))
          timers.push(setTimeout(() => onDone(genSummary(steps)), SHOW_SUMMARY + COLLAPSE))
        }
        return
      }
      if (hold !== false && e >= genElapsed(0, Infinity, { hold })) return
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout) }
  }, [startedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const n = steps.length
  const finishedRows = p.rows.filter((r) => r.status === 'done').length
  const at = p.rows.findIndex((r) => r.status === 'current' || r.status === 'failed')
  const view = finished ? 'done' : at < 0 ? steps[n - 1].id : steps[at].id
  return (
    <div aria-live="polite">
      <div className="grid transition-[grid-template-rows,opacity] duration-300 ease-out" style={{ gridTemplateRows: closing ? '0fr' : '1fr', opacity: closing ? 0 : 1 }}>
        <div className="min-h-0 overflow-hidden">
          {p.failed && <h3 className="mb-3 text-[18px] leading-[26px] font-semibold text-negative">Draft stopped</h3>}
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            {/* the rail */}
            <ol className="relative self-start">
              <span aria-hidden className="absolute left-[9px] top-6 bottom-6 w-[2px] rounded-full bg-[var(--color-line)]">
                <span className="absolute inset-x-0 top-0 rounded-full bg-ink transition-[height] duration-300 ease-out" style={{ height: `${n > 1 ? (Math.min(finishedRows, n - 1) / (n - 1)) * 100 : 0}%` }} />
              </span>
              {steps.map((s, i) => {
                const r = p.rows[i]
                return (
                  <li key={s.id} className="relative grid min-h-12 grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-3" aria-current={r.status === 'current' ? 'step' : undefined}>
                    <Node status={r.status} />
                    <span className={`text-[15px] leading-[22px] transition-colors duration-200 ${r.status === 'current' ? 'font-semibold text-ink' : r.status === 'upcoming' ? 'font-medium text-stone-500' : 'font-medium text-stone-900'}`}>{s.label}</span>
                    <span className={`text-right text-[13px] leading-[18px] tabular-nums ${r.status === 'failed' ? 'text-negative' : 'text-stone-500'}`}>{r.status === 'upcoming' ? '' : s.count(r.n)}</span>
                  </li>
                )
              })}
            </ol>
            {/* the live view */}
            <div className="min-w-0 lg:border-l lg:border-line lg:pl-8">
              <Fade k={view}>
                {view === 'done' ? <Finished text={genSummary(steps)} />
                  : view === 'read' ? <Reading pages={live.pages} r={p.rows[0]} />
                    : view === 'formats' ? <Formats formats={live.formats} r={p.rows[1]} />
                      : view === 'competitors' ? <Competitors items={live.competitors} r={p.rows[2]} />
                        : view === 'write' ? <Outline items={live.outline} r={p.rows[3]} />
                          : <Claims items={live.claims} r={p.rows[4]} />}
              </Fade>
              {p.failed && (
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--div)] pt-3">
                  <p className="text-[14px] leading-5 text-stone-700"><span className="text-negative">{steps[failAt].label} stopped</span>: the writer didn’t answer in time</p>
                  <button type="button" onClick={onRetry} className={inkBtn}><RotateCw size={15} aria-hidden />Retry</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// a crossfade keyed on the view (200ms): the outgoing view, as last drawn, fades out over the incoming one
function Fade({ k, children }) {
  const last = useRef(children)
  const [out, setOut] = useState(null) // { k, node }
  const prev = useRef(k)
  if (prev.current !== k) {
    const node = last.current
    const was = prev.current
    prev.current = k
    setOut({ k: was, node })
  }
  last.current = children
  useEffect(() => {
    if (!out) return undefined
    const t = setTimeout(() => setOut(null), 210)
    return () => clearTimeout(t)
  }, [out])
  return (
    <div className="grid">
      {out && <div key={`out-${out.k}`} aria-hidden style={{ gridArea: '1 / 1', animation: 'sent-fade-out 200ms ease-out both' }}>{out.node}</div>}
      <div key={k} style={{ gridArea: '1 / 1', animation: out ? 'fade-in 200ms ease-out both' : undefined }}>{children}</div>
    </div>
  )
}

const ViewHead = ({ children }) => <p className="pb-2 text-[13px] leading-[18px] text-stone-500">{children}</p>
const Tick = () => <Check size={15} strokeWidth={2.5} className="text-[var(--rep-up-fg)] motion-safe:animate-[co-pop_200ms_ease-out_both]" aria-label="Done" />
const Spin = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" className="motion-safe:animate-spin" style={{ animationDuration: '900ms' }} aria-label="Working">
    <circle cx="10" cy="10" r="8" fill="none" stroke="color-mix(in srgb, var(--co-a) 22%, transparent)" strokeWidth="2.5" />
    <circle cx="10" cy="10" r="8" fill="none" stroke="var(--co-a)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="14 60" />
  </svg>
)

// 1: the pages stream in; each ticked once read (the one being read turns)
function Reading({ pages, r }) {
  const shown = pages.slice(0, Math.min(pages.length, r.n + (r.status === 'current' ? 1 : 0)))
  return (
    <div>
      <ViewHead>Reading the pages AI cites for this prompt</ViewHead>
      <ul>
        {shown.map((x, i) => (
          <li key={x.domain} className={`${ROW} ${ROW_IN} grid-cols-[20px_150px_minmax(0,1fr)_16px]`}>
            <LogoPlate domain={x.domain} />
            <span className="truncate text-[13px] leading-[18px] text-stone-500">{x.domain}</span>
            <span className="truncate text-[15px] leading-[22px] font-medium text-stone-900">{x.title}</span>
            {i < r.n ? <Tick /> : <Spin />}
          </li>
        ))}
      </ul>
    </div>
  )
}

// 2: the formats, each filled in with the competitors that have it and whether your draft covers it
function Formats({ formats, r }) {
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_88px] gap-x-3 pb-2 text-[13px] leading-[18px] text-stone-500">
        <span>Format</span><span>Competitors with it</span><span className="text-right">Your draft</span>
      </div>
      <ul>
        {formats.map((f, i) => {
          const filled = i < r.n
          return (
            <li key={f.type} className={`${ROW} grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_88px]`}>
              <span className={`text-[15px] leading-[22px] font-medium transition-colors duration-200 ${filled ? 'text-stone-900' : 'text-stone-500'}`}>{f.type}</span>
              <span className="flex min-h-5 items-center gap-1">
                {filled ? (f.competitors.length ? f.competitors.map((d, j) => <span key={d} className={ROW_IN} style={{ animationDelay: `${j * 60}ms` }}><LogoPlate domain={d} /></span>) : <span className={`text-[13px] text-stone-500 ${ROW_IN}`}>None</span>)
                  : i === r.n ? <Spin /> : null}
              </span>
              <span className="flex justify-end">
                {filled && (f.covered
                  ? <span className={`flex items-center gap-1 text-[13px] text-stone-700 ${ROW_IN}`}><Check size={15} strokeWidth={2.5} className="text-[var(--rep-up-fg)]" aria-hidden />Covered</span>
                  : <span className={`flex items-center gap-1 text-[13px] text-stone-500 ${ROW_IN}`}><X size={15} aria-hidden />Not yet</span>)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// 3: the competitors to beat
function Competitors({ items, r }) {
  const shown = items.slice(0, Math.min(items.length, r.n + (r.status === 'current' ? 1 : 0)))
  return (
    <div>
      <ViewHead>The pages to beat</ViewHead>
      <ul>
        {shown.map((c, i) => (
          <li key={c.domain} className={`${ROW} ${ROW_IN} grid-cols-[28px_minmax(0,1fr)_auto_auto_16px]`}>
            <LogoPlate domain={c.domain} name={c.name} size={28} logoClass="h-4 w-4" />
            <span className="truncate text-[15px] leading-[22px] font-medium text-stone-900">{c.name}</span>
            <span className="text-[13px] leading-[18px] tabular-nums text-stone-700">{c.rank}</span>
            <span className="text-[13px] leading-[18px] text-stone-500">wins with {c.format}</span>
            {i < r.n ? <Tick /> : <Spin />}
          </li>
        ))}
      </ul>
    </div>
  )
}

// 4: the outline, heading by heading, a caret on the one being typed
function Outline({ items, r }) {
  const pos = r.status === 'done' ? items.length : r.frac * items.length // sections written, fractional
  const k = Math.floor(pos)
  return (
    <div>
      <ViewHead>The draft’s outline</ViewHead>
      <ol>
        {items.slice(0, Math.min(items.length, k + 1)).map((h, i) => {
          const typing = i === k && r.status === 'current'
          const text = typing ? h.text.slice(0, Math.max(1, Math.round((pos - k) * h.text.length))) : h.text
          return (
            <li key={h.id} className={`flex min-h-10 items-center gap-3 ${ROW_IN} ${h.h1 ? 'pb-1' : 'border-b border-[var(--div)]'}`}>
              {!h.h1 && <span className="w-6 shrink-0 text-[12px] leading-4 tabular-nums text-stone-400">H2</span>}
              <span className={h.h1 ? 'text-[20px] leading-7 font-semibold text-stone-900' : 'text-[15px] leading-[22px] font-medium text-stone-900'}>
                {text}{typing && <span aria-hidden className="co-caret ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-[var(--co-a)]" />}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// 5: the claims, checked one by one: verified, or needs your OK (the ones the flags name)
function Claims({ items, r }) {
  return (
    <div>
      <ViewHead>Checking each claim against the sources</ViewHead>
      <ul>
        {items.map((c, i) => {
          const checked = i < r.n || r.status === 'done'
          return (
            <li key={c.id} className={`${ROW} grid-cols-[minmax(0,1fr)_128px]`}>
              <span className={`truncate text-[15px] leading-[22px] transition-colors duration-200 ${checked || i === r.n ? 'text-stone-900' : 'text-stone-500'}`}>{c.text}</span>
              <span className="flex items-center justify-end gap-1.5 text-[13px] leading-[18px]">
                {checked ? (c.ok
                  ? <span className={`flex items-center gap-1.5 text-stone-700 ${ROW_IN}`}><Check size={15} strokeWidth={2.5} className="text-[var(--rep-up-fg)]" aria-hidden />Verified</span>
                  : <span className={`flex items-center gap-1.5 text-stone-700 ${ROW_IN}`}><span aria-hidden className="h-2 w-2 rounded-full bg-[var(--caution)]" />Needs your OK</span>)
                  : i === r.n ? <span className="flex items-center gap-1.5 text-stone-500"><Spin />Checking</span> : null}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// the finish line, for 600ms before the draft
function Finished({ text }) {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <p className="flex items-center gap-2.5 text-[15px] leading-[22px] font-medium text-stone-900 motion-safe:animate-[co-pop_240ms_ease-out_both]">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-ink"><Check size={14} strokeWidth={3} className="text-on-ink" aria-hidden /></span>
        <span className="tabular-nums">{text}</span>
      </p>
    </div>
  )
}

// the line the checklist collapses into, over the draft
export function GenSummary({ text }) {
  return (
    <p className="flex items-center gap-2 text-[13px] leading-[18px] text-stone-500 motion-safe:animate-[fade-in_200ms_ease-out]">
      <span className="grid h-4 w-4 place-items-center rounded-full bg-ink"><Check size={10} strokeWidth={3.5} className="text-on-ink" aria-hidden /></span>
      <span className="tabular-nums">{text}</span>
    </p>
  )
}

// done = an ink node whose tick draws itself (250ms) · current = an indigo ring turning with a soft pulse · failed = red
// cross · upcoming = a hollow --line-strong ring
function Node({ status }) {
  if (status === 'done') {
    return (
      <span className="relative z-[1] grid h-5 w-5 place-items-center rounded-full bg-ink">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M2.5 6.3 4.9 8.6 9.5 3.6" fill="none" stroke="var(--on-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          pathLength="1" strokeDasharray="1" style={reduced() ? undefined : { animation: 'sent-draw 250ms ease-out both' }} /></svg>
      </span>
    )
  }
  if (status === 'failed') return <span className="relative z-[1] grid h-5 w-5 place-items-center rounded-full bg-negative"><X size={12} strokeWidth={3} className="text-[var(--color-surface)]" aria-hidden /></span>
  if (status === 'current') {
    return (
      <span className="relative z-[1] grid h-5 w-5 place-items-center rounded-full bg-surface">
        <span aria-hidden className="co-pulse absolute inset-0 rounded-full bg-[var(--co-a)]" />
        <svg width="20" height="20" viewBox="0 0 20 20" className="relative motion-safe:animate-spin" style={{ animationDuration: '900ms' }} aria-hidden>
          <circle cx="10" cy="10" r="8.5" fill="var(--color-surface)" stroke="color-mix(in srgb, var(--co-a) 30%, transparent)" strokeWidth="2.5" />
          <circle cx="10" cy="10" r="8.5" fill="none" stroke="var(--co-a)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="18 60" />
        </svg>
      </span>
    )
  }
  return <span className="relative z-[1] h-5 w-5 rounded-full border-2 border-[var(--color-line-strong)] bg-surface" aria-hidden />
}
