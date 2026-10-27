import { ChevronRight } from 'lucide-react'
import { PlatformIcon } from '../dashboard/icons'

// The pieces the Sync drawer ("Changes on Oct 5") is made of, shared with the Mentions and citations drawer's
// week drill-in so the two read as one family:
//   EngineChips  the engine filter at the top of a drawer (All · AI Overview · Gemini · …): a tablist, arrows move
//   ChangeTabs   Lost | Gained with their counts, on the header's bottom border
//   ChangeRows   the two-line rows (prompt / what happened), 60px, dividers; a row opens the Answer drawer

// arrow keys move along a tablist and pick (roving tabindex): ids in order, the current one, pick, the attribute to focus
const arrows = (ids, value, pick, attr) => (e) => {
  const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
  if (!step) return
  e.preventDefault()
  const i = ids.indexOf(value)
  const next = ids[(i + step + ids.length) % ids.length]
  pick(next)
  const list = e.currentTarget
  requestAnimationFrame(() => list.querySelector(`[${attr}="${next}"]`)?.focus())
}

export function EngineChips({ chips, value, onChange }) {
  return (
    <div role="tablist" aria-label="Engine" onKeyDown={arrows(chips.map((c) => c.id), value, onChange, 'data-chip')}
      className="inline-flex h-8 min-w-0 items-center overflow-x-auto rounded-lg bg-tint p-0.5 [scrollbar-width:none]">
      {chips.map((c) => {
        const on = c.id === value
        return (
          <button key={c.id} data-chip={c.id} type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1} onClick={() => onChange(c.id)}
            className={`inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] leading-[18px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'bg-raised text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}>
            {c.id !== 'all' && <PlatformIcon id={c.id} size={14} />}{c.name}
          </button>
        )
      })}
    </div>
  )
}

export const CHANGE_TABS = [['lost', 'Lost'], ['gained', 'Gained']]

export function ChangeTabs({ tab, counts, onChange, className = 'mt-4' }) {
  return (
    <div role="tablist" aria-label="Lost and gained" onKeyDown={arrows(CHANGE_TABS.map((t) => t[0]), tab, onChange, 'data-tab')} className={`flex gap-6 ${className}`}>
      {CHANGE_TABS.map(([id, label]) => (
        <button key={id} data-tab={id} type="button" role="tab" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => onChange(id)}
          className={`-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 text-[14px] leading-5 font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${tab === id ? 'border-ink text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900'}`}>
          {label}<span className="text-[13px] leading-[18px] font-normal text-stone-500 tabular-nums">{counts[id]}</span>
        </button>
      ))}
    </div>
  )
}

// items: [{ key, prompt, meta }]; onOpen(item, el) makes rows buttons (a page row has nothing to open: plain)
export function ChangeRows({ items, onOpen, empty }) {
  if (!items.length) return <p className="px-6 py-12 text-center text-[14px] leading-5 text-stone-600">{empty}</p>
  return (
    <ul className="divide-y divide-[var(--div)]">
      {items.map((it) => (
        <li key={it.key}>
          {onOpen && !it.plain ? (
            <button type="button" data-nav onClick={(e) => onOpen(it, e.currentTarget)}
              className="group flex h-[60px] w-full items-center gap-3 px-6 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{it.prompt}</span>
                <span className="block truncate text-[12.5px] leading-[18px] text-stone-600">{it.meta}</span>
              </span>
              <ChevronRight size={14} className="shrink-0 text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
            </button>
          ) : (
            <div className="flex h-[60px] items-center px-6">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{it.prompt}</span>
                <span className="block truncate text-[12.5px] leading-[18px] text-stone-600">{it.meta}</span>
              </span>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
