import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronRight, RefreshCw, Smile, SearchX } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Card from '../../components/dashboard/Card'
import SiteLogo from '../../components/ui/SiteLogo'
import Gauge from '../../components/ui/Gauge'
import Modal from '../../components/ui/Modal'
import Insight, { hl, useExplain } from '../../components/ui/Insight'
import { MenuSelect } from '../../components/dashboard/PageHeader'
import { PlatformIcon } from '../../components/dashboard/icons'
import { PrimaryButton, useToast } from '../../components/dashboard/overlays'
import DrawerShell, { Dot, useDrawer } from '../../components/audit/DrawerShell'
import { openDrawer, setParams, useParams } from '../../components/audit/parts'
import { EmptyState, ErrorCard, RunningLine } from '../../components/tool/ToolPage'
import { Progress } from '../trends/parts'
import { account, currentBrand, workspaceDirectory } from '../../data/mock'
import { chart } from '../../theme/chart'
import { useIsMobile } from '../../hooks/useMedia'
import {
  TONES, TONE_LABEL, byEngine, countTones, pagesOn, scoreOf, sentimentFor, sentimentInsight, sortPages, tonePercents, withScores,
} from '../../data/sentiment'
import { cardTitle, fmtDay, lineBtn, rowCls, subtitleCls, t2, t3 } from './parts'

// /sentiment: how third-party pages (the ones AI answers draw on) describe the brand. Laid out like the Visibility
// Overview: header with the engine + brand filters and Re-analyze (a paid run), a top strip (score, tone split, pages),
// sentiment over time + by engine, the pages list (→ a drawer with the exact sentences), what people say, run history.
// States: ?mock=never | running | nopages | error | one (a single run: no trend yet). Data and logic: data/sentiment.js.

// tone colours: positive ink, neutral t3, negative the negative token (the only hue)
const TONE_FILL = { positive: 'var(--ink)', neutral: 'var(--color-stone-500)', negative: 'var(--negative)' }
const TONE_TEXT = { positive: 'text-stone-900', neutral: t3, negative: 'text-negative' }
const MOCKS = ['never', 'running', 'nopages', 'error', 'one']
const plural = (n, w) => `${n} ${n === 1 ? w : `${w}s`}`
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')
// production splits sentiment by these three only (no Gemini, no AI Overview); icon: the PlatformIcon id
const ENGINES = [{ id: 'google', name: 'Google search', icon: 'aio' }, { id: 'chatgpt', name: 'ChatGPT', icon: 'chatgpt' }, { id: 'claude', name: 'Claude', icon: 'claude' }]
const engineLabel = (id) => ENGINES.find((e) => e.id === id)?.name
const EngineIcon = ({ id, size = 16 }) => <PlatformIcon id={ENGINES.find((e) => e.id === id)?.icon ?? id} size={size} />
function EngineMarks({ ids, size = 14 }) {
  return <span className="flex items-center gap-1.5">{ids.map((e) => <span key={e} title={engineLabel(e)} className="flex shrink-0"><EngineIcon id={e} size={size} /><span className="sr-only">{engineLabel(e)}</span></span>)}</span>
}
// the account's own brands (this client's), never competitors: sentiment is about you only
const OWN_BRANDS = (workspaceDirectory.find((c) => c.id === currentBrand.clientId)?.brands ?? [currentBrand]).map((b) => ({ domain: b.domain, name: b.name }))
const brandByDomain = (d) => OWN_BRANDS.find((b) => b.domain === d) ?? OWN_BRANDS[0]
// header selects: full width and 40px tall below lg, the Overview's h-8 trigger from lg
const TRIGGER = 'inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-line bg-raised px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-focus max-lg:h-10 max-lg:w-full max-lg:rounded-lg max-lg:text-[14px] [&>svg:last-child]:max-lg:ml-auto'

export default function SentimentPage() {
  useEffect(() => { document.title = 'Sentiment · Kraffic' }, [])
  const q = useParams()
  const mock = MOCKS.includes(q.get('mock')) ? q.get('mock') : null
  const [domain, setDomain] = useState(account.domain)
  const [engine, setEngine] = useState('all')
  const [confirm, setConfirm] = useState(false)
  const [running, setRunning] = useState(mock === 'running')
  const [toastNode, toast] = useToast({ position: 'center' })
  const brand = brandByDomain(domain)

  const data = sentimentFor(domain, account.domain)
  const never = mock === 'never' || !data.runs.length
  const runs = withScores(mock === 'one' ? data.runs.slice(-1) : data.runs)
  const latest = runs.at(-1)
  const pages = pagesOn(data.pages, engine)

  const start = () => {
    setConfirm(false)
    setRunning(true)
    toast(`Analyzing ${brand.name}: this takes a few minutes`)
  }

  const header = (
    <Header brand={brand} domain={domain} setDomain={setDomain} engine={engine} setEngine={setEngine} latest={never ? null : latest}
      runs={never ? 0 : runs.length} running={running} onRun={() => setConfirm(true)} hideRun={never} />
  )
  const modal = <RunModal open={confirm} onClose={() => setConfirm(false)} brand={brand} onStart={start} first={never} />

  if (never && !running) {
    return (
      <>
        {header}
        <EmptyState icon={Smile} title={`${brand.name} hasn’t been analysed yet`}
          body={`We search Google for questions about ${brand.name}, read the third-party pages that come up, and score how each one talks about it. Each run is a paid scan.`}
          action={{ label: 'Analyze · paid run', onClick: () => setConfirm(true) }} />
        {modal}{toastNode}
      </>
    )
  }
  if (mock === 'nopages' && !running) {
    return (
      <>
        {header}
        <EmptyState icon={SearchX} title="No third-party pages found"
          body={`The ${fmtDay(latest.date)} run searched Google but found no pages outside ${brand.domain} that mention ${brand.name}. New brands often have none yet; try again once reviews or press coverage appear.`}
          action={{ label: 'Re-analyze · paid run', onClick: () => setConfirm(true) }} />
        {modal}{toastNode}
      </>
    )
  }

  return (
    <>
      {header}
      {running && <RunningCard brand={brand} first={never} stuck={mock === 'running'} onDone={() => { setRunning(false); setParams({ mock: null }); toast('Analysis finished') }} />}
      {mock === 'error' && !running && (
        <ErrorCard title="The Oct 27 run didn’t finish"
          reason={`Google search credits are used up, so no pages could be found and nothing was charged. Below: the ${fmtDay(latest.date)} run.`}
          onRetry={() => setConfirm(true)} />
      )}
      {!never && (
        <>
          <TopStrip brand={brand} pages={pages} latest={latest} engine={engine} />
          <div className="grid grid-cols-1 items-stretch gap-3 md:gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
            <OverTime runs={runs} />
            <ByEngine pages={data.pages} engine={engine} setEngine={setEngine} />
          </div>
          <PagesList pages={pages} brand={brand} engine={engine} />
          <div className="grid grid-cols-1 items-stretch gap-3 md:gap-4 lg:grid-cols-2">
            <Themes swot={data.swot} latest={latest} />
            <RunHistory runs={runs} />
          </div>
          <PageDrawer pages={data.pages} brand={brand} />
        </>
      )}
      {modal}{toastNode}
    </>
  )
}

// ---- header: the Overview's (title + subtitle left; engine, brand, Re-analyze and "Updated" right)
function Header({ brand, domain, setDomain, engine, setEngine, latest, runs, running, onRun, hideRun }) {
  const engineGroups = [{ items: [{ id: 'all', label: 'All engines' }, ...ENGINES.map((e) => ({ id: e.id, label: e.name, icon: <EngineIcon id={e.id} /> }))] }]
  const brandGroups = [{
    items: OWN_BRANDS.map((b) => {
      const r = sentimentFor(b.domain, account.domain).runs
      return {
        id: b.domain, label: b.name,
        icon: <SiteLogo domain={b.domain} name={b.name} className="h-4 w-4 rounded" imgPad="p-0" initialClass="text-[9px]" plate />,
        meta: r.length ? `${scoreOf(r.at(-1).counts)} / 100` : 'Not analysed',
      }
    }),
  }]
  const updated = latest ? `Updated ${fmtDay(latest.date)} · ${plural(runs, 'run')}` : null
  return (
    <div className="mb-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">Sentiment</h1>
        <p className="mt-1 text-body font-normal text-stone-600">How third-party pages describe {brand.name} in AI answers.</p>
        {updated && <p className={`mt-1 inline-flex items-center gap-1.5 text-[13px] leading-[18px] ${t2} lg:hidden`}><span className="h-2 w-2 rounded-full bg-ink" />{updated}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:gap-2.5 lg:pt-1">
        <MenuSelect prefix="Engine" value={engine} onChange={setEngine} groups={engineGroups} listLabel="Filter by engine" footer="Filters the score, the pages and the topics to pages this engine’s answers drew on."
          className="max-lg:w-full" triggerClassName={TRIGGER} />
        <MenuSelect prefix="Brand" value={domain} onChange={setDomain} groups={brandGroups} listLabel="Brand" showIcon className="max-lg:w-full" triggerClassName={TRIGGER} />
        {!hideRun && (
          <button type="button" onClick={onRun} disabled={running} aria-describedby="reanalyze-tip" className={`group/ra relative ${lineBtn} !h-8 max-lg:!h-10 max-lg:w-full`}>
            <RefreshCw size={14} aria-hidden className={running ? 'motion-safe:animate-spin' : ''} />
            {running ? 'Analyzing…' : <>Re-analyze<span className={`-ml-1 font-normal ${t3}`}>· paid run</span></>}
            {/* the Overview's header tooltip: hover after 300ms, or focus */}
            <span id="reanalyze-tip" role="tooltip" className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 whitespace-nowrap rounded-md border border-line bg-raised px-2 py-1 text-[12px] leading-4 font-medium text-stone-700 opacity-0 shadow-sm transition-opacity duration-150 group-hover/ra:opacity-100 group-hover/ra:delay-300 group-focus-visible/ra:opacity-100 motion-reduce:transition-none">
              About 28 paid searches
            </span>
          </button>
        )}
        {updated && <span className={`hidden items-center gap-1.5 whitespace-nowrap text-[13px] leading-[18px] ${t2} lg:inline-flex`}><span className="h-2 w-2 rounded-full bg-ink" />{updated}</span>}
      </div>
    </div>
  )
}

// Re-analyze: what the paid run does, before anything starts (the Sync now sheet's wording)
function RunModal({ open, onClose, brand, onStart, first }) {
  return (
    <Modal open={open} onClose={onClose} size="md" title={first ? `Analyze ${brand.name}` : 'Re-analyze sentiment'}
      subtitle="A paid scan: it uses Google search credits and an AI read for every page it finds."
      footer={(
        <>
          <span className="min-w-0 flex-1 basis-[220px] text-[13px] leading-[18px] text-stone-600">Paid scan · about 28 paid searches · a few minutes</span>
          <span className="flex items-center gap-2 max-md:w-full max-md:justify-end">
            <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg px-3 text-small font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Cancel</button>
            <PrimaryButton size="sm" onClick={onStart}>{first ? 'Start analysis' : 'Re-analyze'}</PrimaryButton>
          </span>
        </>
      )}>
      <ol className="flex flex-col gap-3 text-[14px] leading-5 text-stone-900">
        {[
          ['Search', `Google searches for questions people ask about ${brand.name}.`],
          ['Read', `The third-party pages that come up (not ${brand.domain}).`],
          ['Score', 'Each page’s sentences about the brand: positive, neutral or negative.'],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span className={`w-4 shrink-0 tabular-nums ${t3}`}>{i + 1}</span>
            <span><span className="font-medium">{t}</span><span className={`block text-[13px] leading-[18px] ${t2}`}>{d}</span></span>
          </li>
        ))}
      </ol>
    </Modal>
  )
}

// running: the four steps, ticking along (?mock=running holds on the second)
function RunningCard({ brand, first, stuck, onDone }) {
  const [step, setStep] = useState(1)
  const [since] = useState(() => new Date(Date.now() - 42000).toISOString())
  useEffect(() => {
    if (stuck) return
    if (step >= 3) { const t = setTimeout(onDone, 1200); return () => clearTimeout(t) }
    const t = setTimeout(() => setStep((s) => s + 1), 1800)
    return () => clearTimeout(t)
  }, [step, stuck]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Card role="status" className="flex flex-col gap-3 p-5 max-md:px-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h2 className={cardTitle}>{first ? 'Analyzing' : 'Re-analyzing'} {brand.name}</h2>
        <div className={`${subtitleCls} flex flex-wrap items-center gap-x-1.5`}><RunningLine label="Paid run" since={since} />{!first && <span>· the numbers below are from the last run until this one finishes</span>}</div>
      </div>
      <Progress step={step} />
    </Card>
  )
}

// ---- top strip: score gauge · tone split · pages analysed, no boxes; the insight underneath
function TopStrip({ brand, pages, latest, engine }) {
  const explain = useExplain(engine)
  const c = countTones(pages)
  const n = pages.length
  const score = scoreOf(c)
  const pc = tonePercents(c)
  const all = engine === 'all'
  const text = sentimentInsight(c, brand.name)
  const label = 'text-[13px] leading-[18px] font-medium text-stone-600'
  return (
    <Card ref={explain.cardRef} className="flex flex-col px-5 pt-5 pb-3 max-md:px-4">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1.5fr)_minmax(0,0.75fr)] md:gap-0 md:divide-x md:divide-[var(--div)]">
        {/* score */}
        <div {...hl(explain, 'score')} className="min-w-0 md:pr-6">
          <div className={label}>Sentiment score</div>
          <div className="mt-2 flex items-end gap-3">
            <Gauge value={score ?? 0} width={88} stroke={10} />
            <span className="text-[32px] leading-none font-semibold text-stone-900 tabular-nums">{score ?? '—'}</span>
            <span className="flex flex-col pb-0.5">
              <span className={`text-[12px] leading-4 ${t3}`}>out of 100</span>
              {all && latest.delta != null && (
                <span className={`text-[12px] leading-4 font-medium whitespace-nowrap tabular-nums ${latest.delta < 0 ? 'text-negative' : 'text-ink'}`}>
                  {latest.delta < 0 ? '▼' : '▲'} {Math.abs(latest.delta)} vs last run
                </span>
              )}
            </span>
          </div>
          <p className={`mt-3 max-w-[340px] text-[12px] leading-4 ${t3} [text-wrap:pretty]`}>50 is even: as many pages speak well of {brand.name} as badly. Above 50, more of them are positive.</p>
        </div>
        {/* tone split: one stacked bar, % and counts under it */}
        <div {...hl(explain, 'tones')} className="min-w-0 md:px-6">
          <div className={label}>Tone of the pages</div>
          <div className="mt-3 flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-tint" role="img" aria-label={TONES.map((k) => `${pc[k]}% ${k}`).join(', ')}>
            {TONES.filter((k) => c[k]).map((k) => <span key={k} className="h-full" style={{ width: `${(c[k] / n) * 100}%`, background: TONE_FILL[k] }} />)}
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-3">
            {TONES.map((k) => (
              <li key={k} className="min-w-0">
                <span className={`flex items-center gap-1.5 text-[13px] leading-[18px] ${t2}`}><span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: TONE_FILL[k] }} aria-hidden />{TONE_LABEL[k]}</span>
                <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
                  <span className={`text-[20px] leading-7 font-semibold ${k === 'negative' && c[k] ? 'text-negative' : 'text-stone-900'}`}>{pc[k]}%</span>
                  <span className={`text-[12px] leading-4 ${t3}`}>{plural(c[k], 'page')}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        {/* pages analysed */}
        <div className="min-w-0 md:pl-6">
          <div className={label}>Pages analysed</div>
          <div className="mt-2 text-[32px] leading-10 font-semibold text-stone-900 tabular-nums">{n}</div>
          <p className={`mt-1 text-[12px] leading-4 ${t3}`}>{all ? `Third-party pages, ${fmtDay(latest.date)} run` : `That ${engineLabel(engine)}’s answers drew on`}</p>
        </div>
      </div>
      {text && (
        <div className="mt-5">
          <Insight explain={explain} text={text}
            evidence={{ keys: ['tones'], calc: `Pages per tone, ${fmtDay(latest.date)} run. Score = 50 + (positive − negative) ÷ pages × 50.` }} />
        </div>
      )}
    </Card>
  )
}

// ---- sentiment over time: the score per run (Visibility history's line style), empty under 2 runs
function OverTime({ runs }) {
  const explain = useExplain(runs.length)
  const mobile = useIsMobile()
  const points = runs.map((r) => ({ ...r, label: fmtDay(r.date) }))
  const scores = runs.map((r) => r.score)
  const lo = Math.max(0, Math.floor((Math.min(...scores) - 5) / 10) * 10)
  const hi = Math.min(100, Math.ceil((Math.max(...scores) + 5) / 10) * 10)
  const ticks = Array.from({ length: (hi - lo) / 10 + 1 }, (_, i) => lo + i * 10)
  const first = runs[0], last = runs.at(-1)
  const move = last.score - first.score
  const text = runs.length < 2 ? null
    : `${move > 0 ? 'Up' : move < 0 ? 'Down' : 'No change'}${move ? ` ${Math.abs(move)} points` : ''} since the first run on ${fmtDay(first.date)}.`
  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5 pb-3 max-md:px-4">
      <h2 className={cardTitle}>Sentiment over time</h2>
      <p className={subtitleCls}>Score per run, every engine</p>
      {runs.length < 2 ? (
        <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center pb-4 text-center">
          <p className="text-[14px] leading-5 font-medium text-stone-900">The trend starts with your second run</p>
          <p className={`mt-1 max-w-[360px] text-[13px] leading-[18px] ${t2}`}>Re-analyze after the next sync to compare two runs.</p>
        </div>
      ) : (
        <div {...hl(explain, 'line')} className="mt-4 h-[248px] min-h-[248px] min-w-0 flex-auto">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={chart.track} strokeWidth={1} />
              <XAxis dataKey="label" tickMargin={12} tickLine={false} axisLine={false} tick={{ fontSize: 13, fill: 'var(--color-stone-500)', className: 'num' }} padding={{ left: 16, right: 16 }} interval={mobile ? 1 : 0} />
              <YAxis width={mobile ? 30 : 36} tickMargin={mobile ? 4 : 8} domain={[lo, hi]} ticks={ticks} allowDataOverflow tickLine={false} axisLine={false} tick={{ fontSize: 13, fill: 'var(--color-stone-500)', className: 'num' }} />
              {lo <= 50 && hi >= 50 && (
                <ReferenceLine y={50} stroke={chart.c3} strokeDasharray="4 4" label={{ value: 'Even', position: 'insideBottomRight', offset: 6, fontSize: 12, fill: 'var(--color-stone-600)' }} />
              )}
              <Tooltip cursor={{ stroke: chart.c3, strokeWidth: 1 }} content={<RunTip />} />
              <Line type="monotone" dataKey="score" stroke="var(--ink)" strokeWidth={2.5} strokeLinecap="round" animationDuration={500}
                dot={{ r: 3, fill: 'var(--ink)', strokeWidth: 0 }} activeDot={{ r: 5, fill: 'var(--ink)', stroke: 'var(--color-surface)', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {text && <div className="mt-3"><Insight explain={explain} text={text} evidence={{ keys: ['line'], calc: `${fmtDay(first.date)}: ${first.score}. ${fmtDay(last.date)}: ${last.score}. One point per Re-analyze.` }} /></div>}
    </Card>
  )
}
function RunTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload
  return (
    <div className="rounded-lg border border-stone-200 bg-raised px-3 py-2 text-small shadow-sm tabular-nums">
      <div className="mb-1 font-semibold text-stone-900">{fmtDay(r.date)} · {r.score}{r.delta != null && <span className={`ml-1.5 font-medium ${r.delta < 0 ? 'text-negative' : 'text-stone-600'}`}>{signed(r.delta)}</span>}</div>
      <div className="text-stone-600">{tonePercents(r.counts).positive}% positive · {tonePercents(r.counts).neutral}% neutral · <span className={r.counts.negative ? 'text-negative' : undefined}>{tonePercents(r.counts).negative}% negative</span></div>
      <div className="text-stone-500">{plural(r.counts.positive + r.counts.neutral + r.counts.negative, 'page')}</div>
    </div>
  )
}

// ---- by engine: Citations and Mentions' rows, a small tone bar + page count each; a row filters the page
function ByEngine({ pages, engine, setEngine }) {
  const rows = byEngine(pages, ENGINES)
  const explain = useExplain(engine)
  const neg = countTones(pages).negative
  const worst = [...rows].sort((a, b) => b.counts.negative - a.counts.negative)[0]
  const text = !neg ? 'No engine draws on a negative page.'
    : `${worst.name} draws on ${worst.counts.negative === neg ? 'every negative page' : `${worst.counts.negative} of the negative pages`}.`
  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5 pb-3 max-md:px-4">
      <h2 className={cardTitle}>By engine</h2>
      <p className={subtitleCls}>Pages each engine’s answers drew on. Pick one to filter the page.</p>
      <ul className="mt-3 flex flex-1 flex-col pb-3">
        {rows.map((r) => {
          const on = engine === r.id
          return (
            <li key={r.id} {...hl(explain, r === worst ? 'worst' : r.id, { row: true, flush: true })} className="border-b border-[var(--div)] last:border-0">
              <button type="button" aria-pressed={on} onClick={() => setEngine(on ? 'all' : r.id)}
                aria-label={`${r.name}: ${plural(r.pages, 'page')}, ${TONES.map((k) => `${tonePercents(r.counts)[k]}% ${k}`).join(', ')}`}
                className={`-mx-2 flex h-12 w-[calc(100%+16px)] items-center gap-3 rounded-md px-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus ${on ? 'bg-tint' : ''}`}>
                <EngineIcon id={r.id} size={18} />
                <span className={`min-w-0 flex-1 truncate text-[14px] leading-5 text-stone-900 ${on ? 'font-semibold' : 'font-medium'}`}>{r.name}</span>
                <span className="flex h-1.5 w-[96px] shrink-0 gap-px overflow-hidden rounded-full bg-tint" aria-hidden>
                  {TONES.filter((k) => r.counts[k]).map((k) => <span key={k} className="h-full" style={{ width: `${(r.counts[k] / r.pages) * 100}%`, background: TONE_FILL[k] }} />)}
                </span>
                <span className={`w-16 shrink-0 text-right text-[13px] leading-[18px] tabular-nums ${t2}`}>{plural(r.pages, 'page')}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-auto"><Insight explain={explain} text={text} evidence={{ keys: ['worst'], calc: 'Negative pages each engine’s answers drew on, latest run. Highlighted: the engine with the most.' }} /></div>
    </Card>
  )
}

// ---- the pages: tabs by tone, sortable columns; a row opens the drawer with the sentences
const COLS = 'md:grid-cols-[minmax(0,1fr)_120px_96px_16px]'
function SortHead({ k, sort, onSort, children }) {
  const on = sort.key === k
  const Icon = sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <span role="columnheader" aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 rounded outline-none transition-colors duration-150 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'text-stone-900' : ''}`}>
        {children}{on && <Icon size={12} aria-hidden />}
      </button>
    </span>
  )
}
function PagesList({ pages, brand, engine }) {
  const [tab, setTab] = useState('all')
  const [sort, setSort] = useState({ key: 'tone', dir: 'asc' })
  const c = countTones(pages)
  const tabs = [['all', 'All', pages.length], ...TONES.map((k) => [k, TONE_LABEL[k], c[k]])]
  const rows = useMemo(() => sortPages(tab === 'all' ? pages : pages.filter((p) => p.tone === tab), sort.key, sort.dir), [pages, tab, sort])
  const onSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
  return (
    <Card id="sent-pages" className="min-w-0 scroll-mt-6 overflow-hidden">
      <div className="border-b border-[var(--div)] px-5 pt-5 max-md:px-4">
        <h2 className={cardTitle}>Pages</h2>
        <p className={subtitleCls}>The third-party pages AI answers drew on, and how each talks about {brand.name}. Open one for the exact sentences.</p>
        <div role="tablist" aria-label="Tone" className="mt-4 flex gap-6 overflow-x-auto [scrollbar-width:none]">
          {tabs.map(([id, label, n]) => {
            const on = tab === id
            return (
              <button key={id} type="button" role="tab" aria-selected={on} onClick={() => setTab(id)}
                className={`-mb-px shrink-0 border-b-2 pb-2.5 text-[14px] leading-5 font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'border-ink text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-900'}`}>
                {label} <span className={`ml-0.5 font-normal tabular-nums ${on ? t2 : t3}`}>{n}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div role="row" className={`hidden h-9 items-center gap-3 border-b border-[var(--div)] bg-tint px-5 text-[13px] leading-[18px] font-medium ${t3} md:grid ${COLS}`}>
        <SortHead k="title" sort={sort} onSort={onSort}>Page</SortHead>
        <SortHead k="engines" sort={sort} onSort={onSort}>Engines</SortHead>
        <SortHead k="tone" sort={sort} onSort={onSort}>Tone</SortHead>
        <span />
      </div>
      {!rows.length ? (
        <p className={`px-5 py-10 text-center text-[14px] leading-5 ${t2}`}>
          No {tab === 'all' ? '' : `${TONE_LABEL[tab].toLowerCase()} `}pages{engine === 'all' ? '' : ` on ${engineLabel(engine)}`} in this run.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--div)]">
          {rows.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => openDrawer('page', p.id)} className={`${rowCls} grid-cols-[minmax(0,1fr)_auto] ${COLS}`}>
                <span className="flex min-w-0 items-center gap-3">
                  <SiteLogo domain={p.domain} name={p.domain} className="h-5 w-5 shrink-0 rounded !border-0" imgPad="p-0" initialClass="text-[10px]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{p.title}</span>
                    <span className={`flex items-center gap-2 text-[13px] leading-[18px] ${t3}`}>
                      <span className="truncate">{p.domain}</span>
                      <span className="md:hidden"><EngineMarks ids={p.engines} size={12} /></span>
                    </span>
                  </span>
                </span>
                <span className="hidden md:block"><EngineMarks ids={p.engines} /></span>
                <span className={`text-[13px] leading-[18px] md:text-[14px] md:leading-5 ${TONE_TEXT[p.tone]} ${p.tone === 'negative' ? 'font-medium' : ''}`}>{TONE_LABEL[p.tone]}</span>
                <ChevronRight size={14} className="hidden text-stone-500 transition-colors group-hover:text-stone-900 md:block" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// the drawer: the page's sentences about the brand, the words that carry the tone marked; a link out
function PageDrawer({ pages, brand }) {
  const map = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages])
  const drawer = useDrawer('page', (id) => map.get(id) ?? null)
  const p = drawer.item
  if (!p) return null
  return (
    <DrawerShell drawer={drawer} title={p.title}
      meta={<span className="flex flex-wrap items-center gap-2"><span>{p.domain}</span><Dot /><span className={TONE_TEXT[p.tone]}>{TONE_LABEL[p.tone]}</span><Dot /><EngineMarks ids={p.engines} /></span>}
      footer={<><a href={`https://${p.domain}${p.path}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded font-medium text-stone-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Open page <ArrowUpRight size={14} aria-hidden /><span className="sr-only">(opens in a new tab)</span></a><span>Latest run</span></>}>
      <section className="mt-5">
        <h3 className="text-[14px] leading-5 font-semibold text-stone-900">What it says about {brand.name}</h3>
        <ul className="mt-2 divide-y divide-[var(--div)] border-y border-[var(--div)]">
          {p.sentences.map((s) => (
            <li key={s.text} className="flex gap-3 py-3">
              <span className="w-[3px] shrink-0 self-stretch rounded-full" style={{ background: TONE_FILL[s.tone] }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] leading-[22px] text-stone-900"><Sentence s={s} /></span>
                <span className={`mt-1 block text-[12px] leading-4 ${TONE_TEXT[s.tone]}`}>{TONE_LABEL[s.tone]}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </DrawerShell>
  )
}
function Sentence({ s }) {
  const i = s.mark ? s.text.indexOf(s.mark) : -1
  if (i < 0) return <>“{s.text}”</>
  const cls = s.tone === 'negative'
    ? 'text-negative decoration-[color-mix(in_srgb,var(--negative)_40%,transparent)]'
    : 'text-stone-900 decoration-[color-mix(in_srgb,var(--ink)_35%,transparent)]'
  return <>“{s.text.slice(0, i)}<mark className={`rounded-sm bg-transparent font-semibold underline underline-offset-2 ${cls}`}>{s.mark}</mark>{s.text.slice(i + s.mark.length)}”</>
}

// ---- what people say: the latest run's themes as Strengths / Weaknesses / Opportunities / Threats (no history, no
// counts: production keeps these for the latest run only). Weaknesses and threats stay ink text: red is for numbers.
const SWOT_GROUPS = [['strengths', 'Strengths'], ['weaknesses', 'Weaknesses'], ['opportunities', 'Opportunities'], ['threats', 'Threats']]
function Themes({ swot, latest }) {
  const explain = useExplain(latest.id)
  const n = (k) => swot?.[k]?.length ?? 0
  const lead = n('strengths') > n('weaknesses') ? 'More strengths than weaknesses' : n('strengths') < n('weaknesses') ? 'More weaknesses than strengths' : 'As many strengths as weaknesses'
  const text = !swot ? null : `${lead} in the ${fmtDay(latest.date)} run.`
  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5 pb-3 max-md:px-4">
      <h2 className={cardTitle}>What people say</h2>
      <p className={subtitleCls}>Themes from the {fmtDay(latest.date)} run</p>
      {!swot ? <p className={`mt-6 pb-4 text-[14px] leading-5 ${t2}`}>No themes in this run.</p> : (
        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 pb-4 sm:grid-cols-2">
          {SWOT_GROUPS.map(([k, label]) => (
            <section key={k} {...hl(explain, k === 'threats' ? 'threats' : k)} className="min-w-0">
              <h3 className="text-[13px] leading-[18px] font-medium text-stone-600">{label}</h3>
              <ul className="mt-1.5 flex flex-col gap-1">
                {swot[k].map((t) => (
                  <li key={t} className="flex gap-2 text-[14px] leading-5 text-stone-900">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-stone-400" aria-hidden />{t}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {text && <div className="mt-auto"><Insight explain={explain} text={text} evidence={{ keys: ['strengths', 'weaknesses', 'threats'], calc: `The themes the ${fmtDay(latest.date)} run found in the pages, grouped as strengths, weaknesses, opportunities and threats.` }} /></div>}
    </Card>
  )
}

// ---- run history: Sync history's rows (date + Latest, score + change, a bar, pages)
const ROW = 'grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-x-3 sm:grid-cols-[112px_104px_minmax(0,1fr)]'
function RunHistory({ runs }) {
  const rows = [...runs].reverse()
  const explain = useExplain(runs.length)
  const best = [...runs].sort((a, b) => b.score - a.score)[0]
  const text = runs.length < 2 ? 'The first run: the next one shows the change.' : best === runs.at(-1) ? 'The latest run has the best score so far.' : `The best score so far was on ${fmtDay(best.date)}.`
  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5 pb-3 max-md:px-4">
      <h2 className={cardTitle}>Run history</h2>
      <p className={subtitleCls}>One row per Re-analyze, newest first</p>
      <ul className="mt-3 divide-y divide-[var(--color-line-soft)] pb-4">
        {rows.map((r, i) => {
          const n = r.counts.positive + r.counts.neutral + r.counts.negative
          return (
            <li key={r.id} {...hl(explain, r === best ? 'best' : r.id, { row: true, flush: true })} className={`${ROW} min-h-11 py-1`}>
              <span className="flex flex-col items-start whitespace-nowrap sm:flex-row sm:items-center sm:gap-2">
                <span className="text-[14px] leading-5 text-stone-900 tabular-nums">{fmtDay(r.date)}</span>
                {i === 0 && <span className="inline-flex h-5 items-center rounded bg-tint px-1.5 text-[11px] leading-none font-medium text-stone-700">Latest</span>}
              </span>
              <span className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-2">
                <span className="text-[14px] leading-5 font-semibold text-ink tabular-nums">{r.score}</span>
                <span className={`text-[12px] leading-4 font-medium tabular-nums whitespace-nowrap ${r.delta == null || r.delta === 0 ? 'text-stone-500' : r.delta < 0 ? 'text-negative' : 'text-ink'}`}>
                  {r.delta == null ? 'First run' : r.delta === 0 ? '—' : `${r.delta < 0 ? '▼' : '▲'} ${Math.abs(r.delta)} pts`}
                </span>
              </span>
              <span className="flex min-w-0 items-center justify-end gap-3 sm:justify-start">
                <span className="hidden h-1.5 w-full max-w-[160px] min-w-[48px] overflow-hidden rounded-full sm:flex" style={{ background: 'var(--data-track)' }} aria-hidden>
                  <span className="h-full rounded-full bg-ink" style={{ width: `${r.score}%` }} />
                </span>
                <span className={`shrink-0 text-[13px] leading-[18px] tabular-nums ${t2}`}>{plural(n, 'page')}</span>
              </span>
            </li>
          )
        })}
      </ul>
      <div className="mt-auto"><Insight explain={explain} text={text} evidence={{ keys: ['best'], calc: 'Score per run: 50 + (positive − negative) ÷ pages × 50.' }} /></div>
    </Card>
  )
}
