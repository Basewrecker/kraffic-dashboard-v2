import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, ChevronRight, X } from 'lucide-react'
import SheetHandle, { SHEET_BASE, SHEET_FOOTER_PAD, SHEET_IN, SHEET_OUT } from '../ui/SheetHandle'
import Insight, { useExplain } from '../ui/Insight'
import { Favicon } from '../dashboard/overlays'
import { ChangeRows, ChangeTabs, EngineChips } from './ChangeParts'
import { openAnswer } from './AnswerDrawer'
import { download } from './EngineDrawer'
import { ENGINES, ENGINE_ORDER, OWN, brandByDomain, engineName } from '../../data/brandViews'
import { useBrandView } from '../../hooks/useBrandView'
import { fmtDay, useTracking } from '../../store/trackingSettings'
import { useIsMobile } from '../../hooks/useMedia'
import { chart } from '../../theme/chart'

// The week-by-week drawer, shared by Mentions and citations (CitationsDrawer) and Marketplace visibility
// (MarketplaceDrawer): the drawer family's shell (Sync drawer width, header, footer), text tabs for the metric, a
// 10-week line chart and an insight line, Compare with, the weeks grouped by month, and a week's drill-in (slides
// across) to its Lost | Gained rows. Esc goes back, then closes. What it shows comes from `source`:
//   event, key (?drawer=<key>), title, metrics [{ id, label, pct? }], defaultMetric, csvName, emptyText(rows, brand)
//   rows({ domain, engine, enabled, mock }) · vsRows({ rival, engine, enabled, mock }) · engines(domain) · rivals(domain)
//   changes({ domain, metric, row, engine, mock }) · summary({ metric, row, changes, you, name }) · insight({ … rows, changes })
//   mock() · load(domain) · noun(metric) · brandOf(key) (?drawerBrand=) · defaultDomain(page) · answerDate(domain, row)
//   (rows open the Answer drawer when set) · off() (the feature isn't switched on: a lock message instead)
// URL (replaceState while open, pushed on open so Back closes):
//   ?drawer=<key>&metric=<id>[&drawerBrand=<key>][&vs=<key>][&week=<index>&tab=lost|gained][&drawerEngine=]
import { Lock } from 'lucide-react'

export const WEEKS = 10
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const fmtDelta = (d, m) => `${d > 0 ? '+' : '−'}${m?.pct ? `${Math.abs(d).toFixed(1)} pts` : Math.abs(d)}`
const fmtVal = (v, m) => (v == null ? '—' : m?.pct ? `${v.toFixed(1)}%` : v)
const short = (d) => d.replace(/, \d{4}$/, '')
const startOf = (label) => label.split(' – ')[0] // "Oct 5 – 11" → "Oct 5"

function readUrl(source) {
  const q = new URLSearchParams(window.location.search)
  if (q.get('drawer') !== source.key) return null
  const week = q.get('week')
  return {
    metric: source.metrics.some((m) => m.id === q.get('metric')) ? q.get('metric') : source.defaultMetric,
    brand: source.brandOf(q.get('drawerBrand')),
    vs: source.vsKeys.includes(q.get('vs')) ? q.get('vs') : null,
    week: week != null && /^\d+$/.test(week) ? Number(week) : null,
    tab: q.get('tab') === 'gained' ? 'gained' : 'lost',
    engine: q.get('drawerEngine') ?? null,
  }
}
function urlFor(source, s, focal) {
  const url = new URL(window.location.href)
  for (const k of ['drawer', 'metric', 'drawerBrand', 'vs', 'week', 'tab', 'drawerEngine']) url.searchParams.delete(k)
  if (s) {
    url.searchParams.set('drawer', source.key); url.searchParams.set('metric', s.metric)
    if (s.brand && s.brand !== focal) url.searchParams.set('drawerBrand', brandByDomain(s.brand).key)
    if (s.vs) url.searchParams.set('vs', s.vs)
    if (s.week != null) { url.searchParams.set('week', s.week); url.searchParams.set('tab', s.tab) }
    if (s.engine && s.engine !== 'all') url.searchParams.set('drawerEngine', s.engine)
  }
  return url
}

// ---- the hero chart: the selected metric over the weeks, oldest → newest, in Visibility history's line style
// (2.5px monotone line, track gridlines, 13px stone-500 ticks, hover guide in c3, the same tooltip box). Ink for the
// brand; Compare adds the competitor as a second line in t3. The newest week is a filled ink dot with its value. A
// failed week breaks the line: a dashed t3 bridge across the gap and a hollow marker ("No data", never 0). The y axis
// fits the data with ~10% padding on 3 round gridlines. Switching metric morphs the line (300ms).
const tick = { fontSize: 13, fontWeight: 400, fill: 'var(--color-stone-500)', className: 'num' }
const INK = 'var(--ink)'
const T3 = 'var(--color-stone-500)'
const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8]
function yScale(values) {
  const v = values.filter((x) => x != null)
  if (!v.length) return { domain: [0, 2], ticks: [0, 1, 2] }
  const lo0 = Math.min(...v), hi0 = Math.max(...v)
  const pad = Math.max((hi0 - lo0) * 0.1, 1)
  const lo = Math.max(0, lo0 - pad), hi = hi0 + pad
  for (let p = 1; p < 1e7; p *= 10) {
    for (const m of NICE) {
      const step = m * p
      if (!Number.isInteger(step) || step * 2 < hi - lo) continue
      const start = Math.floor(lo / step) * step
      if (start + 2 * step >= hi) return { domain: [start, start + 2 * step], ticks: [start, start + step, start + 2 * step] }
    }
  }
  return { domain: [0, hi], ticks: [0, hi / 2, hi] }
}

// oldest → newest points: { label, i (row index), v, vs, gap0…: the dashed bridges over failed weeks, failed }
function chartPoints(rows, vsRows, metric) {
  const pts = [...rows].reverse().map((r) => ({ label: startOf(r.week.label), i: r.index, v: r.totals[metric], vs: vsRows?.[r.index]?.totals[metric] ?? null, failed: r.totals[metric] == null }))
  const gaps = []
  for (let k = 0; k < pts.length; k++) {
    if (!pts[k].failed) continue
    let m = k
    while (pts[m + 1]?.failed) m++
    gaps.push([k, m])
    k = m
  }
  gaps.forEach(([k, m], g) => {
    const key = `gap${g}`
    const a = pts[k - 1]?.v, b = pts[m + 1]?.v
    if (a != null) pts[k - 1][key] = a
    if (b != null) pts[m + 1][key] = b
    for (let j = k; j <= m; j++) {
      // the hollow marker sits on the bridge (interpolated), or level with the one neighbour at an end
      pts[j][key] = a != null && b != null ? a + ((b - a) * (j - k + 1)) / (m - k + 2) : (a ?? b ?? null)
    }
  })
  return { pts, gapKeys: gaps.map((_, g) => `gap${g}`) }
}

function WeekTip({ active, payload, rows, metric, metrics, rival, changes }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  if (p.pad) return null
  const r = rows[p.i]
  const v = r.totals[metric]
  const c = changes[p.i]
  const d = r.delta[metric]
  const m = metrics.find((x) => x.id === metric)
  const label = m.label
  return (
    <div className="rounded-lg border border-stone-200 bg-raised px-3 py-2 text-small shadow-sm">
      <div className="mb-1 font-semibold text-stone-900">{r.week.label}</div>
      {v == null ? (
        <div className="text-stone-600">No data · the scan didn’t complete</div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-6">
            <span className="inline-flex items-center gap-1.5 font-medium text-stone-900"><span className="h-2 w-2 rounded-[2px] bg-ink" />{label}</span>
            <span className="num font-semibold text-stone-900">{fmtVal(v, m)}</span>
          </div>
          {rival && (
            <div className="flex items-center justify-between gap-6">
              <span className="inline-flex items-center gap-1.5 text-stone-600"><span className="h-2 w-2 rounded-[2px] bg-stone-500" />{rival.name}</span>
              <span className="num text-stone-900">{fmtVal(p.vs, m)}</span>
            </div>
          )}
          {d != null && (
            <div className="mt-1 flex justify-between gap-6 border-t border-stone-100 pt-1 text-stone-600">
              <span>{r.skipped ? `vs ${r.prevWeek.label}` : 'vs last week'}</span>
              <span className={`num font-semibold ${d < 0 ? 'text-negative' : 'text-stone-900'}`}>{d === 0 ? '0' : fmtDelta(d, m)}</span>
            </div>
          )}
          {c && (c.gained.length > 0 || c.lost.length > 0) && <div className="num text-stone-600">+{c.gained.length} gained · {c.lost.length} dropped</div>}
        </>
      )}
    </div>
  )
}

// a short history (under 6 weeks) keeps 6 week slots: the weeks so far sit on the right, the empty slots on the left
// have no line and no ticks, so 2–3 points never stretch across the chart like a long trend
const MIN_SLOTS = 6
function WeekChart({ rows, vsRows, metric, metrics, rival, changes, explain, onPick }) {
  const mobile = useIsMobile()
  const built = chartPoints(rows, vsRows, metric)
  const pad = Math.max(0, MIN_SLOTS - built.pts.length)
  const pts = [...Array.from({ length: pad }, (_, k) => ({ label: `pad${k}`, pad: true, v: null, vs: null, failed: false })), ...built.pts]
  const { gapKeys } = built
  // a short history starts the axis at 0: a few weeks of small moves shouldn't read as a big swing
  const { domain, ticks } = yScale([...pts.map((p) => p.v), ...(vsRows ? pts.map((p) => p.vs) : []), ...(pad ? [0] : [])])
  const m = metrics.find((x) => x.id === metric)
  const last = pts.length - 1
  const anim = { animationDuration: 300, animationEasing: 'ease-out', isAnimationActive: !reduced() }
  const explaining = explain.on
  const lit = (i) => explain.keys.includes(`week:${i}`)
  const dot = (p) => {
    const pt = pts[p.index]
    if (pt.v == null || p.cy == null) return <g key={`d${p.index}`} />
    if (p.index === last) {
      return (
        <g key={`d${p.index}`}>
          <circle cx={p.cx} cy={p.cy} r={4} fill={INK} stroke="var(--color-surface)" strokeWidth={2} />
          <text x={p.cx} y={p.cy - 11} textAnchor="middle" fontSize={12} fontWeight={600} fill={INK} className="num">{fmtVal(pt.v, m)}</text>
        </g>
      )
    }
    if (explaining && lit(pt.i)) return <circle key={`d${p.index}`} cx={p.cx} cy={p.cy} r={4} fill={INK} stroke="var(--color-surface)" strokeWidth={2} />
    return <g key={`d${p.index}`} />
  }
  const hollow = (key) => (p) => (pts[p.index]?.failed && p.cy != null
    ? <circle key={`${key}${p.index}`} cx={p.cx} cy={p.cy} r={4} fill="var(--color-surface)" stroke={T3} strokeWidth={1.5} />
    : <g key={`${key}${p.index}`} />)
  return (
    <div className="mt-4 h-[168px] cursor-pointer" aria-label={`${m.label} by week`} role="group">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts} margin={{ top: 22, right: 8, bottom: 0, left: 0 }}
          onClick={(s) => { const k = s?.activeTooltipIndex; if (k != null && pts[Number(k)] && !pts[Number(k)].pad) onPick(pts[Number(k)].i) }}>
          <CartesianGrid vertical={false} stroke={chart.track} strokeWidth={1} />
          <XAxis dataKey="label" tickMargin={12} tickLine={false} axisLine={false} tick={tick} padding={{ left: 16, right: 16 }} interval={0}
            tickFormatter={(v, k) => (pts[k]?.pad || (last - k) % 2 ? '' : v)} />
          <YAxis width={36} tickMargin={mobile ? 4 : 8} domain={domain} ticks={ticks} tickLine={false} axisLine={false} tick={tick} tickFormatter={m.pct ? (v) => `${v}%` : undefined} />
          <Tooltip cursor={{ stroke: chart.c3, strokeWidth: 1 }} content={<WeekTip rows={rows} metric={metric} metrics={metrics} rival={rival} changes={changes} />} />
          {vsRows && (
            <Line dataKey="vs" type="monotone" stroke={T3} strokeWidth={1.5} strokeLinecap="round" dot={false}
              activeDot={{ r: 4, fill: T3, stroke: 'var(--color-surface)', strokeWidth: 2 }} {...anim} />
          )}
          {gapKeys.map((k) => (
            <Line key={k} dataKey={k} type="linear" connectNulls stroke={T3} strokeWidth={1.5} strokeDasharray="3 4" dot={hollow(k)} activeDot={false} legendType="none" tooltipType="none" {...anim} />
          ))}
          <Line dataKey="v" type="monotone" stroke={INK} strokeOpacity={explaining ? 0.35 : 1} strokeWidth={2.5} strokeLinecap="round" connectNulls={false}
            dot={dot} activeDot={{ r: 5, fill: INK, stroke: 'var(--color-surface)', strokeWidth: 2 }} {...anim} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function Delta({ d, m, className = 'text-[12px] leading-4' }) {
  if (d == null || d === 0) return null
  // a share's change: "+1.9 pts" (phones: "+1.9", the tab row needs the room)
  return (
    <span className={`${className} whitespace-nowrap font-medium tabular-nums ${d > 0 ? 'text-stone-600' : 'text-negative'}`}>
      {m?.pct ? <>{fmtDelta(d)}<span className="max-sm:hidden"> pts</span></> : fmtDelta(d, m)}
    </span>
  )
}

// a week's gained / dropped: 120px, a 1px centre line in the border token; gained runs right in ink, dropped left in
// the negative token, both 4px tall with rounded ends, scaled to the largest count in the visible weeks (a non-zero
// count is at least 3px). Nothing known (failed / first week): the space only.
// Hidden on phones, where the summary needs the room (the change is in the number column).
const HALF = 59 // px each side of the centre line
const barPx = (n, scale) => (n > 0 ? Math.max(3, Math.round((n / scale) * HALF)) : 0)
function Diverge({ c, scale }) {
  return (
    <span className="relative hidden h-3 w-[120px] shrink-0 sm:block" aria-hidden>
      {c && (
        <>
          <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-[var(--color-line)]" />
          {c.lost.length > 0 && <span className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-negative" style={{ right: 'calc(50% + 1px)', width: barPx(c.lost.length, scale) }} />}
          {c.gained.length > 0 && <span className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-ink" style={{ left: 'calc(50% + 1px)', width: barPx(c.gained.length, scale) }} />}
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
      <div className={`${bar} mt-4 h-[168px] w-full`} />
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

export default function WeekHistoryDrawer({ source }) {
  const page = useBrandView()
  const tracking = useTracking()
  const [state, setState] = useState(() => readUrl(source)) // { metric, brand, vs, week, tab, engine }
  const [shown, setShown] = useState(false)
  const [loading, setLoading] = useState(true)
  const [swapped, setSwapped] = useState(false)
  const pushed = useRef(false)
  const panel = useRef(null)
  const opener = useRef(null)
  const lastRow = useRef(null)
  const panes = useRef(null)
  const mock = source.mock()
  const off = source.off?.() ?? false
  const METRICS = source.metrics

  const open = state != null
  const domain = state?.brand ?? source.defaultDomain?.(page) ?? page.focal.domain
  const brand = brandByDomain(domain) ?? OWN
  const shownEngines = source.engines(domain)
  const enabled = ENGINE_ORDER.filter((e) => tracking.platforms.some((p) => p.id === e && p.enabled))
  const engine = open && state.engine && shownEngines.includes(state.engine) ? state.engine : 'all'
  const metric = state?.metric ?? source.defaultMetric
  const sel = METRICS.find((m) => m.id === metric)
  const rivals = source.rivals(domain)
  const rival = state?.vs && state.vs !== brand.key ? rivals.find((b) => b.key === state.vs) ?? null : null
  // the insight's "Why?" highlights its weeks in the chart; it resets when what the chart shows changes
  const explain = useExplain(`${open}|${domain}|${metric}|${engine}|${rival?.key}`)

  // read again once the weeks have loaded (loading → false)
  const rows = useMemo(() => (open && !off ? source.rows({ domain, engine, enabled, mock }) : []), [open, off, loading, domain, engine, enabled.join(), mock, source]) // eslint-disable-line react-hooks/exhaustive-deps
  const vsRows = useMemo(() => (open && rival ? source.vsRows({ rival, engine, enabled, mock }) : null), [open, loading, rival, engine, enabled.join(), mock, source]) // eslint-disable-line react-hooks/exhaustive-deps
  const changesOf = useCallback((r, m) => source.changes({ domain, metric: m, row: r, engine, mock }), [domain, engine, mock, source])
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
      if (!readUrl(source)) { window.history.pushState(window.history.state, '', urlFor(source, next, page.focal.domain)); pushed.current = true }
      setState(next)
    }
    const pop = () => { pushed.current = false; setSwapped(false); setState(readUrl(source)) }
    window.addEventListener(source.event, on)
    window.addEventListener('popstate', pop)
    return () => { window.removeEventListener(source.event, on); window.removeEventListener('popstate', pop) }
  }, [page.engine, page.focal.domain, source])
  // only the open drawer writes the address (two drawers share the parameters)
  useEffect(() => { if (open || readUrl(source)) window.history.replaceState(window.history.state, '', urlFor(source, open && !swapped ? state : null, page.focal.domain)) }, [open, swapped, state, page.focal.domain, source])
  useLayoutEffect(() => {
    if (!open) { setShown(false); return }
    const r = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(r)
  }, [open])
  useEffect(() => { if (open && shown && !swapped) panel.current?.focus() }, [open, shown]) // eslint-disable-line react-hooks/exhaustive-deps
  // the weeks load each time the drawer opens (source.load); ?cmMock=loading / ?mktMock=loading holds the skeleton
  useEffect(() => {
    if (!open || !loading || mock === 'loading') return
    let alive = true
    source.load(domain).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [open, loading, mock, domain, source])

  const finish = useCallback(() => {
    if (pushed.current) { pushed.current = false; window.history.back() } else setState(null)
    setSwapped(false); setDrillKeep(null)
    opener.current?.focus?.()
  }, [])
  const close = useCallback(() => { setShown(false); setTimeout(finish, reduced() ? 0 : 200) }, [finish])
  const set = (patch) => setState((s) => ({ ...s, ...patch }))
  const focusIn = (q) => setTimeout(() => panel.current?.querySelector(q)?.focus({ preventScroll: true }), reduced() ? 0 : 260)
  const drill = (i) => { explain.off(); set({ week: i, tab: 'lost' }); focusIn('[data-back]') }
  const back = () => { const i = state.week; set({ week: null }); focusIn(`[data-week="${i}"]`) }

  // a bar in the chart → its week's row: scrolled into view, then a tint that fades out over 1.5s
  const pick = (i) => {
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
      key: it.key, engine: it.engine, date: source.answerDate(domain, dRow), brand: domain, list: list.map((x) => x.key),
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
  const emptyText = off ? null : source.emptyText(rows, brand)
  const empty = off || emptyText != null
  const noun = source.noun(metric)
  const counts = { lost: dChanges?.lost.length ?? 0, gained: dChanges?.gained.length ?? 0 }
  const engineLabel = engine === 'all' ? 'All engines' : engineName(engine)
  const insight = empty || loading ? null : source.insight({ metric, rows, changes, you: brand.you, name: brand.name })
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
      download(`${brand.key}-${source.csvName}.csv`, [['Week', ...METRICS.map((m) => m.label), ...(rival ? [`${rival.name} ${sel.label.toLowerCase()}`] : [])],
        ...rows.map((r, i) => [r.week.label, ...METRICS.map((m) => r.totals[m.id] ?? ''), ...(rival ? [vsRows?.[i]?.totals[metric] ?? ''] : [])])])
    }
  }

  const row = (i) => {
    const r = rows[i]
    const v = r.totals[metric]
    const c = changes[i]
    const summary = source.summary({ metric, row: r, changes: c, you: brand.you, name: brand.name })
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
          <span className={`${sel.pct ? 'w-12' : 'w-9'} text-right text-[14px] leading-5 tabular-nums ${v == null ? 'text-stone-500' : 'font-semibold text-ink'}`}>{fmtVal(v, sel)}</span>
          <span className={sel.pct ? 'w-14' : 'w-8'}><Delta d={r.delta[metric]} m={sel} /></span>
          {rival && <span className={`${sel.pct ? 'w-[72px]' : 'w-14'} text-right text-[12px] leading-4 text-stone-500 tabular-nums`}>vs {fmtVal(vs, sel)}</span>}
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
            aria-label={`${r.week.label}: ${sel.label.toLowerCase()} ${fmtVal(v, sel)}${r.delta[metric] ? ` (${fmtDelta(r.delta[metric], sel)})` : ''}. ${summary}${note ? `. ${note}` : ''}`}
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
        aria-label={drilled ? `Changes on ${dRow.week.label}` : source.title}
        tabIndex={-1}
        // phones: a full-screen sheet; md+: the drawers' 720px panel
        className={`${SHEET_BASE} max-md:!h-[100dvh] max-md:!rounded-none max-md:!border-t-0 md:w-[min(720px,100vw)] ${shown ? SHEET_IN : SHEET_OUT}`}
      >
        <SheetHandle panelRef={panel} onClose={close} />
        <div className="flex shrink-0 items-center justify-between gap-3 px-6 pt-5">
          {off ? <span /> : <EngineChips chips={chips} value={engine} onChange={(id) => set({ engine: id })} />}
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
              <div ref={explain.cardRef} className="min-h-0 flex-1 overflow-y-auto">
                <header className="border-b border-line px-6">
                  <h2 className="mt-3 text-[20px] leading-7 font-semibold text-stone-900">{source.title}</h2>
                  <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600 tabular-nums">{brand.name} · 152 prompts{off ? '' : ` · ${source.span?.(rows) ?? `last ${plural(rows.length, 'week')}`}`}</p>
                  {off ? <div className="pb-4" /> : loading ? <SkeletonHead /> : empty ? <div className="pb-4" /> : (
                    <>
                      {/* the metric: text tabs, the big number + change under each label; the selected one ink with
                          the standard 2px underline (Lost | Gained's), the others t3 */}
                      <div role="tablist" aria-label="Metric" onKeyDown={onMetricKey} className={`mt-5 flex border-b border-[var(--div)] ${METRICS.length > 3 ? 'gap-4 sm:gap-8' : 'gap-8'}`}>
                        {METRICS.map((m) => {
                          const on = m.id === metric
                          const r0 = rows[0]
                          return (
                            <button key={m.id} data-metric={m.id} type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1} onClick={() => set({ metric: m.id })}
                              aria-label={`${m.label} ${r0.totals[m.id] == null ? 'not known' : fmtVal(r0.totals[m.id], m)}${r0.delta[m.id] ? `, ${fmtDelta(r0.delta[m.id], m)} vs last week` : ''}`}
                              className={`group -mb-px min-w-0 border-b-2 pb-3 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'border-ink' : 'border-transparent'}`}>
                              <span className={`block whitespace-nowrap text-[13px] leading-[18px] font-medium transition-colors duration-150 ${on ? 'text-stone-900' : 'text-stone-500 group-hover:text-stone-900'}`}>{m.label}</span>
                              <span className="mt-1 flex items-baseline gap-1.5">
                                <span className={`${METRICS.length > 3 ? 'text-[20px] sm:text-[24px]' : 'text-[24px]'} leading-8 font-semibold tabular-nums transition-colors duration-150 ${on ? 'text-ink' : 'text-stone-500 group-hover:text-stone-900'}`}>{fmtVal(r0.totals[m.id], m)}</span>
                                <Delta d={r0.delta[m.id]} m={m} />
                              </span>
                            </button>
                          )
                        })}
                      </div>

                      <WeekChart rows={rows} vsRows={vsRows} metric={metric} metrics={METRICS} rival={rival} changes={changes} explain={explain} onPick={pick} />

                      {/* a short history says so, in plain words (no pill) */}
                      {source.note?.(rows) && <p className="mt-3 text-[13px] leading-[18px] text-stone-600">{source.note(rows)}</p>}

                      {insight && (
                        <div className="mt-3">
                          <Insight explain={explain} text={`${insight.text}.`}
                            evidence={{
                              keys: insight.keys.map((i) => `week:${i}`),
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
                {off ? (
                  <div className="flex flex-col items-center px-6 py-14 text-center">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-tint text-stone-700" aria-hidden><Lock size={18} /></span>
                    <p className="mt-4 text-[15px] leading-5 font-semibold text-stone-900">{source.offText.title}</p>
                    <p className="mt-1 max-w-[420px] text-[14px] leading-5 text-stone-600">{source.offText.text}</p>
                  </div>
                ) : loading ? <SkeletonRows /> : empty ? (
                  typeof emptyText === 'string'
                    ? <p className="px-6 py-12 text-center text-[14px] leading-5 text-stone-600">{emptyText}</p>
                    : (
                      <div className="flex flex-col items-center px-6 py-14 text-center">
                        {emptyText.icon && <span className="grid h-10 w-10 place-items-center rounded-xl bg-tint text-stone-500" aria-hidden><emptyText.icon size={18} /></span>}
                        <p className="mt-4 text-[15px] leading-5 font-semibold text-stone-900">{emptyText.title}</p>
                        <p className="mt-1 max-w-[420px] text-[14px] leading-5 text-stone-600">{emptyText.text}</p>
                      </div>
                    )
                ) : (
                  // the week summaries cross-fade when the metric changes
                  <div key={`${metric}|${engine}`} className="motion-safe:animate-[fade-in_150ms_ease-out]" aria-label={`${sel.label} by week`} role="list">
                    {months.map((g, gi) => (
                      <div key={g.month} role="listitem">
                        <h3 className={`sticky top-0 z-[1] bg-surface px-6 pb-1 pt-4 text-[12px] leading-4 font-medium text-stone-500 ${gi ? 'border-t border-[var(--div)]' : ''}`}>{g.month}</h3>
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
                      {sel.label} · compared with {dRow.prevWeek?.label} · {brand.name}
                    </p>
                    <ChangeTabs tab={tab} counts={counts} onChange={(id) => set({ tab: id })} />
                  </header>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <ChangeRows key={`${metric}|${tab}`} items={dChanges[tab]} onOpen={source.answerDate ? openPrompt : null}
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
              ? `${plural(counts[tab], noun)} ${tab} since ${dRow.prevWeek?.label}`
              : off ? source.offText.foot : `${plural(rows.length, 'week')} · ${engineLabel} · updated ${short(fmtDay(tracking.schedule.lastSync))}`}
          </span>
          {!loading && !empty && !off && (
            <button type="button" onClick={exportCsv} className="shrink-0 rounded font-medium text-stone-700 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">Export CSV</button>
          )}
        </footer>
        <div className="sr-only" aria-live="polite">{loading ? '' : drilled ? `${plural(counts[tab], noun)} ${tab}` : `${sel.label} selected`}</div>
      </div>
    </div>
  )
}
