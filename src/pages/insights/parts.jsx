import { useEffect } from 'react'
import { PlatformIcon } from '../../components/dashboard/icons'
import { EmptyState, t2, t3 } from '../../components/tool/ToolPage'
import { useParams } from '../../components/audit/parts'
import { navigate } from '../../router'
import { ENGINES, insightsLastSync } from '../../data/insights'

// Shared by /citations, /sentiment and /fact-check (hidden from the sidebar; reachable by URL).
export { cardTitle, subtitleCls, t2, t3, inkBtn, lineBtn } from '../../components/tool/ToolPage'
export const head = `hidden h-9 items-center gap-3 border-y border-[var(--div)] bg-tint px-5 text-[13px] leading-[18px] font-medium ${t3} md:grid`
export const rowCls = 'group grid min-h-14 w-full items-center gap-x-3 px-5 py-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus max-md:px-4'
export const fmtDay = (d) => new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
export const pct = (n, of) => (of ? Math.round((n * 100) / of) : 0)
export const scrollTo = (id) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

// ?mock=full|small|empty|none (default full)
export function useInsightState(states, title) {
  useEffect(() => { document.title = `${title} · Kraffic` }, [title])
  const k = useParams().get('mock')
  const key = ['full', 'small', 'empty', 'none'].includes(k) ? k : 'full'
  return { key, st: states[key] ?? null }
}

export function EngineMark({ id, size = 16 }) {
  return <span title={ENGINES[id]} className="flex shrink-0"><PlatformIcon id={id} size={size} /><span className="sr-only">{ENGINES[id]}</span></span>
}
export const EngineMarks = ({ ids, size = 14 }) => <span className="flex items-center gap-1.5">{ids.map((e) => <EngineMark key={e} id={e} size={size} />)}</span>

export function PageHead({ title, subtitle, syncs }) {
  return (
    <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">{title}</h1>
        <p className={`mt-1 text-[13px] leading-[18px] ${t2} lg:text-[14px] lg:leading-5`}>{subtitle}</p>
      </div>
      {syncs != null && (
        <p className={`flex shrink-0 items-center gap-1.5 text-[13px] leading-[18px] ${t2}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden />Updated {fmtDay(insightsLastSync)} · {syncs} {syncs === 1 ? 'sync' : 'syncs'}
        </p>
      )}
    </div>
  )
}

// empty project (no prompts) / no data for this page yet
export function NoData({ kind, icon, title, body, action }) {
  if (kind === 'empty') {
    return <EmptyState icon={icon} title="Add prompts to see this" body="This page reads the AI answers to the prompts you track. Add the questions your customers ask; the first sync runs within a day."
      action={{ label: 'Add prompts', onClick: () => navigate('/tracker') }} />
  }
  return <EmptyState icon={icon} title={title} body={body} action={action} />
}

// an AI quote with the part that matters marked (negative = wrong / negative)
export function Quote({ text, mark, tone = 'negative' }) {
  const i = mark ? text.indexOf(mark) : -1
  if (i < 0) return <>“{text}”</>
  return <>“{text.slice(0, i)}<mark className={`rounded-sm bg-transparent font-medium ${tone === 'negative' ? 'text-negative underline decoration-[color-mix(in_srgb,var(--negative)_40%,transparent)] underline-offset-2' : 'text-stone-900'}`}>{mark}</mark>{text.slice(i + mark.length)}”</>
}
