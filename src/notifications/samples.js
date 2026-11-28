// ============================================================================================================
// MOCK DATA ONLY — sample notifications, not produced by any scan or event. Do not port these items to the app.
// ============================================================================================================
// They show the notification types the mock's data can't produce on its own yet (design: owner, 2026-11-20). Same item
// shape as feed.js; every item links to the page that shows it. Prompts, pages and brands are the mock's own. In the
// app these come from the same scan-to-scan comparisons as What changed (data alerts) and the app's own events
// (system alerts). TYPES below (the settings screen's switches) is real: port it.
import { B } from '../whatChanged/util.js'
import { missedPrompts, visiblePrompts } from '../data/mock.js'

const p = (id) => visiblePrompts[id].prompt
const m = (id) => missedPrompts[id].prompt

export const SAMPLE_ITEMS = [
  // ---- data
  { id: 'sample:rival-pass:gemini', type: 'rival-pass', kind: 'data', at: '2026-11-03T09:00:00Z', page: 'Benchmarking', mark: { engine: 'gemini', domain: 'cerave.com' },
    text: [B('CeraVe'), ' passed you on ', B('Gemini'), ', now ', B('#1')], delta: { text: '−1 place', good: false }, href: '/benchmarking?changes=scan', action: 'Summary', weight: 60 },
  { id: 'sample:you-pass:chatgpt', type: 'rival-pass', kind: 'data', at: '2026-10-20T09:00:00Z', page: 'Benchmarking', mark: { engine: 'chatgpt', domain: 'theordinary.com' },
    text: ['You passed ', B('The Ordinary'), ' on ', B('ChatGPT'), ', now ', B('#2')], delta: { text: '+1 place', good: true }, href: '/benchmarking?changes=scan', action: 'Summary', weight: 30 },
  { id: 'sample:named:chatgpt', type: 'prompt-named', kind: 'data', at: '2026-11-02T09:00:00Z', page: 'Prompt Hub', mark: { engine: 'chatgpt' },
    text: [B('ChatGPT'), ' started naming you for ', B(`“${p(0)}”`)], delta: { text: 'Named', good: true }, href: '/tracker', weight: 25 },
  { id: 'sample:dropped:gemini', type: 'prompt-named', kind: 'data', at: '2026-11-02T09:00:00Z', page: 'Prompt Hub', mark: { engine: 'gemini' },
    text: [B('Gemini'), ' stopped naming you for ', B(`“${p(2)}”`)], delta: { text: 'Dropped', good: false }, href: '/tracker', weight: 35 },
  { id: 'sample:new-brand:laroche', type: 'new-brand', kind: 'data', at: '2026-11-03T09:00:00Z', page: 'Brand Setup', mark: { domain: 'laroche-posay.us' },
    text: [B('La Roche-Posay'), ' appeared in ', B('6 answers'), ' this scan'], href: '/brands', cta: 'Track as competitor', weight: 28 },
  { id: 'sample:cited:vitc', type: 'citation', kind: 'data', at: '2026-10-30T09:00:00Z', page: 'Citations', mark: { engine: 'aio' },
    text: [B('/products/vitamin-c-serum'), ' newly cited by ', B('Google AI Overview')], delta: { text: 'Cited', good: true }, href: '/citations', weight: 20 },
  { id: 'sample:uncited:retinol', type: 'citation', kind: 'data', at: '2026-10-30T09:00:00Z', page: 'Citations', mark: { engine: 'claude' },
    text: [B('/blog/retinol-for-beginners'), ' lost its citation on ', B('Claude')], delta: { text: 'Lost', good: false }, href: '/citations', weight: 22 },
  { id: 'sample:first-cited:barrier', type: 'first-cited', kind: 'data', at: '2026-11-02T10:00:00Z', page: 'Content', mark: { engine: 'chatgpt' },
    text: ['Your page for ', B(`“${m(5)}”`), ' was cited for the first time, by ', B('ChatGPT')], delta: { text: 'First citation', good: true }, href: '/opportunities/content/5', weight: 32 },
  { id: 'sample:fact-wrong:price', type: 'fact', kind: 'data', at: '2026-11-03T11:00:00Z', page: 'Fact Check', mark: { engine: 'gemini' },
    text: [B('Gemini'), ' says your vitamin C serum costs ', B('$32'), '; your site says ', B('$28')], delta: { text: 'Wrong fact', good: false }, href: '/website-facts', weight: 45 },
  { id: 'sample:fact-fixed:returns', type: 'fact', kind: 'data', at: '2026-10-20T11:00:00Z', page: 'Fact Check', mark: { engine: 'claude' },
    text: [B('Claude'), ' now has your ', B('return policy'), ' right'], delta: { text: 'Fixed', good: true }, href: '/website-facts', weight: 18 },
  { id: 'sample:rising:rosacea', type: 'rising-search', kind: 'data', at: '2026-11-01T09:00:00Z', page: 'Trends', mark: { domain: 'google.com' },
    text: [B('“mineral sunscreen for rosacea”'), ' is rising fast on Google and you don’t track it'], delta: { text: '+180%', good: null }, href: '/tracker', cta: 'Track this prompt', weight: 26 },
  // ---- system
  { id: 'sample:report:benchmark-oct', type: 'report-ready', kind: 'system', icon: 'done', at: '2026-11-01T07:00:00Z', page: 'All reports',
    text: [B('Benchmark report ready'), ' · October, you against 3 competitors'], href: '/reports/all', action: 'Open', weight: 8 },
  { id: 'sample:draft-waiting:7', type: 'draft-waiting', kind: 'system', icon: 'warn', at: '2026-11-03T07:00:00Z', page: 'Content',
    text: ['Your draft for ', B(`“${m(7)}”`), ' has waited ', B('9 days'), ' for review'], href: '/opportunities/content/7', action: 'Review draft', weight: 12 },
  { id: 'sample:limit:prompts', type: 'limit', kind: 'system', icon: 'warn', at: '2026-10-30T07:00:00Z', page: 'Billing',
    text: [B('180 of 200 prompts'), ' used on your plan'], href: '/plans', action: 'See plan', weight: 10 },
  { id: 'sample:skipped:claude', type: 'scan-skipped', kind: 'system', icon: 'warn', at: '2026-10-28T08:00:00Z', page: 'Tracking',
    text: [B('Claude was down'), ', so its part of the Oct 28 scan was skipped. It runs again in the next scan'], href: '/tracking', weight: 9 },
  { id: 'sample:getting-started', type: 'getting-started', kind: 'system', icon: 'done', at: '2026-11-03T06:00:00Z', page: 'Getting started',
    text: [B('3 Getting started steps'), ' left'], href: '/overview', action: 'Continue', weight: 6 },
]

// every type, by kind, for the settings screen's switches
export const TYPES = {
  data: [
    ['score', 'Visibility score moved'],
    ['rival-pass', 'A competitor passed you, or you passed one'],
    ['prompt-named', 'AI started or stopped naming you for a prompt'],
    ['new-brand', 'A new brand appears in answers'],
    ['citation', 'A page was newly cited or lost a citation'],
    ['first-cited', 'Your published page was cited for the first time'],
    ['sentiment', 'A source changed tone'],
    ['fact', 'A wrong fact was found or fixed'],
    ['rising-search', 'A fast-rising Google search you don’t track'],
    ['mentions', 'Trends mentions moved'],
    ['content', 'Content pages named by AI changed'],
    ['audit', 'Site Audit score moved'],
    ['structured', 'Structured data changed'],
  ],
  system: [
    ['scan', 'A scan or analysis finished'],
    ['scan-skipped', 'A scan was skipped or an engine didn’t answer'],
    ['connection', 'A connection needs you'],
    ['report-ready', 'A report is ready'],
    ['draft-waiting', 'A draft has waited 7 days or more'],
    ['limit', 'You’re near a plan limit'],
    ['getting-started', 'Getting started steps are left'],
    ['run-failed', 'A Trends run didn’t finish'],
  ],
  update: [['update', 'New features we ship']],
}
