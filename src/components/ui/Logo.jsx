// The Kraffic mark: a rounded tile with a bold geometric K whose upper arm ends in a dot.
// Tile = currentColor (set to --brand-tile), K = --brand-k, dot = --brand-accent (the only place that blue is used).
// public/favicon.svg is the same drawing in the light colours.
export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden className="shrink-0" style={{ color: 'var(--brand-tile)' }}>
      <rect width="28" height="28" rx="8" fill="currentColor" />
      <g fill="var(--brand-k)">
        <rect x="7.5" y="6.5" width="3.8" height="15" rx="0.8" />
        {/* upper arm, stopping short of the dot */}
        <path d="M10.4 15.6 L15.9 9.6 L18.5 12 L13.1 17.9 Z" />
        {/* lower leg */}
        <path d="M11.9 13.2 L20.6 21.5 L15.5 21.5 L10.6 16.8 Z" />
      </g>
      <circle cx="19.2" cy="8.4" r="2.4" fill="var(--brand-accent)" />
    </svg>
  )
}

// mark + "Kraffic" (the blue lives only in the mark's dot)
export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo />
      <span className="text-[16px] leading-5 font-bold tracking-[-0.02em] text-ink">Kraffic</span>
    </div>
  )
}
