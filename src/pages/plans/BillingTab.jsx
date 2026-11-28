import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import ConfirmPopover from '../../components/prompts/ConfirmPopover'
import { PlatformIcon } from '../../components/dashboard/icons'
import { navigate } from '../../router'
import { setParams, useParams } from '../../components/audit/parts'
import { PLANS } from '../../plan/catalog.js'
import { promptUsage, ringTone } from '../../plan/plan.js'
import UsageRing from '../../plan/UsageRing'
import { reducedMotion } from '../../lib/motionTokens'
import { TODAY, addMonths, daysUntil, money, monthName, period, shortDate } from '../../billing/format.js'
import { priceOf, whyOff } from '../../billing/state.js'
import { B, Btn, DateTip, InlineError, Pending, PerMonth, Skeleton, StatusPill, SubStatus, TextLink } from '../../billing/ui.jsx'

// Screen 4. Manage subscription: the "Billing" tab of the Plans page (/plans?tab=billing). Not a page of its own: it
// exists once the client has a subscription (active, cancelling, past due, ended).
// Layout (owner, 2026-11-28): at 1440 two columns. Left (2/3): "Your plan", the hero: the plan's name in display size
// with its status pill and the one black button, the price and the renewal, three usage meters, the plan's main
// features. Right (1/3): "Next payment" (date, amount, card, how far through the period) and "Payment method" (a small
// card graphic, Update card). Below, full width: Invoices (a compact list, the latest 3, then "Show all"). Last, a quiet
// "Cancel plan" row. Screen 6 (ended) is this tab with the ended card in the plan panel's place. 390: one column.
// Who: the owner does everything; a team member reads (and sees "Card on file", no brand or digits); an admin viewing
// as a client reads. For both every money action is disabled with its reason in the dark tip. Both can download invoices.
// Previews: ?show=loading|error (the whole tab) · ?card=loading|error|none|expired|expiring (the card on file, read
// live each time the tab opens, so it loads and fails on its own) · ?invoices=none|many|error · ?dl=fail ·
// ?save=fail · ?change=pick|<plan> (the change-plan dialog) · ?cancel=1 (the cancel dialog).
const card = 'rounded-2xl border border-line bg-surface p-5'
const label = 'text-[13px] leading-[18px] font-medium text-stone-500'
const NOT_NOW = 'Not available right now. Try again later.'
const MEMBER_OFF = 'Only the account owner can manage billing.'

// the fill-in on load: false for the first frame (rings and the period line at 0), then true. Reduced motion: true
// from the start (the final state, no fill)
function useFillIn() {
  const [on, setOn] = useState(() => reducedMotion())
  useEffect(() => {
    if (on) return undefined
    let r2
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setOn(true)) })
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return on
}

// The card on file is read live when the tab opens (never stored), so it loads and fails on its own while the rest of
// the tab is there. Next payment and Payment method share the one read. A card that fails to load never blocks Pay
// now, Cancel plan or the invoices.
function useCardOnFile(b) {
  const params = useParams()
  const preview = params.get('card')
  const [state, setState] = useState(preview === 'error' ? 'error' : 'loading')
  useEffect(() => {
    if (preview === 'loading' || preview === 'error') { setState(preview); return undefined }
    setState('loading')
    const t = setTimeout(() => setState('ok'), 600)
    return () => clearTimeout(t)
  }, [preview])
  const retry = () => { setState('loading'); setTimeout(() => setState(preview === 'error' ? 'error' : 'ok'), 700) }
  // the expiry month: the sample's, or this month / last month for the previews
  const exp = preview === 'expired' ? addMonths(TODAY, -1).slice(0, 7) : preview === 'expiring' ? TODAY.slice(0, 7) : b.card?.exp
  const month = TODAY.slice(0, 7)
  const expiry = !exp ? null : exp < month ? 'expired' : exp === month ? 'expiring' : 'ok'
  return { state, retry, none: preview === 'none', exp, expiry, member: b.who === 'member', paused: b.seller === 'paused', card: b.card }
}
const expLong = (exp) => (exp ? `${monthName(`${exp}-01`).slice(0, 3)} ${exp.slice(0, 4)}` : '—')

// ---------------------------------------------------------------- Your plan
// One usage meter, as the sidebar's plan meter and Prompt Hub's pill: the ring (ink, amber from 80%, red from 95%),
// the number in use bold and the limit regular and muted. A client never sees more in use than the limit.
function Meter({ name, used, limit, i, on }) {
  const shown = Math.min(used, limit)
  const pct = limit ? shown / limit : 0
  const high = ringTone(pct) !== 'ok'
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-line px-4 pb-3.5 pt-3" style={{ '--fill-delay': `calc(var(--motion-stagger) * ${i})` }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] leading-[18px] text-stone-600">{name}</p>
        <UsageRing pct={on ? pct : 0} size={24} stroke={3} className="[&>circle+circle]:[transition-delay:var(--fill-delay)]" />
      </div>
      <p className="mt-1 text-[14px] leading-7 text-stone-500 tabular-nums" aria-label={`${shown} of ${limit} ${name.toLowerCase()} used`}>
        <span className="text-[22px] font-bold tracking-[-0.01em] text-stone-900">{shown}</span> / {limit}
      </p>
      {high && <TextLink className="mt-0.5 self-start" onClick={() => setParams({ tab: 'plans', msg: null })}>Add more</TextLink>}
    </div>
  )
}

function PlanPanel({ b, off, dead, saveFailed, on }) {
  const [confirm, setConfirm] = useState(null)
  const [opening, setOpening] = useState(null)
  const paused = b.seller === 'paused'
  const leave = (kind) => { setOpening(kind); setTimeout(() => navigate(`/plans/pay?kind=${kind}&plan=${b.plan.id}&back=${encodeURIComponent('/plans' + window.location.search)}`), 700) }
  const p = b.plan
  const u = promptUsage()
  const usage = b.usage ?? {}
  const offAll = off ?? (dead ? MEMBER_OFF : null)
  const changeOff = offAll ?? (paused ? NOT_NOW : b.status === 'pastdue' ? 'Pay the overdue invoice to switch plans.' : null)
  const n = (p.enginesLabel ?? '').match(/^(\d+)\s(.*)$/)
  return (
    <section aria-labelledby="bill-plan" className={`${card} md:p-6`}>
      {/* a scheduled change: a strip at the top of the panel, with Withdraw */}
      {b.scheduled && (
        <div className="-mt-1 mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-tint px-4 py-2.5 text-[14px] leading-5 text-stone-700">
          <Pending n="decision 9" className="text-pretty">Switching to <B>{b.scheduled.plan.name}</B> on <DateTip iso={b.scheduled.starts} bold /></Pending>
          <WithdrawLink b={b} off={offAll} />
        </div>
      )}
      <h2 id="bill-plan" className={label}>Your plan</h2>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <p className="flex min-w-0 flex-wrap items-center gap-3 text-h1 text-stone-900">{p.name}<SubStatus b={b} /></p>
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:pt-0.5">
          {b.status === 'pastdue' && (
            <>
              <Btn look="line" off={changeOff} onClick={() => setParams({ change: 'pick' })}>Change plan</Btn>
              <Btn look="ink" off={offAll ?? (paused ? NOT_NOW : null)} busy={opening === 'invoice'} onClick={() => leave('invoice')}>Pay now</Btn>
            </>
          )}
          {b.status === 'cancelling' && (
            <>
              <span className="text-[14px] leading-5 text-stone-600">Ends <DateTip iso={b.paidThrough} bold /></span>
              <Btn look="ink" off={offAll} onClick={(e) => setConfirm(e.currentTarget)}>Resume plan</Btn>
            </>
          )}
          {b.status === 'active' && <Btn look="ink" off={changeOff} onClick={() => setParams({ change: b.scheduled?.plan.id ?? 'pick' })}>Change plan</Btn>}
        </div>
      </div>

      {b.status === 'pastdue' ? (
        <>
          <p className="mt-2 text-[15px] leading-[22px] text-stone-700 tabular-nums"><B>{money(b.due.amount)}</B> overdue</p>
          <p className="mt-1 max-w-[560px] text-[14px] leading-5 text-stone-500 text-pretty">
            Your {monthName(b.failedOn)} payment didn’t go through. <Pending n="decision 11">Pay by <DateTip iso={b.graceEnd} bold /> to keep your plan.</Pending>
          </p>
        </>
      ) : (
        <>
          <Pending as="p" n="decision 6" className="mt-2 block text-[15px] leading-[22px] text-stone-700"><PerMonth amount={b.price} /></Pending>
          {b.status === 'active' && <p className="mt-1 text-[14px] leading-5 text-stone-500 tabular-nums">Renews <DateTip iso={b.renews} /> · in {daysUntil(b.renews)} days</p>}
          {b.status === 'cancelling' && <p className="mt-1 text-[14px] leading-5 text-stone-500 text-pretty">Paid up until then. Your plan won’t renew.</p>}
        </>
      )}
      {paused && <p className="mt-2 text-[13px] leading-[18px] text-stone-500 text-pretty">Payments are being reconnected. Your plan and access are not affected.</p>}

      {/* usage: prompts across all brands (the real count), competitors and logins */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Meter name="Prompts" used={u.used} limit={u.limit} i={0} on={on} />
        <Meter name="Competitors" used={usage.competitors ?? 0} limit={p.competitors} i={1} on={on} />
        <Meter name="Logins" used={usage.logins ?? 0} limit={p.logins} i={2} on={on} />
      </div>

      {/* the plan's main features (catalog data, at most three) */}
      <ul className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--div)] pt-4 text-[13px] leading-[18px] text-stone-600">
        {p.engines && (
          <li className="flex items-center gap-2">
            <span>Includes {n ? <><B>{n[1]}</B> {n[2]}</> : p.enginesLabel}</span>
            <span className="flex items-center gap-1" aria-label={p.engines.map((e) => e.label).join(', ')} role="img">
              {p.engines.filter((e) => e.engine).map((e) => <PlatformIcon key={e.engine} id={e.engine} size={14} />)}
            </span>
          </li>
        )}
        {[p.refresh, p.call].filter(Boolean).slice(0, 2).map((f) => <li key={f}>{f}</li>)}
      </ul>

      {saveFailed && <InlineError className="mt-4" onRetry={() => setParams({ save: null })}>Couldn’t save that change. Nothing was changed.</InlineError>}
      {confirm && (
        <ConfirmPopover anchor={confirm} title={`Resume ${p.name}?`} body={`It renews ${shortDate(b.paidThrough)} at ${money(b.price)} per month.`} confirmLabel="Resume plan" cancelLabel="Not now"
          onConfirm={() => { setConfirm(null); setParams({ sub: 'active', msg: 'resumed' }) }} onCancel={() => setConfirm(null)} />
      )}
    </section>
  )
}
function WithdrawLink({ b, off }) {
  const [anchor, setAnchor] = useState(null)
  if (off) return <Btn look="quiet" size="sm" off={off}>Withdraw</Btn>
  return (
    <>
      <TextLink data-withdraw className="!text-[14px] !leading-5" onClick={(e) => setAnchor(e.currentTarget)}>Withdraw</TextLink>
      {anchor && (
        <ConfirmPopover anchor={anchor} title={`Stay on ${b.plan.name}?`} body={`The switch to ${b.scheduled.plan.name} on ${shortDate(b.scheduled.starts)} is withdrawn.`} confirmLabel="Withdraw change" cancelLabel="Keep it"
          onConfirm={() => { setAnchor(null); setParams({ sub: 'active', msg: 'withdrawn' }) }} onCancel={() => setAnchor(null)} />
      )}
    </>
  )
}

// ---------------------------------------------------------------- Next payment
// the card used, in a line: "Visa ·· 4242", "Card on file" (a team member), or nothing it can't know yet
function CardUsed({ c }) {
  if (c.member) return <span>Card on file</span>
  if (c.paused || c.none || !c.card) return null
  if (c.state === 'loading') return <span aria-hidden className="inline-block h-4 w-20 animate-pulse rounded-lg bg-tint align-middle motion-reduce:animate-none" />
  if (c.state === 'error') return <span>—</span>
  return <span className="tabular-nums">{c.card.brand} ·· {c.card.last4}</span>
}
function NextPayment({ b, c, on }) {
  const amount = b.scheduled ? priceOf(b.scheduled.plan.id) : b.price
  let body
  if (b.status === 'active' && b.renews) {
    // how far through the billing period we are (from the dates; a sliver is always drawn so the line reads as one)
    const start = addMonths(b.renews, -1)
    const total = daysUntil(b.renews, start)
    const done = total - daysUntil(b.renews)
    const pct = Math.max(0.04, Math.min(1, total ? done / total : 0))
    const used = c.member || (!c.paused && !c.none && c.card) ? <CardUsed c={c} /> : null
    body = (
      <>
        <p className="mt-1 text-[28px] leading-9 font-semibold tracking-[-0.02em] text-stone-900 tabular-nums"><DateTip iso={b.renews} /></p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[14px] leading-5 text-stone-500">
          {b.scheduled ? <Pending n="decision 9"><B>{money(amount)}</B></Pending> : <B>{money(amount)}</B>}
          {used && <><span aria-hidden>·</span>{used}</>}
        </p>
        <div className="mt-4" role="img" aria-label={`Day ${done + 1} of ${total} in this billing period`}>
          <div className="h-1 overflow-hidden rounded-full bg-[var(--color-line-strong)]">
            <div className="h-full origin-left rounded-full bg-ink transition-transform duration-[600ms] ease-[var(--motion-ease-out)] motion-reduce:transition-none"
              style={{ transform: `scaleX(${on ? pct : 0})` }} />
          </div>
          <p className="mt-1.5 flex justify-between text-[12px] leading-4 text-stone-500 tabular-nums"><span>{shortDate(start)}</span><span>{shortDate(b.renews)}</span></p>
        </div>
      </>
    )
  } else if (b.status === 'cancelling') {
    body = (
      <>
        <p className="mt-1 text-[28px] leading-9 font-semibold text-stone-900">—</p>
        <p className="mt-0.5 text-[14px] leading-5 text-stone-500 text-pretty">No more payments.</p>
      </>
    )
  } else {
    // past due: the renewal date is set again once the overdue invoice is paid
    body = (
      <>
        <p className="mt-1 text-[28px] leading-9 font-semibold text-stone-900">—</p>
        <Pending as="p" n="Q6" className="mt-0.5 block text-[14px] leading-5 text-stone-500 text-pretty">Set once the overdue invoice is paid.</Pending>
      </>
    )
  }
  return (
    <section aria-labelledby="bill-next" className={card}>
      <h2 id="bill-next" className={label}>Next payment</h2>
      {body}
    </section>
  )
}

// ---------------------------------------------------------------- Payment method
// the small card graphic: the brand's word mark (graphite, no brand colour), the chip and the last four. A team member's
// card has no brand or digits; no card: a dashed outline
function CardArt({ c, blank = false }) {
  return (
    <div aria-hidden className={`flex h-[56px] w-[88px] shrink-0 flex-col justify-between rounded-lg border px-2.5 py-2 ${blank ? 'border-dashed border-[var(--color-line-strong)]' : 'border-line bg-tint'}`}>
      {!blank && (
        <>
          <span className="flex items-center justify-between">
            <span className="text-[12px] leading-4 font-extrabold italic tracking-[-0.02em] text-stone-900">{c.member ? '' : c.card?.brand?.toUpperCase()}</span>
            <span className="h-2.5 w-3.5 rounded-[3px] border border-[var(--color-line-strong)]" />
          </span>
          <span className="whitespace-nowrap text-[11px] leading-3 text-stone-600 tabular-nums">{c.member ? '' : `•• ${c.card?.last4}`}</span>
        </>
      )}
    </div>
  )
}
const Dot = ({ tone }) => <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${tone === 'red' ? 'bg-negative' : 'bg-[var(--ring-warn)]'}`} />
function PaymentMethod({ b, c, off }) {
  const [opening, setOpening] = useState(false)
  const update = () => { setOpening(true); setTimeout(() => navigate(`/plans/pay?kind=card&back=${encodeURIComponent('/plans' + window.location.search)}`), 700) }
  let row
  if (c.member) row = <><CardArt c={c} /><p className="text-[14px] leading-5 text-stone-900">Card on file</p></>
  else if (c.paused) row = <><CardArt c={c} blank /><p className="text-[14px] leading-5 text-stone-500 text-pretty">Card details aren’t available right now.</p></>
  else if (c.state === 'loading') row = <><Skeleton className="h-[56px] w-[88px] shrink-0" /><div className="flex flex-col gap-1.5"><Skeleton className="h-4 w-24" /><Skeleton className="h-3.5 w-28" /></div></>
  else if (c.state === 'error') row = <InlineError onRetry={c.retry}>Card details couldn’t be loaded.</InlineError>
  else if (c.none) row = <><CardArt c={c} blank /><p className="text-[14px] leading-5 text-stone-600">No card on file.</p></>
  else {
    row = (
      <>
        <CardArt c={c} />
        <div className="min-w-0">
          <p className="text-[14px] leading-5 font-semibold text-stone-900 tabular-nums">{c.card.brand} ·· {c.card.last4}</p>
          {c.expiry === 'expired' ? <p className="mt-0.5 flex items-center gap-1.5 text-[13px] leading-[18px] text-stone-700"><Dot tone="red" />Update to keep your plan</p>
            : c.expiry === 'expiring' ? <p className="mt-0.5 flex items-center gap-1.5 text-[13px] leading-[18px] text-stone-700"><Dot tone="amber" />Expires this month</p>
              : <p className="mt-0.5 text-[13px] leading-[18px] text-stone-500 tabular-nums">Expires {expLong(c.exp)}</p>}
        </div>
      </>
    )
  }
  return (
    <section aria-labelledby="bill-card" className={card} aria-busy={c.state === 'loading'}>
      <h2 id="bill-card" className={label}>Payment method</h2>
      <div className="mt-3 flex min-h-[56px] items-center gap-3">{row}</div>
      {b.status === 'pastdue' && !c.member && !c.paused && c.state === 'ok' && !c.none && <p className="mt-2 text-[13px] leading-[18px] text-negative">This card was declined on {shortDate(b.failedOn)}.</p>}
      {!c.member && (
        <div className="mt-4">
          <Btn look="line" size="sm" off={off ?? (c.paused ? NOT_NOW : null)} busy={opening} onClick={update} tip="Opens a secure page to change your card.">{c.none ? 'Add a card' : 'Update card'}</Btn>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- Invoices
// invoice statuses are neutral pills; only "Overdue" has the red dot ("Paid" is drawn neutral: an open question)
const InvoiceStatus = ({ s }) => <StatusPill tone={s === 'Overdue' ? 'overdue' : 'neutral'}>{s}</StatusPill>
function DownloadBtn({ inv, onFail }) {
  const [busy, setBusy] = useState(false)
  const fail = new URLSearchParams(window.location.search).get('dl') === 'fail'
  // shown on the row's hover and keyboard focus, always on touch screens; stays while it works
  return (
    <button type="button" aria-label={`Download invoice ${inv.number} (PDF)`} disabled={busy}
      onClick={() => { setBusy(true); setTimeout(() => { setBusy(false); if (fail) onFail() }, 800) }}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-md text-stone-600 outline-none transition-[opacity,background-color] duration-150 hover:bg-tint hover:text-stone-900 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus group-hover/inv:opacity-100 group-focus-within/inv:opacity-100 touch:opacity-100 ${busy ? 'opacity-100' : 'opacity-0'}`}>
      {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
    </button>
  )
}
function InvoiceRow({ inv, b, off, failed, onFail, onRetry, paying, onPay }) {
  const year = inv.date.slice(0, 4)
  return (
    <li className="group/inv py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] leading-5 font-semibold text-stone-900">{monthName(inv.date)} {year}</p>
          <p className="mt-0.5 text-[13px] leading-[18px] text-stone-500 tabular-nums">{period(inv.from, inv.to)}<span className="max-sm:block"><span className="max-sm:hidden"> · </span>{inv.number}</span></p>
        </div>
        <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-0">
          <span className="text-right text-[14px] leading-5 font-bold text-stone-900 tabular-nums">{money(inv.amount)}</span>
          <span className="flex justify-end sm:w-[92px]"><InvoiceStatus s={inv.status} /></span>
        </span>
        <span className="flex min-w-8 justify-end sm:w-14">
          {inv.status === 'Overdue'
            ? <Btn look="line" size="sm" off={off} disabled={b.seller === 'paused'} busy={paying} busyLabel="…" onClick={onPay}>Pay</Btn>
            : <DownloadBtn inv={inv} onFail={onFail} />}
        </span>
      </div>
      {failed && <InlineError className="mt-1.5" onRetry={onRetry}>Couldn’t download the invoice.</InlineError>}
    </li>
  )
}
function Invoices({ b, off }) {
  const params = useParams()
  const [all, setAll] = useState(false)
  const [failedRow, setFailedRow] = useState(params.get('dl') === 'fail' ? b.invoices[1]?.number ?? b.invoices[0]?.number : null)
  const [opening, setOpening] = useState(false)
  const err = params.get('invoices') === 'error'
  const pay = () => { setOpening(true); setTimeout(() => navigate(`/plans/pay?kind=invoice&plan=${b.plan.id}&back=${encodeURIComponent('/plans' + window.location.search)}`), 700) }
  const row = (inv) => (
    <InvoiceRow key={inv.number} inv={inv} b={b} off={off} failed={failedRow === inv.number} onFail={() => setFailedRow(inv.number)} onRetry={() => setFailedRow(null)} paying={opening} onPay={pay} />
  )
  const latest = b.invoices.slice(0, 3)
  const rest = b.invoices.slice(3)
  return (
    <section aria-labelledby="bill-invoices" className={card}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="bill-invoices" className={label}>Invoices</h2>
        {!err && b.invoices.length > 0 && <span className="text-[13px] leading-[18px] text-stone-500 tabular-nums">{b.invoices.length} in all</span>}
      </div>
      {err ? <InlineError className="mt-3" onRetry={() => setParams({ invoices: null })}>Invoices couldn’t be loaded.</InlineError>
        : !b.invoices.length ? (
          <div className="mt-3"><p className="text-[14px] leading-5 text-stone-700">No invoices yet.</p>{b.status !== 'ended' && <p className="mt-0.5 text-[13px] leading-[18px] text-stone-500">Your first invoice appears here after your first payment.</p>}</div>
        ) : (
          <>
            <ul className="mt-1 divide-y divide-[var(--div)]">{latest.map(row)}</ul>
            {rest.length > 0 && (
              <>
                {/* the older ones: the standard expand (grid rows 0fr ↔ 1fr, 200ms) */}
                <div id="bill-invoices-more" inert={all ? undefined : ''}
                  className={`grid transition-[grid-template-rows] duration-200 ease-[var(--motion-ease-out)] motion-reduce:transition-none ${all ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                  <ul className="min-h-0 divide-y divide-[var(--div)] overflow-hidden border-t border-[var(--div)]">{rest.map(row)}</ul>
                </div>
                <TextLink className="mt-2" aria-expanded={all} aria-controls="bill-invoices-more" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${b.invoices.length}`}</TextLink>
              </>
            )}
          </>
        )}
    </section>
  )
}

// ---------------------------------------------------------------- Cancel plan (a quiet row at the end)
function CancelRow({ b, off }) {
  const now = b.status === 'pastdue'
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[13px] leading-[18px] text-stone-500">
      {off ? <Btn look="quiet" size="sm" off={off} className="!px-2">Cancel plan</Btn>
        : <button type="button" onClick={() => setParams({ cancel: '1' })} className="rounded font-medium text-stone-600 underline-offset-2 outline-none hover:text-stone-900 hover:underline focus-visible:ring-2 focus-visible:ring-focus">Cancel plan</button>}
      <span className="text-pretty">{now ? 'Your plan ends right away and the overdue invoice is cancelled.' : <>You keep access until <DateTip iso={b.renews} />.</>}</span>
    </div>
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
    <section aria-labelledby="bill-ended" className={`${card} md:p-6`}>
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

// the loading state: the new layout's blocks, no words
function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading your billing details" className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3">
      <div className={`${card} flex flex-col gap-3 md:p-6 lg:col-span-2`}>
        <Skeleton className="h-4 w-16" /><Skeleton className="h-9 w-48" /><Skeleton className="h-5 w-40" />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"><Skeleton className="h-[78px] !rounded-xl" /><Skeleton className="h-[78px] !rounded-xl" /><Skeleton className="h-[78px] !rounded-xl" /></div>
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>
      <div className="flex flex-col gap-3 md:gap-4">
        <div className={`${card} flex flex-col gap-3`}><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-28" /><Skeleton className="h-1 w-full" /></div>
        <div className={`${card} flex flex-col gap-3`}><Skeleton className="h-4 w-28" /><div className="flex gap-3"><Skeleton className="h-[56px] w-[88px]" /><Skeleton className="h-4 w-24" /></div></div>
      </div>
      <div className={`${card} flex flex-col gap-4 lg:col-span-3`}><Skeleton className="h-4 w-16" /><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
    </div>
  )
}

export default function BillingTab({ b }) {
  const params = useParams()
  const show = params.get('show')
  const off = b.who === 'viewas' ? whyOff(b) : b.who === 'member' ? MEMBER_OFF : null
  const dead = b.who === 'member'
  const c = useCardOnFile(b)
  const on = useFillIn()
  if (show === 'loading') return <Loading />
  if (show === 'error') return <section className={card}><InlineError onRetry={() => setParams({ show: null })}>Your billing details couldn’t be loaded.</InlineError></section>
  const ended = b.status === 'ended'
  return (
    <>
      <h2 id="billing-first" tabIndex={-1} className="sr-only">Billing</h2>
      {(ended || dead) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {ended && <SubStatus b={b} />}
          {dead && <p className="text-[13px] leading-[18px] text-stone-500">Only the account owner can manage billing.</p>}
        </div>
      )}
      {ended ? <EndedCard b={b} off={off} /> : (
        <div className="grid grid-cols-1 items-start gap-3 md:gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><PlanPanel b={b} off={b.who === 'viewas' ? off : null} dead={dead} saveFailed={params.get('save') === 'fail' && !params.get('change')} on={on} /></div>
          <div className="flex flex-col gap-3 md:gap-4">
            <NextPayment b={b} c={c} on={on} />
            <PaymentMethod b={b} c={c} off={b.who === 'viewas' ? off : null} />
          </div>
        </div>
      )}
      <Invoices b={b} off={off} />
      {!ended && b.status !== 'cancelling' && <CancelRow b={b} off={off} />}
      {!ended && b.canAct && <ChangePlan b={b} />}
      {!ended && b.canAct && <CancelPlan b={b} />}
    </>
  )
}
