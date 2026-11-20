// Trends' "What changed": mentions found by the page's runs (news, X, Instagram), their tone, sources and talking
// points. Last scan: the latest finished run against the run before it of the same question. 30 / 90 days: the
// mentions published in that window against the window before (each mention once, however many runs found it).
// Note: the page loads no Google clicks or searches yet (the brief's starting point), so this uses what it does load.
import { trendNow, trendRuns } from '../data/mock.js'
import { B, DAY, DAYS, delta, fmtDay, fmtWeekday, noiseCount, noisePts, plural, preview } from './util.js'

const CHANNELS = { NEWS: { label: 'News', domain: 'news.google.com' }, X: { label: 'X', domain: 'x.com' }, INSTAGRAM: { label: 'Instagram', domain: 'instagram.com' } }
const sourceKey = (m) => m.handle ?? m.domain
const sourceName = (m) => m.handle ?? m.author ?? m.domain
const uniq = (list) => [...new Map(list.map((m) => [m.url, m])).values()]
const negShare = (list) => (list.length ? Math.round((list.filter((m) => m.sentiment === 'negative').length * 100) / list.length) : null)
const themeNames = Object.fromEntries(trendRuns.flatMap((r) => r.themes ?? []).map((t) => [t.themeKey, t.theme]))

export const trends = {
  page: 'trends',
  title: 'Trends',
  build(period) {
    const rs = trendRuns.filter((r) => r.status === 'DONE').sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    const latest = rs.find((r) => r.mentions?.length)
    const nowT = Date.parse(trendNow)
    const footer = [plural(new Set(rs.map((r) => r.query)).size, 'question'), plural(uniq(rs.flatMap((r) => r.mentions ?? [])).length, 'mention'), latest ? `last run ${fmtWeekday(latest.startedAt)}` : null].filter(Boolean)
    const prevOfLatest = latest && trendRuns.find((r) => r.id === latest.previousRunId)
    if (!latest || (period === 'scan' && !prevOfLatest) || preview() === 'one') {
      return { state: 'one', footer, latestIso: latest?.startedAt ?? trendNow, trigger: { delta: null }, oneText: 'Only one run of each question so far. Changes show after a question runs again.' }
    }

    // ---- the two sets of mentions to compare
    let cur, prev, since, title = null, href = '/trends', periodRuns
    if (period === 'scan') {
      cur = latest.mentions; prev = prevOfLatest.mentions
      since = fmtDay(prevOfLatest.startedAt)
      title = latest.query; href = `/trends/${latest.id}`
      periodRuns = trendRuns.filter((r) => r.startedAt > prevOfLatest.startedAt)
    } else {
      const span = DAYS[period] * DAY
      const all = uniq(rs.flatMap((r) => r.mentions ?? []))
      const at = (m) => Date.parse(m.publishedAt)
      cur = all.filter((m) => at(m) > nowT - span)
      prev = all.filter((m) => at(m) <= nowT - span && at(m) > nowT - 2 * span)
      since = fmtDay(new Date(nowT - span).toISOString())
      periodRuns = trendRuns.filter((r) => Date.parse(r.startedAt) > nowT - span)
    }
    const noBase = prev.length === 0
    const d = cur.length - prev.length
    const flat = noBase || noiseCount(d, prev.length)
    const n = negShare(cur), np = negShare(prev)
    const srcNow = new Set(cur.map(sourceKey)), srcThen = new Set(prev.map(sourceKey))
    const neutral = (x) => (x ? { ...x, good: null } : x) // more or fewer mentions isn't good or bad in itself
    const glance = [
      { label: 'Mentions', value: `${cur.length}`, delta: noBase ? null : neutral(delta(d, { noise: flat })) },
      { label: 'Negative', value: n == null ? '—' : `${n}%`, delta: noBase || n == null || np == null ? null : delta(n - np, { unit: ' pts', higherIsBetter: false, noise: noisePts(n - np) }) },
      { label: 'Sources', value: `${srcNow.size}`, delta: noBase ? null : neutral(delta(srcNow.size - srcThen.size, { noise: noiseCount(srcNow.size - srcThen.size, srcThen.size) })) },
    ]

    // ---- by channel
    const channels = Object.entries(CHANNELS).map(([id, ch]) => {
      const a = cur.filter((m) => m.channel === id).length, b = prev.filter((m) => m.channel === id).length
      const dd = noBase ? null : a - b
      return { id, mark: { domain: ch.domain }, name: ch.label, value: a, valueText: `${a}`, share: cur.length ? a / cur.length : 0, d: dd, delta: dd == null ? null : neutral(delta(dd, { noise: noiseCount(dd, b) })) }
    }).filter((c) => c.value > 0 || (c.d ?? 0) !== 0).sort((a, b) => Math.abs(b.d ?? 0) - Math.abs(a.d ?? 0) || b.value - a.value)

    // ---- headline
    const driver = flat ? null : channels.find((c) => c.d && Math.sign(c.d) === Math.sign(d))
    const about = title ? [' for ', B(`“${title}”`)] : []
    const headline = noBase
      ? [B(plural(cur.length, 'mention')), ` since ${since}`, ...about, '. Nothing earlier to compare with.']
      : flat
        ? [B(`Mentions held at ${cur.length}`), ...about, `, within 5% of ${since}.`]
        : [B(`Mentions ${d > 0 ? 'rose' : 'fell'} by ${Math.abs(d)} to ${cur.length}`), ...about,
          ...(driver ? [', mostly ', B(`${Math.abs(driver.d)} ${d > 0 ? 'more' : 'fewer'} on ${driver.name}`), '.'] : ['.'])]

    // ---- what moved: the tone, then talking points that grew or shrank; new sources
    const moved = []
    if (!noBase && n != null && np != null && !noisePts(n - np)) moved.push({ id: 'tone', mark: { status: n > np ? 'bad' : 'good' }, href, text: [B(`${n}%`), ' of mentions are negative, from ', B(`${np}%`)], delta: delta(n - np, { unit: ' pts', higherIsBetter: false }) })
    Object.keys(themeNames).map((k) => ({ k, a: cur.filter((m) => m.themeKey === k).length, b: prev.filter((m) => m.themeKey === k).length }))
      .filter((t) => !noBase && t.a + t.b > 0 && !noiseCount(t.a - t.b, t.b)).sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b)).slice(0, 3)
      .forEach((t) => moved.push({ id: `theme-${t.k}`, mark: { status: 'neutral' }, href, text: [B(themeNames[t.k]), ` came up ${t.a > t.b ? 'more' : 'less'} often`], delta: neutral(delta(t.a - t.b)) }))
    const newSources = noBase ? [] : [...new Map(cur.filter((m) => !srcThen.has(sourceKey(m))).map((m) => [sourceKey(m), m])).values()]
      .map((m) => ({ m, count: cur.filter((x) => sourceKey(x) === sourceKey(m)).length })).sort((a, b) => b.count - a.count)
    const sourceRows = newSources.slice(0, 4).map(({ m, count }) => ({
      id: `src-${sourceKey(m)}`, mark: { domain: m.domain }, href,
      text: [B(sourceName(m)), ` on ${CHANNELS[m.channel]?.label ?? m.channel}`], delta: { text: plural(count, 'mention'), good: null },
    }))

    // ---- worth doing next: a run that didn't finish in the period → run it again
    const next = periodRuns.filter((r) => r.status === 'FAILED').slice(0, 2).map((r) => ({
      id: `failed-${r.id}`, mark: { status: 'bad' }, action: 'Run again', href: '/trends', text: [B(`“${r.query}”`), ` didn’t finish on ${fmtDay(r.startedAt)}`],
    }))

    // ---- hero: Last scan: mentions per run of this question; 30 / 90 days: mentions a week, the window before in grey
    let hero
    if (period === 'scan') {
      const same = trendRuns.filter((r) => r.query === latest.query && r.status === 'DONE').sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      hero = { points: same.map((r) => ({ date: fmtDay(r.startedAt), value: r.mentionCount })), ghost: [], compareAt: same.indexOf(prevOfLatest), caption: 'Mentions found by each run of this question.' }
    } else {
      const weeks = Math.round(DAYS[period] / 7)
      const bucket = (list, end) => Array.from({ length: weeks }, (_, i) => list.filter((m) => { const t = Date.parse(m.publishedAt); return t > end - (weeks - i) * 7 * DAY && t <= end - (weeks - i - 1) * 7 * DAY }).length)
      hero = {
        points: bucket(cur, nowT).map((v, i) => ({ date: fmtDay(new Date(nowT - (weeks - i - 1) * 7 * DAY).toISOString()), value: v })),
        ghost: noBase ? [] : bucket(prev, nowT - DAYS[period] * DAY), compareAt: -1,
        caption: `Mentions a week, the last ${DAYS[period]} days.${noBase ? '' : ` Grey: the ${DAYS[period]} days before.`}`,
      }
    }

    return {
      state: 'changed', since, flat,
      headline, glance, hero,
      breakdown: { title: 'By channel', rows: channels },
      lists: [
        { id: 'moved', title: 'What moved', rows: moved },
        { id: 'sources', title: 'New sources', count: newSources.length, rows: sourceRows },
      ],
      next, footer,
      latestIso: latest.startedAt,
      trigger: { delta: flat ? null : { text: `${Math.abs(d)} mentions`, up: d > 0, good: null }, flatText: `No change since ${since}` },
    }
  },
}
