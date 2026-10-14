import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpRight, Check, ChevronDown, Code2, Copy, Eye, FileText, Package, Sparkles, Star, Wrench } from 'lucide-react'
import DrawerShell, { Dot, useDrawer } from '../audit/DrawerShell'
import { ImpactMeter, useParams } from '../audit/parts'
import { useToast } from '../dashboard/overlays'
import { SD, crawlActions } from '../../data/structuredData'
import { IMPORTANCE, KINDS, analyze, isPageType } from './analyze'
import { StatusLabel, markPending, usePending } from './parts'

// a section to scroll to when the drawer opens (the Schemas table's "2 warnings" → Issues)
let pendingSection = null
export const setSchemaSection = (section) => { pendingSection = section ?? null }

const DEFAULT_HOW = ['Paste the snippet into the page’s `<head>`.', 'Replace the example values with the ones shown on the page.', 'Re-run the analysis to check it validates.']
const PREVIEW = 5
const lineBtn = 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
const inkBtn = 'inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-[13px] font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'
const scriptTag = (json) => `<script type="application/ld+json">\n${json}\n</script>`

// "Paste … `<head>`" → text with inline code
function Rich({ text }) {
  return text.split(/`([^`]+)`/).map((part, i) => (i % 2
    ? <code key={i} className="rounded bg-tint px-1 font-mono text-[13px] text-stone-900">{part}</code>
    : part))
}

// a section: 28px tint box + icon, title 14/600; body indented under the title (same as the Site Audit check drawer)
function Section({ icon: Icon, title, id, children }) {
  return (
    <section id={id} className="scroll-mt-4 py-5">
      <h3 className="flex items-center gap-3 text-[14px] leading-5 font-semibold text-stone-900">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-tint text-stone-700" aria-hidden><Icon size={16} /></span>
        {title}
      </h3>
      <div className="mt-2 pl-10 text-[14px] leading-[1.6] text-stone-600">{children}</div>
    </section>
  )
}

// JSON with a light tint: keys ink, string values t2, punctuation t3, numbers / literals ink
function Json({ text }) {
  const out = []
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|([{}[\],])|(-?\d+(?:\.\d+)?|true|false|null)/g
  let last = 0, m
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) {
      out.push(<span key={m.index} className={m[2] ? 'text-stone-900' : 'text-stone-600'}>{m[1]}</span>)
      if (m[2]) out.push(<span key={`${m.index}c`} className="text-stone-500">{m[2]}</span>)
    } else if (m[3]) out.push(<span key={m.index} className="text-stone-500">{m[3]}</span>)
    else out.push(<span key={m.index} className="text-stone-900">{m[4]}</span>)
    last = re.lastIndex
  }
  out.push(text.slice(last))
  return out
}

// ---- "What it unlocks": how the page could look in an answer once the schema is added, filled from the snippet
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const shortDay = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
// schema ids are the schema type, lower-cased (analyze.js)
const PRODUCTISH = ['product', 'aggregaterating', 'offer', 'brand', 'imageobject']

function FaqRow({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <li>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-2 text-left text-[14px] leading-5 font-medium text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-focus">
        {q}<ChevronDown size={14} className={`shrink-0 text-stone-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && <p className="pb-2 text-[13px] leading-[18px] text-stone-600">{a}</p>}
    </li>
  )
}

function Preview({ item }) {
  let d = {}
  try { d = JSON.parse(item.snippet) } catch { /* show the default card */ }
  const id = item.schemaId ?? item.id
  let card
  if (id === 'event') {
    const date = new Date(d.startDate)
    const time = Number.isNaN(+date) ? '' : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    card = (
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-content-center rounded-md border border-line text-center leading-none">
          <span className="text-[11px] font-semibold text-stone-500">{MONTHS[date.getMonth()] ?? '—'}</span>
          <span className="mt-0.5 text-[18px] font-semibold text-stone-900 tabular-nums">{date.getDate() || ''}</span>
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{d.name}</span>
          <span className="block truncate text-[13px] leading-[18px] text-stone-600">{d.location?.name}{time && ` · ${time}`}</span>
        </span>
      </div>
    )
  } else if (PRODUCTISH.includes(id) || d['@type'] === 'Product') {
    const offer = d.offers ?? (d['@type'] === 'Offer' ? d : null)
    const rating = Number(d.aggregateRating?.ratingValue ?? 4.6)
    const count = d.aggregateRating?.reviewCount ?? 212
    const price = Number(offer?.price ?? 34)
    card = (
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-tint text-stone-500" aria-hidden><Package size={18} /></span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{d.name ?? 'Vitamin C Serum 15%'}</span>
          <span className="mt-0.5 flex items-center gap-1 text-[13px] leading-[18px] text-stone-600 tabular-nums">
            <span className="flex text-ink" role="img" aria-label={`${rating} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={12} className={n <= Math.floor(rating) ? 'fill-current' : 'text-stone-300'} aria-hidden />)}
            </span>
            {rating.toFixed(1)} ({count}) · ${price % 1 ? price.toFixed(2) : price} · In stock
          </span>
        </span>
      </div>
    )
  } else if (id === 'faqpage') {
    card = (
      <ul className="-my-1 divide-y divide-[var(--div)]">
        {(d.mainEntity ?? []).slice(0, 2).map((x) => <FaqRow key={x.name} q={x.name} a={x.acceptedAnswer?.text} />)}
      </ul>
    )
  } else if (id === 'article') {
    const updated = shortDay(d.dateModified ?? d.datePublished)
    card = (
      <div>
        <div className="text-[14px] leading-5 font-medium text-stone-900">{d.headline}</div>
        <div className="mt-0.5 text-[12px] leading-4 text-stone-500">By {d.author?.name}{updated && ` · Updated ${updated}`}</div>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-[18px] text-stone-600">{d.description}</p>
      </div>
    )
  } else if (id === 'breadcrumblist') {
    const trail = (d.itemListElement ?? []).map((x) => x.name)
    card = (
      <div className="flex flex-wrap items-center gap-1.5 text-[13px] leading-[18px] text-stone-600">
        {trail.map((t, i) => <span key={t} className="inline-flex items-center gap-1.5">{i > 0 && <span className="text-stone-400" aria-hidden>›</span>}<span className={i === trail.length - 1 ? 'font-medium text-stone-900' : ''}>{t}</span></span>)}
      </div>
    )
  } else if (id === 'howto') {
    card = (
      <div>
        <div className="text-[14px] leading-5 font-medium text-stone-900">{d.name}</div>
        <ol className="mt-1.5 flex flex-col gap-1">
          {(d.step ?? []).map((st, i) => <li key={st.name} className="text-[13px] leading-[18px] text-stone-600"><span className="font-semibold text-stone-900 tabular-nums">{i + 1}.</span> <span className="font-medium text-stone-900">{st.name}:</span> {st.text}</li>)}
        </ol>
      </div>
    )
  } else {
    // default: the 3–4 main fields
    const show = (v) => (Array.isArray(v) ? v.map((x) => (typeof x === 'object' ? x.name ?? x.url ?? x['@type'] : x)).join(', ') : typeof v === 'object' ? v.name ?? v.streetAddress ?? v['@type'] : v)
    const fields = Object.entries(d).filter(([k]) => !k.startsWith('@')).slice(0, 4)
    card = (
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13px] leading-[18px]">
        {fields.map(([k, v]) => <div key={k} className="contents"><dt className="text-stone-500">{k}</dt><dd className="truncate text-stone-900">{String(show(v))}</dd></div>)}
      </dl>
    )
  }
  return (
    <>
      <div className="rounded-lg border border-line bg-surface p-4">{card}</div>
      <p className="mt-1.5 text-[12px] leading-4 text-stone-500">Example of how engines can show this page</p>
    </>
  )
}

// first path segment, for grouping long page lists
const sectionOf = (p) => (p.split('/')[1] ? `/${p.split('/')[1]}` : '/')
function PageRows({ paths }) {
  const [all, setAll] = useState(false)
  const shown = all ? paths : paths.slice(0, PREVIEW)
  const groups = []
  for (const p of shown) {
    const k = sectionOf(p)
    const g = groups.find((x) => x.k === k)
    if (g) g.paths.push(p); else groups.push({ k, paths: [p] })
  }
  const row = (p) => (
    <li key={p}>
      <a href={`https://${SD.domain}${p}`} target="_blank" rel="noreferrer"
        className="group -mx-2 flex h-10 items-center gap-2 rounded-md px-2 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
        <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-stone-900">{p}</span>
        <ArrowUpRight size={14} className="shrink-0 text-stone-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100 touch:opacity-100 group-focus-visible:opacity-100" aria-hidden />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </li>
  )
  return (
    <>
      {/* grouped by path prefix once there are more than 5 */}
      {paths.length > PREVIEW ? groups.map((g) => (
        <div key={g.k} className="mt-2 first:mt-0">
          <div className="text-[13px] leading-[18px] font-semibold text-stone-600 tabular-nums">{g.k} <span className="font-normal text-stone-500">{paths.filter((p) => sectionOf(p) === g.k).length}</span></div>
          <ul>{g.paths.map(row)}</ul>
        </div>
      )) : <ul>{shown.map(row)}</ul>}
      {paths.length > PREVIEW && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all}
          className="mt-2 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
          {all ? 'Show fewer' : `Show all ${paths.length}`}
        </button>
      )}
    </>
  )
}

// Schema drawer (?schema=, pushed so Back closes it; ?schemaType= narrows it to one page type).
// Opens schema rows and Fix items alike (both come from the analysis for the current scope).
export default function SchemaDrawer({ result, scope }) {
  const q = useParams()
  const rawType = q.get('schemaType')
  const type = scope === 'site' && isPageType(rawType) ? rawType : null
  const typed = useMemo(() => (type ? analyze(null, type) : null), [type])
  const drawer = useDrawer('schema', (id) => (typed ?? result)?.find(id))
  const s = drawer.item
  const [copied, setCopied] = useState(false)
  const [toastNode, toast] = useToast({ position: 'center' })
  const pending = usePending()
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(false), 1500); return () => clearTimeout(t) }, [copied])
  useEffect(() => {
    if (!drawer.shown || !pendingSection) return
    const el = document.getElementById(`schema-${pendingSection}`)
    pendingSection = null
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [drawer.shown, s?.id])
  if (!s) return toastNode

  const fix = s.kind === 'fix'
  const valid = !fix && s.status === 'valid'
  const pages = valid ? s.found : s.affected
  const of = s.applicable
  const copy = () => { navigator.clipboard?.writeText(scriptTag(s.snippet)).catch(() => {}); setCopied(true) }
  const google = s.doc.includes('developers.google.com')
  const isPending = pending.has(s.id)
  const mark = () => { markPending(s.id); toast('We’ll check it on the next run') }
  const how = s.how ?? DEFAULT_HOW

  return (
    <>
      <DrawerShell
        drawer={drawer}
        title={s.name}
        meta={(
          <span className="flex flex-wrap items-center gap-3">
            <StatusLabel status={s.status} /><Dot />
            <span>{IMPORTANCE[s.importance]}</span><Dot />
            <ImpactMeter impact={s.impact} fixed={false} />
            {type && <><Dot /><span>{KINDS[type]}</span></>}
          </span>
        )}
        footer={(
          <>
            <a href={s.doc} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded text-[13px] text-stone-600 underline-offset-4 outline-none hover:text-stone-900 hover:underline focus-visible:ring-2 focus-visible:ring-focus">
              {google ? 'Google’s documentation' : 'schema.org reference'} <ArrowUpRight size={14} aria-hidden />
            </a>
            <span className="flex items-center gap-2">
              <button type="button" onClick={copy} className={lineBtn}>{copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}{copied ? 'Copied' : 'Copy snippet'}</button>
              {/* only where the app can save it */}
              {!valid && crawlActions.canMarkAdded && (
                <button type="button" onClick={mark} disabled={isPending} className={inkBtn}>
                  {isPending ? 'Pending check' : fix ? 'Mark as fixed' : 'Mark as added'}
                </button>
              )}
            </span>
          </>
        )}
      >
        {/* stat strip */}
        <div className="mt-5 grid grid-cols-2 divide-x divide-[var(--div)] rounded-lg bg-tint p-4">
          <div className="min-w-0 pr-4">
            <div className="text-[13px] leading-[18px] text-stone-600">{valid ? 'Pages with it' : fix ? 'Pages affected' : 'Pages missing it'}</div>
            <div className="mt-1 flex items-baseline gap-1.5 tabular-nums">
              <span className="text-[24px] leading-8 font-semibold text-stone-900">{pages.length}</span>
              <span className="text-[13px] leading-[18px] text-stone-500">of {of} {of === 1 ? 'page' : 'pages'}</span>
            </div>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[var(--data-track)]" aria-hidden>
              <span className="block h-full rounded-full bg-ink" style={{ width: `${of ? (pages.length / of) * 100 : 0}%` }} />
            </span>
          </div>
          <div className="min-w-0 pl-4">
            <div className="text-[13px] leading-[18px] text-stone-600">Applies to</div>
            <div className="mt-1 truncate text-[14px] leading-8 font-medium text-stone-900">{s.usedOn || '—'}</div>
            {pages[0] && <div className="truncate text-[13px] leading-[18px] text-stone-500">{pages[0]}{pages.length > 1 ? ` +${pages.length - 1}` : ''}</div>}
          </div>
        </div>

        <div className="mt-6 divide-y divide-[var(--div)] border-t border-[var(--div)]">
          <Section icon={Eye} title="What it unlocks"><Preview item={s} /></Section>
          <Section icon={Sparkles} title="Why it matters"><p>{s.why}</p></Section>
          {!valid && (
            <Section icon={Wrench} title={fix ? 'How to fix it' : 'How to add it'}>
              <ol>
                {how.map((step, i) => (
                  <li key={i} className="mb-3 flex gap-3 last:mb-0">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line text-[12px] leading-none font-semibold text-stone-700 tabular-nums">{i + 1}</span>
                    <span className="min-w-0 text-stone-900"><Rich text={step} /></span>
                  </li>
                ))}
              </ol>
            </Section>
          )}
          {s.warnings.length > 0 && (
            <Section id="schema-issues" icon={AlertTriangle} title={`Issues · ${s.warnings.length} ${s.warnings.length === 1 ? 'warning' : 'warnings'}`}>
              <ul className="flex flex-col gap-1.5">
                {s.warnings.map(([text, on]) => (
                  <li key={text} className="flex items-baseline justify-between gap-4 text-stone-900">
                    <span className="min-w-0">{text}</span>
                    <span className="shrink-0 text-[13px] text-stone-500 tabular-nums">{on.length} {on.length === 1 ? 'page' : 'pages'}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section icon={Code2} title="Snippet">
            <div className="overflow-hidden rounded-lg bg-tint">
              <div className="flex h-9 items-center justify-between border-b border-[var(--div)] pl-4 pr-1.5">
                <span className="text-[12px] leading-4 font-medium text-stone-500">JSON-LD</span>
                <button type="button" onClick={copy} aria-label={copied ? 'Copied' : 'Copy snippet'}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:bg-surface hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
                  {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}{copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="max-h-72 overflow-auto p-4 font-mono text-[13px] leading-6"><Json text={s.snippet} /></pre>
            </div>
          </Section>
          {pages.length > 0 && (
            <Section icon={FileText} title={`${valid ? 'Found on' : 'Affected pages'} · ${pages.length}`}>
              <PageRows key={s.id} paths={pages} />
            </Section>
          )}
        </div>
      </DrawerShell>
      {toastNode}
    </>
  )
}
