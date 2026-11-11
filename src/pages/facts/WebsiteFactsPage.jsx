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
import { AlignLeft, AppWindow, ArrowUpRight, Award, BadgeCheck, Building2, CalendarDays, Check, ChevronDown, Heading1, Mail, MapPin, Phone, Plus, Quote, RefreshCw, Search, Star, StickyNote } from 'lucide-react'
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
// in three labelled groups split by hairlines. Hover or focus the value for the page(s) it came from. Natural height.
const READY_GROUPS = [
  ['Contact', (g) => groupOf(g.lead) === 'contact'],
  ['Awards and accreditations', (g) => ['ratings', 'awards', 'accreditations'].includes(groupOf(g.lead))],
  ['Site claims', (g) => !['contact', 'ratings', 'awards', 'accreditations'].includes(groupOf(g.lead))],
]
function ReadyLine({ g, on, sent, onToggle }) {
  const f = g.lead
  const value = <span className={`text-[14px] leading-6 ${val}`} data-wf-from={g.id}><KeyValue fact={f} kept /></span>
  return (
    <li {...useHot(g.pages)} className={`flex items-center gap-2.5 py-1 transition-opacity duration-200 ${sent ? 'opacity-30' : on ? '' : 'opacity-50'}`}>
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
    <div className="flex flex-col divide-y divide-[var(--div)]">
      {groups.map((grp) => (
        <div key={grp.label} className="py-2.5 first:pt-0 last:pb-0">
          <h3 className="pb-1 text-[13px] leading-[18px] font-semibold text-stone-600">{grp.label}</h3>
          <ul>{grp.list.map((g) => <ReadyLine key={g.id} g={g} on={!skipped.has(g.id)} sent={sent.has(g.id)} onToggle={() => onToggle(g)} />)}</ul>
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
        <div className="wf-anim card-in absolute bottom-full left-0 z-40 mb-1.5 w-[300px] max-w-[calc(100vw-48px)] rounded-xl border border-line bg-raised p-1.5 shadow-lg" onKeyDown={onKey}>
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

// the fact sheet's last tile: "+ Add a fact" (the page's only dashed border). It opens a popover over the card (the
// card doesn't grow): the kind picker, a field, Add fact and Cancel. right: the tile sits in the right-hand column.
function AddSlot({ onAdd, right = false }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('note')
  const [value, setValue] = useState('')
  const wrap = useRef(null)
  const opener = useRef(null)
  usePanel(open, () => setOpen(false), wrap, opener)
  const submit = (e) => { e.preventDefault(); if (!value.trim()) return; onAdd(kind, value.trim()); setValue(''); setOpen(false); opener.current?.focus() }
  return (
    <div ref={wrap} data-flip="add" className="relative min-w-0">
      <button ref={opener} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`flex h-full min-h-[58px] w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--dashed-border)] px-3 text-[14px] font-semibold text-stone-600 transition-colors duration-150 hover:border-stone-600 hover:text-stone-900 ${focus}`}>
        <Plus size={15} aria-hidden />Add a fact
      </button>
      {open && (
        <form role="dialog" aria-label="Add a fact" onSubmit={submit} className={`absolute z-40 rounded-xl border border-line bg-raised shadow-lg wf-anim wf-panel bottom-full mb-2 flex w-[min(360px,calc(100vw-48px))] flex-col gap-2 p-3 ${right ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left'}`}>
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

// ---- the fact sheet: what Content drafts may use, as tiles in two columns. A tile: logo or line icon, the key figure
// large and bold, a short label under it, and a status mark at the top right (a tick = in use · a hollow circle =
// waiting · "Your call" in red). Contact is one full-width tile. In use first, then your call, then waiting; a
// confirmed tile moves up. Hover: the full sentence and its page. "+ Add a fact" is the last tile.
const isLit = (hot, pages) => !!hot && pages.some((u) => hot.urls.has(u))
const KeyValue = ({ fact, kept = false }) => {
  const k = keyPart(fact)
  return k ? <>{k[0]}<b className={kept ? 'font-bold' : 'font-semibold'}>{k[1]}</b>{k[2]}</> : fact.value
}
const StatusMark = ({ state, className = '' }) => (state === 'kept' ? <Check size={14} aria-label="In use" className={`shrink-0 text-stone-600 ${className}`} />
  : state === 'call' ? <span className={`shrink-0 text-[12px] leading-4 font-semibold text-negative ${className}`}>Your call</span>
    : <span role="img" aria-label="Waiting" className={`grid h-3.5 w-3.5 shrink-0 place-items-center ${className}`}><span className="h-2 w-2 rounded-full border-[1.5px] border-stone-400" /></span>)
const tileBox = 'block h-full !rounded-lg border border-line px-3 py-2 transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-0.5 hover:shadow-sm'
const TileQuote = ({ fact }) => {
  const site = siteEvidence(fact)
  return site ? <><span className="text-stone-900">“{site.snippet}”</span><span className="text-stone-600">{where(site.url)}</span></> : <span className="text-stone-600">{fact.status === 'ADDED_BY_YOU' ? 'Added by you' : KIND[fact.field]}</span>
}
function FactTile({ row, landing }) {
  const { hot } = useContext(Hot)
  const { g, pair, state } = row
  const pages = pair ? [...pair.a.pages, ...pair.b.pages] : g.pages
  const f = (pair ? pair.a : g).lead
  const t = pair ? pairTileOf(pair.a.lead, pair.b.lead) : tileOf(f)
  return (
    <div {...useHot(pages)} data-flip={row.id} data-wf-slot={g?.id} className="min-w-0">
      <EdgeTip className={`${tileBox} ${isLit(hot, pages) ? 'bg-tint' : 'bg-surface'}`} label={`${t.figure}, ${t.label}`}
        tip={<span className="flex flex-col gap-1">{pair ? <><TileQuote fact={pair.a.lead} /><TileQuote fact={pair.b.lead} /></> : <TileQuote fact={f} />}</span>}>
        <span className="flex items-center gap-2">
          <Mark fact={f} size={18} />
          <span className={`min-w-0 flex-1 truncate font-bold tracking-[-0.01em] text-stone-900 transition-opacity duration-200 ${t.figure.length > 16 ? 'text-[15px]' : 'text-[17px]'} leading-[22px] ${g && landing.has(g.id) ? 'opacity-0' : ''}`}>{t.figure}</span>
          <StatusMark state={state} />
        </span>
        <span className="mt-0.5 block truncate text-[12px] leading-4 text-stone-600">{t.label}</span>
      </EdgeTip>
    </div>
  )
}
// name, phone, email and address in one full-width tile: one mark for the group, each item's own mark on hover
function ContactTile({ rows, state }) {
  const { hot } = useContext(Hot)
  const pages = rows.flatMap((r) => r.g.pages)
  return (
    <div {...useHot(pages)} data-flip="contact" className={`group/contact relative col-span-2 min-w-0 rounded-lg border border-line px-3 py-2 transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-0.5 hover:shadow-sm ${isLit(hot, pages) ? 'bg-tint' : 'bg-surface'}`}>
      <StatusMark state={state} className="absolute right-3 top-2.5" />
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 pr-6">
        {rows.map(({ g, state: own }) => {
          const Icon = KIND_ICON[g.lead.field] ?? StickyNote
          return (
            <li key={g.id} data-wf-slot={g.id} title={`${KIND[g.lead.field]}: ${g.lead.value}`} className="flex min-w-0 items-center gap-2 text-[14px] leading-5">
              <Icon size={15} strokeWidth={1.75} aria-hidden className="shrink-0 text-stone-600" />
              <span className={`min-w-0 truncate ${val}`}>{g.lead.value}</span>
              <StatusMark state={own} className="opacity-0 transition-opacity duration-150 group-hover/contact:opacity-100" />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
function FactSheet({ b, landing, onAdd }) {
  const callIds = new Set(b.differs.map((g) => g.id))
  const stateOf = (g) => (g.lead.status === 'CONFIRMED' || g.lead.status === 'ADDED_BY_YOU' ? 'kept' : callIds.has(g.id) ? 'call' : 'wait')
  const all = [...b.kept, ...b.differs, ...b.ready].map((g) => ({ id: g.id, g, state: stateOf(g) }))
  const contact = all.filter((r) => groupOf(r.g.lead) === 'contact')
  const contactState = contact.every((r) => r.state === 'kept') ? 'kept' : 'wait'
  const RANK = { kept: 0, call: 1, wait: 2 }
  // in use first, then your call, then waiting (inside a rank: the order they were read in)
  const tiles = [
    ...all.filter((r) => groupOf(r.g.lead) !== 'contact'),
    ...b.conflicts.map((c) => ({ id: `pair-${c.a.id}`, pair: c, state: 'call' })),
    ...(contact.length ? [{ id: 'contact', rows: contact, state: contactState }] : []),
  ].map((r, i) => ({ r, i })).sort((x, y) => RANK[x.r.state] - RANK[y.r.state] || (x.r.rows ? -1 : y.r.rows ? 1 : x.i - y.i)).map((x) => x.r)
  const total = b.kept.length + b.differs.length + b.ready.length + b.conflicts.length
  const inUse = useCountUp(b.kept.length, 300)
  const singles = tiles.filter((r) => !r.rows).length // the tiles that take one cell ("+ Add a fact" comes after them)
  // a tile whose status changes travels to its new place; a new tile fades in
  const box = useRef(null)
  const seen = useRef(new Map())
  const order = tiles.map((r) => r.id).join('|')
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
    <aside aria-label="Your fact sheet" className={`${card} flex h-full flex-col gap-3 p-5`}>
      <header className="flex items-center gap-3">
        <BrandLogo size="h-9 w-9 rounded-lg" />
        <h2 className={`min-w-0 flex-1 ${h2}`}>{brand.name}’s fact sheet</h2>
        <p className={`num shrink-0 ${sub}`}><b className={val}>{inUse}</b> of {total} in use</p>
      </header>
      {/* two columns of equal tiles, packed so the full-width Contact tile never leaves a half-empty row; any height the
          card is given beyond its own goes into the gaps between the rows */}
      <div ref={box} className="grid flex-1 grid-flow-dense grid-cols-2 content-between gap-x-2 gap-y-1.5" style={{ gridAutoRows: 'min-content' }}>
        {tiles.map((row) => (row.rows ? <ContactTile key="contact" rows={row.rows} state={row.state} /> : <FactTile key={row.id} row={row} landing={landing} />))}
        <AddSlot onAdd={onAdd} right={singles % 2 === 1} />
      </div>
    </aside>
  )
}

// ---- Checked against outside sources: one compact card. A summary line ("2 match · 1 doesn't match · 1 not found"),
// then a row per source: logo · name and kind, the value (a mismatch shows both) and where it is on the site · the
// status in one word · the source's link. Click a row for the quote. Under the rows: the facts no outside source
// covers (their icons, named on hover) and when the check ran.
const KIND_SHORT = { trustpilot_rating: 'rating', bbb_rating: 'rating', award: 'award' }
const Tok = ({ parts }) => <b className={val}>{parts[0]}{parts[1] && <span className="wf-anim wf-diff">{parts[1]}</span>}</b>
function SourceRow({ g, checking, waiting }) {
  const [open, setOpen] = useState(false)
  const f = g.lead
  const src = sourceOf(f)
  const v = verdictOf(f)
  const out = outsideEvidence(f)
  const site = siteEvidence(f)
  const diff = diffOf(f)
  const more = g.pages.length - 1
  const result = checking ? 'Checking…' : v === 'agrees' ? 'Matches' : v === 'differs' ? 'Doesn’t match' : 'Not found'
  const value = v === 'differs' && diff ? <span className="font-normal text-stone-600"><Tok parts={diff.tokens.site} /> on your site · <Tok parts={diff.tokens.source} /> on {src.name}</span>
    : ['trustpilot_rating', 'bbb_rating'].includes(f.field) && out && v === 'agrees' ? out.snippet : claimParts(f)[1]
  return (
    <li {...useHot(g.pages)} className={`transition-opacity duration-200 ${waiting ? 'opacity-50' : ''}`}>
      {/* logo · the claim · the status (a fixed column, right-aligned, centred in the row) · the link (its own slot, kept
          empty on a row with no link, so every status lines up) */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_92px_28px] items-center gap-x-3 py-2.5">
        <SourceLogo src={src} className="self-start" />
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`min-w-0 rounded text-left ${focus}`}>
          <span className={`block ${sub}`}><b className={`text-[14px] ${val}`}>{src.name}</b> · {KIND_SHORT[f.field] ?? KIND[f.field].toLowerCase()}</span>
          <span className={`block text-[15px] leading-[22px] ${val} [overflow-wrap:anywhere]`}>{value}</span>
          {site && <span className={`block ${sub}`}>On your site · {where(site.url)}{more > 0 ? ` · and ${plural(more, 'page')} more` : ''}</span>}
        </button>
        <span className={`whitespace-nowrap text-right text-[13px] leading-[18px] font-normal ${!checking && v === 'differs' ? 'text-negative' : 'text-stone-600'}`}>{result}</span>
        {out
          ? <a href={out.url} target="_blank" rel="noreferrer" aria-label={`Open ${src.name}`} className={`grid h-7 w-7 place-items-center rounded-md text-stone-600 transition-colors duration-150 hover:bg-tint hover:text-stone-900 ${focus}`}><ArrowUpRight size={15} aria-hidden /></a>
          : <span aria-hidden />}
      </div>
      {open && (
        <div className="wf-anim card-in flex flex-col gap-1 pb-3 pl-10 pr-10">
          <Sentence fact={f} quoted className="text-[13px] leading-[18px]" />
          {more > 0 && <p className={sub}>Also on {g.pages.slice(1).map(where).join(', ')}</p>}
        </div>
      )}
    </li>
  )
}
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
  return (
    // any height left over from the card beside it stays under the last row (never between rows)
    <section className={`${card} h-full p-5`}>
      <h2 className={h2}>Checked against outside sources <Count n={cards.length} /></h2>
      <p className={`num ${sub}`}>{parts.map((x, i) => <span key={x.key}>{i > 0 && ' · '}{x}</span>)}</p>
      <ul className="mt-2 divide-y divide-[var(--div)]">
        {cards.map((g, i) => <SourceRow key={g.id} g={g} checking={scan?.checking === i} waiting={scan?.read != null || scan?.checking < i} />)}
      </ul>
      {/* what had no outside source to check against, and when the check ran */}
      <div className="flex flex-col gap-1.5 border-t border-[var(--div)] pt-2.5">
        {loose.length > 0 && (
          <>
            <p className={`num text-[14px] leading-5 ${val}`}>No outside source for {plural(loose.length, 'fact')}</p>
            <div className="flex flex-wrap items-center gap-1">
              {loose.map((g) => <EdgeTip key={g.id} tip={g.lead.value} label={g.lead.value} className="block"><span className="grid h-6 w-6 place-items-center"><Mark fact={g.lead} size={markOf(g.lead) ? 20 : 17} /></span></EdgeTip>)}
            </div>
          </>
        )}
        <p className={sub}>Checked {when} · <button type="button" disabled={!!scan} onClick={onCheck} className={link}>Check again</button></p>
      </div>
    </section>
  )
}

// ---- Where we read it: one ring for every page we tried, in three parts, clockwise from 12 o'clock: pages a fact
// came from (dark graphite) · pages read with no facts (mid grey) · pages we couldn't read (red). Hover or focus a part:
// it thickens, the others dim and the centre says what it is. Beside the ring, the sections that gave facts as compact
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
function SiteRing({ size, counts, total, reading, shown, part, setPart, share, onRetry }) {
  const S = size, SW = 7.5
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
      <span className="pointer-events-none absolute grid place-items-center text-center" style={{ width: S - SW * 4 - 12 }}>
        <CrossFade k={reading ? 'reading' : cur?.id ?? 'all'} ms={130}>
          <span className="flex flex-col items-center">
            <b className="num text-[20px] leading-6 font-semibold tracking-[-0.01em] text-stone-900">{reading || !cur ? `${shown} of ${total}` : cur.n}</b>
            <span className="text-[12px] leading-4 text-stone-600">{reading ? 'reading' : cur ? cur.word : 'pages read'}</span>
            {!reading && cur?.id === 'bad' && <button type="button" onClick={onRetry} className={`pointer-events-auto mt-0.5 ${link} text-[12px] leading-4`}>Retry</button>}
          </span>
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
    <div tabIndex={0} role="group" aria-label={`${s.label}: ${plural(groups.length, 'fact')} from ${plural(s.pages.length, 'page')}`}
      onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) leave() }}
      style={{ animationDelay: `${150 + si * 90}ms`, animationFillMode: 'backwards' }}
      className={`wf-anim card-in relative flex min-w-0 flex-col gap-2 rounded-lg border bg-surface p-4 transition-[transform,box-shadow,border-color] duration-200 ${lit ? 'border-stone-600' : 'border-line'} ${active ? 'z-20 -translate-y-0.5 shadow-md' : ''} ${focus}`}>
      <b className="num text-[32px] leading-9 font-semibold tracking-[-0.02em] text-stone-900">{groups.length}</b>
      <p className="flex flex-wrap items-baseline gap-x-2"><span className={`text-[14px] leading-5 ${val}`}>{s.label}</span><span className={`num ${sub}`}>{plural(s.pages.length, 'page')}</span></p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {groups.slice(0, TILE_MARKS).map((g, i) => (
          <EdgeTip key={g.id} className="block" label={shortName(g.lead)} tip={<span className="flex flex-col gap-0.5"><span className={val}>{shortName(g.lead)}</span><span className="text-stone-600">{here(g)}</span></span>}>
            <span className="wf-anim wf-pop block" style={{ animationDelay: `${450 + si * 90 + i * 60}ms` }}><Mark fact={g.lead} size={20} /></span>
          </EdgeTip>
        ))}
        {more > 0 && <span className={`num ${sub}`}>+{more}</span>}
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
  // the ring is a little smaller than the section boxes beside it (nine tenths of their height), centred on them
  const boxes = useRef(null)
  const [size, setSize] = useState(124)
  useLayoutEffect(() => {
    const el = boxes.current
    if (!el) return undefined
    const fit = () => setSize(Math.max(92, Math.min(150, Math.round(el.getBoundingClientRect().height * 0.9))))
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    fit()
    return () => ro.disconnect()
  }, [hasRead])
  return (
    <section className={`${card} flex flex-col gap-6 p-5 lg:p-6`}>
      <div>
        <h2 className={h2}>Where we read it</h2>
        <p className={`num ${sub}`} aria-live="polite">
          {reading ? <>Reading {where(list[scan.read].url)}</> : scan ? 'Checking the sources' : hasRead ? <>Facts came from <b className={val}>{factPages}</b> pages</> : <>Up to <b className={val}>{list.length}</b> pages from your sitemap</>}
        </p>
      </div>
      <div className="flex flex-col items-center gap-8 min-[900px]:flex-row">
        <SiteRing key={`ring-${k}`} size={size} counts={scan ? {} : counts} total={list.length} reading={reading || !!scan} shown={shown} part={part} setPart={setPart} share={share} onRetry={onRetry} />
        {hasRead && (
          <div ref={boxes} key={`boxes-${k}`} className="grid w-full min-w-0 flex-1 grid-cols-2 items-stretch gap-3 min-[1100px]:grid-cols-4">
            {tiles.map(({ s, groups }, si) => <SectionBlock key={s.label} s={s} si={si} groups={groups} glow={part === 'facts'} onBox={setBox} />)}
          </div>
        )}
      </div>
      {hasRead && !scan && (none.length > 0 || bad.length > 0) && (
        <div className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 ${sub}`}>
          <p>{none.length > 0 && <>{none.join(', ')} · read, no facts</>}</p>
          {bad.length > 0 && <p>{plural(bad.length, 'page')} couldn’t be read · <button type="button" onClick={onRetry} className={link}>Retry</button></p>}
        </div>
      )}
    </section>
  )
}

// ---- Read, but not facts: one slim full-width row at the end of the page. Clicking it opens it in place, downward (it
// only lengthens the page): the texts as cards in a row, each with Use as a fact (it joins the fact sheet, waiting)
// and Reject (the card fades and the others close the gap, with Undo for a few seconds).
function NotFactCard({ f, i, onUse, onReject }) {
  const [out, setOut] = useState(false)
  const Icon = KIND_ICON[f.field] ?? StickyNote
  const site = siteEvidence(f)
  const small = `${secondary} h-8 px-2.5 text-[13px]`
  const reject = () => { if (reduced()) { onReject(f); return } setOut(true); setTimeout(() => onReject(f), 220) }
  return (
    <li className={`wf-anim card-in flex min-w-0 flex-1 basis-0 flex-col gap-1.5 rounded-lg border border-line bg-surface p-4 transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-0.5 hover:shadow-md ${out ? 'opacity-0' : ''}`} style={{ animationDelay: `${120 + i * 70}ms`, animationFillMode: 'backwards' }}>
      <span className={`flex items-center gap-2 ${sub}`}><Icon size={15} strokeWidth={1.75} aria-hidden />{KIND[f.field]}</span>
      <p className={`text-[15px] leading-[22px] ${val} [overflow-wrap:anywhere] [text-wrap:pretty]`}>“<span data-wf-from={f.id}>{f.value}</span>”</p>
      {site && <span className={sub}>{where(site.url)}</span>}
      <div className="mt-auto flex gap-2 pt-1.5">
        <button type="button" className={small} onClick={() => onUse(f)}>Use as a fact</button>
        <button type="button" className={small} onClick={reject}>Reject</button>
      </div>
    </li>
  )
}
function NotFacts({ items, gone, onUse, onReject, onUndo }) {
  const [open, setOpen] = useState(false)
  const [run, setRun] = useState(0) // each opening staggers the cards in again
  return (
    <section className={card}>
      <button type="button" aria-expanded={open} onClick={() => { setOpen((o) => !o); setRun((r) => r + 1) }} className={`flex w-full items-baseline gap-2 rounded-xl px-5 py-4 text-left ${focus}`}>
        <span className="text-[15px] leading-[22px] font-bold text-stone-900">Read, but not facts</span>
        <Count n={items.length} />
        <ChevronDown size={15} aria-hidden className={`ml-auto self-center text-stone-600 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {/* the height eases open; closed, what's inside can't be reached */}
      <div className="wf-anim grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }} inert={open ? undefined : ''}>
        <div className={`min-h-0 ${open ? '' : 'overflow-hidden'}`}>
          <div key={run} className="flex flex-col gap-3 px-5 pb-5">
            <p className={sub}>We read these but didn’t treat them as facts.</p>
            {items.length > 0 && <ul className="flex flex-col gap-3 sm:flex-row">{items.map((f, i) => <NotFactCard key={f.id} f={f} i={i} onUse={onUse} onReject={onReject} />)}</ul>}
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
