import { useEffect, useState } from 'react'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { PrimaryButton } from '../dashboard/overlays'
import { navigate } from '../../router'
import { useTracking } from '../../store/trackingSettings'
import { firstSetupActions, firstSetupScanMinutes } from '../../data/mock'
import { stepCard, t2, t3 } from './ui'

// "AI Overview, Gemini, ChatGPT and Claude"
const list = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
// "2:14": time since the scan started
const elapsed = (from, now) => { const s = Math.max(0, Math.floor((now - new Date(from)) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

// Step 4 — the first scan: before (what it checks, Start first scan) · running (how long it usually takes, the time so
// far) · done (Open dashboard). The engines are the ones switched on in Tracking.
export default function ScanStep({ prompts, scan, update }) {
  const engines = useTracking().platforms.filter((p) => p.enabled).map((p) => p.name)
  const [now, setNow] = useState(() => Date.now())
  const [failed, setFailed] = useState(false)
  const running = scan.status === 'running'
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running])
  // the mock's scan finishes by itself after a while
  useEffect(() => {
    if (!running) return
    let live = true
    firstSetupActions.onScanDone().then(() => { if (live) update({ scan: { status: 'done' } }) })
    return () => { live = false }
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    setFailed(false)
    update({ scan: { status: 'running', startedAt: new Date().toISOString() } })
    firstSetupActions.onStartScan().catch(() => { update({ scan: { status: 'idle' } }); setFailed(true) })
  }

  return (
    <section aria-label="First scan" aria-live="polite" className={`${stepCard} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 max-md:px-4`}>
      {scan.status === 'idle' && (
        <>
          <span className="min-w-0 flex-1 basis-[280px]">
            <span className="block text-[14px] leading-5 text-stone-900">Kraffic will check your {prompts} {prompts === 1 ? 'prompt' : 'prompts'} across {list(engines)}.</span>
            {failed
              ? <span role="alert" className="block text-[13px] leading-[18px] text-negative">The scan didn’t start. Try again.</span>
              : <span className={`block text-[13px] leading-[18px] ${t3}`}>Usually takes about {firstSetupScanMinutes} min.</span>}
          </span>
          <PrimaryButton size="sm" onClick={start}>Start first scan</PrimaryButton>
        </>
      )}
      {running && (
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <Loader2 size={16} className="shrink-0 animate-spin text-ink motion-reduce:animate-none" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] leading-5 text-stone-900">Scanning · usually {firstSetupScanMinutes} min</span>
            <span className={`block text-[13px] leading-[18px] ${t2} tabular-nums`}>{elapsed(scan.startedAt, now)} elapsed</span>
          </span>
        </span>
      )}
      {scan.status === 'done' && (
        <>
          <span className="flex min-w-0 flex-1 basis-[240px] items-center gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-tint text-ink" aria-hidden><Check size={14} strokeWidth={2.5} /></span>
            <span className="text-[14px] leading-5 font-medium text-stone-900">Your dashboard is ready</span>
          </span>
          <PrimaryButton size="sm" onClick={() => navigate('/overview')}>Open dashboard <ArrowRight size={14} aria-hidden /></PrimaryButton>
        </>
      )}
    </section>
  )
}
