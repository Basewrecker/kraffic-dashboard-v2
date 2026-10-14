import { useEffect, useMemo, useState } from 'react'
import { Download, MoreHorizontal, Plus, Presentation } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import Segmented from '../../components/dashboard/Segmented'
import Select from '../../components/ui/Select'
import Switch from '../../components/ui/Switch'
import Modal from '../../components/ui/Modal'
import SiteLogo from '../../components/ui/SiteLogo'
import BackLink from '../../components/BackLink'
import ActionMenu from '../../components/audit/ActionMenu'
import { useToast } from '../../components/dashboard/overlays'
import { closeDrawer, openDrawer, setParams, useParams } from '../../components/audit/parts'
import DrawerShell, { useDrawer } from '../../components/audit/DrawerShell'
import ToolPage, { cardTitle, inkBtn, lineBtn, subtitleCls, t2, t3 } from '../../components/tool/ToolPage'
import KpiStrip from '../../components/tool/KpiStrip'
import { navigate } from '../../router'
import { account, execReportSections, execReportStates } from '../../data/mock'
import { agency, role } from '../../store/workspace'

// /more-tools/executive-reports — branded summary reports; /more-tools/executive-reports/<id> is one report.
// Production: executive-reports module (ReportExportLog, ExecutiveReportSchedule {cadence, recipients}, WhiteLabelConfig
// for agencies, GET exports/:id/download → the PDF). GAP: period, Draft / Scheduled / Sent (production has GENERATING /
// READY / FAILED), recipients on a report, section content (production ignores includeSections). No share-link
// endpoint, so there's no Share link. ?mock=none|running|error|full (default full).
const BASE = '/more-tools/executive-reports'
const STATUS = { DRAFT: 'Draft', SCHEDULED: 'Scheduled', SENT: 'Sent' }
const SECTIONS = Object.entries(execReportSections).map(([id, s]) => [id, s.label])
const CADENCE = [['ON_DEMAND', 'Send once'], ['WEEKLY', 'Every week'], ['BIWEEKLY', 'Every 2 weeks'], ['MONTHLY', 'Every month'], ['QUARTERLY', 'Every quarter']]
const day = (d) => new Date(`${d.slice(0, 10)}T00:00:00Z`)
const fmt = (d, o = { month: 'short', day: 'numeric' }) => day(d).toLocaleDateString('en-US', { ...o, timeZone: 'UTC' })
const period = ({ from, to }) => {
  const a = day(from), b = day(to)
  if (a.getUTCDate() === 1 && a.getUTCMonth() === b.getUTCMonth()) return fmt(from, { month: 'long', year: 'numeric' })
  return `${fmt(from)} – ${fmt(to, { month: 'short', day: 'numeric', year: 'numeric' })}`
}
const head = `hidden h-9 items-center gap-3 border-y border-[var(--div)] bg-tint px-5 text-[13px] leading-[18px] font-medium ${t3} md:grid`
const COLS = 'md:grid-cols-[minmax(0,1fr)_180px_88px_88px_96px_32px]'

export default function ReportsPage({ id }) {
  const q = useParams()
  const key = execReportStates[q.get('mock')] ? q.get('mock') : 'full'
  const st = execReportStates[key]
  const [reports, setReports] = useState(st.reports)
  useEffect(() => setReports(st.reports), [st])
  const [doomed, setDoomed] = useState(null)
  const [toastNode, toast] = useToast({ position: 'center' })
  useEffect(() => { document.title = `${id ? 'Report' : 'Executive Reports'} · Toolkit · Kraffic` }, [id])
  const report = id && reports.find((r) => r.id === id)
  if (id) return report ? <ReportView r={report} toast={toast} toastNode={toastNode} /> : <p className={`text-[14px] ${t2}`}>This report doesn’t exist any more.</p>

  const state = key === 'error' ? 'error' : key === 'running' ? 'running' : !reports.length ? 'not-run' : 'ready'
  const create = () => openDrawer('new', 'report')
  const duplicate = (r) => { setReports((l) => [{ ...r, id: `${r.id}-copy-${l.length}`, title: `${r.title} (copy)`, status: 'DRAFT', recipients: [], createdAt: '2026-10-14T12:00:00Z' }, ...l]); toast(`Duplicated “${r.title}”`) }
  const add = (r) => { setReports((l) => [r, ...l]); closeDrawer('new'); toast(r.status === 'DRAFT' ? 'Saved as a draft' : `“${r.title}” is ready`) }
  const remove = () => { setReports((l) => l.filter((r) => r.id !== doomed.id)); toast(`Deleted “${doomed.title}”`); setDoomed(null) }

  return (
    <>
      <ToolPage title="Executive Reports" subtitle={`Branded summaries of ${account.name}’s AI visibility for managers and clients`}
        primary={{ label: 'New report', icon: Plus, onClick: create }} state={state}
        empty={{ icon: Presentation, title: 'No reports yet', body: 'Pick a period and the sections you want. We’ll build a branded report you can download as a PDF or send on a schedule.', action: { label: 'New report', icon: Plus, onClick: create } }}
        running={{ label: 'Building “October performance”…', since: st.generating?.startedAt ?? new Date().toISOString() }}
        error={{ title: 'A report didn’t generate', reason: st.error, onRetry: () => setParams({ mock: 'running' }), keepBody: true }}>
        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-3 max-md:px-4">
            <h2 className={cardTitle}>Reports</h2>
            <p className={subtitleCls}>Newest first. Open one to read it or download the PDF.</p>
          </div>
          <div className={`${head} ${COLS}`}><span>Name</span><span>Period</span><span>Created</span><span>Sent to</span><span>Status</span><span /></div>
          <ul className="divide-y divide-[var(--div)] max-md:border-t max-md:border-[var(--div)]">
            {reports.map((r) => (
              <li key={r.id}>
                <div role="button" tabIndex={0} onClick={() => navigate(`${BASE}/${r.id}`)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) navigate(`${BASE}/${r.id}`) }}
                  aria-label={`Open ${r.title}`}
                  className={`group grid min-h-14 w-full cursor-pointer grid-cols-[minmax(0,1fr)_32px] items-center gap-x-3 px-5 py-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus max-md:px-4 ${COLS}`}>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{r.title}</span>
                    <span className={`block truncate text-[13px] leading-[18px] ${t3} md:hidden`}>{period(r.period)} · {STATUS[r.status]}{r.recipients.length ? ` · ${r.recipients.length} people` : ''}</span>
                  </span>
                  <span className={`hidden truncate text-[13px] leading-[18px] ${t2} md:block`}>{period(r.period)}</span>
                  <span className={`hidden text-[13px] leading-[18px] ${t3} tabular-nums md:block`}>{fmt(r.createdAt)}</span>
                  <span className={`hidden text-[13px] leading-[18px] tabular-nums md:block ${r.recipients.length ? t2 : t3}`}>{r.recipients.length ? `${r.recipients.length} ${r.recipients.length === 1 ? 'person' : 'people'}` : '—'}</span>
                  <span className={`hidden text-[13px] leading-[18px] md:block ${r.status === 'DRAFT' ? t3 : t2}`}>{STATUS[r.status]}</span>
                  <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <ActionMenu label={`Actions for ${r.title}`} items={[
                      { label: 'Open', onClick: () => navigate(`${BASE}/${r.id}`) }, { label: 'Duplicate', onClick: () => duplicate(r) }, { label: 'Delete', onClick: () => setDoomed(r) },
                    ]} className="grid h-8 w-8 place-items-center rounded-lg text-stone-600 outline-none transition-colors duration-150 hover:bg-[var(--color-surface)] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
                      <MoreHorizontal size={16} aria-hidden />
                    </ActionMenu>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </ToolPage>
      <NewReportDrawer onDone={add} />
      <Modal open={Boolean(doomed)} onClose={() => setDoomed(null)} title="Delete this report?" size="sm"
        footer={<><button type="button" onClick={() => setDoomed(null)} className={lineBtn}>Cancel</button><button type="button" onClick={remove} className={inkBtn}>Delete report</button></>}>
        <p className={`text-[14px] leading-5 ${t2}`}>“{doomed?.title}” and its PDF will be deleted.{doomed?.cadence ? ' Its schedule stops too.' : ''} This can’t be undone.</p>
      </Modal>
      {toastNode}
    </>
  )
}

// ---- New report: 1 name & period · 2 sections · 3 branding · 4 recipients & schedule (?new=report)
const PERIODS = {
  month: { from: '2026-09-01', to: '2026-09-30' },
  quarter: { from: '2026-07-01', to: '2026-09-30' },
}
function Step({ n, title, children }) {
  return (
    <section className="flex gap-3 border-b border-[var(--div)] py-5 last:border-0">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-semibold text-on-ink tabular-nums" aria-hidden>{n}</span>
      <div className="min-w-0 flex-1">
        <h3 className="pt-0.5 text-[14px] leading-5 font-semibold text-stone-900">{title}</h3>
        <div className="mt-3">{children}</div>
      </div>
    </section>
  )
}
const field = 'h-10 w-full rounded-lg border border-line bg-raised px-3 text-[14px] text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-400'
const NEW = { id: 'report' } // stable: useDrawer keeps the item while it changes identity
function NewReportDrawer({ onDone }) {
  const drawer = useDrawer('new', (v) => (v === 'report' ? NEW : null))
  const isAgency = role() === 'agency'
  const fresh = () => ({ title: 'September performance', when: 'month', from: '2026-10-01', to: '2026-10-14', sections: new Set(['visibility', 'prompts', 'citations']), whiteLabel: isAgency, emails: '', cadence: 'ON_DEMAND' })
  const [f, setF] = useState(fresh)
  useEffect(() => { if (drawer.open) setF(fresh()) }, [drawer.open]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!drawer.item) return null
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }))
  const toggle = (id) => setF((s) => { const n = new Set(s.sections); n.has(id) ? n.delete(id) : n.add(id); return { ...s, sections: n } })
  const recipients = f.emails.split(/[\s,]+/).filter((e) => /\S+@\S+\.\S+/.test(e))
  const valid = f.title.trim() && f.sections.size > 0
  const build = (status) => onDone({
    id: `rep_${Date.now()}`, title: f.title.trim(), period: f.when === 'custom' ? { from: f.from, to: f.to } : PERIODS[f.when], createdAt: '2026-10-14T12:00:00Z',
    recipients, status, cadence: f.cadence === 'ON_DEMAND' ? undefined : f.cadence, sections: SECTIONS.map(([id]) => id).filter((id) => f.sections.has(id)),
  })
  return (
    <DrawerShell drawer={drawer} title="New report" meta={<span>A branded summary you can download or send</span>}
      footer={<><button type="button" onClick={() => build('DRAFT')} disabled={!valid} className={lineBtn}>Save draft</button><button type="button" onClick={() => build(recipients.length ? (f.cadence === 'ON_DEMAND' ? 'SENT' : 'SCHEDULED') : 'DRAFT')} disabled={!valid} className={inkBtn}>Create</button></>}>
      <Step n={1} title="Name and period">
        <label className="block"><span className="sr-only">Report name</span><input value={f.title} onChange={set('title')} className={field} /></label>
        <Segmented size="md" className="mt-3" label="Period" value={f.when} onChange={set('when')} options={[{ value: 'month', label: 'Last month' }, { value: 'quarter', label: 'Last quarter' }, { value: 'custom', label: 'Custom' }]} />
        {f.when === 'custom' ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block"><span className={`text-[13px] leading-[18px] ${t2}`}>From</span><input type="date" value={f.from} onChange={set('from')} className={`${field} mt-1`} /></label>
            <label className="block"><span className={`text-[13px] leading-[18px] ${t2}`}>To</span><input type="date" value={f.to} onChange={set('to')} className={`${field} mt-1`} /></label>
          </div>
        ) : <p className={`mt-2 text-[13px] leading-[18px] ${t3}`}>{period(PERIODS[f.when])}</p>}
      </Step>
      <Step n={2} title="Sections">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <label className="flex h-9 cursor-pointer items-center gap-2 text-[14px] leading-5 text-stone-900">
                <input type="checkbox" checked={f.sections.has(id)} onChange={() => toggle(id)} className="h-4 w-4 accent-ink" />{label}
              </label>
            </li>
          ))}
        </ul>
      </Step>
      <Step n={3} title="Branding">
        <div className="flex items-center gap-3">
          <SiteLogo domain={f.whiteLabel ? agency.domain : account.domain} name={f.whiteLabel ? agency.name : account.name} className="h-8 w-8 rounded-lg" imgPad="p-1" />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] leading-5 text-stone-900">{f.whiteLabel ? agency.name : account.name}</span>
            <span className={`block text-[13px] leading-[18px] ${t3}`}>{f.whiteLabel ? 'Your agency’s logo and colours; no Kraffic branding' : 'Logo on the cover'}</span>
          </span>
        </div>
        {isAgency && <Switch className="mt-3" checked={f.whiteLabel} onChange={set('whiteLabel')}>White label with {agency.name} branding</Switch>}
      </Step>
      <Step n={4} title="Recipients and schedule">
        <label className="block"><span className={`text-[13px] leading-[18px] ${t2}`}>Email addresses</span>
          <input value={f.emails} onChange={set('emails')} placeholder="name@company.com, another@company.com" className={`${field} mt-1`} />
        </label>
        <div className="mt-3"><span className={`text-[13px] leading-[18px] ${t2}`}>How often</span><Select label="How often" size="md" className="mt-1 w-full" value={f.cadence} onChange={set('cadence')} options={CADENCE} /></div>
        <p className={`mt-2 text-[13px] leading-[18px] ${t3}`}>{recipients.length ? `${recipients.length} ${recipients.length === 1 ? 'person' : 'people'} will get the PDF.` : 'Leave empty to only download it.'}</p>
      </Step>
    </DrawerShell>
  )
}

// ---- One report: a print-style page (cover, then one section per chosen area)
function ReportView({ r, toast, toastNode }) {
  const isAgency = role() === 'agency'
  const sections = useMemo(() => r.sections.map((id) => [id, execReportSections[id]]), [r])
  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <BackLink to={BASE}>Executive Reports</BackLink>
          <h1 className="truncate text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">{r.title}</h1>
          <p className={`mt-1 text-[13px] leading-[18px] ${t2}`}>{STATUS[r.status]} · created {fmt(r.createdAt)}{r.recipients.length ? ` · sent to ${r.recipients.length} people` : ''}</p>
        </div>
        <button type="button" onClick={() => toast('Downloading the PDF…')} className={`${lineBtn} max-lg:self-start`}><Download size={14} aria-hidden />Download PDF</button>
      </div>
      <article className="mx-auto flex w-full max-w-[880px] flex-col gap-4">
        <Card className="p-8 max-md:p-5">
          <div className="flex items-center gap-3">
            <SiteLogo domain={account.domain} name={account.name} className="h-10 w-10 rounded-lg" imgPad="p-1" />
            <span className={`text-[14px] leading-5 ${t2}`}>{account.name}</span>
          </div>
          <h2 className="mt-10 text-[28px] leading-9 font-semibold tracking-[-0.02em] text-stone-900 max-md:text-[22px] max-md:leading-7">{r.title}</h2>
          <p className={`mt-1 text-[15px] leading-[22px] ${t2}`}>AI visibility report · {period(r.period)}</p>
          <p className={`mt-10 text-[13px] leading-[18px] ${t3}`}>Prepared by {isAgency ? agency.name : account.name} · {fmt(r.createdAt, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </Card>
        {sections.map(([id, s], i) => (
          <section key={id} aria-labelledby={`rs-${id}`} className="flex flex-col gap-3 pt-4">
            <div>
              <h2 id={`rs-${id}`} className="text-[20px] leading-7 font-semibold tracking-[-0.01em] text-stone-900"><span className={`${t3} tabular-nums`}>{i + 1}.</span> {s.label}</h2>
              <p className={`mt-1 text-[14px] leading-5 ${t2}`}>{s.summary}</p>
            </div>
            <KpiStrip items={s.items} />
          </section>
        ))}
      </article>
      {toastNode}
    </>
  )
}
