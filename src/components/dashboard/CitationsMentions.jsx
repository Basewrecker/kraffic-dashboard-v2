import { ArrowRight, ChevronRight, History } from 'lucide-react'
import { HeaderIconButton } from './PageHeader'
import Card from './Card'
import Gauge from '../ui/Gauge'
import Insight, { hl, useExplain } from '../ui/Insight'
import { platformEvidence } from './insights'
import { useCardBrand } from './BrandSelect'
import { PlatformIcon } from './icons'
import { openEngineDrawer } from '../answer/EngineDrawer'
import { openCitationsDrawer } from '../answer/CitationsDrawer'
import { ENGINES, OWN, brandByDomain, getBrandView } from '../../data/brandViews'
import { weekRows } from '../../data/citationHistory'
import { citationsMentions, trackedPrompts } from '../../data/mock'
import { useBrandView, useCountUp } from '../../hooks/useBrandView'
import { platformRates } from '../../utils/platformInsight'
import { useTracking } from '../../store/trackingSettings'

// "Citations and Mentions": three headline stats (AI visibility gauge, mentions, citations), the per-engine
// breakdown under them in the same three columns, and a brand toggle that's local to this card.
// Rows come from citationsMentions (mock); every total is summed from them.
const COLS = 'grid grid-cols-[1.2fr_1fr_1fr] gap-3 md:gap-6'
const TOTAL = trackedPrompts.length

// every number opens the Engine drawer: a quiet button (tint on hover, a chevron fades in); 0 is plain text
const cell = 'group -mx-2 inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-left outline-none transition-colors duration-150 ease-out hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ink)_20%,transparent)]'
const Chevron = () => <ChevronRight size={14} className="shrink-0 -translate-x-0.5 text-stone-500 opacity-0 transition duration-150 ease-out group-hover:translate-x-0 group-hover:opacity-100 touch:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100" aria-hidden />
function Clickable({ value, label, onOpen, children }) {
  if (!value) return <span className="text-stone-500">{children}</span>
  return <button type="button" onClick={onOpen} aria-label={label} className={cell}>{children}<Chevron /></button>
}

const Stat = ({ label, children, gap = 'mt-1', foot = null }) => (
  <div className="min-w-0">
    <div className="text-[13px] leading-[18px] font-medium text-stone-600">{label}</div>
    <div className={`${gap} flex items-end gap-3`}>{children}</div>
    {foot}
  </div>
)

// "+22 vs last week" under a big number: the card's main way into week by week (opens the drawer on that metric).
// t3; on hover or focus it underlines, turns ink and a small → slides in (outside the text box, so it takes no width
// and the two lines never collide on a phone). A drop’s number
// keeps the negative token.
function VsLastWeek({ d, label, onOpen }) {
  if (d == null) return null
  return (
    <button type="button" onClick={onOpen} aria-label={`${label}: ${d === 0 ? 'no change' : d > 0 ? `up ${d}` : `down ${Math.abs(d)}`} vs last week. Open week by week`}
      className="group/vs relative -mx-1 mt-0.5 inline-flex cursor-pointer items-center whitespace-nowrap rounded px-1 text-left text-[12px] leading-4 text-stone-500 tabular-nums outline-none transition-colors duration-150 hover:text-ink focus-visible:text-ink focus-visible:ring-2 focus-visible:ring-focus">
      <span className="decoration-1 underline-offset-2 group-hover/vs:underline group-focus-visible/vs:underline">
        {d === 0 ? 'No change' : <span className={d < 0 ? 'text-negative' : ''}>{d > 0 ? `+${d}` : `−${Math.abs(d)}`}</span>} vs last week
      </span>
      <ArrowRight size={12} aria-hidden
        className="pointer-events-none absolute left-full top-1/2 -translate-x-1 -translate-y-1/2 text-ink opacity-0 transition duration-150 ease-out group-hover/vs:translate-x-0 group-hover/vs:opacity-100 group-focus-visible/vs:translate-x-0 group-focus-visible/vs:opacity-100 motion-reduce:transition-none" />
    </button>
  )
}
const Big = ({ value }) => <span className="text-[24px] leading-8 font-semibold tabular-nums md:text-[32px]">{useCountUp(value)}</span>
const Num = ({ value }) => <span className="text-[14px] leading-5 font-medium tabular-nums">{useCountUp(value)}</span>

// "Claude and Grok" / "Claude, Grok and Perplexity"
const listOf = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`)

export default function CitationsMentions() {
  const page = useBrandView()
  const tracking = useTracking()
  // local brand toggle: starts on (and follows) the page's "Viewing as"
  const [domain, brandSelect] = useCardBrand()
  const brand = brandByDomain(domain)
  const view = getBrandView(domain)
  const data = citationsMentions[domain] ?? {}

  const enabled = tracking.platforms.filter((p) => p.enabled).map((p) => p.id)
  const all = ENGINES.filter((e) => enabled.includes(e.id)).map((e) => {
    // mentions null: not known (no stored answer text to read a name from); never filled in from citations
    const [m, c] = data[e.id] ?? []
    return { ...e, mentions: m === null ? null : m ?? 0, citations: c ?? 0 }
  })
  const rows = all.filter((r) => (r.mentions ?? 0) > 0 || r.citations > 0)
  const silent = all.filter((r) => r.mentions === 0 && r.citations === 0).map((r) => r.name)
  // "Claude and Grok don't mention you yet" (in the subtitle)
  const silentLine = silent.length && rows.length ? `${listOf(silent)} ${silent.length === 1 ? 'doesn’t' : 'don’t'} mention ${domain === OWN.domain ? 'you' : brand?.name} yet` : null
  const mentionsUnknown = rows.some((r) => r.mentions == null)
  const mentions = mentionsUnknown ? null : rows.reduce((n, r) => n + r.mentions, 0)
  const NOT_TRACKED = 'Not tracked: no stored answer text to read mentions from'
  const dash = <span className="text-stone-500" title={NOT_TRACKED}>—</span>
  const citations = rows.reduce((n, r) => n + r.citations, 0)
  const score = view.kpis.score
  // drawer for this card's brand (not necessarily the page's "Viewing as")
  const open = (engine, tab, e) => openEngineDrawer({ engine, tab, brand: domain, opener: e.currentTarget })
  const shownScore = useCountUp(score)
  // this week vs last (all of the brand's engines, as the numbers above): the drawer has the weeks before
  const [thisWeek] = weekRows(domain, 'all', enabled, 2)
  const week = (metric, e) => openCitationsDrawer({ metric, brand: domain, opener: e.currentTarget })

  // insight: about the engine that cites the brand most (else mentions it most), compared with the others
  const insightRows = rows.map((r) => {
    const p = { id: r.id, name: r.name, visible: r.mentions, cited: r.citations, total: TOTAL }
    return { ...p, ...platformRates(p) }
  })
  const lead = [...insightRows].sort((a, b) => b.cited - a.cited || b.visible - a.visible)[0]
  const explain = useExplain(`${domain}|${lead?.id}`)
  // no line built on mentions that aren't known
  const insight = lead && !mentionsUnknown && platformEvidence(lead, insightRows, { view, tracking, setEngine: page.setEngine })
  // its "View prompts" acts on the page's tables, which only make sense for the brand the page is showing
  if (insight && domain !== page.focal.domain) delete insight.evidence.action


  return (
    <Card ref={explain.cardRef} id="platforms" className="flex h-full min-w-0 scroll-mt-6 flex-col px-5 pt-5">
      {/* title + subtitle take the rest of the row and wrap (never truncate); the controls keep their width, centred
          on the title line (32px controls on a 24px line: -mt-1) */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] leading-6 font-semibold text-stone-900">Citations and Mentions</h2>
          <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600 tabular-nums [text-wrap:pretty]">
            {TOTAL} prompts{silentLine && ` · ${silentLine}`}
          </p>
        </div>
        <div className="-mt-1 flex shrink-0 items-center gap-2">
          <HeaderIconButton label="Week by week" icon={History} onClick={(e) => week('mentions', e)} />
          {brandSelect}
        </div>
      </div>

      {/* headline stats */}
      <div className={`${COLS} mt-4`} aria-live="polite">
        {/* 8px clear above the arc; the number sits level with the arc's bottom */}
        <Stat label="AI Visibility" gap="mt-2">
          <Gauge value={shownScore} />
          <span className="text-[24px] leading-none font-semibold text-stone-900 tabular-nums md:text-[32px]">{Math.round(shownScore)}</span>
        </Stat>
        <Stat label="Mentions" foot={mentions != null && <VsLastWeek d={thisWeek?.delta.mentions} label="Mentions" onOpen={(e) => week('mentions', e)} />}>
          {mentions == null ? <span className="text-[24px] leading-none font-semibold md:text-[32px]">{dash}</span> : (
          <Clickable value={mentions} label={`View all ${mentions} ${brand?.name} mentions`} onOpen={(e) => open('all', 'mentions', e)}>
            <span className="text-stone-900"><Big value={mentions} /></span>
          </Clickable>
          )}
        </Stat>
        <Stat label="Citations" foot={<VsLastWeek d={thisWeek?.delta.citations} label="Citations" onOpen={(e) => week('citations', e)} />}>
          <Clickable value={citations} label={`View all ${citations} ${brand?.name} citations`} onOpen={(e) => open('all', 'pages', e)}>
            <span className="text-stone-900"><Big value={citations} /></span>
          </Clickable>
        </Stat>
      </div>

      {/* per engine, in the same columns */}
      <div className="mb-4 mt-4">
        {rows.length === 0 ? (
          <p className="py-6 text-[14px] leading-5 text-stone-600">No engine mentions {brand?.name} yet</p>
        ) : (
          <>
          {/* phones: one list row per engine, the whole row opens the engine sheet */}
          <ul aria-label={`${brand?.name} by engine`} className="-mx-1 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="border-b border-[var(--div)] last:border-0">
                <button type="button" onClick={(e) => open(r.id, 'mentions', e)} aria-label={`${r.name}: ${r.mentions ?? 'unknown'} mentions, ${r.citations} citations`}
                  className="flex h-12 w-full items-center gap-2.5 px-1 text-left outline-none active:bg-tint focus-visible:ring-2 focus-visible:ring-focus">
                  <PlatformIcon id={r.id} size={18} />
                  <span className="min-w-0 flex-1 truncate text-[14px] leading-5 font-medium text-stone-900">{r.name}</span>
                  <span className="shrink-0 text-[13px] leading-[18px] text-stone-600 tabular-nums">{r.mentions ?? '—'} mentions · {r.citations} citations</span>
                  <ChevronRight size={14} className="shrink-0 text-stone-500" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <ul aria-label={`${brand?.name} by engine`} className="hidden md:block">
            {rows.map((r) => (
              <li key={r.id} {...hl(explain, `engine:${r.id}`, { row: true, flush: true })} className={`${COLS} h-8 items-center`}>
                <span className="min-w-0">
                  <button type="button" onClick={(e) => open(r.id, 'mentions', e)} aria-label={`View ${r.mentions} ${r.name} mentions`} className={`${cell} text-[14px] leading-5 font-medium text-stone-900`}>
                    <PlatformIcon id={r.id} size={18} /><span className="ml-1.5 truncate">{r.name}</span><Chevron />
                  </button>
                </span>
                <span className="text-stone-900">
                  {r.mentions == null ? dash : <Clickable value={r.mentions} label={`View ${r.mentions} ${r.name} mentions`} onOpen={(e) => open(r.id, 'mentions', e)}><Num value={r.mentions} /></Clickable>}
                </span>
                <span className="text-stone-900">
                  <Clickable value={r.citations} label={`View ${r.citations} ${r.name} citations`} onOpen={(e) => open(r.id, 'pages', e)}><Num value={r.citations} /></Clickable>
                </span>
              </li>
            ))}
          </ul>
          </>
        )}
      </div>

      {/* footer: at least 16px under the body, pinned to the bottom when the row is taller */}
      {insight && <div className="mt-auto pb-3"><Insight explain={explain} {...insight} /></div>}
    </Card>
  )
}
