import { useEffect } from 'react'
import Sidebar from './components/dashboard/Sidebar'
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
import AuditPage from './components/audit/AuditPage'
import StructuredDataPage from './components/structured/StructuredDataPage'
import { usePath } from './router'
import { TrackingProvider } from './store/trackingSettings'
import { DashboardViewProvider } from './hooks/useBrandView'
import AnswerDrawer from './components/answer/AnswerDrawer'
import EngineDrawer from './components/answer/EngineDrawer'
import SyncDrawer from './components/answer/SyncDrawer'


function DashboardPage() {
  useEffect(() => { document.title = 'Visibility Overview · Kraffic' }, [])
  return (
    <>
          <DashboardViewProvider>
          <PlatformFilterProvider>
          <PageHeader />
          <KpiRow />
          {/* equal-height rows: cards are h-full flex-col, bodies flex-1, insight footers mt-auto */}
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <VisibilityHistory />
            <PromptCoverage />
          </div>
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
            <CitationsMentions />
            <MarketplaceVisibility />
          </div>
          <VisiblePromptsTable />
          <MissedPromptsTable />
          <CompetitorPromptsTable />
          <MarketplacePrompts />
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
            <SyncHistory />
            <TopCitedPages />
          </div>
          <AnswerDrawer />
          <EngineDrawer />
          <SyncDrawer />
          </PlatformFilterProvider>
          </DashboardViewProvider>
    </>
  )
}

export default function App() {
  const path = usePath()
  const PAGES = { '/overview': DashboardPage, '/tracker': PromptsPage, '/brands': SetupPage, '/tracking': LlmSettingsPage, '/audit': AuditPage, '/structured-data': StructuredDataPage }
  const Page = PAGES[path] ?? DashboardPage
  return (
    // tracking settings are shared by every page (dashboard header, /brands summary, /tracking editor)
    <TrackingProvider>
      <div className="flex min-h-screen">
        <Sidebar path={PAGES[path] ? path : '/overview'} />
        <div className="min-w-0 flex-1">
          {/* same content container on every page */}
          <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 pb-10 pt-8"><Page /></main>
        </div>
      </div>
    </TrackingProvider>
  )
}
