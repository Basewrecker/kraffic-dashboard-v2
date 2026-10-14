import { useEffect, useRef, useState } from 'react'
import { BarChart3, Check, ChevronsUpDown, House, MessageSquareText, TrendingUp, Settings2, Cpu, Puzzle, ScanSearch, Code2 } from 'lucide-react'
import { account, agencyClients } from '../../data/mock'
import ThemeToggle from './ThemeToggle'
import { linkClick } from '../../router'
import { Wordmark } from '../ui/Logo'
import SiteLogo from '../ui/SiteLogo'

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

// Workspace switcher (sidebar footer): the current client; its menu opens upward with Home and the agency's brands.
// ↑/↓ move, Enter picks, Esc or a click outside closes. Opens / closes with opacity + a 4px rise, 150ms.
export function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false) // kept mounted for the closing fade
  const [shown, setShown] = useState(false)
  const wrap = useRef(null)
  const trigger = useRef(null)
  const menu = useRef(null)
  const brands = [{ name: account.name, domain: account.domain, current: true }, ...agencyClients]
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
  // focus the first item once the menu is actually in the DOM
  useEffect(() => { if (open && mounted) menu.current?.querySelector('[role=menuitem]')?.focus() }, [open, mounted])
  const close = () => { setOpen(false); trigger.current?.focus() }
  const onKey = (e) => {
    if (!open || !menu.current) return
    const items = [...menu.current.querySelectorAll('[role=menuitem]')]
    const i = items.indexOf(document.activeElement)
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus() }
    else if (e.key === 'Tab') setOpen(false)
  }
  // icon / logo column 20px, gap-3: the House icon and the brand logos line up
  const item = 'flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-[14px] leading-5 outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:bg-[var(--tint)]'
  return (
    <div ref={wrap} className="relative" onKeyDown={onKey}>
      {mounted && (
        <div ref={menu} role="menu" aria-label="Workspace"
          className={`absolute inset-x-0 bottom-full z-30 mb-1 rounded-lg border border-line bg-raised p-1 shadow-md transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${shown ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}`}>
          <a role="menuitem" href={HOME} className={`${item} font-medium text-stone-900`}>
            <span className="grid w-5 shrink-0 place-items-center" aria-hidden><House size={16} className="text-stone-600" /></span>Home
          </a>
          <div className="my-1 border-t border-line" role="separator" />
          <div className="px-3 pb-1 pt-2 text-[12px] leading-4 text-stone-500">Brands</div>
          {brands.map((b) => (
            <button key={b.domain} type="button" role="menuitem" aria-disabled={!b.current || undefined}
              title={b.current ? undefined : 'Not in this demo'} onClick={() => { if (b.current) close() }}
              className={`${item} ${b.current ? 'font-medium text-stone-900' : 'cursor-default text-stone-500'}`}>
              <SiteLogo domain={b.domain} name={b.name} className="h-5 w-5 rounded-md" imgPad="p-0.5" initialClass="text-[10px]" plate />
              <span className="min-w-0 flex-1 truncate">{b.name}</span>
              {b.current && <Check size={14} className="shrink-0 text-ink" aria-label="Current workspace" />}
            </button>
          ))}
        </div>
      )}
      <button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !open) { e.preventDefault(); setOpen(true) } }}
        className="flex h-12 w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 text-left outline-none transition-colors duration-150 hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-focus">
        <SiteLogo domain={account.domain} name={account.name} className="h-7 w-7 rounded-md" imgPad="p-0.5" initialClass="text-[12px]" plate />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] leading-5 font-medium text-stone-900">{account.name}</span>
          <span className="block truncate text-[12px] leading-4 text-stone-500">{account.plan}</span>
        </span>
        <ChevronsUpDown size={14} className="ml-auto shrink-0 text-stone-500" aria-hidden />
      </button>
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
      <div className="mt-6 px-3"><NavLinks path={path} /></div>
      {/* footer: theme, then the workspace (its menu holds Home) */}
      <div className="mt-auto flex flex-col gap-2 px-3 pb-3">
        <ThemeToggle />
        <WorkspaceSwitcher />
      </div>
    </aside>
  )
}
