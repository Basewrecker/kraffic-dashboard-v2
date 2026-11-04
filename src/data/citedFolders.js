// Sample data for "Cited pages by folder" (Visibility Overview card + drawer). Mock only; the app builds the same from
// its stored citations (one row per prompt × engine × cited URL, the URL as the scan stored it).
//   citationsFor(domain, engine, weekIndex) → [{ url, engine, prompt: { key, prompt } }]   (weekIndex 0 = the latest sync)
//   folderWeeks(domain, engine)             → 10 weeks, newest first: { week, date, label, month, groups | null }
// How many citations each engine has each week comes from data/citationHistory.js (the Citations and Mentions card
// and its drawer), so the numbers agree everywhere; this file only says WHICH URLs those citations link. The brand's
// own sample (Dermasuri) is shaped like a real site's citations: ten folders (/blog/ biggest), the homepage, a PDF,
// and the same page cited with ?submission_source=…, ?utm_source=chatgpt.com, #anchors and a trailing slash (they merge
// into one page). Another brand: its cited pages from the prompts table (brandViews engineDetail).
import { citationWeeks } from './citationHistory.js'
import { ENGINE_ORDER, OWN, engineDetail } from './brandViews.js'
import { trackedPrompts } from './mock.js'
import { groupFolders } from '../utils/citedFolders.js'

export const FOLDER_WEEKS = 10

// FNV-1a → 0..1: the same week, engine and slot always pick the same URL
// (with a final mix, so seeds that differ only in their last digit still land far apart)
const hash = (s) => {
  let h = 2166136261
  for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16
  return h >>> 0
}
const rnd = (s) => hash(s) / 4294967296

// Dermasuri's cited pages: [path, weight]. Weights are relative; /blog/ carries about half the citations.
const OWN_PAGES = [
  ['/blog/retinol-for-beginners', 9], ['/blog/sunscreen-without-white-cast', 8], ['/blog/niacinamide-and-vitamin-c', 7],
  ['/blog/ceramides-explained', 5], ['/blog/how-to-layer-serums', 5], ['/blog/azelaic-acid-for-rosacea', 4],
  ['/blog/barrier-repair-routine', 3], ['/blog/dark-spots-guide', 3], ['/blog/acne-scars-at-home', 2], ['/blog/skin-cycling', 2],
  ['/blog/spf-reapplication', 1], ['/blog/fungal-acne', 1],
  ['/products/vitamin-c-serum', 7], ['/products/ceramide-barrier-cream', 5], ['/products/niacinamide-10-serum', 4],
  ['/products/mineral-sunscreen-spf-50', 3], ['/products/gentle-gel-cleanser', 2], ['/products/lip-balm-spf', 1],
  ['/collections/serums', 4], ['/collections/sunscreen', 2], ['/collections/sensitive-skin', 1],
  ['/guides/morning-routine-order', 3], ['/guides/skin-type-quiz', 2], ['/guides/patch-testing', 1],
  ['/', 4],
  ['/ingredients/niacinamide', 2], ['/ingredients/azelaic-acid', 1], ['/ingredients/ceramides', 1],
  ['/files/dermasuri-clinical-study-2026.pdf', 2], ['/files/ingredient-glossary.pdf', 1],
  ['/reviews/vitamin-c-serum', 1], ['/faq', 1], ['/about/dermatologists', 1], ['/press/allure-best-of-beauty', 1],
]
// how the scan stored a cited URL (the same page, written differently): the merge the card must do
function rawUrl(path, engine, seed, domain) {
  const host = `https://${rnd(`${seed}|www`) < 0.5 ? 'www.' : ''}${domain}`
  if (engine === 'chatgpt') return `${host}${path}?utm_source=chatgpt.com`
  const r = rnd(`${seed}|form`)
  if (path.endsWith('.pdf')) return `${host}${path}`
  if (r < 0.14) return `${host}${path}?submission_source=footer`
  if (r < 0.26) return `${host}${path}#${['faq', 'how-to-use', 'key-takeaways'][hash(seed) % 3]}`
  if (r < 0.36 && path !== '/') return `${host}${path}/`
  return `${host}${path}`
}

// the prompts a page can be cited for: visible prompts (the brand shows up in the answer), picked by the slot
const VISIBLE = trackedPrompts.filter((p) => p.status === 'visible')

// a page list to draw from: Dermasuri's sample, or another brand's cited pages (prompts table) by how often they're cited
function pagesFor(domain) {
  if (domain === OWN.domain) return OWN_PAGES
  const pages = engineDetail(domain, 'all').pages
  return pages.length ? pages.map((p) => [p.path, p.prompts.length]) : [['/', 1]]
}

// week i's weight for a page: /blog/ grows a little toward the latest sync, the rest wander (so folders move week to week)
function weightOf(path, w, i) {
  const drift = path.startsWith('/blog/') ? 1 + (FOLDER_WEEKS - 1 - i) * 0.04 : 1
  return w * drift * (0.75 + rnd(`${path}|${i}`) * 0.5)
}

// the URLs behind week i's citations on one engine (citationHistory's count for that week and engine; null = none)
const cache = new Map()
export function citationsFor(domain, engine, i) {
  const k = `${domain}|${engine}|${i}`
  if (cache.has(k)) return cache.get(k)
  const week = citationWeeks(domain).weeks.filter((w) => !w.pending)[i]
  const n = week?.engines?.[engine]?.citations
  if (n == null) { cache.set(k, null); return null }
  const pages = pagesFor(domain).map(([path, w]) => [path, weightOf(path, w, i)])
  const sum = pages.reduce((s, [, w]) => s + w, 0)
  const out = Array.from({ length: n }, (_, slot) => {
    const seed = `${domain}|${engine}|${i}|${slot}`
    let x = rnd(seed) * sum
    const [path] = pages.find(([, w]) => (x -= w) < 0) ?? pages.at(-1)
    const p = VISIBLE[hash(`${seed}|prompt`) % VISIBLE.length]
    return { url: rawUrl(path, engine, seed, domain), engine, prompt: { key: p.id, prompt: p.prompt } }
  })
  cache.set(k, out)
  return out
}

// the engines a brand has citations on in its latest sync (the drawer's engine tabs list these)
export const folderEngines = (domain) => ENGINE_ORDER.filter((e) => (citationsFor(domain, e, 0)?.length ?? 0) > 0)

// one week's citations on one engine or all ('all': every engine that ran); null when nothing ran that week
export function weekCitations(domain, engine, i) {
  const list = (engine === 'all' ? ENGINE_ORDER : [engine]).map((e) => citationsFor(domain, e, i))
  if (list.every((x) => x == null)) return null
  return list.filter(Boolean).flat()
}

// History fills from stored answers (each prompt keeps its last 12 scan days per engine), so a real brand can have
// fewer than 10 weeks. Previews: ?folders=short → 4 weeks ("History since <date>"), ?folders=one → the first sync only
// (no trend, no changes).
export const folderPreview = () => { try { return new URLSearchParams(window.location.search).get('folders') } catch { return null } }
export const weeksKept = (preview = folderPreview()) => (preview === 'one' ? 1 : preview === 'short' ? 4 : FOLDER_WEEKS)

// up to 10 weeks, newest first: { i, date, label, month, groups } (groups: utils/citedFolders groupFolders, or null
// when nothing ran that week)
export function folderWeeks(domain, engine = 'all') {
  const weeks = citationWeeks(domain).weeks.filter((w) => !w.pending).slice(0, weeksKept())
  return weeks.map((w, i) => {
    const c = weekCitations(domain, engine, i)
    return { i, date: w.date, label: w.label, month: w.month, groups: c ? groupFolders(c) : null }
  })
}
