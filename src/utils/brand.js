// Display name for a brand domain: cerave.com → "CeraVe".
// Data, keys, links, colors and CSV keep the raw domain; only the visible label goes through this.
// names that can't be read off the domain
const KNOWN = {
  'cerave.com': 'CeraVe', 'theordinary.com': 'The Ordinary', 'paulaschoice.com': 'Paula’s Choice',
  'laroche-posay.us': 'La Roche-Posay', 'supergoop.com': 'Supergoop!', 'eltamd.com': 'EltaMD',
  'firstaidbeauty.com': 'First Aid Beauty', 'drunkelephant.com': 'Drunk Elephant',
}
export function brandName(domain) {
  const d = domain.replace(/^www\./, '').toLowerCase()
  if (KNOWN[d]) return KNOWN[d]
  const base = domain.replace(/^www\./, '').replace(/\.[a-z.]+$/i, '') // strip TLD
  return base.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// true for labels that are domains ("theordinary.com"), false for plain labels ("Category pages")
export const isDomain = (label) => /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(label)
