// Opportunities → Content: the per-prompt sample pages and queries match the prompt. Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { missedPrompts } from './mock.js'
import { candidatesFor, gscKeywordsFor, newPageFor, parsePrompt, promptWords, slugify, winningPageFor } from './contentOpportunities-proposed.js'

const pathOf = (u) => new URL(u).pathname
const words = (s) => new Set(String(s).toLowerCase().match(/[a-z0-9]+/g) ?? [])
const shares = (text, prompt) => { const w = words(text); return promptWords(prompt).some((p) => w.has(p)) }

test('every missed prompt gets 5–6 candidate pages about its own subject', () => {
  assert.equal(missedPrompts.length, 41)
  for (const row of missedPrompts) {
    const cs = candidatesFor(row)
    assert.ok(cs.length >= 5 && cs.length <= 6, `${row.prompt}: ${cs.length} pages`)
    for (const c of cs) {
      // the page's path or its top query names the prompt's subject; every one of its queries does
      assert.ok(shares(pathOf(c.url).replace(/[/-]/g, ' '), row.prompt) || shares(c.queries[0].keyword, row.prompt), `${row.prompt}: ${pathOf(c.url)}`)
      for (const k of c.queries) assert.ok(shares(k.keyword, row.prompt), `${row.prompt}: query "${k.keyword}"`)
      assert.ok(c.queries.length >= 4 && c.queries.length <= 5)
      assert.equal(c.trend.length, 8)
    }
    assert.equal(cs.filter((c) => c.bestMatch).length, 1)
    assert.ok(cs[0].bestMatch)
  }
})

test('no prompt borrows the old niacinamide + vitamin C sample unless it asks about it', () => {
  for (const row of missedPrompts) {
    const text = candidatesFor(row).flatMap((c) => [c.url, ...c.queries.map((k) => k.keyword)]).join(' ')
    if (!/niacinamide|vitamin c/.test(row.prompt.toLowerCase())) assert.doesNotMatch(text, /niacinamide-vitamin-c|vitamin c serum layering/)
  }
})

test('query rows have the gsc_keywords shape, are unique, and add up to their page', () => {
  for (const row of missedPrompts) {
    const rows = gscKeywordsFor(row)
    assert.equal(new Set(rows.map((k) => k.keyword)).size, rows.length, `${row.prompt}: a query repeats`)
    for (const k of rows) {
      assert.deepEqual(Object.keys(k), ['keyword', 'clicks', 'impressions', 'ctr', 'position', 'url'])
      assert.ok(k.impressions > 0 && k.clicks >= 0 && k.clicks <= k.impressions && k.position >= 1)
      assert.match(k.url, /^https:\/\/dermasuri\.com\//)
    }
    for (const c of candidatesFor(row)) {
      assert.equal(c.impressions, [...c.queries, ...c.others].reduce((a, k) => a + k.impressions, 0))
      assert.equal(c.matchImpressions, c.queries.reduce((a, k) => a + k.impressions, 0))
      assert.equal(c.clicks, [...c.queries, ...c.others].reduce((a, k) => a + k.clicks, 0))
      assert.ok(c.queries.every((k, i) => i === 0 || c.queries[i - 1].impressions >= k.impressions), 'queries sorted by impressions')
    }
  }
})

test('the same row always gets the same data', () => {
  const row = missedPrompts[13]
  assert.deepEqual(candidatesFor(row), candidatesFor({ ...row }))
  assert.deepEqual(newPageFor(row), newPageFor({ ...row }))
})

test('"can pigmentation serum cause breakouts": the owner\'s example', () => {
  const row = { prompt: 'can pigmentation serum cause breakouts', topic: 'Pigmentation', sources: [], competitors: [] }
  const paths = candidatesFor(row).map((c) => pathOf(c.url))
  assert.ok(paths.includes('/blog/do-dark-spot-serums-cause-acne'), paths.join(' '))
  assert.ok(paths.includes('/products/brightening-serum'), paths.join(' '))
  assert.equal(candidatesFor(row)[0].queries[0].keyword, 'pigmentation serum breakouts')
  assert.deepEqual(newPageFor(row), { slug: '/guides/can-pigmentation-serum-cause-breakouts', reason: '/blog/pigmentation-serum redirects to the homepage, so a new page is cleaner.' })
})

test('the new page: the prompt as a /guides/ slug, and a reason that names the path it means', () => {
  for (const row of missedPrompts) {
    const np = newPageFor(row)
    assert.equal(np.slug, `/guides/${slugify(row.prompt)}`)
    assert.match(np.slug, /^\/guides\/[a-z0-9-]+$/)
    const path = np.reason.match(/^(\/blog\/[a-z0-9-]+) redirects to the homepage/)?.[1]
    assert.ok(path, np.reason)
    assert.ok(shares(path.replace(/[/-]/g, ' '), row.prompt), `${row.prompt}: ${path}`)
  }
})

test('page winning it: a competitor\'s page when the row cites one, with 2–3 formats', () => {
  for (const row of missedPrompts) {
    const w = winningPageFor(row)
    if (!row.sources.length) { assert.equal(w, null); continue }
    assert.ok(row.sources.some((s) => s.domain === w.domain && s.path === w.path))
    if (row.sources.some((s) => row.competitors.includes(s.domain))) assert.ok(row.competitors.includes(w.domain), row.prompt)
    assert.ok(w.formats.length >= 2 && w.formats.length <= 3)
  }
})

test('parsePrompt reads the frames the prompts are written in', () => {
  assert.deepEqual(parsePrompt('can ceramide cream cause breakouts'), { angle: 'breakouts', subject: 'ceramide cream', qualifier: null })
  assert.deepEqual(parsePrompt('best azelaic acid cream for rosacea'), { angle: 'best-for', subject: 'azelaic acid cream', qualifier: 'rosacea' })
  assert.deepEqual(parsePrompt('how to use night cream for dry skin in a routine'), { angle: 'routine', subject: 'night cream for dry skin', qualifier: null })
  assert.equal(parsePrompt('squalane oil vs rosehip oil').angle, 'versus')
  assert.equal(parsePrompt('something else entirely').angle, 'other')
})

test('prompts outside the mock\'s frames still get matching pages', () => {
  for (const prompt of ['squalane oil vs rosehip oil', 'how to fade dark spots on the face', 'what percentage of niacinamide is best', 'fragrance free sunscreen for sensitive skin']) {
    const row = { prompt, topic: null, sources: [], competitors: [] }
    const cs = candidatesFor(row)
    assert.ok(cs.length >= 5, prompt)
    for (const c of cs) for (const k of c.queries) assert.ok(shares(k.keyword, prompt), `${prompt}: ${k.keyword}`)
  }
})

import { WEEKS, citedBy, formatsOf } from './contentOpportunities-proposed.js'

test('a page\'s 8-week trend: its last 4 weeks add up to its impressions; the 4 weeks before give the comparison', () => {
  assert.equal(WEEKS.length, 8)
  for (const row of missedPrompts) {
    for (const c of candidatesFor(row)) {
      assert.equal(c.trend.slice(4).reduce((a, b) => a + b, 0), c.impressions)
      assert.equal(c.prev.impressions, c.trend.slice(0, 4).reduce((a, b) => a + b, 0))
      assert.ok(c.prev.clicks >= 0 && c.prev.position >= 1)
    }
  }
})

test('who cites each source: a competitor\'s engines from the row, a publisher 1–3 engines; 1–2 formats', () => {
  // the five engines: Google is two (AI Overview 'google', AI Mode 'aimode')
  const engines = ['google', 'aimode', 'chatgpt', 'gemini', 'claude']
  for (const row of missedPrompts) {
    for (const s of row.sources) {
      const by = citedBy(row, s, engines)
      assert.ok(by.length >= 1 && by.length <= engines.length && by.every((e) => engines.includes(e)))
      const brand = row.brandsMentioned.find((b) => b.domain === s.domain)
      if (brand) assert.deepEqual(by, engines.filter((e) => brand.platforms.includes(e)))
      const f = formatsOf(row, s)
      assert.ok(f.length >= 1 && f.length <= 3)
    }
  }
})

test('each page: the prompt\'s queries (match) and two others that aren\'t about it; 8 weeks split the same way', () => {
  for (const row of missedPrompts) {
    for (const c of candidatesFor(row)) {
      assert.ok(c.queries.length >= 4 && c.queries.every((k) => k.match && shares(k.keyword, row.prompt)))
      assert.equal(c.others.length, 2)
      assert.ok(c.others.every((k) => !k.match && !shares(k.keyword, row.prompt)), `${row.prompt}: ${c.others.map((k) => k.keyword)}`)
      assert.equal(c.weeks.length, 8)
      c.weeks.forEach((w, i) => {
        assert.equal(w.impressions, c.trend[i])
        assert.equal(w.matched + w.other, w.impressions)
        assert.ok(w.matched > 0 && w.other >= 0 && w.clicks >= 0 && w.position >= 1)
      })
      assert.equal(c.weeks.slice(4).reduce((a, w) => a + w.clicks, 0), c.clicks)
      assert.equal(c.weeks.slice(0, 4).reduce((a, w) => a + w.clicks, 0), c.prev.clicks)
    }
  }
})

import { enginesCitingPage } from './contentOpportunities-proposed.js'

test('engines citing a page: only engines where the brand is named, deterministic, rarer down the list', () => {
  let first = 0
  let last = 0
  for (const row of missedPrompts) {
    candidatesFor(row).forEach((c, i) => {
      const by = enginesCitingPage(row, c.url, i)
      assert.ok(by.every((e) => !row.platforms.includes(e)))
      assert.deepEqual(by, enginesCitingPage(row, c.url, i))
      if (i === 0) first += by.length
      if (i === 4) last += by.length
    })
  }
  assert.ok(first > last)
})

import { draftFor, setDraftState } from './contentOpportunities-proposed.js'

test('setDraftState: a copied or published draft is what the list and a reopened prompt read back', () => {
  const row = missedPrompts[30]
  assert.equal(draftFor(30, row), null)
  setDraftState(30, { stage: 'waiting', action: 'update', target_url: 'https://dermasuri.com/blog/x' })
  assert.equal(draftFor(30, row).stage, 'waiting')
  setDraftState(30, { stage: 'monitoring', week: 0 })
  assert.equal(draftFor(30, row).stage, 'monitoring')
  assert.equal(draftFor(30, row).target_url, 'https://dermasuri.com/blog/x')
})

import { FACTS, FLAGS, QUESTIONS, UPLOADS, factsFound } from './contentOpportunities-proposed.js'
import { FLAG_RULES } from './contentRecommend.js'

test('Your data: each question clears a real flag; a file\'s "Read · n facts" is its number of suggestions', () => {
  for (const q of QUESTIONS) assert.ok(FLAG_RULES[q.flag], q.id)
  assert.deepEqual(QUESTIONS.map((q) => [q.label, FLAG_RULES[q.flag].label, FLAG_RULES[q.flag].score]), [['Office locations', 'Missing brand info', 6], ['How you quote prices', 'Needs verification', 5], ['Approved stats or reviews', 'Needs verification', 5]])
  const f = { id: 'u9', name: 'spec-sheet.pdf', type: 'pdf' }
  assert.deepEqual(factsFound(f), factsFound({ ...f }))
  for (const u of UPLOADS) assert.equal(factsFound(u).n, factsFound(u).suggestions.length, u.name)
  assert.deepEqual(UPLOADS.map((u) => factsFound(u).n), [3, 11])
  // "Add all n": every fact found is offered (none repeats a fact you have), so n is the sum of the files' counts
  const labels = new Set(FACTS.map((x) => x.label.toLowerCase()))
  const all = UPLOADS.flatMap((u) => factsFound(u).suggestions).filter((x) => !labels.has(x.label.toLowerCase()))
  assert.equal(all.length, 14)
  assert.equal(new Set(all.map((x) => x.label.toLowerCase())).size, 14)
})

import { CLAIMS, DRAFT, FORMATS, GEN_STEPS, genStepsFor, readPages } from './contentOpportunities-proposed.js'
import { draftOutline, genSummary } from '../pages/opportunities/draft/model.js'

test('Writing the draft: the claims are the draft\'s sentences; the "Needs your OK" ones are the flags\' claims; counts agree', () => {
  const text = JSON.stringify(DRAFT)
  for (const c of CLAIMS) assert.ok(text.includes(c.text), c.id)
  const flagged = CLAIMS.filter((c) => c.flag)
  for (const c of flagged) assert.equal(FLAGS.find((f) => f.id === c.flag)?.resolved, false, c.id)
  assert.deepEqual(flagged.map((c) => c.flag).sort(), ['f2', 'f3']) // Unverified stat, Percentage advice
  const row = missedPrompts[0]
  const pages = readPages(row)
  assert.equal(new Set(pages.map((p) => p.domain)).size, pages.length)
  assert.ok(pages.every((p) => p.title.length > 10))
  assert.deepEqual(readPages(row), pages) // deterministic
  const steps = genStepsFor({ pages, formats: FORMATS, competitors: row.competitors ?? [], outline: draftOutline(DRAFT), claims: CLAIMS })
  assert.deepEqual(steps.map((x) => x.id), GEN_STEPS.map((x) => x.id))
  assert.equal(steps.find((x) => x.id === 'claims').total, CLAIMS.length)
  assert.equal(steps.find((x) => x.id === 'write').total, draftOutline(DRAFT).length)
  assert.equal(genSummary(steps), `Draft written in 5.0s · ${pages.length} pages · ${CLAIMS.length} claims checked`)
})
