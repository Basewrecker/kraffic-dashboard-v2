import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ChevronRight, X } from 'lucide-react'
import SheetHandle, { SHEET_BASE, SHEET_FOOTER_PAD, SHEET_IN, SHEET_OUT } from '../ui/SheetHandle'
import Insight, { hlOpacity, useExplain } from '../ui/Insight'
import { Favicon } from '../dashboard/overlays'
import { ChangeRows, ChangeTabs, EngineChips } from './ChangeParts'
import { openAnswer } from './AnswerDrawer'
import { download } from './EngineDrawer'
import { ENGINES, ENGINE_ORDER, OWN, TRACKED_BRANDS, brandByDomain, engineName } from '../../data/brandViews'
import { METRICS, brandEngines, citationWeeks, historyMock, weekChanges, weekInsight, weekRows, weekSummary } from '../../data/citationHistory'
import { useBrandView } from '../../hooks/useBrandView'
import { fmtDay, useTracking } from '../../store/trackingSettings'

// Citations and Mentions → "Mentions and citations": the card's numbers week by week, in the drawer family (same
// shell, width, header and footer as the Sync drawer). Text tabs pick the metric; a 10-week column chart and an
// insight line sit under them; the weeks below (grouped by month) say what happened in plain words; a week drills in
// (same drawer, slides across) to the Sync drawer's own Lost | Gained list for that week. Esc goes back, then closes.
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
const startOf = (label) => label.split(' – ')[0] // "Oct 5 – 11" → "Oct 5"

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
// centred over its point, but kept 8px inside the window (the newest bar sits at the drawer's right edge)
function Tip({ tip }) {
  const ref = useRef(null)
  const [left, setLeft] = useState(null)
  useLayoutEffect(() => {
    if (!tip || !ref.current) return
    const w = ref.current.offsetWidth
    setLeft(Math.min(Math.max(8, tip.x - w / 2), window.innerWidth - w - 8))
  }, [tip])
  if (!tip) return null
  return createPortal(
    <span ref={ref} role="tooltip" style={{ left: left ?? tip.x, top: tip.y - 8, visibility: left == null ? 'hidden' : undefined }}
      className="pointer-events-none fixed z-[70] -translate-y-full whitespace-nowrap rounded-md border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 text-stone-700 shadow-sm tabular-nums">
      {tip.lines.map((l, i) => <span key={i} className={`block ${i ? 'text-stone-500' : 'font-medium text-stone-900'}`}>{l}</span>)}
    </span>,
    document.body,
  )
}

// gridline step: 3 levels that cover the tallest bar, on round whole numbers (1, 2, 2.5, 3, 4, 5 × 10ⁿ)
function niceStep(max) {
  const x = Math.max(1, max / 3)
  const pow = 10 ** Math.floor(Math.log10(x))
  return [1, 2, 2.5, 3, 4, 5, 10].map((m) => m * pow).find((s) => s >= x && Number.isInteger(s)) ?? Math.ceil(x)
}

// ---- the hero chart: the selected metric over the weeks, oldest → newest. Bars are the line-strong token, the newest
// week and the hovered bar ink; a failed week is a hatched stub at the baseline ("No data", never 0). Compare adds a
// thin t3 marker per bar at the competitor's value (same scale). Heights animate (300ms) when the metric changes.
const BAR_H = 112 // plot height; + 8 top room + 20 for the week labels = 140
function WeekChart({ rows, vsRows, metric, rival, changes, explain, onTip, onPick }) {
  const [hover, setHover] = useState(null)
  const order = rows.map((r, i) => ({ r, i })).reverse() // oldest left, newest right
  const vals = rows.map((r) => r.totals[metric])
  const vs = vsRows?.map((r) => r.totals[metric]) ?? null
  const max = Math.max(1, ...vals.filter((v) => v != null), ...(vs ?? []).filter((v) => v != null))
  const step = niceStep(max)
  const top = step * 3
  const pct = (v) => `${(v / top) * 100}%`
  const label = METRICS.find((m) => m.id === metric).label.toLowerCase()

  const tipFor = (i, el) => {
    const r = rows[i]
    const v = r.totals[metric]
    const c = changes[i]
    const box = el.getBoundingClientRect()
    const lines = v == null
      ? [`${r.week.label} · No data`, 'Scan didn’t complete this week']
      : [
          `${r.week.label} · ${v} ${label}`,
          r.delta[metric] == null ? 'Nothing to compare with the week before' : r.delta[metric] === 0 ? 'No change on the week before' : `${fmtDelta(r.delta[metric])} on the week before`,
          ...(c && (c.gained.length || c.lost.length) ? [`+${c.gained.length} gained · ${c.lost.length} dropped`] : []),
        ]
    if (vs) lines.push(`${rival.name} ${vs[i] ?? 'no data'}`)
    onTip({ x: box.left + box.width / 2, y: box.top, lines })
  }

  return (
    <div className="mt-5 grid grid-cols-[auto_1fr] gap-x-2" onMouseLeave={() => { setHover(null); onTip(null) }}>
      {/* y axis: 0 and three levels */}
      <div className="relative mt-2 w-7 text-right text-[11px] leading-none text-stone-500 tabular-nums" style={{ height: BAR_H }} aria-hidden>
        {[0, 1, 2, 3].map((k) => <span key={k} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(k / 3) * 100}%` }}>{k * step}</span>)}
      </div>
      <div className="relative mt-2" style={{ height: BAR_H }}>
        {[1, 2, 3].map((k) => <span key={k} className="absolute inset-x-0 h-px bg-[var(--div)]" style={{ bottom: `${(k / 3) * 100}%` }} aria-hidden />)}
        <span className="absolute inset-x-0 bottom-0 h-px bg-[var(--color-line)]" aria-hidden />
        <div className="absolute inset-0 flex" role="group" aria-label={`${METRICS.find((m) => m.id === metric).label} by week`}>
          {order.map(({ r, i }) => {
            const v = vals[i]
            const on = hover === i || (hover == null && i === 0)
            const dim = hlOpacity(explain, `bar:${i}`)
            return (
              <button key={r.week.id} type="button" tabIndex={-1}
                aria-label={`${r.week.label}: ${v ?? 'no data'}. Show this week`}
                onClick={() => onPick(i)}
                onMouseEnter={(e) => { setHover(i); tipFor(i, e.currentTarget.querySelector('[data-bar]')) }}
                className="relative flex h-full min-w-0 flex-1 cursor-pointer items-end justify-center outline-none">
                {v == null ? (
                  <span data-bar className="h-3 w-[56%] max-w-9 rounded-t-[3px] transition-opacity duration-150"
                    style={{ opacity: dim ?? 1, backgroundImage: `repeating-linear-gradient(135deg, ${hover === i ? 'var(--color-stone-500)' : 'var(--color-line-strong)'} 0 1.5px, transparent 1.5px 4.5px)`, boxShadow: `inset 0 1px 0 ${hover === i ? 'var(--color-stone-500)' : 'var(--color-line-strong)'}` }} />
                ) : (
                  <span data-bar className={`w-[56%] max-w-9 rounded-t-[3px] transition-[height,background-color,opacity] duration-300 ease-out motion-reduce:transition-none ${on ? 'bg-ink' : 'bg-[var(--color-line-strong)]'}`}
                    style={{ height: pct(v), minHeight: v > 0 ? 2 : 0, opacity: dim ?? 1 }} />
                )}
                {vs?.[i] != null && (
                  <span className="pointer-events-none absolute left-1/2 h-0.5 w-[72%] max-w-11 -translate-x-1/2 translate-y-1/2 rounded-full bg-stone-500 transition-[bottom] duration-300 ease-out motion-reduce:transition-none"
                    style={{ bottom: pct(vs[i]) }} aria-hidden />
                )}
              </button>
            )
          })}
        </div>
      </div>
      {/* week labels under every other bar (the newest always labelled) */}
      <span aria-hidden />
      <div className="flex h-5 items-end" aria-hidden>
        {order.map(({ r, i }) => (
          <span key={r.week.id} className="relative flex min-w-0 flex-1 justify-center">
            {i % 2 === 0 && <span className="whitespace-nowrap text-[11px] leading-none text-stone-500 tabular-nums">{startOf(r.week.label)}</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

function Delta({ d, className = 'text-[12px] leading-4' }) {
  if (d == null || d === 0) return null
  return <span className={`${className} font-medium tabular-nums ${d > 0 ? 'text-stone-600' : 'text-negative'}`}>{fmtDelta(d)}</span>
}

// a week's gained / dropped, diverging from a centre tick: gained right in ink, dropped left in the negative token,
// widths in proportion to the biggest count in the period. Nothing known (failed / first week): the space only.
// Hidden on phones, where the summary needs the room (the change is in the number column).
function Diverge({ c, scale }) {
  return (
    <span className="relative hidden h-3 w-20 shrink-0 sm:block" aria-hidden>
      {c && (
        <>
          <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-[var(--color-line-strong)]" />
          {c.lost.length > 0 && <span className="absolute right-1/2 top-1/2 h-1 -translate-y-1/2 rounded-l-full bg-negative" style={{ width: `calc(${(c.lost.length / scale) * 50}% - 1px)`, marginRight: 1 }} />}
          {c.gained.length > 0 && <span className="absolute left-1/2 top-1/2 h-1 -translate-y-1/2 rounded-r-full bg-ink" style={{ width: `calc(${(c.gained.length / scale) * 50}% - 1px)`, marginLeft: 1 }} />}
        </>
      )}
    </span>
  )
}

const bar = 'rounded bg-tint motion-safe:animate-pulse'
function SkeletonHead() {
  return (
    <div role="status" aria-label="Loading">
      <div className="mt-5 flex gap-8 border-b border-[var(--div)] pb-3">
        {[0, 1, 2].map((i) => <div key={i}><div className={`${bar} h-3 w-16`} /><div className={`${bar} mt-2 h-7 w-20`} /></div>)}
      </div>
      <div className={`${bar} mt-5 h-[140px] w-full`} />
      <div className={`${bar} mb-4 mt-5 h-4 w-72 max-w-full`} />
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
  // the insight's "Why?" highlights its weeks in the chart; it resets when what the chart shows changes
  const explain = useExplain(`${open}|${domain}|${metric}|${engine}|${rival?.key}`)

  const rows = useMemo(() => (open ? weekRows(domain, engine, enabled, mock === 'empty' ? 1 : WEEKS) : []), [open, domain, engine, enabled.join(), mock]) // eslint-disable-line react-hooks/exhaustive-deps
  const vsRows = useMemo(() => (open && rival ? weekRows(rival.domain, engine, enabled, WEEKS) : null), [open, rival, engine, enabled.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const syncs = open ? citationWeeks(domain).syncs : []
  const changesOf = useCallback((r, m) => weekChanges({ domain, metric: m, row: r, engine, sync: syncs[r.index] }), [domain, engine, syncs])
  const changes = useMemo(() => rows.map((r) => changesOf(r, metric)), [rows, metric, changesOf])

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
  const drill = (i) => { setTip(null); explain.off(); set({ week: i, tab: 'lost' }); focusIn('[data-back]') }
  const back = () => { const i = state.week; set({ week: null }); focusIn(`[data-week="${i}"]`) }

  // a bar in the chart → its week's row: scrolled into view, then a tint that fades out over 1.5s
  const pick = (i) => {
    setTip(null)
    const li = explain.cardRef.current?.querySelector(`[data-row="${i}"]`)
    if (!li) return
    li.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' })
    li.querySelector('[data-nav]')?.focus({ preventScroll: true })
    li.getAnimations().forEach((a) => a.cancel())
    li.animate(
      [{ backgroundColor: 'var(--tint)' }, { backgroundColor: 'var(--tint)', offset: 0.25 }, { backgroundColor: 'transparent' }],
      { duration: 2000, easing: reduced() ? 'steps(1, end)' : 'ease-out' },
    )
  }

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
    if (e.key === 'Escape') {
      e.preventDefault()
      if (explain.on) explain.off() // the insight's explanation first, then the drill-in, then the drawer
      else if (drilled) back()
      else close()
      return
    }
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
  // the metric tabs: a tablist, arrows move and pick
  const onMetricKey = (e) => {
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
  const noun = metric === 'pages' ? 'page' : 'prompt'
  const counts = { lost: dChanges?.lost.length ?? 0, gained: dChanges?.gained.length ?? 0 }
  const engineLabel = engine === 'all' ? 'All engines' : engineName(engine)
  const insight = empty || loading ? null : weekInsight({ metric, rows, changes, you: brand.you, name: brand.name })
  // the period's biggest gain and biggest drop get a quiet note on their row
  const deltas = rows.map((r) => r.delta[metric])
  const best = Math.max(...deltas.filter((d) => d != null))
  const worst = Math.min(...deltas.filter((d) => d != null))
  const bestAt = best > 0 ? deltas.indexOf(best) : -1
  const worstAt = worst < 0 ? deltas.indexOf(worst) : -1
  const scale = Math.max(1, ...changes.map((c) => (c ? Math.max(c.gained.length, c.lost.length) : 0)))
  // weeks grouped by the month they start in, newest first
  const months = []
  rows.forEach((r, i) => {
    if (months.at(-1)?.month !== r.week.month) months.push({ month: r.week.month, items: [] })
    months.at(-1).items.push(i)
  })

  const exportCsv = () => {
    if (drilled) {
      download(`${brand.key}-${metric}-${dRow.week.label.replace(/\W+/g, '-').toLowerCase()}-${tab}.csv`, [[metric === 'pages' ? 'Page' : 'Prompt', 'What happened'], ...dChanges[tab].map((x) => [x.prompt, x.meta])])
    } else {
      download(`${brand.key}-weekly-citations.csv`, [['Week', ...METRICS.map((m) => m.label), ...(rival ? [`${rival.name} ${sel.label.toLowerCase()}`] : [])],
        ...rows.map((r, i) => [r.week.label, ...METRICS.map((m) => r.totals[m.id] ?? ''), ...(rival ? [vsRows?.[i]?.totals[metric] ?? ''] : [])])])
    }
  }

  const row = (i) => {
    const r = rows[i]
    const v = r.totals[metric]
    const c = changes[i]
    const summary = weekSummary({ metric, row: r, changes: c, you: brand.you, name: brand.name })
    const note = i === bestAt ? 'best week' : i === worstAt ? 'biggest drop' : null
    const vs = vsRows?.[i]?.totals[metric]
    const body = (
      <>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] leading-5 font-medium text-stone-900 tabular-nums">{r.week.label}</span>
          <span className="flex min-w-0 text-[12.5px] leading-[18px]">
            <span className={`truncate ${r.totals.failed.length ? 'text-stone-500' : 'text-stone-600'}`}>{summary}</span>
            {note && <span className="shrink-0 whitespace-pre text-stone-500"> · {note}</span>}
          </span>
        </span>
        <Diverge c={c} scale={scale} />
        <span className="flex shrink-0 items-baseline gap-1.5">
          <span className={`w-9 text-right text-[14px] leading-5 tabular-nums ${v == null ? 'text-stone-500' : 'font-semibold text-ink'}`}>{v ?? '—'}</span>
          <span className="w-8"><Delta d={r.delta[metric]} /></span>
          {rival && <span className="w-14 text-right text-[12px] leading-4 text-stone-500 tabular-nums">vs {vs ?? '—'}</span>}
        </span>
        {/* the chevron column is always there, so every row's right edge lines up */}
        <span className="w-3.5 shrink-0" aria-hidden>
          {c && <ChevronRight size={14} className="text-stone-500 transition-colors group-hover:text-stone-900" />}
        </span>
      </>
    )
    return (
      <li key={r.week.id} data-row={i}>
        {c ? (
          <button type="button" data-nav data-week={i} onClick={() => drill(i)}
            aria-label={`${r.week.label}: ${sel.label.toLowerCase()} ${v}${r.delta[metric] ? ` (${fmtDelta(r.delta[metric])})` : ''}. ${summary}${note ? `. ${note}` : ''}`}
            className="group flex h-[60px] w-full items-center gap-3 px-6 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
            {body}
          </button>
        ) : (
          // nothing to drill into: a failed scan, or no week before it to compare with
          <div className="flex h-[60px] items-center gap-3 px-6">{body}</div>
        )}
      </li>
    )
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
            {/* ---- all weeks: the header (tabs, chart, insight, compare) scrolls with the weeks */}
            <section className="flex h-full w-1/2 min-w-0 flex-col" inert={drilled ? '' : undefined} aria-hidden={drilled}>
              <div ref={explain.cardRef} className="min-h-0 flex-1 overflow-y-auto" onScroll={() => tip && setTip(null)}>
                <header className="border-b border-line px-6">
                  <h2 className="mt-3 text-[20px] leading-7 font-semibold text-stone-900">Mentions and citations</h2>
                  <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600 tabular-nums">{brand.name} · 152 prompts · last {plural(rows.length, 'week')}</p>
                  {loading ? <SkeletonHead /> : empty ? <div className="pb-4" /> : (
                    <>
                      {/* the metric: text tabs, the big number + change under each label; the selected one ink with
                          the standard 2px underline (Lost | Gained's), the others t3 */}
                      <div role="tablist" aria-label="Metric" onKeyDown={onMetricKey} className="mt-5 flex gap-8 border-b border-[var(--div)]">
                        {METRICS.map((m) => {
                          const on = m.id === metric
                          const r0 = rows[0]
                          return (
                            <button key={m.id} data-metric={m.id} type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1} onClick={() => set({ metric: m.id })}
                              aria-label={`${m.label} ${r0.totals[m.id] ?? 'not known'}${r0.delta[m.id] ? `, ${fmtDelta(r0.delta[m.id])} vs last week` : ''}`}
                              className={`group -mb-px min-w-0 border-b-2 pb-3 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'border-ink' : 'border-transparent'}`}>
                              <span className={`block text-[13px] leading-[18px] font-medium transition-colors duration-150 ${on ? 'text-stone-900' : 'text-stone-500 group-hover:text-stone-900'}`}>{m.label}</span>
                              <span className="mt-1 flex items-baseline gap-1.5">
                                <span className={`text-[24px] leading-8 font-semibold tabular-nums transition-colors duration-150 ${on ? 'text-ink' : 'text-stone-500 group-hover:text-stone-900'}`}>{r0.totals[m.id] ?? '—'}</span>
                                <Delta d={r0.delta[m.id]} />
                              </span>
                            </button>
                          )
                        })}
                      </div>

                      <WeekChart rows={rows} vsRows={vsRows} metric={metric} rival={rival} changes={changes} explain={explain} onTip={setTip} onPick={pick} />

                      {insight && (
                        <div className="mt-3">
                          <Insight explain={explain} text={`${insight.text}.`}
                            evidence={{
                              keys: insight.keys.map((i) => `bar:${i}`),
                              calc: insight.calc,
                              source: `(${short(fmtDay(tracking.schedule.lastSync))} update)`,
                              ...(changes[0] ? { action: { label: 'See the week', onClick: () => drill(0) } } : {}),
                            }} />
                        </div>
                      )}

                      {/* compare: one competitor at a time (Visibility history's brand chips, with the real logos) */}
                      <div className="mt-4 flex min-w-0 items-center gap-1.5 overflow-x-auto pb-4 [scrollbar-width:none]">
                        <span className="mr-1 shrink-0 text-[13px] leading-[18px] text-stone-500">Compare with</span>
                        {rivals.map((b) => {
                          const on = rival?.key === b.key
                          return (
                            <button key={b.key} type="button" aria-pressed={on} onClick={() => set({ vs: on ? null : b.key })}
                              className={`inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full pl-1.5 pr-3 text-[13px] leading-[18px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'bg-tint font-medium text-stone-900' : 'text-stone-600 hover:bg-tint hover:text-stone-900'}`}>
                              <Favicon domain={b.domain} size={20} />{b.name}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </header>
                {loading ? <SkeletonRows /> : empty ? (
                  <p className="px-6 py-12 text-center text-[14px] leading-5 text-stone-600">History appears after your second weekly scan.</p>
                ) : (
                  // the week summaries cross-fade when the metric changes
                  <div key={`${metric}|${engine}`} className="motion-safe:animate-[fade-in_150ms_ease-out]" aria-label={`${sel.label} by week`} role="list">
                    {months.map((g) => (
                      <div key={g.month} role="listitem">
                        <h3 className="sticky top-0 z-[1] border-b border-[var(--div)] bg-surface px-6 pb-1.5 pt-4 text-[13px] leading-[18px] font-medium text-stone-500">{g.month}</h3>
                        <ul className="divide-y divide-[var(--div)]" aria-label={g.month}>{g.items.map(row)}</ul>
                      </div>
                    ))}
                  </div>
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
