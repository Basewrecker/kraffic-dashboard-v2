// Copied from the app (lib/fact-check-adapter.js, develop, synced 2026-11-15). Its server is the mock's fake one
// (src/app/lib/api.js). One addition, at the end and marked `mock:`: the sample data is loaded as the module loads,
// because the mock has no loading wrapper around the page.
// Fact Check's data (Optimize → Fact Check, /admin/website-facts): the design mock's page
// (components/mock/pages/facts/WebsiteFactsPage.jsx) on this app's existing route, app/api/website-facts/route.js
// (Harsh's feature; his reading, extracting and checking stay as they are). Nothing new on the server:
//   GET  /api/website-facts?domainUrl=&userId=   { domainUrl, brandName, facts, pages, pagesRead, pagesTried }
//   POST /api/website-facts { action: 'refresh', domainUrl, userId }   read the site again (paid work, one blocking call)
// Saves (confirm / reject / add) are in lib/fact-check-saves.js. "View as": apiClient adds ?userId= to every call
// (lib/api.ts) and the POST body carries it too, because the route reads the POST's user from its body.
//
// The data reaches the page in the mock's shapes (docs/fact-check-handoff.md in the mock, section 4), changed only here:
//   - (owner, 2026-11-11) an outside source's snippet is kept as stored, character for character (it used to lose its
//     source's name)
//   - the pages are ordered by address (the route returns them newest first, all from one read), so the home page
//     comes first and a site section's pages sit together
//   - readAt: when the last read ran, the newest page's fetched_at (a read fetches the pages and checks the sources in
//     the same run, so it dates both "Checked …" lines)
// See docs/proposals-for-harsh.md (Fact Check port).
import { useSyncExternalStore } from 'react'
import { apiClient, viewedUserId } from '@/lib/api'
import { awardFieldOf } from '@/lib/award-claim'

// the most pages one read takes (lib/website-facts.js MAX_PAGES; fact-check-adapter.test.mjs keeps the two equal):
// "Up to 40 pages from your sitemap" before the first read
export const READ_CAP = 40

// holds / failed / results: the saves' state (lib/fact-check-saves.js)
const blank = () => ({ domainUrl: null, facts: [], pages: [], readAt: null, reading: false, readError: null, round: 0, holds: {}, failed: {}, results: {}, cms: null })
let state = blank()
const subs = new Set()
export const factCheckState = () => state
export function setFactCheck(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
  subs.forEach((fn) => fn())
}
const subscribe = (fn) => {
  subs.add(fn)
  return () => subs.delete(fn)
}
export const useFactCheck = () => useSyncExternalStore(subscribe, factCheckState, factCheckState)

// ---- shapes ----------------------------------------------------------------------------------------------------------
export function shapeEvidence(e) {
  const type = e?.source_type || 'WEBSITE'
  const snippet = String(e?.snippet ?? '')
  return {
    url: String(e?.url ?? ''),
    page_title: e?.page_title ?? null,
    snippet,
    source_type: type,
    captured_at: e?.captured_at ?? null, // app (owner, 2026-11-12): when the evidence was captured (Why?'s "Checked <date>")
  }
}
// A stored 'award' that doesn't assert one (an ordinary "best" phrase read before AUD-018's fix) shows as a site claim;
// one the person added themselves is theirs (lib/award-claim.js)
// (AUD-018) the snippet of the site page it was read from is part of what shows it is an award ("Voted Best … 2026 by Money")
const siteSnippetOf = (f) => (f.evidence ?? []).find((e) => e?.snippet && (!e.source_type || e.source_type === 'WEBSITE'))?.snippet ?? ''
export const shapeFact = (f) => ({
  id: String(f.id),
  category: String(f.category ?? 'custom'),
  field: awardFieldOf({ field: String(f.field ?? 'note'), value: String(f.value ?? ''), snippet: siteSnippetOf(f), awardPage: (f.evidence ?? []).some((e) => e?.source_type === 'AWARD_PAGE'), status: f.status }),
  value: String(f.value ?? ''),
  status: f.status,
  source: f.source ?? 'WEBSITE_READ',
  notes: f.notes ?? null,
  evidence: (f.evidence ?? []).filter((e) => e?.url).map(shapeEvidence),
})
export const shapePages = (pages) =>
  (pages ?? [])
    .map((p) => ({ id: String(p.id), url: String(p.url), title: p.title ?? null, http_status: p.http_status ?? null, words: Number(p.words) || 0, ok: !!p.ok, error: p.error ?? null, fetched_at: p.fetched_at }))
    .sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0))
export const readAtOf = (pages) => pages.reduce((at, p) => (p.fetched_at && (!at || Date.parse(p.fetched_at) > Date.parse(at)) ? p.fetched_at : at), null)

function apply(body) {
  const pages = shapePages(body?.pages)
  setFactCheck({ facts: (body?.facts ?? []).map(shapeFact), pages, readAt: readAtOf(pages) })
}

// ---- calls -----------------------------------------------------------------------------------------------------------
const getPath = (domainUrl) => `/website-facts?domainUrl=${encodeURIComponent(domainUrl)}`
export const post = (payload, options = {}) =>
  apiClient('/website-facts', { method: 'POST', ...options, body: JSON.stringify({ ...payload, domainUrl: state.domainUrl || undefined, userId: viewedUserId() || undefined }) })

// the brand's facts and the pages of its last read (a new brand starts from nothing)
export async function loadFactCheck({ domainUrl }) {
  await beforeLeave()
  state = { ...blank(), domainUrl }
  apply(await apiClient(getPath(domainUrl)))
  loadCms(domainUrl)
}

// app (owner, 2026-11-12): the site's CMS, for "Fix this one" (lib/fact-check-rules.js fixLinkOf): the Content page's
// existing read-only GET /api/content/cms (it reads the account's own site; the server caches it a day). Used only
// when it answers for this brand's domain; anything else (an error, another domain) leaves cms null: the live page.
const bareHost = (d) => String(d || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '').replace(/^www\./, '')
export const cmsFor = (body, domainUrl) => (body && !body.error && bareHost(body.domain) && bareHost(body.domain) === bareHost(domainUrl) && (body.cms === 'wordpress' || body.cms === 'shopify') ? body.cms : null)
function loadCms(domainUrl) {
  Promise.resolve().then(() => apiClient('/content/cms')).then((body) => {
    if (state.domainUrl === domainUrl) setFactCheck({ cms: cmsFor(body, domainUrl) })
  }, () => {})
}

// pending saves are sent before a read or another brand (lib/fact-check-saves.js sets this)
let beforeLeave = async () => {}
export const setBeforeLeave = (fn) => { beforeLeave = fn }

// "Read website again" / "Retry" / "Check again": one paid read (Harsh's refresh), then its data. A read that fails
// may still have stored what it got (the pages it couldn't read), so the stored data is loaded again before the error
// line shows.
export async function refresh() {
  if (state.reading) return
  setFactCheck({ reading: true, readError: null })
  try {
    await beforeLeave()
    const body = await post({ action: 'refresh' })
    if (Array.isArray(body?.facts) && Array.isArray(body?.pages)) apply(body)
    else apply(await apiClient(getPath(state.domainUrl)))
    // owner, 2026-11-15: the read finished but Claude isn't connected (the site's claims weren't read): said on the
    // read's line, with Retry
    setFactCheck((s) => ({ reading: false, round: s.round + 1, ...(body?.notice?.message ? { readError: body.notice.message } : {}) }))
  } catch (err) {
    try { apply(await apiClient(getPath(state.domainUrl))) } catch { /* the error line below says enough */ }
    setFactCheck({ reading: false, readError: err?.message || 'The read didn’t finish.' })
  }
}

// mock: the app's wrapper (mock-website-facts.tsx) loads the brand's facts before it draws the page; the mock draws the
// page straight away, so the sample data is put in place here, once
import { sampleFactCheck } from '@/lib/api'
import { account } from '../../data/mock.js'
state = { ...blank(), domainUrl: `https://${account.domain}` }
apply(sampleFactCheck())
