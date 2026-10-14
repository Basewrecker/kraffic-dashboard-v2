import { useEffect, useState } from 'react'
import { AlertCircle, Download } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import PromptTable from '../../components/dashboard/PromptTable'
import SiteLogo from '../../components/ui/SiteLogo'
import Modal from '../../components/ui/Modal'
import Insight, { useExplain } from '../../components/ui/Insight'
import { useToast } from '../../components/dashboard/overlays'
import ActionMenu from '../../components/audit/ActionMenu'
import { openDrawer } from '../../components/audit/parts'
import { linkClick, navigate } from '../../router'
import { cardTitle, inkBtn, lineBtn, subtitleCls, t2, t3 } from '../../components/tool/ToolPage'
import DetailsDrawer from './DetailsDrawer'
import { daysUntil, fmtDate, fmtShort, forecast, isLive, money, planById, priceOf, update, usageRows, useBilling } from './billing'

// /billing — plan, usage, payment method, billing details and invoices for this workspace.
// Production has plans + subscriptions but no payment provider, invoices, cards or billing details (all mocked here).
const BRANDS = { visa: ['Visa', 'visa.com'], mastercard: ['Mastercard', 'mastercard.com'] }

export default function BillingPage() {
  const b = useBilling()
  useEffect(() => { document.title = 'Billing · Kraffic' }, [])
  const [toastNode, toast] = useToast({ position: 'center' })
  const failed = b.status === 'PAST_DUE'
  // billing not live (production today): the plan, and usage as plain counts. No prices, limits, cards or invoices.
  if (!isLive()) {
    return (
      <>
        <div>
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">Billing</h1>
          <p className={`mt-1 text-[13px] leading-[18px] ${t2} lg:text-[14px] lg:leading-5`}>Plan, usage and invoices for {b.workspace}</p>
        </div>
        <Card className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-5">
          <span className={`w-full text-[13px] leading-[18px] ${t2}`}>Current plan</span>
          <span className="text-[20px] leading-7 font-semibold text-stone-900">{planById(b.planId).name}</span>
          <span className={`text-[13px] leading-[18px] ${t2}`}>Everything is unlimited for now</span>
        </Card>
        <UsageCounts b={b} />
      </>
    )
  }
  return (
    <>
      <div>
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">Billing</h1>
        <p className={`mt-1 text-[13px] leading-[18px] ${t2} lg:text-[14px] lg:leading-5`}>Plan, usage and invoices for {b.workspace}</p>
      </div>
      {failed && (
        <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-surface px-5 py-3">
          <AlertCircle size={16} className="shrink-0 text-negative" aria-hidden />
          <p className="min-w-0 flex-1 text-[14px] leading-5 text-negative">Your last payment failed. Update your card to keep tracking.</p>
          <button type="button" onClick={() => { update({ status: 'ACTIVE', paymentMethod: { brand: 'visa', last4: '4417', expMonth: 8, expYear: 2028 } }); toast('Card updated · payment retried') }} className={lineBtn}>Update card</button>
        </div>
      )}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <CurrentPlan b={b} toast={toast} />
        <div className="min-w-0 lg:col-span-2"><Usage b={b} /></div>
      </div>
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <PaymentMethod b={b} toast={toast} />
        <div className="min-w-0 lg:col-span-2"><Details b={b} /></div>
      </div>
      <Invoices b={b} />
      <DetailsDrawer onSaved={() => toast('Billing details saved')} />
      {toastNode}
    </>
  )
}

function CurrentPlan({ b, toast }) {
  const plan = planById(b.planId)
  const [ask, setAsk] = useState(false)
  const trial = b.status === 'TRIALING'
  const cancelled = b.cancelAtPeriodEnd
  return (
    <Card className="flex h-full min-w-0 flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className={`text-[13px] leading-[18px] ${t2}`}>Current plan</h2>
        <ActionMenu label="Plan actions" items={cancelled ? [{ label: 'Keep my plan', onClick: () => { update({ cancelAtPeriodEnd: false }); toast('Your plan will renew') } }] : [{ label: 'Cancel plan', onClick: () => setAsk(true) }]}
          className="-mr-2 -mt-1 grid h-8 w-8 place-items-center rounded-md text-stone-500 outline-none transition-colors hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
          <span aria-hidden className="text-[16px] leading-none">⋯</span>
        </ActionMenu>
      </div>
      <p className="mt-1 text-[20px] leading-7 font-semibold text-stone-900">{plan.name}{trial && <span className={`ml-2 text-[13px] font-normal ${t3}`}>Trial</span>}</p>
      <p className="mt-1 text-[14px] leading-5 text-stone-900 tabular-nums">{money(priceOf(plan, b.interval))}<span className={t2}>/{b.interval}</span></p>
      <p className={`mt-1 text-[13px] leading-[18px] ${trial ? 'text-stone-900' : t2} tabular-nums`}>
        {trial ? `Trial ends in ${daysUntil(b.trialEnd)} days · then ${money(plan.priceMonthly)}/month` : cancelled ? `Ends ${fmtDate(b.currentPeriodEnd)}; it won’t renew` : `Renews ${fmtDate(b.currentPeriodEnd)}`}
      </p>
      <div className="mt-auto pt-5">
        <a href="/billing/plans" onClick={linkClick('/billing/plans')} className={`${inkBtn} w-full`}>Change plan</a>
      </div>
      <Modal open={ask} onClose={() => setAsk(false)} title={`Cancel ${plan.name}?`}
        subtitle={`You keep everything until ${fmtDate(b.currentPeriodEnd)}. After that tracking stops and your data is kept for 30 days.`}
        footer={(
          <div className="flex w-full justify-end gap-2">
            <button type="button" onClick={() => setAsk(false)} className={lineBtn}>Keep plan</button>
            <button type="button" onClick={() => { update({ cancelAtPeriodEnd: true }); setAsk(false); toast('Your plan won’t renew') }}
              className="inline-flex h-9 items-center rounded-lg bg-negative px-3.5 text-small font-medium text-on-ink outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-focus">Cancel plan</button>
          </div>
        )}><span /></Modal>
    </Card>
  )
}

const COUNT_WORDS = { prompts: 'prompts tracked', projects: 'brands', clients: 'clients', users: 'team members', crawl_pages_monthly: 'pages crawled this period', ai_runs_monthly: 'AI answer checks this period' }
function UsageCounts({ b }) {
  const rows = usageRows(b)
  return (
    <Card className="px-5 pt-5 pb-2 max-md:px-4">
      <h2 className={cardTitle}>Usage</h2>
      <p className={subtitleCls}>What this workspace uses. There are no limits for now.</p>
      <ul className="mt-3 divide-y divide-[var(--div)]">
        {rows.map((r) => (
          <li key={r.key} className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-1.5">
            <span className="min-w-0">
              <span className="block truncate text-[14px] leading-5 text-stone-900 tabular-nums">{r.used.toLocaleString('en-US')} {COUNT_WORDS[r.key]}</span>
            </span>
            <span className={`text-[13px] leading-[18px] ${t3}`}>{r.meta}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Usage({ b }) {
  const explain = useExplain('usage')
  const rows = usageRows(b)
  const f = forecast(b)
  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5 pb-3 max-md:px-4">
      <h2 className={cardTitle}>Usage</h2>
      <p className={subtitleCls}>How close are you to your plan’s limits?</p>
      <ul className="mt-3 divide-y divide-[var(--div)]">
        {rows.map((r) => {
          const hot = !r.unlimited && r.pct >= 0.9
          return (
            <li key={r.key} className="grid min-h-11 grid-cols-[minmax(0,1fr)_112px] items-center gap-x-4 gap-y-1 py-1.5 md:grid-cols-[minmax(0,1fr)_112px_160px_128px] md:py-0">
              <span className="min-w-0">
                <span className="block truncate text-[14px] leading-5 text-stone-900">{r.label}</span>
                <span className={`block text-[13px] leading-[18px] ${t3}`}>{r.meta}</span>
              </span>
              <span className={`whitespace-nowrap text-right text-[14px] leading-5 tabular-nums md:text-left ${hot ? 'text-negative' : 'text-stone-900'}`}>{r.used.toLocaleString('en-US')} <span className={hot ? '' : t3}>/ {r.unlimited ? '∞' : r.limit.toLocaleString('en-US')}</span></span>
              <span className="col-span-2 block h-1.5 overflow-hidden rounded-full bg-tint md:col-span-1" aria-hidden>
                {!r.unlimited && <span className="block h-full rounded-full bg-ink" style={{ width: `${Math.min(100, r.pct * 100)}%` }} />}
              </span>
              <span className={`col-span-2 whitespace-nowrap text-[13px] leading-[18px] tabular-nums md:col-span-1 ${hot ? 'text-negative' : t2}`}>
                {r.unlimited ? 'Unlimited' : `${r.left.toLocaleString('en-US')} left`}
                {hot && <> · <a href="/billing/plans" onClick={linkClick('/billing/plans')} className="rounded font-medium text-ink underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-focus">Upgrade</a></>}
              </span>
            </li>
          )
        })}
      </ul>
      {f && (
        <div className="mt-auto pt-3">
          <Insight explain={explain} text={f.text} evidence={{ keys: [], calc: `Tracked prompts grew by about ${f.perDay.toFixed(1)} a day over the last 2 weeks.` }} />
        </div>
      )}
    </Card>
  )
}

function PaymentMethod({ b, toast }) {
  const pm = b.paymentMethod
  const [name, domain] = pm ? BRANDS[pm.brand] : []
  // production has no payment provider: Add / Update would hand off to the provider's hosted page
  const handoff = () => { update({ paymentMethod: { brand: 'visa', last4: '4417', expMonth: 8, expYear: 2028 } }); toast('Card saved (the provider’s hosted page would open here)') }
  return (
    <Card className="flex h-full min-w-0 flex-col p-5">
      <h2 className={cardTitle}>Payment method</h2>
      {pm ? (
        <div className="mt-3 flex items-center gap-3">
          <SiteLogo domain={domain} name={name} className="h-8 w-12 rounded-md" imgPad="p-1" />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] leading-5 text-stone-900 tabular-nums">{name} •••• {pm.last4}</span>
            <span className={`block text-[13px] leading-[18px] tabular-nums ${b.status === 'PAST_DUE' ? 'text-negative' : t3}`}>Expires {String(pm.expMonth).padStart(2, '0')}/{String(pm.expYear).slice(2)}</span>
          </span>
        </div>
      ) : <p className={`mt-3 text-[14px] leading-5 ${t2}`}>No payment method</p>}
      <div className="mt-auto pt-5">
        <button type="button" onClick={handoff} className={pm ? lineBtn : inkBtn}>{pm ? 'Update' : 'Add payment method'}</button>
      </div>
    </Card>
  )
}

function Details({ b }) {
  const d = b.details
  const rows = [['Company', d.company], ['Billing email', d.email], ['Address', d.address], ['Tax ID', d.taxId]]
  return (
    <Card className="flex h-full min-w-0 flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className={cardTitle}>Billing details</h2>
        <button type="button" onClick={() => openDrawer('details', 'edit')} className={`${lineBtn} -mt-1 h-8`}>Edit</button>
      </div>
      <dl className="mt-3 divide-y divide-[var(--div)]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid min-h-10 grid-cols-[120px_minmax(0,1fr)] items-center gap-3 py-2 text-[14px] leading-5">
            <dt className={t3}>{k}</dt>
            <dd className={`min-w-0 truncate ${v ? 'text-stone-900' : t3}`} title={v ?? undefined}>{v ?? 'Not added'}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function Invoices({ b }) {
  const STATUS = { paid: ['Paid', t2], failed: ['Failed', 'text-negative'], upcoming: ['Upcoming', t3] }
  const plan = planById(b.planId)
  const upcoming = b.status === 'TRIALING' || b.cancelAtPeriodEnd ? [] : [{ id: 'upcoming', date: b.currentPeriodEnd, description: `${plan.name} plan · next ${b.interval === 'year' ? 'year' : 'month'}`, amount: priceOf(plan, b.interval), status: 'upcoming' }]
  const rows = [...upcoming, ...b.invoices]
  const columns = [
    { key: 'date', label: 'Date', width: 140, sort: { value: (r) => r.date, first: 'desc' }, csv: (r) => r.date, mobileText: (r) => fmtShort(r.date), cell: (r) => <span className="text-[14px] tabular-nums text-stone-900">{fmtDate(r.date)}</span> },
    { key: 'desc', label: 'Description', mobile: 'primary', csv: (r) => r.description, mobileText: (r) => r.description, cell: (r) => <span className="block truncate text-[14px] text-stone-900" title={r.description}>{r.description}</span> },
    { key: 'amount', label: 'Amount', width: 120, align: 'right', sort: { value: (r) => r.amount, first: 'desc' }, csv: (r) => r.amount / 100, mobileText: (r) => money(r.amount, { decimals: true }), cell: (r) => <span className="text-[14px] tabular-nums text-stone-900">{money(r.amount, { decimals: true })}</span> },
    { key: 'status', label: 'Status', width: 112, csv: (r) => STATUS[r.status][0], mobileText: (r) => STATUS[r.status][0], cell: (r) => <span className={`text-[13px] ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span> },
    { key: 'pdf', label: '', width: 56, csv: false, mobile: false, stopRowClick: true,
      cell: (r) => (r.status === 'upcoming' ? null : <button type="button" aria-label={`Download invoice ${fmtDate(r.date)}`} className="ml-auto grid h-8 w-8 place-items-center rounded-md text-stone-500 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><Download size={16} aria-hidden /></button>) },
  ]
  return (
    <PromptTable id="invoices" title="Invoices" subtitle="Every charge on this workspace" count={rows.length} rows={rows} columns={columns}
      filterKeys={['description']} searchLabel="Search invoices" csvName="invoices.csv" defaultSort={{ key: 'date', dir: 'desc' }} rowHover="hover:bg-tint"
      emptyMessage="No invoices yet. Your first one arrives when your trial ends." emptyQuery={(q) => <>No invoices match “{q}”</>} />
  )
}

export const goPlans = () => navigate('/billing/plans')
