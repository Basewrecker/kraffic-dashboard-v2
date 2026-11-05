// Browser test: Search Console on the v1 Target page (workspace/SearchMatch.jsx) and the Content list.
// - One flow visual (owner, 2026-11-05): the prompt → its matching searches → your pages, the page in use on top;
//   no Best query / Publish on / Other top queries blocks. One line under it: "Using this page: <path> · Change page";
//   Change page moves the flow's top node, the line and the payoff bar (all read Workspace `page`, the request's target).
// - The format matrix has no "Cited by" column.
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

    // the payoff bar crossfades: wait until exactly one line is left and it starts with the path
    const payoffIs = (path) => page.waitForFunction((p) => {
      const lines = [...document.querySelectorAll('*')].filter((el) => !el.children.length && / this prompt today$/.test(el.textContent))
      return lines.length === 1 && lines[0].textContent.startsWith(`${p} ·`)
    }, path, { timeout: 5000 })
    const flow = () => sc().locator('[data-sc-flow]')
    const using = () => sc().locator('[data-sc-using]')

    // connected (the default): one flow visual, no Best query / Publish on / Other top queries / Your pages blocks
    await page.goto(`${base}/opportunities/content/9`, { waitUntil: 'networkidle' })
    await sc().waitFor()
    assert.match((await sc().locator('[data-sc-connected]').innerText()).replace(/\s+/g, ' '), /Connected · dermasuri\.com · Change/)
    await flow().waitFor()
    const text = await sc().innerText()
    for (const gone of ['Best query', 'Publish on', 'Other top queries', 'View all queries']) assert.ok(!text.includes(gone), `no "${gone}" block`)
    assert.equal(await sc().locator('[data-sc-chain]').count(), 0)
    // the nodes: the prompt, the searches (Best first, low volume last, each with impressions + match %), your pages
    assert.equal(await flow().locator('[data-flow-prompt]').count(), 1)
    const qs = flow().locator('[data-flow-query]')
    assert.ok(await qs.count() >= 2)
    assert.equal(await qs.first().getAttribute('data-best'), 'true', 'the Best query is first')
    const lows = await qs.evaluateAll((els) => els.map((e) => e.hasAttribute('data-low-volume')))
    assert.ok(lows.every((l, i) => !l || lows.slice(i).every(Boolean)), 'low-volume searches come last')
    for (const t of await qs.allInnerTexts()) assert.match(t, /[\d,.]+k? impr · \d+% match/)
    const top = flow().locator('[data-flow-page]').first()
    assert.equal(await top.getAttribute('data-using'), 'true', 'the page in use is the top node')
    assert.match(await top.getAttribute('class'), /border-ink/, 'with a solid border')
    // ribbons: prompt → every search, and the in-use chain in ink
    assert.equal(await flow().locator('[data-ribbon^="prompt|"]').count(), await qs.count())
    assert.ok(await flow().locator('[data-chain]').count() >= 2)
    // one line under it: Using this page = the Update column = the payoff bar
    const scPath = await top.getAttribute('data-flow-page')
    assert.match((await using().innerText()).replace(/\s+/g, ' '), /^Using this page: \/\S+ · Change page$/)
    assert.equal(await using().getAttribute('data-sc-using'), scPath)
    await payoffIs(scPath)

    // hover a search: its chain lights, the rest dims; hover a page: the same
    await qs.nth(1).hover()
    assert.ok(await flow().locator('[data-flow-query].opacity-35').count() >= 1, 'the other searches dim')
    await top.hover()
    assert.equal(await top.getAttribute('class').then((c) => /opacity-35/.test(c)), false)

    // Change page: pick another page → the flow's top node, the Update column, the payoff bar follow
    await page.mouse.move(5, 5)
    await using().getByRole('button', { name: 'Change page' }).click()
    const menu = page.getByRole('menu', { name: 'Choose the page' })
    const other = menu.locator('[role="menuitemradio"][aria-checked="false"]:not([data-path="create"])').first()
    const otherPath = await other.getAttribute('data-path')
    await other.click()
    assert.equal(await flow().locator('[data-flow-page]').first().getAttribute('data-flow-page'), otherPath)
    assert.equal(await using().getAttribute('data-sc-using'), otherPath, 'the line follows (Workspace `page`: the draft request\'s target)')
    await payoffIs(otherPath)
    // "Create a new page" from the same menu
    await using().getByRole('button', { name: 'Change page' }).click()
    await menu.getByRole('menuitemradio', { name: /Create a new page/ }).click()
    assert.equal(await using().getAttribute('data-sc-using'), 'create')
    // back to Search Console's page
    await using().getByRole('button', { name: 'Change page' }).click()
    await menu.locator(`[data-path="${scPath}"]`).click()
    assert.equal(await using().getAttribute('data-sc-using'), scPath)
    await payoffIs(scPath)

    // the format matrix: no "Cited by" column
    const matrix = page.getByRole('table', { name: 'Formats by page' })
    assert.equal(await matrix.getByRole('columnheader', { name: 'Cited by' }).count(), 0)

    // an account / local / site search: faint, tagged
    await page.goto(`${base}/opportunities/content/7`, { waitUntil: 'networkidle' })
    const tagged = flow().locator('[data-intent]').first()
    assert.match(await tagged.innerText(), /account|local|site/)

    // the create case: the target is the new page
    await page.goto(`${base}/opportunities/content/0`, { waitUntil: 'networkidle' })
    await flow().waitFor()
    assert.equal(await using().getAttribute('data-sc-using'), 'create')
    assert.equal(await flow().locator('[data-flow-page]').first().innerText().then((t) => t.includes('New page')), true)
    const newPath = await flow().locator('[data-flow-page]').first().getAttribute('data-flow-page')
    await payoffIs(newPath)

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
    const routePath = (await page.getByText(/ this prompt today$/).last().innerText()).split(' · ')[0]
    await ask.getByRole('button', { name: 'Connect Search Console' }).click()
    await ask.getByText('Connecting…').waitFor()
    await sc().locator('[data-sc-flow]').waitFor({ timeout: 5000 })
    assert.equal(await page.locator('[data-sc-ask]').count(), 0)
    assert.ok(await sc().locator('[data-sc-connected]').count())
    // Change reopens the connect step
    await sc().getByRole('button', { name: 'Change', exact: true }).click()
    await page.locator('[data-sc-ask]').waitFor()

    // Skip: the route's page, the slim row, no section
    await page.goto(`${base}/opportunities/content/9?co=gsc-new`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Skip, we’ll suggest a page' }).click()
    await page.locator('[data-sc-skipped]').waitFor()
    assert.ok((await page.locator('[data-sc-skipped]').innerText()).includes('Connect Search Console for a better match'))
    assert.equal(await sc().count(), 0)
    await payoffIs(routePath)

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
