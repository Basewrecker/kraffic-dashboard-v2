import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, File, Info, Mail, Server } from 'lucide-react'
import { navigate } from '../../router'
import { setParams, useParams } from '../../components/audit/parts'
import ConfirmPopover from '../../components/prompts/ConfirmPopover'
import { billingState, priceOf, tabFor, WORKSPACE } from '../../billing/state.js'
import { money, shortDate } from '../../billing/format.js'
import { B, Btn, DateTip, Pending, RenewalTerms, Skeleton, StatusPill, Tabs, TextLink } from '../../billing/ui.jsx'
import BillingTab from './BillingTab'
import ReviewModal from './ReviewModal'
import SiteLogo from '../../components/ui/SiteLogo'
import { PlatformIcon } from '../../components/dashboard/icons'
import HeaderBell from '../../notifications/NotificationsBell'
import { account } from '../../data/mock'
import { PLAN, isSuperadmin, promptUsage } from '../../plan/plan.js'
import { FOOT_NOTE, GROUPS, PLANS, SECTIONS, TRUSTED, planAction, planNote } from '../../plan/catalog.js'

// Plans (/plans; the old /billing address lands here). As the app's page (components/dashboard-redesign/plans.tsx,
// 2026-11-27): header with the account's limits on one grey line, a compact "Trusted by" row, a "Done for you /
// Self-serve" switch, one row of whole, equal plan cards, then Compare plans. No prices anywhere. A click on a card's
// button sends a request email; it never changes the plan.
// Previews: ?plan=none (an account with no package of its own: every card reads "Talk to us") · ?request=sending|sent|
// failed (the button's slot) · ?userId=… (an admin's View as: buttons off, with the reason) · ?group=self.

// the small icon before a list item: an engine mark, a site's logo, or a plain file / server / mail glyph
function Mark({ item, size = 14 }) {
  if (item.engine) return <PlatformIcon id={item.engine} size={size} />
  if (item.domain) return <SiteLogo domain={item.domain} name={item.label} className="h-3.5 w-3.5 shrink-0 rounded-[3px]" initialClass="text-[8px]" />
  const I = { file: File, server: Server, mail: Mail }[item.icon]
  return I ? <I size={size} strokeWidth={1.5} className="shrink-0 text-stone-500" aria-hidden /> : null
}

// the segmented switch with a sliding ink fill and a count on each side
function GroupSwitch({ value, onChange, counts, id }) {
  const refs = useRef({})
  const [pill, setPill] = useState(null)
  useLayoutEffect(() => {
    const el = refs.current[value]
    if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth })
  }, [value])
  const onKey = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const i = GROUPS.findIndex((g) => g.id === value)
    const next = GROUPS[(i + step + GROUPS.length) % GROUPS.length]
    onChange(next.id); refs.current[next.id]?.focus()
  }
  return (
    <div role="radiogroup" aria-label="Plan type" onKeyDown={onKey} className="relative inline-flex h-9 shrink-0 items-center rounded-lg bg-tint p-1">
      {pill && <span aria-hidden className="absolute bottom-1 left-0 top-1 rounded-md bg-ink transition-[transform,width] duration-[250ms] ease-[var(--motion-ease-out)] motion-reduce:transition-none" style={{ transform: `translateX(${pill.x}px)`, width: pill.w }} />}
      {GROUPS.map((g) => {
        const on = g.id === value
        return (
          <button key={g.id} ref={(el) => { refs.current[g.id] = el }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} id={`${id}-${g.id}`} onClick={() => onChange(g.id)}
            className={`relative inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[13px] leading-[18px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'text-on-ink' : 'text-stone-600 hover:text-stone-900'}`}>
            {g.label}<span className={`font-normal tabular-nums ${on ? 'opacity-70' : 'text-stone-500'}`}>{counts[g.id]}</span>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- the card's button, by state
// Billing NOT live: today's page. "Current plan" / "Upgrade" / "Switch" / "Talk to us"; a click sends a request email
// and the button's slot carries "Sending…", "Request sent ✓", "Try again".
// Billing live (the brief, screen 1): Subscribe · Finish payment · Manage subscription · Switch at renewal ·
// Starts {date} + Withdraw · Resume · Pay now. A team member sees them disabled with one line; an admin viewing as a
// client sees them disabled with the reason in the dark tip. A plan with no price (Enterprise, a custom plan) keeps
// "Talk to us".
// → { label, look, off (a tooltip: disabled), dead (disabled, no tooltip), helper, act, tag, link }
function cardAction(plan, b, current) {
  const mine = current && plan.id === current.id
  const date = (iso) => shortDate(iso)
  if (!b.pricesShown || !b.canPay) {
    const a = planAction(plan, b.status === 'ended' || b.status === 'none' && !current ? null : current)
    return { label: a, look: a === 'Upgrade' ? 'ink' : 'soft', dead: a === 'Current plan', act: a === 'Current plan' ? null : 'request', legacy: true }
  }
  if (plan.custom || priceOf(plan.id) == null) return { label: 'Talk to us', look: 'soft', act: 'request', legacy: true }
  const guard = (x) => (b.who === 'viewas' ? { ...x, off: 'Can’t change plans from this view', helper: null } : b.who === 'member' ? { ...x, dead: true, helper: 'Only the account owner can change the plan.' } : x)
  switch (b.status) {
    case 'demo': return guard({ label: 'Subscribe', look: mine ? 'ink' : 'soft', act: 'review', tag: mine ? 'Your demo plan' : null })
    case 'pending': return b.pending.plan.id === plan.id
      ? guard({ label: 'Finish payment', look: 'ink', act: 'pay', helper: <>You started a payment for {plan.name}. <Pending n="decision 13">It’s held until <B>{date(b.pending.heldUntil)}</B>, {b.pending.heldTime}.</Pending></> })
      : { label: 'Subscribe', look: 'soft', dead: true }
    case 'active':
      if (mine) return guard({ label: 'Manage subscription', look: 'soft', act: 'manage' })
      if (b.scheduled?.plan.id === plan.id) return guard({ label: <>Starts {date(b.scheduled.starts)}</>, look: 'soft', dead: true, link: 'Withdraw', helper: <>{plan.name} starts <B>{date(b.scheduled.starts)}</B>.</> })
      return guard({ label: planAction(plan, current) === 'Upgrade' ? 'Upgrade at renewal' : 'Switch at renewal', look: 'soft', act: 'change', helper: <Pending n="decision 9">Starts <B>{date(b.renews)}</B>. No charge today.</Pending> })
    case 'cancelling': return mine
      ? guard({ label: 'Resume', look: 'ink', act: 'resume', helper: <>Your plan ends <B>{date(b.paidThrough)}</B>.</> })
      : { label: planAction(plan, current) === 'Upgrade' ? 'Upgrade at renewal' : 'Switch at renewal', look: 'soft', off: b.who === 'viewas' ? 'Can’t change plans from this view' : 'Resume your plan to switch.' }
    case 'pastdue': return mine
      ? guard({ label: 'Pay now', look: 'soft', act: 'payinvoice' }) // not black: the banner above has the page's one black Pay now
      : { label: planAction(plan, current) === 'Upgrade' ? 'Upgrade at renewal' : 'Switch at renewal', look: 'soft', off: b.who === 'viewas' ? 'Can’t change plans from this view' : 'Pay the overdue invoice to switch plans.' }
    // no plan / hand-set, ended, demo ended. One black primary per view: the most chosen plan's; the others are outlined
    default: return guard({ label: 'Subscribe', look: plan.tag === 'Most chosen' ? 'ink' : 'soft', act: 'review' })
  }
}

function PlanCard({ plan, b, current, req, onAct }) {
  const a = cardAction(plan, b, current)
  const priced = b.pricesShown && b.canPay && priceOf(plan.id) != null
  // which plan the "+100 prompts" note compares with: yours; none marked for an ended or plan-less account
  const marked = b.status === 'ended' || b.status === 'demo-ended' ? null : current
  const yours = Boolean(marked && plan.id === marked.id)
  const note = yours ? '' : planNote(plan, marked) // the tag says "Your plan", so the note doesn't repeat it
  const reqHelp = req === 'sent' ? 'We’ll reach out within one business day.' : req === 'failed' ? `Couldn’t send your request. Email us at ${WORKSPACE.support}.` : null
  const rows = [
    // where billing is live the price takes the big-number slot, so the prompt count leads this list (never said twice)
    ...(priced ? [[`${plan.prompts}${plan.promptsPlus ? '+' : ''}`, ' prompts']] : []),
    plan.competitors == null ? ['Custom', ' competitors'] : [String(plan.competitors), ' competitors'],
    plan.logins == null ? ['Custom', ' logins'] : [String(plan.logins), ` login${plan.logins === 1 ? '' : 's'}`],
    [plan.refresh.split(' ')[0], ` ${plan.refresh.split(' ').slice(1).join(' ')}`],
  ]
  const button = a.legacy && req === 'sending' ? <Btn look="soft" size="lg" full busy busyLabel="Sending…">{a.label}</Btn>
    : a.legacy && req === 'sent' ? <Btn look="soft" size="lg" full disabled className="!opacity-100">Request sent<Check size={14} aria-hidden /></Btn>
      : a.legacy && req === 'failed' ? <Btn look="soft" size="lg" full onClick={() => onAct('request', plan)}>Try again</Btn>
        : a.legacy && b.who === 'viewas' && !a.dead ? <Btn look="soft" size="lg" full off="Can’t change plans from this view">{a.label}</Btn>
          : <Btn look={a.look} size="lg" full off={a.off} disabled={a.dead} busy={req === 'opening'} onClick={a.act ? (e) => onAct(a.act, plan, e.currentTarget) : undefined}>{a.label}</Btn>
  return (
    // border: light at rest, ink only on hover or focus; the "Most chosen" card is not raised
    <article aria-label={`${plan.name} plan`} data-plan={plan.id} data-lead={yours || a.look === 'ink' ? '' : undefined} className={`flex min-w-[240px] flex-1 snap-start flex-col rounded-2xl border bg-surface p-5 transition-[border-color] duration-150 hover:border-ink focus-within:border-ink ${yours ? 'border-ink' : 'border-line'}`}>
      <div className="flex items-center gap-2">
        <h3 className="truncate text-title font-medium text-stone-900">{plan.name}</h3>
        {/* the current plan is marked by its tag and an ink outline (as the live Plans page); it takes the tag's place */}
        {(yours ? (a.tag ?? 'Your plan') : (a.tag ?? plan.tag)) && <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-tint px-2 text-[12px] leading-4 font-medium text-stone-600">{yours ? (a.tag ?? 'Your plan') : (a.tag ?? plan.tag)}</span>}
      </div>
      {/* the big number: the plan's prompts; where billing is live, the workspace's price with a small muted "/mo"
          (the one place "/mo" is used). The number stays with its unit */}
      {priced
        ? <Pending as="p" n="decision 6" className="mt-2.5 whitespace-nowrap"><span className="text-kpi font-bold tabular-nums text-stone-900">{money(priceOf(plan.id))}</span> <span className="text-[13px] leading-[18px] text-stone-500">/mo</span></Pending>
        : <p className="mt-2.5 whitespace-nowrap"><span className="text-kpi font-bold tabular-nums text-stone-900">{plan.prompts}{plan.promptsPlus ? '+' : ''}</span> <span className="text-[13px] leading-[18px] text-stone-500">prompts</span></p>}
      <div aria-hidden className="mt-3 h-px bg-line" />
      <p className={`mt-3 line-clamp-2 min-h-[44px] text-[13px] leading-[18px] text-pretty tabular-nums ${yours ? 'font-medium text-stone-700' : 'text-stone-500'}`}>{note}</p>
      <div className="mt-3">
        {button}
        <p role="status" className="mt-1.5 min-h-[18px] text-[12px] leading-[18px] text-stone-500 text-pretty">
          {reqHelp ?? a.helper}{a.link && !a.off && b.canAct && <> <TextLink className="!text-[12px]" onClick={(e) => onAct('withdraw', plan, e.currentTarget)}>{a.link}</TextLink></>}
        </p>
      </div>
      <p className="mt-3 text-[13px] leading-[18px] text-stone-500">This includes:</p>
      <ul className="mt-3 flex flex-col gap-3">
        {rows.map(([bold, rest]) => (
          <li key={bold + rest} className="flex items-center gap-2.5 text-[14px] leading-5 text-stone-600"><Check size={14} className="shrink-0 text-stone-500" aria-hidden /><span><span className="font-medium text-stone-900 tabular-nums">{bold}</span>{rest}</span></li>
        ))}
        <li className="flex items-center gap-2.5 text-[14px] leading-5 text-stone-600">
          <Check size={14} className="shrink-0 text-stone-500" aria-hidden />
          <span><span className="font-medium text-stone-900">{plan.enginesLabel.split(' ')[0]}</span> {plan.enginesLabel.split(' ').slice(1).join(' ')}</span>
          <span className="flex items-center gap-1">{plan.engines.map((e) => <Mark key={e.label} item={e} />)}</span>
        </li>
        <li className="flex items-center gap-2.5 text-[14px] leading-5 font-medium text-stone-900"><Check size={14} className="shrink-0 text-stone-500" aria-hidden />{plan.call}</li>
      </ul>
    </article>
  )
}

// a compare cell's value
function Value({ v }) {
  if (v === true) return <Check size={16} className="text-stone-700" aria-label="Included" />
  if (v == null) return <span className="text-stone-400" aria-label="Not included">—</span>
  if (typeof v === 'string') return <span className="font-semibold text-stone-900">{v}</span>
  if (v.plain) return <span className="text-stone-700">{v.plain}</span>
  if (v.text) return <span><span className="font-semibold text-stone-900">{v.text}</span><span className="text-stone-600">{v.muted}</span></span>
  return (
    <ul className="flex flex-col gap-1.5 text-left">
      {v.list.map((it) => <li key={it.label} className="flex items-start gap-1.5 text-stone-700"><span className="mt-[2px]"><Mark item={it} /></span><span className="text-pretty">{it.label}</span></li>)}
      {v.more && <li className="pl-5 text-stone-500">{v.more}</li>}
    </ul>
  )
}

// the footer note, in full (owner, 2026-11-28: never cut off)
function FootNote() {
  return (
    <span className="flex items-start gap-1.5 text-[12px] leading-4 text-stone-500">
      <Info size={13} className="mt-px shrink-0" aria-hidden />
      <span className="text-pretty">{FOOT_NOTE}</span>
    </span>
  )
}

// what the page says once after an action (?msg=…), announced once
const MESSAGES = {
  resumed: (b) => <>Your plan is back on. It renews <B>{shortDate(b.renews)}</B>.</>,
  withdrawn: (b) => <>You’re staying on {b.plan.name}.</>,
  scheduled: (b) => <>{b.scheduled?.plan.name} starts <B>{shortDate(b.scheduled?.starts)}</B>.</>,
  cancelled: (b) => <>Your plan ends <B>{shortDate(b.paidThrough)}</B>. You can resume before then.</>,
  paid: () => <>Payment received. Thank you.</>,
  card: () => <>Your card was updated.</>,
}

export default function PlansPage() {
  const params = useParams() // re-draws when the address changes (states and actions live in the address)
  const b = billingState()
  const none = params.get('plan') === 'none' || (b.live && ['none', 'ended', 'demo-ended'].includes(b.status))
  const current = none ? null : PLANS.find((p) => p.id === PLAN.id)
  const viewAs = b.who === 'viewas'
  const u = promptUsage()
  const show = params.get('show')
  const tab = tabFor(b)
  const [group, setGroup] = useState(params.get('group') === 'self' ? 'self' : current?.group ?? 'dfy')
  const empty = show === 'empty'
  const shown = empty ? [] : PLANS.filter((p) => p.group === group)
  const counts = Object.fromEntries(GROUPS.map((g) => [g.id, PLANS.filter((p) => p.group === g.id).length]))
  // request / opening state per plan; ?request= previews it on the first plan with an action
  const preview = params.get('request')
  const [req, setReq] = useState({})
  const [confirm, setConfirm] = useState(null) // { kind: 'withdraw' | 'resume', anchor, plan }
  const firstAsk = shown.find((p) => cardAction(p, b, current).act === 'request')
  const stateOf = (p) => req[p.id] ?? (preview && p.id === firstAsk?.id ? preview : null)
  const onAct = (act, plan, anchor) => {
    if (act === 'request') {
      setReq((r) => ({ ...r, [plan.id]: 'sending' }))
      setTimeout(() => setReq((r) => ({ ...r, [plan.id]: preview === 'failed' ? 'failed' : 'sent' })), 900)
    } else if (act === 'review') setParams({ review: plan.id, rshow: null }, { push: true })
    else if (act === 'manage') { setParams({ tab: 'billing', msg: null }); requestAnimationFrame(() => document.getElementById('billing-first')?.focus()) }
    else if (act === 'change') setParams({ tab: 'billing', change: plan.id, msg: null })
    else if (act === 'withdraw' || act === 'resume') setConfirm({ kind: act, anchor, plan })
    else if (act === 'pay' || act === 'payinvoice') {
      // anything that leaves for the payment page waits for the server: "Opening…", then the page (same tab)
      setReq((r) => ({ ...r, [plan.id]: 'opening' }))
      setTimeout(() => navigate(`/plans/pay?kind=${act === 'pay' ? 'checkout' : 'invoice'}&plan=${plan.id}&back=${encodeURIComponent('/plans' + window.location.search)}`), 700)
    }
  }
  // the card row: whole, equal cards (at least 240px each); when they don't fit it scrolls with snap and edge fades
  const row = useRef(null)
  const [fade, setFade] = useState({ l: false, r: false })
  useEffect(() => {
    const el = row.current
    if (!el) return undefined
    const on = () => setFade({ l: el.scrollLeft > 8, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 8 })
    // a row that scrolls (phones): it opens on your plan's card, or the one with the page's black button
    const lead = el.querySelector('[data-lead]')
    if (lead && el.scrollWidth > el.clientWidth + 8) el.scrollLeft = Math.max(0, lead.offsetLeft - el.offsetLeft - 16)
    on()
    el.addEventListener('scroll', on, { passive: true })
    const ro = new ResizeObserver(on); ro.observe(el)
    return () => { el.removeEventListener('scroll', on); ro.disconnect() }
  }, [group, tab])
  const mask = fade.l || fade.r ? `linear-gradient(to right, ${fade.l ? 'transparent, #000 32px' : '#000, #000'}, ${fade.r ? '#000 calc(100% - 32px), transparent' : '#000'})` : undefined
  const cols = { gridTemplateColumns: `minmax(160px, 1.05fr) repeat(${Math.max(1, shown.length)}, minmax(0, 1fr))` }
  // the renewal terms show under the card row only when a pay action shows (Subscribe, Finish payment)
  const payShown = b.pricesShown && b.canPay && b.who === 'owner' && ['none', 'demo', 'pending', 'ended', 'demo-ended'].includes(b.status)
  const msg = MESSAGES[params.get('msg')]
  const testMode = b.live && b.seller === 'test' && b.admin
  const ended = b.status === 'ended'

  const header = (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">
          Plans
          {/* a workspace in test mode shows prices only to its own admins, each page marked with the pill */}
          {testMode && (
            <span tabIndex={0} className="group/tm relative inline-flex rounded-full tracking-normal outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <StatusPill>Test mode</StatusPill>
              <span role="tooltip" className="tip-dark pointer-events-none absolute left-0 top-full z-30 mt-2 w-max opacity-0 transition-opacity duration-150 group-hover/tm:opacity-100 group-focus-visible/tm:opacity-100">Test mode. No real payments are taken.</span>
            </span>
          )}
        </h1>
        {/* one grey line: the account's limits (and the client-view note on the same line) */}
        <p className="mt-1 text-[13px] leading-[18px] text-stone-500 tabular-nums text-pretty lg:text-[14px] lg:leading-5">
          {current
            ? <>You’re on <span className="font-semibold text-stone-900">{current.name}</span> · {current.prompts} prompts · {current.competitors} competitors · {current.logins} logins</>
            : <>Your limits: {u.limit} prompts · {PLAN.competitors} competitors{isSuperadmin() ? ' · No plan assigned' : ''}</>}
          {u.over > 0 && isSuperadmin() && <> · {u.real} of {u.limit} · {u.over} over plan</>}
          {viewAs && <> · Viewing as a client, so the plan can’t be changed here.</>}
        </p>
        {/* demo only: when it ends (the date is said here once, not on the cards) */}
        {b.status === 'demo' && <p className="mt-1 text-[13px] leading-[18px] text-stone-600 lg:text-[14px] lg:leading-5">Demo ends <DateTip iso={b.demoEnds} bold /></p>}
      </div>
      {!ended && b.status !== 'demo-ended' && <HeaderBell hairline={false} className="lg:pt-1" />}
    </div>
  )
  const billingTab = b.hasSub && tab === 'billing' // the Billing tab has its own loading and error states
  if (show === 'loading' && !billingTab) return <>{header}<div aria-busy="true" aria-label="Loading plans" className="flex flex-col gap-4"><Skeleton className="h-9 w-56" /><div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[420px] !rounded-2xl" />)}</div><Skeleton className="h-64 !rounded-2xl" /></div></>
  if (show === 'error' && !billingTab) return <>{header}<div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface px-5 py-6"><p className="text-[14px] leading-5 text-stone-700">The plans couldn’t be loaded. Reload the page to try again.</p><Btn look="line" onClick={() => setParams({ show: null })}>Reload</Btn></div></>

  const plansTab = (
    <>
      {/* a demo that ended where billing is live: it never had a subscription, so no tabs; this card sits above the cards */}
      {b.status === 'demo-ended' && b.live && (
        <section className="rounded-2xl border border-line bg-surface px-5 py-5">
          <h2 className="text-title font-semibold text-stone-900">Your demo has ended</h2>
          <p className="mt-1 text-[14px] leading-5 text-stone-600 text-pretty">Pick a plan to keep going. <Pending n="decision 12">Your dashboard is kept until <DateTip iso={b.keptUntil} bold />.</Pending></p>
        </section>
      )}
      {!ended && b.status !== 'demo-ended' && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-[13px] leading-[18px] text-stone-500">Trusted by</span>
          {TRUSTED.filter((t) => t.domain !== account.domain).map((t) => (
            <span key={t.domain} className="inline-flex items-center gap-2 text-[15px] leading-[22px] text-stone-700">
              <SiteLogo domain={t.domain} name={t.name} className={`h-5 w-5 rounded-[5px] ${t.darkTile ? 'logo-dark-tile' : ''}`} initialClass="text-[10px]" />{t.name}
            </span>
          ))}
        </div>
      )}
      {/* the seller can't take payments (restricted or disconnected): the page shows as "billing not live" */}
      {b.live && b.seller === 'paused' && <p className="text-[13px] leading-[18px] text-stone-500 text-pretty">Online payment isn’t available right now. Talk to us and we’ll set up your plan.</p>}
      {b.live && b.who === 'member' && !b.hasSub && <p className="text-[13px] leading-[18px] text-stone-500">Only the account owner can change the plan.</p>}

      {empty ? (
        <section className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-6 py-14 text-center">
          <h2 className="text-title font-semibold text-stone-900">No plans to show yet.</h2>
          <p className="text-[14px] leading-5 text-stone-600">Talk to us and we’ll set one up.</p>
          <Btn look="ink" className="mt-2">Talk to us</Btn>
        </section>
      ) : (
        <>
          <div className="mt-2"><GroupSwitch id="plans-top" value={group} onChange={setGroup} counts={counts} /></div>
          <div ref={row} className="no-scrollbar -mx-1 flex snap-x snap-mandatory scroll-px-1 items-stretch gap-3 overflow-x-auto px-1 py-1" style={{ maskImage: mask, WebkitMaskImage: mask }}>
            {shown.map((p) => <PlanCard key={p.id} plan={p} b={b} current={current} req={stateOf(p)} onAct={onAct} />)}
          </div>

          <section aria-labelledby="compare-title" className="mt-6">
            <h2 id="compare-title" className="text-title font-semibold text-stone-900">Compare plans</h2>
            {/* never scrolls sideways from 1024px; below that the table scrolls and the first column stays */}
            <div className="mt-4 max-lg:overflow-x-auto">
              <div className="max-lg:min-w-[760px]">
                <div className="sticky top-0 z-10 grid items-end gap-x-4 border-b border-line bg-page pb-3 pt-4 max-lg:top-14" style={cols}>
                  {/* owner, 2026-11-28: no second switch here (removed on live); the active group as a small muted label */}
                  <div className="text-[13px] leading-[18px] text-stone-500 max-lg:sticky max-lg:left-0 max-lg:bg-page">{GROUPS.find((g) => g.id === group).label}</div>
                  {/* owner, 2026-11-28: where billing is live the price sits under the name, before the prompts ("$3,500 /mo · 200 prompts") */}
                  {shown.map((p) => (
                    <div key={p.id} className="text-center">
                      <div className="text-[13px] leading-[18px] font-semibold text-stone-900">{p.name}</div>
                      <div className="text-[12px] leading-4 text-stone-500 tabular-nums">{b.pricesShown && b.canPay && priceOf(p.id) != null && <><span className="font-semibold text-stone-900">{money(priceOf(p.id))}</span> /mo · </>}{p.prompts}{p.promptsPlus ? '+' : ''} prompts</div>
                    </div>
                  ))}
                </div>
                {SECTIONS.map((s) => {
                  // rows no plan in this group has are hidden; a section with no rows left isn't drawn
                  const rows = s.rows.filter((r) => shown.some((p) => r.values[p.id] != null))
                  if (!rows.length) return null
                  return (
                    <div key={s.title} role="table" aria-label={s.title}>
                      <h3 className="border-b border-line pb-3 pt-7 text-[16px] leading-6 font-semibold text-stone-900">{s.title}</h3>
                      {rows.map((r) => (
                        <div key={r.label} role="row" className="grid items-start gap-x-4 border-b border-line py-3.5 text-[13px] leading-[18px]" style={cols}>
                          <div role="rowheader" className="max-lg:sticky max-lg:left-0 max-lg:bg-page">
                            <div className="font-semibold text-stone-900 text-pretty">{r.label}</div>
                            {r.sub && <div className="mt-0.5 text-[12px] leading-4 text-stone-500 text-pretty">{r.sub}</div>}
                          </div>
                          {shown.map((p) => <div key={p.id} role="cell" className="flex justify-center text-center tabular-nums"><Value v={r.values[p.id] ?? null} /></div>)}
                        </div>
                      ))}
                    </div>
                  )
                })}
                {/* the buttons again in the last row, the note at its left */}
                <div className="grid items-center gap-x-4 py-3" style={cols}>
                  <FootNote />
                  {shown.map((p) => {
                    const a = cardAction(p, b, current)
                    const r = stateOf(p)
                    return (
                      <div key={p.id}>
                        {a.legacy && r === 'sent' ? <Btn look="soft" full disabled className="!opacity-100">Request sent<Check size={14} aria-hidden /></Btn>
                          : a.legacy && r === 'sending' ? <Btn look="soft" full busy busyLabel="Sending…">{a.label}</Btn>
                            : <Btn look={a.look} full off={a.off ?? (a.legacy && viewAs && !a.dead ? 'Can’t change plans from this view' : null)} disabled={a.dead} busy={r === 'opening'} onClick={a.act ? (e) => onAct(a.act, p, e.currentTarget) : undefined}>{a.legacy && r === 'failed' ? 'Try again' : a.label}</Btn>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  )

  return (
    <>
      {header}
      {/* one page, two tabs: once the client has a subscription, "Plans" and "Billing" (manage subscription and
          invoices). No plan, a hand-set plan, a demo or a pending payment: no tabs, the page is the plan cards */}
      {b.hasSub && <Tabs id="plans" label="Plans" value={tab} onChange={(t) => setParams({ tab: t, msg: null, change: null })} tabs={[['plans', 'Plans'], ['billing', 'Billing']]} />}
      {msg && <p role="status" className="flex items-center gap-2 text-[13px] leading-[18px] text-stone-700"><Check size={14} className="shrink-0 text-stone-500" aria-hidden /><span>{msg(b)}</span></p>}
      {/* the tab's content moves with the step motion (200ms, 12px; a fade with reduced motion) */}
      <div key={tab} id="plans-panel" role={b.hasSub ? 'tabpanel' : undefined} aria-labelledby={b.hasSub ? `plans-tab-${tab}` : undefined} className={`flex flex-col gap-3 md:gap-4 ${b.hasSub ? 'modal-step' : ''}`}>
        {b.hasSub && tab === 'billing' ? <BillingTab b={b} /> : plansTab}
      </div>

      <ReviewModal b={b} />
      {confirm?.kind === 'withdraw' && (
        <ConfirmPopover anchor={confirm.anchor} title={`Stay on ${b.plan.name}?`} body={`The switch to ${confirm.plan.name} on ${shortDate(b.scheduled?.starts)} is withdrawn.`} confirmLabel="Withdraw change" cancelLabel="Keep it"
          onConfirm={() => { setConfirm(null); setParams({ sub: 'active', msg: 'withdrawn' }) }} onCancel={() => setConfirm(null)} />
      )}
      {confirm?.kind === 'resume' && (
        <ConfirmPopover anchor={confirm.anchor} title={`Resume ${b.plan.name}?`} body={`It renews ${shortDate(b.paidThrough)} at ${money(b.price)} per month.`} confirmLabel="Resume plan" cancelLabel="Not now"
          onConfirm={() => { setConfirm(null); setParams({ sub: 'active', msg: 'resumed' }) }} onCancel={() => setConfirm(null)} />
      )}
    </>
  )
}
