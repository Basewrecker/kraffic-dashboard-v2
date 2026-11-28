// Visibility Overview's "What changed": the score, prompts that name you, citations and your rank, from the history
// the Visibility history card draws (getHistory, every weekly scan with each brand's share) and the Sync history rows
// (per-engine counts, prompts gained / lost; they go back to Aug 3).
import { getHistory, missedPrompts, platformNames, syncHistory, visiblePrompts, citedPages } from '../data/mock.js'
import { ENGINES, TRACKED_BRANDS, OWN } from '../data/brandViews.js'
import { B, DAYS, baseIndex, delta, fmtDay, fmtWeekday, heroOf, isoOf, noiseCount, noisePts, plural, preview } from './util.js'
import { hubLink } from './hub-link.js'

const PID_ENGINE = { google: 'aio' }
const engineOf = (pid) => PID_ENGINE[pid] ?? pid
const rankOf = (values, key) => {
  const v = values[key]
  if (v == null) return null
  return 1 + TRACKED_BRANDS.filter((b) => b.key !== key && (values[b.key] ?? -1) > v).length
}

function weeks() {
  let list = getHistory({ range: 'all' }).points.map((p) => ({
    iso: p.iso, t: Date.parse(p.iso), values: Object.fromEntries(TRACKED_BRANDS.map((b) => [b.key, p[b.key]])),
  })).reverse()
  if (preview() === 'one') list = list.slice(0, 1)
  if (preview() === 'none') list = [{ ...list[1], iso: list[0].iso, t: list[0].t }, ...list.slice(1)]
  return list
}
function details() {
  let list = syncHistory.map((r) => ({
    iso: isoOf(r.date), named: r.visible, cited: r.cited, total: r.total, changes: r.changes,
    engines: Object.fromEntries(r.breakdown.map((b) => [b.id, b.visible])),
  }))
  if (preview() === 'none') list = [{ ...list[1], iso: list[0].iso, changes: { ...list[0].changes, gained: [], lost: [] } }, ...list.slice(1)]
  return list
}

export const overview = {
  page: 'overview',
  title: 'Visibility Overview',
  build(period) {
    const ws = weeks()
    const now = ws[0]
    const ds = details()
    const total = ds[0].total
    const footer = [`${plural(total, 'prompt')}`, `last scan ${fmtWeekday(now.iso)}`]
    if (ws.length < 2) return { state: 'one', footer, latestIso: now.iso, trigger: { delta: null } }
    const bi = baseIndex(ws, period)
    const then = ws[bi]
    const since = fmtDay(then.iso)
    const me = OWN.key
    const score = now.values[me], scoreD = score - then.values[me]

    // the counts go back as far as the sync rows do: the row on the compared day, or the oldest one
    let di = ds.findIndex((d) => d.iso === then.iso)
    const short = di === -1
    if (short) di = ds.length - 1
    const dNow = ds[0], dThen = ds[di]
    const notes = short ? [`Engine and prompt detail from ${fmtDay(dThen.iso)}, the oldest scan with it`] : []

    // ---- at a glance
    const rank = rankOf(now.values, me), rankThen = rankOf(then.values, me)
    const named = dNow.named - dThen.named, cited = dNow.cited - dThen.cited
    const glance = [
      { label: 'Score', value: `${score}`, delta: delta(scoreD, { unit: ' pts', noise: noisePts(scoreD) }) },
      { label: 'Named', value: `${dNow.named}`, delta: delta(named, { noise: noiseCount(named, dThen.named) }) },
      { label: 'Cited', value: `${dNow.cited}`, delta: delta(cited, { noise: noiseCount(cited, dThen.cited) }) },
      { label: 'Rank', value: rank ? `#${rank}` : '—', delta: delta(rankThen && rank ? rankThen - rank : null, { noise: rank === rankThen }) },
    ]

    // ---- by engine: its score (prompts that name you on it, of all), change, biggest mover first
    const engines = ENGINES.filter((e) => dNow.engines[e.id] != null).map((e) => {
      const v = Math.round((dNow.engines[e.id] / total) * 100)
      const p = dThen.engines[e.id] != null ? Math.round((dThen.engines[e.id] / total) * 100) : null
      const d = p == null ? null : v - p
      const moreN = dThen.engines[e.id] != null ? dNow.engines[e.id] - dThen.engines[e.id] : null
      return { id: e.id, mark: { engine: e.id }, name: e.full, value: v, valueText: `${v}`, share: v / 100, d, moreN, delta: delta(d, { unit: ' pts', noise: noisePts(d) }) }
    }).sort((a, b) => (noisePts(b.d) ? 0 : Math.abs(b.d)) - (noisePts(a.d) ? 0 : Math.abs(a.d)) || b.value - a.value)

    // ---- headline: the score, and the engine that moved most the same way
    const flat = noisePts(scoreD)
    const driver = flat ? null : engines.find((e) => !noisePts(e.d) && Math.sign(e.d) === Math.sign(scoreD) && e.moreN)
    const headline = flat
      ? [B(`Visibility held at ${score}`), `, within 2 pts of ${since}.`]
      : [B(`Visibility ${scoreD > 0 ? 'rose' : 'fell'} ${plural(Math.abs(scoreD), 'pt')} to ${score}`),
        ...(driver ? [', mostly from ', B(driver.name), ' naming you on ', B(plural(Math.abs(driver.moreN), driver.moreN > 0 ? 'more prompt' : 'fewer prompt')), '.'] : [` since ${since}.`])]

    // ---- what moved: competitors (falling is good for you), your rank, and your most cited pages (last scan only:
    // the cited pages card keeps one change)
    const moved = []
    for (const b of TRACKED_BRANDS.filter((x) => !x.you)) {
      const a = now.values[b.key], p = then.values[b.key]
      if (a == null || p == null || noisePts(a - p)) continue
      const d = a - p
      moved.push({
        id: `rival-${b.key}`, mark: { domain: b.domain }, impact: Math.abs(d), target: '[data-card="history"]',
        text: [B(b.name), ` ${d > 0 ? 'rose' : 'fell'} `, B(plural(Math.abs(d), 'pt')), ` to ${a}`],
        delta: delta(d, { unit: ' pts', higherIsBetter: false }),
        spark: ws.slice(0, 8).map((w) => w.values[b.key]).reverse(),
      })
    }
    const rankD = rankThen && rank ? rankThen - rank : 0
    if (rankD) moved.push({ id: 'rank', mark: { domain: OWN.domain }, impact: 10, target: '[data-card="history"]', text: ['You moved ', B(rankD > 0 ? 'up' : 'down'), ' to ', B(`#${rank}`)], delta: delta(rankD) })
    if (period === 'scan') {
      for (const c of citedPages.filter((x) => x.path && !noiseCount(x.delta, x.count - x.delta)).slice(0, 2)) {
        moved.push({
          id: `page-${c.path}`, mark: { domain: OWN.domain }, impact: (Math.abs(c.delta) / total) * 100, target: '[data-card="citedPages"]',
          text: [B(c.path), ` cited on ${c.delta > 0 ? 'more' : 'fewer'} prompts`], delta: delta(c.delta),
        })
      }
    }
    moved.sort((a, b) => b.impact - a.impact)

    // ---- prompts won and lost in the period (net: lost then won back is neither)
    const span = ds.slice(0, di)
    const ids = (k) => [...new Set(span.flatMap((r) => r.changes?.[k] ?? []).map((x) => x.id))]
    const gainedAll = ids('gained'), lostAll = ids('lost')
    const won = gainedAll.filter((id) => !lostAll.includes(id)).map((id) => visiblePrompts[id]).filter(Boolean)
    const lost = lostAll.filter((id) => !gainedAll.includes(id)).map((id) => missedPrompts.find((m) => m.id === id)).filter(Boolean)
    // the period is one scan: the Prompt Hub can show exactly that scan's prompts (else its status tab)
    const oneScan = span.length === 1 ? span[0].iso : null
    const keyOf = (kind, r) => `${kind === 'won' ? 'v' : 'm'}${r.id}`
    const promptRow = (r, kind) => ({
      id: `${kind}-${r.id}`, mark: { engine: engineOf(r.platforms?.[0] ?? 'google') }, text: [B(r.prompt)],
      open: { answer: keyOf(kind, r), list: (kind === 'won' ? won : lost).map((x) => keyOf(kind, x)) },
    })

    // ---- worth doing next: two or more prompts lost to one competitor → draft them; an engine that fell → its prompts
    const next = []
    const byRival = {}
    lost.forEach((m) => (m.competitors ?? []).forEach((w) => (byRival[w] ??= []).push(m)))
    const top = Object.entries(byRival).filter(([d]) => TRACKED_BRANDS.some((b) => b.domain === d && !b.you)).sort((a, b) => b[1].length - a[1].length)[0]
    if (top && top[1].length >= 2) {
      const [domain, prompts] = top
      const counts = {}
      prompts.forEach((m) => m.platforms.forEach((p) => { counts[p] = (counts[p] ?? 0) + 1 }))
      const [pid, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? []
      next.push({
        id: 'draft', mark: { domain }, action: 'Draft content', href: `/opportunities/content/${prompts[0].id}`,
        text: [B(plural(prompts.length, 'prompt')), ' lost to ', B(TRACKED_BRANDS.find((b) => b.domain === domain).name), ...(n === prompts.length ? [' on ', B(platformNames[pid] ?? pid)] : [])],
      })
    }
    const fell = engines.find((e) => !noisePts(e.d) && e.d < 0 && e.moreN < 0)
    if (fell && next.length < 2) next.push({ id: 'engine', mark: { engine: fell.id }, action: 'See prompts', href: '/tracker', text: [B(fell.name), ' names you on ', B(plural(Math.abs(fell.moreN), 'fewer prompt')), ` than on ${fmtDay(dThen.iso)}`] })

    const scoreSeries = ws.map((w) => ({ iso: w.iso, value: w.values[me] }))
    return {
      state: 'changed', since, flat,
      headline,
      glance,
      hero: heroOf(scoreSeries, bi, period, (n, g) => `Visibility score, ${period === 'scan' ? `last ${n} scans` : `the last ${DAYS[period]} days`}.${g ? ` Grey: the ${g} scans before.` : ''}`),
      breakdown: { title: 'By engine', rows: engines },
      lists: [
        { id: 'moved', title: 'What moved', rows: moved.slice(0, 5) },
        // every prompt: the panel shows `limit` rows, then "Show all n"; hub: the section's "View in Prompt Hub →"
        { id: 'won', title: 'Prompts won', count: won.length, rows: won.map((r) => promptRow(r, 'won')), limit: 5, hub: hubLink({ kind: 'won', iso: oneScan }) },
        { id: 'lost', title: 'Prompts lost', count: lost.length, rows: lost.map((r) => promptRow(r, 'lost')), limit: 5, hub: hubLink({ kind: 'lost', iso: oneScan }) },
      ],
      next: next.slice(0, 2),
      footer: [...footer, ...notes],
      latestIso: now.iso,
      trigger: { delta: flat ? null : { text: `${Math.abs(scoreD)} pts`, up: scoreD > 0, good: scoreD > 0 }, flatText: `No change since ${since}` },
    }
  },
}
