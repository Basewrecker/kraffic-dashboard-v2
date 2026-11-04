// Browser test: an engine whose latest scan didn't answer has no score (null), shown as "—", never 0.
// /overview?noresult=gemini&engine=gemini: Gemini's latest scan returned no result (data/brandViews.js noResultEngines)
// and the engine filter is on Gemini. The Visibility score ring, the history's Current score, the "Viewing as" menu's
// score for the brand and the Sync history's latest row must read "—", and the ⓘ says why.
// Runs a real browser (playwright-core + the Chromium in ~/Library/Caches/ms-playwright) against Vite's dev server.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { chromePath } from './chromePath.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const ZERO = /^0\s*%?$/

test('a null engine score renders as "—" with its ⓘ, never as 0', async () => {
  const server = await createServer({ root, logLevel: 'silent', server: { port: 0, strictPort: false } })
  await server.listen()
  const { port } = server.httpServer.address()
  let browser
  try {
    browser = await chromium.launch({ executablePath: chromePath() })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(`http://localhost:${port}/overview?noresult=gemini&engine=gemini`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400) // count-ups

    const shown = await page.evaluate(() => {
      const text = (el) => el?.textContent.trim() ?? null
      const leaf = (t) => [...document.querySelectorAll('main *')].find((el) => el.childNodes[0]?.nodeValue?.trim() === t)
      // the KPI card: up from its label to the first box holding the ring
      let card = leaf('Visibility score')
      while (card && !card.querySelector('svg text')) card = card.parentElement
      // Visibility history's "Current" (the summary strip; in the DOM with Compare on too)
      const current = leaf('Current')?.nextElementSibling
      // Sync history's latest row: its score cell
      const latest = [...document.querySelectorAll('main li')].find((li) => li.querySelector('button span')?.textContent.includes('Latest'))
      return {
        ring: text(card?.querySelector('svg text')),
        current: text(current),
        syncRow: text(latest?.querySelector('button > span:nth-child(3) > span:first-child')),
      }
    })

    // the brand menu ("Viewing as"): the score beside the brand being viewed
    await page.locator('main button[aria-label^="Viewing as"]').click()
    const option = page.getByRole('option', { name: /Dermasuri/ })
    await option.waitFor({ state: 'visible' })
    shown.brandMenu = (await option.locator('span').last().textContent()).trim()
    await page.keyboard.press('Escape')

    for (const [where, v] of Object.entries(shown)) {
      assert.ok(v != null, `${where}: the score element is missing`)
      assert.ok(!ZERO.test(v), `${where} renders a null score as "${v}" (all: ${JSON.stringify(shown)})`)
      assert.equal(v, '—', `${where} shows "—" for no result`)
    }

    // the ⓘ beside the KPI's "—" says why
    const info = page.locator('main button[aria-label^="No result from"]').first()
    await info.hover()
    const tip = page.getByRole('tooltip').filter({ hasText: 'No result from' })
    await tip.waitFor({ state: 'visible' })
    assert.equal((await tip.textContent()).trim(), 'No result from Gemini in the latest scan')
  } finally {
    await browser?.close()
    await server.close()
  }
})
