import { useEffect, useState } from 'react'
import { AlertCircle, Check, Loader2, MoreHorizontal, RefreshCw } from 'lucide-react'
import Card from '../dashboard/Card'
import SiteLogo from '../ui/SiteLogo'
import BackLink from '../BackLink'
import ActionMenu from '../audit/ActionMenu'
import MobileActions from '../ui/MobileActions'

// One template for every Toolkit tool page:
//   BackLink → H1 + subtitle | controls · primary action (ink) · ⋯ menu
//   state: 'not-connected' (connection card + "What you'll see") · 'not-run' (empty state + primary action)
//          · 'running' (inline status line with a spinner and elapsed time, above the body) · 'error' (reason + Retry)
//          · 'ready' (the body)
//   connect: { title, sub, rows: [{ id, name, domain, status: 'none'|'expired'|'connected'|'error', account, onConnect }], seeing: [3 lines] }
//            shown in 'not-connected', and above the body when only some sources are connected (partial)
//   Body: the page passes its KPI strip → content rows → table card as children (cards p-5, gap-4).
export const t2 = 'text-stone-600'
export const t3 = 'text-stone-500'
export const cardTitle = 'text-[15px] leading-5 font-semibold text-stone-900'
export const subtitleCls = `mt-0.5 text-[13px] leading-[18px] ${t2}`
export const inkBtn = 'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-ink px-3.5 text-small font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-60'
export const lineBtn = 'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-small font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60'

export default function ToolPage({
  back = { to: '/more-tools', label: 'Toolkit' }, title, subtitle, controls = null, primary = null, menu = [],
  state = 'ready', connect = null, partial = false, empty = null, running = null, error = null, children,
}) {
  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <BackLink to={back.to}>{back.label}</BackLink>
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-[28px] lg:leading-9">{title}</h1>
          {subtitle && <p className={`mt-1 text-[13px] leading-[18px] ${t2}`}>{subtitle}</p>}
        </div>
        {(controls || primary || menu.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {controls}
            {primary && state !== 'not-connected' && (
              <button type="button" onClick={primary.onClick} disabled={primary.disabled || state === 'running'} className={`${inkBtn} max-lg:flex-1`}>
                {primary.icon && <primary.icon size={14} aria-hidden />}{primary.label}
              </button>
            )}
            {menu.length > 0 && (
              <>
                <span className="hidden lg:inline-flex">
                  <ActionMenu label="More actions" items={menu} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
                    <MoreHorizontal size={16} aria-hidden />
                  </ActionMenu>
                </span>
                <MobileActions items={menu} />
              </>
            )}
          </div>
        )}
      </div>

      {state === 'not-connected' && connect && <ConnectCard {...connect} seeing={connect.seeing} />}
      {state === 'not-run' && empty && <EmptyState {...empty} />}
      {state === 'error' && error && <ErrorCard {...error} />}
      {state === 'running' && running && <RunningLine {...running} />}
      {(state === 'ready' || state === 'running' || (state === 'error' && error?.keepBody)) && (
        <>
          {partial && connect && <ConnectCard {...connect} seeing={null} />}
          {children}
        </>
      )}
    </>
  )
}

// ---- connection card: one row per source; Connect (ink) / Reconnect (outline) / Connected
export function ConnectCard({ title = 'Connect your data', sub = 'Read-only access. We never change anything in your accounts.', rows, seeing }) {
  return (
    <Card className="p-5 max-md:p-4">
      <h2 className={cardTitle}>{title}</h2>
      <p className={subtitleCls}>{sub}</p>
      <ul className="mt-3 divide-y divide-[var(--div)] border-y border-[var(--div)]">
        {rows.map((r) => {
          const status = r.status === 'connected' ? [`Connected${r.account ? ` · ${r.account}` : ''}`, 'text-stone-900']
            : r.status === 'expired' ? ['Access expired', 'text-negative'] : r.status === 'error' ? [r.account ?? 'Couldn’t connect', 'text-negative'] : ['Not connected', t3]
          return (
            <li key={r.id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              {r.domain ? <SiteLogo domain={r.domain} name={r.name} className="h-8 w-8 rounded-lg" imgPad="p-1" />
                : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-tint text-[13px] font-semibold text-stone-600" aria-hidden>{r.name[0]}</span>}
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] leading-5 font-medium text-stone-900">{r.name}</span>
                <span className={`block truncate text-[13px] leading-[18px] ${status[1]}`}>{status[0]}</span>
              </span>
              {r.status === 'connected' ? <span className={`inline-flex items-center gap-1 text-[13px] ${t2}`}><Check size={14} className="text-ink" aria-hidden />Ready</span>
                : r.status === 'expired' || r.status === 'error' ? <button type="button" onClick={r.onConnect} className={lineBtn}>Reconnect</button>
                  : <button type="button" onClick={r.onConnect} className={inkBtn}>Connect</button>}
            </li>
          )
        })}
      </ul>
      {seeing && (
        <div className="mt-4">
          <h3 className="text-[13px] leading-[18px] font-semibold text-stone-900">What you’ll see</h3>
          <ul className={`mt-1.5 flex flex-col gap-1 text-[14px] leading-5 ${t2}`}>
            {seeing.map((x) => <li key={x} className="flex gap-2"><span className="text-stone-400" aria-hidden>–</span>{x}</li>)}
          </ul>
        </div>
      )}
    </Card>
  )
}

export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <Card className="flex flex-col items-center px-5 py-14 text-center">
      {Icon && <span className="grid h-10 w-10 place-items-center rounded-lg bg-tint text-ink" aria-hidden><Icon size={20} /></span>}
      <h2 className="mt-4 text-[15px] leading-5 font-semibold text-stone-900">{title}</h2>
      <p className={`mt-1 max-w-[440px] text-[14px] leading-5 ${t2}`}>{body}</p>
      {action && <button type="button" onClick={action.onClick} className={`${inkBtn} mt-5`}>{action.icon && <action.icon size={14} aria-hidden />}{action.label}</button>}
    </Card>
  )
}

export function ErrorCard({ title = 'This didn’t finish', reason, onRetry }) {
  return (
    <Card role="alert" className="flex items-start gap-3 p-5">
      <AlertCircle size={20} className="mt-0.5 shrink-0 text-negative" aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 className={cardTitle}>{title}</h2>
        <p className={`mt-1 text-[14px] leading-5 ${t2}`}>{reason}</p>
        {onRetry && <button type="button" onClick={onRetry} className={`${lineBtn} mt-4`}><RefreshCw size={14} aria-hidden />Retry</button>}
      </div>
    </Card>
  )
}

// "Syncing HubSpot… 0:42" — elapsed time ticks every second from `since`
export function RunningLine({ label, since }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const s = Math.max(0, Math.round((now - Date.parse(since)) / 1000)) % 3600
  return (
    <div role="status" className={`flex h-10 items-center gap-2 rounded-lg bg-tint px-3 text-[13px] leading-[18px] ${t2}`}>
      <Loader2 size={14} className="animate-spin text-ink motion-reduce:animate-none" aria-hidden />
      <span className="text-stone-900">{label}</span>
      <span className="tabular-nums">{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</span>
    </div>
  )
}
