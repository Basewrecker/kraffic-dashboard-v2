import { useEffect, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import { downloadCsv } from '../../components/dashboard/csv'
import { linkClick, navigate } from '../../router'
import { useTrends } from './store'
import { CHANNELS, dayOf, displayText, sourceName } from './analyze'
import Results from './Results'
import BackLink from '../../components/BackLink'
import { Confirm, Progress, RowMenu, SENTIMENT, STANCE, cardTitle, fmtDate, lineBtn, subtitleCls, t2, t3 } from './parts'

// /trends/:runId — one run: KPIs, coverage over time, how it's discussed, where, and every mention.
export default function RunDetail({ runId }) {
  const { runById, runs, rerun, remove } = useTrends()
  const run = runById(runId)
  const [ask, setAsk] = useState(null)
  useEffect(() => { document.title = `${run ? run.prompt : 'Run'} · Trends · Kraffic` }, [run])

  if (!run) {
    return (
      <>
        <div><Back /></div>
        <Card className="px-5 py-12 text-center">
          <p className={`text-[14px] leading-5 ${t2}`}>This analysis doesn’t exist any more.</p>
          <a href="/trends" onClick={linkClick('/trends')} className="mt-3 inline-block rounded text-[14px] font-medium text-stone-900 underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-focus">Back to Trends</a>
        </Card>
      </>
    )
  }

  const previous = run.previousRunId ? runs.find((r) => r.id === run.previousRunId && r.status === 'done') ?? null : null
  const doRerun = () => navigate(`/trends/${rerun(run)}`)
  const doDelete = () => setAsk({ title: 'Delete this analysis?', body: `“${run.prompt}” and its mentions will be removed from this project.`, onConfirm: () => { remove(run.id); navigate('/trends') } })
  const exportCsv = () => downloadCsv(`trends-${run.id}.csv`, run.raw.mentions, [
    { label: 'Date', csv: (m) => dayOf(m.publishedAt) },
    { label: 'Channel', csv: (m) => CHANNELS[m.channel].label },
    { label: 'Source', csv: sourceName },
    { label: 'Text', csv: displayText },
    { label: 'Sentiment', csv: (m) => SENTIMENT[m.sentiment].label },
    { label: 'Stance', csv: (m) => STANCE[m.stance].label },
    { label: 'URL', key: 'url' },
  ])
  const done = run.status === 'done'
  const menu = [...(done && run.mentions ? [{ label: 'Export CSV', onClick: exportCsv }] : []), { label: 'Delete', danger: true, onClick: doDelete }]

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <Back />
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">{sentenceCase(run.prompt)}</h1>
          <p className={`mt-1 text-[13px] leading-[18px] ${t2} tabular-nums`}>
            {done ? `${run.mentions} ${run.mentions === 1 ? 'mention' : 'mentions'} from news and social · ${run.region} · Ran ${fmtDate(run.createdAt)}`
              : run.status === 'running' ? `${run.region} · Started ${fmtDate(run.createdAt)}` : `${run.region} · Tried ${fmtDate(run.createdAt)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 lg:pt-6">
          <button type="button" onClick={doRerun} disabled={run.status === 'running'} className={`${lineBtn} max-lg:h-10 max-lg:flex-1`}><RefreshCw size={14} aria-hidden />Re-run</button>
          <span className="rounded-lg border border-line"><RowMenu label="More actions" items={menu} /></span>
        </div>
      </div>

      {run.status === 'running' ? <RunningBody run={run} />
        : run.status === 'failed' ? <FailedBody run={run} onRetry={() => navigate(`/trends/${rerun(run, { replace: true })}`)} />
          : run.mentions === 0 ? (
            <Card className="flex flex-col items-center px-5 py-12 text-center">
              <p className="text-[15px] leading-[22px] text-stone-900">Nothing found for this question in {run.region} yet.</p>
              <p className={`mt-1 text-[13px] leading-[18px] ${t2}`}>News and social posts can take a few days to show up. Try again later or widen the region.</p>
              <button type="button" onClick={doRerun} className={`${lineBtn} mt-4`}><RefreshCw size={14} aria-hidden />Re-run</button>
            </Card>
          ) : <Results run={run} previous={previous} />}
      <Confirm ask={ask} onClose={() => setAsk(null)} />
    </>
  )
}

const sentenceCase = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const Back = () => <BackLink to="/trends">Trends</BackLink>

// ---- running: the steps, then fixed-height skeletons where the results will land
function RunningBody({ run }) {
  const sk = 'animate-pulse rounded-2xl bg-tint motion-reduce:animate-none'
  return (
    <>
      <Card className="p-5">
        <h2 className={cardTitle}>Analyzing</h2>
        <p className={subtitleCls}>Takes 1–2 minutes. You can leave this page; the run keeps going.</p>
        <Progress step={run.step} className="mt-4" />
      </Card>
      <div className={`${sk} h-[104px]`} aria-hidden />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-hidden>
        <div className={`${sk} h-[320px] lg:col-span-2`} />
        <div className={`${sk} h-[320px]`} />
      </div>
    </>
  )
}

function FailedBody({ run, onRetry }) {
  return (
    <Card role="alert" className="flex items-start gap-3 p-5">
      <AlertCircle size={20} className="mt-0.5 shrink-0 text-negative" aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 className={cardTitle}>This analysis didn’t finish</h2>
        <p className={`mt-1 text-[14px] leading-5 ${t2}`}>{run.error}</p>
        <button type="button" onClick={onRetry} className={`${lineBtn} mt-4`}><RefreshCw size={14} aria-hidden />Retry</button>
      </div>
    </Card>
  )
}

