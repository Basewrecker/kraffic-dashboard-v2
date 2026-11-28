import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, Check, ChevronDown, CreditCard, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { linkClick, navigate } from '../../router'
import { setParams, useParams } from '../../components/audit/parts'
import Select from '../../components/ui/Select'
import { PLANS } from '../../plan/catalog.js'
import { activePlan } from '../../plan/plan.js'
import RollNumber from '../../plan/RollNumber'
import { TODAY, addMonths, money, shortDate } from '../../billing/format.js'
import { WORKSPACE, billingState, priceOf } from '../../billing/state.js'
import { setMoment, useMoment } from '../../billing/moment.js'
import { Pending, StatusPill } from '../../billing/ui.jsx'
import { motionMs, motionValue, reducedMotion } from '../../lib/motionTokens'

// The checkout (owner, 2026-11-28): a full page that replaces the review dialog. /plans/checkout?plan=<id>&step=…
//   top     back arrow + "Checkout"; a 4-step stepper centred (Plan · Details · Payment · Done) whose line fills as you go
//   right   the order summary (sticky): plan, line items, "Due today" large, the step's pill button, "Renews … · cancel
//           anytime", then a quiet trust row. It stays put; only its values change (numbers roll)
//   left    1 Plan: the plans as selectable cards · 2 Details: billing name, company, receipt email, country, tax ID ·
//           3 Payment: the method list; Card shows a card picture over the card fields (Stripe's Payment Element in the
//           app, drawn to match our inputs) · 4 Done: the confirmation moment, the summary switching to "Paid"
// Steps slide in the direction of travel. Coming from a plan card, that card flies into its place here (step 1).
// 390: the summary is a bar at the bottom ("Due today $3,500 ▾" + the button); the stepper is "Step 2 of 4" + a bar.
// Test cards (as Stripe's): 4242… pays · 4000 0000 0000 0002 declined · …9995 not enough funds · …0069 expired ·
// 4000 0025 0000 3155 needs the bank's approval.
// States by ?cshow=: declined · bank · price · retired · subscribed · error. A team member: read-only (?who=member).
const STEPS = [['plan', 'Plan'], ['details', 'Details'], ['payment', 'Payment'], ['done', 'Done']]
const OLD_PRICE = { growth: 3200, visibility: 1800, authority: 5500 }
const DECLINE = {
  generic: 'Your bank didn’t approve the payment. Try another card or call your bank.',
  funds: 'The card doesn’t have enough funds.',
  expired: 'The card has expired.',
}
const brandOf = (n) => (/^4/.test(n) ? 'visa' : /^(5[1-5]|2[2-7])/.test(n) ? 'mastercard' : /^3[47]/.test(n) ? 'amex' : null)
const digits = (s) => s.replace(/\D/g, '')

// ---------------------------------------------------------------- the stepper: done ✓ · current ink · upcoming muted
function Stepper({ at, onGo }) {
  const i = STEPS.findIndex(([s]) => s === at)
  return (
    <>
      <ol className="hidden items-center md:flex" aria-label="Checkout steps">
        {STEPS.map(([id, label], k) => (
          <li key={id} className="flex items-center">
            {k > 0 && (
              <span aria-hidden className="relative mx-3 h-px w-14 bg-[var(--color-line-strong)]">
                {/* the line fills as you advance */}
                <span className="absolute inset-0 origin-left bg-ink transition-transform duration-[var(--motion-step)] ease-[var(--motion-ease-out)] motion-reduce:transition-none" style={{ transform: `scaleX(${k <= i ? 1 : 0})` }} />
              </span>
            )}
            <button type="button" disabled={k >= i || at === 'done'} onClick={() => onGo(id)} aria-current={k === i ? 'step' : undefined}
              className="flex items-center gap-2 rounded-full text-[13px] leading-[18px] outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-default">
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold tabular-nums transition-colors duration-200 ${k < i ? 'bg-tint text-ink' : k === i ? 'bg-ink text-on-ink' : 'border border-[var(--color-line-strong)] text-stone-500'}`}>
                {k < i ? <Check size={13} strokeWidth={2.5} aria-label="Done" /> : k + 1}
              </span>
              <span className={k === i ? 'font-semibold text-stone-900' : k < i ? 'text-stone-700' : 'text-stone-500'}>{label}</span>
            </button>
          </li>
        ))}
      </ol>
      {/* phones: "Step 2 of 4" and a bar */}
      <div className="w-full md:hidden">
        <p className="text-[13px] leading-[18px] text-stone-600">Step <span className="font-semibold text-stone-900 tabular-nums">{i + 1}</span> of 4 · {STEPS[i][1]}</p>
        <span aria-hidden className="mt-1.5 block h-1 overflow-hidden rounded-full bg-tint">
          <span className="block h-full origin-left rounded-full bg-ink transition-transform duration-[var(--motion-step)] ease-[var(--motion-ease-out)]" style={{ transform: `scaleX(${(i + 1) / 4})` }} />
        </span>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- inputs: label above, a rounded field
const fieldCls = (err) => `h-11 w-full rounded-xl border bg-raised px-3.5 text-[14px] leading-5 text-stone-900 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-stone-400 disabled:cursor-not-allowed disabled:opacity-60 focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--ink)_8%,transparent)] ${err ? 'border-negative' : 'border-line hover:border-[var(--color-line-strong)] focus:border-[color-mix(in_srgb,var(--ink)_35%,transparent)]'}`
function Field({ id, label, optional, hint, error, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] leading-[18px] font-medium text-stone-700">{label}{optional && <span className="font-normal text-stone-500"> (optional)</span>}</label>
      {children}
      {error ? <p className="mt-1.5 flex items-center gap-1.5 text-[12px] leading-4 text-negative"><AlertCircle size={13} aria-hidden />{error}</p>
        : hint ? <p className="mt-1.5 text-[12px] leading-4 text-stone-500 text-pretty">{hint}</p> : null}
    </div>
  )
}
const H = ({ children, sub }) => (
  <div className="mb-5">
    <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em] text-stone-900">{children}</h1>
    {sub && <p className="mt-1 text-[14px] leading-5 text-stone-600 text-pretty">{sub}</p>}
  </div>
)

// ---------------------------------------------------------------- 1 Plan
function PlanStep({ plans, picked, onPick, retired, readOnly }) {
  return (
    <>
      <H sub="You can change plans later from Billing.">Choose your plan</H>
      <div role="radiogroup" aria-label="Plans" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {plans.map((p) => {
          const on = p.id === picked
          const gone = retired === p.id
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} disabled={gone || readOnly} data-ck-plan={p.id} onClick={() => onPick(p.id)}
              className={`relative flex flex-col rounded-2xl border bg-surface p-4 text-left outline-none transition-[border-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed ${on ? 'border-ink shadow-[inset_0_0_0_1px_var(--ink)]' : 'border-line hover:border-[var(--color-line-strong)]'} ${gone ? 'opacity-50' : ''}`}>
              {/* selected: an ink check in the corner */}
              <span aria-hidden className={`absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full transition-[background-color,transform] duration-150 ${on ? 'scale-100 bg-ink text-on-ink' : 'scale-90 border border-[var(--color-line-strong)]'}`}>{on && <Check size={12} strokeWidth={3} />}</span>
              <span className="pr-7 text-[15px] leading-5 font-semibold text-stone-900">{p.name}</span>
              <span className="mt-2 text-[14px] leading-5 text-stone-600"><span className="font-semibold text-stone-900 tabular-nums">{money(priceOf(p.id))}</span> per month</span>
              <span className="mt-3 flex flex-col gap-1 border-t border-line pt-3 text-[13px] leading-[18px] text-stone-600 tabular-nums">
                <span><span className="font-medium text-stone-900">{p.prompts}</span> prompts</span>
                <span><span className="font-medium text-stone-900">{p.competitors}</span> competitors</span>
                <span><span className="font-medium text-stone-900">{p.logins}</span> logins</span>
                <span className="text-stone-500">{p.refresh}</span>
              </span>
              {gone && <span className="mt-3 text-[12px] leading-4 text-stone-500">No longer offered</span>}
            </button>
          )
        })}
      </div>
      {retired && <p className="mt-4 text-[13px] leading-[18px] text-stone-600">This plan is no longer offered. Pick another plan to continue.</p>}
    </>
  )
}

// ---------------------------------------------------------------- 2 Details
const COUNTRIES = [['US', 'United States'], ['GB', 'United Kingdom'], ['CA', 'Canada'], ['AU', 'Australia'], ['DE', 'Germany'], ['FR', 'France'], ['IN', 'India'], ['NL', 'Netherlands']]
function DetailsStep({ v, set, errors, readOnly }) {
  return (
    <>
      <H sub="These go on your invoices.">Billing details</H>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="ck-name" label="Billing name" error={errors.name}><input id="ck-name" autoComplete="name" disabled={readOnly} value={v.name} onChange={(e) => set({ name: e.target.value })} className={fieldCls(errors.name)} /></Field>
        <Field id="ck-company" label="Company" optional><input id="ck-company" autoComplete="organization" disabled={readOnly} value={v.company} onChange={(e) => set({ company: e.target.value })} className={fieldCls()} /></Field>
        <Field id="ck-email" label="Email for receipts" error={errors.email} className="sm:col-span-2"><input id="ck-email" type="email" autoComplete="email" disabled={readOnly} value={v.email} onChange={(e) => set({ email: e.target.value })} className={fieldCls(errors.email)} /></Field>
        <Field id="ck-country" label="Country"><Select label="Country" value={v.country} onChange={(c) => set({ country: c })} options={COUNTRIES} size="md" className="flex w-full [&_button]:!h-11 [&_button]:!rounded-xl" disabled={readOnly} /></Field>
        <Pending as="div" n="decision 7"><Field id="ck-tax" label="VAT or tax ID" optional hint="Shown on your invoices."><input id="ck-tax" disabled={readOnly} value={v.tax} onChange={(e) => set({ tax: e.target.value })} placeholder="e.g. GB123456789" className={fieldCls()} /></Field></Pending>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- 3 Payment
function BrandMark({ brand, light = false }) {
  if (brand === 'visa') return <span className={`text-[18px] font-extrabold italic tracking-[-0.02em] ${light ? 'text-[var(--moment-fg)]' : 'text-stone-900'}`}>VISA</span>
  if (brand === 'mastercard') return <span className="relative inline-flex h-5 w-8" aria-label="Mastercard"><span className="absolute left-0 h-5 w-5 rounded-full bg-[#EB001B]" /><span className="absolute right-0 h-5 w-5 rounded-full bg-[#F79E1B] mix-blend-multiply" /></span>
  if (brand === 'amex') return <span className={`text-[14px] font-extrabold tracking-[0.02em] ${light ? 'text-[var(--moment-fg)]' : 'text-stone-900'}`}>AMEX</span>
  return null
}
// the card picture: dark, a chip, the brand once detected, ·· last 4 once entered, the name and the expiry
function CardPicture({ card }) {
  const n = digits(card.number)
  const brand = brandOf(n)
  const full = n.length >= (brand === 'amex' ? 15 : 16)
  return (
    <div aria-hidden className="relative aspect-[1.586] w-full max-w-[340px] overflow-hidden rounded-2xl border border-[var(--moment-edge)] bg-[var(--moment-bg)] p-5 text-[var(--moment-fg)] shadow-[0_18px_36px_-18px_rgb(0_0_0/0.45)]">
      <div className="flex items-start justify-between">
        <span className="relative block h-7 w-10 rounded-md bg-[rgb(255_255_255/0.22)]"><span className="absolute inset-x-2 top-1/2 h-px bg-[rgb(255_255_255/0.35)]" /><span className="absolute inset-y-1.5 left-1/2 w-px bg-[rgb(255_255_255/0.35)]" /></span>
        <span key={brand ?? 'none'} className="mo-fade">{brand && <BrandMark brand={brand} light />}</span>
      </div>
      <p className="mt-7 text-[18px] leading-6 font-medium tracking-[0.12em] tabular-nums">{full ? `•• ${n.slice(-4)}` : n ? n.replace(/(.{4})/g, '$1 ').trim() : '•••• •••• •••• ••••'}</p>
      <div className="mt-4 flex items-end justify-between gap-4 text-[12px] leading-4">
        <span className="min-w-0"><span className="block text-[var(--moment-muted)]">Name</span><span className="block truncate text-[14px] leading-5 font-medium">{card.name || 'Your name'}</span></span>
        <span className="shrink-0 text-right"><span className="block text-[var(--moment-muted)]">Expires</span><span className="block text-[14px] leading-5 font-medium tabular-nums">{card.exp || 'MM/YY'}</span></span>
      </div>
    </div>
  )
}
function PaymentStep({ method, setMethod, card, setCard, errors, decline, bank, onTryAnother, onApprove, saved, readOnly, numberRef }) {
  const methods = [
    ...(saved ? [['saved', <span className="flex items-center gap-2"><BrandMark brand="visa" /><span className="text-stone-700">•• 4242</span><span className="text-stone-500">· expires 04/28</span></span>, 'Saved card']] : []),
    ['card', <span className="flex items-center gap-2"><CreditCard size={18} strokeWidth={1.75} className="text-stone-600" aria-hidden />Card</span>, 'Card'],
    ['apple', <span className="flex items-center gap-2"><svg aria-hidden viewBox="0 0 16 18" width="15" height="17" className="fill-current text-stone-900"><path d="M13.2 9.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.8-2.7-.7C4.8 4.9 3.5 5.7 2.8 7c-1.5 2.6-.4 6.4 1 8.5.7 1 1.5 2.1 2.6 2.1 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7s1.8-1 2.5-2c.8-1.2 1.1-2.3 1.1-2.4 0 0-2.2-.8-2.2-3.6zM11.2 3.4C11.8 2.7 12.1 1.8 12 .9c-.8 0-1.8.5-2.4 1.2-.5.6-1 1.5-.9 2.4.9.1 1.8-.4 2.5-1.1z" /></svg>Apple Pay</span>, 'Apple Pay'],
    ['google', <span className="flex items-center gap-2"><span aria-hidden className="text-[15px] font-bold leading-none"><span className="text-[#4285F4]">G</span></span>Google Pay</span>, 'Google Pay'],
  ]
  return (
    <>
      <H sub="You’re charged today, then each month until you cancel.">Payment</H>
      <div role="radiogroup" aria-label="Payment method" className="overflow-hidden rounded-2xl border border-line bg-surface">
        {methods.map(([id, label, name], k) => (
          <button key={id} type="button" role="radio" aria-checked={method === id} aria-label={name} disabled={readOnly} onClick={() => setMethod(id)}
            className={`flex h-14 w-full items-center justify-between gap-3 px-4 text-left text-[14px] leading-5 font-medium text-stone-900 outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint disabled:cursor-not-allowed ${k ? 'border-t border-line' : ''}`}>
            {label}
            {/* the radio */}
            <span aria-hidden className={`grid h-5 w-5 place-items-center rounded-full border transition-colors duration-150 ${method === id ? 'border-ink' : 'border-[var(--color-line-strong)]'}`}>{method === id && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}</span>
          </button>
        ))}
      </div>
      {(method === 'apple' || method === 'google') && <Pending as="p" n="card only in v1" className="mt-3 text-[12px] leading-4 text-stone-500">Shown only when your browser supports it. You’ll confirm in the {method === 'apple' ? 'Apple Pay' : 'Google Pay'} sheet.</Pending>}
      {method === 'card' && (
        <div className="ck-reveal mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex justify-center lg:justify-start"><CardPicture card={card} /></div>
          {/* Stripe's Payment Element in the app, drawn to match our inputs */}
          <div className="flex flex-col gap-4">
            <Field id="ck-num" label="Card number" error={errors.number}>
              <div className="relative">
                <input ref={numberRef} id="ck-num" inputMode="numeric" autoComplete="cc-number" disabled={readOnly} placeholder="1234 1234 1234 1234" value={card.number}
                  onChange={(e) => setCard({ number: digits(e.target.value).slice(0, 16).replace(/(.{4})/g, '$1 ').trim() })} className={`${fieldCls(errors.number || decline)} pr-14 tabular-nums`} />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2"><BrandMark brand={brandOf(digits(card.number))} /></span>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="ck-exp" label="Expiry" error={errors.exp}><input id="ck-exp" inputMode="numeric" autoComplete="cc-exp" disabled={readOnly} placeholder="MM / YY" value={card.exp} onChange={(e) => { const d = digits(e.target.value).slice(0, 4); setCard({ exp: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }) }} className={`${fieldCls(errors.exp)} tabular-nums`} /></Field>
              <Field id="ck-cvc" label="Security code" error={errors.cvc}><input id="ck-cvc" inputMode="numeric" autoComplete="cc-csc" disabled={readOnly} placeholder="CVC" value={card.cvc} onChange={(e) => setCard({ cvc: digits(e.target.value).slice(0, 4) })} className={`${fieldCls(errors.cvc)} tabular-nums`} /></Field>
            </div>
            <Field id="ck-cname" label="Name on card" error={errors.cname}><input id="ck-cname" autoComplete="cc-name" disabled={readOnly} value={card.name} onChange={(e) => setCard({ name: e.target.value })} className={fieldCls(errors.cname)} /></Field>
            {/* declined: under the card fields, the reason and a way out */}
            {decline && (
              <div role="alert" className="ck-reveal rounded-xl border border-line bg-surface px-4 py-3">
                <p className="flex items-start gap-2 text-[13px] leading-[18px] text-negative"><AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden />{decline} Nothing was charged.</p>
                <button type="button" onClick={onTryAnother} className="mt-2 rounded text-[13px] font-medium text-ink underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-focus">Try another card</button>
              </div>
            )}
            {bank && (
              <div role="status" className="ck-reveal rounded-xl border border-line bg-surface px-4 py-3">
                <p className="flex items-start gap-2 text-[13px] leading-[18px] text-stone-700"><ShieldCheck size={15} className="mt-px shrink-0 text-stone-600" aria-hidden />Your bank needs to approve this payment. A window from your bank opens to confirm it.</p>
                <button type="button" onClick={onApprove} className="mt-2 rounded text-[13px] font-medium text-ink underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-focus">Approve with my bank</button>
              </div>
            )}
            <label className="flex items-start gap-2.5 text-[13px] leading-[18px] text-stone-700">
              <input type="checkbox" checked readOnly disabled className="mt-0.5 h-4 w-4 accent-[var(--ink)]" />
              <span><span className="font-medium text-stone-900">Save card for renewals</span><span className="block text-[12px] leading-4 text-stone-500">Needed for a subscription: we charge this card each month until you cancel.</span></span>
            </label>
          </div>
        </div>
      )}
      <p className="mt-6 flex items-center gap-1.5 text-[12px] leading-4 text-stone-500"><Lock size={12} aria-hidden />Secure &amp; encrypted</p>
    </>
  )
}

// ---------------------------------------------------------------- 4 Done: the confirmation moment, in the page
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
    <div className="flex min-w-[88px] flex-col items-center">
      <span className="text-[13px] leading-[18px] text-[var(--moment-muted)]">{label}</span>
      <span className="mt-1 flex items-baseline gap-2"><span className="text-h1 font-semibold tabular-nums">{n}</span>{delta > 0 && <span className="mo-fade text-[13px] font-semibold tabular-nums text-[var(--moment-up)]" style={{ '--d': '1720ms' }}>+{delta}</span>}</span>
    </div>
  )
}
function DoneStep({ plan, from, onDashboard, onPlan }) {
  const [skip, setSkip] = useState(false)
  const words = ['You’re', 'on', plan.name]
  const stop = (fn) => (e) => { e.stopPropagation(); fn(e) }
  return (
    // ~2.5s; a click anywhere skips to the end
    <div role="status" data-skip={skip ? '' : undefined} onClick={() => setSkip(true)}
      className="moment relative flex min-h-[520px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-[var(--moment-edge)] bg-[var(--moment-bg)] px-6 py-12 text-center text-[var(--moment-fg)]">
      <span aria-hidden className="mo-pulse pointer-events-none absolute left-1/2 top-[calc(50%-92px)] h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--moment-faint)]" style={{ '--mo-reach': 16 }} />
      <svg viewBox="0 0 40 40" width="88" height="88" aria-hidden className="relative">
        <circle cx="20" cy="20" r="17" fill="none" stroke="var(--moment-faint)" strokeWidth="3" />
        <circle cx="20" cy="20" r="17" fill="none" stroke="var(--moment-fg)" strokeWidth="3" strokeLinecap="round" pathLength="100" transform="rotate(-90 20 20)" className="mo-close" />
        <circle cx="20" cy="20" r="18.5" fill="var(--moment-fg)" className="mo-disc" />
        <path d="M13 20.5l4.6 4.6L27.5 15" fill="none" stroke="var(--moment-bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength="30" className="mo-check" />
      </svg>
      <h1 className="relative mt-7 text-kpi font-bold">{words.map((w, i) => <span key={w} className="mo-word" style={{ '--d': `${600 + i * 70}ms` }}>{w}{i < words.length - 1 ? ' ' : ''}</span>)}</h1>
      <div className="mo-rise relative mt-7 flex justify-center gap-8" style={{ '--d': '900ms' }}>
        {[['Prompts', 'prompts'], ['Competitors', 'competitors'], ['Logins', 'logins']].map(([l, k]) => <Gain key={k} label={l} from={from ? from[k] : null} to={plan[k]} skip={skip} />)}
      </div>
      <div className="mo-fade relative mt-9 flex flex-col items-center gap-5" style={{ '--d': '1950ms' }}>
        <p className="max-w-[420px] text-[14px] leading-5 text-[var(--moment-muted)] text-pretty">Your receipt is on its way to {WORKSPACE.owner}.</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={stop(onPlan)} className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--moment-faint)] px-5 text-[14px] font-medium outline-none transition-colors duration-150 hover:bg-[var(--moment-faint)] focus-visible:ring-2 focus-visible:ring-[var(--moment-fg)]">See my plan</button>
          <button type="button" onClick={stop(onDashboard)} className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--moment-fg)] px-5 text-[14px] font-medium text-[var(--moment-bg)] outline-none transition-transform duration-150 active:scale-[.97] focus-visible:ring-2 focus-visible:ring-[var(--moment-fg)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--moment-bg)]">Go to the dashboard</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- the order summary
function Summary({ plan, step, primary, wasPrice, paid, compact = false }) {
  const price = priceOf(plan.id)
  return (
    <section aria-label="Order summary" className={compact ? '' : 'rounded-2xl border border-line bg-surface p-5'}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] leading-5 font-semibold text-stone-900">{plan.name}</p>
          <p className="mt-0.5 text-[13px] leading-[18px] text-stone-500 tabular-nums">{plan.prompts} prompts · {plan.competitors} competitors · {plan.logins} logins</p>
        </div>
        {paid && <StatusPill className="mo-fade"><Check size={12} strokeWidth={2.5} aria-hidden />Paid</StatusPill>}
      </div>
      <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-[14px] leading-5">
        <div className="flex justify-between gap-3"><dt className="text-stone-600">{plan.name}, monthly</dt><dd className="text-stone-900 tabular-nums"><RollNumber value={price} format={money} /></dd></div>
        {/* no tax line unless the invoice has one (pending decision 7) */}
      </dl>
      <div className="mt-4 border-t border-line pt-4">
        <p className="text-[13px] leading-[18px] text-stone-500">{paid ? 'Paid today' : 'Due today'}</p>
        <Pending as="p" n="decision 6" className="mt-0.5 flex items-baseline gap-2 whitespace-nowrap">
          <span className="text-kpi font-bold tabular-nums text-stone-900"><RollNumber value={price} format={money} /></span>
          {wasPrice != null && <span className="text-[13px] leading-[18px] text-stone-500 line-through tabular-nums">{money(wasPrice)}</span>}
        </Pending>
        {wasPrice != null && <p className="mt-1 text-[12px] leading-4 text-stone-600">The price changed since you opened this page.</p>}
      </div>
      {primary && <div className="mt-5">{primary}</div>}
      {paid
        ? <button type="button" className="mt-4 rounded text-[13px] font-medium text-ink underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-focus">Download receipt</button>
        : <p className="mt-3 text-center text-[13px] leading-[18px] text-stone-500 tabular-nums">Renews {shortDate(addMonths(TODAY, 1))} · cancel anytime</p>}
    </section>
  )
}
// the step's pill button: press 0.97; while paying it turns into a progress bar running left to right
function PillButton({ label, onClick, busy, busyLabel = 'Paying…', off, full = true }) {
  if (off) {
    return (
      <span tabIndex={0} aria-label={`${label}. ${off}`} className="group/pb relative block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus">
        <button type="button" disabled className="h-11 w-full cursor-not-allowed rounded-full bg-ink px-5 text-[15px] font-medium text-on-ink opacity-50">{label}</button>
        <span role="tooltip" className="tip-dark pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover/pb:opacity-100 group-focus-visible/pb:opacity-100">{off}</span>
      </span>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={busy} aria-busy={busy || undefined}
      className={`relative inline-flex h-11 items-center justify-center overflow-hidden rounded-full bg-ink px-5 text-[15px] leading-5 font-medium text-on-ink outline-none transition-[background-color,transform] duration-150 hover:bg-ink-hover active:scale-[.97] focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-default motion-reduce:transform-none ${full ? 'w-full' : ''}`}>
      <span aria-hidden data-run={busy ? '' : undefined} className="pay-bar absolute inset-0 bg-[color-mix(in_srgb,var(--on-ink)_22%,transparent)] motion-reduce:hidden" />
      <span className="relative tabular-nums">{busy ? busyLabel : label}</span>
    </button>
  )
}

export default function Checkout() {
  const params = useParams()
  const b = billingState()
  const show = params.get('cshow')
  const step = STEPS.some(([s]) => s === params.get('step')) ? params.get('step') : 'plan'
  const group = (PLANS.find((p) => p.id === params.get('plan')) ?? PLANS[1]).group
  const plans = PLANS.filter((p) => p.group === group && priceOf(p.id) != null)
  const [picked, setPicked] = useState(plans.some((p) => p.id === params.get('plan')) ? params.get('plan') : plans[1]?.id ?? plans[0].id)
  const plan = PLANS.find((p) => p.id === picked)
  const fromPlan = PLANS.find((p) => p.id === (params.get('from') ?? activePlan().id)) ?? null
  const readOnly = b.who !== 'owner'
  const offWhy = b.who === 'viewas' ? 'Can’t change plans from this view' : b.who === 'member' ? 'Only the account owner can change the plan.' : null
  const [details, setDetails] = useState({ name: 'Maya Chen', company: 'Dermasuri Skincare Inc.', email: WORKSPACE.owner, country: 'US', tax: '' })
  const [method, setMethod] = useState(params.get('saved') ? 'saved' : 'card')
  const [card, setCard] = useState(show === 'declined' ? { number: '4000 0000 0000 0002', exp: '04/28', cvc: '123', name: 'Maya Chen' } : show === 'bank' ? { number: '4000 0025 0000 3155', exp: '04/28', cvc: '123', name: 'Maya Chen' } : { number: '', exp: '', cvc: '', name: '' })
  const [errors, setErrors] = useState({})
  const [paying, setPaying] = useState(false)
  const [decline, setDecline] = useState(show === 'declined' ? DECLINE.generic : null)
  const [bank, setBank] = useState(show === 'bank')
  const [failed, setFailed] = useState(show === 'error')
  const [dir, setDir] = useState(1)
  const [sheet, setSheet] = useState(false)
  const numberRef = useRef(null)
  const go = (s) => { setDir(STEPS.findIndex(([x]) => x === s) >= STEPS.findIndex(([x]) => x === step) ? 1 : -1); setParams({ step: s, cshow: null }, { push: true }); window.scrollTo({ top: 0 }) }
  // coming from a plan card: it lands on its place in step 1 (the Plans card lifted; here it flies in)
  const { pick } = useMoment()
  useLayoutEffect(() => {
    if (!pick || step !== 'plan' || reducedMotion()) { if (pick) setMoment({ pick: null }); return }
    const el = document.querySelector(`[data-ck-plan="${pick.planId}"]`)
    if (el) {
      const E = el.getBoundingClientRect(), C = pick.rect
      const s = Math.min(1.6, C.width / E.width)
      el.animate([{ transform: `translate(${C.left - E.left}px, ${C.top - E.top}px) scale(${s})`, transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }],
        { duration: motionMs('--motion-morph-long'), easing: motionValue('--motion-spring') })
      document.querySelectorAll('[data-ck-plan]').forEach((o) => { if (o !== el) o.animate([{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }], { duration: motionMs('--motion-morph-long') + 100 }) })
      document.querySelector('[data-ck-summary]')?.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 200, easing: motionValue('--motion-ease-out'), fill: 'backwards' })
    }
    setMoment({ pick: null })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const validDetails = () => {
    const e = {}
    if (!details.name.trim()) e.name = 'Enter a billing name.'
    if (!/^\S+@\S+\.\S+$/.test(details.email)) e.email = 'Enter an email for receipts.'
    setErrors(e); return !Object.keys(e).length
  }
  const validCard = () => {
    if (method !== 'card') return true
    const e = {}, n = digits(card.number)
    if (n.length < (brandOf(n) === 'amex' ? 15 : 16)) e.number = 'Enter the full card number.'
    const [mm, yy] = card.exp.split('/').map(Number)
    if (!mm || mm > 12 || !yy || 2000 + yy < 2026 || (2000 + yy === 2026 && mm < 12)) e.exp = 'Enter a valid expiry date.'
    if (card.cvc.length < 3) e.cvc = 'Enter the security code.'
    if (!card.name.trim()) e.cname = 'Enter the name on the card.'
    setErrors(e); return !Object.keys(e).length
  }
  const succeed = () => { setPaying(false); setBank(false); go('done') }
  const pay = () => {
    if (!validCard()) return
    setDecline(null); setFailed(false); setPaying(true)
    const n = digits(card.number)
    setTimeout(() => {
      if (method === 'card' && n === '4000000000000002') { setPaying(false); setDecline(DECLINE.generic) }
      else if (method === 'card' && n === '4000000000009995') { setPaying(false); setDecline(DECLINE.funds) }
      else if (method === 'card' && n === '4000000000000069') { setPaying(false); setDecline(DECLINE.expired) }
      else if (method === 'card' && n === '4000002500003155') { setPaying(false); setBank(true) }
      else succeed()
    }, 1500)
  }
  const tryAnother = () => { setDecline(null); setCard({ number: '', exp: '', cvc: '', name: card.name }); requestAnimationFrame(() => numberRef.current?.focus()) }
  const leave = () => navigate('/plans?billing=live')
  const toPlan = () => { navigate('/plans?billing=live&sub=active&tab=plans'); setMoment({ landed: plan.id }); setTimeout(() => setMoment({ landed: null }), 700) }
  const toDashboard = () => navigate('/overview?billing=live&sub=active')

  // states that replace the page
  if (show === 'subscribed' || (b.hasSub && ['active', 'cancelling', 'pastdue'].includes(b.status) && step !== 'done')) {
    return (
      <Shell step="plan" onBack={leave} onGo={go}>
        <div className="mx-auto max-w-[480px] rounded-2xl border border-line bg-surface px-6 py-10 text-center">
          <h1 className="text-[22px] leading-7 font-semibold text-stone-900">You already have a plan</h1>
          <p className="mt-2 text-[14px] leading-5 text-stone-600">You’re on {b.plan.name}. To change it, open Billing.</p>
          <div className="mt-6 flex justify-center gap-2"><PillButton full={false} label="Manage subscription" onClick={() => navigate('/plans?billing=live&tab=billing')} /></div>
        </div>
      </Shell>
    )
  }

  const priceChanged = show === 'price' ? OLD_PRICE[plan.id] ?? null : null
  const retired = show === 'retired' ? params.get('plan') ?? 'growth' : null
  const blocked = retired === picked
  const primary = step === 'done' ? null
    : step === 'plan' ? <PillButton label="Continue" onClick={() => go('details')} off={offWhy ?? (blocked ? 'Pick another plan to continue.' : null)} />
      : step === 'details' ? <PillButton label="Continue" onClick={() => validDetails() && go('payment')} off={offWhy} />
        : <PillButton label={`Pay ${money(priceOf(plan.id))}`} onClick={bank ? undefined : pay} busy={paying} off={offWhy ?? (bank ? 'Approve the payment with your bank first.' : null)} />
  const err = failed && step === 'payment' && <p role="alert" className="mt-3 flex items-start gap-1.5 text-[12px] leading-4 text-negative"><AlertCircle size={13} className="mt-px shrink-0" aria-hidden />Couldn’t take the payment. Nothing was charged. Try again.</p>

  return (
    <Shell step={step} onBack={step === 'plan' || step === 'done' ? leave : () => go(STEPS[STEPS.findIndex(([s]) => s === step) - 1][0])} onGo={go}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
        {/* the left column slides in the direction of travel */}
        <div key={step} className="ck-step min-w-0" style={{ '--ck-dir': dir }}>
          {readOnly && step !== 'done' && <p className="mb-4 text-[13px] leading-[18px] text-stone-500">{offWhy} You can look but not change anything.</p>}
          {step === 'plan' && <PlanStep plans={plans} picked={picked} onPick={setPicked} retired={retired} readOnly={readOnly} />}
          {step === 'details' && <DetailsStep v={details} set={(p) => setDetails((d) => ({ ...d, ...p }))} errors={errors} readOnly={readOnly} />}
          {step === 'payment' && <PaymentStep method={method} setMethod={(m) => { setMethod(m); setDecline(null) }} card={card} setCard={(p) => { setCard((c) => ({ ...c, ...p })); setDecline(null); setErrors({}) }} errors={errors} decline={decline} bank={bank} onTryAnother={tryAnother} onApprove={() => { setPaying(true); setBank(false); setTimeout(succeed, 1200) }} saved={Boolean(params.get('saved'))} readOnly={readOnly} numberRef={numberRef} />}
          {step === 'done' && <DoneStep plan={plan} from={fromPlan && fromPlan.id !== plan.id ? fromPlan : null} onDashboard={toDashboard} onPlan={toPlan} />}
        </div>
        {/* the summary: sticky on the right (lg); phones: a bar at the bottom */}
        <aside data-ck-summary className={step === 'done' ? 'block' : 'hidden lg:block'}>{/* phones: shown under the moment once paid (the bar is gone) */}
          <div className="sticky top-6">
            <Summary plan={plan} step={step} primary={<>{primary}{err}</>} wasPrice={priceChanged} paid={step === 'done'} />
            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[12px] leading-4 text-stone-500">
              <span className="inline-flex items-center gap-1"><Lock size={12} aria-hidden />Secure payment by Stripe</span><span aria-hidden>·</span><span>Cancel anytime</span><span aria-hidden>·</span>
              <a href={`mailto:${WORKSPACE.support}`} className="rounded text-stone-600 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-focus outline-none">Support</a>
            </p>
          </div>
        </aside>
      </div>
      {/* phones: "Due today $3,500 ▾" + the button; the arrow opens the summary above it */}
      {step !== 'done' && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 lg:hidden">
          <div className={`grid transition-[grid-template-rows] duration-200 ease-[var(--motion-ease-out)] motion-reduce:transition-none ${sheet ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`} inert={sheet ? undefined : ''}>
            <div className="min-h-0 overflow-hidden"><div className="pb-4"><Summary plan={plan} step={step} wasPrice={priceChanged} compact /></div></div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" aria-expanded={sheet} onClick={() => setSheet((o) => !o)} className="flex min-w-0 flex-1 flex-col items-start rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <span className="text-[12px] leading-4 text-stone-500">Due today</span>
              <span className="flex items-center gap-1 text-[18px] leading-6 font-bold tabular-nums text-stone-900">{money(priceOf(plan.id))}<ChevronDown size={16} aria-hidden className={`transition-transform duration-200 ${sheet ? 'rotate-180' : ''}`} /></span>
            </button>
            <div className="w-[58%]">{primary}</div>
          </div>
          {err}
        </div>
      )}
    </Shell>
  )
}

// the frame: no sidebar; back arrow + "Checkout" left, the stepper centred
function Shell({ step, onBack, onGo, children }) {
  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-30 border-b border-[var(--div)] bg-[color-mix(in_srgb,var(--color-page)_92%,transparent)] backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-3 px-4 py-3 md:h-16 md:flex-row md:items-center md:px-6 md:py-0">
          <div className="flex items-center gap-2 md:w-48">
            <button type="button" onClick={onBack} aria-label="Back" className="-ml-2 grid h-9 w-9 place-items-center rounded-lg text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><ArrowLeft size={18} aria-hidden /></button>
            <span className="text-[16px] leading-6 font-semibold text-stone-900">Checkout</span>
          </div>
          <div className="flex flex-1 justify-center"><Stepper at={step} onGo={onGo} /></div>
          <div className="hidden md:block md:w-48" />
        </div>
      </header>
      <main className="mx-auto max-w-[1180px] px-4 pb-40 pt-8 md:px-6 lg:pb-16 lg:pt-10">{children}</main>
    </div>
  )
}
