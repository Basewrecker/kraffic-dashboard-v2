// A brand's guidelines (owner, 2026-11-05): asked once on the Content page, before "Add your data", and kept per brand;
// every draft for the brand follows them. Edited on Brand Setup. The mock keeps them in this browser (localStorage, per
// brand domain); the app keeps them on the brand.
// Shape: { file: { name, words, text } | null, text: pasted text, tone, always: "Always say", never: "Never say",
//   savedAt: ISO time }. Skipping ("Skip for now") is remembered per brand too, so the screen shows once.
const KEY = (domain) => `kraffic:brand-guidelines:${domain}`
const SKIP = (domain) => `kraffic:brand-guidelines-skipped:${domain}`

export const GUIDE_KINDS = ['pdf', 'docx', 'txt', 'md']
export const GUIDE_ACCEPT = '.pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown'
export const GUIDE_MAX_BYTES = 10 * 1024 * 1024
export const EMPTY_GUIDELINES = { file: null, text: '', tone: '', always: '', never: '' }

const store = () => (typeof window === 'undefined' ? null : window.localStorage)

// why a file can't be used as the guidelines, or null
export function guideReject(file) {
  const ext = String(file.name).split('.').pop().toLowerCase()
  if (!String(file.name).includes('.') || !GUIDE_KINDS.includes(ext)) return 'Not a PDF, DOCX, TXT or MD file'
  if (file.size > GUIDE_MAX_BYTES) return 'Over 10 MB'
  return null
}

// something to follow: a read file, pasted text or any of the three fields
export const hasGuidelines = (g) => Boolean(g && (g.file?.text || g.text?.trim() || g.tone?.trim() || g.always?.trim() || g.never?.trim()))

export function loadGuidelines(domain) {
  try {
    const g = JSON.parse(store()?.getItem(KEY(domain)) ?? 'null')
    return hasGuidelines(g) ? { ...EMPTY_GUIDELINES, ...g } : null
  } catch { return null }
}
export function saveGuidelines(domain, g) {
  const saved = { ...EMPTY_GUIDELINES, ...g, savedAt: new Date().toISOString() }
  try { store()?.setItem(KEY(domain), JSON.stringify(saved)); store()?.removeItem(SKIP(domain)) } catch { /* private mode: this visit only */ }
  return saved
}
export function removeGuidelines(domain) {
  try { store()?.removeItem(KEY(domain)) } catch { /* private mode */ }
}
export function skipGuidelines(domain) {
  try { store()?.setItem(SKIP(domain), '1') } catch { /* private mode */ }
}
export const guidelinesSkipped = (domain) => { try { return store()?.getItem(SKIP(domain)) === '1' } catch { return false } }

// the Content page asks only when the brand has none saved and hasn't skipped them
export const needsGuidelines = (domain) => !loadGuidelines(domain) && !guidelinesSkipped(domain)

// what they are, in one short line: the file's name or "Pasted text", then the fields filled ("Tone · Never say")
export function guidelinesLabel(g) {
  if (!g) return null
  const src = g.file?.name ?? (g.text?.trim() ? 'Pasted text' : null)
  const fields = [g.tone?.trim() && 'Tone', g.always?.trim() && 'Always say', g.never?.trim() && 'Never say'].filter(Boolean)
  return [src, fields.join(', ')].filter(Boolean).join(' · ') || null
}
// a short preview of the text (pasted, else the file's), for Brand Setup
export function guidelinesPreview(g, max = 110) {
  const t = (g?.text?.trim() || g?.file?.text || g?.tone || '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}
