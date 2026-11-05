// Step 5 (Publish and track): small pieces shared by the waiting and tracking cards.
import { Check } from 'lucide-react'

export const btnPrimary = 'inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-small font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50'
export const btnSecondary = 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-small font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50'
export const btnSmall = 'inline-flex h-8 shrink-0 items-center rounded-lg border border-line px-2.5 text-[13px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'

// a solid green tick (published, improved)
export function GreenTick({ size = 20 }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-[var(--rep-up-fg)]" style={{ width: size, height: size }} aria-hidden>
      <Check size={Math.round(size * 0.6)} strokeWidth={3} className="text-[var(--color-surface)]" />
    </span>
  )
}

// a dashed ring: not found / no change (Marker's "none")
export function DashedRing({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={(size - 1.5) / 2} fill="none" stroke="var(--color-line-strong)" strokeWidth={1.5} strokeDasharray="3 2.5" />
    </svg>
  )
}

// the pulsing "waiting" dot (index.css .status-pulse, off under reduced motion)
export const PulseDot = () => <span className="status-pulse inline-block h-2 w-2 shrink-0 rounded-full bg-ink" aria-hidden />
