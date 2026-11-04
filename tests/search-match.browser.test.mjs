// Browser test: Search Console on the v1 Target page (workspace/SearchMatch.jsx) and the Content list.
// - ONE target page everywhere (owner, 2026-11-04): Publish on = the Update column = the payoff bar line; picking
//   another page in Your pages moves all three; "Use the suggested page" brings Search Console's back.
// - The connect step first when never connected (?co=gsc-new): Connect (spinner) → the section with the
//   "Connected · <domain> · Change" chip; Skip → the route's page and the slim "better match" row.
// - The create case, a tagged query (account / local), the list banner and the Best page column.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { chromePath } from './chromePath.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))

test('Search Console: one target page everywhere, the connect step, skip, the create case, tags, the list banner and Best page', async () => {
  const server = await createServer({ root, logLevel: 'silent', server: { port: 0, strictPort: false } })
  await server.listen()
  const base = `http://localhost:${server.httpServer.address().port}`
  let browser
  try {
    browser = await chromium.launch({ executablePath: chromePath() })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const sc = () => page.locator('[data-search-match]')
    const updatePath = () => page.locator('[data-target-path]').innerText()
    const payoffLine = () => page.getByText(/ this prompt today$/).first().innerText()

    // connected (the default): Publish on IS the target page: the Update column and the payoff bar say the same path
    await page.goto(`${base}/opportunities/content/9`, { waitUntil: 'networkidle' })
    await sc().waitFor()
    assert.match((await sc().locator('[data-sc-connected]').innerText()).replace(/\s+/g, ' '), /Connected · dermasuri\.com · Change/)
    const chain = sc().locator('[data-sc-chain="update"]')
    assert.ok((await chain.innerText()).includes('Best query'))
    const publishOn = await chain.locator('p').filter({ hasText: /^\// }).first().innerText()
    assert.equal(await updatePath(), publishOn, 'the Update column = Publish on')
    assert.ok((await payoffLine()).startsWith(`${publishOn} ·`), 'the payoff bar = Publish on')
    assert.equal(await page.locator('[data-sc-source="sc"]').count(), 1, '"From Search Console" under the Update page')
    assert.equal(await chain.getByRole('button', { name: 'Using this page' }).count(), 1)

    // pick another page in Your pages: all three follow it
    const other = sc().locator('[data-your-page]').filter({ hasNot: page.locator('text=Best match') }).first()
    const otherPath = await other.getAttribute('data-your-page')
    assert.notEqual(otherPath, publishOn)
    await other.click()
    await page.locator('[data-sc-source="pick"]').waitFor()
    assert.equal(await updatePath(), otherPath, 'the Update column follows the pick')
    assert.ok((await payoffLine()).startsWith(`${otherPath} ·`), 'the payoff bar follows the pick')
    assert.equal(await other.getAttribute('aria-checked'), 'true')
    assert.equal(await chain.getByRole('button', { name: 'Update this page' }).count(), 1, 'the chain offers Search Console\'s page back')
    // back to Search Console's page
    await page.getByRole('button', { name: 'Use the suggested page' }).click()
    assert.equal(await updatePath(), publishOn)
    assert.ok((await payoffLine()).startsWith(`${publishOn} ·`))

    // an account / local query: muted, tagged, scored at half
    await page.goto(`${base}/opportunities/content/7`, { waitUntil: 'networkidle' })
    const tagged = sc().locator('[data-intent]').first()
    assert.match(await tagged.innerText(), /account|local|site/)

    // the create case: the target is the new page
    await page.goto(`${base}/opportunities/content/0`, { waitUntil: 'networkidle' })
    const create = sc().locator('[data-sc-chain="create"]')
    assert.ok((await create.innerText()).includes('Create a new page'))
    assert.match(await create.innerText(), /No query matches this prompt well enough yet \(best \d+%\)/)
    const newPath = await create.locator('p').filter({ hasText: /^\// }).first().innerText()
    assert.equal(await updatePath(), newPath, 'the Update column = the new page')

    // never connected: the connect step comes FIRST (before the ladder) → Connect (spinner) → the section and its chip
    await page.goto(`${base}/opportunities/content/9?co=gsc-new`, { waitUntil: 'networkidle' })
    const ask = page.locator('[data-sc-ask]')
    await ask.waitFor()
    assert.ok((await ask.innerText()).includes('Read-only. We use it to find which of your pages already gets search traffic for this prompt, so the content goes on the right page.'))
    const order = await page.evaluate(() => {
      const a = document.querySelector('[data-sc-ask]'), l = [...document.querySelectorAll('h3')].find((h) => h.textContent.includes('Google page 1'))
      return a && l ? a.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING : 0
    })
    assert.ok(order, 'the connect step is before the Google page-1 ladder')
    assert.equal(await sc().count(), 0, 'no Search Console section while asking')
    const routePath = await updatePath()
    await ask.getByRole('button', { name: 'Connect Search Console' }).click()
    await ask.getByText('Connecting…').waitFor()
    await sc().locator('[data-sc-chain]').waitFor({ timeout: 5000 })
    assert.equal(await page.locator('[data-sc-ask]').count(), 0)
    assert.ok(await sc().locator('[data-sc-connected]').count())
    // Change reopens the connect step
    await sc().getByRole('button', { name: 'Change' }).click()
    await page.locator('[data-sc-ask]').waitFor()

    // Skip: the route's page, the slim row, no section
    await page.goto(`${base}/opportunities/content/9?co=gsc-new`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Skip, we’ll suggest a page' }).click()
    await page.locator('[data-sc-skipped]').waitFor()
    assert.ok((await page.locator('[data-sc-skipped]').innerText()).includes('Connect Search Console for a better match'))
    assert.equal(await sc().count(), 0)
    assert.equal(await updatePath(), routePath, 'skipped: the route\'s suggested page')
    assert.ok((await payoffLine()).startsWith(`${routePath} ·`))

    // the list: Best page column; not connected → the banner, Connect fills the column
    await page.goto(`${base}/opportunities/content`, { waitUntil: 'networkidle' })
    assert.equal(await page.locator('[data-sc-banner]').count(), 0)
    assert.ok(await page.getByRole('columnheader', { name: /Best page/ }).count())
    assert.match(await page.locator('tbody tr').first().innerText(), /\/\S+\s+\d+%/)
    await page.getByPlaceholder(/search/i).first().fill('best azelaic acid cream for rosacea')
    assert.ok((await page.locator('tbody tr').first().innerText()).includes('New page'))
    await page.goto(`${base}/opportunities/content?co=gsc-new`, { waitUntil: 'networkidle' })
    const banner = page.locator('[data-sc-banner]')
    assert.match(await banner.innerText(), /Connect Search Console to find the best page for every prompt/)
    assert.doesNotMatch(await page.locator('tbody tr').first().innerText(), /\/\S+\s+\d+%/)
    await banner.getByRole('button', { name: 'Connect' }).click()
    await banner.waitFor({ state: 'detached', timeout: 5000 })
    assert.match(await page.locator('tbody tr').first().innerText(), /\/\S+\s+\d+%/)
  } finally {
    await browser?.close()
    await server.close()
  }
})
