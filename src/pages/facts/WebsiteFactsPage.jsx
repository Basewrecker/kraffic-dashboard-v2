// Optimize → Website facts ("Proof first", owner 2026-11-11). What we read on the brand's site, which claims an outside
// source backs up, and the facts Content drafts may use. Design only: the app's data and its four actions (confirm,
// reject, add a fact, read the website again) on sample data (data/websiteFacts.js).
// Order: the claims a source could check (the hero) → Your call (only what needs a person) → Ready to confirm (one
// button) with the fact sheet beside it → the pages we read → text that isn't a fact, Add a fact, Rejected.
// Colour: graphite; --copper only where the site and a source disagree; --negative only for a page we couldn't read.
// No AI engine icons: this feature's data has no link to an engine.
// Previews: ?wf=empty (never read) · ?wf=done (nothing left to review). "Read website again" plays the reading state.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Award, BadgeCheck, Building2, CalendarDays, Check, ChevronDown, Layers, Mail, MapPin, Phone, Plus, Quote, RefreshCw, Search, Star, StickyNote, X } from 'lucide-react'
import { brand } from '../../store/workspace'
import SiteLogo from '../../components/ui/SiteLogo'
import BetaTag from '../../components/ui/BetaTag'
import EdgeTip from '../../components/ui/EdgeTip'
import { GLIDE } from '../../components/ui/motion'
import { ADD_KINDS, GROUPS, KIND, READ_AT, VERDICT_WORD, bucketsOf, claimParts, factsOnPage, groupOf, outsideEvidence, pageSections, pathOf, sampleFacts, samplePages, siteEvidence, sourceOf, verdictOf } from '../../data/websiteFacts'

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const READ_YEAR = new Date(READ_AT).getUTCFullYear()
const KIND_ICON = { brand_name: Building2, phone: Phone, email: Mail, address: MapPin, trustpilot_rating: Star, bbb_rating: Star, award: Award, years: CalendarDays, accreditation: BadgeCheck, claim: Quote, note: StickyNote }
const focus = 'outline-none focus-visible:ring-2 focus-visible:ring-focus'
const btn = `inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 text-[14px] font-medium transition-colors duration-150 disabled:opacity-50 ${focus}`
const primary = `${btn} bg-ink text-on-ink hover:bg-ink-hover`
const secondary = `${btn} border border-line bg-surface text-stone-900 hover:border-[var(--color-line-strong)]`
const quiet = `rounded text-[13px] leading-[18px] font-medium text-stone-600 hover:text-stone-900 ${focus}`
const card = 'rounded-xl border border-line bg-surface'
const label = 'text-[13px] leading-[18px] text-stone-500'
// a source's real logo, on a white plate so a dark mark still reads in the dark theme
const SourceLogo = ({ src, size = 'h-7 w-7 rounded-md' }) => <span className={`grid shrink-0 place-items-center overflow-hidden bg-[var(--logo-plate)] ${size}`}><SiteLogo domain={src.domain} name={src.name} className="h-full w-full" /></span>
const pages = (n) => `${n} ${n === 1 ? 'page' : 'pages'}`

// The seal between a site claim and its source: closed with a tick (agrees), split in two (differs, copper), a dashed
// ring (not checked). `checking`: a turning ring while the source is being read.
function Seal({ verdict, checking = false, k }) {
  const copper = 'var(--copper)'
  return (
    <svg key={k} width="96" height="28" viewBox="0 0 96 28" fill="none" aria-hidden className="shrink-0">
      {checking ? (
        <circle cx="48" cy="14" r="9" stroke="var(--color-stone-400)" strokeWidth="1.5" strokeDasharray="14 42" className="wf-anim wf-spin" />
      ) : verdict === 'agrees' ? (
        <g stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 14H38" pathLength="1" className="wf-anim wf-draw" style={{ animationDelay: '200ms' }} />
          <path d="M94 14H58" pathLength="1" className="wf-anim wf-draw" style={{ animationDelay: '200ms' }} />
          <circle cx="48" cy="14" r="10" pathLength="1" className="wf-anim wf-draw" style={{ animationDelay: '480ms' }} />
          <path d="M43.5 14.2l3.2 3.2 6-6.4" strokeLinejoin="round" pathLength="1" className="wf-anim wf-draw" style={{ animationDelay: '820ms', animationDuration: '240ms' }} />
        </g>
      ) : verdict === 'differs' ? (
        <g stroke={copper} strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 14H26" pathLength="1" className="wf-anim wf-draw" style={{ animationDelay: '200ms' }} />
          <path d="M94 14H70" pathLength="1" className="wf-anim wf-draw" style={{ animationDelay: '200ms' }} />
          <path d="M43 4a10 10 0 0 0 0 20" pathLength="1" className="wf-anim wf-draw" style={{ animationDelay: '480ms' }} />
          <path d="M53 4a10 10 0 0 1 0 20" pathLength="1" className="wf-anim wf-draw" style={{ animationDelay: '480ms' }} />
        </g>
      ) : (
        <g stroke="var(--color-stone-400)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 14H38" pathLength="1" className="wf-anim wf-draw" style={{ animationDelay: '200ms' }} />
          <path d="M94 14H58" strokeDasharray="2 5" />
          <circle cx="48" cy="14" r="10" strokeDasharray="3 4.5" />
        </g>
      )}
    </svg>
  )
}
// the small split seal that marks a "Your call" item
const SplitMark = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden className="shrink-0">
    <path d="M7 2a7 7 0 0 0 0 14M11 2a7 7 0 0 1 0 14" stroke="var(--copper)" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const PageLink = ({ url, pre = 'On your site' }) => (
  <a href={url} target="_blank" rel="noreferrer" className={`${label} rounded hover:text-stone-900 ${focus}`}>{pre} · <span className="font-medium">{pathOf(url) === '/' ? 'home page' : pathOf(url)}</span></a>
)
const Sentence = ({ fact, className = '' }) => {
  const [a, b, c] = claimParts(fact)
  return <p className={`text-stone-600 [text-wrap:pretty] ${className}`}>{a}<b className="font-semibold text-stone-900">{b}</b>{c}</p>
}

// ---- 1 · the hero: one card per claim that names an outside source ---------------------------------------------------
function SourceCard({ g, state, checking, waiting, k }) {
  const f = g.lead
  const src = sourceOf(f)
  const v = verdictOf(f)
  const out = outsideEvidence(f)
  const site = siteEvidence(f)
  const more = g.pages.length - 1
  return (
    <article className={`${card} flex flex-col gap-5 p-5 transition-opacity duration-200 lg:p-6 ${waiting ? 'opacity-50' : ''}`}>
      <header className="flex items-center gap-2.5">
        <SourceLogo src={src} />
        <span className="text-[15px] leading-[22px] font-medium text-stone-900">{src.name}</span>
        <span className={label}>{KIND[f.field]}</span>
        <span className={`ml-auto ${label}`}>{state}</span>
      </header>
      <div key={k} className="grid flex-1 grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="wf-anim wf-l flex min-w-0 flex-col gap-1.5">
          {site && <PageLink url={site.url} />}
          <Sentence fact={f} className="text-[15px] leading-[22px]" />
          {more > 0 && (
            <EdgeTip className="w-fit" tip={<span className="flex flex-col gap-1"><span className="font-medium text-stone-900">The same claim, found on</span>{g.pages.map((u) => <span key={u}>{pathOf(u) === '/' ? 'home page' : pathOf(u)}</span>)}</span>}>
              <span className={`inline-flex items-center gap-1 ${label} font-medium`}><Layers size={13} aria-hidden />and {pages(more)} more</span>
            </EdgeTip>
          )}
        </div>
        <div className="flex flex-col items-center gap-1 max-sm:flex-row max-sm:gap-2">
          <Seal verdict={v} checking={checking} />
          <span className={`text-[13px] leading-[18px] font-medium ${checking ? 'text-stone-500' : v === 'differs' ? 'text-[var(--copper)]' : v === 'agrees' ? 'text-stone-900' : 'text-stone-500'}`}>{checking ? 'Checking…' : VERDICT_WORD[v]}</span>
        </div>
        <div className="wf-anim wf-r flex min-w-0 flex-col gap-1.5">
          <span className={label}>On {src.name}</span>
          {out
            ? <p className="text-[20px] leading-[26px] font-semibold tracking-[-0.01em] text-stone-900 [text-wrap:balance]">{out.snippet}</p>
            : <p className="text-[15px] leading-[22px] text-stone-500 [text-wrap:pretty]">We couldn’t open a page that confirms this.</p>}
          {out && <a href={out.url} target="_blank" rel="noreferrer" className={`inline-flex w-fit items-center gap-0.5 ${label} rounded hover:text-stone-900 ${focus}`}>Open the source<ArrowUpRight size={13} aria-hidden /></a>}
        </div>
      </div>
    </article>
  )
}

// ---- 2 · Your call --------------------------------------------------------------------------------------------------
function ConflictCard({ c, onPick, struck }) {
  const Option = ({ g, other }) => {
    const site = siteEvidence(g.lead)
    const lost = struck === g.id
    return (
      <button type="button" disabled={!!struck} onClick={() => onPick(g, other)}
        className={`group relative flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-line bg-surface p-4 text-left transition-[border-color,opacity] duration-200 hover:border-ink ${lost ? 'opacity-50' : ''} ${focus}`}>
        <span className="relative w-fit text-[18px] leading-[26px] font-semibold tracking-[-0.01em] text-stone-900" data-wf-from={g.id}>
          {g.lead.value}
          {lost && <span aria-hidden className="wf-anim wf-strike absolute inset-x-0 top-1/2 h-[1.5px] bg-ink" />}
        </span>
        {site && <Sentence fact={g.lead} className="text-[13px] leading-[18px]" />}
        {site && <span className={label}>{pathOf(site.url) === '/' ? 'home page' : pathOf(site.url)}</span>}
        <span className="mt-1 text-[13px] leading-[18px] font-medium text-stone-500 transition-colors duration-150 group-hover:text-stone-900 group-focus-visible:text-stone-900">Keep this one</span>
      </button>
    )
  }
  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5"><SplitMark /></span>
        <div className="min-w-0">
          <p className="text-[15px] leading-[22px] text-stone-900"><b className="font-semibold">These two can’t both be true.</b> {c.why}</p>
          <p className={label}>Pick the one to keep. The other is rejected.</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row"><Option g={c.a} other={c.b} /><Option g={c.b} other={c.a} /></div>
    </div>
  )
}
function DiffersCard({ g, onConfirm, onReject }) {
  const f = g.lead
  const src = sourceOf(f)
  const out = outsideEvidence(f)
  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5"><SplitMark /></span>
        <div className="min-w-0">
          <p className="text-[15px] leading-[22px] text-stone-900 [text-wrap:pretty]">
            <b className="font-semibold">{src?.name ?? 'The source'}</b> says <b className="font-semibold">{out?.snippet}</b>. Your site says <b className="font-semibold" data-wf-from={g.id}>{claimParts(f)[1]}</b>.
          </p>
          <p className={label}>Confirm it only if the site is right. Otherwise reject it and drafts won’t use it.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-7">
        <button type="button" className={secondary} onClick={() => onConfirm(g)}><Check size={15} aria-hidden />Confirm the site’s claim</button>
        <button type="button" className={secondary} onClick={() => onReject(g)}><X size={15} aria-hidden />Reject</button>
      </div>
    </div>
  )
}

// ---- 3 · Ready to confirm: calm rows (logo first, medium-weight value, quiet second line), one Confirm for all -------
function ReadyRow({ g, onReject }) {
  const f = g.lead
  const src = sourceOf(f)
  const site = siteEvidence(f)
  const v = verdictOf(f)
  const Icon = KIND_ICON[f.field] ?? StickyNote
  const [open, setOpen] = useState(false)
  const many = g.copies.length > 1
  return (
    <li className="group relative">
      {/* the copies it was found as, folding into this one row on load */}
      {many && [10, 5].map((y) => <span key={y} aria-hidden style={{ '--wf-y': `${y}px` }} className="wf-anim wf-fold pointer-events-none absolute inset-x-3 inset-y-1 rounded-lg border border-line opacity-0" />)}
      <div className="relative flex min-h-[52px] items-center gap-3 px-5 py-2">
        {src
          ? <SourceLogo src={src} size="h-6 w-6 rounded-md" />
          : <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-tint text-stone-600"><Icon size={14} aria-hidden /></span>}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] leading-5 font-medium text-stone-900"><span data-wf-from={g.id}>{f.value}</span></p>
          <p className={`truncate ${label}`}>{KIND[f.field]}{site ? ` · ${pathOf(site.url) === '/' ? 'home page' : pathOf(site.url)}` : ''}{v === 'unchecked' ? ' · Not checked' : ''}</p>
        </div>
        {many && (
          <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-stone-600 hover:bg-tint hover:text-stone-900 ${focus}`}>
            <Layers size={13} aria-hidden />Found {g.copies.length} times<ChevronDown size={13} aria-hidden className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
        <button type="button" onClick={() => onReject(g)} className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-stone-600 opacity-0 transition-opacity duration-150 hover:bg-tint hover:text-stone-900 focus-visible:opacity-100 group-hover:opacity-100 touch:opacity-100 ${focus}`}>
          <X size={13} aria-hidden />Reject
        </button>
      </div>
      {open && (
        <ul className="flex flex-col gap-2 pb-3 pl-14 pr-5">
          {g.copies.map((c, i) => (
            <li key={c.id} className="wf-anim card-in flex flex-col" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}>
              <Sentence fact={c} className="text-[13px] leading-[18px]" />
              {siteEvidence(c) && <PageLink url={siteEvidence(c).url} pre="Found on" />}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

// ---- the fact sheet: what Content drafts may use, by kind, with an empty slot for each fact not reviewed yet --------
function FactSheet({ b, landing, wide = false }) {
  const waiting = [...b.ready, ...b.differs, ...b.conflicts.flatMap((c) => [c.a, c.b])]
  const callIds = new Set([...b.differs, ...b.conflicts.flatMap((c) => [c.a, c.b])].map((g) => g.id))
  return (
    <aside aria-label="Your fact sheet" className={`${card} flex flex-col gap-5 p-5`}>
      <header className="flex items-center gap-3">
        <SiteLogo domain={brand.domain} name={brand.name} className="h-9 w-9 rounded-lg" />
        <div className="min-w-0">
          <h2 className="text-[15px] leading-[22px] font-semibold text-stone-900">{brand.name}’s fact sheet</h2>
          <p className={label}>What Content drafts may use</p>
        </div>
        <span className="num ml-auto text-[13px] leading-[18px] text-stone-500"><b className="font-semibold text-stone-900">{b.kept.length}</b> of {b.kept.length + waiting.length}</span>
      </header>
      <div className={`grid grid-cols-1 gap-x-6 gap-y-5 ${wide ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:max-[1399px]:grid-cols-2 lg:max-[1399px]:grid-cols-3'}`}>
        {GROUPS.map((grp) => {
          const kept = b.kept.filter((g) => groupOf(g.lead) === grp.id)
          const open = waiting.filter((g) => groupOf(g.lead) === grp.id)
          if (!kept.length && !open.length) return null
          return (
            <section key={grp.id} className="flex min-w-0 flex-col gap-1.5">
              <h3 className={label}>{grp.label}</h3>
              {kept.map((g) => {
                const src = sourceOf(g.lead)
                return (
                  <p key={g.id} data-wf-slot={g.id} className="flex min-h-7 items-center gap-2 text-[14px] leading-5 font-medium text-stone-900">
                    {src && <SourceLogo src={src} size="h-4 w-4 rounded" />}
                    <span className={`min-w-0 [overflow-wrap:anywhere] transition-opacity duration-200 ${landing.has(g.id) ? 'opacity-0' : ''}`}>{g.lead.value}</span>
                    {g.lead.status === 'ADDED_BY_YOU' && <span className="shrink-0 text-[13px] font-normal text-stone-500">Added by you</span>}
                  </p>
                )
              })}
              {open.map((g) => (
                <p key={g.id} className="flex h-7 items-center rounded-md border border-dashed border-[var(--dashed-border)] px-2 text-[13px] leading-[18px] text-stone-500">
                  {KIND[g.lead.field]} · {callIds.has(g.id) ? 'needs your call' : 'not reviewed'}
                </p>
              ))}
            </section>
          )
        })}
      </div>
    </aside>
  )
}

// ---- 4 · Where we read it: one block per page, grouped by the site's sections, wider = more text ---------------------
function PageStrip({ list, facts, scan, unread }) {
  const sections = useMemo(() => pageSections(list), [list])
  const index = new Map(list.map((p, i) => [p.id, i]))
  const reading = scan?.read != null
  return (
    <div className="relative flex flex-wrap gap-x-5 gap-y-4">
      {!reading && !unread && <span aria-hidden className="wf-sweep pointer-events-none absolute inset-y-0 w-px bg-ink" />}
      {sections.map((s) => (
        <div key={s.label} className="flex flex-col gap-1.5">
          <div className="flex items-end gap-[3px]">
            {s.pages.map((p) => {
              const i = index.get(p.id)
              const found = factsOnPage(facts, p.url)
              const todo = unread || (reading && i > scan.read)
              const now = reading && i === scan.read
              const w = p.ok ? Math.max(8, Math.min(30, Math.round(p.words / 250))) : 10
              const look = todo ? 'border border-dashed border-[var(--dashed-border)]'
                : now ? 'wf-anim wf-pulse bg-ink'
                  : !p.ok ? 'border-[1.5px] border-negative'
                    : found.length ? 'bg-ink' : 'bg-stone-300'
              const block = <span style={{ width: w, animationDelay: reading || unread ? undefined : `${150 + i * 22}ms` }} className={`block h-7 rounded-[3px] ${look} ${todo || now ? '' : 'wf-anim wf-block'}`} />
              if (todo) return <span key={p.id}>{block}</span>
              return (
                <EdgeTip key={p.id} className="block" label={`${p.title ?? pathOf(p.url)}: ${p.ok ? `${found.length} facts found` : 'could not be read'}`}
                  tip={(
                    <span className="flex flex-col gap-1">
                      <span className="font-medium text-stone-900">{p.title ?? 'Couldn’t be read'}</span>
                      <span className="text-stone-500">{brand.domain}{pathOf(p.url) === '/' ? '' : pathOf(p.url)}</span>
                      {!p.ok ? <span className="text-negative">{p.error}</span>
                        : found.length ? <>{found.map((f) => <span key={f.id} className="text-stone-900">· {f.value}</span>)}</>
                          : <span>No facts found here</span>}
                    </span>
                  )}>
                  {block}
                </EdgeTip>
              )
            })}
          </div>
          <span className="num text-[12px] leading-4 text-stone-500">{unread ? ' ' : `${s.label} · ${s.pages.length}`}</span>
        </div>
      ))}
    </div>
  )
}
const Legend = () => (
  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] leading-[18px] text-stone-500">
    <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-[2px] bg-ink" />A fact came from this page</span>
    <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-[2px] bg-stone-300" />Read, no facts</span>
    <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-[2px] border-[1.5px] border-negative" />Couldn’t be read</span>
    <span>Wider = more text</span>
  </p>
)

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
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % Math.max(1, shown.length)) }
    if (e.key === 'Enter' && shown[at]) { e.preventDefault(); pick(shown[at]) }
  }
  return (
    <div ref={box} className="relative sm:w-44">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`Kind: ${cur.label}`} onClick={() => { setOpen((o) => !o); setAt(Math.max(0, shown.indexOf(cur))) }}
        className={`flex h-10 w-full items-center gap-2 rounded-lg border border-line bg-raised px-3 text-[14px] font-medium text-stone-900 transition-colors duration-150 hover:border-[var(--color-line-strong)] ${focus}`}>
        <Cur size={15} aria-hidden className="text-stone-600" />{cur.label}<ChevronDown size={14} aria-hidden className="ml-auto text-stone-500" />
      </button>
      {open && (
        <div className="wf-anim card-in absolute bottom-full left-0 z-40 mb-1.5 w-80 rounded-xl border border-line bg-raised p-1.5 shadow-lg" onKeyDown={onKey}>
          <label className="flex h-9 items-center gap-2 px-2 text-stone-500">
            <Search size={14} aria-hidden />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setAt(0) }} placeholder="Search kinds…" aria-label="Search kinds" className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-stone-900 outline-none placeholder:text-stone-500" />
          </label>
          <div role="listbox" aria-label="Kind of fact" className="border-t border-[var(--div)] pt-1">
            {ADD_KINDS.map((g) => {
              const items = g.items.filter(hit)
              if (!items.length) return null
              return (
                <div key={g.group}>
                  <p className="px-2 pb-1 pt-2 text-[12px] leading-4 text-stone-500">{g.group}</p>
                  {items.map((it) => {
                    const I = KIND_ICON[it.field]
                    const on = shown[at] === it
                    return (
                      <button key={it.field} type="button" role="option" aria-selected={it.field === value} onMouseEnter={() => setAt(shown.indexOf(it))} onClick={() => pick(it)}
                        className={`flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-[14px] ${on ? 'bg-tint' : ''} ${focus}`}>
                        <I size={15} aria-hidden className="shrink-0 text-stone-600" />
                        <span className="font-medium text-stone-900">{it.label}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-stone-500">{it.hint}</span>
                        {it.field === value && <Check size={14} aria-hidden className="shrink-0 text-stone-900" />}
                      </button>
                    )
                  })}
                </div>
              )
            })}
            {!shown.length && <p className="px-2 py-3 text-[13px] text-stone-500">No kind matches “{q}”.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
function AddFact({ onAdd }) {
  const [kind, setKind] = useState('note')
  const [value, setValue] = useState('')
  const submit = (e) => { e.preventDefault(); if (!value.trim()) return; onAdd(kind, value.trim()); setValue('') }
  return (
    <form onSubmit={submit} className={`${card} flex flex-col gap-3 p-5`}>
      <div>
        <h2 className="text-[15px] leading-[22px] font-semibold text-stone-900">Add a fact</h2>
        <p className={label}>Something true that isn’t on the site. It goes straight into the fact sheet.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <KindPicker value={kind} onChange={setKind} />
        <input id="wf-add-value" value={value} onChange={(e) => setValue(e.target.value)} aria-label="The fact" placeholder="e.g. Free returns within 30 days"
          className={`h-10 min-w-0 flex-1 rounded-lg border border-line bg-raised px-3 text-[14px] text-stone-900 placeholder:text-stone-500 hover:border-[var(--color-line-strong)] ${focus}`} />
        <button type="submit" disabled={!value.trim()} className={`${primary} h-10`}><Plus size={15} aria-hidden />Add fact</button>
      </div>
    </form>
  )
}

function Fold({ title, count, children }) {
  const [open, setOpen] = useState(false)
  return (
    <section className={card}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`flex w-full items-center gap-2 rounded-xl px-5 py-4 text-left ${focus}`}>
        <span className="text-[15px] leading-[22px] font-semibold text-stone-900">{title}</span>
        <span className="num text-[13px] text-stone-500">{count}</span>
        <ChevronDown size={15} aria-hidden className={`ml-auto text-stone-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
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
  const [round, setRound] = useState(0) // replays the cards' entrance after a re-read
  const [landing, setLanding] = useState(() => new Set())
  const [struck, setStruck] = useState(null)
  const b = useMemo(() => bucketsOf(facts, READ_YEAR), [facts])
  const okPages = list.filter((p) => p.ok).length
  const calls = b.conflicts.length + b.differs.length

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
      const end = `translate(${r1.left - r0.left + (r1.width && sourceOf(g.lead) ? 24 : 0)}px, ${r1.top - r0.top + 4}px)`
      const a = ghost.animate([{ transform: 'none', opacity: 1 }, { transform: end, opacity: 1, offset: 0.85 }, { transform: end, opacity: 0 }], { duration: 560, easing: GLIDE })
      a.onfinish = a.oncancel = () => { ghost.remove(); land() }
    }))
  }
  const confirmAll = (groups) => groups.forEach((g, i) => setTimeout(() => flyToSheet(g), reduced() ? 0 : i * 130))
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

  // "Read website again": the strip fills page by page, then each source is checked in turn
  const read = () => { if (scan) return; if (reduced()) { setHasRead(true); return } setScan({ read: 0 }) }
  useEffect(() => {
    if (!scan) return undefined
    let t
    if (scan.read != null) t = setTimeout(() => setScan(scan.read >= list.length - 1 ? { checking: 0 } : { read: scan.read + 1 }), scan.read >= list.length - 1 ? 350 : 60)
    else if (scan.checking >= b.cards.length) { setScan(null); setHasRead(true); setRound((r) => r + 1) } else t = setTimeout(() => setScan({ checking: scan.checking + 1 }), 800)
    return () => clearTimeout(t)
  }, [scan]) // eslint-disable-line react-hooks/exhaustive-deps
  const scanLine = !scan ? null
    : scan.read != null ? <>Reading page <b className="font-semibold text-stone-900">{scan.read + 1}</b> of {list.length} · {pathOf(list[scan.read].url) === '/' ? 'home page' : pathOf(list[scan.read].url)}</>
      : <>Checking <b className="font-semibold text-stone-900">{sourceOf(b.cards[Math.min(scan.checking, b.cards.length - 1)].lead).name}</b>…</>

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
  const strip = (
    <section className={`${card} flex flex-col gap-4 p-5 lg:p-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-title text-stone-900">Where we read it</h2>
        <p className="num text-[14px] leading-5 text-stone-600" aria-live="polite">
          {scanLine ?? (hasRead ? <><b className="font-semibold text-stone-900">{okPages}</b> of {list.length} pages read</> : <>Up to <b className="font-semibold text-stone-900">{list.length}</b> pages from your sitemap</>)}
        </p>
      </div>
      <PageStrip list={list} facts={facts} scan={scan} unread={!hasRead && !scan} />
      {hasRead && !scan && <Legend />}
    </section>
  )

  // never read: say what reading does, and show the pages waiting
  if (!hasRead) {
    return (
      <>
        {header}
        <p className="max-w-[720px] text-[22px] leading-[30px] tracking-[-0.01em] text-stone-600 [text-wrap:pretty] lg:text-[26px] lg:leading-[34px]">
          {scan ? <>Reading <b className="font-semibold text-stone-900">{brand.domain}</b>. This takes a few minutes; you can leave the page.</>
            : <>We haven’t read <b className="font-semibold text-stone-900">{brand.domain}</b> yet. Reading it finds your contact details, ratings, awards and claims, and <b className="font-semibold text-stone-900">checks each one against its source</b>.</>}
        </p>
        {strip}
      </>
    )
  }

  const total = b.kept.length
  const done = !calls && !b.ready.length // nothing left to review: the fact sheet takes the full width
  return (
    <>
      {header}
      <p className="max-w-[820px] text-[22px] leading-[30px] tracking-[-0.01em] text-stone-600 [text-wrap:pretty] lg:text-[26px] lg:leading-[34px]">
        <b className="num font-semibold text-stone-900">{total} {total === 1 ? 'fact' : 'facts'}</b> {total === 1 ? 'is' : 'are'} ready for your drafts.{' '}
        {calls > 0 && <><b className="num font-semibold text-stone-900">{calls}</b> {calls === 1 ? 'needs' : 'need'} your call{b.ready.length ? ', ' : '.'}</>}
        {b.ready.length > 0 && <><b className="num font-semibold text-stone-900">{b.ready.length}</b> {b.ready.length === 1 ? 'is' : 'are'} ready to confirm.</>}
        {!calls && !b.ready.length && 'Nothing is waiting for you.'}
      </p>

      {/* 1 · the hero */}
      {b.cards.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h2 className="text-title text-stone-900">Checked against outside sources</h2>
            <p className="text-[14px] leading-5 text-stone-600">Your site’s words on the left, the source’s on the right</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
            {b.cards.map((g, i) => (
              <SourceCard key={g.id} g={g} k={round} checking={scan?.checking === i} waiting={scan?.read != null || scan?.checking < i}
                state={g.lead.status === 'CONFIRMED' ? 'In your fact sheet' : verdictOf(g.lead) === 'differs' ? 'Needs your call' : 'Ready to confirm'} />
            ))}
          </div>
        </section>
      )}

      {/* 2 · Your call, 3 · Ready to confirm; the fact sheet beside them from 1400px, under Your call below that */}
      <div className={`grid grid-cols-1 items-start gap-3 md:gap-4 ${done ? '' : 'min-[1400px]:grid-cols-[minmax(0,1fr)_340px]'}`}>
        {calls > 0 && (
          <section className={`${card} order-1 min-[1400px]:col-start-1`}>
            <div className="flex items-baseline gap-2 px-5 pt-5"><h2 className="text-title text-stone-900">Your call</h2><span className="num text-[14px] text-stone-500">{calls}</span></div>
            <div className="divide-y divide-[var(--div)]">
              {b.conflicts.map((c) => <ConflictCard key={`${c.a.id}-${c.b.id}`} c={c} onPick={pickOne} struck={struck} />)}
              {b.differs.map((g) => <DiffersCard key={g.id} g={g} onConfirm={flyToSheet} onReject={reject} />)}
            </div>
          </section>
        )}
        {done && (
          <section className={`${card} order-1 flex items-center gap-3 p-5`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tint text-stone-900"><Check size={18} aria-hidden /></span>
            <p className="text-[15px] leading-[22px] text-stone-600 [text-wrap:pretty]"><b className="font-semibold text-stone-900">Nothing left to review.</b> Every fact in the sheet can be used in your drafts. Read the website again after you change it.</p>
          </section>
        )}
        <div className={`order-2 ${done ? '' : 'min-[1400px]:sticky min-[1400px]:top-6 min-[1400px]:col-start-2 min-[1400px]:row-span-2 min-[1400px]:row-start-1'}`}>
          <FactSheet b={b} landing={landing} wide={done} />
        </div>
        {b.ready.length > 0 && (
          <section className={`${card} order-3 min-[1400px]:col-start-1`}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2"><h2 className="text-title text-stone-900">Ready to confirm</h2><span className="num text-[14px] text-stone-500">{b.ready.length}</span></div>
                <p className={label}>Nothing here disagrees with a source. Reject what drafts shouldn’t use, then confirm the rest.</p>
              </div>
              <button type="button" className={primary} onClick={() => confirmAll(b.ready)}><Check size={15} aria-hidden />Confirm all {b.ready.length}</button>
            </div>
            <div className="pb-2 pt-3">
              {GROUPS.map((grp) => {
                const rows = b.ready.filter((g) => groupOf(g.lead) === grp.id)
                if (!rows.length) return null
                return (
                  <div key={grp.id}>
                    <h3 className={`${label} px-5 pb-1 pt-3`}>{grp.label}</h3>
                    <ul>{rows.map((g) => <ReadyRow key={g.id} g={g} onReject={reject} />)}</ul>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>

      {/* 4 · the pages */}
      {strip}

      <div className="grid grid-cols-1 items-start gap-3 md:gap-4 lg:grid-cols-2">
        <AddFact onAdd={add} />
        <div className="flex flex-col gap-3 md:gap-4">
          {b.notFacts.length > 0 && (
            <Fold title="Read, but not facts" count={b.notFacts.length}>
              <p className={`${label} px-5 pt-3`}>Text from your home page. Drafts don’t use it unless you say so.</p>
              <ul className="py-2">
                {b.notFacts.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-5 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] leading-5 text-stone-900"><span data-wf-from={f.id}>{f.value}</span></p>
                      <p className={label}>{KIND[f.field]}</p>
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
                {b.rejected.map((g) => <li key={g.id} className="px-5 py-1.5 text-[14px] leading-5 text-stone-500 line-through">{g.lead.value}</li>)}
              </ul>
            </Fold>
          )}
        </div>
      </div>
    </>
  )
}
