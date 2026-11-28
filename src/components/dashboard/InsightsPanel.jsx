import { useEffect, useMemo, useRef } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, Lightbulb } from 'lucide-react'
import DrawerShell, { useDrawer } from '../audit/DrawerShell'
import { closeDrawer, openDrawer, useParams } from '../audit/parts'
import { triggerClass } from '../ui/MenuSelect'
import { PlatformIcon } from './icons'
import { chart } from '../../theme/chart'
import { scaled } from '../../app/lib/ui-scale'
import { useBrandView } from '../../hooks/useBrandView'
import { orderInsights, readSeen, useCardInsights, writeSeen } from './cardInsights'

// The Overview's Insights (as the app's Insights panel; this is the mock's own): a header button "Insights 6" (a
// lightbulb, first of the header controls) opens a right-hand pull-out, the shared drawer shell, listing each card's
// insight: the sentence the card shows in its footer, the card's name, a small ring with the card's number where it
// has one, and a link that closes the panel and scrolls to the card. Ones not opened before are marked "New" and
// come first. ?insights=open (pushed, so Back closes it).
const KEY = 'insights'

export function InsightsButton({ className = '' }) {
  const map = useCardInsights()
  const { focal } = useBrandView()
  const q = useParams()
  const n = Object.keys(map).length
  const fresh = useMemo(() => orderInsights(map, readSeen(focal.domain)).some((i) => i.isNew), [map, focal.domain, q.get(KEY)]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!n) return null
  return (
    <button type="button" data-insights-button onClick={() => openDrawer(KEY, 'open')} aria-haspopup="dialog" aria-label={`Insights: ${n}${fresh ? ', some new' : ''}`}
      className={`${triggerClass('sm')} relative gap-1.5 max-lg:h-10 max-lg:self-start max-lg:rounded-lg max-lg:text-[14px] ${className}`}>
      <Lightbulb size={14} className="shrink-0 text-stone-500" aria-hidden />
      Insights
      <span className="font-semibold text-stone-900 tabular-nums">{n}</span>
      {/* something not opened yet: a small ink dot on the corner */}
      {fresh && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-ink ring-2 ring-[var(--color-page)]" />}
    </button>
  )
}

// the card's number as a 36px ring (0–100); the change beside the name
function MetricRing({ value }) {
  const size = 36, stroke = 4, r = (size - stroke) / 2, c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: scaled(size), height: scaled(size) }} className="shrink-0 -rotate-90" role="img" aria-label={`${Math.round(value)}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={chart.track} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={chart.you} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} strokeLinecap="round" />
      <text x="50%" y="50%" transform={`rotate(90 ${size / 2} ${size / 2})`} textAnchor="middle" dominantBaseline="central" fontSize={11} className="fill-stone-900 font-semibold tabular-nums">{Math.round(value)}</text>
    </svg>
  )
}
function Change({ metric }) {
  if (metric?.change == null) return metric?.note ? <span className="text-[12px] leading-4 text-stone-500">{metric.note}</span> : null
  if (metric.change === 0) return <span className="text-[12px] leading-4 text-stone-500">No change</span>
  const up = metric.change > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[12px] leading-4 font-semibold tabular-nums ${up ? 'wc-change-up' : 'text-negative'}`}>
      {up ? <ArrowUp size={12} strokeWidth={2.25} aria-label="up" /> : <ArrowDown size={12} strokeWidth={2.25} aria-label="down" />}{Math.abs(metric.change)} {Math.abs(metric.change) === 1 ? 'pt' : 'pts'}
    </span>
  )
}

export default function InsightsPanel() {
  const map = useCardInsights()
  const { focal, isOwnBrand } = useBrandView()
  const drawer = useDrawer(KEY, (id) => (id === 'open' ? 'open' : null))
  // what was new when the panel opened stays marked until it closes; closing marks everything as seen
  const seen = useMemo(() => readSeen(focal.domain), [focal.domain, drawer.open]) // eslint-disable-line react-hooks/exhaustive-deps
  const list = orderInsights(map, seen)
  const latest = useRef(list)
  latest.current = list
  useEffect(() => {
    if (!drawer.open) return undefined
    return () => writeSeen(focal.domain, latest.current)
  }, [drawer.open, focal.domain])
  if (!drawer.item) return null

  const go = (anchor) => {
    closeDrawer(KEY)
    // after the panel has gone (its slide, and the address change), bring the card under the header
    setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 280)
  }
  const fresh = list.filter((i) => i.isNew).length
  return (
    <DrawerShell drawer={drawer} title="Insights"
      meta={<>{list.length} from this page’s cards{fresh > 0 && <> · {fresh} new</>}{!isOwnBrand && <> · {focal.name}’s view</>}</>}>
      {list.length === 0 ? (
        <p className="py-10 text-center text-[14px] leading-5 text-stone-600">No insights yet. They appear after the next sync.</p>
      ) : (
        <ul className="divide-y divide-[var(--div)]">
          {list.map((i) => (
            <li key={i.key} className="flex gap-4 py-5" data-insight-card={i.key}>
              <div className="flex w-9 shrink-0 justify-center pt-0.5">
                {i.metric?.value != null ? <MetricRing value={i.metric.value} />
                  : <span className="grid h-9 w-9 place-items-center rounded-full bg-tint text-stone-600" aria-hidden><Lightbulb size={16} /></span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="text-[13px] leading-[18px] font-medium text-stone-600">{i.name}</h3>
                  {i.engine && <span className="inline-flex items-center gap-1 text-[12px] leading-4 text-stone-500"><PlatformIcon id={i.engine.id} size={13} />{i.engine.name}</span>}
                  <Change metric={i.metric} />
                  {i.isNew && <span className="ml-auto inline-flex h-5 shrink-0 items-center rounded-full bg-ink px-2 text-[11px] leading-none font-semibold text-on-ink">New</span>}
                </div>
                <p className="mt-1 text-[15px] leading-[22px] font-medium text-stone-900 [text-wrap:pretty]">{i.text}</p>
                {i.detail && <p className="mt-1 text-[13px] leading-[18px] text-stone-600 tabular-nums [text-wrap:pretty]">{i.detail}</p>}
                <button type="button" onClick={() => go(i.anchor)}
                  className="group/go mt-2 inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
                  View {i.name} <ArrowRight size={13} className="transition-transform duration-150 ease-out group-hover/go:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DrawerShell>
  )
}
