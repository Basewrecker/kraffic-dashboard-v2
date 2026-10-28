import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, Check, ChevronDown, RefreshCw, SearchX, Smile } from 'lucide-react'
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
import { biggestChange, columnDots, groupThemes, layoutSwarm, lanesFor, matchIds, neighbour, scoreX, tellingSentence, themeEngines, themeQuote, themeTrend } from '../../utils/spectrum'
import { fmtDay, lineBtn, t2, t3 } from './parts'

// /sentiment: one visual page about how third-party pages talk about the brand.
//   Header · the spectrum (every page a dot, placed by tone; hover for a quote, click for all of them; split by engine)
//   · one insight · What AI reads about you (themes that hurt / work; a theme lights its pages, a dot opens its theme)
//   · Over time (each run's pages as dots + the score; a run swaps the spectrum to it) · All pages (collapsed, synced).
// Production gives each page a tone only (no number), so dots sit in three bands. Data and logic: data/sentiment.js,
// utils/spectrum.js. States: ?mock=never | running | nopages | error | one | calm (no negative pages).
// Fallbacks: ?themes=unlinked (themes not linked to pages) · ?time=share (Over time from per-run percentages only).

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
  const [theme, setTheme] = useState(null) // the theme picked below (lights its dots)
  const [hoverTheme, setHoverTheme] = useState(null)
  const [openThemes, setOpenThemes] = useState(null) // null = the default: the top two Hurting you themes
  const [draft, setDraft] = useState(null)
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
  const pagesOf = (r) => (r === latest ? latestPages : runPages(latestPages, r.counts, r.id))
  const pages = pagesOf(run)
  const shown = isLatest ? hoverTheme ?? theme : null // themes are the latest run's
  const lit = matchIds(pages, { engine, tone, theme: shown })
  useEffect(() => { setRunId(null); setTheme(null); setTone(null); setOpenThemes(null) }, [domain])

  // What AI reads about you: themes from the latest run (?mock=calm has nothing hurting)
  const unlinked = q.get('themes') === 'unlinked'
  const swot = mock === 'calm' && data.swot ? { ...data.swot, weaknesses: [], threats: [] } : data.swot
  const groups = groupThemes(swot, latestPages)
  const history = runs.map((r) => ({ date: r.date, pages: pagesOf(r) }))
  const trends = new Map([...groups.hurting.map((t) => [t.theme, themeTrend(t, history, 'negative')]), ...groups.working.map((t) => [t.theme, themeTrend(t, history, 'positive')])])
  const open = openThemes ?? new Set(groups.hurting.slice(0, 2).map((t) => t.theme))
  const scrollHero = () => {
    const top = hero.current?.getBoundingClientRect().top ?? 0
    if (top < 0 || top > window.innerHeight * 0.6) hero.current?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' })
  }

  // open / close a theme: opening it lights its pages in the hero (scrolled into view if it's off screen)
  const toggleTheme = (t) => {
    const next = new Set(open)
    if (next.has(t.theme)) { next.delete(t.theme); if (theme?.theme === t.theme) setTheme(null) } else { next.add(t.theme); setTheme(t); setRunId(null); scrollHero() }
    setOpenThemes(next)
  }
  // a dot's theme: on its own side first (a positive page → Working for you), else the other side
  const themeOf = (page) => {
    const sides = page.tone === 'positive' ? [groups.working, groups.hurting] : [groups.hurting, groups.working]
    return sides.flat().find((x) => x.sources.includes(page.id)) ?? null
  }
  // a dot in the hero: opens its theme below, or its drawer when no theme cites it
  const onDot = (page) => {
    const t = unlinked ? null : themeOf(page)
    if (!t || !isLatest) { openDrawer('page', page.id); return }
    setTheme(t)
    setOpenThemes(new Set([...open, t.theme]))
    requestAnimationFrame(() => document.getElementById(`theme-${t.theme.toLowerCase().replace(/[^a-z]+/g, '-')}`)?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' }))
  }
  const themeFor = (page) => (unlinked || !isLatest ? null : themeOf(page))
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
        split={split} setSplit={setSplit} tone={tone} setTone={setTone} theme={shown} clearTheme={() => { setTheme(null); setHoverTheme(null) }} onDot={onDot} themeFor={themeFor} />
      {swot && (
        <AiReads groups={groups} trends={trends} unlinked={unlinked} pages={latestPages} open={open} toggle={toggleTheme} active={shown?.theme}
          onHover={(t) => setHoverTheme(unlinked ? null : t)} onDraft={setDraft} onPage={(id) => openDrawer('page', id)} latest={latest} calm={!groups.hurting.length} />
      )}
      <OverTime runs={runs} run={run} share={q.get('time') === 'share'} onPick={(id) => { setRunId(id === latest.id ? null : id); setTheme(null) }} />
      <AllPages pages={pages} lit={lit} filtered={engine !== 'all' || tone || shown} />
      <PageDrawer pages={pages} brand={brand} />
      <DraftModal action={draft} page={draft && latestPages.find((p) => p.id === draft.page)} onClose={() => setDraft(null)} toast={toast} />
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
      <p className="mt-2.5 text-[13px] leading-5 text-stone-900"><Phrase s={s} tone={p.tone} /></p>
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

// ---- what AI reads about you: Hurting you (weaknesses + threats) | Working for you (strengths + opportunities).
// Each theme a row: its pages (favicons), engines and trend; open for its quotes and, where there is one, a drafted reply.
// Hover or open a theme: its pages light up in the spectrum. ?themes=unlinked: the fallback without theme → page links.
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '-')
function AiReads({ groups, trends, unlinked, pages, open, toggle, active, onHover, onDraft, onPage, latest, calm }) {
  const col = (side) => {
    const hurting = side === 'hurting'
    const list = groups[side]
    return (
      <div className="min-w-0">
        <h3 className={`border-b border-line pb-2 text-[13px] leading-[18px] font-medium ${hurting ? 'text-negative' : 'text-stone-600'}`}>{hurting ? 'Hurting you' : 'Working for you'}</h3>
        {hurting && calm ? (
          <p className="flex items-center gap-2 py-4 text-[15px] leading-[22px] text-stone-900"><Check size={16} className="text-ink" aria-hidden />Nothing negative this run</p>
        ) : unlinked ? (
          <Unlinked list={list} pages={pages.filter((p) => p.tone === (hurting ? 'negative' : 'positive'))} hurting={hurting} onPage={onPage} />
        ) : (
          <ul>
            {list.map((t) => (
              <ThemeRow key={t.theme} t={t} hurting={hurting} trend={trends.get(t.theme)} open={open.has(t.theme)} lit={active === t.theme}
                onToggle={() => toggle(t)} onHover={onHover} onDraft={onDraft} onPage={onPage} />
            ))}
          </ul>
        )}
      </div>
    )
  }
  return (
    <section aria-labelledby="reads-h">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="reads-h" className={h2}>What AI reads about you</h2>
        <span className={`text-[13px] leading-[18px] ${t3}`}>From the {fmtDay(latest.date)} run</span>
      </div>
      {/* phones: Hurting you first */}
      <div className="mt-4 grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">{col('hurting')}{col('working')}</div>
    </section>
  )
}

const TREND = (tr) => (!tr ? null : tr.kind === 'new' ? 'new this run' : `since ${fmtDay(tr.date)}`)
function ThemeRow({ t, hurting, trend, open, lit, onToggle, onHover, onDraft, onPage }) {
  const id = `theme-${slug(t.theme)}`
  const quotes = t.pages.slice(0, 3).map((p) => ({ p, s: themeQuote(p, t) }))
  const [first, ...rest] = quotes
  const engines = themeEngines(t).map(engineName).map((n) => (n === 'Google search' ? 'Google' : n))
  return (
    <li id={id} className={`scroll-mt-24 border-b border-[var(--div)] transition-[background-color,box-shadow] duration-200 ${lit ? 'bg-tint shadow-[-12px_0_0_var(--tint),12px_0_0_var(--tint)]' : ''}`}
      onMouseEnter={() => onHover(t)} onMouseLeave={() => onHover(null)}>
      <button type="button" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle} onFocus={() => onHover(t)} onBlur={() => onHover(null)}
        className="group flex w-full items-start gap-3 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus rounded-md">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] leading-[22px] font-semibold text-stone-900">
            {t.theme}{(t.kind === 'opportunity' || t.kind === 'threat') && <span className={`ml-2 text-[13px] font-normal ${t3}`}>{t.kind}</span>}
          </span>
          <span className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-4 ${t3}`}>
            <span className="flex -space-x-1" aria-hidden>
              {t.pages.slice(0, 4).map((p) => (
                <span key={p.id} className="grid h-4 w-4 place-items-center overflow-hidden rounded-full ring-2 ring-surface" style={{ background: '#fff' }}>
                  <SiteLogo domain={p.domain} name={p.domain} className="h-3 w-3 rounded-full !border-0 !bg-transparent" imgPad="p-0" initialClass="text-[7px] !text-[#44403c]" bordered={false} />
                </span>
              ))}
            </span>
            <span className="tabular-nums">{plural(t.pages.length, 'page')} · {engines.join(', ')}</span>
            {TREND(trend) && <span>· {TREND(trend)}</span>}
          </span>
        </span>
        <ChevronDown size={16} className={`mt-1 shrink-0 text-stone-500 transition-transform duration-200 group-hover:text-stone-900 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {/* accordion: grid rows 0fr → 1fr (no animation with reduced motion) */}
      <div id={`${id}-body`} inert={open ? undefined : ''} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="relative min-h-0 overflow-hidden">
          <div className="pb-4">
            <blockquote className="text-[18px] leading-7 font-medium tracking-[-0.01em] text-stone-900 [text-wrap:pretty]"><Phrase s={first.s} tone={hurting ? 'negative' : 'positive'} /></blockquote>
            <QuoteSource p={first.p} onPage={onPage} />
            {rest.map(({ p, s }) => (
              <div key={p.id} className="mt-3">
                <p className="text-[14px] leading-[22px] text-stone-900"><Phrase s={s} tone={hurting ? 'negative' : 'positive'} /></p>
                <QuoteSource p={p} onPage={onPage} />
              </div>
            ))}
            {(t.action || t.pages.length > 3) && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {t.action && (
                  <button type="button" onClick={() => onDraft(t.action)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-stone-900 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus">
                    {t.action.label} <ArrowRight size={14} aria-hidden />
                  </button>
                )}
                {t.pages.length > 3 && <span className={`text-[13px] ${t2}`}>All {t.pages.length} pages are lit in the spectrum above</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
// under a quote: whose page it is; the domain opens that page's drawer (every quote)
function QuoteSource({ p, onPage }) {
  return (
    <button type="button" onClick={() => onPage(p.id)} className={`mt-1.5 inline-flex items-center gap-1.5 rounded text-[12px] leading-4 ${t3} outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus`}>
      <SiteLogo domain={p.domain} name={p.domain} className="h-3.5 w-3.5 rounded-full !border-0" imgPad="p-0" initialClass="text-[7px]" />
      {p.domain} · every quote
    </button>
  )
}
// fallback: themes not linked to pages (no favicons, counts or trend); the side's pages quoted one by one under them
function Unlinked({ list, pages, hurting, onPage }) {
  return (
    <>
      <ul className="py-1">
        {list.map((t) => (
          <li key={t.theme} className="border-b border-[var(--div)] py-3 text-[15px] leading-[22px] font-semibold text-stone-900">
            {t.theme}{(t.kind === 'opportunity' || t.kind === 'threat') && <span className={`ml-2 text-[13px] font-normal ${t3}`}>{t.kind}</span>}
          </li>
        ))}
      </ul>
      <h4 className={`mt-5 text-[13px] leading-[18px] ${t3}`}>{hurting ? 'Negative pages' : 'Positive pages'}, in their words</h4>
      <ul className="mt-2">
        {pages.map((p) => (
          <li key={p.id} className="py-2.5">
            <p className="text-[14px] leading-[22px] text-stone-900"><Phrase s={tellingSentence(p)} tone={hurting ? 'negative' : 'positive'} /></p>
            <QuoteSource p={p} onPage={onPage} />
          </li>
        ))}
      </ul>
    </>
  )
}

// the drafted reply (mock): copy it, or open the page to post it
function DraftModal({ action, page, onClose, toast }) {
  const [text, setText] = useState(action?.draft ?? '')
  useEffect(() => setText(action?.draft ?? ''), [action])
  return (
    <Modal open={Boolean(action)} onClose={onClose} size="md" title={action?.label ?? ''}
      subtitle={page ? `A reply to “${page.title}” on ${page.domain}. Edit it, then post it there.` : ''}
      footer={(
        <>
          {page && <a href={`https://${page.domain}${page.path}`} target="_blank" rel="noreferrer" className={`mr-auto inline-flex items-center gap-1 rounded text-[13px] font-medium ${t2} outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus`}>Open {page.domain} <ArrowUpRight size={14} aria-hidden /></a>}
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg px-3 text-small font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Close</button>
          <PrimaryButton size="sm" onClick={() => { navigator.clipboard?.writeText(text).catch(() => {}); toast('Reply copied'); onClose() }}>Copy reply</PrimaryButton>
        </>
      )}>
      <label className="block text-[13px] leading-[18px] font-medium text-stone-600" htmlFor="draft-reply">Draft</label>
      <textarea id="draft-reply" value={text} onChange={(e) => setText(e.target.value)} rows={7}
        className="mt-1.5 w-full resize-y rounded-lg border border-line bg-surface p-3 text-[14px] leading-[22px] text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus" />
    </Modal>
  )
}

// ---- over time: one column per run, that run's pages as dots in three tone bands (like small spectrums), the score
// as one line with its own axis on the right. Production keeps each run's pages with their tone (reputation_scans
// .sources), so this is the default; ?time=share is the fallback for percentages only (100% stacked columns).
const OT = { H: 180, band: 60, left: 64, right: 60, colMax: 104, pitch: 8, perRow: 4 }
function OverTime({ runs, run, onPick, share }) {
  const box = useRef(null)
  const [w, setW] = useState(800)
  const [tip, setTip] = useState(null)
  const cols = useRef([])
  useLayoutEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])
  const big = biggestChange(runs)
  if (runs.length < 2) {
    return (
      <section aria-labelledby="time-h">
        <h2 id="time-h" className={h2}>Over time</h2>
        <div className="mt-4 flex h-[180px] flex-col items-center justify-center border-y border-line text-center">
          <p className="text-[15px] leading-[22px] font-medium text-stone-900">The trend starts with your second run</p>
          <p className={`mt-1 text-[13px] leading-[18px] ${t2}`}>Re-analyze after the next sync to compare.</p>
        </div>
      </section>
    )
  }
  const n = runs.length
  const narrow = w < 520
  const left = narrow ? 52 : OT.left, right = narrow ? 44 : OT.right
  const colW = Math.min(OT.colMax, (w - left - right) / n)
  const plotW = colW * n
  const cx = (i) => left + colW * i + colW / 2
  const sy = (score) => (1 - score / 100) * OT.H
  const line = runs.map((r, i) => `${i ? 'L' : 'M'}${cx(i)},${sy(r.score)}`).join(' ')
  const pitch = narrow ? 7 : OT.pitch
  const perRow = Math.max(2, Math.min(OT.perRow, Math.floor((colW - 8) / pitch)))
  const key = (e, i) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const j = Math.max(0, Math.min(n - 1, i + step))
    cols.current[j]?.focus()
  }
  return (
    <section aria-labelledby="time-h">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="time-h" className={h2}>Over time</h2>
        {big && <span className={`text-[13px] leading-[18px] ${t2}`}>Biggest move: after {fmtDay(runs[big.index - 1].date)}, {big.what}</span>}
      </div>
      <div ref={box} className="relative mt-5" style={{ maxWidth: left + right + OT.colMax * n }} onMouseLeave={() => setTip(null)}>
        <div className="relative" style={{ height: OT.H + 28 }}>
          <svg className="absolute inset-0 overflow-visible" width={left + plotW + right} height={OT.H + 28} aria-hidden>
            {/* tone bands (dots mode): faint dividers + labels on the left */}
            {!share && [1, 2].map((b) => <line key={b} x1={left} x2={left + plotW} y1={b * OT.band} y2={b * OT.band} stroke="var(--div)" />)}
            <line x1={left} x2={left + plotW} y1={OT.H} y2={OT.H} stroke="var(--color-line)" />
            {/* the score axis on the right: 0–100, a dashed even line */}
            <line x1={left} x2={left + plotW} y1={sy(50)} y2={sy(50)} stroke="var(--color-stone-400)" strokeDasharray="4 4" />
            <line x1={left + plotW + 8} x2={left + plotW + 8} y1={0} y2={OT.H} stroke="var(--color-line)" />
            {[[100, '100'], [50, '50 even'], [0, '0']].map(([v, l]) => (
              <text key={v} x={left + plotW + 14} y={sy(v)} dy={v === 100 ? 9 : v === 0 ? -2 : 4} fontSize={11} fill="var(--color-stone-500)" className="num">{l}</text>
            ))}
            <text x={left + plotW + 14} y={OT.H + 18} fontSize={11} fill="var(--color-stone-500)">Score</text>
            {/* each run */}
            {runs.map((r, i) => {
              const on = r.id === run.id
              if (share) {
                const pc = tonePercents(r.counts)
                const bw = Math.min(28, colW * 0.4)
                let y = 0
                return (
                  <g key={r.id}>
                    {['positive', 'neutral', 'negative'].map((k) => {
                      const h = (pc[k] / 100) * OT.H
                      const el = <rect key={k} x={cx(i) - bw / 2} y={y} width={bw} height={Math.max(0, h - 1)} rx={2} fill={RING[k]} opacity={k === 'neutral' ? 0.35 : k === 'positive' ? 0.75 : 0.8} />
                      y += h
                      return el
                    })}
                  </g>
                )
              }
              return (
                <g key={r.id} opacity={on || !tip || tip.i === i ? 1 : 0.55}>
                  {columnDots(r.counts, { bandH: OT.band, pitch, perRow }).map((d, k) => (
                    <circle key={k} cx={cx(i) + d.x} cy={d.y} r={pitch / 2 - 1} fill={d.tone === 'neutral' ? 'none' : RING[d.tone]} stroke={RING[d.tone]} strokeWidth={d.tone === 'neutral' ? 1.25 : 0} />
                  ))}
                </g>
              )
            })}
            {/* the score line + a marker per run */}
            <path d={line} fill="none" stroke="var(--color-surface)" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
            <path d={line} fill="none" stroke="var(--ink)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {runs.map((r, i) => (
              <circle key={r.id} cx={cx(i)} cy={sy(r.score)} r={r.id === run.id ? 5.5 : 4} fill="var(--ink)" stroke="var(--color-surface)" strokeWidth={2} />
            ))}
            {/* x: run dates; the biggest move marked */}
            {runs.map((r, i) => (
              <text key={r.id} x={cx(i)} y={OT.H + 18} textAnchor="middle" fontSize={narrow ? 11 : 12} fontWeight={r.id === run.id ? 600 : 400} fill={r.id === run.id ? 'var(--ink)' : 'var(--color-stone-500)'} className="num">
                {narrow && i % 2 && r.id !== run.id ? '' : fmtDay(r.date)}
              </text>
            ))}
            {big && <path d={`M${cx(big.index) - 4},${-6} L${cx(big.index) + 4},${-6} L${cx(big.index)},${-1} Z`} fill="var(--ink)" />}
          </svg>
          {/* band labels on the left (in share mode, beside the first column's parts) */}
          {(() => {
            const pc = share ? tonePercents(runs[0].counts) : null
            const mid = share ? { positive: pc.positive / 2, neutral: pc.positive + pc.neutral / 2, negative: pc.positive + pc.neutral + pc.negative / 2 } : null
            return ['positive', 'neutral', 'negative'].map((k, b) => (
              <span key={k} className={`absolute left-0 -translate-y-1/2 text-[12px] leading-4 font-medium ${TONE_TEXT[k]}`} style={{ top: share ? (mid[k] / 100) * OT.H : b * OT.band + OT.band / 2 }} aria-hidden>
                {TONE_LABEL[k]}
              </span>
            ))
          })()}
          {/* the columns: hover / focus for the run, click or Enter to see its pages in the spectrum */}
          {runs.map((r, i) => (
            <button key={r.id} ref={(el) => { cols.current[i] = el }} type="button" aria-pressed={r.id === run.id}
              aria-label={`${fmtDay(r.date)}: score ${r.score}. Show this run’s pages`}
              onClick={() => onPick(r.id)} onKeyDown={(e) => key(e, i)}
              onMouseEnter={() => setTip({ i, r })} onFocus={() => setTip({ i, r })} onBlur={() => setTip(null)}
              className={`absolute top-0 rounded-md outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${r.id === run.id ? 'bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]' : 'hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]'}`}
              style={{ left: left + colW * i + 2, width: colW - 4, height: OT.H + 26 }} />
          ))}
          {tip && (
            <div role="tooltip" className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-raised px-3 py-2 text-small shadow-md tabular-nums"
              style={{ left: Math.max(90, Math.min(w - 90, cx(tip.i))), top: Math.min(sy(tip.r.score), OT.H - 40) - 12 }}>
              <div className="font-semibold text-stone-900">{fmtDay(tip.r.date)} · {tip.r.score}{tip.r.delta != null && <span className={`ml-1.5 font-medium ${tip.r.delta < 0 ? 'text-negative' : 'text-stone-600'}`}>{tip.r.delta > 0 ? '▲' : tip.r.delta < 0 ? '▼' : ''}{tip.r.delta ? Math.abs(tip.r.delta) : 'no change'}</span>}</div>
              <div className="mt-0.5 text-stone-600">{tip.r.counts.positive} / {tip.r.counts.neutral} / <span className={tip.r.counts.negative ? 'text-negative' : undefined}>{tip.r.counts.negative}</span> pages</div>
            </div>
          )}
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
