// The Overview's Insights panel reads each card's insight from here (the mock's own equivalent of the app's
// page-insights wiring). A card reports the sentence its footer shows, with its name, the id to scroll to and, where
// it has one, a metric for the panel's small ring:
//   useCardInsight('history', insight && { name: 'Visibility history', anchor: 'history', text, metric: { value: 73, change: 7 } })
// metric: { value: 0–100, change?: points (↑ / ↓), note?: a muted word in its place }. null: the card has nothing to say.
// Pure helpers (orderInsights, the seen list) are unit-tested; the store is a plain subscribe / snapshot pair.
import { useEffect, useSyncExternalStore } from 'react'

export const CARD_ORDER = ['history', 'share', 'citations', 'marketplace', 'sync', 'folders']
let items = {}
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())
const same = (a, b) => a?.text === b?.text && a?.name === b?.name && a?.metric?.value === b?.metric?.value && a?.metric?.change === b?.metric?.change && a?.detail === b?.detail

export function setCardInsight(key, insight) {
  if (!insight?.text) { if (key in items) { const { [key]: _gone, ...rest } = items; items = rest; emit() } return }
  if (same(items[key], insight)) return
  items = { ...items, [key]: { key, ...insight } }
  emit()
}
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
const snapshot = () => items

export function useCardInsight(key, insight) {
  const text = insight?.text ?? null
  // the sentence and the numbers are what change; the rest follows them
  useEffect(() => { setCardInsight(key, insight) }, [key, text, insight?.metric?.value, insight?.metric?.change, insight?.detail]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => setCardInsight(key, null), [key])
}
export const useCardInsights = () => useSyncExternalStore(subscribe, snapshot, snapshot)

// ---- "New": an insight the viewer hasn't opened the panel on yet (its card and sentence, kept per brand in this
// browser). The panel lists the new ones first, then the page's order.
const seenKey = (brand) => `kraffic:insights:seen:${brand}`
export const stamp = (i) => `${i.key}|${i.text}`
export function readSeen(brand) {
  try { return new Set(JSON.parse(window.localStorage.getItem(seenKey(brand))) ?? []) } catch { return new Set() }
}
export function writeSeen(brand, list) {
  try { window.localStorage.setItem(seenKey(brand), JSON.stringify(list.map(stamp))) } catch { /* storage unavailable: everything stays "New" */ }
}
export function orderInsights(map, seen = new Set(), order = CARD_ORDER) {
  const at = (k) => (order.indexOf(k) === -1 ? order.length : order.indexOf(k))
  return Object.values(map ?? {}).map((i) => ({ ...i, isNew: !seen.has(stamp(i)) })).sort((a, b) => (b.isNew - a.isNew) || at(a.key) - at(b.key))
}
