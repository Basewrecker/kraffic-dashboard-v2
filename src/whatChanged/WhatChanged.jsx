import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Activity, ArrowRight, ChevronDown, X } from 'lucide-react'
import SheetHandle, { SHEET_BASE } from '../components/ui/SheetHandle'
import { useDrawer } from '../components/audit/DrawerShell'
import { openDrawer, setParams, useParams } from '../components/audit/parts'
import Segmented from '../components/dashboard/Segmented'
import { Favicon } from '../components/dashboard/overlays'
import { PlatformIcon } from '../components/dashboard/icons'
import { openAnswer } from '../components/answer/AnswerDrawer'
import { navigate } from '../router'
import { PERIOD_OPTIONS, PERIODS } from './util'
import HeaderBell from '../notifications/NotificationsBell'

// "What changed", one component for every page: a button in the page header and a pull-out from the right
// (?changes=scan|30d|90d), the drawers' sheet (scrim, focus trap, Esc, focus back to the button, a bottom sheet on
// phones) at 440px with 28px padding. What it shows comes from the page's config (overview.js, sentiment.js, …):
//   config = { page, title, build(period) } → { headline, glance, hero, breakdown, lists, next, footer, trigger, … }
// Sections: header + period switch, headline, at a glance, the one chart, a breakdown (by engine / channel), list rows
// (What moved, Prompts won / lost, …), Worth doing next, footer. A section with no rows isn't drawn.
const KEY = 'changes'
const seenKey = (page) => `auden:what-changed-seen:${page}`
const read = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k, v) => { try { localStorage.setItem(k, v) } catch { /* private window: no memory */ } }
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const toneCls = (good) => (good === true ? 'text-[var(--rep-up-fg)]' : good === false ? 'text-negative' : 'text-stone-500')

// segments: a string reads regular, { b } semibold ink
function Text({ parts }) {
  return parts.map((s, i) => (typeof s === 'string' ? <span key={i}>{s}</span> : <span key={i} className="font-semibold text-stone-900">{s.b}</span>))
}

// ---------------------------------------------------------------- the header button
// At the right end of the page header, outlined like the header's dropdowns (hairline border, white fill, their radius
// and height: size 'sm' h-8, 'md' h-9), hugging its text with 14px each side. "What changed" in medium ink, then the
// change, semibold, in --wc-rest-up / -down. New since the last visit: a 6px ink dot before the text.
// Hover / focus: Missed opportunities' Reach out ink fill (index.css .k-reach, .k-reach-fill, .k-reach-label: the same
// wipe from the left, timing and easing; dark mode inverts as it does there); the change swaps to --wc-fill-up / -down;
// a → grows in at the end (width and opacity, 200ms), so at rest there's no empty space. Press .97 (.k-reach). While
// the panel is open the fill stays (.wc-open).
export function WhatChangedButton({ config, size = 'sm', className = '', bell = true }) {
  const data = useMemo(() => config.build('scan'), [config])
  const q = useParams()
  const isOpen = PERIODS.includes(q.get(KEY))
  const [seen, setSeen] = useState(() => read(seenKey(config.page)))
  useEffect(() => {
    const on = () => setSeen(read(seenKey(config.page)))
    window.addEventListener('what-changed-seen', on)
    return () => window.removeEventListener('what-changed-seen', on)
  }, [config.page])
  const d = data.trigger?.delta ?? null
  const fresh = d != null && seen !== data.latestIso
  const shape = size === 'md' ? 'h-9 rounded-lg' : 'h-8 rounded-md'
  const label = `Summary${d ? `: ${d.up ? 'up' : 'down'} ${d.text}` : data.trigger?.flatText ? `: ${data.trigger.flatText.toLowerCase()}` : ''}${fresh ? ' (new)' : ''}`
  // on the ink fill the change reads in the light green / red (--wc-fill-*); no change: nothing after the word
  const tone = d?.good === true ? 'text-[var(--wc-fill-up)]' : d?.good === false ? 'text-[var(--wc-fill-down)]' : 'text-[color-mix(in_srgb,var(--on-ink)_70%,transparent)]'
  // as the app (#203 / #216 / #223): renamed Summary and ink-filled on every page (light text, the change in light
  // green / red, a light dot when new). Hover lifts the fill one shade; press .97. Every page header ends the same
  // way: page controls · Summary · 12px · a 20px hairline · 12px · the bell (HeaderBell; `bell={false}` leaves it out).
  return (
    <span className={`inline-flex shrink-0 items-center gap-3 ${className}`}>
      <button type="button" onClick={() => openDrawer(KEY, 'scan')} data-what-changed data-open={isOpen || undefined} aria-label={label} aria-expanded={isOpen}
        className={`inline-flex ${shape} shrink-0 items-center whitespace-nowrap bg-ink px-3.5 text-[13px] leading-[18px] text-on-ink outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-ink-hover active:scale-[.97] focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 motion-reduce:transform-none max-lg:h-10`}>
        {fresh && <span aria-hidden data-new-dot className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-on-ink" />}
        <span className="font-semibold">Summary</span>
        {d && <span aria-hidden className={`ml-2 font-semibold tabular-nums ${tone}`}>{d.up ? '↑' : '↓'} {d.text}</span>}
      </button>
      {bell && <HeaderBell />}
    </span>
  )
}

// ---------------------------------------------------------------- the pull-out
export function WhatChangedPanel({ config }) {
  const drawer = useDrawer(KEY, (id) => (PERIODS.includes(id) ? id : null), { exitMs: 280 })
  const { item: period, close } = drawer
  const data = useMemo(() => (period ? config.build(period) : null), [period, config])
  const [collapsed, setCollapsed] = useState({})
  const [expanded, setExpanded] = useState({}) // lists showing every row ("Show all n")
  useEffect(() => { if (!drawer.open) setExpanded({}) }, [drawer.open])
  useEffect(() => {
    if (!drawer.open || !data?.latestIso) return
    write(seenKey(config.page), data.latestIso)
    window.dispatchEvent(new Event('what-changed-seen'))
  }, [drawer.open, data?.latestIso, config.page])
  if (!period || !data) return null

  // a row: close, then go where it points (a card on this page, a drawer, the answer, another page)
  const after = (fn) => { close(); setTimeout(fn, reduced() ? 0 : 300) }
  const go = (row) => {
    if (row.target) after(() => outline(row.target))
    else if (row.open?.answer) after(() => openAnswer({ key: row.open.answer, list: row.open.list }))
    else if (row.open?.drawer) after(() => openDrawer(...row.open.drawer))
    else if (row.href) after(() => navigate(row.href))
  }
  const clickable = (row) => Boolean(row.target || row.open || row.href)

  const section = 'border-t border-line pt-7'
  let order = 0 // the rows' fade-in stagger
  const lists = (data.lists ?? []).filter((l) => l.rows.length)
  const next = data.next ?? []
  const toggle = (id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }))
  return (
    <PullOut drawer={drawer} labelledBy="wc-title">
          <div className="flex flex-col gap-7">
            {/* a. header + period */}
            <header>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12.5px] leading-[18px] text-stone-500">{config.title}</p>
                  <h2 id="wc-title" className="mt-0.5 text-[20px] leading-7 font-semibold tracking-[-0.01em] text-stone-900">Summary</h2>
                </div>
                <button type="button" onClick={close} aria-label="Close"
                  className="-mr-1.5 -mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus md:h-8 md:w-8">
                  <X size={16} aria-hidden />
                </button>
              </div>
              <Segmented size="sm" label="Compare with" value={period} onChange={(p) => setParams({ [KEY]: p })} options={PERIOD_OPTIONS} className="mt-4" />
            </header>

            {data.state === 'one' ? (
              <p className={`${section} text-[15px] leading-6 text-stone-600`}>{data.oneText ?? 'Only one scan so far. Changes show after the next scan.'}</p>
            ) : (
              <>
                {/* b. headline */}
                <p className={`${section} text-[18px] leading-[27px] text-stone-600 [text-wrap:pretty]`}><Text parts={data.headline} /></p>

                {/* c. at a glance */}
                {data.glance?.length > 0 && (
                  <dl className="-mt-1 grid divide-x divide-line" style={{ gridTemplateColumns: `repeat(${data.glance.length}, minmax(0, 1fr))` }}>
                    {data.glance.map((g, i) => (
                      <div key={g.label} className={`flex min-w-0 flex-col ${i ? 'pl-3.5' : ''} ${i < data.glance.length - 1 ? 'pr-3.5' : ''}`}>
                        <dd className="text-[24px] leading-8 font-semibold tracking-[-0.01em] text-stone-900 tabular-nums">{g.value}</dd>
                        <dd className={`text-[13px] leading-[18px] font-medium tabular-nums ${g.delta ? toneCls(g.delta.good) : 'text-stone-400'}`}>{g.delta ? g.delta.text : '—'}</dd>
                        <dt className="mt-1 truncate text-[12.5px] leading-[18px] font-semibold text-stone-600">{g.label}</dt>
                      </div>
                    ))}
                  </dl>
                )}

                {/* d. the one chart */}
                {data.hero?.points.length > 1 && <HeroChart key={period} hero={data.hero} />}

                {/* e. breakdown: by engine / by channel */}
                {data.breakdown?.rows.length > 0 && (
                  <section className={section} aria-labelledby="wc-breakdown">
                    <h3 id="wc-breakdown" className="text-[14px] leading-5 font-semibold text-stone-900">{data.breakdown.title}</h3>
                    <ul className="mt-2 divide-y divide-[var(--div)]">
                      {data.breakdown.rows.map((r) => (
                        <li key={r.id} className={`${order < 8 ? 'wc-row ' : ''}flex min-h-12 items-center gap-3 py-2.5`} style={{ '--i': order++ }}>
                          <Mark mark={r.mark} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] leading-5 font-semibold text-stone-900">{r.name}</p>
                            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-tint" aria-hidden>
                              <div className="wc-bar h-full rounded-full bg-ink" style={{ width: `${Math.max(0, Math.min(1, r.share)) * 100}%` }} />
                            </div>
                          </div>
                          <span className="w-9 shrink-0 text-right text-[15px] leading-5 font-semibold text-stone-900 tabular-nums">{r.valueText}</span>
                          <span className={`w-[76px] shrink-0 text-right text-[13px] leading-[18px] font-medium tabular-nums ${r.delta ? toneCls(r.delta.good) : 'text-stone-400'}`}>{r.delta?.text ?? '—'}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* f. list rows: What moved, Prompts won / lost, … (collapsible) */}
                {lists.map((l) => {
                  // a long list (Prompts won / lost) shows its first `limit` rows, then "Show all n"
                  const more = l.limit != null && l.rows.length > l.limit
                  const rows = more && !expanded[l.id] ? l.rows.slice(0, l.limit) : l.rows
                  return (
                    <section key={l.id} className={section}>
                      <SectionToggle id={l.id} title={l.title} count={l.count} open={!collapsed[l.id]} onToggle={() => toggle(l.id)} />
                      {!collapsed[l.id] && (
                        <div id={`wc-list-${l.id}`}>
                          <ul className="mt-2 divide-y divide-[var(--div)]">
                            {rows.map((r) => <Row key={r.id} row={r} i={order++} onPick={clickable(r) ? () => go(r) : null} />)}
                          </ul>
                          {(more || l.hub) && (
                            <div className="mt-2 flex min-h-8 items-center justify-between gap-3 text-[13px] leading-[18px] font-medium">
                              {more ? (
                                <button type="button" onClick={() => setExpanded((x) => ({ ...x, [l.id]: !x[l.id] }))} aria-expanded={Boolean(expanded[l.id])}
                                  className="rounded text-stone-600 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus tabular-nums">
                                  {expanded[l.id] ? 'Show fewer' : `Show all ${l.rows.length}`}
                                </button>
                              ) : <span />}
                              {l.hub && (
                                <button type="button" onClick={() => go({ href: l.hub })}
                                  className="group inline-flex items-center gap-1 rounded text-stone-700 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
                                  View in Prompt Hub<ArrowRight size={14} className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  )
                })}

                {/* g. worth doing next (only when the data points at an action) */}
                {next.length > 0 && (
                  <section className={section}>
                    <SectionToggle id="next" title="Worth doing next" open={!collapsed.next} onToggle={() => toggle('next')} />
                    {!collapsed.next && (
                      <ul id="wc-list-next" className="mt-2 divide-y divide-[var(--div)]">
                        {next.map((n) => (
                          <li key={n.id} className={order < 8 ? 'wc-row' : undefined} style={{ '--i': order++ }}>
                            <button type="button" onClick={() => go(n)}
                              className="group -mx-2 flex min-h-12 w-[calc(100%+16px)] items-center gap-3 rounded-lg px-2 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
                              <Mark mark={n.mark} />
                              <span className="min-w-0 flex-1 text-[15px] leading-[22px] text-stone-600"><Text parts={n.text} /></span>
                              <span className="inline-flex shrink-0 items-center gap-1 text-[13px] leading-[18px] font-semibold text-ink">
                                {n.action}<ArrowRight size={14} className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
              </>
            )}

            {/* h. footer */}
            <p className={`${section} text-[12.5px] leading-[18px] text-stone-500 tabular-nums`}>{data.footer.join(' · ')}</p>
          </div>
    </PullOut>
  )
}

// The pull-out shell, shared by What changed and Notifications: in <body> (a page view that stays mounted but hidden
// can still open it), the drawers' scrim and sheet (a bottom sheet on phones), 440px, 28px padding, a 260ms slide,
// focus trapped inside, Esc closes, focus back to the opener (useDrawer).
export function PullOut({ drawer, labelledBy, children }) {
  const { shown, close, panel } = drawer
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'Tab') {
      const f = [...panel.current.querySelectorAll('button:not([disabled]):not([tabindex="-1"]), a[href], input:not([disabled])')].filter((el) => el.offsetParent !== null)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }
  // motion (owner, 2026-11-20): the panel slides in over 380ms, cubic-bezier(.32,.72,0,1), and out in 280ms; the backdrop
  // fades over 250ms; rows fade in once it has landed (.wc-row, index.css). Reduced motion: no slide, a short fade.
  const base = SHEET_BASE.replace('duration-[280ms] ease-[cubic-bezier(.2,.8,.2,1)]', '').replace('md:duration-[250ms] md:ease-out', '')
  const motion = shown ? 'duration-[380ms] ease-[cubic-bezier(.32,.72,0,1)]' : 'duration-[280ms] ease-[cubic-bezier(.32,.72,0,1)]'
  return createPortal(
    <div className="fixed inset-0 z-50" onKeyDown={onKeyDown}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity duration-[250ms] ease-out motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`} onClick={close} aria-hidden />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}
        className={`${base} ${motion} md:w-[min(440px,100vw)] motion-reduce:!translate-x-0 motion-reduce:!translate-y-0 ${shown ? 'translate-y-0 md:translate-x-0 opacity-100' : 'translate-y-full md:translate-y-0 md:translate-x-full motion-reduce:opacity-0'}`}>
        <SheetHandle panelRef={panel} onClose={close} />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-3 md:p-7">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

function SectionToggle({ id, title, count, open, onToggle }) {
  return (
    <h3>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`wc-list-${id}`}
        className="group -mx-1 flex w-[calc(100%+8px)] items-center gap-2 rounded-md px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus">
        <span className="text-[14px] leading-5 font-semibold text-stone-900">{title}</span>
        {count != null && <span className="text-[13px] leading-5 text-stone-500 tabular-nums">{count}</span>}
        <ChevronDown size={14} aria-hidden className={`ml-auto text-stone-500 transition-transform duration-150 group-hover:text-stone-900 motion-reduce:transition-none ${open ? '' : '-rotate-90'}`} />
      </button>
    </h3>
  )
}

// a logo (engine / site) or, with none, a small status mark
function Mark({ mark }) {
  if (mark?.engine) return <span className="grid h-5 w-5 shrink-0 place-items-center"><PlatformIcon id={mark.engine} size={18} /></span>
  if (mark?.domain) return <Favicon domain={mark.domain} />
  const fill = { good: 'bg-[var(--rep-up-fg)]', up: 'bg-[var(--rep-up-fg)]', bad: 'bg-negative', down: 'bg-negative' }[mark?.status] ?? 'bg-stone-400'
  return <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center"><span className={`h-2 w-2 rounded-full ${fill}`} /></span>
}

function Row({ row, i, onPick }) {
  const inner = (
    <>
      <Mark mark={row.mark} />
      <span className="min-w-0 flex-1 text-[15px] leading-[22px] text-stone-600"><Text parts={row.text} /></span>
      {row.spark && <Spark values={row.spark} good={row.delta?.good} />}
      {row.delta && <span className={`shrink-0 text-right text-[13px] leading-[18px] font-medium tabular-nums ${toneCls(row.delta.good)}`}>{row.delta.text}</span>}
    </>
  )
  const cls = 'group -mx-2 flex min-h-12 w-[calc(100%+16px)] items-center gap-3 rounded-lg px-2 py-2.5 text-left'
  return (
    <li className={i < 8 ? 'wc-row' : undefined} style={{ '--i': i }}>
      {onPick
        ? <button type="button" onClick={onPick} className={`${cls} outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus`}>{inner}</button>
        : <div className={cls}>{inner}</div>}
    </li>
  )
}

// hover / focus: the row's recent history, 40×16, in the change's colour
function Spark({ values, good }) {
  const v = values.filter((x) => x != null)
  if (v.length < 2) return null
  const lo = Math.min(...v), hi = Math.max(...v)
  const W = 40, H = 16
  const pts = values.map((x, i) => (x == null ? null : [(i / (values.length - 1)) * W, H - 2 - ((x - lo) / (hi - lo || 1)) * (H - 4)])).filter(Boolean)
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden
      className="shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={good === false ? 'var(--negative)' : good ? 'var(--rep-up-fg)' : 'var(--color-stone-500)'} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// the card (or section) a row points at: scrolled into view, outlined for 2s
function outline(selector) {
  const host = document.querySelector(selector)
  const el = host?.getAttribute('data-card') ? host.firstElementChild : host
  if (!el) return
  el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' })
  el.getAnimations().forEach((a) => a.id === 'wc-outline' && a.cancel())
  const a = el.animate(
    [{ boxShadow: '0 0 0 2px var(--ink)' }, { boxShadow: '0 0 0 2px var(--ink)', offset: 0.8 }, { boxShadow: '0 0 0 2px transparent' }],
    { duration: 2000, easing: 'ease-out' },
  )
  a.id = 'wc-outline'
}

// ---------------------------------------------------------------- the one chart
// The page's main number in ink, the period before ghosted grey underneath, the latest value labelled at the end and
// the compared point marked. Full panel width, 120px tall; the ink line draws in once.
function HeroChart({ hero }) {
  const wrap = useRef(null)
  const [w, setW] = useState(384)
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = 120, top = 12, bottom = 22, right = 34
  const all = [...hero.points.map((p) => p.value), ...hero.ghost]
  const span = Math.max(...all) - Math.min(...all)
  const pad = Math.max(2, span * 0.12)
  const lo = Math.min(...all) - pad, hi = Math.max(...all) + pad
  const n = hero.points.length
  const x = (i, len = n) => (len < 2 ? 0 : (i / (len - 1)) * (w - right))
  const y = (v) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bottom)
  const path = (vals, len) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i, len).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = hero.points[n - 1]
  const cmp = hero.compareAt >= 0 && hero.compareAt < n - 1 ? hero.points[hero.compareAt] : null
  const cmpBelow = cmp && cmp.value <= last.value
  const anchor = !cmp ? 'middle' : hero.compareAt === 0 ? 'start' : x(hero.compareAt) > w - right - 60 ? 'end' : 'middle'
  return (
    <figure className="-mt-1">
      <div ref={wrap} className="w-full">
        <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" className="block overflow-visible"
          aria-label={`${hero.caption} ${hero.points.map((p) => `${p.date} ${p.value}`).join(', ')}.`}>
          {hero.ghost.length > 1 && <path d={path(hero.ghost, hero.ghost.length)} fill="none" stroke="var(--color-stone-300)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />}
          <path d={path(hero.points.map((p) => p.value), n)} pathLength="1" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="wc-draw" />
          {cmp && (
            <g className="wc-late">
              <circle cx={x(hero.compareAt)} cy={y(cmp.value)} r="3.5" fill="var(--color-surface)" stroke="var(--color-stone-500)" strokeWidth="1.5" />
              <text x={x(hero.compareAt)} y={y(cmp.value) + (cmpBelow ? 17 : -9)} textAnchor={anchor} fontSize="12" fill="var(--color-stone-500)" className="tabular-nums">{cmp.date}: {cmp.value}</text>
            </g>
          )}
          <g className="wc-late">
            <circle cx={x(n - 1)} cy={y(last.value)} r="4" fill="var(--ink)" />
            <text x={x(n - 1) + 9} y={y(last.value)} dy="0.35em" fontSize="13" fontWeight="600" fill="var(--ink)" className="tabular-nums">{last.value}</text>
          </g>
          <text x={0} y={H - 4} fontSize="12" fill="var(--color-stone-500)" className="tabular-nums">{hero.points[0].date}</text>
          <text x={x(n - 1)} y={H - 4} textAnchor="end" fontSize="12" fill="var(--color-stone-500)" className="tabular-nums">{last.date}</text>
        </svg>
      </div>
      <figcaption className="mt-2 text-[12.5px] leading-[18px] text-stone-500">{hero.caption}</figcaption>
    </figure>
  )
}
