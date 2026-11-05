// Opportunities → Content, page 1: the list (owner, 2026-11-04, round 4). The KPI cards (each a filter), then the
// Overview's own Missed prompts component, as is (count badge, topic chips, checkboxes, the topic tag and engine icons
// under each prompt, Appearing for / Missed by, search, Export CSV, pagination). Only the Status column changes (each
// prompt's content state), plus "Create content for n" in the bulk bar and a 4-week timeline on row hover. A row
// opens its workspace (a page).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Info, PenLine } from 'lucide-react'
import MissedPrompts from '../../components/dashboard/MissedPrompts'
import { GhostButton } from '../../components/dashboard/PromptTable'
import { missedPrompts } from '../../data/mock'
import { CO_BRAND } from '../../data/contentOpportunities'
import { draftFor } from '../../data/contentOpportunities-proposed'
// as the app (owner, 2026-11-05): back from Verify (a toast and the row highlighted), the guidelines button, the status
// hover card hidden (CONTENT_HIDDEN.statusCard), tooltips that stay on screen, who connected Search Console
import { CONTENT_HIDDEN, consumeFlash, sampleProperties } from '../../data/contentApp'
import GuidelinesButton from './list/GuidelinesButton'
import { useToast } from '../../components/dashboard/overlays'
import EdgeTip, { NO_MATCH_TIP, NO_SC_TIP } from '../../components/ui/EdgeTip'
import { productName } from '../../store/workspace'
import { MidText, goTo, promptVT, workspacePath } from './parts'
import { storageKey } from './draft/recommend'
import { GoogleIcon } from '../../components/dashboard/icons'
import { bestPageFor as bestPageForRow, brandScState, setBrandScState } from '../../data/gscMatch'
import { PropertyPicker, usePropertyPicker } from './workspace/SearchMatch'
import KpiCards from './list/KpiCards'
import RowTip from './list/RowTip'
import StatusCell, { STATUS_WIDTH } from './list/StatusCell'
import { statusText, tabById, withStage } from './list/model'

const inkBtn = 'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-ink px-3.5 text-[14px] font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-80'
const lineBtn = 'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface px-3.5 text-[14px] font-medium text-stone-800 outline-none hover:border-ink hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-80'
const smallLink = 'rounded text-[14px] font-medium text-stone-600 underline decoration-[var(--color-line-strong)] underline-offset-2 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60'

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
  // as the app (owner, 2026-11-05): back from Verify with the page found: a toast, and the row softly highlighted once
  const [toastNode, toast] = useToast({ position: 'center' })
  useEffect(() => {
    const key = consumeFlash()
    if (!key) return undefined
    const row = all.find((r) => r.prompt.trim().toLowerCase() === key)
    if (!row) return undefined
    toast(`Published · tracking “${row.prompt}” for the next 4 syncs`)
    const t = setTimeout(() => {
      const el = box.current?.querySelector(`tbody tr[data-row-key="${row.id}"]`)
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      el.animate([{ backgroundColor: 'var(--tint)' }, { backgroundColor: 'var(--tint)', offset: 0.6 }, { backgroundColor: 'transparent' }], { duration: 1800, easing: 'ease-out' })
    }, 300)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
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
  // as the app: connected, the banner says so with the property, Change property (Harsh's picker) and Disconnect
  const disconnectSc = () => { setBrandScState(CO_BRAND.domain, 'new'); setScStateRaw('new') }
  const [property, setProperty] = useState(`sc-domain:${CO_BRAND.domain}`)
  const picker = usePropertyPicker(() => sampleProperties(CO_BRAND.domain), setProperty)
  // Best page (Search Console, the app's bestPageFor): the page to publish on and its match, or "New page"; hover /
  // focus: the full URL and its best query. Not connected: "—", the header's ⓘ says where to connect.
  const scOn = scState === 'connected' || scState === 'no-data' || scState === 'low-volume'
  const bestPageFor = (r) => bestPageForRow(r, { state: scState })
  const bestPageColumn = {
    key: 'bestPage',
    // as the app (owner, 2026-11-05): the Best page tooltips stay inside the viewport, and say why a cell is empty
    label: scOn ? 'Best page' : (
      <span className="inline-flex items-center gap-0.5">Best page
        <EdgeTip tip={NO_SC_TIP} label={NO_SC_TIP} className="grid h-5 w-5 place-items-center text-stone-500 hover:text-ink"><Info size={13} aria-hidden /></EdgeTip>
      </span>
    ),
    mobile: false,
    width: 248,
    skeleton: '120px',
    csv: scOn ? (r) => { const b = bestPageFor(r); return b ? (b.action === 'update' ? `${b.path} (${b.match}%)` : 'New page') : '' } : false,
    cell: (r) => {
      const b = scOn ? bestPageFor(r) : null
      if (!b) {
        const why = scOn ? NO_MATCH_TIP : NO_SC_TIP
        return <EdgeTip tip={why} label={`No best page: ${why}`} className="text-small text-stone-400">—</EdgeTip>
      }
      if (b.action === 'create') return <EdgeTip tip={`No page matches well enough: a new page at ${b.suggestedPath}`} className="text-small text-stone-500">New page</EdgeTip>
      return (
        <EdgeTip label={`${b.url}, best query “${b.query}”, ${b.match}% match`} className="flex min-w-0 items-center gap-1.5 text-small"
          tip={<><span className="block font-medium text-stone-900">{b.url}</span><span className="mt-1 block">Best query “{b.query}” · {b.match}% match</span></>}>
          <MidText text={b.path} tip={false} className="text-stone-700" />
          <span className="shrink-0 tabular-nums text-stone-500">{b.match}%</span>
        </EdgeTip>
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
      {/* as the app (owner, 2026-11-05): the brand guidelines button top-right, level with the title */}
      <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-[34px] font-semibold tracking-[-0.02em] text-stone-900">Content</h1>
          <p className="mt-1 text-body text-stone-600">Let’s create winning copies</p>
        </div>
        <GuidelinesButton domain={CO_BRAND.domain} brand={CO_BRAND.name} />
      </div>
      {(scState === 'new' || scState === 'skipped' || scOn) && (
        <div data-sc-banner role="status" className="mb-1 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg bg-tint px-4 py-2.5">
          <span className="flex min-w-0 items-center gap-2.5 text-[14px] leading-5 text-stone-700"><GoogleIcon size={16} />
            {scOn ? <>Search Console connected · <span className="font-medium text-stone-900">{property.replace(/^sc-domain:/, '')}</span></> : 'Connect Search Console to find the best page for every prompt'}
          </span>
          {scOn ? (
            <span className="flex shrink-0 flex-wrap items-center gap-2">
              <button type="button" onClick={picker.openPicker} className={lineBtn}>Change property</button>
              <button type="button" onClick={disconnectSc} className={smallLink}>Disconnect</button>
            </span>
          ) : (
            <button type="button" onClick={connectSc} disabled={scConnecting} aria-busy={scConnecting} className={inkBtn}>
              {scConnecting ? 'Connecting…' : 'Connect'}
            </button>
          )}
        </div>
      )}
      <PropertyPicker {...picker} domain={CO_BRAND.domain} onReconnect={() => { picker.onClose(); connectSc() }} onDisconnect={() => { picker.onClose(); disconnectSc() }} />
      <KpiCards rows={all} value={tab} onChange={setTab} />
      <div ref={box} className="min-w-0 scroll-mt-4" aria-label={`Missed prompts for ${CO_BRAND.name}`}>
        <MissedPrompts statusColumn={statusColumn} extraColumns={[bestPageColumn]} omit={["missedBy"]} onOpen={open} bulkExtra={bulkExtra} rowFilter={rowFilter} onRowHover={onRowHover} promptStyle={(r) => promptVT(r.id)} bulkOnly />
      </div>
      {!CONTENT_HIDDEN.statusCard && <RowTip tip={tip} />}{/* as the app: no status hover card for now */}
      {toastNode}
    </>
  )
}
