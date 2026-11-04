// Opportunities → Content workspace: the sticky action dock. When the payoff bar scrolls out of view (the caller's
// IntersectionObserver), a dark dock slides up from the bottom, centred, 24px from the edge (translateY 16px → 0 and a
// fade, 220ms spring), and slides away when the bar is back. Ink background, inverted text, 14px radius, 8px padding,
// one line: "2 of 5" (muted) · the current choice (14/500, middle-truncated) · Skip (when the step allows it) · a light
// button with the bar's own label, doing the same thing. Keyboard reachable (it's left out of the tab order while
// hidden); hidden on print. Reduced motion: a fade only.
import { SNAPPY, spring } from '../../../utils/spring'
import { MidText } from '../parts'
import { ActionButton } from './PayoffBar'
import { STEPS } from './flow'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const SP = spring(SNAPPY)

export default function ActionDock({ show, open, choice, action, secondary = null }) {
  const still = reduced()
  const t = still ? 'opacity 150ms ease-out' : `opacity 220ms ease-out, transform ${Math.min(SP.duration, 220)}ms ${SP.easing}`
  return (
    <div aria-hidden={!show || undefined} inert={show ? undefined : ''}
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 print:hidden lg:pl-[248px]">
      <div role="region" aria-label="Current step"
        className="pointer-events-auto flex max-w-full items-center gap-3 whitespace-nowrap rounded-[14px] bg-ink p-2 pl-4 text-on-ink shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--ink)_45%,transparent)]"
        style={{ opacity: show ? 1 : 0, transform: show || still ? 'translateY(0)' : 'translateY(16px)', transition: t }}>
        <span className="text-[13px] leading-[18px] tabular-nums text-[color-mix(in_srgb,var(--on-ink)_60%,transparent)]">{open + 1} of {STEPS.length}</span>
        {choice && <MidText text={choice} className="max-w-[280px] text-[14px] leading-5 font-medium" />}
        {secondary && <button type="button" onClick={secondary.onClick} className="rounded px-1 text-[13px] leading-[18px] font-medium text-[color-mix(in_srgb,var(--on-ink)_70%,transparent)] outline-none hover:text-[var(--on-ink)] focus-visible:ring-2 focus-visible:ring-focus">{secondary.label}</button>}
        {action && <ActionButton action={action} tone="light" size="sm" still={still} />}
      </div>
    </div>
  )
}
