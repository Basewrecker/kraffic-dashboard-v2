import { useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, Check, ChevronRight, FileWarning, Gauge as GaugeIcon, Timer } from 'lucide-react'
import Card from '../dashboard/Card'
import KpiCard from '../dashboard/KpiCard'
import Gauge from '../ui/Gauge'
import Insight, { hl, useExplain } from '../ui/Insight'
import { fmtMin } from '../ui/ActionSteps'
import DrawerShell, { useDrawer } from './DrawerShell'
import { useAudit } from './context'
import { CheckIcon, openDrawer, openIssue } from './parts'
import { CATEGORIES, TARGET_MS, byStatus, groupBySection, planScore, sectionLabel } from '../../data/audit'

// Overview v3: KPI strip (the Visibility Overview tile) → the plan with the score it buys + what changed since the last
// run → where the problems are (sections × categories). Score weights: data/auditReference.js.
const t2 = 'text-stone-600'
const t3 = 'text-stone-500'
const cardTitle = 'text-[15px] leading-5 font-semibold text-stone-900'
const subtitle = `mt-0.5 text-[13px] leading-[18px] ${t2}`
const linkCls = 'inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus'
const PLAN_STEPS = 5
const pts = (v) => (Number.isInteger(v) ? `${v}` : v.toFixed(1))

export default function Overview({ setTab }) {
  const { a } = useAudit()
  return (
    <>
      <Kpis setTab={setTab} />
      {/* first run: nothing to compare, so the plan takes the row and "Since last run" is one line under it */}
      <div className={`grid grid-cols-1 items-stretch gap-4 ${a.since ? 'lg:grid-cols-3' : ''}`}>
        <div id="audit-plan" className="min-w-0 scroll-mt-6 lg:col-span-2"><NextSteps setTab={setTab} /></div>
        <SinceLastRun />
      </div>
      <ProblemAreas setTab={setTab} />
      <SinceDrawer />
    </>
  )
}

// ---- KPI strip: label · value · meta · "View …", whole tile clickable (dashboard/KpiCard)
function Kpis({ setTab }) {
  const { a } = useAudit()
  const delta = a.since ? a.score - a.since.scoreFrom : null
  const over = a.pages.filter((p) => p.ms > TARGET_MS).length
  const big = 'text-[24px] leading-8 font-semibold tracking-[-0.03em] text-stone-900 tabular-nums lg:text-kpi'
  const meta = (m) => <div className={`mt-1 text-[13px] leading-[18px] ${t2} tabular-nums`}>{m}</div>
  const tone = { bg: 'bg-tint', fg: 'text-stone-600' }
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <KpiCard label="AI readiness" icon={GaugeIcon} tone={tone} link="View score"
        onOpen={() => document.getElementById('audit-plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
        <div className="flex items-end gap-3">
          <Gauge value={a.score} width={64} stroke={7} />
          <span className={big}>{a.score}</span>
        </div>
        {meta(delta == null ? <span className={t3}>First audit</span> : delta === 0 ? <span className={t3}>No change since {a.since.date}</span>
          : <><span className={delta < 0 ? 'text-negative' : 'text-ink'}>{delta < 0 ? '▼' : '▲'}{Math.abs(delta)}</span> since {a.since.date}</>)}
      </KpiCard>
      <KpiCard label="Failing checks" icon={AlertCircle} tone={tone} link="View checks" onOpen={() => setTab('checks', { status: 'fail' })}>
        <div className={big}>{a.failing.length}</div>
        {meta(`of ${a.open.length} checks to fix`)}
      </KpiCard>
      <KpiCard label="Pages with issues" icon={FileWarning} tone={tone} link="View pages" onOpen={() => setTab('pages', { status: 'failing' })}>
        <div className="flex items-baseline gap-1.5"><span className={big}>{a.failingPages.length}</span><span className={`text-[14px] leading-5 ${t3} tabular-nums`}>of {a.pages.length}</span></div>
        {meta('with a failing check')}
      </KpiCard>
      <KpiCard label="Median response" icon={Timer} tone={tone} link="View crawl" onOpen={() => setTab('crawl')}>
        <div className="flex items-baseline gap-1.5"><span className={big}>{a.crawl.median}</span><span className={`text-[14px] leading-5 ${t3}`}>ms</span></div>
        {meta(over ? `${over} ${over === 1 ? 'page' : 'pages'} over ${TARGET_MS} ms` : `Every page under ${TARGET_MS} ms`)}
      </KpiCard>
    </div>
  )
}

// ---- What to do next: the score lift bar (now → after the plan) over the numbered plan
function NextSteps({ setTab }) {
  const { a } = useAudit()
  const [hover, setHover] = useState(null) // check id
  const plan = [...a.open].sort((x, y) => planScore(y) - planScore(x) || byStatus(x, y)).slice(0, PLAN_STEPS)
  const after = a.score + plan.reduce((n, c) => n + c.adds, 0)
  const minutes = plan.reduce((n, c) => n + c.effort, 0)
  const hovered = plan.find((c) => c.id === hover)
  let at = a.score
  const segs = plan.map((c, i) => { const s = { c, from: at, to: at + c.adds, i }; at += c.adds; return s })
  const where = (c) => (c.pageBased ? groupBySection(c.pages).slice(0, 2).map((g) => sectionLabel(g.section)).join(', ') + (groupBySection(c.pages).length > 2 ? ' +' : '') : 'Site-wide')
  const label = (text, pct) => (
    <span className="absolute whitespace-nowrap text-[13px] leading-[18px] font-semibold text-stone-900 tabular-nums" style={{ left: `${pct}%`, transform: pct > 80 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{text}</span>
  )
  // phones: effort moves under the action, so the action gets the width
  const cols = 'grid-cols-[24px_minmax(0,1fr)_44px_16px] md:grid-cols-[24px_minmax(0,1fr)_160px_56px_72px_16px]'
  return (
    <Card className="flex h-full min-w-0 flex-col px-5 pt-5 max-md:px-4">
      <h2 className={cardTitle}>What to do next</h2>
      <p className={subtitle}>What should we fix first, and what does it do for the score?</p>

      {plan.length > 0 && (
        <div className="mt-5" onMouseLeave={() => setHover(null)}>
          {/* labels above the bar on desktop, below it on phones */}
          <div className="relative h-[18px] max-md:hidden">{label(`${a.score} now`, a.score)}{label(`${Math.round(after)} if you fix these`, after)}</div>
          <div className="mt-1.5 flex h-3 overflow-hidden rounded-full bg-tint" role="img" aria-label={`Score ${a.score} now, ${Math.round(after)} if you fix the ${plan.length} steps below`}>
            <span className="h-full shrink-0 bg-ink" style={{ width: `${a.score}%` }} />
            {segs.map((s) => (
              <span key={s.c.id} onMouseEnter={() => setHover(s.c.id)}
                className="h-full shrink-0 border-l-2 border-[var(--color-surface)] transition-colors duration-150 ease-out"
                style={{ width: `${s.to - s.from}%`, background: hover === s.c.id ? 'color-mix(in srgb, var(--ink) 40%, transparent)' : s.i % 2 ? 'var(--data-c3)' : 'var(--data-c2)' }} />
            ))}
          </div>
          <div className="relative mt-1.5 h-[18px] md:hidden">{label(`${a.score} now`, a.score)}{label(`${Math.round(after)} if fixed`, after)}</div>
          <p className={`mt-2 h-5 text-[13px] leading-5 ${t2} tabular-nums transition-opacity duration-150 ${hovered ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
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

// ---- Since last run: score sparkline across runs + 4 counts, each opening a drawer with the items
const SINCE_ROWS = [['newly', 'Newly failing'], ['fixed', 'Fixed'], ['added', 'Pages added'], ['removed', 'Pages gone']]
function sinceItems(s, key) {
  if (key === 'newly') return s.newlyFailing.map((c) => ({ id: c.id, label: c.label, check: true, status: 'fail' }))
  if (key === 'fixed') return s.fixed.map((c) => ({ id: c.id, label: c.label, check: true, status: 'pass' }))
  return (key === 'added' ? s.added : s.removed).map((p) => ({ id: p, label: p }))
}
function Sparkline({ history }) {
  const W = 100, H = 64
  const vals = history.map((h) => h.score)
  const min = Math.min(...vals) - 2, max = Math.max(...vals) + 2
  const p = vals.map((v, i) => [(i / (vals.length - 1)) * (W - 4) + 2, H - 4 - ((v - min) / (max - min)) * (H - 8)])
  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-16 flex-1">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={`AI readiness across ${vals.length} audits, ${history[0].date} to ${history.at(-1).date}`}>
          <polyline points={p.map((q) => q.join(',')).join(' ')} fill="none" stroke="var(--ink)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {/* the last-point dot sits outside the stretched svg so it stays round */}
        <span className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ left: `${p.at(-1)[0]}%`, top: `${(p.at(-1)[1] / H) * 100}%` }} aria-hidden />
      </div>
      <div className={`mt-1 flex justify-between text-[13px] leading-[18px] ${t3}`}><span>{history[0].date}</span><span>{history.at(-1).date}</span></div>
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
      <p className={subtitle}>{s ? `What changed since ${s.date}?` : 'What changed since the last audit?'}</p>
      {!s ? (
        <p className={`mt-4 text-[14px] leading-5 ${t2}`}>Changes show up after your next audit.</p>
      ) : (
        <>
          <div className="mt-4 flex min-h-[88px] flex-1 flex-col"><Sparkline history={s.history} /></div>
          <ul className="mt-3 divide-y divide-[var(--div)] border-t border-[var(--div)] pt-0">
            {SINCE_ROWS.map(([key, label]) => {
              const n = sinceItems(s, key).length
              const icon = key === 'newly' ? <AlertCircle size={14} className="text-negative" /> : key === 'fixed' ? <Check size={14} className="text-ink" /> : <span className="h-1.5 w-1.5 rounded-full bg-stone-400" />
              const body = (
                <>
                  <span className="grid w-4 place-items-center" aria-hidden>{icon}</span>
                  <span className="text-[14px] leading-5">{label}</span>
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
        </>
      )}
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

// ---- Where the problems are: sections × categories (failing page × check pairs), Tone-vs-stance cell style
const CATS = Object.keys(CATEGORIES)
function ProblemAreas({ setTab }) {
  const { a } = useAudit()
  const explain = useExplain(a.key)
  const [hover, setHover] = useState(null) // [r, c]
  const rows = a.heat
  const max = Math.max(...rows.flatMap((r) => r.cells), 1)
  const top = rows.flatMap((r, ri) => r.cells.map((n, ci) => ({ n, ri, ci }))).sort((x, y) => y.n - x.n)[0]
  const colTot = CATS.map((_, c) => rows.reduce((n, r) => n + r.cells[c], 0))
  const topCat = colTot.indexOf(Math.max(...colTot))
  const text = !top?.n ? 'No failing checks on any page.' : `Most issues are ${CATEGORIES[CATS[top.ci]].toLowerCase()} problems on ${sectionLabel(rows[top.ri].section)}.`
  const readout = hover && (() => { const r = rows[hover[0]]; const n = r.cells[hover[1]]; return `${n} failing ${CATEGORIES[CATS[hover[1]]].toLowerCase()} ${n === 1 ? 'check' : 'checks'} across the ${r.pages} ${r.pages === 1 ? 'page' : 'pages'} of ${sectionLabel(r.section)}` })()
  const on = (cls) => `${cls} transition-colors duration-150 ease-out`
  return (
    <Card ref={explain.cardRef} className="flex min-w-0 flex-col px-5 pt-5 pb-3 max-md:px-4">
      <h2 className={cardTitle}>Where the problems are</h2>
      <p className={subtitle}>Which parts of the site fail which kind of check? Click a cell to see those pages.</p>
      <div className="mt-3 max-w-[640px]">
        <div className="grid grid-cols-[minmax(120px,1.4fr)_repeat(3,minmax(0,1fr))_48px] items-center gap-1 max-md:grid-cols-[96px_repeat(3,minmax(0,1fr))_32px]">
          <span />
          {CATS.map((cat, c) => <span key={cat} className={on(`truncate pb-0.5 text-center text-[13px] leading-[18px] ${hover?.[1] === c ? 'font-semibold text-ink' : t3}`)}>{CATEGORIES[cat]}</span>)}
          <span />
          {rows.map((r, ri) => (
            <HeatRow key={r.section} r={r} ri={ri} max={max} hover={hover} setHover={setHover} explain={explain} on={on}
              onPick={(ci) => setTab('pages', { section: r.section, status: 'failing', cat: CATS[ci] })} />
          ))}
        </div>
        <p className={`mt-2 h-5 truncate text-[13px] leading-5 ${t2} tabular-nums transition-opacity duration-150 ease-out ${readout ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">{readout ?? ''}</p>
      </div>
      <div className="mt-auto pt-2">
        <Insight explain={explain} text={text} evidence={{
          keys: top?.n ? [`heat:${top.ri}:${top.ci}`] : [],
          calc: `Each cell counts failing checks on each page of the section (a page failing 2 checks counts 2). ${CATEGORIES[CATS[topCat]]} has the most overall.`,
        }} />
      </div>
    </Card>
  )
}
function HeatRow({ r, ri, max, hover, setHover, explain, on, onPick }) {
  const rowOn = hover?.[0] === ri
  return (
    <>
      <span className="min-w-0">
        <span className={on(`block truncate text-[13px] leading-[18px] ${rowOn ? 'font-semibold text-ink' : 'text-stone-900'}`)}>{sectionLabel(r.section)}</span>
        <span className={`block text-[12px] leading-4 ${t3} tabular-nums`}>{r.pages} {r.pages === 1 ? 'page' : 'pages'}</span>
      </span>
      {r.cells.map((n, ci) => {
        if (!n) return <span key={ci} className={`grid h-10 place-items-center text-[14px] ${t3}`} {...hl(explain, `heat:${ri}:${ci}`)}>—</span>
        const o = 6 + (n / max) * 54 // 6% → 60%; page-colour text past 45%
        const active = hover?.[0] === ri && hover?.[1] === ci
        return (
          <button key={ci} type="button" onClick={() => onPick(ci)}
            onMouseEnter={() => setHover([ri, ci])} onMouseLeave={() => setHover(null)} onFocus={() => setHover([ri, ci])} onBlur={() => setHover(null)}
            aria-label={`${sectionLabel(r.section)}, ${CATEGORIES[CATS[ci]]}: ${n} failing checks. Show those pages`}
            {...hl(explain, `heat:${ri}:${ci}`)}
            className={`h-10 rounded-md text-center text-[14px] leading-5 font-semibold tabular-nums outline-none ring-inset transition-[box-shadow] duration-150 ease-out ${active ? 'ring-[1.5px] ring-ink' : 'ring-0'} ${o > 45 ? 'text-[var(--color-page)]' : 'text-ink'}`}
            style={{ background: `color-mix(in srgb, var(--ink) ${o}%, transparent)` }}>
            {n}
          </button>
        )
      })}
      <span className={`text-right text-[13px] leading-[18px] ${t3} tabular-nums`}>{r.total || '—'}</span>
    </>
  )
}
