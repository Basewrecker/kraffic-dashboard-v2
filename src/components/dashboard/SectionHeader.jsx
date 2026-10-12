export default function SectionHeader({ eyebrow, eyebrowClass = 'text-ink-3', title, count, subtitle, subtitleClass = 'text-xs', right }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {eyebrow && (
          <div className={`mb-1 text-micro uppercase ${eyebrowClass}`}>{eyebrow}</div>
        )}
        <h2 className="text-title font-semibold text-stone-900">
          {title}
          {count != null && <span className="ml-1 font-semibold text-stone-500">({count})</span>}
        </h2>
        {subtitle && <p className="mt-0.5 text-[13px] leading-[18px] font-normal text-stone-600">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  )
}
