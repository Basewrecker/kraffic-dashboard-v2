import { useMemo, useState } from 'react'
import { ArrowRight, ChevronRight, Mail, MoreHorizontal, Plus } from 'lucide-react'
import Segmented from '../../components/dashboard/Segmented'
import ActionMenu from '../../components/audit/ActionMenu'
import DrawerShell, { Dot, useDrawer } from '../../components/audit/DrawerShell'
import { openDrawer } from '../../components/audit/parts'
import Switch from '../../components/ui/Switch'
import SiteLogo from '../../components/ui/SiteLogo'
import Logo from '../../components/ui/Logo'
import { useToast } from '../../components/dashboard/overlays'
import { linkClick, navigate } from '../../router'
import { DEFAULT_OPTS, VERDICT_TONE, buildReport, libraryItems, savedReports, schedules } from '../../data/reports'
import { cadenceLabel, cadenceSentence, emailStats, fmtDay, initials, nextUp, peopleLabel, relDays, scheduleRow, scheduleTemplates, timeline } from '../../data/schedules'
import { agency } from '../../store/workspace'
import { Block, VerdictDot } from './blocks'
import { BrandLogo, ReportsHead, brandOf, defaultBrand, inkBtn, lineBtn, t2, t3, toQuery } from './parts'

// /reports/scheduled: the reports that write themselves after each sync and arrive by email.
// The brand you're viewing (the brand switcher) or All brands · the next 14 days as a timeline · one row per schedule
// (what it last said, its last 8 verdicts, who gets it, when it sends next; pause, ⋯) · click a row: its past sends ·
// Preview email opens the email in the drawer (?preview=<id>). ?open=<id> opens a row · ?mock=empty: nothing scheduled.
// Sending (Send now) and editing a schedule aren't built yet: they say so.
const mockEmpty = () => new URLSearchParams(window.location.search).get('mock') === 'empty'
const TONE_DOT = { up: 'var(--ink)', mid: 'var(--color-stone-400)', down: 'var(--negative)' }
const toneDot = (v) => TONE_DOT[VERDICT_TONE[v] ?? 'mid']
const H2 = 'text-[15px] leading-5 font-semibold text-stone-900'
const tipCls = 'pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-[260px] rounded-lg border border-line bg-raised px-2.5 py-1.5 text-left text-[12px] leading-4 font-normal text-stone-800 shadow-sm'

export default function ScheduledPage() {
  const q0 = new URLSearchParams(window.location.search)
  const home = q0.get('brand') ?? defaultBrand()
  const [scope, setScope] = useState(q0.get('scope') === 'all' ? 'all' : 'brand')
  const [list, setList] = useState(() => (mockEmpty() ? [] : schedules.map((s) => ({ ...s, paused: false }))))
  const [open, setOpen] = useState(() => new Set(q0.get('open') ? [q0.get('open')] : []))
  const [toastNode, toast] = useToast({ position: 'center' })
  const all = scope === 'all'
  const shown = list.filter((s) => all || s.brand === home)
  const tl = timeline(shown)
  const next = nextUp(shown)
  const homeName = brandOf(home)?.name ?? 'This brand'
  const soon = (what) => toast(`${what} is coming soon`)

  const toggle = (id) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const reveal = (id) => {
    setOpen((o) => new Set(o).add(id))
    requestAnimationFrame(() => document.getElementById(`schedule-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }
  const setPaused = (s, paused) => {
    setList((l) => l.map((x) => (x.id === s.id ? { ...x, paused } : x)))
    toast(paused ? `Paused “${s.title}” for ${brandOf(s.brand)?.name}` : `Resumed “${s.title}”`)
  }
  const remove = (s) => {
    const before = list
    setList((l) => l.filter((x) => x.id !== s.id))
    toast(`Deleted the schedule for “${s.title}”`, { action: { label: 'Undo', onClick: () => setList(before) } })
  }
  const newSchedule = () => toast('New schedules start from a report: open one and choose Schedule', { action: { label: 'Open reports', onClick: () => navigate('/reports/all') } })

  return (
    <>
      <ReportsHead title="Scheduled" subtitle="Reports that write themselves after each sync and arrive by email."
        actions={(
          <>
            <Segmented size="sm" label="Brands" value={scope} onChange={setScope} options={[{ value: 'brand', label: homeName }, { value: 'all', label: 'All brands' }]} />
            <button type="button" onClick={newSchedule} className={inkBtn}><Plus size={15} aria-hidden />New schedule</button>
          </>
        )} />

      {shown.length === 0 ? (
        <EmptyState home={home} all={all} homeName={homeName} othersHave={!all && list.length > 0} onAll={() => setScope('all')} />
      ) : (
        <div className="mt-2 flex flex-col gap-10">
          <section aria-labelledby="sched-next">
            <h2 id="sched-next" className={H2}>Next 14 days</h2>
            <Timeline tl={tl} onPick={reveal} />
            <p className={`mt-3 text-[13px] leading-5 ${t2}`}>
              {next
                ? <>Next: <span className="font-medium text-stone-900">{next.s.title}</span> for {brandOf(next.s.brand)?.name}, {relDays(next.inDays)}</>
                : 'Every schedule here is paused, so nothing goes out.'}
            </p>
          </section>

          <section aria-labelledby="sched-list">
            <h2 id="sched-list" className={`${H2} mb-1`}>Schedules</h2>
            <ul className="-mx-3 flex flex-col">
              {shown.map((s) => (
                <ScheduleRow key={s.id} s={s} open={open.has(s.id)} onToggle={() => toggle(s.id)}
                  onPause={(p) => setPaused(s, p)} onPreview={() => openDrawer('preview', s.id)}
                  onEdit={() => soon('Editing a schedule')} onSend={() => soon('Send now')} onDelete={() => remove(s)} />
              ))}
            </ul>
          </section>
        </div>
      )}
      <EmailDrawer list={list} />
      {toastNode}
    </>
  )
}

// ---- the next 14 days: a day per column (today on the left), weekends lightly tinted, each send a brand logo in a circle
function Timeline({ tl, onPick, faint = false }) {
  const [tip, setTip] = useState(null)
  const n = tl.ticks.length
  const byDay = tl.ticks.map((t) => tl.items.filter((x) => x.day === t.i))
  const stack = Math.max(1, ...byDay.map((x) => x.length))
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }
  return (
    <div className={`mt-3 select-none ${faint ? 'pointer-events-none opacity-50' : ''}`} aria-hidden={faint || undefined}>
      <div className="relative grid border-b border-line" style={cols}>
        {tl.ticks.map((t) => (
          <div key={t.i} className={`relative flex flex-col items-center justify-end gap-1 pb-2.5 pt-7 ${t.weekend ? 'bg-[color-mix(in_srgb,var(--tint)_70%,transparent)]' : ''}`} style={{ minHeight: 36 + stack * 28 }}>
            {t.today && (
              <>
                <span className={`absolute left-1/2 top-1.5 -translate-x-1/2 whitespace-nowrap text-[12px] leading-4 font-medium text-stone-900 max-md:left-0 max-md:translate-x-0`}>Today</span>
                <span className="absolute bottom-0 left-1/2 top-6 w-px -translate-x-1/2 bg-ink" aria-hidden />
              </>
            )}
            {!faint && byDay[t.i].map((x) => {
              const b = brandOf(x.brand)
              const side = t.i < 3 ? 'left-0' : t.i > n - 4 ? 'right-0' : 'left-1/2 -translate-x-1/2'
              return (
                <span key={x.id} className="relative">
                  <button type="button" onClick={() => onPick(x.scheduleId)} onMouseEnter={() => setTip(x.id)} onMouseLeave={() => setTip(null)} onFocus={() => setTip(x.id)} onBlur={() => setTip(null)}
                    aria-label={x.label}
                    className="relative z-[1] grid h-6 w-6 place-items-center rounded-full bg-surface ring-2 ring-[var(--color-surface)] outline-none transition-transform duration-150 hover:scale-110 focus-visible:ring-focus">
                    <SiteLogo domain={b?.domain} name={b?.name} className="h-6 w-6 rounded-full" imgPad="p-0" initialClass="text-[10px]" plate />
                  </button>
                  {tip === x.id && <span role="tooltip" className={`${tipCls} ${side}`}>{x.label}</span>}
                </span>
              )
            })}
          </div>
        ))}
      </div>
      <div className="grid pt-1.5" style={cols}>
        {tl.ticks.map((t) => (
          <span key={t.i} className={`flex flex-col items-center text-[12px] leading-4 tabular-nums ${t.today ? 'font-medium text-stone-900' : t3}`}>
            <span className="-mt-1.5 mb-0.5 h-1 w-px bg-[var(--color-line-strong)]" aria-hidden />
            {t.day}
          </span>
        ))}
      </div>
      <div className="relative h-4" style={{ display: 'grid', ...cols }}>
        {tl.ticks.map((t) => <span key={t.i} className={`text-center text-[12px] leading-4 ${t3}`}>{t.monthStart ? t.month : ''}</span>)}
      </div>
    </div>
  )
}

// ---- one schedule: who it's for and when · what it last said (and its last 8 verdicts) · who gets it · when next ·
// pause and ⋯. Click: its past sends and Preview email
function ScheduleRow({ s, open, onToggle, onPause, onPreview, onEdit, onSend, onDelete }) {
  const r = useMemo(() => scheduleRow(s), [s])
  const [tip, setTip] = useState(null)
  const id = `sends-${s.id}`
  const dim = s.paused ? 'opacity-50' : ''
  const stop = (e) => e.stopPropagation()
  const b = brandOf(s.brand)
  return (
    <li id={`schedule-${s.id}`} className="border-b border-[var(--div)] last:border-0">
      <div onClick={onToggle}
        className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2.5 rounded-lg px-3 py-3 transition-colors duration-150 hover:bg-tint md:min-h-[72px] md:grid-cols-[minmax(0,240px)_minmax(0,1fr)_150px_124px_auto] md:py-2">
        {/* name and schedule */}
        <button type="button" aria-expanded={open} aria-controls={id} onClick={(e) => { stop(e); onToggle() }}
          className={`flex min-w-0 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-focus ${dim}`}>
          <BrandLogo id={s.brand} className="h-8 w-8" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[15px] leading-5 font-medium text-stone-900">
              <span className="truncate">{s.title}</span>
              <ChevronRight size={14} className={`shrink-0 text-stone-500 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} aria-hidden />
            </span>
            <span className={`block truncate text-[12px] leading-4 ${t3}`}>{cadenceLabel(s.cadence)}<span className="sr-only">, {b?.name}</span></span>
          </span>
        </button>

        {/* pause and ⋯ (stay readable when the row is paused) */}
        <span className="flex items-center gap-1 md:order-5" onClick={stop}>
          <Switch size="sm" checked={!s.paused} onChange={(on) => onPause(!on)} aria-label={s.paused ? `Resume ${s.title}` : `Pause ${s.title}`} title={s.paused ? 'Paused: resume' : 'Sending: pause'} className="p-1.5" />
          <ActionMenu label={`Actions for ${s.title}`} items={[
            { label: 'Edit', onClick: onEdit },
            { label: 'Send now', onClick: onSend },
            { label: 'Preview email', onClick: onPreview },
            { label: 'Delete', danger: true, onClick: onDelete },
          ]} className="grid h-8 w-8 place-items-center rounded-md text-stone-600 outline-none hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
            <MoreHorizontal size={16} aria-hidden />
          </ActionMenu>
        </span>

        {/* what it last said, and what it's been saying */}
        <span className={`col-span-2 flex min-w-0 flex-col gap-1.5 md:order-2 md:col-span-1 ${dim}`}>
          {r.last && (
            <span className={`flex min-w-0 items-center gap-2 text-[14px] leading-5 ${t2}`}>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: toneDot(r.last.verdict) }} aria-hidden />
              <span className="sr-only">{r.last.verdict}: </span>
              <span className="truncate">{r.last.headline}</span>
            </span>
          )}
          <span className="relative flex items-center gap-1 pl-3.5" onMouseLeave={() => setTip(null)}>
            <span className="flex items-center gap-1" role="img" aria-label={`Last ${r.dots.length} verdicts, oldest to newest: ${r.dots.map((x) => `${x.date} ${x.verdict}`).join(', ')}`}>
              {r.dots.map((x, i) => <span key={x.id} onMouseEnter={() => setTip(i)} className="h-2 w-2 rounded-full transition-transform duration-150 hover:scale-125" style={{ background: toneDot(x.verdict) }} />)}
            </span>
            {r.last && <span className={`ml-2 text-[12px] leading-4 tabular-nums ${t3}`}>Sent {r.last.date}</span>}
            {tip != null && r.dots[tip] && (
              <span role="tooltip" className={tipCls} style={{ left: 14 + tip * 12 - 6 }}>
                <span className={`block ${t3}`}>{r.dots[tip].date} · {r.dots[tip].verdict}</span>{r.dots[tip].headline}
              </span>
            )}
          </span>
        </span>

        {/* who gets it · when next (one line on phones) */}
        <span className={`col-span-2 flex items-center justify-between gap-4 md:contents`}>
          <Recipients names={s.recipients} className={`md:order-3 ${dim}`} />
          <span className={`flex min-w-0 flex-col text-right md:order-4 md:text-left ${dim}`}>
            {s.paused ? <span className={`text-[13px] leading-5 ${t3}`}>Paused</span> : r.next && (
              <>
                <span className="text-[13px] leading-5 font-medium text-stone-800 tabular-nums">Next: {fmtDay(r.next)}</span>
                <span className={`text-[12px] leading-4 tabular-nums ${t3}`}>{relDays(r.inDays)}</span>
              </>
            )}
          </span>
        </span>
      </div>

      {open && (
        <div id={id} className="mb-3 ml-[52px] mr-3 motion-safe:animate-[fade-in_150ms_ease-out] max-md:ml-3">
          <p className={`mb-1 text-[12px] leading-4 ${t3}`}>Past sends</p>
          {r.past.length ? (
            <ol className="flex flex-col border-l border-line">
              {r.past.map((x) => (
                <li key={x.id} className="grid grid-cols-[52px_minmax(0,max-content)_auto] justify-start items-center gap-4 py-1.5 pl-4 pr-2 max-md:grid-cols-[44px_minmax(0,1fr)] max-md:gap-y-0.5">
                  <span className={`text-[12px] tabular-nums ${t3}`}>{x.date}</span>
                  <span className="truncate text-[14px] leading-5 text-stone-900 max-md:whitespace-normal">{x.headline}</span>
                  <VerdictDot verdict={x.verdict} className="max-md:col-start-2" />
                </li>
              ))}
            </ol>
          ) : <p className={`text-[13px] leading-5 ${t2}`}>This is the first one it sent.</p>}
          <button type="button" onClick={onPreview} className="mt-2 inline-flex items-center gap-1.5 rounded py-1 text-[13px] font-medium text-stone-700 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
            <Mail size={14} aria-hidden />Preview email<ArrowRight size={13} aria-hidden />
          </button>
        </div>
      )}
    </li>
  )
}

// overlapping initials and "2 people"; hover (or focus) lists them
function Recipients({ names, className = '' }) {
  const shown = names.slice(0, 3)
  return (
    <span className={`group/rc relative inline-flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus ${className}`} tabIndex={0} onClick={(e) => e.stopPropagation()} aria-label={`Sent to ${names.join(', ')}`}>
      <span className="flex shrink-0 -space-x-1.5" aria-hidden>
        {shown.map((n) => <span key={n} className="grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--color-page)] bg-[color-mix(in_srgb,var(--ink)_9%,var(--color-surface))] text-[10px] leading-none font-semibold text-stone-700">{initials(n)}</span>)}
        {names.length > shown.length && <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--color-page)] bg-[color-mix(in_srgb,var(--ink)_9%,var(--color-surface))] text-[10px] font-semibold text-stone-700">+{names.length - shown.length}</span>}
      </span>
      <span className={`whitespace-nowrap text-[13px] leading-5 tabular-nums ${t2}`} aria-hidden>{peopleLabel(names.length)}</span>
      <span role="tooltip" className={`${tipCls} left-0 hidden group-hover/rc:block group-focus-visible/rc:block`}>
        {names.map((n) => <span key={n} className="block">{n}</span>)}
      </span>
    </span>
  )
}

// ---- nothing scheduled: a faint timeline and the three reports people schedule most
function EmptyState({ home, all, homeName, othersHave, onAll }) {
  const ghost = timeline([])
  return (
    <section aria-label="Nothing scheduled" className="mt-2 flex flex-col items-center pb-16 text-center">
      <div className="w-full"><Timeline tl={ghost} faint /></div>
      <p className="mt-10 text-[17px] leading-6 font-semibold text-stone-900">Get your weekly report in your inbox</p>
      <p className={`mt-1.5 max-w-[48ch] text-[14px] leading-5 ${t2}`}>
        {all ? 'Nothing is scheduled yet.' : `Nothing is scheduled for ${homeName} yet.`} Start from one of these, then choose Schedule: Kraffic writes it again after each sync and emails it.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {scheduleTemplates().map((t) => {
          const href = `/reports/new?${toQuery({ ...DEFAULT_OPTS, brand: home, ...t.sets }, t.prompt)}`
          return <a key={t.id} href={href} onClick={linkClick(href)} className={lineBtn}>{t.name}</a>
        })}
      </div>
      {othersHave && <button type="button" onClick={onAll} className={`mt-4 rounded text-[13px] font-medium ${t2} outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus`}>See all brands</button>}
    </section>
  )
}

// ---- the email a schedule sends, as its recipients see it: subject = the latest headline; the hero visual; the 3 key
// numbers; Open full report. A client report carries the agency's name and logo (white label)
function EmailDrawer({ list }) {
  const drawer = useDrawer('preview', (id) => list.find((s) => s.id === id))
  const items = useMemo(() => libraryItems(), [])
  const s = drawer.item
  if (!s) return null
  const saved = savedReports.find((x) => x.id === s.reportId)
  const r = saved && buildReport(saved.opts, saved.prompt)
  const hero = r?.ok ? r.blocks.find((x) => x.type === 'hero') : null
  const stats = emailStats(items.find((x) => x.id === s.reportId)?.stats ?? [], hero?.data?.visual)
  const client = r?.opts?.audience === 'client'
  const b = brandOf(s.brand)
  const from = client ? agency.name : `Kraffic Reports for ${agency.name}`
  const href = `/reports/${s.reportId}`
  return (
    <DrawerShell drawer={drawer} title="Email preview"
      meta={<><span>{s.title}</span><Dot /><span>{b?.name}</span><Dot /><span>{cadenceSentence(s.cadence).replace(/^./, (c) => c.toUpperCase())}</span></>}
      footer={<span className={t3}>Written from the latest sync each time. What’s shown is the latest one.</span>}>
      {r?.ok ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-line">
          <dl className={`grid grid-cols-[60px_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-line bg-tint px-4 py-3 text-[13px] leading-[18px] ${t2}`}>
            <dt className={t3}>From</dt><dd className="truncate text-stone-900">{from}</dd>
            <dt className={t3}>To</dt><dd className="text-stone-900">{s.recipients.join(', ')}</dd>
            <dt className={t3}>Subject</dt><dd className="font-medium text-stone-900">{r.headline}</dd>
          </dl>
          <div className="flex flex-col gap-6 bg-surface px-5 py-5 max-md:px-4">
            <p className="flex items-center gap-2.5 text-[13px] leading-5 text-stone-600">
              {client
                ? <><SiteLogo domain={agency.domain} name={agency.name} className="h-6 w-6 shrink-0 rounded" imgPad="p-0" initialClass="text-[10px]" plate /><b className="font-semibold text-stone-900">{agency.name}</b></>
                : <><Logo size={22} /><b className="font-semibold text-stone-900">Kraffic</b></>}
              <span className="text-stone-400" aria-hidden>·</span><span className="truncate">{client ? `Prepared for ${b?.name}` : s.title}</span>
            </p>
            {hero && <div className="[&_header]:grid-cols-1! [&_header>*]:col-span-1!"><Block block={{ ...hero, data: { ...hero.data, client: false } }} title={s.title} /></div>}
            {stats.length > 0 && (
              <dl className="grid grid-flow-col auto-cols-fr gap-4 border-t border-[var(--div)] pt-4">
                {stats.map((x) => (
                  <div key={x.id} className="min-w-0">
                    <dt className={`truncate text-[12px] leading-4 ${t3}`}>{x.label}</dt>
                    <dd className="mt-1 text-[22px] leading-7 font-semibold tracking-[-0.01em] text-stone-900 tabular-nums">{x.value}{x.unit ?? ''}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div><a href={href} onClick={linkClick(href)} className={inkBtn}>Open full report<ArrowRight size={14} aria-hidden /></a></div>
            <p className={`border-t border-[var(--div)] pt-4 text-[12px] leading-[18px] ${t3}`}>
              Sent {cadenceSentence(s.cadence)} by {client ? agency.name : `Kraffic for ${agency.name}`}. To change or stop it, open Scheduled in Kraffic.
            </p>
          </div>
        </div>
      ) : (
        <p className={`mt-5 text-[14px] leading-5 ${t2}`}>This report can’t be written yet: {b?.name} has no synced data. The email goes out once it has.</p>
      )}
    </DrawerShell>
  )
}
