// Draft step v1: the finished draft, from content-recommend's response (data/contentRecommend.js), all derivations in
// draft/recommend.js. Two columns: the draft (8/12) and the rail (4/12, sticky).
//   Draft: the notes the response calls for (template draft, issues, brand facts), the H1 (28/600) with a "Needs expert
//     review" chip, then the shown sections (20/600 over a --line-strong rule; body 16/1.7): Direct answer in a tint
//     panel, Key points as ticks, Steps numbered, comparisons as 2–3 short lists side by side, FAQ questions, Sources as
//     favicon + domain rows. "Confirm with your team" lines end in an amber dot + chip; competitor names (the
//     request's) are underlined, "Remove before publishing" on hover. Page recommendation, Flags, Publishing notes and
//     the "Draft for client review" notice aren't shown (they're in Export .md).
//   Rail: Readiness (a ring, score-weighted from reviewScore) and the flags (label · text · status tag · score, by
//     score; ticks saved in this browser only) · coverage · Format gaps (recommendations + their pages) · Competitors to beat ·
//     Sources to outrank (citedPages) · Recommended page (pageRecommendation).
// SAFETY: the Markdown is parsed into a text-only tree (draft/markdown.js) and rendered as React text nodes; links are
// http(s) only, new tab, rel="noopener noreferrer". No dangerouslySetInnerHTML anywhere.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Info } from 'lucide-react'
import { PlatformIcon } from '../../../components/dashboard/icons'
import { ENGINE_NAME, engineIcon } from '../../../data/contentOpportunities'
import { formatLabel } from '../../../data/contentRecommend'
import SiteLogo from '../../../components/ui/SiteLogo'
import { DOTTED, LogoPlate, Ring, TwoSpotLines, siteName, withResults } from '../parts'
import { RingDraw, TickDraw } from '../workspace/ui'
import { competitorName } from '../../../data/contentRecommend'
import { COVERAGE_LABEL, beforeAfter, rankStrip, enginesOf, flagHost, outlineShort, upAgainstRows, competitorTerms, competitorsToBeat, confirmOf, draftNotes, draftSections, formatRows, pageOf, readinessOf, sortedFlags, sourcesOf, sourcesToOutrank, splitMentions, withComparisons } from './recommend'

const H2 = 'text-[20px] leading-7 font-semibold text-stone-900'
const BODY = 'text-[16px] leading-[1.7] text-stone-800'
const HEAD = 'flex items-end justify-between gap-3 border-b border-line pb-2 text-[15px] leading-[22px] font-semibold text-stone-900'
const META = 'text-[13px] leading-[18px] text-stone-500'
// the rail's hover cards: display none until hovered (motion-safe fade), so a hidden card never adds to the rail's
// scrollable overflow (an opacity-0 card did: the rail showed a scrollbar though its content fit)
const CARD = 'pointer-events-none absolute z-30 hidden rounded-md border border-line bg-raised px-2.5 py-2 text-[12px] leading-4 shadow-md motion-safe:animate-[fade-in_150ms_ease-out]'
const LINK = 'rounded font-medium text-ink underline decoration-[var(--color-line-strong)] underline-offset-[3px] outline-none hover:decoration-ink focus-visible:ring-2 focus-visible:ring-focus'

// arriving: the draft just replaced the writing skeleton: its sections fade in top to bottom (60ms apart)
// onRecheck: "Re-check score" (in the readiness section) · resolve: the 'ai' engine tag's engines for a host (R20)
export default function DraftView({ res, competitors, ticked, onTick, arriving = false, onRecheck, resolve }) {
  const terms = competitorTerms(competitors, competitorName)
  const { h1, intro, shown } = draftSections(res.contentMarkdown)
  const notes = draftNotes(res)
  const flags = sortedFlags(res.flags)
  const ready = readinessOf(flags, res.reviewScore, ticked)
  const extraIssues = notes.issues.filter((t) => !res.flags.some((f) => f.text === t))
  const article = useRef(null)
  // "Show in draft": the first mention of the host a Draft gap flag names (its host or display name), scrolled into
  // view in the panel's scroller and softly highlighted for 1.2s (reduced motion: no scroll animation, a static mark)
  const showInDraft = (host) => {
    const name = competitorName(host).toLowerCase()
    const hit = [...(article.current?.querySelectorAll('[data-mention], [data-host]') ?? [])]
      .find((el) => el.dataset.host === host || [host, name].includes((el.dataset.mention ?? '').toLowerCase()))
    if (!hit) return
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    hit.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' })
    hit.classList.remove('co-flash'); void hit.offsetWidth; hit.classList.add('co-flash')
    setTimeout(() => hit.classList.remove('co-flash'), 1300)
  }
  const rail = useRailFit()
  return (
    <div className="@container grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
      <article ref={article} className="min-w-0" aria-label="Draft">
        <Outline sections={shown} />
        <Notes notes={notes} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.015em] text-stone-900">{h1 ? <Inline inline={h1.inline} terms={terms} /> : res.prompt}</h1>
          {notes.expert && <span className="inline-flex items-center gap-1.5 text-[13px] leading-[18px] text-stone-500"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--negative)]" />Needs expert review</span>}
        </div>
        {/* contentIssues the flags don't already list (a Draft gap flag's text is the issue verbatim, so match by text) */}
        {extraIssues.length > 0 && (
          <p className="mt-2 text-[13px] leading-[18px] text-stone-500">{extraIssues.join(' · ')} · <button type="button" onClick={() => document.getElementById('co-draft-checks')?.scrollIntoView({ block: 'start' })} className="rounded font-medium text-stone-700 underline decoration-[var(--color-line-strong)] underline-offset-[3px] outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">See the checks</button></p>
        )}
        {intro.length > 0 && <div className="mt-5"><Blocks blocks={intro} terms={terms} /></div>}
        {shown.map((s, i) => <div key={s.title} id={`co-sec-${i}`} data-outline={outlineShort(s.title)} className="scroll-mt-[190px]" style={arriving ? { animation: `co-arrive-in 320ms cubic-bezier(.2,.8,.2,1) ${120 + i * 60}ms both` } : undefined}><Section section={s} terms={terms} competitors={competitors} /></div>)}
      </article>
      {/* the rail: sticky under the panel's header, as tall as the room between it and the footer; scrolls on its own
          with a thin overlay thumb (hover / while scrolling), no track, and no scrollbar at all when it fits (.co-rail) */}
      <div ref={rail.ref} onScroll={rail.onScroll} data-sb={rail.sb ? 'on' : undefined}
        className="co-rail min-w-0 max-w-full lg:sticky lg:top-[var(--co-rail-top,140px)] lg:max-h-[var(--co-rail-max,calc(100vh-300px))] lg:self-start lg:pr-1 lg:pb-4">
        <Rail res={res} flags={flags} ready={ready} ticked={ticked} onTick={onTick} competitors={competitors} onRecheck={onRecheck} onShow={showInDraft} resolve={resolve} arriving={arriving} />
      </div>
    </div>
  )
}

// the rail's sticky top and max height, from the panel's scroller: top = its header + 24px; max = what's left above the
// draft's sticky footer (less 16px). Re-measured when any of them resizes. sb: the thumb shows while scrolling (800ms).
function useRailFit() {
  const ref = useRef(null)
  const [sb, setSb] = useState(false)
  const t = useRef(0)
  useLayoutEffect(() => {
    const el = ref.current
    const scroller = el?.parentElement?.closest('.overflow-y-auto')
    if (!el || !scroller) return undefined
    const header = scroller.querySelector(':scope > header')
    const footer = scroller.querySelector('[data-draft-footer]')
    const fit = () => {
      const top = (header?.offsetHeight ?? 0) + 24
      el.style.setProperty('--co-rail-top', `${top}px`)
      el.style.setProperty('--co-rail-max', `${Math.max(240, scroller.clientHeight - top - (footer?.offsetHeight ?? 0) - 16)}px`)
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(fit)
    ;[scroller, header, footer].filter(Boolean).forEach((x) => ro.observe(x))
    return () => ro.disconnect()
  }, [])
  useEffect(() => () => clearTimeout(t.current), [])
  const onScroll = () => { setSb(true); clearTimeout(t.current); t.current = setTimeout(() => setSb(false), 800) }
  return { ref, sb, onScroll }
}

// the rows above the draft that the response calls for
function Notes({ notes }) {
  const rows = []
  if (notes.template) rows.push(<NoteRow key="t" icon={<Info size={16} aria-hidden />}><span className="font-semibold text-stone-900">Template draft:</span> AI writing was unavailable, so this is the structure to fill in, not finished copy.</NoteRow>)
  if (notes.noFacts) rows.push(<NoteRow key="f" icon={<Info size={16} aria-hidden />}>Add your brand facts in Brand Setup for a better draft. <a href="/brands" className={LINK}>Open Brand Setup</a></NoteRow>)
  return rows.length ? <div className="mb-6 flex flex-col gap-2">{rows}</div> : null
}
const NoteRow = ({ icon, tone, children }) => (
  <div className={`flex gap-3 rounded-lg border px-3.5 py-3 text-[14px] leading-5 text-stone-700 ${tone === 'caution' ? 'border-[color-mix(in_srgb,var(--caution)_45%,transparent)] bg-[color-mix(in_srgb,var(--caution)_8%,transparent)]' : 'border-line bg-tint'}`}>
    <span className={`mt-0.5 shrink-0 ${tone === 'caution' ? 'text-[var(--caution)]' : 'text-stone-500'}`}>{icon}</span>
    <div className="min-w-0">{children}</div>
  </div>
)

function Section({ section, terms, competitors = [] }) {
  const t = section.title.toLowerCase()
  if (t === 'direct answer') {
    return (
      <section className="mt-6">
        <h2 className="text-[13px] leading-[18px] font-medium text-stone-500">Direct answer</h2>
        {section.blocks.map((b, i) => <p key={i} className="mt-1 text-[19px] leading-[1.55] font-medium text-ink">{b.inline ? <Inline inline={b.inline} terms={terms} /> : null}</p>)}
      </section>
    )
  }
  return (
    <section className="mt-10">
      <h2 className={`${H2} mb-4 border-b border-line-strong pb-2`}>{section.title}</h2>
      {t === 'sources'
        ? <Sources blocks={section.blocks} competitors={competitors} />
        : <Blocks blocks={section.blocks} terms={terms} ticks={t === 'key points'} faq={t === 'faq'} />}
    </section>
  )
}

function Blocks({ blocks, terms, ticks = false, faq = false }) {
  return (
    <div className="flex flex-col gap-4">
      {withComparisons(blocks).map((b, i) => {
        if (b.type === 'compare') return <Compare key={i} options={b.options} uniform={b.uniform} labels={b.labels} />
        if (b.type === 'ul') {
          return (
            <ul key={i} className="flex flex-col gap-2.5">
              {b.items.map((it, j) => (
                <li key={j} className={`flex gap-3 ${BODY}`}>
                  {ticks ? <Check size={14} strokeWidth={1.5} className="mt-[7px] shrink-0 text-ink" aria-hidden /> : <span aria-hidden className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />}
                  <span className="min-w-0"><Line inline={it} terms={terms} /></span>
                </li>
              ))}
            </ul>
          )
        }
        if (b.type === 'ol') {
          return (
            <ol key={i} className="flex flex-col gap-2.5">
              {b.items.map((it, j) => (
                <li key={j} className={`flex gap-3 ${BODY}`}>
                  <span className="mt-[3px] grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border border-line text-[12px] font-semibold tabular-nums text-ink">{j + 1}</span>
                  <span className="min-w-0"><Line inline={it} terms={terms} /></span>
                </li>
              ))}
            </ol>
          )
        }
        if (b.type === 'h3') return <h3 key={i} className={`text-[17px] leading-6 font-semibold text-stone-900 ${faq && i > 0 ? 'mt-3 border-t border-[var(--div)] pt-4' : ''}`}><Inline inline={b.inline} terms={terms} /></h3>
        if (b.type === 'quote') return <blockquote key={i} className={`border-l-2 border-line-strong pl-4 ${BODY}`}><Line inline={b.inline} terms={terms} /></blockquote>
        return <p key={i} className={BODY}><Line inline={b.inline} terms={terms} /></p>
      })}
    </div>
  )
}

// comparisons: when every option has the same "Label: value" items, our grid (labels as rows, options as columns,
// plain text cells); otherwise 2–3 short lists side by side. (No ✓ / ✕ table.)
function Compare({ options, uniform, labels }) {
  if (uniform && options.length >= 2) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col" className="w-[18%] py-2 pr-3" aria-label="Compared on" />
              {options.map((o) => <th key={o.name} scope="col" className="py-2 pr-3 align-bottom text-[14px] leading-5 font-semibold text-stone-900">{o.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, i) => (
              <tr key={label} className="border-b border-[var(--div)]">
                <th scope="row" className="py-2.5 pr-3 align-top text-[13px] leading-5 font-medium text-stone-500">{label}</th>
                {options.map((o) => <td key={o.name} className="py-2.5 pr-3 align-top text-[15px] leading-[22px] text-stone-800">{o.rows[i]?.value}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  return (
    <div className={`grid grid-cols-1 gap-3 ${options.length === 2 ? '@[560px]:grid-cols-2' : '@[560px]:grid-cols-3'}`}>
      {options.map((o) => (
        <div key={o.name} className="rounded-lg border border-line px-4 py-3">
          <p className="text-[15px] leading-[22px] font-semibold text-stone-900">{o.name}</p>
          <dl className="mt-2 flex flex-col gap-1.5">
            {o.rows.map((r) => (
              <div key={r.label} className="flex flex-col">
                <dt className={META}>{r.label}</dt>
                <dd className="text-[15px] leading-[22px] text-stone-800">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}

// a line of text (the "Confirm with your team" phrase is marked where it stands: Mentions)
function Line({ inline, terms }) {
  return <Inline inline={inline} terms={terms} />
}

// inline nodes → React (text only; links http(s) only, already checked by the parser)
function Inline({ inline, terms }) {
  return inline.map((n, i) => {
    if (n.t === 'text') return <Mentions key={i} text={n.v} terms={terms} />
    if (n.t === 'code') return <code key={i} className="rounded bg-tint px-1 text-[0.92em]">{n.v}</code>
    if (n.t === 'strong') return <strong key={i} className="font-semibold text-stone-900"><Inline inline={n.c} terms={terms} /></strong>
    if (n.t === 'em') return <em key={i}><Inline inline={n.c} terms={terms} /></em>
    if (n.t === 'link') return <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" className={LINK}><Inline inline={n.c} terms={terms} /></a>
    return null
  })
}
// competitor names: a 1.5px solid red underline, "Competitor name · remove before publishing" on hover; the phrase
// "Confirm with your team": a dotted amber underline, "Confirm with your team before publishing" on hover
const CONFIRM_RE = /(Confirm with your team:?)/
function Mentions({ text, terms }) {
  return String(text).split(CONFIRM_RE).flatMap((chunk, k) => (CONFIRM_RE.test(chunk) && chunk.startsWith('Confirm')
    ? [<span key={`c${k}`} tabIndex={0} className="group/cf relative rounded-sm underline decoration-[var(--caution)] decoration-dotted decoration-[1.5px] underline-offset-[4px] outline-none focus-visible:ring-2 focus-visible:ring-focus">{chunk}<Tip>Confirm with your team before publishing</Tip></span>]
    : splitMentions(chunk, terms).map((p, i) => (p.mention ? (
      <span key={`${k}-${i}`} tabIndex={0} data-mention={p.text} className="group/c relative rounded-sm underline decoration-[var(--negative)] decoration-solid decoration-[1.5px] underline-offset-[4px] outline-none focus-visible:ring-2 focus-visible:ring-focus">
        {p.text}<Tip group="c">Competitor name · remove before publishing</Tip>
      </span>
    ) : <span key={`${k}-${i}`}>{p.text}</span>))))
}
const Tip = ({ children, group = 'cf' }) => (
  <span role="tooltip" className={`pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-raised px-2 py-1 text-[12px] leading-4 font-medium text-stone-900 no-underline opacity-0 shadow-sm transition-opacity duration-150 ${group === 'c' ? 'group-hover/c:opacity-100 group-focus-within/c:opacity-100' : 'group-hover/cf:opacity-100 group-focus-within/cf:opacity-100'}`}>{children}</span>
)

// each source: its label, the domain (muted), its note as a small chip; the page recommendation isn't listed here
// each source: its label, the domain (muted), its note as a small chip; a competitor's page gets "Competitor · left
// out of Copy" (Copy content / Copy as HTML drop it: R2); the page recommendation isn't listed here
function Sources({ blocks, competitors = [] }) {
  const rows = sourcesOf(blocks)
  return (
    <ul>
      {rows.map((s) => {
        const rival = competitors.some((d) => s.host === d || s.host.endsWith(`.${d}`))
        return (
          <li key={s.url} data-host={s.host} className="flex min-h-12 items-center gap-3 rounded-sm border-b border-[var(--div)] py-2.5">
            <LogoPlate domain={s.host} />
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">
              <span className="block text-[15px] leading-[22px] text-stone-900">{s.label || s.host}</span>
              <span className="block truncate text-[13px] leading-[18px] text-stone-500">{[s.host, rival && 'Competitor · left out of Copy', s.note].filter(Boolean).join(' · ')}</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}

// the sticky outline over the draft: a tab row of the sections it has (14/500, 24px apart); the one in view in ink with
// a 2px ink underline that slides to it (200ms; an IntersectionObserver in the panel's scroller); a hairline below
function Outline({ sections }) {
  const nav = useRef(null)
  const btns = useRef([])
  const [at, setAt] = useState(0)
  const [top, setTop] = useState(0)
  const [bar, setBar] = useState({ left: 0, width: 0 })
  useEffect(() => {
    const root = nav.current?.closest('.overflow-y-auto') ?? null
    setTop(root?.querySelector('header')?.offsetHeight ?? 0)
    const els = sections.map((_, i) => document.getElementById(`co-sec-${i}`)).filter(Boolean)
    if (!els.length || typeof IntersectionObserver === 'undefined') return undefined
    const seen = new Map()
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target.id, e.isIntersecting))
      // the last section in the band under the header: the one being read
      const last = els.findLastIndex((el) => seen.get(el.id))
      if (last >= 0) setAt(last)
    }, { root, rootMargin: '-190px 0px -55% 0px', threshold: 0 })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [sections.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const el = btns.current[at]; if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth }) }, [at, sections.length])
  const jump = (i) => document.getElementById(`co-sec-${i}`)?.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  return (
    <nav ref={nav} aria-label="Draft sections" className="sticky z-10 mb-2 border-b border-line bg-surface" style={{ top }}>
      <div className="relative flex flex-wrap items-center gap-x-6">
        {sections.map((s, i) => (
          <button key={s.title} ref={(el) => { btns.current[i] = el }} type="button" onClick={() => jump(i)} aria-current={at === i ? 'location' : undefined}
            className={`h-11 rounded-sm text-[14px] leading-5 font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${at === i ? 'text-ink' : 'text-stone-500 hover:text-ink'}`}>{outlineShort(s.title)}</button>
        ))}
        <span aria-hidden className="absolute bottom-0 h-0.5 rounded-full bg-ink transition-[left,width] duration-200 ease-out motion-reduce:transition-none" style={{ left: bar.left, width: bar.width }} />
      </div>
    </nav>
  )
}

// ---- the rail: three short sections, nothing scrolls sideways ---------------------------------------------------
//   Before you publish: Readiness ("0 of 2 flags", the ring weighted by score; the score and the route's coverage in
//     its ⓘ; Re-check score) and the flags as a checklist (checkbox · label chip · text · score); a Draft gap that names
//     a competitor gets "Show in draft".
//   What this draft adds: the missing / partial formats (recommendations[]) with a red dashed ring, the name, the score
//     and a stack of the competitors that have it (max 3; names, ranks and engines in the hover card).
//   Who you're up against: one list (R22): logo · display name · #rank · the citing engines' icons; 5, then "+n more".
function Rail({ res, flags, ready, ticked, onTick, competitors, onRecheck, onShow, resolve, arriving = false }) {
  const formats = formatRows(res.recommendations, res.formats).filter((r) => r.status !== 'covered')
  const rows = upAgainstRows(res, competitors, competitorName)
  const ba = beforeAfter(res)
  const strip = rankStrip(res, competitors, competitorName)
  const [more, setMore] = useState(false)
  const [hot, setHot] = useState(null) // linked hover: a rank-strip logo ↔ its row
  const checked = flags.filter((f) => ticked.includes(f.id)).length
  const topScore = Math.max(0, ...flags.map((f) => f.score))
  const eng = (p) => (p ? withResults(enginesOf(p, resolve)) : { engines: [], unknown: false })
  return (
    <aside id="co-draft-checks" className="flex min-w-0 scroll-mt-36 flex-col gap-8" aria-label="Draft checks">
      <section>
        <div className="flex items-center gap-3 border-b border-line-strong pb-3">
          <Ring value={ready.done} total={ready.total || 1} size={44} stroke={4} tone={ready.remaining === 0 ? 'positive' : 'ink'}>{checked}/{flags.length}</Ring>
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-1.5 text-[15px] leading-[22px] font-semibold text-stone-900">
              Before you publish
              <span className="group/ri relative inline-flex">
                <button type="button" aria-label="How readiness is counted" className="grid h-4 w-4 place-items-center rounded-full text-stone-500 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"><Info size={13} aria-hidden /></button>
                <span role="tooltip" className={`${CARD} right-0 top-full mt-1.5 w-[250px] font-normal text-stone-700 group-hover/ri:block group-focus-within/ri:block`}>
                  Weighted by importance: {ready.done} of {ready.total} points.<br />Your pages vs page 1: {COVERAGE_LABEL[res.coverage]} (your existing pages, not this draft).
                </span>
              </span>
            </h2>
            <p className={META}>{checked} of {flags.length} {flags.length === 1 ? 'flag' : 'flags'} · <button type="button" onClick={onRecheck} className="rounded font-medium text-stone-700 underline decoration-[var(--color-line-strong)] underline-offset-[3px] outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">Re-check score</button></p>
          </div>
        </div>
        <ul className="flex flex-col">
          {flags.map((f) => {
            const on = ticked.includes(f.id)
            const host = flagHost(f)
            return (
              <li key={f.id} className="border-b border-[var(--div)] py-2.5">
                <label className="grid cursor-pointer grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-x-3">
                  <input type="checkbox" checked={on} onChange={() => onTick(f.id)} className="peer sr-only" />
                  <span aria-hidden className={`mt-0.5 grid h-4 w-4 place-items-center rounded-[4px] border transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-focus ${on ? 'border-ink bg-ink' : 'border-[var(--color-line-strong)] bg-surface'}`}>
                    {on && <Check size={11} strokeWidth={3.5} className="text-on-ink" />}
                  </span>
                  <span className={`min-w-0 transition-colors duration-200 ${on ? 'line-through decoration-stone-400 decoration-1' : ''}`}>
                    <span className={`flex items-center gap-1.5 text-[14px] leading-5 font-semibold ${on ? 'text-stone-500' : 'text-ink'}`}>
                      {f.score === topScore && !on && <span aria-label="Most important" role="img" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--negative)]" />}{f.label}
                    </span>
                    <span className={`mt-0.5 block text-[14px] leading-5 [overflow-wrap:anywhere] ${on ? 'text-stone-500' : 'text-stone-800'}`}>{f.text}</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-right text-[13px] leading-5 tabular-nums text-stone-500">{f.score} pts</span>
                </label>
                {host && <button type="button" onClick={() => onShow(host)} className="ml-7 mt-1 rounded text-[13px] leading-[18px] font-medium text-stone-700 underline decoration-[var(--color-line-strong)] underline-offset-[3px] outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">Show in draft</button>}
              </li>
            )
          })}
        </ul>
      </section>

      {formats.length > 0 && (
        <section>
          <h2 className={`${HEAD} border-line-strong`}>What this draft adds</h2>
          {ba.columns.length > 0 && <BeforeAfter ba={ba} base={arriving ? 360 : 760} />}
          <ul>
            {formats.map((r) => (
              <li key={r.id} className="flex h-11 items-center gap-2.5 border-b border-[var(--div)]">
                <span aria-hidden className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-line text-[12px] leading-none font-medium text-ink">+</span>
                <span className="min-w-0 flex-1 truncate text-[15px] leading-[22px] font-medium text-stone-900">{r.label}</span>
                <LogoStack usages={r.usages.slice(0, 3)} rows={rows} eng={eng} res={res} />
                <span className="w-12 shrink-0 whitespace-nowrap text-right text-[13px] leading-[18px] tabular-nums text-stone-500">{r.score} pts</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className={`${HEAD} border-line-strong`}>Who you’re up against</h2>
        <RankStrip strip={strip} hot={hot} setHot={setHot} />
        <ul onMouseLeave={() => setHot(null)}>
          {(more ? rows : rows.slice(0, 5)).map((r, i, shownRows) => (
            <li key={r.host} onMouseEnter={() => setHot(r.host)} className={`group/ua relative flex h-11 min-w-0 items-center gap-2.5 border-b border-[var(--div)] transition-colors duration-150 ${hot === r.host ? 'bg-tint' : ''}`}>
              <LogoPlate domain={r.host} name={siteName(r.host)} size={22} />
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                {/* the display name: the tracked brand's, else the tidied domain, never raw (owner, 2026-11-05) */}
                <span className="truncate text-[14px] leading-5 font-semibold text-stone-900" title={r.host}>{siteName(r.host)}</span>
                {/* the row's own hover card has the two lines, so the note only carries the dotted "hover me" underline */}
                {r.others?.length > 0 && <span data-more-pages className={`shrink-0 text-[12px] leading-4 tabular-nums text-stone-500 ${DOTTED}`}>+{r.others.length} {r.others.length === 1 ? 'page' : 'pages'}</span>}
              </span>
              <span className="w-8 text-right text-[13px] leading-[18px] tabular-nums text-stone-700">{r.rank ? `#${r.rank}` : ''}</span>
              {/* room for all five engines (5 × 14px + gaps): the rank column stays put whatever a row has */}
              <span className="flex w-[86px] shrink-0 justify-end">{(eng(r.page).engines.length || eng(r.page).unknown) ? <EngineIconRow e={eng(r.page)} /> : <span className="text-[13px] text-stone-500" aria-label="Not cited in AI answers">—</span>}</span>
              {r.url && (
                <span role="tooltip" className={`${CARD} right-0 ${r.others?.length ? 'w-[340px]' : 'w-[260px]'} text-stone-700 group-hover/ua:block ${i >= shownRows.length - 2 ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                  {r.others?.length > 0
                    // a site on two page-1 spots: the same two lines as the winners table's "+1 page"
                    ? <TwoSpotLines page={r} others={r.others} />
                    : <>
                      <span className="block truncate font-medium text-stone-900" title={r.url}>{r.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                      <span className="mt-0.5 block text-stone-500">{r.formats.length ? r.formats.map(formatLabel).join(' · ') : 'No format detected'}</span>
                    </>}
                </span>
              )}
            </li>
          ))}
        </ul>
        {rows.length > 5 && <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="mt-2 rounded text-[13px] leading-[18px] font-medium text-stone-700 underline decoration-[var(--color-line-strong)] underline-offset-[3px] outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">{more ? 'Show fewer' : `+${rows.length - 5} more`}</button>}
      </section>
    </aside>
  )
}

// the engines that cite a page, as 16px icons in full colour; "AI" when the route doesn't say which engine (R20)
function EngineIconRow({ e, size = 14 }) {
  const items = [...e.engines, ...(e.unknown ? ['ai'] : [])]
  return (
    <span className="flex items-center gap-1">
      {items.map((id) => (id === 'ai'
        ? <span key={id} title="AI answers (engine not specified)" className="grid place-items-center rounded-full bg-stone-200 text-[7px] font-bold text-stone-700" style={{ width: size, height: size }}>AI</span>
        : <span key={id} title={ENGINE_NAME[id]}><PlatformIcon id={engineIcon(id)} size={size} /></span>))}
    </span>
  )
}

// a stack of the competitors that use a format (max 3); hover: their names, ranks and engines
function LogoStack({ usages, rows, eng, res }) {
  return (
    <span className="group/ls relative flex shrink-0 gap-1">
      {usages.map((u) => <span key={u.host} title={rows.find((r) => r.host === u.host)?.name ?? u.host}><LogoPlate domain={u.host} size={18} logoClass="h-3 w-3" initialClass="text-[8px]" /></span>)}
      <span role="tooltip" className={`${CARD} right-0 top-full mt-1 w-[240px] text-left group-hover/ls:block`}>
        {usages.map((u) => {
          const row = rows.find((r) => r.host === u.host)
          return (
            <span key={u.host} className="flex items-center gap-2 py-0.5 text-[12px] leading-4 text-stone-700">
              <span className="min-w-0 flex-1 truncate font-medium text-stone-900">{row?.name ?? u.host}</span>
              <span className="tabular-nums">{u.rank ? `#${u.rank}` : 'AI only'}</span>
              <EngineIconRow e={eng(res.citedPages.find((c) => c.host === u.host))} size={12} />
            </span>
          )
        })}
      </span>
    </span>
  )
}

// ---- the rail's two small visuals ---------------------------------------------------------------------------------
// one-word column labels (the matrix's columns, R25)
const FMT_SHORT = { listicle: 'Listicle', how_to: 'How-to', research: 'Research', faq: 'FAQ', comparison: 'Compare', tutorial: 'Tutorial', stats: 'Stats', checklist: 'Checklist', case_study: 'Case study', template: 'Template' }

// Before / after (R25): the Target page matrix's columns in two rows, "Your page now" and "After this draft", in the
// matrix's vocabulary at 16px (green tick = has it, red dashed ring = missing); format names as small labels above.
// The ticks this draft adds draw themselves when the step opens (the disc pops, the check strokes in over 250ms; 80ms
// apart, from `base` ms); everything else is drawn still. Reduced motion: the final state.
function BeforeAfter({ ba, base }) {
  const cols = { gridTemplateColumns: `112px repeat(${ba.columns.length}, minmax(0, 1fr))` }
  let k = 0
  return (
    <div role="table" aria-label="Formats on your page: now and after this draft" className="mt-3 mb-2">
      <div role="row" className="grid items-end" style={cols}>
        <span role="columnheader"><span className="sr-only">Page</span></span>
        {ba.columns.map((c) => <span key={c.id} role="columnheader" title={c.label} className="truncate px-0.5 text-center text-[12px] leading-4 text-stone-500">{FMT_SHORT[c.id] ?? c.label}</span>)}
      </div>
      <div role="row" className="grid h-8 items-center" style={cols}>
        <span role="rowheader" className="truncate text-[13px] leading-[18px] text-stone-700">Your page now</span>
        {ba.columns.map((c) => <span key={c.id} role="cell" className="grid place-items-center">{c.now ? <TickDraw size={16} animate={false} label="Has it" /> : <RingDraw size={16} animate={false} label="Missing" />}</span>)}
      </div>
      <div role="row" className="grid h-8 items-center border-t border-[var(--div)]" style={cols}>
        <span role="rowheader" className="truncate text-[13px] leading-[18px] font-semibold text-stone-900">After this draft</span>
        {ba.columns.map((c) => (
          <span key={c.id} role="cell" className="grid place-items-center">
            {c.added ? <TickDraw size={16} delay={base + k++ * 80} ms={250} stroke={90} label="Added by this draft" />
              : c.after ? <TickDraw size={16} animate={false} label="Has it" />
                : <RingDraw size={16} animate={false} label="Still missing: this draft doesn’t add it" />}
          </span>
        ))}
      </div>
    </div>
  )
}

// The rank strip (R26), over "Who you're up against": a Google 1–10 track (a hairline, faint ticks, #1 and #10 under
// it), each ranked row's 20px logo at its rank (two on one rank sit 8px apart, the later one on top), your page as a
// ringed ink dot at its rank, else a dashed "You" just past 10; pages only AI answers cite aren't on the track: a small
// "AI only · n" mark at its end. Linked hover both ways: a logo tints its row below; a row rings its logo (or the mark).
const xAt = (rank) => `calc(10px + (100% - 20px) * ${(rank - 1) / 9})`
function RankStrip({ strip, hot, setHot }) {
  const { marks, ours, aiOnly } = strip
  const aiHot = aiOnly.includes(hot)
  const label = (rank, text, bold = false) => <span key={`l${rank}${text}`} className={`absolute top-[28px] -translate-x-1/2 whitespace-nowrap text-[11px] leading-4 tabular-nums ${bold ? 'font-semibold text-ink' : 'text-stone-500'}`} style={{ left: xAt(rank) }}>{text}</span>
  return (
    <div className="mt-3 mb-1 flex items-start gap-2.5" role="group" aria-label="Google rank for this prompt, #1 to #10">
      <div className="relative h-11 min-w-0 flex-1" onMouseLeave={() => setHot(null)}>
        <span aria-hidden className="absolute top-[14px] h-px bg-[var(--color-line-strong)]" style={{ left: 10, right: 10 }} />
        {Array.from({ length: 10 }, (_, i) => <span key={i} aria-hidden className="absolute top-[11px] h-[7px] w-px -translate-x-1/2 bg-[var(--co-slot)]" style={{ left: xAt(i + 1) }} />)}
        {ours !== 1 && label(1, '#1')}
        {ours !== 10 && label(10, '#10')}
        {ours != null && (
          <>
            <span role="img" aria-label={`Your page, #${ours}`} className="absolute top-[14px] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-[1.5px] ring-ink ring-offset-[3px] ring-offset-[var(--color-surface)]" style={{ left: xAt(ours) }} />
            {label(ours, 'You', true)}
          </>
        )}
        {marks.map((m) => (
          <button key={m.host} type="button" onMouseEnter={() => setHot(m.host)} onFocus={() => setHot(m.host)} onBlur={() => setHot(null)}
            aria-label={`${m.name}, #${m.rank}`}
            className={`absolute top-[14px] grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-none transition-[box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-focus ${hot === m.host ? 'z-20 scale-110 ring-2 ring-ink ring-offset-1 ring-offset-[var(--color-surface)]' : ''}`}
            style={{ left: `calc(${xAt(m.rank)} + ${m.lane * 8}px)`, zIndex: hot === m.host ? 20 : 1 + m.lane }}>
            <LogoPlate domain={m.host} name={m.name} size={20} logoClass="h-3.5 w-3.5" initialClass="text-[8px]" />
          </button>
        ))}
      </div>
      {ours == null && <span className="mt-1 grid h-5 shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-stone-500 px-1.5 text-[11px] leading-none font-semibold text-stone-600" title="Your page isn’t on Google page 1">You</span>}
      {aiOnly.length > 0 && (
        <span className={`mt-[3px] shrink-0 whitespace-nowrap rounded px-1 text-[12px] leading-4 tabular-nums transition-[box-shadow,color] duration-150 ${aiHot ? 'text-ink ring-1 ring-ink' : 'text-stone-500'}`}
          title="Cited by AI answers, not on Google page 1">AI only · {aiOnly.length}</span>
      )}
    </div>
  )
}
