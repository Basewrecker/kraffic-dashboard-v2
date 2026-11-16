// Getting started, the board (mock only; owner, 2026-11-15). It opens from the sidebar's Getting started card as a wide
// sheet over a dimmed page, and replaces the list. The guide is built from the brand's own data (here: the mock's
// sample data): one step is shown large with a live preview of what it opens, and a trail of six frames along the
// bottom shows what each finished step produced. Words and rules: tour.js. Motion: motion.js.
//
//   sheet   820px, centred, 20px radius. Esc, a click outside or the × closes it. Top row: "Getting started",
//           "3 of 6" and six progress segments.
//   layout  one fixed height in every state: the left column is as tall as the preview, with the button row pinned to
//           its foot, so nothing moves when the step changes
//   hero    left: the step's name as a headline, its reason, Start, and "Opens <pages>". Right: the preview, a small
//           true copy of what the step opens (clicking it is Start). A step waiting on the first scan: a faint
//           preview and "Waiting for your first results". A done step picked from the trail: "Replay".
//   trail   six frames: a tile, a short name, a result line. Done: a tiny visual of the result and an ink tick. Not done:
//           a faint grey miniature of its preview. The current step says "Up next" in its colour, after a dot. Only
//           the frame shown in the hero has an outline (1.5px, its step's colour). Upcoming frames aren't clickable.
//   colour  each step has its own colour (--wt-c1 … --wt-c6): its tile's background (10%, 16% in dark), a soft wash in
//           the preview's top right corner, the current frame's outline, the current progress segment. Headline, text,
//           Start, done segments and ticks stay ink.
//   all done  "You're set up" and Done on the left; on the right the six finished frames rise from the trail and settle as
//           a 3 by 2 grid; the trail's place holds one line. Done sends the sidebar card away.
// Motion: the sheet grows out of the sidebar card as the page dims (closing reverses it). A step finishing: its tile
// fills with its result and the tick appears, the result number counts up, the hero's headline and preview slide out as
// the next step's slide in, the wash changes colour, the next segment fills. A frame lifts 2px on hover. Reduced
// motion: fades only. Phones: the sheet is full screen, the hero stacks, the trail scrolls sideways.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Check, FileText, Globe, Send, X } from 'lucide-react'
import SiteLogo from '../components/ui/SiteLogo'
import { PlatformIcon } from '../components/dashboard/icons'
import { ScoreRing } from '../components/dashboard/KpiRow'
import { account, getHistory, missedPrompts, trackedPrompts } from '../data/mock'
import { TRACKED_BRANDS, getBrandView } from '../data/brandViews'
import { ENGINES, ENGINE_NAME, engineIcon } from '../data/contentOpportunities'
import { competitorName } from '../data/contentRecommend'
import { heroLine, opinionOf, scoreOf, sentimentFor } from '@/lib/sentiment-adapter'
import { publicationName, reachOutFor } from '@/lib/publication-contacts'
import { DONE_LINE, DONE_TITLE, TASKS, WAITING, allDone, currentTask, doneCount, fill, isDone, isWaiting, taskStatus } from './tour.js'
import { LARGE, ease, ms, reduced } from './motion.js'
import Swap from './Swap'
import { closeList, finish, openTask, useWalkthrough } from './store.js'

const inkBtn = 'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] bg-ink px-5 py-[11px] text-[14px] leading-5 font-semibold text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2'
const colourOf = (t) => `var(--wt-c${TASKS.indexOf(t) + 1})`
const safe = (fn, or = null) => { try { return fn() } catch { return or } }

// ---------------------------------------------------------------- the brand's data (mock: the sample data)
const rivals = () => TRACKED_BRANDS.filter((b) => !b.you)
const tonePages = () => safe(() => sentimentFor(account.domain).pages, [])
const score = () => safe(() => getBrandView().kpis.score, null)
const toneScore = () => safe(() => scoreOf(sentimentFor(account.domain).runs.at(-1).counts), null)
// each step's result: the number that counts up, and the words around it
const RESULT = {
  brand: () => ({ n: rivals().length, text: (n) => `${n} competitor${n === 1 ? '' : 's'}` }),
  prompts: () => ({ n: trackedPrompts.length, text: (n) => `${n} tracked` }),
  results: () => ({ n: score(), text: (n) => `Visibility ${n}` }),
  tone: () => ({ n: tonePages().length, text: (n) => `${n} pages read` }),
  content: () => ({ n: 1, text: (n) => `${n} draft` }),
  outreach: () => ({ n: 1, text: (n) => `${n} sent` }),
}
const resultOf = (t) => safe(RESULT[t.id], { n: 0, text: () => '' })

// a number that counts up to its value once (a step that has just finished); reduced motion: the value at once
function Count({ to, run }) {
  const [n, setN] = useState(run && !reduced() ? 0 : to)
  useEffect(() => {
    if (!run || reduced() || to == null) { setN(to); return undefined }
    const t0 = performance.now() + ms(300), dur = ms(600)
    let raf
    const frame = (t) => { const k = Math.max(0, Math.min(1, (t - t0) / dur)); setN(Math.round(to * ease(k))); if (k < 1) raf = requestAnimationFrame(frame) }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [to, run])
  return n
}

// ---------------------------------------------------------------- the previews: a small, true copy of what a step opens
// Shared rules: 28px padding, one small grey label at the top left after a dot of the step's colour, the content centred
// in the rest and as wide as the preview. Logos are 28px in round tiles; a logo that doesn't load is the globe.
const globe = (size) => <span aria-hidden className={`grid ${size} shrink-0 place-items-center rounded-full bg-[var(--tint)] text-stone-500`}><Globe size={14} strokeWidth={1.75} /></span>
const Logo = ({ domain, name, size = 'h-7 w-7' }) => (
  <span className={`grid ${size} shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--logo-plate)] ring-1 ring-line`} title={name ?? domain}>
    <SiteLogo domain={domain} name={name ?? domain} className="h-full w-full rounded-full" fallback={globe('h-full w-full')} />
  </span>
)
function Shell({ label, children }) {
  return (
    <div className="flex h-full flex-col p-7">
      <div className="flex items-center gap-1.5 text-[12px] leading-4 text-stone-500" data-preview-label><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--c)]" />{label}</div>
      <div className="flex min-h-0 flex-1 flex-col justify-center">{children}</div>
    </div>
  )
}
function BrandPreview() {
  return (
    <Shell label="Your brand">
      <div className="flex items-center gap-3">
        <SiteLogo domain={account.domain} name={account.name} className="h-11 w-11 rounded-xl" initialClass="text-[16px]" fallback={globe('h-11 w-11')} />
        <div className="min-w-0">
          <div className="text-[17px] leading-6 font-semibold text-stone-900">{account.name}</div>
          <div className="text-[13px] leading-[18px] text-stone-600">{account.domain}</div>
        </div>
      </div>
      <div className="mt-4 text-[12px] leading-4 text-stone-500">Competitors</div>
      {/* each competitor: its logo with its whole name beside it; the row wraps, a name is never cut */}
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
        {rivals().map((b) => <span key={b.domain} className="flex items-center gap-2 whitespace-nowrap text-[13px] leading-[18px] font-medium text-stone-900"><Logo domain={b.domain} name={b.name} />{b.name}</span>)}
      </div>
    </Shell>
  )
}
// three prompts that different engines name the brand for, so the rows differ
const promptRows = () => {
  const seen = new Set(), out = []
  for (const p of trackedPrompts.filter((x) => x.status === 'visible')) {
    const k = [...p.platforms].sort().join(',')
    if (seen.has(k)) continue
    seen.add(k); out.push(p)
    if (out.length === 3) break
  }
  return out
}
function PromptsPreview() {
  return (
    <Shell label="Prompts we track">
      <ul className="divide-y divide-[var(--div)]">
        {promptRows().map((p) => (
          <li key={p.id} className="flex h-9 items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] font-medium text-stone-900">{p.prompt}</span>
            {/* every engine: the ones that name the brand in full colour, the others greyed out */}
            <span className="flex shrink-0 items-center gap-1.5">
              {ENGINES.map((e) => <span key={e} title={`${ENGINE_NAME[e] ?? e}${p.platforms.includes(e) ? ' names the brand' : ' doesn’t name the brand'}`} className={`flex ${p.platforms.includes(e) ? '' : 'opacity-25 grayscale'}`}><PlatformIcon id={engineIcon(e)} size={14} /></span>)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-[12px] leading-4 text-stone-500 tabular-nums"><span className="font-semibold text-stone-900">{trackedPrompts.length}</span> prompts tracked</div>
    </Shell>
  )
}
// the brand's visibility over the last syncs: a smooth line across the full width in the step's colour, a soft fill
// under it fading to nothing, and a round dot at its end (drawn as its own element, so stretching can't squash it)
function Trend() {
  const key = TRACKED_BRANDS[0].key
  const pts = safe(() => getHistory({ compare: false }).points.map((p) => p[key]).filter((v) => v != null), [])
  if (pts.length < 2) return null
  const lo = Math.min(...pts), hi = Math.max(...pts), w = 300, h = 52, pad = 6
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * w, pad + (1 - (v - lo) / Math.max(1, hi - lo)) * (h - pad * 2)])
  // a curve through every point (Catmull-Rom as cubic Béziers)
  const d = xy.map((p, i) => {
    if (i === 0) return `M${p[0]} ${p[1]}`
    const p0 = xy[i - 2] ?? xy[i - 1], p1 = xy[i - 1], p3 = xy[i + 1] ?? p
    return `C${p1[0] + (p[0] - p0[0]) / 6} ${p1[1] + (p[1] - p0[1]) / 6} ${p[0] - (p3[0] - p1[0]) / 6} ${p[1] - (p3[1] - p1[1]) / 6} ${p[0]} ${p[1]}`
  }).join('')
  const end = xy.at(-1)
  return (
    <div className="relative mt-3 h-[52px] w-full" data-trend>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" fill="none" aria-hidden>
        <defs><linearGradient id="wt-trend" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--c)', stopOpacity: 0.22 }} /><stop offset="1" style={{ stopColor: 'var(--c)', stopOpacity: 0 }} /></linearGradient></defs>
        <path d={`${d}L${w} ${h}L0 ${h}Z`} fill="url(#wt-trend)" />
        <path d={d} style={{ stroke: 'var(--c)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <span aria-hidden className="absolute right-0 h-2 w-2 translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--c)] ring-2 ring-surface" style={{ top: `${(end[1] / h) * 100}%` }} />
    </div>
  )
}
function ScorePreview() {
  const k = safe(() => getBrandView().kpis, {})
  return (
    <Shell label="Visibility score">
      <div className="flex items-center gap-4">
        <ScoreRing value={k.score ?? null} size={56} stroke={6} />
        <div className="text-[13px] leading-[18px] text-stone-600 tabular-nums"><span className="font-semibold text-stone-900">{k.visible} of {k.total}</span> prompts name {account.name}</div>
      </div>
      <Trend />
    </Shell>
  )
}
const AREAS = [['neutral', 'Neutral'], ['positive', 'Positive'], ['negative', 'Negative'], ['mixed', 'Mixed']]
// where a logo sits in its area (its middle, in % of the area): loose, like the real chart, never in a row
// (below the area's label, inside its edges)
const SPOTS = [[16, 58], [39, 76], [62, 56], [85, 74]]
function TonePreview() {
  const pages = tonePages()
  const counts = safe(() => sentimentFor(account.domain).runs.at(-1).counts, {})
  const value = toneScore()
  return (
    <Shell label="Sentiment score">
      <div className="flex items-center gap-6">
        <div className="shrink-0">
          <div className="text-[44px] leading-[44px] font-semibold tracking-[-0.03em] text-stone-900 tabular-nums">{value ?? '—'}</div>
          <div className="mt-2 text-[13px] leading-[18px] font-semibold text-stone-900">{safe(() => heroLine(value, counts), '')}</div>
          <div className="text-[12px] leading-4 text-stone-500 tabular-nums">From {safe(() => opinionOf(counts), 0)} of {pages.length} pages</div>
        </div>
        {/* the four areas, each with its publications' logos scattered loosely inside it */}
        <div className="grid min-w-0 flex-1 grid-cols-2 overflow-hidden rounded-lg border border-line" data-areas>
          {AREAS.map(([tone, name], i) => {
            const here = pages.filter((p) => p.tone === tone)
            return (
              <div key={tone} className={`relative h-[78px] ${i % 2 ? '' : 'border-r border-line'} ${i < 2 ? 'border-b border-line' : ''} ${tone === 'negative' ? 'bg-[color-mix(in_srgb,var(--negative)_7%,transparent)]' : ''}`}>
                <span className={`absolute left-2 top-1 text-[11px] leading-4 ${tone === 'negative' ? 'text-negative' : 'text-stone-500'}`}>{name}{here.length > SPOTS.length ? ` · ${here.length}` : ''}</span>
                {here.slice(0, SPOTS.length).map((p, k) => <span key={p.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${SPOTS[(k + i) % SPOTS.length][0]}%`, top: `${SPOTS[(k + i) % SPOTS.length][1]}%` }}><Logo domain={p.domain} /></span>)}
              </div>
            )
          })}
        </div>
      </div>
    </Shell>
  )
}
function ContentPreview() {
  const row = missedPrompts[0]
  const cited = row.competitors
  return (
    <Shell label="A prompt you’re missing">
      <div className="truncate text-[14px] leading-5 font-semibold text-stone-900">{row.prompt}</div>
      <div className="mt-2.5 flex items-center gap-2 text-[13px] leading-[18px] text-stone-600">
        <span className="text-stone-500">Cited instead</span>
        <span className="flex -space-x-1.5">{cited.slice(0, 4).map((d) => <Logo key={d} domain={d} name={competitorName(d)} />)}</span>
        <span className="whitespace-nowrap font-medium text-stone-900">{competitorName(cited[0])}{cited.length > 1 ? ` and ${cited.length - 1} more` : ''}</span>
      </div>
      {/* the outline of a draft page: its heading line in the step's colour at 40% */}
      <div className="mt-3 rounded-lg border border-line bg-surface p-3" aria-label="A draft page’s outline">
        <div className="h-2.5 w-2/3 rounded-full bg-[color-mix(in_srgb,var(--c)_40%,transparent)]" />
        <div className="mt-2.5 h-1.5 w-full rounded-full bg-[var(--data-track)]" />
        <div className="mt-1.5 h-1.5 w-11/12 rounded-full bg-[var(--data-track)]" />
        <div className="mt-1.5 h-1.5 w-4/5 rounded-full bg-[var(--data-track)]" />
      </div>
    </Shell>
  )
}
function OutreachPreview() {
  const page = tonePages().find((p) => p.tone === 'neutral' || p.tone === 'mixed') ?? tonePages()[0]
  if (!page) return null
  const reach = safe(() => reachOutFor(page), { label: 'Find contact' })
  return (
    <Shell label="An opportunity">
      <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
        <Logo domain={page.domain} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] leading-[18px] font-semibold text-stone-900">{page.title}</div>
          <div className="truncate text-[12px] leading-4 text-stone-600">{safe(() => publicationName(page.domain), page.domain)} · {page.tone === 'mixed' ? 'Mixed' : 'Neutral'}</div>
        </div>
        <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-2.5 text-[12px] leading-4 font-medium text-stone-900">{reach.label}<ArrowUpRight size={12} aria-hidden /></span>
      </div>
      <div className="mt-3 text-[12px] leading-4 text-stone-500">It mentions {account.name} without taking a side.</div>
    </Shell>
  )
}
const PREVIEW = { brand: BrandPreview, prompts: PromptsPreview, results: ScorePreview, tone: TonePreview, content: ContentPreview, outreach: OutreachPreview }

// ---------------------------------------------------------------- the trail
// a step not done yet: a faint grey miniature of its own preview
const g = 'bg-[var(--color-line-strong)]'
export function Mini({ id }) {
  if (id === 'brand') return <span className="flex items-center gap-1.5"><span className={`h-4 w-4 rounded-full ${g}`} /><span className="flex flex-col gap-1"><span className={`h-1 w-7 rounded-full ${g}`} /><span className={`h-1 w-4 rounded-full ${g} opacity-60`} /></span></span>
  if (id === 'prompts') return <span className="flex flex-col gap-1.5"><span className={`h-1 w-10 rounded-full ${g}`} /><span className={`h-1 w-8 rounded-full ${g} opacity-70`} /><span className={`h-1 w-9 rounded-full ${g} opacity-50`} /></span>
  if (id === 'results') return <span className="flex items-end gap-2"><span className="h-5 w-5 rounded-full border-[2.5px] border-[var(--color-line-strong)] border-b-transparent" /><span className={`mb-1 h-1 w-7 rounded-full ${g} opacity-70`} /></span>
  // What AI says: four small areas with a few dots
  if (id === 'tone') return (
    <span className="grid h-7 w-10 grid-cols-2 overflow-hidden rounded-[4px] border border-[var(--color-line-strong)]">
      {[2, 3, 1, 2].map((n, i) => <span key={i} className={`flex items-center justify-center gap-[2px] ${i % 2 ? '' : 'border-r'} ${i < 2 ? 'border-b' : ''} border-[var(--color-line-strong)]`}>{Array.from({ length: n }, (_, k) => <span key={k} className={`h-[3px] w-[3px] rounded-full ${g}`} />)}</span>)}
    </span>
  )
  // First content: a small page outline with lines
  if (id === 'content') return <span className="flex h-8 w-6 flex-col gap-1 rounded-[3px] border border-[var(--color-line-strong)] p-1"><span className={`h-[3px] w-3 rounded-full ${g}`} /><span className={`h-[2px] w-full rounded-full ${g} opacity-60`} /><span className={`h-[2px] w-full rounded-full ${g} opacity-60`} /><span className={`h-[2px] w-2/3 rounded-full ${g} opacity-60`} /></span>
  // Reach out: a logo circle and a small button shape
  return <span className="flex items-center gap-1.5"><span className={`h-4 w-4 rounded-full ${g}`} /><span className="h-3.5 w-7 rounded-[4px] border border-[var(--color-line-strong)]" /></span>
}
const stack = (items) => <span className="flex -space-x-1.5">{items.map((d) => <Logo key={d} domain={d} size="h-6 w-6" />)}</span>
// a done step's tiny visual: real logos or the real number
function TileResult({ t, fresh }) {
  const big = 'text-[20px] leading-6 font-semibold tracking-[-0.02em] text-stone-900 tabular-nums'
  if (t.id === 'brand') return stack(rivals().slice(0, 3).map((b) => b.domain))
  if (t.id === 'prompts') return <span className={big}><Count to={trackedPrompts.length} run={fresh} /></span>
  if (t.id === 'results') return <span className={big}><Count to={score()} run={fresh} /></span>
  if (t.id === 'tone') return stack([...new Set(tonePages().map((p) => p.domain))].slice(0, 3))
  if (t.id === 'content') return <span className="flex items-center gap-1.5 text-stone-900"><FileText size={18} strokeWidth={1.75} aria-hidden /><span className="flex flex-col gap-1"><span className="h-1 w-7 rounded-full bg-stone-900/70" /><span className="h-1 w-5 rounded-full bg-stone-900/30" /></span></span>
  const page = tonePages().find((p) => p.tone === 'neutral' || p.tone === 'mixed')
  return <span className="flex items-center gap-1.5 text-stone-900">{page && <Logo domain={page.domain} size="h-6 w-6" />}<Send size={15} strokeWidth={1.75} aria-hidden /></span>
}
// shown: this is the step in the hero (the one frame with an outline) · large: the all-done summary's size
function Frame({ t, w, shown = false, onPick = null, large = false, index = 0 }) {
  const status = taskStatus(w, t)
  const fresh = w.ticked === t.id && !large
  const r = resultOf(t)
  const done = status === 'done', current = status === 'current'
  const inner = (
    <>
      <span className={`wt-tile relative grid ${large ? 'h-[60px]' : 'h-[62px]'} w-full place-items-center rounded-[10px] ${done ? 'wt-tile-done' : 'wt-tile-open'} ${shown ? 'wt-tile-shown' : ''}`}>
        {done ? <span className={fresh ? 'wt-tile-in' : ''}><TileResult t={t} fresh={fresh} /></span> : <Mini id={t.id} />}
        {done && <span className={`absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-ink text-on-ink ${fresh ? 'wt-tick-in' : ''}`}><Check size={10} strokeWidth={3} aria-hidden /></span>}
      </span>
      <span className={`mt-2 block truncate ${large ? 'text-[13px]' : 'text-[12.5px]'} leading-4 font-semibold ${done || current ? 'text-stone-900' : 'text-stone-400'}`}>{t.short}</span>
      <span className={`block truncate ${large ? 'text-[12.5px]' : 'text-[11.5px]'} leading-4 text-stone-500 tabular-nums`} data-result>
        {done ? (fresh ? <span className="wt-got">{r.text(r.n)}</span> : r.text(r.n))
          // the current step: "Up next" in its colour, after a dot of it
          : current ? <span className="inline-flex items-center gap-1 font-medium text-[var(--c)]"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--c)]" />Up next</span>
            : status === 'waiting' ? 'Waiting' : ' '}
      </span>
    </>
  )
  const base = `${large ? 'wt-settle' : 'wt-frame max-md:w-[124px] max-md:shrink-0'} block min-w-0 text-left`
  const style = { '--c': colourOf(t), '--i': index }
  return onPick && (done || current)
    ? <button type="button" data-frame={t.id} data-status={status} data-shown={shown ? '' : undefined} style={style} aria-pressed={shown} aria-label={`${t.short}: ${done ? r.text(r.n) : 'up next'}`} onClick={() => onPick(t)} className={`${base} rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2`}>{inner}</button>
    : <div data-frame={t.id} data-status={status} style={style} className={base}>{inner}</div>
}

// the six progress segments (the sheet's top row, the sidebar card): done ink, the current one its step's colour
export function Segments({ w, className = '' }) {
  return (
    <span className={`wt-segs flex gap-1 ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={TASKS.length} aria-valuenow={doneCount(w)} aria-label="Steps done">
      {TASKS.map((t) => {
        const status = taskStatus(w, t)
        return <span key={t.id} className="wt-seg" data-state={status === 'done' ? 'done' : status === 'current' ? 'current' : 'rest'} style={{ '--c': colourOf(t) }}><span className="wt-seg-half" /><span className="wt-seg-full" /></span>
      })}
    </span>
  )
}

// kept in the page while it closes: [mounted, shown]
function usePresence(open, outMs) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(r)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), outMs)
    return () => clearTimeout(t)
  }, [open, outMs])
  return [mounted, shown]
}

// mounted once (Walkthrough.jsx). Open while the store's `list` is on.
export default function Board() {
  const w = useWalkthrough()
  const open = Boolean(w.list && w.show)
  const [mounted, shown] = usePresence(open, ms(LARGE))
  const [pick, setPick] = useState(null) // a done step picked from the trail (the hero shows it, with Replay)
  const [origin, setOrigin] = useState(null) // where the sheet grows from: the sidebar card's middle, in the sheet's own box
  const sheet = useRef(null)
  useEffect(() => { if (w.ticked || !open) setPick(null) }, [w.ticked, open])
  useLayoutEffect(() => {
    if (!mounted || !sheet.current) return
    // it grows out of the sidebar card's stack: its top card (else the card itself)
    const card = [...document.querySelectorAll('[data-stack-top], [data-tour="getting-started"]')].filter((el) => el.getClientRects().length).sort((a, b) => Number(b.hasAttribute('data-stack-top')) - Number(a.hasAttribute('data-stack-top')))[0]?.getBoundingClientRect()
    const s = sheet.current
    const box = s.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 }
    setOrigin(card ? { x: card.left + card.width / 2 - (box.left + s.offsetLeft), y: card.top + card.height / 2 - (box.top + s.offsetTop) } : null)
  }, [mounted, open])
  useEffect(() => {
    if (!open) return undefined
    const key = (e) => { if (e.key === 'Escape' && !w.tour) { e.preventDefault(); closeList() } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [open, w.tour])
  // focus goes to the sheet itself (no ring on Start until the keyboard is used)
  useEffect(() => { if (shown) sheet.current?.focus({ preventScroll: true }) }, [shown])
  if (!mounted) return null

  const n = doneCount(w)
  const current = currentTask(w)
  const step = pick && isDone(w, pick.id) ? pick : current // the step in the hero (none: all done)
  const replay = Boolean(step && isDone(w, step.id))
  const waiting = Boolean(step && isWaiting(w, step))
  const Preview = step ? PREVIEW[step.id] : null
  const start = () => { if (step && !waiting) openTask(step) }
  return createPortal(
    <div className="fixed inset-0 z-[85] grid place-items-center md:p-6" data-board={shown && open ? 'open' : 'closed'} data-all-done={allDone(w) ? '' : undefined}>
      <div aria-hidden onClick={closeList} className="wt-board-scrim absolute inset-0 bg-scrim-modal" />
      <section ref={sheet} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Getting started"
        style={origin ? { transformOrigin: `${origin.x}px ${origin.y}px` } : undefined}
        className="wt-sheet relative flex max-h-full w-full flex-col overflow-y-auto bg-surface shadow-2xl outline-none max-md:h-full md:w-[820px] md:max-w-full md:rounded-[20px] md:border md:border-line">
        {/* top row */}
        <div className="flex items-center gap-3 px-7 pt-5">
          <h2 className="whitespace-nowrap text-[14px] leading-5 font-semibold text-stone-600">Getting started</h2>
          <span className="ml-auto whitespace-nowrap text-[13px] leading-5 font-medium text-stone-500 tabular-nums" data-count={`${n} of ${TASKS.length}`}><Swap k={n} roll>{n}</Swap> of {TASKS.length}</span>
          <Segments w={w} className="wt-segs-top w-[150px] max-sm:w-[96px]" />
          <button type="button" onClick={closeList} aria-label="Close" className="-mr-2 grid h-8 w-8 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-[var(--tint)] hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus"><X size={16} aria-hidden /></button>
        </div>

        {/* hero: the left column is as tall as the preview, its button row at its foot, so nothing moves between steps */}
        <div className="grid grid-cols-1 gap-7 px-7 py-[30px] md:grid-cols-[300px_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col md:h-[236px]" data-hero-left>
            <Swap k={step ? step.id : 'done'} block move>
              <h3 className="text-[34px] leading-[1.08] font-semibold tracking-[-0.03em] text-stone-900" data-hero-title>{step ? step.title : DONE_TITLE}</h3>
              <p className="mt-3 max-w-[300px] text-pretty text-[15px] leading-[22px] text-stone-600">{step ? step.why : fill(DONE_LINE)}</p>
            </Swap>
            <div className="flex h-[42px] items-center gap-3.5 max-md:mt-6 md:mt-auto" data-hero-actions>
              {!step ? <button type="button" data-primary onClick={finish} className={inkBtn}>Done</button>
                : waiting ? <p className="text-[13px] leading-[18px] text-stone-500" data-waiting>{WAITING}</p> : (
                  <>
                    <button type="button" data-primary onClick={start} className={inkBtn}>{replay ? 'Replay' : 'Start'}</button>
                    <span className="min-w-0">
                      <span className="block text-[12px] leading-4 text-stone-500">Opens</span>
                      <span className="block text-[13px] leading-[18px] font-semibold text-stone-600" data-opens>{step.opens}</span>
                    </span>
                  </>
                )}
            </div>
          </div>
          {step ? (
            // the preview: clicking it is Start. Its wash is the step's colour, over the top right half and fading out
            <button type="button" onClick={start} disabled={waiting} tabIndex={-1} aria-label={`${replay ? 'Replay' : 'Start'}: ${step.title}`} data-preview={step.id} style={{ '--c': colourOf(step) }}
              className={`wt-preview relative h-[236px] overflow-hidden rounded-[14px] border border-line bg-surface text-left outline-none ${waiting ? 'cursor-default' : 'cursor-pointer'}`}>
              {TASKS.map((t) => <span key={t.id} aria-hidden className="wt-wash" data-on={t.id === step.id ? '' : undefined} style={{ '--c': colourOf(t) }} />)}
              <Swap k={step.id} block move className={`h-full ${waiting ? 'opacity-35' : ''}`}><div className="h-[236px]"><Preview /></div></Swap>
            </button>
          ) : (
            // all done: the six finished frames, risen from the trail and settled as a 3 by 2 grid
            <div className="grid h-[236px] grid-cols-3 content-between gap-x-4" data-summary>
              {TASKS.map((t, i) => <Frame key={t.id} t={t} w={w} large index={i} />)}
            </div>
          )}
        </div>

        {/* trail (one height in every state; all done: one line in its place) */}
        <div className="mt-auto flex h-[146px] flex-col justify-center border-t border-[var(--div)] px-7 max-md:h-auto max-md:py-5" data-trail-row>
          {step ? (
            <div className="grid grid-cols-6 gap-2.5 max-md:flex max-md:overflow-x-auto max-md:pb-1" data-trail>
              {TASKS.map((t) => <Frame key={t.id} t={t} w={w} shown={step.id === t.id} onPick={(x) => setPick(isDone(w, x.id) ? x : null)} />)}
            </div>
          ) : <p className="wt-fade text-[13px] leading-[18px] text-stone-600" data-replay-note>You can take the guided setup again from Settings.</p>}
        </div>
      </section>
    </div>,
    document.body,
  )
}
