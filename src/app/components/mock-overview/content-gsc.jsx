// Mock stand-in for the app's components/mock-overview/content-gsc.jsx (synced 2026-11-15): Search Console around the
// Content pages. The "Publishing on …" line is the app's code, unchanged; the picker follows the app's rebuilt one
// (on the shared Modal, sentence-case labels; ported from the handoff of 2026-11-27). The hooks, which in the app
// talk to its server and Google, keep the mock's behaviour: Connect takes 900ms, the properties are samples, nothing
// fails.
import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import Modal from '../../../components/ui/Modal'
import MockSearchMatch, { ConnectSearchConsole as MockConnectSearchConsole, SkippedRow as MockSkippedRow } from '../../../pages/opportunities/workspace/SearchMatch'
import { CO_BRAND, brandScState, pageSourceLabel, sampleProperties, setBrandScState } from '@/lib/mock-adapter-content'

export { EdgeTip, NO_MATCH_TIP, NO_SC_TIP, placeTip } from './content-tip'
export default MockSearchMatch
export const ConnectSearchConsole = MockConnectSearchConsole
export const SkippedRow = MockSkippedRow
// the connect flow's error line: the mock's connect never fails
export const ConnectError = () => null
const setBrandSkipped = (skipped) => setBrandScState(CO_BRAND.domain, skipped ? 'skipped' : 'new')

// the property picker's state (the app: GET / POST its properties route)
export function useGscPropertyPicker(onSaved = () => {}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const openPicker = () => { setOpen(true); setLoading(true); setTimeout(() => { setData(sampleProperties(CO_BRAND.domain)); setLoading(false) }, 300) }
  const closePicker = () => setOpen(false)
  const save = (siteUrl) => { onSaved(siteUrl); setOpen(false) }
  return { open, loading, saving: false, error: null, data, openPicker, closePicker, save }
}
// the older name, with the mock's arguments (the prompt page still calls it this way)
export function usePropertyPicker(load, save = () => {}) {
  const p = useGscPropertyPicker(save)
  return { ...p, onClose: p.closePicker, onSave: p.save }
}

// the Content list's banner: the brand's Search Console state and the connect flow
export function useBrandSearchConsole() {
  const [state, setState] = useState(() => brandScState(CO_BRAND.domain))
  const [siteUrl, setSiteUrl] = useState(`sc-domain:${CO_BRAND.domain}`)
  const [connecting, setConnecting] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const set = (s) => { setBrandScState(CO_BRAND.domain, s); setState(s) }
  const picker = useGscPropertyPicker(setSiteUrl)
  return {
    state, siteUrl, connecting, disconnecting: false, disconnectError: null, connectError: null,
    onConnect: () => { setConnecting(true); timer.current = setTimeout(() => { setConnecting(false); set('connected') }, 900) },
    onDisconnect: () => { picker.closePicker(); set('new') },
    picker,
  }
}

// The property picker (as the app's preview of 2026-11-27, branch fix/gsc-picker-modal): the same content and copy on
// the shared Modal, so it opens and closes with the shared motion. Group labels in sentence case. The property saved
// on the server shows a check and "Saved" in muted text before its permission. Footer: Disconnect (link) left; Cancel
// and "Use another Google account" right.
const pickerLink = 'rounded text-[14px] leading-5 font-medium text-stone-600 underline decoration-[var(--color-line-strong)] underline-offset-[3px] outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60'
export function GscPropertyPicker({ open, loading, saving, error, data, onClose, onSave, onReconnect, onDisconnect = null, disconnecting = false, domain, savedUrl = null }) {
  const matched = data?.matched || []
  const other = data?.other || []
  const host = String(domain || '').replace(/^www\./, '')
  const group = (title, rows) => (
    <div>
      <p className="mb-2 text-[13px] leading-[18px] text-stone-600">{title}</p>
      <ul className="flex flex-col gap-1.5">{rows.map((s) => (
        <li key={s.siteUrl}>
          <button type="button" disabled={saving} onClick={() => onSave(s.siteUrl)} aria-current={s.siteUrl === savedUrl || undefined}
            className="flex min-h-[42px] w-full items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 text-left text-[14px] leading-5 text-stone-900 outline-none transition-colors duration-150 hover:border-ink hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60">
            <span className="min-w-0 break-all">{s.siteUrl}</span>
            <span className="flex shrink-0 items-center gap-3 text-[13px] leading-[18px] text-stone-500">
              {s.siteUrl === savedUrl && <span className="inline-flex items-center gap-1.5" data-gsc-saved><Check size={13} aria-hidden />Saved</span>}
              <span>{s.permissionLevel?.replace(/^site/, '') || ''}</span>
            </span>
          </button>
        </li>
      ))}</ul>
    </div>
  )
  return (
    <Modal open={open} onClose={onClose} title="Choose a Search Console property"
      subtitle={<>Pick the property to use for <span className="font-medium text-stone-900">{host}</span>. If this Google account doesn’t include that site, connect with another account.</>}
      footer={(
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          {onDisconnect
            ? <button type="button" onClick={onDisconnect} disabled={saving || disconnecting} className={pickerLink}>{disconnecting ? 'Disconnecting…' : 'Disconnect'}</button>
            : <span />}
          <span className="flex flex-wrap items-center justify-end gap-4">
            <button type="button" onClick={onClose} className={pickerLink}>Cancel</button>
            {onReconnect && (
              <button type="button" onClick={onReconnect} disabled={saving || disconnecting}
                className="inline-flex h-9 items-center rounded-lg bg-ink px-3.5 text-[14px] font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-60">
                Use another Google account
              </button>
            )}
          </span>
        </div>
      )}>
      <div data-gsc-property-picker className="flex flex-col gap-4 pt-1">
        {loading && <p className="text-[14px] leading-5 text-stone-500" aria-busy>Loading properties…</p>}
        {error && <p role="alert" className="text-[14px] leading-5 text-stone-700"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-negative" aria-hidden />{error}</p>}
        {!loading && data && (
          <>
            {matched.length > 0 && group(`Matches ${host}`, matched)}
            {other.length > 0 && group(matched.length ? 'Other properties on this Google account' : `No property for ${host}. Other sites on this account`, other)}
            {!matched.length && !other.length && (
              <p className="text-[14px] leading-5 text-stone-700 text-pretty">This Google account has no Search Console properties. Add {host} in Search Console, or connect with another Google account.</p>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

// The target page when Search Console isn't connected (or was skipped) (owner, 2026-11-05): the page comes from
// content-recommend's own suggestion, so it says so: "Publishing on <path> · Suggested from your site" (or "New page we
// suggest") · "Connect Search Console for a better match" (opens the Connect card: a skip is forgotten and the card
// scrolls into view).
export function RoutePublishing({ page }) {
  if (!page?.path) return null
  const openCard = () => {
    setBrandSkipped(false)
    if (typeof window !== 'undefined') requestAnimationFrame(() => document.querySelector('[data-sc-ask]')?.scrollIntoView({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }))
  }
  return (
    <p data-route-publishing={page.source || 'route'} className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[14px] leading-5">
      <span className="shrink-0 text-stone-500" data-pub-label>Publishing on</span>
      <span className="min-w-0 truncate font-semibold text-stone-900" title={page.path}>{page.path}</span>
      <span aria-hidden className="text-stone-400">·</span>
      <span className="shrink-0 text-stone-500" data-page-source>{pageSourceLabel(page)}</span>
      <span aria-hidden className="text-stone-400">·</span>
      <button type="button" onClick={openCard} className="shrink-0 rounded font-medium text-ink underline decoration-[var(--color-line-strong)] underline-offset-[3px] outline-none hover:decoration-ink focus-visible:ring-2 focus-visible:ring-focus">Connect Search Console for a better match</button>
    </p>
  )
}
