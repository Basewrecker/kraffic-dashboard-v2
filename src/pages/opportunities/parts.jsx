// Opportunities → Content: small shared pieces (rings, week segments, engine ticks, the 4-sync mini timeline) and the
// navigation with a shared-element transition from a list row's prompt into the workspace header.
import { useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Check, Minus, X } from 'lucide-react'
import { PlatformIcon } from '../../components/dashboard/icons'
import SiteLogo from '../../components/ui/SiteLogo'
import { navigate } from '../../router'
import { CO_BRAND, CO_BRANDS, ENGINES, ENGINE_NAME, coBrandName, engineIcon } from '../../data/contentOpportunities'
import { hasResult } from '../../data/brandViews'
import { competitorName, formatLabel } from '../../data/contentRecommend'
import { brandName } from '../../utils/brand'

// a page's engines (recommend.js enginesOf) without any engine that has no result in the latest scan (the no-result
// state: it isn't shown citing anything either)
export const withResults = (e) => ({ ...e, engines: e.engines.filter((id) => hasResult(engineIcon(id))) })

export const LIST_PATH = '/opportunities/content'
export const workspacePath = (id) => `${LIST_PATH}/${id}`
export const brandLabels = Object.fromEntries(Object.entries(CO_BRANDS).map(([d, b]) => [d, b.name]))
export { coBrandName }

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
// The row's prompt text and the workspace title share view-transition-name `co-prompt-<id>` (set on both elements);
// the browser morphs one into the other (index.css ::view-transition-group(*) keeps it to 250ms). No support or
// reduced motion: a plain navigation.
export function goTo(to) {
  if (!document.startViewTransition || reduced()) { navigate(to); return }
  document.startViewTransition(() => flushSync(() => navigate(to)))
}
export const promptVT = (id) => ({ viewTransitionName: `co-prompt-${id}` })

// a progress ring: value of total, ink stroke on the track; label in the middle (optional)
export function Ring({ value, total, size = 40, stroke = 4, children, tone = 'ink' }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const f = total ? Math.min(1, value / total) : 0
  const color = tone === 'positive' ? 'var(--rep-up-fg)' : 'var(--ink)'
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--data-track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - f)} className="transition-[stroke-dashoffset] duration-300 ease-out" />
      </svg>
      {children != null && <span className="absolute inset-0 grid place-items-center text-[12px] font-semibold tabular-nums text-stone-900">{children}</span>}
    </span>
  )
}

// "week 2/4": four small segments, the done ones filled
export function WeekSegments({ done, total = 4, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`} aria-label={`Week ${done} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1.5 w-3 rounded-full transition-colors duration-300 ${i < done ? 'bg-ink' : 'bg-[var(--data-track)]'}`} />
      ))}
    </span>
  )
}

// an engine icon with a corner mark: named (green tick) · missed (red cross) · gap (grey dash, the sync failed)
export function EngineMark({ engine, state, size = 16 }) {
  const Mark = state === 'named' ? Check : state === 'missed' ? X : Minus
  const tone = state === 'named' ? 'bg-[var(--rep-up-fg)]' : state === 'missed' ? 'bg-negative' : 'bg-stone-400'
  const word = state === 'named' ? 'named' : state === 'missed' ? 'not named' : 'no data'
  return (
    <span className="relative inline-flex shrink-0" title={`${ENGINE_NAME[engine]}: ${word}`} aria-label={`${ENGINE_NAME[engine]}: ${word}`}>
      <PlatformIcon id={engineIcon(engine)} size={size} />
      <span className={`absolute -bottom-1 -right-1 grid h-[11px] w-[11px] place-items-center rounded-full ring-2 ring-[var(--color-surface)] ${tone}`}>
        <Mark size={8} strokeWidth={3.5} className="text-white" aria-hidden />
      </span>
    </span>
  )
}

// only the engines that apply, in full colour (the Missed prompts table's pattern); the tooltip names the others.
// none → a muted "—"
export function Engines({ ids, missed = [], engineName = (e) => e, size = 16, none = '—' }) {
  if (!ids.length) return <span className="text-[13px] leading-[18px] text-stone-500" title={missed.length ? `Missed on ${missed.map(engineName).join(', ')}` : undefined}>{none}</span>
  return (
    <span className="inline-flex items-center gap-2" title={missed.length ? `Missed on ${missed.map(engineName).join(', ')}` : ids.map(engineName).join(', ')}
      aria-label={`${ids.map(engineName).join(', ')}${missed.length ? `; missed on ${missed.map(engineName).join(', ')}` : ''}`}>
      {ids.map((e) => <PlatformIcon key={e} id={engineIcon(e)} size={size} />)}
    </span>
  )
}

// a site's logo on a round plate, in tokens so it follows the theme (surface fill, a 1px --line ring): the Content
// workspace's favicons ("Also cited", "Page winning it", the writing checklist). Sentiment keeps its own white plates.
export function LogoPlate({ domain, name, size = 20, logoClass = 'h-3.5 w-3.5', initialClass = 'text-[9px]' }) {
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface ring-1 ring-line" style={{ width: size, height: size }}>
      <SiteLogo domain={domain} name={name ?? domain} className={`${logoClass} rounded-full`} initialClass={initialClass} />
    </span>
  )
}

// the 4-sync monitoring timeline, compact (list hover card) or full (step 5)
export function MiniTimeline({ syncs, compact = false }) {
  return (
    <div className={`grid grid-cols-4 ${compact ? 'gap-2' : 'gap-3'}`}>
      {syncs.map((s, i) => (
        <div key={s.date} className={`flex flex-col ${compact ? 'gap-1.5' : 'gap-2'} ${s.pending ? 'opacity-40' : ''}`}>
          <span className="text-[12px] leading-4 text-stone-500 tabular-nums">Week {i + 1}</span>
          <span className="flex flex-wrap gap-1.5">
            {ENGINES.map((e) => <EngineMark key={e} engine={e} size={compact ? 12 : 16} state={s.pending ? 'gap' : s.engines == null ? 'gap' : s.engines[e] ? 'named' : 'missed'} />)}
          </span>
          <span className="text-[12px] leading-4 tabular-nums text-stone-700">
            {s.pending ? 'Next sync' : s.visibility == null ? '— sync failed' : <>{s.visibility.before}% → <b className="font-semibold text-stone-900">{s.visibility.after}%</b></>}
          </span>
        </div>
      ))}
    </div>
  )
}

// truncate the middle of a path: /blog/niacinamide-vitamin-c-routine → /blog/niac…routine
export function midTruncate(s, max = 34) {
  if (s.length <= max) return s
  const keep = max - 1
  return `${s.slice(0, Math.ceil(keep / 2))}…${s.slice(s.length - Math.floor(keep / 2))}`
}
// a one-line text that truncates its MIDDLE to fit the width it's given (paths keep their start and their end);
// the full text is the tooltip. Block-level: give it a width (flex-1 / min-w-0, or a column).
let measureCtx
export function MidText({ text, className = '', tip = true }) { // tip: false when the caller shows its own tooltip
  const ref = useRef(null)
  const [shown, setShown] = useState(text)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const fit = () => {
      const pad = getComputedStyle(el)
      const w = el.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight)
      if (!w) return
      const cs = getComputedStyle(el)
      measureCtx ??= document.createElement('canvas').getContext('2d')
      measureCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      const width = (t) => measureCtx.measureText(t).width
      if (width(text) <= w) { setShown(text); return }
      let lo = 3
      let hi = text.length - 1
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (width(midTruncate(text, mid)) <= w) lo = mid; else hi = mid - 1 }
      setShown(midTruncate(text, lo))
    }
    fit()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    ro?.observe(el)
    document.fonts?.ready.then(fit)
    return () => ro?.disconnect()
  }, [text])
  return <span ref={ref} title={tip && shown !== text ? text : undefined} className={`block min-w-0 overflow-hidden whitespace-nowrap ${className}`}>{shown}</span>
}
export const pathOf = (url) => { try { return new URL(url).pathname } catch { return url } }

// unique domains, in order, without the ones in `exclude` (guard: a row never repeats a logo; the user's own brand
// never shows where it's excluded, e.g. Missed by)
export const uniqueDomains = (domains, exclude = []) => [...new Set(domains)].filter((d) => !exclude.includes(d))
export const OWN_DOMAIN = CO_BRAND.domain

// A site's display name (owner, 2026-11-05): a tracked brand's name ("The Ordinary"), else the tidied domain
// ("healthline.com" → "Healthline"), never the raw domain
export const siteName = (host) => CO_BRANDS[host]?.name ?? (competitorName(host) !== host ? competitorName(host) : brandName(host))
// the dotted underline that says "hover me" (the "Confirm with your team" style, in a neutral grey: amber is for
// things to confirm)
export const DOTTED = 'underline decoration-dotted decoration-[1.5px] decoration-[var(--color-stone-400)] underline-offset-[4px]'
const pathOfUrl = (u) => { try { return new URL(u).pathname.replace(/\/$/, '') || '/' } catch { return u } }
// a two-spot site's hover text, two lines (the winners table and the Draft rail say the same): line 1 the cited page's
// path and its format(s); line 2 "Also #7 on Google page 1" and that page's path (one line per other page)
export function TwoSpotLines({ page, others = [] }) {
  return (
    <>
      <span className="block truncate font-medium text-stone-900">{pathOfUrl(page.url)} · <span className="font-normal text-stone-600">{page.formats?.length ? page.formats.map(formatLabel).join(' · ') : 'No format detected'}</span></span>
      {others.map((o) => <span key={o.path} className="mt-0.5 block truncate tabular-nums text-stone-600">Also #{o.rank} on Google page 1 · {o.path}</span>)}
    </>
  )
}

// "+1 page" / "+2 pages": a site on more than one page-1 spot, shown once at its best rank (owner, 2026-11-05). Sits
// right after the rank, 12px muted with the dotted "hover me" underline; hover or focus shows the two lines
// (TwoSpotLines). page: the site's best page ({ url, formats }) · others: [{ path, rank }]
export function MorePages({ page, others = [], align = 'left' }) {
  if (!others.length) return null
  const label = `+${others.length} ${others.length === 1 ? 'page' : 'pages'}`
  const list = others.map((o) => `#${o.rank} ${o.path}`).join(', ')
  return (
    <span className="group/mp relative inline-flex shrink-0">
      <button type="button" aria-label={`${label}: also ${list} on Google page 1`} onClick={(e) => e.stopPropagation()}
        className={`rounded text-[12px] leading-4 tabular-nums text-stone-500 ${DOTTED} outline-none hover:text-stone-700 focus-visible:ring-2 focus-visible:ring-focus`}>
        {label}
      </button>
      <span role="tooltip" className={`pointer-events-none absolute top-full z-30 mt-1 hidden w-max max-w-[340px] rounded-lg border border-line bg-raised px-3 py-2 text-left text-[12px] leading-4 shadow-lg group-hover/mp:block group-focus-within/mp:block ${align === 'right' ? 'right-0' : 'left-0'}`}>
        <TwoSpotLines page={page} others={others} />
      </span>
    </span>
  )
}
