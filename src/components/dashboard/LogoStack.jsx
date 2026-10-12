import { useState } from 'react'
import { createPortal } from 'react-dom'
import SiteLogo from '../ui/SiteLogo'
import { brandName } from '../../utils/brand'

// A row of brand logos (the same 20px logo box as Setup / Prompt coverage / Marketplace: whole logo, no crop,
// no overlap), max `max` then "+N". Each logo's title names it; hovering the cell lists them all in a small
// popover (portalled: table cells clip). labels: optional { domain: name } overrides.
export default function LogoStack({ domains, max = 3, labels = {}, empty = null }) {
  const [tip, setTip] = useState(null) // { x, y }
  if (!domains.length) return empty
  const shown = domains.slice(0, max)
  const names = domains.map((d) => labels[d] ?? brandName(d))
  const show = (e) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ x: r.left + r.width / 2, y: r.top }) }
  return (
    <span tabIndex={0} aria-label={names.join(', ')} onMouseEnter={show} onFocus={show} onMouseLeave={() => setTip(null)} onBlur={() => setTip(null)}
      className="inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus">
      {shown.map((d, i) => (
        <span key={d} title={names[i]} className="inline-flex">
          <SiteLogo domain={d} name={names[i]} className="h-5 w-5 rounded-md" imgPad="p-0.5" initialClass="text-[10px]" />
        </span>
      ))}
      {domains.length > max && <span className="ml-1 text-[12px] leading-4 font-medium text-stone-500 tabular-nums">+{domains.length - max}</span>}
      {tip && createPortal(
        <span role="tooltip" style={{ left: tip.x, top: tip.y - 6 }}
          className="pointer-events-none fixed z-[70] max-w-[260px] -translate-x-1/2 -translate-y-full rounded-md border border-line bg-raised px-2.5 py-1.5 text-[12px] leading-4 text-stone-700 shadow-sm">
          {names.join(', ')}
        </span>,
        document.body,
      )}
    </span>
  )
}
