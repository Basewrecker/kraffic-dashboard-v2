// Target page (v1): "Search Console for this prompt", between the rank ladder and the format matrix. The app's GET
// …/gsc-match response (data/gscMatch.js, lib/gsc-match.js analyzePrompt), one section under the same header style as
// the ladder and the matrix (18/600 over a --line-strong rule, a muted meta right with the range and an ⓘ).
//   One table (owner, 2026-11-05; see QueriesTable): Search query | Impressions | Match | Lands on, and one line under
//   it: "Publishing on <path> · Change page". Nothing else in the section.
//   States: not connected (Connect) · reconnect (Reconnect) · no property for the domain · connected with no data yet
//   (the new page it would suggest). The ladder and the matrix render in every state.
import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Info, Loader2, Plus } from 'lucide-react'
import { GoogleIcon, PlatformIcon } from '../../../components/dashboard/icons'
import { ENGINE_NAME, engineIcon } from '../../../data/contentOpportunities'
import { lineBtn } from '../../../components/tool/ToolPage'
import { Seg } from '../../../components/ui/motion'
import { LogoPlate, MidText, midTruncate } from '../parts'

const nf = new Intl.NumberFormat('en-US')
const num = (n) => nf.format(n)
const H = 'text-[20px] leading-[28px] font-semibold text-stone-900'
const HEAD = 'flex items-end justify-between gap-3 border-b border-line-strong pb-2'
const META = 'text-[14px] leading-5 font-medium text-stone-600'
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
export default function SearchMatch({ gsc, domain, connecting = false, justConnected = false, onConnect, onChange = null, page = null, onPick = () => {}, newPath = null, prompt = "", enginesFor = () => ({ engines: [], unknown: false }), titleFor = () => null }) {
  const connected = gsc?.connected
  const hasData = connected && gsc.queries.length > 0
  return (
    <section aria-labelledby="co-sc-h" data-search-match style={justConnected && !reducedMotion() ? { animation: 'card-in 360ms cubic-bezier(.2,.8,.2,1) both' } : undefined}>
      {hasData ? null : <div className={HEAD}>
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
      </div>}
      {!connected ? <NotConnected gsc={gsc} domain={domain} connecting={connecting} onConnect={onConnect} />
        : !hasData ? <NoData gsc={gsc} page={page} onPick={onPick} />
          : (
            <FlowSection gsc={gsc} page={page} onPick={onPick} prompt={prompt} newPath={gsc.publishOn.action === 'create' ? gsc.publishOn.suggestedPath : newPath} enginesFor={enginesFor} titleFor={titleFor} domain={domain} onChange={onChange} />
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

// ---- the section's body: the queries table, then "Publishing on <path> · Change page" (the page in use: Workspace
// `page`: the user's pick ?? Search Console's Publish on ?? the route's; the payoff bar and the request follow it)
function FlowSection({ gsc, page, onPick, newPath, prompt, enginesFor, titleFor, domain, onChange }) {
  const sc = gsc.publishOn
  const usingPath = page?.action === 'create' ? page.path : page?.path ?? (sc.action === 'create' ? sc.suggestedPath : sc.path)
  const usingCreate = page ? page.action === 'create' : sc.action === 'create'
  return (
    <div>
      <QueriesList gsc={gsc} usingPath={usingPath} usingCreate={usingCreate} enginesFor={enginesFor} titleFor={titleFor} domain={domain} onChange={onChange} prompt={prompt} />
      <UsingLine gsc={gsc} usingPath={usingPath} usingCreate={usingCreate} onPick={onPick} newPath={newPath} />
    </div>
  )
}

// ---- the queries list (owner, 2026-11-05), styled like Sentiment's "Pages on <date>" (its header, segmented tabs,
// 52px rows, Download CSV, "Show all N →"). Tabs filter by landing page: All, then the page being published on (a small
// accent dot), then the others by how many queries land there; low-volume / local / site rows count in their page's
// tab. Rows: the Google mark in a 32px circle · the query (15/600, truncated) · the page it lands on (muted, ↗ opens
// the live page) · impressions · a coloured verdict: "Best match" green (the Best row), "Strong · 82%" near-black
// (≥ 70), "Partial · 46%" muted (40–69), "Weak · 23%" red (< 40). Tagged / low-volume rows: muted with their tag. Rows
// landing on the publishing page: a 2px accent bar on the left. Hover: the row tints (150ms), ↗ nudges up-right, the
// impressions cross-fade into the query's 8-week sparkline (60×20, drawn in ~400ms, the last point a dot), and the
// other rows landing on the same page tint faintly. Load: rows fade up 6px, 40ms apart, once. Reduced motion: no
// movement (the sparkline shows statically on hover).
const LIST_ROWS = 6
const Q_GRID = 'grid grid-cols-[32px_minmax(0,1fr)_128px_minmax(96px,auto)_minmax(0,220px)_76px_136px] items-center gap-x-3'
const verdict = (q) => (q.best ? { text: 'Best match', cls: 'font-semibold text-[var(--rep-up-fg)]' }
  : q.adjusted >= 70 ? { text: `Strong · ${q.adjusted}%`, cls: 'text-stone-900' }
    : q.adjusted >= 40 ? { text: `Partial · ${q.adjusted}%`, cls: 'text-stone-500' }
      : { text: `Weak · ${q.adjusted}%`, cls: 'font-semibold text-negative' })
// a query's 8 weeks of impressions (the sample: derived from its total, steady with a little wobble; the app needs
// weekly impressions per query from Search Console for this)
const weeksOf = (q) => { const base = q.impressions / 8; let h = 0; for (const c of q.query) h = (h * 31 + c.charCodeAt(0)) >>> 0; return Array.from({ length: 8 }, (_, i) => Math.max(0, Math.round(base * (0.75 + ((h >> (i * 3)) % 9) / 16 + i * 0.03)))) }
const orderRows = (qs) => { const best = qs.filter((q) => q.best), rest = qs.filter((q) => !q.best); const by = (a, b) => b.impressions - a.impressions; return [...best, ...rest.filter((q) => !q.lowVolume).sort(by), ...rest.filter((q) => q.lowVolume).sort(by)] }
// the header, one block with the tabs: just "Prompts n" (owner, 2026-11-05: no property / range / Change line under it).
// No divider: header, tabs and rows read as one block.
function QueriesHeader({ count }) {
  return (
    <div>
      <h3 id="co-sc-h" className="flex items-baseline gap-2 text-[20px] leading-[28px] font-semibold"><span className="text-ink">Prompts</span><span className="tabular-nums text-stone-500">{count}</span></h3>
    </div>
  )
}
function downloadQueries(list, prompt) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [['query', 'impressions', 'clicks', 'position', 'match', 'verdict', 'tag', 'lands on'].join(',')]
  for (const q of list) lines.push([q.query, q.impressions, q.clicks, q.position, q.adjusted, verdict(q).text, [q.intent, q.lowVolume ? 'low volume' : ''].filter(Boolean).join(' '), q.topPage?.url].map(esc).join(','))
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
  a.download = `search-queries-${(prompt || 'prompt').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}.csv`
  a.click()
}
function QueriesList({ gsc, usingPath, usingCreate, enginesFor, titleFor, domain, onChange, prompt }) {
  const reduce = reducedMotion()
  const rows = orderRows(gsc.queries)
  const counts = rows.reduce((m, q) => m.set(q.topPage?.path, (m.get(q.topPage?.path) ?? 0) + 1), new Map())
  const pub = !usingCreate && counts.has(usingPath) ? usingPath : null
  const others = [...counts.keys()].filter((k) => k && k !== pub).sort((a, b) => counts.get(b) - counts.get(a))
  const [tab, setTab] = useState('all')
  const [all, setAll] = useState(false)
  const [hot, setHot] = useState(null) // the hovered row's query
  const [tabHot, setTabHot] = useState(null) // the hovered page tab's path: its card shows, its rows tint
  const short = (path) => midTruncate(path, 22)
  const pageTab = (k, dot) => ({ value: k, label: (
    <span className="relative inline-flex items-center gap-1.5" onMouseEnter={() => setTabHot(k)} onMouseLeave={() => setTabHot(null)}>
<span className="whitespace-nowrap">{short(k)}</span><span className="shrink-0 font-medium tabular-nums">{counts.get(k)}</span>{dot && <span className="shrink-0 whitespace-nowrap font-medium text-stone-500">· Publishing</span>}
      <TabCard show={tabHot === k} path={k} url={rows.find((q) => q.topPage?.path === k)?.topPage?.url} title={titleFor(k)} domain={domain}
        impressions={rows.filter((q) => q.topPage?.path === k).reduce((n, q) => n + q.impressions, 0)} e={enginesFor(k)} />
    </span>
  ) })
  const options = [{ value: 'all', label: <span className="inline-flex items-center gap-1.5">All<span className="font-medium tabular-nums">{rows.length}</span></span> }, ...(pub ? [pageTab(pub, true)] : []), ...others.map((k) => pageTab(k, false))]
  const shownAll = tab === 'all' ? rows : rows.filter((q) => q.topPage?.path === tab)
  const shown = all ? shownAll : shownAll.slice(0, LIST_ROWS)
  const hotPage = tabHot ?? (hot ? rows.find((q) => q.query === hot)?.topPage?.path : null)
  return (
    <div data-sc-queries>
      <QueriesHeader count={rows.length} />
      {/* the tabs and, right-aligned on the same row, "↓ CSV" styled as part of the tab bar (its height and radius, a
          light outline): the selected tab's rows. Its right edge is the table's. */}
      <div className="relative z-20 mt-2 flex items-center justify-between gap-3">
        <Seg label="Landing page" value={tab} onChange={(v) => { setTab(v); setAll(false) }} className="gap-1 [&>button]:px-3.5 [&>button]:text-[14px] [&>button]:font-semibold" options={options} />
        <button type="button" onClick={() => downloadQueries(shownAll, prompt)} title="Download CSV" aria-label="Download CSV"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-[14px] leading-5 font-semibold text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
          <ArrowDown size={14} aria-hidden />CSV
        </button>
      </div>
      {/* the column labels (12/600, muted), on the rows' grid; a bottom border as the winners table's header */}
      <div aria-hidden className={`${Q_GRID} mt-3 border-b border-[var(--div)] pb-2 pl-1 text-[12px] leading-4 font-semibold text-stone-500`} data-sc-head>
        <span /><span /><span>Trend</span><span>Google</span><span>Lands on</span><span className="text-right">Impr.</span><span className="text-right">Match</span>
      </div>
      <ul onMouseLeave={() => setHot(null)}>
        {shown.map((q, i) => {
          const v = verdict(q)
          const muted = Boolean(q.intent || q.lowVolume)
          const here = pub && q.topPage?.path === pub
          const on = hot === q.query
          const sibling = !on && hotPage && q.topPage?.path === hotPage
          return (
            <li key={q.query} data-query={q.query} data-best={q.best || undefined} data-intent={q.intent ?? undefined} data-low-volume={q.lowVolume || undefined} data-publishing={here || undefined}
              onMouseEnter={() => setHot(q.query)}
              className={`group/q relative ${Q_GRID} h-[52px] border-b border-[var(--div)] pl-1 transition-colors duration-150 ${on ? 'bg-[var(--row-hover,var(--tint))]' : sibling ? 'bg-[color-mix(in_srgb,var(--tint)_45%,transparent)]' : ''}`}
              style={reduce ? undefined : { animation: `co-row-up 260ms ease-out ${i * 40}ms both` }}>
              <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface"><GoogleIcon size={16} /></span>
              <span className="flex min-w-0 items-center gap-1.5">
                <span title={q.query} className={`truncate text-[16px] leading-6 ${muted ? 'font-medium text-stone-500' : 'font-semibold text-stone-900'}`}>{q.query}</span>
                {q.intent && <Tag intent={q.intent} />}
                {q.lowVolume && <Tag intent="low volume" />}
              </span>
              <Trend values={weeksOf(q)} tone={q.best ? 'best' : q.adjusted < 40 ? 'weak' : null} hot={on} />
              <CitedBy e={enginesFor(q.topPage?.path)} position={q.position} />
              <span className="min-w-0 text-[14px] leading-5 font-medium">
                {q.topPage?.url
                  ? <a href={q.topPage.url} target="_blank" rel="noopener noreferrer" onFocus={() => setHot(q.query)} className="group/l flex min-w-0 items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-focus" aria-label={`${q.topPage.path} (opens in a new tab)`}>
                      <LandingPath path={q.topPage.path} />
                      <ArrowUpRight size={12} aria-hidden className={`ml-auto shrink-0 text-stone-500 transition-transform duration-150 ${reduce ? '' : 'group-hover/l:-translate-y-0.5 group-hover/l:translate-x-0.5'}`} />
                    </a>
                  : <LandingPath path={q.topPage?.path ?? ''} />}
              </span>
              <span className="text-right text-[14px] leading-5 font-semibold tabular-nums text-stone-900">{num(q.impressions)}</span>
              <span className={`text-right text-[14px] leading-5 font-semibold tabular-nums ${muted && !q.best && q.adjusted >= 40 ? 'text-stone-500' : v.cls}`}>{v.text}</span>
            </li>
          )
        })}
      </ul>
      {shownAll.length > LIST_ROWS && (
        <button type="button" onClick={() => setAll((x) => !x)}
          className="-ml-2 mt-2 inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-[14px] leading-5 font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
          {all ? 'Show fewer' : <>Show all {shownAll.length}<ArrowRight size={14} aria-hidden /></>}
        </button>
      )}
    </div>
  )
}
// "Cited by": the AI engines (in colour, 18px) that already cite the landing page (real data only: nothing when none
// do), then the query's average Google position as a small neutral chip ("#8"; the column header says Google)
function CitedBy({ e, position }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5" data-cited-by>
      {e.engines.map((id) => <span key={id} title={`Cited by ${ENGINE_NAME[id]}`} className="flex"><PlatformIcon id={engineIcon(id)} size={18} /></span>)}
      {position != null && <span title={`Average Google position ${Math.round(position)}`} data-gpos className="whitespace-nowrap rounded-[12px] bg-tint px-2 py-0.5 text-[13px] leading-[18px] font-semibold tabular-nums text-stone-600">#{Math.round(position)}</span>}
    </span>
  )
}
// a landing page as a link (owner, 2026-11-05): the folder ("/blog/") muted, the slug secondary and truncated in the
// middle only; underline on the link's hover. An invisible copy of the slug keeps its natural width, so the row gives
// it the room it has; the shown text is fitted to that room.
function LandingPath({ path }) {
  const cut = path.lastIndexOf('/', path.length - 2) + 1
  const folder = path.slice(0, cut), slug = path.slice(cut)
  return (
    <span className="flex min-w-0 flex-1 items-center whitespace-nowrap" title={path} data-landing>
      <span className="shrink-0 text-stone-500 underline-offset-2 group-hover/l:underline">{folder}</span>
      <FitMid text={slug} className="font-medium text-stone-700" inner="underline-offset-2 group-hover/l:underline" />
    </span>
  )
}
// text that is its own rendered width and shrinks only by truncating its middle: an invisible copy holds the natural
// width (so a flex row never leaves a gap after it), the shown text is fitted to the room it gets. className: the
// font and colour (measured from here); inner: classes for the shown text (an underline doesn't reach it otherwise).
function FitMid({ text, className = '', inner = '' }) {
  const slug = text
  const ref = useRef(null)
  const [shown, setShown] = useState(slug)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const fit = () => {
      const w = el.clientWidth
      if (!w) return
      slugCtx ??= document.createElement('canvas').getContext('2d')
      const cs = getComputedStyle(el)
      slugCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      const width = (t) => slugCtx.measureText(t).width
      if (width(slug) <= w) { setShown(slug); return }
      const mid = (n) => `${slug.slice(0, Math.ceil(n / 2))}…${slug.slice(slug.length - Math.floor(n / 2))}`
      let lo = 2, hi = slug.length - 1
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (width(mid(m)) <= w) lo = m; else hi = m - 1 }
      setShown(mid(lo))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    document.fonts?.ready.then(fit)
    return () => ro.disconnect()
  }, [slug])
  return (
    <span ref={ref} className={`relative min-w-0 overflow-hidden whitespace-nowrap ${className}`}>
      <span aria-hidden className="invisible">{slug}</span>
      <span className={`absolute inset-0 ${inner}`}>{shown}</span>
    </span>
  )
}
let slugCtx = null
// a page tab's card: drops 4px under the tab (fade + slide, 150ms ease-out; none with reduced motion): the full path,
// the page's title, the site logo, the impressions from these queries, the engines that cite it, and Open ↗
function TabCard({ show, path, url, title, domain, impressions, e }) {
  const still = reducedMotion()
  return (
    <span role="tooltip" aria-hidden={!show} className="pointer-events-auto absolute left-0 top-full z-30 mt-2 w-[300px] rounded-lg border border-line bg-raised p-3 text-left shadow-lg"
      style={{ opacity: show ? 1 : 0, transform: show || still ? 'none' : 'translateY(-4px)', visibility: show ? 'visible' : 'hidden', transition: still ? 'none' : 'opacity 150ms ease-out, transform 150ms ease-out, visibility 150ms' }}>
      <span className="flex items-start gap-2.5">
        <LogoPlate domain={domain} size={24} logoClass="h-4 w-4" />
        <span className="min-w-0 flex-1">
          <span className="block break-all text-[13px] leading-[18px] font-semibold text-stone-900">{path}</span>
          {title && <span className="mt-0.5 block text-[13px] leading-[18px] text-stone-700">{title}</span>}
        </span>
      </span>
      <span className="mt-2 flex items-center justify-between gap-3 text-[12px] leading-4 text-stone-500">
        <span className="flex items-center gap-2"><span className="tabular-nums">{num(impressions)} impressions</span>
          {e.engines.length > 0 && <span className="flex items-center gap-1">{e.engines.map((id) => <PlatformIcon key={id} id={engineIcon(id)} size={14} />)}</span>}
        </span>
        {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 rounded font-medium text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Open<ArrowUpRight size={12} aria-hidden /></a>}
      </span>
    </span>
  )
}

// the trend, right after the query (owner, 2026-11-05): an always-visible 8-week impressions sparkline (72×20, 1.5px,
// the text colour at 60%, the last point a dot), then the change, last 4 weeks vs the 4 before: "+18%" bold green,
// "−6%" bold red, "flat" muted under 2% either way. Hover: the line goes to the full text colour and a small tooltip
// lists the weekly numbers.
const changeOf = (v) => { const a = v.slice(0, 4).reduce((n, x) => n + x, 0), b = v.slice(4).reduce((n, x) => n + x, 0); return a ? Math.round(((b - a) / a) * 100) : null }
// tone: 'best' (green, as "Best match"), 'weak' (red, as "Weak"), else neutral (the text colour at 60%). hot: the row
// is hovered: the line redraws left to right (~500ms ease-out), a soft area fill (the line colour at ~12%) fades in, the
// end dot scales 1 → 1.4 → 1 once; mouse-out: the fill fades away, the line stays. None with reduced motion. The weekly
// numbers' tooltip shows with the pointer on the line itself.
function Trend({ values, tone = null, hot = false }) {
  const lo = Math.min(...values), hi = Math.max(...values)
  const y = (v) => (hi === lo ? 10 : 17 - ((v - lo) / (hi - lo)) * 14)
  const xy = values.map((v, i) => [(i * 72) / (values.length - 1), y(v)])
  const pts = xy.map(([x, yy]) => `${x},${yy.toFixed(1)}`).join(' ')
  const area = `M0,20 L${xy.map(([x, yy]) => `${x},${yy.toFixed(1)}`).join(' L')} L72,20 Z`
  const d = changeOf(values)
  const still = reducedMotion()
  const color = tone === 'best' ? 'var(--rep-up-fg)' : tone === 'weak' ? 'var(--negative)' : 'var(--color-stone-900)'
  const op = tone ? 1 : 0.6
  return (
    <span className="relative flex items-center gap-2" data-trend data-tone={tone ?? undefined}>
      <span className="group/t relative flex">
        <svg width="72" height="20" viewBox="0 0 72 20" className="shrink-0 overflow-visible" role="img" aria-label={`Weekly impressions: ${values.map(num).join(', ')}`}>
          <path d={area} fill={color} style={{ opacity: hot ? 0.12 : 0, transition: still ? 'none' : 'opacity 250ms ease-out' }} />
          <polyline key={hot && !still ? 'redraw' : 'still'} points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" pathLength="1"
            style={{ opacity: hot ? 1 : op, transition: 'opacity 150ms ease-out', ...(hot && !still ? { strokeDasharray: 1, animation: 'co-line-draw 500ms ease-out both' } : {}) }} />
          <circle key={hot && !still ? 'pulse' : 'dot'} cx="72" cy={xy.at(-1)[1]} r="2" fill={color}
            style={{ opacity: hot ? 1 : op, transformOrigin: '72px ' + xy.at(-1)[1] + 'px', ...(hot && !still ? { animation: 'co-dot-pulse 420ms ease-out 380ms both' } : {}) }} />
        </svg>
        <span role="tooltip" className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden whitespace-nowrap rounded-md border border-line bg-raised px-2 py-1 text-[11px] leading-4 tabular-nums text-stone-700 shadow-md group-hover/t:block">
          {values.map(num).join(' · ')}
        </span>
      </span>
      <span className={`whitespace-nowrap text-[14px] leading-5 font-semibold tabular-nums ${d == null || Math.abs(d) < 2 ? 'text-stone-500' : d > 0 ? 'text-[var(--rep-up-fg)]' : 'text-negative'}`}>
        {d == null || Math.abs(d) < 2 ? 'flat' : `${d > 0 ? '+' : '−'}${Math.abs(d)}%`}
      </span>
    </span>
  )
}

// one line under the table: "Publishing on <path> · Change page" (a small menu: your pages, or a new page)
function UsingLine({ gsc, usingPath, usingCreate, onPick, newPath }) {
  const [open, setOpen] = useState(false)
  const pages = gsc.pages.slice(0, 5)
  const options = [...pages.map((p) => ({ key: p.path, label: p.path, pick: { action: 'update', path: p.path, url: p.url } })), ...(newPath ? [{ key: 'create', label: `Create a new page · ${newPath}`, pick: { action: 'create', path: newPath } }] : [])]
  const choose = (o) => { onPick(o.pick); setOpen(false) }
  const rowRef = useRef(null)
  const labelRef = useRef(null)
  const changeRef = useRef(null)
  return (
    <div ref={rowRef} className="relative mt-3 flex min-w-0 items-center gap-1.5 border-t border-line pt-3 text-[14px] leading-5" data-sc-using={usingCreate ? 'create' : usingPath}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
      <span ref={labelRef} className="shrink-0 text-stone-500">Publishing on</span>
      {/* its own rendered width (no measured box: that ran before the font loaded and left a gap before "·"); it
          truncates in the middle only when the line overflows */}
      <span title={usingPath} className="flex min-w-0"><FitMid text={usingPath} className="font-semibold text-stone-900" /></span>
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
