// Getting started (mock only): the small card above the brand switcher, its list, Brand Setup's Save bar, the demo
// "Mark as done" bar of steps 4 to 6, and the Walkthrough rows in Settings. Words and rules: tour.js.
//
// Card: "Getting started · 2 of 6", a thin bar, then "Next: <the next step>". A click opens the list beside it, level
// with the card's foot (a portal, like the brand menu); in the phone menu drawer (`inline`) the list opens above the
// card, in the drawer.
// List: a route from 1 to 6. Six numbered discs joined by a thin line; the steps are done in order.
//   done     an ink disc with a tick, the title in grey, the line from it to the next step in ink
//   current  its number in an ink ring, the title in bold; the only step that is open: its reason and "Start"
//   later    its number in a grey ring, the title in regular weight; nothing to click
//   waiting  as later, with "Waiting for your first results" (a first scan is running)
// A step ticking (the store opens the list for it): the disc fills and the tick draws (300ms), the line to the next
// step fills, the bar moves on and the next step opens. All of it is keyframes (index.css .wt-*), so it plays the same
// whether the list was open or has just opened. After the sixth: the last message, then the card fades out.
// Header: the title, "2 of 6", a "⋯" menu (Hide for now) and one control that collapses the list.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react'
import Switch from '../components/ui/Switch'
import { useIsCompact } from '../hooks/useMedia'
import { ALL_DONE, TASKS, TOURS, WAITING, allDone, demoTask, doneCount, fill, isDone, nextLine, taskStatus } from './tour.js'
import { closeList, openTask, restart, setHints, setShow, startTour, tick, toggleList, useWalkthrough } from './store.js'

const pct = (n) => `${(n / TASKS.length) * 100}%`
const inkBtn = 'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-ink font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2'

// advanced: it has just moved on by one (the fill runs from the old value to this one)
function Bar({ value, advanced = false, className = '' }) {
  return (
    <span className={`block h-1 overflow-hidden rounded-full bg-[var(--data-track)] ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={TASKS.length} aria-valuenow={value} aria-label="Steps done">
      <span key={value} className={`block h-full rounded-full bg-ink ${advanced ? 'wt-bar' : ''}`} style={{ width: pct(value), '--wt-from': pct(Math.max(0, value - 1)) }} />
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

function Steps({ w, onNavigate }) {
  return (
    <ol className="px-4 pb-4 pt-4">
      {TASKS.map((t, i) => {
        const status = taskStatus(w, t)
        const fresh = w.ticked === t.id
        const opening = status === 'current' && w.ticked != null && TASKS[i - 1]?.id === w.ticked // the step before has just ticked
        const last = i === TASKS.length - 1
        return (
          <li key={t.id} data-task={t.id} data-status={status} aria-current={status === 'current' ? 'step' : undefined} className={`relative pl-9 ${last ? '' : 'pb-4'}`}>
            {/* the line to the next step: grey, in ink once this step is done */}
            {!last && (
              <span aria-hidden className="absolute bottom-1 left-[11.5px] top-7 w-px bg-[var(--color-line)]">
                {status === 'done' && <span className={`absolute inset-0 origin-top bg-ink ${fresh ? 'wt-line' : ''}`} />}
              </span>
            )}
            <Disc n={i + 1} status={status} fresh={fresh} />
            <p className={`text-[14px] leading-6 ${status === 'current' ? 'font-semibold text-stone-900' : status === 'done' ? 'font-normal text-stone-500' : 'font-normal text-stone-700'}`}>
              <span className="sr-only">{status === 'done' ? 'Done: ' : `Step ${i + 1}: `}</span>{t.title}
            </p>
            {status === 'waiting' && <p className="text-[12px] leading-4 text-stone-500">{WAITING}</p>}
            {status === 'current' && (
              <div className={`grid grid-rows-[1fr] ${opening ? 'wt-open' : ''}`}>
                {/* the 2px all round keeps the button's focus ring inside the clip */}
                <div className="-m-0.5 min-h-0 overflow-hidden p-0.5">
                  <p className="text-[13px] leading-[18px] text-stone-600">{t.why}</p>
                  <button type="button" onClick={() => { onNavigate?.(); openTask(t) }} className={`${inkBtn} mb-1 mt-2.5 h-8 px-3.5 text-[13px]`}>Start</button>
                </div>
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
const iconBtn = 'grid h-7 w-7 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-[var(--tint)] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'

// the list's own content: its heading, the route, and (all six done) the last message
function List({ w, onNavigate }) {
  const n = doneCount(w)
  const finished = allDone(w)
  return (
    <>
      <div className="px-4 pt-3.5">
        <div className="flex items-center">
          <h2 className="text-[15px] leading-5 font-semibold text-stone-900">Getting started</h2>
          <span className="ml-2 text-[13px] leading-5 text-stone-600 tabular-nums" data-count>{n} of {TASKS.length}</span>
          <span className="-mr-1.5 ml-auto flex items-center gap-0.5">
            {!finished && <More />}
            <button type="button" onClick={closeList} aria-label="Collapse" title="Collapse" className={iconBtn}><ChevronDown size={16} aria-hidden /></button>
          </span>
        </div>
        <Bar value={n} advanced={w.ticked != null} className="mt-2.5" />
      </div>
      <Steps w={w} onNavigate={onNavigate} />
      {finished && <p role="status" className={`border-t border-[var(--div)] px-4 pb-4 pt-3.5 text-[14px] leading-5 text-stone-900 ${w.ticked ? 'wt-message' : ''}`}>{fill(ALL_DONE)}</p>}
    </>
  )
}

// inline: in the phone menu drawer (the list opens above the card, in the drawer). onNavigate: before a step opens
// its page (the drawer closes).
export default function GettingStarted({ inline = false, onNavigate }) {
  const w = useWalkthrough()
  const cardRef = useRef(null)
  const panel = useRef(null)
  const [pos, setPos] = useState(null)
  const compact = useIsCompact()
  const open = w.list && w.show
  const floating = open && !inline && !compact // the list as a panel beside the sidebar card
  useLayoutEffect(() => {
    if (!floating) return undefined
    const place = () => { const r = cardRef.current?.getBoundingClientRect(); if (r) setPos({ left: r.right + 20, bottom: Math.max(12, window.innerHeight - r.bottom) }) }
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
  return (
    // leaving (the last message has run out): it fades and its height closes (200ms), then it is gone
    <div data-getting-started={inline ? 'drawer' : 'sidebar'}
      className={`grid grid-cols-[minmax(0,1fr)] transition-[grid-template-rows,opacity,margin] duration-200 ease-out motion-reduce:transition-none ${w.leaving ? '-mb-2 grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
    <div className={`flex min-h-0 flex-col gap-2 ${w.leaving ? 'overflow-hidden' : ''}`}>
      {inline && open && <div className="wt-fade rounded-lg border border-line bg-surface"><List w={w} onNavigate={onNavigate} /></div>}
      <button ref={cardRef} type="button" data-tour="getting-started" onClick={toggleList} aria-expanded={open} aria-haspopup="dialog"
        className="flex w-full flex-col rounded-lg border border-line bg-surface px-3 pb-2.5 pt-2.5 text-left outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-focus">
        <span className="flex w-full items-center gap-1 text-[13px] leading-[18px]">
          <span className="font-semibold text-stone-900">Getting started</span>
          <span className="text-stone-600 tabular-nums" data-count><span aria-hidden>· </span>{n} of {TASKS.length}</span>
          <ChevronRight size={14} className={`ml-auto shrink-0 text-stone-500 ${inline ? '-rotate-90' : ''}`} aria-hidden />
        </span>
        <Bar value={n} advanced={w.ticked != null} className="mt-2" />
        <span className="mt-2 block text-[12px] leading-4 text-stone-600" data-next-line>{nextLine(w)}</span>
      </button>
      {floating && pos && createPortal(
        <div ref={panel} role="dialog" aria-label="Getting started" style={{ left: pos.left, bottom: pos.bottom }}
          className="wt-fade fixed z-[80] w-[min(340px,calc(100vw-32px))] rounded-xl border border-line bg-raised shadow-md">
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
