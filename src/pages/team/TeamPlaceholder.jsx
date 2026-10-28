import { useEffect } from 'react'
import { Users } from 'lucide-react'
import Card from '../../components/dashboard/Card'

// /team until the Team page design (branch design/team-page) is approved: the sidebar link works and says what's coming.
export default function TeamPlaceholder() {
  useEffect(() => { document.title = 'Team · Kraffic' }, [])
  return (
    <>
      <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">Team</h1>
      <Card className="flex flex-col items-center px-5 py-14 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-tint text-stone-700" aria-hidden><Users size={18} /></span>
        <h2 className="mt-4 text-[15px] leading-5 font-semibold text-stone-900">Team management is on its way</h2>
        <p className="mt-1 max-w-[420px] text-[14px] leading-5 text-stone-600">Invite people to this workspace and choose what each of them can see and change.</p>
      </Card>
    </>
  )
}
