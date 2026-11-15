/**
 * Known marketplaces' logos, bundled with the app (owner, 2026-11-07: "Reddit, Quora (and Amazon, Target, Walmart,
 * YouTube) show letter tiles. Bundle their logos as local SVGs in the app (no network fetch) and use those first for
 * known marketplaces; then the normal logo chain for others.")
 *
 * knownMarketplace(nameOrHostOrUrl) → { key, name, domain, src } or null. Matches, case-insensitively, a store's name
 * ("Reddit", "YouTube"), its host or any subdomain ("reddit.com", "www.reddit.com", "old.reddit.com", "amazon.co.uk",
 * "youtu.be") or a URL on it ("https://www.quora.com/What-is…"). The files live in public/marketplaces/.
 * Used first by MarketplaceIcon (components/mock/components/dashboard/icons.jsx) and SiteLogo
 * (components/mock/components/ui/SiteLogo.jsx), so every store / site logo of these shows the local file.
 */
const AMAZON_TLDS = ['com', 'co.uk', 'ca', 'de', 'fr', 'it', 'es', 'in', 'co.jp', 'com.au', 'com.mx', 'com.br', 'nl', 'se', 'ae', 'sa', 'sg', 'pl', 'com.tr', 'com.be'];

export const MARKETPLACES = [
  { key: 'reddit', name: 'Reddit', domain: 'reddit.com', hosts: ['reddit.com', 'redd.it'] },
  { key: 'quora', name: 'Quora', domain: 'quora.com', hosts: ['quora.com'] },
  { key: 'amazon', name: 'Amazon', domain: 'amazon.com', hosts: [...AMAZON_TLDS.map((t) => `amazon.${t}`), 'amzn.to'] },
  { key: 'target', name: 'Target', domain: 'target.com', hosts: ['target.com'] },
  { key: 'walmart', name: 'Walmart', domain: 'walmart.com', hosts: ['walmart.com', 'walmart.ca'] },
  { key: 'youtube', name: 'YouTube', domain: 'youtube.com', hosts: ['youtube.com', 'youtu.be'], aliases: ['you tube'] },
];

const BASE = String((typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_BASE_PATH) || '').replace(/\/$/, '');
export const marketplaceLogoSrc = (key) => `${BASE}/marketplaces/${key}.svg`;

const hostOf = (s) => s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0].split('@').pop().replace(/:\d+$/, '').replace(/\.$/, '');

export function knownMarketplace(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return null;
  let hit = null;
  if (/[./]/.test(s)) {
    const host = hostOf(s);
    hit = MARKETPLACES.find((m) => m.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
  } else {
    hit = MARKETPLACES.find((m) => m.key === s || m.name.toLowerCase() === s || (m.aliases || []).includes(s));
  }
  return hit ? { key: hit.key, name: hit.name, domain: hit.domain, src: marketplaceLogoSrc(hit.key) } : null;
}

/**
 * Known outside sources' logos, bundled with the app (owner, 2026-11-13: "bundle the fixed logos (Trustpilot, BBB,
 * Money, TIME and other known sources)"): no request at view time. The files live in public/sources/ (each site's own
 * icon, saved once from Google's favicon service at 48–128px).
 * knownSource(nameOrHostOrUrl) → { key, name, domain, src } or null: by host or any subdomain, or a URL on it, or the
 * source's name ("Trustpilot", "BBB").
 */
export const KNOWN_SOURCES = [
  ['trustpilot.com', 'Trustpilot'], ['bbb.org', 'BBB'], ['money.com', 'Money'], ['time.com', 'TIME'],
  ['forbes.com', 'Forbes'], ['fortune.com', 'Fortune'], ['newsweek.com', 'Newsweek'], ['usnews.com', 'U.S. News'],
  ['jdpower.com', 'J.D. Power'], ['consumerreports.org', 'Consumer Reports'], ['glassdoor.com', 'Glassdoor'],
  ['nerdwallet.com', 'NerdWallet'], ['investopedia.com', 'Investopedia'], ['bankrate.com', 'Bankrate'],
  ['wikipedia.org', 'Wikipedia'], ['consumerfinance.gov', 'CFPB'], ['linkedin.com', 'LinkedIn'],
  ['facebook.com', 'Facebook'], ['yelp.com', 'Yelp'], ['bloomberg.com', 'Bloomberg'], ['cnbc.com', 'CNBC'],
].map(([domain, name]) => ({ domain, name, key: domain.replace(/\./g, '-') }));
export const sourceLogoSrc = (key) => `${BASE}/sources/${key}.png`;

export function knownSource(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return null;
  const hit = /[./]/.test(s)
    ? KNOWN_SOURCES.find((k) => { const host = hostOf(s); return host === k.domain || host.endsWith(`.${k.domain}`); })
    : KNOWN_SOURCES.find((k) => k.name.toLowerCase() === s);
  return hit ? { key: hit.key, name: hit.name, domain: hit.domain, src: sourceLogoSrc(hit.key) } : null;
}
// a bundled logo for a site, marketplaces first
export const knownLogo = (value) => knownMarketplace(value) ?? knownSource(value);
