import { useEffect, useMemo, useRef } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DollarSign, Percent, RefreshCw, ShoppingBag, Wallet } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import PromptTable from '../../components/dashboard/PromptTable'
import SiteLogo from '../../components/ui/SiteLogo'
import Insight, { hl, useExplain } from '../../components/ui/Insight'
import { useToast } from '../../components/dashboard/overlays'
import { downloadCsv } from '../../components/dashboard/csv'
import { setParams, useParams } from '../../components/audit/parts'
import { openAnswer } from '../../components/answer/AnswerDrawer'
import ToolPage, { cardTitle, subtitleCls, t2, t3 } from '../../components/tool/ToolPage'
import KpiStrip from '../../components/tool/KpiStrip'
import { crmProviders, crmStates, skAiReferrals, skGa4Daily, trackedPrompts } from '../../data/mock'
import { fmtDay } from './sitekit'

// /more-tools/crm-attribution — sales that started with an AI answer. Production: crm-attribution module
// (CrmIntegrationConfig, AiConversionEvent); every number there is sample. ?mock=none|empty|running|error|full (default full).
const ENGINES = { chatgpt: ['ChatGPT', 'chatgpt.com'], perplexity: ['Perplexity', 'perplexity.ai'], gemini: ['Gemini', 'gemini.google.com'], copilot: ['Copilot', 'copilot.microsoft.com'], claude: ['Claude', 'claude.ai'] }
const DAYS = 30
const END = '2026-10-13'
const money = (v) => `$${Math.round(v).toLocaleString('en-US')}`
const nf = new Intl.NumberFormat('en-US')
const STATUS_WORD = { visible: 'Visible', missed: 'Missed', lost: 'Lost', pending: 'Checking' }
const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

function crmView(st) {
  const start = new Date(Date.parse(`${END}T00:00:00Z`) - (DAYS - 1) * 86400000).toISOString().slice(0, 10)
  const inWin = (d) => d >= start && d <= END
  const conv = st.conversions.filter((c) => inWin(c.occurredAt.slice(0, 10)))
  const ai = skAiReferrals.filter((r) => inWin(r.date)) // AI visits come from Site Kit's referral rows (GAP: CRM has none)
  const ga = skGa4Daily.filter((r) => inWin(r.date))
  const revenue = conv.reduce((n, c) => n + c.conversionValue, 0)
  const aiVisits = ai.reduce((n, r) => n + r.sessions, 0)
  const otherSessions = ga.reduce((n, r) => n + r.sessions, 0) - aiVisits
  const otherRate = otherSessions ? ga.reduce((n, r) => n + r.keyEvents, 0) / otherSessions : 0 // GAP: no non-AI baseline in CRM
  const days = Array.from({ length: DAYS }, (_, i) => new Date(Date.parse(`${start}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10))
  const series = days.map((d) => ({
    date: d,
    revenue: conv.filter((c) => c.occurredAt.startsWith(d)).reduce((n, c) => n + c.conversionValue, 0),
    visits: ai.filter((r) => r.date === d).reduce((n, r) => n + r.sessions, 0),
  }))
  const engines = Object.entries(ENGINES).map(([id, [name, domain]]) => ({
    id, name, domain, revenue: conv.filter((c) => c.referralEngine === id).reduce((n, c) => n + c.conversionValue, 0), orders: conv.filter((c) => c.referralEngine === id).length,
  })).filter((e) => e.orders).sort((x, y) => y.revenue - x.revenue)
  const byPrompt = new Map()
  for (const c of conv) { const p = byPrompt.get(c.promptKey) ?? { orders: 0, revenue: 0 }; p.orders += 1; p.revenue += c.conversionValue; byPrompt.set(c.promptKey, p) }
  const prompts = [...byPrompt].map(([key, v]) => {
    const tp = trackedPrompts.find((p) => p.id === key)
    return { id: key, prompt: tp?.prompt ?? key, status: tp?.status ?? 'pending', visits: Math.round(v.orders * 23 + (key.charCodeAt(1) % 9) * 4), ...v } // GAP: AI visits per prompt
  }).sort((x, y) => y.revenue - x.revenue)
  return { revenue, orders: conv.length, aiVisits, rate: aiVisits ? conv.length / aiVisits : 0, otherRate, aov: conv.length ? revenue / conv.length : 0, series, engines, prompts, conv }
}

export default function CrmPage() {
  useEffect(() => { document.title = 'CRM & Revenue Attribution · Toolkit · Kraffic' }, [])
  const q = useParams()
  const key = crmStates[q.get('mock')] ? q.get('mock') : 'full'
  const st = crmStates[key]
  const v = useMemo(() => crmView(st), [st])
  const [toastNode, toast] = useToast({ position: 'center' })
  const config = st.configs[0]
  const crm = crmProviders.find((p) => p.provider === config?.provider)
  const state = !config ? 'not-connected' : key === 'error' ? 'error' : key === 'running' ? 'running' : !st.conversions.length ? 'not-run' : 'ready'
  const sync = () => setParams({ mock: 'running' })
  const exportCsv = () => downloadCsv(`ai-conversions-${END}.csv`, v.conv, [
    { label: 'When', key: 'occurredAt' }, { label: 'AI assistant', csv: (c) => ENGINES[c.referralEngine][0] },
    { label: 'Landing page', key: 'landingPageUrl' }, { label: 'Value', key: 'conversionValue' }, { label: 'Currency', key: 'currency' },
  ])
  const connect = {
    title: 'Connect your CRM',
    sub: 'We read deals and orders, and match them to visits that came from an AI assistant.',
    rows: crmProviders.map((p) => ({ id: p.provider, name: p.name, domain: p.domain, status: 'none', onConnect: () => { setParams({ mock: 'empty' }); toast(`${p.name} connected`) } })),
    seeing: ['Revenue from people who arrived from ChatGPT, Perplexity and other assistants', 'Which assistant brings the most valuable visitors', 'The prompts behind those sales'],
  }
  return (
    <>
      <ToolPage title="CRM & Revenue Attribution" subtitle={config ? `Sales from AI assistant visits · ${crm.name} · last ${DAYS} days` : 'Sales in your CRM linked to the AI answers that started them'}
        primary={{ label: 'Sync now', icon: RefreshCw, onClick: sync }}
        menu={config ? [{ label: 'Export CSV', onClick: exportCsv }, { label: `Disconnect ${crm.name}`, onClick: () => setParams({ mock: 'none' }) }] : []}
        state={state} connect={connect}
        empty={{ icon: Wallet, title: `${crm?.name ?? 'Your CRM'} is connected`, body: 'Nothing has synced yet. The first sync reads the last 90 days of deals and takes a few minutes.', action: { label: 'Sync now', icon: RefreshCw, onClick: sync } }}
        running={{ label: `Syncing ${crm?.name ?? ''}…`, since: st.syncing?.startedAt ?? new Date().toISOString() }}
        error={{ title: `${crm?.name ?? 'The CRM'} sync failed`, reason: st.error, onRetry: sync }}>
        <KpiStrip items={[
          { label: 'Revenue from AI visits', icon: DollarSign, value: money(v.revenue), meta: `Last ${DAYS} days`, link: 'View over time', onOpen: () => scrollTo('crm-time') },
          { label: 'Orders from AI visits', icon: ShoppingBag, value: nf.format(v.orders), meta: `from ${nf.format(v.aiVisits)} AI visits`, link: 'View by assistant', onOpen: () => scrollTo('crm-engines') },
          { label: 'Conversion rate', icon: Percent, value: `${(v.rate * 100).toFixed(1)}%`, meta: <>vs <span className="text-stone-900">{(v.otherRate * 100).toFixed(1)}%</span> for other visits</>, link: 'View prompts', onOpen: () => scrollTo('crm-prompts') },
          { label: 'Avg order value', icon: Wallet, value: money(v.aov), meta: 'per AI order', link: 'View by assistant', onOpen: () => scrollTo('crm-engines') },
        ]} />
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
          <Engines v={v} />
          <div id="crm-time" className="min-w-0 scroll-mt-6 lg:col-span-2"><RevenueChart series={v.series} /></div>
        </div>
        <div id="crm-prompts" className="scroll-mt-6"><Prompts rows={v.prompts} /></div>
      </ToolPage>
      {toastNode}
    </>
  )
}

function Engines({ v }) {
  const explain = useExplain('crm-engines')
  const max = v.engines[0]?.revenue || 1
  const top = v.engines[0]
  return (
    <Card id="crm-engines" ref={explain.cardRef} className="flex h-full min-w-0 scroll-mt-6 flex-col px-5 pt-5 pb-3">
      <h2 className={cardTitle}>Revenue by AI assistant</h2>
      <p className={subtitleCls}>Which assistant sends the buyers?</p>
      <ul className="mt-3">
        {v.engines.map((e) => (
          <li key={e.id} {...hl(explain, e === top ? 'top' : e.id, { row: true })} className="grid h-10 grid-cols-[20px_minmax(0,1fr)_64px_minmax(48px,120px)] items-center gap-3">
            <SiteLogo domain={e.domain} name={e.name} className="h-5 w-5 rounded !border-0" imgPad="p-0" initialClass="text-[10px]" />
            <span className="truncate text-[14px] leading-5 text-stone-900">{e.name}</span>
            <span className="text-right text-[14px] leading-5 text-stone-900 tabular-nums">{money(e.revenue)}</span>
            <span className="block h-1.5 overflow-hidden rounded-full bg-tint" aria-hidden><span className="block h-full min-w-[6px] rounded-full bg-ink" style={{ width: `${(e.revenue / max) * 100}%` }} /></span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-4">
        <Insight explain={explain} text={`${top.name} brings ${Math.round((top.revenue / v.revenue) * 100)}% of AI revenue.`} evidence={{ keys: ['top'], calc: `Revenue from orders whose visit came from each assistant, last ${DAYS} days. Highlighted: the largest.` }} />
      </div>
    </Card>
  )
}

function RevenueChart({ series }) {
  const ticks = series.filter((_, i) => i % 5 === 0).map((p) => p.date)
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={cardTitle}>Revenue over time</h2>
          <p className={subtitleCls}>Does more AI traffic mean more sales?</p>
        </div>
        <ul className={`flex items-center gap-4 text-[13px] leading-[18px] ${t2}`} aria-hidden>
          <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-ink" />Revenue</li>
          <li className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-[var(--data-c2)]" />AI visits</li>
        </ul>
      </div>
      <div className="mt-4 min-h-[220px] flex-1" role="img" aria-label="Daily revenue from AI visits and daily AI visits">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke="var(--div)" />
            <XAxis dataKey="date" ticks={ticks} tickFormatter={fmtDay} tickLine={false} axisLine={{ stroke: 'var(--color-line)' }} tick={{ fontSize: 12, fill: 'var(--color-stone-500)' }} />
            <YAxis yAxisId="r" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--color-stone-500)' }} width={48} tickFormatter={(x) => `$${x}`} />
            <YAxis yAxisId="v" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--color-stone-500)' }} width={32} allowDecimals={false} />
            <Tooltip cursor={{ stroke: 'var(--color-line-strong)' }} content={({ active, payload }) => (active && payload?.length ? (
              <div className="rounded-md border border-line bg-raised px-2.5 py-2 text-[12px] leading-4 shadow-md tabular-nums">
                <div className="font-semibold text-stone-900">{fmtDay(payload[0].payload.date)}</div>
                <div className="mt-1 flex justify-between gap-6"><span className={t2}>Revenue</span><span className="text-stone-900">{money(payload[0].payload.revenue)}</span></div>
                <div className="mt-0.5 flex justify-between gap-6"><span className={t2}>AI visits</span><span className="text-stone-900">{payload[0].payload.visits}</span></div>
              </div>
            ) : null)} />
            <Line yAxisId="v" dataKey="visits" stroke="var(--data-c2)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            <Line yAxisId="r" dataKey="revenue" stroke="var(--ink)" strokeWidth={2} dot={false} activeDot={{ r: 3.5, fill: 'var(--ink)', stroke: 'var(--color-surface)', strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function Prompts({ rows }) {
  const list = useRef(rows.map((r) => r.id))
  list.current = rows.map((r) => r.id)
  const columns = [
    { key: 'prompt', label: 'Prompt', mobile: 'primary', sort: { value: (r) => r.prompt, first: 'asc' }, csv: (r) => r.prompt, mobileText: (r) => r.prompt,
      cell: (r) => <span className="block truncate text-[14px] leading-5 text-stone-900" title={r.prompt}>{r.prompt}</span> },
    { key: 'status', label: 'Visibility', width: 120, sort: { value: (r) => r.status, first: 'asc' }, csv: (r) => STATUS_WORD[r.status],
      cell: (r) => <span className={`text-[13px] leading-[18px] ${r.status === 'lost' ? 'text-negative' : r.status === 'visible' ? 'text-stone-900' : t3}`}>{STATUS_WORD[r.status]}</span> },
    { key: 'visits', label: 'AI visits', width: 104, align: 'right', sort: { value: (r) => r.visits, first: 'desc' }, csv: (r) => r.visits, mobileText: (r) => `${r.visits} visits`, cell: (r) => <span className="text-[14px] tabular-nums text-stone-900">{nf.format(r.visits)}</span> },
    { key: 'orders', label: 'Orders', width: 92, align: 'right', sort: { value: (r) => r.orders, first: 'desc' }, csv: (r) => r.orders, mobileText: (r) => `${r.orders} orders`, cell: (r) => <span className="text-[14px] tabular-nums text-stone-900">{r.orders}</span> },
    { key: 'revenue', label: 'Revenue', width: 112, align: 'right', sort: { value: (r) => r.revenue, first: 'desc' }, csv: (r) => r.revenue, mobileText: (r) => money(r.revenue), cell: (r) => <span className="text-[14px] font-semibold tabular-nums text-stone-900">{money(r.revenue)}</span> },
  ]
  return (
    <PromptTable id="crm-prompts-table" title="Prompts that drive revenue" subtitle="The questions people asked an AI before they bought. Click one to see the answer." count={rows.length}
      rows={rows} columns={columns} filterKeys={['prompt']} csvName={`ai-revenue-by-prompt-${END}.csv`} defaultSort={{ key: 'revenue', dir: 'desc' }}
      rowHover="hover:bg-tint" onRowClick={(r, el) => openAnswer({ key: r.id, list: list.current, opener: el })} />
  )
}
