// Mock stand-in for the app's lib/mock-adapter-guidelines.ts (synced 2026-11-27): the brand guidelines kept in this
// browser (src/data/brandGuidelines.js). In the app they are saved on its server, so it has a loading state and a
// failed-save state; here they are always loaded and never fail.
// ?guidelines=saved (preview only): a saved sample guide, as in the app's screenshots, without saving anything.
import { EMPTY_GUIDELINES, guidelinesSkipped, loadGuidelines as loadSaved } from '../../data/brandGuidelines.js'

export * from '../../data/brandGuidelines.js'
export const guidelinesStateOf = () => ({ loaded: true, error: null })
export const useBrandGuidelines = () => ({ loaded: true, error: null })

const SAMPLE_TEXT = `# Sample Brand Guidelines

How the sample brand sounds in everything it publishes.

## Tone of voice

We write the way a **knowledgeable friend** talks: plainly, warmly and without jargon. Short sentences first.

- Lead with the answer, then the reason
- One idea per paragraph
- Numbers beat adjectives

## Audience

People comparing options for the first time. They are careful and they read on a phone.

| Do | Don’t |
| --- | --- |
| clear pricing | cheap |
| talk to a person | world-class |
`
export const SAMPLE_GUIDELINES = {
  ...EMPTY_GUIDELINES,
  file: { name: 'sample-brand-guidelines.md', words: 92, text: SAMPLE_TEXT },
  tone: 'We write the way a knowledgeable friend talks: plainly, warmly and without jargon.',
  always: 'clear pricing, talk to a person',
  never: 'cheap, world-class',
  notFound: ['Product naming', 'Writing examples', 'Claims / disclaimers'],
  addedAt: '2026-11-27T10:00:00.000Z',
  savedAt: '2026-11-27T10:00:00.000Z',
}
const preview = () => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('guidelines'))
// the brand's guidelines; with ?guidelines=saved (or reading / failed) and none saved, the sample guide
export const loadGuidelines = (domain) => loadSaved(domain) ?? (['saved', 'reading', 'failed'].includes(preview()) ? SAMPLE_GUIDELINES : null)
// the one-time guidelines screen is asked only when the brand has none (the sample counts) and hasn't skipped them
export const needsGuidelines = (domain) => !loadGuidelines(domain) && !guidelinesSkipped(domain)
// ?guidelines=reading | failed (preview only): a guide still being read, or one that couldn't be read
export const guidelinesReadState = () => (['reading', 'failed'].includes(preview()) ? preview() : null)

// What we read from a guide, for the preview pull-out: tone, the words to use and to avoid, and what the guide
// doesn't cover (the sample says; otherwise the rules left empty)
const words = (s) => String(s ?? '').split(/[,\n]/).map((w) => w.trim()).filter(Boolean)
export function guidelinesRead(g) {
  const use = words(g?.always); const avoid = words(g?.never); const tone = String(g?.tone ?? '').trim()
  const missing = g?.notFound ?? [!tone && 'Tone of voice', !use.length && 'Words to use', !avoid.length && 'Words to avoid'].filter(Boolean)
  return { tone, use, avoid, missing, none: !tone && !use.length && !avoid.length }
}
// the file line: "MD · 92 words · Added Nov 27"
export function guidelinesFile(g) {
  const name = g?.file?.name ?? 'Pasted text'
  const text = g?.file?.text || g?.text || ''
  const type = g?.file?.name?.includes('.') ? g.file.name.split('.').pop().toUpperCase() : 'Text'
  const count = g?.file?.words ?? (text.trim() ? text.trim().split(/\s+/).length : 0)
  return { name, type, words: count, text }
}
