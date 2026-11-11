import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bucketsOf, claimParts, diffOf, dupKey, factsOnPage, markOf, mergeFacts, pageSections, sampleFacts, samplePages, sectionOf, sourceOf, verdictOf, yearConflicts } from './websiteFacts.js'

const facts = sampleFacts('example.com', 'Example')
const by = (id) => facts.find((f) => f.id === id)

test('verdictOf reads the check note: agrees, differs, not checked; null for a fact that is not a claim', () => {
  assert.equal(verdictOf(by('f8')), 'agrees')
  assert.equal(verdictOf(by('f11')), 'agrees')
  assert.equal(verdictOf(by('f10')), 'differs')
  assert.equal(verdictOf(by('f14')), 'unchecked')
  assert.equal(verdictOf(by('f2')), null)
})

test('sourceOf names the outside source from the evidence, else from the claim; none for a plain claim', () => {
  assert.deepEqual(sourceOf(by('f8')), { name: 'Trustpilot', domain: 'trustpilot.com' })
  assert.deepEqual(sourceOf(by('f10')), { name: 'BBB', domain: 'bbb.org' })
  assert.deepEqual(sourceOf(by('f13')), { name: 'TIME', domain: 'time.com' })
  assert.deepEqual(sourceOf(by('f14')), { name: 'Money', domain: 'money.com' })
  assert.equal(sourceOf(by('f19')), null)
  assert.equal(sourceOf(by('f2')), null)
})

test('the same award or rating in different words merges into one fact with its pages', () => {
  assert.equal(dupKey(by('f11')), dupKey(by('f12')))
  assert.equal(dupKey(by('f11')), dupKey(by('f13')))
  assert.equal(dupKey(by('f8')), dupKey(by('f9')))
  assert.notEqual(dupKey(by('f11')), dupKey(by('f14')))
  const time = mergeFacts(facts).find((g) => g.id === 'f11')
  assert.deepEqual(time.ids, ['f11', 'f12', 'f13'])
  assert.equal(time.pages.length, 3)
})

test('"Over 20 years" and "Established 2013" cannot both be true in 2026; "Over 10 years" can', () => {
  const merged = mergeFacts(facts)
  const c = yearConflicts(merged, 2026)
  assert.equal(c.length, 1)
  assert.deepEqual([c[0].a.id, c[0].b.id], ['f16', 'f17'])
  assert.match(c[0].why, /13 years, not over 20/)
  const ok = mergeFacts([{ ...by('f16'), value: 'Over 10 years' }, by('f17')])
  assert.equal(yearConflicts(ok, 2026).length, 0)
})

test('buckets: page text is kept out, a mismatch and a contradiction need a call, the rest is ready', () => {
  const b = bucketsOf(facts, 2026)
  assert.deepEqual(b.notFacts.map((f) => f.id), ['f5', 'f6', 'f7'])
  assert.deepEqual(b.differs.map((g) => g.id), ['f10'])
  assert.equal(b.conflicts.length, 1)
  assert.deepEqual(b.ready.map((g) => g.id), ['f1', 'f2', 'f3', 'f4', 'f14', 'f18', 'f19', 'f20'])
  assert.deepEqual(b.kept.map((g) => g.id), ['f8', 'f11', 'f21'])
  assert.deepEqual(b.cards.map((g) => sourceOf(g.lead).name), ['Trustpilot', 'BBB', 'TIME', 'Money'])
})

test('a resolved contradiction leaves the queue', () => {
  const picked = facts.map((f) => (f.id === 'f17' ? { ...f, status: 'CONFIRMED' } : f.id === 'f16' ? { ...f, status: 'REJECTED' } : f))
  const b = bucketsOf(picked, 2026)
  assert.equal(b.conflicts.length, 0)
  assert.ok(b.kept.some((g) => g.id === 'f17'))
  assert.ok(b.rejected.some((g) => g.id === 'f16'))
})

test('claimParts picks the claim out of the site sentence', () => {
  assert.deepEqual(claimParts(by('f10')), ['We’re proud to be ', 'A+ rated and accredited', ' by the BBB.'])
  assert.equal(claimParts(by('f8'))[1], '4.6 out of 5')
  assert.equal(claimParts(by('f16'))[1], 'over 20 years')
  assert.equal(claimParts(by('f14'))[1], 'Best Clean Skincare Brand 2025')
  assert.deepEqual(claimParts(by('f19')), ['', 'Over 2 million bottles sold, and counting.', ''])
})

test('pages group by the first folder of the path; a page knows the facts found on it', () => {
  const pages = samplePages('example.com')
  assert.equal(pages.length, 40)
  assert.equal(pages.filter((p) => !p.ok).length, 2)
  assert.equal(sectionOf('https://example.com/'), 'Home')
  assert.equal(sectionOf('https://example.com/blog/a-post'), 'Blog')
  assert.deepEqual(pageSections(pages).map((s) => [s.label, s.pages.length]), [['Home', 1], ['Products', 13], ['Blog', 12], ['About', 5], ['Help', 7], ['Privacy', 1], ['Terms', 1]])
  assert.deepEqual(factsOnPage(facts, 'https://example.com/help/contact').map((f) => f.id), ['f2', 'f3', 'f4'])
})

test('diffOf marks only the part that differs: A+ against A is the "+"; nothing when they agree', () => {
  assert.deepEqual(diffOf(by('f10')), { site: ['A', '+', ' rated and accredited'], source: ['A, accredited', '', ''] })
  assert.equal(diffOf(by('f8')), null)
  const tp = { ...by('f8'), notes: 'Checked on Trustpilot: 4.4 / 5 — site claims 4.6.', evidence: [by('f8').evidence[0], { ...by('f8').evidence[1], snippet: '4.4 / 5' }] }
  assert.deepEqual(diffOf(tp), { site: ['4.', '6', ' out of 5'], source: ['4.', '4', ' / 5'] })
})

test('markOf: the source\'s logo, a named certifier\'s, or none', () => {
  assert.equal(markOf(by('f10')).domain, 'bbb.org')
  assert.equal(markOf(by('f18')).domain, 'leapingbunny.org')
  assert.equal(markOf(by('f19')), null)
})
