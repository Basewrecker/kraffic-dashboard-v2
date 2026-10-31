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

export const ENGINE_DOMAIN = { aio: 'google.com', chatgpt: 'chatgpt.com', gemini: 'gemini.google.com', claude: 'claude.ai' }
export const ALL_ENGINES = ['aio', 'chatgpt', 'gemini', 'claude']
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
const engine = (id) => ({ domain: ENGINE_DOMAIN[id], name: ENGINE_NAMES[id] })
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
  return { ...body, kind, brand: facts.name, question: String(prompt || '').trim() || body.question, read: read?.line ?? null, range, period: opts.period, history, footer }
}

// ---- shared pieces ---------------------------------------------------------------------------------------------------
const col = (label, w = 56, extra = {}) => ({ label, w, ...extra })
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
    ...g.items.map((x) => ({ t: x.p, sub: true, icon: engineOf(x.p) ? engine(engineOf(x.p)) : null, topic: g.key })),
  ])
  return tab(key, label, [col('Since last sync', 104)], rows, { bar: false, summary: `${plural(prompts.length, 'prompt')} in ${plural(groups.length, 'topic')}` })
}

// share of answers: you and every competitor, latest scan
function shareTab(facts, brand, label = 'Share of answers') {
  const rows = [{ t: brand, n: facts.youShare, domain: facts.domain }, ...(facts.competitors || []).map((c) => ({ t: c.name, n: c.share, domain: c.domain }))]
    .filter((x) => x.n != null).sort((a, b) => b.n - a.n).map((x) => ({ t: x.t, icon: brandIcon(x.domain, x.t), bar: x.n, barMax: 100, vals: [{ v: x.n, suf: '%' }] }))
  return tab('brands', label, [col('Share')], rows, { summary: `${plural(rows.length, 'brand')} named in the latest scan` })
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
    return { t: ENGINE_NAMES[id], icon: engine(id), vals: [{ v }, { v: w, tone: them && w > v ? 'dn' : '' }, { v: share, suf: '%' }, ...(hasHist ? [hist ? change(hist.at(-1) - hist[0], ' pts') : { text: '' }] : [])], spark: hasHist && hist ? { values: hist, color: 'var(--plot)' } : null }
  })
  const cols = [col(named, 64), col(notNamed, them ? 56 : 76), col('Share'), ...(hasHist ? [col('Change', 72)] : [])]
  return tab('engines', label, cols, rows, { bar: false, spark: hasHist, summary: `${plural(ran.length, 'engine')} ran${off.length ? ` · ${list(off.map((id) => ENGINE_NAMES[id]))} didn’t` : ''}` })
}

const yourPagesTab = (facts, brand, label = 'Your pages') => tab('yours', label, [col('Answers citing', 104)], (facts.cited || []).map((p) => ({ t: p.path, icon: brandIcon(facts.domain, brand), bar: p.n, vals: [{ v: p.n }] })), { summary: `${plural((facts.cited || []).length, 'page')} cited in the latest scan` })

// a next step: the action, its topic, the engines, your page that would carry it (or "New page"), +N
function step({ t, topic, n, prompts, engines = [], why, page = undefined }) {
  return { t, topic, n, prompts, engines, page, why }
}
// the page AI cites for a competitor on a topic, and yours (proposed competitors[].why)
const whyFor = (facts, topic) => (facts.competitors || []).map((c) => ({ c, w: c.why?.find((w) => w.theme === topic) })).find((x) => x.w?.them) ?? null

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
      .map((t) => ({ t: t.t, click: winTopics.some((g) => g.key === t.t) ? t.t : null, split: [{ v: t.you, tone: 'you' }, { v: t.them, tone: 'them' }], vals: [{ v: t.you }, { v: t.them, tone: t.them > t.you ? 'dn' : '' }] }))
    : groupBy(missedRows, (x) => x.topic).map((g) => {
      const them = g.items.filter((x) => x.competitors.includes(r.domain)).length
      return { t: g.key, click: them ? g.key : null, split: [{ v: them, tone: 'them' }, { v: g.items.length - them, tone: 'rest' }], vals: [{ v: them, tone: them ? 'dn' : '' }, { v: g.items.length }] }
    }).sort((a, b) => b.vals[0].v - a.vals[0].v || b.vals[1].v - a.vals[1].v)
  const lostSet = new Set(history ? facts.lost || [] : [])
  const missedSet = new Set(missedRows.map((x) => x.prompt))
  // Prompts: engine · prompt · topic · status (named / not named / lost); "weeks named" needs missedRows[].streak
  const promptRows = wins.map((w) => {
    const status = lostSet.has(w.prompt) ? { text: 'lost', tone: 'dn' } : missedSet.has(w.prompt) ? { text: 'not named', tone: 'muted' } : { text: 'named', tone: '' }
    return { t: w.prompt, icon: w.engine ? engine(w.engine) : null, topic: w.topic, vals: [{ text: w.topic ?? '', tone: 'muted' }, status] }
  })
  const theirs = (r.cited || []).map((p) => ({ t: p.path, icon: brandIcon(r.domain, r.name), bar: p.n, vals: [{ text: (p.topics || []).join(', '), tone: 'muted' }, { v: p.n }] }))
  const engTab = enginesTab(ctx, { label: 'Engines', named: 'You', notNamed: 'Them', you: h?.engines?.length ? (id) => h.engines.find((e) => e.id === id)?.you ?? 0 : null, them: (id) => (h?.engines?.find((e) => e.id === id)?.them ?? wins.filter((w) => w.engine === id).length) })
  const gained = changeTab('gained', 'Gained', history ? facts.gained || [] : [], facts.gainedRows, 'up', facts)
  const lost = changeTab('lost', 'Lost', history ? facts.lost || [] : [], facts.lostRows, 'dn', facts)

  const row2 = [
    panel('topics', [tab('topics', 'Topics', proposed && facts.topics?.length ? [col('You'), col('Them')] : [col('Them'), col('Missing', 64)], topicRows, { summary: `${plural(topicRows.length, 'topic')} · ${winTopics.length} where ${R} wins` }),
      tab('prompts', 'Prompts', [col('Topic', 160, { text: true }), col('Status', 76, { text: true })], promptRows, { bar: false, summary: `${plural(promptRows.length, 'prompt')} ${R} wins` })]),
    panel('pages', [tab('theirs', 'Their pages', [col('Topic', 160, { text: true }), col('Cited')], theirs, { summary: `${plural(theirs.length, 'page')} of ${R}’s cited on these topics` }), yourPagesTab(facts, brand)]),
  ].filter(Boolean)
  const row3 = [
    panel('engines', [engTab], { solo: true, plain: true }),
    panel('brands', [shareTab(facts, brand)], { solo: true }),
    panel('change', [gained, lost]),
  ].filter(Boolean)

  const steps = winTopics.length ? {
    title: 'Close the gap', col: 'Prompts it could win',
    rows: winTopics.slice(0, 3).map((g) => {
      const w = r.why?.find((x) => x.theme === g.key)
      return step({
        t: w?.you ? `Add ${lower(g.key)} answers to ${w.you.path}` : `Write a ${lower(g.key)} page`, topic: g.key, n: g.items.length, prompts: g.items.map((x) => x.prompt),
        engines: [...new Set(g.items.map((x) => x.engine).filter(Boolean))].map(engine),
        page: w ? (w.you ? w.you.path : 'New page') : undefined,
        why: w?.them ? `${R}’s ${w.them.path} is cited in ${plural(w.them.n, 'answer')}. ${w.you ? `Yours, ${w.you.path}, in ${w.you.n}.` : 'You have no page for this.'}` : `${R} is named on ${g.items.length} of these prompts and you aren’t.`,
      })
    }),
  } : null

  const top2 = winTopics.slice(0, 2).map((g) => lower(g.key))
  const mostly = top2.length ? `, mostly ${top2.join(' and ')}` : ''
  const answer = wins.length ? (h ? `${R} wins ${wins.length} of your ${N} prompts${mostly}.` : `${R} is named on ${wins.length} of your ${N} prompts where you aren’t${mostly}.`) : `${R} isn’t named on any prompt without you.`
  return { question: `Where is ${R} beating us?`, answer, kpis, defaultKpi: kpis.find((k) => k.id === 'wins' && k.ds) ? 'wins' : 'named', row2, row3, steps }
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

  const moved = new Map()
  gainedList.forEach((p) => { const t = topicOfRow(facts.gainedRows, p); if (t) moved.set(t, { g: (moved.get(t)?.g ?? 0) + 1, l: moved.get(t)?.l ?? 0 }) })
  lostList.forEach((p) => { const t = topicOfRow(facts.lostRows, p); if (t) moved.set(t, { g: moved.get(t)?.g ?? 0, l: (moved.get(t)?.l ?? 0) + 1 }) })
  const topicRows = [...moved].sort((a, b) => (b[1].g - b[1].l) - (a[1].g - a[1].l)).map(([t, m]) => ({ t, vals: [{ v: m.g, tone: m.g ? 'up' : '', pre: m.g ? '+' : '' }, { v: m.l, tone: m.l ? 'dn' : '', pre: m.l ? '−' : '' }, change(m.g - m.l)] }))
  const row2 = [
    panel('change', [changeTab('gained', W.gained, gainedList, facts.gainedRows, 'up', facts), changeTab('lost', W.lost, lostList, facts.lostRows, 'dn', facts)]),
    panel('topics', [tab('topics', W.topics, [col(W.gained, 64), col(W.lost, 56), col('Net', 52)], topicRows, { bar: false, summary: `${plural(topicRows.length, 'topic')} moved since the sync before` })], { solo: true, plain: true }),
  ].filter(Boolean)
  const row3 = [
    panel('engines', [enginesTab(ctx, { label: W.engines, named: W.shown, notNamed: W.not })], { solo: true, plain: true }),
    panel('brands', [shareTab(facts, brand, client ? 'Share of AI answers' : 'Share of answers')], { solo: true }),
    panel('pages', [yourPagesTab(facts, brand, W.pages)], { solo: true }),
  ].filter(Boolean)

  const lostTopics = groupBy(lostList.map((p) => ({ prompt: p, topic: topicOfRow(facts.lostRows, p) })), (x) => x.topic || null)
  const steps = lostTopics.length ? {
    title: W.steps, col: client ? 'Questions to win back' : 'Prompts to win back',
    rows: lostTopics.slice(0, 4).map((g) => { const w = whyFor(facts, g.key); return step({ t: `Win back ${lower(g.key)}`, topic: g.key, n: g.items.length, prompts: g.items.map((x) => x.prompt), page: w ? (w.w.you ? w.w.you.path : 'New page') : undefined, why: w ? `${shortName(w.c.name)}’s ${w.w.them.path} is cited in ${plural(w.w.them.n, 'answer')}.` : `You were named on ${plural(g.items.length, 'of these prompts', 'of these prompts')} at the sync before and aren’t now.` }) }),
  } : null

  const d = history ? visible - points[0].visible : null
  const start = points[0]?.date
  const answer = client
    ? (history ? `You showed up in AI answers for ${visible} of ${N} questions, ${d >= 0 ? `${d} more` : `${-d} fewer`} than ${start}.` : `You showed up in AI answers for ${visible} of ${N} questions in the first scan.`)
    : (history ? `${brand} is named on ${visible === N ? `all ${N}` : `${visible} of ${N}`} prompts, ${d > 0 ? `up ${d}` : d < 0 ? `down ${-d}` : 'unchanged'} since ${start}.` : `${brand} is named on ${visible} of ${N} prompts in its first scan.`)
  const when = { week: 'this week', '30d': 'this month', quarter: 'this quarter' }[ctx.opts.period] ?? 'lately'
  return { question: client ? `Client update: ${MONTH[ctx.latest?.date?.split(' ')[0]] ?? 'latest scan'}` : `What moved ${when}?`, answer, kpis, defaultKpi: 'named', row2, row3, steps }
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

  const leadRows = ts.map((t) => ({ t: t.topic, split: t.lead >= 0 ? [{ v: t.lead, tone: 'you' }] : [{ v: -t.lead, tone: 'them' }], vals: [{ text: t.leader ?? 'you', tone: 'muted' }, { v: Math.abs(t.lead), pre: t.lead > 0 ? '+' : t.lead < 0 ? '−' : '', suf: ' pts', tone: t.lead < 0 ? 'dn' : '' }] }))
  // Competitors, full width: share now · change since start · topics they lead · 8-week share sparkline (the brand's
  // Visibility history colour); prompts named per competitor isn't in the data (proposals)
  const brands = [{ key: 'you', name: brand, domain: facts.domain, share: facts.youShare, points: shareAll ? ctx.all.map((p) => ({ share: p.share })) : null }, ...ranked]
  const sparkColor = (b) => (b.key === 'you' ? 'var(--line-you)' : LINE[ranked.indexOf(b)] ?? 'var(--data-c2)')
  const leadsOf = (b) => ts.filter((t) => (b.key === 'you' ? t.lead > 0 : t.leader && shortName(b.name).startsWith(t.leader.split(' ')[0]))).length
  const hasHist = shareAll
  const compRows = brands.map((b) => {
    const h = hasHist ? (b.key === 'you' ? b.points.map((p) => p.share) : b.points.slice(-ctx.all.length).map((p) => p.share)) : null
    const hp = h ? h.slice(-points.length) : null
    return { t: b.key === 'you' ? `${b.name} (you)` : b.name, icon: brandIcon(b.domain, b.name), vals: [{ v: b.share, suf: '%' }, ...(hasHist ? [hp ? { ...change(hp.at(-1) - hp[0], ' pts'), tone: b.key === 'you' ? (hp.at(-1) >= hp[0] ? 'up' : 'dn') : (hp.at(-1) > hp[0] ? 'dn' : hp.at(-1) < hp[0] ? 'up' : '') } : { text: '' }] : []), ...(ts.length ? [{ v: leadsOf(b) }] : [])], spark: h ? { values: h, color: sparkColor(b) } : null }
  })
  const compCols = [col('Share'), ...(hasHist ? [col('Change', 76)] : []), ...(ts.length ? [col('Topics led', 84)] : [])]
  const row2 = [
    panel('competitors', [tab('competitors', 'Competitors', compCols, compRows, { bar: false, spark: hasHist, summary: `${plural(ranked.length, 'competitor')} tracked` })], { solo: true, plain: true, full: true }),
  ].filter(Boolean)
  const row3 = [
    ...(leadRows.length ? [panel('topics', [tab('topics', 'Topics by your lead', [col('Leader', 120, { text: true }), col('Lead', 72)], leadRows, { summary: `You lead ${led} of ${ts.length} topics` })], { solo: true })] : []),
    panel('engines', [enginesTab(ctx)], { solo: true, plain: true }),
    panel('pages', [yourPagesTab(facts, brand)], { solo: true }),
    panel('change', [changeTab('gained', 'Gained', history ? facts.gained || [] : [], facts.gainedRows, 'up', facts), changeTab('lost', 'Lost', history ? facts.lost || [] : [], facts.lostRows, 'dn', facts)]),
  ].filter(Boolean).slice(0, 3)

  const wins = ts.length && history ? ts.map((t) => ({ ...t, gain: t.trend.slice(-points.length).at(-1) - t.trend.slice(-points.length)[0] })).filter((t) => t.gain > 0).sort((a, b) => b.gain - a.gain).slice(0, 3) : []
  const gainedTopics = groupBy((history ? facts.gained || [] : []).map((p) => ({ prompt: p, topic: topicOfRow(facts.gainedRows, p) })), (x) => x.topic || null)
  const start = points[0]?.date
  const steps = wins.length
    ? { title: 'Biggest wins', col: 'Points of lead gained', rows: wins.map((w) => { const why = whyFor(facts, w.topic); return step({ t: `Build on ${lower(w.topic)}`, topic: w.topic, n: w.gain, prompts: gainedTopics.find((g) => g.key === w.topic)?.items.map((i) => i.prompt) ?? [], page: why?.w.you ? why.w.you.path : undefined, why: `Your lead in ${lower(w.topic)} grew ${w.gain} points since ${start}; it’s now ${w.lead > 0 ? '+' : ''}${w.lead}.` }) }) }
    : gainedTopics.length ? { title: 'Biggest wins', col: 'Prompts gained', rows: gainedTopics.slice(0, 3).map((x) => step({ t: `Build on ${lower(x.key)}`, topic: x.key, n: x.items.length, prompts: x.items.map((i) => i.prompt), why: `You’re newly named on ${plural(x.items.length, 'of these prompts', 'of these prompts')}.` })) } : null

  const answer = lead >= 0 ? `Yes. ${brand} has ${facts.youShare}% of AI answers, ${lead} points ahead of ${T}.` : `Not yet. ${T} has ${top.share}% of AI answers; ${brand} has ${facts.youShare}%.`
  return { question: 'Are we winning in AI search?', answer, kpis, defaultKpi: 'share', row2, row3, steps }
}

// ---- Missing prompts -----------------------------------------------------------------------------------------------
function missing(ctx) {
  const { facts, points, brand, N } = ctx
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
    return { t: g.key, click: g.key, split: [{ v: comp, tone: 'them' }, { v: g.items.length - comp, tone: 'rest' }], vals: [{ v: comp }, { v: g.items.length - comp }] }
  })
  const lostSet = new Set(ctx.history ? facts.lost || [] : [])
  const promptRows = rows.map((x) => ({ t: x.prompt, icon: x.engines?.[0] ? engine(x.engines[0]) : null, topic: x.topic, vals: [{ text: x.topic ?? '', tone: 'muted' }, lostSet.has(x.prompt) ? { text: 'lost', tone: 'dn' } : { text: x.competitors.length ? shortName(nameOf(facts, x.competitors[0])) : 'nobody', tone: 'muted' }] }))
  const who = [...owners.map((g) => ({ t: nameOf(facts, g.key), icon: brandIcon(g.key, nameOf(facts, g.key)), n: g.items.length, topics: new Set(g.items.map((x) => x.topic).filter(Boolean)).size })), ...(nobody.length ? [{ t: 'Nobody', n: nobody.length, topics: new Set(nobody.map((x) => x.topic).filter(Boolean)).size }] : [])]
    .sort((a, b) => b.n - a.n).map((w) => ({ t: w.t, icon: w.icon, bar: w.n, vals: [{ v: w.topics }, { v: w.n }] }))
  const theirPages = (facts.competitors || []).flatMap((c) => (c.cited || []).map((p) => ({ t: p.path, icon: brandIcon(c.domain, c.name), bar: p.n, vals: [{ text: shortName(c.name), tone: 'muted' }, { v: p.n }] })))
  const openRows = nobody.map((x) => ({ t: x.prompt, topic: x.topic, vals: [{ text: x.topic ?? '', tone: 'muted' }] }))
  const row2 = [
    panel('topics', [tab('topics', 'Missing by topic', [col('Competitor', 84), col('Nobody', 64)], byTopic, { summary: `${plural(byTopic.length, 'topic')} with prompts you’re missing` }),
      tab('prompts', 'Prompts', [col('Topic', 160, { text: true }), col('Named instead', 104, { text: true })], promptRows, { bar: false, summary: `${plural(promptRows.length, 'prompt')} missing` })]),
    panel('who', [tab('who', 'Who’s named instead', [col('Topics', 64), col('Prompts', 64)], who, { summary: `${plural(owners.length, 'competitor')} named on prompts you’re missing` })], { solo: true }),
  ].filter(Boolean)
  const row3 = [
    panel('engines', [enginesTab(ctx, { named: 'Named', notNamed: 'Missing' })], { solo: true, plain: true }),
    panel('pages', [tab('theirs', 'Their pages', [col('Brand', 104, { text: true }), col('Cited')], theirPages, { summary: `${plural(theirPages.length, 'page')} cited for competitors` })], { solo: true }),
    panel('open', [tab('open', 'Open prompts', [col('Topic', 160, { text: true })], openRows, { bar: false, summary: `${plural(openRows.length, 'prompt')} no brand is named on` })], { solo: true }),
  ].filter(Boolean)

  const qt = groupBy(rows, (x) => x.topic).map((g) => ({ ...g, open: g.items.filter((x) => !x.competitors.length).length })).sort((a, b) => b.open - a.open || b.items.length - a.items.length).slice(0, 4)
  const steps = qt.length ? {
    title: 'Quick wins', col: 'Prompts it could win',
    rows: qt.map((g) => { const w = whyFor(facts, g.key); return step({ t: `Write a ${lower(g.key)} page`, topic: g.key, n: g.items.length, prompts: g.items.map((x) => x.prompt), engines: [...new Set(g.items.flatMap((x) => x.engines || []))].map(engine), page: w ? (w.w.you ? w.w.you.path : 'New page') : undefined, why: `${g.open} of these name no brand at all; ${g.items.length - g.open} name a competitor.` }) }),
  } : null

  const answer = rows.length ? `${brand} is missing ${rows.length} of ${N} prompts; ${nobody.length} of them name no brand at all.` : `${brand} is named on all ${N} prompts.`
  return { question: 'Which prompts are we missing?', answer, kpis, defaultKpi: 'missing', row2, row3, steps }
}
