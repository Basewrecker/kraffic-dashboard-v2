import KpiCard from '../dashboard/KpiCard'

// The Visibility Overview KPI strip, for tool pages: label · value · meta · "View …" (whole tile clickable when it
// has onOpen). items: [{ label, icon?, value, unit?, meta (node), link?, onOpen? }]. 2 × 2 on phones, 4 across on desktop.
const tone = { bg: 'bg-tint', fg: 'text-stone-600' }
export default function KpiStrip({ items }) {
  return (
    <div className={`grid grid-cols-2 gap-3 md:gap-4 ${items.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
      {items.map((k) => (
        <KpiCard key={k.label} label={k.label} icon={k.icon} tone={tone} link={k.link} onOpen={k.onOpen}
          footer={!k.onOpen && k.meta ? k.meta : null}>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[24px] leading-8 font-semibold tracking-[-0.03em] text-stone-900 tabular-nums lg:text-kpi">{k.value}</span>
            {k.unit && <span className="text-[14px] leading-5 text-stone-500 tabular-nums">{k.unit}</span>}
          </div>
          {k.onOpen && k.meta && <div className="mt-1 text-[13px] leading-[18px] text-stone-600 tabular-nums">{k.meta}</div>}
        </KpiCard>
      ))}
    </div>
  )
}
