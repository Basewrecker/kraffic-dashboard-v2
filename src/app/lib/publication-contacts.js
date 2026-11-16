/**
 * Missed opportunities (Sentiment): where "Reach out" goes for a publication (owner, 2026-11-14; 2026-11-15: the lookup,
 * author pages, platform actions, "Find contact").
 *   - Reddit, YouTube and review sites aren't publications: the action on the cited page itself ("Reply on Trustpilot",
 *     "Reply in thread", "Comment on video", …), or the site's business reply page when no page is stored;
 *   - the cited article names an author with an author page on the same site (saved by the lookup) → "Author page";
 *   - a publication on the bundled list below → its hand-checked route (the bundled list always wins over the lookup);
 *   - else the route the background lookup found on the publication's own site (app/api/publication-contacts, saved per
 *     domain, re-checked every 30 days once found, after a day when nothing was found): "Contact page" (editorial or
 *     general contact), "Corrections", "Tips", "Press";
 *   - nothing found (or not looked up yet) → "Find contact": a web search for the publication's name + "contact editor".
 *   Never the home page and never the article itself.
 * The list is bundled with the app, like the known-source logos (lib/marketplace-logos.js). Every entry was opened in
 * Chrome for Testing and kept only if the page itself offers a way to contact the publication (a contact form, an email
 * address, or named editorial / press contacts) and isn't a 404, error page, login wall, paywall or the home page.
 * Editorial, corrections or press contacts are preferred over advertising sales or subscriber support. Re-check before
 * each release, on the owner's Mac: npm run verify:contacts.
 * kind: 'form' | 'email' | 'press contacts' · purpose: what the contact is for · verified: the date it was last checked ·
 * route (optional, default 'contact'): which button it is, named after the page it opens ('contact' | 'corrections' |
 * 'tips' | 'press' | 'letters' (a letters-to-the-editor page) | 'about' (an About us page with the contacts) |
 * 'support' (a support request form: "Support form", owner 2026-11-15)). Checked 2026-11-15 against the page
 * titles of the hand check: NYT → "Letter to the editor", Fortune and Byrdie → "About page", Medium and Investopedia →
 * support forms.
 */
import { knownSource } from './marketplace-logos'

export const PUBLICATION_CONTACTS = [
  { domain: 'forbes.com', name: 'Forbes', url: 'https://www.forbes.com/contact/', kind: 'email', purpose: 'editorial / corrections', verified: '2026-11-14', seen: 'Contact Information: an Editorial section with corrections@ and readers@ addresses' },
  { domain: 'newsweek.com', name: 'Newsweek', url: 'https://www.newsweek.com/contact', kind: 'email', purpose: 'editorial', verified: '2026-11-14', seen: 'Contact Us: submissions (op-eds), corrections link, licensing and support addresses' },
  { domain: 'fortune.com', name: 'Fortune', url: 'https://fortune.com/about-us/', kind: 'press contacts', purpose: 'editorial / press', route: 'about', verified: '2026-11-14', seen: 'About us masthead: named editors and the SVP of Communications, with email links' },
  { domain: 'jdpower.com', name: 'J.D. Power', url: 'https://www.jdpower.com/business/contact/', kind: 'email', purpose: 'press', verified: '2026-11-14', seen: 'How can we help?: a Media Inquiries card that emails media relations' },
  { domain: 'nerdwallet.com', name: 'NerdWallet', url: 'https://www.nerdwallet.com/press', kind: 'email', purpose: 'press', route: 'press', verified: '2026-11-14', seen: 'Press: "Looking for a source?" with press@nerdwallet.com and its spokespeople' },
  { domain: 'allure.com', name: 'Allure', url: 'https://www.allure.com/contact', kind: 'email', purpose: 'editorial', verified: '2026-11-14', seen: 'Contact Us: letters@allure.com for the editors (also licensing and ad sales)' },
  { domain: 'byrdie.com', name: 'Byrdie', url: 'https://www.byrdie.com/about-us-4776890', kind: 'email', purpose: 'press', route: 'about', verified: '2026-11-14', seen: 'About Us: press@byrdie.com and contact@byrdie.com' },
  { domain: 'bloomberg.com', name: 'Bloomberg', url: 'https://www.bloomberg.com/tips/', kind: 'email', purpose: 'editorial (news tips)', route: 'tips', verified: '2026-11-14', seen: 'Submit a tip to Bloomberg News: email, Signal and post' },
  { domain: 'nytimes.com', name: 'The New York Times', url: 'https://help.nytimes.com/115014925288-Submit-a-Letter-to-The-Editor', kind: 'press contacts', purpose: 'editorial (letters to the editor)', route: 'letters', verified: '2026-11-15', seen: 'Submit a Letter to The Editor: letters@, editorial@ and corrections@nytimes.com, the named letters editor (nytimes.com/tips also passes; the help centre contact pages have no form or address of their own)' },
  { domain: 'medium.com', name: 'Medium', url: 'https://help.medium.com/hc/en-us/requests/new', kind: 'email', purpose: 'general (support; no editorial contact: Medium stories are by their own authors)', route: 'support', verified: '2026-11-15', seen: 'Contact Medium Support: topics that open a request form, answered by email; Trust & Safety addresses (copyright@, privacy@medium.com)' },
  { domain: 'investopedia.com', name: 'Investopedia', url: 'https://support.investopedia.com/contactus', kind: 'form', purpose: 'general (no editorial contact found)', route: 'support', verified: '2026-11-14', seen: 'Submit a request: a contact form (email, subject, message)' },
]

// review and community sites aren't publications: the place to respond is the cited page itself (a review, a thread, a
// video); business: the site's business reply page, used only when no page is stored
export const PLATFORM_ACTIONS = {
  'trustpilot.com': { label: 'Reply on Trustpilot', noun: 'review', business: 'https://business.trustpilot.com/' },
  'bbb.org': { label: 'Respond on BBB', noun: 'page' },
  'consumeraffairs.com': { label: 'Respond on ConsumerAffairs', noun: 'review page' },
  'reddit.com': { label: 'Reply in thread', noun: 'thread' },
  'youtube.com': { label: 'Comment on video', noun: 'video' },
  'youtu.be': { label: 'Comment on video', noun: 'video' },
  'yelp.com': { label: 'Respond on Yelp', noun: 'page', business: 'https://biz.yelp.com/' },
  'glassdoor.com': { label: 'Respond on Glassdoor', noun: 'page', business: 'https://www.glassdoor.com/employers/' },
  'sitejabber.com': { label: 'Reply on Sitejabber', noun: 'review page' },
  'g2.com': { label: 'Respond on G2', noun: 'review page' },
  'capterra.com': { label: 'Respond on Capterra', noun: 'review page' },
  'tripadvisor.com': { label: 'Respond on Tripadvisor', noun: 'page' },
}
export const PAGE_PLATFORMS = Object.keys(PLATFORM_ACTIONS)

const hostOf = (value) => {
  const s = String(value ?? '').trim().toLowerCase()
  if (!s) return ''
  return s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0].split('@').pop().replace(/:\d+$/, '').replace(/\.$/, '').replace(/^www\./, '')
}
const within = (host, domain) => host === domain || host.endsWith(`.${domain}`)

export const contactFor = (domainOrUrl) => {
  const h = hostOf(domainOrUrl)
  return h ? PUBLICATION_CONTACTS.find((c) => within(h, c.domain)) ?? null : null
}
export const isPagePlatform = (domainOrUrl) => {
  const h = hostOf(domainOrUrl)
  return Boolean(h) && PAGE_PLATFORMS.some((p) => within(h, p))
}
// app (owner, 2026-11-14): proper names for known publications that aren't on the contact list or the bundled logo
// list (lib/marketplace-logos.js KNOWN_SOURCES already names Trustpilot, BBB, CNBC, Bankrate, Investopedia and the rest)
export const PUBLICATION_NAMES = {
  'nytimes.com': 'The New York Times', 'youtube.com': 'YouTube', 'youtu.be': 'YouTube', 'medium.com': 'Medium',
  'consumeraffairs.com': 'ConsumerAffairs', 'reddit.com': 'Reddit', 'wirecutter.com': 'Wirecutter',
  'healthline.com': 'Healthline', 'sitejabber.com': 'Sitejabber', 'g2.com': 'G2', 'capterra.com': 'Capterra',
  'tripadvisor.com': 'Tripadvisor', 'wsj.com': 'The Wall Street Journal', 'washingtonpost.com': 'The Washington Post',
  'cnn.com': 'CNN', 'reuters.com': 'Reuters', 'apnews.com': 'AP News', 'businessinsider.com': 'Business Insider',
  'marketwatch.com': 'MarketWatch', 'kiplinger.com': 'Kiplinger', 'aarp.org': 'AARP', 'quora.com': 'Quora',
}
// a publication's display name: the contact list's, the names above, the known-source logos' ("Forbes", "BBB"), else
// its domain without "www." (never a name built from the domain)
export const publicationName = (domainOrUrl) => {
  const h = hostOf(domainOrUrl)
  const named = Object.keys(PUBLICATION_NAMES).find((d) => within(h, d))
  return contactFor(h)?.name ?? (named ? PUBLICATION_NAMES[named] : null) ?? knownSource(h)?.name ?? h
}

export const platformFor = (domainOrUrl) => {
  const h = hostOf(domainOrUrl)
  const key = h ? PAGE_PLATFORMS.find((p) => within(h, p)) : null
  return key ? { domain: key, ...PLATFORM_ACTIONS[key] } : null
}

// the button's words per kind ("labels say where they lead"); an editorial or advertising contact page is a contact page,
// a support request form says "Support form" (owner, 2026-11-15); letters, about and support are only set on the bundled list
export const REACH_LABELS = {
  editorial: 'Contact page', contact: 'Contact page', corrections: 'Corrections', tips: 'Tips', press: 'Press',
  advertise: 'Contact page', letters: 'Letter to the editor', about: 'About page', support: 'Support form',
  author: 'Author page', search: 'Find contact',
}
const ROUTE_TIP = {
  editorial: 'editorial contact page', contact: 'contact page', corrections: 'corrections page', tips: 'news tips page',
  press: 'press page', advertise: 'advertising contact page', letters: 'letter-to-the-editor page',
  about: 'About us page', support: 'support request form',
}
const ROUTES = new Set(Object.keys(ROUTE_TIP))
const httpUrl = (u) => { try { return /^https?:$/.test(new URL(String(u)).protocol) } catch { return false } }
// "Find contact": a web search for the publication's name plus "contact editor"
export const findContactUrl = (name) => `https://www.google.com/search?q=${encodeURIComponent(`${name} contact editor`)}`

/**
 * page: { url, domain } (a Sentiment page); found (optional, from app/api/publication-contacts): { contact: { contactUrl,
 * kind, status }, author: { authorUrl, authorName, status } } → { href, kind, label, tip }
 * kind: 'platform' | 'author' | 'editorial' | 'contact' | 'corrections' | 'tips' | 'press' | 'advertise' | 'search'
 */
// owner, 2026-11-15: the button keeps its old fixed width, so long labels are shortened on it ("Respond", "Reply",
// "Comment", "Letter"); the tooltip gives the full destination. The label (full) stays for the CSV.
const SHORT = [[/^Respond on /, 'Respond'], [/^Reply (on|in) /, 'Reply'], [/^Comment on /, 'Comment'], [/^Letter to the editor$/, 'Letter']]
export const buttonLabel = (label) => SHORT.find(([re]) => re.test(String(label || '')))?.[1] ?? label

export function reachOutFor(page, found = null) {
  const domain = hostOf(page?.domain || page?.url)
  const name = publicationName(domain)
  const platform = platformFor(domain)
  if (platform) {
    if (page?.url && httpUrl(page.url)) return { href: page.url, kind: 'platform', label: platform.label, tip: platform.label }
    if (platform.business) return { href: platform.business, kind: 'platform', label: platform.label, tip: `${platform.label} (business page)` }
  }
  const author = found?.author
  if (!platform && author?.status === 'found' && httpUrl(author.authorUrl) && within(hostOf(author.authorUrl), domain)) {
    return { href: author.authorUrl, kind: 'author', label: REACH_LABELS.author, tip: author.authorName ? `Opens ${author.authorName}’s author page on ${name}` : `Opens the author’s page on ${name}` }
  }
  const c = platform ? null : contactFor(domain)
  if (c) {
    const kind = ROUTES.has(c.route) ? c.route : 'contact'
    return { href: c.url, kind, label: REACH_LABELS[kind], tip: kind === 'letters' ? `Submit a letter to the editor, ${name}` : `Opens ${name}’s ${ROUTE_TIP[kind]}` }
  }
  const looked = found?.contact
  if (!platform && looked?.status === 'found' && ROUTES.has(looked.kind) && httpUrl(looked.contactUrl) && within(hostOf(looked.contactUrl), domain)) {
    return { href: looked.contactUrl, kind: looked.kind, label: REACH_LABELS[looked.kind], tip: looked.kind === 'letters' ? `Submit a letter to the editor, ${name}` : `Opens ${name}’s ${ROUTE_TIP[looked.kind]}` }
  }
  return { href: findContactUrl(name || domain), kind: 'search', label: REACH_LABELS.search, tip: `Searches the web for ${name || domain}’s editor contact` }
}
