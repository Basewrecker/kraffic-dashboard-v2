import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Bell, Check, ChevronRight, Clock, Eye, MessageSquareText, RefreshCw } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import Segmented from '../../components/dashboard/Segmented'
import Select from '../../components/ui/Select'
import SiteLogo from '../../components/ui/SiteLogo'
import { useToast } from '../../components/dashboard/overlays'
import { openDrawer, setParams, useParams } from '../../components/audit/parts'
import DrawerShell, { Dot, useDrawer } from '../../components/audit/DrawerShell'
import { openAnswer } from '../../components/answer/AnswerDrawer'
import ToolPage, { cardTitle, inkBtn, lineBtn, subtitleCls, t2, t3 } from '../../components/tool/ToolPage'
import KpiStrip from '../../components/tool/KpiStrip'
import { navigate } from '../../router'
import { competitorAlertStates, trackedPrompts } from '../../data/mock'

// /more-tools/competitor-alerts — what changed on competitor sites, newest first.
// Production: competitor-alerts module (CompetitorContentChange, CompetitorCandidate); changes there are fixed examples.
// GAP fields used: touchesPromptKeys, lastCheckedAt. No "removed page" type, no suggestions, no watch-list / frequency
// endpoints (so no settings menu). ?mock=none|running|error|full (default full).
const NOW = '2026-10-14T12:00:00Z'
const TYPES = { // CompetitorChangeType → filter label · row phrase
  NEW_PAGE: ['New page', 'published a new page'],
  CONTENT_UPDATE: ['Updated page', 'updated a page'],
  SCHEMA_UPDATE: ['New schema', 'added structured data'],
  PRICING_CHANGE: ['Price change', 'changed a price'],
  FACT_ADDITION: ['New claim', 'added a claim'],
}
const day = (iso) => iso.slice(0, 10)
const dayLabel = (iso) => {
  const d = Math.round((Date.parse(day(NOW)) - Date.parse(day(iso))) / 86400000)
  return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
}
const time = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
const pathOf = (url) => { try { return new URL(url).pathname } catch { return url } }

export default function AlertsPage() {
  useEffect(() => { document.title = 'Competitor Alerts · Toolkit · Kraffic' }, [])
  const q = useParams()
  const key = competitorAlertStates[q.get('mock')] ? q.get('mock') : 'full'
  const st = competitorAlertStates[key]
  const [comp, setComp] = useState('all')
  const [type, setType] = useState('all')
  const [reviewed, setReviewed] = useState(() => new Set(st.changes.filter((c) => c.isAcknowledged).map((c) => c.id)))
  const [toastNode, toast] = useToast({ position: 'center' })
  const byId = useMemo(() => new Map(st.competitors.map((c) => [c.id, c])), [st])
  const changes = st.changes.map((c) => ({ ...c, competitor: byId.get(c.competitorId), reviewed: reviewed.has(c.id) }))
  const week = changes.filter((c) => Date.parse(NOW) - Date.parse(c.detectedAt) < 7 * 86400000)
  const touching = changes.filter((c) => c.touchesPromptKeys.length)
  const touchedPrompts = new Set(touching.flatMap((c) => c.touchesPromptKeys)).size
  const shown = changes.filter((c) => (comp === 'all' || c.competitorId === comp) && (type === 'all' || c.changeType === type))
  const groups = [...new Set(shown.map((c) => day(c.detectedAt)))].map((d) => ({ d, list: shown.filter((c) => day(c.detectedAt) === d) }))
  const state = key === 'error' ? 'error' : key === 'running' ? 'running' : !st.changes.length ? 'not-run' : 'ready'
  const scan = () => setParams({ mock: 'running' })
  const markReviewed = (id) => { setReviewed((s) => new Set(s).add(id)); toast('Marked as reviewed') }
  const typesInData = Object.keys(TYPES).filter((t) => changes.some((c) => c.changeType === t))
  const toFeed = () => document.getElementById('alerts-feed')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <>
      <ToolPage title="Competitor Alerts" subtitle={`Changes on ${st.competitors.map((c) => c.domain).join(', ')}`}
        primary={{ label: 'Check now', icon: RefreshCw, onClick: scan }} state={state}
        empty={{ icon: Bell, title: 'No changes found yet', body: `We haven’t checked your ${st.competitors.length} competitors’ sites yet. The first check takes a few minutes.`, action: { label: 'Check now', icon: RefreshCw, onClick: scan } }}
        running={{ label: `Checking ${st.competitors.length} competitor sites…`, since: st.scanning?.startedAt ?? new Date().toISOString() }}
        error={{ title: 'One site couldn’t be checked', reason: st.error, onRetry: scan, keepBody: true }}>
        <KpiStrip items={[
          { label: 'Changes this week', icon: Bell, value: week.length, meta: `${week.filter((c) => !c.reviewed).length} not reviewed`, link: 'View changes', onOpen: toFeed },
          { label: 'Competitors watched', icon: Eye, value: st.competitors.length, meta: 'Tracked in Brand Setup', link: 'Edit competitors', onOpen: () => navigate('/brands') },
          { label: 'Touch your prompts', icon: MessageSquareText, value: touching.length, unit: 'changes', meta: `${touchedPrompts} tracked prompts affected`, link: 'View those', onOpen: () => { setType('all'); setComp('all'); toFeed() } },
          { label: 'Last checked', icon: Clock, value: st.lastCheckedAt ? time(st.lastCheckedAt) : '—', meta: st.lastCheckedAt ? dayLabel(st.lastCheckedAt) : 'Never', link: 'Check now', onOpen: scan },
        ]} />

        <Card id="alerts-feed" className="scroll-mt-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3 max-md:px-4">
            <div className="min-w-0">
              <h2 className={cardTitle}>Changes</h2>
              <p className={subtitleCls}>Newest first. Click one to see what changed.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="no-scrollbar max-w-full overflow-x-auto">
                <Segmented size="md" label="Competitor" value={comp} onChange={setComp} options={[{ value: 'all', label: 'All' }, ...st.competitors.map((c) => ({
                  value: c.id, label: <span className="flex items-center gap-1.5"><SiteLogo domain={c.domain} name={c.name} className="h-3.5 w-3.5 rounded-[3px] !border-0" imgPad="p-0" initialClass="text-[8px]" />{c.name}</span>,
                }))]} />
              </div>
              <Select label="Change type" size="md" className="w-[148px]" value={type} onChange={setType} options={[['all', 'All changes'], ...typesInData.map((t) => [t, TYPES[t][0]])]} />
            </div>
          </div>
          {groups.length === 0 ? (
            <p className={`border-t border-[var(--div)] px-5 py-10 text-center text-[14px] leading-5 ${t2}`}>No changes match these filters.</p>
          ) : groups.map((g) => (
            <section key={g.d} aria-label={dayLabel(g.d)}>
              <h3 className={`border-t border-[var(--div)] bg-tint px-5 py-2 text-[13px] leading-[18px] ${t3} max-md:px-4`}>{dayLabel(g.d)}</h3>
              <ul className="divide-y divide-[var(--div)]">
                {g.list.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => openDrawer('change', c.id)}
                      className="group grid min-h-14 w-full grid-cols-[20px_minmax(0,1fr)_16px] items-center gap-x-3 px-5 py-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus max-md:px-4 md:grid-cols-[20px_minmax(0,1.2fr)_minmax(0,1fr)_128px_72px_16px]">
                      <SiteLogo domain={c.competitor.domain} name={c.competitor.name} className="h-5 w-5 rounded !border-0" imgPad="p-0" initialClass="text-[10px]" />
                      <span className="min-w-0">
                        <span className={`block truncate text-[14px] leading-5 font-medium ${c.reviewed ? t2 : 'text-stone-900'}`}>{c.competitor.name} {TYPES[c.changeType][1]}</span>
                        <span className={`block truncate text-[13px] leading-[18px] ${t3} md:hidden`}>{pathOf(c.url)} · {c.touchesPromptKeys.length ? `Touches ${c.touchesPromptKeys.length} prompts` : 'No tracked prompts'} · {time(c.detectedAt)}</span>
                      </span>
                      <span className={`hidden truncate text-[13px] leading-[18px] ${t3} md:block`} title={c.url}>{pathOf(c.url)}</span>
                      <span className={`hidden text-[13px] leading-[18px] md:block ${c.touchesPromptKeys.length ? t2 : t3}`}>{c.touchesPromptKeys.length ? `Touches ${c.touchesPromptKeys.length} prompts` : '—'}</span>
                      <span className={`hidden text-right text-[13px] leading-[18px] ${t3} tabular-nums md:block`}>{time(c.detectedAt)}</span>
                      <ChevronRight size={14} className="text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </Card>
      </ToolPage>
      <ChangeDrawer changes={changes} onReviewed={markReviewed} />
      {toastNode}
    </>
  )
}

// ---- one change: the diff, the prompts it touches, and Mark reviewed (production: POST changes/:id/acknowledge)
function ChangeDrawer({ changes, onReviewed }) {
  const map = useMemo(() => new Map(changes.map((c) => [c.id, c])), [changes])
  const drawer = useDrawer('change', (id) => map.get(id) ?? null)
  const c = drawer.item
  if (!c) return null
  const lines = c.diffSnippet.split('\n')
  const prompts = c.touchesPromptKeys.map((k) => ({ key: k, text: trackedPrompts.find((p) => p.id === k)?.prompt ?? k }))
  return (
    <DrawerShell drawer={drawer} title={c.title}
      meta={<span className="flex flex-wrap items-center gap-2"><SiteLogo domain={c.competitor.domain} name={c.competitor.name} className="h-4 w-4 rounded-[3px] !border-0" imgPad="p-0" initialClass="text-[8px]" />{c.competitor.name}<Dot />{TYPES[c.changeType][0]}<Dot />{dayLabel(c.detectedAt)}, {time(c.detectedAt)}</span>}
      footer={(
        <>
          <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded font-medium text-stone-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Open page <ArrowUpRight size={14} aria-hidden /><span className="sr-only">(opens in a new tab)</span></a>
          {c.reviewed ? <span className={`inline-flex items-center gap-1.5 ${t2}`}><Check size={14} className="text-ink" aria-hidden />Reviewed</span>
            : <button type="button" onClick={() => onReviewed(c.id)} className={inkBtn}><Check size={14} aria-hidden />Mark reviewed</button>}
        </>
      )}>
      <section className="mt-5">
        <h3 className="text-[14px] leading-5 font-semibold text-stone-900">What changed</h3>
        <p className={`mt-1 text-[14px] leading-5 ${t2}`}>{c.summary}</p>
        <p className={`mt-1 truncate text-[13px] leading-[18px] ${t3}`} title={c.url}>{pathOf(c.url)}</p>
        <div className="mt-3 overflow-hidden rounded-lg border border-line font-mono text-[13px] leading-5">
          {lines.map((l, i) => {
            const add = l.startsWith('+'), del = l.startsWith('-')
            return (
              <div key={i} className={`flex gap-2 px-3 py-1 ${add ? 'bg-tint text-stone-900' : del ? `${t3} line-through decoration-stone-400` : t2}`}>
                <span className="w-3 shrink-0 select-none text-stone-500" aria-hidden>{add ? '+' : del ? '−' : ' '}</span>
                <span className="sr-only">{add ? 'Added: ' : del ? 'Removed: ' : ''}</span>
                <span className="min-w-0 whitespace-pre-wrap break-words">{l.replace(/^[+-]\s?/, '')}</span>
              </div>
            )
          })}
        </div>
      </section>
      <section className="mt-6">
        <h3 className="text-[14px] leading-5 font-semibold text-stone-900">Prompts this touches</h3>
        {prompts.length ? (
          <ul className="mt-1 divide-y divide-[var(--div)] border-y border-[var(--div)]">
            {prompts.map((p) => (
              <li key={p.key}>
                <button type="button" onClick={(e) => openAnswer({ key: p.key, list: prompts.map((x) => x.key), opener: e.currentTarget })}
                  className="group -mx-2 flex h-11 w-[calc(100%+16px)] items-center gap-3 rounded-md px-2 text-left outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                  <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-stone-900">{p.text}</span>
                  <span className={`shrink-0 text-[13px] ${t2}`}>View answer</span>
                  <ChevronRight size={14} className="text-stone-500" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className={`mt-1 text-[14px] leading-5 ${t3}`}>None of your tracked prompts are about this page.</p>}
      </section>
    </DrawerShell>
  )
}
