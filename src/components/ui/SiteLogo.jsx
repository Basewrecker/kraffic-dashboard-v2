import { useEffect, useState } from 'react'

// A site's favicon, falling back to its initial on tint if there's no domain or it fails to load.
// size/rounded/pad are classes so callers keep their own box (e.g. "h-12 w-12 rounded-xl p-2").
// plate: a white plate behind the favicon in both themes (light/white logos stay visible); the initial fallback keeps the surface.
export default function SiteLogo({ domain, name, className = 'h-8 w-8 rounded-lg', imgPad = 'p-1.5', initialClass = 'text-[13px]', plate = false }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [domain])
  const initial = (name || domain || '?')[0].toUpperCase()
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden border border-line ${plate && domain && !failed ? 'bg-white' : 'bg-surface'} ${className}`}>
      {domain && !failed ? (
        <img src={`https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`} alt="" loading="lazy" onError={() => setFailed(true)} className={`h-full w-full object-contain ${imgPad}`} />
      ) : (
        <span aria-hidden className={`grid h-full w-full place-items-center bg-tint font-semibold text-stone-600 ${initialClass}`}>{initial}</span>
      )}
    </span>
  )
}
