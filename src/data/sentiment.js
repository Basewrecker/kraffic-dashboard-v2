// /sentiment: how third-party pages describe the brand in AI answers (mock data + the page's pure logic).
// Production (app: Re-analyze → POST /api/reputation → lib/reputation-scan.js): searches the brand's hidden default
// prompts on Google (SerpAPI credits), reads up to 40 of the top result pages and has a model score each page, so
// every run is a PAID run. Each run stores its own sources [{ url, title, sentiment, engines }]; a page is positive,
// neutral, mixed or negative, or Not scored when it couldn't be read.
//
// The app reads this file's shape through lib/sentiment-adapter.js (sentimentFor → { runs, pages, swot }, runPages):
//   runs   [{ id, createdAt, date, counts }] oldest → newest, counts = the run's pages per tone (countTones)
//   pages  the latest run's pages [{ id, url, domain, path, title, engines, tone, sentences: [{ text, tone, mark }],
//          noQuote }]. id: the page's address after the shared cited-page rule, the same in every run. url: the exact
//          cited URL as stored (links use it normalised, utils/spectrum.js pageHref); null = no URL stored, no link.
//          sentences: the brand analysis's quotes for the page (mark: always null, the analysis keeps no phrase)
//   swot   the brand analysis's themes { strengths, weaknesses, opportunities, threats: [{ theme, evidence, sources:
//          [page ids], match: null }] } (latest run only)
//   runPages(pages, counts, runId) → a run's own stored pages
// The pure logic below is the app adapter's (same names, same rules); only the data under it is the mock's.
//
// Score: 0–100 from the scored pages only, 50 + (positive − negative) ÷ scored × 50. 50 is a balance, not a confidence.

// ---- pure logic (tested in sentiment.test.js) ---------------------------------------------------------------------

export const TONES = ['positive', 'neutral', 'mixed', 'negative', 'unscored']
export const SCORED_TONES = ['positive', 'neutral', 'mixed', 'negative']
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

// 0–100 from the scored pages only. 50 is a balance, not a confidence level.
export function scoreOf(c) {
  const n = scoredOf(c)
  if (!n) return null
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

// one line for Over time: each sync's share of its own pages, so 1 page out of 21 is 5%, not a score of 1.
// tone, when passed, is that one series only (the chart's filter).
export function shareTrendLine(columns, tone = null) {
  if (!columns || columns.length < 2) return null
  const pcts = columns.map((c) => tonePercents(c.counts))
  const series = (t, label) => `${label} ${pcts.map((p) => `${p[t]}%`).join(' → ')}`
  if (TONES.includes(tone)) return series(tone, TONE_LABEL[tone])
  return `Share of scored pages in each sync. ${series('positive', 'Positive')} · ${series('neutral', 'Neutral')} · ${series('mixed', 'Mixed')} · ${series('negative', 'Negative')}.`
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
      if (!domain) continue
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

// each run with its score and the change vs the run before it (newest last)
export function withScores(runs) {
  return runs.map((r, i) => {
    const score = scoreOf(r.counts)
    const prev = i ? scoreOf(runs[i - 1].counts) : null
    return { ...r, score, delta: prev == null || score == null ? null : score - prev }
  })
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

// the insight line under the top strip, from the latest run's counts
export function sentimentInsight(c, brand) {
  const n = scoredOf(c)
  const unread = num(c, 'unscored')
  if (!n && !unread) return null
  if (!n) return `${unread} ${unread === 1 ? 'page was' : 'pages were'} found about ${brand}, and none could be scored.`
  const counts = `${num(c, 'positive')} positive, ${num(c, 'neutral')} neutral, ${num(c, 'mixed')} mixed, ${num(c, 'negative')} negative`
  const tail = unread ? ` ${unread} more ${unread === 1 ? 'was' : 'were'} not scored.` : ''
  return `${counts}, out of ${n} scored ${n === 1 ? 'page' : 'pages'} about ${brand}.${tail}`
}

// the hero's line under the score, by score band (null: nothing scored)
// 80–100 Very positive · 60–79 Mostly positive · 41–59 Balanced · 21–40 Mostly negative · 0–20 Very negative
// counts, when passed: an all-neutral run is Neutral, not Balanced and not an even split. The overall verdict reads
// "Balanced" (2026-11-02, owner), so it isn't confused with Mixed pages.
export function heroLine(score, counts) {
  if (score == null) return 'No pages scored yet'
  const n = counts ? scoredOf(counts) : 0
  if (counts && n && num(counts, 'neutral') === n && !num(counts, 'mixed')) return 'Neutral'
  if (counts && n && num(counts, 'mixed') === n) return 'Balanced'
  if (score >= 80) return 'Very positive'
  if (score >= 60) return 'Mostly positive'
  if (score >= 41) return 'Balanced'
  if (score >= 21) return 'Mostly negative'
  return 'Very negative'
}
// Sample size, one muted line under the owner's sentence (2026-11-02): "Scored 17 of 18 pages." / "Scored 16 pages."
export function scoredLine(counts) {
  const unread = num(counts, 'unscored')
  const scored = scoredOf(counts)
  return unread ? `Scored ${scored} of ${scored + unread} pages.` : `Scored ${scored} ${scored === 1 ? 'page' : 'pages'}.`
}
// The score label's ⓘ: how the score works, then Harsh's sentence with the real count (no "not scored" part when 0)
export const SCORE_EXPLAINED = '0–100 from the scored pages. 50 means positive and negative balance. It is not a confidence level. Pages that could not be read are shown as Not scored and left out.'
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


// ---- mock data ----------------------------------------------------------------------------------------------------

// one run per Re-analyze, oldest first. createdAt decides how a run was scored: runs from SCORING_UPDATED on
// (2026-11-02T08:35:42Z, utils/sentimentSections.js) were scored the new way (Mixed and Not scored kept apart), so Nov 2
// is the first run that isn't compared with the ones before it, and Nov 3 compares with Nov 2 again.
const RUN_TIMES = [
  ['r1', '2026-08-11T09:00:00.000Z'], ['r2', '2026-08-25T09:00:00.000Z'], ['r3', '2026-09-08T09:00:00.000Z'],
  ['r4', '2026-09-22T09:00:00.000Z'], ['r5', '2026-10-06T09:00:00.000Z'], ['r6', '2026-10-20T09:00:00.000Z'],
  ['r7', '2026-11-02T10:00:00.000Z'], ['r8', '2026-11-03T09:00:00.000Z'],
]

// every page cited for the brand in any run. tones: the page's tone in each run above, one letter per run
// (P positive · N neutral · M mixed · G negative · U Not scored, the page couldn't be read · . not cited that run).
// Older runs (before Nov 2) have no Mixed or Not scored pages: the old scoring stored both as neutral.
// engines: Google search, ChatGPT and Claude only. Pages analysed before quotes were kept, and pages that couldn't be
// read, have none (noQuote): they show their title and "Quote appears after the next analysis".
const S = (text, tone) => ({ text, tone, mark: null })
const CATALOGUE = [
  { id: 'p1', tones: 'NNPPPPPP', url: 'https://www.byrdie.com/best-niacinamide-serums-5089123?utm_source=chatgpt.com', domain: 'byrdie.com', path: '/best-niacinamide-serums-5089123', title: 'The 14 Best Niacinamide Serums, Tested by Editors', engines: ['google', 'chatgpt'], sentences: [
    S('Dermasuri’s 10% serum was the gentlest formula we tested, with no stinging even on reactive skin.', 'positive'),
    S('At $24 it sits in the middle of the pack on price.', 'neutral')] },
  { id: 'p2', tones: 'PPPPPPPP', url: 'https://www.reddit.com/r/SkincareAddiction/comments/1f3k9xq/dermasuri_barrier_cream_3_months_in_review/', domain: 'reddit.com', path: '/r/SkincareAddiction/comments/1f3k9xq/dermasuri_barrier_cream_3_months_in_review/', title: 'Dermasuri barrier cream: 3 months in (review)', engines: ['google', 'chatgpt', 'claude'], sentences: [
    S('Three months in and my redness is visibly calmer; Dermasuri is my holy grail now.', 'positive'),
    S('Shipping to Canada took almost two weeks though.', 'negative')] },
  { id: 'p3', tones: 'NNNGGGGG', url: 'https://www.trustpilot.com/review/dermasuri.com?page=2', domain: 'trustpilot.com', path: '/review/dermasuri.com', title: 'Dermasuri reviews | Read customer service reviews', engines: ['google', 'chatgpt'], sentences: [
    S('Ordered twice and both times the pump on the bottle broke within a week.', 'negative'),
    S('Customer service took nine days to reply to my refund request.', 'negative')] },
  { id: 'p4', tones: '..PPPPPP', url: 'https://www.healthline.com/health/beauty-skin-care/fragrance-free-moisturizers#dermasuri', domain: 'healthline.com', path: '/health/beauty-skin-care/fragrance-free-moisturizers', title: 'Fragrance-Free Moisturizers Dermatologists Recommend', engines: ['google', 'claude'], sentences: [
    S('Dermasuri is one of the few brands whose whole line is fragrance-free and tested on sensitive skin.', 'positive')] },
  { id: 'p5', tones: 'NNNNNNMM', url: 'https://www.dermstore.com/blog/ceramide-creams-compared/', domain: 'dermstore.com', path: '/blog/ceramide-creams-compared/', title: 'Ceramide Creams Compared: Which One Is Right for You?', engines: ['google', 'chatgpt'], sentences: [
    S('Dermasuri, CeraVe and La Roche-Posay all use a 3:1:1 lipid ratio.', 'neutral'),
    S('Dermasuri’s cream left skin the softest of the three after a week.', 'positive'),
    S('The last of the Dermasuri cream is hard to squeeze out of the tube.', 'negative')] },
  { id: 'p6', tones: 'NNNNNNNN', url: 'https://www.allure.com/story/best-skin-care-brands-2026?utm_source=chatgpt.com&utm_medium=referral', domain: 'allure.com', path: '/story/best-skin-care-brands-2026', title: 'The Best Skin-Care Brands of 2026', engines: ['google'], sentences: [
    S('Newer names on the list include Dermasuri and Bubble.', 'neutral')] },
  { id: 'p7', tones: 'NNNNNNNN', url: 'https://incidecoder.com/products/dermasuri-barrier-repair-cream', domain: 'incidecoder.com', path: '/products/dermasuri-barrier-repair-cream', title: 'Dermasuri Barrier Repair Cream: ingredients explained', engines: ['chatgpt', 'claude'], sentences: [
    S('Dermasuri Barrier Repair Cream contains ceramide NP, cholesterol and 2% niacinamide.', 'neutral')] },
  { id: 'p8', tones: 'NNNNNN.N', url: 'https://www.cosmopolitan.com/style-beauty/beauty/g4417/best-drugstore-moisturizers/', domain: 'cosmopolitan.com', path: '/style-beauty/beauty/g4417/best-drugstore-moisturizers/', title: '20 Best Drugstore Moisturizers, According to Derms', engines: ['google'], sentences: [
    S('Dermasuri is sold online and at a handful of Target stores.', 'neutral')] },
  { id: 'p9', tones: 'NNNNNNNN', url: 'https://www.skincarisma.com/products/dermasuri/niacinamide-10-serum/ingredient_list', domain: 'skincarisma.com', path: '/products/dermasuri/niacinamide-10-serum/ingredient_list', title: 'Dermasuri Niacinamide 10% Serum: ingredient analysis', engines: ['chatgpt'], sentences: [
    S('The Dermasuri serum is free of alcohol, essential oils and silicones.', 'neutral')] },
  { id: 'p10', tones: 'NNNPPPPP', url: 'https://www.refinery29.com/en-us/2026/03/11384021/sensitive-skin-routine-dermatologist?gclid=Cj0KCQ', domain: 'refinery29.com', path: '/en-us/2026/03/11384021/sensitive-skin-routine-dermatologist', title: 'A Dermatologist’s Routine for Sensitive Skin', engines: ['google', 'chatgpt'], sentences: [
    S('I recommend Dermasuri to patients who react to everything; it rarely irritates.', 'positive')] },
  { id: 'p11', tones: 'NNNNNNNN', url: 'https://en.wikipedia.org/wiki/Niacinamide', domain: 'wikipedia.org', path: '/wiki/Niacinamide', title: 'Niacinamide - Wikipedia', engines: ['claude'], sentences: [
    S('Brands that sell 10% serums include The Ordinary, Paula’s Choice and Dermasuri.', 'neutral')] },
  { id: 'p12', tones: 'NNNNNGGG', url: 'https://www.makeupalley.com/product/showreview.asp/ItemId=231447/Gentle-Cleanser/Dermasuri/Cleansers', domain: 'makeupalley.com', path: '/product/showreview.asp/ItemId=231447/Gentle-Cleanser/Dermasuri/Cleansers', title: 'Dermasuri Gentle Cleanser reviews', engines: ['google'], sentences: [
    S('For the price, the Dermasuri cleanser runs out far too fast.', 'negative'),
    S('It does leave my skin soft.', 'positive')] },
  { id: 'p13', tones: 'NNNNNNMM', url: 'https://www.glamour.com/story/best-moisturizers-for-dry-skin?fbclid=IwAR0x', domain: 'glamour.com', path: '/story/best-moisturizers-for-dry-skin', title: 'The Best Moisturizers for Dry Skin', engines: ['google', 'chatgpt', 'claude'], sentences: [
    S('Dermasuri’s cream kept dry patches away all day.', 'positive'),
    S('Under makeup, the Dermasuri cream felt heavy by midday.', 'negative')] },
  { id: 'p14', tones: '.NNNNNNN', url: 'https://www.vogue.com/article/clean-beauty-brands', domain: 'vogue.com', path: '/article/clean-beauty-brands', title: 'Clean Beauty Brands Worth Knowing', engines: ['google'], sentences: [] },
  { id: 'p15', tones: 'GGNNNNNN', url: 'https://www.womenshealthmag.com/beauty/a19883421/best-face-serums/', domain: 'womenshealthmag.com', path: '/beauty/a19883421/best-face-serums/', title: 'The Best Face Serums for Every Skin Concern', engines: ['google', 'chatgpt'], sentences: [
    S('Dermasuri sells a 10% niacinamide serum and a vitamin C serum.', 'neutral'),
    S('Our tester’s Dermasuri vitamin C serum turned orange within weeks.', 'negative')] },
  { id: 'p16', tones: 'PPPPPPPP', url: 'https://www.nytimes.com/wirecutter/reviews/best-moisturizers/', domain: 'nytimes.com', path: '/wirecutter/reviews/best-moisturizers/', title: 'The Best Moisturizers | Reviews by Wirecutter', engines: ['google', 'chatgpt', 'claude'], sentences: [
    S('Our runner-up, Dermasuri, absorbed faster than any other cream we tried.', 'positive'),
    S('It does cost more than our top pick.', 'negative')] },
  { id: 'p17', tones: 'NNNNNNNN', url: null, domain: 'beautypedia.com', path: '/products/dermasuri-vitamin-c-serum', title: 'Dermasuri Vitamin C Serum review', engines: ['chatgpt'], sentences: [
    S('The Dermasuri formula uses 15% ascorbic acid in an airless pump.', 'neutral')] },
  { id: 'p18', tones: 'NNNNNNUU', url: 'https://www.influenster.com/reviews/dermasuri?ref=search', domain: 'influenster.com', path: '/reviews/dermasuri', title: 'Dermasuri reviews on Influenster', engines: ['google'], sentences: [] },
  { id: 'p19', tones: 'GGGNNNNN', url: 'https://theskincareedit.com/dermasuri-vs-cerave-barrier-cream', domain: 'theskincareedit.com', path: '/dermasuri-vs-cerave-barrier-cream', title: 'Dermasuri vs CeraVe: which barrier cream wins?', engines: ['google', 'chatgpt'], sentences: [
    S('Dermasuri costs about twice as much as CeraVe for a similar formula.', 'negative'),
    S('Both are fragrance-free.', 'neutral')] },
  { id: 'p20', tones: 'NNNNNNUU', url: 'https://www.youtube.com/watch?v=Qd8sR3ofxLk&utm_source=chatgpt.com', domain: 'youtube.com', path: '/watch', title: 'My $60 sensitive-skin routine (Dermasuri, Vanicream)', engines: ['google'], sentences: [] },
  { id: 'p21', tones: 'NNNGNNNN', url: 'https://www.reviewed.com/beauty/best-right-now/the-best-face-cleansers', domain: 'reviewed.com', path: '/beauty/best-right-now/the-best-face-cleansers', title: 'The Best Face Cleansers of 2026', engines: ['google'], sentences: [
    S('Dermasuri ships free on orders over $35.', 'neutral'),
    S('The Dermasuri cleanser ran out in under a month.', 'negative')] },
  { id: 'p22', tones: '......MM', url: 'https://www.newbeauty.com/dermasuri-barrier-cream-review/', domain: 'newbeauty.com', path: '/dermasuri-barrier-cream-review/', title: 'Dermasuri Barrier Cream review: worth the price?', engines: ['chatgpt', 'claude'], sentences: [
    S('The Dermasuri cream calmed a flare-up in two days.', 'positive'),
    S('At twice the price of drugstore creams, it’s hard to call it a bargain.', 'negative')] },
  { id: 'p23', tones: '.......P', url: 'https://www.self.com/story/best-moisturizers-for-sensitive-skin', domain: 'self.com', path: '/story/best-moisturizers-for-sensitive-skin', title: 'The Best Moisturizers for Sensitive Skin, Tested', engines: ['google', 'chatgpt'], sentences: [
    S('Dermasuri was the only cream none of our sensitive-skin testers reacted to.', 'positive')] },
  { id: 'p24', tones: 'GG......', url: 'https://www.harpersbazaar.com/beauty/skin-care/a61234567/new-serum-launches/', domain: 'harpersbazaar.com', path: '/beauty/skin-care/a61234567/new-serum-launches/', title: 'The New Serum Launches We Tried This Summer', engines: ['google'], sentences: [
    S('Two of our testers broke out within a week of starting the Dermasuri serum.', 'negative')] },
]
const TONE_CODE = { P: 'positive', N: 'neutral', M: 'mixed', G: 'negative', U: 'unscored' }

// each run's own pages, as production stores them: run id → [page]
const BY_RUN = new Map(RUN_TIMES.map(([id], i) => [id, CATALOGUE
  .filter((p) => TONE_CODE[p.tones[i]])
  .map(({ tones, ...p }) => ({ ...p, tone: TONE_CODE[tones[i]], noQuote: !p.sentences.length }))]))

export const RUNS = RUN_TIMES.map(([id, createdAt]) => ({ id, createdAt, date: createdAt.slice(0, 10), counts: countTones(BY_RUN.get(id)) }))
export const PAGES = BY_RUN.get(RUNS.at(-1).id)

// What people say: the latest run's themes (production: content_insights from the brand analysis, latest run only).
// sources: the pages the theme cites (page ids); a theme whose pages aren't in the latest run isn't shown.
const T = (theme, sources, evidence = null) => ({ theme, evidence, sources, match: null })
export const SWOT = {
  strengths: [
    T('Gentle on sensitive skin', ['p1', 'p4', 'p10', 'p23']),
    T('Fragrance-free across the line', ['p4', 'p9', 'p19']),
    T('Absorbs quickly', ['p16']),
  ],
  weaknesses: [
    T('Pumps break on some bottles', ['p3']),
    T('Slow customer service replies', ['p3']),
    T('The last of the cream is hard to get out', ['p5']),
    T('Vitamin C serum turns orange quickly', ['p15']),
  ],
  opportunities: [
    T('Dermatologists already recommend it', ['p10', 'p4']),
    T('Few marketplace reviews yet', ['p18', 'p20']),
  ],
  threats: [
    T('Cleanser runs out fast', ['p12', 'p21']),
    T('Seen as pricier than CeraVe', ['p19', 'p22', 'p1']),
    T('Feels heavy under makeup', ['p13']),
  ],
}

// a run's own stored pages (the app: the pages its runs were saved with)
export function runPages(_pages, _counts, runId) {
  return BY_RUN.get(runId) ?? []
}

// the account's own brands only (no competitor sentiment); a brand never analysed: nothing yet
export const sentimentFor = (domain, own) => (domain === own ? { runs: RUNS, pages: PAGES, swot: SWOT } : { runs: [], pages: [], swot: null })
