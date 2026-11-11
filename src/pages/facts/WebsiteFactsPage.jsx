// Optimize → Website facts ("Proof first", owner 2026-11-11; round 2 the same day). What we read on the brand's site,
// which claims an outside source backs up, and the facts Content drafts may use. Design only: the app's data and its
// four actions (confirm, reject, add a fact, read the website again) on sample data (data/websiteFacts.js).
// Order: the claims a source could check (the hero) → Your call (only what needs a person) → Ready to confirm (ticked
// rows, one button) with the fact sheet beside them → the pages we read → text that isn't a fact, Rejected.
// Type, as Sentiment: titles 600 with a muted count, values 600 in ink, supporting lines 400 in stone-600 (nothing lighter).
// Colour: graphite; --copper only where the site and a source disagree; --negative only for a page we couldn't read.
// No AI engine icons: this feature's data has no link to an engine.
// Previews: ?wf=empty (never read) · ?wf=done (nothing left to review). "Read website again" plays the reading state.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Award, BadgeCheck, Building2, CalendarDays, Check, ChevronDown, Layers, Mail, MapPin, Phone, Plus, Quote, RefreshCw, Search, Star, StickyNote, X } from 'lucide-react'
import { brand } from '../../store/workspace'
import SiteLogo from '../../components/ui/SiteLogo'
import BetaTag from '../../components/ui/BetaTag'
import EdgeTip from '../../components/ui/EdgeTip'
import Checkbox from '../../components/ui/Checkbox'
import { GLIDE } from '../../components/ui/motion'
import { ADD_KINDS, GROUPS, KIND, READ_AT, VERDICT_WORD, bucketsOf, claimParts, diffOf, factsOnPage, groupOf, outsideEvidence, pageSections, pathOf, sampleFacts, samplePages, siteEvidence, sourceOf, verdictOf } from '../../data/websiteFacts'

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const READ_YEAR = new Date(READ_AT).getUTCFullYear()
const KIND_ICON = { brand_name: Building2, phone: Phone, email: Mail, address: MapPin, trustpilot_rating: Star, bbb_rating: Star, award: Award, years: CalendarDays, accreditation: BadgeCheck, claim: Quote, note: StickyNote, title: StickyNote, description: StickyNote, heading: StickyNote }
const focus = 'outline-none focus-visible:ring-2 focus-visible:ring-focus'
const btn = `inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 text-[14px] font-medium transition-colors duration-150 disabled:opacity-50 ${focus}`
const primary = `${btn} bg-ink text-on-ink hover:bg-ink-hover`
const secondary = `${btn} border border-line bg-surface text-stone-900 hover:border-[var(--color-line-strong)]`
const quiet = `rounded text-[13px] leading-[18px] font-medium text-stone-600 hover:text-stone-900 ${focus}`
const card = 'rounded-xl border border-line bg-surface'
const h2 = 'text-[18px] leading-[26px] font-semibold text-stone-900' // section titles 18/600 (as Sentiment)
const sub = 'text-[13px] leading-[18px] text-stone-600' // supporting lines: 400, secondary
const val = 'font-semibold text-stone-900' // values: 600, primary
const Count = ({ n }) => <span className="num text-[14px] leading-5 font-normal text-stone-600">{n}</span>
const where = (url) => (pathOf(url) === '/' ? 'home page' : pathOf(url))
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// Hovering (or focusing) a fact anywhere lights the dots of the pages it came from, in "Where we read it"
const Hot = createContext({ hot: null, setHot: () => {} })
const useHot = (urls) => {
  const { setHot } = useContext(Hot)
  const on = () => setHot(urls?.length ? new Set(urls) : null)
  const off = () => setHot(null)
  return { onMouseEnter: on, onMouseLeave: off, onFocus: on, onBlur: off }
}

// a source's real logo, on a white plate so a dark mark still reads in the dark theme
const SourceLogo = ({ src, size = 'h-7 w-7 rounded-md' }) => <span className={`grid shrink-0 place-items-center overflow-hidden bg-[var(--logo-plate)] ${size}`}><SiteLogo domain={src.domain} name={src.name} className="h-full w-full" /></span>
const PageLink = ({ url, pre = 'On your site' }) => (
  <a href={url} target="_blank" rel="noreferrer" className={`${sub} w-fit rounded hover:text-stone-900 ${focus}`}>{pre} · {where(url)}</a>
)
// [before, differing, after]: the differing part in copper, with one pulse
const Diff = ({ parts }) => <>{parts[0]}{parts[1] && <span className="wf-anim wf-diff">{parts[1]}</span>}{parts[2]}</>
const Sentence = ({ fact, className = '', diff = null }) => {
  const [a, b, c] = claimParts(fact)
  return <p className={`text-stone-600 [text-wrap:pretty] ${className}`}>{a}<b className={val}>{diff ? <Diff parts={diff.site} /> : b}</b>{c}</p>
}
// the small split ring that marks a "Your call" item
const SplitMark = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden className="shrink-0">
    <path d="M7 2a7 7 0 0 0 0 14M11 2a7 7 0 0 1 0 14" stroke="var(--copper)" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

// ---- 1 · the hero: one card per claim that names an outside source ---------------------------------------------------
// The token on the divider: "=" agrees · "≠" differs (copper) · "?" not checked; a turning ring while it's being checked.
function Token({ verdict, checking }) {
  const draw = (delay) => ({ pathLength: 1, className: 'wf-anim wf-draw', style: { animationDelay: `${delay}ms` } })
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full border border-line bg-surface" role="img" aria-label={checking ? 'Checking' : VERDICT_WORD[verdict]}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
        {checking ? <circle cx="8" cy="8" r="5.5" stroke="var(--color-stone-600)" strokeDasharray="9 26" className="wf-anim wf-spin" />
          : verdict === 'agrees' ? <g stroke="var(--ink)"><path d="M3.5 5.75h9" {...draw(450)} /><path d="M3.5 10.25h9" {...draw(600)} /></g>
            : verdict === 'differs' ? <g stroke="var(--copper)"><path d="M3.5 5.75h9" {...draw(450)} /><path d="M3.5 10.25h9" {...draw(600)} /><path d="M10.5 2.5l-5 11" {...draw(800)} /></g>
              : <g stroke="var(--color-stone-600)"><path d="M5.75 6a2.25 2.25 0 1 1 3.4 1.93c-.7.42-1.15.9-1.15 1.82" {...draw(450)} /><path d="M8 12.6v.01" {...draw(700)} /></g>}
      </svg>
    </span>
  )
}
function SourceCard({ g, checking, waiting, k }) {
  const f = g.lead
  const src = sourceOf(f)
  const v = verdictOf(f)
  const out = outsideEvidence(f)
  const site = siteEvidence(f)
  const diff = diffOf(f)
  const more = g.pages.length - 1
  const then = f.status === 'CONFIRMED' ? 'in your fact sheet' : v === 'differs' ? 'needs your call' : 'ready to confirm'
  return (
    <article {...useHot(g.pages)} className={`${card} flex flex-col gap-4 p-5 transition-opacity duration-200 lg:p-6 ${waiting ? 'opacity-50' : ''}`}>
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <SourceLogo src={src} />
        <span className="text-[15px] leading-[22px] font-semibold text-stone-900">{src.name}</span>
        <span className={sub}>{KIND[f.field]}</span>
        <span className={`ml-auto ${sub}`}>
          {checking ? 'Checking…' : <><b className={`font-semibold ${v === 'differs' ? 'text-[var(--copper)]' : 'text-stone-900'}`}>{VERDICT_WORD[v]}</b> · {then}</>}
        </span>
      </header>
      <div key={k} className="grid grid-cols-1 items-start gap-x-5 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="wf-anim wf-settle flex min-w-0 flex-col gap-1.5">
          {site && <PageLink url={site.url} />}
          <Sentence fact={f} diff={diff} className="text-[15px] leading-[22px]" />
          {more > 0 && (
            <EdgeTip className="w-fit" tip={<span className="flex flex-col gap-1"><span className={val}>The same claim, found on</span>{g.pages.map((u) => <span key={u}>{where(u)}</span>)}</span>}>
              <span className={`inline-flex items-center gap-1 ${sub}`}><Layers size={13} aria-hidden />and {plural(more, 'page')} more</span>
            </EdgeTip>
          )}
        </div>
        {/* a thin divider with the token on it (a row with a rule either side on phones) */}
        <div className="relative flex items-center justify-center gap-3 sm:w-7 sm:self-stretch">
          <span aria-hidden className="h-px flex-1 bg-line sm:absolute sm:inset-y-0 sm:left-1/2 sm:h-auto sm:w-px sm:flex-none" />
          <span className="relative sm:mt-5"><Token verdict={v} checking={checking} /></span>
          <span aria-hidden className="h-px flex-1 bg-line sm:hidden" />
        </div>
        <div className="wf-anim wf-settle flex min-w-0 flex-col gap-1.5" style={{ animationDelay: '120ms' }}>
          <span className={sub}>On {src.name}</span>
          {out
            ? <p className="text-[20px] leading-[26px] font-semibold tracking-[-0.01em] text-stone-900 [text-wrap:balance]">{diff ? <Diff parts={diff.source} /> : out.snippet}</p>
            : <p className="text-[15px] leading-[22px] text-stone-600 [text-wrap:pretty]">We couldn’t open a page that confirms this.</p>}
          {out && <a href={out.url} target="_blank" rel="noreferrer" className={`inline-flex w-fit items-center gap-0.5 ${sub} rounded hover:text-stone-900 ${focus}`}>Open the source<ArrowUpRight size={13} aria-hidden /></a>}
        </div>
      </div>
    </article>
  )
}

// ---- 2 · Your call --------------------------------------------------------------------------------------------------
function ConflictOption({ g, other, onPick, struck }) {
  const site = siteEvidence(g.lead)
  const lost = struck === g.id
  return (
    <button type="button" disabled={!!struck} onClick={() => onPick(g, other)} {...useHot(g.pages)}
      className={`group relative flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-line bg-surface p-4 text-left transition-[border-color,opacity] duration-200 hover:border-ink ${lost ? 'opacity-50' : ''} ${focus}`}>
      <span className="relative w-fit text-[18px] leading-[26px] font-semibold tracking-[-0.01em] text-stone-900" data-wf-from={g.id}>
        {g.lead.value}
        {lost && <span aria-hidden className="wf-anim wf-strike absolute inset-x-0 top-1/2 h-[1.5px] bg-ink" />}
      </span>
      {site && <Sentence fact={g.lead} className="text-[13px] leading-[18px]" />}
      {site && <span className={sub}>{where(site.url)}</span>}
      <span className="mt-1 text-[13px] leading-[18px] font-medium text-stone-600 transition-colors duration-150 group-hover:text-stone-900 group-focus-visible:text-stone-900">Keep this one</span>
    </button>
  )
}
const ConflictCard = ({ c, onPick, struck }) => (
  <div className="flex flex-col gap-3 p-5">
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5"><SplitMark /></span>
      <div className="min-w-0">
        <p className="text-[15px] leading-[22px] text-stone-600"><b className={val}>These two can’t both be true.</b> {c.why}</p>
        <p className={sub}>Pick the one to keep. The other is rejected.</p>
      </div>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row"><ConflictOption g={c.a} other={c.b} onPick={onPick} struck={struck} /><ConflictOption g={c.b} other={c.a} onPick={onPick} struck={struck} /></div>
  </div>
)
function DiffersCard({ g, onConfirm, onReject }) {
  const f = g.lead
  const src = sourceOf(f)
  const out = outsideEvidence(f)
  return (
    <div className="flex flex-col gap-3 p-5" {...useHot(g.pages)}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5"><SplitMark /></span>
        <div className="min-w-0">
          <p className="text-[15px] leading-[22px] text-stone-600 [text-wrap:pretty]">
            <b className={val}>{src?.name ?? 'The source'}</b> says <b className={val}>{out?.snippet}</b>. Your site says <b className={val} data-wf-from={g.id}>{claimParts(f)[1]}</b>.
          </p>
          <p className={sub}>Confirm it only if the site is right. Otherwise reject it and drafts won’t use it.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-7">
        <button type="button" className={secondary} onClick={() => onConfirm(g)}><Check size={15} aria-hidden />Confirm the site’s claim</button>
        <button type="button" className={secondary} onClick={() => onReject(g)}><X size={15} aria-hidden />Reject</button>
      </div>
    </div>
  )
}

// ---- 3 · Ready to confirm: ticked rows (untick to leave one out), one button --------------------------------------
function ReadyRow({ g, on, onToggle }) {
  const f = g.lead
  const src = sourceOf(f)
  const site = siteEvidence(f)
  const Icon = KIND_ICON[f.field] ?? StickyNote
  const [open, setOpen] = useState(false)
  const many = g.copies.length > 1
  return (
    <li {...useHot(g.pages)} className={`relative flex items-start gap-3 py-2 transition-opacity duration-150 ${on ? '' : 'opacity-50'}`}>
      {/* the copies it was found as, folding into this one row on load */}
      {many && [10, 5].map((y) => <span key={y} aria-hidden style={{ '--wf-y': `${y}px` }} className="wf-anim wf-fold pointer-events-none absolute -inset-x-2 inset-y-0.5 rounded-lg border border-line opacity-0" />)}
      <Checkbox checked={on} onChange={onToggle} label={`Confirm “${f.value}”`} className="mt-1" />
      {src
        ? <SourceLogo src={src} size="h-6 w-6 rounded-md" />
        : <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-tint text-stone-600"><Icon size={14} aria-hidden /></span>}
      <div className="min-w-0 flex-1">
        <p className={`text-[14px] leading-6 ${val} [overflow-wrap:anywhere]`}>
          <span data-wf-from={g.id}>{f.value}</span>
          {many && (
            <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`ml-2 inline-flex items-center gap-1 rounded align-baseline text-[13px] font-medium text-stone-600 hover:text-stone-900 ${focus}`}>
              <Layers size={13} aria-hidden />Found {g.copies.length} times<ChevronDown size={13} aria-hidden className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
        </p>
        <p className={sub}>{KIND[f.field]}{site ? ` · ${where(site.url)}` : ''}{verdictOf(f) === 'unchecked' ? ' · Not checked' : ''}</p>
        {open && (
          <ul className="mt-2 flex flex-col gap-2">
            {g.copies.map((c, i) => (
              <li key={c.id} className="wf-anim card-in flex flex-col" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}>
                <Sentence fact={c} className="text-[13px] leading-[18px]" />
                {siteEvidence(c) && <PageLink url={siteEvidence(c).url} pre="Found on" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
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
        className={`flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-raised px-3 text-[14px] font-medium text-stone-900 transition-colors duration-150 hover:border-[var(--color-line-strong)] ${focus}`}>
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
                          <span className="block text-[14px] leading-5 font-medium text-stone-900">{it.label}</span>
                          <span className="block text-[12px] leading-4 text-stone-600">{it.hint}</span>
                        </span>
                        {it.field === value && <Check size={14} aria-hidden className="shrink-0 text-stone-900" />}
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
// the fact sheet's last slot: "+ Add a fact", opening to the kind picker and a field
function AddSlot({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('note')
  const [value, setValue] = useState('')
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`flex h-9 w-full items-center gap-1.5 rounded-md border border-dashed border-[var(--dashed-border)] px-2.5 text-[14px] font-medium text-stone-600 transition-colors duration-150 hover:border-ink hover:text-stone-900 ${focus}`}>
        <Plus size={15} aria-hidden />Add a fact
      </button>
    )
  }
  const submit = (e) => { e.preventDefault(); if (!value.trim()) return; onAdd(kind, value.trim()); setValue(''); setOpen(false) }
  return (
    <form onSubmit={submit} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)} className="wf-anim card-in flex flex-col gap-2 rounded-lg border border-line p-3">
      <p className={sub}>Something true that isn’t on the site.</p>
      <KindPicker value={kind} onChange={setKind} />
      <input id="wf-add-value" autoFocus value={value} onChange={(e) => setValue(e.target.value)} aria-label="The fact" placeholder="e.g. Free returns within 30 days"
        className={`h-9 min-w-0 rounded-lg border border-line bg-raised px-3 text-[14px] text-stone-900 placeholder:text-stone-600 hover:border-[var(--color-line-strong)] ${focus}`} />
      <div className="flex gap-2">
        <button type="submit" disabled={!value.trim()} className={`${primary} flex-1`}>Add fact</button>
        <button type="button" className={secondary} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  )
}

// ---- the fact sheet: what Content drafts may use, by kind; one named slot per fact still waiting ------------------
const slot = 'flex h-8 items-center gap-1.5 rounded-md border border-dashed border-[var(--dashed-border)] px-2.5 text-[13px] leading-[18px] text-stone-600'
function KeptRow({ g, landing }) {
  const src = sourceOf(g.lead)
  return (
    <p {...useHot(g.pages)} data-wf-slot={g.id} className={`flex min-h-8 items-center gap-2 text-[14px] leading-5 ${val}`}>
      {src && <SourceLogo src={src} size="h-4 w-4 rounded" />}
      <span className={`min-w-0 [overflow-wrap:anywhere] transition-opacity duration-200 ${landing.has(g.id) ? 'opacity-0' : ''}`}>{g.lead.value}</span>
      {g.lead.status === 'ADDED_BY_YOU' && <span className="shrink-0 text-[13px] font-normal text-stone-600">Added by you</span>}
    </p>
  )
}
function FactSheet({ b, landing, wide = false, onAdd }) {
  const callIds = new Set(b.differs.map((g) => g.id))
  const waiting = [...b.ready, ...b.differs]
  const groups = GROUPS.map((grp) => ({
    ...grp,
    kept: b.kept.filter((g) => groupOf(g.lead) === grp.id),
    open: waiting.filter((g) => groupOf(g.lead) === grp.id),
    picks: b.conflicts.filter((c) => groupOf(c.a.lead) === grp.id),
  })).filter((grp) => grp.kept.length || grp.open.length || grp.picks.length)
  return (
    <aside aria-label="Your fact sheet" className={`${card} flex flex-col gap-5 p-5`}>
      <header className="flex items-center gap-3">
        <SiteLogo domain={brand.domain} name={brand.name} className="h-9 w-9 rounded-lg" />
        <div className="min-w-0">
          <h2 className="text-[15px] leading-[22px] font-semibold text-stone-900">{brand.name}’s fact sheet</h2>
          <p className={sub}>What Content drafts may use</p>
        </div>
        <span className="num ml-auto shrink-0 text-[13px] leading-[18px] text-stone-600"><b className={val}>{b.kept.length}</b> of {b.kept.length + waiting.length + b.conflicts.length}</span>
      </header>
      <div className={`grid grid-cols-1 gap-x-6 gap-y-5 ${wide ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:max-[1399px]:grid-cols-2 lg:max-[1399px]:grid-cols-3'}`}>
        {groups.map((grp) => (
          <section key={grp.id} className="flex min-w-0 flex-col gap-1.5">
            <h3 className={sub}>{grp.label}</h3>
            {grp.kept.map((g) => <KeptRow key={g.id} g={g} landing={landing} />)}
            {grp.open.map((g) => (
              <p key={g.id} className={slot} title={g.lead.value}>
                <span className="min-w-0 truncate">{g.lead.value}</span>
                <span className="shrink-0">· {callIds.has(g.id) ? 'needs your call' : 'not reviewed'}</span>
              </p>
            ))}
            {grp.picks.map((c) => <p key={c.a.id} className={slot}>{grp.label} · pick one</p>)}
          </section>
        ))}
      </div>
      <AddSlot onAdd={onAdd} />
    </aside>
  )
}

// ---- 4 · Where we read it: one row per site section, one dot per page ---------------------------------------------
function PageDots({ list, facts, merged, scan, unread, k }) {
  const sections = useMemo(() => pageSections(list), [list])
  const { hot } = useContext(Hot)
  const index = new Map(list.map((p, i) => [p.id, i]))
  const reading = scan?.read != null
  if (unread) {
    return <div className="flex flex-wrap gap-1.5">{list.map((p) => <span key={p.id} className="h-2.5 w-2.5 rounded-full bg-[var(--data-track)]" />)}</div>
  }
  return (
    <div key={k} className="grid grid-cols-1 gap-x-12 gap-y-2.5 lg:grid-cols-2">
      {sections.map((s, si) => {
        const urls = new Set(s.pages.map((p) => p.url))
        const n = merged.filter((g) => g.lead.status !== 'REJECTED' && g.pages.some((u) => urls.has(u))).length
        const started = !reading || index.get(s.pages[0].id) <= scan.read
        return (
          <div key={s.label} className="grid grid-cols-[112px_minmax(0,1fr)_auto] items-center gap-x-4">
            <span className="truncate text-[14px] leading-5"><b className={val}>{s.label}</b> <span className="num text-[13px] text-stone-600">{s.pages.length}</span></span>
            <span className="flex flex-wrap gap-1.5">
              {s.pages.map((p) => {
                const i = index.get(p.id)
                const found = factsOnPage(facts, p.url)
                const todo = reading && i > scan.read
                const now = reading && i === scan.read
                const lit = hot?.has(p.url)
                const look = todo ? 'bg-[var(--data-track)]'
                  : now ? 'wf-anim wf-pulse bg-ink'
                    : !p.ok ? 'border-[1.5px] border-negative'
                      : found.length ? 'bg-ink' : 'border-[1.5px] border-stone-400'
                const dot = <span style={reading ? undefined : { animationDelay: `${si * 140 + s.pages.indexOf(p) * 28}ms` }}
                  className={`block h-2.5 w-2.5 rounded-full transition-[transform,box-shadow] duration-150 ${look} ${todo || now ? '' : 'wf-anim wf-pop'} ${lit ? 'scale-125 shadow-[0_0_0_2px_var(--color-surface),0_0_0_3.5px_var(--ink)]' : ''}`} />
                if (todo) return <span key={p.id}>{dot}</span>
                return (
                  <EdgeTip key={p.id} className="block !rounded-full" label={`${p.title ?? pathOf(p.url)}: ${p.ok ? plural(found.length, 'fact') : 'could not be read'}`}
                    tip={(
                      <span className="flex flex-col gap-1">
                        <span className={val}>{p.title ?? 'Couldn’t be read'}</span>
                        <span className="text-stone-600">{brand.domain}{pathOf(p.url) === '/' ? '' : pathOf(p.url)}</span>
                        {!p.ok ? <span className="text-negative">{p.error}</span>
                          : found.length ? <>{found.map((f) => <span key={f.id} className="text-stone-900">· {f.value}</span>)}</>
                            : <span className="text-stone-600">No facts found here</span>}
                      </span>
                    )}>
                    {dot}
                  </EdgeTip>
                )
              })}
            </span>
            <span className={`num text-right text-[13px] leading-[18px] ${started && n ? val : 'text-stone-600'}`}>{!started ? '' : n ? plural(n, 'fact') : 'No facts'}</span>
          </div>
        )
      })}
    </div>
  )
}
const Legend = () => (
  <p className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${sub}`}>
    <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-ink" />A fact came from this page</span>
    <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full border-[1.5px] border-stone-400" />Read, no facts</span>
    <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full border-[1.5px] border-negative" />Couldn’t be read</span>
  </p>
)

function Fold({ title, count, children }) {
  const [open, setOpen] = useState(false)
  return (
    <section className={card}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`flex w-full items-baseline gap-2 rounded-xl px-5 py-4 text-left ${focus}`}>
        <span className="text-[15px] leading-[22px] font-semibold text-stone-900">{title}</span>
        <Count n={count} />
        <ChevronDown size={15} aria-hidden className={`ml-auto self-center text-stone-600 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="wf-anim card-in border-t border-[var(--div)]">{children}</div>}
    </section>
  )
}

// ---- the page -------------------------------------------------------------------------------------------------------
export default function WebsiteFactsPage() {
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
  const [struck, setStruck] = useState(null)
  const [skipped, setSkipped] = useState(() => new Set()) // Ready to confirm rows the user unticked
  const [hot, setHot] = useState(null)
  const hotCtx = useMemo(() => ({ hot, setHot }), [hot])
  const b = useMemo(() => bucketsOf(facts, READ_YEAR), [facts])
  const okPages = list.filter((p) => p.ok).length
  const factPages = list.filter((p) => factsOnPage(facts, p.url).length).length
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
      const end = `translate(${r1.left - r0.left + (sourceOf(g.lead) ? 24 : 0)}px, ${r1.top - r0.top + 6}px)`
      const a = ghost.animate([{ transform: 'none', opacity: 1 }, { transform: end, opacity: 1, offset: 0.85 }, { transform: end, opacity: 0 }], { duration: 560, easing: GLIDE })
      a.onfinish = a.oncancel = () => { ghost.remove(); land() }
    }))
  }
  const confirmTicked = () => ticked.forEach((g, i) => setTimeout(() => flyToSheet(g), reduced() ? 0 : i * 130))
  const toggle = (g) => setSkipped((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n })
  const reject = (g) => setStatus(g.ids, 'REJECTED')
  const pickOne = (keep, drop) => {
    if (reduced()) { setStatus(drop.ids, 'REJECTED'); setStatus(keep.ids, 'CONFIRMED'); return }
    setStruck(drop.id)
    setTimeout(() => { flyToSheet(keep); setStatus(drop.ids, 'REJECTED'); setStruck(null) }, 520)
  }
  const add = (field, value) => {
    const kind = ADD_KINDS.flatMap((g) => g.items).find((it) => it.field === field)
    setFacts((fs) => [...fs, { id: `you${fs.length + 1}`, category: kind?.category ?? 'custom', field, value, status: 'ADDED_BY_YOU', source: 'YOU', notes: null, evidence: [] }])
  }

  // "Read website again": the dots fill page by page, section by section, then each source is checked in turn
  const read = () => { if (scan) return; if (reduced()) { setHasRead(true); return } setScan({ read: 0 }) }
  useEffect(() => {
    if (!scan) return undefined
    let t
    if (scan.read != null) t = setTimeout(() => setScan(scan.read >= list.length - 1 ? { checking: 0 } : { read: scan.read + 1 }), scan.read >= list.length - 1 ? 350 : 60)
    else if (scan.checking >= b.cards.length) { setScan(null); setHasRead(true); setRound((r) => r + 1) } else t = setTimeout(() => setScan({ checking: scan.checking + 1 }), 800)
    return () => clearTimeout(t)
  }, [scan]) // eslint-disable-line react-hooks/exhaustive-deps
  const scanLine = !scan ? null
    : scan.read != null ? <>Reading page <b className={val}>{scan.read + 1}</b> of {list.length} · {where(list[scan.read].url)}</>
      : <>Checking <b className={val}>{sourceOf(b.cards[Math.min(scan.checking, b.cards.length - 1)].lead).name}</b>…</>

  const header = (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2.5"><h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">Website facts</h1><BetaTag tipAlign="left" className="-translate-y-[3px] lg:-translate-y-[6px]" /></div>
        <a href={`https://${brand.domain}`} target="_blank" rel="noreferrer" className={`mt-1.5 inline-flex items-center gap-2 rounded text-[14px] leading-5 text-stone-600 hover:text-stone-900 ${focus}`}>
          <SiteLogo domain={brand.domain} name={brand.name} className="h-5 w-5 rounded" />{brand.domain}<ArrowUpRight size={14} aria-hidden />
        </a>
      </div>
      <button type="button" onClick={read} disabled={!!scan} className={primary}>
        <RefreshCw size={15} aria-hidden className={scan ? 'wf-anim wf-spin' : ''} />{scan ? 'Reading…' : hasRead ? 'Read website again' : 'Read website'}
      </button>
    </header>
  )
  const failed = list.length - okPages
  const pagesCard = (
    <section className={`${card} flex flex-col gap-4 p-5 lg:p-6`}>
      <div className="flex flex-col gap-1">
        <h2 className={h2}>Where we read it</h2>
        <p className="num text-[15px] leading-[22px] text-stone-600" aria-live="polite">
          {scanLine ?? (hasRead
            ? <>We read <b className={val}>{okPages}</b> of <b className={val}>{list.length}</b> pages. Facts came from <b className={val}>{factPages}</b> of them.</>
            : <>We’ll read up to <b className={val}>{list.length}</b> pages from your sitemap.</>)}
        </p>
      </div>
      <PageDots list={list} facts={facts} merged={b.merged} scan={scan} unread={!hasRead && !scan} k={round} />
      {hasRead && !scan && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <Legend />
          {failed > 0 && <p className={sub}>{plural(failed, 'page')} couldn’t be read · <button type="button" onClick={read} className={`rounded font-medium text-stone-900 underline-offset-2 hover:underline ${focus}`}>Retry</button></p>}
        </div>
      )}
    </section>
  )
  const lead = 'max-w-[820px] text-[22px] leading-[30px] tracking-[-0.01em] text-stone-600 [text-wrap:pretty] lg:text-[26px] lg:leading-[34px]'

  // never read: say what reading does, and show the pages waiting
  if (!hasRead) {
    return (
      <Hot.Provider value={hotCtx}>
        {header}
        <p className={lead}>
          {scan ? <>Reading <b className={val}>{brand.domain}</b>. This takes a few minutes; you can leave the page.</>
            : <>We haven’t read <b className={val}>{brand.domain}</b> yet. Reading it finds your contact details, ratings, awards and claims, and <b className={val}>checks each one against its source</b>.</>}
        </p>
        {pagesCard}
      </Hot.Provider>
    )
  }

  const total = b.kept.length
  const done = !calls && !b.ready.length // nothing left to review: the fact sheet takes the full width
  return (
    <Hot.Provider value={hotCtx}>
      {header}
      <p className={lead}>
        <b className={`num ${val}`}>{plural(total, 'fact')}</b> {total === 1 ? 'is' : 'are'} ready for your drafts.{' '}
        {calls > 0 && <><b className={`num ${val}`}>{calls}</b> {calls === 1 ? 'needs' : 'need'} your call{b.ready.length ? ', ' : '.'}</>}
        {b.ready.length > 0 && <><b className={`num ${val}`}>{b.ready.length}</b> {b.ready.length === 1 ? 'is' : 'are'} ready to confirm.</>}
        {done && 'Nothing is waiting for you.'}
      </p>

      {/* 1 · the hero */}
      {b.cards.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h2 className={h2}>Checked against outside sources <Count n={b.cards.length} /></h2>
            <p className="text-[14px] leading-5 text-stone-600">Your site’s words on the left, the source’s on the right</p>
          </div>
          <div className="grid grid-cols-1 items-stretch gap-3 md:gap-4 lg:grid-cols-2">
            {b.cards.map((g, i) => <SourceCard key={g.id} g={g} k={round} checking={scan?.checking === i} waiting={scan?.read != null || scan?.checking < i} />)}
          </div>
        </section>
      )}

      {/* 2 · Your call, 3 · Ready to confirm; the fact sheet beside them (sticky) from 1400px, under Your call below that */}
      <div className={`grid grid-cols-1 items-start gap-3 md:gap-4 ${done ? '' : 'min-[1400px]:grid-cols-[minmax(0,1fr)_340px]'}`}>
        {calls > 0 && (
          <section className={`${card} order-1 min-[1400px]:col-start-1`}>
            <h2 className={`${h2} px-5 pt-5`}>Your call <Count n={calls} /></h2>
            <div className="divide-y divide-[var(--div)]">
              {b.conflicts.map((c) => <ConflictCard key={`${c.a.id}-${c.b.id}`} c={c} onPick={pickOne} struck={struck} />)}
              {b.differs.map((g) => <DiffersCard key={g.id} g={g} onConfirm={flyToSheet} onReject={reject} />)}
            </div>
          </section>
        )}
        {done && (
          <section className={`${card} order-1 flex items-center gap-3 p-5`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tint text-stone-900"><Check size={18} aria-hidden /></span>
            <p className="text-[15px] leading-[22px] text-stone-600 [text-wrap:pretty]"><b className={val}>Nothing left to review.</b> Every fact in the sheet can be used in your drafts. Read the website again after you change it.</p>
          </section>
        )}
        <div className={`order-2 ${done ? '' : 'min-[1400px]:sticky min-[1400px]:top-6 min-[1400px]:col-start-2 min-[1400px]:row-span-2 min-[1400px]:row-start-1'}`}>
          <FactSheet b={b} landing={landing} wide={done} onAdd={add} />
        </div>
        {b.ready.length > 0 && (
          <section className={`${card} order-3 flex flex-col gap-4 p-5 min-[1400px]:col-start-1`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className={h2}>Ready to confirm <Count n={b.ready.length} /></h2>
                <p className={sub}>Nothing here disagrees with a source. Untick what drafts shouldn’t use, then confirm the rest.</p>
              </div>
              <button type="button" className={primary} disabled={!ticked.length} onClick={confirmTicked}>
                <Check size={15} aria-hidden />{ticked.length === b.ready.length ? `Confirm all ${ticked.length}` : `Confirm ${ticked.length}`}
              </button>
            </div>
            {GROUPS.map((grp) => {
              const rows = b.ready.filter((g) => groupOf(g.lead) === grp.id)
              if (!rows.length) return null
              return (
                <div key={grp.id}>
                  <h3 className={sub}>{grp.label}</h3>
                  <ul className="mt-1 grid grid-cols-1 gap-x-10 md:grid-cols-2">{rows.map((g) => <ReadyRow key={g.id} g={g} on={!skipped.has(g.id)} onToggle={() => toggle(g)} />)}</ul>
                </div>
              )
            })}
          </section>
        )}
      </div>

      {/* 4 · the pages */}
      {pagesCard}

      {b.notFacts.length > 0 && (
        <Fold title="Read, but not facts" count={b.notFacts.length}>
          <p className={`${sub} px-5 pt-3`}>Text from your home page. Drafts don’t use it unless you say so.</p>
          <ul className="py-2">
            {b.notFacts.map((f) => (
              <li key={f.id} className="flex items-center gap-4 px-5 py-2">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[14px] leading-5 ${val}`}><span data-wf-from={f.id}>{f.value}</span></p>
                  <p className={sub}>{KIND[f.field]}</p>
                </div>
                <button type="button" className={quiet} onClick={() => flyToSheet({ id: f.id, ids: [f.id], lead: f })}>Use as a fact</button>
                <button type="button" className={quiet} onClick={() => setStatus([f.id], 'REJECTED')}>Reject</button>
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
