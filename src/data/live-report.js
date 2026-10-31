// A report written only from one client's loaded scans (lib/report-facts.ts), in the mock's standard frame (frame.jsx,
// mock 1382ac7): header · KPI strip · two visuals · a slim table · the pages AI cites. Counts come from those scans. A
// question they can't answer is refused. Every part of the frame follows one rule: real data → drawn; only the latest
// scan → the latest-scan version with no change, no sparkline, no trend line; no data → left out and named in the
// table's footer. The KPI strip and the table always render; with no chart on one side the other takes the row.
// Nothing here estimates a missing week, engine, competitor, topic or page.
import { ENGINE_NAMES, inferOpts, savedReports, schedules, shares, titleFor } from './reports'

const GENERIC = new Set(['our', 'ours', 'us', 'we', 'the', 'a', 'an', 'my', 'this', 'that', 'ai', 'search', 'share', 'voice', 'visibility', 'prompt', 'prompts', 'score', 'week', 'month', 'client', 'team', 'ceo', 'report'])

const stem = (value) => String(value || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('.')[0]

function knownNames(facts) {
  const names = new Set()
  const add = (value) => {
    const text = String(value || '').toLowerCase().trim()
    if (text.length >= 3) names.add(text)
    const host = stem(text)
    if (host.length >= 4) names.add(host)
  }
  add(facts.name)
  add(facts.domain)
  for (const c of facts.competitors || []) {
    add(c.name)
    add(c.domain)
    add(c.key)
  }
  return names
}

// A named rival in the question that this account does not track.
function unknownRival(question, facts) {
  const match = String(question || '').match(/\b(?:vs\.?|versus|against|where is|ahead of|beating)\s+([A-Za-z0-9][A-Za-z0-9.'’ -]{1,48})/i)
  if (!match) return null
  const who = match[1].replace(/\b(beating us|this week|last|search|us|our|the)\b/ig, ' ').replace(/[?.].*$/, '').replace(/\s+/g, ' ').trim()
  if (!who || who.length < 3) return null
  if (who.toLowerCase().split(' ').every((word) => GENERIC.has(word))) return null
  const names = knownNames(facts)
  const folded = who.toLowerCase()
  if ([...names].some((name) => folded.includes(name) || name.includes(folded))) return null
  return who
}

const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// The syncs inside the report's period, ending at the latest: this week → the latest sync and the one before it; 30 days
// or a quarter → every sync within that many days of the latest (a day's slack for a sync that ran late). A shorter
// stored history stays as it is. The first of these is the report's start: every change in the report is against it.
const WINDOW = { week: 7, '30d': 30, quarter: 90 }
const DAY = 86400000
export function pointsIn(all, period) {
  const latest = all.at(-1)
  const days = WINDOW[period]
  if (!latest?.iso || !days) return all
  const end = Date.parse(latest.iso)
  const kept = all.filter((p) => p.iso && end - Date.parse(p.iso) <= (days + 1) * DAY)
  return kept.length >= 2 ? kept : all.slice(-2)
}

function spanOf(points) {
  if (!points.length) return 'the latest scan'
  const a = points[0].date
  const b = points.at(-1).date
  if (a === b) return a
  const [ma, da] = a.split(' ')
  const [mb, db] = b.split(' ')
  return ma === mb ? `${ma} ${da}–${db}` : `${a} – ${b}`
}

// a 10×10 grid: the parts scaled to 100 cells by largest remainder (the mock's rule, reports.js)
const gridCells = (parts) => { const n = shares(parts.map((p) => p.n)); return parts.map((p, i) => ({ ...p, cells: n[i], share: n[i] })) }
// 'week' when this brand already has a schedule of this kind, else 'once' (the frame's Frequency menu)
const scheduledKind = (brandId, kind) => (schedules.some((sc) => sc.brand === brandId && savedReports.find((r) => r.id === sc.reportId)?.opts?.kind === kind) ? 'week' : 'once')
const PROMPT_HREF = '/tracker'
const promptRow = (text, extra = {}) => ({ id: text, text, href: PROMPT_HREF, ...extra })
const KIND_QUESTION = { weekly: 'What moved this week?', ceo: 'Are we winning in AI search?', rival: 'Where is a competitor beating us?', content: 'Which prompts are we missing?' }

export function buildLiveReport(facts, prompt = '', rawOpts = {}) {
  const inf = inferOpts(prompt, null)
  const pick = (key, fallback) => (rawOpts[key] != null && rawOpts[key] !== '' && (!Array.isArray(rawOpts[key]) || rawOpts[key].length) ? rawOpts[key] : inf[key] ?? fallback)
  const asked = String(prompt || '').trim()
  const opts = {
    brand: facts.brandId,
    period: pick('period', 'week'),
    engines: pick('engines', []),
    compare: pick('compare', []),
    audience: pick('audience', 'team'),
    length: pick('length', 'one'),
    // the kind: the one chosen, else the one the question asks for (inferOpts, the mock's rules), else the audience's;
    // a question that asks for none of them is answered as a custom report (the weekly frame, headed by the question)
    kind: pick('kind', null) ?? (pick('audience', 'team') === 'ceo' ? 'ceo' : asked ? 'custom' : 'weekly'),
  }
  const brand = facts.name || 'This brand'
  if (!facts.scans || !facts.prompts) {
    return { ok: false, reason: 'thin', brand, syncs: facts.scans || 0, nextSync: null, opts }
  }
  const stranger = unknownRival(prompt, facts)
  if (stranger) {
    return { ok: false, reason: 'outside', note: `There’s no scan data for “${stranger}” on ${brand}. This report can only use ${brand}’s tracked prompts, its saved competitors and the engines that ran.`, opts }
  }
  const rivals = facts.competitors || []
  const picked = (opts.compare || []).map((key) => rivals.find((c) => c.key === key)).filter(Boolean)
  if ((opts.compare || []).length && picked.length !== opts.compare.length) {
    return { ok: false, reason: 'outside', note: `That competitor isn’t tracked for ${brand}, so a report on them can’t be written.`, opts }
  }
  if (opts.kind === 'ceo' && !rivals.length) {
    return { ok: false, reason: 'outside', note: `No competitors are saved for ${brand}, so a share-of-voice comparison can’t be written. Ask what moved in ${brand}’s own prompts.`, opts }
  }
  if (opts.kind === 'rival' && !picked.length && !rivals.length) {
    return { ok: false, reason: 'outside', note: `No competitors are saved for ${brand}, so a head-to-head can’t be written.`, opts }
  }

  const engineIds = opts.engines.length ? opts.engines : facts.ran
  const ran = engineIds.filter((id) => facts.ran.includes(id))
  const off = engineIds.filter((id) => !facts.ran.includes(id)).map((id) => ENGINE_NAMES[id] || id)
  if (opts.engines.length && !ran.length) {
    return { ok: false, reason: 'outside', note: `${list(off)} didn’t run for ${brand}, so that report can’t be written from this account’s scans.`, opts }
  }

  const points = pointsIn(facts.points || [], opts.period)
  const history = points.length >= 2 // more than the latest scan: changes, sparklines and the line are real
  const start = points[0]
  const latest = points.at(-1)
  const span = spanOf(points)
  const since = facts.since || start?.date || 'the previous scan'
  const client = opts.audience === 'client'
  const gained = facts.gained || []
  const lost = facts.lost || []
  const compared = !!facts.compared
  // the numbers the report shows are the latest sync's point (the end of its line), else the account's latest
  const score = latest?.score ?? facts.score ?? null
  const visible = latest?.visible ?? facts.visible ?? 0
  const missed = Math.max(0, facts.prompts - visible)
  const net = gained.length - lost.length
  // one change for the whole report: the latest sync against the report's start (the first sync in its period)
  const scoreDelta = history && score != null && start.score != null ? score - start.score : null
  const promptsDelta = history && start.visible != null ? visible - start.visible : null
  const sinceStart = history ? start.date : null
  const scoreSpark = history ? points.map((p) => p.score) : undefined
  const visibleSpark = history && points.every((p) => p.visible != null) ? points.map((p) => p.visible) : undefined
  const engines = (facts.engines || []).filter((e) => ran.includes(e.id))
  const cited = (facts.cited || []).filter((page) => page.path && page.n > 0)
  const citedAnswers = cited.reduce((a, c) => a + c.n, 0)
  const missedRows = facts.missedRows || []
  const nameOf = (domain) => rivals.find((c) => c.domain === domain)?.name || domain
  const you = score ?? facts.youShare
  const ranked = [...rivals].filter((c) => c.share != null).sort((a, b) => b.share - a.share)
  const top = ranked[0]
  const ahead = top ? you > top.share : null

  // ---- the parts every kind shares ---------------------------------------------------------------------------------
  const scoreKpi = { label: 'Visibility score', value: score ?? 0, delta: scoreDelta, since: sinceStart, spark: scoreSpark }
  const namedKpi = { label: client ? 'Prompts you’re named on' : 'Prompts named', value: visible, of: facts.prompts, delta: promptsDelta, since: sinceStart, spark: visibleSpark }
  const citedKpi = { label: client ? 'Your pages cited' : 'Pages cited', value: cited.length, sub: cited.length ? `${plural(citedAnswers, 'answer')} link to them` : 'none in the latest scan' }
  const movedKpis = compared
    ? [{ label: 'Newly named', value: gained.length, sub: `since ${since}` }, { label: 'No longer named', value: lost.length, bad: lost.length > 0, sub: `since ${since}` }]
    : []
  // the score at each sync in the period: the line (two syncs or more), else nothing (no trend line from one point)
  const scoreLine = history
    ? { kind: 'lines', label: 'Visibility score by sync', unit: '', max: 100, dates: points.map((p) => p.date), legend: [{ key: 'you', label: brand, tone: 'primary' }], series: [{ key: 'you', label: brand, tone: 'primary', width: 2.5, values: points.map((p) => p.score) }] }
    : null
  // prompts the brand is named on per engine, latest scan (no competitor per engine: no head-to-head columns)
  const engineColumns = engines.length
    ? { kind: 'columns', label: 'Prompts named per engine', unit: 'prompts', legend: [{ key: 'you', label: brand, tone: 'primary' }], bands: engines.map((e) => ({ label: e.name, bars: [{ key: 'you', label: brand, value: e.visible ?? 0, tone: 'primary' }] })) }
    : null
  // the square grid: every tracked prompt once, named or not, latest scan
  const namedGrid = { kind: 'grid', label: 'Tracked prompts, latest scan', unit: 'prompts', cells: gridCells([{ key: 'named', label: 'Named', n: visible, tone: 'primary' }, { key: 'missed', label: 'Not named', n: missed, tone: 'neutral' }]) }
  const sharesList = ranked.length ? { label: 'Share of voice, latest scan', rows: ranked.slice(0, 5).map((c) => ({ key: c.key, domain: c.domain, name: c.name, n: Math.round((c.share / 100) * facts.prompts) })) } : null
  const missedTable = {
    title: client ? 'Prompts you’re not named on' : 'Prompts not named, latest scan', searchLabel: 'Search prompts', unit: 'prompts',
    columns: [{ key: 'text', label: 'Prompt', kind: 'text' }, { key: 'instead', label: 'Named instead', kind: 'muted' }],
    rows: missedRows.map((row) => promptRow(row.prompt, { instead: (row.competitors || []).map(nameOf).join(', ') })),
    filters: [], pageSize: 10,
  }
  const pages = cited.length ? { label: 'Pages AI cites most', rows: cited.slice(0, 8).map((c) => ({ path: c.path, type: '', n: c.n })) } : null
  // what the scans don't hold, named once in the table's footer (frame.jsx prints "Not in your data: …")
  const left = []
  if (!history) left.push('score history (one sync is stored, so no change, sparkline or trend line is drawn)')
  left.push('per-topic trend', 'engine head-to-head')

  let verdict = 'Mixed'
  let finding
  let frame
  const head = (question, parts) => ({ question, read: null, range: span, frequency: scheduledKind(facts.brandId, opts.kind), you: brand, notInData: [left.join(', ')], ...parts })

  if (opts.kind === 'ceo') {
    if (you == null || !top) {
      return { ok: false, reason: 'outside', note: `Share of voice isn’t stored for ${brand}’s competitors, so that comparison can’t be written.`, opts }
    }
    verdict = ahead ? 'Winning' : 'Losing'
    finding = ahead
      ? `Yes. ${brand} is named in ${you}% of AI answers in the latest scan, ${top.name} in ${top.share}%.`
      : `Not yet. ${top.name} is named in ${top.share}% of AI answers in the latest scan, ${brand} in ${you}%.`
    const aheadOfYou = ranked.filter((c) => c.share > you).length
    frame = head(asked || KIND_QUESTION.ceo, {
      finding,
      kpis: [
        { label: 'Share of voice', value: you, unit: '%', delta: scoreDelta, since: sinceStart, spark: scoreSpark },
        { label: `${top.name}`, value: top.share, unit: '%', sub: 'latest scan' },
        { label: 'Competitors ahead', value: aheadOfYou, of: ranked.length, segments: { n: aheadOfYou, of: ranked.length, tone: 'rival' } },
        namedKpi,
        citedKpi,
      ],
      left: scoreLine,
      right: {
        kind: 'grid', label: 'Share of voice, latest scan', unit: '%', ranked: true,
        cells: gridCells([{ key: 'you', label: brand, n: you, tone: 'primary', domain: facts.domain, delta: scoreDelta }, ...ranked.slice(0, 5).map((c, i) => ({ key: c.key, label: c.name, n: c.share, tone: i === 0 ? 'rival' : 'tint', domain: c.domain }))]),
      },
      table: {
        title: 'Competitors, latest scan', searchLabel: 'Search competitors', unit: 'competitors',
        columns: [{ key: 'text', label: 'Brand', kind: 'text' }, { key: 'share', label: 'Share of voice', kind: 'num' }, { key: 'gap', label: `vs ${brand}`, kind: 'change', unit: 'pts' }],
        rows: ranked.map((c) => ({ id: c.key, text: c.name, share: c.share, gap: c.share - you, href: PROMPT_HREF })),
        filters: [], pageSize: 10,
      },
      pages,
    })
  } else if (opts.kind === 'rival') {
    const rival = picked[0] || top || rivals[0]
    const rows = missedRows.filter((row) => (row.competitors || []).includes(rival.domain))
    verdict = rows.length ? 'Losing' : 'Winning'
    finding = rows.length
      ? `${rival.name} is named on ${plural(rows.length, 'prompt')} where ${brand} is missing in the latest scan.`
      : `${rival.name} isn’t named on the prompts where ${brand} is missing in the latest scan.`
    const neither = Math.max(0, missed - rows.length)
    frame = head(asked || `Where is ${rival.name} beating us?`, {
      finding,
      kpis: [
        { label: `Prompts ${rival.name} wins`, value: rows.length, of: facts.prompts, bad: rows.length > 0, sub: 'you’re missing, they’re named' },
        namedKpi,
        ...(rival.share != null ? [{ label: `${rival.name}’s share of voice`, value: rival.share, unit: '%', sub: 'latest scan' }] : []),
        ...(you != null ? [{ label: `${brand}’s share of voice`, value: you, unit: '%', delta: scoreDelta, since: sinceStart, spark: scoreSpark }] : []),
        citedKpi,
      ],
      left: engineColumns,
      right: {
        kind: 'grid', label: 'Head to head, latest scan', unit: 'prompts',
        cells: gridCells([{ key: 'you', label: `${brand} named`, n: visible, tone: 'primary' }, { key: 'them', label: `${rival.name} named, ${brand} missing`, n: rows.length, tone: 'rival' }, { key: 'neither', label: 'Neither', n: neither, tone: 'neutral' }]),
      },
      table: {
        title: `Prompts ${rival.name} wins`, searchLabel: 'Search prompts', unit: 'prompts',
        columns: [{ key: 'text', label: 'Prompt', kind: 'text' }, { key: 'instead', label: 'Named', kind: 'muted' }],
        rows: rows.map((row) => promptRow(row.prompt, { instead: (row.competitors || []).map(nameOf).join(', ') })),
        filters: [], pageSize: 10,
      },
      pages,
    })
  } else if (opts.kind === 'content') {
    if (!missedRows.length) {
      return { ok: false, reason: 'outside', note: `${brand} isn’t missing on any prompt in the latest scan, so there isn’t a content list to write.`, opts }
    }
    verdict = 'Opportunity'
    finding = `${plural(missedRows.length, 'tracked prompt doesn’t', 'tracked prompts don’t')} name ${brand} in the latest scan.`
    const named = new Map()
    for (const row of missedRows) for (const domain of row.competitors || []) named.set(domain, (named.get(domain) || 0) + 1)
    const owners = [...named].sort((a, b) => b[1] - a[1])
    frame = head(asked || KIND_QUESTION.content, {
      finding,
      kpis: [
        { label: 'Prompts missing', value: missedRows.length, of: facts.prompts, bad: missedRows.length > 0 },
        { label: 'A competitor named instead', value: missedRows.filter((row) => row.competitors?.length).length, of: missedRows.length },
        { label: 'Nobody named', value: missedRows.filter((row) => !row.competitors?.length).length, of: missedRows.length },
        namedKpi,
        citedKpi,
      ],
      left: engineColumns,
      right: { ...namedGrid, list: owners.length ? { label: 'Named instead, prompts', rows: owners.slice(0, 5).map(([domain, n]) => ({ key: domain, domain, name: nameOf(domain), n })) } : undefined },
      table: { ...missedTable, title: 'Prompts to write for' },
      pages,
    })
  } else {
    // weekly (and the client update, and a custom question): what moved between the two latest comparable scans
    if (compared && (gained.length || lost.length || net === 0)) {
      verdict = net > 0 && lost.length * 2 <= gained.length ? (opts.period === 'week' ? 'Good week' : 'Good month') : net >= 0 ? 'Mixed' : (opts.period === 'week' ? 'Tough week' : 'Tough month')
      const ago = facts.since || 'the previous scan'
      finding = net > 0
        ? `${client ? 'You’re in' : `${brand} is in`} ${plural(net, 'more AI answer')} than ${ago}.`
        : net < 0
          ? `${client ? 'You’re in' : `${brand} is in`} ${plural(-net, 'fewer AI answer')} than ${ago}.`
          : `${client ? 'You’re in' : `${brand} is in`} as many AI answers as ${ago}.`
    } else {
      finding = `${brand} is named in ${visible} of ${plural(facts.prompts, 'tracked prompt')}${score != null ? `, at a visibility score of ${score}` : ''}.`
    }
    const movedRows = [...gained.map((text) => promptRow(text, { change: 'Newly named', strong: true })), ...lost.map((text) => promptRow(text, { change: 'No longer named' }))]
    const table = compared && movedRows.length
      ? { title: `What moved since ${since}`, searchLabel: 'Search prompts', unit: 'prompts', columns: [{ key: 'text', label: 'Prompt', kind: 'text' }, { key: 'change', label: 'Change', kind: 'strong' }], rows: movedRows, filters: [], pageSize: 10 }
      : missedTable
    const question = opts.kind === 'custom' && asked ? asked : client ? 'Client update' : KIND_QUESTION.weekly
    frame = head(question, {
      finding,
      read: opts.kind === 'custom' ? `How I read your question: ${brand}’s latest scans · ${span} · ${ran.map((id) => ENGINE_NAMES[id] || id).join(', ') || 'stored scans'}` : null,
      kpis: [scoreKpi, namedKpi, ...movedKpis, citedKpi],
      left: scoreLine,
      right: { ...namedGrid, list: sharesList ?? undefined },
      table,
      pages,
    })
  }

  const sources = {
    id: 'sources',
    type: 'sources',
    data: {
      span,
      off,
      period: opts.period,
      syncs: Math.max(points.length, 1),
      from: start?.date || span,
      to: latest?.date || span,
      engines: ran.length ? ran.map((id) => ENGINE_NAMES[id] || id) : ['Stored scans'],
      left: [
        ...off.map((name) => `${name} didn’t run, so it isn’t counted.`),
        ...(!compared ? ['Only one comparable scan is stored, so nothing is shown as gained or lost.'] : []),
        ...(!cited.length ? ['Cited pages aren’t in this scan, so none are listed.'] : []),
        ran.length ? `By engine: ${engines.map((e) => `${e.name} names ${brand} on ${plural(e.visible ?? 0, 'prompt')}`).join(' · ')}.` : 'Per-engine counts aren’t stored for this scan.',
      ],
    },
  }
  return { ok: true, v3: true, kind: opts.kind, verdict, headline: finding, title: titleFor(prompt, opts), opts, frame, blocks: [sources] }
}
