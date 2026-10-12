import { useEffect, useMemo, useRef, useState } from 'react'
import { Bar as RBar, BarChart as RBarChart, Cell, LabelList, Pie as RPie, PieChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { ArrowRight, Check, ChevronDown, ChevronRight, Code2, Copy, Download, MoreHorizontal, RefreshCw } from 'lucide-react'
import Card from '../dashboard/Card'
import PromptTable from '../dashboard/PromptTable'
import Segmented from '../dashboard/Segmented'
import Modal from '../ui/Modal'
import Insight, { hl, useExplain } from '../ui/Insight'
import Gauge from '../ui/Gauge'
import ErrorBoundary from '../ui/ErrorBoundary'
import { useToast } from '../dashboard/overlays'
import { downloadCsv } from '../dashboard/csv'
import AuditDrawer, { PageDrawer } from './AuditDrawer'
import ActionMenu from './ActionMenu'
import MobileActions from '../ui/MobileActions'
import { CheckIcon, ImpactMeter, RowIcon, StatusLabel, ViewFix, openDrawer, rowBtn, openIssue, pct, plural, setParams, useTab } from './parts'
import {
  AUDIT, BUCKETS, CATEGORIES, IMPACT, PAGE_COUNT, STATUS, STATUS_CODES, byStatus, checks, contentChecks, crawl, open as isOpen, pageProblems, pages, priority, readiness, technicalChecks,
} from '../../data/audit'

// /audit — "Site Audit": how ready the site is for AI answers. Tabs: Overview · Issues · Content · Crawl (?tab=).
// One merged list of 19 checks (data/audit). Rows open the Check drawer (?check=) or the Page drawer (?page=).
// Graphite only; --negative marks Failing checks (and a page over 1 s) and nothing else.
const t2 = 'text-stone-600'
const t3 = 'text-stone-500'
const TABS = [
  ['overview', 'Overview'],
  ['issues', 'Issues', technicalChecks.filter(isOpen).length], // technical + speed checks still to fix
  ['content', 'Content', contentChecks.length],
  ['crawl', 'Crawl'],
]
const today = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export default function AuditPage() {
  useEffect(() => { document.title = 'Site Audit · Kraffic' }, [])
  const [tab, setTab, q] = useTab()
  // phones: bring the active tab into view in the sideways-scrolling row
  const tabsRef = useRef(null)
  useEffect(() => { tabsRef.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }, [tab])
  const [lastRun, setLastRun] = useState(AUDIT.lastRun)
  const [running, setRunning] = useState(false)
  const [api, setApi] = useState(false)
  const [toastNode, toast] = useToast({ position: 'center' })
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const run = () => {
    setRunning(true)
    timer.current = setTimeout(() => { setRunning(false); setLastRun(today()); toast(`Audit finished · ${PAGE_COUNT} pages checked`) }, 1800)
  }
  const exportAll = () => downloadCsv(`site-audit-${new Date().toISOString().slice(0, 10)}.csv`, [...checks].sort(byStatus), [
    { label: 'Check', key: 'name' },
    { label: 'Category', csv: (c) => CATEGORIES[c.category] },
    { label: 'Status', csv: (c) => STATUS[c.status].label },
    { label: 'Finding', key: 'finding' },
    { label: 'Impact', csv: (c) => IMPACT[c.impact].label },
    { label: 'Pages affected', csv: (c) => c.pages.length },
    { label: 'Pages', csv: (c) => c.pages.join(' ') },
  ])

  // arrow keys move between tabs (roving tabindex)
  const tabKeys = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const ids = TABS.map((t) => t[0])
    const next = ids[(ids.indexOf(tab) + step + ids.length) % ids.length]
    setTab(next, { status: null, check: null })
    requestAnimationFrame(() => document.querySelector(`[data-audit-tab="${next}"]`)?.focus())
  }

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">Site Audit</h1>
          <p className="mt-1 text-[13px] leading-[18px] text-stone-600 lg:text-[14px] lg:leading-5">
            How ready {AUDIT.domain} is for AI answers
          </p>
          <p className={`mt-1 text-[13px] leading-[18px] ${t3} tabular-nums lg:hidden`} title={AUDIT.note}>{running ? 'Running…' : `Last run ${lastRun} · ${PAGE_COUNT} pages`}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 lg:pt-1">
          <span title={AUDIT.note} className={`mr-1 hidden cursor-default whitespace-nowrap text-[13px] leading-[18px] ${t3} tabular-nums lg:inline`}>
            {running ? 'Running…' : `Last run ${lastRun} · ${PAGE_COUNT} pages`}
          </span>
          <button type="button" onClick={run} disabled={running}
            className="inline-flex h-10 items-center justify-center gap-2 max-lg:flex-1 lg:h-9 whitespace-nowrap rounded-lg bg-ink px-3.5 text-small font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-60">
            <RefreshCw size={14} className={running ? 'animate-[spin_600ms_linear_infinite] motion-reduce:animate-none' : undefined} aria-hidden />
            Run audit
          </button>
          <MobileActions items={[{ label: 'API access', icon: Code2, onClick: () => setApi(true) }, { label: 'Export all (CSV)', icon: Download, onClick: exportAll }]} />
          <span className="hidden lg:inline-flex">
          <ActionMenu label="More actions" items={[{ label: 'API access', onClick: () => setApi(true) }, { label: 'Export all (CSV)', onClick: exportAll }]}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
            <MoreHorizontal size={16} aria-hidden />
          </ActionMenu>
          </span>
        </div>
      </div>

      {/* underline tabs (same as the drawers) */}
      {/* phones: the tabs scroll sideways edge to edge (snap), the active one scrolled into view */}
      <div role="tablist" aria-label="Site Audit" onKeyDown={tabKeys} ref={tabsRef}
        className="no-scrollbar -mx-4 mt-2 flex snap-x gap-6 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
        {TABS.map(([id, label, n]) => (
          <button key={id} data-audit-tab={id} type="button" role="tab" id={`audit-tab-${id}`} aria-controls="audit-panel" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id, { status: null, check: null })}
            className={`-mb-px inline-flex h-11 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap border-b-2 text-[14px] leading-5 font-medium outline-none md:h-10 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${tab === id ? 'border-ink text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900'}`}>
            {label}{n != null && <span className="text-[13px] leading-[18px] font-normal text-stone-500 tabular-nums">{n}</span>}
          </button>
        ))}
      </div>

      <div id="audit-panel" role="tabpanel" aria-labelledby={`audit-tab-${tab}`} className="flex flex-col gap-4">
        <ErrorBoundary resetKey={`${tab}|${q.get('status')}`} name={`Site Audit · ${tab}`}>
        {tab === 'overview' && <Overview setTab={setTab} />}
        {tab === 'issues' && <IssuesTab status={q.get('status')} />}
        {tab === 'content' && <ContentTab />}
        {tab === 'crawl' && <CrawlTab />}
        </ErrorBoundary>
      </div>

      <ApiModal open={api} onClose={() => setApi(false)} />
      <ErrorBoundary name="Check drawer" floating><AuditDrawer /></ErrorBoundary>
      <ErrorBoundary name="Page drawer" floating><PageDrawer /></ErrorBoundary>
      {toastNode}
    </>
  )
}

function ApiModal({ open, onClose }) {
  const [copied, setCopied] = useState(null)
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(null), 1500); return () => clearTimeout(t) }, [copied])
  const rows = [
    ['GET', '/api/geo-audit/report', 'The latest report as JSON'],
    ['POST', '/api/geo-audit/report', 'Start a new audit run'],
  ]
  const copy = (text) => { navigator.clipboard?.writeText(text).catch(() => {}); setCopied(text) }
  return (
    <Modal open={open} onClose={onClose} title="API access" subtitle={`Read or refresh the ${AUDIT.domain} audit from your own tools.`}>
      <ul className="flex flex-col gap-2">
        {rows.map(([method, path, note]) => {
          const text = `${method} ${path}`
          const done = copied === text
          return (
            <li key={method}>
              <div className="flex h-10 items-center gap-3 rounded-lg border border-line bg-tint pl-3 pr-1 font-mono text-[13px] leading-[18px] text-stone-900">
                <span className="w-10 shrink-0 font-semibold">{method}</span>
                <span className="min-w-0 flex-1 truncate">{path}</span>
                <button type="button" onClick={() => copy(text)} aria-label={`Copy ${text}`}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 font-sans text-[13px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-surface hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
                  {done ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}{done ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className={`mt-1 px-1 text-[12.5px] leading-[18px] ${t3}`}>{note}</p>
            </li>
          )
        })}
      </ul>
      <p className={`mt-4 text-[13px] leading-[18px] ${t2}`}>Send your workspace API key in the <span className="font-mono text-stone-900">Authorization</span> header.</p>
    </Modal>
  )
}

// ---- Overview: every card answers a different question, and no check appears twice
const cardTitle = 'text-[15px] leading-5 font-semibold text-stone-900'
const linkCls = 'inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus'
const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`)

function Overview({ setTab }) {
  return (
    <>
      <div className="mt-2 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[5fr_7fr]">
        <Readiness />
        <Glance />
      </div>
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[7fr_5fr]">
        <FixFirst setTab={setTab} />
        <CrawlHealth onOpen={() => setTab('crawl')} />
      </div>
      <WorstPages onAll={() => setTab('crawl')} />
    </>
  )
}

// "How ready are we?" — one score, its trend, and the three categories behind it
function Readiness() {
  const { score, previous, categories } = readiness
  const delta = score - previous.score
  return (
    <Card className="flex min-w-0 flex-col p-5">
      <h2 className={cardTitle}>AI readiness</h2>
      <div className="mt-4 flex items-end gap-4">
        <Gauge value={score} width={160} stroke={12} />
        <div className="pb-0.5">
          <div className="flex items-baseline gap-1">
            <span className="text-[40px] leading-10 font-semibold tracking-[-0.03em] text-stone-900 tabular-nums">{score}</span>
            <span className={`text-[14px] leading-5 ${t3}`}>/100</span>
          </div>
          {delta !== 0 && (
            <div className={`mt-1 text-[13px] leading-[18px] ${t2} tabular-nums`}>
              <span className={delta < 0 ? 'text-negative' : 'text-ink'}>{delta < 0 ? '▼' : '▲'}</span> {Math.abs(delta)} since {previous.date}
            </div>
          )}
        </div>
      </div>
      <ul className="mt-auto pt-4">
        {categories.map((c) => (
          <li key={c.id} className="flex h-8 items-center gap-3">
            <span className={`w-20 shrink-0 text-[13px] leading-[18px] ${t2}`}>{c.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--data-track)]" aria-hidden>
              <span className="block h-full rounded-full bg-ink" style={{ width: `${c.score}%` }} />
            </span>
            <span className="w-8 shrink-0 text-right text-[13px] leading-[18px] font-semibold text-stone-900 tabular-nums">{c.score}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// "What state is everything in?" — all 19 checks as one bar, then one cell each, grouped by category
const STATUS_KEYS = ['fail', 'warn', 'pass']
function Glance() {
  const [tip, setTip] = useState(null) // { c, left }
  const grid = useRef(null)
  const counts = Object.fromEntries(STATUS_KEYS.map((k) => [k, checks.filter((c) => c.status === k).length]))
  const ordered = Object.keys(CATEGORIES).flatMap((cat) => checks.filter((c) => c.category === cat).sort(byStatus))
  const spans = Object.entries(CATEGORIES).map(([id, label]) => ({ id, label, n: checks.filter((c) => c.category === id).length }))
  const show = (c, el) => {
    const box = grid.current.getBoundingClientRect(), r = el.getBoundingClientRect()
    setTip({ c, left: Math.min(Math.max(r.left + r.width / 2 - box.left, 120), box.width - 120) })
  }
  return (
    <Card className="flex min-w-0 flex-col p-5">
      <h2 className={cardTitle}>Checks at a glance</h2>
      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full" role="img" aria-label={STATUS_KEYS.map((k) => `${STATUS[k].label} ${counts[k]}`).join(', ')}>
        {STATUS_KEYS.filter((k) => counts[k]).map((k, i) => (
          <span key={k} className={`h-full ${i ? 'ml-px' : ''}`} style={{ width: `${(counts[k] / checks.length) * 100}%`, background: STATUS[k].color }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {STATUS_KEYS.map((k) => (
          <li key={k} className={`flex items-center gap-1.5 text-[13px] leading-[18px] ${t2} tabular-nums`}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS[k].color }} aria-hidden />
            {STATUS[k].label} <span className="font-semibold text-stone-900">{counts[k]}</span>
          </li>
        ))}
      </ul>

      {/* one cell per check; hover / focus shows its name + finding, click opens it */}
      <div ref={grid} className="relative mt-auto pt-6" onMouseLeave={() => setTip(null)}>
        <ul className="grid gap-1" style={{ gridTemplateColumns: `repeat(${checks.length}, minmax(0, 1fr))` }}>
          {ordered.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => openIssue(c.id)} onMouseEnter={(e) => show(c, e.currentTarget)} onFocus={(e) => show(c, e.currentTarget)} onBlur={() => setTip(null)}
                aria-label={`${c.name}: ${STATUS[c.status].label}. ${c.finding}`}
                className="block h-2.5 w-full rounded-sm outline-none transition-transform duration-150 hover:scale-y-[1.4] focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1"
                style={{ background: STATUS[c.status].color }} />
            </li>
          ))}
        </ul>
        <div className="mt-2 grid gap-1 text-[12px] leading-4 text-stone-500" style={{ gridTemplateColumns: `repeat(${checks.length}, minmax(0, 1fr))` }} aria-hidden>
          {spans.map((sp) => <span key={sp.id} className="truncate border-t border-line pt-1" style={{ gridColumn: `span ${sp.n}` }}>{sp.label}</span>)}
        </div>
        {tip && (
          <div role="tooltip" className="pointer-events-none absolute bottom-full z-20 mb-[-12px] w-60 -translate-x-1/2 rounded-lg border border-line bg-raised px-3 py-2 shadow-md" style={{ left: tip.left }}>
            <div className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold text-stone-900"><CheckIcon status={tip.c.status} size={14} />{tip.c.name}</div>
            <div className={`mt-0.5 text-[12px] leading-4 ${t2}`}>{tip.c.finding}</div>
          </div>
        )}
      </div>
    </Card>
  )
}

// "What do we fix first?" — open checks by impact × pages affected
function FixFirst({ setTab }) {
  const rows = checks.filter(isOpen).sort((a, b) => priority(b) - priority(a)).slice(0, 5)
  return (
    <Card className="flex min-w-0 flex-col px-5 pt-5">
      <h2 className={cardTitle}>Fix first</h2>
      <p className={`mt-0.5 text-[13px] leading-[18px] ${t2}`}>Biggest impact first</p>
      <ul className="mt-3 flex flex-col">
        {rows.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => openIssue(c.id)} className={`${rowBtn} h-14`}>
              <RowIcon><CheckIcon status={c.status} /></RowIcon>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{c.name}</span>
                <span className={`block truncate text-[13px] leading-[18px] ${t3} tabular-nums`}>{plural(c.pages.length, 'page')} · {STATUS[c.status].label}<span className="md:hidden"> · {IMPACT[c.impact].label} impact</span></span>
              </span>
              {/* phones: impact moves into the meta line, the row's chevron replaces "View fix" */}
              <span className="max-md:hidden"><ImpactMeter impact={c.impact} /></span>
              <span className="max-md:hidden"><ViewFix /></span>
              <ChevronRight size={14} className="shrink-0 text-stone-500 md:hidden" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-auto border-t border-line py-3">
        <button type="button" onClick={() => setTab('issues')} className={linkCls}>View all checks <ArrowRight size={14} aria-hidden /></button>
      </div>
    </Card>
  )
}

// "Which pages are worst?" — the page view: URLs ranked by what's wrong on them
function WorstPages({ onAll }) {
  const rows = pageProblems.slice(0, 6)
  const MAX = 5
  return (
    <Card className="overflow-hidden">
      <h2 className={`${cardTitle} px-5 pt-5`}>Pages that need the most work</h2>
      <table className="mt-3 w-full table-fixed">
        <thead>
          <tr className="h-9 border-y border-[var(--div)] bg-tint text-left text-[13px] leading-5 font-medium text-stone-500">
            <th className="pl-5 pr-3 font-medium">Page</th>
            <th className="w-[200px] px-3 font-medium">Problems</th>
            <th className="w-[120px] px-3 text-right font-medium">Load time</th>
            <th className="w-12 pr-5"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.path} tabIndex={0} onClick={() => openDrawer('page', p.path)} onKeyDown={(e) => { if (e.key === 'Enter') openDrawer('page', p.path) }}
              aria-label={`${p.path}: ${plural(p.checks.length, 'problem')}, loads in ${fmtMs(p.ms)}`}
              className="group h-11 cursor-pointer border-b border-[var(--div)] outline-none transition-colors duration-150 last:border-0 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
              <td className="truncate pl-5 pr-3 text-[14px] leading-5 text-stone-900" title={p.path}>{p.path}</td>
              <td className="px-3">
                <span className="flex items-center gap-1" title={p.checks.map((c) => c.name).join(', ')}>
                  {p.checks.slice(0, MAX).map((c) => <span key={c.id} className="h-2 w-2 rounded-[2px]" style={{ background: STATUS[c.status].color }} aria-hidden />)}
                  {p.checks.length > MAX && <span className={`ml-1 text-[12px] leading-4 ${t3} tabular-nums`}>+{p.checks.length - MAX}</span>}
                  <span className={`ml-2 text-[13px] leading-[18px] ${t3} tabular-nums`}>{p.checks.length}</span>
                </span>
              </td>
              <td className={`px-3 text-right text-[14px] leading-5 font-semibold tabular-nums ${p.ms >= 1000 ? 'text-negative' : 'text-stone-900'}`}>{fmtMs(p.ms)}</td>
              <td className="pr-5"><ChevronRight size={14} className="ml-auto text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-[var(--div)] px-5 py-3">
        <button type="button" onClick={onAll} className={linkCls}>View all {PAGE_COUNT} pages <ArrowRight size={14} aria-hidden /></button>
      </div>
    </Card>
  )
}

function CrawlHealth({ onOpen }) {
  const explain = useExplain('crawl')
  const top = [...BUCKETS].sort((a, b) => b.count - a.count)[0]
  const slowest = BUCKETS.at(-1)
  const text = `Most pages respond in ${top.label}.${slowest.count ? ` ${plural(slowest.count, 'page takes', 'pages take')} over 1 s.` : ''}`
  const dim = (id) => (explain.on && !explain.keys.includes(`bucket:${id}`) ? 0.35 : 1)
  return (
    <Card ref={explain.cardRef} className="flex min-w-0 flex-col px-5 pt-5">
      <h2 className={cardTitle}>Crawl health</h2>

      <button type="button" onClick={onOpen} aria-label="Response times: open Crawl" className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">
        {BUCKETS.filter((b) => b.count).map((b, i) => (
          <span key={b.id} className={`h-full transition-opacity duration-150 ${i ? 'ml-px' : ''}`} style={{ width: `${(b.count / PAGE_COUNT) * 100}%`, background: b.color, opacity: dim(b.id) }} />
        ))}
      </button>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {BUCKETS.map((b) => (
          <li key={b.id} {...hl(explain, `bucket:${b.id}`)} className="flex items-center gap-1.5 text-[13px] leading-[18px] text-stone-600 tabular-nums">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.color }} aria-hidden />
            {b.label}<span className="font-medium text-stone-900">{b.count}</span>
          </li>
        ))}
      </ul>

      <button type="button" onClick={onOpen} className={`${linkCls} mt-4 self-start`}>View crawl details <ArrowRight size={14} aria-hidden /></button>

      <div className="mt-auto pb-3 pt-4">
        <Insight explain={explain} text={text} evidence={{
          keys: [`bucket:${top.id}`, `bucket:${slowest.id}`],
          calc: `${top.count} of ${PAGE_COUNT} pages answer in ${top.label}; ${slowest.count} in over 1 s (${pages.filter((p) => p.ms >= 1000).map((p) => p.path).join(', ')}).`,
          action: { label: 'Crawl', onClick: onOpen },
        }} />
      </div>
    </Card>
  )
}

// ---- Issues tab: the technical + speed checks
function IssuesTab({ status }) {
  const filter = STATUS[status] ? status : 'all'
  const rows = useMemo(() => [...technicalChecks].sort(byStatus).filter((c) => filter === 'all' || c.status === filter), [filter])
  const options = [
    { value: 'all', label: `All ${technicalChecks.length}` },
    ...STATUS_KEYS.map((k) => ({ value: k, label: `${STATUS[k].label} ${technicalChecks.filter((c) => c.status === k).length}` })),
  ]
  const columns = [
    {
      key: 'name', label: 'Check', sort: { value: (r) => r.name, first: 'asc' }, csv: (r) => r.name,
      cell: (r) => (
        <span className="block min-w-0">
          <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{r.name}</span>
          <span className={`block truncate text-[12.5px] leading-[18px] ${t3}`}>{r.finding}</span>
        </span>
      ),
    },
    { key: 'category', label: 'Category', width: 120, sort: { value: (r) => r.category, first: 'asc' }, csv: (r) => CATEGORIES[r.category], cell: (r) => <span className={`text-[13px] leading-[18px] ${t2}`}>{CATEGORIES[r.category]}</span> },
    { key: 'status', label: 'Status', width: 148, sort: { value: (r) => STATUS[r.status].rank, first: 'asc' }, csv: (r) => STATUS[r.status].label, cell: (r) => <StatusLabel status={r.status} /> },
    {
      key: 'pages', label: 'Pages', width: 216, sort: { value: (r) => r.pages.length, first: 'desc' }, csv: (r) => r.pages.length,
      cell: (r) => (r.pages.length ? (
        <span className="flex items-center gap-2.5 tabular-nums">
          <span className="w-6 text-[14px] leading-5 font-semibold text-stone-900">{r.pages.length}</span>
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--data-track)]" aria-hidden>
            <span className="block h-full rounded-full bg-ink" style={{ width: `${(r.pages.length / PAGE_COUNT) * 100}%` }} />
          </span>
          <span className={`text-[12px] leading-4 ${t3}`}>{pct(r.pages.length)}%</span>
        </span>
      ) : <span className={`text-[13px] ${t3}`}>—</span>),
    },
    {
      key: 'impact', label: 'Impact', width: 150, sort: { value: (r) => IMPACT[r.impact].level, first: 'desc' }, csv: (r) => IMPACT[r.impact].label,
      cell: (r) => <ImpactMeter impact={r.impact} />,
    },
    { key: 'open', label: '', width: 48, csv: false, cell: () => <ChevronRight size={14} className="ml-auto text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden /> },
  ]
  return (
    <div className="mt-2">
      <PromptTable
        id="audit-issues"
        rows={rows}
        columns={columns}
        filterKeys={['name', 'finding']}
        searchLabel="Search checks"
        emptyQuery={(qq) => <>No checks match “{qq}”</>}
        emptyMessage="No checks with this status"
        csvName={`site-audit-checks-${new Date().toISOString().slice(0, 10)}.csv`}
        defaultSort={{ key: 'status', dir: 'asc' }}
        rowHeight="h-[52px]"
        rowHover="hover:bg-tint"
        pagination={false}
        resetKey={filter}
        onRowClick={(r) => openIssue(r.id)}
        toolbar={({ search, exportButton, sortButton }) => (
          // phones: search + Sort, then the status filter scrolling sideways
          <div className="flex items-center gap-2 max-md:flex-wrap">
            <div className="no-scrollbar flex items-center gap-2 max-md:order-last max-md:-mx-4 max-md:w-[calc(100%+32px)] max-md:overflow-x-auto max-md:px-4 md:contents">
              <Segmented label="Status" value={filter} onChange={(v) => setParams({ status: v === 'all' ? null : v })} options={options} />
            </div>
            {search}
            {sortButton}
            <div className="ml-auto">{exportButton}</div>
          </div>
        )}
      />
    </div>
  )
}

// ---- Content tab: the content checks grouped by status; each row opens the Check drawer
function ContentTab() {
  const groups = STATUS_KEYS.map((k) => ({ k, rows: contentChecks.filter((c) => c.status === k).sort(byStatus) })).filter((g) => g.rows.length)
  return (
    <div className="mt-2 flex flex-col">
      {groups.map((g, i) => (
        <section key={g.k} aria-labelledby={`content-${g.k}`} className={i ? 'mt-6' : ''}>
          <h2 id={`content-${g.k}`} className={`mb-2 text-[13px] leading-[18px] font-semibold ${t2} tabular-nums`}>{STATUS[g.k].label} {g.rows.length}</h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-[var(--div)]">
              {g.rows.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => openIssue(c.id)}
                    className="group flex h-12 w-full items-center gap-3 px-5 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                    <CheckIcon status={c.status} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-[14px] leading-5 font-medium text-stone-900">{c.name}</span>
                      <span className={`ml-2 text-[13px] leading-[18px] ${t3}`}>{c.finding}</span>
                    </span>
                    <ImpactMeter impact={c.impact} />
                    <ChevronRight size={14} className="shrink-0 text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  )
}

// ---- Crawl tab: response time, page depth, status codes
// ---- Crawl tab
const CHART_LABELS = ['<200ms', '200–500ms', '500ms–1s', '1s+']
const CODE_COLORS = { '2xx': 'var(--ink)', '3xx': 'var(--data-c1)', '4xx': 'var(--data-c2)', '5xx': 'var(--negative)' }
const DEPTH_LABELS = ['Home', 'Collections & info', 'Products & posts']

function CrawlTab() {
  const slowest = crawl.slowest[0]
  const kpis = [
    { label: 'Avg response', value: fmtMs(crawl.avgMs) },
    { label: 'Slowest', value: fmtMs(slowest.ms), bad: slowest.ms >= 1000, title: slowest.path },
    { label: 'Deepest page', value: `${crawl.deepest} ${crawl.deepest === 1 ? 'click' : 'clicks'}` },
    { label: 'Errors', value: crawl.errors, bad: crawl.errors > 0 },
  ]
  return (
    <>
      <Card className="mt-2 p-5">
        <div className="kpi-grid grid grid-cols-2 gap-y-4 md:grid-cols-4 md:divide-x md:divide-[var(--div)]">
          {kpis.map((k, i) => (
            <div key={k.label} className={`min-w-0 ${i ? 'md:pl-6' : ''} md:pr-6`} title={k.title}>
              <div className={`text-[13px] leading-[18px] ${t2}`}>{k.label}</div>
              <div className={`mt-1 text-[32px] leading-10 font-semibold tabular-nums ${k.bad ? 'text-negative' : 'text-stone-900'}`}>{k.value}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[7fr_5fr]">
        <ResponseChart />
        <SlowestPages />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <SiteStructure />
        <StatusCodes />
      </div>
    </>
  )
}

// column chart on a numeric x so the 500 ms target can sit between the 2nd and 3rd buckets
function ResponseChart() {
  const data = BUCKETS.map((b, i) => ({ x: i, count: b.count }))
  const max = Math.max(...data.map((d) => d.count))
  return (
    <Card className="flex min-w-0 flex-col p-5">
      <h2 className={cardTitle}>Response time</h2>
      <div className="mt-4 min-h-[220px] flex-1" role="img" aria-label={`Pages by response time: ${BUCKETS.map((b, i) => `${CHART_LABELS[i]} ${b.count}`).join(', ')}. Target 500 ms.`}>
        <ResponsiveContainer width="100%" height="100%">
          <RBarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: 8 }}>
            <XAxis dataKey="x" type="number" domain={[-0.5, 3.5]} ticks={[0, 1, 2, 3]} tickFormatter={(i) => CHART_LABELS[i]}
              tickLine={false} axisLine={{ stroke: 'var(--color-line)' }} tick={{ fontSize: 13, fill: 'var(--color-stone-600)' }} interval={0} />
            <YAxis hide domain={[0, Math.ceil(max * 1.15)]} />
            <ReferenceLine x={1.5} stroke="var(--color-stone-400)" strokeDasharray="4 4"
              label={{ value: 'Target 500 ms', position: 'top', fontSize: 12, fill: 'var(--color-stone-600)' }} />
            <RBar dataKey="count" fill="var(--ink)" radius={[4, 4, 0, 0]} barSize={40} isAnimationActive={false}>
              <LabelList dataKey="count" position="top" offset={6} style={{ fontSize: 13, fontWeight: 600, fill: 'var(--color-stone-900)' }} />
            </RBar>
          </RBarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function SlowestPages() {
  const rows = crawl.slowest.slice(0, 8)
  const top = rows[0].ms
  return (
    <Card className="flex min-w-0 flex-col p-5">
      <h2 className={cardTitle}>Slowest pages</h2>
      <ul className="mt-2">
        {rows.map((p) => (
          <li key={p.path} className="flex h-10 items-center gap-3 text-[14px] leading-5 tabular-nums">
            <a href={`https://${AUDIT.domain}${p.path}`} target="_blank" rel="noreferrer" title={p.path}
              className="min-w-0 flex-1 truncate rounded text-stone-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">{p.path}</a>
            <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-[var(--data-track)]" aria-hidden>
              <span className="block h-full rounded-full bg-ink" style={{ width: `${(p.ms / top) * 100}%` }} />
            </span>
            <span className={`w-16 shrink-0 text-right font-semibold ${p.ms >= 1000 ? 'text-negative' : 'text-stone-900'}`}>{fmtMs(p.ms)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// one block per depth, height ∝ page count
function SiteStructure() {
  const max = Math.max(...crawl.depths.map((d) => d.count))
  const H = 140
  return (
    <Card className="flex min-w-0 flex-col p-5">
      <h2 className={cardTitle}>Site structure</h2>
      <div className="mt-4 flex flex-1 items-end justify-around gap-6" role="img" aria-label={crawl.depths.map((d) => `Depth ${d.depth}: ${d.count} pages`).join(', ')}>
        {crawl.depths.map((d) => (
          <div key={d.depth} className="flex flex-col items-center">
            <span className="text-[14px] leading-5 font-semibold text-stone-900 tabular-nums">{d.count}</span>
            <span className="mt-1.5 w-16 rounded-md bg-ink" style={{ height: Math.max(4, Math.round((d.count / max) * H)) }} />
            <span className={`mt-2 text-[13px] leading-[18px] ${t2}`}>Depth {d.depth}</span>
            <span className={`text-[12px] leading-4 ${t3}`}>{DEPTH_LABELS[d.depth]}</span>
          </div>
        ))}
      </div>
      <p className={`mt-4 text-[13px] leading-[18px] ${t2}`}>
        {crawl.deepest <= 2 ? `Every page is within ${crawl.deepest} clicks of the home page.` : `The deepest page is ${crawl.deepest} clicks from the home page.`}
      </p>
    </Card>
  )
}

function StatusCodes() {
  const ok = STATUS_CODES.find((c) => c.id === '2xx').count
  const share = pct(ok)
  const data = STATUS_CODES.filter((c) => c.count)
  return (
    <Card className="flex min-w-0 flex-col p-5">
      <h2 className={cardTitle}>Status codes</h2>
      <div className="mt-4 flex flex-1 items-center gap-8">
        <div className="relative h-[120px] w-[120px] shrink-0">
          <PieChart width={120} height={120}>
            <RPie data={data} dataKey="count" nameKey="id" cx="50%" cy="50%" innerRadius={46} outerRadius={60} startAngle={90} endAngle={-270}
              stroke="var(--color-surface)" strokeWidth={data.length > 1 ? 2 : 0} isAnimationActive={false}>
              {data.map((c) => <Cell key={c.id} fill={CODE_COLORS[c.id]} />)}
            </RPie>
          </PieChart>
          <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
            <span className="text-[20px] leading-6 font-semibold text-stone-900 tabular-nums">{share}%</span>
            <span className={`text-[12px] leading-4 ${t2}`}>{share === 100 ? 'OK' : '2xx'}</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1">
          {STATUS_CODES.map((c) => (
            <li key={c.id} className={`flex h-9 items-center justify-between gap-3 text-[14px] leading-5 tabular-nums ${c.count ? 'text-stone-900' : 'text-stone-500'}`}>
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: CODE_COLORS[c.id] }} aria-hidden />{c.id}</span>
              <span className={c.count ? 'font-semibold' : ''}>{c.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
