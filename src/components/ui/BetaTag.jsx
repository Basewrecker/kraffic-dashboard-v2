// "Beta" on a feature we're still improving (Sentiment, Reports). The one place it's drawn, so it can go in one change:
// delete the uses (the sidebar's `beta` flags and the page headers) and this file.
// Graphite: the tint background, a hairline outline (one step stronger on an active sidebar row), 11px t2 text.
// It sits on the text baseline; hover or focus it for what it means.
export default function BetaTag({ strong = false, tipAlign = 'right', className = '' }) {
  return (
    <span tabIndex={0} aria-label="Beta: new feature, we’re still improving it"
      className={`group/beta relative inline-flex h-[18px] shrink-0 items-center rounded-[6px] border bg-tint px-1.5 text-[11px] leading-none font-medium text-stone-600 outline-none focus-visible:ring-2 focus-visible:ring-focus ${strong ? 'border-line-strong' : 'border-line'} ${className}`}>
      Beta
      <span role="tooltip" className={`pointer-events-none absolute top-full z-30 mt-1.5 hidden w-max max-w-[220px] rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 font-normal text-stone-800 shadow-sm group-hover/beta:block group-focus-visible/beta:block ${tipAlign === 'left' ? 'left-0' : tipAlign === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-0'}`}>
        New feature, we’re still improving it.
      </span>
    </span>
  )
}
