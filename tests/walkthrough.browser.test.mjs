// Browser test: the first-time walkthrough (src/walkthrough, mock only).
// ?walkthrough=new shows Welcome; Start walkthrough lights the sidebar's groups one at a time. The lit area is a hole
// in the one dim layer: the group from its heading to its last item plus 4px (less where a neighbour is closer), never
// touching another group, with the card beside it and the card's caret on the area's middle, 12px away. The arrow
// keys and Enter move, Esc closes; the focus ring shows only while the keyboard is used.
// Getting started: six steps in order. Step 1 ticks on Brand Setup's Save, step 2 when Prompt Hub's pointers are
// finished, step 3 when Visibility Overview is opened, steps 4 to 6 from "Mark as done" on their pages; then the
// last message, and the card goes. Reduced motion: no glide. Phone width: the card is a full-width sheet and the
// list is in the menu drawer.
// Runs a real browser (playwright-core + the Chromium in ~/Library/Caches/ms-playwright) against Vite's dev server.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { chromePath } from './chromePath.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))

// the hole, the lit element(s), everything else that is marked, the card and its caret
const geom = (page, target) => page.evaluate((sel) => {
  const hole = document.querySelector('[data-hole]')?.dataset.hole?.split(' ').map(Number)
  const card = document.querySelector('[data-walkthrough] [role=dialog]')
  if (!hole || !card) return null
  const [l, t, w, h] = hole
  const c = card.getBoundingClientRect()
  const k = card.querySelector('[data-caret]')?.getBoundingClientRect()
  const out = {
    over: l < c.right && c.left < l + w && t < c.bottom && c.top < t + h,
    inside: c.left >= 0 && c.top >= 0 && c.right <= window.innerWidth && c.bottom <= window.innerHeight,
    width: Math.round(c.width),
    side: card.dataset.side,
    text: card.querySelector('p').textContent,
    dims: document.querySelectorAll('[data-dim]').length,
    nextOutline: getComputedStyle(card.querySelector('[data-next]')).outlineStyle,
    nextShadow: getComputedStyle(card.querySelector('[data-next]')).boxShadow,
    caretGap: k ? (card.dataset.side === 'right' ? k.left - (l + w) : null) : null,
    caretOff: k ? Math.abs((k.top + k.height / 2) - (t + h / 2)) : null,
  }
  if (sel) {
    const el = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length)
    const r = el.getBoundingClientRect()
    out.pad = [r.left - l, r.top - t, l + w - r.right, t + h - r.bottom].map((v) => Math.round(v * 10) / 10)
    out.touches = [...document.querySelectorAll('[data-tour], [data-tour-near]')]
      .filter((e) => e !== el && e.getClientRects().length && !el.contains(e) && !e.contains(el))
      .map((e) => e.getBoundingClientRect())
      .some((o) => o.left < l + w && l < o.right && o.top <= t + h && t <= o.bottom)
    const head = el.querySelector(':scope > button'), last = [...el.querySelectorAll('a')].at(-1)
    out.fromHeading = head ? Math.round((head.getBoundingClientRect().top - t) * 10) / 10 : null
    out.toLastItem = last ? Math.round((t + h - last.getBoundingClientRect().bottom) * 10) / 10 : null
  }
  return out
}, target)
const pointer = async (page, at, target) => {
  await page.waitForFunction((want) => document.querySelector('[data-walkthrough] [role=dialog] span.tabular-nums')?.textContent === want, at)
  await page.waitForTimeout(450) // the glide (260ms) and the card behind it
  return geom(page, target)
}
const steps = (page) => page.locator('[data-task]').evaluateAll((els) => els.map((el) => el.dataset.status))
const card = (page) => page.locator('[data-getting-started=sidebar] [data-tour="getting-started"]')
const start = (page) => page.getByRole('button', { name: 'Start', exact: true })

test('first-time run: Welcome, the menu pointers as a cut-out, then the six steps ticking in order', async () => {
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
    assert.match(await card(page).innerText(), /0 of 6[\s\S]*Next: Confirm your brand and competitors/)
    await page.getByRole('button', { name: 'Start walkthrough' }).click()

    // ---- the five menu pointers
    const targets = ['nav-insights', 'nav-opportunities', 'nav-optimize', 'nav-settings', 'getting-started'].map((k) => `[data-tour="${k}"]`)
    const texts = []
    for (let i = 1; i <= 5; i++) {
      const g = await pointer(page, `${i} of 5`, targets[i - 1])
      assert.ok(g, `pointer ${i} is up`)
      assert.equal(g.dims, 1, 'one dim layer')
      assert.ok(g.pad.every((v) => v >= 0 && v <= 4.2), `pointer ${i}: at most 4px around the element (${g.pad})`) // .2: sizes are fractions of a pixel at the 0.8 UI scale
      assert.ok(Math.abs(g.pad[0] - 4) < 0.2 && Math.abs(g.pad[2] - 4) < 0.2, `pointer ${i}: 4px each side of the sidebar's content`)
      assert.equal(g.touches, false, `pointer ${i}: the lit area touches nothing else`)
      if (i < 5) {
        assert.ok(g.fromHeading >= 0 && g.fromHeading <= 4.2, `pointer ${i}: starts at the group's heading`)
        assert.ok(g.toLastItem >= 0 && g.toLastItem <= 4.2, `pointer ${i}: ends at the group's last item`)
      }
      assert.equal(g.over, false, `pointer ${i}: the card is not over the lit area`)
      assert.equal(g.inside, true, `pointer ${i}: the card is inside the window`)
      assert.equal(g.side, 'right')
      assert.ok(Math.abs(g.caretGap - 12) <= 1.5, `pointer ${i}: the caret is 12px from the lit area (${g.caretGap})`)
      assert.ok(g.caretOff <= 1, `pointer ${i}: the caret is on the lit area's middle (${g.caretOff})`)
      texts.push(g.text)
      if (i === 1) {
        // reached with the mouse: no ring on Next
        assert.equal(g.nextOutline, 'none')
        assert.equal(g.nextShadow, 'none')
      }
      if (i === 2) { // Back, then on again, with the keyboard: now Next shows its ring
        await page.keyboard.press('ArrowLeft')
        assert.equal((await pointer(page, '1 of 5')).text, texts[0])
        await page.keyboard.press('ArrowRight')
        assert.equal((await pointer(page, '2 of 5')).nextOutline, 'solid')
      }
      if (i < 5) await page.keyboard.press('ArrowRight')
      else await page.locator('[data-next]').click()
    }
    assert.equal(texts[0], 'This is where you see how AI talks about Dermasuri.')
    assert.equal(texts[4], 'This is your plan. Six steps, in order. Start with the first one.')

    // ---- the list: a route of six, only the first step open
    await page.waitForSelector('[role=dialog][aria-label="Getting started"]')
    assert.equal(await page.locator('[data-walkthrough]').count(), 0)
    assert.deepEqual(await steps(page), ['current', 'later', 'later', 'later', 'later', 'later'])
    assert.equal(await start(page).count(), 1)
    assert.equal(await page.locator('[data-task=prompts] button').count(), 0) // later steps can't be clicked
    assert.equal(await page.getByRole('button', { name: 'Hide', exact: true }).count(), 0)

    // step 1: Brand Setup's four pointers, then Save ticks it
    await start(page).click()
    for (let i = 1; i <= 4; i++) {
      const g = await pointer(page, `${i} of 4`)
      assert.equal(g.over, false, `Brand Setup pointer ${i}: the card is not over the lit area`)
      assert.equal(g.inside, true)
      await page.keyboard.press('ArrowRight')
    }
    await page.waitForFunction(() => !document.querySelector('[data-walkthrough]'))
    assert.equal(new URL(page.url()).pathname, '/brands')
    assert.match(await card(page).innerText(), /0 of 6/) // the pointers alone don't tick it
    await page.locator('[data-tour="setup-save"] button').click()
    // at the same moment: the card's count and its Next line, and the list opens on the tick
    assert.match(await card(page).innerText(), /1 of 6[\s\S]*Next: Review the prompts we track/)
    assert.deepEqual(await steps(page), ['done', 'current', 'later', 'later', 'later', 'later'])
    assert.equal(await page.locator('[data-tour="setup-save"]').count(), 0)

    // step 2: Prompt Hub's pointers; skipping them doesn't tick it, finishing them does
    await start(page).click()
    await pointer(page, '1 of 3')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[data-walkthrough]'))
    assert.match(await card(page).innerText(), /1 of 6/)
    await page.getByRole('button', { name: 'Show me around Prompt Hub' }).click()
    for (let i = 1; i <= 3; i++) { assert.equal((await pointer(page, `${i} of 3`)).over, false); await page.locator('[data-next]').click() }
    await page.waitForSelector('[role=dialog][aria-label="Getting started"]')
    assert.deepEqual(await steps(page), ['done', 'done', 'current', 'later', 'later', 'later'])

    // step 3: opening Visibility Overview ticks it (shown when its pointers close)
    await start(page).click()
    await pointer(page, '1 of 4')
    assert.equal(new URL(page.url()).pathname, '/overview')
    await page.keyboard.press('Escape')
    await page.waitForSelector('[role=dialog][aria-label="Getting started"]')
    assert.deepEqual(await steps(page), ['done', 'done', 'done', 'current', 'later', 'later'])
    assert.match(await card(page).innerText(), /3 of 6[\s\S]*Next: Check what AI says about you/)

    // steps 4 to 6: "Mark as done" on their pages
    for (const [n, path] of [[4, '/sentiment'], [5, '/opportunities/content'], [6, '/opportunities/content']]) {
      await start(page).click()
      if (n === 4) {
        // Sentiment has pointers of its own; the fourth lights the Opportunities button
        for (let i = 1; i <= 4; i++) {
          const g = await pointer(page, `${i} of 4`, i === 4 ? '.k-mo-btn' : null)
          assert.equal(g.over, false, `Sentiment pointer ${i}: the card is not over the lit area`)
          if (i === 4) assert.ok(g.pad.every((v) => Math.abs(v - 4) < 0.2), `the Opportunities button is lit with 4px around it (${g.pad})`)
          await page.locator('[data-next]').click()
        }
        await page.waitForFunction(() => !document.querySelector('[data-walkthrough]'))
      }
      await page.waitForSelector('[data-task-action]')
      assert.equal(new URL(page.url()).pathname, path)
      await page.getByRole('button', { name: 'Mark as done' }).click()
      await page.waitForFunction((want) => document.querySelector('[data-getting-started=sidebar] [data-count]')?.textContent.includes(`${want} of 6`), n)
    }
    // the last message, with all six ticked; then the card goes by itself
    assert.match(await page.locator('[role=dialog][aria-label="Getting started"]').innerText(), /You’re set up\. Kraffic keeps checking AI for you\. Come back each week to see what changed\./)
    assert.deepEqual(await steps(page), Array(6).fill('done'))
    await page.waitForFunction(() => !document.querySelector('[data-getting-started]'), null, { timeout: 12000 })

    // a first scan running: the four steps that need results wait
    await page.goto(at('/tracking?walkthrough=scanning'), { waitUntil: 'networkidle' })
    assert.match(await card(page).innerText(), /2 of 6[\s\S]*Waiting for your first results/)
    await card(page).click()
    assert.deepEqual(await steps(page), ['done', 'done', 'waiting', 'waiting', 'waiting', 'waiting'])
    assert.equal(await start(page).count(), 0)
    assert.match(await page.locator('[data-task=results]').innerText(), /Waiting for your first results/)

    // "⋯" → Hide for now; ?walkthrough=reset clears it all
    await page.getByRole('button', { name: 'More' }).click()
    await page.getByRole('menuitem', { name: 'Hide for now' }).click()
    assert.equal(await page.locator('[data-getting-started]').count(), 0)
    await page.goto(at('/overview?walkthrough=reset'), { waitUntil: 'networkidle' })
    assert.equal(await page.locator('[data-getting-started], [data-walkthrough]').count(), 0)
    assert.deepEqual(errors, [])
    await page.close()

    // reduced motion: the hole is at its new place at once
    const still = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    const quiet = await still.newPage()
    await quiet.goto(at('/overview?walkthrough=new'), { waitUntil: 'networkidle' })
    await quiet.getByRole('button', { name: 'Start walkthrough' }).click()
    await pointer(quiet, '1 of 5')
    await quiet.locator('[data-next]').click()
    await quiet.waitForFunction(() => document.querySelector('[data-walkthrough] [role=dialog] span.tabular-nums')?.textContent === '2 of 5')
    await quiet.waitForTimeout(60)
    const now = await geom(quiet, '[data-tour="nav-opportunities"]')
    assert.ok(now.pad.every((v) => Math.abs(v - 4) < 0.2), `the hole is at its new place (${now.pad})`)
    await still.close()

    // phone width: the card is a sheet across the window, one dim layer; the list is in the menu drawer
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
    const small = await phone.newPage()
    await small.goto(at('/overview?walkthrough=new'), { waitUntil: 'networkidle' })
    await small.getByRole('button', { name: 'Start walkthrough' }).click()
    for (let i = 1; i <= 5; i++) {
      const g = await pointer(small, `${i} of 5`)
      assert.equal(g.width, 390, `phone pointer ${i}: a full-width sheet`)
      assert.equal(g.side, 'sheet')
      assert.equal(g.over, false, `phone pointer ${i}: the sheet is not over the lit area`)
      await small.locator('[data-next]').click()
    }
    await small.waitForSelector('[data-getting-started=drawer] [data-task=brand]')
    await small.locator('[data-getting-started=drawer]').getByRole('button', { name: 'Start', exact: true }).click()
    assert.equal((await pointer(small, '1 of 4')).width, 390)
    assert.equal(new URL(small.url()).pathname, '/brands')
    await phone.close()
  } finally {
    await browser?.close()
    await server.close()
  }
})
