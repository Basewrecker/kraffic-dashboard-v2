import { useEffect, useMemo } from 'react'
import { ArrowUpRight, Calendar, ChevronRight, FileSearch, FileText, MessageSquareText, PenLine, RefreshCw } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import SiteLogo from '../../components/ui/SiteLogo'
import Insight, { hl, useExplain } from '../../components/ui/Insight'
import { useToast } from '../../components/dashboard/overlays'
import { openDrawer, setParams, useParams } from '../../components/audit/parts'
import DrawerShell, { Dot, useDrawer } from '../../components/audit/DrawerShell'
import { openAnswer } from '../../components/answer/AnswerDrawer'
import ToolPage, { cardTitle, lineBtn, subtitleCls, t2, t3 } from '../../components/tool/ToolPage'
import KpiStrip from '../../components/tool/KpiStrip'
import { contentStates, trackedPrompts } from '../../data/mock'

// /more-tools/content — topics the site doesn't cover yet, and pages that should win a prompt but don't.
// Production: content module (GET content/gaps → ContentGapDto, GET content/decay → ContentDecayAuditDto); "Write draft"
// is Content Drafts (POST content-studio/assets/generate-draft). GAP: lastRunAt, competitor page URLs (domains only),
// suggested outline (none, so the drawer has no outline), per-page target prompt and numbered suggestions.
// ?mock=none|running|error|full (default full).
const FORMAT = { CREATE: 'Guide', UPDATE: 'Page update', EXPAND: 'Longer page', COMPARISON: 'Comparison', CASE_STUDY: 'Case study', FAQ: 'FAQ', STRUCTURED_EVIDENCE: 'Proof section', REFRESH: 'Refresh', MERGE: 'Merge pages' }
const promptText = (id) => trackedPrompts.find((p) => p.id === id)?.prompt ?? id
const pathOf = (url) => { try { return new URL(url).pathname } catch { return url } }
const fmt = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const head = `hidden h-9 items-center gap-3 border-y border-[var(--div)] bg-tint px-5 text-[13px] leading-[18px] font-medium ${t3} md:grid`
const row = 'group grid min-h-14 w-full cursor-pointer items-center gap-x-3 px-5 py-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus max-md:px-4'

export default function ContentPage() {
  useEffect(() => { document.title = 'Content Intelligence · Toolkit · Kraffic' }, [])
  const q = useParams()
  const key = contentStates[q.get('mock')] ? q.get('mock') : 'full'
  const st = contentStates[key]
  const [toastNode, toast] = useToast({ position: 'center' })
  const gaps = useMemo(() => [...st.gaps].sort((a, b) => b.promptIds.length - a.promptIds.length), [st])
  const prompts = new Set([...gaps.flatMap((g) => g.promptIds), ...st.pages.map((p) => p.targetPromptId)]).size
  const state = key === 'error' ? 'error' : key === 'running' ? 'running' : !st.gaps.length ? 'not-run' : 'ready'
  const run = () => setParams({ mock: 'running' })
  const to = (id) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const draft = (g) => toast(`Writing a draft for “${g.clusterName}”. It’ll be in Content Drafts in about a minute.`)

  return (
    <>
      <ToolPage title="Content Intelligence" subtitle="Topics your site doesn’t cover yet, and pages that should win a prompt but don’t"
        primary={{ label: 'Run again', icon: RefreshCw, onClick: run }} state={state}
        empty={{ icon: FileSearch, title: 'No content check yet', body: 'We’ll compare your pages with the prompts you track and the competitors AI cites, and list what’s missing. It takes a few minutes.', action: { label: 'Run check', icon: RefreshCw, onClick: run } }}
        running={{ label: 'Comparing your pages with 152 prompts…', since: st.diagnosing?.startedAt ?? new Date().toISOString() }}
        error={{ title: 'The check didn’t finish', reason: st.error, onRetry: run, keepBody: true }}>
        <KpiStrip items={[
          { label: 'Topics not covered', icon: FileSearch, value: gaps.length, meta: `${gaps.filter((g) => g.severity === 'HIGH').length} high priority`, link: 'View topics', onOpen: to('content-gaps') },
          { label: 'Pages to improve', icon: FileText, value: st.pages.length, meta: 'Should win a prompt', link: 'View pages', onOpen: to('content-pages') },
          { label: 'Prompts affected', icon: MessageSquareText, value: prompts, meta: 'Of 152 tracked', link: 'View topics', onOpen: to('content-gaps') },
          { label: 'Last run', icon: Calendar, value: fmt(st.lastRunAt), meta: 'Runs after each sync', link: 'Run again', onOpen: run },
        ]} />
        <GapsCard gaps={gaps} onDraft={draft} />
        <PagesCard pages={st.pages} />
      </ToolPage>
      <GapDrawer gaps={gaps} onDraft={draft} />
      <PageDrawer pages={st.pages} />
      {toastNode}
    </>
  )
}

function Logos({ domains }) {
  const more = domains.length - 3
  return (
    <span className="flex items-center gap-1">
      {domains.slice(0, 3).map((d) => <SiteLogo key={d} domain={d} name={d} className="h-5 w-5 rounded !border-0" imgPad="p-0" initialClass="text-[10px]" />)}
      {more > 0 && <span className={`text-[13px] leading-[18px] ${t3} tabular-nums`}>+{more}</span>}
    </span>
  )
}

// ---- Content gaps: Topic · Prompts affected · Competitors covering it · Suggested page · Write draft
const GAP_COLS = 'md:grid-cols-[minmax(0,1fr)_120px_120px_120px_108px_16px]'
function GapsCard({ gaps, onDraft }) {
  const explain = useExplain('content-gaps')
  const top = gaps[0]
  return (
    <Card id="content-gaps" ref={explain.cardRef} className="scroll-mt-6 overflow-hidden">
      <div className="px-5 pt-5 pb-3 max-md:px-4">
        <h2 className={cardTitle}>Content gaps</h2>
        <p className={subtitleCls}>Topics people ask AI about that no page on your site answers well. Most prompts first.</p>
      </div>
      <div className={`${head} ${GAP_COLS}`}><span>Topic</span><span>Prompts affected</span><span>Competitors</span><span>Suggested page</span><span /><span /></div>
      <ul className="divide-y divide-[var(--div)] max-md:border-t max-md:border-[var(--div)]">
        {gaps.map((g) => (
          <li key={g.id} {...hl(explain, g === top ? 'top' : g.id, { row: true })}>
            <div role="button" tabIndex={0} onClick={() => openDrawer('gap', g.id)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) openDrawer('gap', g.id) }}
              aria-label={`${g.clusterName}: ${g.promptIds.length} prompts. Open details`} className={`${row} grid-cols-[minmax(0,1fr)_16px] ${GAP_COLS}`}>
              <span className="min-w-0">
                <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{g.clusterName}</span>
                <span className={`block truncate text-[13px] leading-[18px] ${t3} md:hidden`}>{g.promptIds.length} prompts · {FORMAT[g.recommendedAction]} · {g.competitorEvidence.observedCompetitors.length === 1 ? '1 competitor covers it' : `${g.competitorEvidence.observedCompetitors.length} competitors cover it`}</span>
              </span>
              <span className="hidden text-[14px] leading-5 text-stone-900 tabular-nums md:block">{g.promptIds.length}</span>
              <span className="hidden md:block"><Logos domains={g.competitorEvidence.observedCompetitors} /></span>
              <span className={`hidden text-[13px] leading-[18px] ${t2} md:block`}>{FORMAT[g.recommendedAction]}</span>
              <span className="hidden md:block">
                <button type="button" onClick={(e) => { e.stopPropagation(); onDraft(g) }} className={`${lineBtn} h-8 px-2.5`}><PenLine size={14} aria-hidden />Write draft</button>
              </span>
              <ChevronRight size={14} className="text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--div)] px-5 pb-3 max-md:px-4">
        <Insight explain={explain} text={`“${top.clusterName}” affects the most prompts: ${top.promptIds.length}, and ${top.competitorEvidence.observedCompetitors.length} competitors already cover it.`}
          evidence={{ keys: ['top'], calc: 'Tracked prompts on this topic where AI cites a competitor page and none of yours. Highlighted: the topic with the most.' }} />
      </div>
    </Card>
  )
}

// ---- Pages to improve: Page · Prompt it should win · What's missing
const PAGE_COLS = 'md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.1fr)_16px]'
function PagesCard({ pages }) {
  const explain = useExplain('content-pages')
  const stale = pages.filter((p) => p.daysSinceLastUpdate > 180)
  return (
    <Card id="content-pages" ref={explain.cardRef} className="scroll-mt-6 overflow-hidden">
      <div className="px-5 pt-5 pb-3 max-md:px-4">
        <h2 className={cardTitle}>Pages to improve</h2>
        <p className={subtitleCls}>Pages that match a prompt but aren’t the answer AI picks. Open one for what to change.</p>
      </div>
      <div className={`${head} ${PAGE_COLS}`}><span>Page</span><span>Prompt it should win</span><span>What’s missing</span><span /></div>
      <ul className="divide-y divide-[var(--div)] max-md:border-t max-md:border-[var(--div)]">
        {pages.map((p) => (
          <li key={p.id} {...hl(explain, p.daysSinceLastUpdate > 180 ? 'stale' : p.id, { row: true })}>
            <button type="button" onClick={() => openDrawer('page', p.id)} className={`${row} grid-cols-[minmax(0,1fr)_16px] ${PAGE_COLS}`}>
              <span className="min-w-0">
                <span className="block truncate text-[14px] leading-5 font-medium text-stone-900" title={p.pageUrl}>{pathOf(p.pageUrl)}</span>
                <span className={`block truncate text-[13px] leading-[18px] ${t3} md:hidden`}>{p.recommendation}</span>
              </span>
              <span className={`hidden truncate text-[13px] leading-[18px] ${t2} md:block`}>{promptText(p.targetPromptId)}</span>
              <span className={`hidden truncate text-[13px] leading-[18px] ${t2} md:block`}>{p.recommendation}</span>
              <ChevronRight size={14} className="text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--div)] px-5 pb-3 max-md:px-4">
        <Insight explain={explain} text={`${stale.length} of ${pages.length} pages haven’t been updated in over 6 months. AI favours pages with a recent date.`}
          evidence={{ keys: ['stale'], calc: 'Days since each page last changed, from the latest crawl. Highlighted: over 180 days.' }} />
      </div>
    </Card>
  )
}

const H3 = ({ children }) => <h3 className="text-[14px] leading-5 font-semibold text-stone-900">{children}</h3>
function PromptList({ ids }) {
  return (
    <ul className="mt-1 divide-y divide-[var(--div)] border-y border-[var(--div)]">
      {ids.map((id) => (
        <li key={id}>
          <button type="button" onClick={(e) => openAnswer({ key: id, list: ids, opener: e.currentTarget })}
            className="group -mx-2 flex h-11 w-[calc(100%+16px)] items-center gap-3 rounded-md px-2 text-left outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
            <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-stone-900">{promptText(id)}</span>
            <span className={`shrink-0 text-[13px] ${t2}`}>View answer</span>
            <ChevronRight size={14} className="text-stone-500" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}

function GapDrawer({ gaps, onDraft }) {
  const map = useMemo(() => new Map(gaps.map((g) => [g.id, g])), [gaps])
  const drawer = useDrawer('gap', (id) => map.get(id) ?? null)
  const g = drawer.item
  if (!g) return null
  return (
    <DrawerShell drawer={drawer} title={g.clusterName}
      meta={<span className="flex flex-wrap items-center gap-2">{g.promptIds.length} prompts<Dot />Suggested: {FORMAT[g.recommendedAction]}</span>}
      footer={<><span /><button type="button" onClick={() => onDraft(g)} className={lineBtn}><PenLine size={14} aria-hidden />Write draft</button></>}>
      <section className="mt-5">
        <H3>What’s missing</H3>
        <p className={`mt-1 text-[14px] leading-5 ${t2}`}>{g.description}</p>
      </section>
      <section className="mt-6">
        <H3>Prompts it affects</H3>
        <PromptList ids={g.promptIds} />
      </section>
      <section className="mt-6">
        <H3>Competitors that cover it</H3>
        <ul className="mt-1 divide-y divide-[var(--div)] border-y border-[var(--div)]">
          {g.competitorEvidence.observedCompetitors.map((d) => (
            <li key={d}>
              <a href={`https://${d}`} target="_blank" rel="noreferrer" className="group -mx-2 flex h-11 items-center gap-3 rounded-md px-2 outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                <SiteLogo domain={d} name={d} className="h-5 w-5 rounded !border-0" imgPad="p-0" initialClass="text-[10px]" />
                <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-stone-900">{d}</span>
                <ArrowUpRight size={14} className="text-stone-500" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </DrawerShell>
  )
}

function PageDrawer({ pages }) {
  const map = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages])
  const drawer = useDrawer('page', (id) => map.get(id) ?? null)
  const p = drawer.item
  if (!p) return null
  return (
    <DrawerShell drawer={drawer} title={pathOf(p.pageUrl)}
      meta={<span className="flex flex-wrap items-center gap-2">Updated {p.daysSinceLastUpdate} days ago<Dot />{p.recommendation}</span>}
      footer={(
        <>
          <a href={p.pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded font-medium text-stone-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Open page <ArrowUpRight size={14} aria-hidden /><span className="sr-only">(opens in a new tab)</span></a>
          <span />
        </>
      )}>
      <section className="mt-5">
        <H3>Prompt it should win</H3>
        <PromptList ids={[p.targetPromptId]} />
      </section>
      <section className="mt-6">
        <H3>What to change</H3>
        <ol className="mt-2 flex flex-col gap-3">
          {p.suggestions.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-ink text-[12px] font-semibold text-ink tabular-nums" aria-hidden>{i + 1}</span>
              <span className="pt-0.5 text-[14px] leading-5 text-stone-900">{s}</span>
            </li>
          ))}
        </ol>
      </section>
    </DrawerShell>
  )
}
