import { linkClick, usePath } from '../../router'
import { Wordmark } from '../../components/ui/Logo'
import ThemeToggle from '../../components/dashboard/ThemeToggle'

// A stand-in for the superadmin console's frame, only so billing's two console pages (screens 7 and 8) have a home in
// the mock. The real console is an older style (uppercase headers, coloured badges); these two pages follow the locked
// design system and the rest of the console is left alone (open conflict 1). Nothing inside a page depends on this
// frame, so the Payments page can move to a settings page the agency runs itself, unchanged.
const NAV = [['White label', '/console/white-label/acme/payments'], ['Billing', '/console/billing']]
export default function ConsoleShell({ crumbs, children }) {
  const path = usePath()
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-sidebar-line bg-sidebar lg:flex">
        <div className="px-3 pt-4"><span className="flex h-10 items-center px-3"><Wordmark /></span></div>
        <p className="mt-6 px-5 text-[12px] leading-4 font-medium text-stone-500">Superadmin</p>
        <nav aria-label="Console" className="mt-1 flex flex-col gap-px px-3">
          {NAV.map(([label, href]) => {
            const on = path.startsWith(href.split('/').slice(0, 3).join('/'))
            return <a key={href} href={href} onClick={linkClick(href)} aria-current={on ? 'page' : undefined} className={`flex h-[30px] items-center rounded-md px-2 text-[14px] leading-5 font-medium text-ink outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${on ? 'bg-[var(--tint)]' : 'hover:bg-nav-hover'}`}>{label}</a>
          })}
        </nav>
        <div className="mt-auto px-3 pb-3"><ThemeToggle /></div>
      </aside>
      <div className="min-w-0 flex-1">
        <main className="page-gutters mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-4 pb-10 pt-4 md:gap-4 md:px-6 lg:pt-8">
          {crumbs && <p className="text-[13px] leading-[18px] text-stone-500">{crumbs}</p>}
          {children}
        </main>
      </div>
    </div>
  )
}
