import { useEffect, useMemo, useState } from 'react'
import { Download, FileText, Loader, X } from 'lucide-react'
import PromptTable, { GhostButton, TopicTag } from './PromptTable'
import StatusControl, { STATUSES } from './StatusControl'
import { BriefModal, MissedPromptSheet } from './MissedPromptSheet'
import { useToast } from './overlays'
import { PlatformIcon } from './icons'
import { downloadCsv } from './csv'
import { PlatformFilterPill, usePlatformFilter } from './PlatformFilter'
import { SyncFilterPill, useSyncFilter } from './syncFilter'
import { PromptSetPill, usePromptSet } from './promptSet'
import { account, missedPrompts, missedTopics, platformNames } from '../../data/mock'
import { assignPriorities } from '../../utils/priority'
import LogoStack from './LogoStack'
import { OWN, TRACKED_BRANDS, appearances } from '../../data/brandViews'
import { buildBrief } from '../../utils/brief'
import { brandName } from '../../utils/brand'

const priorities = assignPriorities(missedPrompts)
const iconId = (p) => (p === 'google' ? 'aio' : p)

// Dev preview of the loading state: add ?loading to the URL.
const loading = import.meta.env.DEV && new URLSearchParams(window.location.search).has('loading')

// tracked brands that aren't in this prompt's answer either (Dermasuri first: it's missing by definition here)
export function alsoMissing(key, winners, focalDomain = OWN.domain) {
  const a = appearances[key] ?? {}
  const others = TRACKED_BRANDS.filter((b) => b.domain !== focalDomain && !winners.includes(b.domain) && !a[b.domain]?.visible).map((b) => b.domain)
  return [focalDomain, ...others]
}
// both logo columns sort by how many brands are in the cell (most first → fewest → off), ties A→Z.
// The sort lives in the URL (?sort=appearingFor|missedBy&dir=) and the saved filters (missedSort).
const SORT_KEYS = ['appearingFor', 'missedBy']
const FILTERS_KEY = `kraffic:prompts:filters:${account.domain}` // shared with /tracker's filters (merged, not replaced)
const byPrompt = (r) => r.prompt.toLowerCase()
function readSort() {
  const q = new URLSearchParams(window.location.search)
  if (SORT_KEYS.includes(q.get('sort'))) return { key: q.get('sort'), dir: q.get('dir') === 'asc' ? 'asc' : 'desc' }
  try {
    const saved = JSON.parse(window.localStorage.getItem(FILTERS_KEY))?.missedSort
    if (saved === null) return null
    if (SORT_KEYS.includes(saved?.key)) return { key: saved.key, dir: saved.dir === 'asc' ? 'asc' : 'desc' }
  } catch { /* storage unavailable */ }
  return { key: 'appearingFor', dir: 'desc' }
}
function writeSort(sort) {
  const url = new URL(window.location.href)
  if (sort && SORT_KEYS.includes(sort.key)) { url.searchParams.set('sort', sort.key); url.searchParams.set('dir', sort.dir) } else { url.searchParams.delete('sort'); url.searchParams.delete('dir') }
  window.history.replaceState(window.history.state, '', url)
  try {
    const saved = JSON.parse(window.localStorage.getItem(FILTERS_KEY)) ?? {}
    window.localStorage.setItem(FILTERS_KEY, JSON.stringify({ ...saved, missedSort: sort }))
  } catch { /* storage unavailable */ }
}

const csvColumns = [
  { label: 'Prompt', key: 'prompt' },
  { label: 'Topic', key: 'topic' },
  { label: 'Appearing for', csv: (r) => r.competitors.join(' ') },
  { label: 'Missed by', csv: (r) => alsoMissing(`m${r.id}`, r.competitors).map(brandName).join(' ') },
  { label: 'Status', csv: (r) => (r.status ? STATUSES[r.status].label : '') },
]

export default function MissedPrompts() {
  const [statuses, setStatuses] = useState(() => Object.fromEntries(missedPrompts.map((r) => [r.id, r.status])))
  const [topic, setTopic] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [openId, setOpenId] = useState(null)
  const [sort, setSortState] = useState(readSort)
  const setSort = (s) => { setSortState(s); writeSort(s) }
  const [brief, setBrief] = useState(null)
  const [toastNode, toast] = useToast()
  const { platform, setPlatform, matches, label } = usePlatformFilter()
  const syncF = useSyncFilter('lost')
  const set = usePromptSet('missed-prompts')
  // arriving from Sync history: show that sync's lost prompts, not whatever topic was picked
  useEffect(() => { if (syncF.sync) { setTopic(null); setSelected(new Set()) } }, [syncF.sync])

  const rows = useMemo(
    () => missedPrompts
      .filter((r) => (!topic || r.topic === topic) && matches(r.platforms) && (!syncF.ids || syncF.ids.has(r.id)) && (!set.ids || set.ids.has(r.id)))
      .map((r) => ({ ...r, status: statuses[r.id] })),
    [topic, platform, statuses, syncF.sync, set.ids],
  )
  const byId = (ids) => missedPrompts.filter((r) => ids.includes(r.id)).map((r) => ({ ...r, status: statuses[r.id] }))

  const setStatus = (ids, status) => setStatuses((s) => ({ ...s, ...Object.fromEntries(ids.map((i) => [i, status])) }))
  const markInProgress = (ids) => { setStatus(ids, 'in_progress'); toast(ids.length === 1 ? 'Marked in progress' : `${ids.length} prompts marked in progress`) }
  const openBrief = (rs) => setBrief(buildBrief(rs, account))
  const copyBrief = async () => {
    try { await navigator.clipboard.writeText(brief.md) } catch { /* clipboard blocked: still confirm, the text is on screen */ }
    toast('Brief copied')
  }
  const exportBrief = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([brief.md], { type: 'text/markdown' }))
    a.download = `${brief.prompts.length === 1 ? brief.prompts[0].replace(/\W+/g, '-') : 'content-brief'}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const showMeta = !topic || !platform
  const columns = [
    {
      key: 'prompt',
      label: 'Prompt',
      skeleton: '60%',
      mobileText: (r) => r.prompt,
      sort: { value: (r) => r.prompt.toLowerCase(), first: 'asc' },
      cell: (r) => (
        <div className="min-w-0">
          <div title={r.prompt} className="truncate text-body text-stone-900">{r.prompt}</div>
          {/* meta line: only what the active filters don't already say (topic pill / engine filter) */}
          {showMeta && (
            <div className="mt-0.5 flex items-center gap-2 text-[13px] leading-[18px] text-stone-500">
              {!topic && <TopicTag topic={r.topic} />}
              {!platform && (
                <span className="flex items-center gap-1" aria-label={`Missing on ${r.platforms.map((p) => platformNames[p]).join(', ')}`}>
                  {r.platforms.map((p) => <span key={p} title={platformNames[p]} className="flex"><PlatformIcon id={iconId(p)} size={14} /></span>)}
                </span>
              )}
            </div>
          )}
        </div>
      ),
    },
    // phones: the topic + engines line the desktop shows under the prompt
    { key: 'facts', label: 'Facts', desktop: false, csv: false, mobileText: (r) => `${r.topic} · ${r.platforms.length} ${r.platforms.length === 1 ? 'engine' : 'engines'}`, cell: () => null },
    {
      key: 'appearingFor',
      label: 'Appearing for',
      mobile: 'extra',
      width: 168, // 3 logos + "+N" and the header with its sort icon
      skeleton: '56px',
      csv: (r) => r.competitors.join(' '),
      sort: { value: (r) => r.competitors.length, first: 'desc', cycle: true, tie: byPrompt }, // "No brand cited" = 0
      cell: (r) => <LogoStack domains={r.competitors} empty={<span className="text-small text-stone-400">No brand cited</span>} />,
    },
    {
      key: 'missedBy',
      label: 'Missed by',
      mobile: false,
      width: 168,
      pad: 'pl-6 pr-3', // clear of "Appearing for"
      csv: (r) => alsoMissing(`m${r.id}`, r.competitors).map(brandName).join(' '),
      sort: { value: (r) => alsoMissing(`m${r.id}`, r.competitors).length, first: 'desc', cycle: true, tie: byPrompt },
      skeleton: '56px',
      cell: (r) => <LogoStack domains={alsoMissing(`m${r.id}`, r.competitors)} />,
    },
    {
      key: 'status',
      label: 'Status',
      mobile: 'extra', // phones: line 3, next to the logos
      align: 'right',
      width: 176, // spec 140; 'Create content ✦' / 'Waiting for sync' pill need up to 176
      skeleton: '110px',
      stopRowClick: true,
      cell: (r) => <StatusControl status={r.status} onChange={(s) => setStatus([r.id], s)} onCreate={() => openBrief([r])} />,
    },
  ]

  const chip = (active) =>
    `inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-small font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${
      active ? 'border-ink bg-ink text-on-ink' : 'border-transparent hover:brightness-[0.97]'
    }`
  const chipCount = () => 'proportional-nums opacity-80'
  const filterBar = (
    <div className="-mx-5 mb-0 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]" role="toolbar" aria-label="Filter by topic">
      <PromptSetPill set={set} />
      {syncF.ids && <SyncFilterPill kind="lost" sync={syncF.sync} onClear={syncF.clear} />}
      <PlatformFilterPill />
      <button className={chip(!topic)} style={topic ? { background: 'var(--tint)', color: 'var(--color-stone-700)' } : undefined} aria-pressed={!topic} onClick={() => { setTopic(null); setSelected(new Set()) }}>
        All <span className={chipCount(!topic)}>{missedPrompts.length}</span>
      </button>
      {missedTopics.map(([t, n]) => (
        <button key={t} className={chip(topic === t)} style={topic === t ? undefined : { background: 'var(--tint)', color: 'var(--color-stone-700)' }} aria-pressed={topic === t} onClick={() => { setTopic(t); setSelected(new Set()) }}>
          {t} <span className={chipCount(topic === t)}>{n}</span>
        </button>
      ))}
    </div>
  )

  const bulkBar = (count) => (
    <>
      <span className="px-2 text-small font-medium text-stone-900 proportional-nums">{count} selected</span>
      <span className="mx-1 h-5 w-px bg-stone-200" aria-hidden />
      <GhostButton icon={FileText} onClick={() => openBrief(byId([...selected]))}>Create one brief</GhostButton>
      <GhostButton icon={Loader} onClick={() => markInProgress([...selected])}>Mark in progress</GhostButton>
      <GhostButton icon={Download} onClick={() => downloadCsv('missed-prompts-selected.csv', byId([...selected]), csvColumns)}>Export</GhostButton>
      <GhostButton icon={X} onClick={() => setSelected(new Set())}>Clear</GhostButton>
    </>
  )

  const openRow = missedPrompts.find((r) => r.id === openId)

  return (
    <>
      <PromptTable
        id="missed-prompts"
        title="Missed prompts"
        subtitle={`Prompts where ${account.name} doesn't appear yet`}
        count={missedPrompts.length}
        rows={rows}
        columns={columns}
        csvName="missed-prompts.csv"
        loading={loading}
        sort={sort}
        onSortChange={setSort}
        selection={{ selected, setSelected }}
        bulkBar={bulkBar}
        filterBar={filterBar}
        rowHeight={showMeta ? 'h-[52px]' : 'h-11'}
        onRowClick={(r) => setOpenId(r.id)}
        emptyMessage={platform ? `No missed prompts on ${label}${topic ? ` in ${topic}` : ''}` : `No missed prompts in ${topic ?? 'this view'}`}
        onClearFilters={() => { setTopic(null); setPlatform(null); syncF.clear(); set.clear() }}
      />
      <MissedPromptSheet
        row={openRow}
        priority={openRow && priorities[openRow.id]}
        status={openRow && statuses[openRow.id]}
        onClose={() => setOpenId(null)}
        onCreateBrief={openBrief}
        onMarkInProgress={markInProgress}
      />
      <BriefModal brief={brief} onClose={() => setBrief(null)} onCopy={copyBrief} onExport={exportBrief} />
      {toastNode}
    </>
  )
}

