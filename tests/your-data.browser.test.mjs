// Browser test: Your data in v1 (Opportunities → Content workspace). Real files are made here (tests/
// makeFiles.mjs) and given to the step's file input: a TXT, a deflated DOCX, a PDF with a text layer (read by pdf.js),
// a PDF without one and an image. Each row says "Read · ~n words" or why not; a fact is typed; a big TXT brings the
// 20k-character message naming the file that's cut; it's all kept in this browser per brand + prompt (no File objects).
// Then the fixture: prompt 0 with ?co=data-sample writes a draft that names the clinic location from userFacts.
// Runs a real browser (playwright-core + the Chromium in ~/Library/Caches/ms-playwright) against Vite's dev server.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { chromePath } from './chromePath.mjs'
import { makeDocx, makePdf, makeTxt, words } from './makeFiles.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const KEY = 'auden:content-data:v1:dermasuri.com:best azelaic acid cream for rosacea'

test('Your data (v1): files read in the browser, a fact, the 20k cap, kept per prompt; the draft uses userFacts', { timeout: 120000 }, async () => {
  const server = await createServer({ root, logLevel: 'silent', server: { port: 0, strictPort: false } })
  await server.listen()
  const { port } = server.httpServer.address()
  const base = `http://localhost:${port}/opportunities/content/0`
  let browser
  try {
    browser = await chromium.launch({ executablePath: chromePath() })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(base, { waitUntil: 'networkidle' })

    // 4 steps: Target page → Your data → Draft → Copy & publish; the Target bar's button opens Your data in focus
    assert.equal(await page.locator('ol[aria-label^="Step"]').first().getAttribute('aria-label'), 'Step 1 of 4')
    await page.getByRole('button', { name: 'Add your data' }).first().click()
    const dlg = page.getByRole('dialog')
    await dlg.getByText('Upload documents').waitFor()
    assert.match(await dlg.locator('h3').first().textContent(), /^Step 2 of 4: Add your data/)
    assert.equal(await dlg.getByText('Your files aren’t stored. The draft you save, including any facts it uses, is kept for your team.').count(), 1)

    const input = dlg.locator('input[type=file]')
    await input.setInputFiles([
      { name: 'clinic-notes.txt', mimeType: 'text/plain', buffer: makeTxt(words(1234)) },
      { name: 'services.docx', mimeType: DOCX, buffer: makeDocx(['Our clinic is at 14 King Street, Manchester.', words(300, 'service')]) },
      { name: 'study.pdf', mimeType: 'application/pdf', buffer: makePdf(['Twelve week study of azelaic acid', 'in 64 adults with rosacea.']) },
      { name: 'scanned.pdf', mimeType: 'application/pdf', buffer: makePdf([]) },
      { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('png') },
    ])
    const row = (name) => dlg.locator('[data-file-row]', { hasText: name })
    await page.waitForFunction(() => !document.querySelector('[data-file-row="reading"]'), null, { timeout: 15000 })
    assert.match(await row('clinic-notes.txt').innerText(), /Read · ~1,200 words/)
    assert.match(await row('services.docx').innerText(), /Read · ~310 words/) // 7 + 300, deflated like Word's
    assert.match(await row('study.pdf').innerText(), /Read · ~11 words/) // pdf.js, lazy-loaded
    assert.match(await row('scanned.pdf').innerText(), /Couldn’t read this file/)
    assert.match(await row('photo.png').innerText(), /Not a PDF, DOCX, CSV or TXT/)
    assert.equal(await dlg.locator('[data-over-cap]').count(), 0)

    // a fact, typed
    await dlg.getByRole('button', { name: 'Add a fact' }).click()
    await dlg.getByLabel('Fact 1 label').fill('Clinic location')
    await dlg.getByLabel('Fact 1 value').fill('14 King Street, Manchester')
    assert.match(await dlg.locator('h3', { hasText: 'Add key facts' }).locator('xpath=..').innerText(), /1 added/)

    // a big TXT: over 20k characters, the message names the file that's cut
    await input.setInputFiles([{ name: 'handbook.txt', mimeType: 'text/plain', buffer: makeTxt(words(6000, 'handbook')) }])
    const over = dlg.locator('[data-over-cap]')
    await over.waitFor()
    assert.match(await over.innerText(), /^Too long, the first 20k characters will be used\. handbook\.txt is cut after ~[\d,]+ of 6,000 words\.$/)

    // kept in this browser per brand + prompt: text and file metadata, never the files; the failed and rejected rows aren't
    await page.waitForTimeout(300)
    const kept = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY)
    assert.deepEqual(kept.facts, [{ label: 'Clinic location', value: '14 King Street, Manchester' }])
    assert.deepEqual(kept.documents.map((d) => d.name), ['clinic-notes.txt', 'services.docx', 'study.pdf', 'handbook.txt'])
    assert.deepEqual(Object.keys(kept.documents[0]), ['name', 'kind', 'bytes', 'words', 'text'])
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Add your data' }).first().click()
    await page.getByRole('dialog').locator('[data-over-cap]').waitFor()
    assert.match(await page.getByRole('dialog').locator('[data-file-row]', { hasText: 'services.docx' }).innerText(), /Read · ~310 words/)
    assert.equal(await page.getByRole('dialog').getByLabel('Fact 1 value').inputValue(), '14 King Street, Manchester')
    await page.evaluate((k) => localStorage.removeItem(k), KEY)

    // the fixture: ?co=data-sample preloads userFacts; the draft names the clinic location and the locations flag is gone
    await page.goto(`${base}?co=data-sample`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Add your data' }).first().click()
    await page.getByRole('dialog').getByText('clinic-services.txt').waitFor()
    await page.getByRole('dialog').getByRole('button', { name: 'Write the draft' }).click()
    await page.locator('[data-draft-footer]').waitFor({ timeout: 15000 })
    const draft = await page.getByRole('dialog').innerText()
    assert.match(draft, /book a skin check at our clinic at 14 King Street, Manchester/)
    assert.doesNotMatch(draft, /Confirm office locations/)
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await server.close()
  }
})

test('?backend=full keeps its five steps (Search Console first, Publish & track last)', { timeout: 60000 }, async () => {
  const server = await createServer({ root, logLevel: 'silent', server: { port: 0, strictPort: false } })
  await server.listen()
  const { port } = server.httpServer.address()
  let browser
  try {
    browser = await chromium.launch({ executablePath: chromePath() })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(`http://localhost:${port}/opportunities/content/0?backend=full`, { waitUntil: 'networkidle' })
    assert.equal(await page.locator('ol[aria-label^="Step"]').first().getAttribute('aria-label'), 'Step 2 of 5')
    await page.getByRole('button', { name: 'Use this page' }).first().click()
    const dlg = page.getByRole('dialog')
    await dlg.getByText('Suggested from your files').waitFor() // the proposal's sample data, unchanged
    assert.match(await dlg.locator('h3').first().textContent(), /^Step 3 of 5:/)
  } finally {
    await browser?.close()
    await server.close()
  }
})
