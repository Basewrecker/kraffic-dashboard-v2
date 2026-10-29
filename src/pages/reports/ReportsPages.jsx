import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Briefcase, CalendarDays, Check, ChevronRight, MoreHorizontal, PenLine, Repeat, Search, Sparkles, Star, Swords } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Segmented from '../../components/dashboard/Segmented'
import ActionMenu from '../../components/audit/ActionMenu'
import { useToast } from '../../components/dashboard/overlays'
import { linkClick, navigate, usePath } from '../../router'
import { AUDIENCES, KINDS, REPORT_BRANDS, VERDICT_TONE, buildReport, library, monthGroup, periodRange, runSummary, savedReports, schedules } from '../../data/reports'
import { brand as workspaceBrand } from '../../store/workspace'
import ReportThread from './ReportPage'
import { Block, Thumb, VerdictDot } from './blocks'
import { DotIllustration } from './DotField'
import { BetaTag, BrandLogo, ChipMenu, Empty, ReportsHead, brandOf, defaultBrand, inkBtn, lineBtn, menuItem, t2, t3 } from './parts'

// /reports → New report (the empty thread) · /reports/all → All reports · /reports/scheduled → Scheduled
// /reports/<id> (and /reports/new?… · /reports/view?…) → the report thread. The empty state and every report are the same
// element (ReportThread), so sending a question turns the page into a thread without remounting it.
// ?mock=empty: no reports (All reports, Scheduled)
export default function ReportsRouter() {
  const path = usePath()
  const rest = path.replace(/^\/reports\/?/, '')
  useEffect(() => {
    if (rest === 'all') document.title = 'Reports · Kraffic'
    else if (rest === 'scheduled') document.title = 'Scheduled reports · Kraffic'
  }, [rest])
  if (rest === 'all') return <AllReports />
  if (rest === 'scheduled') return <Scheduled />
  return <ReportThread rest={rest} />
}
const mockEmpty = () => new URLSearchParams(window.location.search).get('mock') === 'empty'

const AUD = Object.fromEntries(AUDIENCES.map((a) => [a.id, a.label]))
const groupBy = (xs, key) => { const m = new Map(); for (const x of xs) { const k = key(x); m.set(k, [...(m.get(k) ?? []), x]) } return [...m] }
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// ---- All reports: the reports for the brand you're viewing (the brand switcher), or every brand, grouped by brand.
// Calm and scannable: Starred (if any) · Series (each scheduled report, one row: its verdict history as dots, the latest
// headline; click to see its past runs) · One-off reports by month. Search, Type and Audience; one quiet line for the
// schedules
const TYPES = Object.entries(KINDS).map(([id, k]) => ({ id, label: k.name }))
const KIND_ICON = { weekly: CalendarDays, ceo: Briefcase, rival: Swords, content: PenLine }
const KIND_WORD = { weekly: 'Summary', ceo: 'CEO summary', rival: 'Competitor', content: 'Content plan' }
const TONE_DOT = { up: 'var(--ink)', mid: 'var(--color-stone-400)', down: 'var(--negative)' }
const toneOf = (v) => VERDICT_TONE[v] ?? 'mid'
// the brand in scope: the one the brand switcher is on (when it has reports at all), else the default
const scopeBrand = () => (REPORT_BRANDS.some((b) => b.id === workspaceBrand.id) ? workspaceBrand.id : defaultBrand())
const H2 = 'flex items-baseline gap-2 text-[15px] leading-5 font-semibold text-stone-900'

function AllReports() {
  const q0 = new URLSearchParams(window.location.search)
  const home = q0.get('brand') ?? scopeBrand()
  const [scope, setScope] = useState(q0.get('scope') === 'all' ? 'all' : 'brand')
  const [search, setSearch] = useState('')
  const [type, setType] = useState(null)
  const [aud, setAud] = useState(null)
  const [open, setOpen] = useState(() => new Set(q0.get('open') ? [q0.get('open')] : []))
  const [stars, setStars] = useState(() => new Set(savedReports.filter((r) => r.saved).map((r) => r.id)))
  const [run, setRun] = useState(null)
  const [toastNode, toast] = useToast({ position: 'center' })
  const lib = useMemo(() => (mockEmpty() ? { series: [], oneOffs: [], scheduled: 0 } : library(scope === 'all' ? null : home)), [scope, home])
  const s = search.trim().toLowerCase()
  const fits = (kind, audience, text) => (!type || kind === type) && (!aud || audience === aud) && (!s || text.toLowerCase().includes(s))
  const series = lib.series.filter((x) => fits(x.kind, x.audience, `${x.title} ${x.runs.map((r) => r.headline).join(' ')} ${brandOf(x.brand)?.name}`))
  const oneOffs = lib.oneOffs.filter((r) => fits(r.kind, r.audience, `${r.headline} ${r.title} ${brandOf(r.brand)?.name}`))
  const total = lib.series.length + lib.oneOffs.length
  const filtered = !!(type || aud || s)
  const clear = () => { setSearch(''); setType(null); setAud(null) }
  const star = (id, name) => {
    const on = !stars.has(id)
    setStars((x) => { const n = new Set(x); if (on) n.add(id); else n.delete(id); return n })
    toast(on ? `Starred “${name}”` : 'Removed from starred')
  }
  const toggle = (id) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const starred = [
    ...series.filter((x) => stars.has(x.reportId)).map((x) => ({ id: x.reportId, kind: x.kind, brand: x.brand, headline: x.latest.headline, title: x.title, date: x.latest.date })),
    ...oneOffs.filter((r) => stars.has(r.id)).map((r) => ({ id: r.id, kind: r.kind, brand: r.brand, headline: r.headline, title: KIND_WORD[r.kind], date: r.created })),
  ].slice(0, 3)
  const all = scope === 'all'
  const newBtn = <a href="/reports" onClick={linkClick('/reports')} className={inkBtn}><Sparkles size={14} aria-hidden />New report</a>
  const radio = (opts, cur, set) => (close) => [{ id: null, label: 'All' }, ...opts].map((o) => (
    <button key={o.id ?? 'all'} type="button" role="menuitemradio" aria-checked={cur === o.id} onClick={() => { set(o.id); close() }} className={`${menuItem} text-stone-900`}>
      <span className="min-w-0 flex-1 truncate">{o.label}</span>{cur === o.id && <Check size={14} className="shrink-0 text-ink" aria-hidden />}
    </button>
  ))
  const homeName = brandOf(home)?.name ?? 'This brand'

  // the reports of one brand (or, in All brands, one brand's group): its series, then its one-offs by month
  const body = (ss, oo, showBrand) => (
    <>
      {ss.length > 0 && (
        <section aria-label="Series">
          <h3 className={`${H2} mb-1`}>Series <span className={`text-[13px] font-normal tabular-nums ${t3}`}>{ss.length}</span></h3>
          <ul className="-mx-3 flex flex-col">
            {ss.map((x) => <SeriesRow key={x.id} s={x} open={open.has(x.id)} onToggle={() => toggle(x.id)} onRun={setRun} starred={stars.has(x.reportId)} onStar={() => star(x.reportId, x.title)} showBrand={showBrand} />)}
          </ul>
        </section>
      )}
      {groupBy(oo, (r) => monthGroup(r.created)).map(([month, rows]) => (
        <section key={month} aria-label={`${month}, one-off reports`}>
          <h3 className={`${H2} mb-1`}>{month} <span className={`text-[13px] font-normal ${t3}`}>· one-off reports</span></h3>
          <ul className="-mx-3 flex flex-col">
            {rows.map((r) => <OneOffRow key={r.id} r={r} starred={stars.has(r.id)} onStar={() => star(r.id, r.headline)} showBrand={showBrand} />)}
          </ul>
        </section>
      ))}
    </>
  )

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">
            Reports {total > 0 && <span className={`ml-1 text-[15px] font-normal tracking-normal tabular-nums ${t3} lg:text-[17px]`}>{filtered ? `${series.length + oneOffs.length} of ${total}` : total}</span>}
          </h1>
          <BetaTag tipAlign="left" />
        </div>
        {newBtn}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex h-8 items-center max-md:w-full">
          <Search size={14} className="pointer-events-none absolute left-3 text-stone-500" aria-hidden />
          <span className="sr-only">Search reports</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search headlines"
            className="h-8 w-60 rounded-full bg-tint pl-8 pr-3 text-[13px] text-stone-900 outline-none placeholder:text-stone-500 focus-visible:ring-2 focus-visible:ring-focus max-md:w-full" />
        </label>
        <ChipMenu label="Type" value={TYPES.find((x) => x.id === type)?.label ?? null} width={240}>{radio(TYPES, type, setType)}</ChipMenu>
        <ChipMenu label="Audience" value={AUD[aud] ?? null} width={200}>{radio(AUDIENCES.map((a) => ({ id: a.id, label: a.label })), aud, setAud)}</ChipMenu>
        {filtered && <button type="button" onClick={clear} className="h-8 rounded-full px-2.5 text-[13px] font-medium text-stone-600 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Clear</button>}
        <Segmented className="ml-auto max-md:ml-0" size="sm" label="Brands" value={scope} onChange={setScope} options={[{ value: 'brand', label: homeName }, { value: 'all', label: 'All brands' }]} />
      </div>

      {lib.scheduled > 0 && (
        <p className={`flex items-center gap-1.5 text-[13px] leading-5 ${t2}`}>
          <Repeat size={14} className="text-stone-500" aria-hidden />{lib.scheduled} scheduled ·
          <a href="/reports/scheduled" onClick={linkClick('/reports/scheduled')} className="inline-flex items-center gap-1 rounded font-medium text-stone-700 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Manage<ArrowRight size={13} aria-hidden /></a>
        </p>
      )}

      {total === 0 ? (
        <div className="flex flex-col items-center px-4 pb-16 pt-14 text-center">
          <DotIllustration className="h-[120px] w-[220px]" />
          <p className="mt-6 text-[17px] leading-6 font-semibold text-stone-900">{all ? 'No reports yet' : `No reports for ${homeName} yet`}</p>
          <p className={`mt-1.5 max-w-[46ch] text-[14px] leading-5 ${t2}`}>Ask a question and Kraffic writes the report from your tracked prompts and keeps it here. Scheduled reports show up as a series.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">{newBtn}{!all && !mockEmpty() && <button type="button" onClick={() => setScope('all')} className={lineBtn}>See all brands</button>}</div>
        </div>
      ) : series.length + oneOffs.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-14 text-center">
          <p className="text-[15px] leading-5 font-semibold text-stone-900">No reports match</p>
          <p className={`mt-1 text-[13px] leading-[18px] ${t2}`}>Try another word, or clear the filters.</p>
          <button type="button" onClick={clear} className={`${lineBtn} mt-4`}>Clear filters</button>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-8">
          {starred.length > 0 && (
            <section aria-label="Starred">
              <h2 className={`${H2} mb-1`}><Star size={14} className="fill-current text-stone-900" aria-hidden />Starred</h2>
              <ul className="-mx-3 flex flex-col">
                {starred.map((r) => {
                  const Icon = KIND_ICON[r.kind] ?? Sparkles
                  return (
                    <li key={r.id}>
                      <a href={`/reports/${r.id}`} onClick={linkClick(`/reports/${r.id}`)} className="group flex min-h-10 items-center gap-3 rounded-lg px-3 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus">
                        <Icon size={15} className="shrink-0 text-stone-500" aria-hidden />
                        <span className="w-[132px] shrink-0 truncate text-[13px] leading-[18px] text-stone-600 max-md:hidden">{r.title}</span>
                        <span className="min-w-0 flex-1 truncate text-[14px] leading-5 font-medium text-stone-900">{r.headline}</span>
                        {all && <BrandLogo id={r.brand} className="h-4 w-4" />}
                        <span className={`w-12 shrink-0 text-right text-[12px] tabular-nums ${t3}`}>{r.date}</span>
                      </a>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
          {all
            ? REPORT_BRANDS.filter((b) => series.some((x) => x.brand === b.id) || oneOffs.some((r) => r.brand === b.id)).map((b) => (
              <section key={b.id} aria-label={b.name} className="flex flex-col gap-6 border-t border-[var(--div)] pt-6">
                <h2 className="flex items-center gap-2.5 text-[17px] leading-6 font-semibold text-stone-900"><BrandLogo id={b.id} className="h-5 w-5" />{b.name}</h2>
                {body(series.filter((x) => x.brand === b.id), oneOffs.filter((r) => r.brand === b.id), false)}
              </section>
            ))
            : body(series, oneOffs, false)}
        </div>
      )}
      <RunPreview run={run} onClose={() => setRun(null)} />
      {toastNode}
    </>
  )
}

// a series: one row. Name and schedule; the verdict history as dots (oldest → newest, at most 12; hover one for that
// run's headline); the latest headline, its date and Open latest. Click the row: its past runs, in place
function SeriesRow({ s, open, onToggle, onRun, starred, onStar, showBrand }) {
  const [tip, setTip] = useState(null)
  const dots = s.runs.slice(0, 12).reverse()
  const id = `runs-${s.id}`
  const openLatest = (e) => { e.stopPropagation(); linkClick(`/reports/${s.reportId}`)(e) }
  return (
    <li className="group/li border-b border-[var(--div)] last:border-0">
      <div onClick={onToggle} className="relative grid cursor-pointer grid-cols-[minmax(0,230px)_188px_minmax(0,1fr)] items-center gap-x-6 gap-y-2 rounded-lg px-3 py-3 transition-colors duration-150 hover:bg-tint max-md:grid-cols-[minmax(0,1fr)_auto]">
        <button type="button" aria-expanded={open} aria-controls={id} onClick={(e) => { e.stopPropagation(); onToggle() }} className="flex min-w-0 items-start gap-2 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <ChevronRight size={16} className={`mt-0.5 shrink-0 text-stone-500 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} aria-hidden />
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-[15px] leading-5 font-medium text-stone-900">{showBrand && <BrandLogo id={s.brand} className="h-4 w-4" />}<span className="truncate">{s.title}</span></span>
            <span className={`block text-[12px] leading-4 ${t3}`}>{s.cadence} · {s.recipients === 1 ? '1 recipient' : `${s.recipients} recipients`}</span>
          </span>
        </button>
        <span className="relative flex items-center gap-1.5" onMouseLeave={() => setTip(null)} role="img" aria-label={`Verdicts, oldest to newest: ${dots.map((r) => `${r.date} ${r.verdict}`).join(', ')}`}>
          {dots.map((r, i) => <span key={r.id} onMouseEnter={() => setTip(i)} className="h-2.5 w-2.5 rounded-full transition-transform duration-150 hover:scale-125" style={{ background: TONE_DOT[toneOf(r.verdict)] }} />)}
          {tip != null && (
            <span role="tooltip" className="pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-[280px] -translate-x-1/2 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 text-stone-800 shadow-sm" style={{ left: tip * 16 + 5 }}>
              <span className={`block ${t3}`}>{dots[tip].date} · {dots[tip].verdict}</span>{dots[tip].headline}
            </span>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-4 max-md:col-span-2">
          <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-stone-700">{s.latest.headline}</span>
          <span className={`shrink-0 text-[12px] tabular-nums ${t3}`}>{s.latest.date}</span>
          <a href={`/reports/${s.reportId}`} onClick={openLatest} className="inline-flex shrink-0 items-center gap-1 rounded text-[13px] font-medium text-stone-700 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Open latest<ArrowRight size={14} aria-hidden /></a>
          <StarBtn on={starred} onClick={(e) => { e?.stopPropagation?.(); onStar() }} name={s.title} className="-my-1 shrink-0" />
        </span>
      </div>
      {open && (
        <ol id={id} className="mb-3 ml-9 mr-3 flex flex-col border-l border-line motion-safe:animate-[fade-in_150ms_ease-out] max-md:ml-5">
          {s.runs.map((r) => {
            const cls = 'grid w-full grid-cols-[56px_minmax(0,1fr)_112px_96px] items-center gap-4 rounded-r-lg py-2 pl-4 pr-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus max-md:grid-cols-[48px_minmax(0,1fr)] max-md:gap-y-0.5'
            const inner = (
              <>
                <span className={`text-[12px] tabular-nums ${t3}`}>{r.date}</span>
                <span className="truncate text-[14px] leading-5 text-stone-900">{r.headline}{!r.run && <span className={`ml-2 text-[12px] ${t3}`}>latest</span>}</span>
                <VerdictDot verdict={r.verdict} className="max-md:col-start-2" />
                <span className={`text-right text-[12px] tabular-nums max-md:hidden ${r.change.startsWith('−') ? 'font-medium text-negative' : t2}`}>{r.change}</span>
              </>
            )
            return (
              <li key={r.id}>
                {r.run
                  ? <button type="button" onClick={() => onRun(r)} className={cls}>{inner}</button>
                  : <a href={`/reports/${r.id}`} onClick={linkClick(`/reports/${r.id}`)} className={cls}>{inner}</a>}
              </li>
            )
          })}
        </ol>
      )}
    </li>
  )
}

// a one-off report: its hero as a 56px thumbnail, the type's icon and the headline, the verdict, the audience, the date;
// hovering tints the row and shows "Open →"
function OneOffRow({ r, starred, onStar, showBrand }) {
  const Icon = KIND_ICON[r.kind] ?? Sparkles
  return (
    <li className="group/li relative">
      <a href={`/reports/${r.id}`} onClick={linkClick(`/reports/${r.id}`)}
        className="thumb-live group grid grid-cols-[56px_minmax(0,1fr)_104px_96px_48px_64px] items-center gap-4 rounded-lg px-3 py-2 pr-12 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus max-md:grid-cols-[56px_minmax(0,1fr)] max-md:gap-y-1">
        <span className="row-span-2 grid h-8 w-14 place-items-center rounded-md bg-tint transition-colors duration-150 group-hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] md:row-span-1"><Thumb kind={r.kind} className="h-6 w-11" /></span>
        <span className="flex min-w-0 items-center gap-2">
          <Icon size={14} className="shrink-0 text-stone-500" aria-label={KIND_WORD[r.kind]} />
          {showBrand && <BrandLogo id={r.brand} className="h-4 w-4" />}
          <span className="truncate text-[15px] leading-5 font-medium text-stone-900">{r.headline}</span>
        </span>
        <span className="max-md:hidden">{r.verdict && <VerdictDot verdict={r.verdict} />}</span>
        <span className={`truncate text-[12px] ${t3} max-md:hidden`}>{AUD[r.audience]}</span>
        <span className={`text-right text-[12px] tabular-nums ${t3} max-md:hidden`}>{r.created}</span>
        <span className="hidden items-center justify-end gap-1 text-[13px] font-medium text-stone-900 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 md:inline-flex">Open<ArrowRight size={14} aria-hidden /></span>
        <span className={`col-start-2 flex items-center gap-3 text-[12px] ${t3} md:hidden`}>{r.verdict && <VerdictDot verdict={r.verdict} />}<span>{AUD[r.audience]}</span><span className="tabular-nums">{r.created}</span></span>
      </a>
      <StarBtn on={starred} onClick={onStar} name={r.headline} className="absolute right-2 top-1/2 -translate-y-1/2" />
    </li>
  )
}

function StarBtn({ on, onClick, name, className = '' }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={on ? `Starred: ${name}` : `Star ${name}`} title={on ? 'Starred' : 'Star'}
      className={`grid h-8 w-8 place-items-center rounded-full outline-none transition-[opacity,color,background-color] duration-150 hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'text-stone-900' : 'text-stone-500 opacity-0 group-hover/li:opacity-100 max-md:opacity-100'} ${className}`}>
      <Star size={15} className={on ? 'fill-current' : ''} aria-hidden />
    </button>
  )
}

// an earlier run of a series: what was sent that time (the full report is kept for the latest run)
function RunPreview({ run, onClose }) {
  const sch = run && schedules.find((x) => x.id === run.series)
  const s = run && runSummary(run)
  const who = sch ? (sch.recipients.length > 1 ? `${sch.recipients.slice(0, -1).join(', ')} and ${sch.recipients.at(-1)}` : sch.recipients[0]) : ''
  return (
    <Modal open={!!run} onClose={onClose} size="lg" title={run ? `${run.title} · ${run.date}` : ''} subtitle={run ? `Written from the ${run.date} sync${who ? ` and sent to ${who}` : ''}` : ''}>
      {run && (
        <div className="flex flex-col gap-6">
          <Block block={{ id: 'header', type: 'header', data: s.header }} title={run.title} />
          <Block block={{ id: 'scoreline', type: 'scoreline', data: s.scoreline }} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className={`max-w-[52ch] text-[12px] leading-[18px] ${t3}`}>Earlier runs keep what was sent. The full report, with its sections and actions, is kept for the latest run.</p>
            {sch && <a href={`/reports/${sch.reportId}`} onClick={(e) => { onClose(); linkClick(`/reports/${sch.reportId}`)(e) }} className={lineBtn}>Open the latest<ArrowRight size={14} aria-hidden /></a>}
          </div>
        </div>
      )}
    </Modal>
  )
}

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
            {pick('hero') && <Block block={pick('hero')} title={s.title} />}
            <div><span className={inkBtn}>Open the full report</span></div>
            <p className={`border-t border-line pt-4 text-[12px] leading-[18px] ${t3}`}>Sent {SENT[s.cadence] ?? s.cadence} by Kraffic for PTA Agency, written from the latest sync each time. To change or stop it, open Scheduled in Kraffic.</p>
          </div>
        </div>
      )}
    </Modal>
  )
}
