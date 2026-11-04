// Opportunities → Content, page 1: the list (owner, 2026-11-04, round 4). The KPI cards (each a filter), then the
// Overview's own Missed prompts component, as is (count badge, topic chips, checkboxes, the topic tag and engine icons
// under each prompt, Appearing for / Missed by, search, Export CSV, pagination). Only the Status column changes (each
// prompt's content state), plus "Create content for n" in the bulk bar and a 4-week timeline on row hover. A row
// opens its workspace (a page).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PenLine } from 'lucide-react'
import MissedPrompts from '../../components/dashboard/MissedPrompts'
import { GhostButton } from '../../components/dashboard/PromptTable'
import { missedPrompts } from '../../data/mock'
import { CO_BRAND } from '../../data/contentOpportunities'
import { draftFor } from '../../data/contentOpportunities-proposed'
import { productName } from '../../store/workspace'
import { goTo, promptVT, workspacePath } from './parts'
import { storageKey } from './draft/recommend'
import KpiCards from './list/KpiCards'
import RowTip from './list/RowTip'
import StatusCell, { STATUS_WIDTH } from './list/StatusCell'
import { statusText, tabById, withStage } from './list/model'

// A draft written in this browser (the brief saved under the app's key, `written`) shows as "Draft ready" and opens
// on its Draft step; the sample states (proposed data) take precedence.
function savedDraftFor(row) {
  try {
    const b = JSON.parse(window.localStorage.getItem(storageKey(CO_BRAND.domain, row.prompt)) ?? 'null')
    return b?.written ? { stage: 'draft', week: 0, gained: [], target_url: null, updated_at: b.savedAt ?? null } : null
  } catch { return null }
}
const stateFor = (id, row) => draftFor(id, row) ?? savedDraftFor(row)

// "Create content" everywhere: PenLine, 14px, 1.5 stroke, the label's colour (owner, 2026-11-04)
const PenIcon = (props) => <PenLine {...props} size={14} strokeWidth={1.5} />

// the active card lives in the URL (?show=), so Back from a workspace lands on the same filter
const readTab = () => tabById(new URLSearchParams(window.location.search).get('show')).id
function writeTab(id) {
  const url = new URL(window.location.href)
  if (id === 'all') url.searchParams.delete('show'); else url.searchParams.set('show', id)
  window.history.replaceState(window.history.state, '', url)
}

export default function ContentList() {
  useEffect(() => { document.title = `Content · ${productName()}` }, [])
  const all = useMemo(() => withStage(missedPrompts, stateFor), [])
  const byId = useMemo(() => new Map(all.map((r) => [r.id, r])), [all])
  const [tab, setTabState] = useState(readTab)
  const open = (r) => goTo(workspacePath(r.id))

  // FLIP: rows that stay slide from where they were; new rows fade up 6px (200ms, off under reduced motion)
  const box = useRef(null)
  const before = useRef(null)
  const rowRects = () => new Map([...(box.current?.querySelectorAll('tbody tr[data-row-key]') ?? [])].map((el) => [el.dataset.rowKey, el.getBoundingClientRect().top]))
  const setTab = (id) => {
    if (id === tab) return
    before.current = rowRects()
    setTabState(id); writeTab(id)
  }
  useLayoutEffect(() => {
    const prev = before.current
    before.current = null
    if (!prev || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    for (const el of box.current?.querySelectorAll('tbody tr[data-row-key]') ?? []) {
      const was = prev.get(el.dataset.rowKey)
      const dy = was == null ? null : was - el.getBoundingClientRect().top
      if (dy == null) el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' })
      else if (dy) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' })
    }
  }, [tab])

  const { stages } = tabById(tab)
  const rowFilter = useCallback((r) => stages.includes(byId.get(r.id)?.stage ?? 'none'), [stages, byId])
  const [tip, setTip] = useState(null)
  const onRowHover = useCallback((r, el) => setTip(r ? { row: byId.get(r.id) ?? r, rect: el.getBoundingClientRect() } : null), [byId])
  useEffect(() => {
    if (!tip) return
    const hide = () => setTip(null)
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [tip])

  const statusColumn = {
    key: 'status',
    label: 'Status',
    mobile: 'extra',
    width: STATUS_WIDTH, // fixed, left-aligned: the icons line up down the table
    skeleton: '110px',
    stopRowClick: true,
    csv: (r) => statusText(byId.get(r.id) ?? r),
    cell: (r) => <StatusCell row={byId.get(r.id) ?? r} onOpen={open} />,
  }
  const bulkExtra = (rows, clear) => {
    const todo = rows.filter((r) => (byId.get(r.id)?.stage ?? 'none') === 'none')
    if (!todo.length) return null
    return <GhostButton icon={PenIcon} onClick={() => { clear(); open(todo[0]) }}>Create content for {todo.length}</GhostButton>
  }

  return (
    <>
      <div className="mb-2 min-w-0">
        <h1 className="text-[28px] leading-[34px] font-semibold tracking-[-0.02em] text-stone-900">Content</h1>
        <p className="mt-1 text-body text-stone-600">Draft a page for each missed prompt, then track it engine by engine.</p>
      </div>
      <KpiCards rows={all} value={tab} onChange={setTab} />
      <div ref={box} className="min-w-0 scroll-mt-4" aria-label={`Missed prompts for ${CO_BRAND.name}`}>
        <MissedPrompts statusColumn={statusColumn} onOpen={open} bulkExtra={bulkExtra} rowFilter={rowFilter} onRowHover={onRowHover} promptStyle={(r) => promptVT(r.id)} bulkOnly />
      </div>
      <RowTip tip={tip} />
    </>
  )
}
