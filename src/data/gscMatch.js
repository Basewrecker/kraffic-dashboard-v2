// Search Console match for a prompt: the app's lib/gsc-match.js shapes (analyzePrompt / bestPageFor, and the route's
// states), sample data only. MADE-UP numbers: the skincare list (Dermasuri) is derived from the mock's own sample
// queries (contentOpportunities-proposed.js gscKeywordsFor); the reverse-mortgage account (rm-1) uses the app's sample
// for an invented lender, renamed to that account's made-up domain. Never client Search Console data.
//
// Units (the app's): match / adjusted / score are 0–100 integers; share is 0–1 of that query's impressions; position is
// Google's average position (float, 1 = top), impression-weighted; impressions / clicks are integers over the range.
// intent 'account' | 'local' | null (×0.5 on adjusted). best = the query with the highest adjusted × log10(impr + 1)
// among those with ≥ 10 impressions. publishOn: 'update' the best query's top page, or 'create' (suggestedPath) when
// the best adjusted match is under 30 (or there's no best query). reason: 'several-queries' when 2+ of the top queries
// land on that page, else 'best-query'; lowVolume: no strong query (adjusted ≥ 30) reached 10 impressions.
// Range: the last 8 weeks (56 days) ending 2 days ago; lagNote is fixed text.
//
// Preview states (?co=): gsc-new = not connected · gsc-reconnect · gsc-nodomain · gsc-nodata (connected, no data).
//
// Intent fit (PROPOSED, owner 2026-11-04 "the best query follows the prompt's intent"; the mock's rule, to confirm):
// a prompt and a query each read as a question / how-to, a comparison (best, top, vs, review) or a shopping search
// (price, buy, deal, sale, coupon, near me, a store). A query whose kind clashes with the prompt's (a question or how-to
// prompt vs a shopping query; a comparison prompt vs a how-to query) is scored ×0.7 (`intentFit: false`) and can't be
// the Best query while a query that fits, with ≥ 10 impressions, exists.
import { CO_BRAND, CO_BRANDS } from './contentOpportunities.js'
import { coStates, gscKeywordsFor, newPageFor, promptWords } from './contentOpportunities-proposed.js'
import { RM_BRAND } from './contentRecommendRm.js'

export const MATCH_WEIGHTS = { coverage: 55, precision: 20, phrase: 25 }
export const PAGE_WEIGHTS = { query: 45, volume: 20, rank: 15, url: 15, cited: 5 }
export const INTENT_PENALTY = { account: 0.5, local: 0.5, site: 0.5 }
export const MISFIT = 0.7 // a query whose kind clashes with the prompt's (intentFit: false)
export const BEST_MIN_IMPRESSIONS = 10
export const CREATE_BELOW = 30
export const LAG_NOTE = 'Search Console data is about 2 days behind.'
export const RANGE = { startDate: '2026-09-07', endDate: '2026-11-02' }
const FETCHED_AT = '2026-11-04T12:00:00.000Z'

// account questions (the user's own account, not the topic) and local ones (a place): scored at half
const ACCOUNT = /\b(my|login|log in|sign in|statement|statements|payment|payments|customer service|account|order status)\b/
const LOCAL = /\b(near me|alabama|alaska|arizona|california|colorado|florida|georgia|illinois|new york|texas|ohio|county|nyc|los angeles|chicago|houston|miami|london|manchester)\b/
// site: the query names a site or a brand (a forum, a video site, a store, a competitor by name or domain): it's about
// that site, not the topic (owner, 2026-11-04; the app's matcher d7a0789). Scored at half, never the Best query, so it
// never decides where to publish.
const SITES = ['reddit', 'quora', 'youtube', 'amazon', 'walmart']
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const siteRe = (competitors = []) => new RegExp(`\\b(${[...SITES, ...competitors.flatMap((c) => [c.name, c.domain, c.domain?.replace(/\.[a-z.]+$/, '')]).filter(Boolean).map((x) => escape(x.toLowerCase().replace(/’/g, "'")))].join('|')})\\b`)
const SITE_DEFAULT = siteRe()
export const intentOf = (q, site = SITE_DEFAULT) => (ACCOUNT.test(q) ? 'account' : LOCAL.test(q) ? 'local' : site.test(q.toLowerCase().replace(/’/g, "'")) ? 'site' : null)

// how well a query matches the prompt, 0–100: coverage (the prompt's terms the query has), precision (the query's
// terms that are the prompt's) and phrase (two prompt terms side by side, in order)
export function matchOf(prompt, query) {
  const p = promptWords(prompt), q = promptWords(query)
  if (!p.length || !q.length) return 0
  const ps = new Set(p)
  const coverage = p.filter((w) => q.includes(w)).length / p.length
  const precision = q.filter((w) => ps.has(w)).length / q.length
  const pairs = new Set(p.slice(1).map((w, i) => `${p[i]} ${w}`))
  const phrase = q.slice(1).some((w, i) => pairs.has(`${q[i]} ${w}`)) ? 1 : 0
  return Math.round(MATCH_WEIGHTS.coverage * coverage + MATCH_WEIGHTS.precision * precision + MATCH_WEIGHTS.phrase * phrase)
}
// the kind of search: 'shop' (price, buy, deal, sale, coupon, near me, a store) · 'question' (how / what / why / can /
// is …, how to) · 'compare' (best, top, vs, review) · null
const SHOP = /\b(price|prices|buy|deal|deals|sale|coupon|discount|cheap|near me|shop|store|amazon|walmart|ulta|sephora|in stock)\b/
const COMPARE = /\b(vs|versus|best|top|compare|comparison|review|reviews|rated)\b/
const QUESTION = /^(how|what|why|can|is|are|does|do|should|when|which|will)\b|\bhow to\b/
export const searchKind = (s) => { const t = String(s).toLowerCase(); return SHOP.test(t) ? 'shop' : QUESTION.test(t) ? 'question' : COMPARE.test(t) ? 'compare' : null }
// does a query's kind fit the prompt's? (a question prompt vs a shopping query, or a comparison prompt vs a how-to: no)
export const intentFits = (prompt, query) => {
  const p = searchKind(prompt), q = searchKind(query)
  if (p === 'question' && q === 'shop') return false
  if (p === 'compare' && q === 'question') return false
  return true
}
const adjustedOf = (match, intent, fit = true) => Math.round(match * (intent ? INTENT_PENALTY[intent] : 1) * (fit ? 1 : MISFIT))
// kind: the prompt's searchKind. Tiers: a well-matched query (≥ 30) of the prompt's own kind, else any query that fits,
// else (none fits) the rest; within a tier the highest adjusted × log10(impr + 1)
const bestOf = (queries, kind = null) => {
  const top = (list) => list.reduce((b, q) => (!b || q.adjusted * Math.log10(q.impressions + 1) > b.adjusted * Math.log10(b.impressions + 1) ? q : b), null)
  const eligible = queries.filter((q) => q.impressions >= BEST_MIN_IMPRESSIONS && q.intent !== 'site')
  const fitting = eligible.filter((q) => q.intentFit !== false)
  const same = kind ? fitting.filter((q) => searchKind(q.query) === kind && q.adjusted >= CREATE_BELOW) : []
  return top(same.length ? same : fitting.length ? fitting : eligible)
}
const pathOf = (url) => { try { return new URL(url).pathname.replace(/\/$/, '') || '/' } catch { return url } }

// FNV-1a: the same prompt always gets the same numbers
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
const rnd = (key, salt) => (hash(`${key}|${salt}`) % 10000) / 10000

// analyzePrompt from gsc_keywords-shaped rows ({ keyword, clicks, impressions, position, url }); cited: page path → bool
// competitors: [{ name, domain }] the brand's competitors (their names and domains count as sites)
export function analyzeRows(prompt, rows, { suggestedPath, cited = () => false, shareOf = () => 1, competitors = [] } = {}) {
  const site = siteRe(competitors)
  const terms = promptWords(prompt)
  const all = rows.map((r) => {
    const match = matchOf(prompt, r.keyword)
    const intent = intentOf(r.keyword, site)
    const fit = intentFits(prompt, r.keyword)
    return { query: r.keyword, match, adjusted: adjustedOf(match, intent, fit), intent, intentFit: fit, impressions: r.impressions, clicks: r.clicks, position: r.position, best: false, topPage: { url: r.url, path: pathOf(r.url), share: shareOf(r) } }
  })
  const matching = all.filter((q) => q.match > 0).sort((a, b) => b.impressions - a.impressions)
  const best = bestOf(matching, searchKind(prompt))
  const queries = matching.slice(0, 5).map((q) => ({ ...q, best: q === best }))
  if (best && !queries.some((q) => q.best)) queries.splice(4, 1, { ...best, best: true })
  const bestQuery = best ? { ...best, best: true } : null
  const strong = matching.filter((q) => q.adjusted >= CREATE_BELOW)
  const lowVolume = strong.length > 0 && strong.every((q) => q.impressions < BEST_MIN_IMPRESSIONS)
  const onBest = bestQuery ? queries.filter((q) => q.topPage.path === bestQuery.topPage.path).length : 0
  const publishOn = bestQuery && bestQuery.adjusted >= CREATE_BELOW
    ? { action: 'update', url: bestQuery.topPage.url, path: bestQuery.topPage.path, share: bestQuery.topPage.share, match: bestQuery.adjusted, query: bestQuery.query, reason: onBest >= 2 ? 'several-queries' : 'best-query', lowVolume }
    : { action: 'create', suggestedPath }
  const topQueryPages = queries.filter((q) => q.adjusted >= CREATE_BELOW).slice(0, 3).map((q) => ({ query: q.query, url: q.topPage.url, path: q.topPage.path, share: q.topPage.share }))
  // pages: every page a matching query lands on, scored (PAGE_WEIGHTS)
  const byPath = new Map()
  for (const q of matching) {
    const k = q.topPage.path
    if (!byPath.has(k)) byPath.set(k, { url: q.topPage.url, path: k, qs: [] })
    byPath.get(k).qs.push(q)
  }
  const maxImpr = Math.max(1, ...[...byPath.values()].map((p) => p.qs.reduce((a, q) => a + q.impressions, 0)))
  const pages = [...byPath.values()].map((p) => {
    const impressions = p.qs.reduce((a, q) => a + q.impressions, 0)
    const clicks = p.qs.reduce((a, q) => a + q.clicks, 0)
    const position = +(p.qs.reduce((a, q) => a + q.position * q.impressions, 0) / Math.max(1, impressions)).toFixed(1)
    const pathTerms = promptWords(p.path.replace(/[/-]/g, ' '))
    const parts = {
      query: Math.max(...p.qs.map((q) => q.adjusted)) / 100,
      volume: Math.log10(impressions + 1) / Math.log10(maxImpr + 1),
      rank: Math.max(0, Math.min(1, (30 - position) / 29)),
      url: terms.length ? Math.round((terms.filter((t) => pathTerms.includes(t)).length / terms.length) * 4) / 4 : 0,
      cited: cited(p.path) ? 1 : 0,
    }
    const score = Math.round(Object.entries(PAGE_WEIGHTS).reduce((a, [k, w]) => a + w * parts[k], 0))
    const domain = (() => { try { return new URL(p.url).hostname.replace(/^www\./, '') } catch { return '' } })()
    return { url: p.url, path: p.path, key: `${domain}${p.path}`, score, parts, impressions, clicks, position, queries: p.qs.length, cited: Boolean(parts.cited) }
  }).sort((a, b) => b.score - a.score)
  return { prompt, terms, queries, matchingQueries: matching.length, bestQuery, publishOn, topQueryPages, pages }
}

// the skincare list: the mock's sample queries for the prompt (gscKeywordsFor), plus, for some prompts, one account or
// local query, and for a few, nothing about the topic at all (the brand has no page for it: a "create")
function dermasuriRows(row) {
  const prompt = row.prompt
  const r = rnd(prompt, 'gsc-kind')
  // people rarely type the whole prompt: its word-for-word query is left out, so the heads are the shorter searches
  const norm = (x) => promptWords(x).join(' ')
  const base = gscKeywordsFor(row).filter((k) => norm(k.keyword) !== norm(prompt))
  const core = promptWords(prompt).slice(0, 2).join(' ')
  // the extra query sits among the prompt's top 5 (a little under the 4th busiest)
  const heads = base.filter((k) => matchOf(prompt, k.keyword) > 0).map((k) => k.impressions).sort((x, y) => y - x)
  const extraImpr = Math.max(40, Math.round(((heads[3] ?? 200) * 0.85) / 10) * 10)
  const url0 = base[0]?.url ?? `https://${CO_BRAND.domain}/`
  if (r < 0.16) {
    // no page about the topic: only the brand's other queries, which barely touch the prompt
    return base.filter((k) => matchOf(prompt, k.keyword) < 20).slice(0, 6)
      .concat([{ keyword: `${promptWords(prompt)[0] ?? 'skincare'} tips`, clicks: 1, impressions: 40, ctr: 2.5, position: 38.2, url: `https://${CO_BRAND.domain}/blog/skincare-basics` }])
  }
  // the prompt's own kind of search, as people type it (a question prompt: the question, shorter; a comparison: "best
  // X" / "X reviews"), among the busiest heads: the best query follows the prompt's intent
  const own = (() => {
    const p = prompt.toLowerCase()
    const m = p.match(/^can (.+) cause (.+)$/) ?? null
    if (m) return `does ${m[1]} cause ${m[2]}`
    const use = p.match(/^how to use (.+?) in a routine$/)
    if (use) return `how to use ${use[1]}`
    const best = p.match(/^best (.+?)(?: for .+)?$/)
    if (best) return `best ${best[1]}`
    const rev = p.match(/^(.+) review$/)
    if (rev) return `${rev[1]} reviews`
    return null
  })()
  const ownRow = own && !base.some((k) => k.keyword.toLowerCase() === own)
    ? [{ keyword: own, clicks: Math.round((heads[1] ?? 300) * 0.9 * 0.025), impressions: Math.round(((heads[1] ?? 300) * 0.9) / 10) * 10, ctr: 2.5, position: 8.4, url: url0 }]
    : []
  const extra = r < 0.55
    ? { keyword: `${core} near me`, clicks: Math.round(extraImpr * 0.02), impressions: extraImpr, ctr: 2, position: 22.4, url: url0 }
    : r < 0.75 ? { keyword: `my ${CO_BRAND.name.toLowerCase()} ${core} order`, clicks: Math.round(extraImpr * 0.03), impressions: extraImpr, ctr: 3, position: 9.8, url: `https://${CO_BRAND.domain}/account/orders` }
      // a site query among the heads: a forum or a competitor by name (the "site" tag; never the Best query)
      : { keyword: rnd(prompt, 'site') < 0.5 ? `${core} reddit` : `cerave ${core}`, clicks: Math.round(extraImpr * 0.02), impressions: Math.round(extraImpr * 1.6 / 10) * 10, ctr: 2, position: 14.6, url: url0 }
  return [...base.filter((k) => norm(k.keyword) !== norm(extra.keyword)), ...ownRow, extra]
}

// the rm-1 account: the app's sample (an invented lender), renamed to the account's made-up domain
const RM_PROMPT = 'How does a reverse mortgage line of credit grow over time?'
const rmUrl = (path) => `https://www.${RM_BRAND.domain}${path}/`
const RM_QUERY = (query, match, adjusted, intent, impressions, clicks, position, best, path, share) => ({ query, match, adjusted, intent, impressions, clicks, position, best, topPage: { url: rmUrl(path), path, share } })
const RM_ANALYSIS = (() => {
  const LOC = '/learn/reverse-mortgage-line-of-credit'
  const queries = [
    RM_QUERY('reverse mortgage line of credit', 60, 60, null, 1220, 34, 19.5, true, LOC, 0.8032786885245902),
    RM_QUERY('reverse mortgage line of credit growth rate', 75, 75, null, 210, 4, 9.6, false, LOC, 1),
    RM_QUERY('hecm line of credit growth', 80, 80, null, 120, 2, 12.2, false, LOC, 1),
    RM_QUERY('how does a reverse mortgage line of credit grow', 80, 80, null, 64, 1, 7.9, false, '/learn/how-reverse-mortgages-work', 1),
    RM_QUERY('reverse mortgage line of credit growth on my statement', 75, 38, 'account', 40, 0, 31, false, '/account/statements', 1),
  ]
  const bestQuery = queries[0]
  return {
    prompt: RM_PROMPT,
    terms: ['hecm', 'loc', 'grow', 'time'],
    queries,
    matchingQueries: 6,
    bestQuery,
    publishOn: { action: 'update', url: rmUrl(LOC), path: LOC, share: bestQuery.topPage.share, match: 60, query: bestQuery.query, reason: 'several-queries', lowVolume: false },
    topQueryPages: queries.slice(0, 3).map((q) => ({ query: q.query, url: q.topPage.url, path: q.topPage.path, share: q.topPage.share })),
    pages: [
      { url: rmUrl(LOC), path: LOC, key: `${RM_BRAND.domain}${LOC}`, score: 76, parts: { query: 0.8, volume: 1, rank: 0.46896551724137936, url: 0.5, cited: 1 }, impressions: 1310, clicks: 37, position: 16.4, queries: 3, cited: true },
      { url: rmUrl('/learn/how-reverse-mortgages-work'), path: '/learn/how-reverse-mortgages-work', key: `${RM_BRAND.domain}/learn/how-reverse-mortgages-work`, score: 63, parts: { query: 0.8, volume: 0.5815087860538306, rank: 0.7620689655172415, url: 0.25, cited: 0 }, impressions: 64, clicks: 1, position: 7.9, queries: 1, cited: false },
      { url: rmUrl('/account/statements'), path: '/account/statements', key: `${RM_BRAND.domain}/account/statements`, score: 31, parts: { query: 0.38, volume: 0.5, rank: 0, url: 0, cited: 0 }, impressions: 40, clicks: 0, position: 31, queries: 1, cited: false },
    ],
  }
})()

// the route's states (the app's routeStates)
const NOT_CONNECTED = { connected: false }
const RECONNECT = { connected: false, reason: 'reconnect' }
const NO_DOMAIN = { connected: false, reason: 'no-domain' }
const routeBase = (domain) => ({ connected: true, siteUrl: `https://www.${domain}/`, range: RANGE, fetchedAt: FETCHED_AT, lagNote: LAG_NOTE, cached: false, weeks: [] })

// The brand's Search Console connection for this visit, shared by the Content list and every prompt's workspace:
// 'connected' | 'new' (never asked) | 'skipped' (asked and skipped: the route's suggested page) | the route's own states
// 'reconnect' / 'no-domain' / 'no-data' (?co=). Kept in memory per brand domain (not localStorage), so the ?co= previews
// always open in their state; the app keeps the real connection on the server (gsc_tokens).
const BRAND_SC = new Map()
export const brandScState = (domain) => BRAND_SC.get(domain) ?? gscMatchState()
export const setBrandScState = (domain, state) => { BRAND_SC.set(domain, state) }

// 'connected' | 'new' | 'reconnect' | 'no-domain' | 'no-data' (this browser's preview: ?co=)
export function gscMatchState() {
  const co = coStates()
  return co.has('gsc-new') ? 'new' : co.has('gsc-reconnect') ? 'reconnect' : co.has('gsc-nodomain') ? 'no-domain' : co.has('gsc-nodata') ? 'no-data' : 'connected'
}

// GET …/gsc-match for one prompt: the route's response. row: the missed-prompt row; cited(path): AI engines cite it
export function gscMatchFor(row, { state = gscMatchState(), cited = () => false } = {}) {
  if (state === 'new' || state === 'skipped') return NOT_CONNECTED
  if (state === 'reconnect') return RECONNECT
  if (state === 'no-domain') return NO_DOMAIN
  const rm = row?.id === 'rm-1'
  const domain = rm ? RM_BRAND.domain : CO_BRAND.domain
  const suggestedPath = rm ? '/reverse-mortgage-line-credit-grow-time' : newPageFor(row).slug
  if (state === 'no-data') {
    return { ...routeBase(domain), totals: { queries: 0, pages: 0, clicks: 0, impressions: 0 }, matchingQueries: 0, queries: [], bestQuery: null, publishOn: { action: 'create', suggestedPath }, topQueryPages: [], pages: [] }
  }
  const a = rm ? RM_ANALYSIS : analyzeRows(row.prompt, dermasuriRows(row), {
    suggestedPath, cited, competitors: Object.entries(CO_BRANDS).map(([domain, b]) => ({ domain, name: b.name })),
    // the best-ranked page rarely gets all of a query's impressions: 70–95% on the busiest queries
    shareOf: (r) => (r.impressions >= 1000 ? +(0.7 + rnd(`${row.prompt}|${r.keyword}`, 'share') * 0.25).toFixed(2) : 1),
  })
  const totals = { queries: a.matchingQueries + 14, pages: a.pages.length + 9, clicks: a.pages.reduce((n, p) => n + p.clicks, 0) + 120, impressions: a.pages.reduce((n, p) => n + p.impressions, 0) + 4800 }
  return { ...routeBase(domain), totals, ...a }
}

// the Content list's "Best page" (the app's bestPageFor): the page to publish on, or a new page
export function bestPageFor(row, opts) {
  const res = gscMatchFor(row, opts)
  if (!res.connected) return null
  const p = res.publishOn
  return p.action === 'update'
    ? { prompt: row.prompt, action: 'update', path: p.path, url: p.url, match: p.match, query: p.query }
    : { prompt: row.prompt, action: 'create', suggestedPath: p.suggestedPath, match: 0 }
}
