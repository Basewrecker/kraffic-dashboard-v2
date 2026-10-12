// Sync history → "Changes on Sep 28" drawer: the prompts a sync gained / lost for a brand, with which engine
// changed and what happened instead. Built from the sync row's change lists + the prompt-level appearances table.
import { ENGINE_ORDER, TRACKED_BRANDS, appearances, engineName, enginePid } from './brandViews.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// "Sep 28, 2026" ↔ "2026-09-28" (URL) ↔ "sep-28" (/tracker?sync=)
export function isoOf(date) {
  const [mon, day, year] = date.replace(',', '').split(' ')
  return `${year}-${String(MONTHS.indexOf(mon) + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
export const slugOf = (date) => date.replace(/, \d{4}$/, '').toLowerCase().replace(' ', '-')
export const shortDate = (date) => date.replace(/, \d{4}$/, '')

// sync change lists use table ids: Dermasuri's own view numbers its prompts (gained → visible "v12", lost → missed
// "m3"); competitor views already use tracked ids
export const trackedKey = (id, kind) => (typeof id === 'number' ? `${kind === 'gained' ? 'v' : 'm'}${id}` : id)

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

export function syncChanges(row, domain) {
  if (!row?.changes) return null
  const rivals = TRACKED_BRANDS.filter((b) => b.domain !== domain)
  const build = (kind) => row.changes[kind].map((p) => {
    const key = trackedKey(p.id, kind)
    const a = appearances[key]?.[domain]
    if (kind === 'gained') {
      const engine = ENGINE_ORDER.find((e) => a?.platforms.includes(enginePid(e))) ?? 'aio'
      return { key, prompt: p.prompt, engine, meta: `Now visible on ${engineName(engine)} · ${a?.cited ? `cited ${a.citedPage}` : 'not cited yet'}` }
    }
    // lost: it was on one of the engines that cover this brand; say who took the spot
    const engines = ENGINE_ORDER.filter((e) => ['aio', 'gemini', 'chatgpt'].includes(e))
    const engine = engines[hash(key) % engines.length]
    const instead = rivals.find((b) => appearances[key]?.[b.domain]?.platforms.includes(enginePid(engine))) ?? rivals.find((b) => appearances[key]?.[b.domain]?.visible)
    return { key, prompt: p.prompt, engine, meta: `Was visible on ${engineName(engine)} · ${instead ? `now ${instead.name} shows instead` : 'now no tracked brand shows'}` }
  })
  return { lost: build('lost'), gained: build('gained') }
}
