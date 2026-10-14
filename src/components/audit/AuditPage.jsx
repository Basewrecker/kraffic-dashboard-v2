import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Code2, Copy, Download, MoreHorizontal, RefreshCw, ScanSearch } from 'lucide-react'
import Card from '../dashboard/Card'
import Modal from '../ui/Modal'
import ErrorBoundary from '../ui/ErrorBoundary'
import MobileActions from '../ui/MobileActions'
import { useToast } from '../dashboard/overlays'
import { downloadCsv } from '../dashboard/csv'
import ActionMenu from './ActionMenu'
import AuditDrawer, { CodesDrawer, PageDrawer } from './AuditDrawer'
import Overview from './Overview'
import ChecksTab from './ChecksTab'
import PagesTab from './PagesTab'
import CrawlTab from './CrawlTab'
import { AuditProvider } from './context'
import { setParams, useTab } from './parts'
import { CATEGORIES, IMPACT, STATUS, byStatus, getAudit } from '../../data/audit'
import { auditActions } from '../../data/mock'

// /audit — "Site Audit": how ready the site is for AI answers. Tabs: Overview · Checks · Pages · Crawl (?tab=).
// Data: data/audit (derived from the API-shaped mock in data/mock.js). ?mock=full|first|clean|never picks the state.
// Rows open the Check drawer (?check=) or the Page drawer (?page=); both are bottom sheets on phones.
// Run audit goes through auditActions (data/mock); a failed run shows its reason under the subtitle, with Retry.
const t2 = 'text-stone-600'
const t3 = 'text-stone-500'
const TAB_IDS = ['overview', 'checks', 'pages', 'crawl']
const inkBtn = 'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-ink px-3.5 text-small font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-60 lg:h-9'

export default function AuditPage() {
  useEffect(() => { document.title = 'Site Audit · Kraffic' }, [])
  const [tab, setTab, q] = useTab(TAB_IDS)
  const a = useMemo(() => getAudit(q.get('mock') ?? 'full'), [q])
  const tabsRef = useRef(null)
  useEffect(() => { tabsRef.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }, [tab])
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState(null)
  const [api, setApi] = useState(false)
  const [toastNode, toast] = useToast({ position: 'center' })

  const run = () => {
    if (running) return
    setRunning(true)
    setRunError(null)
    auditActions.onRunAudit({ never: a.never })
      .then((res) => { if (res?.mock) setParams({ mock: res.mock }); toast('Audit finished') }) // the first audit lands
      .catch((err) => setRunError(err?.message || 'The audit couldn’t finish.'))
      .finally(() => setRunning(false))
  }
  const exportAll = () => !a.never && downloadCsv(`site-audit-${new Date().toISOString().slice(0, 10)}.csv`, [...a.checks].sort(byStatus), [
    { label: 'Check', key: 'label' },
    { label: 'Category', csv: (c) => CATEGORIES[c.category] },
    { label: 'Status', csv: (c) => STATUS[c.status].label },
    { label: 'Finding', key: 'finding' },
    { label: 'Impact', csv: (c) => IMPACT[c.impact].label },
    { label: 'Pages affected', csv: (c) => (c.pageBased ? c.pages.length : '') },
    { label: 'Pages', csv: (c) => c.pages.join(' ') },
  ])

  const tabs = [['overview', 'Overview'], ['checks', 'Checks', a.never ? null : a.open.length], ['pages', 'Pages'], ['crawl', 'Crawl']]
  const tabKeys = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const next = TAB_IDS[(TAB_IDS.indexOf(tab) + step + TAB_IDS.length) % TAB_IDS.length]
    setTab(next, { status: null, section: null, cat: null, depth: null })
    requestAnimationFrame(() => document.querySelector(`[data-audit-tab="${next}"]`)?.focus())
  }
  const meta = running ? 'Running…' : a.never ? 'Not run yet' : `Last run ${a.run.date} · ${a.run.pages} pages`
  // a failed run: the reason on its own line under the subtitle, with Retry (the Structured Data pattern)
  const failLine = !running && runError && (
    <p role="alert" className="mt-2 text-[13px] leading-[18px] text-negative">
      Audit failed: {runError}{' '}
      <button type="button" onClick={run} className="ml-1 rounded font-medium text-ink underline underline-offset-4 outline-none hover:opacity-75 focus-visible:ring-2 focus-visible:ring-focus">Retry</button>
    </p>
  )

  return (
    <AuditProvider audit={a}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">Site Audit</h1>
          <p className={`mt-1 text-[13px] leading-[18px] ${t2} lg:text-[14px] lg:leading-5`}>How ready {a.domain} is for AI answers</p>
          <p className={`mt-1 text-[13px] leading-[18px] ${t3} tabular-nums lg:hidden`}>{meta}</p>
          {failLine}
        </div>
        <div className="flex shrink-0 items-center gap-2 lg:pt-1">
          <span className={`mr-1 hidden whitespace-nowrap text-[13px] leading-[18px] ${t3} tabular-nums lg:inline`}>{meta}</span>
          {!a.never && <button type="button" onClick={run} disabled={running} className={`${inkBtn} max-lg:flex-1`}>
            <RefreshCw size={14} className={running ? 'animate-[spin_600ms_linear_infinite] motion-reduce:animate-none' : undefined} aria-hidden />
            Run audit
          </button>}
          <MobileActions items={[{ label: 'API access', icon: Code2, onClick: () => setApi(true) }, ...(a.never ? [] : [{ label: 'Export all (CSV)', icon: Download, onClick: exportAll }])]} />
          <span className="hidden lg:inline-flex">
            <ActionMenu label="More actions" items={[{ label: 'API access', onClick: () => setApi(true) }, ...(a.never ? [] : [{ label: 'Export all (CSV)', onClick: exportAll }])]}
              className="grid h-9 w-9 place-items-center rounded-lg border border-line text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
              <MoreHorizontal size={16} aria-hidden />
            </ActionMenu>
          </span>
        </div>
      </div>

      {a.never ? <NeverRun onRun={run} running={running} domain={a.domain} /> : (
        <>
          {/* underline tabs; phones: they scroll sideways edge to edge, the active one scrolled into view */}
          <div role="tablist" aria-label="Site Audit" onKeyDown={tabKeys} ref={tabsRef}
            className="no-scrollbar -mx-4 mt-2 flex snap-x gap-6 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
            {tabs.map(([id, label, n]) => (
              <button key={id} data-audit-tab={id} type="button" role="tab" id={`audit-tab-${id}`} aria-controls="audit-panel" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id, { status: null, section: null, cat: null, depth: null })}
                className={`-mb-px inline-flex h-11 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap border-b-2 text-[14px] leading-5 font-medium outline-none md:h-10 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${tab === id ? 'border-ink text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900'}`}>
                {label}{n != null && <span className={`text-[13px] leading-[18px] font-normal ${t3} tabular-nums`}>{n}</span>}
              </button>
            ))}
          </div>

          <div id="audit-panel" role="tabpanel" aria-labelledby={`audit-tab-${tab}`} className="mt-4 flex flex-col gap-4">
            <ErrorBoundary resetKey={`${tab}|${a.key}`} name={`Site Audit · ${tab}`}>
              {tab === 'overview' && <Overview setTab={setTab} />}
              {tab === 'checks' && <ChecksTab q={q} />}
              {tab === 'pages' && <PagesTab q={q} />}
              {tab === 'crawl' && <CrawlTab />}
            </ErrorBoundary>
          </div>

          <ErrorBoundary name="Check drawer" floating><AuditDrawer /></ErrorBoundary>
          <ErrorBoundary name="Page drawer" floating><PageDrawer /></ErrorBoundary>
          <ErrorBoundary name="Status code drawer" floating><CodesDrawer /></ErrorBoundary>
        </>
      )}

      <ApiModal open={api} onClose={() => setApi(false)} domain={a.domain} />
      {toastNode}
    </AuditProvider>
  )
}

// Audit never run: one card, one action
function NeverRun({ onRun, running, domain }) {
  return (
    <Card className="mt-4 flex flex-col items-center px-5 py-14 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-tint text-stone-700" aria-hidden><ScanSearch size={20} /></span>
      <h2 className="mt-4 text-[15px] leading-5 font-semibold text-stone-900">No audit yet</h2>
      <p className={`mt-1 max-w-[420px] text-[14px] leading-5 ${t2}`}>Run the first audit to see how ready {domain} is for AI answers: what’s failing, on which pages, and what to fix first.</p>
      <button type="button" onClick={onRun} disabled={running} className={`${inkBtn} mt-5`}>
        <RefreshCw size={14} className={running ? 'animate-[spin_600ms_linear_infinite] motion-reduce:animate-none' : undefined} aria-hidden />
        {running ? 'Running…' : 'Run audit'}
      </button>
    </Card>
  )
}

function ApiModal({ open, onClose, domain }) {
  const [copied, setCopied] = useState(null)
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(null), 1500); return () => clearTimeout(t) }, [copied])
  const rows = [
    ['GET', '/api/projects/:projectId/pages/summary', 'The latest audit summary as JSON'],
    ['POST', '/api/projects/:projectId/pages/sync', 'Start a new audit run'],
  ]
  const copy = (text) => { navigator.clipboard?.writeText(text).catch(() => {}); setCopied(text) }
  return (
    <Modal open={open} onClose={onClose} title="API access" subtitle={`Read or refresh the ${domain} audit from your own tools.`}>
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
