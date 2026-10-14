import { usePath } from '../../router'
import ErrorBoundary from '../../components/ui/ErrorBoundary'
import BillingPage from './BillingPage'
import PlansPage from './PlansPage'

// /billing → Billing · /billing/plans → Choose a plan
export default function BillingRouter() {
  const plans = usePath().startsWith('/billing/plans')
  return <ErrorBoundary resetKey={plans ? 'plans' : 'billing'} name="Billing">{plans ? <PlansPage /> : <BillingPage />}</ErrorBoundary>
}
