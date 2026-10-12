import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useBrandView } from '../../hooks/useBrandView'
import { goToSection } from '../../utils/navigate'

const EVENT = 'sync-prompts:show'
const TABLE = { gained: 'visible-prompts', lost: 'missed-prompts' }
const short = (d) => d.replace(/, \d{4}$/, '') // "Oct 5, 2026" → "Oct 5"

// "+N more →" in Sync history: filter the Visible (gained) or Missed (lost) table to one sync, then jump there.
export function showSyncPrompts(kind, syncId) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { kind, syncId } }))
  // let the filtered table render before measuring where to scroll
  requestAnimationFrame(() => requestAnimationFrame(() => goToSection(TABLE[kind])))
}

// For the receiving table. Returns { ids, sync, clear }: ids (a Set) is null while no sync filter is on.
export function useSyncFilter(kind) {
  const [syncId, setSyncId] = useState(null)
  const { syncHistory, focal } = useBrandView() // the focal brand's syncs ("Viewing as")
  useEffect(() => setSyncId(null), [focal.domain])
  useEffect(() => {
    const onShow = (e) => { if (e.detail?.kind === kind) setSyncId(e.detail.syncId) }
    window.addEventListener(EVENT, onShow)
    return () => window.removeEventListener(EVENT, onShow)
  }, [kind])
  const sync = syncId == null ? null : syncHistory.find((s) => s.id === syncId)
  const ids = sync?.changes ? new Set(sync.changes[kind].map((p) => p.id)) : null
  return { ids, sync, clear: () => setSyncId(null) }
}

// Dismissible pill for the table's filter row: "Gained on Oct 5 ×"
export function SyncFilterPill({ kind, sync, onClear }) {
  return (
    <button
      onClick={onClear}
      className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-stone-200 bg-surface pl-3 pr-2 text-small font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-focus"
    >
      {kind === 'gained' ? 'Gained' : 'Lost'} on {short(sync.date)}
      <X size={14} className="text-stone-500" aria-label="Clear sync filter" />
    </button>
  )
}
