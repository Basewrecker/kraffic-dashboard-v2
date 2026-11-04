// Opportunities → Content workspace: the pure parts (where a prompt's workspace starts, the step-2 scales, the step-3
// summary). No React here, so node --test can run it.

export const STEPS = [
  { id: 'connect', title: 'Connect Search Console', short: 'Search Console' },
  { id: 'target', title: 'Choose the target page', short: 'Target page' },
  { id: 'data', title: 'Add your own data', short: 'Your data', optional: true },
  { id: 'draft', title: 'Draft', short: 'Draft' },
  { id: 'publish', title: 'Publish and track', short: 'Publish and track' },
]

// Where the workspace opens (step index 0–4):
//   no draft → step 1 while Search Console isn't connected ('new' or 'declined'), else step 2 (step 1 auto-skipped)
//   draft at stage 'draft' → step 4, the draft already written (ready)
//   any later stage (waiting · monitoring · improved · nochange) → step 5
export function startOf(draft, gsc) {
  if (!draft) return { current: gsc === 'connected' ? 1 : 0, ready: false }
  if (draft.stage === 'draft') return { current: 3, ready: true }
  return { current: 4, ready: true }
}

// the target page a workspace starts with: the saved draft's page, else the best-ranked candidate, else a new page
export function startTarget(draft, candidates, newPage, pathOf) {
  if (draft?.target_url) return draft.action === 'create' ? { kind: 'new', slug: pathOf(draft.target_url) } : { kind: 'page', url: draft.target_url }
  if (candidates.length) return { kind: 'page', url: candidates[0].url }
  return { kind: 'new', slug: newPage.slug }
}

// impressions bars: one scale for every row, the biggest row fills the track; a non-zero row stays visible (2%)
export function barPct(value, max) {
  if (!max || !value) return 0
  return Math.max(2, Math.round((value / max) * 100))
}

// a sparkline as SVG polyline points, inside w×h with `pad` px clear of the edges; flat data sits in the middle
export function sparkPoints(values, w = 24, h = 8, pad = 1) {
  if (!values?.length) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0
  return values.map((v, i) => {
    const y = span ? pad + (1 - (v - min) / span) * (h - pad * 2) : h / 2
    return `${+(pad + i * step).toFixed(2)},${+y.toFixed(2)}`
  }).join(' ')
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const filled = (f) => f.label.trim() && f.value.trim()

// step 3 in one line: "2 files · 2 facts · 1 of 3 answered"; nothing added → null (the caller says "Skipped")
export function dataSummary({ uploads, facts, questions, pasted }) {
  const parts = []
  if (uploads.length) parts.push(plural(uploads.length, 'file'))
  if (pasted.trim()) parts.push('pasted text')
  const nFacts = facts.filter(filled).length
  if (nFacts) parts.push(plural(nFacts, 'fact'))
  const answered = questions.filter((q) => q.answer.trim()).length
  if (answered) parts.push(`${answered} of ${questions.length} answered`)
  return parts.length ? parts.join(' · ') : null
}

// an uploaded file's kind from its name (the chip's icon)
export function fileKind(name) {
  const ext = name.split('.').pop().toLowerCase()
  if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') return 'csv'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext)) return 'image'
  if (ext === 'docx' || ext === 'doc') return 'docx'
  return 'pdf'
}

export function fileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// 4210 → "4.2k", 12400 → "12k", 940 → "940" (the target list's muted line)
export function compactNum(n) {
  if (n < 1000) return String(n)
  const k = n / 1000
  return `${k >= 10 ? Math.round(k) : +k.toFixed(1)}k`
}

// "What AI says now", per engine: named (the brand is in the answer; row.platforms lists where it's MISSING) and, where
// it's missed, the brand named first there (the first of row.brandsMentioned seen on that engine; not the user's own)
export function engineVerdicts(row, engines, own) {
  return engines.map((engine) => {
    const named = !(row?.platforms ?? []).includes(engine)
    const first = named ? null : (row?.brandsMentioned ?? []).find((b) => b.domain !== own && b.platforms.includes(engine))?.domain ?? null
    return { engine, named, first }
  })
}

// a finished step's chosen value, for the rail (null: nothing to show)
export function stepValue(i, { gsc, gscDomain, target, data, dataSkipped, draft }) {
  if (i === 0) return gsc === 'connected' ? gscDomain : 'Not connected'
  if (i === 1) return target.kind === 'new' ? `New: ${target.slug}` : target.path
  if (i === 2) return (!dataSkipped && dataSummary(data)?.replace(/^./, (c) => c.toUpperCase())) || 'Skipped'
  if (i === 3) return draft?.stage === 'waiting' ? 'Copied' : draft ? 'Published' : 'Ready'
  return null
}

// round ticks for a chart axis (DESIGN.md Charts): a step of 1, 2, 2.5 or 5 × 10^n, the smallest that fits the tallest
// value in at most 4 steps; the axis then goes up to the first tick at or above it
export function niceStep(max) {
  const p = 10 ** Math.floor(Math.log10(Math.max(1, max) / 4))
  for (const m of [1, 2, 2.5, 5, 10, 20]) if (Math.ceil(max / (m * p)) <= 4) return m * p
  return 20 * p
}

// ---- focus mode ("centre stage", steps 3–5) ----------------------------------------------------------------------
// The workspace is in focus mode whenever the open step is 3, 4 or 5 (index ≥ 2) unless the user exited it on that very
// step; any change of the open step clears the exit (so the next time step 3–5 opens, focus mode opens again), and going
// back to step 1 or 2 closes it.
export const FOCUS_FROM = 2
export const inFocus = (open, exitedOn) => open >= FOCUS_FROM && exitedOn !== open
// the exit flag after the open step changes: kept only while the step stays the same
export const exitAfter = (prevOpen, open, exitedOn) => (open === prevOpen ? exitedOn : null)
// where a prompt opens: a published one (tracking, improved, no change) is finished, so it opens on the page, not in focus
export const startExited = (draft, current) => (draft && !['draft', 'waiting'].includes(draft.stage) && current === 4 ? 4 : null)

// The page's payoff bar while steps 3–5 are under way and the focus panel is closed (the page never shows those steps):
// what the step is doing, live, and Resume. open: the step (2 Your data · 3 Draft · 4 Publish) · gen: genProgress() of the
// writing · phase: the draft's 'generating' | 'draft' · flags · data / dataSkipped · stage · week · path: the target
// → { kind, headline, line, busy } (busy: the headline gets a small turning ring)
export function resumeState({ open, phase, gen, flags = [], data, dataSkipped = false, stage, week = 0, path = '', steps = [] }) {
  if (open === 2) return { kind: 'data', headline: 'Adding your data', line: (!dataSkipped && dataSummary(data)?.replace(/^./, (c) => c.toUpperCase())) || 'Nothing added yet · everything is optional', busy: false }
  if (open === 3 && phase === 'generating') {
    const n = gen.rows.length
    const done = gen.rows.filter((r) => r.status === 'done').length
    if (gen.failed) return { kind: 'failed', headline: 'The draft stopped', line: `${steps[done]?.label ?? 'Writing'} didn’t finish · retry in the draft`, busy: false }
    const at = Math.min(n - 1, done)
    return { kind: 'writing', headline: 'Writing the draft…', line: `${at + 1} of ${n} · ${steps[at]?.label ?? ''}`.replace(/ · $/, ''), busy: true }
  }
  if (open === 3) {
    const left = flags.filter((f) => !f.resolved).length
    return { kind: 'ready', headline: left ? `Draft ready · ${left} ${left === 1 ? 'flag' : 'flags'} to resolve` : 'Draft ready to copy', line: `${flags.length - left}/${flags.length} flags resolved`, busy: false }
  }
  if (stage && stage !== 'draft' && stage !== 'waiting') return { kind: 'tracking', headline: 'Monitoring the engines', line: `${path} · week ${Math.max(1, week)} of 4`, busy: false }
  return { kind: 'waiting', headline: 'Waiting for you to publish', line: path, busy: false }
}

// ---- Your data, as three tasks (focus mode) ------------------------------------------------------------------------
// an upload reads for `ms` from addedAt, then it's read
export const uploadState = (file, now, ms) => {
  const e = now - (file.addedAt ?? 0)
  return e >= ms ? { reading: false, frac: 1 } : { reading: true, frac: Math.max(0, e / ms) }
}
// the facts the read files found that aren't in the table yet (same label) and weren't dismissed
// factsFound: (file) => { n, suggestions: [{ label, value, from, key }] }
export function suggestionsFor({ uploads, facts, dismissed = [] }, factsFound, now, ms) {
  const have = new Set(facts.map((f) => f.label.trim().toLowerCase()))
  const seen = new Set()
  return uploads.filter((u) => !uploadState(u, now, ms).reading).flatMap((u) => factsFound(u).suggestions)
    .filter((s) => { const k = s.label.toLowerCase(); if (have.has(k) || seen.has(k) || dismissed.includes(s.key)) return false; seen.add(k); return true })
}
// each task's done: ① a file or pasted text · ② a filled fact · ③ every question answered
export const dataTasks = ({ uploads, facts, questions, pasted }) => [
  uploads.length > 0 || Boolean(pasted.trim()),
  facts.some(filled),
  questions.length > 0 && questions.every((q) => q.answer.trim()),
]

// ---- Draft step v1: the steps that exist ------------------------------------------------------------------------
// v1 shows the steps content-recommend supports: Target page (index 1) → Draft (3) → Copy & publish (4). ?backend=full
// shows all five (Search Console, Your data, Publish & track). The flow keeps its 0–4 indices either way; only the
// visible list changes. → [{ i, title, short }]
export const stepsFor = (full) => (full
  ? STEPS.map((s, i) => ({ ...s, i }))
  : [{ ...STEPS[1], i: 1, title: 'Target page', short: 'Target page' }, { ...STEPS[3], i: 3 }, { id: 'copy', i: 4, title: 'Copy & publish', short: 'Copy & publish' }])
// the next visible step after c (or c when it's the last)
export const nextVisible = (steps, c) => steps.find((s) => s.i > c)?.i ?? c
// where a step sits among the visible ones: "2 of 3"
export const stepPos = (steps, i) => ({ n: Math.max(1, steps.findIndex((s) => s.i === i) + 1), of: steps.length })
