// The account's plan and how much of it is used (mock data). The app: lib/plans.js (planOf, roomPill, shownLimits).
// Plan names, counts and feature rows are data in the app (the GEO Packages sheet), never fixed copy.
// ?usage= previews the states the local data can't reach: warn (85% used, amber ring) · near (96%, red ring and
// "· Upgrade") · limit (at the limit: adding is off, with the reason) · over (over the limit: a client still sees the
// limit, never "210 of 200"; ?as=superadmin shows how far over).
import { kpis } from '../data/mock.js'

const q = () => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
export const PLAN = { id: 'growth', name: 'Growth', prompts: 200, competitors: 5, logins: 3 }
const PREVIEW = { warn: 170, near: 192, limit: 200, over: 221 }

export const isSuperadmin = () => q().get('as') === 'superadmin'
// prompts are counted across all the account's brands
export function promptUsage() {
  const real = PREVIEW[q().get('usage')] ?? kpis.total
  const limit = PLAN.prompts
  const used = Math.min(real, limit) // a client never sees a count above the limit
  return { used, limit, real, over: Math.max(0, real - limit), left: Math.max(0, limit - real), pct: Math.min(1, real / limit), atLimit: real >= limit }
}
// competitors on the brand in view; ?competitors=limit previews a brand at its plan's limit
export function competitorRoom(count) {
  const limit = PLAN.competitors
  const real = q().get('competitors') === 'limit' ? Math.max(count, limit) : count
  return { used: Math.min(real, limit), limit, real, over: Math.max(0, real - limit), atLimit: real >= limit }
}
// the ring's colour: ink, amber from 80% used, red from 95% (the number beside it is always grey)
export const ringTone = (pct) => (pct >= 0.95 ? 'full' : pct >= 0.8 ? 'warn' : 'ok')
// the plan pill's words: "79 prompts left", and from 95% used "5 prompts left · Upgrade"
export function roomPill() {
  const u = promptUsage()
  return { ...u, upgrade: u.pct >= 0.95, tip: `${u.used} of ${u.limit} used, counted across all your brands.` }
}
export const PLANS_HREF = '/plans'
// why adding is off at the limit (Prompt Hub's Add prompt, Import and Research; Brand Setup's Add competitor)
export const LIMIT_REASON = {
  prompts: (u) => `Your plan tracks ${u.limit} prompts and all ${u.limit} are in use. Remove a prompt or upgrade to add more.`,
  competitors: (u) => `Your plan includes ${u.limit} competitors and this brand has ${u.limit}. Remove one or upgrade to add more.`,
}
