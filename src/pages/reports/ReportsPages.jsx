import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Repeat, Sparkles } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Segmented from '../../components/dashboard/Segmented'
import ActionMenu from '../../components/audit/ActionMenu'
import { useToast } from '../../components/dashboard/overlays'
import { linkClick, navigate, usePath } from '../../router'
import { REPORT_BRANDS, buildReport, periodLabel, periodRange, glance, savedReports, schedules, templatesFor } from '../../data/reports'
import Composer from './Composer'
import ReportPage from './ReportPage'
import { Block, Sparkline, Thumb, VerdictChip } from './blocks'
import { BrandLogo, Empty, ReportList, ReportsHead, brandOf, fromQuery, inkBtn, lineBtn, t2, t3, toQuery } from './parts'

// /reports → New report (the composer) · /reports/all → All reports · /reports/scheduled → Scheduled
// /reports/new?… → writing a report · /reports/<id> → a report. ?mock=empty: no reports (Home, All reports, Scheduled)
export default function ReportsRouter() {
  const path = usePath()
  const rest = path.replace(/^\/reports\/?/, '')
  useEffect(() => {
    document.title = `${rest === '' ? 'New report' : rest === 'all' ? 'All reports' : rest === 'scheduled' ? 'Scheduled reports' : 'Report'} · Kraffic`
  }, [rest])
  if (rest === '') return <ReportsHome />
  if (rest === 'all') return <AllReports />
  if (rest === 'scheduled') return <Scheduled />
  return <ReportPage id={rest} />
}
const mockEmpty = () => new URLSearchParams(window.location.search).get('mock') === 'empty'

// ---- New report: the composer, this week at a glance, report templates, and this brand's recent reports
function ReportsHome() {
  const init = useRef(fromQuery()).current
  const [prompt, setPrompt] = useState(init.prompt)
  const [opts, setOpts] = useState(init.opts)
  const box = useRef(null)
  const brand = brandOf(opts.brand)
  const recent = mockEmpty() ? [] : savedReports.filter((r) => r.brand === opts.brand).slice(0, 4)
  const g = glance(opts.brand)
  const send = () => navigate(`/reports/new?${toQuery(opts, prompt.trim())}`)
  const use = (t) => {
    setPrompt(t.prompt)
    setOpts((o) => ({ ...o, period: null, audience: null, length: null, compare: [], kind: null, ...t.sets }))
    requestAnimationFrame(() => { const el = box.current?.querySelector('textarea'); el?.focus(); el?.setSelectionRange(el.value.length, el.value.length) })
  }
  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col lg:pt-4">
      <div className="text-center">
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">New report</h1>
        <p className={`mx-auto mt-1 max-w-[60ch] text-[13px] leading-[18px] ${t2}`}>Ask anything about {brand?.name ?? 'your brand'}’s AI visibility. Every number comes from your tracked prompts and syncs.</p>
      </div>
      <div ref={box} className="mt-6"><Composer prompt={prompt} setPrompt={setPrompt} opts={opts} setOpts={setOpts} onSend={send} autoFocus /></div>

      {g && (
        <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-xl border border-line md:flex md:items-stretch">
          <span className={`col-span-3 flex items-center border-b border-line px-4 py-2 text-[12px] leading-4 font-medium ${t2} md:border-b-0 md:py-0`}>This week at a glance</span>
          {g.items.map((m, i) => (
            <span key={m.id} className={`flex min-w-0 flex-1 flex-col items-start gap-1 px-3 py-2.5 md:flex-row md:items-center md:justify-between md:gap-3 md:border-l md:border-line md:px-4 ${i ? 'border-l border-line' : ''}`}>
              <span className="min-w-0">
                <span className={`block truncate text-[12px] leading-4 ${t3}`}>{m.label}</span>
                <span className="flex items-baseline gap-1.5 tabular-nums">
                  <span className="text-[17px] leading-6 font-semibold text-stone-900">{m.value}{m.unit ?? ''}</span>
                  <span className={`text-[12px] ${m.delta < 0 ? 'font-medium text-negative' : t2}`}>{m.delta > 0 ? '+' : m.delta < 0 ? '−' : ''}{Math.abs(m.delta)}</span>
                </span>
              </span>
              <Sparkline series={m.series} w={64} h={22} />
            </span>
          ))}
        </div>
      )}

      <h2 className="mt-8 text-[15px] leading-5 font-semibold text-stone-900">Start from a template</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {templatesFor(opts.brand).map((t) => (
          <button key={t.id} type="button" onClick={() => use(t)}
            className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface text-left outline-none transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-[0_6px_20px_-12px_rgba(0,0,0,0.25)] focus-visible:ring-2 focus-visible:ring-focus">
            <span className="grid h-[92px] place-items-center border-b border-line bg-tint"><Thumb kind={t.kind} className="h-16 w-28" /></span>
            <span className="flex flex-col gap-1 px-3.5 py-3">
              <span className="text-[14px] leading-5 font-semibold text-stone-900">{t.name}</span>
              <span className={`text-[12px] leading-4 ${t2}`}>{t.what}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-10 flex items-end justify-between gap-3">
        <h2 className="text-[15px] leading-5 font-semibold text-stone-900">Recent reports</h2>
        <a href="/reports/all" onClick={linkClick('/reports/all')} className="rounded text-[13px] leading-[18px] font-medium text-stone-600 underline-offset-4 outline-none hover:text-stone-900 hover:underline focus-visible:ring-2 focus-visible:ring-focus">All reports</a>
      </div>
      <div className="mt-3">
        {recent.length
          ? <div className="grid gap-3 md:grid-cols-2">{recent.map((r) => <ReportCard key={r.id} r={r} />)}</div>
          : <Empty title={`No reports for ${brand?.name ?? 'this brand'} yet`}>Ask a question above, or start from a template. Reports you write or schedule show up here.</Empty>}
      </div>
    </div>
  )
}

// a recent report: its own headline as the title, the verdict, a thumbnail of its hero, period · audience · date
const AUD = { team: 'Team', ceo: 'CEO', client: 'Client' }
function ReportCard({ r }) {
  const b = buildReport(r.opts, r.prompt)
  if (!b.ok) return null
  return (
    <a href={`/reports/${r.id}`} onClick={linkClick(`/reports/${r.id}`)}
      className="group flex gap-4 rounded-xl border border-line bg-surface p-4 outline-none transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-[0_6px_20px_-12px_rgba(0,0,0,0.25)] focus-visible:ring-2 focus-visible:ring-focus">
      <span className="grid h-14 w-[84px] shrink-0 place-items-center rounded-lg bg-tint"><Thumb kind={b.kind} className="h-11 w-[72px]" /></span>
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="line-clamp-2 text-[14px] leading-5 font-semibold text-stone-900 [text-wrap:pretty]">{b.headline}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <VerdictChip verdict={b.verdict} small />
          <span className={`flex items-center gap-1.5 text-[12px] leading-4 ${t3} tabular-nums`}>
            {r.scheduled && <Repeat size={12} aria-label="Scheduled" className="text-stone-500" />}
            {periodLabel(b.opts.period)} · {AUD[b.opts.audience]} · {r.created}
          </span>
        </span>
      </span>
    </a>
  )
}

// ---- All reports: every brand, newest first; Saved = the ones kept (scheduled runs are kept)
function AllReports() {
  const [brandId, setBrandId] = useState('all')
  const [which, setWhich] = useState('all')
  const rows = (mockEmpty() ? [] : savedReports).filter((r) => (brandId === 'all' || r.brand === brandId) && (which === 'all' || r.saved))
  const newBtn = <a href="/reports" onClick={linkClick('/reports')} className={inkBtn}><Sparkles size={14} aria-hidden />New report</a>
  return (
    <>
      <ReportsHead title="All reports" subtitle="Every report written for your brands, newest first" actions={newBtn} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative inline-flex h-9 items-center">
          <span className="sr-only">Brand</span>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)}
            className="h-9 appearance-none rounded-lg border border-line bg-raised pl-3.5 pr-8 text-small font-medium text-stone-600 outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <option value="all">All brands</option>
            {REPORT_BRANDS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-3 h-3 w-3 text-stone-500" viewBox="0 0 12 12" aria-hidden><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
        </label>
        <Segmented label="Show" value={which} onChange={setWhich} options={[{ value: 'all', label: 'Recent' }, { value: 'saved', label: 'Saved' }]} />
      </div>
      {rows.length
        ? <ReportList rows={rows} />
        : <Empty title={brandId === 'all' ? 'No reports yet' : `No reports for ${brandOf(brandId)?.name} yet`} action={newBtn}>Write one from New report: ask a question, then pick the period and who it’s for. It shows up here, and you can schedule it from the report.</Empty>}
    </>
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
