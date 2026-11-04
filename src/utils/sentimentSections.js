// The Sentiment page's restyled sections (Over time + Pages on <date>, Sources, All pages): presentation helpers only.
// The data and its rules stay in data/sentiment.js (the app's lib/sentiment-adapter.js: runs, pages per run,
// freshPageIds, sourceCloud, sortPages); everything here reads what that data already holds, with no API call.
// The app keeps this file as lib/sentiment-sections.js (same function names). Tested in sentimentSections.test.js.
import { TONES, TONE_LABEL, countTones, freshPageIds, scoreOf, sortPages, tonePercents } from '../data/sentiment.js'

// the engines a sentiment scan runs (no Gemini), and their names everywhere on the page and in the CSVs. Google is two
// engines: 'google' = Google AI Overview, 'aimode' = Google AI Mode.
export const SENTIMENT_ENGINES = ['google', 'aimode', 'chatgpt', 'claude']
export const ENGINE_NAME = { google: 'AI Overview', aimode: 'AI Mode', chatgpt: 'ChatGPT', claude: 'Claude' }

// ---- New: the one rule behind the chip, "New only" and the tooltip's "n new pages" -----------------------------------
// A page is New on a sync when its address was never cited for the brand in ANY earlier sync, on any engine. Pages are
// matched by their id, the shared cited-page key (the app's lib/citation-rules.js: no http/https, www, fragment,
// trailing slash or tracking parameters). columns: every sync, oldest → newest, with all its pages (not one engine's). The very first
// sync has nothing before it, so it shows no New pages (Harsh's freshPageIds counts all of them as new).
export function newPageIds(columns, index) {
  if (!(index > 0)) return new Set()
  return freshPageIds(columns, index)
}
// New pages per sync: [{ date, pages, new }]
export const newCountsBySync = (columns) => (columns ?? []).map((c, i) => ({ date: c.date ?? null, pages: c.pages?.length ?? 0, new: newPageIds(columns, i).size }))

// each page's tone in a sync, by page id
export const toneById = (pages) => new Map((pages ?? []).map((p) => [p.id, p.tone]))

// a row's change vs the sync before: 'new' (Harsh's freshPageIds: the first sync it appears), a tone it had before
// ({ kind: 'was', tone, label, dir: 'down' | 'up' }), or nothing
export function rowChange(page, { fresh, prevTones }) {
  if (fresh?.has(page.id)) return { kind: 'new' }
  const was = prevTones?.get(page.id)
  if (was && was !== page.tone) return { kind: 'was', tone: was, label: `was ${TONE_LABEL[was]}`, dir: RANK[page.tone] < RANK[was] ? 'down' : 'up' }
  return null
}
// the order tones go in: down = got worse (e.g. neutral → negative), up = got better
const RANK = { negative: 0, mixed: 1, neutral: 2, unscored: 2, positive: 3 }

// pages negative in this sync that the sync before cited with another tone
export const turnedNegative = (pages, prevPages) => {
  const before = toneById(prevPages)
  return (pages ?? []).filter((p) => p.tone === 'negative' && before.has(p.id) && before.get(p.id) !== 'negative')
}

// the Pages on <date> filters, combined with AND: tone ('all' or one), engines (the ones switched on), new only, a
// domain search
export function filterSyncPages(pages, { tone = 'all', engines = null, newOnly = false, q = '', fresh = null } = {}) {
  const needle = String(q || '').trim().toLowerCase()
  return (pages ?? []).filter((p) => (tone === 'all' || p.tone === tone)
    && (!engines || p.engines.some((e) => engines.includes(e)))
    && (!newOnly || fresh?.has(p.id))
    && (!needle || String(p.domain || '').toLowerCase().includes(needle)))
}

// the engines a sync's pages ran on, in the scan's order
export const enginesIn = (pages) => SENTIMENT_ENGINES.filter((e) => (pages ?? []).some((p) => p.engines.includes(e)))

// ---- what a row shows: the New chip before the title, the tone (line 1) and, when it changed, "from <tone>" (line 2)
// in a sync: from = its tone in the sync before, when that was another tone
export function syncMarks(page, { fresh, prevTones }) {
  const was = prevTones?.get(page.id)
  return { isNew: Boolean(fresh?.has(page.id)), tone: page.tone, from: was && was !== page.tone ? `from ${TONE_LABEL[was]}` : null, gone: false }
}
// in a comparison: a page only in To says it wasn't in From; one only in From is "Not cited" now, from its old tone
export function compareMarks(entry, { fresh, fromLabel }) {
  const { from, to, page } = entry
  if (!to) return { isNew: false, tone: from.tone, from: `from ${TONE_LABEL[from.tone]}`, gone: true }
  return { isNew: Boolean(fresh?.has(page.id)), tone: to.tone, from: !from ? `not on ${fromLabel}` : from.tone !== to.tone ? `from ${TONE_LABEL[from.tone]}` : null, gone: false }
}

// ---- Compare: two syncs, one row per page ---------------------------------------------------------------------------
// entries: { page (To's, else From's), from, to, change }; the list draws them and the CSV writes them
export function compareEntries(fromPages, toPages, { engines = null, onlyChanged = false } = {}) {
  const keep = (p) => !engines || p.engines.some((e) => engines.includes(e))
  const from = new Map((fromPages ?? []).filter(keep).map((p) => [p.id, p]))
  const to = new Map((toPages ?? []).filter(keep).map((p) => [p.id, p]))
  const ids = [...new Set([...to.keys(), ...from.keys()])]
  const out = ids.map((id) => {
    const a = from.get(id) ?? null
    const b = to.get(id) ?? null
    return { page: b ?? a, from: a, to: b, change: !a ? 'new' : !b ? 'dropped' : a.tone !== b.tone ? 'tone changed' : 'same' }
  })
  return onlyChanged ? out.filter((e) => e.change !== 'same') : out
}
export const changedCount = (entries) => (entries ?? []).filter((e) => e.change !== 'same').length

// the comparison as the list shows it: the same filters as a sync (tone = the row's tone now, or its old tone when it
// dropped out; New only = New on the To sync), sorted like a sync's pages with the changed rows first
const CHANGE_RANK = { 'tone changed': 0, new: 1, dropped: 2, same: 3 }
export function compareList(entries, { tone = 'all', engines = null, newOnly = false, q = '', fresh = null } = {}) {
  const shown = (entries ?? []).map((e) => ({ ...e.page, tone: (e.to ?? e.from).tone, entry: e }))
  const kept = filterSyncPages(shown, { tone, engines, newOnly, q, fresh })
  return sortPages(kept).sort((a, b) => CHANGE_RANK[a.entry.change] - CHANGE_RANK[b.entry.change])
}

// change: new (only in To) | dropped (only in From) | tone changed | same. engines: the active engine filter. hrefOf: the
// page's normalised link (the page passes spectrum's pageHref: no tracking parameters or fragment), as the page links it.
export const compareCsvRow = ({ page: p, from: a, to: b, change }, hrefOf = (x) => x.url) => (
  { url: hrefOf(p) ?? p.url ?? '', title: p.title ?? '', domain: p.domain ?? '', engines: p.engines.join(';'), tone_from: a?.tone ?? '', tone_to: b?.tone ?? '', change }
)
export function compareRows(fromPages, toPages, { engines = null, onlyChanged = false, hrefOf = (p) => p.url } = {}) {
  return compareEntries(fromPages, toPages, { engines, onlyChanged }).map((e) => compareCsvRow(e, hrefOf))
}

export const CSV_COLUMNS = ['url', 'title', 'domain', 'engines', 'tone_from', 'tone_to', 'change', 'brand']
const cell = (v) => {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
// engines are written by name (Google;ChatGPT;Claude), as the page names them
const engineNames = (v) => String(v ?? '').split(';').filter(Boolean).map((e) => ENGINE_NAME[e] ?? e).join(';')
const toCsv = (columns, rows, brand) => [columns.join(','), ...rows.map((r) => columns.map((k) => cell(k === 'brand' ? brand : k === 'engines' ? engineNames(r[k]) : r[k])).join(','))].join('\n') + '\n'
export const compareCsv = (rows, brand) => toCsv(CSV_COLUMNS, rows, brand)

// one sync's pages as the list shows them (filters applied): the tone at that sync and New (2026-11-01: no tone_before;
// tone_from / tone_to stay in the Compare CSV only)
export const SYNC_CSV_COLUMNS = ['url', 'title', 'domain', 'engines', 'tone', 'new', 'brand']
export function syncCsv(pages, { brand, fresh = null, prevTones = null, hrefOf = (p) => p.url } = {}) {
  const rows = (pages ?? []).map((p) => {
    return { url: hrefOf(p) ?? p.url ?? '', title: p.title ?? '', domain: p.domain ?? '', engines: p.engines.join(';'), tone: p.tone, new: fresh?.has(p.id) ? 'yes' : '' }
  })
  return toCsv(SYNC_CSV_COLUMNS, rows, brand)
}
export const syncFilename = (brand, date) => `sentiment-${slug(brand)}-${date}.csv`
const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'brand'
export const compareFilename = (brand, from, to) => `sentiment-${slug(brand)}-${from}-vs-${to}.csv`

// ---- Sources: Harsh's sourceCloud rows in two columns ------------------------------------------------------------------
// Leaning negative: more often negative than positive; Leaning positive: the reverse; a site as often one as the other
// sits in both. Neutral-only sites are already left out by sourceCloud. Per site and column: count (its pages in that
// tone across every sync, Harsh's number), syncs (the syncs it was in that tone at least once: the row's "5/6" and bar),
// last (its newest page in that tone: the stat lead's Open page). Each column sorted by syncs, then count.
export function sourceColumns(cloud) {
  const col = (tone, other) => (cloud ?? [])
    .filter((s) => s[tone] > 0 && s[tone] >= s[other])
    .map((s) => {
      const hits = s.hits.filter((h) => h.tone === tone)
      const last = [...hits].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))[0] ?? null
      return { ...s, count: s[tone], syncs: new Set(hits.map((h) => h.date)).size, last, engines: SENTIMENT_ENGINES.filter((e) => s.hits.some((h) => (h.engines ?? []).includes(e))) }
    })
    .sort((a, b) => b.syncs - a.syncs || b.count - a.count || a.domain.localeCompare(b.domain))
  return { negative: col('negative', 'positive'), positive: col('positive', 'negative') }
}

// the two Sources columns, evened out: when one column runs more than a row longer, it shows as many rows as the other
// (at least 3) and a "+n more" row; a gap of one row or less stays as it is
export function evenColumns(a, b, min = 3) {
  const cap = (list, other) => (list.length - other.length > 1 ? Math.min(list.length, Math.max(other.length, min)) : list.length)
  const n = cap(a, b), m = cap(b, a)
  return { a: { shown: a.slice(0, n), more: a.length - n }, b: { shown: b.slice(0, m), more: b.length - m } }
}

// the lead quote of a Sources column: the top site's quote (the brand analysis's snippet, on the latest run's page from
// that site). No quote → null (the column starts with its rows). Never a placeholder.
export function sourceLead(top, latestPages) {
  if (!top) return null
  const page = (latestPages ?? []).find((p) => p.domain === top.domain && p.sentences?.[0]?.text)
  return page ? { page, quote: page.sentences[0] } : null
}

// "Also said on": other sites that share a theme (the brand analysis's SWOT) with the page. Empty when the page isn't
// in the latest analysis or no theme cites it.
export function alsoSaidOnSites(page, swot, latestPages) {
  if (!page || !swot) return []
  const byId = new Map((latestPages ?? []).map((p) => [p.id, p]))
  if (!byId.has(page.id)) return []
  const out = new Map()
  for (const list of Object.values(swot)) {
    for (const t of list ?? []) {
      if (!(t.sources ?? []).includes(page.id)) continue
      for (const id of t.sources) {
        const p = byId.get(id)
        if (p && p.domain && p.domain !== page.domain && !out.has(p.domain)) out.set(p.domain, p)
      }
    }
  }
  return [...out.values()]
}

// a sync's tooltip numbers: Positive n (x%) · Neutral n · Negative n
export const tipCounts = (counts, pct) => TONES.map((t) => ({ tone: t, n: counts[t], pct: pct[t] }))

// ---- All pages: the sort pills (Tone / Title / Engines) ----------------------------------------------------------------
// Tone: Negative → Neutral → Positive, then title A–Z; Title: A–Z; Engines: most engines first, then title. Titles compare
// in natural order ("review 2" before "review 10"), case- and accent-insensitive.
const ALL_TONE_ORDER = { negative: 0, neutral: 1, positive: 2 }
const byTitle = (a, b) => String(a.title ?? '').localeCompare(String(b.title ?? ''), undefined, { numeric: true, sensitivity: 'base' })
export const ALL_PAGE_SORTS = ['tone', 'title', 'engines']
export function sortAllPages(pages, key = 'tone') {
  const list = [...(pages ?? [])]
  if (key === 'title') return list.sort(byTitle)
  if (key === 'engines') return list.sort((a, b) => (b.engines?.length ?? 0) - (a.engines?.length ?? 0) || byTitle(a, b))
  return list.sort((a, b) => (ALL_TONE_ORDER[a.tone] ?? 1) - (ALL_TONE_ORDER[b.tone] ?? 1) || byTitle(a, b))
}

// ---- Over time: which side of a bar its card opens on -----------------------------------------------------------------
// The card's left edge (px, in the chart column): to the right of the bar (12px off) only if it fits inside the column,
// else to its left; neither fits: kept inside the column. Decided per bar from the column's width, so the same bar always
// opens on the same side and the card never crosses into the Pages column.
export const SYNC_TIP_W = 240
export function tipLeft(barX, barW, columnW, tipW = SYNC_TIP_W, gap = 12) {
  const right = barX + barW / 2 + gap
  if (right + tipW <= columnW) return right
  const left = barX - barW / 2 - gap - tipW
  if (left >= 0) return left
  return Math.max(0, Math.min(columnW - tipW, left))
}

// ---- the hero's change arrow: the score against the sync before ---------------------------------------------------
// up: ▲ +3 (green), down: ▼ −3 (red, a true minus sign); no arrow when there's no sync before, either score is missing
// (a gap, never 0) or nothing changed (the line under the score says "No change since …")
export function scoreChange(score, prevScore) {
  if (score == null || prevScore == null || !Number.isFinite(score) || !Number.isFinite(prevScore)) return null
  const delta = Math.round(score) - Math.round(prevScore)
  if (!delta) return null
  return { delta, dir: delta > 0 ? 'up' : 'down', arrow: delta > 0 ? '▲' : '▼', text: delta > 0 ? `+${delta}` : `−${-delta}` }
}

// ---- Over time: Score's latest-sync card shows only while the section is idle -------------------------------------
// The card beside the chart is for a passer-by: it shows while Score is on screen through the auto-cycle and nobody is
// using the section. The pointer over it, keyboard focus in it, or a choice (Mix / Score, a point: auto stops) hides
// it, and the chart is exactly as it is without it (full width, every date, "Neutral", the normal hover card). When
// the pointer leaves and the auto-cycle runs again on Score, it can come back.
export function scoreCardDocked({ view, auto, pointerIn, focusIn }) {
  return view === 'score' && Boolean(auto) && !pointerIn && !focusIn
}

// ---- one sync, read once for the whole page (2026-11-02) ------------------------------------------------------------
// Every sync as a column: its pages (on the engine picked in the header, 'all' = every page), their tone counts and
// shares. The hero (score, dot plot, its axis), This sync, the chart's tooltip and the Pages list all read the SAME
// column for the picked sync, so they can't disagree. pagesOf(run): the sync's own pages (data/sentiment.js runPages).
export function syncColumns(runs, pagesOf, engine = 'all') {
  return (runs ?? []).map((r) => {
    const all = pagesOf(r) ?? []
    const pages = engine === 'all' ? all : all.filter((p) => p.engines.includes(engine))
    const counts = countTones(pages)
    return { r, date: r.date, all, pages, counts, pct: tonePercents(counts) }
  })
}

// ---- the scoring change (2026-11-02) ----------------------------------------------------------------------------------
// How a sync's score is worked out changed when Harsh's Mixed / Not scored scoring went live (the deploy of 73dff06).
// reputation_scans stores no method or version, so this is a date cutoff on the sync's created_at, not a stored marker:
// a sync created at or after this moment was scored the new way.
export const SCORING_UPDATED = '2026-11-02T08:35:42Z'
export const SCORING_UPDATED_TIP = 'How the score is worked out changed on Nov 2, so it isn’t compared with earlier syncs.'
const newMethod = (run) => Boolean(run?.createdAt) && Date.parse(run.createdAt) >= Date.parse(SCORING_UPDATED)
// true on the first sync scored the new way when there is a sync before it (scored the old way): its change against that
// sync is not shown. The sync after it compares normally.
export const scoringChangedAt = (cols, i) => i > 0 && newMethod(cols?.[i]?.r) && !newMethod(cols?.[i - 1]?.r)

// The score change of sync i against the sync before: the ONE calculation behind the line under the score, the arrow
// beside it and the Over time tooltip (2026-11-02: the line read pages that changed tone instead, so Oct 28 at 81 after
// Oct 27 at 66 said "No change since Oct 27"). Both scores are scoreOf(column counts).
//   { first: true }                          the first sync (nothing before it)
//   { delta: null, since }                   a gap: either sync has no score ("—", never 0)
//   { delta: null, since, scoringUpdated }   the first sync scored the new way (scoringChangedAt): not compared
//   { delta, since, ...scoreChange(...) }    delta 0 = truly no change; otherwise dir / arrow / text as scoreChange
export function syncScoreChange(cols, i) {
  const col = cols?.[i]
  if (!col) return null
  const score = scoreOf(col.counts)
  if (!(i > 0)) return { first: true, score, prevScore: null, delta: null, since: null }
  const prev = cols[i - 1]
  const prevScore = scoreOf(prev.counts)
  const since = prev.date ?? null
  if (scoringChangedAt(cols, i)) return { first: false, score, prevScore, delta: null, since, scoringUpdated: true }
  if (score == null || prevScore == null) return { first: false, score, prevScore, delta: null, since }
  const delta = score - prevScore
  return { first: false, score, prevScore, since, ...(scoreChange(score, prevScore) ?? { dir: 'same', arrow: '', text: '0' }), delta }
}

// The line under the score: "▲ +15 since Oct 27" (up, green), "▼ −3 since Oct 14" (down, red), "No change since
// Oct 27" only when the difference is truly 0, "First run" on the first sync (both muted), "Scoring updated Nov 2" on
// the first sync scored the new way (muted, no arrow); null for a gap. day: formats the sync's date ("Oct 27").
export function scoreChangeLine(change, day = (d) => d) {
  if (!change) return null
  if (change.first) return 'First run'
  if (change.scoringUpdated) return `Scoring updated ${day(SCORING_UPDATED.slice(0, 10))}`
  if (change.delta == null) return null
  if (change.delta === 0) return `No change since ${day(change.since)}`
  return `${change.arrow} ${change.text} since ${day(change.since)}`
}

// The hero's tone filter (a click on Negative / Neutral / Positive under the dot plot) belongs to the sync it was set
// on: picking another sync shows every one of that sync's pages again (2026-11-02: a Negative filter set on the latest
// sync carried over, so Oct 28 showed its one negative dot and dimmed the other 15). filter: { runId, tone }.
export const heroTone = (filter, runId) => (filter && filter.runId === runId ? filter.tone ?? null : null)
