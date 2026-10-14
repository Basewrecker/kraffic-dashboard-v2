// Billing state for this tab: seeded from mock.js (?mock=trial|paid|near|failed|agency), changed by the confirm
// drawer (switch plan), cancel and "add payment method". Selectors for usage rows, plan fit and downgrade blockers.
import { useSyncExternalStore } from 'react'
import { billingLive, billingPlans, billingStates, billingToday } from '../../data/mock.js'

const listeners = new Set()
const emit = () => listeners.forEach((l) => l())
const overrides = {} // per mock key
export const stateKey = () => {
  const k = new URLSearchParams(window.location.search).get('mock')
  if (billingStates[k]) return k
  try { return localStorage.getItem('kraffic:role') === 'client' ? 'paid' : 'agency' } catch { return 'agency' } // agency users see the agency's billing
}
// production: billing isn't live (no provider; limits off). mock.js billingLive, or ?live=1 on a billing URL
export const isLive = () => billingLive || new URLSearchParams(window.location.search).get('live') === '1'
let snap = { key: null, value: null }
const get = () => {
  const key = stateKey()
  const value = { ...billingStates[key], ...(overrides[key] ?? {}) }
  if (snap.key !== key || snap.value?.__v !== (overrides[key]?.__v ?? 0)) snap = { key, value: { ...value, __v: overrides[key]?.__v ?? 0 } }
  return snap.value
}
export function update(patch) {
  const key = stateKey()
  overrides[key] = { ...(overrides[key] ?? {}), ...patch, __v: (overrides[key]?.__v ?? 0) + 1 }
  emit()
}
export const useBilling = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, get, get)

export const planById = (id) => billingPlans.find((p) => p.id === id)
export const money = (cents, { decimals = false } = {}) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 })}`
export const fmtDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
export const fmtShort = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
export const daysUntil = (iso) => Math.max(0, Math.round((Date.parse(iso) - Date.parse(billingToday)) / 86400000))
export const priceOf = (plan, interval) => (interval === 'year' ? plan.priceYearly : plan.priceMonthly)

// the usage rows a workspace sees — only limits the plan really has (production limit.* keys)
export const USAGE = [
  { key: 'prompts', label: 'Tracked prompts', live: true, word: 'prompts', fix: 'Remove' },
  { key: 'projects', label: 'Brands', live: true, word: 'brands', fix: 'Archive' },
  { key: 'clients', label: 'Clients', live: true, word: 'clients', fix: 'Archive', agencyOnly: true },
  { key: 'users', label: 'Team seats', live: true, word: 'team members', fix: 'Remove' },
  { key: 'crawl_pages_monthly', label: 'Pages crawled', live: false, word: 'pages crawled', fix: null },
  { key: 'ai_runs_monthly', label: 'AI answer checks', live: false, word: 'AI answer checks', fix: null },
]
export function usageRows(b) {
  const plan = planById(b.planId)
  return USAGE.filter((u) => b.usage[u.key] != null && (!u.agencyOnly || b.orgType === 'AGENCY')).map((u) => {
    const limit = plan.limits[u.key]
    const used = b.usage[u.key]
    return { ...u, used, limit, unlimited: limit === -1, pct: limit > 0 ? used / limit : 0, left: limit > 0 ? Math.max(0, limit - used) : null,
      meta: u.live ? 'Right now' : `Resets ${fmtShort(b.currentPeriodEnd)}` }
  })
}
// the plans this workspace can pick (production: direct clients see STARTER / GROWTH / ENTERPRISE; agencies AGENCY / ENTERPRISE)
export const plansFor = (b) => billingPlans.filter((p) => (b.orgType === 'AGENCY' ? p.tier === 'AGENCY' || p.tier === 'ENTERPRISE' : !p.agencyOnly))
const covers = (plan, usage) => Object.entries(usage).every(([k, v]) => plan.limits[k] == null || plan.limits[k] === -1 || v <= plan.limits[k])
export const fitsPlan = (b) => plansFor(b).find((p) => covers(p, b.usage)) ?? null
// what blocks a downgrade: live counts over the new plan's limits (monthly counters reset, so they only warn)
export function overLimits(b, plan) {
  return USAGE.filter((u) => b.usage[u.key] != null && plan.limits[u.key] != null && plan.limits[u.key] !== -1 && b.usage[u.key] > plan.limits[u.key])
    .map((u) => ({ ...u, used: b.usage[u.key], limit: plan.limits[u.key], over: b.usage[u.key] - plan.limits[u.key] }))
}
// "You'll hit your prompt limit around Oct 28 at this pace" from the prompt history (GAP: no usage history in production)
export function forecast(b) {
  if (!b.history || b.history.length < 2) return null
  const plan = planById(b.planId)
  const limit = plan.limits.prompts
  if (limit === -1) return null
  const first = b.history[0], last = b.history.at(-1)
  const perDay = (last.prompts - first.prompts) / ((Date.parse(last.date) - Date.parse(first.date)) / 86400000)
  if (perDay <= 0) return { text: 'Prompt usage is flat; you won’t hit your limit at this pace.', perDay }
  const days = (limit - last.prompts) / perDay
  const at = new Date(Date.parse(last.date) + days * 86400000).toISOString().slice(0, 10)
  if (at > b.currentPeriodEnd && days > 60) return { text: 'At this pace you won’t hit your prompt limit for months.', perDay }
  return { text: `You’ll hit your prompt limit around ${fmtShort(at)} at this pace.`, perDay, at }
}
// prorated charge today when switching mid-period (production: only an unused `prorationBehavior` param exists)
export function prorate(b, plan, interval) {
  const cur = planById(b.planId)
  const start = Date.parse(b.currentPeriodStart), end = Date.parse(b.currentPeriodEnd), now = Date.parse(billingToday)
  const left = Math.max(0, (end - now) / (end - start))
  const sameInterval = interval === b.interval
  if (b.status === 'TRIALING') return 0
  if (!sameInterval) return priceOf(plan, interval) // a new period starts today
  return Math.max(0, Math.round((priceOf(plan, interval) - priceOf(cur, b.interval)) * left))
}
