// Browser test: Search Console on the v1 Target page (workspace/SearchMatch.jsx) and the Content list's Best page
// column. The chain (best query → publish on → Update this page, which becomes the Update column's page), the create
// case, an account / local query tagged and scored at half, and the not-connected state with Connect.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { chromePath } from './chromePath.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))

test('Search Console: the chain, Update this page, the create case, tags, not connected, and the Best page column', async () => {
  const server = await createServer({ root, logLevel: 'silent', server: { port: 0, strictPort: false } })
  await server.listen()
  const base = `http://localhost:${server.httpServer.address().port}`
  let browser
  try {
    browser = await chromium.launch({ executablePath: chromePath() })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const sc = () => page.locator('[data-search-match]')

    // an update prompt: the chain, then Update this page drives the Update column
    await page.goto(`${base}/opportunities/content/9`, { waitUntil: 'networkidle' })
    await sc().waitFor()
    const chain = sc().locator('[data-sc-chain="update"]')
    assert.ok((await chain.innerText()).includes('Best query'))
    const publishOn = await chain.locator('p').filter({ hasText: /^\// }).first().innerText()
    assert.match(await chain.innerText(), /of that query’s impressions/)
    await sc().getByRole('button', { name: 'Update this page' }).click()
    await page.getByText('From Search Console').waitFor()
    const updateCol = page.locator('section[aria-labelledby="co-target-h"]')
    assert.ok((await updateCol.innerText()).includes(publishOn), 'the Update column shows the Search Console page')
    await page.getByRole('button', { name: 'Use the suggested page' }).click()
    assert.equal(await page.getByText('From Search Console').count(), 0, 'back to the route\'s page')

    // an account / local query: muted, tagged, scored at half
    await page.goto(`${base}/opportunities/content/2`, { waitUntil: 'networkidle' })
    const tagged = sc().locator('[data-intent]').first()
    assert.match(await tagged.innerText(), /account|local/)

    // the create case
    await page.goto(`${base}/opportunities/content/0`, { waitUntil: 'networkidle' })
    const create = sc().locator('[data-sc-chain="create"]')
    assert.ok((await create.innerText()).includes('Create a new page'))
    assert.match(await create.innerText(), /No query matches this prompt well enough yet \(best \d+%\)/)

    // not connected → Connect → the chain
    await page.goto(`${base}/opportunities/content/9?co=gsc-new`, { waitUntil: 'networkidle' })
    assert.ok((await sc().innerText()).includes('Connect Search Console to rank your pages by real search traffic'))
    await sc().getByRole('button', { name: 'Connect' }).click()
    await sc().locator('[data-sc-chain]').waitFor({ timeout: 5000 })
    assert.ok(await page.locator('h3', { hasText: 'Google page 1 for this prompt' }).count(), 'the ladder renders in every state')

    // the list's Best page column: a path with its match, or "New page"
    await page.goto(`${base}/opportunities/content`, { waitUntil: 'networkidle' })
    assert.ok(await page.getByRole('columnheader', { name: /Best page/ }).count())
    assert.match(await page.locator('tbody tr').first().innerText(), /\/\S+\s+\d+%/)
    await page.getByPlaceholder(/search/i).first().fill('best azelaic acid cream for rosacea')
    assert.ok((await page.locator('tbody tr').first().innerText()).includes('New page'))
  } finally {
    await browser?.close()
    await server.close()
  }
})
