// Card-level states for pages whose cards load separately from the app (the Visibility Overview). Each card has a
// status: { state: 'ready' } (the default), { state: 'loading' }, or { state: 'error', message }. The mock's data is
// instant, so every card is ready unless the address asks for a state:
//   ?cards=loading | error              every card
//   ?cards=history:error,kpis:loading   named cards (keys below)
// Try again on an error card loads that card again (here: a short loading state, then the card).
// Card keys (Overview): kpis, history, coverage, citations, marketplace, visiblePrompts, missedPrompts,
// competitorPrompts, marketplacePrompts, syncHistory, citedPages.
const READY = { state: 'ready' }
const LOADING = { state: 'loading' }
const errorOf = (card) => ({ state: 'error', message: `The ${card === 'kpis' ? 'numbers' : 'card'} couldn’t load.` })

const overrides = {}
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())

function fromAddress(card) {
  let q = null
  try { q = new URLSearchParams(window.location.search).get('cards') } catch { return null }
  if (!q) return null
  if (q === 'loading') return LOADING
  if (q === 'error') return (overrides[`__err:${card}`] ??= errorOf(card))
  const hit = q.split(',').map((s) => s.split(':')).find(([k]) => k === card)
  if (!hit) return null
  return hit[1] === 'loading' ? LOADING : hit[1] === 'error' ? (overrides[`__err:${card}`] ??= errorOf(card)) : null
}

export function cardStatus(card) {
  return overrides[card] ?? fromAddress(card) ?? READY
}
export function subscribeCards(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export function retryCard(card) {
  overrides[card] = LOADING
  emit()
  setTimeout(() => { overrides[card] = READY; emit() }, 600)
}
