// "Beta" on a feature we're still improving (Sentiment, Reports, Content). The one place it's drawn, so it can go in one
// change: delete the uses (the sidebar's `beta` flags and the page headers) and this file.
// A soft violet tint (owner, 2026-11-04, after peec.ai): violet text (--beta-fg) on violet at 15% (--beta-bg), both set
// once in index.css from the --beta token; violet is used for nothing else (see DESIGN.md §3). 18px tall, 11px text,
// 6px side padding. No icon, no motion.
export default function BetaTag({ tipAlign = 'right', className = '' }) {
  return (
    <span tabIndex={0} aria-label="Beta: new, we’re still improving this"
      className={`group/beta relative inline-flex h-[18px] shrink-0 items-center rounded-full bg-[var(--beta-bg)] px-1.5 text-[11px] leading-none font-semibold text-[var(--beta-fg)] outline-none focus-visible:ring-2 focus-visible:ring-focus ${className}`}>
      Beta
      <span role="tooltip" className={`pointer-events-none absolute top-full z-30 mt-1.5 hidden w-max max-w-[220px] rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 font-normal tracking-normal text-stone-800 shadow-sm group-hover/beta:block group-focus-visible/beta:block ${tipAlign === 'left' ? 'left-0' : tipAlign === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-0'}`}>
        New: we’re still improving this.
      </span>
    </span>
  )
}
