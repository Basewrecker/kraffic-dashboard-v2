// One piece of text giving way to another (walkthrough motion): the old one fades out and up, the new one fades in
// from below, over one fade (200ms). `k` names what is shown; when it changes, the swap plays.
//   <Swap k={step}>{text}</Swap>            4px each way (a pointer's text, the card's "Next:" line)
//   <Swap k={n} roll>{n}</Swap>             a counter: a whole line each way, clipped ("2 of 5", the ring's number)
// Reduced motion: a fade, no movement (index.css).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FADE, ms } from './motion.js'

export default function Swap({ k, children, roll = false, className = '', block = false }) {
  const [out, setOut] = useState(null) // the one leaving: { k, node }
  const lastK = useRef(k)
  const lastNode = useRef(children)
  useLayoutEffect(() => {
    if (lastK.current === k) return undefined
    setOut({ k: lastK.current, node: lastNode.current })
    lastK.current = k
    const t = setTimeout(() => setOut(null), ms(FADE) + 30)
    return () => clearTimeout(t)
  }, [k])
  useEffect(() => { lastNode.current = children })
  const Tag = block ? 'div' : 'span'
  return (
    <Tag className={`relative ${block ? 'block' : 'inline-block'} ${roll ? 'wt-roll overflow-hidden align-bottom' : ''} ${className}`}>
      {out && <Tag key={`out-${out.k}`} aria-hidden className={`wt-swap-out absolute inset-x-0 top-0 ${block ? 'block' : 'inline-block'}`}>{out.node}</Tag>}
      <Tag key={`in-${k}`} className={`${block ? 'block' : 'inline-block'} ${out ? 'wt-swap-in' : ''}`}>{children}</Tag>
    </Tag>
  )
}
