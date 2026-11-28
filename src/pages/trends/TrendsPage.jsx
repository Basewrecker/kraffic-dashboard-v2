import ErrorBoundary from '../../components/ui/ErrorBoundary'
import MarketTrends from './MarketTrends'

// /trends: Google Trends market data for the brand's terms (as the app, #203). The old "runs" pages (a question, its
// news and social mentions) are gone; /trends/<anything> still lands here.
export default function TrendsPage() {
  return (
    <ErrorBoundary name="Trends">
      <MarketTrends />
    </ErrorBoundary>
  )
}
