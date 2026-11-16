// Your data → ONE userFacts payload, sent with the draft request (content-recommend, a new optional field: see
// docs/port-content.md). Pure, so node --test runs it.
//   userFacts: { facts: [{ label, value }], answers: [{ flagId, answer }], documentsText }
// Order and the cap (CAP = 20,000 characters over all three): facts first, then answers, then the documents in upload
// order (pasted text last). Facts and answers are never cut (they're short, typed by the user, and their inputs have a
// maxLength); only documentsText is. Each document goes in as "## <file name>" + its text, blank line between; when the
// budget runs out inside one, it's cut there (at the last space before the limit) and any later documents are left out.
// Characters counted: fact labels + values, answers, and documentsText (headings included). Keys aren't counted.
import { countWords } from './extract.js'

export const CAP = 20000
export const LABEL_MAX = 80
export const VALUE_MAX = 400
export const ANSWER_MAX = 400

const filled = (f) => Boolean(f.label?.trim() && f.value?.trim())
// the documents a payload carries: read files in upload order, then pasted text
export const documentsOf = ({ uploads = [], pasted = '' }) => [
  ...uploads.filter((u) => u.status === 'read' && u.text).map((u) => ({ name: u.name, text: u.text })),
  ...(pasted.trim() ? [{ name: 'Pasted text', text: pasted.trim() }] : []),
]

// → { userFacts, chars, over, cut: { name, keptWords, words } | null, unused: [names] }
export function buildUserFacts({ facts = [], questions = [], uploads = [], pasted = '' } = {}, cap = CAP) {
  const f = facts.filter(filled).map((x) => ({ label: x.label.trim(), value: x.value.trim() }))
  const answers = questions.filter((q) => q.answer?.trim()).map((q) => ({ flagId: q.flag ?? q.id, answer: q.answer.trim() }))
  const typed = f.reduce((s, x) => s + x.label.length + x.value.length, 0) + answers.reduce((s, a) => s + a.answer.length, 0)
  const docs = documentsOf({ uploads, pasted })
  const whole = docs.map((d, i) => `${i ? '\n\n' : ''}## ${d.name}\n${d.text}`)
  let budget = cap - typed
  const parts = []
  let cut = null
  const unused = []
  docs.forEach((d, i) => {
    const head = whole[i].slice(0, whole[i].length - d.text.length) // "\n\n## name\n"
    if (cut || budget < head.length + 1) { unused.push(d.name); return }
    if (whole[i].length <= budget) { parts.push(whole[i]); budget -= whole[i].length; return }
    // cut inside this document, at the last space before the limit (a whole word), else at the limit
    const room = budget - head.length
    let kept = d.text.slice(0, room)
    const sp = kept.search(/\s\S*$/)
    if (sp > room * 0.8) kept = kept.slice(0, sp)
    kept = kept.trimEnd()
    parts.push(head + kept)
    budget = 0
    cut = { name: d.name, keptWords: countWords(kept), words: countWords(d.text) }
  })
  const documentsText = parts.join('')
  return {
    userFacts: { facts: f, answers, documentsText },
    chars: typed + documentsText.length,
    over: typed + whole.join('').length > cap,
    cut,
    unused,
  }
}

export const isEmpty = (u) => !u || (!u.facts.length && !u.answers.length && !u.documentsText)

// ---- the step's questions: the response's flags an answer can clear (Missing brand info / Needs verification) -----
// rule id (data/contentRecommend.js FLAG_RULES, the draft lib's buildReviewFlags) → the question. Not asked: Expert
// review (a qualified reviewer has to read the draft) and Draft gaps (fixed by rewriting, not by a fact).
export const QUESTION_FOR = {
  credentials: { label: 'Registration or named experts', placeholder: 'e.g. a registration number, the experts you name' },
  locations: { label: 'Clinic or office locations', placeholder: 'e.g. 14 King Street, Manchester' },
  fees: { label: 'How you quote prices', placeholder: 'e.g. from $24, free shipping over $40' },
  reviews: { label: 'Approved stats or reviews', placeholder: 'e.g. 4.8 from 2,140 reviews' },
  contact: { label: 'Public phone or contact page', placeholder: 'e.g. +1 415 555 0142, /contact' },
  trademark: { label: 'Trademark wording', placeholder: 'e.g. which names are registered (®)' },
}
// Before the first draft there are no flags yet (the target stage returns none), so a first visit asks a standard set:
// the draft check's own flag ids, by their flag score, so an answer clears that flag when the draft is written
// (owner, 2026-11-04). Once a draft exists, its real flags replace them.
export const FIRST_VISIT = [
  { id: 'credentials', score: 8 }, { id: 'locations', score: 6 }, { id: 'fees', score: 5 }, { id: 'reviews', score: 5 }, { id: 'contact', score: 4 },
]
// flags (the response's, before any userFacts) → [{ id, flag, label, placeholder, answer }], by score as in the rail;
// answers: [{ flagId, answer }] (kept in this browser); drafted: false = no draft yet → the first-visit set
export const questionsFor = (flags = [], answers = [], { drafted = true } = {}) => (drafted ? flags : FIRST_VISIT)
  .filter((fl) => QUESTION_FOR[fl.id])
  .slice().sort((a, b) => b.score - a.score)
  .map((fl) => ({ id: fl.id, flag: fl.id, ...QUESTION_FOR[fl.id], answer: answers.find((a) => a.flagId === fl.id)?.answer ?? '' }))

// ---- kept in this browser, per brand + prompt (like the draft's ticks, auden:content-brief:v1:…) --------------------
// Facts, answers, pasted text and each read file's name, size, word count and text (capped at CAP + 1 characters: nothing
// past CAP is ever sent, the +1 keeps "it was cut" true). Never the File objects. The app's sign-out clears it
// (clearBrowserData removes every key but the theme).
export const dataKey = (domain, prompt) => `auden:content-data:v1:${domain}:${prompt}`
export const toStored = ({ uploads = [], facts = [], questions = [], pasted = '' }) => ({
  facts: facts.filter((f) => f.label.trim() || f.value.trim()).map(({ label, value }) => ({ label, value })),
  answers: questions.filter((q) => q.answer.trim()).map((q) => ({ flagId: q.flag ?? q.id, answer: q.answer })),
  pasted,
  documents: uploads.filter((u) => u.status === 'read').map((u) => ({ name: u.name, kind: u.type, bytes: u.bytes, words: u.words, text: u.text.slice(0, CAP + 1) })),
})
export const fromStored = (s, flags, { drafted = true } = {}) => ({
  uploads: (s?.documents ?? []).map((d, i) => ({ id: `s${i}`, name: d.name, type: d.kind, bytes: d.bytes, status: 'read', words: d.words, text: d.text })),
  facts: s?.facts ?? [],
  questions: questionsFor(flags, s?.answers ?? [], { drafted }),
  pasted: s?.pasted ?? '',
  dismissed: [],
})

// "2 files · 1 fact · 1 of 3 answered" (only files that were read); nothing → null
export function userDataSummary({ uploads = [], facts = [], questions = [], pasted = '' }) {
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
  const parts = []
  const files = uploads.filter((u) => u.status === 'read').length
  if (files) parts.push(plural(files, 'file'))
  if (pasted.trim()) parts.push('pasted text')
  const nFacts = facts.filter(filled).length
  if (nFacts) parts.push(plural(nFacts, 'fact'))
  const answered = questions.filter((q) => q.answer.trim()).length
  if (answered) parts.push(`${answered} of ${questions.length} answered`)
  return parts.length ? parts.join(' · ') : null
}

// ?co=data-sample: the fixture (prompt 0, "best azelaic acid cream for rosacea"): a clinic location the draft uses, an
// answer, and one file already read
export const SAMPLE_TEXT = 'Our clinic offers rosacea consultations with a dermatology nurse. Appointments last 20 minutes and include a skin check, a patch test for new actives and a written routine. Most patients start azelaic acid every other evening for two weeks, then move to once a day. We see patients Monday to Saturday, 9am to 6pm, and the first visit is free for existing customers.'
export const SAMPLE_DATA = {
  facts: [{ label: 'Clinic location', value: '14 King Street, Manchester' }, { label: 'First visit', value: 'Free for existing customers' }],
  answers: [{ flagId: 'locations', answer: '14 King Street, Manchester' }],
  pasted: '',
  documents: [{ name: 'clinic-services.txt', kind: 'txt', bytes: SAMPLE_TEXT.length, words: countWords(SAMPLE_TEXT), text: SAMPLE_TEXT }],
}
