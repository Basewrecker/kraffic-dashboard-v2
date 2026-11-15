// Getting started (mock only): the small card above the brand switcher, its list, Brand Setup's Save bar and the
// Walkthrough rows in Settings. Words and rules: tour.js.
//
// Card: "Getting started · 2 of 6" over a thin bar. A click opens the list beside it, level with the card's foot
// (a portal, like the brand menu); in the phone menu drawer (`inline`) the list opens above the card, in the drawer.
// List: six tasks in order. Ticked: an ink disc with a tick. Next: the soft tint row, with an arrow. Waiting (a first
// scan is running): muted, not a button. A task that ticks itself: its disc pops in and the tick draws (260ms), the
// bar fills (500ms) and the count goes up. All six: the last message and Close; the card then fades out (200ms).
// Collapse: the list's × (or Esc, or a click outside). Dismiss: "Hide" in the list (back from Settings).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Check, ChevronRight, X } from 'lucide-react'
import Switch from '../components/ui/Switch'
import { useIsCompact } from '../hooks/useMedia'
import { ALL_DONE, TASKS, TOURS, WAITING, allDone, doneCount, fill, isDone, taskStatus } from './tour.js'
import { closeList, finish, openTask, restart, setHints, setShow, startTour, tick, toggleList, useWalkthrough } from './store.js'

function Bar({ value, className = '' }) {
  return (
    <span className={`block h-1 overflow-hidden rounded-full bg-[var(--data-track)] ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={TASKS.length} aria-valuenow={value} aria-label="Steps done">
      <span className="block h-full rounded-full bg-ink transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${(value / TASKS.length) * 100}%` }} />
    </span>
  )
}

// a task's disc: empty, ticked, or waiting (dashed)
function Disc({ status, fresh }) {
  if (status === 'done') {
    return (
      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-on-ink ${fresh ? 'wt-pop' : ''}`}>
        <svg viewBox="0 0 12 12" className={`h-3 w-3 ${fresh ? 'wt-check' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2.5 6.3 5 8.7l4.5-5.2" pathLength="1" />
        </svg>
      </span>
    )
  }
  return <span aria-hidden className={`h-5 w-5 shrink-0 rounded-full border ${status === 'waiting' ? 'border-dashed border-[var(--color-line-strong)]' : status === 'next' ? 'border-[1.5px] border-ink' : 'border-[var(--color-line-strong)]'}`} />
}

function Tasks({ w, onNavigate }) {
  return (
    <ol className="flex flex-col gap-px p-1">
      {TASKS.map((t) => {
        const status = taskStatus(w, t)
        const body = (
          <>
            <Disc status={status} fresh={w.ticked === t.id} />
            <span className="min-w-0 flex-1">
              <span className={`block text-[14px] leading-5 ${status === 'next' ? 'font-semibold text-stone-900' : status === 'todo' ? 'font-medium text-stone-900' : 'font-medium text-stone-500'}`}>{t.title}</span>
              <span className={`block text-[13px] leading-[18px] ${status === 'next' || status === 'todo' ? 'text-stone-600' : 'text-stone-500'}`}>{status === 'waiting' ? WAITING : t.why}</span>
            </span>
            {status === 'next' && <ArrowRight size={14} className="mt-[3px] shrink-0 text-ink" aria-hidden />}
          </>
        )
        const row = 'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left'
        return (
          <li key={t.id} data-task={t.id} data-status={status}>
            {status === 'waiting'
              ? <div className={row} aria-disabled="true">{body}</div>
              : (
                <button type="button" onClick={() => { onNavigate?.(); openTask(t) }} aria-current={status === 'next' ? 'step' : undefined}
                  className={`${row} outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${status === 'next' ? 'bg-[var(--tint)]' : ''}`}>
                  {body}
                </button>
              )}
          </li>
        )
      })}
    </ol>
  )
}

// the list's own content: its heading, the tasks (or the last message)
function List({ w, onNavigate }) {
  const n = doneCount(w)
  const finished = allDone(w)
  const small = 'inline-flex h-7 items-center rounded-md px-2 text-[13px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-[var(--tint)] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
  return (
    <>
      <div className="px-4 pb-3 pt-3.5">
        <div className="flex items-center gap-1">
          <h2 className="mr-auto text-[15px] leading-5 font-semibold text-stone-900">Getting started</h2>
          {!finished && <button type="button" onClick={() => setShow(false)} title="You can bring it back in Settings" className={small}>Hide</button>}
          <button type="button" onClick={closeList} aria-label="Close the list" className={`${small} w-7 justify-center px-0`}><X size={14} aria-hidden /></button>
        </div>
        <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600 tabular-nums">{n} of {TASKS.length} done</p>
        <Bar value={n} className="mt-2.5" />
      </div>
      {finished ? (
        <div className="border-t border-[var(--div)] px-4 pb-4 pt-3.5">
          <p className="text-[14px] leading-5 text-stone-900">{fill(ALL_DONE)}</p>
          <button type="button" onClick={finish} className="mt-3.5 inline-flex h-9 items-center justify-center rounded-lg bg-ink px-3.5 text-small font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">Close</button>
        </div>
      ) : <div className="border-t border-[var(--div)]"><Tasks w={w} onNavigate={onNavigate} /></div>}
    </>
  )
}

// inline: in the phone menu drawer (the list opens above the card, in the drawer). onNavigate: before a task opens
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
    // leaving (the last message was closed): it fades and its height closes (200ms), then it is gone
    <div data-tour="getting-started" data-getting-started={inline ? 'drawer' : 'sidebar'}
      className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out motion-reduce:transition-none ${w.leaving ? '-mb-2 grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
    <div className={`flex min-h-0 flex-col gap-2 ${w.leaving ? 'overflow-hidden' : ''}`}>
      {inline && open && <div className="wt-fade overflow-hidden rounded-lg border border-line bg-surface"><List w={w} onNavigate={onNavigate} /></div>}
      <button ref={cardRef} type="button" onClick={toggleList} aria-expanded={open} aria-haspopup="dialog"
        className="flex w-full flex-col gap-2 rounded-lg border border-line bg-surface px-3 pb-3 pt-2.5 text-left outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-focus">
        <span className="flex w-full items-center gap-1 text-[13px] leading-[18px]">
          <span className="font-semibold text-stone-900">Getting started</span>
          <span className="text-stone-600 tabular-nums"><span aria-hidden>· </span>{n} of {TASKS.length}</span>
          {w.ticked
            ? <Check size={14} className="wt-pop ml-auto shrink-0 text-ink" aria-hidden />
            : <ChevronRight size={14} className={`ml-auto shrink-0 text-stone-500 transition-transform duration-150 motion-reduce:transition-none ${inline ? '-rotate-90' : ''}`} aria-hidden />}
        </span>
        <Bar value={n} />
      </button>
      {floating && pos && createPortal(
        <div ref={panel} role="dialog" aria-label="Getting started" style={{ left: pos.left, bottom: pos.bottom }}
          className="wt-fade fixed z-[80] w-[min(340px,calc(100vw-32px))] overflow-hidden rounded-xl border border-line bg-raised shadow-md">
          <List w={w} />
        </div>,
        document.body,
      )}
    </div>
    </div>
  )
}

// Brand Setup: the page saves each change as it is made, so there is no Save on it. While the first task is open this
// bar is where the brand and competitors are confirmed (and what the page's last pointer lights).
export function ConfirmSetup() {
  const w = useWalkthrough()
  if (!w.show || isDone(w, 'brand')) return null
  return (
    <section data-tour="setup-save" aria-label="Confirm your brand" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[14px] border border-line bg-surface px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] leading-5 font-semibold text-stone-900">Does this look right?</h2>
        <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600">Your brand, its other names and your competitors are what we track.</p>
      </div>
      <button type="button" onClick={() => tick('brand')} className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-ink px-4 text-small font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 max-md:w-full">Save</button>
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
