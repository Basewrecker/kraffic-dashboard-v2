import { Check, X } from 'lucide-react'

// The coverage marker (Structured Data's Coverage map, and Reports): one indicator vocabulary.
//   tick ● all (ink + check) · part-filled ring ◔ some (the arc = found / applies, from 12 o'clock) · dashed ring ◌ none
//   (a dash "—" for "not relevant" is text, drawn by the caller)
// Reports only: tone 'bad' draws the ring / tick red (a rival leads), 'good' green; cross: a red ✕ (lost).
const TONE = { ink: 'var(--ink)', good: 'var(--rep-good, #1A7F4B)', bad: 'var(--rep-bad, var(--negative))' }
export default function Marker({ found, applies, size = 20, tone = 'ink', cross = false }) {
  const sw = 2.5
  const r = (size - sw) / 2
  const len = 2 * Math.PI * r
  const c = TONE[tone] ?? TONE.ink
  if (cross) {
    return <span className="grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: TONE.bad }} aria-hidden><X size={size * 0.6} strokeWidth={2.5} className="text-[var(--color-surface)]" /></span>
  }
  if (applies && found === applies) {
    return <span className="grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: c }} aria-hidden><Check size={size * 0.6} strokeWidth={2.5} className="text-[var(--color-surface)]" /></span>
  }
  if (!found) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={(size - 1.5) / 2} fill="none" stroke="var(--color-line-strong)" strokeWidth={1.5} strokeDasharray="3 2.5" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--data-track)" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={len} strokeDashoffset={len * (1 - found / applies)} />
    </svg>
  )
}
