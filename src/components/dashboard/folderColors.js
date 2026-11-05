// Cited pages by folder: Share of voice's palette (utils/brandColors.js), the same values and dark-mode steps, by rank:
// the biggest folder indigo, then periwinkle, sky, soft indigo, lavender, violet; "Other n folders" the palette's pink
// (owner, 2026-11-04). No new colours: light-dark() of BRAND_PALETTE / BRAND_PALETTE_DARK.
import { BRAND_PALETTE, BRAND_PALETTE_DARK, cssColor } from '../../utils/brandColors'
import { colorIndex } from '../../utils/citedFolders'

export const folderColor = (rank, key) => {
  const i = colorIndex(rank, key)
  return cssColor({ light: BRAND_PALETTE[i], dark: BRAND_PALETTE_DARK[i] })
}
