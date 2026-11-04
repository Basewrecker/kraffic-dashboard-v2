// Opportunities → Content, step 4 (Draft): the pure parts, no React. Tested in model.test.js.
//   markers   [[c:domain]] = a competitor's name · [[confirm]] = a "Confirm with your team" line
//   edits     remove one competitor mention (by field path + nth mark), re-check the flags
//   export    the draft as Markdown and as HTML (markers resolved to names, confirm marks dropped)
//   progress  the generating checklist at a given elapsed time
//   chart     round y-axis ticks for the worked example's line chart
import { escapeHtml, safeHref } from './markdown.js'

// ---- markers ---------------------------------------------------------------------------------------------------
const MARK = /\[\[(c:[^\]\s]+|confirm)\]\]/g

// text → [{ type: 'text', text } | { type: 'competitor', domain, nth } | { type: 'confirm' }]
export function parseMarkers(text) {
  const out = []
  let last = 0
  let nth = 0
  for (const m of String(text ?? '').matchAll(MARK)) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) })
    out.push(m[1] === 'confirm' ? { type: 'confirm' } : { type: 'competitor', domain: m[1].slice(2), nth: nth++ })
    last = m.index + m[0].length
  }
  if (last < String(text ?? '').length) out.push({ type: 'text', text: text.slice(last) })
  return out
}
export const hasConfirm = (text) => parseMarkers(text).some((s) => s.type === 'confirm')

// plain text: competitor marks become names, confirm marks are dropped (and the space before them)
export const plainText = (text, nameOf = (d) => d) =>
  parseMarkers(text).map((s) => (s.type === 'text' ? s.text : s.type === 'competitor' ? nameOf(s.domain) : '')).join('').replace(/\s+$/, '').replace(/\s{2,}/g, ' ')

// every text field of a draft, with a path: fn(text, path) → new text. Returns a new draft.
export function mapText(draft, fn) {
  const list = (arr, key) => arr.map((t, i) => fn(t, `${key}.${i}`))
  return {
    ...draft,
    title: fn(draft.title, 'title'),
    answer: fn(draft.answer, 'answer'),
    keyPoints: list(draft.keyPoints ?? [], 'keyPoints'),
    steps: list(draft.steps ?? [], 'steps'),
    comparison: draft.comparison && {
      columns: list(draft.comparison.columns, 'comparison.columns'),
      rows: draft.comparison.rows.map(([label, cells], i) => [fn(label, `comparison.rows.${i}`), cells]),
    },
    explanation: list(draft.explanation ?? [], 'explanation'),
    example: draft.example && { ...draft.example, text: fn(draft.example.text, 'example.text') },
    faq: (draft.faq ?? []).map(([q, a], i) => [fn(q, `faq.${i}.q`), fn(a, `faq.${i}.a`)]),
  }
}

// the competitor domains still named anywhere in the draft
export function competitorMentions(draft) {
  const found = []
  mapText(draft, (t) => { for (const s of parseMarkers(t)) if (s.type === 'competitor') found.push(s.domain); return t })
  return found
}

// remove the nth competitor mark in the field at `path`: "[[c:x]]'s routine" → "another brand's routine"
// (capitalised at the start of a sentence)
export function removeMention(draft, path, nth) {
  return mapText(draft, (text, p) => {
    if (p !== path) return text
    let i = 0
    return text.replace(/\[\[c:[^\]\s]+\]\]/g, (m, offset) => {
      if (i++ !== nth) return m
      const before = text.slice(0, offset)
      return /(^|[.!?]\s+)$/.test(before) ? 'Another brand' : 'another brand'
    })
  })
}

// ---- flags -----------------------------------------------------------------------------------------------------
export const readiness = (flags) => ({ resolved: flags.filter((f) => f.resolved).length, total: flags.length })
export const isCompetitorFlag = (f) => /competitor/i.test(f.label)
// re-scoring: the competitor flag follows the draft (resolved once no competitor is named; reopened if one is);
// the others keep what the user ticked
export const recheck = (flags, draft) => {
  const named = competitorMentions(draft).length > 0
  return flags.map((f) => (isCompetitorFlag(f) ? { ...f, resolved: !named } : f))
}

// ---- export ----------------------------------------------------------------------------------------------------
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)
export const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
// a source domain → its https URL, or null when it isn't a plain host (http/https only, via new URL)
const sourceUrl = (d) => safeHref(`https://${String(d ?? '').trim()}`)

export function toMarkdown(draft, nameOf) {
  const t = (s) => plainText(s, nameOf)
  const out = [`# ${t(draft.title)}`, '', t(draft.answer), '']
  if (draft.keyPoints?.length) out.push('## Key points', '', ...draft.keyPoints.map((k) => `- ${t(k)}`), '')
  if (draft.steps?.length) out.push('## Steps', '', ...draft.steps.map((s, i) => `${i + 1}. ${t(s)}`), '')
  if (draft.comparison) {
    const { columns, rows } = draft.comparison
    out.push('## Comparison', '', `| | ${columns.map(t).join(' | ')} |`, `|---|${columns.map(() => ':---:').join('|')}|`,
      ...rows.map(([label, cells]) => `| ${t(label)} | ${cells.map((c) => (c ? '✓' : '✕')).join(' | ')} |`), '')
  }
  if (draft.explanation?.length) out.push('## Detailed explanation', '', ...draft.explanation.flatMap((p) => [t(p), '']))
  if (draft.example) {
    const { text, series, xLabel, unit } = draft.example
    out.push('## Worked example', '', t(text), '')
    if (series?.length) out.push(`| ${cap(xLabel)} | ${cap(unit)} |`, '|---:|---:|', ...series.map(([x, y]) => `| ${x} | ${y} |`), '')
  }
  if (draft.faq?.length) out.push('## FAQ', '', ...draft.faq.flatMap(([q, a]) => [`### ${t(q)}`, '', t(a), '']))
  if (draft.sources?.length) out.push('## Sources', '', ...draft.sources.map((d) => `- ${sourceUrl(d)}`), '')
  return out.join('\n')
}

// one escape and one URL guard for every HTML this builds, shared with the v1 serializer (draft/markdown.js)
const esc = (s) => escapeHtml(s ?? '')
export function toHtml(draft, nameOf) {
  const t = (s) => esc(plainText(s, nameOf))
  const out = [`<h1>${t(draft.title)}</h1>`, `<p>${t(draft.answer)}</p>`]
  if (draft.keyPoints?.length) out.push('<h2>Key points</h2>', `<ul>${draft.keyPoints.map((k) => `<li>${t(k)}</li>`).join('')}</ul>`)
  if (draft.steps?.length) out.push('<h2>Steps</h2>', `<ol>${draft.steps.map((s) => `<li>${t(s)}</li>`).join('')}</ol>`)
  if (draft.comparison) {
    const { columns, rows } = draft.comparison
    out.push('<h2>Comparison</h2>', `<table><thead><tr><th></th>${columns.map((c) => `<th>${t(c)}</th>`).join('')}</tr></thead><tbody>${
      rows.map(([label, cells]) => `<tr><th scope="row">${t(label)}</th>${cells.map((c) => `<td>${c ? '✓' : '✕'}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
  }
  if (draft.explanation?.length) out.push('<h2>Detailed explanation</h2>', ...draft.explanation.map((p) => `<p>${t(p)}</p>`))
  if (draft.example) {
    const { text, series, xLabel, unit } = draft.example
    out.push('<h2>Worked example</h2>', `<p>${t(text)}</p>`)
    if (series?.length) out.push(`<table><thead><tr><th>${esc(cap(xLabel))}</th><th>${esc(cap(unit))}</th></tr></thead><tbody>${series.map(([x, y]) => `<tr><td>${esc(x)}</td><td>${esc(y)}</td></tr>`).join('')}</tbody></table>`)
  }
  if (draft.faq?.length) out.push('<h2>FAQ</h2>', ...draft.faq.map(([q, a]) => `<h3>${t(q)}</h3><p>${t(a)}</p>`))
  if (draft.sources?.length) out.push('<h2>Sources</h2>', `<ul>${draft.sources.map((d) => (sourceUrl(d) ? `<li><a href="${esc(sourceUrl(d))}" target="_blank" rel="noopener noreferrer">${esc(d)}</a></li>` : `<li>${esc(d)}</li>`)).join('')}</ul>`)
  return out.join('\n')
}

// ---- generating progress ---------------------------------------------------------------------------------------
// steps: GEN_STEPS ({ id, label, count(n), total, ms }); failAt: the index of the step that fails (at 60% of its time),
// -1 for none. Each row: { status: 'done' | 'current' | 'failed' | 'upcoming', ms (time spent), frac, n (count so far) }
export const FAIL_AT = 0.6
export function genProgress(steps, elapsed, failAt = -1) {
  let start = 0
  let failed = false
  const rows = steps.map((s, i) => {
    const from = start
    start += s.ms
    if (failed) return { status: 'upcoming', ms: 0, frac: 0, n: 0 }
    const spent = Math.max(0, Math.min(elapsed - from, s.ms))
    if (i === failAt && elapsed >= from + s.ms * FAIL_AT) {
      failed = true
      const ms = s.ms * FAIL_AT
      return { status: 'failed', ms, frac: FAIL_AT, n: Math.floor(s.total * FAIL_AT) }
    }
    if (elapsed >= from + s.ms) return { status: 'done', ms: s.ms, frac: 1, n: s.total }
    if (elapsed >= from) { const frac = spent / s.ms; return { status: 'current', ms: spent, frac, n: Math.floor(s.total * frac) } }
    return { status: 'upcoming', ms: 0, frac: 0, n: 0 }
  })
  return { rows, failed, done: !failed && elapsed >= start, totalMs: start }
}
export const fmtSecs = (ms) => `${(ms / 1000).toFixed(1)}s`

// ---- chart -----------------------------------------------------------------------------------------------------
// y from 0 to a round max past the largest value, step from 1 · 2 · 5 · 10 · 20 · 25 · 50 · 100 …, at most 5 ticks
const STEPS = [1, 2, 5, 10, 20, 25, 50]
export function niceAxis(max, maxTicks = 5) {
  const top = Math.max(1, max)
  for (let mag = 1; ; mag *= 10) {
    for (const s of STEPS) {
      const step = s * mag
      const end = Math.floor(top / step) * step + step // strictly past the largest value
      const n = end / step + 1
      if (n <= maxTicks) return { max: end, step, ticks: Array.from({ length: n }, (_, i) => i * step) }
    }
  }
}

// the line the checklist collapses into: "Draft written in 5.0s · 7 pages · 6 claims checked"
export function genSummary(steps) {
  const total = steps.reduce((a, s) => a + s.ms, 0)
  const of = (id) => steps.find((s) => s.id === id)?.total
  return [`Draft written in ${fmtSecs(total)}`, of('read') != null && `${of('read')} pages`, of('claims') != null && `${of('claims')} claims checked`].filter(Boolean).join(' · ')
}

// the pages "Reading page-1 results" reads, as domains: the prompt's cited sources, then its competitors, each once
export const readDomains = (row) => [...new Set([...(row?.sources ?? []).map((s) => s.domain), ...(row?.competitors ?? [])])]

// ---- the draft's session (lifted out of DraftStep so it survives the focus panel closing) ------------------------
// phase 'generating' | 'draft' · startedAt: performance.now() when the writing started (null: not yet) · run: remounts
// the checklist on Retry / Regenerate · the draft and its flags as edited · copied
export const HOLD_MS = 820 // ?co=gen-hold: the writing clock stops here (5 of 7 pages read)
export const draftSession = ({ ready, draft, flags, failAt = -1 }) => ({ phase: ready ? 'draft' : 'generating', startedAt: null, run: 0, failAt, summary: null, draft, flags, copied: false })
// how far the writing is: from its start, stopped at HOLD_MS for screenshots; reduced motion: straight to done
// hold: false, true (HOLD_MS) or the ms to stop at (?co=gen-hold-N)
export const genElapsed = (startedAt, now, { hold = false, instant = false } = {}) => {
  if (instant) return Infinity
  if (startedAt == null) return 0
  const e = Math.max(0, now - startedAt)
  return hold === false || hold == null ? e : Math.min(e, hold === true ? HOLD_MS : hold)
}
// the draft's outline as "Writing" builds it: the H1, then the section headings in the draft's order (DraftBody.jsx)
export const draftOutline = (draft) => [
  { id: 'h1', text: draft.title, h1: true },
  draft.answer && { id: 'answer', text: 'Direct answer' },
  draft.keyPoints?.length && { id: 'key', text: 'Key points' },
  draft.steps?.length && { id: 'steps', text: 'Steps' },
  draft.comparison && { id: 'comparison', text: 'Comparison' },
  draft.explanation?.length && { id: 'explanation', text: 'Detailed explanation' },
  draft.example && { id: 'example', text: 'Worked example' },
  draft.faq?.length && { id: 'faq', text: 'FAQ' },
  draft.sources?.length && { id: 'sources', text: 'Sources' },
].filter(Boolean)
