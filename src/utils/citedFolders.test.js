import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HOMEPAGE, OTHER, PDFS, folderChange, folderInsight, folderLabel, folderOf, groupFolders, otherChange, pageOf, topFolders, wholePercents } from './citedFolders.js'

test('a page: no scheme / host, no query string, no #anchor, no trailing slash', () => {
  assert.equal(pageOf('https://www.dermasuri.com/blog/retinol-guide/?submission_source=footer#faq'), '/blog/retinol-guide')
  assert.equal(pageOf('/blog/retinol-guide?utm_source=chatgpt.com'), '/blog/retinol-guide')
  assert.equal(pageOf('/blog/retinol-guide#how-often'), '/blog/retinol-guide')
  assert.equal(pageOf('https://dermasuri.com'), '/')
  assert.equal(pageOf('https://dermasuri.com/?ref=nav'), '/')
  assert.equal(pageOf('blog//x/'), '/blog/x')
})

test('a folder: the first path segment; "/" = Homepage; any .pdf = Documents (PDF)', () => {
  assert.equal(folderOf('/blog/retinol-guide'), '/blog/')
  assert.equal(folderOf('https://dermasuri.com/products/serum?variant=2'), '/products/')
  assert.equal(folderOf('/about'), '/about/')
  assert.equal(folderOf('https://dermasuri.com/'), HOMEPAGE)
  assert.equal(folderOf('/files/clinical-study-2026.pdf?dl=1'), PDFS)
  assert.equal(folderOf('/blog/whitepaper.PDF'), PDFS)
})

test('grouping merges a page\'s query-string and #anchor variants; folders by citations, pages inside by citations', () => {
  const g = groupFolders([
    { url: '/blog/a?submission_source=footer', engine: 'aio', prompt: { key: 'p1', prompt: 'one' } },
    { url: '/blog/a#faq', engine: 'chatgpt', prompt: { key: 'p2', prompt: 'two' } },
    { url: '/blog/a/', engine: 'aio', prompt: { key: 'p1', prompt: 'one' } },
    { url: '/blog/b', engine: 'aio' },
    { url: '/products/x', engine: 'gemini' },
    { url: '/', engine: 'aio' },
  ])
  assert.equal(g.total, 6)
  assert.equal(g.pageCount, 4)
  assert.deepEqual(g.folders.map((f) => [f.key, f.count]), [['/blog/', 4], ['/products/', 1], [HOMEPAGE, 1]].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
  const a = g.folders[0].pages[0]
  assert.equal(a.path, '/blog/a')
  assert.equal(a.count, 3)
  assert.deepEqual(a.engines, ['aio', 'chatgpt'])
  assert.deepEqual(a.prompts.map((p) => p.key), ['p1', 'p2'], 'each prompt once')
})

test('top 6 folders, then "Other n folders" with the rest', () => {
  const folders = Array.from({ length: 9 }, (_, i) => ({ key: `/f${i}/`, count: 20 - i, pages: [{ path: `/f${i}/x`, count: 20 - i }] }))
  const s = topFolders(folders)
  assert.equal(s.length, 7)
  assert.equal(s[6].key, OTHER)
  assert.equal(s[6].n, 3)
  assert.equal(s[6].count, 14 + 13 + 12)
  assert.equal(folderLabel(s[6]), 'Other 3 folders')
  assert.equal(topFolders(folders.slice(0, 6)).length, 6, 'no Other when 6 or fewer')
})

test('whole percentages add up to 100', () => {
  const p = wholePercents([24, 9, 7, 4, 2, 1, 1])
  assert.equal(p.reduce((a, b) => a + b, 0), 100)
  assert.deepEqual(wholePercents([0, 0]), [0, 0])
})

test('changes vs the sync before; the insight names the biggest folder', () => {
  const now = groupFolders([{ url: '/blog/a' }, { url: '/blog/b' }, { url: '/x/1' }, { url: '/y/1' }])
  const prev = groupFolders([{ url: '/blog/a' }, { url: '/x/1' }, { url: '/x/2' }])
  assert.equal(folderChange('/blog/', now, prev), 1)
  assert.equal(folderChange('/x/', now, prev), -1)
  assert.equal(folderChange('/y/', now, prev), 1, 'new this sync: its whole count')
  assert.equal(folderChange('/blog/', now, null), null)
  assert.equal(otherChange({ folders: ['/x/', '/y/'] }, now, prev), 0)
  const slices = topFolders(now.folders)
  assert.equal(folderInsight(slices, wholePercents(slices.map((s) => s.count))), 'The /blog/ folder earns 50% of your citations.')
  assert.equal(folderInsight([{ key: HOMEPAGE, count: 3 }], [60]), 'Your homepage earns 60% of your citations.')
})
