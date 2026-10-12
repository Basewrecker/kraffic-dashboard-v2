import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import PromptTable, { RowAction } from './PromptTable'
import { MarketplaceIcon } from './icons'
import { account, marketplace } from '../../data/mock'
import { brandName } from '../../utils/brand'
import { useBrandView } from '../../hooks/useBrandView'
import { PromptSetPill, usePromptSet } from './promptSet'
import { openAnswer } from '../answer/AnswerDrawer'

const YOU = brandName(account.domain)
const RESULT = { yours: YOU, competitor: 'Competitor product', category: 'Category page', none: 'No marketplace' }
// chip labels come from the Marketplace visibility segments, so the card and the table never disagree
const segLabel = (key) => marketplace.segments.find((s) => s.key === key).label
const FILTERS = [
  ['all', 'All', () => true],
  ['yours', segLabel('yours'), (r) => r.result === 'yours'],
  ['others', segLabel('others'), (r) => r.result === 'competitor' || r.result === 'category'],
  ['none', segLabel('none'), (r) => r.result === 'none'],
]

// Dev preview of the loading state: add ?loading to the URL.
const loading = import.meta.env.DEV && new URLSearchParams(window.location.search).has('loading')

// marketplace links are only tracked for Dermasuri: no table in a competitor view
export default function MarketplacePrompts() {
  return useBrandView().isOwnBrand ? <MarketplacePromptsTable /> : null
}

function MarketplacePromptsTable() {
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

  const rows = useMemo(() => marketplace.prompts.filter((r) => FILTERS.find((f) => f[0] === filter)[2](r) && (!set.ids || set.ids.has(r.id))), [filter, set.ids])

  const chip = (active) =>
    `inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-small font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${
      active ? 'border-ink bg-ink text-on-ink' : 'border-transparent hover:brightness-[0.97]'
    }`
  const filterBar = (
    <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]" role="toolbar" aria-label="Filter by result">
      <PromptSetPill set={set} />
      {FILTERS.map(([id, label, fn]) => (
        <button key={id} className={chip(filter === id)} style={filter === id ? undefined : { background: 'var(--tint)', color: 'var(--color-stone-700)' }}
          aria-pressed={filter === id} onClick={() => setFilter(id)}>
          {label} <span className="proportional-nums opacity-80">{marketplace.prompts.filter(fn).length}</span>
        </button>
      ))}
    </div>
  )

  const columns = [
    {
      key: 'prompt',
      label: 'Prompt',
      skeleton: '60%',
      mobileText: (r) => r.prompt,
      sort: { value: (r) => r.prompt.toLowerCase(), first: 'asc' },
      cell: (r) => <span title={r.prompt} className="block truncate text-body text-stone-900">{r.prompt}</span>,
    },
    {
      key: 'result',
      label: 'Result',
      width: 148,
      skeleton: '100px',
      csv: (r) => RESULT[r.result],
      cell: (r) => (
        <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-md bg-tint px-2 text-[12px] leading-none ${r.result === 'yours' ? 'font-medium text-ink' : 'text-stone-600'}`}>
          {RESULT[r.result]}
        </span>
      ),
    },
    {
      key: 'markets',
      label: 'Marketplace',
      width: 176,
      skeleton: '90px',
      csv: (r) => r.markets.join(' + '),
      cell: (r) => !r.markets.length ? <span className="text-small text-stone-500">—</span> : (
        <span className="flex items-center gap-2 whitespace-nowrap">
          {r.markets.map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5 text-small text-stone-900"><MarketplaceIcon name={m} size={14} />{m}</span>
          ))}
        </span>
      ),
    },
    {
      key: 'page',
      label: 'Cited page',
      mobile: false,
      width: 240,
      skeleton: '160px',
      csv: (r) => `https://${r.page.domain}${r.page.path}`,
      stopRowClick: true,
      cell: (r) => (
        <a
          href={`https://${r.page.domain}${r.page.path}`}
          target="_blank"
          rel="noopener noreferrer"
          title={`${r.page.domain}${r.page.path}`}
          className="group/link flex min-w-0 items-center gap-1 rounded text-small text-stone-600 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"
        >
          {/* off-marketplace pages show their site, since the domain is the point */}
          <span className="truncate">{r.result === 'none' ? `${r.page.domain}${r.page.path}` : r.page.path}</span>
          <ArrowUpRight size={12} className="shrink-0 text-stone-400 group-hover/link:text-stone-900" aria-hidden />
        </a>
      ),
    },
    {
      key: 'action',
      label: '',
      mobile: false, // phones: the row tap opens the answer
      width: 148, // spec 88; 'View answer' needs 148 incl. padding (same as Visible prompts)
      align: 'right',
      skeleton: '72px',
      csv: false,
      cell: (r, sorted) => <RowAction onClick={(e) => openAnswer({ key: `mp${r.id}`, list: sorted.map((x) => `mp${x.id}`), opener: e.currentTarget })}>View answer</RowAction>,
    },
  ]

  return (
    <PromptTable
      id="marketplace-prompts"
      title="Marketplace prompts"
      subtitle="How each tracked prompt's AI answer links to independent citations"
      count={rows.length}
      rows={rows}
      columns={columns}
      csvName="marketplace-prompts.csv"
      loading={loading}
      filterBar={filterBar}
      mobileRowClick={(r, el) => openAnswer({ key: `mp${r.id}`, list: rows.map((x) => `mp${x.id}`), opener: el })}
    />
  )
}
