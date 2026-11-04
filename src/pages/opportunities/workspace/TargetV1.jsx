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
import { useState } from 'react'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { PlatformIcon } from '../../../components/dashboard/icons'
import { ENGINE_NAME, engineIcon } from '../../../data/contentOpportunities'
import { formatLabel } from '../../../data/contentRecommend'
import { LogoPlate, withResults } from '../parts'
import { afterRow, draftPlan, draftPreview, enginesOf, formatMatrix, pageOf, rankLadder } from '../draft/recommend'
import { lineBtn } from '../../../components/tool/ToolPage'
import { RingDraw, TickDraw } from './ui'
import SearchMatch, { ConnectSearchConsole, SkippedRow } from './SearchMatch'

const H = 'text-[18px] leading-[26px] font-semibold text-stone-900'
const HEAD = 'flex items-end justify-between gap-3 border-b border-line-strong pb-2'
const META = 'text-[13px] leading-[18px] text-stone-500'
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
    <div className="flex flex-col gap-8">
      {asking && <ConnectSearchConsole connecting={sc.connecting} onConnect={sc.onConnect} onSkip={sc.onSkip} />}
      {sc?.state === 'skipped' && !sc.connecting && <SkippedRow onConnect={sc.onConnect} />}
      <Ladder ladder={ladder} eng={eng} host={host} setHost={setHost} />
      {sc && !asking && sc.state !== 'skipped' && <SearchMatch {...sc} enginesFor={(path) => {
        const c = res.citedPages.find((x) => { try { return new URL(x.url).pathname.replace(/\/$/, '') === path } catch { return false } })
        return c ? eng(c) : { engines: [], unknown: false }
      }} />}
      {/* the format matrix left (8/12), the Update column right (4/12), owner 2026-11-04; stacked below 1100px, matrix first */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 min-[1100px]:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] min-[1100px]:items-start">
        <Matrix m={m} path={page.path} eng={eng} named={named} host={host} setHost={setHost} col={col} hoverCol={hoverCol} pulse={pulse} yourEnd={yourEnd} after={after.show ? after.cells : null} />
        {/* right (≥1100px): the recommendation, compact, top-aligned with the matrix's header; the draft (or Write the draft)
            under its rows; ends where its content ends. Below 1100px it stacks under the matrix. */}
        <section aria-labelledby="co-target-h" className="min-[1100px]:border-l min-[1100px]:border-line min-[1100px]:pl-10">
          <p id="co-target-h" className="text-[13px] leading-[18px] font-semibold text-stone-500">{page.action === 'update' ? 'Update' : 'Create'}</p>
          <p className="mt-0.5 break-all text-[18px] leading-[26px] font-semibold text-stone-900" data-target-path>{page.path}</p>
          {/* where the page comes from: Search Console's Publish on, or the user's own pick (with the way back) */}
          {page.source === 'sc' && <p className={`mt-0.5 ${META}`} data-sc-source="sc">From Search Console</p>}
          {page.source === 'pick' && (
            <p className={`mt-0.5 ${META}`} data-sc-source="pick">
              Your pick · <button type="button" onClick={() => sc?.onPick(null)} className="rounded font-medium text-ink underline decoration-[var(--color-line-strong)] underline-offset-[3px] outline-none hover:decoration-ink focus-visible:ring-2 focus-visible:ring-focus">{sc?.choice ? 'Use the suggested page' : 'Use the route’s page'}</button>
            </p>
          )}
          {page.action === 'update' && page.href && (
            <a href={page.href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 rounded text-[14px] font-medium text-ink underline decoration-[var(--color-line-strong)] underline-offset-[3px] outline-none hover:decoration-ink focus-visible:ring-2 focus-visible:ring-focus">
              Open page<ArrowUpRight size={14} aria-hidden />
            </a>
          )}
          <p className="mt-4 text-[15px] leading-[22px] font-semibold text-stone-900">
            {m.missing.length ? `Missing ${m.missing.length} ${m.missing.length === 1 ? 'format' : 'formats'} the winners use` : 'Has every format the winners use'}
          </p>
          <p className={`mt-0.5 ${META}`}>{page.reason}</p>
          {adds.length > 0 && (
            <div className="mt-4">
              <p className={`border-b border-line pb-1.5 ${META}`}>The draft adds</p>
              <ul onMouseLeave={() => hoverCol(null)}>
                {adds.map((c, i) => (
                  <li key={c.id} onMouseEnter={() => hoverCol(c.id)} style={anim('co-slide-row', yourEnd + T.adds + i * T.addsStep)}
                    className={`flex h-10 items-center gap-2.5 border-b border-[var(--div)] px-1.5 transition-colors duration-150 ${col === c.id ? 'bg-tint' : ''}`}>
                    <RingDraw size={14} />
                    <span className="min-w-0 flex-1 truncate text-[14px] leading-5 font-medium text-stone-900">{formatLabel(c.id)}</span>
                    <span className="text-[12px] leading-4 tabular-nums text-stone-500">{c.used} of {c.of} winners</span>
                    {c.score != null && <span className="w-[58px] text-right text-[13px] leading-[18px] font-semibold tabular-nums text-stone-900">score {c.score}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {draft ? <DraftPreview p={draftPreview(res.contentMarkdown)} open={draft.open} onOpen={draft.onOpen} />
            : write && <button type="button" onClick={write.onClick} className={`${lineBtn} mt-4`}>{write.label}<ArrowRight size={14} aria-hidden /></button>}
        </section>
      </div>
    </div>
  )
}

// the engines that cite a page, as icons (full colour); "AI" when the route doesn't say which engine
function EngineIcons({ e, size = 16, stack = false, delay = null }) {
  const items = [...e.engines.map((id) => ({ id })), ...(e.unknown ? [{ id: 'ai' }] : [])]
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
  return (
    <section aria-labelledby="co-ladder-h">
      <div className={HEAD}>
        <h3 id="co-ladder-h" className={H}>Google page 1 for this prompt</h3>
        <span className={META}>Engine icons: the AI answers that cite the page</span>
      </div>
      <ol className="flex h-[104px] items-center justify-center gap-3" aria-label="Google page 1">
        {slots.map((p, i) => (
          <li key={i} className="flex w-12 flex-col items-center gap-1.5">
            {p ? <Slot page={p} e={eng(p)} ours={p.isOurs} i={n++} host={host} setHost={setHost} /> : <span aria-hidden className="h-12 w-12 rounded-full border-[1.5px] border-dashed border-[var(--co-slot)]" />}
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
            <span className="flex gap-3">{aiOnly.map((p) => <Slot key={p.url} page={p} e={eng(p)} i={n++} host={host} setHost={setHost} />)}</span>
            <span className="whitespace-nowrap text-[12px] leading-4 text-stone-500">AI only</span>
          </li>
        )}
      </ol>
    </section>
  )
}

// a page in its slot: its logo (ink ring when it's yours), its engines on the corner; hover: the card under the row
function Slot({ page, e, ours = false, i, host, setHost }) {
  const on = host === page.host
  return (
    <span className="relative" onMouseEnter={() => setHost(page.host)} onMouseLeave={() => setHost(null)}>
      <button type="button" onFocus={() => setHost(page.host)} onBlur={() => setHost(null)}
        aria-label={`${page.host}${page.rank ? `, #${page.rank}` : ''}${ours ? ', your page' : ''}${engineNames(e).length ? `, cited by ${engineNames(e).join(', ')}` : ''}`}
        className={`relative grid h-12 w-12 place-items-center rounded-full outline-none transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-focus ${ours ? 'ring-2 ring-ink ring-offset-2 ring-offset-[var(--color-page)]' : ''} ${on ? 'scale-110' : ''}`}
        style={anim('co-slot-in', T.logo(i))}>
        <LogoPlate domain={page.host} size={48} logoClass="h-7 w-7" initialClass="text-[14px]" />
        <span className="absolute -right-1.5 -top-1.5"><EngineIcons e={e} size={14} stack delay={T.engines(i)} /></span>
      </button>
      {on && (
        <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-30 mt-9 w-[260px] -translate-x-1/2 rounded-lg border border-line bg-raised px-3 py-2.5 text-left shadow-md">
          <span className="block text-[13px] leading-[18px] font-semibold text-stone-900">{page.host}{ours && <span className="font-normal text-stone-500"> · your page</span>}{page.rank && <span className="font-normal text-stone-500"> · #{page.rank}</span>}</span>
          <span className="mt-0.5 block text-[13px] leading-[18px] text-stone-700">{page.title}</span>
          <span className="mt-1.5 block text-[12px] leading-4 text-stone-500">{page.formats.length ? page.formats.map(formatLabel).join(' · ') : 'No format detected'}</span>
          <span className="mt-0.5 block text-[12px] leading-4 text-stone-500">{engineNames(e).length ? `Cited by ${engineNames(e).join(', ')}` : 'Not cited in AI answers'}</span>
        </span>
      )}
    </span>
  )
}

// ---- 2. the format matrix -------------------------------------------------------------------------------------
function Matrix({ m, path, eng, named, host, setHost, col, hoverCol, pulse, yourEnd, after }) {
  // the page column keeps room for its names (168px+); format columns give way first (120px, down to 76px)
  const cols = `minmax(168px,1fr) 84px repeat(${m.columns.length}, minmax(76px,120px))`
  const tint = (id) => (col === id ? 'bg-tint' : '')
  const sweep = (c) => anim('co-sweep', T.sweep + c * T.col, 420, 'ease-out')
  return (
    <section aria-labelledby="co-matrix-h" className="min-w-0 overflow-x-auto">
      <div className={HEAD}>
        <h3 id="co-matrix-h" className={H}>What the winners have that you don’t</h3>
        <span className={META}>Formats on each page</span>
      </div>
      <div role="table" aria-label="Formats by page" onMouseLeave={() => { hoverCol(null); setHost(null) }}>
        <div role="row" className="grid items-end" style={{ gridTemplateColumns: cols }}>
          <span role="columnheader" className={`pb-2 pt-3 ${META}`}>Page</span>
          <span role="columnheader" className={`pb-2 pt-3 text-center ${META}`}>Cited by</span>
          {m.columns.map((c, i) => (
            <span key={c.id} role="columnheader" onMouseEnter={() => hoverCol(c.id)} className={`relative flex flex-col items-center px-1 pb-2 pt-3 text-center transition-colors duration-150 ${tint(c.id)}`}>
              <span aria-hidden className="pointer-events-none absolute inset-0 bg-tint" style={sweep(i) ?? { opacity: 0 }} />
              <span className="relative whitespace-nowrap text-[13px] leading-[18px] font-semibold text-stone-900" title={formatLabel(c.id)}>{SHORT[c.id] ?? c.label}</span>
              <span className={`relative text-[12px] leading-4 tabular-nums ${col === c.id && c.score != null ? 'font-semibold text-stone-900' : 'text-stone-500'}`}>{col === c.id && c.score != null ? `score ${c.score}` : `${c.used} of ${c.of}`}</span>
            </span>
          ))}
        </div>
        {m.winners.map((w, r) => (
          <div key={w.url} role="row" onMouseEnter={() => setHost(w.host)} className={`grid h-[52px] items-center border-t border-[var(--div)] transition-colors duration-150 ${host === w.host ? 'bg-tint' : ''}`} style={{ gridTemplateColumns: cols }}>
            <span role="rowheader" className="flex min-w-0 items-center gap-2.5 pl-1 pr-2">
              <LogoPlate domain={w.host} size={24} logoClass="h-4 w-4" />
              <span className="truncate text-[14px] leading-5 font-semibold text-stone-900">{w.host}</span>
              <span className="shrink-0 text-[12px] leading-4 tabular-nums text-stone-500">{w.rank ? `#${w.rank}` : 'AI only'}</span>
            </span>
            <span role="cell" className="flex justify-center">{(eng(w).engines.length || eng(w).unknown) ? <EngineIcons e={eng(w)} size={16} /> : <span className={META} aria-label="Not cited in AI answers">—</span>}</span>
            {m.columns.map((c, i) => (
              <span key={c.id} role="cell" onMouseEnter={() => hoverCol(c.id)} className={`relative grid h-full place-items-center transition-colors duration-150 ${tint(c.id)}`}>
                <span aria-hidden className="pointer-events-none absolute inset-0 bg-tint" style={sweep(i) ?? { opacity: 0 }} />
                <span className="relative" style={anim('co-cell-in', T.sweep + i * T.col + 60 + r * T.cell, 220)}>
                  {w.formats.includes(c.id)
                    ? <span className="block h-2.5 w-2.5 rounded-full bg-ink" role="img" aria-label="Has it" />
                    : <span className="block h-[9px] w-[9px] rounded-full border-[1.5px] border-[var(--co-empty)]" role="img" aria-label="Doesn’t have it" />}
                </span>
              </span>
            ))}
          </div>
        ))}
        {/* your page, under a stronger rule */}
        <div role="row" className="grid h-[52px] items-center border-t-2 border-line-strong" style={{ gridTemplateColumns: cols }}>
          <span role="rowheader" className="min-w-0 pl-1 pr-2">
            <span className="block text-[14px] leading-5 font-semibold text-ink">Your page</span>
            <span className="block truncate text-[12px] leading-4 text-stone-500">{path}</span>
          </span>
          <span role="cell" className="flex justify-center">{named.length ? <EngineIcons e={{ engines: named, unknown: false }} size={16} /> : <span className={META}>None yet</span>}</span>
          {m.columns.map((c, i) => (
            <span key={c.id} role="cell" onMouseEnter={() => hoverCol(c.id)} className={`grid h-full place-items-center transition-colors duration-150 ${tint(c.id)}`}>
              {m.yours.includes(c.id)
                ? <TickDraw delay={yourEnd + i * 40} />
                : <span key={col === c.id ? `p${pulse}` : 'still'} className="grid place-items-center rounded-full" style={col === c.id && !reduced() ? { animation: 'co-pulse-once 600ms ease-out both' } : undefined}>
                  <RingDraw size={20} delay={col === c.id ? 0 : yourEnd + i * 40} />
                </span>}
            </span>
          ))}
        </div>
        {/* after this draft: your ticks, the draft's formats as faint ticks drawing in (after your row's), honest rings */}
        {after && (
          <div role="row" className="grid h-[52px] items-center border-t border-[var(--div)]" style={{ gridTemplateColumns: cols }}>
            <span role="rowheader" className="min-w-0 truncate pl-1 pr-2 text-[14px] leading-5 text-stone-500">After this draft</span>
            <span role="cell" />
            {after.map((c, i) => (
              <span key={c.id} role="cell" onMouseEnter={() => hoverCol(c.id)} className={`grid h-full place-items-center transition-colors duration-150 ${tint(c.id)}`}>
                {c.state === 'have' ? <TickDraw delay={yourEnd + i * 40} />
                  : c.state === 'adds' ? <span className="opacity-40"><TickDraw delay={yourEnd + 360 + i * 60} ms={320} label="The draft adds it" /></span>
                    : <RingDraw size={20} delay={yourEnd + 360 + i * 60} label="Still missing after this draft" />}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
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
