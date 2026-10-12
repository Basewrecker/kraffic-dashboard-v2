import { useMemo } from 'react'
import { ArrowUpRight } from 'lucide-react'
import PromptTable, { NewTag, RecoveredTag, RowAction } from './PromptTable'
import { PlatformIcon } from './icons'
import { PlatformFilterPill, usePlatformFilter } from './PlatformFilter'
import { SyncFilterPill, useSyncFilter } from './syncFilter'
import { PromptSetPill, usePromptSet } from './promptSet'
import { account, publishedContent, platformNames } from '../../data/mock'
import { useBrandView } from '../../hooks/useBrandView'
import { openAnswer } from '../answer/AnswerDrawer'

import MissedPrompts from './MissedPrompts'
import CompetitorPrompts from './CompetitorPrompts'
import { FocalMissedTable, FocalRivalsTable } from './FocalTables'

// Dermasuri gets the working tables (statuses, briefs, alerts); a competitor view gets read-only ones
export function MissedPromptsTable() {
  return useBrandView().isOwnBrand ? <MissedPrompts /> : <FocalMissedTable />
}
export function CompetitorPromptsTable() {
  return useBrandView().isOwnBrand ? <CompetitorPrompts /> : <FocalRivalsTable />
}


// "Sep 7, 2026" → "7 Sep 2026"
const fmtDate = (s) => {
  const [mon, day, year] = s.replace(',', '').split(' ')
  return `${day} ${mon} ${year}`
}
const isNew = (r) => r.firstVisible === account.lastSync
// Recovered: we published content for it, and a later sync found it visible
const isRecovered = (r) => publishedContent.some((p) => p.prompt === r.prompt && r.firstVisible && Date.parse(r.firstVisible) > Date.parse(p.publishedOn))

// Dev preview of the loading state: add ?loading to the URL.
const loading = import.meta.env.DEV && new URLSearchParams(window.location.search).has('loading')

const promptCol = ({ tagNew }) => ({
  key: 'prompt',
  label: 'Prompt',
  skeleton: '60%',
  mobileText: (r) => r.prompt,
  sort: { value: (r) => r.prompt.toLowerCase(), first: 'asc' },
  cell: (r) => (
    <div className="flex min-w-0 items-center">
      <span title={r.prompt} className="truncate text-body font-normal text-stone-900">{r.prompt}</span>
      {tagNew && (isRecovered(r) ? <RecoveredTag /> : isNew(r) && <NewTag />)}
    </div>
  ),
})

const foundInCol = {
  key: 'discovery',
  label: 'Found in',
  width: 96,
  skeleton: '40px',
  csv: (r) => r.platforms.map((p) => platformNames[p]).join(', '),
  cell: (r) => (
    <div className="flex items-center gap-1.5">
      {r.platforms.map((p) => (
        <span key={p} title={platformNames[p]} className="flex items-center">
          <PlatformIcon id={p === 'google' ? 'aio' : p} size={16} />
        </span>
      ))}
    </div>
  ),
}

const firstVisibleCol = {
  key: 'firstVisible',
  label: 'First visible',
  width: 112,
  skeleton: '80px',
  tdClass: 'num text-small text-stone-600',
  sort: { value: (r) => Date.parse(r.firstVisible), first: 'desc' },
  csv: (r) => fmtDate(r.firstVisible),
  cell: (r) => fmtDate(r.firstVisible),
}

// Answer drawer keys: Dermasuri's rows use numeric ids (tracked "v12"), competitor views tracked ids
const answerKey = (r) => (typeof r.id === 'number' ? `v${r.id}` : r.id)
const actionCol = (label, icon) => ({
  key: 'action',
  label: '',
  mobile: false, // phones: the row tap opens the answer
  width: 148, // spec 120; 'View answer ↗' needs 148 incl. padding
  align: 'right',
  skeleton: '90px',
  csv: false,
  cell: (r, sorted) => (
    <RowAction icon={icon} onClick={(e) => openAnswer({ key: answerKey(r), list: sorted.map(answerKey), opener: e.currentTarget })}>{label}</RowAction>
  ),
})

export function VisiblePromptsTable() {
  const { platform, setPlatform, matches, label } = usePlatformFilter()
  const syncF = useSyncFilter('gained')
  const set = usePromptSet('visible-prompts')
  const { visiblePrompts, focal, isOwnBrand } = useBrandView()
  const rows = useMemo(
    () => visiblePrompts.filter((r) => matches(r.platforms) && (!syncF.ids || syncF.ids.has(r.id)) && (!set.ids || set.ids.has(r.id))),
    [visiblePrompts, platform, syncF.sync, set.ids],
  )
  return (
    <PromptTable
      id="visible-prompts"
      title={isOwnBrand ? 'Visible prompts' : `Where ${focal.name} appears`}
      subtitle={`Prompts where ${focal.name} appears in AI answers`}
      rows={rows}
      filterBar={(platform || syncF.ids || set.ids) && (
        <div className="flex gap-1.5">
          <PromptSetPill set={set} />
          {syncF.ids && <SyncFilterPill kind="gained" sync={syncF.sync} onClear={syncF.clear} />}
          <PlatformFilterPill />
        </div>
      )}
      emptyMessage={platform ? `Not visible on ${label} yet` : undefined}
      onClearFilters={platform || syncF.ids || set.ids ? () => { setPlatform(null); syncF.clear(); set.clear() } : null}
      csvName={isOwnBrand ? 'visible-prompts.csv' : `${focal.key}-visible-prompts.csv`}
      loading={loading}
      defaultSort={{ key: 'firstVisible', dir: 'desc' }}
      mobileRowClick={(r, el) => openAnswer({ key: answerKey(r), list: rows.map(answerKey), opener: el })}
      columns={[promptCol({ tagNew: isOwnBrand }), foundInCol, firstVisibleCol, actionCol('View answer', ArrowUpRight)]}
    />
  )
}
