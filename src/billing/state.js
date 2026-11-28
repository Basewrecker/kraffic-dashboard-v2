// Billing's sample states (mock data; nothing here is a real price, plan or date). Every billing screen reads the
// account's state from here, and every state in the brief's checklist opens from the address:
//
//   ?billing=live                   the workspace's billing is live (default: not live = today's page, no prices)
//   ?sub=none|demo|pending|active|scheduled|cancelling|pastdue|ended|demo-ended     the subscription's state
//   ?ended=nonpay|cancel|refund     why it ended            ?kept=past   past the kept-until date
//   ?who=member                     a team member (default: the owner)      ?userId=…   an admin's View as
//   ?seller=paused|test             the seller can't take payments / is in test mode (?as=admin sees test prices)
//   ?days=11                        days left to pay, for past due (14 … 0)
//   ?show=…                         a screen's own states (loading, error, …; each screen lists its own)
//
// Words: the product's 30-day free period is a "demo" everywhere (never "trial"). Clients never see "Stripe".
import { PLANS } from '../plan/catalog.js'
import { PLAN } from '../plan/plan.js'
import { TODAY, addDays, addMonths } from './format.js'

const q = () => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)

// the workspace (the seller on the invoice): product name, legal name and support address are data, never fixed copy
export const WORKSPACE = { product: 'Auden AI', legalName: 'Auden Labs, Inc.', support: 'support@auden.ai', owner: 'maya@dermasuri.com' }

// the workspace's own price for each package, per month in US dollars (samples). A plan with no price: "Talk to us"
export const PRICES = { visibility: 2000, growth: 3500, authority: 6000, enterprise: null, starter: 99, plus: 199, pro: 399 }
export const priceOf = (planId) => PRICES[planId] ?? null

const invoice = (n, date, status = 'Paid', amount = PRICES.growth) => ({ number: `INV-${String(n).padStart(4, '0')}`, date, from: date, to: addMonths(date, 1), amount, status })
const HISTORY = [invoice(3, '2026-10-27'), invoice(2, '2026-09-27'), invoice(1, '2026-08-27')]
const MANY = Array.from({ length: 16 }, (_, i) => invoice(16 - i, addMonths('2026-10-27', -i)))

export function billingState() {
  const p = q()
  const live = p.get('billing') === 'live'
  const seller = p.get('seller') ?? 'ok' // ok | paused | test
  const admin = p.get('as') === 'admin' || p.get('as') === 'superadmin'
  const sub = p.get('sub') ?? (live ? 'active' : 'none')
  const who = p.has('userId') ? 'viewas' : p.get('who') === 'member' ? 'member' : 'owner'
  const plan = PLANS.find((x) => x.id === PLAN.id)
  const renews = addMonths(TODAY, 1) // Dec 27
  const days = Math.max(0, Math.min(14, Number(p.get('days') ?? 11)))
  const endedOn = '2027-01-10'
  const base = {
    live,
    // prices show to a client only where billing is live; in test mode only to the workspace's own admins
    pricesShown: live && seller !== 'paused' && (seller !== 'test' || admin),
    canPay: live && seller === 'ok',
    seller, admin, who,
    canAct: who === 'owner', // the owner is the only one who can pay, change, cancel or resume
    status: sub, plan, price: priceOf(plan.id),
    show: p.get('show'),
  }
  const withSub = (extra) => ({ ...base, hasSub: true, renews, card: { brand: 'Visa', last4: '4242', exp: '2028-04' }, invoices: p.get('invoices') === 'none' ? [] : p.get('invoices') === 'many' ? MANY : HISTORY, ...extra })
  switch (sub) {
    case 'demo': return { ...base, hasSub: false, demoEnds: renews, demoDays: 30 }
    case 'pending': return { ...base, hasSub: false, pending: { plan: PLANS.find((x) => x.id === 'authority'), heldUntil: addDays(TODAY, 1), heldTime: '2:14 PM' } }
    case 'active': return withSub({})
    case 'scheduled': return withSub({ status: 'active', scheduled: { plan: PLANS.find((x) => x.id === 'visibility'), starts: renews } })
    case 'cancelling': return withSub({ paidThrough: renews })
    case 'pastdue': {
      const due = invoice(4, TODAY, 'Overdue')
      return withSub({ renews: null, failedOn: TODAY, graceEnd: addDays(TODAY, days), daysLeft: days, due, invoices: [due, ...HISTORY] })
    }
    case 'ended': {
      const why = p.get('ended') ?? 'nonpay'
      return withSub({ renews: null, card: null, endedOn, endedWhy: why, keptUntil: addDays(endedOn, 90), pastKept: p.get('kept') === 'past',
        invoices: why === 'nonpay' ? [{ ...invoice(6, '2026-12-27'), status: 'Void' }, invoice(5, '2026-11-27'), ...HISTORY] : why === 'refund' ? [{ ...invoice(5, '2026-12-27'), status: 'Refunded' }, invoice(4, '2026-11-27'), ...HISTORY] : [invoice(5, '2026-12-10'), invoice(4, '2026-11-27'), ...HISTORY] })
    }
    case 'demo-ended': return { ...base, hasSub: false, demoEndedOn: '2026-11-20', keptUntil: addDays('2026-11-20', 90) }
    default: return { ...base, status: 'none', hasSub: false }
  }
}
// the tab the Plans page opens on: Billing for past due and ended, or when the link asks; else Plans
export const tabFor = (b) => {
  const asked = q().get('tab')
  if (!b.hasSub) return 'plans'
  if (asked === 'billing' || asked === 'plans') return asked
  return b.status === 'pastdue' || b.status === 'ended' ? 'billing' : 'plans'
}
// why a money action is off for this person, or null when they can act
export const whyOff = (b) => (b.who === 'viewas' ? 'Can’t change plans from this view' : b.who === 'member' ? 'Only the account owner can change the plan.' : null)
