import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useDashboardView } from '../../hooks/useBrandView'
import { goToSection } from '../../utils/navigate'

// "Show exactly these prompts": an insight's action narrows one table to a set of prompt ids, with a
// dismissible pill naming the set ("Cited by AI Overview ×"). Tables: 'visible-prompts', 'missed-prompts',
// 'marketplace-prompts'. Cleared when the brand view or engine filter changes (ids are per view).
const EVENT = 'prompt-set:show'

export function showPromptSet(table, ids, label) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { table, ids: new Set(ids), label } }))
  // let the narrowed table render before measuring where to scroll
  requestAnimationFrame(() => requestAnimationFrame(() => goToSection(table)))
}

// Tracked prompt ids ("v12" / "m3") → narrow both the Visible and Missed tables, then go to Visible.
// Dermasuri's tables use numeric ids; competitor tables use tracked ids (pass own=false).
export function showPromptSets(trackedIds, label, own = true) {
  const toId = (k) => (own ? Number(k.slice(1)) : k)
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { table: 'visible-prompts', ids: new Set(trackedIds.filter((k) => k[0] === 'v').map(toId)), label } }))
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { table: 'missed-prompts', ids: new Set(trackedIds.filter((k) => k[0] === 'm').map(toId)), label } }))
  requestAnimationFrame(() => requestAnimationFrame(() => goToSection('visible-prompts')))
}

// For the receiving table: { ids (Set) | null, label, clear }
export function usePromptSet(table) {
  const [set, setSet] = useState(null)
  const { focal, engine } = useDashboardView()
  useEffect(() => {
    const on = (e) => { if (e.detail?.table === table) setSet({ ids: e.detail.ids, label: e.detail.label }) }
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [table])
  useEffect(() => setSet(null), [focal, engine])
  return { ids: set?.ids ?? null, label: set?.label ?? '', clear: () => setSet(null) }
}

export function PromptSetPill({ set }) {
  if (!set.ids) return null
  return (
    <button
      type="button"
      onClick={set.clear}
      aria-label={`${set.label}. Clear`}
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface pl-2.5 pr-1.5 text-[13px] leading-[18px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus"
    >
      {set.label}
      <X size={14} className="text-stone-500" aria-hidden />
    </button>
  )
}
