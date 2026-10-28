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
import { biggestChange, byReach, divergingStack, groupThemes, layoutSwarm, lanesFor, leadQuote, matchIds, moveNote, neighbour, reachOf, scoreX, tellingSentence, themeEngines, themeQuote, themeQuoteOf, toggleOpen, toneChanges, topChange } from '../../utils/spectrum'
import { fmtDay, lineBtn, t2, t3 } from './parts'

// /sentiment: one visual page about how third-party pages talk about the brand.
//   Header · the spectrum (every page a dot, placed by tone; hover for a quote, click for all of them; split by engine)
//   · one insight · What AI reads about you (themes that hurt / work; a theme lights its pages, a dot opens its theme)
//   · Over time (each run's pages as dots + the score; a run swaps the spectrum to it) · All pages (collapsed, synced).
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
  const [openKey, setOpenKey] = useState(null) // the one open theme row, across both columns
  const [hoverTheme, setHoverTheme] = useState(null)
  const [runId, setRunId] = useState(null) // null = the latest run
  const [confirm, setConfirm] = useState(false)
  const [running, setRunning] = useState(mock === 'running')
  const [toastNode, toast] = useToast({ position: 'center' })
  const hero = useRef(null)
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
  const pagesOf = (r) => (r === latest ? latestPages : runPages(latestPages, r.counts, r.id))
  const pages = pagesOf(run)
  useEffect(() => { setRunId(null); setOpenKey(null); setTone(null) }, [domain])

  // What AI reads about you: themes from the latest run (?mock=calm has nothing hurting)
  const unlinked = q.get('themes') === 'unlinked'
  const swot = mock === 'calm' && data.swot ? { ...data.swot, weaknesses: [], threats: [] } : data.swot
  const groups = groupThemes(swot, latestPages)
  const all = [...groups.hurting, ...groups.working]
  const openTheme = all.find((t) => t.theme === openKey) ?? null
  // hover or open a theme: its pages light up in the hero (latest run only; no scrolling)
  const linking = isLatest && !unlinked
  const shown = linking ? hoverTheme ?? openTheme : null
  const lit = matchIds(pages, { engine, tone, theme: shown })

  // a dot's theme: on its own side first (a positive page → Working for you), else the other side
  const themeOf = (page) => {
    const sides = page.tone === 'positive' ? [groups.working, groups.hurting] : [groups.hurting, groups.working]
    return sides.flat().find((x) => x.sources.includes(page.id)) ?? null
  }
  // a dot in the hero: opens its row below, or its drawer when no theme cites it
  const onDot = (page) => {
    const t = linking ? themeOf(page) : null
    if (!t) { openDrawer('page', page.id); return }
    setOpenKey(t.theme)
    requestAnimationFrame(() => document.getElementById(`theme-${t.theme.toLowerCase().replace(/[^a-z]+/g, '-')}`)?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest' }))
  }
  const themeFor = (page) => (linking ? themeOf(page) : null)
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
    // one spacing system: 64px between sections, 24px inside them (the header belongs with the hero)
    <div className="flex flex-col gap-16">
      <div className="flex flex-col gap-6">
        {header}
        {mock === 'error' && (
          <ErrorCard title="The latest run didn’t finish" reason={`Google search credits are used up, so no pages could be found and nothing was charged. Below: the ${fmtDay(latest.date)} run.`} onRetry={() => setConfirm(true)} />
        )}
      <Hero heroRef={hero} prevDate={runs[runs.indexOf(run) - 1]?.date} brand={brand} run={run} isLatest={isLatest} onLatest={() => setRunId(null)} pages={pages} lit={lit} engine={engine}
        split={split} setSplit={setSplit} tone={tone} setTone={setTone} theme={shown} clearTheme={() => { setOpenKey(null); setHoverTheme(null) }} onDot={onDot} themeFor={themeFor} />
      </div>
      {swot && (
        <AiReads groups={groups} unlinked={unlinked} pages={latestPages} openKey={openKey} onToggle={(t) => setOpenKey((k) => toggleOpen(k, t.theme))} onClose={() => setOpenKey(null)}
          lit={shown?.theme} onHover={(t) => setHoverTheme(linking ? t : null)} latest={latest} isLatest={isLatest} />
      )}
      <OverTime runs={runs} run={run} pagesOf={pagesOf} onPick={(id) => setRunId(id === latest.id ? null : id)} />
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
function Hero({ heroRef, prevDate, brand, run, isLatest, onLatest, pages, lit, engine, split, setSplit, tone, setTone, theme, clearTheme, onDot, themeFor }) {
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

// ---- what AI reads about you: two columns, each led by its strongest quote, then every theme sorted by reach (the
// share of analysed pages that say it). Hover a row: a floating preview of its best quote, and its pages light up in
// the spectrum. Click (or Enter) opens it in place to up to three quotes; one open at a time; Esc closes.
// ?themes=unlinked: no theme → page links (themes as plain rows, the lead quotes from the side's own pages).
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '-')
function AiReads({ groups, unlinked, pages, openKey, onToggle, onClose, lit, onHover, latest, isLatest }) {
  const total = pages.length
  // the bars are scaled to the most widespread theme on either side (exact "N of M pages" in each bar's tooltip)
  const top = Math.max(1, ...[...groups.hurting, ...groups.working].map((t) => t.pages.length))
  const side = (key) => {
    const hurting = key === 'hurting'
    const tone = hurting ? 'negative' : 'positive'
    const themes = byReach(groups[key])
    return { hurting, tone, themes, lead: leadQuote(unlinked ? [] : themes, pages, tone) }
  }
  const H = side('hurting'), W = side('working')
  const head = (s) => (
    <h3 className="flex items-baseline gap-2 border-b border-line pb-2 text-[14px] leading-5 font-medium">
      <span className={s.hurting ? 'text-negative' : 'text-ink'}>{s.hurting ? 'Hurting you' : 'Working for you'}</span>
      <span className={`tabular-nums ${t3}`}>{s.themes.length}</span>
    </h3>
  )
  const lead = (s) => (
    s.lead ? (
      <figure className="pt-5 pb-6">
        {s.lead.quote
          ? <blockquote className="text-[20px] leading-[30px] font-medium tracking-[-0.01em] text-stone-900 max-md:text-[18px] max-md:leading-7 [text-wrap:pretty]"><Phrase s={s.lead.quote} tone={s.tone} /></blockquote>
          : <><p className="text-[20px] leading-[30px] font-medium text-stone-900">{s.lead.page.title}</p><p className={`mt-1 text-[13px] leading-[18px] ${t3}`}>Quote appears after the next analysis</p></>}
        <figcaption className="mt-3"><Source page={s.lead.page} /></figcaption>
      </figure>
    ) : <p className={`flex items-center gap-2 pt-5 pb-6 text-[15px] leading-[22px] text-stone-900`}><Check size={16} className="text-ink" aria-hidden />{s.hurting ? 'Nothing negative this run' : 'No positive pages this run'}</p>
  )
  const list = (s) => (
    unlinked ? (
      <ul className="border-t border-[var(--div)]">
        {s.themes.map((t) => (
          <li key={t.theme} className="flex h-[52px] items-center gap-2 border-b border-[var(--div)] text-[15px] font-medium text-stone-900">
            <span className="truncate">{t.theme}</span>{(t.kind === 'opportunity' || t.kind === 'threat') && <span className={`text-[13px] font-normal ${t3}`}>{t.kind}</span>}
          </li>
        ))}
      </ul>
    ) : (
      <ul className="border-t border-[var(--div)]">
        {s.themes.map((t) => (
          <ThemeRow key={t.theme} t={t} hurting={s.hurting} reach={reachOf(t, total)} scale={t.pages.length / top} total={total} open={openKey === t.theme} lit={lit === t.theme}
            onToggle={() => onToggle(t)} onClose={onClose} onHover={onHover} />
        ))}
      </ul>
    )
  )
  // desktop: the two heads, the two leads and the two lists line up in rows; phones: Hurting you (all of it) first
  return (
    <section aria-labelledby="reads-h">
      <h2 id="reads-h" className={h2}>What AI reads about you</h2>
      {!isLatest && <p className={`mt-1 text-[13px] leading-[18px] ${t3}`}>Themes are from the latest run, {fmtDay(latest.date)}.</p>}
      <div className="mt-6 grid grid-cols-1 gap-x-12 md:grid-cols-2">
        <div className="order-1 md:order-none">{head(H)}</div>
        <div className="order-4 mt-10 md:order-none md:mt-0">{head(W)}</div>
        <div className="order-2 md:order-none">{lead(H)}</div>
        <div className="order-5 md:order-none">{lead(W)}</div>
        <div className="order-3 md:order-none">{list(H)}</div>
        <div className="order-6 md:order-none">{list(W)}</div>
      </div>
    </section>
  )
}

const OpenPage = ({ page }) => (
  <a href={`https://${page.domain}${page.path}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded text-[13px] font-medium text-stone-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">
    Open page <ArrowUpRight size={14} aria-hidden /><span className="sr-only">(opens in a new tab)</span>
  </a>
)
// a quote's source: favicon + domain (opens the page's drawer, every quote) and Open page
const Source = ({ page }) => (
  <span className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-[18px] ${t3}`}>
    <button type="button" onClick={() => openDrawer('page', page.id)} className="inline-flex items-center gap-1.5 rounded outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
      <SiteLogo domain={page.domain} name={page.domain} className="h-3.5 w-3.5 rounded-full !border-0" imgPad="p-0" initialClass="text-[7px]" />{page.domain}
    </button>
    <OpenPage page={page} />
  </span>
)
const Favicons = ({ pages }) => (
  <span className="flex shrink-0 -space-x-1" aria-hidden>
    {pages.slice(0, 3).map((p) => (
      <span key={p.id} className="grid h-4 w-4 place-items-center overflow-hidden rounded-full ring-2 ring-surface" style={{ background: '#fff' }}>
        <SiteLogo domain={p.domain} name={p.domain} className="h-3 w-3 rounded-full !border-0 !bg-transparent" imgPad="p-0" initialClass="text-[7px] !text-[#44403c]" bordered={false} />
      </span>
    ))}
  </span>
)
const QuoteOrTitle = ({ page, s, tone, size = 'text-[15px] leading-6' }) => (s
  ? <p className={`${size} text-stone-900 [text-wrap:pretty]`}><Phrase s={s} tone={tone} /></p>
  : <><p className={`${size} text-stone-900`}>{page.title}</p><p className={`text-[12px] leading-4 ${t3}`}>Quote appears after the next analysis</p></>)

// a theme row: 52px collapsed (theme · suffix | favicons, reach bar, engines); hover / focus: a floating preview;
// open: up to three quotes with their sources
function ThemeRow({ t, hurting, reach, scale, total, open, lit, onToggle, onClose, onHover }) {
  const id = `theme-${slug(t.theme)}`
  const [preview, setPreview] = useState(false)
  const best = themeQuoteOf(t)
  const quotes = t.pages.slice(0, 3).map((p) => ({ p, s: themeQuote(p, t) }))
  const tone = hurting ? 'negative' : 'positive'
  const enter = () => { setPreview(true); onHover(t) }
  const leave = () => { setPreview(false); onHover(null) }
  return (
    <li id={id} className={`relative scroll-mt-24 border-b border-[var(--div)] transition-colors duration-150 ${lit && !open ? 'bg-tint' : ''}`} onMouseEnter={enter} onMouseLeave={leave}>
      <button type="button" aria-expanded={open} aria-controls={`${id}-body`} aria-describedby={preview && !open ? `${id}-preview` : undefined}
        onClick={() => { onToggle(); setPreview(false) }} onFocus={enter} onBlur={leave}
        onKeyDown={(e) => { if (e.key === 'Escape') { setPreview(false); onClose() } }}
        className="flex h-[52px] w-full items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate text-[15px] leading-[22px] font-medium text-stone-900">{t.theme}</span>
          {(t.kind === 'opportunity' || t.kind === 'threat') && <span className={`shrink-0 text-[13px] ${t3}`}>{t.kind}</span>}
        </span>
        {/* fixed widths so the favicons, bars and engines line up row to row */}
        <span className="flex shrink-0 items-center gap-3">
          <span className="flex w-11 justify-end"><Favicons pages={t.pages} /></span>
          {/* reach: pages saying it ÷ all pages analysed (the number is in the tooltip) */}
          <span className="relative flex h-1.5 w-16 overflow-hidden rounded-full bg-[var(--data-track)] max-sm:w-10" title={`${t.pages.length} of ${total} pages say this (${Math.round(reach * 100)}%)`} aria-label={`${t.pages.length} of ${total} pages say this`}>
            <span className="h-full rounded-full" style={{ width: `${Math.max(8, scale * 100)}%`, background: hurting ? 'var(--negative)' : 'var(--ink)' }} />
          </span>
          <span className="flex w-[54px] justify-start max-sm:hidden"><EngineMarks ids={themeEngines(t)} size={14} /></span>
        </span>
      </button>
      {/* hover / focus preview: the best quote, floating (nothing moves) */}
      {preview && !open && best && (
        <div id={`${id}-preview`} role="tooltip" className="pointer-events-none absolute left-0 top-full z-30 mt-1 w-[min(420px,100%)] rounded-xl border border-line bg-raised p-3.5 shadow-lg motion-safe:animate-[fade-in_120ms_ease-out]">
          <QuoteOrTitle page={best.page} s={best.quote} tone={tone} size="text-[14px] leading-[22px]" />
          <p className={`mt-1.5 text-[12px] leading-4 ${t3}`}>{best.page.domain}{best.others.length ? ` and ${best.others.length} more` : ''} · click for the quotes</p>
        </div>
      )}
      <div id={`${id}-body`} inert={open ? undefined : ''} className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="relative min-h-0 overflow-hidden">
          <ul className="flex flex-col gap-4 pb-5">
            {quotes.map(({ p, s }) => (
              <li key={p.id}><QuoteOrTitle page={p} s={s} tone={tone} /><div className="mt-1.5"><Source page={p} /></div></li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  )
}

// ---- over time: a diverging tone flow. One column per run around a baseline: positive pages stack up as squares
// (ink), negative pages down (the negative token), neutral pages a thin hollow band on the baseline with its count.
// Ribbons join the runs only for pages that changed tone (matched by URL). The score above each column. One note on
// the biggest move, on its ribbons. Columns grow and ribbons draw when it scrolls in (not with reduced motion).
const TF = { score: 54, pitch: 16, sq: 12, gap: 14, band: 12, dates: 28, note: 22, perRow: 2, minCol: 76 }
const TONE_FILL = { positive: 'var(--ink)', neutral: 'var(--color-stone-500)', negative: 'var(--negative)' }
function OverTime({ runs, run, onPick, pagesOf }) {
  const box = useRef(null)
  const scroller = useRef(null)
  const [w, setW] = useState(900)
  const [tip, setTip] = useState(null) // { kind: 'col' | 'ribbon', ... }
  const [seen, setSeen] = useState(() => reduced())
  const cols = useRef([])
  useLayoutEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])
  // grow in when it scrolls into view (once)
  useEffect(() => {
    if (seen || !box.current) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold: 0.35 })
    io.observe(box.current)
    return () => io.disconnect()
  }, [seen])
  // phones: the chart scrolls sideways inside itself, starting at the latest run
  useLayoutEffect(() => { if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth }, [w])
  const n = runs.length
  const data = useMemo(() => runs.map((r) => ({ r, pages: pagesOf(r) })), [runs]) // eslint-disable-line react-hooks/exhaustive-deps
  if (n < 2) {
    return (
      <section aria-labelledby="time-h">
        <h2 id="time-h" className={h2}>Over time</h2>
        <p className={`mt-6 border-y border-line py-10 text-center text-[14px] leading-5 ${t2}`}>The trend starts with your second run. Re-analyze after the next sync to compare.</p>
      </section>
    )
  }
  const L = 64 // the Positive / Negative labels
  const plotW = Math.max(w - L, n * TF.minCol)
  const colW = plotW / n
  const cx = (i) => L + colW * i + colW / 2
  const stacks = data.map(({ pages }) => divergingStack(pages, { perRow: TF.perRow, pitch: TF.pitch, gap: TF.gap }))
  const up = Math.max(...stacks.map((s) => s.up)), down = Math.max(...stacks.map((s) => s.down))
  const base = TF.score + TF.gap + up * TF.pitch + 6 // the baseline's y
  const H = base + TF.gap + down * TF.pitch + 6 + TF.dates
  const stackW = TF.perRow * TF.pitch
  const bandW = Math.min(colW - 24, stackW + 16)
  // ribbons: pages that changed tone between neighbours (matched by URL)
  const point = (i, p, side) => {
    const s = stacks[i].slots[p.id]
    const x = cx(i) + side * (s ? TF.sq / 2 + 1 : bandW / 2) + (s ? s.x : 0)
    return { x, y: s ? base + s.y : base }
  }
  const ribbons = data.slice(1).flatMap(({ pages }, k) => toneChanges(data[k].pages, pages).map((c) => {
    const a = point(k, data[k].pages.find((p) => p.id === c.page.id) ?? c.page, 1), b = point(k + 1, c.page, -1)
    const mx = (a.x + b.x) / 2
    return { ...c, i: k + 1, d: `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`, mid: { x: mx, y: (a.y + b.y) / 2 } }
  }))
  const big = biggestChange(runs)
  const bigRibbons = big ? ribbons.filter((x) => x.i === big.index) : []
  const note = moveNote(runs, big)
  const anchor = bigRibbons.length ? { x: bigRibbons.reduce((s, x) => s + x.mid.x, 0) / bigRibbons.length, y: Math.min(...bigRibbons.map((x) => x.mid.y)) } : null
  const latest = runs.at(-1)
  const key = (e, i) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, Home: -n, End: n }[e.key]
    if (!step) return
    e.preventDefault()
    cols.current[Math.max(0, Math.min(n - 1, i + step))]?.focus()
  }
  // tooltips stay inside the part of the chart that's in view (phones scroll it sideways)
  const clampX = (x) => { const sl = scroller.current?.scrollLeft ?? 0, vw = scroller.current?.clientWidth ?? w; return Math.max(sl + 150, Math.min(sl + vw - 150, x)) }
  const grow = (i) => ({ transform: seen ? 'scaleY(1)' : 'scaleY(0)', transformOrigin: `0 ${base}px`, transition: reduced() ? 'none' : `transform 420ms cubic-bezier(.2,.8,.2,1) ${i * 60}ms` })
  return (
    <section aria-labelledby="time-h">
      <h2 id="time-h" className={h2}>Over time</h2>
      <div ref={box} className="relative mt-6">
        <div ref={scroller} className="overflow-x-auto overflow-y-visible [scrollbar-width:thin]" onMouseLeave={() => setTip(null)}>
          <div className="relative" style={{ width: L + plotW, height: H + TF.note }}>
            {/* the latest run's column, tinted */}
            <div className="absolute rounded-lg bg-tint" style={{ left: L + colW * (n - 1) + 4, width: colW - 8, top: 0, height: H }} aria-hidden />
            <svg className="absolute inset-0 overflow-visible" width={L + plotW} height={H + TF.note}>
              <line x1={L} x2={L + plotW} y1={base} y2={base} stroke="var(--color-line)" aria-hidden />
              <text x={0} y={base - TF.gap - 4} fontSize={12} fill="var(--color-stone-500)" aria-hidden>Positive</text>
              <text x={0} y={base + TF.gap + 12} fontSize={12} fill="var(--color-stone-500)" aria-hidden>Negative</text>
              {/* ribbons: draw after the columns grow; a wide invisible stroke takes the hover */}
              {ribbons.map((rb, j) => (
                <g key={`${rb.i}-${rb.page.id}`}>
                  <path d={rb.d} fill="none" stroke={TONE_FILL[rb.to]} strokeOpacity={tip?.kind === 'ribbon' && tip.rb === rb ? 0.85 : rb.to === 'neutral' ? 0.3 : 0.4} strokeWidth={2} strokeLinecap="round"
                    pathLength={1} strokeDasharray={1} strokeDashoffset={seen ? 0 : 1}
                    style={{ transition: reduced() ? 'none' : `stroke-dashoffset 600ms ease-out ${420 + n * 60 + j * 20}ms, stroke-opacity 150ms` }} aria-hidden />
                  <path d={rb.d} fill="none" stroke="transparent" strokeWidth={12} className="cursor-default"
                    onMouseEnter={() => setTip({ kind: 'ribbon', rb, x: rb.mid.x, y: rb.mid.y })} onMouseLeave={() => setTip(null)} />
                </g>
              ))}
              {/* columns: squares up and down, the neutral band with its count; the score above */}
              {data.map(({ r, pages }, i) => {
                const isLast = r === latest, on = r.id === run.id
                const neutral = pages.filter((p) => p.tone === 'neutral').length
                const topY = base - TF.gap - stacks[i].up * TF.pitch - 10
                return (
                  <g key={r.id} aria-hidden>
                    <g style={grow(i)}>
                      {pages.filter((p) => stacks[i].slots[p.id]).map((p) => {
                        const s = stacks[i].slots[p.id]
                        return <rect key={p.id} x={cx(i) + s.x - TF.sq / 2} y={base + s.y - TF.sq / 2} width={TF.sq} height={TF.sq} rx={3} fill={TONE_FILL[p.tone]} />
                      })}
                    </g>
                    <rect x={cx(i) - bandW / 2} y={base - TF.band / 2} width={bandW} height={TF.band} rx={TF.band / 2} fill="var(--color-surface)" stroke="var(--color-stone-400)" strokeWidth={1} />
                    <text x={cx(i)} y={base} dy={3.5} textAnchor="middle" fontSize={10} fill="var(--color-stone-500)" className="num">{neutral}</text>
                    <text x={cx(i)} y={Math.min(topY, base - TF.gap - 10)} textAnchor="middle" fontSize={isLast ? 18 : 14} fontWeight={600} fill={on ? 'var(--ink)' : 'var(--color-stone-700)'} className="num">
                      {r.score}{isLast && r.delta != null && <tspan fontSize={12} fontWeight={500} dx={4} fill={r.delta < 0 ? 'var(--negative)' : 'var(--ink)'}>{r.delta < 0 ? '▼' : '▲'}{Math.abs(r.delta)}</tspan>}
                    </text>
                    <text x={cx(i)} y={H - 8} textAnchor="middle" fontSize={12} fontWeight={on ? 600 : 400} fill={on ? 'var(--ink)' : 'var(--color-stone-500)'} className="num">{fmtDay(r.date)}</text>
                  </g>
                )
              })}
              {/* the one annotation: on the biggest move's ribbons */}
              {note && anchor && (
                <g aria-hidden style={{ opacity: seen ? 1 : 0, transition: reduced() ? 'none' : `opacity 300ms ease-out ${900 + n * 60}ms` }}>
                  <line x1={anchor.x} x2={anchor.x} y1={anchor.y - 4} y2={H - TF.dates + 4} stroke="var(--color-stone-400)" strokeDasharray="2 3" />
                  <text x={anchor.x} y={H + 12} textAnchor="middle" fontSize={12} fill="var(--color-stone-600)" stroke="var(--color-surface)" strokeWidth={4} paintOrder="stroke" className="num">{note}</text>
                </g>
              )}
            </svg>
            {/* the columns as buttons: hover / focus for the run, click or Enter to see its pages */}
            {data.map(({ r }, i) => (
              <button key={r.id} ref={(el) => { cols.current[i] = el }} type="button" aria-pressed={r.id === run.id}
                aria-label={`${fmtDay(r.date)}: score ${r.score}. Show this run’s pages`}
                onClick={() => onPick(r.id)} onKeyDown={(e) => key(e, i)}
                onMouseEnter={() => setTip({ kind: 'col', i })} onFocus={() => setTip({ kind: 'col', i })} onBlur={() => setTip(null)}
                className="absolute top-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus"
                style={{ left: L + colW * i + colW / 2 - stackW / 2 - 14, width: stackW + 28, height: H }} />
            ))}
            {tip?.kind === 'col' && (() => {
              const { r, pages } = data[tip.i]
              const ch = tip.i ? topChange(toneChanges(data[tip.i - 1].pages, pages)) : null
              return (
                <div role="tooltip" className="pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-raised px-3 py-2 text-small shadow-md tabular-nums"
                  style={{ left: clampX(cx(tip.i)), top: base + TF.gap }}>
                  <div className="font-semibold text-stone-900">{fmtDay(r.date)} · {r.score}{r.delta != null && <span className={`ml-1.5 font-medium ${r.delta < 0 ? 'text-negative' : 'text-stone-600'}`}>{r.delta > 0 ? '▲' : r.delta < 0 ? '▼' : ''}{r.delta ? Math.abs(r.delta) : 'no change'}</span>}</div>
                  <div className="mt-0.5 text-stone-600">{r.counts.positive} positive · {r.counts.neutral} neutral · <span className={r.counts.negative ? 'text-negative' : undefined}>{r.counts.negative} negative</span> pages</div>
                  {ch && <div className="mt-0.5 text-stone-600">Top change: {ch.page.domain}, {ch.from} → <span className={ch.to === 'negative' ? 'text-negative' : undefined}>{ch.to}</span></div>}
                </div>
              )
            })()}
            {tip?.kind === 'ribbon' && (
              <div role="tooltip" className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-raised px-3 py-2 text-small shadow-md"
                style={{ left: clampX(tip.x), top: tip.y - 10 }}>
                <span className="font-medium text-stone-900">{tip.rb.page.domain}</span>: {tip.rb.from} → <span className={tip.rb.to === 'negative' ? 'text-negative' : 'text-stone-900'}>{tip.rb.to}</span>
                <span className={t3}> ({fmtDay(runs[tip.rb.i - 1].date)} → {fmtDay(runs[tip.rb.i].date)})</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
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
