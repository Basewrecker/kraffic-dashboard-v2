import { useEffect, useState } from 'react'

// Keeps removed items on screen for `ms` so they can animate out; new items are flagged 'enter'.
// Items present on the first render are 'idle' (no mount animation). Returns [{ item, key, state }].
export function useAnimatedList(items, getKey, ms = 200) {
  const [shown, setShown] = useState(() => items.map((item) => ({ item, key: getKey(item), state: 'idle' })))
  useEffect(() => {
    setShown((prev) => {
      const keys = new Set(items.map(getKey))
      const next = items.map((item) => {
        const k = getKey(item)
        return { item, key: k, state: prev.some((p) => p.key === k && p.state !== 'leaving') ? 'idle' : 'enter' }
      })
      prev.forEach((p, i) => { if (!keys.has(p.key)) next.splice(Math.min(i, next.length), 0, { ...p, state: 'leaving' }) })
      return next
    })
    const t = setTimeout(() => setShown((s) => s.filter((x) => x.state !== 'leaving')), ms)
    return () => clearTimeout(t)
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps
  return shown
}
