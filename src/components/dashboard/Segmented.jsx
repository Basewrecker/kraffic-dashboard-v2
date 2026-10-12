import { useRef } from 'react'

// ---- segmented control = radio group (arrow keys move + select, roving tabindex)
// size 'md' = h-9 (chart toolbars), 'sm' = h-8 (card headers)
export default function Segmented({ label, value, onChange, options, size = 'md', className = '', full = false }) {
  const refs = useRef([])
  const idx = options.findIndex((o) => o.value === value)
  const onKey = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const next = (idx + step + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  return (
    // full: stretches to its container with equal segments (phones)
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className={`${full ? 'flex w-full' : 'inline-flex'} ${size === 'sm' ? 'h-8' : 'h-9'} shrink-0 items-center rounded-lg bg-tint p-1 ${className}`}>
      {options.map((o, i) => {
        const on = o.value === value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.icon ? o.label : undefined}
            title={o.icon ? o.label : undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`inline-flex ${size === 'sm' ? 'h-6' : 'h-7'} ${full ? 'flex-1' : ''} items-center justify-center whitespace-nowrap rounded-md text-small font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${
              Icon ? 'w-8' : 'px-3'
            } ${on ? 'bg-raised text-ink shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
          >
            {Icon ? <Icon size={16} aria-hidden /> : o.label}
          </button>
        )
      })}
    </div>
  )
}
