// Read-only prompt tables for a competitor view ("Viewing as X"): no statuses, briefs, tracking or bulk
// actions — only search, sort, filters and Export. Dermasuri is marked only by font-600 ink.
import { useEffect, useMemo, useState } from 'react'
import PromptTable, { TopicTag } from './PromptTable'
import LogoStack from './LogoStack'
import { alsoMissing } from './MissedPrompts'
import { PlatformFilterPill, usePlatformFilter } from './PlatformFilter'
import { SyncFilterPill, useSyncFilter } from './syncFilter'
import { PromptSetPill, usePromptSet } from './promptSet'
import { OWN } from '../../data/brandViews'
import { useBrandView } from '../../hooks/useBrandView'
import { brandName } from '../../utils/brand'

// favicon stack (+ the name when there's only one; Dermasuri's in font-600 ink)
function Winners({ domains, focal }) {
  if (!domains.length) return <span className="text-small text-stone-400">No brand cited</span>
  return (
    <span className="inline-flex items-center">
      <LogoStack domains={domains} />
      {domains.length === 1 && <span className={`ml-2 truncate text-small ${domains[0] === OWN.domain ? 'font-semibold text-ink' : 'text-stone-700'}`}>{brandName(domains[0])}</span>}
    </span>
  )
}

// showTopic=false when a topic pill already says it (the row then shrinks to one line)
const promptCell = (showTopic = true) => (r) => (
  <div className="min-w-0">
    <div title={r.prompt} className="truncate text-body text-stone-900">{r.prompt}</div>
    {showTopic && <div className="mt-0.5 flex items-center gap-2 text-[13px] leading-[18px] text-stone-500"><TopicTag topic={r.topic} /></div>}
  </div>
)

function useTopics(list) {
  return useMemo(() => {
    const n = {}
    list.forEach((r) => { n[r.topic] = (n[r.topic] ?? 0) + 1 })
    return Object.entries(n).sort((a, b) => b[1] - a[1])
  }, [list])
}

function TopicChips({ list, topic, setTopic, before }) {
  const topics = useTopics(list)
  const chip = (active) =>
    `inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-small font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${
      active ? 'border-ink bg-ink text-on-ink' : 'border-transparent hover:brightness-[0.97]'
    }`
  const idle = { background: 'var(--tint)', color: 'var(--color-stone-700)' }
  return (
    <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]" role="toolbar" aria-label="Filter by topic">
      {before}
      <PlatformFilterPill />
      <button className={chip(!topic)} style={topic ? idle : undefined} aria-pressed={!topic} onClick={() => setTopic(null)}>
        All <span className="proportional-nums opacity-80">{list.length}</span>
      </button>
      {topics.map(([t, n]) => (
        <button key={t} className={chip(topic === t)} style={topic === t ? undefined : idle} aria-pressed={topic === t} onClick={() => setTopic(t)}>
          {t} <span className="proportional-nums opacity-80">{n}</span>
        </button>
      ))}
    </div>
  )
}

// "Where X is missing": prompts the focal brand doesn't appear in, and who wins them instead
export function FocalMissedTable() {
  const { missedPrompts, focal } = useBrandView()
  const [topic, setTopic] = useState(null)
  useEffect(() => setTopic(null), [focal.domain])
  const { platform, setPlatform, matches, label } = usePlatformFilter()
  const syncF = useSyncFilter('lost')
  const set = usePromptSet('missed-prompts')
  const rows = useMemo(
    () => missedPrompts.filter((r) => (!topic || r.topic === topic) && matches(r.platforms) && (!syncF.ids || syncF.ids.has(r.id)) && (!set.ids || set.ids.has(r.id))),
    [missedPrompts, topic, platform, syncF.sync, set.ids],
  )
  return (
    <PromptTable
      id="missed-prompts"
      title={`Where ${focal.name} is missing`}
      subtitle={`Prompts where ${focal.name} doesn't appear in AI answers`}
      count={missedPrompts.length}
      rows={rows}
      rowHeight={topic ? 'h-11' : 'h-[52px]'}
      csvName={`${focal.key}-missed-prompts.csv`}
      defaultSort={{ key: 'winners', dir: 'desc' }}
      filterBar={<TopicChips list={missedPrompts} topic={topic} setTopic={setTopic} before={<><PromptSetPill set={set} />{syncF.ids && <SyncFilterPill kind="lost" sync={syncF.sync} onClear={syncF.clear} />}</>} />}
      emptyMessage={platform ? `No missed prompts on ${label}` : `No missed prompts in ${topic ?? 'this view'}`}
      onClearFilters={() => { setTopic(null); setPlatform(null); syncF.clear(); set.clear() }}
      columns={[
        { key: 'prompt', label: 'Prompt', skeleton: '60%', sort: { value: (r) => r.prompt.toLowerCase(), first: 'asc' }, cell: promptCell(!topic) },
        {
          key: 'winners',
          label: 'Appearing for',
          width: 240,
          skeleton: '96px',
          // most contested first; Dermasuri wins break ties
          sort: { value: (r) => r.winners.length * 10 + (r.winners.includes(OWN.domain) ? 1 : 0), first: 'desc' },
          csv: (r) => r.winners.map(brandName).join(', '),
          cell: (r) => <Winners domains={r.winners} focal={focal.domain} />,
        },
        {
          key: 'missing',
          label: 'Missed by',
          width: 124,
          skeleton: '56px',
          // the brand being viewed first
          cell: (r) => <LogoStack domains={alsoMissing(r.id, r.winners, focal.domain)} />,
        },
      ]}
    />
  )
}

// "Where rivals win": every prompt another tracked brand appears in, and whether the focal brand is there too
export function FocalRivalsTable() {
  const { rivalPrompts, focal, rivals } = useBrandView()
  const [rival, setRival] = useState(null)
  useEffect(() => setRival(null), [focal.domain])
  const rows = useMemo(() => rivalPrompts.filter((r) => !rival || r.winners.includes(rival)), [rivalPrompts, rival])
  const tab = (active) =>
    `inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-small font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${
      active ? 'bg-ink text-on-ink' : 'bg-tint text-stone-700 hover:brightness-[0.97]'
    }`
  return (
    <PromptTable
      id="prompt-mix"
      title="Where rivals win"
      subtitle={`Prompts other tracked brands appear in, and whether ${focal.name} does too`}
      count={rivalPrompts.length}
      rows={rows}
      rowHeight="h-[52px]"
      csvName={`${focal.key}-rival-prompts.csv`}
      defaultSort={{ key: 'focal', dir: 'asc' }}
      filterBar={(
        <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]" role="toolbar" aria-label="Filter by brand">
          <button className={tab(!rival)} aria-pressed={!rival} onClick={() => setRival(null)}>All <span className="proportional-nums opacity-80">{rivalPrompts.length}</span></button>
          {rivals.map((b) => (
            <button key={b.domain} className={tab(rival === b.domain)} aria-pressed={rival === b.domain} onClick={() => setRival(b.domain)}>
              {b.name} <span className="proportional-nums opacity-80">{rivalPrompts.filter((r) => r.winners.includes(b.domain)).length}</span>
            </button>
          ))}
        </div>
      )}
      columns={[
        { key: 'prompt', label: 'Prompt', skeleton: '60%', sort: { value: (r) => r.prompt.toLowerCase(), first: 'asc' }, cell: promptCell() },
        {
          key: 'winners',
          label: 'Appears',
          width: 240,
          skeleton: '96px',
          sort: { value: (r) => r.winners.length, first: 'desc' },
          csv: (r) => r.winners.map(brandName).join(', '),
          cell: (r) => <Winners domains={r.winners} focal={focal.domain} />,
        },
        {
          key: 'focal',
          label: focal.name,
          width: 148,
          align: 'right',
          skeleton: '64px',
          // missing first: those are the prompts that matter to the focal brand
          sort: { value: (r) => (r.focalVisible ? 1 : 0), first: 'asc' },
          csv: (r) => (r.focalVisible ? 'Also appears' : 'Missing'),
          cell: (r) => (r.focalVisible
            ? <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full bg-tint px-2 text-[13px] font-medium text-stone-600">Also appears</span>
            : <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full bg-tint px-2 text-[13px] font-medium text-ink">Missing</span>),
        },
      ]}
    />
  )
}

