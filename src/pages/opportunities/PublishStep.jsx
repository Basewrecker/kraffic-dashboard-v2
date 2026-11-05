// Step 5: Publish and track. Waiting for the page (pulsing dot, checked daily) → Check now (≤600ms) → published
// (tick, date, match ring) → 4 weekly syncs → the result. ?co=not-found: not found after 14 days (reminder);
// ?co=missed-sync: sync 2 failed (a gap). Pieces in ./publish/.
import { useEffect, useRef, useState } from 'react'
import { publishCheck, trackingFor } from '../../data/contentOpportunities-proposed'
import { initialPhase, syncsAfter } from './publish/model'
import TrackingCard from './publish/TrackingCard'
import { NotFoundCard, WaitingCard } from './publish/WaitingCard'

const CHECK_MS = 550

// onApi({ phase, checking, check }): for the payoff bar ("I've published it →" runs the same check as Check now)
export default function PublishStep({ row, draft, onEditDraft, onApi = () => {} }) {
  const check = publishCheck()
  const url = draft?.target_url ?? check.target_url ?? ''
  const [phase, setPhase] = useState(() => initialPhase(draft, check))
  const [checking, setChecking] = useState(false)
  const [live, setLive] = useState(null) // { published_at, match } once Check now finds the page
  const timer = useRef(null)

  // a different draft (or the user copied a new one in step 4): start over
  useEffect(() => {
    clearTimeout(timer.current)
    setPhase(initialPhase(draft, publishCheck()))
    setChecking(false)
    setLive(null)
  }, [draft?.stage, draft?.target_url, row?.prompt]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), [])

  const runCheck = () => {
    setChecking(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const res = publishCheck()
      setChecking(false)
      if (res.status === 'published') { setLive({ published_at: res.published_at, match: res.match }); setPhase('tracking') }
      else setPhase('notfound')
    }, CHECK_MS)
  }

  const latest = useRef(runCheck)
  latest.current = runCheck
  useEffect(() => { onApi({ phase, checking, check: () => latest.current() }) }, [phase, checking]) // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'waiting') return <WaitingCard url={url} checkedAt={draft?.published_checked_at} checking={checking} onCheck={runCheck} />
  if (phase === 'notfound') return <NotFoundCard url={url} days={check.checked_days ?? 14} checking={checking} onCheck={runCheck} onEditDraft={onEditDraft} />
  if (live) {
    return <TrackingCard fresh url={url} publishedAt={live.published_at} match={live.match} syncs={syncsAfter(live.published_at)} gained={[]} onEditDraft={onEditDraft} />
  }
  return (
    <TrackingCard url={url} publishedAt={draft?.published_at} match={draft?.match ?? (check.status === 'published' ? check.match : null)}
      syncs={trackingFor(draft)} gained={draft?.gained ?? []} onEditDraft={onEditDraft} />
  )
}
