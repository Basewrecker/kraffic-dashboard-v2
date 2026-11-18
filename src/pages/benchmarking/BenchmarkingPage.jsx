// Benchmarking (mock only, owner 2026-11-18): how the brand compares with its competitors in AI answers. Sample data
// and rules: data/benchmarking.js. The Overview's design system and parts: its header selects, cards, the Visibility
// history chart (every brand drawn: the brand in ink, the top three competitors indigo, red and green, the rest grey),
// the detail drawer shell, logos and engine icons. No new chart styles; no sentiment (competitor sentiment isn't
// collected).
//
// Top to bottom (redesign, owner 2026-11-18): Where you rank (the sentence and a 0–100 track of logos), Leaderboard (bars,
// sortable; a competitor opens You vs them), By engine (a heatmap), Over time (a rank chart with crossings), Where they
// beat you (one filterable list), Who gets cited (a quadrant chart; a brand opens its cited pages). One colour per brand.
// Header: Engine (?engine=, shared with the Overview), Range (Over time's period), Brands (?rivals=, the competitors
// shown) and Download (CSV). States: ?competitors=none, ?history=single, ?never=<engine>, ?noresult=<engine>.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, Check, ChevronDown, ChevronRight, Download, Lightbulb, Users } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import { MOBILE_TRIGGER, MenuSelect } from '../../components/dashboard/PageHeader'
import { PrimaryButton } from '../../components/dashboard/overlays'
import { PlatformIcon } from '../../components/dashboard/icons'
import { useWidth } from '../../components/ui/motion'
import DrawerShell, { Dot, SectionTitle, useDrawer } from '../../components/audit/DrawerShell'
import { openDrawer } from '../../components/audit/parts'
import SiteLogo from '../../components/ui/SiteLogo'
import { NoResultLine } from '../../components/ui/NoResult'
import { DashboardViewProvider, useDashboardView } from '../../hooks/useBrandView'
import { ENGINES, OWN, TRACKED_BRANDS, engineFullName, engineName } from '../../data/brandViews'
import { account, defaultRange, historyRanges } from '../../data/mock'
import { beats, benchCsv, brandColours, citedBrands, engineGrid, engineStatus, leaderboard, lostPrompts, previews, rankHistory, rankLine, sortRows, versus } from '../../data/benchmarking'
import { linkClick, navigate } from '../../router'
import { fmtDay, useTracking } from '../../store/trackingSettings'

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const pct = (v) => (v == null ? '—' : `${v}%`)
const num = (v) => (v == null ? '—' : v.toLocaleString('en-US'))
const signed = (v) => (v == null ? '—' : v === 0 ? '0' : v > 0 ? `+${v}` : `−${Math.abs(v)}`)
const titleCls = 'text-title font-semibold text-stone-900'
const subCls = 'mt-0.5 text-[13px] leading-[18px] text-stone-600'
const linkCls = 'inline-flex shrink-0 items-center gap-1 rounded text-[13px] leading-[18px] font-medium text-ink outline-none hover:underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-focus'
const logo = (b, size = 'h-6 w-6') => <SiteLogo domain={b.domain} name={b.name} className={`${size} shrink-0 rounded-md`} initialClass="text-[11px]" />

// "Open in Content": the prompt's page in Content
function OpenInContent({ id, prompt }) {
  const href = `/opportunities/content/${id}`
  return <a href={href} onClick={linkClick(href)} aria-label={`Open in Content: ${prompt}`} className={linkCls}>Open in Content<ArrowRight size={13} aria-hidden /></a>
}

// the competitors shown (?rivals=a,b; none: all of them). The brand is always shown.
const readRivals = (all) => { const q = new URLSearchParams(window.location.search).get('rivals'); const keys = q ? q.split(',').filter((k) => all.includes(k)) : []; return keys.length ? keys : all }
function writeParam(k, v) { const u = new URL(window.location.href); if (v == null) u.searchParams.delete(k); else u.searchParams.set(k, v); window.history.replaceState(window.history.state, '', u) }

// ---------------------------------------------------------------- header
// Brands: which competitors the page shows (a menu of checkboxes, the Overview chart's Brands menu look)
function BrandsFilter({ all, value, onChange }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const btn = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    wrap.current?.querySelector('[role=menuitemcheckbox]:not([aria-disabled])')?.focus()
    const away = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])
  const onKey = (e) => {
    const items = [...wrap.current.querySelectorAll('[role=menuitemcheckbox]')]
    const i = items.indexOf(document.activeElement)
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); btn.current?.focus() }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus() }
    else if (e.key === 'Tab') setOpen(false)
  }
  const toggle = (k) => { const next = value.includes(k) ? value.filter((x) => x !== k) : [...value, k]; if (next.length) onChange(all.filter((x) => next.includes(x))) }
  const label = value.length === all.length ? `All ${all.length + 1}` : `${value.length + 1} of ${all.length + 1}`
  return (
    <div ref={wrap} className="relative max-lg:w-full" onKeyDown={open ? onKey : undefined}>
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Brands: ${label}`} onClick={() => setOpen((o) => !o)} className={MOBILE_TRIGGER}>
        <span className="font-normal text-stone-500">Brands</span>
        <span className="-ml-0.5 min-w-0 truncate font-medium text-stone-900">{label}</span>
        <ChevronDown size={14} className="shrink-0 text-ink-3" />
      </button>
      {open && (
        <div role="menu" aria-label="Brands shown" className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-line bg-raised p-1 shadow-md max-lg:left-0 max-lg:right-0 max-lg:w-auto">
          {[OWN.key, ...all].map((k) => {
            const b = TRACKED_BRANDS.find((x) => x.key === k)
            const you = Boolean(b.you)
            const on = you || value.includes(k)
            const last = on && !you && value.length === 1
            return (
              <button key={k} type="button" role="menuitemcheckbox" aria-checked={on} aria-disabled={you || last || undefined} onClick={() => !you && !last && toggle(k)}
                title={last ? 'At least one competitor stays' : undefined}
                className={`flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] leading-[18px] text-stone-900 outline-none focus-visible:bg-tint ${you || last ? 'cursor-default' : 'hover:bg-tint'}`}>
                <span aria-hidden className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] ${on ? (you || last ? 'bg-stone-400' : 'bg-ink') : ''}`} style={on ? undefined : { boxShadow: 'inset 0 0 0 1.5px var(--color-stone-500)' }}>
                  {on && <Check size={12} strokeWidth={3} style={{ color: 'var(--line-check)' }} />}
                </span>
                {logo(b, 'h-5 w-5')}
                <span className={`min-w-0 flex-1 truncate ${on ? 'font-medium' : ''}`}>{b.name}{you && <span className="font-normal text-stone-500"> · you</span>}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Header({ empty, engine, setEngine, range, setRange, rivals, setRivals, allRivals, onDownload, p }) {
  const meta = (e) => ({ never: 'Never ran', missed: 'Didn’t run' }[engineStatus(e, p)] ?? null)
  const engineGroups = [{ items: [{ id: 'all', label: 'All engines' }, ...ENGINES.map((e) => ({ id: e.id, label: e.full, short: e.name, icon: <PlatformIcon id={e.id} size={16} />, meta: meta(e.id) }))] }]
  const rangeGroups = [{ items: historyRanges.weekly.map((r) => ({ id: r.id, label: r.label })) }]
  return (
    <div className="mb-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">Benchmarking</h1>
        <p className="mt-1 text-body text-stone-600">How {account.name} compares with its competitors in AI answers.</p>
      </div>
      {!empty && (
        <div className="flex shrink-0 flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:gap-2.5 lg:pt-1">
          <MenuSelect prefix="Engine" value={engine} onChange={setEngine} groups={engineGroups} listLabel="Filter by engine" footer="Filters every section to answers from this engine." className="max-lg:w-full" triggerClassName={MOBILE_TRIGGER} />
          <MenuSelect prefix="Range" value={range} onChange={setRange} groups={rangeGroups} listLabel="Date range" footer="The period Over time shows." className="max-lg:w-full" triggerClassName={MOBILE_TRIGGER} />
          <BrandsFilter all={allRivals} value={rivals} onChange={setRivals} />
          <PrimaryButton size="sm" icon={Download} type="button" onClick={onDownload} data-bench-download>Download</PrimaryButton>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- sections
// a "—" with a small card on hover / focus saying why ("Didn't run")
function Dash({ text }) {
  return (
    <span className="group/dash relative inline-flex">
      <span tabIndex={0} aria-label={text} className="rounded text-stone-500 outline-none focus-visible:ring-2 focus-visible:ring-focus">—</span>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-raised px-2 py-1 text-[12px] leading-4 font-medium text-stone-700 opacity-0 shadow-sm transition-opacity duration-150 group-hover/dash:opacity-100 group-focus-within/dash:opacity-100 motion-reduce:transition-none">{text}</span>
    </span>
  )
}

// one colour per brand across the page (data/benchmarking.js brandColours): you ink, competitors by place indigo,
// red, green, the rest grey
const ENGINE_OF = { google: 'aio', aimode: 'aimode', gemini: 'gemini', chatgpt: 'chatgpt', claude: 'claude', grok: 'grok' } // prompt data → engine ids
// a brand's logo in a round badge ringed in its colour (yours larger, ink)
function Badge({ b, colour, size = 26, big = false }) {
  const d = big ? size + 10 : size
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-surface" style={{ width: d, height: d, boxShadow: `0 0 0 ${big ? 2.5 : 2}px ${colour}` }}>
      <SiteLogo domain={b.domain} name={b.name} className="h-[72%] w-[72%] rounded-full" initialClass="text-[10px]" />
    </span>
  )
}

// 1. Where you rank: the sentence, then a full-width 0–100 track with every brand's logo at its visibility (yours larger,
// ink ring). Logos too close to share the line stack upward on a short stem. A bracket over the track marks the gap
// between you and the next brand ("+55 pts").
function WhereYouRank({ line, rows, colours, engine, status }) {
  const [ref, w] = useWidth()
  if (status !== 'ran' || !line) {
    return (
      <Card className="px-5 py-4" data-rank-line>
        {status === 'missed' ? <NoResultLine engine={engine} /> : <p className="text-[14px] leading-5 text-stone-600">{engineFullName(engine)} has never run, so there is nothing to rank yet.</p>}
      </Card>
    )
  }
  const PAD = 22, LANE = 38, SMALL = 26, BIG = 36
  const x = (v) => PAD + (Math.max(0, Math.min(100, v)) / 100) * Math.max(0, w - PAD * 2)
  // lanes: lowest first, a logo goes up a lane when it would touch the one before it on the same lane
  const placed = []
  ;[...rows].filter((r) => r.visibility != null).sort((a, b) => a.visibility - b.visibility).forEach((r) => {
    const size = r.you ? BIG : SMALL
    let lane = 0
    while (placed.some((q) => q.lane === lane && Math.abs(q.x - x(r.visibility)) < (q.size + size) / 2 + 4)) lane++
    placed.push({ r, lane, size, x: x(r.visibility) })
  })
  const lanes = Math.max(1, ...placed.map((q) => q.lane + 1))
  const TOP = 30 // the bracket and its label
  const trackY = TOP + (lanes - 1) * LANE + BIG / 2 + 4
  const height = trackY + BIG / 2 + 26
  const you = line.you, other = line.other
  const gap = you.visibility - other.visibility
  const bx0 = Math.min(x(you.visibility), x(other.visibility)), bx1 = Math.max(x(you.visibility), x(other.visibility))
  return (
    <Card className="px-5 pb-3 pt-4" data-rank-line>
      <p className="text-[17px] leading-6 font-semibold text-stone-900">{line.text}</p>
      <div ref={ref} className="relative mt-3 w-full" style={{ height }} aria-hidden>
        {w > 0 && (
          <>
            {/* the track and its scale */}
            <span className="absolute h-[2px] rounded-full bg-[var(--data-track)]" style={{ left: PAD, right: PAD, top: trackY - 1 }} />
            {[0, 25, 50, 75, 100].map((t) => (
              <span key={t} className="absolute -translate-x-1/2 text-[11px] leading-4 text-stone-500 tabular-nums" style={{ left: x(t), top: trackY + BIG / 2 + 6 }}>{t}</span>
            ))}
            {/* the gap between you and the next brand: a bracket with its points */}
            {gap !== 0 && (
              <>
                <span className="absolute border-x border-t border-ink" style={{ left: bx0, width: bx1 - bx0, top: TOP - 8, height: 6 }} />
                <span className="absolute -translate-x-1/2 whitespace-nowrap text-[12px] leading-4 font-semibold text-stone-900 tabular-nums" style={{ left: (bx0 + bx1) / 2, top: TOP - 26 }} data-gap>{gap > 0 ? '+' : '−'}{Math.abs(gap)} pts</span>
              </>
            )}
            {placed.map(({ r, lane, size, x: cx }) => {
              const cy = trackY - lane * LANE
              return (
                <span key={r.domain} data-pin={r.key}>
                  {lane > 0 && <span className="absolute w-px bg-[var(--color-line-strong)]" style={{ left: cx, top: cy, height: trackY - cy }} />}
                  <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: cx, top: cy }} title={`${r.name} · ${r.visibility}%`}>
                    <Badge b={r} colour={colours[r.domain]} size={SMALL} big={r.you} />
                  </span>
                </span>
              )
            })}
          </>
        )}
      </div>
      <p className="sr-only">{rows.filter((r) => r.visibility != null).map((r) => `${r.name} ${r.visibility}%`).join(', ')}</p>
    </Card>
  )
}

// 2. Leaderboard: sortable; Visibility is a bar in the brand's colour with the number at its end, share of voice under
// it; a competitor's row opens You vs them
const COLS = [
  { key: 'rank', label: '#', align: 'left', w: 'w-14' },
  { key: 'name', label: 'Brand', align: 'left', w: 'w-[240px]' },
  { key: 'visibility', label: 'Visibility', align: 'left', w: '' },
  { key: 'mentions', label: 'Mentions', w: 'w-[112px]' },
  { key: 'citations', label: 'Citations', w: 'w-[112px]' },
  { key: 'change', label: 'Change (pts)', w: 'w-[136px]', hint: 'Visibility points since the last sync' },
]
function Leaderboard({ rows, colours, engine, status, oneSync, sort, setSort }) {
  const cols = COLS.filter((c) => !(oneSync && c.key === 'change'))
  const shown = sortRows(rows, sort.key, sort.dir)
  const by = (key) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 'asc' ? 'desc' : 'asc') : key === 'name' || key === 'rank' ? 'asc' : 'desc' }))
  const cell = (r, c) => {
    if (c.key === 'rank') return <span className="text-stone-600 tabular-nums">{r.rank ?? '—'}</span>
    if (c.key === 'name') {
      return (
        <span className="flex min-w-0 items-center gap-2.5">
          {logo(r)}
          <span className={`min-w-0 truncate ${r.you ? 'font-semibold' : 'font-medium'} text-stone-900`}>{r.name}</span>
          {r.you && <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[12px] leading-4 font-medium text-stone-600 ring-1 ring-line">You</span>}
        </span>
      )
    }
    if (c.key === 'visibility') {
      if (r.visibility == null) return <span className="text-stone-500">—</span>
      return (
        <span className="block min-w-0 pr-6" data-bar={r.key}>
          <span className="flex items-center gap-2">
            <span className="h-2.5 shrink-0 rounded-full" style={{ width: `calc((100% - 52px) * ${r.visibility / 100})`, minWidth: 3, background: colours[r.domain] }} />
            <span className={`text-[14px] leading-5 tabular-nums text-stone-900 ${r.you ? 'font-semibold' : 'font-medium'}`}>{r.visibility}%</span>
          </span>
          <span className="mt-0.5 block text-[12px] leading-4 text-stone-500 tabular-nums">{pct(r.share)} share of voice</span>
        </span>
      )
    }
    if (c.key === 'change') return r.change == null ? '—' : <span className={r.change < 0 ? 'text-negative' : r.change > 0 ? 'text-stone-900' : 'text-stone-500'}>{signed(r.change)}</span>
    return num(r[c.key])
  }
  return (
    <Card className="min-w-0 px-5 pb-2 pt-5" data-leaderboard>
      <h2 className={titleCls}>Leaderboard</h2>
      <p className={subCls}>Every brand by visibility{engine !== 'all' ? ` on ${engineName(engine)}` : ''}, latest sync. Click a competitor to compare.</p>
      {status !== 'ran' && <div className="mt-3">{status === 'missed' ? <NoResultLine engine={engine} /> : <span className="text-small text-stone-500">{engineFullName(engine)} has never run</span>}</div>}
      <div className="-mx-5 mt-3 overflow-x-auto">
        <table className="w-full min-w-[920px] table-fixed text-[14px] leading-5">
          <thead>
            <tr className="h-9 border-y border-line bg-tint text-[12px] leading-4 text-stone-600">
              {cols.map((c, i) => {
                const active = sort.key === c.key
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`${c.w} px-3 ${i === 0 ? 'pl-5' : ''} font-medium ${c.align === 'left' ? 'text-left' : 'text-right'}`}>
                    <button type="button" onClick={() => by(c.key)} title={c.hint} className={`inline-flex items-center gap-1 whitespace-nowrap rounded outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus ${active ? 'text-stone-900' : ''}`}>
                      {c.label}
                      {active ? (sort.dir === 'asc' ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />) : <span className="w-3" aria-hidden />}
                    </button>
                  </th>
                )
              })}
              <th className="w-10" aria-hidden />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--div)]">
            {shown.map((r) => (
              <tr key={r.domain} data-row={r.key} data-you={r.you || undefined}
                onClick={r.you ? undefined : () => openDrawer('vs', r.key)}
                className={`group h-16 ${r.you ? 'bg-[var(--tint)]' : 'cursor-pointer transition-colors duration-150 hover:bg-[var(--tint)]'}`}>
                {cols.map((c, i) => (
                  <td key={c.key} className={`px-3 ${i === 0 ? 'pl-5' : ''} ${c.align === 'left' ? 'text-left' : 'text-right tabular-nums'} ${c.key === 'name' ? '' : 'text-stone-900'}`}>
                    {c.key === 'name' && !r.you
                      ? <button type="button" onClick={(e) => { e.stopPropagation(); openDrawer('vs', r.key) }} aria-label={`Compare ${OWN.name} with ${r.name}`} className="flex w-full min-w-0 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-focus">{cell(r, c)}</button>
                      : cell(r, c)}
                  </td>
                ))}
                <td className="pr-4 text-right">{!r.you && <ChevronRight size={16} aria-hidden className="inline text-stone-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// 3. By engine, a heatmap: brands × engines, each tile ink from 5% (low) to 85% (the highest value on the page), its
// text on-ink once the tile is dark; the best tile per engine outlined in ink; an engine that didn't run a dashed empty
// tile ("Didn't run" on hover); no row lines
function ByEngine({ grid, brands }) {
  const top = Math.max(1, ...grid.flatMap((g) => Object.values(g.values).filter((v) => v != null)))
  const cols = `minmax(170px,220px) repeat(${grid.length}, minmax(88px,1fr))`
  return (
    <Card className="min-w-0 px-5 py-5" data-by-engine>
      <h2 className={titleCls}>By engine</h2>
      <p className={subCls}>Visibility on each engine, latest sync. The higher the value, the stronger the tile; the best on each engine is outlined.</p>
      <div className="-mx-5 mt-4 overflow-x-auto px-5 pb-1 pt-1">
        <div role="table" aria-label="Visibility by engine" className="grid min-w-[640px] gap-2" style={{ gridTemplateColumns: cols }}>
          <div role="row" className="contents">
            <span role="columnheader" className="text-[12px] leading-4 text-stone-600">Brand</span>
            {grid.map((g) => (
              <span key={g.engine} role="columnheader" data-engine={g.engine} className="inline-flex items-center justify-center gap-1.5 text-[12px] leading-4 font-medium text-stone-600">
                <PlatformIcon id={g.engine} size={14} />{engineName(g.engine)}
              </span>
            ))}
          </div>
          {brands.map((b) => (
            <div key={b.domain} role="row" className="contents">
              <span role="rowheader" className="flex min-w-0 items-center gap-2.5">
                {logo(b, 'h-5 w-5')}
                <span className={`min-w-0 truncate text-[14px] leading-5 text-stone-900 ${b.you ? 'font-semibold' : 'font-medium'}`}>{b.name}</span>
              </span>
              {grid.map((g) => {
                const v = g.values[b.domain]
                const best = g.best.includes(b.domain)
                if (g.status !== 'ran') {
                  const why = g.status === 'never' ? 'Never ran' : 'Didn’t run'
                  return (
                    <span key={g.engine} role="cell" tabIndex={0} aria-label={why} data-cell={`${b.key}|${g.engine}`} data-tile="empty"
                      className="group/dash relative h-11 rounded-lg border border-dashed border-[var(--color-line-strong)] outline-none focus-visible:ring-2 focus-visible:ring-focus">
                      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-raised px-2 py-1 text-[12px] leading-4 font-medium text-stone-700 opacity-0 shadow-sm transition-opacity duration-150 group-hover/dash:opacity-100 group-focus-visible/dash:opacity-100 motion-reduce:transition-none">{why}</span>
                    </span>
                  )
                }
                const ink = Math.round(5 + 80 * (v / top))
                return (
                  <span key={g.engine} role="cell" data-cell={`${b.key}|${g.engine}`} data-best={best || undefined} data-ink={ink}
                    className={`grid h-11 place-items-center rounded-lg text-[14px] leading-5 tabular-nums ${ink > 45 ? 'text-on-ink' : 'text-stone-900'} ${best ? 'font-semibold' : 'font-medium'}`}
                    style={{ background: `color-mix(in srgb, var(--ink) ${ink}%, transparent)`, ...(best ? { outline: '1.5px solid var(--ink)', outlineOffset: 2 } : {}) }}>
                    {v}%{best && <span className="sr-only">, best on {engineName(g.engine)}</span>}
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

// 4. Over time, as ranks: one column per weekly sync, each brand's logo at its place (1 at the top), joined by a line
// in its colour; where two lines cross, a small marker ("CeraVe passed The Ordinary, Sep 21") on hover or focus; the
// line underneath names the latest overtake
function OverTime({ oneSync, range, brands, colours }) {
  const tracking = useTracking()
  const [ref, w] = useWidth()
  const [tip, setTip] = useState(null)
  if (oneSync) {
    return (
      <Card className="px-5 py-5" data-over-time>
        <h2 className={titleCls}>Over time</h2>
        <p className="mt-3 text-[14px] leading-5 text-stone-600">History starts after the second sync. There is one so far ({fmtDay(tracking.schedule.lastSync)}).</p>
      </Card>
    )
  }
  const byKey = Object.fromEntries(brands.map((b) => [b.key, b]))
  const { weeks, keys, crossings } = rankHistory(range, brands.map((b) => b.key))
  const n = keys.length
  const L = 44, R = 150, T = 18, ROW = 54
  const height = T + Math.max(1, n - 1) * ROW + 52
  const xAt = (i) => (weeks.length < 2 ? L + (w - L - R) / 2 : L + (i / (weeks.length - 1)) * Math.max(0, w - L - R))
  const yAt = (rank) => T + (rank - 1) * ROW
  const name = (k) => byKey[k]?.name ?? k
  const latest = crossings.at(-1)
  const lastWeek = weeks.at(-1)
  return (
    <Card className="min-w-0 px-5 pt-5" data-over-time>
      <h2 className={titleCls}>Over time</h2>
      <p className={subCls}>Each brand’s place by visibility score, every sync.</p>
      <div ref={ref} className="relative mt-4 w-full" style={{ height }} onMouseLeave={() => setTip(null)}>
        {w > 0 && weeks.length > 0 && (
          <>
            <svg width={w} height={height} className="absolute inset-0 overflow-visible" aria-hidden>
              {/* a faint guide per place */}
              {keys.map((_, i) => <line key={i} x1={L} x2={w - R} y1={yAt(i + 1)} y2={yAt(i + 1)} stroke="var(--div)" />)}
              {keys.map((k) => {
                const pts = weeks.map((wk, i) => (wk.ranks[k] ? `${xAt(i)},${yAt(wk.ranks[k])}` : null)).filter(Boolean)
                return <polyline key={k} points={pts.join(' ')} fill="none" stroke={colours[byKey[k]?.domain]} strokeWidth={byKey[k]?.you ? 3 : 2} strokeLinejoin="round" strokeLinecap="round" />
              })}
            </svg>
            {/* the places */}
            {keys.map((_, i) => <span key={i} className="absolute -translate-y-1/2 text-[12px] leading-4 text-stone-500 tabular-nums" style={{ left: 0, top: yAt(i + 1) }}>#{i + 1}</span>)}
            {/* the logos, each week */}
            {weeks.map((wk, i) => keys.map((k) => wk.ranks[k] && (
              <span key={`${k}-${i}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: xAt(i), top: yAt(wk.ranks[k]) }} title={`${name(k)} · #${wk.ranks[k]} · ${wk.values[k]}% on ${wk.date}`}>
                <Badge b={byKey[k]} colour={colours[byKey[k].domain]} size={22} big={byKey[k].you} />
              </span>
            )))}
            {/* the names at the latest week */}
            {keys.map((k) => lastWeek.ranks[k] && (
              <span key={k} className={`absolute -translate-y-1/2 truncate text-[13px] leading-[18px] ${byKey[k].you ? 'font-semibold text-stone-900' : 'text-stone-700'}`} style={{ left: w - R + 24, top: yAt(lastWeek.ranks[k]), maxWidth: R - 28 }}>{name(k)}</span>
            ))}
            {/* the dates */}
            {weeks.map((wk, i) => <span key={wk.iso} className="absolute -translate-x-1/2 whitespace-nowrap text-[12px] leading-4 text-stone-500" style={{ left: xAt(i), top: height - 22 }}>{wk.date}</span>)}
            {/* where two lines cross */}
            {crossings.map((c) => {
              const a = weeks[c.week - 1], b = weeks[c.week]
              const cx = (xAt(c.week - 1) + xAt(c.week)) / 2
              const cy = (yAt(a.ranks[c.ahead]) + yAt(b.ranks[c.ahead])) / 2
              const note = `${name(c.ahead)} passed ${name(c.behind)}, ${c.date}`
              return (
                <button key={`${c.ahead}-${c.behind}-${c.week}`} type="button" aria-label={note} data-crossing
                  onMouseEnter={() => setTip({ x: cx, y: cy, note })} onFocus={() => setTip({ x: cx, y: cy, note })} onBlur={() => setTip(null)}
                  className="absolute grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  style={{ left: cx, top: cy }}>
                  <span className="h-2.5 w-2.5 rounded-full bg-surface ring-2 ring-[var(--color-stone-500)]" />
                </button>
              )
            })}
            {tip && <span role="tooltip" className="pointer-events-none absolute z-20 -translate-y-1/2 whitespace-nowrap rounded-md border border-line bg-raised px-2 py-1 text-[12px] leading-4 font-medium text-stone-700 shadow-sm" style={{ left: tip.x + 16, top: tip.y }}>{tip.note}</span>}
          </>
        )}
      </div>
      <p className="flex items-center gap-2 border-t border-[var(--div)] py-3 text-[13px] leading-[18px] text-stone-700" data-overtake>
        <Lightbulb size={16} className="shrink-0 text-stone-500" aria-hidden />
        {latest ? <>Latest change: {name(latest.ahead)} passed {name(latest.behind)} on {latest.date}.</> : 'No brand changed places in this period.'}
      </p>
    </Card>
  )
}

// 5. Where they beat you, one list: chips per competitor (logo and count) filter it; each row the prompt, the
// competitors AI names for it, the engines that name them, and "Open in Content" on hover; most competitors first;
// 8 rows, then "Show all"
function WhereTheyBeatYou({ rows, chips, colours }) {
  const [only, setOnly] = useState(null)
  const [all, setAll] = useState(false)
  const list = only ? rows.filter((r) => r.winners.includes(only)) : rows
  const shown = all ? list : list.slice(0, 8)
  const chip = (on) => `inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] leading-[18px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-surface text-stone-700 hover:bg-tint hover:text-stone-900'}`
  return (
    <Card className="min-w-0 px-5 pt-5" data-beats>
      <h2 className={titleCls}>Where they beat you</h2>
      <p className={subCls}>Prompts whose answers name a competitor and not {account.name}, most competitors first.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by competitor">
        <button type="button" aria-pressed={!only} onClick={() => { setOnly(null); setAll(false) }} className={chip(!only)}>All <span className="tabular-nums opacity-70">{rows.length}</span></button>
        {chips.map((c) => (
          <button key={c.domain} type="button" aria-pressed={only === c.domain} onClick={() => { setOnly(only === c.domain ? null : c.domain); setAll(false) }} className={chip(only === c.domain)} data-chip={c.key}>
            <SiteLogo domain={c.domain} name={c.name} className="h-4 w-4 rounded" initialClass="text-[9px]" />{c.name} <span className="tabular-nums opacity-70">{c.count}</span>
          </button>
        ))}
      </div>
      <ul className="-mx-5 mt-3 divide-y divide-[var(--div)] border-t border-[var(--div)]" data-lost>
        {shown.map((r) => (
          <li key={r.key} className="group flex min-h-12 items-center gap-4 px-5 py-2 transition-colors duration-150 hover:bg-[var(--tint)]" data-lost-row>
            <span className="min-w-0 flex-1 truncate text-[14px] leading-5 text-stone-900" title={r.prompt}>{r.prompt}</span>
            <span className="flex shrink-0 -space-x-1.5" aria-label={`Named: ${r.winners.map((d) => chips.find((c) => c.domain === d)?.name ?? d).join(', ')}`}>
              {r.winners.map((d) => { const c = chips.find((x) => x.domain === d); return <span key={d} className="rounded-full" style={{ boxShadow: '0 0 0 2px var(--color-surface)' }}><Badge b={c} colour={colours[d]} size={20} /></span> })}
            </span>
            <span className="flex w-[88px] shrink-0 items-center justify-end gap-1.5" aria-label={`Engines: ${r.engines.map((e) => engineName(ENGINE_OF[e])).join(', ')}`}>
              {r.engines.map((e) => <PlatformIcon key={e} id={ENGINE_OF[e]} size={14} />)}
            </span>
            <span className="w-[140px] shrink-0 whitespace-nowrap text-right opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100 max-lg:opacity-100"><OpenInContent id={r.id} prompt={r.prompt} /></span>
          </li>
        ))}
      </ul>
      {list.length > 8 && (
        <div className="-mx-5 border-t border-[var(--div)] px-5 py-3">
          <button type="button" onClick={() => setAll((a) => !a)} className={linkCls} data-show-all>{all ? 'Show fewer' : `Show all ${list.length}`}</button>
        </div>
      )}
    </Card>
  )
}

// 6. Who gets cited, a quadrant chart: mentions across, citations up (square-root scales, so the small brands spread
// out), each brand a logo dot sized by the prompts that name it; quadrants labelled lightly. A logo opens its most
// cited pages (?cited=<key>).
function WhoGetsCited({ list, colours }) {
  const pts = list.filter((b) => b.mentions != null)
  // headroom, so the largest dot and its name stay clear of the edges and the corner labels
  const mx = Math.max(1, ...pts.map((b) => b.mentions)) * 1.5, my = Math.max(1, ...pts.map((b) => b.citations)) * 1.5
  const sx = (v) => Math.sqrt(v / mx) * 100, sy = (v) => Math.sqrt(v / my) * 100
  const pmax = Math.max(1, ...pts.map((b) => b.prompts ?? 0))
  // the value at the middle of each axis (where the quadrants split)
  const midX = Math.round(mx / 4), midY = Math.round(my / 4)
  const corner = 'absolute text-[12px] leading-4 text-stone-400'
  return (
    <Card className="min-w-0 px-5 py-5" data-cited>
      <h2 className={titleCls}>Who gets cited</h2>
      <p className={subCls}>Mentions across, citations up (square-root scales). Each brand is sized by the prompts that name it. Click one for its most cited pages.</p>
      <div className="mt-4 flex gap-3">
        <span className="flex w-4 shrink-0 items-center justify-center"><span className="-rotate-90 whitespace-nowrap text-[12px] leading-4 text-stone-500">Citations</span></span>
        <div className="min-w-0 flex-1">
          <div className="relative h-[340px] rounded-xl border border-line" data-quadrant>
            {/* the quadrants */}
            <span className="absolute inset-y-0 left-1/2 border-l border-dashed border-[var(--color-line-strong)]" />
            <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--color-line-strong)]" />
            <span className={`${corner} left-3 top-2.5`}>Cited, not named</span>
            <span className={`${corner} right-3 top-2.5`}>Named and cited</span>
            <span className={`${corner} bottom-2.5 left-3`}>Rarely seen</span>
            <span className={`${corner} bottom-2.5 right-3`}>Named, not cited</span>
            {pts.map((b) => {
              const d = Math.round(26 + 22 * Math.sqrt((b.prompts ?? 0) / pmax))
              return (
                <button key={b.domain} type="button" onClick={() => openDrawer('cited', b.key)} data-dot={b.key}
                  aria-label={`${b.name}: ${b.mentions} mentions, ${b.citations} citations, named in ${plural(b.prompts ?? 0, 'prompt')}. Open its most cited pages`}
                  className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  style={{ left: `${sx(b.mentions)}%`, top: `${100 - sy(b.citations)}%` }}>
                  <span className="transition-transform duration-150 group-hover:scale-110 motion-reduce:transition-none"><Badge b={b} colour={colours[b.domain]} size={d - 10} big={b.you} /></span>
                  <span className={`absolute top-full mt-1 whitespace-nowrap text-[12px] leading-4 ${b.you ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>{b.name}</span>
                </button>
              )
            })}
          </div>
          <div className="relative mt-1.5 h-4 text-[11px] leading-4 text-stone-500 tabular-nums">
            <span className="absolute left-0">0</span>
            <span className="absolute left-1/2 -translate-x-1/2">{midX}</span>
            <span className="absolute right-0">{Math.round(mx)}</span>
          </div>
          <p className="mt-1 text-center text-[12px] leading-4 text-stone-500">Mentions</p>
        </div>
        <div className="relative h-[340px] w-8 shrink-0 text-[11px] leading-4 text-stone-500 tabular-nums">
          <span className="absolute top-0">{Math.round(my)}</span>
          <span className="absolute top-1/2 -translate-y-1/2">{midY}</span>
          <span className="absolute bottom-0">0</span>
        </div>
      </div>
    </Card>
  )
}

// a brand's most cited pages (?cited=<key>), from Who gets cited
function CitedDrawer({ engine, p }) {
  const drawer = useDrawer('cited', (k) => (p.none ? null : TRACKED_BRANDS.find((b) => b.key === k) ?? null))
  const b = drawer.item
  if (!b) return null
  const row = citedBrands(engine, p).find((x) => x.domain === b.domain)
  return (
    <DrawerShell drawer={drawer} title={`${b.name}: most cited pages`}
      meta={<>{logo(b, 'h-5 w-5')}<span className="tabular-nums">{plural(row?.citations ?? 0, 'citation')}</span><Dot /><span className="tabular-nums">{plural(row?.mentions ?? 0, 'mention')}</span><Dot /><span>{engine === 'all' ? 'All engines' : engineFullName(engine)}</span></>}>
      <SectionTitle>Pages AI cites <span className="font-normal text-stone-500 tabular-nums">· {row?.pages.length ?? 0}</span></SectionTitle>
      {row?.pages.length ? (
        <ul className="mt-2 divide-y divide-[var(--div)] border-y border-[var(--div)]" data-cited-pages>
          {row.pages.map((pg) => (
            <li key={pg.path}>
              <a href={`https://${b.domain}${pg.path}`} target="_blank" rel="noopener noreferrer" className="group flex min-h-11 items-center justify-between gap-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-focus">
                <span className="min-w-0 truncate text-[14px] leading-5 text-stone-900 group-hover:underline underline-offset-2">{pg.path}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-[13px] leading-[18px] text-stone-600 tabular-nums">{plural(pg.count, 'prompt')}<ArrowUpRight size={14} className="text-stone-400" aria-hidden /></span>
              </a>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-[14px] leading-5 text-stone-600">No page of {b.domain} is cited.</p>}
    </DrawerShell>
  )
}

// the empty state: no competitors yet
function NoCompetitors() {
  const add = () => { navigate('/brands'); setTimeout(() => document.querySelector('[data-tour="setup-competitors"]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60) }
  return (
    <Card className="grid place-items-center px-6 py-16 text-center" data-bench-empty>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-tint text-stone-600"><Users size={22} aria-hidden /></span>
      <h2 className="mt-4 text-title font-semibold text-stone-900">No competitors to compare with yet</h2>
      <p className="mt-1.5 max-w-[440px] text-[14px] leading-5 text-stone-600">Add the brands you compete with in Brand Setup. Benchmarking compares {account.name} with them from the next sync.</p>
      <div className="mt-5"><PrimaryButton size="sm" type="button" onClick={add}>Add competitors in Brand Setup</PrimaryButton></div>
    </Card>
  )
}

// ---------------------------------------------------------------- You vs them (?vs=<key>)
function VersusDrawer({ engine, p }) {
  const tracking = useTracking()
  const drawer = useDrawer('vs', (k) => (p.none ? null : TRACKED_BRANDS.find((b) => b.key === k && !b.you) ?? null))
  const them = drawer.item
  if (!them) return null
  const v = versus(them.domain, engine, p)
  const rows = [
    ['Visibility', v.you.visibility, v.them?.visibility, '%'],
    ['Share of voice', v.you.share, v.them?.share, '%'],
    ['Mentions', v.you.mentions, v.them?.mentions, ''],
    ['Citations', v.you.citations, v.them?.citations, ''],
    ...(p.oneSync ? [] : [['Change since last sync', v.you.change, v.them?.change, ' pts']]),
  ]
  const fmt = (x, unit) => (x == null ? '—' : unit === ' pts' ? signed(x) : unit === '%' ? `${x}%` : num(x))
  const diff = (a, b, unit) => (a == null || b == null ? '—' : a === b ? 'Even' : `${signed(a - b)}${unit === '%' || unit === ' pts' ? ' pts' : ''}`)
  const overview = `/overview?view=${them.key}`
  return (
    <DrawerShell drawer={drawer} title={`${OWN.name} vs ${them.name}`}
      meta={<>{logo(OWN, 'h-5 w-5')}<span>{OWN.name}</span><Dot />{logo(them, 'h-5 w-5')}<span>{them.name}</span><Dot /><span>{engine === 'all' ? 'All engines' : engineFullName(engine)}</span></>}
      footer={<><span className="tabular-nums">Latest sync · {fmtDay(tracking.schedule.lastSync)}</span><a href={overview} onClick={linkClick(overview)} className={linkCls}>Open {them.name}’s view of the Overview<ArrowRight size={13} aria-hidden /></a></>}>
      <SectionTitle>Each measure</SectionTitle>
      <table className="mt-2 w-full table-fixed text-[14px] leading-5" data-versus>
        <thead>
          <tr className="h-9 border-b border-line text-[12px] leading-4 text-stone-600">
            <th scope="col" className="text-left font-medium">Measure</th>
            <th scope="col" className="w-[84px] text-right font-medium">You</th>
            <th scope="col" className="w-[104px] truncate text-right font-medium">{them.name}</th>
            <th scope="col" className="w-[96px] text-right font-medium">Difference</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--div)]">
          {rows.map(([label, a, b, unit]) => {
            const d = a == null || b == null ? null : a - b
            return (
              <tr key={label} className="h-11">
                <th scope="row" className="text-left font-normal text-stone-700">{label}</th>
                <td className="text-right font-semibold tabular-nums text-stone-900">{fmt(a, unit)}</td>
                <td className="text-right tabular-nums text-stone-900">{fmt(b, unit)}</td>
                <td className={`text-right tabular-nums ${d != null && d < 0 ? 'text-negative' : 'text-stone-600'}`}>{diff(a, b, unit)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <SectionTitle>Prompts {them.name} wins and you don’t <span className="font-normal text-stone-500 tabular-nums">· {v.prompts.length}</span></SectionTitle>
      {v.prompts.length ? (
        <ul className="mt-2 divide-y divide-[var(--div)] border-y border-[var(--div)]" data-versus-prompts>
          {v.prompts.map((x) => (
            <li key={x.key} className="flex min-h-12 items-center justify-between gap-3 py-2">
              <span className="min-w-0 text-[14px] leading-5 text-stone-900">{x.prompt}<span className="ml-1.5 text-[12px] text-stone-500 tabular-nums">{plural(x.engines, 'engine')}</span></span>
              <OpenInContent id={x.id} prompt={x.prompt} />
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-[14px] leading-5 text-stone-600">None. {OWN.name} is named wherever {them.name} is.</p>}
    </DrawerShell>
  )
}

// ---------------------------------------------------------------- the page
function Benchmarking() {
  useEffect(() => { document.title = 'Benchmarking · Auden AI' }, [])
  const p = useMemo(() => previews(), [])
  const { engine, setEngine } = useDashboardView()
  const allRivals = useMemo(() => (p.none ? [] : TRACKED_BRANDS.filter((b) => !b.you).map((b) => b.key)), [p])
  const [rivals, setRivalsState] = useState(() => readRivals(allRivals))
  const setRivals = (keys) => { setRivalsState(keys); writeParam('rivals', keys.length === allRivals.length ? null : keys.join(',')) }
  const [range, setRangeState] = useState(() => { const r = new URLSearchParams(window.location.search).get('range'); return historyRanges.weekly.some((x) => x.id === r) ? r : defaultRange.weekly })
  const setRange = (r) => { setRangeState(r); writeParam('range', r === defaultRange.weekly ? null : r) }
  const [sort, setSort] = useState({ key: 'rank', dir: 'asc' })
  const status = engineStatus(engine, p)
  const keep = (b) => b.you || rivals.includes(b.key)
  const all = leaderboard(engine, p)
  // one colour per brand across the page, by place on all engines (stable when the engine or the Brands filter changes)
  const colours = useMemo(() => brandColours(leaderboard('all', p)), [p])
  const download = () => {
    const blob = new Blob([benchCsv(engine, p, engineName)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `benchmarking-${account.domain}${engine === 'all' ? '' : `-${engine}`}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  return (
    <>
      <Header empty={p.none} engine={engine} setEngine={setEngine} range={range} setRange={setRange} rivals={rivals} setRivals={setRivals} allRivals={allRivals} onDownload={download} p={p} />
      {p.none ? <NoCompetitors /> : (
        <>
          <WhereYouRank line={rankLine(all)} rows={all.filter(keep)} colours={colours} engine={engine} status={status} />
          <Leaderboard rows={all.filter(keep)} colours={colours} engine={engine} status={status} oneSync={p.oneSync} sort={sort} setSort={setSort} />
          <ByEngine grid={engineGrid(p)} brands={all.filter(keep)} />
          <OverTime oneSync={p.oneSync} range={range} brands={all.filter(keep)} colours={colours} />
          <WhereTheyBeatYou rows={lostPrompts(engine, p, rivals)} chips={beats(engine, p).filter((c) => rivals.includes(c.key)).map((c) => ({ ...c, count: c.prompts.length }))} colours={colours} />
          <WhoGetsCited list={citedBrands(engine, p).filter(keep).map((b) => ({ ...b, prompts: all.find((r) => r.domain === b.domain)?.prompts ?? null }))} colours={colours} />
        </>
      )}
      <VersusDrawer engine={engine} p={p} />
      <CitedDrawer engine={engine} p={p} />
    </>
  )
}

export default function BenchmarkingPage() {
  return <DashboardViewProvider><Benchmarking /></DashboardViewProvider>
}
