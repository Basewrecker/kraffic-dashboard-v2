import { useRef } from 'react'

// One shared filter row (as the app's FilterPills, #223 / #224: Prompt mix's look): the active pill is ink-filled with
// its count; the rest are plain text with a dot and a count. A radio group: ←/→ move and pick.
//   options: [{ id, label, count? }]
export default function FilterPills({ label, value, onChange, options, className = '' }) {
  const refs = useRef([])
  const idx = options.findIndex((o) => o.id === value)
  const onKey = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const next = (idx + step + options.length) % options.length
    onChange(options[next].id)
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className={`flex flex-wrap items-center gap-x-1 gap-y-1 ${className}`}>
      {options.map((o, i) => {
        const on = o.id === value
        return (
          <button key={o.id} ref={(el) => (refs.current[i] = el)} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => onChange(o.id)}
            className={`inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] leading-[18px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${
              on ? 'bg-ink font-semibold text-on-ink' : 'font-medium text-stone-700 hover:bg-tint hover:text-stone-900'}`}>
            {!on && <span aria-hidden className="size-1.5 rounded-full bg-stone-400" />}
            {o.label}
            {o.count != null && <span className={`tabular-nums ${on ? 'font-medium opacity-70' : 'font-normal text-stone-500'}`}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
