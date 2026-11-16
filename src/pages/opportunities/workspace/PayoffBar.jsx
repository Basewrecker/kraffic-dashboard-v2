// Opportunities → Content workspace: the payoff bar, at the top of the step band. app (owner, 2026-11-14): no card and
// no step line (the flow's own progress is in the focus panel): an open headline block: "Step N of 6", the step's title (the Sentiment page's
// heading scale), its sub-line, the one filled button (Resume, Create content…) and, on the right, the page's
// "Publishing on …" line. The title and sub-line crossfade on a step change (180ms); aria-live reads them.
// The button only looks disabled when the step truly can't continue, and then says why on hover.
// busy (the draft writing in the background): a small turning ring before the headline (an owner's exception to the
// no-looping-animation rule, DESIGN.md; static under reduced motion).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Columns2, FileText, ListChecks, MessageCircleQuestion } from 'lucide-react'
import { PlatformIcon } from '../../../components/dashboard/icons'
import { CrossFade } from '../../../components/ui/motion'
import { EdgeTip } from '@/components/mock-overview/content-tip'
import { engineIcon } from '@/lib/mock-adapter-content'
import { ownBrandShown } from '@/lib/mock-adapter-content' // app (owner, 2026-11-12): "ChatGPT names <brand>", was "names you"
import { CO_BRAND } from '@/lib/mock-adapter-content' // app (owner, 2026-11-15): the brand's logo tile before the path
import SiteLogo from '../../../components/ui/SiteLogo'
import { LogoPlate, siteName } from '../parts'
import { STEPS, backLabel, stepPos } from './flow'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const LINK = 'rounded text-[13px] leading-[18px] font-medium text-stone-600 underline-offset-4 outline-none whitespace-nowrap hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-focus'

// engines: the engines with a result in the latest scan (5 with Google split in two; a no-result one is left out) · named: the ones that name the brand now (the rest are missed)
export default function PayoffBar({ barRef, current, open, values = [], onPick, headline, headlinePath = null, line, showNamed = false, engines = [], named = [], brand = '', engineName = (e) => e, action, secondary = null, extra = null, onClose = null, headingId, busy = false, steps, aside = null }) {
  const still = reduced()
  const pos = stepPos(steps ?? STEPS.map((s, i) => ({ i })), open)
  const entry = useEntry()
  return (
    // app (owner, 2026-11-14): no card and no step line: an open headline block right under the top bar (48px above,
    // 56px below, a hairline under it): "Step N of 6", the title at the Sentiment page's
    // heading scale, the sub-line, then the one filled button; on the right, centred on the headline, the page's
    // "Publishing on …" line (aside). The headline fades up first (180ms), the button 80ms after, the page after
    // that (mock.src.css .co-head-in, .co-head-btn, .co-page-after)
    <div data-step-head>
      <div ref={barRef} className="flex items-center gap-x-10 border-b border-line pb-14 pt-12 max-lg:flex-col max-lg:items-stretch max-lg:gap-y-8">
        <div className="min-w-0 flex-1">
          {/* app (owner, 2026-11-15): the entry plays once on load (logo tile, then the heading, then the rows on the
              right, .co-rise); a step change only crossfades */}
          <div aria-live="polite" className="min-w-0">
            <CrossFade k={`${open}|${headline}`} ms={180}>
              <div className="min-w-0">
                <p className={`text-[13px] leading-[18px] font-medium text-stone-500 tabular-nums ${entry ? 'co-rise' : ''}`} style={entry ? { animationDelay: '60ms' } : undefined} aria-hidden>Step {pos.n} of {pos.of}</p>
                {/* app (owner, 2026-11-15): the brand's logo in the Opportunities logo tile, centred on the heading */}
                <div className="mt-2 flex min-w-0 items-center gap-3">
                  <BrandTile className={entry ? 'co-rise' : ''} />
                  <h2 id={headingId} className={`min-w-0 text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1 ${entry ? 'co-rise' : ''}`} style={entry ? { animationDelay: '60ms' } : undefined}>
                    <span className="sr-only">Step {pos.n} of {pos.of}: </span>{busy && <Turning />}{headlinePath ? <PathTitle {...headlinePath} /> : headline}
                  </h2>
                </div>
                {line && <SubLine line={line} engines={showNamed ? engines : []} named={named} brand={brand} engineName={engineName} />}
              </div>
            </CrossFade>
          </div>
          {(action || onClose || extra || secondary) && (
            <div className="co-head-btn mt-6 flex flex-wrap items-center gap-4">
              {action && <ActionButton action={action} still={still} size="lg" />}
              {onClose && <button type="button" onClick={onClose} className={LINK}>{backLabel(steps ?? STEPS.map((x, i) => ({ i })), current)}</button>}
              {/* app (owner, 2026-11-05): a second small link before the secondary ("Guidelines · Edit") */}
              {extra && <button type="button" onClick={extra.onClick} className={LINK} data-bar-extra>{extra.label}</button>}
              {secondary && <button type="button" onClick={secondary.onClick} className={LINK}>{secondary.label}</button>}
            </div>
          )}
        </div>
        {/* app (owner, 2026-11-14): the right side (HeadFacts), after one vertical hairline; narrow: under the button,
            the hairline horizontal */}
        {aside && <>
          <span aria-hidden className="shrink-0 bg-line lg:w-px lg:self-stretch max-lg:h-px" />
          <div className="min-w-0 lg:max-w-[52%]" data-head-aside>{aside}</div>
        </>}
      </div>
    </div>
  )
}

// the sub-line (owner, 2026-11-05): on step 1 "Named on n of 5" with the engines that name you (in colour, 16px, only
// those) first, then the line's items ("5 pages win this prompt"); a path in it truncates in the middle only.
// app (owner, 2026-11-12): "<Brand> named on n of 5" (the brand's display name first, 600, truncated past 240px)
function SubLine({ line, engines, named, brand = '', engineName }) {
  const parts = line.split(' · ')
  const sep = <span aria-hidden className="shrink-0">·</span>
  return (
    <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[14px] leading-5 font-medium text-stone-600 tabular-nums">
      {engines.length > 0 && <>
        <span className="flex min-w-0 items-center gap-1.5" role="img" aria-label={`${brand ? `${brand} named` : 'Named'} on ${named.length} of ${engines.length}${named.length ? `: ${named.map(engineName).join(', ')}` : ''}`}>
          {brand && <span className="min-w-0 max-w-[240px] truncate font-semibold" title={brand}>{brand}</span>}
          <span className="shrink-0 whitespace-nowrap">{brand ? 'named' : 'Named'} on {named.length} of {engines.length}</span>
          {named.map((e) => <span key={e} title={`${engineName(e)} names ${ownBrandShown()}`} className="flex"><PlatformIcon id={engineIcon(e)} size={16} /></span>)}
        </span>{sep}</>}
      {parts.map((r, k) => <span key={`${k}${r}`} className="flex min-w-0 items-center gap-1.5">{k > 0 && sep}{r.startsWith('/') ? <MidPath text={r} /> : <span className="whitespace-nowrap">{r}</span>}</span>)}
    </p>
  )
}
// app (owner, 2026-11-09): the Target step's title is the page's path itself (the whole path; too long, truncated in the
// middle with the full path as its tooltip), a new page's followed by a small muted "New page"
function PathTitle({ path, isNew = false }) {
  return (
    <span className="inline-flex max-w-full min-w-0 items-baseline gap-2 align-bottom">
      <MidPath text={path} twoTone />
      {isNew && <span className="shrink-0 text-[13px] leading-[18px] font-medium text-stone-500">New page</span>}
    </span>
  )
}

// a path that shrinks only by truncating its middle: an invisible copy keeps its natural width (so the flex row gives it
// the room it has, not the room its shortened text takes); the shown text is measured against that room
// twoTone (owner, 2026-11-15): the folder part ("/education/") in t3, the page part in ink, same size and weight
function MidPath({ text, twoTone = false }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(text)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const fit = () => {
      const w = el.clientWidth
      if (!w) return
      measure ??= document.createElement('canvas').getContext('2d')
      const cs = getComputedStyle(el)
      measure.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      // app (owner, 2026-11-09): the invisible copy's real width decides whether the path fits (the canvas measured
      // ~2% wider than the page draws, so a path with room to spare was cut); when it must be cut, the canvas widths are
      // scaled to the page's
      const natural = el.firstElementChild?.getBoundingClientRect().width ?? 0
      if (natural && natural <= w + 0.5) { setShown(text); return }
      const k = natural ? natural / Math.max(1, measure.measureText(text).width) : 1
      const width = (t) => measure.measureText(t).width * k
      if (width(text) <= w) { setShown(text); return }
      let lo = 3, hi = text.length - 1
      const cut = (n) => `${text.slice(0, Math.ceil(n / 2))}…${text.slice(text.length - Math.floor(n / 2))}`
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (width(cut(mid)) <= w) lo = mid; else hi = mid - 1 }
      setShown(cut(lo))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    document.fonts?.ready.then(fit)
    return () => ro.disconnect()
  }, [text])
  return (
    <span ref={ref} className="relative min-w-0 overflow-hidden whitespace-nowrap" title={shown !== text ? text : undefined}>
      <span aria-hidden className="invisible">{text}</span>
      <span className="absolute inset-0">{twoTone ? <TwoTone text={shown} /> : shown}</span>
    </span>
  )
}
let measure = null
function TwoTone({ text }) {
  const cut = text.replace(/\/$/, '').lastIndexOf('/') + 1
  if (cut <= 0 || cut >= text.length) return text
  return <><span className="text-stone-500">{text.slice(0, cut)}</span>{text.slice(cut)}</>
}

// the entry runs once, on the first render only: the classes come off after it, so a re-render or a step change (the
// CrossFade remounts the heading) doesn't replay it
function useEntry() {
  const [on, setOn] = useState(true)
  useEffect(() => { const t = setTimeout(() => setOn(false), 700); return () => clearTimeout(t) }, [])
  return on
}
// app (owner, 2026-11-15): the brand's logo in the Opportunities logo tile (Sentiment's MissedTile: 36px, rounded, tint;
// the logo on its plate); the letter when the site has no logo
function BrandTile({ className = '' }) {
  if (!CO_BRAND.domain && !CO_BRAND.name) return null
  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tint ${className}`} aria-hidden data-brand-tile>
      <span className="grid h-[22px] w-[22px] shrink-0 place-items-center overflow-hidden rounded bg-[var(--logo-plate)]">
        <SiteLogo domain={CO_BRAND.domain || undefined} name={CO_BRAND.name || siteName(CO_BRAND.domain)} className="h-full w-full" initialClass="text-[11px]" force />
      </span>
    </span>
  )
}

// the step progress: small pills + "3 of 6". app (owner, 2026-11-06): up to the open step ink 28px, later steps already
// reached a lighter 28px, not reached --line-strong 12px; the pills and "N of 6" change together (200ms); hover a pill for
// the step and what was chosen; click a done one (or the current one, from a reopened step) to go there. Shared with the
// focus panel's header.
// steps: the visible steps ([{ i, title }], workspace/flow.js stepsFor): v1 shows 3, ?backend=full 5
export function Pills({ current, open, values = [], onPick, still = reduced(), steps = STEPS.map((s, i) => ({ ...s, i })) }) {
  const [tip, setTip] = useState(null) // a pill's tooltip: its index
  const pos = stepPos(steps, open)
  return (
    <ol className="flex items-center gap-1" aria-label={`Step ${pos.n} of ${pos.of}`}>
      {steps.map((s, k) => {
        const i = s.i
        const done = i < current
        const on = i <= current // reached: can be clicked to go there
        const isOpen = i === open
        // app (owner, 2026-11-06): the bar follows the step you're on, not the furthest one reached. Dark up to the open
        // step; steps after it already reached in a lighter shade; not reached: grey and short
        const viewed = open ?? current
        const fill = i <= viewed ? 'dark' : on ? 'light' : 'empty'
        const value = done ? values[i] : null
        return (
          <li key={s.id} className="relative" onMouseEnter={() => setTip(i)} onMouseLeave={() => setTip(null)}>
            <button type="button" disabled={!on || isOpen} onClick={() => onPick(i)} onFocus={() => setTip(i)} onBlur={() => setTip(null)}
              aria-label={`Step ${k + 1}, ${s.title}${value ? `: ${value}` : ''}${done && !isOpen ? '. Go back to it' : i === current && !isOpen ? '. Return to it' : ''}`} aria-current={isOpen ? 'step' : undefined}
              className="group/pill grid h-4 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus enabled:cursor-pointer">
              <span data-fill={fill} className={`block h-1.5 rounded-full ${fill === 'dark' ? 'bg-ink' : fill === 'light' ? 'bg-[color-mix(in_srgb,var(--ink)_30%,var(--color-line-strong))]' : 'bg-[var(--color-line-strong)]'}`}
                style={{ width: on ? 28 : 12, transition: still ? 'none' : 'width 200ms cubic-bezier(.2,.8,.2,1), background-color 200ms ease-out' }} />
            </button>
            {tip === i && (
              <span role="tooltip" className="pointer-events-none absolute left-0 top-full z-30 mt-1.5 w-max max-w-[280px] rounded-md border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 text-stone-700 shadow-md">
                <span className="font-semibold text-stone-900">{s.title}</span>{value ? <> · {value}</> : i === current ? ' · now' : ''}
              </span>
            )}
          </li>
        )
      })}
      <li className="ml-2 text-[12px] leading-4 text-stone-500 tabular-nums" aria-hidden>{pos.n} of {pos.of}</li>
    </ol>
  )
}

// app (owner, 2026-11-14): the headline block's right side: three labelled rows. AI engines: each answered engine's logo
// in full colour with a status badge (names the brand: ink tick; doesn't: red dot; owner 2026-11-15), then "Named by n of m" (the same
// engines and named list as the rest of the page); the table's "Draft adds" formats (left out when there are none);
// the page's "Publishing on" line (its own label hidden: the row's label says it). The rows fade up one after another
// after the headline and the rings draw in turn (mock.src.css .co-fact); reduced motion: fades only, no drawing.
// app (owner, 2026-11-15): every engine logo in full colour in a light ring, its status on a small badge (ink tick: names
// the brand; red dot: doesn't); the named count in red at 0. "Cited instead": the winners table's pages (its order),
// up to 5 overlapping logos, then the first two names and "and N more". The draft adds as tint chips with a line icon.
// The rows rise in after the logo tile and the heading, 60ms apart, once (mock.src.css .co-rise; none under reduced motion)
const FACT_AT = 120 // ms: after the logo tile (0) and the heading (60)
const CITED_MAX = 5
export function HeadFacts({ engines = [], named = [], brand = '', engineName = (e) => e, adds = [], cited = [], publishing = null, noResult = null }) {
  const entry = useEntry()
  const rows = [
    { key: 'engines', label: 'AI engines', body: (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-1.5">
          {engines.map((e, i) => {
            const on = named.includes(e)
            return (
              <EdgeTip key={e} label={`${engineName(e)}: ${on ? 'names' : 'doesn’t name'} ${brand} for this prompt`}
                tip={<><span className="block font-semibold text-stone-900">{engineName(e)}</span>{on ? `Names ${brand} for this prompt` : `Doesn’t name ${brand} for this prompt`}</>}>
                <EngineRing id={e} on={on} />
              </EdgeTip>
            )
          })}
        </span>
        <span className="whitespace-nowrap font-semibold text-stone-900 tabular-nums" data-named-by>Named by <span className={named.length ? '' : 'text-negative'}>{named.length}</span> of {engines.length}</span>
        {noResult}
      </span>
    ) },
    cited.length ? { key: 'cited', label: 'Cited instead', body: <CitedInstead hosts={cited} /> } : null,
    adds.length ? { key: 'adds', label: 'Draft adds', body: (
      <span className="flex flex-wrap items-center gap-1.5" data-draft-adds>
        {adds.map((a) => {
          const Icon = addIcon(a)
          return <span key={a} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-tint px-2 py-1 text-[13px] leading-[18px] font-medium text-stone-900"><Icon size={14} strokeWidth={1.75} aria-hidden className="shrink-0 text-stone-600" />{a}</span>
        })}
      </span>
    ) } : null,
    publishing ? { key: 'pub', label: 'Publishing on', body: <div className="min-w-0 [&_[data-pub-label]]:hidden">{publishing}</div> } : null,
  ].filter(Boolean)
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-4 text-[14px] leading-5" data-head-facts>
      {rows.map((r, k) => {
        const style = entry ? { animationDelay: `${FACT_AT + k * 60}ms` } : undefined
        const rise = entry ? 'co-rise ' : ''
        return [
          <dt key={`${r.key}-t`} className={`${rise}whitespace-nowrap text-[13px] leading-[18px] font-medium text-stone-500`} style={style}>{r.label}</dt>,
          <dd key={`${r.key}-d`} className={`${rise}min-w-0`} style={style}>{r.body}</dd>,
        ]
      })}
    </dl>
  )
}
// an engine's logo, full colour, in a 28px light ring; its status on a badge at the bottom-right: an ink tick (on-ink
// tick, so it inverts in dark) when it names the brand, a red dot when it doesn't
function EngineRing({ id, on }) {
  return (
    <span className="relative grid size-7 shrink-0 place-items-center rounded-full ring-1 ring-inset ring-[var(--color-line-strong)]" data-engine={id} data-named={on || undefined}>
      <span className="flex"><PlatformIcon id={engineIcon(id)} size={16} /></span>
      {on
        ? <span aria-hidden data-badge="named" className="absolute -bottom-0.5 -right-0.5 grid size-3 place-items-center rounded-full bg-ink text-on-ink ring-2 ring-[var(--color-page)]"><Check size={8} strokeWidth={3.5} /></span>
        : <span aria-hidden data-badge="missed" className="absolute bottom-0 right-0 size-2 rounded-full bg-negative ring-2 ring-[var(--color-page)]" />}
    </span>
  )
}
// the draft adds' line icons, by label (the table's labels); any other format: a page
const ADD_ICONS = { 'how-to guide': ListChecks, faq: MessageCircleQuestion, comparison: Columns2 }
const addIcon = (label) => ADD_ICONS[String(label).toLowerCase()] ?? FileText
// "Cited instead": up to 5 overlapping round logos (each names its site on hover), then "A, B and N more" in t2
function CitedInstead({ hosts }) {
  const names = hosts.map((h) => siteName(h))
  const rest = hosts.length - 2
  const text = hosts.length === 1 ? names[0] : hosts.length === 2 ? `${names[0]} and ${names[1]}` : `${names[0]}, ${names[1]} and ${rest} more`
  return (
    <span className="flex min-w-0 items-center gap-2.5" data-cited-instead>
      <span className="flex shrink-0 items-center">
        {hosts.slice(0, CITED_MAX).map((h, i) => (
          // the winners table's own logo (TargetV1 Matrix: LogoPlate, 24px, h-4 w-4), so the two always match; a 2px ring
          // in the page's background separates the overlapping logos
          <EdgeTip key={h} label={names[i]} tip={names[i]} className={`flex rounded-full ring-2 ring-[var(--color-page)] ${i ? '-ml-1.5' : ''}`}>
            <LogoPlate domain={h} size={24} logoClass="h-4 w-4" />
          </EdgeTip>
        ))}
      </span>
      <span className="min-w-0 truncate text-[14px] leading-5 font-medium text-stone-600" title={text}>{text}</span>
    </span>
  )
}

// the primary: lifts 1px on hover; "disabled" only when the step truly can't continue, saying why on hover
export function ActionButton({ action, onLit = () => {}, still = false, tone = 'ink', size = 'md' }) {
  const off = Boolean(action.disabled)
  const base = size === 'sm' ? 'h-8 px-3 text-[13px]' : size === 'lg' ? 'h-11 px-5 text-[15px]' : 'h-10 px-4 text-[14px]'
  const colors = tone === 'light'
    ? off ? 'bg-[color-mix(in_srgb,var(--on-ink)_40%,transparent)] text-ink' : 'bg-[var(--on-ink)] text-ink hover:bg-[color-mix(in_srgb,var(--on-ink)_88%,transparent)]'
    : off ? 'bg-[var(--color-line-strong)] text-stone-600' : 'bg-ink text-on-ink hover:bg-ink-hover'
  return (
    <span className="group/act relative inline-flex">
      <button type="button" onClick={off ? undefined : action.onClick} aria-disabled={off || undefined} aria-describedby={off && action.why ? 'co-act-why' : undefined}
        onMouseEnter={() => onLit(true)} onMouseLeave={() => onLit(false)} onFocus={() => onLit(true)} onBlur={() => onLit(false)}
        className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg font-medium outline-none transition-[transform,background-color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${base} ${colors} ${off ? 'cursor-not-allowed' : still ? '' : 'hover:-translate-y-px'}`}>
        {/* app: arrow: false when the label carries its own ("I’ve pasted it → Verify") */}
        {action.label}{action.arrow !== false && <ArrowRight size={15} aria-hidden className="co-nudge" />}{/* nudges 2px right on the page headline's button hover only (.co-head-btn) */}
      </button>
      {off && action.why && (
        <span id="co-act-why" role="tooltip" className="pointer-events-none absolute right-0 top-full z-30 mt-1.5 w-max max-w-[260px] rounded-md border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 text-stone-700 opacity-0 shadow-md transition-opacity duration-150 group-hover/act:opacity-100 group-focus-within/act:opacity-100">
          {action.why}
        </span>
      )}
    </span>
  )
}

// the writing's ring (draft/Generating.jsx's current-step node), small, before the headline
function Turning() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" className="mr-2 inline-block align-[-2px] motion-safe:animate-spin" style={{ animationDuration: '900ms' }} aria-hidden>
      <circle cx="10" cy="10" r="8" fill="none" stroke="color-mix(in srgb, var(--co-a) 22%, transparent)" strokeWidth="2.5" />
      <circle cx="10" cy="10" r="8" fill="none" stroke="var(--co-a)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="14 60" />
    </svg>
  )
}
