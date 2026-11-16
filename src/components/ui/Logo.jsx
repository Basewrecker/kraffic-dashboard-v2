// The Auden AI mark (owner, 2026-11-16): a dark rounded tile with five blue sound bars, drawn from the live logo. The
// same colours in light and dark; in dark a faint edge keeps the tile off the sidebar.
// public/favicon.svg is the same drawing.
const BARS = [[9, 9], [15.5, 19], [22, 27], [29, 15], [36, 21]] // [x, height] on a 48 grid; each 5 wide, centred
export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <rect width="48" height="48" rx="11" fill="#0D161F" />
      <rect x="0.5" y="0.5" width="47" height="47" rx="10.5" fill="none" stroke="var(--brand-edge, transparent)" />
      {BARS.map(([x, h]) => <rect key={x} x={x} y={24 - h / 2} width="5" height={h} rx="2.5" fill="#51ADF2" />)}
    </svg>
  )
}

// mark + "Auden AI"
export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo />
      <span className="text-[16px] leading-5 font-bold tracking-[-0.02em] text-ink">Auden AI</span>
    </div>
  )
}
