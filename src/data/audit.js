// Site Audit: everything /audit shows, derived from the API-shaped data in mock.js (siteAudit[state]).
// buildAudit(raw) is pure; the page picks the state from ?mock= (full · first · clean · never).
import { siteAudit } from './mock.js'
import { CHECK_POINTS, STATUS_FACTOR } from './auditReference.js'

// ---- the shared vocabulary
export const CATEGORIES = { technical: 'Technical', content: 'Content', speed: 'Speed' }
export const STATUS = {
  fail: { label: 'Failing', rank: 0, weight: 0 },
  warn: { label: 'Needs work', rank: 1, weight: 0.5 },
  pass: { label: 'Passing', rank: 2, weight: 1 },
}
export const IMPACT = { high: { label: 'High', level: 3 }, medium: { label: 'Medium', level: 2 }, low: { label: 'Low', level: 1 } }
export const PAGE_TYPES = { HOME: 'Home', PRODUCT: 'Product', CATEGORY: 'Collection', ARTICLE: 'Article', BLOG: 'Blog', ABOUT: 'Info', CONTACT: 'Info', LEGAL: 'Info', FAQ: 'Info', OTHER: 'Info' }
export const TYPE_PLURAL = { Home: 'Home', Product: 'Products', Collection: 'Collections', Article: 'Articles', Blog: 'Blogs', Info: 'Info' }
export const CODE_CLASSES = [
  { id: '2xx', name: 'OK', fill: 'var(--ink)', bad: false },
  { id: '3xx', name: 'Redirect', fill: 'var(--data-c2)', bad: false },
  { id: '4xx', name: 'Not found', fill: 'var(--negative)', bad: true },
  { id: '5xx', name: 'Server error', fill: 'var(--negative)', bad: true },
]
export const TARGET_MS = 500
export const SLOW_MS = 1000

// "needs action" = Failing + Needs work. One definition, used for every count on the page.
export const needsAction = (c) => c.status !== 'pass'
// Failing → Needs work → Passing, then impact, then pages affected
export const byStatus = (a, b) => STATUS[a.status].rank - STATUS[b.status].rank || IMPACT[b.impact].level - IMPACT[a.impact].level || b.pages.length - a.pages.length
// the plan: impact ÷ effort (quick, valuable wins first)
// the plan: score points it adds ÷ minutes of work (quick, valuable wins first)
export const planScore = (c) => c.adds / c.effort

// first path segment; Shopify blogs keep their blog handle: /blogs/journal/x → /blogs/journal. Home → "/"
export function sectionOf(path) {
  const seg = path.split('/').filter(Boolean)
  if (!seg.length || seg[0] === 'index.html') return '/'
  return seg[0] === 'blogs' && seg[1] ? `/blogs/${seg[1]}` : `/${seg[0]}`
}
export const sectionLabel = (s) => (s === '/' ? 'Home' : s)
export function groupBySection(paths) {
  const groups = new Map()
  for (const p of paths) { const k = sectionOf(p); groups.set(k, [...(groups.get(k) ?? []), p]) }
  return [...groups].map(([section, list]) => ({ section, paths: list })).sort((a, b) => b.paths.length - a.paths.length)
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
// AI readiness: Σ points × status factor (weights in auditReference.js)
const score = (list) => Math.round(list.reduce((n, c) => n + (CHECK_POINTS[c.id] ?? 0) * STATUS_FACTOR[c.status], 0))

export function buildAudit(raw, key = 'full') {
  const domain = raw.website
  if (!raw.lastFinished) return { key, domain, never: true }

  const pages = raw.pages.map((p) => ({
    id: p.id, path: p.path, url: p.url, redirectTo: p.redirectTarget ?? null, pageType: p.pageType, type: PAGE_TYPES[p.pageType] ?? 'Info', depth: p.crawlDepth, ms: p.responseTimeMs, code: p.httpStatus,
    failing: p.failedChecks, warn: p.warnChecks,
  }))
  const total = pages.length
  const site = new Map(raw.siteResults.map((r) => [r.id, r.status]))

  const checks = raw.checks.map((d) => {
    const failOn = pages.filter((p) => p.failing.includes(d.id)).map((p) => p.path)
    const warnOn = pages.filter((p) => p.warn.includes(d.id)).map((p) => p.path)
    const status = d.pageBased ? (failOn.length ? 'fail' : warnOn.length ? 'warn' : 'pass') : site.get(d.id) ?? 'pass'
    const affected = d.pageBased ? (failOn.length ? failOn : warnOn) : []
    const n = affected.length
    return {
      id: d.id, label: d.label, problem: d.problem, category: d.category, appliesTo: d.appliesTo ?? null, impact: d.impact, effort: d.effort, pageBased: d.pageBased,
      status, pages: affected, points: CHECK_POINTS[d.id] ?? 0, adds: (CHECK_POINTS[d.id] ?? 0) * (1 - STATUS_FACTOR[status]), finding: d.finding(n, total), action: d.action(n), why: d.why, fix: d.fix, example: d.example, rule: d.rule,
    }
  })
  const byId = new Map(checks.map((c) => [c.id, c]))
  const open = checks.filter(needsAction).sort(byStatus)
  const failing = checks.filter((c) => c.status === 'fail')

  // per page: every page-based check that applies to its type ('na' ones are left out), as it stands on that page
  const pageChecks = (p) => checks.filter((c) => c.pageBased && (!c.appliesTo || c.appliesTo.includes(p.pageType))).map((c) => ({
    ...c, pageStatus: p.failing.includes(c.id) ? 'fail' : p.warn.includes(c.id) ? 'warn' : 'pass',
  }))
  const pagesOut = pages.map((p) => ({ ...p, section: sectionOf(p.path), failCount: p.failing.length, warnCount: p.warn.length }))

  // biggest blocker: the failing check that touches the most pages, weighted by impact
  const weight = (c) => IMPACT[c.impact].level * Math.max(1, c.pages.length)
  const blocker = [...failing].sort((a, b) => weight(b) - weight(a))[0] ?? null
  const failingPages = pagesOut.filter((p) => p.failCount > 0)

  // where the problems are: one row per section
  const sections = [...new Set(pagesOut.map((p) => p.section))].map((section) => {
    const list = pagesOut.filter((p) => p.section === section)
    // most common problem: most pages failing it, then most pages with it at all, then impact
    const counts = new Map()
    for (const p of list) {
      for (const id of [...p.failing, ...p.warn]) {
        const n = counts.get(id) ?? { fail: 0, all: 0 }
        counts.set(id, { fail: n.fail + (p.failing.includes(id) ? 1 : 0), all: n.all + 1 })
      }
    }
    const top = [...counts].sort(([a, x], [b, y]) => y.fail - x.fail || y.all - x.all || IMPACT[byId.get(b).impact].level - IMPACT[byId.get(a).impact].level)[0]
    return { section, pages: list.length, failing: list.filter((p) => p.failCount).length, common: top ? byId.get(top[0]) : null }
  }).sort((a, b) => b.failing - a.failing || b.pages - a.pages)

  const now = score(checks)
  let since = null
  if (raw.previous) {
    const prev = raw.previous
    const was = (c) => prev.checkStatus[c.id] ?? c.status
    const prevScore = score(checks.map((c) => ({ id: c.id, status: was(c) })))
    const nowPaths = new Set(pages.map((p) => p.path))
    const prevPaths = new Set(prev.paths)
    since = {
      date: fmtDate(prev.sync.finishedAt),
      scoreFrom: prevScore,
      newlyFailing: checks.filter((c) => c.status === 'fail' && was(c) !== 'fail'),
      fixed: checks.filter((c) => c.status === 'pass' && was(c) !== 'pass'),
      added: [...nowPaths].filter((p) => !prevPaths.has(p)),
      removed: [...prevPaths].filter((p) => !nowPaths.has(p)),
      // score per run, oldest first (GAP: run history), ending with this run
      history: [...(prev.history ?? []).map((h) => ({ date: fmtDate(h.finishedAt), score: h.score })), { date: fmtDate(prev.sync.finishedAt), score: prevScore }, { date: fmtDate(raw.lastFinished.finishedAt), score: now }],
    }
  }

  // where the problems are: failing (page × check) pairs per section and category
  const heat = [...new Set(pagesOut.map((p) => p.section))].map((section) => {
    const list = pagesOut.filter((p) => p.section === section)
    const cells = Object.keys(CATEGORIES).map((cat) => list.reduce((n, p) => n + p.failing.filter((id) => byId.get(id)?.category === cat).length, 0))
    return { section, pages: list.length, cells, total: cells.reduce((x, y) => x + y, 0) }
  }).sort((x, y) => y.total - x.total || y.pages - x.pages)

  const pageCache = new Map()
  // site structure: pages that return 2xx only (a redirect isn't a page), per click depth, named by their main types
  const live = pagesOut.filter((p) => p.code >= 200 && p.code < 300)
  const depths = [...new Set(live.map((p) => p.depth))].sort((x, y) => x - y).map((d) => {
    const list = live.filter((p) => p.depth === d)
    const types = new Map()
    for (const p of list) types.set(p.type, (types.get(p.type) ?? 0) + 1)
    const top = [...types].sort((x, y) => y[1] - x[1]).slice(0, 2).map(([t]) => TYPE_PLURAL[t] ?? t)
    return { depth: d, count: list.length, label: d === 0 ? 'Home' : top.map((t, i) => (i ? t.toLowerCase() : t)).join(' & '), paths: list.map((p) => p.path) }
  })
  // status codes: one group per class, with the affected pages
  const codes = CODE_CLASSES.map((c) => ({ ...c, pages: pagesOut.filter((p) => String(p.code)[0] === c.id[0]) })).map((c) => ({ ...c, count: c.pages.length }))
  const sorted = [...pagesOut].sort((a, b) => b.ms - a.ms)
  const median = (() => { const m = [...pages].map((p) => p.ms).sort((a, b) => a - b); const h = m.length >> 1; return m.length % 2 ? m[h] : Math.round((m[h - 1] + m[h]) / 2) })()

  return {
    key, domain, never: false,
    run: { date: fmtDate(raw.lastFinished.finishedAt), pages: total },
    score: now,
    since,
    heat,
    checks, open, failing, blocker, failingPages,
    categories: Object.entries(CATEGORIES).map(([id, label]) => {
      const list = checks.filter((c) => c.category === id).sort(byStatus)
      return { id, label, checks: list, passing: list.filter((c) => c.status === 'pass').length }
    }),
    pages: pagesOut,
    sections,
    crawl: {
      slowest: sorted,
      median,
      overTarget: pages.filter((p) => p.ms > TARGET_MS).length,
      depths,
      codes,
    },
    checkById: (id) => byId.get(id) ?? null,
    codeGroup: (id) => codes.find((c) => c.id === id && c.count > 0) ?? null,
    // stable objects: the drawer keeps the item it was given until the id changes
    pageByPath: (path) => {
      if (!pageCache.has(path)) {
        const p = pagesOut.find((x) => x.path === path)
        pageCache.set(path, p ? { ...p, checks: pageChecks(p) } : null)
      }
      return pageCache.get(path)
    },
  }
}

export const AUDIT_STATES = ['full', 'first', 'clean', 'never', 'errors']
const cache = {}
export const getAudit = (key) => (cache[key] ??= buildAudit(siteAudit[AUDIT_STATES.includes(key) ? key : 'full'], AUDIT_STATES.includes(key) ? key : 'full'))
