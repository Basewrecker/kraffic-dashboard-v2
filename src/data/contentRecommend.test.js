import { test } from 'node:test'
import assert from 'node:assert/strict'
import { missedPrompts } from './mock.js'
import { CONTENT_FORMATS, CONTENT_RECOMMEND, buildResponse, hostileResponse, requestFor, reviewFlags } from './contentRecommend.js'

// the route's response, field by field (route.js + lib/content-format-recommend.js + lib/content-draft-for-prompt.js)
const KEYS = ['ok', 'analyzedAt', 'brandDomain', 'brandName', 'prompt', 'coverage', 'ourFormats', 'formats', 'recommendations', 'angles', 'citedPages', 'pageRecommendation', 'evidence', 'contentMarkdown', 'contentSource', 'contentComplete', 'contentIssues', 'expertReview', 'brandFactsAvailable', 'flags', 'reviewScore']
const IDS = CONTENT_FORMATS.map((f) => f.id)
const isUrl = (u) => /^https:\/\/[^\s]+$/.test(u)
const oneOf = (v, xs) => xs.includes(v)
const keysAre = (o, ks, what) => assert.deepEqual(Object.keys(o).sort(), [...ks].sort(), what)

function checkShape(r, row) {
  keysAre(r, KEYS, 'top-level keys')
  assert.equal(r.ok, true)
  assert.ok(!Number.isNaN(Date.parse(r.analyzedAt)))
  assert.equal(r.prompt, row.prompt)
  assert.ok(oneOf(r.coverage, ['missing', 'partial', 'covered']))
  assert.ok(r.ourFormats.every((id) => IDS.includes(id)))
  for (const f of r.formats) {
    keysAre(f, ['id', 'label', 'score', 'base', 'onPage1', 'needed', 'usages'], 'format')
    assert.ok(IDS.includes(f.id) && f.score > 0 && f.needed === true)
    for (const u of f.usages) keysAre(u, ['url', 'host', 'rank', 'aiCited', 'who', 'add'], 'usage')
  }
  for (const x of r.recommendations) { keysAre(x, ['id', 'label', 'score', 'status', 'why'], 'recommendation'); assert.ok(oneOf(x.status, ['missing', 'partial', 'covered'])) }
  assert.ok(r.angles.every((a) => typeof a === 'string'))
  assert.ok(r.citedPages.length <= 12)
  for (const p of r.citedPages) {
    keysAre(p, ['url', 'host', 'rank', 'engines', 'aiCited', 'formats', 'isOurs', 'title'], 'citedPage')
    assert.ok(isUrl(p.url) && (p.rank === null || (p.rank >= 1 && p.rank <= 10)))
    assert.ok(p.formats.every((id) => IDS.includes(id)))
  }
  const pr = r.pageRecommendation
  if (pr.action === 'update') keysAre(pr, ['action', 'url', 'title', 'evidence', 'reason'], 'update')
  else { keysAre(pr, ['action', 'suggestedPath', 'suggestedUrl', 'url', 'slug', 'evidence', 'reason'], 'create'); assert.equal(pr.url, pr.suggestedUrl) }
  assert.ok(r.evidence.length <= 5)
  for (const e of r.evidence) keysAre(e, ['url', 'host', 'rank', 'aiCited', 'formats', 'title'], 'evidence')
  assert.ok(oneOf(r.contentSource, ['claude', 'template']))
  assert.equal(r.contentComplete, r.contentIssues.length === 0)
  for (const f of r.flags) {
    keysAre(f, ['id', 'label', 'status', 'score', 'text'], 'flag')
    assert.ok(oneOf(f.label, ['Expert review', 'Missing brand info', 'Needs verification', 'Draft gap']))
    assert.ok(oneOf(f.status, ['required', 'missing', 'partial']))
  }
  keysAre(r.reviewScore, ['done', 'total', 'remaining'], 'reviewScore')
  assert.equal(r.reviewScore.total, r.flags.reduce((s, f) => s + f.score, 0))
  // the Markdown follows the lib: H1 = the prompt, the notice, the sections, no pipe tables
  const md = r.contentMarkdown
  assert.ok(md.startsWith(`# ${row.prompt}\n`))
  assert.ok(/Draft for client review/.test(md))
  for (const h of ['## Direct answer', '## Key points', '## FAQ', '## Sources', '## Page recommendation']) assert.ok(md.includes(h), h)
  assert.ok(!/\|\s*-{3,}\s*\|/.test(md), 'no pipe tables')
  if (r.flags.length) assert.ok(md.includes('## Flags'))
}

test('content-recommend samples: one per missed prompt, each the route\'s exact shape', () => {
  assert.equal(Object.keys(CONTENT_RECOMMEND).length, missedPrompts.length)
  for (const row of missedPrompts) checkShape(CONTENT_RECOMMEND[row.id], row)
  checkShape(hostileResponse(missedPrompts[13]), missedPrompts[13])
})

test('the samples cover every case the route returns', () => {
  const all = Object.values(CONTENT_RECOMMEND)
  assert.ok(all.some((r) => r.contentSource === 'template'))
  assert.ok(all.some((r) => !r.contentComplete && r.contentIssues.length))
  assert.ok(all.some((r) => !r.brandFactsAvailable))
  assert.ok(all.some((r) => r.expertReview))
  assert.ok(all.some((r) => r.pageRecommendation.action === 'update') && all.some((r) => r.pageRecommendation.action === 'create'))
  assert.ok(['missing', 'partial', 'covered'].every((c) => all.some((r) => r.coverage === c)))
})

test('flags follow the lib\'s rules and scores', () => {
  const f = reviewFlags({ markdown: 'medical; our office; call us; $20; reviews; ® ; partner', brandFacts: '', brandName: 'B', contentIssues: ['x'] })
  assert.deepEqual(f.flags.map((x) => [x.id, x.label, x.status, x.score]), [
    ['expert_review', 'Expert review', 'required', 10], ['credentials', 'Missing brand info', 'missing', 8], ['locations', 'Missing brand info', 'missing', 6],
    ['contact', 'Missing brand info', 'partial', 4], ['fees', 'Needs verification', 'partial', 5], ['reviews', 'Needs verification', 'partial', 5],
    ['trademark', 'Needs verification', 'partial', 3], ['issue_7', 'Draft gap', 'missing', 3],
  ])
  assert.deepEqual(f.reviewScore, { done: 0, total: 44, remaining: 44 })
  // brand facts with an address and phone silence locations and contact
  assert.deepEqual(reviewFlags({ markdown: 'office, call', brandFacts: 'Phone (from site): 1\nAddress (from site): x' }).flags, [])
})

test('the request the client sends; samples are deterministic', () => {
  const row = missedPrompts[0]
  assert.deepEqual(Object.keys(requestFor(row)), ['prompt', 'brandDomain', 'brandName', 'competitors', 'sources', 'targetUserId'])
  assert.deepEqual(buildResponse(row), CONTENT_RECOMMEND[row.id])
})

import { SAMPLES, SAMPLE_ROWS, competitorName } from './contentRecommend.js'

test('the live reverse-mortgage sample (rm-1) has the route\'s exact shape; names come from competitor settings', () => {
  for (const row of SAMPLE_ROWS) checkShape(SAMPLES[row.id], row)
  const rm = SAMPLES['rm-1']
  assert.equal(rm.reviewScore.total, 35) // as in the live run: 10 + 6 + 5 + 5 + 3 × 3
  assert.deepEqual(rm.flags.map((f) => f.label), ['Expert review', 'Missing brand info', 'Needs verification', 'Needs verification', 'Draft gap', 'Draft gap', 'Draft gap'])
  assert.ok(!/Finance of America|financeofamerica|longbridge|fairwayreverse|reverse\.mortgage\b/i.test(JSON.stringify(rm)), 'brand and competitors renamed')
  assert.deepEqual(SAMPLE_ROWS[0].competitors.map(competitorName), ['Keystone Reverse', 'Mapleway Reverse', 'ReverseLoans'])
  assert.equal(competitorName('cerave.com'), 'CeraVe')
  assert.equal(competitorName('unknown-site.com'), 'unknown-site.com') // the domain, never a name made from it
})

import { parseMarkdown, plainOf } from '../pages/opportunities/draft/markdown.js'
import { draftSections, withComparisons } from '../pages/opportunities/draft/recommend.js'

test('every sample: no FAQ answer restates the Direct answer; comparison options differ on every label', () => {
  for (const res of [...Object.values(CONTENT_RECOMMEND), ...Object.values(SAMPLES)]) {
    const { shown } = draftSections(res.contentMarkdown)
    const direct = shown.find((s) => s.title === 'Direct answer')?.blocks.map((b) => plainOf(b.inline ?? [])).join(' ').trim()
    const faq = shown.find((s) => s.title === 'FAQ')
    if (direct && faq) for (const b of faq.blocks.filter((x) => x.type === 'p')) assert.ok(!plainOf(b.inline).includes(direct), `${res.prompt}: an FAQ answer repeats the direct answer`)
    for (const s of shown) {
      for (const g of withComparisons(s.blocks).filter((b) => b.type === 'compare' && b.uniform)) {
        for (const label of g.labels) {
          const values = g.options.map((o) => o.rows.find((r) => r.label === label)?.value)
          assert.equal(new Set(values).size, values.length, `${res.prompt}: "${label}" repeats across options`)
        }
      }
    }
  }
})

// the generated samples (the live rm-1 fixture keeps the route's own text: its lib asks for the prompt as the first
// FAQ question, and the live run wrote "Confirm with your team: which …")
test('every generated sample reads right: a capital after ". " and after "Confirm with your team:"; the first FAQ question isn\'t the prompt + "?"', () => {
  for (const res of Object.values(CONTENT_RECOMMEND)) {
    const { shown } = draftSections(res.contentMarkdown)
    const text = shown.flatMap((s) => s.blocks.map((b) => (b.items ? b.items.map(plainOf).join('\n') : plainOf(b.inline)))).join('\n').replace(/https?:\/\/\S+/g, '')
    assert.ok(!/\. [a-z]/.test(text), `${res.prompt}: lowercase after ". " — ${text.match(/.{20}\. [a-z].{10}/)?.[0]}`)
    assert.ok(!/Confirm with your team:\s+[a-z]/.test(text), `${res.prompt}: lowercase after "Confirm with your team:"`)
    const q = shown.find((s) => s.title === 'FAQ')?.blocks.find((b) => b.type === 'h3')
    if (q) assert.notEqual(plainOf(q.inline).toLowerCase(), `${res.prompt.replace(/\?$/, '')}?`.toLowerCase(), res.prompt)
  }
})
