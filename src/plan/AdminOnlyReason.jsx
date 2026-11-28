import { isSuperadmin } from './plan'

// The superadmin-only reason line (as the app, #226): a client never sees why a connection failed ("<engine> isn't
// connected, ask your admin"); the state shows nothing or a plain Retry. A superadmin (?as=superadmin) sees the real
// reason as one small muted line.
export default function AdminOnlyReason({ children, className = '' }) {
  if (!children || !isSuperadmin()) return null
  return <p data-admin-reason className={`text-[12px] leading-4 text-stone-500 text-pretty ${className}`}>{children}</p>
}
