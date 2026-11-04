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
import { MidText, goTo, promptVT, workspacePath } from './parts'
import { storageKey } from './draft/recommend'
import { GoogleIcon } from '../../components/dashboard/icons'
import { bestPageFor as bestPageForRow, brandScState, setBrandScState } from '../../data/gscMatch'
import { Tip } from './workspace/SearchMatch'
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
  // Search Console: the brand's connection (shared with every prompt's workspace, data/gscMatch.js brandScState). Not
  // connected (never asked, or skipped): a one-line banner over the list; Connect is the mock's round trip (~900ms).
  const [scState, setScStateRaw] = useState(() => brandScState(CO_BRAND.domain))
  const [scConnecting, setScConnecting] = useState(false)
  const scTimer = useRef(null)
  useEffect(() => () => clearTimeout(scTimer.current), [])
  const connectSc = () => { setScConnecting(true); scTimer.current = setTimeout(() => { setScConnecting(false); setBrandScState(CO_BRAND.domain, 'connected'); setScStateRaw('connected') }, 900) }
  // Best page (Search Console, the app's bestPageFor): the page to publish on and its match, or "New page"; hover /
  // focus: the full URL and its best query. Not connected: "—", the header's ⓘ says where to connect.
  const scOn = scState === 'connected' || scState === 'no-data'
  const bestPageFor = (r) => bestPageForRow(r, { state: scState })
  const bestPageColumn = {
    key: 'bestPage',
    label: scOn ? 'Best page' : <span className="inline-flex items-center gap-0.5">Best page<Tip label="Connect Search Console" align="left" width={220}>Connect Search Console in a prompt’s Target page to see its best page.</Tip></span>,
    mobile: false,
    width: 248,
    skeleton: '120px',
    csv: scOn ? (r) => { const b = bestPageFor(r); return b ? (b.action === 'update' ? `${b.path} (${b.match}%)` : 'New page') : '' } : false,
    cell: (r) => {
      const b = scOn ? bestPageFor(r) : null
      if (!b) return <span className="text-small text-stone-400">—</span>
      if (b.action === 'create') return <span className="text-small text-stone-500" title={`No page matches well enough: a new page at ${b.suggestedPath}`}>New page</span>
      return (
        <span className="group/bp relative flex min-w-0 items-center gap-1.5 text-small" tabIndex={0} aria-label={`${b.url}, best query “${b.query}”, ${b.match}% match`}>
          <MidText text={b.path} tip={false} className="text-stone-700" />
          <span className="shrink-0 tabular-nums text-stone-500">{b.match}%</span>
          <span role="tooltip" className="pointer-events-none absolute left-0 top-full z-30 mt-1 w-[280px] rounded-md border border-line bg-raised px-3 py-2 text-[12px] leading-4 text-stone-700 opacity-0 shadow-md transition-opacity duration-150 group-hover/bp:opacity-100 group-focus/bp:opacity-100">
            <span className="block break-all font-medium text-stone-900">{b.url}</span>
            <span className="mt-1 block">Best query “{b.query}” · {b.match}% match</span>
          </span>
        </span>
      )
    },
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
      {(scState === 'new' || scState === 'skipped') && (
        <div data-sc-banner role="status" className="mb-1 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg bg-tint px-4 py-2.5">
          <span className="flex min-w-0 items-center gap-2.5 text-[14px] leading-5 text-stone-700"><GoogleIcon size={16} />Connect Search Console to find the best page for every prompt</span>
          <button type="button" onClick={connectSc} disabled={scConnecting} aria-busy={scConnecting}
            className="rounded text-[14px] leading-5 font-medium text-ink underline decoration-[var(--color-line-strong)] underline-offset-[3px] outline-none hover:decoration-ink focus-visible:ring-2 focus-visible:ring-focus disabled:no-underline disabled:opacity-70">
            {scConnecting ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      )}
      <KpiCards rows={all} value={tab} onChange={setTab} />
      <div ref={box} className="min-w-0 scroll-mt-4" aria-label={`Missed prompts for ${CO_BRAND.name}`}>
        <MissedPrompts statusColumn={statusColumn} extraColumns={[bestPageColumn]} omit={["missedBy"]} onOpen={open} bulkExtra={bulkExtra} rowFilter={rowFilter} onRowHover={onRowHover} promptStyle={(r) => promptVT(r.id)} bulkOnly />
      </div>
      <RowTip tip={tip} />
    </>
  )
}
