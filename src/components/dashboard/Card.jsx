import { forwardRef } from 'react'

// ref: explain mode (ui/Insight) needs the card's box to tell "click outside the card"
// bare: no border or background (a card inside another surface, e.g. the Reports main card)
const Card = forwardRef(function Card({ className = '', bare = false, children, ...rest }, ref) {
  return (
    <div ref={ref} className={`${bare ? '' : 'rounded-2xl border border-line bg-surface '}${className}`} {...rest}>
      {children}
    </div>
  )
})
export default Card
