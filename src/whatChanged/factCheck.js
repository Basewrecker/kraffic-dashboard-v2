// Fact Check's Summary (as the app, #223). Fact Check has no scans to compare, so the panel has no period switch: a
// read gets a real summary sentence and four numbers; mismatches of the same kind are said once, in plain words
// ("Your years in business don't match in 2 places"); the meta line reads "Last read <day>"; labels wrap.
// The page builds it from what it shows: factCheckChanges({ total, match, mismatch: [{ kind }], unchecked, readAt, brand }).
import { B, plural } from './util.js'

const day = (at) => new Date(at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '')
// "Years in business" → "years in business" · "BBB rating" keeps its capitals
const lower = (label) => (/^[A-Z]{2,}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1))

export function factCheckSummary({ total = 0, match = 0, mismatch = [], unchecked = 0, readAt = null, brand = 'your site' } = {}) {
  const footer = [readAt ? `Last read ${day(readAt)}` : 'Not read yet']
  if (!readAt || !total) return { state: 'one', oneText: 'We haven’t read your website yet. Read it to see your facts here.', footer, latestIso: readAt, trigger: { delta: null }, noPeriods: true }
  const kinds = new Map()
  for (const m of mismatch) kinds.set(m.kind, (kinds.get(m.kind) ?? 0) + 1)
  const rows = [...kinds].sort((a, b) => b[1] - a[1]).map(([kind, n]) => ({
    id: `mm-${kind}`, mark: { status: 'bad' }, target: '#fc-facts-title',
    text: [B(`Your ${lower(kind)} ${n === 1 ? 'doesn’t match' : `don’t match in ${n} places`}`)],
  }))
  const headline = [B(`We found ${plural(total, 'fact')} on ${brand}`), '. ',
    mismatch.length ? `${plural(match, 'fact')} match outside sources, ${mismatch.length} ${mismatch.length === 1 ? 'doesn’t' : 'don’t'} match, and ${unchecked} ${unchecked === 1 ? 'hasn’t' : 'haven’t'} been checked yet.`
      : match ? `${plural(match, 'fact')} match outside sources and ${unchecked} ${unchecked === 1 ? 'hasn’t' : 'haven’t'} been checked yet.`
        : 'None has been checked against an outside source yet.']
  return {
    state: 'changed', noPeriods: true, wrapLabels: true, headline,
    glance: [{ label: 'Facts found', value: total }, { label: 'Match', value: match }, { label: 'Don’t match', value: mismatch.length }, { label: 'Not checked', value: unchecked }],
    lists: rows.length ? [{ id: 'mismatch', title: 'Doesn’t match', count: rows.length, rows }] : [],
    next: [], footer, latestIso: readAt, trigger: { delta: null },
  }
}
export const factCheckChanges = (input) => ({ page: 'fact-check', title: 'Fact Check', build: () => factCheckSummary(input) })
