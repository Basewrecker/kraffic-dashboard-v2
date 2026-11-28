import { useEffect, useRef, useState } from 'react'
import { Cell, Pie as RPie, PieChart } from 'recharts'
import { Globe, History, LayoutGrid, MessageSquareText, MessagesSquare, RefreshCw, Star, Store } from 'lucide-react'
import { HeaderIconButton } from './PageHeader'
import Card from './Card'
import Insight, { hl, hlOpacity, useExplain } from '../ui/Insight'
import { marketplaceEvidence } from './insights'
import { useTracking } from '../../store/trackingSettings'
import { marketplace } from '../../data/mock'
import { VsLastWeek } from './CitationsMentions'
import { openMarketplaceDrawer } from '../answer/MarketplaceDrawer'
import { marketMock, marketRows } from '../../data/marketplaceHistory'
import { ArrowRight } from 'lucide-react'
import { ENGINE_ORDER, TRACKED_BRANDS } from '../../data/brandViews'
import { PlatformIcon } from './icons'
import SiteLogo from '../ui/SiteLogo'
import { brandName, isDomain } from '../../utils/brand'
import { OWN } from '../../data/brandViews'
import { useBrandView, useDashboardView } from '../../hooks/useBrandView'

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

// What AI cites besides stores (as the app, #223), from the marketplace prompts' cited pages:
//   threads: the forum threads (Reddit, Quora) cited most, each { key, domain, name, path, prompts, engines }
//   sites:   with no thread, the sites cited in place of a store, most prompts first; a tracked competitor's is marked
// ?threads=none (mock only) previews the second list.
const THREAD_HOSTS = ['reddit.com', 'quora.com']
const NO_THREADS = (() => { try { return new URLSearchParams(window.location.search).get('threads') === 'none' } catch { return false } })()
export function citedInstead(prompts, { noThreads = NO_THREADS, max = 3 } = {}) {
  const group = (rows, keyOf, make) => {
    const m = new Map()
    rows.forEach((r) => {
      const k = keyOf(r)
      const g = m.get(k) ?? { ...make(r), key: k, prompts: 0, engines: new Set() }
      g.prompts += 1
      ;(r.engines ?? []).forEach((e) => g.engines.add(e))
      m.set(k, g)
    })
    return [...m.values()].map((g) => ({ ...g, engines: ENGINE_ORDER.filter((e) => g.engines.has(e)) })).sort((a, b) => b.prompts - a.prompts || a.key.localeCompare(b.key))
  }
  const off = (prompts ?? []).filter((r) => r.result === 'none' && r.page)
  const threads = noThreads ? [] : group(off.filter((r) => THREAD_HOSTS.includes(r.page.domain)), (r) => `${r.page.domain}${r.page.path}`, (r) => {
    // "/r/SkincareAddiction/comments/retinol-night-cream" → "r/SkincareAddiction · retinol night cream"
    const parts = r.page.path.split('/').filter(Boolean)
    const sub = parts[0] === 'r' && parts[1] ? `r/${parts[1]}` : r.page.domain
    return { domain: r.page.domain, path: r.page.path, name: `${sub} · ${(parts.at(-1) ?? '').replace(/-/g, ' ')}` }
  })
  if (threads.length) return { title: 'Threads AI cites most', kind: 'threads', rows: threads.slice(0, max) }
  const sites = group(off.filter((r) => !THREAD_HOSTS.includes(r.page.domain) && r.page.domain !== OWN.domain), (r) => r.page.domain, (r) => ({ domain: r.page.domain, name: r.page.domain }))
  return { title: 'Sites AI cites instead', kind: 'sites', rows: sites.slice(0, max) }
}

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
  // as the app: this card counts every engine; under the page's engine filter a chip beside its title says so
  const filtered = useDashboardView().engine !== 'all'
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

  // this week against the last (every engine the account tracks): "+3 vs last week" opens week by week
  const enabled = ENGINE_ORDER.filter((e) => tracking.platforms.some((p) => p.id === e && p.enabled))
  const [thisWeek] = marketRows('all', enabled, 2, marketMock())
  const week = (e) => openMarketplaceDrawer({ metric: 'linking', opener: e.currentTarget })

  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5">
      {/* header actions: icon buttons styled like the dropdowns (HeaderIconButton), centred on the 26px title line */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* as the app (owner, 2026-11-15): this card ignores the engine filter; with an engine picked, an "All engines"
              chip beside the title says so */}
          <h2 className="flex flex-wrap items-center gap-x-2 text-title font-semibold text-stone-900">Marketplace visibility
            {filtered && <span data-all-engines className="inline-flex h-5 items-center rounded-md border border-line px-1.5 text-[12px] leading-4 font-medium text-stone-600">All engines</span>}
          </h2>
          <p className="mt-0.5 text-[13px] leading-[18px] font-normal text-stone-600 proportional-nums">How {m.total} tracked prompts link to {storeList(m.stores)}</p>
        </div>
        <div className="-mt-[3px] flex shrink-0 items-center gap-2">
          <HeaderIconButton label="Week by week" icon={History} onClick={week} />
          <HeaderIconButton label={active.action.label} icon={MessageSquareText} onClick={() => showMarketplacePrompts(active.action.filter)} />
          <HeaderIconButton label={`Re-check · last checked ${lastChecked}`} onClick={recheck} tipAlign="right">
            <RefreshCw size={16} className={checking ? 'animate-[spin_600ms_linear_infinite] motion-reduce:animate-none' : undefined} aria-hidden />
          </HeaderIconButton>
        </div>
      </div>

      {/* donut (the selector, 120px) + panel, the donut at the top of the list; the card is as tall as its content */}
      <div className="mb-4 mt-4 flex flex-wrap items-start gap-8 sm:flex-nowrap">
        <div
          role="group"
          tabIndex={0}
          aria-label={`Marketplace segments: ${segs.find((s) => s.key === selectedKey).label} selected. Use the arrow keys to change.`}
          onKeyDown={onDonutKey}
          onMouseLeave={() => preview(null)}
          className="relative h-[120px] w-[120px] shrink-0 rounded-full max-sm:mx-auto outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4"
        >
          <PieChart width={120} height={120} className="cursor-pointer">
            <RPie
              data={segs}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={49}
              outerRadius={60}
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

        <div className="flex min-w-[200px] flex-1 flex-col max-sm:w-full">
        {/* all panels share one grid cell, so the card is always as tall as the tallest panel */}
        <div className="grid min-w-0" aria-live="polite">
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
                {/* your listings: the change since last week, the way into week by week */}
                {s.key === 'yours' && thisWeek?.delta.linking != null && (thisWeek.totals.linking > 0 || thisWeek.prev.linking > 0) && <VsLastWeek d={thisWeek.delta.linking} label="Prompts linking to your listings" onOpen={week} className="mt-1" />}
                {s.key === 'yours' && thisWeek && !thisWeek.prev && thisWeek.totals.linking > 0 && (
                  // the first scan: nothing to compare yet
                  <button type="button" onClick={week} aria-label="Collecting history: the first weekly scan. Open week by week"
                    className="group/vs relative -mx-1 mt-1 inline-flex cursor-pointer items-center whitespace-nowrap rounded px-1 text-left text-[12px] leading-4 text-stone-500 outline-none transition-colors duration-150 hover:text-ink focus-visible:text-ink focus-visible:ring-2 focus-visible:ring-focus">
                    <span className="decoration-1 underline-offset-2 group-hover/vs:underline group-focus-visible/vs:underline">Collecting history · first scan {thisWeek.week.date.replace(/, \d{4}$/, '')}</span>
                    <ArrowRight size={12} aria-hidden className="pointer-events-none absolute left-full top-1/2 -translate-x-1 -translate-y-1/2 text-ink opacity-0 transition duration-150 ease-out group-hover/vs:translate-x-0 group-hover/vs:opacity-100 group-focus-visible/vs:translate-x-0 group-focus-visible/vs:opacity-100 motion-reduce:transition-none" />
                  </button>
                )}
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
                          {domain ? <SiteLogo domain={r.label} name={brandName(r.label)} className="h-5 w-5 rounded-md" initialClass="text-[10px]" />
                            : r.domain ? <SiteLogo domain={r.domain} name={r.label} className="h-5 w-5 rounded-md" initialClass="text-[10px]" />
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
        <CitedInstead />
        </div>
      </div>

      {/* insight for the active segment, with its evidence */}
      {/* footer: pinned to the bottom (aligns with the card beside it); the card has no bottom padding */}
      <div className="mt-auto pb-3"><Insight explain={explain} {...marketplaceEvidence(active, { tracking })} /></div>
    </Card>
  )
}

// Under the panel, after a hairline: "Threads AI cites most", or with no thread "Sites AI cites instead" (a tracked
// competitor's site carries a small grey "Competitor" tag). Each row: logo · name · "cited in N prompts" · the engines
// that cited it · → (a thread opens in a new tab; a site shows its prompts in Marketplace prompts).
function CitedInstead() {
  const list = citedInstead(marketplace.prompts)
  if (!list.rows.length) return null
  const rivals = new Set(TRACKED_BRANDS.filter((b) => !b.you).map((b) => b.domain))
  const rowClass = 'group/ci -mx-2 flex min-h-9 items-center gap-2.5 rounded-md px-2 py-1 text-left outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-focus'
  return (
    <div className="mt-4 border-t border-[var(--color-line-soft)] pt-3" data-cited-instead={list.kind}>
      <h3 className="text-[13px] leading-[18px] font-medium text-stone-900">{list.title}</h3>
      <ul className="mt-1">
        {list.rows.map((r) => {
          const inner = (
            <>
              <SiteLogo domain={r.domain} name={r.name} className="h-5 w-5 shrink-0 rounded-md" initialClass="text-[10px]" />
              <span className="min-w-0 truncate text-[14px] leading-5 text-stone-900">{r.name}</span>
              {list.kind === 'sites' && rivals.has(r.domain) && <span className="inline-flex h-[18px] shrink-0 items-center rounded bg-tint px-1.5 text-[11px] leading-none font-medium text-stone-600">Competitor</span>}
              <span className="ml-auto shrink-0 whitespace-nowrap pl-2 text-[13px] leading-[18px] text-stone-500 tabular-nums">cited in {r.prompts} {r.prompts === 1 ? 'prompt' : 'prompts'}</span>
              {r.engines.length > 0 && <span className="hidden shrink-0 items-center gap-1 sm:flex" aria-label={`Cited by ${r.engines.length} ${r.engines.length === 1 ? 'engine' : 'engines'}`}>{r.engines.map((e) => <PlatformIcon key={e} id={e} size={14} />)}</span>}
              <ArrowRight size={13} className="shrink-0 text-stone-400 transition-colors duration-150 group-hover/ci:text-ink" aria-hidden />
            </>
          )
          return (
            <li key={r.key}>
              {list.kind === 'threads'
                ? <a href={`https://${r.domain}${r.path}`} target="_blank" rel="noopener noreferrer" aria-label={`${r.name}: cited in ${r.prompts} prompts. Open the thread in a new tab`} className={rowClass}>{inner}</a>
                : <button type="button" onClick={() => showMarketplacePrompts('none')} aria-label={`${r.name}: cited in ${r.prompts} prompts. View the prompts`} className={`${rowClass} w-[calc(100%+16px)]`}>{inner}</button>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
