import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import BetaTag from '../../components/ui/BetaTag'
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
import { alsoSaidOn, biggestChange, byReach, capStack, changeSummary, chartLayout, divergingStack, dotPlan, pageHref, ribbonsInto, groupThemes, layoutSwarm, lanesFor, leadQuote, matchIds, moveNote, neighbour, reachOf, scoreX, springEasing, staggerDelays, tellingSentence, themeEngines, themeQuote, themeQuoteOf, toggleOpen, toneChanges, topChange } from '../../utils/spectrum'
import { fmtDay, lineBtn, t2, t3 } from './parts'

// /sentiment: one visual page about how third-party pages talk about the brand.
//   Header · the spectrum (every page a dot, placed by tone; hover for a quote, click for all of them; split by engine)
//   · one insight · What AI says about you (themes that hurt / work; a theme lights its pages, a dot opens its theme)
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

  // What AI says about you: themes from the latest run (?mock=calm has nothing hurting)
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
        <div className="flex items-baseline gap-2.5"><h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">Sentiment</h1><BetaTag tipAlign="left" className="-translate-y-[3px] lg:-translate-y-[6px]" /></div>
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
            <Switch checked={split} onChange={setSplit} spring>Split by engine</Switch>
          </div>
          <Spectrum pages={pages} lit={lit} engine={engine} split={split} score={score} onDot={onDot} themeFor={themeFor} filter={{ c, tone, setTone, explain }} />
        </div>
      </div>
      {text && <div className="mt-6"><Insight explain={explain} text={text} evidence={{ keys: ['tones'], calc: `Pages per tone in the ${fmtDay(run.date)} run. Score = 50 + (positive − negative) ÷ pages × 50.` }} /></div>}
    </section>
  )
}

// the axis under the spectrum: three bands, "Negative 4 · Neutral 6 · Positive 4". With tone filtering (the hero), each
// label filters the dots (again: all); elsewhere the labels are plain.
const AXIS = [['negative', 'Negative', 1 / 6], ['neutral', 'Neutral', 1 / 2], ['positive', 'Positive', 5 / 6]]
function Axis({ plotW, filter }) {
  const { c, tone, setTone, explain } = filter || {}
  return (
    <div {...(filter ? hl(explain, 'tones') : {})} className="relative mt-2 h-7 border-t border-line text-[12px] leading-4 tabular-nums"
      {...(filter ? { role: 'group', 'aria-label': 'Filter by tone' } : { 'aria-hidden': true })}>
      {AXIS.map(([k, label, at]) => {
        const pos = { left: plotW * at }
        const text = <>{label}{filter && <> <span className="font-normal">{c[k]}</span></>}</>
        if (!filter) return <span key={k} className={`absolute top-1.5 -translate-x-1/2 whitespace-nowrap font-medium ${TONE_TEXT[k]}`} style={pos}>{text}</span>
        return (
          <button key={k} type="button" aria-pressed={tone === k} onClick={() => setTone(tone === k ? null : k)} style={pos}
            className={`absolute top-0.5 -translate-x-1/2 whitespace-nowrap rounded px-1 py-1 font-medium outline-none transition-opacity duration-200 focus-visible:ring-2 focus-visible:ring-focus ${TONE_TEXT[k]} ${tone && tone !== k ? 'opacity-40' : ''} ${tone === k ? 'underline decoration-2 underline-offset-4' : 'hover:underline underline-offset-4'}`}>
            {text}
          </button>
        )
      })}
    </div>
  )
}

// ---- the spectrum itself: one swarm, or three engine lanes ("Split by engine"). The same elements serve both layouts:
// every page has one dot per citing engine (copies hide under the original when merged), plus three score markers and
// three lane labels. Moving between layouts is FLIP on transform / opacity only, with the Web Animations API: each
// element animates from wherever it is NOW (its computed transform, also mid-animation) to its new target, so a
// toggle mid-way reverses smoothly. No React state changes per frame.
const LABEL_H = 26 // a lane's label row (split)
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

function Spectrum({ pages, lit, engine, split, score, onDot = (p) => openDrawer('page', p.id), themeFor = () => null, filter = null }) {
  const box = useRef(null)
  const stage = useRef(null)
  const mobile = useIsMobile()
  const [w, setW] = useState(800)
  const [hover, setHover] = useState(null) // { page, x, y }
  const [focusId, setFocusId] = useState(null)
  const els = useRef({}) // key → element (dots 'p1#0', markers 'mk:google', labels 'lab:google', …)
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
  const plotW = Math.max(120, w)

  // both layouts, always: the swarm (with the engine filter's re-settle) and the lanes
  const merged = useMemo(() => {
    const all = layoutSwarm(pages, { width: plotW, r })
    const on = engine === 'all' ? all : layoutSwarm(pages.filter((p) => p.engines.includes(engine)), { width: plotW, r })
    const H = Math.max(mobile ? 200 : 236, 2 * Math.max(all.extent, on.extent) + 28)
    return { all, on, H }
  }, [pages, plotW, r, engine, mobile])
  const lanes = useMemo(() => {
    let top = 0
    return lanesFor(pages, ENGINES).map((l) => {
      const lay = layoutSwarm(l.pages, { width: plotW, r })
      const H = LABEL_H + Math.max(mobile ? 80 : 92, 2 * lay.extent + 16)
      const lane = { ...l, lay, top, H }
      top += H
      return lane
    })
  }, [pages, plotW, r, mobile])
  const laneBy = Object.fromEntries(lanes.map((l) => [l.id, l]))
  const splitH = lanes.reduce((n, l) => n + l.H, 0)
  const totalH = split ? splitH : merged.H

  // every dot element and its target
  const byId = new Map(pages.map((p) => [p.id, p]))
  const placed = dotPlan(pages, ENGINES, split).map((d) => {
    const page = byId.get(d.pageId)
    const active = engine === 'all' || (split ? d.lane === engine : page.engines.includes(engine))
    let x, y
    if (split && laneBy[d.lane]) {
      const l = laneBy[d.lane], pos = l.lay.pos[page.id]
      x = pos.x; y = l.top + LABEL_H + (l.H - LABEL_H) / 2 + pos.y
    } else {
      const pos = (active ? merged.on.pos[page.id] : null) ?? merged.all.pos[page.id]
      x = pos.x; y = merged.H / 2 + pos.y
    }
    const on = d.shown && active && lit.has(page.id)
    const o = !d.shown ? 0 : !active && split ? 0.22 : on ? 1 : 0.12
    return { ...d, page, x, y, o, on }
  })
  const usable = placed.filter((d) => d.on)
  const tabKey = usable.some((d) => d.key === focusId) ? focusId : [...usable].sort((a, b) => a.x - b.x)[0]?.key
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

  // targets for the markers (one per lane; merged they sit together on the overall score) and the lane labels
  const markerT = (l) => (split
    ? `translate(${scoreX(l.score ?? 50, plotW) - 1}px, ${l.top + LABEL_H}px) scaleY(${(l.H - LABEL_H) / 100})`
    : `translate(${scoreX(score ?? 50, plotW) - 1}px, 0px) scaleY(${merged.H / 100})`)
  const sig = `${split}|${engine}|${plotW}|${pages.map((p) => p.id + p.tone).join()}|${[...lit].join()}|${score}`
  useLayoutEffect(() => {
    const first = firstPaint.current
    firstPaint.current = false
    const order = [...placed].sort((a, b) => a.x - b.x)
    const delays = staggerDelays(order.length, MOVE)
    let end = 0
    order.forEach((d, i) => { end = Math.max(end, moveTo(els.current[d.key], `translate(${d.x - r}px, ${d.y - r}px)`, d.o, { delay: delays[i], first })) })
    lanes.forEach((l, i) => {
      const faded = split && engine !== 'all' && engine !== l.id
      end = Math.max(end, moveTo(els.current[`mk:${l.id}`], markerT(l), l.score == null ? 0 : faded ? 0.3 : 1, { first }))
      // labels slide in from the left half way through the dots' move (60ms apart); out at once on merge
      end = Math.max(end, moveTo(els.current[`lab:${l.id}`], `translate(${split ? 0 : -14}px, ${l.top}px)`, split ? (faded ? 0.4 : 1) : 0,
        { first, delay: split ? MOVE.dur / 2 + i * 60 : 0, dur: split ? 320 : 200, easing: 'cubic-bezier(.2,.8,.2,1)' }))
      end = Math.max(end, moveTo(els.current[`sep:${l.id}`], `translate(0px, ${l.top + l.H}px)`, split && i < lanes.length - 1 ? 1 : 0, { first, dur: 300 }))
    })
    end = Math.max(end, moveTo(els.current.overall, `translate(${scoreX(score ?? 50, plotW) + 8}px, -4px)`, split || score == null ? 0 : 1, { first, dur: 250 }))
    end = Math.max(end, moveTo(els.current.even, `translate(${(score ?? 50) >= 50 ? plotW / 2 - 6 : plotW / 2 + 6}px, ${merged.H - 16}px)`, split ? 0 : 1, { first, dur: 250 }))
    // the hero's height: grows / shrinks smoothly (content below moves with it, never jumps)
    const el = stage.current
    if (el) {
      const to = `${totalH}px`
      if (first || reduced()) { el.style.height = to } else if (el.style.height !== to) {
        const from = `${el.getBoundingClientRect().height}px`
        el.getAnimations().forEach((a) => a.cancel())
        el.style.height = to
        el.animate([{ height: from }, { height: to }], { duration: MOVE.height, easing: 'cubic-bezier(.2,.8,.2,1)' })
        end = Math.max(end, MOVE.height)
      }
    }
    if (end) { movingUntil.current = performance.now() + end; setHover(null) }
  }, [sig, totalH]) // eslint-disable-line react-hooks/exhaustive-deps

  const reg = (key) => (el) => { if (el) els.current[key] = el; else delete els.current[key] }
  return (
    <div ref={box} className="relative [overflow-x:clip] [overflow-clip-margin:24px]" onMouseLeave={() => setHover(null)}>
      <div ref={stage} className="relative">
        {/* the bands and the even line run the full height in both layouts, so nothing here moves */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-y-0 border-l border-[var(--div)]" style={{ left: plotW / 3 }} />
          <div className="absolute inset-y-0 border-l border-[var(--div)]" style={{ left: (2 * plotW) / 3 }} />
          <div className="absolute inset-y-0 border-l border-dashed" style={{ left: plotW / 2, borderColor: 'var(--color-stone-400)' }} />
          {lanes.map((l) => <div key={l.id} ref={reg(`sep:${l.id}`)} className="absolute inset-x-0 top-0 border-b border-[var(--div)]" />)}
          {lanes.map((l) => <div key={l.id} ref={reg(`mk:${l.id}`)} className="absolute left-0 top-0 h-[100px] w-0.5 origin-top rounded-full bg-ink" />)}
          <span ref={reg('overall')} className="absolute left-0 top-0 whitespace-nowrap text-[12px] leading-4 font-medium text-ink">Overall</span>
          <span ref={reg('even')} className="absolute left-0 top-0"><span className={`block whitespace-nowrap text-[12px] leading-4 ${t3} ${(score ?? 50) >= 50 ? '-translate-x-full' : ''}`}>Even</span></span>
          {lanes.map((l) => (
            <span key={l.id} ref={reg(`lab:${l.id}`)} className="absolute left-0 top-0 flex h-[26px] items-center gap-2">
              <EngineIcon id={l.id} size={16} />
              <span className="text-[13px] leading-[18px] font-medium text-stone-900">{l.name}</span>
              <span className="text-[15px] leading-5 font-semibold text-stone-900 tabular-nums">{l.score ?? '—'}</span>
            </span>
          ))}
        </div>

        {/* the dots (copies too: hidden under their original until the split) */}
        {placed.map((d, n) => (
          <button key={d.key} ref={reg(d.key)} type="button"
            tabIndex={d.on && d.key === tabKey ? 0 : -1} aria-hidden={!d.on}
            aria-label={`${d.page.title}, ${d.page.domain}: ${TONE_LABEL[d.page.tone].toLowerCase()}. ${themeFor(d.page) ? `Open “${themeFor(d.page).theme}” below` : 'Open its quotes'}`}
            onClick={(e) => { setHover(null); onDot(d.page); e.currentTarget.blur() }}
            onMouseEnter={() => d.on && show(d)} onFocus={() => { setFocusId(d.key); show(d) }} onBlur={() => setHover(null)} onKeyDown={(e) => onKey(e, d)}
            className={`absolute left-0 top-0 grid place-items-center rounded-full bg-surface outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${d.on ? 'z-[2] hover:z-[3]' : 'pointer-events-none'} ${d.copy ? 'z-[1]' : ''}`}
            style={{ width: 2 * r, height: 2 * r, willChange: 'transform' }}>
            {/* tone ring · a sliver of surface · a white plate, so dark logos show in both themes */}
            <span className="dot-in grid h-full w-full place-items-center rounded-full border-2 bg-surface"
              style={{ borderColor: RING[d.page.tone], animation: d.copy ? undefined : `dot-in 420ms cubic-bezier(.2,.8,.2,1) ${Math.min(n, 30) * 22}ms both` }}>
              <span className="grid h-[calc(100%-4px)] w-[calc(100%-4px)] place-items-center rounded-full"
                style={{ background: d.page.tone === 'negative' ? 'color-mix(in srgb, var(--negative) 14%, #fff)' : '#fff' }}>
                <SiteLogo domain={d.page.domain} name={d.page.domain} className={`${mobile ? 'h-3.5 w-3.5' : 'h-5 w-5'} rounded-full !border-0 !bg-transparent`} imgPad="p-0" initialClass="text-[9px] !text-[#44403c]" bordered={false} />
              </span>
            </span>
          </button>
        ))}
        {hover && <HoverCard hover={hover} w={w} r={r} theme={themeFor(hover.page)} />}
      </div>
      <Axis plotW={plotW} filter={filter} />
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

// ---- what AI says about you: two columns, each led by its strongest quote, then every theme sorted by reach (the
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
    const lead = leadQuote(unlinked ? [] : themes, pages, tone)
    return { hurting, tone, themes, lead, also: alsoSaidOn(lead, unlinked ? [] : themes, pages, tone) }
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
        <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Source page={s.lead.page} />
          {s.also.length > 0 && <span className={`flex items-center gap-2 text-[13px] leading-[18px] ${t3}`}>Also said on <FaviconLinks pages={s.also} /></span>}
        </figcaption>
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
      <h2 id="reads-h" className={h2}>What AI says about you</h2>
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
  const inner = <><SiteLogo domain={page.domain} name={page.domain} className="h-3.5 w-3.5 rounded-full !border-0" imgPad="p-0" initialClass="text-[7px]" />{page.domain}</>
  return (
    <span className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-[18px] ${t3}`}>
      {href
        ? <a href={href} {...LINK} className="inline-flex items-center gap-1.5 rounded outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">{inner}<span className="sr-only">(opens in a new tab)</span></a>
        : <span className="inline-flex items-center gap-1.5">{inner}</span>}
      <OpenPage page={page} />
    </span>
  )
}
// a clickable favicon stack: at most four, then "+N"; each favicon opens its page (the domain in a tooltip). Clicks
// don't reach the row underneath.
function FaviconLinks({ pages, size = 'md' }) {
  const { shown, more } = capStack(pages, 4)
  const box = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'
  const img = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  return (
    <span className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
      <span className="flex -space-x-1">
        {shown.map((p) => {
          const href = pageHref(p)
          const face = (
            <span className={`grid ${box} place-items-center overflow-hidden rounded-full ring-2 ring-surface`} style={{ background: '#fff' }}>
              <SiteLogo domain={p.domain} name={p.domain} className={`${img} rounded-full !border-0 !bg-transparent`} imgPad="p-0" initialClass="text-[8px] !text-[#44403c]" bordered={false} />
            </span>
          )
          return href ? (
            <a key={p.id} href={href} {...LINK} title={p.domain} aria-label={`${p.domain} (opens in a new tab)`}
              className="group/fav relative rounded-full outline-none transition-transform duration-150 hover:z-10 hover:-translate-y-0.5 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none">
              {face}
              <span className="pointer-events-none absolute max-sm:hidden bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-raised px-2 py-1 text-[12px] leading-4 font-medium text-stone-700 opacity-0 shadow-sm transition-opacity duration-150 group-hover/fav:opacity-100 group-focus-visible/fav:opacity-100" aria-hidden>{p.domain}</span>
            </a>
          ) : <span key={p.id} title={`${p.domain} (no link stored)`}>{face}</span>
        })}
      </span>
      {more > 0 && <span className={`ml-1.5 text-[12px] leading-4 tabular-nums ${t3}`}>+{more}</span>}
    </span>
  )
}
const QuoteOrTitle = ({ page, s, tone, size = 'text-[15px] leading-6' }) => (s
  ? <p className={`${size} text-stone-900 [text-wrap:pretty]`}><Phrase s={s} tone={tone} /></p>
  : <><p className={`${size} text-stone-900`}>{page.title}</p><p className={`text-[12px] leading-4 ${t3}`}>Quote appears after the next analysis</p></>)

// one source page as a compact link row: favicon · title · domain ↗ · engines (no URL stored: plain text)
function SourceRow({ p }) {
  const href = pageHref(p)
  const body = (
    <>
      <SiteLogo domain={p.domain} name={p.domain} className="h-4 w-4 shrink-0 rounded !border-0" imgPad="p-0" initialClass="text-[8px]" />
      <span className="min-w-0 flex-1 truncate text-[13px] leading-5 text-stone-900">{p.title}</span>
      <span className={`shrink-0 text-[12px] leading-4 ${t3}`}>{p.domain}{href && <ArrowUpRight size={12} className="ml-0.5 inline" aria-hidden />}</span>
    </>
  )
  return (
    <li className="flex items-center gap-3">
      {href
        ? <a href={href} {...LINK} className="group flex min-w-0 flex-1 items-center gap-2.5 rounded py-1 outline-none hover:[&>span:nth-child(2)]:underline focus-visible:ring-2 focus-visible:ring-focus">{body}<span className="sr-only">(opens in a new tab)</span></a>
        : <span className="flex min-w-0 flex-1 items-center gap-2.5 py-1" title="No link stored for this page">{body}</span>}
      <EngineMarks ids={p.engines} size={12} />
    </li>
  )
}

// a theme row: 52px collapsed (theme · suffix | favicon links, reach bar, engines); hover / focus: a floating preview;
// open: up to three quotes, then every source page as a link row
function ThemeRow({ t, hurting, reach, scale, total, open, lit, onToggle, onClose, onHover }) {
  const id = `theme-${slug(t.theme)}`
  const [preview, setPreview] = useState(false)
  const best = themeQuoteOf(t)
  const quotes = t.pages.slice(0, 3).map((p) => ({ p, s: themeQuote(p, t) }))
  const tone = hurting ? 'negative' : 'positive'
  const enter = () => { setPreview(true); onHover(t) }
  const leave = () => { setPreview(false); onHover(null) }
  const toggle = () => { onToggle(); setPreview(false) }
  return (
    <li id={id} className={`relative scroll-mt-24 border-b border-[var(--div)] transition-colors duration-150 ${lit && !open ? 'bg-tint' : ''}`} onMouseEnter={enter} onMouseLeave={leave}>
      <div className="flex h-[52px] items-center gap-3">
        <button type="button" aria-expanded={open} aria-controls={`${id}-body`} aria-describedby={preview && !open ? `${id}-preview` : undefined}
          onClick={toggle} onFocus={enter} onBlur={leave}
          onKeyDown={(e) => { if (e.key === 'Escape') { setPreview(false); onClose() } }}
          className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
          <span className="truncate text-[15px] leading-[22px] font-medium text-stone-900">{t.theme}</span>
          {(t.kind === 'opportunity' || t.kind === 'threat') && <span className={`shrink-0 text-[13px] ${t3}`}>{t.kind}</span>}
        </button>
        {/* the right side: favicon links (their own targets), then the reach bar and engines (clicking those opens the row) */}
        <span className="flex shrink-0 items-center gap-3">
          <span className="flex w-[64px] justify-end"><FaviconLinks pages={t.pages} size="sm" /></span>
          <span className="flex items-center gap-3" onClick={toggle} aria-hidden>
            {/* reach: pages saying it ÷ all pages analysed (the number is in the tooltip) */}
            <span className="relative flex h-1.5 w-16 overflow-hidden rounded-full bg-[var(--data-track)] max-sm:w-10" title={`${t.pages.length} of ${total} pages say this (${Math.round(reach * 100)}%)`}>
              <span className="h-full rounded-full" style={{ width: `${Math.max(8, scale * 100)}%`, background: hurting ? 'var(--negative)' : 'var(--ink)' }} />
            </span>
            <span className="flex w-[54px] justify-start max-sm:hidden"><EngineMarks ids={themeEngines(t)} size={14} /></span>
          </span>
        </span>
      </div>
      {/* hover / focus preview: the best quote, floating (nothing moves) */}
      {preview && !open && best && (
        <div id={`${id}-preview`} role="tooltip" className="pointer-events-none absolute left-0 top-full z-30 mt-1 w-[min(420px,100%)] rounded-xl border border-line bg-raised p-3.5 shadow-lg motion-safe:animate-[fade-in_120ms_ease-out]">
          <QuoteOrTitle page={best.page} s={best.quote} tone={tone} size="text-[14px] leading-[22px]" />
          <p className={`mt-1.5 text-[12px] leading-4 ${t3}`}>{best.page.domain}{best.others.length ? ` and ${best.others.length} more` : ''} · click for the quotes</p>
        </div>
      )}
      <div id={`${id}-body`} inert={open ? undefined : ''} className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="relative min-h-0 overflow-hidden">
          <ul className="flex flex-col gap-4 pb-4">
            {quotes.map(({ p, s }) => (
              <li key={p.id}><QuoteOrTitle page={p} s={s} tone={tone} /><div className="mt-1.5"><Source page={p} /></div></li>
            ))}
          </ul>
          {/* every page behind the theme */}
          <div className="border-t border-[var(--div)] pt-3 pb-5">
            <p className={`text-[12px] leading-4 ${t3}`}>Sources</p>
            <ul className="mt-1.5 flex flex-col">{t.pages.map((p) => <SourceRow key={p.id} p={p} />)}</ul>
          </div>
        </div>
      </div>
    </li>
  )
}

// ---- over time: one clean column per run: the score above (the latest larger with its change; the biggest move's
// column gets a small bold "+13"), positive pages stacking up as squares (ink), negative down (negative token), the
// neutral count on the baseline, the date, and a change line (more / fewer positive and negative pages than the run
// before). Hover or focus a column: only the ribbons from the previous run into it draw in (pages that changed tone,
// matched by URL), the rest dims. Click for that run in the spectrum. Grows in on scroll (none with reduced motion).
const TF = { pitch: 16, sq: 12, gap: 14, dates: 22, change: 20, perRow: 2, minCol: 96 }
const TONE_FILL = { positive: 'var(--ink)', neutral: 'var(--color-stone-500)', negative: 'var(--negative)' }
function ChangeLine({ parts }) {
  if (parts == null) return <span className={t3}>First run</span>
  if (!parts.length) return <span className={t3}>no change</span>
  return (
    <span className="inline-flex items-center gap-2">
      {parts.map((x) => (
        <span key={x.tone} className="inline-flex items-center gap-1 tabular-nums">
          <span className={x.d < 0 && x.tone === 'positive' ? 'text-negative' : t2}>{x.d > 0 ? '+' : '−'}{Math.abs(x.d)}</span>
          <span className="h-2 w-2 rounded-[2px]" style={{ background: TONE_FILL[x.tone] }} aria-label={`${x.tone} pages`} />
        </span>
      ))}
    </span>
  )
}
function OverTime({ runs, run, onPick, pagesOf }) {
  const box = useRef(null)
  const scroller = useRef(null)
  const [w, setW] = useState(900)
  const [tip, setTip] = useState(null) // { kind: 'col' | 'ribbon', ... }
  const [ribCol, setRibCol] = useState(null) // the column whose incoming ribbons are drawn
  const [ribOn, setRibOn] = useState(false)
  const leaveT = useRef(null)
  const [seen, setSeen] = useState(() => reduced())
  const [fade, setFade] = useState({ l: false, r: false }) // phones: soft edges where there's more to swipe to
  const cols = useRef([])
  useLayoutEffect(() => {
    if (!box.current) return
    setW(box.current.clientWidth)
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    if (seen || !box.current) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold: 0.35 })
    io.observe(box.current)
    return () => io.disconnect()
  }, [seen])
  // phones: the latest run in view; the edge fades follow the scroll position
  const edges = () => { const el = scroller.current; if (el) setFade({ l: el.scrollLeft > 2, r: el.scrollLeft < el.scrollWidth - el.clientWidth - 2 }) }
  useLayoutEffect(() => { if (scroller.current) { scroller.current.scrollLeft = scroller.current.scrollWidth; edges() } }, [w]) // eslint-disable-line react-hooks/exhaustive-deps
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
  const L = 64
  const stacks = data.map(({ pages }) => divergingStack(pages, { perRow: TF.perRow, pitch: TF.pitch, gap: TF.gap }))
  const up = Math.max(...stacks.map((s) => s.up)), down = Math.max(...stacks.map((s) => s.down))
  // sized to its content: no scrolling unless the columns can't fit (phones), then a hidden-scrollbar swipe
  const lay = chartLayout({ width: w, n, up, down, L, minCol: TF.minCol, pitch: TF.pitch, gap: TF.gap, dates: TF.dates, change: TF.change })
  const { colW, plotW, base, dotsBottom, H } = lay
  const cx = (i) => L + colW * i + colW / 2
  const stackW = TF.perRow * TF.pitch
  const big = biggestChange(runs)
  const latest = runs.at(-1)
  // tooltips live outside the swipe area (never clipped, never scrolling it): x in the chart → x on screen
  const clampX = (x) => Math.max(150, Math.min(w - 150, x - (lay.scroll ? scroller.current?.scrollLeft ?? 0 : 0)))
  const tipSide = (i) => {
    if (lay.scroll) return { left: '50%', cls: '-translate-x-1/2' }
    const x = cx(i)
    return x > w * 0.55 ? { left: x - colW * 0.32, cls: '-translate-x-full' } : { left: x + colW * 0.32, cls: '' }
  }
  const grow = (i) => ({ transform: seen ? 'scaleY(1)' : 'scaleY(0)', transformOrigin: `0 ${base}px`, transition: reduced() ? 'none' : `transform 420ms cubic-bezier(.2,.8,.2,1) ${i * 60}ms` })
  // ribbons into the hovered column (from the previous run): a square's edge (or the baseline, for neutral)
  const point = (i, p, side) => {
    const s = stacks[i].slots[p.id]
    return { x: cx(i) + side * (s ? TF.sq / 2 + 1 : 10) + (s ? s.x : 0), y: s ? base + s.y : base }
  }
  const ribbons = ribCol == null ? [] : ribbonsInto(data.map((d) => d.pages), ribCol).map((c) => {
    const a = point(ribCol - 1, data[ribCol - 1].pages.find((p) => p.id === c.page.id) ?? c.page, 1), b = point(ribCol, c.page, -1)
    const mx = (a.x + b.x) / 2
    return { ...c, d: `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`, mid: { x: mx, y: (a.y + b.y) / 2 } }
  })
  const enterCol = (i) => { clearTimeout(leaveT.current); setRibCol(i); setRibOn(true); setTip({ kind: 'col', i }) }
  const leaveCol = () => { clearTimeout(leaveT.current); leaveT.current = setTimeout(() => { setRibOn(false); setTip(null) }, 140) }
  const key = (e, i) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, Home: -n, End: n }[e.key]
    if (step) { e.preventDefault(); cols.current[Math.max(0, Math.min(n - 1, i + step))]?.focus() }
    if (e.key === 'Escape') { setRibOn(false); setTip(null) }
  }
  const dim = (i) => (ribOn && ribCol != null && i !== ribCol && i !== ribCol - 1 ? 0.4 : 1)
  return (
    <section aria-labelledby="time-h">
      <h2 id="time-h" className={h2}>Over time</h2>
      <div ref={box} className="relative mt-6" onMouseLeave={leaveCol}>
        <div ref={scroller} onScroll={lay.scroll ? edges : undefined}
          className={lay.scroll ? 'overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'overflow-visible'}
          style={lay.scroll ? { WebkitMaskImage: `linear-gradient(to right, ${fade.l ? 'transparent' : '#000'}, #000 32px, #000 calc(100% - 32px), ${fade.r ? 'transparent' : '#000'})`, maskImage: `linear-gradient(to right, ${fade.l ? 'transparent' : '#000'}, #000 32px, #000 calc(100% - 32px), ${fade.r ? 'transparent' : '#000'})` } : undefined}>
          <div className="relative" style={{ width: lay.contentW, height: H }}>
            {/* the latest column, tinted: inset from the column and the chart's edges */}
            <div className="absolute rounded-lg bg-tint" style={{ left: L + colW * (n - 1) + 8, width: colW - 16, top: 2, height: H - 4 }} aria-hidden />
            <svg className="absolute inset-0 overflow-visible" width={L + plotW} height={H}>
              <line x1={L} x2={L + plotW} y1={base} y2={base} stroke="var(--color-line)" aria-hidden />
              <text x={0} y={base - TF.gap - 2} fontSize={12} fill="var(--color-stone-500)" aria-hidden>Positive</text>
              <text x={0} y={base + TF.gap + 10} fontSize={12} fill="var(--color-stone-500)" aria-hidden>Negative</text>
              {data.map(({ r, pages }, i) => {
                const isLast = r === latest, on = r.id === run.id
                const neutral = pages.filter((p) => p.tone === 'neutral').length
                const topY = base - TF.gap - stacks[i].up * TF.pitch - 8
                return (
                  <g key={r.id} style={{ opacity: dim(i), transition: 'opacity 200ms ease-out' }} aria-hidden>
                    <g style={grow(i)}>
                      {pages.filter((p) => stacks[i].slots[p.id]).map((p) => {
                        const s = stacks[i].slots[p.id]
                        return <rect key={p.id} x={cx(i) + s.x - TF.sq / 2} y={base + s.y - TF.sq / 2} width={TF.sq} height={TF.sq} rx={3} fill={TONE_FILL[p.tone]} />
                      })}
                    </g>
                    {/* neutral: just its count on the baseline */}
                    <text x={cx(i)} y={base} dy={4} textAnchor="middle" fontSize={11} fill="var(--color-stone-500)" stroke="var(--color-surface)" strokeWidth={4} paintOrder="stroke" className="num">{neutral}</text>
                    <text x={cx(i)} y={topY} textAnchor="middle" fontSize={isLast ? 18 : 14} fontWeight={600} fill={on ? 'var(--ink)' : 'var(--color-stone-700)'} className="num">
                      {r.score}
                      {isLast && r.delta != null && <tspan fontSize={12} fontWeight={500} dx={4} fill={r.delta < 0 ? 'var(--negative)' : 'var(--ink)'}>{r.delta < 0 ? '▼' : '▲'}{Math.abs(r.delta)}</tspan>}
                      {big && big.index === i && !isLast && <tspan fontSize={11} fontWeight={700} dx={4} fill={big.delta < 0 ? 'var(--negative)' : 'var(--ink)'}>{big.delta > 0 ? '+' : '−'}{Math.abs(big.delta)}</tspan>}
                    </text>
                    <text x={cx(i)} y={dotsBottom + 14} textAnchor="middle" fontSize={12} fontWeight={on ? 600 : 400} fill={on ? 'var(--ink)' : 'var(--color-stone-500)'} className="num">{fmtDay(r.date)}</text>
                  </g>
                )
              })}
              {/* the ribbons into the hovered column: draw in, fade out */}
              <g style={{ opacity: ribOn ? 1 : 0, transition: 'opacity 150ms ease-out' }}>
                {ribbons.map((rb) => (
                  <g key={`${ribCol}-${rb.page.id}`}>
                    <path d={rb.d} fill="none" stroke={TONE_FILL[rb.to]} strokeOpacity={tip?.kind === 'ribbon' && tip.rb.page.id === rb.page.id ? 0.95 : 0.55} strokeWidth={2} strokeLinecap="round"
                      pathLength={1} strokeDasharray={1} className="motion-safe:animate-[ribbon-draw_250ms_ease-out_both]" aria-hidden />
                    <path d={rb.d} fill="none" stroke="transparent" strokeWidth={12}
                      onMouseEnter={() => { clearTimeout(leaveT.current); setRibOn(true); setTip({ kind: 'ribbon', rb, x: rb.mid.x, y: rb.mid.y }) }}
                      onMouseLeave={() => setTip({ kind: 'col', i: ribCol })} />
                  </g>
                ))}
              </g>
            </svg>
            {/* the change line under each date (HTML, so it can carry the colour squares) */}
            {data.map(({ r }, i) => (
              <div key={r.id} className="pointer-events-none absolute flex -translate-x-1/2 justify-center whitespace-nowrap text-[12px] leading-4" style={{ left: cx(i), top: dotsBottom + 22, opacity: dim(i), transition: 'opacity 200ms ease-out' }}>
                <ChangeLine parts={i ? changeSummary(runs[i - 1].counts, r.counts) : null} />
              </div>
            ))}
            {/* the columns: hover / focus for the run and its incoming ribbons; click or Enter to see its pages */}
            {data.map(({ r }, i) => (
              <button key={r.id} ref={(el) => { cols.current[i] = el }} type="button" aria-pressed={r.id === run.id}
                aria-label={`${fmtDay(r.date)}: score ${r.score}. Show this run’s pages`}
                onClick={() => onPick(r.id)} onKeyDown={(e) => key(e, i)}
                onMouseEnter={() => enterCol(i)} onMouseLeave={leaveCol} onFocus={() => enterCol(i)} onBlur={leaveCol}
                className="absolute top-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus"
                style={{ left: L + colW * i + colW / 2 - stackW / 2 - 14, width: stackW + 28, height: H }} />
            ))}
          </div>
        </div>
        {/* tooltips: outside the swipe area, so they never clip or make it scroll */}
            {tip?.kind === 'col' && (() => {
              const { r, pages } = data[tip.i]
              const ch = topChange(ribbonsInto(data.map((d) => d.pages), tip.i))
              return (
                // beside its column, inside the chart (right of it, or left when it's on the right half); phones: centred
                <div role="tooltip" className={`pointer-events-none absolute z-20 whitespace-nowrap rounded-lg border border-line bg-raised px-3 py-2 text-small shadow-md tabular-nums ${tipSide(tip.i).cls}`}
                  style={{ left: tipSide(tip.i).left, top: base - 34 }}>
                  <div className="font-semibold text-stone-900">{fmtDay(r.date)} · {r.score}{r.delta != null && <span className={`ml-1.5 font-medium ${r.delta < 0 ? 'text-negative' : 'text-stone-600'}`}>{r.delta > 0 ? '▲' : r.delta < 0 ? '▼' : ''}{r.delta ? Math.abs(r.delta) : 'no change'}</span>}</div>
                  <div className="mt-0.5 text-stone-600">{r.counts.positive} positive · {r.counts.neutral} neutral · <span className={r.counts.negative ? 'text-negative' : undefined}>{r.counts.negative} negative</span> pages</div>
                  {ch && <div className="mt-0.5 text-stone-600">Top change: {ch.page.domain}, {ch.from} → <span className={ch.to === 'negative' ? 'text-negative' : undefined}>{ch.to}</span></div>}
                  {pages && tip.i === 0 && <div className={`mt-0.5 ${t3}`}>The first run: nothing to compare with</div>}
                </div>
              )
            })()}
            {tip?.kind === 'ribbon' && (
              <div role="tooltip" className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-raised px-3 py-2 text-small shadow-md"
                style={{ left: clampX(tip.x), top: tip.y - 10 }}>
                <span className="font-medium text-stone-900">{tip.rb.page.domain}</span> · {tip.rb.from} → <span className={tip.rb.to === 'negative' ? 'text-negative' : 'text-stone-900'}>{tip.rb.to}</span>
              </div>
            )}
      </div>
    </section>
  )
}

// ---- every page: the first five, then "Show all"; synced with every filter above, sortable. A row's title opens the
// page's drawer (every quote); its domain ↗ opens the cited page in a new tab.
const SORTS = [{ value: 'tone', label: 'Tone' }, { value: 'title', label: 'Title' }, { value: 'engines', label: 'Engines' }]
const FIRST = 5
function AllPages({ pages, lit, filtered }) {
  const [all, setAll] = useState(false)
  const [sort, setSort] = useState('tone')
  const rows = sortPages(pages.filter((p) => lit.has(p.id)), sort, sort === 'engines' ? 'desc' : 'asc')
  const shown = all ? rows : rows.slice(0, FIRST)
  return (
    <section aria-labelledby="pages-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="pages-h" className={h2}>{filtered ? 'Pages that match' : 'All pages'}</h2>
        <Segmented label="Sort pages" size="sm" value={sort} onChange={setSort} options={SORTS} />
      </div>
      <ul className="mt-6 border-t border-[var(--div)]">
        {shown.map((p) => {
          const href = pageHref(p)
          return (
            <li key={p.id} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-[var(--div)] py-2.5 md:grid-cols-[20px_minmax(0,1fr)_minmax(0,220px)_72px_72px]">
              <SiteLogo domain={p.domain} name={p.domain} className="h-5 w-5 rounded !border-0" imgPad="p-0" initialClass="text-[10px]" />
              <button type="button" onClick={() => openDrawer('page', p.id)} className="min-w-0 truncate rounded text-left text-[14px] leading-5 font-medium text-stone-900 outline-none hover:underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-focus">{p.title}</button>
              <span className={`text-right text-[13px] leading-[18px] md:order-last ${TONE_TEXT[p.tone]} ${p.tone === 'negative' ? 'font-medium' : ''}`}>{TONE_LABEL[p.tone]}</span>
              <span className={`col-start-2 min-w-0 truncate text-[12px] leading-4 ${t3} md:col-start-auto md:text-[13px]`}>
                {href
                  ? <a href={href} {...LINK} className="rounded outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">{p.domain} <ArrowUpRight size={12} className="inline" aria-hidden /><span className="sr-only">(opens in a new tab)</span></a>
                  : <span title="No link stored for this page">{p.domain}</span>}
              </span>
              <span className="hidden md:block"><EngineMarks ids={p.engines} /></span>
            </li>
          )
        })}
        {!rows.length && <li className={`py-6 text-[14px] leading-5 ${t2}`}>No pages match these filters.</li>}
      </ul>
      {rows.length > FIRST && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all}
          className={`mt-3 inline-flex items-center gap-1 rounded text-[13px] font-medium ${t2} outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus`}>
          {all ? 'Show fewer' : `Show all ${rows.length}`}<ChevronDown size={14} className={all ? 'rotate-180' : ''} aria-hidden />
        </button>
      )}
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
      footer={<><OpenPage page={p} /><span /></>}>
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
