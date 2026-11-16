// The Sentiment page's restyled sections (Over time + Pages on <date>, Sources, All pages): presentation helpers only.
// The data and its rules stay in lib/sentiment-adapter.js (Harsh's: runs, pages per run, freshPageIds, sourceCloud,
// sortPages); everything here reads what that adapter already loaded, with no API call.
import { TONE_LABEL, OPINION_TONES, SCORED_TONES, countTones, freshPageIds, opinionPercents, scoreOf, sortPages, tonePercents } from './sentiment-adapter.js'
import { csvCell } from './csv-cell.js'

// the engines a sentiment scan runs (no Gemini), and their names everywhere on the page and in the CSVs
export const SENTIMENT_ENGINES = ['google', 'chatgpt', 'claude']
export const ENGINE_NAME = { google: 'Google', chatgpt: 'ChatGPT', claude: 'Claude' }

// ---- New: the one rule behind the chip, "New only" and the tooltip's "n new pages" -----------------------------------
// A page is New on a sync when its address was never cited for the brand in ANY earlier sync, on any engine. Pages are
// matched by their id, the shared cited-page key (lib/citation-rules.js: no http/https, www, fragment, trailing slash
// or tracking parameters). columns: every sync, oldest → newest, with all its pages (not one engine's). The very first
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

// Neutral is not bad news (owner, 2026-11-06): the change under the score is red only when a page actually got more
// negative: a page both syncs cited whose tone moved toward negative (e.g. neutral → negative, positive → mixed), or a
// newly cited negative page. Otherwise the line is grey and says why, e.g. "4 new neutral pages · tone unchanged".
// prev / now: the two syncs' pages (null prev: the first sync). → { worse, reason } (reason null when nothing to say)
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
export function toneMove(prevPages, pages) {
  if (!prevPages) return { worse: false, reason: null }
  const before = toneById(prevPages)
  const nowIds = new Set((pages ?? []).map((p) => p.id))
  let worse = false
  let changed = 0
  let better = 0
  const added = {}
  for (const p of pages ?? []) {
    if (!before.has(p.id)) {
      if (p.tone === 'negative') worse = true
      added[p.tone] = (added[p.tone] ?? 0) + 1
      continue
    }
    const was = before.get(p.id)
    if (was === p.tone || p.tone === 'unscored' || was === 'unscored') continue
    changed += 1
    if (RANK[p.tone] < RANK[was]) worse = true
    else better += 1
  }
  const gone = {}
  for (const p of prevPages) if (!nowIds.has(p.id)) gone[p.tone] = (gone[p.tone] ?? 0) + 1
  const parts = []
  for (const t of ['neutral', 'mixed', 'positive']) if (added[t]) parts.push(`${plural(added[t], `new ${t} page`)}`)
  for (const t of ['positive', 'neutral', 'mixed', 'negative']) if (gone[t]) parts.push(`${plural(gone[t], `${t} page`)} no longer cited`)
  if (better) parts.push(`${plural(better, 'page')} turned more positive`)
  if (!changed) parts.push('tone unchanged')
  return { worse, reason: parts.length ? parts.join(' · ') : null }
}

// pages negative in this sync that the sync before cited with another tone
export const turnedNegative = (pages, prevPages) => {
  const before = toneById(prevPages)
  return (pages ?? []).filter((p) => p.tone === 'negative' && before.has(p.id) && before.get(p.id) !== 'negative')
}

// the Pages on <date> filters, combined with AND: tone ('all' or one), engines (the ones switched on), new only, a
// domain search
export function filterSyncPages(pages, { tone = 'all', engines = null, newOnly = false, q = '', fresh = null } = {}) {
  const needle = String(q || '').trim().toLowerCase()
  // 'all': every scored page (owner, 2026-11-13: Neutral and Mixed shown again; Not scored stays out)
  const toneOk = (p) => {
    if (tone === 'all') return SCORED_TONES.includes(p.tone)
    return p.tone === tone
  }
  return (pages ?? []).filter((p) => toneOk(p)
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
const cell = csvCell // shared: formula-safe, quoted when needed
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

// a sync's tooltip numbers: Positive n (x%) · Negative n (x%) — opinion shares only
export const tipCounts = (counts, pct) => SCORED_TONES.map((t) => ({ tone: t, n: counts[t], pct: pct[t] }))

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
// column for the picked sync, so they can't disagree. pagesOf(run): the sync's own pages (lib/sentiment-adapter.js).
export function syncColumns(runs, pagesOf, engine = 'all') {
  return (runs ?? []).map((r) => {
    const all = pagesOf(r) ?? []
    const pages = engine === 'all' ? all : all.filter((p) => p.engines.includes(engine))
    const counts = countTones(pages)
    // pct = opinion shares (Positive + Negative = 100) so Mix / This sync match scoreOf
    return { r, date: r.date, all, pages, counts, pct: tonePercents(counts) }
  })
}

// ---- which sync is shown (owner, 2026-11-06, client point 4) ----------------------------------------------------------
// a sync's time, "14:05" (UTC, as the dates are), from its run's createdAt; '' when unknown
export const syncTime = (col) => {
  const at = col?.r?.createdAt
  if (!at || Number.isNaN(Date.parse(at))) return ''
  return new Date(at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' })
}
// the chart's x-axis label: the day, plus the time when another sync falls on the same day ("Oct 27 14:05")
export function syncAxisLabel(cols, i, day) {
  const c = cols?.[i]
  if (!c) return ''
  const same = cols.some((o, j) => j !== i && o.date === c.date)
  const t = same ? syncTime(c) : ''
  return t ? `${day(c.date)} ${t}` : day(c.date)
}
// The x-axis labels' layout. app (owner, 2026-11-10): the labels were cramped ("Oct 27 … Nov 10 12:35"), so now: at
// most MAX_AXIS_LABELS (6) dates, evenly spread along the axis; always the first, the last and the picked sync's day;
// the date only ("Nov 10"; the time is in the hover card); one label per day, on the day's first sync (on the picked
// sync when it falls on that day, so the underline sits under it). Labels that would still collide are thinned (the
// picked, last and first kept); none overlaps another or leaves the axis [lo, hi].
// (Was, 2026-11-07: every label that fit, the time under a day's second and later syncs.)
// cols: the chart's columns; xs[i]: column i's centre; measure(text) → px width; day(date) → "Oct 27".
// → [{ show, text, cx }] per column (cx: the label's centre, nudged inside the axis at the ends)
export const MAX_AXIS_LABELS = 6
export function syncAxisPlan(cols, { xs, picked = -1, lo, hi, measure, day, gap = 8, max = MAX_AXIS_LABELS }) {
  const n = cols?.length ?? 0
  if (!n) return []
  const pick = picked >= 0 && picked < n ? picked : -1
  // one candidate per day: the picked sync on its own day, else the day's first sync
  const repOfDay = new Map()
  for (let i = 0; i < n; i++) if (!repOfDay.has(cols[i].date)) repOfDay.set(cols[i].date, i)
  if (pick >= 0) repOfDay.set(cols[pick].date, pick)
  const reps = [...repOfDay.values()].sort((a, b) => a - b)
  const rep = (i) => repOfDay.get(cols[i].date)
  // must-haves, by priority: the picked sync's day, the last's, the first's
  const must = [...new Set([pick >= 0 ? rep(pick) : -1, rep(n - 1), rep(0)].filter((i) => i >= 0))]
  const chosen = new Set(must)
  if (reps.length <= max) reps.forEach((i) => chosen.add(i))
  else {
    // evenly spaced: for each inner target along the axis, the nearest day not yet taken (skipped when a label
    // already sits within half a step of it)
    const step = (n - 1) / (max - 1)
    for (let k = 1; k < max - 1; k++) {
      const t = k * step
      if ([...chosen].some((c) => Math.abs(c - t) < step / 2)) continue
      const near = reps.filter((r) => !chosen.has(r)).sort((a, b) => Math.abs(a - t) - Math.abs(b - t))[0]
      if (near != null) chosen.add(near)
    }
    // the picked day can push it over: drop the extra label nearest the picked one
    while (chosen.size > max) {
      const extra = [...chosen].filter((i) => !must.includes(i)).sort((a, b) => Math.abs(a - must[0]) - Math.abs(b - must[0]))[0]
      chosen.delete(extra)
    }
  }
  const sorted = (s) => [...s].sort((a, b) => a - b)
  const text = (i) => day(cols[i].date)
  // each kept label's box, kept inside [lo, hi]; null when two would collide
  const layout = (kept) => {
    const boxes = kept.map((i) => {
      const w = measure(text(i))
      const cx = Math.min(Math.max(xs[i], lo + w / 2), hi - w / 2)
      return { i, cx, a: cx - w / 2, b: cx + w / 2 }
    })
    for (let k = 1; k < boxes.length; k++) if (boxes[k].a < boxes[k - 1].b + gap) return null
    return boxes
  }
  // the must-haves first, then the others, each only if everything still fits
  let kept = []
  for (const i of [...must, ...sorted([...chosen].filter((i) => !must.includes(i)))]) {
    const next = sorted([...kept, i])
    if (!kept.length || layout(next)) kept = next
  }
  const boxes = layout(kept) ?? kept.map((i) => ({ i, cx: xs[i] }))
  const at = new Map(boxes.map((b) => [b.i, b.cx]))
  return cols.map((_, i) => (at.has(i) ? { show: true, text: text(i), cx: at.get(i) } : { show: false, text: '', cx: xs[i] }))
}
// the picker's menu: its rows newest first, the latest marked, grouped by month ("November") when there are more than
// MENU_GROUP_OVER syncs; otherwise one group with no heading. → [{ heading, rows: [{ id, label, pages, latest }] }]
export const MENU_GROUP_OVER = 8
export function syncMenu(cols, day) {
  const latestId = cols?.at?.(-1)?.r?.id
  const rows = syncOptions(cols, day).map((o) => ({ ...o, latest: o.id === latestId }))
  if (rows.length <= MENU_GROUP_OVER) return [{ heading: null, rows }]
  const month = (c) => new Date(`${c.date.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
  const byId = new Map((cols ?? []).map((c) => [c.r.id, c]))
  const groups = []
  for (const r of rows) {
    const h = month(byId.get(r.id))
    if (groups.at(-1)?.heading !== h) groups.push({ heading: h, rows: [] })
    groups.at(-1).rows.push(r)
  }
  return groups
}
// the menu's place: under the button, left edges lined up, kept 8px inside the window; above it when there's no room
// below. at: the button's rect; w / h: the menu's size; vw / vh: the window
export function placeMenu(at, w, h, vw, vh, gap = 6) {
  const left = Math.min(Math.max(8, at.left), Math.max(8, vw - 8 - w))
  const below = at.bottom + gap
  const top = below + h > vh - 8 && at.top - gap - h >= 8 ? at.top - gap - h : below
  return { left, top }
}

// the Pages picker's options, newest first: { id, label: "Oct 27, 14:05", pages }
export const syncOptions = (cols, day) => [...(cols ?? [])].reverse().map((c) => ({
  id: c.r.id,
  label: syncTime(c) ? `${day(c.date)}, ${syncTime(c)}` : day(c.date),
  pages: c.pages?.length ?? 0,
}))

// ---- the scoring change (2026-11-02) ----------------------------------------------------------------------------------
// How a sync's score is worked out changed when Harsh's Mixed / Not scored scoring went live (the deploy of 73dff06).
// reputation_scans stores no method or version, so this is a date cutoff on the sync's created_at, not a stored marker:
// a sync created at or after this moment was scored the new way.
export const SCORING_UPDATED = '2026-11-02T08:35:42Z'
export const SCORING_UPDATED_TIP = 'How the score is worked out changed on Nov 2, so it isn’t compared with earlier syncs.'
// true on the first sync scored the new way when there is a sync before it (scored the old way): its change against that
// sync is not shown. The sync after it compares normally.
// Owner, 2026-11-09: no longer used to hold back the change line: the first sync scored the new way compares with the
// sync before like any other ("▲ +2 since Nov 2"), so this is always false. SCORING_UPDATED stays for reference.
export const scoringChangedAt = () => false

// the last sync before i that has a score (skips syncs with no scored pages, e.g. a run stored without pages); i - 1
// when none has (the change is then a gap, as before)
export function prevScoredIndex(cols, i) {
  for (let j = i - 1; j >= 0; j--) if (scoreOf(cols?.[j]?.counts) != null) return j
  return i - 1
}

// The score change of sync i against the sync before: the ONE calculation behind the line under the score, the arrow
// beside it and the Over time tooltip (2026-11-02: the line read pages that changed tone instead, so Oct 28 at 81 after
// Oct 27 at 66 said "No change since Oct 27"). Both scores are scoreOf(column counts).
//   { first: true }                          the first sync (nothing before it)
//   { delta: null, since }                   a gap: either sync has no score ("—", never 0)
//   { delta: null, since, scoringUpdated }   the first sync scored the new way (scoringChangedAt): not compared
//   { delta, since, ...scoreChange(...) }    delta 0 = truly no change; otherwise dir / arrow / text as scoreChange
// Owner, 2026-11-12: a sync stored without pages (#117) is a gap that is skipped: the sync after it compares with the last
// sync before it that has a score (prevScoredIndex), not with the gap.
export function syncScoreChange(cols, i) {
  const col = cols?.[i]
  if (!col) return null
  const score = scoreOf(col.counts)
  if (!(i > 0)) return { first: true, score, prevScore: null, delta: null, since: null }
  const prev = cols[prevScoredIndex(cols, i)]
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
