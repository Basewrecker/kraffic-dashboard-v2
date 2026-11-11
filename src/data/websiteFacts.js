// Website facts (Optimize → Website facts; the app's feature is Harsh's: lib/website-facts.js, lib/website-fact-claims.js,
// migrations 014 / 015). The mock keeps the app's shapes and its four actions (confirm, reject, add a fact, read the
// website again) on sample data, and adds the rules this page's design needs. Every rule reads only fields the app has:
//   fact  { id, category, field, value, status, source, notes, evidence[{ url, page_title, snippet, source_type }] }
//   page  { id, url, title, http_status, words, ok, error, fetched_at }
// No React and no window here, so the tests can import it.

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

// What the outside check said, from the note the app writes: 'agrees' | 'differs' | 'unchecked' (null: not a claim)
export function verdictOf(fact) {
  if (!isClaim(fact)) return null
  const n = String(fact.notes ?? '')
  if (/matches|appears on the list/i.test(n)) return 'agrees'
  if (/site claims|differs/i.test(n)) return 'differs'
  return 'unchecked'
}
export const VERDICT_WORD = { agrees: 'Agrees', differs: 'Differs', unchecked: 'Not checked' }

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

// A fact's short name for a tight row: "Trustpilot 4.6 / 5", "TIME Best Companies 2024"; otherwise the value itself
export function shortName(fact) {
  const v = String(fact.value)
  if (fact.field === 'trustpilot_rating') return `Trustpilot ${v.match(/\d(?:\.\d)?/)?.[0] ?? ''} / 5`
  if (fact.field === 'bbb_rating') return `BBB ${v.match(/\b[A-D][+-]?(?![a-z])/)?.[0] ?? ''}${/accredited/i.test(v) ? ', accredited' : ''}`
  if (fact.field === 'award') {
    const core = /Best\s+[A-Z][^.,;:]*?(?:19|20)\d{2}/.exec(v)?.[0]
    const src = sourceOf(fact)
    if (core) return src ? `${src.name} ${core}` : core
  }
  return v
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
  award: /(?:America['’]s\s+)?Best\s+[A-Z][^.,;:]*?(?:19|20)\d{2}/,
}
export function claimParts(fact) {
  const text = siteEvidence(fact)?.snippet ?? fact.value
  const m = CLAIM_RE[fact.field]?.exec(text)
  return m ? [text.slice(0, m.index), m[0], text.slice(m.index + m[0].length)] : ['', text, '']
}

// Where a claim and its source part ways: the characters after their common start ("A+" against "A" → the "+").
// → { site: [before, differing, after] of the claim, source: [before, differing, after] of the source's value } | null
const TOKEN = { bbb_rating: /\b[A-D][+-]?(?![a-z])/, trustpilot_rating: /\d(?:\.\d)?/ }
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
  return { site: cut(claim, a), source: cut(out.snippet, b) }
}

// ---- duplicates: the same rating or award found more than once, in different words ---------------------------------
const STOP = new Set(['s', 'a', 'an', 'the', 'to', 'of', 'by', 'in', 'on', 'as', 'for', 'and', 'named', 'awarded', 'recognized', 'rated', 'list', 'out', 'excellent'])
const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9.+ ]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w))
export function dupKey(fact) {
  const v = String(fact.value)
  if (fact.field === 'trustpilot_rating') return `trustpilot|${v.match(/\d(?:\.\d)?/)?.[0] ?? v.toLowerCase()}`
  if (fact.field === 'bbb_rating') return `bbb|${v.match(/\b[A-D][+-]?(?![a-z])/)?.[0] ?? ''}|${/accredited/i.test(v) ? 'acc' : ''}`
  if (fact.field === 'award') return `award|${[...new Set(words(v))].sort().join(' ')}`
  return `${fact.field}|${words(v).join(' ')}`
}
// → [{ id (the first copy's), lead, copies, ids, pages (the site pages it was found on) }], in first-seen order
export function mergeFacts(facts) {
  const by = new Map()
  for (const f of facts) {
    const k = dupKey(f)
    if (!by.has(k)) by.set(k, { id: f.id, lead: f, copies: [] })
    by.get(k).copies.push(f)
  }
  return [...by.values()].map((g) => ({
    ...g,
    ids: g.copies.map((c) => c.id),
    pages: [...new Set(g.copies.map((c) => siteEvidence(c)?.url).filter(Boolean))],
  }))
}

// ---- claims that can't both be true: "Over 20 years" next to "Established 2013" ------------------------------------
const yearsOf = (fact) => {
  const over = /over\s+(\d{1,2})\s+years/i.exec(fact.value)
  if (over) return { over: Number(over[1]) }
  const since = /(?:since|est\.?|established)\s+((?:19|20)\d{2})/i.exec(fact.value)
  return since ? { since: Number(since[1]) } : null
}
// → [{ a, b, why }] among the given merged facts; readYear: the year the site was read
export function yearConflicts(merged, readYear) {
  const ys = merged.filter((g) => g.lead.field === 'years').map((g) => ({ g, y: yearsOf(g.lead) })).filter((x) => x.y)
  const out = []
  for (const a of ys.filter((x) => x.y.over)) {
    for (const b of ys.filter((x) => x.y.since)) {
      const age = readYear - b.y.since
      if (age < a.y.over) out.push({ a: a.g, b: b.g, why: `${b.g.lead.value} makes ${age} years, not over ${a.y.over}.` })
    }
  }
  return out
}

// ---- the page's buckets ------------------------------------------------------------------------------------------
// → { merged, kept, rejected, notFacts, conflicts, differs, ready, cards } (merged facts, except notFacts)
export function bucketsOf(facts, readYear) {
  // page text counts as a fact only once someone confirmed it ("Use as a fact")
  const real = facts.filter((f) => !isPageText(f) || f.status === 'CONFIRMED')
  const merged = mergeFacts(real)
  const pending = merged.filter((g) => g.lead.status === 'DISCOVERED')
  const conflicts = yearConflicts(pending, readYear)
  const inConflict = new Set(conflicts.flatMap((c) => [c.a.id, c.b.id]))
  const differs = pending.filter((g) => verdictOf(g.lead) === 'differs' && !inConflict.has(g.id))
  return {
    merged,
    kept: merged.filter((g) => g.lead.status === 'CONFIRMED' || g.lead.status === 'ADDED_BY_YOU'),
    rejected: merged.filter((g) => g.lead.status === 'REJECTED'),
    notFacts: facts.filter((f) => isPageText(f) && f.status === 'DISCOVERED'),
    conflicts,
    differs,
    ready: pending.filter((g) => !inConflict.has(g.id) && verdictOf(g.lead) !== 'differs'),
    // one card per claim that names an outside source, rejected ones left out
    cards: merged.filter((g) => g.lead.status !== 'REJECTED' && sourceOf(g.lead)),
  }
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

// ---- sample data (a made-up brand; never a client's) ---------------------------------------------------------------
export const READ_AT = '2026-11-10T09:24:00Z'
const PAGES = [
  ['/', 'Dermatologist-developed skincare', 5400],
  ['/products', 'All products', 3100], ['/products/vitamin-c-serum', 'Vitamin C Serum', 4200], ['/products/hyaluronic-serum', 'Hyaluronic Acid Serum', 3900],
  ['/products/mineral-sunscreen', 'Mineral Sunscreen SPF 50', 4600], ['/products/gentle-cleanser', 'Gentle Cleanser', 2800], ['/products/barrier-cream', 'Barrier Cream', 3300],
  ['/products/retinol-night', 'Retinol Night Treatment', 3700], ['/products/eye-gel', 'Eye Gel', 1900], ['/products/toner', 'Balancing Toner', 2100],
  ['/products/starter-set', 'Starter Set', 2500], ['/products/body-lotion', 'Body Lotion', 1700], ['/products/lip-balm', 'Lip Balm', 1200], ['/products/gift-card', 'Gift card', 800],
  ['/blog', 'The Journal', 2600], ['/blog/how-to-layer-serums', 'How to layer serums', 6100], ['/blog/vitamin-c-guide', 'A guide to vitamin C', 7400],
  ['/blog/sunscreen-myths', 'Seven sunscreen myths', 5200], ['/blog/sensitive-skin-routine', 'A routine for sensitive skin', 5800], ['/blog/retinol-basics', 'Retinol basics', 4900],
  ['/blog/hydration-vs-moisture', 'Hydration vs moisture', 4300], ['/blog/ingredients-we-avoid', 'Ingredients we avoid', 3600], ['/blog/winter-skin', 'Winter skin', 3200],
  ['/blog/derm-q-and-a', 'Questions for our dermatologists', 6800], ['/blog/packaging-update', 'Our new packaging', 1800], ['/blog/2019-archive', null, 0, 404, 'The page answered 404'],
  ['/about', 'About us', 3400], ['/about/our-story', 'Our story', 4100], ['/about/press', 'Press and awards', 2900], ['/about/science', 'The science', 5100], ['/about/reviews', 'Customer reviews', 3800],
  ['/help', 'Help centre', 1600], ['/help/contact', 'Contact us', 900], ['/help/shipping', 'Shipping', 2200], ['/help/returns', 'Returns', 2000],
  ['/help/faq', 'Questions and answers', 4700], ['/help/store-locator', null, 0, null, 'The page took too long to answer'], ['/help/wholesale', 'Wholesale', 1400],
  ['/privacy', 'Privacy policy', 6200], ['/terms', 'Terms of sale', 5600],
]
export const samplePages = (domain) => PAGES.map(([path, title, words, status = 200, error = null], i) => ({
  id: `p${i + 1}`, url: `https://${domain}${path}`, title, http_status: status, words, ok: !error, error, fetched_at: READ_AT,
}))

export function sampleFacts(domain, name) {
  const at = (path) => `https://${domain}${path}`
  const site = (path, page_title, snippet) => ({ url: at(path), page_title, snippet, source_type: 'WEBSITE' })
  const f = (id, category, field, value, o = {}) => ({ id, category, field, value, status: 'DISCOVERED', source: category === 'claim' ? 'WEBSITE_CLAIM' : 'WEBSITE_READ', notes: null, evidence: [], ...o })
  const TIME_NOTE = 'Checked on the publisher page — the brand appears on the list.'
  const TIME_EV = { url: 'https://time.com/collection/americas-best-companies-2024/', page_title: 'America’s Best Companies 2024', snippet: `${name} is on the list`, source_type: 'AWARD_PAGE' }
  const TP_NOTE = 'Checked on Trustpilot: 4.6 / 5 — matches the site.'
  const TP_EV = { url: `https://www.trustpilot.com/review/${domain}`, page_title: `${name} reviews`, snippet: '4.6 / 5', source_type: 'TRUSTPILOT' }
  const MONEY_NOTE = 'Award claim found on the site; could not confirm it on a publisher page automatically.'
  const YEARS_NOTE = 'Longevity claim on the site. No independent registry check yet — confirm against founding filings or About.'
  const OTHER_NOTE = 'Claim found on the site; no automatic third-party check for this kind yet.'
  return [
    f('f1', 'identity', 'brand_name', name, { evidence: [site('/', 'Home', `${name}: dermatologist-developed skincare.`)] }),
    f('f2', 'contact', 'phone', '(512) 555-0142', { evidence: [site('/help/contact', 'Contact us', 'Call us on (512) 555-0142, Monday to Friday.')] }),
    f('f3', 'contact', 'email', `care@${domain}`, { evidence: [site('/help/contact', 'Contact us', `Write to care@${domain} and we’ll reply within a day.`)] }),
    f('f4', 'contact', 'address', '410 Congress Ave, Austin, TX 78701', { evidence: [site('/help/contact', 'Contact us', 'Visit us at 410 Congress Ave, Austin, TX 78701.')] }),
    f('f5', 'page', 'title', `${name} | Dermatologist-developed skincare`, { evidence: [site('/', 'Home', `${name} | Dermatologist-developed skincare`)] }),
    f('f6', 'page', 'description', 'Clean, clinically tested skincare for sensitive skin. Free shipping over $60.', { evidence: [site('/', 'Home', 'Clean, clinically tested skincare for sensitive skin.')] }),
    f('f7', 'page', 'heading', 'Skin that feels like yours again', { evidence: [site('/', 'Home', 'Skin that feels like yours again')] }),
    // matched by the source: the app confirms these on its own
    f('f8', 'claim', 'trustpilot_rating', 'Trustpilot 4.6 / 5', { status: 'CONFIRMED', notes: TP_NOTE, evidence: [site('/', 'Home', 'Rated Excellent, 4.6 out of 5 on Trustpilot by verified customers.'), TP_EV] }),
    f('f9', 'claim', 'trustpilot_rating', 'Rated 4.6 out of 5 on Trustpilot', { status: 'CONFIRMED', notes: TP_NOTE, evidence: [site('/about/reviews', 'Customer reviews', 'Our customers rate us 4.6 out of 5 on Trustpilot.'), TP_EV] }),
    f('f10', 'claim', 'bbb_rating', 'A+ rated and accredited by the BBB', {
      notes: 'Checked on BBB: BBB rating A, accredited — site claims “A+ rated and accredited by the BBB”.',
      evidence: [site('/about', 'About us', 'We’re proud to be A+ rated and accredited by the BBB.'), { url: 'https://www.bbb.org/us/tx/austin/profile/skin-care/sample-0825', page_title: 'BBB business profile', snippet: 'A, accredited', source_type: 'BBB' }],
    }),
    f('f11', 'claim', 'award', 'TIME America’s Best Companies 2024', { status: 'CONFIRMED', notes: TIME_NOTE, evidence: [site('/', 'Home', 'Named one of TIME’s America’s Best Companies 2024.'), TIME_EV] }),
    f('f12', 'claim', 'award', 'Named to TIME’s America’s Best Companies 2024', { status: 'CONFIRMED', notes: TIME_NOTE, evidence: [site('/about', 'About us', 'In 2024 we were named to TIME’s list, America’s Best Companies 2024.'), TIME_EV] }),
    f('f13', 'claim', 'award', 'America’s Best Companies 2024, TIME', { status: 'CONFIRMED', notes: TIME_NOTE, evidence: [site('/about/press', 'Press and awards', 'TIME: America’s Best Companies 2024.'), TIME_EV] }),
    f('f14', 'claim', 'award', 'Money Best Clean Skincare Brand 2025', { notes: MONEY_NOTE, evidence: [site('/', 'Home', 'Money’s Best Clean Skincare Brand 2025.')] }),
    f('f15', 'claim', 'award', 'Best Clean Skincare Brand 2025, Money', { notes: MONEY_NOTE, evidence: [site('/about/press', 'Press and awards', 'Money magazine: Best Clean Skincare Brand 2025.')] }),
    f('f16', 'claim', 'years', 'Over 20 years', { notes: YEARS_NOTE, evidence: [site('/', 'Home', 'Trusted by dermatologists for over 20 years.')] }),
    f('f17', 'claim', 'years', 'Established 2013', { notes: YEARS_NOTE, evidence: [site('/about/our-story', 'Our story', 'Established 2013 in a small lab in Austin, Texas.')] }),
    f('f18', 'claim', 'accreditation', 'Leaping Bunny certified', { notes: OTHER_NOTE, evidence: [site('/about/science', 'The science', 'Every product is Leaping Bunny certified cruelty-free.')] }),
    f('f19', 'claim', 'claim', 'Over 2 million bottles sold', { notes: OTHER_NOTE, evidence: [site('/', 'Home', 'Over 2 million bottles sold, and counting.')] }),
    f('f20', 'claim', 'claim', 'Recommended by 9 in 10 dermatologists we surveyed', { notes: OTHER_NOTE, evidence: [site('/products/vitamin-c-serum', 'Vitamin C Serum', 'Recommended by 9 in 10 dermatologists we surveyed.')] }),
    f('f21', 'custom', 'note', 'Free shipping over $60', { status: 'ADDED_BY_YOU', source: 'YOU' }),
  ]
}
