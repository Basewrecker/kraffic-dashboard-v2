// Brand views: the dashboard seen from any tracked brand's point of view ("Viewing as").
// Source of truth = a prompt-level appearances table over the 152 tracked prompts:
//   appearances[promptId][domain] = { visible, cited, platforms, citedPlatforms, citedPage }
// Dermasuri's rows reproduce the existing dashboard (111 visible / 41 missed, 30 cited, AI Overview 111 /
// Gemini 90 / ChatGPT 54). Competitors are generated to their tracked share (CeraVe ≈18%, The Ordinary ≈4%,
// Paula’s Choice ≈3%), preferring prompts the mock already says they win.
import {
  account, citedPages, citedPagesOther, extraCompetitors, history, historyEarlier, historySeries, kpis, missedPrompts, platforms as platformList,
  platformStats, syncHistory, syncTotal, trackedPrompts, visiblePrompts, withAiMode, aiModePreview, historyMonthly,
} from './mock.js'
import { brandListName } from '../utils/brand.js'
import { pointsBetween } from '../utils/syncChange.js'

export const TRACKED_BRANDS = [
  { domain: account.domain, key: 'dermasuri', name: account.name, you: true },
  { domain: 'cerave.com', key: 'cerave', name: 'CeraVe' },
  { domain: 'theordinary.com', key: 'ordinary', name: 'The Ordinary' },
  { domain: 'paulaschoice.com', key: 'paulas', name: 'Paula’s Choice' },
  // ?competitors=many (data/mock.js extraCompetitors): the name Brand Setup holds, or with none set the domain tidied
  // (utils/brand.js brandListName, the app's rule: "byoma.com" → "Byoma")
  ...extraCompetitors.map((c) => ({ domain: c.domain, key: c.key, name: brandListName([c.name], c.domain) })),
]
export const brandByDomain = (d) => TRACKED_BRANDS.find((b) => b.domain === d)
export const OWN = TRACKED_BRANDS[0]

const TOTAL = trackedPrompts.length // 152
const TARGET = { 'cerave.com': 27, 'theordinary.com': 6, 'paulaschoice.com': 5 } // ≈18% / 4% / 3%
const PAGES = {
  'cerave.com': ['/products/barrier-repair-serum', '/blog/korean-sunscreen-guide', '/products/gel-moisturizer', '/blog/vegan-skincare-brands', '/collections/bestsellers', '/blog/face-oil-guide'],
  'theordinary.com': ['/products/niacinamide-10-zinc-1', '/products/hyaluronic-acid-2-b5', '/blog/regimen-guide'],
  'paulaschoice.com': ['/products/2-bha-liquid-exfoliant', '/blog/skin-type-quiz', '/products/c15-super-booster'],
}
const SYNC_DATES = ['Oct 5, 2026', 'Sep 28, 2026', 'Sep 21, 2026', 'Sep 16, 2026', 'Sep 7, 2026', 'Aug 31, 2026']

function rng(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
}
const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

// ------------------------------------------------------------------ the appearances table
const visibleById = Object.fromEntries(visiblePrompts.map((v) => [`v${v.id}`, v]))

export const appearances = (() => {
  const r = rng(2026)
  const table = Object.fromEntries(trackedPrompts.map((p) => [p.id, {}]))

  // Dermasuri: exactly the dashboard's numbers
  const vis = trackedPrompts.filter((p) => p.status === 'visible')
  const citedIds = shuffle(vis.map((p) => p.id), r).slice(0, kpis.citedSources) // 30 cited prompts
  const withChat = citedIds.filter((id) => visibleById[id].platforms.includes('chatgpt'))
  const withGem = citedIds.filter((id) => visibleById[id].platforms.includes('gemini'))
  const pageSlots = [...citedPages.filter((pg) => pg.path), ...citedPagesOther].flatMap((pg) => Array(pg.count).fill(pg.path))
  trackedPrompts.forEach((p) => {
    const visible = p.status === 'visible'
    const ci = citedIds.indexOf(p.id)
    table[p.id][account.domain] = {
      visible,
      platforms: visible ? visibleById[p.id].platforms : [],
      cited: ci !== -1,
      citedPlatforms: ci === -1 ? [] : [...withAiMode(['google'], `cite${p.id}`, 0.4), ...(withChat.slice(0, 4).includes(p.id) ? ['chatgpt'] : []), ...(withGem.slice(0, 2).includes(p.id) ? ['gemini'] : [])],
      citedPage: ci === -1 ? null : pageSlots[ci] ?? '/',
    }
  })

  // competitors: missed prompts they already win first (≈45% of their target), the rest where Dermasuri also shows up
  for (const [domain, target] of Object.entries(TARGET)) {
    const wins = shuffle(missedPrompts.filter((m) => m.competitors.includes(domain)).map((m) => `m${m.id}`), r)
    const fromMissed = wins.slice(0, Math.round(target * 0.45))
    const fromVisible = shuffle(vis.map((p) => p.id), r).slice(0, target - fromMissed.length)
    const on = new Set([...fromMissed, ...fromVisible])
    trackedPrompts.forEach((p) => {
      const visible = on.has(p.id)
      const plats = visible ? withAiMode(['google', ...['gemini', 'chatgpt'].filter(() => r() < 0.45)], `${domain}|${p.id}`) : []
      const cited = visible && r() < 0.45
      table[p.id][domain] = {
        visible,
        platforms: plats,
        cited,
        citedPlatforms: cited ? withAiMode(['google'], `cite|${domain}|${p.id}`, 0.4) : [],
        citedPage: cited ? PAGES[domain][Math.floor(r() * PAGES[domain].length)] : null,
      }
    })
  }
  // ?competitors=many: each extra competitor named in exactly `target` answers, drawn from every tracked prompt (so one
  // can appear in more answers than you); its own random stream, so the brands above keep their rows
  const rx = rng(4242)
  for (const c of extraCompetitors) {
    const on = new Set(shuffle(trackedPrompts.map((p) => p.id), rx).slice(0, c.target))
    trackedPrompts.forEach((p) => {
      const visible = on.has(p.id)
      const cited = visible && rx() < 0.3
      table[p.id][c.domain] = {
        visible,
        platforms: visible ? withAiMode(['google', ...['gemini', 'chatgpt'].filter(() => rx() < 0.45)], `${c.domain}|${p.id}`) : [],
        cited,
        citedPlatforms: cited ? ['google'] : [],
        citedPage: cited ? ['/', '/products', '/blog'][Math.floor(rx() * 3)] : null,
      }
    })
  }
  return table
})()

// ------------------------------------------------------------------ helpers
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)
const weekly = [...historyEarlier, ...history]
const PLATFORM_ID = { aio: 'google', aimode: 'aimode', gemini: 'gemini', chatgpt: 'chatgpt', claude: 'claude', grok: 'grok' }

// all pages a brand is cited on (optionally on one engine), most cited first; deltas carried over from `prev`
function citedAllOf(domain, pid, prev = []) {
  const counts = {}
  trackedPrompts.forEach((p) => {
    const a = appearances[p.id][domain]
    if (!a.cited || (pid && !a.citedPlatforms.includes(pid))) return
    counts[a.citedPage] ??= { count: 0, platforms: new Set() }
    counts[a.citedPage].count++
    a.citedPlatforms.forEach((x) => counts[a.citedPage].platforms.add(x))
  })
  return Object.entries(counts).sort((a, b) => b[1].count - a[1].count)
    .map(([path, c]) => ({ path, count: c.count, delta: prev.find((x) => x.path === path)?.delta ?? 0, platforms: pid ? [pid] : [...c.platforms] }))
}

function buildBrandView(domain) {
  const focal = brandByDomain(domain) ?? OWN
  const own = focal.domain === OWN.domain
  const key = focal.key
  const rivals = TRACKED_BRANDS.filter((b) => b.domain !== focal.domain)
  const rowsFor = (pred) => trackedPrompts.filter((p) => pred(appearances[p.id][focal.domain], p))

  const visibleRows = rowsFor((a) => a.visible)
  const missedRows = rowsFor((a) => !a.visible)
  const citedCount = trackedPrompts.filter((p) => appearances[p.id][focal.domain].cited).length
  const last = weekly.at(-1), prev = weekly.at(-2)

  const kpiView = own ? kpis : {
    score: pct(visibleRows.length, TOTAL),
    scoreDelta: last[key] - prev[key],
    visible: visibleRows.length,
    missed: missedRows.length,
    total: TOTAL,
    citedSources: citedCount,
  }

  // per-platform mentioned / cited (same shape as platformStats)
  const platformView = own ? platformStats : platformList.map((pl) => {
    const pid = PLATFORM_ID[pl.id]
    return {
      ...pl,
      total: TOTAL,
      visible: trackedPrompts.filter((p) => appearances[p.id][focal.domain].platforms.includes(pid)).length,
      cited: trackedPrompts.filter((p) => appearances[p.id][focal.domain].citedPlatforms.includes(pid)).length,
      history: [],
    }
  })

  // prompt lists for the three prompt tables
  const winnersOf = (p) => rivals.filter((b) => appearances[p.id][b.domain].visible).map((b) => b.domain)
  const r = rng(key.length * 97)
  const visibleList = own ? visiblePrompts : visibleRows.map((p, i) => ({
    id: p.id, prompt: p.prompt, discovery: 'google', platforms: appearances[p.id][focal.domain].platforms, firstVisible: SYNC_DATES[Math.floor(r() * SYNC_DATES.length)] ?? SYNC_DATES[i % 5],
  }))
  const missedList = missedRows.map((p) => ({ id: p.id, prompt: p.prompt, topic: p.category, platforms: ['google', 'aimode', 'gemini', 'chatgpt'], winners: winnersOf(p) }))
  const rivalList = trackedPrompts
    .map((p) => ({ id: p.id, prompt: p.prompt, topic: p.category, winners: winnersOf(p), focalVisible: appearances[p.id][focal.domain].visible }))
    .filter((x) => x.winners.length)

  // sync history: Dermasuri keeps its real rows; competitors are rebuilt from their weekly share
  const syncView = own ? syncHistory : (() => {
    const pts = weekly.slice(-11) // 10 rows + the one before the oldest (for its delta)
    const visSet = visibleRows.map((p) => ({ id: p.id, prompt: p.prompt }))
    const misSet = missedRows.map((p) => ({ id: p.id, prompt: p.prompt }))
    let gi = 0, li = 0
    const rows = []
    for (let i = pts.length - 1; i >= 1; i--) {
      const v = pts[i][key], pv = pts[i - 1][key]
      const visible = Math.round((v / 100) * TOTAL), prevVisible = Math.round((pv / 100) * TOTAL)
      const dVisible = visible - prevVisible
      const lostN = 1 + (i % 2), gainedN = Math.max(0, lostN + dVisible), lostFinal = gainedN - dVisible
      const gained = Array.from({ length: gainedN }, () => visSet[gi++ % visSet.length])
      const lost = Array.from({ length: lostFinal }, () => misSet[li++ % misSet.length])
      rows.push({
        id: rows.length,
        date: `${pts[i].date}, 2026`,
        visibility: v,
        delta: v - pv,
        visible, missed: TOTAL - visible, total: TOTAL,
        cited: Math.round(visible * 0.4),
        changes: { vs: pts[i - 1].date, deltas: { citedPages: Math.round(dVisible * 0.4), missed: -dVisible }, gained, lost },
      })
    }
    // the oldest row has nothing before it in this window
    rows.at(-1).changes = null
    return rows
  })()

  // top cited pages
  const citedView = own ? citedPages : (() => {
    const counts = {}
    trackedPrompts.forEach((p) => {
      const a = appearances[p.id][focal.domain]
      if (!a.cited) return
      counts[a.citedPage] ??= { count: 0, platforms: new Set() }
      counts[a.citedPage].count++
      a.citedPlatforms.forEach((x) => counts[a.citedPage].platforms.add(x))
    })
    const sorted = Object.entries(counts).sort((a, b) => b[1].count - a[1].count)
    const top = sorted.slice(0, 5).map(([path, c], i) => ({ path, count: c.count, delta: [1, 0, -1, 1, 0][i], platforms: [...c.platforms] }))
    const rest = sorted.slice(5)
    if (rest.length) top.push({ path: null, label: `${rest.length} other page${rest.length === 1 ? '' : 's'}`, count: rest.reduce((n, [, c]) => n + c.count, 0), delta: 0, platforms: [] })
    return top
  })()

  // "you lead on N of 152 prompts": Dermasuri visible where the focal brand isn't
  const youLead = own ? null : trackedPrompts.filter((p) => appearances[p.id][OWN.domain].visible && !appearances[p.id][focal.domain].visible).length

  return {
    focal, own, isOwnBrand: own, rivals, total: TOTAL,
    kpis: kpiView,
    platforms: platformView,
    visiblePrompts: visibleList,
    missedPrompts: missedList,
    rivalPrompts: rivalList,
    syncHistory: syncView,
    syncTotal,
    citedPages: citedView,
    // every cited page, uncollapsed (Top cited pages shows them all when it has the room)
    citedAll: own ? [...citedPages.filter((c) => c.path), ...citedPagesOther] : citedAllOf(focal.domain, null, citedView),
    youLead,
    ownScore: kpis.score,
    historyKey: key,
    historySeries,
  }
}

// ------------------------------------------------------------------ engine filter
// One engine at a time ('all' | 'aio' | 'aimode' | 'gemini' | 'chatgpt' | 'claude' | 'grok'). Card ids → prompt-data ids.
// Google is two engines: 'aio' = Google AI Overview, 'aimode' = Google AI Mode (prompt data: 'google', 'aimode').
// display order everywhere (header menu, Platform visibility columns): most-used engines first
export const ENGINE_ORDER = ['aio', 'aimode', 'gemini', 'chatgpt', 'claude', 'grok'].filter((id) => id !== 'aimode' || platformList.some((p) => p.id === 'aimode'))
// The AI Mode split: from the first sync with an AI Mode score, AI Overview stops including AI Mode results. On AI
// Overview and All engines only (never AI Mode itself or the other engines): the score card says "Scoring updated
// <day>" with this ⓘ in place of its change line while the latest sync is that first one, and Visibility history
// marks the day (the same dashed marker as a scoring change). The split day comes from the data (the earliest AI
// Mode day); the mock's sample has AI Mode from the start, so only ?aimode=new shows it (the latest sync).
// ?setup=1: a Brand Setup change 3 days before the latest sync (Visibility history's "Setup changed <day>" marker;
// next to the AI Mode split or a scoring change the two labels stack). weekly / monthly: the chart's points.
export function setupPreview(weeklyPts = weekly, monthlyPts = historyMonthly) {
  try { if (new URLSearchParams(window.location.search).get('setup') !== '1') return null } catch { return null }
  const prev = weeklyPts.at(-2), mb = monthlyPts.at(-2)
  if (!prev) return null
  return { label: `Setup changed ${addDays(prev.date, 4)}`, weekly: { after: prev.date, frac: 4 / 7 }, monthly: mb ? { after: mb.date, frac: 0.9 } : null }
}
// "Sep 28" + 4 → "Oct 2" (the mock's short dates, 2026)
const addDays = (d, n) => { const t = new Date(`${d}, 2026 12:00`); t.setDate(t.getDate() + n); return t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
export const AIMODE_SPLIT_TIP = 'Google AI Mode is now counted separately, so Google AI Overview no longer includes AI Mode results.'
export function aiModeSplit(engine) {
  if (aiModePreview() !== 'new' || !(engine === 'all' || engine === 'aio')) return null
  const day = weekly.at(-1), prev = weekly.at(-2)
  const label = `Scoring updated ${day.date}`
  const month = historyMonthly.at(-1), monthBefore = historyMonthly.at(-2)
  const dom = Number(day.iso.slice(8, 10))
  return {
    day: day.date, latest: true, label, tip: AIMODE_SPLIT_TIP,
    // getHistory's scoring shape: the marker sits on the split sync's day
    scoring: { label, tip: AIMODE_SPLIT_TIP, weekly: { after: prev.date, frac: 1 }, monthly: month && monthBefore && month.iso.slice(0, 7) === day.iso.slice(0, 7) ? { after: monthBefore.date, frac: dom / 31 } : null },
  }
}
// name: the short label (chips, rows, columns); full: menus and drawer titles ("Google AI Overview", "Google AI Mode")
const FULL_NAME = { aio: 'Google AI Overview', aimode: 'Google AI Mode' }
export const ENGINES = ENGINE_ORDER.map((id) => platformList.find((p) => p.id === id)).filter(Boolean).map((p) => ({ id: p.id, name: p.name, full: FULL_NAME[p.id] ?? p.name }))
export const engineName = (id) => ENGINES.find((e) => e.id === id)?.name ?? 'All engines'
export const engineFullName = (id) => ENGINES.find((e) => e.id === id)?.full ?? 'All engines'
export const enginePid = (id) => PLATFORM_ID[id]

// ?noresult=gemini (or a comma list): that engine's latest scan returned no result (it failed or didn't answer). Its
// score in that scan is unknown: null, shown as "—", never 0 (CLAUDE.md §3). The All-engines score is unchanged (it
// averages the engines that answered). Tests set it with setNoResult.
let noResultOverride
export const noResultEngines = () => {
  if (noResultOverride !== undefined) return noResultOverride
  try { return (new URLSearchParams(window.location.search).get('noresult') || '').split(',').filter((id) => ENGINE_ORDER.includes(id)) } catch { return [] }
}
export const setNoResult = (list) => { noResultOverride = list; cache.clear() }
// did this engine's latest scan answer? ('all' always has a score: it averages the engines that did)
export const hasResult = (engine) => !engine || engine === 'all' || !noResultEngines().includes(engine)
// Older scans that failed on one engine (sample data): engine → the sync days (iso) with no result from it. Gemini's
// Sep 7 scan didn't complete (citationHistory's FAILED reads this): its Sync history row, history point and that week's
// mentions are null on Gemini, never estimated. The All-engines score that day averages the engines that answered.
export const FAILED_SCANS = { gemini: ['2026-09-07'] }
const syncDateOf = (iso) => { const w = weekly.find((x) => x.iso === iso); return w ? `${w.date}, ${iso.slice(0, 4)}` : null }
// the sync rows' dates ("Sep 7, 2026") with no result from this engine (the latest included, under ?noresult=)
export const failedSyncDates = (engine) => (FAILED_SCANS[engine] ?? []).map(syncDateOf).filter(Boolean)
// the days the history chart leaves a gap on this engine (null, never a drop to 0): its failed scans, and the latest
// sync when it had no result
export const engineGaps = (engine) => (!engine || engine === 'all' ? [] : [...(FAILED_SCANS[engine] ?? []), ...(hasResult(engine) ? [] : [weekly.at(-1).iso])])

const mentions = (domain, pid) => trackedPrompts.filter((p) => appearances[p.id][domain].platforms.includes(pid))
// a brand's share on one engine relative to its share on any engine: scales its weekly history
export function engineRatio(domain, engine) {
  if (!engine || engine === 'all') return 1
  const all = trackedPrompts.filter((p) => appearances[p.id][domain].visible).length
  return all ? mentions(domain, PLATFORM_ID[engine]).length / all : 0
}
export const engineScale = (engine) => Object.fromEntries(TRACKED_BRANDS.map((b) => [b.key, engineRatio(b.domain, engine)]))

function applyEngine(base, engine) {
  const pid = PLATFORM_ID[engine]
  const d = base.focal.domain
  const ratio = engineRatio(d, engine)
  const onEngine = new Set(mentions(d, pid).map((p) => p.id))
  const scaled = weekly.map((w) => Math.round(w[base.historyKey] * ratio))

  // prompt lists: only what this engine picks up (visible) / doesn't (missed)
  const visibleList = base.own
    ? base.visiblePrompts.filter((r) => r.platforms.includes(pid))
    : base.visiblePrompts.filter((r) => onEngine.has(r.id))
  const winnersOn = (p) => base.rivals.filter((b) => appearances[p.id][b.domain].platforms.includes(pid)).map((b) => b.domain)
  const missedList = base.own
    ? base.missedPrompts // Dermasuri's working table filters itself (PlatformFilter)
    : trackedPrompts.filter((p) => !onEngine.has(p.id)).map((p) => ({ id: p.id, prompt: p.prompt, topic: p.category, platforms: [pid], winners: winnersOn(p) }))
  const citedOn = trackedPrompts.filter((p) => appearances[p.id][d].citedPlatforms.includes(pid))

  // sync history: the same syncs, scaled to this engine
  const allCited = trackedPrompts.filter((p) => appearances[p.id][d].cited).length
  const citedRatio = allCited ? citedOn.length / allCited : 0
  const visIds = new Set(visibleList.map((r) => r.id))
  const syncRows = base.syncHistory.map((r) => ({
    ...r,
    visibility: Math.round(r.visibility * ratio),
    visible: Math.round(r.visible * ratio),
    missed: r.total - Math.round(r.visible * ratio),
    cited: Math.round(r.cited * citedRatio),
    changes: r.changes && { ...r.changes, gained: r.changes.gained.filter((g) => visIds.has(g.id)) },
  }))
  // the latest row is the score the card shows on this engine; an engine that never shows the brand loses nothing
  // the latest scan on this engine with no result, or an older one that failed (FAILED_SCANS): that row's numbers are
  // unknown (null), never 0 of 152 and never estimated
  const answered = hasResult(engine)
  if (syncRows[0]) syncRows[0].visibility = answered ? pct(onEngine.size, TOTAL) : null
  const failed = failedSyncDates(engine)
  syncRows.forEach((r, i) => {
    if ((i === 0 && !answered) || failed.includes(r.date)) Object.assign(r, { visibility: null, visible: null, missed: null, cited: null })
  })
  if (!ratio) syncRows.forEach((r) => { if (r.changes) r.changes = { ...r.changes, lost: [] } })
  syncRows.forEach((r, i) => { r.delta = i < syncRows.length - 1 ? pointsBetween(r.visibility, syncRows[i + 1].visibility) : Math.round(r.delta * ratio) })

  // top cited pages on this engine
  const counts = {}
  citedOn.forEach((p) => { const page = appearances[p.id][d].citedPage; counts[page] = (counts[page] ?? 0) + 1 })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const prevDelta = (path) => base.citedPages.find((c) => c.path === path)?.delta ?? 0
  const cited = sorted.slice(0, 5).map(([path, count]) => ({ path, count, delta: prevDelta(path), platforms: [pid] }))
  const rest = sorted.slice(5)
  if (rest.length) cited.push({ path: null, label: `${rest.length} other page${rest.length === 1 ? '' : 's'}`, count: rest.reduce((n, [, c]) => n + c, 0), delta: 0, platforms: [] })

  return {
    ...base,
    engine,
    // no result from this engine's latest scan: its score and counts are unknown (null, "—"), never 0
    kpis: answered ? {
      score: pct(onEngine.size, TOTAL),
      scoreDelta: scaled.at(-1) - scaled.at(-2),
      visible: onEngine.size,
      missed: TOTAL - onEngine.size, // not picked up by this engine
      total: TOTAL,
      citedSources: citedOn.length,
    } : { score: null, scoreDelta: null, visible: null, missed: null, total: TOTAL, citedSources: null },
    visiblePrompts: visibleList,
    missedPrompts: missedList,
    syncHistory: syncRows,
    citedPages: cited,
    citedAll: citedAllOf(d, pid, base.citedAll),
  }
}

// Prompt ids (in the view's table id space) where the focal brand's appearance matches pred(a, prompt).
// Dermasuri's tables use the original numeric ids (tracked "v12" → 12); competitor tables use tracked ids.
export function focalPromptIds(view, pred) {
  const d = view.focal.domain
  return trackedPrompts.filter((p) => pred(appearances[p.id][d], p)).map((p) => (view.own ? Number(p.id.slice(1)) : p.id))
}

const cache = new Map()
export function getBrandView(domain = OWN.domain, engine = 'all') {
  const k = `${domain}|${engine}`
  if (!cache.has(k)) {
    if (!cache.has(`${domain}|all`)) cache.set(`${domain}|all`, { ...buildBrandView(domain), engine: 'all' })
    if (engine !== 'all') cache.set(k, applyEngine(cache.get(`${domain}|all`), engine))
  }
  return cache.get(k)
}

// Setup → Competitors: tracked prompts where `domain` shows up alongside `withDomain` (null if `domain` isn't tracked)
export function sharedAnswers(domain, withDomain = OWN.domain) {
  if (!brandByDomain(domain)) return null
  return trackedPrompts.filter((p) => appearances[p.id][domain].visible && appearances[p.id][withDomain]?.visible).length
}

// ------------------------------------------------------------------ engine drawer ("Where ChatGPT mentions …")
// Mentions = prompts whose answer on this engine names the focal brand; citations = those that also link its site,
// grouped by page. engine 'all' = any engine (each row keeps the first engine, in ENGINE_ORDER, that mentions/cites it).
// "/p?utm_source=chatgpt.com&ref=x#top" → "/p?ref=x": utm_* parameters and the fragment don't make a different page
export function pagePath(url) {
  const [rest] = url.split('#')
  const [path, query = ''] = rest.split('?')
  const kept = query.split('&').filter((kv) => kv && !/^utm_/i.test(kv))
  return kept.length ? `${path}?${kept.join('&')}` : path
}

export function engineDetail(domain, engine = 'all') {
  const pids = engine === 'all' ? ENGINE_ORDER.map((id) => [id, PLATFORM_ID[id]]) : [[engine, PLATFORM_ID[engine]]]
  const mentions = []
  const pages = {}
  let citations = 0
  trackedPrompts.forEach((p) => {
    const a = appearances[p.id][domain]
    const on = pids.find(([, pid]) => a.platforms.includes(pid))
    const citedOn = pids.find(([, pid]) => a.citedPlatforms.includes(pid))
    if (on) mentions.push({ key: p.id, prompt: p.prompt, category: p.category, engine: on[0], cited: !!citedOn })
    if (citedOn) {
      citations++
      // ChatGPT links carry ?utm_source=chatgpt.com; the same page with or without tracking parameters is one page
      const url = citedOn[0] === 'chatgpt' ? `${a.citedPage}?utm_source=chatgpt.com` : a.citedPage
      ;(pages[pagePath(url)] ??= []).push({ key: p.id, prompt: p.prompt, engine: citedOn[0] })
    }
  })
  return {
    mentions,
    pages: Object.entries(pages).map(([path, prompts]) => ({ path, prompts })).sort((a, b) => b.prompts.length - a.prompts.length || a.path.localeCompare(b.path)),
    citations,
  }
}
