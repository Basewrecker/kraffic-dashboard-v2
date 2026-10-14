import { Fragment, useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import Segmented from '../../components/dashboard/Segmented'
import BackLink from '../../components/BackLink'
import { useToast } from '../../components/dashboard/overlays'
import { openDrawer } from '../../components/audit/parts'
import { inkBtn, lineBtn, t2, t3 } from '../../components/tool/ToolPage'
import ConfirmDrawer from './ConfirmDrawer'
import { fitsPlan, isLive, money, planById, plansFor, priceOf, useBilling } from './billing'
import TalkDrawer from './TalkDrawer'

// /billing/plans — pick a plan. Every "Upgrade" link in the mock lands here. Plans, prices and limits are production's
// seeded plans (prisma/seed.ts); the confirm step is mocked (production has no self-serve plan change).
const n = (v) => (v === -1 ? 'Unlimited' : v.toLocaleString('en-US'))
const FREQ = { weekly: 'Weekly checks', daily: 'Daily checks', realtime: 'Real-time checks' }
// the rows every card shows, in this order
const CARD_ROWS = [
  ['prompts', (p) => `${n(p.limits.prompts)} prompts`],
  ['projects', (p) => `${n(p.limits.projects)} ${p.limits.projects === 1 ? 'brand' : 'brands'}`],
  ['competitors', (p) => `${n(p.limits.competitors)} competitors per brand`],
  ['frequency', (p) => FREQ[p.settings.monitoring_frequency]],
  ['users', (p) => `${n(p.limits.users)} team ${p.limits.users === 1 ? 'seat' : 'seats'}`],
  ['crawl', (p) => `${n(p.limits.crawl_pages_monthly)} pages crawled a month`],
]
// the full comparison, grouped
const yes = (k) => (p) => (p.features[k] ? true : null)
const lim = (k) => (p) => (p.limits[k] === 0 ? null : n(p.limits[k]))
const COMPARE = [
  ['Tracking', [['Tracked prompts', lim('prompts')], ['Brands', lim('projects')], ['Competitors per brand', lim('competitors')], ['Countries', lim('countries')], ['Languages', lim('languages')],
    ['How often prompts are checked', (p) => FREQ[p.settings.monitoring_frequency].replace(' checks', '')], ['History kept', (p) => `${p.settings.data_retention_days} days`]]],
  ['Optimize', [['Pages crawled a month', lim('crawl_pages_monthly')], ['AI answer checks a month', lim('ai_runs_monthly')], ['Prompt research runs a month', lim('research_runs_monthly')],
    ['Content drafts a month', lim('content_generations_monthly')], ['Citation intelligence', yes('citation_intelligence')], ['Content intelligence', yes('content_intelligence')],
    ['GEO Experiment Lab', yes('experiments')], ['AI crawler intelligence', yes('ai_crawler_intelligence')], ['CRM & revenue attribution', yes('crm_attribution')]]],
  ['Team', [['Team seats', lim('users')], ['Clients', (p) => (p.tier === 'AGENCY' || p.tier === 'ENTERPRISE' ? n(p.limits.clients) : null)], ['White label', yes('white_label')], ['API access', yes('api_access')], ['Single sign-on', yes('sso')]]],
  ['Support', [['Support', () => undefined]]], // GAP: production defines no support tiers
]

export default function PlansPage() {
  useEffect(() => { document.title = 'Choose a plan · Billing · Kraffic' }, [])
  const b = useBilling()
  const [toastNode, toast] = useToast({ position: 'center' })
  const [interval, setInterval] = useState(b.interval)
  const plans = plansFor(b)
  const cur = planById(b.planId)
  const fit = fitsPlan(b)
  const cols = { gridTemplateColumns: `repeat(${plans.length}, minmax(0, 1fr))` }
  const live = isLive()
  const ctaFor = (p) => {
    if (!live) return { label: 'Available soon', cls: lineBtn, disabled: true }
    if (p.id === b.planId && interval === b.interval) return { label: 'Current plan', cls: lineBtn, disabled: true }
    if (p.contactSales) return { label: 'Talk to us', cls: lineBtn }
    if (p.id === b.planId) return { label: `Switch to ${interval === 'year' ? 'yearly' : 'monthly'}`, cls: lineBtn }
    return priceOf(p, 'month') > priceOf(cur, 'month') ? { label: 'Upgrade', cls: inkBtn } : { label: 'Downgrade', cls: lineBtn }
  }
  return (
    <>
      <div>
        <BackLink to="/billing">Billing</BackLink>
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">Choose a plan</h1>
        <p className={`mt-1 text-[13px] leading-[18px] ${t2} lg:text-[14px] lg:leading-5`}>Change any time. We prorate the difference.</p>
        {!live && <p className={`mt-2 text-[13px] leading-[18px] ${t2}`}>Plans aren’t switched on yet. Your workspace has every feature for now.</p>}
      </div>
      <div className="flex items-center gap-3">
        <Segmented label="Billing period" value={interval} onChange={setInterval} options={[{ value: 'month', label: 'Monthly' }, { value: 'year', label: 'Yearly' }]} />
        <span className={`text-[13px] leading-[18px] ${t3}`}>2 months free</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ '--n': plans.length }}>
        {plans.map((p) => {
          const current = p.id === b.planId
          const cta = ctaFor(p)
          return (
            <Card key={p.id} className={`flex min-w-0 flex-col p-5 ${current ? 'border-[1.5px] !border-ink' : ''}`}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-[15px] leading-5 font-semibold text-stone-900">{p.name}</h2>
                {current && <span className={`text-[13px] leading-[18px] ${t3}`}>Current plan</span>}
              </div>
              <p className={`h-[18px] text-[13px] leading-[18px] ${t3}`}>{fit?.id === p.id ? 'Fits your usage' : ''}</p>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="text-[32px] leading-10 font-semibold tracking-[-0.02em] text-stone-900 tabular-nums">{money(priceOf(p, interval))}</span>
                <span className={`text-[14px] leading-5 ${t2}`}>/{interval === 'year' ? 'year' : 'month'}</span>
              </p>
              <p className={`mt-1 min-h-9 text-[13px] leading-[18px] ${t2}`}>{p.description}</p>
              <ul className="mt-4 flex flex-col gap-2 border-t border-[var(--div)] pt-4">
                {CARD_ROWS.map(([k, f]) => {
                  const text = f(p)
                  const none = text.startsWith('0 ')
                  return (
                    <li key={k} className={`flex items-center gap-2 text-[13px] leading-[18px] ${t2}`}>
                      {none ? <span className={`w-3.5 text-center ${t3}`}>—</span> : <Check size={14} className="shrink-0 text-ink" aria-hidden />}
                      <span className="min-w-0 truncate tabular-nums">{none ? '—' : text}</span>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-auto pt-5">
                <button type="button" disabled={cta.disabled} onClick={() => (p.contactSales ? openDrawer('talk', p.id) : openDrawer('switch', `${p.id}:${interval}`))} className={`${cta.cls} w-full disabled:cursor-default disabled:opacity-60`}>{cta.label}</button>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Compare everything: plan columns line up with the cards above (same column template) */}
      <Card className="overflow-hidden">
        <h2 className="px-5 pt-5 text-[15px] leading-5 font-semibold text-stone-900">Compare everything</h2>
        <div className="no-scrollbar mt-3 overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="grid h-10 grid-cols-[minmax(160px,220px)_minmax(0,1fr)] items-center border-y border-[var(--div)] bg-tint px-5 text-[13px] leading-[18px] font-medium text-stone-500">
              <span>Feature</span>
              <span className="grid" style={cols}>{plans.map((p) => <span key={p.id} className="text-center">{p.name}</span>)}</span>
            </div>
            {COMPARE.map(([group, rows]) => (
              <Fragment key={group}>
                <div className="px-5 pb-1 pt-4 text-[13px] leading-[18px] font-semibold text-stone-900">{group}</div>
                {rows.map(([label, f]) => (
                  <div key={label} className="grid min-h-10 grid-cols-[minmax(160px,220px)_minmax(0,1fr)] items-center border-b border-[var(--div)] px-5 text-[13px] leading-[18px] last:border-0">
                    <span className={t2}>{label}</span>
                    <span className="grid" style={cols}>
                      {plans.map((p) => {
                        const v = f(p)
                        return (
                          <span key={p.id} className="text-center tabular-nums">
                            {v === true ? <Check size={14} className="mx-auto text-ink" aria-label="Included" /> : v == null ? <span className={t3}>{v === undefined ? 'Not set yet' : '—'}</span> : <span className="text-stone-900">{v}</span>}
                          </span>
                        )
                      })}
                    </span>
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      </Card>
      <ConfirmDrawer />
      <TalkDrawer />
      {toastNode}
    </>
  )
}
