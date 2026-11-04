import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import BetaTag from '../../components/ui/BetaTag'
import { ArrowDown, ArrowRight, ArrowUpRight, ChevronDown, ChevronRight, Info, RefreshCw, Search, SearchX, Smile, X } from 'lucide-react'
import SiteLogo from '../../components/ui/SiteLogo'
import Modal from '../../components/ui/Modal'
import Switch from '../../components/ui/Switch'
import Insight, { hl, useExplain } from '../../components/ui/Insight'
import { PlatformIcon } from '../../components/dashboard/icons'
import { PrimaryButton, useToast } from '../../components/dashboard/overlays'
import DrawerShell, { Dot, useDrawer } from '../../components/audit/DrawerShell'
import { openDrawer, setParams, useParams } from '../../components/audit/parts'
import { EmptyState, ErrorCard, RunningLine } from '../../components/tool/ToolPage'
import { account, currentBrand } from '../../data/mock'
import { useIsMobile, useMedia } from '../../hooks/useMedia'
import {
  TONES, TONE_LABEL, countTones, heroLine, runPages, scoredLine, scoreInfo, unscoredNote, scoreOf, sentimentFor, sentimentInsight, shareTrendLine, sortPages, sourceCloud, tonePercents, withScores,
} from '../../data/sentiment'
import { BAND, QUADRANT, capStack, dotPlan, pageHref, groupThemes, matchIds, neighbour, quadrantMinH, quadrantPack, springEasing, staggerDelays, tellingSentence } from '../../utils/spectrum'
import { ENGINE_NAME, SCORING_UPDATED_TIP, SENTIMENT_ENGINES, heroTone, scoringChangedAt, scoreCardDocked, scoreChangeLine, sortAllPages, syncColumns, syncScoreChange, tipLeft, alsoSaidOnSites, changedCount, compareCsv, compareCsvRow, compareEntries, compareFilename, compareList, compareMarks, enginesIn, evenColumns, filterSyncPages, newPageIds, sourceColumns, sourceLead, syncCsv, syncFilename, syncMarks, toneById, turnedNegative } from '../../utils/sentimentSections'
import { fmtDay, lineBtn, t2, t3 } from './parts'
import { CrossFade, GLIDE, Seg, useCountUp, useWidth } from '../../components/ui/motion'
import { stackSegments } from '../../utils/mixBars'

// /sentiment: one visual page about how third-party pages talk about the brand.
//   Header · the spectrum (every page a dot, placed by tone; hover for a quote, click for its drawer; split by engine)
//   · one insight · Over time (each sync's tone mix or score | Pages on <date>, filters, Compare as CSV) · Sources (sites
//   leaning negative | positive across every sync, led by the top site's quote) · All pages. The sections below the hero
//   use the design of the former "What AI says about you" (column heads, 52px rows, hairlines, type).
// Production gives each page a tone only (no number), so dots sit in four bands (Not scored pages are listed, never
// placed). Data and logic: data/sentiment.js, utils/spectrum.js, utils/sentimentSections.js.
// States: ?mock=never | running | nopages | error | one (first run) | calm (no negative pages).
// Fallbacks: ?themes=unlinked (themes not linked to pages) · ?quotes=none (pages analysed before quotes were kept).

const ENGINES = SENTIMENT_ENGINES.map((id) => ({ id, name: ENGINE_NAME[id], short: ENGINE_NAME[id], icon: id }))  // the reputation scan covers Google (one engine), ChatGPT and Claude: the plain Google mark
const engineName = (id) => ENGINES.find((e) => e.id === id)?.name
const EngineIcon = ({ id, size = 14 }) => <PlatformIcon id={ENGINES.find((e) => e.id === id)?.icon ?? id} size={size} />
const EngineMarks = ({ ids, size = 14 }) => (
  <span className="flex items-center gap-1.5">{ids.map((e) => <span key={e} className="flex shrink-0"><EngineIcon id={e} size={size} /><span className="sr-only">{engineName(e)}</span></span>)}</span>
)
// the brand picked in the sidebar's switcher; no brand control here. Read on every render (not once when the page first
// loads), so a name changed in Brand Setup shows here at once (Brand Setup's name, else the domain)
const activeBrand = () => ({ domain: account.domain, name: currentBrand?.domain === account.domain ? currentBrand.name : account.name ?? account.domain })

// positive ink · neutral t3 · mixed its own grey (--sent-mixed) · negative the negative token
const RING = { positive: 'var(--ink)', neutral: 'var(--color-stone-500)', mixed: 'var(--sent-mixed)', negative: 'var(--negative)' }
const TONE_TEXT = { positive: 'text-ink', neutral: t3, mixed: 'text-stone-700', negative: 'text-negative', unscored: t3 }
const MOCKS = ['never', 'running', 'nopages', 'error', 'one', 'calm']
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const h2 = 'text-[18px] leading-[26px] font-semibold text-stone-900' // section titles 18/600
const plural = (n, w) => `${n} ${n === 1 ? w : `${w}s`}`

export default function SentimentPage() {
  useEffect(() => { document.title = 'Sentiment · Kraffic' }, [])
  const q = useParams()
  const mock = MOCKS.includes(q.get('mock')) ? q.get('mock') : null
  const ACTIVE_BRAND = activeBrand()
  const domain = ACTIVE_BRAND.domain
  const [engine, setEngine] = useState('all')
  const [split, setSplit] = useState(false)
  const [toneFilter, setToneFilter] = useState(null) // { runId, tone }: the hero's tone filter, for the sync it was set on
  const [runId, setRunId] = useState(null) // null = the latest run
  const [confirm, setConfirm] = useState(false)
  const [running, setRunning] = useState(mock === 'running')
  const [toastNode, toast] = useToast({ position: 'center' })
  const hero = useRef(null)
  const brand = ACTIVE_BRAND

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
  // the picked sync as Over time, This sync and the Pages list read it (utils/sentimentSections.js syncColumns), and
  // its score change against the sync before (syncScoreChange: the same number as the chart's tooltip)
  const cols = syncColumns(runs, pagesOf, engine)
  const col = cols[runs.indexOf(run)]
  const change = syncScoreChange(cols, runs.indexOf(run))
  // a tone picked under the dot plot applies to that sync only; another sync shows all its pages (heroTone)
  const tone = heroTone(toneFilter, run.id)
  const setTone = (t) => setToneFilter(t ? { runId: run.id, tone: t } : null)
  // each row's marks for the sync shown: New (newPageIds: never cited in an earlier sync) and the tone it had before
  const runIndex = runs.indexOf(run)
  const runPagesAll = runs.map((r) => ({ pages: pagesOf(r) }))
  const freshAll = newPageIds(runPagesAll, runIndex)
  const prevTonesAll = toneById(runIndex > 0 ? runPagesAll[runIndex - 1].pages : [])
  const changeOf = (p) => syncMarks(p, { fresh: freshAll, prevTones: prevTonesAll })
  // the hover cards' and the open Sources rows' sync history (every sync's date and pages)
  const history = useMemo(() => runs.map((r) => ({ id: r.id, date: r.date, pages: pagesOf(r) })), [runs.map((r) => r.id).join(), latestPages]) // eslint-disable-line react-hooks/exhaustive-deps

  // the brand analysis's themes from the latest run (?mock=calm has nothing hurting): a dot's hover card names its
  // theme; Sources' "Also said on" reads them. What AI says about you is replaced by the sections below, in its design.
  const unlinked = q.get('themes') === 'unlinked'
  const swot = mock === 'calm' && data.swot ? { ...data.swot, weaknesses: [], threats: [] } : data.swot
  const groups = groupThemes(swot, latestPages)
  const linking = isLatest && !unlinked
  const lit = matchIds(pages, { engine, tone, theme: null })

  // a dot's theme: on its own side first (a positive page → Working for you), else the other side
  const themeOf = (page) => {
    const sides = page.tone === 'positive' ? [groups.working, groups.hurting] : [groups.hurting, groups.working]
    return sides.flat().find((x) => x.sources.includes(page.id)) ?? null
  }
  // a dot in the hero: opens its page's drawer
  const onDot = (page) => openDrawer('page', page.id)
  const themeFor = (page) => (linking ? themeOf(page) : null)
  // the paid run (the app: POST /api/reputation through its adapter, then the runs again)
  const start = () => { setConfirm(false); setRunning(true); toast(`Analyzing ${brand.name}: this takes a few minutes`) }

  const header = <Header brand={brand} engine={engine} setEngine={setEngine} running={running} onRun={() => setConfirm(true)} hideRun={never} />
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
    <HistoryCtx.Provider value={{ history }}>
    <div className="k-sent flex flex-col gap-16">
      <div className="flex flex-col gap-6">
        {header}
        {mock === 'error' && (
          <ErrorCard title="The latest run didn’t finish" reason={`Google credits are used up, so no pages could be found and nothing was charged. Below: the ${fmtDay(latest.date)} run.`} onRetry={() => setConfirm(true)} />
        )}
      <Hero heroRef={hero} col={col} change={change} brand={brand} run={run} isLatest={isLatest} onLatest={() => setRunId(null)} pages={pages} lit={lit} engine={engine}
        split={split} setSplit={setSplit} tone={tone} setTone={setTone} theme={null} clearTheme={() => {}} onDot={onDot} themeFor={themeFor} />
      </div>
      <OverTime runs={runs} run={run} pagesOf={pagesOf} engine={engine} brand={brand.name} onPick={(id) => setRunId(id === latest.id ? null : id)} />
      <Sources runs={runs} pagesOf={pagesOf} engine={engine} brand={brand.name} latestPages={latestPages} swot={swot} />
      <AllPages pages={pages} lit={lit} filtered={engine !== 'all' || Boolean(tone)} engine={engine} changeOf={changeOf} />
      <PageDrawer pages={pages} brand={brand} swot={swot} />
      {modal}{toastNode}
    </div>
    </HistoryCtx.Provider>
  )
}

// the line under the score, and the score label's ⓘ: a small tooltip on hover and keyboard focus
const SCORE_NOTE = 'We tracked and analyzed the primary sources AI models rely on to determine your brand’s online credibility.'
function InfoTip({ text }) {
  return (
    <span className="group/info relative inline-flex">
      <button type="button" aria-label={text} className={`grid h-4 w-4 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus ${t3} hover:text-stone-900`}>
        <Info size={13} aria-hidden />
      </button>
      <span role="tooltip" className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 w-max max-w-[240px] -translate-y-1/2 rounded-md border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 font-normal text-stone-700 opacity-0 shadow-sm transition-opacity duration-150 group-hover/info:opacity-100 group-focus-within/info:opacity-100 motion-reduce:transition-none">{text}</span>
    </span>
  )
}

// ---- motion helpers (page-local; the shared Segmented in components/dashboard is left as it is)
function AutoProgress({ running, ms, onDone, cycle }) {
  const el = useRef(null)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const node = el.current
    if (!node || !running) return undefined
    const a = node.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: ms, easing: 'linear', fill: 'forwards' })
    a.onfinish = () => done.current()
    return () => a.cancel()
  }, [running, cycle, ms])
  return <span ref={el} className="block h-full origin-left bg-[var(--ink)] opacity-60" style={{ transform: 'scaleX(0)' }} />
}

// a list's fade when the engine changes (180ms), without re-mounting it: the animation's name alternates so it restarts
function useEngineFade(engine) {
  const n = useRef(0)
  const prev = useRef(engine)
  if (prev.current !== engine) { prev.current = engine; n.current += 1 }
  return n.current === 0 || (typeof window !== 'undefined' && reduced()) ? undefined : { animation: `${n.current % 2 ? 'sent-fade-a' : 'sent-fade-b'} 180ms ease-out both` }
}
// a block whose height follows its content smoothly (240ms) instead of jumping
function AutoHeight({ children }) {
  const outer = useRef(null)
  const inner = useRef(null)
  useLayoutEffect(() => {
    const set = () => { if (outer.current && inner.current) outer.current.style.height = `${inner.current.offsetHeight}px` }
    set()
    const ro = new ResizeObserver(set)
    if (inner.current) ro.observe(inner.current)
    return () => ro.disconnect()
  }, [])
  const still = typeof window !== 'undefined' && reduced()
  return (
    <div ref={outer} style={{ position: 'relative', overflow: 'clip', overflowClipMargin: 4, transition: still ? 'none' : `height 240ms ${GLIDE}` }}>
      <div ref={inner}>{children}</div>
    </div>
  )
}

// ---- the sync history the hover cards and the expanded Sources rows read: each sync's date and its pages (Harsh's
// saved runs), set once by the page
const HistoryCtx = createContext({ history: [], latest: [] })
const TONE_FILL = { positive: 'var(--ink)', neutral: 'var(--sent-neutral)', mixed: 'var(--sent-mixed)', negative: 'var(--negative)', unscored: 'var(--color-stone-300)' }
// a site's tone in one sync: negative if any of its pages was, else positive if any was, else neutral; null = not cited
const siteToneIn = (pages, domain) => {
  const own = pages.filter((p) => p.domain === domain)
  if (!own.length) return null
  return own.some((p) => p.tone === 'negative') ? 'negative' : own.some((p) => p.tone === 'positive') ? 'positive' : own.some((p) => p.tone === 'mixed') ? 'mixed' : 'neutral'
}
// one square per sync, coloured by tone (ink / grey / red; an empty outline = not cited that sync); the date on hover
function ToneStrip({ cells, size = 10, dates = false }) {
  return (
    <span className="inline-flex flex-col gap-1">
      <span className="flex items-center gap-1" role="img" aria-label={cells.map((c) => `${fmtDay(c.date)}: ${c.tone ? TONE_LABEL[c.tone] : 'not cited'}`).join(', ')}>
        {cells.map((c) => (
          <span key={c.date} className="shrink-0 rounded-[2px]"
            style={{ width: size, height: size, ...(c.tone ? { background: TONE_FILL[c.tone] } : { boxShadow: 'inset 0 0 0 1px var(--color-stone-400)' }) }} />
        ))}
      </span>
      {dates && cells.length > 1 && (
        <span className="flex justify-between gap-3 text-[12px] leading-4 text-stone-500 tabular-nums" style={{ width: Math.max(96, cells.length * (size + 4) - 4) }}>
          <span>{fmtDay(cells[0].date)}</span><span>{fmtDay(cells.at(-1).date)}</span>
        </span>
      )}
    </span>
  )
}

// ---- the hover card (as What AI says about you's rows): after 300ms of hover (or on keyboard focus), under the row and
// left-aligned with its title (above it when the window has no room below), max 440px and never over the next row's
// tone column. One at a time; it closes 100ms after
// the cursor leaves the row and the card. Touch has no card (a tap acts at once). Fades and rises 4px in 150ms.
let closeOpenPeek = null
function usePeek() {
  const [at, setAt] = useState(null) // the row element the card is under
  const timer = useRef(0)
  const grace = useRef(0)
  const api = useRef(null)
  if (!api.current) {
    api.current = {
      hide: () => { clearTimeout(timer.current); clearTimeout(grace.current); setAt(null) },
      show: (el) => { if (closeOpenPeek && closeOpenPeek !== api.current.hide) closeOpenPeek(); closeOpenPeek = api.current.hide; setAt(el) },
    }
  }
  const { show, hide } = api.current
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(grace.current); if (closeOpenPeek === hide) closeOpenPeek = null }, [hide])
  // a scroll moves the row away from its card: close it
  useEffect(() => {
    if (!at) return undefined
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [at, hide])
  const row = {
    onPointerEnter: (e) => { if (e.pointerType !== 'mouse') return; clearTimeout(grace.current); const el = e.currentTarget; timer.current = setTimeout(() => show(el), 300) },
    onPointerLeave: (e) => { if (e.pointerType !== 'mouse') return; clearTimeout(timer.current); grace.current = setTimeout(hide, 100) },
    onFocus: (e) => { if (e.target.matches(':focus-visible')) show(e.currentTarget) },
    onBlur: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) hide() },
    onClick: () => hide(),
  }
  const card = { onPointerEnter: () => clearTimeout(grace.current), onPointerLeave: () => { grace.current = setTimeout(hide, 100) } }
  return { at, row, card, hide }
}
function PeekCard({ peek, children }) {
  const [box, setBox] = useState(null)
  useLayoutEffect(() => {
    const row = peek.at
    if (!row) { setBox(null); return }
    const r = row.getBoundingClientRect()
    const title = row.querySelector('[data-title]')?.getBoundingClientRect() ?? r
    const tone = row.querySelector('[data-tone]')?.getBoundingClientRect()
    const left = title.left
    const w = Math.min(440, (tone ? tone.left - 12 : r.right) - left, window.innerWidth - left - 16)
    setBox({ left, top: r.bottom + 4, w, above: r.top - 4 })
  }, [peek.at])
  // no room under the row (near the window's bottom): the card opens above it instead
  const cardRef = useRef(null)
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el || !box || box.flipped) return
    const h = el.getBoundingClientRect().height
    if (box.top + h > window.innerHeight - 8 && box.above - h > 8) setBox({ ...box, top: box.above - h, flipped: true })
  }, [box])
  const root = typeof document !== 'undefined' ? document.querySelector('.k-sent') : null
  if (!peek.at || !box || !root) return null
  return createPortal(
    <div ref={cardRef} role="tooltip" {...peek.card} style={{ position: 'fixed', left: box.left, top: box.top, maxWidth: box.w, width: 'max-content', animation: reduced() ? undefined : 'sent-peek-in 150ms ease-out both' }}
      className="z-[60] rounded-xl border border-line bg-raised p-3.5 shadow-lg">
      {children}
    </div>,
    root,
  )
}
// the card's content: the quote (no underline: no phrase marks in the data), or the full title and the tone strip
function PeekBody({ quote, title, cells, footer }) {
  return quote ? (
    <>
      <p className="text-[15px] leading-[22px] text-stone-900 [text-wrap:pretty]">“{quote}”</p>
      <p className="mt-1.5 text-[12px] leading-4 text-stone-500">{footer}</p>
    </>
  ) : (
    <>
      <p className="text-[15px] leading-[22px] font-medium text-stone-900 [text-wrap:pretty]">{title}</p>
      <div className="mt-2"><ToneStrip cells={cells} /></div>
      <p className="mt-1.5 text-[12px] leading-4 text-stone-500">Quote available after the next analysis</p>
    </>
  )
}
// a page row's card: its quote, else its title and its tone in every sync
function PagePeek({ peek, p }) {
  const { history } = useContext(HistoryCtx)
  const quote = p.sentences?.[0]?.text ?? null
  const cells = history.map((h) => ({ date: h.date, tone: h.pages.find((x) => x.id === p.id)?.tone ?? null }))
  return <PeekCard peek={peek}><PeekBody quote={quote} title={p.title} cells={cells} footer={`${p.domain} · Click to open`} /></PeekCard>
}

// ---- lists that move instead of jump (FLIP): rows that stay slide to their new place, rows that leave fade out where
// they were, rows that join fade in (15ms apart). Rows carry data-key; the list is position: relative.
function useFlip(ref, keys, { move = 200, enter = 160, exit = 120, stagger = 15 } = {}) {
  const prev = useRef(null)
  const sig = keys.join('|')
  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const items = [...box.children].filter((el) => el.dataset.key && !el.dataset.ghost)
    const top0 = box.getBoundingClientRect().top
    const now = items.map((el) => ({ key: el.dataset.key, el, top: el.getBoundingClientRect().top - top0 }))
    const before = prev.current
    prev.current = new Map(now.map((x) => [x.key, { top: x.top, node: x.el.cloneNode(true) }]))
    if (!before || reduced()) return
    let k = 0
    for (const x of now) {
      const was = before.get(x.key)
      if (was) {
        const d = was.top - x.top
        if (Math.abs(d) > 0.5) x.el.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: move, easing: EASE_OUT })
      } else {
        x.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: enter, delay: (k++) * stagger, easing: 'ease-out', fill: 'backwards' })
      }
    }
    const keep = new Set(now.map((x) => x.key))
    for (const [key, was] of before) {
      if (keep.has(key)) continue
      const ghost = was.node
      ghost.dataset.ghost = '1'
      ghost.setAttribute('aria-hidden', 'true')
      Object.assign(ghost.style, { position: 'absolute', left: '0', right: '0', top: `${was.top}px`, margin: '0', pointerEvents: 'none' })
      box.appendChild(ghost)
      ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: exit, easing: 'ease-out', fill: 'forwards' }).onfinish = () => ghost.remove()
    }
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps
}

// a text that crossfades to its new value (the old one fades out over the new one)
function FadeText({ text }) {
  const [items, setItems] = useState([{ text, k: 0 }])
  useEffect(() => {
    setItems((xs) => (xs.at(-1).text === text ? xs : [xs.at(-1), { text, k: xs.at(-1).k + 1 }]))
    const t = setTimeout(() => setItems((xs) => xs.slice(-1)), 220)
    return () => clearTimeout(t)
  }, [text])
  const still = typeof window !== 'undefined' && reduced()
  return (
    <span className="inline-grid">
      {items.map((it, i) => (
        <span key={it.k} style={{ gridArea: '1 / 1', animation: still || items.length < 2 ? undefined : `${i === items.length - 1 ? 'fade-in' : 'sent-fade-out'} 180ms ease-out both` }} aria-hidden={i < items.length - 1 || undefined}>{it.text}</span>
      ))}
    </span>
  )
}
// a number that tweens (the page's count-up), as text
const CountUp = ({ value }) => <>{useCountUp(value, 300)}</>

// ---- header: title + subtitle; the engine control, Re-analyze. No numbers. The brand is the sidebar's.
function Header({ brand, engine, setEngine, running, onRun, hideRun }) {
  const options = [{ value: 'all', label: 'All' }, ...ENGINES.map((e) => ({ value: e.id, label: <><span className="max-sm:hidden">{e.name}</span><span className="sm:hidden">{e.short}</span></> }))]
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2.5"><h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">Sentiment</h1><BetaTag tipAlign="left" className="-translate-y-[3px] lg:-translate-y-[6px]" /></div>
        <p className="mt-1 text-body text-stone-600">How the pages AI cites describe {brand.name}.</p>
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:gap-2.5">
        <Seg label="Engine" value={engine} onChange={setEngine} options={options} className="max-lg:w-full" full={false} />
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
      subtitle="A paid scan: it uses Google credits and an AI read for every page it finds."
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
function Hero({ heroRef, col, change: sync, brand, run, isLatest, onLatest, pages, lit, engine, split, setSplit, tone, setTone, theme, clearTheme, onDot, themeFor }) {
  const explain = useExplain(`${run.id}|${engine}`)
  // the picked sync's column (syncColumns): the same pages and counts as This sync and the Pages list
  const c = col.counts
  const score = scoreOf(c)
  const counted = useCountUp(score, 300, 0)
  // the change since the sync before (syncScoreChange, the tooltip's number): the arrow beside the score (none on
  // the first sync, a gap or no change) and the line under it ("▲ +15 since Oct 27", "No change since …", "First run")
  const change = sync?.delta ? sync : null
  const countedChange = useCountUp(change ? Math.abs(change.delta) : null, 300, 0)
  const text = sentimentInsight(c, brand.name)
  const move = c.positive + c.neutral + c.negative > 0 ? scoreChangeLine(sync, fmtDay) : null
  const moveClass = sync?.dir === 'down' ? 'text-negative' : sync?.dir === 'up' ? 'text-[var(--rep-up-fg)]' : t3
  // the score column and the chart end at the same height (two columns, lg+): the dot plot is only as tall as the
  // score column (its score and lines), never shorter than its dots need; the insight runs full width under both
  const wide = useMedia('(min-width: 1024px)')
  const colTop = useRef(null)
  const [colH, setColH] = useState(null)
  useLayoutEffect(() => {
    if (!wide) { setColH(null); return }
    const measure = () => setColH(colTop.current?.offsetHeight ?? 0)
    measure()
    const ro = new ResizeObserver(measure)
    if (colTop.current) ro.observe(colTop.current)
    return () => ro.disconnect()
  }, [wide])
  const fitH = colH == null ? null : Math.max(0, colH - CHART_CHROME)
  return (
    <section ref={(el) => { explain.cardRef.current = el; heroRef.current = el }} aria-label="Sentiment spectrum" className="scroll-mt-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <div className="flex flex-col">
          <div ref={colTop} className="flex flex-col">
          {!isLatest && (
            <p className={`mb-3 text-[13px] leading-[18px] ${t2}`}>
              Viewing the {fmtDay(run.date)} run · <button type="button" onClick={onLatest} className="rounded font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">back to latest</button>
            </p>
          )}
          <span className={`flex items-center gap-1.5 text-[13px] leading-[18px] font-medium ${t2}`}>Sentiment score{engine === 'all' ? '' : ` · ${engineName(engine)}`}<InfoTip text={scoreInfo(c)} /></span>
          <span className="mt-1 flex items-center gap-3 tabular-nums">
            <span className="text-[64px] leading-[64px] font-semibold tracking-[-0.03em] text-stone-900 lg:text-[80px] lg:leading-[80px]">{counted ?? '—'}</span>
            {/* ▲ +3 / ▼ −3 since the sync before, about 40% of the score's size, centred on it; counts in with it */}
            {change && (
              <span data-score-change={change.dir} aria-label={`${change.dir === 'up' ? 'Up' : 'Down'} ${Math.abs(change.delta)} since ${fmtDay(change.since)}`}
                className={`inline-flex items-center gap-1 text-[26px] leading-[26px] font-semibold tracking-[-0.02em] lg:text-[32px] lg:leading-[32px] ${change.dir === 'up' ? 'text-[var(--rep-up-fg)]' : 'text-negative'}`}>
                <span aria-hidden className="text-[0.6em]">{change.arrow}</span>
                <span aria-hidden>{change.dir === 'up' ? '+' : '−'}{countedChange ?? Math.abs(change.delta)}</span>
              </span>
            )}
          </span>
          {/* the first sync scored the new way: "Scoring updated Nov 2" (muted) and its ⓘ, no arrow (utils/sentimentSections.js scoringChangedAt) */}
          {move && (sync?.scoringUpdated
            ? <span data-scoring-updated className={`mt-2 flex items-center gap-1.5 text-[14px] leading-5 font-medium ${t3}`}>{move}<InfoTip text={SCORING_UPDATED_TIP} /></span>
            : <span className={`mt-2 text-[14px] leading-5 font-medium ${moveClass}`}>{move}</span>)}
          <span className="mt-2 text-[15px] leading-[22px] text-stone-900 [text-wrap:pretty]">{heroLine(score, c)}</span>
          {(c.positive + c.neutral + c.mixed + c.negative + c.unscored) > 0 && <>
            <span className={`mt-3 text-[12px] leading-4 ${t3} [text-wrap:pretty]`}>{SCORE_NOTE}</span>
            <span className={`mt-1 text-[12px] leading-4 ${t3} tabular-nums`}>{scoredLine(c)}</span>
          </>}
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className={`min-w-0 truncate text-[13px] leading-[18px] ${t2} ${theme ? '' : 'max-sm:invisible'}`}>
              {theme ? <>Pages behind “{theme.theme}” · <button type="button" onClick={clearTheme} className="rounded font-medium text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">clear</button></> : 'Every page is a dot, placed by its tone'}
            </span>
            <Switch checked={split} onChange={setSplit} spring>Split by engine</Switch>
          </div>
          <Spectrum pages={pages} lit={lit} engine={engine} split={split} onDot={onDot} themeFor={themeFor} filter={{ c, tone, setTone, explain }} fitH={fitH}
            onMore={(t) => { setParams({ ptone: t }); openDrawer('syncpages', col.r.id) }} />
        </div>
      </div>
      {text && <div className="mt-6"><Insight explain={explain} text={text} evidence={{ keys: ['tones'], calc: `Scored pages in the ${fmtDay(run.date)} run. Score = 50 + (positive − negative) ÷ scored pages × 50. Unreadable pages are not scored and are not part of the score.` }} /></div>}
    </section>
  )
}

const CHART_CHROME = 26 // the chart column above the grid: the label row (18 + mb-2)

// the tone grid's four labels, each in its quadrant's outer corner; with tone filtering (the hero) each one filters the
// dots (again: all), elsewhere they're plain text
const CORNER = { neutral: 'left-0 top-0', positive: 'right-0 top-0', negative: 'left-0 bottom-0', mixed: 'right-0 bottom-0' }
const QUAD_TEXT = { positive: 'text-ink', negative: 'text-negative', neutral: t3, mixed: t3 }
// a faint red on Negative only; Positive has no fill (a grey fill read as a box, owner 2026-11-04)
const QUAD_TINT = { negative: 'color-mix(in srgb, var(--negative) 4%, transparent)' }
const QUAD_ORDER = ['neutral', 'positive', 'negative', 'mixed']

// ---- the tone grid: 2×2 by tone (Neutral · Positive over Negative · Mixed), every page a dot in its tone's quadrant,
// packed in rows (utils/spectrum quadrantPack). "Split by engine": one dot per citing engine, each with its engine's
// badge (pages carry one tone, so a page's engine dots share its quadrant). Dots move between quadrants with FLIP on
// transform / opacity (Web Animations API), from wherever they are now, so an engine switch or another sync mid-move
// reverses smoothly. No React state changes per frame.
const MOVE = { dur: 550, step: 8, cap: 250, height: 450 }
let EASE = null // the spring easing, if the browser takes linear(); else a cubic with a small overshoot
const ease = () => {
  if (EASE) return EASE
  try { document.createElement('div').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1, easing: springEasing() }).cancel(); EASE = springEasing() } catch { EASE = 'cubic-bezier(.2, 1.12, .36, 1)' }
  return EASE
}
// move one element to a target transform / opacity, from where it is now
function moveTo(el, t, o, { delay = 0, dur = MOVE.dur, easing = ease(), first = false } = {}) {
  if (!el) return 0
  const sameT = el.dataset.t === t, sameO = el.dataset.o === String(o)
  if (sameT && sameO) return 0
  if (first || !el.dataset.t) { el.style.transform = t; el.style.opacity = o; el.dataset.t = t; el.dataset.o = String(o); return 0 }
  const cs = getComputedStyle(el)
  const from = { transform: cs.transform === 'none' ? 'translate(0px, 0px)' : cs.transform, opacity: cs.opacity }
  el.getAnimations().forEach((a) => a.cancel())
  el.style.transform = t; el.style.opacity = o; el.dataset.t = t; el.dataset.o = String(o)
  if (reduced()) { el.animate([{ opacity: 0 }, { opacity: o }], { duration: 150, easing: 'linear' }); return 150 }
  // only the opacity changes (a filter dims it): quick, no stagger
  const d = sameT ? 200 : dur
  el.animate([from, { transform: t, opacity: o }], { duration: d, delay: sameT ? 0 : delay, easing: sameT ? 'ease-out' : easing, fill: 'backwards' })
  return (sameT ? 0 : delay) + d
}

function Spectrum({ pages: listed, lit, engine, split, onDot = (p) => openDrawer('page', p.id), themeFor = () => null, filter = null, fitH = null, onMore = null }) {
  // only pages with a tone are placed: Not scored pages are listed (Pages, drawer), never on the grid
  const pages = useMemo(() => listed.filter((p) => p.tone in BAND), [listed])
  const box = useRef(null)
  const mobile = useIsMobile()
  const [w, setW] = useState(800)
  const [hover, setHover] = useState(null) // { page, x, y }
  const [focusId, setFocusId] = useState(null)
  const els = useRef({}) // key → dot element ('p1#0', …)
  const movingUntil = useRef(0)
  const firstPaint = useRef(true)
  useLayoutEffect(() => {
    if (!box.current) return
    setW(box.current.clientWidth) // the real width before anything is placed (a guessed one would overflow on phones)
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])
  const r = mobile ? 12 : 18
  const W = Math.max(160, w)
  // about 240px; in the hero as tall as the score column (both end level), never shorter than two rows need
  const H = Math.max(quadrantMinH(r), fitH ?? 240)
  const { c, tone, setTone, explain } = filter || {}
  const counts = c ?? countTones(pages)

  // every dot (one per page; split: one per citing engine) and which are on the grid now
  const byId = new Map(pages.map((p) => [p.id, p]))
  const plan = dotPlan(pages, ENGINES, split).map((d) => ({ ...d, page: byId.get(d.pageId) }))
  const isActive = (d) => d.shown && (split ? engine === 'all' || d.lane === engine : engine === 'all' || d.page.engines.includes(engine))
  const pack = (list) => quadrantPack(list.map((d) => ({ key: d.key, tone: d.page.tone })), { width: W, height: H, r })
  const live = pack(plan.filter(isActive))
  const every = pack(plan.filter((d) => d.shown)) // where a dot that's off the grid fades out (its last place)
  const placed = plan.map((d) => {
    const on = isActive(d) && Boolean(live.pos[d.key])
    const at = live.pos[d.key] ?? every.pos[d.key] ?? every.pos[`${d.pageId}#0`] ?? live.pos[`${d.pageId}#0`] ?? { x: W / 2, y: H / 2 }
    const lit_ = on && lit.has(d.page.id)
    return { ...d, x: at.x, y: at.y, o: !on ? 0 : lit_ ? 1 : 0.12, on: lit_ }
  })
  const usable = placed.filter((d) => d.on)
  const tabKey = usable.some((d) => d.key === focusId) ? focusId : [...usable].sort((a, b) => a.y - b.y || a.x - b.x)[0]?.key
  const onKey = (e, d) => {
    if (e.key === 'Escape') { setHover(null); return }
    if (!e.key.startsWith('Arrow')) return
    e.preventDefault()
    const next = neighbour(usable.map((u) => ({ id: u.key, x: u.x, y: u.y })), d.key, e.key)
    setFocusId(next)
    els.current[next]?.focus()
  }
  // no hover card while dots are travelling
  const show = (d) => { if (performance.now() >= movingUntil.current) setHover({ page: d.page, x: d.x, y: d.y }) }

  const sig = `${split}|${engine}|${W}|${H}|${pages.map((p) => p.id + p.tone).join()}|${[...lit].join()}`
  const lastMode = useRef({ engine, split })
  useLayoutEffect(() => {
    const first = firstPaint.current
    firstPaint.current = false
    // an engine switch alone moves the dots in 300ms with a slight stagger (fading as they leave or join)
    const engineOnly = !first && lastMode.current.engine !== engine && lastMode.current.split === split
    lastMode.current = { engine, split }
    const order = [...placed].sort((a, b) => a.y - b.y || a.x - b.x)
    const delays = staggerDelays(order.length, engineOnly ? { step: 6, cap: 90 } : MOVE)
    let end = 0
    order.forEach((d, i) => { end = Math.max(end, moveTo(els.current[d.key], `translate(${d.x - r}px, ${d.y - r}px)`, d.o, { delay: delays[i], first, ...(engineOnly ? { dur: 300 } : {}) })) })
    if (end) { movingUntil.current = performance.now() + end; setHover(null) }
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps

  const reg = (key) => (el) => { if (el) els.current[key] = el; else delete els.current[key] }
  // split: hovering one dot highlights the page's other dots (the rest step back)
  const peerOf = split && hover ? hover.page.id : null
  return (
    <div ref={box} className="relative [overflow-x:clip] [overflow-clip-margin:24px]" onMouseLeave={() => setHover(null)}>
      <div className="relative" style={{ height: H }} {...(filter ? hl(explain, 'tones') : {})}>
        {/* the quadrants: a faint cross, a faint red only on Negative, no boxes */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {Object.entries(QUAD_TINT).map(([k, bg]) => {
            const [cx, cy] = QUADRANT[k]
            return <div key={k} className={`absolute ${cy ? 'rounded-bl-xl' : 'rounded-tr-xl'}`} style={{ left: cx * W / 2, top: cy * H / 2, width: W / 2, height: H / 2, background: bg }} />
          })}
          <div className="absolute inset-y-0 border-l border-line-strong" style={{ left: W / 2 }} />
          <div className="absolute inset-x-0 border-t border-line-strong" style={{ top: H / 2 }} />
        </div>
        <div className="absolute inset-0" {...(filter ? { role: 'group', 'aria-label': 'Filter by tone' } : {})}>
          {QUAD_ORDER.map((k) => {
            const [cx, cy] = QUADRANT[k]
            const text = <>{TONE_LABEL[k]} <span className="tabular-nums">{counts[k] ?? 0}</span></>
            const at = { left: cx * W / 2, top: cy * H / 2, width: W / 2, height: H / 2 }
            const cls = `absolute ${CORNER[k]} whitespace-nowrap text-[13px] leading-[18px] font-medium ${QUAD_TEXT[k]}`
            return (
              <div key={k} className="pointer-events-none absolute" style={at}>
                {filter
                  ? <button type="button" aria-pressed={tone === k} onClick={() => setTone(tone === k ? null : k)}
                      className={`${cls} pointer-events-auto m-0.5 rounded px-1 outline-none transition-opacity duration-200 focus-visible:ring-2 focus-visible:ring-focus ${tone && tone !== k ? 'opacity-40' : ''} ${tone === k ? 'underline decoration-2 underline-offset-4' : 'hover:underline underline-offset-4'}`}>{text}</button>
                  : <span className={`${cls} m-0.5 px-1`}>{text}</span>}
              </div>
            )
          })}
        </div>

        {/* the dots (split copies hide under their page's dot until the split) */}
        {placed.map((d, n) => {
          const dim = peerOf && d.page.id !== peerOf
          return (
            <button key={d.key} ref={reg(d.key)} type="button"
              tabIndex={d.on && d.key === tabKey ? 0 : -1} aria-hidden={!d.on}
              aria-label={`${d.page.title}, ${d.page.domain}${split && d.lane !== 'all' ? ` on ${ENGINES.find((e) => e.id === d.lane)?.name ?? d.lane}` : ''}: ${TONE_LABEL[d.page.tone].toLowerCase()}. ${themeFor(d.page) ? `Open “${themeFor(d.page).theme}” below` : 'Open its quotes'}`}
              onClick={(e) => { setHover(null); onDot(d.page); e.currentTarget.blur() }}
              onMouseEnter={() => d.on && show(d)} onFocus={() => { setFocusId(d.key); show(d) }} onBlur={() => setHover(null)} onKeyDown={(e) => onKey(e, d)}
              className={`absolute left-0 top-0 grid place-items-center rounded-full bg-surface outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${d.on ? 'z-[2] hover:z-[3]' : 'pointer-events-none'}`}
              style={{ width: 2 * r, height: 2 * r, willChange: 'transform' }}>
              {/* tone ring · a sliver of surface · a white plate, so dark logos show in both themes */}
              <span className="dot-in grid h-full w-full place-items-center rounded-full border-2 bg-surface transition-opacity duration-150"
                style={{ borderColor: RING[d.page.tone], opacity: dim ? 0.3 : 1, animation: d.copy ? undefined : `dot-in 420ms cubic-bezier(.2,.8,.2,1) ${Math.min(n, 30) * 22}ms both` }}>
                <span className="grid h-[calc(100%-4px)] w-[calc(100%-4px)] place-items-center rounded-full"
                  style={{ background: d.page.tone === 'negative' ? 'color-mix(in srgb, var(--negative) 14%, #fff)' : '#fff' }}>
                  <SiteLogo domain={d.page.domain} name={d.page.domain} className={`${mobile ? 'h-3.5 w-3.5' : 'h-5 w-5'} rounded-full !border-0 !bg-transparent`} initialClass="text-[9px] !text-[#44403c]" />
                </span>
              </span>
              {split && d.lane !== 'all' && (
                <span aria-hidden className="absolute -bottom-1 -right-1 grid h-[18px] w-[18px] place-items-center rounded-full bg-surface ring-1 ring-line transition-opacity duration-150" style={{ opacity: dim ? 0.3 : 1 }}>
                  <EngineIcon id={d.lane} size={12} />
                </span>
              )}
            </button>
          )
        })}
        {/* more than two rows in a quadrant: "+n more" opens the pages drawer on that tone */}
        {Object.entries(live.more).map(([k, m]) => (
          <button key={k} type="button" onClick={() => (onMore ? onMore(k) : null)} disabled={!onMore}
            aria-label={`${m.n} more ${TONE_LABEL[k].toLowerCase()} ${split ? 'dots' : 'pages'}`}
            className={`absolute z-[2] grid place-items-center rounded-full border border-line bg-surface text-[13px] leading-[18px] font-medium tabular-nums outline-none transition-colors hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus ${t2}`}
            style={{ left: m.x - m.w / 2, top: m.y - r, width: m.w, height: 2 * r }}>+{m.n} more</button>
        ))}
        {hover && <HoverCard hover={hover} w={w} r={r} theme={themeFor(hover.page)} />}
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
        <SiteLogo domain={p.domain} name={p.domain} className="mt-0.5 h-5 w-5 shrink-0 rounded !border-0" initialClass="text-[10px]" />
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
        <div className="min-w-0"><Spectrum pages={shown} lit={new Set(shown.map((p) => p.id))} engine="all" split={false} /></div>
      </div>
    </section>
  )
}

// every link out: the page's exact cited URL (normalised, utils/spectrum pageHref), in a new tab; no URL → no link
const LINK = { target: '_blank', rel: 'noopener noreferrer' }
const OpenPage = ({ page }) => {
  const href = pageHref(page)
  if (!href) return null
  return (
    <a href={href} {...LINK} className="inline-flex items-center gap-1 rounded text-[13px] font-medium text-stone-900 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">
      Open page <ArrowUpRight size={14} aria-hidden /><span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}
// a quote's source: favicon + domain (a link to the page) and Open page
function Source({ page }) {
  const href = pageHref(page)
  const inner = <><SiteLogo domain={page.domain} name={page.domain} className="h-3.5 w-3.5 rounded-full !border-0" initialClass="text-[7px]" />{page.domain}</>
  return (
    <span className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-[18px] ${t3}`}>
      {href
        ? <a href={href} {...LINK} className="inline-flex items-center gap-1.5 rounded outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">{inner}<span className="sr-only">(opens in a new tab)</span></a>
        : <span className="inline-flex items-center gap-1.5">{inner}</span>}
      <OpenPage page={page} />
    </span>
  )
}
// a clickable logo stack: at most three, then "+N", overlapping by 6px in a 2px page-colour ring; each logo opens its
// page (its domain in a tooltip), and the stack's tooltip lists every domain. Clicks don't reach the row underneath.
function FaviconLinks({ pages, size = 'md' }) {
  const { shown, more } = capStack(pages, 3)
  const box = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'
  const img = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  return (
    <span className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
      <span className="flex -space-x-1.5">
        {shown.map((p) => {
          const href = pageHref(p)
          const face = (
            <span className={`grid ${box} place-items-center overflow-hidden rounded-full ring-2 ring-surface`} style={{ background: '#fff' }}>
              <SiteLogo domain={p.domain} name={p.domain} className={`${img} rounded-full !border-0 !bg-transparent`} initialClass="text-[8px] !text-[#44403c]" />
            </span>
          )
          return href ? (
            <a key={p.id} href={href} {...LINK} aria-label={`${p.domain} (opens in a new tab)`}
              className="group/fav relative rounded-full outline-none transition-transform duration-150 hover:z-10 hover:-translate-y-0.5 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none">
              {face}
              <span className="pointer-events-none absolute max-sm:hidden bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-raised px-2 py-1 text-[12px] leading-4 font-medium text-stone-700 opacity-0 shadow-sm transition-opacity duration-150 group-hover/fav:opacity-100 group-focus-visible/fav:opacity-100" aria-hidden>{p.domain}</span>
            </a>
          ) : <span key={p.id} role="img" aria-label={`${p.domain} (no link stored)`}>{face}</span>
        })}
      </span>
      {more > 0 && <span className={`ml-1.5 text-[12px] leading-4 tabular-nums ${t3}`}>+{more}</span>}
    </span>
  )
}
// ---- Over time + Pages on <date>: one section in the design of "What AI says about you", on one grid so the two
// columns share their rows: the header row (one hairline), the toolbar row, then the chart beside the first 8 pages
// (the plot's top and 0% line are the list's top and its 8th row's bottom). The data is Harsh's (syncColumns,
// freshPageIds, sortPages). Clicking a column picks that sync for the page; "Show all" opens the pages in a drawer.
// Type: section titles 18/600, column heads 15/600, row titles 15/600 ink, secondary text 14/400 muted.
// Mix view's fills, bottom to top: negative (red), neutral a visible mid grey (--sent-track: #CECECE light, 1.5:1 on the
// page; #3A3A3A dark, 1.85:1), mixed its own darker grey (--sent-mixed), positive (ink). The legend dot and the This sync
// tile use the same fill
const MIX_FILL = { negative: 'var(--negative)', neutral: 'var(--sent-track)', mixed: 'var(--sent-mixed)', positive: 'var(--ink)' }
const AUTO_MS = 4000 // Over time: Mix ↔ Score every 4s until the user chooses
const PLOT_H = 260 // the Over time plot: a fixed height in Mix and Score (not matched to the pages list)
const MIX_ORDER = ['negative', 'neutral', 'mixed', 'positive']
const ROW_H = 52 // a row: the same 52px as What AI says
const LIST_ROWS = 6 // Pages on <date>: 6 rows, then "Show all N" (the drawer): the two columns end about level
const COL_HEAD = 'flex h-11 items-end justify-between gap-3 border-b border-line pb-2'
const COL_TITLE = 'flex items-baseline gap-2 text-[15px] leading-[22px] font-semibold'
const ROW_TITLE = 'truncate text-[15px] leading-[22px] font-semibold text-stone-900' // row titles 15/600
const SECOND = 'text-[14px] leading-5 font-normal text-stone-500'
// every segmented control in these sections: 36px tall, 14px padding per option, 4px apart
const SEG = 'gap-1 [&>button]:px-3.5'
// the pages list: favicon | title (and "New") | domain ↗ | engines | tone (or "Neutral → Negative")
const PAGE_GRID = 'grid grid-cols-[20px_minmax(0,1fr)_168px_76px_136px] items-center gap-x-2.5 max-md:grid-cols-[20px_minmax(0,1fr)_112px]' // phones: favicon, title, tone
const VIEWS = [{ value: 'mix', label: 'Mix' }, { value: 'score', label: 'Score' }]
const EASE_OUT = 'cubic-bezier(.2,.8,.2,1)'


// a favicon in the logo stacks' ring (20px), at the start of a row
function Fav({ domain }) {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full ring-2 ring-surface" style={{ background: '#fff' }}>
      <SiteLogo domain={domain} name={domain} className="h-3.5 w-3.5 rounded-full !border-0 !bg-transparent" initialClass="text-[8px] !text-[#44403c]" />
    </span>
  )
}

// the width of an element, kept up to date
// a small popover under its button (Compare, Engines): Esc or a click outside closes it
function Pop({ label, icon: Icon = ChevronDown, children, align = 'right', width = 320, dialog = 'Options', onOpen }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const down = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', esc, true) }
  }, [open])
  return (
    <div ref={box} className="relative shrink-0">
      <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => { if (!open) onOpen?.(); setOpen((v) => !v) }}
        className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[14px] leading-5 font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
        {label}<Icon size={14} className={`transition-transform duration-150 ${open && Icon === ChevronDown ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      {open && (
        <div role="dialog" aria-label={dialog} style={{ width }} className={`absolute top-full z-40 mt-2 rounded-xl border border-line bg-raised p-4 shadow-lg motion-safe:animate-[fade-in_120ms_ease-out] ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  )
}

// the left column's chart: Mix (each sync's pages by tone, 100% stacked) or Score (0–100 per sync, 50 = neutral).
// Real colours on every column, 2px page-colour gaps between segments, 3px corners on the top segment's top; the picked
// sync has its date in 600 ink with a 2px ink bar under it. Hover: a soft band behind the column and the card beside it
// (never over it), both sliding to the next column; touch: a tap shows them, a tap outside hides them.
// Motion: the views crossfade (200ms); bars grow from the baseline on a view switch (300ms, 30ms apart) and to their new
// heights on an engine switch (300ms); the Score line draws in (400ms). Reduced motion: none of it.
const SLIDE = 'cubic-bezier(.2,.8,.2,1)'
const TIP_W = 240 // the sync card's width (utils/sentimentSections tipLeft uses the same)
// Score's latest-sync card, docked right of the plot (1280px and wider) or under the chart (narrower)
const DOCK_W = 184
const DOCK_GAP = 12
const DOCK_DELAY = 600 // the line draws in 400ms; the card comes 200ms after it
// a number that eases to its target (300ms), for the plot's width as the docked card makes room
function useEased(target, dur = 300) {
  const [v, setV] = useState(target)
  const cur = useRef(target)
  useEffect(() => {
    const a = cur.current
    if (a === target) return undefined
    if (reduced()) { cur.current = target; setV(target); return undefined }
    const t0 = performance.now()
    let raf
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur)
      const e = 1 - (1 - k) ** 3
      cur.current = a + (target - a) * e
      setV(cur.current)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, dur])
  return v
}
// a card's contents crossfading when the sync it shows changes (150ms)
function SyncChart({ cols, view, docked = false, hidden, pickedId, onPick, plotH, tips, label, focusTone = null }) {
  const [ref, width] = useWidth()
  // Score shows the latest sync's card only while the section is idle (docked: utils/sentimentSections.js
  // scoreCardDocked): right of the plot from 1280px (the plot narrows to make room, 300ms), under the chart below that.
  // Once the section is in use it fades out (150ms) and the plot widens back (300ms): every date, "Neutral" and the
  // normal hover card, exactly as without it.
  const wide = useMedia('(min-width: 1280px)')
  const dockOn = docked
  const dockSpace = useEased(dockOn && wide ? DOCK_W + DOCK_GAP : 0)
  const [hover, setHover] = useState(null)
  const [last, setLast] = useState(null) // the card keeps its last column while it fades out
  const still = typeof window !== 'undefined' && reduced()
  const [runs, setRuns] = useState({ mix: 0, score: 0 })
  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; return } setRuns((r) => ({ ...r, [view]: r[view] + 1 })) }, [view])
  useEffect(() => { if (hover != null) setLast(hover) }, [hover])
  // touch: a tap outside the chart hides the card
  useEffect(() => {
    if (hover == null) return undefined
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setHover(null) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [hover]) // eslint-disable-line react-hooks/exhaustive-deps
  const n = cols.length
  const left = 40
  // the Score view's "Neutral" label (docked: no label, so the gutter goes to the plot)
  const right = 64 - (Math.min(dockSpace, DOCK_W + DOCK_GAP) / (DOCK_W + DOCK_GAP)) * 56
  const top = 1 // the list's top hairline
  const bottom = 44 // the date, then the page count
  const height = top + plotH + bottom
  const plotW = Math.max(0, width - dockSpace - left - right)
  const slot = n ? plotW / n : 0
  const colW = Math.max(6, Math.min(40, slot * 0.56))
  const bandW = Math.min(slot - 4, colW + 20)
  const x = (i) => left + slot * i + slot / 2
  const y = (v) => top + plotH - (v / 100) * plotH
  const points = cols.map((c, i) => ({ i, score: scoreOf(c.counts) })).filter((p) => p.score != null)
  // the first sync scored the new way: a dashed line labelled "Scoring updated" (Visibility history's marker style)
  const updatedAt = cols.findIndex((c, i) => scoringChangedAt(cols, i))
  const key = (e, id) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(id) } }
  const fade = (on) => ({ opacity: on ? 1 : 0, transition: still ? 'none' : 'opacity 200ms ease-out', pointerEvents: 'none' })
  const grow = still ? 'none' : 'y 300ms ease-out, height 300ms ease-out'
  const at = hover ?? last
  // the date labels' widths (the underline matches the picked one)
  const labels = useRef([])
  const [labelW, setLabelW] = useState([])
  useLayoutEffect(() => { setLabelW(labels.current.slice(0, n).map((el) => (el ? Math.round(el.getComputedTextLength()) : 28))) }, [n, width])
  const pickedIndex = cols.findIndex((c) => c.r.id === pickedId)
  // the card beside the column, 12px off it, from the plot's top: to its right if it fits in the chart column, else to its
  // left. Never over the column itself.
  // the side is decided per bar from the chart column's own width (the same bar always opens on the same side), so
  // the card never crosses into the Pages column; neither side fits: kept inside the column
  const tipX = (i) => tipLeft(x(i), colW, width)
  return (
    <>
    <div ref={ref} className="relative w-full" style={{ height }} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} className="block overflow-visible">
          {/* the hover band, behind everything */}
          <rect x={0} y={top} width={bandW} height={plotH} rx={6} fill="var(--tabs)" aria-hidden
            style={{ transform: `translateX(${at != null ? x(at) - bandW / 2 : 0}px)`, opacity: hover != null ? 1 : 0, transition: still ? 'none' : `transform 160ms ${SLIDE}, opacity ${hover != null ? 150 : 120}ms ease-out` }} />
          {[0, 50, 100].map((t) => (
            <g key={t}>
              <line x1={left} x2={left + plotW} y1={y(t)} y2={y(t)} stroke="var(--div)" />
              <text x={left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={12} fill="var(--color-stone-500)" className="tabular-nums">{view === 'mix' ? `${t}%` : t}</text>
            </g>
          ))}
          {/* Mix: every tone always drawn (0 tall when hidden or absent), so a new engine's values animate */}
          <g style={fade(view === 'mix')} aria-hidden={view !== 'mix'}>
            {cols.map((c, i) => {
              const x0 = x(i) - colW / 2
              const enter = still ? undefined : { transformBox: 'fill-box', transformOrigin: 'bottom', animation: `rep-grow 300ms ease-out ${i * 30}ms both` }
              // the column's segments (utils/mixBars.js, shared with Content's Search Console Mix): a 2px page-colour gap
              // under every segment but the lowest one shown, the top one rounded
              const segs = stackSegments(MIX_ORDER, (t) => (!hidden.has(t) && c.pct[t] ? c.pct[t] : 0), y)
              return (
                <g key={`${c.r.id}-${runs.mix}`} style={enter}>
                  {segs.map(({ key: t, yTop, h, r }) => {
                    // the picked bar under a tone filter or a This sync preview: that segment ringed, the others at 50%
                    const focusHere = focusTone && c.r.id === pickedId
                    return (
                      <g key={t} style={{ opacity: focusHere && t !== focusTone ? 0.5 : 1, transition: still ? 'none' : 'opacity 160ms ease-out' }}>
                        {focusHere && t === focusTone && h > 0 && <rect x={x0 - 2} y={yTop - 2} width={colW + 4} height={h + 4} rx={4} fill="none" stroke="var(--color-line-strong)" strokeWidth={2} />}
                        <rect x={x0} width={colW} rx={r} fill={MIX_FILL[t]} style={{ y: yTop, height: h, transition: grow }} />
                        {/* square bottom corners under the rounded top */}
                        <rect x={x0} width={colW} fill={MIX_FILL[t]} style={{ y: yTop + r, height: Math.max(0, h - r), transition: grow }} />
                      </g>
                    )
                  })}
                </g>
              )
            })}
          </g>
          {/* Score */}
          <g style={fade(view === 'score')} aria-hidden={view !== 'score'}>
            <line x1={left} x2={left + plotW} y1={y(50)} y2={y(50)} stroke="var(--color-stone-500)" strokeDasharray="4 4" />
            {/* with the card docked the plot has no room for the label beside the line (it sat on the line) */}
            {dockSpace === 0 && <text x={left + plotW + 8} y={y(50)} dy="0.32em" fontSize={12} fill="var(--color-stone-600)">Neutral</text>}
            {updatedAt > 0 && (() => {
              const mx = x(updatedAt)
              const onRight = mx > left + plotW * 0.6
              return (
                <g data-scoring-marker className="pointer-events-none">
                  <line x1={mx} x2={mx} y1={top} y2={top + plotH} stroke="var(--color-stone-400)" strokeWidth={1} strokeDasharray="3 3" />
                  <text x={onRight ? mx - 6 : mx + 6} y={top + 12} textAnchor={onRight ? 'end' : 'start'} fontSize={12} fill="var(--color-stone-500)">Scoring updated</text>
                </g>
              )
            })()}
            {points.length > 1 && (
              <polyline key={`line-${runs.score}`} points={points.map((p) => `${x(p.i)},${y(p.score)}`).join(' ')} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round"
                pathLength={1} strokeDasharray={still ? undefined : 1} style={still ? undefined : { animation: `sent-draw 400ms ease-out both` }} />
            )}
            {points.map((p) => {
              const on = cols[p.i].r.id === pickedId
              return <circle key={p.i} cx={x(p.i)} r={on ? 5 : 4} fill="var(--ink)" stroke="var(--color-surface)" strokeWidth={2} style={{ cy: y(p.score), transition: still ? 'none' : 'cy 300ms ease-out' }} />
            })}
          </g>
          {cols.map((c, i) => {
            const on = c.r.id === pickedId
            const swap = still ? 'none' : 'opacity 220ms ease-out'
            // columns too narrow for every date (the docked card's room): every other date, counted from the
            // latest, and always the picked one
            const dateOn = dockSpace === 0 || slot >= 44 || (n - 1 - i) % 2 === 0
            const dim = (o) => (dateOn ? o : 0)
            return (
              <g key={`l-${c.r.id}`} aria-hidden>
                {/* the date twice: muted 400 and ink 600, crossfading as the pick moves */}
                <text x={x(i)} y={top + plotH + 18} textAnchor="middle" fontSize={12} fill="var(--color-stone-500)" fontWeight={400} style={{ opacity: on ? 0 : dim(1), transition: swap }}>{fmtDay(c.date)}</text>
                <text ref={(el) => { labels.current[i] = el }} x={x(i)} y={top + plotH + 18} textAnchor="middle" fontSize={12} fill="var(--ink)" fontWeight={600} style={{ opacity: on ? 1 : 0, transition: swap }}>{fmtDay(c.date)}</text>
                <text x={x(i)} y={top + plotH + 39} textAnchor="middle" fontSize={12} fill="var(--color-stone-500)" className="tabular-nums">{c.pages.length}</text>
              </g>
            )
          })}
          <text x={left - 8} y={top + plotH + 39} textAnchor="end" fontSize={12} fill="var(--color-stone-500)" aria-hidden>pages</text>
          {/* the picked date's 2px underline, sliding to the new date (transform only) */}
          {pickedIndex >= 0 && (
            <rect x={0} y={top + plotH + 23} width={1} height={2} fill="var(--ink)" aria-hidden
              style={{ transformOrigin: '0 0', transform: `translateX(${x(pickedIndex) - (labelW[pickedIndex] ?? 28) / 2}px) scaleX(${labelW[pickedIndex] ?? 28})`, transition: still ? 'none' : `transform 220ms ${SLIDE}` }} />
          )}
          {/* one hit area per sync: hover (or a tap) for the card, click (or Enter) to pick it */}
          {cols.map((c, i) => (
            <rect key={`h-${c.r.id}`} x={left + slot * i} y={top} width={slot} height={plotH + bottom - 2} fill="transparent" className="cursor-pointer outline-none"
              role="button" tabIndex={0} aria-pressed={c.r.id === pickedId} aria-label={`${fmtDay(c.date)}: ${c.counts.positive} positive, ${c.counts.neutral} neutral, ${c.counts.negative} negative`}
              onPointerDown={(e) => { if (e.pointerType === 'touch') setHover(i) }}
              onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onClick={() => onPick(c.r.id)} onKeyDown={(e) => key(e, c.r.id)} />
          ))}
        </svg>
      )}
      {/* Score's latest-sync card, docked right of the plot (fades in, 8px from the right, after the line) */}
      {wide && n > 0 && (
        <div className="pointer-events-none absolute right-0 z-20" aria-hidden={!dockOn} data-sync-card="dock"
          style={{ top, width: DOCK_W, opacity: dockOn ? 1 : 0, transform: `translateX(${dockOn ? 0 : 8}px)`,
            transition: still ? 'none' : dockOn ? `opacity 200ms ease-out ${DOCK_DELAY}ms, transform 200ms ${SLIDE} ${DOCK_DELAY}ms` : 'opacity 150ms ease-out, transform 150ms ease-out' }}>
          <CrossFade k={hover ?? n - 1}><SyncTip col={cols[hover ?? n - 1]} tip={tips[hover ?? n - 1]} w={DOCK_W} card /></CrossFade>
        </div>
      )}
      {at != null && cols[at] && !dockOn && (
        <div className="pointer-events-none absolute left-0 top-0 z-30" aria-hidden={hover == null}
          style={{ transform: `translate(${tipX(at)}px, ${top}px)`, transition: still ? 'none' : `transform 160ms ${SLIDE}` }}>
          <div style={{ opacity: hover != null ? 1 : 0, transform: `translateY(${hover != null ? 0 : 4}px)`, transition: still ? 'none' : hover != null ? 'opacity 150ms ease-out, transform 150ms ease-out' : 'opacity 120ms ease-out' }}>
            <SyncTip col={cols[at]} tip={tips[at]} />
          </div>
        </div>
      )}
    </div>
    {/* narrower than 1280px, the card goes under the chart */}
    {!wide && dockOn && n > 0 && (
      <div className="mt-3" data-sync-card="under" style={still ? undefined : { animation: `sent-dock-in 200ms ${SLIDE} ${DOCK_DELAY}ms both` }}>
        <CrossFade k={hover ?? n - 1}><SyncTip col={cols[hover ?? n - 1]} tip={tips[hover ?? n - 1]} w="100%" card /></CrossFade>
      </div>
    )}
    </>
  )
}

// "This sync" under the chart: Positive / Mixed / Neutral / Negative for the picked sync (their shares add up to 100%;
// Not scored pages stay out of them, with "1 page not scored" under the tiles), each with its count, its share and the
// change in pages vs the sync before (▲▼; more positive or fewer negative pages green, the reverse red, neutral muted;
// nothing on the first sync). Follows the picked date.
function SyncTiles({ col, prev, selected = 'all', onPreview = () => {}, onLock = () => {} }) {
  const dwell = useRef(null)
  useEffect(() => () => clearTimeout(dwell.current), [])
  if (!col) return null
  // after a click the tile stays quiet (no preview over the choice just made) until the pointer leaves it
  const quiet = useRef(null)
  const enter = (t) => { clearTimeout(dwell.current); if (quiet.current === t) return; dwell.current = setTimeout(() => onPreview(t), 250) }
  const leave = () => { clearTimeout(dwell.current); quiet.current = null; onPreview(null) }
  const lock = (t) => { clearTimeout(dwell.current); quiet.current = t; onLock(t) }
  return (
    <div className="mt-4" aria-label={`This sync, ${fmtDay(col.date)}`} role="group">
      <p className={SECOND}>This sync</p>
      <div className="mt-2 grid grid-cols-4 gap-2 max-sm:grid-cols-2">
        {['positive', 'mixed', 'neutral', 'negative'].map((t) => {
          const n = col.counts[t] ?? 0
          const d = prev ? n - (prev.counts[t] ?? 0) : null
          const good = t === 'positive' ? d > 0 : t === 'negative' ? d < 0 : null
          const tone = d == null || d === 0 || t === 'neutral' || t === 'mixed' ? t3 : good ? 'text-[var(--rep-up-fg)]' : 'text-negative'
          return (
            <button key={t} type="button" aria-pressed={selected === t} onClick={() => lock(t)}
              onMouseEnter={() => enter(t)} onMouseLeave={leave} onBlur={leave}
              // keyboard focus previews (a mouse click focuses too, but that's a choice, not a preview)
              onFocus={(e) => { if (e.currentTarget.matches(':focus-visible') && quiet.current !== t) onPreview(t) }}
              className={`rounded-lg border px-3 py-2 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${selected === t ? 'border-transparent bg-tint ring-1 ring-[var(--color-line-strong)]' : 'border-[var(--div)] hover:bg-[var(--row-hover)]'}`}>
              <span className="flex items-center gap-1.5 text-[13px] leading-[18px] text-stone-600">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: MIX_FILL[t] }} aria-hidden />{TONE_LABEL[t]}
            </span>
              <span className="mt-1 flex items-baseline gap-1.5 tabular-nums">
                <span className="text-[18px] leading-6 font-semibold text-stone-900"><CountUp value={n} /></span>
                <span className={`text-[13px] leading-[18px] ${t3}`}>{col.pct[t] ?? 0}%</span>
                {d != null && d !== 0 && <span className={`ml-auto text-[12px] leading-4 ${tone}`} aria-label={`${d > 0 ? 'up' : 'down'} ${Math.abs(d)} since ${fmtDay(prev.date)}`}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}</span>}
          </span>
            </button>
          )
        })}
      </div>
      {unscoredNote(col.counts) && <p className={`mt-2 text-[12px] leading-4 ${t3} tabular-nums`}>{unscoredNote(col.counts)}</p>}
        </div>
  )
}

// a sync's hover card: the date, the tone counts, the total and its new pages; logo stacks of the new pages and the
// pages that turned negative, when there are any. Fixed width and tabular figures, so nothing shifts between columns.
// card = Score's latest-sync card (not a tooltip), w its width
function SyncTip({ col, tip, w = TIP_W, card = false }) {
  const { counts, pct } = col
  const score = scoreOf(counts)
  const d = tip.change?.delta ?? null
  const line = (cls, name, t) => (
    <div className={`grid grid-cols-[1fr_3ch_5ch] gap-x-1.5 ${cls}`}><span>{name}</span><span className="text-right">{counts[t]}</span><span className="text-right">{pct[t]}%</span></div>
  )
  return (
    <div role={card ? 'group' : 'tooltip'} aria-label={card ? `Sync ${fmtDay(col.date)}` : undefined} style={{ width: w, maxWidth: w }} className={`rounded-md border border-line bg-raised px-3 py-2.5 text-[12px] leading-4 tabular-nums ${card ? 'shadow-sm' : 'shadow-md'}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="font-semibold text-stone-900">{fmtDay(col.date)}</span>
        {score != null && (
          <span className="flex flex-col items-end">
            <span className="text-[20px] leading-6 font-semibold text-stone-900">{score}</span>
            {d != null && <span className={`text-[12px] leading-4 ${d > 0 ? 'text-[var(--rep-up-fg)]' : d < 0 ? 'text-negative' : t3}`}>{d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '0'}</span>}
          </span>
        )}
          </div>
      <div className="mt-1.5 flex flex-col gap-0.5">
        {line('text-ink', 'Positive', 'positive')}
        {line('text-stone-600', 'Neutral', 'neutral')}
        {line('text-stone-700', 'Mixed', 'mixed')}
        {line('text-negative', 'Negative', 'negative')}
        {counts.unscored > 0 && <div className={`grid grid-cols-[1fr_3ch] gap-x-1.5 ${t3}`}><span>Not scored</span><span className="text-right">{counts.unscored}</span></div>}
        </div>
      {tip.fresh.length > 0 && <div className="mt-2 flex items-center justify-between gap-2"><span className={t3}>New this sync</span><FaviconLinks pages={tip.fresh} size="sm" /></div>}
      {tip.turned.length > 0 && <div className="mt-1.5 flex items-center justify-between gap-2"><span className="text-negative">Turned negative</span><FaviconLinks pages={tip.turned} size="sm" /></div>}
      </div>
  )
}

// the Pages on <date> filters, in the URL (shared by the list and its drawer): ?ptone= positive|neutral|negative ·
// ?peng=google,claude (the engines on) · ?pnew=1 · ?pq=<domain search> · compare mode: ?pcmp=<from run id>~<to run id>
// and ?pchg=1 (only changed pages)
function useSyncFilters() {
  const q = useParams()
  const tone = TONES.includes(q.get('ptone')) ? q.get('ptone') : 'all'
  const engines = q.get('peng') ? q.get('peng').split(',').filter((e) => SENTIMENT_ENGINES.includes(e)) : null
  const [cmpFrom, cmpTo] = String(q.get('pcmp') ?? '').split('~')
  return {
    tone, engines, newOnly: q.get('pnew') === '1', q: q.get('pq') ?? '',
    compare: cmpFrom && cmpTo ? { from: cmpFrom, to: cmpTo, onlyChanged: q.get('pchg') === '1' } : null,
    setTone: (t) => setParams({ ptone: t === 'all' ? null : t }),
    setEngines: (list, ran) => setParams({ peng: !list || list.length === ran.length ? null : list.join(',') }),
    setNewOnly: (v) => setParams({ pnew: v ? '1' : null }),
    setQ: (v) => setParams({ pq: v || null }),
    setCompare: (c) => setParams(c ? { pcmp: `${c.from}~${c.to}`, pchg: c.onlyChanged ? '1' : null } : { pcmp: null, pchg: null }),
  }
}

// everything Pages on <date> shows, filtered (the list, its drawer and Download CSV read the same): the picked sync, or
// in compare mode the two syncs' pages with their changes
function useSyncList(data, runs, pagesOf, picked, tonePreview = null) {
  const f = useSyncFilters()
  const allPages = useMemo(() => runs.map((r) => ({ pages: pagesOf(r) })), [runs]) // eslint-disable-line react-hooks/exhaustive-deps
  const at = (id) => data.findIndex((d) => d.r.id === id)
  const cmp = f.compare && at(f.compare.from) >= 0 && at(f.compare.to) >= 0 ? { ...f.compare, fromI: at(f.compare.from), toI: at(f.compare.to) } : null
  const i = cmp ? cmp.toI : Math.max(0, at(picked?.r.id))
  const shownSync = data[i] ?? picked
  const fresh = newPageIds(allPages, i)
  const prevTones = toneById(i > 0 ? allPages[i - 1].pages : [])
  const entries = cmp ? compareEntries(data[cmp.fromI].pages, data[cmp.toI].pages, { onlyChanged: cmp.onlyChanged }) : null
  const basePages = entries ? entries.map((e) => e.page) : shownSync?.pages
  const ran = enginesIn(basePages)
  const engs = f.engines ? f.engines.filter((e) => ran.includes(e)) : ran
  const rest = { engines: f.engines ? engs : null, newOnly: f.newOnly, q: f.q, fresh }
  const list = (tone) => (entries ? compareList(entries, { ...rest, tone }) : sortPages(filterSyncPages(shownSync?.pages, { ...rest, tone })))
  const toneCounts = countTones(list('all'))
  // a This sync tile previews a tone on hover / focus; the tabs and the list show it, the URL keeps the locked one
  const toneShown = tonePreview ?? f.tone
  const rows = list(toneShown)
  const toggleEngine = (e) => {
    const on = engs.includes(e)
    if (on && engs.length === 1) return // at least one engine stays on
    f.setEngines(on ? engs.filter((x) => x !== e) : ran.filter((x) => x === e || engs.includes(x)), ran)
  }
  const fromLabel = cmp ? fmtDay(data[cmp.fromI].date) : null
  const change = (p) => (p.entry ? compareMarks(p.entry, { fresh, fromLabel }) : syncMarks(p, { fresh, prevTones }))
  const compare = cmp ? { ...cmp, fromDate: data[cmp.fromI].date, toDate: data[cmp.toI].date, changed: changedCount(entries) } : null
  return { f: { ...f, tone: toneShown }, lockedTone: f.tone, allPages, index: i, fresh, prevTones, ran, engs, toneCounts, rows, toggleEngine, change, compare, shownSync }
}

// Download CSV: whatever the list shows (the sync, or the comparison with tone_from / tone_to / change), filters applied
function downloadList(L, brand) {
  const csv = L.compare
    ? compareCsv(L.rows.map((p) => compareCsvRow(p.entry, pageHref)), brand)
    : syncCsv(L.rows, { brand, fresh: L.fresh, prevTones: L.prevTones, hrefOf: pageHref })
  const name = L.compare ? compareFilename(brand, L.compare.fromDate, L.compare.toDate) : syncFilename(brand, L.shownSync?.date ?? '')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// the filters on one line: tone tabs · engine toggles (28px) · New only · search. mode, by the room there is:
//   'full'       everything on the line
//   'compact'    engines, New only and the domain search share one "Filters" menu after the tone tabs
// Compare and Download CSV sit in the column's header row, always.
// (an "Engines" menu alone is as wide as the three toggles, so it frees no room)
function SyncFilters({ L, mode = 'full', wrap = false }) {
  const { f, ran, engs, toggleEngine } = L
  const [searching, setSearching] = useState(false)
  // the tabs' counts tween to their new values
  const tc = { positive: useCountUp(L.toneCounts.positive), neutral: useCountUp(L.toneCounts.neutral), mixed: useCountUp(L.toneCounts.mixed), negative: useCountUp(L.toneCounts.negative), unscored: useCountUp(L.toneCounts.unscored) }
  const toneCounts = tc
  const engineToggles = (
    <span className="flex shrink-0 items-center gap-1" role="group" aria-label="Engines">
      {ran.map((e) => {
        const on = engs.includes(e)
  return (
          <button key={e} type="button" aria-pressed={on} title={`${engineName(e)}: ${on ? 'shown' : 'hidden'}`} onClick={() => toggleEngine(e)}
            className={`grid h-7 w-7 place-items-center rounded-md outline-none transition-[background-color,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'bg-tint' : 'opacity-40 hover:opacity-70'}`}>
            <EngineIcon id={e} size={14} /><span className="sr-only">{engineName(e)}</span>
          </button>
        )
      })}
        </span>
  )
  return (
    <div className={`flex min-w-0 items-center gap-2 ${wrap ? 'flex-wrap' : 'flex-nowrap'}`}>
      <Seg label="Page tone" value={f.tone} onChange={f.setTone} className={SEG} options={[
        { value: 'all', label: `All ${toneCounts.positive + toneCounts.neutral + toneCounts.mixed + toneCounts.negative + toneCounts.unscored}` },
        { value: 'positive', label: `Positive ${toneCounts.positive}` },
        { value: 'neutral', label: `Neutral ${toneCounts.neutral}` },
        { value: 'mixed', label: `Mixed ${toneCounts.mixed}` },
        { value: 'negative', label: `Negative ${toneCounts.negative}` },
        { value: 'unscored', label: `Not scored ${toneCounts.unscored}` },
      ]} />
      {mode === 'compact' ? (
        <Pop label={`Filters${(engs.length < ran.length ? 1 : 0) + (f.newOnly ? 1 : 0) + (f.q ? 1 : 0) ? ` ${(engs.length < ran.length ? 1 : 0) + (f.newOnly ? 1 : 0) + (f.q ? 1 : 0)}` : ''}`} align="left" width={240} dialog="Filters">
          <p className={SECOND}>Engines</p>
          <ul className="mt-1 flex flex-col">
            {ran.map((e) => (
              <li key={e}>
                <label className="flex h-9 items-center gap-2.5 rounded-md px-1 text-[14px] leading-5 text-stone-900">
                  <input type="checkbox" checked={engs.includes(e)} onChange={() => toggleEngine(e)} className="h-4 w-4 accent-[var(--ink)]" />
                  <EngineIcon id={e} size={14} />{engineName(e)}
                </label>
              </li>
            ))}
          </ul>
          <label className="mt-2 flex h-9 items-center gap-2.5 border-t border-[var(--div)] px-1 pt-2 text-[14px] leading-5 text-stone-900">
            <input type="checkbox" checked={f.newOnly} onChange={(e) => f.setNewOnly(e.target.checked)} className="h-4 w-4 accent-[var(--ink)]" />
            <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden />New only
          </label>
          <label className="relative mt-3 flex h-9 items-center">
            <Search size={14} className={`pointer-events-none absolute left-2.5 ${t3}`} aria-hidden />
            <input type="search" value={f.q} onChange={(e) => f.setQ(e.target.value)} placeholder="Domain" aria-label="Search by domain"
              className="h-9 w-full rounded-md border border-line bg-raised pl-8 pr-2 text-[14px] text-stone-900 outline-none placeholder:text-stone-500 focus-visible:ring-2 focus-visible:ring-focus" />
          </label>
        </Pop>
      ) : engineToggles}
      {mode !== 'compact' && (<>
      <button type="button" aria-pressed={f.newOnly} onClick={() => f.setNewOnly(!f.newOnly)}
        className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[14px] leading-5 font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${f.newOnly ? 'bg-tint text-stone-900' : 'text-stone-600 hover:text-stone-900'}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden />New only
      </button>
      {searching || f.q ? (
        <label className="relative flex h-9 shrink-0 items-center">
          <Search size={14} className={`pointer-events-none absolute left-2.5 ${t3}`} aria-hidden />
          <input autoFocus type="search" value={f.q} onChange={(e) => f.setQ(e.target.value)} onBlur={() => { if (!f.q) setSearching(false) }} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); f.setQ(''); setSearching(false) } }}
            placeholder="Domain" aria-label="Search by domain"
            className="h-9 w-32 rounded-md border border-line bg-raised pl-8 pr-2 text-[14px] text-stone-900 outline-none placeholder:text-stone-500 focus-visible:ring-2 focus-visible:ring-focus" />
        </label>
      ) : (
        <button type="button" aria-label="Search by domain" onClick={() => setSearching(true)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><Search size={14} aria-hidden /></button>
      )}
      </>)}
    </div>
  )
}

function OverTime({ runs, run, onPick: pickSync, pagesOf, engine, brand }) {
  const [view, setView] = useState('mix') // Mix on every visit
  const [hidden, setHidden] = useState(() => new Set())
  const data = useMemo(() => syncColumns(runs, pagesOf, engine), [runs, engine]) // eslint-disable-line react-hooks/exhaustive-deps -- utils/sentimentSections.js, as the hero reads it
  const n = data.length
  const picked = data.find((d) => d.r.id === run.id) ?? data.at(-1)
  const [preview, setPreview] = useState(null) // a This sync tile's tone while hovered / focused
  const L = useSyncList(data, runs, pagesOf, picked, preview)
  // Mix and Score alternate every 4s (a progress line under the active tab), paused while the pointer or focus is
  // in the section, only while it's on screen and the tab is visible; stopped for this visit by any choice (Mix / Score,
  // a bar or date, a tile); never with reduced motion. The picked date and the tooltip carry over.
  const sectionRef = useRef(null)
  const [auto, setAuto] = useState(() => typeof window !== 'undefined' && !reduced())
  const [pointerIn, setPointerIn] = useState(false)
  const [focusIn, setFocusIn] = useState(false)
  const [onScreen, setOnScreen] = useState(true)
  const [tabShown, setTabShown] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible')
  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.2 })
    io.observe(el)
    const vis = () => setTabShown(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', vis)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis) }
  }, [])
  const running = auto && !pointerIn && !focusIn && onScreen && tabShown
  const stop = () => setAuto(false)
  const chooseView = (v) => { stop(); setView(v) }
  const onPick = (id) => { stop(); pickSync(id) }
  const lockTone = (t) => { stop(); setPreview(null); L.f.setTone(L.lockedTone === t ? 'all' : t) }
  const tips = useMemo(() => data.map((d, i) => {
    const fresh = newPageIds(L.allPages, i)
    // change: the score against the sync before (syncScoreChange, the hero's number too; none on the first sync)
    return { fresh: d.pages.filter((p) => fresh.has(p.id)), turned: turnedNegative(d.pages, data[i - 1]?.pages ?? []), change: syncScoreChange(data, i) }
  }), [data, L.allPages])
  // the filters stay on one line: when the column is too narrow for them, the engine toggles become an "Engines" menu
  const barRef = useRef(null)
  const probeRef = useRef(null)
  const [mode, setMode] = useState('full')
  useLayoutEffect(() => {
    const fit = () => {
      if (!barRef.current || !probeRef.current) return
      const room = barRef.current.clientWidth
      const parts = [...probeRef.current.firstElementChild.children].map((e) => e.getBoundingClientRect().width)
      const gap = 8
      const full = parts.reduce((a, b) => a + b, 0) + gap * (parts.length - 1)
      // full line · the tone tabs + a Filters menu · that too is wider than the room (1280): the menu wraps below
      setMode(full <= room ? 'full' : parts[0] + gap + 96 <= room ? 'compact' : 'wrap')
    }
    fit()
    const ro = new ResizeObserver(fit)
    if (barRef.current) ro.observe(barRef.current)
    return () => ro.disconnect()
  }, [n, L.toneCounts.positive, L.toneCounts.neutral, L.toneCounts.negative])
  const listFade = useEngineFade(engine)
  // rows that stay slide, the rest fade (tone filter, engines, a new date)
  const listRef = useRef(null)
  useFlip(listRef, L.rows.slice(0, LIST_ROWS).map((p) => p.id), { move: 200 })
  if (!n) return null
  const toggleTone = (t) => setHidden((h) => { const s = new Set(h); if (s.has(t)) s.delete(t); else if (s.size < TONES.length - 1) s.add(t); return s })
  const label = shareTrendLine(data) || 'Sentiment share by sync'
  const first = L.rows.slice(0, LIST_ROWS)
    return (
    <section ref={sectionRef} aria-labelledby="time-h" onPointerEnter={() => setPointerIn(true)} onPointerLeave={() => setPointerIn(false)}
      onFocus={() => setFocusIn(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocusIn(false) }}>
        <h2 id="time-h" className={h2}>Over time</h2>
      {/* one grid: the header row, the toolbar row, then the chart beside the list (phones: one column after the other) */}
      <div className="mt-6 grid grid-cols-1 gap-x-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="order-1 md:order-none">
          <div className={COL_HEAD}>
            <h3 className={`${COL_TITLE} text-ink`}>Tone by sync</h3>
            <Seg label="Chart" value={view} onChange={chooseView} options={VIEWS} className={SEG}
              progress={auto ? <AutoProgress running={running} ms={AUTO_MS} cycle={view} onDone={() => setView((v) => (v === 'mix' ? 'score' : 'mix'))} /> : null} />
          </div>
        </div>
        <div className="order-4 mt-10 md:order-none md:mt-0">
          <div className={COL_HEAD}>
            <h3 id="pages-on-h" className={`min-w-0 ${COL_TITLE}`}>
              <span className="truncate text-ink">{L.compare ? 'Pages compared' : <>Pages on <FadeText text={fmtDay(picked.date)} /></>}</span>
              <span className="tabular-nums text-stone-500"><CountUp value={L.compare ? L.rows.length : picked.pages.length} /></span>
            </h3>
            <span className="-mb-1.5 -mr-2 flex shrink-0 items-center">
              <Compare cols={data} L={L} />
              <TextBtn onClick={() => downloadList(L, brand)} disabled={!L.rows.length} icon={ArrowDown} aria-label="Download CSV"><span className="max-sm:hidden">Download </span>CSV</TextBtn>
            </span>
          </div>
          {L.compare && <CompareChip L={L} />}
        </div>
        <div className="order-2 flex h-14 min-w-0 items-center gap-1 md:order-none">
          {view === 'mix' ? [...MIX_ORDER].reverse().map((t) => {
            const off = hidden.has(t)
            return (
              <button key={t} type="button" aria-pressed={!off} onClick={() => toggleTone(t)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-[14px] leading-5 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus ${off ? 'text-stone-500' : 'text-stone-900'}`}>
                <span className="h-2.5 w-2.5 rounded-sm" style={off ? { boxShadow: `inset 0 0 0 1.5px ${MIX_FILL[t]}` } : { background: MIX_FILL[t] }} aria-hidden />{TONE_LABEL[t]}
              </button>
            )
          }) : null}
        </div>
        <div ref={barRef} className={`relative order-5 flex min-w-0 items-center md:order-none ${mode === 'wrap' ? 'min-h-14 py-2' : 'h-14'}`}>
          <SyncFilters L={L} mode={mode === 'wrap' ? 'compact' : mode} wrap={mode === 'wrap'} />
          {/* the full line, measured off screen: its parts decide the mode (full · Filters menu). Clipped, so the
              measuring copy never widens the page (with 4 engine toggles it ran past the window at 1280) */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div ref={probeRef} inert="" className="invisible absolute left-0 top-0 flex w-max">
              <SyncFilters L={L} />
            </div>
          </div>
        </div>
        <div className="order-3 min-w-0 md:order-none">
          <SyncChart cols={data} view={view} docked={scoreCardDocked({ view, auto, pointerIn, focusIn })} hidden={hidden} pickedId={picked?.r.id} onPick={onPick} plotH={PLOT_H} tips={tips} label={label} focusTone={L.f.tone !== 'all' ? L.f.tone : null} />
          {n < 2 && <p className={`mt-2 ${SECOND}`}>Trend starts after the next sync</p>}
          <SyncTiles col={picked} prev={data[data.indexOf(picked) - 1] ?? null} selected={L.lockedTone} onPreview={setPreview} onLock={lockTone} />
        </div>
        <div className="order-6 min-w-0 md:order-none">
          <ul ref={listRef} className="relative border-t border-[var(--div)]" style={{ minHeight: LIST_ROWS * ROW_H + 1, ...listFade }}>
            {first.map((p) => <SyncPageRow key={p.id} p={p} change={L.change(p)} />)}
            {!L.rows.length && <li className={`flex h-[52px] items-center border-b border-[var(--div)] ${SECOND}`}>No pages match these filters.</li>}
          </ul>
          {L.rows.length > LIST_ROWS && (
            <button type="button" onClick={() => openDrawer('syncpages', L.shownSync.r.id)}
              className="-ml-2 mt-2 inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-[14px] leading-5 font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              Show all {L.rows.length}<ArrowRight size={14} aria-hidden />
            </button>
          )}
        </div>
      </div>
      <SyncPagesDrawer data={data} runs={runs} pagesOf={pagesOf} brand={brand} />
      </section>
    )
  }

// "Show all": the picked sync's pages in the site's right drawer (the same shell, width, slide and scrim). Its filters
// are the list's (the URL), so what's set here carries back. The drawer is 560px: a row keeps the list's tone column
// and puts the change, domain and engines on a second line under the title.
function SyncPagesDrawer({ data, runs, pagesOf, brand }) {
  const drawer = useDrawer('syncpages', (id) => data.find((d) => d.r.id === id) ?? null)
  const picked = drawer.item
  const L = useSyncList(data, runs, pagesOf, picked)
  if (!picked) return null
  return (
    <DrawerShell drawer={drawer} title={L.compare ? `Pages compared · ${L.rows.length}` : `Pages on ${fmtDay(picked.date)} · ${picked.pages.length}`}
      meta={<div className="flex w-full flex-col gap-2 pt-1">{L.compare && <CompareChip L={L} />}<SyncFilters L={L} wrap /></div>}>
      <DrawerRows L={L} />
    </DrawerShell>
  )
}
function DrawerRows({ L }) {
  const ref = useRef(null)
  useFlip(ref, L.rows.map((p) => p.id), { move: 200 })
  return (
      <ul ref={ref} className="relative -mx-4 mt-1 md:-mx-6">
        {L.rows.map((p) => <DrawerRow key={p.id} p={p} c={L.change(p)} />)}
        {!L.rows.length && <li className={`py-4 ${SECOND}`}>No pages match these filters.</li>}
      </ul>
  )
}
function DrawerRow({ p, c }) {
  const href = pageHref(p)
  const peek = usePeek()
  return (
            <li data-row="drawer" data-key={p.id} {...peek.row} className="grid grid-cols-[20px_minmax(0,1fr)_136px] items-center gap-x-2.5 border-b border-[var(--div)] px-4 py-2.5 transition-colors duration-150 hover:bg-[var(--row-hover)] md:px-6">
              <PagePeek peek={peek} p={p} />
              <Fav domain={p.domain} />
              <span className="min-w-0">
                <TitleCell change={c}>
                  {href
                    ? <a href={href} {...LINK} aria-label={`${p.title} (opens in a new tab)`} data-title className={`min-w-0 rounded outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-focus ${ROW_TITLE}`}>{p.title}<span className="sr-only"> (opens in a new tab)</span></a>
                    : <span className={`min-w-0 ${ROW_TITLE}`}>{p.title}</span>}
                </TitleCell>
                <span className="mt-0.5 flex min-w-0 items-center gap-3">
                  <span className={`min-w-0 truncate ${SECOND}`}>{p.domain}</span>
                  <EngineMarks ids={p.engines} size={14} />
                </span>
              </span>
              <ToneCell p={p} change={c} />
            </li>
  )
}

// a small text button in a column's header (Compare ▾, Download CSV ↓): the Export look used across the app
const TEXT_BTN = 'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[14px] leading-5 font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-40'
const TextBtn = ({ icon: Icon, children, ...rest }) => <button type="button" className={TEXT_BTN} {...rest}>{children}{Icon && <Icon size={14} aria-hidden />}</button>

// Compare two syncs: From / To and "Only changed pages", then Apply. Nothing downloads here: the list turns into the
// comparison (a chip under the header, × to leave it), and Download CSV exports it.
function Compare({ cols, L }) {
  const cur = L.compare
  const [from, setFrom] = useState(null)
  const [to, setTo] = useState(null)
  const [onlyChanged, setOnlyChanged] = useState(null)
  const fromI = from ?? cur?.fromI ?? Math.max(0, L.index - 1)
  const toI = to ?? cur?.toI ?? L.index
  const changed = onlyChanged ?? cur?.onlyChanged ?? false
  const reset = () => { setFrom(null); setTo(null); setOnlyChanged(null) }
  const preview = cols.length ? compareEntries(cols[fromI]?.pages, cols[toI]?.pages, { onlyChanged: changed }) : []
  const select = (value, onChange, label) => (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className={SECOND}>{label}</span>
      <span className="relative">
        <select value={value} onChange={(e) => onChange(Number(e.target.value))}
          className="h-9 w-full appearance-none rounded-lg border border-line bg-raised pl-3 pr-8 text-[14px] font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus">
          {cols.map((c, i) => <option key={c.r.id} value={i}>{fmtDay(c.date)}</option>)}
        </select>
        <ChevronDown size={14} className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${t3}`} aria-hidden />
      </span>
    </label>
  )
  return (
    <Pop label="Compare" dialog="Compare two syncs" width={300} onOpen={reset}>
      {(close) => (<>
        <div className="flex items-end gap-3">
          {select(fromI, setFrom, 'From')}
          {select(toI, setTo, 'To')}
        </div>
        <label className="mt-3 flex items-center gap-2 text-[14px] leading-5 text-stone-900">
          <input type="checkbox" checked={changed} onChange={(e) => setOnlyChanged(e.target.checked)} className="h-4 w-4 accent-[var(--ink)]" />
          Only changed pages
        </label>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className={`tabular-nums ${SECOND}`}>{fromI === toI ? 'Pick two different syncs' : plural(changedCount(preview), 'changed page')}</span>
          <span className="-mr-2"><TextBtn disabled={fromI === toI} onClick={() => { L.f.setCompare({ from: cols[fromI].r.id, to: cols[toI].r.id, onlyChanged: changed }); close() }}>Apply</TextBtn></span>
        </div>
      </>)}
    </Pop>
  )
}

// compare mode's chip under the header: "Oct 14 → Oct 28 · 5 changed ×"; × goes back to the picked sync
function CompareChip({ L }) {
  const c = L.compare
                return (
    <div className="flex h-11 items-center">
      <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md bg-tint pl-2.5 pr-1 text-[13px] leading-[18px] font-medium text-stone-900">
        <span className="truncate tabular-nums">{fmtDay(c.fromDate)} → {fmtDay(c.toDate)} · {c.changed} changed</span>
        <button type="button" aria-label="Stop comparing" onClick={() => L.f.setCompare(null)}
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-stone-500 outline-none transition-colors duration-150 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><X size={13} aria-hidden /></button>
      </span>
    </div>
  )
}

// a row's marks (utils/sentimentSections syncMarks / compareMarks): favicon · [New] · title, the chip before the title so
// the title takes the ellipsis and the chip is never cut; the tone right-aligned and, when it changed, a second line
// the page's tone at the picked sync only, one line (2026-11-01: no "from <tone>" line; the Compare CSV keeps tone_from /
// tone_to). A page that dropped out of a comparison reads "Not cited". The row stays 52px.
const NewChip = () => <span data-new className="mr-2 inline-flex shrink-0 items-center rounded-[4px] bg-ink px-1.5 py-0.5 text-[11px] leading-[14px] font-medium text-on-ink">New</span>
const TitleCell = ({ children, change }) => <span className="flex min-w-0 items-center">{change?.isNew && <NewChip />}{children}</span>
function ToneCell({ p, change, className = '' }) {
  const tone = change?.tone ?? p.tone
  return (
    <span data-tone className={`flex flex-col items-end whitespace-nowrap text-right ${className}`}>
      <span className={`text-[14px] leading-5 ${change?.gone ? t3 : TONE_TEXT[tone]}`}>{change?.gone ? 'Not cited' : TONE_LABEL[tone]}</span>
    </span>
  )
}

// a page in a sync, on the list's fixed columns: favicon | title (and "New") | domain ↗ | engines | tone
function SyncPageRow({ p, change = null }) {
  const href = pageHref(p)
  const peek = usePeek()
  return (
    <li data-row="sync" data-key={p.id} {...peek.row} className={`${PAGE_GRID} h-[52px] border-b border-[var(--div)] transition-colors duration-150 hover:bg-[var(--row-hover)]`}>
      <PagePeek peek={peek} p={p} />
      <Fav domain={p.domain} />
      <TitleCell change={change}>
        {href
          ? <a href={href} {...LINK} aria-label={`${p.title} (opens in a new tab)`} data-title className={`min-w-0 rounded outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-focus ${ROW_TITLE}`}>{p.title}<span className="sr-only"> (opens in a new tab)</span></a>
          : <span data-title className={`min-w-0 ${ROW_TITLE}`}>{p.title}</span>}
      </TitleCell>
      <span data-domain className={`min-w-0 truncate ${SECOND} max-md:hidden`}>
        {href ? <a href={href} {...LINK} className="rounded outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">{p.domain} <ArrowUpRight size={12} className="inline" aria-hidden /></a> : p.domain}
      </span>
      <span data-engines className="flex max-md:hidden"><EngineMarks ids={p.engines} size={14} /></span>
      <ToneCell p={p} change={change} />
    </li>
  )
}

// ---- Sources: Harsh's sources across every sync (sourceCloud) in two columns. The heads and the lead blocks share
// grid rows (they line up); below them each column is its own stack, so opening a row moves only its column down
// (collapsed rows still line up across the two). Each column leads with the top site's quote, or, with no quote, the top
// site's numbers ("negative in 5 of 6 syncs"). Rows: favicon | domain ⌄ | bar | syncs | engines. Hover: the site's
// quote (or its tone in every sync); click: the row opens in place (quotes, tone across syncs, its pages); several can
// be open. A column more than a row longer shows "+n more" (the drawer with all of them).
// the engines column fits the three marks (Google, ChatGPT, Claude) with room to spare
const SRC_GRID = 'grid grid-cols-[20px_minmax(0,1fr)_120px_48px_76px] items-center gap-x-3'
function Sources({ runs, pagesOf, engine, brand, latestPages, swot }) {
  const columns = useMemo(() => syncColumns(runs, pagesOf, engine), [runs, engine]) // eslint-disable-line react-hooks/exhaustive-deps
  const cloud = useMemo(() => sourceColumns(sourceCloud(columns)), [columns])
  const syncs = columns.length
  const even = evenColumns(cloud.negative, cloud.positive)
  const [open, setOpen] = useState(() => new Set())
  const side = (tone, shown) => {
    const list = cloud[tone]
    const quote = sourceLead(list[0], latestPages)
    return { tone, list, shown: shown.shown, more: shown.more, quote, top: list[0] ?? null, also: quote ? alsoSaidOnSites(quote.page, swot, latestPages) : [] }
  }
  const N = side('negative', even.a), P = side('positive', even.b)
  const fade = useEngineFade(engine)
  const word = (s) => (s.tone === 'negative' ? 'negative' : 'positive')
  const head = (s) => (
    <h3 id={`lean-${s.tone}-h`} className={`h-full border-b border-line pb-2 ${COL_TITLE}`}>
      <span className={s.tone === 'negative' ? 'text-negative' : 'text-ink'}>{s.tone === 'negative' ? 'Leaning negative' : 'Leaning positive'}</span>
      <span className="tabular-nums text-stone-500">{s.list.length}</span>
    </h3>
  )
  const lead = (s) => {
    if (s.quote) {
      return (
        <figure className="pt-5 pb-6">
          <blockquote className="text-[20px] leading-[30px] font-medium tracking-[-0.01em] text-stone-900 max-md:text-[18px] max-md:leading-7 [text-wrap:pretty]"><Phrase s={s.quote.quote} tone={s.tone} /></blockquote>
          <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Source page={s.quote.page} />
            {s.also.length > 0 && <span className={`flex items-center gap-2 ${SECOND}`}>Also said on <FaviconLinks pages={s.also} /></span>}
          </figcaption>
        </figure>
      )
    }
    if (s.top) {
      return (
        <div className="pt-5 pb-6">
          <p className="flex flex-wrap items-center gap-x-2.5 text-[20px] leading-[30px] font-semibold text-stone-900">
            <Fav domain={s.top.domain} />{s.top.domain}<span className="font-normal text-stone-500">·</span><span>{word(s)} in {s.top.syncs} of {plural(syncs, 'sync')}</span>
          </p>
          {s.top.last && <div className="mt-3"><OpenPage page={s.top.last} /></div>}
              </div>
      )
    }
    return <p className="pt-5 pb-6 text-[20px] leading-[30px] font-semibold text-stone-500">{s.tone === 'negative' ? 'No site leans negative yet' : 'No site leans positive yet'}</p>
  }
  const toggle = (key, el) => {
    if (open.has(key)) collapseKeepingHead(el, () => setOpen((o) => { const n = new Set(o); n.delete(key); return n }))
    else setOpen((o) => new Set(o).add(key))
  }
  const stack = (s) => (
    <div className="border-t border-[var(--div)]">
      {s.shown.map((site) => <SourceRow key={site.domain} s={s} site={site} syncs={syncs} latestPages={latestPages} open={open.has(`${s.tone}:${site.domain}`)} onToggle={(el) => toggle(`${s.tone}:${site.domain}`, el)} />)}
      {s.more > 0 && (
        <button type="button" onClick={() => openDrawer('srclist', s.tone)}
          className="flex h-[52px] w-full items-center border-b border-[var(--div)] text-left text-[14px] leading-5 font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
          +{s.more} more<ArrowRight size={14} className="ml-1.5" aria-hidden />
        </button>
      )}
      {!s.list.length && <p className={`flex h-[52px] items-center border-b border-[var(--div)] ${SECOND}`}>{s.tone === 'negative' ? 'No site leans negative yet' : 'No site leans positive yet'}</p>}
          </div>
  )
              return (
    <section aria-labelledby="sources-h">
      <h2 id="sources-h" className={h2}>Sources</h2>
      <p className={`mt-1 ${SECOND}`}>Across all syncs · neutral-only sites left out</p>
      <div className="mt-6" style={fade}>
        {/* heads and leads share rows; each column's rows are their own stack below (phones: one column, then the other) */}
        <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
          <div className="order-1 min-w-0 md:order-none">{head(N)}</div>
          <div className="order-4 mt-10 min-w-0 md:order-none md:mt-0">{head(P)}</div>
          <div className="order-2 min-w-0 md:order-none">{lead(N)}</div>
          <div className="order-5 min-w-0 md:order-none">{lead(P)}</div>
          <div className="order-3 min-w-0 self-start md:order-none">{stack(N)}</div>
          <div className="order-6 min-w-0 self-start md:order-none">{stack(P)}</div>
                </div>
      </div>
      <SourcesDrawers cloud={cloud} syncs={syncs} />
    </section>
  )
}

// a Sources row: the header (favicon, domain and a chevron, bar, syncs, engines) and, open, the site in detail:
// its quotes from the latest analysis (3, then "+n more"), its tone in every sync, and its cited pages (Harsh's runs)
function SourceRow({ s, site, syncs, latestPages, open, onToggle }) {
  const { history } = useContext(HistoryCtx)
  const peek = usePeek()
  const headRef = useRef(null)
  const [allQuotes, setAllQuotes] = useState(false)
  const [opened, setOpened] = useState(0)
  useEffect(() => { if (open) setOpened((k) => k + 1); else setAllQuotes(false) }, [open])
  const word = s.tone === 'negative' ? 'negative' : 'positive'
  const quoted = latestPages.filter((p) => p.domain === site.domain && p.sentences?.[0]?.text)
  const cells = history.map((h) => ({ date: h.date, tone: siteToneIn(h.pages, site.domain) }))
  // the site's cited pages across the runs, each once, with its latest tone
  const pages = [...new Map([...site.hits].sort((a, b) => String(a.date).localeCompare(String(b.date))).map((h) => [h.id ?? h.url, h])).values()]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  const quotes = allQuotes ? quoted : quoted.slice(0, 3)
  const still = typeof window !== 'undefined' && reduced()
  const stagger = (i) => (open && !still ? { animation: `fade-in 200ms ${EASE_OUT} ${i * 20}ms both` } : undefined)
  const id = `src-${s.tone}-${site.domain.replace(/[^a-z0-9]+/gi, '-')}`
  return (
    <div data-row="source" className="border-b border-[var(--div)]">
      <div {...peek.row} onClick={undefined}>
        <button ref={headRef} type="button" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => { peek.hide(); onToggle(headRef.current) }}
          className={`${SRC_GRID} h-[52px] w-full text-left outline-none transition-colors duration-150 hover:bg-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus`}>
          <Fav domain={site.domain} />
          <span className="flex min-w-0 items-center gap-1.5">
            <span data-title className={ROW_TITLE}>{site.domain}</span>
            <ChevronRight size={14} aria-hidden className="shrink-0 text-stone-500" style={{ transform: `rotate(${open ? 90 : 0}deg)`, transition: still ? 'none' : `transform 200ms ${EASE_OUT}` }} />
          </span>
          <span data-bar className="relative flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--data-track)]" role="img" aria-label={`${site.domain}: ${word} in ${site.syncs} of ${plural(syncs, 'sync')}`}>
            <span className="h-full rounded-full" style={{ width: `${Math.max(6, (site.syncs / Math.max(1, syncs)) * 100)}%`, background: s.tone === 'negative' ? 'var(--negative)' : 'var(--ink)' }} />
          </span>
          <span className={`text-right tabular-nums ${SECOND}`}>{site.syncs}/{syncs}</span>
          <span className="flex"><EngineMarks ids={site.engines} size={14} /></span>
        </button>
        {!open && (
          <PeekCard peek={peek}>
            <PeekBody quote={quoted[0]?.sentences[0].text ?? null} title={site.domain} cells={cells}
              footer={`${site.domain}${quoted.length > 1 ? ` and ${quoted.length - 1} more` : ''} · Click for the quotes`} />
          </PeekCard>
        )}
              </div>
      <div id={`${id}-body`} inert={open ? undefined : ''} className="grid"
        style={{ gridTemplateRows: open ? '1fr' : '0fr', transition: still ? 'none' : `grid-template-rows 240ms ${EASE_OUT}` }}>
        <div key={opened} className="relative min-h-0 overflow-hidden">
          <div className="flex flex-col gap-5 pb-5 pl-[32px] pt-1">
            {quoted.length > 0 && (
              <div style={stagger(0)}>
                <p className="text-[12px] leading-4 text-stone-500">Quotes</p>
                <ul className="mt-2 flex flex-col gap-3">
                  {quotes.map((p) => (
                    <li key={p.id}>
                      <p className="text-[15px] leading-[22px] text-stone-900 [text-wrap:pretty]">“{p.sentences[0].text}”</p>
                      <div className="mt-1"><Source page={p} /></div>
                    </li>
                  ))}
                </ul>
                {quoted.length > 3 && !allQuotes && (
                  <button type="button" onClick={() => setAllQuotes(true)} className="mt-2 rounded text-[13px] font-medium text-stone-700 outline-none hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">+{quoted.length - 3} more</button>
            )}
      </div>
            )}
            <div style={stagger(1)}>
              <p className="text-[12px] leading-4 text-stone-500">Tone across syncs</p>
              <div className="mt-2 flex flex-wrap items-start gap-x-4 gap-y-1">
                <ToneStrip cells={cells} size={14} dates />
                <span className="text-[14px] leading-5 text-stone-900">{word} in {site.syncs} of {plural(syncs, 'sync')}</span>
              </div>
            </div>
            <div style={stagger(2)}>
              <p className="text-[12px] leading-4 text-stone-500">Pages</p>
              <ul className="mt-2 border-t border-[var(--div)]">
                {pages.map((h) => {
                  const href = pageHref(h)
                  return (
                    <li key={h.id ?? h.url} className="grid h-11 grid-cols-[minmax(0,1fr)_minmax(0,140px)_76px_72px] items-center gap-x-2.5 border-b border-[var(--div)]">
                      {href
                        ? <a href={href} {...LINK} aria-label={`${h.title} (opens in a new tab)`} className={`min-w-0 rounded outline-none underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${ROW_TITLE}`}>{h.title}<span className="sr-only"> (opens in a new tab)</span></a>
                        : <span className={`min-w-0 ${ROW_TITLE}`}>{h.title}</span>}
                      {/* the domain ↗ opens the page too (it was text with an arrow) */}
                      <span data-domain className={`min-w-0 truncate ${SECOND}`}>
                        {href
                          ? <a href={href} {...LINK} className="rounded outline-none hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">{site.domain} <ArrowUpRight size={12} className="inline" aria-hidden /><span className="sr-only">(opens in a new tab)</span></a>
                          : <span>{site.domain}</span>}
                      </span>
                      <span className="flex"><EngineMarks ids={h.engines ?? []} size={14} /></span>
                      <span className={`text-right text-[14px] leading-5 ${TONE_TEXT[h.tone]}`}>{TONE_LABEL[h.tone]}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// a whole column ("+n more") in the site's right drawer
function SourcesDrawers({ cloud, syncs }) {
  const list = useDrawer('srclist', (tone) => (cloud[tone] ? { tone, sites: cloud[tone] } : null))
  if (!list.item) return null
  return (
    <DrawerShell drawer={list} title={`${list.item.tone === 'negative' ? 'Leaning negative' : 'Leaning positive'} · ${list.item.sites.length}`} meta={<span>Across all syncs · neutral-only sites left out</span>}>
      <ul className="mt-1">
        {list.item.sites.map((s) => (
          <li key={s.domain} className={`${SRC_GRID} h-[52px] border-b border-[var(--div)]`}>
            <Fav domain={s.domain} />
            <span className={ROW_TITLE}>{s.domain}</span>
            <span className="relative flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--data-track)]">
              <span className="h-full rounded-full" style={{ width: `${Math.max(6, (s.syncs / Math.max(1, syncs)) * 100)}%`, background: list.item.tone === 'negative' ? 'var(--negative)' : 'var(--ink)' }} />
            </span>
            <span className={`text-right tabular-nums ${SECOND}`}>{s.syncs}/{syncs}</span>
            <span className="flex"><EngineMarks ids={s.engines} size={14} /></span>
          </li>
        ))}
      </ul>
    </DrawerShell>
  )
}

// the nearest element that scrolls this one (the app scrolls inside its own area), else the document
function scrollerOf(el) {
  for (let n = el?.parentElement; n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY
    if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n
  }
  return document.scrollingElement
}
// a scroll by `by` px over `dur` ms (ease-out); reduced motion: at once
function glideScroll(sc, by, dur = 240) {
  if (!by) return
  if (reduced()) { sc.scrollTop += by; return }
  const from = sc.scrollTop, t0 = performance.now()
  const step = (t) => { const k = Math.min(1, (t - t0) / dur); sc.scrollTop = from + by * (1 - (1 - k) ** 3); if (k < 1) requestAnimationFrame(step) }
  requestAnimationFrame(step)
}
// collapse a list without the page jumping: its section's header stays where it is on screen while the list shrinks;
// if the header was (or ends up) above the view, it glides back into view with 24px above it
function collapseKeepingHead(section, collapse) {
  const head = section?.matches?.('section') ? section.querySelector('h2') : section
  if (!head) { collapse(); return }
  const sc = scrollerOf(head)
  const viewTop = () => (sc === document.scrollingElement ? 0 : sc.getBoundingClientRect().top)
  const before = head.getBoundingClientRect().top
  const visible = before >= viewTop()
  collapse()
  const end = performance.now() + (reduced() ? 0 : 280)
  const hold = () => {
    if (visible) { const d = head.getBoundingClientRect().top - before; if (Math.abs(d) >= 1) sc.scrollTop += d }
    if (performance.now() < end) { requestAnimationFrame(hold); return }
    const top = head.getBoundingClientRect().top - viewTop()
    if (top < 24) glideScroll(sc, top - 24)
  }
  requestAnimationFrame(hold)
}

// ---- every page: the first five, then "Show all" (opens in place: height 240ms, rows fade in 20ms apart); synced
// with every filter above, sortable (Harsh's Tone / Title / Engines). A row's title opens the page's drawer (every
// quote); its domain ↗ opens the cited page in a new tab. Rows: favicon | title (and "New") | domain ↗ | engines | tone.
const SORTS = [{ value: 'tone', label: 'Tone' }, { value: 'title', label: 'Title' }, { value: 'engines', label: 'Engines' }]
const FIRST = 5
const ALL_GRID = 'grid grid-cols-[20px_minmax(0,1fr)_168px_76px_136px] items-center gap-x-2.5 max-md:grid-cols-[20px_minmax(0,1fr)_136px]'
// an All pages row: favicon | title (and "New") | domain ↗ | engines | tone; a hover card with its quote
function AllPageRow({ p, change, style }) {
          const href = pageHref(p)
  const peek = usePeek()
          return (
      <li data-row="page" data-key={p.id} {...peek.row} className={`${ALL_GRID} h-[52px] border-b border-[var(--div)] transition-colors duration-150 hover:bg-[var(--row-hover)]`} style={style}>
        <PagePeek peek={peek} p={p} />
        <Fav domain={p.domain} />
        <TitleCell change={change}>
          <button type="button" onClick={() => openDrawer('page', p.id)} aria-label={p.title} data-title
            className={`min-w-0 rounded text-left outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-focus ${ROW_TITLE}`}>{p.title}</button>
        </TitleCell>
        <span data-domain className={`min-w-0 truncate ${SECOND} max-md:hidden`}>
                {href
                  ? <a href={href} {...LINK} className="rounded outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">{p.domain} <ArrowUpRight size={12} className="inline" aria-hidden /><span className="sr-only">(opens in a new tab)</span></a>
                  : <span title="No link stored for this page">{p.domain}</span>}
              </span>
        <span className="flex max-md:hidden"><EngineMarks ids={p.engines} size={14} /></span>
        <ToneCell p={p} change={change} />
            </li>
          )
}

function AllPages({ pages, lit, filtered, changeOf = () => null, engine = 'all' }) {
  const [all, setAll] = useState(false)
  const sectionRef = useRef(null)
  const [sort, setSort] = useState('tone')
  const [opened, setOpened] = useState(0) // replays the rows' fade each time "Show all" opens
  // the sort pills (utils/sentimentSections sortAllPages): Tone, Title (A–Z, natural) or Engines (most first)
  const rows = sortAllPages(pages.filter((p) => lit.has(p.id)), sort)
  const still = typeof window !== 'undefined' && reduced()
  const fade = useEngineFade(engine)
  const row = (p, i = null) => <AllPageRow key={p.id} p={p} change={changeOf(p)} style={i != null && all && !still ? { animation: `fade-in 200ms ${EASE_OUT} ${i * 20}ms both` } : undefined} />
  // the sort and the filters reorder the rows in place (FLIP, 240ms)
  const firstRef = useRef(null)
  const restRef = useRef(null)
  useFlip(firstRef, rows.slice(0, FIRST).map((p) => p.id), { move: 240 })
  useFlip(restRef, all ? rows.slice(FIRST).map((p) => p.id) : [], { move: 240 })
  return (
    <section ref={sectionRef} aria-labelledby="pages-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="pages-h" className={h2}>{filtered ? 'Pages that match' : 'All pages'}</h2>
        <Seg label="Sort pages" value={sort} onChange={setSort} options={SORTS} className={SEG} />
      </div>
      <div className="mt-6"><AutoHeight><div style={fade}>
      <ul ref={firstRef} className="relative border-t border-[var(--div)]">
        {rows.slice(0, FIRST).map((p) => row(p))}
        {!rows.length && <li className={`flex h-[52px] items-center border-b border-[var(--div)] ${SECOND}`}>No pages match these filters.</li>}
      </ul>
      {rows.length > FIRST && (
        <>
          <div inert={all ? undefined : ''} className="grid"
            style={{ gridTemplateRows: all ? '1fr' : '0fr', transition: still ? 'none' : `grid-template-rows 240ms ${EASE_OUT}` }}>
            {/* relative: the hidden rows' absolute screen-reader labels stay clipped (else they lengthen the page) */}
            <ul key={opened} ref={restRef} className="relative min-h-0 overflow-hidden">{rows.slice(FIRST).map((p, i) => row(p, i))}</ul>
          </div>
          <button type="button" onClick={() => { if (all) collapseKeepingHead(sectionRef.current, () => setAll(false)); else { setAll(true); setOpened((k) => k + 1) } }} aria-expanded={all}
            className="-ml-2 mt-2 inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-[14px] leading-5 font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-focus">
            {all ? 'Show fewer' : `Show all ${rows.length}`}<ChevronDown size={14} className={`transition-transform duration-[240ms] ${all ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        </>
      )}
      </div></AutoHeight></div>
    </section>
  )
}

// the drawer: every quote from the page, the phrase marked; a link out
// a page's drawer: what we have on it, in sections that hide when empty (never an empty heading).
//   Quotes: every sentence the latest analysis kept for it (its tone only when it differs from the page's)
//   Across syncs: one row per saved run (date · tone · the engines that cited it, or "not cited"), under "Cited in n of m
//   syncs · first seen <date>"
//   Themes: the brand analysis's themes whose sources include it, with the other sites in the same theme
//   More from <domain>: the domain's other pages cited for the brand (a click opens that page's drawer)
const THEME_TYPE = { strengths: 'Strength', weaknesses: 'Weakness', opportunities: 'Opportunity', threats: 'Threat' }
const DRAWER_H = 'text-[14px] leading-5 font-semibold text-stone-900'
function PageDrawer({ pages, brand, swot }) {
  const { history } = useContext(HistoryCtx)
  const map = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages])
  const drawer = useDrawer('page', (id) => map.get(id) ?? null)
  const p = drawer.item
  if (!p) return null
  const quotes = p.sentences ?? []
  const syncs = (history ?? []).map((h) => ({ id: h.id, date: h.date, page: (h.pages ?? []).find((x) => x.id === p.id) ?? null }))
  const cited = syncs.filter((x) => x.page)
  const themes = swot ? Object.entries(swot).flatMap(([type, list]) => (list ?? [])
    .filter((t) => (t.sources ?? []).includes(p.id))
    .map((t) => {
      const others = new Map()
      for (const id of t.sources) { const o = map.get(id); if (o && o.domain && o.domain !== p.domain && !others.has(o.domain)) others.set(o.domain, o) }
      return { theme: t.theme, type, also: [...others.values()] }
    })) : []
  const more = pages.filter((x) => x.domain === p.domain && x.id !== p.id)
  return (
    <DrawerShell drawer={drawer} title={p.title}
      meta={<span className="flex flex-wrap items-center gap-2"><span>{p.domain}</span><Dot /><span className={TONE_TEXT[p.tone]}>{TONE_LABEL[p.tone]}</span><Dot /><EngineMarks ids={p.engines} /></span>}
      footer={<><OpenPage page={p} /><span /></>}>
      {quotes.length > 0 && (
        <section className="mt-5" aria-label="Quotes">
          <h3 className={DRAWER_H}>Quotes</h3>
          <ul className="mt-2 divide-y divide-[var(--div)] border-y border-[var(--div)]">
            {quotes.map((s) => (
            <li key={s.text} className="flex gap-3 py-3">
              <span className="w-[3px] shrink-0 self-stretch rounded-full" style={{ background: RING[s.tone] }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-6 text-stone-900"><Phrase s={s} /></span>
                  {s.tone !== p.tone && <span className={`mt-1 block text-[12px] leading-4 ${TONE_TEXT[s.tone]}`}>{TONE_LABEL[s.tone]}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>
      )}
      {syncs.length > 0 && cited.length > 0 && (
        <section className="mt-6" aria-label="Across syncs">
          <h3 className={DRAWER_H}>Across syncs</h3>
          <p className={`mt-1 ${SECOND}`}>Cited in {cited.length} of {plural(syncs.length, 'sync')} · first seen {fmtDay(cited[0].date)}</p>
          <ul className="mt-2 border-t border-[var(--div)]">
            {[...syncs].reverse().map((x) => (
              <li key={x.id} className="grid h-10 grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--div)] text-[14px] leading-5 tabular-nums">
                <span className={x.page ? 'text-stone-900' : t3}>{fmtDay(x.date)}</span>
                {x.page
                  ? <span className={`flex items-center gap-2 ${TONE_TEXT[x.page.tone]}`}><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: RING[x.page.tone] }} aria-hidden />{TONE_LABEL[x.page.tone]}</span>
                  : <span className={t3}>not cited</span>}
                <span className="flex justify-end">{x.page && <EngineMarks ids={x.page.engines} size={14} />}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {themes.length > 0 && (
        <section className="mt-6" aria-label="Themes">
          <h3 className={DRAWER_H}>Themes</h3>
          <ul className="mt-2 divide-y divide-[var(--div)] border-y border-[var(--div)]">
            {themes.map((t) => (
              <li key={`${t.type}-${t.theme}`} className="flex flex-col gap-1.5 py-3">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] leading-[22px] text-stone-900">{t.theme}</span>
                  <span className="inline-flex h-5 items-center rounded-md border border-line px-1.5 text-[12px] leading-4 text-stone-600">{THEME_TYPE[t.type] ?? t.type}</span>
                </span>
                {t.also.length > 0 && <span className={`flex items-center gap-2 ${SECOND}`}>Also said on <FaviconLinks pages={t.also} size="sm" /></span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {more.length > 0 && (
        <section className="mt-6" aria-label={`More from ${p.domain}`}>
          <h3 className={DRAWER_H}>More from {p.domain}</h3>
          <ul className="mt-2 border-t border-[var(--div)]">
            {more.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => openDrawer('page', x.id)}
                  className="grid h-[52px] w-full grid-cols-[20px_minmax(0,1fr)_auto_auto] items-center gap-x-2.5 border-b border-[var(--div)] text-left outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus">
                  <Fav domain={x.domain} />
                  <span className={`min-w-0 ${ROW_TITLE}`}>{x.title}</span>
                  <EngineMarks ids={x.engines} size={14} />
                  <span className={`w-[72px] text-right text-[14px] leading-5 ${TONE_TEXT[x.tone]}`}>{TONE_LABEL[x.tone]}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </DrawerShell>
  )
}
