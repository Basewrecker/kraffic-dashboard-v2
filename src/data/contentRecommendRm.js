// One content-recommend sample from a live run (Harsh's Create content drawer, 2026-11-03), kept as a fixture: the
// reverse-mortgage draft. Its CONTENT and shape are the live output; the brand and the competitor hosts are renamed
// (Harborline Home Lending is made up; so are keystonereverse.com, maplewayreverse.com, reverseloans.co and the other
// private sites). hud.gov and consumerfinance.gov stay: they're public reference pages, not client data.
// Opened at /opportunities/content/rm-1 (a separate made-up account; the skincare list is untouched).
export const RM_BRAND = { name: 'Harborline Home Lending', domain: 'harborlinehome.com' }
// the account's tracked competitors (competitor settings): display names, never made from the domain
export const RM_COMPETITOR_NAMES = {
  'keystonereverse.com': 'Keystone Reverse',
  'maplewayreverse.com': 'Mapleway Reverse',
  'reverseloans.co': 'ReverseLoans',
}
const PROMPT = 'How does a reverse mortgage line of credit grow over time?'
const CREATE_PATH = '/guides/how-does-a-reverse-mortgage-line-of-credit-grow-over-time'
const CREATE_URL = `https://${RM_BRAND.domain}${CREATE_PATH}`

// the missed-prompt row the request is built from (data/mock.js missedPrompts shape)
export const RM_ROW = {
  id: 'rm-1',
  prompt: PROMPT,
  platforms: ['google', 'chatgpt'],
  competitors: Object.keys(RM_COMPETITOR_NAMES),
  sources: [
    { domain: 'keystonereverse.com', path: '/blog/reverse-mortgages/how-reverse-mortgages-offer-a-lifeline-in-high-interest-environments/' },
    { domain: 'maplewayreverse.com', path: '/blog/harnessing-the-power-of-the-hecm-line-of-credit/' },
    { domain: 'reverseloans.co', path: '/lump-sum-vs-line-of-credit' },
    { domain: 'retireplanforum.org', path: '/forum/viewtopic.php?t=415118' },
  ],
  brandsMentioned: [],
}

const cited = [
  { url: 'https://www.retireplanforum.org/forum/viewtopic.php?t=415118', host: 'retireplanforum.org', rank: 1, engines: ['google', 'ai'], aiCited: true, formats: [], isOurs: false, title: 'HECM line of credit growth: worth opening early?' },
  { url: 'https://keystonereverse.com/blog/reverse-mortgages/how-reverse-mortgages-offer-a-lifeline-in-high-interest-environments/', host: 'keystonereverse.com', rank: 2, engines: ['google', 'ai'], aiCited: true, formats: ['listicle', 'how_to'], isOurs: false, title: 'How reverse mortgages offer a lifeline in high-interest environments' },
  { url: 'https://maplewayreverse.com/blog/harnessing-the-power-of-the-hecm-line-of-credit/', host: 'maplewayreverse.com', rank: 3, engines: ['google', 'ai'], aiCited: true, formats: ['comparison'], isOurs: false, title: 'Harnessing the power of the HECM line of credit' },
  { url: 'https://reverseloans.co/lump-sum-vs-line-of-credit', host: 'reverseloans.co', rank: 4, engines: ['google', 'ai'], aiCited: true, formats: ['faq', 'comparison', 'stats'], isOurs: false, title: 'Lump sum vs line of credit' },
  { url: 'https://www.brightwatermortgage.com/blog/mortgage-basics/2023/04/reverse-mortgage-line-credit', host: 'brightwatermortgage.com', rank: 5, engines: ['google', 'ai'], aiCited: true, formats: [], isOurs: false, title: 'Reverse mortgage line of credit basics' },
  { url: 'https://rmwlending.com/learn/reverse-mortgage-line-of-credit', host: 'rmwlending.com', rank: 6, engines: ['google'], aiCited: false, formats: ['listicle', 'how_to', 'faq'], isOurs: false, title: 'Reverse mortgage line of credit: how it works' },
  { url: 'https://moneydesk.com/reverse-mortgage-line-of-credit/', host: 'moneydesk.com', rank: 7, engines: ['google'], aiCited: false, formats: ['listicle', 'how_to', 'comparison'], isOurs: false, title: 'What is a reverse mortgage line of credit?' },
  { url: 'https://reversecoach.org/line-of-credit-growth', host: 'reversecoach.org', rank: null, engines: ['ai'], aiCited: true, formats: ['how_to', 'faq', 'comparison', 'stats'], isOurs: false, title: 'Line of credit growth, explained' },
]
const u = (host, rank, aiCited, who, add) => ({ url: cited.find((c) => c.host === host).url, host, rank, aiCited, who, add })
const formats = [
  { id: 'how_to', label: 'How-to guide', score: 24, base: 3, onPage1: true, needed: true, usages: [u('keystonereverse.com', 2, true, 4, 12), u('rmwlending.com', 6, false, 1, 3), u('moneydesk.com', 7, false, 1, 3), u('reversecoach.org', null, true, 2, 6)] },
  { id: 'comparison', label: 'Comparison / vs', score: 20, base: 2, onPage1: true, needed: true, usages: [u('maplewayreverse.com', 3, true, 4, 8), u('reverseloans.co', 4, true, 3, 6), u('moneydesk.com', 7, false, 1, 2), u('reversecoach.org', null, true, 2, 4)] },
  { id: 'faq', label: 'FAQ', score: 18, base: 3, onPage1: true, needed: true, usages: [u('reverseloans.co', 4, true, 3, 9), u('rmwlending.com', 6, false, 1, 3), u('reversecoach.org', null, true, 2, 6)] },
  { id: 'listicle', label: 'Best-of / listicle', score: 12, base: 2, onPage1: true, needed: true, usages: [u('keystonereverse.com', 2, true, 4, 8), u('rmwlending.com', 6, false, 1, 2), u('moneydesk.com', 7, false, 1, 2)] },
  { id: 'stats', label: 'Statistical roundup', score: 10, base: 2, onPage1: true, needed: true, usages: [u('reverseloans.co', 4, true, 3, 6), u('reversecoach.org', null, true, 2, 4)] },
]
const why = (id) => formats.find((f) => f.id === id).usages.slice(0, 3).map((x) => `${x.host}${x.rank ? ` (#${x.rank})` : ''}${x.aiCited ? ' · AI' : ''}`).join(', ')
const evidence = cited.slice(0, 5).map(({ url, host, rank, aiCited, formats: f, title }) => ({ url, host, rank, aiCited, formats: f, title }))
const pageRecommendation = {
  action: 'create',
  suggestedPath: CREATE_PATH,
  suggestedUrl: CREATE_URL,
  url: CREATE_URL,
  slug: CREATE_PATH.slice(1),
  evidence,
  reason: `That path currently redirects to the homepage — create a real ${CREATE_PATH} page for this prompt.`,
}
const flags = [
  { id: 'expert_review', label: 'Expert review', status: 'required', score: 10, text: 'A qualified reviewer must check every tax, legal, and/or medical statement before publishing.' },
  { id: 'locations', label: 'Missing brand info', status: 'missing', score: 6, text: 'Confirm office locations before publishing any location claim.' },
  { id: 'fees', label: 'Needs verification', status: 'partial', score: 5, text: 'Confirm fee language or how quotes are given. Do not invent prices.' },
  { id: 'reviews', label: 'Needs verification', status: 'partial', score: 5, text: 'Do not add client names, reviews, or statistics unless the team supplies them with permission.' },
  { id: 'issue_4', label: 'Draft gap', status: 'missing', score: 3, text: 'Competitor “keystonereverse.com” appears in the draft — remove from publishable content.' },
  { id: 'issue_5', label: 'Draft gap', status: 'missing', score: 3, text: 'Competitor “maplewayreverse.com” appears in the draft — remove from publishable content.' },
  { id: 'issue_6', label: 'Draft gap', status: 'missing', score: 3, text: 'Competitor “reverseloans.co” appears in the draft — remove from publishable content.' },
]
const issues = flags.filter((f) => f.label === 'Draft gap').map((f) => f.text)

const markdown = `# ${PROMPT}

> **Draft for client review** — verify fees, sources, and claims before publishing.

## Page recommendation

- **Create:** ${CREATE_URL}
- **Why:** ${pageRecommendation.reason}
${evidence.map((e) => `- Page-1 evidence (#${e.rank}): ${e.url}${e.formats.length ? ` — ${e.formats.join(', ')}` : ''}`).join('\n')}

## Direct answer

The unused part of a HECM line of credit grows each month at the loan’s interest rate plus the annual mortgage insurance rate, so your available funds go up.

## Key points

- Only the unused balance grows. Money you have already drawn adds to your loan balance. It does not add to your available credit.
- Growth follows your loan’s rate. Each month, the unused line grows at the current interest rate plus the annual mortgage insurance premium. If rates go up, the line grows faster.
- Growth isn’t earnings. It’s more room to borrow, not cash in an account. You only owe interest on money you actually draw.
- Opening early can help. Opening a line of credit sooner and leaving it alone gives it more years to grow before you need it.
- Your obligations still apply. You must live in the home as your main residence, pay property taxes and homeowners insurance, and keep the home in good repair.
- Confirm with your team: which ${RM_BRAND.name} reverse mortgage products include a growing line of credit, and current rates and fees.

## Detailed explanation

A Home Equity Conversion Mortgage (HECM) is the federally insured reverse mortgage. With an adjustable-rate HECM you can take your money as a line of credit, in monthly payments, as a lump sum, or as a mix of these. The line of credit has a feature most loans don’t: the part you haven’t used gets bigger over time.

Here’s how it works. Each month, the lender works out a growth rate equal to your loan’s current interest rate plus the annual mortgage insurance premium. Your unused credit grows by that rate. The growth compounds, so each month’s increase is figured on a slightly larger number than the month before.

A hypothetical example, not a quote: suppose you have $100,000 unused and the combined growth rate stays at 6.5% a year. After 12 months, your available credit would be about $106,700. After 10 years at the same rate, it would be about $191,000. Real rates change, so actual results will be different.

Two things to understand. First, when you draw money, it stops growing as available credit and starts building interest as loan balance. Second, if you repay part of the balance, that amount goes back into your line of credit, where it can grow again.

People often use a growing line of credit as a backup fund. It can cover a market downturn so you don’t have to sell investments at a loss. It can also cover future care costs or large home repairs.

## Steps

1. Check that you qualify. HECM borrowers must be at least 62, own the home outright or have a lot of equity in it, and live there as their main residence. Confirm with your team: the current eligibility rules and which property types are accepted.

2. Complete HUD-approved counseling. Federal rules require an independent counseling session before you apply. Counselors explain costs, alternatives, and your obligations.

3. Choose an adjustable-rate HECM with a line of credit. Fixed-rate HECMs usually pay out as a single lump sum, so they don’t come with a growing line of credit. Ask your loan officer to show the line of credit option side by side with the others.

4. Plan your first-year draws. Federal rules limit how much you can take in the first 12 months, with some exceptions for paying off required debts. Draw only what you need so the rest can grow.

5. Leave unused credit alone. The longer the money stays undrawn, the more your available credit can grow.

6. Review your statements every year. Check your available credit, current rate, and loan balance. Keep paying taxes and insurance so the loan stays in good standing.

## Line of credit vs. other ways to get your money

**HECM line of credit**

- Growth: the unused balance grows over time
- Flexibility: draw any amount, whenever you need it
- Repayment: no required monthly mortgage payments while you meet the loan’s obligations
- Best for: a backup fund or costs you expect later

**Lump sum**

- Growth: none, because you take all the money at closing
- Flexibility: you get it all up front
- Repayment: interest starts on the full amount right away
- Best for: paying off an existing mortgage or a single large expense

**Monthly payments (tenure or term)**

- Growth: not a growing pool of credit
- Flexibility: a fixed amount arrives each month
- Repayment: your balance grows as payments are made
- Best for: steady income on top of other retirement income

**Traditional home equity line of credit (HELOC)**

- Growth: none; the credit limit doesn’t grow
- Flexibility: the lender can freeze or reduce the line, and the draw period ends
- Repayment: monthly payments are usually required
- Best for: borrowers under 62, or anyone who can make monthly payments

## FAQ

### How does a reverse mortgage line of credit grow over time?

Each month, the unused part of a HECM line of credit grows at the loan’s current interest rate plus the annual mortgage insurance premium. Because the growth compounds, an untouched line can get much bigger over the years. Money you have already drawn doesn’t count toward that growth.

### Does the line of credit grow if interest rates go up?

Yes. The growth rate is tied to the loan’s interest rate, so on an adjustable-rate HECM the line grows faster when rates rise and slower when they fall. Rising rates also make interest build up faster on any balance you’ve drawn, so it’s worth weighing both effects before you take money out.

### Can the lender freeze or reduce my reverse mortgage line of credit?

Under federal HECM rules, the lender can’t freeze or reduce your line of credit because home values drop or the economy changes, as long as you meet the loan’s terms. Those terms include living in the home, paying property taxes and insurance, and keeping the home in good repair. Confirm with your team: how this is explained in your loan documents.

### Is the growth taxable income?

The growth only adds to how much you can borrow, so it’s generally not treated as income. Money you draw from a reverse mortgage is usually considered loan proceeds, not earnings. Tax situations differ, so talk with a tax professional before you rely on this for planning.

### What happens to the line of credit when the borrower dies or moves out?

The loan generally comes due when the last borrower dies, sells the home, or moves out permanently. Any unused credit can no longer be drawn. Heirs can repay the loan and keep the home, or sell it. Because HECMs are non-recourse loans, they generally won’t owe more than the home is worth.

## Sources

- HUD, Home Equity Conversion Mortgage program overview: https://www.hud.gov/program_offices/housing/sfh/hecm/hecmhome (flag for expert review)
- Consumer Financial Protection Bureau, reverse mortgage guide: https://www.consumerfinance.gov/consumer-tools/reverse-mortgages/
- Investor forum discussion of HECM line of credit growth: ${cited[0].url}
- Article on reverse mortgages when interest rates are high: ${cited[1].url}
- Article on using the HECM line of credit: ${cited[2].url}
- Comparison of lump sum and line of credit: ${cited[3].url}
- Reverse mortgage line of credit basics: ${cited[4].url}
- recommended new page — ${CREATE_URL}

## Flags

${flags.map((f) => `- **[${f.label}]** (score ${f.score}) — ${f.text}`).join('\n')}
`

export const RM_RESPONSE = {
  ok: true,
  analyzedAt: '2026-11-03T20:03:28.000Z',
  brandDomain: RM_BRAND.domain,
  brandName: RM_BRAND.name,
  prompt: PROMPT,
  coverage: 'covered',
  ourFormats: ['faq', 'listicle'],
  formats,
  recommendations: [
    { id: 'how_to', label: 'How-to guide', score: 24, status: 'missing', why: why('how_to') },
    { id: 'comparison', label: 'Comparison / vs', score: 20, status: 'missing', why: why('comparison') },
    { id: 'stats', label: 'Statistical roundup', score: 10, status: 'missing', why: why('stats') },
    { id: 'faq', label: 'FAQ', score: 18, status: 'covered', why: why('faq') },
    { id: 'listicle', label: 'Best-of / listicle', score: 12, status: 'covered', why: why('listicle') },
  ],
  angles: [
    `Create ${CREATE_PATH} on ${RM_BRAND.domain}`,
    `Publish a how-to guide (score 24) — used by ${why('how_to')}, and you do not cover this format yet.`,
    `Publish a comparison / vs (score 20) — used by ${why('comparison')}, and you do not cover this format yet.`,
    `Publish a statistical roundup (score 10) — used by ${why('stats')}, and you do not cover this format yet.`,
  ],
  citedPages: cited,
  pageRecommendation,
  evidence,
  contentMarkdown: markdown,
  contentSource: 'claude',
  contentComplete: false,
  contentIssues: issues,
  expertReview: true,
  brandFactsAvailable: true,
  flags,
  reviewScore: { done: 0, total: flags.reduce((s, f) => s + f.score, 0), remaining: flags.reduce((s, f) => s + f.score, 0) },
}
