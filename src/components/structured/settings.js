import { useSyncExternalStore } from 'react'

// Structured Data settings, shared by the Settings tab and the Overview (the page-type rules drive the Coverage map).
// Kept in this browser (localStorage); every change saves at once.
const KEY = 'kraffic:structured-data:settings:v2'
export const DEFAULTS = {
  sitemap: 'https://dermasuri.com/sitemap.xml',
  sitemapCheck: { ok: true, count: 52 }, // the last Test result
  maxPages: 50,
  include: ['/products/*', '/blog/*'],
  exclude: ['/cart/*', '/account/*'],
  pageTypes: [
    { id: 'product', name: 'Product pages', pattern: '/products/*' },
    { id: 'blog', name: 'Blog posts', pattern: '/blog/*' },
    { id: 'collection', name: 'Collections', pattern: '/collections/*' },
    { id: 'home', name: 'Home', pattern: '/' },
  ],
  schedule: { auto: true, freq: 'weekly', day: 1 }, // weekly: 0–6 (Sun–Sat) · monthly: day of month 1–28
  alerts: { breaks: true, drops: false },
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

// "/products/*" → matches /products/anything; "/" → the home page only
export function matches(pattern, path) {
  const re = new RegExp(`^${pattern.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`)
  return re.test(path)
}
// the pages each rule covers (first matching rule wins), plus "Other pages" for whatever no rule matched
export function groupPages(pageTypes, pages) {
  const taken = new Set()
  const groups = pageTypes.map((t) => {
    const ps = pages.filter((p) => !taken.has(p.path) && matches(t.pattern, p.path))
    ps.forEach((p) => taken.add(p.path))
    return { ...t, pages: ps }
  })
  const rest = pages.filter((p) => !taken.has(p.path))
  if (rest.length) groups.push({ id: 'other', name: 'Other pages', pattern: null, pages: rest })
  return groups
}

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
