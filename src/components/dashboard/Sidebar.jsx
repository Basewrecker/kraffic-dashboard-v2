import { useEffect, useRef, useState } from 'react'
import { BarChart3, Check, ChevronsUpDown, CreditCard, House, Search, UserRound, Users, MessageSquareText, TrendingUp, Settings2, Cpu, Puzzle, ScanSearch, Code2 } from 'lucide-react'
import { account } from '../../data/mock'
import ThemeToggle from './ThemeToggle'
import { linkClick } from '../../router'
import { Wordmark } from '../ui/Logo'
import SiteLogo from '../ui/SiteLogo'
import { agency, brand, recentBrands, role, switchBrand, visibleDirectory } from '../../store/workspace'

// grouped nav, each group ordered longest → shortest label; items without an href have no page yet.
// Old routes redirect (see router.js REDIRECTS).
export const groups = [
  { label: 'Insights', items: [
    { label: 'Visibility Overview', icon: BarChart3, href: '/overview' },
    { label: 'Prompt Hub', icon: MessageSquareText, href: '/tracker' },
    { label: 'Trends', icon: TrendingUp, href: '/trends' },
  ] },
  { label: 'Optimize', items: [
    { label: 'Structured Data', icon: Code2, href: '/structured-data' },
    { label: 'Site Audit', icon: ScanSearch, href: '/audit' },
    { label: 'Toolkit', icon: Puzzle, href: '/more-tools' },
  ] },
  { label: 'Settings', items: [
    { label: 'Brand Setup', icon: Settings2, href: '/brands' },
    { label: 'Tracking', icon: Cpu, href: '/tracking' },
  ] },
]

// the superadmin home lives outside this app: a full page load, not an in-app route
export const HOME = '/superadmin'

// Workspace switcher (sidebar footer). Agency users: search, Agency home, Recent, then every client with its brands, and
// Team / Billing / Settings / Profile at the bottom. Client users: only their own brands. Opens upward (320 × ≤440).
// ↑/↓ move (from the search box too), Enter switches, Esc or a click outside closes. Switching keeps the page (150ms fade).
export function WorkspaceList({ onDone, autoFocus = true }) {
  const [q, setQ] = useState('')
  const list = useRef(null)
  const agencyUser = role() === 'agency'
  const match = (s) => s.toLowerCase().includes(q.trim().toLowerCase())
  const dir = visibleDirectory()
    .map((c) => ({ ...c, brands: c.brands.filter((b) => !q || match(b.name) || match(c.client)) }))
    .filter((c) => c.brands.length)
  const recent = q ? [] : recentBrands()
  const pick = (b) => { onDone?.(); switchBrand(b.id) }
  const onKey = (e) => {
    const items = [...list.current.querySelectorAll('[role=menuitem]:not([aria-disabled=true])')]
    const i = items.indexOf(document.activeElement)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus() }
    else if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); items[0]?.click() }
  }
  const item = 'flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-[14px] leading-5 outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:bg-[var(--tint)]'
  const label = 'px-3 pb-1 pt-2 text-[13px] leading-[18px] text-stone-500'
  const BrandRow = ({ b }) => {
    const current = b.id === brand.id
    return (
      <button type="button" role="menuitem" onClick={() => (current ? onDone?.() : pick(b))} aria-current={current || undefined}
        className={`${item} ${current ? 'font-medium text-stone-900' : 'text-stone-900'}`}>
        <SiteLogo domain={b.domain} name={b.name} className="h-5 w-5 rounded-md" imgPad="p-0.5" initialClass="text-[10px]" plate />
        <span className="min-w-0 flex-1 truncate">{b.name}</span>
        {current && <Check size={14} className="shrink-0 text-ink" aria-label="Current brand" />}
      </button>
    )
  }
  const foot = [
    ['Team', Users, null],
    ['Billing', CreditCard, '/billing'],
    ['Settings', Settings2, '/brands'],
    ['Profile', UserRound, null],
  ]
  return (
    <div ref={list} onKeyDown={onKey} className="flex max-h-[440px] min-h-0 flex-col">
      <div className="shrink-0 p-1">
        <label className="relative block">
          <span className="sr-only">Search clients and brands</span>
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden />
          <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder={agencyUser ? 'Search clients and brands' : 'Search brands'}
            className="h-9 w-full rounded-md border border-line bg-surface pl-8 pr-3 text-[14px] text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-400" />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1 pt-0">
        {agencyUser && !q && (
          <a role="menuitem" href={HOME} className={`${item} font-medium text-stone-900`}>
            <SiteLogo domain={agency.domain} name={agency.name} className="h-5 w-5 rounded-md" imgPad="p-0.5" initialClass="text-[10px]" plate />
            <span className="min-w-0 flex-1 truncate">{agency.name}</span>
            <span className="shrink-0 text-[12px] text-stone-500">Agency home</span>
          </a>
        )}
        {recent.length > 0 && (
          <>
            <div className={label}>Recent</div>
            {recent.map((b) => <BrandRow key={`r-${b.id}`} b={b} />)}
          </>
        )}
        {agencyUser ? (
          <>
            {!q && <div className="my-1 border-t border-line" role="separator" />}
            {!q && <div className="px-3 pb-0.5 pt-1 text-[12px] leading-4 font-medium text-stone-500">All clients</div>}
            {dir.map((c) => (
              <div key={c.id} role="group" aria-label={c.client}>
                <div className={label}>{c.client}</div>
                {c.brands.map((b) => <BrandRow key={b.id} b={b} />)}
              </div>
            ))}
          </>
        ) : (
          <>
            <div className={label}>Brands</div>
            {dir.flatMap((c) => c.brands).map((b) => <BrandRow key={b.id} b={b} />)}
          </>
        )}
        {dir.length === 0 && <p className="px-3 py-4 text-[13px] leading-[18px] text-stone-500">No client or brand matches “{q}”</p>}
      </div>
      <div className="shrink-0 border-t border-line p-1">
        {foot.map(([l, Icon, href]) => (href
          ? <a key={l} role="menuitem" href={href} onClick={(e) => { onDone?.(); linkClick(href)(e) }} className={`${item} text-stone-900`}><span className="grid w-5 shrink-0 place-items-center" aria-hidden><Icon size={16} className="text-stone-600" /></span>{l}</a>
          : <span key={l} role="menuitem" aria-disabled="true" title="Not designed in the mock yet" className={`${item} cursor-default text-stone-500 hover:bg-transparent`}><span className="grid w-5 shrink-0 place-items-center" aria-hidden><Icon size={16} /></span>{l}</span>))}
      </div>
    </div>
  )
}

export function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false) // kept mounted for the closing fade
  const [shown, setShown] = useState(false)
  const wrap = useRef(null)
  const trigger = useRef(null)
  useEffect(() => {
    if (open) {
      setMounted(true)
      const r = requestAnimationFrame(() => setShown(true))
      const out = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false) }
      document.addEventListener('mousedown', out)
      return () => { cancelAnimationFrame(r); document.removeEventListener('mousedown', out) }
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), 150)
    return () => clearTimeout(t)
  }, [open])
  const close = () => { setOpen(false); trigger.current?.focus() }
  const agencyUser = role() === 'agency'
  return (
    <div ref={wrap} className="relative" onKeyDown={(e) => { if (open && e.key === 'Escape') { e.preventDefault(); close() } else if (open && e.key === 'Tab' && !e.shiftKey && e.target === wrap.current?.querySelector('[role=menu] [role=menuitem]:last-of-type')) setOpen(false) }}>
      {mounted && (
        <div role="menu" aria-label="Workspace"
          className={`absolute bottom-full left-0 z-30 mb-1 flex w-[min(320px,calc(100vw-32px))] flex-col overflow-hidden rounded-lg border border-line bg-raised shadow-md transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${shown ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}`}>
          <WorkspaceList onDone={() => setOpen(false)} />
        </div>
      )}
      <button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !open) { e.preventDefault(); setOpen(true) } }}
        className="flex h-12 w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 text-left outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-focus">
        <SiteLogo domain={account.domain} name={account.name} className="h-7 w-7 rounded-md" imgPad="p-0.5" initialClass="text-[12px]" plate />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{account.name}</span>
          <span className="block truncate text-[12px] leading-4 text-stone-500">{agencyUser ? brand.client : account.plan}</span>
        </span>
        <ChevronsUpDown size={14} className="ml-auto shrink-0 text-stone-500" aria-hidden />
      </button>
    </div>
  )
}

// agency users: which client and brand they're looking at, above the nav
export function WorkspaceContext() {
  if (role() !== 'agency') return null
  return (
    <div className="mb-5 min-w-0 px-3" aria-label="Current client and brand">
      <div className="truncate text-[13px] leading-[18px] text-stone-500">{brand.client} /</div>
      <div className="truncate text-[14px] leading-5 font-medium text-stone-900">{brand.name}</div>
    </div>
  )
}

// the grouped nav links (sidebar on desktop, the drawer on phones); onNavigate runs before an in-app link navigates
export function NavLinks({ path, onNavigate }) {
  return (
    <nav className="flex flex-col" aria-label="Main">
      {groups.map((g, gi) => (
      <div key={g.label} role="group" aria-labelledby={`nav-${g.label}`} className="flex flex-col gap-0.5">
      <div id={`nav-${g.label}`} className={`mb-1.5 px-3 text-[12px] leading-4 font-medium text-stone-500 ${gi ? 'mt-6' : ''}`}>{g.label}</div>
      {g.items.map(({ label, icon: Icon, href }) => {
        const active = href === path
        return (
        <a
          key={label}
          href={href ?? '#'}
          onClick={href ? (e) => { onNavigate?.(); linkClick(href)(e) } : (e) => e.preventDefault()}
          aria-current={active ? 'page' : undefined}
          className={`relative flex h-11 items-center gap-3 rounded-lg px-3 text-body font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus lg:h-10 ${
            active ? 'bg-tint text-ink' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-ink" aria-hidden />}
          <Icon size={18} strokeWidth={2} className={active ? 'text-ink' : undefined} />
          {label}
        </a>
        )
      })}
      </div>
      ))}
    </nav>
  )
}

export default function Sidebar({ path = '/overview' }) {
  return (
    // below lg the sidebar is replaced by the top bar + drawer (MobileNav)
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-stone-200 bg-stone-50 lg:flex">
      {/* top: the logo (a link home). px-3 everywhere: logo, nav icons and the footer blocks share one x */}
      <div className="shrink-0 px-3 pt-4">
        <a href={HOME} title="Home" aria-label="Kraffic — Home" className="flex h-10 items-center rounded-lg px-3 outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-focus"><Wordmark /></a>
      </div>
      <div className="mt-6 px-3"><WorkspaceContext /><NavLinks path={path} /></div>
      {/* footer: theme, then the workspace (its menu holds Home) */}
      <div className="mt-auto flex flex-col gap-2 px-3 pb-3">
        <ThemeToggle />
        <WorkspaceSwitcher />
      </div>
    </aside>
  )
}
