import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '../../hooks/useMedia'
import SheetHandle, { SHEET_BASE, SHEET_FOOTER_PAD, SHEET_IN, SHEET_OUT } from '../ui/SheetHandle'
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, ChevronUp, History, Hash, Minus, Plus, X } from 'lucide-react'
import Segmented from '../dashboard/Segmented'
import { brandName } from '../../utils/brand'
import { PlatformIcon } from '../dashboard/icons'
import SiteLogo from '../ui/SiteLogo'
import { ANSWER_SYNCS, LATEST, compareAnswers, getAnswer, loadAnswerHistory } from '../../data/answers'
import { OWN, brandByDomain, engineName, getBrandView } from '../../data/brandViews'
import { useBrandView } from '../../hooks/useBrandView'
import { fmtDay, useTracking } from '../../store/trackingSettings'

// "View answer" → this drawer. openAnswer({ key, list, opener }): key = tracked prompt id ("v12") or a
// marketplace prompt ("mp7"); list = the keys of the table it came from, in its current order (↑/↓ walk it);
// opener gets focus back on close. URL: ?answer=<key>&answerEngine=<engine> (?engine= is the dashboard's filter).
// engine (optional) opens on that engine. back = { label, onBack, onClose } when the Engine drawer swaps this in
// for itself: it appears without the slide, shows "← label", and closing hands back to the Engine drawer.
const EVENT = 'answer:open'
// brand (optional): see the answer as this tracked domain instead of the page's "Viewing as".
// date (optional): the answer at that sync ("Sep 28, 2026") instead of the latest, if we have it.
export function openAnswer({ key, list, opener, engine = null, back = null, brand = null, date = null }) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { key, list, opener, engine, back, brand, date } }))
}

const LIVE = {
  aio: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  gemini: (q) => `https://gemini.google.com/app?q=${encodeURIComponent(q)}`,
  chatgpt: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`,
  claude: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`,
  grok: (q) => `https://grok.com/?q=${encodeURIComponent(q)}`,
}
const ordinal = (n) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`
const short = (d) => d.replace(/, \d{4}$/, '')
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const LOAD_MS = 350 // mock fetch

function readUrl() {
  const q = new URLSearchParams(window.location.search)
  return { key: q.get('answer'), engine: q.get('answerEngine') }
}
function writeUrl(key, engine) {
  const url = new URL(window.location.href)
  if (key) { url.searchParams.set('answer', key); url.searchParams.set('answerEngine', engine) } else {
    // closed: drop the What changed tab's ?changes= / ?diff= too
    for (const k of ['answer', 'answerEngine', 'changes', 'diff']) url.searchParams.delete(k)
  }
  window.history.replaceState(window.history.state, '', url)
}

// ------------------------------------------------------------------ answer text
// brand names in the text: the focal brand is the only highlight (semibold on tint, data-focal-brand for the
// "Ranked" jump); tracked brands are plain with a hover underline (click → see the dashboard as that brand);
// any other brand is just text
function BrandText({ text, brands, onBrand }) {
  const plain = text.replace(/\*\*/g, '')
  const names = brands.map((b) => b.name).sort((a, b) => b.length - a.length)
  if (!names.length) return plain
  const esc = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = plain.split(new RegExp(`(${esc.join('|')})`, 'g'))
  return parts.map((p, i) => {
    const b = brands.find((x) => x.name === p)
    if (!b) return <Fragment key={i}>{p}</Fragment>
    if (b.focal) return <span key={i} data-focal-brand className="rounded bg-[var(--tint)] px-1 font-semibold text-stone-900">{p}</span>
    if (b.tracked && onBrand) {
      return (
        <button key={i} type="button" onClick={() => onBrand(b)} title={`See the dashboard as ${b.name}`}
          className="rounded underline-offset-[3px] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">{p}</button>
      )
    }
    return <Fragment key={i}>{p}</Fragment>
  })
}

// units → headings / paragraphs / bullet lists
function groupUnits(units) {
  const out = []
  units.forEach((u) => {
    const last = out[out.length - 1]
    if ((u.kind === 'p' || u.kind === 'li') && last && last.kind === u.kind && last.block === u.block) last.items.push(u)
    else out.push({ kind: u.kind, block: u.block, items: [u] })
  })
  return out
}
function AnswerText({ units, brands, onBrand }) {
  return (
    <div className="max-w-[62ch] text-[15px] leading-[1.65] text-stone-900">
      {groupUnits(units).map((g, gi) => {
        if (g.kind === 'h2' || g.kind === 'h3') {
          return g.items.map((u, i) => (
            <h4 key={`${gi}-${i}`} data-block={g.block} className={`mb-2 text-[15px] leading-6 font-semibold text-stone-900 ${gi === 0 ? '' : 'mt-5'}`}>
              <BrandText text={u.text} brands={brands} onBrand={onBrand} />
            </h4>
          ))
        }
        if (g.kind === 'li') {
          return (
            <ul key={gi} data-block={g.block} className="mb-3 list-disc pl-5 marker:text-stone-400">
              {g.items.map((u, i) => <li key={i} className="mb-1.5 pl-1"><BrandText text={u.text} brands={brands} onBrand={onBrand} /></li>)}
            </ul>
          )
        }
        return (
          <p key={gi} className="mb-3">
            {g.items.map((u, i) => <Fragment key={i}>{i > 0 && ' '}<BrandText text={u.text} brands={brands} onBrand={onBrand} /></Fragment>)}
          </p>
        )
      })}
    </div>
  )
}

// source paths without the noise: query strings, reddit comment tails, and the prompt slug the mock repeats
const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
function cleanPath(path, prompt) {
  let p = path.split('?')[0]
  const r = p.match(/^\/r\/[^/]+/)
  if (r) return r[0]
  const head = slugify(prompt).slice(0, 12)
  const at = head.length >= 6 ? p.indexOf(head) : -1
  if (at > 0) p = p.slice(0, at)
  p = p.replace(/[-/]+$/, '')
  return p || '/'
}

function SourceRow({ s, prompt, own }) {
  return (
    <li>
      <a href={`https://${s.domain}${s.path}`} target="_blank" rel="noopener noreferrer"
        className={`group -mx-2 flex h-11 items-center gap-3 rounded-md px-2 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus hover:bg-[var(--tint)]`}>
        <SiteLogo domain={s.domain} name={brandName(s.domain)} className="h-5 w-5 rounded-md" imgPad="p-0.5" initialClass="text-[10px]" />
        <span className={`shrink-0 text-[14px] leading-5 ${own ? 'font-semibold text-ink' : 'font-medium text-stone-900'}`}>{brandName(s.domain)}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] text-stone-500">{cleanPath(s.path, prompt)}</span>
        <ArrowUpRight size={14} className="shrink-0 text-stone-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100 touch:opacity-100 group-focus-visible:opacity-100" aria-hidden />
      </a>
    </li>
  )
}

function Skeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading answer">
      <div className="max-w-[62ch] space-y-3">
        {['70%', '100%', '94%', '88%', '96%', '60%'].map((w, i) => <div key={i} className="shimmer h-4 rounded" style={{ width: w }} />)}
      </div>
      <div className="flex flex-wrap gap-2">{[88, 120, 96, 110, 80].map((w, i) => <div key={i} className="shimmer h-8 rounded-md" style={{ width: w }} />)}</div>
    </div>
  )
}

// ------------------------------------------------------------------ tabs
function AnswerTab({ a, focalDomain, onBrand }) {
  const ownCount = a.sources.filter((x) => x.domain === focalDomain).length
  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5 text-[13px] leading-[18px] font-medium text-stone-600">
        <PlatformIcon id={a.engine} size={14} />{engineName(a.engine)}’s answer
      </div>
      <section aria-label="The answer"><AnswerText units={a.units} brands={a.brands} onBrand={onBrand} /></section>
      <section className="mt-8 border-t border-[var(--div)] pt-6">
        <div className="mb-2 flex items-baseline gap-2">
          <h3 className="text-[14px] leading-5 font-semibold text-stone-900">Sources</h3>
          <span className="text-[13px] leading-[18px] text-stone-500 tabular-nums">{a.sources.length} cited{a.sources.length > 0 && !ownCount ? ' · none from your site' : ''}</span>
        </div>
        {a.sources.length
          ? <ul className="divide-y divide-[var(--div)]">{a.sources.map((x) => <SourceRow key={x.domain + x.path} s={x} prompt={a.prompt} own={x.domain === focalDomain} />)}</ul>
          : <p className="text-[13px] leading-[18px] text-stone-500">This answer cites no sources.</p>}
      </section>
    </div>
  )
}

// ------------------------------------------------------------------ What changed
// Two views (Summary · Answer), state in the URL: ?changes=summary|answer&diff=changes|full (?view= is the dashboard's).
const CHANGES_KEYS = ['changes', 'diff']
const readChanges = () => {
  const q = new URLSearchParams(window.location.search)
  return { view: q.get('changes') === 'answer' ? 'answer' : 'summary', mode: q.get('diff') === 'full' ? 'full' : 'changes' }
}
function writeChanges(v) {
  const url = new URL(window.location.href)
  CHANGES_KEYS.forEach((k) => url.searchParams.delete(k))
  if (v) { url.searchParams.set('changes', v.view); if (v.view === 'answer') url.searchParams.set('diff', v.mode) }
  window.history.replaceState(window.history.state, '', url)
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const siteName = (domain) => brandName(domain)

// "Dermasuri is newly mentioned. 1 brand and 4 sources were added, 2 brands and 1 source dropped, and about half the answer was rewritten."
function changeSentence(c, cur, name) {
  const first = {
    still: `${name} is still mentioned.`,
    new: `${name} is newly mentioned.`,
    lost: `${name} is no longer mentioned.`,
    none: `${name} still isn’t mentioned.`,
  }[c.visibility]
  // a rank that moved, when both answers rank the brand
  const { before, now } = c.position ?? {}
  const rank = c.visibility === 'still' && before && now && before !== now ? ` It now ranks ${ordinal(now)} (was ${ordinal(before)}).` : ''
  const bA = c.brandsNew.length, sA = c.sourcesNew.length, bD = c.brandsDropped.length, sD = c.sourcesDropped.length
  const both = (b, s) => [b && plural(b, 'brand'), s && plural(s, 'source')].filter(Boolean).join(' and ')
  const parts = []
  if (bA || sA) parts.push(`${both(bA, sA)} ${bA + sA === 1 ? 'was' : 'were'} added`)
  if (bD || sD) parts.push(bD && bD === sD && bA + sA ? `${bD} of each dropped` : `${both(bD, sD)} ${bA + sA ? '' : bD + sD === 1 ? 'was ' : 'were '}dropped`)
  const r = c.rewritten
  const how = r <= 5 ? 'a few words of the answer changed' : r < 20 ? 'a little of the answer was rewritten' : r < 40 ? 'about a third of the answer was rewritten'
    : r < 60 ? 'about half the answer was rewritten' : r < 85 ? 'most of the answer was rewritten' : 'almost all of the answer was rewritten'
  if (r > 0) parts.push(how)
  if (!parts.length) return first + rank
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}` : parts[0]
  return `${first}${rank} ${list.charAt(0).toUpperCase()}${list.slice(1)}.`
}

// one list style for brands and sources: added (ink plus) first, then dropped (tint minus)
function ChangeRow({ kind, logo, name, meta, href }) {
  const added = kind === 'added'
  return (
    <li>
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="group -mx-2 flex h-11 items-center gap-3 rounded-md px-2 outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-focus">
        <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${added ? 'bg-[var(--ink)] text-[var(--color-surface)]' : 'bg-[var(--tint)] text-stone-500'}`} aria-hidden>
          {added ? <Plus size={10} strokeWidth={3} /> : <Minus size={10} strokeWidth={3} />}
        </span>
        {logo}
        <span className={`shrink-0 text-[14px] leading-5 font-medium ${added ? 'text-stone-900' : 'text-stone-600'}`}>{name}</span>
        {meta && <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] text-stone-500">{meta}</span>}
        <span className={`ml-auto shrink-0 text-[12px] leading-4 ${added ? 'font-medium text-stone-900' : 'text-stone-500'}`}>{added ? 'Added' : 'Dropped'}</span>
        <ArrowUpRight size={14} className="shrink-0 text-stone-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100 touch:opacity-100 group-focus-visible:opacity-100" aria-hidden />
      </a>
    </li>
  )
}
const Section = ({ title, count, children }) => (
  <section>
    <div className="mb-2 flex items-baseline gap-2">
      <h3 className="text-[14px] leading-5 font-semibold text-stone-900">{title}</h3>
      <span className="text-[13px] leading-[18px] text-stone-500 tabular-nums">{plural(count, 'change')}</span>
    </div>
    <ul className="divide-y divide-[var(--div)]">{children}</ul>
  </section>
)

function SummaryView({ c }) {
  const logo = (domain, name) => <SiteLogo domain={domain} name={name} className="h-5 w-5 rounded-md" imgPad="p-0.5" initialClass="text-[10px]" />
  const brandHref = (b) => (b.domain ? `https://${b.domain}` : `https://www.google.com/search?q=${encodeURIComponent(b.name)}`)
  const brands = [...c.brandsNew.map((b) => ['added', b]), ...c.brandsDropped.map((b) => ['dropped', b])]
  const sources = [...c.sourcesNew.map((x) => ['added', x]), ...c.sourcesDropped.map((x) => ['dropped', x])]
  return (
    <div className="space-y-8">
      {brands.length > 0 && (
        <Section title="Brands" count={brands.length}>
          {brands.map(([kind, b]) => <ChangeRow key={kind + b.name} kind={kind} logo={logo(b.domain, b.name)} name={b.name} href={brandHref(b)} />)}
        </Section>
      )}
      {sources.length > 0 && (
        <Section title="Sources" count={sources.length}>
          {sources.map(([kind, x]) => <ChangeRow key={kind + x.domain + x.path} kind={kind} logo={logo(x.domain, siteName(x.domain))} name={siteName(x.domain)} meta={x.path} href={`https://${x.domain}${x.path}`} />)}
        </Section>
      )}
    </div>
  )
}

// answer text with the focal brand in semibold ink; other brands plain (no pills, no underlines)
function Plain({ text, focalName }) {
  const t = text.replace(/\*\*/g, '')
  if (!focalName || !t.includes(focalName)) return t
  return t.split(focalName).flatMap((part, i) => (i ? [<span key={i} className="font-semibold text-stone-900">{focalName}</span>, part] : [part]))
}
// a block's units as text: headings, a paragraph, or bullet lines
function BlockText({ units, focalName, className = '' }) {
  if (!units.length) return null
  const k = units[0].kind
  if (k === 'h2' || k === 'h3') return <div className={`font-semibold ${className}`}><Plain text={units.map((u) => u.text).join(' ')} focalName={focalName} /></div>
  if (k === 'li') return <ul className={`list-disc space-y-0.5 pl-5 ${className}`}>{units.map((u, i) => <li key={i}><Plain text={u.text} focalName={focalName} /></li>)}</ul>
  return <p className={className}><Plain text={units.map((u) => u.text).join(' ')} focalName={focalName} /></p>
}
// diff units → blocks in reading order: { block, kind, now: units (same+add), before: units (same+del), changed }
// grouped by section (not adjacency: the sentence diff can interleave removed and added text across sections)
function diffBlocks(diff) {
  const byKey = new Map()
  diff.forEach((u) => {
    const k = `${u.block}:${u.kind.startsWith('h') ? 'h' : 'b'}`
    let b = byKey.get(k)
    if (!b) { b = { block: u.block, kind: u.kind, now: [], before: [], changed: false }; byKey.set(k, b) }
    if (u.op !== 'del') b.now.push(u)
    if (u.op !== 'add') b.before.push(u)
    if (u.op !== 'same') b.changed = true
  })
  // reading order: by section, a heading before its body
  return [...byKey.entries()].sort(([x], [y]) => parseFloat(x) - parseFloat(y) || (x.endsWith('h') ? -1 : 1)).map(([, b]) => b)
}

function ChangesOnly({ c, focalName }) {
  const [open, setOpen] = useState(() => new Set())
  const blocks = diffBlocks(c.diff)
  // runs of unchanged blocks collapse into one "N unchanged sections" row
  const runs = []
  blocks.forEach((b, i) => {
    const last = runs.at(-1)
    if (!b.changed && last?.unchanged) last.blocks.push(b)
    else runs.push(b.changed ? { changed: b, id: i } : { unchanged: true, blocks: [b], id: i })
  })
  const text = 'text-[15px] leading-[1.6] text-stone-900'
  return (
    <div className="max-w-[62ch] space-y-3">
      {runs.map((r) => {
        if (r.unchanged) {
          if (open.has(r.id)) return <div key={r.id} className="space-y-3">{r.blocks.map((b, i) => <BlockText key={i} units={b.now} focalName={focalName} className={text} />)}</div>
          return (
            <button key={r.id} type="button" onClick={() => setOpen((s) => new Set(s).add(r.id))}
              className="flex h-8 items-center gap-1 rounded text-[13px] leading-[18px] text-stone-500 outline-none transition-colors duration-150 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
              {plural(r.blocks.length, 'unchanged section')} <ChevronDown size={14} aria-hidden />
            </button>
          )
        }
        const b = r.changed
        const added = b.now.length && !b.before.length
        const removed = b.before.length && !b.now.length
        if (removed) {
          return (
            <div key={r.id}>
              <div className="mb-0.5 text-[12px] leading-4 font-medium text-stone-500">Removed</div>
              <BlockText units={b.before} focalName={focalName} className="text-[13px] leading-5 text-stone-500 line-through" />
            </div>
          )
        }
        return (
          <div key={r.id}>
            <div className="rounded-r-md bg-[var(--tint)] py-1.5 pl-3 pr-2 shadow-[inset_2px_0_0_var(--ink)]">
              {added && <div className="mb-0.5 text-[12px] leading-4 font-medium text-stone-500">New</div>}
              <BlockText units={b.now} focalName={focalName} className={text} />
            </div>
            {!added && (
              <div className="mt-1 pl-3">
                <span className="text-[12px] leading-4 font-medium text-stone-500">Before: </span>
                <BlockText units={b.before} focalName={focalName} className="inline text-[13px] leading-5 !font-normal text-stone-500 [&>li]:list-none" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// side by side, one grid row per section so matching paragraphs line up; changed rows tinted on both sides
function FullAnswers({ cur, prev, focalName }) {
  const byBlock = (units) => {
    const m = new Map()
    units.forEach((u) => { const k = `${u.block}:${u.kind.startsWith('h') ? 'h' : 'b'}`; if (!m.has(k)) m.set(k, []); m.get(k).push(u) })
    return m
  }
  const a = byBlock(cur.units), b = byBlock(prev.units)
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => parseFloat(x) - parseFloat(y) || (x.endsWith('h') ? -1 : 1))
  const same = (x = [], y = []) => x.map((u) => u.text).join('|') === y.map((u) => u.text).join('|')
  const text = 'text-[14px] leading-[1.6] text-stone-900'
  // phones: one version at a time behind a [Oct 5 | Sep 16] toggle; changed sections stay tinted
  const mobile = useIsMobile()
  const [side, setSide] = useState('cur')
  if (mobile) {
    const units = side === 'cur' ? a : b
    return (
      <div>
        <Segmented full label="Answer version" value={side} onChange={setSide} options={[{ value: 'cur', label: short(cur.date) }, { value: 'prev', label: short(prev.date) }]} />
        <div className="mt-3 flex flex-col gap-1">
          {keys.map((k) => (
            <div key={k} className={`rounded-md px-2 py-1.5 ${!same(a.get(k), b.get(k)) ? 'bg-[var(--tint)]' : ''}`}><BlockText units={units.get(k) ?? []} focalName={focalName} className={text} /></div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-x-4">
      {[short(cur.date), short(prev.date)].map((d) => (
        <div key={d} className="sticky top-0 z-[1] bg-[var(--color-surface)] py-2 text-[13px] leading-[18px] font-medium text-stone-600">{d}</div>
      ))}
      {keys.map((k) => {
        const changed = !same(a.get(k), b.get(k))
        const cell = `rounded-md px-2 py-1.5 ${changed ? 'bg-[var(--tint)]' : ''}`
        return (
          <Fragment key={k}>
            <div className={cell}><BlockText units={a.get(k) ?? []} focalName={focalName} className={text} /></div>
            <div className={cell}><BlockText units={b.get(k) ?? []} focalName={focalName} className={text} /></div>
          </Fragment>
        )
      })}
    </div>
  )
}

// state = { view, mode } lives in the drawer (so it survives the loading skeleton), mirrored to the URL there
// The syncs to compare with are the ones that stored an answer for this prompt on this engine (loadAnswerHistory),
// before the one shown; by default the one just before it. With none, there's nothing to compare yet.
function ChangesTab({ a, prevDate, setPrevDate, focalDomain, focalName, state, setState }) {
  const [hist, setHist] = useState(null) // { dates } newest first, or { error }
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let off = false
    setHist(null)
    loadAnswerHistory(a.key, a.engine).then((h) => !off && setHist(h), (e) => !off && setHist({ error: e?.message || 'The earlier answers couldn’t load.' }))
    return () => { off = true }
  }, [a.key, a.engine, attempt])
  if (!hist) return <Skeleton />
  if (hist.error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center text-[14px] leading-5 text-stone-600">
        {hist.error}
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="rounded font-medium text-ink underline underline-offset-4 outline-none hover:opacity-75 focus-visible:ring-2 focus-visible:ring-focus">Retry</button>
      </div>
    )
  }
  const at = Date.parse(a.date)
  const earlier = hist.dates.filter((d) => Date.parse(d) < at)
  if (!earlier.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-tint text-stone-600"><History size={18} aria-hidden /></span>
        <p className="text-[14px] leading-5 font-medium text-stone-900">Not enough history yet</p>
        <p className="max-w-[44ch] text-[14px] leading-5 text-stone-600">This is the first answer stored for this prompt on {engineName(a.engine)}. Changes show here after the next sync.</p>
      </div>
    )
  }
  const shownPrev = earlier.includes(prevDate) ? prevDate : earlier[0]
  return <ChangesView a={a} prevDate={shownPrev} earlier={earlier} setPrevDate={setPrevDate} focalDomain={focalDomain} focalName={focalName} state={state} setState={setState} />
}

function ChangesView({ a, prevDate, earlier, setPrevDate, focalDomain, focalName, state, setState }) {
  const prev = getAnswer(a.key, a.engine, prevDate, focalDomain)
  const c = compareAnswers(a, prev)

  return (
    <div>
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3 pt-0">
        <div className="flex items-center gap-2 text-[13px] leading-[18px] text-stone-600">
          {short(a.date)} vs
          <span className="relative inline-flex">
            <select aria-label="Compare with sync" value={prevDate} onChange={(e) => setPrevDate(e.target.value)}
              className="h-8 cursor-pointer appearance-none rounded-md border border-line bg-raised pl-3 pr-8 text-[13px] font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus">
              {earlier.map((d) => <option key={d} value={d}>{short(d)}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden />
          </span>
        </div>
        <Segmented label="What changed view" size="sm" value={state.view} onChange={(v) => setState((s) => ({ ...s, view: v }))}
          options={[{ value: 'summary', label: 'Summary' }, { value: 'answer', label: 'Answer' }]} />
      </div>

      {c.unchanged ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-tint text-stone-600"><Check size={18} aria-hidden /></span>
          <p className="text-[14px] leading-5 text-stone-600">No changes since {short(prevDate)}</p>
        </div>
      ) : (
        <>
          <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.55] text-stone-900">{changeSentence(c, a, focalName)}</p>
          <div className="mt-6">
            {state.view === 'summary' ? <SummaryView c={c} /> : (
              <>
                <div className="mb-3 flex justify-end">
                  <Segmented label="Answer diff" size="sm" value={state.mode} onChange={(v) => setState((s) => ({ ...s, mode: v }))}
                    options={[{ value: 'changes', label: 'Changes only' }, { value: 'full', label: 'Full answers' }]} />
                </div>
                {state.mode === 'changes' ? <ChangesOnly c={c} focalName={focalName} /> : <FullAnswers cur={a} prev={prev} focalName={focalName} />}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ drawer
export default function AnswerDrawer() {
  const { focal: pageFocal, engine: engineFilter, setView } = useBrandView()
  const tracking = useTracking()
  const engines = tracking.platforms.filter((p) => p.enabled)
  const [state, setState] = useState(() => {
    const { key, engine } = readUrl()
    return key ? { key, engine, list: null } : null
  })
  const focal = (state?.brand && brandByDomain(state.brand)) || pageFocal
  const [shown, setShown] = useState(false) // drives the slide-in
  // a link with ?changes= (What changed state) opens on that tab
  const [tab, setTab] = useState(() => (new URLSearchParams(window.location.search).has('changes') ? 'changes' : 'answer'))
  const [changesState, setChangesState] = useState(readChanges) // What changed: { view: summary|answer, mode: changes|full }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(() => import.meta.env.DEV && new URLSearchParams(window.location.search).has('answerError'))
  const [prevDate, setPrevDate] = useState(null) // null: the sync before the one shown (What changed)
  const panel = useRef(null)
  const opener = useRef(null)
  const bodyRef = useRef(null)

  const open = state != null
  const key = state?.key
  // default engine: the dashboard's engine filter, else the first engine that mentions the focal brand
  const engine = useMemo(() => {
    if (!key) return null
    if (state.engine && engines.some((e) => e.id === state.engine)) return state.engine
    if (engineFilter !== 'all' && engines.some((e) => e.id === engineFilter)) return engineFilter
    return engines.find((e) => getAnswer(key, e.id, LATEST, focal.domain)?.visible)?.id ?? engines[0]?.id
  }, [key, state?.engine, engineFilter, engines, focal.domain]) // eslint-disable-line react-hooks/exhaustive-deps
  const at = state?.date ?? LATEST
  const a = key && engine ? getAnswer(key, engine, at, focal.domain) : null
  const list = state?.list ?? (key ? getBrandView(focal.domain).visiblePrompts.map((r) => (typeof r.id === 'number' ? `v${r.id}` : r.id)) : [])
  const idx = list.indexOf(key)

  useEffect(() => {
    const on = (e) => {
      opener.current = e.detail.opener ?? document.activeElement
      const date = ANSWER_SYNCS.includes(e.detail.date) ? e.detail.date : null
      setState({ key: e.detail.key, list: e.detail.list, engine: e.detail.engine, back: e.detail.back, brand: e.detail.brand, date })
      // compare with the sync before the one shown
      setPrevDate(null)
      setTab('answer')
    }
    // Back: the URL no longer has ?answer → close (e.g. Back while it stands in for the Engine drawer)
    const pop = () => { if (!readUrl().key) setState(null) }
    window.addEventListener(EVENT, on)
    window.addEventListener('popstate', pop)
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener('popstate', pop) }
  }, [])
  useEffect(() => { writeUrl(open ? key : null, engine) }, [open, key, engine])
  useEffect(() => { if (open) writeChanges(tab === 'changes' ? changesState : null) }, [open, tab, changesState])
  // mock fetch per prompt/engine
  useEffect(() => {
    if (!open) return
    setLoading(true)
    const t = setTimeout(() => setLoading(false), LOAD_MS)
    bodyRef.current?.scrollTo?.(0, 0)
    return () => clearTimeout(t)
  }, [open, key, engine])
  // slide in after mount
  useLayoutEffect(() => {
    if (!open) { setShown(false); return }
    if (state.back) { setShown(true); return } // swapped in for the Engine drawer: already on screen
    const r = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(r)
  }, [open])
  useEffect(() => { if (open && shown) panel.current?.focus() }, [open, shown, key])

  const back = state?.back
  const close = useCallback(() => {
    setShown(false)
    setTimeout(() => {
      setState(null)
      if (back) back.onClose()
      else opener.current?.focus?.()
    }, reduced() ? 0 : 200)
  }, [back])
  const goBack = () => { setState(null); setShown(false); back.onBack() }
  const move = useCallback((step) => {
    if (idx === -1) return
    const next = list[idx + step]
    if (next) setState((s) => ({ ...s, key: next, engine: s.engine }))
  }, [idx, list])

  // Esc / ↑ / ↓ / focus trap
  const onKeyDown = (e) => {
    const tag = e.target.tagName
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && tag !== 'SELECT' && !e.target.closest('[role=tablist], [role=radiogroup]')) { e.preventDefault(); move(e.key === 'ArrowDown' ? 1 : -1) }
    else if (e.key === 'Tab') {
      const f = [...panel.current.querySelectorAll('button:not([disabled]), a[href], select, [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }
  const onEngineKey = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const i = engines.findIndex((x) => x.id === engine)
    const next = engines[(i + step + engines.length) % engines.length]
    setState((s) => ({ ...s, engine: next.id }))
    requestAnimationFrame(() => panel.current?.querySelector(`[data-engine="${next.id}"]`)?.focus())
  }

  if (!open || !a) return null
  const own = focal.domain === OWN.domain
  const iconBtn = 'grid h-7 w-7 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-40'
  const status = (ok, Icon, text) => (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={14} className={ok ? 'text-stone-900' : 'text-stone-500'} aria-hidden />{text}
    </span>
  )
  // "Ranked 1st of 5" → the brand list in the answer, with one pulse on the focal brand
  const jumpToRank = () => {
    const go = () => {
      const el = bodyRef.current?.querySelector('[data-focal-brand]')
      if (!el) return
      el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' })
      el.classList.remove('focal-pulse'); void el.offsetWidth; el.classList.add('focal-pulse')
    }
    if (tab !== 'answer' || loading) { setTab('answer'); setTimeout(go, LOAD_MS + 50) } else go()
  }
  // a tracked brand in the answer → see the dashboard as that brand
  const viewBrand = (b) => { close(); setView(b.domain) }

  return (
    <div className="fixed inset-0 z-50" onKeyDown={onKeyDown}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity duration-[250ms] ease-out motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`} onClick={close} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`AI answer: ${a.prompt}`}
        tabIndex={-1}
        className={`${SHEET_BASE} ${back ? 'md:w-[min(720px,100vw)]' : 'md:w-[min(760px,100vw)]'} ${shown ? SHEET_IN : SHEET_OUT}`}
      >
        <SheetHandle panelRef={panel} onClose={close} />
        {/* header */}
        <header className="shrink-0 border-b border-line px-6 pb-0 pt-5">
          {back && (
            <button type="button" onClick={goBack}
              className="-ml-2 mb-3 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
              <ArrowLeft size={14} aria-hidden />{back.label}
            </button>
          )}
          <div className="flex items-center justify-between gap-3">
            <div role="tablist" aria-label="Engine" onKeyDown={onEngineKey} className="inline-flex h-8 min-w-0 items-center overflow-x-auto rounded-lg bg-tint p-0.5 [scrollbar-width:none]">
              {engines.map((e) => {
                const on = e.id === engine
                return (
                  <button key={e.id} data-engine={e.id} type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1}
                    onClick={() => setState((s) => ({ ...s, engine: e.id }))}
                    className={`inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] leading-[18px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'bg-raised text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}>
                    <PlatformIcon id={e.id} size={14} />{e.name}
                  </button>
                )
              })}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <a href={LIVE[engine]?.(a.prompt)} target="_blank" rel="noopener noreferrer"
                className="mr-1 hidden h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[13px] leading-[18px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus sm:inline-flex">
                Check live <ArrowUpRight size={14} aria-hidden />
              </a>
              <button type="button" className={iconBtn} onClick={() => move(-1)} disabled={idx <= 0} aria-label="Previous prompt" title="Previous prompt (↑)"><ChevronUp size={16} /></button>
              <button type="button" className={iconBtn} onClick={() => move(1)} disabled={idx === -1 || idx >= list.length - 1} aria-label="Next prompt" title="Next prompt (↓)"><ChevronDown size={16} /></button>
              <button type="button" className={iconBtn} onClick={close} aria-label="Close"><X size={16} /></button>
            </div>
          </div>

          <h2 className="mt-3 text-[20px] leading-7 font-semibold text-stone-900">{a.prompt}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] leading-[18px] text-stone-600">
            {status(a.visible, a.visible ? Check : X, a.visible ? 'Mentioned' : 'Not mentioned')}
            {status(a.cited, a.cited ? Check : X, a.cited ? 'Linked' : 'Not linked')}
            {a.position && (
              <button type="button" onClick={jumpToRank} title={`Show ${focal.name} in the answer`}
                className="inline-flex items-center gap-1.5 rounded outline-none transition-colors duration-150 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
                <Hash size={14} className="text-stone-900" aria-hidden />Ranked {ordinal(a.position)} of {a.brands.length}
              </button>
            )}
            <span className="ml-auto text-[12px] leading-4 text-stone-500">{state.date ? `Sync of ${short(state.date)}` : `Updated ${fmtDay(tracking.schedule.lastSync)}`}</span>
          </div>

          <div role="tablist" aria-label="Answer views" className="mt-4 flex gap-6">
            {[['answer', 'Answer'], ['changes', 'What changed']].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 text-[14px] leading-5 font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${tab === id ? 'border-ink text-stone-900' : 'border-transparent text-stone-600 hover:text-stone-900'}`}>
                {label}
              </button>
            ))}
          </div>
        </header>

        {/* body */}
        <div ref={bodyRef} className={`min-h-0 flex-1 overflow-y-auto px-6 pb-10 ${tab === 'answer' ? 'pt-6' : 'pt-5'}`}>
          {error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-[14px] leading-5 text-stone-600">
              Couldn’t load this answer
              <button type="button" onClick={() => setError(false)} className="rounded font-medium text-ink underline underline-offset-4 outline-none hover:opacity-75 focus-visible:ring-2 focus-visible:ring-focus">Retry</button>
            </div>
          ) : loading ? <Skeleton /> : tab === 'answer'
            ? <AnswerTab a={a} focalDomain={focal.domain} onBrand={viewBrand} />
            : <ChangesTab a={a} prevDate={prevDate} setPrevDate={setPrevDate} focalDomain={focal.domain} focalName={focal.name} state={changesState} setState={setChangesState} />}
        </div>
        <div className="sr-only" aria-live="polite">{`${engineName(engine)} answer for ${a.prompt}`}</div>
      </div>
    </div>
  )
}
