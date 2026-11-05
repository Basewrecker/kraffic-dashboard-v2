// Target page (v1): "Search Console for this prompt", between the rank ladder and the format matrix. The app's GET
// …/gsc-match response (data/gscMatch.js, lib/gsc-match.js analyzePrompt), one section under the same header style as
// the ladder and the matrix (18/600 over a --line-strong rule, a muted meta right with the range and an ⓘ).
//   One table (owner, 2026-11-05; see QueriesTable): Search query | Impressions | Match | Lands on, and one line under
//   it: "Publishing on <path> · Change page". Nothing else in the section.
//   States: not connected (Connect) · reconnect (Reconnect) · no property for the domain · connected with no data yet
//   (the new page it would suggest). The ladder and the matrix render in every state.
import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Info, Loader2, Plus } from 'lucide-react'
import { GoogleIcon } from '../../../components/dashboard/icons'
import { lineBtn } from '../../../components/tool/ToolPage'
import { Seg, useWidth } from '../../../components/ui/motion'
import { MidText, midTruncate } from '../parts'
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
      {hasData ? <QueriesHeader gsc={gsc} domain={domain} onChange={onChange} csv={() => downloadQueries(gsc, prompt)} /> : <div className={HEAD}>
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

// ---- the section's body: the queries table, then "Publishing on <path> · Change page" (the page in use: Workspace
// `page`: the user's pick ?? Search Console's Publish on ?? the route's; the payoff bar and the request follow it)
function FlowSection({ gsc, page, onPick, newPath, prompt }) {
  const sc = gsc.publishOn
  const usingPath = page?.action === 'create' ? page.path : page?.path ?? (sc.action === 'create' ? sc.suggestedPath : sc.path)
  const usingCreate = page ? page.action === 'create' : sc.action === 'create'
  return (
    <div className="pt-5">
      <QueriesList gsc={gsc} usingPath={usingPath} usingCreate={usingCreate} />
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
const Q_GRID = 'grid grid-cols-[32px_minmax(0,1fr)_minmax(0,220px)_76px_136px] items-center gap-x-3'
const verdict = (q) => (q.best ? { text: 'Best match', cls: 'font-semibold text-[var(--rep-up-fg)]' }
  : q.adjusted >= 70 ? { text: `Strong · ${q.adjusted}%`, cls: 'font-medium text-stone-900' }
    : q.adjusted >= 40 ? { text: `Partial · ${q.adjusted}%`, cls: 'text-stone-500' }
      : { text: `Weak · ${q.adjusted}%`, cls: 'font-medium text-negative' })
// a query's 8 weeks of impressions (the sample: derived from its total, steady with a little wobble; the app needs
// weekly impressions per query from Search Console for this)
const weeksOf = (q) => { const base = q.impressions / 8; let h = 0; for (const c of q.query) h = (h * 31 + c.charCodeAt(0)) >>> 0; return Array.from({ length: 8 }, (_, i) => Math.max(0, Math.round(base * (0.75 + ((h >> (i * 3)) % 9) / 16 + i * 0.03)))) }
const orderRows = (qs) => { const best = qs.filter((q) => q.best), rest = qs.filter((q) => !q.best); const by = (a, b) => b.impressions - a.impressions; return [...best, ...rest.filter((q) => !q.lowVolume).sort(by), ...rest.filter((q) => q.lowVolume).sort(by)] }
function QueriesHeader({ gsc, domain, onChange, csv }) {
  return (
    <div>
      <div className="flex h-11 items-end justify-between gap-3 border-b border-line pb-2">
        <h3 id="co-sc-h" className="flex items-baseline gap-2 text-[15px] leading-[22px] font-semibold"><span className="text-ink">Search queries</span><span className="tabular-nums text-stone-500">{gsc.queries.length}</span></h3>
        <span className="-mb-1.5 flex shrink-0 items-center gap-2">
          <span data-sc-connected className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line px-2.5 text-[12px] leading-4 text-stone-600">
            <Check size={12} aria-hidden className="text-stone-500" />Connected · <span className="font-medium text-stone-900">{domain}</span>
            {onChange && <> · <button type="button" onClick={onChange} className="rounded font-medium text-ink underline decoration-[var(--color-line-strong)] underline-offset-2 outline-none hover:decoration-ink focus-visible:ring-2 focus-visible:ring-focus">Change</button></>}
          </span>
          <button type="button" onClick={csv} className="-mr-2 inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[14px] leading-5 font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Download CSV<ArrowDown size={14} aria-hidden /></button>
        </span>
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-[12px] leading-4 text-stone-500">
        Last 8 weeks · {day(gsc.range.startDate)} – {day(gsc.range.endDate)}
        <Tip label="About this data">{gsc.lagNote} Totals run slightly low: Google hides rare queries.</Tip>
      </p>
    </div>
  )
}
function downloadQueries(gsc, prompt) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [['query', 'impressions', 'clicks', 'position', 'match', 'verdict', 'tag', 'lands on'].join(',')]
  for (const q of orderRows(gsc.queries)) lines.push([q.query, q.impressions, q.clicks, q.position, q.adjusted, verdict(q).text, [q.intent, q.lowVolume ? 'low volume' : ''].filter(Boolean).join(' '), q.topPage?.url].map(esc).join(','))
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
  a.download = `search-queries-${(prompt || 'prompt').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}.csv`
  a.click()
}
function QueriesList({ gsc, usingPath, usingCreate }) {
  const reduce = reducedMotion()
  const rows = orderRows(gsc.queries)
  const counts = rows.reduce((m, q) => m.set(q.topPage?.path, (m.get(q.topPage?.path) ?? 0) + 1), new Map())
  const pub = !usingCreate && counts.has(usingPath) ? usingPath : null
  const others = [...counts.keys()].filter((k) => k && k !== pub).sort((a, b) => counts.get(b) - counts.get(a))
  const [tab, setTab] = useState('all')
  const [all, setAll] = useState(false)
  const [hot, setHot] = useState(null) // the hovered row's query
  const short = (path) => midTruncate(path, 22)
  const options = [{ value: 'all', label: `All ${rows.length}` },
    ...(pub ? [{ value: pub, label: <span className="inline-flex items-center gap-1.5"><span aria-label="Publishing here" className="h-1.5 w-1.5 rounded-full bg-[var(--co-a)]" />{short(pub)} {counts.get(pub)}</span> }] : []),
    ...others.map((k) => ({ value: k, label: `${short(k)} ${counts.get(k)}` }))]
  const shownAll = tab === 'all' ? rows : rows.filter((q) => q.topPage?.path === tab)
  const shown = all ? shownAll : shownAll.slice(0, LIST_ROWS)
  const hotPage = hot ? rows.find((q) => q.query === hot)?.topPage?.path : null
  return (
    <div data-sc-queries>
      <div className="mt-3 overflow-x-auto"><Seg label="Landing page" value={tab} onChange={(v) => { setTab(v); setAll(false) }} className="gap-1 [&>button]:px-3.5" options={options} /></div>
      <ul className="mt-3 border-t border-[var(--div)]" onMouseLeave={() => setHot(null)}>
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
              {here && <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-[var(--co-a)]" />}
              <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface"><GoogleIcon size={16} /></span>
              <span className="flex min-w-0 items-center gap-1.5">
                <span title={q.query} className={`truncate text-[15px] leading-[22px] ${muted ? 'font-medium text-stone-500' : 'font-semibold text-stone-900'}`}>{q.query}</span>
                {q.intent && <Tag intent={q.intent} />}
                {q.lowVolume && <Tag intent="low volume" />}
              </span>
              <span className="min-w-0 text-[14px] leading-5 text-stone-500">
                {q.topPage?.url
                  ? <a href={q.topPage.url} target="_blank" rel="noopener noreferrer" onFocus={() => setHot(q.query)} className="flex min-w-0 items-center gap-1 rounded outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus" aria-label={`${q.topPage.path} (opens in a new tab)`}>
                      <span className="min-w-0 truncate">{q.topPage.path}</span>
                      <ArrowUpRight size={12} aria-hidden className={`shrink-0 transition-transform duration-150 ${reduce ? '' : 'group-hover/q:-translate-y-0.5 group-hover/q:translate-x-0.5'}`} />
                    </a>
                  : q.topPage?.path}
              </span>
              <span className="relative h-5 text-right text-[14px] leading-5 tabular-nums text-stone-700">
                <span className={`absolute inset-0 transition-opacity duration-150 ${on ? 'opacity-0' : 'opacity-100'}`}>{num(q.impressions)}</span>
                {on && <Spark values={weeksOf(q)} still={reduce} />}
              </span>
              <span className={`text-right text-[14px] leading-5 tabular-nums ${muted && !q.best ? 'text-stone-500' : v.cls}`}>{v.text}</span>
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
// 8 weeks as a 60×20 line, drawn left to right (~400ms), the last point a dot; static under reduced motion
function Spark({ values, still }) {
  const lo = Math.min(...values), hi = Math.max(...values)
  const y = (v) => (hi === lo ? 10 : 17 - ((v - lo) / (hi - lo)) * 14)
  const pts = values.map((v, i) => `${(i * 60) / (values.length - 1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg width="60" height="20" viewBox="0 0 60 20" className="absolute right-0 top-0 overflow-visible" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" pathLength="1"
        style={still ? undefined : { strokeDasharray: 1, animation: 'co-spark-draw 400ms ease-out both' }} />
      <circle cx="60" cy={y(values.at(-1))} r="2" fill="var(--ink)" style={still ? undefined : { animation: 'fade-in 120ms ease-out 360ms both' }} />
    </svg>
  )
}

// one line under the table: "Publishing on <path> · Change page" (a small menu: your pages, or a new page)
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
      <span ref={labelRef} className="shrink-0 text-stone-500">Publishing on</span>
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
