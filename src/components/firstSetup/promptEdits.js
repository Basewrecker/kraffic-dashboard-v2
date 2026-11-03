// First-time setup's prompt list: edit, remove and bulk remove. Pure, so the rules are tested on their own
// (promptEdits.test.js). A prompt is { id, text, unsaved? }: unsaved ones live on the page until
// Continue; saved ones are in the app (they have scan history), so removing them asks first.

const key = (t) => String(t ?? '').trim().toLowerCase()

// why an edit can't be saved: 'empty', 'dupe' (another prompt has that text), 'same' (nothing changed), else null
export function editProblem(prompts, id, text) {
  const next = key(text)
  if (!next) return 'empty'
  const row = prompts.find((p) => p.id === id)
  if (row && String(row.text).trim() === String(text).trim()) return 'same'
  if (prompts.some((p) => p.id !== id && key(p.text) === next)) return 'dupe'
  return null
}

// the list with one prompt's text changed (trimmed); other rows untouched
export function renamePrompt(prompts, id, text) {
  const next = String(text ?? '').trim()
  return prompts.map((p) => (p.id === id ? { ...p, text: next } : p))
}

// the list without these ids
export function removePrompts(prompts, ids) {
  const gone = new Set(ids)
  return prompts.filter((p) => !gone.has(p.id))
}

// removing any saved prompt asks first (it has scan history); unsaved ones go at once
export function needsConfirm(prompts, ids) {
  const gone = new Set(ids)
  return prompts.some((p) => gone.has(p.id) && !p.unsaved)
}

// the saved ids among these (the ones the app has to delete)
export function savedIds(prompts, ids) {
  const gone = new Set(ids)
  return prompts.filter((p) => gone.has(p.id) && !p.unsaved).map((p) => p.id)
}

// a checkbox: on → off, off → on
export function toggleId(selected, id) {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

// the selection after the list changed: only ids still in it
export function keepSelected(selected, prompts) {
  const ids = new Set(prompts.map((p) => p.id))
  return new Set([...selected].filter((id) => ids.has(id)))
}

// Until the backend confirms how a prompt's history is keyed, editing a prompt that has
// already been scanned warns that the edit starts a new history. Scanned = saved, and: a Prompt Hub row whose status
// isn't Pending (the rule the page uses for Pending), or a setup row with a last scan date from the app. Unsaved and
// unscanned prompts edit freely.
export const EDIT_HISTORY_WARNING = 'Editing starts a new history for this prompt'
export function hasScanHistory(p) {
  if (!p || p.unsaved) return false
  if (p.status != null) return p.status !== 'pending'
  return Boolean(p.scanned)
}
export const editWarning = (p) => (hasScanHistory(p) ? EDIT_HISTORY_WARNING : null)
