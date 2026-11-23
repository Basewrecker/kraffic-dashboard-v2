// The notification feed (mock): every item is built from data the pages already load — no new scans, no AI wording.
//   data     the same scan-to-scan comparisons as "What changed" (whatChanged/*.js build('scan')), with its noise
//            rules; one scan's changes on one page are one item ("Scan Oct 5: 5 changes") that expands
//   system   scans finished or failed, a connection that needs the user, from the pages' own data
//   update   PRODUCT_UPDATES (updates.js)
// Item: { id, kind, type (the settings switch it answers to: samples.js TYPES), at (ISO), page, mark, text (segments), delta?,
//   href, action?, urgent?, children?, weight }
// Read state is per user and brand (store.js); the server would keep it the same way.
import { overview } from '../whatChanged/overview.js'
import { sentiment } from '../whatChanged/sentiment.js'
import { trends } from '../whatChanged/trends.js'
import { content } from '../whatChanged/content.js'
import { auditChanges } from '../whatChanged/audit.js'
import { structured } from '../whatChanged/structured.js'
import { B, fmtDay, plural } from '../whatChanged/util.js'
import { RUNS, runPages } from '../data/sentiment.js'
import { syncHistory, trendRuns } from '../data/mock.js'
import { ENGINES, FAILED_SCANS, OWN } from '../data/brandViews.js'
import { PRODUCT_UPDATES } from './updates.js'
import { SAMPLE_ITEMS } from './samples.js'

// the mock's "now": the latest thing any page knows about (Sentiment's analysis of Nov 3)
export const NOW = '2026-11-03T18:00:00Z'

const SOURCES = [
  { config: overview, type: 'score', href: '/overview', mark: { domain: OWN.domain } },
  { config: sentiment, type: 'sentiment', href: '/sentiment', mark: { domain: OWN.domain } },
  { config: trends, type: 'mentions', href: '/trends', mark: { domain: 'news.google.com' } },
  { config: content, type: 'content', href: '/opportunities/content', mark: { domain: OWN.domain } },
  { config: auditChanges(), type: 'audit', href: '/audit', mark: { domain: OWN.domain } },
  { config: structured, type: 'structured', href: '/structured-data', mark: { domain: OWN.domain } },
]
const signed = (d) => (d ? `${d.up ? '+' : '−'}${d.text}` : null)

// one page's last scan → one item, or one per change when there's only one
function dataItems() {
  const out = []
  for (const s of SOURCES) {
    const d = s.config.build('scan')
    if (d.state !== 'changed') continue
    const at = d.latestIso.length === 10 ? `${d.latestIso}T09:00:00Z` : d.latestIso
    const changes = []
    if (!d.flat && d.trigger?.delta) {
      changes.push({ id: 'headline', mark: s.mark, text: d.headline.map((x, i) => (i === d.headline.length - 1 && typeof x === 'string' ? x.replace(/\.$/, '') : x)), delta: { text: signed(d.trigger.delta), good: d.trigger.delta.good }, weight: 50 })
    }
    for (const l of d.lists ?? []) for (const r of l.rows) {
      if (!r.delta || r.delta.flat) continue
      changes.push({ id: r.id, mark: r.mark ?? s.mark, text: r.text, delta: r.delta, weight: 10 })
    }
    if (!changes.length) continue
    const href = `${s.href}${s.href.includes('?') ? '&' : '?'}changes=scan`
    const base = { kind: 'data', type: s.type, at, page: s.config.title, href, action: 'What changed' }
    if (changes.length === 1) out.push({ ...base, ...changes[0], id: `data:${s.config.page}:${d.latestIso}` })
    else {
      out.push({
        ...base, id: `data:${s.config.page}:${d.latestIso}`, mark: changes[0].mark,
        text: [B(`Scan ${fmtDay(d.latestIso)}`), ` · ${plural(changes.length, 'change')} on ${s.config.title}`],
        delta: changes[0].delta, children: changes, weight: changes[0].weight + changes.length,
      })
    }
  }
  // Sentiment: sources that turned negative or back at earlier analyses (each pair of runs, newest first; the latest
  // pair is already above)
  const runs = [...RUNS].reverse()
  for (let i = 1; i < runs.length - 1; i++) {
    const now = runPages(null, null, runs[i].id), before = new Map(runPages(null, null, runs[i + 1].id).map((p) => [p.url, p]))
    const flips = []
    for (const p of now) {
      const b = before.get(p.url)
      if (!b || b.tone === p.tone || ![p.tone, b.tone].includes('negative')) continue
      const worse = p.tone === 'negative'
      flips.push({
        id: p.url, mark: { domain: p.domain }, text: [B(p.domain), ' turned ', B(p.tone), ` (was ${b.tone})`],
        delta: { text: worse ? 'Negative' : p.tone[0].toUpperCase() + p.tone.slice(1), good: !worse }, weight: worse ? 40 : 15,
      })
    }
    if (!flips.length) continue
    flips.sort((a, b) => b.weight - a.weight)
    const base = { id: `data:sentiment:${runs[i].date}`, kind: 'data', type: 'sentiment', at: `${runs[i].date}T09:00:00Z`, page: 'Sentiment', href: '/sentiment?changes=scan', action: 'What changed' }
    out.push(flips.length === 1 ? { ...base, ...flips[0], id: base.id } : {
      ...base, mark: flips[0].mark, delta: flips[0].delta, children: flips, weight: flips[0].weight + flips.length,
      text: [B(`Scan ${fmtDay(runs[i].date)}`), ` · ${plural(flips.length, 'change')} on Sentiment`],
    })
  }
  return out
}

function systemItems() {
  const out = []
  const last = syncHistory[0]
  const lastIso = new Date(Date.parse(`${last.date} UTC`)).toISOString().slice(0, 10)
  out.push({ id: `sys:scan:${lastIso}`, kind: 'system', type: 'scan', icon: 'done', at: `${lastIso}T08:00:00Z`, page: 'Visibility Overview', text: [B('Scan finished'), ` · ${plural(last.total, 'prompt')} on ${ENGINES.length} engines`], href: '/overview', weight: 2 })
  for (const [engine, days] of Object.entries(FAILED_SCANS)) for (const day of days) {
    const name = ENGINES.find((e) => e.id === engine)?.name ?? engine
    out.push({ id: `sys:engine:${engine}:${day}`, kind: 'system', type: 'scan-skipped', icon: 'warn', at: `${day}T08:00:00Z`, page: 'Visibility Overview', text: [B(`${name} didn’t answer`), ` in the scan of ${fmtDay(day)}. Its numbers that day are left out.`], href: '/overview', weight: 3 })
  }
  for (const r of trendRuns.filter((x) => x.status === 'FAILED')) {
    out.push({ id: `sys:trend:${r.id}`, kind: 'system', type: 'run-failed', icon: 'warn', at: r.startedAt, page: 'Trends', text: [B(`“${r.query}”`), ' didn’t finish'], href: '/trends', action: 'Run again', weight: 4 })
  }
  const latestRun = RUNS.at(-1)
  out.push({ id: `sys:sentiment:${latestRun.id}`, kind: 'system', type: 'scan', icon: 'done', at: latestRun.createdAt, page: 'Sentiment', text: [B('Sentiment analysis finished'), ` · ${plural(runPages(null, null, latestRun.id).length, 'source')}`], href: '/sentiment', weight: 2 })
  // a connection the user has to fix: red, with the action
  out.push({ id: 'sys:gsc:2026-11-02', kind: 'system', type: 'connection', icon: 'urgent', urgent: true, at: '2026-11-02T14:00:00Z', page: 'Site Kit', text: [B('Search Console disconnected'), '. Google clicks stop updating until you reconnect it'], href: '/more-tools/site-kit?mock=expired', action: 'Reconnect', weight: 100 })
  return out
}

const updateItems = () => PRODUCT_UPDATES.map((u) => ({
  id: `update:${u.id}`, kind: 'update', type: 'update', at: `${u.date}T12:00:00Z`, page: 'Product update', text: [B(u.title), ` · ${u.body.replace(/\.$/, '')}`], href: u.href, action: 'Open', isNew: true, weight: 5,
}))

let cache = null
export function feed() {
  if (new URLSearchParams(window.location.search).get('nc') === 'empty') return []
  cache ??= [...dataItems(), ...systemItems(), ...SAMPLE_ITEMS, ...updateItems()].sort((a, b) => b.at.localeCompare(a.at))
  return cache
}

// "Today", "Yesterday", "Oct 20" (against the mock's now)
export function dayLabel(iso) {
  const day = iso.slice(0, 10), today = NOW.slice(0, 10)
  const y = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000).toISOString().slice(0, 10)
  return day === today ? 'Today' : day === y ? 'Yesterday' : fmtDay(day)
}
export const KINDS = [{ value: 'all', label: 'All' }, { value: 'data', label: 'Data' }, { value: 'system', label: 'System' }, { value: 'update', label: 'Updates' }]
