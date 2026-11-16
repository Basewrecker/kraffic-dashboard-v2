// Opportunities → Content workspace: small shared pieces (the step marker, the open/close motion, the green tick,
// Sentiment's type and its change line)
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// a panel that opens and closes on its height (grid rows 0fr ↔ 1fr) and opacity, 220ms (or `ms`), once; content mounts
// on open and unmounts after it has closed, so nothing hidden stays focusable. Clips only while it moves.
export function Collapse({ open, children, className = '', ms = 220 }) {
  const [mounted, setMounted] = useState(open)
  const [expanded, setExpanded] = useState(open)
  const [settled, setSettled] = useState(open)
  useEffect(() => {
    if (open) {
      setMounted(true)
      if (reduced()) { setExpanded(true); setSettled(true); return undefined }
      let r2
      const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setExpanded(true)) })
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
    }
    setSettled(false)
    setExpanded(false)
    if (reduced()) setMounted(false)
    return undefined
  }, [open])
  const end = (e) => {
    if (e.target !== e.currentTarget || e.propertyName !== 'grid-template-rows') return
    if (open) setSettled(true)
    else setMounted(false)
  }
  return (
    <div onTransitionEnd={end} aria-hidden={!open || undefined} style={{ transitionDuration: `${ms}ms` }}
      className={`grid transition-[grid-template-rows,opacity] ease-out motion-reduce:transition-none ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'} ${className}`}>
      <div className={`min-h-0 ${settled && expanded ? '' : 'overflow-hidden'}`}>{mounted && children}</div>
    </div>
  )
}

// numbered circle: done = ink with a tick, current = ink ring, upcoming = muted number (First-time setup's marker)
export function StepMarker({ n, state, size = 24 }) {
  const cls = state === 'done' ? 'bg-ink text-on-ink' : state === 'current' ? 'border-2 border-ink bg-page text-ink' : 'border border-line bg-page text-stone-500'
  return (
    <span style={{ width: size, height: size }} className={`relative z-[1] grid shrink-0 place-items-center rounded-full text-[12px] leading-none font-semibold tabular-nums transition-colors duration-200 ease-out ${cls}`}>
      {state === 'done' ? <><Check size={13} strokeWidth={2.75} aria-hidden /><span className="sr-only">Step {n}, done</span></> : n}
    </span>
  )
}

// a small green tick in a circle: connected, answered
export function GreenTick({ size = 16, label }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-[var(--rep-up-fg)]" style={{ width: size, height: size }} aria-label={label} role={label ? 'img' : undefined}>
      <Check size={size * 0.62} strokeWidth={3.25} className="text-surface" aria-hidden />
    </span>
  )
}

// not answered / not set up: the dashed ring from the indicator vocabulary (DESIGN.md §5)
// tone 'negative': missing where it should be (the Target page's "Your page" row: a format the draft will add)
export function DashedRing({ size = 16, tone }) {
  return <span className={`inline-block shrink-0 rounded-full border-[1.5px] border-dashed ${tone === 'negative' ? 'border-[var(--negative)]' : 'border-stone-400'}`} style={{ width: size, height: size }} aria-hidden />
}

// the green tick that draws itself; the red dashed ring that draws around (stroke animation, revealed by a mask): the
// Target page matrix's "Your page" cells and the Draft rail's before / after strip. animate false: drawn, no motion.
// tick: the disc pops (200ms), then the check strokes in (`ms`, 260 by default) `stroke` after it starts.
export function TickDraw({ delay = 0, size = 20, ms = 260, stroke = 120, animate = true, label = 'You have it' }) {
  const still = !animate || reduced()
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" role="img" aria-label={label} className="shrink-0">
      <circle cx="10" cy="10" r="10" fill="var(--rep-up-fg)" style={still ? undefined : { animation: `co-cell-in 200ms ease-out ${delay}ms both`, transformOrigin: 'center', transformBox: 'fill-box' }} />
      <path d="M5.8 10.4 8.6 13.1 14.2 7.3" fill="none" stroke="var(--color-surface)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1"
        style={still ? undefined : { animation: `sent-draw ${ms}ms ease-out ${delay + stroke}ms both` }} />
    </svg>
  )
}
let ringId = 0
export function RingDraw({ size = 20, delay = 0, animate = true, label = 'Missing: the draft adds it' }) {
  const [id] = useState(() => `co-ring-${ringId++}`)
  const still = !animate || reduced()
  const r = size / 2 - 1.5
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0">
      <mask id={id}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="white" strokeWidth="4" pathLength="1" strokeDasharray="1" transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={still ? undefined : { animation: `sent-draw 420ms ease-out ${delay}ms both` }} />
      </mask>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--negative)" strokeWidth="1.5" strokeDasharray="2.6 2.4" mask={`url(#${id})`} />
    </svg>
  )
}

// Sentiment's type (pages/insights/SentimentPage.jsx), so the two pages read alike: section titles 18/600, a column's
// head (title 15/600 over a hairline), row titles 15/600, second lines 14 muted
export const H2 = 'text-[18px] leading-[26px] font-semibold text-stone-900'
export const COL_HEAD = 'flex h-11 items-end justify-between gap-3 border-b border-line pb-2'
export const COL_TITLE = 'flex min-w-0 items-baseline gap-2 text-[15px] leading-[22px] font-semibold text-ink'
export const ROW_TITLE = 'truncate text-[15px] leading-[22px] font-semibold text-stone-900'
export const SECOND = 'text-[14px] leading-5 font-normal text-stone-500'

// Sentiment's change line ("▲ +15 since Oct 27": utils/sentimentSections.js scoreChange, the hero's green / red): the
// arrow and sign follow the number, the colour its meaning (green good, red bad, grey no change). good: 'up' (more is
// better) or 'down' (less is better: a position). text: what follows ("since Sep 28", "vs prior 4 weeks").
export function changeParts(delta, { good = 'up', digits = 0 } = {}) {
  if (delta == null || !Number.isFinite(delta)) return null
  const r = +delta.toFixed(digits)
  if (!r) return { arrow: '', sign: '', abs: '0', tone: 'same' }
  const better = good === 'up' ? r > 0 : r < 0
  return { arrow: r > 0 ? '▲' : '▼', sign: r > 0 ? '+' : '−', abs: Math.abs(r).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }), tone: better ? 'good' : 'bad' }
}
export const TONE_CLASS = { good: 'text-[var(--rep-up-fg)]', bad: 'text-negative', same: 'text-stone-500' }
export function ChangeLine({ delta, text = '', good = 'up', digits = 0, unit = '', className = 'text-[14px] leading-5', none = 'No change' }) {
  const c = changeParts(delta, { good, digits })
  if (!c) return null
  return (
    <span className={`font-medium tabular-nums ${TONE_CLASS[c.tone]} ${className}`}>
      {c.tone === 'same' ? `${none}${text ? ` ${text}` : ''}` : `${c.arrow} ${c.sign}${c.abs}${unit}${text ? ` ${text}` : ''}`}
    </span>
  )
}
