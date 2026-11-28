import { useEffect, useId, useState } from 'react'
import { Lock } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { navigate } from '../../router'
import { setParams, useParams } from '../../components/audit/parts'
import { PLANS } from '../../plan/catalog.js'
import { TODAY, addMonths, money, shortDate } from '../../billing/format.js'
import { WORKSPACE, priceOf } from '../../billing/state.js'
import { B, Btn, InlineError, Pending, Skeleton } from '../../billing/ui.jsx'

// Screen 2. Checkout: our review step, before the payment page (which we don't design). A summary you confirm, not a
// block of text (owner, 2026-11-28). The shared Modal (520px; a bottom sheet on phones) over the Plans page, opened by
// ?review=<plan>; /plans/review?plan=<plan> is the full-page fallback for links from email. Owner only.
//   1 the plan as a compact card (name, limits, "Change" back to Plans)
//   2 the total, the screen's one bold number: "Due today", the big number, "per month"
//   3 a two-step timeline: Today · the renewal date, then every month
//   4 the terms in one line, with "Full terms" opening the rest (the expand motion)
//   5 a muted footer line: secure payment, the seller, the currency
// What auto-renewal rules ask to be shown before paying stays in view without opening anything: that it renews, how
// much, how often, and how to cancel (the timeline and the terms line, right above the pay button).
// States, by ?rshow=: loading · creating ("Opening…") · open (a payment was already started) · subscribed · price
// (the price changed since the page loaded) · seller (can't take payments) · error · retired. The account's own state
// picks some by itself (a pending payment → open; an active plan → subscribed; a paused seller → seller).
const OLD_PRICE = { growth: 3200, visibility: 1800, authority: 5500 } // sample: the price the page loaded with (?rshow=price)

// the plan as a compact card; "Change" goes back to the plans
function PlanSummary({ plan, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-line px-4 py-3">
      <div className="min-w-0">
        <p className="text-[15px] leading-5 font-semibold text-stone-900">{plan.name}</p>
        <p className="mt-0.5 text-[13px] leading-[18px] text-stone-500 tabular-nums">{plan.prompts} prompts · {plan.competitors} competitors · {plan.logins} logins</p>
      </div>
      <button type="button" onClick={onChange} className="shrink-0 rounded text-[13px] leading-5 font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Change</button>
    </div>
  )
}

// the total: the screen's one bold number, the same size and weight as the plan cards' big numbers
function Total({ price, was }) {
  return (
    <div className="mt-5">
      <p className="text-[13px] leading-[18px] text-stone-500">Due today</p>
      <Pending as="p" n="decision 6" className="mt-0.5 whitespace-nowrap">
        <span className="text-kpi font-bold tabular-nums text-stone-900">{money(price)}</span> <span className="text-[13px] leading-[18px] text-stone-500">per month</span>
      </Pending>
      {/* the price changed since the page loaded: what it was, muted */}
      {was != null && <p className="mt-1 text-[13px] leading-[18px] text-stone-500 tabular-nums">Was <span className="line-through">{money(was)}</span> per month</p>}
    </div>
  )
}

// two steps, a small dot each and a line between: what is charged today, then what renews and when
function Timeline({ price }) {
  const renews = addMonths(TODAY, 1)
  const steps = [['Today', <>{money(price)}</>], [shortDate(renews), <>{money(price)}, then every month</>]]
  return (
    <ol className="mt-5" aria-label="Payments">
      {steps.map(([when, what], i) => (
        <li key={when} className="relative flex items-baseline gap-3 pb-3 last:pb-0 text-[14px] leading-5">
          {/* the dot, and the line down to the next one */}
          <span aria-hidden className="relative top-[-1px] h-2 w-2 shrink-0 self-center rounded-full bg-ink" />
          {i < steps.length - 1 && <span aria-hidden className="absolute left-[3.5px] top-[14px] h-[calc(100%-8px)] w-px bg-[var(--color-line-strong)]" />}
          <span className="w-14 shrink-0 font-medium text-stone-900 tabular-nums">{when}</span>
          <span className="text-stone-600 tabular-nums">{what}</span>
        </li>
      ))}
    </ol>
  )
}

// the terms: one line in view; "Full terms" opens the rest with the expand motion (rows 0fr ↔ 1fr, 200ms; reduced
// motion: it just opens)
function Terms() {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    // 12px so the one line stays one line in the 520px dialog (the timeline above carries the amounts)
    // (at the laptop scale the 11px floor makes it 4px too long for one line, so it is set a hair tighter)
    <div className="mt-5 text-[12px] leading-[18px] text-stone-600">
      <p className="tracking-[-0.01em]">
        Renews monthly until you cancel. Cancel anytime from Billing.{' '}
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
          className="whitespace-nowrap rounded font-medium text-ink underline underline-offset-2 outline-none hover:decoration-2 focus-visible:ring-2 focus-visible:ring-focus">
          {/* underlined, no chevron: it fits on the terms line, so the line stays one line */}
          Full terms{/* the same words open or closed (aria-expanded says which), so the line never re-wraps */}
        </button>
      </p>
      <div id={id} className={`grid transition-[grid-template-rows] duration-200 ease-[var(--motion-ease-out)] motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`} inert={open ? undefined : ''}>
        <ul className="min-h-0 overflow-hidden">
          <li className="pt-2 text-pretty">Cancel from Billing in your account, or email <Pending n="conflict 4">{WORKSPACE.support}</Pending>.</li>
          <li className="pt-1 text-pretty">Cancelling stops the next renewal. Your current month stays active until it ends.</li>
          <li className="pt-1 text-pretty">We’ll email you before each renewal.</li>
        </ul>
      </div>
    </div>
  )
}

// secure payment, the seller, the currency: one small muted line
const Fine = () => (
  <p className="mt-5 flex items-center gap-1.5 text-[12px] leading-4 text-stone-500">
    <Lock size={12} aria-hidden className="shrink-0" />
    <span>Secure payment by Stripe · Sold by {WORKSPACE.legalName} · <Pending n="decision 7">USD</Pending></span>
  </p>
)

// what the step shows: { title, body, primary, secondary, error }
function useReview(b, plan, show, close, toPlans) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(show === 'error')
  useEffect(() => { setFailed(show === 'error'); setBusy(show === 'creating') }, [show])
  if (!plan) return null
  const price = priceOf(plan.id)
  const back = `/plans${window.location.search.replace(/[?&]review=[^&]*/, '').replace(/^&/, '?')}`
  const toPay = () => {
    // a double click opens one checkout only: the button is off while the payment page opens
    setBusy(true); setFailed(false)
    setTimeout(() => navigate(`/plans/pay?kind=checkout&plan=${plan.id}&back=${encodeURIComponent(back)}`), 800)
  }
  const state = show ?? (b.seller === 'paused' ? 'seller' : b.status === 'pending' ? 'open' : b.hasSub && ['active', 'cancelling', 'pastdue'].includes(b.status) ? 'subscribed' : 'ready')
  const summary = (was) => (
    <>
      <PlanSummary plan={plan} onChange={toPlans} />
      <Total price={price} was={was} />
      <Timeline price={price} />
      {/* a demo account: one more line */}
      {b.status === 'demo' && <p className="mt-3 text-[13px] leading-[18px] text-stone-600">Your demo moves to {plan.name} once this payment goes through.</p>}
      <Terms />
      <Fine />
    </>
  )
  const pay = { label: `Pay ${money(price)}`, onClick: toPay, busy }
  const msg = (text) => <p className="text-[14px] leading-5 text-stone-700 text-pretty">{text}</p>
  const S = {
    loading: {
      title: 'Review your plan',
      body: <div aria-busy="true" aria-label="Loading your plan" className="flex flex-col"><Skeleton className="h-[62px] !rounded-xl" /><Skeleton className="mt-5 h-4 w-20" /><Skeleton className="mt-1.5 h-10 w-44" /><Skeleton className="mt-5 h-12 w-64" /><Skeleton className="mt-5 h-4 w-80" /></div>,
      primary: { label: 'Continue to payment', disabled: true }, secondary: { label: 'Back', onClick: close },
    },
    ready: { title: 'Review your plan', body: summary(), primary: pay, secondary: { label: 'Back', onClick: close, disabled: busy } },
    creating: { title: 'Review your plan', body: summary(), primary: { ...pay, busy: true }, secondary: { label: 'Back', onClick: close, disabled: true } },
    error: { title: 'Review your plan', body: summary(), primary: { ...pay, label: 'Retry' }, secondary: { label: 'Back', onClick: close }, error: 'Couldn’t open the payment page. Nothing was charged.' },
    price: { title: 'This plan’s price has changed', body: summary(OLD_PRICE[plan.id] ?? null), primary: pay, secondary: { label: 'Back', onClick: close } },
    open: {
      title: 'You’ve already started this payment',
      body: msg(<>Your payment for {(b.pending?.plan ?? plan).name} is held until <Pending n="decision 13"><B>{shortDate(b.pending?.heldUntil ?? TODAY)}</B>, {b.pending?.heldTime ?? '2:14 PM'}</Pending>. Pick up where you left off.</>),
      primary: { label: 'Finish payment', onClick: toPay, busy },
      secondary: { label: 'Choose another plan', confirm: `Start over with ${plan.name}? Your earlier payment page will close.`, onClick: close },
    },
    subscribed: {
      title: 'You already have a plan',
      body: msg(<>You’re on {b.plan.name}. To change it, open Billing.</>),
      primary: { label: 'Manage subscription', onClick: () => setParams({ review: null, rshow: null, tab: 'billing' }) }, secondary: { label: 'Close', onClick: close },
    },
    seller: { title: 'Online payment isn’t available right now', body: msg('Talk to us and we’ll set up your plan.'), primary: { label: 'Talk to us', onClick: close }, secondary: { label: 'Close', onClick: close } },
    retired: { title: 'This plan is no longer offered', body: msg('Pick another plan to continue.'), primary: { label: 'See plans', onClick: toPlans } },
  }[failed && state !== 'error' ? 'error' : state]
  return S
}

function Actions({ S }) {
  const [asking, setAsking] = useState(false)
  const sec = S.secondary
  return (
    <>
      {sec ? (
        asking
          ? <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[13px] leading-[18px] text-stone-700"><span className="text-pretty">{sec.confirm}</span><Btn look="line" size="sm" onClick={sec.onClick}>Start over</Btn><Btn look="quiet" size="sm" onClick={() => setAsking(false)}>Keep it</Btn></span>
          : <Btn look="quiet" disabled={sec.disabled} onClick={sec.confirm ? () => setAsking(true) : sec.onClick}>{sec.label}</Btn>
      ) : <span />}
      {!asking && <Btn look="ink" busy={S.primary.busy} disabled={S.primary.disabled} onClick={S.primary.onClick} className="max-md:w-full">{S.primary.label}</Btn>}
    </>
  )
}
const Error = ({ S }) => (S.error ? <InlineError className="mt-4">{S.error}</InlineError> : null)

export default function ReviewModal({ b }) {
  const params = useParams()
  const id = params.get('review')
  const plan = PLANS.find((p) => p.id === id) ?? null
  // "Back" (and "Change") close the dialog; focus returns to the "Subscribe" button that opened it (the Modal does that)
  const close = () => setParams({ review: null, rshow: null })
  const S = useReview(b, plan, id ? params.get('rshow') : null, close, close)
  return (
    <Modal open={Boolean(plan)} onClose={close} title={S?.title ?? 'Review your plan'} footer={S && <Actions S={S} />}>
      {S && <>{S.body}<Error S={S} /></>}
    </Modal>
  )
}

// /plans/review?plan=growth : the same step as a page, for links from email
export function ReviewPage({ b }) {
  const params = useParams()
  const plan = PLANS.find((p) => p.id === (params.get('plan') ?? 'growth'))
  const toPlans = () => navigate('/plans?billing=live')
  const S = useReview(b, plan, params.get('rshow'), toPlans, toPlans)
  if (!S) return null
  return (
    <div className="mx-auto w-full max-w-[520px] py-4">
      <section aria-labelledby="review-title" className="rounded-2xl border border-line bg-surface">
        <div className="px-6 pb-5 pt-6">
          <h1 id="review-title" className="mb-4 text-[20px] leading-7 font-semibold text-stone-900">{S.title}</h1>
          {S.body}<Error S={S} />
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-6 py-4"><Actions S={S} /></footer>
      </section>
    </div>
  )
}
