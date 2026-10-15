import { useMemo, useState } from 'react'
import { ArrowUpRight, Bell, X } from 'lucide-react'
import PromptTable, { RowAction, TopicTag } from './PromptTable'
import { getCompetitorColor } from '../../theme/colors'
import { CompetitorCompareSheet, WonFor } from './CompetitorCompareSheet'
import { BriefModal } from './MissedPromptSheet'
import { Favicon, useToast } from './overlays'
import { PlatformIcon } from './icons'
import { account, competitorPrompts, competitorSummary, guessCategory, platformNames, recentSyncs, visiblePrompts } from '../../data/mock'
import { TRACKED_BRANDS, appearances } from '../../data/brandViews'
import { openAnswer } from '../answer/AnswerDrawer'
import { buildBrief } from '../../utils/brief'
import { PlatformFilterPill, usePlatformFilter } from './PlatformFilter'
import { brandName } from '../../utils/brand'

const iconId = (p) => (p === 'google' ? 'aio' : p)
const prevSync = recentSyncs[recentSyncs.length - 2].replace(', 2026', '').split(' ').reverse().join(' ') // "28 Sep"
// Default order: Missing first, then New wins, then the longest streak.
const urgency = (r) => (r.you === 'missing' ? 1000 : 0) + (r.isNew ? 100 : 0) + (r.streak ?? 0)

// "Prompt mix": who shows up for each prompt — the competitors' wins plus Dermasuri's own appearances, in one table.
// Dermasuri rows = prompts where Dermasuri appears, with its own cited page (or "Mentioned, not linked");
// "New" / ▲ = first appeared on the latest sync, the same rule as a competitor's new win.
const OWN = account.domain
const lastSync = recentSyncs.at(-1)
const ownRows = visiblePrompts.map((v) => {
  const a = appearances[`v${v.id}`]?.[OWN]
  const since = recentSyncs.indexOf(v.firstVisible)
  // new = first visible on the latest sync (unknown first-visible day, e.g. no earlier sync to compare: not new)
  const isNew = !!v.firstVisible && v.firstVisible === lastSync
  return {
    id: `own-${v.id}`,
    answerKey: `v${v.id}`,
    prompt: v.prompt,
    topic: guessCategory(v.prompt),
    competitor: OWN,
    own: true,
    platforms: v.platforms,
    isNew,
    // syncs in a row it has been visible; unknown (null) without a first-visible day
    streak: !v.firstVisible ? null : since === -1 ? recentSyncs.length : recentSyncs.length - since,
    // the brand's own rows: its status on the prompt (these are the prompts it appears in: New or Visible)
    you: isNew ? 'new' : 'visible',
    theirPage: a?.cited ? { domain: OWN, path: a.citedPage } : null,
  }
})
const allRows = [...competitorPrompts, ...ownRows]
const ownSummary = { domain: OWN, total: ownRows.length, newWins: ownRows.filter((r) => r.isNew).length }

// the selected brand: ?brand=<key> (URL wins), else the saved filters, else All
const FILTERS_KEY = `kraffic:prompts:filters:${OWN}`
const keyOf = (d) => TRACKED_BRANDS.find((b) => b.domain === d)?.key
const domainOf = (k) => TRACKED_BRANDS.find((b) => b.key === k)?.domain ?? null
function readBrand() {
  const fromUrl = domainOf(new URLSearchParams(window.location.search).get('brand'))
  if (fromUrl) return fromUrl
  try { return domainOf(JSON.parse(window.localStorage.getItem(FILTERS_KEY))?.mixBrand) } catch { return null }
}
function writeBrand(d) {
  const url = new URL(window.location.href)
  if (d) url.searchParams.set('brand', keyOf(d)); else url.searchParams.delete('brand')
  window.history.replaceState(window.history.state, '', url)
  try {
    const saved = JSON.parse(window.localStorage.getItem(FILTERS_KEY)) ?? {}
    window.localStorage.setItem(FILTERS_KEY, JSON.stringify({ ...saved, mixBrand: d ? keyOf(d) : null }))
  } catch { /* storage unavailable */ }
}
const today = () => new Date().toISOString().slice(0, 10)

// Dev preview of the loading state: add ?loading to the URL.
const loading = import.meta.env.DEV && new URLSearchParams(window.location.search).has('loading')

// the "Dermasuri" column: on competitor rows, whether Dermasuri is there too; on Dermasuri rows, nothing to repeat
function YouPill({ you }) {
  if (you === 'visible') return <span className="whitespace-nowrap text-[13px] text-stone-600">Visible</span>
  if (you === 'new') return <span className="whitespace-nowrap text-[13px] font-medium text-ink">New</span>
  return you === 'cited'
    ? <span className="whitespace-nowrap text-[13px] text-stone-600">Also there</span>
    : <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full bg-tint px-2 text-[13px] font-medium text-ink">Missing</span>
}

const toBriefRow = (r) => ({
  prompt: r.prompt,
  topic: r.topic,
  streak: r.streak,
  competitors: [r.competitor],
  sources: [r.theirPage],
  angle: r.angle,
  briefLine: `${brandName(r.competitor)} has won it for ${r.streak} sync${r.streak === 1 ? '' : 's'}; ${account.name} is ${r.you === 'cited' ? 'also cited' : 'missing'}`,
})

export default function CompetitorPrompts() {
  const [tab, setTabState] = useState(readBrand) // brand domain or null = All
  const setTab = (d) => { setTabState(d); writeBrand(d) }
  const [newOnly, setNewOnly] = useState(false)
  const [alertOpen, setAlertOpen] = useState(true)
  const [tracked, setTracked] = useState(() => new Set(competitorPrompts.filter((r) => r.tracked).map((r) => r.id)))
  const [openId, setOpenId] = useState(null)
  const [brief, setBrief] = useState(null)
  const [toastNode, toast] = useToast()
  const { platform, setPlatform, matches } = usePlatformFilter()

  const rows = useMemo(
    () => allRows.filter((r) => (!tab || r.competitor === tab) && (!newOnly || r.isNew) && matches(r.platforms)),
    [tab, newOnly, platform],
  )
  const topNew = competitorSummary.filter((c) => c.newWins > 0).sort((a, b) => b.newWins - a.newWins)[0]

  const toggleTrack = (r) => {
    const on = !tracked.has(r.id)
    setTracked((t) => { const n = new Set(t); on ? n.add(r.id) : n.delete(r.id); return n })
    toast(on ? 'You’ll be notified if this changes' : 'Stopped tracking this prompt')
  }
  const openBrief = (r) => setBrief(buildBrief([toBriefRow(r)], account))
  const copyBrief = async () => {
    try { await navigator.clipboard.writeText(brief.md) } catch { /* clipboard blocked: the brief is still on screen */ }
    toast('Brief copied')
  }
  const exportBrief = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([brief.md], { type: 'text/markdown' }))
    a.download = `${brief.prompts[0].replace(/\W+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const columns = [
    {
      key: 'prompt',
      label: 'Prompt',
      skeleton: '60%',
      mobileText: (r) => r.prompt,
      sort: { value: (r) => r.prompt.toLowerCase(), first: 'asc' },
      csv: (r) => r.prompt,
      cell: (r) => (
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span title={r.prompt} className="truncate text-body text-stone-900">{r.prompt}</span>
            {tracked.has(r.id) && <Bell size={14} className="shrink-0 text-stone-500" aria-label="Tracked" />}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[13px] leading-[18px] text-stone-500">
            {/* no topic: nothing before the status (no empty tag, no leading ·) */}
            {r.topic && <><TopicTag topic={r.topic} /><span aria-hidden>·</span></>}
            <WonFor row={r} />
            {/* an engine filter already says which engine: no per-row icons */}
            {!platform && (
              <span className="flex items-center gap-1" aria-label={`Won on ${r.platforms.map((p) => platformNames[p]).join(', ')}`}>
                {r.platforms.map((p) => <span key={p} title={platformNames[p]} className="flex"><PlatformIcon id={iconId(p)} size={14} /></span>)}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'competitor',
      label: 'Brand',
      width: 168,
      skeleton: '140px',
      sort: { value: (r) => brandName(r.competitor).toLowerCase(), first: 'asc' },
      csv: (r) => brandName(r.competitor),
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2 text-small text-stone-800">
          <Favicon domain={r.competitor} size={16} />
          <span className={`min-w-0 truncate ${r.own ? 'font-semibold text-ink' : ''}`} title={brandName(r.competitor)}>{brandName(r.competitor)}</span>
        </span>
      ),
    },
    {
      key: 'theirPage',
      label: 'Cited page',
      mobile: false,
      width: 200,
      colClass: '[@media(max-width:1099px)]:hidden', // below 1100px wide it goes first
      skeleton: '180px',
      csv: (r) => (r.theirPage ? `https://${r.theirPage.domain}${r.theirPage.path}` : 'Mentioned, not linked'),
      cell: (r) => !r.theirPage ? <span className="text-small text-stone-500">Mentioned, not linked</span> : (
        <div className="flex min-w-0 items-center gap-1.5">
          {/* a site's home page is cited as "/": show the site instead */}
          <span title={r.theirPage.domain} className="truncate text-small text-stone-600">{r.theirPage.path === '/' ? r.theirPage.domain : r.theirPage.path}</span>
          <a
            href={`https://${r.theirPage.domain}${r.theirPage.path}`}
            target="_blank"
            rel="noopener noreferrer"
            data-stop-row
            aria-label={`Open ${r.theirPage.domain}${r.theirPage.path} in a new tab`}
            className="grid h-6 w-6 shrink-0 place-items-center rounded text-stone-400 outline-none hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ArrowUpRight size={14} />
          </a>
        </div>
      ),
    },
    {
      key: 'you',
      label: account.name,
      width: 112,
      colClass: '[@media(max-width:959px)]:hidden', // then this one, below 960px
      skeleton: '80px',
      sort: { value: urgency, first: 'desc' },
      csv: (r) => ({ visible: 'Visible', new: 'New', cited: 'Also there' }[r.you] ?? 'Missing'),
      cell: (r) => <YouPill you={r.you} />,
    },
    {
      key: 'action',
      label: '',
      mobile: false, // phones: the row tap does it
      width: 132, // always whole: 'View answer' with the cell's padding
      align: 'right',
      skeleton: '72px',
      csv: false,
      cell: (r) => (r.own
        ? <RowAction onClick={(e) => openOwn(r, e.currentTarget)}>View answer</RowAction>
        : <RowAction onClick={() => setOpenId(r.id)}>Compare</RowAction>),
    },
  ]

  const tabClass = (active) =>
    `inline-flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-small font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${
      active ? 'bg-ink text-on-ink' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
    }`
  const countClass = (active) => `proportional-nums ${active ? 'text-on-ink/80' : 'text-stone-500'}`
  const selectTab = (d) => { setTab(d); setNewOnly(false) }

  const filterBar = (
    <div>
      <div className="-mx-5 flex items-center gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]" role="toolbar" aria-label="Filter by brand">
        <button className={tabClass(!tab)} aria-pressed={!tab} onClick={() => selectTab(null)}>
          All <span className={countClass(!tab)}>{allRows.length}</span>
        </button>
        {/* Dermasuri right after All: ink dot, its count, its ▲ */}
        <button className={tabClass(tab === OWN)} aria-pressed={tab === OWN} onClick={() => selectTab(OWN)}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${tab === OWN ? 'bg-on-ink' : 'bg-ink'}`} aria-hidden />
          <span className="font-semibold">{account.name}</span>
          <span className={countClass(tab === OWN)}>{ownSummary.total}</span>
          {ownSummary.newWins > 0 && <span className={`text-[12px] font-semibold proportional-nums ${tab === OWN ? 'text-on-ink' : 'text-ink'}`} aria-label={`${ownSummary.newWins} new`}>▲{ownSummary.newWins}</span>}
        </button>
        {competitorSummary.map((c) => (
          <button key={c.domain} className={tabClass(tab === c.domain)} aria-pressed={tab === c.domain} onClick={() => selectTab(c.domain)}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: getCompetitorColor(c.domain).fill }} aria-hidden />
            {brandName(c.domain)}
            <span className={countClass(tab === c.domain)}>{c.total}</span>
            {c.newWins > 0 && <span className="text-[12px] font-semibold text-ink proportional-nums" aria-label={`${c.newWins} new`}>▲{c.newWins}</span>}
          </button>
        ))}
        <span className="ml-2"><PlatformFilterPill /></span>
        {newOnly && (
          <button onClick={() => setNewOnly(false)} className="ml-2 inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-tint pl-2.5 pr-1.5 text-[13px] font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus">
            New wins only <X size={14} aria-label="Show all" />
          </button>
        )}
      </div>
    </div>
  )

  const openRow = competitorPrompts.find((r) => r.id === openId)
  // Dermasuri rows open the answer itself; ↑/↓ in the drawer walk the visible Dermasuri rows
  const openOwn = (r, opener) => openAnswer({ key: r.answerKey, list: rows.filter((x) => x.own).map((x) => x.answerKey), opener })

  return (
    <>
      <PromptTable
        id="prompt-mix"
        title="Prompt mix"

        count={rows.length}
        rows={rows}
        columns={columns}
        filterKeys={['prompt', 'competitor']}
        csvName={`prompt-mix-${today()}.csv`}
        loading={loading}
        defaultSort={{ key: 'you', dir: 'desc' }}
        filterBar={filterBar}
        onRowClick={(r, el) => (r.own ? openOwn(r, el) : setOpenId(r.id))}
        rowHeight="h-[52px]"
        notice={topNew && alertOpen && (
          <span role="status" className="proportional-nums">
            {brandName(topNew.domain)} won {topNew.newWins} new prompt{topNew.newWins === 1 ? '' : 's'} since {prevSync} ·{' '}
            <button onClick={() => { setTab(topNew.domain); setNewOnly(true) }} className="rounded font-medium text-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Review</button>
            <button onClick={() => setAlertOpen(false)} aria-label="Dismiss" className="ml-1.5 inline-grid h-4 w-4 place-items-center rounded align-[-2px] text-stone-500 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><X size={12} /></button>
          </span>
        )}
        emptyMessage="No prompts match these filters"
        onClearFilters={() => { setTab(null); setNewOnly(false); setPlatform(null) }}
      />
      <CompetitorCompareSheet
        row={openRow}
        tracked={openRow ? tracked.has(openRow.id) : false}
        onClose={() => setOpenId(null)}
        onCreateBrief={openBrief}
        onToggleTrack={toggleTrack}
      />
      <BriefModal brief={brief} onClose={() => setBrief(null)} onCopy={copyBrief} onExport={exportBrief} />
      {toastNode}
    </>
  )
}
