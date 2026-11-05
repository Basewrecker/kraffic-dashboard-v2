import { test } from 'node:test'
import assert from 'node:assert/strict'
import { missedPrompts } from '../../../data/mock.js'
import { CONTENT_RECOMMEND, hostileResponse } from '../../../data/contentRecommend.js'
import { competitorTerms, confirmOf, copyPayloads, draftSections, formatRows, liveDataOf, outlineOf, readinessOf, sortedFlags, sourcesOf, sourcesToOutrank, splitMentions, withComparisons } from './recommend.js'
import { parseInline, parseMarkdown, plainOf } from './markdown.js'

const res = CONTENT_RECOMMEND[13]

test('R1–R3: hidden sections and the notice stay out of the rendered draft and Copy; Export keeps everything', () => {
  const { shown, sections } = draftSections(res.contentMarkdown)
  const hidden = sections.filter((s) => s.hidden).map((s) => s.title)
  assert.ok(hidden.includes('Page recommendation') && hidden.includes('Flags'))
  assert.ok(hidden.every((t) => ['Page recommendation', 'Flags', 'Publishing notes'].includes(t)))
  assert.ok(!shown.some((s) => /page recommendation|flags|publishing notes/i.test(s.title)))
  const c = copyPayloads(res.contentMarkdown)
  for (const s of [c.markdown, c.html, c.plain]) {
    assert.ok(!/Page recommendation|## Flags|Publishing notes|Draft for client review/i.test(s))
    assert.ok(s.includes('Direct answer'))
  }
  assert.equal(c.exportMd, res.contentMarkdown)
  assert.ok(c.exportMd.includes('## Page recommendation') && c.exportMd.includes('## Flags'))
})

test('R3 on the hostile sample: Copy as HTML / Copy content carry no script, img, on* or javascript:', () => {
  const c = copyPayloads(hostileResponse(missedPrompts[13]).contentMarkdown)
  assert.ok(!/<script|<img|<a href="(?!https?:)|<[^>]+\son\w+=/i.test(c.html))
  assert.ok(c.html.includes('&lt;script&gt;'))
  assert.ok(c.html.includes('href="https://healthline.com/guides/safe" target="_blank" rel="noopener noreferrer"'))
  assert.ok(!/<script|<img|\]\((?!https?:)/i.test(c.markdown))
})

test('R4: bold option + "Label: value" bullets become one comparison group', () => {
  const blocks = parseMarkdown('**Gel**\n\n- Best for: oily\n- Texture: light\n\n**Cream**\n\n- Best for: dry\n- Texture: rich\n\nAfter.')
  const out = withComparisons(blocks)
  assert.equal(out[0].type, 'compare')
  assert.deepEqual(out[0].options.map((o) => o.name), ['Gel', 'Cream'])
  assert.deepEqual(out[0].options[1].rows, [{ label: 'Best for', value: 'dry' }, { label: 'Texture', value: 'rich' }])
  assert.equal(out[1].type, 'p')
  // one option alone stays plain
  assert.deepEqual(withComparisons(parseMarkdown('**Gel**\n\n- Best for: oily')).map((b) => b.type), ['p', 'ul'])
})

test('R5–R7: confirm phrases, competitor mentions, sources', () => {
  const c = confirmOf(parseInline('Confirm with your team: which product you recommend.'))
  assert.equal(c.confirm, true)
  assert.equal(plainOf(c.inline), 'Which product you recommend.')
  assert.equal(confirmOf(parseInline('Plain line.')).confirm, false)
  const terms = competitorTerms(['cerave.com'], () => 'CeraVe')
  assert.deepEqual(splitMentions('Unlike CeraVe’s routine', terms), [{ text: 'Unlike ' }, { text: 'CeraVe', mention: true }, { text: '’s routine' }])
  const { shown } = draftSections(res.contentMarkdown)
  const src = sourcesOf(shown.find((s) => s.title === 'Sources').blocks)
  assert.ok(src.length >= 3 && src.every((s) => /^https:\/\//.test(s.url) && s.host && !s.host.startsWith('www.')))
})

test('R8–R11: flags by score, score-weighted readiness, formats with competitor hosts, sources to outrank', () => {
  const flags = sortedFlags(CONTENT_RECOMMEND[17].flags)
  assert.deepEqual(flags.map((f) => f.score), [...flags.map((f) => f.score)].sort((a, b) => b - a))
  const r = readinessOf(flags, CONTENT_RECOMMEND[17].reviewScore, ['expert_review'])
  assert.equal(r.done, 10)
  assert.equal(r.total, CONTENT_RECOMMEND[17].reviewScore.total)
  const rows = formatRows(res.recommendations, res.formats)
  assert.ok(rows.every((x) => Array.isArray(x.hosts)) && rows.some((x) => x.hosts.length))
  const out = sourcesToOutrank(res.citedPages)
  assert.ok(out.every((p) => p.host !== res.brandDomain))
})

test('R13–R14: the live view reads the same sample (no other prompt\'s content)', () => {
  for (const id of [0, 13, 40]) {
    const r = CONTENT_RECOMMEND[id]
    const live = liveDataOf(r, missedPrompts[id].competitors ?? [], (d) => d)
    assert.equal(live.outline[0].text, missedPrompts[id].prompt)
    assert.deepEqual(live.outline.map((o) => o.text), outlineOf(r.contentMarkdown).map((o) => o.text))
    assert.ok(live.claims.length >= 3)
    assert.ok(!JSON.stringify(live).includes('niacinamide and vitamin C'))
  }
})

import { SAMPLES, SAMPLE_ROWS } from '../../../data/contentRecommend.js'

test('rm-1: Sources rows (label · domain · note), Copy leaves out competitor sources and the page recommendation; the comparison is a grid', () => {
  const rm = SAMPLES['rm-1']
  const comps = SAMPLE_ROWS[0].competitors
  const { shown } = draftSections(rm.contentMarkdown)
  const src = sourcesOf(shown.find((s) => s.title === 'Sources').blocks)
  assert.equal(src.length, 7) // the "recommended new page" bullet isn't a source
  assert.deepEqual(src[0], { url: 'https://www.hud.gov/program_offices/housing/sfh/hecm/hecmhome', host: 'hud.gov', path: '/program_offices/housing/sfh/hecm/hecmhome', label: 'HUD, Home Equity Conversion Mortgage program overview', note: 'flag for expert review' })
  const c = copyPayloads(rm.contentMarkdown, comps)
  for (const s of [c.markdown, c.html]) {
    assert.ok(!comps.some((d) => s.includes(d)), 'no competitor-domain source')
    assert.ok(!/recommended new page|Page recommendation|## Flags|Draft for client review/i.test(s))
    assert.ok(s.includes('hud.gov') && s.includes('consumerfinance.gov'))
  }
  assert.ok(c.exportMd.includes('keystonereverse.com') && c.exportMd.includes('## Flags'))
  const cmp = withComparisons(shown.find((s) => /^Line of credit vs/.test(s.title)).blocks).find((b) => b.type === 'compare')
  assert.equal(cmp.uniform, true)
  assert.deepEqual(cmp.labels, ['Growth', 'Flexibility', 'Repayment', 'Best for'])
  assert.deepEqual(cmp.options.map((o) => o.name), ['HECM line of credit', 'Lump sum', 'Monthly payments (tenure or term)', 'Traditional home equity line of credit (HELOC)'])
  // Copy content keeps the comparison's original text
  assert.ok(c.markdown.includes('**HECM line of credit**') && c.markdown.includes('- Growth: the unused balance grows over time'))
  const rows = formatRows(rm.recommendations, rm.formats)
  assert.deepEqual(rows[0].usages[0], { host: 'keystonereverse.com', rank: 2, aiCited: true })
  const r = readinessOf(rm.flags, rm.reviewScore, ['expert_review', 'fees'])
  assert.deepEqual([r.done, r.total], [15, 35])
})

import { enginesOf } from './recommend.js'

test('R20: engine tags → icons: google = rank only, aio = Google, ai = resolved from the answers or unspecified', () => {
  assert.deepEqual(enginesOf({ host: 'a.com', engines: ['google'] }), { engines: [], unknown: false })
  assert.deepEqual(enginesOf({ host: 'a.com', engines: ['google', 'aio'] }), { engines: ['google'], unknown: false })
  // AI Mode (PROPOSED 'aimode' tag): its own engine, after AI Overview
  assert.deepEqual(enginesOf({ host: 'a.com', engines: ['google', 'aimode', 'aio'] }), { engines: ['google', 'aimode'], unknown: false })
  assert.deepEqual(enginesOf({ host: 'a.com', engines: ['aimode'] }), { engines: ['aimode'], unknown: false })
  assert.deepEqual(enginesOf({ host: 'a.com', engines: ['ai'] }, (h) => (h === 'a.com' ? ['chatgpt', 'claude'] : null)), { engines: ['chatgpt', 'claude'], unknown: false })
  assert.deepEqual(enginesOf({ host: 'b.com', engines: ['ai'] }, () => null), { engines: [], unknown: true })
})

import { draftPlan } from './recommend.js'

test('R21: the draft plan before it arrives: FAQ + up to 2 gaps; Steps / Comparison only when those formats are drafted', () => {
  const recs = [{ id: 'how_to', status: 'missing' }, { id: 'comparison', status: 'missing' }, { id: 'stats', status: 'missing' }, { id: 'faq', status: 'covered' }]
  const p = draftPlan(recs)
  assert.deepEqual(p.missing.map((m) => m.id), ['faq', 'how_to', 'comparison'])
  assert.deepEqual(p.sections, ['Direct answer', 'Key points', 'Steps', 'Comparison', 'Detailed explanation', 'FAQ', 'Sources'])
  assert.deepEqual(draftPlan([{ id: 'stats', status: 'partial' }]).sections, ['Direct answer', 'Key points', 'Detailed explanation', 'FAQ', 'Sources'])
})

import { flagHost, outlineShort, upAgainstRows } from './recommend.js'

test('R22–R24: one up-against list merged by host; outline names; the host a Draft gap names', () => {
  const rm = SAMPLES['rm-1']
  const rows = upAgainstRows(rm, SAMPLE_ROWS[0].competitors, (d) => d)
  assert.equal(new Set(rows.map((r) => r.host)).size, rows.length)
  assert.deepEqual(rows.slice(0, 3).map((r) => [r.host, r.rank]), [['retireplanforum.org', 1], ['keystonereverse.com', 2], ['maplewayreverse.com', 3]])
  assert.ok(rows.find((r) => r.host === 'keystonereverse.com').competitor)
  assert.equal(rows.at(-1).rank, null)
  assert.deepEqual(['Direct answer', 'Detailed explanation', 'Line of credit vs. other ways to get your money', 'How the options compare', 'FAQ'].map(outlineShort), ['Direct answer', 'Explanation', 'Compare', 'Compare', 'FAQ'])
  assert.equal(flagHost(rm.flags.find((f) => f.label === 'Draft gap')), 'keystonereverse.com')
  assert.equal(flagHost(rm.flags[0]), null)
})

import { beforeAfter, formatMatrix, rankStrip } from './recommend.js'

test('R25: before / after shares the matrix columns; after = now ∪ the draft plan; only new ticks are "added"', () => {
  for (const id of Object.keys(CONTENT_RECOMMEND)) {
    const r = CONTENT_RECOMMEND[id]
    const ba = beforeAfter(r)
    assert.deepEqual(ba.columns.map((c) => c.id), formatMatrix(r).columns.map((c) => c.id))
    assert.ok(ba.columns.every((c) => (c.now ? c.after && !c.added : c.added === c.after)))
  }
  // a new page (17): nothing now; FAQ, stats roundup and listicle added; comparison still missing after
  const c17 = beforeAfter(CONTENT_RECOMMEND[17])
  assert.deepEqual(c17.columns.map((c) => [c.id, c.now, c.after]), [['listicle', false, true], ['stats', false, true], ['faq', false, true], ['comparison', false, false]])
  assert.deepEqual(c17.added, ['listicle', 'stats', 'faq'])
  assert.deepEqual(c17.stillMissing, ['comparison'])
  // an update whose page has research (partial): research is a tick now and isn't animated
  const c1 = beforeAfter(CONTENT_RECOMMEND[1])
  assert.deepEqual(c1.columns.find((c) => c.id === 'research'), { id: 'research', label: c1.columns.find((c) => c.id === 'research').label, now: true, after: true, added: false })
  assert.deepEqual(c1.stillMissing, [])
  // FAQ covered already (0): not "added" though the plan always drafts it
  assert.equal(beforeAfter(CONTENT_RECOMMEND[0]).columns.find((c) => c.id === 'faq').added, false)
})

test('R26: the rank strip places the up-against rows by rank; your page ringed at its rank, else null; AI-only counted', () => {
  const r9 = CONTENT_RECOMMEND[9]
  const s = rankStrip(r9, [], (d) => d)
  assert.equal(s.ours, 9)
  // Google page 1 is full (owner, 2026-11-04): reddit.com, sephora.com and webmd.com hold #1, #3 and #10
  assert.deepEqual(s.marks.map((m) => [m.host, m.rank]), [['reddit.com', 1], ['cerave.com', 2], ['sephora.com', 3], ['paulaschoice.com', 4], ['healthline.com', 5], ['byrdie.com', 6], ['verywellhealth.com', 7], ['glamour.com', 8], ['webmd.com', 10]])
  assert.deepEqual(s.aiOnly, ['allure.com'])
  assert.ok(s.marks.every((m) => m.lane === 0))
  // a new page: you aren't ranked
  assert.equal(rankStrip(CONTENT_RECOMMEND[17], [], (d) => d).ours, null)
  // the same set as the list (R22): competitors not cited aren't on the track
  const rm = SAMPLES['rm-1']
  const rows = upAgainstRows(rm, SAMPLE_ROWS[0].competitors, (d) => d)
  const rs = rankStrip(rm, SAMPLE_ROWS[0].competitors, (d) => d)
  assert.ok([...rs.marks.map((m) => m.host), ...rs.aiOnly].every((h) => rows.some((x) => x.host === h)))
  assert.ok(rows.filter((x) => x.rank == null && !x.page).every((x) => !rs.marks.some((m) => m.host === x.host) && !rs.aiOnly.includes(x.host)))
  // two pages on one rank: the second gets lane 1
  const clash = { ...r9, citedPages: [...r9.citedPages, { url: 'https://x.com/a', host: 'x.com', rank: 2, engines: ['google'], aiCited: false, formats: [], isOurs: false }] }
  assert.deepEqual(rankStrip(clash, [], (d) => d).marks.filter((m) => m.rank === 2).map((m) => m.lane), [0, 1])
})

test('R27: the draft preview: the H1, the Direct answer’s first paragraph, the other sections by short name (no Sources)', async () => {
  const { draftPreview } = await import('./recommend.js')
  const p = draftPreview(CONTENT_RECOMMEND[9].contentMarkdown)
  assert.equal(p.title, 'best face mist for dry skin')
  assert.ok(p.answer.startsWith('The best face mist for dry skin is'))
  assert.deepEqual(p.sections, ['Key points', 'Steps', 'Compare', 'Explanation', 'FAQ'])
  // no hidden blocks leak in, for every sample
  for (const r of Object.values(CONTENT_RECOMMEND)) assert.ok(!draftPreview(r.contentMarkdown).sections.some((s) => /page recommendation|flags|publishing notes/i.test(s)))
  // nothing to show: empty, not a crash
  assert.deepEqual(draftPreview(''), { title: '', answer: '', sections: [] })
})

test('R28: the "After this draft" row: have / adds / missing per matrix column; shown only when the draft adds one', async () => {
  const { afterRow, beforeAfter, formatMatrix } = await import('./recommend.js')
  const a17 = afterRow(CONTENT_RECOMMEND[17])
  assert.equal(a17.show, true)
  assert.deepEqual(a17.cells.map((c) => [c.id, c.state]), [['listicle', 'adds'], ['stats', 'adds'], ['faq', 'adds'], ['comparison', 'missing']])
  const a9 = afterRow(CONTENT_RECOMMEND[9])
  assert.deepEqual(a9.cells.map((c) => [c.id, c.state]), [['listicle', 'adds'], ['how_to', 'adds'], ['faq', 'adds'], ['comparison', 'have']])
  for (const r of Object.values(CONTENT_RECOMMEND)) {
    const a = afterRow(r)
    assert.deepEqual(a.cells.map((c) => c.id), formatMatrix(r).columns.map((c) => c.id))
    assert.equal(a.show, beforeAfter(r).added.length > 0)
  }
})

test('a site on two page-1 spots: the ladder keeps both; the matrix and the competitor lists show it once, at its best rank, with "+1 page"', async () => {
  const { bySite, formatMatrix, upAgainstRows, rankStrip } = await import('./recommend.js')
  const { CONTENT_RECOMMEND } = await import('../../../data/contentRecommend.js')
  const res = CONTENT_RECOMMEND[3] // "best spf 50 gel sunscreen": cerave.com at #2 and #9
  const cerave = res.citedPages.filter((p) => p.host === 'cerave.com' && p.rank)
  assert.deepEqual(cerave.map((p) => p.rank).sort((a, b) => a - b), [2, 9], 'the route (and the ladder) keep both spots')
  const m = formatMatrix(res)
  const rows = m.winners.filter((w) => w.host === 'cerave.com')
  assert.equal(rows.length, 1, 'one matrix row for the site')
  assert.equal(rows[0].rank, 2, 'at its best rank')
  assert.deepEqual(rows[0].others.map((o) => o.rank), [9])
  assert.ok(m.columns.every((c) => c.of === m.winners.length), '"n of m" counts sites')
  const ua = upAgainstRows(res, [], (d) => d).filter((r) => r.host === 'cerave.com')
  assert.equal(ua.length, 1); assert.equal(ua[0].rank, 2); assert.equal(ua[0].others[0].rank, 9)
  assert.deepEqual(rankStrip(res, [], (d) => d).marks.filter((x) => x.host === 'cerave.com').map((x) => x.rank), [2], 'the rank strip: once')
  // the worse page listed first still collapses onto the better one
  const flipped = bySite([{ host: 'a.com', url: 'https://a.com/x', rank: 7 }, { host: 'a.com', url: 'https://a.com/y/', rank: 3 }, { host: 'b.com', url: 'https://b.com/', rank: 5 }])
  assert.deepEqual(flipped.map((p) => [p.host, p.rank, p.others.map((o) => `${o.path}#${o.rank}`)]), [['a.com', 3, ['/x#7']], ['b.com', 5, []]])
})
