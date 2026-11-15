// Getting started (mock only): the small card above the brand switcher, Brand Setup's Save bar, the demo "Mark as done"
// bar of steps 4 to 6, and the Walkthrough rows in Settings. The card opens the board (Board.jsx), which replaced the
// list (owner, 2026-11-15). Words and rules: tour.js. Motion: motion.js.
//
// Card: "Getting started", the six segments (done: ink; the current one: its step's colour; the rest: the light track)
// and "Next: <the next step's short name>".
//   hover   it lifts 1px over a soft shadow, the chevron slides 3px right, and a faint light follows the cursor inside
//           it (the Opportunities button's effect)
//   press   0.98, and back
// When a step finishes, the next segment fills and the "Next:" line swaps. After the board's Done the card fades and the
// sidebar closes the gap. In the phone menu drawer (`inline`) the same card opens the same board, full screen.
import { useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import Switch from '../components/ui/Switch'
import { useIsCompact } from '../hooks/useMedia'
import { TASKS, TOURS, demoTask, doneCount, isDone, nextLine } from './tour.js'
import { reduced } from './motion.js'
import Swap from './Swap'
import { Segments } from './Board'
import { restart, setHints, setShow, startTour, tick, toggleList, useWalkthrough } from './store.js'

const inkBtn = 'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-ink font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2'

// inline: in the phone menu drawer
export default function GettingStarted({ inline = false }) {
  const w = useWalkthrough()
  const glow = useRef(null)
  const compact = useIsCompact()
  // below lg the sidebar isn't drawn: only the drawer's card is there
  if (!w.show || (!inline && compact)) return null
  const n = doneCount(w)
  const next = nextLine(w)
  const open = Boolean(w.list)
  // the faint light that follows the cursor (mouse only; not under reduced motion)
  const aim = (e) => {
    if (e.pointerType !== 'mouse' || reduced() || !glow.current) return
    const r = e.currentTarget.getBoundingClientRect()
    glow.current.style.transform = `translate3d(${(e.clientX - r.left - 60).toFixed(1)}px, ${(e.clientY - r.top - 60).toFixed(1)}px, 0)`
  }
  return (
    // leaving (the board's Done): it fades and its height closes, then it is gone
    <div data-getting-started={inline ? 'drawer' : 'sidebar'} data-leaving={w.leaving ? '' : undefined}
      className={`wt-leave grid grid-cols-[minmax(0,1fr)] ${w.leaving ? '-mb-2 grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
      <div className={`min-h-0 ${w.leaving ? 'overflow-hidden' : ''}`}>
        <div className="wt-card relative">
          <span aria-hidden className="wt-card-shadow" />
          <button type="button" data-tour="getting-started" data-count={`${n} of ${TASKS.length}`} onClick={toggleList} onPointerMove={aim} onPointerEnter={aim} aria-expanded={open} aria-haspopup="dialog"
            aria-label={`Getting started: ${n} of ${TASKS.length} done. ${next}`}
            className="relative flex w-full flex-col overflow-hidden rounded-lg border border-line bg-surface px-3 pb-2.5 pt-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <span ref={glow} aria-hidden className="wt-glow" />
            <span className="relative flex w-full items-center gap-2">
              <span className="min-w-0 flex-1 text-[13px] leading-[18px] font-semibold text-stone-900">Getting started</span>
              <ChevronRight size={14} className="wt-chev shrink-0 text-stone-500" aria-hidden />
            </span>
            <Segments w={w} className="relative mt-2" />
            <Swap k={next} block className="relative mt-2 text-[12px] leading-4 text-stone-900"><span className="block truncate" data-next-line>{next}</span></Swap>
          </button>
        </div>
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
