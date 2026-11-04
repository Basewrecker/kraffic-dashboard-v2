// Run with: npm test. The Sentiment page's sections (utils/sentimentSections.js, the app's lib/sentiment-sections.js):
// the Pages on <date> filters and change marks, Compare and its CSV, Sources in two columns, the lead quote and "Also
// said on", New pages, the score change beside the score and the line under it, the Nov 2 scoring change, a past sync's
// pages, and Score's docked card.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PAGES, RUNS, countTones, freshPageIds, runPages, scoreOf, sourceCloud, tonePercents, unscoredNote } from '../data/sentiment.js'
import { matchIds, pageHref } from './spectrum.js'
import {
  CSV_COLUMNS, SCORING_UPDATED, SCORING_UPDATED_TIP, SYNC_CSV_COLUMNS, alsoSaidOnSites, changedCount, compareEntries, compareList, compareMarks, compareCsv, compareFilename, compareRows, enginesIn,
  evenColumns, filterSyncPages, heroTone, newCountsBySync, newPageIds, rowChange, scoreCardDocked, scoreChange, scoreChangeLine, scoringChangedAt, sortAllPages, sourceColumns, sourceLead, syncColumns,
  syncCsv, syncFilename, syncMarks, syncScoreChange, tipLeft, toneById, turnedNegative,
} from './sentimentSections.js'

const pg = (id, tone, engines = ['google'], extra = {}) => ({ id, url: `https://${id}/a`, domain: id, title: `Title ${id}`, engines, tone, sentences: [], ...extra })
const oct28 = [pg('a.com', 'positive'), pg('b.com', 'neutral', ['chatgpt']), pg('c.com', 'neutral', ['google', 'claude'])]
const oct31 = [pg('a.com', 'neutral'), pg('c.com', 'negative', ['google', 'claude']), pg('d.com', 'neutral', ['chatgpt'])]

test('row change: "new" only on the first sync a page appears (Harsh’s rule); else the tone it had before; else nothing', () => {
  const fresh = freshPageIds([{ pages: oct28 }, { pages: oct31 }], 1)
  const prevTones = toneById(oct28)
  assert.deepEqual(rowChange(oct31[2], { fresh, prevTones }), { kind: 'new' })
  assert.deepEqual(rowChange(oct31[0], { fresh, prevTones }), { kind: 'was', tone: 'positive', label: 'was Positive', dir: 'down' }, 'positive → neutral got worse')
  assert.equal(rowChange(oct31[1], { fresh, prevTones }).dir, 'down', 'neutral → negative got worse')
  assert.equal(rowChange(pg('b.com', 'positive'), { fresh, prevTones }).dir, 'up', 'neutral → positive got better')
  assert.equal(rowChange(pg('c.com', 'neutral'), { fresh, prevTones }), null)
})

test('turned negative: negative now, cited before with another tone (a new negative page is not "turned")', () => {
  assert.deepEqual(turnedNegative([...oct31, pg('e.com', 'negative')], oct28).map((p) => p.id), ['c.com'])
})

test('Pages on <date> filters combine with AND: tone, engines, new only, domain search', () => {
  const fresh = new Set(['d.com'])
  assert.deepEqual(filterSyncPages(oct31, { tone: 'neutral' }).map((p) => p.id), ['a.com', 'd.com'])
  assert.deepEqual(filterSyncPages(oct31, { tone: 'neutral', engines: ['chatgpt'] }).map((p) => p.id), ['d.com'])
  assert.deepEqual(filterSyncPages(oct31, { newOnly: true, fresh }).map((p) => p.id), ['d.com'])
  assert.deepEqual(filterSyncPages(oct31, { q: 'C.CO' }).map((p) => p.id), ['c.com'])
  assert.deepEqual(filterSyncPages(oct31, { tone: 'negative', q: 'a.com' }), [])
  assert.deepEqual(enginesIn(oct31), ['google', 'chatgpt', 'claude'])
  assert.deepEqual(enginesIn([pg('x', 'neutral', ['chatgpt'])]), ['chatgpt'], 'only the engines that ran')
})

test('compare: new, dropped, tone changed, same; only changed; the engine filter', () => {
  const rows = compareRows(oct28, oct31)
  const by = Object.fromEntries(rows.map((r) => [r.domain, r]))
  assert.equal(by['a.com'].change, 'tone changed')
  assert.equal(by['a.com'].tone_from, 'positive')
  assert.equal(by['a.com'].tone_to, 'neutral')
  assert.equal(by['b.com'].change, 'dropped')
  assert.equal(by['b.com'].tone_to, '')
  assert.equal(by['d.com'].change, 'new')
  assert.equal(by['d.com'].tone_from, '')
  assert.equal(by['c.com'].engines, 'google;claude')
  assert.deepEqual(compareRows(oct28, [...oct28]).map((r) => r.change), ['same', 'same', 'same'])
  assert.equal(compareRows(oct28, oct28, { onlyChanged: true }).length, 0)
  assert.deepEqual(compareRows(oct28, oct31, { engines: ['chatgpt'] }).map((r) => `${r.domain} ${r.change}`), ['d.com new', 'b.com dropped'])
})

test('compare CSV: the columns in order, the brand on every row, quotes and commas escaped; the file name', () => {
  const rows = compareRows([pg('a.com', 'positive', ['google'], { title: 'Say "hi", ok' })], [])
  const csv = compareCsv(rows, 'Finance of America')
  const [head, line] = csv.trim().split('\n')
  assert.equal(head, 'url,title,domain,engines,tone_from,tone_to,change,brand')
  assert.deepEqual(CSV_COLUMNS, head.split(','))
  assert.equal(line, 'https://a.com/a,"Say ""hi"", ok",a.com,AI Overview,positive,,dropped,Finance of America', 'engines by name: AI Overview, not Google search')
  assert.equal(compareFilename('Finance of America', '2026-10-28', '2026-10-31'), 'sentiment-finance-of-america-2026-10-28-vs-2026-10-31.csv')
})

test('Sources in two columns from Harsh’s cloud: each sorted by its own count, an even site in both, neutral-only left out', () => {
  const cols = [
    { date: '2026-10-28', pages: [pg('neg.com', 'negative', ['chatgpt']), pg('pos.com', 'positive'), pg('even.com', 'positive'), pg('flat.com', 'neutral')] },
    { date: '2026-10-31', pages: [pg('neg.com', 'negative', ['google']), pg('pos.com', 'positive'), pg('pos2.com', 'positive'), pg('even.com', 'negative')] },
  ]
  const { negative, positive } = sourceColumns(sourceCloud(cols))
  assert.deepEqual(negative.map((s) => `${s.domain} ${s.count} ${s.syncs}/2`), ['neg.com 2 2/2', 'even.com 1 1/2'])
  assert.deepEqual(positive.map((s) => `${s.domain} ${s.count} ${s.syncs}/2`), ['pos.com 2 2/2', 'even.com 1 1/2', 'pos2.com 1 1/2'])
  assert.equal(negative[0].last.date, '2026-10-31', 'the newest page in that tone (the stat lead opens it)')
  assert.deepEqual(negative[0].engines, ['google', 'chatgpt'], 'the engines that cited the site, in the scan’s order')
  assert.ok(![...negative, ...positive].some((s) => s.domain === 'flat.com'), 'a neutral-only site stays out')
})

test('lead quote: the top site’s snippet; no quote → none (never a placeholder)', () => {
  const latest = [pg('neg.com', 'negative', ['google'], { sentences: [{ text: 'The pump broke within a week.', tone: 'negative', mark: null }] }), pg('pos.com', 'positive')]
  const lead = sourceLead({ domain: 'neg.com' }, latest)
  assert.equal(lead.quote.text, 'The pump broke within a week.')
  assert.equal(lead.quote.mark, null, 'no tone phrase stored, so nothing to underline')
  assert.equal(sourceLead({ domain: 'pos.com' }, latest), null)
  assert.equal(sourceLead({ domain: 'old.com' }, latest), null, 'a site only in older syncs has no quote')
  assert.equal(sourceLead(null, latest), null)
})

test('also said on: other sites sharing a theme with the page; hidden when the page isn’t in the latest analysis', () => {
  const latest = [pg('a.com', 'negative'), pg('b.com', 'negative'), pg('c.com', 'neutral'), pg('a.com-2', 'neutral', ['google'], { domain: 'a.com' })]
  const swot = { threats: [{ theme: 'Pump breaks', sources: ['a.com', 'b.com', 'a.com-2'] }], strengths: [{ theme: 'Gentle', sources: ['a.com', 'c.com'] }], weaknesses: [], opportunities: [] }
  assert.deepEqual(alsoSaidOnSites(latest[0], swot, latest).map((p) => p.domain), ['b.com', 'c.com'], 'other sites only, once each')
  assert.deepEqual(alsoSaidOnSites(pg('old.com', 'negative'), swot, latest), [])
  assert.deepEqual(alsoSaidOnSites(latest[0], null, latest), [])
})

test('compare CSV url: the page’s normalised link (no utm_* or fragment), the same one the page opens', () => {
  const tracked = pg('t.com', 'neutral', ['google'], { url: 'https://www.t.com/review?utm_source=chatgpt.com#top' })
  const [row] = compareRows([], [tracked], { hrefOf: pageHref })
  assert.equal(row.url, 'https://www.t.com/review')
})

test('Sources columns even out: more than one row longer → as many rows as the other (at least 3) and "+n more"', () => {
  const L = (n) => Array.from({ length: n }, (_, i) => i)
  const r1 = evenColumns(L(8), L(9))
  assert.deepEqual([r1.a.shown.length, r1.a.more, r1.b.shown.length, r1.b.more], [8, 0, 9, 0], 'one row apart: left as is')
  const r2 = evenColumns(L(4), L(10))
  assert.deepEqual([r2.a.shown.length, r2.a.more, r2.b.shown.length, r2.b.more], [4, 0, 4, 6])
  const r3 = evenColumns(L(0), L(7))
  assert.deepEqual([r3.b.shown.length, r3.b.more], [3, 4], 'an empty column: the other shows 3 and "+4 more"')
})

// ---- New: one rule for the chip, "New only" and the tooltip (a page never cited for the brand in any earlier sync)
// (the app also tests that a URL with www, a trailing slash or utm_* is the same page: that's its adapter's page key)
const at = (date, ids) => ({ date, pages: ids.map((id) => pg(id, 'neutral')) })

test('New: sync1 = A, B; sync2 = A, B, C → only C is New; sync3 = A, C → nothing is New', () => {
  const cols = [at('2026-10-14', ['a.com', 'b.com']), at('2026-10-21', ['a.com', 'b.com', 'c.com']), at('2026-10-28', ['a.com', 'c.com'])]
  assert.deepEqual([...newPageIds(cols, 1)], ['c.com'])
  assert.deepEqual([...newPageIds(cols, 2)], [], 'C came back, A never left: nothing is New')
  assert.deepEqual(newCountsBySync(cols).map((c) => c.new), [0, 1, 0])
})

test('New: the very first sync shows no New chips (every page is first seen there)', () => {
  const cols = [at('2026-10-14', ['a.com', 'b.com'])]
  assert.equal(newPageIds(cols, 0).size, 0)
  assert.equal(freshPageIds(cols, 0).size, 2, 'Harsh’s freshPageIds is unchanged; the page uses newPageIds')
})

test('New: across every engine (cited before on ChatGPT, now on Google: not New)', () => {
  const cols = [{ date: '2026-10-14', pages: [pg('a.com', 'neutral', ['chatgpt'])] }, { date: '2026-10-21', pages: [pg('a.com', 'neutral', ['google'])] }]
  assert.equal(newPageIds(cols, 1).size, 0)
})

test('New only and the chip read the same set', () => {
  const cols = [at('2026-10-14', ['a.com', 'b.com']), at('2026-10-21', ['a.com', 'b.com', 'c.com'])]
  const fresh = newPageIds(cols, 1)
  const chips = cols[1].pages.filter((p) => syncMarks(p, { fresh, prevTones: new Map() }).isNew).map((p) => p.id)
  assert.deepEqual(filterSyncPages(cols[1].pages, { newOnly: true, fresh }).map((p) => p.id), chips)
})

test('row marks: tone, and "from <tone>" only when it changed; unchanged rows stay one line', () => {
  const prevTones = toneById(oct28)
  assert.deepEqual(syncMarks(oct31[1], { fresh: new Set(), prevTones }), { isNew: false, tone: 'negative', from: 'from Neutral', gone: false })
  assert.equal(syncMarks(pg('c.com', 'neutral'), { fresh: new Set(), prevTones }).from, null)
})

test('compare mode: entries, the changed count, marks per change, filters and changed rows first', () => {
  const entries = compareEntries(oct28, oct31)
  assert.equal(changedCount(entries), 4, 'a tone changed, b dropped, c tone changed, d new')
  const by = Object.fromEntries(entries.map((e) => [e.page.domain, e]))
  const m = (d) => compareMarks(by[d], { fresh: new Set(['d.com']), fromLabel: 'Oct 28' })
  assert.deepEqual(m('a.com'), { isNew: false, tone: 'neutral', from: 'from Positive', gone: false })
  assert.deepEqual(m('b.com'), { isNew: false, tone: 'neutral', from: 'from Neutral', gone: true })
  assert.deepEqual(m('d.com'), { isNew: true, tone: 'neutral', from: 'not on Oct 28', gone: false })
  const list = compareList(compareEntries(oct28, [...oct31, pg('b.com', 'neutral', ['chatgpt'])]))
  assert.equal(list.at(-1).entry.change, 'same', 'unchanged rows last')
  assert.deepEqual(compareList(entries, { tone: 'negative' }).map((p) => p.id), ['c.com'])
  assert.deepEqual(compareList(entries, { q: 'b.c' }).map((p) => p.id), ['b.com'], 'a dropped page keeps its old tone and domain')
  assert.equal(changedCount(compareEntries(oct28, oct31, { onlyChanged: true })), 4)
})

test('sync CSV: what the list shows (filters applied), engines by name, the tone at that sync, New (no tone_before)', () => {
  const fresh = new Set(['d.com'])
  const shown = filterSyncPages(oct31, { tone: 'neutral' })
  const csv = syncCsv(shown, { brand: 'FoA', fresh, prevTones: toneById(oct28) }).trim().split('\n')
  assert.deepEqual(csv[0].split(','), SYNC_CSV_COLUMNS)
  assert.equal(csv.length, 3, 'header + the two neutral pages only')
  assert.equal(csv[1], 'https://a.com/a,Title a.com,a.com,AI Overview,neutral,,FoA')
  assert.equal(csv[2], 'https://d.com/a,Title d.com,d.com,ChatGPT,neutral,yes,FoA')
  assert.ok(!csv[0].includes('tone_before') && CSV_COLUMNS.includes('tone_from') && CSV_COLUMNS.includes('tone_to'), 'tone_from / tone_to in the Compare CSV only')
  assert.equal(syncFilename('Finance of America', '2026-10-28'), 'sentiment-finance-of-america-2026-10-28.csv')
})

// All pages' sort pills (2026-11-01: on live the pills seemed to do nothing): each one gives its own order
test('All pages sort: Tone = Negative → Neutral → Positive, then title A–Z (natural)', () => {
    const P = (title, tone, engines = ['google']) => ({ id: title, title, tone, engines })
  const list = [P('Review 10', 'neutral'), P('review 2', 'positive'), P('Review 1', 'negative', ['google', 'chatgpt']), P('Alpha', 'neutral', ['google', 'chatgpt', 'claude']), P('review 3', 'negative')]
  assert.deepEqual(sortAllPages(list, 'tone').map((p) => p.title), ['Review 1', 'review 3', 'Alpha', 'Review 10', 'review 2'])
  assert.deepEqual(sortAllPages(list, 'title').map((p) => p.title), ['Alpha', 'Review 1', 'review 2', 'review 3', 'Review 10'], 'Title: A–Z, 2 before 10, case-insensitive')
  assert.deepEqual(sortAllPages(list, 'engines').map((p) => p.title), ['Alpha', 'Review 1', 'review 2', 'review 3', 'Review 10'], 'Engines: most first, then title')
  assert.notDeepEqual(sortAllPages(list, 'tone').map((p) => p.id), sortAllPages(list, 'title').map((p) => p.id), 'the pills give different orders')
  assert.deepEqual(list.map((p) => p.title)[0], 'Review 10', 'the input is not reordered in place')
})

// the Over time card on the last bars covered the Pages list (2026-11-01): it opens left when it doesn't fit
test('Over time card: right of the bar if it fits in the chart column, else left, never past the column', () => {
    const W = 460, bar = 40
  assert.equal(tipLeft(80, bar, W), 80 + 20 + 12, 'an early bar: to its right')
  const last = tipLeft(420, bar, W)
  assert.equal(last, 420 - 20 - 12 - 240, 'the last bar: to its left')
  assert.ok(last + 240 <= W, 'never crosses the column edge')
  assert.equal(tipLeft(420, bar, W), last, 'the same bar always gets the same side')
  const tight = tipLeft(150, bar, 260)
  assert.ok(tight >= 0 && tight + 240 <= 260, 'neither side fits: kept inside the column')
})

// ---- the score change beside the score and the line under it (one helper, syncScoreChange, for the hero and the tooltip)
const fmtDay = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const TONE_ORDER = ['positive', 'neutral', 'mixed', 'negative', 'unscored']
// a run at `createdAt` with [positive, neutral, mixed, negative, unscored] pages (page k of a tone: the same id in every run)
const runOf = (createdAt, counts) => {
  const pages = counts.flatMap((k, t) => Array.from({ length: k }, (_, i) => pg(`site${t}-${i}.example`, TONE_ORDER[t])))
  return { r: { id: createdAt, createdAt, date: createdAt.slice(0, 10), counts: countTones(pages) }, pages }
}
const load = (list) => {
  const byId = new Map(list.map((x) => [x.r.id, x.pages]))
  return { runs: list.map((x) => x.r), pagesOf: (r) => byId.get(r.id) ?? [] }
}
const colsOf = (list) => { const { runs, pagesOf } = load(list); return syncColumns(runs, pagesOf) }

test('score change: ▲ +n up, ▼ −n down (a real minus), nothing unchanged or with a gap', () => {
  assert.deepEqual(scoreChange(53, 50), { delta: 3, dir: 'up', arrow: '▲', text: '+3' })
  assert.deepEqual(scoreChange(47, 50), { delta: -3, dir: 'down', arrow: '▼', text: '−3' })
  assert.equal(scoreChange(50, 50), null)
  assert.equal(scoreChange(50, null), null)
  assert.equal(scoreChange(null, 50), null)
})

test('score change line: every sync says (its score − the sync before’s), the number the chart tooltip shows', () => {
  // the owner's case: Oct 28 at 81 after Oct 27 at 66 (it said "No change since Oct 27": no page changed tone)
  const cols = colsOf([runOf('2026-10-20T10:00:00Z', [6, 6, 0, 3, 0]), runOf('2026-10-27T10:00:00Z', [10, 13, 0, 2, 0]), runOf('2026-10-28T10:00:00Z', [11, 4, 0, 1, 0]), runOf('2026-11-01T10:00:00Z', [0, 0, 0, 1, 0])])
  cols.forEach((col, i) => {
    const header = syncScoreChange(cols, i)
    const tooltip = i ? scoreOf(cols[i].counts) - scoreOf(cols[i - 1].counts) : null
    assert.equal(header.delta, tooltip, `${col.date}`)
    const line = scoreChangeLine(header, fmtDay)
    if (!i) assert.equal(line, 'First run')
    else if (tooltip > 0) assert.equal(line, `▲ +${tooltip} since ${fmtDay(cols[i - 1].date)}`)
    else if (tooltip < 0) assert.equal(line, `▼ −${-tooltip} since ${fmtDay(cols[i - 1].date)}`)
    else assert.equal(line, `No change since ${fmtDay(cols[i - 1].date)}`)
  })
  assert.equal(scoreOf(cols[2].counts), 81)
  assert.equal(scoreOf(cols[1].counts), 66)
  assert.equal(scoreChangeLine(syncScoreChange(cols, 2), fmtDay), '▲ +15 since Oct 27')
  // a gap (a sync with no pages) is no change line at all, never "No change"
  assert.equal(scoreChangeLine(syncScoreChange([{ date: '2026-10-01', counts: countTones([]) }, cols[2]], 1), fmtDay), null)
  // exactly 0 only: "No change since …"
  const flat = colsOf([runOf('2026-10-20T10:00:00Z', [2, 2, 0, 0, 0]), runOf('2026-10-27T10:00:00Z', [4, 4, 0, 0, 0])])
  assert.equal(scoreChangeLine(syncScoreChange(flat, 1), fmtDay), 'No change since Oct 20')
})

test('the first sync scored the new way hides its score jump and says "Scoring updated Nov 2"', () => {
  assert.equal(SCORING_UPDATED, '2026-11-02T08:35:42Z')
  assert.equal(SCORING_UPDATED_TIP, 'How the score is worked out changed on Nov 2, so it isn’t compared with earlier syncs.')
  const OLD_1 = runOf('2026-10-14T10:00:00Z', [4, 8, 0, 3, 0])
  const OLD_2 = runOf('2026-10-28T10:00:00Z', [4, 8, 0, 4, 0])
  const FIRST_NEW = runOf('2026-11-02T10:00:00Z', [9, 6, 1, 1, 1])
  const NEXT_NEW = runOf('2026-11-09T10:00:00Z', [8, 6, 2, 1, 0])
  const cols = colsOf([OLD_1, OLD_2, FIRST_NEW, NEXT_NEW])
  assert.deepEqual(cols.map((c, i) => scoringChangedAt(cols, i)), [false, false, true, false])
  const nov2 = syncScoreChange(cols, 2)
  assert.equal(nov2.scoringUpdated, true)
  assert.equal(nov2.delta, null)
  assert.equal(nov2.dir, undefined, 'no arrow, no colour')
  assert.equal(scoreChangeLine(nov2, fmtDay), 'Scoring updated Nov 2')
  const next = syncScoreChange(cols, 3)
  assert.equal(next.scoringUpdated, undefined)
  assert.equal(next.delta, scoreOf(cols[3].counts) - scoreOf(cols[2].counts))
  assert.equal(scoreChangeLine(syncScoreChange(cols, 1), fmtDay), '▼ −3 since Oct 14')
  // the cutoff is a moment, not a day: a sync earlier on Nov 2 (before the deploy) was still scored the old way
  const sameDay = colsOf([OLD_2, runOf('2026-11-02T08:30:00Z', [4, 8, 0, 4, 0]), FIRST_NEW])
  assert.deepEqual(sameDay.map((c, i) => scoringChangedAt(sameDay, i)), [false, false, true])
  // a brand whose first sync is new-method: "First run", no marker
  const fresh = colsOf([FIRST_NEW, NEXT_NEW])
  assert.equal(scoreChangeLine(syncScoreChange(fresh, 0), fmtDay), 'First run')
  assert.ok(!scoringChangedAt(fresh, 1))
})

test('the mock data: Nov 2 says "Scoring updated Nov 2", the latest compares with Nov 2, the first sync is "First run"', () => {
  const cols = syncColumns(RUNS, (r) => runPages(PAGES, r.counts, r.id))
  const at = cols.findIndex((c) => c.date === '2026-11-02')
  assert.ok(at > 0 && scoringChangedAt(cols, at))
  assert.equal(scoreChangeLine(syncScoreChange(cols, at), fmtDay), 'Scoring updated Nov 2')
  const last = syncScoreChange(cols, cols.length - 1)
  assert.equal(last.dir, 'up')
  assert.equal(scoreChangeLine(last, fmtDay), `▲ +${last.delta} since Nov 2`)
  assert.equal(scoreChangeLine(syncScoreChange(cols, 0), fmtDay), 'First run')
  const lines = cols.map((c, i) => scoreChangeLine(syncScoreChange(cols, i), fmtDay))
  assert.ok(lines.some((l) => l?.startsWith('▼ ')) && lines.some((l) => l?.startsWith('No change since')), 'down and no change too')
})

test('This sync: Positive · Mixed · Neutral · Negative add up to 100%, Not scored stays out with its own note', () => {
  const [col] = colsOf([runOf('2026-11-02T10:00:00Z', [9, 6, 1, 1, 1])])
  assert.deepEqual(col.counts, { positive: 9, neutral: 6, mixed: 1, negative: 1, unscored: 1 })
  const p = tonePercents(col.counts)
  assert.equal(p.positive + p.mixed + p.neutral + p.negative, 100)
  assert.ok(!('unscored' in p))
  assert.equal(p.mixed, 6) // 1 of the 17 scored pages, not of 18
  assert.equal(unscoredNote(col.counts), '1 page not scored')
  const csv = syncCsv(col.pages, { brand: 'Acme' })
  assert.match(csv, /^https:\/\/site2-0\.example\/a,Title site2-0\.example,site2-0\.example,AI Overview,mixed,,Acme$/m)
  assert.match(csv, /,unscored,,Acme$/m)
})

test('a past sync: the dot plot, This sync and the Pages list read the same pages; the tone filter stays with its sync', () => {
  const { runs, pagesOf } = load([runOf('2026-10-20T10:00:00Z', [6, 6, 0, 3, 0]), runOf('2026-10-27T10:00:00Z', [10, 13, 0, 2, 0]), runOf('2026-10-28T10:00:00Z', [11, 4, 0, 1, 0])])
  const cols = syncColumns(runs, pagesOf)
  const latest = runs.at(-1)
  const filter = { runId: latest.id, tone: 'negative' }
  assert.equal(heroTone(filter, latest.id), 'negative')
  cols.forEach((col, i) => {
    const run = runs[i]
    if (run === latest) return
    const tone = heroTone(filter, run.id)
    assert.equal(tone, null, 'another sync opens with all its pages')
    const lit = matchIds(col.all, { engine: 'all', tone })
    assert.deepEqual(countTones(col.all.filter((p) => lit.has(p.id))), col.counts, `${col.date}: dots`)
    assert.deepEqual(countTones(filterSyncPages(col.pages, {})), col.counts, `${col.date}: Pages list`)
  })
  assert.equal(heroTone(null, latest.id), null)
  // one engine: the column's pages and counts are that engine's, the full set stays in `all`
  const one = syncColumns(RUNS, (r) => runPages(PAGES, r.counts, r.id), 'claude').at(-1)
  assert.ok(one.pages.every((p) => p.engines.includes('claude')) && one.all.length === PAGES.length)
  assert.deepEqual(one.counts, countTones(one.pages))
})

test('Over time: Score’s latest-sync card shows only while Score is on through the auto-cycle and nobody uses the section', () => {
  assert.equal(scoreCardDocked({ view: 'score', auto: true, pointerIn: false, focusIn: false }), true, 'idle, auto-cycle on Score')
  assert.equal(scoreCardDocked({ view: 'score', auto: true, pointerIn: true, focusIn: false }), false, 'pointer over the section')
  assert.equal(scoreCardDocked({ view: 'score', auto: true, pointerIn: false, focusIn: true }), false, 'keyboard focus in the section')
  assert.equal(scoreCardDocked({ view: 'score', auto: false, pointerIn: false, focusIn: false }), false, 'a choice (Score / Mix / a point) stops auto')
  assert.equal(scoreCardDocked({ view: 'mix', auto: true, pointerIn: false, focusIn: false }), false, 'Mix')
})

test('Sources on the mock data: both columns have sites, neutral-only sites are left out', () => {
  const cols = syncColumns(RUNS, (r) => runPages(PAGES, r.counts, r.id))
  const { negative, positive } = sourceColumns(sourceCloud(cols))
  assert.ok(negative.length > 0 && positive.length > 0)
  assert.ok(![...negative, ...positive].some((s) => s.domain === 'wikipedia.org'), 'only ever neutral')
  assert.ok(sourceLead(negative[0], PAGES), 'the top negative site has a quote in the latest run')
})
