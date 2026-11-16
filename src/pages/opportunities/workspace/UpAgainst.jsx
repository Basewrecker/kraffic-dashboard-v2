// Opportunities → Content workspace: "Who you're up against", built on Sentiment's Sources section (the h2, its muted
// line, two columns 48px apart, each with its head over a hairline and 52px rows).
//   left, "Page winning it": the page AI cites most for the prompt (its logo, brand, URL, format chips, the engines
//     that cite it)
//   right, "Also cited": the row's other sources, one 52px row each (favicon · URL · format chips · engines)
// Data: the row's sources (real, { domain, path }); the winning page, formats and engines citing each are proposed
// (contentOpportunities-proposed.js winningPageFor, formatsOf, citedBy).
import { safeHref } from '../draft/markdown'
import { ArrowUpRight } from 'lucide-react'
import { PlatformIcon } from '../../../components/dashboard/icons'
import { brandName } from '../../../utils/brand'
import { ENGINE_NAME, engineIcon } from '../../../data/contentOpportunities'
import { citedBy, formatsOf, winningPageFor } from '../../../data/contentOpportunities-proposed'
import { LogoPlate, MidText, brandLabels } from '../parts'
import { COL_HEAD, COL_TITLE, H2, ROW_TITLE, SECOND } from './ui'

const nameOf = (d) => brandLabels[d] ?? brandName(d)
const chip = 'inline-flex h-6 items-center rounded-md bg-tint px-2 text-[12px] leading-4 font-medium text-stone-700'

const Engines = ({ ids, size = 14 }) => (
  <span className="flex items-center gap-1.5" aria-label={`Cited on ${ids.map((e) => ENGINE_NAME[e]).join(', ')}`}>
    {ids.map((e) => <span key={e} title={ENGINE_NAME[e]} className="inline-flex"><PlatformIcon id={engineIcon(e)} size={size} /></span>)}
  </span>
)
// the favicons sit on the workspace's token plate (parts.jsx LogoPlate), so the section follows the theme
const Fav = ({ domain, size = 20 }) => <LogoPlate domain={domain} size={size} />

export default function UpAgainst({ row, named = () => '—' }) {
  const win = winningPageFor(row)
  const others = (row.sources ?? []).filter((s) => !(win && s.domain === win.domain && s.path === win.path))
  if (!win && !others.length) return null
  return (
    <section aria-labelledby="co-against-h">
      {/* the section's header: title, a muted subtitle, a --line-strong rule */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line-strong pb-3">
        <h2 id="co-against-h" className={H2}>Who you’re up against</h2>
        <p className={SECOND}>{(row.sources ?? []).length} pages AI cites for this prompt · latest sync</p>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
        <div className="min-w-0">
          <div className={COL_HEAD}><h3 className={COL_TITLE}>Page winning it</h3></div>
          {win ? (
            <div className="border-b border-[var(--div)] py-4">
              {/* header row: logo · brand (18/600) with its URL under it · Open page ↗ */}
              <div className="flex items-center gap-3">
                <LogoPlate domain={win.domain} name={nameOf(win.domain)} size={40} logoClass="h-6 w-6" initialClass="text-[12px]" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[18px] leading-[26px] font-semibold text-stone-900">{nameOf(win.domain)}</span>
                  <MidText text={`${win.domain}${win.path}`} className={SECOND} />
                </span>
                {safeHref(`https://${win.domain}${win.path}`) && <a href={safeHref(`https://${win.domain}${win.path}`)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[14px] leading-5 font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
                  Open page<ArrowUpRight size={14} aria-hidden /><span className="sr-only"> (opens in a new tab)</span>
                </a>}
              </div>
              {/* a 3-column stat grid */}
              <dl className="mt-4 grid grid-cols-3 gap-4">
                <div className="min-w-0"><dt className="text-[12px] leading-4 text-stone-500">Formats</dt>
                  <dd className="mt-1.5 flex flex-wrap gap-1">{win.formats.map((f) => <span key={f} className={chip}>{f}</span>)}</dd></div>
                <div className="min-w-0"><dt className="text-[12px] leading-4 text-stone-500">Cited on</dt>
                  <dd className="mt-1.5"><Engines ids={citedBy(row, win)} size={16} /></dd></div>
                <div className="min-w-0"><dt className="text-[12px] leading-4 text-stone-500">Named</dt>
                  <dd className="mt-1 text-[15px] leading-[22px] font-semibold text-stone-900 tabular-nums">{named(win.domain)}</dd></div>
              </dl>
            </div>
          ) : <p className={`py-4 ${SECOND}`}>No page cited</p>}
        </div>
        <div className="min-w-0">
          <div className={COL_HEAD}><h3 className={COL_TITLE}>Also cited<span className="tabular-nums text-stone-500">{others.length}</span></h3></div>
          <ul>
            {others.map((s) => (
              <li key={`${s.domain}${s.path}`} className="grid h-[52px] grid-cols-[20px_minmax(0,1fr)_auto_auto] items-center gap-x-3 border-b border-[var(--div)]">
                <Fav domain={s.domain} />
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className={`shrink-0 ${ROW_TITLE}`}>{s.domain}</span>
                  <MidText text={s.path} className={`flex-1 ${SECOND}`} />
                </span>
                <span className="flex gap-1.5">{formatsOf(row, s).map((f) => <span key={f} className={chip}>{f}</span>)}</span>
                <Engines ids={citedBy(row, s)} />
              </li>
            ))}
            {!others.length && <li className={`flex h-[52px] items-center border-b border-[var(--div)] ${SECOND}`}>No other pages cited</li>}
          </ul>
        </div>
      </div>
    </section>
  )
}
