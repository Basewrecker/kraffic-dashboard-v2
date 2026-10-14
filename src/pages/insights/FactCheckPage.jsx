import { useMemo, useState } from 'react'
import { ArrowUpRight, CheckCircle2, ChevronRight, CircleHelp, ListChecks, XCircle } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import Segmented from '../../components/dashboard/Segmented'
import SiteLogo from '../../components/ui/SiteLogo'
import Insight, { hl, useExplain } from '../../components/ui/Insight'
import KpiStrip from '../../components/tool/KpiStrip'
import { useToast } from '../../components/dashboard/overlays'
import { HBar, openDrawer } from '../../components/audit/parts'
import DrawerShell, { Dot, useDrawer } from '../../components/audit/DrawerShell'
import { openAnswer } from '../../components/answer/AnswerDrawer'
import { ENGINES, factCheckStates } from '../../data/insights'
import { trackedPrompts } from '../../data/mock'
import { EngineMark, EngineMarks, NoData, PageHead, Quote, cardTitle, head, rowCls, scrollTo, subtitleCls, t2, t3, useInsightState } from './parts'

// /fact-check — "Are AI engines getting your facts right?" (hidden from the sidebar). Also covers Toolkit →
// Entity & Hallucinations, which production calls the older, sample version of this page.
// Production: GET visibility/factcheck-insights (facts, claims {quote, why, engineSlug}, platforms accuracy) against
// Website facts (BusinessFact). GAP: fact names, Correct / Missing per fact, the source AI likely used, how-to-fix
// steps, and where wrong facts come from.
const STATUS = { wrong: ['Wrong', 'text-negative'], missing: ['Missing', t3], correct: ['Correct', t2] }
const promptText = (id) => trackedPrompts.find((p) => p.id === id)?.prompt ?? id
const Logo = ({ domain }) => <SiteLogo domain={domain} name={domain} className="h-5 w-5 rounded !border-0" imgPad="p-0" initialClass="text-[10px]" />

export default function FactCheckPage() {
  const { key, st } = useInsightState(factCheckStates, 'Fact Check')
  const [filter, setFilter] = useState('all')
  const [toastNode, toast] = useToast({ position: 'center' })
  const head1 = <PageHead title="Fact Check" subtitle="Whether AI engines get your facts right, checked against your Website facts" syncs={st?.syncs} />
  if (!st) {
    return <>{head1}<NoData kind={key} icon={ListChecks} title="Your facts haven’t been checked yet"
      body="You’ve confirmed 5 Website facts. We’ll compare them with what each engine says about you in the latest scan; it takes a few minutes."
      action={{ label: 'Check latest scan', onClick: () => toast('Checking 115 answers against 5 facts…') }} />{toastNode}</>
  }
  const facts = st.facts.map((f) => ({ ...f, engines: [...new Set(f.said.map((s) => s.engine))] }))
  const n = (s) => facts.filter((f) => f.status === s).length
  const show = (f) => () => { setFilter(f); scrollTo('facts')() }
  const shown = facts.filter((f) => filter === 'all' || f.status === filter)
  return (
    <>
      {head1}
      <KpiStrip items={[
        { label: 'Facts checked', icon: ListChecks, value: facts.length, meta: 'From Website facts', link: 'View facts', onOpen: show('all') },
        { label: 'Correct', icon: CheckCircle2, value: n('correct'), meta: 'Every engine agrees', link: 'View correct', onOpen: show('correct') },
        { label: 'Wrong', icon: XCircle, value: n('wrong'), meta: <span className={n('wrong') ? 'text-negative' : ''}>{facts.reduce((k, f) => k + f.said.length, 0)} wrong answers</span>, link: 'View wrong', onOpen: show('wrong') },
        { label: 'Missing', icon: CircleHelp, value: n('missing'), meta: 'No engine mentions it', link: 'View missing', onOpen: show('missing') },
      ]} />
      <FactsCard facts={shown} all={facts} filter={filter} setFilter={setFilter} n={n} />
      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3">
        <Accuracy rows={st.byEngine} />
        <div className="lg:col-span-2"><Sources rows={st.sources} /></div>
      </div>
      <FactDrawer facts={facts} />
      {toastNode}
    </>
  )
}

const COLS = 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_96px_104px_16px]'
function FactsCard({ facts, all, filter, setFilter, n }) {
  return (
    <Card id="facts" className="scroll-mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3 max-md:px-4">
        <div className="min-w-0">
          <h2 className={cardTitle}>Facts</h2>
          <p className={subtitleCls}>Each fact you confirmed, and whether AI answers repeat it correctly.</p>
        </div>
        <div className="no-scrollbar max-w-full overflow-x-auto">
          <Segmented size="md" label="Status" value={filter} onChange={setFilter} options={[
            { value: 'all', label: `All ${all.length}` }, { value: 'wrong', label: `Wrong ${n('wrong')}` }, { value: 'missing', label: `Missing ${n('missing')}` }, { value: 'correct', label: `Correct ${n('correct')}` },
          ]} />
        </div>
      </div>
      <div className={`${head} ${COLS}`}><span>Fact</span><span>What’s true</span><span>Status</span><span>Engines wrong</span><span /></div>
      {facts.length === 0 ? <p className={`border-t border-[var(--div)] px-5 py-10 text-center text-[14px] leading-5 ${t2}`}>No facts here.</p> : (
        <ul className="divide-y divide-[var(--div)] max-md:border-t max-md:border-[var(--div)]">
          {facts.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => openDrawer('fact', f.id)} className={`${rowCls} grid-cols-[minmax(0,1fr)_16px] ${COLS}`}>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{f.name}</span>
                  <span className={`block truncate text-[13px] leading-[18px] ${t3} md:hidden`}><span className={STATUS[f.status][1]}>{STATUS[f.status][0]}</span> · {f.value}</span>
                </span>
                <span className={`hidden truncate text-[13px] leading-[18px] ${t2} md:block`}>{f.value}</span>
                <span className={`hidden text-[13px] leading-[18px] md:block ${STATUS[f.status][1]}`}>{STATUS[f.status][0]}</span>
                <span className="hidden md:block">{f.engines.length ? <EngineMarks ids={f.engines} /> : <span className={t3}>—</span>}</span>
                <ChevronRight size={14} className="text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Accuracy({ rows }) {
  const explain = useExplain('fact-engines')
  const read = rows.filter((r) => r.checked)
  const worst = [...read].sort((a, b) => a.correct / a.checked - b.correct / b.checked)[0]
  return (
    <Card ref={explain.cardRef} className="flex h-full flex-col px-5 pt-5 pb-3 max-md:px-4">
      <h2 className={cardTitle}>Accuracy by engine</h2>
      <p className={subtitleCls}>Statements that match your facts.</p>
      <ul className="mt-3 flex flex-1 flex-col divide-y divide-[var(--div)]">
        {rows.map((r) => (
          <li key={r.engine} {...hl(explain, r === worst ? 'worst' : r.engine, { row: true })} className="flex min-h-12 flex-1 flex-col justify-center gap-1.5 py-2">
            <span className="flex items-center gap-2">
              <EngineMark id={r.engine} />
              <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-stone-900">{ENGINES[r.engine]}</span>
              <span className={`text-[13px] leading-[18px] tabular-nums ${r.checked ? t2 : t3}`}>{r.checked ? `${r.correct} of ${r.checked} correct` : 'Doesn’t mention you'}</span>
            </span>
            {r.checked > 0 && <HBar value={r.correct} max={r.checked} className="w-full" label={`${r.correct} of ${r.checked} correct`} />}
          </li>
        ))}
      </ul>
      <Insight explain={explain} text={`${ENGINES[worst.engine]} gets the most wrong: ${worst.checked - worst.correct} of ${worst.checked} statements.`}
        evidence={{ keys: ['worst'], calc: 'Statements about your facts that match the fact you confirmed, per engine. Highlighted: the least accurate.' }} />
    </Card>
  )
}

function Sources({ rows }) {
  const explain = useExplain('fact-sources')
  const top = rows[0]
  return (
    <Card ref={explain.cardRef} className="flex h-full flex-col overflow-hidden">
      <div className="px-5 pt-5 pb-3 max-md:px-4">
        <h2 className={cardTitle}>Where wrong facts come from</h2>
        <p className={subtitleCls}>Pages AI cites in the answers that get a fact wrong. Fixing them fixes the answer.</p>
      </div>
      <div className={`${head} md:grid-cols-[minmax(0,1fr)_96px_96px_16px]`}><span>Source</span><span>Wrong facts</span><span>Answers</span><span /></div>
      <ul className="flex-1 divide-y divide-[var(--div)] max-md:border-t max-md:border-[var(--div)]">
        {rows.map((r) => (
          <li key={r.domain} {...hl(explain, r === top ? 'top' : r.domain, { row: true })}>
            <a href={r.url} target="_blank" rel="noreferrer" className={`${rowCls} grid-cols-[minmax(0,1fr)_16px] md:grid-cols-[minmax(0,1fr)_96px_96px_16px]`}>
              <span className="flex min-w-0 items-center gap-3">
                <Logo domain={r.domain} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{r.domain}</span>
                  <span className={`block truncate text-[13px] leading-[18px] ${t3} md:hidden`}>{r.facts} wrong {r.facts === 1 ? 'fact' : 'facts'} · {r.answers} answers</span>
                </span>
              </span>
              <span className="hidden text-[14px] leading-5 text-stone-900 tabular-nums md:block">{r.facts}</span>
              <span className="hidden text-[14px] leading-5 text-stone-900 tabular-nums md:block">{r.answers}</span>
              <ArrowUpRight size={14} className="text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--div)] px-5 pb-3 max-md:px-4">
        <Insight explain={explain} text={`${top.domain} feeds ${top.answers} wrong ${top.answers === 1 ? 'answer' : 'answers'}. Ask them to update it.`}
          evidence={{ keys: ['top'], calc: 'Sources cited in answers with a wrong fact, counted per answer. Highlighted: the one behind the most.' }} />
      </div>
    </Card>
  )
}

// ---- one fact: what each engine said (wrong part marked), the likely source, how to fix
function FactDrawer({ facts }) {
  const map = useMemo(() => new Map(facts.map((f) => [f.id, f])), [facts])
  const drawer = useDrawer('fact', (id) => map.get(id) ?? null)
  const f = drawer.item
  if (!f) return null
  const ids = f.said.map((s) => s.promptId)
  return (
    <DrawerShell drawer={drawer} title={f.name}
      meta={<span className="flex flex-wrap items-center gap-2"><span className={STATUS[f.status][1]}>{STATUS[f.status][0]}</span><Dot />True: {f.value}</span>}>
      {f.status === 'wrong' ? (
        <>
          <section className="mt-5">
            <h3 className="text-[14px] leading-5 font-semibold text-stone-900">What AI said</h3>
            <ul className="mt-1 divide-y divide-[var(--div)] border-y border-[var(--div)]">
              {f.said.map((s) => (
                <li key={`${s.engine}|${s.promptId}`} className="py-3">
                  <div className="flex items-center gap-2">
                    <EngineMark id={s.engine} size={14} />
                    <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] font-medium text-stone-900">{ENGINES[s.engine]}</span>
                    <button type="button" onClick={(e) => openAnswer({ key: s.promptId, list: ids, engine: s.engine, opener: e.currentTarget })}
                      className={`inline-flex items-center gap-0.5 rounded text-[13px] leading-[18px] ${t2} outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus`}>View answer<ChevronRight size={14} aria-hidden /></button>
                  </div>
                  <p className={`mt-1 text-[14px] leading-5 ${t2}`}><Quote text={s.quote} mark={s.wrong} /></p>
                  <p className={`mt-1 truncate text-[13px] leading-[18px] ${t3}`}>Asked: {promptText(s.promptId)}</p>
                </li>
              ))}
            </ul>
          </section>
          {f.source && (
            <section className="mt-6">
              <h3 className="text-[14px] leading-5 font-semibold text-stone-900">Where AI likely got it</h3>
              <a href={f.source.url} target="_blank" rel="noreferrer" className="group -mx-2 mt-1 flex h-11 items-center gap-3 rounded-md px-2 outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                <Logo domain={f.source.domain} />
                <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-stone-900">{f.source.domain}</span>
                <ArrowUpRight size={14} className="text-stone-500" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
              </a>
            </section>
          )}
          <section className="mt-6">
            <h3 className="text-[14px] leading-5 font-semibold text-stone-900">How to fix</h3>
            <ol className="mt-2 flex flex-col gap-3">
              {f.fix.map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-ink text-[12px] font-semibold text-ink tabular-nums" aria-hidden>{i + 1}</span>
                  <span className="pt-0.5 text-[14px] leading-5 text-stone-900">{s}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : (
        <p className={`mt-5 text-[14px] leading-5 ${t2}`}>
          {f.status === 'correct' ? 'Every engine that mentions this gets it right.' : 'No engine mentions this yet. Put it in the first paragraph of a page AI already cites, and in your schema, so answers can pick it up.'}
        </p>
      )}
    </DrawerShell>
  )
}
