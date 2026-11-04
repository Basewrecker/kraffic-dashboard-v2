// Browser regression test: a draft written for a prompt is still there after a reload.
// Bug (2026-11-04, "Draft ready can't be opened"): the brief saved in this browser kept the ticks and times but not
// that a draft was written, so reopening the prompt after a reload started over at the Target page, and the list
// never showed "Draft ready" for it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { chromePath } from './chromePath.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const ID = 9 // a missed prompt with no sample state (the proposed data has none for it), so it starts on the Target page

test('a written draft reopens after a reload, and the list shows it as Draft ready', async () => {
  const server = await createServer({ root, logLevel: 'silent', server: { port: 0, strictPort: false } })
  await server.listen()
  const base = `http://localhost:${server.httpServer.address().port}`
  let browser
  try {
    browser = await chromium.launch({ executablePath: chromePath() })
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await page.goto(`${base}/opportunities/content/${ID}`, { waitUntil: 'networkidle' })
    const title = await page.locator('header h1, h1').first().innerText()

    // write the draft: Target page → Your data (skip) → Draft, then wait for the (mock) response
    await page.getByRole('button', { name: 'Skip to draft' }).first().click()
    const dlg = page.getByRole('dialog')
    await dlg.getByText('Copy content', { exact: true }).waitFor({ timeout: 20000 })

    // reload: the draft is back, no writing state
    await page.reload({ waitUntil: 'networkidle' })
    const after = page.getByRole('dialog')
    await after.getByText('Copy content', { exact: true }).waitFor({ timeout: 5000 })
    assert.equal(await after.getByText('Writing your draft', { exact: false }).count(), 0, 'no writing state after a reload')
    assert.ok((await after.innerText()).includes(title.trim()), 'the reopened draft is this prompt\'s')

    // the list shows it as Draft ready, and opening it lands on the draft
    await page.goto(`${base}/opportunities/content`, { waitUntil: 'networkidle' })
    await page.getByPlaceholder(/search/i).first().fill(title.trim()) // the list pages by 10: find the row
    const row = page.locator('tbody tr').filter({ hasText: title.trim() }).first()
    assert.ok((await row.innerText()).includes('Draft ready'), 'the list shows Draft ready')
    await row.click()
    await page.getByRole('dialog').getByText('Copy content', { exact: true }).waitFor({ timeout: 5000 })
  } finally {
    await browser?.close()
    await server.close()
  }
})
