// Synthetic "live facts": the two sample brands in the exact shape the app's API returns (lib/report-facts.ts →
// accountFacts, see the field list below), derived from this repo's sample datasets so every number agrees with the
// rest of the mock. Lumen Skin has ONE scan, so the missing-history states (no change chips, no trends, "Not in this
// report yet") are always visible. The report pages set these on the live-facts store and write every report
// through the app's own adapter (live-report.js, copied unchanged), so designs are built on the live data shape.
//
// accountFacts fields: brandId · name · domain · prompts · scans · score · visible · missed · youShare · compared ·
// since · gained[] · lost[] (prompt texts) · ran[] · engines[{ id, name, visible }] · competitors[{ key, domain,
// name, share }] · missedRows[{ prompt, competitors[] (domains) }] · cited[{ path, n }] · points[{ date, iso, score, visible }]
import { DATES, ENGINE_NAMES, dataFor } from './reports.js'
import { brandName } from '../utils/brand.js'

const ISO = { 'Sep 7': '2026-09-07', 'Sep 14': '2026-09-14', 'Sep 21': '2026-09-21', 'Sep 28': '2026-09-28', 'Oct 5': '2026-10-05', 'Oct 12': '2026-10-12', 'Oct 19': '2026-10-19', 'Oct 26': '2026-10-26' }
export const LIVE_FACTS_FIELDS = ['brandId', 'name', 'domain', 'prompts', 'scans', 'score', 'visible', 'missed', 'youShare', 'compared', 'since', 'gained', 'lost', 'ran', 'engines', 'competitors', 'missedRows', 'cited', 'points']

// two more data situations on the same datasets: Brightside Botanics is named on every prompt; Northwind Derm is missing 45% of its prompts
const VARIANT = { brightside: { base: 'dermasuri', name: 'Brightside Botanics', domain: 'brightsidebotanics.com', missedShare: 0 }, 'northwind-derm': { base: 'foa', name: 'Northwind Derm', domain: 'northwindderm.com', missedShare: 0.45 } }
// the facts for a brand, from its last `scans` weekly syncs (null for a brand the mock has no dataset for)
export function sampleFacts(brandId, scans = brandId === 'lumen' ? 1 : DATES.length) {
  const v = VARIANT[brandId]
  if (v) {
    const f = sampleFacts(v.base, scans)
    const d0 = dataFor(v.base)
    const rivalOf = (key) => f.competitors.find((c) => c.key === key)?.domain ?? f.competitors[0].domain
    // the missed prompts: the dataset's gaps, then the prompts a rival wins, then the ones that moved (no text invented)
    const pool = [...f.missedRows, ...Object.entries(d0.h2h).flatMap(([k, h]) => h.themes.flatMap((t) => t.prompts.map((prompt) => ({ prompt, competitors: [rivalOf(k)] })))), ...d0.moved['30d'].flatMap((m) => m.prompts.map((prompt) => ({ prompt, competitors: [] })))]
    const seen = new Set()
    const unique = pool.filter((r) => !seen.has(r.prompt) && seen.add(r.prompt))
    const missed = Math.min(Math.round(f.prompts * v.missedShare), unique.length) // the count is the rows, never more
    const rows = unique.slice(0, missed)
    // a lost prompt is one of its missed rows (the base brand's lost prompts that this brand still misses)
    return { ...f, brandId, name: v.name, domain: v.domain, visible: f.prompts - missed, missed, missedRows: rows, lost: f.lost.filter((p) => rows.some((r) => r.prompt === p)), points: f.points.map((p) => ({ ...p, visible: p.visible == null ? null : Math.min(f.prompts, Math.round((p.visible * (f.prompts - missed)) / f.visible)) })) }
  }
  const d = dataFor(brandId)
  if (!d) return null
  const youKey = Object.keys(d.share)[0]
  const n = Math.max(1, Math.min(scans, DATES.length))
  const from = DATES.length - n
  const points = DATES.slice(from).map((date, k) => ({ date, iso: ISO[date], score: d.series.score[from + k], visible: d.series.named[from + k] }))
  const compared = n > 1
  const moved = d.moved.week
  return {
    brandId, name: d.name, domain: d.domain,
    prompts: d.prompts, scans: n,
    score: d.series.score.at(-1), visible: d.series.named.at(-1), missed: d.prompts - d.series.named.at(-1),
    youShare: d.share[youKey].at(-1),
    compared, since: compared ? DATES.at(-2) : null,
    gained: compared ? moved.filter((m) => m.d > 0).flatMap((m) => m.prompts.slice(0, m.d)) : [],
    lost: compared ? moved.filter((m) => m.d < 0).flatMap((m) => m.prompts.slice(0, -m.d)) : [],
    ran: [...d.ran],
    engines: d.ran.map((id) => ({ id, name: ENGINE_NAMES[id], visible: d.engines[id]?.named ?? 0 })),
    competitors: d.rivals.map((r) => ({ key: r.key, domain: r.domain, name: brandName(r.domain), share: d.share[r.key].at(-1) })),
    // competitors are DOMAINS, as the app's winnersOf returns them (the adapter names them with nameOf)
    missedRows: d.gaps.flatMap((g) => g.prompts.map((prompt, i) => ({ prompt, competitors: i < g.owned ? [d.rivals.find((r) => r.key === g.owner)?.domain ?? g.owner] : [] }))),
    cited: d.cited.map((c) => ({ path: c.path, n: c.n })),
    points,
  }
}
