import { useMemo, useState } from 'react'
import { ArrowUpRight, ChevronRight, FileText, Globe, Link2, PieChart, Quote as QuoteIcon } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import SiteLogo from '../../components/ui/SiteLogo'
import Insight, { hl, useExplain } from '../../components/ui/Insight'
import KpiStrip from '../../components/tool/KpiStrip'
import { openDrawer } from '../../components/audit/parts'
import DrawerShell, { Dot, useDrawer } from '../../components/audit/DrawerShell'
import { openAnswer } from '../../components/answer/AnswerDrawer'
import { ENGINES, citationsStates } from '../../data/insights'
import { account, trackedPrompts } from '../../data/mock'
import { EngineMark, EngineMarks, NoData, PageHead, cardTitle, head, pct, rowCls, scrollTo, subtitleCls, t2, t3, useInsightState } from './parts'

// /citations — "Which sources do AI engines cite, and are you one of them?" (hidden from the sidebar)
// Production: GET citations/insights + citations/sources (see data/insights.js). GAP: per-engine × who split is added
// up client-side; "Sources you could win" exists only in the agency's older advanced view; engines and prompts per page.
const WHO = [['you', 'You', 'var(--ink)'], ['competitors', 'Competitors', 'var(--data-c1)'], ['other', 'Other sites', 'var(--data-c3)']]
const promptText = (id) => trackedPrompts.find((p) => p.id === id)?.prompt ?? id
const Logo = ({ domain, size = 'h-5 w-5' }) => <SiteLogo domain={domain} name={domain} className={`${size} rounded !border-0`} imgPad="p-0" initialClass="text-[10px]" />

export default function CitationsPage() {
  const { key, st } = useInsightState(citationsStates, 'Citations')
  const head1 = <PageHead title="Citations" subtitle="Which sources AI engines cite, and whether you’re one of them" syncs={st?.syncs} />
  if (!st) {
    return <>{head1}<NoData kind={key} icon={QuoteIcon} title="No sources cited yet"
      body="Your prompts are tracked, but none of the AI answers so far listed a source. Most engines start citing once a prompt has a few syncs; the next one runs Oct 12." /></>
  }
  const share = pct(st.you.citations, st.totals.citations)
  const delta = st.you.previous == null ? null : st.you.citations - st.you.previous
  return (
    <>
      {head1}
      <KpiStrip items={[
        { label: 'Citations to your site', icon: QuoteIcon, value: st.you.citations, meta: delta == null ? 'First sync' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} vs last sync`, link: 'View by engine', onOpen: scrollTo('cite-engines') },
        { label: 'Your share of citations', icon: PieChart, value: `${share}%`, meta: `Of ${st.totals.citations} citations`, link: 'View sources', onOpen: scrollTo('cite-top') },
        { label: 'Sources cited', icon: Globe, value: st.totals.websites, meta: 'Different websites', link: 'View ones to win', onOpen: scrollTo('cite-win') },
        { label: 'Your pages cited', icon: FileText, value: st.pages.length, meta: `In ${st.totals.answersChecked} answers checked`, link: 'View pages', onOpen: scrollTo('cite-pages') },
      ]} />
      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><EnginesCard rows={st.byEngine} /></div>
        <TopSources rows={st.top} />
      </div>
      <Winnable rows={st.winnable} />
      <Pages pages={st.pages} />
      <PageDrawer pages={st.pages} />
    </>
  )
}

// ---- Who gets cited, by engine: a 100% split bar per engine
function EnginesCard({ rows }) {
  const explain = useExplain('cite-engines')
  const [tip, setTip] = useState(null) // { engine, who }
  const withYou = rows.map((r) => ({ ...r, total: r.you + r.competitors + r.other })).map((r) => ({ ...r, share: pct(r.you, r.total) }))
  const best = [...withYou].sort((a, b) => b.share - a.share)[0]
  const none = withYou.filter((r) => r.you === 0)
  return (
    <Card id="cite-engines" ref={explain.cardRef} className="flex h-full scroll-mt-6 flex-col px-5 pt-5 pb-3 max-md:px-4">
      <h2 className={cardTitle}>Who gets cited, by engine</h2>
      <p className={subtitleCls}>Every source each engine listed, split by whose site it is. Hover a part for the count.</p>
      <div className={`mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] leading-[18px] ${t2}`}>
        {WHO.map(([k, l, c]) => <span key={k} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: c }} aria-hidden />{l}</span>)}
      </div>
      <ul className="mt-2 flex flex-1 flex-col">
        {withYou.map((r) => (
          <li key={r.engine} {...hl(explain, r === best ? 'best' : r.engine, { row: true })} className="flex flex-1 flex-col justify-center gap-2 border-b border-[var(--div)] py-3 last:border-0">
            <div className="flex items-center gap-2">
              <EngineMark id={r.engine} />
              <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-stone-900">{ENGINES[r.engine]}</span>
              <span className={`text-[13px] leading-[18px] tabular-nums ${r.you ? 'font-medium text-stone-900' : t3}`}>You {r.share}%</span>
            </div>
            <div className="relative flex h-2 gap-px overflow-visible rounded-full bg-tint">
              {WHO.map(([k, l, c], i) => r[k] > 0 && (
                <span key={k} onMouseEnter={() => setTip({ engine: r.engine, who: k })} onMouseLeave={() => setTip(null)}
                  className={`relative h-full ${i === 0 ? 'rounded-l-full' : ''} ${i === 2 ? 'rounded-r-full' : ''}`} style={{ width: `${(r[k] / r.total) * 100}%`, background: c }}
                  aria-label={`${l}: ${r[k]} of ${r.total}`} role="img">
                  {tip?.engine === r.engine && tip.who === k && (
                    <span role="tooltip" className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 text-stone-900 shadow-md tabular-nums">
                      {l}: {r[k]} of {r.total} citations
                    </span>
                  )}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <Insight explain={explain} text={`${ENGINES[best.engine]} cites you most (${best.share}% of its sources)${none.length ? `; ${none.map((r) => ENGINES[r.engine]).join(' and ')} never ${none.length === 1 ? 'does' : 'do'}` : ''}.`}
        evidence={{ keys: ['best'], calc: 'Your citations ÷ every citation that engine listed, latest sync. Highlighted: the engine with the highest share.' }} />
    </Card>
  )
}

// ---- Most cited sources: 8 rows
function TopSources({ rows }) {
  const explain = useExplain('cite-top')
  const you = rows.findIndex((r) => r.type === 'You')
  return (
    <Card id="cite-top" ref={explain.cardRef} className="flex h-full scroll-mt-6 flex-col px-5 pt-5 pb-3 max-md:px-4">
      <h2 className={cardTitle}>Most cited sources</h2>
      <p className={subtitleCls}>The websites AI engines list most often.</p>
      <ul className="mt-3 flex-1 divide-y divide-[var(--div)]">
        {rows.map((r) => (
          <li key={r.domain} {...hl(explain, r.type === 'You' ? 'you' : r.domain, { row: true })} className="grid h-10 grid-cols-[20px_minmax(0,1fr)_auto_36px] items-center gap-3">
            <Logo domain={r.domain} />
            <span className={`truncate text-[14px] leading-5 ${r.type === 'You' ? 'font-medium text-stone-900' : 'text-stone-900'}`}>{r.domain}</span>
            <span className={`text-[13px] leading-[18px] ${t3}`}>{r.type}</span>
            <span className="text-right text-[14px] leading-5 text-stone-900 tabular-nums">{r.citations}</span>
          </li>
        ))}
      </ul>
      <Insight explain={explain} text={you >= 0 ? `You’re the ${['', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'][you] || '1st'} most cited source${you === 0 ? '' : `, behind ${rows.slice(0, you).map((r) => r.domain).join(' and ')}`}.` : 'You’re not in the top 8 sources yet.'}
        evidence={{ keys: ['you'], calc: 'Citations per website in the latest sync, every engine. Highlighted: your site.' }} />
    </Card>
  )
}

// ---- Sources you could win: third-party sites that cite competitors but never you
const WIN_COLS = 'md:grid-cols-[minmax(0,1fr)_120px_88px_104px_16px]'
function Winnable({ rows }) {
  const explain = useExplain('cite-win')
  const top = rows[0]
  return (
    <Card id="cite-win" ref={explain.cardRef} className="scroll-mt-6 overflow-hidden">
      <div className="px-5 pt-5 pb-3 max-md:px-4">
        <h2 className={cardTitle}>Sources you could win</h2>
        <p className={subtitleCls}>Sites AI cites for your prompts that mention competitors but never you. A mention there can carry into the answer.</p>
      </div>
      <div className={`${head} ${WIN_COLS}`}><span>Site</span><span>Cites</span><span>Prompts</span><span>Times cited</span><span /></div>
      <ul className="divide-y divide-[var(--div)] max-md:border-t max-md:border-[var(--div)]">
        {rows.map((r) => (
          <li key={r.domain} {...hl(explain, r === top ? 'top' : r.domain, { row: true })}>
            <a href={r.url} target="_blank" rel="noreferrer" className={`${rowCls} grid-cols-[minmax(0,1fr)_16px] ${WIN_COLS}`}>
              <span className="flex min-w-0 items-center gap-3">
                <Logo domain={r.domain} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{r.domain}</span>
                  <span className={`block truncate text-[13px] leading-[18px] ${t3} md:hidden`}>{r.prompts} prompts · cited {r.citations} times</span>
                </span>
              </span>
              <span className="hidden items-center gap-1 md:flex">{r.cites.map((d) => <Logo key={d} domain={d} />)}</span>
              <span className="hidden text-[14px] leading-5 text-stone-900 tabular-nums md:block">{r.prompts}</span>
              <span className="hidden text-[14px] leading-5 text-stone-900 tabular-nums md:block">{r.citations}</span>
              <ArrowUpRight size={14} className="text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--div)] px-5 pb-3 max-md:px-4">
        <Insight explain={explain} text={`${rows.length} sites cite your competitors but never you. ${top.domain} is the biggest: ${top.prompts} prompts.`}
          evidence={{ keys: ['top'], calc: 'Websites cited in answers to your prompts that name a competitor’s site or product and never yours. Highlighted: the one in the most prompts.' }} />
      </div>
    </Card>
  )
}

// ---- Your cited pages
const PAGE_COLS = 'md:grid-cols-[minmax(0,1fr)_96px_120px_88px_16px]'
function Pages({ pages }) {
  const explain = useExplain('cite-pages')
  const top = pages[0]
  return (
    <Card id="cite-pages" ref={explain.cardRef} className="scroll-mt-6 overflow-hidden">
      <div className="px-5 pt-5 pb-3 max-md:px-4">
        <h2 className={cardTitle}>Your cited pages</h2>
        <p className={subtitleCls}>Pages on {account.domain} that AI engines list as a source. Open one for the answers that cite it.</p>
      </div>
      <div className={`${head} ${PAGE_COLS}`}><span>Page</span><span>Citations</span><span>Engines</span><span>Prompts</span><span /></div>
      <ul className="divide-y divide-[var(--div)] max-md:border-t max-md:border-[var(--div)]">
        {pages.map((p) => (
          <li key={p.path} {...hl(explain, p === top ? 'top' : p.path, { row: true })}>
            <button type="button" onClick={() => openDrawer('citedPage', p.path)} className={`${rowCls} grid-cols-[minmax(0,1fr)_16px] ${PAGE_COLS}`}>
              <span className="min-w-0">
                <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{p.path}</span>
                <span className={`flex items-center gap-2 truncate text-[13px] leading-[18px] ${t3} md:hidden`}>{p.citations} citations · {p.prompts.length} prompts <EngineMarks ids={p.engines} size={12} /></span>
              </span>
              <span className="hidden text-[14px] leading-5 text-stone-900 tabular-nums md:block">{p.citations}</span>
              <span className="hidden md:block"><EngineMarks ids={p.engines} /></span>
              <span className="hidden text-[14px] leading-5 text-stone-900 tabular-nums md:block">{p.prompts.length}</span>
              <ChevronRight size={14} className="text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--div)] px-5 pb-3 max-md:px-4">
        <Insight explain={explain} text={`${top.path} earns ${pct(top.citations, pages.reduce((n, p) => n + p.citations, 0))}% of your citations.`}
          evidence={{ keys: ['top'], calc: 'Citations per page ÷ all citations to your site, latest sync. Highlighted: the most cited page.' }} />
      </div>
    </Card>
  )
}

function PageDrawer({ pages }) {
  const map = useMemo(() => new Map(pages.map((p) => [p.path, p])), [pages])
  const drawer = useDrawer('citedPage', (id) => map.get(id) ?? null)
  const p = drawer.item
  if (!p) return null
  return (
    <DrawerShell drawer={drawer} title={p.path}
      meta={<span className="flex flex-wrap items-center gap-2">{p.citations} citations<Dot />{p.prompts.length} prompts<Dot /><EngineMarks ids={p.engines} /></span>}
      footer={<><a href={`https://${account.domain}${p.path}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded font-medium text-stone-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Open page <ArrowUpRight size={14} aria-hidden /><span className="sr-only">(opens in a new tab)</span></a><span /></>}>
      <section className="mt-5">
        <h3 className="text-[14px] leading-5 font-semibold text-stone-900">Answers that cite it</h3>
        <ul className="mt-1 divide-y divide-[var(--div)] border-y border-[var(--div)]">
          {p.prompts.flatMap((id) => p.engines.slice(0, 1).map((e) => (
            <li key={`${id}|${e}`}>
              <button type="button" onClick={(ev) => openAnswer({ key: id, list: p.prompts, engine: e, opener: ev.currentTarget })}
                className="group -mx-2 flex h-11 w-[calc(100%+16px)] items-center gap-3 rounded-md px-2 text-left outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                <EngineMark id={e} size={14} />
                <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-stone-900">{promptText(id)}</span>
                <span className={`shrink-0 text-[13px] ${t2}`}>View answer</span>
                <ChevronRight size={14} className="text-stone-500" aria-hidden />
              </button>
            </li>
          )))}
        </ul>
      </section>
      <p className={`mt-3 flex items-center gap-1.5 text-[13px] leading-[18px] ${t3}`}><Link2 size={14} aria-hidden />Latest sync. Older answers are in each prompt’s history.</p>
    </DrawerShell>
  )
}
