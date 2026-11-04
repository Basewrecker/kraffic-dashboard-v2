// Your data v1 → the ONE userFacts payload (userFacts.js), and what the (mock) route does with it. Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { CAP, SAMPLE_DATA, buildUserFacts, dataKey, fromStored, isEmpty, questionsFor, toStored, userDataSummary } from './userFacts.js'
import { CONTENT_RECOMMEND, FLAG_RULES, contentRecommendFor, requestFor } from '../../../data/contentRecommend.js'
import { missedPrompts } from '../../../data/mock.js'
import { storageKey } from '../draft/recommend.js'

const doc = (name, text, status = 'read') => ({ id: name, name, status, text, words: text.split(/\s+/).length })
const q = (flag, answer) => ({ id: flag, flag, label: flag, answer })

test('empty → an empty payload (and the request carries no userFacts)', () => {
  const r = buildUserFacts({})
  assert.deepEqual(r, { userFacts: { facts: [], answers: [], documentsText: '' }, chars: 0, over: false, cut: null, unused: [] })
  assert.ok(isEmpty(r.userFacts))
  assert.equal('userFacts' in requestFor(missedPrompts[0], r.userFacts), false)
  // half-filled facts, blank answers, unread / failed / rejected files carry nothing
  const r2 = buildUserFacts({ facts: [{ label: 'Clinic', value: '  ' }, { label: '', value: 'x' }], questions: [q('fees', ' ')], uploads: [doc('a.txt', 'hi', 'reading'), { ...doc('b.pdf', ''), status: 'error' }, { ...doc('c.png', ''), status: 'rejected' }] })
  assert.ok(isEmpty(r2.userFacts))
})

test('shape: facts [{label, value}], answers [{flagId, answer}], documentsText (files in upload order, pasted text last)', () => {
  const r = buildUserFacts({
    facts: [{ label: ' Clinic location ', value: '14 King Street, Manchester ' }],
    questions: [q('locations', '14 King Street'), q('fees', '')],
    uploads: [doc('one.txt', 'First file.'), doc('two.docx', 'Second file.')],
    pasted: ' Pasted note. ',
  })
  assert.deepEqual(r.userFacts, {
    facts: [{ label: 'Clinic location', value: '14 King Street, Manchester' }],
    answers: [{ flagId: 'locations', answer: '14 King Street' }],
    documentsText: '## one.txt\nFirst file.\n\n## two.docx\nSecond file.\n\n## Pasted text\nPasted note.',
  })
  assert.equal(r.over, false)
  assert.equal(r.chars, 'Clinic location'.length + '14 King Street, Manchester'.length + '14 King Street'.length + r.userFacts.documentsText.length)
  assert.deepEqual(Object.keys(requestFor(missedPrompts[0], r.userFacts)), ['prompt', 'brandDomain', 'brandName', 'competitors', 'sources', 'targetUserId', 'userFacts'])
})

test('the 20k cap: documents are cut (at a word), the file named with where; later files left out; facts and answers never cut', () => {
  const big = Array.from({ length: 5000 }, (_, i) => `word${i}`).join(' ') // ~38k characters
  const facts = [{ label: 'Clinic location', value: '14 King Street, Manchester' }]
  const data = { facts, questions: [q('fees', 'From $24')], uploads: [doc('small.txt', 'Short first file.'), doc('big.txt', big), doc('after.csv', 'a,b')] }
  const r = buildUserFacts(data)
  assert.equal(r.over, true)
  assert.ok(r.chars <= CAP, `${r.chars} > ${CAP}`)
  assert.ok(r.chars > CAP - 20, 'fills the budget')
  assert.deepEqual(r.userFacts.facts, facts) // never cut
  assert.deepEqual(r.userFacts.answers, [{ flagId: 'fees', answer: 'From $24' }])
  assert.equal(r.cut.name, 'big.txt')
  assert.equal(r.cut.words, 5000)
  assert.ok(r.cut.keptWords > 2000 && r.cut.keptWords < 5000, String(r.cut.keptWords))
  assert.match(r.userFacts.documentsText, /^## small\.txt\nShort first file\.\n\n## big\.txt\nword0 word1 /)
  assert.match(r.userFacts.documentsText, /word\d+$/) // ends on a whole word
  assert.deepEqual(r.unused, ['after.csv'])
  // the first file alone is over: it's the one cut, from the start
  const r2 = buildUserFacts({ uploads: [doc('big.txt', big), doc('small.txt', 'x')] })
  assert.equal(r2.cut.name, 'big.txt')
  assert.deepEqual(r2.unused, ['small.txt'])
  // exactly at the cap: not over
  const exact = 'x'.repeat(CAP - '## e.txt\n'.length)
  assert.equal(buildUserFacts({ uploads: [doc('e.txt', exact)] }).over, false)
  assert.equal(buildUserFacts({ uploads: [doc('e.txt', `${exact}y`)] }).over, true)
  // typed facts over the cap on their own: kept whole, every document left out
  const many = Array.from({ length: 60 }, (_, i) => ({ label: `Fact ${i}`, value: 'v'.repeat(390) }))
  const r3 = buildUserFacts({ facts: many, uploads: [doc('a.txt', 'text')] })
  assert.equal(r3.userFacts.facts.length, 60)
  assert.equal(r3.userFacts.documentsText, '')
  assert.deepEqual(r3.unused, ['a.txt'])
  assert.equal(r3.over, true)
})

test('questions: the response\'s answerable flags (not Expert review, not Draft gaps), by score; answers keep their flag ids', () => {
  const flags = [FLAG_RULES.fees, FLAG_RULES.expert_review, FLAG_RULES.locations, { id: 'issue_3', label: 'Draft gap', score: 3 }, FLAG_RULES.reviews]
  const qs = questionsFor(flags, [{ flagId: 'locations', answer: 'Manchester' }])
  assert.deepEqual(qs.map((x) => [x.flag, x.label, x.answer]), [['locations', 'Clinic or office locations', 'Manchester'], ['fees', 'How you quote prices', ''], ['reviews', 'Approved stats or reviews', '']])
  // the fixture prompt (0): its flags are locations, fees, reviews
  assert.deepEqual(questionsFor(CONTENT_RECOMMEND[0].flags).map((x) => x.flag), ['locations', 'fees', 'reviews'])
})

test('kept in this browser per brand + prompt, next to the draft\'s key; text, not files; capped at CAP + 1 per file', () => {
  assert.equal(dataKey('dermasuri.com', 'best azelaic acid cream for rosacea'), 'auden:content-data:v1:dermasuri.com:best azelaic acid cream for rosacea')
  assert.equal(storageKey('dermasuri.com', 'x').replace('content-brief', 'content-data'), dataKey('dermasuri.com', 'x'))
  const data = { uploads: [{ ...doc('a.txt', 'y'.repeat(CAP + 500)), type: 'txt', bytes: 20500 }, { ...doc('b.pdf', ''), status: 'error' }], facts: [{ label: 'A', value: 'b' }, { label: '', value: '' }], questions: [q('fees', 'From $24'), q('reviews', '')], pasted: 'note' }
  const s = toStored(data)
  assert.deepEqual(Object.keys(s), ['facts', 'answers', 'pasted', 'documents'])
  assert.deepEqual(s.facts, [{ label: 'A', value: 'b' }])
  assert.deepEqual(s.answers, [{ flagId: 'fees', answer: 'From $24' }])
  assert.equal(s.documents.length, 1)
  assert.equal(s.documents[0].text.length, CAP + 1)
  assert.deepEqual(Object.keys(s.documents[0]), ['name', 'kind', 'bytes', 'words', 'text'])
  // back: the questions come from the flags, with the stored answers; the cap still knows the file was cut
  const back = fromStored(JSON.parse(JSON.stringify(s)), [FLAG_RULES.fees, FLAG_RULES.reviews])
  assert.deepEqual(back.questions.map((x) => x.answer), ['From $24', ''])
  assert.equal(buildUserFacts(back).over, true)
  assert.equal(buildUserFacts(back).cut.name, 'a.txt')
  assert.deepEqual(fromStored(null, []).uploads, [])
})

test('summary line: read files, pasted text, facts, answers', () => {
  assert.equal(userDataSummary({ uploads: [], facts: [], questions: [q('fees', '')], pasted: '' }), null)
  assert.equal(userDataSummary({ uploads: [doc('a.txt', 'x'), { ...doc('b.pdf', ''), status: 'error' }], facts: [{ label: 'a', value: 'b' }], questions: [q('fees', 'x'), q('reviews', '')], pasted: 'p' }),
    '1 file · pasted text · 1 fact · 1 of 2 answered')
})

test('the fixture (prompt 0, ?co=data-sample): the draft names the clinic location and the locations flag goes; without userFacts, the normal draft', () => {
  const row = missedPrompts[0]
  const before = contentRecommendFor(row)
  assert.equal(before, CONTENT_RECOMMEND[0])
  assert.ok(before.flags.some((f) => f.id === 'locations' && f.label === 'Missing brand info'))
  assert.match(before.contentMarkdown, /Confirm with your team: Which clinic location/)
  assert.doesNotMatch(before.contentMarkdown, /King Street/)
  const { userFacts } = buildUserFacts(fromStored(SAMPLE_DATA, before.flags))
  const after = contentRecommendFor(row, userFacts)
  assert.match(after.contentMarkdown, /## Direct answer\n\n[^\n]*book a skin check at our clinic at 14 King Street, Manchester\./)
  assert.match(after.contentMarkdown, /- See us in person: our clinic at 14 King Street, Manchester/)
  assert.equal(after.flags.some((f) => f.id === 'locations'), false)
  assert.deepEqual(after.flags.map((f) => f.id), before.flags.filter((f) => f.id !== 'locations').map((f) => f.id))
  assert.equal(after.reviewScore.total, before.reviewScore.total - FLAG_RULES.locations.score)
  // the fact alone (no answer) is enough; an answer alone too
  assert.equal(contentRecommendFor(row, { facts: [{ label: 'Clinic location', value: 'Leeds' }], answers: [], documentsText: '' }).flags.some((f) => f.id === 'locations'), false)
  assert.match(contentRecommendFor(row, { facts: [], answers: [{ flagId: 'locations', answer: 'Leeds' }], documentsText: '' }).contentMarkdown, /our clinic at Leeds/)
  // empty userFacts: the route's response as today
  assert.equal(contentRecommendFor(row, { facts: [], answers: [], documentsText: '' }), CONTENT_RECOMMEND[0])
})

test('answers clear their flags on every prompt (the proposed rule); Expert review never clears', () => {
  const row = missedPrompts[7] // expert_review, fees, reviews
  const res = contentRecommendFor(row, { facts: [], answers: [{ flagId: 'fees', answer: 'From $24' }, { flagId: 'expert_review', answer: 'done' }], documentsText: '' })
  assert.deepEqual(res.flags.map((f) => f.id), ['expert_review', 'reviews'])
})

test('before the first draft: the five first-visit questions by flag score; a draft\'s flags replace them, answers kept', async () => {
  const { FIRST_VISIT } = await import('./userFacts.js')
  const first = questionsFor([], [{ flagId: 'locations', answer: 'Manchester' }], { drafted: false })
  assert.deepEqual(first.map((q) => q.flag), ['credentials', 'locations', 'fees', 'reviews', 'contact'])
  assert.deepEqual(FIRST_VISIT.map((f) => f.score), [8, 6, 5, 5, 4])
  assert.equal(first.find((q) => q.flag === 'locations').answer, 'Manchester')
  assert.ok(first.every((q) => q.label && q.placeholder), 'labels and placeholders from QUESTION_FOR')
  assert.equal(questionsFor([], [], { drafted: true }).length, 0, 'a draft with no answerable flags asks nothing')
  const later = questionsFor([{ id: 'fees', score: 5 }, { id: 'locations', score: 6 }], [{ flagId: 'locations', answer: 'Manchester' }])
  assert.deepEqual(later.map((q) => q.flag), ['locations', 'fees'])
  assert.equal(later[0].answer, 'Manchester')
  assert.deepEqual(fromStored(null, [], { drafted: false }).questions.map((q) => q.flag), first.map((q) => q.flag))
})
