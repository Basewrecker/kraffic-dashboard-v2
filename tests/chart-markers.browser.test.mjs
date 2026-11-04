// Browser test: Visibility history's "Scoring updated" and "Setup changed" labels never overlap (owner, 2026-11-04:
// they did at 1280). Close markers stack their labels; both stay whole.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { chromePath } from './chromePath.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))

test('the two chart marker labels never overlap, at 1440 and 1280', async () => {
  const server = await createServer({ root, logLevel: 'silent', server: { port: 0, strictPort: false } })
  await server.listen()
  const base = `http://localhost:${server.httpServer.address().port}`
  let browser
  try {
    browser = await chromium.launch({ executablePath: chromePath() })
    for (const width of [1440, 1280]) {
      for (const q of ['aimode=new&setup=1', 'history=many&setup=1']) {
        const page = await browser.newPage({ viewport: { width, height: 900 } })
        await page.goto(`${base}/overview?${q}`, { waitUntil: 'networkidle' })
        const card = page.locator('#history')
        await card.getByText(/^Setup changed/).first().waitFor()
        const boxes = await page.evaluate(() => {
          const texts = [...document.querySelectorAll('#history svg text')].filter((t) => /^(Scoring updated|Setup changed)/.test(t.textContent))
          return texts.map((t) => { const r = t.getBoundingClientRect(); return { text: t.textContent, l: r.left, r: r.right, t: r.top, b: r.bottom } })
        })
        assert.equal(boxes.length, 2, `${width} ${q}: both labels drawn`)
        const [a, b] = boxes
        const overlap = a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
        assert.ok(!overlap, `${width} ${q}: "${a.text}" and "${b.text}" overlap`)
        await page.close()
      }
    }
  } finally {
    await browser?.close()
    await server.close()
  }
})
