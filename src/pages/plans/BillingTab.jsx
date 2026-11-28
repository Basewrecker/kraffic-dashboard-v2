import { useEffect, useState } from 'react'
import { Check, Download, Loader2 } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import ConfirmPopover from '../../components/prompts/ConfirmPopover'
import { navigate } from '../../router'
import { setParams, useParams } from '../../components/audit/parts'
import { PLANS } from '../../plan/catalog.js'
import { promptUsage } from '../../plan/plan.js'
import { money, monthName, period, shortDate } from '../../billing/format.js'
import { priceOf, whyOff } from '../../billing/state.js'
import { B, Btn, DateTip, InlineError, Pending, PerMonth, Skeleton, StatusPill, SubStatus, TextLink } from '../../billing/ui.jsx'

// Screen 4. Manage subscription: the "Billing" tab of the Plans page (/plans?tab=billing). Not a page of its own: it
// exists once the client has a subscription (active, cancelling, past due, ended). The status pill on the first
// line, then three cards: Your plan · Payment method · Invoices. Screen 6 (ended) is this tab with the ended card in
// the plan card's place.
// Who: the owner does everything; a team member reads (and sees "Card on file", no brand or digits); an admin viewing
// as a client reads, with every money action disabled and its reason in the dark tip. Both can download invoices.
// Previews: ?show=loading|error (the whole tab) · ?card=loading|error|none|expired|expiring (the card on file, read
// live each time the tab opens, so it loads and fails on its own) · ?invoices=none|many|error · ?dl=fail ·
// ?save=fail · ?change=pick|<plan> (the change-plan dialog) · ?cancel=1 (the cancel dialog).
const card = 'rounded-2xl border border-line bg-surface px-5 py-5'
const h2 = 'text-[15px] leading-5 font-semibold text-stone-900'
const NOT_NOW = 'Not available right now. Try again later.'

// ---------------------------------------------------------------- Your plan
function PlanCard({ b, off, dead, saveFailed }) {
  const [confirm, setConfirm] = useState(null)
  const [opening, setOpening] = useState(null)
  const paused = b.seller === 'paused'
  const leave = (kind) => { setOpening(kind); setTimeout(() => navigate(`/plans/pay?kind=${kind}&plan=${b.plan.id}&back=${encodeURIComponent('/plans' + window.location.search)}`), 700) }
  const p = b.plan
  return (
    <section aria-labelledby="bill-plan" className={card}>
      <h2 id="bill-plan" className={h2}>Your plan</h2>
      <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2.5 text-title font-semibold text-stone-900">{p.name}<SubStatus b={b} /></p>
          {/* the limits bought (the snapshot) */}
          <p className="mt-0.5 text-[14px] leading-5 text-stone-600 tabular-nums"><B>{p.prompts}</B> prompts · <B>{p.competitors}</B> competitors · <B>{p.logins}</B> logins</p>
          {/* the price the customer subscribed at; said once on the page */}
          {b.status !== 'pastdue' && <Pending as="p" n="decision 6" className="mt-2 text-[14px] leading-5 text-stone-600"><PerMonth amount={b.price} /></Pending>}
          {b.status === 'active' && <p className="mt-1 text-[14px] leading-5 text-stone-600">Renews <DateTip iso={b.renews} bold /></p>}
          {b.status === 'cancelling' && <p className="mt-1 text-[14px] leading-5 text-stone-600 text-pretty">Paid through <DateTip iso={b.paidThrough} bold />. Your plan ends then and won’t renew.</p>}
          {b.status === 'pastdue' && (
            <p className="mt-2 max-w-[640px] text-[14px] leading-5 text-stone-700 text-pretty">
              Your {monthName(b.failedOn)} payment of <B>{money(b.due.amount)}</B> didn’t go through. <Pending n="decision 11">Pay by <DateTip iso={b.graceEnd} bold /> to keep your plan.</Pending>
            </p>
          )}
          {paused && <p className="mt-2 text-[13px] leading-[18px] text-stone-500 text-pretty">Payments are being reconnected. Your plan and access are not affected.</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
          {b.status === 'pastdue' && <Btn look="ink" off={off} disabled={dead || paused} busy={opening === 'invoice'} onClick={() => leave('invoice')}>Pay now</Btn>}
          {b.status === 'cancelling' && <Btn look="ink" off={off} disabled={dead} onClick={(e) => setConfirm(e.currentTarget)}>Resume plan</Btn>}
          <Btn look="line" disabled={dead}
            off={off ?? (paused ? NOT_NOW : b.status === 'cancelling' ? 'Resume your plan to switch.' : b.status === 'pastdue' ? 'Pay the overdue invoice to switch plans.' : null)}
            onClick={() => setParams({ change: b.scheduled?.plan.id ?? 'pick' })}>Change plan</Btn>
          {/* a quiet text button, not red */}
          {b.status !== 'cancelling' && <Btn look="quiet" off={off} disabled={dead} onClick={() => setParams({ cancel: '1' })}>Cancel plan</Btn>}
        </div>
      </div>
      {/* a scheduled change: its own row, with Withdraw */}
      {b.scheduled && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-tint px-4 py-3 text-[14px] leading-5 text-stone-700">
          <span className="flex flex-wrap items-center gap-2 text-pretty"><StatusPill className="bg-surface">Scheduled</StatusPill><span><Pending n="decision 9"><B>{b.scheduled.plan.name}</B> starts <DateTip iso={b.scheduled.starts} />.</Pending> Your current plan stays until then.</span></span>
          <WithdrawLink b={b} off={off} dead={dead} />
        </div>
      )}
      {saveFailed && <InlineError className="mt-4" onRetry={() => setParams({ save: null })}>Couldn’t save that change. Nothing was changed.</InlineError>}
      {confirm && (
        <ConfirmPopover anchor={confirm} title={`Resume ${p.name}?`} body={`It renews ${shortDate(b.paidThrough)} at ${money(b.price)} per month.`} confirmLabel="Resume plan" cancelLabel="Not now"
          onConfirm={() => { setConfirm(null); setParams({ sub: 'active', msg: 'resumed' }) }} onCancel={() => setConfirm(null)} />
      )}
    </section>
  )
}
function WithdrawLink({ b, off, dead }) {
  const [anchor, setAnchor] = useState(null)
  if (off || dead) return <Btn look="quiet" size="sm" off={off} disabled={dead}>Withdraw</Btn>
  return (
    <>
      <TextLink data-withdraw onClick={(e) => setAnchor(e.currentTarget)}>Withdraw</TextLink>
      {anchor && (
        <ConfirmPopover anchor={anchor} title={`Stay on ${b.plan.name}?`} body={`The switch to ${b.scheduled.plan.name} on ${shortDate(b.scheduled.starts)} is withdrawn.`} confirmLabel="Withdraw change" cancelLabel="Keep it"
          onConfirm={() => { setAnchor(null); setParams({ sub: 'active', msg: 'withdrawn' }) }} onCancel={() => setAnchor(null)} />
      )}
    </>
  )
}

// ---------------------------------------------------------------- Payment method
// The card's brand and last four are never stored: they are read live when the tab opens, so this card loads and
// fails on its own while the rest of the tab is already there. A card that fails to load never blocks Pay now,
// Cancel plan or the invoices.
function PaymentCard({ b, off, dead }) {
  const params = useParams()
  const preview = params.get('card')
  const paused = b.seller === 'paused'
  const [state, setState] = useState(preview === 'error' ? 'error' : 'loading')
  const [opening, setOpening] = useState(false)
  useEffect(() => {
    if (preview === 'loading' || preview === 'error') { setState(preview); return undefined }
    setState('loading')
    const t = setTimeout(() => setState('ok'), 600)
    return () => clearTimeout(t)
  }, [preview])
  const update = () => { setOpening(true); setTimeout(() => navigate(`/plans/pay?kind=card&back=${encodeURIComponent('/plans' + window.location.search)}`), 700) }
  const none = preview === 'none'
  const tail = preview === 'expired' ? ' · expired' : preview === 'expiring' ? ' · expires this month' : ''
  let line
  if (b.who === 'member') line = <p className="text-[14px] leading-5 text-stone-900">Card on file</p>
  else if (paused) line = <p className="text-[14px] leading-5 text-stone-500">Card details aren’t available right now.</p>
  else if (state === 'loading') line = <Skeleton className="h-5 w-40" />
  else if (state === 'error') line = <InlineError onRetry={() => { setState('loading'); setTimeout(() => setState(preview === 'error' ? 'error' : 'ok'), 700) }}>Card details couldn’t be loaded.</InlineError>
  else if (none) line = <p className="text-[14px] leading-5 text-stone-600">No card on file.</p>
  else line = <p className="text-[14px] leading-5 text-stone-700">{b.card.brand} ending <B>{b.card.last4}</B>{tail}</p>
  return (
    <section aria-labelledby="bill-card" className={card} aria-busy={state === 'loading'}>
      <h2 id="bill-card" className={h2}>Payment method</h2>
      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          {line}
          {b.status === 'pastdue' && b.who !== 'member' && !paused && state === 'ok' && <p className="mt-1 text-[13px] leading-[18px] text-negative">This card was declined on {shortDate(b.failedOn)}.</p>}
        </div>
        {b.who !== 'member' && (
          <div className="flex flex-col gap-1 md:items-end">
            <Btn look="line" off={off ?? (paused ? NOT_NOW : null)} disabled={dead} busy={opening} onClick={update} tip="Opens a secure page to change your card." className="self-start md:self-auto">{none ? 'Add a card' : 'Update card'}</Btn>
          </div>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- Invoices
// invoice statuses are neutral pills; only "Overdue" has the red dot ("Paid" is drawn neutral: an open question)
const InvoiceStatus = ({ s }) => <StatusPill tone={s === 'Overdue' ? 'overdue' : 'neutral'}>{s}</StatusPill>
function DownloadBtn({ inv, onFail }) {
  const [busy, setBusy] = useState(false)
  const fail = new URLSearchParams(window.location.search).get('dl') === 'fail'
  return (
    <button type="button" aria-label={`Download invoice ${inv.number} (PDF)`} disabled={busy}
      onClick={() => { setBusy(true); setTimeout(() => { setBusy(false); if (fail) onFail() }, 800) }}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
      {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
    </button>
  )
}
function InvoicesCard({ b, off, dead }) {
  const params = useParams()
  const [older, setOlder] = useState(false)
  const [failedRow, setFailedRow] = useState(params.get('dl') === 'fail' ? b.invoices[1]?.number ?? b.invoices[0]?.number : null)
  const [opening, setOpening] = useState(false)
  const err = params.get('invoices') === 'error'
  const list = older ? b.invoices : b.invoices.slice(0, 12) // the newest 12, then "Show older invoices"
  const pay = () => { setOpening(true); setTimeout(() => navigate(`/plans/pay?kind=invoice&plan=${b.plan.id}&back=${encodeURIComponent('/plans' + window.location.search)}`), 700) }
  const action = (inv) => (inv.status === 'Overdue'
    ? <Btn look="line" size="sm" off={off} disabled={dead || b.seller === 'paused'} busy={opening} onClick={pay}>Pay</Btn>
    : <DownloadBtn inv={inv} onFail={() => setFailedRow(inv.number)} />)
  const th = 'pb-2 text-left text-[12px] leading-4 font-medium text-stone-500'
  return (
    <section aria-labelledby="bill-invoices" className={card}>
      <h2 id="bill-invoices" className={h2}>Invoices</h2>
      {err ? <InlineError className="mt-3" onRetry={() => setParams({ invoices: null })}>Invoices couldn’t be loaded.</InlineError>
        : !b.invoices.length ? (
          <div className="mt-3"><p className="text-[14px] leading-5 text-stone-700">No invoices yet.</p>{b.status !== 'ended' && <p className="mt-0.5 text-[13px] leading-[18px] text-stone-500">Your first invoice appears here after your first payment.</p>}</div>
        ) : (
          <>
            {/* 390: each invoice is a two-line row: number and amount, then date and status, the download at the right */}
            <ul className="mt-3 divide-y divide-[var(--div)] md:hidden">
              {list.map((inv) => (
                <li key={inv.number} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3 text-[14px] leading-5"><span className="font-semibold text-stone-900 tabular-nums">{inv.number}</span><span className="font-semibold text-stone-900 tabular-nums">{money(inv.amount)}</span></div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-[13px] leading-[18px] text-stone-600"><span className="tabular-nums">{shortDate(inv.date)}</span><InvoiceStatus s={inv.status} /></div>
                    {failedRow === inv.number && <InlineError className="mt-1.5" onRetry={() => setFailedRow(null)}>Couldn’t download the invoice.</InlineError>}
                  </div>
                  {action(inv)}
                </li>
              ))}
            </ul>
            <table className="mt-3 hidden w-full border-collapse md:table">
              <thead><tr className="border-b border-line"><th scope="col" className={th}>Invoice</th><th scope="col" className={th}>Date</th><th scope="col" className={th}>Period</th><th scope="col" className={`${th} text-right`}>Amount</th><th scope="col" className={`${th} pl-6`}>Status</th><th scope="col" className={th}><span className="sr-only">Download</span></th></tr></thead>
              <tbody>
                {list.map((inv) => (
                  <tr key={inv.number} className="border-b border-[var(--div)] text-[14px] leading-5 text-stone-700 last:border-b-0">
                    <td className="py-2.5 font-semibold text-stone-900 tabular-nums">{inv.number}</td>
                    <td className="py-2.5 tabular-nums">{shortDate(inv.date)}</td>
                    <td className="py-2.5 tabular-nums">{period(inv.from, inv.to)}</td>
                    <td className="py-2.5 text-right font-semibold text-stone-900 tabular-nums">{money(inv.amount)}</td>
                    <td className="py-2.5 pl-6"><InvoiceStatus s={inv.status} /></td>
                    <td className="py-1.5 text-right">
                      <span className="inline-flex items-center justify-end gap-3">{failedRow === inv.number && <InlineError className="whitespace-nowrap" onRetry={() => setFailedRow(null)}>Couldn’t download the invoice.</InlineError>}{action(inv)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {b.invoices.length > 12 && !older && <TextLink className="mt-3" onClick={() => setOlder(true)}>Show older invoices</TextLink>}
          </>
        )}
    </section>
  )
}

// ---------------------------------------------------------------- the ended card (screen 6)
function EndedCard({ b, off }) {
  const p = b.plan.name
  const why = {
    nonpay: <>We couldn’t collect your {monthName('2026-12-27')} payment, so {p} ended on <DateTip iso={b.endedOn} bold />. The unpaid invoice was cancelled.</>,
    cancel: <>You cancelled {p}. It ended on <DateTip iso={b.endedOn} bold />.</>,
    refund: <Pending n="decision C">{p} ended on <DateTip iso={b.endedOn} bold /> after the last payment was returned.</Pending>,
  }[b.endedWhy]
  const paused = b.seller === 'paused'
  return (
    <section aria-labelledby="bill-ended" className={card}>
      <h2 id="bill-ended" className="text-title font-semibold text-stone-900">Your plan has ended</h2>
      <div className="mt-2 flex max-w-[640px] flex-col gap-1.5 text-[14px] leading-5 text-stone-600 text-pretty">
        <p>{why}</p>
        {/* the 90-day date is recorded only; nothing is deleted automatically: "kept until", never "will be deleted on" */}
        <Pending as="p" n="decision 12">{b.pastKept
          ? <>Your dashboard was kept until <DateTip iso={b.keptUntil} bold />. Talk to us if you need it back.</>
          : <>Your dashboard and history are kept until <DateTip iso={b.keptUntil} bold />. Subscribe before then to pick up where you left off.</>}</Pending>
        <p>Your invoices stay available here.</p>
        {paused && <p>Online payment isn’t available right now. Talk to us and we’ll set up your plan.</p>}
        {b.who === 'member' && <p>Ask the account owner to subscribe again.</p>}
        {off && <p className="text-stone-500">· Viewing as a client</p>}
      </div>
      {b.who !== 'member' && (
        <div className="mt-4 flex flex-wrap gap-2">
          {paused ? <Btn look="ink">Talk to us</Btn> : <Btn look="ink" off={off} onClick={() => setParams({ tab: 'plans' })}>Subscribe again</Btn>}
          {!paused && (b.endedWhy === 'refund' || b.pastKept) && <Btn look="line">Talk to us</Btn>}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- dialogs
// Change plan: a Modal with two steps (pick → confirm), the step motion between them. A change always starts at the
// next renewal, with no part charge (pending decision 9).
function ChangePlan({ b }) {
  const params = useParams()
  const id = params.get('change')
  const open = Boolean(id)
  const picked = PLANS.find((p) => p.id === id) ?? null
  const u = promptUsage()
  const close = () => setParams({ change: null })
  const options = PLANS.filter((p) => p.group === b.plan.group && priceOf(p.id) != null)
  const over = picked && u.real > picked.prompts
  return (
    <Modal open={open} onClose={close} size={picked ? 'md' : 'lg'} stepKey={picked ? 'confirm' : 'pick'}
      title={picked ? `Switch to ${picked.name}?` : 'Change plan'}
      footer={picked ? (
        <>
          <Btn look="quiet" onClick={() => setParams({ change: 'pick' })}>Back</Btn>
          <Btn look="ink" onClick={() => setParams(params.get('save') === 'fail' ? { change: null } : { change: null, sub: 'scheduled', msg: 'scheduled' })}>Schedule change</Btn>
        </>
      ) : <Btn look="quiet" onClick={close}>Close</Btn>}>
      {picked ? (
        <div className="flex flex-col gap-3 text-[14px] leading-5 text-stone-700 text-pretty">
          <Pending as="p" n="decision 9"><B>{picked.name}</B> starts <B>{shortDate(b.renews)}</B>. Until then you stay on {b.plan.name}. No charge today; your next payment will be <B>{money(priceOf(picked.id))}</B>.</Pending>
          {/* over the new plan's limits: a sentence about the new plan, never a "used of limit" pair (open conflict 5) */}
          {over && (
            <Pending as="p" n="Q7 · conflict 5" className="rounded-xl bg-tint px-4 py-3">
              You’re using more than {picked.name} includes: <B>{u.real}</B> prompts ({picked.name} has <B>{picked.prompts}</B>). Nothing is removed. From {shortDate(b.renews)} you won’t be able to add more until you’re under the limit.
            </Pending>
          )}
          {b.scheduled && b.scheduled.plan.id === picked.id && <p className="text-stone-600">This change is already scheduled. <TextLink onClick={() => setParams({ change: null, sub: 'active', msg: 'withdrawn' })}>Withdraw</TextLink></p>}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {options.map((p) => {
            const mine = p.id === b.plan.id
            return (
              <li key={p.id}>
                <button type="button" disabled={mine} onClick={() => setParams({ change: p.id })}
                  className="flex h-full w-full flex-col rounded-xl border border-line bg-surface p-4 text-left outline-none transition-[border-color] duration-150 hover:border-ink focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-default disabled:hover:border-line">
                  <span className="flex items-center gap-2"><span className="text-[15px] leading-5 font-semibold text-stone-900">{p.name}</span>{mine && <StatusPill>Your plan</StatusPill>}</span>
                  <span className="mt-1.5 text-[14px] leading-5 text-stone-600"><PerMonth amount={priceOf(p.id)} /></span>
                  <span className="mt-2 flex flex-col text-[13px] leading-[18px] text-stone-600 tabular-nums"><span><B>{p.prompts}</B> prompts</span><span><B>{p.competitors}</B> competitors</span><span><B>{p.logins}</B> logins</span></span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}

function CancelPlan({ b }) {
  const params = useParams()
  const open = params.get('cancel') === '1'
  const close = () => setParams({ cancel: null })
  const now = b.status === 'pastdue'
  return (
    <Modal open={open} onClose={close} title="Cancel your plan?"
      footer={(
        <>
          <Btn look="quiet" onClick={close}>Keep my plan</Btn>
          {/* ink, not red */}
          <Btn look="ink" onClick={() => setParams(now ? { cancel: null, sub: 'ended', ended: 'cancel', tab: 'billing', days: null } : { cancel: null, sub: 'cancelling', msg: 'cancelled' })}>{now ? 'Cancel plan now' : 'Cancel plan'}</Btn>
        </>
      )}>
      <div className="flex flex-col gap-2 text-[14px] leading-5 text-stone-700 text-pretty">
        {now
          ? <p>Your plan ends <B>now</B>. The overdue invoice is cancelled and you won’t be charged for it. <Pending n="decision 12">Your dashboard is kept for 90 days</Pending> and your invoices stay available.</p>
          : <p>You keep everything until <B>{shortDate(b.renews)}</B>. After that: scans stop, <Pending n="decision 12">your dashboard is kept for 90 days</Pending>, and your invoices stay available. You can resume any time before {shortDate(b.renews)}.</p>}
        {b.scheduled && <p>Your switch to {b.scheduled.plan.name} is withdrawn too.</p>}
        {b.seller === 'paused' && <Pending as="p" n="owner sign-off" className="text-stone-600">We’ve received your cancellation. We’ll confirm it by email as soon as it’s in place.</Pending>}
      </div>
    </Modal>
  )
}

export default function BillingTab({ b }) {
  const params = useParams()
  const show = params.get('show')
  const off = b.who === 'viewas' ? whyOff(b) : null
  const dead = b.who === 'member'
  if (show === 'loading') return <div aria-busy="true" aria-label="Loading your billing details" className="flex flex-col gap-3 md:gap-4"><Skeleton className="h-6 w-20 !rounded-full" /><Skeleton className="h-36 !rounded-2xl" /><Skeleton className="h-24 !rounded-2xl" /><Skeleton className="h-52 !rounded-2xl" /></div>
  if (show === 'error') return <section className={card}><InlineError onRetry={() => setParams({ show: null })}>Your billing details couldn’t be loaded.</InlineError></section>
  const ended = b.status === 'ended'
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="billing-first" tabIndex={-1} className="sr-only">Billing</h2>
        {ended && <SubStatus b={b} />}
        {dead && <p className="text-[13px] leading-[18px] text-stone-500">Only the account owner can manage billing.</p>}
      </div>
      {ended ? <EndedCard b={b} off={off} /> : <PlanCard b={b} off={off} dead={dead} saveFailed={params.get('save') === 'fail' && !params.get('change')} />}
      {!ended && <PaymentCard b={b} off={off} dead={dead} />}
      <InvoicesCard b={b} off={off} dead={dead} />
      {!ended && b.canAct && <ChangePlan b={b} />}
      {!ended && b.canAct && <CancelPlan b={b} />}
    </>
  )
}
