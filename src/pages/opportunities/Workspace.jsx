// Opportunities → Content: one prompt's workspace (/opportunities/content/<id>), built on the Sentiment page's shell
// (pages/insights/SentimentPage.jsx): one spacing system, 48px between sections (round 4), each with a clear header over a
// --line-strong rule. (A hero band and a Top queries list were designed, then removed by the owner, 2026-11-04.)
//   1. the 64px sticky header row: Back to list · the prompt (morphs from the list row) · Missed on n of 4 (the missed
//      engines, in full colour) · Named instead (logos, max 3, then +n)
//   2. the step band, 24px under the header: the payoff bar as its header (workspace/PayoffBar.jsx: the step progress,
//      the reward for finishing the step, its one action; workspace/ActionDock.jsx keeps that action on screen when the
//      bar scrolls away), then two columns (7/12 the step, 5/12 Search Console for the target page,
//      or the page hovered); the draft (step 4) uses its own draft + checks columns at full width
//   3. Who you're up against (workspace/UpAgainst.jsx), like Sentiment's Sources
// Where it starts: workspace/flow.js startOf (no draft → step 1 until Search Console is connected, else step 2; a
// written draft → step 4; copied or published → step 5).
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import LogoStack from '../../components/dashboard/LogoStack'
import { t2, textBtn } from '../../components/firstSetup/ui'
import { useToast } from '../../components/dashboard/overlays'
import { CO_BRAND, ENGINES, ENGINE_NAME, gscConnection } from '../../data/contentOpportunities'
import { getAnswer } from '../../data/answers'
import { brandName, domainForName } from '../../utils/brand'
import { namedSummary, rankGrid } from './workspace/heroData'
import { missedPrompts } from '../../data/mock'
import { FACTS, QUESTIONS, UPLOADS, coStates, dataEmpty, NOW, candidatesFor, citedBy, draftFor, enginesCitingPage, genHold, genStepsFor, gscStatus, newPageFor, setDraftState, winningPageFor } from '../../data/contentOpportunities-proposed'
import { LOADING_LINES, LOADING_SWITCH_MS, RESPONSE_MS, SAMPLE_ROWS, backendFull, competitorName, contentRecommendFor, requestFor } from '../../data/contentRecommend'
import { SAMPLE_DATA, buildUserFacts, dataKey, fromStored, toStored, userDataSummary } from './data/userFacts'
import { copyPayloads, exportName, liveDataOf, pageOf, readinessOf, storageKey } from './draft/recommend'
import { download, writeClipboard } from './draft/clipboard'
import TargetV1 from './workspace/TargetV1'
import CopyPublish from './workspace/CopyPublish'
import { BRAND_PALETTE, BRAND_PALETTE_DARK, cssColor } from '../../utils/brandColors'
import { productName } from '../../store/workspace'
import DraftStep, { newSession, savedLabel } from './DraftStep'
import { fmtSecs, genElapsed, genProgress, genSummary } from './draft/model'
import PublishStep from './PublishStep'
import { Engines, LIST_PATH, OWN_DOMAIN, brandLabels, coBrandName, goTo, pathOf, promptVT, uniqueDomains } from './parts'
import ConnectStep from './workspace/ConnectStep'
import DataStep from './workspace/DataStep'
import SearchConsolePanel from './workspace/SearchConsolePanel'
import ActionDock from './workspace/ActionDock'
import PayoffBar from './workspace/PayoffBar'
import TargetStep from './workspace/TargetStep'
import UpAgainst from './workspace/UpAgainst'
import { STEPS, dataSummary, FOCUS_FROM, exitAfter, inFocus, nextVisible, resumeState, startExited, startOf, startTarget, stepValue, stepsFor } from './workspace/flow'
import FocusPanel from './workspace/FocusPanel'
import PanelHeader from './workspace/PanelHeader'
import { COL_HEAD, COL_TITLE } from './workspace/ui'

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const NO_GSC_REASON = 'Search Console isn’t connected, so we can’t see which of your pages ranks.'
const DATA = 2 // Your data's index
const DRAFT = 3 // step 4's index
const nf = new Intl.NumberFormat('en-US')
// step 5's sub-line: when the page was last looked for
const checkedLine = (at) => (!at ? 'not checked yet' : at.slice(0, 10) === NOW.slice(0, 10) ? 'checked today' : `checked ${new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`)
// this visit's progress per prompt (the step, the choices): reopening a prompt continues where it was
const PROGRESS = new Map()
// engines by their short names in sentences ("Google, Gemini and Claude")
const ENGINE_SHORT = { google: 'Google', chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude' }
const listOf = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
const SC_FIXED = 456 // the Search Console column without the gap above its stats (SearchConsolePanel)
const STEP_HEAD = ['Connect', 'Your pages', null, null, 'Your page'] // the left column's head per step (Your data has its own)

export default function Workspace({ id }) {
  // the Overview's missed prompt (same rows as the list), or a sample account's (e.g. rm-1, the live reverse-mortgage run)
  const row = missedPrompts.find((r) => r.id === id) ?? SAMPLE_ROWS.find((r) => r.id === id)
  useEffect(() => { document.title = `${row ? row.prompt : 'Prompt not found'} · Content · ${productName()}` }, [row])
  if (!row) return <NotFound />
  return <Flow key={id} row={row} />
}

function Flow({ row }) {
  // v1 (default): what content-recommend returns, plus Your data (read in the browser, sent as the request's proposed
  // userFacts); ?backend=full adds Search Console, Publish & track and the live writing view (they need backend work).
  // steps: the visible steps (v1: Target page → Your data → Draft → Copy & publish)
  const full = useMemo(() => backendFull(), [])
  const steps = useMemo(() => stepsFor(full), [full])
  const kept = PROGRESS.get(row.id) // this visit's progress on the prompt, if it was opened before
  // the userFacts sent with the draft request (v1): taken when the writing starts (and on Regenerate); null = none
  const [sent, setSent] = useState(() => kept?.sent ?? null)
  const request = useMemo(() => requestFor(row, sent), [row, sent]) // the (mock) request: userFacts only when non-empty
  const res = useMemo(() => contentRecommendFor(row, request.userFacts), [row, request]) // the route's response (the mock's)
  // the response before any userFacts: its flags are Your data's questions (they stay put once answered)
  const baseRes = useMemo(() => contentRecommendFor(row), [row])
  const competitors = row.competitors ?? [] // the request's competitors
  const page = useMemo(() => pageOf(res.pageRecommendation), [res])
  // the user's ticks and the last copy, in this browser only (the app's localStorage key)
  const store = storageKey(CO_BRAND.domain, row.prompt)
  const stored = useMemo(() => { try { return JSON.parse(window.localStorage.getItem(store) ?? 'null') ?? {} } catch { return {} } }, [store])
  const saved = useMemo(() => draftFor(row.id, row), [row])
  const [gsc, setGsc] = useState(() => kept?.gsc ?? gscStatus()) // 'connected' | 'declined' | 'new' | 'skipped' (continued without it)
  const start = useMemo(() => startOf(saved, gscStatus()), [saved])
  const [current, setCurrent] = useState(() => Math.max(kept?.current ?? 0, full ? start.current : Math.max(1, start.current)))
  const [editing, setEditing] = useState(null) // a done step reopened from the progress pills
  const [ready, setReady] = useState(() => kept?.ready ?? start.ready) // a draft exists: step 4 skips its generating view
  const [draft, setDraft] = useState(saved && saved.stage !== 'draft' ? saved : null) // what step 5 tracks

  // the prompt's own pages and queries (sample data keyed on the row)
  const allCandidates = useMemo(() => candidatesFor(row), [row])
  const suggested = useMemo(() => newPageFor(row), [row])
  const candidates = gsc === 'connected' ? allCandidates : []
  const newPage = gsc === 'connected' ? suggested : { ...suggested, reason: NO_GSC_REASON }
  const [target, setTarget] = useState(() => kept?.target ?? startTarget(saved, gscStatus() === 'connected' ? allCandidates : [], suggested, pathOf))
  // without Search Console there's nothing to pick from: the new page; once connected, the best match again
  useEffect(() => {
    if (saved) return
    if (gsc !== 'connected' && target.kind === 'page') setTarget({ kind: 'new', slug: newPage.slug })
  }, [gsc, target.kind, saved, newPage.slug])
  // the mock's OAuth round trip, started from the payoff bar's "Connect →"
  const [connecting, setConnecting] = useState(false)
  const connectTimer = useRef(null)
  useEffect(() => () => clearTimeout(connectTimer.current), [])
  const connect = () => { setConnecting(true); connectTimer.current = setTimeout(() => { setConnecting(false); onGsc('connected') }, 900) }
  const onGsc = (s) => {
    setGsc(s)
    if (s === 'connected' && !saved && allCandidates.length) setTarget({ kind: 'page', url: allCandidates[0].url })
  }

  // Your data. v1: kept in this browser per brand + prompt (data/userFacts.js dataKey: facts, answers, pasted text and the
  // read files' text, never the files), the questions from this response's flags; ?co=data-sample preloads the fixture.
  // ?backend=full: the proposal's sample (?co=data-empty: nothing added yet)
  const dataStore = dataKey(CO_BRAND.domain, row.prompt)
  const [data, setData] = useState(() => {
    if (kept?.data) return kept.data
    if (!full) {
      let s = null
      try { s = coStates().has('data-sample') ? SAMPLE_DATA : JSON.parse(window.localStorage.getItem(dataStore) ?? 'null') } catch { /* private mode */ }
      return fromStored(s, baseRes.flags)
    }
    return dataEmpty()
      ? { uploads: [], facts: [], questions: QUESTIONS.map((q) => ({ ...q, answer: '' })), pasted: '', dismissed: [] }
      : { uploads: UPLOADS, facts: FACTS, questions: QUESTIONS, pasted: '', dismissed: [] }
  })
  useEffect(() => {
    if (full) return
    const s = toStored(data)
    try {
      if (!s.facts.length && !s.answers.length && !s.pasted.trim() && !s.documents.length) window.localStorage.removeItem(dataStore)
      else window.localStorage.setItem(dataStore, JSON.stringify(s))
    } catch { /* private mode, or over the browser's quota: this visit only */ }
  }, [full, dataStore, data])
  // the ONE userFacts payload (v1) and the 20k cap's verdict (over, the file cut, files left out)
  const cap = useMemo(() => (full ? null : buildUserFacts(data)), [full, data])
  const [dataSkipped, setDataSkipped] = useState(() => kept?.dataSkipped ?? false)
  // step 4's state (the writing clock, the draft, its flags): here, not in DraftStep, so closing the focus panel loses
  // nothing and the writing goes on in the background (draft/model.js draftSession)
  const [ds, setDs] = useState(() => kept?.ds ?? newSession(start.ready, { savedAt: res.analyzedAt, ...stored }))
  useEffect(() => {
    try { window.localStorage.setItem(store, JSON.stringify({ ticked: ds.ticked, copiedAt: ds.copiedAt, savedAt: ds.savedAt })) } catch { /* private mode */ }
  }, [store, ds.ticked, ds.copiedAt, ds.savedAt])
  // keep the progress for this visit (reopening the prompt picks it up; the mock has no store)
  useEffect(() => { PROGRESS.set(row.id, { gsc, current, ready, target, data, dataSkipped, ds, sent }) })
  // the writing starts when step 4 is first reached
  useEffect(() => {
    if (current >= DRAFT && ds.phase === 'generating' && ds.startedAt == null) setDs((s) => ({ ...s, startedAt: performance.now() }))
  }, [current, ds.phase, ds.startedAt])
  // patch: an object, or (data) => object (a file read finishing after other changes)
  const updateData = (patch) => { setDataSkipped(false); setData((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) })) }

  const open = editing ?? current
  // focus mode: on whenever the open step is 3–5 (by any route), unless exited on that step (workspace/flow.js)
  const [exitedOn, setExitedOn] = useState(() => startExited(saved, open))
  const prevOpen = useRef(open)
  if (prevOpen.current !== open) { const was = prevOpen.current; prevOpen.current = open; if (exitAfter(was, open, exitedOn) !== exitedOn) setExitedOn(null) }
  const focus = inFocus(open, exitedOn)
  // opened on load (arriving on step 3–5 from the list or a reopened prompt): a fade, no travel; after that, the FLIP
  const [entrance, setEntrance] = useState(() => (inFocus(open, startExited(saved, open)) ? 'fade' : 'travel'))
  const exitFocus = () => setExitedOn(open)
  // while the checklist isn't on screen (the panel is closed or on another step), the workspace keeps the writing's
  // clock: it ticks the resume row (200ms) and finishes the draft when the time is up
  // the answers' order per engine (data/answers.js), for "Named" in Who you're up against
  const grid = useMemo(() => rankGrid(row, { engines: ENGINES, own: OWN_DOMAIN, ownName: CO_BRAND.name, getAnswer, domainOf: domainForName }), [row])
  // what the behind-flag live writing view works through, from the same response (so it never shows another prompt's
  // content): draft/recommend.js R14
  const liveData = useMemo(() => liveDataOf(res, competitors, competitorName), [res]) // eslint-disable-line react-hooks/exhaustive-deps
  const genSteps = useMemo(() => genStepsFor(liveData), [liveData])
  const genShown = focus && open === DRAFT
  const writing = ds.phase === 'generating' && ds.startedAt != null
  // v1: the request goes out as the writing starts (and on each Regenerate): it carries Your data as it is then
  useEffect(() => {
    if (writing && !full) setSent(cap.userFacts)
  }, [writing, ds.run]) // eslint-disable-line react-hooks/exhaustive-deps
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!writing) return undefined
    setNow(performance.now())
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [writing])
  const genE = genElapsed(ds.startedAt, now, { hold: genHold(genSteps), instant: reduced() })
  const gen = genProgress(genSteps, genE, ds.failAt)
  // the draft arrives: v1, when the (mock) response does (RESPONSE_MS); behind the flag, when the live view's steps end
  // (its own view finishes it while it's on screen)
  const arrived = full ? gen.done : genE >= RESPONSE_MS
  useEffect(() => {
    if (writing && arrived && !(full && genShown)) setDs((s) => ({ ...s, phase: 'draft', summary: full ? genSummary(genSteps) : null }))
  }, [writing, genShown, arrived]) // eslint-disable-line react-hooks/exhaustive-deps
  const focusScroller = useRef(null)
  const panel = useRef(null)
  const first = useRef(true)
  // a newly opened step (the bar's or the dock's button): bring the step band's top into view, under the header
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (focus) { focusScroller.current?.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); return }
    const el = panel.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - 88
    if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top), behavior: reduced() ? 'auto' : 'smooth' })
  }, [open])

  // Continue: a reopened step closes; the current one hands over to the next
  const next = () => { if (editing != null) setEditing(null); else setCurrent((c) => nextVisible(steps, c)) }
  const pick = (i) => setEditing(i === current ? null : i)
  // Skip to draft (step 2): past "Add your own data", straight to step 4
  const skipToDraft = () => { setDataSkipped(true); setEditing(null); setCurrent((c) => Math.max(c, DRAFT)) }

  const review = readinessOf(res.flags, res.reviewScore, ds.ticked)
  // the bar's sub-line wherever the flags matter: flags checked of all (never the weighted points: those are the
  // readiness ⓘ's, in the Draft rail)
  const flagsChecked = `${res.flags.length - review.open} of ${res.flags.length} ${res.flags.length === 1 ? 'flag' : 'flags'} checked`
  // the Target page's draft preview (TargetV1): a draft exists once the session has one (ds.phase 'draft': written in
  // this visit, or saved, draftFor); "Open draft" goes to the Draft step in focus (Resume when it's the open step)
  const openDraft = () => { if (open === DRAFT) setExitedOn(null); else setEditing(current === DRAFT ? null : DRAFT) }
  // v1's Your data in one line ("2 files · 1 fact · 1 of 3 answered"), null when nothing's added
  const dataLine = full ? null : userDataSummary(data)?.replace(/^./, (c) => c.toUpperCase()) ?? null
  const values = full
    ? STEPS.map((_, i) => stepValue(i, { gsc, gscDomain: gscConnection.domain, target: target.kind === 'new' ? target : { ...target, path: pathOf(target.url) }, data, dataSkipped, draft }))
    : [null, page.path, dataLine ?? 'Skipped', ds.phase === 'draft' ? `${review.open} ${review.open === 1 ? 'flag' : 'flags'} open` : null, ds.copiedAt ? 'Copied' : null]
  // v1, Your data after a draft exists: changed since the request went out → "Rewrite the draft" (a Regenerate with
  // the new userFacts); a file still being read holds the button (its text would miss the request)
  const draftExists = ds.phase === 'draft' || writing
  const dataChanged = !full && draftExists && JSON.stringify(cap.userFacts) !== JSON.stringify(sent ?? { facts: [], answers: [], documentsText: '' })
  const stillReading = !full && data.uploads.some((u) => u.status === 'reading')
  const rewrite = () => {
    setDs((s) => ({ ...s, phase: 'generating', run: s.run + 1, startedAt: performance.now(), summary: null, failAt: -1, copiedAt: null }))
    if (current > DRAFT) setEditing(DRAFT)
    else { setEditing(null); setCurrent(DRAFT) }
  }

  const [toastNode, toast] = useToast({ position: 'center' })
  // the page the draft goes on: the picked page, or the new page's address on the brand's site
  const targetUrl = full ? (target.kind === 'new' ? `https://${CO_BRAND.domain}${target.slug}` : target.url) : page.url
  // the draft's three actions (the footer and the Copy & publish step share them): draft/recommend.js R3
  const payloads = useMemo(() => copyPayloads(res.contentMarkdown, competitors), [res]) // eslint-disable-line react-hooks/exhaustive-deps
  // R20's 'ai' tag: the tracked engines whose answers cite that host (the prompt's sources), else unspecified
  const resolveAi = (h) => { const src = (row.sources ?? []).find((x) => x.domain === h); return src ? citedBy(row, src) : null }
  const blocked = () => toast('Couldn’t copy: the browser blocked the clipboard')
  // advanceAfter: the draft footer shows "Copied ✓" for 2s, then the bar moves to step 3 · → true when it copied
  const copyContent = async ({ advanceAfter = 0 } = {}) => {
    try { await writeClipboard(payloads.markdown) } catch { blocked(); return false }
    setDs((s) => ({ ...s, copiedAt: new Date().toISOString(), savedAt: new Date().toISOString() }))
    if (advanceAfter) setTimeout(copied, advanceAfter)
    else copied()
    return true
  }
  const copyHtml = async () => {
    try { await writeClipboard(payloads.plain, payloads.html); toast('HTML copied') } catch { blocked() }
  }
  // Re-check score: the app's recheckScore, in the browser: the ticks re-scored (applyRecommendations), saved, a toast
  const recheck = () => { const r = readinessOf(res.flags, res.reviewScore, ds.ticked); setDs((s) => ({ ...s, savedAt: new Date().toISOString() })); toast(`Score ${r.done} / ${r.total}`) }
  const exportMd = () => { const name = exportName(row.prompt); download(name, payloads.exportMd); toast(`${name} downloaded`) }
  const copied = () => {
    setReady(true)
    setDraft((d) => (d && d.stage !== 'waiting' ? d : { ...(saved ?? {}), target_url: targetUrl, stage: 'waiting' }))
    // the list and a reopened prompt see it as copied ("Waiting to publish")
    if (!saved || saved.stage === 'draft') setDraftState(row.id, { stage: 'waiting', action: target.kind === 'new' ? 'create' : 'update', target_url: targetUrl, copied_at: NOW })
    toast('Content copied')
    setEditing(null); setCurrent((c) => Math.max(c, 4))
  }
  const body = (i) => [
    <ConnectStep status={gsc} property={gscConnection.siteUrl} onStatus={onGsc} connecting={connecting} />,
    full
      ? <TargetStep candidates={candidates} newPage={newPage} target={target} onTarget={setTarget} onPreview={setPreviewUrl} citing={(url, rank) => enginesCitingPage(row, url, rank)} />
      : <TargetV1 res={res} named={named} resolve={resolveAi}
        draft={ds.phase === 'draft' ? { open: review.open, onOpen: openDraft } : null}
        write={current < DATA ? { label: 'Add your data', onClick: advance } : current < DRAFT ? { label: 'Write the draft', onClick: advance } : writing ? { label: 'Resume', onClick: openDraft } : null} />,
    <div data-step="data"><DataStep data={data} update={updateData} v1={!full} cap={cap} /></div>,
    <div data-step="draft"><DraftStep res={res} competitors={competitors} session={ds} setSession={setDs} full={full} steps={genSteps} live={liveData} onCopy={copyContent} onCopyHtml={copyHtml} onExport={exportMd} onRecheck={recheck} savedAt={ds.savedAt} resolve={resolveAi} inPanel={focus} /></div>,
    full
      ? <div data-step="publish"><PublishStep row={row} draft={draft ?? { stage: 'waiting', target_url: targetUrl }} onEditDraft={() => { setReady(true); setEditing(DRAFT) }} onApi={setPublishApi} /></div>
      : <div data-step="publish"><CopyPublish res={res} ticked={ds.ticked} copiedAt={ds.copiedAt} onCopyHtml={copyHtml} onExport={exportMd} onBack={() => setEditing(DRAFT)} /></div>,
  ][i]

  // the right column: Search Console for the page hovered in Your pages (a preview), else the target page (the selected
  // candidate), a new page, or not connected
  const [previewUrl, setPreviewUrl] = useState(null)
  // Search Console's axes over ALL the prompt's pages (they stay put while previewing), and the space above its stats so
  // they sit level with the list's last row: the list is the column head (44) + its header row (4 + 32) + 56px rows
  // with 2px between them; the Search Console column's fixed parts add up to 456px. Fewer rows than that: the list
  // doesn't stretch and the stats keep an 8px gap (the right column ends a little lower).
  const scale = useMemo(() => {
    const weeks = allCandidates.flatMap((c) => c.weeks)
    return weeks.length ? { impressions: Math.max(...weeks.map((w) => w.impressions)), posMin: Math.min(...weeks.map((w) => w.position)), posMax: Math.max(...weeks.map((w) => w.position)) } : null
  }, [allCandidates])
  const listRows = candidates.length + 1
  const statsGap = Math.max(8, 44 + 4 + 32 + listRows * 56 + listRows * 2 - SC_FIXED)
  const shownUrl = (open === 1 && previewUrl) || (target.kind === 'page' ? target.url : null)
  const picked = shownUrl ? allCandidates.find((c) => c.url === shownUrl) : null
  const preview = Boolean(open === 1 && previewUrl && previewUrl !== target.url)
  const sc = gsc !== 'connected'
    ? <SearchConsolePanel mode="off" />
    : picked ? <SearchConsolePanel mode="page" page={picked} preview={preview} scale={scale} statsGap={statsGap} />
      : <SearchConsolePanel mode="new" slug={target.kind === 'new' ? target.slug : newPage.slug} />

  // ---- the payoff bar (and the dock): the reward for finishing this step, built from the data; its one action ----
  const [publishApi, setPublishApi] = useState(null) // PublishStep: { phase, checking, check }
  const missedEngines = ENGINES.filter((e) => row.platforms.includes(e))
  const names = (es) => listOf(es.map((e) => ENGINE_SHORT[e]))
  const moreEngines = `${missedEngines.length} more ${missedEngines.length === 1 ? 'engine' : 'engines'}`
  const selected = target.kind === 'page' ? allCandidates.find((c) => c.url === target.url) : null
  const targetPath = full ? (target.kind === 'page' ? pathOf(target.url) : target.slug) : page.path
  const win = winningPageFor(row)
  const winName = win ? `${brandLabels[win.domain] ?? brandName(win.domain)}’s ${win.formats[0] ?? 'page'}` : null
  const topWinner = [...page.evidence].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))[0] ?? null
  const advance = () => next()
  const BAR = [
    {
      headline: 'Connect Search Console to find the page that’s closest to winning',
      line: gsc === 'connected' ? `Connected · ${gscConnection.domain}` : connecting ? 'Connecting…' : 'Read-only · asked once per brand',
      choice: gsc === 'connected' ? gscConnection.domain : 'Search Console',
      action: gsc === 'connected' ? { label: 'Find the page', onClick: advance } : { label: 'Connect', onClick: connect, disabled: connecting, why: 'Connecting to Google…' },
      secondary: gsc === 'connected' || connecting ? null : { label: 'Not now', onClick: () => { onGsc('skipped'); next() } },
    },
    !full ? {
      // v1: the route's page choice (pageRecommendation)
      headline: page.action === 'update' ? `Update this page to get named on ${moreEngines}` : `Create this page to get named on ${moreEngines}`,
      line: `${page.path} · ${page.evidence.length} ${page.evidence.length === 1 ? 'page wins' : 'pages win'} this prompt today`,
      choice: page.path,
      // next: Your data (optional), or straight to the draft; reopened later: Continue
      action: { label: current === 1 ? 'Add your data' : 'Continue', onClick: advance },
      secondary: current === 1 ? { label: 'Skip to draft', onClick: skipToDraft } : null,
    } : {
      headline: target.kind === 'page' ? `Update this page to get named on ${moreEngines}` : `Publish a new page to get named on ${moreEngines}`,
      line: selected ? `${pathOf(selected.url)} · ${nf.format(selected.impressions)} impressions${selected.bestMatch ? ' · best match' : ''}` : `${targetPath} · new page`,
      choice: targetPath,
      action: { label: target.kind === 'page' ? 'Use this page' : 'Use a new page', onClick: advance },
      secondary: { label: 'Skip to draft', onClick: skipToDraft },
    },
    !full ? {
      // v1: the page to beat is the best-ranked winner in the route's evidence (pageRecommendation.evidence)
      headline: topWinner ? `Add your data so the draft can beat ${topWinner.host}` : 'Add your data so the draft is the best answer',
      line: dataLine ?? 'Optional · nothing added yet',
      choice: dataLine ?? 'Your data',
      action: stillReading ? { label: dataChanged ? 'Rewrite the draft' : draftExists ? 'Continue' : 'Write the draft', disabled: true, why: 'Still reading your files…' }
        : dataChanged ? { label: 'Rewrite the draft', onClick: rewrite }
          : { label: draftExists ? 'Continue' : 'Write the draft', onClick: advance },
      secondary: { label: 'Skip', onClick: () => { setDataSkipped(true); next() } },
    } : {
      headline: winName ? `Add your data so the draft can beat ${winName}` : 'Add your data so the draft is the best answer',
      line: (!dataSkipped && dataSummary(data)?.replace(/^./, (c) => c.toUpperCase())) || 'Optional · nothing added yet',
      choice: (!dataSkipped && dataSummary(data)) || 'Your data',
      action: { label: 'Write the draft', onClick: advance },
      secondary: { label: 'Skip', onClick: () => { setDataSkipped(true); next() } },
    },
    // the Draft: its one primary (Copy content) is the draft's footer, so the header has no button here
    ds.phase === 'draft'
      ? {
        headline: review.open ? `Resolve ${review.open} ${review.open === 1 ? 'flag' : 'flags'}, then copy it to your site` : 'Every flag is ticked: copy it to your site',
        line: `${flagsChecked} · saved in this browser`,
        choice: `${review.open} flags open`,
        action: null,
      }
      : full
        ? { headline: 'Writing the draft for this prompt', line: ds.startedAt == null ? 'Starting…' : `${fmtSecs(Math.min(genE, gen.totalMs))} · ${gen.done ? 'Finishing' : genSteps[Math.max(0, gen.rows.findIndex((r) => r.status !== 'done'))]?.label}`, choice: 'Writing the draft', action: null }
        : { headline: 'Writing your draft…', line: 'Usually under a minute; you can leave this panel and come back', choice: 'Writing your draft', action: null },
    !full ? {
      // v1: the copy / export moment (the route has no publish check yet)
      headline: page.action === 'update' ? `Paste it into ${page.path}` : `Publish it at ${page.path}`,
      line: ds.copiedAt ? `Copied ${savedLabel(ds.copiedAt)} · saved in this browser` : 'Not copied yet · saved in this browser',
      choice: page.path,
      action: { label: 'Copy content', onClick: copyContent },
    } :
    publishApi?.phase === 'tracking'
      ? { headline: `Tracking ${names(missedEngines)} each sync`, line: `${targetPath} · week ${Math.max(1, draft?.week ?? 1)} of 4`, choice: targetPath, action: null }
      : {
        headline: `Publish to start tracking ${names(missedEngines)}`,
        line: `Waiting for ${targetPath} · ${checkedLine(draft?.published_checked_at)}`,
        choice: targetPath,
        action: { label: 'I’ve published it', onClick: () => publishApi?.check(), disabled: !publishApi || publishApi.checking, why: publishApi?.checking ? 'Checking your page…' : 'Copy the draft to your site first' },
      },
  ]
  // the bar's one stakes block: the engines that name the brand now (the rest are the missed ones)
  const named = ENGINES.filter((e) => !row.platforms.includes(e))
  // two things, kept apart: where the flow is (open: steps 1–5) and whether the focus panel is up (focus). The page's
  // layout never follows the flow past step 2: it shows step 1, else step 2's layout; steps 3–5 live only in the panel.
  // Only the page bar's content follows the flow: for steps 3–5, what they're doing (live) and Resume.
  const onPage = open < FOCUS_FROM
  const pageOpen = full && open === 0 ? 0 : 1
  const live = full
    ? resumeState({ open, phase: ds.phase, gen, flags: res.flags.map((f) => ({ resolved: ds.ticked.includes(f.id) })), data, dataSkipped, stage: draft?.stage, week: draft?.week, path: targetPath, steps: genSteps })
    : open === DATA
      ? { headline: 'Adding your data', line: dataLine ?? 'Nothing added yet · everything is optional', busy: false }
      : open === DRAFT
      ? ds.phase === 'generating'
        ? { headline: 'Writing your draft…', line: LOADING_LINES[genE >= LOADING_SWITCH_MS ? 1 : 0], busy: true }
        : { headline: review.open ? `Draft ready · ${review.open} ${review.open === 1 ? 'flag' : 'flags'} to resolve` : 'Draft ready to copy', line: flagsChecked, busy: false }
      : { headline: ds.copiedAt ? 'Copied · ready to publish' : 'Ready to copy & publish', line: page.path, busy: false }
  const bar = onPage ? BAR[open] : { ...live, choice: live.headline, action: { label: 'Resume', onClick: () => setExitedOn(null) }, secondary: null }
  const focusBar = BAR[open]
  // the dock: shown while the bar is out of view above (it scrolled past)
  const barRef = useRef(null)
  const [dock, setDock] = useState(false)
  useEffect(() => {
    const el = barRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(([e]) => setDock(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const showDock = dock && Boolean(bar.action) && !focus
  useEffect(() => { if (!focus) setEntrance('travel') }, [focus])
  // step 5 done (the page is found live): tracking starts, the list says so, focus mode ends
  useEffect(() => {
    if (publishApi?.phase !== 'tracking' || !draft || draft.stage !== 'waiting') return
    setDraftState(row.id, { stage: 'monitoring', week: 0, published_at: NOW })
    setDraft((d) => ({ ...d, stage: 'monitoring', week: 0 }))
    setExitedOn(4)
  }, [publishApi?.phase]) // eslint-disable-line react-hooks/exhaustive-deps
  const palette = {
    '--co-a': cssColor({ light: BRAND_PALETTE[0], dark: BRAND_PALETTE_DARK[0] }),
  }

  return (
    // one spacing system: each section with a clear header over a --line-strong rule, 48px apart; the header row is
    // the page's summary and the payoff bar sits 24px under it (the header stays a direct child so it stays sticky)
    <div className="co-ws flex flex-col" style={palette}>
      <Header row={row} />
      <section ref={panel} aria-labelledby="co-step-h" tabIndex={-1} className="mt-6 scroll-mt-24 outline-none">
        {/* the payoff bar: the step's reward, its progress and its one action; while steps 3–5 are under way (they live
            only in the focus panel), what they're doing, live, and Resume */}
        <PayoffBar barRef={barRef} current={current} open={open} values={values} onPick={pick} headingId="co-step-h"
          headline={bar.headline} line={bar.line} busy={bar.busy} engines={ENGINES} named={named} engineName={(e) => ENGINE_NAME[e]}
          action={bar.action} secondary={bar.secondary} onClose={editing != null && onPage ? () => setEditing(null) : null} steps={steps} />
        {/* the page's step: step 1 (Search Console), else always step 2's layout, whatever the flow's step: the step (7/12),
            Search Console (5/12), 32px apart with a 1px line between */}
        {full ? (
          <div key={pageOpen} className="mt-6 grid grid-cols-1 gap-y-10 motion-safe:animate-[fade-in_200ms_ease-out] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div className="min-w-0 lg:pr-4">
              {STEP_HEAD[pageOpen] && (
                <div className={COL_HEAD}>
                  <h3 className={COL_TITLE}>{STEP_HEAD[pageOpen]}{pageOpen === 1 && candidates.length > 0 && <span className="tabular-nums text-stone-500">{candidates.length}</span>}</h3>
                </div>
              )}
              <div className={pageOpen === 1 ? '' : 'pt-4'}>{body(pageOpen)}</div>
            </div>
            <div className="min-w-0 lg:border-l lg:border-line lg:pl-4">{sc}</div>
          </div>
        ) : <div className="mt-6 motion-safe:animate-[fade-in_200ms_ease-out]">{body(1)}</div>}
      </section>

      {/* Who you're up against: only with ?backend=full (in v1 the Target step's ladder and matrix show the same pages) */}
      {full && <div className="mt-12"><UpAgainst row={row} named={(d) => namedSummary(grid, d, (e) => ENGINE_NAME[e])} /></div>}
      {/* while the dock shows, room under the page so it never covers the last row */}
      <div aria-hidden className="transition-[height] duration-200 ease-out print:hidden" style={{ height: showDock ? 88 : 0 }} />
      <ActionDock show={showDock} open={open} choice={bar.choice} action={bar.action} secondary={bar.secondary} />

      {/* focus mode: steps 3–5 in a centred panel over the blurred, dimmed page (workspace/FocusPanel.jsx) */}
      <FocusPanel active={focus} width={open === DRAFT ? 1200 : 880} fromRef={panel} labelledBy="co-focus-title" onExit={exitFocus} style={palette}
        scrollerRef={focusScroller} entrance={entrance}>
        {/* one header (sticky in the panel): progress · prompt · page · Exit, then the step's headline and its button */}
        <PanelHeader current={current} open={open} values={values} onPick={pick} prompt={row.prompt} path={targetPath} titleId="co-focus-title" headingId="co-focus-step-h"
          headline={focusBar.headline} line={focusBar.line} action={focusBar.action} secondary={focusBar.secondary}
          onClose={editing != null ? () => setEditing(null) : null} onExit={exitFocus} steps={steps} />
        <div key={open} className="co-slide-in min-w-0 px-6 pb-8 pt-6 max-md:px-4">{focus ? body(open) : null}</div>
      </FocusPanel>
      {toastNode}
    </div>
  )
}

// the sticky header, one 64px row: Back to list · the prompt (18/600, morphs from the list row) · "Missed on n of 4"
// with the missed engines in full colour · the brands named instead
function Header({ row }) {
  const missed = row.platforms.length
  const named = uniqueDomains(row.competitors, [OWN_DOMAIN])
  return (
    <header data-sticky-header className="sticky top-14 z-30 -mx-4 border-b border-[var(--div)] bg-page px-4 md:-mx-6 md:px-6 lg:top-0 lg:-mt-8">
      <div className="flex min-h-16 flex-wrap items-center gap-x-5 gap-y-2 py-2 lg:h-16 lg:flex-nowrap lg:py-0">
        <button type="button" onClick={() => goTo(LIST_PATH)} className={`${textBtn} -ml-0.5`}><ArrowLeft size={14} aria-hidden />Back to list</button>
        <span className="h-5 w-px shrink-0 bg-line max-lg:hidden" aria-hidden />
        <h1 style={promptVT(row.id)} title={row.prompt} className="min-w-0 flex-1 truncate text-[18px] leading-6 font-semibold tracking-[-0.01em] text-stone-900 max-lg:order-last max-lg:basis-full">{row.prompt}</h1>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-[13px] leading-[18px] text-stone-600 tabular-nums">Missed on {missed} of {ENGINES.length}</span>
          {/* the missed engines themselves, in full colour (they're the point of the label) */}
          <Engines ids={ENGINES.filter((e) => row.platforms.includes(e))} engineName={(e) => ENGINE_NAME[e]} size={18} none="None" />
        </div>
        <span className="h-5 w-px shrink-0 bg-line max-sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-[13px] leading-[18px] text-stone-600">Named instead</span>
          <LogoStack domains={named} max={3} labels={brandLabels} empty={<span className="text-[13px] leading-[18px] text-stone-500">No brand</span>} />
        </div>
      </div>
    </header>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3 pt-2">
      <button type="button" onClick={() => goTo(LIST_PATH)} className={textBtn}><ArrowLeft size={14} aria-hidden />Back to list</button>
      <h1 className="text-[22px] leading-7 font-semibold text-stone-900">This prompt isn’t in your list</h1>
      <p className={`text-[14px] leading-5 ${t2}`}>It may have been removed, or AI engines name you for it now.</p>
    </div>
  )
}

