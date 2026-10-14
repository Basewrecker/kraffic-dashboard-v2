import { useEffect, useRef, useState } from 'react'
import { Cell, Pie as RPie, PieChart } from 'recharts'
import { ArrowRight, Globe, LayoutGrid, MessagesSquare, RefreshCw, Star, Store } from 'lucide-react'
import Card from './Card'
import Insight, { hl, hlOpacity, useExplain } from '../ui/Insight'
import { marketplaceEvidence } from './insights'
import { useTracking } from '../../store/trackingSettings'
import { marketplace } from '../../data/mock'
import SiteLogo from '../ui/SiteLogo'
import { brandName, isDomain } from '../../utils/brand'
import { OWN } from '../../data/brandViews'
import { useBrandView } from '../../hooks/useBrandView'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const pct = (n, d) => Math.round((n / d) * 100)
// the marketplaces in the subtitle: "A", "A or B", "A, B or C", "A, B and 2 more"
const storeList = (names) => (names.length > 3 ? `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
  : names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names.at(-1)}` : names[0] ?? 'a marketplace')
// the 20px box every non-brand row gets, so all names start at the same x
const GLYPH = { category: LayoutGrid, web: Globe, reviews: Star, forums: MessagesSquare }
// by count, high → low; Category pages always last
const sortRows = (rows) => [...rows].sort((a, b) => (a.icon === 'category') - (b.icon === 'category') || b.value - a.value)
const HOVER_DELAY = 80 // ms; sweeping across slices doesn't flicker through each one

// Opens the Marketplace prompts card (optionally pre-filtered) and scrolls to it.
export function showMarketplacePrompts(filter = 'all') {
  window.dispatchEvent(new CustomEvent('marketplace-prompts:show', { detail: { filter } }))
}

// competitor view: marketplace links are only checked for the signed-in brand
function MarketplaceEmpty({ onBack }) {
  return (
    <Card className="flex h-full min-w-0 flex-col p-5">
      <h2 className="text-title font-semibold text-stone-900">Marketplace visibility</h2>
      <p className="mt-0.5 text-[13px] leading-[18px] font-normal text-stone-600">Which store pages AI answers link to</p>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-tint text-stone-500"><Store size={18} aria-hidden /></span>
        <p className="text-[14px] leading-5 text-stone-600">Marketplace data is only tracked for {OWN.name}</p>
        <button type="button" onClick={onBack} className="rounded text-[13px] leading-[18px] font-medium text-ink underline underline-offset-4 outline-none hover:opacity-75 focus-visible:ring-2 focus-visible:ring-focus">
          Back to {OWN.name}
        </button>
      </div>
    </Card>
  )
}

export default function MarketplaceVisibility() {
  const { isOwnBrand, setView } = useBrandView()
  return isOwnBrand ? <MarketplaceCard /> : <MarketplaceEmpty onBack={() => setView(OWN.domain)} />
}

function MarketplaceCard() {
  const tracking = useTracking()
  const m = marketplace
  const segs = m.segments
  const [selectedKey, setSelectedKey] = useState('yours')
  const [hoverKey, setHoverKey] = useState(null)
  const activeKey = hoverKey ?? selectedKey
  const active = segs.find((s) => s.key === activeKey)
  const hoverTimer = useRef(null)
  const [checking, setChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState(m.lastChecked)
  // animate the ring once on mount; afterwards every render (hover, select) passes false, so Recharts never replays it
  const animateRef = useRef(!reducedMotion())
  useEffect(() => {
    const t = setTimeout(() => { animateRef.current = false }, 750)
    return () => { clearTimeout(t); clearTimeout(hoverTimer.current) }
  }, [])

  // enter and leave both go through the same timer: a leave → enter sweep lands on the new key without a detour
  // explain mode freezes the selection: hovering doesn't preview another segment
  const explain = useExplain(selectedKey)
  const preview = (key) => {
    if (explain.on) return
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setHoverKey(key), HOVER_DELAY)
  }
  const select = (key) => {
    clearTimeout(hoverTimer.current)
    setSelectedKey(key)
    setHoverKey(null)
  }
  // the donut is the selector: ←/→ cycle segments while it has focus
  const onDonutKey = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const i = segs.findIndex((s) => s.key === selectedKey)
    select(segs[(i + step + segs.length) % segs.length].key)
  }

  // mock re-check: spin for a moment, then stamp the time
  const recheck = () => {
    if (checking) return
    setChecking(true)
    setTimeout(() => {
      setChecking(false)
      setLastChecked(new Date().toTimeString().slice(0, 5))
    }, 1200)
  }

  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-title font-semibold text-stone-900">Marketplace visibility</h2>
          <p className="mt-0.5 text-[13px] leading-[18px] font-normal text-stone-600 proportional-nums">How {m.total} tracked prompts link to {storeList(m.stores)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => showMarketplacePrompts(active.action.filter)}
            title={active.action.label}
            className="inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
          >
            View prompts <ArrowRight size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={recheck}
            aria-label={`Re-check · last checked ${lastChecked}`}
            title={`Re-check · last checked ${lastChecked}`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-[var(--tint)] hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
          >
            <RefreshCw size={16} className={checking ? 'animate-[spin_600ms_linear_infinite] motion-reduce:animate-none' : undefined} aria-hidden />
          </button>
        </div>
      </div>

      {/* donut (the selector) + panel, centred in whatever height the row gives the card */}
      <div className="mb-4 mt-4 flex flex-wrap items-center gap-8 sm:flex-nowrap">
        <div
          role="group"
          tabIndex={0}
          aria-label={`Marketplace segments: ${segs.find((s) => s.key === selectedKey).label} selected. Use the arrow keys to change.`}
          onKeyDown={onDonutKey}
          onMouseLeave={() => preview(null)}
          className="relative h-[128px] w-[128px] shrink-0 rounded-full max-sm:mx-auto outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4"
        >
          <PieChart width={128} height={128} className="cursor-pointer">
            <RPie
              data={segs}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={64}
              paddingAngle={0}
              cornerRadius={3}
              startAngle={90}
              endAngle={-270}
              stroke="var(--color-surface)" // card background: crisp gaps in both themes
              strokeWidth={2}
              rootTabIndex={-1}
              isAnimationActive={animateRef.current}
              animationDuration={700}
              animationEasing="ease-out"
            >
              {segs.map((s) => (
                <Cell
                  key={s.key}
                  fill={s.color}
                  fillOpacity={hlOpacity(explain, `seg:${s.key}`) ?? ((active.highlight ?? [activeKey]).includes(s.key) ? 1 : 0.5)}
                  data-insight-key={`seg:${s.key}`}
                  aria-label={`${s.label}: ${s.count} prompts`}
                  aria-describedby={hlOpacity(explain, `seg:${s.key}`) === 1 ? explain.lineId : undefined}
                  style={{ outline: 'none', cursor: 'pointer', transition: 'fill-opacity 200ms ease-out' }}
                  onMouseEnter={() => preview(s.key)}
                  onClick={() => select(s.key)}
                />
              ))}
            </RPie>
          </PieChart>
          {/* center: active segment's share; all three are stacked so the number crossfades */}
          <div className="pointer-events-none absolute inset-0 grid place-content-center justify-items-center text-center">
            <div className="grid">
              {segs.map((s) => (
                <span
                  key={s.key}
                  aria-hidden={activeKey !== s.key}
                  className={`[grid-area:1/1] text-[24px] leading-7 font-semibold text-ink proportional-nums transition-opacity duration-150 ease-out ${activeKey === s.key ? 'opacity-100' : 'opacity-0'}`}
                >
                  {pct(s.panelCount ?? s.count, m.total)}%
                </span>
              ))}
            </div>
            <div className="text-[12px] leading-4 text-stone-600 proportional-nums">of {m.total} prompts</div>
          </div>
        </div>

        {/* all panels share one grid cell, so the card is always as tall as the tallest panel */}
        <div className="grid min-w-[200px] flex-1 max-sm:w-full" aria-live="polite">
          {segs.map((s) => {
            const on = activeKey === s.key
            return (
              <div
                key={s.key}
                aria-hidden={!on}
                inert={on ? undefined : ''}
                className={`[grid-area:1/1] min-w-0 transition duration-200 ease-out motion-reduce:transition-none ${on ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'}`}
              >
                {/* headline: the number and what it counts, on one baseline */}
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="text-[28px] leading-none font-semibold text-ink tabular-nums">{s.panelCount ?? s.count}</span>
                  <span className="truncate text-[13px] leading-[18px] text-stone-600">{s.headline}</span>
                </div>
                {/* plain rows: logo · name ……… count. Dermasuri is marked only by its weight */}
                <ul className="mt-3 w-full">
                  {sortRows(s.rows).map((r) => {
                    const domain = isDomain(r.label)
                    const own = domain && r.label === OWN.domain
                    const Glyph = GLYPH[r.icon]
                    return (
                      <li
                        key={r.label}
                        {...hl(explain, `row:${r.label}`, { row: true })}
                        // full domain for brands; marketplace rows explain the overlap ("2 prompts link to both")
                        title={domain ? r.label : r.domain ? s.note : undefined}
                        className="flex h-9 items-center justify-between gap-3 text-[14px] leading-5"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          {domain ? <SiteLogo domain={r.label} name={brandName(r.label)} className="h-5 w-5 rounded-md" imgPad="p-0.5" initialClass="text-[10px]" plate />
                            : r.domain ? <SiteLogo domain={r.domain} name={r.label} className="h-5 w-5 rounded-md" imgPad="p-0.5" initialClass="text-[10px]" plate />
                              : Glyph ? <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-line text-stone-600" aria-hidden><Glyph size={14} /></span>
                                : <SiteLogo name={r.label} className="h-5 w-5 rounded-md" initialClass="text-[10px]" />}
                          <span className={`truncate ${own ? 'font-semibold text-ink' : 'text-stone-900'}`}>{domain ? brandName(r.label) : r.label}</span>
                        </span>
                        <span className={`font-semibold tabular-nums ${own ? 'text-ink' : 'text-stone-900'}`}>{r.value}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {/* insight for the active segment, with its evidence */}
      {/* footer: pinned to the bottom (aligns with the card beside it); the card has no bottom padding */}
      <div className="mt-auto pb-3"><Insight explain={explain} {...marketplaceEvidence(active, { tracking })} /></div>
    </Card>
  )
}
