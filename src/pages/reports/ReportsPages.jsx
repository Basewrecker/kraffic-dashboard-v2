import { useEffect, useRef, useState } from 'react'
import { ArrowRight, MoreHorizontal, Sparkles } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Segmented from '../../components/dashboard/Segmented'
import ActionMenu from '../../components/audit/ActionMenu'
import { useToast } from '../../components/dashboard/overlays'
import { linkClick, navigate, usePath } from '../../router'
import { REPORT_BRANDS, buildReport, periodRange, dataFor, savedReports, schedules, suggestionsFor, LENGTHS, AUDIENCES } from '../../data/reports'
import Composer from './Composer'
import ReportPage from './ReportPage'
import { Block } from './blocks'
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

// ---- New report: the composer, suggestions, and this brand's recent reports
function ReportsHome() {
  const init = useRef(fromQuery()).current
  const [prompt, setPrompt] = useState(init.prompt)
  const [opts, setOpts] = useState(init.opts)
  const box = useRef(null)
  const brand = brandOf(opts.brand)
  const recent = mockEmpty() ? [] : savedReports.filter((r) => r.brand === opts.brand).slice(0, 4)
  const send = () => navigate(`/reports/new?${toQuery(opts, prompt.trim())}`)
  const use = (s) => {
    setPrompt(s.text)
    setOpts((o) => ({ ...o, ...s.sets }))
    requestAnimationFrame(() => { const el = box.current?.querySelector('textarea'); el?.focus(); el?.setSelectionRange(el.value.length, el.value.length) })
  }
  const setsLine = (s) => [
    s.sets.period && { week: 'This week', '30d': 'Last 30 days', quarter: 'Last quarter' }[s.sets.period],
    s.sets.audience && AUDIENCES.find((a) => a.id === s.sets.audience)?.label,
    s.sets.length && LENGTHS.find((l) => l.id === s.sets.length)?.label,
  ].filter(Boolean).join(' · ')
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col lg:pt-6">
      <div className="text-center">
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">New report</h1>
        <p className={`mx-auto mt-1 max-w-[56ch] text-[13px] leading-[18px] ${t2}`}>Ask anything about {brand?.name ?? 'your brand'}’s AI visibility. Reports are written from your tracked prompts and syncs; every number comes from that data.</p>
      </div>
      <div ref={box} className="mt-6"><Composer prompt={prompt} setPrompt={setPrompt} opts={opts} setOpts={setOpts} onSend={send} autoFocus /></div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {suggestionsFor(opts.brand).map((s) => (
          <button key={s.id} type="button" onClick={() => use(s)}
            className="group flex min-h-[76px] flex-col justify-between rounded-xl border border-line bg-surface px-3.5 py-3 text-left outline-none transition-colors duration-150 hover:border-line-strong hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus">
            <span className="text-[14px] leading-5 font-medium text-stone-900">{s.text}</span>
            <span className={`mt-1.5 flex items-center justify-between gap-2 text-[12px] leading-4 ${t3}`}>
              <span className="truncate">{setsLine(s) || (s.sets.compare?.length ? 'Compares one competitor' : 'Uses the chips as set')}</span>
              <ArrowRight size={13} className="shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
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
          ? <ReportList rows={recent} showBrand={false} />
          : <Empty title={`No reports for ${brand?.name ?? 'this brand'} yet`}>Ask a question above, or start from a suggestion. Reports you write or schedule show up here.</Empty>}
      </div>
    </div>
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
  const d = s && dataFor(s.brand)
  const range = r?.ok && d ? periodRange(d, r.opts.period) : ''
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
            {pick('headline') && <Block block={pick('headline')} title={s.title} />}
            {pick('lede') && <Block block={pick('lede')} />}
            <div><span className={inkBtn}>Open the full report</span></div>
            <p className={`border-t border-line pt-4 text-[12px] leading-[18px] ${t3}`}>Sent {SENT[s.cadence] ?? s.cadence} by Kraffic for PTA Agency, written from the latest sync each time. To change or stop it, open Scheduled in Kraffic.</p>
          </div>
        </div>
      )}
    </Modal>
  )
}
