// Trends' Summary: how search interest in the brand's terms moved, from the same Google Trends data the page loads
// (data/marketTrends.js; the page shows Summary only on the brand's own data). Last scan: the last 7 days against the
// 7 before; 30 / 90 days: the last 28 days / 3 months against the same stretch before. Interest is Google's 0–100
// scale, so changes are in points.
import { interestOverTime, marketTerms, marketToday, marketUpdatedAt, relatedQueries } from '../data/marketTrends.js'
import { comparedRange, rangeOf } from '../lib/trendsCompare.js'
import { B, delta, fmtDay, fmtWeekday, noisePts, plural, preview } from './util.js'

const PERIOD = { scan: '7d', '30d': '28d', '90d': '3m' }
const avg = (list) => { const v = list.filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null }
const neutral = (x) => (x ? { ...x, good: null } : x) // more or fewer searches isn't good or bad in itself

export const trends = {
  page: 'trends',
  title: 'Trends',
  build(period) {
    const terms = marketTerms
    const footer = [plural(terms.length, 'term'), 'Google Trends, United States', `updated ${fmtWeekday(marketUpdatedAt)}`]
    if (preview() === 'one') return { state: 'one', footer, latestIso: marketUpdatedAt, trigger: { delta: null }, oneText: 'Only one week of data so far. Changes show after the next Monday update.' }

    const value = { period: PERIOD[period] ?? '7d', against: 'previous' }
    const range = rangeOf(value, marketToday), compared = comparedRange(value, marketToday)
    const { points } = interestOverTime({ terms, range, compared })
    const since = fmtDay(range.from)

    // ---- by term: average interest now and in the stretch before
    const rows = terms.map((t) => {
      const now = avg(points.map((p) => p.values[t])), then = avg(points.map((p) => p.before[t]))
      const d = now != null && then != null ? now - then : null
      return { id: t, mark: { status: noisePts(d) ? 'neutral' : d > 0 ? 'up' : 'down' }, name: t, value: now, valueText: now == null ? '—' : `${now}`, share: (now ?? 0) / 100, d, delta: neutral(delta(d, { unit: ' pts', noise: noisePts(d) })) }
    })
    const all = avg(rows.map((r) => r.value)), allThen = avg(terms.map((t) => avg(points.map((p) => p.before[t]))))
    const d = all != null && allThen != null ? all - allThen : null
    const flat = noisePts(d)
    const movers = rows.filter((r) => !noisePts(r.d)).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    const lead = flat ? null : movers.find((r) => Math.sign(r.d) === Math.sign(d))

    // ---- rising searches across the terms (each once), fastest first
    const rising = [...new Map(terms.flatMap((t) => relatedQueries(t, { period: value.period }).rising).map((r) => [r.query, r])).values()]
      .sort((a, b) => (b.breakout ? 1 : 0) - (a.breakout ? 1 : 0) || (b.growth ?? 0) - (a.growth ?? 0))
    const breakouts = rising.filter((r) => r.breakout)

    const headline = flat
      ? [B(`Interest in your terms held at ${all}`), `, within 2 points of the ${range.days} days before.`]
      : [B(`Interest in your terms ${d > 0 ? 'rose' : 'fell'} ${Math.abs(d)} points to ${all}`), ...(lead ? [', led by ', B(lead.name), '.'] : ['.'])]
    const glance = [
      { label: 'Interest', value: all == null ? '—' : `${all}`, delta: neutral(delta(d, { unit: ' pts', noise: flat })) },
      { label: 'Rising prompts', value: `${rising.length}`, delta: null },
      { label: 'Breakouts', value: `${breakouts.length}`, delta: null },
    ]
    const moved = movers.slice(0, 4).map((r) => ({ id: `term-${r.id}`, mark: r.mark, href: '/trends', text: [B(r.name), ` searches ${r.d > 0 ? 'rose' : 'fell'}`], delta: r.delta }))
    const risingRows = rising.slice(0, 4).map((r) => ({ id: `rise-${r.query}`, mark: { status: 'neutral' }, href: '/trends', text: [B(r.query)], delta: { text: r.breakout ? 'Breakout' : `+${r.growth.toLocaleString('en-US')}%`, good: null } }))
    // worth doing next: breakout searches that aren't tracked prompts yet
    const next = breakouts.filter((r) => r.status == null).slice(0, 2).map((r) => ({ id: `track-${r.query}`, mark: { status: 'neutral' }, action: 'Track', href: '/trends', text: [B(r.query), ' is a breakout search you don’t track'] }))

    // the chart: average interest across the terms, point by point; grey: the stretch before
    const hero = {
      points: points.map((p) => ({ date: fmtDay(p.iso), value: avg(terms.map((t) => p.values[t])) })),
      ghost: points.map((p) => avg(terms.map((t) => p.before[t]))),
      compareAt: -1,
      caption: `Average interest across your terms, the last ${range.days} days. Grey: the ${range.days} days before.`,
    }
    return {
      state: 'changed', since, flat,
      headline, glance, hero,
      breakdown: { title: 'By term', rows: [...rows].sort((a, b) => Math.abs(b.d ?? 0) - Math.abs(a.d ?? 0) || (b.value ?? 0) - (a.value ?? 0)) },
      lists: [
        { id: 'moved', title: 'What moved', rows: moved },
        { id: 'rising', title: 'Rising prompts', count: rising.length, rows: risingRows },
      ],
      next, footer,
      latestIso: marketUpdatedAt,
      trigger: { delta: flat ? null : { text: `${Math.abs(d)} pts`, up: d > 0, good: null }, flatText: `No change since ${since}` },
    }
  },
}
