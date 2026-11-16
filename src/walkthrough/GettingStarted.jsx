// Getting started (mock only): the small card above the brand switcher, Brand Setup's Save bar, and the
// Getting started card's Replay in Settings. The card opens the board (Board.jsx). Words and rules:
// tour.js. Motion: motion.js.
//
// Card, the "stack" (owner, 2026-11-16): one row.
//   left    a small stack of three cards (48 by 40, 9px corners, a 1.5px surface-coloured edge, a faint shadow). The top
//           one is the current step's trail frame: its colour tint and the same grey miniature as on the board. The
//           next two steps' cards peek out to the right behind it, turned 5 and 11 degrees, in their own colours
//           (fewer cards when fewer steps remain).
//   right   "Getting started", "Next: <short name>" with the name in ink, and six 7px dots: done steps filled with
//           their colour, the current one a ring in its colour, later ones light grey.
//   hover   the stack fans out (back cards to 9 and 20 degrees, the top one tilts -4 degrees and lifts over a deeper
//           shadow) and the card gains a soft shadow, 320ms. Press: 0.98.
//   a step finishing   the top card slides up and fades, the next one turns to the front and settles, a new card
//           appears at the back, the step's dot fills: one move, 450ms.
//   all done   the stack is one tile of the six colours, 3 by 2; "You're set up", "All six steps done", six filled
//           dots. A few seconds after the board is closed the card fades and the sidebar closes the gap.
// The board grows out of the stack's top card. Reduced motion: no fan or slide; the cards swap with a fade.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsCompact } from '../hooks/useMedia'
import { DONE_TITLE, TASKS, allDone, currentTask, doneCount, isDone, nextLine, nextTask, taskStatus } from './tour.js'
import { LARGE, ms } from './motion.js'
import Swap from './Swap'
import { Mini } from './Board'
import { finish, restart, tick, toggleList, useWalkthrough } from './store.js'

const inkBtn = 'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-ink font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2'
const colourOf = (t) => `var(--wt-c${TASKS.indexOf(t) + 1})`
const DONE_WAIT = 6000 // how long the all-done card stays once the board is closed

// the stack: the current step's card on top, the next two behind it; `out`: the step that has just finished (its card
// is on its way up and out)
function Stack({ w, out }) {
  const at = TASKS.indexOf(currentTask(w))
  if (at < 0) {
    return (
      <span className="wt-stack" data-stack="done" aria-hidden>
        <span className="wt-scard wt-scard-new" data-pos="0" data-stack-top>
          <span className="grid h-full w-full grid-cols-3 grid-rows-2 gap-[2px] p-[3px]">{TASKS.map((t) => <span key={t.id} className="rounded-[3px]" style={{ background: colourOf(t) }} />)}</span>
        </span>
        {out && <span key={`out-${out.id}`} className="wt-scard wt-scard-out" data-pos="0" style={{ '--c': colourOf(out) }}><Mini id={out.id} /></span>}
      </span>
    )
  }
  const cards = TASKS.slice(at, at + 3)
  return (
    <span className="wt-stack" data-stack={cards.length} aria-hidden>
      {cards.map((t, i) => (
        <span key={t.id} className={`wt-scard ${out && i === cards.length - 1 && cards.length === 3 ? 'wt-scard-new' : ''}`} data-pos={i} data-step={t.id} {...(i === 0 ? { 'data-stack-top': '' } : {})} style={{ '--c': colourOf(t) }}>
          {i === 0 && <Mini id={t.id} />}
        </span>
      ))}
      {out && <span key={`out-${out.id}`} className="wt-scard wt-scard-out" data-pos="0" style={{ '--c': colourOf(out) }}><Mini id={out.id} /></span>}
    </span>
  )
}

// six dots: done steps filled with their colour, the current one a ring in its colour, later ones light grey
function Dots({ w }) {
  return (
    <span className="flex items-center gap-[5px]" role="progressbar" aria-valuemin={0} aria-valuemax={TASKS.length} aria-valuenow={doneCount(w)} aria-label="Steps done">
      {TASKS.map((t) => <span key={t.id} className="wt-dot" data-state={taskStatus(w, t) === 'done' ? 'done' : taskStatus(w, t) === 'current' ? 'current' : 'rest'} style={{ '--c': colourOf(t) }} />)}
    </span>
  )
}

// inline: in the phone menu drawer
export default function GettingStarted({ inline = false }) {
  const w = useWalkthrough()
  const compact = useIsCompact()
  const current = currentTask(w)
  // the step whose card is leaving the stack (it has just finished): kept for one move
  const [out, setOut] = useState(null)
  const last = useRef(current)
  useEffect(() => {
    const before = last.current
    last.current = current
    if (!before || before === current || !w.ticked) return undefined
    setOut(before)
    const t = setTimeout(() => setOut(null), ms(LARGE) + 40)
    return () => clearTimeout(t)
  }, [current]) // eslint-disable-line react-hooks/exhaustive-deps
  // all done: a few seconds after the board is closed, the card goes
  const finished = allDone(w)
  useEffect(() => {
    if (!finished || w.list || !w.show || w.leaving) return undefined
    const t = setTimeout(finish, DONE_WAIT)
    return () => clearTimeout(t)
  }, [finished, w.list, w.show, w.leaving])
  // below lg the sidebar isn't drawn: only the drawer's card is there
  if (!w.show || (!inline && compact)) return null
  const n = doneCount(w)
  const next = nextTask(w)
  const line = nextLine(w)
  return (
    // leaving: it fades and its height closes, then it is gone
    <div data-getting-started={inline ? 'drawer' : 'sidebar'} data-leaving={w.leaving ? '' : undefined}
      className={`wt-leave grid grid-cols-[minmax(0,1fr)] ${w.leaving ? '-mb-2 grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
      <div className={`min-h-0 ${w.leaving ? 'overflow-hidden' : ''}`}>
        <div className="wt-card relative">
          <span aria-hidden className="wt-card-shadow" />
          <button type="button" data-tour="getting-started" data-count={`${n} of ${TASKS.length}`} onClick={toggleList} aria-expanded={Boolean(w.list)} aria-haspopup="dialog"
            aria-label={`Getting started: ${n} of ${TASKS.length} done. ${line}`}
            className="relative flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <Stack w={w} out={out} />
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="text-[13px] leading-[18px] font-semibold text-stone-900" data-card-title>{finished ? DONE_TITLE : 'Getting started'}</span>
              <Swap k={line} block className="text-[12px] leading-4 text-stone-600">
                {/* a long name goes onto a second line at the laptop size; it is never cut */}
                <span className="block" data-next-line>{next ? <>Next: <span className="font-semibold text-stone-900">{next.short}</span></> : line}</span>
              </Swap>
              <span className="mt-[3px]"><Dots w={w} /></span>
            </span>
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

// Settings → Getting started (owner, 2026-11-16): the card's one action. "Replay" asks once, then clears progress and
// runs it all again from the Welcome card. This is the only way to start it again.
export function ReplayGuide() {
  const [asking, setAsking] = useState(false)
  const box = useRef(null)
  useEffect(() => {
    if (!asking) return undefined
    box.current?.querySelector('[data-confirm]')?.focus()
    const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); setAsking(false) } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [asking])
  const line = 'inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface px-4 text-small font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2'
  return (
    <>
      <button type="button" data-replay-guide onClick={() => setAsking(true)} className={line}>Replay</button>
      {asking && createPortal(
        <div className="fixed inset-0 z-[95] grid place-items-center p-4" data-replay-confirm>
          <div aria-hidden className="wt-fade absolute inset-0 bg-scrim-modal" onClick={() => setAsking(false)} />
          <div ref={box} role="alertdialog" aria-modal="true" aria-labelledby="wt-replay-title" className="wt-fade relative w-full max-w-[380px] rounded-2xl border border-line bg-overlay p-6 shadow-xl">
            <h2 id="wt-replay-title" className="text-[17px] leading-6 font-semibold text-stone-900">Start the guide again from the beginning?</h2>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setAsking(false)} className={line}>Cancel</button>
              <button type="button" data-confirm onClick={() => { setAsking(false); restart() }} className={`${inkBtn} h-9 px-4 text-small`}>Replay</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
