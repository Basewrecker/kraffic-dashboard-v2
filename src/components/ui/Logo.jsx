// The Auden AI mark: the app's own logo file (app.audenai.ai/api/label/logo/audenai, fetched 2026-11-16), drawn inline.
// The same colours in light and dark; in dark a faint edge keeps the tile off the sidebar.
// public/favicon.svg is that file, unchanged.
const BARS = [[6, 13, 6], [10.5, 9.5, 13], [15, 7, 18], [19.5, 11, 10], [24, 9, 14]] // [x, y, height], each 3 wide
export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="7" fill="#0A1620" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" fill="none" stroke="var(--brand-edge, transparent)" />
      <g fill="#06B0F7">{BARS.map(([x, y, h]) => <rect key={x} x={x} y={y} width="3" height={h} rx="1.5" />)}</g>
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
