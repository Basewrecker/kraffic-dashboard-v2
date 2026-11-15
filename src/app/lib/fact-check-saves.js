// Fact Check's saves, on Harsh's existing actions only (app/api/website-facts/route.js POST: confirm / reject / add):
//   - Keep this one, Drop this fact, Confirm, Dismiss: the page changes at once and the call is held for 5 s, so Undo
//     can take it back (the route has no way back to "waiting"). After 5 s, or when the page is left (unmount, another
//     brand, a read, pagehide: sent with fetch keepalive), the calls go out one fact at a time. A fact whose call fails
//     goes back to where it was and its card shows one line with Retry. A Confirm reports only what saved.
//   - Add a fact: added at once, saved straight away; a failed add is taken back, with Retry.
//   - Use as a fact (Read, but not facts): two calls, add (as your note, with the text) then reject the text; it is
//     done only when both saved. The route has no single action for it (docs/proposals-for-harsh.md).
// State lives in lib/fact-check-adapter.js: holds { [key]: { where, items, applied, sending, sent } }, failed
// { [where]: { message, items?, retry? } } (where: 'call' | 'ready' | 'sheet' | 'text'), results { [key]: { ok, failed } }.
// An item is one fact (or one decision) as the page shows it: { id, ids (the fact and its duplicates), status:
// 'CONFIRMED' | 'REJECTED', drop? }. app (owner, 2026-11-12): drop: ids turned down with it (the other wordings of a
// grouped claim, the other side of a contradiction), sent after ids, in order. An item is all or nothing on the page:
// if any of its calls fails, every fact in it goes back to where it was (the whole decision opens again) and Retry
// sends the whole item again (the route sets a status, so a call sent twice does no harm).
import { factCheckState, post, setBeforeLeave, setFactCheck, shapeFact } from '@/lib/fact-check-adapter'
import { ADD_KINDS } from '@/lib/fact-check-rules'

export const HOLD_MS = 5000
const timers = new Map() // key → { hold, stagger: [] }
const before = new Map() // key → Map(fact id → its status before the save)

const omit = (o, k) => { const n = { ...o }; delete n[k]; return n }
const short = (t) => { const v = String(t ?? ''); return v.length > 60 ? `${v.slice(0, 57)}…` : v }
// a reason the browser itself gave (no connection, a read-only preview) is worth showing; a server's isn't
const detail = (err) => (err && err.statusCode === 0 && err.message ? ` ${err.message}` : '')
const setStatuses = (ids, status) => setFactCheck((s) => ({ facts: s.facts.map((f) => (ids.includes(f.id) ? { ...f, status } : f)) }))
const restore = (prev) => setFactCheck((s) => ({ facts: s.facts.map((f) => (prev.has(f.id) ? { ...f, status: prev.get(f.id) } : f)) }))
const patchHold = (key, patch) => setFactCheck((s) => (s.holds[key] ? { holds: { ...s.holds, [key]: { ...s.holds[key], ...(typeof patch === 'function' ? patch(s.holds[key]) : patch) } } } : {}))
const fail = (where, entry) => setFactCheck((s) => ({ failed: { ...s.failed, [where]: entry } }))
const allIds = (it) => [...it.ids, ...(it.drop ?? [])]
const stopTimers = (key) => {
  const t = timers.get(key)
  if (t) { clearTimeout(t.hold); t.stagger.forEach(clearTimeout) }
  timers.delete(key)
}

// apply now, send after `hold` ms; stagger: the items are applied this many ms apart (the Confirm's rows, one by one)
export function holdSave({ key, where, items, hold = HOLD_MS, stagger = 0 }) {
  if (!items?.length || factCheckState().holds[key]) return
  const ids = items.flatMap(allIds)
  before.set(key, new Map(factCheckState().facts.filter((f) => ids.includes(f.id)).map((f) => [f.id, f.status])))
  setFactCheck((s) => ({ holds: { ...s.holds, [key]: { where, items, applied: new Set(), sending: false, sent: 0 } }, failed: omit(s.failed, where), results: omit(s.results, key) }))
  const t = { hold: null, stagger: [] }
  timers.set(key, t)
  const applyItem = (it) => { setStatuses(it.ids, it.status); if (it.drop?.length) setStatuses(it.drop, 'REJECTED'); patchHold(key, (h) => ({ applied: new Set(h.applied).add(it.id) })) }
  items.forEach((it, i) => (stagger && i ? t.stagger.push(setTimeout(() => applyItem(it), i * stagger)) : applyItem(it)))
  t.hold = setTimeout(() => { send(key) }, Math.max(hold, stagger * (items.length - 1)))
}

// Undo: only while the save is held; the facts go back to where they were
export function undoSave(key) {
  const h = factCheckState().holds[key]
  if (!h || h.sending) return false
  stopTimers(key)
  restore(before.get(key) ?? new Map())
  before.delete(key)
  setFactCheck((s) => ({ holds: omit(s.holds, key) }))
  return true
}

const ACTION = { CONFIRMED: 'confirm', REJECTED: 'reject' }
async function send(key, options = {}) {
  const h = factCheckState().holds[key]
  if (!h || h.sending) return
  stopTimers(key)
  for (const it of h.items) if (!h.applied.has(it.id)) { setStatuses(it.ids, it.status); if (it.drop?.length) setStatuses(it.drop, 'REJECTED') } // left early: every item now
  patchHold(key, { sending: true, sent: 0, applied: new Set(h.items.map((it) => it.id)) })
  const prev = before.get(key) ?? new Map()
  const failedItems = []
  const unsaved = []
  let lastErr = null
  for (const it of h.items) {
    const steps = [...it.ids.map((id) => [id, it.status]), ...(it.drop ?? []).map((id) => [id, 'REJECTED'])]
    for (const [id, status] of steps) {
      try {
        await post({ action: ACTION[status], factId: id }, options.keepalive ? { keepalive: true } : {})
      } catch (err) {
        lastErr = err
        failedItems.push(it)
        unsaved.push(...allIds(it)) // the whole item goes back, not only what didn't save
        break
      }
    }
    patchHold(key, (cur) => ({ sent: cur.sent + 1 }))
  }
  if (unsaved.length) restore(new Map(unsaved.map((id) => [id, prev.get(id) ?? 'DISCOVERED'])))
  before.delete(key)
  const ok = h.items.length - failedItems.length
  setFactCheck((s) => ({ holds: omit(s.holds, key), results: { ...s.results, [key]: { ok, failed: failedItems.length } } }))
  if (failedItems.length) fail(h.where, { message: failMessage(h.where, failedItems, lastErr), items: failedItems })
}
function failMessage(where, items, err) {
  if (where === 'ready') return `${items.length} couldn’t be confirmed.${detail(err)}`
  if (where === 'text') {
    const f = factCheckState().facts.find((x) => x.id === items[0]?.ids[0])
    return `Couldn’t dismiss “${short(f?.value)}”.${detail(err)}`
  }
  if (where === 'sheet') return `The fact sheet change couldn’t be saved.${detail(err)}` // app (owner, 2026-11-12): Remove, Use again
  return `Your call couldn’t be saved.${detail(err)}`
}

// leaving the page: every held save goes out now
export function flushSaves({ keepalive = false } = {}) {
  const keys = Object.keys(factCheckState().holds).filter((k) => !factCheckState().holds[k].sending)
  return Promise.all(keys.map((k) => send(k, { keepalive })))
}
setBeforeLeave(() => flushSaves())

// the failed items of a card, taken off its error line (the page sends them again)
export function takeFailed(where) {
  const entry = factCheckState().failed[where]
  setFactCheck((s) => ({ failed: omit(s.failed, where) }))
  return entry?.items ?? []
}
// Retry: sent again at once (no hold)
export function retrySaves(where) {
  const entry = factCheckState().failed[where]
  if (!entry) return
  setFactCheck((s) => ({ failed: omit(s.failed, where) }))
  if (entry.retry) { entry.retry(); return }
  holdSave({ key: `${where}:retry:${Date.now()}`, where, items: entry.items, hold: 0 })
}

// ---- Add a fact ----------------------------------------------------------------------------------------------------
let seq = 0
const KINDS = ADD_KINDS.flatMap((g) => g.items)
export async function addFact(field, value) {
  const kind = KINDS.find((it) => it.field === field)
  const text = String(value ?? '').trim()
  if (!kind || !text) return null // only the kinds the route accepts
  const temp = { id: `adding-${(seq += 1)}`, category: kind.category, field, value: text, status: 'ADDED_BY_YOU', source: 'YOU', notes: null, evidence: [] }
  setFactCheck((s) => ({ facts: [...s.facts, temp], failed: omit(s.failed, 'sheet') }))
  try {
    const body = await post({ action: 'add', value: text, field, category: kind.category })
    const fact = shapeFact({ ...body.fact, evidence: [] })
    setFactCheck((s) => ({ facts: s.facts.map((f) => (f.id === temp.id ? fact : f)) }))
    return fact
  } catch (err) {
    setFactCheck((s) => ({ facts: s.facts.filter((f) => f.id !== temp.id) }))
    fail('sheet', { message: `Couldn’t add “${short(text)}”.${detail(err)}`, retry: () => addFact(field, text) })
    return null
  }
}

// ---- Use as a fact -------------------------------------------------------------------------------------------------
const taken = new Map() // a text whose add saved but whose reject didn't: its new fact, so Retry doesn't add it twice
export async function takeAsFact(f) {
  setFactCheck((s) => ({ failed: omit(s.failed, 'text') }))
  const retry = async () => { const fact = await takeAsFact(f); if (fact) placeTakenFact(f.id, fact) }
  let fact = taken.get(f.id)
  if (!fact) {
    try {
      const body = await post({ action: 'add', value: f.value, field: 'note', category: 'custom' })
      fact = shapeFact({ ...body.fact, evidence: [] })
    } catch (err) {
      fail('text', { message: `Couldn’t use “${short(f.value)}” as a fact.${detail(err)}`, retry })
      return null
    }
  }
  try {
    await post({ action: 'reject', factId: f.id })
  } catch (err) {
    taken.set(f.id, fact)
    setFactCheck((s) => ({ facts: s.facts.some((x) => x.id === fact.id) ? s.facts : [...s.facts, fact] })) // it was added
    fail('text', { message: `Added “${short(f.value)}” to the fact sheet, but couldn’t take it off this list.${detail(err)}`, retry })
    return null
  }
  taken.delete(f.id)
  return fact
}
// both saved: the new fact joins the sheet and the text leaves the list
export function placeTakenFact(textId, fact) {
  setFactCheck((s) => ({
    facts: (s.facts.some((x) => x.id === fact.id) ? s.facts : [...s.facts, fact]).map((x) => (x.id === textId ? { ...x, status: 'REJECTED' } : x)),
  }))
}
