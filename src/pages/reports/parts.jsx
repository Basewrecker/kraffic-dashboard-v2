import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import SiteLogo from '../../components/ui/SiteLogo'
import { linkClick } from '../../router'
import { brand as workspaceBrand } from '../../store/workspace'
import { DEFAULT_OPTS, REPORT_BRANDS, AUDIENCES, periodLabel, resolveOpts } from '../../data/reports'

export const t2 = 'text-stone-600'
export const t3 = 'text-stone-500'
export const inkBtn = 'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-ink px-3.5 text-small font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50'
export const lineBtn = 'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-small font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50'

// ---- the options in the URL: /reports/new?q=…&brand=foa&period=week&engines=aio,chatgpt&compare=…&audience=ceo&length=one
export function toQuery(opts, prompt) {
  const q = new URLSearchParams()
  if (prompt) q.set('q', prompt)
  for (const k of ['brand', 'period', 'audience', 'length', 'from', 'to']) if (opts[k]) q.set(k, opts[k])
  for (const k of ['engines', 'compare']) if (opts[k]?.length) q.set(k, opts[k].join(','))
  return q.toString()
}
export function fromQuery(search = window.location.search) {
  const q = new URLSearchParams(search)
  const list = (k) => (q.get(k) ? q.get(k).split(',').filter(Boolean) : [])
  return {
    prompt: q.get('q') ?? '',
    opts: { ...DEFAULT_OPTS, brand: q.get('brand') ?? defaultBrand(), period: q.get('period'), audience: q.get('audience'), length: q.get('length'), engines: list('engines'), compare: list('compare'), from: q.get('from'), to: q.get('to') },
  }
}
// the brand chip starts on the brand you're viewing
export const defaultBrand = () => (REPORT_BRANDS.some((b) => b.id === workspaceBrand.id) ? workspaceBrand.id : 'dermasuri')

// ---- page head (the other pages' type scale)
export function ReportsHead({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-6">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">{title}</h1>
        {subtitle && <p className={`mt-1 text-[13px] leading-[18px] ${t2}`}>{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// ---- a chip with a small menu (the composer's options). It opens toward the side with room and stays on screen.
export function ChipMenu({ icon: Icon, logo, label, value, inferred, width = 256, children }) {
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState({ left: true, shift: 0 })
  const wrap = useRef(null)
  const btn = useRef(null)
  const menu = useRef(null)
  useLayoutEffect(() => {
    if (!open || !menu.current || !btn.current) return
    const b = btn.current.getBoundingClientRect()
    const w = menu.current.offsetWidth
    if (b.left + w <= window.innerWidth - 16) setPlace({ left: true, shift: 0 })
    else if (b.right - w >= 16) setPlace({ left: false, shift: 0 })
    else setPlace({ left: true, shift: Math.min(0, window.innerWidth - 16 - (b.left + w)) })
  }, [open])
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector('[aria-checked=true],[role^=menuitem],input')?.focus()
    const out = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [open])
  const close = () => { setOpen(false); btn.current?.focus() }
  const onKey = (e) => {
    const els = [...(menu.current?.querySelectorAll('[role^=menuitem]') ?? [])]
    const i = els.indexOf(document.activeElement)
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && els.length) { e.preventDefault(); els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus() }
  }
  const set = value != null && !inferred
  return (
    <div ref={wrap} className="relative min-w-0" onKeyDown={open ? onKey : undefined}>
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        title={inferred ? `${label}: ${value}, from your question` : label}
        className={`inline-flex h-8 max-w-[15rem] items-center max-md:max-w-full gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] leading-[18px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${
          set ? 'border-transparent bg-tint font-medium text-stone-900'
            : inferred ? 'border-dashed border-stone-400 text-stone-800 hover:bg-tint'
              : 'border-line text-stone-600 hover:bg-tint hover:text-stone-900'}`}>
        {logo ?? (Icon && <Icon size={14} className={set || inferred ? 'text-stone-700' : 'text-stone-500'} aria-hidden />)}
        <span className="truncate">{value ?? label}</span>
        <ChevronDown size={13} className={`shrink-0 text-stone-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div ref={menu} role="menu" aria-label={label} style={{ width: `min(${width}px, calc(100vw - 32px))`, ...(place.shift ? { transform: `translateX(${place.shift}px)` } : {}) }}
          className={`absolute ${place.left ? 'left-0' : 'right-0'} top-full z-40 mt-1.5 rounded-lg border border-line bg-raised p-1 shadow-md motion-safe:animate-[fade-in_120ms_ease-out]`}>
          {children(close)}
        </div>
      )}
    </div>
  )
}
export const menuItem = 'flex min-h-9 w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] leading-[18px] outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint'
export const menuLabel = 'px-2 pb-1 pt-1.5 text-[12px] leading-4 text-stone-500'

export const brandOf = (id) => REPORT_BRANDS.find((b) => b.id === id)
export function BrandLogo({ id, className = 'h-4 w-4' }) {
  const b = brandOf(id)
  return b ? <SiteLogo domain={b.domain} name={b.name} className={`${className} shrink-0 rounded`} imgPad="p-0" initialClass="text-[8px]" plate /> : null
}

// ---- report lists (home "Recent reports", All reports)
const AUD = Object.fromEntries(AUDIENCES.map((a) => [a.id, a.label]))
const COLS = 'md:grid-cols-[minmax(0,1fr)_200px_112px_64px_56px]'
export function ReportList({ rows, showBrand = true }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className={`hidden h-9 items-center gap-3 border-b border-[var(--div)] bg-tint px-5 text-[13px] leading-[18px] font-medium ${t3} md:grid ${COLS}`}>
        <span>Report</span><span>{showBrand ? 'Brand' : ''}</span><span>Period</span><span>Created</span><span>For</span>
      </div>
      <ul className="divide-y divide-[var(--div)]">
        {rows.map((r) => {
          const o = resolveOpts(r.opts, r.prompt)
          const b = brandOf(r.brand)
          return (
            <li key={r.id}>
              <a href={`/reports/${r.id}`} onClick={linkClick(`/reports/${r.id}`)}
                className={`grid min-h-14 items-center gap-x-3 px-5 py-2.5 outline-none transition-colors duration-150 hover:bg-tint focus-visible:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus max-md:px-4 ${COLS}`}>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{r.title}</span>
                  <span className={`mt-0.5 block truncate text-[12px] leading-4 ${t3} md:hidden`}>{showBrand ? `${b?.name} · ` : ''}{periodLabel(o.period)} · {r.created} · For {AUD[o.audience]}</span>
                </span>
                <span className="hidden min-w-0 items-center gap-2 text-[13px] text-stone-700 md:flex">
                  {showBrand && <><BrandLogo id={r.brand} /><span className="truncate">{b?.name}</span></>}
                </span>
                <span className={`hidden text-[13px] ${t2} md:block`}>{periodLabel(o.period)}</span>
                <span className={`hidden text-[13px] tabular-nums ${t2} md:block`}>{r.created}</span>
                <span className={`hidden text-[13px] ${t2} md:block`}>{AUD[o.audience]}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Empty({ title, children, action }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <p className="text-[15px] leading-5 font-semibold text-stone-900">{title}</p>
      <p className={`mt-1 max-w-[46ch] text-[13px] leading-[18px] ${t2}`}>{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
