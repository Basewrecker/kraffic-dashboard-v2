import { useEffect, useRef, useState } from 'react'
import { Check, CreditCard, House, Menu, X } from 'lucide-react'
import { navigate } from '../../router'
import Logo from '../ui/Logo'
import SiteLogo from '../ui/SiteLogo'
import Sheet, { SheetItem } from '../ui/Sheet'
import ThemeToggle from './ThemeToggle'
import { HOME, NavLinks, WorkspaceContext, WorkspaceList, WorkspaceSwitcher } from './Sidebar'
import { account, agencyClients } from '../../data/mock'
import { useBackClose } from '../../hooks/useOverlay'

// Below lg: a sticky top bar (menu · Kraffic mark ······ workspace logo) instead of the sidebar.
// The menu opens the nav as a left drawer (288px): same groups and items, theme + workspace at the bottom.
// Closes on a link tap, the scrim, Esc, a swipe left, or Back.
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function NavDrawer({ open, onClose, path }) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const panel = useRef(null)
  const [close, release] = useBackClose(open, onClose)
  const swipe = useRef(null)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(r)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), reduced() ? 0 : 240)
    return () => clearTimeout(t)
  }, [open])
  useEffect(() => {
    if (!open || !mounted) return
    panel.current?.querySelector('a[aria-current=page], a')?.focus()
    const esc = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', esc)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = overflow }
  }, [open, mounted, close])

  // swipe left to close: follows the finger, closes past 80px
  const onTouchStart = (e) => { swipe.current = { x: e.touches[0].clientX, dx: 0 }; panel.current.style.transition = 'none' }
  const onTouchMove = (e) => {
    if (!swipe.current) return
    swipe.current.dx = Math.min(0, e.touches[0].clientX - swipe.current.x)
    panel.current.style.transform = `translateX(${swipe.current.dx}px)`
  }
  const onTouchEnd = () => {
    const dx = swipe.current?.dx ?? 0
    swipe.current = null
    panel.current.style.transition = ''
    panel.current.style.transform = ''
    if (dx < -80) close()
  }

  if (!mounted) return null
  return (
    <div className="fixed inset-0 z-[70] lg:hidden">
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-[240ms] ease-out motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`} onClick={close} aria-hidden />
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Menu" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        className={`absolute inset-y-0 left-0 flex w-[288px] max-w-[85vw] flex-col border-r border-line bg-stone-50 pt-[env(safe-area-inset-top)] shadow-xl outline-none transition-transform duration-[240ms] ease-out motion-reduce:transition-none ${shown ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-14 shrink-0 items-center justify-between px-3">
          <a href={HOME} aria-label="Kraffic — Home" className="flex h-10 items-center rounded-lg px-2 outline-none focus-visible:ring-2 focus-visible:ring-focus"><Logo size={24} /><span className="ml-2 text-[16px] font-bold text-stone-900">Kraffic</span></a>
          <button type="button" onClick={close} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-md text-stone-600 outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus"><X size={20} aria-hidden /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2">
          {/* a link tap navigates: keep the new page's history entry, then close */}
          <WorkspaceContext />
          <NavLinks path={path} onNavigate={() => { release(); onClose() }} />
        </div>
        <div className="flex shrink-0 flex-col gap-2 px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <ThemeToggle />
          <WorkspaceSwitcher />
        </div>
      </div>
    </div>
  )
}

function WorkspaceSheet({ open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="Workspace">
      <WorkspaceList onDone={onClose} autoFocus={false} />
    </Sheet>
  )
}

export default function MobileNav({ path }) {
  const [menu, setMenu] = useState(false)
  const [workspace, setWorkspace] = useState(false)
  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-[var(--div)] bg-[color-mix(in_srgb,var(--color-page)_90%,transparent)] px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
        <button type="button" onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu}
          className="-ml-2 grid h-10 w-10 place-items-center rounded-md text-stone-700 outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus"><Menu size={20} aria-hidden /></button>
        <a href={HOME} aria-label="Kraffic — Home" className="grid h-10 w-10 place-items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus"><Logo size={24} /></a>
        <button type="button" onClick={() => setWorkspace(true)} aria-label={`Workspace: ${account.name}`}
          className="ml-auto grid h-10 w-10 place-items-center rounded-md outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus">
          <SiteLogo domain={account.domain} name={account.name} className="h-7 w-7 rounded-md" imgPad="p-0.5" initialClass="text-[12px]" plate />
        </button>
      </header>
      <NavDrawer open={menu} onClose={() => setMenu(false)} path={path} />
      <WorkspaceSheet open={workspace} onClose={() => setWorkspace(false)} />
    </>
  )
}
