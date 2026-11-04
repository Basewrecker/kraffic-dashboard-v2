// Step 5: the page is live. Published line (tick, date, match ring) → 4 weekly syncs, one column each (engines named
// for this prompt ✓ / ✕, visibility before → after) → the result after week 4.
import { PlatformIcon } from '../../../components/dashboard/icons'
import Card from '../../../components/dashboard/Card'
import { ENGINES, ENGINE_NAME, engineIcon } from '../../../data/contentOpportunities'
import { NEXT_TRIES } from '../../../data/contentOpportunities-proposed'
import { EngineMark, Ring, WeekSegments, midTruncate, pathOf } from '../parts'
import { cellState, columnKinds, fmtDay, matchPct, resultOf, weeksDone } from './model'
import { DashedRing, GreenTick, btnSmall } from './ui'

const meta = 'text-[13px] leading-[18px] text-stone-500 tabular-nums'

function PublishedLine({ url, publishedAt, match, fresh }) {
  const pct = matchPct(match)
  const path = pathOf(url)
  return (
    <div className={`flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-6 ${fresh ? 'motion-safe:animate-[card-in_200ms_ease-out]' : ''}`}>
      <div className="flex w-full min-w-0 flex-1 items-center gap-2.5">
        <GreenTick size={fresh ? 22 : 18} />
        <p className="min-w-0 text-body text-stone-900 tabular-nums sm:truncate">
          <span className="font-semibold">Published {fmtDay(publishedAt)}</span>
          <span className="text-stone-500"> · </span>
          <span className="text-stone-600" title={path}>{midTruncate(path, 36)}</span>
        </p>
      </div>
      {pct != null && (
        <div className="flex shrink-0 items-center gap-2">
          <Ring value={pct} total={100} size={fresh ? 24 : 20} stroke={3} tone="positive" />
          <span className="text-small text-stone-700 tabular-nums">{pct}% of the draft found on the page</span>
        </div>
      )}
    </div>
  )
}

function Column({ sync, kind, week, index, reveal }) {
  const muted = kind === 'next' || kind === 'later'
  const style = reveal ? { animationDelay: `${index * 150}ms` } : undefined
  return (
    <li style={style}
      className={`flex min-w-0 flex-col gap-3 rounded-xl border p-3 ${muted ? 'border-dashed border-line' : 'border-line'} ${reveal ? 'motion-safe:animate-[card-in_200ms_ease-out_both]' : ''}`}>
      <span className={`${meta} ${muted ? '' : 'text-stone-600'}`}>
        Week {week} · {fmtDay(sync.date, { short: true })}
      </span>
      <span className="flex items-center gap-3.5" role="list" aria-label="Named for this prompt">
        {ENGINES.map((e) => {
          const state = cellState(sync, e)
          return state === 'pending'
            ? <span key={e} role="listitem" className="inline-flex opacity-35 grayscale" title={`${ENGINE_NAME[e]}: not run yet`}><PlatformIcon id={engineIcon(e)} size={20} /></span>
            : <span key={e} role="listitem"><EngineMark engine={e} state={state} size={20} /></span>
        })}
      </span>
      {kind === 'done' && (
        <div className="flex flex-col gap-1.5">
          <span className="flex items-baseline gap-1.5 text-small text-stone-500 tabular-nums">
            {sync.visibility.before}% <span aria-label="to">→</span> <b className="text-title font-semibold text-stone-900">{sync.visibility.after}%</b>
          </span>
          <span className="h-1 overflow-hidden rounded-full bg-[var(--data-track)]" aria-hidden>
            <span className="block h-full rounded-full bg-ink transition-[width] duration-300 ease-out" style={{ width: `${sync.visibility.after}%` }} />
          </span>
        </div>
      )}
      {kind === 'gap' && (
        <div className="flex flex-col gap-0.5">
          <span className="text-title font-semibold text-stone-500">—</span>
          <span className={`${meta} text-balance`}>Sync failed, counted as a gap</span>
        </div>
      )}
      {muted && (
        <div className="flex flex-col gap-0.5">
          <span className={meta}>{kind === 'next' ? 'Next sync' : 'Not run yet'}</span>
        </div>
      )}
    </li>
  )
}

function Result({ result, onEditDraft }) {
  if (result.kind === 'improved') {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-[var(--rep-up-bg)] px-4 py-3 motion-safe:animate-[card-in_200ms_ease-out_both] motion-safe:[animation-delay:600ms]">
        <GreenTick size={20} />
        <p className="min-w-0 flex-1 text-body text-stone-900"><span className="font-semibold text-[var(--rep-up-fg)]">Improved:</span> now named on {result.label}</p>
        <span className="flex shrink-0 items-center gap-2">
          {result.engines.map((e) => <EngineMark key={e} engine={e} state="named" size={18} />)}
        </span>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-line motion-safe:animate-[card-in_200ms_ease-out_both] motion-safe:[animation-delay:600ms]">
      <div className="flex items-center gap-2.5 px-4 pb-2 pt-3">
        <DashedRing size={20} />
        <p className="text-body font-semibold text-stone-900">No change yet: here’s what to try next</p>
      </div>
      <ul className="divide-y divide-line">
        {NEXT_TRIES.map((t) => (
          <li key={t.title} className="flex items-center gap-4 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-small font-medium text-stone-900">{t.title}</p>
              <p className={meta}>{t.text}</p>
            </div>
            <button type="button" className={btnSmall} onClick={() => onEditDraft?.()}>Add to draft</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function TrackingCard({ url, publishedAt, match, syncs, gained, fresh = false, onEditDraft }) {
  const done = weeksDone(syncs)
  const kinds = columnKinds(syncs)
  const result = resultOf(syncs, gained)
  return (
    <Card className="flex flex-col gap-4 px-5 py-4">
      <PublishedLine url={url} publishedAt={publishedAt} match={match} fresh={fresh} />
      <div className="h-px bg-line" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-body font-semibold text-stone-900">Tracking</h3>
        <WeekSegments done={done} />
        <span className={meta}>Week {done} of {syncs.length}</span>
        {result.kind === 'running' && <span className={`${meta} ml-auto`}>Result after week {syncs.length} · {fmtDay(result.date)}</span>}
      </div>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {syncs.map((s, i) => <Column key={s.date} sync={s} kind={kinds[i]} week={i + 1} index={i} reveal />)}
      </ol>
      {result.kind !== 'running' && <Result result={result} onEditDraft={onEditDraft} />}
    </Card>
  )
}
