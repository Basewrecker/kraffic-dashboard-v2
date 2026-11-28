import { MenuSelect, MOBILE_TRIGGER, triggerClass } from '../ui/MenuSelect'
// the header dropdown lives in ui/MenuSelect.jsx (shared with ui/Select); re-exported here for its older importers
export { MenuSelect, MOBILE_TRIGGER, triggerClass }
import { account } from '../../data/mock'
import { ENGINES, OWN, TRACKED_BRANDS, getBrandView, hasResult } from '../../data/brandViews'
import { NO_SCORE, fmtScore } from '../../utils/score'
import { PlatformIcon } from './icons'
import { PlatformFilterPill } from './PlatformFilter'
import { useBrandView } from '../../hooks/useBrandView'
import { fmtDay, useTracking } from '../../store/trackingSettings'
import { WhatChangedButton } from '../../whatChanged/WhatChanged'
import { overview as overviewChanges } from '../../whatChanged/overview'

// A card header's icon action, next to its dropdowns: the 'sm' trigger's height, border, radius, surface and focus
// ring, square. Icon t2, ink on hover. The label is its aria-label and a small tooltip (hover after 300ms, or focus);
// tipAlign "right" for the rightmost control, so the tooltip stays inside the card.
export function HeaderIconButton({ label, icon: Icon, onClick, children, tipAlign = 'center', className = '' }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className={`group/hib relative grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line bg-raised text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus ${className}`}>
      {children ?? <Icon size={16} aria-hidden />}
      <span aria-hidden className={`pointer-events-none absolute top-full z-20 mt-1.5 ${tipAlign === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'} whitespace-nowrap rounded-md border border-line bg-raised px-2 py-1 text-[12px] leading-4 font-medium text-stone-700 opacity-0 shadow-sm transition-opacity duration-150 group-hover/hib:opacity-100 group-hover/hib:delay-300 group-focus-visible/hib:opacity-100 motion-reduce:transition-none`}>
        {label}
      </span>
    </button>
  )
}

// each brand's score on the engine shown (the KPI ring's number); "—" when that engine's latest scan had no result
const score = (domain, engine) => fmtScore(getBrandView(domain, engine).kpis.score, '%')
// w-72: the longest engine ("Google AI Overview" + "111 prompts") fits without an ellipsis
// built when the header draws (not when the module loads), so the scores are the current ones
const brandGroups = (engine) => [
  { label: 'Your brand', items: TRACKED_BRANDS.filter((b) => b.you) },
  { label: 'View as a competitor', items: TRACKED_BRANDS.filter((b) => !b.you) },
].map((g) => ({ ...g, items: g.items.map((b) => ({ id: b.domain, label: b.name, meta: score(b.domain, engine) })) }))

export default function PageHeader() {
  const tracking = useTracking()
  const { focal, isOwnBrand, setView, engine, setEngine } = useBrandView()
  // prompts where each engine mentions the brand being viewed (unfiltered: the card data covers all engines)
  const perEngine = Object.fromEntries(getBrandView(focal.domain).platforms.map((p) => [p.id, p.visible]))
  const engineGroups = [{
    items: [
      { id: 'all', label: 'All engines' },
      ...ENGINES.map((e) => ({ id: e.id, label: e.full, short: e.name, icon: <PlatformIcon id={e.id} size={16} />, meta: hasResult(e.id) ? `${perEngine[e.id] ?? 0} prompts` : NO_SCORE })),
    ],
  }]

  return (
    // mb-2: with the page gap-4 this gives header → KPI row = 24px
    <div className="mb-2">
      {/* phones / tablets: title, subtitle, then the two filters full width (one row each) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">Visibility Overview</h1>
          {/* owner, 2026-11-20: the subtitle shows at every width and ends with the last update, plain grey ("… · Updated
              Oct 5"); it replaced the desktop ⓘ and the dotted "Updated" in the controls row. Competitor view: the
              read-only line, then the update */}
          <p className="mt-1 text-body font-normal text-stone-600">
            {isOwnBrand ? (
              <>Track how often {account.name} appears in AI answers across {ENGINES.length} engines</>
            ) : (
              <>
                {focal.name}’s view · read-only ·{' '}
                <button type="button" onClick={() => setView(OWN.domain)} className="rounded font-medium text-ink outline-none hover:opacity-75 focus-visible:ring-2 focus-visible:ring-focus">
                  Back to {OWN.name}
                </button>
              </>
            )}
            <span className="tabular-nums text-stone-500"> · {tracking.syncing ? 'Syncing…' : `Updated ${fmtDay(tracking.schedule.lastSync)}`}</span>
          </p>
        </div>
        <div className="relative flex shrink-0 flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:justify-end lg:gap-3 lg:pt-1">
          <div data-tour="overview-engine" className="max-lg:w-full">
            <MenuSelect prefix="Engine" value={engine} onChange={setEngine} groups={engineGroups} listLabel="Filter by engine" footer="Filters every card to answers from this engine."
              className="max-lg:w-full" triggerClassName={MOBILE_TRIGGER} />
          </div>
          <MenuSelect
            className="max-lg:w-full" triggerClassName={MOBILE_TRIGGER}
            prefix="Viewing as"
            value={focal.domain}
            onChange={setView}
            groups={brandGroups(engine)}
            listLabel="View the dashboard as"
            title="See the dashboard from a competitor’s point of view"
          />
          {/* What changed: the row's right end (own brand); phones / tablets: under the filters, left */}
          {isOwnBrand && <WhatChangedButton config={overviewChanges} className="max-lg:h-10 max-lg:self-start" />}
          {/* What changed (own brand): a quiet line next to the date, opens the pull-out */}
        </div>
      </div>
      {/* as the app (owner, 2026-11-12): the engine filter chip on its own right-aligned row under the filters, pushing the
          cards down (it was absolute at lg+ and covered the KPI row's top-right card) */}
      {engine !== 'all' && <div className="mt-2 flex justify-end"><PlatformFilterPill /></div>}
    </div>
  )
}
