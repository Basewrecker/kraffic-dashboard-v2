import { useState } from 'react'
import { ArrowRight, Info } from 'lucide-react'
import Card from './Card'

// icon: lucide component; tone: { bg, fg } classes for the 32px chip (one tinted chip per card header).
// With onOpen the whole card is a link (click, Enter or Space) and `link` is its label.
// hint: how the number is worked out, behind an info button beside the label (hover or focus; not on link cards)
// On screens 800px tall or less (desktop) the card is 16px top and bottom with 8px above its link, so the next row
// peeks above the fold (owner, 2026-11-03).
// Optional: linkIcon (the link's arrow; default →) and selected (a card that is also a filter: a 1px ink border).
// compact (the Overview's row, as the app #216): the four cards are one height, about 155px: the label row, the number
// 2px under it, the link or footer 20px under that. notes: lines that apply to the number right now ("Scoring updated
// Oct 5 …"); they sit in the ⓘ under the hint, in the dark tip, and the ⓘ carries a small dot while there is one.
export default function KpiCard({ label, icon: Icon, tone, children, footer, link, onOpen, hint, notes = [], compact = false, linkIcon: LinkIcon = ArrowRight, selected, tour }) {
  const [tip, setTip] = useState(false)
  const interactive = Boolean(onOpen)
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault() // Space would scroll the page
    onOpen(e)
  }
  return (
    <Card
      data-tour={tour}
      {...(interactive && { role: 'link', tabIndex: 0, onClick: onOpen, onKeyDown, 'aria-label': `${label}: ${link}` })}
      {...(selected != null && { 'aria-current': selected ? 'true' : undefined })}
      className={`group flex h-full flex-col ${compact ? 'p-4 md:p-5' : 'p-4 md:p-5 lg:min-h-[148px] lg:[@media(max-height:800px)]:min-h-0 lg:[@media(max-height:800px)]:py-4'} ${
        interactive ? 'cursor-pointer outline-none transition-[border-color,box-shadow] duration-150 ease-out hover:border-[var(--color-line-strong)] hover:shadow-sm focus-visible:ring-2 focus-visible:ring-focus' : ''
      } ${selected ? '!border-ink' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="relative flex items-center gap-1 pt-1.5 text-[12px] leading-4 font-medium text-stone-600 md:text-body">
          {label}
          {hint && !interactive && (
            <>
              <button type="button" aria-label={`How ${label.toLowerCase()} is worked out${notes.length ? `. ${notes.length === 1 ? 'A note applies' : `${notes.length} notes apply`}` : ''}`} aria-describedby={tip ? 'kpi-hint' : undefined}
                onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)} onFocus={() => setTip(true)} onBlur={() => setTip(false)}
                className="relative grid h-5 w-5 place-items-center rounded-full text-stone-500 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
                <Info size={14} aria-hidden />
                {/* a note applies to the number right now: a small dot on the ⓘ's corner (the card's own ring keeps it off the icon) */}
                {notes.length > 0 && <span data-kpi-note-dot aria-hidden className="absolute right-0 top-0 h-[7px] w-[7px] rounded-full ring-[1.5px] ring-[var(--color-surface)]" style={{ background: 'var(--caution)' }} />}
              </button>
              {tip && (compact ? (
                <span id="kpi-hint" role="tooltip" className="tip-dark absolute left-0 top-full z-20 mt-1 w-72 text-left font-normal tracking-normal">
                  {hint}
                  {notes.map((n, i) => <span key={i} className="mt-2 block border-t border-[var(--hc-line)] pt-2">{n}</span>)}
                </span>
              ) : (
                <span id="kpi-hint" role="tooltip" className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-line bg-raised px-2.5 py-2 text-[12px] leading-4 font-normal text-stone-700 shadow-md">
                  {hint}
                </span>
              ))}
            </>
          )}
        </div>
        {Icon && <span className={`hidden h-8 w-8 shrink-0 md:grid place-items-center rounded-lg ${tone.bg} ${tone.fg}`} aria-hidden><Icon size={16} /></span>}
      </div>
      <div className={compact ? '' : 'mt-1'}>{children}</div>
      {interactive ? (
        <div className={`mt-auto inline-flex min-h-6 items-center gap-1 text-[12px] leading-4 ${compact ? 'pt-3 md:pt-[22px]' : 'pt-3 md:pt-4 lg:[@media(max-height:800px)]:pt-2'} md:text-[13px] md:leading-[18px] font-medium text-stone-600 transition-colors duration-150 ease-out group-hover:text-ink group-focus-visible:text-ink`}>
          {link}
          <LinkIcon size={14} className="transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
        </div>
      ) : (
        footer && <div className={`mt-auto text-[12px] leading-4 font-normal text-stone-500 ${compact ? 'flex min-h-6 items-center pt-2 md:pt-2.5 md:text-[13px] md:leading-[18px]' : 'pt-3 md:pt-4 md:text-small'}`}>{footer}</div>
      )}
    </Card>
  )
}
