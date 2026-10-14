// Tracking settings: one source of truth for the engines, the market, daily checks and the prompt count
// (data/mock.js initialTracking, shaped like the API). Edited on /tracking; read by /brands (the summary) and the
// dashboard (latest sync, the engines).
// Each save updates the page first, then calls trackingActions; a save that fails puts the value back and rejects,
// so the page can say what failed and offer Retry.
import { createContext, createElement, useCallback, useContext, useMemo, useReducer, useRef } from 'react'
import { initialTracking, trackingActions, trackingOptions } from '../data/mock'

// the countries and languages the app supports (the Market selects)
export { trackingOptions }

// ---- dates (local time; ISO strings without a zone)
const parse = (iso) => { const [d, t = '00:00'] = iso.split('T'); const [y, m, dd] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return new Date(y, m - 1, dd, h, mi) }
export const fmtDay = (iso) => parse(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) // "Oct 5"
// "Thu, 9:04 AM": when Sync now is allowed again
export const fmtAvailable = (iso) => parse(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })

function reducer(state, action) {
  switch (action.type) {
    case 'market':
      return { ...state, market: { ...state.market, ...action.patch } }
    case 'daily':
      return { ...state, schedule: { ...state.schedule, daily: action.daily } }
    case 'syncStart':
      return { ...state, syncing: true }
    case 'syncDone':
      return { ...state, syncing: false, schedule: { ...state.schedule, lastSync: action.lastSync, nextScanAt: action.nextScanAt } }
    case 'syncFail':
      return { ...state, syncing: false }
    default:
      return state
  }
}

const Ctx = createContext(null)

export function TrackingProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ ...initialTracking, syncing: false }))
  const current = useRef(state)
  current.current = state
  const syncing = useRef(false)

  const setMarket = useCallback(async (patch) => {
    const before = current.current.market
    dispatch({ type: 'market', patch })
    try { await trackingActions.onSaveMarket(patch) } catch (err) { dispatch({ type: 'market', patch: before }); throw err }
  }, [])
  const setDaily = useCallback(async (daily) => {
    const before = current.current.schedule.daily
    dispatch({ type: 'daily', daily })
    try { await trackingActions.onSetDaily(daily) } catch (err) { dispatch({ type: 'daily', daily: before }); throw err }
  }, [])
  const syncNow = useCallback(async () => {
    if (syncing.current) return
    syncing.current = true
    dispatch({ type: 'syncStart' })
    try {
      const { lastSync, nextScanAt } = await trackingActions.onSyncNow()
      dispatch({ type: 'syncDone', lastSync, nextScanAt })
    } catch (err) { dispatch({ type: 'syncFail' }); throw err } finally { syncing.current = false }
  }, [])
  const actions = useMemo(() => ({ setMarket, setDaily, syncNow }), [setMarket, setDaily, syncNow])
  const value = useMemo(() => ({ ...state, ...actions }), [state, actions])
  return createElement(Ctx.Provider, { value }, children)
}

export function useTracking() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTracking must be used inside <TrackingProvider>')
  return v
}

// "4 engines ready · Daily checks on · United States · English"
export function trackingSummary(t) {
  const ready = t.platforms.filter((p) => p.ready).length
  return `${ready} engine${ready === 1 ? '' : 's'} ready · Daily checks ${t.schedule.daily ? 'on' : 'off'} · ${t.market.country} · ${t.market.language}`
}
