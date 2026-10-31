// Reports (final design): a 1:1 port of the approved prototype (~/Documents/design-refs/reports/report-prototype.html):
// the header, the KPI tabs fused to the blue area chart, the 2-up and 3-up panels, the next steps, the footer. Styles in
// report5.css (the prototype's own); the chart is drawn by the prototype's draw(), ported unchanged apart from its data.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './report5.css'
import { PERIODS } from '../../../data/reports'
import { NO_HISTORY } from './model'
import Chart5 from './Chart5'
import Insight, { useExplain } from '../../../components/ui/Insight'

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const ICON_EXP = <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M7 1.5h3.5V5M10.5 1.5 6.5 5.5M5 10.5H1.5V7M1.5 10.5l4-4" /></svg>
const CHEV = <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 6 4 4 4-4" /></svg>
const CAL = <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></svg>

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
      {open && (
        <ul role="menu">
          {items.map((it) => <li key={it.label}><button type="button" role="menuitem" aria-current={it.on || undefined} onClick={() => { setOpen(false); it.onClick?.() }}>{it.label}</button></li>)}
        </ul>
      )}
    </div>
  )
}

function KpiCard({ kpis, selected, onSelect, dates, isos, history }) {
  const [anim, setAnim] = useState(true)
  const k = kpis.find((x) => x.id === selected) ?? kpis[0]
  const explain = useExplain(k.id)
  return (
    <section className="card" aria-label="Key numbers and trend" ref={explain.cardRef}>
      <div className="kpis" role="tablist">
        {kpis.map((m) => (
          <button key={m.id} type="button" className="kpi" role="tab" aria-selected={m.id === k.id} onClick={() => { setAnim(true); onSelect(m.id) }}>
            <div className="l">{m.label}</div>
            <div className="v"><b className="num">{m.value}</b>{m.delta && <span className={`d ${m.delta.tone}`}>{m.delta.text}</span>}</div>
          </button>
        ))}
      </div>
      <div className="plot">
        {k.series ? (
          <>
            <div className="legend">
              <span><i />{k.short === 'you' ? k.brand : k.short}</span>
              {k.compare && <span><i className="dash" />{k.compare.short === 'you' ? k.brand : k.compare.kind === 'previous' ? 'Previous period' : k.compare.label}</span>}
            </div>
            <Chart5 key={k.id} kpi={k} dates={dates} isos={isos} anim={anim} />
            {k.insight && <div className="insight"><Insight explain={explain} text={k.insight.text} evidence={{ keys: [], calc: k.insight.why }} /></div>}
          </>
        ) : <div className="state">{history ? `Not in your data: ${lowerFirst(k.label)} by sync` : NO_HISTORY}</div>}
      </div>
    </section>
  )
}
const lowerFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1)

// ---- panels ---------------------------------------------------------------------------------------------------------
const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
function Fav({ icon }) {
  const [bad, setBad] = useState(false)
  if (!icon) return null
  if (bad || !icon.domain) return <span className="fav" style={{ background: 'var(--ink3)' }}>{(icon.name || '?')[0].toUpperCase()}</span>
  return <span className="fav"><img src={favicon(icon.domain)} alt="" onError={() => setBad(true)} onLoad={(e) => e.currentTarget.naturalWidth <= 16 && setBad(true)} /></span>
}

function Rows({ rows, grow = true, onRow, extra }) {
  const max = Math.max(...rows.map((r) => r.n ?? 0), 1)
  const maxSplit = Math.max(...rows.map((r) => (r.split ? r.split.reduce((a, x) => a + x.v, 0) : 0)), 1)
  return rows.map((r, i) => <RowFragment key={`${r.t}-${i}`} r={r} i={i} max={max} maxSplit={maxSplit} grow={grow} onRow={onRow} extra={extra} />)
}
function RowFragment({ r, i, max, maxSplit, grow, onRow, extra }) {
  const click = onRow && (r.click !== null) ? () => onRow(r, i) : undefined
  return (
    <>
      <button type="button" className={`row ${grow ? 'grow' : ''} ${r.muted ? 'muted' : ''}`} style={{ '--i': i }} onClick={click} aria-expanded={extra ? !!extra(r, i) : undefined} disabled={!click && !extra ? undefined : undefined}>
        {r.split
          ? <span className="fill split" style={{ width: `${Math.max(5, (r.split.reduce((a, x) => a + x.v, 0) / maxSplit) * 100)}%` }}>{r.split.map((x, k) => <i key={k} className={x.tone} style={{ flex: `${x.v} 1 0` }} />)}</span>
          : r.n != null && <span className="fill" style={{ width: `${Math.max(5, (r.n / (r.max ?? max)) * 100)}%` }} />}
        <span className="t"><Fav icon={r.icon} /><span className="x">{r.t}</span></span>
        {r.note && <span className="note">{r.note}</span>}
        {r.vals
          ? <span className="vals">{r.vals.map((v, k) => (v.text != null
            ? <span key={k} className="vt">{v.text}</span>
            : <span key={k} className={`n num ${v.tone ?? ''}`}>{v.pre ?? ''}{v.v.toLocaleString()}{v.suf ?? ''}</span>))}</span>
          : r.n != null && <span className={`n num ${r.sign ?? ''}`}>{r.pre ?? ''}{r.n.toLocaleString()}{r.suf ?? ''}</span>}
      </button>
      {extra?.(r, i)}
    </>
  )
}

export function Panel({ def }) {
  const [st, setSt] = useState({ tab: def.tabs[0].key, filter: null, all: false })
  const d = def.tabs.find((t) => t.key === st.tab) ?? def.tabs[0]
  const rows = st.filter ? d.rows.filter((r) => r.topic === st.filter) : d.rows
  const clip = !st.all && rows.length > 7
  const prompts = def.tabs.some((t) => t.key === 'prompts')
  return (
    <section className="panel" aria-label={d.label}>
      <div className="ptabs" role="tablist">
        {def.tabs.map((t) => (
          <button key={t.key} type="button" className={`ptab ${def.solo ? 'solo' : ''}`} role="tab" aria-selected={t.key === d.key}
            onClick={def.solo ? undefined : () => setSt({ tab: t.key, filter: null, all: false })}>{t.label}</button>
        ))}
        {Array.isArray(d.col) ? <span className="cols">{d.col.map((c) => <span key={c} className={d.rows.some((r) => r.vals?.[d.col.indexOf(c)]?.text != null) ? 'col ct' : 'col'}>{c}</span>)}</span> : d.col && <span className="col">{d.col}</span>}
      </div>
      {st.filter && <div className="filter">Filtered to <button type="button" onClick={() => setSt((s) => ({ ...s, filter: null }))}>{st.filter} <span aria-hidden="true">×</span></button></div>}
      <div className={`rows ${clip ? 'clip' : ''} ${rows.length < 7 ? 'fillrows' : ''}`}>
        <Rows key={`${d.key}-${st.filter}`} rows={rows} onRow={prompts ? (r) => r.click && setSt({ tab: 'prompts', filter: r.click, all: true }) : undefined} />
      </div>
      {clip && <div className="viewall"><button type="button" onClick={() => setSt((s) => ({ ...s, all: true }))}>View all {ICON_EXP}</button><button type="button" aria-label="More options">···</button></div>}
      {st.all && rows.length > 7 && <div className="less"><button type="button" onClick={() => setSt((s) => ({ ...s, all: false }))}>Show fewer</button></div>}
    </section>
  )
}

function Steps({ steps, onCopy, onOpen }) {
  const [open, setOpen] = useState(null)
  const ref = useRef(null)
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') setOpen(null) }
    window.addEventListener('keydown', key)
    const ro = new ResizeObserver(([e]) => setWide(e.contentRect.width >= 980))
    if (ref.current) ro.observe(ref.current)
    return () => { window.removeEventListener('keydown', key); ro.disconnect() }
  }, [])
  // a column shows only when some row has it
  const has = { topic: steps.rows.some((s) => s.topic), engines: steps.rows.some((s) => s.engines?.length), page: steps.rows.some((s) => s.page), cited: steps.rows.some((s) => s.cited != null), effort: wide && steps.rows.some((s) => s.effort) }
  const cols = ['minmax(0,1.6fr)', has.topic && '128px', has.engines && '56px', has.page && 'minmax(0,1.3fr)', has.cited && '72px', has.effort && '72px', '48px'].filter(Boolean).join(' ')
  return (
    <section className="panel" aria-label={steps.title} ref={ref}>
      <div className="ptabs"><span className="ptab solo">{steps.title}</span><span className="col">{steps.col}</span></div>
      <div className="rows">
        {steps.rows.map((s, i) => (
          <div key={s.t}>
            <button type="button" className="row grow step" style={{ '--i': i, gridTemplateColumns: cols }} aria-expanded={open === i} onClick={() => setOpen((o) => (o === i ? null : i))}>
              <span className="fill" style={{ width: `${Math.max(5, (s.n / steps.total) * 100)}%` }} />
              <span className="x act">{s.t}</span>
              {has.topic && <span><span className="chip">{s.topic}</span></span>}
              {has.engines && <span className="favs">{s.engines.map((e) => <Fav key={e.domain} icon={e} />)}</span>}
              {has.page && <span className="page">{s.page && <><Fav icon={s.page.icon} /><span className="x">{s.page.path}</span></>}<span className="sr-only"> {steps.rival}’s page</span></span>}
              {has.cited && <span className="cited num">{s.cited != null ? `cited ${s.cited}×` : ''}</span>}
              {has.effort && <span className="effort">{s.effort}</span>}
              <span className="n num">+{s.n}</span>
            </button>
            {open === i && (
              <div className="brief">
                <p>{s.why}</p>
                <ul>{s.prompts.slice(0, 4).map((p) => <li key={p}>{p}</li>)}</ul>
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
export default function Report5({ view, isos, onPeriod, exportActions = [], onChangeRead, onCopyBrief, onOpenHub }) {
  const [kpi, setKpi] = useState(view.defaultKpi)
  useEffect(() => setKpi(view.defaultKpi), [view])
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
      <KpiCard kpis={view.kpis.map((k) => ({ ...k, brand: view.brand }))} selected={kpi} onSelect={setKpi} dates={view.dates} isos={isos} history={view.history} />
      {view.row2.length > 0 && <div className={grid(view.row2.length)}>{view.row2.map((p) => <Panel key={p.id} def={p} />)}</div>}
      {view.row3.length > 0 && <div className={grid(view.row3.length)}>{view.row3.map((p) => <Panel key={p.id} def={p} />)}</div>}
      {view.steps && <div className="g1"><Steps steps={view.steps} onCopy={onCopyBrief} onOpen={onOpenHub} /></div>}
      <div className="foot">{view.footer}</div>
    </div>
  )
}
