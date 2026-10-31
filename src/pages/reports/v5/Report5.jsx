// Reports (final design): the approved prototype's anatomy (~/Documents/design-refs/reports/report-prototype.html).
// Header; KPI tabs over the Visibility history card (components/dashboard/VisibilityHistory.jsx, reused as-is with the
// tab's dataset); panels of one fixed height (View all opens a sheet); the next steps; the footer. Styles in report5.css.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from 'lucide-react'
import './report5.css'
import { PERIODS } from '../../../data/reports'
import { NO_HISTORY } from './model'
import VisibilityHistory from '../../../components/dashboard/VisibilityHistory'
import Marker from '../../../components/ui/Marker'

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
// fewer than 3 syncs: no time chart. Left (7/12) "Share this sync": a bar per brand in its chart colour; right (5/12)
// "By engine": brand × engine, the share tinted in one hue, the named count on hover
function Snapshot({ snap, note }) {
  const max = Math.max(...snap.shares.map((x) => x.share), 1)
  return (
    <div className="snap">
      <div className="snap-l">
        <h3>Share this sync</h3>
        {snap.shares.map((x) => (
          <div key={x.domain} className="sn-row">
            <span className="t"><Fav icon={{ domain: x.domain, name: x.name }} /><span className="x">{x.name}{x.you ? <em> · you</em> : null}</span></span>
            <span className="sn-bar"><i style={{ width: `${(x.share / max) * 100}%`, background: x.color }} /></span>
            <b className="num">{x.share}%</b>
          </div>
        ))}
      </div>
      {snap.engines && (
        <div className="snap-r">
          <h3>By engine</h3>
          {snap.engines.map((e) => (
            <div key={e.id} className="se-row">
              <span className="t"><Fav icon={engineIcon(e.id)} /><span className="x nowrap">{{ aio: 'AI Overview', chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude' }[e.id]}</span></span>
              <span className="se-bars">
                {e.bars.map((b, k) => (
                  <span key={b.domain} className={`se-bar ${k ? 'thin' : ''}`} title={`${b.name}: ${b.named} prompts named`}><span className="track"><i style={{ width: `${b.share}%`, background: b.color }} /></span><b className="num">{b.share}%</b></span>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="sn-note">{note}</p>
    </div>
  )
}

function KpiCard({ kpis, selected, onSelect, history, snapshot, syncs }) {
  const k = kpis.find((x) => x.id === selected) ?? kpis[0]
  return (
    <section className="card" aria-label="Key numbers and trend">
      <div className="kpis" role="tablist">
        {kpis.map((m) => (
          <button key={m.id} type="button" className="kpi" role="tab" aria-selected={m.id === k.id} onClick={() => onSelect(m.id)} title={m.subtitle ?? undefined}>
            <div className="l">{m.label}</div>
            <div className="v"><b className="num">{m.value}</b>{m.delta && <span className={`d ${m.delta.tone}`}>{m.delta.text}</span>}</div>
          </button>
        ))}
      </div>
      {/* fewer than 3 points to draw (the account, or this number): the snapshot instead of a time chart */}
      {snapshot && (syncs < 3 || (k.ds && k.ds.weekly.length < 3))
        ? <Snapshot snap={snapshot} note={syncs < 3 ? 'History starts with the next sync' : k.note ?? 'History starts with the next sync'} />
        : k.ds && history
        ? <div className="vh" key={k.id}><VisibilityHistory dataset={k.ds} syncUrl={false} bare compact title={k.title} subtitle={k.subtitle} plotClass="h-[240px]" note={k.note}
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
function Spark({ spark, w: cw }) {
  if (!spark) return <span className="spark" style={cw ? { width: cw } : undefined} />
  const W = spark.w ?? 60, H = spark.h ?? 20
  const v = spark.values, lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1
  const d = v.map((x, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * (W - 2) + 1).toFixed(1)},${(H - 1 - ((x - lo) / span) * (H - 2)).toFixed(1)}`).join('')
  return <span className="spark" style={cw ? { width: cw } : undefined}><svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden><path d={d} fill="none" stroke={spark.color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg></span>
}
// "/products/dermasuri-deep-exfoliating-mitt" → "/products/…deep-exfoliating-mitt"
function midCut(path, max = 26) {
  if (path.length <= max) return path
  const parts = path.split('/').filter(Boolean)
  const head = parts.length > 1 ? `/${parts[0]}/` : '/'
  const room = max - head.length - 1
  return `${head}…${path.slice(-room).replace(/^[^-/]*[-/]/, '')}`
}
// a bar only when it shows a real difference: not when every value is the same, or every value is 1
function barsFor(rows, tab) {
  if (tab.bar === false) return null
  const vals = rows.filter((r) => !r.group).map((r) => (r.split ? r.split.reduce((a, x) => a + x.v, 0) : r.bar)).filter((v) => v != null)
  if (vals.length < 2 || vals.every((v) => v === vals[0]) || vals.every((v) => v === 1)) return null
  return Math.max(...vals)
}
// a small pie of a share (Competitors, Share of answers)
function Pie({ v, size = 16 }) {
  const r = size / 2, a = (Math.min(99.99, v) / 100) * 2 * Math.PI
  const x = r + r * Math.sin(a), y = r - r * Math.cos(a)
  return (
    <svg className="pie" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={r} cy={r} r={r} fill="var(--data-track)" />
      {v > 0 && <path d={`M${r},${r} L${r},0 A${r},${r} 0 ${v > 50 ? 1 : 0} 1 ${x.toFixed(2)},${y.toFixed(2)} Z`} fill="var(--ink)" />}
    </svg>
  )
}
// a column's own look (the divider before Prompts in Who's named instead); its width comes from the panel's grid
const colStyle = (c) => (c.divider ? { borderLeft: '1px solid var(--line)', alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingLeft: 16 } : undefined)
function Cell({ v, c }) {
  if (!v) return <span className="cell" style={colStyle(c)} />
  if (v.logos) return <span className="cell lg" style={colStyle(c)}><Favs list={v.logos.list} />{v.logos.more > 0 && <span className="more num">+{v.logos.more}</span>}{v.engines?.length > 0 && <span className="lg-eng"><Favs list={v.engines.map(engineIcon)} /></span>}</span>
  if (v.split) {
    const total = v.split.parts.reduce((a, x) => a + x.v, 0) || 1
    const tip = v.split.parts.map((x) => `${x.label} ${x.v}`).join(' · ')
    return <span className="cell sp" style={colStyle(c)} title={tip} aria-label={tip}><span className="split">{v.split.parts.filter((x) => x.v > 0).map((x) => <i key={x.label} className={x.hatched ? 'hatch' : ''} style={{ flex: `${x.v} 1 0`, background: x.hatched ? undefined : x.color, opacity: x.alpha ?? 1 }} />)}</span></span>
  }
  if (v.mini) return <span className="cell mini num" style={colStyle(c)}><b>{v.v}</b><span className="mtrack"><i className={v.mini.hatched ? 'hatch' : ''} style={{ width: `${Math.max(3, v.mini.w)}px`, background: v.mini.hatched ? undefined : v.mini.color }} /></span></span>
  if (v.mk) return <span className={`cell mk ${v.text ? 'num' : ''}`} style={colStyle(c)}><Marker size={18} found={v.mk.found} applies={v.mk.applies} tone={v.mk.tone} cross={v.mk.cross} />{v.text && <span className={v.mk.cross ? 'dn' : v.mk.found ? '' : 'muted'}>{v.text}</span>}</span>
  if (v.pie != null) return <span className="cell mk num" style={colStyle(c)}><Pie v={v.pie} /><b>{v.v}%</b></span>
  if (v.text != null) return <span className={`cell txt ${v.tone ?? ''}`} style={colStyle(c)}>{v.text}</span>
  return <span className={`cell n num ${v.tone ?? ''}`} style={colStyle(c)}>{v.pre ?? ''}{v.v.toLocaleString()}{v.suf ?? ''}</span>
}
function Row({ r, i, tab, max, onClick, anim }) {
  const total = r.split ? r.split.reduce((a, x) => a + x.v, 0) : r.bar
  return (
    <button type="button" className={`row sg ${anim ? 'grow' : ''} ${r.group ? 'grp' : ''} ${r.sub ? 'sub' : ''} ${r.muted ? 'muted' : ''}`} style={{ '--i': i }} onClick={onClick} title={r.sub && r.topic ? `Topic: ${r.topic}` : undefined}>
      {max != null && total != null && (r.split
        ? <span className="fill split" style={{ width: `${Math.max(4, (total / max) * 100)}%` }}>{r.split.map((x, k) => <i key={k} className={x.tone} style={{ flex: `${x.v} 1 0` }} />)}</span>
        : <span className="fill" style={{ width: `${Math.max(4, (total / (r.barMax ?? max)) * 100)}%` }} />)}
      <span className="t" title={r.title ?? r.t}>{r.glyph === 'none' ? <Marker size={18} found={0} applies={1} /> : <Fav icon={r.icon} />}<span className="x">{r.mid ? <><span className="mid-long">{midCut(r.t)}</span><span className="mid-short">{midCut(r.t, 16)}</span></> : r.t}</span></span>
      {r.span
        ? <span className="cell mk span"><Marker size={18} found={0} applies={1} /><span className="muted">{r.span.text}</span></span>
        : <>{tab.cols.map((c, k) => <Cell key={c.label} v={r.vals?.[k]} c={c} />)}{tab.spark && <Spark spark={r.spark} />}</>}
    </button>
  )
}
function Head({ def, tab, onTab }) {
  return (
    <div className="ptabs sg" role="tablist">
      <span className="tabsbox">
        {def.tabs.map((t) => (
          <button key={t.key} type="button" className={`ptab ${def.solo ? 'solo' : ''}`} role="tab" aria-selected={t.key === tab.key} onClick={def.solo ? undefined : () => onTab(t.key)}>{t.label}</button>
        ))}
      </span>
      {tab.cols.map((c) => <span key={c.label} className={`col ${c.text ? 'ct' : ''} ${c.divider ? 'div' : ''}`}>{c.label}</span>)}{tab.spark && <span className="col">{tab.sparkW ? 'Trend' : '8 weeks'}</span>}
    </div>
  )
}

// A panel is as tall as its rows, up to 7 (then the rest sit under a fade); panels in a row stretch to the tallest, the
// summary line pinned to the bottom. View all opens the list where it is: from the 7-row height to the rows' full
// height (measured, never "auto"), 240ms; the rows that were hidden come in 20ms apart. Show less reverses it and brings
// the header back into view. Past 25 rows the list scrolls inside. Switching tabs keeps it open.
const CAP = 25
const EASE = 'cubic-bezier(.2,.8,.2,1)'
function useExpand(listRef) {
  const run = (from, to, done) => {
    const el = listRef.current
    if (!el || reduce()) { done?.(); return }
    el.style.maxHeight = `${from}px`
    void el.offsetHeight
    el.style.transition = `max-height 240ms ${EASE}`
    el.style.maxHeight = `${to}px`
    const end = () => { el.style.transition = ''; done?.(); el.removeEventListener('transitionend', end) }
    el.addEventListener('transitionend', end)
  }
  return run
}
export function Panel({ def }) {
  const [st, setSt] = useState({ tab: def.tabs[0].key, filter: null })
  const [open, setOpen] = useState(false)
  const [entering, setEntering] = useState(false)
  const ref = useRef(null)
  const list = useRef(null)
  const run = useExpand(list)
  const tab = def.tabs.find((t) => t.key === st.tab) ?? def.tabs[0]
  const rows = st.filter ? tab.rows.filter((r) => r.topic === st.filter) : tab.rows
  const max = barsFor(rows, tab)
  const more = rows.length > VISIBLE
  const prompts = def.tabs.some((t) => t.key === 'prompts')
  const clipH = () => { const r = list.current?.children; return r && r[VISIBLE] ? r[VISIBLE].offsetTop - list.current.offsetTop : 0 }
  const expand = () => {
    const from = list.current?.offsetHeight ?? 0
    setOpen(true); setEntering(true)
    requestAnimationFrame(() => { const el = list.current; if (!el) return; el.style.maxHeight = 'none'; const full = Math.min(el.scrollHeight, CAP * 44); run(from, full, () => { if (list.current) list.current.style.maxHeight = rows.length > CAP ? `${CAP * 44}px` : 'none'; setEntering(false) }) })
  }
  const collapse = () => {
    const el = list.current
    run(el.offsetHeight, clipH(), () => {
      setOpen(false)
      if (list.current) list.current.style.maxHeight = ''
      if ((ref.current?.getBoundingClientRect().top ?? 0) < 0) ref.current.scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' })
    })
  }
  return (
    <section ref={ref} className={`panel ${def.full ? 'full' : ''} ${open ? 'open' : ''}`} aria-label={tab.label}>
      <div className={`pgrid ${def.id === 'engines' ? 'engines' : ''}`} style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${tab.cols.length + (tab.spark ? 1 : 0)}, auto)` }}>
        <Head def={def} tab={tab} onTab={(k) => setSt({ tab: k, filter: null })} />
        {st.filter && <div className="filter">Filtered to <button type="button" onClick={() => setSt((s) => ({ ...s, filter: null }))}>{st.filter} <span aria-hidden="true">×</span></button></div>}
        <div ref={list} className={`rows sg ${more && !open ? 'clip seven' : ''} ${open && rows.length > CAP ? 'capped' : ''} ${def.plain ? 'plain' : ''}`}>
          {rows.map((r, i) => (
            <div key={`${tab.key}-${st.filter}-${r.t}-${i}`} className={`sg ${entering && i >= VISIBLE ? 'rise' : ''}`} style={{ '--k': i - VISIBLE }}>
              <Row r={r} i={i} tab={tab} max={def.plain ? null : max} anim={!open}
                onClick={prompts && r.click ? () => { setSt({ tab: 'prompts', filter: r.click }) } : undefined} />
            </div>
          ))}
        </div>
      </div>
      {!more && tab.summary && <div className="summary pinned">{tab.summary}</div>}
      {more && (open
        ? <div className="less"><button type="button" onClick={collapse}>Show less ↑</button></div>
        : <div className="viewall"><button type="button" onClick={expand}>View all {ICON_EXP}</button><button type="button" aria-label="More options">···</button></div>)}
    </section>
  )
}

// ---- What moved (Weekly): one full-width panel; a row per topic, a diverging bar (net, one scale for every row), the
// engines it moved on, gained · lost · net. A row opens to its prompts (several can be open); the first with a loss
// starts open
function MovedRow({ m, scale, open, onToggle, labels, eng }) {
  const body = useRef(null)
  const [h, setH] = useState(open ? 'auto' : 0)
  useLayoutEffect(() => {
    const el = body.current
    if (!el) return
    if (reduce()) { setH(open ? 'auto' : 0); return }
    const full = el.scrollHeight
    if (open) { setH(0); requestAnimationFrame(() => setH(full)); const t = setTimeout(() => setH('auto'), 260); return () => clearTimeout(t) }
    setH(full); requestAnimationFrame(() => requestAnimationFrame(() => setH(0)))
  }, [open])
  const w = (Math.abs(m.net) / scale) * 50
  return (
    <div className="mv">
      <button type="button" className={`mv-row ${eng ? '' : 'noeng'}`} aria-expanded={open} onClick={onToggle}>
        <span className="mv-t"><ChevronRight size={14} className={`chev ${open ? 'on' : ''}`} aria-hidden />{m.topic}</span>
        {eng && <span className="mv-eng"><Favs list={m.engines.map(engineIcon)} /></span>}
        <span className="mv-bar" aria-hidden><i className="axis" />{m.net !== 0 && <i className={m.net > 0 ? 'pos' : 'neg'} style={m.net > 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }} />}</span>
        <span className={`mv-n ${m.gained.length ? 'up' : ''}`}>{m.gained.length ? `+${m.gained.length}` : '0'}</span>
        <span className={`mv-n ${m.lost.length ? 'dn' : ''}`}>{m.lost.length ? `−${m.lost.length}` : '0'}</span>
        <span className={`mv-n net ${m.net > 0 ? 'up' : m.net < 0 ? 'dn' : ''}`}>{m.net > 0 ? `+${m.net}` : m.net < 0 ? `−${-m.net}` : '0'}</span>
      </button>
      <div className="mv-body" ref={body} style={{ height: h, transition: reduce() ? 'none' : `height 240ms ${EASE}` }}>
        {[...m.lost, ...m.gained].map((x) => (
          <div key={x.prompt} className="mv-p">
            <span className="x">{x.prompt}</span>
            <Favs list={x.engines.map(engineIcon)} />
            <Marker size={16} {...(x.kind === 'lost' ? { cross: true } : { found: 1, applies: 1, tone: 'good' })} />
            <span className="sr-only">{x.kind === 'lost' ? labels.lost : labels.gained}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
function WhatMoved({ moved }) {
  const firstLoss = moved.rows.findIndex((m) => m.lost.length)
  const [open, setOpen] = useState(() => new Set(firstLoss >= 0 ? [firstLoss] : []))
  const scale = Math.max(1, ...moved.rows.map((m) => Math.abs(m.net)))
  // the Engines column only when the data says which engines the prompts moved on
  const eng = moved.rows.some((m) => m.engines.length)
  return (
    <section className="panel moved" aria-label={moved.title}>
      <div className="ptabs"><span className="ptab solo">{moved.title}</span><span className="col">{moved.col}</span></div>
      <div className={`mv-head ${eng ? '' : 'noeng'}`}><span className="mv-t">Topic</span>{eng && <span className="mv-eng">Engines</span>}<span className="mv-bar" /><span className="mv-n">{moved.gained}</span><span className="mv-n">{moved.lost}</span><span className="mv-n net">Net</span></div>
      <div className="mv-list">
        {moved.rows.map((m, i) => <MovedRow key={m.topic} m={m} scale={scale} eng={eng} open={open.has(i)} labels={moved} onToggle={() => setOpen((o) => { const n = new Set(o); if (n.has(i)) n.delete(i); else n.add(i); return n })} />)}
      </div>
      {/* the axis' ticks under the change column: − 0 + */}
      <div className={`mv-row mv-ticks ${eng ? '' : 'noeng'}`} aria-hidden><span />{eng && <span />}<span className="mv-bar"><b>−</b><b>0</b><b>+</b></span><span /><span /><span /></div>
    </section>
  )
}

// ---- Competitors (CEO): a table across the width. Brand · named on · share (a bar in the brand's chart colour) · change
// since the last sync · trend · leads on; a column without data is hidden
function CompetitorsTable({ table }) {
  const h = table.has
  const cols = ['minmax(200px,1.2fr)', h.named && '96px', 'minmax(200px,2fr)', h.change && '84px', h.trend && '80px', h.leads && 'minmax(140px,1fr)'].filter(Boolean).join(' ')
  return (
    <section className="panel ctable" aria-label={table.title}>
      <div className="ptabs"><span className="ptab solo">{table.title}</span><span className="col">{table.count} tracked</span></div>
      <div className="ct-row ct-head" style={{ gridTemplateColumns: cols }}>
        <span>Brand</span>{h.named && <span className="r">Named on</span>}<span>Share</span>{h.change && <span className="r">Change</span>}{h.trend && <span>Trend</span>}{h.leads && <span>Leads on</span>}
      </div>
      {table.rows.map((b) => (
        <div key={b.domain} className="ct-row" style={{ gridTemplateColumns: cols }}>
          <span className="t"><Fav icon={{ domain: b.domain, name: b.name }} /><span className="x">{b.name}{b.you ? <em> · you</em> : null}</span></span>
          {h.named && <span className="r num">{b.named ?? <i className="muted">—</i>}</span>}
          <span className="ct-share"><span className="track"><i style={{ width: `${b.share}%`, background: b.color }} /></span><b className="num">{b.share}%</b></span>
          {h.change && <span className={`r num ${b.change > 0 ? (b.you ? 'up' : 'dn') : b.change < 0 ? (b.you ? 'dn' : 'up') : 'muted'}`}>{b.change == null ? '—' : b.change === 0 ? '0' : `${b.change > 0 ? '▲' : '▼'} ${Math.abs(b.change)}`}</span>}
          {h.trend && <span>{b.series?.length >= 2 ? <Spark spark={{ values: b.series, color: b.color, w: 64, h: 20 }} w={64} /> : <i className="muted">—</i>}</span>}
          {h.leads && <span className="x muted">{b.leads ?? '—'}</span>}
        </div>
      ))}
    </section>
  )
}

// ---- Open prompts (Missing prompts): full width, a block per topic in 3 columns; "+n more" opens the block in place
function OpenPrompts({ open }) {
  const [more, setMore] = useState(() => new Set())
  return (
    <section className="panel openp" aria-label={open.title}>
      <div className="ptabs"><span className="ptab solo">{open.title}</span><span className="op-count num">{open.count}</span><span className="col">No brand named</span></div>
      <div className="op-grid">
        {open.groups.map((g) => {
          const all = more.has(g.topic)
          return (
            <div key={g.topic} className="op-block">
              <div className="op-head"><b>{g.topic}</b>{g.you != null && g.of ? <span className="num"><Marker size={16} found={g.you} applies={g.of} /> you {g.you}/{g.of}</span> : <span className="num muted">{g.prompts.length}</span>}</div>
              {(all ? g.prompts : g.prompts.slice(0, 3)).map((x, i) => (
                <div key={x.prompt} className={`op-row ${all && i >= 3 ? 'rise' : ''}`} style={{ '--k': i - 3 }}><span className="x">{x.prompt}</span>{x.engines.length > 0 && <Favs list={x.engines.map(engineIcon)} />}</div>
              ))}
              {g.prompts.length > 3 && <button type="button" className="op-more" onClick={() => setMore((m) => { const n = new Set(m); if (n.has(g.topic)) n.delete(g.topic); else n.add(g.topic); return n })}>{all ? 'Show less' : `+${g.prompts.length - 3} more`}</button>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ---- next steps: one card per action (2–3 in a row, equal width and height; full width alone; stacked on a phone) ----
// Card: the action and its topic; the prompts it could win (28px) with who's named on them; its first 3 prompts with
// the engines they're lost on. A click opens the brief.
const Favs = ({ list }) => <span className="favs">{list.map((e) => <Fav key={e.domain} icon={e} />)}</span>
const engineIcon = (id) => ({ domain: { aio: 'google.com', chatgpt: 'chatgpt.com', gemini: 'gemini.google.com', claude: 'claude.ai' }[id], name: id })
// who's named on the step's prompts: the brand named most often (not always the report's rival), and you
function stepFacts(s) {
  const items = s.items ?? []
  const n = items.length || s.n
  const counts = new Map()
  items.forEach((x) => x.named.filter((b) => !b.you).forEach((b) => counts.set(b.domain, { name: b.name, n: (counts.get(b.domain)?.n ?? 0) + 1 })))
  const top = [...counts.values()].sort((a, b) => b.n - a.n)[0] ?? null
  const shortN = (t) => (t.length <= 14 ? t : t.replace(/^The\s+/i, '').split(/\s+/)[0])
  return { n, top: top ? { name: shortN(top.name), n: top.n } : null, youOn: items.filter((x) => x.you).length }
}

// the brief: 560px from the right, header and footer sticky, the body scrolls; the page dims to 50%; Esc or a click
// outside closes it; focus stays inside
function BriefDrawer({ s, onClose, onCopy, onOpen }) {
  const [closing, setClosing] = useState(false)
  const [row, setRow] = useState(null)
  const box = useRef(null)
  const close = () => { if (reduce()) { onClose(); return } setClosing(true); setTimeout(onClose, 240) }
  useEffect(() => {
    const prev = document.activeElement
    box.current?.querySelector('button')?.focus()
    const key = (e) => {
      if (e.key === 'Escape') { close(); return }
      if (e.key !== 'Tab' || !box.current) return
      const f = [...box.current.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled)
      if (!f.length) return
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus() } else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus() }
    }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); prev?.focus?.() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const { n, top, youOn } = stepFacts(s)
  const items = s.items ?? s.prompts.map((p) => ({ prompt: p, engines: [], named: [], you: false }))
  const engines = [...new Set(items.flatMap((x) => x.engines))]
  const facts = [`${n} ${n === 1 ? 'prompt' : 'prompts'}`, top ? `${top.name} named on ${top.n}` : null, `you on ${youOn}`].filter(Boolean).join(' · ')
  // the outline, built from the prompts themselves (no invented copy): the topic as the H1, the prompts as sections
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1)
  const sections = items.slice(0, 4).map((x) => cap(x.prompt))
  return createPortal(
    <div className={`r5 sheet-wrap brief-wrap ${closing ? 'out' : ''}`} onMouseDown={(e) => { if (!box.current?.contains(e.target)) close() }}>
      <div className="dim" />
      <aside ref={box} className="sheet brief" role="dialog" aria-modal="true" aria-label={s.t}>
        <header className="bd-head">
          <div className="bd-title"><h2>{s.t}</h2><span className="chip">{s.topic}</span><button type="button" className="sh-x" onClick={close} aria-label="Close">×</button></div>
          <p className="bd-facts">{facts}</p>
        </header>
        <div className="bd-body">
          <div className="bd-tiles">
            <div><span>To win</span><b className="num">{n}</b></div>
            {top && <div><span>{top.name} named</span><b className="num">{top.n}/{n}</b></div>}
            {engines.length > 0 && <div><span>Engines</span><Favs list={engines.map(engineIcon)} /></div>}
          </div>
          <section className="bd-sec">
            <div className="bd-cols"><span>Prompt</span>{engines.length > 0 && <span className="c">Engines</span>}<span className="c">Named</span></div>
            {items.map((x, i) => (
              <div key={x.prompt} className="bd-row-wrap">
                <button type="button" className="bd-row" aria-expanded={row === i} onClick={() => setRow((r) => (r === i ? null : i))}>
                  <span className="x">{x.prompt}</span>
                  {engines.length > 0 && <span className="c"><Favs list={x.engines.map(engineIcon)} /></span>}
                  <span className="c"><Favs list={x.named.map((b) => ({ domain: b.domain, name: b.name }))} /></span>
                </button>
                {row === i && (
                  <div className="bd-more">
                    <div><span>Named</span>{x.named.length ? x.named.map((b) => b.you ? `${b.name} (you)` : b.name).join(', ') : 'No brand'}</div>
                    {x.engines.length > 0 && <div><span>Lost on</span>{x.engines.map((e) => ({ aio: 'AI Overview', chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude' }[e])).join(', ')}</div>}
                  </div>
                )}
              </div>
            ))}
          </section>
          {/* the page that wins it: only when it's the page of the brand named most on these prompts */}
          {s.theirPage && s.rival && (!top || top.name === s.rival.name || s.rival.name.startsWith(top.name)) && (
            <section className="bd-sec">
              <h3>Page that wins it now</h3>
              <div className="bd-row static"><span className="x"><Fav icon={s.rival.icon} />{s.rival.domain}{s.theirPage.path}</span><span className="c num">{s.theirPage.n}×</span></div>
            </section>
          )}
          {s.yourPage && (
            <section className="bd-sec">
              <h3>Your page</h3>
              <div className="bd-row static"><span className="x">{s.yourPage.path}</span><span className="c num">{s.yourPage.n}×</span></div>
            </section>
          )}
          <section className="bd-sec">
            <h3>What the page should cover</h3>
            <div className="bd-row static"><span className="tag">H1</span><span className="x">{s.topic}</span></div>
            {sections.map((t) => <div key={t} className="bd-row static"><span className="tag">§</span><span className="x">{t}</span></div>)}
            <div className="bd-row static"><span className="tag">FAQ</span><span className="x">the {n} {n === 1 ? 'prompt' : 'prompts'} above</span></div>
          </section>
        </div>
        <footer className="bd-foot">
          <button type="button" className="primary" onClick={() => onCopy?.(s)}>Copy brief</button>
          <button type="button" className="link" onClick={() => onOpen?.(s)}>Open in Prompt Hub →</button>
        </footer>
      </aside>
    </div>,
    document.body,
  )
}

// ---- Next moves (Weekly): Win back each lost topic, then Build on the biggest gains; a card per move (one alone: a
// wide card, title and number left, its prompts in two columns, the links right)
// a 14px outline tick in the muted text colour (prompts won)
const OutlineTick = () => <svg width="14" height="14" viewBox="0 0 14 14" className="otick" aria-hidden><circle cx="7" cy="7" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M4.3 7.2 6.2 9 9.8 5.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
function MoveCard({ m, onCopy, onOpen, wide }) {
  const n = m.kind === 'back' ? `−${m.n}` : `+${m.n}`
  return (
    <article className={`step-card move ${wide ? 'wide' : ''}`}>
      <div className="mc-main">
        <div className="sc-head"><h3>{m.t}</h3>
          {/* Biggest wins: the ring for the topic now in the chip's place (the title already names it) */}
          {m.kind === 'won' ? (m.now != null && m.of ? <span className="mc-now num"><Marker size={16} found={m.now} applies={m.of} /> now {m.now}/{m.of}</span> : null) : !wide && <span className="chip">{m.topic}</span>}
        </div>
        <div className={`mc-num ${m.kind === 'won' ? 'won' : ''}`}>
          {m.kind === 'won' ? <b className="num"><span className="tri" aria-hidden>▲</span>{m.n}</b> : <b className={`num ${m.kind === 'back' ? 'dn' : 'up'}`}>{n}</b>}<span>{m.kind === 'back' ? (m.n === 1 ? 'prompt lost' : 'prompts lost') : m.kind === 'won' ? (m.n === 1 ? 'prompt won' : 'prompts won') : (m.n === 1 ? 'prompt gained' : 'prompts gained')}</span>
          {m.engines.length > 0 && <Favs list={m.engines.map(engineIcon)} />}
        </div>
        {m.kind !== 'won' && m.now != null && m.of && m.was != null ? <div className="mc-was num"><Marker size={16} found={Math.max(0, m.was)} applies={m.of} /> was {m.was}/{m.of} <span className="arr">→</span> <Marker size={16} found={m.now} applies={m.of} /> now {m.now}/{m.of}</div> : null}
        {m.kind === 'back' && m.naming?.length > 0 && <div className="mc-naming">Now naming <Favs list={m.naming} /></div>}
        {wide && m.kind !== 'won' && <span className="chip">{m.topic}</span>}
      </div>
      <div className={`sc-list ${wide ? 'two' : ''}`}>
        {m.rows.slice(0, wide ? 6 : 3).map((x) => (
          <div key={x.prompt} className={`sc-row ${m.kind === 'won' ? 'lead' : ''}`}>
            {m.kind === 'won' && <OutlineTick />}
            <span className="x">{x.prompt}</span>
            {(x.engines || []).length > 0 && <Favs list={x.engines.map(engineIcon)} />}
            {m.kind !== 'won' && <Marker size={16} {...(x.won ? { found: 1, applies: 1, tone: 'good' } : { cross: true })} />}
          </div>
        ))}
        {m.rows.length > (wide ? 6 : 3) && <div className="sc-more">+{m.rows.length - (wide ? 6 : 3)} more</div>}
        {/* Biggest wins: always 3 rows; an empty slot is the topic's status */}
        {m.kind === 'won' && m.rows.length < 3 && (
          <div className="sc-row lead status">
            {m.now != null && m.of ? <><Marker size={16} found={m.now} applies={m.of} tone="good" /><span className="x">{m.topic} now {m.now}/{m.of}</span></>
              : <span className="x">{m.n === 1 ? 'One prompt' : `${m.n} prompts`} won in {m.topic.toLowerCase()} since the last sync</span>}
          </div>
        )}
      </div>
      <div className="sc-foot">
        <button type="button" className="link" onClick={() => onCopy?.(m)}>Copy brief</button>
        <button type="button" className="link" onClick={() => onOpen?.(m)}>{m.defend ? 'Defend this page →' : 'Open in Prompt Hub →'}</button>
      </div>
    </article>
  )
}
function NextMoves({ steps, onCopy, onOpen }) {
  const one = steps.moves.length === 1
  return (
    <section className="steps" aria-label={steps.title}>
      <h2 className="steps-title">{steps.title}</h2>
      <div className={`step-cards n${steps.moves.length} ${steps.moves.some((m) => m.kind === 'won') ? 'won' : ''}`}>{steps.moves.map((m) => <MoveCard key={m.t} m={m} wide={one} onCopy={onCopy} onOpen={onOpen} />)}</div>
    </section>
  )
}

function Steps({ steps, onCopy, onOpen }) {
  const [open, setOpen] = useState(null)
  const rows = [...steps.rows].sort((a, b) => b.n - a.n).slice(0, 3)
  const unit = steps.unit ?? 'prompts'
  return (
    <section className="steps" aria-label={steps.title}>
      <h2 className="steps-title">{steps.title}</h2>
      <div className={`step-cards n${rows.length}`}>
        {rows.map((s) => {
          const { top, youOn, n } = stepFacts(s)
          const items = s.items ?? s.prompts.map((p) => ({ prompt: p, engines: [] }))
          return (
            <article key={s.t} className="step-card" role="button" tabIndex={0} onClick={() => setOpen(s)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(s) }}>
              <div className="sc-head"><h3>{s.t}</h3><span className="chip">{s.topic}</span></div>
              <div className="sc-num">
                <b className="num">{s.n}</b><span>{unit === 'prompts' ? `${s.n === 1 ? 'prompt' : 'prompts'} to win` : unit}</span>
                <em className="num">{[top ? `${top.name} ${top.n}/${n}` : null, s.items ? `you ${youOn}/${n}` : null].filter(Boolean).join(' · ')}</em>
              </div>
              <div className="sc-list">
                {(steps.rich ? [...items].sort((a, b) => (a.named?.length ?? 0) - (b.named?.length ?? 0)) : items).slice(0, 3).map((x) => (steps.rich ? (
                  <div key={x.prompt} className="sc-row rich">
                    {x.named?.length ? <span className="dot-red" aria-label="a competitor is named" /> : <Marker size={14} found={0} applies={1} />}
                    <span className="x">{x.prompt}</span>
                    {x.named?.length > 0 && <Favs list={x.named.slice(0, 2)} />}
                    {(x.engines || []).length > 0 && <Favs list={x.engines.map(engineIcon)} />}
                    {s.now != null && s.of ? <span className="cov num"><Marker size={14} found={s.now} applies={s.of} /> {s.now}/{s.of}</span> : null}
                    <button type="button" className="row-copy" onClick={(e) => { e.stopPropagation(); onCopy?.(s) }}>Copy brief</button>
                  </div>
                ) : (
                  <div key={x.prompt} className="sc-row"><span className="x">{x.prompt}</span><Favs list={(x.engines || []).map(engineIcon)} /></div>
                )))}
              </div>
            </article>
          )
        })}
      </div>
      {open && <BriefDrawer s={open} onClose={() => setOpen(null)} onCopy={onCopy} onOpen={onOpen} />}
    </section>
  )
}

// ---- the report -----------------------------------------------------------------------------------------------------
const grid = (n) => (n >= 3 ? 'g3' : n === 2 ? 'g2' : 'g1')
// a list that can expand (more than 7 rows, What moved, Open prompts) or a table is full width on its own row; short
// panels share a row of 2–3, in order
const expandable = (b) => !!(b.moved || b.open || b.table || b.panel?.full || b.panel?.tabs.some((t) => t.rows.length > VISIBLE || t.wide))
function layout(blocks) {
  const rows = []
  let short = []
  const flush = () => { while (short.length) rows.push(short.splice(0, 3)) }
  blocks.forEach((b) => { if (expandable(b)) { flush(); rows.push([b]) } else short.push(b) })
  flush()
  return rows
}
export default function Report5({ view, onPeriod, exportActions = [], onChangeRead, onCopyBrief, onOpenHub }) {
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
      <KpiCard kpis={view.kpis} selected={kpi} onSelect={setKpi} history={view.history} snapshot={view.snapshot} syncs={view.syncs} />
      {layout(view.blocks ?? []).map((row, i) => (
        <div key={i} className={grid(row.length)}>
          {row.map((b, k) => b.moved ? <WhatMoved key={k} moved={b.moved} /> : b.open ? <OpenPrompts key={k} open={b.open} /> : b.table ? <CompetitorsTable key={k} table={b.table} /> : <Panel key={b.panel.id} def={b.panel} />)}
        </div>
      ))}
      {view.steps && <div className="g1">{view.steps.moves ? <NextMoves steps={view.steps} onCopy={onCopyBrief} onOpen={onOpenHub} /> : <Steps steps={view.steps} onCopy={onCopyBrief} onOpen={onOpenHub} />}</div>}
      <div className="foot">{view.footer}</div>
    </div>
  )
}
