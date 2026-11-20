import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowLeft, Check, Info, Settings, X } from 'lucide-react'
import { setParams, useParams } from '../components/audit/parts'
import { Favicon } from '../components/dashboard/overlays'
import { PlatformIcon } from '../components/dashboard/icons'
import { MenuSelect } from '../components/dashboard/PageHeader'
import Logo from '../components/ui/Logo'
import Switch from '../components/ui/Switch'
import { navigate } from '../router'
import { account, workspaceUser } from '../data/mock'
import { NOW, dayLabel, feed } from './feed'
import { TYPES } from './samples'

// Notification centre (owner, 2026-11-20, after a Dribbble reference). The trigger is the sidebar footer's
// "Notifications" row (Sidebar.jsx NotificationsRow), with a red unread pill. It opens a card to the right of the
// sidebar, 8px off, bottom-aligned with the row and growing upward (phones: across the bottom of the screen):
// "Notifications" + a gear (settings), All / Unread tabs and "Mark all as read", then the items. Each item: a 36px
// tile (the engine / competitor / site logo for data, a check / warning / info icon for system, our logo for updates)
// with a green dot while unread; one sentence (names and numbers bold) and its change in green / red; the date under
// it; buttons only for a real action. One scan's changes are one item that expands inline. ?inbox=all|unread|settings.
// ?nc=empty: nothing to show.
const KEY = 'inbox'
const VIEWS = ['all', 'unread', 'settings']
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ---- read, dismissed and switched-off state, per user and brand (the server keeps the same: rows per user, brand, item)
const scope = `${workspaceUser.email}:${account.domain}`
const readKey = `auden:notifications:read:${scope}`
const offKey = `auden:notifications:off:${scope}`
const dismissedKey = `auden:notifications:dismissed:${scope}`
const listeners = new Set()
const SEED_BEFORE = '2026-10-14' // the mock starts with everything older than this already read
const load = (key, fallback) => { try { const v = localStorage.getItem(key); if (v) return new Set(JSON.parse(v)) } catch { /* private window */ } return fallback() }
let readSet = load(readKey, () => new Set(feed().filter((i) => i.at < SEED_BEFORE).map((i) => i.id)))
let offSet = load(offKey, () => new Set())
let dismissedSet = load(dismissedKey, () => new Set())
const persist = (key, set) => { try { localStorage.setItem(key, JSON.stringify([...set])) } catch { /* private window */ } listeners.forEach((l) => l()) }
const markRead = (ids) => { readSet = new Set([...readSet, ...ids]); persist(readKey, readSet) }
const dismiss = (id) => { dismissedSet = new Set([...dismissedSet, id]); markRead([id]); persist(dismissedKey, dismissedSet) }
const setOff = (type, off) => { offSet = new Set(offSet); if (off) offSet.add(type); else offSet.delete(type); persist(offKey, offSet) }
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
function useInbox() {
  const read = useSyncExternalStore(subscribe, () => readSet, () => readSet)
  const off = useSyncExternalStore(subscribe, () => offSet, () => offSet)
  const gone = useSyncExternalStore(subscribe, () => dismissedSet, () => dismissedSet)
  const items = feed()
  return useMemo(() => {
    const list = items.filter((i) => !off.has(i.type) && !gone.has(i.id)).map((i) => ({ ...i, unread: !read.has(i.id) }))
    return { list, unread: list.filter((i) => i.unread) }
  }, [items, read, off, gone])
}

const close = () => setParams({ [KEY]: null })

// ---------------------------------------------------------------- the sidebar row's state
// The unread count (counting up once when new items arrive, from the last count this tab showed; reduced motion: no
// count-up), whether the card is open (the row keeps its hover fill) and a toggle.
export function useNotificationsEntry() {
  const { unread } = useInbox()
  const n = unread.length
  const [shown, setShown] = useState(() => { try { return Number(sessionStorage.getItem('auden:notifications:shown') ?? 0) } catch { return 0 } })
  useEffect(() => {
    if (shown === n) return
    if (reduced() || n < shown) { setShown(n); return }
    let v = shown
    const t = setInterval(() => { v += 1; setShown(v); if (v >= n) clearInterval(t) }, Math.max(40, 420 / Math.max(1, n - shown)))
    return () => clearInterval(t)
  }, [n]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { sessionStorage.setItem('auden:notifications:shown', String(shown)) } catch { /* private window */ } }, [shown])
  const open = VIEWS.includes(useParams().get(KEY))
  return { unread: n, shown: Math.min(shown, n), open, toggle: () => (open ? close() : setParams({ [KEY]: 'all' })) }
}

// the sidebar row's unread pill: the Beta tag's height, radius and type; red, white semibold; "9+" above 9
export const UnreadPill = ({ n, className = '' }) => (
  <span aria-hidden className={`inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--nc-badge)] px-1.5 text-[11px] leading-none font-semibold text-white tabular-nums ${className}`}>
    {n > 9 ? '9+' : n}
  </span>
)

// ---------------------------------------------------------------- an item's parts
// segments: B → semibold ink; plain → secondary. Read items keep the same contrast (only the dot goes)
const Text = ({ parts }) => parts.map((s, i) => (typeof s === 'string'
  ? <span key={i}>{s}</span>
  : <span key={i} className="font-semibold text-stone-900">{s.b}</span>))
const toneCls = (good) => (good === true ? 'text-[var(--wc-rest-up)]' : good === false ? 'text-[var(--wc-rest-down)]' : 'text-stone-500')
const soft = 'bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]' // the tile and the secondary button (one step up, both themes)

// 36px rounded square: the logo (data), a check / warning / info icon (system; red when the user has to act), our logo
// (updates). A green dot on its corner while unread.
function Tile({ item, mark = item.mark, unread }) {
  let inner
  if (item.kind === 'update') inner = <Logo size={22} />
  else if (item.kind === 'system') {
    const Icon = item.urgent || item.icon === 'warn' ? AlertTriangle : item.icon === 'done' ? Check : Info
    inner = <Icon size={18} strokeWidth={2} aria-hidden className={item.urgent ? 'text-negative' : 'text-stone-600'} />
  } else if (mark?.engine && mark?.domain) {
    inner = (
      <span className="relative">
        <Favicon domain={mark.domain} size={20} />
        <span className="absolute -bottom-1.5 -right-2 grid h-4 w-4 place-items-center rounded-full bg-[var(--color-raised)]"><PlatformIcon id={mark.engine} size={12} /></span>
      </span>
    )
  } else if (mark?.engine) inner = <PlatformIcon id={mark.engine} size={20} />
  else if (mark?.domain) inner = <Favicon domain={mark.domain} size={20} />
  else inner = <Info size={18} strokeWidth={2} aria-hidden className="text-stone-600" />
  return (
    <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${item.urgent ? 'bg-[color-mix(in_srgb,var(--negative)_12%,transparent)]' : soft}`}>
      {inner}
      {unread && <span aria-hidden className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--nc-unread)] ring-2 ring-[var(--color-raised)]" />}
    </span>
  )
}

// the date under the sentence: "Today, 9:00 AM", "Yesterday, 2:00 PM", "Oct 20"
function when(iso) {
  const d = dayLabel(iso)
  const t = new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
  return d === 'Today' || d === 'Yesterday' ? `${d}, ${t}` : `${d}, ${iso.slice(0, 4) === NOW.slice(0, 4) ? '' : iso.slice(0, 4)}`.replace(/, $/, '')
}

// buttons only for a real action: primary (ink fill; white in dark mode) + Dismiss, or one secondary
const ACTIONS = {
  connection: [{ label: 'Reconnect', primary: true }, { label: 'Dismiss', dismiss: true }],
  'new-brand': [{ label: 'Track as competitor', primary: true }, { label: 'Dismiss', dismiss: true }],
  'rising-search': [{ label: 'Track this prompt', primary: true }, { label: 'Dismiss', dismiss: true }],
  'report-ready': [{ label: 'View report' }],
  'draft-waiting': [{ label: 'Open draft' }],
  'run-failed': [{ label: 'Run again' }],
  limit: [{ label: 'See plan' }],
  'getting-started': [{ label: 'Continue' }],
}
const btn = 'inline-flex h-9 items-center rounded-lg px-3.5 text-[14px] leading-5 font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus active:scale-[.98]'
const primaryBtn = `${btn} bg-ink text-on-ink hover:bg-ink-hover`
const secondaryBtn = `${btn} ${soft} text-stone-900 hover:bg-[color-mix(in_srgb,var(--ink)_12%,transparent)]`

function Item({ item, i, onGo }) {
  const [expanded, setExpanded] = useState(false)
  const burst = item.children?.length > 1
  const actions = ACTIONS[item.type] ?? []
  const delta = !burst && item.kind === 'data' && item.delta
  return (
    <li className={i < 8 ? 'nc-item' : undefined} style={{ '--i': i }}>
      <div className="flex gap-3.5 px-6 py-4">
        <button type="button" onClick={onGo} tabIndex={-1} aria-hidden className="shrink-0 self-start outline-none"><Tile item={item} unread={item.unread} /></button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onGo} className="-m-1 block rounded-md p-1 text-left outline-none transition-opacity duration-150 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-focus">
            {item.unread && <span className="sr-only">Unread. </span>}
            <span className="block text-[14.5px] leading-[21px] text-stone-600">
              <Text parts={item.text} />
              {delta && <span className={`whitespace-nowrap font-semibold tabular-nums ${toneCls(item.delta.good)}`}> · {item.delta.text}</span>}
            </span>
            <span className="mt-1 block text-[13px] leading-[18px] text-stone-500 tabular-nums">{when(item.at)}</span>
          </button>
          {burst && expanded && (
            <ul className="mt-3 flex flex-col gap-2.5 border-l border-line pl-3">
              {item.children.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={onGo} className="flex w-full items-start gap-2.5 rounded-md text-left outline-none transition-opacity duration-150 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-focus">
                    <span className="mt-px grid h-5 w-5 shrink-0 place-items-center">{c.mark?.engine ? <PlatformIcon id={c.mark.engine} size={16} /> : <Favicon domain={c.mark?.domain ?? account.domain} size={16} />}</span>
                    <span className="min-w-0 flex-1 text-[13.5px] leading-5 text-stone-600"><Text parts={c.text} /></span>
                    {c.delta && <span className={`shrink-0 text-[13px] leading-5 font-semibold tabular-nums ${toneCls(c.delta.good)}`}>{c.delta.text}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(burst || actions.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {burst && (
                <button type="button" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} className={secondaryBtn}>
                  {expanded ? 'Hide changes' : `Show ${item.children.length} changes`}
                </button>
              )}
              {actions.map((a) => (
                <button key={a.label} type="button" onClick={a.dismiss ? () => dismiss(item.id) : onGo}
                  className={a.primary ? primaryBtn : secondaryBtn}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------- the card
export function NotificationCard() {
  const view = useParams().get(KEY)
  const open = VIEWS.includes(view)
  const { list, unread } = useInbox()
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const [pos, setPos] = useState(null)
  const card = useRef(null)
  const anchor = () => [...document.querySelectorAll('[data-nav-notifications]')].find((el) => el.offsetParent !== null)

  // in: mount, place, then fade + scale from the row's side (220ms); out: 150ms, then unmount
  useEffect(() => {
    if (open) { setMounted(true); const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true))); return () => cancelAnimationFrame(r) }
    setShown(false)
    const t = setTimeout(() => setMounted(false), reduced() ? 0 : 150)
    return () => clearTimeout(t)
  }, [open])
  useLayoutEffect(() => {
    if (!mounted) return
    const place = () => {
      const a = anchor()
      const wide = window.innerWidth >= 1024
      if (!a || !wide) { setPos({ phone: true }); return }
      const r = a.getBoundingClientRect()
      const edge = a.closest('aside')?.getBoundingClientRect().right ?? r.right // 8px past the sidebar's edge
      setPos({ left: edge + 8, bottom: Math.max(8, window.innerHeight - r.bottom) })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [mounted])
  // click outside / Esc closes (Esc hands focus back to the row)
  useEffect(() => {
    if (!open) return
    const down = (e) => { if (card.current?.contains(e.target) || e.target.closest?.('[data-nav-notifications]')) return; close() }
    const key = (e) => { if (e.key === 'Escape') { close(); anchor()?.focus() } }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key) }
  }, [open])
  useEffect(() => { if (shown) card.current?.focus({ preventScroll: true }) }, [shown])
  if (!mounted || !pos) return null

  const tab = view === 'unread' ? 'unread' : 'all'
  const shownList = tab === 'unread' ? unread : list
  const go = (item) => { markRead([item.id]); close(); navigate(item.href) }
  const where = pos.phone
    ? { left: 8, right: 8, bottom: 8, maxHeight: '70vh' }
    : { left: pos.left, bottom: pos.bottom, width: 'min(440px, calc(100vw - 24px))', maxHeight: '70vh' }
  const tabCls = (on) => `relative -mb-px inline-flex h-11 items-center gap-2 border-b-2 text-[14.5px] leading-5 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus ${on ? 'border-ink font-medium text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-900'}`

  return createPortal(
    <div ref={card} role="dialog" aria-modal="false" aria-labelledby="nc-title" tabIndex={-1} style={where}
      className={`fixed z-[80] flex flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-[0_16px_48px_-12px_rgba(0,0,0,.28)] outline-none transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transform-none ${
        pos.phone ? 'origin-bottom' : 'origin-bottom-left'
      } ${shown ? 'scale-100 opacity-100' : 'scale-[.98] opacity-0'}`}>
      {view === 'settings' ? (
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          <SettingsView onBack={() => setParams({ [KEY]: 'all' })} onClose={close} />
        </div>
      ) : (
        <>
          <header className="shrink-0 px-6 pt-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id="nc-title" className="text-[18px] leading-6 font-semibold tracking-[-0.01em] text-stone-900">Notifications</h2>
              <button type="button" onClick={() => setParams({ [KEY]: 'settings' })} aria-label="Notification settings" title="Notification settings"
                className="-mr-1.5 grid h-8 w-8 place-items-center rounded-md text-stone-500 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
                <Settings size={18} aria-hidden />
              </button>
            </div>
          </header>
          <div className="mt-2 flex shrink-0 items-end justify-between gap-4 border-b border-line px-6" role="tablist" aria-label="Show">
            <div className="flex gap-6">
              <button type="button" role="tab" aria-selected={tab === 'all'} onClick={() => setParams({ [KEY]: 'all' })} className={tabCls(tab === 'all')}>All</button>
              <button type="button" role="tab" aria-selected={tab === 'unread'} onClick={() => setParams({ [KEY]: 'unread' })} className={tabCls(tab === 'unread')}>
                Unread
                {unread.length > 0 && <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full ${soft} px-1.5 text-[12px] leading-none font-medium text-stone-600 tabular-nums`}>{unread.length}</span>}
              </button>
            </div>
            <button type="button" onClick={() => markRead(list.map((i) => i.id))} disabled={!unread.length}
              className="mb-3 rounded text-[14px] leading-5 text-stone-500 outline-none transition-colors duration-150 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 disabled:hover:text-stone-500">
              Mark all as read
            </button>
          </div>
          {shownList.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className={`grid h-9 w-9 place-items-center rounded-[10px] ${soft} text-stone-600`}><Check size={18} aria-hidden /></span>
              <p className="mt-3 text-[15px] leading-[22px] font-semibold text-stone-900">You’re all caught up.</p>
              <p className="mt-1 text-[13px] leading-[18px] text-stone-500">New changes, scans and updates show up here.</p>
            </div>
          ) : (
            // the last item fades out under the card's edge while there's more to scroll
            <ul key={tab} className="nc-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain py-2 pb-8">
              {shownList.map((item, i) => <Item key={item.id} item={item} i={i} onGo={() => go(item)} />)}
            </ul>
          )}
        </>
      )}
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------- settings (design only: the switches save, thresholds don't yet)
function SettingsView({ onBack, onClose }) {
  const off = useSyncExternalStore(subscribe, () => offSet, () => offSet)
  const [th, setTh] = useState({ score: '2', engine: '2', rival: 'pass', sentiment: 'negative', facts: 'new', clicks: '10' })
  const pick = (k, options) => (
    <MenuSelect value={th[k]} onChange={(v) => setTh((t) => ({ ...t, [k]: v }))} listLabel="Alert when" groups={[{ items: options.map(([id, label]) => ({ id, label })) }]} />
  )
  const rows = [
    ['Visibility score', 'moves by', pick('score', [['2', '2 pts'], ['5', '5 pts'], ['10', '10 pts']])],
    ['An engine’s score', 'moves by', pick('engine', [['2', '2 pts'], ['5', '5 pts'], ['10', '10 pts']])],
    ['A competitor', '', pick('rival', [['pass', 'Passes you or falls behind'], ['any', 'Moves 2 pts or more'], ['off', 'Never']])],
    ['Sentiment', '', pick('sentiment', [['negative', 'A source turns negative'], ['any', 'Any source changes tone'], ['off', 'Never']])],
    ['Fact Check', '', pick('facts', [['new', 'A new wrong fact'], ['off', 'Never']])],
    ['Google clicks', 'move by', pick('clicks', [['10', '10%'], ['25', '25%'], ['off', 'Never']])],
  ]
  const iconBtn = 'grid h-8 w-8 shrink-0 place-items-center rounded-md text-stone-500 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus'
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button type="button" onClick={onBack} className="-ml-1 inline-flex items-center gap-1 rounded px-1 text-[13px] leading-[18px] font-medium text-stone-500 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
            <ArrowLeft size={13} aria-hidden />Notifications
          </button>
          <h2 id="nc-title" className="mt-0.5 text-[18px] leading-6 font-semibold tracking-[-0.01em] text-stone-900">Notification settings</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className={`-mr-1.5 ${iconBtn}`}><X size={16} aria-hidden /></button>
      </header>
      {[['data', 'Data alerts'], ['system', 'System alerts'], ['update', 'Product updates']].map(([k, title]) => (
        <section key={k} className="border-t border-line pt-5">
          <h3 className="text-[14px] leading-5 font-semibold text-stone-900">{title}</h3>
          <ul className="mt-1 divide-y divide-[var(--div)]">
            {TYPES[k].map(([type, label]) => (
              <li key={type} className="flex min-h-11 items-center justify-between gap-4 py-2">
                <span className="text-[14px] leading-5 text-stone-900">{label}</span>
                <Switch checked={!off.has(type)} onChange={(v) => setOff(type, !v)} aria-label={label} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="border-t border-line pt-5">
        <h3 className="text-[14px] leading-5 font-semibold text-stone-900">Alert me when</h3>
        <ul className="mt-1 divide-y divide-[var(--div)]">
          {rows.map(([label, verb, control]) => (
            <li key={label} className="flex min-h-11 items-center justify-between gap-4 py-2">
              <span className="text-[14px] leading-5"><span className="font-medium text-stone-900">{label}</span>{verb && <span className="text-stone-500"> {verb}</span>}</span>
              {control}
            </li>
          ))}
        </ul>
      </section>
      <p className="border-t border-line pt-5 text-[12.5px] leading-[18px] text-stone-500">Saved for you on {account.name}. Changes under 2 pts or 5% never alert. Switching a type off hides its notifications.</p>
    </div>
  )
}
