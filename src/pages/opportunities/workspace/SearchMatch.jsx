// Target page (v1): "Search Console for this prompt", between the rank ladder and the format matrix. The app's GET
// …/gsc-match response (data/gscMatch.js, lib/gsc-match.js analyzePrompt), one section under the same header style as
// the ladder and the matrix (18/600 over a --line-strong rule, a muted meta right with the range and an ⓘ).
//   Left (7/12): the query-first chain. "Best query" (the query, 17/600) · "60% match · 1,220 impressions · position
//   19.5" → "Publish on" (the path) · "Gets 80% of that query's impressions" (+ "3 of the top queries land here") →
//   Update this page (secondary; it makes this the Update column's page). A best match under 30% → "Create a new page"
//   with the suggested path and why. Under it, "Other top queries" (the next 4): query · match · impressions · clicks
//   · position · its page (middle-truncated). Account / local queries: muted, a small neutral tag, scored at half (ⓘ).
//   Right (5/12): "Your pages" (analyzePrompt.pages, by score), two lines each: the path (middle-truncated; "Best
//   match" on the page the chain publishes on) and "Match 76%" (the page's score) with an ⓘ listing its matching
//   queries; under it the AI engines that cite it (only when cited: nothing otherwise) and an impressions bar with
//   the number.
//   States: not connected (Connect) · reconnect (Reconnect) · no property for the domain · connected with no data yet
//   (the new page it would suggest). The ladder and the matrix render in every state.
// Stacked below 1100px (the chain, then Your pages).
import { ArrowDown, Check, Info, Loader2 } from 'lucide-react'
import { GoogleIcon, PlatformIcon } from '../../../components/dashboard/icons'
import { lineBtn } from '../../../components/tool/ToolPage'
import { ENGINE_NAME, engineIcon } from '../../../data/contentOpportunities'
import { MidText } from '../parts'

const nf = new Intl.NumberFormat('en-US')
const num = (n) => nf.format(n)
const pct = (share) => `${Math.round(share * 100)}%`
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
export default function SearchMatch({ gsc, domain, connecting = false, justConnected = false, onConnect, onChange = null, enginesFor = () => ({ engines: [], unknown: false }), page = null, onPick = () => {} }) {
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
            <div className="grid grid-cols-1 gap-x-10 gap-y-8 pt-5 min-[1100px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] min-[1100px]:items-start">
              <div className="min-w-0">
                <Chain gsc={gsc} page={page} onPick={onPick} />
                <OtherQueries gsc={gsc} />
              </div>
              <YourPages gsc={gsc} enginesFor={enginesFor} page={page} onPick={onPick} />
            </div>
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

// the query-first chain: the best query → the page to publish on → the action. Publish on IS the target page unless
// the user picked another one in Your pages ("Using this page"); then the button takes it back.
function Chain({ gsc, page, onPick }) {
  const q = gsc.bestQuery
  const p = gsc.publishOn
  const create = p.action === 'create'
  const onPage = create ? 0 : gsc.queries.filter((x) => x.topPage.path === p.path).length
  const using = page?.source === 'sc' && page.path === (create ? p.suggestedPath : p.path)
  return (
    <div data-sc-chain={p.action}>
      {q && (
        <div>
          <p className={LABEL}>{create ? 'Closest query' : 'Best query'}</p>
          <p className="mt-0.5 text-[17px] leading-6 font-semibold text-stone-900">“{q.query}”</p>
          <p className={`mt-0.5 tabular-nums ${META}`}>{q.adjusted}% match · {num(q.impressions)} impressions · position {q.position}</p>
        </div>
      )}
      {q && <span aria-hidden className="my-2 ml-1 flex h-6 w-4 items-center justify-center text-stone-400"><ArrowDown size={14} /></span>}
      <div>
        <p className={LABEL}>{create ? 'Create a new page' : 'Publish on'}</p>
        <p className="mt-0.5 break-all text-[17px] leading-6 font-semibold text-stone-900">{create ? p.suggestedPath : p.path}</p>
        <p className={`mt-0.5 ${META}`}>
          {create
            ? (q ? `No query matches this prompt well enough yet (best ${q.adjusted}%).` : 'None of your pages gets impressions for this prompt’s queries yet.')
            : <>Gets {pct(p.share)} of that query’s impressions{onPage >= 2 && <> · {onPage} of the top queries land here</>}</>}
        </p>
        {!create && p.lowVolume && <p className={`mt-0.5 ${META}`}>Few searches so far: every match is under 10 impressions.</p>}
        <div className="mt-3">
          {/* using: it's already the target (nothing to do); else back to it from the user's own pick */}
          <UseButton using={using} label={create ? 'Create this page' : 'Update this page'} onClick={() => { if (!using) onPick(null) }} />
        </div>
      </div>
    </div>
  )
}

// the other top queries (the best one is the chain's): match, impressions, clicks, position, page
const QROW = 'grid grid-cols-[minmax(0,1fr)_56px_72px_52px_40px_minmax(0,0.9fr)] items-center gap-x-3'
function OtherQueries({ gsc }) {
  const rows = gsc.queries.filter((q) => !q.best).slice(0, 4)
  if (!rows.length) return null
  return (
    <div className="mt-7">
      <p className={`border-b border-line pb-1.5 ${LABEL}`}>Other top queries</p>
      <div role="table" aria-label="Other top queries" className="text-[13px] leading-[18px]">
        <div role="row" className={`${QROW} h-8 text-[12px] leading-4 text-stone-500`}>
          <span role="columnheader">Query</span>
          <span role="columnheader" className="text-right">Match</span>
          <span role="columnheader" className="text-right">Impr.</span>
          <span role="columnheader" className="text-right">Clicks</span>
          <span role="columnheader" className="text-right">Pos.</span>
          <span role="columnheader">Page</span>
        </div>
        {rows.map((q) => (
          <div role="row" key={q.query} data-intent={q.intent ?? undefined} className={`${QROW} h-11 border-t border-[var(--div)] tabular-nums`}>
            <span role="cell" className="flex min-w-0 items-center gap-1.5">
              <span title={q.query} className={`truncate ${q.intent ? 'text-stone-500' : 'font-medium text-stone-900'}`}>{q.query}</span>
              {q.intent && <Tag intent={q.intent} />}
            </span>
            <span role="cell" className={`flex items-center justify-end gap-0.5 ${q.intent ? 'text-stone-500' : 'text-stone-900'}`}>
              {q.adjusted}%
              {q.intent && <Tip label={`Scored at half: ${INTENT_WHY[q.intent]}`} width={220}>Scored at half: {INTENT_WHY[q.intent]}. Its match before that: {q.match}%.</Tip>}
            </span>
            <span role="cell" className="text-right text-stone-700">{num(q.impressions)}</span>
            <span role="cell" className="text-right text-stone-700">{num(q.clicks)}</span>
            <span role="cell" className="text-right text-stone-700">{q.position}</span>
            <span role="cell" className="min-w-0"><MidText text={q.topPage.path} className="text-stone-700" /></span>
          </div>
        ))}
      </div>
    </div>
  )
}

// the brand's pages that the matching queries land on, by score. One radio group: picking a row makes it THE target page
// (the Update column, the payoff bar, the draft); picking Search Console's own page is the default again.
function YourPages({ gsc, enginesFor, page = null, onPick = () => {} }) {
  const pages = gsc.pages.slice(0, 5)
  const max = Math.max(1, ...pages.map((p) => p.impressions))
  const pick = (p) => onPick(gsc.publishOn.action === 'update' && p.path === gsc.publishOn.path ? null : { action: 'update', path: p.path, url: p.url })
  return (
    <div className="min-w-0 min-[1100px]:border-l min-[1100px]:border-line min-[1100px]:pl-10">
      <p className={`border-b border-line pb-1.5 ${LABEL}`}>Your pages</p>
      <ul role="radiogroup" aria-label="The page to update">
        {pages.map((p) => {
          const e = enginesFor(p.path)
          const qs = gsc.queries.filter((q) => q.topPage.path === p.path)
          const on = page?.action === 'update' && page.path === p.path
          return (
            <li key={p.path} role="radio" aria-checked={on} tabIndex={0} data-your-page={p.path}
              onClick={(ev) => { if (!ev.target.closest('[role="tooltip"],[aria-label^="Why"]')) pick(p) }}
              onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(p) } }}
              className={`-mx-2 flex h-[64px] cursor-pointer flex-col justify-center gap-1.5 rounded-lg border-b border-[var(--div)] px-2 outline-none transition-[background-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'bg-tint shadow-[inset_0_0_0_1px_var(--ink)]' : 'hover:bg-[color-mix(in_srgb,var(--tint)_60%,transparent)]'}`}>
              <span className="flex min-w-0 items-center gap-2">
                <MidText text={p.path} className="flex-1 text-[14px] leading-5 font-medium text-stone-900" />
                {gsc.publishOn.action === 'update' && p.path === gsc.publishOn.path && <Chip>Best match</Chip>}
                <span className="flex shrink-0 items-center gap-0.5 text-[13px] leading-[18px] font-semibold tabular-nums text-stone-900">
                  Match {p.score}%
                  <Tip label={`Why ${p.path} matches`} width={240}>
                    {qs.length
                      ? <><span className="block font-semibold text-stone-900">Top matching queries</span>{qs.slice(0, 3).map((q) => <span key={q.query} className="mt-1 block">“{q.query}” · {q.adjusted}%</span>)}</>
                      : `${p.queries} matching ${p.queries === 1 ? 'query' : 'queries'}, outside the top five.`}
                  </Tip>
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="flex w-[64px] shrink-0 items-center gap-1" aria-label={e.engines.length ? `Cited by ${e.engines.map((x) => ENGINE_NAME[x]).join(', ')}` : p.cited ? 'Cited by AI answers' : undefined}>
                  {e.engines.length ? e.engines.map((x) => <span key={x} title={ENGINE_NAME[x]} className="flex"><PlatformIcon id={engineIcon(x)} size={14} /></span>) : p.cited ? <span title="Cited by AI answers (engine not specified)" className="grid h-[14px] w-[14px] place-items-center rounded-full bg-stone-200 text-[7px] leading-none font-bold text-stone-700">AI</span>
                    : null}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-tint" aria-hidden><span className="block h-full rounded-full bg-[var(--color-stone-400)]" style={{ width: `${Math.max(4, (p.impressions / max) * 100)}%` }} /></span>
                <span className="w-[96px] shrink-0 text-right text-[12px] leading-4 tabular-nums text-stone-600">{num(p.impressions)} impr.</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
