// Content → the Draft step, edited by hand (owner, 2026-11-05; ported from the app's components/mock-overview/content-edit.jsx). "Edit draft" turns the article into an editor, one block
// per section: its heading and its text (Markdown, as the draft is: paragraphs, "- " lists, "1. " steps, **Question?**
// FAQ items, | tables |). No new editor dependency. The sections the page hides (Page recommendation, Flags,
// Publishing notes, Sources) aren't shown and are kept as they were. "Add a section" offers a template for each format
// the winners use that the draft doesn't cover yet (by the draft check's own rules, data/contentApp.js detectFormatsOnPage),
// plus a blank one. Save / Cancel are the footer's (DraftStep); Cancel asks first when something changed.
import { useMemo } from 'react'
import { Plus, X } from 'lucide-react'
import { detectFormatsOnPage } from '../../../data/contentApp.js'
import { formatLabel } from '../../../data/contentRecommend.js'

const KEEP = /^(page recommendation|flags|publishing notes?|sources)$/i

// the draft's Markdown → { h1, intro, sections: [{ title, body, kept }] } (line based: "# " is the H1, "## " a section)
export function splitDraft(markdown) {
  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n')
  let h1 = ''
  const intro = []
  const sections = []
  for (const line of lines) {
    const m2 = /^##\s+(.*)$/.exec(line)
    const m1 = /^#\s+(.*)$/.exec(line)
    if (m1 && !h1 && !sections.length) { h1 = m1[1].trim(); continue }
    if (m2) { sections.push({ title: m2[1].trim(), body: [], kept: KEEP.test(m2[1].trim()) }); continue }
    ;(sections.length ? sections[sections.length - 1].body : intro).push(line)
  }
  const tidy = (xs) => xs.join('\n').replace(/^\n+|\n+$/g, '')
  return { h1, intro: tidy(intro), sections: sections.map((s) => ({ ...s, body: tidy(s.body) })) }
}
// and back: H1, intro, then each section as "## title" + its text, one blank line between
export function joinDraft({ h1, intro, sections }) {
  const parts = []
  if (h1?.trim()) parts.push(`# ${h1.trim()}`)
  if (intro?.trim()) parts.push(intro.trim())
  for (const s of sections) {
    if (!s.title?.trim() && !s.body?.trim()) continue
    parts.push(`## ${(s.title || 'Untitled section').trim()}`)
    if (s.body?.trim()) parts.push(s.body.trim())
  }
  return `${parts.join('\n\n')}\n`
}
// the formats the text has, by the draft check's rules (detectFormatsOnPage), from its shown sections only
export function formatsInDraft(markdown) {
  const d = splitDraft(markdown)
  const shown = d.sections.filter((s) => !s.kept)
  return detectFormatsOnPage({ title: d.h1, headings: shown.map((s) => s.title), mainText: [d.intro, ...shown.map((s) => s.body)].join('\n') })
}

// a heading and an empty structure to fill in, per format
const TEMPLATES = {
  listicle: (p) => ({ title: `Best options for ${p}`, body: '1. **Option name**: who it suits and why.\n2. **Option name**: who it suits and why.\n3. **Option name**: who it suits and why.' }),
  stats: () => ({ title: 'Key statistics', body: '- **00%**: what it measures (source, year).\n- **00%**: what it measures (source, year).\n- **00%**: what it measures (source, year).' }),
  how_to: (p) => ({ title: `How to ${p.replace(/^how (to|do|does|can)\s+/i, '')}`, body: '1. First step.\n2. Next step.\n3. Last step.' }),
  tutorial: () => ({ title: 'Step-by-step', body: '1. Step one.\n2. Step two.\n3. Step three.' }),
  comparison: () => ({ title: 'Comparison', body: '| | Option A | Option B |\n|---|---|---|\n| Cost | | |\n| Best for | | |' }),
  faq: () => ({ title: 'FAQ', body: '**Question?**\nAnswer.\n\n**Question?**\nAnswer.' }),
  checklist: () => ({ title: 'Checklist', body: '- Item to check\n- Item to check\n- Item to check' }),
  case_study: () => ({ title: 'Case study', body: 'Who, what they needed, what they did, the result.' }),
  template: () => ({ title: 'Template', body: '- Field: what to fill in\n- Field: what to fill in' }),
  research: () => ({ title: 'Our research', body: 'What we looked at, how, and what we found.' }),
}
export const templateFor = (id, prompt) => (TEMPLATES[id] ? TEMPLATES[id](String(prompt || '').trim() || 'this') : null)

// res: the response (contentMarkdown, recommendations, prompt) · value / onChange: the edited parts (DraftStep keeps
// them, so its footer can Save)
export default function DraftEditor({ res, value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch })
  const setSection = (i, patch) => set({ sections: value.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const text = joinDraft(value)
  const covered = useMemo(() => formatsInDraft(text), [text])
  // the formats the winners use that the draft doesn't cover yet (the same list "What this draft adds" reads)
  const wanted = (res.recommendations ?? []).map((r) => r.id).filter((id, i, a) => a.indexOf(id) === i && TEMPLATES[id] && !covered.includes(id))
  const add = (sec) => set({ sections: [...value.sections, sec] })
  const area = 'w-full resize-y rounded-[10px] border border-line bg-surface px-3 py-2 text-[15px] leading-6 text-stone-900 outline-none placeholder:text-stone-400 focus:border-[var(--color-line-strong)]'
  return (
    <div className="mx-auto max-w-[820px]" data-draft-editor>
      <p className="text-[13px] leading-[18px] text-stone-500">Editing the draft. Markdown works: “- ” lists, “1. ” steps, **bold**, | tables |.</p>
      <label className="mt-4 block">
        <span className="text-[13px] leading-[18px] font-medium text-stone-600">Title</span>
        <input value={value.h1} onChange={(e) => set({ h1: e.target.value })} className={`${area} mt-1 text-[22px] leading-8 font-semibold`} />
      </label>
      {value.intro !== '' && (
        <label className="mt-4 block">
          <span className="text-[13px] leading-[18px] font-medium text-stone-600">Intro</span>
          <textarea value={value.intro} onChange={(e) => set({ intro: e.target.value })} rows={3} className={`${area} mt-1`} />
        </label>
      )}
      <ol className="mt-6 flex flex-col gap-6">
        {value.sections.map((s, i) => (s.kept ? null : (
          <li key={i} data-edit-section={s.title} className="border-t border-[var(--div)] pt-4">
            <div className="flex items-center gap-2">
              <input value={s.title} onChange={(e) => setSection(i, { title: e.target.value })} aria-label="Section heading" placeholder="Section heading"
                className={`${area} text-[17px] leading-6 font-semibold`} />
              <button type="button" onClick={() => set({ sections: value.sections.filter((_, j) => j !== i) })} aria-label={`Remove the section ${s.title}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-stone-500 outline-none hover:bg-tint hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"><X size={16} aria-hidden /></button>
            </div>
            <textarea value={s.body} onChange={(e) => setSection(i, { body: e.target.value })} aria-label={`${s.title} text`}
              rows={Math.min(18, Math.max(4, s.body.split('\n').length + 1))} className={`${area} mt-2`} />
          </li>
        )))}
      </ol>
      <div className="mt-8 border-t border-[var(--div)] pt-4" data-add-section>
        <p className="text-[15px] leading-[22px] font-semibold text-stone-900">Add a section</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {wanted.map((id) => (
            <button key={id} type="button" onClick={() => add({ ...templateFor(id, res.prompt), kept: false })} data-template={id}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[14px] font-medium text-stone-700 outline-none hover:bg-tint hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
              <Plus size={14} aria-hidden />{formatLabel(id)}
            </button>
          ))}
          <button type="button" onClick={() => add({ title: '', body: '', kept: false })} data-template="blank"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-[var(--color-line-strong)] px-3 text-[14px] font-medium text-stone-600 outline-none hover:bg-tint hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
            <Plus size={14} aria-hidden />Blank section
          </button>
        </div>
      </div>
    </div>
  )
}
