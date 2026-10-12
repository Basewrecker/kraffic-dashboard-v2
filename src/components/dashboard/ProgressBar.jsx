import { useEffect, useRef, useState } from 'react'
import { chart } from '../../theme/chart'

// The one horizontal bar used across the dashboard.
// color: a chart color (chart.you, chart.c3, getCompetitorColor(d).fill). A non-zero fill never renders narrower than 6px, so tiny values read as a deliberate dot.
// under: optional second fill drawn beneath the main one ({ value, color }), e.g. mentioned under cited.
// Fills grow from 0 (600ms ease-out) the first time the bar scrolls into view; `delay` staggers the main fill.
export default function ProgressBar({ value, max = 100, height = '8px', color = chart.you, under = null, delay = 0, className = '' }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect() } }, { threshold: 0.2 })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  const width = (v) => (shown ? `${Math.max(0, Math.min(100, (v / max) * 100))}%` : 0)
  const fill = 'absolute inset-y-0 left-0 rounded-full transition-[width] duration-[600ms] ease-out motion-reduce:transition-none'
  const MIN = shown ? 6 : 0

  return (
    <span ref={ref} className={`relative block rounded-full ${className}`} style={{ height, background: chart.track }}>
      {under && under.value > 0 && <span className={fill} style={{ width: width(under.value), minWidth: MIN, background: under.color }} />}
      {value > 0 && <span className={fill} style={{ width: width(value), minWidth: MIN, background: color, transitionDelay: `${delay}ms` }} />}
    </span>
  )
}
