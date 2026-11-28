import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
import DrawerShell, { useDrawer } from '../audit/DrawerShell'
import { openDrawer } from '../audit/parts'
import PillRow from '../dashboard/PillRow'
import { PromptSetPill } from '../dashboard/promptSet'
import { MarketplaceIcon, PlatformIcon } from '../dashboard/icons'
import { downloadCsv } from '../dashboard/csv'
import SiteLogo from '../ui/SiteLogo'
import { account, marketplace } from '../../data/mock'
import { ENGINES } from '../../data/brandViews'
import { brandName } from '../../utils/brand'
import { openAnswer } from './AnswerDrawer'

// Marketplace prompts → "View all N": the full list in the shared right-hand drawer (audit/DrawerShell): a search box,
// the card's filter pills, Export CSV and the rows 10 to a page. The card (dashboard/MarketplacePrompts) owns the
// filter and mounts this; the pieces both draw (result words, engine marks, the site cell, the pills, the CSV) live here.
// openMarketplacePrompts({ search }): search = open with the search box focused. URL: ?mprompts=all|search (pushed, so
// Back closes it).
const KEY = 'mprompts'
const VIEWS = { all: { id: 'all' }, search: { id: 'search' } } // fixed objects: useDrawer keeps the one it is given
export const openMarketplacePrompts = ({ search = false } = {}) => openDrawer(KEY, search ? 'search' : 'all')

const YOU = brandName(account.domain)
// what the answer links to, in the Result column; no marketplace link at all is a missing value: "—"
const RESULT = { yours: YOU, competitor: 'Competitor', category: 'Category page' }
export const resultText = (r) => RESULT[r.result] ?? '—'
export const FILTERS = {
  all: () => true,
  yours: (r) => r.result === 'yours',
  others: (r) => r.result === 'competitor' || r.result === 'category',
  none: (r) => r.result === 'none',
}
// the pills over `rows` (the list before the result filter). Your brand's pill stays, muted, when nothing links to
// you; "Marketplace citations" only shows when some answer links to someone else's listing.
export function pillItems(rows, active) {
  const n = (id) => rows.filter(FILTERS[id]).length
  return [
    { id: 'all', label: 'All', count: n('all') },
    { id: 'yours', label: YOU, count: n('yours'), disabled: n('yours') === 0 },
    ...(n('others') > 0 || active === 'others' ? [{ id: 'others', label: 'Marketplace citations', count: n('others') }] : []),
    { id: 'none', label: 'No marketplace', count: n('none'), disabled: n('none') === 0 },
  ]
}

// the engines marketplace links are checked on, in the header's order
const CHECKED = ENGINES.filter((e) => marketplace.prompts.some((r) => r.engines.includes(e.id)))
const engineNames = (r) => CHECKED.filter((e) => r.engines.includes(e.id)).map((e) => e.name)
// every checked engine keeps its place; the ones whose answer doesn't carry the citation are faded
export function EngineMarks({ row }) {
  const names = engineNames(row)
  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={names.length ? `Cited on ${names.join(', ')}` : 'Not cited on any engine'}>
      {CHECKED.map((e) => (
        <span key={e.id} className={`flex ${row.engines.includes(e.id) ? '' : 'opacity-20 grayscale'}`}><PlatformIcon id={e.id} size={16} /></span>
      ))}
    </span>
  )
}
// the cited site: its logo and domain (with `path`, the page too, cut at its end)
export function SiteCell({ row, path = false }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <SiteLogo domain={row.page.domain} className="h-4 w-4 rounded-full" initialClass="text-[9px]" />
      <span className="min-w-0 truncate text-small text-stone-600">{row.page.domain}{path ? row.page.path : ''}</span>
    </span>
  )
}
export const exportRows = (rows) => downloadCsv('marketplace-prompts.csv', rows, [
  { label: 'Prompt', key: 'prompt' },
  { label: 'Cited site', csv: (r) => r.page.domain },
  { label: 'Engines', csv: (r) => engineNames(r).join(', ') },
  { label: 'Result', csv: resultText },
  { label: 'Marketplace', csv: (r) => r.markets.join(' + ') },
  { label: 'Cited page', csv: (r) => `https://${r.page.domain}${r.page.path}` },
])
export const exportClass = 'h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-small font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-stone-50 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'

const PAGE = 10

// rows: the list before the result filter (the card's prompt set already applied) · filter / setFilter: the card's own
export default function MarketplacePromptsDrawer({ rows, filter, setFilter, set }) {
  const drawer = useDrawer(KEY, (id) => VIEWS[id] ?? null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [swapped, setSwapped] = useState(false) // the Answer drawer is standing in for this one
  const input = useRef(null)
  const lastRow = useRef(null)

  const view = drawer.item?.id
  useEffect(() => { if (drawer.open) { setQuery(''); setPage(1); setSwapped(false) } }, [drawer.open])
  // opened from the card's search button: the caret goes straight to the search box
  useEffect(() => { if (drawer.shown && view === 'search') input.current?.focus() }, [drawer.shown, view])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => FILTERS[filter](r) && (!q || r.prompt.toLowerCase().includes(q) || r.page.domain.includes(q)))
  }, [rows, filter, query])
  if (!drawer.item) return null

  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const current = Math.min(page, pages)
  const start = (current - 1) * PAGE
  const visible = list.slice(start, start + PAGE)
  const pick = (id) => { setFilter(id); setPage(1) }

  // a prompt → the Answer drawer stands in for this one; its "← Marketplace prompts" comes back here
  const openPrompt = (r, el) => {
    lastRow.current = el
    setSwapped(true)
    openAnswer({
      key: `mp${r.id}`, list: list.map((x) => `mp${x.id}`),
      back: {
        label: 'Marketplace prompts',
        onBack: () => { setSwapped(false); requestAnimationFrame(() => (lastRow.current?.isConnected ? lastRow.current : drawer.panel.current)?.focus({ preventScroll: true })) },
        onClose: () => { setSwapped(false); drawer.close() },
      },
    })
  }

  const footer = (
    <>
      <span className="tabular-nums">{list.length ? `Showing ${start + 1}–${start + visible.length} of ${list.length}` : 'No prompts to show'}</span>
      <span className="flex items-center gap-3 tabular-nums">
        Page {current} of {pages}
        <span className="flex items-center gap-1.5">
          <PageButton label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)}><ChevronLeft size={16} /></PageButton>
          <PageButton label="Next page" disabled={current === pages} onClick={() => setPage(current + 1)}><ChevronRight size={16} /></PageButton>
        </span>
      </span>
    </>
  )

  return (
    <div className={swapped ? 'invisible' : undefined}>
      <DrawerShell drawer={drawer} title="Marketplace prompts" meta="How each tracked prompt's AI answer links to independent citations" footer={footer}>
        <div className="sticky top-0 z-[1] -mx-4 border-b border-stone-100 bg-surface px-4 pb-3 pt-4 md:-mx-6 md:px-6">
          <div className="flex items-center gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search prompts</span>
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden />
              <input ref={input} value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} placeholder="Search prompts"
                className="h-10 w-full rounded-lg border border-line bg-raised pl-9 pr-3 text-small text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-400 md:h-9" />
            </label>
            <button type="button" onClick={() => exportRows(list)} className={`inline-flex max-md:h-10 ${exportClass}`}><Download size={16} aria-hidden /> Export CSV</button>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <PromptSetPill set={set} />
            <PillRow items={pillItems(rows, filter)} value={filter} onChange={pick} label="Filter by result" bleed="" className="min-w-0 flex-1" />
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="grid h-40 place-items-center text-center">
            <div>
              <p className="text-small text-stone-600">{query.trim() ? `No prompts match “${query.trim()}”` : 'No prompts here yet'}</p>
              {(query.trim() || filter !== 'all') && (
                <button type="button" onClick={() => { setQuery(''); pick('all') }}
                  className="mt-2 inline-flex h-8 items-center rounded-md px-2.5 text-small font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
                  {query.trim() ? 'Clear search' : 'Clear filter'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <ul className="-mx-4 md:-mx-6">
            {visible.map((r) => (
              <li key={r.id} className="border-b border-stone-100">
                <button type="button" onClick={(e) => openPrompt(r, e.currentTarget)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus md:px-6">
                  <span className="truncate text-body text-stone-900">{r.prompt}</span>
                  <span className={`whitespace-nowrap text-right text-small ${r.result === 'yours' ? 'font-medium text-stone-900' : r.result === 'none' ? 'text-stone-500' : 'text-stone-600'}`}>{resultText(r)}</span>
                  <SiteCell row={r} path />
                  <span className="flex items-center justify-end gap-3">
                    {r.markets.length > 0 && (
                      <span className="flex items-center gap-1.5" role="img" aria-label={r.markets.join(' and ')}>
                        {r.markets.map((m) => <MarketplaceIcon key={m} name={m} size={14} />)}
                      </span>
                    )}
                    <EngineMarks row={r} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DrawerShell>
    </div>
  )
}

function PageButton({ label, disabled, onClick, children }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-md border border-line text-stone-600 outline-none transition-colors duration-150 hover:bg-stone-50 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:text-stone-300">
      {children}
    </button>
  )
}
