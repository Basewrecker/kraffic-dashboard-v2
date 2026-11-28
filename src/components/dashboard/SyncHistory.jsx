import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import PromptTable, { RowAction } from './PromptTable'
import PillRow from './PillRow'
import SiteLogo from '../ui/SiteLogo'
import NoResult from '../ui/NoResult'
import { PlatformIcon } from './icons'
import { chart } from '../../theme/chart'
import { getHistory } from '../../data/mock'
import { ENGINES, TRACKED_BRANDS, engineName } from '../../data/brandViews'
import { useTracking } from '../../store/trackingSettings'
import { openSyncDrawer } from '../answer/SyncDrawer'
import { useBrandView } from '../../hooks/useBrandView'
import { NO_SCORE, isScore } from '../../utils/score'
import { syncCounts, syncMatches, syncSentence } from '../../utils/syncSentence'

// "Sync history" (as the app, #223): a full-width table in Prompt mix's layout. One row per sync: a plain sentence
// (utils/syncSentence.js) over its date, the Latest / Best tags and the engines that ran; the score with a small ↑ / ↓
// against the sync before (the same number as the Visibility score card, utils/syncChange.js); prompts visible; the
// brands ranked by share that week (the first 4 logos then +N, the brand viewed ringed); Details opens the sync's side
// panel (answer/SyncDrawer.jsx). Filter pills (All / Went up / Went down / No change / Prompts added, with counts),
// Export CSV, 5 / 10 / 25 rows a page. No result from the engine shown in a scan: "—", never 0.
const short = (d) => d.replace(/, \d{4}$/, '') // "Oct 5, 2026" → "Oct 5"
const today = () => new Date().toISOString().slice(0, 10)
const RANKED = 4
const loading = import.meta.env.DEV && new URLSearchParams(window.location.search).has('loading')

// "46% ↓ 4": the arrow and points in the change's colour (a rise green, a drop red); no change: the score alone
export function ScoreMove({ score, delta }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-small text-stone-900 tabular-nums">
      {score}%
      {delta > 0 && <span className="wc-change-up inline-flex items-center gap-0.5 font-medium"><ArrowUp size={13} strokeWidth={2.25} aria-label="up" />{delta}</span>}
      {delta < 0 && <span className="inline-flex items-center gap-0.5 font-medium text-negative"><ArrowDown size={13} strokeWidth={2.25} aria-label="down" />{Math.abs(delta)}</span>}
    </span>
  )
}

// the brands by share in one sync: the first 4 logos, then "+N"; the brand viewed has a 1.5px ink ring
function Ranking({ domains, focal }) {
  if (!domains.length) return <span className="text-small text-stone-500">{NO_SCORE}</span>
  const name = (d) => TRACKED_BRANDS.find((b) => b.domain === d)?.name ?? d
  return (
    <span className="inline-flex items-center gap-2.5" role="img" aria-label={`Ranked: ${domains.map((d, i) => `${i + 1}. ${name(d)}`).join(', ')}`}>
      {domains.slice(0, RANKED).map((d) => (
        <span key={d} className={`inline-flex rounded-md ${d === focal ? 'ring-[1.5px] ring-ink ring-offset-2 ring-offset-[var(--color-surface)]' : ''}`}>
          <SiteLogo domain={d} name={name(d)} className="h-5 w-5 rounded-md" initialClass="text-[10px]" />
        </span>
      ))}
      {domains.length > RANKED && <span className="text-[12px] leading-4 font-medium text-stone-500 tabular-nums">+{domains.length - RANKED}</span>}
    </span>
  )
}

export default function SyncHistory() {
  const view = useBrandView()
  const tracking = useTracking()
  const { syncHistory, focal, isOwnBrand, engine } = view
  const [filter, setFilter] = useState('all')
  const [size, setSize] = useState(10) // 5 / 10 / 25 rows a page, 10 to start

  // each sync's ranking: the brands by their share in that week's history point (the chart's numbers), highest first
  const rankAt = useMemo(() => {
    const h = getHistory({ granularity: 'weekly', range: 'all' })
    const byDate = new Map(h.points.map((p) => [p.date, p]))
    return (date) => {
      const p = byDate.get(short(date))
      if (!p) return []
      return h.series.filter((s) => p[s.key] != null).sort((a, b) => p[b.key] - p[a.key] || (b.label === focal.domain) - (a.label === focal.domain)).map((s) => s.label)
    }
  }, [focal.domain])

  const enabled = tracking.platforms.filter((p) => p.enabled).map((p) => p.id)
  const best = syncHistory.filter((r) => isScore(r.visibility)).reduce((a, r) => (!a || r.visibility > a.visibility ? r : a), null)
  const all = useMemo(() => syncHistory.map((r, i) => {
    const below = syncHistory[i + 1]
    return {
      ...r,
      below,
      prompt: syncSentence(r, below, { engineName: engine === 'all' ? null : engineName(engine) }), // the table's search and phone title read `prompt`
      latest: i === 0,
      best: best?.id === r.id,
      // the engines in that scan (the one shown, under an engine filter)
      engines: engine !== 'all' ? [engine] : ENGINES.filter((e) => enabled.includes(e.id) && (!r.breakdown || r.breakdown.some((b) => b.id === e.id))).map((e) => e.id),
      ranking: rankAt(r.date),
    }
  }), [syncHistory, engine, enabled.join(','), rankAt, best?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const counts = syncCounts(syncHistory)
  const rows = all.filter((r) => syncMatches(filter, r, r.below))
  const details = (r, el) => openSyncDrawer({ syncId: r.id, tab: r.changes?.lost?.length || !r.changes?.gained?.length ? 'lost' : 'gained', opener: el })

  const tag = 'inline-flex h-[18px] items-center rounded bg-tint px-1.5 text-[12px] leading-none font-medium text-stone-700'
  const columns = [
    {
      key: 'prompt',
      label: 'Sync',
      skeleton: '70%',
      mobileText: (r) => r.prompt,
      csv: (r) => r.prompt,
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate text-body text-stone-900 tabular-nums">{r.prompt}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[13px] leading-[18px] text-stone-500">
            <span className="whitespace-nowrap tabular-nums">{short(r.date)}</span>
            {r.latest && <span className={tag}>Latest</span>}
            {r.best && <span className={tag}>Best</span>}
            <span className="flex items-center gap-1" aria-label={`Engines: ${r.engines.map(engineName).join(', ')}`}>
              {r.engines.map((e) => <PlatformIcon key={e} id={e} size={14} />)}
            </span>
          </div>
        </div>
      ),
    },
    { key: 'date', label: 'Date', desktop: false, mobile: false, csv: (r) => r.date, cell: () => null },
    {
      key: 'score',
      label: 'Score',
      width: 168,
      skeleton: '64px',
      csv: (r) => (isScore(r.visibility) ? `${r.visibility}%` : ''),
      mobileText: (r) => (isScore(r.visibility) ? `${r.visibility}%${r.delta ? ` ${r.delta > 0 ? '↑' : '↓'} ${Math.abs(r.delta)}` : ''}` : NO_SCORE),
      cell: (r) => (isScore(r.visibility) ? <ScoreMove score={r.visibility} delta={r.delta} /> : <NoResult engine={engine} date={r.latest ? null : r.date} className="text-small" />),
    },
    { key: 'change', label: 'Change (pts)', desktop: false, mobile: false, csv: (r) => (r.delta == null ? '' : String(r.delta)), cell: () => null },
    {
      key: 'visible',
      label: 'Prompts visible',
      width: 200,
      skeleton: '72px',
      colClass: '[@media(max-width:1099px)]:hidden',
      csv: (r) => (isScore(r.visible) ? `${r.visible} / ${r.total}` : `/ ${r.total}`),
      mobileText: (r) => `${isScore(r.visible) ? r.visible : NO_SCORE} / ${r.total} visible`,
      cell: (r) => <span className={`whitespace-nowrap text-small tabular-nums ${isScore(r.visible) ? 'text-stone-600' : 'text-stone-500'}`}>{isScore(r.visible) ? r.visible : NO_SCORE} / {r.total}</span>,
    },
    {
      key: 'ranking',
      label: 'Brand ranking',
      width: 216,
      mobile: 'extra',
      skeleton: '120px',
      csv: (r) => r.ranking.map((d) => TRACKED_BRANDS.find((b) => b.domain === d)?.name ?? d).join(' > '),
      cell: (r) => <Ranking domains={r.ranking} focal={focal.domain} />,
    },
    {
      key: 'action',
      label: '',
      mobile: false, // phones: the row tap opens it
      width: 96,
      align: 'right',
      skeleton: '48px',
      csv: false,
      cell: (r) => <RowAction onClick={(e) => details(r, e.currentTarget)}>Details</RowAction>,
    },
  ]

  const pills = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'up', label: 'Went up', count: counts.up, dot: chart.c1, disabled: !counts.up },
    { id: 'down', label: 'Went down', count: counts.down, dot: chart.c2, disabled: !counts.down },
    { id: 'same', label: 'No change', count: counts.same, dot: chart.c3, disabled: !counts.same },
    { id: 'added', label: 'Prompts added', count: counts.added, dot: chart.c4, disabled: !counts.added },
  ]

  return (
    <PromptTable
      id="sync-history"
      title="Sync history"
      subtitle={isOwnBrand ? null : `${focal.name}’s syncs`}
      count={all.length}
      rows={rows}
      columns={columns}
      csvName={`sync-history-${today()}.csv`}
      loading={loading}
      searchable={false}
      pageSizes={[5, 10, 25]}
      pageSize={size}
      onPageSize={setSize}
      rowHeight="h-[52px]"
      filterBar={all.length > 0 && <PillRow items={pills} value={filter} onChange={setFilter} label="Filter syncs" />}
      onRowClick={(r, el) => details(r, el)}
      emptyMessage={all.length ? 'No syncs match this filter' : 'No syncs on record yet'}
      onClearFilters={filter !== 'all' ? () => setFilter('all') : null}
    />
  )
}
