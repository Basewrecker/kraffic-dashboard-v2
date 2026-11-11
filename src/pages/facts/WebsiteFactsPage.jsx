// Optimize → Fact Check (was "Website facts"; "Proof first", owner 2026-11-11, round 4). What we read on the brand's
// site, which claims an outside source backs up, and the facts Content drafts may use. Design only: the app's data and
// its four actions (confirm, reject, add a fact, read the website again) on sample data (data/websiteFacts.js).
// Layout, as Sentiment: a hero card (how many facts are confirmed, by status; the sources we checked against; Read
// website again) → Where we read it → two columns (Your call, Ready to confirm | the fact sheet, Checked against
// outside sources) → Read, but not facts.
// Type: section titles 700, values 600 in ink, everything supporting 400 in stone-600. One helper line per section.
// Colour: graphite, with one solid-ink element per card at most (its primary button); --copper only where the site and
// a source disagree; --negative only for a page we couldn't read. No AI engine logos: engines don't read the site.
// Previews: ?wf=empty (never read) · ?wf=done (nothing left to review). "Read website again" plays the reading state.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Award, BadgeCheck, Building2, CalendarDays, Check, ChevronDown, Mail, MapPin, Phone, Plus, Quote, RefreshCw, Search, Star, StickyNote } from 'lucide-react'
import { brand } from '../../store/workspace'
import SiteLogo from '../../components/ui/SiteLogo'
import BetaTag from '../../components/ui/BetaTag'
import EdgeTip from '../../components/ui/EdgeTip'
import { GLIDE, useCountUp } from '../../components/ui/motion'
import { ADD_KINDS, GROUPS, KIND, READ_AT, bucketsOf, claimParts, diffOf, factsOnPage, groupOf, markOf, outsideEvidence, pageSections, pathOf, sampleFacts, samplePages, shortName, siteEvidence, sourceOf, verdictOf } from '../../data/websiteFacts'

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const READ_YEAR = new Date(READ_AT).getUTCFullYear()
const KIND_ICON = { brand_name: Building2, phone: Phone, email: Mail, address: MapPin, trustpilot_rating: Star, bbb_rating: Star, award: Award, years: CalendarDays, accreditation: BadgeCheck, claim: Quote, note: StickyNote, title: StickyNote, description: StickyNote, heading: StickyNote }
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
// [before, differing, after]: the differing part in copper, with one pulse
const Diff = ({ parts }) => <>{parts[0]}{parts[1] && <span className="wf-anim wf-diff">{parts[1]}</span>}{parts[2]}</>
const Sentence = ({ fact, className = '', quoted = false }) => {
  const [a, b, c] = claimParts(fact)
  return <p className={`font-normal text-stone-600 [text-wrap:pretty] ${className}`}>{quoted && '“'}{a}<b className={val}>{b}</b>{c}{quoted && '”'}</p>
}
// the small split ring that marks a "Your call" item
const SplitMark = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden className="shrink-0">
    <path d="M7 2a7 7 0 0 0 0 14M11 2a7 7 0 0 1 0 14" stroke="var(--copper)" strokeWidth="1.5" strokeLinecap="round" />
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
    { id: 'call', n: calls, word: calls === 1 ? 'needs your call' : 'need your call', look: 'border-[1.5px] border-[var(--copper)]' },
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

// ---- Your call: every decision has the same shape. A numbered header (the fact's name, "Doesn't match"), two equal
// cards side by side (who says it, the value, the quoted line), and the action at the foot of each card. Resolved, it
// collapses to one line with Undo.
function CallSide({ g, logo, label, value, quote, kept, dim, children }) {
  return (
    <div {...useHot(g.pages)} className={`flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg border p-4 transition-[border-color,opacity] duration-200 ${kept ? 'border-[var(--copper)]' : 'border-line'} ${dim ? 'opacity-40' : ''}`}>
      <span className={`flex items-center gap-2 ${sub}`}>{logo}<span className="min-w-0 truncate">{label}</span></span>
      <span className={`${big} [text-wrap:balance]`}>{value}</span>
      {quote}
      <div className="mt-auto flex min-h-9 items-center pt-2">{children}</div>
    </div>
  )
}
function SiteSide({ g, value, onKeep, picked }) {
  const site = siteEvidence(g.lead)
  const kept = picked === g.id
  return (
    <CallSide g={g} kept={kept} dim={!!picked && !kept} logo={<BrandLogo size="h-5 w-5 rounded" />} label={`Your site${site ? ` · ${where(site.url)}` : ''}`}
      value={<span data-wf-from={g.id}>{value ?? g.lead.value}</span>} quote={site && <Sentence fact={g.lead} quoted className="text-[13px] leading-[18px]" />}>
      <button type="button" disabled={!!picked} onClick={onKeep} className={`${secondary} ${kept ? 'disabled:opacity-100' : ''}`}>{kept && <Check size={15} aria-hidden />}{kept ? 'Kept' : 'Keep this one'}</button>
    </CallSide>
  )
}
const CallItem = ({ n, name, children, foot }) => (
  <div className="flex flex-col gap-3 p-5">
    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="num grid h-5 w-5 shrink-0 place-items-center rounded-full bg-tint text-[12px] font-semibold text-stone-900">{n}</span>
      <b className={`text-[15px] leading-[22px] ${val}`}>{name}</b>
      <span className="text-[13px] leading-[18px] font-semibold text-[var(--copper)]">Doesn’t match</span>
    </p>
    <div className="flex flex-col gap-3 sm:flex-row">{children}</div>
    {foot}
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
    <CallItem n={n} name={KIND[f.field]} foot={<button type="button" disabled={!!picked} onClick={() => onDrop(g)} className={`${link} self-start`}>Drop this fact</button>}>
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

// ---- Ready to confirm: one line per fact. Tick · logo or line icon · the value · its kind at the right. Hover or
// focus the value for the page(s) it came from. Three groups, split by hairlines: contact · awards, ratings and
// accreditations · site claims.
function ReadyLine({ g, on, sent, onToggle }) {
  const f = g.lead
  const value = <span className={`text-[14px] leading-6 ${val}`} data-wf-from={g.id}>{f.value}</span>
  return (
    <li {...useHot(g.pages)} className={`flex items-center gap-2.5 py-1 transition-opacity duration-200 ${sent ? 'opacity-30' : on ? '' : 'opacity-50'}`}>
      <Tick on={on} onChange={onToggle} disabled={sent} label={`Confirm “${f.value}”`} />
      <Mark fact={f} size={20} />
      {g.pages.length
        ? <EdgeTip className="block min-w-0 truncate" tip={<span className="flex flex-col gap-1"><span className={val}>Found on</span>{g.pages.map((u) => <span key={u}>{where(u)}</span>)}</span>}>{value}</EdgeTip>
        : <span className="min-w-0 truncate">{value}</span>}
      <span className={`ml-auto shrink-0 ${sub}`}>{KIND[f.field]}</span>
    </li>
  )
}
function ReadyList({ rows, skipped, sent, onToggle }) {
  const kindOf = (g) => (groupOf(g.lead) === 'contact' ? 0 : ['ratings', 'awards', 'accreditations'].includes(groupOf(g.lead)) ? 1 : 2)
  const groups = [0, 1, 2].map((k) => rows.filter((g) => kindOf(g) === k)).filter((list) => list.length)
  return (
    <div className="flex flex-col divide-y divide-[var(--div)]">
      {groups.map((list) => (
        <ul key={list[0].id} className="py-2 first:pt-0 last:pb-0">
          {list.map((g) => <ReadyLine key={g.id} g={g} on={!skipped.has(g.id)} sent={sent.has(g.id)} onToggle={() => onToggle(g)} />)}
        </ul>
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
// the fact sheet's last slot: "+ Add a fact" (the page's only dashed border), opening to the kind picker and a field
function AddSlot({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('note')
  const [value, setValue] = useState('')
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`flex h-9 w-full items-center gap-1.5 rounded-md border border-dashed border-[var(--dashed-border)] px-2.5 text-[14px] font-semibold text-stone-600 transition-colors duration-150 hover:border-stone-600 hover:text-stone-900 ${focus}`}>
        <Plus size={15} aria-hidden />Add a fact
      </button>
    )
  }
  const submit = (e) => { e.preventDefault(); if (!value.trim()) return; onAdd(kind, value.trim()); setValue(''); setOpen(false) }
  return (
    <form onSubmit={submit} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)} className="wf-anim card-in flex flex-col gap-2 rounded-lg border border-line p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="sm:w-36"><KindPicker value={kind} onChange={setKind} /></div>
        <input id="wf-add-value" autoFocus value={value} onChange={(e) => setValue(e.target.value)} aria-label="The fact" placeholder="e.g. Free returns within 30 days"
          className={`h-9 min-w-0 flex-1 rounded-lg border border-line bg-raised px-3 text-[14px] text-stone-900 placeholder:text-stone-600 hover:border-[var(--color-line-strong)] ${focus}`} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={!value.trim()} className={primary}>Add fact</button>
        <button type="button" className={secondary} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  )
}

// ---- the fact sheet: what Content drafts may use, by kind. Every row: its logo or a line icon, the value in the
// primary colour, and at the right a tick (confirmed, 600), "To confirm" (waiting, 400) or "Your call" (copper).
const sheetRow = 'flex items-start gap-2 rounded-md px-1.5 py-[3px] -mx-1.5 text-[14px] leading-5 text-stone-900 transition-colors duration-150'
const isLit = (hot, g) => !!hot && g.pages.some((u) => hot.urls.has(u))
const Lead = ({ children }) => <span className="grid h-5 w-4 shrink-0 place-items-center">{children}</span>
const toConfirm = <span className={`shrink-0 pl-2 ${sub} leading-5`}>To confirm</span>
const yourCall = <span className="shrink-0 pl-2 text-[13px] leading-5 font-semibold text-[var(--copper)]">Your call</span>
function SheetRow({ g, landing, state }) {
  const { hot } = useContext(Hot)
  const kept = state === 'kept'
  return (
    <p {...useHot(g.pages)} data-wf-slot={kept ? g.id : undefined} className={`${sheetRow} ${kept ? 'font-semibold' : 'font-normal'} ${isLit(hot, g) ? 'bg-tint' : ''}`}>
      <Lead><Mark fact={g.lead} size={16} /></Lead>
      <span className={`min-w-0 flex-1 [overflow-wrap:anywhere] transition-opacity duration-200 ${landing.has(g.id) ? 'opacity-0' : ''}`}>
        {g.lead.value}{g.lead.status === 'ADDED_BY_YOU' && <span className="font-normal text-stone-600"> · added by you</span>}
      </span>
      {kept ? <Lead><Check size={14} aria-label="Confirmed" className="text-stone-600" /></Lead> : state === 'call' ? yourCall : toConfirm}
    </p>
  )
}
function FactSheet({ b, landing, onAdd }) {
  const callIds = new Set(b.differs.map((g) => g.id))
  const waiting = [...b.ready, ...b.differs]
  const groups = GROUPS.map((grp) => ({
    ...grp,
    kept: b.kept.filter((g) => groupOf(g.lead) === grp.id),
    open: waiting.filter((g) => groupOf(g.lead) === grp.id),
    picks: b.conflicts.filter((c) => groupOf(c.a.lead) === grp.id),
  })).filter((grp) => grp.kept.length || grp.open.length || grp.picks.length)
  return (
    <aside aria-label="Your fact sheet" className={`${card} flex flex-col gap-3 p-5`}>
      <header className="flex items-center gap-3">
        <BrandLogo size="h-9 w-9 rounded-lg" />
        <div className="min-w-0">
          <h2 className={h2}>{brand.name}’s fact sheet</h2>
          <p className={sub}>What Content drafts may use</p>
        </div>
      </header>
      <div className="flex flex-col">
        {groups.map((grp) => (
          <section key={grp.id} className="flex min-w-0 flex-col border-t border-[var(--div)] py-2.5">
            <h3 className="pb-1 text-[13px] leading-[18px] font-semibold text-stone-600">{grp.label}</h3>
            {grp.kept.map((g) => <SheetRow key={g.id} g={g} landing={landing} state="kept" />)}
            {grp.open.map((g) => <SheetRow key={g.id} g={g} landing={landing} state={callIds.has(g.id) ? 'call' : 'wait'} />)}
            {/* a contradiction: both candidate values on one row */}
            {grp.picks.map((c) => (
              <p key={c.a.id} className={`${sheetRow} font-normal`}>
                <Lead><Mark fact={c.a.lead} size={16} /></Lead>
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{c.a.lead.value} <span className="text-stone-600">/</span> {c.b.lead.value}</span>
                {yourCall}
              </p>
            ))}
          </section>
        ))}
      </div>
      <AddSlot onAdd={onAdd} />
    </aside>
  )
}

// ---- Checked against outside sources: one compact card, a row per source. Logo · name and kind · the value · the
// result in plain words · the source's link. A mismatch shows both values. Click a row for where it is on the site.
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
  const result = checking ? 'Checking…' : v === 'agrees' ? `Same on ${src.name}` : v === 'differs' ? 'Doesn’t match' : `Couldn’t find this on ${src.name}`
  const value = v === 'differs' && diff ? <span className="font-normal text-stone-600"><Tok parts={diff.tokens.site} /> on your site · <Tok parts={diff.tokens.source} /> on {src.name}</span>
    : ['trustpilot_rating', 'bbb_rating'].includes(f.field) && out && v === 'agrees' ? out.snippet : claimParts(f)[1]
  return (
    <li {...useHot(g.pages)} className={`transition-opacity duration-200 ${waiting ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3 py-3">
        <SourceLogo src={src} />
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`min-w-0 flex-1 rounded text-left ${focus}`}>
          <span className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className={sub}><b className={`text-[14px] ${val}`}>{src.name}</b> · {KIND_SHORT[f.field] ?? KIND[f.field].toLowerCase()}</span>
            <span className={!checking && v === 'differs' ? 'text-[13px] leading-[18px] font-semibold text-[var(--copper)]' : sub}>{result}</span>
          </span>
          <span className={`mt-0.5 block text-[15px] leading-[22px] ${val} [overflow-wrap:anywhere]`}>{value}</span>
        </button>
        {out
          ? <a href={out.url} target="_blank" rel="noreferrer" aria-label={`Open ${src.name}`} className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-stone-600 transition-colors duration-150 hover:bg-tint hover:text-stone-900 ${focus}`}><ArrowUpRight size={15} aria-hidden /></a>
          : <span className="w-7 shrink-0" />}
      </div>
      {open && (
        <div className="wf-anim card-in flex flex-col gap-1 pb-3 pl-10 pr-10">
          {site && <PageLink url={site.url} />}
          <Sentence fact={f} quoted className="text-[13px] leading-[18px]" />
          {more > 0 && <p className={sub}>and {plural(more, 'page')} more: {g.pages.slice(1).map(where).join(', ')}</p>}
        </div>
      )}
    </li>
  )
}
const SourcesCard = ({ cards, scan, className = '' }) => (
  <section className={`${card} p-5 ${className}`}>
    <h2 className={h2}>Checked against outside sources <Count n={cards.length} /></h2>
    <ul className="mt-1 divide-y divide-[var(--div)]">
      {cards.map((g, i) => <SourceRow key={g.id} g={g} checking={scan?.checking === i} waiting={scan?.read != null || scan?.checking < i} />)}
    </ul>
  </section>
)

// ---- Where we read it: a headline, one tile per site section that gave facts, the rest in one line ------------------
// A page segment: filled = a fact came from it, outline = read, red outline = couldn't be read. Hover: the page's card.
function Segment({ p, found, todo, now, lit, delay, run }) {
  const look = todo ? 'bg-[var(--data-track)]'
    : now ? 'wf-anim wf-pulse bg-stone-600'
      : !p.ok ? 'border-[1.5px] border-negative'
        : found.length ? 'bg-stone-300' : 'border-[1.5px] border-stone-300'
  const bar = (
    <span className={`relative block h-2 w-full rounded-[2px] transition-shadow duration-150 ${look} ${lit ? 'shadow-[0_0_0_2px_var(--color-surface),0_0_0_3.5px_var(--color-stone-600)]' : ''}`}>
      {!todo && !now && p.ok && found.length > 0 && <span key={run} className="wf-anim wf-seg absolute inset-0 rounded-[2px] bg-stone-600" style={{ animationDelay: `${delay}ms` }} />}
    </span>
  )
  if (todo) return <span className="block min-w-0 flex-1 py-1">{bar}</span>
  return (
    <EdgeTip className="block min-w-0 flex-1 py-1" label={`${p.title ?? pathOf(p.url)}: ${p.ok ? plural(found.length, 'fact') : 'could not be read'}`}
      tip={(
        <span className="flex flex-col gap-1">
          <span className={val}>{p.title ?? 'Couldn’t be read'}</span>
          <span className="text-stone-600">{brand.domain}{pathOf(p.url) === '/' ? '' : pathOf(p.url)}</span>
          {!p.ok ? <span className="text-negative">{p.error}</span>
            : found.length ? <>{found.map((f) => <span key={f.id} className="text-stone-900">· {f.value}</span>)}</>
              : <span className="text-stone-600">No facts found here</span>}
        </span>
      )}>
      {bar}
    </EdgeTip>
  )
}
const TILE_ROWS = 3
const FactName = ({ g, i = 0, run }) => (
  <span key={run} className={`flex items-center gap-2 text-[13px] leading-5 ${val} ${run ? 'wf-anim wf-chip' : ''}`} style={{ animationDelay: `${i * 40}ms` }}>
    <Mark fact={g.lead} size={18} /><span className="min-w-0 truncate">{shortName(g.lead)}</span>
  </span>
)
function SectionTile({ s, si, groups, facts, scan, index }) {
  const { hot, setHot } = useContext(Hot)
  const [active, setActive] = useState(false)
  const [run, setRun] = useState(0) // each hover replays the segments' fill and the facts' entrance
  const reading = scan?.read != null
  const more = groups.length - TILE_ROWS
  const enter = () => { if (active) return; setActive(true); setRun((r) => r + 1); setHot({ urls: new Set(s.pages.map((p) => p.url)), src: 'tile' }) }
  const leave = () => { setActive(false); setHot(null) }
  return (
    <div tabIndex={0} role="group" aria-label={`${s.label}: ${plural(groups.length, 'fact')} from ${plural(s.pages.length, 'page')}`}
      onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) leave() }}
      className={`relative flex h-full flex-col gap-2.5 rounded-lg border border-line bg-surface p-4 transition-[transform,box-shadow] duration-200 ${active ? 'z-20 -translate-y-0.5 shadow-md' : ''} ${focus}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-[14px] leading-5 ${val}`}>{s.label}</span>
        <span className={`num ${sub}`}>{plural(s.pages.length, 'page')}</span>
      </div>
      <p className="flex items-baseline gap-1.5"><b className="num text-[32px] leading-9 font-semibold tracking-[-0.02em] text-stone-900">{groups.length}</b><span className={sub}>{groups.length === 1 ? 'fact' : 'facts'}</span></p>
      <div className="flex gap-[3px]">
        {s.pages.map((p, j) => {
          const i = index.get(p.id)
          return <Segment key={p.id} p={p} found={factsOnPage(facts, p.url)} todo={reading && i > scan.read} now={reading && i === scan.read} lit={hot?.src === 'fact' && hot.urls.has(p.url)} run={run} delay={(run ? 0 : 300 + si * 160) + j * 45} />
        })}
      </div>
      {/* the facts found here, by name (3 at most; hover opens the rest over what's below) */}
      <div className="relative flex flex-col gap-1 pt-1">
        {groups.slice(0, TILE_ROWS).map((g, i) => <FactName key={g.id} g={g} i={i} run={active && more <= 0 ? run : 0} />)}
        {more > 0 && <span className={sub}>+{more} more</span>}
        {active && more > 0 && (
          <div className="absolute -inset-x-[17px] -top-0.5 z-20 flex flex-col gap-1 rounded-b-lg border border-t-0 border-line bg-surface px-4 pb-4 pt-1.5 shadow-md">
            {groups.map((g, i) => <FactName key={g.id} g={g} i={i} run={run} />)}
          </div>
        )}
      </div>
    </div>
  )
}
function PagesRead({ list, facts, merged, scan, hasRead, onRetry, k }) {
  const sections = useMemo(() => pageSections(list), [list])
  const index = useMemo(() => new Map(list.map((p, i) => [p.id, i])), [list])
  const okPages = list.filter((p) => p.ok).length
  const factPages = list.filter((p) => factsOnPage(facts, p.url).length).length
  const counted = useCountUp(hasRead ? okPages : 0, 700, 0)
  const countedFacts = useCountUp(hasRead ? factPages : 0, 700, 0)
  const reading = scan?.read != null
  const withFacts = sections.map((s) => {
    const urls = new Set(s.pages.map((p) => p.url))
    return { s, groups: merged.filter((g) => g.lead.status !== 'REJECTED' && g.pages.some((u) => urls.has(u))) }
  })
  const tiles = withFacts.filter((x) => x.groups.length)
  const none = withFacts.filter((x) => !x.groups.length).map((x) => x.s.label)
  const failed = list.length - okPages
  return (
    <section className={`${card} flex flex-col gap-4 p-5 lg:p-6`}>
      <h2 className={h2}>Where we read it</h2>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <b className="num text-kpi text-stone-900">{reading ? scan.read + 1 : counted} of {list.length}</b>
        <span className="text-[15px] leading-[22px] text-stone-600">{reading ? `reading ${where(list[scan.read].url)}` : hasRead ? 'pages read' : 'pages from your sitemap, at most'}</span>
        {hasRead && !scan && <span className="text-[15px] leading-[22px] text-stone-600">Facts came from <b className={`num ${val}`}>{countedFacts}</b></span>}
        {scan?.checking != null && <span className="text-[15px] leading-[22px] text-stone-600">checking the sources</span>}
      </p>
      {hasRead ? (
        <div key={k} className="grid grid-cols-1 items-stretch gap-3 sm:max-[1099px]:grid-cols-2 min-[1100px]:grid-cols-4">
          {tiles.map(({ s, groups }, si) => <SectionTile key={s.label} s={s} si={si} groups={groups} facts={facts} scan={scan} index={index} />)}
        </div>
      ) : (
        // never read: every page as one segment, filling as the site is read
        <div className="flex gap-[3px]">{list.map((p, i) => <span key={p.id} className={`h-2 min-w-0 flex-1 rounded-[2px] ${reading && i < scan.read ? 'bg-stone-600' : reading && i === scan.read ? 'wf-anim wf-pulse bg-stone-600' : scan?.checking != null ? 'bg-stone-600' : 'bg-[var(--data-track)]'}`} />)}</div>
      )}
      {hasRead && !scan && (none.length > 0 || failed > 0) && (
        <div className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 ${sub}`}>
          <p>{none.length > 0 && <>{none.join(', ')} · read, no facts</>}</p>
          {failed > 0 && <p>{plural(failed, 'page')} couldn’t be read · <button type="button" onClick={onRetry} className={link}>Retry</button></p>}
        </div>
      )}
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
// a slim one-line card: "8 confirmed · Undo", "Nothing needs you."
const Slim = ({ children }) => (
  <div className={`${card} wf-anim card-in flex items-center gap-2.5 px-5 py-3 text-[14px] leading-5 text-stone-600`}>
    <Check size={16} aria-hidden className="shrink-0 text-stone-700" /><span>{children}</span>
  </div>
)

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
  const [batch, setBatch] = useState(null) // a Confirm in flight: { rows, sent: Set, closing }
  const [undo, setUndo] = useState(null) // the last Confirm: { ids, n }
  const [resolved, setResolved] = useState([]) // calls already made: { key, name, result, ids, pos }
  const [hot, setHot] = useState(null)
  const hotCtx = useMemo(() => ({ hot, setHot }), [hot])
  const b = useMemo(() => bucketsOf(facts, READ_YEAR), [facts])
  const calls = b.conflicts.length + b.differs.length
  const ticked = b.ready.filter((g) => !skipped.has(g.id))

  const setStatus = (ids, status) => setFacts((fs) => fs.map((f) => (ids.includes(f.id) ? { ...f, status } : f)))
  // "Into the sheet": the value leaves its row and lands in its slot in the fact sheet
  const flyToSheet = (g) => {
    const r0 = document.querySelector(`[data-wf-from="${g.id}"]`)?.getBoundingClientRect()
    if (!r0 || reduced()) { setStatus(g.ids, 'CONFIRMED'); return }
    setLanding((s) => new Set(s).add(g.id))
    setStatus(g.ids, 'CONFIRMED')
    const land = () => setLanding((s) => { const n = new Set(s); n.delete(g.id); return n })
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const r1 = document.querySelector(`[data-wf-slot="${g.id}"]`)?.getBoundingClientRect()
      if (!r1) { land(); return }
      const ghost = document.createElement('div')
      ghost.className = 'wf-ghost'
      ghost.textContent = g.lead.value
      Object.assign(ghost.style, { left: `${r0.left}px`, top: `${r0.top}px`, maxWidth: `${Math.max(r0.width + 18, 220)}px` })
      document.body.appendChild(ghost)
      const end = `translate(${r1.left - r0.left + 30}px, ${r1.top - r0.top + 4}px)`
      const a = ghost.animate([{ transform: 'none', opacity: 1 }, { transform: end, opacity: 1, offset: 0.85 }, { transform: end, opacity: 0 }], { duration: 560, easing: GLIDE })
      a.onfinish = a.oncancel = () => { ghost.remove(); land() }
    }))
  }
  // Confirm: the ticked values go into the sheet one after another; when every row went, the card closes to one slim row
  const confirmTicked = () => {
    const go = ticked
    const done = { ids: go.flatMap((g) => g.ids), n: go.length }
    if (!go.length) return
    if (reduced()) { setStatus(done.ids, 'CONFIRMED'); setUndo(done); return }
    const all = go.length === b.ready.length
    setBatch({ rows: b.ready, sent: new Set(), closing: false })
    go.forEach((g, i) => setTimeout(() => { flyToSheet(g); setBatch((bt) => bt && { ...bt, sent: new Set(bt.sent).add(g.id) }) }, i * 130))
    const end = go.length * 130 + 620
    if (all) setTimeout(() => setBatch((bt) => bt && { ...bt, closing: true }), end)
    setTimeout(() => { setBatch(null); setUndo(done) }, end + (all ? 340 : 0))
  }
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
    setTimeout(() => { flyToSheet(keep); setStatus(drop.ids, 'REJECTED'); setPicked(null); finish() }, 600)
  }
  const keepSite = (g) => {
    const finish = () => settle(`d:${g.id}`, KIND[g.lead.field], g.lead.value, g.ids)
    if (reduced()) { setStatus(g.ids, 'CONFIRMED'); finish(); return }
    setPicked(g.id)
    setTimeout(() => { flyToSheet(g); setPicked(null); finish() }, 600)
  }
  const dropFact = (g) => { settle(`d:${g.id}`, KIND[g.lead.field], 'dropped', g.ids); setStatus(g.ids, 'REJECTED') }
  const add = (field, value) => {
    const kind = ADD_KINDS.flatMap((g) => g.items).find((it) => it.field === field)
    setFacts((fs) => [...fs, { id: `you${fs.length + 1}`, category: kind?.category ?? 'custom', field, value, status: 'ADDED_BY_YOU', source: 'YOU', notes: null, evidence: [] }])
  }

  // "Read website again": the segments fill page by page, section by section, then each source is checked in turn
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
  const done = !calls && !rows.length // nothing needs the user
  const undoLine = undo && !batch && <><b className={`num ${val}`}>{undo.n} confirmed</b> · <button type="button" onClick={undoConfirm} className={link}>Undo</button></>
  let n = 0
  return (
    <Hot.Provider value={hotCtx}>
      {hero}
      {pagesRead}

      {/* two columns: what needs the user | the fact sheet and the sources. Each column's last card grows to the other
          column's height, so the two end on the same line; the fact sheet and Your call keep their natural height. */}
      <div className="grid grid-cols-1 items-stretch gap-3 md:gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3 md:gap-4">
          {!done && callItems.length > 0 && (
            <section className={`${card} ${rows.length || undoLine ? '' : 'flex-1'}`}>
              <h2 className={`${h2} px-5 pt-5`}>Your call <Count n={calls} /></h2>
              <div className="divide-y divide-[var(--div)]">
                {callItems.map((it) => (it.r ? <ResolvedLine key={it.key} r={it.r} onUndo={undoCall} />
                  : it.c ? <ConflictItem key={it.key} c={it.c} n={n += 1} onPick={pickOne} picked={picked} />
                    : <DiffersItem key={it.key} g={it.g} n={n += 1} onKeep={keepSite} onDrop={dropFact} picked={picked} />))}
              </div>
            </section>
          )}
          {done ? (
            <section className={`${card} wf-anim card-in flex flex-1 flex-col items-center justify-center gap-2 p-5 text-center`}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-tint text-stone-700"><Check size={20} aria-hidden /></span>
              <h2 className={h2}>Nothing needs you</h2>
              <p className={sub}>Every fact in the sheet can be used in your drafts.</p>
              {settled.map((r) => <p key={r.key} className={sub}><b className={val}>{r.name}</b> · {r.result} · <button type="button" onClick={() => undoCall(r)} className={link}>Undo</button></p>)}
              {undoLine && <p className={sub}>{undoLine}</p>}
            </section>
          ) : undoLine && (rows.length ? <Slim>{undoLine}</Slim> : (
            // everything ticked was confirmed and calls are still open: this card takes the rest of the column
            <section className={`${card} wf-anim card-in flex flex-1 flex-col items-center justify-center gap-2 p-5 text-center`}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-tint text-stone-700"><Check size={20} aria-hidden /></span>
              <h2 className={`num ${h2}`}>{undo.n} confirmed</h2>
              <p className={sub}>They’re in the fact sheet. <button type="button" onClick={undoConfirm} className={link}>Undo</button></p>
            </section>
          ))}
          {rows.length > 0 && (
            // closes by height when every row was confirmed
            <div className="grid flex-1 transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: batch?.closing ? '0fr' : '1fr' }}>
              <section className={`${card} flex min-h-0 flex-col gap-3 p-5 transition-opacity duration-300 ${batch?.closing ? 'overflow-hidden opacity-0' : ''}`}>
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
              </section>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-3 md:gap-4">
          <FactSheet b={b} landing={landing} onAdd={add} />
          {b.cards.length > 0 && <SourcesCard cards={b.cards} scan={scan} className="flex-1" />}
        </div>
      </div>

      {b.notFacts.length > 0 && (
        <Fold title="Read, but not facts" count={b.notFacts.length}>
          <ul className="py-2">
            {b.notFacts.map((f) => (
              <li key={f.id} className="flex items-center gap-4 px-5 py-2">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[14px] leading-5 ${val}`}><span data-wf-from={f.id}>{f.value}</span></p>
                  <p className={sub}>{KIND[f.field]} · home page</p>
                </div>
                <button type="button" className={link} onClick={() => flyToSheet({ id: f.id, ids: [f.id], lead: f, pages: [] })}>Use as a fact</button>
                <button type="button" className={link} onClick={() => setStatus([f.id], 'REJECTED')}>Reject</button>
              </li>
            ))}
          </ul>
        </Fold>
      )}
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
