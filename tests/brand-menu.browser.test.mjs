// Browser regression test: the sidebar's brand / workspace menu must paint above the page.
// Bug (2026-11-04): the menu is wider than the sidebar (320px vs 248px) and was rendered inside the sticky <aside>,
// so the part past the sidebar's edge sat under the page's content (chart labels showed through it).
// Runs a real browser (playwright-core + the Chromium in ~/Library/Caches/ms-playwright) against Vite's dev server.
// Run with: npm test (node --test also picks up tests/).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { chromePath } from './chromePath.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))

test('the brand menu paints above the page and opens above its card', async () => {
  const server = await createServer({ root, logLevel: 'silent', server: { port: 0, strictPort: false } })
  await server.listen()
  const { port } = server.httpServer.address()
  let browser
  try {
    browser = await chromium.launch({ executablePath: chromePath() })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(`http://localhost:${port}/overview`, { waitUntil: 'networkidle' })
    const card = page.locator('aside button[aria-haspopup="menu"]')
    await card.click()
    const menu = page.getByRole('menu', { name: 'Workspace' })
    await menu.waitFor({ state: 'visible' })
    await page.waitForTimeout(250) // the opening fade

    const result = await page.evaluate(() => {
      const m = document.querySelector('[role="menu"][aria-label="Workspace"]')
      const r = m.getBoundingClientRect()
      const card = document.querySelector('aside button[aria-haspopup="menu"]').getBoundingClientRect()
      const covered = []
      for (const fx of [0.05, 0.5, 0.95]) {
        for (const fy of [0.05, 0.5, 0.95]) {
          const x = r.left + r.width * fx
          const y = r.top + r.height * fy
          const hit = document.elementFromPoint(x, y)
          if (!hit || !m.contains(hit)) covered.push({ x: Math.round(x), y: Math.round(y), hit: hit?.tagName ?? null })
        }
      }
      return { covered, menuBottom: r.bottom, cardTop: card.top, menuLeft: r.left, cardLeft: card.left }
    })

    assert.deepEqual(result.covered, [], `page content covers the menu at ${JSON.stringify(result.covered)}`)
    assert.ok(result.menuBottom <= result.cardTop, 'the menu opens above the brand card')
    assert.ok(Math.abs(result.menuLeft - result.cardLeft) <= 1, 'the menu lines up with the card')
  } finally {
    await browser?.close()
    await server.close()
  }
})
