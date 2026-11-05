// Browser test: the Search queries table on the v1 Target page (workspace/SearchMatch.jsx), owner fixes 2026-11-05.
// - Footer "Publishing on <path> · Change page": the path box is its text's own width, so the gap before "·" equals
//   the gap after the label (it was a canvas-measured box, sized before the font loaded, leaving an extra gap).
// - The ↗ arrows sit in one column: every row's arrow starts at the same x.
// - A Weak verdict stays red on a muted (local / low-volume) row.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { chromePath } from './chromePath.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))

test('Search queries table: no gap before "· Change page", aligned arrows, red Weak on muted rows', async () => {
  const server = await createServer({ root, logLevel: 'silent', server: { port: 0, strictPort: false } })
  await server.listen()
  const base = `http://localhost:${server.httpServer.address().port}`
  let browser
  try {
    browser = await chromium.launch({ executablePath: chromePath() })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    await page.goto(`${base}/opportunities/content/13`, { waitUntil: 'networkidle' })
    await page.locator('[data-sc-using]').waitFor()
    await page.evaluate(() => document.fonts.ready)

    const m = await page.evaluate(() => {
      const u = document.querySelector('[data-sc-using]')
      const [label, path, dot] = [...u.children].map((c) => c.getBoundingClientRect())
      const arrows = [...document.querySelectorAll('[data-sc-queries] li a svg')].map((s) => Math.round(s.getBoundingClientRect().left))
      return { before: Math.round(path.left - label.right), after: Math.round(dot.left - path.right), arrows }
    })
    assert.ok(Math.abs(m.after - m.before) <= 1, `gap before "·" (${m.after}px) matches the gap after the label (${m.before}px)`)
    assert.ok(m.arrows.length > 1, 'rows have landing-page links')
    assert.equal(new Set(m.arrows).size, 1, `arrows line up: ${m.arrows.join(', ')}`)

    // every Weak verdict, muted row or not, has the red class
    const weak = await page.evaluate(() => [...document.querySelectorAll('[data-sc-queries] li span')]
      .filter((s) => /^Weak · /.test(s.textContent)).map((s) => s.className.includes('text-negative')))
    assert.ok(weak.length > 0, 'a Weak row exists')
    assert.ok(weak.every(Boolean), 'Weak is red on every row')
  } finally {
    await browser?.close()
    await server.close()
  }
})
