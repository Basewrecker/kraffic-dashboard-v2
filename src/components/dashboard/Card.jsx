import { forwardRef } from 'react'

// ref: explain mode (ui/Insight) needs the card's box to tell "click outside the card"
const Card = forwardRef(function Card({ className = '', children, ...rest }, ref) {
  return (
    <div ref={ref} className={`rounded-2xl border border-line bg-surface ${className}`} {...rest}>
      {children}
    </div>
  )
})
export default Card
