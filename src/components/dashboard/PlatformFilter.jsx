import { X } from 'lucide-react'
import { PlatformIcon } from './icons'
import { engineName, enginePid } from '../../data/brandViews'
import { useDashboardView } from '../../hooks/useBrandView'

// The prompt tables' view of the dashboard's one engine filter (useBrandView → ?engine=).
// platform = [prompt-data id] ('google' = AI Overview) or null when "All engines".
export const joinNames = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)

// kept for App's tree; the state lives in DashboardViewProvider
export function PlatformFilterProvider({ children }) {
  return children
}

const ENGINE_OF = { google: 'aio', gemini: 'gemini', chatgpt: 'chatgpt', claude: 'claude', grok: 'grok' }

export function usePlatformFilter() {
  const { engine, setEngine } = useDashboardView()
  const pid = engine === 'all' ? null : enginePid(engine)
  return {
    engine,
    platform: pid ? [pid] : null,
    // accepts a prompt-data id, a card id, or null
    setPlatform: (p) => { const id = [].concat(p ?? [])[0]; setEngine(id ? ENGINE_OF[id] ?? id : 'all') },
    // a row matches when it involves the filtered engine
    matches: (rowPlatforms) => !pid || rowPlatforms.includes(pid),
    label: pid ? engineName(engine) : '',
  }
}

// "[logo] Gemini only ×" — the filter chip in the prompt tables' toolbars and the KPI row
export function PlatformFilterPill({ className = '' }) {
  const { engine, setEngine } = useDashboardView()
  if (engine === 'all') return null
  const name = engineName(engine)
  return (
    <button
      type="button"
      onClick={() => setEngine('all')}
      aria-label={`${name} only. Clear engine filter`}
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface pl-2 pr-1.5 text-[13px] leading-[18px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus ${className}`}
    >
      <PlatformIcon id={engine} size={14} />
      {name} only
      <X size={14} className="text-stone-500" aria-hidden />
    </button>
  )
}
