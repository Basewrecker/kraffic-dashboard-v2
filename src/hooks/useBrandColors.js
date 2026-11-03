import { useMemo } from 'react'
import { TRACKED_BRANDS, getBrandView } from '../data/brandViews'
import { rankColors } from '../utils/brandColors'

// Every brand's colour, the same map for Share of voice and Visibility history: { domain: { css, light, dark, rank } }.
// The fixed palette by rank (utils/brandColors.js rankColors, owner 2026-11-03): brands ordered by their exact
// appearances on the page's engine (the count Share of voice shows), most first; a tie keeps the tracked order. Logo
// colours are never read. A brand past the 7th has no entry (the cards use OTHER_COLOR).
// (The app's copy also re-reads when its data loads: that subscription lives in the app only.)
export function brandColorMap(engine = 'all') {
  const count = (d) => { try { return getBrandView(d, engine)?.kpis?.visible ?? 0 } catch { return 0 } }
  return rankColors(TRACKED_BRANDS.map((b) => ({ domain: b.domain, count: count(b.domain) })))
}

export function useBrandColors(engine = 'all') {
  const domains = TRACKED_BRANDS.map((b) => b.domain).join('|')
  return useMemo(() => brandColorMap(engine), [engine, domains])
}
