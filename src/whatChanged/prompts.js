// Prompt Hub's "What changed": prompts that name you (won vs lost), new missed prompts, and which competitor took
// the ones you lost. From the Sync history rows the page already loads (named / missed counts and each sync's gained /
// lost lists; they go back to Aug 3), the missed prompts' first-seen dates and the prompt-level appearances table.
import { missedPrompts, syncHistory, visiblePrompts } from '../data/mock.js'
import { ENGINE_ORDER, TRACKED_BRANDS, appearances, engineFullName, enginePid } from '../data/brandViews.js'
import { trackedKey } from '../data/syncChanges.js'
import { B, baseIndex, delta, fmtDay, fmtWeekday, heroOf, isoOf, noiseCount, plural, preview } from './util.js'

const PID_ENGINE = { google: 'aio' }
const engineOf = (pid) => PID_ENGINE[pid] ?? pid
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
const RIVALS = TRACKED_BRANDS.filter((b) => !b.you)
// the competitor that shows instead on a lost prompt (the Sync drawer's rule: data/syncChanges.js)
function takenBy(key) {
  const engines = ENGINE_ORDER.filter((e) => ['aio', 'aimode', 'gemini', 'chatgpt'].includes(e))
  const engine = engines[hash(key) % engines.length]
  const b = RIVALS.find((x) => appearances[key]?.[x.domain]?.platforms.includes(enginePid(engine))) ?? RIVALS.find((x) => appearances[key]?.[x.domain]?.visible)
  return { brand: b ?? null, engine }
}

function scans() {
  let list = syncHistory.map((r) => ({ iso: isoOf(r.date), t: Date.parse(isoOf(r.date)), named: r.visible, missed: r.missed, total: r.total, changes: r.changes }))
  if (preview() === 'one') list = list.slice(0, 1)
  if (preview() === 'none') list = [{ ...list[1], iso: list[0].iso, t: list[0].t, changes: { ...list[0].changes, gained: [], lost: [] } }, ...list.slice(1)]
  return list
}

export const prompts = {
  page: 'prompts',
  title: 'Prompt Hub',
  build(period) {
    const ss = scans()
    const now = ss[0]
    const footer = [plural(now.total, 'prompt'), `last scan ${fmtWeekday(now.iso)}`]
    if (ss.length < 2) return { state: 'one', footer, latestIso: now.iso, trigger: { delta: null } }
    const bi = baseIndex(ss, period)
    const then = ss[bi]
    const since = fmtDay(then.iso)
    const short = period === '90d' && (now.t - then.t) / 86400000 < 80
    const notes = short ? [`History from ${since}, the oldest scan on record`] : []

    // ---- won / lost in the period (net: lost then won back is neither)
    const span = ss.slice(0, bi)
    const ids = (k) => [...new Set(span.flatMap((r) => r.changes?.[k] ?? []).map((x) => x.id))]
    const gainedAll = ids('gained'), lostAll = ids('lost')
    const won = gainedAll.filter((id) => !lostAll.includes(id)).map((id) => visiblePrompts[id]).filter(Boolean)
    const lost = lostAll.filter((id) => !gainedAll.includes(id)).map((id) => missedPrompts.find((m) => m.id === id)).filter(Boolean)
      .map((m) => ({ m, key: trackedKey(m.id, 'lost'), ...takenBy(trackedKey(m.id, 'lost')) }))
    // new missed prompts: first tracked in the period and not named yet
    const fresh = missedPrompts.filter((m) => m.firstSeen && Date.parse(m.firstSeen) > then.t && !lostAll.includes(m.id))

    const named = now.named - then.named
    const flat = noiseCount(named, then.named)
    const missedD = now.missed - then.missed
    const inPeriod = { text: `since ${since}`, good: null }
    const glance = [
      { label: 'Named', value: `${now.named}`, delta: delta(named, { noise: flat }) },
      { label: 'Missed', value: `${now.missed}`, delta: delta(missedD, { higherIsBetter: false, noise: noiseCount(missedD, then.missed) }) },
      { label: 'Won', value: `${won.length}`, delta: inPeriod },
      { label: 'Lost', value: `${lost.length}`, delta: inPeriod },
    ]

    // ---- who took them: the competitor shown instead on each lost prompt
    const byRival = RIVALS.map((b) => ({ b, list: lost.filter((x) => x.brand?.domain === b.domain) })).filter((x) => x.list.length)
      .sort((x, y) => y.list.length - x.list.length)
    const rivalRows = byRival.map(({ b, list }) => ({
      id: b.key, mark: { domain: b.domain }, name: b.name, value: list.length, valueText: `${list.length}`, share: lost.length ? list.length / lost.length : 0,
      delta: { text: plural(list.length, 'prompt'), good: false },
    }))

    // ---- headline: prompts that name you, and won vs lost
    const top = byRival[0]
    const headline = flat
      ? [B(`${plural(now.named, 'prompt')} name you`), `, within 5% of ${since}`, ...(won.length || lost.length ? [': ', B(`${won.length} won`), ', ', B(`${lost.length} lost`)] : []), '.']
      : [B(`${plural(Math.abs(named), named > 0 ? 'more prompt' : 'fewer prompt')} name you`), ` than on ${since}: `, B(`${won.length} won`), ' and ', B(`${lost.length} lost`),
        ...(top ? [', mostly to ', B(top.b.name)] : []), '.']

    const wonRows = won.slice(0, 3).map((r) => ({
      id: `won-${r.id}`, mark: { engine: engineOf(r.platforms?.[0] ?? 'google') }, text: [B(r.prompt)],
      open: { answer: `v${r.id}`, list: won.map((x) => `v${x.id}`) },
    }))
    const lostRows = lost.slice(0, 3).map((x) => ({
      id: `lost-${x.m.id}`, mark: { engine: x.engine }, text: [B(x.m.prompt), ...(x.brand ? [` · ${x.brand.name} shows instead`] : [])],
      open: { answer: x.key, list: lost.map((y) => y.key) },
    }))
    const freshRows = fresh.slice(0, 3).map((m) => ({
      id: `new-${m.id}`, mark: m.competitors?.[0] ? { domain: m.competitors[0] } : { status: 'bad' },
      text: [B(m.prompt), ...(m.competitors?.length ? [' · ', plural(m.competitors.length, 'competitor'), ' named'] : [' · no brand named'])],
      open: { answer: `m${m.id}`, list: fresh.map((y) => `m${y.id}`) },
    }))

    // ---- worth doing next: two or more prompts lost to one competitor → draft them
    const next = []
    if (top && top.list.length >= 2) {
      const engines = new Set(top.list.map((x) => x.engine))
      next.push({
        id: 'draft', mark: { domain: top.b.domain }, action: 'Draft content', href: `/opportunities/content/${top.list[0].m.id}`,
        text: [B(plural(top.list.length, 'prompt')), ' lost to ', B(top.b.name), ...(engines.size === 1 ? [' on ', B(engineFullName([...engines][0]))] : [])],
      })
    }

    const series = ss.map((r) => ({ iso: r.iso, value: r.named }))
    return {
      state: 'changed', since, flat,
      headline, glance,
      hero: heroOf(series, bi, period, (n, g) => `Prompts that name you, ${period === 'scan' ? `last ${n} scans` : `since ${since}`}.${g ? ` Grey: the ${g} scans before.` : ''}`),
      breakdown: { title: 'Who took the ones you lost', rows: rivalRows },
      lists: [
        { id: 'won', title: 'Prompts won', count: won.length, rows: wonRows },
        { id: 'lost', title: 'Prompts lost', count: lost.length, rows: lostRows },
        { id: 'new', title: 'New missed prompts', count: fresh.length, rows: freshRows },
      ],
      next,
      footer: [...footer, ...notes],
      latestIso: now.iso,
      trigger: { delta: flat ? null : { text: `${Math.abs(named)} prompts`, up: named > 0, good: named > 0 }, flatText: `No change since ${since}` },
    }
  },
}
