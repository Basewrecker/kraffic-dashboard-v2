import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { brandLogos } from '../../data/mock'

// A site's logo: the brand's stored logo (brandLogos), else its favicon, else its initial on tint.
// size/rounded are classes so callers keep their own box (e.g. "h-12 w-12 rounded-xl"); the box is reserved while the
// image resolves, and the image fades in once it has loaded.
// The logo fills its rounded square, full-bleed (owner, 2026-11-02): no padding, no white plate, no border or inner
// ring; a logo with a transparent background shows the card colour behind it (the box has no fill of its own). The
// old plate / imgPad / bordered options are gone: a caller that still passes them is
// ignored (nothing reads them), so they're harmless.
// The favicon service answers an unknown site with a 16px placeholder (404): a favicon 16px or smaller counts as missing.
const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
const PLACEHOLDER_MAX = 16

export default function SiteLogo({ domain, name, className = 'h-8 w-8 rounded-lg', initialClass = 'text-[13px]' }) {
  const sources = [brandLogos[domain], domain && favicon(domain)].filter(Boolean)
  const [step, setStep] = useState(0)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { setStep(0); setLoaded(false) }, [domain])
  const src = sources[step]
  const next = () => { setLoaded(false); setStep((s) => s + 1) }
  const onLoad = (e) => (src === favicon(domain) && e.currentTarget.naturalWidth <= PLACEHOLDER_MAX ? next() : setLoaded(true))
  // an image already in the browser's cache can finish before React listens for load: check once it's mounted
  const img = useRef(null)
  useLayoutEffect(() => {
    const el = img.current
    if (el?.complete && el.naturalWidth) onLoad({ currentTarget: el })
  }, [src]) // eslint-disable-line react-hooks/exhaustive-deps
  const initial = (name || domain || '?')[0].toUpperCase()

  if (!src) {
    return <span aria-hidden className={`grid shrink-0 place-items-center overflow-hidden bg-tint font-semibold text-stone-600 ${className} ${initialClass}`}>{initial}</span>
  }
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden ${className}`}>
      <img
        ref={img}
        key={src}
        src={src}
        alt=""
        loading="lazy"
        onLoad={onLoad}
        onError={next}
        className={`h-full w-full object-contain transition-opacity duration-150 ease-out ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </span>
  )
}
