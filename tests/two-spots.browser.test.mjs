// Browser test: a site on two Google page-1 spots (owner, 2026-11-05).
// - The winners table and the Draft rail use the display name ("The Ordinary"; an untracked site's tidied domain,
//   never a raw domain).
// - "+1 page" has the dotted "hover me" underline; its hover is two lines: the cited page's path + format, then
//   "Also #<rank> on Google page 1" + that page's path. The Draft rail's row card says the same.
// - The page-1 strip: hovering a site that holds two spots keeps both circles bright and dims the others (40%).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { chromePath } from './chromePath.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const SECOND = /^Also #\d+ on Google page 1 · \/\S*/

test('two page-1 spots: display names, the two-line hover (table and rail), the dotted note, both circles lit', async () => {
  const server = await createServer({ root, logLevel: 'silent', server: { port: 0, strictPort: false } })
  await server.listen()
  const base = `http://localhost:${server.httpServer.address().port}`
  let browser
  try {
    browser = await chromium.launch({ executablePath: chromePath() })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })

    // prompt 11: The Ordinary at #1 and #5
    await page.goto(`${base}/opportunities/content/11`, { waitUntil: 'networkidle' })
    const table = page.getByRole('table', { name: 'Formats by page' })
    await table.waitFor()
    const names = await table.locator('[role="rowheader"] .truncate.font-semibold').allInnerTexts()
    assert.ok(names.includes('The Ordinary'), `the brand name, not the domain (${names.join(', ')})`)
    assert.ok(names.every((n) => !/\.(com|org|net|co)\b/.test(n)), 'no raw domain in the table')
    // "+1 page": dotted underline, two-line hover
    const note = table.getByRole('button', { name: /^\+1 page/ }).first()
    assert.match(await note.getAttribute('class'), /decoration-dotted/)
    await note.hover()
    const tip = note.locator('xpath=following-sibling::*[@role="tooltip"]')
    await tip.waitFor({ state: 'visible' })
    const lines = (await tip.innerText()).split('\n').map((s) => s.trim()).filter(Boolean)
    assert.match(lines[0], /^\/\S* · .+/, `line 1: the path and its format (${lines[0]})`)
    assert.match(lines[1], SECOND, `line 2: also on page 1 (${lines[1]})`)

    // the page-1 strip: hover one of The Ordinary's circles → both bright, the rest dimmed
    await page.mouse.move(5, 5)
    const slots = page.locator('[data-slot-host="theordinary.com"]')
    assert.equal(await slots.count(), 2, 'both spots on the strip')
    await slots.first().hover()
    assert.equal(await page.locator('[data-slot-host="theordinary.com"][data-dim]').count(), 0, 'both of its circles stay bright')
    assert.ok(await page.locator('[data-slot-host][data-dim]').count() >= 5, 'the other sites dim')
    assert.equal(await page.locator('[data-slot-host] [role="tooltip"]').count(), 1, 'one card (the circle under the pointer)')

    // the Draft rail (prompt 2 opens on its draft): the display name, the dotted note, the same two lines
    await page.goto(`${base}/opportunities/content/2`, { waitUntil: 'networkidle' })
    const row = page.locator('li', { has: page.locator('[data-more-pages]') }).first()
    await row.scrollIntoViewIfNeeded()
    assert.match(await row.locator('[data-more-pages]').getAttribute('class'), /decoration-dotted/)
    assert.doesNotMatch(await row.locator('.truncate.font-semibold').first().innerText(), /\.(com|org|net)\b/)
    await row.hover()
    const card = row.locator('[role="tooltip"]')
    const cl = (await card.innerText()).split('\n').map((s) => s.trim()).filter(Boolean)
    assert.match(cl[0], /^\/\S* · .+/, `rail line 1 (${cl[0]})`)
    assert.match(cl[1], SECOND, `rail line 2 (${cl[1]})`)
  } finally {
    await browser?.close()
    await server.close()
  }
})
