import { useSyncExternalStore } from 'react'

// useMedia('(max-width: 767px)') → true while the query matches (re-renders on change)
export function useMedia(query) {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(query); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
// below md (768px): tables become lists, drawers become bottom sheets
export const useIsMobile = () => useMedia('(max-width: 767px)')
// below lg (1024px): the sidebar becomes a top bar + drawer
export const useIsCompact = () => useMedia('(max-width: 1023px)')
