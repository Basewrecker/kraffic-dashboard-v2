// Target page (v1): "Search Console for this prompt", between the rank ladder and the format matrix. The app's GET
// …/gsc-match response (data/gscMatch.js, lib/gsc-match.js analyzePrompt), one section under the same header style as
// the ladder and the matrix (18/600 over a --line-strong rule, a muted meta right with the range and an ⓘ).
//   One flow visual (owner, 2026-11-05): the prompt → its matching searches → your pages (see Flow below), and one
//   line under it: "Using this page: <path> · Change page". No other text blocks.
//   States: not connected (Connect) · reconnect (Reconnect) · no property for the domain · connected with no data yet
//   (the new page it would suggest). The ladder and the matrix render in every state.
// Stacked below 1100px (the chain, then Your pages).
import { useLayoutEffect, useRef, useState } from 'react'
import { Check, Info, Loader2, Plus } from 'lucide-react'
import { GoogleIcon } from '../../../components/dashboard/icons'
import { lineBtn } from '../../../components/tool/ToolPage'
import { useWidth } from '../../../components/ui/motion'
import { MidText } from '../parts'
import { BRAND_PALETTE, BRAND_PALETTE_DARK, cssColor } from '../../../utils/brandColors'
let measureCtx = null

const nf = new Intl.NumberFormat('en-US')
const num = (n) => nf.format(n)
const H = 'text-[18px] leading-[26px] font-semibold text-stone-900'
const HEAD = 'flex items-end justify-between gap-3 border-b border-line-strong pb-2'
const META = 'text-[13px] leading-[18px] text-stone-500'
const LABEL = 'text-[13px] leading-[18px] font-semibold text-stone-500'
const TIP = 'pointer-events-none absolute top-full z-30 mt-1 rounded-md border border-line bg-raised px-3 py-2 text-left text-[12px] leading-4 font-normal text-stone-700 opacity-0 shadow-md transition-opacity duration-150 group-hover/i:opacity-100 group-focus-within/i:opacity-100'
const day = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

// an ⓘ with its tooltip (hover / focus)
export function Tip({ label, children, align = 'right', width = 260 }) {
  return (
    <span className="group/i relative inline-flex shrink-0 align-middle">
      <span tabIndex={0} aria-label={label} className="grid h-5 w-5 place-items-center rounded-md text-stone-500 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"><Info size={13} aria-hidden /></span>
      <span role="tooltip" className={`${TIP} ${align === 'right' ? 'right-0' : 'left-0'}`} style={{ width }}>{children}</span>
    </span>
  )
}
const Chip = ({ children }) => <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-tint px-2 text-[12px] leading-4 font-medium text-stone-600">{children}</span>
const Tag = ({ intent }) => <span className="inline-flex h-[18px] shrink-0 items-center rounded border border-line px-1.5 text-[11px] leading-none font-medium text-stone-500">{intent}</span>
const INTENT_WHY = { account: 'an account question (the reader’s own account, not the topic)', local: 'a local search (a place)', site: 'it names a site or a brand, not the topic; never the best query' }

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const ink = 'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-ink px-3.5 text-[14px] font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-80'
const textLink = 'rounded text-[14px] leading-5 font-medium text-ink underline decoration-[var(--color-line-strong)] underline-offset-[3px] outline-none hover:decoration-ink focus-visible:ring-2 focus-visible:ring-focus'

// The ask, first on the Target page while the brand has never connected Search Console (owner, 2026-11-04): the Google
// mark, what it's for (read-only), Connect (the mock's OAuth round trip: a spinner, ~900ms) or Skip (the route's
// suggested page). On success the Search Console section takes its place.
export function ConnectSearchConsole({ connecting = false, onConnect, onSkip }) {
  return (
    <section aria-labelledby="co-sc-ask" data-sc-ask className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-xl border border-line bg-surface px-6 py-5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-surface" aria-hidden><GoogleIcon size={26} /></span>
      <div className="min-w-0 flex-1 basis-[320px]">
        <h3 id="co-sc-ask" className="text-[17px] leading-6 font-semibold text-stone-900">Connect Google Search Console</h3>
        <p className="mt-0.5 max-w-[620px] text-[14px] leading-5 text-stone-600">Read-only. We use it to find which of your pages already gets search traffic for this prompt, so the content goes on the right page.</p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {!connecting && <button type="button" onClick={onSkip} className={textLink}>Skip, we’ll suggest a page</button>}
        <button type="button" onClick={onConnect} disabled={connecting} aria-busy={connecting} className={ink}>
          {connecting ? <><Loader2 size={15} aria-hidden className="motion-safe:animate-spin" />Connecting…</> : 'Connect Search Console'}
        </button>
      </div>
    </section>
  )
}

// skipped: the route's suggested page stands; one slim row keeps the way back
export function SkippedRow({ onConnect }) {
  return (
    <div data-sc-skipped className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg bg-tint px-4 py-2.5">
      <span className="flex min-w-0 items-center gap-2.5 text-[14px] leading-5 text-stone-700"><GoogleIcon size={16} />Connect Search Console for a better match</span>
      <button type="button" onClick={onConnect} className={textLink}>Connect</button>
    </div>
  )
}

// gsc: the route's response · domain: the brand's domain · state: brandScState · connecting: the mock's OAuth wait ·
// justConnected: animate in once after Connect · onConnect() · onChange(): reopens the connect step (where the app
// would let the user pick another Search Console property) · enginesFor(path) → { engines, unknown } · page: THE target
// page (source 'pick' | 'sc' | 'route') · choice: Search Console's own page ({ action, path, url }) or null ·
// onPick(pick | null): null = back to Search Console's page
export default function SearchMatch({ gsc, domain, connecting = false, justConnected = false, onConnect, onChange = null, page = null, onPick = () => {}, newPath = null, prompt = "" }) {
  const connected = gsc?.connected
  const hasData = connected && gsc.queries.length > 0
  return (
    <section aria-labelledby="co-sc-h" data-search-match style={justConnected && !reducedMotion() ? { animation: 'card-in 360ms cubic-bezier(.2,.8,.2,1) both' } : undefined}>
      <div className={HEAD}>
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h3 id="co-sc-h" className={H}>Search Console for this prompt</h3>
          {connected && (
            <span data-sc-connected className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line px-2.5 text-[12px] leading-4 text-stone-600">
              <Check size={12} aria-hidden className="text-stone-500" />Connected · <span className="font-medium text-stone-900">{domain}</span>
              {onChange && <> · <button type="button" onClick={onChange} className="rounded font-medium text-ink underline decoration-[var(--color-line-strong)] underline-offset-2 outline-none hover:decoration-ink focus-visible:ring-2 focus-visible:ring-focus">Change</button></>}
            </span>
          )}
        </span>
        {connected && (
          <span className={`flex items-center gap-1 ${META}`}>
            Last 8 weeks · {day(gsc.range.startDate)} – {day(gsc.range.endDate)}
            <Tip label="About this data">{gsc.lagNote} Totals run slightly low: Google hides rare queries.</Tip>
          </span>
        )}
      </div>
      {!connected ? <NotConnected gsc={gsc} domain={domain} connecting={connecting} onConnect={onConnect} />
        : !hasData ? <NoData gsc={gsc} page={page} onPick={onPick} />
          : (
            <FlowSection gsc={gsc} page={page} onPick={onPick} prompt={prompt} newPath={gsc.publishOn.action === 'create' ? gsc.publishOn.suggestedPath : newPath} />
          )}
    </section>
  )
}

// one row, a sentence and the action
function NotConnected({ gsc, domain, connecting, onConnect }) {
  const [text, action] = gsc?.reason === 'reconnect' ? ['Search Console needs reconnecting. Reconnect it to rank your pages by real search traffic.', 'Reconnect']
    : gsc?.reason === 'no-domain' ? [`Search Console has no property for ${domain}. Add the site in Search Console, then connect again.`, null]
      : ['Connect Search Console to rank your pages by real search traffic.', 'Connect']
  return (
    <div className="flex min-h-[64px] flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[var(--div)] py-3" data-sc-state={gsc?.reason ?? 'not-connected'}>
      <p className="text-[15px] leading-[22px] text-stone-700">{text}</p>
      {action && (
        <button type="button" onClick={onConnect} disabled={connecting} aria-busy={connecting} className={`${lineBtn} disabled:opacity-60`}>
          {connecting ? 'Connecting…' : action}
        </button>
      )}
    </div>
  )
}

function NoData({ gsc, page, onPick }) {
  const p = gsc.publishOn
  const using = page?.action === 'create' && page.path === p.suggestedPath
  return (
    <div className="flex min-h-[64px] flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[var(--div)] py-3" data-sc-state="no-data">
      <div className="min-w-0">
        <p className="text-[15px] leading-[22px] text-stone-700">Connected. No search data for this prompt’s queries yet.</p>
        <p className={`mt-0.5 ${META}`}>A new page would go at <span className="font-medium text-stone-700">{p.suggestedPath}</span></p>
      </div>
      <UseButton using={using} label="Create this page" onClick={() => onPick(using ? null : { action: 'create', path: p.suggestedPath })} />
    </div>
  )
}

const UseButton = ({ using, label, onClick }) => (
  <button type="button" onClick={onClick} aria-pressed={using} className={lineBtn}>
    {using ? <><Check size={14} aria-hidden />Using this page</> : label}
  </button>
)

// ---- one flow visual (owner, 2026-11-05): the prompt → its matching searches → your pages, then one line: the page
// in use and "Change page". No other text blocks (the Best query / Publish on / Other top queries / Your pages blocks
// are gone). Layout only: the matcher's data as it is (data/gscMatch.js).
//   Left: the prompt (one node). Middle: the matching searches (gsc.queries): the Best query first, then the ones with
//   10+ impressions (the matcher's order), then the low-volume ones; each shows its impressions and match %. Account /
//   local / site and low-volume searches are faint grey with their tag. Right: your pages; the page in use (Workspace
//   `page`: the user's pick ?? Search Console's Publish on ?? the route's) is the top node with a solid border, then
//   the pages the searches land on.
//   Ribbons: prompt → every search (thickness = its impressions) and search → its page (thickness = the impressions that
//   page gets: impressions × topPage.share). The chain into the page in use is ink (by default that's the best chain:
//   prompt → Best query → its page; ink, not indigo: brand colours stay in Share of voice / history / Reports), the
//   rest neutral grey, tagged and low-volume ones faint. Hover / focus a search or a page: its whole chain lights up,
//   the rest dims, and only the numbers show (a page: the impressions it gets from these searches). The ribbons draw in
//   left to right once on load (600ms, ease-out); none with prefers-reduced-motion.
//   Under it: "Using this page: <path> · Change page" (a small menu: your pages, or a new page). The payoff bar and
//   the draft request's target follow.
const FLOW_H = 300
const tagged = (q) => Boolean(q.intent || q.lowVolume)
// the middle column's order: the Best query, then 10+ impressions, then low volume (display only)
const searchOrder = (qs) => {
  const best = qs.filter((q) => q.best)
  const rest = qs.filter((q) => !q.best)
  return [...best, ...rest.filter((q) => !q.lowVolume), ...rest.filter((q) => q.lowVolume)]
}
function FlowSection({ gsc, page, onPick, newPath, prompt }) {
  const sc = gsc.publishOn
  const usingPath = page?.action === 'create' ? page.path : page?.path ?? (sc.action === 'create' ? sc.suggestedPath : sc.path)
  const usingCreate = page ? page.action === 'create' : sc.action === 'create'
  return (
    <div className="pt-5">
      <Flow gsc={gsc} prompt={prompt} usingPath={usingPath} usingCreate={usingCreate} />
      <UsingLine gsc={gsc} usingPath={usingPath} usingCreate={usingCreate} onPick={onPick} newPath={newPath} />
    </div>
  )
}

// the right column's colours, in the owner's order (Share of voice's palette, light / dark steps; no new colours):
// indigo, sky, lavender, pink, soft indigo
const PAGE_COLORS = [0, 2, 4, 6, 3].map((i) => cssColor({ light: BRAND_PALETTE[i], dark: BRAND_PALETTE_DARK[i] }))
const PORT = 8 // a port dot's size; every ribbon starts and ends on one
function Flow({ gsc, prompt, usingPath, usingCreate }) {
  const [ref, width] = useWidth()
  const [hot, setHot] = useState(null) // { kind: 'q' | 'p', key }
  const reduce = reducedMotion()
  const W = Math.max(640, width || 1000)
  const qs = searchOrder(gsc.queries)
  // the right column: the page in use first (outlined in its colour), then the pages the searches land on (5 colours)
  const landing = [...new Set(qs.map((q) => q.topPage.path))].filter((p) => p !== usingPath)
  const pages = [usingPath, ...landing].slice(0, PAGE_COLORS.length)
  const colorOf = (path) => PAGE_COLORS[pages.indexOf(path)] ?? 'var(--color-stone-400)'
  const pageOfQ = (q) => (pages.includes(q.topPage.path) ? q.topPage.path : null)
  // geometry: prompt node | ribbons | searches (a port dot each side) | ribbons | pages
  const P1 = W * 0.17, Q0 = W * 0.33, Q1 = W * 0.58, R0 = W * 0.68
  // the searches' right ports share one column, right after the longest search (measured), never past Q1
  const textRefs = useRef([])
  const [textW, setTextW] = useState(0)
  useLayoutEffect(() => {
    const m = Math.max(0, ...textRefs.current.filter(Boolean).map((el) => el.scrollWidth))
    setTextW((v) => (Math.abs(v - m) > 0.5 ? m : v))
  })
  const QL = Q0 + PORT / 2, QTEXT = QL + PORT / 2 + 8
  const QR = Math.min(Q1, QTEXT + (textW || (Q1 - QTEXT - 12)) + 10)
  const rowY = (i, n) => (i + 0.5) * (FLOW_H / n)
  const into = (q) => Math.round(q.impressions * (q.topPage.share ?? 1))
  const max = Math.max(1, ...qs.map((q) => q.impressions))
  const thick = (v) => Math.max(2, (v / max) * 18)
  const curve = (x0, y0, x1, y1) => { const m = (x0 + x1) / 2; return `M${x0},${y0} C${m},${y0} ${m},${y1} ${x1},${y1}` }
  // the chain in use: the strongest untagged search into the page in use (by default the Best query → Publish on)
  const bestQ = usingCreate ? null : qs.find((q) => pageOfQ(q) === usingPath && !tagged(q))
  const isBest = (q) => q === bestQ
  const lit = (q) => (hot?.kind === 'q' ? hot.key === q.query : hot?.kind === 'p' ? pageOfQ(q) === hot.key : true)
  const litPage = (path) => (hot?.kind === 'p' ? hot.key === path : hot?.kind === 'q' ? qs.some((q) => q.query === hot.key && pageOfQ(q) === path) : true)
  // a chain's look: its landing page's colour; the best one full, the others ~45%, tagged / low-volume ~20% dashed
  // (dark mode: the --flow-* opacities are raised so they read the same); hover: that chain full and +2px, the rest 15%
  const op = (q) => (hot ? (lit(q) ? 1 : 0.15) : isBest(q) ? 1 : tagged(q) ? 'var(--flow-faint)' : 'var(--flow-other)')
  const ribbon = (q, k, part) => ({
    stroke: pageOfQ(q) ? colorOf(pageOfQ(q)) : 'var(--color-stone-400)',
    strokeWidth: thick(part === 'r' ? into(q) : q.impressions) + (hot && lit(q) ? 2 : 0),
    strokeDasharray: tagged(q) && !(hot && lit(q)) ? '6 5' : undefined,
    opacity: op(q),
    transition: 'opacity 150ms ease-out, stroke-width 150ms ease-out, stroke 250ms ease-out',
    // drawn in left to right once (~700ms: the left half, then the right), 60ms per chain
    animation: reduce ? undefined : `co-flow-reveal 350ms ease-out ${k * 60 + (part === 'r' ? 350 : 0)}ms both`,
  })
  const promptY = FLOW_H / 2
  const pageImpr = (path) => qs.filter((q) => pageOfQ(q) === path).reduce((n, q) => n + into(q), 0)
  const Dot = ({ x, y, color, o = 1 }) => <circle cx={x} cy={y} r={PORT / 2} fill={color} style={{ opacity: o, transition: 'opacity 150ms ease-out' }} />
  const bestI = bestQ ? qs.indexOf(bestQ) : -1
  return (
    <div ref={ref} className="relative" style={{ height: FLOW_H }} data-sc-flow onMouseLeave={() => setHot(null)}>
      <svg width={W} height={FLOW_H} className="absolute inset-0 overflow-visible" aria-hidden fill="none">
        {qs.map((q, i) => <path key={`l${q.query}`} data-ribbon={`prompt|${q.query}`} data-chain={isBest(q) || undefined} d={curve(P1, promptY, QL, rowY(i, qs.length))} style={ribbon(q, i, 'l')} />)}
        {qs.map((q, i) => (pageOfQ(q)
          ? <path key={`r${q.query}`} data-ribbon={`${q.query}|${pageOfQ(q)}`} data-chain={isBest(q) || undefined} d={curve(QR, rowY(i, qs.length), R0, rowY(pages.indexOf(pageOfQ(q)), pages.length))} style={ribbon(q, i, 'r')} />
          : null))}
        {/* after the draw-in, a soft light travels along the best chain every ~3s (none with reduced motion) */}
        {!reduce && bestQ && !hot && <>
          <path d={curve(P1, promptY, QL, rowY(bestI, qs.length))} pathLength={100} className="co-flow-pulse" style={{ stroke: 'var(--color-surface)', strokeWidth: thick(bestQ.impressions) * 0.6, animationDelay: '1.1s' }} />
          <path d={curve(QR, rowY(bestI, qs.length), R0, rowY(0, pages.length))} pathLength={100} className="co-flow-pulse" style={{ stroke: 'var(--color-surface)', strokeWidth: thick(into(bestQ)) * 0.6, animationDelay: '1.6s' }} />
        </>}
        {/* the port dots: the prompt's right edge, each search's two sides, each page's left edge */}
        <Dot x={P1} y={promptY} color={bestQ ? colorOf(usingPath) : 'var(--color-stone-400)'} />
        {qs.map((q, i) => {
          const c = pageOfQ(q) ? colorOf(pageOfQ(q)) : 'var(--color-stone-400)'
          const o = hot && !lit(q) ? 0.15 : 1
          return <g key={`d${q.query}`}><Dot x={QL} y={rowY(i, qs.length)} color={c} o={o} /><Dot x={QR} y={rowY(i, qs.length)} color={c} o={o} /></g>
        })}
        {pages.map((path, i) => <Dot key={`p${path}`} x={R0} y={rowY(i, pages.length)} color={colorOf(path)} o={hot && !litPage(path) ? 0.15 : 1} />)}
      </svg>
      {/* the prompt */}
      <div className="absolute left-0 flex items-center rounded-lg border border-line bg-surface px-3 py-2.5" style={{ top: promptY - 32, width: P1, minHeight: 64 }} data-flow-prompt>
        <span className="line-clamp-3 text-[14px] leading-5 font-semibold text-stone-900">{prompt}</span>
      </div>
      {/* the searches: text between the two port dots */}
      <ul aria-label="Matching searches" className="absolute top-0" style={{ left: QTEXT, width: Q1 - QTEXT }}>
        {qs.map((q, i) => (
          <li key={q.query} tabIndex={0} data-flow-query={q.query} data-intent={q.intent ?? undefined} data-low-volume={q.lowVolume || undefined} data-best={q.best || undefined}
            onMouseEnter={() => setHot({ kind: 'q', key: q.query })} onFocus={() => setHot({ kind: 'q', key: q.query })} onBlur={() => setHot(null)}
            className="absolute left-0 flex flex-col justify-center rounded-md outline-none transition-opacity duration-150 focus-visible:ring-2 focus-visible:ring-focus"
            style={{ top: rowY(i, qs.length) - 21, height: 42, maxWidth: Q1 - QTEXT - 14, opacity: hot && !lit(q) ? 0.15 : 1, animation: reduce ? undefined : `fade-in 240ms ease-out ${i * 40}ms backwards` }}>
            <span ref={(el) => { textRefs.current[i] = el }} className="flex min-w-0 items-center gap-1.5">
              <span title={q.query} className={`truncate text-[14px] leading-5 ${tagged(q) ? 'text-stone-500' : isBest(q) || q.best ? 'font-semibold text-stone-900' : 'font-medium text-stone-900'}`}>{q.query}</span>
              {q.intent && <Tag intent={q.intent} />}
              {q.lowVolume && <Tag intent="low volume" />}
            </span>
            <span className="text-[12px] leading-4 tabular-nums text-stone-500">{num(q.impressions)} impr · {q.adjusted}% match</span>
          </li>
        ))}
      </ul>
      {/* your pages: a 3px left border in each page's colour; the page in use on top, outlined in its colour */}
      <ul aria-label="Your pages" className="absolute right-0 top-0" style={{ left: R0 + PORT / 2 }}>
        {pages.map((path, i) => {
          const top = i === 0
          return (
            <li key={path} tabIndex={0} data-flow-page={path} data-using={top || undefined}
              onMouseEnter={() => setHot({ kind: 'p', key: path })} onFocus={() => setHot({ kind: 'p', key: path })} onBlur={() => setHot(null)}
              className="absolute left-0 right-0 flex flex-col justify-center rounded-r-lg bg-surface py-1 pl-2.5 pr-2.5 outline-none transition-opacity duration-150 focus-visible:ring-2 focus-visible:ring-focus"
              style={{ top: rowY(i, pages.length) - 21, height: 42, borderLeft: `3px solid ${colorOf(path)}`, boxShadow: top ? `inset 0 0 0 1.5px ${colorOf(path)}` : undefined, opacity: hot && !litPage(path) ? 0.15 : 1, animation: reduce ? undefined : `fade-in 240ms ease-out ${120 + i * 40}ms backwards` }}>
              <MidText text={path} className={`text-[14px] leading-5 ${top ? 'font-semibold' : 'font-medium'} text-stone-900`} />
              <span className="text-[12px] leading-4 tabular-nums text-stone-500">
                {top && usingCreate ? 'New page' : `${num(pageImpr(path))} impr`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// one line under the visual: the page in use and "Change page" (a small menu: your pages, or a new page)
function UsingLine({ gsc, usingPath, usingCreate, onPick, newPath }) {
  const [open, setOpen] = useState(false)
  const pages = gsc.pages.slice(0, 5)
  const options = [...pages.map((p) => ({ key: p.path, label: p.path, pick: { action: 'update', path: p.path, url: p.url } })), ...(newPath ? [{ key: 'create', label: `Create a new page · ${newPath}`, pick: { action: 'create', path: newPath } }] : [])]
  const choose = (o) => { onPick(o.pick); setOpen(false) }
  const [rowRef, rowW] = useWidth()
  const labelRef = useRef(null)
  const changeRef = useRef(null)
  const [pathW, setPathW] = useState(undefined)
  useLayoutEffect(() => {
    const row = rowW, label = labelRef.current?.offsetWidth ?? 0, change = changeRef.current?.offsetWidth ?? 0
    if (!row) return
    measureCtx ??= document.createElement('canvas').getContext('2d')
    // the page's own font stack (the label's), so the estimate matches what MidText measures
    const fam = labelRef.current ? getComputedStyle(labelRef.current).fontFamily : 'sans-serif'
    measureCtx.font = `600 14px ${fam}`
    const full = Math.ceil(measureCtx.measureText(usingPath).width) + 6
    setPathW(Math.max(40, Math.min(full, row - label - change - 40)))
  }, [rowW, usingPath])
  return (
    <div ref={rowRef} className="relative mt-3 flex min-w-0 items-center gap-2 border-t border-line pt-3 text-[14px] leading-5" data-sc-using={usingCreate ? 'create' : usingPath}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
      <span ref={labelRef} className="shrink-0 text-stone-500">Using this page:</span>
      {/* a fixed width (the full path, or the room the line has), so it only truncates in the middle when it overflows */}
      <span className="min-w-0 shrink-0" style={{ width: pathW }}><MidText text={usingPath} className="w-full font-semibold text-stone-900" /></span>
      <span aria-hidden className="text-stone-400">·</span>
      <button ref={changeRef} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className="shrink-0 rounded font-medium text-ink underline decoration-[var(--color-line-strong)] underline-offset-[3px] outline-none hover:decoration-ink focus-visible:ring-2 focus-visible:ring-focus">Change page</button>
      {open && (
        <>
          <span className="fixed inset-0 z-20" aria-hidden onClick={() => setOpen(false)} />
          <ul role="menu" aria-label="Choose the page" className="absolute left-0 top-full z-30 mt-1 w-[min(420px,100%)] rounded-lg border border-line bg-raised p-1 shadow-lg motion-safe:animate-[fade-in_120ms_ease-out]">
            {options.map((o) => {
              const on = o.key === 'create' ? usingCreate : !usingCreate && o.key === usingPath
              return (
                <li key={o.key} role="none">
                  <button type="button" role="menuitemradio" aria-checked={on} data-path={o.key} onClick={() => choose(o)}
                    className={`flex w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-left text-[14px] leading-5 outline-none hover:bg-tint focus-visible:bg-tint ${on ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>
                    <span className="grid w-4 shrink-0 place-items-center" aria-hidden>{on && <Check size={14} />}</span>
                    {o.key === 'create' ? <span className="flex min-w-0 items-center gap-1.5"><Plus size={13} aria-hidden className="shrink-0 text-stone-500" /><MidText text={o.label} className="min-w-0" /></span> : <MidText text={o.label} className="min-w-0" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
