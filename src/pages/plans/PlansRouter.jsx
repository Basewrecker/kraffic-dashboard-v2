import { usePath } from '../../router'
import ErrorBoundary from '../../components/ui/ErrorBoundary'
import PlansPage from './PlansPage'
import ReturnPage from './ReturnPage'

// /plans → Plans (and, with a subscription, its Billing tab) · /plans/return → back from the payment page
export default function PlansRouter() {
  const path = usePath()
  const page = path.startsWith('/plans/return') ? 'return' : 'plans'
  return <ErrorBoundary resetKey={page} name="Plans">{page === 'return' ? <ReturnPage /> : <PlansPage />}</ErrorBoundary>
}
