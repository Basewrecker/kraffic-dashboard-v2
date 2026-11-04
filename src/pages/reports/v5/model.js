// Reports (final design): the view for one report, in the prototype's anatomy (report-prototype.html): header, KPI
// tabs over the Visibility history card (one dataset per tab), a row of 2 panels, a row of 3 (Competitors full width
// in the CEO summary), the next steps, the footer.
//
// Written from the brand's facts in the API's shape (accountFacts), after the app's adapter (data/live-report.js) has
// read the question and resolved the options. Topic and engine on the prompt rows are the fields the app is adding;
// facts.proposed marks the other fields in docs/proposals-for-harsh.md (?fields=proposed). Nothing is estimated: a
// number with no history has no chart, a column with no data isn't shown, a panel with no rows is dropped.
// The caller passes `points` (the facts' points in the period, by the adapter's pointsIn) and `prev` (the syncs before).
import { ENGINE_NAMES, periodLabel } from '../../../data/reports.js'

export const ENGINE_DOMAIN = { aio: 'google.com', aimode: 'google.com', chatgpt: 'chatgpt.com', gemini: 'gemini.google.com', claude: 'claude.ai' }
export const ALL_ENGINES = ['aio', 'aimode', 'chatgpt', 'gemini', 'claude']
// engines in the one order every list uses (AI Overview, AI Mode, ChatGPT, Gemini, Claude), whatever order they came in
const inOrder = (ids) => [...new Set(ids)].filter(Boolean).sort((a, b) => ALL_ENGINES.indexOf(a) - ALL_ENGINES.indexOf(b))
export const NO_HISTORY = 'Not enough history yet: one scan so far'
export const KIND_NAME = { weekly: 'Weekly summary', client: 'Client update', ceo: 'CEO summary', rival: 'Competitor gap', content: 'Missing prompts' }
const MONTH = { Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' }
// the Visibility history card's competitor colours (theme/chart.js line-1…3), by share rank; the rest grey
export const LINE = ['var(--line-1)', 'var(--line-2)', 'var(--line-3)']

export const shortName = (name = '') => (name.length <= 14 ? name : name.replace(/^The\s+/i, '').split(/\s+/)[0])
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`
const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0] ?? '')
const groupBy = (rows, key) => {
  const m = new Map()
  rows.forEach((r) => { const k = key(r); if (k == null) return; if (!m.has(k)) m.set(k, []); m.get(k).push(r) })
  return [...m].map(([k, items]) => ({ key: k, items })).sort((a, b) => b.items.length - a.items.length)
}
const nameOf = (facts, domain) => (facts.competitors || []).find((c) => c.domain === domain)?.name ?? domain
// lowercase the first letter, unless the word is an acronym (HECM, KP)
const lower = (t) => (/^[A-Z]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1))
// "a calculators page", "an eligibility page"
const aPage = (topic) => `${/^[aeiou]/i.test(topic) ? 'an' : 'a'} ${lower(topic)} page`
// engine: the PlatformIcon id, so AI Overview and AI Mode (both google.com) get their own marks, not one favicon
const engine = (id) => ({ domain: ENGINE_DOMAIN[id], name: ENGINE_NAMES[id], engine: id })
const brandIcon = (domain, name) => ({ domain, name })

// a delta chip: the change over the period. tone: good / bad, or neutral when the change is neither (or zero)
export function delta(series, { unit = '', lowerIsBetter = false } = {}) {
  if (!series || series.length < 2) return null
  const n = series.at(-1) - series[0]
  return { text: `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}${unit}`, tone: n === 0 ? '' : (n > 0) !== lowerIsBetter ? 'good' : 'bad' }
}
const change = (n, suf = '') => (n == null ? null : { v: Math.abs(n), pre: n > 0 ? '+' : n < 0 ? '−' : '±', suf, tone: n > 0 ? 'up' : n < 0 ? 'dn' : '' })

// ---- the Visibility history card's dataset ---------------------------------------------------------------------------
// { focal, series, weekly, monthly, unit } in historyMany's shape: weekly = one row per sync, monthly = the month's
// average. lines: [{ key, domain, name, values (one per sync, null when missing) }], the focal one first.
function dataset(points, lines, { unit = '%', one, many } = {}) {
  const rows = points.map((p, i) => ({ date: p.date, ...Object.fromEntries(lines.map((l) => [l.key, l.values[i]])) }))
  const months = groupBy(points.map((p, i) => ({ ...p, i })), (p) => p.iso.slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key))
  const monthly = months.map((m) => {
    const d = new Date(`${m.key}-01T00:00:00`)
    const avg = (l) => { const v = m.items.map((p) => l.values[p.i]).filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null }
    return { date: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), ...Object.fromEntries(lines.map((l) => [l.key, avg(l)])) }
  })
  const f = lines[0]
  return {
    focal: { key: f.key, domain: f.domain, name: f.name },
    series: lines.map((l) => ({ key: l.key, label: l.domain, share: l.values.at(-1) ?? 0 })),
    weekly: rows, monthly, ...(unit === '%' ? {} : { unit: 'count', one, many }),
  }
}

export function buildReport5({ facts, built, points, prev = [], prompt = '', read = null }) {
  const opts = built.opts
  const kind = read?.kind ?? built.kind
  const history = points.length >= 2
  const ctx = { facts, opts, points, prev, history, start: points[0], latest: points.at(-1), proposed: !!facts.proposed, brand: facts.name, N: facts.prompts, client: opts.audience === 'client' }
  // every series the card can draw: the whole stored history (the card's own range picks the window)
  ctx.all = [...prev, ...points]
  const body = kind === 'rival' ? competitor(ctx) : kind === 'ceo' ? ceo(ctx) : kind === 'content' ? missing(ctx) : weekly(ctx)

  const ran = (opts.engines?.length ? opts.engines.filter((e) => facts.ran.includes(e)) : facts.ran) || []
  const off = ALL_ENGINES.filter((e) => !ran.includes(e))
  const range = ctx.start ? (ctx.start.date === ctx.latest.date ? ctx.latest.date : `${ctx.start.date} – ${ctx.latest.date}`) : periodLabel(opts.period)
  const footer = [history ? `Weekly syncs, ${range}` : `One sync, ${range}`, ran.map((e) => ENGINE_NAMES[e]).join(', '), off.length ? `${list(off.map((e) => ENGINE_NAMES[e]))} didn’t run` : null].filter(Boolean).join(' · ')
  return { ...body, syncs: ctx.all.length, kind, brand: facts.name, question: String(prompt || '').trim() || body.question, read: read?.line ?? null, range, period: opts.period, history, footer }
}

// ---- shared pieces ---------------------------------------------------------------------------------------------------
const col = (label, w = 56, extra = {}) => ({ label, w, ...extra })
// indicator cells (the shared coverage marker): ring "x/y", tick (all), dashed ring (none), cross (lost); a pie for a share
const ring = (found, applies, tone = 'ink', text = `${found}/${applies}`) => ({ mk: { found, applies, tone }, text })
const tick = (tone = 'ink', text = '') => ({ mk: { found: 1, applies: 1, tone }, text })
const none = (text = '') => ({ mk: { found: 0, applies: 1 }, text })
const cross = (text = '') => ({ mk: { cross: true }, text })
const pie = (v) => ({ pie: v, v, suf: '%' })
const missedIn = (facts, topic) => (facts.missedRows || []).filter((x) => x.topic === topic).length
const tab = (key, label, cols, rows, extra = {}) => ({ key, label, cols, rows, ...extra })
// plain: rows without bars, hairline dividers; a panel keeps the tabs that have rows, and with none it's dropped
function panel(id, tabs, { solo = false, plain = false, full = false } = {}) {
  const kept = tabs.filter((t) => t.rows.length)
  return kept.length ? { id, tabs: kept, solo: solo || kept.length === 1, plain, full } : null
}
const topicOfRow = (rows, p) => rows?.find((x) => x.prompt === p)?.topic ?? null
const inPeriodOf = (ctx) => (arr) => (arr && ctx.history && arr.length >= ctx.points.length ? arr.slice(-ctx.points.length) : null)
const seriesOf = (ctx, k) => (ctx.history && ctx.points.every((p) => p[k] != null) ? ctx.points.map((p) => p[k]) : null)
// a series over every stored sync (prev + period), for the card
const allOf = (ctx, k) => (ctx.all.length >= 2 && ctx.all.every((p) => p[k] != null) ? ctx.all.map((p) => p[k]) : null)

// a KPI: label, value, delta chip, and the card's dataset (null: no history, the card body says so)
function kpi(k) {
  return { ...k, delta: k.delta === undefined ? delta(k.series, { unit: k.unit === '%' ? ' pts' : '', lowerIsBetter: k.lowerIsBetter }) : k.delta }
}

// Gained / Lost, grouped by topic: a header row per topic (+4 / −2), its prompts under it (engine + prompt); no bars
function changeTab(key, label, prompts, rowsOf, sign, facts) {
  const groups = groupBy(prompts.map((p) => ({ p, topic: topicOfRow(rowsOf, p) ?? 'Other' })), (x) => x.topic)
  const engineOf = (p) => (facts.missedRows || []).find((r) => r.prompt === p)?.engines?.[0]
  const rows = groups.flatMap((g) => [
    { t: g.key, group: true, vals: [{ v: g.items.length, pre: sign === 'up' ? '+' : '−', tone: sign }] },
    ...g.items.map((x) => ({ t: x.p, sub: true, icon: engineOf(x.p) ? engine(engineOf(x.p)) : null, topic: g.key, vals: [sign === 'up' ? tick('good') : cross()] })),
  ])
  return tab(key, label, [col('Since last sync', 104)], rows, { bar: false, summary: `${plural(prompts.length, 'prompt')} in ${plural(groups.length, 'topic')}` })
}

// share of answers: you and every competitor, latest scan
function shareTab(facts, brand, label = 'Share of answers') {
  const rows = [{ t: brand, n: facts.youShare, domain: facts.domain }, ...(facts.competitors || []).map((c) => ({ t: c.name, n: c.share, domain: c.domain }))]
    .filter((x) => x.n != null).sort((a, b) => b.n - a.n).map((x) => ({ t: x.t, icon: brandIcon(x.domain, x.t), vals: [pie(x.n)] }))
  return tab('brands', label, [col('Share', 84)], rows, { bar: false, summary: `${plural(rows.length, 'brand')} named in the latest scan` })
}

// Engines: named · not named · share · change since start · sparkline of share (the last two need engines[].points);
// the engines that didn't run are one muted line at the bottom
function enginesTab(ctx, { label = 'Engines', named = 'Named', notNamed = 'Not named', you = null, them = null } = {}) {
  const { facts, N } = ctx
  const ran = ALL_ENGINES.filter((id) => (facts.ran || []).includes(id))
  const off = ALL_ENGINES.filter((id) => !(facts.ran || []).includes(id))
  const inPeriod = inPeriodOf(ctx)
  const hasHist = ran.some((id) => inPeriod(facts.engines?.find((e) => e.id === id)?.points?.map((p) => p.share)))
  const rows = ran.map((id) => {
    const e = facts.engines?.find((x) => x.id === id)
    const v = you ? you(id) : e?.visible ?? 0
    const w = them ? them(id) : N - v
    const share = them ? (v + w ? Math.round((v / (v + w)) * 100) : 0) : Math.round((v / N) * 100)
    const hist = inPeriod(e?.points?.map((p) => p.share))
    // the 48×16 sparkline: prompts named per sync (the engine's share × prompts)
    return { t: ENGINE_NAMES[id], icon: engine(id), vals: [{ v }, ...(notNamed ? [{ v: w, tone: them && w > v ? 'dn' : '' }] : []), pie(share)], spark: hasHist && hist ? { values: hist.map((x) => Math.round((x / 100) * N)), color: 'var(--plot)', w: 48, h: 16 } : null }
  })
  // an engine with no data: a dashed ring and "didn't run"
  // an engine that didn't run: the dashed ring and "didn't run" across the number columns
  const offRows = off.map((id) => ({ t: ENGINE_NAMES[id], icon: engine(id), muted: true, span: none('didn’t run') }))
  // no 'Not named' column when it isn't asked for (it follows from Named and Share)
  const cols = [col(named, 72), ...(notNamed ? [col(notNamed, 72)] : []), col('Share', 120, { gap: 32 })]
  // with them (Competitor gap) and a sparkline it needs a full row; otherwise it fits a third
  return tab('engines', label, cols, [...rows, ...offRows], { bar: false, spark: hasHist, sparkW: 56, wide: hasHist && !!notNamed, summary: `${plural(ran.length, 'engine')} ran` })
}

const yourPagesTab = (facts, brand, label = 'Your pages') => tab('yours', label, [col('Cited')], (facts.cited || []).map((p) => ({ t: p.path, mid: true, title: `${facts.domain}${p.path}`, icon: brandIcon(facts.domain, brand), bar: p.n, vals: [{ v: p.n }] })), { summary: `${plural((facts.cited || []).length, 'page')} cited in the latest scan` })

// a next step: the action, its topic, the engines, your page that would carry it (or "New page"), +N, and a ring for how
// much of the topic it would win back (of: the topic's prompts)
// (now: your prompts in the topic today, when known; rival: whose page AI cites for it; update: you have a page for it)
function step({ t, topic, n, prompts, engines = [], why, page = undefined, of = null, now = null, rival = null, theirPage = null, yourPage = null, items = null }) {
  return { t, topic, n, prompts, engines, page, why, of, now, rival, theirPage, yourPage, update: !!yourPage, items }
}
const youIn = (facts, topic) => facts.topics?.find((x) => x.topic === topic)?.visible ?? null
// a step's prompts, for its card and brief: the engines it's lost on, the brands named on it, and whether you are
// (a prompt you're missing names its missed row's competitors; one you're named on but they win names you both)
function stepItems(facts, prompts, { engineOf = () => null, rival = null } = {}) {
  const you = { domain: facts.domain, name: facts.name, you: true }
  return prompts.map((prompt) => {
    const row = (facts.missedRows || []).find((r) => r.prompt === prompt)
    const engines = inOrder([engineOf(prompt), ...(row?.engines || [])])
    const named = row ? row.competitors.map((d) => ({ domain: d, name: nameOf(facts, d) })) : [you, ...(rival ? [{ domain: rival.domain, name: rival.name }] : [])]
    return { prompt, engines, named, you: !row }
  })
}
// the prompts in a topic: named (proposed topics[].visible) + missed; live, the missed ones
const topicTotal = (facts, topic, atLeast = 0) => Math.max(atLeast, (facts.topics?.find((x) => x.topic === topic)?.visible ?? 0) + missedIn(facts, topic))
// the page AI cites for a competitor on a topic, and yours (proposed competitors[].why)
// the rival page / your page fields of a step, from whyFor
const stepCites = (facts, topic) => { const w = whyFor(facts, topic); return w ? { rival: { name: shortName(w.c.name), domain: w.c.domain, icon: brandIcon(w.c.domain, w.c.name) }, theirPage: w.w.them, yourPage: w.w.you ?? null } : {} }
const whyFor = (facts, topic) => (facts.competitors || []).map((c) => ({ c, w: c.why?.find((w) => w.theme === topic) })).find((x) => x.w?.them) ?? null

// each brand's chart colour, as its chip in the Visibility history card: you ink; the competitors in the card's slot
// order (by share, or the named rival first in Competitor gap), the rest grey
function colorsOf(facts, first = null) {
  const ranked = [...(facts.competitors || [])].filter((c) => c.share != null).sort((a, b) => b.share - a.share)
  const order = first ? [first, ...ranked.filter((c) => c.domain !== first.domain)] : ranked
  const m = new Map([[facts.domain, 'var(--line-you)']])
  order.forEach((c, i) => m.set(c.domain, LINE[i] ?? 'var(--data-c2)'))
  return (domain) => m.get(domain) ?? 'var(--data-c2)'
}
// a topic's prompts: you (proposed per-topic count), the competitors named on the ones you're missing (logos, most
// often first), nobody, the engines you're missing them on
function topicFacts(facts, topic, colorOf) {
  const rows = (facts.missedRows || []).filter((r) => r.topic === topic)
  const named = new Map()
  rows.forEach((r) => r.competitors.forEach((d) => named.set(d, (named.get(d) ?? 0) + 1)))
  const comp = rows.filter((r) => r.competitors.length).length
  const you = youIn(facts, topic)
  const logos = [...named].sort((a, b) => b[1] - a[1]).map(([d]) => ({ domain: d, name: nameOf(facts, d) }))
  return {
    you, comp, nobody: rows.length - comp, missing: rows.length,
    logos: { list: logos.slice(0, 3), more: Math.max(0, logos.length - 3) },
    engines: inOrder(rows.flatMap((r) => r.engines || [])),
    split: { parts: [...(you != null ? [{ v: you, color: 'var(--line-you)', label: 'you' }] : []), { v: comp, color: 'var(--rep-bad)', label: 'a competitor', alpha: 0.7 }, { v: rows.length - comp, label: 'nobody', hatched: true }] },
  }
}

// What moved (every report): a row per topic (gained · lost · net, a diverging bar, the engines it moved on); a row
// opens to its prompts. Losses first, then gains by size
function movedOf(ctx, labels = { title: 'What moved', gained: 'Gained', lost: 'Lost' }) {
  const { facts, history } = ctx
  const engineOf = (p) => (facts.missedRows || []).find((r) => r.prompt === p)?.engines ?? []
  const byTopic = new Map()
  const add = (p, rowsOf, kind) => {
    const t = topicOfRow(rowsOf, p) ?? 'Other'
    const m = byTopic.get(t) ?? { topic: t, gained: [], lost: [] }
    m[kind].push({ prompt: p, engines: engineOf(p), kind }); byTopic.set(t, m)
  }
  ;(history ? facts.gained || [] : []).forEach((p) => add(p, facts.gainedRows, 'gained'))
  ;(history ? facts.lost || [] : []).forEach((p) => add(p, facts.lostRows, 'lost'))
  const rows = [...byTopic.values()].map((m) => ({ ...m, net: m.gained.length - m.lost.length, engines: inOrder([...m.gained, ...m.lost].flatMap((x) => x.engines)) }))
    .sort((a, b) => (a.lost.length > 0) !== (b.lost.length > 0) ? (a.lost.length > 0 ? -1 : 1) : a.lost.length ? b.lost.length - a.lost.length : b.net - a.net)
  return rows.length ? { ...labels, col: 'Since last sync', rows } : null
}

// fewer than 3 syncs: no time chart. The snapshot: each brand's share this sync (in its chart colour), and a brand ×
// engine grid where the data has it (you; the rival with the proposed head-to-head)
function snapshotOf(ctx, rival = null) {
  const { facts, N } = ctx
  const ranked = [...(facts.competitors || [])].filter((c) => c.share != null).sort((a, b) => b.share - a.share)
  const shares = [{ name: facts.name, domain: facts.domain, share: facts.youShare, color: 'var(--line-you)', you: true }, ...ranked.map((c, i) => ({ name: c.name, domain: c.domain, share: c.share, color: LINE[i] ?? 'var(--data-c2)' }))]
    .filter((x) => x.share != null).sort((a, b) => b.share - a.share)
  const ran = ALL_ENGINES.filter((id) => (facts.ran || []).includes(id))
  const h = rival ? (facts.headToHead || []).find((x) => x.domain === rival.domain) : null
  // By engine: a row per engine, a bar per brand that has per-engine data (you; the rival with the head-to-head)
  const colorOf = colorsOf(facts, rival)
  const engines = ran.map((id) => {
    const v = facts.engines?.find((e) => e.id === id)?.visible
    const e = h?.engines?.find((x) => x.id === id)
    const bars = [
      ...(v != null ? [{ name: facts.name, domain: facts.domain, share: Math.round((v / N) * 100), named: v, color: colorOf(facts.domain) }] : []),
      ...(e && rival ? [{ name: rival.name, domain: rival.domain, share: Math.round((e.them / N) * 100), named: e.them, color: colorOf(rival.domain) }] : []),
    ]
    return { id, bars }
  }).filter((x) => x.bars.length)
  return { shares, engines: engines.length ? engines : null }
}

// ---- Competitor gap ------------------------------------------------------------------------------------------------
function competitor(ctx) {
  const { facts, opts, points, history, proposed, brand, N } = ctx
  const rivals = facts.competitors || []
  const h2h = facts.headToHead || []
  const missedRows = facts.missedRows || []
  const onMissed = (c) => missedRows.filter((x) => x.competitors.includes(c.domain)).length
  const r = rivals.find((c) => c.key === opts.compare?.[0]) ?? rivals.find((c) => h2h.some((h) => h.domain === c.domain)) ?? [...rivals].sort((a, b) => onMissed(b) - onMissed(a))[0]
  const R = shortName(r.name)
  const h = h2h.find((x) => x.domain === r.domain)
  const colorOf = colorsOf(facts, r)
  const wins = h ? h.wins : missedRows.filter((x) => x.competitors.includes(r.domain)).map((x) => ({ prompt: x.prompt, topic: x.topic, engine: x.engines?.[0] ?? null }))
  const winTopics = groupBy(wins, (w) => w.topic)
  const inPeriod = inPeriodOf(ctx)
  const ranked = [...rivals].filter((c) => c.share != null).sort((a, b) => b.share - a.share)
  const order = [r, ...ranked.filter((c) => c !== r)]

  // share of voice, every brand (proposed history; live: the latest scan only, one bar per brand)
  const shareAll = proposed && ctx.all.every((p) => p.share != null) && rivals.every((c) => c.points?.length >= ctx.all.length)
  const shareDs = shareAll
    ? dataset(ctx.all, [{ key: 'you', domain: facts.domain, name: brand, values: ctx.all.map((p) => p.share) }, ...order.map((c) => ({ key: c.key, domain: c.domain, name: c.name, values: c.points.slice(-ctx.all.length).map((p) => p.share) }))])
    : dataset([ctx.latest], [{ key: 'you', domain: facts.domain, name: brand, values: [facts.youShare] }, ...order.map((c) => ({ key: c.key, domain: c.domain, name: c.name, values: [c.share] }))])
  const shareNote = shareAll ? null : 'Share history isn’t in your data yet: the latest scan only.'
  const namedAll = allOf(ctx, 'visible')
  const theyWin = h?.theyWin, youWin = h?.youWin
  const winsDs = h && theyWin?.length >= ctx.all.length ? dataset(ctx.all, [{ key: 'you', domain: facts.domain, name: brand, values: youWin.slice(-ctx.all.length) }, { key: r.key, domain: r.domain, name: r.name, values: theyWin.slice(-ctx.all.length) }], { unit: 'count' }) : null
  const picks = [r.key, ...ranked.filter((c) => c !== r).slice(0, 2).map((c) => c.key)]

  const kpis = [
    kpi({ id: 'rival', label: `${R}’s share of voice`, value: `${r.share}%`, series: inPeriod(r.points?.map((p) => p.share)), unit: '%', lowerIsBetter: true, ds: shareDs, note: shareNote, title: 'Share of voice', subtitle: `${R} vs you and the other brands`, picks }),
    kpi({ id: 'named', label: 'Prompts naming you', value: (points.at(-1)?.visible ?? facts.visible).toLocaleString(), series: seriesOf(ctx, 'visible'), unit: 'prompts', ds: namedAll ? dataset(ctx.all, [{ key: 'you', domain: facts.domain, name: brand, values: namedAll }], { unit: 'count' }) : null, title: 'Prompts naming you', subtitle: `Of your ${N} prompts, by sync`, compare: false }),
    kpi({ id: 'wins', label: 'Prompts they win', value: wins.length.toLocaleString(), series: inPeriod(theyWin), unit: 'prompts', lowerIsBetter: true, ds: winsDs, title: 'Prompts each of you wins', subtitle: `You vs ${R}, by sync`, picks: [r.key] }),
    kpi({ id: 'share', label: 'Your share of voice', value: `${facts.youShare}%`, series: proposed ? seriesOf(ctx, 'share') : null, unit: '%', ds: shareDs, note: shareNote, title: 'Share of voice', subtitle: 'You vs the brands you track', picks }),
  ]

  // Topics: every topic, you vs them (proposed per-topic counts); live, the topics of the prompts you're missing
  const topicRows = proposed && facts.topics?.length
    ? facts.topics.map((t) => ({ t: t.topic, you: t.visible, them: t.competitors.find((c) => c.domain === r.domain)?.n ?? 0 }))
      .sort((a, b) => (b.them - b.you) - (a.them - a.you))
      .map((t) => { const total = t.you + missedIn(facts, t.t); const f = topicFacts(facts, t.t, colorOf); return { t: t.t, click: winTopics.some((g) => g.key === t.t) ? t.t : null, vals: [{ logos: f.logos, engines: f.engines }, { split: f.split }, ring(t.you, Math.max(total, t.you), t.them > t.you ? 'bad' : 'ink'), { v: t.them, tone: t.them > t.you ? 'dn' : '' }] } })
    : groupBy(missedRows, (x) => x.topic).map((g) => {
      const them = g.items.filter((x) => x.competitors.includes(r.domain)).length
      const f = topicFacts(facts, g.key, colorOf)
      return { t: g.key, click: them ? g.key : null, them, vals: [{ logos: f.logos, engines: f.engines }, { split: f.split }, ring(them, g.items.length, them ? 'bad' : 'ink'), { v: g.items.length }] }
    }).sort((a, b) => b.them - a.them || b.vals[1].v - a.vals[1].v)
  const lostSet = new Set(history ? facts.lost || [] : [])
  const missedSet = new Set(missedRows.map((x) => x.prompt))
  // Prompts: engine · prompt · topic · status (named / not named / lost); "weeks named" needs missedRows[].streak
  const promptRows = wins.map((w) => {
    const status = lostSet.has(w.prompt) ? cross('lost') : missedSet.has(w.prompt) ? none('not named') : tick('ink', 'named')
    return { t: w.prompt, icon: w.engine ? engine(w.engine) : null, topic: w.topic, vals: [{ text: w.topic ?? '', tone: 'muted' }, status] }
  })
  const theirs = (r.cited || []).map((p) => ({ t: p.path, icon: brandIcon(r.domain, r.name), bar: p.n, vals: [{ text: (p.topics || []).join(', '), tone: 'muted' }, { v: p.n }] }))
  const engTab = enginesTab(ctx, { label: 'Engines', named: 'You', notNamed: 'Them', you: h?.engines?.length ? (id) => h.engines.find((e) => e.id === id)?.you ?? 0 : null, them: (id) => (h?.engines?.find((e) => e.id === id)?.them ?? wins.filter((w) => w.engine === id).length) })
  const gained = changeTab('gained', 'Gained', history ? facts.gained || [] : [], facts.gainedRows, 'up', facts)
  const lost = changeTab('lost', 'Lost', history ? facts.lost || [] : [], facts.lostRows, 'dn', facts)

  const row2 = [
    panel('topics', [tab('topics', 'Topics', [col('Named instead', 150, { text: true }), col('Split', 184, { text: true }), ...(proposed && facts.topics?.length ? [col('You', 96), col('Them')] : [col('Them', 96), col('Missing', 72)])], topicRows, { bar: false, summary: `${plural(topicRows.length, 'topic')} · ${winTopics.length} where ${R} wins` }),
      tab('prompts', 'Prompts', [col('Topic', 160, { text: true }), col('Status', 120)], promptRows, { bar: false, summary: `${plural(promptRows.length, 'prompt')} ${R} wins` })]),
    panel('pages', [tab('theirs', 'Their pages', [col('Topic', 160, { text: true }), col('Cited')], theirs, { summary: `${plural(theirs.length, 'page')} of ${R}’s cited on these topics` }), yourPagesTab(facts, brand)]),
  ].filter(Boolean)
  // layout: the expandable lists full width (Topics / Prompts, What moved); the short panels together
  const blocks = [
    { panel: row2[0] }, { moved: movedOf(ctx) },
    { panel: row2[1] }, { panel: panel('engines', [engTab], { solo: true, plain: true }) }, { panel: panel('brands', [shareTab(facts, brand)], { solo: true }) },
  ].filter((b) => b.panel || b.moved)
  const row3 = []

  const steps = winTopics.length ? {
    title: 'Close the gap', col: 'Prompts it could win',
    rows: winTopics.slice(0, 3).map((g) => {
      const w = r.why?.find((x) => x.theme === g.key)
      return step({
        t: w?.you ? `Add ${lower(g.key)} answers to ${w.you.path}` : `Write ${aPage(g.key)}`, topic: g.key, n: g.items.length, prompts: g.items.map((x) => x.prompt),
        of: topicTotal(facts, g.key, g.items.length), now: youIn(facts, g.key),
        rival: { name: R, domain: r.domain, icon: brandIcon(r.domain, r.name) }, theirPage: w?.them ?? null, yourPage: w?.you ?? null,
        items: stepItems(facts, g.items.map((x) => x.prompt), { engineOf: (p) => g.items.find((x) => x.prompt === p)?.engine, rival: r }),
        engines: inOrder(g.items.map((x) => x.engine)).map(engine),
        page: w ? (w.you ? w.you.path : 'New page') : undefined,
        why: w?.them ? `${R}’s ${w.them.path} is cited in ${plural(w.them.n, 'answer')}. ${w.you ? `Yours, ${w.you.path}, in ${w.you.n}.` : 'You have no page for this.'}` : `${R} is named on ${g.items.length} of these prompts and you aren’t.`,
      })
    }),
  } : null

  const top2 = winTopics.slice(0, 2).map((g) => lower(g.key))
  const mostly = top2.length ? `, mostly ${top2.join(' and ')}` : ''
  const answer = wins.length ? (h ? `${R} wins ${wins.length} of your ${N} prompts${mostly}.` : `${R} is named on ${wins.length} of your ${N} prompts where you aren’t${mostly}.`) : `${R} isn’t named on any prompt without you.`
  return { question: `Where is ${R} beating us?`, answer, kpis, defaultKpi: kpis.find((k) => k.id === 'wins' && k.ds) ? 'wins' : 'named', blocks, snapshot: snapshotOf(ctx, r), steps }
}

// ---- Weekly summary / Client update --------------------------------------------------------------------------------
function weekly(ctx) {
  const { facts, points, history, proposed, brand, N, client } = ctx
  const W = client
    ? { score: 'Visibility score', named: 'Questions you show up for', gained: 'New', lost: 'Dropped', topics: 'Topics that moved', engines: 'Where you show up', pages: 'Your pages AI uses', steps: 'Win these back', noun: 'questions', one: 'question', shown: 'Shown', not: 'Not shown' }
    : { score: 'Visibility score', named: 'Prompts named', gained: 'Gained', lost: 'Lost', topics: 'Topics moved', engines: 'Engines', pages: 'Your pages cited', steps: 'Fix what moved', noun: 'prompts', one: 'prompt', shown: 'Named', not: 'Not named' }
  const visible = points.at(-1)?.visible ?? facts.visible
  const gainedList = history ? facts.gained || [] : []
  const lostList = history ? facts.lost || [] : []
  const you = (k, values, unit = 'count', one = W.one, many = W.noun) => (values ? dataset(ctx.all, [{ key: 'you', domain: facts.domain, name: brand, values }], { unit, one, many }) : null)
  const flowAll = proposed && ctx.all.slice(1).every((p) => p.gained != null) ? ctx.all : null
  const kpis = [
    kpi({ id: 'score', label: W.score, value: `${points.at(-1)?.score ?? facts.score}`, series: seriesOf(ctx, 'score'), unit: '', ds: you('score', allOf(ctx, 'score'), 'count', 'point', 'points'), title: W.score, subtitle: 'Out of 100, by sync', compare: false }),
    kpi({ id: 'named', label: W.named, value: visible.toLocaleString(), series: seriesOf(ctx, 'visible'), unit: W.noun, ds: you('named', allOf(ctx, 'visible')), title: W.named, subtitle: `Of your ${N} ${W.noun}, by sync`, compare: false }),
    ...(history ? [
      kpi({ id: 'gained', label: W.gained, value: `${gainedList.length}`, delta: null, ds: flowAll ? dataset(flowAll.slice(1), [{ key: 'you', domain: facts.domain, name: `${W.gained} at each sync`, values: flowAll.slice(1).map((p) => p.gained) }], { unit: 'count', one: W.one, many: W.noun }) : null, title: `${W.noun[0].toUpperCase()}${W.noun.slice(1)} ${W.gained.toLowerCase()}`, subtitle: 'At each sync, vs the sync before', compare: false }),
      kpi({ id: 'lost', label: W.lost, value: `${lostList.length}`, delta: null, ds: flowAll ? dataset(flowAll.slice(1), [{ key: 'you', domain: facts.domain, name: `${W.lost} at each sync`, values: flowAll.slice(1).map((p) => p.lost) }], { unit: 'count', one: W.one, many: W.noun }) : null, title: `${W.noun[0].toUpperCase()}${W.noun.slice(1)} ${W.lost.toLowerCase()}`, subtitle: 'At each sync, vs the sync before', compare: false }),
    ] : []),
  ]

  const moved = movedOf(ctx, { title: client ? 'What changed' : 'What moved', gained: W.gained, lost: W.lost })
  const movedRows = moved?.rows ?? []
  const eng = enginesTab(ctx, { label: W.engines, named: W.shown, notNamed: null })
  const blocks = [
    { moved },
    { panel: panel('engines', [eng], { solo: true, plain: true }) },
    { panel: panel('brands', [shareTab(facts, brand, client ? 'Share of AI answers' : 'Share of answers')], { solo: true }) },
    { panel: panel('pages', [yourPagesTab(facts, brand, W.pages)], { solo: true }) },
  ].filter((b) => b.panel || b.moved)

  // Next moves: win back each topic you lost prompts in, then build on the biggest gains (up to 3 cards). "was → now":
  // your prompts in the topic before and after (needs the per-topic counts; proposed topics[])
  const total = (t) => topicTotal(facts, t)
  const items = (list, kind) => list.map((x) => ({ prompt: x.prompt, engines: x.engines, won: kind === 'gained' }))
  const winBack = movedRows.filter((m) => m.lost.length).map((m) => {
    const now = youIn(facts, m.topic)
    return { kind: 'back', t: `Win back ${lower(m.topic)}`, topic: m.topic, n: m.lost.length, engines: m.engines,
      now, was: now != null ? now + m.lost.length - m.gained.length : null, of: now != null ? total(m.topic) : null,
      // the brands named on the lost prompts now
      naming: [...new Map(m.lost.flatMap((x) => (facts.missedRows || []).find((r) => r.prompt === x.prompt)?.competitors ?? []).map((d) => [d, { domain: d, name: nameOf(facts, d) }])).values()].slice(0, 3),
      rows: items(m.lost, 'lost'), prompts: m.lost.map((x) => x.prompt), why: `You were named on ${plural(m.lost.length, 'of these prompts', 'of these prompts')} at the sync before and aren’t now.` }
  })
  const buildOn = movedRows.filter((m) => !m.lost.length && m.gained.length).sort((a, b) => b.gained.length - a.gained.length).map((m) => {
    const now = youIn(facts, m.topic)
    const still = (facts.missedRows || []).filter((r) => r.topic === m.topic).map((r) => ({ prompt: r.prompt, engines: r.engines || [], won: false }))
    return { kind: 'build', t: `Build on ${lower(m.topic)}`, topic: m.topic, n: m.gained.length, engines: m.engines,
      now, was: now != null ? now - m.gained.length : null, of: now != null ? total(m.topic) : null,
      rows: still.length ? still : items(m.gained, 'gained'), defend: !still.length, prompts: (still.length ? still : m.gained).map((x) => x.prompt),
      why: still.length ? `You gained ${plural(m.gained.length, 'prompt')} here; ${plural(still.length, 'prompt')} in the topic still don’t name you.` : `You gained ${plural(m.gained.length, 'prompt')} here and are named on every prompt in the topic.` }
  })
  const moves = [...winBack, ...buildOn].slice(0, 3)
  const steps = moves.length ? { title: 'Next moves', moves } : null

  const d = history ? visible - points[0].visible : null
  const start = points[0]?.date
  const answer = client
    ? (history ? `You showed up in AI answers for ${visible} of ${N} questions, ${d >= 0 ? `${d} more` : `${-d} fewer`} than ${start}.` : `You showed up in AI answers for ${visible} of ${N} questions in the first scan.`)
    : (history ? `${brand} is named on ${visible === N ? `all ${N}` : `${visible} of ${N}`} prompts, ${d > 0 ? `up ${d}` : d < 0 ? `down ${-d}` : 'unchanged'} since ${start}.` : `${brand} is named on ${visible} of ${N} prompts in its first scan.`)
  const when = { week: 'this week', '30d': 'this month', quarter: 'this quarter' }[ctx.opts.period] ?? 'lately'
  return { question: client ? `Client update: ${MONTH[ctx.latest?.date?.split(' ')[0]] ?? 'latest scan'}` : `What moved ${when}?`, answer, kpis, defaultKpi: 'named', blocks, snapshot: snapshotOf(ctx), steps }
}

// ---- CEO summary ---------------------------------------------------------------------------------------------------
function ceo(ctx) {
  const { facts, points, proposed, brand, N, history } = ctx
  const inPeriod = inPeriodOf(ctx)
  const ranked = [...(facts.competitors || [])].filter((c) => c.share != null).sort((a, b) => b.share - a.share)
  const top = ranked[0]
  const T = shortName(top.name)
  const lead = facts.youShare - top.share
  const ts = proposed ? [...(facts.topicShare || [])].sort((a, b) => b.lead - a.lead) : []
  const led = ts.filter((t) => t.lead > 0).length
  const shareAll = proposed && ctx.all.every((p) => p.share != null) && ranked.every((c) => c.points?.length >= ctx.all.length)
  const shareDs = shareAll
    ? dataset(ctx.all, [{ key: 'you', domain: facts.domain, name: brand, values: ctx.all.map((p) => p.share) }, ...ranked.map((c) => ({ key: c.key, domain: c.domain, name: c.name, values: c.points.slice(-ctx.all.length).map((p) => p.share) }))])
    : dataset([ctx.latest], [{ key: 'you', domain: facts.domain, name: brand, values: [facts.youShare] }, ...ranked.map((c) => ({ key: c.key, domain: c.domain, name: c.name, values: [c.share] }))])
  const leadAll = shareAll ? ctx.all.map((p, i) => p.share - top.points.slice(-ctx.all.length)[i].share) : null
  const ledAll = ts.length && ts.every((t) => t.trend?.length >= ctx.all.length) ? ctx.all.map((_, i) => ts.filter((t) => t.trend.slice(-ctx.all.length)[i] > 0).length) : null
  const one = (values, o, m) => (values ? dataset(ctx.all, [{ key: 'you', domain: facts.domain, name: brand, values }], { unit: 'count', one: o, many: m }) : null)
  const kpis = [
    kpi({ id: 'share', label: 'Share of voice', value: `${facts.youShare}%`, series: proposed ? seriesOf(ctx, 'share') : null, unit: '%', ds: shareDs, note: shareAll ? null : 'Share history isn’t in your data yet: the latest scan only.', title: 'Share of voice', subtitle: 'You vs the brands you track' }),
    kpi({ id: 'lead', label: lead >= 0 ? 'Lead over #2' : `Behind ${T}`, value: `${lead > 0 ? '+' : lead < 0 ? '−' : ''}${Math.abs(lead)} pts`, series: leadAll && history ? leadAll.slice(-points.length) : null, unit: 'pts', ds: one(leadAll, 'point', 'points'), title: `Lead over ${T}`, subtitle: 'Points of share of voice, by sync', compare: false }),
    kpi({ id: 'named', label: 'Prompts naming you', value: (points.at(-1)?.visible ?? facts.visible).toLocaleString(), series: seriesOf(ctx, 'visible'), unit: 'prompts', ds: one(allOf(ctx, 'visible'), 'prompt', 'prompts'), title: 'Prompts naming you', subtitle: `Of your ${N} prompts, by sync`, compare: false }),
    ...(ts.length ? [kpi({ id: 'topics', label: 'Topics you lead', value: `${led}/${ts.length}`, series: ledAll && history ? ledAll.slice(-points.length) : null, unit: 'topics', ds: one(ledAll, 'topic', 'topics'), title: 'Topics you lead', subtitle: `Of ${ts.length} topics, by sync`, compare: false })] : []),
  ]

  const leadRows = ts.map((t) => ({ t: t.topic, vals: [{ text: t.leader ?? 'you', tone: 'muted' }, { v: Math.abs(t.lead), pre: t.lead > 0 ? '+' : t.lead < 0 ? '−' : '', suf: ' pts', tone: t.lead < 0 ? 'dn' : '' }] }))
  // Competitors: a table across the width. Brand · named on · share (a bar in the brand's chart colour) · change since
  // the last sync · an 8-week trend · the topic where the brand has its highest share. A column with no data is hidden
  const inP = (arr) => (arr && arr.length >= points.length ? arr.slice(-points.length) : null)
  const youSeries = proposed ? inP(ctx.all.map((p) => p.share)) : null
  const leadsOn = (domain) => {
    const best = (facts.topicShare || []).map((t) => ({ t: t.topic, v: t.shares?.[domain] })).filter((x) => x.v != null).sort((a, b) => b.v - a.v)[0]
    return best?.t ?? null
  }
  const brands = [{ you: true, name: brand, domain: facts.domain, share: facts.youShare, named: points.at(-1)?.visible ?? facts.visible, series: youSeries, color: 'var(--line-you)' },
    ...ranked.map((c, i) => ({ name: c.name, domain: c.domain, share: c.share, named: null, series: inP(c.points?.map((p) => p.share)), color: LINE[i] ?? 'var(--data-c2)' }))]
    .sort((a, b) => b.share - a.share)
    .map((b) => ({ ...b, change: b.series && history ? b.series.at(-1) - b.series.at(-2) : null, leads: proposed ? leadsOn(b.domain) : null }))
  const table = { title: 'Competitors', count: ranked.length, rows: brands,
    has: { named: brands.some((b) => b.named != null), change: brands.some((b) => b.change != null), trend: history && brands.some((b) => b.series?.length >= 2), leads: brands.some((b) => b.leads) } }
  const blocks = [
    { table },
    { moved: movedOf(ctx) },
    ...(leadRows.length ? [{ panel: panel('topics', [tab('topics', 'Topics by your lead', [col('Leader', 120, { text: true }), col('Lead', 72)], leadRows, { bar: false, summary: `You lead ${led} of ${ts.length} topics` })], { solo: true }) }] : []),
    { panel: panel('engines', [enginesTab(ctx, { notNamed: null })], { solo: true, plain: true }) },
    { panel: panel('pages', [yourPagesTab(facts, brand)], { solo: true }) },
  ].filter((b) => b.panel || b.moved || b.table)

  // Biggest wins: the topics where you won the most prompts (+N prompts won), "now x/y" for the topic, the prompts won
  const won = (movedOf(ctx)?.rows ?? []).filter((m) => m.gained.length).sort((a, b) => b.gained.length - a.gained.length).slice(0, 3)
  const steps = won.length ? { title: 'Biggest wins', moves: won.map((m) => {
    const now = youIn(facts, m.topic)
    return { kind: 'won', t: `Build on ${lower(m.topic)}`, topic: m.topic, n: m.gained.length, engines: m.engines, now, of: now != null ? topicTotal(facts, m.topic) : null,
      rows: m.gained.map((x) => ({ prompt: x.prompt, engines: x.engines, won: true })), prompts: m.gained.map((x) => x.prompt),
      why: `You’re newly named on ${plural(m.gained.length, 'prompt')} in ${lower(m.topic)}.` }
  }) } : null

  const answer = lead >= 0 ? `Yes. ${brand} has ${facts.youShare}% of AI answers, ${lead} points ahead of ${T}.` : `Not yet. ${T} has ${top.share}% of AI answers; ${brand} has ${facts.youShare}%.`
  return { question: 'Are we winning in AI search?', answer, kpis, defaultKpi: 'share', blocks, snapshot: snapshotOf(ctx), steps }
}

// ---- Missing prompts -----------------------------------------------------------------------------------------------
function missing(ctx) {
  const { facts, points, brand, N } = ctx
  const colorOf = colorsOf(facts)
  const rows = facts.missedRows || []
  const nobody = rows.filter((x) => !x.competitors.length)
  const owners = groupBy(rows.filter((x) => x.competitors.length), (x) => x.competitors[0])
  const top = owners[0]
  const topName = top ? shortName(nameOf(facts, top.key)) : null
  const visAll = allOf(ctx, 'visible')
  const one = (values, unit, o, m) => (values ? dataset(ctx.all, [{ key: 'you', domain: facts.domain, name: brand, values }], unit === '%' ? {} : { unit: 'count', one: o, many: m }) : null)
  const kpis = [
    kpi({ id: 'missing', label: 'Missing', value: `${rows.length}`, series: ctx.history ? points.map((p) => N - p.visible) : null, unit: 'prompts', lowerIsBetter: true, ds: one(visAll?.map((v) => N - v), 'count', 'prompt', 'prompts'), title: 'Prompts missing', subtitle: `Of your ${N} prompts, by sync`, compare: false }),
    kpi({ id: 'nobody', label: 'Nobody named', value: `${nobody.length}`, series: null, unit: 'prompts', ds: null }),
    ...(top ? [kpi({ id: 'top', label: `${topName} named instead`, value: `${top.items.length}`, series: null, unit: 'prompts', ds: null })] : []),
    kpi({ id: 'coverage', label: 'Coverage', value: `${Math.round(((points.at(-1)?.visible ?? facts.visible) / N) * 100)}%`, series: ctx.history ? points.map((p) => Math.round((p.visible / N) * 100)) : null, unit: '%', ds: one(visAll?.map((v) => Math.round((v / N) * 100)), '%'), title: 'Coverage', subtitle: 'Share of your prompts that name you, by sync', compare: false }),
  ]

  const byTopic = groupBy(rows, (x) => x.topic).map((g) => {
    const comp = g.items.filter((x) => x.competitors.length).length
    const f = topicFacts(facts, g.key, colorOf)
    return { t: g.key, click: g.key, vals: [{ logos: f.logos, engines: f.engines }, { split: f.split }, ring(comp, g.items.length, comp ? 'bad' : 'ink'), { v: g.items.length - comp }] }
  })
  const lostSet = new Set(ctx.history ? facts.lost || [] : [])
  const promptRows = rows.map((x) => ({ t: x.prompt, icon: x.engines?.[0] ? engine(x.engines[0]) : null, topic: x.topic, vals: [{ text: x.topic ?? '', tone: 'muted' }, lostSet.has(x.prompt) ? { text: 'lost', tone: 'dn' } : { text: x.competitors.length ? shortName(nameOf(facts, x.competitors[0])) : 'nobody', tone: 'muted' }] }))
  const who = [...owners.map((g) => ({ t: nameOf(facts, g.key), icon: brandIcon(g.key, nameOf(facts, g.key)), n: g.items.length, topics: new Set(g.items.map((x) => x.topic).filter(Boolean)).size })), ...(nobody.length ? [{ t: 'Nobody', n: nobody.length, topics: new Set(nobody.map((x) => x.topic).filter(Boolean)).size }] : [])]
    .sort((a, b) => b.n - a.n)
  const whoMax = Math.max(1, ...who.map((w) => w.n))
  const whoRows = who.map((w) => ({ t: w.t, icon: w.icon, glyph: w.icon ? null : 'none', vals: [{ v: w.topics, tone: 'muted' }, { v: w.n, mini: { w: (w.n / whoMax) * 96, color: w.icon ? colorOf(w.icon.domain) : null, hatched: !w.icon } }] }))
  const theirPages = (facts.competitors || []).flatMap((c) => (c.cited || []).map((p) => ({ t: p.path, icon: brandIcon(c.domain, c.name), bar: p.n, vals: [{ text: shortName(c.name), tone: 'muted' }, { v: p.n }] })))
  const openRows = nobody.map((x) => ({ t: x.prompt, topic: x.topic, vals: [{ text: x.topic ?? '', tone: 'muted' }] }))
  const row2 = [
    panel('topics', [tab('topics', 'Missing by topic', [col('Named instead', 150, { text: true }), col('Split', 184, { text: true }), col('Competitor', 104), col('Nobody', 72)], byTopic, { bar: false, summary: `${plural(byTopic.length, 'topic')} with prompts you’re missing` }),
      tab('prompts', 'Prompts', [col('Topic', 160, { text: true }), col('Named instead', 104, { text: true })], promptRows, { bar: false, summary: `${plural(promptRows.length, 'prompt')} missing` })]),
    panel('who', [tab('who', 'Who’s named instead', [col('Topics', 64), col('Prompts', 148, { divider: true })], whoRows, { bar: false, summary: `${plural(owners.length, 'competitor')} named on prompts you’re missing` })], { solo: true }),
  ].filter(Boolean)
  // Open prompts: full width, grouped by topic (most open first), each with "you x/y" for the topic and its prompts
  const openGroups = groupBy(nobody, (x) => x.topic ?? 'Other').map((g) => {
    const you = youIn(facts, g.key)
    return { topic: g.key, you, of: you != null ? topicTotal(facts, g.key) : null, prompts: g.items.map((x) => ({ prompt: x.prompt, engines: x.engines || [] })) }
  })
  const blocks = [
    { panel: row2[0] },
    ...(openGroups.length ? [{ open: { title: 'Open prompts', count: nobody.length, groups: openGroups } }] : []),
    { panel: row2[1] },
    { panel: panel('engines', [enginesTab(ctx, { named: 'Named', notNamed: null })], { solo: true, plain: true }) },
    { panel: panel('pages', [tab('theirs', 'Their pages', [col('Brand', 104, { text: true }), col('Cited')], theirPages, { summary: `${plural(theirPages.length, 'page')} cited for competitors` })], { solo: true }) },
  ].filter((b) => b.panel || b.open)

  const qt = groupBy(rows, (x) => x.topic).map((g) => ({ ...g, open: g.items.filter((x) => !x.competitors.length).length })).sort((a, b) => b.open - a.open || b.items.length - a.items.length).slice(0, 4)
  const steps = qt.length ? {
    title: 'Quick wins', col: 'Prompts it could win',
    rich: true,
    rows: qt.map((g) => { const w = whyFor(facts, g.key); return step({ ...stepCites(facts, g.key), of: topicTotal(facts, g.key, g.items.length), now: youIn(facts, g.key), t: `Write ${aPage(g.key)}`, topic: g.key, n: g.items.length, prompts: g.items.map((x) => x.prompt), items: stepItems(facts, g.items.map((x) => x.prompt)), engines: [...new Set(g.items.flatMap((x) => x.engines || []))].map(engine), page: w ? (w.w.you ? w.w.you.path : 'New page') : undefined, why: `${g.open} of these name no brand at all; ${g.items.length - g.open} name a competitor.` }) }),
  } : null

  const answer = rows.length ? `${brand} is missing ${rows.length} of ${N} prompts; ${nobody.length} of them name no brand at all.` : `${brand} is named on all ${N} prompts.`
  return { question: 'Which prompts are we missing?', answer, kpis, defaultKpi: 'missing', blocks, snapshot: snapshotOf(ctx), steps }
}
