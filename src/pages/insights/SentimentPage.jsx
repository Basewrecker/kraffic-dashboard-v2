import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, ChevronDown, CornerDownRight, RefreshCw, SearchX, Smile } from 'lucide-react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Card from '../../components/dashboard/Card'
import SiteLogo from '../../components/ui/SiteLogo'
import Modal from '../../components/ui/Modal'
import Switch from '../../components/ui/Switch'
import Insight, { hl, useExplain } from '../../components/ui/Insight'
import Segmented from '../../components/dashboard/Segmented'
import { MenuSelect } from '../../components/dashboard/PageHeader'
import { PlatformIcon } from '../../components/dashboard/icons'
import { PrimaryButton, useToast } from '../../components/dashboard/overlays'
import DrawerShell, { Dot, useDrawer } from '../../components/audit/DrawerShell'
import { openDrawer, setParams, useParams } from '../../components/audit/parts'
import { EmptyState, ErrorCard, RunningLine } from '../../components/tool/ToolPage'
import { account, currentBrand, workspaceDirectory } from '../../data/mock'
import { chart } from '../../theme/chart'
import { useIsMobile } from '../../hooks/useMedia'
import {
  TONES, TONE_LABEL, countTones, heroLine, runPages, scoreOf, sentimentFor, sentimentInsight, sortPages, tonePercents, withScores,
} from '../../data/sentiment'
import { layoutSwarm, lanesFor, matchIds, neighbour, scoreX, tellingSentence } from '../../utils/spectrum'
import { fmtDay, lineBtn, t2, t3 } from './parts'

// /sentiment: one visual page about how third-party pages talk about the brand.
//   Header · the spectrum (every page a dot, placed by tone; hover for a quote, click for all of them; split by engine)
//   · one insight · Needs attention (the negative pages as quotes) · What people say (SWOT; a theme lights its pages)
//   · Over time (tone share + score per run; a run swaps the spectrum to it) · All pages (collapsed, synced filters).
// Production gives each page a tone only (no number), so dots sit in three bands. Data and logic: data/sentiment.js,
// utils/spectrum.js. States: ?mock=never | running | nopages | error | one | calm (no negative pages).

const ENGINES = [{ id: 'google', name: 'Google search', short: 'Google', icon: 'aio' }, { id: 'chatgpt', name: 'ChatGPT', short: 'ChatGPT', icon: 'chatgpt' }, { id: 'claude', name: 'Claude', short: 'Claude', icon: 'claude' }]
const engineName = (id) => ENGINES.find((e) => e.id === id)?.name
const EngineIcon = ({ id, size = 14 }) => <PlatformIcon id={ENGINES.find((e) => e.id === id)?.icon ?? id} size={size} />
const EngineMarks = ({ ids, size = 14 }) => (
  <span className="flex items-center gap-1.5">{ids.map((e) => <span key={e} title={engineName(e)} className="flex shrink-0"><EngineIcon id={e} size={size} /><span className="sr-only">{engineName(e)}</span></span>)}</span>
)
const OWN_BRANDS = (workspaceDirectory.find((c) => c.id === currentBrand.clientId)?.brands ?? [currentBrand]).map((b) => ({ domain: b.domain, name: b.name }))
const brandByDomain = (d) => OWN_BRANDS.find((b) => b.domain === d) ?? OWN_BRANDS[0]

// positive ink · neutral t3 · negative the negative token
const RING = { positive: 'var(--ink)', neutral: 'var(--color-stone-500)', negative: 'var(--negative)' }
const TONE_TEXT = { positive: 'text-ink', neutral: t3, negative: 'text-negative' }
const MOCKS = ['never', 'running', 'nopages', 'error', 'one', 'calm']
const h2 = 'text-[17px] leading-6 font-semibold text-stone-900'
const plural = (n, w) => `${n} ${n === 1 ? w : `${w}s`}`

export default function SentimentPage() {
  useEffect(() => { document.title = 'Sentiment · Kraffic' }, [])
  const q = useParams()
  const mock = MOCKS.includes(q.get('mock')) ? q.get('mock') : null
  const [domain, setDomain] = useState(account.domain)
  const [engine, setEngine] = useState('all')
  const [split, setSplit] = useState(false)
  const [tone, setTone] = useState(null)
  const [theme, setTheme] = useState(null)
  const [runId, setRunId] = useState(null) // null = the latest run
  const [confirm, setConfirm] = useState(false)
  const [running, setRunning] = useState(mock === 'running')
  const [toastNode, toast] = useToast({ position: 'center' })
  const hero = useRef(null)
  const brand = brandByDomain(domain)

  const data = sentimentFor(domain, account.domain)
  const never = mock === 'never' || !data.runs.length
  // ?mock=calm: the same run with its negative pages read as neutral
  const latestPages = mock === 'calm' ? data.pages.map((p) => (p.tone === 'negative' ? { ...p, tone: 'neutral', action: undefined } : p)) : data.pages
  const baseRuns = mock === 'one' ? data.runs.slice(-1) : data.runs
  const runs = withScores(mock === 'calm' ? [...baseRuns.slice(0, -1), { ...baseRuns.at(-1), counts: countTones(latestPages) }] : baseRuns)
  const latest = runs.at(-1)
  const run = runs.find((r) => r.id === runId) ?? latest
  const isLatest = run === latest
  const pages = isLatest ? latestPages : runPages(latestPages, run.counts)
  const lit = matchIds(pages, { engine, tone, theme })
  useEffect(() => { setRunId(null); setTheme(null); setTone(null) }, [domain])

  const pickTheme = (t) => {
    const next = theme?.theme === t.theme ? null : t
    setTheme(next)
    if (next) setRunId(null) // themes are the latest run's
    const top = hero.current?.getBoundingClientRect().top ?? 0
    if (next && (top < 0 || top > window.innerHeight * 0.6)) hero.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }
  const start = () => { setConfirm(false); setRunning(true); toast(`Analyzing ${brand.name}: this takes a few minutes`) }

  const header = <Header brand={brand} domain={domain} setDomain={setDomain} engine={engine} setEngine={setEngine} running={running} onRun={() => setConfirm(true)} hideRun={never} />
  const modal = <RunModal open={confirm} onClose={() => setConfirm(false)} brand={brand} onStart={start} first={never} />

  if (never && !running) {
    return (
      <>{header}
        <EmptyState icon={Smile} title={`${brand.name} hasn’t been analysed yet`}
          body={`A paid run searches Google for questions about ${brand.name}, reads the third-party pages that come up, and sorts each one into positive, neutral or negative. It takes a few minutes.`}
          action={{ label: 'Analyze · paid run', onClick: () => setConfirm(true) }} />
        {modal}{toastNode}</>
    )
  }
  if (mock === 'nopages' && !running) {
    return (
      <>{header}
        <EmptyState icon={SearchX} title="No third-party pages found"
          body={`The ${fmtDay(latest.date)} run searched Google but found no pages outside ${brand.domain} that mention ${brand.name}. New brands often have none yet; try again once reviews or press coverage appear.`}
          action={{ label: 'Re-analyze · paid run', onClick: () => setConfirm(true) }} />
        {modal}{toastNode}</>
    )
  }
  if (running) {
    return <>{header}<RunningHero brand={brand} pages={latestPages} stuck={mock === 'running'} onDone={() => { setRunning(false); setParams({ mock: null }); toast('Analysis finished') }} />{toastNode}</>
  }

  return (
    <div className="flex flex-col gap-10 md:gap-12">
      <div className="flex flex-col gap-4">
        {header}
        {mock === 'error' && (
          <ErrorCard title="The latest run didn’t finish" reason={`Google search credits are used up, so no pages could be found and nothing was charged. Below: the ${fmtDay(latest.date)} run.`} onRetry={() => setConfirm(true)} />
        )}
      </div>
      <Hero heroRef={hero} prevDate={runs[runs.indexOf(run) - 1]?.date} brand={brand} run={run} isLatest={isLatest} onLatest={() => setRunId(null)} pages={pages} lit={lit} engine={engine}
        split={split} setSplit={setSplit} tone={tone} setTone={setTone} theme={theme} clearTheme={() => setTheme(null)} />
      <Attention pages={pages.filter((p) => p.tone === 'negative' && (engine === 'all' || p.engines.includes(engine)))} run={run} isLatest={isLatest} />
      {data.swot && <Themes swot={data.swot} latest={latest} theme={theme} onPick={pickTheme} />}
      <OverTime runs={runs} run={run} onPick={(id) => { setRunId(id === latest.id ? null : id); setTheme(null) }} />
      <AllPages pages={pages} lit={lit} filtered={engine !== 'all' || tone || theme} />
      <PageDrawer pages={pages} brand={brand} />
      {modal}{toastNode}
    </div>
  )
}

// ---- header: title + subtitle; the engine control, the brand select, Re-analyze. No numbers.
const TRIGGER = 'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-raised px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-focus max-lg:h-10 max-lg:w-full max-lg:text-[14px] [&>svg:last-child]:max-lg:ml-auto'
function Header({ brand, domain, setDomain, engine, setEngine, running, onRun, hideRun }) {
  const brandGroups = [{ items: OWN_BRANDS.map((b) => ({ id: b.domain, label: b.name, icon: <SiteLogo domain={b.domain} name={b.name} className="h-4 w-4 rounded" imgPad="p-0" initialClass="text-[9px]" plate /> })) }]
  const options = [{ value: 'all', label: 'All' }, ...ENGINES.map((e) => ({ value: e.id, label: <><span className="max-sm:hidden">{e.name}</span><span className="sm:hidden">{e.short}</span></> }))]
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">Sentiment</h1>
        <p className="mt-1 text-body text-stone-600">How third-party pages talk about {brand.name}.</p>
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:gap-2.5">
        <Segmented label="Engine" value={engine} onChange={setEngine} options={options} className="max-lg:w-full" full={false} />
        <MenuSelect prefix="Brand" value={domain} onChange={setDomain} groups={brandGroups} listLabel="Brand" showIcon className="max-lg:w-full" triggerClassName={TRIGGER} />
        {!hideRun && (
          <button type="button" onClick={onRun} disabled={running} aria-describedby="reanalyze-tip" className={`group/ra relative ${lineBtn} max-lg:h-10 max-lg:w-full`}>
            <RefreshCw size={14} aria-hidden className={running ? 'motion-safe:animate-spin' : ''} />
            {running ? 'Analyzing…' : <>Re-analyze<span className={`-ml-1 font-normal ${t3}`}>· paid run</span></>}
            <span id="reanalyze-tip" role="tooltip" className="pointer-events-none absolute right-0 top-full z-30 mt-1.5 whitespace-nowrap rounded-md border border-line bg-raised px-2 py-1 text-[12px] leading-4 font-medium text-stone-700 opacity-0 shadow-sm transition-opacity duration-150 group-hover/ra:opacity-100 group-hover/ra:delay-300 group-focus-visible/ra:opacity-100 motion-reduce:transition-none">
              About 28 paid searches
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

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
        {[['Search', `Google searches for questions people ask about ${brand.name}.`], ['Read', `The third-party pages that come up (not ${brand.domain}).`], ['Sort', 'Each page into positive, neutral or negative, with the sentences that say so.']].map(([t, d]) => (
          <li key={t}><span className="font-medium">{t}</span><span className={`block text-[13px] leading-[18px] ${t2}`}>{d}</span></li>
        ))}
      </ol>
    </Modal>
  )
}

// ---- the hero: the score on the left, the spectrum, the legend, the one insight
function Hero({ heroRef, prevDate, brand, run, isLatest, onLatest, pages, lit, engine, split, setSplit, tone, setTone, theme, clearTheme }) {
  const explain = useExplain(`${run.id}|${engine}`)
  const c = countTones(engine === 'all' ? pages : pages.filter((p) => p.engines.includes(engine)))
  const score = engine === 'all' ? run.score : scoreOf(c)
  const text = sentimentInsight(c, brand.name)
  return (
    <section ref={(el) => { explain.cardRef.current = el; heroRef.current = el }} aria-label="Sentiment spectrum" className="scroll-mt-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <div className="flex flex-col">
          {!isLatest && (
            <p className={`mb-3 text-[13px] leading-[18px] ${t2}`}>
              Viewing the {fmtDay(run.date)} run · <button type="button" onClick={onLatest} className="rounded font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">back to latest</button>
            </p>
          )}
          <span className={`text-[13px] leading-[18px] font-medium ${t2}`}>Sentiment score{engine === 'all' ? '' : ` · ${engineName(engine)}`}</span>
          <span className="mt-1 text-[64px] leading-[64px] font-semibold tracking-[-0.03em] text-stone-900 tabular-nums lg:text-[80px] lg:leading-[80px]">{score ?? '—'}</span>
          {engine === 'all' && (
            <span className={`mt-2 text-[14px] leading-5 font-medium tabular-nums ${run.delta == null ? t3 : run.delta < 0 ? 'text-negative' : 'text-ink'}`}>
              {run.delta == null ? 'First run' : run.delta === 0 ? `No change since ${fmtDay(prevDate)}` : `${run.delta < 0 ? '▼' : '▲'}${Math.abs(run.delta)} since ${fmtDay(prevDate)}`}
            </span>
          )}
          <span className="mt-2 text-[15px] leading-[22px] text-stone-900 [text-wrap:pretty]">{heroLine(c)}</span>
          <span className={`mt-3 text-[12px] leading-4 ${t3} [text-wrap:pretty]`}>Out of 100. 50 is even: as many pages speak well of you as badly.</span>
        </div>
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className={`min-w-0 truncate text-[13px] leading-[18px] ${t2} ${theme ? '' : 'max-sm:invisible'}`}>
              {theme ? <>Pages behind “{theme.theme}” · <button type="button" onClick={clearTheme} className="rounded font-medium text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">clear</button></> : 'Every page is a dot, placed by its tone'}
            </span>
            <Switch checked={split} onChange={setSplit}>Split by engine</Switch>
          </div>
          <Spectrum pages={pages} lit={lit} engine={engine} split={split} score={score} />
          <Legend c={c} tone={tone} setTone={setTone} explain={explain} />
        </div>
      </div>
      {text && <div className="mt-6"><Insight explain={explain} text={text} evidence={{ keys: ['tones'], calc: `Pages per tone in the ${fmtDay(run.date)} run. Score = 50 + (positive − negative) ÷ pages × 50.` }} /></div>}
    </section>
  )
}

// "5 positive · 14 neutral · 2 negative": each one filters the dots (again: all)
function Legend({ c, tone, setTone, explain }) {
  return (
    <div {...hl(explain, 'tones')} className="mt-3 flex flex-wrap items-center gap-x-1 text-[14px] leading-5 tabular-nums" role="group" aria-label="Filter by tone">
      {['positive', 'neutral', 'negative'].map((k, i) => (
        <span key={k} className="inline-flex items-center gap-1">
          {i > 0 && <span className={t3} aria-hidden>·</span>}
          <button type="button" aria-pressed={tone === k} onClick={() => setTone(tone === k ? null : k)}
            className={`rounded px-1 outline-none transition-opacity duration-200 focus-visible:ring-2 focus-visible:ring-focus ${c[k] || k !== 'negative' ? TONE_TEXT[k] : t3} ${k === 'positive' ? 'font-medium' : ''} ${tone && tone !== k ? 'opacity-40' : ''} ${tone === k ? 'underline decoration-2 underline-offset-4' : 'hover:underline underline-offset-4'}`}>
            {c[k]} {k}
          </button>
        </span>
      ))}
    </div>
  )
}

// ---- the spectrum itself: one lane (or three, split by engine), dots laid out by utils/spectrum
function Spectrum({ pages, lit, engine, split, score }) {
  const box = useRef(null)
  const mobile = useIsMobile()
  const [w, setW] = useState(800)
  const [hover, setHover] = useState(null) // { page, x, y, r }
  const [focusId, setFocusId] = useState(null)
  const dots = useRef({})
  useLayoutEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])
  const r = mobile ? 12 : 18
  const gutter = split && !mobile ? 132 : 0
  const plotW = Math.max(120, w - gutter)

  // lanes: one with every page (the engine's re-settle, the rest stay put and fade), or one per engine
  const lanes = useMemo(() => {
    if (!split) {
      const all = layoutSwarm(pages, { width: plotW, r })
      const on = engine === 'all' ? all : layoutSwarm(pages.filter((p) => p.engines.includes(engine)), { width: plotW, r })
      const extent = Math.max(all.extent, on.extent)
      const H = Math.max(mobile ? 200 : 236, 2 * extent + 28)
      return [{ id: 'all', H, score, dots: pages.map((p) => ({ page: p, ...(on.pos[p.id] ?? all.pos[p.id]), active: engine === 'all' || p.engines.includes(engine) })) }]
    }
    return lanesFor(pages, ENGINES).map((l) => {
      const lay = layoutSwarm(l.pages, { width: plotW, r })
      return { id: l.id, name: l.name, score: l.score, H: Math.max(mobile ? 96 : 104, 2 * lay.extent + 20), dots: l.pages.map((p) => ({ page: p, ...lay.pos[p.id], active: engine === 'all' || engine === l.id })) }
    })
  }, [pages, plotW, r, split, engine, score, mobile])

  // every dot with its place in the whole plot, for the keyboard
  let top = 0
  const placed = lanes.flatMap((l) => {
    const laneTop = top + (split && mobile ? 24 : 0)
    top = laneTop + l.H
    return l.dots.map((d, i) => ({ ...d, lane: l.id, key: `${l.id}:${d.page.id}`, i, cx: gutter + d.x, cy: laneTop + l.H / 2 + d.y }))
  })
  const totalH = top
  const usable = placed.filter((d) => d.active && lit.has(d.page.id))
  const tabKey = usable.some((d) => d.key === focusId) ? focusId : [...usable].sort((a, b) => a.cx - b.cx)[0]?.key
  const onKey = (e, d) => {
    if (e.key === 'Escape') { setHover(null); return }
    if (!e.key.startsWith('Arrow')) return
    e.preventDefault()
    const next = neighbour(usable.map((u) => ({ id: u.key, x: u.cx, y: u.cy })), d.key, e.key)
    setFocusId(next)
    dots.current[next]?.focus()
  }
  const show = (d) => setHover({ page: d.page, x: d.cx, y: d.cy })

  return (
    <div ref={box} className="relative" onMouseLeave={() => setHover(null)}>
      <div className="relative" style={{ height: totalH }}>
        {/* lanes: band dividers, the even line, the score marker; split: the engine and its score on the left */}
        {(() => {
          let y = 0
          return lanes.map((l) => {
            const laneTop = y + (split && mobile ? 24 : 0)
            y = laneTop + l.H
            const faded = split && engine !== 'all' && engine !== l.id
            return (
              <div key={l.id} className={`absolute inset-x-0 transition-opacity duration-300 ${faded ? 'opacity-30' : ''}`} style={{ top: laneTop, height: l.H }} aria-hidden>
                {split && (
                  <span className={`absolute flex items-center gap-2 ${mobile ? 'left-0 -top-6 h-6' : 'left-0 top-1/2 -translate-y-1/2'}`}>
                    <EngineIcon id={l.id} size={16} />
                    <span className="text-[13px] leading-[18px] font-medium text-stone-900">{l.name}</span>
                    <span className="text-[15px] leading-5 font-semibold text-stone-900 tabular-nums">{l.score ?? '—'}</span>
                  </span>
                )}
                <div className="absolute inset-y-0" style={{ left: gutter, width: plotW }}>
                  {split && <div className="absolute inset-x-0 bottom-0 border-b border-[var(--div)]" />}
                  <div className="absolute inset-y-0 border-l border-[var(--div)]" style={{ left: plotW / 3 }} />
                  <div className="absolute inset-y-0 border-l border-[var(--div)]" style={{ left: (2 * plotW) / 3 }} />
                  <div className="absolute inset-y-0 border-l border-dashed" style={{ left: plotW / 2, borderColor: 'var(--color-stone-400)' }} />
                  {l.score != null && (
                    <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-ink transition-[left] duration-[400ms] ease-out motion-reduce:transition-none" style={{ left: scoreX(l.score, plotW) }}>
                      {!split && <span className={`absolute -top-1 left-2 whitespace-nowrap text-[12px] leading-4 font-medium text-ink`}>Overall</span>}
                    </div>
                  )}
                  {/* "Even" on the side away from the score marker */}
                  {!split && <span className={`absolute bottom-0 whitespace-nowrap text-[12px] leading-4 ${t3} ${(l.score ?? 50) >= 50 ? '-translate-x-full' : ''}`} style={{ left: (l.score ?? 50) >= 50 ? plotW / 2 - 6 : plotW / 2 + 6 }}>Even</span>}
                </div>
              </div>
            )
          })
        })()}

        {/* the dots */}
        {placed.map((d, n) => {
          const on = d.active && lit.has(d.page.id)
          return (
            <button key={d.key} ref={(el) => { dots.current[d.key] = el }} type="button"
              tabIndex={on && d.key === tabKey ? 0 : -1} aria-hidden={!on}
              aria-label={`${d.page.title}, ${d.page.domain}: ${TONE_LABEL[d.page.tone].toLowerCase()}. Open the quotes`}
              onClick={(e) => { setHover(null); openDrawer('page', d.page.id); e.currentTarget.blur() }}
              onMouseEnter={() => on && show(d)} onFocus={() => { setFocusId(d.key); show(d) }} onBlur={() => setHover(null)} onKeyDown={(e) => onKey(e, d)}
              className={`dot-move absolute left-0 top-0 grid place-items-center rounded-full bg-surface outline-none transition-[transform,opacity] duration-[400ms] ease-out focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${on ? 'z-[2] hover:z-[3]' : 'pointer-events-none z-[1]'}`}
              style={{ width: 2 * r, height: 2 * r, transform: `translate(${d.cx - r}px, ${d.cy - r}px)`, opacity: on ? 1 : 0.12 }}>
              {/* tone ring · a sliver of surface · a white plate, so dark logos show in both themes */}
              <span className="dot-in grid h-full w-full place-items-center rounded-full border-2 bg-surface"
                style={{ borderColor: RING[d.page.tone], animation: `dot-in 420ms cubic-bezier(.2,.8,.2,1) ${Math.min(n, 30) * 22}ms both` }}>
                <span className="grid h-[calc(100%-4px)] w-[calc(100%-4px)] place-items-center rounded-full"
                  style={{ background: d.page.tone === 'negative' ? 'color-mix(in srgb, var(--negative) 14%, #fff)' : '#fff' }}>
                  <SiteLogo domain={d.page.domain} name={d.page.domain} className={`${mobile ? 'h-3.5 w-3.5' : 'h-5 w-5'} rounded-full !border-0 !bg-transparent`} imgPad="p-0" initialClass="text-[9px] !text-[#44403c]" bordered={false} />
                </span>
              </span>
            </button>
          )
        })}
        {hover && <HoverCard hover={hover} w={w} r={r} />}
      </div>
      {/* the axis: three bands */}
      <div className="relative mt-2 h-5 border-t border-line text-[12px] leading-4" style={{ marginLeft: gutter }} aria-hidden>
        <span className="absolute top-1.5 -translate-x-1/2 font-medium text-negative" style={{ left: plotW / 6 }}>Negative</span>
        <span className={`absolute top-1.5 -translate-x-1/2 font-medium ${t3}`} style={{ left: plotW / 2 }}>Neutral</span>
        <span className="absolute top-1.5 -translate-x-1/2 font-medium text-ink" style={{ left: (5 * plotW) / 6 }}>Positive</span>
      </div>
    </div>
  )
}

// the floating card on hover / focus: who, where, and the one sentence that says it
function HoverCard({ hover, w, r }) {
  const p = hover.page
  const s = tellingSentence(p)
  const W = Math.min(320, w)
  const left = Math.max(0, Math.min(w - W, hover.x - W / 2))
  const above = hover.y > 150
  return (
    <div role="tooltip" className="pointer-events-none absolute z-20 rounded-xl border border-line bg-raised p-3.5 shadow-lg motion-safe:animate-[fade-in_120ms_ease-out]"
      style={{ left, width: W, top: above ? hover.y - r - 10 : hover.y + r + 10, transform: above ? 'translateY(-100%)' : undefined }}>
      <div className="flex items-start gap-2.5">
        <SiteLogo domain={p.domain} name={p.domain} className="mt-0.5 h-5 w-5 shrink-0 rounded !border-0" imgPad="p-0" initialClass="text-[10px]" />
        <div className="min-w-0">
          <div className="line-clamp-2 text-[14px] leading-5 font-semibold text-stone-900">{p.title}</div>
          <div className={`mt-0.5 flex items-center gap-2 text-[12px] leading-4 ${t3}`}><span className="truncate">{p.domain}</span><EngineMarks ids={p.engines} size={12} /></div>
        </div>
      </div>
      <p className="mt-2.5 text-[13px] leading-5 text-stone-900"><Phrase s={s} tone={p.tone} /></p>
      <p className={`mt-2 text-[12px] leading-4 ${t3}`}>Click for every quote</p>
    </div>
  )
}
// a quote with the brand phrase marked (negative: the negative token, else ink)
function Phrase({ s, tone = s.tone }) {
  const i = s.mark ? s.text.indexOf(s.mark) : -1
  if (i < 0) return <>“{s.text}”</>
  const cls = tone === 'negative' ? 'decoration-[var(--negative)]' : 'decoration-[color-mix(in_srgb,var(--ink)_45%,transparent)]'
  return <>“{s.text.slice(0, i)}<mark className={`bg-transparent font-semibold text-stone-900 underline decoration-2 underline-offset-[3px] ${cls}`}>{s.mark}</mark>{s.text.slice(i + s.mark.length)}”</>
}

// running: the dots appear as pages get scored (?mock=running holds part way)
function RunningHero({ brand, pages, stuck, onDone }) {
  const [n, setN] = useState(stuck ? Math.ceil(pages.length * 0.6) : 0)
  const [since] = useState(() => new Date(Date.now() - 42000).toISOString())
  useEffect(() => {
    if (stuck) return
    if (n >= pages.length) { const t = setTimeout(onDone, 900); return () => clearTimeout(t) }
    const t = setTimeout(() => setN((k) => k + 1), 220)
    return () => clearTimeout(t)
  }, [n, stuck]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = pages.slice(0, n)
  return (
    <section aria-label="Analysis running" className="mt-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <div className="flex flex-col gap-2" role="status">
          <span className={`text-[13px] leading-[18px] font-medium ${t2}`}>Analyzing {brand.name}</span>
          <span className="text-[15px] leading-[22px] text-stone-900">Pages appear as they’re scored</span>
          <span className={`text-[13px] leading-[18px] ${t2}`}>{shown.length} of {pages.length} scored</span>
          <RunningLine label="Paid run" since={since} />
        </div>
        <div className="min-w-0"><Spectrum pages={shown} lit={new Set(shown.map((p) => p.id))} engine="all" split={false} score={null} /></div>
      </div>
    </section>
  )
}

// ---- needs attention: the negative pages as quotes, with a suggested next step
function Attention({ pages, run, isLatest }) {
  return (
    <section aria-labelledby="attn-h">
      <h2 id="attn-h" className={h2}>Needs attention</h2>
      {!pages.length ? (
        <p className={`mt-2 text-[15px] leading-[22px] ${t2}`}>No negative pages {isLatest ? 'this run' : `in the ${fmtDay(run.date)} run`}.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          {pages.map((p) => {
            const s = tellingSentence(p)
            return (
              <Card key={p.id} className="flex flex-col p-6 max-md:p-5">
                <div className={`flex items-center gap-2 text-[13px] leading-[18px] ${t2}`}>
                  <SiteLogo domain={p.domain} name={p.domain} className="h-5 w-5 rounded !border-0" imgPad="p-0" initialClass="text-[10px]" />
                  <span className="truncate font-medium text-stone-900">{p.domain}</span>
                  <EngineMarks ids={p.engines} size={13} />
                </div>
                <blockquote className="mt-4 text-[20px] leading-[30px] font-medium tracking-[-0.01em] text-stone-900 max-md:text-[18px] max-md:leading-7 [text-wrap:pretty]"><Phrase s={s} tone="negative" /></blockquote>
                {p.action && (
                  <p className={`mt-4 flex gap-2 text-[14px] leading-5 ${t2}`}><CornerDownRight size={16} className="mt-0.5 shrink-0 text-stone-500" aria-hidden />{p.action}</p>
                )}
                <div className="mt-auto flex items-center gap-4 pt-5 text-[13px] leading-[18px]">
                  <a href={`https://${p.domain}${p.path}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded font-medium text-stone-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Open page <ArrowUpRight size={14} aria-hidden /><span className="sr-only">(opens in a new tab)</span></a>
                  <button type="button" onClick={() => openDrawer('page', p.id)} className={`rounded font-medium ${t2} outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus`}>Every quote</button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ---- what people say: the latest run's SWOT; a theme lights its pages in the spectrum and filters the list
const QUADS = [['strengths', 'Strengths'], ['weaknesses', 'Weaknesses'], ['opportunities', 'Opportunities'], ['threats', 'Threats']]
function Themes({ swot, latest, theme, onPick }) {
  return (
    <section aria-labelledby="themes-h">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="themes-h" className={h2}>What people say</h2>
        <span className={`text-[13px] leading-[18px] ${t3}`}>From the {fmtDay(latest.date)} run</span>
      </div>
      <div className="mt-4 grid grid-cols-1 border-t border-line sm:grid-cols-2">
        {QUADS.map(([k, label], i) => (
          <div key={k} className={`py-5 sm:px-6 ${i % 2 ? 'sm:border-l sm:border-line' : 'sm:pl-0'} ${i > 1 ? 'border-t border-line' : i === 1 ? 'max-sm:border-t max-sm:border-line' : ''}`}>
            <h3 className={`text-[13px] leading-[18px] ${t3}`}>{label}</h3>
            <ul className="mt-2 flex flex-col items-start gap-1">
              {swot[k].map((t) => {
                const on = theme?.theme === t.theme
                return (
                  <li key={t.theme}>
                    <button type="button" aria-pressed={on} onClick={() => onPick(t)}
                      className={`rounded text-left text-[17px] leading-7 font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'text-ink underline decoration-2 underline-offset-4' : theme ? `${t3} hover:text-stone-900` : 'text-stone-900 hover:underline hover:decoration-[var(--color-stone-400)] underline-offset-4'}`}>
                      {t.theme}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---- over time: tone share per run (stacked, faint) with the score on top; a run swaps the spectrum to it
function OverTime({ runs, run, onPick }) {
  const mobile = useIsMobile()
  const data = runs.map((r) => { const pc = tonePercents(r.counts); return { ...r, label: fmtDay(r.date), pos: pc.positive, neu: pc.neutral, neg: pc.negative } })
  return (
    <section aria-labelledby="time-h">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="time-h" className={h2}>Over time</h2>
        <span className={`text-[13px] leading-[18px] ${t3}`}>Share of pages by tone, and the score, per run. Click a run to see its pages.</span>
      </div>
      {runs.length < 2 ? (
        <div className="mt-4 flex h-[200px] flex-col items-center justify-center border-y border-line text-center">
          <p className="text-[15px] leading-[22px] font-medium text-stone-900">The trend starts with your second run</p>
          <p className={`mt-1 text-[13px] leading-[18px] ${t2}`}>Re-analyze after the next sync to compare.</p>
        </div>
      ) : (
        <div className="mt-4 h-[280px] w-full cursor-pointer">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 20 }}
              onClick={(e) => { const r = data.find((d) => d.label === e?.activeLabel) ?? data[e?.activeTooltipIndex]; if (r) onPick(r.id) }}>
              <CartesianGrid vertical={false} stroke={chart.track} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={12} interval={mobile ? 1 : 0} padding={{ left: 12, right: 12 }} tick={{ fontSize: 13, fill: 'var(--color-stone-500)', className: 'num' }} />
              {/* no y numbers: the share always fills the height and the score is the hero's; the grid marks even (50) */}
              <YAxis domain={[0, 100]} ticks={[0, 50, 100]} hide />
              <Tooltip cursor={{ stroke: chart.c3, strokeWidth: 1 }} content={<TimeTip />} />
              <Area type="monotone" dataKey="neg" stackId="t" stroke="none" fill="var(--negative)" fillOpacity={0.16} isAnimationActive={false} />
              <Area type="monotone" dataKey="neu" stackId="t" stroke="none" fill="var(--color-stone-500)" fillOpacity={0.07} isAnimationActive={false} />
              <Area type="monotone" dataKey="pos" stackId="t" stroke="none" fill="var(--ink)" fillOpacity={0.2} isAnimationActive={false} />
              <ReferenceLine x={fmtDay(run.date)} stroke="var(--ink)" strokeWidth={1} strokeDasharray="3 3" />
              <Line type="monotone" dataKey="score" stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" animationDuration={500}
                dot={(p) => (
                  <g key={p.index} onClick={(ev) => { ev.stopPropagation(); onPick(p.payload.id) }} style={{ cursor: 'pointer' }} data-run={p.payload.id}>
                    <circle cx={p.cx} cy={p.cy} r={14} fill="transparent" />
                    <circle cx={p.cx} cy={p.cy} r={p.payload.id === run.id ? 5 : 3} fill="var(--ink)" stroke="var(--color-surface)" strokeWidth={p.payload.id === run.id ? 2 : 0} />
                  </g>
                )}
                activeDot={{ r: 6, fill: 'var(--ink)', stroke: 'var(--color-surface)', strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
function TimeTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-raised px-3 py-2 text-small shadow-sm tabular-nums">
      <div className="font-semibold text-stone-900">{fmtDay(r.date)} · score {r.score}{r.delta != null && <span className={`ml-1.5 font-medium ${r.delta < 0 ? 'text-negative' : 'text-stone-600'}`}>{r.delta > 0 ? '▲' : r.delta < 0 ? '▼' : ''}{r.delta ? Math.abs(r.delta) : 'no change'}</span>}</div>
      <div className="mt-0.5 text-stone-600">{r.counts.positive} positive · {r.counts.neutral} neutral · <span className={r.counts.negative ? 'text-negative' : undefined}>{r.counts.negative} negative</span> pages</div>
    </div>
  )
}

// ---- every page: collapsed; a compact list, synced with every filter above, sortable, no header band
const SORTS = [{ value: 'tone', label: 'Tone' }, { value: 'title', label: 'Title' }, { value: 'engines', label: 'Engines' }]
function AllPages({ pages, lit, filtered }) {
  const [open, setOpen] = useState(false)
  const [sort, setSort] = useState('tone')
  const rows = sortPages(pages.filter((p) => lit.has(p.id)), sort, sort === 'engines' ? 'desc' : 'asc')
  return (
    <section aria-label="All pages" className="border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" aria-expanded={open} aria-controls="all-pages" onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded text-[15px] leading-[22px] font-semibold text-stone-900 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
          {filtered ? 'Pages that match' : `All ${pages.length} pages`}
          <ChevronDown size={16} className={`transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {open && <Segmented label="Sort pages" size="sm" value={sort} onChange={setSort} options={SORTS} />}
      </div>
      <div id="all-pages" className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} inert={open ? undefined : ''}>
        <ul className="relative overflow-hidden">
          {rows.map((p) => (
            <li key={p.id} className="border-b border-[var(--div)] last:border-0">
              <button type="button" onClick={() => openDrawer('page', p.id)}
                className="group -mx-2 grid w-[calc(100%+16px)] grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus md:grid-cols-[20px_minmax(0,1fr)_96px_80px]">
                <SiteLogo domain={p.domain} name={p.domain} className="h-5 w-5 rounded !border-0" imgPad="p-0" initialClass="text-[10px]" />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{p.title}</span>
                  <span className={`flex items-center gap-2 text-[12px] leading-4 ${t3}`}><span className="truncate">{p.domain}</span><span className="md:hidden"><EngineMarks ids={p.engines} size={12} /></span></span>
                </span>
                <span className="hidden md:block"><EngineMarks ids={p.engines} /></span>
                <span className={`text-right text-[13px] leading-[18px] ${TONE_TEXT[p.tone]} ${p.tone === 'negative' ? 'font-medium' : ''}`}>{TONE_LABEL[p.tone]}</span>
              </button>
            </li>
          ))}
          {!rows.length && <li className={`py-6 text-[14px] leading-5 ${t2}`}>No pages match these filters.</li>}
        </ul>
      </div>
    </section>
  )
}

// the drawer: every quote from the page, the phrase marked; a link out
function PageDrawer({ pages, brand }) {
  const map = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages])
  const drawer = useDrawer('page', (id) => map.get(id) ?? null)
  const p = drawer.item
  if (!p) return null
  return (
    <DrawerShell drawer={drawer} title={p.title}
      meta={<span className="flex flex-wrap items-center gap-2"><span>{p.domain}</span><Dot /><span className={TONE_TEXT[p.tone]}>{TONE_LABEL[p.tone]}</span><Dot /><EngineMarks ids={p.engines} /></span>}
      footer={<><a href={`https://${p.domain}${p.path}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded font-medium text-stone-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Open page <ArrowUpRight size={14} aria-hidden /><span className="sr-only">(opens in a new tab)</span></a><span /></>}>
      <section className="mt-5">
        <h3 className="text-[14px] leading-5 font-semibold text-stone-900">What it says about {brand.name}</h3>
        <ul className="mt-2 divide-y divide-[var(--div)] border-y border-[var(--div)]">
          {p.sentences.map((s) => (
            <li key={s.text} className="flex gap-3 py-3">
              <span className="w-[3px] shrink-0 self-stretch rounded-full" style={{ background: RING[s.tone] }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-6 text-stone-900"><Phrase s={s} /></span>
                <span className={`mt-1 block text-[12px] leading-4 ${TONE_TEXT[s.tone]}`}>{TONE_LABEL[s.tone]}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </DrawerShell>
  )
}
