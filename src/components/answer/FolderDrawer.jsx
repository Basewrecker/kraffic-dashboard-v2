import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowUpRight, ChevronDown, X } from 'lucide-react'
import SheetHandle, { SHEET_BASE, SHEET_FOOTER_PAD, SHEET_IN, SHEET_OUT } from '../ui/SheetHandle'
import Insight, { useExplain } from '../ui/Insight'
import { EngineChips } from './ChangeParts'
import { openAnswer } from './AnswerDrawer'
import { download } from './EngineDrawer'
import { PlatformIcon } from '../dashboard/icons'
import { FolderDelta, folderModel } from '../dashboard/CitedFolders'
import { folderColor } from '../dashboard/folderColors'
import { ENGINES, OWN, brandByDomain, engineName } from '../../data/brandViews'
import { FOLDER_WEEKS, folderEngines } from '../../data/citedFolders'
import { platformNames } from '../../data/mock'
import { useBrandView } from '../../hooks/useBrandView'
import { useIsMobile } from '../../hooks/useMedia'
import { fmtDay, useTracking } from '../../store/trackingSettings'
import { chart } from '../../theme/chart'
import { OTHER } from '../../utils/citedFolders'

// "Cited pages by folder" drawer: the Mentions and citations drawer's design (WeekHistoryDrawer: the shell, engine chips,
// the metric text tabs with their change, a 10-week line chart with its tooltip, the insight line, the weeks by month,
// the footer with Export CSV), on the folders: Citations · Cited pages · Folders; the top 5 folders as lines in their
// donut colours; the pages grouped by folder (a collapsible header row per folder: dot · folder · citations · change ·
// chevron; inside, the Cited pages rows: path · citations · prompt chips · engine icons). Opened on one folder (a slice
// or a legend row), everything reads that folder: its line stands out, its pages open, the weeks are its own.
// openFolderDrawer({ folder, brand, opener }). URL: ?drawer=folders[&folder=/blog/][&drawerEngine=aio][&drawerBrand=]
const EVENT = 'folders-drawer:open'
export function openFolderDrawer({ folder = null, brand = null, opener } = {}) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { folder, brand, opener } }))
}

const METRICS = [{ id: 'citations', label: 'Citations' }, { id: 'pages', label: 'Cited pages' }, { id: 'folders', label: 'Folders' }]
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const short = (d) => String(d ?? '').replace(/, \d{4}$/, '')
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const tick = { fontSize: 12, fill: 'var(--color-stone-500)' }
// a long path keeps its last segment ("/blog/…ide-to-retinol")
function middle(path, max = 46) {
  if (path.length <= max) return path
  const cut = path.lastIndexOf('/') + 1
  const head = path.slice(0, cut), tail = path.slice(cut)
  const keep = Math.max(12, max - head.length - 1)
  return head.length + 1 + keep >= path.length ? path : `${head}…${tail.slice(-keep)}`
}

function readUrl() {
  const q = new URLSearchParams(window.location.search)
  if (q.get('drawer') !== 'folders') return null
  return { folder: q.get('folder'), engine: q.get('drawerEngine') || null, brand: q.get('drawerBrand') || null, metric: q.get('metric') || 'citations' }
}
function urlFor(s) {
  const url = new URL(window.location.href)
  for (const k of ['drawer', 'folder', 'drawerEngine', 'drawerBrand', 'metric']) url.searchParams.delete(k)
  if (s) {
    url.searchParams.set('drawer', 'folders')
    if (s.folder) url.searchParams.set('folder', s.folder)
    if (s.engine && s.engine !== 'all') url.searchParams.set('drawerEngine', s.engine)
    if (s.brand && s.brand !== OWN.domain) url.searchParams.set('drawerBrand', brandByDomain(s.brand)?.key ?? s.brand)
    if (s.metric && s.metric !== 'citations') url.searchParams.set('metric', s.metric)
  }
  return url.toString()
}

// a week's value: the whole brand, or one folder
function valueOf(groups, metric, folder) {
  if (!groups) return null
  if (metric === 'folders') return groups.folders.length
  if (!folder) return metric === 'pages' ? groups.pageCount : groups.total
  const f = groups.folders.find((x) => x.key === folder)
  return f ? (metric === 'pages' ? f.pages.length : f.count) : 0
}
const deltaOf = (weeks, i, metric, folder) => {
  const a = valueOf(weeks[i]?.groups, metric, folder), b = valueOf(weeks[i + 1]?.groups, metric, folder)
  return a == null || b == null ? null : a - b
}

function FolderTip({ active, payload, lines, metric }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="min-w-[200px] rounded-lg border border-stone-200 bg-raised px-3 py-2 text-small shadow-sm">
      <div className="mb-1 font-semibold text-stone-900 tabular-nums">{p.label}</div>
      {!p.ran ? <div className="text-stone-500">No scan this week</div> : lines.map((l) => (
        <div key={l.key} className="flex items-center justify-between gap-4 tabular-nums">
          <span className="flex min-w-0 items-center gap-1.5 text-stone-600"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.color }} /><span className="truncate">{l.label}</span></span>
          <span className="font-semibold text-stone-900">{p[l.key] ?? '—'}</span>
        </div>
      ))}
      <div className="mt-1 text-[12px] leading-4 text-stone-500">{metric === 'pages' ? 'Cited pages' : metric === 'folders' ? 'Folders' : 'Citations'}</div>
    </div>
  )
}

function FolderChart({ weeks, lines, metric, focus }) {
  const mobile = useIsMobile()
  const data = [...weeks].reverse().map((w) => {
    const row = { label: short(w.date), ran: !!w.groups }
    lines.forEach((l) => { row[l.key] = l.value(w.groups) })
    return row
  })
  const vals = data.flatMap((d) => lines.map((l) => d[l.key])).filter((v) => v != null)
  const top = Math.max(4, ...vals)
  const step = top <= 8 ? 2 : top <= 20 ? 5 : top <= 40 ? 10 : 20
  const max = Math.ceil(top / step) * step
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step)
  const anim = { animationDuration: 300, animationEasing: 'ease-out', isAnimationActive: !reduced() }
  const last = data.length - 1
  return (
    <div className="mt-4 h-[168px]" role="img" aria-label={`${lines.map((l) => l.label).join(', ')} by week`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={chart.track} strokeWidth={1} />
          <XAxis dataKey="label" tickMargin={12} tickLine={false} axisLine={false} tick={tick} padding={{ left: 16, right: 16 }} interval={0}
            tickFormatter={(v, k) => ((last - k) % 2 ? '' : v)} />
          <YAxis width={36} tickMargin={mobile ? 4 : 8} domain={[0, max]} ticks={ticks} tickLine={false} axisLine={false} tick={tick} />
          <Tooltip cursor={{ stroke: chart.c3, strokeWidth: 1 }} content={<FolderTip lines={lines} metric={metric} />} />
          {lines.map((l) => {
            const dim = focus && focus !== l.key
            return (
              <Line key={l.key} dataKey={l.key} type="monotone" stroke={l.color} strokeOpacity={dim ? 0.25 : 1} strokeWidth={!focus || focus === l.key ? 2.5 : 1.75}
                strokeLinecap="round" connectNulls={false} dot={false} activeDot={dim ? false : { r: 4, fill: l.color, stroke: 'var(--color-surface)', strokeWidth: 2 }} {...anim} />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// one cited page inside a folder: the Cited pages list's row (path · citations · prompt chips · engine icons)
function PageRow({ page, domain, onOpen }) {
  const [all, setAll] = useState(false)
  const chips = all ? page.prompts : page.prompts.slice(0, 2)
  const more = page.prompts.length - chips.length
  const chip = 'inline-flex h-6 max-w-full items-center rounded-md bg-tint px-2 text-[12px] leading-4 text-stone-700 outline-none transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
  return (
    <li className="group py-3 pl-11 pr-6">
      <div className="flex items-center gap-2">
        <span title={page.path} className="min-w-0 truncate text-[14px] leading-5 font-medium text-stone-900">{middle(page.path)}</span>
        <a href={`https://${domain}${page.path}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${domain}${page.path}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-stone-500 opacity-0 outline-none transition-[opacity,color,background-color] duration-150 hover:bg-tint hover:text-stone-900 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus group-hover:opacity-100 touch:opacity-100">
          <ArrowUpRight size={14} aria-hidden />
        </a>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {page.engines.map((e) => <span key={e} title={platformNames[e === 'aio' ? 'google' : e] ?? engineName(e)} className="flex"><PlatformIcon id={e} size={14} /></span>)}
        </span>
        <span className="w-8 shrink-0 text-right text-[14px] leading-5 font-semibold text-ink tabular-nums">{page.count}</span>
      </div>
      <div className="mt-1 text-[12px] leading-4 text-stone-600 tabular-nums">{plural(page.count, 'citation')} · {plural(page.prompts.length, 'prompt')}</div>
      {page.prompts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((p) => (
            <button key={p.key} type="button" onClick={(e) => onOpen(p, page.prompts, e.currentTarget)} className={chip}><span className="truncate">{p.prompt}</span></button>
          ))}
          {more > 0 && <button type="button" onClick={() => setAll(true)} aria-label={`Show ${more} more prompts`} className={`${chip} font-medium tabular-nums`}>+{more}</button>}
        </div>
      )}
    </li>
  )
}

export default function FolderDrawer() {
  const page = useBrandView()
  const tracking = useTracking()
  const [state, setState] = useState(() => readUrl()) // { folder, engine, brand, metric }
  const [shown, setShown] = useState(false)
  const [swapped, setSwapped] = useState(false)
  const [openFolders, setOpenFolders] = useState({})
  const pushed = useRef(false)
  const panel = useRef(null)
  const opener = useRef(null)
  const open = state != null
  const domain = state?.brand ? (brandByDomain(state.brand)?.domain ?? state.brand) : page.focal.domain
  const brand = brandByDomain(domain) ?? OWN
  const engines = folderEngines(domain)
  const engine = state?.engine && engines.includes(state.engine) ? state.engine : 'all'
  const metric = METRICS.some((m) => m.id === state?.metric) ? state.metric : 'citations'
  const m = useMemo(() => (open ? folderModel(domain, engine) : null), [open, domain, engine])
  const weeks = m?.weeks ?? []
  const now = m?.now
  const folder = state?.folder && now?.folders.some((f) => f.key === state.folder) ? state.folder : null
  const explain = useExplain(`${open}|${domain}|${engine}|${metric}|${folder}`)

  // open (event), Back (popstate)
  useEffect(() => {
    const on = (e) => {
      opener.current = e.detail.opener ?? document.activeElement
      setSwapped(false)
      const next = { folder: e.detail.folder, engine: page.engine, brand: e.detail.brand, metric: 'citations' }
      setOpenFolders(e.detail.folder ? { [e.detail.folder]: true } : {})
      if (!readUrl()) { window.history.pushState(window.history.state, '', urlFor(next)); pushed.current = true }
      setState(next)
    }
    const pop = () => { pushed.current = false; setSwapped(false); setState(readUrl()) }
    window.addEventListener(EVENT, on)
    window.addEventListener('popstate', pop)
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener('popstate', pop) }
  }, [page.engine])
  useEffect(() => { if (open || readUrl()) window.history.replaceState(window.history.state, '', urlFor(open && !swapped ? state : null)) }, [open, swapped, state])
  useLayoutEffect(() => {
    if (!open) { setShown(false); return undefined }
    const r = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(r)
  }, [open])
  useEffect(() => { if (open && shown && !swapped) panel.current?.focus() }, [open, shown]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => {
    if (pushed.current) { pushed.current = false; window.history.back() } else setState(null)
    setSwapped(false)
    opener.current?.focus?.()
  }
  const close = () => { setShown(false); setTimeout(finish, reduced() ? 0 : 200) }
  const set = (patch) => setState((s) => ({ ...s, ...patch }))
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); if (explain.on) explain.off(); else close(); return }
    if (e.key === 'Tab') {
      const f = [...panel.current.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }
  const onMetricKey = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const i = METRICS.findIndex((x) => x.id === metric)
    const next = METRICS[(i + step + METRICS.length) % METRICS.length].id
    set({ metric: next })
    requestAnimationFrame(() => panel.current?.querySelector(`[data-metric="${next}"]`)?.focus())
  }
  // a prompt chip → the Answer drawer stands in for this one (Back returns here)
  const openPrompt = (p, list, el) => {
    setSwapped(true)
    openAnswer({
      key: p.key, engine: p.engine, brand: domain, list: list.map((x) => x.key),
      back: { label: 'Cited pages by folder', onBack: () => { setSwapped(false); requestAnimationFrame(() => (el?.isConnected ? el : panel.current)?.focus({ preventScroll: true })) }, onClose: finish },
    })
  }

  if (!open || !m) return null
  const chips = [{ id: 'all', name: 'All' }, ...ENGINES.filter((e) => engines.includes(e.id))]
  const total = now?.total ?? 0
  const sel = METRICS.find((x) => x.id === metric)
  // colours by rank, as on the card (folders past the 6th: "Other"'s pink)
  const rankOf = (k) => now.folders.findIndex((f) => f.key === k)
  const colorOf = (k) => folderColor(rankOf(k), rankOf(k) >= 6 ? OTHER : k)
  // the chart: the top 5 folders (by the latest sync), or the folder count as one ink line
  const lines = metric === 'folders'
    ? [{ key: 'n', label: 'Folders', color: 'var(--ink)', value: (g) => (g ? g.folders.length : null) }]
    : now.folders.slice(0, 5).map((f) => ({ key: f.key, label: f.key, color: colorOf(f.key), value: (g) => valueOf(g, metric, f.key) }))
  const focus = folder && lines.some((l) => l.key === folder) ? folder : null
  const shownFolders = folder ? now.folders.filter((f) => f.key === folder) : now.folders
  const isOpen = (k) => (folder ? true : openFolders[k] ?? k === now.folders[0]?.key)
  const fChange = (k) => {
    const a = now.folders.find((f) => f.key === k)?.count ?? 0
    const b = m.prev ? m.prev.folders.find((f) => f.key === k)?.count ?? 0 : null
    return b == null ? null : a - b
  }
  // the insight: the biggest folder's share, or the picked folder's change
  const top = m.slices[0]
  const fNow = folder ? now.folders.find((f) => f.key === folder) : null
  const fd = folder ? fChange(folder) : null
  const insightText = folder
    ? `${folder} has ${plural(fNow.count, 'citation')} on ${plural(fNow.pages.length, 'page')}${fd ? `, ${fd > 0 ? 'up' : 'down'} ${Math.abs(fd)} since ${short(weeks[1]?.date)}` : ''}.`
    : top ? `${top.key === 'Homepage' ? 'Your homepage' : `The ${top.label} folder`} earns ${top.pct}% of ${brand.you ? 'your' : `${brand.name}’s`} citations.` : null
  const engineLabel = engine === 'all' ? 'All engines' : engineName(engine)
  const months = []
  weeks.forEach((w, i) => {
    if (months.at(-1)?.month !== w.month) months.push({ month: w.month, items: [] })
    months.at(-1).items.push(i)
  })
  const exportCsv = () => download(`${brand.key}-cited-pages-by-folder${folder ? `-${folder.replace(/\W+/g, '')}` : ''}.csv`,
    [['Folder', 'Page', 'Citations', 'Engines', 'Prompts'], ...shownFolders.flatMap((f) => f.pages.map((p) => [f.key, `https://${domain}${p.path}`, p.count, p.engines.map(engineName).join('; '), p.prompts.map((x) => x.prompt).join('; ')]))])

  return (
    <div className={`fixed inset-0 z-50 ${swapped ? 'invisible' : ''}`} onKeyDown={onKeyDown}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity duration-[250ms] ease-out motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`} onClick={close} aria-hidden />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={folder ? `Cited pages in ${folder}` : 'Cited pages by folder'} tabIndex={-1}
        className={`${SHEET_BASE} max-md:!h-[100dvh] max-md:!rounded-none max-md:!border-t-0 md:w-[min(720px,100vw)] ${shown ? SHEET_IN : SHEET_OUT}`}>
        <SheetHandle panelRef={panel} onClose={close} />
        <div className="flex shrink-0 items-center justify-between gap-3 px-6 pt-5">
          <EngineChips chips={chips} value={engine} onChange={(id) => set({ engine: id })} />
          <button type="button" onClick={close} aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
            <X size={16} />
          </button>
        </div>

        <div ref={explain.cardRef} className="min-h-0 flex-1 overflow-y-auto">
          <header className="border-b border-line px-6">
            <h2 className="mt-3 text-[20px] leading-7 font-semibold text-stone-900">Cited pages by folder</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] leading-[18px] text-stone-600 tabular-nums">
              <span>{brand.name} · {weeks.length >= FOLDER_WEEKS ? `last ${plural(weeks.length, 'week')}` : weeks.length === 1 ? `first sync with citations (${short(weeks[0].date)})` : `history since ${short(weeks.at(-1).date)} (${plural(weeks.length, 'week')})`}</span>
              {folder && (
                <>
                  <span aria-hidden>·</span>
                  <button type="button" onClick={() => set({ folder: null })} aria-label={`Showing ${folder}. Show all folders`}
                    className="inline-flex h-6 items-center gap-1.5 rounded-md bg-tint px-2 text-[12px] leading-4 font-medium text-stone-900 outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] focus-visible:ring-2 focus-visible:ring-focus">
                    <span className="h-2 w-2 rounded-full" style={{ background: colorOf(folder) }} aria-hidden />{folder}<X size={12} aria-hidden />
                  </button>
                </>
              )}
            </p>

            {/* the metric: text tabs with the big number and its change (the Mentions and citations drawer's) */}
            <div role="tablist" aria-label="Metric" onKeyDown={onMetricKey} className="mt-5 flex gap-8 border-b border-[var(--div)]">
              {METRICS.map((x) => {
                const on = x.id === metric
                const v = valueOf(weeks[0]?.groups, x.id, x.id === 'folders' ? null : folder)
                const d = deltaOf(weeks, 0, x.id, x.id === 'folders' ? null : folder)
                return (
                  <button key={x.id} data-metric={x.id} type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1} onClick={() => set({ metric: x.id })}
                    aria-label={`${x.label} ${v ?? 'not known'}${d ? `, ${d > 0 ? '+' : '−'}${Math.abs(d)} vs last week` : ''}`}
                    className={`group -mb-px min-w-0 border-b-2 pb-3 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'border-ink' : 'border-transparent'}`}>
                    <span className={`block whitespace-nowrap text-[13px] leading-[18px] font-medium transition-colors duration-150 ${on ? 'text-stone-900' : 'text-stone-500 group-hover:text-stone-900'}`}>{x.label}</span>
                    <span className="mt-1 flex items-baseline gap-1.5">
                      <span className={`text-[24px] leading-8 font-semibold tabular-nums transition-colors duration-150 ${on ? 'text-ink' : 'text-stone-500 group-hover:text-stone-900'}`}>{v ?? '—'}</span>
                      {d ? <span className={`text-[12px] leading-4 font-medium tabular-nums ${d > 0 ? 'text-stone-600' : 'text-negative'}`}>{d > 0 ? '+' : '−'}{Math.abs(d)}</span> : null}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* the top 5 folders, one line each in its donut colour */}
            {weeks.length < 2
              ? <p className="mt-4 rounded-lg bg-tint px-4 py-3 text-[13px] leading-[18px] text-stone-600" data-folder-history>This is the first sync with citations, so there’s nothing to compare yet. The trend lines and changes show after the next sync.</p>
              : <FolderChart weeks={weeks} lines={lines} metric={metric} focus={focus} />}
            {metric !== 'folders' && weeks.length >= 2 && (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1" aria-label="Lines">
                {lines.map((l) => (
                  <li key={l.key}>
                    <button type="button" onClick={() => { set({ folder: folder === l.key ? null : l.key }); setOpenFolders({ [l.key]: true }) }} aria-pressed={folder === l.key}
                      className={`inline-flex items-center gap-1.5 rounded text-[12px] leading-4 outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-focus ${focus && focus !== l.key ? 'opacity-50' : ''} ${folder === l.key ? 'font-semibold text-stone-900' : 'text-stone-600 hover:text-stone-900'}`}>
                      <span className="h-2 w-2 rounded-full" style={{ background: l.color }} aria-hidden />{l.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {insightText && (
              <div className="mt-3 pb-4">
                <Insight wrap explain={explain} text={insightText}
                  evidence={{ keys: [], calc: `${total} citations on ${plural(now.pageCount, 'page')} in ${plural(now.folders.length, 'folder')}, ${engineLabel.toLowerCase()}, the ${short(fmtDay(tracking.schedule.lastSync))} sync. Query strings and #anchors don’t make a different page.`, source: `(${short(fmtDay(tracking.schedule.lastSync))} update)` }} />
              </div>
            )}
          </header>

          {/* the pages, grouped by folder */}
          <section aria-label="Pages by folder">
            <h3 className="sticky top-0 z-[1] bg-surface px-6 pb-1 pt-4 text-[12px] leading-4 font-medium text-stone-500">Pages by folder</h3>
            <ul className="divide-y divide-[var(--div)]">
              {shownFolders.map((f) => {
                const on = isOpen(f.key)
                const d = fChange(f.key)
                return (
                  <li key={f.key} data-folder-group={f.key}>
                    <button type="button" aria-expanded={on} onClick={() => setOpenFolders((o) => ({ ...o, [f.key]: !on }))} disabled={!!folder}
                      className="group flex min-h-[52px] w-full items-center gap-3 px-6 text-left outline-none transition-colors duration-150 enabled:hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus disabled:cursor-default">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(f.key) }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[14px] leading-5 font-semibold text-stone-900">{f.key}</span>
                      <span className="text-[12px] leading-4 text-stone-500 tabular-nums">{plural(f.pages.length, 'page')}</span>
                      <span className="w-8 text-right text-[14px] leading-5 font-semibold text-ink tabular-nums">{f.count}</span>
                      {m.prev && <span className="w-9 text-right"><FolderDelta d={d} /></span>}
                      <ChevronDown size={14} aria-hidden className={`shrink-0 text-stone-500 transition-transform duration-150 ${on ? 'rotate-180' : ''} ${folder ? 'invisible' : ''}`} />
                    </button>
                    {on && (
                      <ul className="divide-y divide-[var(--color-line-soft)] border-t border-[var(--color-line-soft)] motion-safe:animate-[fade-in_150ms_ease-out]">
                        {f.pages.map((p) => <PageRow key={p.path} page={p} domain={domain} onOpen={openPrompt} />)}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>

          {/* week by week (the folder's own, when one is picked) */}
          <section aria-label={`${sel.label} by week`} className="mt-2 border-t border-line">
            {months.map((g, gi) => (
              <div key={g.month}>
                <h3 className={`sticky top-0 z-[1] bg-surface px-6 pb-1 pt-4 text-[12px] leading-4 font-medium text-stone-500 ${gi ? 'border-t border-[var(--div)]' : ''}`}>{g.month}</h3>
                <ul className="divide-y divide-[var(--div)]">
                  {g.items.map((i) => {
                    const w = weeks[i]
                    const v = valueOf(w.groups, metric, metric === 'folders' ? null : folder)
                    const d = deltaOf(weeks, i, metric, metric === 'folders' ? null : folder)
                    const c = valueOf(w.groups, 'citations', folder), p = valueOf(w.groups, 'pages', folder), n = valueOf(w.groups, 'folders', null)
                    const summary = !w.groups ? 'No scan this week'
                      : folder ? `${plural(c, 'citation')} · ${plural(p, 'page')}` : `${plural(c, 'citation')} · ${plural(p, 'page')} · ${plural(n, 'folder')}`
                    return (
                      <li key={w.date} className="flex min-h-[60px] items-center gap-3 px-6 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] leading-5 font-medium text-stone-900 tabular-nums">{w.label}</span>
                          <span className={`block text-[12.5px] leading-[18px] ${w.groups ? 'text-stone-600' : 'text-stone-500'}`}>{summary}</span>
                        </span>
                        <span className={`w-9 text-right text-[14px] leading-5 tabular-nums ${v == null ? 'text-stone-500' : 'font-semibold text-ink'}`}>{v ?? '—'}</span>
                        <span className="w-8 text-right">{d ? <span className={`text-[12px] leading-4 font-medium tabular-nums ${d > 0 ? 'text-stone-600' : 'text-negative'}`}>{d > 0 ? '+' : '−'}{Math.abs(d)}</span> : null}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </section>
        </div>

        <footer className={`flex shrink-0 items-center justify-between gap-3 border-t border-line px-4 pt-3 text-[13px] leading-[18px] text-stone-600 md:px-6 ${SHEET_FOOTER_PAD}`}>
          <span className="min-w-0 truncate tabular-nums">
            {folder
              ? `${plural(fNow.count, 'citation')} · ${plural(fNow.pages.length, 'page')} in ${folder} · updated ${short(fmtDay(tracking.schedule.lastSync))}`
              : `${plural(total, 'citation')} · ${plural(now.pageCount, 'page')} · ${plural(now.folders.length, 'folder')} · updated ${short(fmtDay(tracking.schedule.lastSync))}`}
          </span>
          <button type="button" onClick={exportCsv} className="shrink-0 rounded font-medium text-stone-700 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">Export CSV</button>
        </footer>
      </div>
    </div>
  )
}

export { FOLDER_WEEKS }
