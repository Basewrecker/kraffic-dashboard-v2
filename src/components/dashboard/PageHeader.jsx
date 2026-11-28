import { MenuSelect, MOBILE_TRIGGER, triggerClass } from '../ui/MenuSelect'
// the header dropdown lives in ui/MenuSelect.jsx (shared with ui/Select); re-exported here for its older importers
export { MenuSelect, MOBILE_TRIGGER, triggerClass }
import { account } from '../../data/mock'
import { ENGINES, OWN, TRACKED_BRANDS, getBrandView, hasResult } from '../../data/brandViews'
import { NO_SCORE, fmtScore } from '../../utils/score'
import { PlatformIcon } from './icons'
import { Info } from 'lucide-react'
import SiteLogo from '../ui/SiteLogo'
import HeaderBell from '../../notifications/NotificationsBell'
import { useBrandView } from '../../hooks/useBrandView'
import { fmtDay, useTracking } from '../../store/trackingSettings'
import { WhatChangedButton } from '../../whatChanged/WhatChanged'
import { overview as overviewChanges } from '../../whatChanged/overview'
import { InsightsButton } from './InsightsPanel'

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
  // as the app (#216 / #223 / #235): each brand's logo in the trigger and the list (SiteLogo's globe only as the last fallback)
].map((g) => ({ ...g, items: g.items.map((b) => ({ id: b.domain, label: b.name, meta: score(b.domain, engine), icon: <SiteLogo domain={b.domain} name={b.name} className="h-4 w-4 rounded" initialClass="text-[9px]" /> })) }))

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
          {/* as the app (#216 / #223): the title's ⓘ sits on the cap height, 8px from the title; its words are the old
              long subtitle, in the dark tip (hover and keyboard focus) */}
          <h1 className="flex items-start gap-2 text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">
            Visibility Overview
            <span tabIndex={0} aria-label={`About this page: how often ${account.name} appears in AI answers across ${ENGINES.length} engines`}
              className="group/ti relative mt-[5px] hidden shrink-0 rounded-full text-stone-500 outline-none transition-colors duration-150 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus lg:inline-grid lg:mt-[9px]">
              <Info size={16} strokeWidth={1.75} aria-hidden />
              <span role="tooltip" className="tip-dark pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-max -translate-x-1/2 text-left tracking-normal opacity-0 transition-opacity duration-150 group-hover/ti:opacity-100 group-focus-visible/ti:opacity-100">
                Track how often {account.name} appears in AI answers across {ENGINES.length} engines.
              </span>
            </span>
          </h1>
          {/* the subtitle shows at every width and ends with the last update, plain grey ("… · Updated Oct 5").
              Competitor view: the read-only line, then the update */}
          <p className="mt-1 text-body font-normal text-stone-600">
            {isOwnBrand ? (
              <>How often AI names {account.name}</>
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
          {/* as the app: Insights (a lightbulb and the count) is the first of the header controls; it opens the panel */}
          <InsightsButton />
          <div data-tour="overview-engine" className="max-lg:w-full">
            {/* as the app (#216 / #223): no "Engine" label ("All engines", or the engine with its logo) */}
            <MenuSelect value={engine} onChange={setEngine} groups={engineGroups} listLabel="Engine" showIcon footer="Filters every card to answers from this engine."
              className="max-lg:w-full" triggerClassName={MOBILE_TRIGGER} />
          </div>
          {/* no "Viewing as": the brand's logo and name */}
          <MenuSelect
            className="max-lg:w-full" triggerClassName={MOBILE_TRIGGER}
            value={focal.domain}
            onChange={setView}
            groups={brandGroups(engine)}
            listLabel="View the dashboard as"
            showIcon
          />
          {/* the row ends the same way on every page: Summary (own brand) · 12px · hairline · 12px · bell */}
          {isOwnBrand ? <WhatChangedButton config={overviewChanges} className="max-lg:self-start" /> : <HeaderBell />}
        </div>
      </div>
      {/* as the app (#223): the "<engine> only ×" chip is gone everywhere; the engine dropdown shows the choice */}
    </div>
  )
}
