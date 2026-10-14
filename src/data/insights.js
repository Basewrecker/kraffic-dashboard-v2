// Phase 6 (hidden from the sidebar): /citations, /sentiment, /fact-check.
// Shaped from production (READ-ONLY, apps/api/src/modules/{citations,visibility}):
//   Citations  ← GET citations/insights (CitationInsightsResponse: domains[] {domain, category, citations, engines,
//                topUrls}, own {citations, share}, series) + GET citations/sources (examples per domain).
//   Sentiment  ← GET visibility/sentiment-insights (SentimentInsights: current/previous SentimentSplit, series,
//                platforms, ranking.brands, highlights.negative StatementExample {question, quote, engineSlug}).
//   Fact Check ← GET visibility/factcheck-insights (FactCheckInsights: facts FactRow {confirmedFact}, claims
//                InaccurateClaim {quote, why, engineSlug, factId}, platforms accuracy) + BusinessFact (Website facts).
// GAP marks a field production doesn't return. ?mock=full|small|empty|none on each page:
//   full = 6 syncs · small = 1–2 syncs · empty = a project with no prompts · none = prompts, but no data for this page yet.
import { account, citedPages, citedPagesOther, competitors, trackedPrompts } from './mock.js'

export const ENGINES = { aio: 'AI Overview', chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude' }
const SYNCS = ['2026-08-31', '2026-09-07', '2026-09-16', '2026-09-21', '2026-09-28', '2026-10-05']
const visible = trackedPrompts.filter((p) => p.status === 'visible')
const about = (re, n) => visible.filter((p) => re.test(p.prompt)).slice(0, n).map((p) => p.id)
const any = (i, n) => visible.slice(i, i + n).map((p) => p.id)
const comp = competitors.filter((c) => !c.you).map((c) => c.domain) // cerave, theordinary, paulaschoice

// ---- Citations --------------------------------------------------------------------------------------------------
// per engine × who: production returns citations per engine per website (domains[].engines) + a category per website;
// the split below is that, added up (GAP: no ready per-engine × category total).
const citeFull = {
  you: { citations: 30, previous: 27, pages: 7 },
  totals: { citations: 412, websites: 46, answersChecked: 608 },
  byEngine: [
    { engine: 'aio', you: 25, competitors: 21, other: 118 },
    { engine: 'chatgpt', you: 4, competitors: 14, other: 92 },
    { engine: 'gemini', you: 1, competitors: 9, other: 77 },
    { engine: 'claude', you: 0, competitors: 6, other: 45 },
  ],
  top: [ // CitationDomain: domain · category · citations
    { domain: 'reddit.com', type: 'Other', citations: 61 }, { domain: 'healthline.com', type: 'Other', citations: 44 },
    { domain: account.domain, type: 'You', citations: 30 }, { domain: 'byrdie.com', type: 'Other', citations: 27 },
    { domain: 'cerave.com', type: 'Competitor', citations: 26 }, { domain: 'aad.org', type: 'Other', citations: 22 },
    { domain: 'allure.com', type: 'Other', citations: 19 }, { domain: 'theordinary.com', type: 'Competitor', citations: 14 },
  ],
  // GAP: production has this only in the agency's older advanced view (GET citations/gaps, "may contain sample data")
  winnable: [
    { domain: 'byrdie.com', cites: comp, prompts: 11, citations: 27, url: 'https://www.byrdie.com/best-vitamin-c-serums' },
    { domain: 'allure.com', cites: [comp[0], comp[1]], prompts: 8, citations: 19, url: 'https://www.allure.com/gallery/best-sunscreens' },
    { domain: 'womenshealthmag.com', cites: [comp[0]], prompts: 6, citations: 12, url: 'https://www.womenshealthmag.com/beauty/best-moisturizers' },
    { domain: 'cosmopolitan.com', cites: [comp[1], comp[2]], prompts: 5, citations: 9, url: 'https://www.cosmopolitan.com/style-beauty/beauty/retinol' },
    { domain: 'nytimes.com', cites: [comp[0]], prompts: 4, citations: 7, url: 'https://www.nytimes.com/wirecutter/reviews/best-sunscreen' },
    { domain: 'refinery29.com', cites: [comp[2]], prompts: 3, citations: 5, url: 'https://www.refinery29.com/en-us/niacinamide-serum' },
  ],
  // owned topUrls {url, title, answers}. GAP: engines and prompts per page (production has them per website only)
  pages: [...citedPages.filter((p) => p.path), ...citedPagesOther].map((p, i) => ({
    path: p.path, citations: p.count, delta: p.delta, engines: p.platforms.map((x) => (x === 'google' ? 'aio' : x)),
    prompts: any(i * 3, Math.max(1, Math.min(p.count, 5))),
  })),
}
const citeSmall = {
  you: { citations: 12, previous: null, pages: 3 },
  totals: { citations: 104, websites: 21, answersChecked: 152 },
  byEngine: citeFull.byEngine.map((e) => ({ engine: e.engine, you: Math.round(e.you * 0.4), competitors: Math.round(e.competitors / 4), other: Math.round(e.other / 4) })),
  top: citeFull.top.slice(0, 8).map((d) => ({ ...d, citations: d.type === 'You' ? 12 : Math.max(1, Math.round(d.citations / 4)) })).sort((a, b) => b.citations - a.citations),
  winnable: citeFull.winnable.slice(0, 3).map((w) => ({ ...w, prompts: Math.ceil(w.prompts / 3), citations: Math.ceil(w.citations / 4) })),
  pages: citeFull.pages.slice(0, 3).map((p) => ({ ...p, citations: Math.ceil(p.citations / 2), delta: null })),
}

// ---- Sentiment --------------------------------------------------------------------------------------------------
// SentimentSplit per scan {positive, neutral, negative} statements; series = one point per analysed scan
const tone = (day, positive, neutral, negative) => ({ day, positive, neutral, negative, total: positive + neutral + negative })
const sentFull = {
  series: [tone(SYNCS[0], 31, 18, 9), tone(SYNCS[1], 34, 17, 8), tone(SYNCS[2], 29, 16, 14), tone(SYNCS[3], 36, 19, 7), tone(SYNCS[4], 40, 18, 7), tone(SYNCS[5], 44, 17, 6)],
  answers: 115, previousAnswers: 108,
  byEngine: [ // platforms[] SentimentRow
    { engine: 'aio', positive: 26, neutral: 8, negative: 2 },
    { engine: 'chatgpt', positive: 11, neutral: 5, negative: 3 },
    { engine: 'gemini', positive: 7, neutral: 4, negative: 1 },
    { engine: 'claude', positive: 0, neutral: 0, negative: 0 },
  ],
  // ranking.brands (client portal; competitors are read only after POST answer-analysis/competitors/run)
  brands: [
    { domain: account.domain, name: account.name, you: true, positive: 66, negative: 9, prevNet: 52 },
    { domain: 'cerave.com', name: 'CeraVe', positive: 71, negative: 6, prevNet: 66 },
    { domain: 'theordinary.com', name: 'The Ordinary', positive: 54, negative: 17, prevNet: 41 },
    { domain: 'paulaschoice.com', name: 'Paula’s Choice', positive: 49, negative: 21, prevNet: 33 },
  ],
  // highlights.negative / sentiment-ranking-statements: StatementExample {question, quote, engineSlug}
  negative: [
    { id: 'n1', promptId: about(/vitamin c/i, 1)[0], engine: 'chatgpt', quote: `${account.name}’s vitamin C serum is effective, but at $38 it is pricier than The Ordinary’s option and some users report it oxidises within a month.`, bad: 'some users report it oxidises within a month' },
    { id: 'n2', promptId: about(/sunscreen/i, 1)[0], engine: 'aio', quote: `Reviewers say ${account.name}’s mineral sunscreen can leave a slight white cast on deeper skin tones, so a tinted version may suit better.`, bad: 'can leave a slight white cast on deeper skin tones' },
    { id: 'n3', promptId: about(/retinol/i, 1)[0], engine: 'chatgpt', quote: `Beginners may find ${account.name}’s retinol too strong at first; dermatologists suggest starting with a gentler formula.`, bad: 'too strong at first' },
    { id: 'n4', promptId: about(/eye/i, 1)[0], engine: 'gemini', quote: `${account.name}’s eye cream is hydrating but shows limited results on dark circles compared with caffeine-based creams.`, bad: 'shows limited results on dark circles' },
    { id: 'n5', promptId: about(/cleanser|face wash/i, 1)[0], engine: 'aio', quote: `Some people with very dry skin find ${account.name}’s gel cleanser slightly stripping in winter.`, bad: 'slightly stripping in winter' },
    { id: 'n6', promptId: about(/moisturi[sz]er/i, 1)[0], engine: 'chatgpt', quote: `${account.name} is harder to find in stores than CeraVe, which is sold in most pharmacies.`, bad: 'harder to find in stores' },
  ],
}
const sentSmall = {
  series: [tone(SYNCS[4], 9, 5, 2), tone(SYNCS[5], 12, 4, 2)],
  answers: 32, previousAnswers: 27,
  byEngine: [{ engine: 'aio', positive: 8, neutral: 2, negative: 1 }, { engine: 'chatgpt', positive: 3, neutral: 1, negative: 1 }, { engine: 'gemini', positive: 1, neutral: 1, negative: 0 }, { engine: 'claude', positive: 0, neutral: 0, negative: 0 }],
  brands: [{ ...sentFull.brands[0], positive: 67, negative: 11, prevNet: null }], // competitors not read yet
  negative: sentFull.negative.slice(0, 2),
}

// ---- Fact Check -------------------------------------------------------------------------------------------------
// true value = BusinessFact.value (Website facts, USER_PROVIDED / USER_VERIFIED). GAP: the fact's name (field isn't
// returned), "correct" and "missing" per fact (production only flags inaccurate claims), the source AI likely used,
// and how-to-fix steps.
const fact = (id, name, value, status, said = [], source = null, fix = []) => ({ id, name, value, status, said, source, fix })
const said = (engine, promptId, quote, wrong) => ({ engine, promptId, quote, wrong })
const factsFull = [
  fact('f1', 'Vitamin C serum price', '$38 for 30 ml', 'wrong', [
    said('chatgpt', about(/vitamin c/i, 1)[0], `The ${account.name} 15% Vitamin C Serum costs around $52 for 30 ml, which puts it at the premium end.`, 'around $52 for 30 ml'),
    said('gemini', about(/vitamin c/i, 2)[1], `Expect to pay about $52 for ${account.name}’s vitamin C serum.`, 'about $52'),
  ], { domain: 'beautyprices.co', url: 'https://beautyprices.co/dermasuri-vitamin-c' }, [
    'Check the price on the product page is in the first screen and in the Product schema (offers.price).',
    'Ask beautyprices.co to update the listing; it still shows the 2025 price.',
    'Add “$38” to Website Facts so the next scan checks it.',
  ]),
  fact('f2', 'Founded', '2018', 'wrong', [
    said('aio', about(/serum/i, 1)[0], `${account.name}, founded in 2015, is a dermatologist-led skincare brand.`, 'founded in 2015'),
  ], { domain: 'crunchbase.com', url: 'https://www.crunchbase.com/organization/dermasuri' }, [
    'Add the founding year to the About page and to Organization schema (foundingDate).',
    'Correct the Crunchbase profile, which lists 2015.',
  ]),
  fact('f3', 'Cruelty-free', 'Leaping Bunny certified', 'wrong', [
    said('chatgpt', about(/sensitive/i, 1)[0], `It’s unclear whether ${account.name} tests on animals; it isn’t listed as cruelty-free.`, 'isn’t listed as cruelty-free'),
  ], { domain: 'crueltyfreekitty.com', url: 'https://www.crueltyfreekitty.com/brands/' }, [
    'Show the Leaping Bunny logo and licence number on the About page.',
    'Ask Cruelty-Free Kitty to add the brand to its list.',
  ]),
  fact('f4', 'Sunscreen SPF', 'SPF 50, mineral', 'correct'),
  fact('f5', 'Headquarters', 'Austin, Texas', 'correct'),
  fact('f6', 'Vitamin C concentration', '15% L-ascorbic acid', 'correct'),
  fact('f7', 'Fragrance-free range', 'All cleansers and moisturisers', 'correct'),
  fact('f8', 'Ships to', 'US and Canada', 'missing'),
]
const factFull = {
  facts: factsFull,
  // platforms[].current {statementsChecked, inaccurateClaims, accuracy}
  byEngine: [{ engine: 'aio', correct: 21, checked: 22 }, { engine: 'chatgpt', correct: 12, checked: 15 }, { engine: 'gemini', correct: 8, checked: 9 }, { engine: 'claude', correct: 0, checked: 0 }],
  // GAP: no source-domain attribution for wrong answers exists in production
  sources: [
    { domain: 'beautyprices.co', facts: 1, answers: 2, url: 'https://beautyprices.co/dermasuri-vitamin-c' },
    { domain: 'crunchbase.com', facts: 1, answers: 1, url: 'https://www.crunchbase.com/organization/dermasuri' },
    { domain: 'crueltyfreekitty.com', facts: 1, answers: 1, url: 'https://www.crueltyfreekitty.com/brands/' },
  ],
}
const factSmall = {
  facts: [factsFull[0], factsFull[3], factsFull[4], factsFull[7]].map((f) => (f.id === 'f1' ? { ...f, said: f.said.slice(0, 1) } : f)),
  byEngine: [{ engine: 'aio', correct: 6, checked: 6 }, { engine: 'chatgpt', correct: 3, checked: 4 }, { engine: 'gemini', correct: 2, checked: 2 }, { engine: 'claude', correct: 0, checked: 0 }],
  sources: factFull.sources.slice(0, 1).map((s) => ({ ...s, answers: 1 })),
}

const syncsOf = { full: SYNCS.length, small: 2 }
export const insightsLastSync = SYNCS.at(-1)
export const citationsStates = { full: { ...citeFull, syncs: syncsOf.full }, small: { ...citeSmall, syncs: syncsOf.small } }
export const sentimentStates = { full: { ...sentFull, syncs: syncsOf.full }, small: { ...sentSmall, syncs: syncsOf.small } }
export const factCheckStates = { full: { ...factFull, syncs: syncsOf.full }, small: { ...factSmall, syncs: syncsOf.small } }
