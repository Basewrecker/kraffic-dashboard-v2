// Site Audit's "What changed": the AI readiness score (the page's main number) from the runs the page loads: the
// latest run, the run before it (each check's status then and its page list) and the earlier runs' scores (the
// score history the Overview's "since" band draws). Check-level changes go back to the run before only; an older
// compared run (90 days) shows its score and, for the checks, the run before with a note.
// One config per ?mock= state (auditChanges(key)), so the button's memo stays stable.
import { siteAudit } from '../data/mock.js'
import { CATEGORIES, STATUS, getAudit } from '../data/audit.js'
import { CHECK_POINTS, STATUS_FACTOR } from '../data/auditReference.js'
import { B, DAY, DAYS, baseIndex, delta, fmtDay, fmtWeekday, heroOf, noiseCount, noisePts, plural, preview } from './util.js'

const WORD = { fail: 'failing', warn: 'needs work', pass: 'passing' }
const ptsOf = (id, status) => (CHECK_POINTS[id] ?? 0) * STATUS_FACTOR[status]

function runs(raw, a) {
  if (!raw.previous) return [{ iso: raw.lastFinished.finishedAt, t: Date.parse(raw.lastFinished.finishedAt), value: a.score }]
  const list = [
    { iso: raw.lastFinished.finishedAt, value: a.score },
    { iso: raw.previous.sync.finishedAt, value: a.since.scoreFrom, detail: true },
    ...[...(raw.previous.history ?? [])].reverse().map((h) => ({ iso: h.finishedAt, value: h.score })),
  ].map((r) => ({ ...r, t: Date.parse(r.iso) }))
  return preview() === 'one' ? list.slice(0, 1) : list
}

function build(key, period) {
  const a = getAudit(key)
  const raw = siteAudit[a.key]
  if (a.never) return { state: 'one', footer: ['No audit yet'], latestIso: null, trigger: { delta: null }, oneText: 'No audit yet. Changes show after the second run.' }
  const rs = runs(raw, a)
  const now = rs[0]
  const footer = [plural(a.run.pages, 'page'), `last run ${fmtWeekday(now.iso)}`]
  if (rs.length < 2 || !a.since) return { state: 'one', footer, latestIso: now.iso, trigger: { delta: null }, oneText: 'Only one audit so far. Changes show after the next run.' }
  const bi = baseIndex(rs, period)
  const then = rs[bi]
  // the history doesn't reach that far back yet: say so rather than repeat a shorter comparison
  if (period !== 'scan' && now.t - then.t < (DAYS[period] * DAY) / 2) {
    return { state: 'one', footer, latestIso: now.iso, trigger: { delta: null }, oneText: `Audits go back to ${fmtDay(rs.at(-1).iso)}, not ${DAYS[period]} days yet. Compare with the last run instead.` }
  }
  const since = fmtDay(then.iso)
  const score = now.value, scoreD = score - then.value
  const flat = noisePts(scoreD)
  const prev = raw.previous
  const was = (c) => prev.checkStatus[c.id] ?? c.status
  const notes = then.detail ? [] : [`Check and page detail from ${fmtDay(prev.sync.finishedAt)}, the oldest run with it`]

  // ---- at a glance: the score, checks failing / passing, pages crawled
  const failing = a.checks.filter((c) => c.status === 'fail').length, failingThen = a.checks.filter((c) => was(c) === 'fail').length
  const passing = a.checks.filter((c) => c.status === 'pass').length, passingThen = a.checks.filter((c) => was(c) === 'pass').length
  const pagesThen = prev.paths.length
  const neutral = (x) => (x ? { ...x, good: null } : x)
  const glance = [
    { label: 'Score', value: `${score}`, delta: delta(scoreD, { unit: ' pts', noise: flat }) },
    { label: 'Failing', value: `${failing}`, delta: delta(failing - failingThen, { higherIsBetter: false }) },
    { label: 'Passing', value: `${passing}`, delta: delta(passing - passingThen) },
    { label: 'Pages', value: `${a.run.pages}`, delta: neutral(delta(a.run.pages - pagesThen, { noise: noiseCount(a.run.pages - pagesThen, pagesThen) })) },
  ]

  // ---- by category: checks passing of all, change in passing checks
  const categories = Object.entries(CATEGORIES).map(([id, name]) => {
    const list = a.checks.filter((c) => c.category === id)
    const v = list.filter((c) => c.status === 'pass').length, p = list.filter((c) => was(c) === 'pass').length
    return { id, mark: { status: v === list.length ? 'good' : list.some((c) => c.status === 'fail') ? 'bad' : 'neutral' }, name, value: v, valueText: `${v}/${list.length}`, share: list.length ? v / list.length : 0, d: v - p, delta: delta(v - p) }
  }).filter((r) => r.share > 0 || r.d).sort((x, y) => Math.abs(y.d) - Math.abs(x.d) || x.share - y.share)

  // ---- checks whose status moved, by the points it moved the score
  const moved = a.checks.filter((c) => was(c) !== c.status).map((c) => ({ c, pts: ptsOf(c.id, c.status) - ptsOf(c.id, was(c)) }))
    .sort((x, y) => Math.abs(y.pts) - Math.abs(x.pts))
  // the checks' detail is from the run before: only name a cause when that's the compared run
  const driver = flat || !then.detail ? null : moved.find((m) => Math.sign(m.pts) === Math.sign(scoreD))
  const headline = flat
    ? [B(`AI readiness held at ${score}`), `, within 2 pts of ${since}.`]
    : [B(`AI readiness ${scoreD > 0 ? 'rose' : 'fell'} ${plural(Math.abs(scoreD), 'pt')} to ${score}`),
      ...(driver ? [', mostly from ', B(driver.c.label), ' now ', B(WORD[driver.c.status]), '.'] : [` since ${since}.`])]
  const checkRows = moved.filter((m) => m !== driver).slice(0, 5).map(({ c, pts }) => ({
    id: `check-${c.id}`, mark: { status: c.status === 'pass' ? 'good' : c.status === 'fail' ? 'bad' : 'neutral' }, open: { drawer: ['check', c.id] },
    text: [B(c.label), ` went from ${WORD[was(c)]} to `, B(WORD[c.status])],
    delta: pts ? delta(Math.round(pts * 10) / 10, { unit: ' pts' }) : { text: STATUS[c.status].label, good: c.status === 'pass' ? true : c.status === 'fail' ? false : null },
  }))

  // ---- pages new in the crawl, or no longer found (a new page isn't good or bad in itself)
  const pageRows = [
    ...a.since.added.map((p) => ({ id: `added-${p}`, mark: { status: 'neutral' }, open: { drawer: ['page', p] }, text: [B(p), ' is new in the crawl'], delta: { text: 'New', good: null } })),
    ...a.since.removed.map((p) => ({ id: `removed-${p}`, mark: { status: 'neutral' }, text: [B(p), ' wasn’t found this run'], delta: { text: 'Gone', good: null } })),
  ]

  // ---- worth doing next: a check that started failing → its fix (the Check drawer)
  const next = [...a.since.newlyFailing].sort((x, y) => y.points - x.points).slice(0, 2).map((c) => ({
    id: `fix-${c.id}`, mark: { status: 'bad' }, action: 'See the fix', open: { drawer: ['check', c.id] },
    text: [B(c.label), ` started failing${c.pageBased && c.pages.length ? ` on ${plural(c.pages.length, 'page')}` : ''}`],
  }))

  return {
    state: 'changed', since, flat,
    headline, glance,
    hero: heroOf(rs, bi, period, (n, g) => `AI readiness score, ${period === 'scan' ? `last ${n} runs` : `the last ${DAYS[period]} days`}.${g ? ` Grey: the ${g} runs before.` : ''}`),
    breakdown: { title: 'Checks passing, by category', rows: categories },
    lists: [
      { id: 'checks', title: 'Checks that changed', count: moved.length - (driver ? 1 : 0), rows: checkRows },
      { id: 'pages', title: 'Pages crawled', count: pageRows.length, rows: pageRows.slice(0, 4) },
    ],
    next, footer: [...footer, ...notes],
    latestIso: now.iso,
    trigger: { delta: flat ? null : { text: `${Math.abs(scoreD)} pts`, up: scoreD > 0, good: scoreD > 0 }, flatText: `No change since ${since}` },
  }
}

const cache = {}
export const auditChanges = (key = 'full') => (cache[key] ??= { page: 'audit', title: 'Site Audit', build: (period) => build(key, period) })
