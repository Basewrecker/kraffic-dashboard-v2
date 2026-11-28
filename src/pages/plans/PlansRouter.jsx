import { usePath } from '../../router'
import ErrorBoundary from '../../components/ui/ErrorBoundary'
import { useParams } from '../../components/audit/parts'
import { billingState } from '../../billing/state.js'
import PlansPage from './PlansPage'
import ReturnPage from './ReturnPage'
import PayPlaceholder from './PayPlaceholder'
import { ReviewPage } from './ReviewModal'

// /plans → Plans (and, with a subscription, its Billing tab) · /plans/review → the review step as a page (email
// links) · /plans/pay → a labelled stand-in for the payment provider's pages · /plans/return → back from paying
export default function PlansRouter() {
  const path = usePath()
  useParams()
  const page = path.startsWith('/plans/return') ? 'return' : path.startsWith('/plans/pay') ? 'pay' : path.startsWith('/plans/review') ? 'review' : 'plans'
  return (
    <ErrorBoundary resetKey={page} name="Plans">
      {page === 'return' ? <ReturnPage /> : page === 'pay' ? <PayPlaceholder /> : page === 'review' ? <ReviewPage b={billingState()} /> : <PlansPage />}
    </ErrorBoundary>
  )
}
