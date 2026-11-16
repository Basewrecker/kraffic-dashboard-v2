// Opportunities → Content, the Verify step (owner, 2026-11-05; ported from the app's components/mock-overview/
// content-verify.jsx): between Copy & publish and Publish & track. It runs the publish check (own domain only, 60% of
// the key sentences = published) as soon as it opens, then shows one of:
//   found (≥ 60%)       "Content found on your page", n of m key sentences; tracking has started → back to the list
//   partial (1–59%)     "Some of the content is there", the missing key sentences; Check again · Copy content again
//   notfound (0%)       "We couldn't find the new content yet", three likely reasons; Check again · Open page in CMS ·
//                       Check later (the daily automatic check keeps going for 14 days)
//   error               the page couldn't be opened, said plainly; Check again
// "Last checked <time>" on every result; Check again at most once per 30 seconds. The step's headline and its one
// primary button are the panel header's (Workspace BAR); this file is the step's body and the hook both share.
// The mock simulates the check (~1.6s, data/contentApp.js sampleCheck: ?co=verify-partial / verify-notfound / verify-error).
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { CrossFade } from '../../../components/ui/motion'
import { lineBtn } from '../../../components/tool/ToolPage'
import { sampleCheck, verifyStateOf, verifyWait } from '../../../data/contentApp'

const H = 'border-b border-line-strong pb-2 text-[17px] leading-6 font-semibold text-stone-900'
const META = 'text-[13px] leading-[18px] text-stone-500'
const LINES = ['Opening the page…', 'Looking for the new content…']
const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
export const checkedLabel = (at) => (at ? new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '')
const short = (t, n = 110) => (t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}…` : t)

// the step's state and actions, for the body and the panel header. auto: run the check once when nothing ran yet.
// Kept per prompt for the visit (a module map), so leaving the panel and coming back keeps the result.
const RUNS = new Map()
const CHECK_MS = 1600
export function useVerify(row, { auto = false } = {}) {
  const [run, setRun] = useState(() => RUNS.get(row.id) ?? null)
  const st = verifyStateOf(run)
  const [now, setNow] = useState(() => Date.now())
  const wait = verifyWait(st.at, now)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (!wait && st.kind !== 'running') return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [wait, st.kind])
  const start = () => {
    const next = { ...(run ?? {}), checking: true }
    RUNS.set(row.id, next); setRun(next)
    timer.current = setTimeout(() => { const done = { checking: false, check: sampleCheck(), at: Date.now() }; RUNS.set(row.id, done); setRun(done); setNow(Date.now()) }, CHECK_MS)
  }
  const started = useRef(false)
  useEffect(() => {
    if (auto && st.kind === 'idle' && !started.current) { started.current = true; start() }
  }, [auto, st.kind]) // eslint-disable-line react-hooks/exhaustive-deps
  const check = () => { if (!verifyWait(st.at) && st.kind !== 'running') { setNow(Date.now()); start() } }
  return { ...st, wait, check }
}

// cms: { label, href } | null (lib/content-cms.js cmsLinkFor) · onCopy: Copy content again · onLater: Check later
export default function VerifyStep({ v, cms = null, onCopy, onLater }) {
  const [t0] = useState(() => performance.now())
  const [, tick] = useState(0)
  useEffect(() => {
    if (v.kind !== 'running' && v.kind !== 'idle') return undefined
    const id = setInterval(() => tick((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [v.kind])
  if (v.kind === 'running' || v.kind === 'idle') {
    const e = performance.now() - t0
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-3 border-t border-[var(--div)] pt-3 text-[14px] leading-5 text-stone-600" data-verify="running">
        <span className="min-w-0 flex-1"><CrossFade k={e >= 1500 ? 1 : 0} ms={250}><span className="block">{LINES[e >= 1500 ? 1 : 0]}</span></CrossFade></span>
        <span className="shrink-0 tabular-nums text-stone-500" aria-label={`Elapsed ${clock(e)}`}>{clock(e)}</span>
      </div>
    )
  }
  const again = (
    <button type="button" onClick={v.check} disabled={v.wait > 0} className={lineBtn}>
      {v.wait > 0 ? `Check again in ${Math.ceil(v.wait / 1000)}s` : 'Check again'}
    </button>
  )
  const last = v.at ? <p className={`mt-4 ${META}`} data-last-checked>Last checked {checkedLabel(v.at)}</p> : null
  if (v.kind === 'found') {
    return (
      <section data-verify="found">
        <h3 className={H}>Content found on your page</h3>
        {v.total ? <p className="mt-3 text-[15px] leading-[22px] tabular-nums text-stone-700">{v.found} of {v.total} key sentences found</p> : null}
        <p className={`mt-1 ${META}`}>Tracking has started: the next 4 syncs show whether the engines pick it up.</p>
        {last}
      </section>
    )
  }
  if (v.kind === 'partial') {
    return (
      <section data-verify="partial">
        <h3 className={H}>Some of the content is there</h3>
        <p className="mt-3 text-[15px] leading-[22px] tabular-nums text-stone-700">{v.found} of {v.total} key sentences found. Still missing:</p>
        <ul className="mt-2">
          {v.missing.map((m) => <li key={m} className="border-b border-[var(--div)] py-2 text-[14px] leading-5 text-stone-800" title={m}>{short(m)}</li>)}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2">{again}<button type="button" onClick={onCopy} className={lineBtn}>Copy content again</button></div>
        {last}
      </section>
    )
  }
  if (v.kind === 'notfound') {
    return (
      <section data-verify="notfound">
        <h3 className={H}>We couldn’t find the new content yet</h3>
        <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-[14px] leading-5 text-stone-700">
          <li>It isn’t published yet (still a draft in your CMS).</li>
          <li>It was pasted on a different page.</li>
          <li>The site’s cache hasn’t refreshed yet.</li>
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {again}
          {cms && <a href={cms.href} target="_blank" rel="noopener noreferrer" className={lineBtn}>{cms.label}<ArrowUpRight size={14} aria-hidden /></a>}
          <button type="button" onClick={onLater} className={lineBtn}>Check later</button>
        </div>
        <p className={`mt-2 ${META}`}>Check later: we check the page once a day for 14 days and start tracking when it’s there.</p>
        {last}
      </section>
    )
  }
  return (
    <section data-verify="error">
      <h3 className={H}>Your page couldn’t be opened</h3>
      <p className="mt-3 text-[15px] leading-[22px] text-stone-700">{v.why}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">{again}</div>
      {last}
    </section>
  )
}
