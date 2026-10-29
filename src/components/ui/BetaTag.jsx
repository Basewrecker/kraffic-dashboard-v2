import { useEffect, useRef } from 'react'

// "Beta" on a feature we're still improving (Sentiment, Reports). The one place it's drawn, so it can go in one change:
// delete the uses (the sidebar's `beta` flags and the page headers) and this file.
// Solid violet (the --beta token, set once in index.css); violet is used for nothing else (see CLAUDE.md).
// Motion: once on load and again when its sidebar row (or the tag, in a header) is hovered; the sparkle twinkles
// and a soft sheen crosses the pill. Never loops, transform/opacity only, static with reduced motion.
const TWINKLE = {
  frames: [{ transform: 'scale(.8)', opacity: 0.55 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.55 }, { transform: 'scale(1)', opacity: 1 }],
  opts: { duration: 600, easing: 'cubic-bezier(.3,.7,.4,1)' },
}
const SHEEN = {
  frames: [{ transform: 'translateX(-120%)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.7 }, { transform: 'translateX(260%)', opacity: 0 }],
  opts: { duration: 700, easing: 'cubic-bezier(.4,0,.2,1)' },
}

export default function BetaTag({ tipAlign = 'right', className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const star = el.querySelector('[data-beta-star]'), sheen = el.querySelector('[data-beta-sheen]')
    let anims = []
    const play = () => {
      anims.forEach((a) => a.cancel())
      anims = [star.animate(TWINKLE.frames, TWINKLE.opts), sheen.animate(SHEEN.frames, SHEEN.opts)]
    }
    play()
    const host = el.closest('a') ?? el
    host.addEventListener('mouseenter', play)
    return () => { host.removeEventListener('mouseenter', play); anims.forEach((a) => a.cancel()) }
  }, [])

  return (
    <span ref={ref} tabIndex={0} aria-label="Beta: new, we’re still improving this"
      className={`group/beta relative inline-flex h-[18px] shrink-0 items-center gap-[3px] rounded-full bg-beta px-[7px] py-[2px] text-[10.5px] leading-none font-semibold tracking-[0.01em] text-on-beta outline-none focus-visible:ring-2 focus-visible:ring-focus ${className}`}>
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        <span data-beta-sheen className="absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--on-beta)_40%,transparent)] to-transparent opacity-0" />
      </span>
      {/* a four-point sparkle with curved sides (a straight-sided one reads as "+" at this size) */}
      <svg data-beta-star aria-hidden viewBox="0 0 24 24" className="relative size-2.5 shrink-0 fill-current">
        <path d="M12 1C12.6 7.6 16.4 11.4 23 12C16.4 12.6 12.6 16.4 12 23C11.4 16.4 7.6 12.6 1 12C7.6 11.4 11.4 7.6 12 1Z" />
      </svg>
      <span className="relative">Beta</span>
      <span role="tooltip" className={`pointer-events-none absolute top-full z-30 mt-1.5 hidden w-max max-w-[220px] rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 font-normal tracking-normal text-stone-800 shadow-sm group-hover/beta:block group-focus-visible/beta:block ${tipAlign === 'left' ? 'left-0' : tipAlign === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-0'}`}>
        New: we’re still improving this.
      </span>
    </span>
  )
}
