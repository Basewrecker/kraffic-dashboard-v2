// Semicircle gauge: a track arc and an ink arc that grows with value (0–100). The whole stroke sits inside the box:
// top of the stroke at y = 0, the round caps end at the bottom edge. width 72 / stroke 8 → 72×40 (AI Visibility);
// width 160 / stroke 12 → 160×86 (AI readiness).
export default function Gauge({ value, width = 72, stroke = 8 }) {
  const W = width, SW = stroke
  const R = W / 2 - SW / 2
  const CX = W / 2, CY = R + SW / 2
  const H = CY + SW / 2
  const d = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`
  const len = Math.PI * R
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="shrink-0">
      <path d={d} fill="none" stroke="var(--data-track)" strokeWidth={SW} strokeLinecap="round" />
      {value > 0 && (
        <path d={d} fill="none" stroke="var(--ink)" strokeWidth={SW} strokeLinecap="round"
          strokeDasharray={len} strokeDashoffset={len * (1 - Math.min(value, 100) / 100)} />
      )}
    </svg>
  )
}
