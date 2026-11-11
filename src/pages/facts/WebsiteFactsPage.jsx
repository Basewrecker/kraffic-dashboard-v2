// Optimize → Fact Check (was "Website facts"; "Proof first", owner 2026-11-11, round 4). What we read on the brand's
// site, which claims an outside source backs up, and the facts Content drafts may use. Design only: the app's data and
// its four actions (confirm, reject, add a fact, read the website again) on sample data (data/websiteFacts.js).
// Layout, as Sentiment: a hero card (how many facts are confirmed, by status; the sources we checked against; Read
// website again) → Where we read it → a 2×2 grid of equal columns (Your call · Checked against outside sources / Ready
// to confirm · the fact sheet, as tiles; a row's two cards share their top and bottom edge) → Read, but not facts.
// Nothing above it moves when something opens: Add a fact is a popover, and Read, but not facts (the last row of the
// page) opens downward. Rows are never spread to fill a card.
// Type: section titles 700, values 600 in ink, everything supporting 400 in stone-600. One helper line per section.
// Colour: graphite, with one solid-ink element per card at most (its primary button); --negative (Sentiment's red) where
// the site and a source disagree, on "Your call", and for pages we couldn't read. No AI engine logos: engines don't read the site.
// Previews: ?wf=empty (never read) · ?wf=done (nothing left to review). "Read website again" plays the reading state.
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AlignLeft, AppWindow, ArrowUpRight, Award, BadgeCheck, Building2, CalendarDays, Check, ChevronDown, Heading1, Mail, MapPin, Phone, Plus, Quote, RefreshCw, Search, Star, StickyNote, X } from 'lucide-react'
import { brand } from '../../store/workspace'
import SiteLogo from '../../components/ui/SiteLogo'
import BetaTag from '../../components/ui/BetaTag'
import EdgeTip from '../../components/ui/EdgeTip'
import { CrossFade, GLIDE, useCountUp } from '../../components/ui/motion'
import { ADD_KINDS, GROUPS, KIND, READ_AT, bucketsOf, claimParts, diffOf, factsOnPage, groupOf, keyPart, markOf, outsideEvidence, pageSections, pairTileOf, pathOf, sampleFacts, samplePages, shortName, siteEvidence, sourceOf, tileOf, verdictOf } from '../../data/websiteFacts'

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const READ_YEAR = new Date(READ_AT).getUTCFullYear()
const KIND_ICON = { brand_name: Building2, phone: Phone, email: Mail, address: MapPin, trustpilot_rating: Star, bbb_rating: Star, award: Award, years: CalendarDays, accreditation: BadgeCheck, claim: Quote, note: StickyNote, title: AppWindow, description: AlignLeft, heading: Heading1 }
const focus = 'outline-none focus-visible:ring-2 focus-visible:ring-focus'
const btn = `inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 text-[14px] font-semibold transition-colors duration-150 disabled:opacity-50 ${focus}`
const primary = `${btn} bg-ink text-on-ink hover:bg-ink-hover`
const secondary = `${btn} border border-line bg-surface text-stone-900 hover:border-[var(--color-line-strong)]`
const link = `rounded text-[13px] leading-[18px] font-semibold text-stone-900 underline-offset-2 hover:underline ${focus}`
const card = 'rounded-xl border border-line bg-surface'
const h2 = 'text-[18px] leading-[26px] font-bold text-stone-900' // section titles: 700
const sub = 'text-[13px] leading-[18px] font-normal text-stone-600' // supporting: 400, secondary
const val = 'font-semibold text-stone-900' // values: 600, primary
const big = 'text-[20px] leading-[26px] font-semibold tracking-[-0.01em] text-stone-900'
const Count = ({ n }) => <span className="num text-[14px] leading-5 font-normal text-stone-600">{n}</span>
const where = (url) => (pathOf(url) === '/' ? 'home page' : pathOf(url))
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

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
const SourceLogo = ({ src, size = 'h-7 w-7 rounded-md', className = '' }) => <span className={`grid shrink-0 place-items-center overflow-hidden bg-[var(--logo-plate)] ${size} ${className}`}><SiteLogo domain={src.domain} name={src.name} className="h-full w-full" /></span>
const BrandLogo = ({ size = 'h-7 w-7 rounded-md', className = '' }) => <SiteLogo domain={brand.domain} name={brand.name} className={`${size} ${className}`} />
// what stands beside a fact in a tight row: its source's (or certifier's) logo, else its kind's plain line icon
function Mark({ fact, size = 20 }) {
  const m = markOf(fact)
  const Icon = KIND_ICON[fact.field] ?? StickyNote
  const box = { width: size, height: size }
  return m
    ? <span style={box} className="grid shrink-0 place-items-center overflow-hidden rounded bg-[var(--logo-plate)]"><SiteLogo domain={m.domain} name={m.name} className="h-full w-full" /></span>
    : <span style={box} className="grid shrink-0 place-items-center text-stone-600"><Icon size={Math.round(size * 0.8)} strokeWidth={1.75} aria-hidden /></span>
}
const PageLink = ({ url, pre = 'On your site' }) => (
  <a href={url} target="_blank" rel="noreferrer" className={`${sub} w-fit rounded hover:text-stone-900 ${focus}`}>{pre} · {where(url)}</a>
)
// [before, differing, after]: the differing part in red, with one pulse
const Diff = ({ parts }) => <>{parts[0]}{parts[1] && <span className="wf-anim wf-diff">{parts[1]}</span>}{parts[2]}</>
const Sentence = ({ fact, className = '', quoted = false }) => {
  const [a, b, c] = claimParts(fact)
  return <p className={`font-normal text-stone-600 [text-wrap:pretty] ${className}`}>{quoted && '“'}{a}<b className={val}>{b}</b>{c}{quoted && '”'}</p>
}
// the small split ring that marks a "Your call" item
const SplitMark = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden className="shrink-0">
    <path d="M7 2a7 7 0 0 0 0 14M11 2a7 7 0 0 1 0 14" stroke="var(--negative)" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)
// a light tick: graphite outline, soft grey fill when on (never a solid ink box)
const Tick = ({ on, onChange, label, disabled }) => (
  <button type="button" role="checkbox" aria-checked={on} aria-label={label} disabled={disabled} onClick={onChange}
    className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors duration-150 ${on ? 'border-stone-400 bg-tint' : 'border-stone-300 bg-surface hover:border-stone-400'} ${focus}`}>
    {on && <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--color-stone-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path pathLength="1" className="wf-anim wf-draw" style={{ animationDuration: '160ms' }} d="M3.5 8.5l3 3 6-7" /></svg>}
  </button>
)
// ---- the hero: how many facts are confirmed, by status; the sources we checked against; Read website again ----------
function Hero({ b, calls, scan, hasRead, onRead, scanLine }) {
  const kept = b.kept.length
  const total = kept + calls + b.ready.length
  const counted = useCountUp(hasRead ? kept : 0, 600, 0)
  const sources = [...new Map(b.cards.map((g) => [sourceOf(g.lead).domain, sourceOf(g.lead)])).values()]
  const parts = [
    { id: 'kept', n: kept, word: 'confirmed', look: 'bg-stone-300', fill: true },
    { id: 'call', n: calls, word: calls === 1 ? 'needs your call' : 'need your call', look: 'border-[1.5px] border-[var(--negative)]' },
    { id: 'ready', n: b.ready.length, word: 'ready to confirm', look: 'border-[1.5px] border-stone-300' },
  ].filter((p) => p.n > 0)
  return (
    <section className={`${card} flex flex-col gap-5 p-5 lg:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
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
          <button type="button" onClick={onRead} disabled={!!scan} className={primary}>
            <RefreshCw size={15} aria-hidden className={scan ? 'wf-anim wf-spin' : ''} />{scan ? 'Reading…' : hasRead ? 'Read website again' : 'Read website'}
          </button>
        </div>
      </div>
      {hasRead ? (
        <div className="flex flex-col gap-3">
          <p className="flex flex-wrap items-baseline gap-x-3">
            <b className="num text-kpi text-stone-900">{counted} of {total}</b>
            <span className="text-[15px] leading-[22px] text-stone-600" aria-live="polite">{scanLine ?? 'facts confirmed'}</span>
          </p>
          {/* one segment per fact, grouped by status, with its count under each group */}
          <div className="flex gap-4">
            {parts.map((p) => (
              <div key={p.id} className="flex min-w-0 flex-col gap-2 transition-[flex-grow] duration-300 ease-out" style={{ flexGrow: p.n, flexBasis: 0 }}>
                <div className="flex gap-[3px]">
                  {Array.from({ length: p.n }, (_, i) => (
                    <span key={i} className={`relative h-2.5 min-w-0 flex-1 rounded-[3px] ${p.look}`}>
                      {p.fill && <span className="wf-anim wf-seg absolute inset-0 rounded-[3px] bg-stone-600" style={{ animationDelay: `${Math.min(i, 12) * 50}ms` }} />}
                    </span>
                  ))}
                </div>
                <span className={`num truncate ${sub}`}><b className={val}>{p.n}</b> {p.word}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="max-w-[760px] text-[20px] leading-[28px] font-normal tracking-[-0.01em] text-stone-600 [text-wrap:pretty]" aria-live="polite">
          {scan ? <>Reading <b className={val}>{brand.domain}</b>. This takes a few minutes; you can leave the page.</>
            : <>We haven’t read <b className={val}>{brand.domain}</b> yet. Reading it finds your contact details, ratings, awards and claims, and <b className={val}>checks each one against its source</b>.</>}
        </p>
      )}
    </section>
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
function SiteSide({ g, value, onKeep, picked }) {
  const site = siteEvidence(g.lead)
  const kept = picked === g.id
  return (
    <CallSide g={g} pick kept={kept} dim={!!picked && !kept} logo={<BrandLogo size="h-5 w-5 rounded" />} label={`Your site${site ? ` · ${where(site.url)}` : ''}`}
      value={value ?? g.lead.value} quote={site && <p className={`${sub} [text-wrap:pretty]`}>“{site.snippet}”</p>}>
      <button type="button" disabled={!!picked} onClick={onKeep} className={`${secondary} ${kept ? 'disabled:opacity-100' : ''}`}>{kept && <Check size={15} aria-hidden />}{kept ? 'Kept' : 'Keep this one'}</button>
    </CallSide>
  )
}
const CallItem = ({ n, name, children, drop }) => (
  <div className="flex flex-col gap-3 p-5">
    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="num grid h-5 w-5 shrink-0 place-items-center rounded-full bg-tint text-[12px] font-semibold text-stone-900">{n}</span>
      <b className={`text-[15px] leading-[22px] ${val}`}>{name}</b>
      <span className="text-[13px] leading-[18px] font-semibold text-[var(--negative)]">Doesn’t match</span>
      {drop && <span className="ml-auto">{drop}</span>}
    </p>
    <div className="grid grid-cols-2 divide-x divide-line">{children}</div>
  </div>
)
const ConflictItem = ({ c, n, onPick, picked }) => (
  <CallItem n={n} name={KIND[c.a.lead.field]}>
    <SiteSide g={c.a} picked={picked} onKeep={() => onPick(c.a, c.b)} />
    <SiteSide g={c.b} picked={picked} onKeep={() => onPick(c.b, c.a)} />
  </CallItem>
)
function DiffersItem({ g, n, onKeep, onDrop, picked }) {
  const f = g.lead
  const src = sourceOf(f)
  const out = outsideEvidence(f)
  const diff = diffOf(f)
  return (
    <CallItem n={n} name={KIND[f.field]} drop={<button type="button" disabled={!!picked} onClick={() => onDrop(g)} className={`rounded text-[13px] leading-[18px] font-normal text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline ${focus}`}>Drop this fact</button>}>
      <SiteSide g={g} picked={picked} onKeep={() => onKeep(g)} value={diff ? <Diff parts={diff.site} /> : claimParts(f)[1]} />
      <CallSide g={g} dim={picked === g.id} logo={src && <SourceLogo src={src} size="h-5 w-5 rounded" />} label={src?.name ?? 'The source'} value={diff ? <Diff parts={diff.source} /> : out?.snippet}>
        {out && <a href={out.url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-0.5 ${link}`}>Open the source<ArrowUpRight size={14} aria-hidden /></a>}
      </CallSide>
    </CallItem>
  )
}
const ResolvedLine = ({ r, onUndo }) => (
  <p className="wf-anim card-in flex flex-wrap items-center gap-x-1.5 px-5 py-3 text-[14px] leading-5 text-stone-600">
    <Check size={15} aria-hidden className="mr-1 shrink-0 text-stone-700" />
    <b className={val}>{r.name}</b> · <span className="min-w-0">{r.result}</span> · <button type="button" onClick={() => onUndo(r)} className={link}>Undo</button>
  </p>
)

// ---- Ready to confirm: one tight line per fact (tick · logo or line icon · the value, its key part a weight heavier),
// in three labelled groups split by hairlines. Hover or focus the value for the page(s) it came from. Roomy rows, so
// the card meets the fact sheet beside it; a few pixels of difference go evenly between them.
const READY_GROUPS = [
  ['Contact', (g) => groupOf(g.lead) === 'contact'],
  ['Awards and accreditations', (g) => ['ratings', 'awards', 'accreditations'].includes(groupOf(g.lead))],
  ['Site claims', (g) => !['contact', 'ratings', 'awards', 'accreditations'].includes(groupOf(g.lead))],
]
function ReadyLine({ g, on, sent, onToggle }) {
  const f = g.lead
  const value = <span className={`text-[14px] leading-6 ${val}`} data-wf-from={g.id}><KeyValue fact={f} kept /></span>
  return (
    <li {...useHot(g.pages)} className={`flex items-center gap-2.5 py-[11px] transition-opacity duration-200 ${sent ? 'opacity-30' : on ? '' : 'opacity-50'}`}>
      <Tick on={on} onChange={onToggle} disabled={sent} label={`Confirm “${f.value}”`} />
      {/* a logo is a little larger than a line icon, so the groups read differently */}
      <span className="grid h-6 w-6 shrink-0 place-items-center"><Mark fact={f} size={markOf(f) ? 22 : 17} /></span>
      {g.pages.length
        ? <EdgeTip className="block min-w-0 truncate" tip={<span className="flex flex-col gap-1"><span className={val}>Found on</span>{g.pages.map((u) => <span key={u}>{where(u)}</span>)}</span>}>{value}</EdgeTip>
        : <span className="min-w-0 truncate">{value}</span>}
    </li>
  )
}
function ReadyList({ rows, skipped, sent, onToggle }) {
  const groups = READY_GROUPS.map(([label, has]) => ({ label, list: rows.filter(has) })).filter((grp) => grp.list.length)
  return (
    <div className="flex flex-1 flex-col divide-y divide-[var(--div)]">
      {groups.map((grp) => (
        <div key={grp.label} style={{ flexGrow: grp.list.length }} className="flex flex-col py-3 first:pt-0 last:pb-0">
          <h3 className="pb-1 text-[13px] leading-[18px] font-semibold text-stone-600">{grp.label}</h3>
          <ul className="flex flex-1 flex-col justify-around">{grp.list.map((g) => <ReadyLine key={g.id} g={g} on={!skipped.has(g.id)} sent={sent.has(g.id)} onToggle={() => onToggle(g)} />)}</ul>
        </div>
      ))}
    </div>
  )
}

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
function usePanel(open, close, wrap, opener) {
  useEffect(() => {
    if (!open) return undefined
    const away = (e) => { if (!wrap.current?.contains(e.target)) close() }
    const key = (e) => {
      const panel = wrap.current?.querySelector('[role=dialog]')
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
function AddFact({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('note')
  const [value, setValue] = useState('')
  const wrap = useRef(null)
  const opener = useRef(null)
  usePanel(open, () => setOpen(false), wrap, opener)
  const submit = (e) => { e.preventDefault(); if (!value.trim()) return; onAdd(kind, value.trim()); setValue(''); setOpen(false); opener.current?.focus() }
  return (
    <div ref={wrap} className="relative shrink-0">
      <button ref={opener} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-semibold text-stone-600 transition-colors duration-150 hover:text-stone-900 ${focus}`}>
        <Plus size={13} aria-hidden />Add a fact
      </button>
      {open && (
        <form role="dialog" aria-label="Add a fact" onSubmit={submit} className="wf-anim wf-panel absolute right-0 top-full z-40 mt-2 flex w-[min(360px,calc(100vw-48px))] origin-top-right flex-col gap-2 rounded-xl border border-line bg-raised p-3 shadow-lg">
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

// ---- the fact sheet: what Content drafts may use. Open blocks in a two-column grid (no boxes, no per-block marks):
// logo or line icon, the key figure large and bold, a short label under it. Status is carried by the section alone:
// In use · Your call (its label in red) · Waiting, split by one hairline with room around it. Contact is four plain
// icon + value pairs in the same grid, the address on a full row. Hover: a soft highlight, the full sentence and its
// page. A confirmed block moves up into In use.
const isLit = (hot, pages) => !!hot && pages.some((u) => hot.urls.has(u))
const KeyValue = ({ fact, kept = false }) => {
  const k = keyPart(fact)
  return k ? <>{k[0]}<b className={kept ? 'font-bold' : 'font-semibold'}>{k[1]}</b>{k[2]}</> : fact.value
}
const blockHover = '-mx-2 -my-1 block !rounded-lg px-2 py-1 transition-colors duration-150 hover:bg-tint'
const TileQuote = ({ fact }) => {
  const site = siteEvidence(fact)
  return site ? <><span className="text-stone-900">“{site.snippet}”</span><span className="text-stone-600">{where(site.url)}</span></> : <span className="text-stone-600">{fact.status === 'ADDED_BY_YOU' ? 'Added by you' : KIND[fact.field]}</span>
}
function FactBlock({ row, landing }) {
  const { hot } = useContext(Hot)
  const { g, pair } = row
  const pages = pair ? [...pair.a.pages, ...pair.b.pages] : g.pages
  const f = (pair ? pair.a : g).lead
  const t = pair ? pairTileOf(pair.a.lead, pair.b.lead) : tileOf(f)
  return (
    <div {...useHot(pages)} data-flip={row.id} data-wf-slot={g?.id} className="min-w-0">
      <EdgeTip className={`${blockHover} ${isLit(hot, pages) ? 'bg-tint' : ''}`} label={`${t.figure}, ${t.label}`}
        tip={<span className="flex flex-col gap-1">{pair ? <><TileQuote fact={pair.a.lead} /><TileQuote fact={pair.b.lead} /></> : <TileQuote fact={f} />}</span>}>
        <span className="flex items-start gap-2.5">
          <span className="grid h-6 shrink-0 place-items-center"><Mark fact={f} size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className={`block font-bold tracking-[-0.01em] text-stone-900 transition-opacity duration-200 [overflow-wrap:anywhere] ${t.figure.length > 18 ? 'text-[15px]' : 'text-[18px]'} leading-6 ${g && landing.has(g.id) ? 'opacity-0' : ''}`}>{t.figure}</span>
            <span className="block text-[12px] leading-4 text-stone-600 [overflow-wrap:anywhere]">{t.label}</span>
          </span>
        </span>
      </EdgeTip>
    </div>
  )
}
// a contact detail: a line icon and the value at regular size, on one line; the address takes the full row
function ContactLine({ row, first }) {
  const { hot } = useContext(Hot)
  const f = row.g.lead
  const Icon = KIND_ICON[f.field] ?? StickyNote
  return (
    <div {...useHot(row.g.pages)} data-flip={row.id} data-wf-slot={row.g.id} className={`min-w-0 ${f.field === 'address' ? 'col-span-2' : ''} ${first ? 'col-start-1' : ''}`}>
      <EdgeTip className={`${blockHover} ${isLit(hot, row.g.pages) ? 'bg-tint' : ''}`} label={`${KIND[f.field]}: ${f.value}`} tip={<span className="flex flex-col gap-1"><TileQuote fact={f} /></span>}>
        <span className="flex items-center gap-2.5 text-[14px] leading-6">
          <span className="grid h-6 w-5 shrink-0 place-items-center text-stone-600"><Icon size={16} strokeWidth={1.75} aria-hidden /></span>
          <span className={`min-w-0 whitespace-nowrap ${val}`}>{f.value}</span>
        </span>
      </EdgeTip>
    </div>
  )
}
const SHEET_SECTIONS = [['kept', 'In use'], ['call', 'Your call'], ['wait', 'Waiting']]
const CONTACT_ORDER = ['brand_name', 'phone', 'address', 'email'] // name | phone, the address on its own row, then email
function FactSheet({ b, landing, onAdd }) {
  const callIds = new Set(b.differs.map((g) => g.id))
  const stateOf = (g) => (g.lead.status === 'CONFIRMED' || g.lead.status === 'ADDED_BY_YOU' ? 'kept' : callIds.has(g.id) ? 'call' : 'wait')
  const all = [...b.kept, ...b.differs, ...b.ready].map((g) => ({ id: g.id, g, state: stateOf(g) }))
  const isContact = (r) => groupOf(r.g.lead) === 'contact'
  const blocks = [...all.filter((r) => !isContact(r)), ...b.conflicts.map((c) => ({ id: `pair-${c.a.id}`, pair: c, state: 'call' }))]
  const contact = all.filter(isContact).sort((x, y) => CONTACT_ORDER.indexOf(x.g.lead.field) - CONTACT_ORDER.indexOf(y.g.lead.field))
  const counts = { kept: b.kept.length, call: b.differs.length + b.conflicts.length, wait: b.ready.length }
  const total = counts.kept + counts.call + counts.wait
  const inUse = useCountUp(counts.kept, 300)
  const sections = SHEET_SECTIONS.map(([state, label]) => ({ state, label, blocks: blocks.filter((r) => r.state === state), contact: contact.filter((r) => r.state === state) }))
    .filter((sec) => sec.blocks.length || sec.contact.length)
  // a block whose status changes travels to its new place; a new block fades in
  const box = useRef(null)
  const seen = useRef(new Map())
  const order = sections.map((sec) => `${sec.state}:${[...sec.blocks, ...sec.contact].map((r) => r.id).join(',')}`).join('|')
  useLayoutEffect(() => {
    const host = box.current
    if (!host) return
    const at = host.getBoundingClientRect()
    const next = new Map()
    host.querySelectorAll('[data-flip]').forEach((el) => {
      el.getAnimations().forEach((a) => a.cancel())
      const r = el.getBoundingClientRect()
      const now = [r.left - at.left, r.top - at.top]
      next.set(el.dataset.flip, now)
      if (reduced() || !seen.current.size) return
      const was = seen.current.get(el.dataset.flip)
      if (!was) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' })
      else if (Math.abs(was[0] - now[0]) > 1 || Math.abs(was[1] - now[1]) > 1) el.animate([{ transform: `translate(${was[0] - now[0]}px, ${was[1] - now[1]}px)` }, { transform: 'none' }], { duration: 420, easing: GLIDE })
    })
    seen.current = next
  }, [order])
  return (
    <aside aria-label="Your fact sheet" className={`${card} flex h-full flex-col p-5`}>
      <header className="flex items-center gap-3">
        <BrandLogo size="h-8 w-8 rounded-lg" />
        <h2 className={`min-w-0 flex-1 ${h2}`}>{brand.name}’s fact sheet</h2>
        <p className={`num shrink-0 ${sub}`}><b className={val}>{inUse}</b> of {total} in use</p>
        <AddFact onAdd={onAdd} />
      </header>
      {/* any height the card is given beyond its own goes around the hairlines between the sections */}
      <div ref={box} className="mt-4 flex flex-1 flex-col justify-between">
        {sections.map((sec) => (
          <section key={sec.state} className="border-t border-[var(--div)] py-3.5 last:pb-1">
            <h3 className={`mb-3 text-[13px] leading-[18px] font-semibold ${sec.state === 'call' ? 'text-negative' : 'text-stone-600'}`}>{sec.label} <span className="num font-normal">{counts[sec.state]}</span></h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3.5">
              {sec.blocks.map((row) => <FactBlock key={row.id} row={row} landing={landing} />)}
              {sec.contact.map((row, i) => <ContactLine key={row.id} row={row} first={i === 0} />)}
            </div>
          </section>
        ))}
      </div>
    </aside>
  )
}

// ---- Checked against outside sources: the visual card. The brand on the left, the sources stacked on the right, a
// curved connector from the brand to each: a solid graphite line = matches · a red line broken in the middle = doesn't
// match · a faint dotted line = not found. Beside each source: its name, the value (a mismatch shows both) and its link.
// Under the diagram: the facts no outside source covers, and when the check ran. The diagram takes the card's height.
const Tok = ({ parts }) => <b className={val}>{parts[0]}{parts[1] && <span className="wf-anim wf-diff">{parts[1]}</span>}</b>
const VERDICT_SAYS = { agrees: 'Matches', differs: 'Doesn’t match', unchecked: 'Not found' }
function SourceNode({ g, i, checking, dim, setOn }) {
  const f = g.lead
  const src = sourceOf(f)
  const v = verdictOf(f)
  const out = outsideEvidence(f)
  const diff = diffOf(f)
  const hot = useHot(g.pages)
  const enter = () => { hot.onMouseEnter(); setOn(i) }
  const leave = () => { hot.onMouseLeave(); setOn(null) }
  const value = v === 'differs' && diff ? <span className="font-normal text-stone-600"><Tok parts={diff.tokens.site} /> on your site · <Tok parts={diff.tokens.source} /> on {src.name}</span>
    : ['trustpilot_rating', 'bbb_rating'].includes(f.field) && out && v === 'agrees' ? out.snippet : claimParts(f)[1]
  return (
    <li onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={leave} className={`flex min-w-0 items-center gap-3 transition-opacity duration-200 ${dim ? 'opacity-40' : ''}`}>
      <SourceLogo src={src} size="h-8 w-8 rounded-lg" className="ring-1 ring-[var(--color-line)]" />
      <div className="min-w-0 flex-1">
        <p className={`text-[14px] leading-5 ${val}`}>{src.name}<span className="sr-only">: {checking ? 'checking' : VERDICT_SAYS[v]}</span></p>
        <p className={`text-[14px] leading-5 ${v === 'differs' ? '' : 'text-stone-900'} [overflow-wrap:anywhere]`}>{checking ? <span className="text-stone-600">Checking…</span> : value}</p>
      </div>
      {out
        ? <a href={out.url} target="_blank" rel="noreferrer" aria-label={`Open ${src.name}`} className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-stone-600 transition-colors duration-150 hover:bg-tint hover:text-stone-900 ${focus}`}><ArrowUpRight size={15} aria-hidden /></a>
        : <span aria-hidden className="w-7 shrink-0" />}
    </li>
  )
}
const LOOSE_MARKS = 5
function SourcesCard({ cards, scan, loose, onCheck }) {
  const read = new Date(READ_AT)
  const when = read.toDateString() === new Date().toDateString() ? 'today' : read.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const count = (v) => cards.filter((g) => verdictOf(g.lead) === v).length
  const [same, off, none] = [count('agrees'), count('differs'), count('unchecked')]
  const parts = [
    same > 0 && <span key="s">{same} {same === 1 ? 'matches' : 'match'}</span>,
    off > 0 && <span key="o" className="text-negative">{off} {off === 1 ? 'doesn’t' : 'don’t'} match</span>,
    none > 0 && <span key="n">{none} not found</span>,
  ].filter(Boolean)
  // the connectors are drawn to the diagram's real height
  const box = useRef(null)
  const [h, setH] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return undefined
    const fit = () => setH(Math.round(el.getBoundingClientRect().height))
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    fit()
    return () => ro.disconnect()
  }, [])
  const [on, setOn] = useState(null) // the hovered source
  const W = 84, n = cards.length
  const busy = (i) => scan?.read != null || scan?.checking <= i
  return (
    <section className={`${card} flex h-full flex-col gap-3 p-5`}>
      <div>
        <h2 className={h2}>Checked against outside sources <Count n={cards.length} /></h2>
        <p className={`num ${sub}`}>{parts.map((x, i) => <span key={x.key}>{i > 0 && ' · '}{x}</span>)}</p>
      </div>
      <div ref={box} className="grid min-h-[216px] flex-1" style={{ gridTemplateColumns: `44px ${W}px minmax(0,1fr)` }}>
        <div className="flex items-center">
          <span className="wf-anim wf-pop grid h-11 w-11 place-items-center rounded-full border border-line bg-surface"><BrandLogo size="h-7 w-7 rounded-md" /></span>
        </div>
        <div className="relative">
        <svg width={W} height={h} viewBox={`0 0 ${W} ${Math.max(1, h)}`} fill="none" aria-hidden className="absolute left-0 top-0 overflow-visible">
          {h > 0 && cards.map((g, i) => {
            const v = verdictOf(g.lead)
            const y = ((i + 0.5) * h) / n
            const d = `M 0 ${h / 2} C ${W * 0.55} ${h / 2}, ${W * 0.45} ${y}, ${W} ${y}`
            const width = on === i ? 2.75 : 1.5
            const start = 300 + i * 240 // the connectors draw one after another, left to right
            const look = { opacity: (on != null && on !== i) || busy(i) ? 0.25 : 1, transition: 'opacity 150ms ease-out, stroke-width 150ms ease-out' }
            if (v === 'unchecked') return <path key={`${g.id}-${scan ? 'x' : 'r'}`} d={d} stroke="var(--color-stone-400)" strokeWidth={width} strokeLinecap="round" strokeDasharray="1 6" className="wf-anim fade-in" style={{ ...look, animationDuration: '300ms', animationDelay: `${start}ms`, animationFillMode: 'backwards' }} />
            return (
              <g key={`${g.id}-${scan ? 'x' : 'r'}`} style={look}>
                <path d={d} pathLength="1" stroke={v === 'differs' ? 'var(--negative)' : 'var(--color-stone-600)'} strokeWidth={width} strokeLinecap="round" className="wf-anim wf-draw" style={{ animationDuration: '420ms', animationDelay: `${start}ms`, transition: 'stroke-width 150ms ease-out' }} />
                {/* the mismatch's line breaks in the middle, once it has drawn */}
                {v === 'differs' && <path d={d} pathLength="1" stroke="var(--color-surface)" strokeWidth="7" strokeDasharray="0.13 1" strokeDashoffset="-0.44" className="wf-anim fade-in" style={{ animationDuration: '200ms', animationDelay: `${start + 460}ms`, animationFillMode: 'backwards' }} />}
              </g>
            )
          })}
        </svg>
        </div>
        <ul className="grid min-w-0 pl-3" style={{ gridTemplateRows: `repeat(${n}, minmax(0, 1fr))` }}>
          {cards.map((g, i) => <SourceNode key={g.id} g={g} i={i} checking={scan?.checking === i} dim={(on != null && on !== i) || busy(i)} setOn={setOn} />)}
        </ul>
      </div>
      {/* what had no outside source to check against, and when the check ran */}
      <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[var(--div)] pt-3 ${sub}`}>
        {loose.length > 0 && (
          <p className="flex items-center gap-2">
            <span className={`num ${val}`}>No outside source for {plural(loose.length, 'fact')}</span>
            <span className="flex items-center gap-0.5">
              {loose.slice(0, LOOSE_MARKS).map((g) => <EdgeTip key={g.id} tip={g.lead.value} label={g.lead.value} className="block"><span className="grid h-5 w-5 place-items-center"><Mark fact={g.lead} size={markOf(g.lead) ? 18 : 15} /></span></EdgeTip>)}
              {loose.length > LOOSE_MARKS && <EdgeTip className="block" label={`${loose.length - LOOSE_MARKS} more`} tip={<span className="flex flex-col gap-0.5">{loose.slice(LOOSE_MARKS).map((g) => <span key={g.id}>{g.lead.value}</span>)}</span>}><span className="num pl-1">+{loose.length - LOOSE_MARKS}</span></EdgeTip>}
            </span>
          </p>
        )}
        <p className="ml-auto">Checked {when} · <button type="button" disabled={!!scan} onClick={onCheck} className={link}>Check again</button></p>
      </div>
    </section>
  )
}

// ---- Where we read it: one ring for every page we tried, in three parts, clockwise from 12 o'clock: pages a fact
// came from (dark graphite) · pages read with no facts (mid grey) · pages we couldn't read (red). Hover or focus a part:
// it thickens, the others dim, the centre shows its count and the text beside the ring names it. Beside the ring, the sections that gave facts as compact
// blocks: the fact count, the section's name and page count, and one row of the logos / icons of its facts.
const RING_PARTS = [
  { id: 'facts', stroke: 'var(--color-stone-700)', word: 'pages gave facts' },
  { id: 'plain', stroke: 'var(--color-stone-400)', word: 'read, no facts' },
  { id: 'bad', stroke: 'var(--negative)', word: 'couldn’t be read' },
]
// each part's arc on a ring of circumference C: its span is its share; the dash leaves room for the round caps (half
// the stroke at each end) and a small gap to its neighbours
function ringArcs(C, SW, counts, total) {
  const GAP = 5
  let at = 0
  return RING_PARTS.map((part) => {
    const n = counts[part.id] ?? 0
    const span = (n / total) * C
    const arc = n ? { at, span, from: at + SW / 2 + GAP / 2, len: Math.max(0.5, span - SW - GAP) } : null
    at += span
    return { ...part, n, arc }
  })
}
function SiteRing({ size, counts, total, reading, shown, part, setPart, share }) {
  const S = size, SW = 6
  const r = (S - SW - 3) / 2 // 3px of room for the hovered part's extra thickness
  const C = 2 * Math.PI * r
  const c = { cx: S / 2, cy: S / 2, r, fill: 'none', strokeLinecap: 'round' }
  const dash = (from, len) => ({ strokeDasharray: `${len} ${C}`, strokeDashoffset: -from })
  const arcs = ringArcs(C, SW, counts, total)
  const facts = arcs[0].arc
  const cur = arcs.find((p) => p.id === part)
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: S, height: S }} onMouseLeave={() => setPart(null)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPart(null) }}>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="-rotate-90">
        <circle {...c} strokeWidth={SW} stroke="var(--color-line)" />
        {reading ? <circle {...c} strokeWidth={SW} stroke="var(--color-stone-400)" {...dash(SW / 2, Math.max(0.5, (shown / total) * C - SW))} />
          : arcs.map((p, i) => p.arc && (
            <g key={p.id}>
              <circle {...c} stroke={p.stroke} strokeWidth={part === p.id ? SW + 3 : SW} opacity={(part && part !== p.id) || (share && p.id === 'facts') ? 0.3 : 1} {...dash(p.arc.from, p.arc.len)}
                className="wf-anim wf-ring" style={{ '--wf-c': C, animationDuration: '520ms', animationDelay: `${150 + i * 330}ms`, transition: 'stroke-width 150ms ease-out, opacity 150ms ease-out', pointerEvents: 'none' }} />
              {/* a wide, unseen arc over the part: what the pointer and the keyboard land on */}
              <circle {...c} strokeLinecap="butt" stroke="transparent" strokeWidth={20} {...dash(p.arc.at, p.arc.span)} tabIndex={0} role="img" aria-label={`${p.n} ${p.word}`}
                onMouseEnter={() => setPart(p.id)} onFocus={() => setPart(p.id)} style={{ pointerEvents: 'stroke', outline: 'none', cursor: 'default' }} />
            </g>
          ))}
        {/* a hovered section's share of the "facts" part */}
        {!reading && share && facts && <circle {...c} stroke="var(--color-stone-700)" strokeWidth={SW + 3} {...dash(facts.from + share[0] * facts.len, Math.max(0.5, share[1] * facts.len))} style={{ pointerEvents: 'none' }} />}
      </svg>
      {/* the centre holds one short number on one line and nothing else ("38/40"; a part's count on hover); what it
          counts is said beside the ring */}
      <span className="pointer-events-none absolute grid place-items-center">
        <CrossFade k={reading ? 'reading' : cur?.id ?? 'all'} ms={130}>
          <b className="num block whitespace-nowrap text-[14px] leading-4 font-bold tracking-[-0.01em] text-stone-900">{reading || !cur ? `${shown}/${total}` : cur.n}</b>
        </CrossFade>
      </span>
    </span>
  )
}
const TILE_MARKS = 6
function SectionBlock({ s, si, groups, glow, onBox }) {
  const { hot, setHot } = useContext(Hot)
  const [active, setActive] = useState(false)
  const urls = new Set(s.pages.map((p) => p.url))
  const here = (g) => g.pages.filter((u) => urls.has(u)).map(where).join(', ')
  const more = groups.length - TILE_MARKS
  const lit = glow || (hot?.src === 'fact' && s.pages.some((p) => hot.urls.has(p.url)))
  const enter = () => { if (active) return; setActive(true); setHot({ urls, src: 'tile' }); onBox(s.label) }
  const leave = () => { setActive(false); setHot(null); onBox(null) }
  return (
    // compact: the count at the left; beside it the section's name and page count, and the logos of its facts under them
    <div tabIndex={0} role="group" aria-label={`${s.label}: ${plural(groups.length, 'fact')} from ${plural(s.pages.length, 'page')}`}
      onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) leave() }}
      style={{ animationDelay: `${150 + si * 90}ms`, animationFillMode: 'backwards' }}
      className={`wf-anim card-in relative flex min-h-[72px] min-w-0 items-center gap-3 rounded-lg border bg-surface px-3.5 py-2.5 transition-[transform,box-shadow,border-color] duration-200 ${lit ? 'border-stone-600' : 'border-line'} ${active ? 'z-20 -translate-y-0.5 shadow-md' : ''} ${focus}`}>
      <b className="num shrink-0 text-[30px] leading-9 font-semibold tracking-[-0.02em] text-stone-900">{groups.length}</b>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2"><span className={`text-[14px] leading-5 ${val}`}>{s.label}</span><span className={`num ${sub}`}>{plural(s.pages.length, 'page')}</span></p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {groups.slice(0, TILE_MARKS).map((g, i) => (
            <EdgeTip key={g.id} className="block" label={shortName(g.lead)} tip={<span className="flex flex-col gap-0.5"><span className={val}>{shortName(g.lead)}</span><span className="text-stone-600">{here(g)}</span></span>}>
              <span className="wf-anim wf-pop block" style={{ animationDelay: `${450 + si * 90 + i * 60}ms` }}><Mark fact={g.lead} size={18} /></span>
            </EdgeTip>
          ))}
          {more > 0 && <span className={`num ${sub}`}>+{more}</span>}
        </div>
      </div>
      {/* hover or focus: the facts found here by name, and the pages they came from */}
      {active && (
        <div className="absolute -inset-x-px top-full z-20 pt-1.5">
          <ul className="wf-anim card-in flex flex-col gap-2 rounded-lg border border-line bg-raised p-3 shadow-lg">
            {groups.map((g) => (
              <li key={g.id} className="flex items-start gap-2">
                <Mark fact={g.lead} size={18} />
                <span className="min-w-0">
                  <span className={`block text-[13px] leading-[18px] ${val} [overflow-wrap:anywhere]`}>{shortName(g.lead)}</span>
                  <span className="block text-[12px] leading-4 text-stone-600 [overflow-wrap:anywhere]">{here(g)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
function PagesRead({ list, facts, merged, scan, hasRead, onRetry, k }) {
  const sections = useMemo(() => pageSections(list), [list])
  const okPages = list.filter((p) => p.ok).length
  const factPages = list.filter((p) => factsOnPage(facts, p.url).length).length
  const counted = useCountUp(hasRead ? okPages : 0, 700, 0)
  const reading = scan?.read != null
  const withFacts = sections.map((s) => {
    const urls = new Set(s.pages.map((p) => p.url))
    return { s, groups: merged.filter((g) => g.lead.status !== 'REJECTED' && g.pages.some((u) => urls.has(u))) }
  })
  const tiles = withFacts.filter((x) => x.groups.length)
  const none = withFacts.filter((x) => !x.groups.length).map((x) => x.s.label)
  const bad = list.filter((p) => !p.ok)
  const shown = reading ? scan.read + 1 : hasRead || scan ? (scan ? list.length : counted) : 0
  // the ring's three parts, and what is hovered: a part of the ring, or a section box (its share of the "facts" part)
  const factUrls = list.filter((p) => p.ok && factsOnPage(facts, p.url).length).map((p) => p.url)
  const counts = hasRead || scan ? { facts: factUrls.length, plain: okPages - factUrls.length, bad: bad.length } : {}
  const [part, setPart] = useState(null)
  const [box, setBox] = useState(null)
  const boxPages = box ? sections.find((x) => x.label === box)?.pages.map((p) => p.url) ?? [] : []
  const mine = factUrls.filter((u) => boxPages.includes(u))
  const share = mine.length ? [factUrls.indexOf(mine[0]) / factUrls.length, mine.length / factUrls.length] : null
  // the ring is as tall as the section boxes beside it, centred on them
  const boxes = useRef(null)
  const [size, setSize] = useState(124)
  useLayoutEffect(() => {
    const el = boxes.current
    if (!el) return undefined
    const fit = () => setSize(Math.max(72, Math.min(120, Math.round(el.getBoundingClientRect().height))))
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    fit()
    return () => ro.disconnect()
  }, [hasRead])
  return (
    <section className={`${card} flex flex-col gap-3 p-5 lg:p-6`}>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className={h2}>Where we read it</h2>
        <p className={`num ${sub}`} aria-live="polite">
          {reading ? <>Reading {where(list[scan.read].url)}</> : scan ? 'Checking the sources' : hasRead ? <>Facts came from <b className={val}>{factPages}</b> pages</> : <>Up to <b className={val}>{list.length}</b> pages from your sitemap</>}
        </p>
      </div>
      <div className="flex flex-col items-center gap-6 min-[900px]:flex-row">
        <div className="flex shrink-0 items-center gap-3">
          <SiteRing key={`ring-${k}`} size={size} counts={scan ? {} : counts} total={list.length} reading={reading || !!scan} shown={shown} part={part} setPart={setPart} share={share} />
          {/* what the ring's number counts: a fixed width, so swapping the label on hover moves nothing */}
          <div className="w-[124px] text-[13px] leading-[18px] text-stone-600">
            <CrossFade k={reading ? 'reading' : scan ? 'checking' : part ?? 'all'} ms={130}>
              <span className="block">
                <b className={`block whitespace-nowrap text-[14px] leading-5 ${val}`}>{reading ? 'reading' : scan ? 'checking' : part ? RING_PARTS.find((x) => x.id === part).word : hasRead ? 'pages read' : 'pages, at most'}</b>
                <span className="num block whitespace-nowrap">{reading || scan ? `of ${list.length} pages` : part ? `of ${list.length} pages` : hasRead ? (bad.length ? `${bad.length} couldn’t be read` : 'all of them') : 'from your sitemap'}</span>
              </span>
            </CrossFade>
          </div>
        </div>
        {hasRead && (
          <div ref={boxes} key={`boxes-${k}`} className="grid w-full min-w-0 flex-1 grid-cols-2 items-stretch gap-3 min-[1100px]:grid-cols-4">
            {tiles.map(({ s, groups }, si) => <SectionBlock key={s.label} s={s} si={si} groups={groups} glow={part === 'facts'} onBox={setBox} />)}
          </div>
        )}
      </div>
      {hasRead && !scan && (none.length > 0 || bad.length > 0) && (
        <div className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 ${sub}`}>
          <p>{none.length > 0 && <>{none.join(', ')} · read, no facts</>}</p>
          {bad.length > 0 && <button type="button" onClick={onRetry} className={link}>Retry</button>}
        </div>
      )}
    </section>
  )
}

// ---- Read, but not facts: one slim full-width row at the end of the page. Clicking it opens it in place, downward (it
// only lengthens the page): the texts as three open columns split by hairlines, each drawn where it lives, with Use
// as a fact (it joins the fact sheet, waiting) and Reject (a small ×; Undo for a few seconds).
// A text shown where it really lives, drawn in graphite outlines and neutral fills; the real text is the darkest thing
// in it. title → a browser tab · description → a search result · heading → the top of a page. All three are one height.
const realText = 'rounded-sm text-stone-900 transition-colors duration-150 group-hover/col:bg-tint'
function TextScene({ f, i, title }) {
  const text = <span data-wf-from={f.id}>{f.value}</span>
  const later = { animationDelay: `${260 + i * 110}ms`, animationFillMode: 'backwards', animationDuration: '260ms' } // the text comes in after its outline
  const line = 'h-1.5 rounded-full bg-stone-300'
  return (
    <div className="wf-anim card-in flex h-[124px] flex-col justify-center overflow-hidden rounded-lg bg-tint px-3.5 transition-[transform,box-shadow] duration-200 group-hover/col:-translate-y-0.5 group-hover/col:shadow-sm" style={{ animationDelay: `${80 + i * 110}ms`, animationFillMode: 'backwards' }} aria-hidden={false}>
      {f.field === 'title' ? (
        // a browser tab, with the address bar under it
        <div>
          <div className="flex w-fit max-w-full items-center gap-2 rounded-t-lg border border-b-0 border-stone-300 bg-surface px-2.5 py-2">
            <BrandLogo size="h-4 w-4 rounded-sm" className="shrink-0" />
            <span className={`wf-anim fade-in min-w-0 text-[13px] leading-[18px] font-semibold [overflow-wrap:anywhere] ${realText}`} style={later}>{text}</span>
          </div>
          <div className="flex h-8 items-center gap-2 rounded-b-lg rounded-tr-lg border border-stone-300 bg-surface px-2.5">
            <span className="h-3 w-3 shrink-0 rounded-full border border-stone-300" />
            <span className="truncate text-[12px] leading-4 text-stone-600">{brand.domain}</span>
          </div>
        </div>
      ) : f.field === 'description' ? (
        // a search result: the site line, the page title as the result's heading, the description as its text
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-[12px] leading-4 text-stone-600"><BrandLogo size="h-4 w-4 rounded-full" className="shrink-0" />{brand.domain}</span>
          <span className="truncate text-[13px] leading-[18px] text-stone-600 underline decoration-stone-300 underline-offset-2">{title ?? brand.name}</span>
          <span className={`wf-anim fade-in line-clamp-3 text-[13px] leading-[18px] font-semibold ${realText}`} style={later}>{text}</span>
        </div>
      ) : (
        // the top of a page: a thin nav line, the heading, two lines of text to come
        <div className="flex flex-col gap-2.5">
          <span className="flex items-center gap-2 border-b border-stone-300 pb-2"><BrandLogo size="h-3.5 w-3.5 rounded-sm" className="shrink-0" /><span className={`${line} w-8`} /><span className={`${line} w-8`} /><span className={`${line} ml-auto w-10`} /></span>
          <span className={`wf-anim fade-in line-clamp-2 text-[18px] leading-6 font-bold tracking-[-0.01em] ${realText}`} style={later}>{text}</span>
          <span className="flex flex-col gap-1.5"><span className={`${line} w-11/12`} /><span className={`${line} w-2/3`} /></span>
        </div>
      )}
    </div>
  )
}
// one text: a label row (with Reject as a small × at its right), the text where it lives, and Use as a fact.
// leaving: it was just used or rejected, and closes while the columns beside it widen.
function NotFactColumn({ f, i, title, leaving, onUse, onReject }) {
  const Icon = KIND_ICON[f.field] ?? StickyNote
  const site = siteEvidence(f)
  return (
    <li aria-hidden={leaving || undefined} className={`group/col wf-anim relative flex min-w-0 basis-0 flex-col gap-3 overflow-hidden transition-[flex-grow,opacity,padding] duration-300 ease-out max-sm:py-4 max-sm:first:pt-0 max-sm:last:pb-0 ${leaving ? 'grow-0 opacity-0 sm:px-0' : 'grow sm:px-5 sm:first:pl-0 sm:last:pr-0'}`}>
      <div className={`flex items-center gap-2 ${sub}`}>
        <Icon size={15} strokeWidth={1.75} aria-hidden className="shrink-0" />
        <span className="min-w-0 truncate">{KIND[f.field]}{site ? ` · ${where(site.url)}` : ''}</span>
        <span className="group/x relative ml-auto shrink-0">
          <button type="button" aria-label={`Reject “${f.value}”`} disabled={leaving} onClick={() => onReject(f)} className={`grid h-7 w-7 place-items-center rounded-md text-stone-600 transition-colors duration-150 hover:bg-tint hover:text-stone-900 ${focus}`}><X size={15} aria-hidden /></button>
          <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-30 mt-1 hidden rounded-md border border-line bg-raised px-2 py-1 text-[12px] leading-4 text-stone-900 shadow-sm group-focus-within/x:block group-hover/x:block">Reject</span>
        </span>
      </div>
      <TextScene f={f} i={i} title={title} />
      <button type="button" disabled={leaving} className={`${secondary} self-start`} onClick={() => onUse(f)}>Use as a fact</button>
    </li>
  )
}
function NotFacts({ items, gone, onUse, onReject, onUndo }) {
  const [open, setOpen] = useState(false)
  const [run, setRun] = useState(0) // each opening draws the three in again
  // a text that was just used or rejected stays for a moment as a closing column, so the others widen instead of jumping
  const [shown, setShown] = useState(items)
  useEffect(() => {
    if (reduced()) { setShown(items); return undefined }
    setShown((was) => [...was, ...items.filter((f) => !was.some((x) => x.id === f.id))].map((f) => items.find((x) => x.id === f.id) ?? f).sort((x, y) => x.id.localeCompare(y.id, undefined, { numeric: true })))
    const t = setTimeout(() => setShown(items), 320)
    return () => clearTimeout(t)
  }, [items])
  const title = items.find((f) => f.field === 'title')?.value
  return (
    <section className={card}>
      <button type="button" aria-expanded={open} onClick={() => { setOpen((o) => !o); setRun((r) => r + 1) }} className={`flex w-full items-baseline gap-2 rounded-xl px-5 py-4 text-left ${focus}`}>
        <span className="shrink-0 text-[15px] leading-[22px] font-bold text-stone-900">Read, but not facts</span>
        <Count n={items.length} />
        {/* the closed bar previews its texts (the first words of each); the preview fades out when the row opens */}
        <span aria-hidden className={`ml-2 flex min-w-0 flex-1 items-center gap-4 self-center transition-opacity duration-200 ${open ? 'opacity-0' : ''}`}>
          <BrandLogo size="h-5 w-5 rounded" className="shrink-0" />
          {items.map((f) => {
            const Icon = KIND_ICON[f.field] ?? StickyNote
            return <span key={f.id} className={`flex min-w-0 flex-1 basis-0 items-center gap-1.5 ${sub}`}><Icon size={14} strokeWidth={1.75} className="shrink-0" /><span className="truncate">{KIND[f.field]} · {f.value}</span></span>
          })}
        </span>
        <ChevronDown size={15} aria-hidden className={`ml-auto shrink-0 self-center text-stone-600 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {/* the height eases open; closed, what's inside can't be reached */}
      <div className="wf-anim grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }} inert={open ? undefined : ''}>
        <div className={`min-h-0 ${open ? '' : 'overflow-hidden'}`}>
          <div key={run} className="flex flex-col gap-4 px-5 pb-5">
            <p className={sub}>We read these but didn’t treat them as facts.</p>
            {/* three open columns of equal width, split by the standard hairline */}
            {shown.length > 0 && (
              <ul className="flex flex-col divide-line max-sm:divide-y sm:flex-row sm:items-start sm:divide-x">
                {shown.map((f, i) => <NotFactColumn key={f.id} f={f} i={i} title={title} leaving={!items.some((x) => x.id === f.id)} onUse={onUse} onReject={onReject} />)}
              </ul>
            )}
            {gone && <p className={`wf-anim card-in ${sub}`} aria-live="polite">Rejected “{gone.value}” · <button type="button" onClick={onUndo} className={link}>Undo</button></p>}
            {!items.length && !gone && <p className={sub}>Nothing left here.</p>}
          </div>
        </div>
      </div>
    </section>
  )
}

function Fold({ title, count, children }) {
  const [open, setOpen] = useState(false)
  return (
    <section className={card}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`flex w-full items-baseline gap-2 rounded-xl px-5 py-4 text-left ${focus}`}>
        <span className="text-[15px] leading-[22px] font-bold text-stone-900">{title}</span>
        <Count n={count} />
        <ChevronDown size={15} aria-hidden className={`ml-auto self-center text-stone-600 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="wf-anim card-in border-t border-[var(--div)]">{children}</div>}
    </section>
  )
}
// ---- the page -------------------------------------------------------------------------------------------------------
export default function WebsiteFactsPage() {
  useEffect(() => { document.title = 'Fact Check · Kraffic' }, [])
  const preview = new URLSearchParams(window.location.search).get('wf')
  const list = useMemo(() => samplePages(brand.domain), [])
  const [facts, setFacts] = useState(() => {
    const fs = sampleFacts(brand.domain, brand.name)
    // ?wf=done: everything decided (the newer founding claim kept, the other rejected)
    return preview === 'done' ? fs.map((f) => (f.status !== 'DISCOVERED' ? f : { ...f, status: f.id === 'f16' || f.category === 'page' ? 'REJECTED' : 'CONFIRMED' })) : fs
  })
  const [hasRead, setHasRead] = useState(preview !== 'empty')
  const [scan, setScan] = useState(null) // { read: pages read so far } then { checking: index of the source being checked }
  const [round, setRound] = useState(0) // replays the entrances after a re-read
  const [landing, setLanding] = useState(() => new Set())
  const [picked, setPicked] = useState(null) // the claim kept in a contradiction, while it resolves
  const [skipped, setSkipped] = useState(() => new Set()) // Ready to confirm rows the user unticked
  const [batch, setBatch] = useState(null) // a Confirm in flight: { rows, sent: Set }
  const [gone, setGone] = useState(null) // the text just rejected in Read, but not facts (Undo for a few seconds)
  const [undo, setUndo] = useState(null) // the last Confirm: { ids, n }
  const [resolved, setResolved] = useState([]) // calls already made: { key, name, result, ids, pos }
  const [hot, setHot] = useState(null)
  const hotCtx = useMemo(() => ({ hot, setHot }), [hot])
  const b = useMemo(() => bucketsOf(facts, READ_YEAR), [facts])
  const calls = b.conflicts.length + b.differs.length
  const ticked = b.ready.filter((g) => !skipped.has(g.id))

  const setStatus = (ids, status) => setFacts((fs) => fs.map((f) => (ids.includes(f.id) ? { ...f, status } : f)))
  // "Into the sheet", for text that isn't in the sheet yet (Read, but not facts): it leaves its card and lands on its new row
  const flyToSheet = (id, text, apply) => {
    const r0 = document.querySelector(`[data-wf-from="${id}"]`)?.getBoundingClientRect()
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
  // Confirm: the ticked facts are confirmed one after another (each row moves up to "In use" in the fact sheet)
  const confirmTicked = () => {
    const go = ticked
    const done = { ids: go.flatMap((g) => g.ids), n: go.length }
    if (!go.length) return
    if (reduced()) { setStatus(done.ids, 'CONFIRMED'); setUndo(done); return }
    setBatch({ rows: b.ready, sent: new Set() })
    go.forEach((g, i) => setTimeout(() => { setStatus(g.ids, 'CONFIRMED'); setBatch((bt) => bt && { ...bt, sent: new Set(bt.sent).add(g.id) }) }, i * 130))
    setTimeout(() => { setBatch(null); setUndo(done) }, go.length * 130 + 450)
  }
  // Read, but not facts: "Use as a fact" makes it a fact waiting to be confirmed; "Reject" leaves an Undo for a few seconds
  const useAsFact = (f) => flyToSheet(f.id, f.value, () => setFacts((fs) => fs.map((x) => (x.id === f.id ? { ...x, category: 'custom' } : x))))
  const rejectText = (f) => { setStatus([f.id], 'REJECTED'); setGone(f) }
  const undoText = () => { setStatus([gone.id], 'DISCOVERED'); setGone(null) }
  const undoConfirm = () => { setStatus(undo.ids, 'DISCOVERED'); setUndo(null) }
  const toggle = (g) => setSkipped((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n })
  // Your call: the open decisions, in order, and the ones already made (each collapses to one line with Undo)
  const openCalls = [...b.conflicts.map((c) => ({ key: `c:${c.a.id}`, c })), ...b.differs.map((g) => ({ key: `d:${g.id}`, g }))]
  const settled = resolved.filter((r) => !openCalls.some((o) => o.key === r.key))
  const callItems = [...openCalls]
  ;[...settled].sort((x, y) => x.pos - y.pos).forEach((r) => callItems.splice(Math.min(r.pos, callItems.length), 0, { key: r.key, r }))
  const settle = (key, name, result, ids) => setResolved((rs) => [...rs.filter((r) => r.key !== key), { key, name, result, ids, pos: Math.max(0, callItems.findIndex((it) => it.key === key)) }])
  const undoCall = (r) => { setStatus(r.ids, 'DISCOVERED'); setResolved((rs) => rs.filter((x) => x.key !== r.key)) }
  const pickOne = (keep, drop) => {
    const key = `c:${[keep, drop].find((g) => openCalls.some((o) => o.key === `c:${g.id}`))?.id ?? keep.id}`
    const finish = () => settle(key, KIND[keep.lead.field], keep.lead.value, [...keep.ids, ...drop.ids])
    if (reduced()) { setStatus(drop.ids, 'REJECTED'); setStatus(keep.ids, 'CONFIRMED'); finish(); return }
    setPicked(keep.id)
    setTimeout(() => { setStatus(keep.ids, 'CONFIRMED'); setStatus(drop.ids, 'REJECTED'); setPicked(null); finish() }, 600)
  }
  const keepSite = (g) => {
    const finish = () => settle(`d:${g.id}`, KIND[g.lead.field], g.lead.value, g.ids)
    if (reduced()) { setStatus(g.ids, 'CONFIRMED'); finish(); return }
    setPicked(g.id)
    setTimeout(() => { setStatus(g.ids, 'CONFIRMED'); setPicked(null); finish() }, 600)
  }
  const dropFact = (g) => { settle(`d:${g.id}`, KIND[g.lead.field], 'dropped', g.ids); setStatus(g.ids, 'REJECTED') }
  const add = (field, value) => {
    const kind = ADD_KINDS.flatMap((g) => g.items).find((it) => it.field === field)
    setFacts((fs) => [...fs, { id: `you${fs.length + 1}`, category: kind?.category ?? 'custom', field, value, status: 'ADDED_BY_YOU', source: 'YOU', notes: null, evidence: [] }])
  }

  useEffect(() => {
    if (!gone) return undefined
    const t = setTimeout(() => setGone(null), 6000)
    return () => clearTimeout(t)
  }, [gone])
  // "Read website again": the rings fill page by page, section by section, then each source is checked in turn
  const read = () => { if (scan) return; if (reduced()) { setHasRead(true); return } setScan({ read: 0 }) }
  useEffect(() => {
    if (!scan) return undefined
    let t
    if (scan.read != null) t = setTimeout(() => setScan(scan.read >= list.length - 1 ? { checking: 0 } : { read: scan.read + 1 }), scan.read >= list.length - 1 ? 350 : 60)
    else if (scan.checking >= b.cards.length) { setScan(null); setHasRead(true); setRound((r) => r + 1) } else t = setTimeout(() => setScan({ checking: scan.checking + 1 }), 800)
    return () => clearTimeout(t)
  }, [scan]) // eslint-disable-line react-hooks/exhaustive-deps
  const scanLine = !scan ? null
    : scan.read != null ? `facts confirmed · reading page ${scan.read + 1} of ${list.length}`
      : `facts confirmed · checking ${sourceOf(b.cards[Math.min(scan.checking, b.cards.length - 1)].lead).name}`

  const hero = <Hero key={round} b={b} calls={calls} scan={scan} hasRead={hasRead} onRead={read} scanLine={scanLine} />
  const pagesRead = <PagesRead list={list} facts={facts} merged={b.merged} scan={scan} hasRead={hasRead} onRetry={read} k={round} />

  // never read: say what reading does, and show the pages waiting
  if (!hasRead) return <Hot.Provider value={hotCtx}>{hero}{pagesRead}</Hot.Provider>

  const rows = batch ? batch.rows : b.ready
  const undoLine = undo && !batch && <><b className={`num ${val}`}>{undo.n} confirmed</b> · <button type="button" onClick={undoConfirm} className={link}>Undo</button></>
  const doneMark = <span className="grid h-10 w-10 place-items-center rounded-full bg-tint text-stone-700"><Check size={20} aria-hidden /></span>
  const doneBox = 'wf-anim card-in flex flex-1 flex-col items-center justify-center gap-2 p-5 text-center'
  let n = 0
  return (
    <Hot.Provider value={hotCtx}>
      {hero}
      {pagesRead}

      {/* a 2×2 grid of equal columns: Your call · the sources / Ready to confirm · the fact sheet. The two cards of a row
          share their top and bottom edge; in the shorter one the leftover height goes between its rows. A left card
          that has nothing left shows its done state in the same cell. */}
      <div className="grid grid-cols-1 items-stretch gap-3 md:gap-4 lg:grid-cols-2">
        {/* any height left over from the card beside it stays under the last decision */}
        <section className={`${card} flex min-w-0 flex-col`}>
          <h2 className={`${h2} px-5 pt-5`}>Your call <Count n={calls} /></h2>
          <div className={`flex flex-col divide-y divide-line ${calls ? '' : 'flex-1'}`}>
            {callItems.map((it) => (it.r ? <ResolvedLine key={it.key} r={it.r} onUndo={undoCall} />
              : it.c ? <ConflictItem key={it.key} c={it.c} n={n += 1} onPick={pickOne} picked={picked} />
                : <DiffersItem key={it.key} g={it.g} n={n += 1} onKeep={keepSite} onDrop={dropFact} picked={picked} />))}
            {!calls && <div className={doneBox}>{doneMark}<p className={`text-[15px] leading-[22px] ${val}`}>Nothing needs your call</p></div>}
          </div>
        </section>
        <div className="min-w-0">{b.cards.length > 0 && <SourcesCard cards={b.cards} scan={scan} onCheck={read} loose={b.merged.filter((g) => g.lead.status !== 'REJECTED' && g.lead.source !== 'YOU' && !sourceOf(g.lead))} />}</div>

        <section className={`${card} flex min-w-0 flex-col gap-3 p-5`}>
          {rows.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className={h2}>Ready to confirm <Count n={rows.length} /></h2>
                  <p className={sub}>Untick anything drafts shouldn’t use.</p>
                </div>
                <button type="button" className={primary} disabled={!ticked.length || !!batch} onClick={confirmTicked}>
                  <Check size={15} aria-hidden />{ticked.length === b.ready.length || batch ? `Confirm all ${batch ? rows.length : ticked.length}` : `Confirm ${ticked.length}`}
                </button>
              </div>
              <ReadyList rows={rows} skipped={skipped} sent={batch?.sent ?? new Set()} onToggle={toggle} />
              {undoLine && <p className={`border-t border-[var(--div)] pt-3 ${sub}`}>{undoLine}</p>}
            </>
          ) : (
            <>
              <h2 className={h2}>Ready to confirm <Count n={0} /></h2>
              <div className={doneBox}>
                {doneMark}
                <p className={`text-[15px] leading-[22px] ${val}`}>{calls ? 'Nothing left to confirm' : 'Nothing needs you'}</p>
                {undo && <p className={`num ${sub}`}>{undo.n} confirmed, now in use in the fact sheet. <button type="button" onClick={undoConfirm} className={link}>Undo</button></p>}
              </div>
            </>
          )}
        </section>
        <div className="min-w-0"><FactSheet b={b} landing={landing} onAdd={add} /></div>
      </div>

      {(b.notFacts.length > 0 || gone) && <NotFacts items={b.notFacts} gone={gone} onUse={useAsFact} onReject={rejectText} onUndo={undoText} />}

      {b.rejected.length > 0 && (
        <Fold title="Rejected" count={b.rejected.length}>
          <ul className="py-2">
            {b.rejected.map((g) => <li key={g.id} className="px-5 py-1.5 text-[14px] leading-5 text-stone-600 line-through">{g.lead.value}</li>)}
          </ul>
        </Fold>
      )}
    </Hot.Provider>
  )
}
