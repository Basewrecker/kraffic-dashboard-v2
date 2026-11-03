// Display name for a brand domain: cerave.com → "CeraVe".
// Data, keys, links, colors and CSV keep the raw domain; only the visible label goes through this.
// names that can't be read off the domain
const KNOWN = {
  'cerave.com': 'CeraVe', 'theordinary.com': 'The Ordinary', 'paulaschoice.com': 'Paula’s Choice',
  'laroche-posay.us': 'La Roche-Posay', 'supergoop.com': 'Supergoop!', 'eltamd.com': 'EltaMD',
  'firstaidbeauty.com': 'First Aid Beauty', 'drunkelephant.com': 'Drunk Elephant',
  // the many-competitor history preview (?history=many)
  'financeofamerica.com': 'Finance of America', 'rocketmortgage.com': 'Rocket Mortgage',
  'mutualofomahamortgage.com': 'Mutual of Omaha Mortgage', 'aag.com': 'American Advisors Group',
  'longbridge-financial.com': 'Longbridge Financial', 'libertyreverse.com': 'Liberty Reverse Mortgage',
  'guildmortgage.com': 'Guild Mortgage Company',
  // ?competitors=many: the extra competitors with a name set in Brand Setup (byoma.com, versedskin.com and
  // good-molecules.com have none: their domain is tidied, as brandListName below does)
  'glowrecipe.com': 'Glow Recipe', 'naturium.com': 'Naturium', 'inkeylist.com': 'The INKEY List',
}
// two-part TLDs: "shop.renpho.co.uk" → "renpho"
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu'])
// empty → ''; a URL or host → its site name; a plain name (no dot) → as given
export function brandName(domain) {
  const raw = String(domain ?? '').trim()
  if (!raw) return ''
  const host = raw.replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0].toLowerCase()
  if (KNOWN[host]) return KNOWN[host]
  if (!host.includes('.')) return raw // a name, not a domain
  const parts = host.split('.').filter(Boolean)
  const drop = parts.length >= 3 && SECOND_LEVEL.has(parts[parts.length - 2]) ? 2 : 1
  const base = parts[parts.length - drop - 1] ?? parts[0] ?? ''
  return base.split(/[-_]/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// true for labels that are domains ("theordinary.com"), false for plain labels ("Category pages")
export const isDomain = (label) => /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(label)

// ---- a brand's list name (ported from the app's lib/citation-rules.js brandListName, 2026-11-02) -------------------
// The name Brand Setup / competitor settings hold; only with no name set, the domain tidied ("longbridge-financial.com"
// → "Longbridge Financial"; "rocketmortgage.com" → "Rocketmortgage", as no word split is possible without a name).
// Share of voice's list and the account picker name brands this way. Display only: data keeps the domain.
const hostOf = (value) =>
  value ? String(value).replace(/^[a-z]+:\/\//i, '').replace(/^www\./, '').split(/[/?#]/)[0].toLowerCase() : null
export const looksLikeDomain = (v) => /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+\/?$/i.test(String(v || '').trim())
// a domain → its site name, words capitalised: www. and the TLD dropped, hyphens and underscores as spaces
export function cleanDomainName(domainOrUrl) {
  const host = (hostOf(domainOrUrl) || String(domainOrUrl || '')).replace(/^www\./i, '').toLowerCase()
  const parts = host.split('.').filter(Boolean)
  if (!parts.length) return ''
  const drop = parts.length >= 3 && SECOND_LEVEL.has(parts[parts.length - 2]) ? 2 : parts.length > 1 ? 1 : 0
  const label = parts[parts.length - drop - 1] || parts[0]
  return label.split(/[-_]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
// a stored name written all in lower case ("rocketmortgage", "longbridge-financial") reads as a slug: title-cased
const titleCase = (n) => n.split(/[-_\s]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
// stored names → the first real name (a name that's a domain counts as none), else the domain tidied
export function resolveBrandName(stored, domain) {
  const names = (stored || []).map((n) => String(n || '').trim()).filter(Boolean)
  const named = names.find((n) => !looksLikeDomain(n))
  if (named) return named === named.toLowerCase() && /[a-z]/.test(named) ? titleCase(named) : named
  return cleanDomainName(domain || names[0] || '')
}
// stored: the names on record ([name] or [display name, brand name…], empty when none is set); domain: the brand's site.
// A stored name that's a domain ("financeofamerica.com") or the domain's slug ("Longbridge-financial": no space, a
// hyphen or underscore, the same letters as the site's name) counts as no name.
export function brandListName(stored, domain) {
  const names = (stored || []).map((n) => String(n || '').trim()).filter(Boolean)
  const host = looksLikeDomain(domain) ? hostOf(domain) : null
  const tidy = host ? cleanDomainName(host) : ''
  const letters = (n) => n.toLowerCase().replace(/[-_\s]+/g, '')
  const slugOfSite = (n) => Boolean(tidy) && !/\s/.test(n) && /[-_]/.test(n) && letters(n) === letters(tidy)
  const named = names.filter((n) => !looksLikeDomain(n) && !slugOfSite(n))
  if (named.length) return resolveBrandName(named, host)
  return tidy || resolveBrandName(names, host)
}
