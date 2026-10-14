import { useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, Check, ChevronRight } from 'lucide-react'
import Card from '../dashboard/Card'
import KpiCard from '../dashboard/KpiCard'
import { Num, ScoreRing } from '../dashboard/KpiRow'
import Insight, { hl, useExplain } from '../ui/Insight'
import { fmtMin } from '../ui/ActionSteps'
import DrawerShell, { useDrawer } from './DrawerShell'
import { useAudit } from './context'
import { CheckIcon, openDrawer, openIssue } from './parts'
import { CATEGORIES, TARGET_MS, byStatus, groupBySection, planScore, sectionLabel } from '../../data/audit'

// Overview: KPI strip (the Visibility Overview tile) → the plan as a waterfall of score points + what changed since the
// last run → where the problems are (sections × categories) beside the pages that fail most.
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
      {/* first run: nothing to compare, so the plan takes the row and "Since last run" is one line under it */}
      <div className={`grid grid-cols-1 items-stretch gap-4 ${a.since ? 'lg:grid-cols-3' : ''}`}>
        <div id="audit-plan" className="min-w-0 scroll-mt-6 lg:col-span-2"><NextSteps setTab={setTab} hover={hover} setHover={setHover} /></div>
        <SinceLastRun />
      </div>
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2"><ProblemAreas setTab={setTab} /></div>
        <WorstPages setTab={setTab} />
      </div>
      {/* the page ends 64px under the last card (main has 40px) */}
      <div className="h-2" aria-hidden />
      <SinceDrawer />
    </>
  )
}

// ---- KPI strip: dashboard/KpiCard with the Visibility Overview ring and value type; no corner icons
function Kpis({ setTab }) {
  const { a } = useAudit()
  const delta = a.since ? a.score - a.since.scoreFrom : null
  const over = a.pages.filter((p) => p.ms > TARGET_MS).length
  const unit = (u) => <span className="text-small font-semibold text-stone-500 tabular-nums">{u}</span>
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <KpiCard label="AI readiness" link="View score" onOpen={() => document.getElementById('audit-plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <ScoreRing value={a.score} />
          <span className="text-small font-semibold text-stone-600 tabular-nums">
            {delta == null ? <span className="text-stone-500">First audit</span> : delta === 0 ? <span className="text-stone-500">No change since {a.since.date}</span>
              : <><span className={delta > 0 ? 'text-ink' : 'text-negative'}>{delta > 0 ? '▲' : '▼'}</span> {Math.abs(delta)} since {a.since.date}</>}
          </span>
        </div>
      </KpiCard>
      <KpiCard label="Failing checks" link="View checks" onOpen={() => setTab('checks', { status: 'fail' })}>
        <div className="flex items-baseline gap-1.5"><Num value={a.failing.length} />{unit(`of ${a.open.length} to fix`)}</div>
      </KpiCard>
      <KpiCard label="Pages with issues" link="View pages" onOpen={() => setTab('pages', { status: 'failing' })}>
        <div className="flex items-baseline gap-1.5"><Num value={a.failingPages.length} />{unit(`of ${a.pages.length}`)}</div>
      </KpiCard>
      <KpiCard label="Median response" link="View crawl" onOpen={() => setTab('crawl')}>
        <div className="flex items-baseline gap-1.5"><Num value={a.crawl.median} />{unit('ms')}</div>
        <div className="mt-1 text-[13px] leading-[18px] text-stone-600 tabular-nums">{over ? `${over} ${over === 1 ? 'page' : 'pages'} over ${TARGET_MS} ms` : `Every page under ${TARGET_MS} ms`}</div>
      </KpiCard>
    </div>
  )
}

// ---- What to do next: a waterfall of score points (Now → each step → If fixed) over the numbered plan
function Waterfall({ score, plan, hover, setHover }) {
  const H = 150, LABEL = 18, AXIS = 22 // plot = H − LABEL (room for the value labels) − AXIS (x labels)
  const plot = H - LABEL - AXIS
  const after = score + plan.reduce((n, c) => n + c.adds, 0)
  const top = Math.max(after, score) // scale to the tallest bar, so each step's points are as tall as they can be
  const y = (v) => LABEL + plot - (v / top) * plot // value → px from the top
  let run = score
  const bars = [
    { key: 'now', x: 'Now', from: 0, to: score, kind: 'now', top: null },
    ...plan.map((c, i) => { const b = { key: c.id, x: String(i + 1), from: run, to: run + c.adds, kind: 'step', top: `+${pts(c.adds)}`, c }; run += c.adds; return b }),
    { key: 'after', x: 'If fixed', from: 0, to: after, kind: 'after', top: `${Math.round(after)}` },
  ]
  const W = 28, GAP = 12
  const left = (i) => i * (W + GAP)
  return (
    <div className="relative" style={{ height: H, width: bars.length * W + (bars.length - 1) * GAP }} onMouseLeave={() => setHover(null)}
      role="img" aria-label={`Score ${score} now; ${plan.map((c, i) => `step ${i + 1} adds ${pts(c.adds)}`).join(', ')}; ${Math.round(after)} if fixed`}>
      {/* baseline */}
      <div className="absolute inset-x-0 border-t border-line" style={{ top: y(0) }} aria-hidden />
      {/* dashed connectors from each bar's top to the next bar */}
      {bars.slice(0, -1).map((b, i) => (
        <div key={`c-${b.key}`} className="absolute border-t border-dashed border-stone-500" style={{ left: left(i) + W, width: GAP, top: y(b.to) }} aria-hidden />
      ))}
      {bars.map((b, i) => {
        const on = b.c && hover === b.c.id
        const style = { left: left(i), width: W, top: y(b.to), height: Math.max(2, y(b.from) - y(b.to)) }
        return (
          <div key={b.key}>
            {b.top && <span className="absolute -translate-x-1/2 whitespace-nowrap text-[13px] leading-4 font-semibold text-stone-900 tabular-nums" style={{ left: left(i) + W / 2, top: y(b.to) - LABEL }}>{b.top}</span>}
            {b.kind === 'step'
              ? <span onMouseEnter={() => setHover(b.c.id)} className="absolute cursor-default rounded-[3px] transition-colors duration-150 ease-out" style={{ ...style, background: on ? 'var(--ink)' : 'var(--data-c2)' }} />
              : b.kind === 'now'
                ? <span className="absolute rounded-[3px] bg-ink" style={style} />
                : <span className="absolute rounded-[3px] border-[1.5px] border-dashed border-ink" style={style} />}
            <span className={`absolute -translate-x-1/2 whitespace-nowrap text-[13px] leading-[18px] ${on ? 'font-semibold text-ink' : t3}`} style={{ left: left(i) + W / 2, top: H - AXIS + 4 }}>{b.x}</span>
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
  // phones: effort moves under the action, so the action gets the width
  const cols = 'grid-cols-[24px_minmax(0,1fr)_44px_16px] md:grid-cols-[24px_minmax(0,1fr)_160px_56px_72px_16px]'
  return (
    <Card className="flex h-full min-w-0 flex-col px-5 pt-5 max-md:px-4">
      <h2 className={cardTitle}>What to do next</h2>
      <p className={subtitle}>What should we fix first, and what does each fix add to the score?</p>

      {plan.length > 0 && (
        <div className="mt-4">
          <div className="no-scrollbar overflow-x-auto"><Waterfall score={a.score} plan={plan} hover={hover} setHover={setHover} /></div>
          <p className={`mt-1 h-5 text-[13px] leading-5 ${t2} tabular-nums transition-opacity duration-150 ${hovered ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
            {hovered ? `${hovered.action} · +${pts(hovered.adds)}` : ''}
          </p>
        </div>
      )}

      {plan.length ? (
        <div className="mt-1">
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
                  <span className={`grid h-6 w-6 place-items-center rounded-full border border-line text-[13px] leading-none ${t2} tabular-nums`}>{i + 1}</span>
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
        </div>
      ) : (
        <p className={`mt-4 flex items-center gap-2 text-[14px] leading-5 ${t2}`}><CheckIcon status="pass" />Nothing to fix. Every check passes.</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--div)] py-3">
        <span className={`text-[13px] leading-[18px] ${t3} tabular-nums`}>{plan.length ? `About ${fmtMin(minutes)} of work` : ''}</span>
        <button type="button" onClick={() => setTab('checks')} className={`${linkCls} max-md:h-10`}>All {a.open.length} checks <ArrowRight size={14} aria-hidden /></button>
      </div>
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
function RunBars({ history }) {
  const H = 64
  const n = history.length
  // relative scale (lowest score a quarter of the height) so the trend reads in 46px
  const lo = Math.min(...history.map((h) => h.score)), hi = Math.max(...history.map((h) => h.score))
  const h = (v) => Math.round((0.25 + (0.75 * (v - lo)) / Math.max(1, hi - lo)) * (H - 18))
  return (
    <div className="inline-flex flex-col" role="img" aria-label={`AI readiness by audit: ${history.map((h) => `${h.date} ${h.score}`).join(', ')}`}>
      <div className="relative flex items-end gap-1.5" style={{ height: H }}>
        {history.map((r, i) => (
          <span key={r.date} className="relative w-1.5 rounded-t-[2px]" style={{ height: h(r.score), background: i === n - 1 ? 'var(--ink)' : 'var(--data-c3)' }}>
            {(i === 0 || i === n - 1) && <span className={`absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 text-[13px] leading-4 ${t3} tabular-nums`}>{r.score}</span>}
          </span>
        ))}
      </div>
      <div className="mt-1 border-t border-line" />
      {/* the dates sit under the first and last bars and run outward from them (the chart is narrower than both dates) */}
      <div className={`relative mt-1 h-[18px] text-[13px] leading-[18px] ${t3}`}>
        <span className="absolute right-[calc(100%-6px)] whitespace-nowrap">{history[0].date}</span>
        <span className="absolute left-[calc(100%-6px)] whitespace-nowrap">{history.at(-1).date}</span>
      </div>
    </div>
  )
}
function SinceLastRun() {
  const { a } = useAudit()
  const s = a.since
  if (!s) {
    return (
      <Card className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-4 max-md:px-4">
        <h2 className={cardTitle}>Since last run</h2>
        <p className={`text-[14px] leading-5 ${t2}`}>Changes show up after your next audit.</p>
      </Card>
    )
  }
  return (
    <Card className="flex h-full min-w-0 flex-col px-5 pt-5 pb-3 max-md:px-4">
      <h2 className={cardTitle}>Since last run</h2>
      <p className={subtitle}>What changed since {s.date}?</p>
      {/* run history: wide enough for its first / last dates under the first / last bars */}
      <div className="mt-5 pl-12"><RunBars history={s.history} /></div>
      <ul className="mt-4 divide-y divide-[var(--div)] border-t border-[var(--div)]">
        {SINCE_ROWS.map(([key, label]) => {
          const items = sinceItems(s, key)
          const n = items.length
          const icon = key === 'newly' ? <AlertCircle size={14} className="text-negative" /> : key === 'fixed' ? <Check size={14} className="text-ink" /> : <span className="h-1.5 w-1.5 rounded-full bg-stone-400" />
          const body = (
            <>
              <span className="grid w-4 place-items-center" aria-hidden>{icon}</span>
              <span className="min-w-0 truncate text-[14px] leading-5">
                {label}{n > 0 && <span className={`text-[13px] ${t3}`}> · {items.map((x) => x.label).join(', ')}</span>}
              </span>
              <span className="flex items-center gap-1.5 text-[14px] leading-5 tabular-nums">{n}{n > 0 && <ChevronRight size={14} className="text-stone-500" aria-hidden />}</span>
            </>
          )
          const cls = '-mx-2 grid h-10 w-[calc(100%+16px)] grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 text-left'
          return (
            <li key={key}>
              {n ? <button type="button" onClick={() => openDrawer('since', key)} className={`${cls} text-stone-900 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus`}>{body}</button>
                : <div className={`${cls} ${t3}`}>{body}</div>}
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
  const grid = { gridTemplateColumns: `minmax(0,180px) repeat(${Math.max(1, shown.length)}, minmax(0,1fr)) 56px` }
  return (
    <Card ref={explain.cardRef} className="flex h-full min-w-0 flex-col px-5 pt-5 pb-3 max-md:px-4">
      <h2 className={cardTitle}>Where the problems are</h2>
      <p className={subtitle}>Which parts of the site fail which kind of check? Click a cell to see those pages.</p>
      <div className="mt-3">
        <div className="grid items-center gap-1" style={grid}>
          <span />
          {shown.map(({ cat }, k) => <span key={cat} className={on(`truncate pb-0.5 text-center text-[13px] leading-[18px] ${hover?.[1] === k ? 'font-semibold text-ink' : t3}`)}>{CATEGORIES[cat]}</span>)}
          <span />
          {rows.map((r, ri) => (
            <HeatRow key={r.section} r={r} ri={ri} shown={shown} max={max} hover={hover} setHover={setHover} explain={explain} on={on}
              onPick={(ci) => setTab('pages', { section: r.section, status: 'failing', cat: CATS[ci] })} />
          ))}
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
function HeatRow({ r, ri, shown, max, hover, setHover, explain, on, onPick }) {
  const rowOn = hover?.[0] === ri
  return (
    <>
      <span className={on(`min-w-0 truncate text-[14px] leading-5 ${rowOn ? 'font-semibold text-ink' : 'text-stone-900'}`)}>
        {sectionLabel(r.section)}<span className={`text-[13px] font-normal ${t3} tabular-nums`}> · {r.pages} {r.pages === 1 ? 'page' : 'pages'}</span>
      </span>
      {shown.map(({ c: ci }, k) => {
        const n = r.cells[ci]
        if (!n) return <span key={ci} className={`grid h-9 place-items-center text-[14px] ${t3}`} {...hl(explain, `heat:${ri}:${ci}`)}>—</span>
        const o = 6 + (n / max) * 54 // 6% → 60%; page-colour text past 45%
        const active = hover?.[0] === ri && hover?.[1] === k
        return (
          <button key={ci} type="button" onClick={() => onPick(ci)}
            onMouseEnter={() => setHover([ri, k])} onMouseLeave={() => setHover(null)} onFocus={() => setHover([ri, k])} onBlur={() => setHover(null)}
            aria-label={`${sectionLabel(r.section)}, ${CATEGORIES[CATS[ci]]}: ${n} failing checks. Show those pages`}
            {...hl(explain, `heat:${ri}:${ci}`)}
            className={`h-9 rounded-md text-center text-[14px] leading-5 font-semibold tabular-nums outline-none ring-inset transition-[box-shadow] duration-150 ease-out ${active ? 'ring-[1.5px] ring-ink' : 'ring-0'} ${o > 45 ? 'text-[var(--color-page)]' : 'text-ink'}`}
            style={{ background: `color-mix(in srgb, var(--ink) ${o}%, transparent)` }}>
            {n}
          </button>
        )
      })}
      <span className={`text-right text-[13px] leading-[18px] ${t3} tabular-nums`}>{r.total || '—'}</span>
    </>
  )
}

// ---- Pages that fail most: the 6 pages with the most failing checks → the page drawer
function WorstPages({ setTab }) {
  const { a } = useAudit()
  const rows = [...a.pages].sort((x, y) => y.failCount - x.failCount || y.warnCount - x.warnCount || y.ms - x.ms).slice(0, 6)
  return (
    <Card className="flex h-full min-w-0 flex-col px-5 pt-5 max-md:px-4">
      <h2 className={cardTitle}>Pages that fail most</h2>
      <p className={subtitle}>Which single pages need the most fixing?</p>
      <ul className="mt-3 divide-y divide-[var(--div)] border-t border-[var(--div)]">
        {rows.map((p) => (
          <li key={p.path}>
            <button type="button" onClick={() => openDrawer('page', p.path)} aria-label={`${p.path}: ${p.failCount} failing checks. Open`}
              className="group -mx-2 grid h-10 w-[calc(100%+16px)] grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-3 rounded-md px-2 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
              <span className="truncate text-[14px] leading-5 text-stone-900" title={p.path}>{p.path}</span>
              <span className={`text-[13px] leading-[18px] tabular-nums ${p.failCount ? 'text-negative' : t3}`}>{p.failCount} failing</span>
              <ChevronRight size={14} className="text-stone-500 transition-colors group-hover:text-stone-900" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-auto border-t border-[var(--div)] py-3">
        <button type="button" onClick={() => setTab('pages')} className={`${linkCls} max-md:h-10`}>All {a.pages.length} pages <ArrowRight size={14} aria-hidden /></button>
      </div>
    </Card>
  )
}
