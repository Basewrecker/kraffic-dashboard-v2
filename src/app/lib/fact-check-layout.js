// Fact Check's two columns (app, owner 2026-11-11): every card takes its natural height. When the columns end at
// different heights, only the last card of the shorter column may grow to meet the other's bottom edge, by bottom
// padding inside it, up to `max` px; beyond that the bottoms stay uneven.
// catchUp(leftH, rightH, max) → { side: 'left' | 'right' | null, px }: the columns' natural heights (without any
// catch-up already applied) in; which column's last card gets how much bottom padding out.
export const CATCH_UP_MAX = 48

export function catchUp(leftH, rightH, max = CATCH_UP_MAX) {
  const l = Number(leftH), r = Number(rightH)
  if (!Number.isFinite(l) || !Number.isFinite(r) || l <= 0 || r <= 0) return { side: null, px: 0 }
  const px = Math.round(Math.abs(l - r))
  if (px === 0 || px > max) return { side: null, px: 0 }
  return { side: l < r ? 'left' : 'right', px }
}

// app (owner, 2026-11-12): no sticky column (stickySide removed): the page scrolls as one.
