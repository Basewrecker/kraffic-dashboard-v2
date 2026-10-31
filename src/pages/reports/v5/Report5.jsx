// Reports (final design): a 1:1 port of the approved prototype (~/Documents/design-refs/reports/report-prototype.html):
// the header, the KPI tabs fused to the blue area chart, the 2-up and 3-up panels, the next steps, the footer. Styles in
// report5.css (the prototype's own); the chart is drawn by the prototype's draw(), ported unchanged apart from its data.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './report5.css'
import { PERIODS } from '../../../data/reports'
import { NO_HISTORY } from './model'

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

// ---- the chart: the prototype's draw() ------------------------------------------------------------------------------
function nice(hi) { for (const s of [5, 10, 20, 25, 50, 100, 200]) { if (hi * 1.12 <= s * 4) return { top: s * 4, step: s } } return { top: Math.ceil(hi / 100) * 100, step: Math.ceil(hi / 400) * 100 } }
// x labels on the 1st and 15th; with weekly syncs, on the first sync on or after each
function labelled(isos) {
  const seen = new Set()
  return isos.map((iso) => {
    const d = new Date(`${iso}T00:00:00`)
    const k = `${d.getMonth()}-${d.getDate() >= 15 ? 15 : 1}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
function Chart({ kpi, dates, isos, partialLast, anim }) {
  const svgRef = useRef(null)
  const tipRef = useRef(null)
  const draw = (animate) => {
    const svg = svgRef.current
    if (!svg) return
    const s = kpi.series, N = s.length
    const W = svg.clientWidth || 900, H = 300, pl = 40, pr = 12, pt = 10, pb = 26, iw = W - pl - pr, ih = H - pt - pb
    const { top, step } = nice(Math.max(...s))
    const x = (i) => pl + (N === 1 ? iw / 2 : (i * iw) / (N - 1)), y = (v) => pt + ih - (v / top) * ih
    const pct = kpi.unit === '%'
    let g = '<defs><linearGradient id="r5gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--plot)" stop-opacity="var(--plot-a)"/><stop offset="1" stop-color="var(--plot)" stop-opacity="0"/></linearGradient></defs>'
    for (let v = 0; v <= top; v += step) g += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${pl - 10}" y="${y(v) + 4}" text-anchor="end">${v}${pct ? '%' : ''}</text>`
    const show = labelled(isos)
    dates.forEach((d, i) => { if (show[i]) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(d)}</text>` })
    const P = s.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    g += `<path class="area ${animate && !reduce() ? 'fade' : ''}" fill="url(#r5gf)" d="M${P.join('L')}L${x(N - 1)},${y(0)}L${x(0)},${y(0)}Z"/>`
    // the last, incomplete day is dashed (daily syncs only; a weekly sync is complete when it's stored)
    g += partialLast ? `<path class="line" d="M${P.slice(0, N - 1).join('L')}"/><path class="tail" d="M${P[N - 2]}L${P[N - 1]}"/>` : `<path class="line" d="M${P.join('L')}"/>`
    g += `<line class="hair" y1="${pt}" y2="${pt + ih}" stroke="var(--ink3)" stroke-dasharray="3 3" opacity="0"/><circle class="dot" r="4" fill="var(--plot)" stroke="var(--card)" stroke-width="2" opacity="0"/><rect class="hit" x="${pl}" y="${pt}" width="${iw}" height="${ih}" fill="transparent"/>`
    svg.innerHTML = g
    const ln = svg.querySelector('.line')
    if (animate && !reduce()) { const L = ln.getTotalLength(); ln.style.strokeDasharray = L; ln.style.setProperty('--len', L); ln.classList.add('draw') }
    const tip = tipRef.current, hair = svg.querySelector('.hair'), dot = svg.querySelector('.dot'), hit = svg.querySelector('.hit')
    hit.onmousemove = (e) => {
      const r = svg.getBoundingClientRect()
      const i = Math.max(0, Math.min(N - 1, Math.round((e.clientX - r.left - pl) / (iw / Math.max(1, N - 1)))))
      hair.setAttribute('x1', x(i)); hair.setAttribute('x2', x(i)); hair.setAttribute('opacity', 1)
      dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(s[i])); dot.setAttribute('opacity', 1)
      tip.innerHTML = `<span>${esc(dates[i])}${partialLast && i === N - 1 ? ' · so far' : ''}</span><b class="num">${s[i].toLocaleString()}${pct ? '%' : ` ${kpi.unit}`}</b>`
      tip.style.left = `${x(i) + 170 > W ? x(i) - 140 : x(i) + 16}px`; tip.style.top = `${y(s[i]) + 10}px`; tip.style.opacity = 1
    }
    hit.onmouseleave = () => { tip.style.opacity = 0; hair.setAttribute('opacity', 0); dot.setAttribute('opacity', 0) }
  }
  useLayoutEffect(() => { draw(anim) }, [kpi]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = () => draw(false)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [kpi]) // eslint-disable-line react-hooks/exhaustive-deps
  return <><svg ref={svgRef} role="img" aria-label={`${kpi.label}, by sync`} /><div className="tip" ref={tipRef} /></>
}

function KpiCard({ kpis, selected, onSelect, dates, isos, history }) {
  const [anim, setAnim] = useState(true)
  const k = kpis.find((x) => x.id === selected) ?? kpis[0]
  return (
    <section className="card" aria-label="Key numbers and trend">
      <div className="kpis" role="tablist">
        {kpis.map((m) => (
          <button key={m.id} type="button" className="kpi" role="tab" aria-selected={m.id === k.id} onClick={() => { setAnim(true); onSelect(m.id) }}>
            <div className="l">{m.label}</div>
            <div className="v"><b className="num">{m.value}</b>{m.delta && <span className={`d ${m.delta.tone}`}>{m.delta.text}</span>}</div>
          </button>
        ))}
      </div>
      <div className="plot">
        {k.series
          ? <Chart key={k.id} kpi={k} dates={dates} isos={isos} partialLast={false} anim={anim} />
          : <div className="state">{history ? `Not in your data: ${lowerFirst(k.label)} by sync` : NO_HISTORY}</div>}
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
  return rows.map((r, i) => (
    <RowFragment key={`${r.t}-${i}`} r={r} i={i} max={max} grow={grow} onRow={onRow} extra={extra} />
  ))
}
function RowFragment({ r, i, max, grow, onRow, extra }) {
  return (
    <>
      <button type="button" className={`row ${grow ? 'grow' : ''}`} style={{ '--i': i }} onClick={onRow ? () => onRow(r, i) : undefined} aria-expanded={extra ? !!extra(r, i) : undefined}>
        {r.n != null && <span className="fill" style={{ width: `${Math.max(5, (r.n / (r.max ?? max)) * 100)}%` }} />}
        <span className="t"><Fav icon={r.icon} /><span className="x">{r.t}</span></span>
        {r.n != null && <span className={`n num ${r.sign ?? ''}`}>{r.pre ?? ''}{r.n.toLocaleString()}{r.suf ?? ''}</span>}
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
        {d.col && <span className="col">{d.col}</span>}
      </div>
      {st.filter && <div className="filter">Filtered to <button type="button" onClick={() => setSt((s) => ({ ...s, filter: null }))}>{st.filter} <span aria-hidden="true">×</span></button></div>}
      <div className={`rows ${clip ? 'clip' : ''}`}>
        <Rows key={`${d.key}-${st.filter}`} rows={rows} onRow={prompts ? (r) => r.click && setSt({ tab: 'prompts', filter: r.click, all: true }) : undefined} />
      </div>
      {clip && <div className="viewall"><button type="button" onClick={() => setSt((s) => ({ ...s, all: true }))}>View all {ICON_EXP}</button><button type="button" aria-label="More options">···</button></div>}
      {st.all && rows.length > 7 && <div className="less"><button type="button" onClick={() => setSt((s) => ({ ...s, all: false }))}>Show fewer</button></div>}
    </section>
  )
}

function Steps({ steps, onCopy, onOpen }) {
  const [open, setOpen] = useState(null)
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') setOpen(null) }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  const rows = steps.rows.map((s) => ({ ...s, pre: '+', max: steps.total }))
  return (
    <section className="panel" aria-label={steps.title}>
      <div className="ptabs"><span className="ptab solo">{steps.title}</span><span className="col">{steps.col}</span></div>
      <div className="rows">
        <Rows rows={rows} onRow={(r, i) => setOpen((o) => (o === i ? null : i))}
          extra={(s, i) => open === i && (
            <div className="brief">
              <p>{s.why}</p>
              <ul>{s.prompts.slice(0, 4).map((p) => <li key={p}>{p}</li>)}</ul>
              <div className="acts"><button type="button" className="btn" onClick={() => onCopy?.(s)}>Copy brief</button><button type="button" className="btn" onClick={() => onOpen?.(s)}>Open in Prompt Hub</button></div>
            </div>
          )} />
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
      <KpiCard kpis={view.kpis} selected={kpi} onSelect={setKpi} dates={view.dates} isos={isos} history={view.history} />
      {view.row2.length > 0 && <div className={grid(view.row2.length)}>{view.row2.map((p) => <Panel key={p.id} def={p} />)}</div>}
      {view.row3.length > 0 && <div className={grid(view.row3.length)}>{view.row3.map((p) => <Panel key={p.id} def={p} />)}</div>}
      {view.steps && <div className="g1"><Steps steps={view.steps} onCopy={onCopyBrief} onOpen={onOpenHub} /></div>}
      <div className="foot">{view.footer}</div>
    </div>
  )
}
