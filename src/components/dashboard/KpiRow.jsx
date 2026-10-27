import { Eye, EyeOff, Gauge, Link } from 'lucide-react'
import KpiCard from './KpiCard'
import { chart } from '../../theme/chart'
import { useBrandView, useCountUp } from '../../hooks/useBrandView'
import { goToSection } from '../../utils/navigate'
import { openEngineDrawer } from '../answer/EngineDrawer'
import { engineName } from '../../data/brandViews'

// how the visibility score is worked out, for the engine filter (the previous dashboard's definitions, kept as they were)
export function scoreHint(engine, isOwnBrand, name) {
  if (engine === 'all') {
    return isOwnBrand
      ? 'All engines: Google AI Overview’s score on the days it ran (on other days, the best engine’s), and never below the best day on record.'
      : `All engines: ${name}’s share on the latest day, averaged across the engines that ran that day.`
  }
  return isOwnBrand
    ? `${engineName(engine)}: the prompts whose answer shows your site, out of every tracked prompt.`
    : `${engineName(engine)}: the prompts whose answer mentions ${name} before your other competitors, out of every tracked prompt.`
}

// exported: Site Audit's KPI strip uses the same ring and value type
export function ScoreRing({ value, size = 64, stroke = 6 }) {
  const shown = useCountUp(value)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={chart.track} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={chart.you} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} strokeLinecap="round"
      />
      <text x="50%" y="50%" transform={`rotate(90 ${size / 2} ${size / 2})`} textAnchor="middle" dominantBaseline="central"
        className="proportional-nums fill-stone-900 text-[22px] font-semibold">{shown}</text>
    </svg>
  )
}

export const Num = ({ value }) => <div className="proportional-nums text-[24px] leading-8 font-semibold tracking-[-0.03em] text-stone-900 lg:text-kpi">{useCountUp(value)}</div>
const Count = ({ value }) => useCountUp(value)

export default function KpiRow() {
  const { kpis, isOwnBrand, engine, focal } = useBrandView()
  const d = kpis.scoreDelta
  return (
      // phones / tablets: 2 × 2
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard label="Visibility score" icon={Gauge} tone={{ bg: 'bg-tint', fg: 'text-stone-600' }} hint={scoreHint(engine, isOwnBrand, focal.name)} footer={<><Count value={kpis.visible} />/{kpis.total} prompts visible</>}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ScoreRing value={kpis.score} />
            <span className="text-small font-semibold text-stone-600 tabular-nums">
              {/* no previous sync (null): nothing to compare, no delta line */}
              {d == null ? null : d === 0 ? <span className="text-stone-500">No change vs last sync</span> : <><span className={d > 0 ? 'text-ink' : 'text-negative'}>{d > 0 ? '▲' : '▼'}</span> {Math.abs(d)} vs last sync</>}
            </span>
          </div>
        </KpiCard>
        <KpiCard label="Visible prompts" icon={Eye} tone={{ bg: 'bg-tint', fg: 'text-stone-600' }} link="View prompts" onOpen={() => goToSection('visible-prompts')}>
          <Num value={kpis.visible} />
        </KpiCard>
        <KpiCard label="Missed prompts" icon={EyeOff} tone={{ bg: 'bg-tint', fg: 'text-stone-600' }} link="View opportunities" onOpen={() => goToSection('missed-prompts', isOwnBrand ? { sort: { key: 'appearingFor', dir: 'desc' } } : undefined)}>
          <Num value={kpis.missed} />
        </KpiCard>
        <KpiCard label="Citations" icon={Link} tone={{ bg: 'bg-tint', fg: 'text-stone-600' }} link="View top pages" onOpen={(e) => openEngineDrawer({ engine, tab: 'pages', opener: e?.currentTarget })}>
          <Num value={kpis.citedSources} />
        </KpiCard>
      </div>
  )
}
