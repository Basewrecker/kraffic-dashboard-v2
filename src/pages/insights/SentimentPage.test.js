// Run with: npm test. The Sentiment page's wiring that no pure helper can show: the score change and the line under it
// read one helper, the dot plot's lines, the insight under the plot, one engine switch, Score's docked card, the Sources
// link, Mixed's own colour, the 2×2 tone grid (owner, 2026-11-04), and the positioning matrix and two-axis scatter
// staying out (both tried and reverted, 2026-11-03).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('./SentimentPage.jsx', import.meta.url), 'utf8')
const block = (start, end) => page.slice(page.indexOf(start), page.indexOf(end, page.indexOf(start)))
const hero = block('function Hero(', '\n}\n')
const spectrum = block('function Spectrum(', '\n}\n')

test('the score change: one helper for the hero and the Over time tooltip; the line under the score is coloured by direction', () => {
  assert.match(page, /const change = syncScoreChange\(cols, runs\.indexOf\(run\)\)/)
  assert.match(page, /change: syncScoreChange\(data, i\)/)
  assert.match(page, /const d = tip\.change\?\.delta \?\? null/)
  assert.match(hero, /scoreChangeLine\(sync, fmtDay\)/)
  assert.match(hero, /const moveClass = sync\?\.dir === 'down' \? 'text-negative' : sync\?\.dir === 'up' \? 'text-\[var\(--rep-up-fg\)\]' : t3/)
  assert.match(hero, /data-score-change=\{change\.dir\}/, 'the arrow beside the score')
  assert.doesNotMatch(page, /reputationLine\(/, 'no tone-flip line')
})

test('"Scoring updated Nov 2": muted with its ⓘ in the hero, a dashed marker in the Score view', () => {
  assert.match(hero, /sync\?\.scoringUpdated\s*\? <span data-scoring-updated className=\{`[^`]*\$\{t3\}`\}>\{move\}<InfoTip text=\{SCORING_UPDATED_TIP\} \/><\/span>/)
  assert.match(page, /const updatedAt = cols\.findIndex\(\(c, i\) => scoringChangedAt\(cols, i\)\)/)
  assert.match(page, /strokeDasharray="3 3" \/>/)
  assert.match(page, />Scoring updated<\/text>/)
})

test('a past sync: the hero reads that sync\'s column, and the tone filter belongs to the sync it was set on', () => {
  assert.match(page, /const tone = heroTone\(toneFilter, run\.id\)/)
  assert.match(page, /setToneFilter\(t \? \{ runId: run\.id, tone: t \} : null\)/)
  assert.match(hero, /const c = col\.counts/)
  assert.match(page, /const pages = useMemo\(\(\) => listed\.filter\(\(p\) => p\.tone in BAND\), \[listed\]\)/, 'Not scored pages are never placed')
})

test('the score header: the sentence, "Scored n of m pages." and the ⓘ', () => {
  assert.match(page, /const SCORE_NOTE = 'We tracked and analyzed the primary sources AI models rely on to determine your brand’s online credibility\.'/)
  assert.match(hero, /scoredLine\(c\)/)
  assert.match(hero, /<InfoTip text=\{scoreInfo\(c\)\} \/>/)
  assert.match(hero, /heroLine\(score, c\)/)
})

test('This sync: four tiles (Positive · Mixed · Neutral · Negative) and the Not scored note', () => {
  assert.match(page, /grid-cols-4 gap-2[^"]*">\s*\{\['positive', 'mixed', 'neutral', 'negative'\]\.map\(\(t\) => \{/)
  assert.match(page, /\{unscoredNote\(col\.counts\) && <p className=\{`[^`]*\$\{t3\}[^`]*`\}>\{unscoredNote\(col\.counts\)\}<\/p>\}/)
})

test('Mixed has its own colour (--sent-mixed, not red) in the dots, the bars, the legend and the tiles', () => {
  for (const name of ['RING', 'TONE_FILL', 'MIX_FILL']) assert.match(page, new RegExp(`const ${name} = \\{[^}]*mixed: 'var\\(--sent-mixed\\)'`), name)
  assert.doesNotMatch(page, /color-mix\(in srgb, var\(--ink\) 45%, var\(--negative\)\)/)
})

test('the insight line runs full width under the dot plot, on one line (owner, 2026-11-03)', () => {
  const chart = hero.indexOf('<Spectrum ')
  const ins = hero.indexOf('<Insight ')
  assert.ok(chart > 0 && ins > chart, 'Insight renders after the chart, outside the two columns')
  assert.equal(hero.match(/<Insight /g).length, 1)
  assert.doesNotMatch(hero, /<Insight [^>]*\bwrap\b/)
  assert.match(hero, /\{text && <div className="mt-6"><Insight explain=\{explain\} text=\{text\} evidence=/)
})

test('the tone grid is about 240px and as tall as the score column (fitH), never below two rows of dots', () => {
  assert.match(hero, /const measure = \(\) => setColH\(colTop\.current\?\.offsetHeight \?\? 0\)/)
  assert.match(hero, /<Spectrum [^>]*fitH=\{fitH\}/)
  assert.match(spectrum, /const H = Math\.max\(scatterMinH\(r, \{ edge: EDGE \}\), fitH \?\? 240\)/)
  assert.match(page, /const CHART_CHROME = 26 /, 'no axis under the grid: only the label row above it')
})

test('the tone grid: a faint --line-strong cross, a faint red only on Negative (no fill on Positive), labels in the outer corners', () => {
  assert.equal((spectrum.match(/border-line-strong/g) || []).length, 2, 'one vertical and one horizontal line, no boxes')
  assert.doesNotMatch(spectrum, /border-\[var\(--div\)\]/)
  assert.match(page, /const QUAD_TINT = \{ negative: 'color-mix\(in srgb, var\(--negative\) 4%, transparent\)' \}/)
  assert.match(page, /const CORNER = \{ neutral: 'left-0 top-0', positive: 'right-0 top-0', negative: 'left-0 bottom-0', mixed: 'right-0 bottom-0' \}/)
  assert.match(page, /const QUAD_TEXT = \{ positive: 'text-ink', negative: 'text-negative', neutral: t3, mixed: t3 \}/)
  assert.doesNotMatch(spectrum, />Overall<|>Even</, 'no Overall marker, no Even label')
  assert.match(spectrum, /quadrantScatter\(/, 'dots scattered by utils/spectrum quadrantScatter (tested there)')
  assert.match(spectrum, /seed: `\$\{d\.page\.url \?\? d\.page\.id\}#\$\{d\.lane\}`/, 'seeded by the page URL (and the engine when split)')
  assert.match(spectrum, /\+\{m\.n\} more/, '"+n more" past two rows')
  assert.match(hero, /onMore=\{\(t\) => \{ setParams\(\{ ptone: t \}\); openDrawer\('syncpages', col\.r\.id\) \}\}/, '"+n more" opens the pages drawer on that tone')
})

test('one engine switch on the page (the header\'s); Split by engine stays; no brand menu on the page', () => {
  assert.equal((page.match(/<Seg label="Engine/g) || []).length, 1)
  assert.doesNotMatch(hero, /<Seg /)
  assert.match(hero, /Split by engine/)
  assert.doesNotMatch(page, /MenuSelect|prefix="Brand"/)
})

test('the 2×2 is by tone only: no positioning matrix, no two-axis scatter (both reverted 2026-11-03)', () => {
  assert.doesNotMatch(page, /Niche players|Leaders|Laggers|Controversial/i)
  // the reverted scatter was two-axis (position meant something); today's dots are scattered only for looks (owner,
  // 2026-11-04), so no axis words and no reach axis
  assert.doesNotMatch(page, /citation reach|two-axis|x-axis|y-axis/i)
  assert.match(page, /const QUAD_ORDER = \['neutral', 'positive', 'negative', 'mixed'\]/)
})

test('Split by engine on the grid: an engine badge on each dot; hovering one highlights the page\'s other dots', () => {
  assert.match(spectrum, /\{split && d\.lane !== 'all' && \(/)
  assert.match(spectrum, /<EngineIcon id=\{d\.lane\} size=\{12\} \/>/)
  assert.match(spectrum, /const peerOf = split && hover \? hover\.page\.id : null/)
  assert.match(spectrum, /const dim = peerOf && d\.page\.id !== peerOf/)
})

test('Over time: Score\'s card docks only while the section is idle; in use, the full chart comes back', () => {
  assert.match(page, /<SyncChart [^>]*docked=\{scoreCardDocked\(\{ view, auto, pointerIn, focusIn \}\)\}/)
  const fn = page.slice(page.indexOf('function SyncChart('), page.indexOf('// a sync\'s hover card'))
  assert.match(fn, /const dockOn = docked\b/)
  assert.match(fn, /aria-hidden=\{!dockOn\} data-sync-card="dock"/)
  assert.match(fn, /\{!wide && dockOn && n > 0 && \(/, 'under the chart below 1280px')
  assert.match(fn, /useEased\(dockOn && wide \? DOCK_W \+ DOCK_GAP : 0\)/, 'the plot widens back (300ms)')
  assert.match(fn, /dateOn = dockSpace === 0 \|\|/)
  assert.match(fn, /\{dockSpace === 0 && <text[^>]*>Neutral<\/text>\}/)
  assert.match(fn, /\{at != null && cols\[at\] && !dockOn && \(/)
  assert.match(fn, /'opacity 150ms ease-out, transform 150ms ease-out'/, 'it fades out in 150ms')
  assert.match(page, /const AUTO_MS = 4000/, 'Mix and Score alternate every 4s')
})

test('Sources: an open row\'s domain ↗ opens the page in a new tab, and its header rings on keyboard focus only', () => {
  assert.ok(!/\{site\.domain\}\{href && <ArrowUpRight/.test(page), 'no arrow on plain text')
  assert.match(page, /<a href=\{href\} \{\.\.\.LINK\}[^>]*>\{site\.domain\} <ArrowUpRight/)
  assert.match(page, /const LINK = \{ target: '_blank', rel: 'noopener noreferrer' \}/)
  for (const m of page.matchAll(/<ArrowUpRight[^>]*>/g)) {
    const before = page.slice(Math.max(0, m.index - 400), m.index)
    assert.ok(before.lastIndexOf('<a ') > before.lastIndexOf('</a>'), `↗ outside a link near: ${before.slice(-80)}`)
  }
  const at = page.indexOf('aria-controls={`${id}-body`}')
  const head = page.slice(at, page.indexOf('\n', page.indexOf('className=', at)))
  assert.ok(/focus-visible:ring/.test(head) && !/(^|\s)focus:ring/.test(head) && /focus:outline-none/.test(head), head)
})

test('the page takes its data from the mock\'s files only: no app imports, no brand names or domains in the component', () => {
  assert.doesNotMatch(page, /from '@\//)
  assert.match(page, /from '\.\.\/\.\.\/data\/sentiment'/)
  assert.match(page, /from '\.\.\/\.\.\/utils\/sentimentSections'/)
  assert.doesNotMatch(page, /Dermasuri|Lumen|[a-z0-9-]+\.(com|org|net)\b/i)
})
