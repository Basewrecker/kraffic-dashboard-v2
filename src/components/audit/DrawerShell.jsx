import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import SheetHandle, { SHEET_BASE, SHEET_FOOTER_PAD, SHEET_IN, SHEET_OUT } from '../ui/SheetHandle'
import { ArrowUpRight, X } from 'lucide-react'
import { closeDrawer, useParams } from './parts'
import ErrorBoundary from '../ui/ErrorBoundary'

// Right-hand detail drawer shared by /audit (?check=, ?page=) and /structured-data (?schema=): same shell as the
// Sync / Engine drawers (scrim, 250ms slide, focus trap, Esc / click-outside close, focus back to the opener).
//   const drawer = useDrawer('check', checkById)   → { item, open, shown, close, panel }
//   <DrawerShell drawer={drawer} title meta footer>{body}</DrawerShell>
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
let handoff = null // the first drawer's opener, kept when one drawer swaps in for another

export function useDrawer(key, find) {
  const q = useParams()
  const id = q.get(key)
  const live = id ? find(id) : null
  // keep the last item on screen while the panel slides out
  const [item, setItem] = useState(live)
  useEffect(() => { if (live) setItem(live) }, [live])
  const open = Boolean(live)
  const [shown, setShown] = useState(false)
  const panel = useRef(null)
  const opener = useRef(null)

  useLayoutEffect(() => {
    if (!open) { setShown(false); return }
    opener.current = opener.current ?? document.activeElement
    const r = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(r)
  }, [open])
  useEffect(() => { if (open && shown) panel.current?.focus() }, [open, shown, id])
  useEffect(() => {
    if (open || !item) return
    const t = setTimeout(() => {
      setItem(null)
      // swapped for another drawer: leave focus there and hand it our opener; else focus goes back to the opener
      // (or, if that was inside a drawer that's gone, to the opener that drawer handed over)
      const other = [...document.querySelectorAll('[role=dialog]')].some((d) => d !== panel.current)
      if (other) handoff = opener.current
      else { (opener.current?.isConnected ? opener.current : handoff)?.focus?.({ preventScroll: true }); handoff = null }
      opener.current = null
    }, reduced() ? 0 : 250)
    return () => clearTimeout(t)
  }, [open, item])
  const close = useCallback(() => closeDrawer(key), [key])
  return { item, open, shown: open && shown, close, panel }
}

export default function DrawerShell({ drawer, title, meta, footer, children }) {
  const { shown, close, panel } = drawer
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'Tab') {
      const f = [...panel.current.querySelectorAll('button:not([disabled]), a[href]')].filter((el) => el.offsetParent !== null)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }
  return (
    <div className="fixed inset-0 z-50" onKeyDown={onKeyDown}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity duration-[250ms] ease-out motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`} onClick={close} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-drawer-title"
        tabIndex={-1}
        className={`${SHEET_BASE} md:w-[min(560px,100vw)] ${shown ? SHEET_IN : SHEET_OUT}`}
      >
        <SheetHandle panelRef={panel} onClose={close} />
        <header className="shrink-0 border-b border-line px-4 pb-4 pt-2 md:px-6 md:pt-5">
          <div className="flex items-start justify-between gap-3">
            <h2 id="detail-drawer-title" className="min-w-0 text-[20px] leading-7 font-semibold text-stone-900">{title}</h2>
            <button type="button" onClick={close} aria-label="Close"
              className="-mr-1 grid h-10 w-10 md:h-7 md:w-7 shrink-0 place-items-center rounded-md text-stone-600 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
              <X size={16} />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] leading-[18px] text-stone-600 tabular-nums">{meta}</div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 md:px-6"><ErrorBoundary name={`Drawer · ${title}`}>{children}</ErrorBoundary></div>
        {footer && <footer className={`flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line px-4 pt-3 text-[13px] leading-[18px] text-stone-600 md:px-6 ${SHEET_FOOTER_PAD}`}>{footer}</footer>}
      </div>
    </div>
  )
}

export const Dot = () => <span className="text-stone-400" aria-hidden>·</span>
export const SectionTitle = ({ children }) => <h3 className="mt-6 text-[14px] leading-5 font-semibold text-stone-900">{children}</h3>
export function Steps({ items }) {
  return (
    <ol className="mt-2 flex flex-col gap-2">
      {items.map((s, i) => (
        <li key={i} className="flex gap-3 text-[14px] leading-[22px] text-stone-900">
          <span className="w-4 shrink-0 text-right text-stone-500 tabular-nums">{i + 1}.</span>
          <span className="min-w-0">{s}</span>
        </li>
      ))}
    </ol>
  )
}
// page paths as rows that open the live page (ArrowUpRight on hover)
export function PageList({ domain, paths }) {
  return (
    <ul className="mt-2 divide-y divide-[var(--div)] border-y border-[var(--div)]">
      {paths.map((p) => (
        <li key={p}>
          <a href={`https://${domain}${p}`} target="_blank" rel="noreferrer"
            className="group -mx-2 flex h-10 items-center gap-2 rounded-md px-2 outline-none transition-colors duration-150 hover:bg-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
            <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] text-stone-600 group-hover:text-stone-900">{p}</span>
            <ArrowUpRight size={14} className="shrink-0 text-stone-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100 touch:opacity-100 group-focus-visible:opacity-100" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
