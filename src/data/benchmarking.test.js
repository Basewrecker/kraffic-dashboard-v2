import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BENCH_ENGINES, beats, benchBrands, benchCsv, citedBrands, counts, engineGrid, engineStatus, leaderboard, previews, promptsTheyWin, rankLine, rankRows, sortRows, versus } from './benchmarking.js'
import { OWN, getBrandView, setNoResult } from './brandViews.js'
import { citationsMentions } from './mock.js'

const P = { none: false, oneSync: false, never: [], missed: [] }

test('the leaderboard is the Overview\'s numbers, by place', () => {
  setNoResult([])
  const rows = leaderboard('all', P)
  assert.deepEqual(rows.map((r) => r.name), ['Dermasuri', 'CeraVe', 'The Ordinary', 'Paula’s Choice'])
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3, 4])
  const you = rows[0]
  assert.equal(you.you, true)
  assert.equal(you.visibility, getBrandView(OWN.domain).kpis.score) // 73, the score card's
  assert.equal(you.change, getBrandView(OWN.domain).kpis.scoreDelta)
  // shares are whole % adding up to 100 (the Share of voice card's rule)
  assert.equal(rows.reduce((n, r) => n + r.share, 0), 100)
  // mentions and citations are the Citations and Mentions card's counts, summed over engines
  const sum = (d, i) => Object.values(citationsMentions[d]).reduce((n, v) => n + v[i], 0)
  assert.equal(you.mentions, sum(OWN.domain, 0))
  assert.equal(you.citations, sum(OWN.domain, 1))
})

test('places: an exact tie shares one, no result has none; sorting keeps "—" last', () => {
  const rows = rankRows([{ domain: 'a', visibility: 30 }, { domain: 'b', visibility: 30 }, { domain: 'c', visibility: 10 }, { domain: 'd', visibility: null }])
  assert.deepEqual(rows.map((r) => r.rank), [1, 1, 2, null])
  const withChange = [{ domain: 'a', rank: 1, change: 2 }, { domain: 'b', rank: 2, change: null }, { domain: 'c', rank: 3, change: -4 }]
  assert.deepEqual(sortRows(withChange, 'change', 'desc').map((r) => r.domain), ['a', 'c', 'b'])
  assert.deepEqual(sortRows(withChange, 'change', 'asc').map((r) => r.domain), ['c', 'a', 'b'])
  assert.deepEqual(sortRows(withChange, 'nope').map((r) => r.domain), ['a', 'b', 'c']) // unknown column: by place
})

test('where you rank, in one line', () => {
  const row = (name, visibility, you = false) => ({ domain: name, name, visibility, you })
  const lead = rankLine(rankRows([row('Dermasuri', 73, true), row('CeraVe', 18), row('Other', 4)]))
  assert.equal(lead.text, 'Dermasuri is #1 of 3. It leads CeraVe by 55 points.')
  const behind = rankLine(rankRows([row('Leader', 41), row('Dermasuri', 40, true), row('C', 9), row('D', 8), row('E', 7), row('F', 6)]))
  assert.equal(behind.text, 'Dermasuri is #2 of 6. Leader leads by 1 point.')
  assert.equal(behind.other.name, 'Leader')
  const tie = rankLine(rankRows([row('Dermasuri', 20, true), row('CeraVe', 20)]))
  assert.equal(tie.text, 'Dermasuri shares #1 of 2 with CeraVe.')
  assert.equal(rankLine(rankRows([row('Dermasuri', null, true), row('CeraVe', null)])), null) // no result: no line
})

test('by engine: the best brand on each engine is marked; an engine with no result is null, never 0', () => {
  setNoResult([])
  const grid = engineGrid(P)
  assert.deepEqual(grid.map((g) => g.engine), BENCH_ENGINES)
  const aio = grid.find((g) => g.engine === 'aio')
  assert.deepEqual(aio.best, [OWN.domain])
  // every brand at 0 on an engine: nobody is "best"
  const claude = grid.find((g) => g.engine === 'claude')
  assert.ok(Object.values(claude.values).every((v) => v === 0))
  assert.deepEqual(claude.best, [])
  // didn't run in the latest sync
  setNoResult(['gemini'])
  const gem = engineGrid(P).find((g) => g.engine === 'gemini')
  assert.equal(gem.status, 'missed')
  assert.ok(Object.values(gem.values).every((v) => v === null))
  assert.deepEqual(gem.best, [])
  assert.deepEqual(counts(OWN.domain, 'gemini', P), { mentions: null, citations: null })
  assert.ok(leaderboard('gemini', P).every((r) => r.visibility === null && r.rank === null && r.share === null))
  setNoResult([])
  // the sample: Claude didn't run in the latest sync
  const sample = previews({ none: false, oneSync: false, never: [] })
  assert.equal(engineStatus('claude', sample), 'missed')
  assert.ok(Object.values(engineGrid(sample).find((g) => g.engine === 'claude').values).every((v) => v === null))
  // never ran
  const never = { ...P, never: ['claude'] }
  assert.equal(engineStatus('claude', never), 'never')
  assert.equal(engineGrid(never).find((g) => g.engine === 'claude').status, 'never')
  assert.equal(engineStatus('all', never), 'ran')
})

test('the prompts a competitor wins and you miss open in Content', () => {
  setNoResult([])
  const won = promptsTheyWin('cerave.com', 'all', P)
  assert.ok(won.length > 3)
  for (const x of won) assert.ok(Number.isInteger(x.id) && x.id >= 0, `a Content page id (${x.key})`)
  // most engines first
  assert.ok(won.every((x, i) => i === 0 || won[i - 1].engines >= x.engines))
  const list = beats('all', P)
  assert.ok(list.every((c, i) => i === 0 || list[i - 1].prompts.length >= c.prompts.length))
  assert.ok(!list.some((c) => c.domain === OWN.domain))
  const v = versus('cerave.com', 'all', P)
  assert.equal(v.prompts.length, won.length)
  assert.equal(v.them.name, 'CeraVe')
})

test('who gets cited: a brand cited more often than it is named is marked', () => {
  setNoResult([])
  const list = citedBrands('all', P)
  assert.ok(list.every((b, i) => i === 0 || list[i - 1].citations >= b.citations))
  const ord = list.find((b) => b.domain === 'theordinary.com')
  assert.equal(ord.citedMore, true)
  assert.ok(ord.citations > ord.mentions)
  assert.ok(ord.pages.length > 0 && ord.pages.every((p, i) => i === 0 || ord.pages[i - 1].count >= p.count))
  assert.equal(list.find((b) => b.domain === OWN.domain).citedMore, false)
})

test('states: no competitors, one sync', () => {
  setNoResult([])
  assert.deepEqual(benchBrands({ ...P, none: true }).map((b) => b.domain), [OWN.domain])
  assert.deepEqual(beats('all', { ...P, none: true }), [])
  const one = leaderboard('all', { ...P, oneSync: true })
  assert.ok(one.every((r) => r.change === null))
  assert.ok(!benchCsv('all', { ...P, oneSync: true }).includes('Change since last sync'))
})

test('the download is the leaderboard, then visibility by engine', () => {
  setNoResult(['gemini'])
  const csv = benchCsv('all', P, (e) => e.toUpperCase())
  const lines = csv.trim().split('\n')
  assert.equal(lines[0], 'Rank,Brand,Domain,Visibility %,Share of voice %,Mentions,Citations,Change since last sync (points)')
  assert.match(lines[1], /^1,Dermasuri,dermasuri\.com,73,/)
  assert.ok(lines.includes('Brand,CHATGPT visibility %,AIO visibility %,AIMODE visibility %,CLAUDE visibility %,GEMINI visibility %'))
  // no result: an empty cell, never 0
  assert.match(lines.at(-1), /,$/)
  setNoResult([])
})
