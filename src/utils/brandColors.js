// Ported from the app (lib/brand-colors.js, 2026-11-03); the app keeps its copy in lib/, the same functions and names.
// One colour per brand, shared by Share of voice (pie, list dots) and Visibility history (lines, bars, chips), so a
// brand has the same colour everywhere. Pure functions only (no DOM): src/hooks/useBrandColors.js builds
// the map from each brand's appearances. Brands take a fixed palette by rank (owner, 2026-11-03); logo colours are
// no longer read (owner, 2026-11-03: the logo-colour code and its tests were removed).
// A colour is a CSS value, light-dark(<light>, <dark>), so it follows the theme with no JavaScript.

// ---- colour maths (hex ↔ RGB ↔ HSL) -----------------------------------------------------------------------------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export const rgbToHex = (rgb) => `#${rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`
export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
export function hslToRgb([h, s, l]) {
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const fn = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [fn(0) * 255, fn(8) * 255, fn(4) * 255]
}
export const cssColor = ({ light, dark }) => `light-dark(${light}, ${dark})`

// the "Other brands" slice (and the dots of the brands in it): a mid graphite with 3:1 on the card in both themes,
// never the near-white tint
export const OTHER_COLOR = 'var(--color-stone-500)'

// ---- the brand palette by rank (owner, 2026-11-03) ---------------------------------------------------------------
// Share of voice and Visibility history no longer take a brand's colour from its logo: brands take this fixed cool
// palette by rank (the most appearances first, exact counts; a tie keeps the tracked order), one map for both cards
// (rankColors), so a brand has one colour everywhere on the page. Light: the owner's values as given; dark: the same
// hues, HSL lightness +8% (darkStep). An 8th brand or later has no palette colour: it's in "Other brands" (OTHER_COLOR).
// Solid fills, no gradient or glow.
export const BRAND_PALETTE = ['#4F46E5', '#6366F1', '#38BDF8', '#818CF8', '#A78BFA', '#C084FC', '#E879F9'] // indigo, periwinkle, sky, soft indigo, lavender, violet, pink
export const BRAND_PALETTE_DARK = ['#716AEA', '#888BF4', '#5FCAF9', '#A8AFFA', '#C5B2FC', '#D4ACFD', '#EFA0FB'] // darkStep of each
export const DARK_STEP = 0.08
export const darkStep = (hex) => { const [h, s, l] = rgbToHsl(hexToRgb(hex)); return rgbToHex(hslToRgb([h, s, Math.min(1, l + DARK_STEP)])) }
// brands: [{ domain, count }] in tracked order → { domain: { light, dark, css, rank } } for the first 7 by count;
// later brands are left out (the caller's fallback: OTHER_COLOR)
export function rankColors(brands) {
  const sorted = (brands ?? []).map((b, i) => ({ b, i })).filter((x) => x.b?.domain)
    .sort((a, b) => (b.b.count ?? 0) - (a.b.count ?? 0) || a.i - b.i).map((x) => x.b)
  const out = {}
  sorted.slice(0, BRAND_PALETTE.length).forEach((b, i) => {
    const light = BRAND_PALETTE[i], dark = BRAND_PALETTE_DARK[i]
    out[b.domain] = { light, dark, css: cssColor({ light, dark }), rank: i + 1 }
  })
  return out
}
