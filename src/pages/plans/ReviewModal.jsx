import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import { navigate } from '../../router'
import { setParams, useParams } from '../../components/audit/parts'
import { PLANS } from '../../plan/catalog.js'
import { TODAY, addMonths, shortDate } from '../../billing/format.js'
import { WORKSPACE, priceOf } from '../../billing/state.js'
import { B, Btn, DateTip, InlineError, Pending, PerMonth, RenewalTerms, Skeleton } from '../../billing/ui.jsx'

// Screen 2. Checkout: our review step, before the payment page (which we don't design). A Modal (520px; a bottom
// sheet on phones) over the Plans page, opened by ?review=<plan>; /plans/review?plan=<plan> is the full-page fallback
// for links from email. Owner only: a team member or an admin viewing as never reaches it.
// States, by ?rshow=: loading · creating ("Opening…") · open (a payment was already started) · subscribed · price
// (the price changed since the page loaded) · seller (can't take payments) · error · retired. The account's own state
// picks some by itself (a pending payment → open; an active plan → subscribed; a paused seller → seller).
const Row = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4 border-t border-line py-2.5 text-[14px] leading-5">
    <dt className="shrink-0 text-stone-600">{label}</dt>
    <dd className="min-w-0 text-right text-stone-900">{children}</dd>
  </div>
)

// what the step shows: { title, body, primary, secondary, helper }
function useReview(b, plan, show, close) {
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
  const limits = <p className="mt-0.5 text-[14px] leading-5 text-stone-600 tabular-nums"><B>{plan.prompts}</B> prompts · <B>{plan.competitors}</B> competitors · <B>{plan.logins}</B> logins</p>
  const summary = (
    <>
      <h3 className="text-title font-semibold text-stone-900">{plan.name}</h3>
      {limits}
      <dl className="mt-4 border-b border-line">
        {/* the price shows once in this dialog (the terms below name it in a sentence: the one allowed repeat) */}
        <Row label="Price"><Pending n="decision 6"><PerMonth amount={price} /></Pending></Row>
        <Row label="First charge"><B>today</B></Row>
        <Row label="Then renews"><DateTip iso={addMonths(TODAY, 1)} bold />, and monthly after that</Row>
        <Row label="Sold by">{WORKSPACE.legalName}</Row>
      </dl>
      <Pending as="p" n="decision 7" className="mt-2 text-[12px] leading-4 text-stone-500">Charged in US dollars.</Pending>
      {/* a demo account: one more line */}
      {b.status === 'demo' && <p className="mt-3 text-[13px] leading-[18px] text-stone-600">Your demo moves to {plan.name} as soon as the payment goes through.</p>}
      <RenewalTerms price={price} className="mt-4" />
    </>
  )
  const pay = { label: 'Continue to payment', onClick: toPay, busy, helper: 'You’ll enter your card on a secure payment page.' }
  const S = {
    loading: { title: 'Review your plan', body: <div aria-busy="true" aria-label="Loading your plan" className="flex flex-col gap-3"><Skeleton className="h-6 w-32" /><Skeleton className="h-4 w-64" /><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-28" /></div>, primary: { ...pay, disabled: true }, secondary: { label: 'Back', onClick: close } },
    ready: { title: 'Review your plan', body: summary, primary: pay, secondary: { label: 'Back', onClick: close, disabled: busy } },
    creating: { title: 'Review your plan', body: summary, primary: { ...pay, busy: true }, secondary: { label: 'Back', onClick: close, disabled: true } },
    error: { title: 'Review your plan', body: summary, primary: { ...pay, label: 'Retry' }, secondary: { label: 'Back', onClick: close }, error: 'Couldn’t open the payment page. Nothing was charged.' },
    price: { title: 'This plan’s price has changed', body: <><p className="mb-4 text-[14px] leading-5 text-stone-700">It’s now <PerMonth amount={price} />.</p>{summary}</>, primary: pay, secondary: { label: 'Back', onClick: close } },
    open: {
      title: 'You’ve already started this payment',
      body: <p className="text-[14px] leading-5 text-stone-700 text-pretty">Your payment for {(b.pending?.plan ?? plan).name} is held until <Pending n="decision 13"><B>{shortDate(b.pending?.heldUntil ?? addMonths(TODAY, 0))}</B>, {b.pending?.heldTime ?? '2:14 PM'}</Pending>. Pick up where you left off.</p>,
      primary: { label: 'Finish payment', onClick: toPay, busy, helper: 'You’ll enter your card on a secure payment page.' },
      secondary: { label: 'Choose another plan', confirm: `Start over with ${plan.name}? Your earlier payment page will close.`, onClick: close },
    },
    subscribed: {
      title: 'You already have a plan',
      body: <p className="text-[14px] leading-5 text-stone-700">You’re on {b.plan.name}. To change it, open Billing.</p>,
      primary: { label: 'Manage subscription', onClick: () => setParams({ review: null, rshow: null, tab: 'billing' }) }, secondary: { label: 'Close', onClick: close },
    },
    seller: {
      title: 'Online payment isn’t available right now',
      body: <p className="text-[14px] leading-5 text-stone-700">Talk to us and we’ll set up your plan.</p>,
      primary: { label: 'Talk to us', onClick: close }, secondary: { label: 'Close', onClick: close },
    },
    retired: {
      title: 'This plan is no longer offered.',
      body: <p className="text-[14px] leading-5 text-stone-700">Pick another plan to continue.</p>,
      primary: { label: 'See plans', onClick: close },
    },
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
      {!asking && (
        <span className="flex flex-col items-stretch gap-1.5 max-md:w-full md:items-end">
          <Btn look="ink" busy={S.primary.busy} disabled={S.primary.disabled} onClick={S.primary.onClick} className="max-md:w-full">{S.primary.label}</Btn>
        </span>
      )}
    </>
  )
}
const Under = ({ S }) => (
  <div className="mt-4 flex flex-col gap-1.5">
    {S.error && <InlineError>{S.error}</InlineError>}
    {S.primary.helper && <p className="text-[12px] leading-4 text-stone-500">{S.primary.helper}</p>}
  </div>
)

export default function ReviewModal({ b }) {
  const params = useParams()
  const id = params.get('review')
  const plan = PLANS.find((p) => p.id === id) ?? null
  // "Back" closes the dialog; focus returns to the "Subscribe" button that opened it (the Modal does that)
  const close = () => setParams({ review: null, rshow: null })
  const S = useReview(b, plan, id ? params.get('rshow') : null, close)
  // a link that opens straight on the step (?review=growth): the dialog opens once the page has mounted, so its
  // Back handling starts from a settled history entry
  const [ready, setReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setReady(true), 60); return () => clearTimeout(t) }, [])
  return (
    <Modal open={ready && Boolean(plan)} onClose={close} title={S?.title ?? 'Review your plan'} footer={S && <Actions S={S} />}>
      {S && <>{S.body}<Under S={S} /></>}
    </Modal>
  )
}

// /plans/review?plan=growth : the same step as a page, for links from email
export function ReviewPage({ b }) {
  const params = useParams()
  const plan = PLANS.find((p) => p.id === (params.get('plan') ?? 'growth'))
  const S = useReview(b, plan, params.get('rshow'), () => navigate('/plans?billing=live'))
  if (!S) return null
  return (
    <div className="mx-auto w-full max-w-[520px] py-4">
      <section aria-labelledby="review-title" className="rounded-2xl border border-line bg-surface">
        <div className="px-6 pb-4 pt-6">
          <h1 id="review-title" className="mb-4 text-[20px] leading-7 font-semibold text-stone-900">{S.title}</h1>
          {S.body}<Under S={S} />
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-6 py-4"><Actions S={S} /></footer>
      </section>
    </div>
  )
}
