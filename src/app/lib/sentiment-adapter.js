// Mock stand-in for the app's lib/sentiment-adapter.js (app_kraffic.ai develop, synced 2026-11-15).
// Everything above the line "mock data" is the app's file, unchanged (the rules the page draws from). Below it the app
// reads GET /api/reputation and runs the paid analysis; here the same functions serve the mock's sample runs
// (src/data/sentiment.js) and a Re-analyze adds one more run after a short wait.
// The Sentiment page's data (the mock's data/sentiment.js) on real data. The page logic below the header is copied
// from the mock as it is (scores, percentages, sorting, the insight and hero lines); the data comes from this app's
// existing routes:
//   runs   GET /api/reputation?domain=<domain_url>: the newest 60 reputation runs, oldest → newest (one per Re-analyze or
//          the weekly job). counts = the run's pages per tone (its stored sources); a run without sources keeps its
//          percentages only, so it has no counts and isn't drawn
//   pages  the default run's sources (the newest run with pages, defaultRunOf) [{ url, title, sentiment, engines, reason? }]: tone positive / neutral / mixed /
//          negative, or unscored when the page could not be read. engines google / chatgpt / claude. A page's quote is
//          the brand analysis's sentence for the same URL (GET /api/entity-intelligence: sentiment.by_source snippet),
//          else none (noQuote: "Quote appears after the next analysis"). why: one short line for Positive / Negative
//          only (CLI reason, else the analysis quote) so the Pages list can show why the tone was chosen
//   swot   the brand analysis's themes (content_insights; its latest run only), each linked to the pages with the same
//          URL; a theme whose pages aren't among the run's pages isn't shown (never made up)
//   Re-analyze: POST /api/reputation { domainUrl } (a paid run), the same call as the previous Sentiment page

export const TONES = ['positive', 'neutral', 'mixed', 'negative', 'unscored']
export const SCORED_TONES = ['positive', 'neutral', 'mixed', 'negative']
// UI + Mix %: pages that take a side (scoreOf already uses these; Neutral / Mixed stay in the data but out of the view)
export const OPINION_TONES = ['positive', 'negative']
export const TONE_LABEL = { positive: 'Positive', neutral: 'Neutral', mixed: 'Mixed', negative: 'Negative', unscored: 'Not scored' }

// ---- pure logic (tested in sentiment.test.js) ---------------------------------------------------------------------

export const countTones = (pages) => {
  const c = { positive: 0, neutral: 0, mixed: 0, negative: 0, unscored: 0 }
  for (const p of pages) if (c[p.tone] != null) c[p.tone] += 1
  return c
}
const num = (c, k) => c?.[k] || 0
// pages that received a tone. Unreadable pages stay out of the score.
export const scoredOf = (c) => num(c, 'positive') + num(c, 'neutral') + num(c, 'mixed') + num(c, 'negative')
const totalOf = scoredOf

// the pages that take a side: positive or negative (owner, 2026-11-06: neutral and mixed pages don't count in the score)
export const opinionOf = (c) => num(c, 'positive') + num(c, 'negative')
export const EARLY_READ = 3 // fewer opinion pages than this: "Early read"
// 0–100 from the positive and negative pages only (owner, 2026-11-06; every sync, past ones too): neutral, mixed and
// unread pages are left out, so more neutral pages no longer pull the score to 50. No page takes a side: 50 ("Neutral",
// or "Balanced" when some are mixed). Nothing scored: null (a gap, never 0). 50 is a balance, not a confidence level.
export function scoreOf(c) {
  if (!scoredOf(c)) return null
  const n = opinionOf(c)
  if (!n) return 50
  return Math.round(50 + ((num(c, 'positive') - num(c, 'negative')) / n) * 50)
}

// whole percentages that always add up to 100 (largest remainder), so the bar's labels never read 101%
export function tonePercents(c) {
  const n = scoredOf(c)
  if (!n) return { positive: 0, neutral: 0, mixed: 0, negative: 0 }
  const raw = SCORED_TONES.map((k) => ({ k, v: ((c[k] || 0) * 100) / n }))
  const out = Object.fromEntries(raw.map(({ k, v }) => [k, Math.floor(v)]))
  let left = 100 - Object.values(out).reduce((a, b) => a + b, 0)
  for (const { k } of [...raw].sort((a, b) => (b.v % 1) - (a.v % 1))) {
    if (left <= 0) break
    out[k] += 1; left -= 1
  }
  return out
}

// Mix / This sync shares: % of pages that take a side only (Positive + Negative = 100), so the Mix bar lines up with
// scoreOf (Neutral / Mixed are left out of both). No opinion pages: both 0.
export function opinionPercents(c) {
  const n = opinionOf(c)
  if (!n) return { positive: 0, negative: 0 }
  const raw = OPINION_TONES.map((k) => ({ k, v: ((c[k] || 0) * 100) / n }))
  const out = Object.fromEntries(raw.map(({ k, v }) => [k, Math.floor(v)]))
  let left = 100 - Object.values(out).reduce((a, b) => a + b, 0)
  for (const { k } of [...raw].sort((a, b) => (b.v % 1) - (a.v % 1))) {
    if (left <= 0) break
    out[k] += 1; left -= 1
  }
  return out
}

// one line for Over time: each sync's share of its own opinion pages, so Mix % matches the score's basis.
// tone, when passed, is that one series only (the chart's filter).
export function shareTrendLine(columns, tone = null) {
  if (!columns || columns.length < 2) return null
  const pcts = columns.map((c) => opinionPercents(c.counts))
  const series = (t, label) => `${label} ${pcts.map((p) => `${p[t] ?? 0}%`).join(' → ')}`
  if (OPINION_TONES.includes(tone)) return series(tone, TONE_LABEL[tone])
  return `Share of pages that take a side in each sync. ${series('positive', 'Positive')} · ${series('negative', 'Negative')}.`
}

// y-axis for one tone. A move from 5% to 0% opens the low end. A move from 95% to 100% opens
// the top band, so the line is not drawn on the ceiling with its labels stacked on the axis.
// The "All" chart stays locked at 0–100.
export function toneAxis(values, { locked = false } = {}) {
  if (locked) return { min: 0, max: 100, ticks: [0, 50, 100] }
  const nums = (values ?? []).map(Number).filter((n) => Number.isFinite(n))
  const hi = Math.max(0, ...nums)
  const lo = nums.length ? Math.min(...nums) : 0
  if (lo >= 75 && hi >= 90 && hi - lo <= 25) {
    const floor = Math.max(0, Math.floor((lo - 5) / 5) * 5)
    const step = 100 - floor <= 10 ? 5 : 10
    const ticks = []
    for (let v = floor; v <= 100; v += step) ticks.push(v)
    if (ticks[ticks.length - 1] !== 100) ticks.push(100)
    return { min: floor, max: 100, ticks }
  }
  let max = 100
  if (hi <= 10) max = 10
  else if (hi <= 25) max = 25
  else if (hi <= 50) max = 50
  const ticks = max === 100 ? [0, 50, 100] : max === 50 ? [0, 25, 50] : max === 25 ? [0, 25] : [0, 5, 10]
  return { min: 0, max, ticks }
}
export const toneAxisMax = (values, opts) => toneAxis(values, opts).max

// pages whose url was not in any earlier sync. The first sync's pages are all new.
// A url that returns later is not new again. Callers show a mark only for these, never a mark for the rest.
export function freshPageIds(columns, index) {
  const cols = columns ?? []
  const upto = Math.max(0, Math.min(index ?? 0, cols.length))
  const seen = new Set()
  for (let i = 0; i < upto; i++) {
    for (const p of cols[i]?.pages ?? []) if (p?.id) seen.add(p.id)
  }
  const fresh = new Set()
  for (const p of cols[upto]?.pages ?? []) {
    if (p?.id && !seen.has(p.id)) fresh.add(p.id)
  }
  return fresh
}

// sources that were positive or negative in any sync. Size is how often, across the whole history,
// not one date. A source that is only ever neutral is left out.
export function sourceCloud(columns) {
  const map = new Map()
  for (const col of columns ?? []) {
    const date = col?.date ?? col?.r?.date ?? null
    const seen = new Set()
    for (const p of col?.pages ?? []) {
      const domain = p?.domain
      if (!domain || p.unresolved) continue // an unresolved redirect isn't a publisher (AUD-008)
      const tone = p.tone === 'positive' || p.tone === 'negative' ? p.tone : 'neutral'
      const url = p.url || ''
      const key = `${domain}|${date}|${url}|${tone}`
      if (seen.has(key)) continue
      seen.add(key)
      let row = map.get(domain)
      if (!row) {
        row = { domain, positive: 0, neutral: 0, negative: 0, hits: [] }
        map.set(domain, row)
      }
      row[tone] += 1
      row.hits.push({
        id: p.id,
        url: p.url || null,
        title: p.title,
        domain,
        path: p.path,
        engines: p.engines,
        tone,
        date,
      })
    }
  }
  return [...map.values()].map((row) => {
    const marked = row.positive + row.negative
    const lean = row.positive > row.negative ? 'positive' : row.negative > row.positive ? 'negative' : marked ? 'mixed' : 'neutral'
    return { ...row, lean, weight: marked, total: row.positive + row.neutral + row.negative }
  }).filter((row) => row.weight > 0)
    .sort((a, b) => b.weight - a.weight || b.positive - a.positive || a.domain.localeCompare(b.domain))
}

// each run with its score and the change vs the last run before it that has a score (newest last). Owner, 2026-11-12:
// a run stored without pages (#117) is a gap, so the run after it compares with the last scored run, not the gap.
export function withScores(runs) {
  return runs.map((r, i) => {
    const score = scoreOf(r.counts)
    let prev = null
    for (let j = i - 1; j >= 0 && prev == null; j--) prev = scoreOf(runs[j].counts)
    return { ...r, score, delta: prev == null || score == null ? null : score - prev }
  })
}

// ---- the run the page opens on (owner, 2026-11-12) ----------------------------------------------------------------------
// #117 keeps runs stored with no pages in the history (a finished paid run that found nothing). The page must not open on
// one: a failed or empty scan must not hide the last good score. The default run is the newest run that has pages; when
// every run is empty, the newest run (#117's "No third-party pages found"). byRun: run id → its pages (else the counts).
const pagesIn = (r, byRun) => (byRun ? byRun.get(r?.id)?.length ?? 0 : TONES.reduce((n, k) => n + num(r?.counts, k), 0))
export function defaultRunOf(runs, byRun = null) {
  const list = runs ?? []
  for (let i = list.length - 1; i >= 0; i--) if (pagesIn(list[i], byRun) > 0) return list[i]
  return list.at(-1) ?? null
}
// the line above the score when a newer run than the one shown by default found no pages: "Latest run on Nov 10 found
// no pages"; null otherwise (the newest run has pages, or every run is empty). day: the page's date format.
export function emptyRunNote(runs, defaultId, day = (d) => d, byRun = null) {
  const list = runs ?? []
  const newest = list.at(-1)
  if (!newest || newest.id === defaultId || pagesIn(newest, byRun) > 0) return null
  const shown = list.find((r) => r.id === defaultId)
  if (!shown || pagesIn(shown, byRun) === 0) return null
  return `Latest run on ${day(newest.date)} found no pages`
}

// pages on one engine ('all' = every page)
export const pagesOn = (pages, engine) => (engine === 'all' ? pages : pages.filter((p) => p.engines.includes(engine)))

// per engine: tone counts + pages, engines with no pages left out
export function byEngine(pages, engines) {
  return engines
    .map((e) => { const on = pagesOn(pages, e.id); return { ...e, pages: on.length, counts: countTones(on) } })
    .filter((r) => r.pages > 0)
}

// the pages list's sort: tone (negative first), title, domain or engine count; dir 'asc' | 'desc'
const TONE_RANK = { negative: 0, mixed: 1, neutral: 2, unscored: 3, positive: 4 }
export function sortPages(pages, key = 'tone', dir = 'asc') {
  const val = {
    tone: (p) => TONE_RANK[p.tone],
    title: (p) => p.title.toLowerCase(),
    domain: (p) => p.domain,
    engines: (p) => p.engines.length,
  }[key]
  const s = dir === 'asc' ? 1 : -1
  return [...pages].sort((a, b) => (val(a) < val(b) ? -s : val(a) > val(b) ? s : a.title.localeCompare(b.title)))
}

// the insight line under the top strip, from the latest run's counts (Positive / Negative only — same basis as the score)
export function sentimentInsight(c, brand) {
  const n = opinionOf(c)
  const other = num(c, 'neutral') + num(c, 'mixed')
  const unread = num(c, 'unscored')
  if (!n && !other && !unread) return null
  if (!n && !other) return `${unread} ${unread === 1 ? 'page was' : 'pages were'} found about ${brand}, and none could be scored.`
  if (!n) {
    const left = other + unread
    return `${left} ${left === 1 ? 'page was' : 'pages were'} found about ${brand}, and none take a side.`
  }
  const counts = `${num(c, 'positive')} positive, ${num(c, 'negative')} negative`
  const extra = other + unread
  const tail = extra ? ` ${extra} more ${extra === 1 ? 'was' : 'were'} neutral, mixed or not scored.` : ''
  return `${counts}, out of ${n} ${n === 1 ? 'page' : 'pages'} that take a side about ${brand}.${tail}`
}

// the hero's line under the score, by score band (null: nothing scored)
// 80–100 Very positive · 60–79 Mostly positive · 41–59 Balanced · 21–40 Mostly negative · 0–20 Very negative
// counts, when passed: an all-neutral run is Neutral, not Balanced and not an even split. The overall verdict reads
// "Balanced" (2026-11-02, owner), so it isn't confused with Mixed pages.
export function heroLine(score, counts) {
  if (score == null) return 'No pages scored yet'
  const n = counts ? scoredOf(counts) : 0
  if (counts && n && !opinionOf(counts)) return num(counts, 'mixed') ? 'Balanced' : 'Neutral'
  if (counts && opinionOf(counts) < EARLY_READ) return 'Early read' // owner, 2026-11-06: 1–2 pages take a side
  if (score >= 80) return 'Very positive'
  if (score >= 60) return 'Mostly positive'
  if (score >= 41) return 'Balanced'
  if (score >= 21) return 'Mostly negative'
  return 'Very negative'
}
// Sample size, one muted line under the owner's sentence: "Based on 8 of 18 pages." (owner, 2026-11-06: N = the positive
// and negative pages the score uses, M = every page found, neutral, mixed and Not scored included); none takes a side:
// "All 8 pages were neutral."
export function scoredLine(counts) {
  const all = scoredOf(counts) + num(counts, 'unscored')
  const n = opinionOf(counts)
  if (!n && scoredOf(counts)) return `All ${scoredOf(counts)} ${scoredOf(counts) === 1 ? 'page was' : 'pages were'} ${num(counts, 'mixed') ? 'neutral or mixed' : 'neutral'}.`
  return `Based on ${n} of ${all} ${all === 1 ? 'page' : 'pages'}.`
}
// The score label's ⓘ: how the score works, then Harsh's sentence with the real count (no "not scored" part when 0)
export const SCORE_EXPLAINED = '0–100 from the pages that take a side (positive or negative). 50 means positive and negative balance. It is not a confidence level. Neutral and mixed pages, and pages that could not be read (Not scored), are left out.'
export function scoreInfo(counts) {
  const unread = num(counts, 'unscored')
  const notScored = unread ? `${unread} ${unread === 1 ? 'page was' : 'pages were'} not scored. ` : ''
  return `${SCORE_EXPLAINED} ${notScored}The score is their balance, not a confidence level.`
}
// "1 page not scored" under This sync's tiles; null when every page was scored
export function unscoredNote(counts) {
  const unread = num(counts, 'unscored')
  return unread ? `${unread} ${unread === 1 ? 'page' : 'pages'} not scored` : null
}

// the line under the score. An all-neutral run stays "Neutral" even when the blended score fell
// (50 after 52 is not positive coverage falling). Movement comes from pages that changed tone
// (`flips`), not from how many pages the run cited and not from the score delta.
export function reputationLine(prevCounts, nextCounts, since, flips = null) {
  const n = nextCounts ? totalOf(nextCounts) : 0
  if (!n) return null
  if (!prevCounts || !totalOf(prevCounts)) return 'First run'
  if (nextCounts.neutral === n) return `Neutral since ${since}`
  const toPos = flips?.toPositive ?? 0
  const toNeg = flips?.toNegative ?? 0
  if (toNeg > toPos) return `Moving negative since ${since}`
  if (toPos > toNeg) return `Moving positive since ${since}`
  return `No change since ${since}`
}

// one sentence under Over time: the direction, and only pages whose tone changed or that dropped out
const negativeQuote = (page) => page?.sentences?.find((s) => s.tone === 'negative')

export function reasonLine({ counts, since, brand, changes = [], gone = 0, gonePages = [], negative = null }) {
  const n = counts ? totalOf(counts) : 0
  if (!n || !since) return null
  const goneText = gone ? ` ${gone === 1 ? '1 page is' : `${gone} pages are`} no longer cited.` : ''
  const posGone = gonePages.filter((p) => p.tone === 'positive')
  const negGone = gonePages.filter((p) => p.tone === 'negative')
  if (counts.neutral === n) {
    if (!changes.length && posGone.length) {
      const who = posGone.length === 1
        ? `${posGone[0].domain} was positive on ${since} and is no longer cited. It did not turn negative.`
        : `${posGone.length} positive pages from ${since} are no longer cited. They did not turn negative.`
      const other = Math.max(0, gone - posGone.length - negGone.length)
      const otherText = other ? ` ${other === 1 ? '1 other page is' : `${other} other pages are`} no longer cited too.` : ''
      return `Still neutral. ${who}${otherText} Nothing got worse. Reputation stays neutral until a cited page recommends ${brand}.`
    }
    if (!changes.length && negGone.length) {
      const who = negGone.length === 1
        ? `${negGone[0].domain} was negative on ${since} and is no longer cited.`
        : `${negGone.length} negative pages from ${since} are no longer cited.`
      return `Still neutral. ${who} Nothing got worse.`
    }
    if (!changes.length) return `Still neutral since ${since}. No cited page turned positive or negative.${goneText} Nothing got worse. Reputation stays neutral until a cited page recommends ${brand}.`
    const turned = changes.filter((c) => c.to === 'neutral').length
    return `Still neutral since ${since}. ${turned === 1 ? '1 cited page turned neutral' : `${turned} cited pages turned neutral`}.${goneText}`
  }
  const neg = changes.filter((c) => c.to === 'negative')
  if (neg.length) {
    const page = neg[0].page
    const quote = negativeQuote(page)
    const who = neg.length === 1 ? page.domain : `${neg.length} pages`
    return `${who} turned negative${quote && neg.length === 1 ? `: “${quote.text}”` : ''}. That is what to answer.`
  }
  if (counts.negative > 0 && negative) {
    const quote = negativeQuote(negative)
    return `${negative.domain} is negative${quote ? `: “${quote.text}”` : ''}. That is what to answer.`
  }
  const pos = changes.filter((c) => c.to === 'positive')
  if (pos.length) return `${pos.slice(0, 3).map((c) => c.page.domain).join(', ')} turned positive.`
  if (gone && !changes.length) return `No cited page changed tone.${goneText}`
  return `No cited page changed tone since ${since}.`
}

// a run before the latest: its own stored pages (production keeps each run's sources)
export function runPages(_pages, _counts, runId) {
  return loaded?.byRun.get(runId) ?? []
}

// ---- mock data (the app: "loading") -------------------------------------------------------------------------------
import { RUNS, SWOT, runPages as sampleRunPages } from '../../data/sentiment.js'
import { account } from '../../data/mock.js'

export const UNRESOLVED_SOURCE = 'Unresolved source'
export const pageKey = (url) => url ?? null
// one-line "why this page has its tone" (the app's rule): the scan's reason, else the page's first sentence
export function pageWhy(tone, src, quote) {
  if (!['positive', 'negative', 'neutral', 'mixed'].includes(tone)) return null
  const text = String(src?.reason || quote || '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > 140 ? `${text.slice(0, 137).trimEnd()}…` : text
}
// the sample pages in the app's page shape (why, unresolved, onCompetitorSite added)
const shape = (p) => ({ ...p, unresolved: false, why: pageWhy(p.tone, null, p.sentences[0]?.text ?? null), onCompetitorSite: false })
const sample = () => {
  const byRun = new Map(RUNS.map((r) => [r.id, sampleRunPages(null, null, r.id).map(shape)]))
  const runs = RUNS.map((r) => ({ ...r }))
  const shown = defaultRunOf(runs, byRun)
  return { domain: account.domain, enabled: { sentiment: true }, runs, pages: shown ? byRun.get(shown.id) : [], swot: SWOT, byRun, defaultRunId: shown?.id ?? null }
}
let loaded = sample()
let loadedDomainUrl = `https://${account.domain}`
export const sentimentDomainUrl = () => loadedDomainUrl
const later = (ms, value) => new Promise((done) => setTimeout(() => done(typeof value === 'function' ? value() : value), ms))

export async function loadSentiment({ domain, domainUrl }) {
  if (domainUrl) loadedDomainUrl = domainUrl
  if (domain && loaded.domain !== domain) loaded = { ...loaded, domain }
  return later(200, () => loaded)
}
export const sentimentEnabled = () => true

// the paid run's session (the app's code, unchanged): survives a reload while the run is still going
const RUN_KEY = (domain) => `kraffic:sentiment-run:${String(domain || '').toLowerCase()}`
const RUN_MAX_MS = 20 * 60 * 1000
const storeOf = () => {
  const out = []
  try { if (typeof sessionStorage !== 'undefined') out.push(sessionStorage) } catch { /* private mode */ }
  try { if (typeof localStorage !== 'undefined') out.push(localStorage) } catch { /* private mode */ }
  return out
}
export function rememberSentimentRun(domain, { domainUrl, startedAt = new Date().toISOString() } = {}) {
  const value = JSON.stringify({ domainUrl, startedAt })
  for (const s of storeOf()) { try { s.setItem(RUN_KEY(domain), value) } catch { /* full or blocked */ } }
  return startedAt
}
export function forgetSentimentRun(domain) {
  for (const s of storeOf()) { try { s.removeItem(RUN_KEY(domain)) } catch { /* blocked */ } }
}
export function readSentimentRun(domain) {
  for (const s of storeOf()) {
    try {
      const raw = s.getItem(RUN_KEY(domain))
      if (!raw) continue
      const v = JSON.parse(raw)
      if (!v?.startedAt || Date.now() - Date.parse(v.startedAt) > RUN_MAX_MS) { forgetSentimentRun(domain); return null }
      return v
    } catch { /* unreadable */ }
  }
  return null
}
export const runAfter = (runs, startedAt) => {
  const t = Date.parse(startedAt)
  return (runs ?? []).find((r) => Date.parse(r.createdAt) >= t - 5000) ?? null
}
// Re-analyze (mock): after a short wait the latest run's pages are saved again as a new run, dated now
export async function reanalyze() {
  await later(2600)
  const last = loaded.runs.at(-1)
  const createdAt = new Date().toISOString()
  const pages = loaded.byRun.get(last.id) ?? []
  const byRun = new Map(loaded.byRun).set(createdAt, pages)
  const runs = [...loaded.runs, { id: createdAt, createdAt, date: createdAt.slice(0, 10), counts: countTones(pages) }]
  loaded = { ...loaded, runs, byRun, pages, defaultRunId: createdAt }
  return { ok: true }
}
export const refusedByServer = () => false
export const rescoreSentiment = () => later(1500, { rescored: 0 })
export const waitForSentimentRun = () => later(600, () => loaded)
export const sentimentFor = (domain) => (loaded && domain === loaded.domain ? { runs: loaded.runs, pages: loaded.pages, swot: loaded.swot, defaultRunId: loaded.defaultRunId ?? null } : { runs: [], pages: [], swot: null, defaultRunId: null })
