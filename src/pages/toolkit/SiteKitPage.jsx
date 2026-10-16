import { useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, RefreshCw } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import Select from '../../components/ui/Select'
import SiteLogo from '../../components/ui/SiteLogo'
import Insight, { hl, useExplain } from '../../components/ui/Insight'
import { useToast } from '../../components/dashboard/overlays'
import { setParams, useParams } from '../../components/audit/parts'
import { useIsMobile } from '../../hooks/useMedia'
import ToolPage from '../../components/tool/ToolPage'
import KpiStrip from '../../components/tool/KpiStrip'
import { account, guessCategory, promptActions, siteKit, trackedPrompts } from '../../data/mock'
import { RANGES, analytics, fmtDay, integrationsFor, searchConsole, windowOf } from './sitekit'

// /more-tools/site-kit — Search Console + Analytics for the project's site.
// Not connected / expired: only the connection card. Connected: tabs per connected source (?tab=sc|ga).
// ?mock=none|gsc|expired|connected|empty picks the connection state (Connect / Reconnect move between them).
// siteKit.canConnect false: no Connect / Reconnect buttons · siteKit.canShowData false: the connection card only.
const t2 = 'text-stone-600'
const t3 = 'text-stone-500'
const cardTitle = 'text-[15px] leading-5 font-semibold text-stone-900'
const subtitle = `mt-0.5 text-[13px] leading-[18px] ${t2}`
const lineBtn = 'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-small font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
const SOURCES = {
  GOOGLE_SEARCH_CONSOLE: { name: 'Search Console', domain: 'search.google.com', tab: 'sc' },
  GOOGLE_ANALYTICS_4: { name: 'Google Analytics', tabName: 'Analytics', domain: 'analytics.google.com', tab: 'ga' },
}
// what Connect / Reconnect leads to in the mock
const NEXT = { none: { GOOGLE_SEARCH_CONSOLE: 'gsc' }, expired: { GOOGLE_SEARCH_CONSOLE: 'gsc' }, gsc: { GOOGLE_ANALYTICS_4: 'connected' } }

export default function SiteKitPage() {
  useEffect(() => { document.title = 'Site Kit · Toolkit · Kraffic' }, [])
  const q = useParams()
  const state = q.get('mock') ?? 'none'
  const conns = integrationsFor(state)
  const connected = siteKit.canShowData ? conns.filter((c) => c.status === 'CONNECTED') : []
  const tabs = connected.map((c) => SOURCES[c.provider])
  const tab = tabs.find((t) => t.tab === q.get('tab'))?.tab ?? tabs[0]?.tab
  const [range, setRange] = useState('28')
  const [custom, setCustom] = useState({ start: '2026-09-01', end: '2026-09-30' })
  const w = useMemo(() => windowOf(range, custom), [range, custom])
  const [refreshing, setRefreshing] = useState(false)
  const [toastNode, toast] = useToast({ position: 'center' })
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const refresh = () => { setRefreshing(true); timer.current = setTimeout(() => { setRefreshing(false); toast('Data refreshed') }, 1200) }
  const connect = (c) => {
    const next = NEXT[state]?.[c.provider]
    if (next) setParams({ mock: next, tab: SOURCES[c.provider].tab })
    toast(`${SOURCES[c.provider].name} ${c.status === 'EXPIRED' ? 'reconnected' : 'connected'}`)
  }
  const all = connected.length === conns.length

  const controls = connected.length > 0 && (
    <>
      {/* property Select: only with more than one property (production allows one per provider, so never here) */}
      <Select label="Date range" size="md" className="w-[148px]" value={range} onChange={setRange} options={RANGES} />
      {range === 'custom' && (
        <span className="flex items-center gap-1.5">
          <label><span className="sr-only">From</span><input type="date" value={custom.start} max={custom.end} onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))} className="h-9 rounded-md border border-line bg-raised px-2 text-[13px] text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus" /></label>
          <span className={t3}>–</span>
          <label><span className="sr-only">To</span><input type="date" value={custom.end} min={custom.start} max="2026-10-13" onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))} className="h-9 rounded-md border border-line bg-raised px-2 text-[13px] text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus" /></label>
        </span>
      )}
      <button type="button" onClick={refresh} disabled={refreshing} aria-label="Refresh data" title="Refresh data"
        className="grid h-9 w-9 place-items-center rounded-lg border border-line text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60">
        <RefreshCw size={16} className={refreshing ? 'animate-[spin_600ms_linear_infinite] motion-reduce:animate-none' : undefined} aria-hidden />
      </button>
    </>
  )
  const connectProps = {
    title: 'Connect your Google data',
    sub: 'Read-only access. We never change anything in your Google accounts.',
    rows: conns.map((c) => ({
      id: c.provider, name: SOURCES[c.provider].name, domain: SOURCES[c.provider].domain, account: c.accountName,
      status: c.status === 'CONNECTED' ? 'connected' : c.status === 'EXPIRED' ? 'expired' : 'none', onConnect: siteKit.canConnect ? () => connect(c) : null,
    })),
    seeing: ['Clicks and impressions from Google Search, by query and page', 'Visits that come from AI assistants like ChatGPT and Perplexity', 'Search queries worth tracking as prompts'],
  }

  return (
    <>
      <ToolPage title="Site Kit" subtitle={`Search Console and Analytics for ${account.domain}`} controls={controls}
        state={connected.length ? 'ready' : 'not-connected'} connect={connectProps} partial={!all}>
        <div role="tablist" aria-label="Site Kit" className="no-scrollbar -mx-4 mt-2 flex gap-6 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
          {tabs.map((t) => (
            <button key={t.tab} type="button" role="tab" aria-selected={tab === t.tab} onClick={() => setParams({ tab: t.tab })}
              className={`-mb-px inline-flex h-11 shrink-0 items-center whitespace-nowrap border-b-2 text-[14px] leading-5 font-medium outline-none md:h-10 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${tab === t.tab ? 'border-ink text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900'}`}>
              {t.tabName ?? t.name}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="flex flex-col gap-4">
          {tab === 'sc' ? <SearchConsoleTab w={w} empty={state === 'empty'} onRange={setRange} toast={toast} /> : <AnalyticsTab w={w} empty={state === 'empty'} onRange={setRange} />}
        </div>
      </ToolPage>
      {toastNode}
    </>
  )
}

// ---- KPI strip with deltas vs the previous period (red only when it got worse)
const nf = new Intl.NumberFormat('en-US')
function fmtValue(k) { return k.fmt === 'pct' ? `${k.value.toFixed(1)}%` : k.fmt === 'pos' ? k.value.toFixed(1) : nf.format(k.value) }
function Delta({ k, len }) {
  if (k.change == null) return <span className={t3}>No earlier data</span>
  const v = k.change
  if (Math.abs(v) < (k.points ? 0.05 : 0.005)) return <span className={t3}>No change vs previous {len} days</span>
  const better = k.lowerIsBetter ? v < 0 : v > 0
  const text = k.points ? `${Math.abs(v).toFixed(1)}${k.fmt === 'pct' ? ' pts' : ''}` : `${Math.round(Math.abs(v) * 100)}%`
  return (
    <span className={t2}>
      <span className={better ? 'text-ink' : 'text-negative'}>{v > 0 ? '▲' : '▼'} {text}</span> vs previous {len} days
    </span>
  )
}
function Kpis({ kpis, len }) {
  return <KpiStrip items={kpis.map((k) => ({ label: k.label, value: fmtValue(k), meta: <Delta k={k} len={len} /> }))} />
}

function EmptyRange({ onRange, what }) {
  return (
    <Card className="flex flex-col items-center px-5 py-12 text-center">
      <BarChart3 size={20} className={t3} aria-hidden />
      <p className="mt-3 text-[15px] leading-[22px] text-stone-900">No data for this range</p>
      <p className={`mt-1 max-w-[420px] text-[13px] leading-[18px] ${t2}`}>{what} can take 2–3 days to show up. Try a longer range.</p>
      <button type="button" onClick={() => onRange('90')} className={`${lineBtn} mt-4`}>Show last 90 days</button>
    </Card>
  )
}

// ---- Search Console
function SearchConsoleTab({ w, empty, onRange, toast }) {
  const d = useMemo(() => searchConsole(w, empty), [w, empty])
  if (!d) return <EmptyRange onRange={onRange} what="Search Console data" />
  return (
    <>
      <Kpis kpis={d.kpis} len={w.len} />
      <ClicksChart series={d.series} />
      <Queries rows={d.queries} toast={toast} />
      <TopPages rows={d.pages} />
    </>
  )
}

function ClicksChart({ series }) {
  const single = series.length === 1
  const ticks = series.filter((_, i) => i % Math.max(1, Math.ceil(series.length / 7)) === 0).map((p) => p.date)
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={cardTitle}>Clicks over time</h2>
          <p className={subtitle}>How many searches led to a visit, and how often you showed up</p>
        </div>
        <ul className={`flex items-center gap-4 text-[13px] leading-[18px] ${t2}`} aria-hidden>
          <li className="flex items-center gap-1.5"><span className={single ? 'h-2 w-2 rounded-full bg-ink' : 'h-0.5 w-4 rounded bg-ink'} />Clicks</li>
          <li className="flex items-center gap-1.5"><span className={single ? 'h-2 w-2 rounded-full bg-[var(--data-c2)]' : 'w-4 border-t-2 border-dashed border-[var(--data-c2)]'} />Impressions</li>
        </ul>
      </div>
      <div className="mt-4 h-[240px]" role="img" aria-label={single ? `Clicks and impressions on ${fmtDay(series[0].date)}: ${series[0].clicks} clicks, ${series[0].impressions} impressions` : `Daily clicks and impressions, ${fmtDay(series[0].date)} to ${fmtDay(series.at(-1).date)}`}>
        <ResponsiveContainer width="100%" height="100%">
          {single ? (
            // one day of data: nothing to draw a line between, so the day's two numbers as bars
            <BarChart data={series} barCategoryGap="30%" barGap={8} margin={{ top: 24, right: 4, bottom: 0, left: -12 }}>
              <CartesianGrid vertical={false} stroke="var(--div)" />
              <XAxis dataKey="date" tickFormatter={fmtDay} tickLine={false} axisLine={{ stroke: 'var(--color-line)' }} tick={{ fontSize: 12, fill: 'var(--color-stone-500)' }} />
              <YAxis yAxisId="c" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--color-stone-500)' }} width={44} allowDecimals={false} />
              <YAxis yAxisId="i" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--color-stone-500)' }} width={48} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)} />
              <Bar yAxisId="c" dataKey="clicks" fill="var(--ink)" radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                <LabelList dataKey="clicks" position="top" formatter={(v) => nf.format(v)} style={{ fontSize: 12, fontWeight: 500, fill: 'var(--color-stone-700)' }} />
              </Bar>
              <Bar yAxisId="i" dataKey="impressions" fill="var(--data-c2)" radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                <LabelList dataKey="impressions" position="top" formatter={(v) => nf.format(v)} style={{ fontSize: 12, fontWeight: 500, fill: 'var(--color-stone-700)' }} />
              </Bar>
            </BarChart>
          ) : (
          <LineChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--div)" />
            <XAxis dataKey="date" ticks={ticks} tickFormatter={fmtDay} tickLine={false} axisLine={{ stroke: 'var(--color-line)' }} tick={{ fontSize: 12, fill: 'var(--color-stone-500)' }} interval="preserveStartEnd" />
            <YAxis yAxisId="c" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--color-stone-500)' }} width={44} allowDecimals={false} />
            <YAxis yAxisId="i" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--color-stone-500)' }} width={48} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)} />
            <Tooltip cursor={{ stroke: 'var(--color-line-strong)' }} content={({ active, payload }) => (active && payload?.length ? (
              <div className="rounded-md border border-line bg-raised px-2.5 py-2 text-[12px] leading-4 shadow-md tabular-nums">
                <div className="font-semibold text-stone-900">{fmtDay(payload[0].payload.date)}</div>
                <div className="mt-1 flex justify-between gap-6"><span className={t2}>Clicks</span><span className="text-stone-900">{nf.format(payload[0].payload.clicks)}</span></div>
                <div className="mt-0.5 flex justify-between gap-6"><span className={t2}>Impressions</span><span className="text-stone-900">{nf.format(payload[0].payload.impressions)}</span></div>
              </div>
            ) : null)} />
            <Line yAxisId="i" dataKey="impressions" stroke="var(--data-c2)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            <Line yAxisId="c" dataKey="clicks" stroke="var(--ink)" strokeWidth={2} dot={false} activeDot={{ r: 3.5, fill: 'var(--ink)', stroke: 'var(--color-surface)', strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      {single && <p className="mt-1 text-[12px] leading-4 text-stone-500">Showing your first day of data. Trend lines appear after the next day.</p>}
    </Card>
  )
}

// a compact table: single-line rows; phones get two-line rows (first column on top, the rest as meta)
function Table({ columns, rows, rowKey }) {
  const mobile = useIsMobile()
  if (mobile) {
    return (
      <ul className="divide-y divide-[var(--div)] border-t border-[var(--div)]">
        {rows.map((r) => (
          <li key={rowKey(r)} className="flex items-center gap-3 px-4 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] leading-5 text-stone-900">{columns[0].cell(r)}</span>
              <span className={`mt-0.5 block truncate text-[13px] leading-[18px] ${t3} tabular-nums`}>{columns.slice(1).filter((c) => c.meta).map((c) => c.meta(r)).join(' · ')}</span>
            </span>
            {columns.find((c) => c.action)?.cell(r)}
          </li>
        ))}
      </ul>
    )
  }
  const pad = (i) => (i === 0 ? 'pl-5 pr-3' : i === columns.length - 1 ? 'pl-3 pr-5' : 'px-3')
  return (
    <table className="w-full table-fixed">
      <thead>
        <tr className="h-9 border-y border-[var(--div)] bg-tint text-[13px] leading-5 font-medium text-stone-500">
          {columns.map((c, i) => <th key={c.key} style={{ width: c.width }} className={`${pad(i)} font-medium ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={rowKey(r)} className="h-11 border-b border-[var(--div)] transition-colors duration-150 last:border-0 hover:bg-tint">
            {columns.map((c, i) => <td key={c.key} className={`${pad(i)} truncate text-[14px] leading-5 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${c.muted ? t2 : 'text-stone-900'}`}>{c.cell(r)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Queries({ rows, toast }) {
  const [added, setAdded] = useState(() => new Set())
  const isTracked = (q) => added.has(q) || trackedPrompts.some((p) => p.prompt.toLowerCase() === q.toLowerCase())
  const track = async (q) => {
    setAdded((s) => new Set(s).add(q))
    await promptActions.onAddPrompt({ text: q, category: guessCategory(q) })
    toast('Added to Prompt Hub')
  }
  const columns = [
    { key: 'q', label: 'Query', cell: (r) => <span title={r.key}>{r.key}</span> },
    { key: 'clicks', label: 'Clicks', width: 96, align: 'right', cell: (r) => nf.format(r.clicks), meta: (r) => `${nf.format(r.clicks)} clicks` },
    { key: 'impr', label: 'Impressions', width: 120, align: 'right', muted: true, cell: (r) => nf.format(r.impressions), meta: (r) => `${nf.format(r.impressions)} impr.` },
    { key: 'ctr', label: 'CTR', width: 80, align: 'right', muted: true, cell: (r) => `${r.ctr.toFixed(1)}%`, meta: (r) => `${r.ctr.toFixed(1)}% CTR` },
    { key: 'pos', label: 'Position', width: 96, align: 'right', muted: true, cell: (r) => r.position.toFixed(1), meta: (r) => `pos. ${r.position.toFixed(1)}` },
    {
      key: 'prompt', label: 'Prompt', width: 116, action: true,
      cell: (r) => (isTracked(r.key)
        ? <span className={`text-[13px] ${t3}`}>Tracked</span>
        : <button type="button" onClick={() => track(r.key)} className="rounded text-[13px] font-medium text-stone-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Track</button>),
    },
  ]
  return (
    <Card className="overflow-hidden">
      <div className="px-5 pb-3 pt-5 max-md:px-4">
        <h2 className={cardTitle}>Top queries</h2>
        <p className={subtitle}>What people searched before they visited. Track one to see if AI answers mention you for it too.</p>
      </div>
      <Table columns={columns} rows={rows} rowKey={(r) => r.key} />
    </Card>
  )
}

function TopPages({ rows }) {
  const columns = [
    { key: 'page', label: 'Page', cell: (r) => <span title={r.path}>{r.path}</span> },
    { key: 'clicks', label: 'Clicks', width: 96, align: 'right', cell: (r) => nf.format(r.clicks), meta: (r) => `${nf.format(r.clicks)} clicks` },
    { key: 'impr', label: 'Impressions', width: 120, align: 'right', muted: true, cell: (r) => nf.format(r.impressions), meta: (r) => `${nf.format(r.impressions)} impr.` },
    { key: 'pos', label: 'Position', width: 96, align: 'right', muted: true, cell: (r) => r.position.toFixed(1), meta: (r) => `pos. ${r.position.toFixed(1)}` },
  ]
  return (
    <Card className="overflow-hidden">
      <div className="px-5 pb-3 pt-5 max-md:px-4">
        <h2 className={cardTitle}>Top pages</h2>
        <p className={subtitle}>Which pages Google sends people to</p>
      </div>
      <Table columns={columns} rows={rows} rowKey={(r) => r.key} />
    </Card>
  )
}

// ---- Analytics
function AnalyticsTab({ w, empty, onRange }) {
  const d = useMemo(() => analytics(w, empty), [w, empty])
  if (!d) return <EmptyRange onRange={onRange} what="Analytics data" />
  return (
    <>
      <Kpis kpis={d.kpis} len={w.len} />
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <AiVisits d={d} />
        <AiLanding rows={d.pages} />
      </div>
    </>
  )
}

function AiVisits({ d }) {
  const explain = useExplain('ai')
  const max = d.engines[0]?.sessions || 1
  const top = d.engines[0]
  const share = Math.round((top.sessions / d.aiTotal) * 100)
  const allPct = Math.round(d.aiShare * 1000) / 10
  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5 pb-3">
      <h2 className={cardTitle}>Visits from AI assistants</h2>
      <p className={subtitle}>Which assistants send people to your site?</p>
      <ul className="mt-3">
        {d.engines.map((e) => (
          <li key={e.domain} {...hl(explain, e === top ? 'top' : e.domain, { row: true })} className="grid h-10 grid-cols-[20px_minmax(0,1fr)_56px_120px] items-center gap-3 max-sm:grid-cols-[20px_minmax(0,1fr)_48px_72px]">
            <SiteLogo domain={e.domain} name={e.engine} className="h-5 w-5 rounded !border-0" imgPad="p-0" initialClass="text-[10px]" />
            <span className="min-w-0 truncate text-[14px] leading-5 text-stone-900">{e.engine} <span className={t3}>{e.domain}</span></span>
            <span className="text-right text-[14px] leading-5 text-stone-900 tabular-nums">{nf.format(e.sessions)}</span>
            <span className="block h-1.5 overflow-hidden rounded-full bg-tint" aria-hidden><span className="block h-full min-w-[6px] rounded-full bg-ink" style={{ width: `${(e.sessions / max) * 100}%` }} /></span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-4">
        <Insight explain={explain} text={`${top.engine} sends ${share}% of AI visits; AI is ${allPct}% of all sessions.`} evidence={{
          keys: ['top'], calc: `Sessions whose referrer is an AI assistant, grouped by assistant. Highlighted: the largest.`,
        }} />
      </div>
    </Card>
  )
}

function AiLanding({ rows }) {
  const columns = [
    { key: 'page', label: 'Page', cell: (r) => <span title={r.path}>{r.path}</span> },
    { key: 'sessions', label: 'Sessions', width: 96, align: 'right', cell: (r) => nf.format(r.sessions), meta: (r) => `${nf.format(r.sessions)} sessions` },
    { key: 'eng', label: 'Engaged', width: 96, align: 'right', muted: true, cell: (r) => `${Math.round((r.engaged / r.sessions) * 100)}%`, meta: (r) => `${Math.round((r.engaged / r.sessions) * 100)}% engaged` },
  ]
  return (
    <Card className="h-full overflow-hidden">
      <div className="px-5 pb-3 pt-5 max-md:px-4">
        <h2 className={cardTitle}>Top landing pages from AI</h2>
        <p className={subtitle}>Where AI visitors land first</p>
      </div>
      <Table columns={columns} rows={rows} rowKey={(r) => r.path} />
    </Card>
  )
}
