import { useEffect } from 'react'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { PrimaryButton } from '../dashboard/overlays'
import { navigate } from '../../router'
import { firstSetupActions, firstSetupScanMinutes } from '../../data/mock'
import { stepCard, t2, t3 } from './ui'

const POLL_MS = 10000
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

// Step 4 — the first scan, read-only: saving the prompts started it, so this step starts nothing. It shows the scan's
// real progress (prompts with their first results, polled), opens the dashboard once every prompt has its Google and
// ChatGPT results, and says when the other engines come in. No scan running: it says so, with nothing to click.
//   scan: { status: 'idle' (not checked yet) | 'running' | 'done' | 'none', scanned, total }
export default function ScanStep({ scan, update }) {
  const done = scan.status === 'done'
  // poll until the first results are in
  useEffect(() => {
    if (done) return
    let live = true
    let timer = null
    const poll = () => firstSetupActions.onScanProgress().then((p) => {
      if (!live) return
      update({ scan: p })
      if (p.status !== 'done') timer = setTimeout(poll, POLL_MS)
    }, () => { if (live) timer = setTimeout(poll, POLL_MS) })
    poll()
    return () => { live = false; clearTimeout(timer) }
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  const later = <span className={`block text-[13px] leading-[18px] ${t3}`}>Gemini and Claude results arrive with the next full sync.</span>
  return (
    <section aria-label="First scan" aria-live="polite" className={`${stepCard} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 max-md:px-4`}>
      {(scan.status === 'running' || scan.status === 'idle') && (
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <Loader2 size={16} className="shrink-0 animate-spin text-ink motion-reduce:animate-none" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] leading-5 text-stone-900 tabular-nums">
              {scan.status === 'idle' ? 'Checking the scan…' : `Scanning · ${scan.scanned ?? 0} of ${plural(scan.total ?? 0, 'prompt')} scanned`}
            </span>
            <span className={`block text-[13px] leading-[18px] ${t2}`}>Google and ChatGPT first, usually within {firstSetupScanMinutes} min. You can leave this page.</span>
            {later}
          </span>
        </span>
      )}
      {scan.status === 'none' && (
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] leading-5 text-stone-900">No scan is running for these prompts yet.</span>
          <span className={`block text-[13px] leading-[18px] ${t3}`}>It starts when prompts are saved, and the daily sync picks up the rest.</span>
        </span>
      )}
      {done && (
        <>
          <span className="flex min-w-0 flex-1 basis-[240px] items-center gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-tint text-ink" aria-hidden><Check size={14} strokeWidth={2.5} /></span>
            <span className="min-w-0">
              <span className="block text-[14px] leading-5 font-medium text-stone-900">Your dashboard is ready</span>
              {later}
            </span>
          </span>
          <PrimaryButton size="sm" onClick={() => navigate('/overview')}>Open dashboard <ArrowRight size={14} aria-hidden /></PrimaryButton>
        </>
      )}
    </section>
  )
}
