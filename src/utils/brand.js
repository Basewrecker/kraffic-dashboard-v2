// Display name for a brand domain: cerave.com → "CeraVe".
// Data, keys, links, colors and CSV keep the raw domain; only the visible label goes through this.
// names that can't be read off the domain
const KNOWN = {
  'cerave.com': 'CeraVe', 'theordinary.com': 'The Ordinary', 'paulaschoice.com': 'Paula’s Choice',
  'laroche-posay.us': 'La Roche-Posay', 'supergoop.com': 'Supergoop!', 'eltamd.com': 'EltaMD',
  'firstaidbeauty.com': 'First Aid Beauty', 'drunkelephant.com': 'Drunk Elephant',
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
