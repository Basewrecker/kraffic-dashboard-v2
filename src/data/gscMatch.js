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
// Intent (owner, 2026-11-04; the app's matcher feat/content-page 4385c8e): a query can be the Best query only if it
// matches the prompt's core intent term(s), the words that make the question specific ("breakouts" in "can
// pigmentation serum cause breakouts"), not just the topic words. Topic words = the prompt's key terms found in at least
// half of its matching queries (TOPIC_SHARE); intent words = its other key terms, without the local / account marker
// words (those keep their half-score tag). Synonyms count as one: breakout(s) = acne = purging = pimples; cost = fees =
// price; grow = growth = increase. Each query gets intentMatch (true when the prompt has no intent words); the list
// sorts intent matches first, then by rank (adjusted × log10(impr + 1)); topic-only queries keep their score. Best:
// an intent match with ≥ 10 impressions that isn't a site query; none → no Best (never a topic-only one).
import { CO_BRAND, CO_BRANDS } from './contentOpportunities.js'
import { coStates, gscKeywordsFor, newPageFor, promptWords } from './contentOpportunities-proposed.js'
import { RM_BRAND } from './contentRecommendRm.js'

export const MATCH_WEIGHTS = { coverage: 55, precision: 20, phrase: 25 }
export const PAGE_WEIGHTS = { query: 45, volume: 20, rank: 15, url: 15, cited: 5 }
export const INTENT_PENALTY = { account: 0.5, local: 0.5, site: 0.5 }
export const TOPIC_SHARE = 0.5
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
// one word per meaning: synonyms (owner's list) and a plain plural → the same key
const SYN = [['breakout', 'breakouts', 'acne', 'purging', 'pimple', 'pimples'], ['cost', 'costs', 'fee', 'fees', 'price', 'prices', 'pricing'], ['grow', 'grows', 'growth', 'increase', 'increases']]
const SYN_OF = new Map(SYN.flatMap((g) => g.map((w) => [w, g[0]])))
export const canon = (w) => SYN_OF.get(w) ?? (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
const canonWords = (s) => new Set(promptWords(s).map(canon))
// the local / account markers aren't intent words (they keep their own half-score tag)
const MARKER = (w) => ACCOUNT.test(w) || LOCAL.test(w) || w === 'near' || w === 'me'
// the prompt's intent words, from its matching queries: its key terms that fewer than half of them contain
export function intentTerms(prompt, queries) {
  const terms = [...new Set(promptWords(prompt).map(canon))].filter((w) => !MARKER(w))
  if (!queries.length) return terms
  const sets = queries.map((q) => canonWords(q.query))
  return terms.filter((t) => sets.filter((ws) => ws.has(t)).length / sets.length < TOPIC_SHARE)
}
export const intentMatchOf = (query, intent) => !intent.length || [...canonWords(query)].some((w) => intent.includes(w))
const adjustedOf = (match, intent) => Math.round(match * (intent ? INTENT_PENALTY[intent] : 1))
const rank = (q) => q.adjusted * Math.log10(q.impressions + 1)
// Best: an intent match with ≥ 10 impressions, not a site query, the highest rank; none → null
const bestOf = (queries) => queries
  .filter((q) => q.impressions >= BEST_MIN_IMPRESSIONS && q.intent !== 'site' && q.intentMatch !== false)
  .reduce((b, q) => (!b || rank(q) > rank(b) ? q : b), null)
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
    return { query: r.keyword, match, adjusted: adjustedOf(match, intent), intent, impressions: r.impressions, clicks: r.clicks, position: r.position, best: false, topPage: { url: r.url, path: pathOf(r.url), share: shareOf(r) } }
  })
  const found = all.filter((q) => q.match > 0)
  const intentTermsOf = intentTerms(prompt, found)
  // intent matches first, then by rank
  const matching = found.map((q) => ({ ...q, intentMatch: intentMatchOf(q.query, intentTermsOf) }))
    .sort((a, b) => (a.intentMatch === b.intentMatch ? 0 : a.intentMatch ? -1 : 1) || rank(b) - rank(a))
  const best = bestOf(matching)
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
  return { prompt, terms, intentTerms: intentTermsOf, queries, matchingQueries: matching.length, bestQuery, publishOn, topQueryPages, pages }
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
  // a query with the prompt's intent words, as people type it, among the busiest heads ("can X cause breakouts" →
  // "does X cause acne", a synonym; "best X for Y" → "X for Y"; "how to use X in a routine" → "X routine"; "X review"
  // → "X reviews"), so the Best query follows the prompt's intent
  const own = (() => {
    const p = prompt.toLowerCase()
    const m = p.match(/^can (.+) cause (.+)$/) ?? null
    if (m) return `does ${m[1]} cause ${m[2] === 'breakouts' ? 'acne' : m[2]}`
    const use = p.match(/^how to use (.+?) in a routine$/)
    if (use) return `${use[1]} routine`
    const best = p.match(/^best (.+?) for (.+)$/)
    if (best) return `${best[1]} for ${best[2]}`
    const rev = p.match(/^(.+) review$/)
    if (rev) return `${rev[1]} reviews`
    // any other prompt: its topic plus the words that make it specific ("niacinamide serum for humid weather" →
    // "niacinamide serum humid weather"), never the prompt word for word
    const w = promptWords(prompt)
    return w.length > 2 ? `${core} ${w.slice(2).join(' ')}` : null
  })()
  // the extra (local / account / site) query carries the prompt's specific word too, like the app's sample's
  // "…growth on my statement": tagged and scored at half, but an intent match, so it shows among the heads
  const tail = promptWords(prompt).slice(2).at(-1) ?? ''
  const ownRow = own && !base.some((k) => k.keyword.toLowerCase() === own)
    ? [{ keyword: own, clicks: Math.round((heads[1] ?? 300) * 0.9 * 0.025), impressions: Math.round(((heads[1] ?? 300) * 0.9) / 10) * 10, ctr: 2.5, position: 8.4, url: url0 }]
    : []
  const extra = r < 0.55
    ? { keyword: `${core} ${tail} near me`.replace(/\s+/g, ' '), clicks: Math.round(extraImpr * 0.02), impressions: extraImpr, ctr: 2, position: 22.4, url: url0 }
    : r < 0.75 ? { keyword: `my ${CO_BRAND.name.toLowerCase()} ${core} ${tail} order`.replace(/\s+/g, ' '), clicks: Math.round(extraImpr * 0.03), impressions: extraImpr, ctr: 3, position: 9.8, url: `https://${CO_BRAND.domain}/account/orders` }
      // a site query among the heads: a forum or a competitor by name (the "site" tag; never the Best query)
      : { keyword: rnd(prompt, 'site') < 0.5 ? `${core} ${tail} reddit`.replace(/\s+/g, ' ') : `cerave ${core} ${tail}`.replace(/\s+/g, ' '), clicks: Math.round(extraImpr * 0.02), impressions: Math.round(extraImpr * 1.6 / 10) * 10, ctr: 2, position: 14.6, url: url0 }
  return [...base.filter((k) => norm(k.keyword) !== norm(extra.keyword)), ...ownRow, extra]
}

// the rm-1 account: the app's sample (an invented lender), renamed to the account's made-up domain
const RM_PROMPT = 'How does a reverse mortgage line of credit grow over time?'
const rmUrl = (path) => `https://www.${RM_BRAND.domain}${path}/`
const RM_QUERY = (query, match, adjusted, intent, impressions, clicks, position, best, path, share) => ({ query, match, adjusted, intent, impressions, clicks, position, best, topPage: { url: rmUrl(path), path, share } })
const RM_ANALYSIS = (() => {
  const LOC = '/learn/reverse-mortgage-line-of-credit'
  // the owner's intent rule (the app's matcher): "grow" and "time" make this prompt specific (growth = grow), so the
  // intent matches come first and the Best is "…growth rate"; the topic-only "reverse mortgage line of credit" ranks
  // below them though it's busier
  const Q = (...a) => ({ ...RM_QUERY(...a.slice(0, 10)), intentMatch: a[10] })
  const queries = [
    Q('reverse mortgage line of credit growth rate', 75, 75, null, 210, 4, 9.6, true, LOC, 1, true),
    Q('hecm line of credit growth', 80, 80, null, 120, 2, 12.2, false, LOC, 1, true),
    Q('how does a reverse mortgage line of credit grow', 80, 80, null, 64, 1, 7.9, false, '/learn/how-reverse-mortgages-work', 1, true),
    Q('reverse mortgage line of credit growth on my statement', 75, 38, 'account', 40, 0, 31, false, '/account/statements', 1, true),
    Q('reverse mortgage line of credit', 60, 60, null, 1220, 34, 19.5, false, LOC, 0.8032786885245902, false),
  ]
  const bestQuery = queries[0]
  return {
    prompt: RM_PROMPT,
    terms: ['hecm', 'loc', 'grow', 'time'],
    intentTerms: ['grow', 'time'],
    queries,
    matchingQueries: 6,
    bestQuery,
    publishOn: { action: 'update', url: rmUrl(LOC), path: LOC, share: bestQuery.topPage.share, match: 75, query: bestQuery.query, reason: 'several-queries', lowVolume: false },
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
