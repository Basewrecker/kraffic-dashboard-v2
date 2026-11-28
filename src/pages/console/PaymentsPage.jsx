import { useEffect, useRef, useState } from 'react'
import { Check, Circle, Loader2, Lock, MoreHorizontal } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Switch from '../../components/ui/Switch'
import ActionMenu from '../../components/audit/ActionMenu'
import ConfirmPopover from '../../components/prompts/ConfirmPopover'
import { setParams, useParams } from '../../components/audit/parts'
import { money, shortDate } from '../../billing/format.js'
import { PAYMENTS, PRICE_ROWS, SELLER } from '../../billing/consoleData.js'
import { B, Btn, InlineError, Pending, PerMonth, ShellBanner, Skeleton, StatusPill } from '../../billing/ui.jsx'
import ConsoleShell from './ConsoleShell'

// Screen 7. Workspace settings → Payments: superadmin console → White label → a workspace → "Payments". Whoever opens
// it acts for the workspace: connect Stripe, set prices, go live, disconnect (open conflict 9: in v1 that is staff).
// Clients never see it, so this page may name Stripe. Header with the mode pill and the connection control, then four
// cards: Stripe account · Go-live checklist · Plan prices · Recent payments.
// States, by ?st=: notconnected · connecting · unverified · test (default) · live · restricted · disconnected ·
// different (reconnecting another account). Also ?show=loading|error|nopackages|nopayments · ?house=1 (the house
// seller) · ?off=1 (switched off) · ?edit=<plan>&price=saving|refused|failed|invalid · ?dialog=golive|disconnect|price.
const card = 'rounded-2xl border border-line bg-surface px-5 py-5'
const h2 = 'text-[15px] leading-5 font-semibold text-stone-900'
const product = 'Auden AI'

// the green "Connected" pill: one of the two green elements in billing
const Connected = () => <StatusPill tone="active">Connected</StatusPill>
const Tip = ({ text, children, align = 'center' }) => (
  <span tabIndex={0} className="group/tp relative inline-flex rounded outline-none focus-visible:ring-2 focus-visible:ring-focus">
    {children}
    <span role="tooltip" className={`tip-dark pointer-events-none absolute bottom-full z-30 mb-2 w-max font-normal opacity-0 transition-opacity duration-150 group-hover/tp:opacity-100 group-focus-visible/tp:opacity-100 ${align === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2'}`}>{text}</span>
  </span>
)

// ---------------------------------------------------------------- Plan prices
function PriceRow({ row, st, editing, preview }) {
  const readOnly = st === 'restricted' || st === 'disconnected'
  const [value, setValue] = useState(preview === 'refused' ? '1200' : preview === 'invalid' ? '' : String(row.price ?? ''))
  const [state, setState] = useState(editing ? preview ?? 'idle' : 'idle') // idle | saving | refused | failed | invalid | zero
  const [shown, setShown] = useState(row.shown)
  const [ask, setAsk] = useState(null)
  const input = useRef(null)
  useEffect(() => { if (editing && state !== 'saving') input.current?.focus() }, [editing, state])
  const save = () => {
    if (value.trim() === '') { setState('invalid'); return }
    if (!(Number(value) > 0)) { setState('zero'); return }
    setState('saving')
    // the page can't know the minimum: a price under it is always a refused save, never a check while typing
    setTimeout(() => (Number(value) < row.floor ? setState('refused') : setParams({ edit: null, price: null })), 900)
  }
  const cancel = () => setParams({ edit: null, price: null })
  const err = { refused: 'This price is below the minimum for this plan. Enter a higher price.', invalid: 'Enter a price.', zero: 'Enter a number greater than 0.' }[state]
  const limits = (
    <span className="inline-flex items-center gap-1.5 text-[13px] leading-[18px] text-stone-600 tabular-nums">
      {row.prompts}{row.id === 'enterprise' ? '+' : ''} prompts · {row.competitors ?? 'Custom'} competitors · {row.logins ?? 'Custom'} logins
      <Tip text={`Limits are set by ${product}. You set the price.`}><Lock size={12} className="text-stone-400" aria-label="Limits can’t be edited" /></Tip>
    </span>
  )
  return (
    <li className="py-3.5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="min-w-0 md:w-[38%]"><p className="text-[14px] leading-5 font-semibold text-stone-900">{row.name}</p>{limits}</div>
        {editing ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <label className={`inline-flex h-9 items-center gap-1.5 rounded-lg border bg-raised px-3 text-[14px] leading-5 ${err ? 'border-negative' : 'border-line focus-within:border-[var(--color-line-strong)]'}`}>
              <span className="text-stone-500">$</span>
              <input ref={input} inputMode="decimal" aria-label={`${row.name} price per month`} aria-invalid={Boolean(err)} aria-describedby={`price-help-${row.id}`} readOnly={state === 'saving'} value={value}
                onChange={(e) => { setValue(e.target.value.replace(/[^\d.]/g, '')); if (state !== 'saving') setState('idle') }} /* typing clears the error at once */
                onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
                className="w-20 bg-transparent font-semibold tabular-nums text-stone-900 outline-none" />
              <span className="text-stone-500">per month</span>
            </label>
            <Btn look="ink" busy={state === 'saving'} busyLabel="Saving…" onClick={(e) => (row.subscribers > 0 && state !== 'saving' ? setAsk(e.currentTarget) : save())}>Save</Btn>
            <Btn look="quiet" disabled={state === 'saving'} onClick={cancel}>Cancel</Btn>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1 text-[14px] leading-5 text-stone-600">
              {row.price == null ? <span className="text-stone-500">No price · clients see “Talk to us”</span> : <PerMonth amount={row.price} />}
              {row.subscribers > 0 && <span className="ml-3 text-[13px] text-stone-500"><B>{row.subscribers}</B> subscribers</span>}
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <Switch checked={shown} onChange={setShown} disabled={readOnly} aria-label={`Show ${row.name} to clients`} className={readOnly ? 'opacity-50' : ''}><span className="w-14 text-[13px] text-stone-600">{shown ? 'Shown' : 'Hidden'}</span></Switch>
              <Btn look="line" size="sm" off={readOnly ? 'Fix your Stripe account to change prices.' : null} onClick={() => setParams({ edit: row.id, price: null })}>Edit</Btn>
            </div>
          </>
        )}
      </div>
      {editing && (
        <div id={`price-help-${row.id}`} className="mt-2 flex flex-col gap-1 md:pl-[calc(38%+16px)]">
          {err && <InlineError>{err}</InlineError>}
          {/* the generic failed save is a different state from the refusal: it has Retry */}
          {state === 'failed' && <InlineError onRetry={save}>Couldn’t save. Nothing was changed.</InlineError>}
          {row.subscribers > 0 && <p className="text-[12px] leading-4 text-stone-500 text-pretty">The new price applies to new subscribers. Your <B>{row.subscribers}</B> current subscribers keep <B>{money(row.price)}</B>.</p>}
          {/* whether the seller sees the minimum is pending Harsh's decision: if yes, one line goes here */}
          <Pending as="p" n="Harsh: show the minimum?" className="hidden text-[12px] leading-4 text-stone-500 [html[data-notes]_&]:block">Room for “Minimum for this plan: {'{amount}'} per month” (not shown today).</Pending>
        </div>
      )}
      {ask && (
        <ConfirmPopover anchor={ask} title={`Change the price of ${row.name}?`} body={`New subscribers pay ${money(Number(value) || 0)} per month. Current subscribers keep ${money(row.price)}.`} confirmLabel="Change price" cancelLabel="Cancel"
          onConfirm={() => { setAsk(null); save() }} onCancel={() => setAsk(null)} />
      )}
    </li>
  )
}

export default function PaymentsPage() {
  const q = useParams()
  const st = q.get('st') ?? 'test'
  const show = q.get('show')
  const house = q.get('house') === '1'
  const switchedOff = q.get('off') === '1'
  const dialog = q.get('dialog')
  const [confirmed, setConfirmed] = useState(st === 'live' || q.get('emails') === 'off')
  const [opening, setOpening] = useState(null)
  const connected = ['unverified', 'test', 'live'].includes(st)
  const verified = ['test', 'live'].includes(st)
  const priced = show === 'nopackages' ? 0 : PRICE_ROWS.filter((r) => r.price != null && r.shown).length
  const rows = show === 'nopackages' ? [] : PRICE_ROWS
  const leave = (k) => { setOpening(k); setTimeout(() => { setOpening(null); setParams({ st: 'connecting' }) }, 900) }
  // connecting: back from Stripe, checking; then the Connect → Connected morph
  useEffect(() => { if (st !== 'connecting' || q.get('hold')) return undefined; const t = setTimeout(() => setParams({ st: 'unverified' }), 1800); return () => clearTimeout(t) }, [st]) // eslint-disable-line react-hooks/exhaustive-deps
  const modePill = st === 'live' || st === 'restricted' || st === 'disconnected' ? <StatusPill>Live</StatusPill> : connected ? <StatusPill>Test mode</StatusPill> : null
  const crumbs = <>White label · {SELLER.name} · Settings</>

  const header = (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">
          Payments
          <span className="inline-flex items-center gap-2 tracking-normal">
            {show !== 'loading' && show !== 'error' && modePill}
            {st === 'restricted' && <StatusPill tone="overdue">Payments paused</StatusPill>}
            {st === 'disconnected' && <StatusPill tone="overdue">Disconnected</StatusPill>}
          </span>
        </h1>
        <p className="mt-1 text-[14px] leading-5 text-stone-600">How {SELLER.name} takes card payments from its clients</p>
      </div>
      {/* the connection control */}
      {show !== 'loading' && show !== 'error' && !house && (
        <div className="flex shrink-0 items-center gap-2 md:pt-1">
          {connected ? (
            <><span className="bill-morph"><Connected /></span>
              <ActionMenu label="Stripe account actions" className="grid h-8 w-8 place-items-center rounded-md text-stone-600 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"
                items={[{ label: 'Open Stripe', onClick: () => {} }, { label: 'Reconnect', onClick: () => leave('reconnect') }, { label: 'Disconnect', danger: true, onClick: () => setParams({ dialog: 'disconnect' }) }]}><MoreHorizontal size={16} aria-hidden /></ActionMenu></>
          ) : st === 'connecting' ? <span className="inline-flex items-center gap-2 text-[13px] text-stone-600"><Loader2 size={14} className="animate-spin" aria-hidden />Checking…</span>
            : null /* restricted, disconnected: the alert below has the action */}
        </div>
      )}
    </div>
  )
  if (show === 'loading') return <ConsoleShell crumbs={crumbs}>{header}<div aria-busy="true" aria-label="Loading payment settings" className="flex flex-col gap-3 md:gap-4"><Skeleton className="h-28 !rounded-2xl" /><Skeleton className="h-52 !rounded-2xl" /><Skeleton className="h-64 !rounded-2xl" /></div></ConsoleShell>
  if (show === 'error') return <ConsoleShell crumbs={crumbs}>{header}<section className={card}><InlineError onRetry={() => setParams({ show: null })}>Payment settings couldn’t be loaded.</InlineError></section></ConsoleShell>

  const checks = [
    { ok: connected || house || st === 'restricted', name: 'Stripe account connected', pass: 'Connected to Stripe.', fail: st === 'disconnected' ? 'We can no longer reach your Stripe account.' : 'Connect your Stripe account to take payments.', action: <Btn look="line" size="sm" onClick={() => leave('connect')}>{st === 'disconnected' ? 'Reconnect Stripe' : 'Connect Stripe'}</Btn> },
    { ok: verified || house, name: 'Stripe has verified the account', pass: 'Stripe has verified your account and can take card payments.', fail: 'Stripe still needs details from you before it can take payments.', action: connected || st === 'restricted' ? <Btn look="line" size="sm">Finish in Stripe</Btn> : null },
    { ok: priced > 0, name: 'At least one plan has a price and is shown', pass: <><B>{priced}</B> plans are priced and shown to clients.</>, fail: 'Set a price for at least one plan and show it to clients.', action: rows.length ? <Btn look="line" size="sm" onClick={() => document.getElementById('pay-prices')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Set prices</Btn> : null },
    // self-confirmed: we can't read this from Stripe (open conflict 6: a third check)
    { ok: confirmed, self: true, name: 'Stripe’s own failed-payment emails are off', pass: 'You’ve confirmed Stripe’s failed-payment emails are off.', fail: 'Switch off Stripe’s failed-payment emails, so your clients don’t get two. We send these for you.' },
  ]
  const allOk = checks.every((c) => c.ok)
  const alerted = ['restricted', 'disconnected', 'different', 'notconnected'].includes(st) // the alert at the top (or the Stripe account card) has the one action
  return (
    <ConsoleShell crumbs={crumbs}>
      {header}
      {switchedOff && <ShellBanner><p className="text-stone-700">Payments are switched off for this workspace. Talk to us.</p></ShellBanner>}
      {st === 'test' && <ShellBanner><p>Test mode. No real payments are taken. Your clients don’t see prices yet.</p></ShellBanner>}
      {st === 'restricted' && (
        <ShellBanner alert actions={<Btn look="ink">Fix in Stripe</Btn>}>
          <p className="font-semibold text-stone-900">Stripe has paused payments on your account</p>
          <p className="mt-0.5">New clients can’t subscribe. Your current clients keep their access. Renewals that fall due are collected once, as soon as Stripe lifts the pause.</p>
        </ShellBanner>
      )}
      {(st === 'disconnected' || st === 'different') && (
        <ShellBanner alert actions={<Btn look="ink" busy={opening === 'reconnect'} busyLabel="Opening Stripe…" onClick={() => leave('reconnect')}>Reconnect Stripe</Btn>}>
          <p className="font-semibold text-stone-900">Your Stripe account is disconnected</p>
          <p className="mt-0.5">New clients can’t subscribe. Stripe may still charge your current clients. Reconnect the same account to bring everything back in step. Nobody is charged twice.</p>
        </ShellBanner>
      )}

      <section aria-labelledby="pay-stripe" className={card}>
        <h2 id="pay-stripe" className={h2}>Stripe account</h2>
        <div className="mt-3 text-[14px] leading-5 text-stone-600 text-pretty">
          {house ? <p>Payments go to {SELLER.legalName}’s own Stripe account.</p>
            : st === 'notconnected' ? <><p className="font-semibold text-stone-900">Take card payments from your clients</p><p className="mt-0.5">Connect your Stripe account. Clients pay you directly; your name is on the invoice.</p><div className="mt-3"><Btn look="ink" busy={opening === 'connect'} busyLabel="Opening Stripe…" disabled={switchedOff} onClick={() => leave('connect')}>Connect Stripe</Btn></div></>
              : st === 'connecting' ? <p className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" aria-hidden />Checking your Stripe account…</p>
                : st === 'restricted' ? <p className="text-stone-900">Stripe needs a document to verify your business.</p>
                  : st === 'disconnected' ? <p className="text-stone-900">We can no longer reach your Stripe account.</p>
                    : st === 'different' ? <InlineError>Reconnect the same Stripe account. You have <B className="!text-negative">{SELLER.subscribers}</B> paying clients on it.</InlineError>
                      : (
                        <>
                          <p className="text-stone-900">{SELLER.name} · connected by {SELLER.connectedBy} on <span className="tabular-nums">{shortDate(SELLER.connectedOn)}</span></p>
                          {st === 'unverified' && <><p className="mt-1">Stripe still needs details from you.</p><div className="mt-3"><Btn look="line">Finish in Stripe</Btn></div></>}
                          {st === 'live' && <p className="mt-1">Live since <B>{shortDate(SELLER.liveSince)}</B></p>}
                        </>
                      )}
        </div>
      </section>

      <section aria-labelledby="pay-checks" className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="pay-checks" className={h2}>Go-live checklist</h2>
          {st === 'live' ? null : <Btn look="ink" off={allOk ? null : 'Finish the checklist to go live.'} onClick={() => setParams({ dialog: 'golive' })}>Go live</Btn>}
        </div>
        {st === 'live' ? <p className="mt-3 flex items-center gap-2 text-[14px] leading-5 text-stone-700"><Check size={16} className="text-stone-500" aria-hidden />All checks passed.</p> : (
          <ul className="mt-3 divide-y divide-[var(--div)]">
            {checks.map((c) => (
              <li key={c.name} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:gap-4">
                {/* ticks are neutral: green is only for the Connected and Active pills */}
                <span aria-hidden className="mt-0.5 shrink-0 self-start text-stone-500 md:mt-0 md:self-center">{c.ok ? <span className="grid h-5 w-5 place-items-center rounded-full bg-ink text-on-ink"><Check size={12} strokeWidth={2.5} /></span> : <Circle size={20} strokeWidth={1.5} className="text-stone-400" />}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] leading-5 font-medium text-stone-900">{c.name}<span className="sr-only">: {c.ok ? 'passed' : 'not yet'}</span></p>
                  <p className="text-[13px] leading-[18px] text-stone-600 text-pretty">{c.ok ? c.pass : c.fail}</p>
                </div>
                {c.self ? (
                  <Pending n="conflict 6 · self-confirmed" className="flex shrink-0 items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] leading-[18px] text-stone-700"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-4 w-4 accent-[var(--ink)]" />I’ve switched these off</label>
                    <Tip text="In Stripe: Settings → Billing → Subscriptions and emails → switch off “Send emails when card payments fail”."><span className="cursor-default text-[13px] font-medium text-ink underline-offset-2 hover:underline">Show me where</span></Tip>
                  </Pending>
                ) : !c.ok && c.action && !alerted ? <div className="shrink-0">{c.action}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="pay-prices" aria-labelledby="pay-prices-title" className={`${card} scroll-mt-4`}>
        <h2 id="pay-prices-title" className={h2}>Plan prices</h2>
        {!rows.length ? <p className="mt-3 text-[14px] leading-5 text-stone-600">No plans to price yet. Talk to us to get your packages set up.</p> : (
          <>
            {st === 'notconnected' && <p className="mt-1 text-[13px] leading-[18px] text-stone-500">Prices go live when you do.</p>}
            <ul className="mt-2 divide-y divide-[var(--div)]">
              {rows.map((r) => <PriceRow key={`${r.id}-${q.get('edit')}-${q.get('price')}`} row={r} st={st} editing={q.get('edit') === r.id} preview={q.get('price')} />)}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="pay-recent" className={card}>
        <h2 id="pay-recent" className={h2}>Recent payments</h2>
        {show === 'nopayments' || st === 'notconnected' || st === 'unverified' ? <p className="mt-3 text-[14px] leading-5 text-stone-600">No payments yet.</p> : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead><tr className="border-b border-line text-left text-[12px] leading-4 font-medium text-stone-500">{['Date', 'Client', 'Plan', 'Amount', 'Result'].map((h) => <th key={h} scope="col" className={`py-2 font-medium ${h === 'Amount' ? 'text-right' : ''} ${h === 'Result' ? 'pl-6' : ''}`}>{h}</th>)}</tr></thead>
              <tbody>
                {PAYMENTS.map((p, i) => (
                  <tr key={i} className="border-b border-[var(--div)] text-[14px] leading-5 text-stone-700 last:border-b-0">
                    <td className="py-2.5 tabular-nums">{shortDate(p.date)}</td><td className="py-2.5 font-medium text-stone-900">{p.client}</td><td className="py-2.5">{p.plan}</td>
                    <td className="py-2.5 text-right font-semibold text-stone-900 tabular-nums">{money(p.amount)}</td>
                    <td className="py-2.5 pl-6"><StatusPill tone={p.result === 'Failed' ? 'overdue' : 'neutral'}>{p.result}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={dialog === 'golive'} onClose={() => setParams({ dialog: null })} title="Start taking real payments?"
        footer={<><Btn look="quiet" onClick={() => setParams({ dialog: null })}>Not yet</Btn><Btn look="ink" onClick={() => setParams({ dialog: null, st: 'live' })}>Go live</Btn></>}>
        <p className="text-[14px] leading-5 text-stone-700 text-pretty">Your clients will see prices and can subscribe by card. Payments go to your Stripe account, and your business name is on every invoice. You handle tax, refunds and disputes in Stripe.</p>
      </Modal>
      <Modal open={dialog === 'disconnect'} onClose={() => setParams({ dialog: null })} title="Disconnect Stripe?"
        footer={<><Btn look="quiet" onClick={() => setParams({ dialog: null })}>Keep connected</Btn><Btn look="line" className="!text-negative" onClick={() => setParams({ dialog: null, st: 'disconnected' })}>Disconnect</Btn></>}>
        <p className="text-[14px] leading-5 text-stone-700 text-pretty">New clients won’t be able to subscribe. Your <B>{SELLER.subscribers}</B> current subscribers keep their access, and Stripe keeps charging them until they cancel. To stop charging a client, cancel their plan first.</p>
      </Modal>
    </ConsoleShell>
  )
}
