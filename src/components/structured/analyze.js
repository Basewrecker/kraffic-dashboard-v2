// Structured Data: everything the page shows, worked out from the crawl (data: crawlPages, shaped like the API's
// GET /crawl/schema-validator) and the schema reference (src/lib/schema-reference.js).
//   schemas  every schema found on the site, plus the reference schemas that belong on the page types present
//   a schema applies to a page when the page's type is one it belongs on, or when the page carries it anyway
//   issues   error → the schema is Invalid on that page and needs a fix · warning → a fix item · info → a field warning
import { SD, crawlPages } from '../../data/structuredData'
import { PAGE_TYPE_LABEL, PAGE_TYPE_ORDER, SCHEMA_REFERENCE } from '../../lib/schema-reference'

export const IMPORTANCE = { required: 'Required', recommended: 'Recommended', optional: 'Optional' }
export const STATUS = { valid: 'Valid', invalid: 'Invalid', missing: 'Missing' }
export const IMPACT_LEVEL = { high: 3, medium: 2, low: 1 }
const IMPACT_BY_IMPORTANCE = { required: 'high', recommended: 'medium', optional: 'low' }
const IMP_RANK = { required: 0, recommended: 1, optional: 2 }

const fill = (t) => (typeof t === 'string' ? t.replaceAll('{brand}', SD.brand).replaceAll('{domain}', SD.domain) : t)
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
// the schema type an issue is about: the segment of its path that's one of the page's types
// ("Product.offers[0]", "@graph[2].Product", "Organization.logo"); null when the path names none
const typeOf = (issue, page) => String(issue.path ?? '').split('.').map((seg) => seg.replace(/\[\d+\]$/, '')).find((seg) => page.schemaTypes.includes(seg)) ?? null
const unique = (xs) => [...new Set(xs)]

// the crawled pages; `kind` is the page type
export const pages = crawlPages.map((p) => ({ ...p, kind: p.pageType }))
export const PAGE_COUNT = pages.length
// page types present, in plain English, home first
export const KINDS = Object.fromEntries(
  unique(pages.map((p) => p.kind))
    .sort((a, b) => (PAGE_TYPE_ORDER.indexOf(a) + 1 || 99) - (PAGE_TYPE_ORDER.indexOf(b) + 1 || 99))
    .map((t) => [t, PAGE_TYPE_LABEL[t] ?? t.charAt(0) + t.slice(1).toLowerCase()]),
)
export const isPageType = (t) => Object.hasOwn(KINDS, t)

// a URL typed into "One page": a page in the latest crawl
export function pageFor(input) {
  let path
  try {
    const u = new URL(/^https?:\/\//.test(input) ? input : `https://${SD.domain}${input.startsWith('/') ? '' : '/'}${input}`)
    if (u.hostname.replace(/^www\./, '') !== SD.domain) return { error: `Enter a page on ${SD.domain}` }
    path = u.pathname.replace(/\/+$/, '') || '/'
  } catch { return { error: 'Enter a valid URL' } }
  return pages.find((p) => p.path === path) ?? { error: 'This page isn’t in the latest crawl' }
}

const present = new Set(pages.map((p) => p.kind))
const foundTypes = unique(pages.flatMap((p) => p.schemaTypes))
const inScope = unique([
  ...Object.keys(SCHEMA_REFERENCE).filter((t) => SCHEMA_REFERENCE[t].pageTypes.some((pt) => present.has(pt))),
  ...foundTypes,
])
export const schemas = inScope.map((type) => {
  const ref = SCHEMA_REFERENCE[type] ?? {}
  const belongs = ref.pageTypes ?? []
  const applies = (p) => belongs.includes(p.kind) || p.schemaTypes.includes(type)
  return {
    id: slug(type), name: type, type,
    importance: ref.importance ?? 'optional', suggest: Boolean(ref.suggest), impact: ref.impact, effort: ref.effort, action: ref.action,
    desc: fill(ref.desc ?? `${type} markup`), why: fill(ref.why ?? 'Structured data engines can read.'), how: ref.how, doc: ref.doc ?? `https://schema.org/${type}`,
    snippet: ref.snippet ? ref.snippet({ brand: SD.brand, domain: SD.domain }) : null,
    problemWords: ref.problems ?? {},
    applies,
    has: (p) => p.schemaTypes.includes(type),
    issuesOn: (p) => p.issues.filter((i) => typeOf(i, p) === type),
    pageTypes: Object.keys(KINDS).filter((k) => pages.some((p) => p.kind === k && applies(p))),
  }
})
export const schemaById = (id) => schemas.find((s) => s.id === id)

// "Used on": where a schema applies, in words: "Home", "Product pages", "Home & blog posts", "All pages"
function usedOnLabel(applicable, scopeSize) {
  if (!applicable.length) return ''
  if (applicable.length === scopeSize && scopeSize > 1) return 'All pages'
  if (applicable.length === scopeSize - 1 && scopeSize > 2 && !applicable.some((p) => p.kind === 'HOME')) return 'All but the home page'
  const kinds = Object.keys(KINDS).filter((k) => applicable.some((p) => p.kind === k))
  if (kinds.length > 2) return `${kinds.length} page types`
  const words = kinds.map((k, i) => (i ? KINDS[k].toLowerCase() : KINDS[k]))
  return words.join(' & ')
}
// a step's title when the reference has none for this issue: a missing required property → "Add “url” to Organization";
// anything else → "Fix Organization: <what the crawl found>"
const actionFor = (issue, name) => {
  const field = issue.message.match(/missing required property “([^”]+)”/)?.[1]
  return field ? `Add “${field}” to ${name}` : `Fix ${name}: ${issue.message.replace(/\.$/, '')}`
}
const whereOf = (issue, name) => {
  const path = String(issue.path ?? '').replace(/^@graph\[\d+\]\.?/, '')
  if (path.includes('.')) return path
  const field = issue.message.match(/missing required property “([^”]+)”/)?.[1]
  return field ? `${name}.${field}` : issue.message
}
const steps = (fix) => (Array.isArray(fix) ? fix : fix ? [fix] : [])
const label = (score) => (score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Poor')

// one page, one page type, or the whole site → rows + KPIs for every tab
export function analyze(page = null, kind = null) {
  const list = page ? [page] : kind ? pages.filter((p) => p.kind === kind) : pages
  const rows = schemas.map((s) => {
    const applicable = list.filter(s.applies)
    const carries = applicable.filter(s.has)
    const found = carries.map((p) => p.path)
    const missing = applicable.filter((p) => !s.has(p)).map((p) => p.path)
    // the issues on this schema, on the pages in scope that carry it, grouped by code
    const byCode = new Map()
    for (const p of carries) for (const i of s.issuesOn(p)) {
      if (!byCode.has(i.code)) byCode.set(i.code, { issue: i, on: [] })
      byCode.get(i.code).on.push(p)
    }
    const groups = [...byCode.values()]
    const problems = groups.filter((g) => g.issue.severity !== 'info')
    const invalid = unique(problems.filter((g) => g.issue.severity === 'error').flatMap((g) => g.on.map((p) => p.path)))
    const warnings = [
      ...groups.filter((g) => g.issue.severity === 'info').map((g) => [g.issue.message, g.on.map((p) => p.path)]),
      ...problems.filter((g) => g.issue.severity !== 'error').map((g) => [g.issue.message, g.on.map((p) => p.path)]),
    ]
    const status = invalid.length ? 'invalid' : missing.length ? 'missing' : 'valid'
    const kinds = unique(applicable.filter((p) => missing.includes(p.path) || invalid.includes(p.path)).map((p) => KINDS[p.kind]))
    const fixes = problems.map(({ issue, on }) => {
      const words = s.problemWords[issue.code] ?? {}
      const level = issue.severity === 'error' ? 'error' : 'warning'
      return {
        id: `${s.id}--${slug(issue.code)}`, kind: 'fix', schemaId: s.id, name: `${s.name} · ${issue.message}`, title: issue.message,
        action: words.action ?? actionFor(issue, s.name),
        effort: words.effort ?? 15, level, status: level === 'error' ? 'invalid' : 'warning', importance: s.importance,
        impact: words.impact ?? (level === 'error' ? IMPACT_BY_IMPORTANCE[s.importance] : 'low'), desc: issue.message,
        why: fill(words.why ?? s.why), how: steps(issue.fix).length ? steps(issue.fix) : undefined, snippet: issue.example ?? s.snippet, doc: s.doc, type: s.name,
        affected: on.map((p) => p.path), applicable: applicable.length, usedOn: usedOnLabel(on, list.length),
        kinds: unique(on.map((p) => KINDS[p.kind])), found: [], missing: [], invalid: [], warnings: [],
      }
    })
    const firstError = problems.find((g) => g.issue.severity === 'error')
    // where: the broken field ("Organization.logo"; a missing required property → "Organization.url"), else what's wrong
    const error = firstError && { code: firstError.issue.code, where: whereOf(firstError.issue, s.name), why: fill((s.problemWords[firstError.issue.code] ?? {}).why ?? s.why), lastValid: null }
    return {
      ...s, kind: 'schema', applicable: applicable.length, usedOn: usedOnLabel(applicable, list.length), found, missing, invalid, warnings, status, fixes, error,
      impact: s.impact ?? IMPACT_BY_IMPORTANCE[s.importance], kinds, affected: invalid.length ? invalid : missing,
    }
  }).filter((r) => r.applicable > 0)
  const req = rows.filter((r) => r.importance === 'required')
  const add = rows.filter((r) => r.importance === 'recommended')
  const invalid = rows.filter((r) => r.status === 'invalid')
  const byImpact = (a, b) => IMPACT_LEVEL[b.impact] - IMPACT_LEVEL[a.impact] || b.affected.length - a.affected.length
  const fix = rows.flatMap((r) => r.fixes).sort(byImpact)
  const toAdd = rows.filter((r) => r.status === 'missing' && (r.importance !== 'optional' || r.suggest)).sort(byImpact)
  const score = Math.max(0, 100 - 25 * req.filter((r) => r.status !== 'valid').length - 15 * invalid.length)
  const slots = rows.reduce((n, r) => n + r.applicable, 0)
  const filled = rows.reduce((n, r) => n + r.found.length, 0)
  // a page is fully valid when nothing that applies to it is missing, broken or warned about
  const fullyValid = list.filter((p) => rows.every((r) => !r.applies(p) || (r.has(p) && !r.invalid.includes(p.path) && !r.warnings.some(([, w]) => w.includes(p.path))))).length
  const warnings = rows.reduce((n, r) => n + r.warnings.length, 0)
  // the Coverage map: page types present × the schemas found on them or recommended for them
  const mapColumns = rows
    .filter((r) => r.found.length || r.importance !== 'optional')
    .sort((a, b) => IMP_RANK[a.importance] - IMP_RANK[b.importance] || b.found.length - a.found.length || a.name.localeCompare(b.name))
    .map((r) => [r.id, r.name])
  const mapRows = Object.entries(KINDS).map(([id, name]) => ({ id, name, pages: list.filter((p) => p.kind === id) })).filter((g) => g.pages.length)
  return {
    rows,
    list,
    mapColumns,
    mapRows,
    notRelevant: schemas.length - rows.length,
    pageCount: list.length,
    score, scoreLabel: label(score),
    coverage: slots ? Math.round((filled * 100) / slots) : 0,
    fullyValid,
    critical: fix.filter((f) => f.level === 'error').length,
    warnings,
    required: { valid: req.filter((r) => r.status === 'valid').length, total: req.length },
    additional: { valid: add.filter((r) => r.status === 'valid').length, total: add.length },
    fix,
    toAdd,
    // Coverage map cell: of a set of pages, how many the schema applies to and how many carry it
    cellFor: (schemaId, ps) => {
      const sc = schemaById(schemaId)
      const on = ps.filter(sc.applies)
      return { applies: on.length, found: on.filter(sc.has).length }
    },
    // the Schema drawer opens rows and Fix items alike
    find: (id) => rows.find((r) => r.id === id) ?? fix.find((f) => f.id === id),
  }
}
