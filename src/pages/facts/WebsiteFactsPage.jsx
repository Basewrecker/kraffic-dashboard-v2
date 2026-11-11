// Optimize → Fact Check (was "Website facts"; "Proof first", owner 2026-11-11, round 4). What we read on the brand's
// site, which claims an outside source backs up, and the facts Content drafts may use. Design only: the app's data and
// its four actions (confirm, reject, add a fact, read the website again) on sample data (data/websiteFacts.js).
// Layout, as Sentiment: a hero card (how many facts are confirmed, by status; the sources we checked against; Read
// website again) → two columns (Your call, Ready to confirm | the fact sheet) → full width: the source cards, Where we
// read it, Read but not facts. When nothing needs the user the two columns give way to one line and a full-width sheet.
// Type: section titles 700, values 600 in ink, everything supporting 400 in stone-600. One helper line per section.
// Colour: graphite, with one solid-ink element per card at most (its primary button); --copper only where the site and
// a source disagree; --negative only for a page we couldn't read. No AI engine logos: engines don't read the site.
// Previews: ?wf=empty (never read) · ?wf=done (nothing left to review). "Read website again" plays the reading state.
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Award, BadgeCheck, Building2, CalendarDays, Check, ChevronDown, Layers, Mail, MapPin, Phone, Plus, Quote, RefreshCw, Search, Star, StickyNote, X } from 'lucide-react'
import { brand } from '../../store/workspace'
import SiteLogo from '../../components/ui/SiteLogo'
import BetaTag from '../../components/ui/BetaTag'
import EdgeTip from '../../components/ui/EdgeTip'
import { GLIDE, useCountUp } from '../../components/ui/motion'
import { ADD_KINDS, GROUPS, KIND, READ_AT, bucketsOf, claimParts, diffOf, factsOnPage, groupOf, markOf, numeralOf, outsideEvidence, pageSections, pathOf, sampleFacts, samplePages, shortName, siteEvidence, sourceOf, verdictOf } from '../../data/websiteFacts'

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
// The site's value beside the source's, each under its logo, the differing part in copper, and the words "Doesn't match"
function Versus({ g, id }) {
  const f = g.lead
  const src = sourceOf(f)
  const out = outsideEvidence(f)
  const diff = diffOf(f)
  const side = 'flex min-w-0 flex-col gap-1.5'
  const who = `flex items-center gap-2 ${sub}`
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-x-6">
        <div className={`wf-anim wf-settle ${side}`}>
          <span className={who}><BrandLogo size="h-5 w-5 rounded" />Your site</span>
          <span className={`${big} [text-wrap:balance]`} data-wf-from={id}>{diff ? <Diff parts={diff.site} /> : claimParts(f)[1]}</span>
        </div>
        <div className={`wf-anim wf-settle ${side}`} style={{ animationDelay: '120ms' }}>
          <span className={who}>{src && <SourceLogo src={src} size="h-5 w-5 rounded" />}{src?.name ?? 'The source'}</span>
          <span className={`${big} [text-wrap:balance]`}>{diff ? <Diff parts={diff.source} /> : out?.snippet}</span>
        </div>
      </div>
      <span className="text-[13px] leading-[18px] font-semibold text-[var(--copper)]">Doesn’t match</span>
    </div>
  )
}

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

// ---- Your call ------------------------------------------------------------------------------------------------------
// a contradiction: two choice cards; the kept one takes the copper outline, the other dims
function ConflictOption({ g, other, onPick, picked }) {
  const site = siteEvidence(g.lead)
  const kept = picked === g.id
  return (
    <div {...useHot(g.pages)} className={`flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg border p-4 transition-[border-color,opacity] duration-200 ${kept ? 'border-[var(--copper)]' : 'border-line'} ${picked && !kept ? 'opacity-40' : ''}`}>
      <span className={`w-fit ${big}`} data-wf-from={g.id}>{g.lead.value}</span>
      {site && <Sentence fact={g.lead} quoted className="text-[13px] leading-[18px]" />}
      {site && <span className={sub}>{where(site.url)}</span>}
      <button type="button" disabled={!!picked} onClick={() => onPick(g, other)} className={`${secondary} mt-auto self-start ${kept ? 'disabled:opacity-100' : ''}`}>{kept && <Check size={15} aria-hidden />}{kept ? 'Kept' : 'Keep this one'}</button>
    </div>
  )
}
const ConflictCard = ({ c, onPick, picked }) => (
  <div className="flex flex-col gap-3 p-5">
    <p className="flex items-center gap-2.5 text-[15px] leading-[22px] font-semibold text-stone-900"><SplitMark />These two can’t both be true.</p>
    <div className="flex flex-col gap-3 sm:flex-row"><ConflictOption g={c.a} other={c.b} onPick={onPick} picked={picked} /><ConflictOption g={c.b} other={c.a} onPick={onPick} picked={picked} /></div>
  </div>
)
const DiffersCard = ({ g, onConfirm, onReject }) => (
  <div className="flex flex-col gap-4 p-5" {...useHot(g.pages)}>
    <Versus g={g} id={g.id} />
    <div className="flex flex-wrap gap-2">
      <button type="button" className={secondary} onClick={() => onConfirm(g)}><Check size={15} aria-hidden />Keep the site’s claim</button>
      <button type="button" className={secondary} onClick={() => onReject(g)}><X size={15} aria-hidden />Reject</button>
    </div>
  </div>
)

// ---- Ready to confirm: three kinds of row, each led by something of its own -----------------------------------------
//   contact: one block led by the brand logo, a short line per detail with a plain line icon
//   awards / accreditations / ratings: the real logo
//   site claims: the number the claim leads with, as a bold numeral ("2M", "9/10")
const rowState = (on, sent) => `transition-opacity duration-200 ${sent ? 'opacity-30' : on ? '' : 'opacity-50'}`
function ContactLine({ g, on, sent, onToggle }) {
  const f = g.lead
  const Icon = KIND_ICON[f.field] ?? StickyNote
  return (
    <li {...useHot(g.pages)} className={`flex items-center gap-2.5 ${rowState(on, sent)}`}>
      <Tick on={on} onChange={onToggle} disabled={sent} label={`Confirm “${f.value}”`} />
      <Icon size={15} strokeWidth={1.75} aria-hidden className="shrink-0 text-stone-600" />
      <span className={`min-w-0 truncate text-[14px] leading-6 ${val}`} data-wf-from={g.id}>{f.value}</span>
      <span className={`shrink-0 ${sub}`}>{KIND[f.field]}</span>
    </li>
  )
}
function ReadyRow({ g, on, sent, onToggle }) {
  const f = g.lead
  const site = siteEvidence(f)
  const logo = markOf(f)
  const numeral = !logo && numeralOf(f.value)
  const Icon = KIND_ICON[f.field] ?? StickyNote
  const [open, setOpen] = useState(false)
  const many = g.copies.length > 1
  return (
    <li {...useHot(g.pages)} className={`relative flex items-start gap-3 py-2 ${rowState(on, sent)}`}>
      {/* the copies it was found as, folding into this one row on load */}
      {many && [10, 5].map((y) => <span key={y} aria-hidden style={{ '--wf-y': `${y}px` }} className="wf-anim wf-fold pointer-events-none absolute -inset-x-2 inset-y-0.5 rounded-lg border border-line opacity-0" />)}
      <span className="flex h-7 w-9 shrink-0 items-center">
        {logo ? <SourceLogo src={logo} />
          : numeral ? <b className="num text-[16px] leading-7 font-semibold tracking-[-0.03em] text-stone-900">{numeral}</b>
            : <Icon size={18} strokeWidth={1.75} aria-hidden className="text-stone-600" />}
      </span>
      <span className="mt-1"><Tick on={on} onChange={onToggle} disabled={sent} label={`Confirm “${f.value}”`} /></span>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2.5 text-[14px] leading-7">
          <span className={`min-w-0 leading-5 ${val} [overflow-wrap:anywhere]`} data-wf-from={g.id}>{f.value}</span>
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
function ReadyList({ rows, skipped, sent, onToggle }) {
  const contact = rows.filter((g) => groupOf(g.lead) === 'contact')
  const rest = GROUPS.filter((grp) => grp.id !== 'contact').flatMap((grp) => rows.filter((g) => groupOf(g.lead) === grp.id))
  const props = (g) => ({ g, on: !skipped.has(g.id), sent: sent.has(g.id), onToggle: () => onToggle(g) })
  return (
    <div className="flex flex-col divide-y divide-[var(--div)]">
      {contact.length > 0 && (
        <div className="flex items-start gap-3 pb-3">
          <BrandLogo size="h-9 w-9 rounded-lg" />
          <ul className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1.5">{contact.map((g) => <ContactLine key={g.id} {...props(g)} />)}</ul>
        </div>
      )}
      {rest.length > 0 && <ul className={contact.length ? 'pt-1' : ''}>{rest.map((g) => <ReadyRow key={g.id} {...props(g)} />)}</ul>}
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

// ---- the fact sheet: what Content drafts may use, by kind. Kept: logo or kind icon + the value. Waiting: a hollow
// dot + the claim in the secondary colour (no box), wrapping to two lines. A hairline between groups.
const sheetRow = 'flex items-start gap-2 rounded-md px-1.5 py-1 -mx-1.5 text-[14px] leading-5 transition-colors duration-150'
const Hollow = ({ call }) => <span aria-hidden className="grid h-5 w-4 shrink-0 place-items-center"><span className={`h-2 w-2 rounded-full border-[1.5px] ${call ? 'border-[var(--copper)]' : 'border-stone-400'}`} /></span>
const isLit = (hot, g) => !!hot && g.pages.some((u) => hot.urls.has(u))
function KeptRow({ g, landing }) {
  const { hot } = useContext(Hot)
  return (
    <p {...useHot(g.pages)} data-wf-slot={g.id} className={`${sheetRow} ${val} ${isLit(hot, g) ? 'bg-tint' : ''}`}>
      <span className="grid h-5 w-4 shrink-0 place-items-center"><Mark fact={g.lead} size={16} /></span>
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
function FactSheet({ b, landing, onAdd, wide = false }) {
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
        <BrandLogo size="h-9 w-9 rounded-lg" />
        <div className="min-w-0">
          <h2 className={h2}>{brand.name}’s fact sheet</h2>
          <p className={sub}>What Content drafts may use</p>
        </div>
      </header>
      <div className={`grid grid-cols-1 gap-x-8 ${wide ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {groups.map((grp) => (
          <section key={grp.id} className="flex min-w-0 flex-col gap-0.5 border-t border-[var(--div)] py-3">
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

// ---- the source cards: one per claim that names an outside source. No symbols: the card's shape and plain words say
// what happened. Match: the value once, both logos, "Same on …". Doesn't match: the two values side by side.
// Couldn't check: only the site's value and "Couldn't find this on …".
function SourceCard({ g, checking, waiting, k }) {
  const f = g.lead
  const src = sourceOf(f)
  const v = verdictOf(f)
  const out = outsideEvidence(f)
  const site = siteEvidence(f)
  const more = g.pages.length - 1
  const status = checking ? 'Checking…' : f.status === 'CONFIRMED' ? 'In your fact sheet' : v === 'differs' ? 'Needs your call' : 'Ready to confirm'
  const agreed = ['trustpilot_rating', 'bbb_rating'].includes(f.field) && out ? out.snippet : claimParts(f)[1]
  return (
    <article {...useHot(g.pages)} className={`${card} flex flex-col gap-4 p-5 transition-opacity duration-200 lg:p-6 ${waiting ? 'opacity-50' : ''}`}>
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="flex items-center -space-x-1.5">
          <SourceLogo src={src} className="relative ring-2 ring-[var(--color-surface)]" />
          {v === 'agrees' && <BrandLogo className="ring-2 ring-[var(--color-surface)]" />}
        </span>
        <span className="text-[15px] leading-[22px] font-semibold text-stone-900">{src.name}</span>
        <span className={sub}>{KIND[f.field]}</span>
        <span className={`ml-auto ${sub}`}>{status}</span>
      </header>
      <div key={k} className="flex flex-1 flex-col gap-3">
        {v === 'agrees' && (
          <div className="wf-anim wf-settle flex flex-col gap-1">
            <span className="text-[26px] leading-8 font-semibold tracking-[-0.02em] text-stone-900 [text-wrap:balance]">{agreed}</span>
            <span className={sub}>Same on {src.name}</span>
          </div>
        )}
        {v === 'differs' && <Versus g={g} />}
        {v === 'unchecked' && (
          <div className="wf-anim wf-settle flex flex-col gap-1.5">
            <span className={`flex items-center gap-2 ${sub}`}><BrandLogo size="h-5 w-5 rounded" />Your site</span>
            <span className={`${big} [text-wrap:balance]`}>{claimParts(f)[1]}</span>
            <span className={sub}>Couldn’t find this on {src.name}</span>
          </div>
        )}
        <div className={`mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--div)] pt-3 ${sub}`}>
          {site && <PageLink url={site.url} />}
          {more > 0 && (
            <EdgeTip className="w-fit" tip={<span className="flex flex-col gap-1"><span className={val}>The same claim, found on</span>{g.pages.map((u) => <span key={u}>{where(u)}</span>)}</span>}>
              <span className="inline-flex items-center gap-1"><Layers size={13} aria-hidden />and {plural(more, 'page')} more</span>
            </EdgeTip>
          )}
          {out && <a href={out.url} target="_blank" rel="noreferrer" className={`ml-auto inline-flex items-center gap-0.5 rounded hover:text-stone-900 ${focus}`}>Open the source<ArrowUpRight size={13} aria-hidden /></a>}
        </div>
      </div>
    </article>
  )
}

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
  const [hot, setHot] = useState(null)
  const hotCtx = useMemo(() => ({ hot, setHot }), [hot])
  const b = useMemo(() => bucketsOf(facts, READ_YEAR), [facts])
  const calls = b.conflicts.length + b.differs.length
  const ticked = b.ready.filter((g) => !skipped.has(g.id))

  // the fact sheet sticks while the left column scrolls; a sheet taller than the window sticks by its bottom edge
  const sheet = useRef(null)
  const [stickTop, setStickTop] = useState(24)
  useLayoutEffect(() => {
    const el = sheet.current
    if (!el) return undefined
    const fit = () => setStickTop(Math.min(24, window.innerHeight - el.offsetHeight - 24))
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    window.addEventListener('resize', fit)
    fit()
    return () => { ro.disconnect(); window.removeEventListener('resize', fit) }
  })

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
  const scanLine = !scan ? null
    : scan.read != null ? `facts confirmed · reading page ${scan.read + 1} of ${list.length}`
      : `facts confirmed · checking ${sourceOf(b.cards[Math.min(scan.checking, b.cards.length - 1)].lead).name}`

  const hero = <Hero key={round} b={b} calls={calls} scan={scan} hasRead={hasRead} onRead={read} scanLine={scanLine} />
  const pagesRead = <PagesRead list={list} facts={facts} merged={b.merged} scan={scan} hasRead={hasRead} onRetry={read} k={round} />

  // never read: say what reading does, and show the pages waiting
  if (!hasRead) return <Hot.Provider value={hotCtx}>{hero}{pagesRead}</Hot.Provider>

  const rows = batch ? batch.rows : b.ready
  const done = !calls && !rows.length // nothing needs the user: one line, and the fact sheet at full width
  const undoLine = undo && !batch && <><b className={`num ${val}`}>{undo.n} confirmed</b> · <button type="button" onClick={undoConfirm} className={link}>Undo</button></>
  return (
    <Hot.Provider value={hotCtx}>
      {hero}

      {done ? (
        <>
          <Slim><b className={val}>Nothing needs you.</b>{undoLine && <> {undoLine}</>}</Slim>
          <FactSheet b={b} landing={landing} onAdd={add} wide />
        </>
      ) : (
        // two columns, as Sentiment's charts and list: what needs the user | the fact sheet. Ready to confirm (or Your
        // call, once everything is confirmed) grows to the sheet's height, so a short left column leaves no empty band.
        <div className="grid grid-cols-1 items-stretch gap-3 md:gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3 md:gap-4">
            {calls > 0 && (
              <section className={`${card} ${rows.length ? '' : 'flex-1'}`}>
                <h2 className={`${h2} px-5 pt-5`}>Your call <Count n={calls} /></h2>
                <div className="divide-y divide-[var(--div)]">
                  {b.conflicts.map((c) => <ConflictCard key={`${c.a.id}-${c.b.id}`} c={c} onPick={pickOne} picked={picked} />)}
                  {b.differs.map((g) => <DiffersCard key={g.id} g={g} onConfirm={flyToSheet} onReject={reject} />)}
                </div>
              </section>
            )}
            {undoLine && <Slim>{undoLine}</Slim>}
            {rows.length > 0 && (
              // closes by height when every row was confirmed, so what's below slides up
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
          <div className="min-w-0">
            <div ref={sheet} className="lg:sticky" style={{ top: stickTop }}><FactSheet b={b} landing={landing} onAdd={add} /></div>
          </div>
        </div>
      )}

      {/* full width: the source cards, the pages, what isn't a fact */}
      {b.cards.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className={h2}>Checked against outside sources <Count n={b.cards.length} /></h2>
          <div className="grid grid-cols-1 items-stretch gap-3 md:gap-4 lg:grid-cols-2">
            {b.cards.map((g, i) => <SourceCard key={g.id} g={g} k={round} checking={scan?.checking === i} waiting={scan?.read != null || scan?.checking < i} />)}
          </div>
        </section>
      )}
      {pagesRead}
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
