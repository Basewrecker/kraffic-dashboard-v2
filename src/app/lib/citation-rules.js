// Mock stand-in for the app's lib/citation-rules.js (synced 2026-11-15): only the two display rules the copied pages
// use. The app's file also holds its citation matching, which the mock has no use for.
// a stored "name" that is really a web address
export const looksLikeDomain = (v) => /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+\/?$/i.test(String(v || '').trim())
const tidy = (domain) => String(domain || '').replace(/^(https?:\/\/)?(www\.)?/i, '').split('/')[0].split('.')[0].split(/[-_]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
// a brand as lists name it: the name Brand Setup holds, and only with no real name the domain tidied
export function brandListName(stored, domain) {
  const name = (Array.isArray(stored) ? stored : [stored]).map((n) => String(n || '').trim()).find((n) => n && !looksLikeDomain(n))
  return name || tidy(domain) || String(domain || '')
}
