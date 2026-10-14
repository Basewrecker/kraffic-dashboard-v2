import { usePath } from '../../router'
import ErrorBoundary from '../../components/ui/ErrorBoundary'
import { DashboardViewProvider } from '../../hooks/useBrandView'
import AnswerDrawer from '../../components/answer/AnswerDrawer'
import CitationsPage from './CitationsPage'
import SentimentPage from './SentimentPage'
import FactCheckPage from './FactCheckPage'

// /citations, /sentiment, /fact-check — reachable by URL, not in the sidebar yet. Each opens prompts in the Answer drawer.
const PAGES = { '/citations': CitationsPage, '/sentiment': SentimentPage, '/fact-check': FactCheckPage }
export default function InsightsRouter() {
  const path = usePath()
  const Page = PAGES[path]
  return (
    <DashboardViewProvider>
      <ErrorBoundary resetKey={path} name={`Insights · ${path}`}><Page /></ErrorBoundary>
      <AnswerDrawer />
    </DashboardViewProvider>
  )
}
