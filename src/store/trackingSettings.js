// Tracking settings: the single source of truth for platforms, market, schedule and quota.
// Edited on /llm-settings; read by /setup (summary + brand status) and the dashboard header.
// React context + useReducer, persisted to localStorage for the demo.
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'

const STORAGE_KEY = 'kraffic-tracking-v1'

export const REGIONS = {
  'Asia Pacific': [
    { name: 'Singapore', flag: '🇸🇬', short: 'Singapore' },
    { name: 'Australia', flag: '🇦🇺', short: 'Australian' },
    { name: 'Japan', flag: '🇯🇵', short: 'Japanese' },
  ],
  'North America': [
    { name: 'United States', flag: '🇺🇸', short: 'US' },
    { name: 'Canada', flag: '🇨🇦', short: 'Canadian' },
  ],
  Europe: [
    { name: 'United Kingdom', flag: '🇬🇧', short: 'UK' },
    { name: 'Germany', flag: '🇩🇪', short: 'German' },
    { name: 'France', flag: '🇫🇷', short: 'French' },
  ],
  'Middle East': [
    { name: 'United Arab Emirates', flag: '🇦🇪', short: 'UAE' },
    { name: 'Saudi Arabia', flag: '🇸🇦', short: 'Saudi' },
  ],
}
export const LANGUAGES = ['English (US)', 'English (UK)', 'Japanese', 'German', 'French', 'Arabic']
export const CURRENCIES = [
  { code: 'USD', symbol: '$' }, { code: 'GBP', symbol: '£' },
  { code: 'EUR', symbol: '€' }, { code: 'AED', symbol: 'د.إ' }, { code: 'SGD', symbol: 'S$' },
]
export const FREQUENCIES = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']]
export const countryInfo = (name) => Object.values(REGIONS).flat().find((c) => c.name === name)
export const currencySymbol = (code) => CURRENCIES.find((c) => c.code === code)?.symbol ?? code

export const initialTracking = {
  platforms: [
    { id: 'aio', name: 'AI Overview', enabled: true, mention: 73 },
    { id: 'gemini', name: 'Gemini', enabled: true, mention: 59 },
    { id: 'chatgpt', name: 'ChatGPT', enabled: true, mention: 36 },
    { id: 'claude', name: 'Claude', enabled: true, mention: 0 },
    { id: 'grok', name: 'Grok', enabled: true, mention: 0 },
  ],
  market: { region: 'North America', country: 'United States', language: 'English (US)', currency: 'USD' },
  schedule: { frequency: 'weekly', nextSync: '2026-10-12T09:00', lastSync: '2026-10-05' },
  quota: { used: 152, limit: 200, resetsOn: '2026-11-01' },
}

// ---- dates (local time; ISO strings without a zone)
const pad = (n) => String(n).padStart(2, '0')
const toLocalIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const parse = (iso) => { const [d, t = '00:00'] = iso.split('T'); const [y, m, dd] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return new Date(y, m - 1, dd, h, mi) }
// next run after `from`: daily = tomorrow, weekly = next Monday, monthly = the 1st of next month (09:00)
export function computeNextSync(frequency, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 9, 0)
  if (frequency === 'daily') d.setDate(d.getDate() + 1)
  else if (frequency === 'weekly') d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7))
  else d.setMonth(d.getMonth() + 1, 1)
  return toLocalIso(d)
}
export const fmtDay = (iso) => parse(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) // "Oct 5"
export const fmtWeekday = (iso) => parse(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) // "Mon, Oct 12"
export const fmtTime = (iso) => iso.split('T')[1] ?? '09:00'

function reducer(state, action) {
  switch (action.type) {
    case 'platform':
      return { ...state, platforms: state.platforms.map((p) => (p.id === action.id ? { ...p, enabled: action.enabled } : p)) }
    case 'market':
      return { ...state, market: { ...state.market, ...action.patch } }
    case 'frequency':
      return { ...state, schedule: { ...state.schedule, frequency: action.frequency, nextSync: computeNextSync(action.frequency) } }
    case 'syncStart':
      return { ...state, syncing: true }
    case 'syncDone': {
      const today = toLocalIso(new Date()).slice(0, 10)
      return { ...state, syncing: false, schedule: { ...state.schedule, lastSync: today, nextSync: computeNextSync(state.schedule.frequency) } }
    }
    default:
      return state
  }
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved?.platforms && saved?.market && saved?.schedule && saved?.quota) {
      // a market saved before the US-only change (India, ₹ INR, "English"…) falls back to the default market
      const m = saved.market
      const valid = REGIONS[m.region]?.some((c) => c.name === m.country) && LANGUAGES.includes(m.language) && CURRENCIES.some((c) => c.code === m.currency)
      return { ...initialTracking, ...saved, market: valid ? m : initialTracking.market, syncing: false }
    }
  } catch { /* storage blocked or bad JSON: start fresh */ }
  return { ...initialTracking, syncing: false }
}

const Ctx = createContext(null)

export function TrackingProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const timer = useRef(null)
  useEffect(() => {
    const { syncing, ...persist } = state // eslint-disable-line no-unused-vars
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(persist)) } catch { /* ignore */ }
  }, [state])
  useEffect(() => () => clearTimeout(timer.current), [])

  const syncNow = useCallback(() => {
    if (timer.current) return
    dispatch({ type: 'syncStart' })
    timer.current = setTimeout(() => { timer.current = null; dispatch({ type: 'syncDone' }) }, 2000)
  }, [])
  const actions = useMemo(() => ({
    setPlatform: (id, enabled) => dispatch({ type: 'platform', id, enabled }),
    setMarket: (patch) => dispatch({ type: 'market', patch }),
    setFrequency: (frequency) => dispatch({ type: 'frequency', frequency }),
    syncNow,
  }), [syncNow])
  const value = useMemo(() => ({ ...state, ...actions }), [state, actions])
  return createElement(Ctx.Provider, { value }, children)
}

export function useTracking() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTracking must be used inside <TrackingProvider>')
  return v
}

// "5 engines · Weekly · United States · English (US) · $ USD"
export function trackingSummary(t) {
  const on = t.platforms.filter((p) => p.enabled).length
  const freq = FREQUENCIES.find(([v]) => v === t.schedule.frequency)?.[1]
  return `${on} engine${on === 1 ? '' : 's'} · ${freq} · ${t.market.country} · ${t.market.language} · ${currencySymbol(t.market.currency)} ${t.market.currency}`
}
