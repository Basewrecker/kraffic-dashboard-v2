// Fact Check's rules: the design mock's src/data/websiteFacts.js (design/website-facts a3b66c8), copied without its sample
// data (the made-up brand's facts and pages never ship). The page (components/mock/pages/facts/WebsiteFactsPage.jsx) reads
// the real data through lib/fact-check-adapter.js; these rules only derive what the design shows from it. The feature
// is Harsh's (lib/website-facts.js, lib/website-fact-claims.js, migrations 014 / 015); nothing here changes his logic.
// Every rule reads only fields the app has:
//   fact  { id, category, field, value, status, source, notes, evidence[{ url, page_title, snippet, source_type }] }
//   page  { id, url, title, http_status, words, ok, error, fetched_at }
// No React and no window here, so the tests can import it (scripts/mock-unit/fact-check-rules.test.mjs).
// app: differences from the mock, each marked "app:" below: the check's notes are read by one explicit parser
// (checkResultOf) that never infers a mismatch; a BBB grade is never read out of the letters of "BBB".

import { looksLikeDomain } from './citation-rules.js'

// app (owner, 2026-11-12): the brand as the page names it: Brand Setup's display name (the adapter's brand.name), never
// its domain. brand.name falls back to the domain when Brand Setup has no name (brandDisplayName): then null, and the
// page says "your" ("Your fact sheet", "your website"). The domain shows only as the link under the hero's title.
export function brandLabelOf(brand) {
  const name = String(brand?.name ?? '').trim()
  const domain = String(brand?.domain ?? '').trim().toLowerCase().replace(/^www\./, '')
  if (!name || looksLikeDomain(name)) return null
  return name.toLowerCase().replace(/^www\./, '') === domain ? null : name
}

export const KIND = {
  brand_name: 'Brand name', phone: 'Phone', email: 'Email', address: 'Address',
  title: 'Page title', description: 'Meta description', heading: 'Heading', note: 'Fact',
  trustpilot_rating: 'Trustpilot rating', bbb_rating: 'BBB rating', award: 'Award', years: 'Years in business',
  accreditation: 'Accreditation', claim: 'Site claim',
}

// The fact sheet's groups, in reading order
export const GROUPS = [
  { id: 'contact', label: 'Contact', fields: ['brand_name', 'phone', 'email', 'address'] },
  { id: 'ratings', label: 'Ratings', fields: ['trustpilot_rating', 'bbb_rating'] },
  { id: 'awards', label: 'Awards', fields: ['award'] },
  { id: 'years', label: 'Years in business', fields: ['years'] },
  { id: 'accreditations', label: 'Accreditations', fields: ['accreditation'] },
  { id: 'other', label: 'Other facts', fields: ['claim', 'note'] },
]
export const groupOf = (fact) => GROUPS.find((g) => g.fields.includes(fact.field))?.id ?? 'other'

// Text we read that isn't a fact about the business (the home page's title, meta description and hero heading)
export const isPageText = (fact) => fact.category === 'page'
const isClaim = (fact) => fact.category === 'claim' || fact.source === 'WEBSITE_CLAIM'

// app (owner, 2026-11-11): what the outside check said, read from the note Harsh's check writes
// (lib/website-fact-claims.js verifyTrustpilot / verifyBbb / verifyAward / verifyYears / verifyClaim /
// discoverAndVerifyClaims) by explicit patterns only, one per sentence his code writes:
//   'agrees'    the source has the same value           ("— matches the site.", "the brand appears on the list.")
//   'differs'   the source has another value            ("— site claims 4.6.", "— site claims “A+ rated …”.")
//   'unchecked' the source was tried and had nothing    ("Could not read a Trustpilot profile …", shown "Not found")
//   'none'      no result to show (no check for this kind, the check failed, a source page with no claimed value)
// A note that fits none of them is 'none' too, the safe state: the fact waits in Ready to confirm and its source row
// shows no result. A mismatch is never inferred. Outside production, a note that fell through is logged once.
const MATCHES = '— matches the site\\.'
const CHECK_NOTES = [
  ['agrees', new RegExp(`^Checked on Trustpilot: .+ ${MATCHES}$`)],
  ['agrees', new RegExp(`^Checked on BBB: .+ ${MATCHES}$`)],
  ['agrees', /^Checked on the publisher page — the brand appears on the list\.$/],
  ['differs', /^Checked on Trustpilot: .+ — site claims \d(?:\.\d+)?\.$/],
  ['differs', /^Checked on BBB: .+ — site claims “.*”\.$/],
  ['unchecked', /^Could not read a Trustpilot profile for this brand\.$/],
  ['unchecked', /^Could not confirm the BBB rating from bbb\.org\b.*$/],
  ['unchecked', /^Award claim found on the site; could not confirm it on a publisher page automatically\.$/],
  ['none', /^Checked on (?:Trustpilot|BBB): [^—]+\.$/], // the source page was read, but the site's value wasn't known
  ['none', /^Checked a related publisher page — wording overlaps; open the source to confirm the exact award\.$/],
  ['none', /^Longevity claim on the site\b/],
  ['none', /^Claim found on the site(?:; no automatic third-party check for this kind yet|; not checked yet \(cap reached\))?\.$/],
  ['none', /^Check failed: /],
]
const unknownNotes = new Set()
export function checkResultOf(notes) {
  const n = String(notes ?? '').trim()
  if (!n) return 'none'
  const hit = CHECK_NOTES.find(([, re]) => re.test(n))
  if (hit) return hit[0]
  if (process.env.NODE_ENV !== 'production' && !unknownNotes.has(n)) {
    unknownNotes.add(n)
    console.warn(`[fact-check] check note not recognised, shown with no result: ${n.slice(0, 160)}`)
  }
  return 'none'
}
// 'agrees' | 'differs' | 'unchecked' | 'none' (null: not a claim)
export function verdictOf(fact) {
  if (!isClaim(fact)) return null
  return checkResultOf(fact.notes)
}
export const VERDICT_WORD = { agrees: 'Agrees', differs: 'Differs', unchecked: 'Not checked', none: 'No result' }
// The stored check result decides (owner, 2026-11-13 hotfix): the page never turns a stored "matches" into "Doesn't
// match" by comparing the stored strings itself.
const RATING_FIELDS = new Set(['trustpilot_rating', 'bbb_rating'])
// The Trustpilot rating the check compared (lib/website-fact-claims.js verifyTrustpilot stores it first, as "4.7 / 5";
// a "TrustScore 4.5" after it is the half-star image's value, not the compared one) → '4.7 / 5', or null
const TP_RATING = /(\d(?:\.\d)?)\s*(?:\/|out of)\s*5\b/i
export function sourceRatingOf(fact, snippet) {
  if (fact?.field !== 'trustpilot_rating') return null
  const m = TP_RATING.exec(String(snippet ?? ''))
  return m ? `${m[1]} / 5` : null
}

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }
export const pathOf = (url) => { try { const p = new URL(url).pathname.replace(/\/$/, ''); return p || '/' } catch { return String(url ?? '') } }
export const siteEvidence = (fact) => (fact.evidence ?? []).find((e) => !e.source_type || e.source_type === 'WEBSITE') ?? null
export const outsideEvidence = (fact) => (fact.evidence ?? []).find((e) => e.source_type && e.source_type !== 'WEBSITE') ?? null

// The outside source a claim names: { name, domain } for its logo, or null (a claim with no source to check against)
const PUBLISHERS = { 'trustpilot.com': 'Trustpilot', 'bbb.org': 'BBB', 'time.com': 'TIME', 'money.com': 'Money' }
export function sourceOf(fact) {
  if (!isClaim(fact)) return null
  const out = outsideEvidence(fact)
  if (out) { const domain = hostOf(out.url); return { name: PUBLISHERS[domain] ?? domain, domain } }
  if (fact.field === 'trustpilot_rating') return { name: 'Trustpilot', domain: 'trustpilot.com' }
  if (fact.field === 'bbb_rating') return { name: 'BBB', domain: 'bbb.org' }
  if (fact.field === 'award') {
    if (/\bTIME\b/.test(fact.value)) return { name: 'TIME', domain: 'time.com' }
    if (/\bMoney\b/.test(fact.value)) return { name: 'Money', domain: 'money.com' }
  }
  return null
}

// A logo to show beside a fact: its outside source, or a certifier it names (for display only: no check is implied)
export const markOf = (fact) => sourceOf(fact) ?? (/leaping bunny/i.test(fact.value) ? { name: 'Leaping Bunny', domain: 'leapingbunny.org' } : null)

// A fact's name in a tight row or hover card. app (owner, 2026-11-11): the stored value, character for character
// (Content drafts use it), never a rebuilt or shortened name; the mock rebuilt it ("TIME Best Companies 2024")
export const shortName = (fact) => String(fact.value)
// The part of a value that carries it (the number, the rating, the award's name), to set it a weight heavier:
// "Over 2 million bottles sold" → ['Over ', '2 million', ' bottles sold']. null when the value has no such part.
// app: a BBB grade is a letter not followed by another letter, so the B of "BBB rated A+" (Harsh's claim wording) isn't
// read as the grade (the mock's (?![a-z]) let it through); the same in shortName, dupKey and diffOf
const KEY_RE = {
  trustpilot_rating: /\d(?:\.\d)?\s*(?:\/|out of)\s*5/i,
  bbb_rating: /\b[A-D][+-]?(?![A-Za-z])/,
  award: /(?:America['’]s\s+)?Best\s+[A-Z][^.,;:]*?(?:19|20)\d{2}\b/, // app: \b, so a garbled year ("20264") isn't cut short
  years: /\d{1,2}\s+years|(?:19|20)\d{2}/i,
  accreditation: /^.+?(?=\s+(?:certified|accredited)\b)/i,
}
const KEY_NUMBER = /\d+\s+(?:in|out of)\s+\d+|\$?\d[\d,.]*\s*(?:million|billion|thousand|%)?/i
const NO_KEY = new Set(['brand_name', 'phone', 'email', 'address', 'title', 'description', 'heading'])
export function keyPart(fact) {
  const v = String(fact.value)
  if (NO_KEY.has(fact.field)) return null
  const m = (KEY_RE[fact.field] ?? KEY_NUMBER).exec(v)
  if (!m || !m[0].trim() || m[0].trim() === v) return null
  const key = m[0].trimEnd()
  return [v.slice(0, m.index), key, v.slice(m.index + key.length)]
}

// A fact as a tile: its key figure and a short label under it (the mock's: "TIME America's Best Companies 2024" →
// Best Companies 2024 · TIME award; the app's rules below replace it).
// app (owner, 2026-11-11): what a tile shows is the stored value, character for character, because Content drafts use
// it: figure + label together are the whole value, never a shortened, tidied or re-cased one. A split is clean only
// when the figure is the value's key part and the rest of the value sits on one side of it, as stored:
//   ratings and grades: the source's name before it ("Trustpilot 4.7 / 5" → 4.7 / 5 · Trustpilot;
//     "Better Business Bureau® A+" → A+ · Better Business Bureau®)
//   anything else: words after it ("Over 2 million bottles sold" isn't clean; "2 million bottles sold" → 2 million ·
//     bottles sold; "Leaping Bunny certified" → Leaping Bunny · certified)
//   or nothing around it (the value is the figure; the label is its kind)
// Otherwise the whole value is shown as plain text ({ figure: null, text, label: its kind }): "Over 20 years",
// "Established 2013", "listed as one of America’s Best Companies 2026", a garbled award title.
const plain = (v, label) => ({ figure: null, text: v, label })
const LEAD_OK = new Set(['trustpilot_rating', 'bbb_rating'])
// no digits before the year, so a garbled value ("Best Companies 20264 Best Reverse Mortgage Lender 2026") isn't one name
const AWARD_NAME = /^Best\s+[A-Z][^.,;:\d]*?(?:19|20)\d{2}$/
// a value that is exactly its key part ("4.7 / 5", "20 years"): keyPart gives null for it, but it's a figure
const keyIsWhole = (fact, v) => !NO_KEY.has(fact.field) && (KEY_RE[fact.field] ?? KEY_NUMBER).exec(v)?.[0] === v
export function tileOf(fact) {
  const v = String(fact.value)
  // app (owner, 2026-11-12): a fact you added stays "added by you" after a Remove and Use again (the route's confirm
  // sets it to CONFIRMED; its source stays YOU)
  const added = fact.status === 'ADDED_BY_YOU' || fact.source === 'YOU' ? ' · added by you' : ''
  const src = fact.field === 'award' ? sourceOf(fact) : null
  const kind = (fact.field === 'award' ? (src ? `${src.name} award` : 'Award') : (KIND[fact.field] ?? 'Fact')) + added
  // an award is a figure only when the whole value is its name ("Best Reverse Mortgage Lender 2026")
  if (fact.field === 'award') return AWARD_NAME.test(v.trim()) ? { figure: v, label: kind } : plain(v, kind)
  const k = keyPart(fact)
  if (!k) return keyIsWhole(fact, v) ? { figure: v, label: kind } : plain(v, kind)
  const [before, key, after] = k
  if (before && after) return plain(v, kind)
  if (before) return LEAD_OK.has(fact.field) && /\s$/.test(before) ? { figure: key, label: before.trimEnd() + added } : plain(v, kind)
  return /^\s/.test(after) ? { figure: key, label: after.trimStart() + added } : plain(v, kind)
}
// two claims that can't both be true, as one tile: "20 years / 2013 · years in business" (app: either one plain → both
// values whole)
export const pairTileOf = (a, b) => {
  const [ta, tb] = [tileOf(a), tileOf(b)]
  return ta.figure != null && tb.figure != null ? { figure: `${ta.figure} / ${tb.figure}`, label: ta.label } : { figure: null, text: `${a.value} / ${b.value}`, label: 'Years in business' }
}

// The number a site claim leads with, as a short numeral: "2M", "9/10", "98%"; null when it has none
export function numeralOf(value) {
  const v = String(value)
  let m
  if ((m = /(\d+)\s+(?:in|out of)\s+(\d+)/i.exec(v))) return `${m[1]}/${m[2]}`
  if ((m = /(\d+(?:\.\d+)?)\s*%/.exec(v))) return `${m[1]}%`
  if ((m = /(\d+(?:\.\d+)?)\s*(million|billion|thousand)\b/i.exec(v))) return `${m[1]}${{ million: 'M', billion: 'B', thousand: 'K' }[m[2].toLowerCase()]}`
  if ((m = /\d[\d,]*(?:\.\d+)?/.exec(v))) return m[0]
  return null
}

// The site's sentence with the claim picked out: [before, claim, after] (the whole sentence as the claim when no rule fits)
const CLAIM_RE = {
  trustpilot_rating: /\d(?:\.\d)?\s*(?:out of|\/)\s*5/i,
  bbb_rating: /A\+(?:\s+rated)?(?:\s+and\s+accredited)?|\b[A-D][+-]?\s+rated/i,
  years: /over\s+\d{1,2}\s+years|(?:since|est\.?|established)\s+(?:19|20)\d{2}/i,
  award: /(?:America['’]s\s+)?Best\s+[A-Z][^.,;:]*?(?:19|20)\d{2}\b/, // app: \b, so a garbled year ("20264") isn't cut short
}
export function claimParts(fact) {
  const text = siteEvidence(fact)?.snippet ?? fact.value
  const m = CLAIM_RE[fact.field]?.exec(text)
  return m ? [text.slice(0, m.index), m[0], text.slice(m.index + m[0].length)] : ['', text, '']
}

// Where a claim and its source part ways: the characters after their common start ("A+" against "A" → the "+").
// → { site: [before, differing, after] of the claim, source: [before, differing, after] of the source's value, tokens } | null
const TOKEN = { bbb_rating: /\b[A-D][+-]?(?![A-Za-z])/, trustpilot_rating: /\d(?:\.\d)?/ }
export function diffOf(fact) {
  const re = TOKEN[fact.field]
  const out = outsideEvidence(fact)
  if (!re || !out || verdictOf(fact) !== 'differs') return null
  const claim = claimParts(fact)[1]
  const a = re.exec(claim)
  const b = re.exec(out.snippet)
  if (!a || !b) return null
  let n = 0
  while (n < a[0].length && n < b[0].length && a[0][n] === b[0][n]) n += 1
  const cut = (text, m) => (m[0].length > n ? [text.slice(0, m.index + n), text.slice(m.index + n, m.index + m[0].length), text.slice(m.index + m[0].length)] : [text, '', ''])
  // tokens: the two short values on their own, each as [same, differing] ("A+" → ['A', '+'])
  return { site: cut(claim, a), source: cut(out.snippet, b), tokens: { site: [a[0].slice(0, n), a[0].slice(n)], source: [b[0].slice(0, n), b[0].slice(n)] } }
}

// ---- duplicates: the same rating or award found more than once, in different words ---------------------------------
const STOP = new Set(['s', 'a', 'an', 'the', 'to', 'of', 'by', 'in', 'on', 'as', 'for', 'and', 'named', 'awarded', 'recognized', 'rated', 'list', 'out', 'excellent'])
const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9.+ ]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w))
export function dupKey(fact) {
  const v = String(fact.value)
  if (fact.field === 'trustpilot_rating') return `trustpilot|${v.match(/\d(?:\.\d)?/)?.[0] ?? v.toLowerCase()}`
  if (fact.field === 'bbb_rating') return `bbb|${v.match(/\b[A-D][+-]?(?![A-Za-z])/)?.[0] ?? ''}|${/accredited/i.test(v) ? 'acc' : ''}`
  if (fact.field === 'award') return `award|${[...new Set(words(v))].sort().join(' ')}`
  return `${fact.field}|${words(v).join(' ')}`
}
// → [{ id (the first copy's), lead, copies, ids, pages (the site pages it was found on) }], in first-seen order
// app (owner, 2026-11-12): only copies with the same status merge, so a removed copy never hides one in use (or the
// other way round) and Remove / Use again act on what the card shows
export function mergeFacts(facts) {
  const by = new Map()
  for (const f of facts) {
    const k = `${f.status}|${dupKey(f)}`
    if (!by.has(k)) by.set(k, { id: f.id, lead: f, copies: [] })
    by.get(k).copies.push(f)
  }
  return [...by.values()].map((g) => ({
    ...g,
    ids: g.copies.map((c) => c.id),
    pages: [...new Set(g.copies.map((c) => siteEvidence(c)?.url).filter(Boolean))],
  }))
}

// ---- one claim in several wordings: "Over 20 years", "For over 20 years", "over 20 years of experience" -----------
// app (owner, 2026-11-12): Harsh's reader stores near-duplicate wordings of one claim as separate facts
// (docs/proposals-for-harsh.md). Site claims of the same kind that state the same figure are one claim here: one
// decision, one Ready row, one fact sheet entry, counted once.
// figureKey: the figure a fact states, normalised, with its kind ("years|count 20", "years|year 2013",
// "trustpilot_rating|4.6", "claim|2 million bottle"); null when it states none (then it groups only with the same
// wording, dupKey). Contact details, page text, awards and accreditations have no figure (a year in an award's name
// isn't the award).
const NO_FIGURE = new Set([...NO_KEY, 'award', 'accreditation'])
const UNIT_SKIP = new Set([...STOP, 'over', 'more', 'than', 'nearly', 'almost', 'about', 'around', 'up', 'plus'])
const unitOf = (rest) => {
  const w = String(rest).toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).find((x) => x && !UNIT_SKIP.has(x))
  return w ? w.replace(/(?<=[a-z]{3})s$/, '') : ''
}
export function figureKey(fact) {
  const v = String(fact?.value ?? '')
  const field = fact?.field
  if (!field || NO_FIGURE.has(field)) return null
  let m
  if (field === 'years') {
    if ((m = /(\d{1,3})\s*\+?\s*years?\b/i.exec(v))) return `years|count ${Number(m[1])}`
    if ((m = /\b((?:19|20)\d{2})\b/.exec(v))) return `years|year ${m[1]}`
    return null
  }
  if (field === 'trustpilot_rating') return (m = /\d(?:\.\d+)?/.exec(v)) ? `${field}|${Number(m[0])}` : null
  if (field === 'bbb_rating') return (m = /\b[A-D][+-]?(?![A-Za-z])/.exec(v)) ? `${field}|${m[0]}` : null
  // any other kind: its key number with its unit ("9 in 10 dermatologists", "98%", "2 million bottles")
  if ((m = /(\d+)\s+(?:in|out of)\s+(\d+)/i.exec(v))) return `${field}|${m[1]}/${m[2]} ${unitOf(v.slice(m.index + m[0].length))}`.trimEnd()
  if (!(m = /(\d[\d,]*(?:\.\d+)?)\s*(%|percent\b|million\b|billion\b|thousand\b)?/i.exec(v))) return null
  const scale = m[2] ? (m[2] === '%' || /^percent$/i.test(m[2]) ? '%' : ` ${m[2].toLowerCase()}`) : ''
  const unit = unitOf(v.slice(m.index + m[0].length))
  if (!scale && !unit) return null // a bare number says too little to call two claims the same
  return `${field}|${m[1].replace(/,/g, '')}${scale}${unit ? ` ${unit}` : ''}`
}
// app (owner, 2026-11-12): awardKey: an award's title, normalised, when two wordings name the same award ("listed as
// one of America’s Best Companies 2026" and "America's Best Companies 2026" → "award|best companies 2026"): lower case,
// curly quotes straightened, punctuation dropped, then a leading "listed as one of" / "named" / "ranked among the" /
// "America's" etc. dropped. Only an identical remaining title, ending in its year, is the same award; a value that
// differs in any other word or digit keeps its own key (the garbled "Best Companies 20264 Best Reverse Mortgage Lender
// 2026" groups with nothing). null for another kind or a title with no year at its end.
const AWARD_LEAD = /^(?:(?:was|is|has been|been|proudly|recently|again|also)\s+)*(?:(?:listed|named|ranked|voted|recognized|recognised|selected|chosen|awarded|honored|honoured|featured)\s+(?:as\s+|in\s+|on\s+)?)?(?:(?:one of|among)\s+)?(?:the\s+)?(?:america'?s\s+)?/
export function awardKey(fact) {
  if (fact?.field !== 'award') return null
  const flat = String(fact.value ?? '').toLowerCase().replace(/[’‘`´]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
  const title = flat.replace(AWARD_LEAD, '').replace(/'/g, '').trim()
  return /[a-z]/.test(title) && /\b(?:19|20)\d{2}$/.test(title) ? `award|${title}` : null
}
// One key for "the same claim" everywhere (Your call, Ready to confirm, the fact sheet, the hero, the sources):
// the figure it states, else the award it names; null: it groups only with the same wording (dupKey)
export const claimKey = (fact) => figureKey(fact) ?? awardKey(fact)
// The merged facts (mergeFacts) that state the same figure or name the same award (claimKey), as one: → [{ id, lead,
// copies, ids, pages, wordings, keepIds, dropIds }] in first-seen order. wordings: the merged facts in it, the representative first (found on the
// most pages, distinct website evidence; a tie: the shortest value; then the first seen); lead and id are the
// representative's, its stored value shown character for character. keepIds: the representative's ids (what "Keep
// this one" or a Ready tick confirms); dropIds: the other wordings' ids (turned down with it). A fact on its own:
// wordings [itself], dropIds []. Only facts with the same status group (a kept wording and its turned-down
// siblings stay apart).
export function groupClaims(facts) {
  const by = new Map()
  for (const g of mergeFacts(facts)) {
    const fig = claimKey(g.lead)
    const k = fig ? `${g.lead.status}|${fig}` : `one|${g.id}`
    if (!by.has(k)) by.set(k, [])
    by.get(k).push(g)
  }
  return [...by.values()].map((list) => {
    const size = (g) => foundOnPages(g).length
    const rep = list.reduce((top, g) => (size(g) > size(top) || (size(g) === size(top) && String(g.lead.value).length < String(top.lead.value).length) ? g : top))
    const wordings = [rep, ...list.filter((g) => g !== rep)]
    const copies = wordings.flatMap((g) => g.copies)
    return {
      id: rep.id, lead: rep.lead, copies, wordings,
      ids: wordings.flatMap((g) => g.ids),
      keepIds: rep.ids,
      dropIds: wordings.slice(1).flatMap((g) => g.ids),
      pages: [...new Set(wordings.flatMap((g) => g.pages))],
    }
  })
}
// the other wordings of a grouped fact, each with the site pages it was found on: [{ id, value, pages }]
export const similarWordings = (g) => (g.wordings ?? []).slice(1).map((w) => ({ id: w.id, value: w.lead.value, pages: foundOnPages(w) }))

// ---- claims that can't both be true: "Over 20 years" next to "Established 2013" ------------------------------------
const yearsOf = (fact) => {
  const over = /over\s+(\d{1,2})\s+years/i.exec(fact.value)
  if (over) return { over: Number(over[1]) }
  const since = /(?:since|est\.?|established)\s+((?:19|20)\d{2})/i.exec(fact.value)
  return since ? { since: Number(since[1]) } : null
}
// app (owner, 2026-11-12): a grouped claim is read from its representative, else from the first of its wordings
// that says it ("20 years of experience" grouped with "Over 20 years")
const yearsOfGroup = (g) => (g.wordings ?? [g]).map((w) => yearsOf(w.lead)).find(Boolean) ?? null
// → [{ a, b, why }] among the given merged (or grouped) facts; readYear: the year the site was read
export function yearConflicts(merged, readYear) {
  const ys = merged.filter((g) => g.lead.field === 'years').map((g) => ({ g, y: yearsOfGroup(g) })).filter((x) => x.y)
  const out = []
  for (const a of ys.filter((x) => x.y.over)) {
    for (const b of ys.filter((x) => x.y.since)) {
      const age = readYear - b.y.since
      if (age < a.y.over) out.push({ a: a.g, b: b.g, why: `${b.g.lead.value} makes ${age} years, not over ${a.y.over}.` })
    }
  }
  return out
}

// a claim's key for "the same claim" across statuses: the figure or award (claimKey), else the wording (dupKey)
export const sameClaimKey = (fact) => claimKey(fact) ?? dupKey(fact)
const keysOf = (g) => (g.wordings ?? [g]).flatMap((w) => (w.copies ?? [w.lead]).map(sameClaimKey))
export const IN_USE = new Set(['CONFIRMED', 'ADDED_BY_YOU'])

// ---- the page's buckets ------------------------------------------------------------------------------------------
// → { merged, kept, rejected, removed, notFacts, hiddenTexts, conflicts, differs, ready, cards } (grouped facts, groupClaims,
// except notFacts)
// app (owner, 2026-11-12): every bucket holds grouped facts, so each count, the hero's segments and the fact sheet
// count one claim once however many wordings the site has
// app (owner, 2026-11-12): two facts in use that can't both be true (a removed one used again, or both confirmed
// before) are a decision again: in conflicts (reopened: true), not in kept, so the hero counts them under "needs your
// call" until one is kept. The route can't set a fact back to waiting, so the decision is worked out here.
// removed: the turned-down groups the fact sheet's "N removed" lists: only claims with nothing in use or waiting (a
// turned-down wording of a claim still in use, or waiting, is a duplicate, not a removal). Page texts never are.
export function bucketsOf(facts, readYear) {
  // page text counts as a fact only once someone confirmed it ("Use as a fact")
  const real = facts.filter((f) => !isPageText(f) || f.status === 'CONFIRMED')
  const merged = groupClaims(real)
  const pending = merged.filter((g) => g.lead.status === 'DISCOVERED')
  const inUse = merged.filter((g) => IN_USE.has(g.lead.status))
  // app (owner, 2026-11-12): two claims that can't both be true stay a contradiction whatever their status (both
  // waiting, both in use, or one of each); a hidden one is out of it. It was found only within the waiting claims and
  // within the claims in use, so confirming one side silently cleared it. reopened: both sides are in use.
  const conflicts = yearConflicts([...pending, ...inUse], readYear)
    .map((c) => ({ ...c, reopened: IN_USE.has(c.a.lead.status) && IN_USE.has(c.b.lead.status) }))
  const inConflict = new Set(conflicts.flatMap((c) => [c.a.id, c.b.id]))
  const differs = pending.filter((g) => verdictOf(g.lead) === 'differs' && !inConflict.has(g.id))
  const rejected = merged.filter((g) => g.lead.status === 'REJECTED')
  const active = new Set(merged.filter((g) => g.lead.status !== 'REJECTED').flatMap(keysOf))
  return {
    merged,
    kept: inUse.filter((g) => !inConflict.has(g.id)),
    rejected,
    removed: rejected.filter((g) => !keysOf(g).some((k) => active.has(k))),
    notFacts: facts.filter((f) => isPageText(f) && f.status === 'DISCOVERED'),
    hiddenTexts: hiddenTextsOf(facts),
    conflicts,
    differs,
    ready: pending.filter((g) => !inConflict.has(g.id) && verdictOf(g.lead) !== 'differs'),
    // one card per claim that names an outside source, rejected ones left out
    cards: merged.filter((g) => g.lead.status !== 'REJECTED' && sourceOf(g.lead)),
  }
}

// app (owner, 2026-11-12): page texts someone hid (turned down). "Use as a fact" turns the text down too, after adding
// it as a fact of its own: a text whose words are now a fact that isn't turned down isn't hidden, it was used.
const sameWords = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
export function hiddenTextsOf(facts) {
  const used = new Set(facts.filter((f) => !isPageText(f) && f.status !== 'REJECTED').map((f) => sameWords(f.value)))
  return facts.filter((f) => isPageText(f) && f.status === 'REJECTED' && !used.has(sameWords(f.value)))
}

// The fact in use that a turned-down claim would contradict if used again ("Established 2013" while "Over 20 years" is
// in use): → the in-use group, or null. Same rule as yearConflicts.
export function conflictOf(g, inUse, readYear) {
  const c = yearConflicts([g, ...inUse.filter((x) => x !== g)], readYear).find((x) => x.a === g || x.b === g)
  return c ? (c.a === g ? c.b : c.a) : null
}

// ---- Checked against outside sources: one row per source ---------------------------------------------------------
// app (owner, 2026-11-12): the cards (grouped claims that name a source) by their source (sourceOf: the outside
// evidence's host, else the kind), in first-seen order. Within a source, claims that state the same figure or the same
// award title are one claim (figureKey, else dupKey; the first one stands for it, its stored value shown whole).
//   result: 'differs' if any claim doesn't match; else 'agrees' if one matches; else 'unchecked' if the source was
//     tried and had nothing ("Not found"); else 'none' (no result to show, no line)
//   url: the source's page: the one URL its claims share, else the first claim's (null: the row isn't a link)
// → [{ key, src, claims: [{ g, result, url }], result, url, pages }]
export function sourceRows(cards) {
  const by = new Map()
  for (const g of cards) {
    const src = sourceOf(g.lead)
    if (!src) continue
    if (!by.has(src.domain)) by.set(src.domain, { key: src.domain, src, claims: [], seen: new Set() })
    const row = by.get(src.domain)
    const k = claimKey(g.lead) ?? dupKey(g.lead)
    if (row.seen.has(k)) continue
    row.seen.add(k)
    row.claims.push({ g, result: verdictOf(g.lead), url: outsideEvidence(g.lead)?.url ?? null })
  }
  return [...by.values()].map(({ seen, ...row }) => {
    const has = (r) => row.claims.some((c) => c.result === r)
    const urls = [...new Set(row.claims.map((c) => c.url).filter(Boolean))]
    return {
      ...row,
      result: has('differs') ? 'differs' : has('agrees') ? 'agrees' : has('unchecked') ? 'unchecked' : 'none',
      url: urls.length === 1 ? urls[0] : row.claims.find((c) => c.url)?.url ?? null,
      pages: [...new Set(row.claims.flatMap((c) => c.g.pages))],
    }
  })
}

// ---- pages read: grouped by the site's own sections (the first folder of the path) --------------------------------
export function sectionOf(url) {
  const seg = pathOf(url).split('/')[1]
  return seg ? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ') : 'Home'
}
export function pageSections(pages) {
  const by = new Map()
  for (const p of pages) {
    const s = sectionOf(p.url)
    if (!by.has(s)) by.set(s, [])
    by.get(s).push(p)
  }
  return [...by.entries()].map(([label, list]) => ({ label, pages: list }))
}
// ---- Where we read it: always four boxes (app, owner 2026-11-12) ---------------------------------------------------
// boxOf: the box a page belongs to. Home: the site root (or its index file). About: /about, /about-us, /our-story,
// /company, /who-we-are and anything under them (/about/our-story, /about-us/team). Contact: /contact, /contact-us,
// /support/contact, /locations and anything under them. Everything else: Other pages. Case doesn't matter, nor a
// trailing slash or a file extension (/about.html).
export const BOX_IDS = ['home', 'about', 'contact', 'other']
export const BOX_NAMES = { home: 'Home', about: 'About', contact: 'Contact', other: 'Other pages' }
const BOX_PATHS = {
  about: ['about', 'about-us', 'our-story', 'company', 'who-we-are'],
  contact: ['contact', 'contact-us', 'support/contact', 'locations'],
}
const FILE = /\.(?:html?|php|aspx?)$/
export function boxOf(url) {
  const path = pathOf(url).toLowerCase().replace(/\/index\.(?:html?|php|aspx?)$/, '')
  if (path === '/' || path === '') return 'home'
  const rest = path.slice(1)
  const bare = rest.replace(FILE, '')
  const under = (list) => list.some((x) => bare === x || rest.startsWith(`${x}/`))
  if (under(BOX_PATHS.about)) return 'about'
  if (under(BOX_PATHS.contact)) return 'contact'
  return 'other'
}
// What the hero counts, one unit each: a fact in use, a fact waiting, a fact whose source differs, and a contradiction
// (both its claims, once). Grouped facts (groupClaims), so a box's count agrees with the hero and the fact sheet.
// → [{ id, lead, pages, g? , pair? }] in the order the facts were first seen
export function factUnits(b) {
  const at = new Map(b.merged.map((g, i) => [g.id, i]))
  const one = (g) => ({ id: g.id, lead: g.lead, pages: g.pages, g })
  return [
    ...b.kept.map(one), ...b.ready.map(one), ...b.differs.map(one),
    ...b.conflicts.map((c) => ({ id: `c:${c.a.id}`, lead: c.a.lead, pages: [...new Set([...c.a.pages, ...c.b.pages])], pair: c })),
  ].sort((x, y) => (at.get(x.pair ? x.pair.a.id : x.id) ?? 0) - (at.get(y.pair ? y.pair.a.id : y.id) ?? 0))
}
// The four boxes, always in this order: Home · About · Contact · Other pages.
//   read: the box's pages that were read; failed: how many of its pages couldn't be read
//   facts: the units (factUnits) found on its read pages
//   state: 'facts' | 'empty' (read, nothing found) | 'unread' (no page of this kind was read)
//   Other pages: when one site section (sectionOf) holds more than 60% of its read pages, the box is named after it
//   ("Education"); count: that section's pages; others: the box's read pages outside it ("+N other pages")
export const NAME_SHARE = 0.6
export function whereBoxes(pages, units) {
  const by = Object.fromEntries(BOX_IDS.map((id) => [id, []]))
  for (const p of pages) by[boxOf(p.url)].push(p)
  return BOX_IDS.map((id) => {
    const list = by[id]
    const read = list.filter((p) => p.ok)
    const urls = new Set(read.map((p) => p.url))
    const facts = units.filter((u) => u.pages.some((x) => urls.has(x)))
    let label = BOX_NAMES[id]
    let count = read.length
    let others = 0
    if (id === 'other' && read.length) {
      const top = pageSections(read).reduce((a, s) => (s.pages.length > a.pages.length ? s : a))
      if (top.pages.length > NAME_SHARE * read.length) { label = top.label; count = top.pages.length; others = read.length - count }
    }
    return { id, label, count, others, pages: list, read, failed: list.length - read.length, facts, state: !read.length ? 'unread' : facts.length ? 'facts' : 'empty' }
  })
}
// app (owner, 2026-11-11): a merged fact's pages: the distinct site pages any of its copies was found on (every website
// evidence, so a footer phone counts each page it's on)
export const foundOnPages = (g) => [...new Set(g.copies.flatMap((c) => (c.evidence ?? []).filter((e) => !e.source_type || e.source_type === 'WEBSITE').map((e) => e.url)))]
export const pagesFoundOn = (g) => foundOnPages(g).length
// app (owner, 2026-11-11): kinds a business has one of. When Ready to confirm holds several values of one, only the
// value found on the most pages starts ticked (the first one on a tie); the others start unticked. A UI default only.
export const SINGLE_VALUE = ['brand_name', 'phone', 'email', 'address']
// AUD-018: an award with no outside evidence (nothing on a publisher's page backs it) or with no check result starts
// unticked too: the site says it won something, which isn't a fact to confirm for drafts until someone has looked.
export function spareValues(ready) {
  const spare = new Set()
  for (const g of ready) {
    if (g.lead.field !== 'award') continue
    const outside = (g.copies ?? [g.lead]).some((c) => outsideEvidence(c))
    if (!outside || verdictOf(g.lead) === 'none') spare.add(g.id)
  }
  for (const field of SINGLE_VALUE) {
    const same = ready.filter((g) => g.lead.field === field)
    if (same.length < 2) continue
    const best = same.reduce((top, g) => (pagesFoundOn(g) > pagesFoundOn(top) ? g : top))
    for (const g of same) if (g !== best) spare.add(g.id)
  }
  return spare
}
export const factsOnPage = (facts, url) => facts.filter((f) => !isPageText(f) && f.status !== 'REJECTED' && siteEvidence(f)?.url === url)

// ---- "Add a fact": the kinds the app accepts ----------------------------------------------------------------------
export const ADD_KINDS = [
  { group: 'About the business', items: [{ field: 'note', label: 'Fact', hint: 'Anything true about the business', category: 'custom' }] },
  { group: 'Contact', items: [
    { field: 'phone', label: 'Phone', hint: 'A number customers can call', category: 'contact' },
    { field: 'email', label: 'Email', hint: 'An address customers can write to', category: 'contact' },
    { field: 'address', label: 'Address', hint: 'Where the business is', category: 'contact' },
  ] },
]

// ---- Where we read it: why a box wasn't read (app, owner 2026-11-12) ------------------------------------------------
// Only what the read recorded, never an invented reason. pages: the box's pages the read tried (whereBoxes .pages).
//   nothing tried (no row recorded) → "We don't know why yet"
//   a tried page answered 401 / 403 / 429 → "The page blocked us"
//   another recorded error that means something → it in plain words; else "It couldn't be read"
const BLOCKED = new Set([401, 403, 429])
const statusOf = (p) => Number(p?.http_status) || Number(/^HTTP (\d{3})$/i.exec(String(p?.error ?? '').trim())?.[1]) || 0
export function plainReadError(p) {
  const st = statusOf(p)
  if (BLOCKED.has(st)) return 'The page blocked us'
  if (st === 404 || st === 410) return 'The page wasn’t found'
  if (st >= 500) return 'The site had an error'
  const e = String(p?.error ?? '').toLowerCase()
  if (/abort|timed? ?out/.test(e)) return 'The page took too long to answer'
  if (/pdf had no readable text/.test(e)) return 'It’s a PDF with no readable text'
  return null
}
export function unreadReason(pages) {
  const failed = (pages ?? []).filter((p) => !p.ok)
  if (!failed.length) return 'We don’t know why yet'
  if (failed.some((p) => BLOCKED.has(statusOf(p)))) return 'The page blocked us'
  for (const p of failed) { const said = plainReadError(p); if (said) return said }
  return 'It couldn’t be read'
}

// ---- "Fix this one" (app, owner 2026-11-12): where the site's sentence can be fixed ---------------------------------
// A WordPress site (lib/content-cms.js cmsLinkFor): its admin's search for the page's slug. Otherwise (or the home
// page, which has no slug to search): the live page, scrolled to the sentence with a text fragment (#:~:text=). A long
// quote is matched by its first and last words (start,end). No quote: the plain page.
const FRAG_WORDS = 5
const fragPart = (s) => encodeURIComponent(s).replace(/-/g, '%2D')
export function textFragmentOf(quote) {
  const words = String(quote ?? '').replace(/[“”"…]/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  if (words.length <= FRAG_WORDS * 2) return fragPart(words.join(' '))
  return `${fragPart(words.slice(0, FRAG_WORDS).join(' '))},${fragPart(words.slice(-FRAG_WORDS).join(' '))}`
}
export function fixLinkOf({ cms = null, domain = '', url = '', quote = '', cmsLink = null } = {}) {
  if (!url) return null
  if (cms === 'wordpress' && cmsLink && pathOf(url) !== '/') {
    const link = cmsLink({ cms, domain, url, action: 'update' })
    if (link?.href) return { href: link.href, tip: 'Open in WordPress (search)' }
  }
  const frag = textFragmentOf(quote)
  const page = String(url).replace(/#.*$/, '')
  return { href: frag ? `${page}#:~:text=${frag}` : page, tip: 'Open the page at this sentence' }
}

// ---- a page's short label (app, owner 2026-11-12): never a full URL as text --------------------------------------
// The site root → "Home page"; one folder → its name in plain words ("/education/" → "Education"); deeper → the first
// folder, then the last segment ("/education/data-retirement-debt/" → "Education · Data retirement debt"; a page three
// or more levels down keeps only its first folder and its own name). Plain words: URL-decoded, a file ending (.html,
// .php, .asp) dropped, hyphens and underscores to spaces, the first letter capital. Query and hash are ignored; no
// domain. Not a URL: the text as given.
const plainWords = (seg) => {
  let s = seg
  try { s = decodeURIComponent(seg) } catch { /* keep it as written */ }
  s = s.replace(/\.(?:html?|php|aspx?)$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}
export function pageLabelOf(url) {
  let u
  try { u = new URL(String(url ?? '')) } catch { return String(url ?? '') }
  const segs = u.pathname.split('/').filter(Boolean).map(plainWords).filter(Boolean)
  if (!segs.length) return 'Home page'
  return segs.length === 1 ? segs[0] : `${segs[0]} · ${segs[segs.length - 1]}`
}

// ---- "Why?" on a row that doesn't match (app, owner 2026-11-12): the two values that differ, from stored data only ---
// → { kind: 'a', site, source: { name, value }, compared, checkedAt }
//     the site against an outside source. compared: { site, source }, the part that was compared, when it can be
//     extracted cleanly: Trustpilot's compared rating ("4.7 / 5", sourceRatingOf); a number (from the source, numbers equal to the site's are dropped and a scale such as "/ 5"
//     isn't one; exactly one left on each side) or a BBB grade; else null, and the stored values are shown instead
//   | { kind: 'b', claims: [{ value, url }] }  two site claims that can't both be true (the years pair)
//   | { kind: 'c', site, source: { name, value: null } }  the check found a difference but stored no source value
// ctx: { partner } (the other claim of a contradiction, or null)
const GRADE = /\b[A-D][+-]?(?![A-Za-z])/
const numText = (s) => [...String(s ?? '').replace(/(?:\/|out of)\s*\d+(?:\.\d+)?/gi, ' ').matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0])
export function comparedValues(fact, snippet) {
  if (fact.field === 'bbb_rating') {
    const a = GRADE.exec(String(fact.value ?? ''))?.[0], b = GRADE.exec(String(snippet ?? '').replace(/\bBBB\b/g, ''))?.[0]
    return a && b && a !== b ? { site: a, source: b } : null
  }
  if (!RATING_FIELDS.has(fact.field)) return null // only a rating has one comparable number (an award title holds years and ranks)
  // Trustpilot: the rating the check compared ("4.7 / 5"), never another number in the stored text (owner, 2026-11-13)
  const rated = sourceRatingOf(fact, snippet)
  if (rated) {
    const site = numText(fact.value)
    return site.length === 1 ? { site: site[0], source: rated } : null
  }
  const site = numText(fact.value)
  const left = numText(snippet).filter((n) => !site.some((s) => Number(s) === Number(n)))
  return site.length === 1 && left.length === 1 ? { site: site[0], source: left[0] } : null
}
export function whyOf(fact, { partner = null } = {}) {
  const ev = (f) => (f.evidence ?? []).find((e) => !e.source_type || e.source_type === 'WEBSITE') ?? null
  if (partner) return { kind: 'b', claims: [fact, partner].map((f) => ({ value: f.value, url: ev(f)?.url ?? null })) }
  const out = (fact.evidence ?? []).find((e) => e.source_type && e.source_type !== 'WEBSITE') ?? null
  const name = sourceOf(fact)?.name ?? 'The source'
  if (!out?.snippet) return { kind: 'c', site: fact.value, source: { name, value: null } }
  return { kind: 'a', site: fact.value, source: { name, value: out.snippet }, compared: comparedValues(fact, out.snippet), checkedAt: out.captured_at ?? null }
}

// ---- every stored fact in exactly one result group (app, owner 2026-11-12): the hero's bar, the filters and the lists
// all read this, so they can't disagree. match: an outside check stored as matching; mismatch: a check stored as not
// matching, or one of two site claims that contradict each other (conflictIds), nothing else (owner, 2026-11-13: the
// page never compares the stored strings itself); unchecked: every other fact (no outside check, or a check that
// reached neither result, such as "Could not confirm").
// → { match, mismatch, unchecked } (arrays of the given facts, in their order)
const CHECKED = new Set(['agrees', 'differs', 'unchecked'])
export const hasOutsideCheck = (f) => !!outsideEvidence(f) || CHECKED.has(checkResultOf(f.notes))
export function resultGroupsOf(facts, conflictIds = new Set()) {
  const out = { match: [], mismatch: [], unchecked: [] }
  for (const f of facts) {
    const checked = hasOutsideCheck(f)
    const res = checkResultOf(f.notes)
    if (conflictIds.has(f.id) || (checked && res === 'differs')) out.mismatch.push(f)
    else if (checked && res === 'agrees') out.match.push(f)
    else out.unchecked.push(f)
  }
  return out
}

// ---- what an outside source says, in short (app, owner 2026-11-12): the preview's "Trustpilot · 4.7 / 5" -----------
// Trustpilot: the rating the check compared ("4.7 / 5", sourceRatingOf; owner, 2026-11-13). Else the compared value
// when one can be extracted (comparedValues: two BBB grades that differ), with the word right before it in the stored
// text when there is one; else the stored text without the source's own name at its start ("BBB rating A+ ·
// accredited" → "A+ · accredited") or a trailing "| Money" / "- Money" publisher suffix; else the stored text as is.
export function sourceShortOf(fact, snippet, name = '') {
  const text = String(snippet ?? '').trim()
  if (!text) return ''
  const rated = sourceRatingOf(fact, text)
  if (rated) return rated
  const c = comparedValues(fact, text)
  if (c) {
    const before = new RegExp(`([A-Za-z][A-Za-z-]*)\\s+${c.source.replace(/[.+]/g, '\\$&')}(?![\\d.])`).exec(text)
    return before && before[1].toLowerCase() !== String(name).toLowerCase() ? `${before[1]} ${c.source}` : c.source
  }
  const esc = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!esc) return text
  const short = text
    .replace(new RegExp(`^\\s*${esc}\\b(?:\\s+rating)?\\s*[:·-]?\\s*`, 'i'), '')
    .replace(new RegExp(`\\s*[|–-]\\s*${esc}\\s*$`, 'i'), '')
    .trim()
  return short || text
}

// ---- one row per claim (owner, 2026-11-13): no repeated facts -------------------------------------------------------
// Stored facts that state the same claim are one row: same kind and the same figure, rating, grade or award title
// (sameClaimKey: claimKey, else the same wording). A site claim that is a star rating ("4.7 stars by verified
// customers", "4.7 out of 5") is the Trustpilot rating with the same number when the site stores one, unless it names
// another platform (Google, Yelp, Facebook…): such a pair is left apart and listed in `unsure`. Values that differ
// never merge ("Established 2013" ≠ "Over 20 years"; the garbled "Best Companies 20264 …" has no award key). Page
// texts are never merged. Display only: stored facts are not changed.
// → { rows: [fact-shaped row], unsure: [{ a, b, why }] }. A row is the shortest wording's fact as stored, with:
//   value / id: the shortest wording's (non-hidden wordings first); status: To review if any wording waits, else In use
//   if any is in use, else hidden; notes / outside evidence: the wording whose outside check says most (doesn't match,
//   then matches, then could not confirm); evidence: the shown wording's site evidence first, then the others' site
//   pages, then the check's outside evidence; ids: every stored id in the row (actions apply to all);
//   wordings: the other wordings [{ id, value, status, pages }]
const STAR_RATING = /(\d(?:\.\d)?)\s*(?:\/\s*5\b|out of 5\b|stars?\b)/i
const OTHER_PLATFORM = /\b(google|yelp|facebook|bbb|better business|g2|capterra|zillow|lendingtree|consumer ?affairs|app store|play store)\b/i
const CHECK_RANK = { differs: 3, agrees: 2, unchecked: 1, none: 0 }
const statusRank = (s) => (s === 'DISCOVERED' ? 3 : IN_USE.has(s) ? 2 : 1)
export function claimRows(facts) {
  const list = facts ?? []
  const tpNumbers = new Set(list.filter((f) => f.field === 'trustpilot_rating').map((f) => Number(STAR_RATING.exec(f.value)?.[1] ?? /\d(?:\.\d+)?/.exec(f.value)?.[0])).filter((n) => !Number.isNaN(n)))
  const unsure = []
  const keyOf = (f) => {
    if (isPageText(f)) return `text|${f.id}`
    if (f.field !== 'trustpilot_rating' && f.field !== 'bbb_rating' && isClaim(f)) {
      const m = STAR_RATING.exec(String(f.value))
      if (m && tpNumbers.has(Number(m[1]))) {
        if (OTHER_PLATFORM.test(f.value)) {
          const tp = list.find((x) => x.field === 'trustpilot_rating')
          unsure.push({ a: f, b: tp, why: `"${f.value}" has Trustpilot's number but names another platform` })
          return `${f.field}|${f.id}`
        }
        return `trustpilot_rating|${sameClaimKey({ field: 'trustpilot_rating', value: m[1] })}`
      }
    }
    return `${f.field === 'trustpilot_rating' ? 'trustpilot_rating' : f.field}|${sameClaimKey(f)}`
  }
  const by = new Map()
  for (const f of list) {
    const k = keyOf(f)
    if (!by.has(k)) by.set(k, [])
    by.get(k).push(f)
  }
  const rows = [...by.values()].map((group) => {
    if (group.length === 1) return { ...group[0], ids: [group[0].id], wordings: [] }
    const visible = group.filter((f) => f.status !== 'REJECTED')
    const pool = visible.length ? visible : group
    const shown = pool.reduce((a, f) => (String(f.value).length < String(a.value).length ? f : a))
    const check = group.reduce((a, f) => ((CHECK_RANK[checkResultOf(f.notes)] ?? 0) + (outsideEvidence(f) ? 0.5 : 0) > (CHECK_RANK[checkResultOf(a.notes)] ?? 0) + (outsideEvidence(a) ? 0.5 : 0) ? f : a), shown)
    const status = group.reduce((a, f) => (statusRank(f.status) > statusRank(a) ? f.status : a), shown.status)
    const site = (f) => (f.evidence ?? []).filter((e) => !e.source_type || e.source_type === 'WEBSITE')
    const out = outsideEvidence(check)
    const field = group.find((f) => f.field === 'trustpilot_rating')?.field ?? shown.field
    return {
      ...shown, field, status, notes: check.notes, category: check.category ?? shown.category, source: check.source ?? shown.source,
      evidence: [...site(shown), ...group.filter((f) => f !== shown).flatMap(site), ...(out ? [out] : [])],
      ids: group.map((f) => f.id),
      wordings: group.filter((f) => f !== shown).map((f) => ({ id: f.id, value: f.value, status: f.status, pages: site(f).map((e) => e.url).filter(Boolean) })),
    }
  })
  return { rows, unsure }
}
