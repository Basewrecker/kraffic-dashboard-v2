import { useEffect, useRef, useState } from 'react'
import { reducedMotion } from '../lib/motionTokens'

// A number that rolls to its new value when it changes (600ms, ease-out): the sidebar meter and the plan pill after an
// upgrade. The first value shows at once. Reduced motion: the new value at once.
// format: how to write it (e.g. thousands commas)
export default function RollNumber({ value, duration = 600, className = '', format = (x) => x }) {
  const [n, setN] = useState(value)
  const prev = useRef(value)
  useEffect(() => {
    const from = prev.current
    prev.current = value
    if (from === value || reducedMotion()) { setN(value); return undefined }
    let raf, t0
    const tick = (t) => {
      t0 ??= t
      const k = Math.min(1, (t - t0) / duration)
      setN(Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <span className={`tabular-nums ${className}`}>{format(n)}</span>
}
