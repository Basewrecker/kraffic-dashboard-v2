// Browser test: Cited pages by folder (owner, 2026-11-04). The Overview card (donut + legend: top 6 folders and "Other n
// folders"; hover → the centre reads that folder; click → the drawer on that folder) and its drawer (engine tabs, metric
// tabs, the pages grouped by folder, the footer).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { chromePath } from './chromePath.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))

test('Cited pages by folder: the card, hover, and the drawer on one folder', async () => {
  const server = await createServer({ root, logLevel: 'silent', server: { port: 0, strictPort: false } })
  await server.listen()
  const base = `http://localhost:${server.httpServer.address().port}`
  let browser
  try {
    browser = await chromium.launch({ executablePath: chromePath() })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    await page.goto(`${base}/overview`, { waitUntil: 'networkidle' })
    assert.equal(await page.getByText('Top cited pages').count(), 0, 'Top cited pages is replaced')
    const card = page.locator('#cited-folders')
    await card.scrollIntoViewIfNeeded()
    assert.match(await card.innerText(), /Cited pages by folder/)
    assert.match(await card.innerText(), /Your URLs that AI answers cite · \d+ citations/)
    const rows = card.locator('[data-folder]')
    assert.equal(await rows.count(), 7, 'top 6 folders + Other')
    assert.equal(await rows.nth(0).getAttribute('data-folder'), '/blog/')
    assert.match(await rows.nth(6).innerText(), /Other \d+ folders/)
    assert.match(await card.innerText(), /The \/blog\/ folder earns \d+% of your citations\./)
    // percentages add up to 100
    const pcts = (await card.locator('[data-folder]').allInnerTexts()).map((t) => Number(/(\d+)%/.exec(t)[1]))
    assert.equal(pcts.reduce((a, b) => a + b, 0), 100)
    // the centre shows ONLY the percentage (owner, 2026-11-04), at rest and on hover; the folder is for screen readers
    const centre = card.locator('[aria-live="polite"]')
    const seen = () => centre.evaluate((el) => ({
      text: [...el.querySelectorAll('*')].filter((n) => !n.closest('.sr-only') && n.childNodes.length).flatMap((n) => [...n.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent)).join('').trim(),
      svg: el.querySelectorAll('svg').length,
    }))
    assert.match((await seen()).text, /^\d+%$/, 'at rest: only the %')
    // hover a row: the centre reads that folder (its % shows; its name is for screen readers)
    await rows.nth(1).hover()
    await page.waitForTimeout(400)
    assert.match(await centre.innerText(), /\/products\//)
    const h = await seen()
    assert.match(h.text, /^\d+%$/, 'on hover: only the %, no name, count or trend')
    assert.equal(h.svg, 0, 'no mini trend in the centre')

    // click: the drawer on that folder
    await rows.nth(0).click()
    const dlg = page.getByRole('dialog', { name: 'Cited pages in /blog/' })
    await dlg.waitFor()
    assert.match(await dlg.innerText(), /Cited pages by folder/)
    for (const t of ['Citations', 'Cited pages', 'Folders']) assert.equal(await dlg.getByRole('tab', { name: new RegExp(`^${t}`) }).count(), 1, t)
    assert.ok(await dlg.getByRole('tab', { name: /^AI Overview/ }).count() >= 1, 'engine tabs')
    assert.equal(await dlg.locator('[data-folder-group]').count(), 1, 'only the picked folder')
    assert.match(await dlg.locator('footer').innerText(), /\d+ citations · \d+ pages in \/blog\/ · updated/)
    // clear the folder: every folder, grouped
    await dlg.getByRole('button', { name: /Show all folders/ }).click()
    const all = page.getByRole('dialog', { name: 'Cited pages by folder' })
    await all.waitFor()
    assert.ok(await all.locator('[data-folder-group]').count() >= 7)
    assert.match(await all.locator('footer').innerText(), /\d+ citations · \d+ pages · \d+ folders · updated/)
  } finally {
    await browser?.close()
    await server.close()
  }
})
