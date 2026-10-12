import { useEffect, useMemo, useState } from 'react'
import { SECTION_EVENT } from '../../utils/navigate'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Search } from 'lucide-react'
import Card from './Card'
import { downloadCsv } from './csv'

// Shared table for the prompt lists (visible / missed / competitor).
// columns: {
//   key, label, width?, align?: 'right', tdClass?, cell: (row) => node,
//   csv?: (row) => string | false,
//   sort?: { value: (row) => string | number, first: 'asc' | 'desc' },  // makes the header a sort button
//   skeleton?: CSS width of the loading bar,
//   width?: full column width in px incl. padding (table-layout: fixed; omit on the one flexing column),
//   stopRowClick?: clicks in this cell don't open the row
// }
// Optional action-list features (used by Missed prompts):
//   selection { selected: Set<id>, setSelected } adds a checkbox column + select-all,
//   bulkBar(count) replaces search/export while rows are selected,
//   filterBar renders between the header and the table,
//   onRowClick(row) makes rows open something (also Enter on a focused row).
// Page-level tables (the /prompts page):
//   toolbar({ search, exportButton, selectedCount }) replaces the title row with one toolbar row
//   (px-5 py-3, border-b); it gets the table's own search input and Export button to place,
//   topRow: a <tr> rendered above the data rows (e.g. an inline "add prompt" editor),
//   rowHover: the row hover class.
export default function PromptTable({
  id, title, subtitle, rows, columns: dataColumns, filterKeys = ['prompt'], csvName,
  count = rows.length,
  defaultSort = null, // { key, dir }
  loading = false,
  pageSizes = [10, 25, 50],
  selection = null,
  bulkBar = null,
  filterBar = null,
  onRowClick = null,
  emptyMessage = 'No prompts here yet',
  notice = null, // one inline line under the subtitle (e.g. competitor new-wins)
  footnote = null, // small print under the table + pagination
  rowHeight = 'h-11', // 44px single-line rows; two-line tables pass 'h-[52px]'
  onClearFilters = null,
  toolbar = null,
  topRow = null,
  rowHover = 'hover:bg-stone-50',
  rowClass = null, // optional (row) → extra classes, e.g. a tint on the account's own rows
  sort: controlledSort, // optional controlled sort ({ key, dir } | null, with onSortChange), e.g. kept in the URL
  onSortChange,
  pageSize: controlledSize, // optional controlled rows-per-page (with onPageSize), e.g. remembered by the page
  onPageSize,
  resetKey, // page filters outside the table: back to page 1 whenever this changes
  searchLabel = 'Search prompts',
  emptyQuery = (q) => <>No prompts match “{q}”</>,
  pagination = true, // false: every row on one page, no footer (short lists)
}) {
  const [query, setQuery] = useState('')
  const [ownSize, setOwnSize] = useState(pageSizes[0])
  const pageSize = pagination ? controlledSize ?? ownSize : Math.max(1, rows.length)
  const setPageSize = (n) => { setOwnSize(n); onPageSize?.(n) }
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [resetKey])
  const [ownSort, setOwnSort] = useState(defaultSort)
  const sort = controlledSort !== undefined ? controlledSort : ownSort
  const setSort = (v) => { const next = typeof v === 'function' ? v(sort) : v; setOwnSort(next); onSortChange?.(next) }
  // goToSection(id, { sort }) from elsewhere on the page (e.g. a KPI card)
  useEffect(() => {
    const onShow = (e) => {
      if (e.detail?.id !== id || !e.detail.sort) return
      setSort(e.detail.sort)
      setPage(1)
    }
    window.addEventListener(SECTION_EVENT, onShow)
    return () => window.removeEventListener(SECTION_EVENT, onShow)
  }, [id])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => filterKeys.some((k) => String(r[k]).toLowerCase().includes(q)))
  }, [rows, query, filterKeys])

  const sorted = useMemo(() => {
    const col = sort && dataColumns.find((c) => c.key === sort.key)
    if (!col) return filtered
    const v = col.sort.value
    const dir = sort.dir === 'asc' ? 1 : -1
    const tie = col.sort.tie // ties always A→Z, whichever way the column is sorted
    return [...filtered].sort((a, b) => {
      const x = v(a), y = v(b)
      const d = (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir
      return d || (tie ? tie(a).localeCompare(tie(b)) : 0)
    })
  }, [filtered, sort, dataColumns])

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pages)
  const start = (current - 1) * pageSize
  const visible = sorted.slice(start, start + pageSize)

  const toggleSort = (c) => {
    const other = c.sort.first === 'asc' ? 'desc' : 'asc'
    // sort.cycle: first → the other way → off; otherwise it just flips
    setSort((s) => (s?.key !== c.key ? { key: c.key, dir: c.sort.first }
      : c.sort.cycle ? (s.dir === c.sort.first ? { key: c.key, dir: other } : null)
        : { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' }))
    setPage(1)
  }
  const clearSearch = () => { setQuery(''); setPage(1); onClearFilters?.() }

  // checkbox column (select-all = the rows on the current page)
  const pageIds = visible.map((r) => r.id)
  const pageSelected = selection ? pageIds.filter((rid) => selection.selected.has(rid)).length : 0
  const togglePage = () => selection.setSelected((sel) => {
    const next = new Set(sel)
    if (pageSelected === pageIds.length) pageIds.forEach((rid) => next.delete(rid))
    else pageIds.forEach((rid) => next.add(rid))
    return next
  })
  const toggleRow = (rid) => selection.setSelected((sel) => {
    const next = new Set(sel)
    next.has(rid) ? next.delete(rid) : next.add(rid)
    return next
  })
  const selectCol = selection && {
    key: '__select',
    label: '',
    width: 40,
    pad: 'pl-5 pr-0',
    csv: false,
    stopRowClick: true,
    skeleton: '16px',
    header: (
      <input
        type="checkbox"
        aria-label="Select all rows on this page"
        checked={pageIds.length > 0 && pageSelected === pageIds.length}
        ref={(el) => { if (el) el.indeterminate = pageSelected > 0 && pageSelected < pageIds.length }}
        onChange={togglePage}
        className="size-4 cursor-pointer accent-ink"
      />
    ),
    cell: (r) => (
      <input
        type="checkbox"
        aria-label={`Select “${r.prompt}”`}
        checked={selection.selected.has(r.id)}
        onChange={() => toggleRow(r.id)}
        className="size-4 cursor-pointer accent-ink"
      />
    ),
  }
  const columns = selectCol ? [selectCol, ...dataColumns] : dataColumns
  const selectedCount = selection?.selected.size ?? 0

  const openRow = (e, r) => {
    if (!onRowClick || e.target.closest('[data-stop-row]')) return
    onRowClick(r, e.currentTarget)
  }

  const exportCsv = () =>
    downloadCsv(csvName, sorted, columns.filter((c) => c.csv !== false).map((c) => ({ label: c.label, key: c.key, csv: c.csv })))

  // cells: 12px; first/last cells keep the card's 20px inner padding (the table bleeds to the card edge so row hover spans it)
  const pad = (i) =>
    columns[i].pad ?? (selectCol && i === 1 ? 'pl-3 pr-3' : i === 0 ? 'pl-5 pr-3' : i === columns.length - 1 ? 'pl-3 pr-5' : 'px-3')
  // table-layout: fixed. `width` = the full column width incl. padding; the column without one (Prompt) flexes.
  const colWidth = (c) => c.width
  const align = (c) => (c.align === 'right' ? 'text-right' : 'text-left')

  const searchInput = (
    <label className="relative">
      <span className="sr-only">{searchLabel}</span>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setPage(1) }}
        placeholder={searchLabel}
        className="h-9 w-64 rounded-lg border border-line bg-raised pl-9 pr-3 text-small text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-400"
      />
    </label>
  )
  const exportButton = (
    <button
      onClick={exportCsv}
      className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-small font-medium text-stone-600 transition-colors duration-150 hover:bg-stone-50 hover:text-stone-900"
    >
      <Download size={16} /> Export{toolbar ? '' : ' CSV'}
    </button>
  )

  return (
    <Card id={id} className={`scroll-mt-6 overflow-hidden ${toolbar ? '' : 'pt-5'}`}>
      {toolbar ? (
        <div className="border-b border-stone-100 px-5 py-3">{toolbar({ search: searchInput, exportButton, selectedCount })}</div>
      ) : (
      <div className="flex items-start justify-between gap-4 px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-title font-semibold text-stone-900">{title}</h2>
            <span className="inline-flex h-6 items-center rounded-full bg-stone-100 px-2 text-[13px] leading-none font-medium text-stone-600 proportional-nums">
              {count}
            </span>
          </div>
          <p className="mt-0.5 text-[13px] leading-[18px] font-normal text-stone-600">{subtitle}</p>
          {notice && <div className="mt-0.5 text-[13px] leading-[18px] text-stone-600">{notice}</div>}
        </div>
        {bulkBar && selectedCount > 0 ? (
          <div className="flex h-9 shrink-0 items-center gap-1">{bulkBar(selectedCount)}</div>
        ) : (
        <div className="flex shrink-0 items-center gap-2">
          {searchInput}
          {exportButton}
        </div>
        )}
      </div>
      )}

      {filterBar && <div className="mt-3 px-5">{filterBar}</div>}

      <table className={`w-full table-fixed ${toolbar ? '' : 'mt-3'}`} aria-busy={loading || undefined}>
        <thead>
          <tr className={`h-9 bg-tint ${toolbar ? 'border-b' : 'border-y'} border-stone-100`}>
            {columns.map((c, i) => {
              const active = sort?.key === c.key
              return (
                <th
                  key={c.key}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={`${pad(i)} ${align(c)} whitespace-nowrap text-[13px] leading-5 font-medium text-stone-500`}
                  style={{ width: colWidth(c) }}
                >
                  {c.header ? c.header : c.sort ? (
                    <button onClick={() => toggleSort(c)} className="group/sort -mx-1 inline-flex items-center gap-1 rounded px-1 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
                      {c.label}
                      {active
                        ? (sort.dir === 'asc' ? <ChevronUp size={14} className="text-stone-500" /> : <ChevronDown size={14} className="text-stone-500" />)
                        : <ChevronDown size={14} className="text-stone-500 opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60" />}
                    </button>
                  ) : c.label ? c.label : <span className="sr-only">Actions</span>}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {topRow}
          {loading
            ? Array.from({ length: 10 }, (_, r) => (
                <tr key={r} className={`${rowHeight} border-b border-stone-100 last:border-0`}>
                  {columns.map((c, i) => (
                    <td key={c.key} className={pad(i)}>
                      <div className={`h-4 animate-pulse rounded bg-stone-100 ${c.align === 'right' ? 'ml-auto' : ''}`} style={{ width: c.skeleton ?? '60%' }} />
                    </td>
                  ))}
                </tr>
              ))
            : visible.map((r) => (
                <tr
                  key={r.id}
                  onClick={onRowClick ? (e) => openRow(e, r) : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) openRow(e, r) } : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={`group ${rowHeight} border-b border-stone-100 transition-[height,background-color] duration-150 ease-out motion-reduce:transition-none last:border-0 ${rowHover} ${
                    onRowClick ? 'cursor-pointer outline-none focus-visible:bg-stone-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus' : ''
                  } ${selection?.selected.has(r.id) ? 'bg-stone-50' : ''} ${rowClass?.(r) ?? ''}`}
                >
                  {columns.map((c, i) => (
                    <td key={c.key} data-stop-row={c.stopRowClick || undefined} className={`${pad(i)} ${align(c)} ${c.tdClass ?? ''}`}>{c.cell(r, sorted)}</td>
                  ))}
                </tr>
              ))}
          {!loading && visible.length === 0 && !topRow && (
            <tr className="h-32">
              <td colSpan={columns.length} className="px-5 text-center">
                <p className="text-small text-stone-600">{query ? emptyQuery(query) : emptyMessage}</p>
                {(query || onClearFilters) && (
                  <button onClick={clearSearch} className="mt-2 inline-flex h-8 items-center rounded-md px-2.5 text-small font-medium text-stone-600 transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900">
                    {onClearFilters ? 'Clear filters' : 'Clear search'}
                  </button>
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {pagination && <div className="flex h-12 items-center justify-between border-t border-stone-100 px-5 text-[13px] text-stone-500 proportional-nums">
        <span>Showing {sorted.length ? start + 1 : 0}–{start + visible.length} of {sorted.length}</span>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="h-8 rounded-md border border-line bg-raised px-2 text-[13px] font-medium text-stone-900 outline-none"
            >
              {pageSizes.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <span>Page {current} of {pages}</span>
          <div className="flex items-center gap-1.5">
            <PageButton label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)}><ChevronLeft size={16} /></PageButton>
            <PageButton label="Next page" disabled={current === pages} onClick={() => setPage(current + 1)}><ChevronRight size={16} /></PageButton>
          </div>
        </div>
      </div>}
      {footnote && <p className="px-5 pb-4 text-[12px] leading-4 text-stone-500">{footnote}</p>}
    </Card>
  )
}

function PageButton({ label, disabled, onClick, children }) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-md border border-line text-stone-600 transition-colors duration-150 hover:bg-stone-50 hover:text-stone-900 disabled:pointer-events-none disabled:text-stone-300"
    >
      {children}
    </button>
  )
}

// Ghost action button: quiet (stone-400) until its row is hovered or it has keyboard focus.
export function RowAction({ children, icon: Icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className="-mr-2.5 inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-small font-medium text-stone-400 outline-none transition-colors duration-150 group-hover:bg-stone-100 group-hover:text-stone-900 focus-visible:bg-stone-100 focus-visible:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"
    >
      {children}
      {Icon && <Icon size={14} aria-hidden />}
    </button>
  )
}

// Topic label (neutral tint), used as the sub-label in prompt rows.
export function TopicTag({ topic }) {
  return <span className="inline-flex h-[18px] items-center rounded bg-tint px-1.5 text-[12px] leading-none font-medium text-stone-600">{topic}</span>
}

// "Recovered": a missed prompt we published content for, now visible again.
export function RecoveredTag() {
  return (
    <span className="ml-2 inline-flex h-5 shrink-0 items-center rounded-full bg-tint px-2 text-[12px] leading-none font-medium text-stone-600">Recovered</span>
  )
}

// "New" tag for prompts first seen on the latest sync.
export function NewTag() {
  return (
    <span className="ml-2 inline-flex h-5 shrink-0 items-center rounded-full bg-tint px-2 text-[12px] leading-none font-medium text-ink">New</span>
  )
}

// Small ghost button for toolbars (bulk actions etc.)
export function GhostButton({ children, onClick, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-small font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"
    >
      {Icon && <Icon size={16} aria-hidden />}
      {children}
    </button>
  )
}
