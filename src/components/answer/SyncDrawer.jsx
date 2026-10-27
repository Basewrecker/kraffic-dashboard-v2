import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import SheetHandle, { SHEET_BASE, SHEET_FOOTER_PAD, SHEET_IN, SHEET_OUT } from '../ui/SheetHandle'
import { ArrowRight, X } from 'lucide-react'
import { ChangeRows, ChangeTabs, EngineChips } from './ChangeParts'
import { ENGINES, getBrandView } from '../../data/brandViews'
import { isoOf, shortDate, slugOf, syncChanges } from '../../data/syncChanges'
import { useBrandView } from '../../hooks/useBrandView'
import { navigate } from '../../router'
import { openAnswer } from './AnswerDrawer'

// Sync history → "Changes on Sep 28": the prompts one sync lost / gained, per engine. Same shell as the Engine drawer.
// openSyncDrawer({ syncId, tab, opener }): tab = 'lost' | 'gained'. URL: ?drawer=sync&date=2026-09-28&tab=lost[&drawerEngine=]
// (pushed, so Back closes it). A row swaps the Answer drawer in for that prompt and sync — never stacks.
const EVENT = 'sync-drawer:open'
export function openSyncDrawer({ syncId, tab = 'lost', opener }) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { syncId, tab, opener } }))
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

function readUrl() {
  const q = new URLSearchParams(window.location.search)
  if (q.get('drawer') !== 'sync' || !q.get('date')) return null
  return { date: q.get('date'), tab: q.get('tab') === 'gained' ? 'gained' : 'lost', engine: q.get('drawerEngine') ?? 'all' }
}
function urlFor(s) {
  const url = new URL(window.location.href)
  for (const k of ['drawer', 'date', 'tab', 'drawerEngine']) url.searchParams.delete(k)
  if (s) {
    url.searchParams.set('drawer', 'sync'); url.searchParams.set('date', s.date); url.searchParams.set('tab', s.tab)
    if (s.engine !== 'all') url.searchParams.set('drawerEngine', s.engine)
  }
  return url
}
const writeUrl = (s) => window.history.replaceState(window.history.state, '', urlFor(s))

export default function SyncDrawer() {
  const view = useBrandView()
  const { focal, syncHistory, total } = view
  const [state, setState] = useState(readUrl) // { date (iso), tab, engine }
  const [shown, setShown] = useState(false)
  const [swapped, setSwapped] = useState(false)
  const pushed = useRef(false)
  const panel = useRef(null)
  const opener = useRef(null)
  const lastRow = useRef(null)

  const open = state != null
  const index = open ? syncHistory.findIndex((r) => isoOf(r.date) === state.date) : -1
  const row = syncHistory[index]
  const prev = syncHistory[index + 1]
  const changes = useMemo(() => syncChanges(row, focal.domain), [row, focal.domain])
  const stats = getBrandView(focal.domain).platforms
  const engines = ENGINES.filter((e) => (stats.find((p) => p.id === e.id)?.visible ?? 0) > 0)
  const engine = open && (state.engine === 'all' || engines.some((e) => e.id === state.engine)) ? state.engine : 'all'
  const tab = state?.tab ?? 'lost'
  const inEngine = (list) => (engine === 'all' ? list : list.filter((x) => x.engine === engine))
  const items = changes ? inEngine(changes[tab]) : []

  useEffect(() => {
    const on = (e) => {
      const r = view.syncHistory.find((x) => x.id === e.detail.syncId)
      if (!r) return
      opener.current = e.detail.opener ?? document.activeElement
      setSwapped(false)
      const next = { date: isoOf(r.date), tab: e.detail.tab, engine: 'all' }
      if (!readUrl()) { window.history.pushState(window.history.state, '', urlFor(next)); pushed.current = true }
      setState(next)
    }
    const pop = () => { pushed.current = false; setSwapped(false); setState(readUrl()) }
    window.addEventListener(EVENT, on)
    window.addEventListener('popstate', pop)
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener('popstate', pop) }
  }, [view.syncHistory])
  useEffect(() => { writeUrl(open && !swapped ? state : null) }, [open, swapped, state])
  useLayoutEffect(() => {
    if (!open) { setShown(false); return }
    const r = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(r)
  }, [open])
  useEffect(() => { if (open && shown && !swapped) panel.current?.focus() }, [open, shown]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(() => {
    if (pushed.current) { pushed.current = false; window.history.back() } else setState(null)
    setSwapped(false)
    opener.current?.focus?.()
  }, [])
  const close = useCallback(() => { setShown(false); setTimeout(finish, reduced() ? 0 : 200) }, [finish])
  const set = (patch) => setState((s) => ({ ...s, ...patch }))

  // a prompt → the Answer drawer stands in for this one, at this sync
  const openPrompt = (it, el) => {
    lastRow.current = el
    setSwapped(true)
    openAnswer({
      key: it.key, engine: it.engine, date: row.date, brand: focal.domain, list: items.map((x) => x.key),
      back: {
        label: `Changes on ${shortDate(row.date)}`,
        onBack: () => { setSwapped(false); requestAnimationFrame(() => (lastRow.current?.isConnected ? lastRow.current : panel.current)?.focus({ preventScroll: true })) },
        onClose: finish,
      },
    })
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.target.closest('[role=tablist]')) {
      const rows = [...panel.current.querySelectorAll('[data-nav]')]
      const i = rows.indexOf(e.target)
      const next = i === -1 ? rows[0] : rows[i + (e.key === 'ArrowDown' ? 1 : -1)]
      if (next) { e.preventDefault(); next.focus() }
    } else if (e.key === 'Tab') {
      const f = [...panel.current.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }

  if (!open || !row) return null
  const chips = [{ id: 'all', name: 'All' }, ...engines]
  const counts = { lost: changes ? inEngine(changes.lost).length : 0, gained: changes ? inEngine(changes.gained).length : 0 }

  return (
    <div className={`fixed inset-0 z-50 ${swapped ? 'invisible' : ''}`} onKeyDown={onKeyDown}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity duration-[250ms] ease-out motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`} onClick={close} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Changes on ${shortDate(row.date)}`}
        tabIndex={-1}
        className={`${SHEET_BASE} md:w-[min(720px,100vw)] ${shown ? SHEET_IN : SHEET_OUT}`}
      >
        <SheetHandle panelRef={panel} onClose={close} />
        <header className="shrink-0 border-b border-line px-6 pb-0 pt-5">
          <div className="flex items-center justify-between gap-3">
            <EngineChips chips={chips} value={engine} onChange={(id) => set({ engine: id })} />
            <button type="button" onClick={close} aria-label="Close"
              className="grid h-7 w-7 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
              <X size={16} />
            </button>
          </div>
          <h2 className="mt-3 text-[20px] leading-7 font-semibold text-stone-900">Changes on {shortDate(row.date)}</h2>
          <p className="mt-0.5 text-[13px] leading-[18px] text-stone-600 tabular-nums">
            {prev ? `Compared with ${shortDate(prev.date)}` : 'First sync in this history'} · {total} prompts{focal.you ? '' : ` · ${focal.name}`}
          </p>
          <ChangeTabs tab={tab} counts={counts} onChange={(id) => set({ tab: id })} />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <ChangeRows items={items} onOpen={openPrompt}
            empty={changes ? `No prompts ${tab} on ${engine === 'all' ? 'any engine' : chips.find((c) => c.id === engine)?.name} this sync` : 'Nothing to compare: this is the first sync here'} />
        </div>

        <footer className={`flex shrink-0 items-center justify-between gap-3 border-t border-line px-4 pt-3 text-[13px] leading-[18px] text-stone-600 md:px-6 ${SHEET_FOOTER_PAD}`}>
          <span className="min-w-0 truncate tabular-nums">{plural(counts[tab], 'prompt')} {tab}{prev ? ` since ${shortDate(prev.date)}` : ''}</span>
          {focal.you && (
            <button type="button" onClick={() => { pushed.current = false; setState(null); navigate(`/tracker?sync=${slugOf(row.date)}&change=${tab}`) }} // Back from there returns here
              className="inline-flex shrink-0 items-center gap-1 rounded font-medium text-stone-700 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
              Open in Prompt Hub <ArrowRight size={12} aria-hidden />
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
