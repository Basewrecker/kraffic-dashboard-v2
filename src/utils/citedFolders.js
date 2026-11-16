// Cited pages by folder (Visibility Overview card + its drawer). Pure functions only (the app ports these as-is).
// A citation = one prompt's answer on one engine linking one of the brand's URLs, as the scan stores it (raw: query
// strings, #anchors, trailing slashes). Grouping: the URL's page (no query string, no #anchor, no trailing slash, so
// "/x?submission_source=footer" and "/x#faq" are "/x") → its folder (the first path segment, "/blog/"); "/" is
// "Homepage"; any .pdf is "Documents (PDF)". The card shows the top 6 folders by citations and folds the rest into
// "Other n folders".

export const TOP_FOLDERS = 6
export const HOMEPAGE = 'Homepage'
export const PDFS = 'Documents (PDF)'
export const OTHER = 'other'

// "https://www.dermasuri.com/blog/x/?submission_source=footer#faq" | "/blog/x?utm=1" → "/blog/x"; "" | "/" → "/"
export function pageOf(url) {
  let s = String(url ?? '').trim()
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, '') // scheme + host
  s = s.split('#')[0].split('?')[0]
  if (!s.startsWith('/')) s = `/${s}`
  s = s.replace(/\/{2,}/g, '/')
  if (s.length > 1) s = s.replace(/\/+$/, '')
  return s || '/'
}

// "/blog/x" → "/blog/"; "/" → "Homepage"; "/files/study.pdf" → "Documents (PDF)"; "/about" → "/about/"
export function folderOf(url) {
  const page = pageOf(url)
  if (page === '/') return HOMEPAGE
  if (/\.pdf$/i.test(page)) return PDFS
  return `/${page.split('/')[1]}/`
}

// citations [{ url, engine, prompt? }] → folders by citations (most first; a tie keeps the alphabetical order), each
// with its pages: [{ key, count, pages: [{ path, count, engines: [ids], prompts: [{ key, prompt, engine }] }] }].
// total = citations; pageCount = distinct pages.
export function groupFolders(citations = []) {
  const byFolder = new Map()
  for (const c of citations) {
    const folder = folderOf(c.url)
    const path = pageOf(c.url)
    if (!byFolder.has(folder)) byFolder.set(folder, new Map())
    const pages = byFolder.get(folder)
    if (!pages.has(path)) pages.set(path, { path, count: 0, engines: [], prompts: [] })
    const p = pages.get(path)
    p.count += 1
    if (c.engine && !p.engines.includes(c.engine)) p.engines.push(c.engine)
    if (c.prompt && !p.prompts.some((x) => x.key === c.prompt.key)) p.prompts.push({ ...c.prompt, engine: c.engine })
  }
  const folders = [...byFolder.entries()].map(([key, pages]) => {
    const list = [...pages.values()].sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
    return { key, count: list.reduce((n, p) => n + p.count, 0), pages: list }
  }).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
  return { folders, total: citations.length, pageCount: folders.reduce((n, f) => n + f.pages.length, 0) }
}

// the donut's slices: the top `top` folders, then the rest as one "Other n folders" (key OTHER, n = how many)
export function topFolders(folders, top = TOP_FOLDERS) {
  const head = folders.slice(0, top)
  const rest = folders.slice(top)
  if (!rest.length) return head
  return [...head, { key: OTHER, n: rest.length, count: rest.reduce((s, f) => s + f.count, 0), folders: rest.map((f) => f.key), pages: rest.flatMap((f) => f.pages) }]
}
export const otherLabel = (n) => `Other ${n} folder${n === 1 ? '' : 's'}`
export const folderLabel = (f) => (f.key === OTHER ? otherLabel(f.n) : f.key)

// whole percentages that add up to 100 (largest remainder): the donut and its legend never disagree
export function wholePercents(counts) {
  const total = counts.reduce((a, b) => a + b, 0)
  if (!total) return counts.map(() => 0)
  const raw = counts.map((c) => (c / total) * 100)
  const out = raw.map(Math.floor)
  let left = 100 - out.reduce((a, b) => a + b, 0)
  raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => { if (left > 0) { out[i] += 1; left -= 1 } })
  return out
}

// a folder's change vs the sync before: its count now minus then (a folder new this sync: its whole count); null when
// there's no sync before
export function folderChange(key, now, prev) {
  if (!prev) return null
  const count = (g, k) => (k === OTHER ? null : g.folders.find((f) => f.key === k)?.count ?? 0)
  const a = count(now, key)
  if (a == null) return null
  return a - count(prev, key)
}
// "Other n folders": the change of the folders it holds now
export function otherChange(other, now, prev) {
  if (!prev) return null
  const count = (g, k) => g.folders.find((f) => f.key === k)?.count ?? 0
  return other.folders.reduce((n, k) => n + count(now, k) - count(prev, k), 0)
}

// "The /blog/ folder earns 52% of your citations." (the biggest folder; Homepage / PDFs read as names)
export function folderInsight(slices, pct, { you = true, name = '' } = {}) {
  const top = slices[0]
  if (!top || top.key === OTHER) return null
  const who = you ? 'your' : `${name}’s`
  const what = top.key === HOMEPAGE ? 'Your homepage' : top.key === PDFS ? 'Your PDFs' : `The ${top.key} folder`
  return `${top.key === HOMEPAGE && !you ? `${name}’s homepage` : what} earns ${pct[0]}% of ${who} citations.`
}

// the folder colour by rank (Share of voice's palette, utils/brandColors.js): index 0 = the biggest folder; "Other" =
// the palette's 7th colour (pink)
export const colorIndex = (i, key) => (key === OTHER ? 6 : Math.min(i, 5))
