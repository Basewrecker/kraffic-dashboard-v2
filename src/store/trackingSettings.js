// Tracking settings: one source of truth for the engines, the market, the schedule and the prompt count
// (data/mock.js initialTracking, shaped like the API; a backend can pass its own `initial`). Edited on /tracking;
// read by /brands (the summary) and the dashboard (latest sync, the engines).
// Each save updates the page first, then calls `save` (the page's prop for that row; trackingActions when none is
// given). A save that fails puts the value back and rejects, so the page can say what failed and offer Retry.
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
    case 'platform':
      return { ...state, platforms: state.platforms.map((p) => (p.id === action.id ? { ...p, enabled: action.enabled } : p)) }
    case 'market':
      return { ...state, market: { ...state.market, ...action.patch } }
    case 'schedule':
      return { ...state, schedule: { ...state.schedule, ...action.patch } }
    // a sync: syncing (asked) → accepted (the server took it) → progress per engine → done, or still running in the
    // background when it outlasts the page's wait (not a failure: the scans go on, and the page follows them to the end)
    case 'syncStart':
      return { ...state, syncing: true, syncAccepted: false, syncProgress: null, syncBackground: false }
    case 'syncAccepted':
      return { ...state, syncAccepted: true }
    case 'syncProgress':
      return { ...state, syncProgress: action.progress }
    case 'syncDone':
      return { ...state, syncing: false, syncBackground: false, syncProgress: null, schedule: { ...state.schedule, lastSync: action.lastSync, nextScanAt: action.nextScanAt } }
    case 'syncBackground':
      return { ...state, syncing: false, syncBackground: true }
    case 'syncFail':
      return { ...state, syncing: false, syncProgress: null }
    default:
      return state
  }
}

const Ctx = createContext(null)

export function TrackingProvider({ initial = initialTracking, children }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ ...initial, syncing: false, syncAccepted: false, syncProgress: null, syncBackground: false }))
  const current = useRef(state)
  current.current = state
  const syncing = useRef(false)

  // show the change, save it, put it back if the save fails
  const optimistic = useCallback(async (apply, undo, save) => {
    dispatch(apply)
    try { await save() } catch (err) { dispatch(undo); throw err }
  }, [])
  const setPlatform = useCallback((id, enabled, save) => {
    const before = current.current.platforms.find((p) => p.id === id)?.enabled
    return optimistic({ type: 'platform', id, enabled }, { type: 'platform', id, enabled: before }, () => save(id, enabled))
  }, [optimistic])
  const setMarket = useCallback((patch, save = trackingActions.onSaveMarket) => {
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, current.current.market[k]]))
    return optimistic({ type: 'market', patch }, { type: 'market', patch: before }, () => save(patch))
  }, [optimistic])
  const setFrequency = useCallback((frequency, save) => {
    const before = current.current.schedule.frequency
    return optimistic({ type: 'schedule', patch: { frequency } }, { type: 'schedule', patch: { frequency: before } }, () => save(frequency))
  }, [optimistic])
  const setDaily = useCallback((daily, save = trackingActions.onSetDaily) => {
    const before = current.current.schedule.daily
    return optimistic({ type: 'schedule', patch: { daily } }, { type: 'schedule', patch: { daily: before } }, () => save(daily))
  }, [optimistic])
  // run({ mode, onAccepted, onProgress, onDone }) resolves { status: 'complete', lastSync, nextScanAt } or { status: 'running' }
  // (it keeps going: onDone(result) when it finishes); onAccepted: the caller's own reaction (the "Sync started" toast),
  // after the server took the request; onDone: the caller's reaction to a finish in the background. One sync at a time
  // from this page: a second start while one runs (or runs in the background) is ignored.
  const syncNow = useCallback(async (run = trackingActions.onSyncNow, { mode, onAccepted, onDone } = {}) => {
    if (syncing.current) return null
    syncing.current = true
    dispatch({ type: 'syncStart' })
    const finish = (res) => { syncing.current = false; dispatch({ type: 'syncDone', lastSync: res?.lastSync, nextScanAt: res?.nextScanAt ?? null }) }
    try {
      const res = await run({
        mode,
        onAccepted: () => { dispatch({ type: 'syncAccepted' }); onAccepted?.() },
        onProgress: (progress) => dispatch({ type: 'syncProgress', progress }),
        onDone: (later) => { finish(later); onDone?.(later) },
      })
      if (res?.status === 'running') dispatch({ type: 'syncBackground' })
      else finish(res)
      return res
    } catch (err) { syncing.current = false; dispatch({ type: 'syncFail' }); throw err }
  }, [])
  const actions = useMemo(() => ({ setPlatform, setMarket, setFrequency, setDaily, syncNow }), [setPlatform, setMarket, setFrequency, setDaily, syncNow])
  const value = useMemo(() => ({ ...state, ...actions }), [state, actions])
  return createElement(Ctx.Provider, { value }, children)
}

export function useTracking() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTracking must be used inside <TrackingProvider>')
  return v
}

const FREQUENCY_LABEL = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }
// "4 engines ready · Daily checks on · United States · English" (kraffic.ai)
// "4 engines on · Weekly · USA · English (US) · Dollar" (app.kraffic.ai: a sync frequency and a currency)
export function trackingSummary(t) {
  const { frequency, daily } = t.schedule
  const n = t.platforms.filter((p) => (frequency ? p.enabled : p.ready)).length
  const engines = `${n} engine${n === 1 ? '' : 's'} ${frequency ? 'on' : 'ready'}`
  const schedule = frequency ? FREQUENCY_LABEL[frequency] : daily != null ? `Daily checks ${daily ? 'on' : 'off'}` : null
  return [engines, schedule, t.market.country, t.market.language, t.market.currency].filter(Boolean).join(' · ')
}
