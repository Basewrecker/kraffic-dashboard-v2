import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '../../hooks/useMedia'
import { AlertCircle, AlertTriangle, ArrowRight, Braces, Check, ChevronDown, ChevronRight, CircleDashed, Copy, Download, FileText, Info, Plus, RefreshCw, Share2, X, XCircle } from 'lucide-react'
import Card from '../dashboard/Card'
import PromptTable from '../dashboard/PromptTable'
import Segmented from '../dashboard/Segmented'
import Modal from '../ui/Modal'
import { useToast } from '../dashboard/overlays'
import { downloadCsv } from '../dashboard/csv'
import ActionMenu from '../audit/ActionMenu'
import MobileActions from '../ui/MobileActions'
import { ImpactMeter, RowIcon, ViewFix, openDrawer, rowBtn, setParams, useTab } from '../audit/parts'
import SchemaDrawer, { setSchemaSection } from './SchemaDrawer'
import SettingsTab, { crawlSettings } from './SettingsTab'
import DrawerShell, { useDrawer } from '../audit/DrawerShell'
import SchemaRing, { RING_COLORS } from './SchemaRing'
import { saveSettings, useSettings } from './settings'
import { PendingCheck, StatusIcon, StatusLabel, pagesLine, usePending } from './parts'
import { SD, crawlActions } from '../../data/structuredData'
import { account } from '../../data/mock'
import FeatureOff from '../ui/FeatureOff'
import { IMPORTANCE, KINDS, PAGE_COUNT, STATUS, analyze, isPageType, pageFor } from './analyze'
import ErrorBoundary from '../ui/ErrorBoundary'
import ActionSteps, { fmtMin, orderSteps } from '../ui/ActionSteps'

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
  // Settings: only when the backend saves 2 or more crawl settings besides Pages to crawl
  const hasSettings = crawlSettings().length >= 2
  const tabIds = hasSettings ? TAB_IDS : TAB_IDS.filter((id) => id !== 'settings')
  const [tab, setTab, q] = useTab(tabIds)
  const tabsRef = useRef(null)
  useEffect(() => { tabsRef.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }, [tab])
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
  const [lastRun, setLastRun] = useState(SD.lastRun ?? null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState(null)
  const [howOpen, setHowOpen] = useState(false)
  const [toastNode, toast] = useToast({ position: 'center' })
  const settings = useSettings()
  // Re-run / Run crawl: a new crawl with the Settings' page limit; running and failed states show in the header
  const rerun = () => {
    if (running) return
    setRunning(true)
    setRunError(null)
    crawlActions.onRunCrawl({ maxPages: settings.maxPages })
      .then((res) => { setLastRun(res?.lastRun ?? { ...lastRun, date: today() }); toast(`Crawl finished · ${res?.lastRun?.pages ?? PAGE_COUNT} pages`) })
      .catch((err) => setRunError(err?.message || 'The crawl couldn’t finish.'))
      .finally(() => setRunning(false))
  }
  // "50 pages · 2 errors · last run Oct 12": errors only when there are some (negative; a list opens the failed pages)
  const failed = lastRun?.failed ?? null
  const errors = failed?.length ?? lastRun?.errors ?? 0
  const errorsCls = 'rounded text-negative outline-none focus-visible:ring-2 focus-visible:ring-focus'
  const on = account.features.structuredData // off: no run line, actions or results, only FeatureOff
  const runLine = running
    ? <span className="inline-flex items-center gap-1.5"><RefreshCw size={13} className="animate-[spin_600ms_linear_infinite] motion-reduce:animate-none" aria-hidden />Crawling… this can take a few minutes</span>
    : lastRun?.date ? (
      <>
        {lastRun.pages ?? PAGE_COUNT} pages
        {errors > 0 && <> · {failed?.length
          ? <button type="button" onClick={() => openDrawer('crawl', 'errors')} className={`${errorsCls} underline-offset-4 hover:underline`}>{errors} {errors === 1 ? 'error' : 'errors'}</button>
          : <span className="text-negative">{errors} {errors === 1 ? 'error' : 'errors'}</span>}</>}
        {' '}· last run {lastRun.date}
      </>
    ) : null
  // Pages to crawl: saved with the page's settings, sent with the next run
  const setMaxPages = (n) => { if (n !== settings.maxPages) { saveSettings({ maxPages: n }); toast(`Next run crawls up to ${n} pages`) } }
  // a failed crawl: the reason (it can be long) on its own line under the subtitle, with Retry
  const failLine = !running && runError && (
    <p role="alert" className="mt-2 text-[13px] leading-[18px] text-negative">
      Crawl failed: {runError}{' '}
      <button type="button" onClick={rerun} className="ml-1 rounded font-medium text-ink underline underline-offset-4 outline-none hover:opacity-75 focus-visible:ring-2 focus-visible:ring-focus">Retry</button>
    </p>
  )
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
  const tabs = [['overview', 'Overview'], ['schemas', 'Schemas'], ['recommendations', 'Recommendations'], ['settings', 'Settings']].filter(([id]) => tabIds.includes(id))
  const tabKeys = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const next = tabIds[(tabIds.indexOf(tab) + step + tabIds.length) % tabIds.length]
    setTab(next, { set: null, status: null, type: null })
    requestAnimationFrame(() => document.querySelector(`[data-sd-tab="${next}"]`)?.focus())
  }

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">Structured Data</h1>
            <button type="button" onClick={() => setHowOpen(true)} aria-label="How this analysis works" title="How this analysis works"
              className="grid h-7 w-7 place-items-center rounded-md text-stone-500 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
              <Info size={16} aria-hidden />
            </button>
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-[18px] text-stone-600 lg:text-[14px] lg:leading-5">Which schemas Google and AI engines can read on {SD.domain}</p>
          {on && runLine && <p className={`mt-1 text-[13px] leading-[18px] ${t3} tabular-nums lg:hidden`}>{runLine}</p>}
          {on && SD.crawled && failLine}
        </div>
        <div className="flex shrink-0 items-center gap-2 lg:pt-1">
          {on && runLine && <span className={`mr-1 hidden whitespace-nowrap lg:inline text-[13px] leading-[18px] ${t3} tabular-nums`}>{runLine}</span>}
          {/* nothing to export or share before the first crawl */}
          {on && SD.crawled && <span className="hidden items-center gap-2 lg:flex">
            <ActionMenu label="Export" items={[{ label: 'CSV', onClick: exportCsv }, { label: 'Client report', onClick: exportReport }]} className={lineBtn}>
              Export <ChevronDown size={14} className="text-stone-500" aria-hidden />
            </ActionMenu>
            <button type="button" onClick={share} className={lineBtn}><Share2 size={14} aria-hidden />Share</button>
          </span>}
          {/* Re-run + its menu: how many pages the next run crawls */}
          {on && SD.crawled && (
            <span className="flex max-lg:h-10 max-lg:flex-1">
              <button type="button" onClick={rerun} disabled={running} className={`${inkBtn} justify-center rounded-r-none max-lg:h-10 max-lg:flex-1`}>
                <RefreshCw size={14} className={running ? 'animate-[spin_600ms_linear_infinite] motion-reduce:animate-none' : undefined} aria-hidden />Re-run
              </button>
              <ActionMenu label="Pages to crawl" heading="Pages to crawl" items={[25, 50, 100, 200].map((n) => ({ label: `${n} pages`, checked: settings.maxPages === n, onClick: () => setMaxPages(n) }))}
                className={`${inkBtn} h-9 rounded-l-none border-l border-[color-mix(in_srgb,var(--on-ink)_20%,transparent)] px-2 max-lg:h-10`}>
                <ChevronDown size={14} aria-hidden />
              </ActionMenu>
            </span>
          )}
          {on && SD.crawled && <MobileActions items={[
            { label: 'Export CSV', icon: Download, onClick: exportCsv },
            { label: 'Client report', icon: FileText, onClick: exportReport },
            { label: 'Share link', icon: Share2, onClick: share },
          ]} />}
        </div>
      </div>

      {!on ? (
        <FeatureOff name="Structured Data" what={`It reads which schemas Google and AI engines can find on ${SD.domain}’s pages.`} />
      ) : !SD.crawled ? (
        // never crawled: nothing to analyze yet
        <Card className="mt-2 flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-tint text-stone-600" aria-hidden><Braces size={18} /></span>
          <h2 className="text-title font-semibold text-stone-900">This site hasn’t been crawled yet</h2>
          <p className={`max-w-md text-[14px] leading-5 ${t2}`}>A crawl reads the structured data on {SD.domain}’s pages. The results show here when it finishes.</p>
          <button type="button" onClick={rerun} disabled={running} className={`${inkBtn} mt-1`}>
            <RefreshCw size={14} className={running ? 'animate-[spin_600ms_linear_infinite] motion-reduce:animate-none' : undefined} aria-hidden />{running ? 'Crawling…' : 'Run crawl'}
          </button>
          {runLine && <p className={`text-[13px] leading-[18px] ${t3}`}>{runLine}</p>}
          {failLine}
        </Card>
      ) : (<>
      {/* tabs, with the scope toggle on the same row (right) */}
      {/* phones: tabs scroll sideways edge to edge; the scope toggle gets its own row under them */}
      <div className="mt-2 flex items-end justify-between gap-4 border-b border-line max-md:-mx-4 max-md:px-4">
      <div role="tablist" aria-label="Structured Data" onKeyDown={tabKeys} ref={tabsRef} className="no-scrollbar flex snap-x gap-6 overflow-x-auto max-md:-mr-4 max-md:pr-4">
        {tabs.map(([id, label]) => (
          <button key={id} data-sd-tab={id} type="button" role="tab" id={`sd-tab-${id}`} aria-controls="sd-panel" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id, { set: null, status: null, type: null })}
            className={`-mb-px inline-flex h-11 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap border-b-2 text-[14px] leading-5 font-medium outline-none md:h-10 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${tab === id ? 'border-ink text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900'}`}>
            {label}{counts[id] != null && <span className="text-[13px] leading-[18px] font-normal text-stone-500 tabular-nums">{counts[id]}</span>}
          </button>
        ))}
      </div>
        <div className="mb-1 hidden shrink-0 md:block"><ScopeToggle scope={scope} url={url} /></div>
      </div>
      <div className="md:hidden"><ScopeToggle scope={scope} url={url} full /></div>
      {scope === 'page' && <UrlRow url={url} error={page?.error} />}

      <div id="sd-panel" role="tabpanel" aria-labelledby={`sd-tab-${tab}`} className="mt-2 flex flex-col gap-4">
        <ErrorBoundary resetKey={`${tab}|${scope}|${url}|${type}`} name={`Structured Data · ${tab}`}>
        {tab === 'settings' ? <SettingsTab />
          : !result ? (
            <Card className="px-5 py-10 text-center">
              <p className={`text-[14px] leading-5 ${t2}`}>{page?.error ?? `Enter a page on ${SD.domain} above and press Analyze.`}</p>
            </Card>
          ) : tab === 'overview' ? <Overview r={result} setTab={setTab} site={scope === 'site'} />
            : tab === 'schemas' ? <SchemasTab r={typeResult ?? result} type={type} set={q.get('set')} status={q.get('status')} />
              : <RecommendationsTab r={result} />}
        </ErrorBoundary>
      </div>
      </>)}

      <HowModal open={howOpen} onClose={() => setHowOpen(false)} />
      {failed?.length > 0 && <CrawlErrors failed={failed} date={lastRun.date} />}
      <ErrorBoundary name="Schema drawer" floating><SchemaDrawer result={result} scope={scope} /></ErrorBoundary>
      {toastNode}
    </>
  )
}

// ---- scope: whole site, or one page typed in (the toggle sits on the tabs row; the URL row opens under the tabs)
function ScopeToggle({ scope, url, full = false }) {
  const setScope = (v) => {
    setParams({ scope: v === 'page' ? 'page' : null, url: v === 'page' ? url || null : null })
    if (v === 'page') requestAnimationFrame(() => document.getElementById('sd-url')?.focus())
  }
  return <Segmented size={full ? 'md' : 'sm'} full={full} label="Scope" value={scope} onChange={setScope} options={[{ value: 'site', label: 'Whole site' }, { value: 'page', label: 'One page' }]} />
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
const actionOf = (s) => s.action ?? (s.kind === 'fix' ? `Fix ${s.name}` : `Add ${s.name} schema`)
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

function Overview({ r, setTab, site }) {
  const prev = SD.previous // null: no earlier run to compare with, so no change lines
  const reqPct = r.required.total ? Math.round((r.required.valid * 100) / r.required.total) : null
  return (
    <>
      {/* KPI strip: numbers and how they moved since the last run */}
      <Card className="p-5">
        <div className="kpi-grid grid grid-cols-2 gap-y-4 md:grid-cols-4 md:divide-x md:divide-[var(--div)]">
          <Kpi label="Required schemas" first>
            <Big>{reqPct == null ? '—' : `${reqPct}%`}</Big>
            <div className="mt-1 text-[13px] leading-[18px] tabular-nums">{reqPct == null ? <span className={t3}>None apply here</span> : site && prev ? <Change now={reqPct} before={prev.required} /> : site ? null : <span className={t2}>{r.required.valid} of {r.required.total} valid</span>}</div>
          </Kpi>
          <Kpi label="Schema coverage">
            <Big>{r.coverage}%</Big>
            <div className="mt-1 text-[13px] leading-[18px] tabular-nums">{site ? (prev && <Change now={r.coverage} before={prev.coverage} />) : <span className={t2}>across this page</span>}</div>
          </Kpi>
          <Kpi label="Pages fully valid">
            <div className="flex items-baseline gap-1.5"><Big>{r.fullyValid}</Big><span className={`text-[13px] leading-[18px] ${t3} tabular-nums`}>of {r.pageCount}</span></div>
            <div className="mt-1 text-[13px] leading-[18px] tabular-nums">{site ? (prev && <Change now={r.fullyValid} before={prev.fullyValid} />) : <span className={t3}>—</span>}</div>
          </Kpi>
          <Kpi label="Warnings">
            <Big>{r.warnings}</Big>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] leading-[18px] tabular-nums">
              {r.critical > 0 && <span className="text-negative">{r.critical} critical</span>}
              {site && prev && <Change now={r.warnings} before={prev.warnings} lowerIsBetter />}
              {r.warnings + r.critical > 0 && <button type="button" onClick={() => setTab('recommendations')} className={linkCls}>View</button>}
            </div>
          </Kpi>
        </div>
      </Card>

      <ActionPlan r={r} setTab={setTab} />

      <CoverageMap r={r} />

      <SchemaStatus r={r} setTab={setTab} />
    </>
  )
}

// ---- What to do next: a numbered plan, ordered by impact ÷ effort (quick wins first; a fix before an add on a tie).
// Where the app can save it, tick a step's number to mark it done; done steps sink to the end.
const PLAN_STEPS = 4
const DONE_KEY = `kraffic:structured-data:done:${SD.domain}`
const PAGE_WORD = { 'Product pages': 'product page', 'Blog posts': 'blog post', Collections: 'collection', Home: 'home page', Other: 'page' }
const pagesPhrase = (s) => {
  const n = s.affected.length
  const word = s.kinds.length === 1 ? PAGE_WORD[s.kinds[0]] ?? 'page' : 'page'
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
const readDone = () => { try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]')) } catch { return new Set() } }

function ActionPlan({ r, setTab }) {
  const [done, setDone] = useState(() => (crawlActions.canMarkDone ? readDone() : new Set()))
  const [toastNode, toast] = useToast({ position: 'center' })
  const items = new Map([...r.fix, ...r.toAdd].map((s) => [s.id, s]))
  // the top steps of one list ordered by impact ÷ effort (ActionSteps' orderSteps)
  const plan = orderSteps([...items.values()].map((s) => {
    const status = s.kind === 'fix' ? (s.level === 'error' ? ['Error', 'shrink-0 text-negative'] : ['Warning', `shrink-0 ${t2}`]) : ['Missing', `shrink-0 ${t3}`]
    return { id: s.id, kind: s.kind === 'fix' ? 'fix' : 'add', title: actionOf(s), chip: s.kind === 'fix' ? s.type : s.name, chipMono: true, meta: [pagesPhrase(s), status], impact: s.impact, minutes: s.effort ?? 30 }
  })).slice(0, PLAN_STEPS)
  const open = plan.filter((s) => !done.has(s.id))
  const total = open.reduce((n, s) => n + s.minutes, 0)
  const all = r.fix.length + r.toAdd.length
  const toggle = (s) => {
    const next = new Set(done)
    const was = next.has(s.id)
    was ? next.delete(s.id) : next.add(s.id)
    setDone(next)
    try { localStorage.setItem(DONE_KEY, JSON.stringify([...next])) } catch { /* private mode: this visit only */ }
    if (!was) toast('Marked done · we’ll verify on the next run')
  }

  return (
    <Card className="flex min-w-0 flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={cardTitle}>What to do next</h2>
          <p className={`mt-0.5 text-[13px] leading-[18px] ${t2} tabular-nums`}>
            {open.length ? `${open.length} ${open.length === 1 ? 'step' : 'steps'} · about ${fmtMin(total)} total` : 'All done. We’ll verify on the next run.'}
          </p>
        </div>
        <button type="button" onClick={() => setTab('recommendations')} className={`${linkCls} max-md:h-10`}>View all {all} <ArrowRight size={14} aria-hidden /></button>
      </div>
      {/* Mark done only where the app can save it */}
      <ActionSteps steps={plan} done={done} onMarkDone={crawlActions.canMarkDone ? toggle : undefined} onOpen={(s) => openSchema(s.id)} />
      {toastNode}
    </Card>
  )
}

// ---- Coverage map: the crawl's page types × the schemas found on the site or recommended for those page types
const lower = (name) => name.charAt(0).toLowerCase() + name.slice(1)

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
      onClick={() => openSchema(c.id, null, isPageType(group.id) ? { schemaType: group.id } : {})}
      className={`${area} outline-none focus-visible:ring-2 focus-visible:ring-focus`}>
      <Marker found={c.found} applies={c.applies} />
      <span className={`text-[13px] leading-[18px] ${c.found ? 'font-medium text-ink' : 'text-stone-500'}`}>{c.found}/{c.applies}</span>
    </button>
  )
}

function CoverageMap({ r }) {
  // a column per schema: when they don't fit, the matrix scrolls sideways under a sticky first column; the hint goes once you've scrolled
  const [scrolled, setScrolled] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const scroller = useRef(null)
  const MAP_COLS = r.mapColumns
  const groups = r.mapRows
  const cells = groups.map((g) => MAP_COLS.map(([id, short]) => ({ id, short, ...r.cellFor(id, g.pages) })))
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return undefined
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 4)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [MAP_COLS.length])
  // biggest gap: the cell with the most pages missing the schema
  let gap = null
  groups.forEach((g, gi) => cells[gi].forEach((c) => { const miss = c.applies - c.found; if (miss > 0 && (!gap || miss > gap.miss)) gap = { miss, short: c.short, where: lower(g.name) } }))
  return (
    <Card className="min-w-0 p-5">
      <h2 className={cardTitle}>Coverage map</h2>
      <div ref={scroller} className="no-scrollbar mt-4 overflow-x-auto max-md:-mx-4" onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 4)}>
        <table className="w-full table-fixed border-collapse" style={{ minWidth: 152 + MAP_COLS.length * 88 }}>
          <thead>
            <tr className="border-b border-[var(--div)]">
              <th className="sticky left-0 z-10 w-36 bg-surface text-left md:w-44"><span className="sr-only">Page type</span></th>
              {MAP_COLS.map(([id, short]) => (
                <th key={id} scope="col" className="w-[88px] px-1 pb-2 pt-1 text-center align-bottom text-[13px] leading-4 font-medium text-stone-600">
                  {/* long names break between words: OpeningHours·Specification */}
                  {short.split(/(?<=[a-z])(?=[A-Z])/).map((part, i) => <span key={i}>{i > 0 && <wbr />}{part}</span>)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g, gi) => (
              <tr key={g.id} className="h-11 border-b border-[var(--div)] transition-colors duration-150 last:border-0 hover:bg-[var(--tint)]">
                <th scope="row" className={`sticky left-0 z-10 truncate bg-surface pl-4 text-left text-[14px] leading-5 font-medium text-stone-900 transition-shadow duration-150 md:pl-2 ${scrolled ? 'shadow-[6px_0_8px_-6px_rgb(0_0_0/0.18)]' : ''}`} title={`${g.name} · ${g.pages.length} ${g.pages.length === 1 ? 'page' : 'pages'}`}>{g.name}</th>
                {cells[gi].map((c) => <td key={c.id} className="px-1"><MapCell c={c} short={c.short} group={g} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {overflows && !scrolled && <p className={`mt-2 text-[12px] leading-4 ${t3}`}><span className="md:hidden">Swipe</span><span className="max-md:hidden">Scroll sideways</span> to see more →</p>}
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
const pagesOf = (x) => (x.status === 'invalid' ? x.invalid.length : x.status === 'missing' ? x.missing.length : x.found.length)

const TABLE_ROWS = 7 // fits beside the ring column

function SchemaStatus({ r, setTab }) {
  const mobile = useIsMobile()
  const rank = (a, b) => IMP_ORDER[a.importance] - IMP_ORDER[b.importance] || pagesOf(b) - pagesOf(a)
  const by = Object.fromEntries(GROUPS.map((g) => [g.st, r.rows.filter((x) => x.status === g.st).sort(rank)]))
  const ring = GROUPS.flatMap((g) => by[g.st]) // clockwise from 12 o'clock
  // 'issues' (Invalid + Missing) by default; a legend row narrows it, clicking the active row again widens it back
  const [filter, setFilter] = useState('issues')
  const [pinned, setPinned] = useState(null) // the slice clicked in the ring: its row stays highlighted
  const [hover, setHover] = useState(null) // index into ring
  const [legendGroup, setLegendGroup] = useState(null)
  const tableRef = useRef(null)
  const issues = [...by.invalid, ...by.missing] // Invalid first, then Missing (each Required → Optional, then pages)
  const list = filter === 'issues' ? issues : by[filter]
  const label = filter === 'issues' ? 'Needs attention' : GROUPS.find((g) => g.st === filter).label
  const hovered = hover != null ? ring[hover] : null

  // always 7 rows: the filter's own rows (the 7th becomes "Show all" when there are more), topped up when there are
  // fewer with the next most important schemas from the other groups, under a "Next up" sub-header
  const more = list.length > TABLE_ROWS
  let rows = list.slice(0, more ? TABLE_ROWS - 1 : TABLE_ROWS)
  const pin = list.find((x) => x.id === pinned)
  if (pin && !rows.includes(pin)) rows = [...rows.slice(0, -1), pin]
  const rest = ['invalid', 'missing', 'valid'].flatMap((st) => by[st]).filter((x) => !list.includes(x))
  const nextUp = !more && rows.length < TABLE_ROWS ? rest.slice(0, TABLE_ROWS - rows.length - 1) : []
  const nextLabel = nextUp[0] && GROUPS.find((g) => g.st === nextUp[0].status).label
  const topPages = list.slice(0, 3).reduce((n, x) => n + pagesOf(x), 0)
  const meta = filter === 'valid' ? `last checked ${SD.lastRun?.date}` : list.length ? `fixing the top ${Math.min(3, list.length)} covers ${topPages} ${topPages === 1 ? 'page' : 'pages'}` : null
  const toggle = (st) => { setFilter((f) => (f === st && st !== 'issues' ? 'issues' : st)); setPinned(null) }

  const select = (x) => { setFilter(x.status); setPinned(x.id) }
  useEffect(() => {
    if (!pinned) return
    requestAnimationFrame(() => tableRef.current?.querySelector(`[data-row="${pinned}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }, [pinned, filter])

  const open = (x) => openSchema(x.id)

  return (
    <Card className="p-6">
      <h2 className={cardTitle}>Schema status</h2>

      <div className="mt-4 grid grid-cols-1 items-start gap-10 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col items-center">
          {/* phones: the ring drawn at 200px (the SVG keeps its padding for the pop-out) */}
          <SchemaRing ring={ring} hover={hover} setHover={setHover} pinnedId={pinned} legendGroup={legendGroup} onSelect={select} pagesOf={pagesOf} size={mobile ? 250 : 280} />
          {/* the legend is the filter; hovering a row lifts its group in the ring */}
          <ul className="mt-5 grid w-full grid-cols-2 gap-1 md:block" role="radiogroup" aria-label="Show schemas">
            <li>
              <button type="button" role="radio" aria-checked={filter === 'issues'} onClick={() => toggle('issues')}
                className={`flex h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus md:h-9 ${filter === 'issues' ? 'bg-[var(--tint)]' : 'hover:bg-[var(--tint)]'}`}>
                {/* half Invalid, half Missing */}
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: `linear-gradient(90deg, ${RING_COLORS.invalid} 50%, ${RING_COLORS.missing} 50%)` }} aria-hidden />
                <span className="flex-1 text-[14px] leading-5 text-stone-900">All issues</span>
                <span className="text-[14px] leading-5 font-semibold text-stone-900 tabular-nums">{issues.length}</span>
              </button>
            </li>
            {GROUPS.map((g) => {
              const on = filter === g.st
              const lit = hovered?.status === g.st
              return (
                <li key={g.st}>
                  <button type="button" role="radio" aria-checked={on} onClick={() => toggle(g.st)}
                    onMouseEnter={() => setLegendGroup(g.st)} onMouseLeave={() => setLegendGroup(null)} onFocus={() => setLegendGroup(g.st)} onBlur={() => setLegendGroup(null)}
                    className={`flex h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus md:h-9 ${on || lit ? 'bg-[var(--tint)]' : 'hover:bg-[var(--tint)]'}`}>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: RING_COLORS[g.st] }} aria-hidden />
                    <span className="flex-1 text-[14px] leading-5 text-stone-900">{g.label}</span>
                    <span key={lit ? hovered.id : 'rest'} className={`text-[14px] leading-5 font-semibold text-stone-900 tabular-nums ${lit ? 'ring-motion motion-safe:animate-[count-pop_200ms_ease-out]' : ''}`}>{by[g.st].length}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* the chosen group as a compact table */}
        <div className="min-w-0">
          <div className="flex h-8 items-center justify-between gap-3">
            <h3 className="min-w-0 truncate text-[14px] leading-5 tabular-nums">
              <span className="font-semibold text-stone-900">{label} · {list.length} {list.length === 1 ? 'schema' : 'schemas'}</span>
              {meta && <span className={`font-normal text-[13px] ${t3}`}> · {meta}</span>}
            </h3>
            <button type="button" onClick={() => setTab('schemas', { status: null, set: null, type: null })} className={linkCls}>View all {r.rows.length} <ArrowRight size={14} aria-hidden /></button>
          </div>
            {mobile ? (
              <ul ref={tableRef} className="mt-2 divide-y divide-[var(--div)] border-t border-[var(--div)]">
                {[...rows.map((x) => ({ x })), ...(nextUp.length ? [{ sub: nextLabel }] : []), ...nextUp.map((x) => ({ x }))].map(({ x, sub }) => {
                  if (sub) return <li key="next-up" className={`flex h-8 items-end pb-1 text-[12px] leading-4 font-medium ${t3}`}>Next up · {sub}</li>
                  const issue = x.status === 'invalid' ? x.error?.where ?? 'Invalid markup' : x.status === 'missing' ? 'Not added yet' : 'No issues'
                  const where = (x.status === 'valid' ? '' : x.kinds.join(', ')) || x.usedOn
                  return (
                    <li key={x.id} data-row={x.id}>
                      <button type="button" onClick={() => open(x)} className={`flex min-h-16 w-full items-start gap-3 py-3 text-left outline-none active:bg-tint focus-visible:bg-tint ${pinned === x.id ? 'bg-[var(--tint)]' : ''}`}>
                        <span className="mt-0.5"><StatusIcon status={x.status} size={16} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-[14px] leading-5 font-medium text-stone-900">{x.name}</span>
                            {x.importance === 'required' && <span className={`shrink-0 text-[11px] leading-4 font-medium ${t3}`}>Required</span>}
                          </span>
                          <span className={`mt-1 block text-[13px] leading-[18px] ${t2}`}>
                            {x.status === 'invalid' ? <span className="font-mono text-[12.5px] text-stone-900">{issue}</span> : issue} · {where} · {pagesOf(x)} {pagesOf(x) === 1 ? 'page' : 'pages'} · {x.impact[0].toUpperCase() + x.impact.slice(1)}
                          </span>
                        </span>
                        <ChevronRight size={14} className="mt-1 shrink-0 text-stone-500" aria-hidden />
                      </button>
                    </li>
                  )
                })}
                {more && (
                  <li>
                    <button type="button" onClick={() => setTab('schemas', { status: filter === 'issues' ? null : filter, set: null, type: null })}
                      className={`flex h-11 w-full items-center gap-1 text-left text-[13px] leading-[18px] font-medium ${t2} outline-none active:bg-tint`}>
                      Show all {list.length} <ArrowRight size={14} aria-hidden />
                    </button>
                  </li>
                )}
              </ul>
            ) : (
            <table ref={tableRef} className="mt-3 w-full table-fixed">
              <thead>
                <tr className={`h-9 border-b border-[var(--div)] text-left text-[12px] leading-4 font-medium ${t3}`}>
                  <th className="w-[26%] pl-2 font-medium">Schema</th>
                  <th className="px-3 font-medium">Issue</th>
                  <th className="w-32 px-3 font-medium">Page type</th>
                  <th className="w-16 px-3 text-right font-medium">Pages</th>
                  <th className="w-20 px-3 text-right font-medium">Impact</th>
                  <th className="w-8"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody key={filter} className="motion-safe:animate-[fade-in_150ms_ease-out]">
                {[...rows.map((x) => ({ x })), ...(nextUp.length ? [{ sub: nextLabel }] : []), ...nextUp.map((x) => ({ x }))].map(({ x, sub }) => {
                  if (sub) return <tr key="next-up" className="h-8 border-b border-[var(--div)]"><td colSpan={6} className={`pl-2 text-[12px] leading-4 font-medium ${t3}`}>Next up · {sub}</td></tr>
                  const lit = hovered?.id === x.id || pinned === x.id
                  const issue = x.status === 'invalid' ? x.error?.where ?? 'Invalid markup' : x.status === 'missing' ? 'Not added yet' : 'No issues'
                  const where = (x.status === 'valid' ? '' : x.kinds.join(', ')) || x.usedOn
                  return (
                    <tr key={x.id} data-row={x.id} tabIndex={0} onClick={() => open(x)} onKeyDown={(e) => { if (e.key === 'Enter') open(x) }}
                      onMouseEnter={() => setHover(ring.indexOf(x))} onMouseLeave={() => setHover(null)} onFocus={() => setHover(ring.indexOf(x))} onBlur={() => setHover(null)}
                      aria-label={`${x.name}: ${STATUS[x.status]}. ${issue}. ${where}, ${pagesOf(x)} pages`}
                      className={`group h-11 cursor-pointer border-b border-[var(--div)] outline-none transition-colors duration-150 last:border-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${lit ? 'bg-[var(--tint)]' : 'hover:bg-[var(--tint)]'}`}>
                      <td className="pl-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <StatusIcon status={x.status} size={14} />
                          <span className="min-w-0 truncate text-[14px] leading-5 font-medium text-stone-900">{x.name}</span>
                          {x.importance === 'required' && <span className={`ml-0.5 shrink-0 text-[11px] leading-4 font-medium ${t3}`}>Required</span>}
                        </span>
                      </td>
                      <td className="truncate px-3" title={issue}>
                        {x.status === 'invalid'
                          ? <span className="font-mono text-[12.5px] leading-5 text-stone-900">{issue}</span>
                          : <span className={`text-[13px] leading-[18px] ${t3}`}>{issue}</span>}
                      </td>
                      <td className={`truncate px-3 text-[13px] leading-[18px] ${t2}`} title={where}>{where}</td>
                      <td className="px-3 text-right text-[14px] leading-5 font-semibold text-stone-900 tabular-nums">{pagesOf(x)}</td>
                      <td className={`px-3 text-right text-[13px] leading-[18px] ${x.impact === 'high' ? 'font-medium text-ink' : x.impact === 'medium' ? t2 : t3}`}>{x.impact[0].toUpperCase() + x.impact.slice(1)}</td>
                      <td><ChevronRight size={14} className={`text-stone-500 transition-opacity duration-150 ${lit ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 touch:opacity-100 group-focus-visible:opacity-100'}`} aria-hidden /></td>
                    </tr>
                  )
                })}
                {more && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <button type="button" onClick={() => setTab('schemas', { status: filter === 'issues' ? null : filter, set: null, type: null })}
                        className={`flex h-11 w-full items-center gap-1 px-2 text-left text-[13px] leading-[18px] font-medium ${t2} outline-none transition-colors duration-150 hover:bg-[var(--tint)] hover:text-ink focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus`}>
                        Show all {list.length} <ArrowRight size={14} aria-hidden />
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
      toolbar={({ search, sortButton }) => (
        // phones: search + Sort, then the set / page type / status filters scrolling sideways
        <div className="flex items-center gap-2 max-md:flex-wrap">
          <div className="no-scrollbar flex items-center gap-2 max-md:order-last max-md:-mx-4 max-md:w-[calc(100%+32px)] max-md:overflow-x-auto max-md:px-4 md:contents">
          <Segmented label="Schema set" value={which} onChange={(v) => setParams({ set: v === 'all' ? null : v })} options={options} />
          {type && (
            <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-tint pl-2.5 pr-1 text-[13px] leading-[18px] font-medium text-stone-900">
              {KINDS[type]}
              <button type="button" aria-label={`Clear page type ${KINDS[type]}`} onClick={() => setParams({ type: null })}
                className="grid h-6 w-6 place-items-center rounded text-stone-500 outline-none transition-colors duration-150 hover:bg-surface hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><X size={12} aria-hidden /></button>
            </span>
          )}
          </div>
          {/* desktop order: set · page type · search · status; phones: search + Sort on top */}
          <div className="max-md:order-first max-md:flex max-md:flex-1 md:contents">{search}</div>
          <div className="max-md:order-first md:contents">{sortButton}</div>
          <div className="no-scrollbar max-md:order-last max-md:-mx-4 max-md:mt-0 max-md:w-[calc(100%+32px)] max-md:overflow-x-auto max-md:px-4 md:contents">
          <select aria-label="Status" value={st} onChange={(e) => setParams({ status: e.target.value === 'all' ? null : e.target.value })} className={selectCls}>
            <option value="all">All statuses</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          </div>
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
<body><h1>Structured data · ${SD.domain}</h1><p>${esc(scope)} · ${new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}</p>
<div class="kpis"><div><b>${r.score}/100</b>Score (${r.scoreLabel})</div><div><b>${r.coverage}%</b>Schema coverage</div><div><b>${r.fullyValid} of ${r.pageCount}</b>Pages fully valid</div><div><b>${r.critical + r.warnings}</b>${r.critical} critical · ${r.warnings} warnings</div></div>
<h2>What to do next</h2><ul>${[...r.fix.map((s) => `<li>Fix ${esc(s.name)}: ${pagesLine(s)}</li>`), ...r.toAdd.map((s) => `<li>Add ${esc(s.name)}: ${pagesLine(s)}</li>`)].join('') || '<li>Everything required is in place.</li>'}</ul>
<h2>Schemas</h2><table><thead><tr><th>Schema</th><th>Status</th><th>Importance</th><th>Pages</th></tr></thead><tbody>${r.rows.map(row).join('')}</tbody></table></body></html>`
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  a.download = `structured-data-report-${new Date().toISOString().slice(0, 10)}.html`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ?crawl=errors: the pages the last crawl couldn't read. The lookup returns the same object each render.
const ERRORS_ITEM = { id: 'errors' }
const findErrors = (id) => (id === 'errors' ? ERRORS_ITEM : null)
function CrawlErrors({ failed, date }) {
  const drawer = useDrawer('crawl', findErrors)
  if (!drawer.item) return null
  return (
    <DrawerShell drawer={drawer} title={`${failed.length} ${failed.length === 1 ? 'page' : 'pages'} failed`} meta={<span>Run of {date} · these pages weren’t analyzed</span>}>
      <ul className="mt-4 divide-y divide-[var(--div)] border-y border-[var(--div)]">
        {failed.map((f) => (
          <li key={f.path} className="flex h-12 items-center justify-between gap-3 text-[14px] leading-5 tabular-nums">
            <span className="min-w-0 truncate text-stone-900" title={f.path}>{f.path}</span>
            <span className={`shrink-0 text-[13px] leading-[18px] ${t2}`}>{[f.status, f.reason].filter(Boolean).join(' · ')}</span>
          </li>
        ))}
      </ul>
    </DrawerShell>
  )
}
