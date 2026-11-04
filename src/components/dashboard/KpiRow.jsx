import { Eye, EyeOff, Gauge, Link } from 'lucide-react'
import KpiCard from './KpiCard'
import { chart } from '../../theme/chart'
import { useBrandView, useCountUp } from '../../hooks/useBrandView'
import { goToSection } from '../../utils/navigate'
import { openEngineDrawer } from '../answer/EngineDrawer'
import { aiModeSplit, engineName } from '../../data/brandViews'
import { changeParts } from '../../utils/syncChange'
import { NO_SCORE, fmtScore, isScore } from '../../utils/score'
import { NoResultHint } from '../ui/NoResult'

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
// value null (no result: an engine whose latest scan didn't answer): the empty track, "—" muted in the centre, no
// count-up; never a ring at 0
export function ScoreRing({ value, size = 64, stroke = 6 }) {
  const shown = useCountUp(value)
  const has = isScore(shown)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90" role="img" aria-label={has ? `Score ${fmtScore(shown)}` : 'No score'}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={chart.track} strokeWidth={stroke} />
      {has && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={chart.you} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} strokeLinecap="round"
        />
      )}
      <text x="50%" y="50%" transform={`rotate(90 ${size / 2} ${size / 2})`} textAnchor="middle" dominantBaseline="central"
        className={`proportional-nums text-[22px] font-semibold ${has ? 'fill-stone-900' : 'fill-stone-500'}`}>{has ? shown : NO_SCORE}</text>
    </svg>
  )
}

// a count that can be missing (null: no result) shows "—" muted, never 0
export const Num = ({ value }) => {
  const shown = useCountUp(value)
  return <div className={`proportional-nums text-[24px] leading-8 font-semibold tracking-[-0.03em] lg:text-kpi ${isScore(shown) ? 'text-stone-900' : 'text-stone-500'}`}>{fmtScore(shown)}</div>
}
const Count = ({ value }) => useCountUp(value)

export default function KpiRow() {
  const { kpis, isOwnBrand, engine, focal } = useBrandView()
  // "▲ 7 pts vs last sync · +10 prompts": the score shown minus the previous sync's, and that sync's gained − lost
  // (none when either score is missing: changeParts returns null)
  const change = changeParts(kpis.scoreDelta, kpis.netPrompts)
  const noResult = !isScore(kpis.score)
  // the latest sync is AI Mode's first (AI Overview and All engines only): "Scoring updated <day>" and its ⓘ in place
  // of the change line; from the next sync the change line comes back
  const split = aiModeSplit(engine)
  return (
      // phones / tablets: 2 × 2
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard label="Visibility score" icon={Gauge} tone={{ bg: 'bg-tint', fg: 'text-stone-600' }} hint={scoreHint(engine, isOwnBrand, focal.name)} footer={isScore(kpis.visible) && <><Count value={kpis.visible} />/{kpis.total} prompts visible</>}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ScoreRing value={kpis.score} />
            {/* no result from this engine's latest scan: the ⓘ says so, and there's no change line */}
            {noResult && <span className="inline-flex items-center gap-1 text-small text-stone-500">No result <NoResultHint engine={engine} /></span>}
            <span className="text-small font-semibold text-stone-600 tabular-nums">
              {/* no previous sync (null): nothing to compare, no delta line */}
              {split ? <span className="inline-flex items-center gap-1 font-medium text-stone-500" data-scoring-updated>{split.label} <NoResultHint engine={engine} text={split.tip} /></span>
                : !change ? null : !change.arrow ? <span className="text-stone-500">{change.text}</span> : <><span className={change.arrow === '▲' ? 'text-ink' : 'text-negative'}>{change.arrow}</span> {change.text}</>}
            </span>
          </div>
        </KpiCard>
        <KpiCard label="Visible prompts" icon={Eye} tone={{ bg: 'bg-tint', fg: 'text-stone-600' }} link="View prompts" onOpen={() => goToSection('visible-prompts')}>
          <Num value={kpis.visible} />
        </KpiCard>
        <KpiCard label="Missed prompts" icon={EyeOff} tone={{ bg: 'bg-tint', fg: 'text-stone-600' }} link="View opportunities" onOpen={() => goToSection('missed-prompts', isOwnBrand ? { sort: { key: 'appearingFor', dir: 'desc' } } : undefined)}>
          <Num value={kpis.missed} />
        </KpiCard>
        <KpiCard label="Cited sources" icon={Link} tone={{ bg: 'bg-tint', fg: 'text-stone-600' }} link="View top pages" onOpen={(e) => openEngineDrawer({ engine, tab: 'pages', opener: e?.currentTarget })}>
          <Num value={kpis.citedSources} />
        </KpiCard>
      </div>
  )
}
