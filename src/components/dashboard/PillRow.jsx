// The shared row of filter pills, Prompt mix's look (as the app's ui/FilterPills): the active pill ink-filled with its
// count, the rest plain text with a small dot and their count. One pill is always active. Used by Prompt mix, Sync
// history, Missed prompts and Marketplace prompts.
//   items: [{ id, label, count?, dot?: CSS colour (none: no dot), strong?: semibold label, extra?: node after the count,
//             disabled?: nothing to show (count 0): muted, not clickable }]
//   value: the active id · onChange(id) · label: the toolbar's name for screen readers
//   bleed: the card's side padding class pair, so the row scrolls sideways edge to edge on narrow screens
//   after: nodes after the pills (e.g. a "New wins only ×" chip)
export default function PillRow({ items, value, onChange, label, bleed = '-mx-5 px-5', after = null, className = '' }) {
  return (
    <div className={`${bleed} flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`} role="toolbar" aria-label={label}>
      {items.map((it) => {
        const on = it.id === value
        return (
          <button key={String(it.id)} type="button" aria-pressed={on} disabled={it.disabled && !on} onClick={() => onChange(it.id)}
            className={`inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-small font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none ${
              on ? 'bg-ink text-on-ink' : it.disabled ? 'text-stone-400' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}>
            {it.dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: on ? 'var(--color-on-ink)' : it.dot, opacity: it.disabled && !on ? 0.5 : 1 }} aria-hidden />}
            <span className={it.strong ? 'font-semibold' : undefined}>{it.label}</span>
            {it.count != null && <span className={`tabular-nums ${on ? 'text-on-ink/80' : it.disabled ? 'text-stone-400' : 'text-stone-500'}`}>{it.count}</span>}
            {it.extra?.(on)}
          </button>
        )
      })}
      {after}
    </div>
  )
}
