import { useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import DrawerShell, { useDrawer } from '../../components/audit/DrawerShell'
import { openDrawer, setParams, useParams } from '../../components/audit/parts'
import MenuSelect from '../../components/ui/MenuSelect'
import { linkClick } from '../../router'
import { money, shortDate } from '../../billing/format.js'
import { FAILED_EVENTS, JOBS, MANUAL_QUEUE, PAYMENTS, PRICE_ROWS, RECONCILE, SELLERS, SUBS, WOULD_BLOCK } from '../../billing/consoleData.js'
import { B, Btn, InlineError, ShellBanner, Skeleton, StatusPill, Tabs, TextLink } from '../../billing/ui.jsx'
import ConsoleShell from './ConsoleShell'

// Screen 8. The superadmin billing view (/console/billing): Kraffic staff only, and READ-ONLY in v1. Nothing on this
// view changes anything: no retry, override, reopen, expire or edit, and no disabled versions of those either. A person
// can open a row's drawer, filter, search, change tab, Refresh and Retry (both only read again), and follow "View as
// client" and "Open workspace's Payments page".
// It follows the locked design system, not the old console's style (open conflict 1): sentence-case headers, neutral
// pills, green only for "Connected" and "Active", the red dot for Restricted / Disconnected / Overdue / Late / Failed.
// Previews: ?tab=sellers|subscriptions|health|block · ?mode=off|test|live · ?show=loading|error|empty|small ·
// ?state=<filter> · ?seller=<id> / ?sub=<email> (the drawers) · ?jobs=never
const card = 'rounded-2xl border border-line bg-surface'
const th = 'px-4 py-2.5 text-left text-[12px] leading-4 font-medium text-stone-500'
const td = 'px-4 py-3 align-middle text-[14px] leading-5 text-stone-700'
const RED = ['Restricted', 'Disconnected', 'Overdue', 'Late', 'Failed']
const GREEN = ['Connected', 'Active']
const Pill = ({ s }) => <StatusPill tone={GREEN.includes(s) ? 'active' : RED.includes(s) ? 'overdue' : 'neutral'}>{s}</StatusPill>
const Empty = ({ children, action }) => <div className="flex flex-col items-start gap-2 px-5 py-8 text-[14px] leading-5 text-stone-600">{children}{action}</div>
const Rows = ({ n = 5 }) => <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-2 p-4">{Array.from({ length: n }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
const Failed = ({ what }) => <div className="px-5 py-6"><InlineError onRetry={() => setParams({ show: null })}>{what} couldn’t be loaded.</InlineError></div>
function Table({ head, children, min = 760 }) {
  return (
    <div className="overflow-x-auto"><table className="w-full border-collapse" style={{ minWidth: min }}>
      <thead><tr className="border-b border-line">{head.map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
      <tbody className="[&>tr:last-child]:border-b-0 [&>tr]:border-b [&>tr]:border-[var(--div)]">{children}</tbody>
    </table></div>
  )
}
const rowBtn = 'cursor-pointer outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint'
const rowKeys = (open) => ({ tabIndex: 0, role: 'button', onClick: open, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } } })
const DL = ({ rows }) => <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-[14px] leading-5">{rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-stone-500">{k}</dt><dd className="text-stone-900 tabular-nums">{v}</dd></div>)}</dl>
const H3 = ({ children }) => <h3 className="mb-2 mt-6 text-[13px] leading-[18px] font-semibold text-stone-900">{children}</h3>

// ---------------------------------------------------------------- Sellers
function Sellers({ show }) {
  if (show === 'loading') return <Rows />
  if (show === 'error') return <Failed what="Sellers" />
  if (show === 'empty') return <Empty>No workspace has set up payments yet.</Empty>
  // a seller with clients but disconnected sorts first
  const list = (show === 'small' ? SELLERS.slice(1, 2) : SELLERS)
  return (
    <Table head={['Workspace', 'Connection', 'Mode', 'Live subscriptions', 'Went live', 'Last problem']}>
      {list.map((s) => (
        <tr key={s.id} className={rowBtn} aria-label={`Open ${s.name}`} {...rowKeys(() => openDrawer('seller', s.id))}>
          <td className={td}><span className="font-semibold text-stone-900">{s.name}</span><span className="block text-[12px] leading-4 text-stone-500">{s.host}</span></td>
          <td className={td}><Pill s={s.connection} /></td>
          <td className={td}><StatusPill>{s.mode}</StatusPill></td>
          <td className={`${td} tabular-nums`}>{s.active ? <><B>{s.active}</B> active{s.overdue ? <> · <B>{s.overdue}</B> overdue</> : null}</> : '—'}</td>
          <td className={`${td} tabular-nums`}>{shortDate(s.live)}</td>
          <td className={`${td} max-w-[260px] text-pretty text-stone-600`}>{s.problem ?? '—'}</td>
        </tr>
      ))}
    </Table>
  )
}
function SellerDrawer() {
  const drawer = useDrawer('seller', (id) => SELLERS.find((s) => s.id === id) ?? null)
  const s = drawer.item
  if (!s) return null
  const ok = s.connection === 'Connected'
  return (
    <DrawerShell drawer={drawer} title={s.name} meta={s.host}>
      <div className="flex flex-wrap items-center gap-2"><Pill s={s.connection} /><StatusPill>{s.mode}</StatusPill></div>
      <p className="mt-3"><a href={`/console/white-label/${s.id}/payments`} onClick={linkClick(`/console/white-label/${s.id}/payments`)} className="text-[13px] font-medium text-ink underline-offset-2 hover:underline">Open workspace’s Payments page</a></p>
      <H3>Go-live checklist</H3>
      <DL rows={[['Stripe connected', ok ? 'Passed' : 'Not yet'], ['Stripe verified', ok ? 'Passed' : 'Not yet'], ['A priced plan shown', 'Passed'], ['Failed-payment emails off', ok ? 'Self-confirmed' : 'Not yet']]} />
      <H3>Prices per package</H3>
      {/* the pricing floor may show here and only here: superadmin view */}
      <table className="w-full border-collapse text-[14px] leading-5"><thead><tr className="border-b border-line text-left text-[12px] font-medium text-stone-500"><th className="py-1.5 font-medium">Package</th><th className="py-1.5 text-right font-medium">Price</th><th className="py-1.5 text-right font-medium">Floor</th></tr></thead>
        <tbody>{PRICE_ROWS.map((r) => <tr key={r.id} className="border-b border-[var(--div)] last:border-b-0"><td className="py-2 text-stone-900">{r.name}</td><td className="py-2 text-right font-semibold tabular-nums text-stone-900">{money(r.price)}</td><td className="py-2 text-right tabular-nums text-stone-500">{money(r.floor)}</td></tr>)}</tbody></table>
      <H3>Last 10 payments</H3>
      <ul className="divide-y divide-[var(--div)] text-[13px] leading-[18px]">{PAYMENTS.map((p, i) => <li key={i} className="flex items-center justify-between gap-3 py-2"><span className="min-w-0 truncate text-stone-700"><span className="tabular-nums text-stone-500">{shortDate(p.date)}</span> · {p.client} · {p.plan}</span><span className="flex shrink-0 items-center gap-2"><span className="font-semibold tabular-nums text-stone-900">{money(p.amount)}</span><Pill s={p.result} /></span></li>)}</ul>
      <H3>Last 10 events</H3>
      <ul className="flex flex-col gap-1.5 text-[13px] leading-[18px] text-stone-600 tabular-nums">{['Nov 27 14:02 · invoice.paid', 'Nov 27 14:02 · customer.subscription.updated', 'Nov 27 09:14 · account.updated', 'Nov 26 18:30 · invoice.payment_failed', 'Nov 26 18:30 · invoice.created'].map((e) => <li key={e}>{e}</li>)}</ul>
    </DrawerShell>
  )
}

// ---------------------------------------------------------------- Subscriptions
const STATES = ['All', 'Demo', 'Pending', 'Active', 'Cancelling', 'Overdue', 'Ended', 'Set by hand']
function Subscriptions({ show }) {
  const q = useParams()
  const [text, setText] = useState('')
  const state = STATES.find((s) => s.toLowerCase() === (q.get('state') ?? '').toLowerCase()) ?? 'All'
  const seller = q.get('by') ?? 'all'
  const base = show === 'empty' ? [] : show === 'small' ? SUBS.slice(0, 1) : SUBS
  const list = base.filter((s) => (state === 'All' || s.state === state) && (seller === 'all' || s.seller === seller) && (!text || `${s.client} ${s.email}`.toLowerCase().includes(text.toLowerCase())))
  const count = (st) => (st === 'All' ? base.length : base.filter((s) => s.state === st).length)
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        {/* filter pills with counts: the picked pill is ink */}
        <div className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1" role="group" aria-label="Filter by state">
          {STATES.map((st) => (
            <button key={st} type="button" aria-pressed={state === st} onClick={() => setParams({ state: st === 'All' ? null : st.toLowerCase() })}
              className={`inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] leading-[18px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${state === st ? 'bg-ink text-on-ink' : 'text-stone-600 hover:bg-tint hover:text-stone-900'}`}>
              {st}<span className={`font-normal tabular-nums ${state === st ? 'opacity-70' : 'text-stone-500'}`}>{count(st)}</span>
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="flex h-8 w-56 items-center gap-2 rounded-md border border-line bg-raised px-2.5 focus-within:border-[var(--color-line-strong)]">
            <Search size={14} className="shrink-0 text-stone-500" aria-hidden />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Client name or email" aria-label="Search subscriptions" className="min-w-0 flex-1 bg-transparent text-[13px] text-stone-900 outline-none placeholder:text-stone-500" />
          </label>
          <MenuSelect value={seller} onChange={(v) => setParams({ by: v === 'all' ? null : v })} listLabel="Seller" width="w-56"
            groups={[{ items: [{ id: 'all', label: 'All sellers' }, ...SELLERS.map((s) => ({ id: s.name, label: s.name }))] }]} />
        </div>
      </div>
      {show === 'loading' ? <Rows /> : show === 'error' ? <Failed what="Subscriptions" />
        : !base.length ? <Empty>No subscriptions yet.</Empty>
          : !list.length ? <Empty action={<TextLink onClick={() => { setText(''); setParams({ state: null, by: null }) }}>Clear filters</TextLink>}>No {state === 'All' ? 'matching' : state.toLowerCase()} subscriptions.</Empty>
            : (
              <>
                <Table head={['Client', 'Seller', 'Plan', 'Price', 'State', 'Renews / ends', 'Flags']} min={900}>
                  {list.map((s) => (
                    <tr key={s.id} className={rowBtn} aria-label={`Open ${s.client}`} {...rowKeys(() => openDrawer('sub', s.id))}>
                      <td className={td}><span className="font-semibold text-stone-900">{s.client}</span><span className="block text-[12px] leading-4 text-stone-500">{s.email}</span></td>
                      <td className={td}>{s.seller}</td><td className={td}>{s.plan}</td>
                      <td className={`${td} font-semibold tabular-nums text-stone-900`}>{money(s.price)}</td>
                      <td className={td}><Pill s={s.state} /></td>
                      <td className={`${td} tabular-nums`}>{shortDate(s.date)}</td>
                      <td className={td}><span className="flex flex-wrap gap-1">{s.flags.length ? s.flags.map((f) => <StatusPill key={f}>{f}</StatusPill>) : <span className="text-stone-400">—</span>}</span></td>
                    </tr>
                  ))}
                </Table>
                {/* full data: 50 rows a page; small data keeps its headers and has no pagination */}
                {base.length > 1 && <p className="border-t border-line px-4 py-3 text-[13px] leading-[18px] text-stone-500 tabular-nums">Showing 1–{list.length} of {list.length} · 50 rows per page</p>}
              </>
            )}
    </>
  )
}
function SubDrawer() {
  const drawer = useDrawer('sub', (id) => SUBS.find((s) => s.id === id) ?? null)
  const s = drawer.item
  if (!s) return null
  return (
    <DrawerShell drawer={drawer} title={s.client} meta={`${s.email} · ${s.seller}`}>
      <div className="flex flex-wrap items-center gap-2"><Pill s={s.state} />{s.flags.map((f) => <StatusPill key={f}>{f}</StatusPill>)}</div>
      <p className="mt-3"><a href="/plans?billing=live&userId=42&tab=billing" onClick={linkClick('/plans?billing=live&userId=42&tab=billing')} className="text-[13px] font-medium text-ink underline-offset-2 hover:underline">View as client</a></p>
      <H3>What was bought</H3>
      <DL rows={[['Plan', s.plan], ['Price', s.price == null ? '—' : `${money(s.price)} per month`], ['Limits', '200 prompts · 5 competitors · 3 logins'], ['Started', 'Aug 27'], ['Renews / ends', shortDate(s.date)]]} />
      <H3>Invoices and payments</H3>
      <ul className="divide-y divide-[var(--div)] text-[13px] leading-[18px]">{['INV-0003 · Oct 27', 'INV-0002 · Sep 27', 'INV-0001 · Aug 27'].map((n) => <li key={n} className="flex items-center justify-between py-2"><span className="tabular-nums text-stone-700">{n}</span><span className="flex items-center gap-2"><span className="font-semibold tabular-nums text-stone-900">{money(s.price)}</span><StatusPill>Paid</StatusPill></span></li>)}</ul>
      <H3>Events</H3>
      <ul className="flex flex-col gap-1.5 text-[13px] leading-[18px] text-stone-600 tabular-nums"><li>Oct 27 10:01 · invoice.paid</li><li>Oct 27 10:00 · invoice.created</li><li>Aug 27 14:22 · checkout.session.completed</li></ul>
      {s.flags.includes('Override') && <><H3>Staff override</H3><DL rows={[['By', 'priya@auden.ai'], ['When', 'Nov 12'], ['Why', 'Access kept during a card dispute']]} /></>}
    </DrawerShell>
  )
}

// ---------------------------------------------------------------- Health
function Health({ show }) {
  const q = useParams()
  const never = q.get('jobs') === 'never'
  const box = (title, right, body) => <section className={card}><div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3"><h2 className="text-[15px] leading-5 font-semibold text-stone-900">{title}</h2>{right}</div>{body}</section>
  const empty = show === 'empty'
  return (
    <div className="flex flex-col gap-3 md:gap-4">
      {box('Jobs', <span className="flex items-center gap-3 text-[13px] leading-[18px] text-stone-500 tabular-nums">as of 2:14 PM<Btn look="line" size="sm"><RefreshCw size={13} aria-hidden />Refresh</Btn></span>,
        show === 'loading' ? <Rows n={4} /> : show === 'error' ? <Failed what="Health" /> : (
          <Table head={['Job', 'How often', 'Last ran', 'Last succeeded', 'State', 'Last error']}>
            {JOBS.map((j) => { const st = never ? 'Late' : j.state; return (
              <tr key={j.name}><td className={`${td} font-semibold text-stone-900`}>{j.name}</td><td className={td}>{j.every}</td>
                <td className={`${td} tabular-nums`}>{never ? 'Never ran' : <>ran <B>{j.ran}</B></>}</td><td className={`${td} tabular-nums`}>{never ? '—' : j.ok}</td>
                <td className={td}><Pill s={st} /></td><td className={`${td} text-stone-600`}>{never ? '—' : j.error ?? '—'}</td></tr>
            ) })}
          </Table>
        ))}
      {box('Events that failed', null, show === 'loading' ? <Rows n={2} /> : show === 'error' ? <Failed what="Health" /> : empty ? <Empty>No failed events.</Empty> : (
        <Table head={['Type', 'Seller', 'Object', 'Received', 'Attempts', 'Last error']}>
          {FAILED_EVENTS.map((e) => <tr key={e.object}><td className={`${td} font-semibold text-stone-900`}>{e.type}</td><td className={td}>{e.seller}</td><td className={`${td} tabular-nums`}>{e.object}</td><td className={`${td} tabular-nums`}>{e.received}</td><td className={`${td} tabular-nums`}><B>{e.attempts}</B> attempts</td><td className={`${td} text-stone-600`}>{e.error}</td></tr>)}
        </Table>
      ))}
      {box('Reconcile report (daily)', !empty && show !== 'loading' && show !== 'error' ? <span className="text-[13px] text-stone-600"><B>{RECONCILE.length}</B> differences</span> : null,
        show === 'loading' ? <Rows n={2} /> : show === 'error' ? <Failed what="Health" /> : empty ? <Empty>No differences.</Empty> : (
          <Table head={['Subscription', 'Our records', 'Stripe']}>{RECONCILE.map((r) => <tr key={r.what}><td className={`${td} font-semibold text-stone-900`}>{r.what}</td><td className={td}>{r.ours}</td><td className={td}>{r.theirs}</td></tr>)}</Table>
        ))}
      {box('Drift report (daily)', null, show === 'loading' ? <Rows n={1} /> : show === 'error' ? <Failed what="Health" /> : <Empty>No differences.</Empty>)}
      {/* a payment that arrived after a plan ended: staff handle it elsewhere */}
      {!empty && show !== 'loading' && show !== 'error' && box('Manual queue', <span className="text-[13px] text-stone-600"><B>{MANUAL_QUEUE.length}</B> to look at</span>,
        <ul className="divide-y divide-[var(--div)]">{MANUAL_QUEUE.map((m) => <li key={m.what} className="px-4 py-3 text-[14px] leading-5 text-stone-700"><span className="font-semibold text-stone-900">{m.what}</span> · {m.note}</li>)}</ul>)}
    </div>
  )
}

// ---------------------------------------------------------------- Would block
function WouldBlock({ show }) {
  const q = useParams()
  const days = q.get('days') ?? '7'
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-[13px] leading-[18px] text-stone-700">Report only. Nothing here is blocked.</p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <MenuSelect value="all" onChange={() => {}} listLabel="Reason" width="w-64" groups={[{ items: [{ id: 'all', label: 'All reasons' }, { id: 'passed', label: 'Access date passed' }, { id: 'none', label: 'No access date' }, { id: 'member', label: 'Team member with an old date' }] }]} />
          <MenuSelect value="all" onChange={() => {}} listLabel="Workspace" width="w-56" groups={[{ items: [{ id: 'all', label: 'All workspaces' }, ...SELLERS.map((s) => ({ id: s.id, label: s.name }))] }]} />
          <MenuSelect value={days} onChange={(v) => setParams({ days: v })} listLabel="Period" width="w-44" groups={[{ items: [{ id: '7', label: 'Last 7 days' }, { id: '30', label: 'Last 30 days' }] }]} />
        </div>
      </div>
      {show === 'loading' ? <Rows /> : show === 'error' ? <Failed what="This report" /> : show === 'empty' ? <Empty>Nothing would be blocked.</Empty> : (
        <Table head={['Account', 'What it would block', 'Why', 'Times', 'Last seen']}>
          {(show === 'small' ? WOULD_BLOCK.slice(0, 1) : WOULD_BLOCK).map((w) => (
            <tr key={w.account}><td className={td}><span className="font-semibold text-stone-900">{w.account}</span><span className="block text-[12px] leading-4 text-stone-500">{w.seller}</span></td>
              <td className={td}>{w.what}</td><td className={`${td} text-stone-600`}>{w.why}</td><td className={`${td} tabular-nums`}><B>{w.times}</B></td><td className={`${td} tabular-nums`}>{w.seen}</td></tr>
          ))}
        </Table>
      )}
    </>
  )
}

export default function BillingAdminPage() {
  const q = useParams()
  const tab = ['sellers', 'subscriptions', 'health', 'block'].includes(q.get('tab')) ? q.get('tab') : 'sellers'
  const mode = q.get('mode') ?? 'live'
  const show = q.get('show')
  return (
    <ConsoleShell>
      <div>
        <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">
          Billing<span className="tracking-normal"><StatusPill>{mode === 'off' ? 'Off' : mode === 'test' ? 'Test mode' : 'Live'}</StatusPill></span>
        </h1>
        <p className="mt-1 text-[14px] leading-5 text-stone-600">Every workspace’s payments and subscriptions. Read-only.</p>
      </div>
      {mode === 'off' && <ShellBanner><p className="text-stone-700">Billing is switched off. Nothing is charged and no checks run.</p></ShellBanner>}
      {mode === 'test' && <ShellBanner><p className="text-stone-700">Test mode. No real payments.</p></ShellBanner>}
      <Tabs id="adm" label="Billing" value={tab} onChange={(t) => setParams({ tab: t, show: null, state: null })} tabs={[['sellers', 'Sellers'], ['subscriptions', 'Subscriptions'], ['health', 'Health'], ['block', 'Would block']]} />
      <div id="adm-panel" role="tabpanel" aria-labelledby={`adm-tab-${tab}`} key={tab} className="modal-step">
        {tab === 'health' ? <Health show={show} /> : <section className={`${card} overflow-hidden`}>{tab === 'sellers' ? <Sellers show={show} /> : tab === 'subscriptions' ? <Subscriptions show={show} /> : <WouldBlock show={show} />}</section>}
      </div>
      <SellerDrawer /><SubDrawer />
    </ConsoleShell>
  )
}
