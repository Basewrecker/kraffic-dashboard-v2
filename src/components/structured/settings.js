import { useSyncExternalStore } from 'react'

// Structured Data settings, shared by the Settings tab and the page's Re-run (Max pages goes with each new crawl).
// Kept in this browser (localStorage); every change saves at once. Page types come from the crawl, not from rules here.
const KEY = 'kraffic:structured-data:settings:v3'
export const DEFAULTS = {
  sitemap: '',
  maxPages: 50,
  include: [],
  exclude: [],
  schedule: { auto: false, freq: 'weekly', day: 1 }, // weekly: 0–6 (Sun–Sat) · monthly: day of month 1–28
  alerts: { breaks: false, drops: false },
}

let state = (() => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return DEFAULTS }
})()
const subs = new Set()
export function saveSettings(patch) {
  state = { ...state, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode: keep it for this visit */ }
  subs.forEach((f) => f())
}
export const useSettings = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => state)

// "Mon, Oct 19 · 09:00": the next scheduled run after today
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export function nextRun({ freq, day }, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1)
  for (let i = 0; i < 62; i++, d.setDate(d.getDate() + 1)) {
    if (freq === 'weekly' ? d.getDay() === day : d.getDate() === day) break
  }
  return `${DAYS[d.getDay()]}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · 09:00`
}
export const WEEKDAYS = DAYS
