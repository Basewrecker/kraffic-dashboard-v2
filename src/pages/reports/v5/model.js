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

export function buildReport5({ facts, built, points, prompt = '', read = null }) {
  const opts = built.opts
  const kind = read?.kind ?? built.kind
  const history = points.length >= 2
  const ctx = { facts, opts, points, history, start: points[0], latest: points.at(-1), proposed: !!facts.proposed, brand: facts.name, N: facts.prompts }
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
function competitor({ facts, opts, points, history, proposed, brand, N }) {
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
  const topics = groupBy(wins, (w) => w.topic)
  const series = (k) => (history ? points.map((p) => p[k]) : null)
  const rivalShare = r.points?.length >= 2 && history ? r.points.map((p) => p.share) : null
  const youShare = history && points.every((p) => p.share != null) ? series('share') : null
  const theyWin = h && history ? h.theyWin : null

  const kpis = [
    { id: 'rival', label: `${R}’s share of voice`, value: `${r.share}%`, series: rivalShare, unit: '%', delta: delta(rivalShare, { unit: ' pts', lowerIsBetter: true }) },
    { id: 'named', label: 'Prompts naming you', value: (points.at(-1)?.visible ?? facts.visible).toLocaleString(), series: series('visible'), unit: 'prompts', delta: delta(series('visible')) },
    { id: 'wins', label: 'Prompts they win', value: wins.length.toLocaleString(), series: theyWin, unit: 'prompts', delta: delta(theyWin, { lowerIsBetter: true }) },
    { id: 'share', label: 'Your share of voice', value: `${facts.youShare}%`, series: youShare, unit: '%', delta: delta(youShare, { unit: ' pts' }) },
  ]

  const topicRows = topics.map((g) => ({ t: g.key, n: g.items.length, click: g.key }))
  const promptRows = wins.map((w) => ({ t: w.prompt, icon: w.engine ? engine(w.engine) : null, topic: w.topic }))
  const theirs = (r.cited || []).map((p) => ({ t: p.path, n: p.n, icon: brandIcon(r.domain, r.name) }))
  const yours = (facts.cited || []).map((p) => ({ t: p.path, n: p.n, icon: brandIcon(facts.domain, brand) }))
  const byEngine = groupBy(wins.filter((w) => w.engine), (w) => w.engine).map((g) => ({ t: ENGINE_NAMES[g.key], n: g.items.length, icon: engine(g.key) }))
  const share = [{ t: brand, n: facts.youShare, domain: facts.domain }, ...rivals.map((c) => ({ t: c.name, n: c.share, domain: c.domain }))]
    .filter((x) => x.n != null).sort((a, b) => b.n - a.n).map((x) => ({ t: x.t, n: x.n, icon: brandIcon(x.domain, x.t), suf: '%', max: 100 }))
  const gained = history ? (facts.gained || []).map((t) => ({ t, n: 1, sign: 'up', pre: '+' })) : []
  const lost = history ? (facts.lost || []).map((t) => ({ t, n: 1, sign: 'dn', pre: '−' })) : []

  // the Prompts tab has no value column: "weeks they won" needs missedRows[].streak (proposals, a)
  const row2 = [
    panel('topics', [tab('topics', 'Topics', 'Prompts they win', topicRows), tab('prompts', 'Prompts', null, promptRows)]),
    panel('pages', [tab('theirs', 'Their pages', 'Answers citing', theirs), tab('yours', 'Your pages', 'Answers citing', yours)]),
  ].filter(Boolean)
  const row3 = [
    panel('engines', [tab('engines', 'Engines', 'Prompts they win', byEngine)], true),
    panel('brands', [tab('brands', 'Share of answers', 'Share', share)], true),
    panel('change', [tab('gained', 'Gained', 'This week', gained), tab('lost', 'Lost', 'This week', lost)]),
  ].filter(Boolean)

  // the next steps: one per topic they win, the prompts it could win; the pages AI cites for them (and you) say why
  const steps = topics.length ? {
    title: 'Close the gap', col: 'Prompts it could win', total: wins.length,
    rows: topics.slice(0, 3).map((g) => {
      const why = r.why?.find((w) => w.theme === g.key)
      const yourPage = why?.you
      return {
        t: yourPage ? `Add ${lower(g.key)} answers to ${yourPage.path}` : `Write a ${lower(g.key)} page`,
        n: g.items.length,
        why: why?.them ? `${R}’s ${why.them.path} is cited in ${plural(why.them.n, 'answer')}. ${yourPage ? `Yours, ${yourPage.path}, in ${yourPage.n}.` : 'You have no page for this.'}`
          : `${R} is named on ${plural(g.items.length, 'of these prompts', 'of these prompts')} and you aren’t.`,
        prompts: g.items.map((w) => w.prompt),
      }
    }),
  } : null

  const top2 = topics.slice(0, 2).map((g) => lower(g.key))
  const mostly = top2.length ? `, mostly ${top2.join(' and ')}` : ''
  const answer = wins.length
    ? (h ? `${R} wins ${wins.length} of your ${N} prompts${mostly}.` : `${R} is named on ${wins.length} of your ${N} prompts where you aren’t${mostly}.`)
    : `${R} isn’t named on any prompt without you.`
  return { question: `Where is ${R} beating us?`, answer, kpis, defaultKpi: kpis.find((k) => k.series)?.id ?? kpis[0].id, row2, row3, steps, notInData: proposed ? [] : notInDataFor('rival') }
}

const tab = (key, label, col, rows) => ({ key, label, col, rows })
// a panel keeps the tabs that have rows; with none it's dropped
function panel(id, tabs, solo = false) {
  const kept = tabs.filter((t) => t.rows.length)
  return kept.length ? { id, tabs: kept, solo: solo || kept.length === 1 } : null
}
const notInDataFor = () => []
