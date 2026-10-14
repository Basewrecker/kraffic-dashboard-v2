import { useEffect, useState } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import DrawerShell, { useDrawer } from '../../components/audit/DrawerShell'
import SiteLogo from '../../components/ui/SiteLogo'
import { navigate } from '../../router'
import { inkBtn, lineBtn, t2, t3 } from '../../components/tool/ToolPage'
import { billingPlans } from '../../data/mock'
import { fmtDate, money, overLimits, planById, priceOf, prorate, update, useBilling } from './billing'

// "Switch to {plan}" (?switch=<planId>:<month|year>; a bottom sheet on phones). Downgrades list every live limit current
// usage would exceed and block Confirm. No card on file: ask for one first (it would hand off to the provider's hosted page).
const ITEMS = Object.fromEntries(billingPlans.flatMap((p) => ['month', 'year'].map((i) => [`${p.id}:${i}`, { planId: p.id, interval: i }])))
const BRANDS = { visa: ['Visa', 'visa.com'], mastercard: ['Mastercard', 'mastercard.com'] }

export default function ConfirmDrawer() {
  const drawer = useDrawer('switch', (v) => ITEMS[v] ?? null)
  const b = useBilling()
  const [done, setDone] = useState(null)
  useEffect(() => { if (!drawer.open) setDone(null) }, [drawer.open])
  const it = drawer.item
  if (!it) return null
  const plan = planById(it.planId)
  if (done) {
    return (
      <DrawerShell drawer={drawer} title={`You’re on ${done.name}`} meta={<span>Billing is updated</span>}
        footer={<><span /><button type="button" onClick={() => { drawer.close(); navigate('/billing') }} className={inkBtn}>Back to Billing</button></>}>
        <div className="mt-10 flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-ink text-on-ink" aria-hidden><Check size={22} /></span>
          <p className="mt-4 text-[15px] leading-[22px] text-stone-900">Your plan is now {done.name}{done.interval === 'year' ? ', billed yearly' : ''}.</p>
          <p className={`mt-1 text-[13px] leading-[18px] ${t2}`}>New limits apply right away. A receipt is on its way to {b.details.email}.</p>
        </div>
      </DrawerShell>
    )
  }
  const cur = planById(b.planId)
  const down = priceOf(plan, 'month') < priceOf(cur, 'month')
  const blockers = down ? overLimits(b, plan) : []
  const hard = blockers.filter((x) => x.live)
  const today = prorate(b, plan, it.interval)
  const nextDate = it.interval !== b.interval || b.status === 'TRIALING' ? (b.status === 'TRIALING' ? b.trialEnd : addPeriod(it.interval)) : b.currentPeriodEnd
  const pm = b.paymentMethod
  const canConfirm = pm && !hard.length
  const confirm = () => {
    update({ planId: plan.id, interval: it.interval, status: 'ACTIVE', trialEnd: null, cancelAtPeriodEnd: false })
    setDone({ name: plan.name, interval: it.interval })
  }
  const rows = [
    ['New plan', `${plan.name} · ${money(priceOf(plan, it.interval))}/${it.interval}`],
    ['Billed', it.interval === 'year' ? 'Yearly' : 'Monthly'],
    ['Due today', b.status === 'TRIALING' ? `${money(0)} (still on your trial)` : `${money(today, { decimals: true })}${it.interval === b.interval ? ' (prorated)' : ''}`],
    ['Next charge', `${fmtDate(nextDate)} · ${money(priceOf(plan, it.interval))}`],
  ]
  return (
    <DrawerShell drawer={drawer} title={`Switch to ${plan.name}`} meta={<span>From {cur.name} · {money(priceOf(cur, b.interval))}/{b.interval}</span>}
      footer={(
        <>
          <button type="button" onClick={drawer.close} className={lineBtn}>Cancel</button>
          <button type="button" onClick={confirm} disabled={!canConfirm} className={`${inkBtn} disabled:cursor-not-allowed`}>
            {down ? `Confirm and switch` : `Confirm and pay ${money(b.status === 'TRIALING' ? 0 : today, { decimals: true })}`}
          </button>
        </>
      )}>
      {hard.length > 0 && (
        <div role="alert" className="mt-5 rounded-lg border border-line p-4">
          <p className="flex items-center gap-2 text-[14px] leading-5 font-semibold text-negative"><AlertCircle size={16} aria-hidden />Your usage is over {plan.name}’s limits</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-[14px] leading-5 text-negative">
            {hard.map((x) => (
              <li key={x.key}>You have {x.used.toLocaleString('en-US')} {x.word}; {plan.name} allows {x.limit.toLocaleString('en-US')}. {x.fix} {x.over.toLocaleString('en-US')} before switching.</li>
            ))}
          </ul>
        </div>
      )}
      {blockers.some((x) => !x.live) && (
        <p className={`mt-3 text-[13px] leading-[18px] ${t2}`}>
          This period you’ve used more {blockers.filter((x) => !x.live).map((x) => x.word).join(' and ')} than {plan.name} includes a month. That’s fine: the lower limit starts with your next period.
        </p>
      )}
      <dl className="mt-5 divide-y divide-[var(--div)] border-y border-[var(--div)]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid min-h-11 grid-cols-[120px_minmax(0,1fr)] items-center gap-3 py-2 text-[14px] leading-5">
            <dt className={t3}>{k}</dt><dd className="text-stone-900 tabular-nums">{v}</dd>
          </div>
        ))}
        <div className="grid min-h-11 grid-cols-[120px_minmax(0,1fr)] items-center gap-3 py-2 text-[14px] leading-5">
          <dt className={t3}>Payment method</dt>
          <dd className="flex items-center justify-between gap-3">
            {pm ? (
              <>
                <span className="flex items-center gap-2 tabular-nums text-stone-900"><SiteLogo domain={BRANDS[pm.brand][1]} name={BRANDS[pm.brand][0]} className="h-5 w-8 rounded" imgPad="p-0.5" />•••• {pm.last4}</span>
                <button type="button" onClick={() => update({ paymentMethod: { ...pm } })} className="rounded text-[13px] font-medium text-stone-900 underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-focus">Change</button>
              </>
            ) : (
              <>
                <span className={t3}>None yet</span>
                {/* production has no provider: this would open the provider's hosted card page and come back */}
                <button type="button" onClick={() => update({ paymentMethod: { brand: 'visa', last4: '4417', expMonth: 8, expYear: 2028 } })} className={`${lineBtn} h-8`}>Add payment method</button>
              </>
            )}
          </dd>
        </div>
      </dl>
      {!pm && <p className={`mt-3 text-[13px] leading-[18px] ${t2}`}>Add a card first. You’ll enter it on our payment provider’s secure page, then come back here.</p>}
    </DrawerShell>
  )
}

function addPeriod(interval) {
  const d = new Date('2026-10-14T00:00:00Z')
  if (interval === 'year') d.setUTCFullYear(d.getUTCFullYear() + 1); else d.setUTCMonth(d.getUTCMonth() + 1)
  return d.toISOString().slice(0, 10)
}
