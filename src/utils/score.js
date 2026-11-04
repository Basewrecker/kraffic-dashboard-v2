// A score that's missing (an engine whose latest scan didn't answer) is null and shows as "—", never 0
// (CLAUDE.md §3, DESIGN.md §7). Every score display formats through here.
import { engineName } from '../data/brandViews.js'

export const NO_SCORE = '—'

// a real score: a finite number (0 included); null, undefined and NaN aren't
export const isScore = (v) => typeof v === 'number' && Number.isFinite(v)

// 73 → "73", 73 with '%' → "73%"; no score → "—" (never "0", never "null%")
export const fmtScore = (v, unit = '') => (isScore(v) ? `${Math.round(v)}${unit}` : NO_SCORE)

// the ⓘ beside a "—": "No result from Gemini in the latest scan"
export const noResultText = (engine) => `No result from ${engineName(engine)} in the latest scan`
