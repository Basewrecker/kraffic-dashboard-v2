// Browser test: the first-time walkthrough (src/walkthrough, mock only).
// ?walkthrough=new shows Welcome; Start walkthrough lights the sidebar's groups one at a time with a card beside each
// (never over it, always inside the window); the arrow keys and Enter move, Esc closes. After the last pointer the
// Getting started list is open; its first task opens Brand Setup and starts that page's pointers; Save ticks the task.
// Reduced motion: the lit box has no transition. Phone width: the card is a full-width sheet and the list is in the
// menu drawer.
// Runs a real browser (playwright-core + the Chromium in ~/Library/Caches/ms-playwright) against Vite's dev server.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { chromePath } from './chromePath.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))

// the lit box and the pointer's card
const geom = (page) => page.evaluate(() => {
  const h = document.querySelector('.wt-hole')?.getBoundingClientRect()
  const card = document.querySelector('[data-walkthrough] [role=dialog]')
  const c = card?.getBoundingClientRect()
  if (!h || !c || !h.width) return null
  return {
    over: h.left < c.right && c.left < h.right && h.top < c.bottom && c.top < h.bottom,
    inside: c.left >= 0 && c.top >= 0 && c.right <= window.innerWidth && c.bottom <= window.innerHeight,
    width: Math.round(c.width),
    text: card.querySelector('p').textContent,
    at: card.querySelector('span').textContent,
    holeTransition: getComputedStyle(document.querySelector('.wt-hole')).transitionDuration,
  }
})
const pointer = async (page, at) => {
  await page.waitForFunction((want) => document.querySelector('[data-walkthrough] [role=dialog] span')?.textContent === want, at)
  await page.waitForTimeout(450) // the glide (260ms) and the card behind it
  return geom(page)
}

test('first-time run: Welcome, the menu pointers, task 1, Brand Setup pointers, Save ticks', async () => {
  const server = await createServer({ root, logLevel: 'silent', server: { port: 0, strictPort: false } })
  await server.listen()
  const { port } = server.httpServer.address()
  const at = (path) => `http://localhost:${port}${path}`
  let browser
  try {
    browser = await chromium.launch({ executablePath: chromePath() })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))

    // without the parameter nothing of the walkthrough is on the page
    await page.goto(at('/overview'), { waitUntil: 'networkidle' })
    assert.equal(await page.locator('[data-getting-started], [data-walkthrough]').count(), 0)

    await page.goto(at('/overview?walkthrough=new'), { waitUntil: 'networkidle' })
    assert.equal(await page.getByRole('dialog').getByRole('heading').innerText(), 'Welcome to Kraffic')
    assert.match(await page.locator('[data-getting-started=sidebar] > div > button').innerText(), /0 of 6/)
    await page.getByRole('button', { name: 'Start walkthrough' }).click()

    const texts = []
    for (let i = 1; i <= 5; i++) {
      const g = await pointer(page, `${i} of 5`)
      assert.ok(g, `pointer ${i} is up`)
      assert.equal(g.over, false, `pointer ${i}: the card is not over the lit box`)
      assert.equal(g.inside, true, `pointer ${i}: the card is inside the window`)
      texts.push(g.text)
      if (i === 2) { // Back, then on again
        await page.keyboard.press('ArrowLeft')
        assert.equal((await pointer(page, '1 of 5')).text, texts[0])
        await page.keyboard.press('ArrowRight')
        await pointer(page, '2 of 5')
      }
      await page.keyboard.press(i < 5 ? 'ArrowRight' : 'Enter')
    }
    assert.equal(texts[0], 'This is where you see how AI talks about Dermasuri.')
    assert.equal(texts[4], 'This is your plan. Six steps, in order. Start with the first one.')

    // the pointers are gone and the list is open, the first task next
    await page.waitForSelector('[role=dialog][aria-label="Getting started"]')
    assert.equal(await page.locator('[data-walkthrough]').count(), 0)
    assert.equal(await page.locator('[data-task=brand]').getAttribute('data-status'), 'next')
    assert.equal(await page.locator('[data-task]').count(), 6)

    // task 1: Brand Setup and its four pointers
    await page.locator('[data-task=brand] button').click()
    for (let i = 1; i <= 4; i++) {
      const g = await pointer(page, `${i} of 4`)
      assert.equal(g.over, false, `Brand Setup pointer ${i}: the card is not over the lit box`)
      assert.equal(g.inside, true)
      await page.keyboard.press('ArrowRight')
    }
    await page.waitForFunction(() => !document.querySelector('[data-walkthrough]'))
    assert.equal(new URL(page.url()).pathname, '/brands')

    // Save ticks the task; the bar it lived in goes
    await page.locator('[data-tour="setup-save"] button').click()
    await page.waitForFunction(() => /1 of 6/.test(document.querySelector('[data-getting-started=sidebar] button')?.textContent ?? ''))
    assert.equal(await page.locator('[data-tour="setup-save"]').count(), 0)
    await page.locator('[data-getting-started=sidebar] > div > button').click()
    assert.equal(await page.locator('[data-task=brand]').getAttribute('data-status'), 'done')
    assert.equal(await page.locator('[data-task=prompts]').getAttribute('data-status'), 'next')

    // Esc closes a pointer; the "?" beside the title starts the page's pointers
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Show me around Brand Setup' }).click()
    await pointer(page, '1 of 4')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[data-walkthrough]'))

    // a first scan running: the four tasks that need results wait
    await page.goto(at('/overview?walkthrough=scanning'), { waitUntil: 'networkidle' })
    await page.locator('[data-getting-started=sidebar] > div > button').click()
    assert.deepEqual(await page.locator('[data-task]').evaluateAll((els) => els.map((el) => el.dataset.status)), ['done', 'done', 'waiting', 'waiting', 'waiting', 'waiting'])
    assert.equal(await page.locator('[data-task=results] button').count(), 0)
    assert.match(await page.locator('[data-task=results]').innerText(), /Waiting for your first results/)

    // all six: the last message, then the card goes
    await page.goto(at('/overview?walkthrough=done'), { waitUntil: 'networkidle' })
    assert.match(await page.locator('[role=dialog][aria-label="Getting started"]').innerText(), /You’re set up\. Kraffic keeps checking AI for you\. Come back each week to see what changed\./)
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await page.waitForFunction(() => !document.querySelector('[data-getting-started]'))

    // ?walkthrough=reset clears it all
    await page.goto(at('/overview?walkthrough=reset'), { waitUntil: 'networkidle' })
    assert.equal(await page.locator('[data-getting-started], [data-walkthrough]').count(), 0)
    assert.deepEqual(errors, [])
    await page.close()

    // reduced motion: the lit box moves without a transition
    const still = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    const quiet = await still.newPage()
    await quiet.goto(at('/overview?walkthrough=new'), { waitUntil: 'networkidle' })
    await quiet.getByRole('button', { name: 'Start walkthrough' }).click()
    await pointer(quiet, '1 of 5')
    await quiet.keyboard.press('ArrowRight')
    assert.equal((await pointer(quiet, '2 of 5')).holeTransition, '0s')
    await still.close()

    // phone width: the card is a sheet across the window; the list is in the menu drawer
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
    const small = await phone.newPage()
    await small.goto(at('/overview?walkthrough=new'), { waitUntil: 'networkidle' })
    await small.getByRole('button', { name: 'Start walkthrough' }).click()
    for (let i = 1; i <= 5; i++) {
      const g = await pointer(small, `${i} of 5`)
      assert.equal(g.width, 390, `phone pointer ${i}: a full-width sheet`)
      assert.equal(g.over, false, `phone pointer ${i}: the sheet is not over the lit box`)
      await small.locator('[data-next]').click()
    }
    await small.waitForSelector('[data-getting-started=drawer] [data-task=brand] button')
    await small.locator('[data-getting-started=drawer] [data-task=brand] button').click()
    assert.equal((await pointer(small, '1 of 4')).width, 390)
    assert.equal(new URL(small.url()).pathname, '/brands')
    await phone.close()
  } finally {
    await browser?.close()
    await server.close()
  }
})
