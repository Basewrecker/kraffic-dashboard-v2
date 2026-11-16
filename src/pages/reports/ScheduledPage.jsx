import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, MoreHorizontal, Plus, X } from 'lucide-react'
import ActionMenu from '../../components/audit/ActionMenu'
import Segmented from '../../components/dashboard/Segmented'
import DrawerShell, { useDrawer } from '../../components/audit/DrawerShell'
import { openDrawer } from '../../components/audit/parts'
import Marker from '../../components/ui/Marker'
import { useToast } from '../../components/dashboard/overlays'
import { navigate } from '../../router'
import { DEFAULT_OPTS, REPORT_BRANDS, savedReports, schedules, seriesRuns, templatesFor } from '../../data/reports'
import { verdictTone, verdictWord } from '../../data/verdicts'
import { initials } from '../../data/schedules'
import { brand as workspaceBrand } from '../../store/workspace'
import { Thumb } from './blocks'
import { BetaTag, BrandLogo, brandOf, defaultBrand, inkBtn, t3 } from './parts'
import { writeReport } from './ReportPage'

// Scheduled: reports that write themselves and arrive by email. The same frame as All reports (title + Beta, the brand
// switcher, New schedule). Filled: the Upcoming strip (the next 14 days) above one list panel (When · Report · Last sent
// · To; actions on hover). Empty: the same panel, its rows the three suggestions with a preview from the latest sync and
// Set up. New / edit: the site's right drawer (DrawerShell), ?schedule=new|tpl-<id>|<schedule id>.
// ?mock=empty: no schedules · ?brand=<id>: the brand in scope
const mockEmpty = () => new URLSearchParams(window.location.search).get('mock') === 'empty'
const scopeBrand = () => {
  const q = new URLSearchParams(window.location.search).get('brand')
  if (q && REPORT_BRANDS.some((b) => b.id === q)) return q
  return REPORT_BRANDS.some((b) => b.id === workspaceBrand.id) ? workspaceBrand.id : defaultBrand()
}
const CARD = 'rounded-xl border border-[var(--rep-line)] bg-surface [box-shadow:var(--rep-shadow)]'
const META = `text-[13px] leading-[18px] ${t3}`
const GRID = 'grid grid-cols-[minmax(170px,0.8fr)_minmax(230px,1.2fr)_minmax(300px,2fr)_120px] items-center gap-6 max-lg:grid-cols-1 max-lg:gap-1'
const TODAY = new Date(2026, 9, 28) // the mock's today: Wednesday, Oct 28
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TIMES = ['8:00', '9:00', '10:00', '12:00', '16:00']
const TONE_DOT = { up: 'var(--ink)', mid: 'var(--color-stone-400)', caution: 'var(--caution)' }
const ACT = 'text-[13px] font-medium text-stone-700 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus rounded'
const COMING_SOON = 'Coming soon: sending is part of the app, not the preview.'
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const dayLine = (d) => `${WD[d.getDay()]} ${MO[d.getMonth()]} ${d.getDate()}`
const parseNext = (s) => { const [m, d] = s.next.split(' '); return new Date(2026, MO.indexOf(m), Number(d)) }

// a schedule's sends in a window: weekly / every other week from its next send, monthly on the 1st, after each sync
// (the Monday sync). Paused schedules send nothing.
function sendsOf(s, from, days) {
  if (!s.on) return []
  const end = addDays(from, days - 1)
  const first = parseNext(s)
  const step = /other/i.test(s.cadence) ? 14 : /month/i.test(s.cadence) ? null : 7
  const out = []
  if (!step) { for (let m = new Date(first); m <= end; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) if (m >= from) out.push(m) }
  else for (let d = new Date(first); d <= end; d = addDays(d, step)) if (d >= from) out.push(d)
  return out
}
const timeOf = (s) => s.nextAt.split(' · ')[2] ?? ''
// the chip's letter: W(eekly), C(EO / Client update), G(ap)
const letterOf = (s) => (/client/i.test(s.title) ? 'C' : { weekly: 'W', ceo: 'C', rival: 'G', content: 'M' }[savedReports.find((r) => r.id === s.reportId)?.opts.kind] ?? s.title[0])
const daysUntil = (d) => { const n = Math.round((d - TODAY) / 86400000); return n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days` }
const SHORT_DAY = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri' }
const cadenceShort = (s) => s.runs.replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday)\b/, (d) => SHORT_DAY[d]).replace(/^Every/, 'every').replace(/^Monthly/, 'monthly').replace(/^After/, 'after')

// the report a schedule (or a template) would write now: its first line, its first KPIs
function preview(opts, prompt = '') {
  try {
    const b = writeReport({ ...DEFAULT_OPTS, ...opts }, prompt)
    return { line: b?.view?.answer ?? null, kpis: (b?.view?.kpis ?? []).slice(0, 3) }
  } catch { return { line: null, kpis: [] } }
}

// the three suggestions (and the drawer's template tiles), for a brand
function templates(brand) {
  const t = templatesFor(brand)
  const pick = (id) => t.find((x) => x.id === id)
  return [
    { id: 'weekly', name: 'Weekly summary', kind: 'weekly', when: 'Every Mon 9:00', form: { freq: 'week', day: 'Monday', time: '9:00' }, opts: { ...pick('weekly')?.sets, brand } },
    { id: 'ceo', name: 'CEO summary', kind: 'ceo', when: '1st of the month', form: { freq: 'month', date: 1, time: '8:00' }, opts: { ...pick('ceo')?.sets, brand } },
    { id: 'rival', name: 'Competitor gap', kind: 'rival', when: 'After each sync', form: { freq: 'sync' }, opts: { ...pick('rival')?.sets, brand } },
  ].map((x) => { const p = preview(x.opts); return { ...x, preview: p.line, kpiNames: p.kpis.map((k) => k.label).join(' · ') } })
}

function Avatars({ names }) {
  return (
    <span className="inline-flex items-center" title={names.join(', ')} aria-label={`To ${names.join(', ')}`}>
      <span className="flex -space-x-1.5">
        {names.slice(0, 3).map((n) => <span key={n} className="grid h-7 w-7 place-items-center rounded-full border-2 border-surface bg-tint text-[11px] font-semibold text-stone-700" aria-hidden>{initials(n)}</span>)}
        {names.length > 3 && <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-surface bg-tint text-[11px] font-semibold text-stone-600" aria-hidden>+{names.length - 3}</span>}
      </span>
    </span>
  )
}

// Last sent: the same dot strip as Series on All reports (the last 8 sends, coloured by verdict); a dot opens that report
function Dots({ s }) {
  const runs = useMemo(() => seriesRuns(s).slice(0, 8).reverse(), [s])
  const [tip, setTip] = useState(null)
  if (!runs.length) return null
  return (
    <span className="relative flex shrink-0 items-center gap-1.5" onMouseLeave={() => setTip(null)} role="img" aria-label={`Last sends, oldest to newest: ${runs.map((r) => `${r.date} ${verdictWord(r.verdict)}`).join(', ')}`}>
      {runs.map((r, i) => (
        <button key={r.id} type="button" onMouseEnter={() => setTip(i)} onFocus={() => setTip(i)} onClick={(e) => { e.stopPropagation(); navigate(`/reports/${s.reportId}`) }}
          aria-label={`${r.date}: ${r.headline}`} className="h-2.5 w-2.5 rounded-full outline-none transition-transform duration-150 hover:scale-125 focus-visible:ring-2 focus-visible:ring-focus"
          style={{ background: TONE_DOT[verdictTone(r.verdict)] }} />
      ))}
      {tip != null && (
        <span role="tooltip" className="pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-[280px] -translate-x-1/2 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 text-stone-800 shadow-sm" style={{ left: tip * 16 + 5 }}>
          <span className={`block ${t3}`}>{runs[tip].date} · {verdictWord(runs[tip].verdict)}</span>{runs[tip].headline}
        </span>
      )}
    </span>
  )
}

// Upcoming: the next 14 days in one compact row (56px) on the page, a hairline under it. A day is "Mon 2"; a send is an
// 18px chip after the date (W / C / G; hover: what and when; click: its row). Today has a soft fill; a line after each
// Sunday; the month above the 1st
function Upcoming({ rows, onPick }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i))
  const sends = rows.flatMap((s) => sendsOf(s, TODAY, 14).map((d) => ({ s, d })))
  const [tip, setTip] = useState(null)
  return (
    <section aria-label="Upcoming" className="flex h-14 items-end border-b border-[var(--rep-line)] pb-2" onMouseLeave={() => setTip(null)}>
      {days.map((d, i) => {
        const here = sends.filter((x) => sameDay(x.d, d))
        return (
          <div key={i} className={`relative flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md ${sameDay(d, TODAY) ? 'bg-[var(--tabs,var(--tint))]' : ''} ${d.getDay() === 0 && i < 13 ? 'border-r border-[var(--rep-line)] rounded-r-none' : ''}`}>
            {d.getDate() === 1 && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[11px] font-medium uppercase tracking-[.05em] text-stone-500">{MO[d.getMonth()]}</span>}
            <span className="whitespace-nowrap"><span className="text-[12px] text-stone-500">{WD[d.getDay()]}</span> <span className="text-[14px] font-medium tabular-nums text-stone-900">{d.getDate()}</span></span>
            {here.map((x, k) => (
              <button key={k} type="button" onMouseEnter={() => setTip({ i, k })} onFocus={() => setTip({ i, k })} onClick={() => onPick(x.s.id)}
                aria-label={`${x.s.title} · ${dayLine(d)}, ${timeOf(x.s)} · ${x.s.recipients.length} recipient${x.s.recipients.length === 1 ? '' : 's'}`}
                className="grid h-[18px] min-w-[18px] place-items-center rounded-[5px] bg-ink px-1 text-[11px] font-semibold leading-none text-[var(--color-surface)] outline-none focus-visible:ring-2 focus-visible:ring-focus">{letterOf(x.s)}</button>
            ))}
            {tip?.i === i && here[tip.k] && (
              <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-max max-w-[260px] -translate-x-1/2 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 text-stone-800 shadow-sm">
                {here[tip.k].s.title} · {dayLine(d)}, {timeOf(here[tip.k].s)} · {here[tip.k].s.recipients.length} recipient{here[tip.k].s.recipients.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )
      })}
    </section>
  )
}

export default function ScheduledPage() {
  const home = scopeBrand()
  const [scope, setScope] = useState('brand')
  const [list, setList] = useState(() => (mockEmpty() ? [] : schedules.map((s) => ({ ...s }))))
  const [flash, setFlash] = useState(null)
  const [born, setBorn] = useState(null) // a row just made from a suggestion (crossfades in)
  const [toastNode, toast] = useToast({ position: 'center' })
  const homeName = brandOf(home)?.name ?? 'This brand'
  const rows = useMemo(() => list.filter((s) => scope === 'all' || s.brand === home), [list, scope, home])
  const lines = useMemo(() => Object.fromEntries(list.map((s) => { const r = savedReports.find((x) => x.id === s.reportId); return [s.id, r ? preview(r.opts, r.prompt).line : null] })), [list])
  const tpls = useMemo(() => templates(home), [home])
  const patch = (id, p) => setList((l) => l.map((s) => (s.id === id ? { ...s, ...p } : s)))
  const remove = (s) => { setList((l) => l.filter((x) => x.id !== s.id)); toast(`Deleted “${s.title}”`, { action: { label: 'Undo', onClick: () => setList((l) => [...l, s]) } }) }
  const pick = (id) => {
    const el = document.getElementById(`sched-${id}`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setFlash(id); setTimeout(() => setFlash(null), 1400)
  }
  const menu = (s) => [
    { label: 'Edit', onClick: () => openDrawer('schedule', s.id) },
    { label: 'Duplicate', onClick: () => { setList((l) => [...l, { ...s, id: `${s.id}-copy`, title: `${s.title} (copy)`, on: false }]); toast(`Duplicated “${s.title}”`) } },
    { label: s.on ? 'Pause' : 'Resume', onClick: () => patch(s.id, { on: !s.on }) },
    { label: 'Delete', danger: true, onClick: () => remove(s) },
  ]
  const save = (form, editing) => {
    const t = tpls.find((x) => x.id === form.template)
    const title = t ? t.name : form.question.trim() || 'Custom report'
    const when = whenOf(form)
    const rec = { title, brand: form.brand, reportId: t ? savedReports.find((r) => r.brand === form.brand && r.opts.kind === t.kind)?.id ?? null : null, runs: when.runs, cadence: when.cadence, recipients: form.to, next: when.day, nextAt: when.at, delivery: 'Email · PDF' }
    if (editing) patch(editing.id, rec)
    else { const id = `s-new-${Date.now()}`; setList((l) => [...l, { id, ...rec, last: { date: '', status: 'none' }, on: true }]); setBorn(id); setTimeout(() => setBorn(null), 400) }
    toast(`${editing ? 'Saved' : 'Scheduled'} ${title}: next ${when.line}`)
  }

  const empty = rows.length === 0
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">Scheduled</h1>
          <BetaTag tipAlign="left" className="-translate-y-[3px] lg:-translate-y-[5px]" />
        </div>
        <div className="flex items-center gap-2">
          <span title={`Written from ${homeName}’s own scans`}>
            <Segmented size="sm" label="Brands" value={scope} onChange={setScope} options={[{ value: 'brand', label: homeName }, { value: 'all', label: 'All brands' }]} />
          </span>
          <button type="button" onClick={() => openDrawer('schedule', 'new')} className={inkBtn}><Plus size={15} aria-hidden />New schedule</button>
        </div>
      </div>

      {!empty && <Upcoming rows={rows} onPick={pick} />}

      <section aria-label="Schedules" className={`${CARD} overflow-hidden`}>
        <div className={`${GRID} border-b border-[var(--rep-line)] px-5 py-2.5 text-[12px] font-medium uppercase tracking-[.05em] text-stone-500 max-lg:hidden`}>
          <span>When</span><span>Report</span><span>{empty ? 'Preview from your latest sync' : 'Last sent'}</span><span>{empty ? '' : 'To'}</span>
        </div>
        <ul>
          {empty ? tpls.map((t, i) => (
            // a suggestion: the dashed ring (not set up yet), the report, what it would say now, Set up
            <li key={t.id} className={`${GRID} min-h-16 border-b border-[var(--rep-line)] px-5 py-2.5 motion-safe:animate-[fade-in_200ms_ease-out_both]`} style={{ animationDelay: `${i * 20}ms` }}>
              <span className="flex items-center gap-2.5 text-[15px] leading-5 text-stone-500"><Marker size={18} found={0} applies={1} />{t.when}</span>
              <span className="flex min-w-0 items-center gap-3"><Thumb kind={t.kind} className="h-7 w-10 shrink-0" /><span className="truncate text-[15px] leading-5 font-medium text-stone-900">{t.name}</span></span>
              <span className={`min-w-0 truncate text-[14px] leading-5 ${t.preview ? 'text-stone-500' : t3}`} title={t.preview ?? t.kpiNames}>{t.preview ? `“${t.preview}”` : t.kpiNames}</span>
              <span className="flex justify-end"><button type="button" onClick={() => openDrawer('schedule', `tpl-${t.id}`)} className="h-8 rounded-lg border border-[var(--rep-line)] px-3 text-[13px] font-medium text-stone-900 outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus">Set up</button></span>
            </li>
          )) : rows.map((s, i) => {
            const next = parseNext(s)
            const [wd, date, time] = s.nextAt.split(' · ')
            return (
              <li key={s.id} id={`sched-${s.id}`} onClick={() => openDrawer('schedule', s.id)}
                className={`group relative ${GRID} min-h-16 cursor-pointer border-b border-[var(--rep-line)] px-5 py-2.5 transition-colors duration-300 last:border-0 hover:bg-tint ${s.on ? '' : '[&>span:not(:last-child)]:opacity-50'} ${flash === s.id ? 'bg-tint' : ''} ${born === s.id ? 'motion-safe:animate-[fade-in_200ms_ease-out_both]' : 'motion-safe:animate-[fade-in_200ms_ease-out_both]'}`}
                style={{ animationDelay: `${i * 20}ms` }}>
                <span className="min-w-0">
                  {s.on
                    ? <><span className="block whitespace-nowrap text-[15px] leading-5 font-medium tabular-nums text-stone-900">{wd}, {date}{time ? ` · ${time}` : ''}</span><span className={`block ${META}`}>{daysUntil(next)}</span></>
                    : <><span className="inline-flex h-6 items-center rounded-full border border-[var(--rep-line)] px-2.5 text-[13px] font-medium text-stone-700">Paused</span><span className={`block ${META}`}>was {wd}, {date}</span></>}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] leading-5 font-medium text-stone-900">{s.title}</span>
                  <span className={`flex items-center gap-1.5 ${META}`}><BrandLogo id={s.brand} className="h-4 w-4" />{brandOf(s.brand)?.name} · {cadenceShort(s)}</span>
                </span>
                <span className="flex min-w-0 items-center gap-4">
                  <span className="transition-opacity duration-150 group-hover:!opacity-0 group-focus-within:!opacity-0"><Dots s={s} /></span>
                  <span className="min-w-0 flex-1">
                    {s.last.status === 'none' ? <span className={META}>Not sent yet</span> : (
                      <>
                        <span className={`flex items-center gap-2 text-[14px] leading-5 tabular-nums ${s.last.status === 'failed' ? 'text-negative' : 'text-stone-900'}`}>{s.last.status === 'failed' ? `Failed ${s.last.date}` : s.last.date}{s.last.status === 'failed' && <button type="button" onClick={(e) => { e.stopPropagation(); toast(COMING_SOON) }} className="text-[13px] font-medium text-stone-900 underline-offset-2 hover:underline group-hover:invisible group-focus-within:invisible">Retry</button>}</span>
                        {lines[s.id] && <span className={`block truncate ${META}`} title={lines[s.id]}>{lines[s.id]}</span>}
                      </>
                    )}
                  </span>
                </span>
                <span className="flex items-center transition-opacity duration-150 group-hover:!opacity-0 group-focus-within:!opacity-0"><Avatars names={s.recipients} /></span>
                {/* on hover / focus: the actions, on the row's own hover colour so nothing shows through mid-fade */}
                <span className="absolute inset-y-0 right-0 flex items-center gap-4 bg-tint pl-3 pr-4 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>
                  {!s.on
                    ? <button type="button" onClick={() => patch(s.id, { on: true })} className={ACT}>Resume</button>
                    : s.last.status === 'failed'
                      ? <button type="button" onClick={() => toast(COMING_SOON)} className={ACT}>Retry</button>
                      : <><button type="button" onClick={() => toast(COMING_SOON)} className={ACT}>Send now</button><button type="button" onClick={() => toast(`Skipped ${s.title}’s ${date} send`)} className={ACT}>Skip next</button></>}
                  <ActionMenu label={`More for ${s.title}`} className="grid h-7 w-7 place-items-center rounded-md text-stone-500 outline-none hover:bg-surface hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus" items={menu(s)}><MoreHorizontal size={16} aria-hidden /></ActionMenu>
                </span>
              </li>
            )
          })}
        </ul>
        {empty
          ? <button type="button" onClick={() => openDrawer('schedule', 'new')} className="flex h-12 w-full items-center gap-2 px-5 text-[14px] font-medium text-stone-700 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"><Plus size={15} aria-hidden />Write your own schedule</button>
          : <p className={`border-t border-[var(--rep-line)] px-5 py-3 ${META}`}>{COMING_SOON}</p>}
      </section>
      <ScheduleDrawer list={list} home={home} tpls={tpls} onSave={save} onPause={(s) => patch(s.id, { on: !s.on })} onDelete={remove} />
      {toastNode}
    </>
  )
}

// ---- the next send, from a form ---------------------------------------------------------------------------------------
function whenOf(f) {
  let d = new Date(TODAY)
  if (f.freq === 'month') { d = new Date(d.getFullYear(), d.getMonth() + 1, f.date ?? 1) }
  else {
    const want = f.freq === 'sync' ? 1 : (DAY_NAMES.indexOf(f.day) + 1) % 7
    do d = addDays(d, 1); while (d.getDay() !== want)
  }
  const day = `${MO[d.getMonth()]} ${d.getDate()}`
  const t = f.freq === 'sync' ? 'after the sync' : f.time
  const runs = f.freq === 'sync' ? 'After each sync' : f.freq === 'month' ? `Monthly on the ${f.date ?? 1}${['st', 'nd', 'rd'][((f.date ?? 1) % 10) - 1] && ![11, 12, 13].includes(f.date) ? ['st', 'nd', 'rd'][((f.date ?? 1) % 10) - 1] : 'th'}, ${f.time}` : `Every ${f.freq === 'biweek' ? 'other ' : ''}${f.day}, ${f.time}`
  const cadence = f.freq === 'sync' ? 'After each sync' : f.freq === 'month' ? `1st of the month ${f.time}` : f.freq === 'biweek' ? `Every other ${f.day} ${f.time}` : `${f.day}s ${f.time}`
  return { day, at: `${WD[d.getDay()]} · ${day} · ${t}`, line: `${dayLine(d)}, ${t}`, runs, cadence }
}

// ---- the drawer: new / edit ---------------------------------------------------------------------------------------------
const TEAM = ['Dana Wells', 'Priya Shah', 'Graham Fox', 'Mia Chen', 'Leo Park', 'Ana Ruiz']
const SectionLabel = ({ children }) => <h3 className="mb-2 mt-6 text-[12px] font-medium uppercase tracking-[.05em] text-stone-500">{children}</h3>
const tile = (on) => `flex flex-col gap-1.5 rounded-xl border p-3 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'border-transparent bg-tint ring-1 ring-[var(--color-line-strong)]' : 'border-[var(--rep-line)] hover:bg-tint'}`
function ScheduleDrawer({ list, home, tpls, onSave, onPause, onDelete }) {
  const drawer = useDrawer('schedule', (id) => (id === 'new' || id.startsWith('tpl-') ? { id } : list.find((s) => s.id === id) ?? null))
  const editing = drawer.item && drawer.item.id !== 'new' && !drawer.item.id.startsWith('tpl-') ? drawer.item : null
  const [form, setForm] = useState(null)
  const [email, setEmail] = useState('')
  const set = (p) => setForm((f) => ({ ...f, ...p }))
  useEffect(() => {
    if (!drawer.open || !drawer.item) return
    const id = drawer.item.id
    if (editing) {
      const t = tpls.find((x) => savedReports.find((r) => r.id === editing.reportId)?.opts.kind === x.kind)
      setForm({ template: t?.id ?? 'custom', question: t ? '' : editing.title, brand: editing.brand, freq: /sync/i.test(editing.cadence) ? 'sync' : /month/i.test(editing.cadence) ? 'month' : /other/i.test(editing.cadence) ? 'biweek' : 'week', day: (editing.runs.match(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/) ?? ['Monday'])[0], time: editing.runs.match(/\d+:\d+/)?.[0] ?? '9:00', date: 1, to: [...editing.recipients] })
    } else {
      const t = id.startsWith('tpl-') ? tpls.find((x) => x.id === id.slice(4)) : tpls[0]
      setForm({ template: t.id, question: '', brand: home, freq: 'week', day: 'Monday', time: '9:00', date: 1, ...t.form, to: [] })
    }
    setEmail('')
  }, [drawer.open, drawer.item?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const t = form && tpls.find((x) => x.id === form.template)
  const live = useMemo(() => (form && t ? preview({ ...t.opts, brand: form.brand }) : { line: null, kpis: [] }), [form?.template, form?.brand]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!drawer.item || !form) return null
  const when = whenOf(form)
  const ok = form.to.length > 0 && (form.template !== 'custom' || form.question.trim())
  const addEmail = () => { const e = email.trim(); if (e.includes('@') && !form.to.includes(e)) set({ to: [...form.to, e] }); setEmail('') }
  const freqs = [['week', 'Every week'], ['biweek', 'Every 2 weeks'], ['month', 'Monthly'], ['sync', 'After each sync']]
  return (
    <DrawerShell drawer={drawer} title={editing ? 'Edit schedule' : 'New schedule'} meta={<span>{editing ? editing.title : 'A report that writes itself and arrives by email'}</span>}
      footer={(
        <>
          <span className="flex items-center gap-3">
            {editing && <button type="button" onClick={() => { onPause(editing); drawer.close() }} className="text-[13px] font-medium text-stone-700 hover:text-stone-900">{editing.on ? 'Pause' : 'Resume'}</button>}
            {editing && <button type="button" onClick={() => { onDelete(editing); drawer.close() }} className="text-[13px] font-medium text-negative hover:underline">Delete</button>}
            <span className="text-stone-500">Next send: {when.line}</span>
          </span>
          <button type="button" disabled={!ok} onClick={() => { onSave(form, editing); drawer.close() }} className={inkBtn}>Save schedule</button>
        </>
      )}>
      <SectionLabel>Report</SectionLabel>
      <div className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
        {tpls.map((x) => (
          <button key={x.id} type="button" aria-pressed={form.template === x.id} onClick={() => set({ template: x.id, ...x.form })} className={tile(form.template === x.id)}>
            <Thumb kind={x.kind} className="h-7 w-10" />
            <span className="text-[14px] leading-5 font-medium text-stone-900">{x.name}</span>
            <span className="line-clamp-2 text-[12px] leading-4 text-stone-500">{x.kpiNames}</span>
          </button>
        ))}
      </div>
      <button type="button" aria-pressed={form.template === 'custom'} onClick={() => set({ template: 'custom' })} className={`${tile(form.template === 'custom')} mt-2 w-full`}>
        <span className="text-[14px] leading-5 font-medium text-stone-900">Custom question</span>
        {form.template === 'custom' && <input autoFocus value={form.question} onClick={(e) => e.stopPropagation()} onChange={(e) => set({ question: e.target.value })} placeholder="What should the report answer?" className="h-9 w-full rounded-lg border border-[var(--rep-line)] bg-surface px-3 text-[14px] text-stone-900 outline-none focus:border-[var(--color-line-strong)]" />}
      </button>

      <SectionLabel>Brand</SectionLabel>
      <select value={form.brand} onChange={(e) => set({ brand: e.target.value })} className="h-10 w-full rounded-lg border border-[var(--rep-line)] bg-surface px-3 text-[14px] text-stone-900 outline-none focus:border-[var(--color-line-strong)]">
        {REPORT_BRANDS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      <SectionLabel>When</SectionLabel>
      <div className="flex flex-col gap-1">
        {freqs.map(([id, label]) => (
          <label key={id} className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 ${form.freq === id ? 'bg-tint' : 'hover:bg-tint'}`}>
            <input type="radio" name="freq" checked={form.freq === id} onChange={() => set({ freq: id })} className="accent-[var(--ink)]" />
            <span className="text-[14px] text-stone-900">{label}</span>
          </label>
        ))}
      </div>
      {(form.freq === 'week' || form.freq === 'biweek') && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex gap-1">{DAY_NAMES.map((d) => <button key={d} type="button" aria-pressed={form.day === d} onClick={() => set({ day: d })} className={`grid h-8 w-8 place-items-center rounded-lg text-[13px] font-medium ${form.day === d ? 'bg-ink text-[var(--color-surface)]' : 'bg-tint text-stone-700 hover:text-stone-900'}`}>{d[0]}</button>)}</span>
          <select value={form.time} onChange={(e) => set({ time: e.target.value })} className="h-8 rounded-lg border border-[var(--rep-line)] bg-surface px-2 text-[13px] text-stone-900">{TIMES.map((x) => <option key={x}>{x}</option>)}</select>
        </div>
      )}
      {form.freq === 'month' && (
        <div className="mt-3 flex items-center gap-2 text-[13px] text-stone-700">Day
          <select value={form.date} onChange={(e) => set({ date: Number(e.target.value) })} className="h-8 rounded-lg border border-[var(--rep-line)] bg-surface px-2 text-[13px] text-stone-900">{Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select>
          at <select value={form.time} onChange={(e) => set({ time: e.target.value })} className="h-8 rounded-lg border border-[var(--rep-line)] bg-surface px-2 text-[13px] text-stone-900">{TIMES.map((x) => <option key={x}>{x}</option>)}</select>
        </div>
      )}
      <p className="mt-2 text-[12px] text-stone-500">Times in Europe/London (GMT)</p>

      <SectionLabel>To</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {TEAM.map((n) => {
          const on = form.to.includes(n)
          return <button key={n} type="button" aria-pressed={on} onClick={() => set({ to: on ? form.to.filter((x) => x !== n) : [...form.to, n] })}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full pl-1 pr-2.5 text-[13px] ${on ? 'bg-tint text-stone-900 ring-1 ring-[var(--color-line-strong)]' : 'border border-[var(--rep-line)] text-stone-600 hover:text-stone-900'}`}>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-surface text-[10px] font-semibold text-stone-700">{initials(n)}</span>{n}{on && <Check size={13} aria-hidden />}
          </button>
        })}
        {form.to.filter((x) => !TEAM.includes(x)).map((e) => <span key={e} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-tint px-3 text-[13px] text-stone-900">{e}<button type="button" aria-label={`Remove ${e}`} onClick={() => set({ to: form.to.filter((x) => x !== e) })}><X size={13} /></button></span>)}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail() } }} placeholder="Add an email" className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--rep-line)] bg-surface px-3 text-[14px] text-stone-900 outline-none focus:border-[var(--color-line-strong)]" />
        <button type="button" onClick={addEmail} className="h-9 rounded-lg border border-[var(--rep-line)] px-3 text-[13px] font-medium text-stone-900 hover:bg-tint">Add</button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[13px]">
        <span className="text-stone-600">Channel</span>
        <span className="inline-flex h-7 items-center rounded-full bg-tint px-3 font-medium text-stone-900">Email</span>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed border-[var(--rep-line)] px-3 text-stone-400" aria-disabled="true">Slack · <button type="button" className="font-medium text-stone-600 hover:text-stone-900" onClick={() => {}}>Connect Slack</button></span>
      </div>

      <SectionLabel>Preview</SectionLabel>
      <div className="rounded-xl border border-[var(--rep-line)] p-4">
        <p className="text-[15px] leading-5 font-semibold text-stone-900">{t ? t.name : form.question || 'Custom report'}</p>
        <p className="mt-1 text-[13px] leading-[18px] text-stone-600">{t ? live.line ?? 'The first line comes from the next sync.' : 'Written from your question at each send.'}</p>
        {t && live.kpis.length > 0 && (
          <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-lg border border-[var(--rep-line)]">
            {live.kpis.map((k) => <div key={k.id} className="border-r border-[var(--rep-line)] bg-tint px-3 py-2 last:border-r-0"><span className="block truncate text-[12px] text-stone-600">{k.label}</span><b className="text-[18px] leading-6 font-semibold tabular-nums text-stone-900">{k.value}</b></div>)}
          </div>
        )}
      </div>
    </DrawerShell>
  )
}
