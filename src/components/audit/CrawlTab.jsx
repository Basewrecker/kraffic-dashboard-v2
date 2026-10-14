import { useMemo, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import Card from '../dashboard/Card'
import Insight, { hl, useExplain } from '../ui/Insight'
import { useAudit } from './context'
import { CheckIcon, HBar, fmtMs, openDrawer, setParams } from './parts'
import { SLOW_MS, TARGET_MS } from '../../data/audit'

// Crawl: no KPI strip; each card carries its own numbers. Every page is a dot, a row, or a count, once per card.
const t2 = 'text-stone-600'
const t3 = 'text-stone-500'
const cardTitle = 'text-[15px] leading-5 font-semibold text-stone-900'
const subtitle = `mt-0.5 text-[13px] leading-[18px] ${t2}`
const MAX_CLICKS = 3 // deeper than this and crawlers start to skip pages
const dotFill = (ms) => (ms > SLOW_MS ? 'var(--negative)' : ms > TARGET_MS ? 'var(--data-c2)' : 'var(--ink)')
// 0 → the max, rounded up to a nice number (1, 1.5, 2, 2.5, 5 × 10ⁿ)
function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v))
  return [1, 1.5, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)
}

export default function CrawlTab() {
  return (
    <>
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2"><ResponseTime /></div>
        <SlowestPages />
      </div>
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <SiteStructure />
        <StatusCodes />
      </div>
    </>
  )
}

// "How fast do pages respond?" — one 8px dot per page on a ms axis, target line at 500 ms
function ResponseTime() {
  const { a } = useAudit()
  const explain = useExplain(a.key)
  const [tip, setTip] = useState(null) // { p, x, y }
  const box = useRef(null)
  const pages = a.pages
  const max = niceMax(Math.max(...pages.map((p) => p.ms), TARGET_MS))
  const step = max / 3 >= 500 ? 500 : max / 4
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => Math.round(i * step))
  // light, stable jitter on y (by index) so dots at similar times don't sit on each other
  const dots = useMemo(() => pages.map((p, i) => ({ p, x: (p.ms / max) * 100, y: 18 + (((i * 37) % 11) / 10) * 64 })), [pages, max])
  const over = pages.filter((p) => p.ms > TARGET_MS)
  const slow = pages.filter((p) => p.ms > SLOW_MS)
  const insight = over.length
    ? `${slow.length ? `${slow.length === 1 ? 'One page takes' : `${slow.length} pages take`} over a second. ` : ''}Over-target pages are mostly ${topSection(over)}.`
    : 'Every page responds within the 500 ms target.'
  const show = (d, el) => {
    const b = box.current.getBoundingClientRect(), r = el.getBoundingClientRect()
    setTip({ p: d.p, x: Math.min(Math.max(r.left + r.width / 2 - b.left, 90), b.width - 90), y: r.top - b.top })
  }

  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5 pb-3">
      <h2 className={cardTitle}>Response time</h2>
      <p className={subtitle}>How fast does each page respond to a crawler?</p>
      <p className="mt-4 text-[14px] leading-5 text-stone-900 tabular-nums">
        Median <span className="font-semibold">{fmtMs(a.crawl.median)}</span>
        <span className={t3}> · </span>
        <span className={over.length ? undefined : t2}>{over.length ? `${over.length} pages over target` : 'none over target'}</span>
      </p>

      <div ref={box} className="relative mt-3" onMouseLeave={() => setTip(null)}>
        <div className="relative h-[120px]" role="img" aria-label={`Response time per page, 0 to ${fmtMs(max)}. Target ${TARGET_MS} ms. ${over.length} pages over target.`}>
          {/* the 500 ms target */}
          <div className="absolute inset-y-0 border-l border-dashed border-stone-500" style={{ left: `${(TARGET_MS / max) * 100}%` }} aria-hidden>
            <span className={`absolute left-1.5 top-0 whitespace-nowrap text-[12px] leading-4 ${t3}`}>Target {TARGET_MS} ms</span>
          </div>
          {dots.map((d) => {
            const key = d.p.ms > TARGET_MS ? 'over' : 'under'
            const dim = explain.on && key !== 'over'
            return (
              <button key={d.p.path} type="button" onClick={() => openDrawer('page', d.p.path)}
                onMouseEnter={(e) => show(d, e.currentTarget)} onFocus={(e) => show(d, e.currentTarget)} onBlur={() => setTip(null)}
                aria-label={`${d.p.path}: ${fmtMs(d.p.ms)}`}
                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none transition-[opacity,transform] duration-150 hover:scale-150 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1"
                style={{ left: `${d.x}%`, top: `${d.y}%`, background: dotFill(d.p.ms), opacity: dim ? 0.2 : 1 }} />
            )
          })}
        </div>
        {/* axis */}
        <div className="relative mt-1 h-4 border-t border-line" aria-hidden>
          {ticks.map((t, i) => (
            <span key={t} className={`absolute top-1 whitespace-nowrap text-[12px] leading-4 ${t3} tabular-nums ${i === 0 ? '' : i === ticks.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`} style={{ left: `${(t / max) * 100}%` }}>
              {t === 0 ? '0' : t >= 1000 ? `${t / 1000} s` : `${t} ms`}
            </span>
          ))}
        </div>
        {tip && (
          <div role="tooltip" className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-raised px-2.5 py-1.5 shadow-md" style={{ left: tip.x, top: tip.y - 6 }}>
            <div className="max-w-[220px] truncate text-[12px] leading-4 font-medium text-stone-900">{tip.p.path}</div>
            <div className={`text-[12px] leading-4 tabular-nums ${tip.p.ms > SLOW_MS ? 'text-negative' : t2}`}>{fmtMs(tip.p.ms)}</div>
          </div>
        )}
      </div>
      <ul className={`mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] leading-4 ${t2}`} aria-hidden>
        {[['var(--ink)', `Up to ${TARGET_MS} ms`], ['var(--data-c2)', `${TARGET_MS + 1}–${SLOW_MS} ms`], ['var(--negative)', `Over ${SLOW_MS.toLocaleString('en-US')} ms`]].map(([c, l]) => (
          <li key={l} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</li>
        ))}
      </ul>

      <div className="mt-4">
        <Insight explain={explain} text={insight} evidence={{
          keys: ['over'],
          calc: over.length ? `Highlighted: pages slower than the ${TARGET_MS} ms target (${over.map((p) => p.path).join(', ')}).` : `No page is slower than ${TARGET_MS} ms.`,
        }} />
      </div>
    </Card>
  )
}
function topSection(list) {
  const n = new Map()
  for (const p of list) n.set(p.section, (n.get(p.section) ?? 0) + 1)
  const [s] = [...n].sort((x, y) => y[1] - x[1])[0]
  return s === '/' ? 'the home page' : s
}

// "Which pages are slowest?" — top 8, bar against the slowest
function SlowestPages() {
  const { a } = useAudit()
  const rows = a.crawl.slowest.slice(0, 8)
  const top = rows[0]?.ms ?? 1
  return (
    <Card className="flex h-full min-w-0 flex-col p-5">
      <h2 className={cardTitle}>Slowest pages</h2>
      <p className={subtitle}>Which pages make crawlers wait longest?</p>
      <ul className="mt-3">
        {rows.map((p) => (
          <li key={p.path}>
            <button type="button" onClick={() => openDrawer('page', p.path)} aria-label={`${p.path}: ${fmtMs(p.ms)}. Open page details`}
              className="group -mx-2 flex h-8 w-[calc(100%+16px)] items-center gap-3 rounded-md px-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus">
              <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-stone-900" title={p.path}>{p.path}</span>
              <HBar value={p.ms} max={top} className="w-16" />
              <span className={`w-[72px] shrink-0 text-right text-[14px] leading-5 tabular-nums ${p.ms > SLOW_MS ? 'text-negative' : 'text-stone-900'}`}>{fmtMs(p.ms)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ---- Site structure + Status codes share one row template, so their columns line up across the row:
// label · descriptor | count | bar | chevron. Zero rows are t3, track only, not clickable.
const ROW = 'grid h-10 w-[calc(100%+16px)] grid-cols-[minmax(0,1fr)_40px_96px_16px] items-center gap-4 rounded-md -mx-2 px-2 text-left md:grid-cols-[minmax(0,1fr)_48px_200px_16px]'
// desc: a string, or [text, suffix] where the suffix ("+2 more") never truncates
function StatRow({ name, desc, count, max, fill = 'var(--ink)', countCls = 'text-stone-900', onClick, label, hlProps }) {
  const [text, more] = Array.isArray(desc) ? desc : [desc, null]
  const zero = count === 0
  const body = (
    <>
      <span className={`flex min-w-0 items-baseline whitespace-nowrap text-[14px] leading-5 ${zero ? t3 : 'text-stone-900'}`}>
        <span className="shrink-0">{name}</span>
        <span className={`min-w-0 truncate ${t3}`}>&nbsp;·&nbsp;{text}</span>
        {more && <span className={`shrink-0 ${t3}`}>&nbsp;{more}</span>}
      </span>
      <span className={`text-right text-[14px] leading-5 tabular-nums ${zero ? t3 : countCls}`}>{count}</span>
      <span className="block h-1.5 overflow-hidden rounded-full bg-tint" aria-hidden>
        {!zero && <span className="block h-full min-w-[6px] rounded-full" style={{ width: `${(count / max) * 100}%`, background: fill }} />}
      </span>
      {zero ? <span className="w-4" aria-hidden /> : <ChevronRight size={16} className={t3} aria-hidden />}
    </>
  )
  if (zero) return <div className={ROW} {...hlProps}>{body}</div>
  return (
    <button type="button" onClick={onClick} aria-label={label} {...hlProps}
      className={`${ROW} cursor-pointer outline-none transition-colors duration-150 ease-out hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus`}>
      {body}
    </button>
  )
}
const plural = (n, one, many) => (n === 1 ? one : many)

// "How many clicks from the home page is each page?" — 2xx pages only (a redirect isn't a page)
function SiteStructure() {
  const { a } = useAudit()
  const explain = useExplain(a.key)
  const depths = a.crawl.depths
  const max = Math.max(...depths.map((d) => d.count))
  const deepest = depths.at(-1)?.depth ?? 0
  const deep = depths.filter((d) => d.depth > MAX_CLICKS)
  const deepCount = deep.reduce((n, d) => n + d.count, 0)
  const text = deepCount
    ? `${deepCount} ${plural(deepCount, 'page is', 'pages are')} ${MAX_CLICKS + 1}+ clicks deep. AI crawlers may skip them.`
    : `Every page is within ${deepest} ${plural(deepest, 'click', 'clicks')} of home.`
  const keys = (deepCount ? deep : depths.slice(-1)).map((d) => `depth:${d.depth}`)
  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5 pb-3">
      <h2 className={cardTitle}>Site structure</h2>
      <p className={subtitle}>How many clicks from the home page is each page?</p>
      <div className="mt-3 space-y-1">
        {depths.map((d) => (
          <StatRow key={d.depth} name={`Depth ${d.depth}`} desc={d.label} count={d.count} max={max}
            onClick={() => setParams({ tab: 'pages', depth: String(d.depth), section: null, status: null })}
            label={`Depth ${d.depth}, ${d.label}: ${d.count} pages. Show them`}
            hlProps={hl(explain, `depth:${d.depth}`, { row: true, flush: true })} />
        ))}
      </div>
      <div className="mt-auto pt-4">
        <Insight explain={explain} text={text} evidence={{
          keys,
          calc: `Counted: pages that return 2xx, by clicks from the home page. Deepest: ${deepest} ${plural(deepest, 'click', 'clicks')}.`,
        }} />
      </div>
    </Card>
  )
}

// "Do crawlers get the page, a redirect, or an error?"
function StatusCodes() {
  const { a } = useAudit()
  const explain = useExplain(a.key)
  const codes = a.crawl.codes
  const all = a.pages.length
  const ok = codes[0].count === all
  const max = Math.max(...codes.map((c) => c.count))
  const errors = codes.filter((c) => c.bad).flatMap((c) => c.pages)
  const redirects = codes.find((c) => c.id === '3xx').pages
  const only404 = errors.every((p) => p.code === 404)
  const text = errors.length
    ? `${errors.length} ${plural(errors.length, 'page returns', 'pages return')} ${only404 ? '404' : 'an error'}. AI crawlers can’t read ${plural(errors.length, 'it', 'them')}.`
    : redirects.length ? `${redirects.length} ${plural(redirects.length, 'redirect', 'redirects')}: link to the final URL instead.` : 'Every page loads for crawlers.'
  const problem = codes.filter((c) => c.id !== '2xx' && c.count > 0)
  const lit = errors.length ? problem.filter((c) => c.bad) : problem // the rows the footer is about
  const keys = lit.map((c) => `code:${c.id}`)
  const desc = (c) => {
    if (c.id === '2xx' || !c.count) return c.id
    const p = c.pages[0]
    const first = c.id === '3xx' && p.redirectTo ? `${p.path} → ${p.redirectTo}` : p.path
    return c.count > 1 ? [first, `+${c.count - 1} more`] : first
  }
  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5 pb-3">
      <h2 className={cardTitle}>Status codes</h2>
      <p className={subtitle}>Do crawlers get the page, a redirect, or an error?</p>
      {ok ? (
        <p className="mt-4 flex items-center gap-2 text-[14px] leading-5 text-stone-900"><CheckIcon status="pass" />All {all} pages return 200 OK</p>
      ) : (
        <div className="mt-3 space-y-1">
          {codes.map((c) => (
            <StatRow key={c.id} name={c.name} desc={desc(c)} count={c.count} max={max} fill={c.fill}
              countCls={c.bad ? 'text-negative' : 'text-stone-900'}
              onClick={() => openDrawer('codes', c.id)}
              label={`${c.name}, ${c.id}: ${c.count} ${plural(c.count, 'page', 'pages')}. Show them`}
              hlProps={hl(explain, `code:${c.id}`, { row: true, flush: true })} />
          ))}
        </div>
      )}
      <div className="mt-auto pt-4">
        <Insight explain={explain} text={text} evidence={{
          keys,
          calc: lit.length ? `Highlighted: ${lit.map((c) => `${c.count} ${c.name.toLowerCase()} (${c.id})`).join(', ')}, out of ${all} addresses crawled.` : `All ${all} addresses crawled return 2xx.`,
        }} />
      </div>
    </Card>
  )
}
