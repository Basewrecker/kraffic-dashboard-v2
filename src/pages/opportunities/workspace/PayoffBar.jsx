// Opportunities → Content workspace: the payoff bar, at the top of the step band (and of the focus panel). One card
// (surface, 1px line, 12px radius, 20px sides), 88px tall, three zones that fill the width:
//   LEFT: the step progress as 5 small pills (done / current = ink 28px, upcoming = --line-strong 12px, 4px apart; the
//     widths animate on a step change, 300ms; hover a pill for the step and what was chosen; click a done one, or the
//     current one from a reopened step, to go there) + "3 of 5"; the headline (18/600): the REWARD for finishing this
//     step, built from the data; one muted 13px sub-line: the current choice and the step's own progress. The sub-line
//     never repeats a number shown elsewhere in the bar. Both crossfade on a step change (180ms); aria-live reads them.
//   MIDDLE: the one stakes block (Engines below): the engines that name you, in colour (28px circles), over "Named on
//     1 of 4" (14/600), centred in the free space between the left and right zones. No greyed icons for the missed ones.
//   RIGHT: the button (lifts 1px on hover) with the step's text link ("Skip", "Back to step 4") to its left, same line.
// The button only looks disabled when the step truly can't continue, and then says why on hover.
// busy (the draft writing in the background): a small turning ring before the headline (an owner's exception to the
// no-looping-animation rule, DESIGN.md; static under reduced motion).
// Reduced motion: no stagger, scale or lift; fades only.
import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { PlatformIcon } from '../../../components/dashboard/icons'
import { CrossFade } from '../../../components/ui/motion'
import { engineIcon } from '../../../data/contentOpportunities'
import { STEPS, backLabel, stepPos } from './flow'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const LINK = 'rounded text-[13px] leading-[18px] font-medium text-stone-600 underline-offset-4 outline-none whitespace-nowrap hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-focus'

// engines: the engines with a result in the latest scan (5 with Google split in two; a no-result one is left out) · named: the ones that name the brand now (the rest are missed)
export default function PayoffBar({ barRef, current, open, values = [], onPick, headline, line, showNamed = false, engines = [], named = [], engineName = (e) => e, action, secondary = null, extra = null, onClose = null, headingId, busy = false, steps }) {
  const still = reduced()
  return (
    // one row (owner, 2026-11-05): left the progress over the headline and the sub-line; right the actions, centred
    <div ref={barRef} className="flex items-center gap-x-6 rounded-[12px] border border-line bg-surface px-5 py-4 shadow-[var(--rep-shadow)] max-lg:flex-wrap max-lg:gap-y-4">
      <div className="min-w-0 flex-1">
        <Pills current={current} open={open} values={values} onPick={onPick} still={still} steps={steps} />
        <div aria-live="polite" className="mt-2">
          <CrossFade k={`${open}|${headline}`} ms={180}>
            <div className="min-w-0">
              <h2 id={headingId} className="whitespace-nowrap text-[20px] leading-[28px] font-semibold text-stone-900 max-lg:whitespace-normal">
                <span className="sr-only">Step {stepPos(steps ?? STEPS.map((s, i) => ({ i })), open).n} of {(steps ?? STEPS).length}: </span>{busy && <Turning />}{headline}
              </h2>
              {line && <SubLine line={line} engines={showNamed ? engines : []} named={named} engineName={engineName} />}
            </div>
          </CrossFade>
        </div>
      </div>

      {/* RIGHT: the step's text link, then the button */}
      <div className="flex shrink-0 items-center gap-4 max-lg:ml-auto">
        {onClose && <button type="button" onClick={onClose} className={LINK}>{backLabel(steps ?? STEPS.map((x, i) => ({ i })), current)}</button>}
        {/* app (owner, 2026-11-05): a second small link before the secondary ("Guidelines · Edit") */}
        {extra && <button type="button" onClick={extra.onClick} className={LINK} data-bar-extra>{extra.label}</button>}
        {secondary && <button type="button" onClick={secondary.onClick} className={LINK}>{secondary.label}</button>}
        {action && <ActionButton action={action} still={still} />}
      </div>
    </div>
  )
}

// the sub-line (owner, 2026-11-05): on step 1 "Named on n of 5" with the engines that name you (in colour, 16px, only
// those) first, then the line's items ("5 pages win this prompt"); a path in it truncates in the middle only.
function SubLine({ line, engines, named, engineName }) {
  const parts = line.split(' · ')
  const sep = <span aria-hidden className="shrink-0">·</span>
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-[14px] leading-5 font-medium text-stone-600 tabular-nums">
      {engines.length > 0 && <>
        <span className="flex shrink-0 items-center gap-1.5" role="img" aria-label={`Named on ${named.length} of ${engines.length}${named.length ? `: ${named.map(engineName).join(', ')}` : ''}`}>
          <span className="whitespace-nowrap">Named on {named.length} of {engines.length}</span>
          {named.map((e) => <span key={e} title={`${engineName(e)} names you`} className="flex"><PlatformIcon id={engineIcon(e)} size={16} /></span>)}
        </span>{sep}</>}
      {parts.map((r, k) => <span key={`${k}${r}`} className="flex min-w-0 items-center gap-1.5">{k > 0 && sep}{r.startsWith('/') ? <MidPath text={r} /> : <span className="whitespace-nowrap">{r}</span>}</span>)}
    </p>
  )
}
// a path that shrinks only by truncating its middle: an invisible copy keeps its natural width (so the flex row gives it
// the room it has, not the room its shortened text takes); the shown text is measured against that room
function MidPath({ text }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(text)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const fit = () => {
      const w = el.clientWidth
      if (!w) return
      measure ??= document.createElement('canvas').getContext('2d')
      const cs = getComputedStyle(el)
      measure.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      const width = (t) => measure.measureText(t).width
      if (width(text) <= w) { setShown(text); return }
      let lo = 3, hi = text.length - 1
      const cut = (n) => `${text.slice(0, Math.ceil(n / 2))}…${text.slice(text.length - Math.floor(n / 2))}`
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (width(cut(mid)) <= w) lo = mid; else hi = mid - 1 }
      setShown(cut(lo))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    document.fonts?.ready.then(fit)
    return () => ro.disconnect()
  }, [text])
  return (
    <span ref={ref} className="relative min-w-0 overflow-hidden whitespace-nowrap" title={shown !== text ? text : undefined}>
      <span aria-hidden className="invisible">{text}</span>
      <span className="absolute inset-0">{shown}</span>
    </span>
  )
}
let measure = null

// the step progress: 5 small pills (done / current = ink 28px, upcoming = --line-strong 12px) + "3 of 5"; hover a pill for
// the step and what was chosen; click a done one (or the current one, from a reopened step) to go there. Shared with the
// focus panel's header.
// steps: the visible steps ([{ i, title }], workspace/flow.js stepsFor): v1 shows 3, ?backend=full 5
export function Pills({ current, open, values = [], onPick, still = reduced(), steps = STEPS.map((s, i) => ({ ...s, i })) }) {
  const [tip, setTip] = useState(null) // a pill's tooltip: its index
  const pos = stepPos(steps, open)
  return (
    <ol className="flex items-center gap-1" aria-label={`Step ${pos.n} of ${pos.of}`}>
      {steps.map((s, k) => {
        const i = s.i
        const done = i < current
        const on = i <= current
        const isOpen = i === open
        const value = done ? values[i] : null
        return (
          <li key={s.id} className="relative" onMouseEnter={() => setTip(i)} onMouseLeave={() => setTip(null)}>
            <button type="button" disabled={!on || isOpen} onClick={() => onPick(i)} onFocus={() => setTip(i)} onBlur={() => setTip(null)}
              aria-label={`Step ${k + 1}, ${s.title}${value ? `: ${value}` : ''}${done && !isOpen ? '. Go back to it' : i === current && !isOpen ? '. Return to it' : ''}`} aria-current={isOpen ? 'step' : undefined}
              className="group/pill grid h-4 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus enabled:cursor-pointer">
              <span className={`block h-1.5 rounded-full ${on ? 'bg-ink' : 'bg-[var(--color-line-strong)]'}`}
                style={{ width: on ? 28 : 12, transition: still ? 'none' : 'width 300ms cubic-bezier(.2,.8,.2,1), background-color 300ms ease-out' }} />
            </button>
            {tip === i && (
              <span role="tooltip" className="pointer-events-none absolute left-0 top-full z-30 mt-1.5 w-max max-w-[280px] rounded-md border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 text-stone-700 shadow-md">
                <span className="font-semibold text-stone-900">{s.title}</span>{value ? <> · {value}</> : i === current ? ' · now' : ''}
              </span>
            )}
          </li>
        )
      })}
      <li className="ml-2 text-[12px] leading-4 text-stone-500 tabular-nums" aria-hidden>{pos.n} of {pos.of}</li>
    </ol>
  )
}

// the primary: lifts 1px on hover; "disabled" only when the step truly can't continue, saying why on hover
export function ActionButton({ action, onLit = () => {}, still = false, tone = 'ink', size = 'md' }) {
  const off = Boolean(action.disabled)
  const base = size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-[14px]'
  const colors = tone === 'light'
    ? off ? 'bg-[color-mix(in_srgb,var(--on-ink)_40%,transparent)] text-ink' : 'bg-[var(--on-ink)] text-ink hover:bg-[color-mix(in_srgb,var(--on-ink)_88%,transparent)]'
    : off ? 'bg-[var(--color-line-strong)] text-stone-600' : 'bg-ink text-on-ink hover:bg-ink-hover'
  return (
    <span className="group/act relative inline-flex">
      <button type="button" onClick={off ? undefined : action.onClick} aria-disabled={off || undefined} aria-describedby={off && action.why ? 'co-act-why' : undefined}
        onMouseEnter={() => onLit(true)} onMouseLeave={() => onLit(false)} onFocus={() => onLit(true)} onBlur={() => onLit(false)}
        className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg font-medium outline-none transition-[transform,background-color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${base} ${colors} ${off ? 'cursor-not-allowed' : still ? '' : 'hover:-translate-y-px'}`}>
        {/* app: arrow: false when the label carries its own ("I’ve pasted it → Verify") */}
        {action.label}{action.arrow !== false && <ArrowRight size={15} aria-hidden />}
      </button>
      {off && action.why && (
        <span id="co-act-why" role="tooltip" className="pointer-events-none absolute right-0 top-full z-30 mt-1.5 w-max max-w-[260px] rounded-md border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 text-stone-700 opacity-0 shadow-md transition-opacity duration-150 group-hover/act:opacity-100 group-focus-within/act:opacity-100">
          {action.why}
        </span>
      )}
    </span>
  )
}

// the writing's ring (draft/Generating.jsx's current-step node), small, before the headline
function Turning() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" className="mr-2 inline-block align-[-2px] motion-safe:animate-spin" style={{ animationDuration: '900ms' }} aria-hidden>
      <circle cx="10" cy="10" r="8" fill="none" stroke="color-mix(in srgb, var(--co-a) 22%, transparent)" strokeWidth="2.5" />
      <circle cx="10" cy="10" r="8" fill="none" stroke="var(--co-a)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="14 60" />
    </svg>
  )
}
