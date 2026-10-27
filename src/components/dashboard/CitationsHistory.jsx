import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, ChevronRight } from 'lucide-react'
import Switch from '../ui/Switch'
import { openSyncDrawer } from '../answer/SyncDrawer'
import { ENGINE_ORDER, TRACKED_BRANDS, brandByDomain, engineName } from '../../data/brandViews'
import { METRICS, citationWeeks, historyMock, weekChanges, weekSplit, weekTotals } from '../../data/citationHistory'
import { useBrandView } from '../../hooks/useBrandView'
import { useTracking } from '../../store/trackingSettings'

// Citations and Mentions → History: one row per weekly scan, newest first. The metric tabs pick what the bars show;
// every row keeps all three numbers (on phones only the selected one; the others move into the open row).
// Rows follow Sync history (44px, dividers, tint on hover, one open at a time); the open row lists what changed.
// State mirrors to the address: ?cmMetric=citations|pages · ?cmVs=<brand key> (Compare on, against that brand)

const PREVIEW = 8
const LIST_MAX = 5
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// chevron | week | bars | mentions | citations | cited pages (phones: chevron | week | bars | selected metric)
const ROW = 'grid grid-cols-[14px_minmax(0,auto)_minmax(0,1fr)_76px] items-center gap-x-3 md:grid-cols-[14px_104px_minmax(0,1fr)_72px_72px_80px]'
// the delta's slot after each number, so the numbers right-align in their column
const DELTA_W = 'w-[26px]'
const fmtDelta = (d) => (d > 0 ? `+${d}` : `−${Math.abs(d)}`)
// a scan that didn't complete: the border token, hatched (never an empty bar, never 0)
const HATCH = { backgroundImage: 'repeating-linear-gradient(135deg, var(--color-line-strong) 0 2px, transparent 2px 5px)' }

function readParams() {
  const q = new URLSearchParams(window.location.search)
  return { metric: METRICS.some((m) => m.id === q.get('cmMetric')) ? q.get('cmMetric') : 'mentions', vs: q.get('cmVs') }
}
function writeParam(k, v) {
  const url = new URL(window.location.href)
  if (v == null) url.searchParams.delete(k)
  else url.searchParams.set(k, v)
  window.history.replaceState(window.history.state, '', url)
}

// the small hover popover (same as LogoStack's): fixed, portalled so the card never clips it
function Tip({ tip }) {
  if (!tip) return null
  return createPortal(
    <span role="tooltip" style={{ left: tip.x, top: tip.y - 6 }}
      className="pointer-events-none fixed z-[70] max-w-[280px] -translate-x-1/2 -translate-y-full rounded-md border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 text-stone-700 shadow-sm motion-safe:animate-[fade-in_120ms_ease-out]">
      {tip.lines.map((l, i) => <span key={i} className={`block whitespace-nowrap tabular-nums ${i ? 'text-stone-500' : ''}`}>{l}</span>)}
    </span>,
    document.body,
  )
}

// "AI Overview 111 · Gemini 90 · ChatGPT 54"; a failed engine reads "Gemini —"
const splitLine = (split) => split.map((s) => `${engineName(s.id)} ${s.value ?? '—'}`).join(' · ')

function Delta({ d }) {
  if (d == null || d === 0) return <span className={`${DELTA_W} shrink-0`} aria-hidden />
  return <span className={`${DELTA_W} shrink-0 text-[12px] leading-4 font-medium tabular-nums ${d > 0 ? 'text-stone-600' : 'text-negative'}`}>{fmtDelta(d)}</span>
}

// Gained / Lost: two quiet columns, max 5 each, then "View all" (the Sync drawer, on that tab)
function ChangeColumn({ title, items, onAll }) {
  return (
    <div className="min-w-0">
      <div className="flex h-6 items-center gap-1.5 text-[13px] leading-[18px] font-medium text-stone-600">
        {title}<span className="font-normal text-stone-500 tabular-nums">{items.length}</span>
      </div>
      {items.length === 0 ? <p className="flex h-6 items-center text-[13px] leading-[18px] text-stone-500">None</p> : (
        <ul>
          {items.slice(0, LIST_MAX).map((it) => (
            <li key={it.key} title={it.label} className="flex h-6 items-center text-[13px] leading-[18px] text-stone-600">
              <span className="truncate">{it.label}</span>
            </li>
          ))}
        </ul>
      )}
      {items.length > LIST_MAX && onAll && (
        <button type="button" onClick={onAll}
          className="mt-1 inline-flex items-center gap-1 rounded text-[12px] leading-4 font-medium text-stone-500 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
          View all {items.length} <ArrowRight size={12} aria-hidden />
        </button>
      )}
    </div>
  )
}

function SkeletonRows({ n }) {
  const bar = 'rounded bg-tint motion-safe:animate-pulse'
  return (
    <ul role="status" aria-label="Loading history" className="divide-y divide-[var(--color-line-soft)] border-t border-[var(--color-line-soft)]">
      {Array.from({ length: n }, (_, i) => (
        <li key={i} className={`${ROW} h-11`}>
          <span />
          <span className={`${bar} h-3 w-[88px]`} />
          <span className={`${bar} h-1.5 w-full max-w-[220px] rounded-full`} />
          {[0, 1, 2].map((k) => <span key={k} className={`${k ? 'hidden md:flex' : 'flex'} justify-end pr-[30px]`}><span className={`${bar} h-3 w-7`} /></span>)}
        </li>
      ))}
    </ul>
  )
}

export default function CitationsHistory({ domain, active }) {
  const page = useBrandView()
  const view = useBrandView(domain) // this card's brand, scoped to the page's engine filter (Mentions' change lists)
  const tracking = useTracking()
  const engine = page.engine
  const enabled = ENGINE_ORDER.filter((e) => tracking.platforms.some((p) => p.id === e && p.enabled))
  const brand = brandByDomain(domain)
  const rivals = TRACKED_BRANDS.filter((b) => b.domain !== domain)
  const ids = engine === 'all' ? enabled : [engine]

  const [metric, setMetricState] = useState(() => readParams().metric)
  const [vsKey, setVsKey] = useState(() => readParams().vs) // null = Compare off
  const [lastVs, setLastVs] = useState(() => readParams().vs ?? rivals[0]?.key)
  const [showAll, setShowAll] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [tip, setTip] = useState(null)
  const mock = historyMock()
  // a short fetch the first time History opens (the mock's data is instant); ?cmMock=loading holds the skeleton
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!active || loaded || mock === 'loading') return
    const t = setTimeout(() => setLoaded(true), reduced() ? 0 : 500)
    return () => clearTimeout(t)
  }, [active, loaded, mock])
  useEffect(() => setOpenId(null), [domain, engine])

  const rival = vsKey ? rivals.find((b) => b.key === vsKey) ?? rivals[0] : null
  const setMetric = (m) => { setMetricState(m); writeParam('cmMetric', m === 'mentions' ? null : m) }
  const setCompare = (on) => {
    const key = on ? (rivals.some((b) => b.key === lastVs) ? lastVs : rivals[0]?.key) : null
    setVsKey(key)
    writeParam('cmVs', key)
  }
  const pickRival = (key) => { setVsKey(key); setLastVs(key); writeParam('cmVs', key) }

  const own = citationWeeks(domain)
  const theirs = rival ? citationWeeks(rival.domain) : null
  const all = mock === 'empty' ? own.weeks.slice(0, 1) : own.weeks
  const shown = showAll ? all : all.slice(0, PREVIEW)
  const rows = useMemo(() => all.map((w, i) => {
    const totals = weekTotals(w, engine, ids)
    const prev = all[i + 1] && weekTotals(all[i + 1], engine, ids)
    const delta = (k) => (prev && totals[k] != null && prev[k] != null ? totals[k] - prev[k] : null)
    const vs = theirs && theirs.weeks[i] ? weekTotals(theirs.weeks[i], engine, ids) : null
    return { w, i, totals, prev, vs, deltas: { mentions: delta('mentions'), citations: delta('citations'), pages: delta('pages') } }
  }), [all, theirs, engine, ids.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(1, ...rows.slice(0, shown.length).flatMap((r) => [r.totals[metric] ?? 0, r.vs?.[metric] ?? 0]))

  const listRef = useRef(null)
  const panelId = useId()
  const sel = METRICS.find((m) => m.id === metric)
  const toggle = (id) => setOpenId((cur) => (cur === id ? null : id))

  // arrows move between rows, Home / End jump, Esc closes the open row (focus stays on its row)
  const onKeyDown = (e) => {
    const btns = [...(listRef.current?.querySelectorAll('[data-week]') ?? [])]
    const i = btns.indexOf(document.activeElement)
    if (e.key === 'Escape' && openId != null) {
      e.preventDefault(); e.stopPropagation()
      const row = btns.find((b) => b.dataset.week === String(openId))
      setOpenId(null)
      row?.focus()
      return
    }
    const next = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: btns.length - 1 }[e.key]
    if (next == null || i === -1 || !btns[next]) return
    e.preventDefault()
    btns[next].focus()
  }
  // the metric tabs: arrows move and select (as the drawer's tabs do)
  const onTabKey = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const i = METRICS.findIndex((m) => m.id === metric)
    const next = METRICS[(i + step + METRICS.length) % METRICS.length].id
    setMetric(next)
    requestAnimationFrame(() => document.getElementById(`${panelId}-${next}`)?.focus())
  }

  const showTip = (e, lines) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ x: r.left + r.width / 2, y: r.top, lines }) }
  const hideTip = () => setTip(null)
  const failedLine = (r) => `${r.totals.failed.map(engineName).join(' and ')}: scan didn’t complete this week`
  const tipFor = (r, m) => (r.totals[m] == null
    ? ['Scan didn’t complete this week', splitLine(weekSplit(r.w, m, ids))]
    : [splitLine(weekSplit(r.w, m, ids)) || `No ${METRICS.find((x) => x.id === m).label.toLowerCase()}`])

  if (all.length < 2 && loaded) {
    return <p className="pb-6 pt-4 text-[14px] leading-5 text-stone-600">History appears after your second weekly scan.</p>
  }

  return (
    <div className="pb-4">
      {/* 1. the metric: text tabs, the drawer's style */}
      <div role="tablist" aria-label="Metric" onKeyDown={onTabKey} className="mt-3 flex gap-6 border-b border-[var(--div)]">
        {METRICS.map((m) => {
          const on = m.id === metric
          return (
            <button key={m.id} id={`${panelId}-${m.id}`} type="button" role="tab" aria-selected={on} aria-controls={`${panelId}-rows`} tabIndex={on ? 0 : -1} onClick={() => setMetric(m.id)}
              className={`-mb-px inline-flex h-10 items-center border-b-2 text-[14px] leading-5 font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'border-ink text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900'}`}>
              {m.label}
            </button>
          )
        })}
      </div>

      {/* 2. the brand: Compare off = this brand alone; on = against one competitor (a thinner bar under each row's own) */}
      <div className="mt-3 flex min-w-0 items-center">
        <Switch checked={!!rival} onChange={setCompare} className="shrink-0">Compare</Switch>
        <span className="mx-3 h-5 w-px shrink-0 bg-stone-200" aria-hidden />
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          <span className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap px-1 font-medium text-stone-900 ${rival ? 'text-[13px] leading-[18px]' : 'text-[14px] leading-5'}`}>
            <span className="h-1.5 w-3 rounded-full bg-ink" aria-hidden />{brand?.name}
          </span>
          {rival && (
            <>
              <span className="shrink-0 pr-0.5 text-[13px] leading-[18px] text-stone-500">vs</span>
              <div role="radiogroup" aria-label="Compare with" className="flex shrink-0 items-center"
                onKeyDown={(e) => {
                  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
                  if (!step) return
                  e.preventDefault()
                  const i = rivals.findIndex((b) => b.key === rival.key)
                  const next = rivals[(i + step + rivals.length) % rivals.length]
                  pickRival(next.key)
                  requestAnimationFrame(() => e.currentTarget.querySelector(`[data-rival="${next.key}"]`)?.focus())
                }}>
                {rivals.map((b) => {
                  const on = b.key === rival.key
                  return (
                    <button key={b.key} data-rival={b.key} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => pickRival(b.key)}
                      // Visibility history's chip at its 13px step (FitChips' small size): four brands fit a half-width card
                      className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[13px] leading-[18px] outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-focus ${on ? 'font-medium text-stone-900' : 'text-stone-600'}`}>
                      {on && <span className="h-[3px] w-3 rounded-full bg-[var(--color-line-strong)]" aria-hidden />}
                      {b.name}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 3. the weeks */}
      <div className={`${ROW} mt-3 h-8 text-[12px] leading-4 text-stone-500`} aria-hidden>
        <span />
        <span>Week</span>
        <span />
        {METRICS.map((m) => (
          // over the number (the delta's slot stays clear); a long label runs left into the empty space
          <span key={m.id} className={`${m.id === metric ? 'flex font-medium text-stone-900' : 'hidden md:flex'} justify-end whitespace-nowrap pr-[30px]`}>{m.label}</span>
        ))}
      </div>
      {!loaded ? <SkeletonRows n={PREVIEW} /> : (
        <ul ref={listRef} id={`${panelId}-rows`} role="list" aria-label={`${brand?.name} ${sel.label.toLowerCase()} by week`} onKeyDown={onKeyDown}
          className="divide-y divide-[var(--color-line-soft)] border-t border-[var(--color-line-soft)]">
          {rows.slice(0, shown.length).map((r) => {
            const isOpen = openId === r.w.id
            const failed = r.totals[metric] == null
            const pct = (v) => `${v == null ? 0 : Math.max(v ? 2 : 0, (v / max) * 100)}%`
            const changes = weekChanges({ domain, metric, index: r.i, totals: r.totals, prevTotals: r.prev, sync: view.syncHistory[r.i] })
            // "Sep 28 – Oct 4: mentions 233 (−17), citations 32 (−5), cited pages 6 (−1). CeraVe 68"
            const label = r.totals.failed.length
              ? `${r.w.label}: ${failedLine(r)}`
              : `${r.w.label}: ${METRICS.map((m) => `${m.label.toLowerCase()} ${r.totals[m.id]}${r.deltas[m.id] ? ` (${fmtDelta(r.deltas[m.id])})` : ''}`).join(', ')}${rival && r.vs?.[metric] != null ? `. ${rival.name} ${r.vs[metric]}` : ''}`
            return (
              <li key={r.w.id}>
                <button type="button" data-week={r.w.id} onClick={() => toggle(r.w.id)} aria-expanded={isOpen} aria-controls={`${panelId}-w${r.w.id}`} aria-label={label}
                  className={`${ROW} group -mx-2 h-11 w-[calc(100%+16px)] rounded-md px-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus`}>
                  <ChevronRight size={14} className={`text-stone-500 transition-transform duration-150 ease-out motion-reduce:transition-none ${isOpen ? 'rotate-90' : ''}`} aria-hidden />
                  <span className="truncate whitespace-nowrap text-[14px] leading-5 text-stone-900 tabular-nums">{r.w.label}</span>

                  {/* bars: yours (ink on the track), the competitor's thinner one under it (border token) */}
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex min-w-0 max-w-[240px] flex-1 flex-col justify-center gap-[3px]"
                      onMouseEnter={failed ? (e) => showTip(e, tipFor(r, metric)) : undefined} onMouseLeave={failed ? hideTip : undefined}>
                      {failed
                        ? <span className="h-1.5 w-full rounded-full" style={HATCH} />
                        : (
                          <span className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--data-track)' }}>
                            <span className="block h-full rounded-full bg-ink transition-[width] duration-[250ms] ease-out motion-reduce:transition-none" style={{ width: pct(r.totals[metric]) }} />
                          </span>
                        )}
                      <span className={`block w-full overflow-hidden rounded-full transition-[height,opacity] duration-200 ease-out motion-reduce:transition-none ${rival ? 'h-[3px] opacity-100' : 'h-0 opacity-0'}`}>
                        {r.vs?.[metric] == null
                          ? <span className="block h-full w-full rounded-full" style={HATCH} />
                          : <span className="block h-full rounded-full bg-[var(--color-line-strong)] transition-[width] duration-[250ms] ease-out motion-reduce:transition-none" style={{ width: pct(r.vs[metric]) }} />}
                      </span>
                    </span>
                    {rival && (
                      <span className="hidden w-11 shrink-0 text-right text-[12px] leading-4 text-stone-500 tabular-nums sm:block">vs {r.vs?.[metric] ?? '—'}</span>
                    )}
                  </span>

                  {/* the three numbers, right-aligned; the selected one ink 600 */}
                  {METRICS.map((m) => {
                    const v = r.totals[m.id]
                    const on = m.id === metric
                    return (
                      <span key={m.id} className={`${on ? 'flex' : 'hidden md:flex'} items-baseline justify-end gap-1`}>
                        <span onMouseEnter={(e) => showTip(e, tipFor(r, m.id))} onMouseLeave={hideTip}
                          className={`rounded-sm text-[14px] leading-5 tabular-nums ${v == null ? 'text-stone-500' : on ? 'font-semibold text-ink' : 'text-stone-600'}`}>
                          {v ?? '—'}
                        </span>
                        <Delta d={r.deltas[m.id]} />
                      </span>
                    )
                  })}
                </button>

                {/* the open row: what changed this week for the selected metric (grid rows 0fr → 1fr, 200ms) */}
                <div id={`${panelId}-w${r.w.id}`} aria-hidden={!isOpen} inert={isOpen ? undefined : ''}
                  className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden">
                      <div className="pb-4 pl-[26px] pr-2 pt-1">
                        {/* phones: the two numbers the row leaves out */}
                        <p className="mb-2.5 text-[13px] leading-[18px] text-stone-600 tabular-nums md:hidden">
                          {METRICS.filter((m) => m.id !== metric).map((m, k) => (
                            <span key={m.id}>{k ? ' · ' : ''}{m.label} <span className="font-medium text-stone-900">{r.totals[m.id] ?? '—'}</span>
                              {r.deltas[m.id] ? <span className={`ml-1 text-[12px] font-medium ${r.deltas[m.id] > 0 ? 'text-stone-600' : 'text-negative'}`}>{fmtDelta(r.deltas[m.id])}</span> : null}</span>
                          ))}
                        </p>
                        {r.totals.failed.length ? (
                          <p className="text-[13px] leading-[18px] text-stone-500">{failedLine(r)}. Filter to another engine to see its numbers.</p>
                        ) : !changes ? (
                          <p className="text-[13px] leading-[18px] text-stone-500">{r.prev ? 'The week before didn’t complete, so there’s nothing to compare against.' : 'First week in this history: nothing to compare against.'}</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                            {[['gained', 'Gained'], ['lost', 'Lost']].map(([k, title]) => (
                              <ChangeColumn key={k} title={title} items={changes[k]}
                                onAll={domain === page.focal.domain ? (e) => openSyncDrawer({ syncId: r.w.syncId, tab: k, opener: e?.currentTarget }) : null} />
                            ))}
                          </div>
                        )}
                        {!r.totals.failed.length && (
                          <p className="mt-2.5 text-[12px] leading-4 text-stone-500 tabular-nums">{sel.label} by engine · {splitLine(weekSplit(r.w, metric, ids)) || 'none'}</p>
                        )}
                      </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {loaded && all.length > PREVIEW && (
        <button type="button" onClick={() => { setShowAll((v) => !v); setOpenId(null) }} aria-expanded={showAll}
          className="mt-2 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
          {showAll ? `Show latest ${PREVIEW}` : `Show all ${all.length} weeks`}
        </button>
      )}
      <Tip tip={tip} />
    </div>
  )
}
