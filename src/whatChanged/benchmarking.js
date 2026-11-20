// Benchmarking's "What changed": your place among the tracked brands and the gap to the next one, from the weekly
// history the Over time card draws (getHistory: every scan with each brand's visibility, all engines), and the Sync
// history rows' prompts gained / lost (they go back to Aug 3), checked against Where they beat you (lostPrompts) for
// which competitor is named instead. The page's Engine filter doesn't apply: the history is all engines.
import { getHistory, syncHistory } from '../data/mock.js'
import { TRACKED_BRANDS, OWN } from '../data/brandViews.js'
import { lostPrompts } from '../data/benchmarking.js'
import { displayShares } from '../utils/shareOfVoice.js'
import { B, DAYS, baseIndex, delta, fmtDay, fmtWeekday, heroOf, isoOf, noisePts, plural, preview } from './util.js'

const RIVALS = TRACKED_BRANDS.filter((b) => !b.you)
const byDomain = Object.fromEntries(TRACKED_BRANDS.map((b) => [b.domain, b]))
const rankOf = (values, key) => (values[key] == null ? null : 1 + TRACKED_BRANDS.filter((b) => b.key !== key && (values[b.key] ?? -1) > values[key]).length)
const ranked = (values) => TRACKED_BRANDS.filter((b) => values[b.key] != null).length
// you vs the best competitor: + your lead, − the gap to the leader; and that competitor
function lead(values) {
  const best = RIVALS.filter((b) => values[b.key] != null).sort((a, b) => values[b.key] - values[a.key])[0]
  return best && values[OWN.key] != null ? { rival: best, value: values[OWN.key] - values[best.key] } : null
}
const shareOf = (values) => {
  const brands = TRACKED_BRANDS.filter((b) => values[b.key] != null)
  const s = displayShares(brands.map((b) => values[b.key]))
  return s[brands.findIndex((b) => b.you)] ?? null
}
const names = (list) => (list.length < 3 ? list.join(' and ') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`)

function weeks() {
  let list = getHistory({ range: 'all' }).points.map((p) => ({
    iso: p.iso, t: Date.parse(p.iso), values: Object.fromEntries(TRACKED_BRANDS.map((b) => [b.key, p[b.key] ?? null])),
  })).reverse()
  if (preview() === 'one') list = list.slice(0, 1)
  if (preview() === 'none') list = [{ ...list[1], iso: list[0].iso, t: list[0].t }, ...list.slice(1)]
  return list
}

export const benchmarking = {
  page: 'benchmarking',
  title: 'Benchmarking',
  build(period) {
    const ws = weeks()
    const now = ws[0]
    const me = OWN.key
    const of = ranked(now.values)
    const footer = [plural(of, 'brand'), 'all engines', `last scan ${fmtWeekday(now.iso)}`]
    if (ws.length < 2) return { state: 'one', footer, latestIso: now.iso, trigger: { delta: null }, oneText: 'Only one scan so far. Changes against your competitors show after the next scan.' }
    const bi = baseIndex(ws, period)
    const then = ws[bi]
    const since = fmtDay(then.iso)

    // ---- your place and lead
    const rank = rankOf(now.values, me), rankThen = rankOf(then.values, me)
    const rankD = rank && rankThen ? rankThen - rank : 0 // + moved up
    const vis = now.values[me], visD = vis != null && then.values[me] != null ? vis - then.values[me] : null
    const ld = lead(now.values), ldThen = lead(then.values)
    const leadD = ld && ldThen ? ld.value - ldThen.value : null
    const share = shareOf(now.values), shareThen = shareOf(then.values)
    const shareD = share != null && shareThen != null ? share - shareThen : null
    const flat = !rankD && noisePts(leadD)

    const glance = [
      { label: 'Rank', value: rank ? `#${rank}` : '—', delta: delta(rankThen && rank ? rankD : null, { noise: !rankD }) },
      { label: 'Visibility', value: vis == null ? '—' : `${vis}%`, delta: delta(visD, { unit: ' pts', noise: noisePts(visD) }) },
      { label: 'Share', value: share == null ? '—' : `${share}%`, delta: delta(shareD, { unit: ' pts', noise: noisePts(shareD) }) },
      { label: ld && ld.value < 0 ? 'Gap' : 'Lead', value: ld ? `${Math.abs(ld.value)} pts` : '—', delta: delta(leadD, { unit: ' pts', noise: noisePts(leadD) }) },
    ]

    // ---- the competitors: each one's visibility and change (a competitor falling is good for you), biggest mover first
    const rivals = RIVALS.filter((b) => now.values[b.key] != null).map((b) => {
      const v = now.values[b.key], p = then.values[b.key]
      const d = p == null ? null : v - p
      return { id: b.key, mark: { domain: b.domain }, name: b.name, value: v, valueText: `${v}%`, share: v / 100, d, delta: delta(d, { unit: ' pts', higherIsBetter: false, noise: noisePts(d) }) }
    }).sort((a, b) => (noisePts(b.d) ? 0 : Math.abs(b.d)) - (noisePts(a.d) ? 0 : Math.abs(a.d)) || b.value - a.value)

    // ---- who passed whom: pairs in a different order now than on the compared scan (a swap and back is neither);
    // a margin that moved under 2 pts isn't a change
    const crossings = []
    for (const a of TRACKED_BRANDS) for (const b of TRACKED_BRANDS) {
      const [an, bn, ap, bp] = [now.values[a.key], now.values[b.key], then.values[a.key], then.values[b.key]]
      if (a === b || [an, bn, ap, bp].includes(null)) continue
      if (an > bn && ap < bp && !noisePts((an - bn) - (ap - bp))) crossings.push({ ahead: a, behind: b, swing: (an - bn) - (ap - bp) })
    }
    const passedYou = crossings.filter((c) => c.behind.you).map((c) => c.ahead.name)
    const youPassed = crossings.filter((c) => c.ahead.you).map((c) => c.behind.name)

    // ---- headline: your place; when it held, your lead over (or gap to) the best competitor
    const rival = ld?.rival.name
    let headline
    if (rankD > 0) headline = [B(`You moved up to #${rank} of ${of}`), ...(youPassed.length ? [', passing ', B(names(youPassed))] : []), `, since ${since}.`]
    else if (rankD < 0) headline = [B(`You fell to #${rank} of ${of}`), ...(passedYou.length ? [', passed by ', B(names(passedYou))] : []), `, since ${since}.`]
    else if (!ld) headline = [B(`You held #${rank} of ${of}`), ` since ${since}.`]
    else if (flat) headline = [B(`You held #${rank} of ${of}`), `. Your ${ld.value >= 0 ? 'lead over' : 'gap to'} `, B(rival), ` is within 2 pts of ${since}.`]
    else {
      const ahead = ld.value >= 0
      const word = ahead ? (leadD > 0 ? 'grew' : 'shrank') : (leadD > 0 ? 'narrowed' : 'widened')
      headline = [B(`You held #${rank} of ${of}`), `, and your ${ahead ? 'lead over' : 'gap to'} `, B(rival), ` ${word} by `, B(plural(Math.abs(leadD), 'pt')), ` to ${Math.abs(ld.value)}.`]
    }

    const inHeadline = (c) => rankD !== 0 && (c.ahead.you || c.behind.you)
    const passed = crossings.filter((c) => !inHeadline(c))
      .sort((x, y) => (y.ahead.you || y.behind.you) - (x.ahead.you || x.behind.you) || Math.abs(y.swing) - Math.abs(x.swing))
      .map((c) => ({
        id: `pass-${c.ahead.key}-${c.behind.key}`, mark: { domain: c.ahead.domain }, target: '[data-over-time]',
        text: [B(c.ahead.you ? 'You' : c.ahead.name), ' passed ', B(c.behind.you ? 'you' : c.behind.name), ` (${now.values[c.ahead.key]}% to ${now.values[c.behind.key]}%)`],
        delta: { text: 'Passed', good: c.ahead.you ? true : c.behind.you ? false : null },
      }))

    // ---- prompts you dropped out of in the period that a competitor wins now (the Sync history rows go back as far
    // as they do: the row on the compared day, or the oldest one; net: lost then won back is neither)
    const ds = syncHistory.map((r) => ({ iso: isoOf(r.date), changes: r.changes }))
    let di = ds.findIndex((d) => d.iso === then.iso)
    const short = di === -1
    if (short) di = ds.length - 1
    if (preview() === 'none') di = 0
    const span = ds.slice(0, di)
    // per prompt its first and last change in the span (span is newest first): lost at the end and named at the start
    const first = new Map(), last = new Map()
    span.forEach((r) => ['gained', 'lost'].forEach((k) => (r.changes?.[k] ?? []).forEach((x) => { if (!last.has(x.id)) last.set(x.id, k); first.set(x.id, k) })))
    // (forEach visits newest first: `last` keeps the newest change, `first` ends on the oldest)
    const lostNow = new Set([...last].filter(([id, k]) => k === 'lost' && first.get(id) === 'lost').map(([id]) => id))
    const taken = lostPrompts('all').filter((x) => lostNow.has(x.id))
    const takenRows = taken.map((x) => ({
      id: `taken-${x.key}`, mark: { domain: x.winners[0] }, target: '[data-beats]',
      text: [B(x.prompt), ' now names ', B(names(x.winners.map((d) => byDomain[d]?.name ?? d)))],
      delta: { text: plural(x.engines.length, 'engine'), good: null },
    }))
    const notes = short ?[`Prompt changes from ${fmtDay(ds[di].iso)}, the oldest scan with them`] : []

    // ---- worth doing next: one competitor took two or more of your prompts → draft content for them (Content)
    const next = []
    const perRival = {}
    taken.forEach((x) => x.winners.forEach((d) => (perRival[d] ??= []).push(x)))
    const top = Object.entries(perRival).sort((a, b) => b[1].length - a[1].length)[0]
    if (top && top[1].length >= 2) {
      next.push({ id: 'draft', mark: { domain: top[0] }, action: 'Draft content', href: `/opportunities/content/${top[1][0].id}`, text: [B(plural(top[1].length, 'prompt')), ' you dropped out of now name ', B(byDomain[top[0]]?.name ?? top[0])] })
    }

    const visSeries = ws.filter((w) => w.values[me] != null).map((w) => ({ iso: w.iso, value: w.values[me] }))
    return {
      state: 'changed', since, flat,
      headline, glance,
      hero: heroOf(visSeries, bi, period, (n, g) => `Your visibility, ${period === 'scan' ? `last ${n} scans` : `the last ${DAYS[period]} days`}.${g ? ` Grey: the ${g} scans before.` : ''}`),
      breakdown: { title: 'Competitors', rows: rivals },
      lists: [
        { id: 'passed', title: 'Places changed', count: passed.length, rows: passed.slice(0, 4) },
        { id: 'taken', title: 'Prompts competitors took', count: takenRows.length, rows: takenRows.slice(0, 4) },
      ],
      next,
      footer: [...footer, ...notes],
      latestIso: now.iso,
      trigger: {
        delta: rankD ? { text: plural(Math.abs(rankD), 'place'), up: rankD > 0, good: rankD > 0 }
          : noisePts(leadD) ? null : { text: `${Math.abs(leadD)} pts`, up: leadD > 0, good: leadD > 0 },
        flatText: `No change since ${since}`,
        spark: ws.slice(0, 6).map((w) => lead(w.values)?.value ?? null).reverse(),
      },
    }
  },
}
