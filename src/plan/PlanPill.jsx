import { useEffect, useState } from 'react'
import { linkClick } from '../router'
import { reducedMotion } from '../lib/motionTokens'
import UsageRing from './UsageRing'
import { PLANS_HREF, roomPill } from './plan.js'

// The plan pill (as the app's PlanPill, #231): on Prompt Hub's title line, 12px after the title. Ink-filled in every
// state, 24px high, fully round: a 12px usage ring, then "79 prompts left" (the number semibold). From 95% used:
// "5 prompts left · Upgrade". It links to Plans. Hover or focus: it lifts 1px and the dark tip reads "121 of 200
// used, counted across all your brands."
// Motion, once per visit: the ring fills and the number counts down to its value. Never loops. Reduced motion: the
// final state. Screen readers get the final numbers only (aria-label).
const SEEN = 'auden:plan-pill:seen'
export default function PlanPill({ className = '' }) {
  const p = roomPill()
  // once per visit the ring fills and the number counts down. After an upgrade (the limit changed since the pill was
  // last shown) the ring moves from where it was and the number rolls to the new room, so the upgrade shows here too
  const LAST = 'auden:plan-pill:last'
  const read = (k) => { try { return sessionStorage.getItem(k) } catch { return null } }
  const last = (() => { try { return JSON.parse(read(LAST) ?? 'null') } catch { return null } })()
  const first = !read(SEEN) && !reducedMotion()
  const changed = !first && last && (last.left !== p.left || last.pct !== p.pct) && !reducedMotion()
  const [pct, setPct] = useState(first ? 0 : changed ? last.pct : p.pct)
  const [left, setLeft] = useState(first ? p.limit : changed ? last.left : p.left)
  useEffect(() => {
    try { sessionStorage.setItem(SEEN, '1'); sessionStorage.setItem(LAST, JSON.stringify({ left: p.left, pct: p.pct })) } catch { /* private window */ }
    if (!first && !changed) { setPct(p.pct); setLeft(p.left); return undefined }
    const start = first ? p.limit : last.left
    const raf0 = requestAnimationFrame(() => setPct(p.pct))
    const t0 = performance.now()
    let raf
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 600)
      setLeft(Math.round(start + (p.left - start) * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf0); cancelAnimationFrame(raf) }
  }, [p.pct, p.left]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <a href={PLANS_HREF} onClick={linkClick(PLANS_HREF)} data-plan-pill
      aria-label={`${p.left} prompts left. ${p.tip}${p.upgrade ? ' Upgrade your plan.' : ''}`}
      className={`group/pp relative inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink pl-1.5 pr-2.5 text-[12px] leading-4 text-on-ink outline-none transition-transform duration-150 ease-out hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 motion-reduce:transform-none ${className}`}>
      <UsageRing pct={pct} size={12} stroke={2} variant="pill" />
      <span aria-hidden><span className="font-semibold tabular-nums">{left}</span> <span className="opacity-80">prompts left{p.upgrade ? ' · ' : ''}</span>{p.upgrade && <span className="font-semibold">Upgrade</span>}</span>
      <span role="tooltip" className="tip-dark pointer-events-none absolute left-0 top-full z-30 mt-2 w-max opacity-0 transition-opacity duration-150 group-hover/pp:opacity-100 group-focus-visible/pp:opacity-100">{p.tip}</span>
    </a>
  )
}
