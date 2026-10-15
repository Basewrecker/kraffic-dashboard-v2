import { useState } from 'react'
import { ArrowRight, Info } from 'lucide-react'
import Card from './Card'

// icon: lucide component; tone: { bg, fg } classes for the 32px chip (one tinted chip per card header).
// With onOpen the whole card is a link (click, Enter or Space) and `link` is its label.
// hint: how the number is worked out, behind an info button beside the label (hover or focus; not on link cards)
export default function KpiCard({ label, icon: Icon, tone, children, footer, link, onOpen, hint }) {
  const [tip, setTip] = useState(false)
  const interactive = Boolean(onOpen)
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault() // Space would scroll the page
    onOpen(e)
  }
  return (
    <Card
      {...(interactive && { role: 'link', tabIndex: 0, onClick: onOpen, onKeyDown, 'aria-label': `${label}: ${link}` })}
      className={`group flex h-full flex-col p-4 md:p-5 lg:min-h-[148px] ${
        interactive ? 'cursor-pointer outline-none transition-[border-color,box-shadow] duration-150 ease-out hover:border-[var(--color-line-strong)] hover:shadow-sm focus-visible:ring-2 focus-visible:ring-focus' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="relative flex items-center gap-1 pt-1.5 text-[12px] leading-4 font-medium text-stone-600 md:text-body">
          {label}
          {hint && !interactive && (
            <>
              <button type="button" aria-label={`How ${label.toLowerCase()} is worked out`} aria-describedby={tip ? 'kpi-hint' : undefined}
                onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)} onFocus={() => setTip(true)} onBlur={() => setTip(false)}
                className="grid h-5 w-5 place-items-center rounded-full text-stone-500 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
                <Info size={14} aria-hidden />
              </button>
              {tip && (
                <span id="kpi-hint" role="tooltip" className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-line bg-raised px-2.5 py-2 text-[12px] leading-4 font-normal text-stone-700 shadow-md">
                  {hint}
                </span>
              )}
            </>
          )}
        </div>
        {Icon && <span className={`hidden h-8 w-8 shrink-0 md:grid place-items-center rounded-lg ${tone.bg} ${tone.fg}`} aria-hidden><Icon size={16} /></span>}
      </div>
      <div className="mt-1">{children}</div>
      {interactive ? (
        <div className="mt-auto inline-flex min-h-6 items-center gap-1 pt-3 text-[12px] leading-4 md:pt-4 md:text-[13px] md:leading-[18px] font-medium text-stone-600 transition-colors duration-150 ease-out group-hover:text-ink group-focus-visible:text-ink">
          {link}
          <ArrowRight size={14} className="transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
        </div>
      ) : (
        footer && <div className="mt-auto pt-3 text-[12px] leading-4 font-normal text-stone-500 md:pt-4 md:text-small">{footer}</div>
      )}
    </Card>
  )
}
