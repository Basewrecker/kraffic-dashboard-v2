// Why a control is off: wraps a disabled button and shows the reason in the dark tip on hover and keyboard focus
// (the wrapper takes focus, since a disabled button can't). With no reason it draws just the children.
// align: which edge of the control the tip lines up with.
export default function LimitTip({ reason, align = 'right', className = '', children }) {
  if (!reason) return children
  return (
    <span tabIndex={0} aria-label={reason} className={`group/lt relative inline-flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus ${className}`}>
      {children}
      <span role="tooltip" className={`tip-dark pointer-events-none absolute top-full z-40 mt-2 w-max text-left font-normal opacity-0 transition-opacity duration-150 group-hover/lt:opacity-100 group-focus-visible/lt:opacity-100 ${align === 'left' ? 'left-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-0'}`}>{reason}</span>
    </span>
  )
}
