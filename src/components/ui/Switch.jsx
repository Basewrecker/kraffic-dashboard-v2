// Shared switch: h-5 w-9 track, 16px knob, 150ms ease-out.
// On: ink track, on-ink knob. Off: track colour with a surface knob (strong border, so it reads on dark cards too).
// `children` = an optional visible label (the whole thing is the button); otherwise pass aria-label.
// size 'md' = 36px wide (default), 'sm' = 34px (settings lists)
export default function Switch({ checked, onChange, children, className = '', size = 'md', ...rest }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => onChange(!checked, e.currentTarget)}
      className={`group/switch inline-flex shrink-0 items-center gap-2 rounded-md text-small text-stone-600 outline-none ${className}`}
      {...rest}
    >
      <span
        className={`relative inline-flex h-5 ${size === 'sm' ? 'w-[34px]' : 'w-9'} shrink-0 items-center rounded-full transition-[background-color,box-shadow] duration-150 ease-out group-focus-visible/switch:ring-[3px] group-focus-visible/switch:ring-[color-mix(in_srgb,var(--ink)_15%,transparent)] ${checked ? 'bg-ink' : 'bg-[var(--data-track)]'}`}
      >
        <span
          className={`absolute left-0.5 h-4 w-4 rounded-full shadow-sm transition-[transform,background-color] duration-150 ease-out ${checked ? `${size === 'sm' ? 'translate-x-[14px]' : 'translate-x-4'} bg-on-ink` : 'translate-x-0 border border-[var(--color-line-strong)] bg-surface'}`}
        />
      </span>
      {children}
    </button>
  )
}
