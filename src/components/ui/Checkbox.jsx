// A 16px checkbox for tables (PromptTable's row and select-all boxes). The native input stays (keyboard, forms,
// screen readers) but is transparent on top of a drawn box: checked fills ink with a 120ms scale (0.8 → 1) and the
// tick draws in (stroke-dashoffset, 150ms); indeterminate shows a dash with the same motion. Reduced motion: instant
// (index.css .cb-pop / .cb-draw).
export default function Checkbox({ checked, indeterminate = false, onChange, label, className = '' }) {
  const on = checked || indeterminate
  return (
    <span className={`relative inline-grid size-4 shrink-0 place-items-center ${className}`}>
      <input type="checkbox" aria-label={label} checked={checked} onChange={onChange}
        ref={(el) => { if (el) el.indeterminate = indeterminate }}
        className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1" />
      <span aria-hidden className={`pointer-events-none grid size-4 place-items-center rounded-[4px] border transition-colors duration-150 ease-out ${
        on ? 'cb-pop border-ink bg-ink' : 'border-stone-300 bg-surface peer-hover:border-stone-500'}`}
        key={on ? (indeterminate ? 'dash' : 'tick') : 'off'}>
        {on && (
          <svg viewBox="0 0 16 16" width={12} height={12} fill="none" stroke="var(--on-ink)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path className="cb-draw" pathLength={1} d={indeterminate ? 'M4 8h8' : 'M3.5 8.5l3 3 6-7'} />
          </svg>
        )}
      </span>
    </span>
  )
}
