// Reports: fake but consistent data for two brands (Finance of America, Dermasuri), the saved and scheduled reports,
// and the rules that turn a question + options into a report. Plain JS (unit-tested in reports.test.js).
// Every report has the same rhythm: header (meta, verdict, headline) · scoreline (4 metrics with sparklines) · a hero
// visual for its kind · numbered sections (one takeaway + one visual each) · 3 action cards · sources.
// Every number comes from these datasets; anything they don't hold is left out and named in the footer, never estimated.
import { historyMany } from './historyMany.js'
import { brandName } from '../utils/brand.js'

export const ENGINE_NAMES = { aio: 'AI Overview', chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude' }
export const ENGINE_IDS = Object.keys(ENGINE_NAMES)

// ---- options (the composer's chips) ------------------------------------------------------------------------------
export const PERIODS = [
  { id: 'week', label: 'This week' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'quarter', label: 'Last quarter' },
  { id: 'custom', label: 'Custom' },
]
export const AUDIENCES = [
  { id: 'team', label: 'Team', hint: 'Every number, and what to do next' },
  { id: 'ceo', label: 'CEO', hint: 'A verdict, the competition, three decisions' },
  { id: 'client', label: 'Client', hint: 'Plain words, what we’re doing for them' },
]
export const LENGTHS = [
  { id: 'one', label: 'One page', hint: 'Fits one A4 page' },
  { id: 'detailed', label: 'Detailed', hint: 'Every section that has data' },
]
export const MAX_COMPARE = 3
export const DEFAULT_OPTS = { brand: null, period: null, engines: [], compare: [], audience: null, length: null, from: null, to: null, kind: null }

// ---- the brands ---------------------------------------------------------------------------------------------------
const P = (theme, prompts) => ({ theme, prompts })
const last8 = (k) => historyMany.weekly.slice(-8).map((r) => r[k])
export const DATES = ['Sep 7', 'Sep 14', 'Sep 21', 'Sep 28', 'Oct 5', 'Oct 12', 'Oct 19', 'Oct 26'] // weekly syncs (Mondays)
// period → where it starts in the 8-point series (week: Oct 19 · 30 days: Sep 28 · quarter: as far back as the view goes)
const START = { week: 6, '30d': 3, quarter: 0, custom: 3 }

const FOA = {
  id: 'foa', name: 'Finance of America', domain: 'financeofamerica.com', prompts: 113, lead: 'reverse mortgages',
  ran: ['aio', 'chatgpt', 'gemini'],
  missing: { claude: 'Claude didn’t run in the Oct 26 sync, so it isn’t counted.' },
  notConnected: ['Marketplace and community data isn’t connected for Finance of America.'],
  series: {
    score: [57, 58, 57, 59, 60, 59, 62, 64],
    named: [58, 60, 59, 62, 63, 64, 67, 71],
    cited: [15, 16, 17, 18, 18, 19, 19, 24],
  },
  share: Object.fromEntries(['foa', 'rocket', 'omaha', 'aag', 'longbridge', 'liberty', 'guild'].map((k) => [k, last8(k)])),
  rivals: [
    { key: 'rocket', domain: 'rocketmortgage.com' }, { key: 'omaha', domain: 'mutualofomahamortgage.com' }, { key: 'aag', domain: 'aag.com' },
    { key: 'longbridge', domain: 'longbridge-financial.com' }, { key: 'liberty', domain: 'libertyreverse.com' }, { key: 'guild', domain: 'guildmortgage.com' },
  ],
  // prompt flow per period: held + won = named now; lost + missing = not named now (the four add up to every prompt)
  flow: { week: { held: 65, won: 6, lost: 2, missing: 40 }, '30d': { held: 59, won: 12, lost: 3, missing: 39 }, quarter: { held: 54, won: 17, lost: 4, missing: 38 } },
  // topics that moved: d > 0 won, d < 0 lost (|d| = its prompts)
  moved: {
    week: [
      { ...P('Lender comparisons', ['best reverse mortgage lenders 2026', 'is Finance of America a good lender', 'Finance of America vs AAG reviews']), d: 3 },
      { ...P('HECM for purchase', ['how does a HECM for purchase work', 'HECM for purchase down payment']), d: 2 },
      { ...P('Home equity alternatives', ['reverse mortgage vs home equity loan for retirees']), d: 1 },
      { ...P('Calculators', ['HECM calculator']), d: -1 },
      { ...P('Eligibility', ['reverse mortgage age requirement']), d: -1 },
    ],
    '30d': [
      { ...P('Lender comparisons', ['best reverse mortgage lenders 2026', 'is Finance of America a good lender', 'Finance of America vs AAG reviews', 'top rated reverse mortgage companies', 'Finance of America complaints']), d: 5 },
      { ...P('HECM for purchase', ['how does a HECM for purchase work', 'HECM for purchase down payment', 'buy a home with a reverse mortgage', 'HECM for purchase vs cash']), d: 4 },
      { ...P('Home equity alternatives', ['reverse mortgage vs home equity loan for retirees', 'HELOC or reverse mortgage at 65', 'home equity investment vs reverse mortgage']), d: 3 },
      { ...P('Calculators', ['HECM calculator', 'reverse mortgage payout calculator']), d: -2 },
      { ...P('Eligibility', ['reverse mortgage age requirement']), d: -1 },
    ],
  },
  // CEO: our lead in points of share, per topic (negative: a competitor leads it)
  topicLead: [
    { theme: 'Lender comparisons', d: 18 }, { theme: 'HECM for purchase', d: 14 }, { theme: 'Home equity alternatives', d: 9 },
    { theme: 'Retirement income', d: 6 }, { theme: 'Eligibility', d: -3, who: 'AAG' }, { theme: 'Jumbo loans', d: -11, who: 'Longbridge' }, { theme: 'Calculators', d: -22, who: 'Longbridge' },
  ],
  engines: {
    aio: { now: 68, series: [62, 63, 63, 64, 65, 66, 67, 68], week: [3, 0], '30d': [6, 0] },
    chatgpt: { now: 61, series: [55, 56, 57, 58, 59, 60, 63, 61], week: [1, 2], '30d': [3, 3] },
    gemini: { now: 52, series: [44, 45, 46, 47, 48, 50, 50, 52], week: [2, 0], '30d': [3, 0] },
  },
  cited: [
    { path: '/reverse-mortgage', n: 17 }, { path: '/reverse-mortgage/hecm-for-purchase', n: 11 },
    { path: '/resources/reverse-mortgage-faq', n: 8 }, { path: '/reverse-mortgage/compare-lenders', n: 5, isNew: true },
  ],
  h2h: {
    longbridge: {
      onlyThem: 9, themFirst: 14, youFirst: 12, onlyYou: 45, neither: 33,
      youWin: [50, 51, 52, 53, 54, 55, 55, 57], theyWin: [20, 20, 21, 21, 22, 22, 22, 23],
      themes: [
        P('Calculators', ['reverse mortgage calculator', 'HECM calculator', 'how much can I borrow with a reverse mortgage', 'reverse mortgage payout calculator', 'HECM line of credit calculator', 'reverse mortgage amortization', 'how much equity do I need for a reverse mortgage', 'reverse mortgage estimate by age']),
        P('Jumbo loans', ['proprietary jumbo reverse mortgage', 'reverse mortgage over $1 million', 'best jumbo reverse mortgage lender', 'jumbo reverse mortgage rates', 'reverse mortgage for a high-value home', 'non-FHA reverse mortgage']),
        P('Eligibility', ['can you lose your home with a reverse mortgage', 'HECM loan limits 2027', 'reverse mortgage age requirement', 'reverse mortgage with an existing mortgage', 'reverse mortgage credit requirements']),
        P('Property types', ['reverse mortgage for a condo', 'reverse mortgage on a manufactured home', 'FHA-approved condos for a reverse mortgage', 'reverse mortgage on a second home']),
      ],
      engines: { aio: { n: 13, series: [11, 11, 12, 12, 12, 13, 13, 13] }, chatgpt: { n: 7, series: [5, 5, 5, 6, 6, 6, 6, 7] }, gemini: { n: 3, series: [3, 3, 3, 3, 3, 3, 3, 3] } },
      citedThem: [{ path: '/reverse-mortgage-calculator', n: 11 }, { path: '/platinum-jumbo-reverse-mortgage', n: 6 }, { path: '/faq', n: 5 }],
      citedYou: [{ path: '/reverse-mortgage', n: 9 }, { path: '/resources/reverse-mortgage-faq', n: 3 }],
      citedNote: 'Their calculator and jumbo pages are cited more than anything of yours on these prompts.',
    },
  },
  // content plan: missing prompts by topic, and how many of those name a competitor (and which one most)
  gaps: [
    { theme: 'Eligibility', missing: 9, owned: 6, owner: 'aag', prompts: ['reverse mortgage age requirement', 'can you lose your home with a reverse mortgage', 'reverse mortgage with an existing mortgage', 'reverse mortgage credit requirements', 'HECM loan limits 2027', 'reverse mortgage and Medicaid', 'non-borrowing spouse rules', 'reverse mortgage counseling requirement', 'reverse mortgage property tax default'] },
    { theme: 'Calculators', missing: 8, owned: 7, owner: 'longbridge', prompts: ['reverse mortgage calculator', 'HECM calculator', 'how much can I borrow with a reverse mortgage', 'reverse mortgage payout calculator', 'HECM line of credit calculator', 'reverse mortgage amortization', 'how much equity do I need for a reverse mortgage', 'reverse mortgage estimate by age'] },
    { theme: 'Taxes and estates', missing: 7, owned: 2, owner: 'omaha', prompts: ['is reverse mortgage income taxable', 'reverse mortgage and inheritance', 'what happens to a reverse mortgage when you die', 'reverse mortgage and estate planning', 'heirs repay reverse mortgage', 'reverse mortgage deduct interest', 'reverse mortgage and capital gains'] },
    { theme: 'Jumbo loans', missing: 6, owned: 5, owner: 'longbridge', prompts: ['proprietary jumbo reverse mortgage', 'reverse mortgage over $1 million', 'best jumbo reverse mortgage lender', 'jumbo reverse mortgage rates', 'reverse mortgage for a high-value home', 'non-FHA reverse mortgage'] },
    { theme: 'Retirement income', missing: 5, owned: 2, owner: 'rocket', prompts: ['reverse mortgage to delay social security', 'reverse mortgage line of credit growth', 'reverse mortgage vs annuity', 'reverse mortgage for long-term care', 'using home equity in retirement'] },
    { theme: 'Property types', missing: 4, owned: 3, owner: 'longbridge', prompts: ['reverse mortgage for a condo', 'reverse mortgage on a manufactured home', 'FHA-approved condos for a reverse mortgage', 'reverse mortgage on a second home'] },
    { theme: 'Moving and downsizing', missing: 3, owned: 1, owner: 'liberty', prompts: ['reverse mortgage to downsize', 'sell home with a reverse mortgage', 'reverse mortgage and moving to assisted living'] },
  ],
  ownedSeries: [31, 31, 30, 30, 29, 28, 27, 26],
  actions: [
    { type: 'New page', title: 'Publish a reverse mortgage calculator', theme: 'Calculators', about: ['longbridge', 'aag'] },
    { type: 'Add to FAQ', title: 'Answer age, condo and “can I lose my home” on the FAQ', theme: 'Eligibility', about: ['aag', 'omaha', 'longbridge'] },
    { type: 'Outreach', title: 'Get your jumbo loan onto the comparison sites AI cites', theme: 'Jumbo loans', about: ['longbridge', 'liberty'] },
  ],
}

const DS = {
  id: 'dermasuri', name: 'Dermasuri', domain: 'dermasuri.com', prompts: 152, lead: 'body exfoliation',
  ran: ['aio', 'chatgpt'],
  missing: { gemini: 'Gemini only runs with a full sync; none ran in this period.', claude: 'Claude only runs with a full sync; none ran in this period.' },
  notConnected: [],
  series: {
    score: [61, 62, 61, 64, 65, 64, 66, 73],
    named: [92, 94, 93, 97, 99, 101, 104, 111],
    cited: [19, 20, 21, 22, 24, 26, 27, 30],
  },
  share: { dermasuri: [63, 64, 65, 66, 68, 67, 70, 73], cerave: [23, 22, 22, 21, 20, 20, 19, 18], theordinary: [7, 7, 6, 6, 5, 6, 4, 4], paulaschoice: [6, 6, 5, 5, 4, 4, 4, 3] },
  rivals: [{ key: 'cerave', domain: 'cerave.com' }, { key: 'theordinary', domain: 'theordinary.com' }, { key: 'paulaschoice', domain: 'paulaschoice.com' }],
  flow: { week: { held: 102, won: 9, lost: 2, missing: 39 }, '30d': { held: 93, won: 18, lost: 4, missing: 37 }, quarter: { held: 88, won: 23, lost: 4, missing: 37 } },
  moved: {
    week: [
      { ...P('Keratosis pilaris', ['best exfoliating gloves for keratosis pilaris', 'KP body routine', 'how to treat KP on arms', 'KP on legs treatment']), d: 4 },
      { ...P('Exfoliation tools', ['korean italy towel vs exfoliating mitt', 'best exfoliating mitt', 'are exfoliating gloves hygienic']), d: 3 },
      { ...P('Strawberry legs', ['how to get rid of strawberry legs at home', 'strawberry legs after shaving']), d: 2 },
      { ...P('Sensitive skin', ['gentle exfoliator for sensitive skin', 'exfoliating sensitive skin on the body']), d: -2 },
    ],
    '30d': [
      { ...P('Keratosis pilaris', ['best exfoliating gloves for keratosis pilaris', 'KP body routine', 'how to treat KP on arms', 'KP on legs treatment', 'does exfoliating help KP', 'KP in summer', 'KP scrub or acid']), d: 7 },
      { ...P('Exfoliation tools', ['korean italy towel vs exfoliating mitt', 'best exfoliating mitt', 'are exfoliating gloves hygienic', 'how often to replace an exfoliating mitt', 'back scrubber for shower', 'silicone vs cloth body scrubber']), d: 6 },
      { ...P('Strawberry legs', ['how to get rid of strawberry legs at home', 'strawberry legs after shaving', 'ingrown hairs on legs', 'dark pores on legs', 'exfoliate before shaving legs']), d: 5 },
      { ...P('Sensitive skin', ['gentle exfoliator for sensitive skin', 'exfoliating sensitive skin on the body', 'exfoliating with eczema']), d: -3 },
      { ...P('Body wash', ['best body wash for keratosis pilaris']), d: -1 },
    ],
  },
  topicLead: [
    { theme: 'Keratosis pilaris', d: 34 }, { theme: 'Exfoliation tools', d: 28 }, { theme: 'Strawberry legs', d: 19 }, { theme: 'Ingrown hairs', d: 8 },
    { theme: 'Body wash', d: -6, who: 'CeraVe' }, { theme: 'Sensitive skin', d: -15, who: 'Paula’s Choice' },
  ],
  engines: {
    aio: { now: 73, series: [64, 65, 66, 67, 68, 69, 70, 73], week: [6, 0], '30d': [11, 1] },
    chatgpt: { now: 58, series: [50, 51, 52, 53, 54, 55, 60, 58], week: [3, 2], '30d': [7, 3] },
  },
  cited: [
    { path: '/products/dermasuri-deep-exfoliating-mitt', n: 21 }, { path: '/pages/how-to-use', n: 13 },
    { path: '/blogs/skin/keratosis-pilaris-routine', n: 9 }, { path: '/products/exfoliating-back-scrubber', n: 6, isNew: true },
  ],
  h2h: {
    cerave: {
      onlyThem: 6, themFirst: 12, youFirst: 41, onlyYou: 58, neither: 35,
      youWin: [86, 88, 90, 92, 94, 95, 96, 99], theyWin: [15, 15, 16, 16, 17, 17, 18, 18],
      themes: [
        P('Sensitive skin', ['gentle exfoliator for sensitive skin', 'exfoliating sensitive skin on the body', 'exfoliating with eczema', 'body care for sensitive skin', 'fragrance-free body scrub', 'exfoliating rosacea on the body', 'gentle KP treatment']),
        P('Body wash', ['best body wash for keratosis pilaris', 'what to use after exfoliating', 'body wash for rough skin', 'salicylic acid body wash', 'body wash for bumpy skin', 'dermatologist body wash']),
        P('Moisturising', ['best lotion after exfoliating', 'moisturiser for KP', 'urea cream for rough skin', 'SA cream vs urea cream', 'body lotion for dry bumpy skin']),
      ],
      engines: { aio: { n: 11, series: [9, 9, 10, 10, 10, 11, 11, 11] }, chatgpt: { n: 7, series: [6, 6, 6, 6, 7, 6, 7, 7] } },
      citedThem: [{ path: '/skincare/body/sa-smoothing-cream', n: 9 }, { path: '/skincare/body/sa-body-wash', n: 7 }, { path: '/skin-concerns/keratosis-pilaris', n: 4 }],
      citedYou: [{ path: '/pages/how-to-use', n: 5 }, { path: '/blogs/skin/keratosis-pilaris-routine', n: 3 }],
      citedNote: 'Their product pages are cited for the step after exfoliating; yours stop at the mitt.',
    },
  },
  gaps: [
    { theme: 'Sensitive skin', missing: 9, owned: 7, owner: 'paulaschoice', prompts: ['gentle exfoliator for sensitive skin', 'exfoliating sensitive skin on the body', 'exfoliating with eczema', 'body care for sensitive skin', 'fragrance-free body scrub', 'exfoliating rosacea on the body', 'gentle KP treatment', 'mild body exfoliant', 'exfoliating after a sunburn'] },
    { theme: 'Body wash', missing: 8, owned: 6, owner: 'cerave', prompts: ['best body wash for keratosis pilaris', 'body wash for rough skin', 'salicylic acid body wash', 'body wash for bumpy skin', 'dermatologist body wash', 'body wash with lactic acid', 'body wash for back acne', 'exfoliating body wash vs mitt'] },
    { theme: 'Moisturising', missing: 7, owned: 5, owner: 'cerave', prompts: ['best lotion after exfoliating', 'moisturiser for KP', 'urea cream for rough skin', 'SA cream vs urea cream', 'body lotion for dry bumpy skin', 'body oil after exfoliating', 'moisturise right after scrubbing'] },
    { theme: 'Back acne', missing: 6, owned: 3, owner: 'cerave', prompts: ['how to get rid of back acne', 'back scrubber for acne', 'exfoliating back acne', 'body acne routine', 'back acne scars', 'acne on chest and back'] },
    { theme: 'Ingrown hairs', missing: 6, owned: 2, owner: 'theordinary', prompts: ['how to prevent ingrown hairs', 'exfoliate ingrown hairs', 'ingrown hairs after waxing', 'ingrown hair bumps on legs', 'ingrown hair serum', 'bikini line ingrown hairs'] },
    { theme: 'Self-tan prep', missing: 5, owned: 1, owner: 'theordinary', prompts: ['exfoliate before self tan', 'remove old self tan', 'best mitt for self tan removal', 'how long before tanning to exfoliate', 'self tan patchy fix'] },
  ],
  ownedSeries: [30, 29, 29, 28, 27, 26, 25, 24],
  actions: [
    { type: 'New page', title: 'Write a sensitive-skin guide for the mitt', theme: 'Sensitive skin', about: ['paulaschoice', 'cerave'] },
    { type: 'Add to FAQ', title: 'Answer “what to use after exfoliating” on the how-to page', theme: 'Moisturising', about: ['cerave'] },
    { type: 'Outreach', title: 'Get the mitt into dermatologists’ body-wash routines', theme: 'Body wash', about: ['cerave'] },
  ],
}

// brands without enough data: total syncs (a report compares at least 2)
const THIN = {
  'dermasuri-men': { name: 'Dermasuri Men', domain: 'dermasurimen.com', syncs: 0 },
  brightside: { name: 'Brightside Botanics', domain: 'brightsidebotanics.com', syncs: 0 },
  'northwind-derm': { name: 'Northwind Derm', domain: 'northwindderm.com', syncs: 1, nextSync: 'Nov 2' },
}
const DATA = { foa: FOA, dermasuri: DS, lumen: { ...DS, id: 'lumen', name: 'Lumen Skin', domain: 'lumenskin.com' } }
export const REPORT_BRANDS = [
  { id: 'foa', name: FOA.name, domain: FOA.domain },
  { id: 'dermasuri', name: DS.name, domain: DS.domain },
  { id: 'lumen', name: 'Lumen Skin', domain: 'lumenskin.com' },
  ...Object.entries(THIN).map(([id, b]) => ({ id, name: b.name, domain: b.domain })),
]
export const dataFor = (brandId) => DATA[brandId] ?? null
export const brandLabel = (id) => REPORT_BRANDS.find((b) => b.id === id)?.name ?? id
export const rivalsOf = (brandId) => (dataFor(brandId)?.rivals ?? []).map((r) => ({ key: r.key, domain: r.domain, name: brandName(r.domain) }))
const rivalName = (d, key) => brandName(d.rivals.find((r) => r.key === key)?.domain ?? key)
const youKey = (d) => Object.keys(d.share)[0]

// ---- periods ------------------------------------------------------------------------------------------------------
export const periodLabel = (id) => PERIODS.find((p) => p.id === id)?.label ?? 'Last 30 days'
const startIdx = (period) => START[period] ?? START['30d']
// "Oct 19–26", or "Sep 28 – Oct 26" across months
export function shortRange(a, b) {
  const [ma, da] = a.split(' ')
  const [mb, db] = b.split(' ')
  return ma === mb ? `${ma} ${da}–${db}` : `${a} – ${b}`
}
// a hero's section title
export const HERO_TITLES = { flow: 'What moved', slope: 'Share of voice', quadrant: 'Head to head', bubbles: 'Where to write' }
export const periodRange = (period) => `${DATES[startIdx(period)]} – Oct 26, 2026`
const FROM = { week: 'last week', '30d': 'a month ago', quarter: 'Sep 7', custom: 'the start' }

// "This week at a glance" (the home page): the brand's last 8 syncs
export function glance(brandId) {
  const d = dataFor(brandId)
  if (!d) return null
  const sov = d.share[youKey(d)]
  return {
    dates: DATES,
    items: [
      { id: 'score', label: 'Visibility score', value: d.series.score.at(-1), delta: d.series.score.at(-1) - d.series.score.at(-2), series: d.series.score },
      { id: 'named', label: 'Prompts named', value: d.series.named.at(-1), of: d.prompts, delta: d.series.named.at(-1) - d.series.named.at(-2), series: d.series.named },
      { id: 'sov', label: 'Share of voice', value: sov.at(-1), unit: '%', delta: sov.at(-1) - sov.at(-2), series: sov },
    ],
  }
}

// ---- reading the question: options the chips don't set yet ----------------------------------------------------
export function inferOpts(prompt, d) {
  const q = String(prompt ?? '').toLowerCase()
  const out = {}
  if (/this week|weekly|past week/.test(q)) out.period = 'week'
  else if (/last month|30 days|since last month|this month/.test(q)) out.period = '30d'
  else if (/quarter/.test(q)) out.period = 'quarter'
  if (/\bceo\b|board|exec|are we winning/.test(q)) out.audience = 'ceo'
  else if (/client/.test(q)) out.audience = 'client'
  if (/one.?page|short|quick/.test(q)) out.length = 'one'
  else if (/detailed|deep dive|everything/.test(q)) out.length = 'detailed'
  const eng = ENGINE_IDS.filter((e) => q.includes(ENGINE_NAMES[e].toLowerCase()) || (e === 'aio' && /google/.test(q)))
  if (eng.length) out.engines = eng
  if (d) {
    const named = d.rivals.filter((r) => q.includes(r.key) || q.includes(brandName(r.domain).toLowerCase().split(' ')[0]))
    if (named.length) out.compare = named.slice(0, MAX_COMPARE).map((r) => r.key)
  }
  if (/content|write|publish|opportunit/.test(q)) out.kind = 'content'
  else if (/beating|ahead of|versus|\bvs\b|head.to.head/.test(q)) out.kind = 'rival'
  return out
}
const isSet = (v) => v != null && (!Array.isArray(v) || v.length > 0)
export function resolveOpts(opts, prompt) {
  const d = dataFor(opts.brand)
  const inf = inferOpts(prompt, d)
  const pick = (k, def) => (isSet(opts[k]) ? opts[k] : inf[k] ?? def)
  const o = { brand: opts.brand, period: pick('period', '30d'), engines: pick('engines', []), compare: pick('compare', []), audience: pick('audience', 'team'), length: pick('length', 'one'), from: opts.from ?? null, to: opts.to ?? null }
  // the kind: a template's, else what the question asks, else the audience
  o.kind = pick('kind', null) ?? (inf.kind === 'rival' && o.compare.length === 1 ? 'rival' : o.audience === 'ceo' ? 'ceo' : 'weekly')
  if (o.kind === 'rival' && o.compare.length !== 1 && d) o.compare = [d.rivals.find((r) => d.h2h[r.key])?.key].filter(Boolean)
  return o
}

// ---- the report ---------------------------------------------------------------------------------------------------
export const KINDS = {
  weekly: { name: 'Weekly summary', what: 'What moved since last week, where, and what to do' },
  ceo: { name: 'CEO summary', what: 'Are we winning? Share of voice against the top competitors' },
  rival: { name: 'Competitor head-to-head', what: 'Where one competitor beats you, prompt by prompt' },
  content: { name: 'Content plan', what: 'The topics to write for next, by what they’d win' },
}
export const BLOCK_NAMES = { header: 'Header', scoreline: 'Scoreline', hero: 'The picture', section: 'Section', actions: 'What to do', sources: 'Sources' }

export function titleFor(prompt, o) {
  const q = String(prompt ?? '').trim()
  if (q) return q.length > 72 ? `${q.slice(0, 70).trimEnd()}…` : q.charAt(0).toUpperCase() + q.slice(1)
  if (o.audience === 'client') return 'Client update'
  return KINDS[o.kind]?.name ?? 'Visibility summary'
}
const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const first = (s) => s.split(' ')[0]
const metric = (id, label, series, i0, extra = {}) => ({ id, label, value: series.at(-1), delta: series.at(-1) - series[i0], series, ...extra })

// → { ok: false, reason, … } when it can't be written; else { ok: true, kind, verdict, headline, title, opts, blocks }
export function buildReport(rawOpts, prompt = '') {
  const o = resolveOpts({ ...DEFAULT_OPTS, ...rawOpts }, prompt)
  const d = dataFor(o.brand)
  if (!d) {
    const thin = THIN[o.brand]
    return { ok: false, reason: 'thin', brand: thin?.name ?? brandLabel(o.brand), syncs: thin?.syncs ?? 0, nextSync: thin?.nextSync ?? null, opts: o }
  }
  const i0 = startIdx(o.period)
  const asked = o.engines.length ? o.engines : ENGINE_IDS
  const engines = asked.filter((e) => d.ran.includes(e))
  const noData = asked.filter((e) => !d.ran.includes(e))
  const client = o.audience === 'client'
  const me = d.share[youKey(d)]
  const focus = o.compare.length ? d.rivals.filter((r) => o.compare.includes(r.key)) : d.rivals
  const ranked = focus.map((r) => ({ key: r.key, name: brandName(r.domain), domain: r.domain, from: d.share[r.key][i0], now: d.share[r.key].at(-1) })).sort((a, b) => b.now - a.now)
  const left = [...noData.map((e) => d.missing[e] ?? `${ENGINE_NAMES[e]} has no data in this period.`), ...d.notConnected]
  if (o.period === 'quarter') left.push('This view holds 8 weekly syncs, so the quarter starts at Sep 7.')
  const moved = d.moved[o.period] ?? d.moved['30d']
  const flow = d.flow[o.period] ?? d.flow['30d']
  // engine panels: every engine asked for; one that didn't run shows as such (no number)
  const engineRows = (pick) => asked.map((e) => (d.ran.includes(e) && d.engines[e] ? { id: e, name: ENGINE_NAMES[e], ...pick(e) } : { id: e, name: ENGINE_NAMES[e], off: true }))
  const card = (a) => { const g = d.gaps.find((x) => x.theme === a.theme); return { ...a, n: g?.missing ?? 0, prompts: g?.prompts ?? [] } }
  const S = []
  let verdict, headline, scoreline, hero

  if (o.kind === 'rival') {
    const r = focus[0]
    const rn = brandName(r.domain)
    const h = d.h2h[r.key]
    if (!h) return { ok: false, reason: 'nobreakdown', brand: d.name, rival: rn, opts: o }
    const theirs = h.onlyThem + h.themFirst
    const ours = h.onlyYou + h.youFirst
    verdict = ours > theirs * 4 ? 'Winning' : ours > theirs ? 'Mixed' : 'Losing'
    headline = `${rn} beats ${d.name} on ${theirs} prompts, nearly all about ${list(h.themes.slice(0, 2).map((t) => t.theme.toLowerCase()))}.`
    scoreline = [
      metric('youWin', 'Prompts you win', h.youWin, i0),
      metric('theyWin', `Prompts ${first(rn)} wins`, h.theyWin, i0, { against: true }),
      metric('you', 'Your share of voice', me, i0, { unit: '%' }),
      metric('them', `${first(rn)}’s share of voice`, d.share[r.key], i0, { unit: '%', against: true }),
    ]
    hero = { kind: 'quadrant', you: d.name, rival: rn, total: d.prompts, ...h }
    S.push({ id: 'where', title: `Where ${first(rn)} wins`, takeaway: `${h.themes[0].theme} alone is ${h.themes[0].prompts.length} of the ${theirs}.`, visual: { kind: 'topicBars', against: true, rows: h.themes.map((t) => ({ theme: t.theme, n: t.prompts.length, prompts: t.prompts })) } })
    const eng = engineRows((e) => ({ value: h.engines[e]?.n ?? 0, series: h.engines[e]?.series ?? [], against: true }))
    const top = eng.filter((x) => !x.off).sort((a, b) => b.value - a.value)[0]
    S.push({ id: 'engines', title: 'By engine', takeaway: `${top.name} gives ${first(rn)} the most wins.`, visual: { kind: 'engines', when: o.period === 'week' ? 'this week' : 'in this period', unit: '', label: 'prompts they win', rows: eng } })
    S.push({ id: 'cited', title: 'What AI cites for each of you', takeaway: h.citedNote, visual: { kind: 'citedPair', sides: [{ name: rn, domain: r.domain, rows: h.citedThem, against: true }, { name: d.name, domain: d.domain, rows: h.citedYou }] } })
  } else if (o.kind === 'ceo') {
    const top = ranked[0]
    const ahead = me.at(-1) > top.now
    const gaining = me.at(-1) > me[i0]
    verdict = ahead && gaining ? 'Winning' : ahead || gaining ? 'Mixed' : 'Losing'
    headline = verdict === 'Losing'
      ? `${top.name} is the brand AI names most for ${d.lead}, and the gap isn’t closing.`
      : `${d.name} is the brand AI names most for ${d.lead}${gaining ? ', and the lead is growing' : ''}.`
    const topKeys = ranked.map((x) => x.key)
    const lead = me.map((v, i) => v - Math.max(...topKeys.map((k) => d.share[k][i])))
    scoreline = [
      metric('sov', 'Share of voice', me, i0, { unit: '%' }),
      metric('lead', 'Lead over the next brand', lead, i0, { unit: ' pts' }),
      metric('named', 'Prompts named', d.series.named, i0, { of: d.prompts }),
      metric('score', 'Visibility score', d.series.score, i0),
    ]
    hero = { kind: 'slope', from: DATES[i0], to: 'Oct 26', rows: [{ key: youKey(d), name: d.name, you: true, from: me[i0], now: me.at(-1) }, ...ranked.slice(0, 3)] }
    const behind = d.topicLead.filter((t) => t.d < 0)
    S.push({ id: 'lead', title: 'Where we lead, and where we trail', takeaway: `We lead ${d.topicLead.length - behind.length} of ${d.topicLead.length} topics; ${list(behind.slice(-2).map((t) => t.theme.toLowerCase()))} belong to ${list([...new Set(behind.slice(-2).map((t) => t.who))])}.`, visual: { kind: 'diverging', unit: ' pts', rows: d.topicLead.map((t) => ({ theme: t.theme, d: t.d, note: t.who })) } })
    S.push({ id: 'rivals', title: 'The competition', takeaway: `${top.name} is the closest, ${me.at(-1) - top.now} points behind.`, visual: { kind: 'shareBars', rows: [{ key: youKey(d), name: d.name, domain: d.domain, you: true, now: me.at(-1), from: me[i0] }, ...ranked] } })
    const bestEng = Object.entries(d.engines).filter(([e]) => engines.includes(e)).sort((a, b) => b[1].now - a[1].now)[0]
    S.push({ id: 'engines', title: 'By engine', takeaway: `${ENGINE_NAMES[bestEng[0]]} names us on the most prompts.`, visual: { kind: 'engines', when: o.period === 'week' ? 'this week' : 'in this period', unit: '%', label: 'prompts named', rows: engineRows((e) => ({ value: d.engines[e].now, series: d.engines[e].series })) } })
  } else if (o.kind === 'content') {
    const missing = d.prompts - d.series.named.at(-1)
    const owned = d.gaps.reduce((a, g) => a + g.owned, 0)
    verdict = 'Opportunity'
    const top = [...d.gaps].sort((a, b) => b.owned / b.missing - a.owned / a.missing)[0]
    headline = `Write for ${top.theme.toLowerCase()} first: ${rivalName(d, top.owner)} is named on ${top.owned} of the ${top.missing} prompts you’re missing there.`
    scoreline = [
      metric('missing', 'Prompts missing', d.series.named.map((v) => d.prompts - v), i0, { lowerIsBetter: true }),
      metric('owned', 'A competitor named instead', d.ownedSeries, i0, { lowerIsBetter: true }),
      metric('cited', 'Pages cited', d.series.cited, i0),
      metric('score', 'Visibility score', d.series.score, i0),
    ]
    hero = { kind: 'bubbles', rows: d.gaps.map((g) => ({ theme: g.theme, missing: g.missing, own: Math.round((g.owned / g.missing) * 100), owner: rivalName(d, g.owner) })) }
    S.push({ id: 'topics', title: 'Topics to write for', takeaway: `${d.gaps.length} topics hold the ${missing} prompts you’re missing; red is where a competitor is named instead.`, visual: { kind: 'topicBars', rows: d.gaps.map((g) => ({ theme: g.theme, n: g.missing, part: g.owned, prompts: g.prompts, note: rivalName(d, g.owner) })) } })
    const owners = Object.entries(d.gaps.reduce((m, g) => ({ ...m, [g.owner]: (m[g.owner] ?? 0) + g.owned }), {})).sort((a, b) => b[1] - a[1])
    S.push({ id: 'owners', title: 'Who’s named instead', takeaway: `${rivalName(d, owners[0][0])} is named on ${owners[0][1]} of the ${owned}.`, visual: { kind: 'bars', against: true, rows: owners.map(([k, n]) => ({ name: rivalName(d, k), domain: d.rivals.find((r) => r.key === k)?.domain, n })) } })
    S.push({ id: 'cited', title: 'Pages already working', takeaway: 'Build on these: AI already cites them.', visual: { kind: 'cited', domain: d.domain, rows: d.cited } })
  } else {
    const net = flow.won - flow.lost
    const span = o.period === 'week' ? 'week' : 'month'
    verdict = net > 0 && flow.lost * 2 <= flow.won ? `Good ${span}` : net >= 0 ? 'Mixed' : `Tough ${span}`
    const best = moved.find((m) => m.d > 0)
    headline = net > 0
      ? `${client ? `We got ${d.name} into` : `${d.name} is in`} ${net} more AI answers than ${FROM[o.period]}, led by ${best.theme.toLowerCase()}.`
      : `${d.name} is in fewer AI answers than ${FROM[o.period]}.`
    scoreline = [
      metric('score', 'Visibility score', d.series.score, i0),
      metric('named', 'Prompts named', d.series.named, i0, { of: d.prompts }),
      metric('sov', 'Share of voice', me, i0, { unit: '%' }),
      metric('cited', 'Pages cited', d.series.cited, i0),
    ]
    hero = { kind: 'flow', from: DATES[i0], to: 'Oct 26', ...flow, total: d.prompts }
    const lost = moved.filter((m) => m.d < 0)
    S.push({ id: 'moved', title: 'By topic', takeaway: lost.length ? `The gains led with ${best.theme.toLowerCase()}; the losses were ${list(lost.map((x) => x.theme.toLowerCase()))}.` : 'Every topic that moved went up.', visual: { kind: 'diverging', unit: '', rows: moved.map((m) => ({ theme: m.theme, d: m.d, prompts: m.prompts })) } })
    const ew = engineRows((e) => ({ value: d.engines[e].now, series: d.engines[e].series, won: (d.engines[e][o.period] ?? d.engines[e]['30d'])[0], lost: (d.engines[e][o.period] ?? d.engines[e]['30d'])[1] }))
    const lostIn = ew.filter((x) => !x.off && x.lost > 0)
    S.push({ id: 'engines', title: 'By engine', takeaway: lostIn.length === 1 ? `${lostIn[0].name} is where the losses were.` : 'Every engine that ran gained.', visual: { kind: 'engines', when: o.period === 'week' ? 'this week' : 'in this period', unit: '%', label: 'prompts named', rows: ew } })
    S.push({ id: 'rivals', title: 'Who’s around you', takeaway: `${ranked[0].name} is the closest, at ${ranked[0].now}%.`, visual: { kind: 'shareBars', rows: [{ key: youKey(d), name: d.name, domain: d.domain, you: true, now: me.at(-1), from: me[i0] }, ...ranked.slice(0, 4)] } })
    const fresh = d.cited.find((c) => c.isNew)
    S.push({ id: 'cited', title: 'Pages AI cites', takeaway: fresh ? `${fresh.path} is new on the list.` : `${d.cited[0].path} is cited most.`, visual: { kind: 'cited', domain: d.domain, rows: d.cited } })
  }

  const secs = o.length === 'one' ? S.slice(0, 2) : S
  const acts = (o.kind === 'rival' ? d.actions.filter((a) => a.about.includes(o.compare[0])) : d.actions).slice(0, 3).map(card)
  const blocks = [
    { id: 'header', type: 'header', data: { brand: d.name, domain: d.domain, period: periodRange(o.period), span: shortRange(DATES[i0], 'Oct 26'), counted: engines.map((e) => ENGINE_NAMES[e]), audience: o.audience, engines: o.engines.length ? list(o.engines.map((e) => ENGINE_NAMES[e])) : 'All engines', verdict, headline, kind: o.kind } },
    { id: 'scoreline', type: 'scoreline', data: { since: DATES[i0], items: scoreline } },
    { id: 'hero', type: 'hero', data: hero },
    ...secs.map((s) => ({ id: `s-${s.id}`, type: 'section', data: s })),
    acts.length ? { id: 'actions', type: 'actions', data: { title: client ? 'What we’re doing next' : o.kind === 'ceo' ? 'Three decisions' : 'What to do', items: acts } } : null,
    { id: 'sources', type: 'sources', data: { span: shortRange(DATES[i0], 'Oct 26'), off: noData.map((e) => ENGINE_NAMES[e]), period: o.period, syncs: DATES.length - i0, from: DATES[i0], to: 'Oct 26', engines: engines.map((e) => ENGINE_NAMES[e]), left } },
  ].filter(Boolean)
  return { ok: true, kind: o.kind, verdict, headline, title: titleFor(prompt, o), opts: o, blocks }
}

// ---- refining: one short instruction → new options (a new version), or null when it isn't understood -----------
export function refine(opts, instruction) {
  const d = dataFor(opts.brand)
  const q = String(instruction ?? '').toLowerCase()
  const next = { ...opts }
  const did = []
  if (/short|one.?page|brief|tighter/.test(q)) { next.length = 'one'; did.push('Made it shorter') }
  else if (/longer|detail|more depth/.test(q)) { next.length = 'detailed'; did.push('Made it detailed') }
  if (/client/.test(q)) { next.audience = 'client'; did.push('Rewrote it for a client') }
  else if (/\bceo\b|exec|board/.test(q)) { next.audience = 'ceo'; next.kind = 'ceo'; did.push('Rewrote it for the CEO') }
  else if (/\bteam\b/.test(q)) { next.audience = 'team'; did.push('Rewrote it for the team') }
  const add = ENGINE_IDS.filter((e) => q.includes(ENGINE_NAMES[e].toLowerCase()))
  if (add.length && /add|include|with/.test(q)) {
    if (opts.engines.length) next.engines = [...new Set([...opts.engines, ...add])] // "all engines" already includes it
    did.push(`Added ${list(add.map((e) => ENGINE_NAMES[e]))}`)
  }
  const named = d ? d.rivals.filter((r) => q.includes(r.key) || q.includes(brandName(r.domain).toLowerCase().split(' ')[0])) : []
  if (named.length && /focus|only|about|compare/.test(q)) {
    next.compare = named.slice(0, MAX_COMPARE).map((r) => r.key)
    if (named.length === 1 && d.h2h[named[0].key]) next.kind = 'rival'
    did.push(`Focused on ${list(named.map((r) => brandName(r.domain)))}`)
  }
  if (/this week|weekly/.test(q)) { next.period = 'week'; did.push('Changed the period to this week') }
  else if (/quarter/.test(q)) { next.period = 'quarter'; did.push('Changed the period to the last quarter') }
  return did.length ? { opts: next, change: did.join(' · ') } : null
}

// ---- templates (the home page): each fills the composer and sets its chips ---------------------------------------
export function templatesFor(brandId) {
  const d = dataFor(brandId)
  const rival = d?.rivals.find((r) => d.h2h[r.key])
  const rn = rival ? first(brandName(rival.domain)) : 'a competitor'
  return [
    { id: 'weekly', kind: 'weekly', name: KINDS.weekly.name, what: KINDS.weekly.what, prompt: 'How did we do this week?', sets: { kind: 'weekly', period: 'week', audience: 'team', length: 'one' } },
    { id: 'ceo', kind: 'ceo', name: KINDS.ceo.name, what: KINDS.ceo.what, prompt: 'CEO summary: are we winning in AI search?', sets: { kind: 'ceo', period: '30d', audience: 'ceo', length: 'one' } },
    { id: 'rival', kind: 'rival', name: KINDS.rival.name, what: KINDS.rival.what, prompt: `Where is ${rn} beating us?`, sets: { kind: 'rival', compare: rival ? [rival.key] : [], period: '30d', audience: 'team', length: 'detailed' } },
    { id: 'content', kind: 'content', name: KINDS.content.name, what: KINDS.content.what, prompt: 'Which prompts should we write content for next?', sets: { kind: 'content', period: '30d', audience: 'team', length: 'detailed' } },
  ]
}

// ---- New report suggestions (shown under the empty box on focus): the text, and the dropdowns it sets ----------
export function suggestionsFor(brandId) {
  const d = dataFor(brandId)
  const rival = d?.rivals.find((r) => d.h2h[r.key])
  const rn = rival ? first(brandName(rival.domain)) : null
  return [
    { id: 'weekly', kind: 'weekly', text: 'Weekly summary: what moved this week', sets: { kind: 'weekly', period: 'week', audience: 'team', length: 'one' } },
    { id: 'ceo', kind: 'ceo', text: 'CEO summary: are we winning in AI search?', sets: { kind: 'ceo', period: '30d', audience: 'ceo', length: 'one' } },
    rival && { id: 'rival', kind: 'rival', text: `Where is ${rn} beating us?`, sets: { kind: 'rival', compare: [rival.key], period: '30d', audience: 'team', length: 'detailed' } },
    { id: 'content', kind: 'content', text: 'What should we write next?', sets: { kind: 'content', period: '30d', audience: 'team', length: 'detailed' } },
  ].filter(Boolean)
}

// ---- saved and scheduled reports ---------------------------------------------------------------------------------
export const savedReports = [
  { id: 'r-foa-week', brand: 'foa', prompt: '', title: 'Weekly summary', opts: { brand: 'foa', kind: 'weekly', period: 'week', audience: 'team', length: 'detailed' }, created: 'Oct 26', scheduled: true, saved: true },
  { id: 'r-foa-ceo', brand: 'foa', prompt: 'CEO summary: are we winning in AI search?', opts: { brand: 'foa', kind: 'ceo', period: '30d', audience: 'ceo', length: 'detailed' }, created: 'Oct 22', scheduled: true, saved: true },
  { id: 'r-foa-longbridge', brand: 'foa', prompt: 'Where is Longbridge beating us?', opts: { brand: 'foa', kind: 'rival', period: '30d', audience: 'team', length: 'detailed', compare: ['longbridge'] }, created: 'Oct 20', saved: false },
  { id: 'r-foa-content', brand: 'foa', prompt: 'Which prompts should we write content for next?', opts: { brand: 'foa', kind: 'content', period: '30d', audience: 'team', length: 'detailed' }, created: 'Oct 9', saved: false },
  { id: 'r-ds-week', brand: 'dermasuri', prompt: '', title: 'Weekly summary', opts: { brand: 'dermasuri', kind: 'weekly', period: 'week', audience: 'team', length: 'detailed' }, created: 'Oct 26', scheduled: true, saved: true },
  { id: 'r-ds-client', brand: 'dermasuri', prompt: 'Client update: October', opts: { brand: 'dermasuri', kind: 'weekly', period: '30d', audience: 'client', length: 'detailed' }, created: 'Oct 15', scheduled: true, saved: false },
  { id: 'r-ds-cerave', brand: 'dermasuri', prompt: 'Where is CeraVe beating us?', opts: { brand: 'dermasuri', kind: 'rival', period: '30d', audience: 'team', length: 'detailed', compare: ['cerave'] }, created: 'Oct 12', saved: false },
].map((r) => ({ ...r, opts: { ...DEFAULT_OPTS, compare: [], engines: [], ...r.opts }, title: r.title || titleFor(r.prompt, r.opts) }))
export const reportById = (id) => savedReports.find((r) => r.id === id) ?? null

export const schedules = [
  { id: 's-foa-week', reportId: 'r-foa-week', title: 'Weekly summary', brand: 'foa', cadence: 'Mondays 9am', recipients: ['Dana Wells', 'Priya Shah'], next: 'Nov 2', when: 'next Monday 9am' },
  { id: 's-foa-ceo', reportId: 'r-foa-ceo', title: 'CEO summary', brand: 'foa', cadence: '1st of the month 8am', recipients: ['Graham Fox'], next: 'Nov 1', when: 'Sunday, Nov 1, 8am' },
  { id: 's-ds-week', reportId: 'r-ds-week', title: 'Weekly summary', brand: 'dermasuri', cadence: 'Mondays 9am', recipients: ['Mia Chen'], next: 'Nov 2', when: 'next Monday 9am' },
  { id: 's-ds-client', reportId: 'r-ds-client', title: 'Client update', brand: 'dermasuri', cadence: 'Every other Friday 10am', recipients: ['Mia Chen', 'Leo Park', 'Ana Ruiz'], next: 'Nov 6', when: 'Friday, Nov 6, 10am' },
]

// generating: the steps the page ticks off (counts from the data)
export function stepsFor(o) {
  const d = dataFor(o.brand)
  const n = d ? 1 + (o.compare?.length ? o.compare.length : d.rivals.length) : 0
  return [`Reading ${d?.prompts ?? 0} prompts`, `Comparing ${n} brands`, 'Writing the summary']
}

// ---- the library (All reports) ----------------------------------------------------------------------------------
export const TODAY = new Date(2026, 9, 28) // the mock's "today": Wednesday, two days after the Oct 26 sync
export const VERDICT_TONE = { 'Good week': 'up', 'Good month': 'up', Winning: 'up', Mixed: 'mid', Opportunity: 'mid', 'Tough week': 'down', 'Tough month': 'down', Losing: 'down' }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const parseDay = (s) => { const [m, d] = s.split(' '); return new Date(2026, MONTHS.indexOf(m), Number(d)) }
const monday = (dt) => { const x = new Date(dt); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x }
// home: "This week", "Last week", then "Earlier in October", "September"…
export function weekGroup(created, today = TODAY) {
  const d = parseDay(created)
  const weeks = Math.round((monday(today) - monday(d)) / (7 * 864e5))
  if (weeks <= 0) return 'This week'
  if (weeks === 1) return 'Last week'
  return d.getMonth() === today.getMonth() ? `Earlier in ${MONTH_NAMES[d.getMonth()]}` : MONTH_NAMES[d.getMonth()]
}
export const monthGroup = (created) => MONTH_NAMES[parseDay(created).getMonth()]

// the weekly summary's past runs: one per sync after the first, each comparing that sync with the one before.
// Verdict: more prompts named and a higher score = good; fewer and lower = tough; anything else = mixed.
// The newest run is the saved weekly report itself (its headline names the topic that led).
export function weeklyRuns(brandId) {
  const d = dataFor(brandId)
  const saved = savedReports.find((r) => r.brand === brandId && r.opts.kind === 'weekly' && r.opts.period === 'week')
  if (!d || !saved) return []
  const sov = d.share[youKey(d)]
  const out = []
  for (let i = 1; i < DATES.length; i++) {
    const net = d.series.named[i] - d.series.named[i - 1]
    const ds = d.series.score[i] - d.series.score[i - 1]
    const verdict = net > 0 && ds > 0 ? 'Good week' : net < 0 && ds < 0 ? 'Tough week' : 'Mixed'
    const n = Math.abs(net)
    const latest = i === DATES.length - 1
    const headline = latest ? buildReport(saved.opts, saved.prompt).headline
      : net > 0 ? `${d.name} is in ${n} more AI ${n === 1 ? 'answer' : 'answers'} than the week before.`
        : net < 0 ? `${d.name} is in ${n} fewer AI ${n === 1 ? 'answer' : 'answers'} than the week before.`
          : `${d.name} is in as many AI answers as the week before.`
    out.push({
      id: latest ? saved.id : `run-${brandId}-${i}`, brand: brandId, kind: 'weekly', idx: i, date: DATES[i], created: DATES[i], verdict, headline, net,
      audience: 'team', period: 'week', title: 'Weekly summary', kindNet: net, scheduled: true, run: !latest, saved: latest ? saved.saved : false,
      stats: statsAt(d, i, i - 1, sov),
    })
  }
  return out
}
const flowNet = (d, period) => { const f = d.flow[period] ?? d.flow['30d']; return f.won - f.lost }
// the hover scoreline on a tile: score, prompts named, share of voice at sync i, change since sync i0
function statsAt(d, i, i0, sov = d.share[youKey(d)]) {
  return [
    { id: 'score', label: 'Score', value: d.series.score[i], delta: d.series.score[i] - d.series.score[i0] },
    { id: 'named', label: 'Prompts', value: d.series.named[i], delta: d.series.named[i] - d.series.named[i0] },
    { id: 'sov', label: 'Share of voice', value: sov[i], unit: '%', delta: sov[i] - sov[i0] },
  ]
}
// a scheduled run's email: its header and scoreline as of that sync (the full report is only kept for the newest run)
export function runSummary(run) {
  const d = dataFor(run.brand)
  const sov = d.share[youKey(d)]
  const i = run.idx
  const m = (id, label, series, extra = {}) => ({ id, label, value: series[i], delta: series[i] - series[i - 1], series: series.slice(0, i + 1), ...extra })
  return {
    header: { brand: d.name, domain: d.domain, period: `${DATES[i - 1]} – ${DATES[i]}, 2026`, audience: 'team', engines: 'All engines', verdict: run.verdict, headline: run.headline, kind: 'weekly' },
    scoreline: { since: DATES[i - 1], items: [m('score', 'Visibility score', d.series.score), m('named', 'Prompts named', d.series.named, { of: d.prompts }), m('sov', 'Share of voice', sov, { unit: '%' }), m('cited', 'Pages cited', d.series.cited)] },
  }
}
// every report in the library, newest first: the saved reports and the weekly summaries' earlier runs
export function libraryItems() {
  const saved = savedReports.map((r) => {
    const b = buildReport(r.opts, r.prompt)
    const d = dataFor(r.brand)
    return { id: r.id, brand: r.brand, kind: b.kind, verdict: b.verdict, headline: b.headline, title: r.title, created: r.created, audience: b.opts.audience, period: b.opts.period, scheduled: !!r.scheduled, saved: !!r.saved, run: false, kindNet: b.kind === 'weekly' ? flowNet(d, b.opts.period) : null, stats: statsAt(d, DATES.length - 1, startIdx(b.opts.period)) }
  })
  const runs = REPORT_BRANDS.flatMap((b) => weeklyRuns(b.id)).filter((x) => x.run)
  return [...saved, ...runs].sort((a, b) => parseDay(b.created) - parseDay(a.created))
}

// ---- the report thread --------------------------------------------------------------------------------------------
// the options under a question bubble: "This week · Team · One page"
export function optsLine(o) {
  const lab = (list, id) => list.find((x) => x.id === id)?.label
  return [lab(PERIODS, o.period), lab(AUDIENCES, o.audience), lab(LENGTHS, o.length)].filter(Boolean).join(' · ')
}
// the box's suggestions once a report is open: changes the report understands (refine)
export function refineSuggestions(brandId) {
  const d = dataFor(brandId)
  const rival = d?.rivals.find((r) => d.h2h[r.key]) ?? d?.rivals[0]
  return ['Make it shorter', 'Add Gemini', rival && `Focus on ${first(brandName(rival.domain))}`, 'Rewrite for a client'].filter(Boolean)
}
// a report written in this session: kept with the saved ones (it opens at /reports/<id> and shows in All reports)
let made = 0
export function addReport(prompt, opts) {
  const o = { ...DEFAULT_OPTS, compare: [], engines: [], ...opts }
  const id = `r-new-${++made}`
  savedReports.unshift({ id, brand: o.brand, prompt, opts: o, title: titleFor(prompt, resolveOpts(o, prompt)), created: 'Oct 28', saved: false })
  return id
}
// a change from the thread updates what the report keeps (its latest version)
export function updateReport(id, opts) {
  const r = savedReports.find((x) => x.id === id)
  if (r) r.opts = { ...r.opts, ...opts }
}
