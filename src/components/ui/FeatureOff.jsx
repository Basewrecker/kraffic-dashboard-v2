import { Lock } from 'lucide-react'
import Card from '../dashboard/Card'

// A page whose feature isn't switched on for the account (account.features): what it is and who switches it on.
// Nothing to run or buy here; the backend refuses the feature's data until support switches it on.
export default function FeatureOff({ name, what }) {
  return (
    <Card className="mt-4 flex flex-col items-center px-5 py-14 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-tint text-stone-700" aria-hidden><Lock size={18} /></span>
      <h2 className="mt-4 text-[15px] leading-5 font-semibold text-stone-900">{name} isn’t switched on for this account</h2>
      <p className="mt-1 max-w-[420px] text-[14px] leading-5 text-stone-600">{what} Contact the Kraffic Support team to switch it on.</p>
    </Card>
  )
}
