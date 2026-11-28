// Opportunities → Content, page 1: the list (owner, 2026-11-04, round 4). The KPI cards (each a filter), then the
// Overview's own Missed prompts component, as is (count badge, topic chips, checkboxes, the topic tag and engine icons
// under each prompt, Appearing for / Missed by, search, Export CSV, pagination). Only the Status column changes (each
// prompt's content state), plus "Create content for n" in the bulk bar and a 4-week timeline on row hover. A row
// opens its workspace (a page).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Info, PenLine } from 'lucide-react'
import MissedPrompts from '../../components/dashboard/MissedPrompts'
import { GhostButton } from '../../components/dashboard/PromptTable'
import { OWN, account, missedPrompts } from '@/lib/mock-adapter'
import { brandListName, looksLikeDomain } from '@/lib/citation-rules'
import { CO_BRAND } from '@/lib/mock-adapter-content'
import { draftFor } from '@/lib/mock-adapter-content'
import { consumeFlash } from '@/lib/mock-adapter-content' // app: back from Verify (owner, 2026-11-05)
import { GuidelinesButton } from '@/components/mock-overview/content-guidelines' // app
import { useToast } from '../../components/dashboard/overlays'
import { productName } from '../../store/workspace'
import { LogoPlate, MidText, goTo, promptVT, workspacePath } from './parts'
import { storageKey } from './draft/recommend'
import { GoogleIcon } from '../../components/dashboard/icons'
import { bestPageFor as bestPageForRow } from '@/lib/mock-adapter-content'
// app: the brand's Search Console state from the server and the app's own connect flow (the mock's brandScState /
// setBrandScState and its 900ms round trip), with the connect error under the banner
import { ConnectError, GscPropertyPicker, useBrandSearchConsole } from '@/components/mock-overview/content-gsc'
// app (owner, 2026-11-05): the Best page tooltips stay inside the viewport, and say why a cell is empty
import { EdgeTip, NO_MATCH_TIP, NO_SC_TIP } from '@/components/mock-overview/content-gsc'
// app (owner, 2026-11-10): the Best page hover cards' second line ("Best query … · 68% match", "No page matches well
// enough…") in the secondary colour, 13px, weight 400 (it read nearly invisible); the first line stays primary
const TIP_2 = 'block text-[13px] leading-[18px] font-normal text-stone-600'
import { KpiCards } from '@/components/mock-overview/content-v1'
import { RowTip } from '@/components/mock-overview/content-v1'
import StatusCell, { STATUS_WIDTH } from './list/StatusCell'
import { statusText, tabById, withStage } from './list/model'
import { WhatChangedButton, WhatChangedPanel } from '../../whatChanged/WhatChanged'
import { content as contentChanges } from '../../whatChanged/content'

// A draft written in this browser (the brief saved under the app's key, `written`) shows as "Draft ready" and opens
// on its Draft step; the sample states (proposed data) take precedence.
function savedDraftFor(row) {
  try {
    const b = JSON.parse(window.localStorage.getItem(storageKey(CO_BRAND.domain, row.prompt)) ?? 'null')
    return b?.written ? { stage: 'draft', week: 0, gained: [], target_url: null, updated_at: b.savedAt ?? null, ...(b.contentSource === 'template' ? { notWritten: true } : {}) /* app (owner, 2026-11-12) */ } : null
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
  // app (owner, 2026-11-09): the brand by its display name, never its domain: the Brand Setup name when one is set,
  // else the domain tidied as Share of voice names it ("financeofamerica.com" → "Financeofamerica")
  const brandShown = [OWN?.name, account?.name, CO_BRAND.name].find((n) => n && !looksLikeDomain(n))
    ?? brandListName([OWN?.name], OWN?.domain ?? CO_BRAND.domain)
  const byId = useMemo(() => new Map(all.map((r) => [r.id, r])), [all])
  const [tab, setTabState] = useState(readTab)
  // app (owner, 2026-11-05): back from Verify with the page found: a toast, and the row softly highlighted once
  const [toastNode, toast] = useToast({ position: 'center' })
  useEffect(() => {
    const key = consumeFlash()
    if (!key) return
    const row = all.find((r) => r.prompt.trim().toLowerCase() === key)
    if (!row) return
    toast(`Published · tracking “${row.prompt}” for the next 4 syncs`)
    const t = setTimeout(() => {
      const el = box.current?.querySelector(`tbody tr[data-row-key="${row.id}"]`)
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      el.animate([{ backgroundColor: 'var(--tint)' }, { backgroundColor: 'var(--tint)', offset: 0.6 }, { backgroundColor: 'transparent' }], { duration: 1800, easing: 'ease-out' })
    }, 300)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const open = (r) => goTo(workspacePath(r)) // app (owner, 2026-11-15): by the row's promptId

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
  // app: from the server (GET / POST /api/content/search-console; "skipped" kept per brand in this browser); Connect is
  // the app's own flow (Google's consent page, back to this list); an admin viewing a client gets no banner
  const { state: scState, siteUrl: scSiteUrl, connecting: scConnecting, disconnecting: scDisconnecting, disconnectError: scDisconnectError, onConnect: connectSc, onDisconnect: disconnectSc, picker: scPicker } = useBrandSearchConsole()
  // Best page (Search Console, the app's bestPageFor): the page to publish on and its match, or "New page"; hover /
  // focus: the full URL and its best query. Not connected: "—", the header's ⓘ says where to connect.
  const scOn = scState === 'connected' || scState === 'no-data' || scState === 'low-volume'
  const domainLabel = String(CO_BRAND.domain || '').replace(/^www\./, '')
  const propertyLabel = String(scSiteUrl || '').replace(/^sc-domain:/, '') || domainLabel
  const inkBtn = 'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-ink px-3.5 text-[14px] font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-80'
  const lineBtn = 'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-white px-3.5 text-[14px] font-medium text-stone-800 outline-none hover:border-ink hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-80'
  const textBtn = 'rounded text-[14px] font-medium text-stone-600 underline decoration-[var(--color-line-strong)] underline-offset-2 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60'
  const bestPageFor = (r) => bestPageForRow(r, { state: scState })
  const bestPageColumn = {
    key: 'bestPage',
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
        return <EdgeTip tip={<span className={TIP_2}>{why}</span>} label={`No best page: ${why}`} className="text-small text-stone-400">—</EdgeTip>
      }
      if (b.action === 'create') return <EdgeTip tip={<span className={TIP_2}>No page matches well enough: a new page at {b.suggestedPath}</span>} label={`New page: no page matches well enough: a new page at ${b.suggestedPath}`} className="text-small text-stone-500">New page</EdgeTip>
      return (
        <EdgeTip label={`${b.url}, best query “${b.query}”, ${b.match}% match`} className="flex min-w-0 items-center gap-1.5 text-small"
          tip={<><span className="block font-medium text-stone-900">{b.url}</span><span className={`mt-1 ${TIP_2}`}>Best query “{b.query}” · {b.match}% match</span></>}>
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

  // each filter names itself: the opportunities heading and empty state belong to the "all" view only (AUD-021)
  const views = {
    all: { title: 'Content opportunities', subtitle: `Prompts where ${brandShown} doesn’t appear yet`, empty: null },
    draft: { title: 'Content drafts', subtitle: `Drafts ready to review for prompts where ${brandShown} doesn’t appear yet`, empty: 'No drafts yet' },
    waiting: { title: 'Waiting for publish', subtitle: `Prompts with content waiting to be published`, empty: 'Nothing waiting to be published' },
    monitoring: { title: 'Published & monitoring', subtitle: `Published content being checked on the next syncs`, empty: 'Nothing published and monitored yet' },
    improved: { title: 'Improved prompts', subtitle: `Prompts where ${brandShown} now appears`, empty: 'No improved prompts yet' },
  }
  const view = views[tab] ?? views.all

  return (
    <>
      {/* app (owner, 2026-11-05): the brand guidelines button top-right, level with the title */}
      <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-[34px] font-semibold tracking-[-0.02em] text-stone-900">Content</h1>
          <p className="mt-1 text-body text-stone-600">Let’s create winning copies</p>
        </div>
        {/* What changed at the right end, the guidelines button's height (h-9) */}
        <div className="flex shrink-0 items-start gap-2">
          <GuidelinesButton domain={CO_BRAND.domain} brand={CO_BRAND.name} />
          <WhatChangedButton config={contentChanges} size="md" />
        </div>
      </div>
      <WhatChangedPanel config={contentChanges} />
      {(scState === 'new' || scState === 'skipped' || scState === 'reconnect' || scState === 'no-property' || scOn) && (
        <div data-sc-banner role="status" className="mb-1 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg bg-tint px-4 py-2.5">
          <span className="flex min-w-0 items-center gap-2.5 text-[14px] leading-5 text-stone-700"><GoogleIcon size={16} />
            {scOn
              // app (owner, 2026-11-10): the brand's logo before the domain; the domain primary, weight 500
              ? <>Search Console connected · <span className="inline-flex min-w-0 items-center gap-1.5" data-sc-brand><LogoPlate domain={CO_BRAND.domain} name={CO_BRAND.name} size={20} /><span className="font-medium text-stone-900">{propertyLabel}</span></span></>
              : scState === 'reconnect'
                ? 'Reconnect Search Console so Best page can use live search data'
                : scState === 'no-property'
                  ? `This Google account has no Search Console property for ${domainLabel}. Choose a property, or connect with an account that has access.`
                  : 'Connect Search Console to find the best page for every prompt'}
          </span>
          {scOn ? (
            <span className="flex shrink-0 flex-wrap items-center gap-2">
              <button type="button" onClick={scPicker.openPicker} className={lineBtn}>Change property</button>
              <button type="button" onClick={disconnectSc} disabled={scDisconnecting || scConnecting} aria-busy={scDisconnecting} className={textBtn}>
                {scDisconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </span>
          ) : scState === 'no-property' ? (
            <span className="flex shrink-0 flex-wrap items-center gap-2">
              <button type="button" onClick={scPicker.openPicker} className={inkBtn}>Choose property</button>
              <button type="button" onClick={connectSc} disabled={scConnecting || scDisconnecting} aria-busy={scConnecting} className={lineBtn}>
                {scConnecting ? 'Connecting…' : 'Use another Google account'}
              </button>
              <button type="button" onClick={disconnectSc} disabled={scDisconnecting || scConnecting} aria-busy={scDisconnecting} className={textBtn}>
                {scDisconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </span>
          ) : (
            <button type="button" onClick={connectSc} disabled={scConnecting} aria-busy={scConnecting}
              className={inkBtn}>
              {scConnecting ? 'Connecting…' : scState === 'reconnect' ? 'Reconnect' : 'Connect'}
            </button>
          )}
        </div>
      )}
      {(scState === 'new' || scState === 'skipped' || scState === 'reconnect' || scState === 'no-property') && <ConnectError onRetry={connectSc} className="mb-1" />}{/* app */}
      {scDisconnectError && (
        <p role="alert" className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] leading-5 text-stone-700">
          <span className="flex min-w-0 items-center gap-2"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-negative" aria-hidden />{scDisconnectError}</span>
          <button type="button" onClick={disconnectSc} className="rounded font-medium text-ink underline decoration-[var(--color-line-strong)] underline-offset-2 outline-none hover:decoration-ink focus-visible:ring-2 focus-visible:ring-focus">Retry</button>
        </p>
      )}
      <GscPropertyPicker
        open={scPicker.open}
        loading={scPicker.loading}
        saving={scPicker.saving}
        error={scPicker.error}
        data={scPicker.data}
        domain={domainLabel}
        savedUrl={scSiteUrl}
        onClose={scPicker.closePicker}
        onSave={scPicker.save}
        onReconnect={() => { scPicker.closePicker(); connectSc() }}
        onDisconnect={disconnectSc}
        disconnecting={scDisconnecting}
      />
      <KpiCards rows={all} value={tab} onChange={setTab} />
      <div ref={box} className="min-w-0 scroll-mt-4" aria-label={`${view.title} for ${brandShown}`}>
        <MissedPrompts title={view.title} subtitle={view.subtitle} emptyText={view.empty} statusColumn={statusColumn} extraColumns={[bestPageColumn]} omit={["missedBy"]} onOpen={open} bulkExtra={bulkExtra} rowFilter={rowFilter} onRowHover={onRowHover} promptStyle={(r) => promptVT(r.id)} bulkOnly />
      </div>
      <RowTip tip={tip} />
      {toastNode}
    </>
  )
}
