// Workspace: who's signed in (agency or client user), the current brand and the recently opened ones.
// Switching brand keeps the current page: the main column fades out (150ms), the brand is stored, and the same URL
// reloads so every page reads the new brand (mock.js picks it up as `account`). ?role=client previews a client user;
// ?role=superadmin a superadmin signed in as a client through "Login as client" (the client's brands, and Home).
import { currentBrand, workspaceAgency, workspaceDirectory } from '../data/mock'

const BRAND = 'kraffic:brand'
const RECENT = 'kraffic:brand:recent'
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }

export const allBrands = workspaceDirectory.flatMap((c) => c.brands.map((b) => ({ ...b, client: c.client, clientId: c.id })))
export const role = () => {
  const q = new URLSearchParams(window.location.search).get('role')
  if (q === 'client' || q === 'agency' || q === 'superadmin') { try { localStorage.setItem('kraffic:role', q) } catch { /* ignore */ } return q }
  try { return localStorage.getItem('kraffic:role') ?? 'agency' } catch { return 'agency' }
}
export const brand = currentBrand
// View as: the client an agency opened from the Clients list (same tab); the "Viewing … as" bar reads it, Back clears it
const VIEWING = 'kraffic:viewing'
export const viewingClient = () => { try { return localStorage.getItem(VIEWING) } catch { return null } }
export const setViewing = (name) => { try { name ? localStorage.setItem(VIEWING, name) : localStorage.removeItem(VIEWING) } catch { /* private mode */ } }
// the agency's own pages (agency home): the sidebar footer shows the agency, not a brand
export const onAgencyPage = () => role() === 'agency' && window.location.pathname.startsWith('/clients')
export const agency = workspaceAgency
// a client user (and a superadmin signed in as one) only sees their own client's brands
export const visibleDirectory = () => (role() !== 'agency' ? workspaceDirectory.filter((c) => c.id === brand.clientId) : workspaceDirectory)
export const recentBrands = () => {
  const ids = read(RECENT, null) ?? allBrands.filter((b) => b.data === 'full' || b.id === brand.id).map((b) => b.id) // first visit: the brands with data
  const mine = new Set(visibleDirectory().flatMap((c) => c.brands.map((b) => b.id)))
  return ids.filter((id) => mine.has(id)).map((id) => allBrands.find((b) => b.id === id)).filter(Boolean).slice(0, 3)
}

export function switchBrand(id) {
  if (id === brand.id) return
  const recent = [brand.id, ...read(RECENT, []).filter((x) => x !== id && x !== brand.id)].slice(0, 5)
  try { localStorage.setItem(BRAND, id); localStorage.setItem(RECENT, JSON.stringify(recent)) } catch { /* private mode */ }
  const main = document.querySelector('main')
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (main && !reduce) { main.style.transition = 'opacity 150ms ease-out'; main.style.opacity = '0' }
  setTimeout(() => window.location.reload(), reduce ? 0 : 150)
}
