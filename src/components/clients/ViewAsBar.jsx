import { Eye } from 'lucide-react'
import { AGENCY_HOME, HOME } from '../dashboard/Sidebar'
import { agency, role, setViewing, viewingClient } from '../../store/workspace'
import { textBtn } from './shared'

// An agency (or a superadmin, ?viewer=superadmin) working inside a client's account, in the same tab: who they are and
// the way back. Shown once View as (or Add client) opened the client; Back clears it and returns to the Clients list.
// fallback: the client's name when nothing opened it (First-time setup's own preview)
export default function ViewAsBar({ fallback = null, className = '' }) {
  const q = new URLSearchParams(window.location.search)
  const superadmin = q.get('viewer') === 'superadmin'
  const client = q.get('client') ?? viewingClient() ?? fallback
  if (!client || (!superadmin && role() !== 'agency')) return null
  return (
    <div role="status" className={`flex h-10 items-center gap-2 rounded-[10px] bg-tint px-4 text-[13px] leading-[18px] text-stone-600 ${className}`}>
      <Eye size={14} className="shrink-0 text-stone-500" aria-hidden />
      <span className="min-w-0 flex-1 truncate">Viewing <span className="font-medium text-stone-900">{client}</span> as {superadmin ? 'superadmin' : agency.name}</span>
      <a href={superadmin ? HOME : AGENCY_HOME} onClick={() => setViewing(null)} className={textBtn}>
        {superadmin ? 'Exit' : <><span className="md:hidden">Back</span><span className="max-md:hidden">Back to {agency.name}</span></>}
      </a>
    </div>
  )
}
