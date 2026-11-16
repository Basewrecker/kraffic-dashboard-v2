// A spring as a CSS / WAAPI easing: the position of a damped spring (mass 1) going from 0 to 1, sampled into a
// linear() curve, and the time it takes to settle (within 0.1% and nearly still). Transforms and opacity only; the mock
// has no motion library (the app would need the same dependency), so springs are WAAPI with this easing.
// Snappy, not floaty: stiffness 300, damping 26 (the Content deck's feel) → about 2–3% overshoot, settled in ~0.5s.

// x(t) for an underdamped / critically damped / overdamped spring released at rest at 0, target 1
export function springAt(t, { stiffness = 300, damping = 26, mass = 1 } = {}) {
  const w0 = Math.sqrt(stiffness / mass)
  const zeta = damping / (2 * Math.sqrt(stiffness * mass))
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta)
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
  }
  if (zeta === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t)
  const r1 = -w0 * (zeta - Math.sqrt(zeta * zeta - 1))
  const r2 = -w0 * (zeta + Math.sqrt(zeta * zeta - 1))
  return 1 + (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r1 - r2)
}

// seconds until the spring stays within `eps` of 1 (checked over the next 50ms too), capped at `max`
export function settleTime(opts = {}, eps = 0.001, max = 2) {
  const dt = 1 / 600
  for (let t = 0; t < max; t += dt) {
    let ok = true
    for (let k = 0; k <= 30 && ok; k++) if (Math.abs(1 - springAt(t + k * dt, opts)) > eps) ok = false
    if (ok) return t
  }
  return max
}

// { easing: 'linear(…)', duration: ms } — use with element.animate(frames, { duration, easing })
export function spring(opts = {}, points = 40) {
  const T = settleTime(opts)
  const pts = Array.from({ length: points + 1 }, (_, i) => (i === points ? 1 : +springAt((T * i) / points, opts).toFixed(4)))
  return { easing: `linear(${pts.join(', ')})`, duration: Math.round(T * 1000) }
}

// the deck's springs: snappy (300 / 26) and a slightly bouncier settle for landings (300 / 20)
export const SNAPPY = { stiffness: 300, damping: 26 }
export const SETTLE = { stiffness: 300, damping: 20 }
