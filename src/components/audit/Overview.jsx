import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, Check, ChevronRight } from 'lucide-react'
import Card from '../dashboard/Card'
import { ScoreRing } from '../dashboard/KpiRow'
import Insight, { hl, useExplain } from '../ui/Insight'
import { fmtMin } from '../ui/ActionSteps'
import DrawerShell, { useDrawer } from './DrawerShell'
import { useAudit } from './context'
import { CheckIcon, openDrawer, openIssue } from './parts'
import { CATEGORIES, IMPACT, TARGET_MS, byStatus, groupBySection, planScore, sectionLabel } from '../../data/audit'

// Overview: one KPI strip card → a slim "since last run" band → the plan (waterfall beside the numbered list) → where
// the problems are (sections × categories + most common problem) beside the pages that fail most.
// Score weights: data/auditReference.js.
const t2 = 'text-stone-600'
const t3 = 'text-stone-500'
const cardTitle = 'text-[15px] leading-5 font-semibold text-stone-900'
const subtitle = `mt-0.5 text-[13px] leading-[18px] ${t2}`
const linkCls = 'inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus'
const PLAN_STEPS = 5
const pts = (v) => (Number.isInteger(v) ? `${v}` : v.toFixed(1))

export default function Overview({ setTab }) {
  const { a } = useAudit()
  const [hover, setHover] = useState(null) // a plan check id: shared by the waterfall and the plan rows
  return (
    <>
      <Kpis setTab={setTab} />
      <SinceBand />
      <div id="audit-plan" className="min-w-0 scroll-mt-6"><NextSteps setTab={setTab} hover={hover} setHover={setHover} /></div>
      {/* heights follow content: the two cards aren't alike, so they aren't stretched to match */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2"><ProblemAreas setTab={setTab} /></div>
        <WorstPages setTab={setTab} />
      </div>
      {/* the page ends 64px under the last card (main has 40px + the 16px gap) */}
      <div className="h-2" aria-hidden />
      {a.since && <SinceDrawer />}
    </>
  )
}

// ---- KPI strip: one card, 4 sections split by dividers (the Trends strip); every section opens something
function Section({ i, label, value, meta, link, onOpen }) {
  const open = (e) => { if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }
  // 2 × 2 on phones (left divider on the right column, top divider on the second row); 4 across from lg
  const edges = `${i % 2 ? 'border-l' : ''} ${i > 1 ? 'border-t lg:border-t-0' : ''} border-[var(--div)]`
  return (
    <div className={`p-1 ${edges}`}>
      <div role="link" tabIndex={0} onClick={open} onKeyDown={open} aria-label={`${label}: ${link}`}
        className="group flex h-full min-w-0 cursor-pointer flex-col rounded-xl p-4 outline-none transition-colors duration-150 ease-out hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus max-md:p-3">
        <div className={`text-[13px] leading-[18px] ${t2}`}>{label}</div>
        <div className="mt-1 flex h-14 items-center">{value}</div>
        <div className={`mt-0.5 text-[13px] leading-[18px] ${t3} tabular-nums`}>{meta}</div>
        <div className={`mt-3 inline-flex items-center gap-1 text-[13px] leading-[18px] font-medium ${t2} transition-colors duration-150 group-hover:text-ink`}>
          {link}<ArrowRight size={14} className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
        </div>
      </div>
    </div>
  )
}
const big = (v) => <span className="text-[32px] leading-10 font-semibold tracking-[-0.02em] text-stone-900 tabular-nums">{v}</span>
function Kpis({ setTab }) {
  const { a } = useAudit()
  const delta = a.since ? a.score - a.since.scoreFrom : null
  const over = a.pages.filter((p) => p.ms > TARGET_MS).length
  return (
    <Card className="grid grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-[var(--div)]">
      <Section i={0} label="AI readiness" link="View score" onOpen={() => document.getElementById('audit-plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        value={<ScoreRing value={a.score} size={56} />}
        meta={delta == null ? 'First audit' : delta === 0 ? `No change since ${a.since.date}` : <><span className={delta > 0 ? 'text-ink' : 'text-negative'}>{delta > 0 ? '▲' : '▼'}</span> {Math.abs(delta)} since {a.since.date}</>} />
      <Section i={1} label="Failing checks" link="View checks" onOpen={() => setTab('checks', { status: 'fail' })} value={big(a.failing.length)} meta={`Of ${a.open.length} to fix`} />
      <Section i={2} label="Pages with issues" link="View pages" onOpen={() => setTab('pages', { status: 'failing' })} value={big(a.failingPages.length)} meta={`Of ${a.pages.length} crawled`} />
      <Section i={3} label="Median response" link="View crawl" onOpen={() => setTab('crawl')}
        value={<span className="flex items-baseline gap-1">{big(a.crawl.median)}<span className="text-small font-semibold text-stone-500">ms</span></span>}
        meta={over ? `${over} ${over === 1 ? 'page' : 'pages'} over ${TARGET_MS} ms` : `Every page under ${TARGET_MS} ms`} />
    </Card>
  )
}

// ---- What to do next: the waterfall (left, fills its column) beside the numbered plan (right)
function Waterfall({ score, plan, hover, setHover }) {
  const box = useRef(null)
  const [w, setW] = useState(360)
  useEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])
  const H = 220, LABEL = 20, AXIS = 24 // plot = H − LABEL (value labels) − AXIS (x labels)
  const plot = H - LABEL - AXIS
  const after = score + plan.reduce((n, c) => n + c.adds, 0)
  const top = Math.max(after, score)
  const y = (v) => LABEL + plot - (v / top) * plot
  let run = score
  const bars = [
    { key: 'now', x: 'Now', from: 0, to: score, kind: 'now', top: `${score}` },
    ...plan.map((c, i) => { const b = { key: c.id, x: String(i + 1), from: run, to: run + c.adds, kind: 'step', top: `+${pts(c.adds)}`, c }; run += c.adds; return b }),
    { key: 'after', x: 'If fixed', from: 0, to: after, kind: 'after', top: `${Math.round(after)}` },
  ]
  const n = bars.length
  // bars flex to the width (24–48px); the slack goes to the gaps between them
  const W = Math.max(24, Math.min(48, Math.floor((w * 0.6) / n)))
  const GAP = n > 1 ? Math.max(8, (w - n * W) / (n - 1)) : 0
  const left = (i) => i * (W + GAP)
  const MIN = 6 // the smallest step stays readable
  const geo = bars.map((b) => {
    if (b.kind !== 'step') return { top: y(b.to), h: y(b.from) - y(b.to) }
    const h = Math.max(MIN, y(b.from) - y(b.to))
    return { top: y(b.from) - h, h }
  })
  return (
    <div ref={box} className="relative w-full" style={{ height: H, minWidth: n * 32 }} onMouseLeave={() => setHover(null)}
      role="img" aria-label={`Score ${score} now; ${plan.map((c, i) => `step ${i + 1} adds ${pts(c.adds)}`).join(', ')}; ${Math.round(after)} if fixed`}>
      <div className="absolute inset-x-0 border-t border-line" style={{ top: y(0) }} aria-hidden />
      {bars.slice(0, -1).map((b, i) => (
        <div key={`c-${b.key}`} className="absolute border-t border-dashed border-stone-500" style={{ left: left(i) + W, width: GAP, top: geo[i].top + (b.kind === 'step' ? 0 : 0) }} aria-hidden />
      ))}
      {bars.map((b, i) => {
        const on = b.c && hover === b.c.id
        const style = { left: left(i), width: W, top: geo[i].top, height: Math.max(2, geo[i].h) }
        return (
          <div key={b.key}>
            <span className={`absolute -translate-x-1/2 whitespace-nowrap text-[13px] leading-4 font-semibold tabular-nums ${b.kind === 'now' ? t2 : 'text-stone-900'}`} style={{ left: left(i) + W / 2, top: geo[i].top - LABEL + 2 }}>{b.top}</span>
            {b.kind === 'step'
              ? <span onMouseEnter={() => setHover(b.c.id)} className="absolute cursor-default rounded-[3px] transition-colors duration-150 ease-out" style={{ ...style, background: on ? 'var(--ink)' : 'var(--data-c2)' }} />
              : b.kind === 'now'
                ? <span className="absolute rounded-[3px] bg-ink" style={style} />
                : <span className="absolute rounded-[3px] border-[1.5px] border-dashed border-ink" style={style} />}
            {/* the last label ends at the chart's right edge, so "If fixed" never clips */}
            <span className={`absolute whitespace-nowrap text-[13px] leading-[18px] ${i === n - 1 ? '' : '-translate-x-1/2'} ${on ? 'font-semibold text-ink' : t3}`}
              style={i === n - 1 ? { right: Math.max(0, w - left(i) - W), top: H - AXIS + 4 } : { left: left(i) + W / 2, top: H - AXIS + 4 }}>{b.x}</span>
          </div>
        )
      })}
    </div>
  )
}

function NextSteps({ setTab, hover, setHover }) {
  const { a } = useAudit()
  const plan = [...a.open].sort((x, y) => planScore(y) - planScore(x) || byStatus(x, y)).slice(0, PLAN_STEPS)
  const minutes = plan.reduce((n, c) => n + c.effort, 0)
  const hovered = plan.find((c) => c.id === hover)
  const where = (c) => (c.pageBased ? groupBySection(c.pages).slice(0, 2).map((g) => sectionLabel(g.section)).join(', ') + (groupBySection(c.pages).length > 2 ? ' +' : '') : 'Site-wide')
  const cols = 'grid-cols-[24px_minmax(0,1fr)_44px_16px] md:grid-cols-[24px_minmax(0,1fr)_140px_48px_64px_16px]'
  const footer = (
    <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--div)] py-3">
      <span className={`text-[13px] leading-[18px] ${t3} tabular-nums`}>{plan.length ? `About ${fmtMin(minutes)} of work` : ''}</span>
      <button type="button" onClick={() => setTab('checks')} className={`${linkCls} max-md:h-10`}>All {a.open.length} checks <ArrowRight size={14} aria-hidden /></button>
    </div>
  )
  return (
    <Card className="min-w-0 px-5 pt-5 max-md:px-4">
      <h2 className={cardTitle}>What to do next</h2>
      <p className={subtitle}>What should we fix first, and what does each fix add to the score?</p>
      {plan.length ? (
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[5fr_7fr] lg:gap-8">
          <div className="min-w-0 lg:pb-5">
            <div className="no-scrollbar overflow-x-auto"><Waterfall score={a.score} plan={plan} hover={hover} setHover={setHover} /></div>
            <p className={`mt-2 h-5 truncate text-[13px] leading-5 ${t2} tabular-nums max-md:hidden transition-opacity duration-150 ${hovered ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
              {hovered ? `${hovered.action} · +${pts(hovered.adds)}` : ''}
            </p>
          </div>
          <div className="flex min-w-0 flex-col lg:border-l lg:border-[var(--div)] lg:pl-8">
            <div className={`grid h-8 ${cols} items-center gap-3 text-[13px] leading-[18px] ${t3}`} aria-hidden>
              <span /><span>Fix</span><span className="max-md:hidden">Area</span><span className="text-right">Adds</span><span className="max-md:hidden">Effort</span><span />
            </div>
            <ol className="divide-y divide-[var(--div)] border-t border-[var(--div)]">
              {plan.map((c, i) => (
                <li key={c.id}>
                  <button type="button" onClick={() => openIssue(c.id)} onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(c.id)} onBlur={() => setHover(null)}
                    aria-label={`Step ${i + 1}: ${c.action}. Adds ${pts(c.adds)} points, about ${fmtMin(c.effort)}. Open`}
                    className={`group -mx-2 grid min-h-12 w-[calc(100%+16px)] py-1.5 md:h-12 md:py-0 ${cols} items-center gap-3 rounded-md px-2 text-left outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${hover === c.id ? 'bg-tint' : 'hover:bg-tint'}`}>
                    <span className={`grid h-6 w-6 place-items-center rounded-full border text-[13px] leading-none tabular-nums transition-colors duration-150 ${hover === c.id ? 'border-ink bg-ink text-on-ink' : `border-line ${t2}`}`}>{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] leading-5 font-medium text-stone-900 max-md:line-clamp-2 max-md:whitespace-normal" title={c.action}>{c.action}</span>
                      <span className={`block text-[13px] leading-[18px] ${t3} tabular-nums md:hidden`}>{fmtMin(c.effort)}</span>
                    </span>
                    <span className={`truncate text-[13px] leading-[18px] ${t3} max-md:hidden`}>{where(c)}</span>
                    <span className="text-right text-[14px] leading-5 font-semibold text-stone-900 tabular-nums">+{pts(c.adds)}</span>
                    <span className={`text-[13px] leading-[18px] ${t2} tabular-nums max-md:hidden`}>{fmtMin(c.effort)}</span>
                    <ChevronRight size={14} className="text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
                  </button>
                </li>
              ))}
            </ol>
            {footer}
          </div>
        </div>
      ) : (
        <>
          <p className={`mt-4 flex items-center gap-2 text-[14px] leading-5 ${t2}`}><CheckIcon status="pass" />Nothing to fix. Every check passes.</p>
          {footer}
        </>
      )}
    </Card>
  )
}

// ---- Since last run: score per run as mini bars + 4 counts with a preview, each opening a drawer with the items
const SINCE_ROWS = [['newly', 'Newly failing'], ['fixed', 'Fixed'], ['added', 'Pages added'], ['removed', 'Pages gone']]
function sinceItems(s, key) {
  if (key === 'newly') return s.newlyFailing.map((c) => ({ id: c.id, label: c.label, check: true, status: 'fail' }))
  if (key === 'fixed') return s.fixed.map((c) => ({ id: c.id, label: c.label, check: true, status: 'pass' }))
  return (key === 'added' ? s.added : s.removed).map((p) => ({ id: p, label: p }))
}
// run history as 6px mini bars in 32px (relative scale: the lowest score a quarter of the height), last run in ink
function RunBars({ history }) {
  const lo = Math.min(...history.map((h) => h.score)), hi = Math.max(...history.map((h) => h.score))
  const h = (v) => Math.round((0.25 + (0.75 * (v - lo)) / Math.max(1, hi - lo)) * 32)
  return (
    <span className="flex h-8 items-end gap-1" role="img" aria-label={`AI readiness by audit: ${history.map((r) => `${r.date} ${r.score}`).join(', ')}`}>
      {history.map((r, i) => <span key={r.date} className="w-1.5 rounded-t-[2px]" style={{ height: h(r.score), background: i === history.length - 1 ? 'var(--ink)' : 'var(--data-c3)' }} />)}
    </span>
  )
}
const STAT_WORDS = { newly: ['newly failing', 'newly failing'], fixed: ['fixed', 'fixed'], added: ['page added', 'pages added'], removed: ['page gone', 'pages gone'] }
function SinceBand() {
  const { a } = useAudit()
  const s = a.since
  if (!s) {
    return (
      <Card className="flex min-h-16 min-w-0 items-center gap-3 px-5 py-3 max-md:px-4">
        <span className="shrink-0 whitespace-nowrap text-[14px] leading-5 font-semibold text-stone-900">Since last run</span>
        <span className={`text-[14px] leading-5 ${t2}`}>Changes show up after your next audit.</span>
      </Card>
    )
  }
  return (
    <Card className="flex min-w-0 flex-col gap-3 px-5 py-3 max-md:px-4 md:h-16 md:flex-row md:items-center md:gap-0 md:py-0">
      <div className="flex shrink-0 items-center gap-3 md:pr-5">
        <RunBars history={s.history} />
        <span className={`whitespace-nowrap text-[13px] leading-[18px] ${t3}`}>{s.history[0].date} → {s.history.at(-1).date}</span>
      </div>
      <ul className="grid grid-cols-2 gap-1 md:flex md:flex-1 md:self-stretch md:gap-0">
        {SINCE_ROWS.map(([key]) => {
          const n = sinceItems(s, key).length
          const icon = key === 'newly' ? <AlertCircle size={14} className={n ? 'text-negative' : ''} /> : key === 'fixed' ? <Check size={14} className={n ? 'text-ink' : ''} /> : null
          const body = <>{icon && <span aria-hidden>{icon}</span>}<span><span className="tabular-nums">{n}</span> {STAT_WORDS[key][n === 1 ? 0 : 1]}</span></>
          const cls = `flex h-10 w-full items-center gap-1.5 rounded-md px-3 text-[14px] leading-5 md:h-full md:justify-center md:rounded-none`
          const tone = key === 'newly' && n ? 'text-negative' : n ? 'text-stone-900' : t3
          return (
            <li key={key} className="md:flex md:flex-1 md:items-center md:border-l md:border-[var(--div)]">
              {n ? (
                <button type="button" onClick={() => openDrawer('since', key)} aria-label={`${n} ${STAT_WORDS[key][n === 1 ? 0 : 1]} since ${s.date}. Show them`}
                  className={`${cls} ${tone} outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus`}>{body}</button>
              ) : <div className={`${cls} ${tone}`}>{body}</div>}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
function SinceDrawer() {
  const { a } = useAudit()
  const lists = useMemo(() => (a.since ? Object.fromEntries(SINCE_ROWS.map(([k, l]) => [k, { key: k, title: l, items: sinceItems(a.since, k) }])) : {}), [a])
  const drawer = useDrawer('since', (k) => lists[k] ?? null)
  const d = drawer.item
  if (!d) return null
  const pages = d.key === 'added' || d.key === 'removed'
  return (
    <DrawerShell drawer={drawer} title={d.title} meta={<span>Since {a.since.date} · {d.items.length} {pages ? (d.items.length === 1 ? 'page' : 'pages') : (d.items.length === 1 ? 'check' : 'checks')}</span>}>
      <ul className="mt-4 divide-y divide-[var(--div)] border-y border-[var(--div)]">
        {d.items.map((it) => (
          <li key={it.id}>
            {it.check || d.key === 'added' ? (
              <button type="button" onClick={() => (it.check ? openIssue(it.id) : openDrawer('page', it.id))}
                className="group -mx-2 flex h-11 w-[calc(100%+16px)] items-center gap-3 rounded-md px-2 text-left outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                {it.check && <CheckIcon status={it.status} />}
                <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-stone-900">{it.label}</span>
                <ChevronRight size={14} className="text-stone-500" aria-hidden />
              </button>
            ) : <div className={`flex h-11 items-center text-[14px] leading-5 ${t2}`}>{it.label}</div>}
          </li>
        ))}
      </ul>
    </DrawerShell>
  )
}

// ---- Where the problems are: sections × categories (failing page × check pairs); all-zero columns are hidden
const CATS = Object.keys(CATEGORIES)
function ProblemAreas({ setTab }) {
  const { a } = useAudit()
  const explain = useExplain(a.key)
  const [hover, setHover] = useState(null) // [r, c] in shown-column space
  const rows = a.heat
  const colTot = CATS.map((_, c) => rows.reduce((n, r) => n + r.cells[c], 0))
  const shown = CATS.map((cat, c) => ({ cat, c })).filter(({ c }) => colTot[c] > 0)
  const hidden = CATS.filter((_, c) => !colTot[c])
  const max = Math.max(...rows.flatMap((r) => r.cells), 1)
  const top = rows.flatMap((r, ri) => r.cells.map((n, ci) => ({ n, ri, ci }))).sort((x, y) => y.n - x.n)[0]
  const text = !top?.n ? 'No failing checks on any page.' : `Most issues are ${CATEGORIES[CATS[top.ci]].toLowerCase()} problems on ${sectionLabel(rows[top.ri].section)}.`
  const readout = hover && (() => { const r = rows[hover[0]]; const ci = shown[hover[1]].c; const n = r.cells[ci]; return `${n} failing ${CATEGORIES[CATS[ci]].toLowerCase()} ${n === 1 ? 'check' : 'checks'} across the ${r.pages} ${r.pages === 1 ? 'page' : 'pages'} of ${sectionLabel(r.section)}` })()
  const on = (cls) => `${cls} transition-colors duration-150 ease-out`
  const grid = { gridTemplateColumns: `180px repeat(${Math.max(1, shown.length)}, 120px) 56px minmax(160px,1fr)` }
  const common = new Map(a.sections.map((x) => [x.section, x.common]))
  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5 pb-3 max-md:px-4">
      <h2 className={cardTitle}>Where the problems are</h2>
      <p className={subtitle}>Which parts of the site fail which kind of check? Click a cell to see those pages.</p>
      <div className="mt-3">
        <div className="no-scrollbar overflow-x-auto">
          <div className="grid min-w-max items-center gap-1 lg:min-w-0" style={grid}>
            <span />
            {shown.map(({ cat }, k) => <span key={cat} className={on(`truncate pb-0.5 text-center text-[13px] leading-[18px] ${hover?.[1] === k ? 'font-semibold text-ink' : t3}`)}>{CATEGORIES[cat]}</span>)}
            <span className={`pb-0.5 text-right text-[13px] leading-[18px] ${t3}`}>Total</span>
            <span className={`truncate pb-0.5 pl-4 text-[13px] leading-[18px] ${t3}`}>Most common problem</span>
            {rows.map((r, ri) => (
              <HeatRow key={r.section} r={r} ri={ri} shown={shown} max={max} hover={hover} setHover={setHover} explain={explain} on={on} common={common.get(r.section)}
                onPick={(ci) => setTab('pages', { section: r.section, status: 'failing', cat: CATS[ci] })} />
            ))}
          </div>
        </div>
        <p className={`mt-2 h-5 truncate text-[13px] leading-5 ${t2} tabular-nums transition-opacity duration-150 ease-out ${readout ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">{readout ?? ''}</p>
        {hidden.length > 0 && <p className={`text-[13px] leading-[18px] ${t3}`}>No {hidden.map((c) => CATEGORIES[c].toLowerCase()).join(' or ')} issues found.</p>}
      </div>
      <div className="mt-auto pt-3">
        <Insight explain={explain} text={text} evidence={{
          keys: top?.n ? [`heat:${top.ri}:${top.ci}`] : [],
          calc: 'Each cell counts failing checks on each page of the section (a page failing 2 checks counts 2).',
        }} />
      </div>
    </Card>
  )
}
function HeatRow({ r, ri, shown, max, hover, setHover, explain, on, onPick, common }) {
  const rowOn = hover?.[0] === ri
  return (
    <>
      <span className={on(`min-w-0 truncate text-[14px] leading-5 ${rowOn ? 'font-semibold text-ink' : 'text-stone-900'}`)}>
        {sectionLabel(r.section)}<span className={`text-[13px] font-normal ${t3} tabular-nums`}> · {r.pages} {r.pages === 1 ? 'page' : 'pages'}</span>
      </span>
      {shown.map(({ c: ci }, k) => {
        const n = r.cells[ci]
        if (!n) return <span key={ci} className={`grid h-8 place-items-center text-[14px] ${t3}`} {...hl(explain, `heat:${ri}:${ci}`)}>—</span>
        const o = 4 + (n / max) * 36 // 4% → 40%: light enough that the text stays ink
        const active = hover?.[0] === ri && hover?.[1] === k
        return (
          <button key={ci} type="button" onClick={() => onPick(ci)}
            onMouseEnter={() => setHover([ri, k])} onMouseLeave={() => setHover(null)} onFocus={() => setHover([ri, k])} onBlur={() => setHover(null)}
            aria-label={`${sectionLabel(r.section)}, ${CATEGORIES[CATS[ci]]}: ${n} failing checks. Show those pages`}
            {...hl(explain, `heat:${ri}:${ci}`)}
            className={`h-8 rounded-md text-center text-[14px] leading-5 font-semibold text-ink tabular-nums outline-none ring-inset transition-[box-shadow] duration-150 ease-out ${active ? 'ring-[1.5px] ring-ink' : 'ring-0'}`}
            style={{ background: `color-mix(in srgb, var(--ink) ${o}%, transparent)` }}>
            {n}
          </button>
        )
      })}
      <span className={`text-right text-[13px] leading-[18px] ${t3} tabular-nums`}>{r.total || '—'}</span>
      <span className={`min-w-0 truncate pl-4 text-[13px] leading-[18px] ${common ? t2 : t3}`} title={common?.problem}>{common?.problem ?? 'No problems'}</span>
    </>
  )
}

// ---- Pages that fail most: the 6 pages with the most failing checks (then the heaviest checks) → the page drawer
function WorstPages({ setTab }) {
  const { a } = useAudit()
  const weight = (p) => p.failing.reduce((n, id) => n + (IMPACT[a.checkById(id)?.impact]?.level ?? 0), 0)
  const rows = [...a.pages].filter((p) => p.failCount).sort((x, y) => y.failCount - x.failCount || weight(y) - weight(x) || y.ms - x.ms).slice(0, 6)
  const names = (p) => p.failing.map((id) => a.checkById(id)).filter(Boolean).sort((x, y) => IMPACT[y.impact].level - IMPACT[x.impact].level).map((c) => c.label).join(', ')
  return (
    <Card className="flex min-w-0 flex-col px-5 pt-5 max-md:px-4">
      <h2 className={cardTitle}>Pages that fail most</h2>
      <p className={subtitle}>Which single pages need the most fixing?</p>
      {rows.length ? (
        <ul className="mt-3 divide-y divide-[var(--div)] border-t border-[var(--div)]">
          {rows.map((p) => (
            <li key={p.path}>
              <button type="button" onClick={() => openDrawer('page', p.path)} aria-label={`${p.path}: ${p.failCount} failing checks (${names(p)}). Open`}
                className="group -mx-2 grid h-14 w-[calc(100%+16px)] grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-3 rounded-md px-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] leading-5 text-stone-900" title={p.path}>{p.path}</span>
                  <span className={`block truncate text-[13px] leading-[18px] ${t3}`}>{names(p)}</span>
                </span>
                <span className="text-[13px] leading-[18px] text-negative tabular-nums">{p.failCount} failing</span>
                <ChevronRight size={14} className="text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : <p className={`mt-3 flex items-center gap-2 border-t border-[var(--div)] py-4 text-[14px] leading-5 ${t2}`}><CheckIcon status="pass" />No page fails a check.</p>}
      <div className="mt-auto border-t border-[var(--div)] py-3">
        <button type="button" onClick={() => setTab('pages')} className={`${linkCls} max-md:h-10`}>All {a.pages.length} pages <ArrowRight size={14} aria-hidden /></button>
      </div>
    </Card>
  )
}
