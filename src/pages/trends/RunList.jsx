import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import Select from '../../components/ui/Select'
import { useIsMobile } from '../../hooks/useMedia'
import { navigate } from '../../router'
import { useTrends } from './store'
import { Confirm, Progress, RowMenu, Spinner, StackBar, ago, cardTitle, fmtDay, inkBtn, sentimentParts, subtitleCls, t2, t3 } from './parts'

// /trends — ask a question, see past runs. A row opens /trends/:runId.
export default function RunList() {
  useEffect(() => { document.title = 'Trends · Kraffic' }, [])
  return (
    <>
      <div>
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">Trends</h1>
        <p className={`mt-1 text-[13px] leading-[18px] ${t2} lg:text-[14px] lg:leading-5`}>See how news and social channels talk about any topic.</p>
      </div>
      <NewAnalysis />
      <Runs />
    </>
  )
}

function NewAnalysis() {
  const { regions, defaultRegion, start } = useTrends()
  const [q, setQ] = useState('')
  const [region, setRegion] = useState(defaultRegion)
  const submit = (e) => {
    e.preventDefault()
    if (!q.trim()) return
    const id = start(q.trim(), region)
    setQ('')
    navigate(`/trends/${id}`)
  }
  return (
    <Card className="p-5 max-md:p-4">
      <h2 className={cardTitle}>New analysis</h2>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Question or topic</span>
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. What is California Prop 45?"
            className="h-11 w-full rounded-lg border border-line bg-raised pl-10 pr-3 text-[15px] text-stone-900 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-stone-500 hover:border-[var(--color-line-strong)] focus:border-[color-mix(in_srgb,var(--ink)_35%,transparent)] focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--ink)_8%,transparent)]" />
        </label>
        <div className="flex gap-2">
          <Select label="Region" size="md" className="h-11 w-44 max-md:flex-1 [&_select]:h-11" value={region} onChange={setRegion} options={regions.map((r) => [r, r])} />
          <button type="submit" disabled={!q.trim()} className={`${inkBtn} h-11`}>Analyze</button>
        </div>
      </form>
      <p className={`mt-2 text-[13px] leading-[18px] ${t3}`}>Takes 1–2 minutes. Results are saved to this project.</p>
    </Card>
  )
}

const statusCell = (r, retry) => {
  if (r.status === 'running') return <span className="inline-flex items-center gap-1.5 text-[13px] leading-[18px] text-stone-900"><Spinner />Running</span>
  if (r.status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-[13px] leading-[18px]" title={r.error}>
        <span className="text-negative">Failed</span><span className={t3}>·</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); retry(r) }} className="rounded font-medium text-stone-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Retry</button>
      </span>
    )
  }
  return <span className={`text-[13px] leading-[18px] ${t3}`}>Done</span>
}

// one row per question + region (repeat runs fold under it, newest first)
function groupRuns(runs) {
  const groups = new Map()
  for (const r of runs) {
    const k = `${r.prompt}|${r.region}`
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  return [...groups].map(([key, list]) => {
    const sorted = [...list].sort((x, y) => y.createdAt.localeCompare(x.createdAt))
    return { key, latest: sorted[0], past: sorted.slice(1), series: [...sorted].reverse().filter((r) => r.status === 'done').map((r) => r.mentions) }
  }).sort((x, y) => y.latest.createdAt.localeCompare(x.latest.createdAt))
}

// 64px sparkline: ink, 1.5px, a dot on the last point
function Sparkline({ values }) {
  if (values.length < 2) return <span className={t3}>—</span>
  const W = 64, H = 20, max = Math.max(...values), min = Math.min(...values)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (W - 4) + 2, H - 3 - ((v - min) / (max - min || 1)) * (H - 6)])
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Mentions across runs: ${values.join(', ')}`}>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts.at(-1)[0]} cy={pts.at(-1)[1]} r="2.5" fill="var(--ink)" />
    </svg>
  )
}

function Runs() {
  const { runs, now, rerun, remove, clear } = useTrends()
  const mobile = useIsMobile()
  const [ask, setAsk] = useState(null)
  const [open, setOpen] = useState(() => new Set(new URLSearchParams(window.location.search).get('expand') ? [groupRuns(runs).find((g) => g.past.length)?.key] : []))
  const [size, setSize] = useState(10)
  const [page, setPage] = useState(1)
  const groups = groupRuns(runs)
  const pages = Math.max(1, Math.ceil(groups.length / size))
  const cur = Math.min(page, pages)
  const shown = groups.slice((cur - 1) * size, cur * size)
  const go = (r) => navigate(`/trends/${r.id}`)
  const toggle = (k) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const menu = (r) => [
    { label: 'Open', onClick: () => go(r) },
    { label: 'Re-run', onClick: () => navigate(`/trends/${rerun(r)}`) },
    { label: 'Delete', danger: true, onClick: () => setAsk({ title: 'Delete this analysis?', body: `“${r.prompt}” (${fmtDay(r.createdAt)}) and its mentions will be removed from this project.`, onConfirm: () => remove(r.id) }) },
  ]
  const retry = (r) => rerun(r, { replace: true })

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 max-md:px-4">
        <div className="min-w-0">
          <h2 className={cardTitle}>Runs</h2>
          <p className={subtitleCls}>Every question you’ve asked, newest first. Repeat runs of a question are grouped.</p>
        </div>
        {runs.length > 0 && <RowMenu label="Runs actions" items={[{ label: 'Clear all', danger: true, onClick: () => setAsk({ title: 'Clear all analyses?', body: 'Every run and its mentions will be removed from this project. This can’t be undone.', confirmLabel: 'Clear all', onConfirm: clear }) }]} />}
      </div>

      {runs.length === 0 ? (
        <p className={`border-t border-[var(--div)] px-5 py-12 text-center text-[14px] leading-5 ${t2}`}>No analyses yet. Ask a question above to see how it’s being discussed.</p>
      ) : mobile ? (
        <ul className="divide-y divide-[var(--div)] border-t border-[var(--div)]">
          {shown.map((g) => (
            <li key={g.key}>
              <MobileRun r={g.latest} now={now} go={go} menu={menu(g.latest)} retry={retry} count={g.past.length + 1} expanded={open.has(g.key)} onToggle={g.past.length ? () => toggle(g.key) : null} />
              {open.has(g.key) && g.past.map((r) => <MobileRun key={r.id} r={r} now={now} go={go} menu={menu(r)} retry={retry} sub />)}
            </li>
          ))}
        </ul>
      ) : (
        <table className="w-full table-fixed">
          <thead>
            <tr className="h-9 border-y border-[var(--div)] bg-tint text-left text-[13px] leading-5 font-medium text-stone-500">
              <th className="pl-5 pr-3 font-medium">Prompt</th>
              <th className="w-[120px] px-3 font-medium">Region</th>
              <th className="w-[90px] px-3 text-right font-medium">Mentions</th>
              <th className="w-[88px] px-3 font-medium">Trend</th>
              <th className="w-[120px] px-3 font-medium">Sentiment</th>
              <th className="w-[110px] px-3 font-medium">Status</th>
              <th className="w-[100px] px-3 font-medium">Ran</th>
              <th className="w-[56px] pr-5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((g) => (
              <Group key={g.key} g={g} now={now} go={go} menu={menu} retry={retry} expanded={open.has(g.key)} onToggle={() => toggle(g.key)} />
            ))}
          </tbody>
        </table>
      )}

      {groups.length > 0 && !mobile && (
        <div className="flex h-12 items-center justify-between border-t border-[var(--div)] px-5 text-[13px] text-stone-500 tabular-nums">
          <span>Showing {(cur - 1) * size + 1}–{(cur - 1) * size + shown.length} of {groups.length}</span>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">Rows per page
              <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(1) }} className="h-8 rounded-md border border-line bg-raised px-2 text-[13px] font-medium text-stone-900 outline-none">
                {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <span>Page {cur} of {pages}</span>
            <div className="flex items-center gap-1.5">
              <PageBtn label="Previous page" disabled={cur === 1} onClick={() => setPage(cur - 1)}><ChevronLeft size={16} /></PageBtn>
              <PageBtn label="Next page" disabled={cur === pages} onClick={() => setPage(cur + 1)}><ChevronRight size={16} /></PageBtn>
            </div>
          </div>
        </div>
      )}
      <Confirm ask={ask} onClose={() => setAsk(null)} />
    </Card>
  )
}

function Group({ g, now, go, menu, retry, expanded, onToggle }) {
  const n = g.past.length + 1
  return (
    <>
      <RunRow r={g.latest} now={now} go={go} menu={menu(g.latest)} retry={retry}
        lead={(
          <span className="flex min-w-0 items-center gap-1.5">
            {n > 1 ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); onToggle() }} aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} ${n - 1} earlier ${n - 1 === 1 ? 'run' : 'runs'}`} data-expand
                className="-ml-1.5 grid h-6 w-6 shrink-0 place-items-center rounded text-stone-500 outline-none hover:bg-[var(--color-line)] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
                <ChevronRight size={14} className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`} aria-hidden />
              </button>
            ) : <span className="-ml-1.5 w-6 shrink-0" aria-hidden />}
            <span className="truncate" title={g.latest.prompt}>{g.latest.prompt}</span>
            {n > 1 && <span className={`shrink-0 ${t3}`}>{n} runs</span>}
          </span>
        )}
        trend={<Sparkline values={g.series} />} />
      {expanded && g.past.map((r) => (
        <RunRow key={r.id} r={r} now={now} go={go} menu={menu(r)} retry={retry} sub
          lead={<span className={`block truncate pl-[30px] ${t2}`}>Run {r.runNo} <span className={t3}>· {fmtDay(r.createdAt)}</span></span>} trend={null} />
      ))}
    </>
  )
}

function RunRow({ r, now, go, menu, retry, lead, trend, sub = false }) {
  const running = r.status === 'running'
  return (
    <>
      <tr tabIndex={0} onClick={() => go(r)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) go(r) }}
        aria-label={`${r.prompt}, run ${r.runNo}. Open`}
        className={`group h-11 cursor-pointer outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${running ? '' : 'border-b border-[var(--div)]'} ${sub ? 'bg-[var(--subtle-bg)]' : ''}`}>
        <td className={`pl-5 pr-3 text-[14px] leading-5 ${sub ? '' : 'text-stone-900'}`}>{lead}</td>
        <td className={`truncate px-3 text-[13px] leading-[18px] ${t2}`}>{sub ? '' : r.region}</td>
        <td className="px-3 text-right text-[14px] leading-5 text-stone-900 tabular-nums">{r.status === 'done' ? r.mentions : <span className={t3}>—</span>}</td>
        <td className="px-3">{trend}</td>
        <td className="px-3">{r.status === 'done' && r.mentions ? <StackBar parts={sentimentParts(r.sentiment)} label={`Positive ${r.sentiment.positive}, neutral ${r.sentiment.neutral}, negative ${r.sentiment.negative}`} /> : <span className={t3}>—</span>}</td>
        <td className="px-3">{statusCell(r, retry)}</td>
        <td className={`truncate px-3 text-[13px] leading-[18px] ${t3}`}>{ago(r.createdAt, now)}</td>
        <td className="pr-5"><RowMenu label={`Actions for ${r.prompt}, run ${r.runNo}`} items={menu} className="ml-auto w-8" /></td>
      </tr>
      {running && (
        <tr className="border-b border-[var(--div)] hover:bg-tint" onClick={() => go(r)}>
          <td colSpan={8} className="cursor-pointer pb-3 pl-5 pr-5"><Progress step={r.step} /></td>
        </tr>
      )}
    </>
  )
}

function MobileRun({ r, now, go, menu, retry, count = 1, expanded = false, onToggle = null, sub = false }) {
  return (
    <div role="button" tabIndex={0} onClick={() => go(r)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) go(r) }}
      className={`flex items-start gap-2 py-3 outline-none active:bg-tint focus-visible:bg-tint ${sub ? 'border-t border-[var(--div)] bg-[var(--subtle-bg)] pl-10 pr-4' : 'px-4'}`}>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[14px] leading-5 font-medium text-stone-900">
          {sub ? <span className={`font-normal ${t2}`}>Run {r.runNo} · {fmtDay(r.createdAt)}</span> : r.prompt}
          {!sub && count > 1 && <span className={`font-normal ${t3}`}> · {count} runs</span>}
        </div>
        <div className={`mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-[18px] ${t2} tabular-nums`}>
          {!sub && <><span>{r.region}</span><span className="text-stone-400">·</span></>}
          {r.status === 'done' ? <span>{r.mentions} mentions</span> : statusCell(r, retry)}
          {!sub && <><span className="text-stone-400">·</span><span className={t3}>{ago(r.createdAt, now)}</span></>}
        </div>
        {r.status === 'running' && <Progress step={r.step} className="mt-2" />}
        {onToggle && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onToggle() }} aria-expanded={expanded}
            className={`mt-1.5 inline-flex h-7 items-center gap-1 rounded text-[13px] font-medium ${t2} outline-none focus-visible:ring-2 focus-visible:ring-focus`}>
            <ChevronRight size={14} className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`} aria-hidden />{expanded ? 'Hide earlier runs' : `Show ${count - 1} earlier ${count - 1 === 1 ? 'run' : 'runs'}`}
          </button>
        )}
      </div>
      <RowMenu label={`Actions for ${r.prompt}, run ${r.runNo}`} items={menu} className="-mr-1" />
    </div>
  )
}

function PageBtn({ label, disabled, onClick, children }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-md border border-line text-[16px] text-stone-600 transition-colors duration-150 hover:bg-tint hover:text-stone-900 disabled:pointer-events-none disabled:text-stone-300">
      {children}
    </button>
  )
}
