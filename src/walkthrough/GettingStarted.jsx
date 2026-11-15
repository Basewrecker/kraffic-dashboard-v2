// Getting started (mock only): the small card above the brand switcher, its list, Brand Setup's Save bar, the demo
// "Mark as done" bar of steps 4 to 6, and the Walkthrough rows in Settings. Words and rules: tour.js. Motion: motion.js.
//
// Card (collapsed): a 28px ring with the number of steps done in it, "Getting started" and "Next: <the next step>" in
// ink, six short segments (done: ink; current: ink at half strength; the rest: the light track), a chevron.
//   hover   it lifts 1px over a soft shadow, the chevron slides 3px right, the current segment brightens, and a faint
//           light follows the cursor inside it (the Opportunities button's effect)
//   press   0.98, and back
// A click opens the list beside it, level with the card's foot (a portal, like the brand menu); in the phone menu
// drawer (`inline`) the list opens above the card, in the drawer.
//
// List: a route from 1 to 6, done in order. It grows out of the card (same corner, same edge) and its steps come in
// 30ms apart; closing reverses the growth.
//   header   "Getting started", "2 of 6", the six segments, a "⋯" menu (Hide for now) and one control that collapses
//   done     an ink disc with a tick, the title in grey, what was achieved at the right (sample values from the mock's
//            data), the line from it to the next step in ink
//   current  its number in an ink ring, and a card: the title in bold, its reason, a chip per page it uses, "Start"
//   later    its number in a grey ring, the title in regular weight; nothing to click
//   waiting  as later, with "Waiting for your first results" (a first scan is running)
// A step ticking (the store opens the list for it): the disc fills and the tick draws (300ms), the line to the next
// step fills downward, the finished step's card folds up while the next one's opens. In the collapsed card at the same
// moment: the ring sweeps on, the number rolls, the next segment fills from the left, and the "Next:" line swaps.
// All six: the segments light up one after another, the ring closes, one soft band of light crosses the card, the last
// message fades in; a few seconds later the card fades and the sidebar closes the gap.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react'
import Switch from '../components/ui/Switch'
import { useIsCompact } from '../hooks/useMedia'
import { account, trackedPrompts } from '../data/mock'
import { TRACKED_BRANDS, getBrandView } from '../data/brandViews'
import { RUNS, scoreOf } from '../data/sentiment'
import { ALL_DONE, TASKS, TOURS, WAITING, allDone, demoTask, doneCount, fill, isDone, nextLine, taskStatus } from './tour.js'
import { MOVE, ms, reduced } from './motion.js'
import Swap from './Swap'
import { closeList, openTask, restart, setHints, setShow, startTour, tick, toggleList, useWalkthrough } from './store.js'

const inkBtn = 'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-ink font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2'
const iconBtn = 'grid h-7 w-7 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-[var(--tint)] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'

// what a done step shows as achieved (mock only: sample values read from the mock's data, so they look real)
const safe = (fn) => { try { return fn() } catch { return null } }
const ACHIEVED = {
  brand: () => { const n = TRACKED_BRANDS.filter((b) => !b.you).length; return `${account.name} · ${n} competitor${n === 1 ? '' : 's'}` },
  prompts: () => `${trackedPrompts.length} prompts`,
  results: () => `Visibility ${getBrandView().kpis.score}`,
  tone: () => `Sentiment ${scoreOf(RUNS.at(-1).counts)}`,
  content: () => '1 draft',
  outreach: () => '1 publication',
}
const achieved = (id) => safe(ACHIEVED[id]) ?? null

// the six segments, one per step. lit: all six have just been done (they light up one after another)
function Segments({ w, className = '', lit = false }) {
  return (
    <span className={`wt-segs flex gap-1 ${className}`} data-lit={lit ? '' : undefined} role="progressbar" aria-valuemin={0} aria-valuemax={TASKS.length} aria-valuenow={doneCount(w)} aria-label="Steps done">
      {TASKS.map((t, i) => {
        const status = taskStatus(w, t)
        return <span key={t.id} className="wt-seg" data-state={status === 'done' ? 'done' : status === 'current' ? 'current' : 'rest'} style={{ '--i': i }}><span className="wt-seg-half" /><span className="wt-seg-full" /></span>
      })}
    </span>
  )
}

// the ring with the number of steps done inside it; it sweeps on as the number rolls
function Ring({ n }) {
  const r = 11, c = 2 * Math.PI * r
  return (
    <span className="relative grid h-7 w-7 shrink-0 place-items-center" data-ring={n}>
      <svg viewBox="0 0 28 28" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <circle cx="14" cy="14" r={r} fill="none" strokeWidth="3" style={{ stroke: 'var(--data-track)' }} />
        <circle cx="14" cy="14" r={r} fill="none" strokeWidth="3" strokeLinecap="round" className="wt-ring" strokeDasharray={c} style={{ stroke: 'var(--ink)', strokeDashoffset: c * (1 - n / TASKS.length), opacity: n ? 1 : 0 }} />
      </svg>
      <span className="relative text-[12px] leading-4 font-semibold text-stone-900 tabular-nums"><Swap k={n} roll>{n}</Swap></span>
    </span>
  )
}

// a step's disc: its number in a ring, or (done) an ink disc with a tick. fresh: it has just ticked
function Disc({ n, status, fresh }) {
  if (status === 'done') {
    return (
      <span className={`absolute left-0 top-0 grid h-6 w-6 place-items-center rounded-full border-[1.5px] border-ink bg-ink text-on-ink ${fresh ? 'wt-fill' : ''}`}>
        <svg viewBox="0 0 12 12" className={`h-3 w-3 ${fresh ? 'wt-check' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2.5 6.3 5 8.7l4.5-5.2" pathLength="1" />
        </svg>
      </span>
    )
  }
  return (
    <span aria-hidden className={`absolute left-0 top-0 grid h-6 w-6 place-items-center rounded-full text-[12px] leading-none tabular-nums ${status === 'current' ? 'border-[1.5px] border-ink font-semibold text-ink' : 'border border-[var(--color-line-strong)] font-medium text-stone-500'}`}>{n}</span>
  )
}

// the current step's card: its reason, a chip per page it uses, Start. still: a card that is folding away (its step
// has just ticked): the same look, nothing to press
function StepCard({ t, onStart, still = false }) {
  return (
    <div className="mt-1.5 rounded-lg border border-line bg-surface p-3" data-step-card>
      <p className="text-[13px] leading-[18px] text-stone-600">{t.why}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {t.pages.map((p) => <span key={p} className="inline-flex h-6 items-center rounded-md bg-[var(--tint)] px-2 text-[12px] leading-4 font-medium text-stone-700" data-page-chip>{p}</span>)}
      </div>
      <button type="button" onClick={onStart} tabIndex={still ? -1 : undefined} className={`${inkBtn} mt-3 h-8 px-3.5 text-[13px]`}>Start</button>
    </div>
  )
}

function Steps({ w, onNavigate }) {
  return (
    <ol className="px-4 pb-4 pt-4">
      {TASKS.map((t, i) => {
        const status = taskStatus(w, t)
        const fresh = w.ticked === t.id // it has just ticked
        const opening = status === 'current' && w.ticked != null && TASKS[i - 1]?.id === w.ticked // the step before has just ticked
        const last = i === TASKS.length - 1
        const got = status === 'done' ? achieved(t.id) : null
        return (
          <li key={t.id} data-task={t.id} data-status={status} aria-current={status === 'current' ? 'step' : undefined} style={{ '--i': i }} className={`wt-step relative pl-9 ${last ? '' : 'pb-4'}`}>
            {/* the line to the next step: grey, in ink once this step is done (it fills downward as the step ticks) */}
            {!last && (
              <span aria-hidden className="absolute bottom-1 left-[11.5px] top-7 w-px bg-[var(--color-line)]">
                {status === 'done' && <span className={`absolute inset-0 origin-top bg-ink ${fresh ? 'wt-line' : ''}`} />}
              </span>
            )}
            <Disc n={i + 1} status={status} fresh={fresh} />
            <p className={`flex items-baseline gap-3 text-[14px] leading-6 ${status === 'current' ? 'font-semibold text-stone-900' : status === 'done' ? 'font-normal text-stone-500' : 'font-normal text-stone-700'}`}>
              <span className="min-w-0 flex-1"><span className="sr-only">{status === 'done' ? 'Done: ' : `Step ${i + 1}: `}</span>{t.title}</span>
              {got && <span className={`shrink-0 text-[12px] leading-4 text-stone-600 tabular-nums ${fresh ? 'wt-got' : ''}`} data-achieved>{got}</span>}
            </p>
            {status === 'waiting' && <p className="text-[12px] leading-4 text-stone-500">{WAITING}</p>}
            {/* the step that has just ticked: its card folds up */}
            {fresh && <div className="wt-close grid" inert="" aria-hidden><div className="min-h-0 overflow-hidden"><StepCard t={t} still /></div></div>}
            {status === 'current' && (
              <div className={`grid grid-rows-[1fr] ${opening ? 'wt-open' : ''}`}>
                {/* the 2px all round keeps the button's focus ring inside the clip */}
                <div className="-m-0.5 min-h-0 overflow-hidden p-0.5"><StepCard t={t} onStart={() => { onNavigate?.(); openTask(t) }} /></div>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

// "⋯": the one thing in it is Hide for now (the card comes back from Settings)
function More() {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const out = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', out)
    document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc, true) }
  }, [open])
  return (
    <span ref={wrap} className="relative">
      <button type="button" aria-label="More" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={iconBtn}><MoreHorizontal size={16} aria-hidden /></button>
      {open && (
        <span role="menu" className="wt-fade absolute right-0 top-full z-10 mt-1 block w-40 rounded-lg border border-line bg-raised p-1 shadow-md">
          <button type="button" role="menuitem" onClick={() => setShow(false)} title="You can bring it back in Settings"
            className="flex h-8 w-full items-center rounded-md px-2 text-left text-[13px] leading-[18px] text-stone-900 outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:bg-[var(--tint)]">Hide for now</button>
        </span>
      )}
    </span>
  )
}

// the list's own content: its heading with the six segments, the route, and (all six done) the last message
function List({ w, onNavigate }) {
  const n = doneCount(w)
  const finished = allDone(w)
  return (
    <>
      <div className="px-4 pt-3.5">
        <div className="flex items-center">
          <h2 className="text-[15px] leading-5 font-semibold text-stone-900">Getting started</h2>
          <span className="ml-2 text-[13px] leading-5 text-stone-600 tabular-nums" data-count><Swap k={n} roll>{n}</Swap> of {TASKS.length}</span>
          <span className="-mr-1.5 ml-auto flex items-center gap-0.5">
            {!finished && <More />}
            <button type="button" onClick={closeList} aria-label="Collapse" title="Collapse" className={iconBtn}><ChevronDown size={16} aria-hidden /></button>
          </span>
        </div>
        <Segments w={w} className="mt-2.5" lit={finished && w.ticked != null} />
      </div>
      <Steps w={w} onNavigate={onNavigate} />
      {finished && <p role="status" className={`border-t border-[var(--div)] px-4 pb-4 pt-3.5 text-[14px] leading-5 text-stone-900 ${w.ticked ? 'wt-message' : ''}`}>{fill(ALL_DONE)}</p>}
    </>
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
    const t = setTimeout(() => setMounted(false), reduced() ? ms(200) : outMs)
    return () => clearTimeout(t)
  }, [open, outMs])
  return [mounted, shown]
}

// inline: in the phone menu drawer (the list opens above the card, in the drawer). onNavigate: before a step opens
// its page (the drawer closes).
export default function GettingStarted({ inline = false, onNavigate }) {
  const w = useWalkthrough()
  const cardRef = useRef(null)
  const glow = useRef(null)
  const panel = useRef(null)
  const [pos, setPos] = useState(null)
  const compact = useIsCompact()
  const open = w.list && w.show
  const floating = open && !inline && !compact // the list as a panel beside the sidebar card
  const [mounted, shown] = usePresence(floating, ms(MOVE))
  useLayoutEffect(() => {
    if (!floating) return undefined
    const place = () => { const r = cardRef.current?.getBoundingClientRect(); if (r) setPos({ left: r.right + 16, bottom: Math.max(12, window.innerHeight - r.bottom) }) }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [floating])
  useEffect(() => {
    if (!floating) return undefined
    const out = (e) => { if (!cardRef.current?.contains(e.target) && !panel.current?.contains(e.target)) closeList() }
    const esc = (e) => { if (e.key === 'Escape') { closeList(); cardRef.current?.focus() } }
    document.addEventListener('mousedown', out)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc) }
  }, [floating])
  // below lg the sidebar isn't drawn: only the drawer's card is there
  if (!w.show || (!inline && compact)) return null
  const n = doneCount(w)
  const next = nextLine(w)
  // the faint light that follows the cursor (mouse only; not under reduced motion)
  const aim = (e) => {
    if (e.pointerType !== 'mouse' || reduced() || !glow.current) return
    const r = e.currentTarget.getBoundingClientRect()
    glow.current.style.transform = `translate3d(${(e.clientX - r.left - 60).toFixed(1)}px, ${(e.clientY - r.top - 60).toFixed(1)}px, 0)`
  }
  return (
    // leaving (the last message has run out): it fades and its height closes, then it is gone
    <div data-getting-started={inline ? 'drawer' : 'sidebar'} data-leaving={w.leaving ? '' : undefined}
      className={`wt-leave grid grid-cols-[minmax(0,1fr)] ${w.leaving ? '-mb-2 grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
    <div className={`flex min-h-0 flex-col gap-2 ${w.leaving ? 'overflow-hidden' : ''}`}>
      {inline && open && <div className="wt-fade rounded-lg border border-line bg-surface"><List w={w} onNavigate={onNavigate} /></div>}
      <div className="wt-card relative">
        <span aria-hidden className="wt-card-shadow" />
        <button ref={cardRef} type="button" data-tour="getting-started" data-count={`${n} of ${TASKS.length}`} onClick={toggleList} onPointerMove={aim} onPointerEnter={aim} aria-expanded={open} aria-haspopup="dialog"
          aria-label={`Getting started: ${n} of ${TASKS.length} done. ${next}`}
          className="relative flex w-full flex-col overflow-hidden rounded-lg border border-line bg-surface px-3 pb-3 pt-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <span ref={glow} aria-hidden className="wt-glow" />
          <span className="relative flex w-full items-center gap-2.5">
            <Ring n={n} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] leading-[18px] font-semibold text-stone-900">Getting started</span>
              <Swap k={next} block className="text-[12px] leading-4 text-stone-900"><span className="block" data-next-line>{next}</span></Swap>
            </span>
            <ChevronRight size={14} className={`wt-chev shrink-0 text-stone-500 ${inline ? '-rotate-90' : ''}`} aria-hidden />
          </span>
          <Segments w={w} className="relative mt-2.5" lit={allDone(w) && w.ticked != null} />
          {/* all six: one soft band of light crosses the card, once */}
          {allDone(w) && w.ticked != null && <span aria-hidden className="wt-sweep" />}
        </button>
      </div>
      {mounted && pos && createPortal(
        <div ref={panel} role="dialog" aria-label="Getting started" data-shown={shown && floating ? '' : undefined} style={{ left: pos.left, bottom: pos.bottom }}
          className="wt-panel fixed z-[80] w-[min(340px,calc(100vw-32px))] rounded-xl border border-line bg-raised shadow-md">
          <List w={w} />
        </div>,
        document.body,
      )}
    </div>
    </div>
  )
}

const bar = 'flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border border-line bg-surface px-5 py-4'

// Brand Setup: the page saves each change as it is made, so there is no Save on it. While step 1 is open this bar is
// where the brand and competitors are confirmed (and what the page's last pointer lights). Save ticks step 1.
export function ConfirmSetup() {
  const w = useWalkthrough()
  if (!w.show || isDone(w, 'brand')) return null
  return (
    <section data-tour="setup-save" aria-label="Confirm your brand" className={`${bar} rounded-[14px]`}>
      <div className="min-w-0">
        <h2 className="text-[15px] leading-5 font-semibold text-stone-900">Does this look right?</h2>
        <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600">Your brand, its other names and your competitors are what we track.</p>
      </div>
      <button type="button" onClick={() => tick('brand')} className={`${inkBtn} h-9 px-4 text-small max-md:w-full`}>Save</button>
    </section>
  )
}

// Steps 4 to 6 (mock only): what really finishes them isn't decided, so while one of them is the current step its page
// shows this bar, and "Mark as done" ticks it. path: the page (the sidebar's path for it).
export function TaskAction({ path }) {
  const w = useWalkthrough()
  const t = demoTask(w, path)
  if (!t) return null
  return (
    <section data-task-action={t.id} aria-label="Getting started step" className={`${bar} rounded-2xl`}>
      <div className="min-w-0">
        <p className="text-[12px] leading-4 text-stone-500 tabular-nums">Getting started · step {TASKS.indexOf(t) + 1} of {TASKS.length}</p>
        <h2 className="mt-0.5 text-[15px] leading-5 font-semibold text-stone-900">{t.title}</h2>
        <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600">{t.why}</p>
      </div>
      <button type="button" onClick={() => tick(t.id)} className={`${inkBtn} h-9 px-4 text-small max-md:w-full`}>Mark as done</button>
    </section>
  )
}

// Settings → Walkthrough: the rows of that card (the card itself is Brand Setup's SettingsCard)
export function WalkthroughRows() {
  const w = useWalkthrough()
  const row = 'flex min-h-[52px] items-center justify-between gap-4 px-5 py-2.5'
  const btn = 'inline-flex h-8 shrink-0 items-center rounded-md border border-line bg-surface px-3 text-[13px] font-medium text-stone-700 outline-none transition-colors duration-150 ease-out hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
  const Text = ({ title, sub }) => (
    <span className="min-w-0">
      <span className="block text-[14px] leading-5 font-medium text-stone-900">{title}</span>
      {sub && <span className="block text-[13px] leading-[18px] text-stone-600">{sub}</span>}
    </span>
  )
  return (
    <>
      <li className={row}>
        <Text title="Restart the walkthrough" sub="Welcome, the menu, then your six steps, from the start" />
        <button type="button" onClick={restart} className={btn}>Restart</button>
      </li>
      {Object.entries(TOURS).map(([key, t]) => (
        <li key={key} className={row}>
          <Text title={t.label} sub={`${t.steps.length} pointers`} />
          <button type="button" onClick={() => startTour(key)} aria-label={`Replay ${t.label}`} className={btn}>Replay</button>
        </li>
      ))}
      <li className={row}>
        <Text title="Show hints on pages" sub="A “?” beside the page title replays that page’s pointers" />
        <Switch checked={w.hints} onChange={setHints} aria-label="Show hints on pages" />
      </li>
      <li className={row}>
        <Text title="Show Getting started" sub="Your six steps, above the brand menu" />
        <Switch checked={w.show} onChange={setShow} aria-label="Show Getting started" />
      </li>
    </>
  )
}
