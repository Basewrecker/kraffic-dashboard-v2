import { usePath } from '../../router'
import ErrorBoundary from '../../components/ui/ErrorBoundary'
import { useParams } from '../../components/audit/parts'
import { billingState } from '../../billing/state.js'
import PlansPage from './PlansPage'
import ReturnPage from './ReturnPage'
import PayPlaceholder from './PayPlaceholder'
import { navigate } from '../../router'

// /plans → Plans (and, with a subscription, its Billing tab) · /plans/review → the review step as a page (email
// links) · /plans/pay → a labelled stand-in for the payment provider's pages · /plans/return → back from paying
export default function PlansRouter() {
  const path = usePath()
  useParams()
  const page = path.startsWith('/plans/return') ? 'return' : path.startsWith('/plans/pay') ? 'pay' : path.startsWith('/plans/review') ? 'review' : 'plans'
  return (
    <ErrorBoundary resetKey={page} name="Plans">
      {page === 'return' ? <ReturnPage /> : page === 'pay' ? <PayPlaceholder /> : page === 'review' ? <ToCheckout /> : <PlansPage />}
    </ErrorBoundary>
  )
}

// the review step became the checkout (owner, 2026-11-28): old links land there
function ToCheckout() { const plan = new URLSearchParams(window.location.search).get('plan') ?? 'growth'; setTimeout(() => navigate(`/plans/checkout?plan=${plan}`), 0); return null }
