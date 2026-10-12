import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, ChevronDown, ChevronRight, Info, Plus, PlusCircle, RefreshCw, Share2, X, XCircle } from 'lucide-react'
import Card from '../dashboard/Card'
import PromptTable from '../dashboard/PromptTable'
import Segmented from '../dashboard/Segmented'
import Modal from '../ui/Modal'
import { useToast } from '../dashboard/overlays'
import { downloadCsv } from '../dashboard/csv'
import ActionMenu from '../audit/ActionMenu'
import { ImpactMeter, openDrawer, setParams, useTab } from '../audit/parts'
import SchemaDrawer, { setSchemaSection } from './SchemaDrawer'
import { StatusIcon, StatusLabel, pagesLine } from './parts'
import { IMPORTANCE, KINDS, PAGE_COUNT, SD, STATUS, analyze, isPageType, pageFor, schemas } from '../../data/structuredData'
import ErrorBoundary from '../ui/ErrorBoundary'

// /structured-data — "Structured Data": which schema.org types the site publishes and what to add.
// Same system as /audit: header, scope bar (?scope=page&url=), underline tabs (?tab=), rows → Schema drawer (?schema=).
// Graphite only; --negative marks Invalid / critical and nothing else. Bars are ink on --data-track.
const t2 = 'text-stone-600'
const t3 = 'text-stone-500'
const TAB_IDS = ['overview', 'schemas', 'recommendations', 'settings']
const SETTINGS_KEY = 'kraffic:structured-data:settings'
const selectCls = 'h-9 rounded-lg border border-line bg-raised px-2.5 text-small font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus'
const inkBtn = 'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-ink px-3.5 text-small font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-60'
const lineBtn = 'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-line px-3 text-small font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
const today = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
// section: 'issues' scrolls the drawer to its Issues section once it's open
const openSchema = (id, section) => { setSchemaSection(section); openDrawer('schema', id) }
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
        {tab === 'settings' ? <SettingsTab onRun={rerun} running={running} />
          : !result ? (
            <Card className="px-5 py-10 text-center">
              <p className={`text-[14px] leading-5 ${t2}`}>{page?.error ?? `Enter a page on ${SD.domain} above and press Analyze.`}</p>
            </Card>
          ) : tab === 'overview' ? <Overview r={result} setTab={setTab} />
            : tab === 'schemas' ? <SchemasTab r={typeResult ?? result} type={type} set={q.get('set')} status={q.get('status')} />
              : <RecommendationsTab r={result} />}
        </ErrorBoundary>
      </div>

      <HowModal open={howOpen} onClose={() => setHowOpen(false)} />
      <ErrorBoundary name="Schema drawer" floating><SchemaDrawer rows={result?.rows} /></ErrorBoundary>
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
const Sub = ({ children }) => <div className={`mt-1 text-[13px] leading-[18px] ${t2} tabular-nums`}>{children}</div>
const cardTitle = 'text-[15px] leading-5 font-semibold text-stone-900'
const linkCls = 'inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus'
// "Missing on 8 pages · Product pages"
const whereLine = (s) => [pagesLine(s), s.kinds.join(', ')].filter(Boolean).join(' · ')
const STATUS_BAR = [
  ['valid', 'Valid', 'var(--ink)'],
  ['invalid', 'Invalid', 'var(--negative)'],
  ['missing', 'Missing', 'var(--data-c1)'],
  ['irrelevant', 'Not relevant', 'var(--data-track)'],
]
// the status grid: problems first, then A→Z
const STATUS_ORDER = { invalid: 0, missing: 1, valid: 2 }

function Overview({ r, setTab }) {
  const next = [...r.fix.map((s) => ({ s, verb: 'Fix' })), ...r.toAdd.map((s) => ({ s, verb: 'Add' }))].slice(0, 4)
  const req = r.required
  const total = schemas.length
  const counts = { valid: 0, invalid: 0, missing: 0, irrelevant: r.notRelevant }
  r.rows.forEach((x) => { counts[x.status]++ })
  const relevant = [...r.rows].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name))

  return (
    <>
      {/* KPI strip: four columns, dividers, no title */}
      <Card className="p-5">
        <div className="grid grid-cols-2 gap-y-4 md:grid-cols-4 md:divide-x md:divide-[var(--div)]">
          <Kpi label="Required schemas" first>
            <Big>{req.total ? `${Math.round((req.valid * 100) / req.total)}%` : '—'}</Big>
            <Sub>{req.total ? `${req.valid} of ${req.total} valid` : 'None apply here'}</Sub>
          </Kpi>
          <Kpi label="Schema coverage">
            <Big>{r.coverage}%</Big>
            <Bar value={r.coverage} className="mt-2 h-1.5 w-full" />
            <Sub>across {r.pageCount} {r.pageCount === 1 ? 'page' : 'pages'}</Sub>
          </Kpi>
          <Kpi label="Pages fully valid">
            <Big>{r.fullyValid}</Big>
            <Bar value={(r.fullyValid / r.pageCount) * 100} className="mt-2 h-1.5 w-full" />
            <Sub>of {r.pageCount}</Sub>
          </Kpi>
          <Kpi label="Warnings">
            <Big>{r.warnings}</Big>
            <Sub><span className={r.critical ? 'text-negative' : undefined}>{r.critical} critical</span></Sub>
          </Kpi>
        </div>
      </Card>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[7fr_5fr]">
        <Card className="flex min-w-0 flex-col p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className={cardTitle}>What to do next</h2>
            <button type="button" onClick={() => setTab('recommendations')} className={linkCls}>View all <ArrowRight size={14} aria-hidden /></button>
          </div>
          {next.length === 0 ? (
            <p className="mt-3 flex h-14 items-center gap-2 text-[14px] leading-5 text-stone-900"><Check size={16} className="text-ink" aria-hidden />Everything required is in place.</p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--div)]">
              {next.map(({ s, verb }) => (
                <li key={s.id} className="flex h-14 items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-tint" aria-hidden>
                    {verb === 'Fix' ? <XCircle size={16} className="text-negative" /> : <Plus size={16} className="text-stone-900" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{verb} {s.name} schema</span>
                    <span className={`block truncate text-[13px] leading-[18px] ${t3} tabular-nums`}>{whereLine(s)}</span>
                  </span>
                  <ImpactMeter impact={s.impact} />
                  <button type="button" onClick={() => openSchema(s.id)}
                    className="-mr-2 inline-flex h-8 shrink-0 items-center rounded-md px-2 text-[13px] leading-[18px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
                    View fix
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex min-w-0 flex-col p-5">
          <h2 className={cardTitle}>Coverage by page type</h2>
          <ul className="mt-2 flex flex-col">
            {r.byKind.map((k) => (
              <li key={k.kind}>
                <button type="button" onClick={() => setTab('schemas', { type: k.kind, set: null, status: null })} aria-label={`${k.label}: ${k.coverage}% coverage across ${k.pages} pages. View schemas`}
                  className="group -mx-2 flex h-10 w-[calc(100%+16px)] cursor-pointer items-center gap-3 rounded-md px-2 text-left outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-focus">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-[14px] leading-5 text-stone-900">{k.label}</span>
                    <span className={`ml-2 text-[13px] leading-[18px] ${t3} tabular-nums`}>{k.pages} {k.pages === 1 ? 'page' : 'pages'}</span>
                  </span>
                  <Bar value={k.coverage} className="h-1.5 w-28 shrink-0" />
                  <span className="w-10 shrink-0 text-right text-[13px] leading-[18px] font-semibold text-stone-900 tabular-nums">{k.coverage}%</span>
                  <ChevronRight size={14} className="-ml-1 shrink-0 text-stone-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className={cardTitle}>Schema status</h2>
        <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--data-track)]" role="img"
          aria-label={STATUS_BAR.map(([k, label]) => `${label} ${counts[k]}`).join(', ')}>
          {STATUS_BAR.filter(([k]) => counts[k]).map(([k, , color], i) => (
            <span key={k} className={`h-full ${i ? 'ml-px' : ''}`} style={{ width: `${(counts[k] / total) * 100}%`, background: color }} />
          ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5">
          {STATUS_BAR.map(([k, label, color]) => (
            <li key={k} className={`flex items-center gap-1.5 text-[13px] leading-[18px] ${t2} tabular-nums`}>
              <span className={`h-2 w-2 shrink-0 rounded-full ${k === 'irrelevant' ? 'border border-line' : ''}`} style={{ background: color }} aria-hidden />
              {label}<span className="font-medium text-stone-900">{counts[k]}</span>
            </li>
          ))}
        </ul>

        <ul className="mt-4 grid grid-cols-1 gap-x-6 border-t border-[var(--div)] pt-2 sm:grid-cols-2 lg:grid-cols-3">
          {relevant.map((x) => {
            const n = x.status === 'valid' ? x.found.length : x.status === 'invalid' ? x.invalid.length : x.missing.length
            const what = x.status === 'valid' ? (n === 1 ? 'page' : 'pages') : x.status === 'invalid' ? 'invalid' : 'missing'
            return (
              <li key={x.id}>
                <button type="button" onClick={() => openSchema(x.id)} aria-label={`${x.name}: ${STATUS[x.status]}, ${pagesLine(x)}`}
                  className="group -mx-2 flex h-10 w-[calc(100%+16px)] items-center gap-2.5 rounded-lg px-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus">
                  <StatusIcon status={x.status} />
                  <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-stone-900">{x.name}</span>
                  <span className={`shrink-0 text-[13px] leading-[18px] ${t3} tabular-nums`}>{n} {what}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-2 border-t border-[var(--div)] pt-3">
          <button type="button" onClick={() => setTab('schemas')} className={linkCls}>View all {r.rows.length} schemas <ArrowRight size={14} aria-hidden /></button>
        </div>
      </Card>
    </>
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
    { key: 'status', label: 'Status', width: 128, sort: { value: (x) => ST_RANK[x.status], first: 'asc', tie: (x) => x.name }, csv: (x) => STATUS[x.status], cell: (x) => <StatusLabel status={x.status} /> },
    // only in "All": under Required / Additional it would repeat the filter
    ...(which === 'all' ? [{ key: 'importance', label: 'Importance', width: 136, sort: { value: (x) => IMP_RANK[x.importance], first: 'asc', tie: (x) => x.name }, csv: (x) => IMPORTANCE[x.importance], cell: (x) => <span className={`text-[13px] leading-[18px] ${t2}`}>{IMPORTANCE[x.importance]}</span> }] : []),
    {
      key: 'usedOn', label: 'Used on', width: 224, sort: { value: (x) => x.usedOn, first: 'asc', tie: (x) => x.name }, csv: (x) => `${x.usedOn} (${x.applicable})`,
      cell: (x) => {
        const gap = x.status === 'invalid' ? x.invalid.length : x.missing.length
        return (
          <span className="block min-w-0 tabular-nums">
            {/* filtered to one page type: that type's numbers ("17 of 20 pages") */}
            {type ? (
              <span className="flex items-center gap-2 text-[14px] leading-5 text-stone-900">
                {x.found.length} of {x.applicable} {x.applicable === 1 ? 'page' : 'pages'}
                {gap > 0 && <MissingBar gap={gap} of={x.applicable} />}
              </span>
            ) : (
            <span className="block truncate text-[14px] leading-5 text-stone-900">
              {x.usedOn}{x.applicable > 1 && <span className={`text-[13px] ${t3}`}> · {x.applicable}</span>}
            </span>
            )}
            {/* incomplete coverage only: how much is missing, with the missing share in --negative */}
            {!type && gap > 0 && (
              <span className="flex items-center gap-2 text-[13px] leading-[18px] text-ink">
                {gap} of {x.applicable} {x.status === 'invalid' ? 'invalid' : 'missing'}
                <MissingBar gap={gap} of={x.applicable} />
              </span>
            )}
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

// the missing share of a schema's pages, in --negative
const MissingBar = ({ gap, of }) => (
  <span className="h-1 w-20 shrink-0 overflow-hidden rounded-full bg-[var(--data-track)]" aria-hidden>
    <span className="block h-full rounded-full bg-negative" style={{ width: `${(gap / of) * 100}%` }} />
  </span>
)

// ---- Recommendations: Fix (broken markup) + Add (missing schemas)
function RecommendationsTab({ r }) {
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
            <ul className="divide-y divide-[var(--div)]">
              {r.fix.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => openSchema(s.id)}
                    className="group flex h-[52px] w-full items-center gap-3 px-5 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{s.name}</span>
                      <span className={`block truncate text-[12.5px] leading-[18px] ${t3}`}>{s.desc}</span>
                    </span>
                    <span className="w-28 shrink-0"><StatusLabel status={s.status} /></span>
                    <span className={`w-36 shrink-0 text-[13px] leading-[18px] ${t2} tabular-nums`}>{pagesLine(s)}</span>
                    <ChevronRight size={14} className="shrink-0 text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section aria-labelledby="sd-add" className="mt-4">
        <h2 id="sd-add" className="text-[14px] leading-5 font-semibold text-stone-900">Add <span className="font-normal text-stone-500 tabular-nums">{r.toAdd.length}</span></h2>
        <Card className="mt-2 overflow-hidden">
          {r.toAdd.length === 0 ? (
            <p className="flex h-12 items-center gap-2 px-5 text-[14px] leading-5 text-stone-900"><Check size={16} className="shrink-0 text-ink" aria-hidden />Everything required is in place.</p>
          ) : (
            <ul className="divide-y divide-[var(--div)]">
              {r.toAdd.map((s) => (
                <li key={s.id} className="flex h-14 items-center gap-3 px-5">
                  <PlusCircle size={16} className="shrink-0 text-stone-600" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{s.name}</span>
                    <span className={`block truncate text-[13px] leading-[18px] ${t2}`} title={s.why}>{s.why}</span>
                  </span>
                  <span className={`shrink-0 text-[13px] leading-[18px] ${t3} tabular-nums`}>{s.missing.length} {s.missing.length === 1 ? 'page' : 'pages'}</span>
                  <button type="button" onClick={() => openSchema(s.id)}
                    className="-mr-2 inline-flex h-8 shrink-0 items-center rounded-md px-2 text-[13px] leading-[18px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
                    View fix
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </>
  )
}

// ---- Settings (same row style as /tracking)
function readSettings() {
  try { return { sitemap: '', maxPages: 50, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') } } catch { return { sitemap: '', maxPages: 50 } }
}
const Saved = ({ show }) => (
  <span aria-live="polite" className={`inline-flex items-center gap-1 text-[12px] leading-4 text-stone-600 transition-opacity duration-200 ease-out ${show ? 'opacity-100' : 'opacity-0'}`}>
    {show && <><Check size={12} aria-hidden /> Saved</>}
  </span>
)
function SettingRow({ name, meta, saved, children }) {
  return (
    <li className="flex h-[60px] items-center justify-between gap-4 px-5">
      <span className="min-w-0">
        <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{name}</span>
        <span className={`block truncate text-[12.5px] leading-[18px] ${t2}`}>{meta}</span>
      </span>
      <span className="flex shrink-0 items-center gap-3"><Saved show={saved} />{children}</span>
    </li>
  )
}
function SettingsTab({ onRun, running }) {
  const [s, setS] = useState(readSettings)
  const [saved, setSaved] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const save = (patch, key) => {
    const next = { ...s, ...patch }
    setS(next)
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)) } catch { /* private mode: keep it for this visit */ }
    setSaved(key); clearTimeout(timer.current); timer.current = setTimeout(() => setSaved(null), 1500)
  }
  return (
    <section aria-label="Crawl settings" className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <header className="border-b border-[var(--div)] px-5 pb-3.5 pt-[18px]">
        <h2 className="text-[15px] leading-5 font-semibold text-stone-900">Crawl settings</h2>
        <p className={`mt-0.5 text-[13px] leading-[18px] ${t2}`}>How Kraffic finds the pages to analyze. Changes apply on the next run.</p>
      </header>
      <ul className="divide-y divide-[var(--div)]">
        <SettingRow name="Sitemap URL" meta="Only used if robots.txt has no sitemap" saved={saved === 'sitemap'}>
          <input aria-label="Sitemap URL" defaultValue={s.sitemap} placeholder={`https://${SD.domain}/sitemap.xml`}
            onBlur={(e) => { if (e.target.value.trim() !== s.sitemap) save({ sitemap: e.target.value.trim() }, 'sitemap') }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            className="h-9 w-80 rounded-lg border border-line bg-raised px-3 text-small text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-400" />
        </SettingRow>
        <SettingRow name="Max pages" meta="The crawl stops after this many pages" saved={saved === 'max'}>
          <select aria-label="Max pages" value={s.maxPages} onChange={(e) => save({ maxPages: Number(e.target.value) }, 'max')} className={selectCls}>
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </SettingRow>
      </ul>
      <div className="flex justify-end bg-tint px-5 py-3">
        <button type="button" onClick={onRun} disabled={running} className={inkBtn}>
          <RefreshCw size={14} className={running ? 'animate-[spin_600ms_linear_infinite] motion-reduce:animate-none' : undefined} aria-hidden />Re-run audit
        </button>
      </div>
    </section>
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
