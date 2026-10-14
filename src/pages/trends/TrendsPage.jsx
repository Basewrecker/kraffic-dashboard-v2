import { usePath } from '../../router'
import ErrorBoundary from '../../components/ui/ErrorBoundary'
import RunList from './RunList'
import RunDetail from './RunDetail'

// /trends → the run list · /trends/:runId → one run
export default function TrendsPage() {
  const path = usePath()
  const runId = path.startsWith('/trends/') ? decodeURIComponent(path.slice('/trends/'.length)) : null
  return (
    <ErrorBoundary resetKey={runId ?? 'list'} name="Trends">
      {runId ? <RunDetail runId={runId} /> : <RunList />}
    </ErrorBoundary>
  )
}
