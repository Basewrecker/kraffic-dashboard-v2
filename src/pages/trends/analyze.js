// Everything the run detail shows, derived from one run's mentions (API shape in data/mock.js trendRuns[].mentions).

export const CHANNELS = {
  NEWS: { label: 'News', domain: 'news.google.com' },
  X: { label: 'X', domain: 'x.com' },
  INSTAGRAM: { label: 'Instagram', domain: 'instagram.com' },
}
const DAY = 86400000
export const dayOf = (iso) => iso.slice(0, 10)

// display text: drop t.co / trailing links; a news item shows its headline, plus the snippet only when it adds something
const URL_RE = /\s*https?:\/\/\S+/g
export const stripLinks = (s) => (s ?? '').replace(URL_RE, '').trim()
export function displayText(m) {
  if (m.channel === 'NEWS') return m.title
  return stripLinks(m.text)
}
export const snippetOf = (m) => (m.channel === 'NEWS' && m.text && m.text.trim() !== m.title.trim() ? m.text : null)
export const sourceName = (m) => m.handle ?? m.author ?? m.domain
export const sourceKey = (m) => m.handle ?? m.domain

const count = (list, key, values) => Object.fromEntries(values.map((v) => [v, list.filter((m) => m[key] === v).length]))

export function analyze(run, previous) {
  const ms = run.raw.mentions
  const sentiment = count(ms, 'sentiment', ['positive', 'neutral', 'negative'])
  const stance = count(ms, 'stance', ['for', 'neutral', 'against'])

  // daily coverage on a linear date axis: every day from the first mention to the last, empty days kept as 0
  const days = []
  if (ms.length) {
    const t = ms.map((m) => Date.parse(`${dayOf(m.publishedAt)}T00:00:00Z`))
    for (let d = Math.min(...t); d <= Math.max(...t); d += DAY) {
      const key = new Date(d).toISOString().slice(0, 10)
      const list = ms.filter((m) => dayOf(m.publishedAt) === key)
      days.push({ day: key, total: list.length, ...count(list, 'sentiment', ['positive', 'neutral', 'negative']), list })
    }
  }
  const peak = days.reduce((best, d) => (!best || d.total > best.total ? d : best), null)
  const peakDriver = peak && Object.entries(count(peak.list, 'channel', Object.keys(CHANNELS))).sort((a, b) => b[1] - a[1])[0][0]

  const channels = Object.keys(CHANNELS).map((id) => {
    const list = ms.filter((m) => m.channel === id)
    return { id, ...CHANNELS[id], count: list.length, sentiment: count(list, 'sentiment', ['positive', 'neutral', 'negative']) }
  }).filter((c) => c.count > 0).sort((a, b) => b.count - a.count)

  const sources = new Map()
  for (const m of ms) {
    const k = sourceKey(m)
    const s = sources.get(k) ?? { key: k, name: sourceName(m), domain: m.domain, channel: m.channel, count: 0, url: m.handle ? `https://${m.domain}/${m.handle.slice(1)}` : `https://${m.domain}` }
    s.count += 1
    sources.set(k, s)
  }
  const topSources = [...sources.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return {
    total: ms.length, sentiment, stance, days, peak, peakDriver, channels, sources: topSources,
    delta: previous ? ms.length - previous.raw.mentions.length : null,
    previous,
  }
}

// ---- iteration 2: talking points, source leanings, run-to-run comparison
const STANCE_WORD = { for: 'For', neutral: 'No side', against: 'Against' }
// the side most of a list takes ("leans Against"); a tie between For and Against reads No side
export function leanOf(list) {
  const c = count(list, 'stance', ['for', 'neutral', 'against'])
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]
  return top === 'neutral' ? 'neutral' : c.for === c.against ? 'neutral' : top
}
export const leanWord = (k) => STANCE_WORD[k]

const FRACTIONS = [[0.5, 'half'], [1 / 3, 'a third'], [0.25, 'a quarter'], [0.2, 'a fifth']]
export const fractionWord = (share) => (FRACTIONS.find(([f]) => share >= f - 0.01)?.[1] ?? `${Math.round(share * 100)}%`)

export function enrich(run, base, previous) {
  const ms = run.raw.mentions
  // sources with their channel and lean
  const sources = base.sources.map((s) => {
    const list = ms.filter((m) => sourceKey(m) === s.key)
    return { ...s, lean: leanOf(list) }
  })
  const top3 = sources.slice(0, 3).reduce((n, s) => n + s.count, 0)
  // talking points, most-mentioned first (null when the run has none)
  const themes = run.raw.themes
    ? run.raw.themes.map((t) => {
      const list = ms.filter((m) => m.themeKey === t.themeKey)
      const srcs = [...new Map(list.map((m) => [sourceKey(m), m])).values()]
      return { ...t, count: list.length, lean: leanOf(list), logos: srcs.slice(0, 3).map((m) => ({ domain: m.domain, name: sourceName(m) })) }
    }).filter((t) => t.count > 0).sort((a, b) => b.count - a.count).slice(0, 5)
    : null
  // tone × stance matrix
  const matrix = ['positive', 'neutral', 'negative'].map((tone) => ['for', 'neutral', 'against'].map((side) => ms.filter((m) => m.sentiment === tone && m.stance === side).length))
  const avg = base.days.length ? base.total / base.days.length : 0

  let compare = null
  if (previous) {
    const pm = previous.raw.mentions
    const share = (list, key, v) => (list.length ? Math.round((list.filter((m) => m[key] === v).length * 100) / list.length) : 0)
    const tone = ['positive', 'neutral', 'negative'].map((k) => ({ key: k, before: share(pm, 'sentiment', k), after: share(ms, 'sentiment', k) }))
    const stance = ['for', 'neutral', 'against'].map((k) => ({ key: k, before: share(pm, 'stance', k), after: share(ms, 'stance', k) }))
    const prevKeys = new Set(pm.map(sourceKey))
    const newSources = sources.filter((s) => !prevKeys.has(s.key))
    const grew = (run.raw.themes ?? []).map((t) => ({ ...t, before: pm.filter((m) => m.themeKey === t.themeKey).length, after: ms.filter((m) => m.themeKey === t.themeKey).length }))
      .filter((t) => t.after > t.before).sort((a, b) => (b.after - b.before) - (a.after - a.before))
    const neg = tone[2]
    const toneWord = neg.after > neg.before + 2 ? 'more negative' : neg.after < neg.before - 2 ? 'less negative' : 'tone about the same'
    compare = { previous, tone, stance, newSources, grew, toneWord }
  }
  return { ...base, sources, top3Share: base.total ? top3 / base.total : 0, themes, matrix, avg, compare }
}
