import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, ArrowRight, Braces, Check, ChevronDown, ChevronRight, Info, RefreshCw, Share2, X, XCircle } from 'lucide-react'
import { Pie, PieChart, Sector } from 'recharts'
import Card from '../dashboard/Card'
import PromptTable from '../dashboard/PromptTable'
import Segmented from '../dashboard/Segmented'
import Modal from '../ui/Modal'
import { useToast } from '../dashboard/overlays'
import { downloadCsv } from '../dashboard/csv'
import ActionMenu from '../audit/ActionMenu'
import { ImpactMeter, RowIcon, ViewFix, openDrawer, rowBtn, setParams, useTab } from '../audit/parts'
import SchemaDrawer, { setSchemaSection } from './SchemaDrawer'
import SettingsTab from './SettingsTab'
import { groupPages, useSettings } from './settings'
import { ImpactText, PendingCheck, StatusIcon, StatusLabel, pagesLine, usePending } from './parts'
import { IMPORTANCE, KINDS, PAGE_COUNT, SD, STATUS, analyze, isPageType, pageFor, schemas } from '../../data/structuredData'
import ErrorBoundary from '../ui/ErrorBoundary'

// /structured-data — "Structured Data": which schema.org types the site publishes and what to add.
// Same system as /audit: header, scope bar (?scope=page&url=), underline tabs (?tab=), rows → Schema drawer (?schema=).
// Graphite only; --negative marks Invalid / critical and nothing else. Bars are ink on --data-track.
const t2 = 'text-stone-600'
const t3 = 'text-stone-500'
const TAB_IDS = ['overview', 'schemas', 'recommendations', 'settings']
const selectCls = 'h-9 rounded-lg border border-line bg-raised px-2.5 text-small font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus'
const inkBtn = 'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-ink px-3.5 text-small font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-60'
const lineBtn = 'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-line px-3 text-small font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
const today = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
// section: 'issues' scrolls the drawer to its Issues section once it's open
const openSchema = (id, section, extra) => { setSchemaSection(section); openDrawer('schema', id, extra) }
const Bar = ({ value, className = 'h-1.5 w-full' }) => (
  <span className={`block overflow-hidden rounded-full bg-[var(--data-track)] ${className}`} aria-hidden>
    <span className="block h-full rounded-full bg-ink" style={{ width: `${Math.min(100, value)}%` }} />
  </span>
)

export default function StructuredDataPage() {
  useEffect(() => { document.title = 'Structured Data · Kraffic' }, [])
  const [tab, setTab, q] = useTab(TAB_IDS)
  const scope = q.get('scope') === 'page' ? 'page' : 'site'
  const url = q.get('url') ?? ''
  const page = scope === 'page' && url ? pageFor(url) : null
  const result = useMemo(() => (scope === 'site' ? analyze() : page && !page.error ? analyze(page) : null), [scope, url]) // eslint-disable-line react-hooks/exhaustive-deps

  // Coverage by page type → the Schemas tab for one page type (?type=). Whole site: that type's own numbers;
  // one page: the page's rows that apply to the type. An unknown ?type is dropped from the URL, silently.
  const rawType = q.get('type')
  const type = isPageType(rawType) ? rawType : null
  useEffect(() => { if (rawType != null && !type) setParams({ type: null }) }, [rawType, type])
  const typeResult = useMemo(() => (type && scope === 'site' ? analyze(null, type) : null), [type, scope])
  const [lastRun, setLastRun] = useState(SD.lastRun)
  const [running, setRunning] = useState(false)
  const [howOpen, setHowOpen] = useState(false)
  const [toastNode, toast] = useToast({ position: 'center' })
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const rerun = () => {
    setRunning(true)
    timer.current = setTimeout(() => { setRunning(false); setLastRun(today()); toast(`Analysis finished · ${PAGE_COUNT} pages`) }, 1800)
  }
  const share = () => { navigator.clipboard?.writeText(window.location.href).catch(() => {}); toast('Link copied') }

  const stamp = new Date().toISOString().slice(0, 10)
  const exportCsv = () => result && downloadCsv(`structured-data-${stamp}.csv`, result.rows, [
    { label: 'Schema', key: 'name' },
    { label: 'Status', csv: (r) => STATUS[r.status] },
    { label: 'Importance', csv: (r) => IMPORTANCE[r.importance] },
    { label: 'Pages with it', csv: (r) => r.found.length },
    { label: 'Pages it applies to', csv: (r) => r.applicable },
    { label: 'Missing on', csv: (r) => r.missing.join(' ') },
    { label: 'Warnings', csv: (r) => r.warnings.map(([t, on]) => `${t} (${on.length})`).join('; ') },
  ])
  const exportReport = () => { if (result) { downloadReport(result, page); toast('Client report downloaded') } }

  const counts = result ? { schemas: result.rows.length, recommendations: result.fix.length + result.toAdd.length } : {}
  const tabs = [['overview', 'Overview'], ['schemas', 'Schemas'], ['recommendations', 'Recommendations'], ['settings', 'Settings']]
  const tabKeys = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const next = TAB_IDS[(TAB_IDS.indexOf(tab) + step + TAB_IDS.length) % TAB_IDS.length]
    setTab(next, { set: null, status: null, type: null })
    requestAnimationFrame(() => document.querySelector(`[data-sd-tab="${next}"]`)?.focus())
  }

  return (
    <>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.02em] text-stone-900">Structured Data</h1>
            <button type="button" onClick={() => setHowOpen(true)} aria-label="How this analysis works" title="How this analysis works"
              className="grid h-7 w-7 place-items-center rounded-md text-stone-500 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
              <Info size={16} aria-hidden />
            </button>
          </div>
          <p className="mt-1 text-[14px] leading-5 text-stone-600">Which schemas Google and AI engines can read · detected as {SD.detected.join(', ')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <span className={`mr-1 whitespace-nowrap text-[13px] leading-[18px] ${t3} tabular-nums`}>{running ? 'Running…' : `${PAGE_COUNT} pages · last run ${lastRun}`}</span>
          <ActionMenu label="Export" items={[{ label: 'CSV', onClick: exportCsv }, { label: 'Client report', onClick: exportReport }]} className={lineBtn}>
            Export <ChevronDown size={14} className="text-stone-500" aria-hidden />
          </ActionMenu>
          <button type="button" onClick={share} className={lineBtn}><Share2 size={14} aria-hidden />Share</button>
          <button type="button" onClick={rerun} disabled={running} className={inkBtn}>
            <RefreshCw size={14} className={running ? 'animate-[spin_600ms_linear_infinite] motion-reduce:animate-none' : undefined} aria-hidden />Re-run
          </button>
        </div>
      </div>

      {/* tabs, with the scope toggle on the same row (right) */}
      <div className="mt-2 flex items-end justify-between gap-4 border-b border-line">
      <div role="tablist" aria-label="Structured Data" onKeyDown={tabKeys} className="flex gap-6">
        {tabs.map(([id, label]) => (
          <button key={id} data-sd-tab={id} type="button" role="tab" id={`sd-tab-${id}`} aria-controls="sd-panel" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id, { set: null, status: null, type: null })}
            className={`-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 text-[14px] leading-5 font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${tab === id ? 'border-ink text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900'}`}>
            {label}{counts[id] != null && <span className="text-[13px] leading-[18px] font-normal text-stone-500 tabular-nums">{counts[id]}</span>}
          </button>
        ))}
      </div>
        <div className="mb-1 shrink-0"><ScopeToggle scope={scope} url={url} /></div>
      </div>
      {scope === 'page' && <UrlRow url={url} error={page?.error} />}

      <div id="sd-panel" role="tabpanel" aria-labelledby={`sd-tab-${tab}`} className="mt-2 flex flex-col gap-4">
        <ErrorBoundary resetKey={`${tab}|${scope}|${url}|${type}`} name={`Structured Data · ${tab}`}>
        {tab === 'settings' ? <SettingsTab onRun={rerun} running={running} lastRun={lastRun} />
          : !result ? (
            <Card className="px-5 py-10 text-center">
              <p className={`text-[14px] leading-5 ${t2}`}>{page?.error ?? `Enter a page on ${SD.domain} above and press Analyze.`}</p>
            </Card>
          ) : tab === 'overview' ? <Overview r={result} setTab={setTab} site={scope === 'site'} />
            : tab === 'schemas' ? <SchemasTab r={typeResult ?? result} type={type} set={q.get('set')} status={q.get('status')} />
              : <RecommendationsTab r={result} />}
        </ErrorBoundary>
      </div>

      <HowModal open={howOpen} onClose={() => setHowOpen(false)} />
      <ErrorBoundary name="Schema drawer" floating><SchemaDrawer result={result} scope={scope} /></ErrorBoundary>
      {toastNode}
    </>
  )
}

// ---- scope: whole site, or one page typed in (the toggle sits on the tabs row; the URL row opens under the tabs)
function ScopeToggle({ scope, url }) {
  const setScope = (v) => {
    setParams({ scope: v === 'page' ? 'page' : null, url: v === 'page' ? url || null : null })
    if (v === 'page') requestAnimationFrame(() => document.getElementById('sd-url')?.focus())
  }
  return <Segmented size="sm" label="Scope" value={scope} onChange={setScope} options={[{ value: 'site', label: 'Whole site' }, { value: 'page', label: 'One page' }]} />
}
function UrlRow({ url, error }) {
  const [draft, setDraft] = useState(url)
  useEffect(() => setDraft(url), [url])
  const analyzeUrl = (e) => { e.preventDefault(); if (draft.trim()) setParams({ url: draft.trim() }) }
  return (
    <form onSubmit={analyzeUrl} className="mt-2 flex h-10 items-center gap-2">
      <label className="min-w-0 flex-1">
        <span className="sr-only">Page URL</span>
        <input id="sd-url" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`https://${SD.domain}/blog/post-1`} inputMode="url"
          aria-invalid={Boolean(error)} title={error}
          className={`h-9 w-full rounded-lg border bg-raised px-3 text-small text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-400 ${error ? 'border-stone-400' : 'border-line'}`} />
      </label>
      <button type="submit" disabled={!draft.trim()} className={`${lineBtn} disabled:pointer-events-none disabled:opacity-50`}>Analyze</button>
    </form>
  )
}

// ---- Overview
function Kpi({ label, children, first }) {
  return (
    <div className={`min-w-0 ${first ? '' : 'md:pl-6'} md:pr-6`}>
      <div className={`text-[13px] leading-[18px] ${t2}`}>{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  )
}
const Big = ({ children }) => <span className="text-[32px] leading-10 font-semibold text-stone-900 tabular-nums">{children}</span>
const cardTitle = 'text-[15px] leading-5 font-semibold text-stone-900'
const linkCls = 'inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus'
// "Affects 4 pages · Product pages" / "Missing on 8 pages · Product pages"
const whereLine = (s) => [pagesLine(s), s.kinds.join(', ')].filter(Boolean).join(' · ')

// "▲ 5 since May 16": arrow direction = the number's direction; ink when that's good, --negative when it's worse
function Change({ now, before, lowerIsBetter = false }) {
  const d = now - before
  if (!d) return <span className={t3}>No change</span>
  const better = lowerIsBetter ? d < 0 : d > 0
  return (
    <span className={t2}>
      <span className={better ? 'text-ink' : 'text-negative'}>{d > 0 ? '▲' : '▼'}</span> {Math.abs(d)} since {SD.previous.date}
    </span>
  )
}

// the row icon for a recommendation: a broken schema (error / warning) or one to add
const RecIcon = ({ s }) => (
  <RowIcon>{s.kind === 'fix' ? (s.level === 'error' ? <AlertCircle size={16} className="text-negative" /> : <AlertTriangle size={16} className="text-ink" />) : <Braces size={16} />}</RowIcon>
)
const recTitle = (s) => (s.kind === 'fix' ? s.name : `Add ${s.name} schema`)

function Overview({ r, setTab, site }) {
  const prev = SD.previous
  const pending = usePending()
  const next = [...r.fix, ...r.toAdd].slice(0, 4) // Fix items first
  const reqPct = r.required.total ? Math.round((r.required.valid * 100) / r.required.total) : null
  return (
    <>
      {/* KPI strip: numbers and how they moved since the last run */}
      <Card className="p-5">
        <div className="grid grid-cols-2 gap-y-4 md:grid-cols-4 md:divide-x md:divide-[var(--div)]">
          <Kpi label="Required schemas" first>
            <Big>{reqPct == null ? '—' : `${reqPct}%`}</Big>
            <div className="mt-1 text-[13px] leading-[18px] tabular-nums">{reqPct == null ? <span className={t3}>None apply here</span> : site ? <Change now={reqPct} before={prev.required} /> : <span className={t2}>{r.required.valid} of {r.required.total} valid</span>}</div>
          </Kpi>
          <Kpi label="Schema coverage">
            <Big>{r.coverage}%</Big>
            <div className="mt-1 text-[13px] leading-[18px] tabular-nums">{site ? <Change now={r.coverage} before={prev.coverage} /> : <span className={t2}>across this page</span>}</div>
          </Kpi>
          <Kpi label="Pages fully valid">
            <div className="flex items-baseline gap-1.5"><Big>{r.fullyValid}</Big><span className={`text-[13px] leading-[18px] ${t3} tabular-nums`}>of {r.pageCount}</span></div>
            <div className="mt-1 text-[13px] leading-[18px] tabular-nums">{site ? <Change now={r.fullyValid} before={prev.fullyValid} /> : <span className={t3}>—</span>}</div>
          </Kpi>
          <Kpi label="Warnings">
            <Big>{r.warnings}</Big>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] leading-[18px] tabular-nums">
              {r.critical > 0 && <span className="text-negative">{r.critical} critical</span>}
              {site && <Change now={r.warnings} before={prev.warnings} lowerIsBetter />}
              {r.warnings + r.critical > 0 && <button type="button" onClick={() => setTab('recommendations')} className={linkCls}>View</button>}
            </div>
          </Kpi>
        </div>
      </Card>

      <Card className="flex min-w-0 flex-col p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className={cardTitle}>What to do next</h2>
            <button type="button" onClick={() => setTab('recommendations')} className={linkCls}>View all <ArrowRight size={14} aria-hidden /></button>
          </div>
          {next.length === 0 ? (
            <p className="mt-3 flex h-14 items-center gap-2 text-[14px] leading-5 text-stone-900"><Check size={16} className="text-ink" aria-hidden />Everything required is in place.</p>
          ) : (
            // two columns on lg; a divider under every row except each column's last
            <ul className="mt-2 grid grid-cols-1 gap-x-8 lg:grid-cols-2 [&>li]:border-b [&>li]:border-[var(--div)] [&>li:last-child]:border-0 lg:[&>li:nth-last-child(2):nth-child(odd)]:border-0">
              {next.map((s) => (
                <li key={s.id}>
                  {/* the whole row is the button */}
                  <button type="button" onClick={() => openSchema(s.id)} className={`${rowBtn} h-14`}>
                    <RecIcon s={s} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] leading-5 font-medium text-stone-900" title={recTitle(s)}>{recTitle(s)}</span>
                      <span className={`block truncate text-[13px] leading-[18px] ${t3} tabular-nums`}>{whereLine(s)}</span>
                    </span>
                    {pending.has(s.id) ? <PendingCheck /> : <ImpactText impact={s.impact} />}
                    <ChevronRight size={14} className="shrink-0 text-stone-500" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
      </Card>

      <CoverageMap r={r} />

      <SchemaStatus r={r} setTab={setTab} />
    </>
  )
}

// ---- Coverage map: page types (the Settings rules) × the schemas that matter for them
const MAP_COLS = [['product', 'Product'], ['offer', 'Offer'], ['review-snippet', 'Review'], ['merchant-listing', 'Merchant'], ['article', 'Article'], ['faq', 'FAQ'], ['breadcrumb', 'Breadcrumb']]
const lower = (name) => name.charAt(0).toLowerCase() + name.slice(1)
// the rule id when it's one of the built-in page types (the drawer can filter to those); custom rules open unfiltered
const BUILT_IN = new Set(['product', 'blog', 'collection', 'home'])

// coverage marker: ● all pages (ink + check) · ◔ some (ring, ink arc = share, from 12 o'clock) · ◌ none (dashed ring)
function Marker({ found, applies, size = 20 }) {
  const sw = 2.5
  const r = (size - sw) / 2
  const len = 2 * Math.PI * r
  if (applies && found === applies) {
    return <span className="grid shrink-0 place-items-center rounded-full bg-ink" style={{ width: size, height: size }} aria-hidden><Check size={size * 0.6} strokeWidth={2.5} className="text-[var(--color-surface)]" /></span>
  }
  if (!found) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={(size - 1.5) / 2} fill="none" stroke="var(--color-line-strong)" strokeWidth={1.5} strokeDasharray="3 2.5" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--data-track)" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ink)" strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={len} strokeDashoffset={len * (1 - found / applies)} />
    </svg>
  )
}

function MapCell({ c, short, group }) {
  if (!c.applies) return <span className="block text-center text-[13px] leading-[18px] text-[var(--data-c3)]" aria-label={`${short} doesn't apply to ${lower(group.name)}`}>—</span>
  const all = c.found === c.applies
  const tip = `${short} · ${c.found} of ${c.applies} ${lower(group.name)} have it`
  const area = 'mx-auto flex w-fit items-center gap-2 rounded-md px-2 py-1 tabular-nums transition-colors duration-150 hover:bg-[var(--tint)]'
  if (all) return <span title={tip} role="img" aria-label={tip} className={area}><Marker found={c.found} applies={c.applies} /></span>
  return (
    <button type="button" title={tip} aria-label={`${tip}. Open ${short}`}
      onClick={() => openSchema(c.id, null, BUILT_IN.has(group.id) ? { schemaType: group.id } : {})}
      className={`${area} outline-none focus-visible:ring-2 focus-visible:ring-focus`}>
      <Marker found={c.found} applies={c.applies} />
      <span className={`text-[13px] leading-[18px] ${c.found ? 'font-medium text-ink' : 'text-stone-500'}`}>{c.found}/{c.applies}</span>
    </button>
  )
}

function CoverageMap({ r }) {
  const settings = useSettings()
  const groups = groupPages(settings.pageTypes, r.list).filter((g) => g.pages.length)
  const cells = groups.map((g) => MAP_COLS.map(([id, short]) => ({ id, short, ...r.cellFor(id, g.pages) })))
  // biggest gap: the cell with the most pages missing the schema
  let gap = null
  groups.forEach((g, gi) => cells[gi].forEach((c) => { const miss = c.applies - c.found; if (miss > 0 && (!gap || miss > gap.miss)) gap = { miss, short: c.short, where: lower(g.name) } }))
  return (
    <Card className="min-w-0 p-5">
      <h2 className={cardTitle}>Coverage map</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[840px] table-fixed border-collapse">
          <thead>
            <tr className="h-10 border-b border-[var(--div)]">
              <th className="w-56 text-left"><span className="sr-only">Page type</span></th>
              {MAP_COLS.map(([id, short]) => <th key={id} scope="col" className="min-w-[88px] text-center text-[13px] leading-[18px] font-medium text-stone-600">{short}</th>)}
            </tr>
          </thead>
          <tbody>
            {groups.map((g, gi) => (
              <tr key={g.id} className="h-12 border-b border-[var(--div)] transition-colors duration-150 last:border-0 hover:bg-[var(--tint)]">
                <th scope="row" className="pl-2 text-left font-normal">
                  <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{g.name}</span>
                  <span className={`block text-[13px] leading-[18px] ${t3} tabular-nums`}>{g.pages.length} {g.pages.length === 1 ? 'page' : 'pages'}</span>
                </th>
                {cells[gi].map((c) => <td key={c.id} className="px-1"><MapCell c={c} short={c.short} group={g} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[13px] leading-[18px] ${t2}`}>
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <li className="flex items-center gap-1.5"><Marker found={1} applies={1} size={14} />All pages</li>
          <li className="flex items-center gap-1.5"><Marker found={1} applies={3} size={14} />Some</li>
          <li className="flex items-center gap-1.5"><Marker found={0} applies={1} size={14} />None</li>
          <li className="flex items-center gap-1.5"><span className="text-[var(--data-c3)]" aria-hidden>—</span>Not relevant</li>
        </ul>
        {gap && <p className="tabular-nums">Biggest gap: {gap.short} on {gap.where} ({gap.miss} missing).</p>}
      </div>
    </Card>
  )
}

// ---- Schema status: one ring slice per schema (Invalid → Missing → Valid) + the list for the chosen group
const IMP_ORDER = { required: 0, recommended: 1, optional: 2 }
const LIST_MAX = 6
const GROUPS = [
  { st: 'invalid', label: 'Invalid', color: 'var(--negative)', note: 'Broken markup Google will ignore. Fix these first.' },
  { st: 'missing', label: 'Missing', color: 'var(--data-c2)', note: 'Not on your pages yet, sorted by pages affected.' },
  { st: 'valid', label: 'Valid', color: 'var(--ink)', note: 'Working as expected.' },
]
const COLOR = Object.fromEntries(GROUPS.map((g) => [g.st, g.color]))
const pagesOf = (x) => (x.status === 'invalid' ? x.invalid.length : x.status === 'missing' ? x.missing.length : x.found.length)
const RAD = Math.PI / 180

function SchemaStatus({ r, setTab }) {
  const rank = (a, b) => IMP_ORDER[a.importance] - IMP_ORDER[b.importance] || pagesOf(b) - pagesOf(a)
  const by = Object.fromEntries(GROUPS.map((g) => [g.st, r.rows.filter((x) => x.status === g.st).sort(rank)]))
  const ring = GROUPS.flatMap((g) => by[g.st]) // clockwise from 12 o'clock
  const [filter, setFilter] = useState(() => (by.invalid.length ? 'invalid' : 'missing'))
  const [hover, setHover] = useState(null) // index into ring
  const hovered = hover != null ? ring[hover] : null
  const group = GROUPS.find((g) => g.st === filter)
  const list = by[filter]
  const valid = by.valid.length

  // a slice: required schemas sit 4px further out; hovered pushes out 4px; the rest fade
  const shape = (props) => {
    const x = props.payload
    const i = ring.indexOf(x)
    const lit = hover != null ? i === hover : x.status === filter
    const push = i === hover ? 4 : 0
    const dx = Math.cos(-props.midAngle * RAD) * push, dy = Math.sin(-props.midAngle * RAD) * push
    return (
      <Sector {...props} cx={props.cx + dx} cy={props.cy + dy} outerRadius={x.importance === 'required' ? 116 : 112}
        fill={COLOR[x.status]} fillOpacity={lit ? 1 : 0.4} stroke="none"
        style={{ transition: 'fill-opacity 200ms ease-out', cursor: 'pointer', outline: 'none' }} />
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className={cardTitle}>Schema status</h2>
        <button type="button" onClick={() => setTab('schemas', { status: null, set: null, type: null })} className={linkCls}>View all {r.rows.length} <ArrowRight size={14} aria-hidden /></button>
      </div>

      <div className="mt-4 grid grid-cols-1 items-center gap-10 lg:grid-cols-[280px_1fr]">
        {/* the ring + its legend (the legend is the filter) */}
        <div className="flex flex-col items-center">
          <div className="relative h-[240px] w-[240px]" onMouseLeave={() => setHover(null)}>
            <PieChart width={240} height={240}>
              <Pie data={ring} dataKey={() => 1} nameKey="name" cx="50%" cy="50%" innerRadius={84} outerRadius={112}
                paddingAngle={1.5} cornerRadius={3} startAngle={90} endAngle={-270} isAnimationActive={false} rootTabIndex={-1}
                shape={shape}
                onMouseEnter={(_, i) => setHover(i)} onClick={(_, i) => openSchema(ring[i].id)} />
            </PieChart>
            <div className="pointer-events-none absolute inset-0 grid place-content-center justify-items-center px-14 text-center" aria-live="polite">
              {hovered ? (
                <>
                  <span className="line-clamp-2 text-[15px] leading-5 font-semibold text-stone-900">{hovered.name}</span>
                  <span className={`mt-1 text-[13px] leading-[18px] ${t2} tabular-nums`}>{pagesLine(hovered)}</span>
                </>
              ) : (
                <>
                  <span className="text-[32px] leading-10 font-semibold text-stone-900 tabular-nums">{valid}/{ring.length}</span>
                  <span className={`text-[13px] leading-[18px] ${t2}`}>schemas valid</span>
                </>
              )}
            </div>
          </div>
          <ul className="mt-5 w-full" role="radiogroup" aria-label="Show schemas">
            {GROUPS.map((g) => {
              const on = filter === g.st
              return (
                <li key={g.st}>
                  <button type="button" role="radio" aria-checked={on} onClick={() => setFilter(g.st)}
                    className={`flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'bg-[var(--tint)]' : 'hover:bg-[var(--tint)]'}`}>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: g.color }} aria-hidden />
                    <span className="flex-1 text-[14px] leading-5 text-stone-900">{g.label}</span>
                    <span className="text-[14px] leading-5 font-semibold text-stone-900 tabular-nums">{by[g.st].length}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* the chosen group (crossfades on switch) */}
        <div key={filter} className="min-w-0 self-start motion-safe:animate-[fade-in_150ms_ease-out]">
          <h3 className="text-[14px] leading-5 font-semibold text-stone-900 tabular-nums">{group.label} · {list.length} {list.length === 1 ? 'schema' : 'schemas'}</h3>
          <p className={`mt-0.5 text-[13px] leading-[18px] ${t2}`}>{group.note}</p>
          {list.length === 0 ? (
            <p className={`mt-4 text-[14px] leading-5 ${t2}`}>None.</p>
          ) : (
            <ul className="mt-3 border-t border-[var(--div)]">
              {list.slice(0, LIST_MAX).map((x) => (
                <li key={x.id} className="border-b border-[var(--div)]">
                  <button type="button" onClick={() => openSchema(x.id)} onMouseEnter={() => setHover(ring.indexOf(x))} onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(ring.indexOf(x))} onBlur={() => setHover(null)}
                    className="flex h-14 w-full items-center gap-3 px-2 text-left outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                    <StatusIcon status={x.status} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{x.name}</span>
                      <span className={`block truncate text-[13px] leading-[18px] ${t3}`}>{IMPORTANCE[x.importance]} · {(x.status === 'valid' ? '' : x.kinds.join(', ')) || x.usedOn}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className="text-[16px] leading-5 font-semibold text-stone-900">{pagesOf(x)}</span>
                      <span className={`text-[13px] leading-[18px] ${t3}`}> {pagesOf(x) === 1 ? 'page' : 'pages'}</span>
                    </span>
                    <ChevronRight size={14} className="shrink-0 text-stone-500" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {list.length > LIST_MAX && (
            <button type="button" onClick={() => setTab('schemas', { status: filter, set: null, type: null })} className={`${linkCls} mt-3`}>
              Show all {list.length} {group.label.toLowerCase()} <ArrowRight size={14} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}

function HowModal({ open, onClose }) {
  const items = [
    ['What we check', `We crawl up to ${PAGE_COUNT} pages and read every JSON-LD, Microdata and RDFa block on them.`],
    ['Required, Recommended, Optional', 'Required schemas are the ones your site type needs (an online store needs Product). Recommended ones unlock richer results. Optional ones help, but nothing breaks without them.'],
    ['Valid, Invalid, Missing', 'Valid passes Google’s rules. Invalid is markup with errors that stop it from being used. Missing means the page should have it but doesn’t.'],
    ['Required schemas', 'The share of required schemas that are valid on every page that needs them.'],
    ['Schema coverage', 'Of all the schema slots that apply to your pages (each schema on each page it fits), the share that are filled.'],
  ]
  return (
    <Modal open={open} onClose={onClose} title="How this analysis works">
      <dl className="flex flex-col gap-4">
        {items.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[14px] leading-5 font-semibold text-stone-900">{k}</dt>
            <dd className={`mt-1 text-[14px] leading-[22px] ${t2}`}>{v}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  )
}

// ---- Schemas tab
const SETS = { required: 'required', additional: 'recommended' }
function SchemasTab({ r, type, set, status }) {
  const pending = usePending()
  const which = SETS[set] ? set : 'all'
  const st = STATUS[status] ? status : 'all'
  const rows = useMemo(() => r.rows.filter((x) => (!type || x.pageTypes.includes(type)) && (which === 'all' || x.importance === SETS[which]) && (st === 'all' || x.status === st)), [r, type, which, st])
  const options = [
    { value: 'required', label: `Required ${r.required.valid}/${r.required.total}` },
    { value: 'additional', label: `Additional ${r.additional.valid}/${r.additional.total}` },
    { value: 'all', label: `All ${r.rows.length}` },
  ]
  const IMP_RANK = { required: 0, recommended: 1, optional: 2 }
  const ST_RANK = { invalid: 0, missing: 1, valid: 2 }
  const columns = [
    {
      key: 'name', label: 'Schema', sort: { value: (x) => x.name, first: 'asc' }, csv: (x) => x.name,
      cell: (x) => (
        <span className="block min-w-0">
          <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{x.name}</span>
          <span className={`block truncate text-[12.5px] leading-[18px] ${t3}`}>{x.desc}</span>
        </span>
      ),
    },
    // Invalid → Missing → Valid, then A→Z
    {
      key: 'status', label: 'Status', width: 128, sort: { value: (x) => ST_RANK[x.status], first: 'asc', tie: (x) => x.name }, csv: (x) => STATUS[x.status],
      cell: (x) => <span className="flex flex-col items-start"><StatusLabel status={x.status} />{pending.has(x.id) && <span className="text-[12px] leading-4 text-stone-500">Pending check</span>}</span>,
    },
    // only in "All": under Required / Additional it would repeat the filter
    ...(which === 'all' ? [{ key: 'importance', label: 'Importance', width: 136, sort: { value: (x) => IMP_RANK[x.importance], first: 'asc', tie: (x) => x.name }, csv: (x) => IMPORTANCE[x.importance], cell: (x) => <span className={`text-[13px] leading-[18px] ${t2}`}>{IMPORTANCE[x.importance]}</span> }] : []),
    {
      // fixed grid, so every bar starts at the same x: [count 112px][coverage bar 96px]; the where-label is the tooltip
      key: 'usedOn', label: 'Used on', width: 244, sort: { value: (x) => x.found.length / x.applicable, first: 'asc', tie: (x) => x.name }, csv: (x) => `${x.found.length} of ${x.applicable} (${x.usedOn})`,
      cell: (x) => {
        const n = x.found.length, of = x.applicable, miss = of - n
        return (
          <span className="grid grid-cols-[112px_96px] items-center gap-3" title={x.usedOn}>
            <span className="min-w-0">
              <span className="block whitespace-nowrap text-[14px] leading-5 text-stone-900 tabular-nums">{n} of {of} {of === 1 ? 'page' : 'pages'}</span>
              {miss > 0 && <span className="block text-[12px] leading-4 text-negative tabular-nums">{miss} missing</span>}
            </span>
            {miss > 0 ? <Bar value={(n / of) * 100} className="h-1.5 w-full" /> : <span aria-hidden />}
          </span>
        )
      },
    },
    {
      key: 'issues', label: 'Issues', width: 144, sort: { value: (x) => x.warnings.length, first: 'desc', tie: (x) => x.name }, csv: (x) => x.warnings.map(([w]) => w).join('; ') || 'None',
      stopRowClick: true,
      cell: (x) => (x.warnings.length ? (
        <button type="button" onClick={() => openSchema(x.id, 'issues')} aria-label={`${x.name}: ${x.warnings.length} warnings. Show them`}
          className="-mx-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] leading-[18px] text-ink outline-none transition-colors duration-150 hover:bg-surface focus-visible:ring-2 focus-visible:ring-focus tabular-nums">
          <AlertTriangle size={14} className="shrink-0" aria-hidden />{x.warnings.length} {x.warnings.length === 1 ? 'warning' : 'warnings'}
        </button>
      ) : <span className={`text-[13px] leading-[18px] ${t3}`}>None</span>),
    },
    { key: 'open', label: '', width: 52, csv: false, cell: () => <ChevronRight size={14} className="ml-auto text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden /> },
  ]
  return (
    <PromptTable
      id="sd-schemas"
      rows={rows}
      columns={columns}
      filterKeys={['name', 'desc']}
      searchLabel="Search schemas"
      emptyQuery={(qq) => <>No schemas match “{qq}”</>}
      emptyMessage={type && which === 'all' && st === 'all' ? 'No schemas apply to this page type.' : 'No schemas match these filters'}
      onClearFilters={which !== 'all' || st !== 'all' || type ? () => setParams({ set: null, status: null, type: null }) : null}
      csvName={`structured-data-schemas-${new Date().toISOString().slice(0, 10)}.csv`}
      defaultSort={{ key: 'status', dir: 'asc' }}
      rowHeight="h-[52px]"
      rowHover="hover:bg-tint"
      pagination={false}
      resetKey={`${which}|${st}|${type}`}
      onRowClick={(x) => openSchema(x.id)}
      toolbar={({ search }) => (
        <div className="flex items-center gap-2">
          <Segmented label="Schema set" value={which} onChange={(v) => setParams({ set: v === 'all' ? null : v })} options={options} />
          {type && (
            <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-tint pl-2.5 pr-1 text-[13px] leading-[18px] font-medium text-stone-900">
              {KINDS[type]}
              <button type="button" aria-label={`Clear page type ${KINDS[type]}`} onClick={() => setParams({ type: null })}
                className="grid h-6 w-6 place-items-center rounded text-stone-500 outline-none transition-colors duration-150 hover:bg-surface hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><X size={12} aria-hidden /></button>
            </span>
          )}
          {search}
          <select aria-label="Status" value={st} onChange={(e) => setParams({ status: e.target.value === 'all' ? null : e.target.value })} className={selectCls}>
            <option value="all">All statuses</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      )}
    />
  )
}

// ---- Recommendations: Fix (broken markup) + Add (missing schemas). Rows span the card edge to edge, so no bleed.
const recRow = 'group flex w-full items-center gap-3 px-5 text-left outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus'
function RecRow({ s, pending }) {
  return (
    <li>
      <button type="button" onClick={() => openSchema(s.id)} className={`${recRow} h-16`}>
        <RecIcon s={s} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{s.name}</span>
          <span className={`block truncate text-[13px] leading-[18px] ${t2}`} title={s.why}>{s.kind === 'fix' ? whereLine(s) : s.why}</span>
        </span>
        <span className={`shrink-0 text-[13px] leading-[18px] ${t3} tabular-nums`}>{s.affected.length} {s.affected.length === 1 ? 'page' : 'pages'}</span>
        <ImpactMeter impact={s.impact} />
        {pending ? <PendingCheck /> : <ViewFix />}
      </button>
    </li>
  )
}

function RecommendationsTab({ r }) {
  const pending = usePending()
  return (
    <>
      <section aria-labelledby="sd-fix">
        <h2 id="sd-fix" className="text-[14px] leading-5 font-semibold text-stone-900">Fix <span className="font-normal text-stone-500 tabular-nums">{r.fix.length}</span></h2>
        <Card className="mt-2 overflow-hidden">
          {r.fix.length === 0 ? (
            <p className="flex h-12 items-center gap-2 px-5 text-[14px] leading-5 text-stone-900">
              <Check size={16} className="shrink-0 text-ink" aria-hidden />No broken schemas. Everything on your pages passes validation.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--div)]">{r.fix.map((s) => <RecRow key={s.id} s={s} pending={pending.has(s.id)} />)}</ul>
          )}
        </Card>
      </section>

      <section aria-labelledby="sd-add" className="mt-4">
        <h2 id="sd-add" className="text-[14px] leading-5 font-semibold text-stone-900">Add <span className="font-normal text-stone-500 tabular-nums">{r.toAdd.length}</span></h2>
        <Card className="mt-2 overflow-hidden">
          {r.toAdd.length === 0 ? (
            <p className="flex h-12 items-center gap-2 px-5 text-[14px] leading-5 text-stone-900"><Check size={16} className="shrink-0 text-ink" aria-hidden />Everything required is in place.</p>
          ) : (
            <ul className="divide-y divide-[var(--div)]">{r.toAdd.map((s) => <RecRow key={s.id} s={s} pending={pending.has(s.id)} />)}</ul>
          )}
        </Card>
      </section>
    </>
  )
}

// ---- Client report: a self-contained HTML summary to send on
function downloadReport(r, page) {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const scope = page ? page.path : `${r.pageCount} pages`
  const row = (s) => `<tr><td>${esc(s.name)}</td><td>${STATUS[s.status]}</td><td>${IMPORTANCE[s.importance]}</td><td>${s.found.length} of ${s.applicable}</td></tr>`
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Structured data report · ${SD.domain}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;color:#171412;max-width:760px;margin:40px auto;padding:0 16px}h1{font-size:26px;margin:0}p{color:#57534e}
.kpis{display:flex;gap:32px;margin:24px 0}.kpis b{display:block;font-size:28px}table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;padding:8px;border-bottom:1px solid #e7e5e4}</style></head>
<body><h1>Structured data · ${SD.domain}</h1><p>${esc(scope)} · ${new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })} · Detected as ${SD.detected.join(' and ')}</p>
<div class="kpis"><div><b>${r.score}/100</b>Score (${r.scoreLabel})</div><div><b>${r.coverage}%</b>Schema coverage</div><div><b>${r.fullyValid} of ${r.pageCount}</b>Pages fully valid</div><div><b>${r.critical + r.warnings}</b>${r.critical} critical · ${r.warnings} warnings</div></div>
<h2>What to do next</h2><ul>${[...r.fix.map((s) => `<li>Fix ${esc(s.name)}: ${pagesLine(s)}</li>`), ...r.toAdd.map((s) => `<li>Add ${esc(s.name)}: ${pagesLine(s)}</li>`)].join('') || '<li>Everything required is in place.</li>'}</ul>
<h2>Schemas</h2><table><thead><tr><th>Schema</th><th>Status</th><th>Importance</th><th>Pages</th></tr></thead><tbody>${r.rows.map(row).join('')}</tbody></table></body></html>`
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  a.download = `structured-data-report-${new Date().toISOString().slice(0, 10)}.html`
  a.click()
  URL.revokeObjectURL(a.href)
}
