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
      { ...P('Lender comparisons', ['best reverse mortgage lenders 2026', 'is Finance of America a good lender', 'Finance of America vs AAG reviews']), d: 3, engines: { aio: 2, gemini: 1 } },
      { ...P('HECM for purchase', ['how does a HECM for purchase work', 'HECM for purchase down payment']), d: 2, engines: { aio: 1, chatgpt: 1 } },
      { ...P('Home equity alternatives', ['reverse mortgage vs home equity loan for retirees']), d: 1, engines: { gemini: 1 } },
      { ...P('Calculators', ['HECM calculator']), d: -1, engines: { chatgpt: 1 } },
      { ...P('Eligibility', ['reverse mortgage age requirement']), d: -1, engines: { chatgpt: 1 } },
    ],
    '30d': [
      { ...P('Lender comparisons', ['best reverse mortgage lenders 2026', 'is Finance of America a good lender', 'Finance of America vs AAG reviews', 'top rated reverse mortgage companies', 'Finance of America complaints']), d: 5, engines: { aio: 3, chatgpt: 1, gemini: 1 } },
      { ...P('HECM for purchase', ['how does a HECM for purchase work', 'HECM for purchase down payment', 'buy a home with a reverse mortgage', 'HECM for purchase vs cash']), d: 4, engines: { aio: 2, chatgpt: 1, gemini: 1 } },
      { ...P('Home equity alternatives', ['reverse mortgage vs home equity loan for retirees', 'HELOC or reverse mortgage at 65', 'home equity investment vs reverse mortgage']), d: 3, engines: { aio: 1, chatgpt: 1, gemini: 1 } },
      { ...P('Calculators', ['HECM calculator', 'reverse mortgage payout calculator']), d: -2, engines: { chatgpt: 2 } },
      { ...P('Eligibility', ['reverse mortgage age requirement']), d: -1, engines: { chatgpt: 1 } },
    ],
  },
  // CEO: our lead in points of share, per topic (negative: a competitor leads it)
  topicLead: [
    { theme: 'Lender comparisons', d: 18 }, { theme: 'HECM for purchase', d: 14 }, { theme: 'Home equity alternatives', d: 9 },
    { theme: 'Retirement income', d: 6 }, { theme: 'Eligibility', d: -3, who: 'AAG' }, { theme: 'Jumbo loans', d: -11, who: 'Longbridge' }, { theme: 'Calculators', d: -22, who: 'Longbridge' },
  ],
  engines: {
    // now: % of prompts named · named: those prompts · week / 30d: [won, lost] in that period
    aio: { now: 68, named: 77, series: [62, 63, 63, 64, 65, 66, 67, 68], week: [3, 0], '30d': [6, 0] },
    chatgpt: { now: 61, named: 69, series: [55, 56, 57, 58, 59, 60, 63, 61], week: [1, 2], '30d': [3, 3] },
    gemini: { now: 52, named: 59, series: [44, 45, 46, 47, 48, 50, 50, 52], week: [2, 0], '30d': [3, 0] },
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
      engines: { aio: { n: 13, you: 64, neither: 36, series: [11, 11, 12, 12, 12, 13, 13, 13] }, chatgpt: { n: 7, you: 58, neither: 48, series: [5, 5, 5, 6, 6, 6, 6, 7] }, gemini: { n: 3, you: 50, neither: 60, series: [3, 3, 3, 3, 3, 3, 3, 3] } },
      citedThem: [{ path: '/reverse-mortgage-calculator', n: 11 }, { path: '/platinum-jumbo-reverse-mortgage', n: 6 }, { path: '/faq', n: 5 }],
      citedYou: [{ path: '/reverse-mortgage', n: 9 }, { path: '/resources/reverse-mortgage-faq', n: 3 }],
      citedNote: 'Their calculator and jumbo pages are cited more than anything of yours on these prompts.',
      // per topic, the prompts that name each of you (you: 71 = onlyYou + youFirst + themFirst · them: 35)
      byTopic: [
        { theme: 'Lender comparisons', you: 20, them: 2 }, { theme: 'HECM for purchase', you: 12, them: 2 }, { theme: 'Home equity alternatives', you: 11, them: 2 },
        { theme: 'Retirement income', you: 9, them: 1 }, { theme: 'Eligibility', you: 6, them: 9 }, { theme: 'Property types', you: 7, them: 5 },
        { theme: 'Jumbo loans', you: 4, them: 6 }, { theme: 'Calculators', you: 2, them: 8 },
      ],
      // per prompt they win: the engine that gave it to them (default AI Overview), and whether only they are named
      wins: {
        'how much can I borrow with a reverse mortgage': { engine: 'chatgpt' }, 'reverse mortgage payout calculator': { engine: 'chatgpt', only: true },
        'best jumbo reverse mortgage lender': { engine: 'chatgpt' }, 'jumbo reverse mortgage rates': { engine: 'chatgpt', only: true },
        'reverse mortgage age requirement': { engine: 'chatgpt' }, 'reverse mortgage credit requirements': { engine: 'chatgpt' }, 'reverse mortgage for a condo': { engine: 'chatgpt' },
        'reverse mortgage amortization': { engine: 'gemini' }, 'non-FHA reverse mortgage': { engine: 'gemini' }, 'reverse mortgage on a second home': { engine: 'gemini' },
        'reverse mortgage calculator': { only: true }, 'HECM calculator': { only: true }, 'HECM line of credit calculator': { only: true },
        'proprietary jumbo reverse mortgage': { only: true }, 'reverse mortgage over $1 million': { only: true },
        'reverse mortgage with an existing mortgage': { only: true }, 'FHA-approved condos for a reverse mortgage': { only: true },
      },
      // per topic they win: the page AI cites for them, and for you (null: none)
      why: [
        { theme: 'Calculators', them: { path: '/reverse-mortgage-calculator', n: 11 }, you: null },
        { theme: 'Jumbo loans', them: { path: '/platinum-jumbo-reverse-mortgage', n: 6 }, you: null },
        { theme: 'Eligibility', them: { path: '/faq', n: 5 }, you: { path: '/resources/reverse-mortgage-faq', n: 3 } },
        { theme: 'Property types', them: { path: '/faq', n: 5 }, you: { path: '/reverse-mortgage', n: 9 } },
      ],
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
    score: [61, 62, 61, 64, 65, 64, 66, 70],
    named: [92, 94, 93, 97, 99, 101, 104, 111],
    cited: [19, 20, 21, 22, 24, 26, 27, 30],
  },
  share: { dermasuri: [63, 64, 65, 66, 68, 67, 70, 73], cerave: [23, 22, 22, 21, 20, 20, 19, 18], theordinary: [7, 7, 6, 6, 5, 6, 4, 4], paulaschoice: [6, 6, 5, 5, 4, 4, 4, 3] },
  rivals: [{ key: 'cerave', domain: 'cerave.com' }, { key: 'theordinary', domain: 'theordinary.com' }, { key: 'paulaschoice', domain: 'paulaschoice.com' }],
  flow: { week: { held: 102, won: 9, lost: 2, missing: 39 }, '30d': { held: 93, won: 18, lost: 4, missing: 37 }, quarter: { held: 88, won: 23, lost: 4, missing: 37 } },
  moved: {
    week: [
      { ...P('Keratosis pilaris', ['best exfoliating gloves for keratosis pilaris', 'KP body routine', 'how to treat KP on arms', 'KP on legs treatment']), d: 4, engines: { aio: 3, chatgpt: 1 } },
      { ...P('Exfoliation tools', ['korean italy towel vs exfoliating mitt', 'best exfoliating mitt', 'are exfoliating gloves hygienic']), d: 3, engines: { aio: 2, chatgpt: 1 } },
      { ...P('Strawberry legs', ['how to get rid of strawberry legs at home', 'strawberry legs after shaving']), d: 2, engines: { aio: 1, chatgpt: 1 } },
      { ...P('Sensitive skin', ['gentle exfoliator for sensitive skin', 'exfoliating sensitive skin on the body']), d: -2, engines: { chatgpt: 2 } },
    ],
    '30d': [
      { ...P('Keratosis pilaris', ['best exfoliating gloves for keratosis pilaris', 'KP body routine', 'how to treat KP on arms', 'KP on legs treatment', 'does exfoliating help KP', 'KP in summer', 'KP scrub or acid']), d: 7, engines: { aio: 5, chatgpt: 2 } },
      { ...P('Exfoliation tools', ['korean italy towel vs exfoliating mitt', 'best exfoliating mitt', 'are exfoliating gloves hygienic', 'how often to replace an exfoliating mitt', 'back scrubber for shower', 'silicone vs cloth body scrubber']), d: 6, engines: { aio: 4, chatgpt: 2 } },
      { ...P('Strawberry legs', ['how to get rid of strawberry legs at home', 'strawberry legs after shaving', 'ingrown hairs on legs', 'dark pores on legs', 'exfoliate before shaving legs']), d: 5, engines: { aio: 2, chatgpt: 3 } },
      { ...P('Sensitive skin', ['gentle exfoliator for sensitive skin', 'exfoliating sensitive skin on the body', 'exfoliating with eczema']), d: -3, engines: { aio: 1, chatgpt: 2 } },
      { ...P('Body wash', ['best body wash for keratosis pilaris']), d: -1, engines: { chatgpt: 1 } },
    ],
  },
  topicLead: [
    { theme: 'Keratosis pilaris', d: 34 }, { theme: 'Exfoliation tools', d: 28 }, { theme: 'Strawberry legs', d: 19 }, { theme: 'Ingrown hairs', d: 8 },
    { theme: 'Body wash', d: -6, who: 'CeraVe' }, { theme: 'Sensitive skin', d: -15, who: 'Paula’s Choice' },
  ],
  engines: {
    aio: { now: 73, named: 111, series: [64, 65, 66, 67, 68, 69, 70, 73], week: [6, 0], '30d': [11, 1] },
    chatgpt: { now: 58, named: 88, series: [50, 51, 52, 53, 54, 55, 60, 58], week: [3, 2], '30d': [7, 3] },
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
      engines: { aio: { n: 11, you: 104, neither: 37, series: [9, 9, 10, 10, 10, 11, 11, 11] }, chatgpt: { n: 7, you: 92, neither: 53, series: [6, 6, 6, 6, 7, 6, 7, 7] } },
      citedThem: [{ path: '/skincare/body/sa-smoothing-cream', n: 9 }, { path: '/skincare/body/sa-body-wash', n: 7 }, { path: '/skin-concerns/keratosis-pilaris', n: 4 }],
      citedYou: [{ path: '/pages/how-to-use', n: 5 }, { path: '/blogs/skin/keratosis-pilaris-routine', n: 3 }],
      citedNote: 'Their product pages are cited for the step after exfoliating; yours stop at the mitt.',
      byTopic: [
        { theme: 'Keratosis pilaris', you: 28, them: 9 }, { theme: 'Exfoliation tools', you: 24, them: 6 }, { theme: 'Strawberry legs', you: 18, them: 5 },
        { theme: 'Ingrown hairs', you: 12, them: 6 }, { theme: 'Sensitive skin', you: 10, them: 12 }, { theme: 'Body wash', you: 9, them: 11 }, { theme: 'Moisturising', you: 10, them: 10 },
      ],
      wins: {
        'exfoliating with eczema': { engine: 'chatgpt' }, 'fragrance-free body scrub': { engine: 'chatgpt' }, 'what to use after exfoliating': { engine: 'chatgpt', only: true },
        'salicylic acid body wash': { engine: 'chatgpt', only: true }, 'dermatologist body wash': { engine: 'chatgpt' }, 'moisturiser for KP': { engine: 'chatgpt' },
        'SA cream vs urea cream': { engine: 'chatgpt', only: true }, 'body wash for bumpy skin': { only: true }, 'best lotion after exfoliating': { only: true }, 'urea cream for rough skin': { only: true },
      },
      why: [
        { theme: 'Sensitive skin', them: { path: '/skin-concerns/keratosis-pilaris', n: 4 }, you: { path: '/blogs/skin/keratosis-pilaris-routine', n: 3 } },
        { theme: 'Body wash', them: { path: '/skincare/body/sa-body-wash', n: 7 }, you: null },
        { theme: 'Moisturising', them: { path: '/skincare/body/sa-smoothing-cream', n: 9 }, you: { path: '/pages/how-to-use', n: 5 } },
      ],
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
// the hero's "Last 8 weeks": one column per weekly sync. A week that wasn't scanned stays null (drawn as an empty
// outline, never as 0); this week is compared with the last week that was scanned
export function scoreStrip(series, dates = DATES) {
  const weeks = dates.map((date, i) => ({ date, score: Number.isFinite(series[i]) ? series[i] : null }))
  const now = weeks.at(-1).score
  const prev = [...weeks.slice(0, -1)].reverse().find((w) => w.score != null)
  return { weeks, value: now, delta: now != null && prev ? now - prev.score : null }
}
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
  else if (/how did we do|what moved|weekly|\bupdate\b/.test(q)) out.kind = 'weekly'
  return out
}
const isSet = (v) => v != null && (!Array.isArray(v) || v.length > 0)
export function resolveOpts(opts, prompt) {
  const d = dataFor(opts.brand)
  const inf = inferOpts(prompt, d)
  const pick = (k, def) => (isSet(opts[k]) ? opts[k] : inf[k] ?? def)
  const o = { brand: opts.brand, period: pick('period', '30d'), engines: pick('engines', []), compare: pick('compare', []), audience: pick('audience', 'team'), length: pick('length', 'one'), from: opts.from ?? null, to: opts.to ?? null }
  // the kind: a template's, else what the question asks, else the audience
  // the kind: a template's, else what the question asks, else the audience; any other question is a custom report
  o.kind = pick('kind', null) ?? (inf.kind === 'rival' && o.compare.length === 1 ? 'rival' : o.audience === 'ceo' ? 'ceo' : String(prompt ?? '').trim() ? 'custom' : 'weekly')
  if (o.kind === 'rival' && o.compare.length !== 1 && d) o.compare = [d.rivals.find((r) => d.h2h[r.key])?.key].filter(Boolean)
  return o
}

// ---- the report ---------------------------------------------------------------------------------------------------
export const KINDS = {
  weekly: { name: 'Weekly summary', what: 'What moved since last week, where, and what to do' },
  ceo: { name: 'CEO summary', what: 'Are we winning? Share of voice against the top competitors' },
  rival: { name: 'Competitor gap', what: 'Where one competitor is named and you aren’t, prompt by prompt' },
  content: { name: 'Content plan', what: 'The topics to write for next, by what they’d win' },
  custom: { name: 'Custom report', what: 'Your own question, answered from your data' },
}
export const BLOCK_NAMES = { hero: 'Summary', section: 'Section', actions: 'What to do', sources: 'Sources' }

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
  const card = (a) => { const g = d.gaps.find((x) => x.theme === a.theme); return { ...a, n: g?.missing ?? 0, prompts: g?.prompts ?? [] } }
  // the report's bands: a hero (the answer), sections on the spine grid, the footer. Every number is read from the brand's data
  const S = []
  const since = o.period === 'week' ? 'last week' : DATES[i0]
  // every competitor by share now; the top ones get the brand line colours (the Visibility history's order)
  const byShare = d.rivals.map((r) => ({ key: r.key, name: brandName(r.domain), domain: r.domain, from: d.share[r.key][i0], now: d.share[r.key].at(-1) })).sort((a, b) => b.now - a.now)
  const lineOf = (key) => { const i = byShare.findIndex((r) => r.key === key); return i >= 0 && i < 3 ? `var(--line-${i + 1})` : 'var(--color-stone-400)' }
  const youRow = { key: youKey(d), name: d.name, domain: d.domain, you: true, from: me[i0], now: me.at(-1) }
  let verdict, headline, visual, strip
  const chips = []

  // merge, don't repeat: the hero answers the question (no stat row); one table per report holds the topics, their
  // prompts and the action for each (no separate what-to-do band); a one-line momentum; every number once
  const acts = actionsFor(o, d, card, client)
  const actOf = (theme) => acts.find((a) => a.theme === theme)?.title ?? null
  const promptStrip = (segs, extra = {}) => ({ kind: 'promptStrip', total: d.prompts, segs, ...extra })
  const ex = (prompts) => ({ example: prompts[0] ?? null, more: Math.max(0, prompts.length - 1) })
  const dotsOf = (n, tone) => Array.from({ length: Math.max(0, n) }, () => tone)
  const engineLine = () => {
    const on = asked.filter((e) => d.ran.includes(e) && d.engines[e])
    const off = asked.filter((e) => !on.includes(e)).map((e) => ENGINE_NAMES[e])
    const wl = (e) => d.engines[e][o.period] ?? d.engines[e]['30d']
    return `By engine: ${on.map((e) => `${ENGINE_NAMES[e]} won ${wl(e)[0]}, lost ${wl(e)[1]}`).join(' · ')}${off.length ? ` · ${list(off)} didn’t run` : ''}.`
  }

  // v2 (Competitor gap, Custom prompt): one question, one hero built for it, then sections of title · takeaway · visual ·
  // details (5 at a time). The one-page length keeps the first two sections and any section marked keep (next steps)
  if (o.kind === 'rival' || o.kind === 'custom' || o.kind === 'weekly') {
    const rKey = o.compare[0]
    const color = rKey && byShare.findIndex((x) => x.key === rKey) < 3 ? lineOf(rKey) : 'var(--line-1)'
    const actsFor = (kind, compare) => actionsFor({ ...o, kind, compare }, d, card, client)
    if (o.kind === 'rival' || o.kind === 'weekly') {
      const v3 = o.kind === 'rival' ? competitorGap(o, d, { i0, since, acts, prompt }) : weeklySummary(o, d, { i0, since, acts, prompt, client, asked })
      if (!v3.ok) return { ...v3, opts: o }
      const span = shortRange(DATES[i0], 'Oct 26')
      return { ok: true, v3: true, kind: o.kind, verdict: v3.verdict.word, headline: v3.headline, title: titleFor(prompt, o), opts: o, frame: v3.frame,
        blocks: [{ id: 'sources', type: 'sources', data: { span, off: noData.map((e) => ENGINE_NAMES[e]), period: o.period, syncs: DATES.length - i0, from: DATES[i0], to: 'Oct 26', engines: engines.map((e) => ENGINE_NAMES[e]), left } }] }
    }
    const v2 = customReport(o, d, prompt, { i0, asked, engines, since, color, acts, actsFor })
    if (!v2.ok) return { ...v2, opts: o }
    const secs = o.length === 'one' ? v2.sections.filter((x, i) => i < 2 || x.keep || x.block.kind === 'notInData') : v2.sections
    const span = shortRange(DATES[i0], 'Oct 26')
    const blocks = [
      v2.read && { id: 'read', type: 'v2read', data: v2.read },
      { id: 'hero', type: 'v2hero', data: { line: `${d.name} · ${span} · ${engines.map((e) => ENGINE_NAMES[e]).join(', ') || 'no engines'}`, verdict: v2.verdict, headline: v2.headline, visual: v2.hero ?? null, kind: o.kind } },
      ...secs.map((x) => ({ id: `s-${x.id}`, type: 'v2section', data: x })),
      { id: 'sources', type: 'sources', data: { span, off: noData.map((e) => ENGINE_NAMES[e]), period: o.period, syncs: DATES.length - i0, from: DATES[i0], to: 'Oct 26', engines: engines.map((e) => ENGINE_NAMES[e]), left } },
    ].filter(Boolean)
    return { ok: true, v2: true, kind: o.kind, verdict: v2.verdict.word, headline: v2.headline, title: titleFor(prompt, o), opts: o, blocks }
  }
  if (o.kind === 'ceo') {
    const top = ranked[0]
    const ahead = me.at(-1) > top.now
    const gaining = me.at(-1) > me[i0]
    verdict = ahead && gaining ? 'Winning' : ahead || gaining ? 'Mixed' : 'Losing'
    headline = verdict === 'Losing'
      ? `${top.name} is named most for ${d.lead}, and the gap isn’t closing.`
      : `The brand AI names most for ${d.lead}${gaining ? ', and gaining' : ''}.`
    // the lead chart: you and the closest competitor over the period, the gap between you shaded (share of voice
    // values themselves only appear in Where you stand)
    const gap = me.map((v, i) => v - d.share[top.key][i])
    const spanLabel = { week: 'last week', '30d': 'last 30 days', quarter: 'last 8 weeks' }[o.period] ?? 'this period'
    visual = { kind: 'lead', label: `Lead over ${top.name} · ${spanLabel}`, since: DATES[i0], dates: DATES.slice(i0), lead: gap.at(-1), leadDelta: gap.at(-1) - gap[i0], you: { name: d.name, series: me.slice(i0) }, them: { name: top.name, series: d.share[top.key].slice(i0) } }
    S.push({ id: 'stand', title: 'Where you stand', takeaway: `Share of voice, ${DATES[i0]} to now: ${top.name} is closest${top.now < top.from ? ', and slipping' : ''}.`, visual: { kind: 'dumbbell', rows: [youRow, ...ranked].sort((a, b) => b.now - a.now) } })
    const behind = d.topicLead.filter((t) => t.d < 0)
    const owners = [...new Set(behind.slice(-2).map((t) => t.who))]
    S.push({ id: 'topics', title: 'By topic', takeaway: `${list(owners)} ${owners.length === 1 ? 'leads' : 'lead'} ${list(behind.slice(-2).map((t) => t.theme.toLowerCase()))}; those are the decisions.`, visual: {
      kind: 'topicTable', dotsLabel: `Since ${DATES[i0]}`, actionLabel: 'Decision',
      columns: [{ key: 'lead', label: 'Your lead' }],
      rows: d.topicLead.map((t) => {
        const m = moved.find((x) => x.theme === t.theme)
        const prompts = m?.prompts ?? d.gaps.find((g) => g.theme === t.theme)?.prompts ?? []
        return {
          theme: t.theme, ...ex(prompts), prompts: prompts.map((p) => ({ text: p })),
          dots: m ? dotsOf(Math.abs(m.d), m.d > 0 ? 'you' : 'red') : [], dotsAria: m ? `${Math.abs(m.d)} ${m.d > 0 ? 'won' : 'lost'}` : 'No change',
          cells: { lead: { text: `${t.d > 0 ? '+' : '−'}${Math.abs(t.d)} pts`, neg: t.d < 0, sub: t.d < 0 ? `${t.who} leads` : null } },
          action: actOf(t.theme),
        }
      }),
      notes: [engineLine(), `Pages AI cites most: ${d.cited.slice(0, 3).map((c) => `${c.path} (${c.n})`).join(' · ')}.`],
    } })
    S.push({ id: 'momentum', title: 'Momentum', visual: { kind: 'momentum', since: DATES[i0], items: [
      { label: 'Visibility score', value: d.series.score.at(-1), d: d.series.score.at(-1) - d.series.score[i0] },
      { label: 'Prompts named', value: `${d.series.named.at(-1)} of ${d.prompts}`, d: d.series.named.at(-1) - d.series.named[i0] },
    ] } })
  } else if (o.kind === 'content') {
    const missing = d.prompts - d.series.named.at(-1)
    const owned = d.ownedSeries.at(-1)
    verdict = 'Opportunity'
    const top = [...d.gaps].sort((a, b) => b.owned / b.missing - a.owned / a.missing)[0]
    headline = `${top.theme} first: ${first(rivalName(d, top.owner))} holds ${top.owned} of its ${top.missing} prompts.`
    visual = promptStrip([
      { key: 'named', label: 'Named', n: d.prompts - missing, tone: 'you' },
      { key: 'owned', label: 'Missing, a competitor named instead', n: owned, tone: 'red' },
      { key: 'open', label: 'Missing, no one named', n: missing - owned, tone: 'none' },
    ])
    const owners = Object.entries(d.gaps.reduce((m, g) => ({ ...m, [g.owner]: (m[g.owner] ?? 0) + g.owned }), {})).sort((a, b) => b[1] - a[1])
    S.push({ id: 'topics', title: 'Topics to write for', takeaway: 'Red is a prompt where a competitor is named instead of you.', visual: {
      kind: 'topicTable', dotsLabel: 'Missing', actionLabel: 'To build',
      columns: [{ key: 'owner', label: 'Named instead' }],
      rows: [...d.gaps].sort((a, b) => b.owned / b.missing - a.owned / a.missing).map((g) => ({
        theme: g.theme, ...ex(g.prompts), prompts: g.prompts.map((p) => ({ text: p })),
        dots: [...dotsOf(g.owned, 'red'), ...dotsOf(g.missing - g.owned, 'none')], dotsAria: `${g.missing} missing, ${g.owned} with a competitor named`,
        cells: { owner: { text: rivalName(d, g.owner) } },
        action: `Build the ${g.theme.toLowerCase()} page AI is missing`,
      })),
      notes: [
        (() => { const t = owners.map(([k]) => [k, d.gaps.filter((g) => g.owner === k).length]).sort((x, y) => y[1] - x[1]); const once = t.filter((x) => x[1] === 1).length; return `Named instead most often: ${t.filter((x) => x[1] > 1).map(([k, n]) => `${rivalName(d, k)} on ${n} topics`).join(' · ') || 'no competitor on more than one topic'}${once === 1 ? `; ${rivalName(d, t.find((x) => x[1] === 1)[0])} on one` : once ? `; ${once} others on one topic each` : ''}.` })(),
        `Already cited, build on these: ${d.cited.slice(0, 3).map((c) => c.path).join(' · ')}.`,
      ],
    } })
    S.push({ id: 'momentum', title: 'Momentum', visual: { kind: 'momentum', since, items: [
      { label: 'Prompts missing', d: missing - (d.prompts - d.series.named[i0]), worseUp: true },
      { label: 'A competitor named instead', d: owned - d.ownedSeries[i0], worseUp: true },
    ] } })
  } else {
    const net = flow.won - flow.lost
    const span = o.period === 'week' ? 'week' : 'month'
    verdict = net > 0 && flow.lost * 2 <= flow.won ? `Good ${span}` : net >= 0 ? 'Mixed' : `Tough ${span}`
    const best = moved.find((m) => m.d > 0)
    // short enough for two lines at 28px: the brand is already in the meta line above it
    const ago = FROM[o.period]
    headline = net > 0
      ? (client ? `You’re in ${net} more AI answers than ${ago}, led by ${best.theme.toLowerCase()}.` : `In ${net} more AI answers than ${ago}, led by ${best.theme.toLowerCase()}.`)
      : `${client ? 'You’re in' : 'In'} fewer AI answers than ${ago}${client ? '' : `, most of all for ${moved.find((m) => m.d < 0)?.theme.toLowerCase() ?? 'every topic'}`}.`
    const spanWord = { week: 'this week', '30d': 'this month', quarter: 'since Sep 7' }[o.period] ?? 'this period'
    visual = client
      ? { kind: 'scoreLine', label: 'Visibility score', span: spanWord, dates: DATES.slice(i0), series: d.series.score.slice(i0) }
      : promptStrip([
        { key: 'won', label: 'Won', n: flow.won, tone: 'you' },
        { key: 'held', label: 'Held', n: flow.held, tone: 'youSoft' },
        { key: 'lost', label: 'Lost', n: flow.lost, tone: 'red' },
        { key: 'missing', label: 'Missed', n: flow.missing, tone: 'none' },
      ])
    // one row per topic that moved, then any topic the plan targets that didn't move
    const planOnly = acts.filter((a) => !moved.some((m) => m.theme === a.theme))
    const lost = moved.filter((m) => m.d < 0)
    S.push({ id: 'moved', title: 'What moved', client, takeaway: lost.length ? `${client ? 'Your gains' : 'Gains'} led with ${best.theme.toLowerCase()}; ${list(lost.map((x) => x.theme.toLowerCase()))} slipped.` : 'Every topic that moved went up.', visual: {
      kind: 'topicTable', dotsLabel: o.period === 'week' ? 'This week' : 'This month', actionLabel: client ? 'What we’re doing next' : 'What to do', columns: [],
      rows: [
        ...moved.map((m) => ({ theme: m.theme, ...ex(m.prompts), prompts: m.prompts.map((p) => ({ text: p })), dots: dotsOf(Math.abs(m.d), m.d > 0 ? 'you' : 'red'), dotsAria: `${Math.abs(m.d)} ${m.d > 0 ? 'won' : 'lost'}`, action: actOf(m.theme) })),
        ...planOnly.map((a) => ({ theme: a.theme, ...ex(a.prompts), prompts: a.prompts.map((p) => ({ text: p })), dots: [], dotsAria: 'No change', action: a.title })),
      ],
      notes: [engineLine()],
    } })
    const rivalsNow = byShare.slice(0, 3)
    S.push({ id: 'momentum', title: client ? 'Where you stand' : 'Momentum', client, visual: { kind: 'momentum', since, items: [
      ...(client ? [] : [{ label: 'Visibility score', value: d.series.score.at(-1), d: d.series.score.at(-1) - d.series.score[i0] }]),
      { label: client ? 'Your share of voice' : 'Share of voice', value: `${me.at(-1)}%`, d: me.at(-1) - me[i0] },
      ...rivalsNow.map((x) => ({ label: x.name, value: `${x.now}%`, d: x.now - x.from, them: true })),
    ] } })
  }

  const secs = o.length === 'one' ? S.slice(0, 2) : S
  const blocks = [
    { id: 'hero', type: 'hero', data: { strip, client, brand: d.name, domain: d.domain, period: periodRange(o.period), span: shortRange(DATES[i0], 'Oct 26'), counted: engines.map((e) => ENGINE_NAMES[e]), audience: o.audience, verdict, headline, kind: o.kind, since, chips, visual } },
    ...secs.map((s) => ({ id: `s-${s.id}`, type: 'section', data: s })),
    { id: 'sources', type: 'sources', data: { span: shortRange(DATES[i0], 'Oct 26'), off: noData.map((e) => ENGINE_NAMES[e]), period: o.period, syncs: DATES.length - i0, from: DATES[i0], to: 'Oct 26', engines: engines.map((e) => ENGINE_NAMES[e]), left } },
  ].filter(Boolean)
  return { ok: true, kind: o.kind, verdict, headline, title: titleFor(prompt, o), opts: o, blocks }
}

// what to do follows the report's question, so no two kinds of report suggest the same three things.
// weekly: the standing plan · client: the same, said as what we'll do · CEO: win back the topics a competitor leads ·
// competitor: close the gap behind each topic they win · content plan: write for the topics a competitor holds most
function actionsFor(o, d, card, client) {
  const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1)
  const seg = (path) => path.split('/').filter(Boolean).at(-1) ?? path
  const fromGap = (g, extra) => ({ theme: g.theme, n: g.missing, prompts: g.prompts, ...extra })
  if (o.kind === 'rival') {
    const r = d.rivals.find((x) => x.key === o.compare[0]) ?? d.rivals[0]
    const rv = first(brandName(r.domain))
    const h = d.h2h[r.key]
    return (h?.why ?? []).map((w) => {
      const t = h.themes.find((x) => x.theme === w.theme)
      return {
        type: w.you ? 'Update page' : 'New page', theme: w.theme, n: t.prompts.length, prompts: t.prompts,
        // the page by its last segment, so the title stays on one line
        title: w.you ? `Expand your ${seg(w.you.path)} page to match ${rv}’s` : `Write a ${w.theme.toLowerCase()} page to rival ${rv}’s ${seg(w.them.path)}`,
        meta: `${w.you ? 'Update page' : 'New page'} · closes the ${w.theme.toLowerCase()} gap`,
      }
    }).sort((a, b) => b.n - a.n)
  }
  if (o.kind === 'ceo') {
    const picks = d.topicLead.filter((t) => t.d < 0).sort((a, b) => a.d - b.d).map((t) => {
      const g = d.gaps.find((x) => x.theme === t.theme)
      return g && fromGap(g, { type: 'Win back', title: `Win back ${t.theme.toLowerCase()} from ${t.who}`, meta: `${t.who} leads it by ${-t.d} pts` })
    }).filter(Boolean)
    for (const g of [...d.gaps].sort((a, b) => b.missing - a.missing)) {
      if (picks.length >= 3) break
      if (!picks.some((p) => p.theme === g.theme)) picks.push(fromGap(g, { type: 'Invest', title: `Invest in ${g.theme.toLowerCase()} content`, meta: `Invest · ${g.theme}` }))
    }
    return picks.slice(0, 3).sort((a, b) => b.n - a.n)
  }
  if (o.kind === 'content') {
    return [...d.gaps].sort((a, b) => b.owned - a.owned).slice(0, 3).map((g) => fromGap(g, {
      type: 'New page', title: `Build the ${g.theme.toLowerCase()} page AI is missing`, meta: `New page · ${rivalName(d, g.owner)} is named on ${g.owned} of these`,
    }))
  }
  const plan = d.actions.slice(0, 3).map(card)
  return client ? plan.map((a) => ({ ...a, title: `We’ll ${lc(a.title)}` })).sort((a, b) => b.n - a.n) : plan
}

// ---- v2: Competitor gap and Custom prompt -----------------------------------------------------------------------
// Both answer with blocks from one library: verdict · stat row (at most 4) · head-to-head bar · prompt groups (every
// prompt in full, with its engines and who's named instead) · page leaderboard · trend chart · next steps (each one a
// link). Anything the data can't answer is said in a "Not in your data" block, never estimated.
const TONE_OF = { Winning: 'up', Mixed: 'mid', Losing: 'down', Opportunity: 'mid', 'Good month': 'up', 'Tough month': 'down', 'Good week': 'up', 'Tough week': 'down' }
const verdictOf = (word) => ({ word, tone: TONE_OF[word] ?? 'mid' })
const shortPath = (path) => { const segs = path.split('/').filter(Boolean); return segs.length > 1 ? `…/${segs.at(-1)}` : path }
const pageOf = (c, domain, extra = {}) => (c ? { path: c.path, text: shortPath(c.path), n: c.n, domain, isNew: !!c.isNew, ...extra } : null)
export const topicHref = (theme) => `/tracker?topic=${encodeURIComponent(theme)}`
const stepOf = (a) => ({ id: a.theme, title: a.title, meta: a.meta ?? `${a.type} · ${a.theme}`, n: a.n, theme: a.theme, action: { label: 'Open the prompts', href: topicHref(a.theme) } })
const themesOf = (d) => [...new Set([...d.gaps.map((g) => g.theme), ...Object.values(d.h2h).flatMap((h) => h.themes.map((t) => t.theme)), ...d.topicLead.map((t) => t.theme)])]
// the prompts a competitor wins, with the engine that gave each and who's named: { text, theme, engine, only }
const winsOf = (h) => h.themes.flatMap((t) => t.prompts.map((p) => ({ text: p, theme: t.theme, engine: h.wins?.[p]?.engine ?? 'aio', only: !!h.wins?.[p]?.only })))
const rowOf = (w, rv) => ({ text: w.text, engines: [w.engine], named: w.only ? [rv] : [rv, 'you'], note: w.only ? `Only ${rv}` : `${rv} first` })

export function shares(ns) {
  const total = ns.reduce((a, n) => a + n, 0)
  if (!total) return ns.map(() => 0)
  const raw = ns.map((n) => (n / total) * 100)
  const out = raw.map(Math.floor)
  let left = 100 - out.reduce((a, n) => a + n, 0)
  const order = raw.map((r, i) => [r - out[i], i]).sort((a, b) => b[0] - a[0])
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k][1]]++
  return out
}
const withShares = (segs) => { const p = shares(segs.map((x) => x.n)); return segs.map((x, i) => ({ ...x, share: p[i] })) }
const scheduledKind = (d, kind) => (schedules.some((sc) => sc.brand === d.id && savedReports.find((r) => r.id === sc.reportId)?.opts.kind === kind) ? 'week' : 'once')
function competitorGap(o, d, x) {
  const { i0, since, acts, prompt } = x
  const r = d.rivals.find((k) => k.key === o.compare[0])
  const rn = brandName(r.domain)
  const rv = first(rn)
  const h = d.h2h[r.key]
  if (!h) return { ok: false, reason: 'nobreakdown', brand: d.name, rival: rn }
  const theirs = h.onlyThem + h.themFirst
  const ours = h.onlyYou + h.youFirst
  const word = ours > theirs * 4 ? 'Winning' : ours > theirs ? 'Mixed' : 'Losing'
  const themes = [...h.themes].sort((a, b) => b.prompts.length - a.prompts.length)
  const wins = winsOf(h)
  const bare = h.why.filter((w) => !w.you).length
  const finding = `${rv} wins ${theirs} of your ${d.prompts} prompts, mostly on ${list(themes.slice(0, 2).map((t) => t.theme.toLowerCase()))}${bare ? ', where AI cites no page of yours' : ''}.`
  const pageFor = (theme) => pageOf(h.why.find((w) => w.theme === theme)?.them, r.domain)
  const engines = Object.keys(h.engines).filter((e) => d.ran.includes(e))
  const lead = h.byTopic.filter((t) => t.them > t.you).length
  return {
    ok: true, verdict: verdictOf(word), headline: finding,
    frame: {
      question: titleFor(prompt, o), finding, range: shortRange(DATES[i0], 'Oct 26'), frequency: scheduledKind(d, o.kind), you: d.name, them: rn, themShort: rv,
      chart: {
        title: 'Prompts named per topic', label: `Prompts ${rv} wins`, value: theirs, delta: h.theyWin.at(-1) - h.theyWin[i0], worseUp: true, since,
        legend: [{ key: 'you', label: d.name, tone: 'primary' }, { key: 'them', label: rv, tone: 'rival' }],
        // sorted by our lead, biggest first, so the topics they win sit together on the right
        bands: [...h.byTopic].sort((a, b) => (b.you - b.them) - (a.you - a.them)).map((t) => ({ label: t.theme, bars: [{ key: 'you', value: t.you, tone: 'primary' }, { key: 'them', value: t.them, tone: 'rival' }] })),
      },
      summary: {
        title: 'Head to head',
        bar: withShares([{ key: 'you', label: 'We win', n: ours, tone: 'primary' }, { key: 'them', label: `${rv} wins`, n: theirs, tone: 'rival' }, { key: 'neither', label: 'Neither', n: h.neither, tone: 'neutral' }]),
        byEngine: engines.map((e) => ({ id: e, name: ENGINE_NAMES[e], segs: [{ key: 'you', n: h.engines[e].you, tone: 'primary' }, { key: 'them', n: h.engines[e].n, tone: 'rival' }, { key: 'neither', n: h.engines[e].neither, tone: 'neutral' }], note: `${h.engines[e].n} lost` })),
        stats: [
          { label: 'Topics they lead', value: lead, of: h.byTopic.length },
          { label: 'Our pages cited', value: h.citedYou.length, sub: `${h.citedYou.reduce((a, c) => a + c.n, 0)} answers` },
        ],
      },
      table: {
        title: `Prompts ${rv} wins`, searchLabel: 'Search prompts', unit: 'prompts',
        columns: [{ key: 'text', label: 'Prompt', kind: 'text' }, { key: 'topic', label: 'Topic', sort: true }, { key: 'engine', label: 'Engine', kind: 'engine', sort: true }, { key: 'result', label: 'Result', kind: 'strong', sort: true }, { key: 'page', label: `${rv}’s cited page`, kind: 'page' }],
        rows: themes.flatMap((t) => t.prompts.map((p) => { const w = wins.find((z) => z.text === p); return { id: p, text: p, topic: t.theme, engine: w.engine, engineName: ENGINE_NAMES[w.engine], result: w.only ? `Only ${rv}` : `${rv} first`, strong: w.only, page: pageFor(t.theme), href: topicHref(t.theme) } })),
        filters: [{ key: 'topic', label: 'Topic', all: 'All topics', options: themes.map((t) => ({ id: t.theme, label: t.theme })) }, { key: 'engine', label: 'Engine', all: 'All engines', by: 'engineName', options: engines.map((e) => ({ id: ENGINE_NAMES[e], label: ENGINE_NAMES[e] })) }],
        pageSize: 10,
      },
      steps: acts.map(stepOf),
    },
  }
}

// the weekly summary in the frame: what moved since last week (or the period's start), the week's movement, the topics
function weeklySummary(o, d, x) {
  const { i0, since, acts, prompt, client, asked } = x
  const flow = d.flow[o.period] ?? d.flow['30d']
  const moved = d.moved[o.period] ?? d.moved['30d']
  const net = flow.won - flow.lost
  const span = o.period === 'week' ? 'week' : 'month'
  const word = net > 0 && flow.lost * 2 <= flow.won ? `Good ${span}` : net >= 0 ? 'Mixed' : `Tough ${span}`
  const best = moved.find((m) => m.d > 0)
  const lost = moved.filter((m) => m.d < 0)
  const ago = o.period === 'week' ? 'last week' : DATES[i0]
  const who = client ? 'You’re' : `${d.name} is`
  const finding = `${who} in ${Math.abs(net)} ${net >= 0 ? 'more' : 'fewer'} AI answers than ${ago}${best ? `, led by ${best.theme.toLowerCase()}` : ''}.${lost.length ? ` ${list(lost.map((m) => m.theme))} slipped.` : ''}`
  const named = d.series.named
  const me = d.share[youKey(d)]
  const vs = o.period === 'week' ? 'last week' : DATES[i0]
  const on = asked.filter((e) => d.ran.includes(e) && d.engines[e])
  const wl = (e) => d.engines[e][o.period] ?? d.engines[e]['30d']
  const off = asked.filter((e) => !on.includes(e)).map((e) => ENGINE_NAMES[e])
  const byEngine = `By engine: ${on.map((e) => `${ENGINE_NAMES[e]} won ${wl(e)[0]}, lost ${wl(e)[1]}`).join(' · ')}${off.length ? ` · ${list(off)} didn’t run` : ''}.`
  const actOf = (theme) => acts.find((a) => a.theme === theme)?.title ?? null
  const planOnly = acts.filter((a) => !moved.some((m) => m.theme === a.theme))
  const row = (theme, prompts, dlt, engines) => ({
    id: theme, text: theme, topPrompt: prompts[0] ?? null, won: dlt > 0 ? dlt : 0, lost: dlt < 0 ? -dlt : 0, net: dlt, change: dlt > 0 ? 'gained' : dlt < 0 ? 'lost' : 'none',
    engines: Object.keys(engines ?? {}), next: actOf(theme), href: topicHref(theme),
  })
  return {
    ok: true, verdict: verdictOf(word), headline: finding,
    frame: {
      question: String(prompt ?? '').trim() ? titleFor(prompt, o) : (o.period === 'week' ? 'What moved this week?' : 'What moved this month?'),
      finding, range: shortRange(DATES[i0], 'Oct 26'), frequency: scheduledKind(d, o.kind), you: d.name,
      chart: {
        title: 'Answers naming you by week', label: `Answers naming ${d.name}`, value: named.at(-1), delta: named.at(-1) - named[i0], since: vs,
        legend: [{ key: 'now', label: 'This week', tone: 'primary' }, { key: 'earlier', label: 'Earlier weeks', tone: 'tint' }],
        bands: DATES.map((date, i) => ({ label: date, bars: [{ key: 'named', value: named[i], tone: i === DATES.length - 1 ? 'primary' : 'tint', label: 'Answers' }], delta: i ? named[i] - named[i - 1] : null })),
      },
      summary: {
        title: o.period === 'week' ? 'This week’s movement' : 'This month’s movement',
        bar: withShares([{ key: 'won', label: 'Won', n: flow.won, tone: 'primary' }, { key: 'held', label: 'Held', n: flow.held, tone: 'tint' }, { key: 'lost', label: 'Lost', n: flow.lost, tone: 'bad' }, { key: 'missed', label: 'Missed', n: flow.missing, tone: 'neutral' }]),
        // per engine: named now = held + won; the rest of the tracked prompts are lost or missed
        byEngine: on.map((e) => { const [won, lost2] = wl(e); const named2 = d.engines[e].named; return { id: e, name: ENGINE_NAMES[e], segs: [{ key: 'won', n: won, tone: 'primary' }, { key: 'held', n: named2 - won, tone: 'tint' }, { key: 'lost', n: lost2, tone: 'bad' }, { key: 'missed', n: d.prompts - named2 - lost2, tone: 'neutral' }], note: `${won} won · ${lost2} lost` } }),
        stats: [
          { label: 'Visibility score', value: d.series.score.at(-1), delta: d.series.score.at(-1) - d.series.score[i0], since: vs },
          { label: 'Share of voice', value: me.at(-1), unit: '%', delta: me.at(-1) - me[i0], since: vs },
        ],
      },
      table: {
        title: 'Topics', searchLabel: 'Search topics', unit: 'topics',
        columns: [
          { key: 'text', label: 'Topic', kind: 'text' }, { key: 'topPrompt', label: 'Top prompt', kind: 'muted' }, { key: 'won', label: 'Won', kind: 'num', sort: true }, { key: 'lost', label: 'Lost', kind: 'num', sort: true },
          { key: 'net', label: 'Net', kind: 'net', sort: true }, { key: 'engines', label: 'Engines', kind: 'engines' }, { key: 'next', label: client ? 'What we’re doing next' : 'Next step', kind: 'muted' },
        ],
        rows: [...moved.map((m) => row(m.theme, m.prompts, m.d, m.engines)), ...planOnly.map((a) => row(a.theme, a.prompts, 0, null))],
        filters: [{ key: 'change', label: 'Change', all: 'All changes', options: [{ id: 'gained', label: 'Gained' }, { id: 'lost', label: 'Lost' }, { id: 'none', label: 'No change' }] }],
        pageSize: 10, note: byEngine,
      },
      steps: acts.map(stepOf),
    },
  }
}

// a custom question: read it (a competitor, a topic, pages, a trend, sentiment), say how it was read, then answer
// with the blocks that fit. Nothing matched: the overview, and the strip says so
export function readQuestion(prompt, d, compare = []) {
  const q = String(prompt ?? '').toLowerCase()
  const key = compare[0]
  const r = key ? d.rivals.find((k) => k.key === key) : null
  const topic = themesOf(d).find((t) => q.includes(t.toLowerCase()) || t.toLowerCase().split(/\s+/).some((w) => w.length > 4 && q.includes(w))) ?? null
  return {
    rival: r ?? null, topic,
    prompts: /named|mention|answer|prompt|where/.test(q),
    pages: /\bpages?\b|cite|citation|\blinks?\b/.test(q),
    trend: /trend|over time|since|chang|moved|grow|drop|fall|rise|improv|declin/.test(q),
    sentiment: /sentiment|tone|say about|describe|feel|review|think|perceiv|opinion|reputation/.test(q),
  }
}
function customReport(o, d, prompt, x) {
  const { i0, engines, since, color, acts, actsFor } = x
  const w = readQuestion(prompt, d, o.compare)
  const r = w.rival
  const rn = r && brandName(r.domain)
  const rv = r && first(rn)
  const h = r && d.h2h[r.key]
  const me = d.share[youKey(d)]
  const sections = []
  const read = { question: '', scope: [d.name, shortRange(DATES[i0], 'Oct 26'), engines.map((e) => ENGINE_NAMES[e]).join(', ') || 'no engines', r && `vs ${rn}`, w.topic].filter(Boolean).join(' · '), data: `${d.prompts} tracked prompts · ${DATES.length - i0} weekly syncs · the pages AI cites`, note: null }
  let verdict, headline, hero = null
  const stats = (items) => sections.push({ id: 'stats', title: 'At a glance', block: { kind: 'stats', items: items.slice(0, 4) } })
  const steps = (items, takeaway) => { if (items.length) sections.push({ id: 'steps', title: 'Next steps', takeaway, keep: true, block: { kind: 'steps', items: items.map(stepOf) } }) }
  const notIn = (id, title, text, href = '/tracker', label = 'Open Prompt Hub') => sections.push({ id, title, keep: true, block: { kind: 'notInData', text, href, label } })
  const scoreD = d.series.score.at(-1) - d.series.score[i0]
  const glanceStats = () => [
    { label: 'Visibility score', value: d.series.score.at(-1), delta: scoreD },
    { label: 'Prompts named', value: d.series.named.at(-1), of: d.prompts, delta: d.series.named.at(-1) - d.series.named[i0] },
    { label: 'Share of voice', value: me.at(-1), unit: '%', delta: me.at(-1) - me[i0] },
    { label: 'Pages cited', value: d.series.cited.at(-1), delta: d.series.cited.at(-1) - d.series.cited[i0] },
  ]
  const trendBlock = () => ({ kind: 'trend', dates: DATES.slice(i0), unit: '', lines: [{ key: 'score', name: 'Score', series: d.series.score.slice(i0), you: true }, ...engines.filter((e) => d.engines[e]).map((e, k) => ({ key: e, name: ENGINE_NAMES[e], series: d.engines[e].series.slice(i0), color: `var(--data-c${Math.min(3, k + 1)})` }))] })
  if (r && h && !w.topic && !w.trend) {
    const wins = winsOf(h)
    const themes = [...h.themes].sort((a, b) => b.prompts.length - a.prompts.length)
    const theirs = h.onlyThem + h.themFirst
    const ours = h.onlyYou + h.youFirst
    verdict = verdictOf(ours > theirs * 4 ? 'Winning' : ours > theirs ? 'Mixed' : 'Losing')
    if (w.pages && !w.prompts) {
      read.question = `The pages AI cites for ${rv} on the prompts you compete for`
      headline = `${rv} is cited most for ${list(h.citedThem.slice(0, 2).map((c) => shortPath(c.path)))}.`
      stats([{ label: `${rv}’s pages cited`, value: h.citedThem.length }, { label: 'Your pages cited there', value: h.citedYou.length }, { label: `Answers citing ${rv}`, value: h.citedThem.reduce((a, c) => a + c.n, 0) }, { label: 'Answers citing you', value: h.citedYou.reduce((a, c) => a + c.n, 0) }])
      const pages = [...h.citedThem.map((c) => pageOf(c, r.domain, { who: rv, color })), ...h.citedYou.map((c) => pageOf(c, d.domain, { who: 'You', you: true }))].sort((a, b) => b.n - a.n)
      sections.push({ id: 'pages', title: 'Pages cited, theirs and yours', takeaway: h.citedNote, total: pages.length, unit: 'pages', block: { kind: 'pages', rows: pages, unit: 'answers' } })
    } else {
      read.question = `Prompts where AI names ${rv}, and whether you’re named too`
      headline = `${rv} shows up most on ${list(themes.slice(0, 2).map((t) => t.theme.toLowerCase()))}; where you’re both named, ${h.youFirst >= h.themFirst ? 'you’re usually first' : `${rv} is usually first`}.`
      stats([{ label: `Only ${rv}`, value: h.onlyThem }, { label: `${rv} first, you after`, value: h.themFirst }, { label: `You first, ${rv} after`, value: h.youFirst }, { label: `${rv}’s wins`, value: h.theyWin.at(-1), delta: h.theyWin.at(-1) - h.theyWin[i0], since }])
      const groups = themes.map((t) => { const y = h.why.find((z) => z.theme === t.theme); return { theme: t.theme, page: pageOf(y?.them, r.domain), yourPage: pageOf(y?.you, d.domain), rows: t.prompts.map((p) => rowOf(wins.find((z) => z.text === p), rv)) } })
      sections.push({ id: 'named', title: `Where ${rv} is named and you aren’t, or ${rv} is first`, takeaway: `${themes[0].theme} is where ${rv} is named most.`, wide: true, total: wins.length, unit: 'prompts',
        block: { kind: 'promptGroups', them: rv, color, groups, engines: Object.keys(h.engines).filter((e) => engines.includes(e)).map((e) => ({ id: e, name: ENGINE_NAMES[e], n: wins.filter((z) => z.engine === e).length })).filter((e) => e.n > 0) } })
      notIn('youFirst', 'The answers where you’re named first', `The ${h.youFirst} prompts where AI names you before ${rv} aren’t listed in this report: it keeps the prompts a competitor wins. Prompt Hub lists every prompt and who’s named on it.`)
      const pages = h.citedThem.map((c) => pageOf(c, r.domain, { who: rv, color }))
      sections.push({ id: 'pages', title: `Pages AI cites for ${rv} on these prompts`, takeaway: h.citedNote, total: pages.length, unit: 'pages', block: { kind: 'pages', rows: pages, unit: 'answers' } })
    }
    steps(actsFor('rival', [r.key]), `Close the ${themes[0].theme.toLowerCase()} gap first: it’s the most prompts.`)
  } else if (w.topic) {
    const t = w.topic
    const g = d.gaps.find((z) => z.theme === t)
    const tl = d.topicLead.find((z) => z.theme === t)
    const m = (d.moved['30d'] ?? []).find((z) => z.theme === t)
    // a competitor with a head-to-head on this topic gives each prompt its engine and who's named
    const rk = Object.keys(d.h2h).find((k) => d.h2h[k].themes.some((z) => z.theme === t))
    const hh = rk && d.h2h[rk]
    const hn = rk && first(brandName(d.rivals.find((z) => z.key === rk).domain))
    const owner = g && first(brandName(d.rivals.find((z) => z.key === g.owner)?.domain ?? g.owner))
    read.question = `Where you stand on ${t.toLowerCase()} prompts`
    verdict = verdictOf(tl ? (tl.d > 0 ? 'Winning' : 'Losing') : 'Opportunity')
    headline = tl ? (tl.d > 0 ? `You lead ${t.toLowerCase()} by ${tl.d} points of share.` : `${tl.who} leads ${t.toLowerCase()}, by ${-tl.d} points of share.`) : g ? `${owner} is named instead of you on most ${t.toLowerCase()} prompts.` : `${t} hasn’t moved in this period.`
    stats([g && { label: 'Prompts you’re missing', value: g.missing }, g && { label: 'A competitor named instead', value: g.owned, sub: owner }, m && { label: m.d > 0 ? 'Won in the period' : 'Lost in the period', value: Math.abs(m.d), bad: m.d < 0 }, tl && { label: 'Your lead', value: tl.d, unit: ' pts', bad: tl.d < 0 }].filter(Boolean))
    const wins = hh ? winsOf(hh).filter((z) => z.theme === t) : []
    const prompts = g?.prompts ?? hh?.themes.find((z) => z.theme === t)?.prompts ?? m?.prompts ?? []
    if (prompts.length) {
      const y = hh?.why.find((z) => z.theme === t)
      const rows = prompts.map((p) => { const win = wins.find((z) => z.text === p); return win ? rowOf(win, hn) : { text: p, engines: [], named: owner ? [owner] : [], note: owner ? `${owner} named instead` : null } })
      sections.push({ id: 'prompts', title: `${t} prompts`, takeaway: owner ? `${owner} is named instead of you on ${g.owned} of these.` : `${prompts.length} prompts in this topic.`, wide: true, total: rows.length, unit: 'prompts',
        block: { kind: 'promptGroups', them: hn ?? owner ?? null, color, groups: [{ theme: t, page: pageOf(y?.them, rk && d.rivals.find((z) => z.key === rk).domain), yourPage: pageOf(y?.you, d.domain), rows }], engines: [] } })
    }
    notIn('total', 'How many of these prompts name you', `The total prompts in ${t.toLowerCase()} and how many name you isn’t in the report data; the ones you’re missing are. Prompt Hub has the full topic.`, topicHref(t), 'Open the topic')
    const own = acts.filter((a) => a.theme === t)
    steps(own.length ? own : (g ? [{ type: 'New page', theme: t, n: g.missing, prompts: g.prompts, title: `Build the ${t.toLowerCase()} page AI is missing`, meta: `New page · ${owner} is named on ${g.owned} of these` }] : []), g ? `One page for ${t.toLowerCase()} covers ${g.missing} prompts.` : null)
  } else if (w.trend) {
    const flow = d.flow[o.period] ?? d.flow['30d']
    const net = flow.won - flow.lost
    read.question = `How ${d.name}’s visibility moved since ${DATES[i0]}`
    verdict = verdictOf(net > 0 && flow.lost * 2 <= flow.won ? 'Good month' : net >= 0 ? 'Mixed' : 'Tough month')
    headline = net > 0 ? `In ${net} more AI answers than ${DATES[i0]}, led by ${(d.moved[o.period] ?? d.moved['30d'])[0].theme.toLowerCase()}.` : `In fewer AI answers than ${DATES[i0]}.`
    stats(glanceStats())
    sections.push({ id: 'trend', title: 'Visibility score by engine', takeaway: `${ENGINE_NAMES[engines[0]]} names you most; the score is the average of the engines shown.`, wide: true, block: trendBlock() })
    steps(acts, 'The standing plan, by the prompts each step could win.')
  } else if (w.pages) {
    read.question = `The pages AI cites for ${d.name}`
    verdict = verdictOf(d.series.cited.at(-1) > d.series.cited[i0] ? 'Good month' : 'Mixed')
    headline = `${shortPath(d.cited[0].path)} carries most of your citations${d.cited.some((c) => c.isNew) ? `; ${shortPath(d.cited.find((c) => c.isNew).path)} is new` : ''}.`
    stats(glanceStats())
    const pages = d.cited.map((c) => pageOf(c, d.domain, { who: 'You', you: true }))
    sections.push({ id: 'pages', title: 'Your pages, by answers citing them', takeaway: 'Cited pages are distinct pages after URL normalisation.', total: pages.length, unit: 'pages', block: { kind: 'pages', rows: pages, unit: 'answers' } })
    steps(acts, 'Build on the pages AI already cites.')
  } else {
    read.question = w.sentiment ? `How AI describes ${d.name}` : `${d.name}’s AI visibility, ${periodLabel(o.period).toLowerCase()}`
    read.note = w.sentiment ? null : r && !h ? `There’s no head-to-head breakdown for ${rn} yet, so this is the overview.` : `Couldn’t read a narrower question from “${String(prompt).trim()}”, so this is the overview. Name a competitor, a topic or a page to go closer.`
    verdict = verdictOf(scoreD > 0 ? 'Good month' : scoreD < 0 ? 'Tough month' : 'Mixed')
    headline = `${d.name} is named on ${d.series.named.at(-1)} of ${d.prompts} prompts, ${scoreD >= 0 ? 'up' : 'down'} since ${DATES[i0]}.`
    stats([glanceStats()[0], glanceStats()[2], glanceStats()[3]])
    sections.push({ id: 'trend', title: 'Visibility score by engine', takeaway: `${ENGINE_NAMES[engines[0]]} names you most; the score is the average of the engines shown.`, wide: true, block: trendBlock() })
    steps(acts, 'The standing plan, by the prompts each step could win.')
  }
  if (w.sentiment) notIn('sentiment', 'How AI describes you', 'Sentiment isn’t in the report data. The Sentiment page has how the pages AI cites describe you.', '/sentiment', 'Open Sentiment')
  return { ok: true, verdict, headline, hero, read, sections }
}

// ---- follow-up chips: made from what this report's data can answer. Each one is a change the box understands (sets)
// or a new question (ask). Never an engine that isn't tracked or didn't run; nothing adds an engine
export function followUpsFor(built) {
  if (!built?.ok) return []
  const o = built.opts
  const d = dataFor(o.brand)
  if (!d) return []
  const ran = ENGINE_IDS.filter((e) => d.ran.includes(e) && (!o.engines.length || o.engines.includes(e)))
  const rival = d.rivals.find((r) => r.key === o.compare[0]) ?? d.rivals.find((r) => d.h2h[r.key])
  const rv = rival ? first(brandName(rival.domain)) : null
  const out = []
  if (built.kind === 'rival') {
    out.push({ id: 'named', text: `Show the answers where ${rv} is named`, ask: true })
    out.push({ id: 'write', text: 'Which pages should we write?', ask: true, sets: { kind: 'content', compare: [] } })
  } else if (built.kind === 'custom') {
    if (rival && d.h2h[rival.key]) out.push({ id: 'rival', text: `Where is ${rv} beating us?`, ask: true, sets: { kind: 'rival', compare: [rival.key] } })
    out.push({ id: 'write', text: 'Which pages should we write?', ask: true, sets: { kind: 'content', compare: [] } })
  } else {
    out.push({ id: 'length', text: o.length === 'one' ? 'Make it detailed' : 'Make it shorter', sets: { length: o.length === 'one' ? 'detailed' : 'one' } })
    if (rival && d.h2h[rival.key]) out.push({ id: 'rival', text: `Focus on ${rv}`, sets: { kind: 'rival', compare: [rival.key] } })
  }
  if (o.audience !== 'client') out.push({ id: 'client', text: 'Make a client version', sets: { audience: 'client' } })
  const only = ran.length > 1 ? ran.find((e) => !(o.engines.length === 1 && o.engines[0] === e)) : null
  if (only) out.push({ id: `only-${only}`, text: `Only ${ENGINE_NAMES[only]} answers`, sets: { engines: [only] } })
  return out.slice(0, 4)
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
  if (add.length && /\bonly\b|\bjust\b/.test(q)) { next.engines = add; did.push(`Only ${list(add.map((e) => ENGINE_NAMES[e]))}`) }
  else if (add.length && /add|include|with/.test(q)) {
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
  return [...(o.kind === 'custom' ? ['Reading your question'] : []), `Reading ${d?.prompts ?? 0} prompts`, `Comparing ${n} brands`, 'Writing the summary']
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
  const j = run.from ?? i - 1
  const m = (id, label, series, extra = {}) => ({ id, label, value: series[i], delta: series[i] - series[j], series: series.slice(0, i + 1), ...extra })
  return {
    header: { brand: d.name, domain: d.domain, period: `${DATES[j]} – ${DATES[i]}, 2026`, audience: run.audience ?? 'team', engines: 'All engines', verdict: run.verdict, headline: run.headline, kind: run.kind ?? 'weekly' },
    scoreline: { since: DATES[j], items: [m('score', 'Visibility score', d.series.score), m('named', 'Prompts named', d.series.named, { of: d.prompts }), m('sov', 'Share of voice', sov, { unit: '%' }), m('cited', 'Pages cited', d.series.cited)] },
  }
}
// ---- the library (All reports): series (the scheduled reports, each with its runs) and one-off reports ------------
// a schedule's cadence in weekly syncs, and how it's said
const CADENCE = { 'Mondays 9am': { step: 1, label: 'every Monday' }, 'Every other Friday 10am': { step: 2, label: 'every other Friday' }, '1st of the month 8am': { step: 4, label: 'monthly' } }
const signedN = (n) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}`
// a series' runs, newest first: one per run of its schedule (a sync every `step` weeks), each compared with the run
// before it. The newest is the saved report itself; the earlier ones keep what was sent (headline, verdict, the change)
export function seriesRuns(s) {
  const saved = savedReports.find((r) => r.id === s.reportId)
  const d = saved && dataFor(s.brand)
  if (!d) return []
  const step = CADENCE[s.cadence]?.step ?? 1
  const kind = saved.opts.kind
  const latest = buildReport(saved.opts, saved.prompt)
  const me = d.share[youKey(d)]
  const out = []
  for (let i = DATES.length - 1; i > 0; i -= step) {
    const j = Math.max(0, i - step) // the earliest run compares with the first sync
    const first = i === DATES.length - 1
    let verdict, headline, change
    if (kind === 'ceo') {
      const lead = (x) => me[x] - Math.max(...d.rivals.map((r) => d.share[r.key][x]))
      const ahead = lead(i) > 0
      const gaining = me[i] > me[j]
      verdict = ahead && gaining ? 'Winning' : ahead || gaining ? 'Mixed' : 'Losing'
      headline = ahead ? `The brand AI names most for ${d.lead}${gaining ? ', and gaining' : ''}.` : `A competitor is named more than you for ${d.lead}.`
      change = `${signedN(me[i] - me[j])} pts share`
    } else {
      const net = d.series.named[i] - d.series.named[j]
      const ds = d.series.score[i] - d.series.score[j]
      const span = step === 1 ? 'week' : 'month'
      verdict = net > 0 && ds > 0 ? `Good ${span}` : net < 0 && ds < 0 ? `Tough ${span}` : 'Mixed'
      const since = step === 1 ? 'the week before' : DATES[j]
      headline = net > 0 ? `In ${net} more AI ${net === 1 ? 'answer' : 'answers'} than ${since}.` : net < 0 ? `In ${-net} fewer AI ${net === -1 ? 'answer' : 'answers'} than ${since}.` : `In as many AI answers as ${since}.`
      change = `${signedN(net)} ${Math.abs(net) === 1 ? 'answer' : 'answers'}`
    }
    if (first) { verdict = latest.verdict; headline = latest.headline }
    out.push({ id: first ? saved.id : `run-${s.id}-${i}`, series: s.id, brand: s.brand, kind, idx: i, from: j, date: DATES[i], verdict, headline, change, run: !first, audience: saved.opts.audience, title: s.title })
  }
  return out
}
// the library for one brand (or every brand: null): its series and its one-off reports, newest first
export function library(brandId = null) {
  const inScope = (b) => !brandId || b === brandId
  const scheduled = new Set(schedules.map((s) => s.reportId))
  const series = schedules.filter((s) => inScope(s.brand)).map((s) => {
    const saved = savedReports.find((r) => r.id === s.reportId)
    const runs = seriesRuns(s)
    return { id: s.id, reportId: s.reportId, brand: s.brand, title: s.title, cadence: CADENCE[s.cadence]?.label ?? s.cadence, recipients: s.recipients.length, kind: saved?.opts.kind, audience: saved?.opts.audience, saved: !!saved?.saved, runs, latest: runs[0] }
  }).filter((s) => s.runs.length)
  const oneOffs = savedReports.filter((r) => !scheduled.has(r.id) && inScope(r.brand)).map((r) => {
    const b = buildReport(r.opts, r.prompt)
    return { id: r.id, brand: r.brand, kind: b.ok ? b.kind : r.opts.kind, verdict: b.ok ? b.verdict : null, headline: b.ok ? b.headline : r.title, title: r.title, audience: b.opts?.audience ?? r.opts.audience, created: r.created, saved: !!r.saved }
  }).sort((a, b) => parseDay(b.created) - parseDay(a.created))
  return { series, oneOffs, scheduled: schedules.filter((s) => inScope(s.brand)).length }
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
// a report written in this session: kept with the saved ones (it opens at /reports/<id> and shows in All reports)
let made = 0
export function addReport(prompt, opts) {
  const o = { ...DEFAULT_OPTS, compare: [], engines: [], ...opts }
  const id = `r-new-${++made}`
  savedReports.unshift({ id, brand: o.brand, prompt, opts: o, title: titleFor(prompt, resolveOpts(o, prompt)), created: 'Oct 28', saved: false })
  return id
}
// a change from the thread updates what the report keeps (its latest version)
export function updateReport(id, opts, prompt = null) {
  const r = savedReports.find((x) => x.id === id)
  if (!r) return
  r.opts = { ...r.opts, ...opts }
  if (prompt != null) r.prompt = prompt
}
