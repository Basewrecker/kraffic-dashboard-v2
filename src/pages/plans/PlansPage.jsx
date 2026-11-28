import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, File, Info, Loader2, Mail, Server } from 'lucide-react'
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
const q = () => new URLSearchParams(window.location.search)
const SUPPORT = 'support@auden.ai' // the workspace's support address (data in the app)

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

// The card's (and the compare footer's) button. Its slot also carries the request states: "Sending…" with a spinner;
// "Request sent ✓" with "We'll reach out within one business day."; "Try again" with "Couldn't send your request."
function PlanButton({ action, state, onClick, viewAs, compact = false }) {
  const current = action === 'Current plan'
  const base = `inline-flex ${compact ? 'h-9' : 'h-10'} w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-[14px] leading-5 font-medium outline-none transition-[background-color,border-color,transform] duration-150 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 active:scale-[.98] motion-reduce:transform-none`
  const ink = 'bg-ink text-on-ink hover:bg-ink-hover'
  const soft = 'border border-line bg-tint text-stone-900 hover:border-[var(--color-line-strong)]'
  if (current) return <button type="button" disabled className={`${base} ${ink} cursor-default opacity-60`}>Current plan</button>
  if (viewAs) {
    return (
      <span tabIndex={0} aria-label={`${action}. Can’t change plans from this view`} className="group/va relative block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus">
        <button type="button" disabled className={`${base} ${soft} cursor-not-allowed opacity-50`}>{action}</button>
        <span role="tooltip" className="tip-dark pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover/va:opacity-100 group-focus-visible/va:opacity-100">Can’t change plans from this view</span>
      </span>
    )
  }
  if (state === 'sending') return <button type="button" disabled className={`${base} ${soft} cursor-default`}><Loader2 size={14} className="animate-spin" aria-hidden />Sending…</button>
  if (state === 'sent') return <button type="button" disabled className={`${base} ${soft} cursor-default`}>Request sent<Check size={14} aria-hidden /></button>
  if (state === 'failed') return <button type="button" onClick={onClick} className={`${base} ${soft}`}>Try again</button>
  return <button type="button" onClick={onClick} className={`${base} ${action === 'Upgrade' ? ink : soft}`}>{action}</button>
}
const helperOf = (state) => (state === 'sent' ? 'We’ll reach out within one business day.' : state === 'failed' ? `Couldn’t send your request. Email us at ${SUPPORT}.` : null)

function PlanCard({ plan, current, state, onRequest, viewAs }) {
  const action = planAction(plan, current)
  const note = planNote(plan, current)
  const helper = helperOf(state)
  const yours = current && plan.id === current.id
  const rows = [
    plan.competitors == null ? ['Custom', ' competitors'] : [String(plan.competitors), ' competitors'],
    plan.logins == null ? ['Custom', ' logins'] : [String(plan.logins), ` login${plan.logins === 1 ? '' : 's'}`],
    [plan.refresh.split(' ')[0], ` ${plan.refresh.split(' ').slice(1).join(' ')}`],
  ]
  return (
    // border: light at rest, ink only on hover or focus; the "Most chosen" card is not raised
    <article aria-label={`${plan.name} plan`} className="flex min-w-[240px] flex-1 snap-start flex-col rounded-2xl border border-line bg-surface p-5 transition-[border-color] duration-150 hover:border-ink focus-within:border-ink">
      <div className="flex items-center gap-2">
        <h3 className="truncate text-title font-medium text-stone-900">{plan.name}</h3>
        {plan.tag && <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-tint px-2 text-[12px] leading-4 font-medium text-stone-600">{plan.tag}</span>}
      </div>
      {/* the plan's prompts as the big number; the number stays with its word */}
      <p className="mt-2.5 whitespace-nowrap"><span className="text-kpi font-bold tabular-nums text-stone-900">{plan.prompts}{plan.promptsPlus ? '+' : ''}</span> <span className="text-[13px] leading-[18px] text-stone-500">prompts</span></p>
      <div aria-hidden className="mt-3 h-px bg-line" />
      {/* how it differs from yours, or "Your plan": two lines at most, the space is always there */}
      <p className={`mt-3 line-clamp-2 min-h-[44px] text-[13px] leading-[18px] text-pretty tabular-nums ${yours ? 'font-medium text-stone-700' : 'text-stone-500'}`}>{note}</p>
      <div className="mt-3">
        <PlanButton action={action} state={state} onClick={onRequest} viewAs={viewAs} />
        <p role="status" className="mt-1.5 min-h-[18px] text-[12px] leading-[18px] text-stone-500 text-pretty">{helper}</p>
      </div>
      <p className="mt-3 text-[13px] leading-[18px] text-stone-500">This includes:</p>
      <ul className="mt-3 flex flex-col gap-3">
        {rows.map(([b, rest]) => (
          <li key={b + rest} className="flex items-center gap-2.5 text-[14px] leading-5 text-stone-600"><Check size={14} className="shrink-0 text-stone-500" aria-hidden /><span><span className="font-medium text-stone-900">{b}</span>{rest}</span></li>
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

// the footer note: 2 lines + "…", the whole sentence in the dark tip on hover and keyboard focus (150ms fade)
function FootNote() {
  return (
    <span tabIndex={0} className="group/fn relative flex items-start gap-1.5 rounded text-[12px] leading-4 text-stone-500 outline-none focus-visible:ring-2 focus-visible:ring-focus">
      <Info size={13} className="mt-px shrink-0" aria-hidden />
      <span className="line-clamp-2">{FOOT_NOTE}</span>
      <span role="tooltip" className="tip-dark pointer-events-none absolute bottom-full left-0 z-20 mb-2 font-normal opacity-0 transition-opacity duration-150 group-hover/fn:opacity-100 group-focus-visible/fn:opacity-100">{FOOT_NOTE}</span>
    </span>
  )
}

export default function PlansPage() {
  const params = q()
  const none = params.get('plan') === 'none'
  const current = none ? null : PLANS.find((p) => p.id === PLAN.id)
  const viewAs = params.has('userId')
  const u = promptUsage()
  const [group, setGroup] = useState(params.get('group') === 'self' ? 'self' : current?.group ?? 'dfy')
  const shown = PLANS.filter((p) => p.group === group)
  const counts = Object.fromEntries(GROUPS.map((g) => [g.id, PLANS.filter((p) => p.group === g.id).length]))
  // request state per plan; ?request= previews it on the first plan with an action
  const preview = params.get('request')
  const [req, setReq] = useState({})
  const firstAsk = shown.find((p) => planAction(p, current) !== 'Current plan')
  const stateOf = (p) => req[p.id] ?? (preview && p.id === firstAsk?.id ? preview : null)
  const send = (p) => {
    setReq((r) => ({ ...r, [p.id]: 'sending' }))
    setTimeout(() => setReq((r) => ({ ...r, [p.id]: preview === 'failed' ? 'failed' : 'sent' })), 900)
  }
  // the card row: whole, equal cards (at least 240px each); when they don't fit it scrolls with snap and edge fades
  const row = useRef(null)
  const [fade, setFade] = useState({ l: false, r: false })
  useEffect(() => {
    const el = row.current
    if (!el) return undefined
    const on = () => setFade({ l: el.scrollLeft > 8, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 8 })
    on()
    el.addEventListener('scroll', on, { passive: true })
    const ro = new ResizeObserver(on); ro.observe(el)
    return () => { el.removeEventListener('scroll', on); ro.disconnect() }
  }, [group])
  const mask = fade.l || fade.r ? `linear-gradient(to right, ${fade.l ? 'transparent, #000 32px' : '#000, #000'}, ${fade.r ? '#000 calc(100% - 32px), transparent' : '#000'})` : undefined
  const cols = { gridTemplateColumns: `minmax(160px, 1.05fr) repeat(${shown.length}, minmax(0, 1fr))` }

  return (
    <>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">Plans</h1>
          {/* one grey line: the account's limits (and the client-view note on the same line) */}
          <p className="mt-1 text-[13px] leading-[18px] text-stone-500 tabular-nums lg:text-[14px] lg:leading-5">
            {current
              ? <>You’re on <span className="font-semibold text-stone-900">{current.name}</span> · {current.prompts} prompts · {current.competitors} competitors · {current.logins} logins</>
              : <>Your limits: {u.limit} prompts · {PLAN.competitors} competitors{isSuperadmin() ? ' · No plan assigned' : ''}</>}
            {u.over > 0 && isSuperadmin() && <> · {u.real} of {u.limit} · {u.over} over plan</>}
            {viewAs && <> · Viewing as a client, so the plan can’t be changed here.</>}
          </p>
        </div>
        <HeaderBell hairline={false} className="lg:pt-1" />
      </div>

      {/* Trusted by: one compact row (20px tiles, 15px names); the brand being viewed is left out */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-[13px] leading-[18px] text-stone-500">Trusted by</span>
        {TRUSTED.filter((t) => t.domain !== account.domain).map((t) => (
          <span key={t.domain} className="inline-flex items-center gap-2 text-[15px] leading-[22px] text-stone-700">
            <SiteLogo domain={t.domain} name={t.name} className={`h-5 w-5 rounded-[5px] ${t.darkTile ? 'logo-dark-tile' : ''}`} initialClass="text-[10px]" />{t.name}
          </span>
        ))}
      </div>

      <div className="mt-2"><GroupSwitch id="plans-top" value={group} onChange={setGroup} counts={counts} /></div>

      <div ref={row} className="no-scrollbar -mx-1 flex snap-x snap-mandatory scroll-px-1 items-stretch gap-3 overflow-x-auto px-1 py-1" style={{ maskImage: mask, WebkitMaskImage: mask }}>
        {shown.map((p) => <PlanCard key={p.id} plan={p} current={current} state={stateOf(p)} onRequest={() => send(p)} viewAs={viewAs} />)}
      </div>

      <section aria-labelledby="compare-title" className="mt-6">
        <h2 id="compare-title" className="text-title font-semibold text-stone-900">Compare plans</h2>
        {/* never scrolls sideways from 1024px; below that the table scrolls and the first column stays */}
        <div className="mt-4 max-lg:overflow-x-auto">
          <div className="max-lg:min-w-[760px]">
            <div className="sticky top-0 z-10 grid items-end gap-x-4 border-b border-line bg-page pb-3 pt-4 max-lg:top-14" style={cols}>
              <div className="max-lg:sticky max-lg:left-0 max-lg:bg-page"><GroupSwitch id="plans-compare" value={group} onChange={setGroup} counts={counts} /></div>
              {shown.map((p) => (
                <div key={p.id} className="text-center">
                  <div className="text-[13px] leading-[18px] font-semibold text-stone-900">{p.name}</div>
                  <div className="text-[12px] leading-4 text-stone-500 tabular-nums">{p.prompts}{p.promptsPlus ? '+' : ''} prompts</div>
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
              {shown.map((p) => (
                <div key={p.id}>
                  <PlanButton action={planAction(p, current)} state={stateOf(p)} onClick={() => send(p)} viewAs={viewAs} compact />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
