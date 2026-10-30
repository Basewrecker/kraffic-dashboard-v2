import { useMemo, useState } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import ActionMenu from '../../components/audit/ActionMenu'
import Segmented from '../../components/dashboard/Segmented'
import Sheet from '../../components/ui/Sheet'
import Switch from '../../components/ui/Switch'
import { useToast } from '../../components/dashboard/overlays'
import { KINDS, REPORT_BRANDS, parseDay, savedReports, schedules } from '../../data/reports'
import { initials } from '../../data/schedules'
import { brand as workspaceBrand } from '../../store/workspace'
import { BrandLogo, ReportsHead, brandOf, defaultBrand, inkBtn, lineBtn, t3 } from './parts'

// Scheduled: the reports that write themselves and arrive by email. The header (title, Beta, the brand scope, New
// schedule) · "Up next": the next three deliveries as compact cards · the schedules table (a row opens the edit drawer) ·
// the new / edit drawer (a saved report or a question, the brand, the frequency, the recipients, the format, and a
// preview line). Sending stays "Coming soon" like the rest of the preview. ?mock=empty: no schedules yet.
const mockEmpty = () => new URLSearchParams(window.location.search).get('mock') === 'empty'
const scopeBrand = () => (REPORT_BRANDS.some((b) => b.id === workspaceBrand.id) ? workspaceBrand.id : defaultBrand())
const CARD = 'rounded-xl border border-[var(--rep-line)] bg-surface [box-shadow:var(--rep-shadow)]'
const LABEL = 'text-[14px] leading-5 text-stone-600'
const META = `text-[13px] leading-[18px] ${t3}`
const kindOf = (s) => KINDS[savedReports.find((r) => r.id === s.reportId)?.opts.kind]?.name ?? s.title
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const TIMES = ['8:00', '9:00', '10:00', '12:00', '16:00']
const FORMATS = ['Email · PDF', 'Link']
const TODAY = new Date(2026, 9, 28) // the mock's today: Wednesday
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtDate = (d) => `${WD[d.getDay()]}, ${MO[d.getMonth()]} ${d.getDate()}`
// the next send a form describes: { line: "Mon, Nov 2 at 9:00", at: "Mon · Nov 2 · 9:00", day: "Nov 2" }
function nextSendOf(f) {
  const d = new Date(TODAY)
  if (f.freq === 'month') { const m = new Date(d.getFullYear(), d.getMonth() + 1, 1); return { line: `${fmtDate(m)} at ${f.time}`, at: `${WD[m.getDay()]} · ${MO[m.getMonth()]} ${m.getDate()} · ${f.time}`, day: `${MO[m.getMonth()]} ${m.getDate()}` } }
  const want = f.freq === 'sync' ? 1 : DAYS.indexOf(f.day) + 1
  do d.setDate(d.getDate() + 1); while (d.getDay() !== want)
  const day = `${MO[d.getMonth()]} ${d.getDate()}`
  return f.freq === 'sync' ? { line: `${fmtDate(d)}, after the sync`, at: `${WD[d.getDay()]} · ${day} · after the sync`, day } : { line: `${fmtDate(d)} at ${f.time}`, at: `${WD[d.getDay()]} · ${day} · ${f.time}`, day }
}
const TEMPLATES = [
  { id: 'weekly', name: 'Weekly summary', runs: 'Every Monday, 9:00', form: { freq: 'week', day: 'Monday', time: '9:00' } },
  { id: 'ceo', name: 'CEO summary', runs: 'Monthly on the 1st', form: { freq: 'month', time: '8:00' } },
  { id: 'gap', name: 'Competitor gap', runs: 'After each sync', form: { freq: 'sync' } },
]
const COMING_SOON = 'Coming soon: sending is part of the app, not the preview.'

function Avatars({ names }) {
  return (
    <span className="inline-flex items-center gap-2" title={names.join(', ')}>
      <span className="flex -space-x-1.5">
        {names.slice(0, 3).map((n) => <span key={n} className="grid h-6 w-6 place-items-center rounded-full border-2 border-surface bg-tint text-[10px] font-semibold text-stone-700" aria-hidden>{initials(n)}</span>)}
      </span>
      <span className={`${META} tabular-nums`}>{names.length}</span>
    </span>
  )
}

export default function ScheduledPage() {
  const home = scopeBrand()
  const [scope, setScope] = useState('brand')
  const [list, setList] = useState(() => (mockEmpty() ? [] : schedules.map((s) => ({ ...s }))))
  const [drawer, setDrawer] = useState(null) // { s: the schedule being edited, or null for a new one, form }
  const [toastNode, toast] = useToast({ position: 'center' })
  const homeName = brandOf(home)?.name ?? 'This brand'
  const rows = useMemo(() => list.filter((s) => scope === 'all' || s.brand === home), [list, scope, home])
  const upNext = useMemo(() => rows.filter((s) => s.on).sort((a, b) => parseDay(a.next) - parseDay(b.next)).slice(0, 3), [rows])
  const patch = (id, p) => setList((l) => l.map((s) => (s.id === id ? { ...s, ...p } : s)))
  const openNew = (tpl = null) => setDrawer({ s: null, form: { report: '', question: tpl ? tpl.name : '', brand: home, freq: 'week', day: 'Monday', time: '9:00', to: '', format: 'Email · PDF', ...(tpl?.form ?? {}) } })
  const openEdit = (s) => setDrawer({ s, form: { report: s.reportId ?? '', question: s.reportId ? '' : s.title, brand: s.brand, freq: s.cadence === 'After each sync' ? 'sync' : s.cadence.includes('month') ? 'month' : 'week', day: s.cadence.includes('Friday') ? 'Friday' : 'Monday', time: s.runs.match(/\d+:\d+/)?.[0] ?? '9:00', to: s.recipients.join(', '), format: s.delivery } })
  const menu = (s) => [
    { label: 'Edit', onClick: () => openEdit(s) },
    { label: 'Duplicate', onClick: () => { setList((l) => [...l, { ...s, id: `${s.id}-copy`, title: `${s.title} (copy)`, on: false }]); toast(`Duplicated “${s.title}”`) } },
    { label: s.on ? 'Pause' : 'Resume', onClick: () => patch(s.id, { on: !s.on }) },
    { label: 'Delete', danger: true, onClick: () => { setList((l) => l.filter((x) => x.id !== s.id)); toast(`Deleted “${s.title}”`, { action: { label: 'Undo', onClick: () => setList((l) => [...l, s]) } }) } },
  ]
  const save = (form) => {
    const names = form.to.split(/[,\s]+/).filter((x) => x.includes('@') || x.length > 1)
    const runs = form.freq === 'sync' ? 'After each sync' : form.freq === 'month' ? `Monthly on the 1st, ${form.time}` : `Every ${form.day}, ${form.time}`
    const cadence = form.freq === 'sync' ? 'After each sync' : form.freq === 'month' ? `1st of the month ${form.time.replace(':00', '')}am` : `${form.day}s ${form.time.replace(':00', '')}am`
    const title = savedReports.find((r) => r.id === form.report)?.title ?? (form.question.trim() || 'Report')
    const n = nextSendOf(form)
    if (drawer?.s) patch(drawer.s.id, { title, brand: form.brand, reportId: form.report || null, runs, cadence, recipients: names, delivery: form.format, nextAt: n.at, next: n.day, when: n.line })
    else setList((l) => [...l, { id: `s-new-${l.length + 1}`, reportId: form.report || null, title, brand: form.brand, cadence, runs, recipients: names, next: n.day, nextAt: n.at, when: n.line, delivery: form.format, last: { date: '', status: 'none' }, on: true }])
    setDrawer(null)
    toast(`${drawer?.s ? 'Saved' : 'Scheduled'} ${title}: next ${n.line}`)
  }
  return (
    <>
      <ReportsHead title="Scheduled" subtitle="Reports that write themselves after each sync and arrive by email."
        actions={(
          <>
            <Segmented size="sm" label="Brands" value={scope} onChange={setScope} options={[{ value: 'brand', label: homeName }, { value: 'all', label: 'All brands' }]} />
            <button type="button" onClick={() => openNew()} className={inkBtn}><Plus size={15} aria-hidden />New schedule</button>
          </>
        )} />
      {rows.length === 0 ? (
        <section aria-label="No schedules" className="flex flex-col gap-4">
          <p className={LABEL}>No schedules for {scope === 'all' ? 'any brand' : homeName} yet. Start from one of these, or write your own.</p>
          <div><button type="button" onClick={() => openNew()} className={inkBtn}><Plus size={15} aria-hidden />New schedule</button></div>
          <ul className="grid gap-4 md:grid-cols-3">
            {TEMPLATES.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => openNew(t)} className={`${CARD} flex w-full flex-col gap-1 p-5 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus`}>
                  <span className="text-[15px] leading-5 font-semibold text-stone-900">{t.name}</span>
                  <span className={META}>{t.runs}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          <section aria-label="Up next" className="flex flex-col gap-2">
            <h2 className={LABEL}>Up next</h2>
            <ul className="grid gap-4 md:grid-cols-3">
              {upNext.map((s) => {
                const [wd, date, time] = s.nextAt.split(' · ')
                return (
                  <li key={s.id} className={`${CARD} flex flex-col gap-3 p-5`}>
                    <div className="flex items-start gap-4">
                      <span className="shrink-0 rounded-lg border border-[var(--rep-line)] px-3 py-2 text-center">
                        <span className={`block ${META}`}>{wd}</span>
                        <span className="block whitespace-nowrap text-[15px] leading-5 font-semibold tabular-nums text-stone-900">{date}</span>
                        <span className={`block ${META} whitespace-nowrap tabular-nums`}>{time}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] leading-5 font-semibold text-stone-900">{s.title}</span>
                        <span className="mt-1 flex items-center gap-1.5 text-[13px] leading-[18px] text-stone-700"><BrandLogo id={s.brand} className="h-4 w-4" />{brandOf(s.brand)?.name}</span>
                        <span className="mt-2 block"><Avatars names={s.recipients} /></span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => toast(COMING_SOON)} className={`${lineBtn} h-8 px-3 text-[13px]`}>Send now</button>
                      <button type="button" onClick={() => toast(`Skipped ${s.title}’s ${date} send`)} className="h-8 rounded-lg px-3 text-[13px] font-medium text-stone-600 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Skip</button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
          <section aria-label="Schedules" className={`${CARD} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--rep-line)]" style={{ background: 'var(--rep-head)' }}>
                    {['Report', 'Brand', 'Runs', 'Recipients', 'Delivery', 'Next run', 'Last sent', 'On'].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-4 py-2.5 text-left text-[14px] leading-5 font-semibold text-stone-900 first:pl-5">{h}</th>)}
                    <th scope="col" className="w-12 pr-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} onClick={() => openEdit(s)} className="h-[52px] cursor-pointer border-b border-[var(--rep-line)] transition-colors duration-100 last:border-0 hover:bg-tint">
                      <td className="whitespace-nowrap px-4 py-1 pl-5 align-middle"><span className="block text-[15px] leading-5 font-medium text-stone-900">{s.title}</span><span className={`block ${META}`}>{kindOf(s)}</span></td>
                      <td className="whitespace-nowrap px-4 align-middle"><span className="inline-flex items-center gap-1.5 text-[15px] leading-5 text-stone-900"><BrandLogo id={s.brand} className="h-4 w-4" />{brandOf(s.brand)?.name}</span></td>
                      <td className="whitespace-nowrap px-4 align-middle text-[15px] leading-5 text-stone-900">{s.runs}</td>
                      <td className="whitespace-nowrap px-4 align-middle"><Avatars names={s.recipients} /></td>
                      <td className="whitespace-nowrap px-4 align-middle text-[15px] leading-5 text-stone-900">{s.delivery}</td>
                      <td className="whitespace-nowrap px-4 align-middle text-[15px] leading-5 tabular-nums text-stone-900">{s.on ? s.nextAt.replace(/ · /g, ' ') : <span className={META}>Paused</span>}</td>
                      <td className="whitespace-nowrap px-4 align-middle">
                        {s.last.status === 'none' ? <span className={META}>Not sent yet</span> : (
                          <span className={`inline-flex items-center gap-2 text-[15px] leading-5 ${s.last.status === 'failed' ? 'text-negative' : 'text-stone-900'}`}>
                            <span className="h-2 w-2 rounded-full" style={{ background: s.last.status === 'failed' ? 'var(--negative)' : 'var(--rep-up-fg)' }} aria-hidden />
                            {s.last.status === 'failed' ? `Failed ${s.last.date}` : `Delivered ${s.last.date}`}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 align-middle" onClick={(e) => e.stopPropagation()}><Switch checked={s.on} onChange={(v) => patch(s.id, { on: v })} aria-label={`${s.title} on`} /></td>
                      <td className="pr-3 align-middle" onClick={(e) => e.stopPropagation()}>
                        <ActionMenu label={`Actions for ${s.title}`} className="grid h-8 w-8 place-items-center rounded-lg text-stone-500 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus" items={menu(s)}><MoreHorizontal size={16} aria-hidden /></ActionMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={`border-t border-[var(--rep-line)] px-5 py-3 ${META}`}>{COMING_SOON}</p>
          </section>
        </>
      )}
      {drawer && <ScheduleDrawer key={drawer.s?.id ?? 'new'} d={drawer} onClose={() => setDrawer(null)} onSave={save} />}
      {toastNode}
    </>
  )
}

// the new / edit drawer: a saved report or a question, the brand, the frequency, the recipients, the format, the preview
function ScheduleDrawer({ d, onClose, onSave }) {
  const [form, setForm] = useState(d.form)
  const set = (p) => setForm((f) => ({ ...f, ...p }))
  const people = form.to.split(/[,\s]+/).filter((x) => x.includes('@') || x.length > 1).length
  const field = 'mt-1 h-10 w-full rounded-[10px] border border-[var(--rep-line)] bg-surface px-3 text-[14px] text-stone-900 outline-none focus:border-line-strong'
  const label = 'block text-[13px] font-medium text-stone-900'
  const reports = savedReports.filter((r) => r.brand === form.brand)
  return (
    <Sheet open onClose={onClose} title={d.s ? 'Edit schedule' : 'New schedule'}
      footer={(
        <>
          <span className={`min-w-0 flex-1 basis-[220px] ${META}`}>Next send: {nextSendOf(form).line}{people ? ` to ${people} ${people === 1 ? 'person' : 'people'}` : ''}</span>
          <span className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg px-3 text-small font-medium text-stone-600 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Cancel</button>
            <button type="button" disabled={!people || (!form.report && !form.question.trim())} onClick={() => onSave(form)} className={inkBtn}>{d.s ? 'Save' : 'Schedule'}</button>
          </span>
        </>
      )}>
      <div className="flex flex-col gap-4">
        <div>
          <span className={label}>Report</span>
          <select value={form.report} onChange={(e) => set({ report: e.target.value })} className={field}>
            <option value="">A question of your own</option>
            {reports.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          {!form.report && <input value={form.question} onChange={(e) => set({ question: e.target.value })} placeholder="What should the report answer?" className={field} />}
        </div>
        <label className={label}>Brand
          <select value={form.brand} onChange={(e) => set({ brand: e.target.value, report: '' })} className={field}>{REPORT_BRANDS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        </label>
        <div>
          <span className={label}>Frequency</span>
          <div className="mt-1"><Segmented label="Frequency" value={form.freq} onChange={(v) => set({ freq: v })} options={[{ value: 'week', label: 'Weekly' }, { value: 'sync', label: 'After each sync' }, { value: 'month', label: 'Monthly' }]} /></div>
          {form.freq !== 'sync' && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              {form.freq === 'week' && <label className={label}>Day<select value={form.day} onChange={(e) => set({ day: e.target.value })} className={field}>{DAYS.map((x) => <option key={x}>{x}</option>)}</select></label>}
              <label className={label}>Time<select value={form.time} onChange={(e) => set({ time: e.target.value })} className={field}>{TIMES.map((x) => <option key={x}>{x}</option>)}</select></label>
            </div>
          )}
        </div>
        <label className={label}>Recipients
          <textarea value={form.to} onChange={(e) => set({ to: e.target.value })} rows={2} placeholder="Emails, separated by commas" className={`${field} h-auto py-2 leading-5`} />
        </label>
        <div>
          <span className={label}>Format</span>
          <div className="mt-1"><Segmented label="Format" value={form.format} onChange={(v) => set({ format: v })} options={FORMATS.map((x) => ({ value: x, label: x }))} /></div>
        </div>
        <p className={`${META} [text-wrap:pretty]`}>{COMING_SOON} The schedule is kept here and shows in All reports as a series.</p>
      </div>
    </Sheet>
  )
}
