import { ArrowDown, ArrowUp, Eye, EyeOff, Gauge, Link } from 'lucide-react'
import KpiCard from './KpiCard'
import { chart } from '../../theme/chart'
import { useBrandView, useCountUp } from '../../hooks/useBrandView'
import { goToSection } from '../../utils/navigate'
import { openEngineDrawer } from '../answer/EngineDrawer'
import { ENGINES, aiModeSplit, engineName } from '../../data/brandViews'
import { enginesNotRun } from '../../data/citationHistory'
import { citationsMentions } from '../../data/mock'
import { useTracking } from '../../store/trackingSettings'
import { scaled } from '../../app/lib/ui-scale'
import { changeParts } from '../../utils/syncChange'
import { NO_SCORE, fmtScore, isScore, noResultText } from '../../utils/score'

const listOf = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`)

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
// drawn in a viewBox (as the app, 2026-11-09), so the box follows the UI scale and the number scales with the ring
export function ScoreRing({ value, size = 64, stroke = 6 }) {
  const shown = useCountUp(value)
  const has = isScore(shown)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: scaled(size), height: scaled(size) }} className="shrink-0 -rotate-90" role="img" aria-label={has ? `Score ${fmtScore(shown)}` : 'No score'}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={chart.track} strokeWidth={stroke} />
      {has && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={chart.you} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} strokeLinecap="round"
        />
      )}
      <text x="50%" y="50%" transform={`rotate(90 ${size / 2} ${size / 2})`} textAnchor="middle" dominantBaseline="central"
        fontSize={size <= 52 ? 18 : 22} className={`proportional-nums font-semibold ${has ? 'fill-stone-900' : 'fill-stone-500'}`}>{has ? shown : NO_SCORE}</text>
    </svg>
  )
}

// a count that can be missing (null: no result) shows "—" muted, never 0
export const Num = ({ value }) => {
  const shown = useCountUp(value)
  return <div className={`proportional-nums text-[24px] leading-8 font-semibold tracking-[-0.03em] lg:text-kpi lg:leading-10 ${isScore(shown) ? 'text-stone-900' : 'text-stone-500'}`}>{fmtScore(shown)}</div>
}
const Count = ({ value }) => useCountUp(value)

// "↓ 4 pts vs last sync": the arrow and the points in the change's colour (a rise green, a drop red), semibold; the
// rest muted. The prompts gained or lost are in Sync history's row, not here (as the app, #216).
export function ScoreChange({ points }) {
  const change = changeParts(points, null, { suffix: '' })
  if (!change) return null
  if (!change.arrow) return <span className="text-stone-500">No change vs last sync</span>
  const up = change.arrow === '▲'
  return (
    <span>
      <span className={`whitespace-nowrap font-semibold ${up ? 'wc-change-up' : 'text-negative'}`}>
        {up ? <ArrowUp size={13} strokeWidth={2.25} className="mr-0.5 inline align-[-2px]" aria-label="Up" /> : <ArrowDown size={13} strokeWidth={2.25} className="mr-0.5 inline align-[-2px]" aria-label="Down" />}
        {change.text}
      </span>
      <span className="whitespace-nowrap font-normal text-stone-500"> vs last sync</span>
    </span>
  )
}

export default function KpiRow() {
  const { kpis, isOwnBrand, engine, focal } = useBrandView()
  const tracking = useTracking()
  const noResult = !isScore(kpis.score)
  // the latest sync is AI Mode's first (AI Overview and All engines only): "Scoring updated <day>" is a note in the ⓘ
  // and there's no change line (the sync before was counted another way); from the next sync the change comes back
  const split = aiModeSplit(engine)
  // the notes that apply to the score right now, all in the ⓘ beside "Visibility score" (a dot on the ⓘ says there is
  // one): the scoring change, engines that didn't run this week, an engine with no result
  const enabled = tracking.platforms.filter((p) => p.enabled).map((p) => p.id)
  const notRun = engine === 'all' ? ENGINES.filter((e) => enginesNotRun(enabled).includes(e.id)).map((e) => e.name) : []
  const notes = [
    split && `${split.label}. ${split.tip}`,
    notRun.length > 0 && `${listOf(notRun)} didn’t run this week: the score covers the same engines only, in this sync and the last.`,
    noResult && noResultText(engine),
  ].filter(Boolean)
  // the citations the brand got (answer × engine, the number Citations and Mentions shows); none on record: "—"
  const cited = engine === 'all' ? ENGINES.filter((e) => enabled.includes(e.id)).reduce((n, e) => n + (citationsMentions[focal.domain]?.[e.id]?.[1] ?? 0), 0) : citationsMentions[focal.domain]?.[engine]?.[1] ?? null
  return (
      // phones / tablets: 2 × 2. Four compact cards of one height (as the app, #216 / #223)
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard compact tour="overview-score" label="Visibility score" icon={Gauge} tone={{ bg: 'bg-tint', fg: 'text-stone-600' }} hint={scoreHint(engine, isOwnBrand, focal.name)} notes={notes}
          footer={isScore(kpis.visible) ? <span className="tabular-nums"><Count value={kpis.visible} />/{kpis.total} prompts visible</span> : <span>{NO_SCORE}</span>}>
          {/* a 52px ring, the change to its right; the notes are in the ⓘ */}
          <div className="flex min-h-[52px] items-center gap-3">
            <ScoreRing value={kpis.score} size={52} stroke={5} />
            <span className="min-w-0 text-[12px] leading-4 tabular-nums md:text-[13px] md:leading-[18px]" data-score-change>
              {noResult ? <span className="text-stone-500">No result</span> : split ? null : <ScoreChange points={kpis.scoreDelta} />}
            </span>
          </div>
        </KpiCard>
        <KpiCard compact tour="overview-prompts" label="Visible prompts" icon={Eye} tone={{ bg: 'bg-tint', fg: 'text-stone-600' }} link="View prompts" onOpen={() => goToSection('visible-prompts')}>
          <Num value={kpis.visible} />
        </KpiCard>
        <KpiCard compact tour="overview-prompts" label="Missed prompts" icon={EyeOff} tone={{ bg: 'bg-tint', fg: 'text-stone-600' }} link="View opportunities" onOpen={() => goToSection('missed-prompts', isOwnBrand ? { sort: { key: 'appearingFor', dir: 'desc' } } : undefined)}>
          <Num value={kpis.missed} />
        </KpiCard>
        <KpiCard compact label="Citations" icon={Link} tone={{ bg: 'bg-tint', fg: 'text-stone-600' }} link="View top pages" onOpen={(e) => openEngineDrawer({ engine, tab: 'pages', opener: e?.currentTarget })}>
          <Num value={noResult ? null : cited} />
        </KpiCard>
      </div>
  )
}
