import { useEffect, useId, useRef, useState } from 'react'
import { Clock, Loader2, MoreHorizontal, Plus } from 'lucide-react'
import { PrimaryButton, useToast } from '../../components/dashboard/overlays'
import Segmented from '../../components/dashboard/Segmented'
import ActionMenu from '../../components/audit/ActionMenu'
import { CardError } from '../../components/ui/CardState'
import SiteLogo from '../../components/ui/SiteLogo'
import { Confirm } from '../trends/parts'
import { fieldCls, t3, textBtn } from '../../components/firstSetup/ui'
import { brand } from '../../store/workspace'
import { TEAM_STATES, firstName, initialState, initials, isEmail, lastActive, seedMembers, sentAgo, teamApi } from './team'

// /team (Settings → Team): who can open the current brand. Graphite only: no pills, no hues, no uppercase.
//   Invite      one block: title · Name | Email | Send invite · helper. Enter sends; the button waits for a valid email.
//   Members     "Members 2 · 1 pending" + an avatar stack (max 4, +N, and a dashed + that jumps to the Email field).
//               Rows: initials · name + email · last active (or the pending status + Resend) · Owner (plain text) or ⋯.
//               ⋯ = Remove from team (the app's Confirm) on members, Revoke invite (Undo toast) on pending rows.
//   Motion      a new invite slides in at the top with a fading tint; revoked / removed rows collapse (index.css team-row-*).
// PORT NOTE: "last active" is fake here; production may not track it (lastActive() returns null → nothing shown).

const Spinner = (props) => <Loader2 {...props} className="animate-spin motion-reduce:animate-none" />
const card = 'rounded-[14px] border border-line bg-surface' // no overflow-hidden: the ⋯ menu on the last row must not clip
const label = 'mb-1.5 block text-[13px] leading-[18px] font-medium text-stone-900'
const iconBtn = 'grid h-8 w-8 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 ease-out hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus aria-expanded:bg-tint aria-expanded:text-stone-900'
const meta = `text-[12.5px] leading-[18px] ${t3} tabular-nums`
const line = 'animate-pulse rounded-md bg-tint motion-reduce:animate-none'
const statusFor = (mode) => (mode === 'loading' ? 'loading' : mode === 'error' ? 'error' : 'ready')
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function TeamPage() {
  useEffect(() => { document.title = 'Team · Kraffic' }, [])
  const [mode, setMode] = useState(initialState) // ?mock= / the dev switcher
  const [status, setStatus] = useState(() => statusFor(mode))
  // the mock's data is instant (like every page); the delays are in teamApi, for actions and Retry
  const [members, setMembers] = useState(() => (statusFor(mode) === 'ready' ? seedMembers(mode) : []))
  const [fresh, setFresh] = useState(null) // the invite that just arrived (slides in)
  const [leaving, setLeaving] = useState({}) // rows collapsing out
  const [ask, setAsk] = useState(null) // the confirm dialog
  const [busy, setBusy] = useState({}) // { [id]: 'resend' } while a row's action runs
  const [toastNode, toast] = useToast({ position: 'center' })
  const emailRef = useRef(null)

  const switchTo = (m) => {
    setMode(m)
    const url = new URL(window.location.href)
    url.searchParams.set('mock', m)
    window.history.replaceState(window.history.state, '', url)
    setStatus(statusFor(m))
    setMembers(statusFor(m) === 'ready' ? seedMembers(m) : [])
  }

  const retry = () => {
    setStatus('loading')
    teamApi.load('normal').then((list) => { setMembers(list); setStatus('ready') }, () => setStatus('error'))
  }

  // the dashed + and the empty state: bring the Email field into view and type there
  const focusInvite = () => {
    const el = emailRef.current
    if (!el) return
    el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' })
    el.focus({ preventScroll: true })
  }

  const add = (m) => { setMembers((ms) => [m, ...ms]); setFresh(m.id); toast(`Invite sent to ${m.email}`) }

  const resend = (m) => {
    setBusy((b) => ({ ...b, [m.id]: 'resend' }))
    teamApi.resend(m).then((sentAt) => {
      setMembers((ms) => ms.map((x) => (x.id === m.id ? { ...x, sentAt } : x)))
      setBusy(({ [m.id]: _done, ...rest }) => rest)
      toast(`Invite resent to ${m.email}`)
    })
  }

  // collapse the row (200ms), then drop it
  const drop = (m, then) => {
    setLeaving((l) => ({ ...l, [m.id]: true }))
    setTimeout(() => {
      setMembers((ms) => ms.filter((x) => x.id !== m.id))
      setLeaving(({ [m.id]: _gone, ...rest }) => rest)
      then?.()
    }, reduced() ? 0 : 200)
  }
  // revoking can be undone (the app's Undo toast); removing someone with access asks first
  const revoke = (m) => {
    const at = members.indexOf(m)
    drop(m, () => toast(`Invite to ${m.email} revoked`, { duration: 5000, action: { label: 'Undo', onClick: () => setMembers((ms) => [...ms.slice(0, at), m, ...ms.slice(at)]) } }))
  }
  const remove = (m) => setAsk({
    title: `Remove ${firstName(m)}?`,
    body: `They’ll lose access to ${brand.name} immediately.`,
    confirmLabel: 'Remove',
    onConfirm: () => drop(m, () => toast(`${m.name || m.email} removed from ${brand.name}`)),
  })

  const active = members.filter((m) => m.status === 'active').length
  const pending = members.length - active
  const devBar = import.meta.env.DEV && new URLSearchParams(window.location.search).get('devbar') !== '0'

  return (
    <div className="flex w-full max-w-[880px] flex-col gap-3 md:gap-4">
      <header>
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-stone-900 lg:text-h1">Team</h1>
        <p className="mt-2 flex items-center gap-2.5 text-[13px] leading-[18px] text-stone-600 lg:text-[14px] lg:leading-5">
          {/* the brand switcher's tile (28px) */}
          <SiteLogo domain={brand.domain} name={brand.name} className="h-7 w-7 rounded-md" imgPad="p-0.5" initialClass="text-[12px]" plate />
          People who can access {brand.name}.
        </p>
      </header>

      <InviteCard members={members} disabled={status !== 'ready'} onInvited={add} emailRef={emailRef} />

      <section aria-labelledby="members-title" aria-busy={status === 'loading' || undefined} className={card}>
        <header className="flex min-h-[60px] items-center justify-between gap-4 border-b border-[var(--div)] px-5 py-3">
          <h2 id="members-title" className="text-[15px] leading-5 font-semibold text-stone-900">
            Members
            {status === 'ready' && (
              <span className="ml-1.5 text-[13px] font-normal tabular-nums">
                <span className="text-stone-600">{active}</span>
                {pending > 0 && <span className={t3}> · {pending} pending</span>}
              </span>
            )}
          </h2>
          {status === 'ready' && <AvatarStack members={members} onInvite={focusInvite} />}
        </header>

        {status === 'loading' && <Skeleton />}
        {status === 'error' && <CardError className="rounded-t-none border-0" message="We couldn’t load your team. The server didn’t answer in time." onRetry={retry} />}
        {status === 'ready' && (
          <>
            <ul className="divide-y divide-[var(--div)]">
              {members.map((m) => (
                <MemberRow key={m.id} m={m} fresh={m.id === fresh} leaving={leaving[m.id]} busy={busy[m.id]}
                  onResend={() => resend(m)} onRevoke={() => revoke(m)} onRemove={() => remove(m)} />
              ))}
            </ul>
            {members.length === 1 && <EmptyState onInvite={focusInvite} />}
          </>
        )}
      </section>

      <Confirm ask={ask} onClose={() => setAsk(null)} />
      {toastNode}
      {/* dev builds only: flip between the page's states (?devbar=0 hides it) */}
      {devBar && (
        <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-xl border border-line bg-raised p-1.5 pl-3 shadow-md lg:left-[264px]">
          <span className={`text-[12px] leading-4 font-medium ${t3}`}>Dev</span>
          <Segmented label="Preview state" size="sm" value={mode} onChange={switchTo} options={TEAM_STATES} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- invite

function InviteCard({ members, disabled, onInvited, emailRef }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const nameRef = useRef(null)
  const ids = { title: useId(), name: useId(), email: useId(), help: useId(), err: useId() }

  const valid = isEmail(email)
  const taken = valid && members.find((m) => m.email.toLowerCase() === email.trim().toLowerCase())
  const error = !taken ? null : taken.status === 'pending' ? 'Already invited. Resend it from the list below.' : 'Already a member of this team'
  const canSend = valid && !error && !sending && !disabled

  // Enter in either field sends; nothing happens until the email is valid (and it can't fire twice)
  const submit = (e) => {
    e.preventDefault()
    if (!canSend) return
    setSending(true)
    teamApi.invite({ name, email }).then((m) => {
      setSending(false)
      setName('')
      setEmail('')
      onInvited(m)
      requestAnimationFrame(() => nameRef.current?.focus())
    })
  }

  return (
    <section aria-labelledby={ids.title} className={`${card} px-5 pb-4 pt-4`}>
      <h2 id={ids.title} className="text-[15px] leading-5 font-semibold text-stone-900">Invite a teammate</h2>
      <form noValidate onSubmit={submit} className="mt-3">
        <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_auto] md:items-start">
          <div>
            <label htmlFor={ids.name} className={label}>Name <span className={`font-normal ${t3}`}>(optional)</span></label>
            <input ref={nameRef} id={ids.name} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder="Sam Taylor"
              readOnly={sending} className={`${fieldCls} max-md:h-10 read-only:opacity-60`} />
          </div>
          <div>
            <label htmlFor={ids.email} className={label}>Email</label>
            <input ref={emailRef} id={ids.email} type="email" inputMode="email" autoComplete="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="sam@example.com" readOnly={sending} aria-invalid={Boolean(error)} aria-describedby={error ? `${ids.err} ${ids.help}` : ids.help}
              className={`${fieldCls} max-md:h-10 read-only:opacity-60 ${error ? '!border-negative focus:!ring-[color-mix(in_srgb,var(--negative)_15%,transparent)]' : ''}`} />
            {error && <span id={ids.err} role="alert" className="mt-1.5 block text-[12px] leading-4 text-negative">{error}</span>}
          </div>
          {/* lines up with the inputs: their label is 18px + 6px. Disabled = the ink button at 40% (PrimaryButton) */}
          <div className="md:pt-6 max-md:[&>button]:h-10 max-md:[&>button]:w-full max-md:[&>button]:justify-center">
            <PrimaryButton size="sm" type="submit" disabled={!canSend} aria-busy={sending || undefined} icon={sending ? Spinner : undefined}>
              {sending ? 'Sending…' : 'Send invite'}
            </PrimaryButton>
          </div>
        </div>
        <p id={ids.help} className={`mt-2 ${meta}`}>They’ll get an email to set their own password.</p>
      </form>
    </section>
  )
}

// ---------------------------------------------------------------- members

function Avatar({ m, size = 'md' }) {
  const pending = m.status === 'pending'
  const box = size === 'sm' ? 'h-6 w-6 text-[9px] tracking-normal ring-2 ring-page' : 'h-9 w-9 text-[12px] tracking-[0.02em]'
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full leading-none font-semibold ${box} ${pending ? `border border-dashed border-stone-300 bg-surface ${t3}` : 'bg-[color-mix(in_srgb,var(--ink)_7%,var(--color-surface))] text-stone-700'}`}>
      {initials(m)}
    </span>
  )
}

// up to 4 faces, then +N, then a dashed + that jumps to the invite's Email field
function AvatarStack({ members, onInvite }) {
  const shown = members.slice(0, 4)
  const more = members.length - shown.length
  return (
    <div className="flex items-center">
      {/* earlier faces sit on top, so the overlap covers the next face's edge, not its letters */}
      <span className="flex -space-x-1" title={members.map((m) => m.name || m.email).join(', ')}>
        {shown.map((m, i) => <span key={m.id} className="relative" style={{ zIndex: shown.length - i }}><Avatar m={m} size="sm" /></span>)}
        {more > 0 && <span aria-hidden className="grid h-6 min-w-6 place-items-center rounded-full bg-tint px-1 text-[10px] leading-none font-semibold text-stone-600 tabular-nums ring-2 ring-page">+{more}</span>}
      </span>
      <button type="button" onClick={onInvite} aria-label="Invite a teammate"
        className={`ml-1.5 grid h-6 w-6 place-items-center rounded-full border border-dashed border-stone-300 ${t3} outline-none transition-[transform,color,border-color] duration-150 ease-out hover:border-stone-400 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus motion-safe:hover:scale-110`}>
        <Plus size={12} aria-hidden />
      </button>
    </div>
  )
}

// the app's warning tone: graphite (a quiet clock + t3 text), no hue
const Pending = ({ sentAt }) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${meta}`}>
    <Clock size={13} aria-hidden />Invite pending · sent {sentAgo(sentAt)}
  </span>
)

function MemberRow({ m, fresh, leaving, busy, onResend, onRevoke, onRemove }) {
  const pending = m.status === 'pending'
  const owner = m.role === 'owner'
  const who = m.name || m.email
  const seen = !pending && lastActive(m)
  const menu = pending ? [{ label: 'Revoke invite', danger: true, onClick: onRevoke }]
    : !owner && !m.you ? [{ label: 'Remove from team', danger: true, onClick: onRemove }] : null
  const resendBtn = pending && (
    <button type="button" onClick={onResend} disabled={Boolean(busy)} aria-label={`Resend invite to ${m.email}`} className={textBtn}>
      {busy === 'resend' ? <><Spinner size={12} aria-hidden />Sending…</> : 'Resend'}
    </button>
  )
  const anim = leaving ? 'team-row-out' : fresh ? 'team-row-in' : ''
  // the collapse starts from the row's own height (rows are taller on phones)
  const ref = useRef(null)
  const style = leaving && ref.current ? { '--row-h': `${ref.current.offsetHeight}px` } : undefined
  return (
    <li ref={ref} style={style} className={`${anim} flex flex-wrap items-center gap-x-3 px-5 py-3 transition-colors duration-150 ease-out last:rounded-b-[14px] hover:bg-[var(--subtle-bg)] has-[:focus-visible]:bg-[var(--subtle-bg)] motion-reduce:transition-none md:min-h-[64px]`}>
      <Avatar m={m} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`truncate text-[14px] leading-5 font-medium ${m.name ? 'text-stone-900' : 'text-stone-700'}`}>{who}</span>
          {m.you && <span className="shrink-0 rounded bg-tint px-1.5 text-[11px] leading-[18px] font-medium text-stone-600">You</span>}
        </div>
        {m.name && <span className="block truncate text-[12.5px] leading-[18px] text-stone-600">{m.email}</span>}
        {/* phones: last active under the email */}
        {seen && <span className={`block md:hidden ${meta}`}>{seen}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {/* desktop: last active, or the invite's status + Resend, right-aligned before the ⋯ column */}
        {seen && <span className={`hidden md:inline ${meta}`}>{seen}</span>}
        {pending && <span className="hidden items-center gap-4 md:flex"><Pending sentAt={m.sentAt} />{resendBtn}</span>}
        {/* one column for "Owner" and every ⋯, so they line up */}
        <span className="flex w-12 justify-end [&>div]:-mr-2">
          {owner ? <span className={`text-[13px] leading-[18px] ${t3}`}>Owner</span>
            : menu ? (
              <ActionMenu label={`Actions for ${who}`} className={iconBtn} items={menu}>
                <MoreHorizontal size={16} aria-hidden />
              </ActionMenu>
            ) : null}
        </span>
      </div>
      {/* phones: the invite's status and Resend on their own line, past the avatar */}
      {pending && (
        <div className="mt-1 flex basis-full flex-wrap items-center gap-x-4 gap-y-1 pl-12 md:hidden">
          <Pending sentAt={m.sentAt} />
          {resendBtn}
        </div>
      )}
    </li>
  )
}

// just the owner: three avatar outlines and the way to invite (focuses the Email field)
function EmptyState({ onInvite }) {
  return (
    <button type="button" onClick={onInvite}
      className="flex w-full flex-col items-center gap-3 rounded-b-[14px] border-t border-[var(--div)] px-5 pb-8 pt-7 text-center outline-none transition-colors duration-150 ease-out hover:bg-[var(--subtle-bg)] focus-visible:bg-[var(--subtle-bg)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus motion-reduce:transition-none">
      <svg width="88" height="40" viewBox="0 0 88 40" fill="none" aria-hidden className={t3}>
        {[18, 44, 70].map((cx, i) => (
          <g key={cx} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray={i === 1 ? undefined : '3 3'}>
            <circle cx={cx} cy="20" r="17" className="fill-surface" />
            <circle cx={cx} cy="16" r="5" />
            <path d={`M${cx - 9} 30.5c1.6-4.2 5-6.5 9-6.5s7.4 2.3 9 6.5`} />
          </g>
        ))}
      </svg>
      <span>
        <span className="block text-[14px] leading-5 font-medium text-stone-900">Just you so far.</span>
        <span className="mt-0.5 block text-[13px] leading-[18px] text-stone-600">Invite a teammate to share this dashboard.</span>
      </span>
    </button>
  )
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading your team">
      <ul aria-hidden className="divide-y divide-[var(--div)]">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-3 px-5 py-3 md:min-h-[64px]">
            <span className={`${line} h-9 w-9 shrink-0 !rounded-full`} />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className={`${line} h-3.5 max-w-full`} style={{ width: [128, 112, 144][i] }} />
              <span className={`${line} h-3 max-w-full`} style={{ width: [168, 152, 180][i] }} />
            </span>
            <span className={`${line} h-3 w-20 shrink-0 max-md:hidden`} />
            <span className="w-12 shrink-0" />
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading your team</span>
    </div>
  )
}
