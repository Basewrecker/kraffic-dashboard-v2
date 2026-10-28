import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Check, ChevronDown, RefreshCw, SearchX, Smile } from 'lucide-react'
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
import { useIsMobile } from '../../hooks/useMedia'
import {
  TONES, TONE_LABEL, countTones, heroLine, runPages, scoreOf, sentimentFor, sentimentInsight, sortPages, tonePercents, withScores,
} from '../../data/sentiment'
import { biggestChange, groupThemes, layoutSwarm, lanesFor, listPage, matchIds, neighbour, runAt, scoreX, stepKey, tellingSentence, themeDetail, themeEngines } from '../../utils/spectrum'
import { fmtDay, lineBtn, t2, t3 } from './parts'

// /sentiment: one visual page about how third-party pages talk about the brand.
//   Header · the spectrum (every page a dot, placed by tone; hover for a quote, click for all of them; split by engine)
//   with a timeline scrubber (a run swaps the dots) · one insight · What AI reads about you (themes that hurt / work,
//   list + detail; a theme lights its pages, a dot selects its theme) · All pages (collapsed, synced with the filters).
// Production gives each page a tone only (no number), so dots sit in three bands. Data and logic: data/sentiment.js,
// utils/spectrum.js. States: ?mock=never | running | nopages | error | one | calm (no negative pages).
// Fallbacks: ?themes=unlinked (themes not linked to pages) · ?quotes=none (pages analysed before quotes were kept).

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
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
  const [side, setSide] = useState(null) // null = the default: Hurting you, or Working for you when nothing hurts
  const [picked, setPicked] = useState({}) // the selected theme per side (default: each side's first)
  const [lighting, setLighting] = useState(false) // the selected theme lights the spectrum once someone picks one
  const [hoverTheme, setHoverTheme] = useState(null)
  const [runId, setRunId] = useState(null) // null = the latest run
  const [confirm, setConfirm] = useState(false)
  const [running, setRunning] = useState(mock === 'running')
  const [toastNode, toast] = useToast({ position: 'center' })
  const hero = useRef(null)
  const reads = useRef(null)
  const brand = brandByDomain(domain)

  const data = sentimentFor(domain, account.domain)
  const never = mock === 'never' || !data.runs.length
  // ?mock=calm: the same run with its negative pages read as neutral · ?quotes=none: every page analysed before quotes
  const noQuotes = q.get('quotes') === 'none'
  const latestPages = data.pages
    .map((p) => (mock === 'calm' && p.tone === 'negative' ? { ...p, tone: 'neutral' } : p))
    .map((p) => (noQuotes ? { ...p, sentences: [], noQuote: true } : p))
  const baseRuns = mock === 'one' ? data.runs.slice(-1) : data.runs
  const runs = withScores(mock === 'calm' ? [...baseRuns.slice(0, -1), { ...baseRuns.at(-1), counts: countTones(latestPages) }] : baseRuns)
  const latest = runs.at(-1)
  const run = runs.find((r) => r.id === runId) ?? latest
  const isLatest = run === latest
  const pages = isLatest ? latestPages : runPages(latestPages, run.counts, run.id)

  // What AI reads about you: the latest run's themes (?mock=calm has nothing hurting)
  const unlinked = q.get('themes') === 'unlinked'
  const swot = mock === 'calm' && data.swot ? { ...data.swot, weaknesses: [], threats: [] } : data.swot
  const groups = groupThemes(swot, latestPages)
  const calm = !groups.hurting.length
  const tab = side ?? (calm ? 'working' : 'hurting')
  const selected = groups[tab].find((t) => t.theme === picked[tab]) ?? groups[tab][0] ?? null
  const linking = isLatest && !unlinked // themes are the latest run's
  const shown = linking ? hoverTheme ?? (lighting ? selected : null) : null
  const lit = matchIds(pages, { engine, tone, theme: shown })
  useEffect(() => { setRunId(null); setTone(null); setSide(null); setPicked({}); setLighting(false) }, [domain])

  const select = (t, s = tab) => { setPicked((cur) => ({ ...cur, [s]: t.theme })); setLighting(true) }
  // a dot's theme: on its own side first (a positive page → Working for you), else the other side
  const themeOf = (page) => {
    const order = page.tone === 'positive' ? ['working', 'hurting'] : ['hurting', 'working']
    for (const s of order) { const t = groups[s].find((x) => x.sources.includes(page.id)); if (t) return { t, s } }
    return null
  }
  // a dot in the hero: selects its theme below (switching the side if needed), else opens its drawer
  const onDot = (page) => {
    const hit = linking ? themeOf(page) : null
    if (!hit) { openDrawer('page', page.id); return }
    setSide(hit.s)
    select(hit.t, hit.s)
    const r = reads.current?.getBoundingClientRect()
    if (r && (r.top > window.innerHeight * 0.75 || r.bottom < 0)) reads.current.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' })
  }
  const themeFor = (page) => (linking ? themeOf(page)?.t ?? null : null)
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
        split={split} setSplit={setSplit} tone={tone} setTone={setTone} theme={shown} clearTheme={() => { setLighting(false); setHoverTheme(null) }} onDot={onDot} themeFor={themeFor}
        scrubber={<Scrubber runs={runs} run={run} onPick={(id) => setRunId(id === latest.id ? null : id)} />} />
      {swot && (
        <AiReads refEl={reads} groups={groups} tab={tab} setTab={setSide} selected={selected} onSelect={select} onHover={(t) => setHoverTheme(linking ? t : null)}
          unlinked={unlinked} pages={latestPages} latest={latest} calm={calm} linking={linking} isLatest={isLatest} onLatest={() => setRunId(null)} lit={shown?.theme} />
      )}
      <AllPages pages={pages} lit={lit} filtered={engine !== 'all' || tone || shown} />
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
function Hero({ heroRef, prevDate, brand, run, isLatest, onLatest, pages, lit, engine, split, setSplit, tone, setTone, theme, clearTheme, onDot, themeFor, scrubber }) {
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
          <Spectrum pages={pages} lit={lit} engine={engine} split={split} score={score} onDot={onDot} themeFor={themeFor} />
          <Legend c={c} tone={tone} setTone={setTone} explain={explain} />
          {scrubber}
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
function Spectrum({ pages, lit, engine, split, score, onDot = (p) => openDrawer('page', p.id), themeFor = () => null }) {
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
              aria-label={`${d.page.title}, ${d.page.domain}: ${TONE_LABEL[d.page.tone].toLowerCase()}. ${themeFor(d.page) ? `Open “${themeFor(d.page).theme}” below` : 'Open its quotes'}`}
              onClick={(e) => { setHover(null); onDot(d.page); e.currentTarget.blur() }}
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
        {hover && <HoverCard hover={hover} w={w} r={r} theme={themeFor(hover.page)} />}
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
function HoverCard({ hover, w, r, theme }) {
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
      {s ? <p className="mt-2.5 text-[13px] leading-5 text-stone-900"><Phrase s={s} tone={p.tone} /></p> : <p className={`mt-2.5 text-[13px] leading-5 ${t3}`}>Quote appears after the next analysis</p>}
      <p className={`mt-2 text-[12px] leading-4 ${t3}`}>{theme ? <>Click to open “{theme.theme}” below</> : 'Click for every quote'}</p>
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

// ---- what AI reads about you: Hurting you | Working for you (a segmented control), the side's themes on the left (at
// most five; more page in with "More themes ↓"), ONE detail on the right: a quote, its page, the other pages, Open page.
// Hover or select a theme: its pages light up in the spectrum (latest run only). ?themes=unlinked: no theme → page links.
const ROW_H = 64
const LIST = 5
const KIND_LABEL = { strength: 'Strength', weakness: 'Weakness', opportunity: 'Opportunity', threat: 'Threat' }
function AiReads({ refEl, groups, tab, setTab, selected, onSelect, onHover, unlinked, pages, latest, calm, linking, isLatest, onLatest, lit }) {
  const [pageBy, setPageBy] = useState({})
  const [focus, setFocus] = useState(0)
  const rows = useRef([])
  const hurting = tab === 'hurting'
  const list = groups[tab]
  const pg = listPage(list, pageBy[tab] ?? 0, LIST)
  // keep the selected theme's page in view when it's picked from the spectrum
  useEffect(() => {
    const i = list.indexOf(selected)
    if (i >= 0 && Math.floor(i / LIST) !== pg.page) setPageBy((cur) => ({ ...cur, [tab]: Math.floor(i / LIST) }))
  }, [selected, tab]) // eslint-disable-line react-hooks/exhaustive-deps
  const flip = (to) => { setPageBy((cur) => ({ ...cur, [tab]: to })); setFocus(0) }
  const onKey = (e, i) => {
    const j = stepKey(i, e.key, pg.items.length)
    if (j == null || e.key === 'ArrowLeft' || e.key === 'ArrowRight') return
    e.preventDefault()
    setFocus(j)
    rows.current[j]?.focus()
  }
  const listH = LIST * ROW_H + (pg.pages > 1 ? 44 : 0)
  return (
    <section ref={refEl} aria-labelledby="reads-h" className="scroll-mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="reads-h" className={h2}>What AI reads about you</h2>
          <p className={`mt-0.5 text-[13px] leading-[18px] ${t3}`}>
            {isLatest ? `Themes from the ${fmtDay(latest.date)} run` : <>Themes are from the latest run ({fmtDay(latest.date)}), so they don’t light the spectrum · <button type="button" onClick={onLatest} className="rounded font-medium text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">back to latest</button></>}
          </p>
        </div>
        <Segmented label="Side" size="sm" value={tab} onChange={(v) => { setTab(v); setFocus(0) }} options={[{ value: 'hurting', label: 'Hurting you' }, { value: 'working', label: 'Working for you' }]} className="max-sm:w-full" full={false} />
      </div>
      {hurting && calm ? (
        <p className="mt-4 flex items-center gap-2 border-t border-line pt-5 text-[15px] leading-[22px] text-stone-900"><Check size={16} className="text-ink" aria-hidden />Nothing negative this run</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 border-t border-line md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* the list: same height whatever the side (five rows, plus the pager when there are more) */}
          <div className="md:border-r md:border-line md:pr-6" style={{ minHeight: listH }}>
            <ul role="listbox" aria-label={hurting ? 'Themes hurting you' : 'Themes working for you'} className="divide-y divide-[var(--div)]">
              {pg.items.map((t, i) => {
                const on = !unlinked && t === selected
                return (
                  <li key={t.theme} role="presentation">
                    <button ref={(el) => { rows.current[i] = el }} type="button" role="option" aria-selected={on} tabIndex={i === Math.min(focus, pg.items.length - 1) ? 0 : -1}
                      onClick={() => onSelect(t)} onKeyDown={(e) => onKey(e, i)} onFocus={() => { setFocus(i); onHover(t) }} onBlur={() => onHover(null)}
                      onMouseEnter={() => onHover(t)} onMouseLeave={() => onHover(null)} disabled={unlinked}
                      className={`relative flex w-full flex-col justify-center gap-1 px-3 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus disabled:cursor-default ${on ? 'bg-tint' : unlinked ? '' : 'hover:bg-tint'} ${lit === t.theme && !on ? 'bg-tint' : ''}`}
                      style={{ height: ROW_H }}>
                      {on && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-ink" aria-hidden />}
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="truncate text-[15px] leading-[22px] font-semibold text-stone-900">{t.theme}</span>
                        {(t.kind === 'opportunity' || t.kind === 'threat') && <span className={`shrink-0 text-[13px] ${t3}`}>{t.kind}</span>}
                      </span>
                      {!unlinked && (
                        <span className={`flex min-w-0 items-center gap-2 text-[12px] leading-4 ${t3}`}>
                          <Favicons pages={t.pages} />
                          <span className="truncate tabular-nums">{plural(t.pages.length, 'page')} · {themeEngines(t).map((e) => (e === 'google' ? 'Google' : engineName(e))).join(', ')}</span>
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
            {pg.pages > 1 && (
              <button type="button" onClick={() => flip(pg.page + 1 < pg.pages ? pg.page + 1 : 0)}
                className={`flex h-11 w-full items-center gap-1.5 border-t border-[var(--div)] px-3 text-[13px] font-medium ${t2} outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus`}>
                {/* no digits here: the counts already sit on the rows */}
                {pg.rest > 0 ? <>More themes <ChevronDown size={14} aria-hidden /></> : <>Back to the top <ChevronDown size={14} className="rotate-180" aria-hidden /></>}
              </button>
            )}
          </div>
          {/* the detail: one theme, one quote */}
          <div className="max-md:border-t max-md:border-line max-md:pt-5 md:pl-8">
            {unlinked
              ? <UnlinkedDetail pages={pages.filter((p) => p.tone === (hurting ? 'negative' : 'positive'))} hurting={hurting} />
              : selected && <Detail key={selected.theme} t={selected} hurting={hurting} linking={linking} />}
          </div>
        </div>
      )}
    </section>
  )
}

const Favicons = ({ pages, size = 'h-4 w-4', inner = 'h-3 w-3' }) => (
  <span className="flex shrink-0 -space-x-1" aria-hidden>
    {pages.slice(0, 4).map((p) => (
      <span key={p.id} className={`grid ${size} place-items-center overflow-hidden rounded-full ring-2 ring-surface`} style={{ background: '#fff' }}>
        <SiteLogo domain={p.domain} name={p.domain} className={`${inner} rounded-full !border-0 !bg-transparent`} imgPad="p-0" initialClass="text-[7px] !text-[#44403c]" bordered={false} />
      </span>
    ))}
  </span>
)

// one theme: the quote (or, for a page analysed before quotes were stored, its title and a note), whose page it is,
// the other pages that say it, and Open page
function Detail({ t, hurting }) {
  const d = themeDetail(t)
  if (!d) return null
  return (
    <div className="flex h-full flex-col justify-center py-6 motion-safe:animate-[card-in_220ms_ease-out]">
      <span className={`text-[13px] leading-[18px] ${t3}`}>{KIND_LABEL[t.kind]} · {t.theme}</span>
      {d.quote ? (
        <blockquote className="mt-3 text-[22px] leading-[32px] font-medium tracking-[-0.01em] text-stone-900 max-md:text-[19px] max-md:leading-7 [text-wrap:pretty]">
          <Phrase s={d.quote} tone={hurting ? 'negative' : 'positive'} />
        </blockquote>
      ) : (
        <div className="mt-3">
          <p className="text-[20px] leading-[28px] font-medium text-stone-900 [text-wrap:pretty]">{d.page.title}</p>
          <p className={`mt-1 text-[13px] leading-[18px] ${t3}`}>Quote appears after the next analysis</p>
        </div>
      )}
      <button type="button" onClick={() => openDrawer('page', d.page.id)} className={`mt-3 inline-flex items-center gap-2 self-start rounded text-[13px] leading-[18px] ${t2} outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus`}>
        <SiteLogo domain={d.page.domain} name={d.page.domain} className="h-4 w-4 rounded-full !border-0" imgPad="p-0" initialClass="text-[8px]" />
        <span className="font-medium text-stone-900">{d.page.domain}</span><EngineMarks ids={d.page.engines} size={12} />
      </button>
      {d.also.length > 0 && (
        <div className={`mt-4 flex flex-wrap items-center gap-2 text-[13px] leading-[18px] ${t3}`}>
          Also said on
          {d.also.map((p) => (
            <button key={p.id} type="button" onClick={() => openDrawer('page', p.id)} title={p.domain} aria-label={`${p.domain}: every quote`}
              className="grid h-6 w-6 place-items-center rounded-full outline-none ring-1 ring-line transition-shadow hover:ring-ink focus-visible:ring-2 focus-visible:ring-focus" style={{ background: '#fff' }}>
              <SiteLogo domain={p.domain} name={p.domain} className="h-4 w-4 rounded-full !border-0 !bg-transparent" imgPad="p-0" initialClass="text-[8px] !text-[#44403c]" bordered={false} />
            </button>
          ))}
        </div>
      )}
      <div className="pt-6">
        <a href={`https://${d.page.domain}${d.page.path}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded text-[14px] font-medium text-stone-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">
          Open page <ArrowUpRight size={14} aria-hidden /><span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </div>
  )
}

// fallback without theme → page links: the quote comes from the side's own pages instead
function UnlinkedDetail({ pages, hurting }) {
  const p = pages.find((x) => tellingSentence(x)) ?? pages[0]
  if (!p) return <p className={`py-5 text-[14px] leading-5 ${t2}`}>No {hurting ? 'negative' : 'positive'} pages this run.</p>
  const s = tellingSentence(p)
  return (
    <div className="flex h-full flex-col justify-center py-6">
      <span className={`text-[13px] leading-[18px] ${t3}`}>A {hurting ? 'negative' : 'positive'} page says</span>
      {s ? <blockquote className="mt-3 text-[22px] leading-[32px] font-medium tracking-[-0.01em] text-stone-900 max-md:text-[19px] max-md:leading-7 [text-wrap:pretty]"><Phrase s={s} tone={hurting ? 'negative' : 'positive'} /></blockquote>
        : <div className="mt-3"><p className="text-[20px] leading-[28px] font-medium text-stone-900">{p.title}</p><p className={`mt-1 text-[13px] ${t3}`}>Quote appears after the next analysis</p></div>}
      <button type="button" onClick={() => openDrawer('page', p.id)} className={`mt-3 inline-flex items-center gap-2 self-start rounded text-[13px] ${t2} outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus`}>
        <SiteLogo domain={p.domain} name={p.domain} className="h-4 w-4 rounded-full !border-0" imgPad="p-0" initialClass="text-[8px]" /><span className="font-medium text-stone-900">{p.domain}</span>
      </button>
      <p className={`mt-4 text-[13px] leading-[18px] ${t3}`}>These themes aren’t linked to pages, so this quote isn’t tied to the one selected.</p>
      <div className="pt-6">
        <a href={`https://${p.domain}${p.path}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded text-[14px] font-medium text-stone-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Open page <ArrowUpRight size={14} aria-hidden /></a>
      </div>
    </div>
  )
}

// ---- the timeline scrubber (in the hero, under the legend): one marker per run, the selected one a dot without its
// number (the big score says it). Click or drag along the track to move; ←/→, Home/End when focused. The biggest move
// is marked once.
function Scrubber({ runs, run, onPick }) {
  const track = useRef(null)
  const [w, setW] = useState(600)
  const [tip, setTip] = useState(null) // index under the pointer / while dragging
  const drag = useRef(false)
  useLayoutEffect(() => {
    if (!track.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(track.current)
    return () => ro.disconnect()
  }, [])
  if (runs.length < 2) return <p className={`mt-5 text-[13px] leading-[18px] ${t3}`}>First run {fmtDay(runs[0].date)}</p>
  const n = runs.length
  const sel = runs.indexOf(run)
  const x = (i) => (i / (n - 1)) * w
  const at = (e) => runAt(e.clientX - track.current.getBoundingClientRect().left, w, n)
  const big = biggestChange(runs)
  const narrow = w < 340
  const onKey = (e) => {
    const j = stepKey(sel, e.key, n)
    if (j == null) return
    e.preventDefault()
    onPick(runs[j].id)
    setTip(null)
  }
  return (
    <div className="mt-6">
      <div className={`mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-[12px] leading-4 ${t3}`}>
        <span>Runs</span>
        {big && <span>Biggest move after {fmtDay(runs[big.index - 1].date)}: {big.what}</span>}
      </div>
      <div className="px-6">
        <div ref={track} role="slider" tabIndex={0} aria-label="Run" aria-valuemin={1} aria-valuemax={n} aria-valuenow={sel + 1}
          aria-valuetext={`${fmtDay(run.date)}, score ${run.score}`}
          onKeyDown={onKey}
          onPointerDown={(e) => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); const j = at(e); setTip(j); onPick(runs[j].id) }}
          onPointerMove={(e) => { const j = at(e); setTip(j); if (drag.current && runs[j].id !== run.id) onPick(runs[j].id) }}
          onPointerUp={() => { drag.current = false }} onPointerCancel={() => { drag.current = false }} onPointerLeave={() => { if (!drag.current) setTip(null) }}
          onBlur={() => setTip(null)}
          className="relative h-[68px] cursor-pointer touch-none select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4">
          {/* the track, the biggest move's segment in ink */}
          <div className="absolute inset-x-0 top-[30px] h-px bg-[var(--color-line-strong)]" aria-hidden />
          {big && (
            <>
              <div className="absolute top-[29px] h-[3px] rounded-full bg-ink" style={{ left: x(big.index - 1), width: x(big.index) - x(big.index - 1) }} aria-hidden />
              <span className="absolute top-[34px] -translate-x-1/2 text-[12px] leading-4 font-semibold text-ink tabular-nums" style={{ left: (x(big.index - 1) + x(big.index)) / 2 }} aria-hidden>
                {big.delta > 0 ? '+' : '−'}{Math.abs(big.delta)}
              </span>
            </>
          )}
          {runs.map((r, i) => {
            const on = i === sel
            return (
              <div key={r.id} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: x(i) }} aria-hidden>
                <span className={`h-4 text-[12px] leading-4 tabular-nums ${on ? 'invisible' : t2}`}>{r.score}</span>
                <span className="mt-[6px] grid h-4 w-4 place-items-center">
                  <span className={`rounded-full transition-all duration-200 ${on ? 'h-3.5 w-3.5 bg-ink ring-4 ring-[color-mix(in_srgb,var(--ink)_14%,transparent)]' : tip === i ? 'h-2.5 w-2.5 bg-ink' : 'h-2 w-2 bg-[var(--color-stone-400)]'}`} />
                </span>
                <span className={`mt-[18px] whitespace-nowrap text-[12px] leading-4 tabular-nums ${on ? 'font-semibold text-ink' : t3}`}>{narrow && i % 2 && !on && i !== n - 1 ? '' : fmtDay(r.date)}</span>
              </div>
            )
          })}
          {tip != null && (
            <div role="tooltip" className="pointer-events-none absolute bottom-full z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-raised px-3 py-2 text-small shadow-md tabular-nums"
              style={{ left: Math.max(110, Math.min(w - 110, x(tip))) }}>
              <div className="font-semibold text-stone-900">{fmtDay(runs[tip].date)} · {runs[tip].score}{runs[tip].delta != null && <span className={`ml-1.5 font-medium ${runs[tip].delta < 0 ? 'text-negative' : 'text-stone-600'}`}>{runs[tip].delta > 0 ? '▲' : runs[tip].delta < 0 ? '▼' : ''}{runs[tip].delta ? Math.abs(runs[tip].delta) : 'no change'}</span>}</div>
              <div className="mt-0.5 text-stone-600">{runs[tip].counts.positive} positive · {runs[tip].counts.neutral} neutral · <span className={runs[tip].counts.negative ? 'text-negative' : undefined}>{runs[tip].counts.negative} negative</span> pages</div>
            </div>
          )}
        </div>
      </div>
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
        {!p.sentences.length && <p className={`mt-2 border-y border-[var(--div)] py-4 text-[14px] leading-5 ${t2}`}>This page was analysed before quotes were kept. Quotes appear after the next analysis.</p>}
        <ul className={`mt-2 divide-y divide-[var(--div)] border-y border-[var(--div)] ${p.sentences.length ? '' : 'hidden'}`}>
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
