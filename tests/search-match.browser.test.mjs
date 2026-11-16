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
    // current layout: the page in use is the headline of the Target page (the old payoff line is gone)
    const headPath = async () => (await page.locator('#co-step-h').last().innerText()).split('\n').map((l) => l.trim()).find((l) => l.startsWith('/'))
    const payoffIs = (path) => page.waitForFunction((p) => { const h = document.querySelectorAll('#co-step-h'); return h.length === 1 && h[0].innerText.split('\n').some((l) => l.trim() === p) }, path, { timeout: 5000 }) // (it crossfades: one headline left)
    const using = () => sc().locator('[data-sc-using]')
    const source = () => sc().locator('[data-page-source]')

    // connected (the default). Current layout, as the app: the Google searches section is hidden; only its
    // "Publishing on" row shows, in the headline's facts: the page, where it came from, Change page
    await page.goto(`${base}/opportunities/content/9`, { waitUntil: 'networkidle' })
    await sc().waitFor()
    assert.ok(await sc().evaluate((el) => el.hasAttribute('data-sc-hidden')), 'the searches section is hidden')
    const text = await page.locator('main').innerText()
    for (const gone of ['Best query', 'Publish on', 'Other top queries', 'View all queries', 'Google searches']) assert.ok(!text.includes(gone), `no "${gone}" block`)
    assert.equal(await page.locator('[data-sc-queries], [data-sc-flow], [data-sc-chain], [data-sc-connected]').count(), 0)
    assert.equal(await page.locator('[data-head-facts]').locator('[data-search-match]').count(), 1, 'the row sits in the headline\'s facts')
    assert.match(await page.locator('[data-head-facts]').innerText(), /Publishing on/)
    assert.match((await using().innerText()).replace(/\s+/g, ' '), /^\/\S+ · From Search Console · Change page$/)
    // one page everywhere: the row = the headline
    const scPath = await using().getAttribute('data-sc-using')
    assert.match(scPath, /^\/\S+$/)
    await payoffIs(scPath)

    // Change page: pick another page → the row, its source and the headline follow
    await using().getByRole('button', { name: 'Change page' }).click()
    const menu = page.getByRole('menu', { name: 'Choose the page' })
    assert.equal(await menu.locator('[role="menuitemradio"][aria-checked="true"]').getAttribute('data-path'), scPath, 'the page in use is the ticked one')
    const other = menu.locator('[role="menuitemradio"][aria-checked="false"]:not([data-path="create"])').first()
    const otherPath = await other.getAttribute('data-path')
    await other.click()
    assert.equal(await using().getAttribute('data-sc-using'), otherPath, 'the row follows (Workspace `page`: the draft request\'s target)')
    assert.equal(await source().innerText(), 'Your pick')
    await payoffIs(otherPath)
    // "Create a new page" from the same menu
    await using().getByRole('button', { name: 'Change page' }).click()
    await menu.getByRole('menuitemradio', { name: /Create a new page/ }).click()
    assert.equal(await using().getAttribute('data-sc-using'), 'create')
    await page.waitForFunction(() => { const h = document.querySelectorAll('#co-step-h'); return h.length === 1 && h[0].innerText.includes('New page') }, null, { timeout: 5000 })
    // back to Search Console's page
    await using().getByRole('button', { name: 'Change page' }).click()
    await menu.locator(`[data-path="${scPath}"]`).click()
    assert.equal(await using().getAttribute('data-sc-using'), scPath)
    await payoffIs(scPath)

    // the format matrix (current layout, as the app): the "Cited by" column is back
    const matrix = page.getByRole('table', { name: 'Formats by page' })
    assert.equal(await matrix.getByRole('columnheader', { name: 'Cited by' }).count(), 1)

    // the Google searches section itself (hidden by default; ?co=searches shows it): a table of searches, the Best one
    // first, low volume last, each with its numbers; the row above it is the same page as the headline
    await page.goto(`${base}/opportunities/content/9?co=searches`, { waitUntil: 'networkidle' })
    const table = sc().locator('[data-sc-queries]')
    await table.waitFor()
    assert.equal(await sc().evaluate((el) => el.hasAttribute('data-sc-hidden')), false)
    const qs = table.locator('[data-query]')
    assert.ok(await qs.count() >= 2)
    assert.ok(await qs.first().evaluate((el) => el.hasAttribute('data-best')), 'the Best query is first')
    const lows = await qs.evaluateAll((els) => els.map((e) => e.hasAttribute('data-low-volume')))
    assert.ok(lows.every((l, i) => !l || lows.slice(i).every(Boolean)), 'low-volume searches come last')
    for (const t of await qs.allInnerTexts()) assert.match(t.replace(/\s+/g, ' '), / [\d,.]+k? [A-Z][a-z]+/, `a search row has its impressions, then its verdict (${t.replace(/\s+/g, ' ').slice(0, 80)})`)
    assert.ok(await table.locator('[data-publishing]').count() >= 1, 'the search whose page is in use is marked')
    assert.equal(await using().getAttribute('data-sc-using'), scPath)
    await payoffIs(scPath)

    // an account / local / site search: tagged
    await page.goto(`${base}/opportunities/content/7?co=searches`, { waitUntil: 'networkidle' })
    const tagged = sc().locator('[data-sc-queries] [data-intent]').first()
    assert.match(await tagged.innerText(), /account|local|site/i)

    // the create case: the target is the new page
    await page.goto(`${base}/opportunities/content/0`, { waitUntil: 'networkidle' })
    await using().waitFor()
    assert.equal(await using().getAttribute('data-sc-using'), 'create')
    await page.waitForFunction(() => { const h = document.querySelectorAll('#co-step-h'); return h.length === 1 && h[0].innerText.includes('New page') }, null, { timeout: 5000 })
    assert.match(await headPath(), /^\/\S+$/)

    // never connected: the connect step comes FIRST (before the ladder) → Connect (spinner) → the row and its source
    await page.goto(`${base}/opportunities/content/9?co=gsc-new`, { waitUntil: 'networkidle' })
    const ask = page.locator('[data-sc-ask]')
    await ask.waitFor()
    assert.ok((await ask.innerText()).includes('Read-only. We use it to find which of your pages already gets search traffic for this prompt, so the content goes on the right page.'))
    const order = await page.evaluate(() => {
      const a = document.querySelector('[data-sc-ask]'), l = [...document.querySelectorAll('h3')].find((h) => h.textContent.includes('Google page 1'))
      return a && l ? a.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING : 0
    })
    assert.ok(order, 'the connect step is before the Google page-1 ladder')
    assert.equal(await sc().count(), 0, 'no Search Console row while asking')
    assert.equal(await page.locator('[data-page-source]').first().innerText(), 'Suggested from your site')
    const routePath = await headPath()
    await ask.getByRole('button', { name: 'Connect Search Console' }).click()
    await ask.getByText('Connecting…').waitFor()
    await using().waitFor({ timeout: 5000 })
    assert.equal(await page.locator('[data-sc-ask]').count(), 0)
    assert.equal(await source().innerText(), 'From Search Console')
    await payoffIs(await using().getAttribute('data-sc-using'))
    // Change (on the searches section, ?co=searches) reopens the connect step
    await page.goto(`${base}/opportunities/content/9?co=gsc-new,searches`, { waitUntil: 'networkidle' })
    await page.locator('[data-sc-ask]').getByRole('button', { name: 'Connect Search Console' }).click()
    await sc().locator('[data-sc-queries]').waitFor({ timeout: 5000 })
    await sc().locator('[data-sc-change]').click()
    await page.locator('[data-sc-ask]').waitFor()

    // Skip: the route's page, no section
    await page.goto(`${base}/opportunities/content/9?co=gsc-new`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Skip, we’ll suggest a page' }).click()
    // current layout: no slim row of its own; the "Publishing on" row says where the page came from and how to connect
    await page.locator('[data-sc-ask]').waitFor({ state: 'detached' })
    assert.equal(await page.locator('[data-sc-skipped]').count(), 0)
    assert.match((await page.locator('[data-head-facts]').innerText()).replace(/\s+/g, ' '), new RegExp(`Publishing on ${routePath.replace(/[/.]/g, '\\$&')} · Suggested from your site · Connect Search Console for a better match$`))
    assert.equal(await sc().count(), 0)
    await payoffIs(routePath)
    assert.equal(await page.locator('[data-head-facts]').getByRole('button', { name: 'Connect Search Console for a better match' }).count(), 1, 'the way to connect is a button in that row')

    // the list: Best page column; not connected → the banner, Connect fills the column
    // (current layout: the card stays when connected, saying so, with Change property and Disconnect)
    await page.goto(`${base}/opportunities/content`, { waitUntil: 'networkidle' })
    assert.match((await page.locator('[data-sc-banner]').innerText()).replace(/\s+/g, ' '), /^Search Console connected · dermasuri\.com Change property Disconnect$/)
    assert.ok(await page.getByRole('columnheader', { name: /Best page/ }).count())
    assert.match(await page.locator('tbody tr').first().innerText(), /\/\S+\s+\d+%/)
    await page.getByPlaceholder(/search/i).first().fill('best azelaic acid cream for rosacea')
    assert.ok((await page.locator('tbody tr').first().innerText()).includes('New page'))
    await page.goto(`${base}/opportunities/content?co=gsc-new`, { waitUntil: 'networkidle' })
    const banner = page.locator('[data-sc-banner]')
    assert.match(await banner.innerText(), /Connect Search Console to find the best page for every prompt/)
    assert.doesNotMatch(await page.locator('tbody tr').first().innerText(), /\/\S+\s+\d+%/)
    assert.deepEqual(await banner.getByRole('button').allInnerTexts(), ['Connect'])
    await banner.getByRole('button', { name: 'Connect' }).click()
    await banner.getByText('Search Console connected').waitFor({ timeout: 5000 })
    assert.equal(await banner.getByRole('button', { name: 'Disconnect' }).count(), 1)
    assert.match(await page.locator('tbody tr').first().innerText(), /\/\S+\s+\d+%/)
  } finally {
    await browser?.close()
    await server.close()
  }
})
