// Optimize → Website facts ("Proof first", owner 2026-11-11; rounds 2 and 3 the same day). What we read on the brand's
// site, which claims an outside source backs up, and the facts Content drafts may use. Design only: the app's data and
// its four actions (confirm, reject, add a fact, read the website again) on sample data (data/websiteFacts.js).
// Layout: the claims a source could check (the hero), then two columns from 1400px: on the left Your call → Ready to
// confirm → Where we read it → Read, but not facts; on the right the fact sheet, sticky. Below 1400px one column, with
// the fact sheet under Your call.
// Type: section titles 700, values 600 in ink, everything supporting 400 in stone-600. One helper line per section.
// Colour: graphite, with one solid-ink element per card at most (its primary button); --copper only where the site and
// a source disagree; --negative only for a page we couldn't read. No AI engine logos: engines don't read the site.
// Previews: ?wf=empty (never read) · ?wf=done (nothing left to review). "Read website again" plays the reading state.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Award, BadgeCheck, Building2, CalendarDays, Check, ChevronDown, Layers, Mail, MapPin, Phone, Plus, Quote, RefreshCw, Search, Star, StickyNote, X } from 'lucide-react'
import { brand } from '../../store/workspace'
import SiteLogo from '../../components/ui/SiteLogo'
import BetaTag from '../../components/ui/BetaTag'
import EdgeTip from '../../components/ui/EdgeTip'
import { GLIDE, useCountUp } from '../../components/ui/motion'
import { ADD_KINDS, GROUPS, KIND, READ_AT, VERDICT_WORD, bucketsOf, claimParts, diffOf, factsOnPage, groupOf, markOf, outsideEvidence, pageSections, pathOf, sampleFacts, samplePages, siteEvidence, sourceOf, verdictOf } from '../../data/websiteFacts'

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
const SourceLogo = ({ src, size = 'h-7 w-7 rounded-md' }) => <span className={`grid shrink-0 place-items-center overflow-hidden bg-[var(--logo-plate)] ${size}`}><SiteLogo domain={src.domain} name={src.name} className="h-full w-full" /></span>
// what stands beside a fact: its source's (or certifier's) logo, else its kind's icon
function Mark({ fact, size = 20 }) {
  const m = markOf(fact)
  const Icon = KIND_ICON[fact.field] ?? StickyNote
  const box = { width: size, height: size }
  return m
    ? <span style={box} className="grid shrink-0 place-items-center overflow-hidden rounded bg-[var(--logo-plate)]"><SiteLogo domain={m.domain} name={m.name} className="h-full w-full" /></span>
    : <span style={box} className="grid shrink-0 place-items-center rounded bg-tint text-stone-600"><Icon size={Math.round(size * 0.6)} aria-hidden /></span>
}
const PageLink = ({ url, pre = 'On your site' }) => (
  <a href={url} target="_blank" rel="noreferrer" className={`${sub} w-fit rounded hover:text-stone-900 ${focus}`}>{pre} · {where(url)}</a>
)
// [before, differing, after]: the differing part in copper, with one pulse
const Diff = ({ parts }) => <>{parts[0]}{parts[1] && <span className="wf-anim wf-diff">{parts[1]}</span>}{parts[2]}</>
const Sentence = ({ fact, className = '', diff = null, quoted = false }) => {
  const [a, b, c] = claimParts(fact)
  return <p className={`font-normal text-stone-600 [text-wrap:pretty] ${className}`}>{quoted && '“'}{a}<b className={val}>{diff ? <Diff parts={diff.site} /> : b}</b>{c}{quoted && '”'}</p>
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
    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors duration-150 ${on ? 'border-stone-400 bg-tint' : 'border-stone-300 bg-surface hover:border-stone-400'} ${focus}`}>
    {on && <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--color-stone-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path pathLength="1" className="wf-anim wf-draw" style={{ animationDuration: '160ms' }} d="M3.5 8.5l3 3 6-7" /></svg>}
  </button>
)

// ---- 1 · the hero: one card per claim that names an outside source ---------------------------------------------------
// The token on the divider: "=" agrees · "≠" differs (copper) · "?" not checked; a turning ring while it's being checked.
function Token({ verdict, checking, still = false }) {
  const draw = (delay) => (still ? {} : { pathLength: 1, className: 'wf-anim wf-draw', style: { animationDelay: `${delay}ms` } })
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line bg-surface" role="img" aria-label={checking ? 'Checking' : VERDICT_WORD[verdict]}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
        {checking ? <circle cx="8" cy="8" r="5.5" stroke="var(--color-stone-600)" strokeDasharray="9 26" className="wf-anim wf-spin" />
          : verdict === 'agrees' ? <g stroke="var(--color-stone-700)"><path d="M3.5 5.75h9" {...draw(450)} /><path d="M3.5 10.25h9" {...draw(600)} /></g>
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
// a contradiction: two choice cards; the kept one takes the copper outline, the other dims
function ConflictOption({ g, other, onPick, picked }) {
  const site = siteEvidence(g.lead)
  const kept = picked === g.id
  return (
    <div {...useHot(g.pages)} className={`flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg border p-4 transition-[border-color,opacity] duration-200 ${kept ? 'border-[var(--copper)]' : 'border-line'} ${picked && !kept ? 'opacity-40' : ''}`}>
      <span className="w-fit text-[20px] leading-[26px] font-semibold tracking-[-0.01em] text-stone-900" data-wf-from={g.id}>{g.lead.value}</span>
      {site && <Sentence fact={g.lead} quoted className="text-[13px] leading-[18px]" />}
      {site && <span className={sub}>{where(site.url)}</span>}
      <button type="button" disabled={!!picked} onClick={() => onPick(g, other)} className={`${secondary} mt-2 self-start ${kept ? 'disabled:opacity-100' : ''}`}>{kept && <Check size={15} aria-hidden />}{kept ? 'Kept' : 'Keep this one'}</button>
    </div>
  )
}
const ConflictCard = ({ c, onPick, picked }) => (
  <div className="flex flex-col gap-3 p-5">
    <p className="flex items-center gap-2.5 text-[15px] leading-[22px] font-semibold text-stone-900"><SplitMark />These two can’t both be true.</p>
    <div className="flex flex-col gap-3 sm:flex-row"><ConflictOption g={c.a} other={c.b} onPick={onPick} picked={picked} /><ConflictOption g={c.b} other={c.a} onPick={onPick} picked={picked} /></div>
  </div>
)
// a claim its source disagrees with, as a row: the source's value ≠ the site's, the differing part in copper
function DiffersCard({ g, onConfirm, onReject }) {
  const f = g.lead
  const src = sourceOf(f)
  const out = outsideEvidence(f)
  const diff = diffOf(f)
  const side = 'flex min-w-0 items-center gap-2.5 text-[18px] leading-[26px] font-semibold tracking-[-0.01em] text-stone-900'
  return (
    <div className="flex flex-col gap-4 p-5" {...useHot(g.pages)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className={side}>{src && <SourceLogo src={src} />}<span>{diff ? <Diff parts={diff.source} /> : out?.snippet}</span></span>
        <Token verdict="differs" still />
        <span className={side}><SiteLogo domain={brand.domain} name={brand.name} className="h-7 w-7 rounded-md" /><span data-wf-from={g.id}>{diff ? <Diff parts={diff.site} /> : claimParts(f)[1]}</span></span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={secondary} onClick={() => onConfirm(g)}><Check size={15} aria-hidden />Keep the site’s claim</button>
        <button type="button" className={secondary} onClick={() => onReject(g)}><X size={15} aria-hidden />Reject</button>
      </div>
    </div>
  )
}

// ---- 3 · Ready to confirm: one grid of ticked rows (untick to leave one out), one button ---------------------------
function ReadyRow({ g, on, sent, onToggle }) {
  const f = g.lead
  const site = siteEvidence(f)
  const [open, setOpen] = useState(false)
  const many = g.copies.length > 1
  return (
    <li {...useHot(g.pages)} className={`relative flex items-start gap-3 py-2 transition-opacity duration-200 md:last:odd:col-span-2 ${sent ? 'opacity-30' : on ? '' : 'opacity-50'}`}>
      {/* the copies it was found as, folding into this one row on load */}
      {many && [10, 5].map((y) => <span key={y} aria-hidden style={{ '--wf-y': `${y}px` }} className="wf-anim wf-fold pointer-events-none absolute -inset-x-2 inset-y-0.5 rounded-lg border border-line opacity-0" />)}
      <Tick on={on} onChange={onToggle} disabled={sent} label={`Confirm “${f.value}”`} />
      <Mark fact={f} size={24} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2.5 text-[14px] leading-6">
          <span className={`min-w-0 ${val} [overflow-wrap:anywhere]`} data-wf-from={g.id}>{f.value}</span>
          {many && (
            <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`inline-flex shrink-0 items-center gap-1 rounded text-[13px] font-normal text-stone-600 hover:text-stone-900 ${focus}`}>
              <Layers size={13} aria-hidden className="self-center" />Found {g.copies.length} times<ChevronDown size={13} aria-hidden className={`self-center transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
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

// ---- the fact sheet: what Content drafts may use, by kind. Kept: logo or kind icon + the value. Waiting: a hollow
// dot + the claim in the secondary colour (no box), wrapping to two lines. A hairline between groups.
const sheetRow = 'flex items-start gap-2 rounded-md px-1.5 py-1 -mx-1.5 text-[14px] leading-5 transition-colors duration-150'
const Hollow = ({ call }) => <span aria-hidden className="grid h-5 w-4 shrink-0 place-items-center"><span className={`h-2 w-2 rounded-full border-[1.5px] ${call ? 'border-[var(--copper)]' : 'border-stone-400'}`} /></span>
const isLit = (hot, g) => !!hot && g.pages.some((u) => hot.urls.has(u))
function KeptRow({ g, landing }) {
  const { hot } = useContext(Hot)
  return (
    <p {...useHot(g.pages)} data-wf-slot={g.id} className={`${sheetRow} ${val} ${isLit(hot, g) ? 'bg-tint' : ''}`}>
      <Mark fact={g.lead} size={16} />
      <span className={`min-w-0 flex-1 [overflow-wrap:anywhere] transition-opacity duration-200 ${landing.has(g.id) ? 'opacity-0' : ''}`}>
        {g.lead.value}{g.lead.status === 'ADDED_BY_YOU' && <span className="font-normal text-stone-600"> · added by you</span>}
      </span>
    </p>
  )
}
function WaitingRow({ g, call }) {
  const { hot } = useContext(Hot)
  return (
    <p {...useHot(g.pages)} className={`${sheetRow} font-normal text-stone-600 ${isLit(hot, g) ? 'bg-tint' : ''}`}>
      <Hollow call={call} /><span className="line-clamp-2 min-w-0 flex-1 [overflow-wrap:anywhere]">{g.lead.value}</span>
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
    <aside aria-label="Your fact sheet" className={`${card} flex flex-col gap-4 p-5`}>
      <header className="flex items-center gap-3">
        <SiteLogo domain={brand.domain} name={brand.name} className="h-9 w-9 rounded-lg" />
        <div className="min-w-0">
          <h2 className="text-[15px] leading-[22px] font-bold text-stone-900">{brand.name}’s fact sheet</h2>
          <p className={sub}>What Content drafts may use</p>
        </div>
        <span className="num ml-auto shrink-0 text-[13px] leading-[18px] text-stone-600"><b className={val}>{b.kept.length}</b> of {b.kept.length + waiting.length + b.conflicts.length}</span>
      </header>
      {/* one column with hairlines on phones and beside the lists (1400px+); two or three columns in between */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:max-[1399px]:grid-cols-2 lg:max-[1399px]:grid-cols-3">
        {groups.map((grp) => (
          <section key={grp.id} className="flex min-w-0 flex-col gap-0.5 border-[var(--div)] max-sm:border-t max-sm:pt-4 min-[1400px]:border-t min-[1400px]:pt-4">
            <h3 className={`${sub} pb-1`}>{grp.label}</h3>
            {grp.kept.map((g) => <KeptRow key={g.id} g={g} landing={landing} />)}
            {grp.open.map((g) => <WaitingRow key={g.id} g={g} call={callIds.has(g.id)} />)}
            {grp.picks.map((c) => <p key={c.a.id} className={`${sheetRow} font-normal text-stone-600`}><Hollow call /><span>{grp.label} · pick one</span></p>)}
          </section>
        ))}
      </div>
      <AddSlot onAdd={onAdd} />
    </aside>
  )
}

// ---- 4 · Where we read it: a headline, one tile per site section that gave facts, the rest in one line ---------------
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
function SectionTile({ s, si, groups, facts, scan, index }) {
  const { hot, setHot } = useContext(Hot)
  const [active, setActive] = useState(false)
  const [run, setRun] = useState(0) // each hover replays the segments' fill
  const reading = scan?.read != null
  const enter = () => { if (active) return; setActive(true); setRun((r) => r + 1); setHot({ urls: new Set(s.pages.map((p) => p.url)), src: 'tile' }) }
  const leave = () => { setActive(false); setHot(null) }
  return (
    <div tabIndex={0} role="group" aria-label={`${s.label}: ${plural(groups.length, 'fact')} from ${plural(s.pages.length, 'page')}`}
      onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) leave() }}
      className={`relative flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-4 transition-[transform,box-shadow] duration-200 ${active ? 'z-20 -translate-y-0.5 shadow-md' : ''} ${focus}`}>
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
      {/* the logos of the facts found here; on hover they open into named facts, over what's below */}
      <div className="relative h-5">
        <div className={`flex gap-1.5 transition-opacity duration-150 ${active ? 'opacity-0' : ''}`}>{groups.map((g) => <Mark key={g.id} fact={g.lead} size={20} />)}</div>
        {active && (
          <div className="absolute -inset-x-[17px] -top-1.5 z-20 flex flex-col gap-1 rounded-b-lg border border-t-0 border-line bg-surface px-4 pb-4 pt-1.5 shadow-md">
            {groups.map((g, i) => (
              <span key={g.id} className="wf-anim wf-chip flex items-start gap-2 text-[13px] leading-5 text-stone-900" style={{ animationDelay: `${i * 40}ms` }}>
                <Mark fact={g.lead} size={20} /><span className="min-w-0 [overflow-wrap:anywhere]">{g.lead.value}</span>
              </span>
            ))}
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
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
        <b className="num text-kpi text-stone-900">{reading ? scan.read + 1 : counted} of {list.length}</b>
        <span className="text-[15px] leading-[22px] text-stone-600">{reading ? `reading ${where(list[scan.read].url)}` : hasRead ? 'pages read' : 'pages from your sitemap, at most'}</span>
        {hasRead && !scan && <span className="text-[15px] leading-[22px] text-stone-600">Facts came from <b className={`num ${val}`}>{countedFacts}</b></span>}
        {scan?.checking != null && <span className="text-[15px] leading-[22px] text-stone-600">checking the sources</span>}
      </p>
      {hasRead ? (
        <div key={k} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-[1399px]:grid-cols-4">
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
// a slim one-line card: "8 confirmed · Undo", "Nothing left to review."
const Slim = ({ children }) => (
  <div className={`${card} wf-anim card-in flex items-center gap-2.5 px-5 py-3 text-[14px] leading-5 text-stone-600`}>
    <Check size={16} aria-hidden className="shrink-0 text-stone-700" />{children}
  </div>
)

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
  const [picked, setPicked] = useState(null) // the claim kept in a contradiction, while it resolves
  const [skipped, setSkipped] = useState(() => new Set()) // Ready to confirm rows the user unticked
  const [batch, setBatch] = useState(null) // a Confirm in flight: { rows, sent: Set, closing }
  const [undo, setUndo] = useState(null) // the last Confirm: { ids, n }
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
  const reject = (g) => setStatus(g.ids, 'REJECTED')
  const pickOne = (keep, drop) => {
    if (reduced()) { setStatus(drop.ids, 'REJECTED'); setStatus(keep.ids, 'CONFIRMED'); return }
    setPicked(keep.id)
    setTimeout(() => { flyToSheet(keep); setStatus(drop.ids, 'REJECTED'); setPicked(null) }, 600)
  }
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
  const pagesRead = <PagesRead list={list} facts={facts} merged={b.merged} scan={scan} hasRead={hasRead} onRetry={read} k={round} />
  const lead = 'max-w-[820px] text-[22px] leading-[30px] tracking-[-0.01em] font-normal text-stone-600 [text-wrap:pretty] lg:text-[26px] lg:leading-[34px]'

  // never read: say what reading does, and show the pages waiting
  if (!hasRead) {
    return (
      <Hot.Provider value={hotCtx}>
        {header}
        <p className={lead}>
          {scan ? <>Reading <b className={val}>{brand.domain}</b>. This takes a few minutes; you can leave the page.</>
            : <>We haven’t read <b className={val}>{brand.domain}</b> yet. Reading it finds your contact details, ratings, awards and claims, and <b className={val}>checks each one against its source</b>.</>}
        </p>
        {pagesRead}
      </Hot.Provider>
    )
  }

  const total = b.kept.length
  const rows = batch ? batch.rows : b.ready
  const done = !calls && !rows.length
  return (
    <Hot.Provider value={hotCtx}>
      {header}
      <p className={lead}>
        <b className={`num ${val}`}>{plural(total, 'fact')}</b> {total === 1 ? 'is' : 'are'} ready for your drafts.{' '}
        {calls > 0 && <><b className={`num ${val}`}>{calls}</b> {calls === 1 ? 'needs' : 'need'} your call{b.ready.length ? ', ' : '.'}</>}
        {b.ready.length > 0 && <><b className={`num ${val}`}>{b.ready.length}</b> {b.ready.length === 1 ? 'is' : 'are'} ready to confirm.</>}
        {!calls && !b.ready.length && 'Nothing is waiting for you.'}
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

      {/* from 1400px: the lists on the left, the fact sheet sticky on the right. Below: one column, the sheet 2nd. */}
      <div className="grid grid-cols-1 items-start gap-3 md:gap-4 min-[1400px]:grid-cols-[minmax(0,1fr)_340px]">
        <div className="contents min-[1400px]:flex min-[1400px]:min-w-0 min-[1400px]:flex-col min-[1400px]:gap-4">
          {calls > 0 && (
            <section className={`${card} order-1`}>
              <h2 className={`${h2} px-5 pt-5`}>Your call <Count n={calls} /></h2>
              <div className="divide-y divide-[var(--div)]">
                {b.conflicts.map((c) => <ConflictCard key={`${c.a.id}-${c.b.id}`} c={c} onPick={pickOne} picked={picked} />)}
                {b.differs.map((g) => <DiffersCard key={g.id} g={g} onConfirm={flyToSheet} onReject={reject} />)}
              </div>
            </section>
          )}
          {done && !undo && <div className="order-1"><Slim><b className={val}>Nothing left to review.</b></Slim></div>}
          {undo && !batch && (
            <div className="order-3"><Slim><span><b className={`num ${val}`}>{undo.n} confirmed</b> · <button type="button" onClick={undoConfirm} className={link}>Undo</button></span></Slim></div>
          )}
          {rows.length > 0 && (
            // closes by height when every row was confirmed, so what's below slides up
            <div className="order-3 grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: batch?.closing ? '0fr' : '1fr' }}>
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
                <ul className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
                  {GROUPS.flatMap((grp) => rows.filter((g) => groupOf(g.lead) === grp.id)).map((g) => <ReadyRow key={g.id} g={g} on={!skipped.has(g.id)} sent={!!batch?.sent.has(g.id)} onToggle={() => toggle(g)} />)}
                </ul>
              </section>
            </div>
          )}
          <div className="order-4">{pagesRead}</div>
          {b.notFacts.length > 0 && (
            <div className="order-5">
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
            </div>
          )}
          {b.rejected.length > 0 && (
            <div className="order-6">
              <Fold title="Rejected" count={b.rejected.length}>
                <ul className="py-2">
                  {b.rejected.map((g) => <li key={g.id} className="px-5 py-1.5 text-[14px] leading-5 text-stone-600 line-through">{g.lead.value}</li>)}
                </ul>
              </Fold>
            </div>
          )}
        </div>
        <div className="order-2 min-[1400px]:sticky min-[1400px]:top-6">
          <FactSheet b={b} landing={landing} onAdd={add} />
        </div>
      </div>
    </Hot.Provider>
  )
}
