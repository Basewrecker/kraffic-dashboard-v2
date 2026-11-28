// The plans catalogue (mock data). In the app this comes from the GEO Packages sheet through GET /api/plans/catalog
// (client-safe fields only): plan names, counts and feature rows are DATA, never fixed copy. No prices anywhere while
// billing isn't live (add-ons read "Add-on").
// A value in a compare row: true (a tick) · null ("—") · a string (bold) · { list: [{ label, engine? | domain? | icon? }] }
// · { text, muted } (a bold word with a regular tail, e.g. "Weekly", ", then daily").
const E = (id, label) => ({ label, engine: id })
const ENG = { chatgpt: E('chatgpt', 'ChatGPT'), aio: E('aio', 'AI Overviews'), aimode: E('aimode', 'AI Mode'), gemini: E('gemini', 'Gemini'), claude: E('claude', 'Claude'), grok: E('grok', 'Grok'), perplexity: { label: 'Perplexity', domain: 'perplexity.ai' } }
const e4 = [ENG.chatgpt, ENG.aio, ENG.aimode, ENG.gemini]
const e5 = [...e4, ENG.claude]
const e7 = [...e5, ENG.grok, ENG.perplexity]
const SOURCES = { list: [
  { label: 'Google Search Console', domain: 'google.com' }, { label: 'Google Analytics 4', domain: 'google.com' }, { label: 'Shopify', domain: 'shopify.com' },
  { label: 'Cloudflare', domain: 'cloudflare.com' }, { label: 'Amazon Ads (upload export)', domain: 'amazon.com' },
  { label: 'Amazon Search Query Performance (upload export)', domain: 'amazon.com' }, { label: 'Any other file', icon: 'file' },
] }
const MARKETS = { list: ['Reddit', 'Quora', 'Amazon', 'Target', 'Walmart'].map((n) => ({ label: n, domain: `${n.toLowerCase()}.com` })) }
const BOTS = { list: [{ label: 'WordPress (plugin)', domain: 'wordpress.org' }, { label: 'Cloudflare', domain: 'cloudflare.com' }, { label: 'Server logs', icon: 'server' }] }
const BOARD = { list: [{ label: 'Slack', domain: 'slack.com' }, { label: 'Email', icon: 'mail' }] }
const daily = { text: 'Weekly', muted: ', then daily' }

// as live (owner, 2026-11-28): "Customized" / "Self-serve" (was "Done for you")
export const GROUPS = [{ id: 'dfy', label: 'Customized' }, { id: 'self', label: 'Self-serve' }]

// rank orders plans for Upgrade / Switch: prompts tracked, then competitors, then logins
export const PLANS = [
  { id: 'visibility', group: 'dfy', name: 'Visibility', prompts: 100, competitors: 3, logins: 2, refresh: 'Weekly refresh', engines: e4, enginesLabel: '4 AI engines', call: 'Monthly scorecard' },
  { id: 'growth', group: 'dfy', name: 'Growth', tag: 'Most chosen', prompts: 200, competitors: 5, logins: 3, refresh: 'Weekly refresh, then daily', engines: e5, enginesLabel: '5 AI engines', call: 'Monthly call' },
  { id: 'authority', group: 'dfy', name: 'Authority', prompts: 300, competitors: 10, logins: 5, refresh: 'Weekly refresh, then daily', engines: e7, enginesLabel: '7 AI engines', call: 'Bi-weekly call' },
  { id: 'enterprise', group: 'dfy', name: 'Enterprise', prompts: 500, promptsPlus: true, competitors: null, logins: null, refresh: 'Weekly refresh, then daily', engines: e7, enginesLabel: 'All AI engines', call: 'Bi-weekly call', custom: true },
  // self-serve: sample names and counts (the mock's own; the app reads them from the sheet)
  { id: 'starter', group: 'self', name: 'Starter', prompts: 25, competitors: 2, logins: 1, refresh: 'Weekly refresh', engines: e4, enginesLabel: '4 AI engines', call: 'Email support' },
  { id: 'plus', group: 'self', name: 'Plus', tag: 'Most chosen', prompts: 50, competitors: 3, logins: 2, refresh: 'Weekly refresh', engines: e4, enginesLabel: '4 AI engines', call: 'Email support' },
  { id: 'pro', group: 'self', name: 'Pro', prompts: 100, competitors: 5, logins: 3, refresh: 'Weekly refresh, then daily', engines: e5, enginesLabel: '5 AI engines', call: 'Email support' },
]

const by = (dfy, self) => ({ visibility: dfy[0], growth: dfy[1], authority: dfy[2], enterprise: dfy[3], starter: self[0], plus: self[1], pro: self[2] })
const all = (v) => by([v, v, v, v], [v, v, v])
const dfyOnly = (v) => by([v, v, v, v], [null, null, null])
export const SECTIONS = [
  { title: 'Tracking', rows: [
    { label: 'Competition level in your category’s AI answers', values: by(['Low', 'Medium', 'High', 'Any'], ['Low', 'Low', 'Medium']) },
    { label: 'Refresh', values: by(['Weekly', daily, daily, daily], ['Weekly', 'Weekly', daily]) },
    { label: 'Competitors tracked (included)', values: by(['3', '5', '10', { plain: 'As agreed' }], ['2', '3', '5']) },
    { label: 'AI engines tracked', values: by([{ list: e4 }, { list: e5 }, { list: e7 }, { list: e7, more: 'and more' }], [{ list: e4 }, { list: e4 }, { list: e5 }]) },
    { label: 'Users login', values: by(['2', '3', '5', null], ['1', '2', '3']) },
  ] },
  { title: 'Integrations', rows: [
    { label: 'Connect your data', sub: 'Sources that feed prompt research', values: all(SOURCES) },
  ] },
  { title: 'Insights', rows: [
    { label: 'AI Visibility', sub: 'Brand AI Visibility Score; Competitors AI Visibility Score; Visible and Missed Prompts; Competitor Share of Voice', values: all(true) },
    { label: 'AI Visibility History', sub: 'Historical Visibility Score; Visibility Trends; Historical Competitor Comparison', values: all(true) },
    { label: 'Share of Voice', sub: 'Overall Share of Voice; Brand Mentions Share; Competitor Share of Voice; Historical SOV', values: all(true) },
    { label: 'Citations & Mentions', sub: 'Total Brand Mentions; Total Website Citations; Citations and Mentions by AI Engine; Cited and Mentioned URLs; Historical Citations and Mentions', values: all(true) },
    { label: 'Marketplace and 3rd Party Citations Visibility', sub: 'Brand Visibility; Product Mentions; Competitors Visibility', values: all(MARKETS) },
    { label: 'Website Citation Coverage', sub: 'Cited Pages by Folder; Most Cited Pages; Citation Distribution by AI Engine', values: all(true) },
    { label: 'Weekly Sync History', sub: 'Newly Gained Prompts; Lost Prompts; Improved and Declining Prompts; New and Lost Citations; New and Lost Mentions', values: all(true) },
    { label: 'Sentiment Analysis', sub: 'Overall brand sentiment score; Weekly sentiment changes; Positive, Neutral and Negative sentiment classification; Sentiment score by AI engine; Historical sentiment tracking; Newly detected negative sentiment', values: all(true) },
    { label: 'Competitors Sentiment Analysis', values: by([null, '1', '3', '5'], [null, null, '1']) },
    { label: 'Fact Check', values: all(true) },
  ] },
  { title: 'GEO work', rows: [
    { label: 'GEO Title Audit', sub: 'Recommended GEO title suggestions; Title duplication analysis; Clarity and descriptive accuracy; Search intent and prompt relevance; Topic and entity inclusion in titles', values: all(true) },
    { label: 'GEO strategy & recommended prompts', values: all(true) },
    { label: 'AI-crawler log from your server (plugin or server access)', values: all(BOTS) },
    { label: 'Staging server: every change tested before it goes live', values: dfyOnly(true) },
    { label: 'Technical GEO fixes (crawler access, llms.txt, entity consistency)', values: by(['Basic', 'Full', 'Full', 'Full'], [null, null, null]) },
    { label: 'Missed prompts content', values: by([{ plain: 'For all AI visibility prompts' }, { plain: 'For all AI visibility prompts' }, { plain: 'For all AI visibility prompts' }, 'Scoped'], [null, null, null]) },
    { label: 'Existing pages optimised / month', values: by([true, true, true, 'Scoped'], [null, null, null]) },
    { label: 'Original data / research page', values: by([null, { text: '1', muted: ' per 6 months' }, { text: '2', muted: ' per 6 months' }, 'Scoped'], [null, null, null]) },
  ] },
  { title: 'Service', rows: [
    { label: 'Weekly evidence board (Slack + email): named · cited · not yet, per engine', values: dfyOnly(BOARD) },
    { label: 'Review call', values: by(['Monthly scorecard', 'Monthly call', 'Bi-weekly call', 'Bi-weekly call'], [null, null, null]) },
    { label: 'Included engineering hours per month', values: by(['10', '20', '30', null], [null, null, null]) },
  ] },
  { title: 'Add-ons', rows: [
    { label: 'Citation PR · Digital PR · extra content · extra competitors', values: all('Add-on') },
    { label: 'Additional prompts packages (additional 100)', values: by(['Add-on', 'Add-on', 'Add-on', 'Custom'], ['Add-on', 'Add-on', 'Add-on']) },
    { label: 'Additional competitors (per competitor)', values: by(['Add-on', 'Add-on', 'Add-on', 'Custom'], ['Add-on', 'Add-on', 'Add-on']) },
  ] },
  { title: 'Other', rows: [
    { label: 'Auden Agents', values: all(true) },
  ] },
]
export const FOOT_NOTE = 'No guaranteed placements or AI rankings. We commit to the work and the reporting above; how AI assistants answer is decided by them and can change from one week to the next.'

// clients shown in the "Trusted by" strip (the brand being viewed is left out). darkTile: a near-black logo tile gets a
// 1px hairline in dark mode so it doesn't vanish
export const TRUSTED = [
  { name: 'Eco Pet Kind', domain: 'ecopetkind.com' }, { name: 'ASAP Tickets', domain: 'asaptickets.com' },
  { name: 'Skylux Travel', domain: 'skyluxtravel.com' }, { name: 'Dermasuri', domain: 'dermasuri.com', darkTile: true },
]

const rank = (p) => [p.promptsPlus ? Infinity : p.prompts, p.competitors ?? Infinity, p.logins ?? Infinity]
const cmp = (a, b) => { const x = rank(a), y = rank(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1; return 0 }
// the button on a plan's card, never by price: "Current plan"; "Talk to us" (Enterprise, or an account with no package
// of its own); "Upgrade" / "Switch" by prompts tracked, then competitors, then logins
export function planAction(plan, current) {
  if (current && plan.id === current.id) return 'Current plan'
  if (!current || plan.custom) return 'Talk to us'
  return cmp(plan, current) > 0 ? 'Upgrade' : 'Switch'
}
const plus = (n, word) => (n == null || n === 0 ? null : `${n > 0 ? '+' : '−'}${Math.abs(n)} ${word}${Math.abs(n) === 1 ? '' : 's'}`)
// the muted note under a card's hairline: how the plan differs from yours, or "Your plan"
export function planNote(plan, current) {
  if (!current) return ''
  if (plan.id === current.id) return 'Your plan'
  if (plan.custom) return 'Custom limits, agreed with you'
  return [plus(plan.prompts - current.prompts, 'prompt'), plus((plan.competitors ?? 0) - current.competitors, 'competitor'), plus((plan.logins ?? 0) - current.logins, 'login')].filter(Boolean).join(' · ')
}
