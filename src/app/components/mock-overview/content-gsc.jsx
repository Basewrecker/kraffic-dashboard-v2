// Mock stand-in for the app's components/mock-overview/content-gsc.jsx (synced 2026-11-15): Search Console around the
// Content pages. The picker and the "Publishing on …" line are the app's code, unchanged. The hooks, which in the app
// talk to its server and Google, keep the mock's behaviour: Connect takes 900ms, the properties are samples, nothing
// fails.
import { useEffect, useRef, useState } from 'react'
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

export function GscPropertyPicker({ open, loading, saving, error, data, onClose, onSave, onReconnect, onDisconnect = null, disconnecting = false, domain }) {
  if (!open) return null
  const matched = data?.matched || []
  const other = data?.other || []
  const host = String(domain || '').replace(/^www\./, '')
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="gsc-prop-h" data-gsc-property-picker
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-4 sm:items-center" onClick={onClose}>
      <div className="max-h-[min(80vh,560px)] w-full max-w-lg overflow-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="gsc-prop-h" className="text-[17px] font-semibold leading-6 text-stone-900">Choose a Search Console property</h2>
        <p className="mt-1 text-[14px] leading-5 text-stone-600">
          Pick the property to use for <span className="font-medium text-stone-900">{host}</span>. If this Google account doesn’t include that site, connect with another account.
        </p>
        {loading && <p className="mt-4 text-[14px] text-stone-500" aria-busy>Loading properties…</p>}
        {error && <p role="alert" className="mt-3 text-[14px] text-stone-700"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-negative" aria-hidden />{error}</p>}
        {!loading && data && (
          <div className="mt-4 space-y-4">
            {matched.length > 0 && (
              <div>
                <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-stone-500">Matches {host}</p>
                <ul className="space-y-1">{matched.map((s) => (
                  <li key={s.siteUrl}>
                    <button type="button" disabled={saving} onClick={() => onSave(s.siteUrl)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 text-left text-[14px] text-stone-800 outline-none hover:border-ink hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60">
                      <span className="min-w-0 break-all">{s.siteUrl}</span>
                      <span className="shrink-0 text-[12px] text-stone-500">{s.permissionLevel?.replace(/^site/, '') || ''}</span>
                    </button>
                  </li>
                ))}</ul>
              </div>
            )}
            {other.length > 0 && (
              <div>
                <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-stone-500">
                  {matched.length ? 'Other properties on this Google account' : `No property for ${host} — other sites on this account`}
                </p>
                <ul className="space-y-1">{other.map((s) => (
                  <li key={s.siteUrl}>
                    <button type="button" disabled={saving} onClick={() => onSave(s.siteUrl)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 text-left text-[14px] text-stone-800 outline-none hover:border-ink hover:bg-tint focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60">
                      <span className="min-w-0 break-all">{s.siteUrl}</span>
                      <span className="shrink-0 text-[12px] text-stone-500">{s.permissionLevel?.replace(/^site/, '') || ''}</span>
                    </button>
                  </li>
                ))}</ul>
              </div>
            )}
            {!matched.length && !other.length && (
              <p className="text-[14px] text-stone-700">This Google account has no Search Console properties. Add {host} in Search Console, or connect with another Google account.</p>
            )}
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {onDisconnect ? (
            <button type="button" onClick={onDisconnect} disabled={saving || disconnecting}
              className="rounded text-[14px] font-medium text-stone-600 underline decoration-[var(--color-line-strong)] underline-offset-2 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60">
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          ) : <span />}
          <span className="flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded text-[14px] font-medium text-stone-600 underline decoration-[var(--color-line-strong)] underline-offset-2 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">Cancel</button>
            {onReconnect && (
              <button type="button" onClick={onReconnect} disabled={saving || disconnecting}
                className="inline-flex h-9 items-center rounded-lg bg-ink px-3.5 text-[14px] font-medium text-on-ink outline-none hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60">
                Use another Google account
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
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
