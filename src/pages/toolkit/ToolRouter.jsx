import { usePath } from '../../router'
import ErrorBoundary from '../../components/ui/ErrorBoundary'
import { DashboardViewProvider } from '../../hooks/useBrandView'
import AnswerDrawer from '../../components/answer/AnswerDrawer'
import SiteKitPage from './SiteKitPage'
import CrmPage from './CrmPage'
import ExperimentsPage from './ExperimentsPage'
import AlertsPage from './AlertsPage'

// /more-tools/<tool>[/<id>] → the tool's page. Tools that open prompts get the Answer drawer (it needs the dashboard view).
const TOOLS = { 'site-kit': SiteKitPage, 'crm-attribution': CrmPage, experiments: ExperimentsPage, 'competitor-alerts': AlertsPage }
export default function ToolRouter() {
  const [, , tool, id] = usePath().split('/')
  const Page = TOOLS[tool]
  if (!Page) return <p className="text-[14px] text-stone-600">This tool isn’t designed in the mock yet.</p>
  return (
    <DashboardViewProvider>
      <ErrorBoundary resetKey={`${tool}|${id ?? ''}`} name={`Toolkit · ${tool}`}>
        <Page id={id ? decodeURIComponent(id) : null} />
      </ErrorBoundary>
      <AnswerDrawer />
    </DashboardViewProvider>
  )
}
