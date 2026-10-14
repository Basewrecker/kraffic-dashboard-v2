import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, FlaskConical, Plus, Search, TrendingUp } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import PromptTable from '../../components/dashboard/PromptTable'
import Segmented from '../../components/dashboard/Segmented'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/dashboard/overlays'
import { openDrawer, setParams, useParams } from '../../components/audit/parts'
import DrawerShell, { useDrawer } from '../../components/audit/DrawerShell'
import ToolPage, { cardTitle, inkBtn, lineBtn, subtitleCls, t2, t3 } from '../../components/tool/ToolPage'
import KpiStrip from '../../components/tool/KpiStrip'
import { navigate } from '../../router'
import { experimentStates, siteAudit, trackedPrompts } from '../../data/mock'
import { fmtDay } from './sitekit'

// /more-tools/experiments (list) · /more-tools/experiments/:id (one experiment).
// Production: experiments module (GeoExperiment, variants, ExperimentMetricSnapshot) — results there are simulated.
// GAP fields used here: pageUrl, promptKeys, windowDays, changedAt, per-prompt before/after. ?mock=none|running|error|full.
const TODAY = '2026-10-14'
const DAY = 86400000
const promptText = (k) => trackedPrompts.find((p) => p.id === k)?.prompt ?? k
const avg = (xs) => (xs.length ? xs.reduce((n, x) => n + x, 0) / xs.length : 0)

// before = the days before the change, after = from the change on
function resultOf(e) {
  if (!e.series.length || !e.changedAt) return null
  const before = avg(e.series.filter((p) => p.recordedAt < e.changedAt).map((p) => p.visibilityScore))
  const after = avg(e.series.filter((p) => p.recordedAt >= e.changedAt).slice(-7).map((p) => p.visibilityScore))
  const perPrompt = e.perPrompt ?? e.promptKeys.map((_, i) => [Math.round(before + ((i * 7) % 9) - 4), Math.round(after + ((i * 5) % 9) - 4)])
  return { before: Math.round(before), after: Math.round(after), change: Math.round(after - before), perPrompt, improved: perPrompt.filter(([b, a]) => a > b).length }
}
const dayOf = (e) => Math.min(e.windowDays, Math.round((Date.parse(TODAY) - Date.parse(e.changedAt)) / DAY))
const statusText = (e) => (e.status === 'DRAFT' ? 'Draft' : e.status === 'RUNNING' ? `Running · day ${dayOf(e)} of ${e.windowDays}` : 'Done')
const Change = ({ v, suffix = ' pts' }) => (v == null ? <span className={t3}>—</span>
  : <span className={v < 0 ? 'text-negative' : 'text-stone-900'}>{v > 0 ? '+' : v < 0 ? '−' : ''}{Math.abs(v)}{suffix}</span>)

export default function ExperimentsPage({ id }) {
  const q = useParams()
  const key = experimentStates[q.get('mock')] ? q.get('mock') : 'full'
  const st = experimentStates[key]
  const exp = id ? st.experiments.find((e) => e.id === id) : null
  return id ? <Detail e={exp} /> : <List st={st} mockKey={key} />
}

// ---- list
function List({ st, mockKey }) {
  useEffect(() => { document.title = 'GEO Experiment Lab · Toolkit · Kraffic' }, [])
  const [toastNode, toast] = useToast({ position: 'center' })
  const rows = st.experiments.map((e) => ({ ...e, result: e.status === 'CONCLUDED' ? resultOf(e) : null }))
  const state = mockKey === 'error' ? 'error' : mockKey === 'running' ? 'running' : !rows.length ? 'not-run' : 'ready'
  const startNew = () => openDrawer('new', 'experiment')
  const columns = [
    { key: 'name', label: 'Experiment', mobile: 'primary', sort: { value: (r) => r.name, first: 'asc' }, csv: (r) => r.name, mobileText: (r) => r.name,
      cell: (r) => <span className="block truncate text-[14px] leading-5 font-medium text-stone-900" title={r.name}>{r.name}</span> },
    { key: 'page', label: 'Page', width: 260, csv: (r) => r.pageUrl, cell: (r) => <span className={`block truncate text-[13px] leading-[18px] ${t2}`} title={r.pageUrl}>{r.pageUrl}</span> },
    { key: 'prompts', label: 'Prompts', width: 96, align: 'right', sort: { value: (r) => r.promptKeys.length, first: 'desc' }, csv: (r) => r.promptKeys.length, mobileText: (r) => `${r.promptKeys.length} prompts`, cell: (r) => <span className="text-[14px] tabular-nums text-stone-900">{r.promptKeys.length}</span> },
    { key: 'status', label: 'Status', width: 180, sort: { value: (r) => r.status, first: 'asc' }, csv: statusText, mobileText: statusText,
      cell: (r) => <span className={`text-[13px] leading-[18px] tabular-nums ${r.status === 'DRAFT' ? t3 : r.status === 'RUNNING' ? 'text-stone-900' : t2}`}>{statusText(r)}</span> },
    { key: 'result', label: 'Result', width: 104, align: 'right', sort: { value: (r) => r.result?.change ?? -999, first: 'desc' }, csv: (r) => r.result?.change ?? '', mobileText: (r) => (r.result ? `${r.result.change > 0 ? '+' : ''}${r.result.change} pts` : '—'),
      cell: (r) => <span className="text-[14px] font-semibold tabular-nums"><Change v={r.result?.change ?? null} /></span> },
  ]
  return (
    <>
      <ToolPage title="GEO Experiment Lab" subtitle="Change one page, then see what it does to your AI visibility on the prompts you pick."
        primary={{ label: 'New experiment', icon: Plus, onClick: startNew }} state={state}
        empty={{ icon: FlaskConical, title: 'No experiments yet', body: 'Pick a page and the prompts it should win, make one change, and we’ll compare visibility before and after.', action: { label: 'New experiment', icon: Plus, onClick: startNew } }}
        running={{ label: 'Checking the running experiment’s 6 prompts on 4 assistants…', since: st.iterating?.startedAt ?? new Date().toISOString() }}
        error={{ title: 'The last check round didn’t finish', reason: st.error, onRetry: () => setParams({ mock: 'running' }), keepBody: true }}>
        <PromptTable id="experiments" title="Experiments" subtitle="Newest first. Click one to see before and after." count={rows.length}
          rows={rows} columns={columns} filterKeys={['name', 'pageUrl']} searchLabel="Search experiments" csvName="experiments.csv"
          rowHover="hover:bg-tint" onRowClick={(r) => navigate(`/more-tools/experiments/${r.id}`)} />
      </ToolPage>
      <NewExperiment onSave={(start) => toast(start ? 'Experiment started · first check tomorrow' : 'Saved as a draft')} />
      {toastNode}
    </>
  )
}

// ---- New experiment: 4 numbered steps in a drawer (bottom sheet on phones)
function Step({ n, title, children }) {
  return (
    <section className="border-b border-[var(--div)] py-5 last:border-0">
      <h3 className="flex items-center gap-3 text-[14px] leading-5 font-semibold text-stone-900">
        <span className={`grid h-6 w-6 place-items-center rounded-full border border-line text-[13px] font-normal ${t2}`}>{n}</span>{title}
      </h3>
      <div className="mt-3 pl-9">{children}</div>
    </section>
  )
}
const NEW = { id: 'experiment' }
const PAGES = siteAudit.full.pages.filter((p) => p.httpStatus === 200).map((p) => p.path)
function NewExperiment({ onSave }) {
  const drawer = useDrawer('new', (v) => (v === 'experiment' ? NEW : null))
  const [page, setPage] = useState(PAGES[2])
  const [picked, setPicked] = useState(() => new Set())
  const [qq, setQq] = useState('')
  const [change, setChange] = useState('')
  const [win, setWin] = useState('14')
  if (!drawer.item) return null
  const matches = trackedPrompts.filter((p) => !qq || p.prompt.toLowerCase().includes(qq.toLowerCase())).slice(0, 8)
  const toggle = (id) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const ready = picked.size > 0 && change.trim()
  const save = (start) => { drawer.close(); onSave(start) }
  return (
    <DrawerShell drawer={drawer} title="New experiment" meta={<span>Change one page, watch the prompts it should win</span>}
      footer={(
        <>
          <span className={`${t3} tabular-nums`}>{picked.size ? `${picked.size} ${picked.size === 1 ? 'prompt' : 'prompts'} · ${win} days` : 'Pick at least one prompt'}</span>
          <span className="flex gap-2">
            <button type="button" onClick={() => save(false)} className={lineBtn}>Save draft</button>
            <button type="button" onClick={() => save(true)} disabled={!ready} className={inkBtn}>Start</button>
          </span>
        </>
      )}>
      <Step n={1} title="Pick a page">
        <Select label="Page" size="md" className="w-full" value={page} onChange={setPage} options={PAGES.map((p) => [p, p])} />
      </Step>
      <Step n={2} title="Pick the prompts to watch">
        <label className="relative block">
          <span className="sr-only">Search Prompt Hub</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden />
          <input value={qq} onChange={(e) => setQq(e.target.value)} placeholder="Search Prompt Hub" className="h-9 w-full rounded-lg border border-line bg-raised pl-9 pr-3 text-small text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-400" />
        </label>
        <ul className="mt-2">
          {matches.map((p) => (
            <li key={p.id}>
              <label className="-mx-2 flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[14px] leading-5 text-stone-900 hover:bg-tint">
                <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} className="size-4 accent-ink" />
                <span className="truncate">{p.prompt}</span>
              </label>
            </li>
          ))}
        </ul>
      </Step>
      <Step n={3} title="Describe the change">
        <textarea value={change} onChange={(e) => setChange(e.target.value)} rows={3} placeholder="e.g. Add a 50-word answer under the H1 that names the product and who it’s for."
          className="w-full resize-y rounded-lg border border-line bg-raised px-3 py-2 text-[14px] leading-5 text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-400" />
      </Step>
      <Step n={4} title="Set the test window">
        <Segmented label="Test window" value={win} onChange={setWin} options={[{ value: '7', label: '7 days' }, { value: '14', label: '14 days' }, { value: '28', label: '28 days' }]} />
        <p className={`mt-2 text-[13px] leading-[18px] ${t3}`}>We check the prompts daily for the same number of days before and after you make the change.</p>
      </Step>
    </DrawerShell>
  )
}

// ---- one experiment
function Detail({ e }) {
  useEffect(() => { document.title = `${e?.name ?? 'Experiment'} · Experiment Lab · Kraffic` }, [e])
  const back = { to: '/more-tools/experiments', label: 'Experiment Lab' }
  if (!e) return <ToolPage back={back} title="Experiment not found" state="not-run" empty={{ title: 'This experiment doesn’t exist any more', body: 'It may have been deleted.' }} />
  const r = resultOf(e)
  const n = e.promptKeys.length
  const verdict = e.status === 'DRAFT' ? 'Not started yet. Make the change, then start the test.'
    : !r ? 'Waiting for the first checks.'
      : e.status === 'RUNNING' ? `Running · day ${dayOf(e)} of ${e.windowDays}. So far visibility is ${r.change >= 0 ? 'up' : 'down'} ${Math.abs(r.change)} points.`
        : r.change >= 0 ? `Visibility rose ${r.change} points on ${r.improved} of ${n} prompts.` : `Visibility fell ${Math.abs(r.change)} points; ${r.improved} of ${n} prompts improved.`
  return (
    <ToolPage back={back} title={e.name} subtitle={`${e.pageUrl} · ${n} prompts · ${e.windowDays}-day window${e.changedAt ? ` · changed ${fmtDay(e.changedAt)}` : ''}`}
      state={e.status === 'DRAFT' ? 'not-run' : 'ready'}
      empty={{ icon: FlaskConical, title: 'Not started yet', body: e.hypothesis, action: { label: 'Start experiment', onClick: () => {} } }}>
      <p className="text-[20px] leading-7 font-semibold tracking-[-0.01em] text-stone-900">{verdict}</p>
      {r && (
        <>
          <KpiStrip items={[
            { label: 'Before', icon: ArrowDownRight, value: r.before, unit: '/100', meta: 'Average visibility before the change' },
            { label: 'After', icon: ArrowUpRight, value: r.after, unit: '/100', meta: e.status === 'RUNNING' ? 'So far' : 'Last 7 days of the test' },
            { label: 'Change', icon: TrendingUp, value: <Change v={r.change} suffix="" />, unit: 'pts', meta: 'After minus before' },
            { label: 'Prompts improved', icon: TrendingUp, value: r.improved, unit: `of ${n}`, meta: 'Higher after than before' },
          ]} />
          <BeforeAfter e={e} />
          <PerPrompt e={e} r={r} />
        </>
      )}
    </ToolPage>
  )
}

function BeforeAfter({ e }) {
  const data = e.series
  const first = data[0].recordedAt, last = data.at(-1).recordedAt
  const ticks = data.filter((_, i) => i % Math.max(1, Math.ceil(data.length / 7)) === 0).map((p) => p.recordedAt)
  return (
    <Card className="p-5">
      <h2 className={cardTitle}>Before and after</h2>
      <p className={subtitleCls}>Average visibility on the watched prompts, per day</p>
      <div className="mt-4 h-[240px]" role="img" aria-label={`Visibility from ${fmtDay(first)} to ${fmtDay(last)}; change made ${fmtDay(e.changedAt)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -4 }}>
            <ReferenceArea x1={first} x2={e.changedAt} fill="var(--tint)" fillOpacity={1} ifOverflow="hidden" label={{ value: 'Before', position: 'insideTopLeft', fontSize: 12, fill: 'var(--color-stone-500)' }} />
            <ReferenceArea x1={e.changedAt} x2={last} fill="var(--tint)" fillOpacity={0.5} ifOverflow="hidden" label={{ value: 'After', position: 'insideTopRight', fontSize: 12, fill: 'var(--color-stone-500)' }} />
            <CartesianGrid vertical={false} stroke="var(--div)" />
            <XAxis dataKey="recordedAt" ticks={ticks} tickFormatter={fmtDay} tickLine={false} axisLine={{ stroke: 'var(--color-line)' }} tick={{ fontSize: 12, fill: 'var(--color-stone-500)' }} />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--color-stone-500)' }} width={40} />
            <ReferenceLine x={e.changedAt} stroke="var(--color-stone-500)" strokeDasharray="4 4" label={{ value: 'Change made', position: 'top', fontSize: 12, fill: 'var(--color-stone-600)' }} />
            <Tooltip cursor={{ stroke: 'var(--color-line-strong)' }} content={({ active, payload }) => (active && payload?.length ? (
              <div className="rounded-md border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 shadow-md tabular-nums">
                <span className="font-semibold text-stone-900">{fmtDay(payload[0].payload.recordedAt)}</span><span className={t2}> · visibility {payload[0].payload.visibilityScore}</span>
              </div>
            ) : null)} />
            <Line dataKey="visibilityScore" stroke="var(--ink)" strokeWidth={2} dot={false} activeDot={{ r: 3.5, fill: 'var(--ink)', stroke: 'var(--color-surface)', strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function PerPrompt({ e, r }) {
  const rows = e.promptKeys.map((k, i) => ({ id: k, prompt: promptText(k), before: r.perPrompt[i][0], after: r.perPrompt[i][1], change: r.perPrompt[i][1] - r.perPrompt[i][0] }))
  const columns = [
    { key: 'prompt', label: 'Prompt', mobile: 'primary', sort: { value: (x) => x.prompt, first: 'asc' }, csv: (x) => x.prompt, mobileText: (x) => x.prompt,
      cell: (x) => <span className="block truncate text-[14px] leading-5 text-stone-900" title={x.prompt}>{x.prompt}</span> },
    { key: 'before', label: 'Before', width: 96, align: 'right', sort: { value: (x) => x.before, first: 'desc' }, csv: (x) => x.before, mobileText: (x) => `${x.before} before`, cell: (x) => <span className={`text-[14px] tabular-nums ${t2}`}>{x.before}</span> },
    { key: 'after', label: 'After', width: 96, align: 'right', sort: { value: (x) => x.after, first: 'desc' }, csv: (x) => x.after, mobileText: (x) => `${x.after} after`, cell: (x) => <span className="text-[14px] tabular-nums text-stone-900">{x.after}</span> },
    { key: 'change', label: 'Change', width: 104, align: 'right', sort: { value: (x) => x.change, first: 'desc' }, csv: (x) => x.change, mobileText: (x) => `${x.change > 0 ? '+' : ''}${x.change} pts`,
      cell: (x) => <span className="text-[14px] font-semibold tabular-nums"><Change v={x.change} suffix="" /></span> },
  ]
  return (
    <PromptTable id="experiment-prompts" title="Per prompt" subtitle="Visibility on each watched prompt, before and after" count={rows.length}
      rows={rows} columns={columns} filterKeys={['prompt']} csvName={`${e.id}-prompts.csv`} defaultSort={{ key: 'change', dir: 'desc' }} pagination={false} />
  )
}
