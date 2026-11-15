// Getting started, the board (mock only; owner, 2026-11-15). It opens from the sidebar's Getting started card as a wide
// sheet over a dimmed page, and replaces the list. The guide is built from the brand's own data (here: the mock's
// sample data): one step is shown large with a live preview of what it opens, and a trail of six frames along the
// bottom shows what each finished step produced. Words and rules: tour.js. Motion: motion.js.
//
//   sheet   820px, centred, 20px radius. Esc, a click outside or the × closes it. Top row: "Getting started",
//           "3 of 6" and six progress segments.
//   hero    left: the step's name as a headline, its reason, Start, and "Opens <pages>". Right: the preview, a small
//           true copy of what the step opens (clicking it is Start). A step waiting on the first scan: a faint
//           preview and "Waiting for your first results". A done step picked from the trail: "Replay".
//   trail   six frames: a tile, a short name, a result line. Done: a tiny visual of the result and an ink tick.
//           Current: an outline in the step's colour, "Up next". Upcoming: a faint outline, not clickable.
//   colour  each step has its own colour (--wt-c1 … --wt-c6): its tile's background (10%, 16% in dark), a soft wash in
//           the preview's top right corner, the current frame's outline, the current progress segment. Headline, text,
//           Start, done segments and ticks stay ink.
//   all done  the hero is a summary ("You're set up", the six results, Done); Done sends the sidebar card away.
// Motion: the sheet grows out of the sidebar card as the page dims (closing reverses it). A step finishing: its tile
// fills with its result and the tick appears, the result number counts up, the hero's headline and preview slide out as
// the next step's slide in, the wash changes colour, the next segment fills. A frame lifts 2px on hover. Reduced
// motion: fades only. Phones: the sheet is full screen, the hero stacks, the trail scrolls sideways.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Check, FileText, Gauge, MessageSquareText, PenLine, Send, Settings2, Smile, X } from 'lucide-react'
import SiteLogo from '../components/ui/SiteLogo'
import { PlatformIcon } from '../components/dashboard/icons'
import { ScoreRing } from '../components/dashboard/KpiRow'
import { account, getHistory, missedPrompts, trackedPrompts } from '../data/mock'
import { TRACKED_BRANDS, getBrandView } from '../data/brandViews'
import { engineIcon } from '../data/contentOpportunities'
import { scoreOf, sentimentFor } from '@/lib/sentiment-adapter'
import { publicationName, reachOutFor } from '@/lib/publication-contacts'
import { DONE_LINE, DONE_TITLE, TASKS, WAITING, allDone, currentTask, doneCount, fill, isDone, isWaiting, taskStatus } from './tour.js'
import { LARGE, ease, ms, reduced } from './motion.js'
import Swap from './Swap'
import { closeList, finish, openTask, useWalkthrough } from './store.js'

const inkBtn = 'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] bg-ink px-5 py-[11px] text-[14px] leading-5 font-semibold text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2'
const colourOf = (t) => `var(--wt-c${TASKS.indexOf(t) + 1})`
const safe = (fn, or = null) => { try { return fn() } catch { return or } }

// ---------------------------------------------------------------- the brand's data (mock: the sample data)
const rivals = () => TRACKED_BRANDS.filter((b) => !b.you)
const tonePages = () => safe(() => sentimentFor(account.domain).pages, [])
const score = () => safe(() => getBrandView().kpis.score, null)
const toneScore = () => safe(() => scoreOf(sentimentFor(account.domain).runs.at(-1).counts), null)
// each step's result: the number that counts up, and the words around it
const RESULT = {
  brand: () => ({ n: rivals().length, text: (n) => `${n} competitor${n === 1 ? '' : 's'}` }),
  prompts: () => ({ n: trackedPrompts.length, text: (n) => `${n} tracked` }),
  results: () => ({ n: score(), text: (n) => `Visibility ${n}` }),
  tone: () => ({ n: tonePages().length, text: (n) => `${n} pages read` }),
  content: () => ({ n: 1, text: (n) => `${n} draft` }),
  outreach: () => ({ n: 1, text: (n) => `${n} sent` }),
}
const resultOf = (t) => safe(RESULT[t.id], { n: 0, text: () => '' })

// a number that counts up to its value once (a step that has just finished); reduced motion: the value at once
function Count({ to, run }) {
  const [n, setN] = useState(run && !reduced() ? 0 : to)
  useEffect(() => {
    if (!run || reduced() || to == null) { setN(to); return undefined }
    const t0 = performance.now() + ms(300), dur = ms(600)
    let raf
    const frame = (t) => { const k = Math.max(0, Math.min(1, (t - t0) / dur)); setN(Math.round(to * ease(k))); if (k < 1) raf = requestAnimationFrame(frame) }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [to, run])
  return n
}

// ---------------------------------------------------------------- the previews: a small, true copy of what a step opens
const label = 'text-[12px] leading-4 text-stone-500'
function BrandPreview() {
  return (
    <div className="flex h-full flex-col justify-center gap-5 px-6">
      <div className="flex items-center gap-3">
        <SiteLogo domain={account.domain} name={account.name} className="h-11 w-11 rounded-xl" initialClass="text-[16px]" />
        <div className="min-w-0">
          <div className="truncate text-[17px] leading-6 font-semibold text-stone-900">{account.name}</div>
          <div className="truncate text-[13px] leading-[18px] text-stone-600">{account.domain}</div>
        </div>
      </div>
      <div>
        <div className={label}>Competitors</div>
        <div className="mt-2 flex gap-4">
          {rivals().slice(0, 5).map((b) => (
            <div key={b.domain} className="flex w-[68px] flex-col items-center gap-1.5">
              <SiteLogo domain={b.domain} name={b.name} className="h-9 w-9 rounded-lg" initialClass="text-[13px]" />
              <span className="w-full truncate text-center text-[12px] leading-4 text-stone-600">{b.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
function PromptsPreview() {
  const rows = trackedPrompts.filter((p) => p.status === 'visible').slice(0, 3)
  return (
    <div className="flex h-full flex-col justify-center px-6">
      <ul className="divide-y divide-[var(--div)]">
        {rows.map((p) => (
          <li key={p.id} className="flex h-11 items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] font-medium text-stone-900">{p.prompt}</span>
            <span className="flex shrink-0 items-center gap-1" title="The engines that name the brand">{p.platforms.map((e) => <PlatformIcon key={e} id={engineIcon(e)} size={14} />)}</span>
          </li>
        ))}
      </ul>
      <div className={`mt-3 ${label} tabular-nums`}><span className="font-semibold text-stone-900">{trackedPrompts.length}</span> prompts tracked</div>
    </div>
  )
}
// the brand's visibility over the last syncs, as a small line
function Spark({ className = '' }) {
  const key = TRACKED_BRANDS[0].key
  const pts = safe(() => getHistory({ compare: false }).points.map((p) => p[key]).filter((v) => v != null), [])
  if (pts.length < 2) return null
  const lo = Math.min(...pts), hi = Math.max(...pts), w = 160, h = 44
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * w, h - 4 - ((v - lo) / Math.max(1, hi - lo)) * (h - 8)])
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} fill="none" aria-hidden>
      <polyline points={xy.map((p) => p.join(',')).join(' ')} stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xy.at(-1)[0]} cy={xy.at(-1)[1]} r="3" fill="var(--ink)" />
    </svg>
  )
}
function ScorePreview() {
  const k = safe(() => getBrandView().kpis, {})
  return (
    <div className="flex h-full items-center gap-6 px-6">
      <ScoreRing value={k.score ?? null} size={84} stroke={7} />
      <div className="min-w-0 flex-1">
        <div className={label}>Visibility score</div>
        <div className="mt-0.5 text-[13px] leading-[18px] text-stone-600 tabular-nums"><span className="font-semibold text-stone-900">{k.visible}</span> of {k.total} prompts name {account.name}</div>
        <Spark className="mt-3 h-11 w-40" />
      </div>
    </div>
  )
}
const AREAS = [['neutral', 'Neutral'], ['positive', 'Positive'], ['negative', 'Negative'], ['mixed', 'Mixed']]
function TonePreview() {
  const pages = tonePages()
  return (
    <div className="flex h-full items-center gap-5 px-6">
      <div className="shrink-0">
        <div className={label}>Sentiment score</div>
        <div className="mt-1 text-[44px] leading-[44px] font-semibold tracking-[-0.03em] text-stone-900 tabular-nums">{toneScore() ?? '—'}</div>
      </div>
      {/* the four-area chart, small: every publication's logo in its tone's area */}
      <div className="grid min-w-0 flex-1 grid-cols-2 overflow-hidden rounded-lg border border-line">
        {AREAS.map(([tone, name], i) => (
          <div key={tone} className={`relative h-[86px] p-2 ${i % 2 ? '' : 'border-r border-line'} ${i < 2 ? 'border-b border-line' : ''} ${tone === 'negative' ? 'bg-[color-mix(in_srgb,var(--negative)_7%,transparent)]' : ''}`}>
            <div className={`text-[11px] leading-4 ${tone === 'negative' ? 'text-negative' : 'text-stone-500'}`}>{name}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {pages.filter((p) => p.tone === tone).slice(0, 6).map((p) => <SiteLogo key={p.id} domain={p.domain} name={p.domain} className="h-[18px] w-[18px] rounded-full" initialClass="text-[9px]" />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
function ContentPreview() {
  const row = missedPrompts[0]
  return (
    <div className="flex h-full flex-col justify-center gap-3 px-6">
      <div>
        <div className={label}>A prompt you’re missing</div>
        <div className="mt-0.5 truncate text-[14px] leading-5 font-semibold text-stone-900">{row.prompt}</div>
      </div>
      <div className="flex items-center gap-2">
        <span className={label}>Cited instead</span>
        <span className="flex -space-x-1.5">{row.competitors.map((d) => <span key={d} className="rounded-full ring-2 ring-surface"><SiteLogo domain={d} name={d} className="h-5 w-5 rounded-full" initialClass="text-[9px]" /></span>)}</span>
      </div>
      {/* the outline of a draft page */}
      <div className="rounded-lg border border-line bg-surface p-3" aria-label="A draft page’s outline">
        <div className="h-2.5 w-2/3 rounded-full bg-stone-300" />
        <div className="mt-2.5 h-1.5 w-full rounded-full bg-[var(--data-track)]" />
        <div className="mt-1.5 h-1.5 w-11/12 rounded-full bg-[var(--data-track)]" />
        <div className="mt-3 h-2 w-1/3 rounded-full bg-stone-300" />
        <div className="mt-2 h-1.5 w-4/5 rounded-full bg-[var(--data-track)]" />
      </div>
    </div>
  )
}
function OutreachPreview() {
  const page = tonePages().find((p) => p.tone === 'neutral' || p.tone === 'mixed') ?? tonePages()[0]
  if (!page) return null
  const reach = safe(() => reachOutFor(page), { label: 'Find contact' })
  return (
    <div className="flex h-full flex-col justify-center px-6">
      <div className={label}>A publication that mentions you without taking a side</div>
      <div className="mt-3 flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
        <SiteLogo domain={page.domain} name={page.domain} className="h-9 w-9 rounded-lg" initialClass="text-[13px]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] leading-[18px] font-semibold text-stone-900">{page.title}</div>
          <div className="truncate text-[12px] leading-4 text-stone-600">{safe(() => publicationName(page.domain), page.domain)} · {page.tone === 'mixed' ? 'Mixed' : 'Neutral'}</div>
        </div>
        <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-2.5 text-[12px] leading-4 font-medium text-stone-900">{reach.label}<ArrowUpRight size={12} aria-hidden /></span>
      </div>
    </div>
  )
}
const PREVIEW = { brand: BrandPreview, prompts: PromptsPreview, results: ScorePreview, tone: TonePreview, content: ContentPreview, outreach: OutreachPreview }

// ---------------------------------------------------------------- the trail
const ICON = { brand: Settings2, prompts: MessageSquareText, results: Gauge, tone: Smile, content: PenLine, outreach: Send }
const stack = (items) => <span className="flex -space-x-1.5">{items.map((d) => <SiteLogo key={d} domain={d} name={d} className="h-6 w-6 rounded-full" initialClass="text-[10px]" />)}</span>
// a done step's tiny visual: real logos or the real number
function TileResult({ t, fresh }) {
  const big = 'text-[20px] leading-6 font-semibold tracking-[-0.02em] text-stone-900 tabular-nums'
  if (t.id === 'brand') return stack(rivals().slice(0, 3).map((b) => b.domain))
  if (t.id === 'prompts') return <span className={big}><Count to={trackedPrompts.length} run={fresh} /></span>
  if (t.id === 'results') return <span className={big}><Count to={score()} run={fresh} /></span>
  if (t.id === 'tone') return stack([...new Set(tonePages().map((p) => p.domain))].slice(0, 3))
  if (t.id === 'content') return <span className="flex items-center gap-1.5 text-stone-900"><FileText size={18} strokeWidth={1.75} aria-hidden /><span className="flex flex-col gap-1"><span className="h-1 w-7 rounded-full bg-stone-900/70" /><span className="h-1 w-5 rounded-full bg-stone-900/30" /></span></span>
  const page = tonePages().find((p) => p.tone === 'neutral' || p.tone === 'mixed')
  return <span className="flex items-center gap-1.5 text-stone-900">{page && <SiteLogo domain={page.domain} name={page.domain} className="h-6 w-6 rounded-full" initialClass="text-[10px]" />}<Send size={15} strokeWidth={1.75} aria-hidden /></span>
}
function Frame({ t, w, picked, onPick }) {
  const status = taskStatus(w, t)
  const fresh = w.ticked === t.id
  const Icon = ICON[t.id]
  const r = resultOf(t)
  const done = status === 'done', current = status === 'current'
  const inner = (
    <>
      <span className={`wt-tile relative grid h-[62px] w-full place-items-center rounded-[10px] ${done ? 'wt-tile-done' : current ? 'wt-tile-current' : 'wt-tile-later'} ${picked ? 'wt-tile-picked' : ''}`}>
        {done ? <span className={fresh ? 'wt-tile-in' : ''}><TileResult t={t} fresh={fresh} /></span> : <Icon size={18} strokeWidth={1.5} className={current ? 'text-[var(--c)]' : 'text-stone-300'} aria-hidden />}
        {done && <span className={`absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-ink text-on-ink ${fresh ? 'wt-tick-in' : ''}`}><Check size={10} strokeWidth={3} aria-hidden /></span>}
      </span>
      <span className={`mt-2 block truncate text-[12.5px] leading-4 font-semibold ${done || current ? 'text-stone-900' : 'text-stone-400'}`}>{t.short}</span>
      <span className="block truncate text-[11.5px] leading-4 text-stone-500 tabular-nums" data-result>
        {done ? (fresh ? <span className="wt-got">{r.text(r.n)}</span> : r.text(r.n)) : current ? 'Up next' : status === 'waiting' ? 'Waiting' : ' '}
      </span>
    </>
  )
  const base = 'wt-frame block min-w-0 text-left max-md:w-[124px] max-md:shrink-0'
  return done || current
    ? <button type="button" data-frame={t.id} data-status={status} style={{ '--c': colourOf(t) }} aria-pressed={picked} aria-label={`${t.short}: ${done ? r.text(r.n) : 'up next'}`} onClick={() => onPick(t)} className={`${base} rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2`}>{inner}</button>
    : <div data-frame={t.id} data-status={status} style={{ '--c': colourOf(t) }} className={base}>{inner}</div>
}

// the six progress segments (the sheet's top row, the sidebar card): done ink, the current one its step's colour
export function Segments({ w, className = '' }) {
  return (
    <span className={`wt-segs flex gap-1 ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={TASKS.length} aria-valuenow={doneCount(w)} aria-label="Steps done">
      {TASKS.map((t) => {
        const status = taskStatus(w, t)
        return <span key={t.id} className="wt-seg" data-state={status === 'done' ? 'done' : status === 'current' ? 'current' : 'rest'} style={{ '--c': colourOf(t) }}><span className="wt-seg-half" /><span className="wt-seg-full" /></span>
      })}
    </span>
  )
}

// kept in the page while it closes: [mounted, shown]
function usePresence(open, outMs) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(r)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), outMs)
    return () => clearTimeout(t)
  }, [open, outMs])
  return [mounted, shown]
}

// mounted once (Walkthrough.jsx). Open while the store's `list` is on.
export default function Board() {
  const w = useWalkthrough()
  const open = Boolean(w.list && w.show)
  const [mounted, shown] = usePresence(open, ms(LARGE))
  const [pick, setPick] = useState(null) // a done step picked from the trail (the hero shows it, with Replay)
  const [origin, setOrigin] = useState(null) // where the sheet grows from: the sidebar card's middle, in the sheet's own box
  const sheet = useRef(null)
  useEffect(() => { if (w.ticked || !open) setPick(null) }, [w.ticked, open])
  useLayoutEffect(() => {
    if (!mounted || !sheet.current) return
    const card = [...document.querySelectorAll('[data-tour="getting-started"]')].find((el) => el.getClientRects().length)?.getBoundingClientRect()
    const s = sheet.current
    const box = s.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 }
    setOrigin(card ? { x: card.left + card.width / 2 - (box.left + s.offsetLeft), y: card.top + card.height / 2 - (box.top + s.offsetTop) } : null)
  }, [mounted, open])
  useEffect(() => {
    if (!open) return undefined
    const key = (e) => { if (e.key === 'Escape' && !w.tour) { e.preventDefault(); closeList() } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [open, w.tour])
  // focus goes to the sheet itself (no ring on Start until the keyboard is used)
  useEffect(() => { if (shown) sheet.current?.focus({ preventScroll: true }) }, [shown])
  if (!mounted) return null

  const n = doneCount(w)
  const current = currentTask(w)
  const step = pick && isDone(w, pick.id) ? pick : current // the step in the hero (none: all done)
  const replay = Boolean(step && isDone(w, step.id))
  const waiting = Boolean(step && isWaiting(w, step))
  const Preview = step ? PREVIEW[step.id] : null
  const start = () => { if (step && !waiting) openTask(step) }
  return createPortal(
    <div className="fixed inset-0 z-[85] grid place-items-center md:p-6" data-board={shown && open ? 'open' : 'closed'} data-all-done={allDone(w) ? '' : undefined}>
      <div aria-hidden onClick={closeList} className="wt-board-scrim absolute inset-0 bg-scrim-modal" />
      <section ref={sheet} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Getting started"
        style={origin ? { transformOrigin: `${origin.x}px ${origin.y}px` } : undefined}
        className="wt-sheet relative flex max-h-full w-full flex-col overflow-y-auto bg-surface shadow-2xl outline-none max-md:h-full md:w-[820px] md:max-w-full md:rounded-[20px] md:border md:border-line">
        {/* top row */}
        <div className="flex items-center gap-3 px-7 pt-5">
          <h2 className="whitespace-nowrap text-[14px] leading-5 font-semibold text-stone-600">Getting started</h2>
          <span className="ml-auto whitespace-nowrap text-[13px] leading-5 font-medium text-stone-500 tabular-nums" data-count={`${n} of ${TASKS.length}`}><Swap k={n} roll>{n}</Swap> of {TASKS.length}</span>
          <Segments w={w} className="wt-segs-top w-[150px] max-sm:w-[96px]" />
          <button type="button" onClick={closeList} aria-label="Close" className="-mr-2 grid h-8 w-8 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-[var(--tint)] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><X size={16} aria-hidden /></button>
        </div>

        {/* hero */}
        <div className="grid grid-cols-1 gap-7 px-7 py-[30px] md:grid-cols-[300px_minmax(0,1fr)]">
          {step ? (
            <>
              <div className="min-w-0">
                <Swap k={step.id} block move>
                  <h3 className="text-[34px] leading-[1.08] font-semibold tracking-[-0.03em] text-stone-900" data-hero-title>{step.title}</h3>
                  <p className="mt-3 max-w-[250px] text-[15px] leading-[22px] text-stone-600">{step.why}</p>
                </Swap>
                {waiting ? <p className="mt-6 text-[13px] leading-[18px] text-stone-500" data-waiting>{WAITING}</p> : (
                  <div className="mt-6 flex items-center gap-3.5">
                    <button type="button" data-primary onClick={start} className={inkBtn}>{replay ? 'Replay' : 'Start'}</button>
                    <span className="min-w-0">
                      <span className="block text-[12px] leading-4 text-stone-500">Opens</span>
                      <span className="block text-[13px] leading-[18px] font-semibold text-stone-600" data-opens>{step.opens}</span>
                    </span>
                  </div>
                )}
              </div>
              {/* the preview: clicking it is Start. Its wash is the step's colour, fading from the top right corner */}
              <button type="button" onClick={start} disabled={waiting} tabIndex={-1} aria-label={`${replay ? 'Replay' : 'Start'}: ${step.title}`} data-preview={step.id}
                className={`wt-preview relative h-[236px] overflow-hidden rounded-[14px] border border-line bg-surface text-left outline-none ${waiting ? 'cursor-default' : 'cursor-pointer'}`}>
                {TASKS.map((t) => <span key={t.id} aria-hidden className="wt-wash" data-on={t.id === step.id ? '' : undefined} style={{ '--c': colourOf(t) }} />)}
                <Swap k={step.id} block move className={`h-full ${waiting ? 'opacity-35' : ''}`}><div className="h-[236px]"><Preview /></div></Swap>
              </button>
            </>
          ) : (
            <>
              <div className="min-w-0">
                <Swap k="done" block move>
                  <h3 className="text-[34px] leading-[1.08] font-semibold tracking-[-0.03em] text-stone-900" data-hero-title>{DONE_TITLE}</h3>
                  <p className="mt-3 max-w-[250px] text-[15px] leading-[22px] text-stone-600">{fill(DONE_LINE)}</p>
                </Swap>
                <div className="mt-6"><button type="button" data-primary onClick={finish} className={inkBtn}>Done</button></div>
              </div>
              {/* the six results, side by side */}
              <div className="grid grid-cols-2 content-center gap-x-5 gap-y-5 rounded-[14px] border border-line p-5 sm:grid-cols-3" data-summary>
                {TASKS.map((t) => { const r = resultOf(t); return (
                  <div key={t.id} className="min-w-0" style={{ '--c': colourOf(t) }}>
                    <span className="wt-dash mb-2 block h-1.5 w-8 rounded-full" />
                    <div className="truncate text-[12.5px] leading-4 font-semibold text-stone-900">{t.short}</div>
                    <div className="truncate text-[13px] leading-[18px] text-stone-600 tabular-nums">{r.text(r.n)}</div>
                  </div>
                ) })}
              </div>
            </>
          )}
        </div>

        {/* trail */}
        <div className="mt-auto border-t border-[var(--div)] px-7 pb-6 pt-[18px]">
          <div className="grid grid-cols-6 gap-2.5 max-md:flex max-md:overflow-x-auto max-md:pb-1" data-trail>
            {TASKS.map((t) => <Frame key={t.id} t={t} w={w} picked={Boolean(step && replay && step.id === t.id)} onPick={(x) => setPick(isDone(w, x.id) ? x : null)} />)}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  )
}
