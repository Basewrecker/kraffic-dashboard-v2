// The shared filter pills row (as the app, #223 / #224), in Prompt mix's look: the active pill is ink-filled with its
// count; the rest are plain text, with a small dot and their count when they carry one. Used on Site Audit (Checks,
// Pages) and Toolkit.
//   options: [{ value, label, count?, dot? }] or [[value, label]]   (dot: a colour for the dot; grey when left out)
//   <FilterPills label="Category" value={cat} onChange={setCat} options={…} />
export default function FilterPills({ label, value, onChange, options, className = '' }) {
  // an option's key is `value` (or `id`, as Trends passes it)
  const list = options.map((o) => (Array.isArray(o) ? { value: o[0], label: o[1] } : { ...o, value: o.value ?? o.id }))
  return (
    <div role="toolbar" aria-label={label} className={`flex shrink-0 items-center gap-1 ${className}`}>
      {list.map((o) => {
        const on = value === o.value
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)}
            className={`inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-[13px] leading-[18px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 ${
              on ? 'bg-ink font-semibold text-on-ink' : 'font-medium text-stone-700 hover:bg-tint hover:text-stone-900'}`}>
            {!on && o.count != null && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" style={o.dot ? { background: o.dot } : undefined} />}
            {o.label}
            {o.count != null && <span className={`font-normal tabular-nums ${on ? 'opacity-80' : 'text-stone-500'}`}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
