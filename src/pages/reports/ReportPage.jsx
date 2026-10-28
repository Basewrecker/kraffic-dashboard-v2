import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowDown, ArrowUp, CalendarClock, Check, ChevronDown, Copy, Download, HelpCircle, Link2, Loader2, MoreHorizontal, Printer, X } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Segmented from '../../components/dashboard/Segmented'
import Switch from '../../components/ui/Switch'
import ActionMenu from '../../components/audit/ActionMenu'
import { useToast } from '../../components/dashboard/overlays'
import { linkClick, navigate } from '../../router'
import { buildReport, refine, reportById, resolveOpts, stepsFor } from '../../data/reports'
import PillComposer from './PillComposer'
import { Block, WIDE, blockName, explainFor } from './blocks'
import { DotAssemble } from './DotField'
import { brandOf, fromQuery, inkBtn, lineBtn, t2, t3, toQuery } from './parts'

const STEP_MS = 900
const HINTS = ['Make it shorter', 'Add Gemini', 'Focus on Longbridge', 'Rewrite for a client']
const FIXED = new Set(['header', 'scoreline', 'hero', 'sources']) // the fixed rhythm: explain only
const FIRST_MOVABLE = 3 // after header, scoreline, hero
// sections side by side on wide screens: two narrow sections next to each other share a row
function spans(blocks) {
  const half = (b) => b?.type === 'section' && !WIDE.has(b.data.visual.kind)
  const out = blocks.map(() => 2)
  for (let i = 0; i < blocks.length - 1; i++) if (out[i] === 2 && half(blocks[i]) && half(blocks[i + 1])) { out[i] = 1; out[i + 1] = 1; i++ }
  return out
}
const numbers = (blocks) => { let n = 0; return blocks.map((b) => (b.type === 'section' ? ++n : null)) }

// /reports/new?… writes a report (the steps tick off, then the blocks fade in) · /reports/view?… and /reports/<id> show one.
// ?mock=generating (held on step 3) · failed · refining (held mid-update) · ?print=1 the A4 view
export default function ReportPage({ id }) {
  const q = new URLSearchParams(window.location.search)
  const init = useRef(null)
  if (!init.current) {
    const saved = id !== 'new' && id !== 'view' ? reportById(id) : null
    init.current = saved ? { prompt: saved.prompt, opts: saved.opts, title: saved.title }
      : id === 'new' || id === 'view' ? { ...fromQuery(), title: null } : { missing: true }
  }
  if (init.current.missing) {
    return (
      <div className="mx-auto w-full max-w-[860px] rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="text-[15px] font-semibold text-stone-900">This report doesn’t exist any more</p>
        <p className={`mt-1 text-[13px] ${t2}`}>It may have been deleted. <a href="/reports/all" onClick={linkClick('/reports/all')} className="font-medium text-stone-900 underline underline-offset-4">All reports</a></p>
      </div>
    )
  }
  if (q.get('print') === '1') return <PrintView prompt={init.current.prompt} opts={init.current.opts} title={init.current.title} />
  return <Report id={id} init={init.current} mock={q.get('mock')} />
}

function makeVersion(n, opts, prompt, change, title) {
  const r = buildReport(opts, prompt)
  return { n, opts: r.opts, change, title: title ?? r.title, blocks: r.ok ? r.blocks : [], edited: false }
}

function Report({ id, init, mock }) {
  const writing = id === 'new'
  const [prompt, setPrompt] = useState(init.prompt)
  const [opts, setOpts] = useState(init.opts)
  const [phase, setPhase] = useState(writing ? 'generating' : 'done')
  const [step, setStep] = useState(0)
  const [reveal, setReveal] = useState(false)
  const [versions, setVersions] = useState(() => {
    if (writing) return []
    const v1 = makeVersion(1, init.opts, init.prompt, 'Original', init.title)
    return mock === 'refining' ? [v1] : [v1]
  })
  const [cur, setCur] = useState(0)
  const [refining, setRefining] = useState(mock === 'refining' && !writing ? 'Make it shorter' : null)
  const [ask, setAsk] = useState('')
  const [askNote, setAskNote] = useState('')
  const [explain, setExplain] = useState(null)
  const [scheduling, setScheduling] = useState(false)
  const [toastNode, toast] = useToast({ position: 'center' })
  const timer = useRef(null)
  const run = useRef(0)
  const heroRef = useRef(null)
  const pillRef = useRef(null)
  // the dots that become the hero while it's written (they fade out under the finished report)
  const [dots, setDots] = useState(writing)
  useEffect(() => {
    if (phase === 'generating') return undefined
    const t = setTimeout(() => setDots(false), 700)
    return () => clearTimeout(t)
  }, [phase])
  const steps = stepsFor(resolveOpts(init.opts, init.prompt))
  const built = buildReport(init.opts, init.prompt)

  // writing: tick the steps, then show the report, and move the URL to the report (the sidebar then shows All reports)
  const start = () => {
    const me = ++run.current
    clearTimeout(timer.current)
    setStep(0)
    if (!built.ok) { setPhase('thin'); return }
    setPhase('generating')
    setDots(true)
    if (mock === 'generating') { setStep(2); return }
    const tick = (n) => {
      timer.current = setTimeout(() => {
        if (run.current !== me) return
        if (mock === 'failed' && n === 3) { setStep(3); setPhase('failed'); return }
        if (n < steps.length) { setStep(n + 1); tick(n + 1); return }
        setVersions([makeVersion(1, init.opts, init.prompt, 'Original')])
        setCur(0)
        setReveal(true)
        setPhase('done')
        window.history.replaceState(null, '', `/reports/view?${toQuery(init.opts, init.prompt)}`)
        window.dispatchEvent(new Event('app:navigate'))
      }, n === steps.length ? 350 : STEP_MS)
    }
    tick(0)
  }
  useEffect(() => {
    if (writing) start()
    return () => { run.current++; clearTimeout(timer.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const cancel = () => { run.current++; clearTimeout(timer.current); setPhase('cancelled') }

  const v = versions[cur]
  const send = (final) => navigate(`/reports/new?${toQuery(final ?? opts, prompt.trim())}`)
  const setBlocks = (blocks) => setVersions((vs) => vs.map((x, i) => (i === cur ? { ...x, blocks, edited: true } : x)))
  const move = (bid, dir) => {
    const bs = v.blocks
    const i = bs.findIndex((b) => b.id === bid)
    const j = i + dir
    if (j < FIRST_MOVABLE || j > bs.length - 2) return // header, scoreline and hero stay first; sources last
    const n = [...bs];
    [n[i], n[j]] = [n[j], n[i]]
    setBlocks(n)
  }
  const remove = (bid) => {
    const before = v.blocks
    setBlocks(before.filter((b) => b.id !== bid))
    if (explain === bid) setExplain(null)
    toast(`Removed “${blockName(before.find((b) => b.id === bid))}”`, { action: { label: 'Undo', onClick: () => setBlocks(before) } })
  }

  // refining: one instruction → a new version, written in place (v2, v3…)
  const submitAsk = (text = ask) => {
    const t = text.trim()
    if (!t || refining) return
    const r = refine(v.opts, t)
    if (!r) { setAskNote('That isn’t something a report can change yet. It can change the length, the audience, the engines, the period or the competitors.'); return }
    setAskNote('')
    setAsk('')
    setRefining(t)
    const nextN = versions.length + 1
    setTimeout(() => {
      setVersions((vs) => [...vs, makeVersion(nextN, r.opts, init.prompt, r.change, v.title)])
      setCur(nextN - 1)
      setRefining(null)
      setReveal(true)
      toast(`${r.change}: version ${nextN}`)
    }, 1400)
  }

  const shareUrl = () => `${window.location.origin}${id !== 'new' && id !== 'view' ? `/reports/${id}` : `/reports/view?${toQuery(v?.opts ?? init.opts, init.prompt)}`}`
  const copyLink = () => { try { navigator.clipboard?.writeText(shareUrl()) } catch { /* no clipboard: the toast still says what a share link does */ } toast('Link copied. Anyone at PTA Agency with the link can open it.') }
  const pdf = () => window.open(`/reports/view?${toQuery(v.opts, init.prompt)}&print=1`, '_blank', 'noopener')
  const actions = [
    { label: 'Download PDF', icon: Download, onClick: pdf },
    { label: 'Copy share link', icon: Link2, onClick: copyLink },
    { label: 'Schedule this report', icon: CalendarClock, onClick: () => setScheduling(true) },
    { label: 'Duplicate', icon: Copy, onClick: () => toast(`Duplicated as “${v.title} (copy)” in All reports`) },
  ]

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4">
      <PillComposer ref={pillRef} suggest={false} prompt={prompt} setPrompt={setPrompt} opts={opts} setOpts={setOpts} onSend={send} busy={phase === 'generating'} />

      {phase === 'generating' && <Generating steps={steps} step={step} kind={built.kind} heroRef={heroRef} onCancel={cancel} />}
      {dots && built.ok && <DotAssemble brandId={built.opts.brand} kind={built.kind} targetRef={heroRef} fromRef={pillRef} done={phase !== 'generating'} />}
      {phase === 'failed' && (
        <StateCard icon={<AlertCircle size={18} className="text-negative" aria-hidden />} title="The report couldn’t be written"
          actions={<><button type="button" onClick={start} className={inkBtn}>Try again</button><a href="/reports" onClick={linkClick('/reports')} className={lineBtn}>Back to New report</a></>}>
          Writing the summary timed out after your data was read. Your data is fine and nothing was saved. Trying again usually works.
          <Steps steps={steps} step={3} failed />
        </StateCard>
      )}
      {phase === 'cancelled' && (
        <StateCard title="Stopped" actions={<><button type="button" onClick={start} className={inkBtn}>Start again</button><button type="button" onClick={() => document.getElementById('report-q')?.focus()} className={lineBtn}>Edit the question</button></>}>
          Nothing was saved. Change the question or the chips above, then send it again.
        </StateCard>
      )}
      {phase === 'thin' && <NotEnough r={built} />}

      {phase === 'done' && v && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <VersionMenu versions={versions} cur={cur} setCur={(i) => { setCur(i); setReveal(false) }} />
            <div className="flex items-center gap-1.5">
              {actions.map((a) => (
                <button key={a.label} type="button" onClick={a.onClick} aria-label={a.label} title={a.label} className={`${lineBtn} max-lg:w-9 max-lg:px-0`}>
                  <a.icon size={14} aria-hidden /><span className="max-lg:sr-only">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
          {refining && (
            <div role="status" className={`flex items-center gap-2 text-[13px] ${t2}`}>
              <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />Updating the report: {refining.charAt(0).toLowerCase() + refining.slice(1)}…
            </div>
          )}
          <article aria-label={v.title} aria-busy={!!refining} className={`${ARTICLE} transition-opacity duration-300 ${refining ? 'opacity-40' : ''}`}>
            {v.blocks.map((b, i) => (
              <BlockFrame key={`${v.n}-${b.id}`} b={b} i={i} n={v.blocks.length} span={spans(v.blocks)[i]} num={numbers(v.blocks)[i]} reveal={reveal} explainOpen={explain === b.id}
                onExplain={() => setExplain((e) => (e === b.id ? null : b.id))} onUp={() => move(b.id, -1)} onDown={() => move(b.id, 1)} onRemove={() => remove(b.id)}
                explainText={explainFor(b)}>
                <Block block={b} title={v.title} n={numbers(v.blocks)[i]} />
              </BlockFrame>
            ))}
          </article>
          <FollowUp value={ask} setValue={setAsk} onSend={submitAsk} note={askNote} busy={!!refining} />
        </>
      )}
      <ScheduleModal open={scheduling} onClose={() => setScheduling(false)} title={v?.title} brand={brandOf(v?.opts.brand ?? init.opts.brand)?.name}
        onSave={(line) => { setScheduling(false); toast(`Scheduled ${line}`, { action: { label: 'View', onClick: () => navigate('/reports/scheduled') } }) }} />
      {toastNode}
    </div>
  )
}

const ARTICLE = 'grid grid-cols-1 gap-x-12 gap-y-10 rounded-xl border border-line bg-surface px-12 py-10 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)] lg:grid-cols-2 max-md:gap-y-9 max-md:px-5 max-md:py-7'

// ---- generating: the steps tick off in a line; under them the report's frame, where the dots (DotAssemble) settle
// into the hero's place; then the report replaces it, section by section. Cancel stops it.
const HERO_H = { weekly: 248, ceo: 280, rival: 330, content: 270 }
function Generating({ steps, step, kind, heroRef, onCancel }) {
  const bar = 'block rounded-md bg-tint'
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ol aria-live="polite" aria-label="Writing your report" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {steps.map((s, i) => {
            const done = i < step
            const now = i === step
            return (
              <li key={s} className={`flex items-center gap-2 text-[13px] leading-5 transition-colors duration-200 ${done ? 'text-stone-700' : now ? 'font-medium text-stone-900' : 'text-stone-500'}`}>
                <span className="grid h-4 w-4 shrink-0 place-items-center" aria-hidden>
                  {done ? <span className="grid h-4 w-4 place-items-center rounded-full bg-ink motion-safe:animate-[icon-pop_200ms_ease-out]"><Check size={10} strokeWidth={3} style={{ color: 'var(--line-check)' }} /></span>
                    : now ? <Loader2 size={14} className="animate-spin text-stone-700 motion-reduce:animate-none" />
                      : <span className="h-3 w-3 rounded-full border border-stone-300" />}
                </span>
                {s}{now ? '…' : ''}<span className="sr-only">{done ? ', done' : now ? ', in progress' : ', waiting'}</span>
              </li>
            )
          })}
        </ol>
        <button type="button" onClick={onCancel} className={lineBtn}>Cancel</button>
      </div>
      <article aria-hidden className={ARTICLE}>
        <div className="flex flex-col gap-3 lg:col-span-2">
          <span className={`${bar} h-3 w-60 max-w-full`} />
          <span className={`${bar} h-6 w-24 rounded-full`} />
          <span className={`${bar} h-7 w-[86%]`} />
          <span className={`${bar} h-7 w-[58%]`} />
        </div>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 lg:col-span-2">
          {[0, 1, 2, 3].map((i) => <span key={i} className="flex flex-col gap-2"><span className={`${bar} h-3 w-20`} /><span className={`${bar} h-7 w-14`} /><span className={`${bar} h-4 w-full opacity-60`} /></span>)}
        </div>
        <div ref={heroRef} className="lg:col-span-2" style={{ height: HERO_H[kind] ?? 260 }} />
        {[0, 1].map((i) => <span key={i} className="flex flex-col gap-2.5"><span className={`${bar} h-4 w-40`} /><span className={`${bar} h-3 w-[90%] opacity-60`} /><span className={`${bar} h-24 w-full opacity-40`} /></span>)}
      </article>
    </>
  )
}
function Steps({ steps, step, failed = false }) {
  return (
    <ol className="mt-4 flex flex-col gap-2.5" aria-live="polite">
      {steps.map((s, i) => {
        const done = i < step
        const now = i === step
        return (
          <li key={s} className={`flex items-center gap-2.5 text-[14px] leading-5 transition-colors duration-200 ${done || now ? 'text-stone-900' : 'text-stone-500'}`}>
            <span className="grid h-5 w-5 shrink-0 place-items-center" aria-hidden>
              {done ? <span className="grid h-5 w-5 place-items-center rounded-full bg-ink motion-safe:animate-[icon-pop_200ms_ease-out]"><Check size={12} strokeWidth={3} style={{ color: 'var(--line-check)' }} /></span>
                : now && failed ? <X size={16} className="text-negative" />
                  : now ? <Loader2 size={16} className="animate-spin text-stone-700 motion-reduce:animate-none" />
                    : <span className="h-4 w-4 rounded-full border border-stone-300" />}
            </span>
            <span className={now && failed ? 'text-negative' : undefined}>{s}{now && !failed ? '…' : ''}</span>
            <span className="sr-only">{done ? ', done' : now ? (failed ? ', failed' : ', in progress') : ', waiting'}</span>
          </li>
        )
      })}
    </ol>
  )
}
function StateCard({ icon, title, actions, children }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 max-md:p-4">
      <p className="flex items-center gap-2 text-[15px] leading-5 font-semibold text-stone-900">{icon}{title}</p>
      <div className={`mt-1 text-[13px] leading-[18px] ${t2}`}>{children}</div>
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
function NotEnough({ r }) {
  const had = r.syncs === 0 ? 'hasn’t had a sync yet' : r.syncs === 1 ? 'has had one sync' : `has ${r.syncs} syncs in this period`
  return (
    <StateCard title="Not enough data for a report yet"
      actions={<><a href="/tracking" onClick={linkClick('/tracking')} className={inkBtn}>Open Tracking</a><a href="/reports" onClick={linkClick('/reports')} className={lineBtn}>Back to New report</a></>}>
      {r.brand} {had}. A report compares at least two syncs, so nothing in it could be measured yet, and Kraffic doesn’t estimate.
      {r.nextSync ? ` The next sync is ${r.nextSync}; you can write a report after it.` : ' Run the first sync from Tracking.'}
    </StateCard>
  )
}

// ---- a block on the page: on hover (or focus) small actions: move up / down, explain this, remove
function BlockFrame({ b, i, n, span = 2, reveal, explainOpen, explainText, onExplain, onUp, onDown, onRemove, children }) {
  const fixed = FIXED.has(b.type)
  const name = blockName(b)
  const iconBtn = 'grid h-7 w-7 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-30'
  return (
    <div role="group" aria-label={name} className={`group/block relative -mx-3 min-w-0 rounded-xl px-3 py-2 ${span === 2 ? 'lg:col-span-2' : ''} transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--ink)_2.5%,transparent)] focus-within:bg-[color-mix(in_srgb,var(--ink)_2.5%,transparent)] max-md:-mx-2 max-md:px-2 max-md:pr-9`}
      style={reveal ? { animation: `card-in 460ms cubic-bezier(.2,.8,.2,1) ${i * 130}ms both` } : undefined}>
      <div className="absolute -top-3.5 right-2 z-10 hidden items-center gap-0.5 rounded-lg border border-line bg-raised p-0.5 opacity-0 shadow-sm transition-opacity duration-150 group-hover/block:opacity-100 group-focus-within/block:opacity-100 md:flex">
        {!fixed && <button type="button" onClick={onUp} disabled={i <= FIRST_MOVABLE} aria-label={`Move “${name}” up`} title="Move up" className={iconBtn}><ArrowUp size={14} aria-hidden /></button>}
        {!fixed && <button type="button" onClick={onDown} disabled={i >= n - 2} aria-label={`Move “${name}” down`} title="Move down" className={iconBtn}><ArrowDown size={14} aria-hidden /></button>}
        <button type="button" onClick={onExplain} aria-expanded={explainOpen} className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[12px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><HelpCircle size={14} aria-hidden />Explain this</button>
        {!fixed && <button type="button" onClick={onRemove} aria-label={`Remove “${name}”`} title="Remove" className={iconBtn}><X size={14} aria-hidden /></button>}
      </div>
      <div className="absolute right-0 top-0 md:hidden">
        <ActionMenu label={`Actions for ${name}`} className="grid h-8 w-8 place-items-center rounded-md text-stone-500 outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus"
          items={[
            ...(fixed ? [] : [{ label: 'Move up', onClick: onUp }, { label: 'Move down', onClick: onDown }]),
            { label: 'Explain this', onClick: onExplain },
            ...(fixed ? [] : [{ label: 'Remove', onClick: onRemove, danger: true }]),
          ]}>
          <MoreHorizontal size={16} aria-hidden />
        </ActionMenu>
      </div>
      {children}
      {explainOpen && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-tint px-3 py-2.5 text-[13px] leading-[18px] text-stone-700 motion-safe:animate-[fade-in_150ms_ease-out]">
          <HelpCircle size={14} className="mt-0.5 shrink-0 text-stone-500" aria-hidden />
          <p className="min-w-0 flex-1"><span className="font-medium text-stone-900">How this was worked out. </span>{explainText}</p>
          <button type="button" onClick={onExplain} aria-label="Close the explanation" className="-m-1 grid h-6 w-6 shrink-0 place-items-center rounded text-stone-500 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><X size={13} aria-hidden /></button>
        </div>
      )}
    </div>
  )
}

// ---- versions: v1 is what was written; each change from the box under the report adds one
function VersionMenu({ versions, cur, setCur }) {
  const v = versions[cur]
  return (
    <ActionMenu label="Versions" align="left" heading="Versions"
      items={versions.map((x, i) => ({ label: `v${x.n} · ${x.change}${x.edited ? ' (edited)' : ''}`, checked: i === cur, onClick: () => setCur(i) }))}
      className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-lg px-2.5 text-small font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
      <span className="tabular-nums">v{v.n}</span>
      <span className={`max-w-[28ch] truncate font-normal ${t3}`}>{v.change}{v.edited ? ' · edited' : ''}</span>
      <ChevronDown size={13} className="shrink-0 text-stone-500" aria-hidden />
    </ActionMenu>
  )
}

// ---- refine: one instruction, and the report updates in place
function FollowUp({ value, setValue, onSend, note, busy }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface py-1.5 pl-4 pr-1.5 transition-shadow duration-150 focus-within:border-line-strong focus-within:shadow-[0_0_0_4px_var(--tint)]">
        <label htmlFor="refine" className="sr-only">Change this report</label>
        <input id="refine" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSend() } }}
          placeholder="Change this report: make it shorter, focus on a competitor…" disabled={busy}
          className="h-9 min-w-0 flex-1 bg-transparent text-[15px] text-stone-900 outline-none placeholder:text-stone-500 disabled:opacity-60" />
        <button type="button" onClick={() => onSend()} disabled={!value.trim() || busy} aria-label="Update the report"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-on-ink outline-none transition-opacity duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-30">
          <ArrowUp size={18} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      {note && <p className={`px-1 text-[13px] leading-[18px] ${t2}`} role="status">{note}</p>}
      <div className="flex flex-wrap gap-1.5">
        {HINTS.map((h) => (
          <button key={h} type="button" disabled={busy} onClick={() => onSend(h)}
            className="h-8 rounded-full border border-line px-3 text-[13px] text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50">{h}</button>
        ))}
      </div>
    </div>
  )
}

// ---- Schedule this report
function ScheduleModal({ open, onClose, onSave, title, brand }) {
  const [every, setEvery] = useState('week')
  const [day, setDay] = useState('Monday')
  const [time, setTime] = useState('9am')
  const [to, setTo] = useState('dana@financeofamerica.com, priya@financeofamerica.com')
  const [pdf, setPdf] = useState(true)
  const n = to.split(/[,\s]+/).filter((x) => x.includes('@')).length
  const when = every === 'month' ? `on the 1st of each month at ${time}` : `${every === '2weeks' ? 'every other' : 'every'} ${day} at ${time}`
  const field = 'mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-[14px] font-normal text-stone-900 outline-none focus:border-stone-400'
  return (
    <Modal open={open} onClose={onClose} title="Schedule this report" subtitle={`${title ?? 'This report'} for ${brand ?? 'this brand'}: written again from the latest sync each time, then emailed`}
      footer={(
        <>
          <span className={`min-w-0 flex-1 basis-[200px] text-[13px] ${t2}`}>{n ? `Sends ${when}, to ${n} ${n === 1 ? 'person' : 'people'}` : 'Add at least one email'}</span>
          <span className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg px-3 text-small font-medium text-stone-600 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Cancel</button>
            <button type="button" disabled={!n} onClick={() => onSave(`${when}, to ${n} ${n === 1 ? 'person' : 'people'}`)} className={inkBtn}>Schedule</button>
          </span>
        </>
      )}>
      <div className="flex flex-col gap-4">
        <div>
          <span className="text-[13px] font-medium text-stone-900">How often</span>
          <div className="mt-1"><Segmented label="How often" value={every} onChange={setEvery} options={[{ value: 'week', label: 'Weekly' }, { value: '2weeks', label: 'Every 2 weeks' }, { value: 'month', label: 'Monthly' }]} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {every !== 'month' && (
            <label className="text-[13px] font-medium text-stone-900">Day
              <select value={day} onChange={(e) => setDay(e.target.value)} className={field}>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((d) => <option key={d}>{d}</option>)}</select>
            </label>
          )}
          <label className="text-[13px] font-medium text-stone-900">Time
            <select value={time} onChange={(e) => setTime(e.target.value)} className={field}>{['8am', '9am', '10am', '12pm', '4pm'].map((d) => <option key={d}>{d}</option>)}</select>
          </label>
        </div>
        <label className="text-[13px] font-medium text-stone-900">Send to
          <textarea value={to} onChange={(e) => setTo(e.target.value)} rows={2} className={`${field} h-auto py-2 leading-5`} />
          <span className={`mt-1 block text-[12px] font-normal ${t3}`}>Emails, separated by commas. They don’t need a Kraffic account.</span>
        </label>
        <Switch checked={pdf} onChange={setPdf}>Attach the PDF</Switch>
      </div>
    </Modal>
  )
}

// ---- Print / PDF: an A4 sheet. One page when Length is One page (it says so if it doesn't fit)
function PrintView({ prompt, opts, title }) {
  const r = buildReport(opts, prompt)
  const sheet = useRef(null)
  const [over, setOver] = useState(false)
  useLayoutEffect(() => {
    const el = sheet.current
    if (!el) return
    const check = () => setOver(el.scrollHeight > el.clientHeight + 1)
    check()
    document.fonts?.ready.then(check)
  }, [])
  useEffect(() => { document.title = `${title ?? r.title} · PDF · Kraffic` }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // printing: always on light paper, whatever the app's theme
  const print = () => {
    const html = document.documentElement
    const prev = html.getAttribute('data-theme')
    html.setAttribute('data-theme', 'light')
    const back = () => { if (prev) html.setAttribute('data-theme', prev); else html.removeAttribute('data-theme'); window.removeEventListener('afterprint', back) }
    window.addEventListener('afterprint', back)
    window.print()
  }
  if (!r.ok) return <NotEnough r={r} />
  const one = r.opts.length === 'one'
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="print-hide flex w-full max-w-[794px] flex-wrap items-center justify-between gap-2">
        <p className={`text-[13px] ${over && one ? 'text-negative' : t2}`}>A4 · {one ? 'One page' : 'Detailed'}{over && one ? ' · doesn’t fit one page: remove a block, or ask for it shorter' : ''}</p>
        <div className="flex gap-2">
          <a href={`/reports/view?${toQuery(opts, prompt)}`} onClick={linkClick(`/reports/view?${toQuery(opts, prompt)}`)} className={lineBtn}>Back to the report</a>
          <button type="button" onClick={print} className={inkBtn}><Printer size={14} aria-hidden />Print or save as PDF</button>
        </div>
      </div>
      <div className="w-full overflow-x-auto">
        <div ref={sheet} className={`print-sheet mx-auto flex w-[210mm] flex-col gap-[6mm] bg-surface px-[14mm] py-[12mm] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_32px_-12px_rgba(0,0,0,0.18)] ${one ? 'h-[297mm] overflow-hidden' : 'min-h-[297mm]'}`}>
          <div className="flex flex-col gap-8" style={{ zoom: 0.62 }}>
            {r.blocks.map((b, i) => <Block key={b.id} block={b} title={title ?? r.title} n={numbers(r.blocks)[i]} />)}
          </div>
          <p className={`mt-auto text-[9px] ${t3}`}>Kraffic · {brandOf(r.opts.brand)?.name} · page 1 of 1</p>
        </div>
      </div>
    </div>
  )
}
