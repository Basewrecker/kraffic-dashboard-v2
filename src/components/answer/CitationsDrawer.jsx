import WeekHistoryDrawer, { WEEKS } from './WeekHistoryDrawer'
import { TRACKED_BRANDS } from '../../data/brandViews'
import { METRICS, brandEngines, historyMock, loadWeeks, weekChanges, weekInsight, weekRows, weekSummary } from '../../data/citationHistory'

// Citations and Mentions → "Mentions and citations": the card's numbers week by week (mentions, citations, cited
// pages), in the shared week-by-week drawer (WeekHistoryDrawer). A week's drill-in rows open the Answer drawer.
// openCitationsDrawer({ metric, brand, opener }). URL: ?drawer=weeks&metric=mentions|citations|pages[&drawerBrand=…]
const EVENT = 'citations-drawer:open'
export function openCitationsDrawer({ metric = 'mentions', brand = null, opener }) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { metric, brand, opener } }))
}

const source = {
  event: EVENT,
  key: 'weeks',
  title: 'Mentions and citations',
  metrics: METRICS,
  defaultMetric: 'mentions',
  csvName: 'weekly-citations',
  vsKeys: TRACKED_BRANDS.map((b) => b.key),
  brandOf: (key) => TRACKED_BRANDS.find((b) => b.key === key)?.domain ?? null,
  rivals: (domain) => TRACKED_BRANDS.filter((b) => b.domain !== domain),
  engines: brandEngines,
  mock: historyMock,
  load: loadWeeks,
  rows: ({ domain, engine, enabled, mock }) => weekRows(domain, engine, enabled, mock === 'empty' ? 1 : WEEKS),
  vsRows: ({ rival, engine, enabled }) => weekRows(rival.domain, engine, enabled, WEEKS),
  changes: ({ domain, metric, row, engine }) => weekChanges({ domain, metric, row, engine, sync: row.week.sync }),
  summary: weekSummary,
  insight: weekInsight,
  noun: (metric) => (metric === 'pages' ? 'page' : 'prompt'),
  emptyText: (rows) => (rows.length < 2 ? 'History appears after your second weekly scan.' : null),
  answerDate: (domain, row) => row.week.date,
}

export default function CitationsDrawer() {
  return <WeekHistoryDrawer source={source} />
}
