// Opportunities → Content list: pure helpers (no React, no window), so `npm test` can run them.
// A row's state comes from its draft (contentOpportunities-proposed draftFor); no draft = nothing started yet.
import { CO_BRAND, CO_BRANDS } from '../../../data/contentOpportunities.js'

// the list states, in the order the work moves
export const STAGES = ['none', 'draft', 'waiting', 'monitoring', 'improved', 'nochange']
export const stageOf = (draft) => (draft && STAGES.includes(draft.stage) ? draft.stage : 'none')

// the KPI strip: each tile is also the table's filter ('all' = every missed prompt)
export const TABS = [
  { id: 'all', label: 'Missed', stages: STAGES },
  { id: 'draft', label: 'Drafts', stages: ['draft'] },
  { id: 'waiting', label: 'Waiting', stages: ['waiting'] },
  { id: 'monitoring', label: 'Monitoring', stages: ['monitoring'] },
  { id: 'improved', label: 'Improved', stages: ['improved'] },
]
export const tabById = (id) => TABS.find((t) => t.id === id) ?? TABS[0]

// rows: the Overview's missed prompts decorated with { draft, stage }
export const withStage = (rows, draftFor) => rows.map((r) => {
  const draft = draftFor(r.id, r)
  return { ...r, draft, stage: stageOf(draft) }
})
export const filterRows = (rows, tabId) => {
  const { stages } = tabById(tabId)
  return rows.filter((r) => stages.includes(r.stage))
}
export const tabCounts = (rows) => Object.fromEntries(TABS.map((t) => [t.id, rows.filter((r) => t.stages.includes(r.stage)).length]))

// tiles' small extras: how many have no work yet; monitoring weeks (lowest, highest); engines gained in all
export function tabExtras(rows) {
  const weeks = rows.filter((r) => r.stage === 'monitoring').map((r) => r.draft.week)
  return {
    toStart: rows.filter((r) => r.stage === 'none').length,
    weeks: weeks.length ? [Math.min(...weeks), Math.max(...weeks)] : null,
    gained: rows.filter((r) => r.stage === 'improved').reduce((n, r) => n + r.draft.gained.length, 0),
  }
}

// "Missed by": tracked competitors that aren't named in the answer either. Never the user's own brand (the whole
// table is prompts it misses), never a repeat.
export const missedBy = (row) => [...new Set(Object.keys(CO_BRANDS).filter((d) => d !== CO_BRAND.domain && !row.competitors.includes(d)))]

// the Status column as words (CSV, aria)
export function statusText(row) {
  const d = row.draft
  switch (row.stage) {
    case 'draft': return 'Draft ready'
    case 'waiting': return 'Waiting for publish'
    case 'monitoring': return `Monitoring · week ${d.week}/4`
    case 'improved': return `Improved +${d.gained.length} ${d.gained.length === 1 ? 'engine' : 'engines'}`
    case 'nochange': return 'No change yet'
    default: return 'Create content'
  }
}
// a timeline popover only once something is live
export const hasTimeline = (stage) => ['monitoring', 'improved', 'nochange'].includes(stage)
