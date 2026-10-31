// PROPOSED FIELDS (Reports v4, ?fields=proposed). The live facts (accountFacts, lib/report-facts.ts) don't carry these
// yet; docs/proposals-for-harsh.md lists each one, where it already exists in the app or where it would come from, and
// the report sections it unlocks. Here they're read from this repo's sample datasets (data/reports.js), which already
// hold them, so nothing is invented: no prompt text, topic or page that isn't in a dataset. The two variant brands
// (Brightside named everywhere, Northwind missing 45%) take their base brand's fields, recounted from their own rows.
//
// Every field added is marked PROPOSED below. Without ?fields=proposed the report never sees them.
import { DATES, dataFor } from './reports.js'
import { sampleFacts } from './live-facts-sample.js'

export const PROPOSED_FIELDS = ['missedRows[].topic', 'missedRows[].engines', 'headToHead[]', 'topics[]', 'topicShare[]', 'competitors[].points', 'competitors[].cited', 'points[].share', 'points[].gained', 'points[].lost', 'lostRows[]']
const BASE = { foa: 'foa', dermasuri: 'dermasuri', lumen: 'dermasuri', brightside: 'dermasuri', 'northwind-derm': 'foa' }
const DS_KEY = { foa: 'foa', dermasuri: 'dermasuri', lumen: 'dermasuri', brightside: 'dermasuri', 'northwind-derm': 'foa' }

// prompt → topic, from every place a dataset names a prompt with its topic
function topicMap(d) {
  const m = new Map()
  const add = (theme, prompts) => prompts.forEach((p) => m.has(p) || m.set(p, theme))
  d.gaps.forEach((g) => add(g.theme, g.prompts))
  Object.values(d.h2h).forEach((h) => h.themes.forEach((t) => add(t.theme ?? t.label, t.prompts)))
  ;['week', '30d'].forEach((k) => d.moved[k].forEach((t) => add(t.theme ?? t.label, t.prompts)))
  return m
}

// all = false: only the fields the app is adding now (topic and engine on the prompt rows, the topic of a lost prompt);
// all = true (?fields=proposed): every field in docs/proposals-for-harsh.md
export function proposedFacts(brandId, scans, { all = true } = {}) {
  const facts = sampleFacts(brandId, scans)
  if (!facts) return null
  const baseId = BASE[brandId]
  const d = dataFor(DS_KEY[brandId])
  if (!baseId || !d) return facts
  const base = sampleFacts(baseId, scans)
  const topicOf = topicMap(d)
  const n = facts.points.length
  const from = DATES.length - n
  const domainOf = (key) => d.rivals.find((r) => r.key === key)?.domain
  const youKey = Object.keys(d.share)[0]

  // PROPOSED missedRows[].topic and .engines: the dataset's topic; the engine that named the competitor (the dataset's
  // per-prompt wins; AI Overview is its default), else none known
  // prompt → engine, per competitor (the engine is the one that named that competitor)
  const winsBy = new Map()
  const engineFor = new Map() // `${domain}|${prompt}` → engine
  Object.entries(d.h2h).forEach(([key, h]) => {
    const dom = domainOf(key)
    h.themes.forEach((t) => t.prompts.forEach((p) => { const e = h.wins?.[p]?.engine ?? 'aio'; engineFor.set(`${dom}|${p}`, e); winsBy.set(p, e) }))
  })
  const missedRows = facts.missedRows.map((r) => {
    const e = r.competitors.map((c) => engineFor.get(`${c}|${r.prompt}`)).find(Boolean)
    return { ...r, topic: topicOf.get(r.prompt) ?? null, engines: e ? [e] : [] }
  })

  // PROPOSED lostRows[]: the prompts lost since the sync before, with their topic (ADDING: topic)
  const lostRows = (facts.lost || []).map((prompt) => ({ prompt, topic: topicOf.get(prompt) ?? null }))
  if (!all) return { ...facts, missedRows, lostRows, adding: true }

  // PROPOSED headToHead[]: per competitor, the prompts where both are named and who's named first, and the prompts
  // they win (only them, or named first) with topic and engine; a brand named everywhere keeps only the ones where
  // both are named
  const headToHead = Object.entries(d.h2h).map(([key, h]) => {
    const youFirst = Math.min(h.youFirst, facts.visible)
    const themFirst = Math.min(h.themFirst, facts.visible - youFirst)
    const dom = domainOf(key)
    const baseOnly = new Set(base.missedRows.filter((r) => r.competitors.includes(dom)).map((r) => r.prompt))
    const ownOnly = new Set(missedRows.filter((r) => r.competitors.includes(dom)).map((r) => r.prompt))
    const wins = h.themes.flatMap((t) => t.prompts.map((prompt) => ({ prompt, topic: t.theme, engine: winsBy.get(prompt) ?? 'aio' })))
      .filter((w) => ownOnly.has(w.prompt) || !baseOnly.has(w.prompt))
    return { domain: dom, themFirst, youFirst, theyWin: h.theyWin.slice(from), youWin: h.youWin.slice(from), wins }
  })

  // PROPOSED topics[]: per topic, the prompts that name you and each competitor. The dataset's counts, moved by the
  // difference between this brand's missed rows and its base brand's in that topic (yours; theirs stay)
  const baseMissed = new Map()
  base.missedRows.forEach((r) => { const t = topicOf.get(r.prompt); if (t) baseMissed.set(t, (baseMissed.get(t) || 0) + 1) })
  const ownMissed = new Map()
  missedRows.forEach((r) => { if (r.topic) ownMissed.set(r.topic, (ownMissed.get(r.topic) || 0) + 1) })
  const topics = []
  Object.entries(d.h2h).forEach(([key, h]) => {
    const dom = domainOf(key)
    ;(h.byTopic || []).forEach((t) => {
      let row = topics.find((x) => x.topic === t.theme)
      if (!row) { row = { topic: t.theme, visible: Math.max(0, t.you + (baseMissed.get(t.theme) || 0) - (ownMissed.get(t.theme) || 0)), competitors: [] }; topics.push(row) }
      row.competitors.push({ domain: dom, n: t.them }) // a prompt that names you too still names them
    })
  })

  // PROPOSED topicShare[]: share-of-voice lead per topic (points), its leader and its weekly trend
  const topicShare = (d.topicLead || []).map((t) => ({ topic: t.theme, lead: t.d, leader: t.who ?? null, trend: t.trend.slice(from) }))

  // PROPOSED competitors[].points (share per sync) and .cited (the page AI cites for them, per topic)
  const competitors = facts.competitors.map((c) => {
    const h = d.h2h[c.key]
    return { ...c, points: (d.share[c.key] || []).slice(from).map((share, i) => ({ iso: facts.points[i]?.iso, date: facts.points[i]?.date, share })),
      cited: h ? h.citedThem.map((p) => ({ path: p.path, n: p.n, topics: h.why.filter((w) => w.them?.path === p.path).map((w) => w.theme) })) : [],
      why: h ? h.why : [] }
  })

  // PROPOSED points[].share (ours), .gained and .lost (prompts won and lost at that sync)
  const points = facts.points.map((p, i) => ({ ...p, share: d.share[youKey]?.[from + i] ?? null, gained: d.wonSeries?.[from + i] ?? null, lost: d.lostSeries?.[from + i] ?? null }))
  if (points[0]) { points[0].gained = null; points[0].lost = null } // the first sync in view has nothing before it

  return { ...facts, lostRows, missedRows, headToHead, topics, topicShare, competitors, points, proposed: true }
}
