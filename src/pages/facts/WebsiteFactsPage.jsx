// Optimize → Fact Check (was "Website facts"; "Proof first", owner 2026-11-11, round 4). What we read on the brand's
// site, which claims an outside source backs up, and the facts Content drafts may use. Design only: the app's data and
// its four actions (confirm, reject, add a fact, read the website again) on sample data (data/websiteFacts.js).
// Layout, as Sentiment: a hero card (how many facts are confirmed, by status, each a link to its card; the sources we
// checked against; Read website again) → Where we read it (its boxes open the page texts we read) → two independent
// columns of equal width (app, owner 2026-11-11: Your call, then Ready to confirm / Checked against outside sources,
// then the fact sheet (only the facts in use); every card its natural height; app, owner 2026-11-12: neither column
// stays put, the page scrolls as one; the single-column layout was reverted the same day).
// Text we read that isn't a fact (the home page's title, meta description and heading) opens from its page's box in
// Where we read it, as a popover (app, owner 2026-11-12). Add a fact is a popover too (no card grows).
// Type: section titles 700, values 600 in ink, everything supporting 400 in stone-600. One helper line per section.
// Colour: graphite, with one solid-ink element per card at most (its primary button); --negative (Sentiment's red) where
// the site and a source disagree, on "Your call", and for pages we couldn't read. No AI engine logos: engines don't read the site.
// Previews: ?wf=empty (never read) · ?wf=done (nothing left to review). "Read website again" plays the reading state.
// app: copied 1:1 from the mock (design/website-facts a3b66c8). Differences, each marked "app:": the data and the four
// actions come from lib/fact-check-adapter.js and lib/fact-check-saves.js (Harsh's route, real data, no previews); a
// read is one blocking call, so its live progress isn't shown; Keep / Drop / Confirm / Dismiss are held 5 s with Undo,
// then sent; a failed save or read shows one plain line with Retry; no "Rejected" bar; logos fall back to a line icon.
'use client'
import { FactQuote } from '@/components/mock-overview/fact-quote'
import AdminOnlyReason from '../../plan/AdminOnlyReason'
import { isSuperadmin } from '../../plan/plan'
import { WhatChangedButton, WhatChangedPanel } from '../../whatChanged/WhatChanged'
import { factCheckChanges } from '../../whatChanged/factCheck'
import { Lock } from 'lucide-react'
import HeaderBell from '../../notifications/NotificationsBell'
import { createPortal } from 'react-dom' // app: the page texts' popover is drawn in <body>
import { Fragment, createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AlignLeft, AppWindow, ArrowUpRight, Award, BadgeCheck, Building2, CalendarDays, Check, ChevronDown, Heading1, Mail, MapPin, Phone, Plus, Quote, RefreshCw, Search, Star, StickyNote, X } from 'lucide-react'
import { brand } from '../../store/workspace'
import SiteLogo from '../../components/ui/SiteLogo'
import BetaTag from '../../components/ui/BetaTag'
import { EdgeTip } from '@/components/mock-overview/content-tip' // app: the app's copy of the mock's EdgeTip
import { GLIDE, useCountUp } from '../../components/ui/motion'
import { ADD_KINDS, KIND, brandLabelOf, bucketsOf, claimRows, conflictOf, diffOf, factUnits, markOf, outsideEvidence, pathOf, foundOnPages, pagesFoundOn, spareValues, SINGLE_VALUE, shortName, similarWordings, siteEvidence, sourceOf, verdictOf, whereBoxes, boxOf, unreadReason, fixLinkOf, sourceRatingOf, checkResultOf, isPageText, pageLabelOf, whyOf, hasOutsideCheck, resultGroupsOf, sourceShortOf } from '@/lib/fact-check-rules' // app: the mock's rules, without its sample data
import { READ_CAP, refresh, useFactCheck } from '@/lib/fact-check-adapter' // app: the real data and the paid read
import { addFact, flushSaves, holdSave, placeTakenFact, retrySaves, takeAsFact, takeFailed, undoSave } from '@/lib/fact-check-saves' // app: the saves
import { FailLine } from '@/components/mock-overview/fact-check-parts' // app: a failed save or read, with Retry
import { Globe } from 'lucide-react' // app: a source's line icon when its logo can't load
import { useProductName } from '@/components/brand/BrandContext' // app: the white-label product's name
import { cmsLinkFor } from '@/lib/content-cms' // app: "Fix this one" on a WordPress site
import { scaled } from '@/lib/ui-scale' // app: sizes set in JavaScript follow the UI scale (0.8 on laptops)

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const KIND_ICON = { brand_name: Building2, phone: Phone, email: Mail, address: MapPin, trustpilot_rating: Star, bbb_rating: Star, award: Award, years: CalendarDays, accreditation: BadgeCheck, claim: Quote, note: StickyNote, title: AppWindow, description: AlignLeft, heading: Heading1 }
const focus = 'outline-none focus-visible:ring-2 focus-visible:ring-focus'
const btn = `inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 text-[14px] font-semibold transition-colors duration-150 disabled:opacity-50 ${focus}`
const primary = `${btn} bg-ink text-on-ink hover:bg-ink-hover`
const secondary = `${btn} border border-line bg-surface text-stone-900 hover:border-[var(--color-line-strong)]`
const link = `rounded text-[13.5px] leading-[19px] font-semibold text-stone-900 underline-offset-2 hover:underline ${focus}`
const card = 'rounded-xl border border-line bg-surface'
const h2 = 'text-[19px] leading-[27px] font-bold text-stone-900' // section titles: 700
const sub = 'text-[13.5px] leading-[19px] font-normal text-stone-600' // supporting: 400, secondary
const val = 'font-semibold text-stone-900' // values: 600, primary
const big = 'text-[20px] leading-[26px] font-semibold tracking-[-0.01em] text-stone-900'
const where = (url) => pageLabelOf(url) // app (owner, 2026-11-12): a page's short label everywhere (lib/fact-check-rules.js)
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
// app (owner, 2026-11-12): the brand as the page names it: Brand Setup's display name, never the domain (the domain is
// only the link under the hero's title); no name: "your" (lib/fact-check-rules.js brandLabelOf). Read when rendered:
// brand is the adapter's live binding.
const brandName = () => brandLabelOf(brand)
const possessive = (name) => `${name}’s`
const yourSite = () => (brandName() ? `${possessive(brandName())} website` : 'your website')

// Hovering (or focusing) a fact lights the page segments it came from; hovering a section tile lights its facts in the
// fact sheet. hot: { urls: Set, src: 'fact' | 'tile' } | null
const Hot = createContext({ hot: null, setHot: () => {} })
const useHot = (urls) => {
  const { setHot } = useContext(Hot)
  const on = () => setHot(urls?.length ? { urls: new Set(urls), src: 'fact' } : null)
  const off = () => setHot(null)
  return { onMouseEnter: on, onMouseLeave: off, onFocus: on, onBlur: off }
}

// a real logo, on a white plate so a dark mark still reads in the dark theme
// app: when a logo can't load, a plain line icon stands in (never a letter tile)
const LineIcon = ({ Icon, className = '' }) => <span aria-hidden className={`grid h-full w-full shrink-0 place-items-center text-stone-600 ${className}`}><Icon className="h-[70%] w-[70%]" strokeWidth={1.75} /></span>
const SourceLogo = ({ src, size = 'h-7 w-7 rounded-md', className = '' }) => <span className={`grid shrink-0 place-items-center overflow-hidden bg-[var(--logo-plate)] ${size} ${className}`}><SiteLogo domain={src.domain} name={src.name} className="h-full w-full" fallback={<LineIcon Icon={Globe} className="bg-surface" />} /></span>
const BrandLogo = ({ size = 'h-7 w-7 rounded-md', className = '' }) => <SiteLogo domain={brand.domain} name={brand.name} className={`${size} ${className}`} fallback={<span className={`grid shrink-0 ${size} ${className}`}><LineIcon Icon={Building2} /></span>} />
// what stands beside a fact in a tight row: its source's (or certifier's) logo, else its kind's plain line icon
function Mark({ fact, size = 20 }) {
  const m = markOf(fact)
  const Icon = KIND_ICON[fact.field] ?? StickyNote
  const box = { width: scaled(size), height: scaled(size) } // app: the UI scale
  return m
    ? <span style={box} className="grid shrink-0 place-items-center overflow-hidden rounded bg-[var(--logo-plate)]"><SiteLogo domain={m.domain} name={m.name} className="h-full w-full" fallback={<LineIcon Icon={Icon} className="bg-surface" />} /></span>
    : <span style={box} className="grid shrink-0 place-items-center text-stone-600"><Icon size={Math.round(size * 0.8)} strokeWidth={1.75} aria-hidden /></span>
}
// [before, differing, after]: the differing part in red, with one pulse
const Diff = ({ parts }) => <>{parts[0]}{parts[1] && <span className="wf-anim wf-diff">{parts[1]}</span>}{parts[2]}</>
// a light tick: graphite outline, soft grey fill when on (never a solid ink box)
const Tick = ({ on, onChange, label, disabled }) => (
  <button type="button" role="checkbox" aria-checked={on} aria-label={label} disabled={disabled} onClick={onChange}
    className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors duration-150 ${on ? 'border-stone-400 bg-tint' : 'border-stone-300 bg-surface hover:border-stone-400'} ${focus}`}>
    {on && <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--color-stone-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path pathLength="1" className="wf-anim wf-draw" style={{ animationDuration: '160ms' }} d="M3.5 8.5l3 3 6-7" /></svg>}
  </button>
)
// ---- the hero: how many facts are confirmed, by status; the sources we checked against; Read website again ----------
// app (owner, 2026-11-12): the three labels under the bar are buttons with their segment groups: a click scrolls to the
// card (STATUS_TO) and flashes it (goTo); hover or focus styles the label (StatusLabel), grows and fills its segments,
// dims the others and rings its card as a preview (seg, shared with the fact sheet's line). A count of 0 has no group,
// so no button.
export const STATUS_TO = { kept: 'fc-sheet', call: 'fc-your-call', ready: 'fc-ready' }
// app (owner, 2026-11-12): a status label: hovered or focused, the primary colour (tone: its own colour instead, the
// fact sheet's red part), number and text 600, and a "↓" fading in after it in space that's always kept. No underline.
function StatusLabel({ n, word, on, tone, className = '' }) {
  const colour = tone ?? (on ? 'text-stone-900' : 'text-stone-600')
  return (
    // the arrow is fc-arrow's ::after (mock.src.css), so it isn't part of the label's text
    // app (owner, 2026-11-12): the 400 and 600 labels are stacked and crossfaded (the 600 one sizes the box), so the text
    // never jumps
    <span className={`num wf-anim fc-arrow text-[13.5px] leading-[19px] transition-colors ease-out ${on ? 'fc-arrow-on duration-150' : 'duration-200'} ${colour} ${className}`}>
      <span className="inline-grid">
        <span className={`col-start-1 row-start-1 font-normal transition-opacity duration-150 ${on ? 'opacity-0' : 'opacity-100'}`}>{n} {word}</span>
        <span aria-hidden className={`col-start-1 row-start-1 font-semibold transition-opacity duration-150 ${on ? 'opacity-100' : 'opacity-0'}`}>{n} {word}</span>
      </span>
    </span>
  )
}
// app (owner, 2026-11-12): when the last read ran (its pages' newest fetched_at, the adapter's readAt), in the viewer's
// time zone: "today, 3:04 PM" / "Nov 12, 3:04 PM" (the sources card's date, with the time)
const dayOf = (at) => { const d = new Date(at); return d.toDateString() === new Date().toDateString() ? 'today' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
const checkedAt = (at) => (at && !Number.isNaN(Date.parse(at)) ? `${dayOf(at)}, ${new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : null)
// app (owner, 2026-11-12): the headline counts every stored fact ("13 facts found on your site", the Facts on your site
// box's count) and the bar splits them into three groups, one segment per fact (lib/fact-check-rules.js
// resultGroupsOf, the partition the filters and lists use): match (solid neutral) · don't match (Sentiment red) · not
// checked (outline). A label opens the Facts on your site list below on its filter (not checked: All).
export const RESULT_FILTER = { match: 'matches', mismatch: 'mismatched', unchecked: 'all' }
function Hero({ b, groups, total, scan, hasRead, onRead, scanLine, failed, onGo, seg, setSeg, readAt, check = null, changes = null }) {
  const dim = 'fc-dimmable'
  const counted = useCountUp(hasRead ? total : 0, 600, 0)
  // app: "Checked against" only names a source the check reached (a claim that only names a source, with no result and
  // no source page, isn't counted)
  const sources = [...new Map(b.cards.filter((g) => verdictOf(g.lead) !== 'none' || outsideEvidence(g.lead)).map((g) => [sourceOf(g.lead).domain, sourceOf(g.lead)])).values()]
  // each group's segment colours at rest and hovered (full strength): match in the primary text colour (both themes),
  // don't match in Sentiment red, not checked an outline that takes a soft fill
  const parts = [
    { id: 'match', n: groups.match.length, word: 'match', rest: 'border-stone-900 bg-stone-900', on: 'border-stone-900 bg-stone-900' },
    { id: 'mismatch', n: groups.mismatch.length, word: groups.mismatch.length === 1 ? 'doesn’t match' : 'don’t match', rest: 'border-[var(--negative)] bg-[var(--negative)]', on: 'border-[var(--negative)] bg-[var(--negative)]', tone: 'text-negative' },
    { id: 'unchecked', n: groups.unchecked.length, word: 'not checked', rest: 'border-stone-300 bg-transparent', on: 'border-stone-600 bg-tint' },
  ].filter((p) => p.n > 0)
  return (
    <section className={`${card} flex flex-col gap-5 p-[22px] lg:p-7 ${introSeen.has(brand.domain) ? '' : 'fc-up'}`} data-fc-hero="">
      <div className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-4 ${dim}`}>
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo size="h-10 w-10 rounded-lg" />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2.5"><h1 className="text-[22px] leading-7 font-bold tracking-[-0.02em] text-stone-900">Fact Check</h1><BetaTag tipAlign="left" className="-translate-y-[3px]" /></div>
            <a href={`https://${brand.domain}`} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 rounded ${sub} hover:text-stone-900 ${focus}`}>{brand.domain}<ArrowUpRight size={13} aria-hidden /></a>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {hasRead && sources.length > 0 && (
            <div className="flex items-center gap-2.5">
              <span className={sub}>Checked against</span>
              <span className="flex items-center gap-1.5">{sources.map((s) => <EdgeTip key={s.domain} tip={s.name} label={s.name} className="block"><SourceLogo src={s} size="h-6 w-6 rounded-md" /></EdgeTip>)}</span>
            </div>
          )}
          {/* app (owner, 2026-11-12): "Check facts again" (the same paid read), with when the last one ran beside it */}
          {hasRead && !scan && checkedAt(readAt) && <span className={`num ${sub}`}>Last checked {checkedAt(readAt)}</span>}
          {/* as the app (#223): Summary, then the check button, then hairline · bell (12px apart: the row's gap is 20px) */}
          {changes && hasRead && <WhatChangedButton config={changes} size="md" bell={false} />}
          {/* as the app (#227 / #230): the check runs once a month. The words live only in the button's dark tip:
              available, locked (when it's next available), superadmin. No visible line under the header. */}
          <span className={`group/fc relative inline-flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus ${changes && hasRead ? 'lg:-ml-2' : ''}`} tabIndex={check?.locked ? 0 : undefined} aria-label={check?.locked ? check.tip : undefined}>
            <button type="button" onClick={onRead} disabled={!!scan || !!check?.locked} aria-describedby={check?.tip ? 'fc-check-tip' : undefined} className={`${primary} disabled:opacity-50`} data-fc-check={check?.locked ? 'locked' : ''}>
              {check?.locked ? <Lock size={15} aria-hidden /> : <RefreshCw size={15} aria-hidden className={scan ? 'wf-anim wf-spin' : ''} />}{scan ? 'Reading…' : hasRead ? 'Check facts again' : 'Read website'}
            </button>
            {check?.tip && !scan && <span id="fc-check-tip" role="tooltip" className="tip-dark pointer-events-none absolute right-0 top-full z-40 mt-2 w-max max-w-[280px] text-left opacity-0 transition-opacity duration-150 group-hover/fc:opacity-100 group-focus-within/fc:opacity-100">{check.tip}</span>}
          </span>
          <HeaderBell className="-ml-2" />
        </div>
      </div>
      {hasRead ? (
        <div className="flex flex-col gap-3">
          <p className={`flex flex-wrap items-baseline gap-x-3 ${dim}`}>
            <b className="num text-[48px] leading-[52px] font-semibold tracking-[-0.03em] text-stone-900">{counted}</b>
            <span className="text-[15.5px] leading-[23px] text-stone-600" aria-live="polite">{scanLine ?? (total === 1 ? 'fact found on your site' : 'facts found on your site')}</span>
          </p>
          {/* one segment per fact, grouped by result, with its count under each group. app (owner, 2026-11-12): a group
              hovered or focused (segments and label, one target): its segments go to their full-strength colour and grow
              slightly taller, its label crossfades to full contrast and 600 with "↓"; the other groups ease to 45%. All as
              transitions on colour, opacity and transform (180ms in, 220ms out), so moving between groups cross-fades
              directly. Pressed: the click opens the list at once. Reduced motion: no growth (fc-seg2 / fc-group). */}
          <div className="flex gap-4" onMouseLeave={() => setSeg(null)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setSeg(null) }}>
            {parts.map((p) => {
              const on = seg === p.id
              return (
                <button key={p.id} type="button" data-fc-go={p.id} onClick={() => onGo(RESULT_FILTER[p.id])}
                  onMouseEnter={() => setSeg(p.id)} onFocus={() => setSeg(p.id)}
                  className={`group/seg fc-group -my-1.5 flex min-w-0 cursor-pointer flex-col gap-2.5 py-1.5 text-left outline-none ${seg && !on ? 'fc-group-dim' : ''}`} style={{ flexGrow: p.n, flexBasis: 0 }}>
                  <div className="fc-segs flex gap-[3px]">
                    {Array.from({ length: p.n }, (_, i) => (
                      <span key={i} className={`fc-seg2 relative h-[13px] min-w-0 flex-1 rounded-[3px] border-[1.5px] ${on ? p.on : p.rest} ${on ? 'fc-seg2-on' : ''}`} />
                    ))}
                  </div>
                  <span className="w-fit rounded group-focus-visible/seg:ring-2 group-focus-visible/seg:ring-focus"><StatusLabel n={<b className={p.tone ? 'font-semibold' : val}><Ticking n={p.n} /></b>} word={p.word} on={on} tone={p.tone} className="truncate" /></span>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        // app (owner, 2026-11-12): the brand's name (yourSite), never its domain
        <p className="max-w-[760px] text-[20px] leading-[28px] font-normal tracking-[-0.01em] text-stone-600 [text-wrap:pretty]" aria-live="polite">
          {scan ? <>Reading <b className={val}>{yourSite()}</b>. This takes a few minutes; you can leave the page.</>
            : <>We haven’t read <b className={val}>{yourSite()}</b> yet. Reading it finds your contact details, ratings, awards and claims, and <b className={val}>checks each one against its source</b>.</>}
        </p>
      )}
      {/* as the app (#226 / #227): no read-error line for anyone; a superadmin sees the reason as one small muted line */}
      <AdminOnlyReason className="-mt-2">{failed?.message}</AdminOnlyReason>
    </section>
  )
}

// app (owner, 2026-11-12): a grouped claim's other wordings (lib/fact-check-rules.js groupClaims): "+N similar
// wordings", a quiet secondary text button. Hover or focus shows them (EdgeTip); a click opens them in place, each
// stored value with the pages it was found on. Reduced motion: no animation (card-in).
function SimilarWordings({ g, className = '' }) {
  const list = similarWordings(g)
  const [open, setOpen] = useState(false)
  const id = useId()
  if (!list.length) return null
  const lines = list.map((w) => (
    <span key={w.id} className="flex flex-col">
      <span className="text-stone-900 [overflow-wrap:anywhere]">{w.value}</span>
      {w.pages.length > 0 && <span className="text-stone-600 [overflow-wrap:anywhere]">{w.pages.map(where).join(', ')}</span>}
    </span>
  ))
  return (
    <div className={`min-w-0 ${className}`}>
      <EdgeTip focusable={false} className="inline-block" tip={open ? null : <span className="flex flex-col gap-1.5">{lines}</span>}>{/* app (owner, 2026-11-12): opened, no card: it would cover the list */}
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
          className={`num rounded text-[13px] leading-[18px] font-normal text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline ${focus}`}>+{plural(list.length, 'similar wording')}</button>
      </EdgeTip>
      {open && <div id={id} className="wf-anim card-in mt-1 flex flex-col gap-1.5 text-[13px] leading-[18px]">{lines}</div>}
    </div>
  )
}

// ---- Your call: every decision has the same shape and no boxes. A numbered header (the fact's name, "Doesn't match",
// and "Drop this fact" at the right where the fact can simply be left out), then two plain columns split by one
// hairline: who says it, the value, the quote, the action. Hovering a side that can be kept underlines its value in
// red; choosing it fades the other side, and the decision collapses to one line with Undo.
function CallSide({ g, logo, label, value, quote, kept, dim, pick = false, children }) {
  const line = kept ? 'decoration-[var(--negative)]' : pick && !dim ? 'decoration-transparent group-hover/side:decoration-[var(--negative)] group-focus-within/side:decoration-[var(--negative)]' : 'decoration-transparent'
  return (
    <div {...useHot(g.pages)} className={`group/side flex min-w-0 flex-col gap-1.5 px-5 transition-opacity duration-300 first:pl-0 last:pr-0 ${dim ? 'opacity-25' : ''}`}>
      <span className={`flex items-center gap-2 ${sub}`}>{logo}<span className="min-w-0 truncate">{label}</span></span>
      <span className={`${big} w-fit underline decoration-2 underline-offset-[6px] transition-[text-decoration-color] duration-150 [text-wrap:balance] ${line}`}>{value}</span>
      {quote}
      <div className="mt-auto flex min-h-9 items-center pt-1">{children}</div>
    </div>
  )
}
// app (owner, 2026-11-12): "Fix this one": where the site's sentence can be fixed (lib/fact-check-rules.js fixLinkOf: a
// WordPress site's admin search for the page, else the live page at the sentence), in a new tab. The decision stays open.
function FixLink({ g, className = '' }) {
  const { cms } = useFactCheck()
  const site = siteEvidence(g.lead)
  const fix = site && fixLinkOf({ cms, domain: brand.domain, url: site.url, quote: site.snippet, cmsLink: cmsLinkFor })
  if (!fix) return null
  return (
    <EdgeTip focusable={false} tip={fix.tip} className="inline-block">
      <a href={fix.href} target="_blank" rel="noopener noreferrer" aria-label={`Fix this one: ${fix.tip}`} className={`${secondary} ${className}`}>Fix this one</a>
    </EdgeTip>
  )
}
export const FIX_AFTER = 'After you fix it, check facts again'
function SiteSide({ g, value, onKeep, picked }) {
  const site = siteEvidence(g.lead)
  const kept = picked === g.id
  return (
    <CallSide g={g} pick kept={kept} dim={!!picked && !kept} logo={<BrandLogo size="h-5 w-5 rounded" />} label={`${brandName() ?? 'Your site'}${site ? ` · ${where(site.url)}` : ''}`}
      value={value ?? g.lead.value} quote={<>{site && <p className={`${sub} [text-wrap:pretty]`}>“{site.snippet}”</p>}<SimilarWordings g={g} />{/* app */}</>}>
      <span className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!!picked} onClick={onKeep} className={`${secondary} ${kept ? 'disabled:opacity-100' : ''}`}>{kept && <Check size={15} aria-hidden />}{kept ? 'Kept' : 'Keep this one'}</button>
        {!picked && <FixLink g={g} />}
      </span>
    </CallSide>
  )
}
const ResolvedLine = ({ r, onUndo, held }) => (
  <p className="wf-anim card-in flex flex-wrap items-center gap-x-1.5 px-5 py-3 text-[14px] leading-5 text-stone-600">
    <Check size={15} aria-hidden className="mr-1 shrink-0 text-stone-700" />
    <b className={val}>{r.name}</b> · <span className="min-w-0">{r.result}</span>{held && <> · <button type="button" onClick={() => onUndo(r)} className={link}>Undo</button></>}{/* app: Undo while the call is held */}
  </p>
)

// a number that ticks to its new value (the Confirm button's, the fact sheet's line's)
const Ticking = ({ n }) => <span className="num">{useCountUp(n, 200)}</span>

// app: KindPicker restored from the mock's 3faf114^ (removed there by mistake; AddFact still uses it). It lists ADD_KINDS:
// only the four kinds the route accepts (note, phone, email, address).
// ---- Add a fact: our own kind picker (searchable, icons, grouped), a text field, Add --------------------------------
function KindPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  const box = useRef(null)
  const all = ADD_KINDS.flatMap((g) => g.items)
  const hit = (it) => `${it.label} ${it.hint}`.toLowerCase().includes(q.trim().toLowerCase())
  const shown = all.filter(hit)
  const cur = all.find((it) => it.field === value) ?? all[0]
  const Cur = KIND_ICON[cur.field]
  useEffect(() => {
    if (!open) return undefined
    const away = (e) => { if (!box.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])
  const pick = (it) => { onChange(it.field); setOpen(false); setQ('') }
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % Math.max(1, shown.length)) }
    if (e.key === 'Enter' && shown[at]) { e.preventDefault(); pick(shown[at]) }
  }
  return (
    <div ref={box} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`Kind: ${cur.label}`} onClick={() => { setOpen((o) => !o); setAt(Math.max(0, shown.indexOf(cur))) }}
        className={`flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-raised px-3 text-[14px] font-semibold text-stone-900 transition-colors duration-150 hover:border-[var(--color-line-strong)] ${focus}`}>
        <Cur size={15} aria-hidden className="text-stone-600" />{cur.label}<ChevronDown size={14} aria-hidden className="ml-auto text-stone-600" />
      </button>
      {open && (
        <div className="wf-anim card-in absolute left-0 top-full z-40 mt-1.5 w-[300px] max-w-[calc(100vw-48px)] rounded-xl border border-line bg-raised p-1.5 shadow-lg" onKeyDown={onKey}>
          <label className="flex h-9 items-center gap-2 px-2 text-stone-600">
            <Search size={14} aria-hidden />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setAt(0) }} placeholder="Search kinds…" aria-label="Search kinds" className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-stone-900 outline-none placeholder:text-stone-600" />
          </label>
          <div role="listbox" aria-label="Kind of fact" className="border-t border-[var(--div)] pt-1">
            {ADD_KINDS.map((g) => {
              const items = g.items.filter(hit)
              if (!items.length) return null
              return (
                <div key={g.group}>
                  <p className="px-2 pb-1 pt-2 text-[12px] leading-4 text-stone-600">{g.group}</p>
                  {items.map((it) => {
                    const I = KIND_ICON[it.field]
                    return (
                      <button key={it.field} type="button" role="option" aria-selected={it.field === value} onMouseEnter={() => setAt(shown.indexOf(it))} onClick={() => pick(it)}
                        className={`flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left ${shown[at] === it ? 'bg-tint' : ''} ${focus}`}>
                        <I size={15} aria-hidden className="shrink-0 text-stone-600" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] leading-5 font-semibold text-stone-900">{it.label}</span>
                          <span className="block text-[12px] leading-4 text-stone-600">{it.hint}</span>
                        </span>
                        {it.field === value && <Check size={14} aria-hidden className="shrink-0 text-stone-700" />}
                      </button>
                    )
                  })}
                </div>
              )
            })}
            {!shown.length && <p className="px-2 py-3 text-[13px] text-stone-600">No kind matches “{q}”.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
// A floating panel anchored to the control that opened it: Esc and a click outside close it, Tab stays inside it, and
// focus goes back to the control. (An open kind list inside it takes Esc first.)
// app (owner, 2026-11-12): panelRef: a panel drawn elsewhere (a portal), which counts as inside too
function usePanel(open, close, wrap, opener, panelRef = null) {
  useEffect(() => {
    if (!open) return undefined
    const away = (e) => { if (!wrap.current?.contains(e.target) && !panelRef?.current?.contains(e.target)) close() }
    const key = (e) => {
      const panel = panelRef?.current ?? wrap.current?.querySelector('[role=dialog]')
      if (!panel) return
      if (e.key === 'Escape') { if (panel.querySelector('[role=listbox]')) return; close(); opener.current?.focus(); return }
      if (e.key !== 'Tab') return
      const stops = [...panel.querySelectorAll('button:not([disabled]), input, a[href], [tabindex="0"]')]
      if (!stops.length) return
      const first = stops[0], last = stops[stops.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() } else if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
}

// "+ Add a fact": a quiet text button at the right of the fact sheet's header. It opens a popover under it (the card doesn't grow): the
// kind picker, a field, Add fact and Cancel.
// app (owner, 2026-11-12, motion pass): a floating panel stays mounted for its closing fade (fast), then unmounts;
// reduced motion: it goes at once. → [shown, closing]
function useExit(open, ms = 120) {
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) { setMounted(true); return undefined }
    if (reduced()) { setMounted(false); return undefined }
    const t = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(t)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  return [open || mounted, !open && mounted]
}
function AddFact({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('note')
  const [value, setValue] = useState('')
  const wrap = useRef(null)
  const opener = useRef(null)
  usePanel(open, () => setOpen(false), wrap, opener)
  const [shown, closing] = useExit(open)
  const submit = (e) => { e.preventDefault(); if (!value.trim()) return; onAdd(kind, value.trim()); setValue(''); setOpen(false); opener.current?.focus() }
  return (
    <div ref={wrap} className="relative shrink-0">
      <button ref={opener} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`fc-tl inline-flex items-center gap-1 rounded text-[13.5px] leading-[19px] font-semibold text-stone-600 hover:text-stone-900 ${focus}`}>
        <Plus size={13} aria-hidden />Add a fact
      </button>
      {shown && (
        <form role="dialog" aria-label="Add a fact" onSubmit={submit} inert={closing ? '' : undefined} className={`${closing ? 'fc-pop-out' : 'fc-pop-in'} absolute right-0 top-full z-40 mt-2 flex w-[min(360px,calc(100vw-48px))] origin-top-right flex-col gap-2 rounded-xl border border-line bg-raised p-3 shadow-lg`}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="sm:w-36"><KindPicker value={kind} onChange={setKind} /></div>
            <input id="wf-add-value" autoFocus value={value} onChange={(e) => setValue(e.target.value)} aria-label="The fact" placeholder="e.g. Free returns within 30 days"
              className={`h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-[14px] text-stone-900 placeholder:text-stone-600 hover:border-[var(--color-line-strong)] ${focus}`} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={!value.trim()} className={primary}>Add fact</button>
            <button type="button" className={secondary} onClick={() => { setOpen(false); opener.current?.focus() }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}

// ---- a fact sheet block's hover card (app, owner 2026-11-12) ---------------------------------------------------------
// Below the block (above it when there's no room below), its left edge at the block's, a 6px gap, kept inside the fact
// sheet card's left and right edges (and the viewport): never over the block or its logo. It opens 150ms after the
// pointer (or focus) arrives, so moving across blocks doesn't flicker, and stays open while the pointer is on it (a
// short grace when leaving the block). It fades and scales in (wf-panel, 160ms); reduced motion: it just appears.
// block / bounds: rects ({ left, right, top, bottom }); w, h: the card's size; vh: the viewport's height
export function placeSheetTip(block, w, h, bounds, vh, gap = 6) {
  const lo = Math.max(8, bounds.left)
  const hi = Math.max(lo, bounds.right - w)
  const left = Math.min(Math.max(block.left, lo), hi)
  const below = block.bottom + gap + h <= vh - 8
  const up = !below && block.top - gap - h >= 8
  return { left, top: up ? block.top - gap - h : block.bottom + gap, up }
}
export const TIP_DELAY = 150 // ms before the card opens
const OUT_MS = 200 // a block taken out of the sheet fades this long, then the others close up
// app (owner, 2026-11-11): the rows a list shows, with the ones that just left (a confirm, an Undo, a dismiss) kept in
// their old place, marked out, until they've faded. lists: { [kind]: [{ id, … }] } in order. app (owner, 2026-11-12):
// what left is worked out while rendering (not after), so the very render where a fact leaves Ready to confirm still
// has its row, and the fact sheet's block can glide in from it; reduced motion: it goes at once.
function useLeaving(lists) {
  const ids = Object.values(lists).flat().map((r) => r.id).join(',')
  const [seen, setSeen] = useState({ ids, lists })
  const [gone, setGone] = useState({}) // id → { kind, row, at }
  if (seen.ids !== ids) {
    const now = new Set(Object.values(lists).flat().map((r) => r.id))
    const left = Object.entries(seen.lists).flatMap(([kind, list]) => list.map((row, at) => ({ kind, row, at })).filter((x) => !now.has(x.row.id)))
    setSeen({ ids, lists })
    setGone((o) => {
      const stay = Object.fromEntries(Object.entries(o).filter(([id]) => !now.has(id)))
      return left.length && !reduced() ? { ...stay, ...Object.fromEntries(left.map((x) => [x.row.id, x])) } : stay
    })
  }
  const goneIds = Object.keys(gone).join(',')
  useEffect(() => {
    if (!goneIds) return undefined
    const t = setTimeout(() => setGone({}), OUT_MS) // faded (and collapsed) by now
    return () => clearTimeout(t)
  }, [goneIds])
  const shown = {}
  for (const [kind, list] of Object.entries(lists)) {
    const rows = [...list]
    Object.values(gone).filter((x) => x.kind === kind).sort((x, y) => x.at - y.at).forEach((x) => rows.splice(Math.min(x.at, rows.length), 0, { ...x.row, out: true }))
    shown[kind] = rows
  }
  return shown
}
const quiet = `rounded underline-offset-2 hover:underline ${focus}`
// ---- "N removed" (app, owner 2026-11-12): a quiet text button beside the counts line (none at 0). It opens a popover
// of the removed facts, grouped as everywhere (bucketsOf removed: a turned-down wording of a claim still in use or
// waiting isn't a removal and isn't listed): logo or line icon, the stored value, its page, "+N similar wordings", and
// "Use again" (confirms the whole group; held 5 s with Undo). One that contradicts a fact in use says so first
// ("Conflicts with Over 20 years · reopens the decision"): used again, it goes to Your call, not the fact sheet.
function RemovedRow({ g, i, out, conflict, onUse }) {
  const f = g.lead
  const page = foundOnPages(g)[0]
  return (
    <li data-wf-from={g.id} aria-hidden={out || undefined} inert={out ? '' : undefined}
      className={`wf-anim flex items-start gap-3 py-[7px] ${out ? 'wf-row-out' : 'wf-row-in'}`} style={out ? undefined : { animationDelay: `${i * 60}ms` }}>
      <span className="grid h-6 w-6 shrink-0 place-items-center"><Mark fact={f} size={markOf(f) ? 20 : 16} /></span>
      <span className="min-w-0 flex-1">
        <span className={`block py-0.5 text-[14px] leading-5 ${val} [overflow-wrap:anywhere]`}>{f.value}</span>
        <span className={`block ${sub}`}>{page ? where(page) : f.source === 'YOU' ? 'Added by you' : KIND[f.field]}</span>
        {conflict && <span className={`block ${sub}`} data-fc-conflict="">Conflicts with {conflict.lead.value} · reopens the decision</span>}
        <SimilarWordings g={g} />
      </span>
      <button type="button" disabled={out} onClick={() => onUse(g)} className={smallSecondary}>Show again</button>
    </li>
  )
}
// app (owner, 2026-11-12): a hidden page text. The route can't set it back to waiting, so its way back is "Use as a
// fact" (the page texts' existing add + reject), said on the row; docs/proposals-for-harsh.md asks for a real restore.
function HiddenTextRow({ f, i, onUse, busy }) {
  const Icon = KIND_ICON[f.field] ?? StickyNote
  const page = siteEvidence(f)?.url
  return (
    <li data-wf-from={f.id} className="wf-anim wf-row-in flex items-start gap-3 py-[7px]" style={{ animationDelay: `${i * 60}ms` }}>
      <span className="grid h-6 w-6 shrink-0 place-items-center text-stone-600"><Icon size={16} strokeWidth={1.75} aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className={`block py-0.5 text-[14px] leading-5 ${val} [overflow-wrap:anywhere]`}>{f.value}</span>
        <span className={`block ${sub}`}>{KIND[f.field]}{page ? ` · ${where(page)}` : ''}</span>
        <span className={`block ${sub}`}>Can’t go back to waiting yet · Use as a fact</span>
      </span>
      <button type="button" disabled={busy} onClick={() => onUse(f)} className={smallSecondary}>Use as a fact</button>
    </li>
  )
}
function RemovedFacts({ list, texts = [], inUse, readYear, onUse, onUseText, busy = new Set() }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const opener = useRef(null)
  usePanel(open, () => setOpen(false), wrap, opener)
  const { rows } = useLeaving({ rows: list.map((g) => ({ id: g.id, g })) })
  if (!list.length && !texts.length && !open) return null
  return (
    <span ref={wrap} className="relative inline-block">
      <button ref={opener} type="button" aria-haspopup="dialog" aria-expanded={open} data-fc-removed="" onClick={() => setOpen((o) => !o)}
        className={`${quiet} cursor-pointer text-stone-600 hover:text-stone-900`}><Ticking n={list.length + texts.length} /> hidden</button>
      {open && (
        <div role="dialog" aria-label="Hidden" className="wf-anim wf-panel absolute left-0 top-full z-40 mt-2 flex w-[min(440px,calc(100vw-48px))] origin-top-left flex-col rounded-xl border border-line bg-raised px-4 pb-2 pt-3 text-left shadow-lg">
          <p className={`text-[15px] leading-[22px] ${val}`}>Hidden</p>
          <p className={sub}>Drafts don’t use these.</p>
          {rows.length + texts.length > 0
            ? <ul className="mt-2 divide-y divide-line border-t border-line">
              {rows.map((r, i) => <RemovedRow key={r.id} g={r.g} i={i} out={!!r.out} conflict={r.out ? null : conflictOf(r.g, inUse, readYear)} onUse={onUse} />)}
              {texts.map((f, i) => <HiddenTextRow key={f.id} f={f} i={rows.length + i} onUse={onUseText} busy={busy.has(f.id)} />)}
            </ul>
            : <p className={`mt-2 border-t border-line py-[11px] ${sub}`}>Nothing hidden</p>}
        </div>
      )}
    </span>
  )
}
// the 5-second line after a Remove or a Use again (Undo while it's held)
const SHEET_SAYS = {
  remove: (v) => <>Hid “{v}” from the fact sheet and its total</>,
  use: (v) => <>“{v}” is back in the fact sheet</>,
  confirm: (v) => <>Confirmed “{v}”</>,
  reopen: (v) => <>“{v}” reopens a decision in Needs your attention</>,
}
const rowLink = (url) => (url ? { href: url, target: '_blank', rel: 'noopener noreferrer' } : {})
// ---- Where we read it (app, owner 2026-11-12): beside the title, one secondary line ("40 of 40 pages read"; any
// pages that failed: "38 of 40 pages read · 2 couldn't be read · Retry", Retry being the paid read). Under it, always
// four boxes of equal width and height, in this order: Home · About · Contact · Other pages (lib/fact-check-rules.js
// boxOf / whereBoxes; Other pages takes the name of a section holding over 60% of its pages, with "+N other pages").
// A box: one header line, its name and page count with the number of facts found there (grouped, as the hero counts
// them) at its right; up to three of them (logo or line icon + the stored value); one footer line, "+N more", whose hover card lists the rest with their pages,
// on the left and "N page texts" on the right. A box
// read with nothing found says "No facts found on this page"; a box the reader didn't reach says "Not read". No box is
// ever hidden. Hover or focus: the box lifts a little and its facts light up in Ready to confirm and the fact sheet;
// a fact hovered elsewhere outlines the boxes it came from. Reduced motion: no lift.
const BOX_COLS = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 [@media(min-width:1100px)]:grid-cols-3', 4: 'sm:grid-cols-2 [@media(min-width:1100px)]:grid-cols-4' } // app: the boxes shown share the width
const BOX_FACTS = 3 // the facts a box names before "+N more" (owner, 2026-11-12: was 4)
const BOX_STAGGER = 90 // ms between the boxes coming in (the mock's)
const LOGO_STAGGER = 60 // ms between a box's logos popping in (the mock's)
const unitName = (u) => (u.pair ? `${shortName(u.pair.a.lead)} / ${shortName(u.pair.b.lead)}` : shortName(u.lead))
function WhereBox({ box, texts, i = 0, picked = false, onPick }) {
  const product = useProductName()
  const { hot, setHot } = useContext(Hot)
  const [active, setActive] = useState(false)
  const urls = new Set(box.read.map((p) => p.url))
  const here = (u) => u.pages.filter((x) => urls.has(x)).map(where).join(', ')
  const lit = hot?.src === 'fact' && box.read.some((p) => hot.urls.has(p.url))
  const enter = () => { if (active) return; setActive(true); setHot(urls.size ? { urls, src: 'tile' } : null) }
  const leave = () => { setActive(false); setHot(null) }
  const these = box.id === 'other' ? 'these pages' : 'this page'
  const rest = box.facts.slice(BOX_FACTS)
  const says = box.state === 'facts' ? plural(box.facts.length, 'fact') : box.state === 'empty' ? `no facts found on ${these}` : 'not read'
  return (
    // app (owner, 2026-11-12): the mock's section boxes stagger in (card-in, 90ms apart) and their facts' logos pop in
    // sequence (wf-pop, 60ms apart); reduced motion: shown (.wf-anim)
    // app (owner, 2026-11-12): the whole box is clickable (Enter too): it filters the facts to this section's (again: all)
    <div tabIndex={0} role="group" aria-label={`${box.label}: ${says}. ${picked ? 'Showing its facts; press Enter to show all' : 'Press Enter to show its facts'}`} aria-current={picked || undefined} data-fc-box={box.id} style={{ animationDelay: `${i * BOX_STAGGER}ms`, animationFillMode: 'backwards' }}
      onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) leave() }}
      onClick={() => onPick?.(box)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) { e.preventDefault(); onPick?.(box) } }}
      className={`wf-anim card-in flex min-w-0 cursor-pointer flex-col gap-2 rounded-lg border px-3.5 py-3 transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out hover:bg-tint ${picked ? 'bg-tint' : 'bg-surface'} ${lit || active || picked ? 'border-stone-600' : 'border-line'} ${active ? '-translate-y-0.5 shadow-md' : ''} ${focus}`}>
      {/* app (owner, 2026-11-12): one header line: name and pages on the left, the fact count at the right */}
      <div className="flex min-w-0 items-center gap-x-3">
        <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
          <span className={`text-[14px] leading-5 ${val}`}>{box.label}</span>
          {box.count > 0 && <span className={`num ${sub}`}>{plural(box.count, 'page')}</span>}
          {box.others > 0 && <span className={`num ${sub}`}>+{plural(box.others, 'other page')}</span>}
        </p>
        {box.state === 'facts' && <b className="num shrink-0 text-[38px] leading-[42px] font-semibold tracking-[-0.02em] text-stone-900">{box.facts.length}</b>}
      </div>
      {box.state === 'facts' ? (
        <ul className="flex flex-col gap-1">
          {box.facts.slice(0, BOX_FACTS).map((u, j) => (
            <li key={u.id} className="flex min-w-0 items-center gap-2">
              <span className="wf-anim wf-pop grid shrink-0 place-items-center" style={{ animationDelay: `${i * BOX_STAGGER + 120 + j * LOGO_STAGGER}ms` }}><Mark fact={u.lead} size={16} /></span>
              <span title={unitName(u)} className={`min-w-0 truncate text-[13px] leading-[18px] ${val}`}>{unitName(u)}</span>
            </li>
          ))}
        </ul>
      ) : box.state === 'empty' ? (
        <p className={sub}>No facts found on {these}</p>
      ) : (
        // app (owner, 2026-11-12): "<Product> didn't reach this page" and, under it, only a reason the read recorded
        // (lib/fact-check-rules.js unreadReason; nothing tried: "We don't know why yet")
        <div>
          <p className="text-[15px] leading-[22px] font-semibold text-stone-600">Not read</p>
          <p className={sub}>{product} didn’t reach {these}</p>
          <p className={sub}>{unreadReason(box.pages)}</p>
        </div>
      )}
      {/* app (owner, 2026-11-12): one footer line: "+N more" on the left, "N page texts" on the right */}
      {(rest.length > 0 || texts?.props?.items?.length > 0) && (
        // app (owner, 2026-11-12): "+N more" and "N page texts" keep their own behaviour, not the box's filter
        <div className="mt-auto flex min-w-0 items-baseline justify-between gap-x-3" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {rest.length > 0 ? (
            <EdgeTip className="w-fit" label={`${rest.length} more: ${rest.map(unitName).join(', ')}`} width={300}
              tip={<span className="flex flex-col gap-1.5">{rest.map((u) => <span key={u.id} className="flex flex-col"><span className="text-stone-900">{unitName(u)}</span><span>{here(u)}</span></span>)}</span>}>
              <span className={`num ${sub} underline-offset-2 hover:text-stone-900 hover:underline`}>+{rest.length} more</span>
            </EdgeTip>
          ) : <span />}
          {texts}
        </div>
      )}
    </div>
  )
}
// texts: { items (page texts not yet decided), gone, failed, onUse, onDismiss, onUndo, busy }: each box gets the ones
// read on its pages (the text's page: its website evidence; none: the home page)
const textBox = (f) => { const u = siteEvidence(f)?.url; return u ? boxOf(u) : 'home' }
function PagesRead({ list, units, hasRead, onRetry, cap, texts, section, onPick, filterLine }) {
  const boxes = useMemo(() => whereBoxes(list, units), [list, units])
  const textsOf = (id) => {
    if (!texts) return null
    const items = texts.items.filter((f) => textBox(f) === id)
    const gone = texts.gone && textBox(texts.gone) === id ? texts.gone : null
    const failed = texts.failed && texts.failedBox === id ? texts.failed : null
    return (items.length > 0 || gone || failed) && <PageTexts items={items} gone={gone} failed={failed} onUse={texts.onUse} onDismiss={texts.onDismiss} onUndo={texts.onUndo} busy={texts.busy} />
  }
  const okPages = list.filter((p) => p.ok).length
  const bad = list.length - okPages
  // app (owner, 2026-11-12): once read, only the boxes with facts show, sharing the full width equally (one box: the
  // full width); none: no card. Before the first read, the four boxes as before.
  const shownBoxes = hasRead ? boxes.filter((box) => box.state === 'facts') : boxes
  if (!shownBoxes.length) return null
  return (
    <section className={`${card} flex flex-col gap-3 p-5 lg:p-6`}>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className={h2}>Where we read it</h2>
        <p className={`num ${sub}`} aria-live="polite">
          {hasRead
            // app (owner, 2026-11-12): no "N of M pages read"; only failures: "N couldn't be read · Retry"
            ? bad > 0 && <><b className={val}>{bad}</b> couldn’t be read · <button type="button" onClick={onRetry} className={link}>Retry</button></>
            : <>Up to <b className={val}>{cap}</b> pages from your sitemap</>}
        </p>
      </div>
      {/* app: [@media(min-width:1100px)] in real pixels (the app's Tailwind 3.4 build of mock.css drops min-[1100px]) */}
      <div className={`grid auto-rows-fr grid-cols-1 gap-3 ${BOX_COLS[shownBoxes.length] ?? BOX_COLS[4]}`}>
        {shownBoxes.map((box, i) => <WhereBox key={box.id} box={box} i={i} texts={textsOf(box.id)} picked={section?.id === box.id} onPick={onPick} />)}
      </div>
      {filterLine}
    </section>
  )
}

// ---- Page texts we read (app, owner 2026-11-12; was the full-width "Read, but not facts" card): text read from a page
// that isn't a fact (the home page's title, meta description and heading). The Where we read it box of the page it came
// from gets a quiet link at its bottom, "3 page texts" (none: no link). It opens a popover anchored to it, drawn in
// <body> so nothing clips it and no box or card changes height: about 520px wide, under the link, or above it when
// there's no room below; it grows from the link (scale and fade) and its rows stagger in. Esc and a click outside close
// it, Tab stays inside it, and focus goes back to the link. Inside: "Page texts we read", "Not treated as facts", then a
// row per text: line icon tile · type · the text (wraps, never cut) · "Use as a fact" (the text joins the fact sheet) ·
// × Dismiss (held 5 s with Undo). Reduced motion: no movement (.wf-anim).
const smallSecondary = `inline-flex h-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface px-2.5 text-[13px] leading-[18px] font-semibold text-stone-900 transition-colors duration-150 hover:border-[var(--color-line-strong)] group-hover/row:bg-tint disabled:opacity-50 ${focus}`
const NOT_FACT_TYPE_W = 'w-[124px]' // the type column: as wide as its longest label ("Meta description") at 13px 600
function NotFactRow({ f, i, onUse, onDismiss, busy, out }) {
  const Icon = KIND_ICON[f.field] ?? StickyNote
  return (
    <li aria-hidden={out || undefined} inert={out ? '' : undefined}
      className={`wf-anim group/row relative isolate flex items-start gap-3 py-[7px] ${out ? 'wf-row-out' : 'wf-row-in'}`} style={out ? undefined : { animationDelay: `${80 + i * 60}ms` }}>
      <span aria-hidden className="wf-anim pointer-events-none absolute inset-y-0 -inset-x-2 -z-10 rounded-md bg-tint opacity-0 transition-opacity duration-150 group-hover/row:opacity-100" />
      <span className="wf-anim grid h-6 w-6 shrink-0 place-items-center rounded-md bg-tint text-stone-600 transition-colors duration-150 group-hover/row:bg-[var(--color-line)]"><Icon size={15} strokeWidth={1.75} aria-hidden /></span>
      <span className={`${NOT_FACT_TYPE_W} hidden shrink-0 py-[3px] text-[13px] leading-[18px] font-semibold text-stone-600 sm:block`}>{KIND[f.field]}</span>
      <span className={`min-w-0 flex-1 py-0.5 text-[14px] leading-5 ${val} [overflow-wrap:anywhere] [text-wrap:pretty]`} data-wf-from={f.id}>{f.value}</span>
      <span className="flex shrink-0 items-center gap-1">
        <button type="button" disabled={busy} onClick={() => onUse(f)} className={smallSecondary}>Use as a fact</button>{/* app: busy while it saves */}
        <span className="group/x relative shrink-0">
          <button type="button" aria-label={`Hide “${f.value}”`} onClick={() => onDismiss(f)} className={`grid h-6 w-6 place-items-center rounded-md text-stone-600 transition-colors duration-150 hover:bg-[var(--color-line)] hover:text-stone-900 ${focus}`}><X size={15} aria-hidden /></button>
          <span role="tooltip" className="pointer-events-none absolute bottom-full right-0 z-30 mb-1 hidden whitespace-nowrap rounded-md border border-line bg-raised px-2 py-1 text-[12px] leading-4 text-stone-900 shadow-sm group-focus-within/x:block group-hover/x:block">Hide</span>
        </span>
      </span>
    </li>
  )
}
const TEXTS_W = 520
// where the popover goes: under the link (or above it when there's no room below), its left edge at the link's, kept
// 8px inside the viewport; origin: the corner it grows from
export function placeTexts(at, w, h, vw, vh, gap = 6) {
  const left = Math.min(Math.max(8, at.left), Math.max(8, vw - 8 - w))
  const up = at.bottom + gap + h > vh - 8 && at.top - gap - h >= 8
  return { left, top: up ? at.top - gap - h : at.bottom + gap, up, origin: `${Math.round(at.left - left)}px ${up ? '100%' : '0'}` }
}
function PageTexts({ items, gone, onUse, onDismiss, onUndo, busy, failed }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const wrap = useRef(null)
  const opener = useRef(null)
  const panel = useRef(null)
  const close = () => { setOpen(false); setPos(null) }
  usePanel(open, close, wrap, opener, panel)
  const { rows } = useLeaving({ rows: items.map((f) => ({ id: f.id, f })) })
  // placed once it's measured, and again when the page scrolls or the window changes size
  useLayoutEffect(() => {
    if (!open) return undefined
    const fit = () => {
      if (!opener.current || !panel.current) return
      const r = panel.current.getBoundingClientRect()
      setPos(placeTexts(opener.current.getBoundingClientRect(), r.width, r.height, window.innerWidth, window.innerHeight))
    }
    fit()
    window.addEventListener('scroll', fit, true)
    window.addEventListener('resize', fit)
    return () => { window.removeEventListener('scroll', fit, true); window.removeEventListener('resize', fit) }
  }, [open])
  const placed = !!pos
  useEffect(() => { if (open && placed) panel.current?.focus({ preventScroll: true }) }, [open, placed]) // focus moves in once it's placed
  if (!items.length && !open) return null
  return (
    <div ref={wrap} className="ml-auto">
      <button ref={opener} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}
        className={`num rounded text-[13px] leading-[18px] font-normal text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline ${focus}`}>{plural(items.length, 'page text')}</button>
      {open && typeof document !== 'undefined' && createPortal(
        // the portal's root is a bare .fixed box in <body> (the mock's styles reach what's inside it)
        <div className="fixed" style={{ position: 'fixed', zIndex: 60, left: pos?.left ?? -9999, top: pos?.top ?? 0, width: `min(${TEXTS_W}px, calc(100vw - 16px))` }}>
          <div ref={panel} role="dialog" aria-modal="false" aria-label="Page texts we read" tabIndex={-1} style={{ transformOrigin: pos?.origin }}
            className={`${pos ? 'wf-anim wf-panel' : 'invisible'} flex flex-col rounded-xl border border-line bg-raised px-4 pb-2 pt-3 shadow-lg outline-none`}>
            <p className={`text-[15px] leading-[22px] ${val}`}>Page texts we read</p>
            <p className={sub}>Not treated as facts</p>
            <ul className="mt-2 divide-y divide-line border-t border-line">{rows.map((r, i) => <NotFactRow key={r.id} f={r.f} i={i} out={!!r.out} onUse={onUse} onDismiss={onDismiss} busy={busy.has(r.id)} />)}</ul>
            {gone && <p className={`wf-anim card-in border-t border-line py-[11px] ${sub}`} aria-live="polite">Hidden “{gone.value}” · <button type="button" onClick={onUndo} className={link}>Undo</button></p>}
            {failed && <FailLine fail={failed} className="border-t border-line py-[11px]" />}{/* app: a save that failed */}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// A status link (goTo) scrolls its card to the top of <main>, below the page container's own top padding (the header
// offset, 32px from lg; read when clicked), then puts it in the spotlight (owner, 2026-11-12; was a ring).
// Reduced motion: it jumps; the dim is instant and nothing rises (.wf-anim, mock.src.css).
const PAGE_TOP = 32 // the page container's top padding from lg (lg:pt-8), when it can't be read
const SPOT_RISE_AT = 300 // ms: the target's items rise in after the scroll (owner, 2026-11-12)
const SPOT_STAGGER = 60 // ms between them
// app (owner, 2026-11-12): the comparison's rows carry their status (data-fc-status: call / ready / kept); a status
// link scrolls to the first row with that status, and the spotlight and the hover preview dim the comparison's other
// rows (both cards' cells), as they dim the other cards
const STATUS_OF = Object.fromEntries(Object.entries(STATUS_TO).map(([k, v]) => [v, k]))
const statusCells = () => [...document.querySelectorAll('[data-fc-compare] [data-fc-status]')]
const firstRowOf = (status) => document.querySelector(`[data-fc-compare] [data-fc-status="${status}"]`)
export function scrollOffset(el) {
  const scroller = el?.closest?.('main')
  return parseFloat(getComputedStyle(scroller?.firstElementChild ?? el).paddingTop) || PAGE_TOP
}

// ---- the comparison (app, owner 2026-11-12): ONE card, "Your website vs outside sources", replacing the four middle
// cards. Two equal halves split by one vertical hairline down the whole list: the site's side on the left, the outside
// source's on the right; one row per fact (grouped wordings) across both halves, a hairline between rows, both halves
// top-aligned (row height: the taller half). Needs your attention first (doesn't match, the site contradicting
// itself), then matches, then the rest (not found, no outside source). Below md each row's halves stack.
const valueText = (v) => (String(v ?? '').length > 48 ? 'text-[15px] leading-[22px] font-semibold text-stone-900' : big)
// the row's outside result: 'agrees' | 'differs' | 'unchecked' | 'nosource' (a source named with no result and no
// source page counts as no outside source, as in the hero's "Checked against"). The stored check result decides
// (owner, 2026-11-13).
const outsideOf = (f) => {
  const src = sourceOf(f)
  const v = verdictOf(f)
  if (!src || (v === 'none' && !outsideEvidence(f))) return 'nosource'
  if (v === 'none') return 'unchecked'
  return v
}
// the source's text as shown: Trustpilot's compared rating ("4.7 / 5"), else the stored text as it is
const sourceShown = (f, snippet) => sourceRatingOf(f, snippet) ?? snippet
function SiteFact({ g, on, onToggle, waiting, count, value, children }) {
  const f = g.lead
  const site = siteEvidence(f)
  const quote = site?.snippet && site.snippet.trim() !== String(f.value).trim() ? site.snippet : null
  const label = site ? where(site.url) : f.status === 'ADDED_BY_YOU' || f.source === 'YOU' ? 'Added by you' : KIND[f.field]
  return (
    <div {...useHot(g.pages)} className="flex items-start gap-3">
      {onToggle && <span className="pt-0.5"><Tick on={on} onChange={onToggle} label={`${on ? 'Hide' : 'Confirm'} “${f.value}”`} /></span>}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={`num flex min-w-0 flex-wrap items-center gap-x-1.5 ${sub}`}>
          <span className="min-w-0 truncate">{label}</span>
          {waiting && <span>· Waiting</span>}
          {count != null && <span>· on {plural(count, 'page')}</span>}
        </span>
        <span className={`${valueText(f.value)} [overflow-wrap:anywhere] [text-wrap:balance]`}>{value ?? f.value}</span>
        {quote && <p className={`${sub} [text-wrap:pretty]`}>“{quote}”</p>}
        <SimilarWordings g={g} />
        {children}
      </div>
    </div>
  )
}
const SAYS = { agrees: 'Matches', differs: 'Doesn’t match' }
function OutsideFact({ g }) {
  const f = g.lead
  const kind = outsideOf(f)
  if (kind === 'nosource') return <p className={sub}>No outside source</p>
  const src = sourceOf(f)
  const out = outsideEvidence(f)
  const diff = kind === 'differs' ? diffOf(f) : null
  const value = kind === 'unchecked' ? null : diff ? <Diff parts={diff.source} /> : (out?.snippet ? sourceShown(f, out.snippet) : f.value)
  const says = SAYS[kind] ?? `Not found on ${src.name}`
  const Row = out?.url ? 'a' : 'div'
  return (
    <Row {...rowLink(out?.url)} aria-label={out?.url ? `${src.name}: ${says}. Open ${src.name}` : undefined}
      className={`-mx-2 -my-1 flex min-w-0 flex-col gap-1 rounded-lg px-2 py-1 ${out?.url ? `cursor-pointer transition-colors duration-150 hover:bg-tint ${focus}` : ''}`}>
      <span className={`flex min-w-0 items-center gap-2 ${sub}`}>
        <SourceLogo src={src} size="h-5 w-5 rounded" />
        <span className="min-w-0 truncate">{src.name}</span>
        {out?.url && <ArrowUpRight size={13} aria-hidden className="ml-auto shrink-0" />}
      </span>
      {value != null && <span className={`${valueText(out?.snippet ?? f.value)} [overflow-wrap:anywhere] [text-wrap:balance]`}>{value}</span>}
      <span className={`text-[13px] leading-[18px] font-semibold ${kind === 'differs' ? 'text-negative' : 'text-stone-600'}`}>{says}</span>
    </Row>
  )
}
const quietBtn = `rounded text-[13px] leading-[18px] font-normal text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline disabled:opacity-50 ${focus}`
function DiffersSite({ g, picked, onKeep, onDrop }) {
  const diff = diffOf(g.lead)
  const kept = picked === g.id
  return (
    <SiteFact g={g} value={diff ? <Diff parts={diff.site} /> : null}>
      <span className="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" disabled={!!picked} onClick={() => onKeep(g)} className={`${secondary} ${kept ? 'disabled:opacity-100' : ''}`}>{kept && <Check size={15} aria-hidden />}{kept ? 'Kept' : 'Keep the site’s claim'}</button>
        {!picked && <FixLink g={g} />}
        <button type="button" disabled={!!picked} onClick={() => onDrop(g)} className={quietBtn}>Hide</button>
      </span>
      <p className={sub}>{FIX_AFTER}</p>
    </SiteFact>
  )
}
// the site contradicting itself: one site value in each half, each with Keep this one / Fix this one; the left half's
// header line names the fact and "Your pages disagree", the right half's says "Also on your website" with "Neither is
// right" at its end (one header line across the row, the middle hairline running through it)
const ConflictLeft = ({ c, picked, onPick }) => (
  <div className="flex flex-col gap-2">
    <p className={`flex flex-wrap items-center gap-x-2 ${sub}`}><b className={val}>{KIND[c.a.lead.field]}</b><span aria-hidden>·</span><span className="text-negative">Your pages disagree</span></p>
    <div><SiteSide g={c.a} picked={picked} onKeep={() => onPick(c.a, c.b)} /></div>
    <p className={sub}>{FIX_AFTER}</p>
  </div>
)
const ConflictRight = ({ c, picked, onPick, onNeither }) => (
  <div className="flex flex-col gap-2">
    <p className={`flex flex-wrap items-center justify-between gap-x-3 ${sub}`}>
      <span className={val}>Also on your website</span>
      <button type="button" disabled={!!picked} onClick={() => onNeither(c)} className={quietBtn}>Neither is right</button>
    </p>
    <div><SiteSide g={c.b} picked={picked} onKeep={() => onPick(c.b, c.a)} /></div>
  </div>
)
// one row across both halves; line: a hairline above it; center: the right half's content centred (No outside source)
const CmpRow = ({ id, status, line = true, left, right, center = false }) => (
  <div className={`grid grid-cols-1 md:grid-cols-2 ${line ? 'border-t border-[var(--div)]' : ''}`} data-fc-row={id} data-fc-status={status}>
    <div className="min-w-0 py-4 md:pr-5">{left}</div>
    <div className={`min-w-0 border-[var(--div)] pb-4 md:border-l md:py-4 md:pl-5 ${center ? 'md:flex md:items-center' : ''}`}>{right}</div>
  </div>
)
function Comparison({ b, groups, calls, total, readAt, scan, onCheck, onAdd, confirm, footer, summary }) {
  return (
    <section aria-labelledby="fc-sheet" className={`${card} flex flex-col p-5 lg:p-6`} data-fc-compare="">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id="fc-sheet" tabIndex={-1} className={`${h2} outline-none`}>Your website vs outside sources</h2>
          <p className={`num ${sub}`}>{summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className={`num ${sub}`}><b className={val}><Ticking n={b.kept.length} /></b> of {total} in use</p>
          <AddFact onAdd={onAdd} />
          <p className={`num ${sub}`}>Checked {readAt ? dayOf(readAt) : '—'} · <button type="button" disabled={!!scan} onClick={onCheck} className={link}>Check sources again</button></p>
          {confirm}
        </div>
      </header>
      <div className="mt-4 flex flex-col">
        <CmpRow id="heads" left={<p className={`flex items-center gap-2 text-[14px] leading-5 ${val}`}><BrandLogo size="h-5 w-5 rounded" />Your website says</p>}
          right={<p className={`text-[14px] leading-5 ${val}`}>Outside sources say</p>} />
        {groups.map((grp) => (
          <Fragment key={grp.id}>
            {grp.label && (
              <CmpRow id={`${grp.id}-label`} status={grp.status}
                left={<p id={grp.labelId} tabIndex={-1} className="-mb-4 text-[13px] leading-[18px] font-semibold text-stone-600 outline-none">{grp.label} <span className="num font-normal">{calls}</span></p>}
                right={<span aria-hidden className="hidden md:block" />} />
            )}
            {grp.rows.map((r, ri) => <CmpRow key={r.id} id={r.id} status={r.status ?? grp.status} line={!(grp.label && ri === 0)} left={r.left} right={r.right} center={r.center} />)}
          </Fragment>
        ))}
      </div>
      <div className="border-t border-[var(--div)] pt-3">{footer}</div>
    </section>
  )
}

// ---- the facts card (app, owner 2026-11-12, step 1): one card, two tabs, every stored fact shown as stored ---------
// "Facts on your site": one row per stored fact for the brand, whatever its status (waiting, confirmed, hidden, page
// texts), no grouping or de-duplication; ordered by status (Waiting, Confirmed, Hidden), then by kind. "Outside
// sources": one row per fact with an outside check stored; the rest counted on one line. The tabs are the app's
// underline tabs (the same classes as Structured Data's and Site Audit's).
const STATUS_WORD = { DISCOVERED: 'Waiting', CONFIRMED: 'Confirmed', ADDED_BY_YOU: 'Confirmed', REJECTED: 'Hidden' }
const STATUS_ORDER = ['DISCOVERED', 'CONFIRMED', 'ADDED_BY_YOU', 'REJECTED']
const KIND_ORDER = Object.keys(KIND)
const rank = (list, v) => { const i = list.indexOf(v); return i < 0 ? list.length : i }
export const factRowsOrder = (facts) => facts.map((f, i) => ({ f, i })).sort((x, y) =>
  rank(STATUS_ORDER, x.f.status) - rank(STATUS_ORDER, y.f.status) || rank(KIND_ORDER, x.f.field) - rank(KIND_ORDER, y.f.field) || x.i - y.i).map((x) => x.f)
// an outside check is stored: a source page in the evidence, or a check note that reached a result
const CHECK_WORD = { agrees: 'Matches', differs: 'Doesn’t match', unchecked: 'Could not confirm' }
export { hasOutsideCheck } // app: lib/fact-check-rules.js (an outside check is stored)
// the stored check result, as stored (owner, 2026-11-13: never re-judged on the page)
const checkKind = (f) => checkResultOf(f.notes)
const checkWord = (f) => CHECK_WORD[checkKind(f)] ?? 'Checked'
// the result as shown: "Matches" with a small tick, "Doesn't match" in Sentiment red, else the plain word
const Result = ({ kind, word }) => (
  <span className={`inline-flex shrink-0 items-center gap-1 text-[13.5px] leading-[19px] font-semibold ${kind === 'differs' ? 'text-negative' : 'text-stone-600'}`}>
    {kind === 'agrees' && <Check size={13} aria-hidden />}{word}
  </span>
)
const urlHost = (u) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }
const tabBtn = (on) => `-mb-px inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 text-[14.5px] leading-[21px] font-medium outline-none md:h-10 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'border-ink text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900'}`
// rise: the row's index when the list fades up in sequence (wf-row-in, 60ms apart; none under reduced motion)
const riseOf = (i) => (i == null ? {} : { className: 'wf-anim wf-row-in', style: { animationDelay: `${Math.min(i, 12) * 60}ms` } })
// app (owner, 2026-11-12): "Fix it" on a row that doesn't match (or one of two site claims that contradict each
// other): the client's own page where the claim lives, in a new tab (lib/fact-check-rules.js fixLinkOf: a WordPress
// site's admin search for the page; the home page, which has no slug, and any other site: the live page at the stored
// sentence). No page stored: no button. A click shows "After you fix it, check facts again" under the row (this visit
// only); the row's status doesn't change.
function FixIt({ f, fix, className = smallSecondary }) {
  const { cms } = useFactCheck()
  const site = siteEvidence(f)
  const link = site && fixLinkOf({ cms, domain: brand.domain, url: site.url, quote: site.snippet, cmsLink: cmsLinkFor })
  if (!fix?.can.has(f.id) || !link) return null
  return (
    <EdgeTip focusable={false} tip={link.tip} className="inline-flex">
      <a href={link.href} target="_blank" rel="noopener noreferrer" aria-label={`Fix it: ${link.tip}`} data-fc-fix={f.id}
        onClick={(e) => { e.stopPropagation(); fix.onFix(f.id) }} className={className}>Fix it</a>
    </EdgeTip>
  )
}
const FixAfter = ({ f, fix }) => (fix?.done.has(f.id) ? <span className={`block ${sub}`} data-fc-fix-after="">{FIX_AFTER}</span> : null)
// app (owner, 2026-11-12): the expanded list's rows. An icon tile (the source's or certifier's logo, else the kind's
// line icon), the kind small, the stored value one step larger with the result at its right, the page as a short link;
// one filled button for the row's main action ("Fix it" on a row that doesn't match, else "Confirm" on a row to
// review), the rest quiet text buttons. Hover: a soft background.
const rowPrimary = `fc-btn inline-flex h-[30px] shrink-0 items-center justify-center rounded-md bg-ink px-[11px] text-[13.5px] leading-[19px] font-semibold text-on-ink hover:bg-ink-hover disabled:opacity-50 ${focus}`
const tile = 'fc-tile grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tint'
const kindLine = 'text-[12.5px] leading-[17px] text-stone-600'
const rowValue = 'text-[15.5px] leading-[23px] font-semibold text-stone-900'
// a page as its short label (lib/fact-check-rules.js pageLabelOf), a link to the page, the full URL on hover
const PageLink = ({ url, className = '' }) => (
  <a href={url} target="_blank" rel="noopener noreferrer" title={url} onClick={(e) => e.stopPropagation()}
    className={`fc-tl inline-block max-w-full truncate rounded align-bottom hover:text-stone-900 ${focus} ${className}`}>{pageLabelOf(url)}</a>
)
// app (owner, 2026-11-13): a row that stands for several stored wordings of one claim (lib/fact-check-rules.js
// claimRows): "+2 similar wordings" in secondary after the page label; hover or focus lists the other wordings with
// their pages (the tooltips' card)
function RowWordings({ f }) {
  const list = f.wordings ?? []
  if (!list.length) return null
  const lines = list.map((w) => (
    <span key={w.id} className="flex flex-col">
      <span className="text-stone-900 [overflow-wrap:anywhere]">{w.value}</span>
      {w.pages.length > 0 && <span className="text-stone-600 [overflow-wrap:anywhere]">{[...new Set(w.pages)].map(where).join(', ')}</span>}
    </span>
  ))
  return (
    <span className="shrink-0" data-fc-wordings={list.length}>
      <span aria-hidden className="px-1">·</span>
      <EdgeTip className="inline-block" tip={<span className="flex flex-col gap-1.5">{lines}</span>}>
        <span className="num cursor-default">+{plural(list.length, 'similar wording')}</span>
      </EdgeTip>
    </span>
  )
}
const resultOf = (f, fix) => (fix?.can.has(f.id) ? 'differs' : hasOutsideCheck(f) ? checkKind(f) : null)
// app (owner, 2026-11-12): "Why?" after every "Doesn't match": a small secondary text link. Hovering or focusing it shows
// a small card (the tooltips' style, about 240px) above it, below when there's no room, after 150ms (TIP_DELAY); it
// stays while the pointer is on it and closes on leave or Esc; a tap toggles it on touch. Inside, only the two values
// that differ (lib/fact-check-rules.js whyOf): the site's and the source's compared part (the source's in Sentiment red)
// and when it was checked, or the two site claims with their pages; when the compared part can't be extracted cleanly,
// the two stored values, one line each. No sentence, no buttons, no links.
const WHY_W = 240
const WHY_GRACE = 120 // ms the card waits when the pointer leaves the link, so it can reach the card
export function placeWhy(at, w, h, vw, vh, gap = 6) {
  const left = Math.min(Math.max(8, at.left + at.width / 2 - w / 2), Math.max(8, vw - 8 - w))
  const up = at.top - gap - h >= 8
  return { left, top: up ? at.top - gap - h : at.bottom + gap, up }
}
const sectionOfLabel = (url) => pageLabelOf(url).split(' · ')[0]
function WhyLine({ label, value, red = false }) {
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="max-w-[55%] shrink-0 truncate text-stone-600">{label}</span>
      <span title={value} className={`min-w-0 truncate font-semibold ${red ? 'text-negative' : 'text-stone-900'}`}>{value}</span>
    </span>
  )
}
function WhyLink({ f, why }) {
  const ref = useRef(null)
  const box = useRef(null)
  const timer = useRef(null)
  const id = useId()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const later = (fn, ms) => { clearTimeout(timer.current); timer.current = setTimeout(fn, ms) }
  const show = () => later(() => setOpen(true), TIP_DELAY)
  const hide = () => later(() => setOpen(false), WHY_GRACE)
  const [shown, closing] = useExit(open) // app (owner, 2026-11-12, motion pass): it fades out (fast) before it goes
  const stay = () => clearTimeout(timer.current)
  useEffect(() => () => clearTimeout(timer.current), [])
  useLayoutEffect(() => {
    if (!open || !ref.current || !box.current) return undefined
    const r = box.current.getBoundingClientRect()
    setPos(placeWhy(ref.current.getBoundingClientRect(), r.width, r.height, window.innerWidth, window.innerHeight))
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    const close = () => setOpen(false)
    document.addEventListener('keydown', esc)
    window.addEventListener('scroll', close, true)
    return () => { document.removeEventListener('keydown', esc); window.removeEventListener('scroll', close, true) }
  }, [open])
  if (!why) return null
  const w = shown ? whyOf(f, { partner: why.partners?.get(f.id) ?? null }) : null
  const lines = !w ? null
    : w.kind === 'b' ? w.claims.map((c) => <WhyLine key={c.value} label={c.url ? sectionOfLabel(c.url) : 'Your site'} value={c.value} />)
      : w.kind === 'a' && w.compared ? [<WhyLine key="s" label="Your site" value={w.compared.site} />, <WhyLine key="o" label={w.source.name} value={w.compared.source} red />]
        : [<WhyLine key="s" label="Your site" value={w.site} />, <WhyLine key="o" label={w.source.name} value={w.source.value ?? '—'} />]
  return (
    <>
      <button ref={ref} type="button" aria-describedby={open ? id : undefined} data-fc-why-link={f.id}
        onPointerEnter={(e) => { if (e.pointerType !== 'touch') show() }} onPointerLeave={(e) => { if (e.pointerType !== 'touch') hide() }}
        onFocus={show} onBlur={hide}
        onClick={(e) => { e.stopPropagation(); if (e.nativeEvent?.pointerType === 'touch') { clearTimeout(timer.current); setOpen((o) => !o) } }}
        className={`fc-tl ml-1.5 rounded text-[12.5px] leading-[17px] font-normal text-stone-600 hover:text-stone-900 ${focus}`}>Why?</button>
      {shown && typeof document !== 'undefined' && createPortal(
        // the portal's root is a bare .fixed box in <body> (the mock's styles reach what's inside it)
        <div className="fixed" style={{ position: 'fixed', zIndex: 70, left: pos?.left ?? -9999, top: pos?.top ?? 0, width: WHY_W }} onPointerEnter={stay} onPointerLeave={hide}>
          <div ref={box} id={id} role="tooltip" data-fc-why={w.kind} style={{ transformOrigin: pos?.up ? 'center bottom' : 'center top' }}
            className={`${closing ? 'fc-pop-out' : pos ? 'fc-pop-in' : 'invisible'} flex flex-col gap-1 rounded-md border border-line bg-raised px-3 py-2 text-left text-[12.5px] leading-[17px] font-normal text-stone-700 shadow-md`}>
            {lines}
            {/* as the app (#229): the exact quote from the page, its year set apart, and the page link */}
            <FactQuote evidence={siteEvidence(f)} className="mt-1 border-t border-line pt-1.5" />
            {w.kind === 'a' && w.checkedAt && <span className="num pt-0.5 text-[11.5px] leading-4 text-stone-600">Checked {dayOf(w.checkedAt)}</span>}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
// app (owner, 2026-11-12): a check that couldn't confirm says so, in secondary, where the result sits
const RowResult = ({ kind, f, why }) => (kind === 'agrees' || kind === 'differs'
  ? <span className="inline-flex items-center"><Result kind={kind} word={CHECK_WORD[kind]} />{kind === 'differs' && <WhyLink f={f} why={why} />}</span>
  : kind === 'unchecked' ? <span className="text-[13.5px] leading-[19px] font-semibold text-stone-600">{CHECK_WORD.unchecked}</span> : null)
// app (owner, 2026-11-12): the result on the kind line, after the kind: "Trustpilot rating · Doesn't match" (Sentiment
// red, 600) or "BBB rating · ✓ Matches" (primary, 600); nothing when not checked
const KindResult = ({ kind, f, why }) => (kind === 'agrees' || kind === 'differs'
  ? <><span aria-hidden> · </span><span className={`inline-flex items-center gap-0.5 font-semibold ${kind === 'differs' ? 'text-negative' : 'text-stone-900'}`}>{kind === 'agrees' && <Check size={12} aria-hidden />}{CHECK_WORD[kind]}</span>{kind === 'differs' && <WhyLink f={f} why={why} />}</>
  : kind === 'unchecked' ? <><span aria-hidden> · </span><span>{CHECK_WORD.unchecked}</span></> : null)
// app (owner, 2026-11-12): a row's actions, right-aligned and vertically centred: the quiet text buttons first (16px
// apart), then the one filled button at the right edge (20px before it). Doesn't match: Hide · Confirm (to review
// only) · [Fix it]; to review: Hide · [Confirm]; a page text: Hide · [Use as a fact]; in use: Hide; hidden: Show again
// (a hidden page text: Use as a fact, its way back). No page to fix: the row's other main action takes the button.
const textBtn = `fc-tl rounded text-[13.5px] leading-[19px] font-normal text-stone-600 hover:text-stone-900 disabled:opacity-50 ${focus}`
function RowActions({ f, fix, onConfirm, onHide, onShow, onUseText, busy }) {
  const { cms } = useFactCheck()
  const text = isPageText(f)
  const site = siteEvidence(f)
  const canFix = !!fix?.can.has(f.id) && !!(site && fixLinkOf({ cms, domain: brand.domain, url: site.url, quote: site.snippet, cmsLink: cmsLinkFor }))
  const waiting = f.status === 'DISCOVERED'
  const quiet = []
  let main = null
  if (f.status === 'REJECTED') {
    quiet.push(text
      ? <button key="use" type="button" disabled={busy} onClick={() => onUseText(f)} className={textBtn}>Use as a fact</button>
      : <button key="show" type="button" onClick={() => onShow(f)} className={textBtn}>Show again</button>)
  } else {
    quiet.push(<button key="hide" type="button" onClick={() => onHide(f)} className={textBtn}>Hide</button>)
    if (canFix) {
      if (waiting && !text) quiet.push(<button key="confirm" type="button" onClick={() => onConfirm(f)} className={textBtn}>Confirm</button>)
      if (waiting && text) quiet.push(<button key="use" type="button" disabled={busy} onClick={() => onUseText(f)} className={textBtn}>Use as a fact</button>)
      main = <FixIt f={f} fix={fix} className={rowPrimary} />
    } else if (waiting) {
      main = text
        ? <button type="button" disabled={busy} onClick={() => onUseText(f)} className={rowPrimary}>Use as a fact</button>
        : <button type="button" onClick={() => onConfirm(f)} className={rowPrimary}>Confirm</button>
    }
  }
  return (
    <span className="flex shrink-0 items-center self-center">
      <span className="flex items-center gap-4">{quiet}</span>
      {main && <span className="ml-5 flex">{main}</span>}
    </span>
  )
}
// a row: the li carries the hover and the fade-up; its first child the row itself; an explanation can open under it
// app (owner, 2026-11-12): a full-list row's hairline is its own top border, straight and the column's width (no
// negative margin, no rounded ends); the hover tint fills the same box
const rowLi = (rise, extra = '') => `fc-row group/row min-w-0 border-t border-line px-2 py-3 hover:bg-tint ${rise.className ?? ''} ${extra}`
const rowInner = 'flex min-w-0 items-start gap-3'
// app (owner, 2026-11-12): Confirm on a claim that contradicts one already in use asks first, inline on the row:
// "This contradicts <other value>, which is in use. Confirm anyway?" Confirm runs the usual held confirm; Cancel or Esc
// closes it; focus moves to its Confirm.
function ConfirmAnyway({ f, ask }) {
  const yes = useRef(null)
  useEffect(() => { yes.current?.focus({ preventScroll: true }) }, [])
  const other = ask.partner(f.id)
  return (
    <div role="alertdialog" aria-label="Confirm anyway?" data-fc-ask={f.id} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); ask.cancel() } }}
      className="fc-up mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md bg-tint px-3 py-2">
      <p className="text-[13.5px] leading-[19px] text-stone-900">This contradicts “{other?.value}”, which is in use. Confirm anyway?</p>
      <span className="flex shrink-0 items-center">
        <button type="button" onClick={ask.cancel} className={textBtn}>Cancel</button>
        <span className="ml-5 flex"><button ref={yes} type="button" onClick={() => ask.confirm(f)} className={rowPrimary}>Confirm</button></span>
      </span>
    </div>
  )
}
function SiteRow({ f, onConfirm, onHide, onShow, onUseText, busy, i, fix, why, ask, move = '', ...rest }) {
  const site = siteEvidence(f)
  const text = isPageText(f)
  const rise = riseOf(i)
  const Icon = KIND_ICON[f.field] ?? StickyNote
  const kind = resultOf(f, fix)
  return (
    <li className={rowLi(rise, move)} style={rise.style} data-fc-fact={f.id} inert={move === 'fc-row-out' ? '' : undefined}>
      <div className={rowInner}>
        <span className={tile}>{markOf(f) ? <Mark fact={f} size={22} /> : <Icon size={18} strokeWidth={1.75} aria-hidden className="text-stone-600" />}</span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate ${kindLine}`}>{KIND[f.field] ?? f.field}<KindResult kind={kind} f={f} why={why} /></span>
          {/* app (owner, 2026-11-12): one line, cut at the end, the whole value on hover, so rows in a section line up */}
          <span title={f.value} className={`block truncate ${rowValue}`}>{f.value}</span>
          <span className={`flex min-w-0 ${sub}`}>{site?.url ? <PageLink url={site.url} /> : f.status === 'ADDED_BY_YOU' || f.source === 'YOU' ? 'Added by you' : 'No page stored'}<RowWordings f={f} /></span>
          {text && f.status === 'REJECTED' && <span className={`block ${sub}`}>Can’t go back to waiting yet · Use as a fact</span>}
          <FixAfter f={f} fix={fix} />
        </span>
        <RowActions f={f} fix={fix} onConfirm={onConfirm} onHide={onHide} onShow={onShow} onUseText={onUseText} busy={busy} />
      </div>
      {ask?.id === f.id && <ConfirmAnyway f={f} ask={ask} />}
    </li>
  )
}
const IN_USE_STATUS = new Set(['CONFIRMED', 'ADDED_BY_YOU'])
// an outside source's row; preview: the box's row (the result at its right, no actions), else the expanded list's (the
// result after the source's name, the row's actions at the right)
function SourceRow({ f, i, fix, preview = false, actions = null, move = '' }) {
  const out = outsideEvidence(f)
  const src = sourceOf(f) ?? (out ? { name: urlHost(out.url), domain: urlHost(out.url) } : null)
  const rise = riseOf(i)
  const kind = checkKind(f)
  const why = actions?.why
  const word = <span className="shrink-0 text-[13px] leading-[18px] font-semibold text-stone-600">{checkWord(f)}</span>
  return (
    <li className={rowLi(rise, `${preview ? '!py-3' : ''} ${move}`)} style={rise.style} data-fc-check={f.id} inert={move === 'fc-row-out' ? '' : undefined}>
      <div className={rowInner}>
        <span className={tile}>{src ? <SourceLogo src={src} size="h-[22px] w-[22px] rounded" /> : <Globe size={18} aria-hidden className="text-stone-600" />}</span>
        <span className="min-w-0 flex-1">
          {preview
            ? <span className="flex min-w-0 items-baseline gap-3">
                <span className={`min-w-0 flex-1 ${rowValue}`}>{src?.name ?? 'Outside source'}</span>
                {kind === 'agrees' || kind === 'differs' ? <RowResult kind={kind} f={f} why={why} /> : word}
              </span>
            : <span className={`block truncate ${rowValue}`}>{src?.name ?? 'Outside source'}<span className="text-[13px] leading-[18px]">{kind === 'agrees' || kind === 'differs' ? <KindResult kind={kind} f={f} why={why} /> : <><span aria-hidden className="font-normal text-stone-600"> · </span>{word}</>}</span></span>}
          {/* app (owner, 2026-11-12): each line one line, cut at the end, the whole text on hover */}
          <span title={f.value} className={`block truncate ${sub}`}>Your site: <span className={val}>{f.value}</span></span>
          {/* the source's own text when a source page is stored; otherwise the stored check note, named as such */}
          {out?.snippet
            ? <span title={out.snippet} className={`block truncate ${sub}`}>{src?.name ?? 'The source'} says: <span className={val}>{sourceShown(f, out.snippet)}</span></span>
            : f.notes && <span title={f.notes} className={`block truncate ${sub}`}>Check note: <span className="text-stone-900">{f.notes}</span></span>}
          {/* app (owner, 2026-11-12, step 3): the checked page as a short link, not its raw URL */}
          {out?.url && <a href={out.url} target="_blank" rel="noopener noreferrer" title={out.url} onClick={(e) => e.stopPropagation()} className={`fc-tl inline-flex w-fit items-center gap-0.5 rounded ${sub} hover:text-stone-900 ${focus}`}>Checked on {src?.name ?? urlHost(out.url)}<ArrowUpRight size={13} aria-hidden /></a>}
          <FixAfter f={f} fix={fix} />
        </span>
        {!preview && actions && <RowActions f={f} fix={fix} onConfirm={actions.onConfirm} onHide={actions.onHide} onShow={actions.onShow} onUseText={actions.onUseText} busy={actions.using?.has(f.id)} />}
      </div>
    </li>
  )
}
function FactsCard({ facts, onAdd, onConfirm, onHide, onShow, onUseText, using, footer }) {
  const [tab, setTab] = useState('site')
  const rows = useMemo(() => factRowsOrder(facts), [facts])
  const checked = useMemo(() => facts.filter(hasOutsideCheck), [facts])
  const tabs = [['site', 'Facts on your site', rows.length], ['outside', 'Outside sources', checked.length]]
  const keys = (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setTab((t) => (t === 'site' ? 'outside' : 'site')) } }
  return (
    <section aria-label="Facts" className={`${card} flex flex-col p-5 lg:p-6`} data-fc-facts="">
      <div className="flex items-end justify-between gap-4 border-b border-line">
        <div role="tablist" aria-label="Facts" onKeyDown={keys} className="no-scrollbar flex gap-6 overflow-x-auto">
          {tabs.map(([id, label, n]) => (
            <button key={id} type="button" role="tab" id={`fc-tab-${id}`} aria-controls="fc-panel" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} className={tabBtn(tab === id)}>
              {label}<span className="text-[13px] leading-[18px] font-normal text-stone-500 tabular-nums">{n}</span>
            </button>
          ))}
        </div>
        <div className="mb-2.5 shrink-0"><AddFact onAdd={onAdd} /></div>
      </div>
      <div id="fc-panel" role="tabpanel" aria-labelledby={`fc-tab-${tab}`}>
        {tab === 'site' ? (
          rows.length
            ? <ul className="divide-y divide-line">{rows.map((f) => <SiteRow key={f.id} f={f} onConfirm={onConfirm} onHide={onHide} onShow={onShow} onUseText={onUseText} busy={using.has(f.id)} />)}</ul>
            : <p className={`py-3 ${sub}`}>No facts stored yet</p>
        ) : (
          <>
            {checked.length > 0 && <ul className="divide-y divide-line">{checked.map((f) => <SourceRow key={f.id} f={f} />)}</ul>}
            <p className={`num border-t border-line pt-3 ${checked.length ? '' : 'mt-0'} ${sub}`} data-fc-unchecked="">{plural(facts.length - checked.length, 'fact')} {facts.length - checked.length === 1 ? 'has' : 'have'} no outside check</p>
          </>
        )}
      </div>
      {footer}
    </section>
  )
}

// ---- step 2 (app, owner 2026-11-12): one card, two boxes side by side (the Where we read it boxes' style), each with
// its whole list: left every stored fact as stored, right every fact with an outside check. One filter row above both:
// All · Matches · Mismatched. Matches: the stored check matches (and the stored values don't clearly differ).
// Mismatched: the stored check doesn't match (owner, 2026-11-13: never re-judged on the page), or the fact is one of two site claims that contradict each other (bucketsOf's conflicts; those have no outside check,
// so they show in the left box only). A fact with no outside check, or a check that is neither (could not confirm,
// checked), shows under All only. Counts are distinct facts.
export function factFilters(facts, conflictIds) {
  const g = resultGroupsOf(facts, conflictIds) // app (owner, 2026-11-12): the one partition the hero, filters and lists share
  return { all: facts, matches: g.match, mismatched: g.mismatch }
}
// app (owner, 2026-11-12, step 3): the filter the header's summary and the pop-out share; "Mismatched" now reads
// "Doesn't match", as in the header
// app (owner, 2026-11-12, motion pass): the brands whose page already played its entrance this visit (once per visit)
const introSeen = new Set()
const FILTERS = [['all', 'All'], ['matches', 'Matches'], ['mismatched', 'Doesn’t match']] // app (owner, 2026-11-12): the same words as the rows and the hero
// app (owner, 2026-11-12, expand in place): "View all N", a click on a box and the header's summary open the full list
// below the two boxes, inside the card, full width (no pop-out). One list at a time; its box is selected and its link
// reads "Show less". The section opens with grid rows 0fr → 1fr (250ms, as SyncHistory's rows), the rows fade up in
// sequence (wf-row-in); switching lists or filters fades the new list in (card-in). The boxes never move.
const OUTSIDE_ROWS = 5 // app (owner, 2026-11-12): both boxes show up to 5 rows of the same height, so they sit level
const SITE_ROWS = 5
const LISTS = [['site', 'Facts on your site'], ['outside', 'Outside sources']]
// the preview's order (app, owner 2026-11-12): doesn't match first, then matches, then not checked; page texts last;
// within each, ratings, awards, years in business, other claims, contact
const PREVIEW_ORDER = ['trustpilot_rating', 'bbb_rating', 'award', 'accreditation', 'years', 'claim', 'note', 'brand_name', 'phone', 'email', 'address', 'title', 'description', 'heading']
const RESULT_ORDER = ['differs', 'agrees']
const previewOrder = (facts, mismatched) => {
  const res = (f) => (mismatched.has(f.id) ? 'differs' : hasOutsideCheck(f) ? checkKind(f) : null)
  return factRowsOrder(facts).map((f, i) => ({ f, i })).sort((x, y) =>
    (isPageText(x.f) - isPageText(y.f)) || rank(RESULT_ORDER, res(x.f)) - rank(RESULT_ORDER, res(y.f)) || rank(PREVIEW_ORDER, x.f.field) - rank(PREVIEW_ORDER, y.f.field) || x.i - y.i).map((x) => x.f)
}
const factBox = 'fc-box group/box flex min-w-0 cursor-pointer flex-col gap-4 rounded-lg border bg-surface px-[15px] py-3.5'
// a press on a row's own link stays with it; anywhere else on the box opens (or closes) the list
const fromControl = (e) => { const c = e.target.closest?.('button, a, input'); return !!c && c !== e.currentTarget }
// app (owner, 2026-11-12): a box header's figure: a large number over a small label, a button that opens the box's list
// on that filter; "don't match" in Sentiment red when it isn't 0; a 0 in secondary
function Figure({ n, label, red, onClick }) {
  const tone = n === 0 ? 'text-stone-500' : red ? 'text-negative' : 'text-stone-900'
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick() }} data-fc-figure={label}
      className={`fc-btn group/fig flex min-w-[56px] flex-col items-end rounded px-1 text-right ${focus}`}>
      <b className={`num text-[38px] leading-[42px] font-semibold tracking-[-0.02em] ${tone}`}><Ticking n={n} /></b>
      <span className={`fc-tl text-[13px] leading-[18px] ${n === 0 ? 'text-stone-500' : red ? 'text-negative' : 'text-stone-600'}`}>{label}</span>
    </button>
  )
}
function FactBox({ id, title, line, n, shown, open, onToggle, intro = false, figures = null, onFigure, children }) {
  const click = (e) => { if (!fromControl(e)) onToggle() }
  return (
    <div role="group" tabIndex={0} aria-label={`${title}: ${n}. Press Enter to ${open ? 'show less' : 'view all'}`} aria-expanded={open} aria-controls="fc-list" data-fc-box={id} onClick={click}
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) { e.preventDefault(); onToggle() } }}
      className={`${factBox} ${open ? 'border-stone-500' : 'border-line'} ${focus}`}>{/* app (owner, 2026-11-12): selected: a clearly darker border (stone-500, both themes) */}
      <div className="flex min-w-0 items-start gap-x-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15.5px] leading-[23px] font-semibold text-stone-900">{title}</p>
          <p className={sub}>{line}</p>
        </div>
        {/* app (owner, 2026-11-12): the counts as one small line, vertically centred: "2 match · 3 don't match", each part a
            button to that filter; numbers 600, the don't-match part in Sentiment red (secondary at 0) */}
        {figures
          ? <p className={`num flex shrink-0 items-center self-center ${sub}`} data-fc-counts="">
              {figures.map((g, i) => {
                const word = g.red && g.n === 1 ? 'doesn’t match' : g.label
                const tone = g.red && g.n > 0 ? 'text-negative' : 'text-stone-600'
                return (
                  <span key={g.filter} className="inline-flex items-center">
                    {i > 0 && <span aria-hidden className="px-1.5">·</span>}
                    <button type="button" data-fc-figure={g.label} onClick={(e) => { e.stopPropagation(); onFigure(g.filter) }} className={`fc-tl rounded ${tone} ${g.red && g.n > 0 ? '' : 'hover:text-stone-900'} ${focus}`}>
                      <b className={`font-semibold ${g.red && g.n > 0 ? '' : g.n > 0 ? 'text-stone-900' : ''}`}><Ticking n={g.n} /></b> {word}
                    </button>
                  </span>
                )
              })}
            </p>
          : <b className="num shrink-0 text-[38px] leading-[42px] font-semibold tracking-[-0.02em] text-stone-900"><Ticking n={n} /></b>}
      </div>
      {n > 0 ? <ul className={`divide-y divide-line ${intro ? 'fc-rows-in' : ''}`}>{children}</ul> : <p className={sub}>Nothing here</p>}
      {/* app (owner, 2026-11-12, step 3): hovering the box (or the link) brings the text to full contrast and slides
          "→" in after it; reduced motion: no slide. Open: "Show less" */}
      {(n > 0 || open) && ( /* app (owner, 2026-11-12): at the same place in both boxes, even when every row shows */
        // app (owner, 2026-11-12): "View all N"; while its list is open, "Show less" in the same place (the only one), so
        // both boxes end alike
        <button type="button" onClick={onToggle} aria-expanded={open} data-fc-more="" className={`num mt-auto inline-flex w-fit items-center gap-1 rounded text-[13.5px] leading-[19px] font-semibold transition-colors duration-150 group-hover/box:text-stone-900 hover:text-stone-900 ${open ? 'text-stone-900' : 'text-stone-600'} ${focus}`}>
          {open ? 'Show less' : `View all ${n}`}
          {!open && <span aria-hidden className="-translate-x-1 opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover/box:translate-x-0 group-hover/box:opacity-100 motion-reduce:translate-x-0 motion-reduce:transition-none">→</span>}
        </button>
      )}
    </div>
  )
}
// app (owner, 2026-11-12): the preview's two-line site row: an icon tile centred on both lines · the stored value (600,
// one line, the full value on hover) over its kind (small, secondary) · the result at the right, centred. No buttons
// (Fix it stays on the expanded list's rows). About 12px above and below, a hairline between rows.
function PreviewSiteRow({ f, mismatched, why }) {
  const kind = mismatched ? 'differs' : hasOutsideCheck(f) ? checkKind(f) : null
  const Icon = KIND_ICON[f.field] ?? StickyNote
  return (
    <li className="fc-row flex min-w-0 items-center gap-3 py-3.5 hover:bg-tint" data-fc-fact={f.id}>
      <span className={tile}>{markOf(f) ? <Mark fact={f} size={22} /> : <Icon size={18} strokeWidth={1.75} aria-hidden className="text-stone-600" />}</span>
      <span className="min-w-0 flex-1">
        <span title={f.value} className={`block truncate text-[14.5px] leading-[21px] ${val}`}>{f.value}</span>
        <span className={`flex min-w-0 ${kindLine}`}><span className="truncate">{KIND[f.field] ?? f.field}</span><RowWordings f={f} /></span>
      </span>
      <span className="shrink-0 pl-2"><RowResult kind={kind} f={f} why={why} /></span>
    </li>
  )
}
// app (owner, 2026-11-12): the Outside sources preview's row, the same two-line shape as the site preview's: the source's
// name · what it says in short (lib/fact-check-rules.js sourceShortOf; the full stored text on hover) over "Your site:
// <stored value>", the result at the right ("Doesn't match · Why?" / "✓ Matches"). No "Checked on" link here.
function PreviewSourceRow({ f, mismatched, why }) {
  const out = outsideEvidence(f)
  const src = sourceOf(f) ?? (out ? { name: urlHost(out.url), domain: urlHost(out.url) } : null)
  const name = src?.name ?? 'Outside source'
  const short = sourceShortOf(f, out?.snippet, name)
  const kind = mismatched ? 'differs' : checkKind(f)
  return (
    <li className="fc-row flex min-w-0 items-center gap-3 py-3.5 hover:bg-tint" data-fc-check={f.id}>
      <span className={tile}>{src ? <SourceLogo src={src} size="h-[22px] w-[22px] rounded" /> : <Globe size={18} aria-hidden className="text-stone-600" />}</span>
      <span className="min-w-0 flex-1">
        <span title={out?.snippet || name} className={`block truncate text-[14.5px] leading-[21px] ${val}`}>{name}{short && <> · {short}</>}</span>
        <span title={f.value} className={`block truncate ${kindLine}`}>Your site: {f.value}</span>
      </span>
      <span className="shrink-0 pl-2">{kind === 'agrees' || kind === 'differs' ? <RowResult kind={kind} f={f} why={why} /> : <span className="text-[13px] leading-[18px] font-semibold text-stone-600">{checkWord(f)}</span>}</span>
    </li>
  )
}
// the full list in sections by the fact's status (app, owner 2026-11-12): To review (waiting; rows that don't match or
// contradict another claim first), In use (confirmed), Hidden (collapsed to one line until opened; its rows at 55%).
// Each section its own two-column grid where the width allows, a hairline above each row; an empty section is left out.
const SECTIONS = [
  ['review', 'To review', (f) => f.status === 'DISCOVERED'],
  ['use', 'In use', (f) => IN_USE_STATUS.has(f.status)],
  ['hidden', 'Hidden', (f) => f.status === 'REJECTED'],
]
// app (owner, 2026-11-12, motion pass): a section fades up 8px as it enters the view, once (IntersectionObserver);
// reduced motion: shown at once (fc-reveal, mock.src.css)
function useReveal() {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return undefined }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, seen]
}
// app (owner, 2026-11-12, motion pass): a section's rows are keyed, so rows that stay keep their place; a row that
// leaves (confirmed, hidden, filtered out) fades and collapses where it was (fc-row-out, useLeaving keeps it for that
// moment) and a row that arrives fades up (fc-up). Its count ticks. Reduced motion: rows come and go at once.
function ListSection({ id, label, part, hidden, hiddenOpen, setHiddenOpen, render }) {
  const [ref, seen] = useReveal()
  const shut = hidden && !hiddenOpen
  const { rows } = useLeaving({ rows: part.map((f) => ({ id: f.id, f })) })
  const known = useRef(null)
  if (known.current == null) known.current = new Set(part.map((f) => f.id)) // the first rows don't count as arriving
  const arriving = new Set(part.filter((f) => !known.current.has(f.id)).map((f) => f.id))
  useEffect(() => { part.forEach((f) => known.current.add(f.id)) })
  return (
    <section ref={ref} aria-label={label} data-fc-section={id} className={`fc-reveal ${seen ? 'fc-in' : ''}`}>
      {hidden
        ? <button type="button" aria-expanded={hiddenOpen} onClick={() => setHiddenOpen((o) => !o)} className={`inline-flex items-center gap-1.5 rounded text-[14.5px] leading-[21px] font-semibold text-stone-900 ${focus}`}>
            <ChevronDown size={15} aria-hidden className={`text-stone-600 transition-transform duration-[var(--fc-dur-base)] ease-[var(--fc-ease-move)] motion-reduce:transition-none ${hiddenOpen ? '' : '-rotate-90'}`} />{label} <span className="num font-normal text-stone-500"><Ticking n={part.length} /></span>
          </button>
        : <h3 className="text-[14.5px] leading-[21px] font-semibold text-stone-900">{label} <span className="num font-normal text-stone-500"><Ticking n={part.length} /></span></h3>}
      {/* the Hidden section's rows open and close with their height easing (grid rows 0fr → 1fr) */}
      <div className={`fc-open grid ${shut ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`} aria-hidden={shut || undefined} inert={shut ? '' : undefined}>
        <div className="min-h-0 overflow-hidden">
          <ul className={`mt-1 grid grid-cols-1 gap-x-8 lg:grid-cols-2 ${hidden ? 'opacity-[0.55]' : ''}`}>
            {rows.map((r) => render(r.f, r.out ? 'out' : arriving.has(r.f.id) ? 'in' : null))}
          </ul>
        </div>
      </div>
    </section>
  )
}
function FactList({ list, rows, actions }) {
  const [hiddenOpen, setHiddenOpen] = useState(false)
  if (!rows.length) return <p className={`py-3 ${sub}`}>Nothing here</p>
  const can = actions.fix?.can ?? new Set()
  let n = 0 // the rows' order down the list, for the first fade-up
  return (
    <div className="flex flex-col gap-4 pt-3">
      {SECTIONS.map(([id, label, has]) => {
        let part = rows.filter(has)
        if (!part.length) return null
        if (id === 'review') part = [...part.filter((f) => can.has(f.id)), ...part.filter((f) => !can.has(f.id))]
        const render = (f, move) => {
          const extra = move === 'out' ? 'fc-row-out' : move === 'in' ? 'fc-up' : ''
          return list === 'site'
            ? <SiteRow key={f.id} f={f} {...actions} busy={actions.using.has(f.id)} i={n++} move={extra} />
            : <SourceRow key={f.id} f={f} i={n++} fix={actions.fix} actions={actions} move={extra} />
        }
        return <ListSection key={id} id={id} label={label} part={part} hidden={id === 'hidden'} hiddenOpen={hiddenOpen} setHiddenOpen={setHiddenOpen} render={render} />
      })}
    </div>
  )
}
function FactBoxes({ cmd = null, facts, conflictIds, partners = new Map(), onAdd, onConfirm, onHide, onShow, onUseText, using, footer }) {
  const right = useMemo(() => factRowsOrder(facts).filter(hasOutsideCheck), [facts])
  const sets = useMemo(() => factFilters(facts, conflictIds), [facts, conflictIds])
  const outSets = useMemo(() => factFilters(right, conflictIds), [right, conflictIds]) // the Outside sources list's filters
  const mismatched = new Set(sets.mismatched.map((f) => f.id))
  const left = previewOrder(facts, mismatched)
  // app (owner, 2026-11-12): Fix it on the rows that don't match (the Mismatched filter), and the rows it was clicked on
  const [fixed, setFixed] = useState(() => new Set())
  const fix = { can: mismatched, done: fixed, onFix: (id) => setFixed((s) => new Set(s).add(id)) }
  // app (owner, 2026-11-12): Confirm on a waiting claim whose contradicting claim is in use asks first (ConfirmAnyway)
  const [asking, setAsking] = useState(null)
  const otherInUse = (f) => { const p = partners.get(f.id); return p && IN_USE_STATUS.has(p.status) ? p : null }
  const confirmOrAsk = (f) => (f.status === 'DISCOVERED' && otherInUse(f) ? setAsking(f.id) : onConfirm(f))
  const ask = { id: asking, partner: (id) => partners.get(id), cancel: () => setAsking(null), confirm: (f) => { setAsking(null); onConfirm(f) } }
  const actions = { onConfirm: confirmOrAsk, onHide, onShow, onUseText, using, fix, ask }
  // open: { list, filter } or null; view: the last list shown, kept while the section closes
  const [open, setOpen] = useState(null)
  const [view, setView] = useState({ list: 'site', filter: 'all' })
  const cardRef = useRef(null)
  const [round, setRound] = useState(0) // each opening from closed replays the rows' fade-up
  const show = (list, filter = 'all') => { const v = { list, filter }; if (!open) setRound((r) => r + 1); setView(v); setOpen(v) }
  const close = () => {
    setOpen(null)
    // closing: when the card's top has gone off screen, bring it back into view
    const el = cardRef.current
    const top = el?.closest('main')?.getBoundingClientRect().top ?? 0
    if (el && el.getBoundingClientRect().top < top) { el.style.scrollMarginTop = `${scrollOffset(el)}px`; el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }) }
  }
  const toggle = (list) => (open?.list === list ? close() : show(list))
  // app (owner, 2026-11-12): a hero label opens the Facts on your site list on its filter and scrolls to it
  useEffect(() => {
    if (!cmd) return undefined
    show('site', cmd.filter)
    const t = setTimeout(() => {
      const el = document.getElementById('fc-list')
      if (!el) return
      el.style.scrollMarginTop = `${scrollOffset(el)}px`
      el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' })
    }, 60)
    return () => clearTimeout(t)
  }, [cmd]) // eslint-disable-line react-hooks/exhaustive-deps
  // app (owner, 2026-11-12): what Why?'s hover card is built from (each contradicting claim's other claim)
  actions.why = { partners }
  const why = actions.why
  const base = view.list === 'site' ? facts : facts.filter(hasOutsideCheck)
  const vsets = factFilters(base, conflictIds)
  const rows = factRowsOrder(vsets[view.filter])
  // app (owner, 2026-11-12, motion pass): the open filter's underline, measured once per change (no loop)
  const tabsRef = useRef(null)
  const [bar, setBar] = useState({ x: 0, w: 0 })
  useLayoutEffect(() => {
    const on = tabsRef.current?.querySelector('[aria-selected=true]')
    if (on) setBar({ x: on.offsetLeft, w: on.offsetWidth })
  }, [view.filter, view.list, open])
  // the card fades up once per visit (per brand), after the hero; its preview rows fade up 30ms apart
  const [intro] = useState(() => !introSeen.has(brand.domain))
  useEffect(() => { introSeen.add(brand.domain) }, [])
  return (
    <section ref={cardRef} aria-labelledby="fc-facts-title" className={`${card} flex flex-col p-[22px] lg:p-7 ${intro ? 'fc-up' : ''}`} style={intro ? { animationDelay: '60ms' } : undefined} data-fc-boxes="" data-fc-intro={intro ? '' : undefined}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <h2 id="fc-facts-title" className={h2}>Your facts</h2>
        </div>
        <AddFact onAdd={onAdd} />
      </div>
      <div className="mt-3 grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
        <FactBox intro={intro} id="site" title="Facts on your site" line={`${plural(left.length, 'fact')} read on your website`} n={left.length} shown={SITE_ROWS} open={open?.list === 'site'} onToggle={() => toggle('site')}
          figures={[{ n: sets.matches.length, label: 'match', filter: 'matches' }, { n: sets.mismatched.length, label: 'don’t match', filter: 'mismatched', red: true }]} onFigure={(filter) => show('site', filter)}>
          {left.slice(0, SITE_ROWS).map((f) => <PreviewSiteRow key={f.id} f={f} mismatched={mismatched.has(f.id)} why={why} />)}
        </FactBox>
        <FactBox intro={intro} id="outside" title="Outside sources" line={`${plural(right.length, 'fact')} checked on other sites`} n={right.length} shown={OUTSIDE_ROWS} open={open?.list === 'outside'} onToggle={() => toggle('outside')}
          figures={[{ n: outSets.matches.length, label: 'match', filter: 'matches' }, { n: outSets.mismatched.length, label: 'don’t match', filter: 'mismatched', red: true }]} onFigure={(filter) => show('outside', filter)}>
          {previewOrder(right, mismatched).slice(0, OUTSIDE_ROWS).map((f) => <PreviewSourceRow key={f.id} f={f} mismatched={mismatched.has(f.id)} why={why} />)}
        </FactBox>
      </div>
      {/* the full list, in place: grid rows 0fr → 1fr with a fade (250ms; none under reduced motion) */}
      <div id="fc-list" aria-hidden={!open} inert={open ? undefined : ''} data-fc-list={open ? view.list : ''}
        className={`fc-open grid ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="mt-4 border-t border-line pt-1">
            <div className="flex items-end justify-between gap-4">
              {/* app (owner, 2026-11-12, motion pass): the open filter's underline slides from the old tab to the new one */}
              <div ref={tabsRef} role="tablist" aria-label="Show" className="no-scrollbar relative flex gap-6 overflow-x-auto">
                <span aria-hidden className="fc-tab-bar absolute bottom-0 left-0 h-0.5 bg-ink" style={{ width: bar.w, transform: `translateX(${bar.x}px)` }} />
                {FILTERS.map(([id, label]) => (
                  <button key={id} type="button" role="tab" id={`fc-filter-${id}`} aria-selected={view.filter === id} tabIndex={view.filter === id ? 0 : -1} onClick={() => show(view.list, id)} className={tabBtn(view.filter === id).replace('border-ink', 'border-transparent')}>
                    {label}<span className="text-[13px] leading-[18px] font-normal text-stone-500 tabular-nums"><Ticking n={vsets[id].length} /></span>
                  </button>
                ))}
              </div>
            </div>
            <div key={`${view.list}-${round}`} className="wf-anim card-in">{/* app (motion pass): a filter switch keeps the list; only rows that leave or arrive animate */}
              <FactList list={view.list} rows={rows} actions={actions} />
              {view.list === 'outside' && view.filter === 'all' && <p className={`num border-t border-line pt-3 ${sub}`} data-fc-unchecked="">{plural(facts.length - base.length, 'fact')} {facts.length - base.length === 1 ? 'has' : 'have'} no outside check</p>}
            </div>
          </div>
        </div>
      </div>
      {footer}
    </section>
  )
}

// ---- the page -------------------------------------------------------------------------------------------------------
export default function WebsiteFactsPage() {
  // app: the title is set by the wrapper (useMockPage, with the product's own name); no ?wf= previews, the states come
  // from the real data
  const { facts, pages: list, readAt, reading, readError, round, holds, failed, results } = useFactCheck() // app: the real data
  const hasRead = list.length > 0 // app: read at least once (the route keeps the pages of the last read)
  const readYear = new Date(readAt ?? Date.now()).getUTCFullYear() // app: the year the site was read
  const scan = reading // app: a read is one blocking call: only the button shows it ("Reading…"), no live progress
  const [landing, setLanding] = useState(() => new Set())
  const [picked, setPicked] = useState(null) // the claim kept in a contradiction, while it resolves
  const [flipped, setFlipped] = useState(() => new Set()) // app: Ready to confirm rows the user ticked or unticked
  const [batch, setBatch] = useState(null) // a Confirm in flight: { key } (app: until its calls are sent)
  const [gone, setGone] = useState(null) // the text just dismissed among the page texts (Undo while it's held)
  const [sheetUndo, setSheetUndo] = useState(null) // app: the last Remove / Use again: { key, kind, value } while held
  const [undo, setUndo] = useState(null) // the last Confirm: { key, n }
  const [resolved, setResolved] = useState([]) // calls already made: { key, name, result, ids, pos }
  const [using, setUsing] = useState(() => new Set()) // app: texts being turned into facts
  const [hot, setHot] = useState(null)
  // app (owner, 2026-11-12): a Where we read it box picked: { id, label, urls } (the facts shown are that section's)
  const [section, setSection] = useState(null)
  const [boxCmd, setBoxCmd] = useState(null) // app (owner, 2026-11-12): a hero label: open the site list on { filter }
  const pickSection = (box) => setSection((cur) => (cur?.id === box.id ? null : { id: box.id, label: box.label, urls: new Set(box.read.map((p) => p.url)) }))
  const inSection = (pages) => !section || (pages ?? []).some((u) => section.urls.has(u))
  const hotCtx = useMemo(() => ({ hot, setHot }), [hot])
  const [seg, setSeg] = useState(null) // app (owner, 2026-11-12): the status link hovered or focused ('kept' | 'call' | 'ready')
  const [spot, setSpot] = useState(null) // app (owner, 2026-11-12): the spotlight: { card, status, from, opener } or null
  const spotRef = useRef(null)
  spotRef.current = spot
  const swallow = useRef(false) // the click after a press that left the spotlight
  const b = useMemo(() => bucketsOf(facts, readYear), [facts, readYear])
  // app (owner, 2026-11-13): one row per claim (lib/fact-check-rules.js claimRows): the hero, both boxes, the filters,
  // the sections, "Why?" and every action use these rows (an action applies to all of a row's wordings). Stored facts
  // are unchanged. A contradiction is one mismatch with two rows, one per side.
  const rowFacts = useMemo(() => claimRows(facts).rows, [facts])
  const rowOf = useMemo(() => new Map(rowFacts.flatMap((r) => r.ids.map((id) => [id, r]))), [rowFacts])
  const rowConflictIds = useMemo(() => {
    const stored = new Set(b.conflicts.flatMap((c) => [...c.a.ids, ...c.b.ids]))
    return new Set(rowFacts.filter((r) => r.ids.some((id) => stored.has(id))).map((r) => r.id))
  }, [b, rowFacts])
  const rowPartners = useMemo(() => new Map(b.conflicts.flatMap((c) => {
    const a = rowOf.get(c.a.lead.id), z = rowOf.get(c.b.lead.id)
    return a && z && a !== z ? [[a.id, z], [z.id, a]] : []
  })), [b, rowOf])
  const calls = b.conflicts.length + b.differs.length
  const units = useMemo(() => factUnits(b), [b]) // app: what the hero counts, for Where we read it
  // app (owner, 2026-11-11): several values of a single-value kind (phone, email, address, brand name): only the one
  // found on the most pages starts ticked; each shows how many pages it's on. A UI default only.
  const spare = useMemo(() => spareValues(b.ready), [b])
  const counted = useMemo(() => new Set(b.ready.filter((g) => SINGLE_VALUE.includes(g.lead.field) && b.ready.filter((x) => x.lead.field === g.lead.field).length > 1).map((g) => g.id)), [b])
  const skipped = useMemo(() => new Set(b.ready.filter((g) => spare.has(g.id) !== flipped.has(g.id)).map((g) => g.id)), [b, spare, flipped]) // rows unticked
  const ticked = b.ready.filter((g) => !skipped.has(g.id))
  const held = (key) => !!holds[key] && !holds[key].sending // app: a save waiting out its 5 s, so Undo still works

  // app: leaving the page (another page, closing the tab) sends the saves still held
  useEffect(() => {
    const leave = () => flushSaves({ keepalive: true })
    window.addEventListener('pagehide', leave)
    return () => { window.removeEventListener('pagehide', leave); leave() }
  }, [])
  // "Into the sheet", for text that isn't in the sheet yet (a page text): it leaves its card and lands on its new row
  // app: from: the text's row (its id); id: the new fact's block (the add gives it its own id)
  const flyToSheet = (id, text, apply, from = id) => {
    const r0 = document.querySelector(`[data-wf-from="${from}"]`)?.getBoundingClientRect()
    if (!r0 || reduced()) { apply(); return }
    setLanding((s) => new Set(s).add(id))
    apply()
    const land = () => setLanding((s) => { const n = new Set(s); n.delete(id); return n })
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const r1 = document.querySelector(`[data-wf-slot="${id}"]`)?.getBoundingClientRect()
      if (!r1) { land(); return }
      const ghost = document.createElement('div')
      ghost.className = 'wf-ghost'
      ghost.textContent = text
      Object.assign(ghost.style, { left: `${r0.left}px`, top: `${r0.top}px`, maxWidth: `${Math.max(r0.width + 18, 220)}px` })
      document.body.appendChild(ghost)
      const end = `translate(${r1.left - r0.left + 30}px, ${r1.top - r0.top + 4}px)`
      const a = ghost.animate([{ transform: 'none', opacity: 1 }, { transform: end, opacity: 1, offset: 0.85 }, { transform: end, opacity: 0 }], { duration: 560, easing: GLIDE })
      a.onfinish = a.oncancel = () => { ghost.remove(); land() }
    }))
  }
  // Confirm: the ticked facts are confirmed one after another (app: each glides from its row into the fact sheet)
  // app: held 5 s with Undo, then sent one fact at a time ("Confirming 3 of 8" on the button); a fact that doesn't save
  // goes back to the list
  const startConfirm = (items, hold) => {
    const key = `confirm:${items.map((it) => it.id).join(',')}:${Date.now()}`
    setUndo({ key, n: items.length })
    setBatch({ key })
    holdSave({ key, where: 'ready', items, hold, stagger: reduced() ? 0 : 130 })
  }
  const confirmTicked = () => {
    if (!ticked.length || batch) return
    // app (owner, 2026-11-12): a grouped row confirms its representative and turns down its other wordings
    startConfirm(ticked.map((g) => ({ id: g.id, ids: g.keepIds ?? g.ids, drop: g.dropIds ?? [], status: 'CONFIRMED' })))
  }
  // Page texts: "Use as a fact" makes it a fact (app: added as your fact, then the text is rejected; it
  // travels to the sheet once both have saved); × dismisses it, with Undo while it's held
  const useAsFact = async (f) => {
    if (using.has(f.id)) return
    setUsing((s) => new Set(s).add(f.id))
    const fact = await takeAsFact(f)
    setUsing((s) => { const n = new Set(s); n.delete(f.id); return n })
    if (fact) flyToSheet(fact.id, f.value, () => placeTakenFact(f.id, fact), f.id)
  }
  const dismissText = (f) => { const key = `text:${f.id}`; holdSave({ key, where: 'text', items: [{ id: f.id, ids: [f.id], status: 'REJECTED' }] }); setGone({ ...f, key }) }
  const undoText = () => { undoSave(gone.key); setGone(null) }
  const undoConfirm = () => { undoSave(undo.key); setUndo(null); setBatch(null) }
  // app (owner, 2026-11-12): the fact sheet's Remove (rejects the whole group) and "N removed"'s Use again (confirms the
  // whole group; one that contradicts a fact in use reopens the decision in Your call, bucketsOf), each held 5 s with
  // Undo (the existing calls: reject and confirm; nothing can go back to waiting)
  const removeFact = (g) => { const key = `remove:${g.id}:${Date.now()}`; holdSave({ key, where: 'sheet', items: [{ id: g.id, ids: g.ids, status: 'REJECTED' }] }); setSheetUndo({ key, kind: 'remove', value: g.lead.value }) }
  const useAgain = (g) => {
    const key = `use:${g.id}:${Date.now()}`
    const reopens = !!conflictOf(g, b.kept, readYear)
    holdSave({ key, where: 'sheet', items: [{ id: g.id, ids: g.ids, status: 'CONFIRMED' }] })
    setSheetUndo({ key, kind: reopens ? 'reopen' : 'use', value: g.lead.value })
  }
  const undoSheet = () => { if (sheetUndo) undoSave(sheetUndo.key); setSheetUndo(null) }
  const toggle = (g) => setFlipped((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n })
  // Your call: the open decisions, in order, and the ones already made (each collapses to one line with Undo)
  const openCalls = [...b.conflicts.map((c) => ({ key: `c:${c.a.id}`, c })), ...b.differs.map((g) => ({ key: `d:${g.id}`, g }))]
  const settled = resolved.filter((r) => !openCalls.some((o) => o.key === r.key))
  const callItems = openCalls.filter((o) => inSection(o.c ? [...o.c.a.pages, ...o.c.b.pages] : o.g.pages)) // app: the picked section's
  ;[...settled].sort((x, y) => x.pos - y.pos).forEach((r) => callItems.splice(Math.min(r.pos, callItems.length), 0, { key: r.key, r }))
  const settle = (key, name, result, ids) => setResolved((rs) => [...rs.filter((r) => r.key !== key), { key, name, result, ids, pos: Math.max(0, callItems.findIndex((it) => it.key === key)) }])
  const undoCall = (r) => { undoSave(r.key); setResolved((rs) => rs.filter((x) => x.key !== r.key)) }
  // app: a call is held 5 s (Undo), then sent; one that doesn't save opens again
  const holdCall = (key, items) => holdSave({ key, where: 'call', items })
  const pickOne = (keep, drop) => {
    const key = `c:${[keep, drop].find((g) => openCalls.some((o) => o.key === `c:${g.id}`))?.id ?? keep.id}`
    const finish = () => settle(key, KIND[keep.lead.field], keep.lead.value, [...keep.ids, ...drop.ids])
    // app (owner, 2026-11-12): one item for the whole decision: the kept side's representative confirmed; its other
    // wordings and every claim on the other side turned down (one Undo; any failure opens the decision again)
    const save = () => holdCall(key, [{ id: key, ids: keep.keepIds ?? keep.ids, drop: [...(keep.dropIds ?? []), ...drop.ids], status: 'CONFIRMED' }])
    if (reduced()) { save(); finish(); return }
    setPicked(keep.id)
    setTimeout(() => { save(); setPicked(null); finish() }, 600)
  }
  const keepSite = (g) => {
    const finish = () => settle(`d:${g.id}`, KIND[g.lead.field], g.lead.value, g.ids)
    const save = () => holdCall(`d:${g.id}`, [{ id: g.id, ids: g.keepIds ?? g.ids, drop: g.dropIds ?? [], status: 'CONFIRMED' }])
    if (reduced()) { save(); finish(); return }
    setPicked(g.id)
    setTimeout(() => { save(); setPicked(null); finish() }, 600)
  }
  // app (owner, 2026-11-11): a contradiction where neither claim is right: both turned down (held with Undo)
  const neitherRight = (c) => { const key = `c:${c.a.id}`; settle(key, KIND[c.a.lead.field], 'neither kept, both hidden', [...c.a.ids, ...c.b.ids]); holdCall(key, [{ id: key, ids: [...c.a.ids, ...c.b.ids], status: 'REJECTED' }]) }
  const dropFact = (g) => { settle(`d:${g.id}`, KIND[g.lead.field], 'hidden', g.ids); holdCall(`d:${g.id}`, [{ id: g.id, ids: g.ids, status: 'REJECTED' }]) }
  const add = (field, value) => addFact(field, value) // app: saved (optimistic; a failed add shows a line with Retry)
  // app (owner, 2026-11-12): a status link (the hero's labels, the fact sheet's line): its card scrolls to the top of
  // the view below the header offset (smooth; at once under reduced motion), its heading takes focus, and the card
  // rings once
  // app (owner, 2026-11-12): …then the spotlight (no ring): the same status again leaves it, another switches to it
  const goTo = (id, opener) => {
    if (spotRef.current?.card === id) { exitSpot(); return }
    const box = firstRowOf(STATUS_OF[id]) // app: the first row with that status
    if (!box) return
    box.style.scrollMarginTop = `${scrollOffset(box)}px`
    box.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' })
    setSpot({ card: id, status: STATUS_OF[id], from: 'hero', opener })
  }
  // leaving: everything back to full opacity; focus back to the status it was entered from
  const exitSpot = () => {
    const opener = spotRef.current?.opener
    setSpot(null)
    if (opener?.isConnected) { opener.focus({ preventScroll: true }); setSeg(null) }
  }
  // app (owner, 2026-11-12): the spotlight: every other card (and the hero but its statuses) at 35%; inside the target,
  // its items rise in (6px + fade, 60ms apart, after the scroll); focus moves to its first item
  useEffect(() => {
    const target = spot && document.querySelector('[data-fc-compare]')
    if (!target) return undefined
    const hero = document.querySelector('[data-fc-hero]')
    const scope = hero?.parentElement ?? document
    const cells = statusCells()
    const others = [
      ...[...scope.querySelectorAll('section, aside')].filter((el) => el !== target && el !== hero && !el.parentElement?.closest('section, aside')),
      ...cells.filter((el) => el.dataset.fcStatus !== spot.status),
    ]
    others.forEach((el) => el.classList.add('fc-dimmable', 'fc-dim'))
    // what rises: the matching rows' contents (the left cell's, and the right cell's beside it)
    const items = cells.filter((el) => el.dataset.fcStatus === spot.status)
    items.forEach((el, i) => {
      el.classList.remove('fc-rise')
      void el.offsetWidth // replay when the spotlight comes back to it
      el.style.animationDelay = `${SPOT_RISE_AT + i * SPOT_STAGGER}ms`
      el.classList.add('wf-anim', 'fc-rise')
    })
    const first = items[0]
    if (first) {
      if (!first.matches('a, button, input, [tabindex]')) first.tabIndex = -1
      first.focus({ preventScroll: true })
    }
    return () => {
      others.forEach((el) => el.classList.remove('fc-dim'))
      items.forEach((el) => { el.classList.remove('fc-rise'); el.style.animationDelay = '' })
    }
  }, [spot])
  // leaving it: Esc; a press on a dimmed area (that press does nothing else; the next one acts). Scrolling stays in it.
  useEffect(() => {
    if (!spot) return undefined
    const down = (e) => {
      swallow.current = false
      const t = e.target
      if (!(t instanceof Element) || t.closest('[data-fc-go]')) return // a status: goTo switches or leaves
      if (!t.closest('.fc-dim, [data-fc-hero]')) return
      swallow.current = true
      e.preventDefault()
      e.stopPropagation()
      exitSpot()
    }
    const key = (e) => { if (e.key === 'Escape') exitSpot() }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key) }
  }, [spot])
  // the click that follows a press that left the spotlight is swallowed (listening always: the spotlight is gone by then)
  useEffect(() => {
    const click = (e) => { if (swallow.current) { swallow.current = false; e.preventDefault(); e.stopPropagation() } }
    document.addEventListener('click', click, true)
    return () => document.removeEventListener('click', click, true)
  }, [])
  // app (owner, 2026-11-12): while a status link is hovered or focused, its card (when it's on screen in <main>) gets
  // a 1px ring in its status colour as a preview (fc-preview, mock.src.css: 150ms in, 200ms out, none under reduced motion)
  useEffect(() => {
    // app (owner, 2026-11-12): the comparison has no card per status: when it's on screen, its other rows dim instead
    const box = seg && !spot && document.querySelector('[data-fc-compare]')
    if (!box) return undefined
    const r = box.getBoundingClientRect()
    const view = box.closest('main')?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight }
    if (r.bottom <= view.top || r.top >= view.bottom) return undefined
    const dim = statusCells().filter((el) => el.dataset.fcStatus !== seg)
    dim.forEach((el) => el.classList.add('fc-dimmable', 'fc-dim'))
    return () => dim.forEach((el) => el.classList.remove('fc-dim'))
  }, [seg, spot])

  // app: the dismissed line stays while the dismiss is held (5 s), as the mock's timer did; a Confirm stays in flight
  // until its calls are sent
  useEffect(() => { if (gone && !holds[gone.key]) setGone(null) }, [gone, holds])
  useEffect(() => { if (sheetUndo && (!holds[sheetUndo.key] || holds[sheetUndo.key].sending)) setSheetUndo(null) }, [sheetUndo, holds])
  useEffect(() => { if (batch && !holds[batch.key]) setBatch(null) }, [batch, holds])
  // "Read website again": app: one paid read (Harsh's refresh); the data it returns replaces the page's
  const [checkUsed, setCheckUsed] = useState(false) // this visit's check has run (the month's one)
  const read = () => { setCheckUsed(true); refresh() }

  // app: a failed save's line: Retry sends it again at once (a Confirm's facts with the button's progress)
  const failLine = (where) => failed[where] && { message: failed[where].message, retry: where === 'ready' ? () => startConfirm(takeFailed('ready'), 0) : () => retrySaves(where) }
  // app (owner, 2026-11-12): the hero's three groups, the same partition as the filters and lists (resultGroupsOf)
  const resultGroups = resultGroupsOf(rowFacts, rowConflictIds)
  // the monthly check (as the app, #227): used up once a read has run this month; ?check=locked previews it. A
  // superadmin is never locked. The reason is the button's tip only.
  const admin = isSuperadmin()
  const lockedNow = !admin && hasRead && (checkUsed || new URLSearchParams(window.location.search).get('check') === 'locked')
  const nextCheck = (() => { const d = new Date(readAt && !Number.isNaN(Date.parse(readAt)) ? readAt : Date.now()); d.setMonth(d.getMonth() + 1); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })()
  const check = { locked: lockedNow, tip: admin ? 'Admin runs don’t count toward the monthly limit.' : lockedNow ? `You’ve already run this month’s check. Next check ${nextCheck}.` : 'Fact check runs once a month.' }
  const changes = useMemo(() => factCheckChanges({ total: rowFacts.length, match: resultGroups.match.length, mismatch: resultGroups.mismatch.map((f) => ({ kind: KIND[f.field] ?? 'Fact' })), unchecked: resultGroups.unchecked.length, readAt, brand: brandName() }),
    [rowFacts.length, resultGroups.match.length, resultGroups.mismatch.length, resultGroups.unchecked.length, readAt]) // eslint-disable-line react-hooks/exhaustive-deps
  const hero = <Hero key={`hero-${round}`} check={check} changes={changes} b={b} groups={resultGroups} total={rowFacts.length} scan={scan} hasRead={hasRead} onRead={read} readAt={readAt} failed={readError && { message: readError, retry: read }} onGo={(filter) => setBoxCmd({ filter, at: Date.now() })} seg={seg} setSeg={setSeg} />
  // app (owner, 2026-11-12): the page texts (was Read, but not facts) open from their box in Where we read it
  const texts = { items: b.notFacts, gone, failed: failed.text && failLine('text'), failedBox: failed.text && (gone ? textBox(gone) : 'home'), onUse: useAsFact, onDismiss: dismissText, onUndo: undoText, busy: using }
  // app (owner, 2026-11-12): the picked section's line: its unconfirmed facts, each count a link to them, and Show all
  const secWaiting = section ? b.ready.filter((g) => inSection(g.pages)).length : 0
  const secCalls = section ? b.conflicts.filter((c) => inSection([...c.a.pages, ...c.b.pages])).length + b.differs.filter((g) => inSection(g.pages)).length : 0
  const filterLine = section && (
    <p className={`num ${sub}`} aria-live="polite" data-fc-filter="">
      From <b className={val}>{section.label}</b> pages
      {secWaiting > 0 && <> · <button type="button" onClick={(e) => goTo('fc-ready', e.currentTarget)} className={quiet}>{secWaiting} waiting</button></>}
      {secCalls > 0 && <> · <button type="button" onClick={(e) => goTo('fc-your-call', e.currentTarget)} className={`${quiet} text-negative`}>{secCalls} {secCalls === 1 ? 'needs' : 'need'} your attention</button></>}
      {' · '}<button type="button" onClick={() => setSection(null)} className={link}>Show all</button>
    </p>
  )
  const pagesRead = <PagesRead key={`pages-${round}`} list={list} units={units} hasRead={hasRead} onRetry={read} cap={READ_CAP} texts={texts} section={section} onPick={pickSection} filterLine={filterLine} />

  // app: the hero and Pages read sit side by side, so each round's key names its card (both were `round`: React's
  // "two children with the same key" warning); a new read still remounts both
  // never read: say what reading does, and show the pages waiting
  if (!hasRead) return <Hot.Provider value={hotCtx}>{hero}{pagesRead}</Hot.Provider>

  const rows = b.ready // app (owner, 2026-11-12): live, so every count agrees (was a snapshot taken at Confirm)
  const sending = batch && holds[batch.key]?.sending ? holds[batch.key] : null // app: the Confirm's calls going out
  const okN = undo ? results[undo.key]?.ok ?? undo.n : 0 // app: only what saved is reported as confirmed
  const undoLine = undo && okN > 0 && !sending && (!batch || held(undo.key)) && <><b className={`num ${val}`}>{okN} confirmed</b>{held(undo.key) && <> · <button type="button" onClick={undoConfirm} className={link}>Undo</button></>}</>
  const progress = sending && <>Confirming <Ticking n={Math.min(sending.sent + 1, sending.items.length)} /> of {sending.items.length}</>
  // app (owner, 2026-11-12): the comparison's rows. Needs your attention: the open decisions (and the ones just made,
  // with Undo); then every fact in use or waiting that matches its source; then the rest (not found, no outside source).
  // Section filter: the picked section's rows only.
  const facts2 = b.merged.filter((g) => (b.kept.includes(g) || b.ready.includes(g)) && inSection(g.pages))
  const waiting = new Set(b.ready.map((g) => g.id))
  const factRow = (g) => {
    const wait = waiting.has(g.id)
    const on = wait ? !skipped.has(g.id) : true
    return {
      id: g.id,
      left: <SiteFact g={g} on={on} waiting={wait} count={wait && counted.has(g.id) ? pagesFoundOn(g) : null} onToggle={() => (wait ? toggle(g) : removeFact(g))} />,
      status: wait ? 'ready' : 'kept',
      right: <OutsideFact g={g} />,
      center: outsideOf(g.lead) === 'nosource',
    }
  }
  const restOrder = ['differs', 'unchecked', 'none', 'nosource']
  const attention = callItems.map((it) => (it.r
    ? { id: it.key, left: <ResolvedLine r={it.r} onUndo={undoCall} held={held(it.key)} />, right: null }
    : it.c ? { id: it.key, left: <ConflictLeft c={it.c} picked={picked} onPick={pickOne} />, right: <ConflictRight c={it.c} picked={picked} onPick={pickOne} onNeither={neitherRight} /> }
      : { id: it.key, left: <DiffersSite g={it.g} picked={picked} onKeep={keepSite} onDrop={dropFact} />, right: <OutsideFact g={it.g} /> }))
  const groups = [
    { id: 'attention', status: 'call', label: 'Needs your attention', labelId: 'fc-your-call', rows: attention },
    { id: 'matches', rows: facts2.filter((g) => outsideOf(g.lead) === 'agrees').map(factRow) },
    { id: 'rest', rows: facts2.filter((g) => outsideOf(g.lead) !== 'agrees').sort((x, y) => restOrder.indexOf(outsideOf(x.lead)) - restOrder.indexOf(outsideOf(y.lead))).map(factRow) },
  ].filter((grp) => grp.rows.length)
  // the outside summary counts rows (facts), as the rows show them
  const shown = [...b.differs, ...facts2] // a site contradiction is site against site: not counted here
  const tally = (k) => shown.filter((g) => outsideOf(g.lead) === k).length
  const summary = [
    tally('agrees') > 0 && `${tally('agrees')} match`,
    (b.differs.length > 0 || tally('differs') > 0) && <span key="d" className="text-negative">{tally('differs')} doesn’t match</span>,
    tally('unchecked') > 0 && `${tally('unchecked')} not found`,
    tally('nosource') > 0 && `${tally('nosource')} no outside source`,
  ].filter(Boolean).map((x, i) => <span key={i}>{i > 0 && ' · '}{x}</span>)
  const confirm = rows.length > 0 && (
    <span id="fc-ready" tabIndex={-1} className="outline-none">
      <button type="button" className={primary} disabled={!ticked.length || !!batch} onClick={confirmTicked}>
        {progress || <><Check size={15} aria-hidden />Confirm <Ticking n={ticked.length} /></>}
      </button>
    </span>
  )
  const footer = (
    <div className="flex flex-col gap-2">
      <p className={`num ${sub}`}>
        {(b.removed.length > 0 || b.hiddenTexts.length > 0)
          ? <RemovedFacts list={b.removed} texts={b.hiddenTexts} inUse={b.kept} readYear={readYear} onUse={useAgain} onUseText={useAsFact} busy={using} />
          : 'Nothing hidden'}
      </p>
      {undoLine && <p className={sub}>{undoLine}</p>}
      {sheetUndo && <p className={`num ${sub}`} aria-live="polite" data-fc-sheet-undo="">{SHEET_SAYS[sheetUndo.kind](sheetUndo.value)} · <button type="button" onClick={undoSheet} className={link}>Undo</button></p>}
      {failed.call && <FailLine fail={failLine('call')} />}
      {failed.ready && <FailLine fail={failLine('ready')} />}
      {failed.sheet && <FailLine fail={failLine('sheet')} />}
    </div>
  )
  // app (owner, 2026-11-12, step 1): the facts card's actions, one stored fact each (no grouping), held 5 s with Undo
  const holdOne = (f, status, kind) => { const key = `fact:${f.id}:${Date.now()}`; holdSave({ key, where: 'sheet', items: [{ id: f.id, ids: f.ids ?? [f.id], status }] }); setSheetUndo({ key, kind, value: f.value }) }
  const conflictIds = rowConflictIds // app (owner, 2026-11-13): the rows of the site claims that contradict each other
  const partners = rowPartners // app: each side's other row (Why?)
  const factsFooter = (sheetUndo || failed.sheet || failed.text) && (
    <div className="mt-1 flex flex-col gap-2 border-t border-line pt-3">
      {sheetUndo && <p key={sheetUndo.key} className={`fc-up num ${sub}`} aria-live="polite" data-fc-sheet-undo="">{SHEET_SAYS[sheetUndo.kind](sheetUndo.value)} · <button type="button" onClick={undoSheet} className={link}>Undo</button></p>}
      {failed.sheet && <FailLine fail={failLine('sheet')} />}
      {failed.text && <FailLine fail={failLine('text')} />}
    </div>
  )
  return (
    <Hot.Provider value={hotCtx}>
      {hero}
      <WhatChangedPanel config={changes} />
      {/* app (owner, 2026-11-12, step 2): one card with two boxes replaces step 1's tabs and Where we read it (their code is kept, not rendered) */}
      <FactBoxes cmd={boxCmd} conflictIds={conflictIds} partners={partners} facts={rowFacts} onAdd={add} onConfirm={(f) => holdOne(f, 'CONFIRMED', 'confirm')} onHide={(f) => holdOne(f, 'REJECTED', 'remove')} onShow={(f) => holdOne(f, 'CONFIRMED', 'use')} onUseText={useAsFact} using={using} footer={factsFooter} />
    </Hot.Provider>
  )
}
