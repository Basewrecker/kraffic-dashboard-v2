import { Loader2, RefreshCw } from 'lucide-react'
import { SecondaryButton } from '../dashboard/overlays'
import { setViewing } from '../../store/workspace'

// the Clients list's shared bits: setup labels, a sync's state, the row's Sync button, View as
export const textBtn = 'inline-flex shrink-0 items-center gap-1 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 ease-out hover:text-ink focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-40'
export const Spinner = ({ size = 14 }) => <Loader2 size={size} className="shrink-0 animate-spin text-stone-500 motion-reduce:animate-none" aria-hidden />

export const SETUP = { ready: 'Set up', scanning: 'Scanning', prompts: 'Needs prompts' }
// "Oct 5, 9:40 AM"
export const fmtSync = (iso) => (iso === 'now' ? 'Just now' : new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))
// a sync's overall progress, 0–100
export const pctOf = (progress) => {
  const ps = Object.values(progress ?? {})
  return ps.length ? Math.round((ps.reduce((a, p) => a + p.done / Math.max(1, p.total), 0) / ps.length) * 100) : 0
}
// a sync is on its way (asked, running, or still running in the background): Sync stays off for that client
export const syncBusy = (s) => ['starting', 'running', 'background'].includes(s?.status)

// "View as": opens the client's account in this tab, under the "Viewing … as PTA Agency" bar (the app: its
// login-as-client). Here the mock keeps the brand in this browser; a client still in setup lands on First-time setup
export function viewAs(c) {
  try { localStorage.setItem('kraffic:brand', c.brandId ?? '') } catch { /* private mode */ }
  setViewing(c.name)
  const setup = { scanning: 'scanning', prompts: 'competitors' }[c.setup]
  window.location.assign(setup || !c.brandId ? `/first-setup?mock=${setup ?? 'new'}` : '/overview')
}

// a row's Sync: off while that client's sync is on its way, and until the client has prompts and its first scan is done
export function SyncButton({ c, sync, onClick, label = 'Sync' }) {
  const busy = syncBusy(sync)
  const why = busy ? 'A sync is already running for this client' : c.setup === 'prompts' ? 'Add prompts first' : c.setup === 'scanning' ? 'The first scan is still running' : undefined
  return (
    <span title={why}>
      <SecondaryButton size="sm" icon={RefreshCw} disabled={Boolean(why)} onClick={onClick} aria-label={`${label} ${c.name}`}>{label}</SecondaryButton>
    </span>
  )
}

export function lastSyncText(c, sync) {
  switch (sync?.status) {
    case 'starting': return 'Starting sync…'
    case 'running': return `Syncing · ${pctOf(sync.progress)}%`
    case 'background': return 'Running in the background'
    case 'error': return 'Sync didn’t start'
    default: return c.lastSync ? fmtSync(c.lastSync) : 'Never synced'
  }
}

