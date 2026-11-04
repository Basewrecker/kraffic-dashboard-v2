// Draft step v1: everything the page derives from a content-recommend response (data/contentRecommend.js), in one
// place. Pure. Each rule says what it reads and why.
import { parseMarkdown, plainOf, safeHref, toHtml, toMarkdown, toPlain } from './markdown.js'
import { formatLabel } from '../../../data/contentRecommend.js'

// R1 · Sections. contentMarkdown is one string; its sections are the ## headings. The H1 is the prompt.
//   The lib's own blocks are kept for Export .md but hidden in the rendered draft and left out of Copy content / Copy as
//   HTML (owner, decision 1): ## Page recommendation, ## Flags, ## Publishing notes, and the "Draft for client review"
//   notice (a blockquote).
export const HIDDEN_SECTIONS = ['page recommendation', 'flags', 'publishing notes']
const isNotice = (b) => b.type === 'quote' && /draft for client review/i.test(plainOf(b.inline))
export function draftSections(markdown) {
  const blocks = parseMarkdown(markdown)
  let h1 = null
  const intro = []
  const sections = []
  for (const b of blocks) {
    if (b.type === 'h1' && !h1) { h1 = b; continue }
    if (b.type === 'h2') { sections.push({ title: plainOf(b.inline), heading: b, blocks: [], hidden: HIDDEN_SECTIONS.includes(plainOf(b.inline).trim().toLowerCase()) }); continue }
    if (isNotice(b)) continue
    ;(sections.length ? sections[sections.length - 1].blocks : intro).push(b)
  }
  return { h1, intro, sections, shown: sections.filter((s) => !s.hidden) }
}
// R2 · The publishable blocks (Copy content, Copy as HTML): the H1, anything before the first section that isn't the
//   notice, and the shown sections; in Sources, without the competitors' pages (their domains) and without the lib's
//   page-recommendation bullets ("recommended new page — …", "your page to update — …").
const PAGE_REC_BULLET = /^\s*(recommended new page|your page to update)\b/i
const hostOfHref = (href) => { try { return new URL(href).hostname.replace(/^www\./, '') } catch { return '' } }
const isCompetitorHost = (host, competitors) => competitors.some((d) => host === d || host.endsWith(`.${d}`))
export function publishableBlocks(markdown, competitors = []) {
  const { h1, intro, shown } = draftSections(markdown)
  const keep = (s) => (/^sources$/i.test(s.title.trim())
    ? s.blocks.map((b) => (b.type === 'ul' ? { ...b, items: b.items.filter((it) => !PAGE_REC_BULLET.test(plainOf(it)) && !it.some((n) => n.t === 'link' && isCompetitorHost(hostOfHref(n.href), competitors))) } : b)).filter((b) => b.type !== 'ul' || b.items.length)
    : s.blocks)
  return [...(h1 ? [h1] : []), ...intro, ...shown.flatMap((s) => [s.heading, ...keep(s)])]
}
// R3 · What each action copies. Copy content: the publishable sections as Markdown (re-serialized from the parsed tree,
//   < > escaped). Copy as HTML: HTML built from the same tree (escaped; http(s) links only) + its plain text. Export .md:
//   the raw contentMarkdown, the full brief including the hidden blocks (it's a text file, never rendered).
export function copyPayloads(markdown, competitors = []) {
  const blocks = publishableBlocks(markdown, competitors)
  return { markdown: toMarkdown(blocks), html: toHtml(blocks), plain: toPlain(blocks), exportMd: String(markdown) }
}

// R4 · Comparisons. The lib bans pipe tables: a comparison is "**Option**" on its own line, then "- Label: value"
//   bullets, repeated. A run of 2+ such pairs becomes one group (options side by side, 2–3 columns); anything else
//   passes through. → [{ type: 'compare', options: [{ name, rows: [{ label, value }] }] } | block]
export function withComparisons(blocks) {
  const out = []
  let group = null
  const isOption = (b) => b.type === 'p' && b.inline.length === 1 && b.inline[0].t === 'strong'
  const isRows = (b) => b?.type === 'ul' && b.items.every((it) => /^[^:]{1,40}:\s+\S/.test(plainOf(it)))
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (isOption(b) && isRows(blocks[i + 1])) {
      const rows = blocks[i + 1].items.map((it) => { const [label, ...v] = plainOf(it).split(':'); return { label: label.trim(), value: v.join(':').trim() } })
      const option = { name: plainOf(b.inline[0].c), rows }
      if (group) group.options.push(option)
      else { group = { type: 'compare', options: [option] }; out.push(group) }
      // uniform: every option has the same labels in the same order → a grid (labels as rows, options as columns)
      const labels = (o) => o.rows.map((r) => r.label.toLowerCase()).join('|')
      group.uniform = group.options.every((o) => labels(o) === labels(group.options[0]))
      group.labels = group.options[0].rows.map((r) => r.label)
      i += 1
      continue
    }
    group = null
    out.push(b)
  }
  // a single option isn't a comparison: put it back as its blocks
  return out.flatMap((b) => (b.type === 'compare' && b.options.length < 2 ? [{ type: 'p', inline: [{ t: 'strong', c: [{ t: 'text', v: b.options[0].name }] }] }, { type: 'ul', items: b.options[0].rows.map((r) => [{ t: 'text', v: `${r.label}: ${r.value}` }]) }] : [b]))
}

// R5 · "Confirm with your team". The lib writes "Confirm with your team: …" where it lacks a verified fact. The line
//   keeps its text minus the phrase (capitalised) and ends with an amber dot + "Confirm with your team" chip.
const CONFIRM = /\bConfirm with your team:?\s*/i
export function confirmOf(inline) {
  const i = inline.findIndex((n) => n.t === 'text' && CONFIRM.test(n.v))
  if (i < 0) return { inline, confirm: false }
  const next = inline.map((n, j) => {
    if (j !== i) return n
    const v = n.v.replace(CONFIRM, '')
    // the phrase opened the line: capitalise what's left ("which product…" → "Which product…")
    return { ...n, v: j === 0 && /^\s*Confirm/i.test(n.v) ? v.charAt(0).toUpperCase() + v.slice(1) : v }
  })
  return { inline: next.filter((n) => n.t !== 'text' || n.v !== ''), confirm: true }
}

// R6 · Competitor mentions. The request's competitors (domains) and their names; a mention in the publishable body is
//   underlined with "Remove before publishing" (the lib's gate also reports it in contentIssues).
export function competitorTerms(competitors, nameOf) {
  const terms = competitors.flatMap((d) => [nameOf(d), d, d.replace(/\.(com|us|co|org|net)$/, '')]).filter((t) => t && t.length > 2)
  return [...new Set(terms)].sort((a, b) => b.length - a.length)
}
export function splitMentions(text, terms) {
  if (!terms.length) return [{ text }]
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return String(text).split(re).filter(Boolean).map((part) => (terms.some((t) => t.toLowerCase() === part.toLowerCase()) ? { text: part, mention: true } : { text: part }))
}

// R7 · Sources. Each ## Sources bullet is "Label: https://url (note)" (the lib drops bullets without a URL): a row of
//   the label, the domain (muted) and the note as a small chip ("flag for expert review"). The lib's
//   page-recommendation bullet ("recommended new page — url") isn't a source: it's left out (the rail shows the page).
export function sourcesOf(blocks) {
  const items = blocks.filter((b) => b.type === 'ul').flatMap((b) => b.items)
  return items.map((it) => {
    const link = it.find((n) => n.t === 'link')
    if (!link || PAGE_REC_BULLET.test(plainOf(it))) return null
    const url = new URL(link.href)
    const label = plainOf(it.slice(0, it.indexOf(link))).replace(/[\s:—–-]+$/, '').trim()
    const note = (plainOf(it.slice(it.indexOf(link) + 1)).match(/\(([^)]+)\)/) || [])[1] ?? ''
    return { url: link.href, host: url.hostname.replace(/^www\./, ''), path: url.pathname, label, note: note.trim() }
  }).filter(Boolean)
}

// R8 · Flags. flags[] as returned: sorted by score (high first); the tag is the status (Required / Missing / Partial),
//   the number is the score. Ticks are the user's, in this browser only (the route has no resolved state).
export const sortedFlags = (flags) => [...flags].sort((a, b) => b.score - a.score)
// the tag is the flag's label (Expert review / Missing brand info / Needs verification / Draft gap); the number, its score
export const STATUS_TAG = { required: 'Required', missing: 'Missing', partial: 'Partial' }
// R9 · Readiness: score-weighted, as the app's applyRecommendations computes it (components/mock/utils/brief.js):
//   total = the sum of the flags' scores (else reviewScore.total), done = the sum of the ticked flags' scores. "Re-check
//   score" re-runs this in the browser from the ticks (no server call, as in the app).
export function readinessOf(flags, reviewScore, ticked) {
  const total = flags.reduce((s, f) => s + (Number(f.score) || 0), 0) || Number(reviewScore?.total) || 0
  const done = flags.filter((f) => ticked.includes(f.id)).reduce((s, f) => s + f.score, 0)
  return { done, total, remaining: total - done, pct: total ? done / total : 1, open: flags.filter((f) => !ticked.includes(f.id)).length }
}

// R10 · Format gaps: recommendations[] (label · status · score, missing first) with the pages that use each format,
//   from formats[].usages (matched by id): host, Google rank, AI badge, one per host.
export function formatRows(recommendations, formats) {
  return recommendations.map((r) => {
    const seen = new Set()
    const usages = (formats.find((f) => f.id === r.id)?.usages ?? []).filter((x) => !seen.has(x.host) && seen.add(x.host)).map(({ host, rank, aiCited }) => ({ host, rank, aiCited }))
    return { ...r, usages, hosts: usages.map((x) => x.host) }
  })
}
// R10b · Coverage: the route's overall value for the brand's pages vs page 1 / AI answers.
export const COVERAGE_LABEL = { covered: 'Covered', partial: 'Partial', missing: 'Missing' }
// R11 · Sources to outrank: citedPages that aren't the brand's, by rank (AI-only last): host, path, #rank, AI badge,
//   the format labels.
export function sourcesToOutrank(citedPages) {
  return citedPages.filter((p) => !p.isOurs).map((p) => {
    let path = ''
    try { path = new URL(p.url).pathname } catch { /* keep */ }
    return { url: p.url, host: p.host, path, rank: p.rank, aiCited: p.aiCited, formats: p.formats.map(formatLabel) }
  }).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
}
// R12 · Competitors to beat: the request's competitors (the route gets them to keep them out of the draft; it returns
//   no rank for them).
export const competitorsToBeat = (competitors, nameOf) => competitors.map((d) => ({ domain: d, name: nameOf(d) }))

// R13 · The outline (the writing state's skeleton, the behind-flag live view): the H1 and the shown ## headings.
export function outlineOf(markdown) {
  const { h1, shown } = draftSections(markdown)
  return [...(h1 ? [{ id: 'h1', text: plainOf(h1.inline), h1: true }] : []), ...shown.map((s, i) => ({ id: `s${i}`, text: s.title }))]
}

// R14 · The behind-flag live writing view, from the same sample (so it never shows another prompt's content):
//   pages = citedPages, formats = recommendations with their competitor hosts, competitors = the request's with their
//   best rank in citedPages and their first format, outline = R13, claims = the Key points bullets (needs your OK when
//   the bullet asks to confirm with the team).
export function liveDataOf(res, competitors, nameOf) {
  const rows = formatRows(res.recommendations, res.formats)
  const keyPoints = draftSections(res.contentMarkdown).shown.find((s) => /key points/i.test(s.title))
  const items = keyPoints ? keyPoints.blocks.filter((b) => b.type === 'ul').flatMap((b) => b.items) : []
  return {
    pages: res.citedPages.map((p) => ({ domain: p.host, title: p.title })),
    formats: rows.map((r) => ({ type: r.label, competitors: r.hosts.filter((h) => !h.endsWith(res.brandDomain)).slice(0, 4), covered: r.status !== 'missing' })),
    competitors: competitors.map((d) => {
      const p = res.citedPages.find((x) => x.host === d)
      return { domain: d, name: nameOf(d), rank: p?.rank ? `#${p.rank} on Google` : p?.aiCited ? 'AI cited' : 'Not on page 1', format: p?.formats[0] ? formatLabel(p.formats[0]) : '—' }
    }),
    outline: outlineOf(res.contentMarkdown),
    claims: items.map((it, i) => ({ id: `k${i}`, text: plainOf(it).replace(CONFIRM, ''), ok: !CONFIRM.test(plainOf(it)) })),
  }
}

// R15 · Notes above the draft, from the flags the route returns: contentSource 'template' → "Template draft: AI writing
//   was unavailable"; contentComplete false → the contentIssues as a warning list; expertReview → a "Needs expert
//   review" chip by the H1; brandFactsAvailable false → "Add your brand facts in Brand Setup for a better draft".
export function draftNotes(res) {
  return {
    template: res.contentSource === 'template',
    issues: res.contentComplete ? [] : res.contentIssues,
    expert: Boolean(res.expertReview),
    noFacts: !res.brandFactsAvailable,
  }
}

// R16 · The page the draft is for (pageRecommendation): update an existing URL, or create one; its evidence[] pages.
export function pageOf(rec) {
  const url = rec.action === 'update' ? rec.url : rec.suggestedUrl
  let path = url
  try { path = new URL(url).pathname } catch { /* keep */ }
  // href: the URL only when it's http(s) (else no link is drawn)
  return { action: rec.action, url, href: safeHref(url), path, title: rec.title ?? '', reason: rec.reason, evidence: rec.evidence.map((e) => { let p = ''; try { p = new URL(e.url).pathname } catch { /* keep */ } return { ...e, href: safeHref(e.url), path: p, formats: e.formats.map(formatLabel) } }) }
}

// R17 · The saved state, in this browser only (the app's localStorage key): ticks, copied, when.
export const storageKey = (domain, prompt) => `auden:content-brief:v1:${domain}:${prompt}`
// R21 · What the draft will contain, before it arrives (the writing state's skeleton and its "Adding …" line), by the
//   route's rules: it drafts FAQ always plus up to 2 other missing / partial formats (route.js), and the draft lib writes
//   Direct answer, Key points, Steps (when how-to / tutorial / checklist / comparison is among them), a comparison
//   section (when comparison is), Detailed explanation, FAQ, Sources.
export function draftPlan(recommendations) {
  const gaps = recommendations.filter((r) => r.status === 'missing' || r.status === 'partial')
  const faq = gaps.find((r) => r.id === 'faq')
  const missing = [faq ?? { id: 'faq', label: 'FAQ', score: 3, status: 'missing' }, ...gaps.filter((r) => r !== faq).slice(0, 2)]
  const ids = missing.map((m) => m.id)
  const sections = ['Direct answer', 'Key points',
    ...(ids.some((i) => ['how_to', 'tutorial', 'checklist', 'comparison'].includes(i)) ? ['Steps'] : []),
    ...(ids.includes('comparison') ? ['Comparison'] : []),
    'Detailed explanation', 'FAQ', 'Sources']
  return { missing, sections }
}
export const exportName = (prompt) => `${String(prompt).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.md`

// R18 · The Target page's rank ladder (Google page 1 for this prompt), from citedPages: slots #1–#10 with the page at
//   each rank (or empty), the brand's page if it ranks, and the AI-cited pages that aren't on page 1 ("AI only").
export function rankLadder(citedPages) {
  const slots = Array.from({ length: 10 }, (_, i) => citedPages.find((p) => p.rank === i + 1) ?? null)
  const ours = citedPages.find((p) => p.isOurs && p.rank != null && p.rank <= 10) ?? null
  const aiOnly = citedPages.filter((p) => !p.isOurs && (p.rank == null || p.rank > 10) && p.aiCited)
  return { slots, ours, aiOnly }
}

// R19 · The format matrix ("what the winners have that you don't"): rows = pageRecommendation.evidence[] (the route's
//   own pick of up to 5 winning pages: non-brand, page 1 or AI-cited), then "Your page". Your page's formats: for an
//   update, that page's formats when it's in citedPages (isOurs), else ourFormats (the formats on the brand's pages, the
//   route's own source for coverage); for a create, none (the page doesn't exist yet). Columns: the formats at least one
//   row has (CONTENT_FORMATS labels), most-used first; each with how many winners use it and its score from
//   recommendations[]. missing: the formats winners use that your page doesn't (what the draft adds).
export function formatMatrix(res) {
  const rec = res.pageRecommendation
  const winners = rec.evidence
  const own = rec.action === 'update' ? res.citedPages.find((p) => p.isOurs && p.url === rec.url) : null
  const yours = rec.action === 'create' ? [] : (own ? own.formats : res.ourFormats)
  const yoursFrom = rec.action === 'create' ? 'none (a new page)' : own ? 'the page in citedPages' : 'ourFormats'
  const ids = [...new Set([...winners.flatMap((w) => w.formats), ...yours])]
  const count = (id) => winners.filter((w) => w.formats.includes(id)).length
  const order = (id) => ['listicle', 'how_to', 'research', 'faq', 'comparison', 'tutorial', 'stats', 'checklist', 'case_study', 'template'].indexOf(id)
  const columns = ids.sort((a, b) => count(b) - count(a) || order(a) - order(b)).map((id) => ({
    id, label: formatLabel(id), used: count(id), of: winners.length, score: res.recommendations.find((r) => r.id === id)?.score ?? null,
  }))
  const missing = columns.filter((c) => c.used > 0 && !yours.includes(c.id))
  return { winners, yours, yoursFrom, columns, missing }
}

// R20 · Which engines cite a page. citedPages[].engines holds the route's generic tags:
//   'google' = the page's organic Google rank: not an AI engine, no icon (the ladder slot already shows the rank);
//   'aio'    = Google's AI Overview cites it → the AI Overview icon;
//   'aimode' = Google's AI Mode cites it → the AI Mode icon. PROPOSED: Harsh's route doesn't return it yet (Google is
//              one engine there); the mock's samples carry it so the split is designed (docs/port-content.md §3);
//   'ai'     = an AI answer cites it, but the route doesn't say which engine (client sources are tagged 'ai'). It's
//              resolved on the client from the prompt's own answers (resolve(host): the tracked engines whose answers
//              cite that host, as the workspace's "Who you're up against" shows); when they don't cite it, it stays a
//              neutral "AI" (engine not specified). No precision the data doesn't have.
// → { engines: ['google' (= AI Overview) | 'aimode' | 'chatgpt' | 'gemini' | 'claude'], unknown: boolean }, in that order
const NAMED = ['google', 'aimode', 'chatgpt', 'gemini', 'claude', 'perplexity']
export function enginesOf(page, resolve = () => null) {
  const out = new Set()
  let unknown = false
  for (const e of page.engines ?? []) {
    if (e === 'aio') out.add('google')
    else if (e === 'aimode') out.add('aimode')
    else if (e === 'ai') { const r = resolve(page.host); if (r?.length) r.forEach((x) => out.add(x)); else unknown = true }
    else if (e !== 'google' && NAMED.includes(e)) out.add(e)
  }
  return { engines: [...out].sort((a, b) => NAMED.indexOf(a) - NAMED.indexOf(b)), unknown: unknown && out.size === 0 }
}

// R22 · Who you're up against (the Draft rail): ONE list for the request's competitors (names from settings) and the
//   cited pages that aren't yours, merged by host (a competitor's cited page carries its rank and engines). By Google
//   rank, then AI-only pages, then competitors that aren't cited for this prompt.
export function upAgainstRows(res, competitors, nameOf) {
  const rows = new Map()
  for (const p of res.citedPages.filter((x) => !x.isOurs)) rows.set(p.host, { host: p.host, name: nameOf(p.host), url: p.url, rank: p.rank, page: p, formats: p.formats, competitor: competitors.includes(p.host) })
  for (const d of competitors) if (!rows.has(d)) rows.set(d, { host: d, name: nameOf(d), url: null, rank: null, page: null, formats: [], competitor: true })
  const order = (r) => r.rank ?? (r.page?.aiCited ? 50 : 99)
  return [...rows.values()].sort((a, b) => order(a) - order(b))
}
// R23 · The draft's outline (the sticky links over the draft): the shown sections, by short names
const OUTLINE_SHORT = { 'direct answer': 'Direct answer', 'key points': 'Key points', steps: 'Steps', 'detailed explanation': 'Explanation', faq: 'FAQ', sources: 'Sources' }
export const outlineShort = (title) => OUTLINE_SHORT[title.trim().toLowerCase()] ?? (/\bvs\b|compar/i.test(title) ? 'Compare' : title)
// R24 · "Show in draft" for a Draft gap flag that names a competitor: the host it names (the lib writes
//   Competitor “host” appears in the draft — …); the page finds its first mention by host or display name.
export const flagHost = (f) => (f.label === 'Draft gap' ? (f.text.match(/Competitor [“"]([^”"]+)[”"]/) || [])[1] ?? null : null)

// R25 · The before / after strip (the Draft rail, top of "What this draft adds"): the Target page matrix's columns
//   (R19: the same formats, the same order) in two rows. now = the matrix's "Your page" (that page's formats when it's in
//   citedPages as isOurs, else ourFormats; none for a new page). after = now ∪ what the draft adds (R21: FAQ + up to 2
//   missing / partial formats). A column the draft doesn't add stays as it is now (it can still be missing: honest).
//   added = the formats that are missing now and present after (only those animate). Formats the draft adds that aren't
//   a matrix column aren't shown (the matrix doesn't show them either).
export function beforeAfter(res) {
  const m = formatMatrix(res)
  const adds = draftPlan(res.recommendations).missing.map((x) => x.id)
  const columns = m.columns.map((c) => {
    const now = m.yours.includes(c.id)
    const after = now || adds.includes(c.id)
    return { id: c.id, label: c.label, now, after, added: after && !now }
  })
  return { columns, added: columns.filter((c) => c.added).map((c) => c.id), stillMissing: columns.filter((c) => !c.after).map((c) => c.id) }
}

// R26 · The rank strip over "Who you're up against": the same rows as the list (R22), placed on a Google 1–10 track by
//   their organic rank (citedPages). marks: the rows ranked 1–10, each with its lane (0 unless two share a rank: the
//   second sits beside the first). ours: the brand's own page's rank when it's isOurs in citedPages and ranked 1–10, else
//   null (a dashed "You" past 10). aiOnly: rows only AI answers cite (no rank 1–10, aiCited): not on the track, counted
//   in a small "AI only" mark at its end. Rows neither ranked nor cited (competitors not cited here) aren't on it.
export function rankStrip(res, competitors, nameOf) {
  const rows = upAgainstRows(res, competitors, nameOf)
  const onTrack = (r) => r != null && r >= 1 && r <= 10
  const lanes = new Map()
  const marks = rows.filter((r) => onTrack(r.rank)).map((r) => {
    const lane = lanes.get(r.rank) ?? 0
    lanes.set(r.rank, lane + 1)
    return { host: r.host, name: r.name, rank: r.rank, lane }
  })
  const own = res.citedPages.find((p) => p.isOurs && onTrack(p.rank))
  const aiOnly = rows.filter((r) => !onTrack(r.rank) && r.page?.aiCited).map((r) => r.host)
  return { marks, ours: own ? own.rank : null, aiOnly }
}

// R27 · The draft preview on the Target page (left column, under "The draft adds", once a draft exists), from the
//   parsed contentMarkdown (R1): title = the H1; answer = the Direct answer section's first paragraph as plain text (the
//   page clamps it to 2 lines; '' when there's no such section); sections = the shown sections' short names (R23), in
//   order, without Direct answer (the answer line already stands for it) and Sources (a reference list, not body
//   content; it keeps the chips to one line so the column ends level with the matrix).
export function draftPreview(markdown) {
  const { h1, shown } = draftSections(markdown)
  const direct = shown.find((s) => /^direct answer$/i.test(s.title.trim()))
  const first = direct?.blocks.find((b) => b.type === 'p')
  return {
    title: h1 ? plainOf(h1.inline).trim() : '',
    answer: first ? plainOf(first.inline).trim() : '',
    sections: shown.filter((s) => s !== direct && !/^sources$/i.test(s.title.trim())).map((s) => outlineShort(s.title)),
  }
}

// R28 · The matrix's "After this draft" row (Target page), under "Your page": the matrix's columns (R19) as R25 sees
//   them after the draft. Each cell: 'have' (your page has it now: the normal tick), 'adds' (the draft adds it: a faint
//   tick that draws in), 'missing' (still missing after the draft: the red dashed ring, honest). show: only when the
//   draft adds at least one column (else the row would repeat "Your page"). The page shows it while a draft exists or is
//   about to be written (no draft yet, the plan R21 is known), i.e. whenever show is true.
export function afterRow(res) {
  const ba = beforeAfter(res)
  return { show: ba.added.length > 0, cells: ba.columns.map((c) => ({ id: c.id, state: c.now ? 'have' : c.added ? 'adds' : 'missing' })) }
}
