import { useEffect, useMemo, useRef, useState } from 'react'
import { SECTION_EVENT } from '../../utils/navigate'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Search } from 'lucide-react'
import Sheet, { SheetItem } from '../ui/Sheet'
import { useIsMobile } from '../../hooks/useMedia'
import { EXPORT_EVENT } from '../ui/MobileActions'
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
//   bottomRow: ({ mobile }) => node after the data rows (a <tr> on desktop, any node on phones),
//   rowHover: the row hover class.
// Phones (below md): the same rows as a stacked list — no column headers, the sort moves to a "Sort" sheet,
// pagination becomes "Load 10 more", and long-press enters select mode (when `selection` is set).
//   column.mobile: 'primary' (line 1; default = the first data column) · 'meta' (line 2, joined with " · ", default)
//                  · 'extra' (line 3: logos, chips) · false (hidden on phones)
//   column.mobileText(row): plain text for the meta line instead of rendering the cell (on the primary: 2-line text)
//   column.desktop: false → a phones-only column (e.g. a meta fact the desktop shows inside another cell)
//   mobileRowClick(row, el): what a tap does on phones when the desktop row has no click (its action button is hidden)
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
  bottomRow = null, // a node after the data rows: a <tr> on desktop, rendered as-is under the list on phones (e.g. a collapsed group)
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
  mobileRowClick = null,
}) {
  const mobile = useIsMobile()
  const [query, setQuery] = useState('')
  const [sortSheet, setSortSheet] = useState(false)
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

  // phones: "Load 10 more" instead of pages
  const [shownCount, setShownCount] = useState(10)
  useEffect(() => setShownCount(10), [resetKey, query, sort?.key, sort?.dir])

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
  const desktopColumns = dataColumns.filter((c) => c.desktop !== false)
  const columns = selectCol ? [selectCol, ...desktopColumns] : desktopColumns
  const selectedCount = selection?.selected.size ?? 0

  const openRow = (e, r) => {
    if (!onRowClick || e.target.closest('[data-stop-row]')) return
    onRowClick(r, e.currentTarget)
  }

  const exportCsv = () =>
    downloadCsv(csvName, sorted, columns.filter((c) => c.csv !== false).map((c) => ({ label: c.label, key: c.key, csv: c.csv })))
  // phones: the page's ⋯ menu asks for the export (see ui/MobileActions exportTable)
  const exportRef = useRef(exportCsv)
  exportRef.current = exportCsv
  useEffect(() => {
    const on = (e) => { if (e.detail?.id === id) exportRef.current() }
    window.addEventListener(EXPORT_EVENT, on)
    return () => window.removeEventListener(EXPORT_EVENT, on)
  }, [id])

  // cells: 12px; first/last cells keep the card's 20px inner padding (the table bleeds to the card edge so row hover spans it)
  const pad = (i) =>
    columns[i].pad ?? (selectCol && i === 1 ? 'pl-3 pr-3' : i === 0 ? 'pl-5 pr-3' : i === columns.length - 1 ? 'pl-3 pr-5' : 'px-3')
  // table-layout: fixed. `width` = the full column width incl. padding; the column without one (Prompt) flexes.
  const colWidth = (c) => c.width
  const align = (c) => (c.align === 'right' ? 'text-right' : 'text-left')

  const searchInput = (
    <label className="relative min-w-0 max-md:flex-1">
      <span className="sr-only">{searchLabel}</span>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setPage(1) }}
        placeholder={searchLabel}
        className="h-10 w-full rounded-lg border border-line bg-raised pl-9 pr-3 text-small text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-400 md:h-9 md:w-64"
      />
    </label>
  )
  const sortable = dataColumns.filter((c) => c.sort)
  const sortButton = sortable.length > 0 && (
    <button type="button" onClick={() => setSortSheet(true)} aria-label={`Sort${sort ? `: ${dataColumns.find((c) => c.key === sort.key)?.label}` : ''}`}
      className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-small font-medium text-stone-700 outline-none focus-visible:ring-2 focus-visible:ring-focus md:hidden">
      <ArrowUpDown size={14} aria-hidden /> Sort
    </button>
  )
  const exportButton = (
    <button
      onClick={exportCsv}
      className="hidden h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-small font-medium text-stone-600 transition-colors duration-150 hover:bg-stone-50 hover:text-stone-900 md:inline-flex"
    >
      <Download size={16} /> Export{toolbar ? '' : ' CSV'}
    </button>
  )

  const sortSheetNode = (
    <Sheet open={sortSheet} onClose={() => setSortSheet(false)} title="Sort by">
      {sortable.map((c) => {
        const on = sort?.key === c.key
        return (
          <SheetItem key={c.key} active={on} onClick={() => toggleSort(c)}
            meta={on ? (sort.dir === 'asc' ? <ArrowUp size={16} className="text-ink" aria-label="ascending" /> : <ArrowDown size={16} className="text-ink" aria-label="descending" />) : null}>
            {c.label}
          </SheetItem>
        )
      })}
    </Sheet>
  )

  if (mobile) {
    return (
      <MobileList
        id={id} title={title} subtitle={subtitle} count={count} notice={notice} toolbar={toolbar} filterBar={filterBar}
        search={searchInput} sortButton={sortButton} exportButton={exportButton} selectedCount={selectedCount} bulkBar={bulkBar}
        rows={pagination ? sorted.slice(0, shownCount) : sorted} total={sorted.length} onMore={() => setShownCount((n) => n + 10)}
        columns={dataColumns} selection={selection} toggleRow={toggleRow} onRowClick={onRowClick ?? mobileRowClick} rowClass={rowClass}
        loading={loading} query={query} emptyMessage={emptyMessage} emptyQuery={emptyQuery} onClear={(query || onClearFilters) ? clearSearch : null} clearLabel={onClearFilters ? 'Clear filters' : 'Clear search'}
        topRow={topRow} bottomRow={bottomRow?.({ mobile: true })} footnote={footnote} sortSheet={sortSheetNode}
      />
    )
  }

  return (
    <Card id={id} className={`scroll-mt-6 overflow-hidden ${toolbar ? '' : 'pt-5'}`}>
      {toolbar ? (
        <div className="border-b border-stone-100 px-5 py-3">{toolbar({ search: searchInput, exportButton, selectedCount, sortButton: null })}</div>
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
          {!loading && bottomRow?.({ mobile: false })}
          {!loading && visible.length === 0 && !topRow && !bottomRow && (
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


// ---- phones: the rows as a stacked list
function MobileList({
  id, title, subtitle, count, notice, toolbar, filterBar, search, sortButton, exportButton, selectedCount, bulkBar,
  rows, total, onMore, columns, selection, toggleRow, onRowClick, rowClass, loading, query, emptyMessage, emptyQuery, onClear, clearLabel,
  topRow, bottomRow, footnote, sortSheet,
}) {
  const primary = columns.find((c) => c.mobile === 'primary') ?? columns.find((c) => c.mobile !== false && c.label)
  const meta = columns.filter((c) => c !== primary && c.mobile !== false && c.mobile !== 'extra' && (c.mobile === 'meta' || c.label))
  const extra = columns.filter((c) => c.mobile === 'extra')
  const press = useRef(null)
  const selecting = selection && selectedCount > 0

  // long-press (500ms) enters select mode; in select mode a tap toggles the row
  const startPress = (r) => { if (!selection) return; press.current = { id: r.id, fired: false, t: setTimeout(() => { press.current.fired = true; toggleRow(r.id); navigator.vibrate?.(10) }, 500) } }
  const endPress = () => { if (press.current) clearTimeout(press.current.t) }
  const tap = (e, r) => {
    if (press.current?.fired) { press.current = null; return }
    press.current = null
    if (e.target.closest('[data-stop-row]')) return
    if (selecting) toggleRow(r.id)
    else onRowClick?.(r, e.currentTarget)
  }

  return (
    <div id={id} className="scroll-mt-20 overflow-hidden rounded-2xl border border-line bg-surface">
      {toolbar ? (
        <div className="border-b border-stone-100 px-4 py-3">{toolbar({ search, exportButton, selectedCount, sortButton })}</div>
      ) : (
        <div className="px-4 pt-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] leading-5 font-semibold text-stone-900">{title}</h2>
            <span className="inline-flex h-6 items-center rounded-full bg-stone-100 px-2 text-[13px] leading-none font-medium text-stone-600 tabular-nums">{count}</span>
          </div>
          {subtitle && <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600">{subtitle}</p>}
          {notice && <div className="mt-0.5 text-[13px] leading-[18px] text-stone-600">{notice}</div>}
          <div className="mt-3 flex items-center gap-2">{search}{sortButton}</div>
        </div>
      )}
      {filterBar && <div className="mt-3 px-4">{filterBar}</div>}
      {topRow && <table className="mt-2 w-full"><tbody>{topRow}</tbody></table>}

      <ul className={`divide-y divide-[var(--div)] ${toolbar ? '' : 'mt-3 border-t border-[var(--div)]'}`} aria-busy={loading || undefined}>
        {loading
          ? Array.from({ length: 5 }, (_, i) => <li key={i} className="px-4 py-3"><div className="h-4 w-3/4 animate-pulse rounded bg-stone-100" /><div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-stone-100" /></li>)
          : rows.map((r) => {
            const on = selection?.selected.has(r.id)
            return (
              <li key={r.id}>
                <div role={onRowClick || selection ? 'button' : undefined} tabIndex={onRowClick || selection ? 0 : undefined}
                  onClick={(e) => tap(e, r)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) tap(e, r) }}
                  onTouchStart={() => startPress(r)} onTouchEnd={endPress} onTouchMove={endPress} onContextMenu={(e) => selection && e.preventDefault()}
                  aria-pressed={selection ? Boolean(on) : undefined}
                  className={`flex min-h-16 select-none items-start gap-3 px-4 py-3 outline-none transition-colors duration-150 focus-visible:bg-tint ${on ? 'bg-tint' : ''} ${onRowClick || selection ? 'cursor-pointer active:bg-tint' : ''} ${rowClass?.(r) ?? ''}`}>
                  {selecting && (
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${on ? 'border-ink bg-ink text-on-ink' : 'border-[var(--color-line-strong)]'}`} aria-hidden>
                      {on && <Check size={14} />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    {primary?.mobileText
                      ? <div className="line-clamp-2 text-[14px] leading-5 font-medium text-stone-900">{primary.mobileText(r)}</div>
                      : <div className="min-w-0 text-[14px] leading-5 font-medium text-stone-900">{primary?.cell(r, rows)}</div>}
                    {meta.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-[18px] text-stone-600">
                        {meta.map((c, i) => (
                          <span key={c.key} className="inline-flex min-w-0 items-center gap-1.5" data-stop-row={c.stopRowClick || undefined}>
                            {i > 0 && <span className="text-stone-400" aria-hidden>·</span>}
                            {c.mobileText ? c.mobileText(r) : c.cell(r, rows)}
                          </span>
                        ))}
                      </div>
                    )}
                    {extra.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-1.5">{extra.map((c) => <span key={c.key} data-stop-row={c.stopRowClick || undefined}>{c.cell(r, rows)}</span>)}</div>}
                  </div>
                  {onRowClick && !selecting && <ChevronRight size={14} className="mt-1 shrink-0 text-stone-500" aria-hidden />}
                </div>
              </li>
            )
          })}
        {!loading && bottomRow && <li>{bottomRow}</li>}
        {!loading && rows.length === 0 && !bottomRow && (
          <li className="px-4 py-10 text-center">
            <p className="text-small text-stone-600">{query ? emptyQuery(query) : emptyMessage}</p>
            {onClear && <button onClick={onClear} className="mt-2 inline-flex h-10 items-center rounded-md px-3 text-small font-medium text-stone-600 hover:bg-stone-100">{clearLabel}</button>}
          </li>
        )}
      </ul>
      {!loading && total > rows.length && (
        <div className="border-t border-[var(--div)] p-3">
          <button type="button" onClick={onMore} className="flex h-11 w-full items-center justify-center rounded-lg border border-line text-small font-medium text-stone-700 outline-none active:bg-tint focus-visible:ring-2 focus-visible:ring-focus">
            Load {Math.min(10, total - rows.length)} more <span className="ml-1.5 font-normal text-stone-500 tabular-nums">· {rows.length} of {total}</span>
          </button>
        </div>
      )}
      {footnote && <p className="px-4 pb-4 text-[12px] leading-4 text-stone-500">{footnote}</p>}
      {/* select mode: the bulk actions in a sticky bar at the bottom */}
      {selecting && bulkBar && !toolbar && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-1 overflow-x-auto border-t border-line bg-surface px-4 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgb(0_0_0/0.06)]">
          {bulkBar(selectedCount)}
        </div>
      )}
      {sortSheet}
    </div>
  )
}
