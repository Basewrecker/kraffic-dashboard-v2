// Reports (final design): the approved prototype's anatomy (~/Documents/design-refs/reports/report-prototype.html).
// Header; KPI tabs over the Visibility history card (components/dashboard/VisibilityHistory.jsx, reused as-is with the
// tab's dataset); panels of one fixed height (View all opens a sheet); the next steps; the footer. Styles in report5.css.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './report5.css'
import { PERIODS } from '../../../data/reports'
import { NO_HISTORY } from './model'
import VisibilityHistory from '../../../components/dashboard/VisibilityHistory'

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const ICON_EXP = <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M7 1.5h3.5V5M10.5 1.5 6.5 5.5M5 10.5H1.5V7M1.5 10.5l4-4" /></svg>
const CHEV = <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 6 4 4 4-4" /></svg>
const CAL = <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></svg>
const VISIBLE = 7 // rows a panel shows before View all

// ---- header ---------------------------------------------------------------------------------------------------------
function Menu({ label, icon, items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const out = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const key = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', out); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', key) }
  }, [open])
  return (
    <div className="menu" ref={ref}>
      <button type="button" className="btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{icon}{label}{CHEV}</button>
      {open && <ul role="menu">{items.map((it) => <li key={it.label}><button type="button" role="menuitem" aria-current={it.on || undefined} onClick={() => { setOpen(false); it.onClick?.() }}>{it.label}</button></li>)}</ul>}
    </div>
  )
}

// ---- the main card: KPI tabs over the Visibility history card -------------------------------------------------------
function KpiCard({ kpis, selected, onSelect, history }) {
  const k = kpis.find((x) => x.id === selected) ?? kpis[0]
  return (
    <section className="card" aria-label="Key numbers and trend">
      <div className="kpis" role="tablist">
        {kpis.map((m) => (
          <button key={m.id} type="button" className="kpi" role="tab" aria-selected={m.id === k.id} onClick={() => onSelect(m.id)}>
            <div className="l">{m.label}</div>
            <div className="v"><b className="num">{m.value}</b>{m.delta && <span className={`d ${m.delta.tone}`}>{m.delta.text}</span>}</div>
          </button>
        ))}
      </div>
      {k.ds && history
        ? <div className="vh" key={k.id}><VisibilityHistory dataset={k.ds} syncUrl={false} bare title={k.title} subtitle={k.subtitle} plotClass="h-[360px] max-md:h-[240px]" note={k.note}
          initial={{ compare: k.compare !== false && k.ds.series.length > 1, chart: 'line', picks: k.picks?.filter((p) => k.ds.series.some((s) => s.key === p)) ?? null }} /></div>
        : <div className="plot"><div className="state">{history ? `Not in your data: ${k.label.charAt(0).toLowerCase()}${k.label.slice(1)} by sync` : NO_HISTORY}</div></div>}
    </section>
  )
}

// ---- panel rows ------------------------------------------------------------------------------------------------------
const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
function Fav({ icon }) {
  const [bad, setBad] = useState(false)
  if (!icon) return null
  if (bad || !icon.domain) return <span className="fav" style={{ background: 'var(--ink3)' }}>{(icon.name || '?')[0].toUpperCase()}</span>
  return <span className="fav"><img src={favicon(icon.domain)} alt="" onError={() => setBad(true)} onLoad={(e) => e.currentTarget.naturalWidth <= 16 && setBad(true)} /></span>
}
function Spark({ spark }) {
  if (!spark) return <span className="spark" />
  const v = spark.values, lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1
  const d = v.map((x, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * 58 + 1).toFixed(1)},${(19 - ((x - lo) / span) * 18).toFixed(1)}`).join('')
  return <span className="spark"><svg viewBox="0 0 60 20" width="60" height="20" aria-hidden><path d={d} fill="none" stroke={spark.color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg></span>
}
// a bar only when it shows a real difference: not when every value is the same, or every value is 1
function barsFor(rows, tab) {
  if (tab.bar === false) return null
  const vals = rows.filter((r) => !r.group).map((r) => (r.split ? r.split.reduce((a, x) => a + x.v, 0) : r.bar)).filter((v) => v != null)
  if (vals.length < 2 || vals.every((v) => v === vals[0]) || vals.every((v) => v === 1)) return null
  return Math.max(...vals)
}
function Cell({ v, c }) {
  if (!v) return <span className="cell" style={{ width: c.w }} />
  if (v.text != null) return <span className={`cell txt ${v.tone ?? ''}`} style={{ width: c.w }}>{v.text}</span>
  return <span className={`cell n num ${v.tone ?? ''}`} style={{ width: c.w }}>{v.pre ?? ''}{v.v.toLocaleString()}{v.suf ?? ''}</span>
}
function Row({ r, i, tab, max, onClick, anim }) {
  const total = r.split ? r.split.reduce((a, x) => a + x.v, 0) : r.bar
  return (
    <button type="button" className={`row ${anim ? 'grow' : ''} ${r.group ? 'grp' : ''} ${r.sub ? 'sub' : ''} ${r.muted ? 'muted' : ''}`} style={{ '--i': i }} onClick={onClick} title={r.sub && r.topic ? `Topic: ${r.topic}` : undefined}>
      {max != null && total != null && (r.split
        ? <span className="fill split" style={{ width: `${Math.max(4, (total / max) * 100)}%` }}>{r.split.map((x, k) => <i key={k} className={x.tone} style={{ flex: `${x.v} 1 0` }} />)}</span>
        : <span className="fill" style={{ width: `${Math.max(4, (total / (r.barMax ?? max)) * 100)}%` }} />)}
      <span className="t"><Fav icon={r.icon} /><span className="x">{r.t}</span></span>
      <span className="cells">{tab.cols.map((c, k) => <Cell key={c.label} v={r.vals?.[k]} c={c} />)}{tab.spark && <Spark spark={r.spark} />}</span>
    </button>
  )
}
function Head({ def, tab, onTab }) {
  return (
    <div className="ptabs" role="tablist">
      {def.tabs.map((t) => (
        <button key={t.key} type="button" className={`ptab ${def.solo ? 'solo' : ''}`} role="tab" aria-selected={t.key === tab.key} onClick={def.solo ? undefined : () => onTab(t.key)}>{t.label}</button>
      ))}
      <span className="cols">{tab.cols.map((c) => <span key={c.label} className={`col ${c.text ? 'ct' : ''}`} style={{ width: c.w }}>{c.label}</span>)}{tab.spark && <span className="col sp">8 weeks</span>}</span>
    </div>
  )
}

// ---- View all: a sheet from the right (520px; full screen on a phone) ------------------------------------------------
function Sheet({ def, start, filter, onClose }) {
  const [tabKey, setTabKey] = useState(start)
  const [q, setQ] = useState('')
  const [closing, setClosing] = useState(false)
  const box = useRef(null)
  const input = useRef(null)
  const close = () => { if (reduce()) { onClose(); return } setClosing(true); setTimeout(onClose, 240) }
  useEffect(() => {
    input.current?.focus()
    const key = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const tab = def.tabs.find((t) => t.key === tabKey) ?? def.tabs[0]
  const base = filter && tab.key === 'prompts' ? tab.rows.filter((r) => r.topic === filter) : tab.rows
  const rows = q ? base.filter((r) => `${r.t} ${r.topic ?? ''}`.toLowerCase().includes(q.toLowerCase())) : base
  const max = barsFor(rows, tab)
  // a portal: the sheet covers the page, whatever scrolls or clips around the panel
  return createPortal(
    <div className={`r5 sheet-wrap ${closing ? 'out' : ''}`} onMouseDown={(e) => { if (!box.current?.contains(e.target)) close() }}>
      <div className="dim" />
      <aside ref={box} className="sheet" role="dialog" aria-modal="true" aria-label={tab.label}>
        <div className="sh-head">
          <div className="sh-tabs">
            {def.tabs.map((t) => <button key={t.key} type="button" className={`ptab ${def.solo ? 'solo' : ''}`} aria-selected={t.key === tab.key} onClick={() => setTabKey(t.key)}>{t.label}</button>)}
          </div>
          <button type="button" className="sh-x" onClick={close} aria-label="Close">×</button>
        </div>
        <div className="sh-search"><input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label={`Search ${tab.label}`} /></div>
        <div className="sh-cols"><span>{tab.label}</span><span className="cols">{tab.cols.map((c) => <span key={c.label} className={`col ${c.text ? 'ct' : ''}`} style={{ width: c.w }}>{c.label}</span>)}{tab.spark && <span className="col sp">8 weeks</span>}</span></div>
        <div className="rows sh-rows">
          {rows.map((r, i) => <div key={`${r.t}-${i}`} className="fadeup" style={{ '--i': Math.min(i, 30) }}><Row r={r} i={i} tab={tab} max={max} anim={false} /></div>)}
          {!rows.length && <div className="summary">No matches</div>}
        </div>
      </aside>
    </div>,
    document.body,
  )
}

export function Panel({ def }) {
  const [st, setSt] = useState({ tab: def.tabs[0].key, filter: null })
  const [sheet, setSheet] = useState(false)
  const tab = def.tabs.find((t) => t.key === st.tab) ?? def.tabs[0]
  const rows = st.filter ? tab.rows.filter((r) => r.topic === st.filter) : tab.rows
  const max = barsFor(rows, tab)
  const more = rows.length > VISIBLE
  const prompts = def.tabs.some((t) => t.key === 'prompts')
  return (
    <section className={`panel fixed ${def.full ? 'full' : ''}`} aria-label={tab.label}>
      <Head def={def} tab={tab} onTab={(k) => setSt({ tab: k, filter: null })} />
      {st.filter && <div className="filter">Filtered to <button type="button" onClick={() => setSt((s) => ({ ...s, filter: null }))}>{st.filter} <span aria-hidden="true">×</span></button></div>}
      <div className={`rows ${more ? 'clip' : ''} ${def.plain ? 'plain' : ''}`}>
        {rows.slice(0, VISIBLE + 1).map((r, i) => (
          <Row key={`${tab.key}-${st.filter}-${r.t}-${i}`} r={r} i={i} tab={tab} max={def.plain ? null : max} anim
            onClick={prompts && r.click ? () => setSt({ tab: 'prompts', filter: r.click }) : undefined} />
        ))}
        {!more && tab.summary && <div className="summary">{tab.summary}</div>}
      </div>
      {more && <div className="viewall"><button type="button" onClick={() => setSheet(true)}>View all {ICON_EXP}</button><button type="button" aria-label="More options">···</button></div>}
      {sheet && <Sheet def={def} start={tab.key} filter={st.filter} onClose={() => setSheet(false)} />}
    </section>
  )
}

// ---- next steps: action · topic · engines · your page (or New page) · +N ---------------------------------------------
function Steps({ steps, onCopy, onOpen }) {
  const [open, setOpen] = useState(null)
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') setOpen(null) }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  const total = Math.max(...steps.rows.map((s) => s.n)) * 1.25
  // a bar only when it shows a difference (not when every step could win the same number)
  const bars = steps.rows.length > 1 && !steps.rows.every((s) => s.n === steps.rows[0].n)
  const has = { engines: steps.rows.some((s) => s.engines?.length), page: steps.rows.some((s) => s.page !== undefined) }
  const cols = ['fit-content(44%)', 'auto', has.engines && 'auto', has.page ? 'minmax(0,1fr)' : '1fr', '48px'].filter(Boolean).join(' ')
  return (
    <section className="panel" aria-label={steps.title}>
      <div className="ptabs"><span className="ptab solo">{steps.title}</span><span className="col">{steps.col}</span></div>
      <div className="rows">
        {steps.rows.map((s, i) => (
          <div key={s.t}>
            <button type="button" className="row grow step" style={{ '--i': i, gridTemplateColumns: cols }} aria-expanded={open === i} onClick={() => setOpen((o) => (o === i ? null : i))}>
              {bars && <span className="fill" style={{ width: `${Math.max(5, (s.n / total) * 100)}%` }} />}
              <span className="act">{s.t}</span>
              <span><span className="chip">{s.topic}</span></span>
              {has.engines && <span className="favs">{(s.engines || []).map((e) => <Fav key={e.domain} icon={e} />)}</span>}
              <span className="page">{s.page !== undefined && <span className="x">{s.page}</span>}</span>
              <span className="n num">+{s.n}</span>
            </button>
            {open === i && (
              <div className="brief">
                <p>{s.why}</p>
                {s.prompts.length > 0 && <ul>{s.prompts.slice(0, 4).map((p) => <li key={p}>{p}</li>)}</ul>}
                <div className="acts"><button type="button" className="btn" onClick={() => onCopy?.(s)}>Copy brief</button><button type="button" className="btn" onClick={() => onOpen?.(s)}>Open in Prompt Hub</button></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// ---- the report -----------------------------------------------------------------------------------------------------
const grid = (n) => (n >= 3 ? 'g3' : n === 2 ? 'g2' : 'g1')
export default function Report5({ view, onPeriod, exportActions = [], onChangeRead, onCopyBrief, onOpenHub }) {
  const [kpi, setKpi] = useState(view.defaultKpi)
  useEffect(() => setKpi(view.defaultKpi), [view])
  const rows = useMemo(() => [view.row2, view.row3].filter((r) => r.length), [view])
  return (
    <div className="r5 wrap">
      <header className="head">
        <div>
          <h1>{view.question}</h1>
          <p>{view.answer}</p>
          {view.read && <p className="read">{view.read} · <button type="button" onClick={onChangeRead}>Change</button></p>}
        </div>
        <div className="ctrls">
          <Menu label={view.range} icon={CAL} items={PERIODS.filter((p) => p.id !== 'custom').map((p) => ({ label: p.label, on: p.id === view.period, onClick: () => onPeriod?.(p.id) }))} />
          <Menu label="Export" items={exportActions} />
        </div>
      </header>
      <KpiCard kpis={view.kpis} selected={kpi} onSelect={setKpi} history={view.history} />
      {rows.map((r, i) => {
        // a panel with sparklines goes first, in a wider column
        const wide = r.length === 3 && r.some((p) => p.tabs.some((t) => t.spark))
        const ordered = wide ? [...r].sort((a, b) => b.tabs.some((t) => t.spark) - a.tabs.some((t) => t.spark)) : r
        return <div key={i} className={`${grid(r.length)} ${wide ? 'wide' : ''}`}>{ordered.map((p) => <Panel key={p.id} def={p} />)}</div>
      })}
      {view.steps && <div className="g1"><Steps steps={view.steps} onCopy={onCopyBrief} onOpen={onOpenHub} /></div>}
      <div className="foot">{view.footer}</div>
    </div>
  )
}
