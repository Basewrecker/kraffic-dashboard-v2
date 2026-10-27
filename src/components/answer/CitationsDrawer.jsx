import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ChevronRight, X } from 'lucide-react'
import SheetHandle, { SHEET_BASE, SHEET_FOOTER_PAD, SHEET_IN, SHEET_OUT } from '../ui/SheetHandle'
import { ChangeRows, ChangeTabs, EngineChips } from './ChangeParts'
import { openAnswer } from './AnswerDrawer'
import { download } from './EngineDrawer'
import { ENGINES, ENGINE_ORDER, OWN, TRACKED_BRANDS, brandByDomain, engineName } from '../../data/brandViews'
import { METRICS, brandEngines, citationWeeks, historyMock, weekChanges, weekRows, weekSummary } from '../../data/citationHistory'
import { useBrandView } from '../../hooks/useBrandView'
import { fmtDay, useTracking } from '../../store/trackingSettings'

// Citations and Mentions → "Mentions and citations": the card's numbers week by week, in the drawer family (same
// shell, width, header and footer as the Sync drawer). Three figures with sparklines pick the metric; the weeks
// below say what happened in plain words; a week drills in (same drawer, slides across) to the Sync drawer's own
// Lost | Gained list for that week. Esc goes back, then closes.
// openCitationsDrawer({ metric, brand, opener }). URL (replaceState while open, pushed on open so Back closes):
//   ?drawer=weeks&metric=mentions|citations|pages[&drawerBrand=<key>][&vs=<key>][&week=<index>&tab=lost|gained][&drawerEngine=]
const EVENT = 'citations-drawer:open'
export function openCitationsDrawer({ metric = 'mentions', brand = null, opener }) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { metric, brand, opener } }))
}

const WEEKS = 10
const LOAD_MS = 450
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const fmtDelta = (d) => (d > 0 ? `+${d}` : `−${Math.abs(d)}`)
const short = (d) => d.replace(/, \d{4}$/, '')

function readUrl() {
  const q = new URLSearchParams(window.location.search)
  if (q.get('drawer') !== 'weeks') return null
  const week = q.get('week')
  return {
    metric: METRICS.some((m) => m.id === q.get('metric')) ? q.get('metric') : 'mentions',
    brand: TRACKED_BRANDS.find((b) => b.key === q.get('drawerBrand'))?.domain ?? null,
    vs: TRACKED_BRANDS.some((b) => b.key === q.get('vs')) ? q.get('vs') : null,
    week: week != null && /^\d+$/.test(week) ? Number(week) : null,
    tab: q.get('tab') === 'gained' ? 'gained' : 'lost',
    engine: q.get('drawerEngine') ?? null,
  }
}
function urlFor(s, focal) {
  const url = new URL(window.location.href)
  for (const k of ['drawer', 'metric', 'drawerBrand', 'vs', 'week', 'tab', 'drawerEngine']) url.searchParams.delete(k)
  if (s) {
    url.searchParams.set('drawer', 'weeks'); url.searchParams.set('metric', s.metric)
    if (s.brand && s.brand !== focal) url.searchParams.set('drawerBrand', brandByDomain(s.brand).key)
    if (s.vs) url.searchParams.set('vs', s.vs)
    if (s.week != null) { url.searchParams.set('week', s.week); url.searchParams.set('tab', s.tab) }
    if (s.engine && s.engine !== 'all') url.searchParams.set('drawerEngine', s.engine)
  }
  return url
}

// the small hover popover (LogoStack's): fixed, portalled above the drawer
function Tip({ tip }) {
  if (!tip) return null
  return createPortal(
    <span role="tooltip" style={{ left: tip.x, top: tip.y - 8 }}
      className="pointer-events-none fixed z-[70] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 text-stone-700 shadow-sm tabular-nums">
      {tip.lines.map((l, i) => <span key={i} className={`block ${i ? 'text-stone-500' : 'font-medium text-stone-900'}`}>{l}</span>)}
    </span>,
    document.body,
  )
}

// ---- sparkline: last 10 weeks, oldest → newest; a failed week is a gap. Ink when its metric is selected, t3 when not;
// the competitor's is a thinner t3 line. Hovering a week shows a dot and "Sep 28 – Oct 4 · 233".
const H = 32
function linePath(values, lo, hi) {
  const n = values.length
  let d = '', pen = false
  values.forEach((v, i) => {
    if (v == null) { pen = false; return }
    const x = n < 2 ? 50 : (i / (n - 1)) * 100
    const y = H - 3 - ((v - lo) / Math.max(1, hi - lo)) * (H - 6)
    d += `${pen ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `
    pen = true
  })
  return d.trim() || 'M0 0'
}
function Sparkline({ values, vs, labels, on, rivalName, onTip }) {
  const [hover, setHover] = useState(null)
  // each line on its own scale: the sparkline compares shapes (their sizes are in the rows' "vs N" and the tooltip)
  const range = (list) => { const v = (list ?? []).filter((x) => x != null); return [Math.min(...v), Math.max(...v)] }
  const [lo, hi] = range(values)
  const [vlo, vhi] = range(vs)
  const n = values.length
  const yOf = (v) => H - 3 - ((v - lo) / Math.max(1, hi - lo)) * (H - 6)
  const stroke = 'transition-[d,stroke,stroke-width] duration-[250ms] ease-out motion-reduce:transition-none'
  return (
    <span className="relative mt-2 block h-8 w-full" onMouseLeave={() => { setHover(null); onTip(null) }}>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {vs && <path className={stroke} style={{ d: `path("${linePath(vs, vlo, vhi)}")` }} fill="none" stroke="var(--color-stone-500)" strokeWidth={1} strokeOpacity={0.7} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />}
        <path className={stroke} style={{ d: `path("${linePath(values, lo, hi)}")`, stroke: on ? 'var(--ink)' : 'var(--color-stone-500)', strokeWidth: on ? 2 : 1.25 }} fill="none" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {hover != null && values[hover] != null && (
        <span className="pointer-events-none absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--color-surface)]"
          style={{ left: `${n < 2 ? 50 : (hover / (n - 1)) * 100}%`, top: `${(yOf(values[hover]) / H) * 100}%`, background: on ? 'var(--ink)' : 'var(--color-stone-500)' }} />
      )}
      <span className="absolute inset-0 flex">
        {values.map((v, i) => (
          <span key={i} className="h-full flex-1"
            onMouseEnter={(e) => {
              setHover(i)
              const r = e.currentTarget.parentElement.getBoundingClientRect()
              const x = r.left + (n < 2 ? 0.5 : i / (n - 1)) * r.width
              onTip({ x, y: r.top, lines: [`${labels[i]} · ${v ?? '—'}`, ...(v == null ? ['Scan didn’t complete this week'] : []), ...(vs ? [`${rivalName} ${vs[i] ?? '—'}`] : [])] })
            }} />
        ))}
      </span>
    </span>
  )
}

function Delta({ d, className = 'text-[12px] leading-4' }) {
  if (d == null || d === 0) return null
  return <span className={`${className} font-medium tabular-nums ${d > 0 ? 'text-stone-600' : 'text-negative'}`}>{fmtDelta(d)}</span>
}

const bar = 'rounded bg-tint motion-safe:animate-pulse'
function SkeletonFigures() {
  return (
    <div className="mt-5 grid grid-cols-3 gap-4 pb-4 md:gap-8" role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => <div key={i}><div className={`${bar} h-3 w-16`} /><div className={`${bar} mt-2 h-7 w-20`} /><div className={`${bar} mt-2 h-8 w-full`} /></div>)}
    </div>
  )
}
function SkeletonRows() {
  return (
    <ul className="divide-y divide-[var(--div)]" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i} className="flex h-[60px] items-center gap-3 px-6">
          <span className="min-w-0 flex-1"><span className={`${bar} block h-3.5 w-24`} /><span className={`${bar} mt-2 block h-3 w-56 max-w-full`} /></span>
          <span className={`${bar} h-3.5 w-12`} />
        </li>
      ))}
    </ul>
  )
}

export default function CitationsDrawer() {
  const page = useBrandView()
  const tracking = useTracking()
  const [state, setState] = useState(readUrl) // { metric, brand, vs, week, tab, engine }
  const [shown, setShown] = useState(false)
  const [loading, setLoading] = useState(true)
  const [swapped, setSwapped] = useState(false)
  const [tip, setTip] = useState(null)
  const pushed = useRef(false)
  const panel = useRef(null)
  const opener = useRef(null)
  const lastRow = useRef(null)
  const panes = useRef(null)
  const mock = historyMock()

  const open = state != null
  const domain = state?.brand ?? page.focal.domain
  const brand = brandByDomain(domain) ?? OWN
  const shownEngines = brandEngines(domain)
  const enabled = ENGINE_ORDER.filter((e) => tracking.platforms.some((p) => p.id === e && p.enabled))
  const engine = open && state.engine && shownEngines.includes(state.engine) ? state.engine : 'all'
  const metric = state?.metric ?? 'mentions'
  const sel = METRICS.find((m) => m.id === metric)
  const rival = state?.vs && state.vs !== brand.key ? TRACKED_BRANDS.find((b) => b.key === state.vs) : null
  const rivals = TRACKED_BRANDS.filter((b) => b.domain !== domain)

  const rows = useMemo(() => (open ? weekRows(domain, engine, enabled, mock === 'empty' ? 1 : WEEKS) : []), [open, domain, engine, enabled.join(), mock]) // eslint-disable-line react-hooks/exhaustive-deps
  const vsRows = useMemo(() => (open && rival ? weekRows(rival.domain, engine, enabled, WEEKS) : null), [open, rival, engine, enabled.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const syncs = open ? citationWeeks(domain).syncs : []
  const changesOf = useCallback((r, m) => weekChanges({ domain, metric: m, row: r, engine, sync: syncs[r.index] }), [domain, engine, syncs])

  const drilled = open && !loading && state.week != null && rows[state.week] && changesOf(rows[state.week], metric) != null
  const drillRow = drilled ? rows[state.week] : null
  // the drill-in keeps its last week while it slides back out
  const [drillKeep, setDrillKeep] = useState(null)
  useEffect(() => { if (drillRow) setDrillKeep(drillRow) }, [drillRow])
  const dRow = drillRow ?? drillKeep
  const dChanges = dRow ? changesOf(dRow, metric) : null
  const tab = state?.tab ?? 'lost'

  // open (event), Back (popstate)
  useEffect(() => {
    const on = (e) => {
      opener.current = e.detail.opener ?? document.activeElement
      setSwapped(false)
      setLoading(true)
      setDrillKeep(null)
      const next = { metric: e.detail.metric, brand: e.detail.brand, vs: null, week: null, tab: 'lost', engine: page.engine }
      if (!readUrl()) { window.history.pushState(window.history.state, '', urlFor(next, page.focal.domain)); pushed.current = true }
      setState(next)
    }
    const pop = () => { pushed.current = false; setSwapped(false); setState(readUrl()) }
    window.addEventListener(EVENT, on)
    window.addEventListener('popstate', pop)
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener('popstate', pop) }
  }, [page.engine, page.focal.domain])
  useEffect(() => { window.history.replaceState(window.history.state, '', urlFor(open && !swapped ? state : null, page.focal.domain)) }, [open, swapped, state, page.focal.domain])
  useLayoutEffect(() => {
    if (!open) { setShown(false); return }
    const r = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(r)
  }, [open])
  useEffect(() => { if (open && shown && !swapped) panel.current?.focus() }, [open, shown]) // eslint-disable-line react-hooks/exhaustive-deps
  // a short fetch each time the drawer opens (the mock's data is instant); ?cmMock=loading holds the skeleton
  useEffect(() => {
    if (!open || !loading || mock === 'loading') return
    const t = setTimeout(() => setLoading(false), LOAD_MS)
    return () => clearTimeout(t)
  }, [open, loading, mock])

  const finish = useCallback(() => {
    if (pushed.current) { pushed.current = false; window.history.back() } else setState(null)
    setSwapped(false); setDrillKeep(null); setTip(null)
    opener.current?.focus?.()
  }, [])
  const close = useCallback(() => { setShown(false); setTip(null); setTimeout(finish, reduced() ? 0 : 200) }, [finish])
  const set = (patch) => setState((s) => ({ ...s, ...patch }))
  const focusIn = (q) => setTimeout(() => panel.current?.querySelector(q)?.focus({ preventScroll: true }), reduced() ? 0 : 260)
  const drill = (i) => { setTip(null); set({ week: i, tab: 'lost' }); focusIn('[data-back]') }
  const back = () => { const i = state.week; set({ week: null }); focusIn(`[data-week="${i}"]`) }

  // a prompt in the drill-in → the Answer drawer stands in for this one (as from the Sync drawer)
  const openPrompt = (it, el) => {
    lastRow.current = el
    setSwapped(true)
    const list = dChanges[tab].filter((x) => !x.plain)
    openAnswer({
      key: it.key, engine: it.engine, date: syncs[dRow.index]?.date, brand: domain, list: list.map((x) => x.key),
      back: {
        label: `Changes on ${dRow.week.label}`,
        onBack: () => { setSwapped(false); requestAnimationFrame(() => (lastRow.current?.isConnected ? lastRow.current : panel.current)?.focus({ preventScroll: true })) },
        onClose: finish,
      },
    })
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); if (drilled) back(); else close(); return }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.target.closest('[role=tablist]')) {
      const pane = panes.current?.children[drilled ? 1 : 0]
      const list = [...(pane?.querySelectorAll('[data-nav]') ?? [])]
      const i = list.indexOf(e.target)
      const next = i === -1 ? list[0] : list[i + (e.key === 'ArrowDown' ? 1 : -1)]
      if (next) { e.preventDefault(); next.focus() }
    } else if (e.key === 'Tab') {
      const f = [...panel.current.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null && !el.closest('[inert]'))
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }
  // the metric figures: a tablist, arrows move and pick
  const onFigureKey = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const i = METRICS.findIndex((m) => m.id === metric)
    const next = METRICS[(i + step + METRICS.length) % METRICS.length].id
    set({ metric: next })
    requestAnimationFrame(() => panel.current?.querySelector(`[data-metric="${next}"]`)?.focus())
  }

  if (!open) return null
  const chips = [{ id: 'all', name: 'All' }, ...ENGINES.filter((e) => shownEngines.includes(e.id))]
  const empty = rows.length < 2
  const series = (list, m) => [...list].reverse().map((r) => r.totals[m])
  const labels = [...rows].reverse().map((r) => r.week.label)
  const noun = metric === 'pages' ? 'page' : 'prompt'
  const counts = { lost: dChanges?.lost.length ?? 0, gained: dChanges?.gained.length ?? 0 }
  const engineLabel = engine === 'all' ? 'All engines' : engineName(engine)

  const exportCsv = () => {
    if (drilled) {
      download(`${brand.key}-${metric}-${dRow.week.label.replace(/\W+/g, '-').toLowerCase()}-${tab}.csv`, [[metric === 'pages' ? 'Page' : 'Prompt', 'What happened'], ...dChanges[tab].map((x) => [x.prompt, x.meta])])
    } else {
      download(`${brand.key}-weekly-citations.csv`, [['Week', ...METRICS.map((m) => m.label), ...(rival ? [`${rival.name} ${sel.label.toLowerCase()}`] : [])],
        ...rows.map((r, i) => [r.week.label, ...METRICS.map((m) => r.totals[m.id] ?? ''), ...(rival ? [vsRows?.[i]?.totals[metric] ?? ''] : [])])])
    }
  }

  return (
    <div className={`fixed inset-0 z-50 ${swapped ? 'invisible' : ''}`} onKeyDown={onKeyDown}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity duration-[250ms] ease-out motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`} onClick={close} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={drilled ? `Changes on ${dRow.week.label}` : 'Mentions and citations'}
        tabIndex={-1}
        // phones: a full-screen sheet; md+: the drawers' 720px panel
        className={`${SHEET_BASE} max-md:!h-[100dvh] max-md:!rounded-none max-md:!border-t-0 md:w-[min(720px,100vw)] ${shown ? SHEET_IN : SHEET_OUT}`}
      >
        <SheetHandle panelRef={panel} onClose={close} />
        <div className="flex shrink-0 items-center justify-between gap-3 px-6 pt-5">
          <EngineChips chips={chips} value={engine} onChange={(id) => set({ engine: id })} />
          <button type="button" onClick={close} aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
            <X size={16} />
          </button>
        </div>

        {/* two panes side by side: the weeks, and one week's changes; drilling in slides across (250ms) */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div ref={panes} className={`flex h-full w-[200%] transition-transform duration-[250ms] ease-out motion-reduce:transition-none ${drilled ? '-translate-x-1/2' : 'translate-x-0'}`}>
            {/* ---- all weeks */}
            <section className="flex h-full w-1/2 min-w-0 flex-col" inert={drilled ? '' : undefined} aria-hidden={drilled}>
              <header className="shrink-0 border-b border-line px-6">
                <h2 className="mt-3 text-[20px] leading-7 font-semibold text-stone-900">Mentions and citations</h2>
                <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600 tabular-nums">{brand.name} · 152 prompts · last {plural(rows.length, 'week')}</p>
                {loading ? <SkeletonFigures /> : empty ? <div className="pb-4" /> : (
                  <>
                    {/* the metric: three figures with their sparklines; the selected one is ink with the underline */}
                    <div role="tablist" aria-label="Metric" onKeyDown={onFigureKey} className="mt-5 grid grid-cols-3 gap-4 md:gap-8">
                      {METRICS.map((m) => {
                        const on = m.id === metric
                        const r0 = rows[0]
                        return (
                          <button key={m.id} data-metric={m.id} type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1} onClick={() => set({ metric: m.id })}
                            aria-label={`${m.label} ${r0.totals[m.id] ?? 'not known'}${r0.delta[m.id] ? `, ${fmtDelta(r0.delta[m.id])} vs last week` : ''}`}
                            className={`group min-w-0 rounded-md border-b-2 pb-3 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'border-ink' : 'border-transparent'}`}>
                            <span className={`block text-[13px] leading-[18px] font-medium transition-colors duration-150 ${on ? 'text-stone-900' : 'text-stone-600 group-hover:text-stone-900'}`}>{m.label}</span>
                            <span className="mt-1 flex items-baseline gap-1.5">
                              <span className={`text-[24px] leading-8 font-semibold tabular-nums transition-colors duration-150 ${on ? 'text-ink' : 'text-stone-600 group-hover:text-stone-900'}`}>{r0.totals[m.id] ?? '—'}</span>
                              <Delta d={r0.delta[m.id]} />
                            </span>
                            <Sparkline values={series(rows, m.id)} vs={vsRows && series(vsRows, m.id)} labels={labels} on={on} rivalName={rival?.name} onTip={setTip} />
                          </button>
                        )
                      })}
                    </div>
                    {/* compare: one competitor at a time (Visibility history's chips); again to turn it off */}
                    <div className="mt-3 flex min-w-0 items-center gap-1 overflow-x-auto pb-3 [scrollbar-width:none]">
                      <span className="mr-1 shrink-0 text-[13px] leading-[18px] text-stone-500">Compare with</span>
                      {rivals.map((b) => {
                        const on = rival?.key === b.key
                        return (
                          <button key={b.key} type="button" aria-pressed={on} onClick={() => set({ vs: on ? null : b.key })}
                            className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[13px] leading-[18px] outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-focus ${on ? 'font-medium text-stone-900' : 'text-stone-600'}`}>
                            {on && <span className="h-px w-3 bg-stone-500" aria-hidden />}{b.name}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {loading ? <SkeletonRows /> : empty ? (
                  <p className="px-6 py-12 text-center text-[14px] leading-5 text-stone-600">History appears after your second weekly scan.</p>
                ) : (
                  // the week summaries cross-fade when the metric changes
                  <ul key={`${metric}|${engine}`} className="divide-y divide-[var(--div)] motion-safe:animate-[fade-in_150ms_ease-out]" aria-label={`${sel.label} by week`}>
                    {rows.map((r, i) => {
                      const v = r.totals[metric]
                      const changes = changesOf(r, metric)
                      const summary = weekSummary({ metric, row: r, changes, you: brand.you, name: brand.name })
                      const vs = vsRows?.[i]?.totals[metric]
                      const body = (
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-3">
                            <span className="min-w-0 flex-1 truncate text-[14px] leading-5 font-medium text-stone-900 tabular-nums">{r.week.label}</span>
                            <span className="flex shrink-0 items-baseline gap-1.5">
                              <span className={`text-[14px] leading-5 tabular-nums ${v == null ? 'text-stone-500' : 'font-semibold text-ink'}`}>{v ?? '—'}</span>
                              <span className="w-8"><Delta d={r.delta[metric]} /></span>
                              {rival && <span className="w-14 text-right text-[12px] leading-4 text-stone-500 tabular-nums">vs {vs ?? '—'}</span>}
                            </span>
                          </span>
                          <span className={`block truncate text-[12.5px] leading-[18px] ${r.totals.failed.length ? 'text-stone-500' : 'text-stone-600'}`}>{summary}</span>
                        </span>
                      )
                      return (
                        <li key={r.week.id}>
                          {changes ? (
                            <button type="button" data-nav data-week={i} onClick={() => drill(i)} aria-label={`${r.week.label}: ${sel.label.toLowerCase()} ${v}${r.delta[metric] ? ` (${fmtDelta(r.delta[metric])})` : ''}. ${summary}`}
                              className="group flex h-[60px] w-full items-center gap-3 px-6 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                              {body}
                              <ChevronRight size={14} className="shrink-0 text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
                            </button>
                          ) : (
                            // nothing to drill into: a failed scan, or no week before it to compare with
                            <div className="flex h-[60px] items-center gap-3 px-6 pr-[50px]">{body}</div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </section>

            {/* ---- one week: the Sync drawer's layout (Lost | Gained, the same rows) */}
            <section className="flex h-full w-1/2 min-w-0 flex-col" inert={drilled ? undefined : ''} aria-hidden={!drilled}>
              {dRow && dChanges && (
                <>
                  <header className="shrink-0 border-b border-line px-6">
                    <button type="button" data-back onClick={back}
                      className="mt-3 inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
                      <ArrowLeft size={14} aria-hidden />All weeks
                    </button>
                    <h2 className="mt-2 text-[20px] leading-7 font-semibold text-stone-900">Changes on {dRow.week.label}</h2>
                    <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600 tabular-nums">
                      {sel.label} · compared with {rows[dRow.index + 1]?.week.label} · {brand.name}
                    </p>
                    <ChangeTabs tab={tab} counts={counts} onChange={(id) => set({ tab: id })} />
                  </header>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <ChangeRows key={`${metric}|${tab}`} items={dChanges[tab]} onOpen={openPrompt}
                      empty={`No ${noun}s ${tab} on ${engine === 'all' ? 'any engine' : engineName(engine)} this week`} />
                  </div>
                </>
              )}
            </section>
          </div>
        </div>

        <footer className={`flex shrink-0 items-center justify-between gap-3 border-t border-line px-4 pt-3 text-[13px] leading-[18px] text-stone-600 md:px-6 ${SHEET_FOOTER_PAD}`}>
          <span className="min-w-0 truncate tabular-nums">
            {drilled
              ? `${plural(counts[tab], noun)} ${tab} since ${rows[dRow.index + 1]?.week.label}`
              : `${plural(rows.length, 'week')} · ${engineLabel} · updated ${short(fmtDay(tracking.schedule.lastSync))}`}
          </span>
          {!loading && !empty && (
            <button type="button" onClick={exportCsv} className="shrink-0 rounded font-medium text-stone-700 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">Export CSV</button>
          )}
        </footer>
        <div className="sr-only" aria-live="polite">{loading ? '' : drilled ? `${plural(counts[tab], noun)} ${tab}` : `${sel.label} selected`}</div>
      </div>
      <Tip tip={tip} />
    </div>
  )
}
