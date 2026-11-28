import { useEffect, useRef, useState } from 'react'
import { navigate } from '../router'
import { PLANS } from '../plan/catalog.js'
import { motionMs, motionValue, reducedMotion } from '../lib/motionTokens'
import { addMonths, TODAY } from './format.js'
import { setMoment, useMoment } from './moment.js'
import { WORKSPACE } from './state.js'
import { DateTip } from './ui.jsx'

// The full-screen moment after the payment page (owner, 2026-11-28): ink in both themes, for this one moment.
//  processing  the plan name large, a thick ring drawing itself while we wait for the payment to be confirmed (a real
//              state: it ends when the confirmation arrives, never on a fixed timer), "Confirming your payment…"
//  paid        the ring closes into a solid circle, the check draws in, one pulse ripples out across the screen;
//              "You're on Growth" rises in word by word; Prompts / Competitors / Logins count from the old plan to the
//              new with the gains in green; then the receipt line and two buttons. ~2.5s; a click anywhere skips to the end
//  leaving     declined / bank approval / expired / error: the ring stops and the screen softly returns to the light
//              page, where the return page's card says why (no shake, no red flash)
//  landing     "See my plan": the moment shrinks back into the plan's card on the Plans page
// Reduced motion: no pulse, no counting, no shrink: plain cross-fades and the final numbers.
// Mounted once in App.jsx; the return page (pages/plans/ReturnPage.jsx) starts it.
const LIMITS = [['Prompts', 'prompts'], ['Competitors', 'competitors'], ['Logins', 'logins']]

function useCountFromTo(from, to, at, skip) {
  const [n, setN] = useState(reducedMotion() || from == null ? to : from)
  useEffect(() => {
    if (skip || reducedMotion() || from == null) { setN(to); return undefined }
    setN(from)
    let raf, t0
    const tick = (t) => { t0 ??= t; const k = Math.min(1, (t - t0) / 700); setN(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick) }
    const timer = setTimeout(() => { raf = requestAnimationFrame(tick) }, at)
    return () => { clearTimeout(timer); cancelAnimationFrame(raf) }
  }, [from, to, at, skip])
  return n
}

function Gain({ label, from, to, skip }) {
  const n = useCountFromTo(from, to, 1000, skip)
  const delta = from == null ? null : to - from
  return (
    <div className="flex min-w-[96px] flex-col items-center">
      <span className="text-[13px] leading-[18px] text-[var(--moment-muted)]">{label}</span>
      <span className="mt-1 flex items-baseline gap-2">
        <span className="text-h1 font-semibold tabular-nums">{n}</span>
        {delta > 0 && <span className="mo-fade text-[13px] leading-[18px] font-semibold tabular-nums text-[var(--moment-up)]" style={{ '--d': '1720ms' }}>+{delta}</span>}
      </span>
    </div>
  )
}

export default function PaymentMoment() {
  const { moment: m } = useMoment()
  const root = useRef(null)
  const [skip, setSkip] = useState(false)
  const phase = m?.phase
  useEffect(() => { if (phase === 'paid') setSkip(false) }, [phase])

  // leaving / out: fade the ink away, then let the page underneath be
  useEffect(() => {
    if (phase !== 'leaving' && phase !== 'out') return undefined
    const el = root.current
    if (!el) { setMoment({ moment: null }); return undefined }
    const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: phase === 'leaving' ? 420 : 300, easing: motionValue('--motion-ease-out'), fill: 'forwards' })
    a.finished.then(() => setMoment({ moment: null }), () => {})
    return () => a.cancel()
  }, [phase])

  // landing: shrink into the plan's card (clip-path to its box), then hand over to the card
  useEffect(() => {
    if (phase !== 'landing') return undefined
    let a, cancelled = false
    const land = () => {
      if (cancelled) return
      const el = root.current
      const card = document.querySelector(`[data-plan="${m.plan}"]`)
      const done = () => { setMoment({ moment: null, landed: m.plan }); setTimeout(() => setMoment({ landed: null }), 600) }
      if (!el || !card || reducedMotion()) {
        a = el?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' })
        if (a) a.finished.then(done, () => {}); else done()
        return
      }
      const r = card.getBoundingClientRect()
      el.querySelector('[data-mo-content]')?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' })
      a = el.animate([
        { clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 },
        { clipPath: `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round 16px)`, opacity: 1, offset: 0.78 },
        { clipPath: `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round 16px)`, opacity: 0 },
      ], { duration: motionMs('--motion-morph-long') + 140, easing: motionValue('--motion-spring'), fill: 'forwards' })
      a.finished.then(done, () => {})
    }
    // the Plans page draws first, so the card is where it will be
    const r1 = requestAnimationFrame(() => requestAnimationFrame(land))
    return () => { cancelled = true; cancelAnimationFrame(r1) }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!m) return null
  const plan = PLANS.find((p) => p.id === m.plan) ?? PLANS[1]
  const from = PLANS.find((p) => p.id === m.from) ?? null
  const paid = phase === 'paid' || phase === 'landing' || phase === 'out'
  const reach = typeof window === 'undefined' ? 30 : Math.ceil((2 * Math.hypot(innerWidth, innerHeight)) / 88)
  const words = ['You’re', 'on', plan.name]
  const stop = (fn) => (e) => { e.stopPropagation(); fn() }
  const toDashboard = () => { navigate('/overview?billing=live&sub=active'); setMoment({ moment: { ...m, phase: 'out' } }) }
  const toPlan = () => { navigate('/plans?billing=live&sub=active&tab=plans'); setMoment({ moment: { ...m, phase: 'landing' } }) }

  return (
    <div ref={root} role={paid ? 'dialog' : 'status'} aria-modal={paid || undefined} aria-label={paid ? `You’re on ${plan.name}` : 'Confirming your payment'}
      data-skip={skip ? '' : undefined} onClick={() => paid && setSkip(true)}
      className={`moment fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-[var(--moment-bg)] text-[var(--moment-fg)] ${phase === 'processing' && !m.quiet ? 'mo-in' : ''}`}>
      {/* the pulse: one ring of light from the check, out past the corners, once */}
      {paid && <span aria-hidden className="mo-pulse pointer-events-none absolute left-1/2 top-[calc(50%-36px)] h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--moment-faint)]" style={{ '--mo-reach': reach }} />}
      <div data-mo-content className="relative flex w-full max-w-[560px] flex-col items-center px-6 text-center">
        {/* the name, then "You're on <plan>" in its place */}
        <div className="relative h-11 w-full">
          <p className={`absolute inset-0 text-kpi font-bold ${paid ? 'mo-out' : ''}`} style={{ '--d': '520ms' }}>{plan.name}</p>
          {paid && (
            <h1 className="absolute inset-0 text-kpi font-bold" aria-hidden>
              {words.map((w, i) => <span key={w} className="mo-word" style={{ '--d': `${600 + i * 70}ms` }}>{w}{i < words.length - 1 ? ' ' : ''}</span>)}
            </h1>
          )}
        </div>
        {/* the ring: drawing itself while we wait; on payment it closes, fills, and the check draws in */}
        <svg viewBox="0 0 40 40" width="88" height="88" aria-hidden className="mt-8">
          <circle cx="20" cy="20" r="17" fill="none" stroke="var(--moment-faint)" strokeWidth="3" />
          <g className={paid ? '' : `mo-ring ${phase === 'leaving' ? '[animation-play-state:paused]' : ''}`} style={{ transformOrigin: '20px 20px' }}>
            <circle cx="20" cy="20" r="17" fill="none" stroke="var(--moment-fg)" strokeWidth="3" strokeLinecap="round" pathLength="100" transform="rotate(-90 20 20)"
              className={paid ? 'mo-close' : `mo-arc ${phase === 'leaving' ? '[animation-play-state:paused] opacity-40' : ''}`} />
          </g>
          {paid && <circle cx="20" cy="20" r="18.5" fill="var(--moment-fg)" className="mo-disc" />}
          {paid && <path d="M13 20.5l4.6 4.6L27.5 15" fill="none" stroke="var(--moment-bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength="30" className="mo-check" />}
        </svg>
        {/* under the ring: what's happening, then the upgrade made concrete */}
        <div className="relative mt-8 min-h-[64px] w-full">
          <p className={`absolute inset-x-0 top-0 text-[15px] leading-[22px] text-[var(--moment-muted)] ${paid ? 'mo-out' : ''}`} style={{ '--d': '200ms' }}>Confirming your payment…</p>
          {paid && (
            <div className="mo-rise flex justify-center gap-10" style={{ '--d': '900ms' }}>
              {LIMITS.map(([label, key]) => <Gain key={key} label={label} from={from ? from[key] : null} to={plan[key]} skip={skip} />)}
            </div>
          )}
        </div>
        {paid && (
          <div className="mo-fade mt-10 flex flex-col items-center gap-5" style={{ '--d': '1950ms' }}>
            <p className="text-[14px] leading-5 text-[var(--moment-muted)] text-pretty">Your receipt is on its way to {WORKSPACE.owner}. Your plan renews <span className="font-semibold text-[var(--moment-fg)]"><DateTip iso={addMonths(TODAY, 1)} /></span>.</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" onClick={stop(toPlan)} className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--moment-faint)] px-4 text-[14px] font-medium text-[var(--moment-fg)] outline-none transition-colors duration-150 hover:bg-[var(--moment-faint)] focus-visible:ring-2 focus-visible:ring-[var(--moment-fg)]">See my plan</button>
              <button type="button" onClick={stop(toDashboard)} className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--moment-fg)] px-4 text-[14px] font-medium text-[var(--moment-bg)] outline-none transition-transform duration-150 active:scale-[.97] focus-visible:ring-2 focus-visible:ring-[var(--moment-fg)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--moment-bg)]">Go to the dashboard</button>
            </div>
          </div>
        )}
      </div>
      {paid && !skip && <span className="sr-only" role="status">You’re on {plan.name}. Payment received.</span>}
      {/* the ring's state for screen readers while we wait */}
      {!paid && <span className="sr-only">Confirming your payment</span>}
    </div>
  )
}
