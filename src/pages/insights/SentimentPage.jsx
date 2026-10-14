import { ChevronRight, MessageSquareText, Smile, Frown, TrendingUp } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import SiteLogo from '../../components/ui/SiteLogo'
import Insight, { hl, useExplain } from '../../components/ui/Insight'
import KpiStrip from '../../components/tool/KpiStrip'
import { useToast } from '../../components/dashboard/overlays'
import { openAnswer } from '../../components/answer/AnswerDrawer'
import { StackBar, sentimentParts } from '../trends/parts'
import { ENGINES, sentimentStates } from '../../data/insights'
import { trackedPrompts } from '../../data/mock'
import ToneLine from './ToneLine'
import { EngineMark, NoData, PageHead, Quote, cardTitle, fmtDay, pct, rowCls, scrollTo, subtitleCls, t2, t3, useInsightState } from './parts'

// /sentiment — "How do AI engines describe you?" (hidden from the sidebar)
// Production: GET visibility/sentiment-insights (series, platforms, ranking.brands, highlights.negative).
// GAP: descriptors / phrases — production has LLM theme names and quotes, no descriptor list, so that card is hidden.
const promptText = (id) => trackedPrompts.find((p) => p.id === id)?.prompt ?? id
const netOf = (s) => (s.positive + s.neutral + s.negative ? (s.positive - s.negative) / (s.positive + s.neutral + s.negative) : 0)
const lean = (v) => (Math.abs(v) < 0.15 ? 'Mixed' : v >= 0.5 ? 'Mostly positive' : v > 0 ? 'Leans positive' : v <= -0.5 ? 'Mostly negative' : 'Leans negative')
const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`

export default function SentimentPage() {
  const { key, st } = useInsightState(sentimentStates, 'Sentiment')
  const [toastNode, toast] = useToast({ position: 'center' })
  const head1 = <PageHead title="Sentiment" subtitle="How AI engines describe you, and whether it’s getting better" syncs={st?.syncs} />
  if (!st) {
    return <>{head1}<NoData kind={key} icon={Smile} title="Your latest scan isn’t read yet"
      body="We read every answer that mentions you and sort each statement into positive, neutral or negative. It takes a few minutes per scan."
      action={{ label: 'Read latest scan', onClick: () => toast('Reading 115 answers… this takes a few minutes') }} />{toastNode}</>
  }
  const now = st.series.at(-1), prev = st.series.at(-2)
  const posNow = pct(now.positive, now.total)
  const netNow = Math.round(netOf(now) * 100), netPrev = prev ? Math.round(netOf(prev) * 100) : null
  return (
    <>
      {head1}
      <KpiStrip items={[
        { label: 'Positive share', icon: Smile, value: `${posNow}%`, meta: prev ? `${posNow >= pct(prev.positive, prev.total) ? '▲' : '▼'} ${Math.abs(posNow - pct(prev.positive, prev.total))} pts vs last sync` : 'First sync', link: 'View over time', onOpen: scrollTo('sent-time') },
        { label: 'Negative mentions', icon: Frown, value: now.negative, meta: <span className={prev && now.negative > prev.negative ? 'text-negative' : ''}>{prev ? `${signed(now.negative - prev.negative)} vs last sync` : 'In the latest sync'}</span>, link: 'View them', onOpen: scrollTo('sent-negative') },
        { label: 'Answers mentioning you', icon: MessageSquareText, value: st.answers, meta: `${signed(st.answers - st.previousAnswers)} vs last sync`, link: 'View by engine', onOpen: scrollTo('sent-engines') },
        { label: 'Change vs last sync', icon: TrendingUp, value: netPrev == null ? '—' : signed(netNow - netPrev), unit: netPrev == null ? undefined : 'pts', meta: 'Net tone, positive minus negative', link: 'View competitors', onOpen: scrollTo('sent-brands') },
      ]} />
      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><ToneCard series={st.series} /></div>
        <ByEngine rows={st.byEngine} />
      </div>
      <Brands rows={st.brands} />
      <Negative rows={st.negative} />
      {toastNode}
    </>
  )
}

function ToneCard({ series }) {
  const explain = useExplain('sent-time')
  const nets = series.map((d) => netOf(d))
  const low = series[nets.indexOf(Math.min(...nets))]
  const text = series.length < 3
    ? `Net tone is ${signed(Math.round(nets.at(-1) * 100))}% after ${series.length} syncs. The trend fills in after a few more.`
    : `Tone is the most positive it’s been. It dipped on ${fmtDay(low.day)}, when ${low.negative} answers were negative.`
  return (
    <Card id="sent-time" ref={explain.cardRef} className="flex h-full scroll-mt-6 flex-col px-5 pt-5 pb-3 max-md:px-4">
      <h2 className={cardTitle}>Tone over time</h2>
      <p className={subtitleCls}>Net tone per sync: positive minus negative statements, over all statements. Bars show how many.</p>
      <div className="mt-4 flex flex-1 flex-col"><ToneLine points={series} explain={explain} /></div>
      <Insight explain={explain} text={text} evidence={{ keys: series.length < 3 ? series.map((d) => `tone:${d.day}`) : [`tone:${low.day}`], calc: 'Net tone = (positive − negative) ÷ statements about you, per sync. Highlighted: the sync the sentence is about.' }} />
    </Card>
  )
}

function ByEngine({ rows }) {
  const explain = useExplain('sent-engines')
  const read = rows.filter((r) => r.positive + r.neutral + r.negative > 0)
  const worst = [...read].sort((a, b) => netOf(a) - netOf(b))[0]
  return (
    <Card id="sent-engines" ref={explain.cardRef} className="flex h-full scroll-mt-6 flex-col px-5 pt-5 pb-3 max-md:px-4">
      <h2 className={cardTitle}>Tone by engine</h2>
      <p className={subtitleCls}>Statements about you, latest sync.</p>
      <ul className="mt-3 flex flex-1 flex-col divide-y divide-[var(--div)]">
        {rows.map((r) => {
          const n = r.positive + r.neutral + r.negative
          return (
            <li key={r.engine} {...hl(explain, r === worst ? 'worst' : r.engine, { row: true })} className="flex min-h-14 flex-1 items-center gap-3 py-2">
              <EngineMark id={r.engine} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] leading-5 text-stone-900">{ENGINES[r.engine]}</span>
                <span className={`block truncate text-[13px] leading-[18px] ${n ? t2 : t3}`}>{n ? lean(netOf(r)) : 'Doesn’t mention you'}</span>
              </span>
              {n > 0 && <StackBar parts={sentimentParts(r)} className="h-1.5 w-[120px]" label={`${r.positive} positive, ${r.neutral} neutral, ${r.negative} negative`} />}
            </li>
          )
        })}
      </ul>
      <Insight explain={explain} text={`${ENGINES[worst.engine]} is the least positive: ${worst.negative} of ${worst.positive + worst.neutral + worst.negative} statements are negative.`}
        evidence={{ keys: ['worst'], calc: 'Net tone per engine, latest sync. Highlighted: the lowest.' }} />
    </Card>
  )
}

// ---- You vs competitors: your row first and bold
const B_COLS = 'grid-cols-[minmax(0,1fr)_64px_64px_72px] md:grid-cols-[minmax(0,1fr)_120px_120px_120px_120px]'
function Brands({ rows }) {
  const explain = useExplain('sent-brands')
  const list = rows.map((r) => ({ ...r, net: r.positive - r.negative })).map((r) => ({ ...r, change: r.prevNet == null ? null : r.net - r.prevNet }))
  const you = list[0]
  const ahead = list.slice(1).filter((r) => r.net > you.net)
  return (
    <Card id="sent-brands" ref={explain.cardRef} className="scroll-mt-6 overflow-hidden">
      <div className="px-5 pt-5 pb-3 max-md:px-4">
        <h2 className={cardTitle}>You vs competitors</h2>
        <p className={subtitleCls}>Share of statements about each brand, latest sync.</p>
      </div>
      <div className={`grid h-9 items-center gap-3 border-y border-[var(--div)] bg-tint px-5 text-[13px] leading-[18px] font-medium ${t3} max-md:px-4 ${B_COLS}`}>
        <span>Brand</span><span className="text-right">Positive</span><span className="text-right">Negative</span><span className="text-right">Net tone</span><span className="hidden text-right md:block">Change</span>
      </div>
      <ul className="divide-y divide-[var(--div)]">
        {list.map((r) => (
          <li key={r.domain} {...hl(explain, r.you ? 'you' : ahead.includes(r) ? 'ahead' : r.domain, { row: true })}>
           <div className={`grid h-12 items-center gap-3 px-5 text-[14px] leading-5 tabular-nums max-md:px-4 ${B_COLS} ${r.you ? 'font-semibold' : ''}`}>
            <span className="flex min-w-0 items-center gap-3">
              <SiteLogo domain={r.domain} name={r.name} className="h-5 w-5 rounded !border-0" imgPad="p-0" initialClass="text-[10px]" />
              <span className="truncate text-stone-900">{r.name}{r.you && <span className={`ml-1.5 font-normal ${t3}`}>You</span>}</span>
            </span>
            <span className="text-right text-stone-900">{r.positive}%</span>
            <span className="text-right text-stone-900">{r.negative}%</span>
            <span className="text-right text-stone-900">{signed(r.net)}</span>
            <span className={`hidden text-right md:block ${r.change == null ? t3 : r.change < 0 ? 'text-negative' : t2}`}>{r.change == null ? '—' : `${r.change >= 0 ? '▲' : '▼'} ${Math.abs(r.change)}`}</span>
           </div>
          </li>
        ))}
        {list.length === 1 && <li className={`px-5 py-4 text-[13px] leading-[18px] ${t3} max-md:px-4`}>Competitors are read from the next sync on.</li>}
      </ul>
      <div className="border-t border-[var(--div)] px-5 pb-3 max-md:px-4">
        <Insight explain={explain} text={list.length === 1 ? 'Competitor tone shows once their answers are read.' : ahead.length ? `${ahead.map((r) => r.name).join(' and ')} ${ahead.length === 1 ? 'is' : 'are'} described more positively than you (net ${signed(ahead[0].net)} vs ${signed(you.net)}).` : 'AI describes you more positively than any competitor.'}
          evidence={{ keys: ['you', 'ahead'], calc: 'Net tone = positive % − negative % of statements about each brand. Highlighted: you, and anyone ahead of you.' }} />
      </div>
    </Card>
  )
}

// ---- Negative answers: prompt + engine + excerpt → the Answer drawer
function Negative({ rows }) {
  const ids = rows.map((r) => r.promptId)
  return (
    <Card id="sent-negative" className="scroll-mt-6 overflow-hidden">
      <div className="px-5 pt-5 pb-3 max-md:px-4">
        <h2 className={cardTitle}>Negative answers</h2>
        <p className={subtitleCls}>What AI says against you, word for word. Open one for the full answer.</p>
      </div>
      <ul className="divide-y divide-[var(--div)] border-t border-[var(--div)]">
        {rows.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={(e) => openAnswer({ key: r.promptId, list: ids, engine: r.engine, opener: e.currentTarget })} className={`${rowCls} grid-cols-[minmax(0,1fr)_16px] py-3`}>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <EngineMark id={r.engine} size={14} />
                  <span className="truncate text-[14px] leading-5 font-medium text-stone-900">{promptText(r.promptId)}</span>
                </span>
                <span className={`mt-1 line-clamp-2 text-[13px] leading-[18px] ${t2}`}><Quote text={r.quote} mark={r.bad} /></span>
              </span>
              <ChevronRight size={14} className="text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
