import { useEffect } from 'react'
import Sidebar from './components/dashboard/Sidebar'
import MobileNav from './components/dashboard/MobileNav'
import PageHeader from './components/dashboard/PageHeader'
import KpiRow from './components/dashboard/KpiRow'
import VisibilityHistory from './components/dashboard/VisibilityHistory'
import PromptCoverage from './components/dashboard/PromptCoverage'
import CitationsMentions from './components/dashboard/CitationsMentions'
import MarketplaceVisibility from './components/dashboard/MarketplaceVisibility'
import MarketplacePrompts from './components/dashboard/MarketplacePrompts'
import { PlatformFilterProvider } from './components/dashboard/PlatformFilter'
import { VisiblePromptsTable, MissedPromptsTable, CompetitorPromptsTable } from './components/dashboard/PromptTables'
import SyncHistory from './components/dashboard/SyncHistory'
import TopCitedPages from './components/dashboard/TopCitedPages'
import PromptsPage from './components/prompts/PromptsPage'
import SetupPage from './components/setup/SetupPage'
import LlmSettingsPage from './components/llm/LlmSettingsPage'
import FirstSetupPage from './components/firstSetup/FirstSetupPage'
import { setupGroups } from './components/firstSetup/nav'
import AuditPage from './components/audit/AuditPage'
import StructuredDataPage from './components/structured/StructuredDataPage'
import TrendsPage from './pages/trends/TrendsPage'
import ToolkitPage from './pages/toolkit/ToolkitPage'
import ToolRouter from './pages/toolkit/ToolRouter'
import BillingRouter from './pages/billing/BillingRouter'
import EmptyBrand from './components/EmptyBrand'
import InsightsRouter from './pages/insights/InsightsRouter'
import { usePath } from './router'
import { TrackingProvider } from './store/trackingSettings'
import { account, appInitialTracking, appTracking, currentBrand, initialTracking, krafficTracking } from './data/mock'
import { DashboardViewProvider } from './hooks/useBrandView'
import AnswerDrawer from './components/answer/AnswerDrawer'
import EngineDrawer from './components/answer/EngineDrawer'
import SyncDrawer from './components/answer/SyncDrawer'
import CitationsDrawer from './components/answer/CitationsDrawer'
import MarketplaceDrawer from './components/answer/MarketplaceDrawer'
import { AppLoading, PageError, PageLoading, PageNotFound } from './components/ui/PageState'
import { CardGate } from './components/ui/CardState'
import CookieBanner from './components/ui/CookieBanner'


function DashboardPage() {
  useEffect(() => { document.title = 'Visibility Overview · Kraffic' }, [])
  return (
    <>
          <DashboardViewProvider>
          <PlatformFilterProvider>
          <PageHeader />
          {/* each card loads on its own (data/cards.js): its skeleton or error keeps the card's height */}
          <CardGate card="kpis" height="h-[308px] lg:h-[174px]" label="Loading the numbers"><KpiRow /></CardGate>
          {/* equal-height rows: cards are h-full flex-col, bodies flex-1, insight footers mt-auto */}
          <div className="grid grid-cols-1 items-stretch gap-3 md:gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <CardGate card="history" height="h-[443px] lg:h-[457px]" label="Loading visibility history"><VisibilityHistory /></CardGate>
            <CardGate card="coverage" height="h-[453px] lg:h-[457px]" label="Loading prompt coverage"><PromptCoverage /></CardGate>
          </div>
          {/* marketplace cards only for accounts with ecommerce switched on; without them Citations takes the row */}
          <div className={`grid grid-cols-1 items-stretch gap-3 md:gap-4 ${account.features.ecommerce ? 'lg:grid-cols-2' : ''}`}>
            <CardGate card="citations" height="h-[389px] lg:h-[364px]" label="Loading citations and mentions"><CitationsMentions /></CardGate>
            {account.features.ecommerce && <CardGate card="marketplace" height="h-[564px] lg:h-[364px]" label="Loading marketplace visibility"><MarketplaceVisibility /></CardGate>}
          </div>
          {/* phones / tablets reorder (desktop keeps this order): … Sync history → Top cited pages → Prompt mix → the other tables */}
          <div className="max-lg:order-3"><CardGate card="visiblePrompts" height="h-[945px] lg:h-[605px]" label="Loading visible prompts"><VisiblePromptsTable /></CardGate></div>
          <div className="max-lg:order-4"><CardGate card="missedPrompts" height="h-[1305px] lg:h-[729px]" label="Loading missed prompts"><MissedPromptsTable /></CardGate></div>
          <div className="max-lg:order-2"><CardGate card="competitorPrompts" height="h-[969px] lg:h-[729px]" label="Loading prompt mix"><CompetitorPromptsTable /></CardGate></div>
          {account.features.ecommerce && <div className="max-lg:order-5"><CardGate card="marketplacePrompts" height="h-[987px] lg:h-[649px]" label="Loading marketplace prompts"><MarketplacePrompts /></CardGate></div>}
          <div className="grid grid-cols-1 items-stretch gap-3 md:gap-4 lg:grid-cols-2 max-lg:order-1">
            <CardGate card="syncHistory" height="h-[367px] lg:h-[415px]" label="Loading sync history"><SyncHistory /></CardGate>
            <CardGate card="citedPages" height="h-[407px] lg:h-[415px]" label="Loading top cited pages"><TopCitedPages /></CardGate>
          </div>
          <AnswerDrawer />
          <EngineDrawer />
          <SyncDrawer />
          <CitationsDrawer />
          <MarketplaceDrawer />
          </PlatformFilterProvider>
          </DashboardViewProvider>
    </>
  )
}

// Tracking for each backend: app.kraffic.ai (every row; the default) or kraffic.ai (?backend=kraffic: country,
// language, the daily check, Sync now). The page shows only the rows its props can save.
const krafficBackend = new URLSearchParams(window.location.search).get('backend') === 'kraffic'
const TrackingPage = () => <LlmSettingsPage {...(krafficBackend ? krafficTracking : appTracking)} />

export default function App() {
  const path = usePath()
  const PAGES = { '/first-setup': FirstSetupPage, '/overview': DashboardPage, '/tracker': PromptsPage, '/brands': SetupPage, '/tracking': TrackingPage, '/audit': AuditPage, '/structured-data': StructuredDataPage, '/trends': TrendsPage, '/more-tools': ToolkitPage, '/more-tools/tool': ToolRouter, '/billing': BillingRouter, '/citations': InsightsRouter, '/sentiment': InsightsRouter, '/fact-check': InsightsRouter }
  // /trends/:runId and /more-tools/<tool>[/…] are one page each (they read the rest of the path)
  const route = path.startsWith('/trends/') ? '/trends' : path.startsWith('/more-tools/') ? '/more-tools/tool' : path.startsWith('/billing/') ? '/billing' : path
  const navPath = route.startsWith('/more-tools') ? '/more-tools' : route // tool pages light up Toolkit
  const setupNav = route === '/first-setup' ? setupGroups : undefined // setup mode: First-time setup, Prompt Hub, Trends
  const Page = PAGES[route] ?? DashboardPage
  // a brand with no data yet: data pages show the empty state (Brand Setup, Tracking and Billing still work)
  const empty = currentBrand.data === 'empty' && !['/first-setup', '/brands', '/tracking', '/billing'].includes(route)
  // ?state= previews the states the app shows around a page (components/ui/PageState.jsx, ui/CookieBanner.jsx):
  // app-loading (before the sidebar draws) · loading · error · notfound · cookies
  const state = new URLSearchParams(window.location.search).get('state')
  if (state === 'app-loading') return <AppLoading />
  const body = state === 'loading' ? <PageLoading />
    : state === 'error' ? <PageError message="The server didn’t answer in time. Check your connection, then try again." onRetry={() => {}} />
      : state === 'notfound' ? <PageNotFound />
        : empty ? <EmptyBrand route={PAGES[route] ? route : '/overview'} setUp={!!currentBrand.setUp} /> : <Page />
  return (
    // tracking settings are shared by every page (dashboard header, /brands summary, /tracking editor)
    <TrackingProvider initial={krafficBackend ? initialTracking : appInitialTracking}>
      <div className="flex min-h-screen">
        <Sidebar path={PAGES[route] ? navPath : '/overview'} nav={setupNav} />
        <div className="min-w-0 flex-1">
          <MobileNav path={PAGES[route] ? navPath : '/overview'} nav={setupNav} />
          {/* same content container on every page (16px gutters on phones, 24px from md) */}
          {/* Site Audit ends 64px under its last card (pb-16 alone, no spacer) */}
          <main className={`mx-auto flex w-full max-w-[1280px] flex-col gap-3 px-4 ${route === '/audit' ? 'pb-16' : 'pb-10'} pt-4 motion-safe:animate-[fade-in_150ms_ease-out] md:gap-4 md:px-6 lg:pt-8`}>{body}</main>
        </div>
      </div>
      {state === 'cookies' && <CookieBanner onChoose={() => {}} />}
    </TrackingProvider>
  )
}
