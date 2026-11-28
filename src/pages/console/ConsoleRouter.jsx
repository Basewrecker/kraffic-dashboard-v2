import { usePath } from '../../router'
import ErrorBoundary from '../../components/ui/ErrorBoundary'
import PaymentsPage from './PaymentsPage'
import BillingAdminPage from './BillingAdminPage'

// /console/white-label/<workspace>/payments → screen 7 · /console/billing → screen 8
export default function ConsoleRouter() {
  const path = usePath()
  const billing = path.startsWith('/console/billing')
  return <ErrorBoundary resetKey={billing ? 'billing' : 'payments'} name="Console">{billing ? <BillingAdminPage /> : <PaymentsPage />}</ErrorBoundary>
}
