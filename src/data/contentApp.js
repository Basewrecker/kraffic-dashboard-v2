// What the app's Content page added on 2026-11-05 (synced from ~/app_kraffic.ai develop + feat/page-source-and-edit,
// lib/mock-adapter-content.ts, lib/content-cms.js, lib/content-format-recommend.js): the same rules, on the mock's
// sample data. No server here: the publish check, the CMS and Regenerate are simulated in this browser.

// Parts hidden for now (owner, 2026-11-05). One switch each, so each can come back:
//   keyFacts / flagAnswers: Your data's "Add key facts" and "Answer what you can" (only Upload documents shows)
//   draftChecks: "Before you publish", the draft check's flags, the score ring and every "N flags" count
//   statusCard: the Content list's status hover card (the Wk 1–4 × engine grid)
export const CONTENT_HIDDEN = { keyFacts: true, flagAnswers: true, draftChecks: true, statusCard: true }

// Your data as the request sees it: the hidden tasks' facts / answers left out (the stored ones stay, for later)
export const yourDataOf = (d) => (d ? {
  ...d,
  ...(CONTENT_HIDDEN.keyFacts ? { facts: [] } : {}),
  ...(CONTENT_HIDDEN.flagAnswers ? { questions: (d.questions ?? []).map((q) => ({ ...q, answer: '' })) } : {}),
} : d)

// Where the target page came from, so a suggestion doesn't look like a Search Console pick:
//   'pick' → "Your pick" · 'sc' → "From Search Console" · the route's own → "Suggested from your site" / "New page we suggest"
export const pageSourceLabel = (page) => (page?.source === 'pick' ? 'Your pick'
  : page?.source === 'sc' ? 'From Search Console'
    : page?.action === 'create' ? 'New page we suggest' : 'Suggested from your site')

// "Open page in CMS": the brand's CMS (the app detects it once per brand; the mock's sample brand is on WordPress,
// ?co=cms-none for a site we can't detect). → { label, href } | null (no CMS and a new page: nothing to open)
const slugOf = (u) => (u ? u.pathname.replace(/\/$/, '').split('/').pop() || '' : '')
export function cmsLinkFor({ cms = null, domain = '', url = '', action = 'update' } = {}) {
  const brand = String(domain).replace(/^www\./, '')
  let page = null
  try { page = url ? new URL(url, brand ? `https://${brand}` : undefined) : null } catch { page = null }
  const host = brand || page?.hostname || ''
  const create = action === 'create'
  if (cms === 'wordpress' && host) {
    return create
      ? { label: 'Open CMS', href: `https://${host}/wp-admin/post-new.php?post_type=page` }
      : { label: 'Open page in CMS', href: `https://${host}/wp-admin/edit.php?post_type=any&s=${slugOf(page)}` }
  }
  if (cms === 'shopify' && host) return { label: create ? 'Open CMS' : 'Open page in CMS', href: `https://${host}/admin/` }
  if (create || !page) return null
  return { label: 'Open page', href: page.href }
}
const coHas = (s) => typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('co') ?? '').split(',').includes(s)
export const cmsLinkOf = (page, domain) => cmsLinkFor({ cms: coHas('cms-none') ? null : 'wordpress', domain, url: page?.href ?? page?.url ?? '', action: page?.action === 'create' ? 'create' : 'update' })

// Back to the list after Verify found the page: a toast and a brief highlight on that row, once
let flash = null
export const flashPrompt = (row) => { flash = row ? row.prompt.trim().toLowerCase() : null }
export const consumeFlash = () => { const f = flash; flash = null; return f }

// ---- Verify (step 5): the publish check (own domain only, 60% of the key sentences = published) ------------------
// → { kind: 'idle' | 'running' | 'found' | 'partial' | 'notfound' | 'error', found, total, missing, why, at }
export const VERIFY_GAP_MS = 30_000 // "Check again" at most once per 30 seconds
export const verifyWait = (at, now = Date.now()) => (at ? Math.max(0, VERIFY_GAP_MS - (now - at)) : 0)
export function verifyStateOf(run) {
  const at = run?.at ?? null
  if (run?.checking) return { kind: 'running', at }
  const c = run?.check
  if (!c) return { kind: 'idle', at }
  if (!c.ok) return { kind: 'error', why: c.why, at }
  const base = { found: c.found, total: c.total, missing: c.missing ?? [], at }
  if (c.total > 0 && c.found / c.total >= 0.6) return { kind: 'found', ...base }
  return { kind: c.found > 0 ? 'partial' : 'notfound', ...base }
}
// the mock's check result: found by default; ?co=verify-partial, verify-notfound or verify-error for the others
const KEY_SENTENCES = [
  'Hyaluronic acid serum holds water in the skin, so it looks plumper within minutes.',
  'Apply it to damp skin, then seal it in with a moisturizer.',
  'It suits every skin type, including sensitive and acne-prone skin.',
  'Look for a mix of molecular weights for both surface and deeper hydration.',
  'Use it morning and night, before heavier creams and sunscreen.',
]
export function sampleCheck() {
  if (coHas('verify-error')) return { ok: false, why: 'The page answered 404: it doesn’t exist yet.' }
  if (coHas('verify-notfound')) return { ok: true, found: 0, total: 5, missing: KEY_SENTENCES }
  if (coHas('verify-partial')) return { ok: true, found: 2, total: 5, missing: KEY_SENTENCES.slice(2) }
  return { ok: true, found: 4, total: 5, missing: KEY_SENTENCES.slice(4) }
}

// ---- the draft edited by hand: the formats its text has, by the draft check's own rules ---------------------------
// (lib/content-format-recommend.js detectFormatsOnPage, 1:1)
const FORMAT_IDS = ['listicle', 'how_to', 'tutorial', 'faq', 'comparison', 'checklist', 'case_study', 'research', 'stats', 'template']
export function detectFormatsOnPage(page) {
  const title = String(page?.title || page?.h1 || '')
  const headings = (Array.isArray(page?.headings) ? page.headings : []).map((h) => (typeof h === 'string' ? h : h?.text || '')).join(' ')
  const body = String(page?.mainText || page?.text || '').slice(0, 8000)
  const blob = `${title}\n${headings}\n${body}`.toLowerCase()
  if (blob.trim().length < 40) return []
  const hits = []
  const has = (re) => re.test(blob)
  if (has(/\b(best |top \d+|list of|roundup|ranked)\b/) || (has(/\b\d+\.\s+\w/) && has(/\b(best|top|options?)\b/))) hits.push('listicle')
  if (has(/\b(how to|how do|how does|how can)\b/) || has(/\bguide to\b/)) hits.push('how_to')
  if (has(/\b(step[- ]by[- ]step|tutorial|walkthrough)\b/) || (has(/\bstep \d+\b/) && has(/\b(first|next|finally)\b/))) hits.push('tutorial')
  if (has(/\b(faq|frequently asked|common questions)\b/) || ((blob.match(/\?/g) || []).length >= 4 && has(/\b(answer|q&a|question)\b/))) hits.push('faq')
  if (has(/\b(vs\.?|versus|compared to|comparison|better than)\b/)) hits.push('comparison')
  if (has(/\b(checklist|check list|tick off)\b/)) hits.push('checklist')
  if (has(/\b(case study|customer stor|success stor)\b/)) hits.push('case_study')
  if (has(/\b(original research|our (study|survey|data)|we (surveyed|analyzed))\b/) || has(/\bwhite ?paper\b/)) hits.push('research')
  if (has(/\b(statistics?|statistical|by the numbers)\b/) || ((blob.match(/\d+(\.\d+)?%/g) || []).length >= 4 && has(/\b(average|rate|percent)\b/))) hits.push('stats')
  if (has(/\b(template|framework|playbook|worksheet)\b/)) hits.push('template')
  return [...new Set(hits.filter((id) => FORMAT_IDS.includes(id)))]
}

// ---- Search Console: who connected it (the app keeps it on the brand), the property picker's sample list ----------
export const SAMPLE_CONNECTED_BY = { name: 'Maya Chen', at: '2026-11-03T10:12:00Z' }
export const sampleProperties = (domain) => ({
  matched: [{ siteUrl: `sc-domain:${domain}`, permissionLevel: 'siteOwner' }, { siteUrl: `https://www.${domain}/`, permissionLevel: 'siteFullUser' }],
  other: [{ siteUrl: 'https://blog.example.com/', permissionLevel: 'siteFullUser' }],
})

// ---- the draft's hand edits and Regenerate's state (the app keeps both on the server; the mock for this visit) -----
// A store with subscribe / version, for useSyncExternalStore (no React here, so the tests can import it)
const keyOf = (prompt) => String(prompt ?? '').trim().toLowerCase()
const edits = new Map() // prompt → { markdown, editedAt, editedBy }
const regens = new Map() // prompt → { running, done: { at } | null }
const listeners = new Set()
let version = 0
const emit = () => { version += 1; listeners.forEach((fn) => fn()) }
export const subscribeContent = (fn) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const contentVersion = () => version
// the response with its hand edit, if any ("Edited by you · <time>" in the header; Copy / Export use the edit)
export function withEdit(res) {
  const e = res ? edits.get(keyOf(res.prompt)) : null
  return e ? { ...res, contentMarkdown: e.markdown, editedAt: e.editedAt, editedBy: e.editedBy } : res
}
export const saveDraftEdit = (prompt, markdown) => { edits.set(keyOf(prompt), { markdown, editedAt: new Date().toISOString(), editedBy: 'you' }); emit() }
export const restoreDraft = (prompt) => { edits.delete(keyOf(prompt)); emit() }
// Regenerate (owner, 2026-11-05: the click must visibly do something): "Regenerating…" while the new draft is written,
// then "Draft regenerated · <time>" for this visit. A hand-edited draft asks first: the new draft replaces the edits.
export const REGEN_MS = 2400
export const regenStateOf = (prompt) => regens.get(keyOf(prompt)) ?? { running: false, done: null }
export function regenerate(prompt, { confirm = typeof window === 'undefined' ? null : (m) => window.confirm(m), ms = REGEN_MS } = {}) {
  const k = keyOf(prompt)
  if (edits.has(k) && confirm && !confirm('This replaces your edits. Regenerate the draft anyway?')) return false
  regens.set(k, { running: true, done: regens.get(k)?.done ?? null }); emit()
  setTimeout(() => { edits.delete(k); regens.set(k, { running: false, done: { at: new Date().toISOString() } }); emit() }, ms)
  return true
}
