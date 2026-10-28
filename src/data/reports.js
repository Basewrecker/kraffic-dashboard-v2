// Reports: fake but realistic data for two brands (Finance of America, Dermasuri), the saved and scheduled reports, and
// the rules that turn a question + options into an analyst memo built from a fixed block library. Plain JS (unit-tested
// in reports.test.js). Every number comes from these datasets; anything a dataset doesn't have (an engine that didn't
// run, data that isn't connected, a breakdown we don't hold) is left out and named in the footer, never estimated.
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
  { id: 'ceo', label: 'CEO', hint: 'A verdict, the why, three decisions' },
  { id: 'client', label: 'Client', hint: 'Plain words, what we’re doing for them' },
]
export const LENGTHS = [
  { id: 'one', label: 'One page', hint: 'Fits one A4 page' },
  { id: 'detailed', label: 'Detailed', hint: 'Adds engines, the why, what changed' },
]
export const MAX_COMPARE = 3
export const DEFAULT_OPTS = { brand: null, period: null, engines: [], compare: [], audience: null, length: null, from: null, to: null }

// ---- the brands ---------------------------------------------------------------------------------------------------
// per period: movement (prompts won / lost, and how many were visible at the start), won / lost by theme, by engine.
// themes: { theme, n, prompts: the top ones (n can be more) }
const T = (theme, n, prompts) => ({ theme, n, prompts })
const FOA = {
  id: 'foa', name: 'Finance of America', domain: 'financeofamerica.com', prompts: 113, lead: 'reverse mortgages',
  syncs: historyMany.weekly.map((r) => r.date), // weekly, Jul 27 … Oct 26
  ran: ['aio', 'chatgpt', 'gemini'],
  missing: { claude: 'Claude didn’t run in the Oct 26 sync, so it isn’t counted.' },
  notConnected: ['Marketplace and community data isn’t connected for Finance of America.'],
  score: { now: 64, start: { week: 62, '30d': 59, quarter: 55 } },
  sentiment: { now: 58, start: { week: 57, '30d': 54, quarter: 49 } },
  share: Object.fromEntries(['foa', 'rocket', 'omaha', 'aag', 'longbridge', 'liberty', 'guild'].map((k) => [k, historyMany.weekly.map((r) => r[k])])),
  rivals: [
    { key: 'rocket', domain: 'rocketmortgage.com', ahead: 22, behind: 9, onlyThem: 4 },
    { key: 'omaha', domain: 'mutualofomahamortgage.com', ahead: 19, behind: 7, onlyThem: 5 },
    { key: 'aag', domain: 'aag.com', ahead: 15, behind: 11, onlyThem: 7 },
    { key: 'longbridge', domain: 'longbridge-financial.com', ahead: 12, behind: 14, onlyThem: 9 },
    { key: 'liberty', domain: 'libertyreverse.com', ahead: 10, behind: 4, onlyThem: 3 },
    { key: 'guild', domain: 'guildmortgage.com', ahead: 8, behind: 2, onlyThem: 1 },
  ],
  move: {
    week: { from: 67, won: 6, lost: 2 },
    '30d': { from: 62, won: 12, lost: 3 },
    quarter: { from: 56, won: 19, lost: 4 },
  },
  wonThemes: {
    week: [T('Lender comparisons', 3, ['best reverse mortgage lenders 2026', 'is Finance of America a good lender', 'Finance of America vs AAG reviews']), T('HECM for purchase', 2, ['how does a HECM for purchase work', 'HECM for purchase down payment']), T('Home equity alternatives', 1, ['reverse mortgage vs home equity loan for retirees'])],
    '30d': [T('Lender comparisons', 5, ['best reverse mortgage lenders 2026', 'is Finance of America a good lender', 'Finance of America vs AAG reviews']), T('HECM for purchase', 4, ['how does a HECM for purchase work', 'HECM for purchase down payment', 'buy a home with a reverse mortgage']), T('Home equity alternatives', 3, ['reverse mortgage vs home equity loan for retirees', 'HELOC or reverse mortgage at 65', 'home equity investment vs reverse mortgage'])],
    quarter: [T('Lender comparisons', 8, ['best reverse mortgage lenders 2026', 'is Finance of America a good lender', 'Finance of America vs AAG reviews']), T('HECM for purchase', 6, ['how does a HECM for purchase work', 'HECM for purchase down payment', 'buy a home with a reverse mortgage']), T('Home equity alternatives', 3, ['reverse mortgage vs home equity loan for retirees', 'HELOC or reverse mortgage at 65', 'home equity investment vs reverse mortgage']), T('Retirement income', 2, ['reverse mortgage to delay social security', 'reverse mortgage line of credit growth'])],
  },
  lostThemes: {
    week: [T('Calculators', 1, ['HECM calculator']), T('Eligibility', 1, ['reverse mortgage age requirement'])],
    '30d': [T('Calculators', 2, ['HECM calculator', 'reverse mortgage payout calculator']), T('Eligibility', 1, ['reverse mortgage age requirement'])],
    quarter: [T('Calculators', 2, ['HECM calculator', 'reverse mortgage payout calculator']), T('Jumbo loans', 1, ['best jumbo reverse mortgage lender']), T('Eligibility', 1, ['reverse mortgage age requirement'])],
  },
  // won / lost per engine in the period, and the share of prompts each engine names you on now
  engines: {
    now: { aio: 68, chatgpt: 61, gemini: 52 },
    week: { aio: [3, 0], chatgpt: [1, 2], gemini: [2, 0] },
    '30d': { aio: [6, 0], chatgpt: [3, 3], gemini: [3, 0] },
    quarter: { aio: [9, 1], chatgpt: [6, 3], gemini: [4, 0] },
  },
  why: [
    { title: 'Your lender-comparison page is being cited', text: '/reverse-mortgage/compare-lenders went live on Oct 14. AI answers to comparison questions now cite it in 5 answers; before, they quoted review sites.' },
    { title: 'Longbridge’s calculator wins calculator questions', text: 'ChatGPT switched to longbridge-financial.com/reverse-mortgage-calculator for “HECM calculator”. You have no calculator page for it to cite.', against: true },
    { title: 'Jumbo questions go to whoever names the limits', text: 'Longbridge and Liberty publish their jumbo loan limits on product pages. Your /reverse-mortgage page mentions proprietary loans in one line.', against: true },
  ],
  actions: [
    { text: 'Publish a reverse mortgage calculator page', wins: T('', 8, ['HECM calculator', 'reverse mortgage calculator', 'how much can I borrow with a reverse mortgage']), about: ['longbridge', 'aag'] },
    { text: 'Give jumbo loans their own page, with the limits and who qualifies', wins: T('', 6, ['proprietary jumbo reverse mortgage', 'reverse mortgage over $1 million', 'best jumbo reverse mortgage lender']), about: ['longbridge', 'liberty'] },
    { text: 'Add age, condo and “can I lose my home” answers to /resources/reverse-mortgage-faq', wins: T('', 9, ['reverse mortgage age requirement', 'can you lose your home with a reverse mortgage', 'reverse mortgage for a condo']), about: ['aag', 'omaha', 'longbridge'] },
  ],
  // head-to-head detail we hold (others: the grid and counts only)
  h2h: {
    longbridge: {
      themes: [T('Calculators', 8, ['reverse mortgage calculator', 'HECM calculator', 'how much can I borrow with a reverse mortgage']), T('Jumbo loans', 6, ['proprietary jumbo reverse mortgage', 'reverse mortgage over $1 million', 'best jumbo reverse mortgage lender']), T('Eligibility and rules', 5, ['can you lose your home with a reverse mortgage', 'HECM loan limits 2027', 'reverse mortgage age requirement']), T('Property types', 4, ['reverse mortgage for a condo', 'reverse mortgage on a manufactured home', 'FHA-approved condos for a reverse mortgage'])],
      engines: { aio: 13, chatgpt: 7, gemini: 3 },
      why: [
        { title: 'It has a calculator page; you don’t', text: 'longbridge-financial.com/reverse-mortgage-calculator is cited in 11 answers to calculator questions. financeofamerica.com has no calculator for AI to cite.' },
        { title: 'Its jumbo page names the limits', text: 'AI quotes Longbridge’s Platinum page on jumbo questions in 6 answers. Your proprietary loan gets one line on /reverse-mortgage.' },
        { title: 'It answers the rules in plain sentences', text: 'Longbridge’s FAQ answers condo and “can I lose my home” questions directly, and AI lifts those sentences. Your FAQ doesn’t cover either.' },
      ],
    },
  },
}

const DS = {
  id: 'dermasuri', name: 'Dermasuri', domain: 'dermasuri.com', prompts: 152, lead: 'body exfoliation',
  syncs: ['Sep 28', 'Oct 5', 'Oct 12', 'Oct 19', 'Oct 26'],
  ran: ['aio', 'chatgpt'],
  missing: { gemini: 'Gemini only runs with a full sync; none ran in this period.', claude: 'Claude only runs with a full sync; none ran in this period.' },
  notConnected: [],
  score: { now: 73, start: { week: 66, '30d': 64, quarter: 64 } },
  sentiment: { now: 57, start: { week: 53, '30d': 51, quarter: 51 } },
  share: { dermasuri: [66, 68, 67, 70, 73], cerave: [21, 20, 20, 19, 18], theordinary: [6, 5, 6, 4, 4], paulaschoice: [5, 4, 4, 4, 3] },
  rivals: [
    { key: 'cerave', domain: 'cerave.com', ahead: 41, behind: 12, onlyThem: 6 },
    { key: 'theordinary', domain: 'theordinary.com', ahead: 37, behind: 6, onlyThem: 4 },
    { key: 'paulaschoice', domain: 'paulaschoice.com', ahead: 33, behind: 8, onlyThem: 5 },
  ],
  move: { week: { from: 104, won: 9, lost: 2 }, '30d': { from: 97, won: 18, lost: 4 }, quarter: { from: 97, won: 18, lost: 4 } },
  wonThemes: {
    week: [T('Keratosis pilaris', 4, ['best exfoliating gloves for keratosis pilaris', 'KP body routine', 'how to treat KP on arms']), T('Exfoliation tools', 3, ['korean italy towel vs exfoliating mitt', 'best exfoliating mitt', 'are exfoliating gloves hygienic']), T('Strawberry legs', 2, ['how to get rid of strawberry legs at home', 'strawberry legs after shaving'])],
    '30d': [T('Keratosis pilaris', 7, ['best exfoliating gloves for keratosis pilaris', 'KP body routine', 'how to treat KP on arms']), T('Exfoliation tools', 6, ['korean italy towel vs exfoliating mitt', 'best exfoliating mitt', 'are exfoliating gloves hygienic']), T('Strawberry legs', 5, ['how to get rid of strawberry legs at home', 'strawberry legs after shaving', 'ingrown hairs on legs'])],
  },
  lostThemes: {
    week: [T('Sensitive skin', 2, ['gentle exfoliator for sensitive skin', 'exfoliating sensitive skin on the body'])],
    '30d': [T('Sensitive skin', 3, ['gentle exfoliator for sensitive skin', 'exfoliating sensitive skin on the body', 'exfoliating with eczema']), T('Body wash', 1, ['best body wash for keratosis pilaris'])],
  },
  engines: { now: { aio: 73, chatgpt: 58 }, week: { aio: [6, 0], chatgpt: [3, 2] }, '30d': { aio: [11, 1], chatgpt: [7, 3] } },
  why: [
    { title: 'Your how-to page is cited for KP routines', text: '/pages/how-to-use is now cited in 13 answers about keratosis pilaris, up from 4 at the start of the period.' },
    { title: 'Sensitive-skin questions go to Paula’s Choice and CeraVe', text: 'Both have pages written for sensitive skin, and AI quotes them directly. Dermasuri’s product pages don’t mention sensitive skin.', against: true },
  ],
  actions: [
    { text: 'Write a sensitive-skin guide for the mitt', wins: T('', 7, ['gentle exfoliator for sensitive skin', 'exfoliating sensitive skin on the body', 'exfoliating with eczema']), about: ['paulaschoice', 'cerave'] },
    { text: 'Add a body-wash pairing to the KP routine post', wins: T('', 6, ['best body wash for keratosis pilaris', 'what to use after exfoliating', 'KP body wash and mitt routine']), about: ['cerave'] },
  ],
  h2h: {
    cerave: {
      themes: [T('Sensitive skin', 7, ['gentle exfoliator for sensitive skin', 'exfoliating sensitive skin on the body', 'exfoliating with eczema']), T('Body wash', 6, ['best body wash for keratosis pilaris', 'what to use after exfoliating', 'body wash for rough skin']), T('Moisturising after exfoliation', 5, ['best lotion after exfoliating', 'moisturiser for KP', 'urea cream for rough skin'])],
      engines: { aio: 11, chatgpt: 7 },
      why: [
        { title: 'CeraVe owns the after-exfoliation step', text: 'AI recommends CeraVe’s SA cream and body wash as the step after any exfoliating tool, in 9 answers. Dermasuri’s pages stop at the mitt.' },
        { title: 'Dermatologist language', text: 'CeraVe’s pages say “developed with dermatologists” and AI repeats it for sensitive-skin questions. Dermasuri has no expert page.' },
      ],
    },
  },
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

// ---- periods ------------------------------------------------------------------------------------------------------
const SPAN = { week: 2, '30d': 5, quarter: 13, custom: 5 }
export const periodSyncs = (d, period) => d.syncs.slice(-(SPAN[period] ?? SPAN['30d']))
export const periodLabel = (id) => PERIODS.find((p) => p.id === id)?.label ?? 'Last 30 days'
export function periodRange(d, period) {
  const s = periodSyncs(d, period)
  return s.length ? `${s[0]} – ${s[s.length - 1]}, 2026` : ''
}
const SINCE = { week: 'last Monday', '30d': 'a month ago', quarter: 'the start of the quarter', custom: 'the start of the period' }
const OVER = { week: 'this week', '30d': 'over the last 30 days', quarter: 'over the quarter', custom: 'over the period' }
// a period's own data, else the nearest one we hold (a custom range uses the 30-day figures)
const per = (obj, period) => obj?.[period] ?? obj?.['30d'] ?? null

// ---- reading the question: options the chips don't set yet ----------------------------------------------------
export function inferOpts(prompt, d) {
  const q = String(prompt ?? '').toLowerCase()
  const out = {}
  if (/this week|weekly|past week/.test(q)) out.period = 'week'
  else if (/last month|30 days|since last month|this month/.test(q)) out.period = '30d'
  else if (/quarter/.test(q)) out.period = 'quarter'
  if (/\bceo\b|board|exec/.test(q)) out.audience = 'ceo'
  else if (/client/.test(q)) out.audience = 'client'
  if (/one.?page|short|quick|summary/.test(q)) out.length = 'one'
  else if (/detailed|deep dive|everything/.test(q)) out.length = 'detailed'
  const eng = ENGINE_IDS.filter((e) => q.includes(ENGINE_NAMES[e].toLowerCase()) || (e === 'aio' && /google/.test(q)))
  if (eng.length) out.engines = eng
  if (d) {
    const named = d.rivals.filter((r) => q.includes(r.key) || q.includes(brandName(r.domain).toLowerCase().split(' ')[0]))
    if (named.length) out.compare = named.slice(0, MAX_COMPARE).map((r) => r.key)
  }
  return out
}
const isSet = (v) => v != null && (!Array.isArray(v) || v.length > 0)
export function resolveOpts(opts, prompt) {
  const inf = inferOpts(prompt, dataFor(opts.brand))
  const pick = (k, def) => (isSet(opts[k]) ? opts[k] : inf[k] ?? def)
  return { brand: opts.brand, period: pick('period', '30d'), engines: pick('engines', []), compare: pick('compare', []), audience: pick('audience', 'team'), length: pick('length', 'one'), from: opts.from ?? null, to: opts.to ?? null }
}

// ---- the memo -----------------------------------------------------------------------------------------------------
// Block library (fixed): headline · lede · hero · where · engines · why · changed · next · sources.
// Three kinds, each with its own hero: 'rival' (who AI names, prompt by prompt), 'weekly' / 'summary' (what moved,
// prompt by prompt), 'ceo' (share of voice, start → now). Sections run what's happening → where → why → what to do.
export const BLOCK_NAMES = {
  headline: 'Headline', lede: 'The short version', hero: 'The picture', where: 'Where', engines: 'By engine', why: 'Why',
  changed: 'What changed', next: 'What to do', sources: 'Sources',
}
const TEMPLATES = {
  one: ['headline', 'lede', 'hero', 'where', 'next', 'sources'],
  detailed: ['headline', 'lede', 'hero', 'where', 'engines', 'why', 'changed', 'next', 'sources'],
}
function topic(prompt) {
  const q = String(prompt ?? '').toLowerCase()
  if (/content|write|publish|prompts should/.test(q)) return 'content'
  if (/beating|losing|behind|ahead of|vs\b|versus/.test(q)) return 'rival'
  if (/marketplace|community|reddit|amazon/.test(q)) return 'community'
  return null
}
export function titleFor(prompt, o) {
  const q = String(prompt ?? '').trim()
  if (q) return q.length > 72 ? `${q.slice(0, 70).trimEnd()}…` : q.charAt(0).toUpperCase() + q.slice(1)
  if (o.audience === 'ceo') return 'CEO summary'
  if (o.audience === 'client') return 'Client update'
  return o.period === 'week' ? 'Weekly summary' : 'Visibility summary'
}
const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const pct = (n) => `${n}%`

// → { ok: false, reason: 'thin', … } without enough data; else { ok: true, kind, title, opts, blocks: [{ id, type, data }] }
export function buildReport(rawOpts, prompt = '') {
  const o = resolveOpts({ ...DEFAULT_OPTS, ...rawOpts }, prompt)
  const d = dataFor(o.brand)
  if (!d) {
    const thin = THIN[o.brand]
    return { ok: false, reason: 'thin', brand: thin?.name ?? brandLabel(o.brand), syncs: thin?.syncs ?? 0, nextSync: thin?.nextSync ?? null, opts: o }
  }
  const syncs = periodSyncs(d, o.period)
  if (syncs.length < 2) return { ok: false, reason: 'thin', brand: d.name, syncs: syncs.length, nextSync: null, opts: o }

  const asked = o.engines.length ? o.engines : ENGINE_IDS
  const engines = asked.filter((e) => d.ran.includes(e))
  const noData = asked.filter((e) => !d.ran.includes(e))
  const focus = o.compare.length ? d.rivals.filter((r) => o.compare.includes(r.key)) : d.rivals
  const t = topic(prompt)
  const kind = focus.length === 1 && (o.compare.length === 1 || t === 'rival') ? 'rival' : o.audience === 'ceo' ? 'ceo' : o.period === 'week' ? 'weekly' : 'summary'
  const client = o.audience === 'client'
  const youKey = Object.keys(d.share)[0]
  const i0 = d.syncs.length - syncs.length
  const share = (k) => ({ from: d.share[k][i0], now: d.share[k][d.share[k].length - 1] })
  const me = share(youKey)
  const mv = per(d.move, o.period)
  const visible = mv.from + mv.won - mv.lost
  const sc = { now: d.score.now, from: per(d.score.start, o.period) }
  const left = [...noData.map((e) => d.missing[e] ?? `${ENGINE_NAMES[e]} has no data in this period.`), ...d.notConnected]
  const b = {}

  b.headline = { brand: d.name, domain: d.domain, period: periodRange(d, o.period), audience: o.audience, engines: o.engines.length ? list(o.engines.map((e) => ENGINE_NAMES[e])) : 'All engines' }
  b.sources = { syncs: syncs.length, from: syncs[0], to: syncs[syncs.length - 1], engines: engines.map((e) => ENGINE_NAMES[e]), left }
  b.changed = {
    since: syncs[0],
    rows: [
      { label: 'Visibility score', before: sc.from, now: sc.now },
      { label: 'Prompts in the answer', before: mv.from, now: visible },
      { label: 'Share of voice', before: pct(me.from), now: pct(me.now), delta: me.now - me.from },
      { label: 'Sentiment score', before: per(d.sentiment.start, o.period), now: d.sentiment.now },
    ],
  }

  if (kind === 'rival') {
    const r = focus[0]
    const rn = brandName(r.domain)
    const h = d.h2h[r.key]
    const both = r.ahead + r.behind
    const onlyYou = visible - both
    const neither = d.prompts - visible - r.onlyThem
    const against = r.onlyThem + r.behind
    const theirs = r.onlyThem + both
    b.headline.text = against > r.ahead + onlyYou
      ? `${rn} is beating ${d.name} on most of the prompts you track.`
      : h ? `${rn} beats ${d.name} on ${against} of ${d.prompts} prompts, almost all of them about ${list(h.themes.slice(0, 2).map((x) => x.theme.toLowerCase()))}.`
        : `${rn} beats ${d.name} on ${against} of ${d.prompts} prompts.`
    b.lede = {
      text: `AI names ${rn} instead of you on ${r.onlyThem} prompts, and names it above you on ${r.behind} more. You still lead overall: you’re in the answer on ${visible} prompts to ${rn}’s ${theirs}, and named first on ${r.ahead} of the ${both} you share.`,
    }
    b.hero = {
      kind: 'grid', title: `All ${d.prompts} prompts, by who AI names`, total: d.prompts,
      groups: [
        { label: `Only ${rn}`, n: r.onlyThem, tone: 'against' },
        { label: `Both, ${rn} first`, n: r.behind, tone: 'against-soft' },
        { label: 'Both, you first', n: r.ahead, tone: 'you-soft' },
        { label: 'Only you', n: onlyYou, tone: 'you' },
        { label: 'Neither', n: neither, tone: 'none' },
      ],
    }
    if (h) {
      b.where = { title: `Where ${rn} wins`, sub: `The ${against} prompts, grouped by what they ask`, groups: [{ label: null, against: true, themes: h.themes }] }
      const he = Object.entries(h.engines).filter(([e]) => engines.includes(e))
      b.engines = { title: `Where ${rn} wins, by engine`, rows: he.map(([e, n]) => ({ name: ENGINE_NAMES[e], against: n })), max: Math.max(...he.map(([, n]) => n)) }
      b.why = { title: `Why ${rn} wins them`, items: h.why }
    }
    else left.push(`A breakdown of where ${rn} wins, and why, isn’t available yet.`)
    b.next = { title: client ? 'What we’re doing next' : 'What to do', items: d.actions.filter((a) => a.about.includes(r.key)) }
  } else if (kind === 'ceo') {
    const rivals = focus.map((r) => ({ key: r.key, name: brandName(r.domain), ...share(r.key), ahead: r.ahead, behind: r.behind }))
    const top = [...rivals].sort((a, b2) => b2.now - a.now)[0]
    const first = me.now > top.now
    const behindTo = rivals.filter((r) => r.behind > r.ahead)
    const verdict = first && me.now >= me.from && !behindTo.length ? 'winning' : first || me.now > me.from ? 'mostly winning' : 'losing'
    b.headline.text = verdict === 'losing'
      ? `No, not yet: ${top.name} is the brand AI names most for ${d.lead}.`
      : `Yes, we’re ${verdict}: for ${d.lead}, AI names ${d.name} more than any other brand${me.now > me.from ? ', and the lead is growing' : ''}.`
    b.headline.verdict = verdict
    const losing = per(d.lostThemes, o.period) ?? []
    b.lede = {
      text: `${OVER[o.period].charAt(0).toUpperCase() + OVER[o.period].slice(1)} our share of voice went from ${pct(me.from)} to ${pct(me.now)}, ${me.now - top.now} points clear of ${top.name}. We’re in the answer for ${visible} of the ${d.prompts} questions we track, up from ${mv.from}.${behindTo.length ? ` The one competitor ahead of us anywhere is ${list(behindTo.map((r) => r.name))}, on questions about ${list((d.h2h[behindTo[0].key]?.themes ?? losing).slice(0, 2).map((x) => x.theme.toLowerCase()))}.` : ''}`,
    }
    b.hero = { kind: 'slope', title: 'Share of voice', sub: `${syncs[0]} → ${syncs[syncs.length - 1]}`, rows: [{ key: youKey, name: d.name, you: true, ...me }, ...rivals] }
    const won = per(d.wonThemes, o.period) ?? []
    b.where = { title: 'Where we’re ahead, and where we’re not', groups: [{ label: 'Gaining', themes: won }, { label: 'Losing ground', against: true, themes: losing }] }
    b.engines = engineMove(d, o.period, engines)
    b.why = { title: 'Why', items: d.why }
    b.next = { title: 'Three decisions', items: d.actions.slice(0, 3), decide: true }
  } else {
    const won = per(d.wonThemes, o.period) ?? []
    const lost = per(d.lostThemes, o.period) ?? []
    const net = mv.won - mv.lost
    const top = [...focus].map((r) => ({ name: brandName(r.domain), ...share(r.key) })).sort((a, b2) => b2.now - a.now)[0]
    const we = client ? 'we' : 'you'
    const lostEng = Object.entries(per(d.engines, o.period) ?? {}).filter(([e, [, l]]) => l > 0 && engines.includes(e))
    b.headline.text = net > 0
      ? `${o.period === 'week' ? 'A good week' : 'A good month'}: ${d.name} is in more AI answers than ${SINCE[o.period]}, and the gains came from ${won[0]?.theme.toLowerCase() ?? 'new prompts'}.`
      : net < 0 ? `${d.name} is in fewer AI answers than ${SINCE[o.period]}; the losses are in ${lost[0]?.theme.toLowerCase()}.`
        : `${d.name} held its place in AI answers ${OVER[o.period]}.`
    b.lede = {
      text: `${client ? 'We got ' + d.name : 'You’re'} ${client ? 'into' : 'now named on'} ${visible} of the ${d.prompts} tracked prompts${client ? '' : `, up from ${mv.from}`}. The visibility score ${sc.now >= sc.from ? 'rose' : 'fell'} ${Math.abs(sc.now - sc.from)} points to ${sc.now}, and share of voice went from ${pct(me.from)} to ${pct(me.now)}${top && me.now > top.now ? `, ahead of ${top.name} at ${pct(top.now)}` : ''}.${mv.lost ? ` ${mv.lost === 1 ? 'The one loss was' : mv.lost === 2 ? 'Both losses were' : `The ${mv.lost} losses were`} ${lostEng.length === 1 ? `in ${ENGINE_NAMES[lostEng[0][0]]}` : 'spread across engines'}.` : ''}`,
    }
    b.hero = {
      kind: 'grid', title: `All ${d.prompts} prompts, by what moved ${OVER[o.period]}`, total: d.prompts,
      groups: [
        { label: 'Won', n: mv.won, tone: 'you' },
        { label: 'Lost', n: mv.lost, tone: 'against' },
        { label: `Still in the answer`, n: visible - mv.won, tone: 'you-faint' },
        { label: 'Still missing', n: d.prompts - visible - mv.lost, tone: 'none' },
      ],
    }
    b.where = { title: 'Where it moved', groups: [{ label: `Won ${we === 'we' ? 'for ' + d.name : ''}`.trim(), themes: won }, { label: 'Lost', against: true, themes: lost }] }
    b.engines = engineMove(d, o.period, engines)
    b.why = { title: 'Why', items: d.why }
    b.next = { title: client ? 'What we’re doing next' : 'What to do', items: d.actions }
  }

  // the blocks: the template, minus anything without data; a content question leads with what to do
  let order = [...TEMPLATES[o.length]]
  if (t === 'content') order = ['headline', 'lede', 'next', ...order.filter((x) => !['headline', 'lede', 'next'].includes(x))]
  if (o.length === 'one' && b.next) b.next = { ...b.next, items: b.next.items.slice(0, 3) }
  const has = (type) => b[type] && !(b[type].items && !b[type].items.length) && !(b[type].rows && !b[type].rows.length) && !(b[type].groups && !b[type].groups.some((g) => (g.themes ? g.themes.length : g.n)))
  const blocks = order.filter(has).map((type) => ({ id: type, type, data: b[type] }))
  return { ok: true, kind, title: titleFor(prompt, o), opts: o, blocks }
}
function engineMove(d, period, engines) {
  const m = per(d.engines, period) ?? {}
  const rows = engines.filter((e) => m[e]).map((e) => ({ name: ENGINE_NAMES[e], won: m[e][0], lost: m[e][1], now: d.engines.now[e] }))
  return { title: 'By engine', rows }
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
  else if (/\bceo\b|exec|board/.test(q)) { next.audience = 'ceo'; did.push('Rewrote it for the CEO') }
  else if (/\bteam\b/.test(q)) { next.audience = 'team'; did.push('Rewrote it for the team') }
  const add = ENGINE_IDS.filter((e) => q.includes(ENGINE_NAMES[e].toLowerCase()))
  if (add.length && /add|include|with/.test(q)) {
    if (opts.engines.length) next.engines = [...new Set([...opts.engines, ...add])] // "all engines" already includes it
    did.push(`Added ${list(add.map((e) => ENGINE_NAMES[e]))}`)
  }
  const named = d ? d.rivals.filter((r) => q.includes(r.key) || q.includes(brandName(r.domain).toLowerCase().split(' ')[0])) : []
  if (named.length && /focus|only|about|compare/.test(q)) { next.compare = named.slice(0, MAX_COMPARE).map((r) => r.key); did.push(`Focused on ${list(named.map((r) => brandName(r.domain)))}`) }
  if (/this week|weekly/.test(q)) { next.period = 'week'; did.push('Changed the period to this week') }
  else if (/quarter/.test(q)) { next.period = 'quarter'; did.push('Changed the period to the last quarter') }
  return did.length ? { opts: next, change: did.join(' · ') } : null
}

// ---- suggestions (they fill the composer and set the chips they imply) ------------------------------------------
export function suggestionsFor(brandId) {
  const d = dataFor(brandId)
  const top = d?.rivals.find((r) => r.behind > r.ahead) ?? d?.rivals[0]
  const rival = top ? brandName(top.domain).split(' ')[0] : 'a competitor'
  return [
    { id: 'week', text: 'How did we do this week?', sets: { period: 'week', audience: 'team', length: 'one' } },
    { id: 'ceo', text: 'CEO summary: are we winning in AI search?', sets: { audience: 'ceo', length: 'one' } },
    { id: 'rival', text: `Where is ${rival} beating us?`, sets: { compare: top ? [top.key] : [] } },
    { id: 'content', text: 'Which prompts should we write content for next?', sets: { audience: 'team', length: 'detailed' } },
    { id: 'changed', text: 'What changed since last month?', sets: { period: '30d', length: 'detailed' } },
    { id: 'community', text: 'Marketplace and community visibility', sets: {} },
  ]
}

// ---- saved and scheduled reports ---------------------------------------------------------------------------------
export const savedReports = [
  { id: 'r-foa-week', brand: 'foa', prompt: '', title: 'Weekly summary', opts: { brand: 'foa', period: 'week', audience: 'team', length: 'one' }, created: 'Oct 27', saved: true },
  { id: 'r-foa-ceo', brand: 'foa', prompt: 'CEO summary: are we winning in AI search?', opts: { brand: 'foa', period: '30d', audience: 'ceo', length: 'one' }, created: 'Oct 22', saved: true },
  { id: 'r-foa-longbridge', brand: 'foa', prompt: 'Where is Longbridge beating us?', opts: { brand: 'foa', period: '30d', audience: 'team', length: 'detailed', compare: ['longbridge'] }, created: 'Oct 20', saved: false },
  { id: 'r-ds-week', brand: 'dermasuri', prompt: '', title: 'Weekly summary', opts: { brand: 'dermasuri', period: 'week', audience: 'team', length: 'one' }, created: 'Oct 27', saved: true },
  { id: 'r-ds-client', brand: 'dermasuri', prompt: 'Client update: October', opts: { brand: 'dermasuri', period: '30d', audience: 'client', length: 'detailed' }, created: 'Oct 15', saved: false },
  { id: 'r-foa-content', brand: 'foa', prompt: 'Which prompts should we write content for next?', opts: { brand: 'foa', period: 'quarter', audience: 'team', length: 'detailed' }, created: 'Oct 9', saved: false },
].map((r) => ({ ...r, opts: { ...DEFAULT_OPTS, compare: [], engines: [], ...r.opts }, title: r.title || titleFor(r.prompt, r.opts) }))
export const reportById = (id) => savedReports.find((r) => r.id === id) ?? null

export const schedules = [
  { id: 's-foa-week', reportId: 'r-foa-week', title: 'Weekly summary', brand: 'foa', cadence: 'Mondays 9am', recipients: ['Dana Wells', 'Priya Shah'], next: 'Nov 2' },
  { id: 's-foa-ceo', reportId: 'r-foa-ceo', title: 'CEO summary', brand: 'foa', cadence: '1st of the month 8am', recipients: ['Graham Fox'], next: 'Nov 1' },
  { id: 's-ds-client', reportId: 'r-ds-client', title: 'Client update', brand: 'dermasuri', cadence: 'Every other Friday 10am', recipients: ['Mia Chen', 'Leo Park', 'Ana Ruiz'], next: 'Nov 6' },
]

// generating: the steps the page ticks off (counts from the data)
export function stepsFor(o) {
  const d = dataFor(o.brand)
  const n = d ? 1 + (o.compare?.length ? o.compare.length : d.rivals.length) : 0
  const when = { week: 'this week’s', '30d': 'this month’s', quarter: 'this quarter’s', custom: 'the period’s' }[o.period] ?? 'this month’s'
  return [`Reading ${d?.prompts ?? 0} prompts`, `Comparing ${n} brands`, `Checking ${when} wins and gaps`, 'Writing the summary']
}
