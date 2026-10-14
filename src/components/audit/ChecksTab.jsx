import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import PromptTable from '../dashboard/PromptTable'
import Segmented from '../dashboard/Segmented'
import { useAudit } from './context'
import { CheckIcon, Chevron, Chips, HBar, Impact, StatusLabel, openIssue, plural, setParams } from './parts'
import { CATEGORIES, IMPACT, STATUS, byStatus, impactLevel, needsAction } from '../../data/audit'

// Checks: every check in one table (was Issues + Content). ?status=needs|pass|all (default needs) · ?cat=<category>.
// Rows: Failing → Needs work → Passing, then impact. On "All" the passing checks fold into one muted row.
// The Impact column shows only when the checks have an impact.
const t2 = 'text-stone-600'
const t3 = 'text-stone-500'
const STATUSES = ['needs', 'pass', 'all', 'fail'] // 'fail': from the Overview KPI (Failing only, shown as a chip)

export default function ChecksTab({ q }) {
  const { a } = useAudit()
  const status = STATUSES.includes(q.get('status')) ? q.get('status') : 'needs'
  const cat = CATEGORIES[q.get('cat')] ? q.get('cat') : 'all'
  const [showPassing, setShowPassing] = useState(false)
  useEffect(() => setShowPassing(false), [status, cat])

  const inCat = a.checks.filter((c) => cat === 'all' || c.category === cat)
  const open = inCat.filter(needsAction)
  const pass = inCat.filter((c) => !needsAction(c))
  const fold = status === 'all' && !showPassing && pass.length > 0
  const rows = useMemo(() => {
    const list = status === 'fail' ? inCat.filter((c) => c.status === 'fail') : status === 'needs' ? open : status === 'pass' ? pass : fold ? open : inCat
    return [...list].sort(byStatus)
  }, [status, cat, fold, a]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = a.pages.length
  const hasImpact = a.checks.some((c) => c.impact)
  const columns = [
    { key: 'status', label: '', width: 44, pad: 'pl-5 pr-0', mobile: false, csv: (r) => STATUS[r.status].label, cell: (r) => <span className="grid w-6 place-items-center"><CheckIcon status={r.status} /></span> },
    {
      key: 'label', label: 'Check', width: 284, mobile: 'primary', sort: { value: (r) => r.label, first: 'asc' }, csv: (r) => r.label,
      cell: (r) => <span className="block truncate text-[14px] leading-5 font-medium text-stone-900" title={r.label}>{r.label}</span>,
      mobileText: (r) => r.label,
    },
    { key: 'finding', label: 'Finding', csv: (r) => r.finding, mobile: false, cell: (r) => <span className={`block truncate text-[14px] leading-5 ${t2}`} title={r.finding}>{r.finding}</span> },
    { key: 'state', label: 'Status', desktop: false, mobile: 'meta', csv: false, cell: (r) => <StatusLabel status={r.status} /> },
    { key: 'category', label: 'Category', width: 134, mobile: false, sort: { value: (r) => r.category, first: 'asc' }, csv: (r) => CATEGORIES[r.category], cell: (r) => <span className={`text-[13px] leading-[18px] ${t2}`}>{CATEGORIES[r.category]}</span> },
    {
      key: 'pages', label: 'Pages affected', width: 164, sort: { value: (r) => (r.pageBased ? r.pages.length : -1), first: 'desc' }, csv: (r) => (r.pageBased ? r.pages.length : ''),
      mobileText: (r) => (r.pageBased && r.pages.length ? plural(r.pages.length, 'page') : 'Site-wide'),
      cell: (r) => (r.pageBased && r.pages.length ? (
        <span className="flex items-center gap-2.5 tabular-nums">
          <span className="w-7 text-right text-[14px] leading-5 text-stone-900">{r.pages.length}</span>
          <HBar value={r.pages.length} max={total} className="w-16" />
        </span>
      ) : <span className={`block w-7 text-right text-[14px] ${t3}`}>—</span>),
    },
    ...(hasImpact ? [{ key: 'impact', label: 'Impact', width: 114, sort: { value: impactLevel, first: 'desc' }, csv: (r) => IMPACT[r.impact]?.label ?? '', mobileText: (r) => (r.impact ? `${IMPACT[r.impact].label} impact` : '—'), cell: (r) => (r.impact ? <Impact impact={r.impact} /> : <span className={`text-[13px] ${t3}`}>—</span>) }] : []),
    { key: 'open', label: '', width: 48, csv: false, mobile: false, cell: () => <Chevron /> },
  ]

  const passingRow = ({ mobile }) => {
    if (!fold) return null
    const btn = (
      <button type="button" onClick={() => setShowPassing(true)}
        className={`flex w-full items-center gap-3 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${mobile ? 'min-h-12 px-4' : 'h-11 pl-5 pr-5'}`}>
        <span className="grid w-6 place-items-center"><CheckIcon status="pass" /></span>
        <span className={`flex-1 text-[14px] leading-5 ${t3}`}>{pass.length} checks passing · <span className="font-medium text-stone-700">Show</span></span>
        <ChevronDown size={14} className="text-stone-500" aria-hidden />
      </button>
    )
    return mobile ? btn : <tr className="border-t border-[var(--div)]"><td colSpan={columns.filter((c) => c.desktop !== false).length} className="p-0">{btn}</td></tr>
  }

  return (
    <PromptTable
      id="audit-checks"
      rows={rows}
      columns={columns}
      filterKeys={['label', 'finding']}
      searchLabel="Search checks"
      emptyQuery={(qq) => <>No checks match “{qq}”</>}
      emptyMessage={status === 'needs' ? 'Nothing needs action here. Every check passes.' : 'No checks here'}
      csvName={`site-audit-checks-${new Date().toISOString().slice(0, 10)}.csv`}
      rowHeight="h-11"
      rowHover="hover:bg-tint"
      pagination={false}
      resetKey={`${status}|${cat}`}
      onRowClick={(r) => openIssue(r.id)}
      bottomRow={passingRow}
      toolbar={({ search, exportButton, sortButton }) => (
        <div className="flex items-center gap-3 max-md:flex-wrap">
          <Segmented label="Status" value={status} onChange={(v) => setParams({ status: v === 'needs' ? null : v })}
            options={[
              { value: 'needs', label: `Needs action ${a.checks.filter(needsAction).length}` },
              { value: 'pass', label: `Passing ${a.checks.filter((c) => !needsAction(c)).length}` },
              { value: 'all', label: `All ${a.checks.length}` },
            ]} />
          <div className="no-scrollbar max-md:order-last max-md:-mx-4 max-md:w-[calc(100%+32px)] max-md:overflow-x-auto max-md:px-4">
            <Chips label="Category" value={cat} onChange={(v) => setParams({ cat: v === 'all' ? null : v })} options={[['all', 'All'], ...Object.entries(CATEGORIES)]} />
          </div>
          {status === 'fail' && (
            <button type="button" onClick={() => setParams({ status: null })} aria-label="Remove filter: failing only"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-ink bg-ink pl-3 pr-2 text-small font-medium text-on-ink outline-none focus-visible:ring-2 focus-visible:ring-focus">
              Failing only<X size={14} aria-hidden />
            </button>
          )}
          <div className="flex items-center gap-2 max-md:w-full md:ml-auto">{search}{sortButton}{exportButton}</div>
        </div>
      )}
    />
  )
}
