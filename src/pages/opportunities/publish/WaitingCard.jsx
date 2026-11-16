// Step 5: before the page is found. Waiting (pulsing dot, daily check) · checking (≤600ms) · not found after 14 days.
import { safeHref } from '../draft/markdown'
import { useState } from 'react'
import { Check, ExternalLink } from 'lucide-react'
import Card from '../../../components/dashboard/Card'
import { midTruncate, pathOf } from '../parts'
import { fmtDay } from './model'
import { DashedRing, PulseDot, btnPrimary, btnSecondary } from './ui'

export function WaitingCard({ url, checkedAt, checking, onCheck }) {
  const path = pathOf(url)
  return (
    <Card className="flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-4 motion-safe:animate-[card-in_200ms_ease-out]" aria-live="polite">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-[7px]"><PulseDot /></span>
        <div className="min-w-0">
          <p className="text-body text-stone-900">
            {checking ? 'Checking ' : 'Waiting for you to publish on '}
            <span className="font-semibold" title={path}>{midTruncate(path, 44)}</span>
            {checking && '…'}
          </p>
          <p className="text-[13px] leading-[18px] text-stone-500 tabular-nums">
            We check this page every day{checkedAt ? ` · Last checked ${fmtDay(checkedAt)}` : ''}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" className={btnSecondary} disabled={checking} onClick={onCheck}>Check now</button>
        {/* "I've published it" is the payoff bar's / panel header's button (one primary per view) */}
      </div>
    </Card>
  )
}

export function NotFoundCard({ url, days, checking, onCheck, onEditDraft }) {
  const [reminded, setReminded] = useState(false)
  const path = pathOf(url)
  return (
    <Card className="flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-4 motion-safe:animate-[card-in_200ms_ease-out]" aria-live="polite">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-px"><DashedRing /></span>
        <div className="min-w-0">
          <p className="text-body font-semibold text-stone-900 tabular-nums">{checking ? 'Checking again…' : `Not found on the page after ${days} days`}</p>
          <a href={safeHref(url) ?? undefined} target="_blank" rel="noopener noreferrer" title={url}
            className="inline-flex max-w-full items-center gap-1 rounded text-small text-stone-600 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
            <span className="truncate">{midTruncate(path, 48)}</span>
            <ExternalLink size={13} className="shrink-0" aria-hidden />
          </a>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button type="button" className={btnSecondary} aria-pressed={reminded} onClick={() => setReminded((r) => !r)}>
          {reminded ? <><Check size={14} strokeWidth={2.5} className="text-[var(--rep-up-fg)]" aria-hidden />Reminder set</> : 'Remind me'}
        </button>
        <button type="button" className={btnSecondary} onClick={() => onEditDraft?.()}>Change the page</button>
        <button type="button" className={btnPrimary} disabled={checking} onClick={onCheck}>Check again</button>
      </div>
    </Card>
  )
}
