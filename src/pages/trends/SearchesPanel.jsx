import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import DrawerShell, { Dot, useDrawer } from '../../components/audit/DrawerShell'
import { downloadCsv } from '../../components/dashboard/csv'
import { PrimaryButton, SecondaryButton } from '../../components/dashboard/overlays'
import Checkbox from '../../components/ui/Checkbox'
import FilterPills from '../../components/ui/FilterPills'
import MenuSelect from '../../components/ui/MenuSelect'
import { Metric, StatusCell, TermPills } from './marketParts'
import { FILTERS, SORTS, countFilters, filterRows, fmtGrowth, sortRows, statusOf } from './view'

// "View all N" (as the app's SearchesPanel, #203 / #207): the whole list in the shared right-hand drawer
// (?all=top | rising). Every row, the term chips, the list filter, two sorts, Export CSV, and a checkbox on each
// prompt that isn't tracked yet with "Track selected" in the footer. Sample data has nothing to track, so it shows the
// rows, the sorts and the export only.
export const ALL_KEY = 'all'

export default function SearchesPanel({ lists, terms, selected, onSelect, filter, onFilter, tracked, onTrack, real, periodWords }) {
  const drawer = useDrawer(ALL_KEY, (id) => (lists[id] ? id : null))
  const id = drawer.item
  const list = id ? lists[id] : null
  const sorts = SORTS[list?.rising ? 'rising' : 'top']
  const [sort, setSort] = useState(sorts[0].id)
  const [picked, setPicked] = useState(() => new Set())
  useEffect(() => { setSort(sorts[0].id); setPicked(new Set()) }, [id, selected]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => (list ? sortRows(filterRows(list.all, real ? filter : 'all', tracked), sorts.some((s) => s.id === sort) ? sort : sorts[0].id) : []), [list, filter, tracked, sort, real]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!list) return null

  const open = rows.filter((r) => statusOf(r, tracked) == null) // rows that can still be tracked
  const chosen = open.filter((r) => picked.has(r.query))
  const toggle = (q) => setPicked((p) => { const n = new Set(p); if (n.has(q)) n.delete(q); else n.add(q); return n })
  const toggleAll = () => setPicked(chosen.length === open.length ? new Set() : new Set(open.map((r) => r.query)))
  const counts = countFilters(list.all, tracked)
  const label = { named: 'Named', missed: 'Missed', tracking: 'Tracking' }
  const exportCsv = () => downloadCsv(`trends-${id}-${selected.replace(/\W+/g, '-')}.csv`, rows, [
    { label: 'Prompt', key: 'query' },
    { label: 'Term', key: 'term' },
    list.rising ? { label: 'Growth', csv: fmtGrowth } : { label: 'Interest (0-100)', key: 'score' },
    ...(real ? [{ label: 'Tracking', csv: (r) => label[statusOf(r, tracked)] ?? 'Not tracked' }] : []),
  ])
  return (
    <DrawerShell drawer={drawer} title={list.title}
      meta={<><span>{list.sub}</span><Dot /><span>{list.all.length} prompts</span></>}
      footer={real ? (
        <>
          <span className="tabular-nums">{chosen.length ? `${chosen.length} selected` : 'Select prompts to track them'}</span>
          <PrimaryButton size="sm" disabled={!chosen.length} onClick={() => { onTrack(chosen.map((r) => r.query)); setPicked(new Set()) }}>Track selected</PrimaryButton>
        </>
      ) : null}>
      <div className="pt-5"><TermPills terms={terms} selected={selected} onSelect={onSelect} /></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {real ? <FilterPills label="Show" value={filter} onChange={onFilter} options={FILTERS.map((f) => ({ ...f, count: counts[f.id] }))} /> : <span />}
        <span className="flex items-center gap-2">
          <MenuSelect prefix="Sort" listLabel="Sort" value={sort} onChange={setSort} groups={[{ items: sorts }]} width="w-48" />
          <SecondaryButton size="sm" icon={Download} onClick={exportCsv} disabled={!rows.length}>Export CSV</SecondaryButton>
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 border-t border-line py-8 text-[14px] leading-5 text-stone-600">{list.all.length ? 'No prompts match this filter.' : list.empty}</p>
      ) : (
        <>
          {real && open.length > 0 && (
            <label className="mt-4 flex h-9 cursor-pointer items-center gap-3 text-[13px] leading-[18px] text-stone-600">
              <Checkbox checked={chosen.length === open.length} indeterminate={chosen.length > 0 && chosen.length < open.length} onChange={toggleAll} label="Select every prompt that isn't tracked" />
              <span className="tabular-nums">Select all {open.length} not tracked</span>
            </label>
          )}
          <ol className={`${real && open.length > 0 ? '' : 'mt-4'} border-t border-line`}>
            {rows.map((r, i) => {
              const s = statusOf(r, tracked)
              return (
                <li key={r.query} className="group/row flex min-h-[48px] items-center gap-3 border-b border-line py-2">
                  {real && (s == null
                    ? <Checkbox checked={picked.has(r.query)} onChange={() => toggle(r.query)} label={`Select ${r.query}`} />
                    : <span aria-hidden className="size-4 shrink-0" />)}
                  <span className="w-6 shrink-0 text-right text-[13px] leading-[18px] text-stone-500 tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 text-[14px] leading-5 font-semibold text-stone-900">{r.query}</span>
                  <Metric row={r} rising={list.rising} />
                  {real && <StatusCell status={s} query={r.query} onTrack={(q) => onTrack([q])} />}
                </li>
              )
            })}
          </ol>
        </>
      )}
    </DrawerShell>
  )
}
