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

export const shortName = (name = '') => (name.length <= 14 ? name : name.replace(/^The\s+/i, '').split(/\s+/)[0])
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`
const groupBy = (rows, key) => {
  const m = new Map()
  rows.forEach((r) => { const k = key(r); if (k == null) return; if (!m.has(k)) m.set(k, []); m.get(k).push(r) })
  return [...m].map(([k, items]) => ({ key: k, items })).sort((a, b) => b.items.length - a.items.length)
}
const nameOf = (facts, domain) => (facts.competitors || []).find((c) => c.domain === domain)?.name ?? domain
const lower = (t) => t.charAt(0).toLowerCase() + t.slice(1)

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
  const body = kind === 'rival' ? competitor(ctx) : competitor(ctx) // the other types follow once Competitor gap is approved

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
    kpi({ id: 'wins', label: 'Prompts they win', value: wins.length.toLocaleString(), series: theyWin, unit: 'prompts', short: R, lowerIsBetter: true, compare: vs(youWin, 'you', 'Prompts you win'), start, subject: R, noun: 'prompts' }),
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
    if (e) return { t: ENGINE_NAMES[id], icon: engine(id), split: [{ v: e.you, tone: 'you' }, { v: e.them, tone: 'them' }, { v: e.neither, tone: 'rest' }], vals: [{ v: e.you }, { v: e.them, tone: e.them > e.you ? 'dn' : '' }, { v: e.neither }] }
    const you = facts.engines?.find((x) => x.id === id)?.visible ?? 0
    const them = wins.filter((w) => w.engine === id).length
    return { t: ENGINE_NAMES[id], icon: engine(id), split: [{ v: you, tone: 'you' }, { v: them, tone: 'them' }], vals: [{ v: you }, { v: them }] }
  })
  const engineCols = h?.engines?.length ? ['You', 'Them', 'Neither'] : ['You', 'Them']

  const share = [{ t: brand, n: facts.youShare, domain: facts.domain }, ...rivals.map((c) => ({ t: c.name, n: c.share, domain: c.domain }))]
    .filter((x) => x.n != null).sort((a, b) => b.n - a.n).map((x) => ({ t: x.t, n: x.n, icon: brandIcon(x.domain, x.t), suf: '%', max: 100 }))
  const topicOf = (rows, p) => rows?.find((x) => x.prompt === p)?.topic ?? ''
  // a panel with fewer than 5 rows shows its secondary breakdown (here: the topic) so it's never mostly blank
  const change = (list, rowsOf, tone, pre) => {
    const few = list.length < 5
    return { cols: few ? ['Topic', 'This week'] : 'This week', rows: list.map((t) => (few ? { t, vals: [{ text: topicOf(rowsOf, t) }, { v: 1, tone, pre }] } : { t, n: 1, sign: tone, pre })) }
  }
  const gained = change(history ? facts.gained || [] : [], facts.gainedRows, 'up', '+')
  const lost = change(history ? facts.lost || [] : [], facts.lostRows, 'dn', '−')

  const row2 = [
    panel('topics', [tab('topics', 'Topics', topicCols, topicRows), tab('prompts', 'Prompts', ['Topic'], promptRows)]),
    panel('pages', [tab('theirs', 'Their pages', theirs.length < 5 ? ['Topic', 'Cited'] : 'Answers citing', theirs.length < 5 ? theirs : theirs.map(({ vals, ...p }) => p)), tab('yours', 'Your pages', 'Answers citing', yours)]),
  ].filter(Boolean)
  const row3 = [
    panel('engines', [tab('engines', 'Engines', engineCols, engineRows)], true),
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
  return { question: `Where is ${R} beating us?`, answer, kpis, defaultKpi: kpis.find((k) => k.series)?.id ?? kpis[0].id, row2, row3, steps }
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
function panel(id, tabs, solo = false) {
  const kept = tabs.filter((t) => t.rows.length)
  return kept.length ? { id, tabs: kept, solo: solo || kept.length === 1 } : null
}
