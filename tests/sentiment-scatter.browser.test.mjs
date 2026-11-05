// Browser test: the Sentiment tone grid's scattered dots keep 24px clear of the centre cross's two lines and the outer
// edges, measured on the page (the dot's edge and its engine badge, from a line's far side), with Split by engine off
// and on, at 1440 and 1280 (owner, 2026-11-04).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { chromePath } from './chromePath.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))

test('scattered dots: 24px clear of the cross and the edges, split off and on, at 1440 and 1280', async () => {
  const server = await createServer({ root, logLevel: 'silent', server: { port: 0, strictPort: false } })
  await server.listen()
  const base = `http://localhost:${server.httpServer.address().port}`
  let browser
  try {
    browser = await chromium.launch({ executablePath: chromePath() })
    for (const width of [1440, 1280]) {
      for (const split of [false, true]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
        await page.goto(`${base}/sentiment`, { waitUntil: 'networkidle' })
        await page.locator('section[aria-label="Sentiment spectrum"] button[style*="width"]').first().waitFor()
        if (split) await page.getByText('Split by engine').click()
        await page.waitForTimeout(1000)
        const r = await page.evaluate(() => {
          const sec = document.querySelector('section[aria-label="Sentiment spectrum"]')
          const vEl = sec.querySelector('.border-l.border-line-strong'), hEl = sec.querySelector('.border-t.border-line-strong')
          const v = vEl.getBoundingClientRect(), h = hEl.getBoundingClientRect(), stage = vEl.parentElement.getBoundingClientRect()
          const dots = [...sec.querySelectorAll('button')].filter((b) => b.style.width && b.getAttribute('aria-hidden') !== 'true' && +getComputedStyle(b).opacity > 0)
          const out = []
          for (const b of dots) {
            const ks = [b, ...b.querySelectorAll('span')].map((e) => e.getBoundingClientRect())
            const l = Math.min(...ks.map((k) => k.left)), rr = Math.max(...ks.map((k) => k.right)), t = Math.min(...ks.map((k) => k.top)), bb = Math.max(...ks.map((k) => k.bottom))
            const cx = (l + rr) / 2, cy = (t + bb) / 2
            out.push({ label: b.getAttribute('aria-label')?.slice(0, 40), d: Math.min(cx < v.left ? v.left - rr : l - v.right, cy < h.top ? h.top - bb : t - h.bottom, l - stage.left, stage.right - rr, t - stage.top, stage.bottom - bb) })
          }
          return out
        })
        assert.ok(r.length > 3, `${width} split=${split}: dots found`)
        for (const x of r) assert.ok(x.d >= 23.5, `${width} split=${split}: "${x.label}" is ${x.d.toFixed(1)}px from a line or edge`)
        await page.close()
      }
    }
  } finally {
    await browser?.close()
    await server.close()
  }
})
