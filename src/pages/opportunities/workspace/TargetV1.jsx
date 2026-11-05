// Draft step v1, Target page (step 1 of 3): two visuals from content-recommend's real fields (draft/recommend.js
// R18–R20), 32px apart, each under the same section header (18/600 over a --line-strong rule, a muted meta right).
//   1. "Google page 1 for this prompt": a rank ladder, 10 slots of 48px, 12px apart, centred (#1–#10). A page sits in
//      its rank slot as its logo; the engines that cite it are a tiny stack of their icons (14px, full colour) on its
//      corner; your page has an ink ring. If your page isn't on page 1: a dashed "You" circle after #10. AI-cited pages
//      not on page 1: an "AI only" group at the end. Empty slots: faint dashed rings. Hover / focus a logo: a card under
//      the row (never over its neighbours) with the domain, the title, the formats and the engines by name.
//   2. "What the winners have that you don't": a format matrix. Rows (52px): the route's winning pages
//      (pageRecommendation.evidence) with "Cited by" (their engines' icons), then "Your page" under a stronger rule
//      (the engines that name you now, or "None yet"). Format columns up to 120px (76px when space is tight), centred, "3 of 5" under each header.
//      Cells: ink dot = has it, faint ring = doesn't; your page: green tick = you have it, red dashed ring = missing.
//   Left of the matrix (top-aligned with its header): Update / Create · the path (18/600) · Open page ↗ · "Missing 2
//   formats the winners use" (+ the route's reason, muted) · "The draft adds" rows (format, winners, score; only the
//   missing formats the draft really adds, R21) · then, 16px under the rows (the column ends where its content ends):
//   once a draft exists, its preview (R27: "Your draft", the H1, 2 lines of the direct answer, the sections as plain
//   chips, "n flags to check", Open draft →); before one, a small secondary "Write the draft →" (the payoff bar's
//   action; the bar keeps the primary button).
//   Under "Your page": "After this draft" (R28: your ticks, the formats the draft adds as faint ticks drawing in, a
//   format it doesn't add stays a red dashed ring), shown while a draft exists or is about to be written.
// Load sequence (~1.2s, transforms / opacity only): logos drop into their slots (8px, 40ms apart), engine icons pop
// (0.6 → 1); a soft highlight sweeps across the format columns, each column's dots scaling in as it passes (20ms down
// the column); your row's ticks draw and its red rings draw around; then "The draft adds" rows slide in. Linked hover:
// a ladder logo ↔ its matrix row (soft tint); a format column or a "draft adds" row → that column, top to bottom, with
// your missing cell pulsing once. Reduced motion: the final state; the hover highlights stay.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Check } from 'lucide-react'
import { PlatformIcon } from '../../../components/dashboard/icons'
import { ENGINE_NAME, engineIcon } from '../../../data/contentOpportunities'
import { formatLabel } from '../../../data/contentRecommend'
import { LogoPlate, MorePages, siteName, withResults } from '../parts'
import { afterRow, draftPlan, draftPreview, enginesOf, formatMatrix, pageOf, rankLadder } from '../draft/recommend'
import { lineBtn } from '../../../components/tool/ToolPage'
import { RingDraw, TickDraw } from './ui'
import SearchMatch, { ConnectSearchConsole, SkippedRow } from './SearchMatch'

// one type scale for the page (owner, 2026-11-05): titles 20/600, sublines 14/500 secondary, rows 16/600 + 14/500,
// headers 14/600, numbers 600 tabular; nothing above 600
const H = 'text-[20px] leading-[28px] font-semibold text-stone-900'
const HEAD = 'flex items-end justify-between gap-3 border-b border-line-strong pb-2'
const META = 'text-[14px] leading-5 font-medium text-stone-600'
const COLH = 'text-[14px] leading-5 font-semibold text-stone-600' // column headers
// one-line column headers
const SHORT = { listicle: 'Listicle', how_to: 'How-to guide', research: 'Original research', faq: 'FAQ', comparison: 'Comparison', tutorial: 'Tutorial', stats: 'Stats roundup', checklist: 'Checklist', case_study: 'Case study', template: 'Template' }
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
// the load sequence (ms)
const T = { logo: (i) => i * 40, engines: (i) => 420 + i * 40, sweep: 640, col: 110, cell: 20, after: 120, adds: 160, addsStep: 70 }
const anim = (name, delay, ms = 260, easing = 'cubic-bezier(.2,.8,.2,1)') => (reduced() ? undefined : { animation: `${name} ${ms}ms ${easing} ${delay}ms both` })

// resolve: the 'ai' tag's engines for a host (from the prompt's answers) · named: the engines that name the brand now ·
// draft: null (no draft yet) | { open: unticked flags, onOpen: opens the Draft step in focus } · write: the payoff bar's
// action for the no-draft state ({ label, onClick }), null to leave the button out · page: THE target page (Workspace:
// the user's pick, else Search Console's Publish on, else the route's; source 'pick' | 'sc' | 'route'), shown in the
// Update column · sc: Search Console ({ gsc, state, domain, connecting, justConnected, onConnect, onSkip, onChange,
// page, choice, onPick }), null to leave it out. Not connected and never asked: the Connect step comes FIRST, before
// the ladder; skipped: a slim "Connect Search Console for a better match" row there instead.
export default function TargetV1({ res, resolve, named = [], draft = null, write = null, sc = null, page: given = null }) {
  const page = given ?? { ...pageOf(res.pageRecommendation), source: 'route' }
  const asking = sc && (sc.state === 'new' || (sc.connecting && sc.state !== 'reconnect'))
  const ladder = rankLadder(res.citedPages)
  const m = formatMatrix(res)
  const [host, setHost] = useState(null) // linked hover: a page
  const [col, setCol] = useState(null) // linked hover: a format column
  const [pulse, setPulse] = useState(0) // bumps to replay the missing cell's pulse
  const hoverCol = (id) => { if (id !== col) { setCol(id); if (id) setPulse((p) => p + 1) } }
  // a page's engines: its citedPages entry (evidence rows carry no engines, so match by url), R20
  const eng = (p) => withResults(enginesOf(res.citedPages.find((c) => c.url === p.url) ?? p, resolve))
  const yourEnd = T.sweep + m.columns.length * T.col + T.after
  const after = afterRow(res)
  const plan = draftPlan(res.recommendations).missing.map((x) => x.id)
  // "The draft adds": the missing formats the draft really adds (R21 ∩ missing, as R28's faint ticks); a missing format
  // it doesn't add isn't listed here (it stays a red ring in both of your rows)
  const adds = m.missing.filter((c) => plan.includes(c.id))
  return (
    <div className="flex flex-col gap-8 pb-12">
      {asking && <ConnectSearchConsole connecting={sc.connecting} onConnect={sc.onConnect} onSkip={sc.onSkip} />}
      {sc?.state === 'skipped' && !sc.connecting && <SkippedRow onConnect={sc.onConnect} />}
      {sc && !asking && sc.state !== 'skipped' && <SearchMatch {...sc} enginesFor={(path) => {
        const c = res.citedPages.find((x) => { try { return new URL(x.url).pathname.replace(/\/$/, '') === path } catch { return false } })
        return c ? eng(c) : { engines: [], unknown: false }
      }} titleFor={(path) => res.citedPages.find((x) => { try { return new URL(x.url).pathname.replace(/\/$/, '') === path } catch { return false } })?.title ?? null} />}
      {/* the format matrix, full width (owner, 2026-11-05: "The draft adds" panel removed; what it adds is the
          header's line and the tinted columns) */}
      <Matrix m={m} path={page.path} eng={eng} named={named} host={host} setHost={setHost} col={col} hoverCol={hoverCol} pulse={pulse} yourEnd={yourEnd}
        adds={adds} cells={after.cells} write={write} />
      {/* Google page 1 at the bottom, after the winners table (owner, round 4) */}
      <Ladder ladder={ladder} eng={eng} host={host} setHost={setHost} />
    </div>
  )
}

// the engines that cite a page, as icons (full colour); "AI" when the route doesn't say which engine
function EngineIcons({ e, size = 16, stack = false, delay = null }) {
  // only engines we can name (owner, 2026-11-05: no neutral "AI" badge; unresolved shows nothing)
  const items = e.engines.map((id) => ({ id }))
  if (!items.length) return null
  return (
    // stacked (on a ladder slot): side by side with a hairline gap, never overlapping, so the AI Overview / AI Mode
    // corner badges (the only thing telling Google's two engines apart) stay visible
    <span className={`flex items-center ${stack ? 'gap-px' : 'gap-1'}`} style={delay != null ? anim('co-pop-in', delay, 220) : undefined}>
      {items.map((x) => (
        <span key={x.id} title={x.id === 'ai' ? 'AI answers (engine not specified)' : ENGINE_NAME[x.id]}
          className={`grid place-items-center rounded-full bg-surface ${stack ? 'ring-[1.5px] ring-[var(--color-surface)]' : ''}`} style={{ width: size + (stack ? 2 : 0), height: size + (stack ? 2 : 0) }}>
          {x.id === 'ai'
            ? <span className="grid h-full w-full place-items-center rounded-full bg-stone-200 leading-none font-bold text-stone-700" style={{ fontSize: Math.max(7, size * 0.45) }}>AI</span>
            : <PlatformIcon id={engineIcon(x.id)} size={size} />}
        </span>
      ))}
    </span>
  )
}
const engineNames = (e) => [...e.engines.map((id) => ENGINE_NAME[id]), ...(e.unknown ? ['AI answers (engine not specified)'] : [])]

// ---- 1. the rank ladder ---------------------------------------------------------------------------------------
function Ladder({ ladder, eng, host, setHost }) {
  const { slots, ours, aiOnly } = ladder
  let n = 0
  // a site on two page-1 spots (owner, 2026-11-05): hovering it keeps both circles bright and dims the others to 40%
  const count = slots.reduce((m, p) => (p ? m.set(p.host, (m.get(p.host) ?? 0) + 1) : m), new Map())
  const twoSpot = host && (count.get(host) ?? 0) > 1
  const [hoverUrl, setHoverUrl] = useState(null) // the slot under the pointer: only its card shows
  const dim = (p) => twoSpot && p.host !== host
  const card = (p) => (hoverUrl ? hoverUrl === p.url : host === p.host && slots.find((s) => s?.host === host) === p)
  const slotProps = (p) => ({ host, setHost, dim: dim(p), card: card(p), onHover: setHoverUrl })
  return (
    <section aria-labelledby="co-ladder-h">
      <div className={`${HEAD} flex-wrap gap-y-0.5`}>
        <h3 id="co-ladder-h" className={H}>Google page 1 for this prompt</h3>
        <span className={META}>Icons: AI engines that cite the page</span>
      </div>
      <ol className="flex h-[104px] items-center justify-center gap-3" aria-label="Google page 1">
        {slots.map((p, i) => (
          <li key={i} className="flex w-12 flex-col items-center gap-1.5">
            {p ? <Slot page={p} e={eng(p)} ours={p.isOurs} i={n++} {...slotProps(p)} /> : <span aria-hidden className="h-12 w-12 rounded-full border-[1.5px] border-dashed border-[var(--co-slot)]" />}
            <span className={`text-[12px] leading-4 tabular-nums ${p ? 'font-semibold text-stone-700' : 'text-stone-400'}`}>#{i + 1}{!p && <span className="sr-only"> empty</span>}</span>
          </li>
        ))}
        {!ours && (
          <li className="ml-3 flex flex-col items-center gap-1.5 border-l border-line pl-6">
            <span className="grid h-12 w-12 place-items-center rounded-full border-[1.5px] border-dashed border-stone-500 text-[12px] font-semibold text-stone-600">You</span>
            <span className="whitespace-nowrap text-[12px] leading-4 text-stone-500">Not on page 1</span>
          </li>
        )}
        {aiOnly.length > 0 && (
          <li className="ml-3 flex flex-col items-center gap-1.5 border-l border-line pl-6">
            <span className="flex gap-3">{aiOnly.map((p) => <Slot key={p.url} page={p} e={eng(p)} i={n++} {...slotProps(p)} />)}</span>
            <span className="whitespace-nowrap text-[12px] leading-4 text-stone-500">AI only</span>
          </li>
        )}
      </ol>
    </section>
  )
}

// a page in its slot: its logo (ink ring when it's yours), its engines on the corner; hover: the card under the row
// dim: another site's two spots are hovered (40%) · card: this slot shows the hover card (only the one under the pointer)
function Slot({ page, e, ours = false, i, host, setHost, dim = false, card = false, onHover = () => {} }) {
  const on = host === page.host
  const enter = () => { setHost(page.host); onHover(page.url) }
  const leave = () => { setHost(null); onHover(null) }
  const btn = useRef(null)
  return (
    <span className={`relative transition-opacity duration-150 ${dim ? 'opacity-40' : ''}`} onMouseEnter={enter} onMouseLeave={leave} data-slot-host={page.host} data-dim={dim || undefined}>
      <button ref={btn} type="button" onFocus={enter} onBlur={leave}
        aria-label={`${siteName(page.host)}${page.rank ? `, #${page.rank}` : ''}${ours ? ', your page' : ''}${engineNames(e).length ? `, cited by ${engineNames(e).join(', ')}` : ''}`}
        className={`relative grid h-12 w-12 place-items-center rounded-full outline-none transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-focus ${ours ? 'ring-2 ring-ink ring-offset-2 ring-offset-[var(--color-page)]' : ''} ${on ? 'scale-110' : ''}`}
        style={anim('co-slot-in', T.logo(i))}>
        <LogoPlate domain={page.host} size={48} logoClass="h-7 w-7" initialClass="text-[14px]" plate />
        <span className="absolute -right-1.5 -top-1.5"><EngineIcons e={e} size={14} stack delay={T.engines(i)} /></span>
      </button>
      {on && card && <SlotCard anchor={btn} page={page} e={e} ours={ours} />}
    </span>
  )
}
// the slot's hover card, in a portal (no parent can clip it): below the logo's row when there's room, else above the
// logo; it fades and slides 4px in from the side it opens on (none with reduced motion)
function SlotCard({ anchor, page, e, ours }) {
  const ref = useRef(null)
  const [at, setAt] = useState(null) // { left, top, below }
  useLayoutEffect(() => {
    const r = anchor.current?.getBoundingClientRect()
    const h = ref.current?.offsetHeight ?? 140, w = 260, gap = 30 // below: clear of the rank label under the logo
    if (!r) return
    const below = window.innerHeight - r.bottom >= h + gap + 8
    setAt({ left: Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)), top: below ? r.bottom + gap : r.top - h - 8, below })
  }, [anchor])
  const still = reduced()
  return createPortal(
    <span ref={ref} role="tooltip" className="pointer-events-none fixed z-[90] w-[260px] rounded-lg border border-line bg-raised px-3 py-2.5 text-left shadow-md"
      style={at ? { left: at.left, top: at.top, opacity: 1, animation: still ? undefined : `${at.below ? 'co-card-down' : 'co-card-up'} 150ms ease-out both` } : { left: -9999, top: 0, opacity: 0 }}>
      <span className="block text-[13px] leading-[18px] font-semibold text-stone-900">{siteName(page.host)}{ours && <span className="font-normal text-stone-500"> · your page</span>}{page.rank && <span className="font-normal text-stone-500"> · #{page.rank}</span>}</span>
      <span className="mt-0.5 block text-[13px] leading-[18px] text-stone-700">{page.title}</span>
      <span className="mt-1.5 block text-[12px] leading-4 text-stone-500">{page.formats.length ? page.formats.map(formatLabel).join(' · ') : 'No format detected'}</span>
      <span className="mt-0.5 block text-[12px] leading-4 text-stone-500">{engineNames(e).length ? `Cited by ${engineNames(e).join(', ')}` : 'Not cited in AI answers'}</span>
    </span>,
    document.body,
  )
}

// ---- 2. the format matrix (owner, 2026-11-05) ----------------------------------------------------------------
// Full width. Header: the title, "Add your data →" right; one line under it: "The draft adds FAQ and How-to guide".
// Columns: the formats the draft adds first (light tint, full height), then the rest; each "3 of 5" and, for the ones
// the draft adds, "· score 24". Winner rows: one line (logo · name · "#2" muted · the engines that cite the page), by
// rank, AI-only last; a filled 8px dot where the page has the format, nothing where it doesn't. One "Your page" row
// (tinted, the path under the name, the engines that name you): dark green tick = you have it, light green tick +
// "+ draft" = this draft adds it, red dashed ring = still missing after this draft. 52px rows, the Search Console
// table's borders.
const listFormats = (ids) => { const l = ids.map(formatLabel); return l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} and ${l.at(-1)}` }
function Matrix({ m, path, eng, named, host, setHost, col, hoverCol, pulse, yourEnd, adds, cells, write }) {
  const addIds = adds.map((c) => c.id)
  const columns = [...m.columns.filter((c) => addIds.includes(c.id)), ...m.columns.filter((c) => !addIds.includes(c.id))]
  const added = (id) => addIds.includes(id)
  // the page column fits its content, then Cited by; the formats share the rest; Coverage last (owner, round 4)
  const cols = `max-content max-content repeat(${columns.length}, minmax(76px,1fr)) 72px`
  // no grey band on the formats the draft adds (a small "Draft adds" label above them); a light tint on hover only
  const tint = (id) => (col === id ? 'bg-[color-mix(in_srgb,var(--tint)_60%,transparent)]' : '')
  const winners = [...m.winners].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
  const stateOf = (id) => cells?.find((c) => c.id === id)?.state ?? (m.yours.includes(id) ? 'have' : added(id) ? 'adds' : 'missing')
  const line = adds.length ? `The draft adds ${listFormats(addIds)}` : m.missing.length ? 'Nothing the draft can add here: the missing formats need their own page' : 'Your page already has every format the winners use'
  return (
    <section aria-labelledby="co-matrix-h" className="min-w-0 overflow-x-auto">
      <div className={`${HEAD} items-center`}>
        <div className="min-w-0">
          <h3 id="co-matrix-h" className={H}>What the winners have that you don’t</h3>
          <p className={`mt-0.5 ${META}`} data-draft-adds>{line}</p>
        </div>
        {/* no "Add your data" here: the step card at the top has the main one (owner, 2026-11-05, "your call") */}
      </div>
      {/* one grid for the whole table; each row a subgrid, so the content-sized columns line up across rows */}
      <div role="table" aria-label="Formats by page" className="grid" style={{ gridTemplateColumns: cols }} onMouseLeave={() => { hoverCol(null); setHost(null) }}>
        <div role="row" className="col-span-full grid grid-cols-subgrid items-end">
          <span role="columnheader" className={`self-end pb-2 pt-3 pr-6 ${COLH}`}>Page</span>
          <span role="columnheader" className={`self-end pb-2 pt-3 pr-4 ${COLH}`}>Cited by</span>
          {columns.map((c) => (
            <span key={c.id} role="columnheader" onMouseEnter={() => hoverCol(c.id)} data-adds={added(c.id) || undefined}
              className={`flex flex-col items-center justify-end self-stretch px-1 pb-2 pt-3 text-center transition-colors duration-150 ${tint(c.id)}`}>
              {added(c.id) && <span className="mb-0.5 whitespace-nowrap text-[12px] leading-4 font-medium text-stone-600">Draft adds</span>}
              <span className="whitespace-nowrap text-[14px] leading-5 font-semibold text-stone-900" title={formatLabel(c.id)}>{SHORT[c.id] ?? c.label}</span>
              <span className="whitespace-nowrap text-[13px] leading-[18px] font-semibold tabular-nums text-stone-600" aria-label={`${c.used} of ${c.of} winners${added(c.id) && c.score != null ? `, score ${c.score}` : ''}`}>{c.used} of {c.of}{added(c.id) && c.score != null ? ` · ${c.score}` : ''}</span>
            </span>
          ))}
          <span role="columnheader" className={`self-end pb-2 pt-3 text-center ${COLH}`}>Coverage</span>
        </div>
        {winners.map((w, r) => (
          <div key={w.url} role="row" onMouseEnter={() => setHost(w.host)} className={`col-span-full grid h-[52px] grid-cols-subgrid items-center border-t border-[var(--div)] transition-colors duration-150 ${host === w.host ? 'bg-[color-mix(in_srgb,var(--tint)_60%,transparent)]' : ''}`}>
            <span role="rowheader" tabIndex={0} onFocus={() => setHost(w.host)} onBlur={() => setHost(null)} className="group/site relative flex min-w-0 items-center gap-2 rounded pl-1 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <SiteCard w={w} e={eng(w)} />
              <LogoPlate domain={w.host} size={24} logoClass="h-4 w-4" />
              <span className="truncate text-[16px] leading-6 font-semibold text-stone-900" title={w.host}>{siteName(w.host)}</span>
              <span className="shrink-0 text-[14px] leading-5 font-medium tabular-nums text-stone-600">{w.rank ? `#${w.rank}` : 'AI only'}</span>
              {w.others?.length > 0 && <MorePages page={w} others={w.others} />}
              <span aria-hidden className="w-4" />
            </span>
            <span role="cell" className="flex items-center pr-4"><EngineIcons e={eng(w)} size={16} /></span>
            {columns.map((c, i) => (
              <span key={c.id} role="cell" onMouseEnter={() => hoverCol(c.id)} className={`grid h-full place-items-center transition-colors duration-150 ${tint(c.id)}`}>
                {w.formats.includes(c.id) && <Sq kind="have" style={anim('co-cell-in', T.sweep + i * T.col + 60 + r * T.cell, 220)} />}
              </span>
            ))}
            <span role="cell" className="grid place-items-center"><CoverageBar have={columns.filter((c) => w.formats.includes(c.id)).length} of={columns.length} /></span>
          </div>
        ))}
        {/* your page: one tinted row, under a stronger rule */}
        <div role="row" className="col-span-full grid h-[52px] grid-cols-subgrid items-center border-t-2 border-line-strong bg-[color-mix(in_srgb,var(--tint)_70%,transparent)]">
          <span role="rowheader" className="flex min-w-0 items-center gap-2 pl-1 pr-2">
            <span className="flex min-w-0 flex-col">
              <span className="text-[16px] leading-6 font-semibold text-ink">Your page</span>
              <span className="truncate text-[14px] leading-5 font-medium text-stone-900" title={path}>{path}</span>
            </span>
          </span>
          <span role="cell" className="flex items-center pr-4">{named.length > 0 && <span className="flex" aria-label={`Named by ${named.map((x) => ENGINE_NAME[x]).join(', ')}`}><EngineIcons e={{ engines: named, unknown: false }} size={16} /></span>}</span>
          {columns.map((c, i) => {
            const st = stateOf(c.id)
            return (
              <span key={c.id} role="cell" onMouseEnter={() => hoverCol(c.id)} data-state={st} className={`grid h-full place-items-center transition-colors duration-150 ${tint(c.id)}`}>
                {st === 'have' ? <Sq kind="have" green />
                  : st === 'adds' ? <span className="flex items-center gap-1.5"><Sq kind="adds" green /><span className="text-[12px] leading-none font-semibold text-[var(--rep-up-fg)]">+draft</span></span>
                    : <span key={col === c.id ? `p${pulse}` : 'still'} style={col === c.id && !reduced() ? { animation: 'co-pulse-once 600ms ease-out both' } : undefined}><Sq kind="missing" /></span>}
              </span>
            )
          })}
          <span role="cell" className="grid place-items-center">
            <CoverageBar green have={columns.filter((c) => stateOf(c.id) === 'have').length} adds={columns.filter((c) => stateOf(c.id) === 'adds').length} of={columns.length} />
          </span>
        </div>
      </div>
    </section>
  )
}

// a cell (owner's sketch, 2026-11-05): ■ has it · ▨ this draft adds it (hatched) · a red dashed square: still missing
const hatch = (c) => `repeating-linear-gradient(135deg, ${c} 0 1.5px, transparent 1.5px 4px)`
// green: the "Your page" row (owner, 2026-11-05): solid green = you have it, hatched green = this draft adds it
function Sq({ kind, size = 12, style, green = false }) {
  const ink = green ? 'var(--rep-up-fg)' : 'var(--ink)'
  const label = kind === 'have' ? 'Has it' : kind === 'adds' ? 'This draft adds it' : kind === 'missing' ? 'Still missing after this draft' : 'Doesn’t have it'
  const look = kind === 'have' ? { background: ink }
    : kind === 'adds' ? { backgroundImage: hatch(ink), boxShadow: `inset 0 0 0 1.5px ${ink}` }
      : kind === 'missing' ? { boxShadow: 'inset 0 0 0 1.5px var(--negative)', outline: '1px dashed transparent' }
        : { boxShadow: 'inset 0 0 0 1.5px var(--color-line-strong)' }
  return <span role="img" aria-label={label} className="block shrink-0 rounded-[2px]" style={{ width: size, height: size, ...(kind === 'missing' ? { border: '1.5px dashed var(--negative)' } : look), ...style }} />
}
// coverage: one small square per format, ■ the ones the page has, ▨ the ones this draft adds, □ the rest
function CoverageBar({ have, adds = 0, of, green = false }) {
  return (
    <span className="flex items-center gap-[3px]" role="img" aria-label={`${have + adds} of ${of} formats${adds ? ` (${have} now, ${adds} from this draft)` : ''}`}>
      {Array.from({ length: of }, (_, k) => <Sq key={k} size={10} green={green && k < have + adds} kind={k < have ? 'have' : k < have + adds ? 'adds' : 'empty'} />)}
    </span>
  )
}

// a matrix row's hover / focus card: the site, its rank, the page title, its formats, and the AI answers that cite it
// (the engines' icons and names; they used to repeat in a "Cited by" column on every row)
function SiteCard({ w, e }) {
  return (
    <span role="tooltip" className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-[280px] rounded-lg border border-line bg-raised px-3 py-2.5 text-left shadow-md group-hover/site:block group-focus-visible/site:block">
      <span className="block text-[13px] leading-[18px] font-semibold text-stone-900">{w.host}{w.rank ? <span className="font-normal text-stone-500"> · #{w.rank}</span> : <span className="font-normal text-stone-500"> · AI only</span>}</span>
      {w.title && <span className="mt-0.5 block text-[13px] leading-[18px] text-stone-700">{w.title}</span>}
      <span className="mt-1.5 block text-[12px] leading-4 text-stone-500">{w.formats.length ? w.formats.map(formatLabel).join(' · ') : 'No format detected'}</span>
      <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-4 text-stone-600">
        {e.engines.length
          ? <>Cited by {e.engines.map((id) => <span key={id} className="inline-flex items-center gap-1"><PlatformIcon id={engineIcon(id)} size={14} />{ENGINE_NAME[id]}</span>)}</>
          : e.unknown ? 'Cited in AI answers (engine not specified)' : 'Not cited in AI answers'}
      </span>
    </span>
  )
}

// ---- the left column's foot: the draft -------------------------------------------------------------------------
// a draft exists: its preview (R27) and the way into it
function DraftPreview({ p, open, onOpen }) {
  return (
    <div className="mt-4" style={anim('co-arrive-in', 0, 240, 'ease-out')}>
      <p className="text-[12px] leading-4 text-stone-500">Your draft</p>
      <p className="mt-0.5 line-clamp-2 text-[16px] leading-6 font-semibold text-stone-900">{p.title}</p>
      {p.answer && <p className="mt-1 line-clamp-2 text-[14px] leading-5 text-stone-500">{p.answer}</p>}
      {p.sections.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1" aria-label="Sections">
          {p.sections.map((s) => <li key={s} className="inline-flex h-[22px] items-center rounded-md bg-tint px-1.5 text-[12px] leading-4 font-medium text-stone-700">{s}</li>)}
        </ul>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <span className="text-[13px] leading-[18px] tabular-nums text-stone-700">{open ? `${open} ${open === 1 ? 'flag' : 'flags'} to check` : 'Every flag checked'}</span>
        <button type="button" onClick={onOpen} className="inline-flex items-center gap-1 rounded text-[14px] leading-5 font-medium text-ink outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-focus">
          Open draft<ArrowRight size={14} aria-hidden />
        </button>
      </div>
    </div>
  )
}
