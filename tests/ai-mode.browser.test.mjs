// Browser test: the AI Mode split and an account without AI Mode (owner's rules, 2026-11-04).
// ?aimode=new: the latest sync is AI Mode's first → on AI Overview and All engines the score card says "Scoring updated
// <day>" (with the ⓘ) in place of its change line, and Visibility history marks the day; never on other engines.
// ?aimode=off: no AI Mode data → AI Mode is hidden (not shown as 0).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { chromePath } from './chromePath.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const TIP = 'Google AI Mode is now counted separately, so Google AI Overview no longer includes AI Mode results.'

test('AI Mode split marker on AI Overview / All engines only; no AI Mode for an account without it', async () => {
  const server = await createServer({ root, logLevel: 'silent', server: { port: 0, strictPort: false } })
  await server.listen()
  const base = `http://localhost:${server.httpServer.address().port}`
  let browser
  try {
    browser = await chromium.launch({ executablePath: chromePath() })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    for (const engine of ['all', 'aio']) {
      await page.goto(`${base}/overview?aimode=new${engine === 'all' ? '' : `&engine=${engine}`}`, { waitUntil: 'networkidle' })
      const line = page.locator('[data-scoring-updated]').first()
      await line.waitFor()
      assert.match(await line.innerText(), /^Scoring updated Oct 5/, `${engine}: the score card line`)
      assert.equal(await line.locator(`[aria-label="${TIP}"]`).count(), 1, `${engine}: the ⓘ text`)
      assert.equal(await page.getByText('pts vs last sync').count(), 0, `${engine}: no change line`)
      assert.ok(await page.locator('#history').getByText('Scoring updated Oct 5').count() >= 1, `${engine}: the history marker`)
    }
    for (const engine of ['aimode', 'gemini']) {
      await page.goto(`${base}/overview?aimode=new&engine=${engine}`, { waitUntil: 'networkidle' })
      await page.locator('#history').waitFor()
      assert.equal(await page.getByText('Scoring updated Oct 5').count(), 0, `${engine}: no split marker`)
    }
    await page.goto(`${base}/overview?aimode=off`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /^Engine/ }).first().click()
    const menu = page.getByRole('menu').or(page.getByRole('listbox')).first()
    await menu.waitFor()
    assert.match(await menu.innerText(), /Google AI Overview/)
    assert.doesNotMatch(await menu.innerText(), /AI Mode/, 'AI Mode hidden, not 0')
  } finally {
    await browser?.close()
    await server.close()
  }
})
