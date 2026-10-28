import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, LayoutGrid, List, MoreHorizontal, Repeat, Search, Sparkles, Star } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Segmented from '../../components/dashboard/Segmented'
import ActionMenu from '../../components/audit/ActionMenu'
import { useToast } from '../../components/dashboard/overlays'
import { linkClick, navigate, usePath } from '../../router'
import { AUDIENCES, DATES, KINDS, REPORT_BRANDS, VERDICT_TONE, buildReport, dataFor, libraryItems, monthGroup, parseDay, periodRange, runSummary, savedReports, schedules, weeklyRuns } from '../../data/reports'
import PillComposer from './PillComposer'
import ReportPage from './ReportPage'
import { Block, Thumb, VerdictDot } from './blocks'
import { DotIllustration } from './DotField'
import { BrandLogo, ChipMenu, Empty, ReportsHead, brandOf, defaultBrand, fromQuery, inkBtn, lineBtn, menuItem, t2, t3, toQuery } from './parts'

// /reports → New report (the composer) · /reports/all → All reports · /reports/scheduled → Scheduled
// /reports/new?… → writing a report · /reports/<id> → a report. ?mock=empty: no reports (Home, All reports, Scheduled)
export default function ReportsRouter() {
  const path = usePath()
  const rest = path.replace(/^\/reports\/?/, '')
  useEffect(() => {
    document.title = `${rest === '' ? 'New report' : rest === 'all' ? 'Reports' : rest === 'scheduled' ? 'Scheduled reports' : 'Report'} · Kraffic`
  }, [rest])
  if (rest === '') return <ReportsHome />
  if (rest === 'all') return <AllReports />
  if (rest === 'scheduled') return <Scheduled />
  return <ReportPage id={rest} />
}
const mockEmpty = () => new URLSearchParams(window.location.search).get('mock') === 'empty'

const AUD = Object.fromEntries(AUDIENCES.map((a) => [a.id, a.label]))
const groupBy = (xs, key) => { const m = new Map(); for (const x of xs) { const k = key(x); m.set(k, [...(m.get(k) ?? []), x]) } return [...m] }
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// a change: ▲2 / ▼1 (red) / ±0, read out as words
function Delta({ d }) {
  if (!d) return <span className={`text-[12px] ${t3}`}><span aria-hidden>±0</span><span className="sr-only">no change</span></span>
  const up = d > 0
  return (
    <span className={`whitespace-nowrap text-[12px] tabular-nums ${up ? t2 : 'font-medium text-negative'}`}>
      <span aria-hidden>{up ? '▲' : '▼'}{Math.abs(d)}</span><span className="sr-only">{up ? 'up' : 'down'} {Math.abs(d)}</span>
    </span>
  )
}

// ---- New report, ChatGPT-style: nothing but the greeting and the box, centred. Sending fades the greeting and
// glides the box to the top of the page, where the report is written under it.
function ReportsHome() {
  const init = useRef(fromQuery()).current
  const home = useRef(init.opts.brand).current
  const [prompt, setPrompt] = useState(init.prompt)
  const [opts, setOpts] = useState(init.opts)
  const [leaving, setLeaving] = useState(null) // the box's glide to the top: { dy }
  const pill = useRef(null)
  const brand = brandOf(opts.brand)
  const send = (final) => {
    if (leaving) return
    const url = `/reports/new?${toQuery(final, prompt.trim())}`
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const main = document.querySelector('main')
    const box = pill.current?.getBoundingClientRect()
    if (!main || !box) { navigate(url); return }
    const top = main.getBoundingClientRect().top + parseFloat(getComputedStyle(main).paddingTop)
    document.activeElement?.blur()
    setLeaving({ dy: reduced ? 0 : top - box.top })
    setTimeout(() => navigate(url), reduced ? 160 : 460)
  }
  return (
    <section className="flex min-h-[calc(100dvh-120px)] flex-col items-center justify-center pb-[14vh] lg:min-h-[calc(100dvh-72px)]">
      <h1 className={`mb-7 text-center text-[26px] leading-[34px] font-normal tracking-[-0.025em] text-stone-900 [text-wrap:balance] transition-opacity duration-200 md:mb-9 md:text-[34px] md:leading-[44px] ${leaving ? 'opacity-0' : ''}`}>
        What do you want to know about{' '}
        <span className="whitespace-nowrap font-semibold">
          <BrandLogo id={opts.brand} className="relative -top-[3px] mr-2 inline-block h-6 w-6 align-middle md:h-8 md:w-8" />{brand?.name ?? 'your brand'}?
        </span>
      </h1>
      <div className="w-full" style={leaving ? { transform: `translateY(${leaving.dy}px)`, transition: 'transform 440ms cubic-bezier(.3,.7,.2,1), opacity 160ms', opacity: leaving.dy ? 1 : 0 } : undefined}>
        <PillComposer ref={pill} homeBrand={home} prompt={prompt} setPrompt={setPrompt} opts={opts} setOpts={setOpts} onSend={send} busy={!!leaving} />
      </div>
    </section>
  )
}

// a report in a list: thumbnail · its headline · verdict · brand · audience · date; hovering shows "Open →".
// An earlier run of a weekly summary opens what was sent (onRun).
function ReportRow({ r, showBrand = true, onRun, className = '' }) {
  const meta = (
    <>
      <VerdictDot verdict={r.verdict} />
      {showBrand && <span className="inline-flex min-w-0 items-center gap-1.5"><BrandLogo id={r.brand} className="h-3.5 w-3.5" /><span className="truncate">{brandOf(r.brand)?.name}</span></span>}
      <span>{AUD[r.audience]}</span>
      <span className="inline-flex items-center gap-1 tabular-nums">{r.scheduled && <Repeat size={12} aria-label="Scheduled" className="text-stone-500" />}{r.created}</span>
    </>
  )
  const cls = `thumb-live group flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-focus max-md:items-start ${className}`
  const inner = (
    <>
      <span className="grid h-12 w-[76px] shrink-0 place-items-center rounded-lg bg-tint transition-colors duration-150 group-hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]"><Thumb kind={r.kind} net={r.kindNet} className="h-9 w-[60px]" /></span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[14px] leading-5 font-semibold text-stone-900 [text-wrap:pretty]">{r.headline}</span>
        <span className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-4 ${t3} md:hidden`}>{meta}</span>
      </span>
      <span className={`hidden shrink-0 items-center gap-4 text-[12px] leading-4 ${t3} md:flex [&>*:first-child]:w-[92px]`}>{meta}</span>
      <span className="hidden w-14 shrink-0 items-center justify-end gap-1 text-[13px] font-medium text-stone-900 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 md:inline-flex">Open<ArrowRight size={14} aria-hidden /></span>
    </>
  )
  return r.run
    ? <button type="button" onClick={() => onRun?.(r)} className={cls}>{inner}</button>
    : <a href={`/reports/${r.id}`} onClick={linkClick(`/reports/${r.id}`)} className={cls}>{inner}</a>
}

// ---- All reports: a library. Search and filters; the scheduled reports; the weekly verdicts as a streak; then every
// report by month, as a gallery of tiles (hover: the key numbers) or a compact list
const TYPES = Object.entries(KINDS).map(([id, k]) => ({ id, label: k.name }))
const VERDICTS = [{ id: 'good', label: 'Good' }, { id: 'mixed', label: 'Mixed' }, { id: 'tough', label: 'Tough' }, { id: 'opportunity', label: 'Opportunity' }]
const verdictGroup = (v) => (v === 'Opportunity' ? 'opportunity' : { up: 'good', down: 'tough' }[VERDICT_TONE[v]] ?? 'mixed')
function AllReports() {
  const q0 = new URLSearchParams(window.location.search)
  const all = useMemo(() => (mockEmpty() ? [] : libraryItems()), [])
  const [search, setSearch] = useState('')
  const [brandId, setBrandId] = useState(q0.get('brand') ?? 'all')
  const [type, setType] = useState(null)
  const [aud, setAud] = useState(null)
  const [verdict, setVerdict] = useState(null)
  const [view, setView] = useState(q0.get('view') === 'list' ? 'list' : 'gallery')
  const [stars, setStars] = useState(() => new Set(all.filter((r) => r.saved).map((r) => r.id)))
  const [run, setRun] = useState(null)
  const [toastNode, toast] = useToast({ position: 'center' })
  const s = search.trim().toLowerCase()
  const shown = all.filter((r) => (brandId === 'all' || r.brand === brandId) && (!type || r.kind === type) && (!aud || r.audience === aud)
    && (!verdict || verdictGroup(r.verdict) === verdict) && (!s || `${r.headline} ${r.title} ${brandOf(r.brand)?.name}`.toLowerCase().includes(s)))
  const filtered = brandId !== 'all' || type || aud || verdict || s
  const clear = () => { setSearch(''); setBrandId('all'); setType(null); setAud(null); setVerdict(null) }
  const star = (r) => {
    const on = !stars.has(r.id)
    setStars((x) => { const n = new Set(x); if (on) n.add(r.id); else n.delete(r.id); return n })
    toast(on ? 'Saved. It stays in the library after older reports are cleared.' : 'Removed from saved')
  }
  const streakBrand = brandId !== 'all' && weeklyRuns(brandId).length ? brandId : (weeklyRuns(defaultBrand()).length ? defaultBrand() : 'foa')
  const scheds = schedules.filter((x) => brandId === 'all' || x.brand === brandId)
  const newBtn = <a href="/reports" onClick={linkClick('/reports')} className={inkBtn}><Sparkles size={14} aria-hidden />New report</a>
  const radio = (opts, cur, set) => (close) => [{ id: null, label: 'All' }, ...opts].map((o) => (
    <button key={o.id ?? 'all'} type="button" role="menuitemradio" aria-checked={cur === o.id} onClick={() => { set(o.id); close() }} className={`${menuItem} text-stone-900`}>
      {o.logo}<span className="min-w-0 flex-1 truncate">{o.label}</span>{cur === o.id && <Check size={14} className="shrink-0 text-ink" aria-hidden />}
    </button>
  ))

  if (!all.length) {
    return (
      <>
        <div className="flex items-end justify-between gap-3"><h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">Reports</h1></div>
        <div className="flex flex-col items-center px-4 pb-16 pt-14 text-center md:pt-20">
          <DotIllustration className="h-[140px] w-[260px]" />
          <p className="mt-7 text-[20px] leading-7 font-semibold tracking-[-0.01em] text-stone-900">Your first report is one question away</p>
          <p className={`mt-1.5 max-w-[46ch] text-[14px] leading-5 ${t2}`}>Ask anything about your brands’ AI visibility. Kraffic writes the report from your tracked prompts and keeps it here.</p>
          <a href="/reports" onClick={linkClick('/reports')} className={`${inkBtn} mt-6`}><Sparkles size={14} aria-hidden />Ask a question</a>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">
          Reports <span className={`ml-1 text-[15px] font-normal tracking-normal tabular-nums ${t3} lg:text-[17px]`}>{filtered ? `${shown.length} of ${all.length}` : all.length}</span>
        </h1>
        {newBtn}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex h-8 items-center max-md:w-full">
          <Search size={14} className="pointer-events-none absolute left-3 text-stone-500" aria-hidden />
          <span className="sr-only">Search reports</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search headlines"
            className="h-8 w-60 rounded-full bg-tint pl-8 pr-3 text-[13px] text-stone-900 outline-none placeholder:text-stone-500 focus-visible:ring-2 focus-visible:ring-focus max-md:w-full" />
        </label>
        <ChipMenu label="Brand" logo={brandId !== 'all' ? <BrandLogo id={brandId} /> : undefined} value={brandId !== 'all' ? brandOf(brandId)?.name : null} width={260}>
          {radio(REPORT_BRANDS.filter((b) => dataFor(b.id)).map((b) => ({ id: b.id, label: b.name, logo: <BrandLogo id={b.id} className="h-5 w-5" /> })), brandId === 'all' ? null : brandId, (v) => setBrandId(v ?? 'all'))}
        </ChipMenu>
        <ChipMenu label="Type" value={TYPES.find((x) => x.id === type)?.label ?? null} width={240}>{radio(TYPES, type, setType)}</ChipMenu>
        <ChipMenu label="Audience" value={AUD[aud] ?? null} width={200}>{radio(AUDIENCES.map((a) => ({ id: a.id, label: a.label })), aud, setAud)}</ChipMenu>
        <ChipMenu label="Verdict" value={VERDICTS.find((x) => x.id === verdict)?.label ?? null} width={200}>{radio(VERDICTS, verdict, setVerdict)}</ChipMenu>
        {filtered && <button type="button" onClick={clear} className="h-8 rounded-full px-2.5 text-[13px] font-medium text-stone-600 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Clear</button>}
        <Segmented className="ml-auto" size="sm" label="View" value={view} onChange={setView} options={[{ value: 'gallery', label: 'Gallery', icon: LayoutGrid }, { value: 'list', label: 'List', icon: List }]} />
      </div>

      {scheds.length > 0 && (
        <div className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 text-[13px] leading-5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
          <span className="mr-2 inline-flex shrink-0 items-center gap-1.5 font-medium text-stone-900"><Repeat size={14} className="text-stone-500" aria-hidden />Scheduled</span>
          {scheds.map((x) => (
            <a key={x.id} href={`/reports/scheduled?preview=${x.id}`} onClick={linkClick(`/reports/scheduled?preview=${x.id}`)}
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2.5 py-1 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus">
              <BrandLogo id={x.brand} className="h-4 w-4" /><span className="text-stone-900">{x.title}</span>
              <span className={t3}>· {x.when} · {plural(x.recipients.length, 'recipient')}</span>
            </a>
          ))}
          <a href="/reports/scheduled" onClick={linkClick('/reports/scheduled')} className="ml-1 shrink-0 rounded px-1 font-medium text-stone-600 underline-offset-4 outline-none hover:text-stone-900 hover:underline focus-visible:ring-2 focus-visible:ring-focus">Manage</a>
        </div>
      )}

      <Streak brandId={streakBrand} onRun={setRun} />

      {shown.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-14 text-center">
          <p className="text-[15px] leading-5 font-semibold text-stone-900">No reports match</p>
          <p className={`mt-1 text-[13px] leading-[18px] ${t2}`}>Try another word, or clear the filters.</p>
          <button type="button" onClick={clear} className={`${lineBtn} mt-4`}>Clear filters</button>
        </div>
      ) : groupBy(shown, (r) => monthGroup(r.created)).map(([month, rows]) => (
        <section key={month} aria-labelledby={`m-${month}`} className="mt-4">
          <h2 id={`m-${month}`} className="flex items-baseline gap-2 text-[17px] leading-6 font-semibold text-stone-900">{month}<span className={`text-[13px] font-normal tabular-nums ${t3}`}>{rows.length}</span></h2>
          {view === 'gallery' ? (
            <ul className="mt-4 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {rows.map((r) => <li key={r.id}><Tile r={r} starred={stars.has(r.id)} onStar={() => star(r)} onRun={setRun} /></li>)}
            </ul>
          ) : (
            <ul className="-mx-3 mt-2 flex flex-col">
              {rows.map((r) => (
                <li key={r.id} className="group/li relative">
                  <ReportRow r={r} onRun={setRun} className="max-md:pr-11" />
                  <StarBtn on={stars.has(r.id)} onClick={() => star(r)} name={r.headline} className="absolute right-[76px] top-1/2 -translate-y-1/2 max-md:right-2 max-md:top-3 max-md:translate-y-0" />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <RunPreview run={run} onClose={() => setRun(null)} />
      {toastNode}
    </>
  )
}

function StarBtn({ on, onClick, name, className = '' }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={on ? `Saved: ${name}` : `Save ${name}`} title={on ? 'Saved' : 'Save'}
      className={`grid h-8 w-8 place-items-center rounded-full outline-none transition-[opacity,color,background-color] duration-150 hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'text-stone-900' : 'text-stone-500 opacity-0 group-hover/li:opacity-100 group-hover/tile:opacity-100 max-md:opacity-100'} ${className}`}>
      <Star size={15} fill={on ? 'currentColor' : 'none'} strokeWidth={1.75} aria-hidden />
    </button>
  )
}

// a tile: the hero as a large thumbnail (hover: the report's score, prompts and share of voice), its headline, the
// verdict, brand and date
function Tile({ r, starred, onStar, onRun }) {
  const cls = 'thumb-live group flex w-full flex-col gap-3 rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--color-page)]'
  const body = (
    <>
      <span className="relative grid aspect-[16/10] w-full place-items-center overflow-hidden rounded-2xl bg-tint transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-translate-y-0.5 motion-reduce:transition-none">
        <Thumb kind={r.kind} net={r.kindNet} className="h-[52%] w-[64%] transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] md:group-hover:-translate-y-5 md:group-focus-visible:-translate-y-5 motion-reduce:transition-none" />
        <span className="absolute inset-x-2.5 bottom-2.5 hidden grid-cols-3 gap-2 rounded-xl bg-surface/90 px-3 py-2 opacity-0 shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-sm transition-[opacity,transform] duration-200 ease-out md:grid md:translate-y-2 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-visible:translate-y-0 md:group-focus-visible:opacity-100 motion-reduce:translate-y-0">
          {r.stats.map((m) => (
            <span key={m.id} className="min-w-0">
              <span className={`block truncate text-[11px] leading-4 ${t3}`}>{m.label}</span>
              <span className="flex items-baseline gap-1 tabular-nums"><span className="text-[14px] leading-5 font-semibold text-stone-900">{m.value}{m.unit ?? ''}</span><Delta d={m.delta} /></span>
            </span>
          ))}
        </span>
      </span>
      <span className="px-0.5">
        <span className="line-clamp-2 text-[14px] leading-5 font-semibold text-stone-900 [text-wrap:pretty]">{r.headline}</span>
        <span className={`mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-4 ${t3}`}>
          <VerdictDot verdict={r.verdict} />
          <span className="inline-flex min-w-0 items-center gap-1.5"><BrandLogo id={r.brand} className="h-3.5 w-3.5" /><span className="truncate">{brandOf(r.brand)?.name}</span></span>
          <span className="inline-flex items-center gap-1 tabular-nums">{r.scheduled && <Repeat size={12} aria-label="Scheduled" className="text-stone-500" />}{r.created}</span>
        </span>
      </span>
    </>
  )
  return (
    <article className="group/tile relative" aria-label={r.headline}>
      {r.run
        ? <button type="button" onClick={() => onRun(r)} className={cls}>{body}</button>
        : <a href={`/reports/${r.id}`} onClick={linkClick(`/reports/${r.id}`)} className={cls}>{body}</a>}
      <StarBtn on={starred} onClick={onStar} name={r.headline} className="absolute right-2 top-2 bg-surface/70 backdrop-blur-sm" />
    </article>
  )
}

// the weekly verdicts as a streak: one dot per weekly summary over the last 12 weeks (before the first two syncs there
// was nothing to compare); hover or focus a dot for its headline
const fmtDay = (dt) => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dt.getMonth()]} ${dt.getDate()}`
const TONE_DOT = { up: 'var(--ink)', mid: 'var(--color-stone-400)', down: 'var(--negative)' }
function Streak({ brandId, onRun }) {
  const runs = weeklyRuns(brandId)
  if (!runs.length) return null
  const first = parseDay(runs[0].date)
  const before = Array.from({ length: 12 - runs.length }, (_, i) => {
    const dt = new Date(first)
    dt.setDate(dt.getDate() - 7 * (12 - runs.length - i))
    const day = fmtDay(dt)
    return { empty: true, date: day, note: day === DATES[0] ? 'First sync: nothing to compare with yet' : 'Not tracked yet' }
  })
  const slots = [...before, ...runs]
  let streak = 0
  for (let i = runs.length - 1; i >= 0 && VERDICT_TONE[runs[i].verdict] === 'up'; i--) streak++
  const summary = streak >= 2 ? `${streak} good weeks in a row` : `${runs.at(-1).verdict} last week`
  return (
    <section aria-label={`Weekly verdicts for ${brandOf(brandId)?.name}`} className="mt-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[13px] leading-5"><span className="font-semibold text-stone-900">Weekly verdicts</span><span className={t3}> · {brandOf(brandId)?.name} · last 12 weeks</span></p>
        <p className="text-[13px] leading-5 font-medium text-stone-900">{summary}</p>
      </div>
      <ol className="relative mt-3 grid grid-cols-12">
        <span aria-hidden className="absolute left-[4.17%] right-[4.17%] top-[11px] h-px bg-line" />
        {slots.map((x, i) => {
          const tone = x.empty ? null : VERDICT_TONE[x.verdict]
          const side = i < 6 ? 'left-0' : 'right-0'
          const label = x.empty ? `${x.date}: ${x.note}` : `${x.date}: ${x.verdict}. ${x.headline}`
          const open = () => { if (x.empty) return; if (x.run) onRun(x); else navigate(`/reports/${x.id}`) }
          return (
            <li key={x.date} className="relative flex flex-col items-center gap-1.5">
              <button type="button" onClick={open} aria-label={label} aria-disabled={x.empty || undefined}
                className={`group/dot relative grid h-[22px] w-[22px] place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus ${x.empty ? 'cursor-default' : 'hover:bg-tint'}`}>
                {x.empty
                  ? <span className="h-1.5 w-1.5 rounded-full border border-stone-300 bg-[var(--color-page)]" />
                  : <span className="h-3 w-3 rounded-full ring-[3px] ring-[var(--color-page)] transition-transform duration-150 group-hover/dot:scale-125" style={{ background: TONE_DOT[tone] }} />}
                <span aria-hidden className={`pointer-events-none absolute bottom-full z-20 mb-2 hidden w-64 rounded-lg border border-line bg-raised p-3 text-left shadow-md group-hover/dot:block group-focus-visible/dot:block motion-safe:animate-[fade-in_120ms_ease-out] ${side}`}>
                  <span className={`block text-[12px] leading-4 tabular-nums ${t3}`}>Week of {x.date}</span>
                  {x.empty ? <span className="mt-1 block text-[13px] leading-[18px] text-stone-700">{x.note}</span> : (
                    <>
                      <VerdictDot verdict={x.verdict} className="mt-1.5" />
                      <span className="mt-1 block text-[13px] leading-[18px] font-medium text-stone-900">{x.headline}</span>
                    </>
                  )}
                </span>
              </button>
              <span className={`whitespace-nowrap text-[11px] leading-4 tabular-nums ${t3} ${i === 0 || i === slots.length - 1 ? '' : 'max-md:invisible'}`}>{x.date}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// an earlier run of a weekly summary: what was sent that week (the full report is kept for the newest run)
function RunPreview({ run, onClose }) {
  const sch = run && schedules.find((x) => x.brand === run.brand && x.title === 'Weekly summary')
  const s = run && runSummary(run)
  const who = sch ? (sch.recipients.length > 1 ? `${sch.recipients.slice(0, -1).join(', ')} and ${sch.recipients.at(-1)}` : sch.recipients[0]) : ''
  const latest = run && weeklyRuns(run.brand).at(-1)
  return (
    <Modal open={!!run} onClose={onClose} size="lg" title={run ? `Weekly summary · week of ${run.date}` : ''} subtitle={run ? `Sent ${run.date} at 9am${who ? ` to ${who}` : ''}` : ''}>
      {run && (
        <div className="flex flex-col gap-6">
          <Block block={{ id: 'header', type: 'header', data: s.header }} title="Weekly summary" />
          <Block block={{ id: 'scoreline', type: 'scoreline', data: s.scoreline }} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className={`max-w-[52ch] text-[12px] leading-[18px] ${t3}`}>Earlier weeks keep what was sent. The full report, with its sections and actions, is kept for the latest week.</p>
            {latest && <a href={`/reports/${latest.id}`} onClick={(e) => { onClose(); linkClick(`/reports/${latest.id}`)(e) }} className={lineBtn}>Open the latest<ArrowRight size={14} aria-hidden /></a>}
          </div>
        </div>
      )}
    </Modal>
  )
}

// ---- Scheduled: reports that write and send themselves, and the email each one sends
const people = (n) => `to ${n} ${n === 1 ? 'person' : 'people'}`
function Scheduled() {
  const [list, setList] = useState(mockEmpty() ? [] : schedules.map((s) => ({ ...s, paused: false })))
  // ?preview=<id> opens that schedule's email; opened after mount, since a dialog that mounts open closes itself on
  // StrictMode's second run of its Back-button effect
  const [preview, setPreview] = useState(null)
  useEffect(() => { setPreview(new URLSearchParams(window.location.search).get('preview')) }, [])
  const [toastNode, toast] = useToast({ position: 'center' })
  const COLS = 'md:grid md:grid-cols-[minmax(0,1fr)_190px_120px_64px_32px]'
  return (
    <>
      <ReportsHead title="Scheduled" subtitle="Reports that write themselves from the latest sync and arrive by email" />
      {list.length ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className={`hidden h-9 items-center gap-3 border-b border-[var(--div)] bg-tint px-5 text-[13px] leading-[18px] font-medium ${t3} ${COLS}`}>
            <span>Report</span><span>When</span><span>To</span><span>Next</span><span />
          </div>
          <ul className="divide-y divide-[var(--div)]">
            {list.map((s) => (
              <li key={s.id} className={`flex min-h-14 items-center gap-3 px-5 py-2.5 transition-colors duration-150 hover:bg-tint max-md:px-4 ${COLS}`}>
                <button type="button" onClick={() => setPreview(s.id)} className="min-w-0 flex-1 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-focus">
                  <span className="flex items-center gap-2 text-[14px] leading-5 font-medium text-stone-900"><BrandLogo id={s.brand} /><span className="truncate">{s.title}</span></span>
                  <span className={`mt-0.5 block truncate text-[12px] leading-4 ${t3}`}>{brandOf(s.brand)?.name}<span className="md:hidden"> · {s.paused ? 'Paused' : s.cadence} · {people(s.recipients.length)}</span></span>
                </button>
                <span className={`hidden text-[13px] ${s.paused ? t3 : 'text-stone-700'} md:block`}>{s.paused ? 'Paused' : s.cadence}</span>
                <span className={`hidden text-[13px] ${t2} md:block`} title={s.recipients.join(', ')}>{people(s.recipients.length)}</span>
                <span className={`hidden text-[13px] tabular-nums ${t2} md:block`}>{s.paused ? '—' : s.next}</span>
                <ActionMenu label={`Actions for ${s.title}`} className="grid h-8 w-8 place-items-center rounded-md text-stone-600 outline-none hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"
                  items={[
                    { label: 'Preview the email', onClick: () => setPreview(s.id) },
                    { label: s.paused ? 'Resume' : 'Pause', onClick: () => { setList((l) => l.map((x) => (x.id === s.id ? { ...x, paused: !x.paused } : x))); toast(s.paused ? `Resumed “${s.title}”` : `Paused “${s.title}”`) } },
                    { label: 'Delete', danger: true, onClick: () => { setList((l) => l.filter((x) => x.id !== s.id)); toast(`Deleted the schedule for “${s.title}”`) } },
                  ]}>
                  <MoreHorizontal size={16} aria-hidden />
                </ActionMenu>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Empty title="Nothing scheduled" action={<a href="/reports/all" onClick={linkClick('/reports/all')} className={lineBtn}>Open a report</a>}>
          Open any report and choose Schedule this report. It’s written again from the latest sync each time and sent by email.
        </Empty>
      )}
      <EmailPreview s={list.find((s) => s.id === preview)} onClose={() => setPreview(null)} />
      {toastNode}
    </>
  )
}

// the email a schedule sends: the short answer, the key numbers, and a link to the full report
const SENT = { 'Mondays 9am': 'every Monday at 9am', '1st of the month 8am': 'on the 1st of each month at 8am', 'Every other Friday 10am': 'every other Friday at 10am' }
export function EmailPreview({ s, onClose }) {
  const saved = s && savedReports.find((x) => x.id === s.reportId)
  const r = saved && buildReport(saved.opts, saved.prompt)
  const range = r?.ok ? periodRange(r.opts.period) : ''
  const pick = (type) => r?.blocks?.find((b) => b.type === type)
  return (
    <Modal open={!!s} onClose={onClose} size="lg" title="Email preview" subtitle={s ? `What ${s.recipients.length > 1 ? `${s.recipients.slice(0, -1).join(', ')} and ${s.recipients[s.recipients.length - 1]}` : s.recipients[0]} ${s.recipients.length === 1 ? 'gets' : 'get'}, ${SENT[s.cadence] ?? s.cadence}` : ''}>
      {s && r?.ok && (
        <div className="overflow-hidden rounded-xl border border-line">
          <dl className={`grid grid-cols-[64px_1fr] gap-x-3 gap-y-1 border-b border-line bg-tint px-4 py-3 text-[13px] leading-[18px] ${t2}`}>
            <dt className={t3}>From</dt><dd className="text-stone-900">Kraffic Reports for PTA Agency</dd>
            <dt className={t3}>To</dt><dd className="text-stone-900">{s.recipients.join(', ')}</dd>
            <dt className={t3}>Subject</dt><dd className="font-medium text-stone-900">{brandOf(s.brand)?.name} · {s.title} · {range}</dd>
          </dl>
          <div className="flex flex-col gap-5 bg-surface px-6 py-6 max-md:px-4">
            {pick('header') && <Block block={pick('header')} title={s.title} />}
            {pick('scoreline') && <Block block={pick('scoreline')} />}
            <div><span className={inkBtn}>Open the full report</span></div>
            <p className={`border-t border-line pt-4 text-[12px] leading-[18px] ${t3}`}>Sent {SENT[s.cadence] ?? s.cadence} by Kraffic for PTA Agency, written from the latest sync each time. To change or stop it, open Scheduled in Kraffic.</p>
          </div>
        </div>
      )}
    </Modal>
  )
}
