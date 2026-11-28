import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Download, History, Search } from 'lucide-react'
import Card from './Card'
import PillRow from './PillRow'
import { HeaderIconButton } from './PageHeader'
import { marketplace } from '../../data/mock'
import { useBrandView } from '../../hooks/useBrandView'
import { PromptSetPill, usePromptSet } from './promptSet'
import { EXPORT_EVENT } from '../ui/MobileActions'
import { openAnswer } from '../answer/AnswerDrawer'
import { openMarketplaceDrawer } from '../answer/MarketplaceDrawer'
import MarketplacePromptsDrawer, { EngineMarks, FILTERS, SiteCell, exportClass, exportRows, openMarketplacePrompts, pillItems, resultText } from '../answer/MarketplacePromptsDrawer'

// Marketplace prompts (as the app's card): always 5 rows, "Showing 5 of N", and "View all N →" opens the whole list
// in a side panel (answer/MarketplacePromptsDrawer: search, the same pills, Export CSV, pages). The search button opens
// that panel with its search box focused; the History button opens Marketplace visibility week by week.
const SHOWN = 5
// The card sits in a half-width column on desktop, so its columns follow the card's own width (container queries):
// a narrow card (phones) stacks each row on two lines, a mid one drops Engines, a wide one shows all four.
const COLS = 'grid grid-cols-[minmax(0,1fr)_auto] @min-[440px]:grid-cols-[minmax(0,1fr)_168px_128px] @min-[520px]:grid-cols-[minmax(0,1fr)_200px_108px_132px]'
const WIDE = '@min-[440px]:order-none' // a narrow card reorders the cells (prompt · result / site · engines)

// Dev preview of the loading state: add ?loading to the URL.
const loading = import.meta.env.DEV && new URLSearchParams(window.location.search).has('loading')

// marketplace links are only tracked for Dermasuri: no table in a competitor view
export default function MarketplacePrompts() {
  return useBrandView().isOwnBrand ? <MarketplacePromptsCard /> : null
}

function MarketplacePromptsCard() {
  const [filter, setFilter] = useState('all')
  const scrollNext = useRef(false)
  const set = usePromptSet('marketplace-prompts') // e.g. "Target listings" from the card's insight

  // a segment action ("View 18 prompts →") in the Marketplace visibility card: pre-filter, then scroll here once it has rendered
  useEffect(() => {
    const onShow = (e) => { scrollNext.current = true; setFilter(e.detail?.filter ?? 'all') }
    window.addEventListener('marketplace-prompts:show', onShow)
    return () => window.removeEventListener('marketplace-prompts:show', onShow)
  }, [])
  useEffect(() => {
    if (!scrollNext.current) return
    scrollNext.current = false
    document.querySelector('#marketplace-prompts')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [filter])

  // the list before the result filter (an insight's prompt set narrows it), then the pill's rows
  const base = useMemo(() => marketplace.prompts.filter((r) => !set.ids || set.ids.has(r.id)), [set.ids])
  const rows = useMemo(() => base.filter(FILTERS[filter]), [base, filter])
  const shown = rows.slice(0, SHOWN)

  // phones: the page's ⋯ menu asks for the export (see ui/MobileActions exportTable)
  const exportRef = useRef(null)
  exportRef.current = () => exportRows(rows)
  useEffect(() => {
    const on = (e) => { if (e.detail?.id === 'marketplace-prompts') exportRef.current() }
    window.addEventListener(EXPORT_EVENT, on)
    return () => window.removeEventListener(EXPORT_EVENT, on)
  }, [])

  const open = (r, el) => openAnswer({ key: `mp${r.id}`, list: rows.map((x) => `mp${x.id}`), opener: el })
  const pills = <PillRow items={pillItems(base, filter)} value={filter} onChange={setFilter} label="Filter by result" bleed={set.ids ? '' : '-mx-5 px-5'} className={set.ids ? 'min-w-0 flex-1' : ''} />

  return (
    <>
      <Card id="marketplace-prompts" className="@container flex h-full min-w-0 scroll-mt-6 flex-col overflow-hidden pt-5">
        <div className="flex items-start justify-between gap-3 px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-title font-semibold text-stone-900">Marketplace prompts</h2>
              {!loading && <span className="inline-flex h-6 items-center rounded-full bg-stone-100 px-2 text-[13px] leading-none font-medium text-stone-600 tabular-nums">{rows.length}</span>}
            </div>
            <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600">How each tracked prompt's AI answer links to independent citations</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <HeaderIconButton label="Search prompts" icon={Search} onClick={() => openMarketplacePrompts({ search: true })} className="md:h-9 md:w-9 md:rounded-lg" />
            <HeaderIconButton label="Week by week" icon={History} onClick={(e) => openMarketplaceDrawer({ metric: 'linking', opener: e.currentTarget })} className="md:h-9 md:w-9 md:rounded-lg" />
            <button type="button" onClick={() => exportRows(rows)} className={`hidden md:inline-flex ${exportClass}`}><Download size={16} aria-hidden /> Export CSV</button>
          </div>
        </div>

        <div className="mt-3 px-5">
          {set.ids ? <div className="flex items-center gap-1.5"><PromptSetPill set={set} />{pills}</div> : pills}
        </div>

        {/* column names: only once the card is wide enough for a table */}
        <div className={`${COLS} mt-3 hidden h-9 shrink-0 items-center border-y border-stone-100 bg-tint text-[13px] leading-5 font-medium text-stone-500 @min-[440px]:grid`}>
          <span className="pl-5 pr-3">Prompt</span>
          <span className="px-3">Cited site</span>
          <span className="px-3 @max-[519px]:hidden">Engines</span>
          <span className="pl-3 pr-5 text-right">Result</span>
        </div>

        <div className="mt-3 flex-1 border-t border-stone-100 @min-[440px]:mt-0 @min-[440px]:border-t-0" aria-busy={loading || undefined}>
          {loading ? Array.from({ length: SHOWN }, (_, i) => (
            <div key={i} className={`${COLS} h-[62px] items-center border-b border-stone-100 @min-[440px]:h-11`}>
              <span className="pl-5 pr-3"><span className="block h-4 w-3/5 animate-pulse rounded bg-stone-100" /></span>
              <span className="pl-3 pr-5 @min-[440px]:px-3"><span className="block h-4 w-12 animate-pulse rounded bg-stone-100 @min-[440px]:w-24" /></span>
              <span className="hidden px-3 @min-[520px]:block"><span className="block h-4 w-16 animate-pulse rounded bg-stone-100" /></span>
              <span className="hidden pl-3 pr-5 @min-[440px]:block"><span className="ml-auto block h-4 w-14 animate-pulse rounded bg-stone-100" /></span>
            </div>
          )) : shown.length === 0 ? (
            <div className="grid h-32 place-items-center px-5 text-center">
              <div>
                <p className="text-small text-stone-600">No prompts here yet</p>
                {(filter !== 'all' || set.ids) && (
                  <button type="button" onClick={() => { setFilter('all'); set.clear() }}
                    className="mt-2 inline-flex h-8 items-center rounded-md px-2.5 text-small font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          ) : shown.map((r) => (
            <button key={r.id} type="button" onClick={(e) => open(r, e.currentTarget)}
              className={`${COLS} w-full items-center gap-y-1 border-b border-stone-100 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus @min-[440px]:h-11 @min-[440px]:py-0`}>
              <span className={`order-1 ${WIDE} min-w-0 truncate pl-5 pr-3 text-body text-stone-900`}>{r.prompt}</span>
              <span className={`order-3 ${WIDE} min-w-0 pl-5 pr-3 @min-[440px]:px-3`}><SiteCell row={r} /></span>
              <span className={`order-4 ${WIDE} flex justify-end pl-3 pr-5 @min-[440px]:justify-start @min-[440px]:px-3 @min-[440px]:@max-[519px]:hidden`}><EngineMarks row={r} /></span>
              <span className={`order-2 ${WIDE} whitespace-nowrap pl-3 pr-5 text-right text-small ${r.result === 'yours' ? 'font-medium text-stone-900' : r.result === 'none' ? 'text-stone-500' : 'text-stone-600'}`}>{resultText(r)}</span>
            </button>
          ))}
        </div>

        {!loading && rows.length > 0 && (
          <div className="flex h-12 shrink-0 items-center justify-between gap-3 px-5 text-[13px] leading-[18px]">
            <span className="text-stone-500 tabular-nums">Showing {shown.length} of {rows.length}</span>
            <button type="button" onClick={() => openMarketplacePrompts()}
              className="inline-flex items-center gap-1 rounded font-medium text-stone-700 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus tabular-nums">
              View all {rows.length} <ArrowRight size={12} aria-hidden />
            </button>
          </div>
        )}
      </Card>
      <MarketplacePromptsDrawer rows={base} filter={filter} setFilter={setFilter} set={set} />
    </>
  )
}
