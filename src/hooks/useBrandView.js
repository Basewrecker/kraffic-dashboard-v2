import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ENGINES, OWN, TRACKED_BRANDS, getBrandView } from '../data/brandViews'

// "Viewing as": which brand the dashboard is seen from (?view=<key>, absent = Dermasuri), and the
// engine filter every card follows (?engine=gemini, absent = all engines). replaceState, so switching
// doesn't flood the back button.
const DashboardViewContext = createContext(null)

const readView = () => {
  const key = new URLSearchParams(window.location.search).get('view')
  return (TRACKED_BRANDS.find((b) => b.key === key) ?? OWN).domain
}
const readEngine = () => {
  const e = new URLSearchParams(window.location.search).get('engine')
  return ENGINES.some((x) => x.id === e) ? e : 'all'
}
const writeParam = (k, v) => {
  const url = new URL(window.location.href)
  if (v == null) url.searchParams.delete(k)
  else url.searchParams.set(k, v)
  window.history.replaceState(window.history.state, '', url)
}

export function DashboardViewProvider({ children }) {
  const [focal, setFocal] = useState(readView)
  const [engine, setEngineState] = useState(readEngine)
  useEffect(() => {
    const sync = () => { setFocal(readView()); setEngineState(readEngine()) }
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  const setView = useCallback((domain) => {
    setFocal(domain)
    const b = TRACKED_BRANDS.find((x) => x.domain === domain)
    writeParam('view', !b || b.you ? null : b.key)
  }, [])
  const setEngine = useCallback((id) => {
    const e = ENGINES.some((x) => x.id === id) ? id : 'all'
    setEngineState(e)
    writeParam('engine', e === 'all' ? null : e)
  }, [])
  const value = useMemo(() => ({ focal, setView, engine, setEngine }), [focal, setView, engine, setEngine])
  return createElement(DashboardViewContext.Provider, { value }, children)
}

export function useDashboardView() {
  return useContext(DashboardViewContext) ?? { focal: OWN.domain, setView: () => {}, engine: 'all', setEngine: () => {} }
}

// Every dashboard card reads its data from here:
// { focal, rivals, kpis, historyKey, platforms (always all engines), visiblePrompts, missedPrompts, rivalPrompts,
//   syncHistory, citedPages, isOwnBrand, engine, setView, setEngine } — scoped to the engine filter
export function useBrandView(focalDomain) {
  const ctx = useDashboardView()
  const domain = focalDomain ?? ctx.focal
  return useMemo(
    () => ({ ...getBrandView(domain, ctx.engine), setView: ctx.setView, setEngine: ctx.setEngine }),
    [domain, ctx.engine, ctx.setView, ctx.setEngine],
  )
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Numbers count from the old value to the new one (300ms ease-out) when the view changes.
export function useCountUp(target, duration = 300) {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    if (from.current === target || reduced()) { from.current = target; setShown(target); return }
    const start = performance.now(), a = from.current
    let raf
    const tick = (t) => {
      const k = Math.min(1, (t - start) / duration)
      const v = a + (target - a) * (1 - (1 - k) ** 3)
      from.current = v
      setShown(k === 1 ? target : v)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return Number.isInteger(target) ? Math.round(shown) : shown
}
