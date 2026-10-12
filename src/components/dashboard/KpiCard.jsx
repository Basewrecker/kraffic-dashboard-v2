import { ArrowRight } from 'lucide-react'
import Card from './Card'

// icon: lucide component; tone: { bg, fg } classes for the 32px chip (one tinted chip per card header).
// With onOpen the whole card is a link (click, Enter or Space) and `link` is its label.
export default function KpiCard({ label, icon: Icon, tone, children, footer, link, onOpen }) {
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
        <div className="pt-1.5 text-[12px] leading-4 font-medium text-stone-600 md:text-body">{label}</div>
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
