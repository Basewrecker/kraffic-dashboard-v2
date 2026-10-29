import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowDown, ArrowUp, CalendarClock, Check, Copy, Crosshair, Download, HelpCircle, Link2, Loader2, Minimize2, MoreHorizontal, Plus, Printer, UserRound, X } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Segmented from '../../components/dashboard/Segmented'
import Switch from '../../components/ui/Switch'
import ActionMenu from '../../components/audit/ActionMenu'
import { useToast } from '../../components/dashboard/overlays'
import { linkClick, navigate } from '../../router'
import { addReport, buildReport, optsLine, refine, refineSuggestions, reportById, stepsFor, updateReport } from '../../data/reports'
import PillComposer from './PillComposer'
import { pageFit } from '../../data/composer'
import { DotAssemble } from './DotField'
import { Block, Thumb, blockName, explainFor } from './blocks'
import { brandOf, fromQuery, inkBtn, lineBtn, t2, t3, toQuery } from './parts'

// Reports as a chat thread, ChatGPT-style. /reports is the empty state: a greeting and the box at the centre. Sending
// turns the page into a thread in one motion: the greeting fades up and out, the box glides to the bottom and docks
// there, the question appears as the user's bubble, and the reply streams in under it (the steps tick, the dots gather
// into the hero, then the report fades in block by block). The URL becomes /reports/<id> without a reload, and the
// report is kept in All reports. In the thread the box changes the report (refine): each change adds a bubble and a new
// version, and the earlier one folds into a compact card. /reports/<id> opens straight into the thread; New report goes
// back to the empty state with the motion reversed. Transform / opacity only; reduced motion: instant, plain fades.
// ?mock=generating (held on step 2) · failed · ?print=1 the A4 view · ?greet=1|2|3 · ?font=inter (preview only)

const STEP_MS = 850
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const FIXED = new Set(['hero', 'sources']) // the fixed bands: explain only
const FIRST_MOVABLE = 1 // after the hero band
const GREETINGS = { 1: 'What do you want to know?', 2: 'What should we look into today?', 3: 'What’s on your mind today?' }
const REFINE_ICONS = [Minimize2, Plus, Crosshair, UserRound]
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
// 01 What moved · 02 Where you stand · … · the last number is What to do (the hero band isn't numbered)
const numbers = (blocks) => { let n = 0; return blocks.map((b) => (['section', 'actions'].includes(b.type) ? ++n : null)) }
const sameOpts = (a, b) => ['brand', 'period', 'audience', 'length'].every((k) => a[k] === b[k]) && ['engines', 'compare'].every((k) => (a[k] ?? []).join() === (b[k] ?? []).join())

// a turn: the user's message (ask) and the reply — a report version (built from the report's question + options), or a
// note when the message isn't a change a report can make
let seq = 0
function makeTurn(ask, prompt, opts, { done = false, change = null } = {}) {
  const built = buildReport(opts, prompt)
  return { id: `t${++seq}`, ask, prompt, opts: built.opts ?? opts, built, blocks: built.ok ? built.blocks : [], status: !built.ok ? 'thin' : done ? 'done' : 'steps', step: 0, live: !done, change }
}
const noteTurn = (ask, note) => ({ id: `t${++seq}`, ask, note, status: 'note', live: true })

function initFor(rest) {
  if (rest === '') return { mode: 'empty', turns: [], ownId: null }
  if (rest === 'new' || rest === 'view') {
    const f = fromQuery()
    return { mode: 'thread', turns: [makeTurn(f.prompt, f.prompt, f.opts, { done: rest === 'view' })], ownId: null }
  }
  const saved = reportById(rest)
  if (!saved) return { mode: 'thread', turns: [], ownId: rest, missing: true }
  return { mode: 'thread', turns: [makeTurn(saved.prompt || saved.title, saved.prompt, saved.opts, { done: true })], ownId: rest }
}

export default function ReportThread({ rest }) {
  const q = new URLSearchParams(window.location.search)
  if (q.get('print') === '1') {
    const saved = rest !== 'new' && rest !== 'view' ? reportById(rest) : null
    const f = saved ? { prompt: saved.prompt, opts: saved.opts, title: saved.title } : { ...fromQuery(), title: null }
    return <PrintView prompt={f.prompt} opts={f.opts} title={f.title} />
  }
  return <Thread rest={rest} mock={q.get('mock')} greeting={GREETINGS[q.get('greet')] ?? GREETINGS[1]} inter={q.get('font') === 'inter'} />
}

function Thread({ rest, mock, greeting, inter }) {
  const init = useRef(null)
  if (!init.current) init.current = initFor(rest)
  const [mode, setMode] = useState(init.current.mode)
  const [turns, setTurns] = useState(init.current.turns)
  const [missing, setMissing] = useState(!!init.current.missing)
  const [prompt, setPrompt] = useState(rest === '' ? fromQuery().prompt : '')
  const [opts, setOpts] = useState(() => (init.current.turns.at(-1)?.opts ?? fromQuery().opts))
  const [open, setOpen] = useState({}) // an earlier version shown again
  const [explain, setExplain] = useState(null)
  const [scheduling, setScheduling] = useState(false)
  const [ghost, setGhost] = useState(null) // the greeting, fading up and out where it was
  const [greetIn, setGreetIn] = useState(false)
  const [showDown, setShowDown] = useState(false)
  const [dotsFor, setDotsFor] = useState(null) // the turn whose hero the dots are gathering into
  const [toastNode, toast] = useToast({ position: 'center' })
  const own = useRef(init.current.ownId)
  const modeRef = useRef(mode)
  modeRef.current = mode
  const timers = useRef({})
  const dock = useRef(null)
  const greetRef = useRef(null)
  const threadRef = useRef(null)
  const heroRef = useRef(null)
  const flipFrom = useRef(null)
  const pageRef = useRef(null)
  const scroller = useRef(null) // the thread's scroll area: the only thing on the page that scrolls
  const atEnd = useRef(true)
  const follow = useRef(true)
  const streaming = useRef(false)
  useInterFont(inter)

  const patch = (id, p) => setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...(typeof p === 'function' ? p(t) : p) } : t)))
  // writing: the steps tick off one by one, then the report streams in
  const run = (t) => {
    const steps = stepsFor(t.opts).length
    clearTimeout(timers.current[t.id])
    setDotsFor(t.id)
    const tick = (n) => {
      timers.current[t.id] = setTimeout(() => {
        if (mock === 'failed' && n === 2) { patch(t.id, { status: 'failed', step: 2 }); return }
        if (mock === 'generating' && n === 2) return
        if (n < steps) { patch(t.id, { step: n + 1 }); tick(n + 1); return }
        patch(t.id, { status: 'done' })
      }, n === steps ? 250 : STEP_MS)
    }
    patch(t.id, { status: 'steps', step: 0 })
    tick(0)
  }
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), [])
  // a turn that's still being written keeps the view following it; the dots fade under the finished report
  useEffect(() => {
    const live = turns.some((t) => t.status === 'steps')
    if (live) { streaming.current = true; return undefined }
    const t = setTimeout(() => { streaming.current = false; setDotsFor(null) }, 1800)
    return () => clearTimeout(t)
  }, [turns])

  // /reports/new?… (an older link): write it now, and give it its own address
  useEffect(() => {
    if (rest !== 'new') return
    const t = turns[0]
    if (!t?.built.ok) return
    own.current = addReport(t.prompt, t.opts)
    window.history.replaceState(null, '', `/reports/${own.current}`)
    window.dispatchEvent(new Event('app:navigate'))
    run(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // the address changed from outside: New report → back to the empty state (reversed); another report → open it
  useEffect(() => {
    if (rest === '' && modeRef.current === 'thread') {
      Object.values(timers.current).forEach(clearTimeout)
      flipFrom.current = reducedMotion() ? null : dock.current?.getBoundingClientRect() ?? null
      setGreetIn(!reducedMotion())
      setMode('empty'); setTurns([]); setMissing(false); setPrompt(''); setOpts(fromQuery('').opts); setOpen({}); own.current = null
    } else if (rest !== '' && rest !== 'new' && rest !== 'view' && rest !== own.current) {
      const n = initFor(rest)
      own.current = n.ownId
      setMode(n.mode); setTurns(n.turns); setMissing(!!n.missing); setOpts(n.turns.at(-1)?.opts ?? opts); setOpen({})
    }
  }, [rest]) // eslint-disable-line react-hooks/exhaustive-deps

  // a thread is a column exactly as tall as the visible viewport below the page's top: [scroll area] + [box]. The window
  // doesn't scroll (the document is the viewport's height, and overflow is off while the thread is open), so the box, outside
  // the scroll area, can't move when the report scrolls. Set on the element directly, before the glide below measures it;
  // the visible viewport shrinks with a phone's keyboard, and the page with it
  useLayoutEffect(() => {
    const page = pageRef.current
    if (mode !== 'thread' || !page) return undefined
    const root = document.documentElement
    const was = root.style.overflow
    root.style.overflow = 'hidden'
    window.scrollTo(0, 0)
    const main = page.closest('main')
    const fitPage = () => {
      const vv = window.visualViewport
      const { height, marginBottom } = pageFit(vv ? vv.height : window.innerHeight, page.getBoundingClientRect().top + window.scrollY, main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0)
      page.style.height = `${height}px`
      page.style.marginBottom = `${marginBottom}px`
      if (window.scrollY) window.scrollTo(0, 0)
    }
    fitPage()
    window.addEventListener('resize', fitPage)
    window.visualViewport?.addEventListener('resize', fitPage)
    return () => {
      root.style.overflow = was
      page.style.height = ''
      page.style.marginBottom = ''
      window.removeEventListener('resize', fitPage)
      window.visualViewport?.removeEventListener('resize', fitPage)
    }
  }, [mode])

  // the box's glide between the centre and the bottom (FLIP: measured before and after the change, transform only, with no
  // fill, so nothing is left on it when it ends; measuring mid-glide includes the current transform, so it can reverse halfway)
  useLayoutEffect(() => {
    const from = flipFrom.current
    flipFrom.current = null
    const el = dock.current
    if (!from || !el) return
    if (mode === 'empty') window.scrollTo(0, 0)
    el.getAnimations().forEach((a) => a.cancel())
    const to = el.getBoundingClientRect()
    const dx = from.left - to.left
    const dy = from.top - to.top
    if (Math.abs(dx) + Math.abs(dy) < 1) return
    const a = el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 400, easing: EASE, fill: 'none' })
    a.onfinish = () => a.cancel()
  }, [mode])

  // following the stream: down as it grows, unless you scroll up (then a ↓ button brings you back). All of it on the scroll area
  const toEnd = (smooth) => { const sc = scroller.current; if (sc) sc.scrollTo({ top: sc.scrollHeight, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' }) }
  useEffect(() => {
    const sc = scroller.current
    if (mode !== 'thread' || !sc) return undefined
    const onScroll = () => {
      const gap = sc.scrollHeight - sc.clientHeight - sc.scrollTop
      atEnd.current = gap < 4
      if (gap < 96) follow.current = true
      setShowDown(gap >= 96 && !follow.current)
    }
    const onWheel = (e) => { if (e.deltaY < 0) follow.current = false }
    const onTouch = () => { follow.current = false }
    const onKey = (e) => { if (['ArrowUp', 'PageUp', 'Home'].includes(e.key) && !e.target.closest?.('textarea,input,[role=menu],[role=listbox]')) follow.current = false }
    // the scrollbar: shown while scrolling or moving over the scroll area, hidden ~800ms after the last of either
    let sbTimer = 0
    const showBar = () => { sc.dataset.sb = 'on'; clearTimeout(sbTimer); sbTimer = setTimeout(() => { delete sc.dataset.sb }, 800) }
    sc.addEventListener('scroll', showBar, { passive: true })
    sc.addEventListener('pointerenter', showBar)
    sc.addEventListener('pointermove', showBar, { passive: true })
    sc.addEventListener('scroll', onScroll, { passive: true })
    sc.addEventListener('wheel', onWheel, { passive: true })
    sc.addEventListener('touchmove', onTouch, { passive: true })
    window.addEventListener('keydown', onKey)
    // the report grows (streaming) or the area shrinks (a taller box, the keyboard): stay at the end if following or there
    const ro = new ResizeObserver(() => { if ((follow.current && streaming.current) || atEnd.current) toEnd(follow.current && streaming.current) })
    ro.observe(sc)
    if (threadRef.current) ro.observe(threadRef.current)
    const id = setInterval(() => { if (follow.current && streaming.current && sc.scrollHeight - sc.clientHeight - sc.scrollTop > 4) toEnd(true) }, 250)
    return () => {
      sc.removeEventListener('scroll', onScroll); sc.removeEventListener('wheel', onWheel); sc.removeEventListener('touchmove', onTouch)
      sc.removeEventListener('scroll', showBar); sc.removeEventListener('pointerenter', showBar); sc.removeEventListener('pointermove', showBar); clearTimeout(sbTimer)
      window.removeEventListener('keydown', onKey); ro.disconnect(); clearInterval(id)
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps
  // the box's stop button: stop whatever is being written
  const stopAll = () => turns.filter((t) => t.status === 'steps').forEach((t) => { clearTimeout(timers.current[t.id]); patch(t.id, { status: 'cancelled' }) })
  const jumpDown = () => { follow.current = true; setShowDown(false); toEnd(true) }

  const latest = [...turns].reverse().find((t) => t.built?.ok)
  useEffect(() => { document.title = `${mode === 'empty' ? 'New report' : latest?.built.title ?? 'Report'} · Kraffic` }, [mode, latest?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = (final) => {
    const text = prompt.trim()
    if (!text) return
    follow.current = true
    if (mode === 'empty') {
      const t = makeTurn(text, text, final)
      if (!reducedMotion()) {
        const g = greetRef.current?.getBoundingClientRect()
        if (g) setGhost({ rect: { left: g.left, top: g.top, width: g.width }, text: greeting })
        flipFrom.current = dock.current?.getBoundingClientRect() ?? null
      }
      document.activeElement?.blur()
      setTurns([t]); setMode('thread'); setPrompt(''); setOpts(t.opts); setGreetIn(false)
      if (t.built.ok) {
        own.current = addReport(text, t.opts)
        window.history.pushState(null, '', `/reports/${own.current}`)
        window.dispatchEvent(new Event('app:navigate'))
        run(t)
      }
      return
    }
    // in the thread: a change to the latest report (the box's dropdowns count as part of the change)
    setPrompt('')
    if (!latest) return
    const r = refine(opts, text)
    const next = r?.opts ?? (sameOpts(opts, latest.opts) ? null : opts)
    if (!next) {
      setTurns((ts) => [...ts, noteTurn(text, 'That isn’t a change a report can make yet. It can change the length, the audience, the engines, the period or the competitors: try “Make it shorter” or one of the suggestions.')])
      return
    }
    const t = makeTurn(text, latest.prompt, next, { change: r?.change ?? 'Changed the options' })
    setTurns((ts) => [...ts, t])
    setOpts(t.opts)
    setOpen({})
    if (own.current) updateReport(own.current, t.opts)
    if (t.built.ok) run(t)
  }

  // block actions on a version: move, remove (with undo), explain
  const setBlocks = (id, blocks) => patch(id, { blocks })
  const move = (t, bid, dir) => {
    const bs = t.blocks
    const i = bs.findIndex((b) => b.id === bid)
    const j = i + dir
    if (j < FIRST_MOVABLE || j > bs.length - 2) return // the hero band stays first; sources last
    const n = [...bs];
    [n[i], n[j]] = [n[j], n[i]]
    setBlocks(t.id, n)
  }
  const remove = (t, bid) => {
    const before = t.blocks
    setBlocks(t.id, before.filter((b) => b.id !== bid))
    toast(`Removed “${blockName(before.find((b) => b.id === bid))}”`, { action: { label: 'Undo', onClick: () => setBlocks(t.id, before) } })
  }
  const shareUrl = () => `${window.location.origin}/reports/${own.current ?? ''}`
  const actionsFor = (t) => [
    { label: 'Download PDF', icon: Download, onClick: () => window.open(`/reports/view?${toQuery(t.opts, t.prompt)}&print=1`, '_blank', 'noopener') },
    { label: 'Copy link', icon: Link2, onClick: () => { try { navigator.clipboard?.writeText(shareUrl()) } catch { /* no clipboard: the toast still says what the link does */ } toast('Link copied. Anyone at PTA Agency with the link can open it.') } },
    { label: 'Schedule', icon: CalendarClock, onClick: () => setScheduling(true) },
    { label: 'Duplicate', icon: Copy, onClick: () => toast(`Duplicated as “${t.built.title} (copy)” in All reports`) },
  ]

  const versions = turns.filter((t) => t.built?.ok)
  const thread = mode === 'thread'
  const refineList = latest ? refineSuggestions(latest.opts.brand).map((text, i) => ({ id: `r${i}`, text, icon: REFINE_ICONS[i] })) : null
  return (
    <div ref={pageRef} style={inter ? { fontFamily: "'Inter', var(--font-sans)" } : undefined}
      className={`thread-motion relative flex w-full flex-col ${thread ? '' : 'min-h-[calc(100dvh-88px)] lg:min-h-[calc(100dvh-72px)]'}`}>
      {!thread && (
        <div key="hello" className="flex flex-1 flex-col items-center justify-end pb-6">
          <h1 ref={greetRef} className="text-center text-[24px] leading-[1.3] font-medium tracking-normal text-stone-900 md:text-[28px]"
            style={greetIn ? { animation: `greet-in 220ms ${EASE} 120ms both` } : undefined}>{greeting}</h1>
        </div>
      )}
      {/* a thread: [scroll area] + [box]. The scroll area (out to the page's edges, so the wheel works anywhere over it) holds
          the question, the report and its actions; a 48px fade at its bottom edge, and ↓ in its bottom corner */}
      {thread && (
        <div key="scroll" className="relative -mx-4 min-h-0 flex-1 md:-mx-6">
          <div ref={scroller} data-scroll className="thread-scroll h-full overflow-y-auto overscroll-contain px-4 md:px-6">
            <div ref={threadRef} className="mx-auto flex w-full max-w-[960px] flex-col gap-8 pb-12 pt-2">
              {missing && (
                <StateCard title="This report doesn’t exist any more">
                  It may have been deleted. <a href="/reports/all" onClick={linkClick('/reports/all')} className="font-medium text-stone-900 underline underline-offset-4">All reports</a>
                </StateCard>
              )}
              {turns.map((t) => {
                const n = versions.indexOf(t) + 1
                const isLatest = t === latest
                return (
                  <Turn key={t.id} t={t} n={n} isLatest={isLatest} many={versions.length > 1} heroRef={isLatest ? heroRef : null}
                    open={isLatest || !!open[t.id]} onToggle={() => setOpen((o) => ({ ...o, [t.id]: !o[t.id] }))}
                    onRetry={() => run(t)} onCancel={() => { clearTimeout(timers.current[t.id]); patch(t.id, { status: 'cancelled' }) }}
                    explain={explain} setExplain={setExplain} move={(bid, d) => move(t, bid, d)} remove={(bid) => remove(t, bid)} actions={actionsFor(t)} />
                )
              })}
            </div>
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-12" style={{ background: 'linear-gradient(to bottom, transparent, var(--color-page))' }} />
          {showDown && (
            <button type="button" onClick={jumpDown} aria-label="Jump to the latest"
              className="absolute bottom-3 left-1/2 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border border-line-strong bg-raised text-stone-700 outline-none transition-colors duration-150 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus motion-safe:animate-[fade-in_150ms_ease-out]">
              <ArrowDown size={16} aria-hidden />
            </button>
          )}
        </div>
      )}
      {/* the box: in a thread, a sibling below the scroll area (never inside it), 16px above the bottom */}
      <div key="dock" data-dock className={thread ? 'flex-none pb-4' : 'flex flex-[1.2] flex-col'}>
        <div ref={dock}>
          <PillComposer docked={thread} prompt={prompt} setPrompt={setPrompt} opts={opts} setOpts={setOpts} onSend={send}
            busy={turns.some((t) => t.status === 'steps')} onStop={stopAll} homeBrand={thread ? null : fromQuery('').opts.brand}
            placeholder={thread ? 'Change this report…' : null} suggestions={thread ? refineList : null} />
        </div>
      </div>
      {ghost && (
        <h1 aria-hidden className="pointer-events-none fixed z-30 text-center text-[24px] leading-[1.3] font-medium tracking-normal text-stone-900 md:text-[28px]"
          style={{ left: ghost.rect.left, top: ghost.rect.top, width: ghost.rect.width, animation: `greet-out 150ms ${EASE} both` }}
          onAnimationEnd={() => setGhost(null)}>{ghost.text}</h1>
      )}
      {dotsFor && turns.find((t) => t.id === dotsFor)?.built?.ok && (
        <DotAssemble brandId={turns.find((t) => t.id === dotsFor).opts.brand} kind={turns.find((t) => t.id === dotsFor).built.kind} targetRef={heroRef} fromRef={dock}
          done={turns.find((t) => t.id === dotsFor).status !== 'steps'} />
      )}
      <ScheduleModal open={scheduling} onClose={() => setScheduling(false)} title={latest?.built.title} brand={brandOf(latest?.opts.brand)?.name}
        onSave={(line) => { setScheduling(false); toast(`Scheduled ${line}`, { action: { label: 'View', onClick: () => navigate('/reports/scheduled') } }) }} />
      {toastNode}
    </div>
  )
}

// ?font=inter: load Inter for the comparison (preview only)
function useInterFont(on) {
  useEffect(() => {
    if (!on || document.getElementById('inter-preview')) return
    document.head.appendChild(Object.assign(document.createElement('link'), { id: 'inter-preview', rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap' }))
  }, [on])
}

// ---- one turn: the user's message on the right, then the reply
function Turn({ t, n, isLatest, many, heroRef, open, onToggle, onRetry, onCancel, explain, setExplain, move, remove, actions }) {
  const enter = (delay) => (t.live ? { animation: `bubble-in 200ms ${EASE} ${delay}ms both` } : undefined)
  return (
    <section aria-label={n ? `Version ${n}` : 'Message'} className="flex flex-col gap-5">
      <div className="mx-auto flex w-full max-w-[760px] flex-col items-end gap-1.5" style={enter(100)}>
        <p className="max-w-[70%] rounded-[18px] px-4 py-2.5 text-[15px] leading-6 text-stone-900 [text-wrap:pretty]" style={{ background: 'var(--bubble)' }}>{t.ask}</p>
        {t.built?.ok && <span className={`px-1 text-[12px] leading-4 ${t3}`}>{optsLine(t.opts)}{many ? ` · v${n}` : ''}</span>}
      </div>
      <Reply t={t} n={n} isLatest={isLatest} many={many} heroRef={heroRef} open={open} onToggle={onToggle} onRetry={onRetry} onCancel={onCancel}
        explain={explain} setExplain={setExplain} move={move} remove={remove} actions={actions} />
    </section>
  )
}

function Reply({ t, n, isLatest, many, heroRef, open, onToggle, onRetry, onCancel, explain, setExplain, move, remove, actions }) {
  const col = 'mx-auto w-full max-w-[760px]'
  if (t.status === 'note') return <p className={`${col} text-[15px] leading-6 ${t2}`} style={{ animation: `bubble-in 200ms ${EASE} 200ms both` }}>{t.note}</p>
  if (t.status === 'thin') return <div className={col}><NotEnough r={t.built} /></div>
  if (t.status === 'failed') {
    return (
      <div className={col}>
        <StateCard icon={<AlertCircle size={18} className="text-negative" aria-hidden />} title="The report couldn’t be written"
          actions={<button type="button" onClick={onRetry} className={inkBtn}>Try again</button>}>
          Writing the summary timed out after your data was read. Your data is fine and nothing was saved. Trying again usually works.
        </StateCard>
      </div>
    )
  }
  if (t.status === 'cancelled') return <p className={`${col} text-[14px] ${t3}`}>Stopped. Nothing was saved; change the question below and send it again.</p>
  if (t.status === 'steps') {
    const steps = stepsFor(t.opts)
    return (
      <div className="flex flex-col gap-5">
        <div className={`${col} flex items-start justify-between gap-3`}>
          <ol aria-live="polite" aria-label="Writing the report" className="flex flex-col gap-2">
            {steps.slice(0, t.step + 1).map((s, i) => {
              const done = i < t.step
              return (
                <li key={s} className={`flex items-center gap-2.5 text-[14px] leading-5 ${done ? t2 : 'text-stone-900'}`} style={{ animation: `step-in 200ms ${EASE} both` }}>
                  <span className="grid h-4 w-4 shrink-0 place-items-center" aria-hidden>
                    {done ? <Check size={14} strokeWidth={2.5} className="text-stone-600 motion-safe:animate-[icon-pop_200ms_ease-out]" /> : <Loader2 size={14} className="animate-spin text-stone-700 motion-reduce:animate-none" />}
                  </span>
                  {s}{done ? '' : '…'}<span className="sr-only">{done ? ', done' : ', in progress'}</span>
                </li>
              )
            })}
          </ol>
        </div>
        <Skeleton kind={t.built.kind} heroRef={heroRef} />
      </div>
    )
  }
  // a finished version: open, or (an earlier one) folded into a compact card
  return (
    <div className="flex flex-col">
      {!open && (
        <div className={`${col} flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 motion-safe:animate-[fade-in_200ms_ease-out]`}>
          <span className="grid h-9 w-14 shrink-0 place-items-center rounded-lg bg-tint"><Thumb kind={t.built.kind} className="h-7 w-11" /></span>
          <span className="min-w-0 flex-1 truncate text-[14px] leading-5 font-medium text-stone-900">{t.built.headline}</span>
          <span className={`shrink-0 text-[13px] tabular-nums ${t3}`}>v{n}</span>
          <button type="button" onClick={onToggle} className="h-8 shrink-0 rounded-full px-3 text-[13px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Show</button>
        </div>
      )}
      <div className="grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none" style={{ gridTemplateRows: open ? '1fr' : '0fr', transitionTimingFunction: EASE }}>
        <div className="min-h-0 overflow-hidden">
          {!isLatest && open && (
            <div className={`${col} mb-2 flex justify-end`}>
              <button type="button" onClick={onToggle} className="h-8 rounded-full px-3 text-[13px] font-medium text-stone-600 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Hide v{n}</button>
            </div>
          )}
          <article aria-label={t.built.title} className={ARTICLE}>
            {t.blocks.map((b, i) => (
              <BlockFrame key={`${t.id}-${b.id}`} b={b} i={i} n={t.blocks.length} reveal={t.live} explainOpen={explain === `${t.id}|${b.id}`}
                onExplain={() => setExplain((e) => (e === `${t.id}|${b.id}` ? null : `${t.id}|${b.id}`))} onUp={() => move(b.id, -1)} onDown={() => move(b.id, 1)} onRemove={() => remove(b.id)}
                explainText={explainFor(b)}>
                <Block block={b} title={t.built.title} n={numbers(t.blocks)[i]} />
              </BlockFrame>
            ))}
          </article>
          <div className="mx-auto mt-3 flex w-full max-w-[960px] flex-wrap items-center gap-x-1 gap-y-1" style={t.live ? { animation: `fade-in 200ms ease-out ${t.blocks.length * 120 + 200}ms both` } : undefined}>
            {many && <span className={`mr-2 text-[13px] tabular-nums ${t3}`}>v{n}{t.change ? ` · ${t.change}` : ''}</span>}
            {actions.map((a) => (
              <button key={a.label} type="button" onClick={a.onClick}
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
                <a.icon size={15} aria-hidden />{a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// the report card: the only container, at most 960 wide, 32px inside. Its bands (hero, sections, footer) are separated
// by full-width hairlines with 40px above and below (each block's own padding)
const ARTICLE = 'mx-auto flex w-full max-w-[960px] min-w-0 flex-col divide-y divide-[var(--div)] rounded-xl border border-line bg-surface px-8 py-2 max-md:px-4'

// while it's written: only the hero's place, where the dots gather (short, so the question stays in view)
const HERO_H = { weekly: 220, ceo: 240, rival: 280, content: 240 }
function Skeleton({ kind, heroRef }) {
  return <div ref={heroRef} aria-hidden className="mx-auto w-full max-w-[960px]" style={{ height: HERO_H[kind] ?? 240 }} />
}

function StateCard({ icon, title, actions, children }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 max-md:p-4">
      <p className="flex items-center gap-2 text-[15px] leading-5 font-semibold text-stone-900">{icon}{title}</p>
      <div className={`mt-1 text-[13px] leading-[18px] ${t2}`}>{children}</div>
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
function NotEnough({ r }) {
  const had = r.syncs === 0 ? 'hasn’t had a sync yet' : r.syncs === 1 ? 'has had one sync' : `has ${r.syncs} syncs in this period`
  return (
    <StateCard title="Not enough data for a report yet"
      actions={<><a href="/tracking" onClick={linkClick('/tracking')} className={inkBtn}>Open Tracking</a><a href="/reports" onClick={linkClick('/reports')} className={lineBtn}>New report</a></>}>
      {r.brand} {had}. A report compares at least two syncs, so nothing in it could be measured yet, and Kraffic doesn’t estimate.
      {r.nextSync ? ` The next sync is ${r.nextSync}; you can write a report after it.` : ' Run the first sync from Tracking.'}
    </StateCard>
  )
}

// ---- a block on the page: on hover (or focus) small actions: move up / down, explain this, remove
function BlockFrame({ b, i, n, reveal, explainOpen, explainText, onExplain, onUp, onDown, onRemove, children }) {
  const fixed = FIXED.has(b.type)
  const name = blockName(b)
  const iconBtn = 'grid h-7 w-7 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-30'
  return (
    <div role="group" aria-label={name} className={`group/block relative min-w-0 py-10 max-md:py-8 max-md:pr-9`}
      style={reveal ? { animation: `card-in 420ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 120}ms both` } : undefined}>
      <div className="absolute right-0 top-2 z-10 hidden items-center gap-0.5 rounded-lg border border-line bg-raised p-0.5 opacity-0 shadow-sm transition-opacity duration-150 group-hover/block:opacity-100 group-focus-within/block:opacity-100 md:flex">
        {!fixed && <button type="button" onClick={onUp} disabled={i <= FIRST_MOVABLE} aria-label={`Move “${name}” up`} title="Move up" className={iconBtn}><ArrowUp size={14} aria-hidden /></button>}
        {!fixed && <button type="button" onClick={onDown} disabled={i >= n - 2} aria-label={`Move “${name}” down`} title="Move down" className={iconBtn}><ArrowDown size={14} aria-hidden /></button>}
        <button type="button" onClick={onExplain} aria-expanded={explainOpen} className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[12px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><HelpCircle size={14} aria-hidden />Explain this</button>
        {!fixed && <button type="button" onClick={onRemove} aria-label={`Remove “${name}”`} title="Remove" className={iconBtn}><X size={14} aria-hidden /></button>}
      </div>
      <div className="absolute right-0 top-6 md:hidden">
        <ActionMenu label={`Actions for ${name}`} className="grid h-8 w-8 place-items-center rounded-md text-stone-500 outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus"
          items={[
            ...(fixed ? [] : [{ label: 'Move up', onClick: onUp }, { label: 'Move down', onClick: onDown }]),
            { label: 'Explain this', onClick: onExplain },
            ...(fixed ? [] : [{ label: 'Remove', onClick: onRemove, danger: true }]),
          ]}>
          <MoreHorizontal size={16} aria-hidden />
        </ActionMenu>
      </div>
      {children}
      {explainOpen && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-tint px-3 py-2.5 text-[13px] leading-[18px] text-stone-700 motion-safe:animate-[fade-in_150ms_ease-out]">
          <HelpCircle size={14} className="mt-0.5 shrink-0 text-stone-500" aria-hidden />
          <p className="min-w-0 flex-1"><span className="font-medium text-stone-900">How this was worked out. </span>{explainText}</p>
          <button type="button" onClick={onExplain} aria-label="Close the explanation" className="-m-1 grid h-6 w-6 shrink-0 place-items-center rounded text-stone-500 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><X size={13} aria-hidden /></button>
        </div>
      )}
    </div>
  )
}

// ---- Schedule this report
function ScheduleModal({ open, onClose, onSave, title, brand }) {
  const [every, setEvery] = useState('week')
  const [day, setDay] = useState('Monday')
  const [time, setTime] = useState('9am')
  const [to, setTo] = useState('dana@financeofamerica.com, priya@financeofamerica.com')
  const [pdf, setPdf] = useState(true)
  const n = to.split(/[,\s]+/).filter((x) => x.includes('@')).length
  const when = every === 'month' ? `on the 1st of each month at ${time}` : `${every === '2weeks' ? 'every other' : 'every'} ${day} at ${time}`
  const field = 'mt-1 h-9 w-full rounded-lg border border-line bg-surface px-3 text-[14px] font-normal text-stone-900 outline-none focus:border-stone-400'
  return (
    <Modal open={open} onClose={onClose} title="Schedule this report" subtitle={`${title ?? 'This report'} for ${brand ?? 'this brand'}: written again from the latest sync each time, then emailed`}
      footer={(
        <>
          <span className={`min-w-0 flex-1 basis-[200px] text-[13px] ${t2}`}>{n ? `Sends ${when}, to ${n} ${n === 1 ? 'person' : 'people'}` : 'Add at least one email'}</span>
          <span className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg px-3 text-small font-medium text-stone-600 outline-none hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Cancel</button>
            <button type="button" disabled={!n} onClick={() => onSave(`${when}, to ${n} ${n === 1 ? 'person' : 'people'}`)} className={inkBtn}>Schedule</button>
          </span>
        </>
      )}>
      <div className="flex flex-col gap-4">
        <div>
          <span className="text-[13px] font-medium text-stone-900">How often</span>
          <div className="mt-1"><Segmented label="How often" value={every} onChange={setEvery} options={[{ value: 'week', label: 'Weekly' }, { value: '2weeks', label: 'Every 2 weeks' }, { value: 'month', label: 'Monthly' }]} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {every !== 'month' && (
            <label className="text-[13px] font-medium text-stone-900">Day
              <select value={day} onChange={(e) => setDay(e.target.value)} className={field}>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((d) => <option key={d}>{d}</option>)}</select>
            </label>
          )}
          <label className="text-[13px] font-medium text-stone-900">Time
            <select value={time} onChange={(e) => setTime(e.target.value)} className={field}>{['8am', '9am', '10am', '12pm', '4pm'].map((d) => <option key={d}>{d}</option>)}</select>
          </label>
        </div>
        <label className="text-[13px] font-medium text-stone-900">Send to
          <textarea value={to} onChange={(e) => setTo(e.target.value)} rows={2} className={`${field} h-auto py-2 leading-5`} />
          <span className={`mt-1 block text-[12px] font-normal ${t3}`}>Emails, separated by commas. They don’t need a Kraffic account.</span>
        </label>
        <Switch checked={pdf} onChange={setPdf}>Attach the PDF</Switch>
      </div>
    </Modal>
  )
}

// ---- Print / PDF: an A4 sheet. One page when Length is One page (it says so if it doesn't fit)
function PrintView({ prompt, opts, title }) {
  const r = buildReport(opts, prompt)
  const sheet = useRef(null)
  const [over, setOver] = useState(false)
  useLayoutEffect(() => {
    const el = sheet.current
    if (!el) return
    const check = () => setOver(el.scrollHeight > el.clientHeight + 1)
    check()
    document.fonts?.ready.then(check)
  }, [])
  useEffect(() => { document.title = `${title ?? r.title} · PDF · Kraffic` }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // printing: always on light paper, whatever the app's theme
  const print = () => {
    const html = document.documentElement
    const prev = html.getAttribute('data-theme')
    html.setAttribute('data-theme', 'light')
    const back = () => { if (prev) html.setAttribute('data-theme', prev); else html.removeAttribute('data-theme'); window.removeEventListener('afterprint', back) }
    window.addEventListener('afterprint', back)
    window.print()
  }
  if (!r.ok) return <NotEnough r={r} />
  const one = r.opts.length === 'one'
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="print-hide flex w-full max-w-[794px] flex-wrap items-center justify-between gap-2">
        <p className={`text-[13px] ${over && one ? 'text-negative' : t2}`}>A4 · {one ? 'One page' : 'Detailed'}{over && one ? ' · doesn’t fit one page: remove a block, or ask for it shorter' : ''}</p>
        <div className="flex gap-2">
          <a href={`/reports/view?${toQuery(opts, prompt)}`} onClick={linkClick(`/reports/view?${toQuery(opts, prompt)}`)} className={lineBtn}>Back to the report</a>
          <button type="button" onClick={print} className={inkBtn}><Printer size={14} aria-hidden />Print or save as PDF</button>
        </div>
      </div>
      <div className="w-full overflow-x-auto">
        <div ref={sheet} className={`print-sheet mx-auto flex w-[210mm] flex-col gap-[6mm] bg-surface px-[14mm] py-[12mm] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_32px_-12px_rgba(0,0,0,0.18)] ${one ? 'h-[297mm] overflow-hidden' : 'min-h-[297mm]'}`}>
          <div className="flex flex-col divide-y divide-[var(--div)]" style={{ zoom: 0.62, width: 960 }}>
            {r.blocks.map((b, i) => <div key={b.id} className="py-8"><Block block={b} title={title ?? r.title} n={numbers(r.blocks)[i]} /></div>)}
          </div>
          <p className={`mt-auto text-[9px] ${t3}`}>Kraffic · {brandOf(r.opts.brand)?.name} · page 1 of 1</p>
        </div>
      </div>
    </div>
  )
}
