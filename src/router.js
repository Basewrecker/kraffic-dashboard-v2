import { useEffect, useState } from 'react'

// Tiny pushState router: two pages don't need a dependency. vercel.json rewrites every path to
// index.html, so deep links and refreshes land here too.
const EVENT = 'app:navigate'

// old routes → new ones (query string and hash are kept), so bookmarks and ?view= / ?engine= links still work
export const REDIRECTS = { '/': '/overview', '/prompts': '/tracker', '/setup': '/brands', '/llm-settings': '/tracking' }
const resolve = (to) => {
  const url = new URL(to, window.location.origin)
  if (REDIRECTS[url.pathname]) url.pathname = REDIRECTS[url.pathname]
  return url.pathname + url.search + url.hash
}
// on load: rewrite an old path in place (no extra history entry)
if (typeof window !== 'undefined' && REDIRECTS[window.location.pathname]) {
  window.history.replaceState(window.history.state, '', resolve(window.location.href))
}

export function navigate(rawTo) {
  const to = resolve(rawTo)
  if (to === window.location.pathname + window.location.search) return
  window.history.pushState(null, '', to)
  window.dispatchEvent(new Event(EVENT))
  window.scrollTo(0, 0)
}

export function usePath() {
  const [path, setPath] = useState(() => window.location.pathname)
  useEffect(() => {
    const sync = () => {
      // Back into an old URL (from before the rename): swap it for the new one
      if (REDIRECTS[window.location.pathname]) window.history.replaceState(window.history.state, '', resolve(window.location.href))
      setPath(window.location.pathname)
    }
    window.addEventListener('popstate', sync)
    window.addEventListener(EVENT, sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener(EVENT, sync) }
  }, [])
  return path
}

// <a> click handler: plain left-clicks navigate in-app; cmd/ctrl/middle-clicks keep normal link behaviour
export const linkClick = (to) => (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  navigate(to)
}
