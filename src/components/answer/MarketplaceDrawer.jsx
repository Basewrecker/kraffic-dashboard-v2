import { Store } from 'lucide-react'
import WeekHistoryDrawer from './WeekHistoryDrawer'
import { OWN } from '../../data/brandViews'
import { account } from '../../data/mock'
import { MARKET_ENGINES, MARKET_METRICS, MARKET_RIVALS, collectingNote, historySpan, loadMarketWeeks, marketChanges, marketInsight, marketMock, marketRows, marketSummary, rivalRows } from '../../data/marketplaceHistory'

// Marketplace visibility → "Marketplace visibility" week by week, in the shared drawer (WeekHistoryDrawer): metric
// tabs Linking prompts (prompts whose answer links to your listing) · Share (% of tracked prompts) · one per
// marketplace; Compare with a competitor's listings; a week drills in to the prompts that started / stopped linking
// (prompt · engine · marketplace · listing path). Always your own brand: listings are only checked for it.
// openMarketplaceDrawer({ metric, opener }). URL: ?drawer=market&metric=linking|share|target|amazon[&vs=…]
const EVENT = 'marketplace-drawer:open'
export function openMarketplaceDrawer({ metric = 'linking', opener }) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { metric, brand: null, opener } }))
}

const source = {
  event: EVENT,
  key: 'market',
  title: 'Marketplace visibility',
  metrics: MARKET_METRICS,
  defaultMetric: 'linking',
  csvName: 'weekly-marketplace',
  vsKeys: MARKET_RIVALS.map((b) => b.key),
  brandOf: () => null,
  defaultDomain: () => OWN.domain,
  rivals: () => MARKET_RIVALS,
  engines: () => MARKET_ENGINES,
  mock: marketMock,
  load: loadMarketWeeks,
  // every week there is (history grows weekly; no cap)
  rows: ({ engine, enabled, mock }) => marketRows(engine, enabled, null, mock),
  vsRows: ({ rival, engine, enabled, mock }) => rivalRows(rival.domain, engine, enabled, null, mock),
  changes: ({ metric, row, engine, mock }) => marketChanges({ metric, row, engine, mock }),
  summary: marketSummary,
  insight: marketInsight,
  noun: () => 'prompt',
  emptyText: (rows, brand) => (rows.length && rows.every((r) => !r.totals.linking)
    ? { icon: Store, title: `No AI answer links to a ${brand.name} listing yet`, text: 'When an answer links to your listing on Target or Amazon, it shows here week by week, with the prompts behind each change.' }
    : null),
  span: historySpan,
  note: collectingNote,
  off: () => !account.features.ecommerce,
  offText: {
    title: 'Marketplace visibility isn’t switched on for this account',
    text: 'It shows which AI answers link to your listings on Amazon, Target and other stores. Contact the Kraffic Support team to switch it on.',
    foot: 'Marketplace visibility · not switched on',
  },
}

export default function MarketplaceDrawer() {
  return <WeekHistoryDrawer source={source} />
}
