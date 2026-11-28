import { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Select from '../../components/ui/Select'
import { createPortal } from 'react-dom'
import BetaTag from '../../components/ui/BetaTag'
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, Download, ChevronDown, ChevronRight, Info, Loader2, RefreshCw, Search, SearchX, Smile, X } from 'lucide-react'
import { CalendarDays, Check as CheckIcon } from 'lucide-react' // app: the sync picker
import SiteLogo from '../../components/ui/SiteLogo'
import Modal from '../../components/ui/Modal'
import Switch from '../../components/ui/Switch'
import Insight, { hl, useExplain } from '../../components/ui/Insight'
import { PlatformIcon } from '../../components/dashboard/icons'
import { PrimaryButton, useToast } from '../../components/dashboard/overlays'
import DrawerShell, { Dot, useDrawer } from '../../components/audit/DrawerShell'
import { openDrawer, setParams, useParams } from '../../components/audit/parts'
import { EmptyState, ErrorCard } from '../../components/tool/ToolPage'
import { account, currentBrand } from '@/lib/mock-adapter'
import { looksLikeDomain } from '@/lib/citation-rules' // app: the domain is never shown as the brand's name
import { useProductName } from '@/components/brand/BrandContext'
import { useIsMobile, useMedia } from '../../hooks/useMedia'
import {
  TONES, TONE_LABEL, OPINION_TONES, SCORED_TONES, countTones, emptyRunNote, heroLine, runPages, scoredLine, scoreInfo, scoreOf, sentimentFor, sentimentInsight, shareTrendLine, sortPages, sourceCloud, tonePercents, withScores,
} from '@/lib/sentiment-adapter'
import { forgetSentimentRun, loadSentiment, readSentimentRun, reanalyze, refusedByServer, rememberSentimentRun, rescoreSentiment, runAfter, sentimentDomainUrl, waitForSentimentRun } from '@/lib/sentiment-adapter' // app: the real runs and the paid run
import { QUADRANT, capStack, dotPlan, pageHref, groupThemes, matchIds, neighbour, publicationGroups, quadrantGathered, scatterMinH, springEasing, staggerDelays, tellingSentence } from '../../utils/spectrum'
import { ENGINE_NAME, SCORING_UPDATED_TIP, SENTIMENT_ENGINES, heroTone, prevScoredIndex, toneMove, syncAxisPlan, syncMenu, syncTime, placeMenu, scoringChangedAt, scoreCardDocked, scoreChangeLine, sortAllPages, syncColumns, syncScoreChange, tipLeft, alsoSaidOnSites, changedCount, compareCsv, compareCsvRow, compareEntries, compareFilename, compareList, compareMarks, enginesIn, evenColumns, filterSyncPages, newPageIds, sourceColumns, sourceLead, syncCsv, syncFilename, syncMarks, toneById, turnedNegative } from '@/lib/sentiment-sections' // app: the restyled sections' helpers
import { fmtDay, inkBtn, lineBtn, t2, t3 } from './parts'
import Card from '../../components/dashboard/Card' // app: Missed opportunities' list, built from the Prompt Hub table's parts
import { MenuSelect } from '../../components/dashboard/PageHeader'
import Segmented from '../../components/dashboard/Segmented' // app: Missed opportunities' tone tabs, as Prompt Hub's status tabs
import MissedRangePicker, { fmtRange } from './MissedRangePicker' // app: Missed opportunities' custom date range
import { missedCsv, missedCsvName } from '@/lib/missed-opportunities' // app: Missed opportunities' Download CSV
import { EdgeTip } from '@/components/mock-overview/content-tip'
import { Globe } from 'lucide-react'
import { buttonLabel, publicationName, reachOutFor } from '@/lib/publication-contacts' // app: where Reach out goes
import { foundFor, usePublicationContacts } from '@/lib/publication-contacts-client' // app: Reach out's saved lookups
import { WhatChangedButton, WhatChangedPanel } from '../../whatChanged/WhatChanged'
import { sentiment as sentimentChanges } from '../../whatChanged/sentiment'
import { scaled, useUiScale, uiScale } from '@/lib/ui-scale' // app (owner, 2026-11-09): the UI scale for sizes set in JS

// /sentiment: one visual page about how third-party pages talk about the brand.
//   Header · the spectrum (every page a dot, placed by tone; hover for a quote, click for its drawer; split by engine)
//   · one insight · Over time (each sync's tone mix or score | Pages on <date>, filters, Compare as CSV) · Sources (sites
//   leaning negative | positive across every sync, led by the top site's quote) · All pages. The sections below the hero
//   use the design of the former "What AI says about you" (column heads, 52px rows, hairlines, type).
// Production gives each page a tone only (no number), so dots sit in three bands. Data and logic: data/sentiment.js,
// utils/spectrum.js. States: ?mock=never | running | nopages | error | one | calm (no negative pages).
// app: local-only previews of the scan loader (simulated progress, never a paid run; off in production builds and off
// any host but localhost): ?mock=scan (per-engine and per-page progress) | scan-blocking (what the real scan exposes:
// nothing until the result) | scan-fail | scan-none.
// Fallbacks: ?themes=unlinked (themes not linked to pages) · ?quotes=none (pages analysed before quotes were kept).

const ENGINES = SENTIMENT_ENGINES.map((id) => ({ id, name: ENGINE_NAME[id], short: ENGINE_NAME[id], icon: id === 'google' ? 'aio' : id }))
const engineName = (id) => ENGINES.find((e) => e.id === id)?.name
const EngineIcon = ({ id, size = 14 }) => <PlatformIcon id={ENGINES.find((e) => e.id === id)?.icon ?? id} size={size} />
const EngineMarks = ({ ids, size = 14 }) => (
  <span className="flex items-center gap-1.5">{ids.map((e) => <span key={e} className="flex shrink-0"><EngineIcon id={e} size={size} /><span className="sr-only">{engineName(e)}</span></span>)}</span>
)
// app: the brand picked in the sidebar's switcher (switching brand there loads Sentiment again); no brand control here.
// Read on every render (not once when the page first loads), so a name changed in Brand Setup shows here at once; the
// name is the adapter's (lib/citation-rules.js brandDisplayName: Brand Setup's name, else the domain)
// app (owner, 2026-11-13): the page never prints the domain as the brand: with no name set in Brand Setup it says "your
// brand" (never a name built from the domain either)
const activeBrand = () => {
  const domain = account?.domain ?? currentBrand?.domain ?? null
  const stored = currentBrand?.domain === domain ? currentBrand.name : (account?.name ?? currentBrand?.name ?? null)
  const name = stored && !looksLikeDomain(stored) ? stored : 'your brand'
  return { domain, name }
}
const upFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

// positive ink · neutral t3 · mixed its own grey (--sent-mixed) · negative the negative token
const RING = { positive: 'var(--ink)', neutral: 'var(--color-stone-500)', mixed: 'var(--sent-mixed)', negative: 'var(--negative)' }
const TONE_TEXT = { positive: 'text-ink', neutral: t3, mixed: 'text-stone-700', negative: 'text-negative', unscored: t3 }
const MOCKS = ['never', 'running', 'nopages', 'error', 'one', 'calm']
const SCAN_MOCKS = ['scan', 'scan-blocking', 'scan-fail', 'scan-none']
const scanPreviewAllowed = () => process.env.NODE_ENV !== 'production' && typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
// app: the paid run (POST /api/reputation) is one blocking request: until it returns, only "Asking the AI engines" is
// known (indeterminate). step: the current step (0 ask · 1 read · 2 score); engines: the engines done (null: unknown);
// scored / total: pages scored so far (null: unknown); pages: the pages scored so far (none until the result)
const SCAN_STEPS = ['Asking the AI engines', 'Reading the pages they cite', 'Scoring each page']
// known: false = the real run (no progress): the steps are a plain list, one indicator beside the heading
const SCAN_UNKNOWN = { known: false, step: 0, engines: null, scored: null, total: null, pages: [] }
// the step list's and the Analyzing… button's indicator (reduced motion: still)
const Busy = ({ size = 14 }) => <Loader2 size={size} aria-hidden className="shrink-0 animate-spin text-ink motion-reduce:animate-none" />
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const h2 = 'text-[18px] leading-[26px] font-semibold text-stone-900' // section titles 18/600
const plural = (n, w) => `${n} ${n === 1 ? w : `${w}s`}`

export default function SentimentPage() {
  const product = useProductName()
  useEffect(() => { document.title = `Sentiment · ${product}` }, [product])
  const q = useParams()
  const mock = MOCKS.includes(q.get('mock')) ? q.get('mock') : null
  const scanMock = SCAN_MOCKS.includes(q.get('mock')) && scanPreviewAllowed() ? q.get('mock') : null
  const ACTIVE_BRAND = activeBrand()
  const domain = ACTIVE_BRAND.domain
  const [engine, setEngine] = useState('all')
  // app (owner, 2026-11-14): the Missed opportunities view (?view=missed); Back returns to where the page was
  const missedView = q.get('view') === 'missed'
  const missedScroll = useRef(0)
  const [missedFocus, setMissedFocus] = useState(null) // the page to bring into view in Missed opportunities
  const [split, setSplit] = useState(false)
  const [toneFilter, setToneFilter] = useState(null) // app: { runId, tone }: the hero's tone filter, for the sync it was set on
  const [runId, setRunId] = useState(null) // null = the latest run (app, owner 2026-11-12: the newest run with pages)
  const [confirm, setConfirm] = useState(false)
  const [running, setRunning] = useState(mock === 'running' || Boolean(scanMock))
  const [live, setLive] = useState(null) // app: when the real paid run started (it reports no progress)
  const [openedAt] = useState(() => new Date().toISOString()) // ?mock=running: the elapsed time counts from here
  const [scan, setScan] = useState(null) // app: the scan's progress (null: what the real run exposes, SCAN_UNKNOWN)
  const [scanEnd, setScanEnd] = useState(null) // app: { message, none }: the last run failed or found no pages
  const [simRun, setSimRun] = useState(0) // ?mock=scan…: Try again replays the preview
  const [, setLoadedAt] = useState(0) // app: re-read the runs once the paid run is saved
  const [toastNode, toast] = useToast({ position: 'center' })
  const hero = useRef(null)
  const brand = ACTIVE_BRAND
  const finishRun = useRef(null) // set below once helpers exist; used by resume effect

  const data = sentimentFor(domain, account.domain)
  const never = mock === 'never' || !data.runs.length
  // ?mock=calm: the same run with its negative pages read as neutral · ?quotes=none: every page analysed before quotes
  const noQuotes = q.get('quotes') === 'none'
  const latestPages = data.pages
    .map((p) => (mock === 'calm' && p.tone === 'negative' ? { ...p, tone: 'neutral' } : p))
    .map((p) => (noQuotes ? { ...p, sentences: [], noQuote: true } : p))
  // app (owner, 2026-11-12): the page opens on the newest run with pages (lib/sentiment-adapter.js defaultRunOf); a newer
  // run that found no pages stays in the history and the picker, and is named in one line above the score
  const defaultId = data.defaultRunId ?? data.runs.at(-1)?.id ?? null
  const baseRuns = mock === 'one' ? data.runs.filter((r) => r.id === defaultId) : data.runs
  const runs = withScores(mock === 'calm' ? baseRuns.map((r) => (r.id === defaultId ? { ...r, counts: countTones(latestPages) } : r)) : baseRuns)
  const latest = runs.find((r) => r.id === defaultId) ?? runs.at(-1)
  const emptyNote = emptyRunNote(runs, latest?.id ?? null, fmtDay)
  const run = runs.find((r) => r.id === runId) ?? latest
  const isLatest = !!run && run === latest
  const pagesOf = (r) => (!r || r === latest ? latestPages : runPages(latestPages, r.counts, r.id))
  const pages = pagesOf(run)
  // a finished run with no third-party pages (AUD-022): show the empty result, never "hasn't been analysed yet"
  const noPages = mock === 'nopages' || Boolean(scanEnd?.none) || (!!run && pages.length === 0)
  // app: the picked sync as Over time, This sync and the Pages list read it (lib/sentiment-sections.js syncColumns), and
  // its score change against the sync before (syncScoreChange: the same number as the chart's tooltip)
  const cols = run ? syncColumns(runs, pagesOf, engine) : []
  const col = run ? cols[runs.indexOf(run)] : null
  const change = run ? syncScoreChange(cols, runs.indexOf(run)) : null
  // app (owner, 2026-11-12): the sync before = the last one with a score (a run stored without pages is skipped)
  const prevIndex = run ? prevScoredIndex(cols, runs.indexOf(run)) : -1
  // app (owner, 2026-11-06): did a page actually get more negative since the sync before? (red only then; else the reason)
  const moveWhy = run && col ? toneMove(prevIndex >= 0 ? cols[prevIndex]?.pages ?? null : null, col.pages) : null
  // app: a tone picked under the dot plot applies to that sync only; another sync shows all its pages (heroTone)
  // Guard: with zero runs, `run` is undefined — accessing run.id crashed first-setup brands before the empty-state return.
  const tone = run ? heroTone(toneFilter, run.id) : null
  const setTone = (t) => { if (run) setToneFilter(t ? { runId: run.id, tone: t } : null) }
  // app: each row's marks for the sync shown: New (newPageIds: never cited in an earlier sync) and the tone it had before
  const runIndex = run ? runs.indexOf(run) : -1
  const runPagesAll = runs.map((r) => ({ pages: pagesOf(r) }))
  const freshAll = runIndex >= 0 ? newPageIds(runPagesAll, runIndex) : new Set()
  const prevTonesAll = toneById(prevIndex >= 0 ? runPagesAll[prevIndex]?.pages ?? [] : [])
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
  // End the paid-run UI and clear the session. toastMsg: null = quiet (resume found nothing new to say)
  const endRun = (toastMsg = 'Analysis finished', failed = null) => {
    forgetSentimentRun(domain)
    setLive(null)
    setRunning(false)
    setLoadedAt(Date.now())
    setParams({ mock: null })
    if (failed) setScanEnd({ message: failed })
    if (toastMsg) toast(toastMsg)
  }
  finishRun.current = endRun
  const afterSave = async (startedAt, domainUrl) => {
    // POST can return before the history GET sees the row — poll briefly so a Nov-dated run is not dropped
    let data = await loadSentiment({ domain, domainUrl })
    let found = runAfter(data.runs, startedAt)
    if (!found) {
      data = await waitForSentimentRun({ domain, domainUrl, startedAt, attempts: 8, gapMs: 2000 })
      found = runAfter(data.runs, startedAt)
    }
    setLive(null)
    setLoadedAt(Date.now())
    forgetSentimentRun(domain)
    // app: the hero keeps its chart: the score cross-fades in and the pages' dots stagger in; no pages: a plain line
    // app (owner, 2026-11-12): the new run's own pages decide "none" (data.pages is the newest run with pages, maybe an older one)
    setRunning(false)
    if (found && !(data.byRun?.get(found.id)?.length)) setScanEnd({ none: true, message: `The analysis finished but found no third-party pages that mention ${brand.name}.` })
    else toast('Analysis finished')
  }
  const start = () => {
    // ?mock=scan…: replay the preview, never the paid run
    if (scanMock) { setConfirm(false); setSimRun((n) => n + 1); return }
    setScanEnd(null)
    setConfirm(false); setRunning(true); toast(`Analyzing ${brand.name}: this takes a few minutes`)
    // app: POST /api/reputation (the paid run). Poll in parallel from the start — proxy/client often drops the long
    // POST; the scan can still save, and a reload must still find Nov-dated runs via the pending session (AUD-022).
    const domainUrl = sentimentDomainUrl()
    const startedAt = new Date().toISOString()
    setLive(startedAt)
    rememberSentimentRun(domain, { domainUrl, startedAt })
    let settled = false
    const finish = async (ok) => {
      if (settled) return
      settled = true
      if (ok) await afterSave(startedAt, domainUrl)
    }
    // app (owner, 2026-11-12): cancelled once settled, so a refused scan leaves no poller running
    waitForSentimentRun({ domain, domainUrl, startedAt, cancelled: () => settled })
      .then(async (data) => {
        if (data && runAfter(data.runs, startedAt)) await finish(true)
      })
      .catch(() => { /* POST path / resume effect still settle */ })
    reanalyze(domainUrl)
      .then(() => finish(true))
      .catch(async (e) => {
        // app (owner, 2026-11-12): the server refused the scan with a reason (403, 400, 404, 503, 500…): end the loader
        // at once with that reason and clear the pending run; the polling below is for a dropped request only
        if (refusedByServer(e)) {
          if (settled) return
          settled = true
          forgetSentimentRun(domain)
          setLive(null)
          setRunning(false)
          setScanEnd({ message: e?.message || 'The analysis didn’t finish. Nothing new was saved.' })
          return
        }
        // Proxy/client timeout or drop: keep polling; only fail once the poll has also given up
        try {
          const data = await waitForSentimentRun({ domain, domainUrl, startedAt })
          if (runAfter(data.runs, startedAt)) {
            await finish(true)
            return
          }
        } catch { /* fall through */ }
        if (settled) return
        settled = true
        forgetSentimentRun(domain)
        setLive(null)
        setRunning(false)
        setScanEnd({ message: e?.message || 'The analysis didn’t finish. Nothing new was saved.' })
      })
  }

  // ?mock=scan…: a local preview of the loader with simulated progress (the brand's stored pages stand in for the result)
  useEffect(() => {
    if (!scanMock) return undefined
    const all = latestPages
    const timers = []
    const at = (ms, fn) => timers.push(setTimeout(fn, ms))
    setScanEnd(null); setRunning(true); setLive(new Date().toISOString()); setScan(scanMock === 'scan' ? { ...SCAN_UNKNOWN, known: true, engines: [] } : null)
    const finish = (end) => () => {
      setScan(null); setLive(null); setRunning(false)
      if (end) { setScanEnd(end); return }
      setParams({ mock: null }); toast('Analysis finished')
    }
    if (scanMock === 'scan') {
      SENTIMENT_ENGINES.forEach((e, i) => at(2500 * (i + 1), () => setScan((s) => ({ ...s, engines: [...(s?.engines ?? []), e] }))))
      at(9000, () => setScan((s) => ({ ...s, step: 1 })))
      const gap = Math.max(250, Math.min(700, Math.round(14000 / Math.max(1, all.length))))
      at(12000, () => setScan((s) => ({ ...s, step: 2, scored: 0, total: all.length })))
      all.forEach((_, i) => at(12000 + gap * (i + 1), () => setScan((s) => ({ ...s, scored: i + 1, pages: all.slice(0, i + 1) }))))
      at(12000 + gap * all.length + 800, finish(null))
    } else if (scanMock === 'scan-blocking') at(10000, finish(null))
    else if (scanMock === 'scan-fail') at(6000, finish({ message: 'The analysis didn’t finish. Nothing new was saved.' }))
    else at(6000, finish({ none: true, message: `The analysis finished but found no third-party pages that mention ${brand.name}.` }))
    return () => timers.forEach(clearTimeout)
  }, [scanMock, simRun]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload mid-run: restore Analyzing… and poll until a newer sync appears or the session expires (AUD-022)
  useEffect(() => {
    if (mock === 'running' || mock === 'never' || scanMock) return undefined
    const pending = readSentimentRun(domain)
    if (!pending) return undefined
    setRunning(true)
    setLive(pending.startedAt)
    let cancelled = false
    ;(async () => {
      try {
        const domainUrl = pending.domainUrl || sentimentDomainUrl()
        const data = await waitForSentimentRun({ domain, domainUrl, startedAt: pending.startedAt, cancelled: () => cancelled }) // app (owner, 2026-11-12): an unmount stops this poller
        if (cancelled) return
        if (runAfter(data.runs, pending.startedAt)) await afterSave(pending.startedAt, domainUrl)
        else finishRun.current?.(null, 'The analysis didn’t finish. Nothing new was saved.')
      } catch {
        if (!cancelled) finishRun.current?.(null)
      }
    })()
    return () => { cancelled = true }
  }, [domain]) // eslint-disable-line react-hooks/exhaustive-deps

  // app: ?rescore=1 re-scores saved URLs with Claude/ChatGPT CLI (no new SERP) so tones move between tabs
  useEffect(() => {
    if (mock || q.get('rescore') !== '1' || running) return undefined
    let cancelled = false
    ;(async () => {
      const domainUrl = sentimentDomainUrl()
      setRunning(true)
      setLive(new Date().toISOString())
      toast(`Re-scoring saved pages for ${brand.name}…`)
      try {
        const out = await rescoreSentiment(domainUrl)
        if (cancelled) return
        await loadSentiment({ domain, domainUrl })
        setLoadedAt(Date.now())
        setParams({ rescore: null })
        const n = Number(out?.moved) || 0
        toast(n ? `Updated ${n} page ${n === 1 ? 'tone' : 'tones'}.` : 'Re-score finished — no tones changed.')
      } catch (e) {
        if (!cancelled) toast(e?.message || 'Re-score didn’t finish.')
      } finally {
        if (!cancelled) {
          setLive(null)
          setRunning(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [domain, mock, q.get('rescore')]) // eslint-disable-line react-hooks/exhaustive-deps
  // app (owner, 2026-11-14): Missed opportunities: the picked sync's Neutral and Mixed pages, following the engine
  // filter (Not scored never counts)
  const missedPages = run && !noPages ? pages.filter((p) => (p.tone === 'neutral' || p.tone === 'mixed') && (engine === 'all' || (p.engines ?? []).includes(engine))) : null
  // the page scrolls inside the app's main panel, not the window: Missed opportunities keeps and restores that position
  const scroller = () => {
    for (let el = document.querySelector('.k-sent'); el && el !== document.body; el = el.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight) return el
    }
    return document.scrollingElement || document.documentElement
  }
  const openMissed = () => { const s = scroller(); missedScroll.current = s.scrollTop; setParams({ view: 'missed' }, { push: true }); s.scrollTop = 0 }
  const restoreScroll = useRef(null)
  const closeMissed = () => { setMissedFocus(null); restoreScroll.current = missedScroll.current; setParams({ view: null }) }
  // app (owner, 2026-11-14): a Neutral / Mixed row's "Missed opportunity →": the view opens with that row in view
  const openMissedAt = (id) => { setMissedFocus(id); openMissed() }
  const header = <Header brand={brand} engine={engine} setEngine={setEngine} running={running} onRun={() => setConfirm(true)} hideRun={never && !noPages}
    missed={running || !missedPages ? null : missedPages.length} onMissed={openMissed} />
  const modal = <RunModal open={confirm} onClose={() => setConfirm(false)} brand={brand} onStart={start} first={never} />

  // app: a run that failed or found no pages: one plain line and Try again (the paid run, through its confirm)
  const endLine = scanEnd && !running ? <ScanEndLine message={scanEnd.message} onRetry={() => setConfirm(true)} /> : null
  // app (owner, 2026-11-14): Missed opportunities shows in place of the main view, which stays mounted (hidden) so going
  // back finds it as it was: the same scroll position, "Show all" still open
  const missedShown = Boolean(missedView && missedPages && !running)
  // back from Missed opportunities: the main view's scroll position, set as soon as it's shown again
  useLayoutEffect(() => {
    if (missedShown || restoreScroll.current == null) return
    const top = restoreScroll.current
    restoreScroll.current = null
    // instant (it also stops a smooth scroll still running); repeated for a few frames, because the charts measure their
    // height again once shown and the page is briefly shorter (the position would be clamped)
    let n = 0
    const put = () => {
      const s = scroller()
      s.scrollTo({ top, behavior: 'instant' })
      if (Math.abs(s.scrollTop - top) > 1 && n++ < 20) requestAnimationFrame(put)
    }
    put()
  }, [missedShown]) // eslint-disable-line react-hooks/exhaustive-deps

  if ((never || !run) && !running) {
    if (endLine) return <>{header}<div className="mt-8">{endLine}</div>{modal}{toastNode}</>
    return (
      <>{header}
        <EmptyState icon={Smile} title={`${upFirst(brand.name)} hasn’t been analysed yet`}
          body={`A paid run searches Google for questions about ${brand.name}, reads the third-party pages that come up, and sorts each one into positive, neutral or negative. It takes a few minutes.`}
          action={{ label: 'Analyze · paid run', onClick: () => setConfirm(true) }} />
        {modal}{toastNode}</>
    )
  }
  if (noPages && !running) {
    if (endLine) return <>{header}<div className="mt-8">{endLine}</div>{modal}{toastNode}</>
    return (
      <>{header}
        <EmptyState icon={SearchX} title="No third-party pages found"
          body={`The ${fmtDay(run?.date || latest?.date)} run searched Google but found no pages outside ${brand.domain} that mention ${brand.name}. New brands often have none yet; try again once reviews or press coverage appear.`}
          action={run && latest && run !== latest
            // app (owner, 2026-11-12): an empty run picked from the history: back to the run the page opens on
            ? { label: `Back to the ${fmtDay(latest.date)} run`, onClick: () => setRunId(null) }
            : { label: 'Re-analyze · paid run', onClick: () => setConfirm(true) }} />
        {modal}{toastNode}</>
    )
  }

  return (
    // one spacing system: 64px between sections, 24px inside them (the header belongs with the hero)
    <HistoryCtx.Provider value={{ history }}>
    {missedShown && (
      <div className="k-sent flex max-w-full flex-col overflow-x-clip">
        <MissedOpportunities pages={missedPages} history={history} onBack={closeMissed} brandKey={brand.domain || brand.name}
          engine={engine} setEngine={setEngine} brandName={brand.name} onDownloaded={() => toast('Downloaded')} focusId={missedFocus} />
        {toastNode}
      </div>
    )}
    <div className={`k-sent flex max-w-full flex-col gap-16 overflow-x-clip lg:-mr-3 lg:max-w-none lg:pr-3 ${missedShown ? 'hidden' : ''}`}>
      <div className="flex flex-col gap-6">
        {header}
        {endLine}
        {mock === 'error' && latest && (
          <ErrorCard title="The latest run didn’t finish" reason={`Below: the ${fmtDay(latest.date)} run.`}
            // as the app (#226): why it failed (a source that isn't connected, credits used up) is for a superadmin only
            adminReason="Google credits are used up, so no pages could be found." onRetry={() => setConfirm(true)} />
        )}
      {/* app: while a run is going the same hero shows the loader and its chart, so the dots stay when it ends */}
      <Hero heroRef={hero} col={col} change={change} moveWhy={moveWhy} brand={brand} run={run} isLatest={isLatest} onLatest={() => setRunId(null)} emptyNote={isLatest ? emptyNote : null} pages={pages} lit={lit} engine={engine}
        split={split} setSplit={setSplit} tone={tone} setTone={setTone} theme={null} clearTheme={() => {}} onDot={onDot} themeFor={themeFor}
        scan={running ? (scan ?? SCAN_UNKNOWN) : null} since={live ?? openedAt} />
      </div>
      {!running && run && <>
        <OverTime runs={runs} run={run} latestId={latest.id} pagesOf={pagesOf} engine={engine} brand={brand.name} onPick={(id) => setRunId(id === latest.id ? null : id)} />
        <Sources runs={runs} pagesOf={pagesOf} engine={engine} brand={brand.name} latestPages={latestPages} swot={swot} />
        <AllPages pages={pages} lit={lit} filtered={engine !== 'all' || Boolean(tone)} engine={engine} changeOf={changeOf} brandKey={brand.domain || brand.name} onMissed={openMissedAt} />
      </>}
      <PageDrawer pages={pages} brand={brand} swot={swot} />
      {modal}{!missedShown && toastNode}
    </div>
    </HistoryCtx.Provider>
  )
}

// the line under the score, and the score label's ⓘ: a small tooltip on hover and keyboard focus
const SCORE_NOTE = 'We tracked and analyzed the primary sources AI models rely on to determine your brand’s online credibility. Neutral pages don’t count toward the score.' // app: the last sentence (owner, 2026-11-06; restored 2026-11-09)
// side: app (owner, 2026-11-06) 'left' opens it to the left (the Pages list's tone cell sits at the row's right edge)
function InfoTip({ text, side = 'right' }) {
  return (
    <span className="group/info relative inline-flex">
      <button type="button" aria-label={text} className={`grid h-4 w-4 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus ${t3} hover:text-stone-900`}>
        <Info size={13} aria-hidden />
      </button>
      <span role="tooltip" className={`pointer-events-none absolute ${side === 'left' ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 z-30 w-max max-w-[240px] -translate-y-1/2 whitespace-normal text-left rounded-md border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 font-normal text-stone-700 opacity-0 shadow-sm transition-opacity duration-150 group-hover/info:opacity-100 group-focus-within/info:opacity-100 motion-reduce:transition-none`}>{text}</span>
    </span>
  )
}

// ---- motion helpers (page-local; the shared Segmented in components/dashboard is left as it is)
const GLIDE = 'cubic-bezier(.2,.8,.2,1)'
// Segmented's look and keys, with the white pill sliding to the picked option (transform + width, 220ms)
function Seg({ label, value, onChange, options, size = 'md', className = '', full = false, progress = null }) {
  const refs = useRef([])
  const box = useRef(null)
  const ready = useRef(false)
  const [pill, setPill] = useState(null)
  const idx = options.findIndex((o) => o.value === value)
  useLayoutEffect(() => {
    const measure = () => { const el = refs.current[idx]; if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth }) }
    measure()
    const ro = new ResizeObserver(measure)
    if (box.current) ro.observe(box.current)
    const t = requestAnimationFrame(() => { ready.current = true })
    return () => { ro.disconnect(); cancelAnimationFrame(t) }
  }, [idx, options.map((o) => o.label).join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  const onKey = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const next = (idx + step + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  const glide = ready.current && !reduced() ? `transform 220ms ${GLIDE}, width 220ms ${GLIDE}` : 'none'
  return (
    <div ref={box} role="radiogroup" aria-label={label} onKeyDown={onKey} className={`relative ${full ? 'flex w-full' : 'inline-flex'} ${size === 'sm' ? 'h-8' : 'h-9'} shrink-0 items-center rounded-lg bg-tint p-1 ${className}`}>
      {pill && (
        <span aria-hidden className="absolute bottom-1 left-0 top-1 rounded-md bg-raised shadow-sm" style={{ transform: `translateX(${pill.x}px)`, width: pill.w, transition: glide }}>
          {/* app: a 2px line under the active option that fills while an automatic switch counts down (Over time) */}
          {progress && <span className="absolute inset-x-2 bottom-0 h-[2px] overflow-hidden rounded-full">{progress}</span>}
        </span>
      )}
      {options.map((o, i) => {
        const on = i === idx
        return (
          <button key={o.value} ref={(el) => (refs.current[i] = el)} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => onChange(o.value)}
            className={`relative inline-flex ${size === 'sm' ? 'h-6' : 'h-7'} ${full ? 'flex-1' : ''} items-center justify-center whitespace-nowrap rounded-md px-3 text-small font-medium outline-none transition-colors duration-150 focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'text-ink' : 'text-stone-600 hover:text-stone-900'}`}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
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

// a number that counts to its new value (300ms); reduced motion: it changes at once. app: start (a number) counts in
// from it on the first render (the hero's score and its change, on load)
function useCountUp(value, dur = 300, start = undefined) {
  const first = start !== undefined && value != null && typeof window !== 'undefined' && !reduced()
  const [shown, setShown] = useState(first ? start : value)
  const from = useRef(first ? start : value)
  useEffect(() => {
    const a = from.current
    if (value == null || a == null || a === value || reduced()) { from.current = value; setShown(value); return undefined }
    const t0 = performance.now()
    let raf
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur)
      const v = Math.round(a + (value - a) * (1 - (1 - k) ** 3))
      from.current = v
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, dur])
  return shown
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
            style={{ width: scaled(size), height: scaled(size), ...(c.tone ? { background: TONE_FILL[c.tone] } : { boxShadow: 'inset 0 0 0 1px var(--color-stone-400)' }) }} />
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
function usePeek({ delay = 300 } = {}) {
  const [at, setAt] = useState(null) // the row element the card is under
  const timer = useRef(0)
  const grace = useRef(0)
  const api = useRef(null)
  if (!api.current) {
    api.current = {
      hide: () => { clearTimeout(timer.current); clearTimeout(grace.current); setAt(null) },
      show: (el) => { clearTimeout(grace.current); if (closeOpenPeek && closeOpenPeek !== api.current.hide) closeOpenPeek(); closeOpenPeek = api.current.hide; setAt(el) },
      leave: () => { clearTimeout(timer.current); grace.current = setTimeout(api.current.hide, 100) },
      later: (el) => { clearTimeout(timer.current); clearTimeout(grace.current); timer.current = setTimeout(() => api.current.show(el), delay) },
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
    onPointerEnter: (e) => { if (e.pointerType !== 'mouse') return; clearTimeout(grace.current); const el = e.currentTarget; timer.current = setTimeout(() => show(el), delay) },
    onPointerLeave: (e) => { if (e.pointerType !== 'mouse') return; clearTimeout(timer.current); grace.current = setTimeout(hide, 100) },
    onFocus: (e) => { if (e.target.matches(':focus-visible')) show(e.currentTarget) },
    onBlur: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) hide() },
    onClick: () => hide(),
  }
  const card = { onPointerEnter: () => clearTimeout(grace.current), onPointerLeave: () => { grace.current = setTimeout(hide, 100) } }
  return { at, row, card, hide, show, leave: api.current.leave, later: api.current.later }
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
// a page row's card: its why / quote, else its title and its tone in every sync
function PagePeek({ peek, p }) {
  const { history } = useContext(HistoryCtx)
  const why = pageWhyLine(p)
  const quote = why || p.sentences?.[0]?.text || null
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
function Header({ brand, engine, setEngine, running, onRun, hideRun, missed = null, onMissed = null }) {
  const options = [{ value: 'all', label: 'All' }, ...ENGINES.map((e) => ({ value: e.id, label: <><span className="max-sm:hidden">{e.name}</span><span className="sm:hidden">{e.short}</span></> }))]
  // as the app (#223): "Opportunities n" sits on the header's true centre, on the controls' line and height. When the
  // title or the controls come within 8px of it, it takes its own centred row under them. Below lg it stays under the
  // title, left. Controls order: engine filter, Re-analyze, Summary │ bell.
  const lg = useMedia('(min-width: 1024px)')
  const wrap = useRef(null); const left = useRef(null); const right = useRef(null); const mid = useRef(null)
  const [ownRow, setOwnRow] = useState(false)
  useLayoutEffect(() => {
    if (!lg || missed == null || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => {
      const w = wrap.current?.offsetWidth; const b = mid.current?.offsetWidth
      if (!w || !b) return
      const room = (w - b) / 2 - 8
      setOwnRow(left.current.offsetWidth > room || right.current.offsetWidth > room)
    }
    measure()
    const ro = new ResizeObserver(measure)
    for (const r of [wrap, left, right, mid]) if (r.current) ro.observe(r.current)
    return () => ro.disconnect()
  }, [lg, missed])
  return (
    <div ref={wrap} className="relative flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-6">
      <div ref={left} className="min-w-0">
        <div className="flex items-baseline gap-2.5"><h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">Sentiment</h1><BetaTag tipAlign="left" className="-translate-y-[3px] lg:-translate-y-[6px]" /></div>
        <p className="mt-1 text-body text-stone-600">What sources AI relies on say about {brand.name}.</p>
      </div>
      {missed != null && (
        <div data-header-center data-own-row={ownRow || undefined}
          className={`flex max-lg:self-start max-lg:[&_button]:!w-auto ${ownRow ? 'lg:order-last lg:basis-full lg:justify-center' : 'lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2'}`}>
          <span ref={mid} className="inline-flex"><MissedHeaderButton count={missed} onOpen={onMissed} /></span>
        </div>
      )}
      <div ref={right} className="flex shrink-0 flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:gap-2.5">
        <Seg label="Engine" value={engine} onChange={setEngine} options={options} className="max-lg:w-full" full={false} />
        {!hideRun && (
          <button type="button" onClick={onRun} disabled={running} aria-describedby="reanalyze-tip" className={`group/ra relative ${lineBtn} max-lg:h-10 max-lg:w-full`}>
            {running ? <Busy /> : <RefreshCw size={14} aria-hidden />}
            {running ? 'Analyzing…' : <>Re-analyze<span className={`-ml-1 font-normal ${t3}`}>· paid run</span></>}
            <span id="reanalyze-tip" role="tooltip" className="pointer-events-none absolute right-0 top-full z-30 mt-1.5 whitespace-nowrap rounded-md border border-line bg-raised px-2 py-1 text-[12px] leading-4 font-medium text-stone-700 opacity-0 shadow-sm transition-opacity duration-150 group-hover/ra:opacity-100 group-hover/ra:delay-300 group-focus-visible/ra:opacity-100 motion-reduce:transition-none">
              About 28 paid searches
            </span>
          </button>
        )}
        {/* What changed: the header's right end */}
        <WhatChangedButton config={sentimentChanges} size="md" className="max-lg:self-start" />
        <WhatChangedPanel config={sentimentChanges} />
      </div>
    </div>
  )
}

// the button's count: ticks (rises in) when it changes, e.g. with the engine filter; not on first paint
function TickCount({ value }) {
  const first = useRef(true)
  useEffect(() => { first.current = false }, [])
  return (
    <span className="k-mo-count relative inline-flex h-[18px] min-w-[18px] items-center justify-center overflow-hidden rounded-full bg-ink px-1.5 text-[11px] leading-none font-semibold text-on-ink tabular-nums">{/* a small ink pill */}
      <span key={value} className={first.current ? 'inline-block' : 'k-tick'}>{value}</span>
    </span>
  )
}

// app (owner, 2026-11-14): "Missed opportunities n" with its hover: a soft glow under the cursor (80px, ~14% at its
// centre, fading out), clipped to the button and following it with ~150ms smoothing (fades in 200ms, out 300ms); the
// count rolls up and out and back in from below once per enter (~350ms, a soft spring, at most ~1px past); the button
// drifts up to 2px toward the cursor and settles back on leave; press: 0.97 while held. One rAF loop writes transforms
// only (critically damped: no wobble), and stops once at rest. Reduced motion: none of it, a background colour change.
function MissedHeaderButton({ count, onOpen }) {
  const btn = useRef(null)
  const glow = useRef(null)
  const st = useRef({ on: false, gx: 0, gy: 0, gtx: 0, gty: 0, mx: 0, my: 0, tx: 0, ty: 0, s: 1, ts: 1, raf: 0, last: 0 })
  useEffect(() => () => cancelAnimationFrame(st.current.raf), [])
  const loop = (t) => {
    const s = st.current
    const dt = s.last ? Math.min(64, t - s.last) : 16
    s.last = t
    const k = (tau) => 1 - Math.exp(-dt / tau)
    s.gx += (s.gtx - s.gx) * k(50); s.gy += (s.gty - s.gy) * k(50)
    s.mx += (s.tx - s.mx) * k(70); s.my += (s.ty - s.my) * k(70)
    s.s += (s.ts - s.s) * k(35)
    if (btn.current) btn.current.style.transform = `translate3d(${s.mx.toFixed(2)}px, ${s.my.toFixed(2)}px, 0) scale(${s.s.toFixed(4)})`
    if (glow.current) glow.current.style.transform = `translate3d(${(s.gx - 40).toFixed(1)}px, ${(s.gy - 40).toFixed(1)}px, 0)`
    if (!s.on && Math.abs(s.mx) < 0.01 && Math.abs(s.my) < 0.01 && Math.abs(s.s - 1) < 0.001) {
      if (btn.current) btn.current.style.transform = ''
      s.raf = 0; s.last = 0
      return
    }
    s.raf = requestAnimationFrame(loop)
  }
  const kick = () => { if (!st.current.raf) st.current.raf = requestAnimationFrame(loop) }
  const aim = (e) => {
    const r = btn.current.getBoundingClientRect()
    const s = st.current
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    s.gtx = x; s.gty = y
    s.tx = Math.max(-1, Math.min(1, (x - r.width / 2) / (r.width / 2))) * 2
    s.ty = Math.max(-1, Math.min(1, (y - r.height / 2) / (r.height / 2))) * 2
  }
  const roll = () => {
    const el = btn.current?.querySelector('.k-mo-count > span')
    el?.animate([
      { transform: 'translateY(0)', opacity: 1, easing: 'cubic-bezier(.5,0,.75,0)' },
      { transform: 'translateY(-100%)', opacity: 0, offset: 0.4 },
      { transform: 'translateY(100%)', opacity: 0, offset: 0.401, easing: 'cubic-bezier(.3,1.15,.55,1)' },
      { transform: 'translateY(0)', opacity: 1 },
    ], { duration: 350 })
  }
  const motion = (e) => e.pointerType === 'mouse' && !reduced()
  return (
    <button ref={btn} type="button" onClick={onOpen} data-missed-button
      onPointerEnter={(e) => { if (!motion(e)) return; const s = st.current; s.on = true; aim(e); s.gx = s.gtx; s.gy = s.gty; btn.current.setAttribute('data-lit', ''); roll(); kick() }}
      onPointerMove={(e) => { if (!motion(e)) return; aim(e); kick() }}
      onPointerLeave={() => { const s = st.current; s.on = false; s.tx = 0; s.ty = 0; s.ts = 1; btn.current?.removeAttribute('data-lit'); kick() }}
      onPointerDown={(e) => { if (reduced()) return; st.current.ts = 0.97; if (e.pointerType !== 'mouse') st.current.on = true; kick() }}
      onPointerUp={(e) => { st.current.ts = 1; if (e.pointerType !== 'mouse') st.current.on = false; kick() }}
      onPointerCancel={() => { st.current.ts = 1; st.current.on = false; kick() }}
      // as the app (#223): outlined like Re-analyze, the count in a small ink pill; the glow is a soft ink tint
      className={`k-mo-btn relative isolate overflow-hidden ${lineBtn.replace('transition-colors duration-150', 'motion-reduce:transition-colors motion-reduce:duration-200').replace('hover:bg-tint', 'motion-reduce:hover:bg-tint')} !text-stone-900 max-lg:h-10 max-lg:w-full`}>
      <span ref={glow} aria-hidden className="k-mo-glow pointer-events-none absolute left-0 top-0 -z-10 h-20 w-20 rounded-full"
        style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--ink) 9%, transparent) 0%, transparent 70%)' }} />
      {/* app (owner, 2026-11-14): the label reads "Opportunities" (the view it opens keeps its title) */}
      Opportunities<TickCount value={count} />
    </button>
  )
}

// ---- Missed opportunities (app, owner 2026-11-14): its own view inside Sentiment, nothing else from the main view.
// One row per page of the picked sync that's Neutral or Mixed (following the engine filter), grouped under the day we
// first found it (its earliest sync, never the publish date): "Found Nov 2, 2026" and the group's count; newest day first
// (or oldest, the order control), rows A–Z by publication inside a day. A date filter (All dates · Last 7 / 30 / 90 days,
// by the day first found) and the search narrow the rows; the title's count says "4 of 9" then. The filter and order are
// kept per brand. Pagination counts rows, never headings, and a day's group is never split from its heading.
// Cited by: the engines that cite the page in the sync (the page's own engines, as the main list's icons), in a fixed
// order; below laptop width they sit on the title's second line, after the tone.
// The button in each row says where it leads (lib/publication-contacts.js reachOutFor): the author's page, the
// publication's contact / corrections / tips / press page (bundled list, else the background lookup), the action on the
// page itself for Reddit, YouTube and review sites, else "Find contact" (a web search). Never the home page or article.
// Built from the Prompt Hub table's parts (PromptTable): its card, search box, header row, row style and footer.
const MISSED_RANGES = [{ id: 'all', label: 'All dates' }, { id: '7', label: 'Last 7 days' }, { id: '30', label: 'Last 30 days' }, { id: '90', label: 'Last 90 days' }]
const MISSED_SIZES = [25, 50, 100]
const missedKey = (k) => `kraffic:missed-view:${k}`
const dayOf = (d) => String(d ?? '').slice(0, 10)
const fmtFoundDay = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
// rows → the shown day groups (filter + search), and how many rows they hold
export function missedGroups(rows, { range = 'all', q = '', newest = true, tone = 'all', from = null, to = null, now = Date.now() } = {}) {
  const needle = String(q || '').trim().toLowerCase()
  const cutoff = range === 'all' || range === 'custom' ? null : new Date(now - Number(range) * 86400000).toISOString().slice(0, 10)
  // a custom range: by the day first found, both ends included
  const inCustom = (x) => range !== 'custom' || !from || !to || (x.found && dayOf(x.found) >= from && dayOf(x.found) <= to)
  const kept = rows.filter((x) => (tone === 'all' || x.tone === tone) && (!cutoff || (x.found && dayOf(x.found) >= cutoff)) && inCustom(x)
    && (!needle || [x.title, x.publication, x.domain].some((v) => String(v ?? '').toLowerCase().includes(needle))))
  const by = new Map()
  for (const x of kept) { const d = dayOf(x.found); if (!by.has(d)) by.set(d, []); by.get(d).push(x) }
  const byName = (x, y) => String(x.publication).localeCompare(String(y.publication), undefined, { sensitivity: 'base' }) || String(x.title).localeCompare(String(y.title))
  const groups = [...by.entries()].map(([day, list]) => ({ day, rows: list.sort(byName) }))
    .sort((x, y) => (newest ? y.day.localeCompare(x.day) : x.day.localeCompare(y.day)))
  return { groups, shown: kept.length }
}
// day groups → pages of at most `size` rows, a group kept whole with its heading (one bigger than a page gets its own)
export function pageMissedGroups(groups, size) {
  const pages = []
  let cur = []
  let n = 0
  for (const g of groups) {
    if (n && n + g.rows.length > size) { pages.push(cur); cur = []; n = 0 }
    cur.push(g)
    n += g.rows.length
  }
  if (cur.length) pages.push(cur)
  return pages
}
function readMissedView(brandKey) {
  try {
    const v = JSON.parse(window.localStorage.getItem(missedKey(brandKey)) || 'null')
    const custom = v?.range === 'custom' && /^\d{4}-\d{2}-\d{2}$/.test(v?.from ?? '') && /^\d{4}-\d{2}-\d{2}$/.test(v?.to ?? '')
    return { range: custom || MISSED_RANGES.some((x) => x.id === v?.range) ? v.range : 'all', from: custom ? v.from : null, to: custom ? v.to : null, newest: v?.newest !== false, tone: ['neutral', 'mixed'].includes(v?.tone) ? v.tone : 'all' }
  } catch { return { range: 'all', from: null, to: null, newest: true, tone: 'all' } }
}
// the publication's logo in Fact Check's soft tile (36px, rounded, tint); a neutral globe when it has none
const MissedTile = ({ domain, name }) => (
  <span className="k-tile grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tint" aria-hidden>
    {domain
      ? <span className="grid h-[22px] w-[22px] shrink-0 place-items-center overflow-hidden rounded bg-[var(--logo-plate)]">
          <SiteLogo domain={domain} name={name} className="h-full w-full" fallback={<span className="grid h-full w-full place-items-center bg-surface text-stone-600"><Globe className="h-[70%] w-[70%]" strokeWidth={1.75} /></span>} />
        </span>
      : <Globe size={18} className="text-stone-600" />}
  </span>
)
// Cited by: the page's engines in the fixed engine order (the main list's icons, a little larger), "Cited by <engine>"
// on hover; only the engines that cite it, no placeholders
const MissedEngines = ({ ids = [], size = 16 }) => (
  <span className="flex items-center gap-2">
    {ENGINES.filter((e) => ids.includes(e.id)).map((e) => (
      <EdgeTip key={e.id} tip={`Cited by ${e.name}`} label={`Cited by ${e.name}`} className="flex shrink-0"><EngineIcon id={e.id} size={size} /></EdgeTip>
    ))}
  </span>
)
const MISSED_TH = `whitespace-nowrap text-[13px] leading-5 font-semibold ${t2}`
function MissedOpportunities({ pages, history, onBack, brandKey = '', engine = 'all', setEngine = () => {}, brandName = '', onDownloaded = () => {}, focusId = null }) {
  const baseRows = useMemo(() => {
    const firstSeen = (id) => (history ?? []).find((h) => (h.pages ?? []).some((x) => x.id === id))?.date ?? null
    return pages.map((p) => ({ id: p.id, title: p.title, url: pageHref(p), domain: p.domain, engines: p.engines ?? [], publication: publicationName(p.domain), tone: p.tone, found: firstSeen(p.id), why: String(p.why || '').trim() || p.sentences?.[0]?.text || null }))
  }, [pages, history])
  // app (owner, 2026-11-15): Reach out from the saved lookups (app/api/publication-contacts); the missing or stale ones
  // are looked up in the background and the buttons update when they arrive ("Find contact" until then)
  const lookups = usePublicationContacts(sentimentDomainUrl(), baseRows)
  const rows = useMemo(() => baseRows.map((x) => ({ ...x, reach: reachOutFor({ domain: x.domain, url: x.url }, foundFor(lookups, x)) })), [baseRows, lookups])
  const [view, setView] = useState({ range: 'all', from: null, to: null, newest: true, tone: 'all' })
  useEffect(() => { setView(readMissedView(brandKey)) }, [brandKey]) // after mount: the server render keeps the default
  const keep = (patch) => setView((v) => {
    const next = { ...v, ...patch }
    try { window.localStorage.setItem(missedKey(brandKey), JSON.stringify(next)) } catch { /* not kept */ }
    return next
  })
  const [q, setQ] = useState('')
  const [size, setSize] = useState(MISSED_SIZES[0])
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [q, view.range, view.from, view.to, view.newest, view.tone, size])
  const { groups, shown } = useMemo(() => missedGroups(rows, { range: view.range, from: view.from, to: view.to, q, newest: view.newest, tone: view.tone }), [rows, view.range, view.from, view.to, view.newest, view.tone, q])
  // app (owner, 2026-11-14): the tone tabs' counts follow the search, the date filter and the header's engine filter
  const toneCounts = useMemo(() => {
    const base = missedGroups(rows, { range: view.range, from: view.from, to: view.to, q }).groups.flatMap((g) => g.rows)
    return { all: base.length, neutral: base.filter((x) => x.tone === 'neutral').length, mixed: base.filter((x) => x.tone === 'mixed').length }
  }, [rows, view.range, view.from, view.to, q])
  const pageList = pageMissedGroups(groups, size)
  const current = Math.min(page, Math.max(1, pageList.length))
  const onPage = pageList[current - 1] ?? []
  const before = pageList.slice(0, current - 1).reduce((n, gs) => n + gs.reduce((m, g) => m + g.rows.length, 0), 0)
  const onPageRows = onPage.reduce((n, g) => n + g.rows.length, 0)
  const narrowed = view.range !== 'all' || view.tone !== 'all' || q.trim() !== ''
  const clearAll = () => { keep({ range: 'all', from: null, to: null, tone: 'all' }); setQ('') }
  // app (owner, 2026-11-14): the custom range: its picker, the days that have a found page (dots), today (no future days)
  const [picker, setPicker] = useState(false)
  const marks = useMemo(() => new Set(rows.map((x) => dayOf(x.found)).filter(Boolean)), [rows])
  const today = new Date().toISOString().slice(0, 10)
  const rangeGroups = [{ items: MISSED_RANGES }, { divider: true, items: [{ id: 'custom', label: 'Custom range…', short: view.range === 'custom' && view.from ? fmtRange(view.from, view.to) : 'Custom range…' }] }]
  const pickRange = (id) => { if (id === 'custom') setPicker(true); else keep({ range: id, from: null, to: null }) }
  // header actions: the engine filter (the Sentiment page's own setting) and Download CSV of the rows as shown
  const engineOptions = [{ value: 'all', label: 'All' }, ...ENGINES.map((e) => ({ value: e.id, label: <><span className="max-sm:hidden">{e.name}</span><span className="sm:hidden">{e.short}</span></> }))]
  const download = () => {
    const list = groups.flatMap((g) => g.rows).map((x) => ({ ...x, engines: ENGINES.filter((e) => x.engines.includes(e.id)).map((e) => e.id) }))
    const blob = new Blob([missedCsv(list, engineName)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = missedCsvName(brandName, today)
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    onDownloaded()
  }
  // the line under the title starts with the count: "9 publications mention you…", "4 of 9 publications mention you…"
  const total = rows.length
  const countWords = narrowed ? `${shown} of ${total} publication${total === 1 ? '' : 's'}` : `${total} publication${total === 1 ? '' : 's'}`
  const verb = (narrowed ? shown : total) === 1 ? 'mentions' : 'mention'
  let i = 0 // the rows' stagger index on this page
  // the title's hover card (150ms; stays while the pointer is on it; Esc closes); on touch a tap toggles it and the
  // article's link moves into it
  const peek = usePeek({ delay: 150 })
  const [touchId, setTouchId] = useState(null)
  useEffect(() => {
    if (!peek.at) { setTouchId(null); return undefined }
    const onKey = (e) => { if (e.key === 'Escape') peek.hide() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [peek.at]) // eslint-disable-line react-hooks/exhaustive-deps
  // app (owner, 2026-11-14): opened from a row's "Missed opportunity →": the filters cleared so it's listed, its page
  // shown, the row scrolled to the middle and tinted briefly (mock.src.css .k-flash; reduced motion: no fade)
  const focusPending = useRef(null)
  useEffect(() => {
    if (!focusId) return
    focusPending.current = focusId
    keep({ range: 'all', from: null, to: null, tone: 'all' })
    setQ('')
  }, [focusId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = focusPending.current
    if (!id) return
    const k = pageList.findIndex((gs) => gs.some((g) => g.rows.some((x) => x.id === id)))
    if (k < 0) return
    if (current !== k + 1) { setPage(k + 1); return }
    const el = [...document.querySelectorAll('.k-missed-rows tr[data-key]')].find((tr) => tr.dataset.key === id)
    if (!el) return
    focusPending.current = null
    el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' })
    el.classList.remove('k-flash'); void el.offsetWidth; el.classList.add('k-flash')
    setTimeout(() => el.classList.remove('k-flash'), 1700)
  })
  return (
    <section aria-labelledby="missed-h" className="k-missed-in flex flex-col gap-6">
      <div>
        {/* app (owner, 2026-11-14): the back link 600; the count primary 600; the line one step up (16px), its key
            phrases 600 primary, the rest 400 secondary */}
        <button type="button" onClick={onBack} className="-ml-1 inline-flex items-center gap-1 rounded px-1 text-[13px] leading-[18px] font-semibold text-stone-600 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
          <ChevronRight size={14} className="rotate-180" aria-hidden />Sentiment
        </button>
        {/* app (owner, 2026-11-14): the title alone; the line under it starts with the count and its noun (the only 600
            primary words); the engine filter and Download CSV on the title's line, right, as Prompt Hub's header buttons
            (narrow: they wrap under the line, left-aligned; the title and the line don't move) */}
        <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 id="missed-h" className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">Missed opportunities</h1>
            <p className={`mt-1 text-[16px] leading-6 font-normal ${t2}`}><span data-missed-count className="font-semibold tabular-nums text-stone-900">{countWords}</span> {verb} you without taking a side. Reaching out can turn them in your favour.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5" data-missed-actions>
            <Seg label="Engine" value={engine} onChange={setEngine} options={engineOptions} full={false} />
            {/* app (owner, 2026-11-14): the filled primary, as Prompt Hub's "Add prompt" (PrimaryButton; dark mode inverts) */}
            <PrimaryButton size="sm" icon={Download} type="button" onClick={download} disabled={!shown} data-missed-csv>Download CSV</PrimaryButton>
            {/* What changed: Sentiment's, at the end of the row (its panel is the main view's) */}
            <WhatChangedButton config={sentimentChanges} size="md" />
          </div>
        </div>
      </div>
      <Card id="missed-opportunities" className="scroll-mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-5 py-3">
          <label className="relative min-w-0 max-md:flex-1">
            <span className="sr-only">Search publications</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search publications"
              className="h-10 w-full rounded-lg border border-line bg-raised pl-9 pr-3 text-small text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-400 md:h-9 md:w-64" />
          </label>
          {/* app (owner, 2026-11-14): the tone, in Prompt Hub's status tabs (Segmented), with counts */}
          <Segmented label="Tone" value={view.tone} onChange={(tone) => keep({ tone })}
            options={[{ value: 'all', label: `All ${toneCounts.all}` }, { value: 'neutral', label: `Neutral ${toneCounts.neutral}` }, { value: 'mixed', label: `Mixed ${toneCounts.mixed}` }]} />
          {/* the date filter and the order wrap together to a second line when the row is too narrow */}
          <div className="flex shrink-0 items-center gap-2">
            <span className="relative inline-flex">
              <MenuSelect value={view.range} onChange={pickRange} groups={rangeGroups} listLabel="Date first found" align="left"
                triggerClassName="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-raised px-2.5 text-small outline-none focus-visible:ring-2 focus-visible:ring-focus" />
              {picker && (
                <MissedRangePicker start={view.range === 'custom' ? view.from : null} end={view.range === 'custom' ? view.to : null} marks={marks} today={today}
                  onClose={() => setPicker(false)}
                  onApply={(rg) => { setPicker(false); keep(rg ? { range: 'custom', from: rg.from, to: rg.to } : { range: 'all', from: null, to: null }) }} />
              )}
            </span>
            <button type="button" onClick={() => keep({ newest: !view.newest })} aria-label={`Order: ${view.newest ? 'newest first' : 'oldest first'}. Change`} data-missed-order
              className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-raised px-2.5 text-small font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus">
              {/* app (owner, 2026-11-14): the "All dates" dropdown's outlined button, same height */}
              {view.newest ? 'Newest first' : 'Oldest first'}{view.newest ? <ArrowDown size={14} aria-hidden className="shrink-0 text-ink-3" /> : <ArrowUp size={14} aria-hidden className="shrink-0 text-ink-3" />}
            </button>
          </div>
        </div>
        <table className="k-missed-rows w-full table-fixed">
          <thead>
            <tr className="h-9 border-b border-stone-100 bg-tint">
              <th scope="col" className={`pl-5 pr-3 text-left ${MISSED_TH}`}>Title</th>
              <th scope="col" className={`w-[140px] px-3 text-left ${MISSED_TH} max-lg:w-0 max-lg:px-0`}><span className="max-lg:hidden">Cited by</span></th>
              <th scope="col" className={`w-[200px] px-3 text-left ${MISSED_TH} max-md:w-0 max-md:px-0`}><span className="max-md:hidden">Publication</span></th>
              <th scope="col" className={`w-[180px] pl-3 pr-5 text-right ${MISSED_TH}`}>Reach out</th>
            </tr>
          </thead>
          {onPage.length ? onPage.map((g, gi) => (
            <tbody key={g.day || 'none'} data-missed-day={g.day}>
              {/* app (owner, 2026-11-14): a date row: no fill, the label small (13/600 secondary) with its count, then one
                  standard hairline to the table's right edge, centred on it; slim: the label's line, 8px above, 4px below
                  (no extra space between groups); no line under it; not hoverable */}
              <tr data-missed-band data-band-index={gi}>
                <th scope="rowgroup" colSpan={4} className="pb-1 pl-5 pr-5 pt-2 text-left">
                  <span className="flex items-center gap-3">
                    <span className={`flex shrink-0 items-baseline gap-2 text-[13px] leading-[18px] font-semibold ${t2}`}>
                      {g.day ? `Found ${fmtFoundDay(g.day)}` : 'Found in this sync'}<span className="font-normal tabular-nums">{g.rows.length}</span>
                    </span>
                    <span aria-hidden className="h-px min-w-0 flex-1 bg-line" />
                  </span>
                </th>
              </tr>
              {g.rows.map((x, xi) => (
                <tr key={x.id} data-key={x.id} className={`h-[64px] ${xi < g.rows.length - 1 ? 'border-b border-stone-100' : ''} transition-colors duration-150 hover:bg-stone-50`} style={{ animationDelay: `${120 + Math.min(i++, 12) * 30}ms` }}>
                  <td className="pl-5 pr-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <MissedTile domain={x.domain} name={x.publication} />
                      <span className="block min-w-0">
                        <MissedTitle x={x} peek={peek} onTouch={setTouchId} />
                        <span className={`mt-0.5 flex items-center gap-2 text-[14px] leading-5 font-normal ${t2}`}>
                          <span className="font-semibold">{x.tone === 'mixed' ? 'Mixed' : 'Neutral'}</span>
                          <span className="lg:hidden"><MissedEngines ids={x.engines} size={14} /></span>
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 max-lg:px-0" data-cited-by><span className="max-lg:hidden"><MissedEngines ids={x.engines} /></span></td>
                  <td className="px-3 max-md:px-0"><span className="block truncate text-[14px] leading-5 font-semibold text-stone-900 max-md:hidden">{x.publication}</span></td>
                  <td className="pl-3 pr-5 text-right"><ReachOut reach={x.reach} /></td>
                </tr>
              ))}
            </tbody>
          )) : (
            <tbody>
              <tr className="h-32">
                <td colSpan={4} className="px-5 text-center">
                  {rows.length
                    ? <><p className="text-small text-stone-600">Nothing found.</p>
                      <button type="button" onClick={clearAll} className="mt-2 inline-flex h-8 items-center rounded-md px-2.5 text-small font-medium text-stone-600 transition-colors duration-150 hover:bg-stone-100 hover:text-stone-900">Clear filters</button></>
                    : <p className="text-small text-stone-600">No neutral or mixed publications in this sync.</p>}
                </td>
              </tr>
            </tbody>
          )}
        </table>
        <div className="flex h-12 items-center justify-between border-t border-stone-100 px-5 text-[13px] text-stone-500 proportional-nums">
          <span>Showing {onPageRows ? before + 1 : 0}–{before + onPageRows} of {shown}</span>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              Rows per page
              <Select label="Rows per page" value={size} onChange={(v) => setSize(Number(v))} options={MISSED_SIZES.map((n) => [n, String(n)])} className="w-[68px]" align="right" />
            </label>
            <span>Page {current} of {Math.max(1, pageList.length)}</span>
            <div className="flex items-center gap-1.5">
              <button type="button" aria-label="Previous page" disabled={current <= 1} onClick={() => setPage(current - 1)} className="grid h-8 w-8 place-items-center rounded-md border border-line text-stone-600 transition-colors duration-150 hover:bg-stone-50 hover:text-stone-900 disabled:pointer-events-none disabled:text-stone-300"><ChevronRight size={16} className="rotate-180" aria-hidden /></button>
              <button type="button" aria-label="Next page" disabled={current >= pageList.length} onClick={() => setPage(current + 1)} className="grid h-8 w-8 place-items-center rounded-md border border-line text-stone-600 transition-colors duration-150 hover:bg-stone-50 hover:text-stone-900 disabled:pointer-events-none disabled:text-stone-300"><ChevronRight size={16} aria-hidden /></button>
            </div>
          </div>
        </div>
      </Card>
      <MissedPeek peek={peek} rows={rows} touchId={touchId} />
    </section>
  )
}
// a row's title: the link to the article; with a stored snippet it also opens the hover card (pointer: after 150ms;
// keyboard focus: at once; touch: a tap toggles the card, whose "Open article ↗" line then carries the link)
function MissedTitle({ x, peek, onTouch }) {
  const touch = useRef(false)
  const cls = 'block truncate rounded text-[16px] leading-[22px] font-semibold text-stone-900 outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-focus'
  const rowOf = (el) => el.closest('tr')
  const card = x.why ? {
    onPointerDown: (e) => { touch.current = e.pointerType !== 'mouse' },
    onPointerEnter: (e) => { if (e.pointerType === 'mouse') peek.later(rowOf(e.currentTarget)) },
    onPointerLeave: (e) => { if (e.pointerType === 'mouse') peek.leave() },
    onFocus: (e) => { if (e.target.matches(':focus-visible')) peek.show(rowOf(e.currentTarget)) },
    onBlur: () => { if (!touch.current) peek.hide() },
    onClick: (e) => {
      if (!touch.current) { peek.hide(); return }
      e.preventDefault()
      const el = rowOf(e.currentTarget)
      if (peek.at === el) { peek.hide(); onTouch(null) } else { peek.show(el); onTouch(x.id) }
    },
  } : {}
  return x.url
    ? <a href={x.url} {...LINK} title={x.why ? undefined : x.title} data-title data-has-snippet={x.why ? '' : undefined} className={cls} {...card}>{x.title}</a>
    : <span title={x.title} data-title className={cls} tabIndex={x.why ? 0 : undefined} {...card}>{x.title}</span>
}
// the hover card (the page list's card style): the stored snippet (up to four lines), the tone in 600, "Found <date> ·
// <publication>"; never shown for a page without a snippet
function MissedPeek({ peek, rows, touchId }) {
  const x = peek.at ? rows.find((row) => row.id === peek.at.dataset?.key) : null
  if (!x?.why) return null
  const day = dayOf(x.found)
  return (
    <PeekCard peek={peek}>
      <p data-missed-snippet className="line-clamp-4 text-[15px] leading-[22px] text-stone-900 [text-wrap:pretty]">{x.why}</p>
      <p className="mt-2 text-[13px] leading-[18px] font-semibold text-stone-900">{x.tone === 'mixed' ? 'Mixed' : 'Neutral'}</p>
      <p className={`mt-0.5 text-[13px] leading-[18px] ${t2}`}>{day ? `Found ${fmtFoundDay(day)}` : 'Found in this sync'} · {x.publication}</p>
      {touchId === x.id && x.url && (
        <a href={x.url} {...LINK} className="mt-2 inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-semibold text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Open article<ArrowUpRight size={13} aria-hidden /></a>
      )}
    </PeekCard>
  )
}
// the button says where it leads, all in 600 and all the same width (136px, as before the lookup; owner 2026-11-15:
// long labels shortened on the button, "Respond", "Reply", "Comment", "Letter", the tooltip gives the full destination):
// "Contact page", "Corrections", "Tips", "Press", "Author page", the platform's own action ("Reply on Trustpilot",
// "Reply in thread", "Comment on video", …) or "Find contact"; its tooltip names where it goes (lib/publication-contacts.js
// reachOutFor: the label and the tip)
function ReachOut({ reach }) {
  return (
    <span className="group/ro relative inline-flex">
      {/* app (owner, 2026-11-14): hover / focus: an ink fill wipes in left to right (220ms; out 180ms) and the label turns
          light; the arrow takes off to the top right as a fresh one comes in from the bottom left; the row's logo tile
          lifts 2px; press dips to 0.97 (mock.src.css .k-reach) */}
      <a href={reach.href} {...LINK} aria-label={`${reach.label}: ${reach.tip}`} data-reach={reach.kind}
        className={`k-reach inline-flex h-8 w-[136px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-line px-3 text-[13px] leading-[18px] text-stone-700 outline-none focus-visible:ring-2 focus-visible:ring-focus font-semibold`}>
        <span aria-hidden className="k-reach-fill" />
        <span className="k-reach-label">{buttonLabel(reach.label)}</span>
        <span aria-hidden className="k-reach-arrows"><ArrowUpRight size={13} className="k-arrow-a" /><ArrowUpRight size={13} className="k-arrow-b" /></span>
      </a>
      <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-30 mt-1.5 whitespace-nowrap rounded-md border border-line bg-raised px-2 py-1 text-[12px] leading-4 font-medium text-stone-700 opacity-0 shadow-sm transition-opacity duration-150 group-hover/ro:opacity-100 group-hover/ro:delay-200 group-focus-within/ro:opacity-100 motion-reduce:transition-none">
        {reach.tip}
      </span>
    </span>
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
function Hero({ heroRef, col, change: sync, moveWhy = null, brand, run, isLatest, onLatest, emptyNote = null, pages, lit, engine, split, setSplit, tone, setTone, theme, clearTheme, onDot, themeFor, scan = null, since = null }) {
  // Hooks must run every render; empty-run brands never mount Hero (parent returns EmptyState first).
  const explain = useExplain(`${run?.id || 'none'}|${engine}`)
  // app: the picked sync's column (syncColumns): the same pages and counts as This sync and the Pages list
  const c = col?.counts || { positive: 0, neutral: 0, mixed: 0, negative: 0, unscored: 0 }
  const score = scoreOf(c)
  const counted = useCountUp(score, 300, 0)
  // app: the change since the sync before (syncScoreChange, the tooltip's number): the arrow beside the score (none on
  // the first sync, a gap or no change) and the line under it ("▲ +15 since Oct 27", "No change since …", "First run")
  const change = sync?.delta ? sync : null
  const countedChange = useCountUp(change ? Math.abs(change.delta) : null, 300, 0)
  const text = sentimentInsight(c, brand.name)
  // app (owner, 2026-11-06): neutral is not bad news. Red only when a page actually got more negative (toneMove);
  // otherwise grey, with the reason ("4 new neutral pages · tone unchanged")
  const worse = Boolean(moveWhy?.worse)
  const calm = sync?.dir === 'down' && !worse
  const changeLine = c.positive + c.neutral + c.negative > 0 ? scoreChangeLine(sync, fmtDay) : null
  const move = changeLine && !worse && moveWhy?.reason && !sync?.scoringUpdated && !sync?.first ? `${changeLine} · ${moveWhy.reason}` : changeLine
  const moveClass = sync?.dir === 'down' ? (worse ? 'text-negative' : t3) : sync?.dir === 'up' ? 'text-[var(--rep-up-fg)]' : t3
  // app: the score column and the chart end at the same height (two columns, lg+): the dot plot is only as tall as the
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
  const fitH = colH == null ? null : Math.max(0, colH - CHART_CHROME * uiScale()) // app: the UI scale
  // app: when the run ends, the loader fades out over the score as it fades in (reduced motion: at once)
  const lastScan = useRef(null)
  const [outgoing, setOutgoing] = useState(null)
  useLayoutEffect(() => {
    if (scan) { lastScan.current = { scan, since }; setOutgoing(null); return undefined }
    const snap = lastScan.current
    lastScan.current = null
    if (!snap || reduced()) return undefined
    setOutgoing(snap)
    const t = setTimeout(() => setOutgoing(null), 280)
    return () => clearTimeout(t)
  }, [scan]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!scan && (!run || !col)) return null
  const scanLit = scan ? new Set(scan.pages.map((p) => p.id)) : null
  return (
    <section ref={(el) => { explain.cardRef.current = el; heroRef.current = el }} aria-label="Sentiment spectrum" className="scroll-mt-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        {/* app (owner, 2026-11-14): the block is centred against the chart (the leftover height split above and below) */}
        <div className="relative flex flex-col lg:justify-center">
          <div ref={colTop} className="flex flex-col">
          {scan ? <ScanPanel brand={brand} scan={scan} since={since} /> : <div className={`flex flex-col ${outgoing ? 'motion-safe:animate-[fade-in_240ms_ease-out_both]' : ''}`}>
          {/* app (owner, 2026-11-12): a newer run found no pages; the score is the newest run that has pages */}
          {/* app (owner, 2026-11-14): one even rhythm (16px) down the block: the run line, the label, the score, the verdict
              lines, the two notes; tight inside a group. The score's line box is trimmed to its digits (-my) so the gaps
              read as 16px, not 16px plus the font's own space */}
          {!scan && emptyNote && <p data-empty-run-note className={`mb-4 text-[13px] leading-[18px] ${t2}`}>{emptyNote}</p>}
          {!isLatest && (
            <p data-viewing-run className={`mb-4 text-[13px] leading-[18px] ${t2}`}>
              {/* app (owner, 2026-11-14): too long for the 200px column on one line, so it breaks before "back to latest"
                  (the line break replaces the dot; never a dot ending or starting a line) */}
              <span className="block">Viewing the {fmtDay(run.date)} run</span>
              <button type="button" onClick={onLatest} className="rounded font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">back to latest</button>
            </p>
          )}
          <span className={`flex items-center gap-1.5 text-[13px] leading-[18px] font-medium ${t2}`}>Sentiment score{engine === 'all' ? '' : ` · ${engineName(engine)}`}<InfoTip text={scoreInfo(c)} /></span>
          <span data-score-num className="mt-4 flex items-center gap-3 tabular-nums">
            <span className="-mb-[0.11em] -mt-[0.125em] text-[64px] leading-[64px] font-semibold tracking-[-0.03em] text-stone-900 lg:text-[80px] lg:leading-[80px]">{counted ?? '—'}</span>
            {/* app: ▲ +3 / ▼ −3 since the sync before, about 40% of the score's size, centred on it; counts in with it */}
            {change && (
              <span data-score-change={change.dir} aria-label={`${change.dir === 'up' ? 'Up' : 'Down'} ${Math.abs(change.delta)} since ${fmtDay(change.since)}`}
                className={`inline-flex items-center gap-1 text-[26px] leading-[26px] font-semibold tracking-[-0.02em] lg:text-[32px] lg:leading-[32px] ${change.dir === 'up' ? 'text-[var(--rep-up-fg)]' : calm ? t3 : 'text-negative'}`}>
                <span aria-hidden className="text-[0.6em]">{change.arrow}</span>
                <span aria-hidden>{change.dir === 'up' ? '+' : '−'}{countedChange ?? Math.abs(change.delta)}</span>
              </span>
            )}
          </span>
          {/* app: the first sync scored the new way: "Scoring updated Nov 2" (muted) and its ⓘ, no arrow (lib/sentiment-sections.js scoringChangedAt) */}
          {/* app (owner, 2026-11-14): the verdict lines under the score, one tight block (no box), left-aligned with it:
              the verdict (16/600 primary), the change (secondary; red only for a drop that made a page more negative,
              as before), then each detail on its own line ("1 new mixed page", "Tone unchanged") with its number in
              600; one item per line, no dots, no wrapping */}
          <div data-score-line className="mt-4">
            <p className="whitespace-nowrap text-[16px] leading-6 font-semibold text-stone-900">{heroLine(score, c)}</p>
            {move && (() => {
              const [first, ...rest] = String(move).split(' · ')
              const num = (s) => s.split(/(\d+)/).map((x, k) => (k % 2 ? <span key={k} className="font-semibold">{x}</span> : x))
              const up = (s) => s.charAt(0).toUpperCase() + s.slice(1)
              return <>
                {sync?.scoringUpdated
                  ? <p data-scoring-updated className={`mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[14px] leading-5 font-normal ${t2}`}>{first}<InfoTip text={SCORING_UPDATED_TIP} /></p>
                  : <p className={`mt-0.5 whitespace-nowrap text-[14px] leading-5 font-normal tabular-nums ${sync?.dir === 'down' && worse ? 'text-negative' : t2}`}>{first}</p>}
                {rest.map((x) => <p key={x} className={`mt-0.5 whitespace-nowrap text-[14px] leading-5 font-normal tabular-nums ${t2}`}>{num(up(x))}</p>)}
              </>
            })()}
          </div>
          {(c.positive + c.neutral + c.mixed + c.negative + c.unscored) > 0 && <>
            {/* app (owner, 2026-11-14): two lines, same size and colour: what the score is from, then "Based on N of M
                pages." (its own wording, the numbers in 600) and that neutral and mixed pages don't count */}
            <span data-score-note className={`mt-4 text-[12px] leading-4 font-normal ${t3} [text-wrap:pretty]`}>Scored from the sources AI relies on for your brand.</span>
            <span data-not-counted className={`mt-1 text-[12px] leading-4 font-normal ${t3} tabular-nums [text-wrap:pretty]`}>
              {scoredLine(c).split(/(\d+)/).map((x, k) => (k % 2 ? <span key={k} className="font-semibold">{x}</span> : x))} Neutral and mixed pages don't count.
            </span>
          </>}
          </div>}
          </div>
          {outgoing && <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 motion-safe:animate-[sent-fade-out_240ms_ease-out_both]"><ScanPanel brand={brand} scan={outgoing.scan} since={outgoing.since} /></div>}
        </div>
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className={`min-w-0 truncate text-[13px] leading-[18px] ${t2} ${theme ? '' : 'max-sm:invisible'}`}>
              {theme ? <>Pages behind “{theme.theme}” · <button type="button" onClick={clearTheme} className="rounded font-medium text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">clear</button></> : 'Every publication, placed by its tone'}
            </span>
            <span className={scan ? 'invisible' : ''}><Switch checked={split} onChange={setSplit} spring>Split by engine</Switch></span>
          </div>
          {scan
            ? <Spectrum pages={scan.pages} lit={scanLit} engine="all" split={false} fitH={fitH} scan />
            : <Spectrum pages={pages} lit={lit} engine={engine} split={split} onDot={onDot} themeFor={themeFor} filter={{ c, tone, setTone, explain }} fitH={fitH}
                onMore={(t) => { setParams({ ptone: t }); openDrawer('syncpages', col.r.id) }} />}
        </div>
      </div>
      {text && !scan && <div className="mt-6"><Insight explain={explain} text={text} evidence={{ keys: ['tones'], calc: `Scored pages in the ${fmtDay(run.date)} run. Score = 50 + (positive − negative) ÷ scored pages × 50. Unreadable pages are not scored and are not part of the score.` }} /></div>}
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
// UI: Positive / Negative only (Neutral / Mixed stay out of the spectrum — same basis as the score)
const QUAD_ORDER = ['neutral', 'positive', 'negative', 'mixed'] // owner, 2026-11-13: all four areas again (display only)

// every dot's edge (its badge included: the engine badge sits inside the dot's corner) stays 24px clear of the cross's
// two lines and the outer edges, measured from a line's far side (+1px, the line itself) (owner, 2026-11-04)
const EDGE = 25
// app (owner, 2026-11-15): each area's logos are scattered, hand-placed style, in an invisible zone centred in the
// area (60% of its width, 65% of its height), at least 14px apart (utils/spectrum quadrantGathered); the zone only
// grows, never closer than 12px to the area's edges, lines and label, when it can't hold them (the grid's height still
// comes from EDGE, so the card keeps its size)
const AREA_GAP = 14
const AREA_CLEAR = 12
// app: the run's placeholders, two per quadrant, clear of the corner labels and the cross (fractions of the grid)
const GHOSTS = [[0.18, 0.31], [0.35, 0.17], [0.65, 0.31], [0.83, 0.18], [0.19, 0.67], [0.36, 0.83], [0.66, 0.82], [0.82, 0.67]]

// ---- the tone grid: 2×2 by tone (Neutral · Positive over Negative · Mixed), every page a dot in its tone's quadrant,
// scattered organically (utils/spectrum quadrantScatter: seeded by the page URL, so the same spots on every load; 10px
// apart, 24px clear of the edges, the cross and the labels; position means nothing). "Split by engine": one dot per citing engine, each with its engine's
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

function Spectrum({ pages: listed, lit, engine, split, onDot = (p) => openDrawer('page', p.id), themeFor = () => null, filter = null, fitH = null, onMore = null, scan = false }) {
  // only Positive / Negative pages are placed (Neutral / Mixed / Not scored stay off the grid — same basis as the score)
  const pages = useMemo(() => listed.filter((p) => SCORED_TONES.includes(p.tone)), [listed])
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
  const uiS = useUiScale() // app (owner, 2026-11-09): bubbles, edge and height follow the UI scale
  const r = (mobile ? 12 : 18) * uiS
  const rSmall = (mobile ? 10 : 14) * uiS // app (owner, 2026-11-15): one step smaller for an area with 9 to 16 logos
  const W = Math.max(160, w)
  // about 240px; in the hero as tall as the score column (both end level), never shorter than two rows need
  // about 240px, as tall as the score column (both end level); never less than two staggered rows of dots need
  const H = Math.max(scatterMinH(r, { edge: EDGE * uiS }), fitH ?? 240 * uiS)
  const { c, tone, setTone, explain } = filter || {}
  const counts = c ?? countTones(pages)

  // every dot (one per page; split: one per citing engine) and which are on the grid now
  const byId = new Map(pages.map((p) => [p.id, p]))
  const plan = dotPlan(pages, ENGINES, split).map((d) => ({ ...d, page: byId.get(d.pageId) }))
  const isActive = (d) => d.shown && (split ? engine === 'all' || d.lane === engine : engine === 'all' || d.page.engines.includes(engine))
  // each corner label's width (13px medium, "Neutral 10", its margin and padding), for the clearance around it
  const labelW = Object.fromEntries(QUAD_ORDER.map((k) => [k, Math.ceil(`${TONE_LABEL[k]} ${counts[k] ?? 0}`.length * 7.4) + 12]))
  // app (owner, 2026-11-15): split off, one logo per publication (domain) per area: its first page's dot, the area's
  // other pages of that domain hide under it (utils/spectrum publicationGroups); split on, one per engine as before.
  // Placed by quadrantGathered: a seeded, hand-placed-looking scatter in a central zone of each area, 14px apart
  const groupsOf = (list) => (split ? list.map((d) => ({ key: d.key, tone: d.page.tone, seed: `${d.page.url ?? d.page.id}#${d.lane}`, pages: [d.page], keys: [d.key] })) : publicationGroups(list))
  const pack = (groups) => quadrantGathered(groups, { width: W, height: H, r, rSmall, gap: AREA_GAP * uiS, skew: 6 * uiS, clear: AREA_CLEAR * uiS, labelW })
  const liveGroups = groupsOf(plan.filter(isActive))
  // app: the layouts are recomputed only when what they place changes (not on hover / focus re-renders)
  const packKey = `${split}|${engine}|${W}|${H}|${uiS}|${mobile}|${JSON.stringify(labelW)}|${plan.map((d) => `${d.key}:${d.page.tone}:${d.page.domain}:${(d.page.engines ?? []).join('+')}:${d.shown ? 1 : 0}`).join()}`
  const live = useMemo(() => pack(liveGroups), [packKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // where a dot that's off the grid fades out (its last place)
  const every = useMemo(() => pack(groupsOf(plan.filter((d) => d.shown))), [packKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const groupOf = new Map(liveGroups.map((g) => [g.key, g]))
  const homeOf = new Map(liveGroups.flatMap((g) => g.keys.map((k) => [k, g.key])))
  const placed = plan.map((d) => {
    const g = groupOf.get(d.key)
    const on = Boolean(g) && Boolean(live.pos[d.key])
    const home = homeOf.get(d.key) ?? homeOf.get(`${d.pageId}#0`)
    const at = live.pos[d.key] ?? live.pos[home] ?? every.pos[d.key] ?? every.pos[`${d.pageId}#0`] ?? live.pos[`${d.pageId}#0`] ?? { x: W / 2, y: H / 2 }
    const lit_ = on && g.pages.some((p) => lit.has(p.id))
    const size = live.size[d.page.tone] ?? every.size[d.page.tone] ?? r
    return { ...d, x: at.x, y: at.y, r: size, group: on ? g.pages : null, o: !on ? 0 : lit_ ? 1 : 0.12, on: lit_ }
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
  const show = (d) => { if (performance.now() >= movingUntil.current) setHover({ page: d.page, pages: d.group, x: d.x, y: d.y, r: d.r }) }

  // app: while a run is going (scan): faint placeholders until pages land; each landing page takes the nearest one's place
  const hadScan = useRef(false)
  if (scan) hadScan.current = true
  const ghosts = GHOSTS.map(([gx, gy]) => ({ x: gx * W, y: gy * H }))
  const taken = new Set()
  if (scan) placed.filter((d) => d.o > 0).forEach((d) => {
    let best = -1, dist = Infinity
    ghosts.forEach((g, i) => { const k = (g.x - d.x) ** 2 + (g.y - d.y) ** 2; if (!taken.has(i) && k < dist) { best = i; dist = k } })
    if (best >= 0) taken.add(best)
  })

  const sig = `${split}|${engine}|${W}|${H}|${pages.map((p) => p.id + p.tone).join()}|${[...lit].join()}`
  const lastMode = useRef({ engine, split })
  const dropMode = useRef(scan) // app: dots that join during a run, or with its result, drop into place
  useLayoutEffect(() => {
    const first = firstPaint.current
    firstPaint.current = false
    const drop = !first && (scan || dropMode.current)
    dropMode.current = scan
    let joined = 0
    // app: an engine switch alone moves the dots in 300ms with a slight stagger (fading as they leave or join)
    const engineOnly = !first && lastMode.current.engine !== engine && lastMode.current.split === split
    lastMode.current = { engine, split }
    const order = [...placed].sort((a, b) => a.y - b.y || a.x - b.x)
    const delays = staggerDelays(order.length, engineOnly ? { step: 6, cap: 90 } : MOVE)
    let end = 0
    order.forEach((d, i) => {
      const el = els.current[d.key], t = `translate(${d.x - d.r}px, ${d.y - d.r}px)`
      const fresh = Boolean(el) && !el.dataset.t
      end = Math.max(end, moveTo(el, t, d.o, { delay: delays[i], first, ...(engineOnly ? { dur: 300 } : {}) }))
      // app: a page scored during a run drops ~12px into its quadrant and settles (the result at once: staggered)
      if (drop && fresh && d.o > 0 && !reduced()) {
        const delay = Math.min(joined++, 30) * 40
        el.animate([{ transform: `translate(${d.x - d.r}px, ${d.y - d.r - 12}px)`, opacity: 0 }, { transform: t, opacity: d.o }], { duration: 480, delay, easing: ease(), fill: 'backwards' })
        end = Math.max(end, delay + 480)
      }
      // the entrance: each dot fades in and drifts ~8px down into its spot, staggered (reduced motion: just there)
      if (first && el && d.o > 0 && !reduced()) {
        const delay = Math.min(i, 30) * 22
        el.animate([{ transform: `translate(${d.x - d.r}px, ${d.y - d.r - 8}px)`, opacity: 0 }, { transform: t, opacity: d.o }], { duration: 420, delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' })
        end = Math.max(end, delay + 420)
      }
    })
    if (end) { movingUntil.current = performance.now() + end; setHover(null) }
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { dropMode.current = scan }, [scan]) // app: after the result's dots (the effect above runs first)

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
            // app: during a run the fill shows only once the quadrant has a page
            return <div key={k} className={`absolute ${cy ? 'rounded-bl-xl' : 'rounded-tr-xl'} transition-opacity duration-300 motion-reduce:transition-none`} style={{ left: cx * W / 2, top: cy * H / 2, width: W / 2, height: H / 2, background: bg, opacity: scan && !(counts[k] > 0) ? 0 : 1 }} />
          })}
          <div className="absolute inset-y-0 border-l border-line-strong" style={{ left: W / 2 }} />
          <div className="absolute inset-x-0 border-t border-line-strong" style={{ top: H / 2 }} />
        </div>
        <div className="absolute inset-0" {...(filter ? { role: 'group', 'aria-label': 'Filter by tone' } : {})}>
          {QUAD_ORDER.map((k) => {
            const [cx, cy] = QUADRANT[k]
            // app: during a run, no count until the quadrant's first page (then it ticks up from 1)
            const text = scan && !(counts[k] > 0) ? TONE_LABEL[k]
              : <>{TONE_LABEL[k]} <span key={scan ? counts[k] : 'n'} className={`tabular-nums ${scan ? 'inline-block motion-safe:animate-[fade-in_200ms_ease-out]' : ''}`}>{counts[k] ?? 0}</span></>
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

        {/* app: the run's placeholders (graphite, faint, pulsing out of phase; reduced motion: still) */}
        {hadScan.current && ghosts.map((g, i) => (
          <span key={`ghost${i}`} aria-hidden className="pointer-events-none absolute left-0 top-0 transition-opacity duration-300 ease-out motion-reduce:transition-none"
            style={{ width: 2 * r, height: 2 * r, transform: `translate(${g.x - r}px, ${g.y - r}px)`, opacity: scan && !taken.has(i) ? 1 : 0 }}>
            <span className={`block h-full w-full rounded-full border-2 border-line-strong bg-tint opacity-40 ${scan ? 'motion-safe:animate-[scan-ghost_2.4s_ease-in-out_infinite]' : ''}`} style={{ animationDelay: `${-i * 0.6}s` }} />
          </span>
        ))}
        {/* the dots (split copies hide under their page's dot until the split) */}
        {placed.map((d, n) => {
          const dim = peerOf && d.page.id !== peerOf
          const many = !split && d.group && d.group.length > 1 ? d.group.length : 0
          const small = d.r < r
          return (
            <button key={d.key} ref={reg(d.key)} type="button"
              tabIndex={d.on && d.key === tabKey ? 0 : -1} aria-hidden={!d.on}
              aria-label={many ? `${d.page.domain}: ${many} ${TONE_LABEL[d.page.tone].toLowerCase()} pages. ${themeFor(d.page) ? `Open “${themeFor(d.page).theme}” below` : 'Open the first one’s quotes'}`
                : `${d.page.title}, ${d.page.domain}${split && d.lane !== 'all' ? ` on ${ENGINES.find((e) => e.id === d.lane)?.name ?? d.lane}` : ''}: ${TONE_LABEL[d.page.tone].toLowerCase()}. ${themeFor(d.page) ? `Open “${themeFor(d.page).theme}” below` : 'Open its quotes'}`}
              onClick={(e) => { setHover(null); onDot(d.page); e.currentTarget.blur() }}
              onMouseEnter={() => d.on && show(d)} onFocus={() => { setFocusId(d.key); show(d) }} onBlur={() => setHover(null)} onKeyDown={(e) => onKey(e, d)}
              className={`absolute left-0 top-0 grid place-items-center rounded-full bg-surface outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${d.on ? 'z-[2] hover:z-[3]' : 'pointer-events-none'}`}
              style={{ width: 2 * d.r, height: 2 * d.r, willChange: 'transform' }}>
              {/* app (owner, 2026-11-15): a 1.5px tone ring straight round a white plate (no inner ring or gap), so dark
                  logos show in both themes */}
              <span className="dot-in grid h-full w-full place-items-center rounded-full border-[1.5px] bg-surface transition-opacity duration-150"
                style={{ borderColor: RING[d.page.tone], opacity: dim ? 0.3 : 1 }}>
                <span className="grid h-full w-full place-items-center rounded-full"
                  style={{ background: d.page.tone === 'negative' ? 'color-mix(in srgb, var(--negative) 14%, #fff)' : '#fff' }}>
                  <SiteLogo domain={d.page.domain} name={d.page.domain} className={`${mobile ? (small ? 'h-3 w-3' : 'h-3.5 w-3.5') : small ? 'h-4 w-4' : 'h-5 w-5'} rounded-full !border-0 !bg-transparent`} initialClass="text-[9px] !text-[#44403c]" />
                </span>
              </span>
              {split && d.lane !== 'all' && (
                // app (owner, 2026-11-15): one step smaller with a smaller logo
                <span aria-hidden className={`absolute bottom-0 right-0 grid ${small ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'} place-items-center rounded-full bg-surface ring-1 ring-line transition-opacity duration-150`} style={{ opacity: dim ? 0.3 : 1 }}>
                  <EngineIcon id={d.lane} size={small ? 9 : 12} />
                </span>
              )}
              {/* app (owner, 2026-11-15): a merged logo counts the pages it stands for, inside its top-right corner */}
              {many > 0 && (
                <span aria-hidden data-count className={`absolute right-0 top-0 grid ${small ? 'h-3.5 min-w-3.5 text-[9px]' : 'h-4 min-w-4 text-[10px]'} place-items-center rounded-full bg-surface px-1 leading-none font-semibold tabular-nums text-ink ring-1 ring-line transition-opacity duration-150`}>{many}</span>
              )}
            </button>
          )
        })}
        {/* app (owner, 2026-11-15): past 16 logos in an area, a "+N" chip in one more slot opens the pages drawer on that tone */}
        {Object.entries(live.more).map(([k, m]) => (
          <button key={k} type="button" onClick={() => (onMore ? onMore(k) : null)} disabled={!onMore}
            aria-label={`${m.n} more ${TONE_LABEL[k].toLowerCase()} ${split ? 'dots' : 'publications'}`}
            className={`absolute z-[2] grid place-items-center rounded-full border border-line bg-surface ${m.n > 99 ? 'text-[10px]' : 'text-[12px]'} leading-none font-medium tabular-nums outline-none transition-colors hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus ${t2}`}
            style={{ left: m.x - m.r, top: m.y - m.r, width: 2 * m.r, height: 2 * m.r }}>+{m.n}</button>
        ))}
        {hover && <HoverCard hover={hover} w={w} r={hover.r ?? r} theme={themeFor(hover.page)} />}
      </div>
    </div>
  )
}

// the floating card on hover / focus: who, where, and the one sentence that says it
function HoverCard({ hover, w, r, theme }) {
  const p = hover.page
  const s = tellingSentence(p)
  const W = Math.min(320 * uiScale(), w) // app: the UI scale
  const left = Math.max(0, Math.min(w - W, hover.x - W / 2))
  const above = hover.y > 150
  // app (owner, 2026-11-15): a merged logo (one publication, several pages in this tone): its pages, each with the
  // engines that cite it
  if (hover.pages?.length > 1) {
    const { shown, more } = capStack(hover.pages, 5)
    return (
      <div role="tooltip" className="pointer-events-none absolute z-20 rounded-xl border border-line bg-raised p-3.5 shadow-lg motion-safe:animate-[fade-in_120ms_ease-out]"
        style={{ left, width: W, top: above ? hover.y - r - 10 : hover.y + r + 10, transform: above ? 'translateY(-100%)' : undefined }}>
        <div className="flex items-center gap-2.5">
          <SiteLogo domain={p.domain} name={p.domain} className="h-5 w-5 shrink-0 rounded !border-0" initialClass="text-[10px]" />
          <div className="min-w-0 truncate text-[14px] leading-5 font-semibold text-stone-900">{p.domain}</div>
          <span className={`ml-auto shrink-0 text-[12px] leading-4 tabular-nums ${t3}`}>{hover.pages.length} {TONE_LABEL[p.tone].toLowerCase()} pages</span>
        </div>
        <ul className="mt-2.5 flex flex-col gap-2">
          {shown.map((x) => (
            <li key={x.id} className="flex items-start gap-2">
              <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-5 text-stone-900">{x.title}</span>
              <span className="mt-0.5 flex shrink-0"><EngineMarks ids={x.engines} size={12} /></span>
            </li>
          ))}
        </ul>
        {more > 0 && <p className={`mt-2 text-[12px] leading-4 tabular-nums ${t3}`}>+{more} more</p>}
        <p className={`mt-2 text-[12px] leading-4 ${t3}`}>{theme ? <>Click to open “{theme.theme}” below</> : 'Click for the first page’s quotes'}</p>
      </div>
    )
  }
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
      {s ? <p className="mt-2.5 text-[13px] leading-5 text-stone-900"><Phrase s={s} tone={p.tone} /></p> : <p className={`mt-2.5 text-[13px] leading-5 ${t3}`}>No supporting quote was captured for this page</p>}
      <p className={`mt-2 text-[12px] leading-4 ${t3}`}>{theme ? <>Click to open “{theme.theme}” below</> : (s ? 'Click for every quote' : 'Click for page details')}</p>
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

// app: the loader in the hero's left column while a paid run is going. Only what the run exposes advances: the real run
// is one blocking request, so "Asking the AI engines" stays current (its engines dim) until the result; ?mock=scan
// simulates the rest. Elapsed time from when Analyze started; "about 2 minutes" is the owner's wording.
function useElapsed(since) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const t0 = Date.parse(since)
  const s = Number.isFinite(t0) ? Math.max(0, Math.round((now - t0) / 1000)) : 0
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
function ScanPanel({ brand, scan, since }) {
  const elapsed = useElapsed(since)
  const known = scan.known !== false
  const engineDone = (e) => known && (scan.step > 0 || Boolean(scan.engines?.includes(e)))
  return (
    <div className="flex flex-col">
      <span className="flex items-center gap-2 text-[15px] leading-[22px] font-semibold text-stone-900">{!known && <Busy />}Analyzing {brand.name}</span>
      <ol aria-live="polite" className="mt-4 flex flex-col gap-3">
        {SCAN_STEPS.map((label, i) => {
          // no progress known (the real run): a plain list, no current step, no ticks
          const state = !known ? 'later' : i < scan.step ? 'done' : i === scan.step ? 'now' : 'later'
          return (
            <li key={label} aria-current={state === 'now' ? 'step' : undefined} className="flex items-start gap-2.5">
              <span className="grid h-5 w-3.5 shrink-0 place-items-center">
                {state === 'done' ? <CheckIcon size={14} aria-hidden className="text-ink" /> : state === 'now' ? <Busy /> : <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />}
              </span>
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className={`text-[14px] leading-5 ${state === 'later' ? t2 : 'font-medium text-stone-900'}`}>
                  {label}
                  {i === 2 && scan.scored != null && scan.total != null && <span className={`ml-1.5 font-normal tabular-nums ${t2}`}>{scan.scored} of {scan.total}</span>}
                  <span className="sr-only">{state === 'done' ? ' (done)' : ''}</span>
                </span>
                {i === 0 && (
                  <span className="flex items-center gap-2">
                    {SENTIMENT_ENGINES.map((e) => (
                      <span key={e} className="flex transition-opacity duration-300 motion-reduce:transition-none" style={{ opacity: engineDone(e) ? 1 : 0.35 }}>
                        <EngineIcon id={e} size={14} /><span className="sr-only">{engineName(e)}{engineDone(e) ? ' done' : ''}</span>
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ol>
      <span className={`mt-5 text-[13px] leading-[18px] tabular-nums ${t2}`}>{elapsed} elapsed</span>
      <span className={`text-[13px] leading-[18px] ${t2}`}>Usually takes about 2 minutes</span>
      <span className={`mt-1 text-[12px] leading-4 ${t3}`}>Paid run</span>
    </div>
  )
}
// app: a run that failed or found no pages: what happened, and Try again (the paid run, through its confirm)
function ScanEndLine({ message, onRetry }) {
  return (
    <p role="alert" className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[15px] leading-[22px] text-stone-900">
      <span>{message}</span>
      <button type="button" onClick={onRetry} className="rounded font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">
        Try again<span className={`font-normal ${t3}`}> · paid run</span>
      </button>
    </p>
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
const MIX_ORDER = ['negative', 'neutral', 'mixed', 'positive'] // owner, 2026-11-13: Neutral and Mixed shown again (display only; Not scored stays hidden)
const ROW_H = 52 // a row: the same 52px as What AI says (taller when Positive / Negative carries a why line)
const ROW_H_WHY = 72 // title + one truncated why line (owner, 2026-11-10)
const LIST_ROWS = 6 // Pages on <date>: 6 rows, then "Show all N" (the drawer): the two columns end about level
const COL_HEAD = 'flex h-11 items-end justify-between gap-3 border-b border-line pb-2'
const COL_TITLE = 'flex items-baseline gap-2 text-[15px] leading-[22px] font-semibold'
const ROW_TITLE = 'truncate text-[15px] leading-[22px] font-semibold text-stone-900' // row titles 15/600
const SECOND = 'text-[14px] leading-5 font-normal text-stone-500'
// every segmented control in these sections: 36px tall, 14px padding per option, 4px apart
const SEG = 'gap-1 [&>button]:px-3.5'
// the pages list: favicon | title (and "New") | domain ↗ | engines | tone (or "Neutral → Negative")
const PAGE_GRID = 'grid grid-cols-[20px_minmax(0,1fr)_168px_56px_136px] items-center gap-x-2.5 max-md:grid-cols-[20px_minmax(0,1fr)_112px]' // phones: favicon, title, tone
// Positive / Negative only: the short reason under the title (Neutral / Mixed / Not scored: none)
const pageWhyLine = (p) => ((p?.tone === 'positive' || p?.tone === 'negative') ? (String(p?.why || '').trim() || null) : null)
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
function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    setW(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

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
const TIP_W = 240 // the sync card's width (lib/sentiment-sections tipLeft uses the same)
// app: Score's latest-sync card, docked right of the plot (1280px and wider) or under the chart (narrower)
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
function CrossFade({ k, children }) {
  const [items, setItems] = useState([{ k, node: children }])
  const latest = useRef(children)
  latest.current = children
  useEffect(() => {
    setItems((xs) => (xs.at(-1).k === k ? xs.map((x, i) => (i === xs.length - 1 ? { k, node: latest.current } : x)) : [xs.at(-1), { k, node: latest.current }]))
    const t = setTimeout(() => setItems((xs) => xs.slice(-1)), 160)
    return () => clearTimeout(t)
  }, [k, children])
  const still = typeof window !== 'undefined' && reduced()
  return (
    <div className="grid">
      {items.map((it, i) => (
        <div key={it.k} style={{ gridArea: '1 / 1', animation: still || items.length < 2 ? undefined : `${i === items.length - 1 ? 'fade-in' : 'sent-fade-out'} 150ms ease-out both` }} aria-hidden={i < items.length - 1 || undefined}>{it.node}</div>
      ))}
    </div>
  )
}
function SyncChart({ cols, view, docked = false, hidden, pickedId, onPick, plotH, tips, label, focusTone = null }) {
  const [ref, width] = useWidth()
  // app: Score shows the latest sync's card only while the section is idle (docked: lib/sentiment-sections.js
  // scoreCardDocked): right of the plot from 1280px (the plot narrows to make room, 300ms), under the chart below that.
  // Once the section is in use it fades out (150ms) and the plot widens back (300ms): every date, "Neutral" and the
  // normal hover card, exactly as without it.
  const wide = useMedia('(min-width: 1280px)')
  const dockOn = docked
  const uiS = useUiScale() // app (owner, 2026-11-09): the docked card follows the UI scale
  const dockW = DOCK_W * uiS, dockGap = DOCK_GAP * uiS
  const dockSpace = useEased(dockOn && wide ? dockW + dockGap : 0)
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
  const right = 64 - (Math.min(dockSpace, dockW + dockGap) / (dockW + dockGap)) * 56
  const top = 1 // the list's top hairline
  // app (owner, 2026-11-10): the date only; the page-count row under it is gone (the count is in the hover card and
  // the sync picker), so the axis is 28px instead of 44
  const bottom = 28 // the date and the picked date's underline
  const height = top + plotH + bottom
  const plotW = Math.max(0, width - dockSpace - left - right)
  const slot = n ? plotW / n : 0
  const colW = Math.max(6, Math.min(40, slot * 0.56))
  const bandW = Math.min(slot - 4, colW + 20)
  const x = (i) => left + slot * i + slot / 2
  const y = (v) => top + plotH - (v / 100) * plotH
  const points = cols.map((c, i) => ({ i, score: scoreOf(c.counts) })).filter((p) => p.score != null)
  // app: the first sync scored the new way: a dashed line labelled "Scoring updated" (Visibility history's marker style)
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
  // app (owner, 2026-11-10): the date labels' layout: at most 6 dates, evenly spread (the first, last and picked always
  // shown), the date only, one label per day; any that would still collide are thinned, none leaves the axis
  // (lib/sentiment-sections.js syncAxisPlan). Measured in the chart's own font at 12px / 600 (the picked weight).
  const measure = useMemo(() => {
    if (typeof document === 'undefined') return (t) => t.length * 7
    const ctx = document.createElement('canvas').getContext('2d')
    const fam = (ref.current && getComputedStyle(ref.current).fontFamily) || 'sans-serif'
    ctx.font = `600 12px ${fam}`
    return (t) => Math.ceil(ctx.measureText(t).width)
  }, [width]) // eslint-disable-line react-hooks/exhaustive-deps
  const axis = syncAxisPlan(cols, { xs: cols.map((_, i) => x(i)), picked: pickedIndex, lo: 4, hi: left + plotW + 4, measure, day: fmtDay })
  // the card beside the column, 12px off it, from the plot's top: to its right if it fits in the chart column, else to its
  // left. Never over the column itself.
  // app: the side is decided per bar from the chart column's own width (the same bar always opens on the same side), so
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
              const shown = MIX_ORDER.filter((t) => !hidden.has(t) && c.pct[t])
              const topTone = shown.at(-1)
              let acc = 0
              const x0 = x(i) - colW / 2
              const enter = still ? undefined : { transformBox: 'fill-box', transformOrigin: 'bottom', animation: `rep-grow 300ms ease-out ${i * 30}ms both` }
              return (
                <g key={`${c.r.id}-${runs.mix}`} style={enter}>
                  {MIX_ORDER.map((t) => {
                    const on = shown.includes(t)
                    const from = acc
                    if (on) acc += c.pct[t]
                    const yTop = y(on ? acc : from)
                    // a 2px page-colour gap under every segment but the lowest one shown
                    const yBot = y(from) - (on && t !== shown[0] ? 2 : 0)
                    const h = Math.max(0, yBot - yTop)
                    const isTop = t === topTone
                    const r = isTop ? Math.min(3, h) : 0
                    // app: the picked bar under a tone filter or a This sync preview: that segment ringed, the others at 50%
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
            {/* app: with the card docked the plot has no room for the label beside the line (it sat on the line) */}
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
            const dim = (o) => (axis[i]?.show ? o : 0)
            const lx = axis[i]?.cx ?? x(i)
            return (
              <g key={`l-${c.r.id}`} aria-hidden>
                {/* the date twice: muted 400 and ink 600, crossfading as the pick moves */}
                <text x={lx} y={top + plotH + 18} textAnchor="middle" fontSize={12} fill="var(--color-stone-500)" fontWeight={400} style={{ opacity: on ? 0 : dim(1), transition: swap }}>{axis[i]?.text}</text>
                <text ref={(el) => { labels.current[i] = el }} x={lx} y={top + plotH + 18} textAnchor="middle" fontSize={12} fill="var(--ink)" fontWeight={600} style={{ opacity: on ? 1 : 0, transition: swap }}>{axis[i]?.text}</text>
              </g>
            )
          })}
          {/* the picked date's 2px underline, sliding to the new date (transform only) */}
          {pickedIndex >= 0 && (
            <rect x={0} y={top + plotH + 23} width={1} height={2} fill="var(--ink)" aria-hidden
              style={{ transformOrigin: '0 0', transform: `translateX(${(axis[pickedIndex]?.cx ?? x(pickedIndex)) - (labelW[pickedIndex] ?? 28) / 2}px) scaleX(${labelW[pickedIndex] ?? 28})`, transition: still ? 'none' : `transform 220ms ${SLIDE}` }} />
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
      {/* app: Score's latest-sync card, docked right of the plot (fades in, 8px from the right, after the line) */}
      {wide && n > 0 && (
        <div className="pointer-events-none absolute right-0 z-20" aria-hidden={!dockOn} data-sync-card="dock"
          style={{ top, width: dockW, opacity: dockOn ? 1 : 0, transform: `translateX(${dockOn ? 0 : 8}px)`,
            transition: still ? 'none' : dockOn ? `opacity 200ms ease-out ${DOCK_DELAY}ms, transform 200ms ${SLIDE} ${DOCK_DELAY}ms` : 'opacity 150ms ease-out, transform 150ms ease-out' }}>
          <CrossFade k={hover ?? n - 1}><SyncTip col={cols[hover ?? n - 1]} tip={tips[hover ?? n - 1]} w={dockW} card /></CrossFade>
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
    {/* app: narrower than 1280px, the card goes under the chart */}
    {!wide && dockOn && n > 0 && (
      <div className="mt-3" data-sync-card="under" style={still ? undefined : { animation: `sent-dock-in 200ms ${SLIDE} ${DOCK_DELAY}ms both` }}>
        <CrossFade k={hover ?? n - 1}><SyncTip col={cols[hover ?? n - 1]} tip={tips[hover ?? n - 1]} w="100%" card /></CrossFade>
      </div>
    )}
    </>
  )
}

// "This sync" under the chart: Positive / Negative for the picked sync (shares of all scored pages, same weighted
// basis as scoreOf / Mix). Neutral band lives in the Mix chart; these tiles stay Positive / Negative only.
// ▲▼ vs the sync before (more positive / fewer negative green, the reverse red; nothing on the first sync).
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
        </div>
  )
}

// a sync's hover card: the date, the tone counts, the total and its new pages; logo stacks of the new pages and the
// pages that turned negative, when there are any. Fixed width and tabular figures, so nothing shifts between columns.
// app: card = Score's latest-sync card (not a tooltip), w its width
function SyncTip({ col, tip, w = TIP_W, card = false }) {
  const { counts, pct } = col
  const score = scoreOf(counts)
  const d = tip.change?.delta ?? null
  // as the app (#216): the hover tip is the shared dark card (the same in light and dark, --hc-* tokens); the card
  // docked beside or under the chart keeps the page's surface
  const c = card
    ? { box: 'rounded-md border border-line bg-raised shadow-sm', ink: 'text-stone-900', muted: t3, pos: 'text-ink', neu: 'text-stone-600', mix: 'text-stone-700', neg: 'text-negative', up: 'text-[var(--rep-up-fg)]' }
    : { box: 'rounded-xl border border-[var(--hc-line)] bg-[var(--hc-surface)] shadow-[var(--hc-shadow)]', ink: 'text-[var(--hc-ink)]', muted: 'text-[var(--hc-muted)]', pos: 'text-[var(--hc-ink)]', neu: 'text-[var(--hc-muted)]', mix: 'text-[var(--hc-muted)]', neg: 'text-[var(--hc-down)]', up: 'text-[var(--hc-up)]' }
  const line = (cls, name, t) => (
    <div className={`grid grid-cols-[1fr_3ch_5ch] gap-x-1.5 ${cls}`}><span>{name}</span><span className="text-right">{counts[t]}</span><span className="text-right">{pct[t]}%</span></div>
  )
  return (
    <div role={card ? 'group' : 'tooltip'} aria-label={card ? `Sync ${fmtDay(col.date)}` : undefined} style={{ width: w, maxWidth: w }} className={`${c.box} px-3 py-2.5 text-[12px] leading-4 tabular-nums`}>
      <div className="flex items-start justify-between gap-3">
        {/* app (owner, 2026-11-10): the axis shows the date only, so the card carries the sync's time and page count */}
        <span className="flex flex-col">
          <span className={`font-semibold ${c.ink}`}>{syncTime(col) ? `${fmtDay(col.date)}, ${syncTime(col)}` : fmtDay(col.date)}</span>
          <span className={c.muted} data-sync-tip-pages>{col.pages.length} {col.pages.length === 1 ? 'page' : 'pages'}</span>
        </span>
        {score != null && (
          <span className="flex flex-col items-end">
            <span className={`text-[20px] leading-6 font-semibold ${c.ink}`}>{score}</span>
            {d != null && <span className={`text-[12px] leading-4 ${d > 0 ? c.up : d < 0 ? c.neg : c.muted}`}>{d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '0'}</span>}
          </span>
        )}
          </div>
      <div className="mt-1.5 flex flex-col gap-0.5">
        {line(c.pos, 'Positive', 'positive')}
        {line(c.neu, 'Neutral', 'neutral')}
        {line(c.mix, 'Mixed', 'mixed')}
        {line(c.neg, 'Negative', 'negative')}
        </div>
      {tip.fresh.length > 0 && <div className="mt-2 flex items-center justify-between gap-2"><span className={c.muted}>New this sync</span><FaviconLinks pages={tip.fresh} size="sm" /></div>}
      {tip.turned.length > 0 && <div className="mt-1.5 flex items-center justify-between gap-2"><span className={c.neg}>Turned negative</span><FaviconLinks pages={tip.turned} size="sm" /></div>}
      </div>
  )
}

// the Pages on <date> filters, in the URL (shared by the list and its drawer): ?ptone= positive|neutral|negative ·
// ?peng=google,claude (the engines on) · ?pnew=1 · ?pq=<domain search> · compare mode: ?pcmp=<from run id>~<to run id>
// and ?pchg=1 (only changed pages)
function useSyncFilters() {
  const q = useParams()
  const tone = SCORED_TONES.includes(q.get('ptone')) ? q.get('ptone') : 'all'
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
  const prev = i > 0 ? prevScoredIndex(data, i) : -1 // app (owner, 2026-11-12): skips a run stored without pages
  const prevTones = toneById(prev >= 0 ? allPages[prev]?.pages ?? [] : [])
  const entries = cmp ? compareEntries(data[cmp.fromI].pages, data[cmp.toI].pages, { onlyChanged: cmp.onlyChanged }) : null
  const basePages = entries ? entries.map((e) => e.page) : shownSync?.pages
  const ran = enginesIn(basePages)
  const engs = f.engines ? f.engines.filter((e) => ran.includes(e)) : ran
  // New only stuck on with no new opinion pages → All/Positive/Negative all read 0; clear it for this sync.
  const freshOpinion = (shownSync?.pages || []).filter((p) => fresh.has(p.id) && SCORED_TONES.includes(p.tone))
  useEffect(() => {
    if (f.newOnly && freshOpinion.length === 0) f.setNewOnly(false)
  }, [shownSync?.r?.id, f.newOnly, freshOpinion.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const rest = { engines: f.engines ? engs : null, newOnly: f.newOnly, q: f.q, fresh }
  const list = (tone) => (entries ? compareList(entries, { ...rest, tone }) : sortPages(filterSyncPages(shownSync?.pages, { ...rest, tone })))
  const toneCounts = countTones(list('all'))
  // app: a This sync tile previews a tone on hover / focus; the tabs and the list show it, the URL keeps the locked one
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
  // the tabs' counts tween to their new values (owner, 2026-11-13: Neutral and Mixed again; Not scored stays hidden)
  const tc = { positive: useCountUp(L.toneCounts.positive), negative: useCountUp(L.toneCounts.negative), neutral: useCountUp(L.toneCounts.neutral), mixed: useCountUp(L.toneCounts.mixed) }
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
        { value: 'all', label: `All ${toneCounts.positive + toneCounts.negative + toneCounts.neutral + toneCounts.mixed}` },
        { value: 'positive', label: `Positive ${toneCounts.positive}` },
        { value: 'negative', label: `Negative ${toneCounts.negative}` },
        { value: 'neutral', label: `Neutral ${toneCounts.neutral}` },
        { value: 'mixed', label: `Mixed ${toneCounts.mixed}` },
      ]} />
      {mode === 'compact' ? (
        <Pop label={`Filters${(engs.length < ran.length ? 1 : 0) + (f.newOnly ? 1 : 0) + (f.q ? 1 : 0) ? ` ${(engs.length < ran.length ? 1 : 0) + (f.newOnly ? 1 : 0) + (f.q ? 1 : 0)}` : ''}`} align="right" width={240} dialog="Filters">
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

function OverTime({ runs, run, latestId = null, onPick: pickSync, pagesOf, engine, brand }) {
  const uiS = useUiScale() // app (owner, 2026-11-09): the plot and the list's rows follow the UI scale
  const [view, setView] = useState('mix') // Mix on every visit
  const [hidden, setHidden] = useState(() => new Set())
  const data = useMemo(() => syncColumns(runs, pagesOf, engine), [runs, engine]) // eslint-disable-line react-hooks/exhaustive-deps -- app: lib/sentiment-sections.js, as the hero reads it
  const n = data.length
  const picked = data.find((d) => d.r.id === run.id) ?? data.at(-1)
  // app (owner, 2026-11-12): "Back to latest" = the run the page opens on (the newest with pages), not a newer empty one
  const home = data.find((d) => d.r.id === latestId) ?? data.at(-1)
  const [preview, setPreview] = useState(null) // a This sync tile's tone while hovered / focused
  const L = useSyncList(data, runs, pagesOf, picked, preview)
  // app: Mix and Score alternate every 4s (a progress line under the active tab), paused while the pointer or focus is
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
    return { fresh: d.pages.filter((p) => fresh.has(p.id)), turned: turnedNegative(d.pages, (i > 0 ? data[prevScoredIndex(data, i)]?.pages : null) ?? []), change: syncScoreChange(data, i) }
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
      setMode(full <= room ? 'full' : 'compact')
    }
    fit()
    const ro = new ResizeObserver(fit)
    if (barRef.current) ro.observe(barRef.current)
    return () => ro.disconnect()
  }, [n, L.toneCounts.positive, L.toneCounts.neutral, L.toneCounts.mixed, L.toneCounts.negative])
  const listFade = useEngineFade(engine)
  // rows that stay slide, the rest fade (tone filter, engines, a new date)
  const listRef = useRef(null)
  useFlip(listRef, L.rows.slice(0, LIST_ROWS).map((p) => p.id), { move: 200 })
  if (!n) return null
  const toggleTone = (t) => setHidden((h) => { const s = new Set(h); if (s.has(t)) s.delete(t); else if (s.size < TONES.length - 1) s.add(t); return s })
  const label = shareTrendLine(data) || 'Sentiment share by sync'
  const first = L.rows.slice(0, LIST_ROWS)
  const listMinH = first.reduce((h, p) => h + (pageWhyLine(p) ? ROW_H_WHY : ROW_H) * uiS, 0) + 1
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
          <div className={`${COL_HEAD} @container`}>
            <h3 id="pages-on-h" className={`min-w-0 ${COL_TITLE}`}>
              {/* app (owner, 2026-11-06): "Pages on" then our own sync picker (the date, the page count, "Earlier sync")
                  and "Back to latest" on the same line; compare mode keeps its title and count */}
              {L.compare
                ? <><span className="truncate text-ink">Pages compared</span><span className="tabular-nums text-stone-500"><CountUp value={L.rows.length} /></span></>
                : <span className="shrink-0 text-ink">Pages on</span>}
            </h3>
            {!L.compare && (
              <span className="-mb-1 mr-auto flex min-w-0 items-center gap-2">
                <SyncPicker cols={data} pickedId={picked.r.id} onPick={onPick} />
                {picked !== home && (
                  <button type="button" data-back-latest onClick={() => onPick(home.r.id)}
                    className="shrink-0 rounded text-[13px] leading-[18px] font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Back to latest</button>
                )}
              </span>
            )}
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
        <div ref={barRef} className="relative order-5 flex h-14 min-w-0 items-center md:order-none">
          <SyncFilters L={L} mode={mode} />
          {/* the full line, measured off screen: its parts decide the mode (full · Filters menu) */}
          <div ref={probeRef} aria-hidden inert="" className="pointer-events-none invisible absolute left-0 top-0 flex w-max">
            <SyncFilters L={L} />
          </div>
        </div>
        <div className="order-3 min-w-0 md:order-none">
          <SyncChart cols={data} view={view} docked={scoreCardDocked({ view, auto, pointerIn, focusIn })} hidden={hidden} pickedId={picked?.r.id} onPick={onPick} plotH={PLOT_H * uiS} tips={tips} label={label} focusTone={L.f.tone !== 'all' ? L.f.tone : null} />
          {n < 2 && <p className={`mt-2 ${SECOND}`}>Trend starts after the next sync</p>}
          <SyncTiles col={picked} prev={data[data.indexOf(picked) - 1] ?? null} selected={L.lockedTone} onPreview={setPreview} onLock={lockTone} />
        </div>
        <div className="order-6 min-w-0 md:order-none">
          <ul ref={listRef} className="relative border-t border-[var(--div)]" style={{ minHeight: Math.max(LIST_ROWS * ROW_H * uiS + 1, listMinH), ...listFade }}>
            {first.map((p) => <SyncPageRow key={p.id} p={p} change={L.change(p)} />)}
            {!L.rows.length && (
              <li className={`flex min-h-[52px] items-center border-b border-[var(--div)] ${SECOND}`}>
                {L.f.newOnly
                  ? <>No new positive or negative pages this sync. <button type="button" onClick={() => L.f.setNewOnly(false)} className="ml-1 rounded font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Show all pages</button></>
                  : 'No pages match these filters.'}
              </li>
            )}
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

// app (owner, 2026-11-06, client point 4): the picked sync as our own dropdown in the Pages header (like Compare and
// the engine menu). The button: a calendar, "Sep 30, 08:47", "· 14 pages" (muted), an "Earlier sync" tag when it isn't
// the latest, a chevron; 32px, a light border, a hover tint. The menu: portalled to the page's root (nothing clips it), under the button
// and kept on screen (placeMenu), 280px, the popover surface; rows of 36px: date and time (500) · the page count (muted,
// right); "Latest" on the newest; a check on the picked one; month headings past 8 syncs (syncMenu). Keyboard: arrows,
// Home / End, Enter, Esc; a click outside closes it. Picking one moves the chart, This sync and the hero with it.
const MENU_W = 280
function SyncPicker({ cols, pickedId, onPick }) {
  const groups = syncMenu(cols, fmtDay)
  const rows = groups.flatMap((g) => g.rows)
  const cur = rows.find((o) => o.id === pickedId) ?? rows[0]
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const menu = useRef(null)
  const listId = useId()
  const show = () => { setActive(Math.max(0, rows.findIndex((o) => o.id === pickedId))); setPos(null); setOpen(true) }
  const close = (refocus = true) => { setOpen(false); if (refocus) btn.current?.focus() }
  const choose = (o) => { onPick(o.id); close() }
  useLayoutEffect(() => {
    if (!open || !btn.current || !menu.current) return
    const r = menu.current.getBoundingClientRect()
    setPos(placeMenu(btn.current.getBoundingClientRect(), r.width, r.height, window.innerWidth, window.innerHeight))
  }, [open])
  useEffect(() => {
    if (!open) return undefined
    const down = (e) => { if (!menu.current?.contains(e.target) && !btn.current?.contains(e.target)) close(false) }
    const away = () => close(false)
    document.addEventListener('mousedown', down)
    window.addEventListener('scroll', away, true)
    window.addEventListener('resize', away)
    menu.current?.focus()
    return () => { document.removeEventListener('mousedown', down); window.removeEventListener('scroll', away, true); window.removeEventListener('resize', away) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const onKey = (e) => {
    const k = e.key
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    else if (k === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(rows.length - 1, i + 1)) }
    else if (k === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)) }
    else if (k === 'Home') { e.preventDefault(); setActive(0) }
    else if (k === 'End') { e.preventDefault(); setActive(rows.length - 1) }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); if (rows[active]) choose(rows[active]) }
    else if (k === 'Tab') close(false)
  }
  const earlier = cur && !cur.latest
  let n = -1
  return (
    <>
      <button ref={btn} type="button" data-sync-picker aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-label={`Sync: ${cur?.label ?? ''}, ${cur?.pages ?? 0} pages${earlier ? ', an earlier sync' : ''}. Change sync`}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); show() } }}
        className={`inline-flex h-8 min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md border border-line px-2.5 text-[14px] leading-5 font-medium text-stone-900 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus ${open ? 'bg-tint' : ''}`}>
        <CalendarDays size={14} aria-hidden className="shrink-0 text-stone-500" />
        <FadeText text={cur?.label ?? ''} />
        {/* on an earlier sync the tag and "Back to latest" need the room: the count steps aside in a narrow header */}
        <span data-picker-count className={`shrink-0 font-normal tabular-nums text-stone-500 ${earlier ? '@max-[720px]:hidden' : ''}`}>· {cur?.pages ?? 0} {cur?.pages === 1 ? 'page' : 'pages'}</span>
        {earlier && <span data-earlier-sync className="shrink-0 rounded-[4px] bg-tint px-1.5 py-0.5 text-[11px] leading-[14px] font-medium text-stone-700">Earlier sync</span>}
        <ChevronDown size={14} aria-hidden className={`shrink-0 text-stone-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={menu} id={listId} role="listbox" tabIndex={-1} aria-label="Syncs" aria-activedescendant={`${listId}-${active}`} onKeyDown={onKey}
          style={{ ...(pos ?? { left: -9999, top: 0 }), width: MENU_W, maxHeight: 'min(420px, calc(100vh - 16px))' }}
          className="fixed z-[70] overflow-y-auto overscroll-contain rounded-xl border border-line bg-raised p-1 shadow-lg outline-none motion-safe:animate-[fade-in_120ms_ease-out]">
          {groups.map((g) => (
            <div key={g.heading ?? 'all'} role="group" aria-label={g.heading ?? undefined}>
              {g.heading && <div className="px-2.5 pb-1 pt-2 text-[12px] leading-4 font-medium text-stone-500">{g.heading}</div>}
              {g.rows.map((o) => {
                n += 1
                const i = n
                const sel = o.id === pickedId
                return (
                  <div key={o.id} id={`${listId}-${i}`} role="option" aria-selected={sel} data-sync-option={o.id}
                    onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(o)}
                    className={`flex h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[14px] leading-5 ${i === active ? 'bg-tint' : ''}`}>
                    <span className="grid w-4 shrink-0 place-items-center">{sel && <CheckIcon size={14} aria-hidden className="text-ink" />}</span>
                    <span className="min-w-0 truncate font-medium text-stone-900 tabular-nums">{o.label}</span>
                    {o.latest && <span className="shrink-0 rounded-[4px] bg-tint px-1.5 py-0.5 text-[11px] leading-[14px] font-medium text-stone-700">Latest</span>}
                    <span className="ml-auto shrink-0 text-[13px] tabular-nums text-stone-500">{o.pages} {o.pages === 1 ? 'page' : 'pages'}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>,
        document.querySelector('.k-sent') ?? document.body, // the page's root, as the hover cards (its styles apply)
      )}
    </>
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
  const why = pageWhyLine(p)
  return (
            <li data-row="drawer" data-key={p.id} {...peek.row} className="grid grid-cols-[20px_minmax(0,1fr)_136px] items-center gap-x-2.5 border-b border-[var(--div)] px-4 py-2.5 transition-colors duration-150 hover:bg-[var(--row-hover)] md:px-6">
              <PagePeek peek={peek} p={p} />
              <Fav domain={p.domain} />
              <span className="min-w-0">
                <TitleCell change={c} competitor={p.onCompetitorSite}>
                  {href
                    ? <a href={href} {...LINK} aria-label={`${p.title} (opens in a new tab)`} data-title className={`min-w-0 rounded outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-focus ${ROW_TITLE}`}>{p.title}<span className="sr-only"> (opens in a new tab)</span></a>
                    : <span className={`min-w-0 ${ROW_TITLE}`}>{p.title}</span>}
                </TitleCell>
                {why && <p data-why className={`mt-0.5 truncate ${SECOND}`} title={why}>{why}</p>}
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
      <Select label={label} value={value} onChange={(v) => onChange(Number(v))} options={cols.map((c, i) => [i, fmtDay(c.date)])} size="md" className="w-full" />
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

const NEUTRAL_TIP = 'Mentions the brand without taking a side. Doesn’t affect the score.' // app (owner, 2026-11-06; restored 2026-11-09)
// a row's marks (lib/sentiment-sections syncMarks / compareMarks): favicon · [New] · title, the chip before the title so
// the title takes the ellipsis and the chip is never cut; the tone right-aligned and, when it changed, a second line
// the page's tone at the picked sync only, one line (2026-11-01: no "from <tone>" line; the Compare CSV keeps tone_from /
// tone_to). A page that dropped out of a comparison reads "Not cited". The row stays 52px.
const NewChip = () => <span data-new className="mr-2 inline-flex shrink-0 items-center rounded-[4px] bg-ink px-1.5 py-0.5 text-[11px] leading-[14px] font-medium text-on-ink">New</span>
// app (owner, 2026-11-10): a page on a tracked competitor's own site says so after its title, muted (lib/sentiment-adapter.js
// onCompetitorSite)
const TitleCell = ({ children, change, competitor = false }) => (
  <span className="flex min-w-0 items-center">{change?.isNew && <NewChip />}{children}
    {competitor && <span data-competitor-page className={`ml-2 shrink-0 whitespace-nowrap ${SECOND}`}>Competitor’s page</span>}
  </span>
)
function ToneCell({ p, change, className = '' }) {
  const tone = change?.tone ?? p.tone
  return (
    <span data-tone className={`flex flex-col items-end whitespace-nowrap text-right ${className}`}>
      {/* app (owner, 2026-11-06): neutral is not bad news: its ⓘ says it doesn't affect the score */}
      {!change?.gone && tone === 'neutral'
        ? <span data-neutral-note className={`flex items-center gap-1 text-[14px] leading-5 ${TONE_TEXT[tone]}`}>{TONE_LABEL[tone]}<InfoTip side="left" text={NEUTRAL_TIP} /></span>
        : <span className={`text-[14px] leading-5 ${change?.gone ? t3 : TONE_TEXT[tone]}`}>{change?.gone ? 'Not cited' : TONE_LABEL[tone]}</span>}
    </span>
  )
}

// a page in a sync, on the list's fixed columns: favicon | title (and "New") | domain ↗ | engines | tone
// Positive / Negative: optional one-line why under the title (owner, 2026-11-10)
function SyncPageRow({ p, change = null }) {
  const href = pageHref(p)
  const peek = usePeek()
  const why = pageWhyLine(p)
  return (
    <li data-row="sync" data-key={p.id} {...peek.row} className={`${PAGE_GRID} ${why ? 'min-h-[72px] py-2.5 items-start' : 'h-[52px]'} border-b border-[var(--div)] transition-colors duration-150 hover:bg-[var(--row-hover)]`}>
      <PagePeek peek={peek} p={p} />
      <span className={why ? 'mt-0.5' : undefined}><Fav domain={p.domain} /></span>
      <span className="min-w-0">
        <TitleCell change={change} competitor={p.onCompetitorSite}>
          {href
            ? <a href={href} {...LINK} aria-label={`${p.title} (opens in a new tab)`} data-title className={`min-w-0 rounded outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-focus ${ROW_TITLE}`}>{p.title}<span className="sr-only"> (opens in a new tab)</span></a>
            : <span data-title className={`min-w-0 ${ROW_TITLE}`}>{p.title}</span>}
        </TitleCell>
        {why && <p data-why className={`mt-0.5 truncate ${SECOND}`} title={why}>{why}</p>}
      </span>
      <span data-domain className={`min-w-0 truncate ${SECOND} max-md:hidden ${why ? 'mt-0.5' : ''}`}>
        {href ? <a href={href} {...LINK} className="rounded outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">{p.domain} <ArrowUpRight size={12} className="inline" aria-hidden /></a> : p.domain}
      </span>
      <span data-engines className={`flex max-md:hidden ${why ? 'mt-0.5' : ''}`}><EngineMarks ids={p.engines} size={14} /></span>
      <span className={why ? 'mt-0.5' : undefined}><ToneCell p={p} change={change} /></span>
    </li>
  )
}

// ---- Sources: Harsh's sources across every sync (sourceCloud) in two columns. The heads and the lead blocks share
// grid rows (they line up); below them each column is its own stack, so opening a row moves only its column down
// (collapsed rows still line up across the two). Each column leads with the top site's quote, or, with no quote, the top
// site's numbers ("negative in 5 of 6 syncs"). Rows: favicon | domain ⌄ | bar | syncs | engines. Hover: the site's
// quote (or its tone in every sync); click: the row opens in place (quotes, tone across syncs, its pages); several can
// be open. A column more than a row longer shows "+n more" (the drawer with all of them).
const SRC_GRID = 'grid grid-cols-[20px_minmax(0,1fr)_120px_48px_64px] items-center gap-x-3'
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
                    <li key={h.id ?? h.url} className="grid h-11 grid-cols-[minmax(0,1fr)_minmax(0,140px)_56px_72px] items-center gap-x-2.5 border-b border-[var(--div)]">
                      {href
                        ? <a href={href} {...LINK} aria-label={`${h.title} (opens in a new tab)`} className={`min-w-0 rounded outline-none underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${ROW_TITLE}`}>{h.title}<span className="sr-only"> (opens in a new tab)</span></a>
                        : <span className={`min-w-0 ${ROW_TITLE}`}>{h.title}</span>}
                      {/* app: the domain ↗ opens the page too (it was text with an arrow) */}
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
// app (owner, 2026-11-14): "Sort by", the active option's direction as a small arrow (clicking it again flips it) and the
// order in words after the control. The default order is sortAllPages' (Harsh's, unchanged); the flipped one reverses
// its groups (tone, engine count) and keeps titles A–Z inside each, Title simply runs Z–A. Kept per brand between visits.
const SORT_LINE = { tone: ['Negative first', 'Positive first'], title: ['A to Z', 'Z to A'], engines: ['Cited by most engines first', 'Cited by fewest engines first'] }
const SORT_WORDS = { tone: ['Negative first', 'Positive first'], title: ['A to Z', 'Z to A'], engines: ['Most first', 'Fewest first'] } // inside the active option
const SORT_GROUP = { tone: (p) => (p.tone === 'negative' ? 0 : p.tone === 'positive' ? 2 : 1), engines: (p) => p.engines?.length ?? 0 }
export function flipSorted(rows, key) {
  if (key === 'title') return [...rows].reverse()
  const groups = []
  for (const p of rows) {
    const k = SORT_GROUP[key](p)
    if (groups.length && groups.at(-1).k === k) groups.at(-1).items.push(p)
    else groups.push({ k, items: [p] })
  }
  return groups.reverse().flatMap((g) => g.items)
}
const sortStoreKey = (brandKey) => `kraffic:sentiment-sort:${brandKey}`
function readSort(brandKey) {
  try {
    const v = JSON.parse(window.localStorage.getItem(sortStoreKey(brandKey)) || 'null')
    if (v && SORT_LINE[v.key]) return { key: v.key, flip: Boolean(v.flip) }
  } catch { /* no storage: the default order */ }
  return { key: 'tone', flip: false }
}
const FIRST = 5
// app (owner, 2026-11-14): the tone column holds the tone and, after it, a 28px slot on every row (the arrow to Missed
// opportunities on Neutral / Mixed rows, empty on the others), so the tones stay aligned down the list
const ALL_GRID = 'grid grid-cols-[20px_minmax(0,1fr)_168px_56px_168px] items-center gap-x-2.5 max-md:grid-cols-[20px_minmax(0,1fr)_168px]'
// the arrow from a Neutral / Mixed row to Missed opportunities (the row in view there): icon only, quiet at rest
// (secondary at ~50%), full contrast and a 2px nudge right when the row or the arrow is hovered or focused; its own
// click only; a 28px hit area
function MissedLink({ onOpen }) {
  return (
    <EdgeTip tip="Open in Missed opportunities" focusable={false} className="inline-flex shrink-0">
      <button type="button" data-missed-link aria-label="Open in Missed opportunities" onClick={(e) => { e.stopPropagation(); onOpen() }}
        className="group/ml grid h-7 w-7 place-items-center rounded-md text-stone-600 opacity-50 outline-none transition-[opacity,color] duration-150 hover:text-ink hover:opacity-100 focus-visible:text-ink focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus group-hover/row:text-ink group-hover/row:opacity-100 group-focus-within/row:opacity-100">
        <ArrowRight size={15} aria-hidden className="transition-transform duration-150 ease-out group-hover/row:translate-x-[2px] group-hover/ml:translate-x-[2px] group-focus-visible/ml:translate-x-[2px] motion-reduce:transition-none motion-reduce:!translate-x-0" />
      </button>
    </EdgeTip>
  )
}
// an All pages row: favicon | title (and "New") | domain ↗ | engines | tone; a hover card with its quote
// Positive / Negative: optional one-line why under the title (owner, 2026-11-10)
function AllPageRow({ p, change, style, onMissed = null }) {
  const missedTone = !change?.gone && ['neutral', 'mixed'].includes(change?.tone ?? p.tone)
  const href = pageHref(p)
  const peek = usePeek()
  const why = pageWhyLine(p)
  return (
      <li data-row="page" data-key={p.id} {...peek.row} className={`group/row ${ALL_GRID} ${why ? 'min-h-[72px] py-2.5 items-start' : 'h-[52px]'} border-b border-[var(--div)] transition-colors duration-150 hover:bg-[var(--row-hover)]`} style={style}>
        <PagePeek peek={peek} p={p} />
        <span className={why ? 'mt-0.5' : undefined}><Fav domain={p.domain} /></span>
        <span className="min-w-0">
          <TitleCell change={change} competitor={p.onCompetitorSite}>
            <button type="button" onClick={() => openDrawer('page', p.id)} aria-label={p.title} data-title
              className={`min-w-0 rounded text-left outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-focus ${ROW_TITLE}`}>{p.title}</button>
          </TitleCell>
          {why && <p data-why className={`mt-0.5 truncate ${SECOND}`} title={why}>{why}</p>}
        </span>
        <span data-domain className={`min-w-0 truncate ${SECOND} max-md:hidden ${why ? 'mt-0.5' : ''}`}>
                {href
                  ? <a href={href} {...LINK} className="rounded outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">{p.domain} <ArrowUpRight size={12} className="inline" aria-hidden /><span className="sr-only">(opens in a new tab)</span></a>
                  : <span title="No link stored for this page">{p.domain}</span>}
              </span>
        <span className={`flex max-md:hidden ${why ? 'mt-0.5' : ''}`}><EngineMarks ids={p.engines} size={14} /></span>
        <span className={`-mr-1.5 flex items-center justify-end gap-1 ${why ? '-mt-0.5' : ''}`}>
          <ToneCell p={p} change={change} />
          {missedTone && onMissed ? <MissedLink onOpen={() => onMissed(p.id)} /> : <span aria-hidden className="h-7 w-7 shrink-0" />}
        </span>
            </li>
          )
}

function AllPages({ pages, lit, filtered, changeOf = () => null, engine = 'all', brandKey = '', onMissed = null }) {
  const [all, setAll] = useState(false)
  const sectionRef = useRef(null)
  const [order, setOrder] = useState({ key: 'tone', flip: false })
  useEffect(() => { setOrder(readSort(brandKey)) }, [brandKey]) // after mount: the server render keeps the default
  const sort = order.key
  const pickSort = (key) => setOrder((o) => {
    const next = key === o.key ? { key, flip: !o.flip } : { key, flip: false }
    try { window.localStorage.setItem(sortStoreKey(brandKey), JSON.stringify(next)) } catch { /* not kept */ }
    return next
  })
  // app (owner, 2026-11-14): the order in words inside the active option ("Tone · Negative first ↓", flipped "Tone ·
  // Positive first ↑"); the others show their name only; the active option's tooltip says a click reverses it
  const sortOptions = SORTS.map((o) => (o.value === sort
    ? { ...o, label: (
      <EdgeTip tip="Click to reverse the order" focusable={false} className="inline-flex items-center gap-1" data-sort-active>
        {o.label}<span aria-hidden className="font-normal opacity-70">·</span>{SORT_WORDS[sort][order.flip ? 1 : 0]}
        {order.flip ? <ArrowUp size={12} strokeWidth={2.25} aria-hidden /> : <ArrowDown size={12} strokeWidth={2.25} aria-hidden />}
      </EdgeTip>
    ) }
    : o))
  // the options shift to their new places (200ms) when the active one grows or shrinks
  const segBox = useRef(null)
  const segLefts = useRef(null)
  useLayoutEffect(() => {
    const bs = [...(segBox.current?.querySelectorAll('[role=radio]') ?? [])]
    const now = bs.map((b) => b.offsetLeft)
    if (segLefts.current && !reduced()) bs.forEach((b, k) => { const d = (segLefts.current[k] ?? now[k]) - now[k]; if (Math.abs(d) > 0.5) b.animate([{ transform: `translateX(${d}px)` }, { transform: 'none' }], { duration: 200, easing: EASE_OUT }) })
    segLefts.current = now
  }, [sort, order.flip])
  const [opened, setOpened] = useState(0) // replays the rows' fade each time "Show all" opens
  // the sort pills (lib/sentiment-sections sortAllPages): Tone, Title (A–Z, natural) or Engines (most first)
  const sorted = sortAllPages(pages.filter((p) => lit.has(p.id)), sort)
  const rows = order.flip ? flipSorted(sorted, sort) : sorted
  const still = typeof window !== 'undefined' && reduced()
  const fade = useEngineFade(engine)
  const row = (p, i = null) => <AllPageRow key={p.id} p={p} change={changeOf(p)} onMissed={onMissed} style={i != null && all && !still ? { animation: `fade-in 200ms ${EASE_OUT} ${i * 20}ms both` } : undefined} />
  // the sort and the filters reorder the rows in place (FLIP, 240ms)
  const firstRef = useRef(null)
  const restRef = useRef(null)
  useFlip(firstRef, rows.slice(0, FIRST).map((p) => p.id), { move: 240 })
  useFlip(restRef, all ? rows.slice(FIRST).map((p) => p.id) : [], { move: 240 })
  return (
    <section ref={sectionRef} aria-labelledby="pages-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="pages-h" className={h2}>{filtered ? 'Pages that match' : 'All pages'}</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className={`text-[13px] leading-[18px] font-medium ${t2}`} aria-hidden>Sort by</span>
          <span ref={segBox} className="inline-flex"><Seg label={`Sort pages: ${SORT_LINE[sort][order.flip ? 1 : 0]}`} value={sort} onChange={pickSort} options={sortOptions} className={`${SEG} whitespace-nowrap`} /></span>
          <span data-sort-line aria-live="polite" className="sr-only">{SORT_LINE[sort][order.flip ? 1 : 0]}</span>
        </div>
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
      <section className="mt-5" aria-label="Quotes">
        <h3 className={DRAWER_H}>Quotes</h3>
        {quotes.length > 0 ? (
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
        ) : (
          // AUD-023: "Open its quotes" must not imply evidence when none was captured
          <p className={`mt-2 text-[14px] leading-5 ${t3}`}>No supporting quote was captured for this page. Tone and sync history below are still from this snapshot.</p>
        )}
      </section>
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
