import { ChevronLeft } from 'lucide-react'
import { linkClick } from '../router'

// "‹ Toolkit" above a sub-page's H1: a real link to the parent route (works when the page is opened directly),
// not history.back(). -ml-1 pulls the chevron left so it lines up optically with the H1 below.
//   <BackLink to="/more-tools">Toolkit</BackLink>
export default function BackLink({ to, children }) {
  return (
    <a href={to} onClick={linkClick(to)}
      className="-ml-1 mb-2 inline-flex items-center gap-1 rounded text-[13px] leading-[18px] font-medium text-stone-600 outline-none transition-colors duration-150 ease-out hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
      <ChevronLeft size={14} aria-hidden />
      {children}
    </a>
  )
}
