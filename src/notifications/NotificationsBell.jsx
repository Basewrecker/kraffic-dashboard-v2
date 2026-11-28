import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNotificationsEntry } from './Notifications'

// The header's bell (as the app, #216 / #223): the last control of every page header, a 36px button. The card opens
// as a dropdown under it (Notifications.jsx anchors to [data-nav-notifications]). Unread: a red badge on its corner
// with the count ("99+" above 99) and a page-colour ring; it pops once when the count rises (reduced motion: no pop).
export function NotificationsBell({ className = '' }) {
  const { unread, open, toggle } = useNotificationsEntry()
  const last = useRef(unread)
  const [pop, setPop] = useState(false)
  useEffect(() => {
    if (unread > last.current) { setPop(true); const t = setTimeout(() => setPop(false), 300); last.current = unread; return () => clearTimeout(t) }
    last.current = unread
    return undefined
  }, [unread])
  return (
    <button type="button" onClick={toggle} data-nav-notifications aria-haspopup="dialog" aria-expanded={open}
      aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-lg text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus ${open ? 'bg-tint text-stone-900' : ''} ${className}`}>
      <Bell size={18} strokeWidth={1.75} aria-hidden />
      {unread > 0 && (
        <span aria-hidden className={`absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--nc-badge)] px-1 text-[11px] leading-none font-semibold text-white tabular-nums ring-2 ring-[var(--color-page)] transition-transform duration-200 ease-out motion-reduce:transition-none ${pop ? 'scale-[1.2]' : 'scale-100'}`}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  )
}

// The end of a page header's controls: 12px · a 20px hairline · 12px · the bell. Put it after the page's last
// control (Summary where the page has one). Pages without controls show the bell alone (hairline={false}).
// Below lg the bell lives in the top bar (MobileNav), so this hides.
export default function HeaderBell({ hairline = true, className = '' }) {
  return (
    <span className={`hidden shrink-0 items-center gap-3 lg:inline-flex ${className}`}>
      {hairline && <span aria-hidden className="h-5 w-px bg-line" />}
      <NotificationsBell />
    </span>
  )
}
