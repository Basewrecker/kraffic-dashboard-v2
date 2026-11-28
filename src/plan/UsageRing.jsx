import { ringTone } from './plan.js'

// The usage ring (as the app's UsageRing): a thin track with an arc for the share used. The arc is ink, amber from
// 80% used, red from 95%; nothing else is tinted. variant 'pill' (on an ink fill): track at 20% of on-ink, arc on-ink.
// animate: the arc moves to its value (250ms); the caller sets pct=0 first for a fill-in.
const TONE = { ok: 'var(--ink)', warn: 'var(--ring-warn)', full: 'var(--ring-full)' }
export default function UsageRing({ pct, size = 16, stroke = 2, variant = 'row', className = '' }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const tone = ringTone(pct)
  const arc = variant === 'pill' ? (tone === 'ok' ? 'var(--on-ink)' : TONE[tone]) : TONE[tone]
  const track = variant === 'pill' ? 'color-mix(in srgb, var(--on-ink) 20%, transparent)' : 'var(--color-line-strong)'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className={`shrink-0 -rotate-90 ${className}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={arc} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, pct)))}
        className="transition-[stroke-dashoffset] duration-[600ms] ease-[var(--motion-ease-out)] motion-reduce:transition-none" />
    </svg>
  )
}
