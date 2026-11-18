// Benchmarking (mock only, owner 2026-11-18): how the brand compares with its competitors in AI answers. Sample data
// and rules: data/benchmarking.js. The Overview's design system and parts: its header selects, cards, the Visibility
// history chart (every brand drawn: the brand in ink, the top three competitors indigo, red and green, the rest grey),
// the detail drawer shell, logos and engine icons. No new chart styles; no sentiment (competitor sentiment isn't
// collected).
//
// Top to bottom: Where you rank (one line), Leaderboard (sortable; a competitor opens You vs them), By engine (brands ×
// engines, the best on each marked, an engine with no result "—"), Over time, Where they beat you, Who gets cited.
// Header: Engine (?engine=, shared with the Overview), Range (Over time's period), Brands (?rivals=, the competitors
// shown) and Download (CSV). States: ?competitors=none, ?history=single, ?never=<engine>, ?noresult=<engine>.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronDown, ChevronRight, Download, Users } from 'lucide-react'
import Card from '../../components/dashboard/Card'
import { MOBILE_TRIGGER, MenuSelect } from '../../components/dashboard/PageHeader'
import { PrimaryButton } from '../../components/dashboard/overlays'
import { PlatformIcon } from '../../components/dashboard/icons'
import VisibilityHistory from '../../components/dashboard/VisibilityHistory'
import DrawerShell, { Dot, SectionTitle, useDrawer } from '../../components/audit/DrawerShell'
import { openDrawer } from '../../components/audit/parts'
import SiteLogo from '../../components/ui/SiteLogo'
import { NoResultLine } from '../../components/ui/NoResult'
import { DashboardViewProvider, useDashboardView } from '../../hooks/useBrandView'
import { ENGINES, OWN, TRACKED_BRANDS, engineFullName, engineName } from '../../data/brandViews'
import { account, defaultRange, historyRanges } from '../../data/mock'
import { beats, benchCsv, citedBrands, engineGrid, engineStatus, leaderboard, previews, rankLine, sortRows, versus } from '../../data/benchmarking'
import { MEDALS } from '../../utils/shareOfVoice'
import { linkClick, navigate } from '../../router'
import { fmtDay, useTracking } from '../../store/trackingSettings'

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const pct = (v) => (v == null ? '—' : `${v}%`)
const num = (v) => (v == null ? '—' : v.toLocaleString('en-US'))
const signed = (v) => (v == null ? '—' : v === 0 ? '0' : v > 0 ? `+${v}` : `−${Math.abs(v)}`)
const GOLD = MEDALS[1].fill
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

// 1. Where you rank: one line, then the two logos on a 0–100% track, the gap between them in ink
function WhereYouRank({ line, engine, status }) {
  if (status !== 'ran' || !line) {
    return (
      <Card className="px-5 py-4" data-rank-line>
        {status === 'missed' ? <NoResultLine engine={engine} /> : <p className="text-[14px] leading-5 text-stone-600">{engineFullName(engine)} has never run, so there is nothing to rank yet.</p>}
      </Card>
    )
  }
  const { you, other } = line
  const lo = Math.min(you.visibility, other.visibility), hi = Math.max(you.visibility, other.visibility)
  // the track zooms to the pair so a small gap still has room (at least 20 points wide; a wide gap is the full 0–100%)
  const span = Math.min(100, Math.max(20, (hi - lo) * 2.5))
  const from = Math.min(100 - span, Math.max(0, (lo + hi) / 2 - span / 2))
  const at = (v) => `${((v - from) / span) * 100}%`
  const Pin = ({ r }) => (
    <span className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: at(r.visibility) }}>
      <span className={`grid h-7 w-7 place-items-center rounded-full bg-surface ring-2 ${r.you ? 'ring-ink' : 'ring-line'}`}>{logo(r, 'h-5 w-5')}</span>
      {/* the other brand's label above the track, yours below, so two close brands never collide */}
      <span className={`absolute whitespace-nowrap text-[12px] leading-4 tabular-nums ${r.you ? 'top-full mt-1 font-medium text-stone-900' : 'bottom-full mb-1 text-stone-600'}`}>{r.you ? 'You' : r.name} · {r.visibility}%</span>
    </span>
  )
  return (
    <Card className="flex flex-col gap-x-8 gap-y-5 px-5 py-4 lg:flex-row lg:items-center" data-rank-line>
      <p className="min-w-0 flex-1 text-[17px] leading-6 font-semibold text-stone-900">{line.text}</p>
      <div className="relative mx-6 my-5 h-8 lg:w-[360px] lg:shrink-0" aria-hidden>
        <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[var(--data-track)]" />
        <span className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-ink" style={{ left: at(lo), width: `${((hi - lo) / span) * 100}%` }} />
        <Pin r={other} />
        <Pin r={you} />
      </div>
    </Card>
  )
}

// 2. Leaderboard: sortable; a competitor's row opens You vs them
const COLS = [
  { key: 'rank', label: '#', align: 'left', w: 'w-14' },
  { key: 'name', label: 'Brand', align: 'left', w: '' },
  { key: 'visibility', label: 'Visibility', w: 'w-[112px]' },
  { key: 'share', label: 'Share of voice', w: 'w-[136px]' },
  { key: 'mentions', label: 'Mentions', w: 'w-[112px]' },
  { key: 'citations', label: 'Citations', w: 'w-[112px]' },
  { key: 'change', label: 'Change', w: 'w-[112px]', hint: 'Visibility points since the last sync' },
]
function Leaderboard({ rows, engine, status, oneSync, sort, setSort }) {
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
    if (c.key === 'visibility' || c.key === 'share') return pct(r[c.key])
    if (c.key === 'change') return r.change == null ? '—' : <span className={r.change < 0 ? 'text-negative' : r.change > 0 ? 'text-stone-900' : 'text-stone-500'}>{r.change === 0 ? 'No change' : signed(r.change)}</span>
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
                    <button type="button" onClick={() => by(c.key)} title={c.hint} className={`inline-flex items-center gap-1 rounded outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus ${active ? 'text-stone-900' : ''}`}>
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
                className={`group h-14 ${r.you ? 'bg-[var(--tint)]' : 'cursor-pointer transition-colors duration-150 hover:bg-[var(--tint)]'}`}>
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

// 3. By engine: brands × engines; the best brand on each engine marked; no result "—" with why on hover
function ByEngine({ grid, brands }) {
  return (
    <Card className="min-w-0 px-5 pb-2 pt-5" data-by-engine>
      <h2 className={titleCls}>By engine</h2>
      <p className={`${subCls} flex flex-wrap items-center gap-x-1.5`}>Visibility on each engine, latest sync.<span className="inline-flex items-center gap-1"><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: GOLD }} />Best on that engine</span></p>
      <div className="-mx-5 mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed text-[14px] leading-5">
          <thead>
            <tr className="h-10 border-y border-line bg-tint text-[12px] leading-4 text-stone-600">
              <th scope="col" className="w-[220px] pl-5 pr-3 text-left font-medium">Brand</th>
              {grid.map((g, i) => (
                <th key={g.engine} scope="col" className={`px-3 text-right font-medium ${i === grid.length - 1 ? 'pr-5' : ''}`} data-engine={g.engine}>
                  <span className="inline-flex items-center justify-end gap-1.5"><PlatformIcon id={g.engine} size={14} />{engineName(g.engine)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--div)]">
            {brands.map((b) => (
              <tr key={b.domain} className={`h-12 ${b.you ? 'bg-[var(--tint)]' : ''}`}>
                <th scope="row" className="pl-5 pr-3 text-left font-normal">
                  <span className="flex min-w-0 items-center gap-2.5">{logo(b, 'h-5 w-5')}<span className={`min-w-0 truncate text-stone-900 ${b.you ? 'font-semibold' : 'font-medium'}`}>{b.name}</span></span>
                </th>
                {grid.map((g, i) => {
                  const v = g.values[b.domain]
                  const best = g.best.includes(b.domain)
                  return (
                    <td key={g.engine} className={`px-3 text-right tabular-nums text-stone-900 ${i === grid.length - 1 ? 'pr-5' : ''}`} data-cell={`${b.key}|${g.engine}`} data-best={best || undefined}>
                      {g.status === 'missed' ? <Dash text="Didn’t run" /> : g.status === 'never' ? <Dash text="Never ran" />
                        : (
                          <span className="inline-flex items-center gap-1.5">
                            {best && <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: GOLD }} />}
                            <span className={best ? 'font-semibold' : ''}>{v}%</span>
                            {best && <span className="sr-only">, best on {engineName(g.engine)}</span>}
                          </span>
                        )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// 4. Over time: the Visibility history chart, every brand shown; none with one sync
function OverTime({ oneSync, range, rivals }) {
  const tracking = useTracking()
  if (oneSync) {
    return (
      <Card className="px-5 py-5" data-over-time>
        <h2 className={titleCls}>Over time</h2>
        <p className="mt-3 text-[14px] leading-5 text-stone-600">History starts after the second sync. There is one so far ({fmtDay(tracking.schedule.lastSync)}).</p>
      </Card>
    )
  }
  return (
    <div data-over-time className="min-w-0">
      <VisibilityHistory key={`${range}|${rivals.join(',')}`} syncUrl={false} initial={{ range }} rivals={rivals} title="Over time" subtitle="Each brand’s share of prompts, every sync" plotClass="h-[260px] min-h-0" />
    </div>
  )
}

// 5. Where they beat you: per competitor, the prompts it wins that you miss
function WhereTheyBeatYou({ list }) {
  return (
    <Card className="min-w-0 px-5 py-5" data-beats>
      <h2 className={titleCls}>Where they beat you</h2>
      <p className={subCls}>Prompts whose answers name a competitor and not {account.name}.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <section key={c.domain} aria-label={c.name} data-beat={c.key} className="flex min-w-0 flex-col rounded-xl border border-line p-4">
            <div className="flex items-start gap-2.5">
              {logo(c)}
              <p className="min-w-0 text-[14px] leading-5 text-stone-900">
                {c.prompts.length ? <><span className="font-semibold">{c.name}</span> appears on <span className="font-semibold tabular-nums">{plural(c.prompts.length, 'prompt')}</span> you miss</> : <><span className="font-semibold">{c.name}</span> isn’t named on any prompt you miss</>}
              </p>
            </div>
            {c.prompts.length > 0 && (
              <ul className="mt-3 divide-y divide-[var(--div)] border-t border-[var(--div)]">
                {c.prompts.slice(0, 3).map((x) => (
                  <li key={x.key} className="flex min-h-11 items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-[13px] leading-[18px] text-stone-700" title={x.prompt}>{x.prompt}</span>
                    <OpenInContent id={x.id} prompt={x.prompt} />
                  </li>
                ))}
              </ul>
            )}
            {c.prompts.length > 3 && (
              <button type="button" onClick={() => openDrawer('vs', c.key)} className={`${linkCls} mt-auto self-start pt-2`} data-see-all>See all {c.prompts.length}<ArrowRight size={13} aria-hidden /></button>
            )}
          </section>
        ))}
      </div>
    </Card>
  )
}

// 6. Who gets cited: citations per brand, its most cited pages; marked when cited more often than named
function WhoGetsCited({ list }) {
  const top = Math.max(1, ...list.map((b) => b.citations ?? 0))
  return (
    <Card className="min-w-0 px-5 py-5" data-cited>
      <h2 className={titleCls}>Who gets cited</h2>
      <p className={subCls}>AI answers that cite each brand’s site, and the pages they cite most.</p>
      <ul className="mt-4 divide-y divide-[var(--div)] border-t border-[var(--div)]">
        {list.map((b) => (
          <li key={b.domain} data-cited-brand={b.key} className="grid grid-cols-1 gap-x-6 gap-y-3 py-4 lg:grid-cols-[minmax(0,240px)_220px_minmax(0,1fr)]">
            <div className="flex min-w-0 items-center gap-2.5">
              {logo(b)}
              <span className={`min-w-0 truncate text-[14px] leading-5 text-stone-900 ${b.you ? 'font-semibold' : 'font-medium'}`}>{b.name}</span>
            </div>
            <div className="min-w-0">
              <div className="text-[14px] leading-5 text-stone-900 tabular-nums"><span className="font-semibold">{num(b.citations)}</span> {b.citations === 1 ? 'citation' : 'citations'} <Dot /> <span className="text-stone-600">{num(b.mentions)} {b.mentions === 1 ? 'mention' : 'mentions'}</span></div>
              {/* its citations against the most cited brand's: the Overview's data track */}
              <span aria-hidden className="mt-2 block h-1 w-full rounded-full bg-[var(--data-track)]"><span className="block h-1 rounded-full bg-ink" style={{ width: `${((b.citations ?? 0) / top) * 100}%` }} /></span>
              {b.citedMore && <span className="mt-2 inline-flex items-center rounded-full bg-tint px-2 py-0.5 text-[12px] leading-4 font-medium text-stone-700 ring-1 ring-line" data-cited-more>Cited more often than named</span>}
            </div>
            <ol className="min-w-0 text-[13px] leading-[18px]">
              {b.pages.length ? b.pages.slice(0, 3).map((pg) => (
                <li key={pg.path} className="flex min-w-0 items-center justify-between gap-3 py-0.5">
                  <span className="min-w-0 truncate text-stone-700" title={`${b.domain}${pg.path}`}>{pg.path}</span>
                  <span className="shrink-0 text-stone-500 tabular-nums">{plural(pg.count, 'prompt')}</span>
                </li>
              )) : <li className="text-stone-500">No page cited</li>}
            </ol>
          </li>
        ))}
      </ul>
    </Card>
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
          <WhereYouRank line={rankLine(all)} engine={engine} status={status} />
          <Leaderboard rows={all.filter(keep)} engine={engine} status={status} oneSync={p.oneSync} sort={sort} setSort={setSort} />
          <ByEngine grid={engineGrid(p)} brands={all.filter(keep)} />
          <OverTime oneSync={p.oneSync} range={range} rivals={rivals} />
          <WhereTheyBeatYou list={beats(engine, p).filter((c) => rivals.includes(c.key))} />
          <WhoGetsCited list={citedBrands(engine, p).filter(keep)} />
        </>
      )}
      <VersusDrawer engine={engine} p={p} />
    </>
  )
}

export default function BenchmarkingPage() {
  return <DashboardViewProvider><Benchmarking /></DashboardViewProvider>
}
