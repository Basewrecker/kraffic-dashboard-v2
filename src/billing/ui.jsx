import { AlertCircle, Loader2 } from 'lucide-react'
import { fullDate, money, shortDate } from './format.js'
import { WORKSPACE } from './state.js'

// Billing's shared pieces. Everything here is an existing pattern restyled with tokens (the brief, "Reuse before
// inventing"): the neutral pill, the Connected pill (the one green element), the underline tabs, the shell banner,
// the inline error with Retry, a button that waits for the server.

// <Pending n="6"> marks an element whose design follows an open decision's recommended default. It draws nothing by
// itself; with ?notes=1 in the address each one is outlined with a small "pending decision N" tag, for the review
// screenshots (index.css: [data-pending]).
export const Pending = ({ n, as: Tag = 'span', className = '', children, ...rest }) => <Tag data-pending={n} className={className} {...rest}>{children}</Tag>

// the value carries the weight; the unit or label around it is regular
export const B = ({ children, className = '' }) => <span className={`font-bold text-stone-900 tabular-nums ${className}`}>{children}</span>

// a date with its full form in the dark tip (hover and keyboard focus)
export function DateTip({ iso, bold = false }) {
  if (!iso) return <span>—</span>
  return (
    <span tabIndex={0} className="group/dt relative inline-block rounded outline-none focus-visible:ring-2 focus-visible:ring-focus">
      <span className={`tabular-nums ${bold ? 'font-bold text-stone-900' : ''}`}>{shortDate(iso)}</span>
      <span role="tooltip" className="tip-dark pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max -translate-x-1/2 font-normal opacity-0 transition-opacity duration-150 group-hover/dt:opacity-100 group-focus-visible/dt:opacity-100">{fullDate(iso)}</span>
    </span>
  )
}
// "$3,500 per month" in a sentence: the amount bold, "per month" in words, regular. Never "/mo" outside a plan card
export const PerMonth = ({ amount }) => <span className="whitespace-nowrap"><B>{money(amount)}</B> per month</span>

// A status. tone: 'neutral' (tint fill, ink-2 text: every status but the two below) · 'active' (the Connected pill:
// green dot, green-tinted fill, the three --connected* tokens; ONLY "Active" and "Connected") · 'overdue' (the
// neutral pill with a red 8px dot before the words)
export function StatusPill({ tone = 'neutral', children, className = '' }) {
  const green = tone === 'active'
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] leading-4 font-medium ${green ? 'bg-[var(--connected-bg)] text-[var(--connected-ink)]' : 'bg-tint text-stone-600'} ${className}`}>
      {green && <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--connected)]" />}
      {tone === 'overdue' && <span aria-hidden className="h-2 w-2 rounded-full bg-negative" />}
      {children}
    </span>
  )
}
// the subscription's status pill, by state (the words clients see)
export function SubStatus({ b }) {
  if (b.status === 'active') return <StatusPill tone="active">Active</StatusPill>
  if (b.status === 'cancelling') return <StatusPill>Cancels {shortDate(b.paidThrough)}</StatusPill>
  if (b.status === 'pastdue') return <StatusPill tone="overdue">Payment overdue</StatusPill>
  if (b.status === 'ended') return <StatusPill>Ended</StatusPill>
  if (b.status === 'demo') return <StatusPill>Demo</StatusPill>
  if (b.status === 'pending') return <StatusPill>Payment processing</StatusPill>
  return null
}

// underline tabs (Site Audit's): ←/→ move, the picked tab has the ink underline
export function Tabs({ tabs, value, onChange, label, id }) {
  const onKey = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const i = tabs.findIndex(([t]) => t === value)
    const next = tabs[(i + step + tabs.length) % tabs.length][0]
    onChange(next)
    requestAnimationFrame(() => document.getElementById(`${id}-tab-${next}`)?.focus())
  }
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} className="flex gap-6 border-b border-line">
      {tabs.map(([t, text]) => (
        <button key={t} type="button" role="tab" id={`${id}-tab-${t}`} aria-controls={`${id}-panel`} aria-selected={value === t} tabIndex={value === t ? 0 : -1} onClick={() => onChange(t)}
          className={`-mb-px inline-flex h-11 shrink-0 items-center whitespace-nowrap border-b-2 text-[14px] leading-5 font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus md:h-10 ${value === t ? 'border-ink text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-900'}`}>
          {text}
        </button>
      ))}
    </div>
  )
}

// The shell banner pattern: one rounded card above the page content, surface fill, hairline border, small text,
// role="status". alert: a red 14px alert icon before the text (the banner itself stays neutral: no red or amber fill)
export function ShellBanner({ alert = false, children, actions, className = '', ...rest }) {
  return (
    <div role="status" className={`flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] leading-[18px] text-stone-600 md:flex-row md:items-center md:gap-4 ${className}`} {...rest}>
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        {alert && <AlertCircle size={14} className="mt-0.5 shrink-0 text-negative" aria-hidden />}
        <div className="min-w-0 flex-1 text-pretty">{children}</div>
      </div>
      {actions && <div className="flex shrink-0 flex-col gap-1.5 md:items-end">{actions}</div>}
    </div>
  )
}

// an inline error: red text with the red alert icon, and Retry when there is something to retry
export function InlineError({ children, onRetry, className = '' }) {
  return (
    <p role="alert" className={`text-[13px] leading-[18px] text-negative text-pretty ${className}`}>
      {/* the icon sits in the line, so a wrapped sentence keeps it beside its first word */}
      <AlertCircle size={14} className="-mt-0.5 mr-1.5 inline shrink-0" aria-hidden />{children}
      {onRetry && <button type="button" onClick={onRetry} className="ml-2 rounded font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">Retry</button>}
    </p>
  )
}

// buttons. Anything that moves money or leaves for the payment page waits for the server: disabled, with a spinner
// and "Opening…" (busy). off: disabled with its reason in the dark tip (hover and keyboard focus)
const BTN = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[14px] leading-5 font-medium outline-none transition-[background-color,border-color,transform] duration-150 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 active:scale-[.98] motion-reduce:transform-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100'
const LOOK = {
  ink: 'bg-ink text-on-ink hover:bg-ink-hover disabled:hover:bg-ink',
  line: 'border border-line bg-surface text-stone-900 hover:border-[var(--color-line-strong)] hover:bg-tint',
  soft: 'border border-line bg-tint text-stone-900 hover:border-[var(--color-line-strong)]',
  quiet: 'text-stone-600 hover:bg-tint hover:text-stone-900',
}
export function Btn({ look = 'ink', size = 'md', busy = false, busyLabel = 'Opening…', off = null, full = false, className = '', children, ...rest }) {
  const cls = `${BTN} ${LOOK[look]} ${size === 'sm' ? 'h-8 px-3 text-[13px]' : size === 'lg' ? 'h-10 px-4' : 'h-9 px-3.5'} ${full ? 'w-full' : ''} ${className}`
  if (off) {
    return (
      <span tabIndex={0} aria-label={`${typeof children === 'string' ? children : ''}. ${off}`} className={`group/off relative inline-flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus ${full ? 'w-full' : ''}`}>
        <button type="button" disabled className={cls}>{children}</button>
        <span role="tooltip" className="tip-dark pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max -translate-x-1/2 font-normal opacity-0 transition-opacity duration-150 group-hover/off:opacity-100 group-focus-visible/off:opacity-100">{off}</span>
      </span>
    )
  }
  return <button type="button" disabled={busy || rest.disabled} className={cls} {...rest}>{busy && <Loader2 size={14} className="animate-spin" aria-hidden />}{busy ? busyLabel : children}</button>
}
// a quiet text link: ink, underline on hover (no coloured links)
export const TextLink = ({ className = '', children, ...rest }) => <button type="button" className={`rounded text-[13px] leading-[18px] font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus ${className}`} {...rest}>{children}</button>

// "Before you pay: renewal terms": the existing three lines, with the price filled in and the workspace's own support
// address (open conflict 4: the old text named a fixed address)
export function RenewalTerms({ price, className = '' }) {
  return (
    <section aria-labelledby="terms-title" className={`rounded-xl border border-line bg-surface px-4 py-3.5 ${className}`}>
      <h3 id="terms-title" className="text-[13px] leading-[18px] font-semibold text-stone-900">Before you pay: renewal terms</h3>
      <ul className="mt-2 flex flex-col gap-1.5 text-[13px] leading-[18px] text-stone-600 text-pretty">
        {/* on the Plans page no plan is picked yet, so the line names no amount; the review step fills it in */}
        <li>Your subscription renews automatically for {price == null ? <>your plan’s price</> : <B>{money(price)}</B>} every month, until you cancel.</li>
        <li>Cancel any time from Billing in your account, or email <Pending n="conflict 4">{WORKSPACE.support}</Pending>. Cancellation stops the next renewal; the current period stays active until it ends.</li>
        <li>You will receive a renewal reminder by email before each charge when required by law.</li>
      </ul>
    </section>
  )
}
// the skeleton block: a pulsing surface card
export const Skeleton = ({ className = '' }) => <div aria-hidden className={`animate-pulse rounded-lg bg-tint motion-reduce:animate-none ${className}`} />

// The split button (as in Connect your data): the main action and a caret that opens the app's menu, two halves that
// share one border. items: ActionMenu's.
import { ChevronDown } from 'lucide-react'
import ActionMenu from '../components/audit/ActionMenu'
export function SplitBtn({ children, onClick, items, busy = false, off = null, menuLabel = 'More ways' }) {
  if (off) return <Btn look="ink" off={off}>{children}</Btn>
  return (
    <span className="inline-flex max-md:w-full">
      <Btn look="ink" busy={busy} onClick={onClick} className="rounded-r-none max-md:flex-1">{children}</Btn>
      <ActionMenu label={menuLabel} items={items} portal disabled={busy}
        className="grid h-9 w-8 place-items-center rounded-r-lg border-l border-[color-mix(in_srgb,var(--on-ink)_25%,transparent)] bg-ink text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 aria-expanded:bg-ink-hover disabled:opacity-50">
        <ChevronDown size={15} aria-hidden />
      </ActionMenu>
    </span>
  )
}
