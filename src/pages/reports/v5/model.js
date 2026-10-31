// Reports (final design): the view for one report, in the prototype's anatomy (report-prototype.html): header, KPI
// tabs fused to the chart, a row of 2 tabbed panels, a row of 3 panels, the next steps, the footer.
//
// Written from the brand's facts in the API's shape (accountFacts), after the app's adapter (data/live-report.js) has
// read the question and resolved the options. Topic and engine on the prompt rows are the fields the app is adding;
// facts.proposed marks the other fields in docs/proposals-for-harsh.md (?fields=proposed). Nothing is estimated: a
// number with no history has no chart, a panel with no rows is dropped and its row reflows.
// The caller passes `points`: the facts' points in the period, by the adapter's own rule (live-report.js pointsIn).
import { ENGINE_NAMES, periodLabel } from '../../../data/reports.js'

export const ENGINE_DOMAIN = { aio: 'google.com', chatgpt: 'chatgpt.com', gemini: 'gemini.google.com', claude: 'claude.ai' }
export const ALL_ENGINES = ['aio', 'chatgpt', 'gemini', 'claude']
export const NO_HISTORY = 'Not enough history yet: one scan so far'
export const KIND_NAME = { weekly: 'Weekly summary', client: 'Client update', ceo: 'CEO summary', rival: 'Competitor gap', content: 'Missing prompts' }

const MONTH = { Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' }
export const shortName = (name = '') => (name.length <= 14 ? name : name.replace(/^The\s+/i, '').split(/\s+/)[0])
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`
const groupBy = (rows, key) => {
  const m = new Map()
  rows.forEach((r) => { const k = key(r); if (k == null) return; if (!m.has(k)) m.set(k, []); m.get(k).push(r) })
  return [...m].map(([k, items]) => ({ key: k, items })).sort((a, b) => b.items.length - a.items.length)
}
const nameOf = (facts, domain) => (facts.competitors || []).find((c) => c.domain === domain)?.name ?? domain
// lowercase the first letter, unless the word is an acronym (HECM, KP)
const lower = (t) => (/^[A-Z]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1))

// a delta chip: the change over the period. tone: good / bad, or neutral when the change is neither (or zero)
export function delta(series, { unit = '', lowerIsBetter = false, neutral = false } = {}) {
  if (!series || series.length < 2) return null
  const n = series.at(-1) - series[0]
  const text = `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}${unit}`
  const tone = neutral || n === 0 ? '' : (n > 0) !== lowerIsBetter ? 'good' : 'bad'
  return { text, tone }
}

// icon for a panel row: an engine's favicon, a brand's favicon (from its domain), or none
const engine = (id) => ({ domain: ENGINE_DOMAIN[id], name: ENGINE_NAMES[id] })
const brandIcon = (domain, name) => ({ domain, name })

export function buildReport5({ facts, built, points, prev = [], prompt = '', read = null }) {
  const opts = built.opts
  const kind = read?.kind ?? built.kind
  const history = points.length >= 2
  const ctx = { facts, opts, points, prev, history, start: points[0], latest: points.at(-1), proposed: !!facts.proposed, brand: facts.name, N: facts.prompts }
  ctx.client = opts.audience === 'client'
  const body = kind === 'rival' ? competitor(ctx) : kind === 'ceo' ? ceo(ctx) : kind === 'content' ? missing(ctx) : weekly(ctx)

  const ran = (opts.engines?.length ? opts.engines.filter((e) => facts.ran.includes(e)) : facts.ran) || []
  const off = ALL_ENGINES.filter((e) => !ran.includes(e))
  const range = ctx.start ? (ctx.start.date === ctx.latest.date ? ctx.latest.date : `${ctx.start.date} – ${ctx.latest.date}`) : periodLabel(opts.period)
  const footer = [
    history ? `Weekly syncs, ${range}` : `One sync, ${range}`,
    ran.map((e) => ENGINE_NAMES[e]).join(', '),
    off.length ? `${off.map((e) => ENGINE_NAMES[e]).join(', ')} didn’t run` : null,
  ].filter(Boolean).join(' · ')

  return {
    ...body,
    kind,
    brand: facts.name,
    question: String(prompt || '').trim() || body.question,
    read: read?.line ?? null,
    range,
    period: opts.period,
    dates: points.map((p) => p.date),
    history,
    footer,
  }
}

// ---- Competitor gap ------------------------------------------------------------------------------------------------
function competitor({ facts, opts, points, prev, history, proposed, brand, N }) {
  const rivals = facts.competitors || []
  const h2h = facts.headToHead || []
  const missedRows = facts.missedRows || []
  const onMissed = (c) => missedRows.filter((x) => x.competitors.includes(c.domain)).length
  const r = rivals.find((c) => c.key === opts.compare?.[0]) ?? rivals.find((c) => h2h.some((h) => h.domain === c.domain)) ?? [...rivals].sort((a, b) => onMissed(b) - onMissed(a))[0]
  const R = shortName(r.name)
  const h = h2h.find((x) => x.domain === r.domain)
  // the prompts they win: with the proposed head-to-head, only them or named first; live, the prompts that name them
  // and not you (the missed rows naming them)
  const wins = h ? h.wins : missedRows.filter((x) => x.competitors.includes(r.domain)).map((x) => ({ prompt: x.prompt, topic: x.topic, engine: x.engines?.[0] ?? null }))
  const winTopics = groupBy(wins, (w) => w.topic)
  const series = (k) => (history ? points.map((p) => p[k]) : null)
  // every history is cut to the report's period (its last points.length syncs)
  const inPeriod = (arr) => (arr && history && arr.length >= points.length ? arr.slice(-points.length) : null)
  const rivalShare = inPeriod(r.points?.map((p) => p.share))
  const youShare = history && points.every((p) => p.share != null) ? series('share') : null
  const theyWin = inPeriod(h?.theyWin)
  const youWin = inPeriod(h?.youWin)
  const start = points[0]?.date
  const vs = (values, short, label, kind = 'rival') => (values ? { values, short, label, kind } : null)

  const kpis = [
    kpi({ id: 'rival', label: `${R}’s share of voice`, value: `${r.share}%`, series: rivalShare, unit: '%', short: R, lowerIsBetter: true, compare: vs(youShare, 'you', brand), start, subject: R }),
    kpi({ id: 'named', label: 'Prompts naming you', value: (points.at(-1)?.visible ?? facts.visible).toLocaleString(), series: series('visible'), unit: 'prompts', short: 'you', compare: prevPeriod(prev, points, 'visible'), start, subject: 'You', noun: 'prompts' }),
    { ...kpi({ id: 'wins', label: 'Prompts they win', value: wins.length.toLocaleString(), series: theyWin, unit: 'prompts', short: R, lowerIsBetter: true, compare: vs(youWin, 'you', 'Prompts you win'), start, subject: R, noun: 'prompts' }), ribbon: theyWin && youWin ? ribbon(youWin, theyWin, points, brand, R) : null },
    kpi({ id: 'share', label: 'Your share of voice', value: `${facts.youShare}%`, series: youShare, unit: '%', short: 'you', compare: vs(rivalShare, R, r.name), start, subject: 'You' }),
  ]

  // Topics: every topic, you vs them (proposed per-topic counts); live, the topics of the prompts you're missing, them
  // vs the rest of the missing
  const topicRows = proposed && facts.topics?.length
    ? facts.topics.map((t) => ({ t: t.topic, you: t.visible, them: t.competitors.find((c) => c.domain === r.domain)?.n ?? 0 }))
      .sort((a, b) => (b.them - b.you) - (a.them - a.you))
      .map((t) => ({ t: t.t, click: winTopics.some((g) => g.key === t.t) ? t.t : null, split: [{ v: t.you, tone: 'you' }, { v: t.them, tone: 'them' }], vals: [{ v: t.you }, { v: t.them, tone: t.them > t.you ? 'dn' : '' }] }))
    : groupBy(missedRows, (x) => x.topic).map((g) => {
      const them = g.items.filter((x) => x.competitors.includes(r.domain)).length
      return { t: g.key, click: them ? g.key : null, split: [{ v: them, tone: 'them' }, { v: g.items.length - them, tone: 'rest' }], vals: [{ v: them, tone: them ? 'dn' : '' }, { v: g.items.length }] }
    }).sort((a, b) => b.vals[0].v - a.vals[0].v || b.vals[1].v - a.vals[1].v)
  const topicCols = proposed && facts.topics?.length ? ['You', 'Them'] : ['Them', 'Missing']
  const promptRows = wins.map((w) => ({ t: w.prompt, icon: w.engine ? engine(w.engine) : null, topic: w.topic, vals: [{ text: w.topic ?? '' }] }))

  const theirs = (r.cited || []).map((p) => ({ t: p.path, n: p.n, icon: brandIcon(r.domain, r.name), vals: [{ text: (p.topics || []).join(', ') }, { v: p.n }] }))
  const yours = (facts.cited || []).map((p) => ({ t: p.path, n: p.n, icon: brandIcon(facts.domain, brand) }))

  // Engines: every engine; you · them · neither (proposed per-engine head-to-head), live: prompts naming you and the
  // prompts they win there; engines that didn't run, muted
  const ran = facts.ran || []
  const engineRows = ALL_ENGINES.map((id) => {
    if (!ran.includes(id)) return { t: ENGINE_NAMES[id], icon: engine(id), muted: true, note: 'didn’t run', vals: [] }
    const e = h?.engines?.find((x) => x.id === id)
    // you, them, and your share of the answers naming either of you on that engine
    const you = e ? e.you : facts.engines?.find((x) => x.id === id)?.visible ?? 0
    const them = e ? e.them : wins.filter((w) => w.engine === id).length
    return { t: ENGINE_NAMES[id], icon: engine(id), vals: [{ v: you }, { v: them, tone: them > you ? 'dn' : '' }, { v: you + them ? Math.round((you / (you + them)) * 100) : 0, suf: '%' }] }
  })
  const engineCols = ['You', 'Them', 'Share']

  const share = [{ t: brand, n: facts.youShare, domain: facts.domain }, ...rivals.map((c) => ({ t: c.name, n: c.share, domain: c.domain }))]
    .filter((x) => x.n != null).sort((a, b) => b.n - a.n).map((x) => ({ t: x.t, n: x.n, icon: brandIcon(x.domain, x.t), suf: '%', max: 100 }))
  const topicOf = (rows, p) => rows?.find((x) => x.prompt === p)?.topic ?? ''
  const gained = changeTab(history ? facts.gained || [] : [], facts.gainedRows, 'up', '+')
  const lost = changeTab(history ? facts.lost || [] : [], facts.lostRows, 'dn', '−')

  const row2 = [
    panel('topics', [tab('topics', 'Topics', topicCols, topicRows), tab('prompts', 'Prompts', ['Topic'], promptRows)]),
    panel('pages', [tab('theirs', 'Their pages', theirs.length < 5 ? ['Topic', 'Cited'] : 'Answers citing', theirs.length < 5 ? theirs : theirs.map(({ vals, ...p }) => p)), tab('yours', 'Your pages', 'Answers citing', yours)]),
  ].filter(Boolean)
  const row3 = [
    panel('engines', [tab('engines', 'Engines', engineCols, engineRows)], true, true),
    panel('brands', [tab('brands', 'Share of answers', 'Share', share)], true),
    panel('change', [tab('gained', 'Gained', gained.cols, gained.rows), tab('lost', 'Lost', lost.cols, lost.rows)]),
  ].filter(Boolean)

  // the next steps: one per topic they win. Columns: the action, its topic, the engines they win it on, their page AI
  // cites for it and how often, the effort, the prompts it could win
  const steps = winTopics.length ? {
    title: 'Close the gap', col: 'Prompts it could win', total: wins.length, rival: R,
    rows: winTopics.slice(0, 3).map((g) => {
      const why = r.why?.find((w) => w.theme === g.key)
      const yourPage = why?.you
      return {
        t: yourPage ? `Add ${lower(g.key)} answers to ${yourPage.path}` : `Write a ${lower(g.key)} page`,
        topic: g.key,
        engines: [...new Set(g.items.map((w) => w.engine).filter(Boolean))].map(engine),
        page: why?.them ? { path: why.them.path, icon: brandIcon(r.domain, r.name) } : null,
        cited: why?.them?.n ?? null,
        effort: yourPage ? (/faq/i.test(yourPage.path) ? 'FAQ' : 'Update') : 'New page',
        n: g.items.length,
        why: why?.them ? `${R}’s ${why.them.path} is cited in ${plural(why.them.n, 'answer')}. ${yourPage ? `Yours, ${yourPage.path}, in ${yourPage.n}.` : 'You have no page for this.'}`
          : `${R} is named on ${g.items.length} of these prompts and you aren’t.`,
        prompts: g.items.map((w) => w.prompt),
      }
    }),
  } : null

  const top2 = winTopics.slice(0, 2).map((g) => lower(g.key))
  const mostly = top2.length ? `, mostly ${top2.join(' and ')}` : ''
  const answer = wins.length
    ? (h ? `${R} wins ${wins.length} of your ${N} prompts${mostly}.` : `${R} is named on ${wins.length} of your ${N} prompts where you aren’t${mostly}.`)
    : `${R} isn’t named on any prompt without you.`
  // the default tab is the gap (Prompts they win) when its history is there, else the first with a chart
  return { question: `Where is ${R} beating us?`, answer, kpis, defaultKpi: kpis.find((k) => k.ribbon)?.id ?? kpis.find((k) => k.series)?.id ?? kpis[0].id, row2, row3, steps }
}

// ---- shared panels -------------------------------------------------------------------------------------------------
const topicOfRow = (rows, p) => rows?.find((x) => x.prompt === p)?.topic ?? ''
// Gained / Lost: the prompt gets the full width (two lines at most); its topic is in the drawer
function changeTab(list, rowsOf, tone, pre, col = 'This week') {
  return { cols: col, rows: list.map((t) => ({ t, n: 1, sign: tone, pre, wrap: true, topic: topicOfRow(rowsOf, t) || null })) }
}
function shareRows(facts, brand) {
  return [{ t: brand, n: facts.youShare, domain: facts.domain }, ...(facts.competitors || []).map((c) => ({ t: c.name, n: c.share, domain: c.domain }))]
    .filter((x) => x.n != null).sort((a, b) => b.n - a.n).map((x) => ({ t: x.t, n: x.n, icon: brandIcon(x.domain, x.t), suf: '%', max: 100 }))
}
// every engine: prompts naming you and not, the ones that didn't run muted
function engineNamedRows(facts, N, labels = ['Named', 'Not named']) {
  const rows = ALL_ENGINES.map((id) => {
    if (!(facts.ran || []).includes(id)) return { t: ENGINE_NAMES[id], icon: engine(id), muted: true, note: 'didn’t run', vals: [] }
    const you = facts.engines?.find((x) => x.id === id)?.visible ?? 0
    return { t: ENGINE_NAMES[id], icon: engine(id), vals: [{ v: you }, { v: N - you }, { v: Math.round((you / N) * 100), suf: '%' }] }
  })
  return { cols: [...labels, 'Share'], rows }
}
const yourPages = (facts, brand) => (facts.cited || []).map((p) => ({ t: p.path, n: p.n, icon: brandIcon(facts.domain, brand) }))
const series = (ctx, k) => (ctx.history && ctx.points.every((p) => p[k] != null) ? ctx.points.map((p) => p[k]) : null)
const inPeriodOf = (ctx) => (arr) => (arr && ctx.history && arr.length >= ctx.points.length ? arr.slice(-ctx.points.length) : null)
// a step row: the action, its topic, engines, a competitor's page AI cites for it and how often, the effort, +N
function stepRow({ t, topic, n, prompts, engines = [], why, facts }) {
  const cited = (facts.competitors || []).map((c) => ({ c, w: c.why?.find((w) => w.theme === topic) })).find((x) => x.w?.them)
  const yourPage = cited?.w?.you
  return {
    t, topic, n, prompts, engines,
    page: cited ? { path: cited.w.them.path, icon: brandIcon(cited.c.domain, cited.c.name) } : null,
    cited: cited?.w.them.n ?? null,
    effort: cited ? (yourPage ? (/faq/i.test(yourPage.path) ? 'FAQ' : 'Update') : 'New page') : null,
    why: cited ? `${shortName(cited.c.name)}’s ${cited.w.them.path} is cited in ${plural(cited.w.them.n, 'answer')}. ${yourPage ? `Yours, ${yourPage.path}, in ${yourPage.n}.` : 'You have no page for this.'}` : why,
  }
}

// ---- Weekly summary / Client update --------------------------------------------------------------------------------
function weekly(ctx) {
  const { facts, points, history, proposed, brand, N, client } = ctx
  const start = points[0]?.date
  const W = client
    ? { score: 'Visibility score', named: 'Questions you show up for', gained: 'New', lost: 'Dropped', gl: 'New / dropped', topics: 'Topics that moved', engines: 'Where you show up', pages: 'Your pages AI uses', steps: 'Win these back', noun: 'questions' }
    : { score: 'Visibility score', named: 'Prompts named', gained: 'Gained', lost: 'Lost', gl: 'Gained / lost', topics: 'Topics moved', engines: 'Engines', pages: 'Your pages cited', steps: 'Fix what moved', noun: 'prompts' }
  const visible = points.at(-1)?.visible ?? facts.visible
  const gainedList = history ? facts.gained || [] : []
  const lostList = history ? facts.lost || [] : []
  // gained / lost per sync (proposed): the first sync has nothing before it, so those charts start at the second
  const perSync = (k) => (proposed && ctx.history && points.slice(1).every((p) => p[k] != null) ? points.slice(1).map((p) => p[k]) : null)
  const gS = perSync('gained'), lS = perSync('lost')
  const total = (xs) => xs.reduce((a, b) => a + b, 0)
  const flowInsight = gS && lS ? { text: `${total(gS)} ${W.gained.toLowerCase()} and ${total(lS)} ${W.lost.toLowerCase()} since ${start}.`, why: `${W.gained} and ${W.lost.toLowerCase()} at each sync, against the sync before: ${points.slice(1).map((p, i) => `${p.date} +${gS[i]} / −${lS[i]}`).join(', ')}.` } : null
  const kpis = [
    kpi({ id: 'score', label: W.score, value: `${points.at(-1)?.score ?? facts.score}`, series: series(ctx, 'score'), unit: '', short: 'you', compare: prevPeriod(ctx.prev, points, 'score'), start, subject: client ? 'Your score' : 'The score', noun: 'points' }),
    kpi({ id: 'named', label: W.named, value: visible.toLocaleString(), series: series(ctx, 'visible'), unit: W.noun, short: 'you', compare: prevPeriod(ctx.prev, points, 'visible'), start, subject: 'You', noun: W.noun }),
    { ...kpi({ id: 'gained', label: W.gained, value: `${gainedList.length}`, series: gS, unit: W.noun, short: W.gained.toLowerCase(), compare: lS ? { values: lS, short: W.lost.toLowerCase(), label: W.lost, kind: 'rival' } : null, start, subject: 'You', noun: W.noun }), offset: 1, insight: flowInsight },
    { ...kpi({ id: 'lost', label: W.lost, value: `${lostList.length}`, series: lS, unit: W.noun, short: W.lost.toLowerCase(), lowerIsBetter: true, compare: gS ? { values: gS, short: W.gained.toLowerCase(), label: W.gained, kind: 'rival' } : null, start, subject: 'You', noun: W.noun }), offset: 1, insight: flowInsight },
  ].filter((k) => history || (k.id !== 'gained' && k.id !== 'lost'))

  const g = changeTab(gainedList, facts.gainedRows, 'up', '+')
  const l = changeTab(lostList, facts.lostRows, 'dn', '−')
  // topics that moved: gained vs lost per topic (the topic field the app is adding)
  const moved = new Map()
  gainedList.forEach((p) => { const t = topicOfRow(facts.gainedRows, p); if (t) moved.set(t, { g: (moved.get(t)?.g ?? 0) + 1, l: moved.get(t)?.l ?? 0 }) })
  lostList.forEach((p) => { const t = topicOfRow(facts.lostRows, p); if (t) moved.set(t, { g: moved.get(t)?.g ?? 0, l: (moved.get(t)?.l ?? 0) + 1 }) })
  const topicRows = [...moved].sort((a, b) => (b[1].g - b[1].l) - (a[1].g - a[1].l)).map(([t, m]) => ({ t, split: [{ v: m.g, tone: 'you' }, { v: m.l, tone: 'them' }], vals: [{ v: m.g, tone: m.g ? 'up' : '', pre: m.g ? '+' : '' }, { v: m.l, tone: m.l ? 'dn' : '', pre: m.l ? '−' : '' }] }))
  const eng = engineNamedRows(facts, N, client ? ['Shown', 'Not shown'] : ['Named', 'Not named'])
  const row2 = [
    panel('change', [tab('gained', W.gained, g.cols, g.rows), tab('lost', W.lost, l.cols, l.rows)]),
    panel('topics', [tab('topics', W.topics, [W.gained, W.lost], topicRows)], true),
  ].filter(Boolean)
  const row3 = [
    panel('engines', [tab('engines', W.engines, eng.cols, eng.rows)], true, true),
    panel('brands', [tab('brands', client ? 'Share of AI answers' : 'Share of answers', 'Share', shareRows(facts, brand))], true),
    panel('pages', [tab('pages', W.pages, 'Answers citing', yourPages(facts, brand))], true),
  ].filter(Boolean)

  // fix what moved: the topics you lost prompts in
  const lostTopics = groupBy(lostList.map((p) => ({ prompt: p, topic: topicOfRow(facts.lostRows, p) })), (x) => x.topic || null)
  const steps = lostTopics.length ? {
    title: W.steps, col: client ? 'Questions to win back' : 'Prompts to win back', total: Math.max(...lostTopics.map((g) => g.items.length)) * 2,
    rows: lostTopics.slice(0, 4).map((g) => stepRow({ facts, t: `Win back ${lower(g.key)}`, topic: g.key, n: g.items.length, prompts: g.items.map((x) => x.prompt), why: `You were named on ${plural(g.items.length, 'of these prompts', 'of these prompts')} at the sync before and aren’t now.` })),
  } : null

  const d = history ? visible - points[0].visible : null
  const answer = client
    ? (history ? `You showed up in AI answers for ${visible} of ${N} questions, ${d >= 0 ? `${d} more` : `${-d} fewer`} than ${start}.` : `You showed up in AI answers for ${visible} of ${N} questions in the first scan.`)
    : (history ? `${brand} is named on ${visible === N ? `all ${N}` : `${visible} of ${N}`} prompts, ${d > 0 ? `up ${d}` : d < 0 ? `down ${-d}` : 'unchanged'} since ${start}.` : `${brand} is named on ${visible} of ${N} prompts in its first scan.`)
  const when = { week: 'this week', '30d': 'this month', quarter: 'this quarter' }[ctx.opts.period] ?? 'lately'
  return { question: client ? `Client update: ${MONTH[ctx.latest?.date?.split(' ')[0]] ?? 'latest scan'}` : `What moved ${when}?`, answer, kpis, defaultKpi: kpis.find((k) => k.id === 'named' && k.series) ? 'named' : kpis.find((k) => k.series)?.id ?? 'named', row2, row3, steps }
}

// ---- CEO summary ---------------------------------------------------------------------------------------------------
function ceo(ctx) {
  const { facts, points, proposed, brand, N } = ctx
  const start = points[0]?.date
  const inPeriod = inPeriodOf(ctx)
  const ranked = [...(facts.competitors || [])].filter((c) => c.share != null).sort((a, b) => b.share - a.share)
  const top = ranked[0]
  const lead = facts.youShare - top.share
  const youS = proposed ? series(ctx, 'share') : null
  const topS = inPeriod(top.points?.map((p) => p.share))
  const leadS = youS && topS ? youS.map((v, i) => v - topS[i]) : null
  const ts = proposed ? [...(facts.topicShare || [])].sort((a, b) => b.lead - a.lead) : []
  const led = ts.filter((t) => t.lead > 0).length
  const ledS = ts.length && ctx.history && ts.every((t) => t.trend?.length >= points.length) ? points.map((_, i) => ts.filter((t) => t.trend.slice(-points.length)[i] > 0).length) : null
  const T = shortName(top.name)
  const kpis = [
    kpi({ id: 'share', label: 'Share of voice', value: `${facts.youShare}%`, series: youS, unit: '%', short: 'you', compare: topS ? { values: topS, short: T, label: top.name, kind: 'rival' } : null, start, subject: 'You' }),
    kpi({ id: 'lead', label: lead >= 0 ? 'Lead over #2' : `Behind ${T}`, value: `${lead > 0 ? '+' : lead < 0 ? '−' : ''}${Math.abs(lead)} pts`, series: leadS, unit: 'pts', short: 'lead', start, subject: 'Your lead', noun: 'points' }),
    kpi({ id: 'named', label: 'Prompts naming you', value: (points.at(-1)?.visible ?? facts.visible).toLocaleString(), series: series(ctx, 'visible'), unit: 'prompts', short: 'you', compare: prevPeriod(ctx.prev, points, 'visible'), start, subject: 'You', noun: 'prompts' }),
    kpi({ id: 'topics', label: 'Topics you lead', value: ts.length ? `${led}/${ts.length}` : '—', series: ledS, unit: 'topics', short: 'you', start, subject: 'You', noun: 'topics' }),
  ].filter((k) => k.id !== 'topics' || ts.length)

  const leadRows = ts.map((t) => ({ t: t.topic, split: t.lead >= 0 ? [{ v: t.lead, tone: 'you' }] : [{ v: -t.lead, tone: 'them' }], vals: [{ text: t.leader ?? 'you' }, { v: t.lead, tone: t.lead < 0 ? 'dn' : '', pre: t.lead > 0 ? '+' : t.lead < 0 ? '−' : '', abs: true }] }))
  leadRows.forEach((r) => { const v = r.vals[1]; v.v = Math.abs(v.v); v.suf = ' pts' })
  const comps = ranked.map((c, i) => {
    const sh = inPeriod(c.points?.map((p) => p.share))
    const ch = sh ? sh.at(-1) - sh[0] : null
    return { t: c.name, icon: brandIcon(c.domain, c.name), vals: [...(ch != null ? [{ v: Math.abs(ch), tone: ch > 0 ? 'dn' : ch < 0 ? 'up' : '', pre: ch > 0 ? '+' : ch < 0 ? '−' : '±', suf: ' pts' }] : []), { v: c.share, suf: '%' }] }
  })
  const g = changeTab(ctx.history ? facts.gained || [] : [], facts.gainedRows, 'up', '+')
  const l = changeTab(ctx.history ? facts.lost || [] : [], facts.lostRows, 'dn', '−')
  const eng = engineNamedRows(facts, N)
  const row2 = [
    panel('topics', [tab('topics', 'Topics by your lead', ['Leader', 'Lead'], leadRows)], true),
    panel('competitors', [tab('competitors', 'Competitors', comps.some((c) => c.vals.length > 1) ? ['Change', 'Share'] : ['Share'], comps)], true, comps.some((c) => c.vals.length > 1)),
  ].filter(Boolean)
  const row3 = [
    panel('engines', [tab('engines', 'Engines', eng.cols, eng.rows)], true, true),
    panel('pages', [tab('pages', 'Your pages', 'Answers citing', yourPages(facts, brand))], true),
    panel('change', [tab('gained', 'Gained', g.cols, g.rows), tab('lost', 'Lost', l.cols, l.rows)]),
  ].filter(Boolean)

  // biggest wins: proposed, the topics whose lead grew most; live, the topics you gained prompts in
  const wins = ts.length && ctx.history ? ts.map((t) => ({ ...t, gain: t.trend.slice(-points.length).at(-1) - t.trend.slice(-points.length)[0] })).filter((t) => t.gain > 0).sort((a, b) => b.gain - a.gain).slice(0, 3) : []
  const gainedTopics = groupBy((ctx.history ? facts.gained || [] : []).map((p) => ({ prompt: p, topic: topicOfRow(facts.gainedRows, p) })), (x) => x.topic || null)
  const steps = wins.length
    ? { title: 'Biggest wins', col: 'Points of lead gained', total: Math.max(...wins.map((w) => w.gain)) * 1.5, rows: wins.map((w) => ({ t: `Build on ${lower(w.topic)}`, topic: w.topic, n: w.gain, prompts: [], engines: [], why: `Your lead in ${lower(w.topic)} grew ${w.gain} points since ${start}; it’s now ${w.lead > 0 ? '+' : ''}${w.lead}.` })) }
    : gainedTopics.length ? { title: 'Biggest wins', col: 'Prompts gained', total: Math.max(...gainedTopics.map((x) => x.items.length)) * 1.5, rows: gainedTopics.slice(0, 3).map((x) => ({ t: `Build on ${lower(x.key)}`, topic: x.key, n: x.items.length, prompts: x.items.map((i) => i.prompt), engines: [], why: `You’re newly named on ${plural(x.items.length, 'of these prompts', 'of these prompts')}.` })) } : null

  const answer = lead >= 0 ? `Yes. ${brand} has ${facts.youShare}% of AI answers, ${lead} points ahead of ${T}.` : `Not yet. ${T} has ${top.share}% of AI answers; ${brand} has ${facts.youShare}%.`
  return { question: 'Are we winning in AI search?', answer, kpis, defaultKpi: kpis.find((k) => k.series)?.id ?? 'share', row2, row3, steps }
}

// ---- Missing prompts -----------------------------------------------------------------------------------------------
function missing(ctx) {
  const { facts, points, history, brand, N } = ctx
  const start = points[0]?.date
  const rows = facts.missedRows || []
  const nobody = rows.filter((x) => !x.competitors.length)
  const owners = groupBy(rows.filter((x) => x.competitors.length), (x) => x.competitors[0])
  const top = owners[0]
  const topName = top ? shortName(nameOf(facts, top.key)) : null
  const missS = history ? points.map((p) => N - p.visible) : null
  const covS = history ? points.map((p) => Math.round((p.visible / N) * 100)) : null
  const prevMiss = prevPeriod(ctx.prev, points, 'visible')
  if (prevMiss) prevMiss.values = prevMiss.values.map((v) => (v == null ? null : N - v))
  const kpis = [
    kpi({ id: 'missing', label: 'Missing', value: `${rows.length}`, series: missS, unit: 'prompts', short: 'missing', lowerIsBetter: true, compare: prevMiss, start, subject: 'Missing prompts', noun: '' }),
    kpi({ id: 'nobody', label: 'Nobody named', value: `${nobody.length}`, series: null, unit: 'prompts', short: 'nobody', start }),
    ...(top ? [kpi({ id: 'top', label: `${topName} named instead`, value: `${top.items.length}`, series: null, unit: 'prompts', short: topName, start })] : []),
    kpi({ id: 'coverage', label: 'Coverage', value: `${Math.round(((points.at(-1)?.visible ?? facts.visible) / N) * 100)}%`, series: covS, unit: '%', short: 'you', start, subject: 'Coverage' }),
  ]
  kpis.forEach((k) => { if (k.id === 'missing' && k.insight) k.insight.text = k.insight.text.replace(/^Missing prompts gained/, 'Missing prompts rose by').replace(/^Missing prompts lost/, 'Missing prompts fell by') })

  const byTopic = groupBy(rows, (x) => x.topic).map((g) => {
    const comp = g.items.filter((x) => x.competitors.length).length
    return { t: g.key, click: g.key, split: [{ v: comp, tone: 'them' }, { v: g.items.length - comp, tone: 'rest' }], vals: [{ v: comp }, { v: g.items.length - comp }] }
  })
  const promptRows = rows.map((x) => ({ t: x.prompt, icon: x.engines?.[0] ? engine(x.engines[0]) : null, topic: x.topic, vals: [{ text: x.competitors.length ? shortName(nameOf(facts, x.competitors[0])) : 'nobody' }] }))
  const who = [...owners.map((g) => ({ t: nameOf(facts, g.key), icon: brandIcon(g.key, nameOf(facts, g.key)), n: g.items.length, topics: new Set(g.items.map((x) => x.topic).filter(Boolean)).size })), ...(nobody.length ? [{ t: 'Nobody', n: nobody.length, topics: new Set(nobody.map((x) => x.topic).filter(Boolean)).size }] : [])]
    .sort((a, b) => b.n - a.n)
  const whoRows = who.length < 5 ? who.map((w) => ({ ...w, vals: [{ text: `${w.topics} topic${w.topics === 1 ? '' : 's'}` }, { v: w.n }] })) : who
  const eng = ALL_ENGINES.map((id) => {
    if (!(facts.ran || []).includes(id)) return { t: ENGINE_NAMES[id], icon: engine(id), muted: true, note: 'didn’t run', vals: [] }
    const you = facts.engines?.find((x) => x.id === id)?.visible ?? 0
    return { t: ENGINE_NAMES[id], icon: engine(id), vals: [{ v: N - you }, { v: you }, { v: Math.round((you / N) * 100), suf: '%' }] }
  })
  const theirPages = (facts.competitors || []).flatMap((c) => (c.cited || []).map((p) => ({ t: p.path, n: p.n, icon: brandIcon(c.domain, c.name), vals: [{ text: shortName(c.name) }, { v: p.n }] })))
  const openRows = nobody.map((x) => ({ t: x.prompt, topic: x.topic, vals: nobody.length < 5 ? [{ text: x.topic ?? '' }] : undefined }))
  const row2 = [
    panel('topics', [tab('topics', 'Missing by topic', ['Competitor', 'Nobody'], byTopic), tab('prompts', 'Prompts', ['Named instead'], promptRows)]),
    panel('who', [tab('who', 'Who’s named instead', who.length < 5 ? ['Topics', 'Prompts'] : 'Prompts', whoRows)], true),
  ].filter(Boolean)
  const row3 = [
    panel('engines', [tab('engines', 'Engines', ['Missing', 'Named', 'Share'], eng)], true, true),
    panel('pages', [tab('pages', 'Their pages', ['Brand', 'Cited'], theirPages)], true),
    panel('open', [tab('open', 'Open prompts', nobody.length < 5 ? ['Topic'] : null, openRows)], true),
  ].filter(Boolean)

  // quick wins: the topics with the most prompts nobody is named on, then the rest
  const qt = groupBy(rows, (x) => x.topic).map((g) => ({ ...g, open: g.items.filter((x) => !x.competitors.length).length })).sort((a, b) => b.open - a.open || b.items.length - a.items.length).slice(0, 4)
  const steps = qt.length ? {
    title: 'Quick wins', col: 'Prompts it could win', total: Math.max(...qt.map((g) => g.items.length)) * 1.5,
    rows: qt.map((g) => stepRow({ facts, t: `Write a ${lower(g.key)} page`, topic: g.key, n: g.items.length, prompts: g.items.map((x) => x.prompt), engines: [...new Set(g.items.flatMap((x) => x.engines || []))].map(engine), why: `${g.open} of these name no brand at all; ${g.items.length - g.open} name a competitor.` })),
  } : null

  const answer = rows.length ? `${brand} is missing ${rows.length} of ${N} prompts; ${nobody.length} of them name no brand at all.` : `${brand} is named on all ${N} prompts.`
  return { question: 'Which prompts are we missing?', answer, kpis, defaultKpi: kpis.find((k) => k.series)?.id ?? 'missing', row2, row3, steps }
}

// the gap ribbon: you vs them per sync, and the story of who led ("Longbridge overtook you on Sep 21 and Sep 28; you've
// led since Oct 5.")
function ribbon(you, them, points, brand, R) {
  const dates = points.map((p) => p.date)
  const lead = you.map((v, i) => v - them[i])
  const sign = (d) => (d > 0 ? 1 : d < 0 ? -1 : 0)
  const overtakes = lead.map((d, i) => (i > 0 && sign(d) < 0 && sign(lead[i - 1]) >= 0 ? dates[i] : null)).filter(Boolean)
  const now = sign(lead.at(-1))
  let since = lead.length - 1
  while (since > 0 && sign(lead[since - 1]) === now) since--
  const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0])
  const gap = Math.abs(lead.at(-1))
  const text = overtakes.length
    ? `${R} overtook you on ${list(overtakes)}; ${now > 0 ? `you’ve led since ${dates[since]}` : now < 0 ? `they’ve led since ${dates[since]}` : 'you’re level now'}.`
    : now > 0 ? `You’ve led ${R} at every sync since ${dates[0]}; the gap is ${gap} prompts.` : now < 0 ? `${R} has led at every sync since ${dates[0]}; the gap is ${gap} prompts.` : `You and ${R} are level.`
  return { you: { values: you, label: brand, short: 'you' }, them: { values: them, label: R, short: R }, insight: { text, why: `Prompts you win (named, and named before ${R} when both are) vs prompts ${R} wins, at each sync: ${dates.map((d, i) => `${d} ${you[i]}–${them[i]}`).join(', ')}.` } }
}

// a KPI: its delta, and the insight under the chart ("You gained 13 prompts since Sep 7; Longbridge stayed flat.")
function kpi(k) {
  const d = delta(k.series, { unit: k.unit === '%' ? ' pts' : '', lowerIsBetter: k.lowerIsBetter })
  return { ...k, delta: d, insight: k.series ? insightFor(k) : null }
}
function moved(subject, values, noun, unit) {
  const n = values.at(-1) - values[0]
  const what = unit === '%' ? `${Math.abs(n)} point${Math.abs(n) === 1 ? '' : 's'} of share` : `${Math.abs(n)} ${noun ?? ''}`.trim()
  return n === 0 ? `${subject} stayed flat` : `${subject} ${n > 0 ? 'gained' : 'lost'} ${what}`
}
function insightFor(k) {
  const head = moved(k.subject, k.series, k.noun, k.unit)
  const c = k.compare
  const tail = !c ? '' : c.kind === 'previous'
    ? `; the period before ended at ${c.values.at(-1)}${k.unit === '%' ? '%' : ''}`
    : `; ${moved(c.short === 'you' ? 'you' : c.short, c.values.filter((v) => v != null), k.noun, k.unit)}`
  const why = [`${k.label}: ${k.series[0]}${k.unit === '%' ? '%' : ''} on ${k.start} → ${k.series.at(-1)}${k.unit === '%' ? '%' : ''} at the latest sync.`,
    c ? `${c.label}: ${c.values.find((v) => v != null)}${k.unit === '%' ? '%' : ''} → ${c.values.at(-1)}${k.unit === '%' ? '%' : ''}.` : ''].join(' ').trim()
  return { text: `${head} since ${k.start}${tail}.`, why }
}
// the previous period for a number that's only about you: the same number of syncs before the period, lined up from
// its end (missing syncs stay empty)
function prevPeriod(prev, points, key) {
  if (!prev?.length || points.length < 2) return null
  const before = prev.slice(-points.length)
  const values = points.map((_, i) => before[i - (points.length - before.length)]?.[key] ?? null)
  return values.some((v) => v != null) ? { values, short: 'prev.', label: 'Previous period', kind: 'previous' } : null
}

// col: one column label, or several (one per value column)
const tab = (key, label, col, rows) => ({ key, label, col, rows })
// a panel keeps the tabs that have rows; with none it's dropped
// plain: rows without bars, hairline dividers (rows that carry several value columns)
function panel(id, tabs, solo = false, plain = false) {
  const kept = tabs.filter((t) => t.rows.length)
  return kept.length ? { id, tabs: kept, solo: solo || kept.length === 1, plain } : null
}
