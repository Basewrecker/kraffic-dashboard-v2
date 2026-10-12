import { ChevronDown } from 'lucide-react'

// Shared select: 1px line border, rounded-md, 14px chevron, ink focus ring.
// size 'sm' = h-8 (inline rows), 'row' = 34px (settings lists), 'md' = h-9 (full-width in a tile).
// options: [value, label] pairs. onChange(value, selectElement) — the element anchors confirm popovers.
export default function Select({ value, options, onChange, label, size = 'sm', className = 'w-44' }) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value, e.currentTarget)}
        className={`${size === 'md' ? 'h-9 text-[14px]' : size === 'row' ? 'h-[34px] text-[13px]' : 'h-8 text-[13px]'} w-full cursor-pointer appearance-none truncate rounded-md border border-line bg-raised pl-3 pr-8 font-medium text-stone-900 outline-none transition-[border-color,box-shadow] duration-150 ease-out hover:border-[var(--color-line-strong)] focus-visible:border-[color-mix(in_srgb,var(--ink)_35%,transparent)] focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--ink)_8%,transparent)]`}
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden />
    </span>
  )
}
