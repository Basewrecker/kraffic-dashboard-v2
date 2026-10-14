import { useMemo } from 'react'
import { X } from 'lucide-react'
import PromptTable from '../dashboard/PromptTable'
import Select from '../ui/Select'
import { useAudit } from './context'
import { Chevron, Chips, fmtMs, openDrawer, setParams } from './parts'
import { CATEGORIES, SLOW_MS, sectionLabel } from '../../data/audit'

// Pages: every crawled URL, worst first. Load time shows only when response times are known. ?section=/products · ?status=failing|warn|clean · ?depth=<clicks> (2xx only). A row opens the Page drawer.
const t2 = 'text-stone-600'
const t3 = 'text-stone-500'
const STATUS_TESTS = {
  failing: (p) => p.failCount > 0,
  warn: (p) => p.failCount === 0 && p.warnCount > 0,
  clean: (p) => p.failCount === 0 && p.warnCount === 0,
}

// "2 failing · 3 needs work": the failing count in --negative, the rest t3
export function Problems({ p }) {
  if (!p.failCount && !p.warnCount) return <span className={`text-[13px] leading-[18px] ${t3}`}>{p.code === 200 ? 'No problems' : 'Not checked'}</span>
  return (
    <span className="text-[13px] leading-[18px] tabular-nums">
      {p.failCount > 0 && <span className="text-negative">{p.failCount} failing</span>}
      {p.failCount > 0 && p.warnCount > 0 && <span className={t3}> · </span>}
      {p.warnCount > 0 && <span className={t3}>{p.warnCount} needs work</span>}
    </span>
  )
}
const problemsText = (p) => [p.failCount && `${p.failCount} failing`, p.warnCount && `${p.warnCount} needs work`].filter(Boolean).join(' · ') || 'No problems'

export default function PagesTab({ q }) {
  const { a } = useAudit()
  const sections = [...new Set(a.pages.map((p) => p.section))]
  const section = sections.includes(q.get('section')) ? q.get('section') : 'all'
  const status = STATUS_TESTS[q.get('status')] ? q.get('status') : 'all'
  // ?depth= (from Site structure): the 2xx pages at that click depth
  const depth = a.crawl.depths.some((d) => String(d.depth) === q.get('depth')) ? Number(q.get('depth')) : null
  // ?cat= (from the Overview heat grid): pages failing a check of that category
  const cat = CATEGORIES[q.get('cat')] ? q.get('cat') : null
  const failsIn = (p) => p.failing.some((id) => a.checkById(id)?.category === cat)
  const rows = useMemo(() => a.pages
    .filter((p) => depth == null || (p.depth === depth && p.code >= 200 && p.code < 300))
    .filter((p) => !cat || failsIn(p))
    .filter((p) => (section === 'all' || p.section === section) && (status === 'all' || STATUS_TESTS[status](p)))
    .sort((x, y) => y.failCount - x.failCount || y.warnCount - x.warnCount || (y.ms ?? 0) - (x.ms ?? 0)), [a, section, status, depth, cat])

  const columns = [
    { key: 'path', label: 'Path', mobile: 'primary', sort: { value: (r) => r.path, first: 'asc' }, csv: (r) => r.path, mobileText: (r) => r.path,
      cell: (r) => <span className="block truncate text-[14px] leading-5 text-stone-900" title={r.path}>{r.path}</span> },
    { key: 'type', label: 'Page type', width: 144, sort: { value: (r) => r.type, first: 'asc' }, csv: (r) => r.type, cell: (r) => <span className={`text-[13px] leading-[18px] ${t2}`}>{r.type}</span> },
    { key: 'problems', label: 'Problems', width: 224, sort: { value: (r) => r.failCount * 100 + r.warnCount, first: 'desc' }, csv: problemsText, cell: (r) => <Problems p={r} /> },
    ...(a.crawl.median == null ? [] : [{ key: 'ms', label: 'Load time', width: 114, align: 'right', sort: { value: (r) => r.ms, first: 'desc' }, csv: (r) => r.ms, mobileText: (r) => (r.ms == null ? '—' : <span className={r.ms > SLOW_MS ? 'text-negative' : undefined}>{fmtMs(r.ms)}</span>),
      cell: (r) => (r.ms == null ? <span className={`text-[14px] ${t3}`}>—</span> : <span className={`text-[14px] leading-5 tabular-nums ${r.ms > SLOW_MS ? 'text-negative' : 'text-stone-900'}`}>{fmtMs(r.ms)}</span>) }]),
    { key: 'code', label: 'Status', width: 94, align: 'right', sort: { value: (r) => r.code, first: 'desc' }, csv: (r) => r.code, mobileText: (r) => `HTTP ${r.code}`,
      cell: (r) => <span className={`text-[14px] leading-5 tabular-nums ${r.code >= 400 ? 'text-negative' : r.code === 200 ? t2 : 'text-stone-900'}`}>{r.code}</span> },
    { key: 'open', label: '', width: 48, csv: false, mobile: false, cell: () => <Chevron /> },
  ]

  return (
    <PromptTable
      id="audit-pages"
      rows={rows}
      columns={columns}
      filterKeys={['path']}
      searchLabel="Search pages"
      emptyQuery={(qq) => <>No pages match “{qq}”</>}
      emptyMessage="No pages match these filters"
      onClearFilters={section !== 'all' || status !== 'all' || depth != null || cat ? () => setParams({ section: null, status: null, depth: null, cat: null }) : null}
      csvName={`site-audit-pages-${new Date().toISOString().slice(0, 10)}.csv`}
      rowHeight="h-11"
      rowHover="hover:bg-tint"
      resetKey={`${section}|${status}|${depth}|${cat}`}
      onRowClick={(r) => openDrawer('page', r.path)}
      toolbar={({ search, exportButton, sortButton }) => (
        <div className="flex items-center gap-3 max-md:flex-wrap">
          <Select label="Section" size="md" className="w-44 max-md:flex-1" value={section} onChange={(v) => setParams({ section: v === 'all' ? null : v })}
            options={[['all', 'All sections'], ...sections.map((s) => [s, sectionLabel(s)])]} />
          <div className="no-scrollbar max-md:order-last max-md:-mx-4 max-md:w-[calc(100%+32px)] max-md:overflow-x-auto max-md:px-4">
            <Chips label="Status" value={status} onChange={(v) => setParams({ status: v === 'all' ? null : v })}
              options={[['all', 'All'], ['failing', 'Has failing'], ['warn', 'Needs work'], ['clean', 'Clean']]} />
          </div>
          {cat && (
            <button type="button" onClick={() => setParams({ cat: null })} aria-label={`Remove filter: ${CATEGORIES[cat]} problems`}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-ink bg-ink pl-3 pr-2 text-small font-medium text-on-ink outline-none focus-visible:ring-2 focus-visible:ring-focus">
              {CATEGORIES[cat]} problems<X size={14} aria-hidden />
            </button>
          )}
          {depth != null && (
            <button type="button" onClick={() => setParams({ depth: null })} aria-label={`Remove filter: depth ${depth}`}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-ink bg-ink pl-3 pr-2 text-small font-medium text-on-ink outline-none focus-visible:ring-2 focus-visible:ring-focus">
              Depth {depth}<X size={14} aria-hidden />
            </button>
          )}
          <div className="flex items-center gap-2 max-md:w-full md:ml-auto">{search}{sortButton}{exportButton}</div>
        </div>
      )}
    />
  )
}
