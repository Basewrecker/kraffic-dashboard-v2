import { useEffect, useRef } from 'react'
import { Check, Clock, CreditCard, Loader2, ReceiptText, ShieldCheck, TriangleAlert } from 'lucide-react'
import { navigate } from '../../router'
import { billingState, WORKSPACE, whyOff } from '../../billing/state.js'
import { Btn, B, DateTip, InlineError, Pending } from '../../billing/ui.jsx'

// Screen 3. The return page (/plans/return): where the owner lands coming back from the payment page. A single
// centred card inside the normal shell; no dialog. One icon, one headline, one or two lines, one or two buttons.
// The headline takes focus; a status is announced once (role="status"), an error with role="alert".
// States, by ?show=: loading · processing · paid (default) · declined (&reason=funds|expired|details|bank|other) ·
// bank (needs the bank's approval) · expired · error · empty. ?userId=… : an admin's View as (read-only).
// Clients never see the word "Stripe": it's the "payment page".
const DECLINE = {
  funds: 'The card doesn’t have enough funds.',
  expired: 'The card has expired.',
  details: 'The card details didn’t match. Check the number, date and security code.',
  bank: 'Your bank didn’t approve the payment. Try another card or call your bank.',
  other: 'The payment didn’t go through. Try again or use another card.',
}
const q = () => new URLSearchParams(window.location.search)

// the icon: neutral, in a soft tile. The paid tick draws in (reduced motion: it shows at once)
function Tile({ children }) {
  return <span aria-hidden className="grid h-11 w-11 place-items-center rounded-full bg-tint text-stone-700">{children}</span>
}

export default function ReturnPage() {
  const b = billingState()
  const show = q().get('show') ?? 'paid'
  const reason = DECLINE[q().get('reason')] ?? DECLINE.other
  const off = whyOff(b) && b.who === 'viewas' ? whyOff(b) : null
  const head = useRef(null)
  useEffect(() => { head.current?.focus({ preventScroll: true }) }, [show])
  // paid: on to the dashboard by itself after a few seconds, when this page was reached from the payment page in this
  // visit (a link opened later stays put). The buttons work at once.
  useEffect(() => {
    if (show !== 'paid' || off) return undefined
    let fromPay = false
    try { fromPay = sessionStorage.getItem('auden:billing:from-pay') === '1'; sessionStorage.removeItem('auden:billing:from-pay') } catch { /* private window */ }
    if (!fromPay) return undefined
    const t = setTimeout(() => navigate('/overview'), 6000)
    return () => clearTimeout(t)
  }, [show, off])
  const plan = b.plan.name
  const dash = <Btn look="line" onClick={() => navigate('/overview')}>Go to the dashboard</Btn>
  const manage = <Btn look="ink" onClick={() => navigate('/plans?billing=live&tab=billing')}>Manage subscription</Btn>
  const plans = (label, look = 'line') => <Btn look={look} onClick={() => navigate('/plans?billing=live')}>{label}</Btn>

  const S = {
    loading: { live: 'status', icon: <Loader2 size={20} className="animate-spin" />, title: 'Checking your payment…' },
    processing: {
      live: 'status', icon: <Loader2 size={20} className="animate-spin" />, title: 'We’re confirming your payment',
      body: <>This usually takes a few seconds. You can stay here or leave: we’ll email you either way.</>,
      buttons: dash,
    },
    paid: {
      live: 'status', icon: <Check size={22} strokeWidth={2.25} className="bill-tick" />, title: `You’re on ${plan}`,
      body: <>Your receipt is on its way to {WORKSPACE.owner}. Your plan renews <DateTip iso={b.renews ?? '2026-12-27'} bold />.</>,
      buttons: <>{manage}{dash}</>,
    },
    declined: {
      live: 'alert', icon: <CreditCard size={20} />, title: 'Your card was declined',
      body: <><InlineError>{reason}</InlineError><span className="mt-1.5 block">Nothing was charged.</span></>,
      buttons: <><Btn look="ink" off={off}>Try again</Btn>{plans('Choose another plan')}</>,
    },
    bank: {
      live: 'status', icon: <ShieldCheck size={20} />, title: 'Your bank needs to approve this payment',
      body: <>Finish the check with your bank to complete the payment.</>,
      buttons: <Btn look="ink" off={off}>Continue</Btn>,
    },
    expired: {
      live: 'status', icon: <Clock size={20} />, title: 'This payment page has expired',
      body: <Pending n="decision 13">It was held for <B>24</B> hours. Nothing was charged.</Pending>,
      buttons: <><Btn look="ink" off={off}>Start again</Btn>{plans('See plans')}</>,
    },
    error: {
      live: 'alert', icon: <TriangleAlert size={20} />, title: 'We couldn’t check your payment',
      body: <>If you were charged, your plan will switch on by itself and we’ll email you. Nothing is charged twice.</>,
      buttons: <><Btn look="ink">Retry</Btn>{dash}</>,
    },
    empty: {
      live: 'status', icon: <ReceiptText size={20} />, title: 'Nothing to confirm here',
      body: <>You don’t have a payment in progress.</>,
      buttons: plans('See plans', 'ink'),
    },
  }[show] ?? null
  if (!S) return null
  return (
    <div className="grid min-h-[60vh] place-items-center py-8">
      <section role={S.live} aria-labelledby="return-title" className="flex w-full max-w-[480px] flex-col items-center rounded-2xl border border-line bg-surface px-6 py-10 text-center md:px-10">
        <Tile>{S.icon}</Tile>
        <h1 id="return-title" ref={head} tabIndex={-1} className="mt-5 text-[22px] leading-7 font-semibold tracking-[-0.01em] text-stone-900 text-balance outline-none">{S.title}</h1>
        {S.body && <div className="mt-2 text-[14px] leading-5 text-stone-600 text-pretty">{S.body}</div>}
        {off && <p className="mt-1 text-[13px] leading-[18px] text-stone-500">· Viewing as a client</p>}
        {S.buttons && <div className="mt-6 flex flex-col items-stretch gap-2 max-md:w-full md:flex-row-reverse md:justify-center [&>*]:max-md:w-full [&_button]:max-md:w-full">{S.buttons}</div>}
      </section>
    </div>
  )
}
