// Browser test: the first-time walkthrough (src/walkthrough, mock only).
// ?walkthrough=new shows Welcome; Start the guide lights the sidebar's groups one at a time. The lit area is a hole
// in the one dim layer: the group from its heading to its last item plus 4px (less where a neighbour is closer), never
// touching another group, with the card beside it and the card's caret on the area's middle, 12px away. The arrow
// keys and Enter move, Esc closes; the focus ring shows only while the keyboard is used.
// Getting started: six steps in order. Step 1 ticks on Brand Setup's Save, step 2 when Prompt Hub's pointers are
// finished, step 3 when Visibility Overview is opened, steps 4 to 6 from their flows (4: Sentiment then Fact Check; 5:
// Content to a draft; 6: Opportunities' Reach out; "do this" pointers are clicked, not Next); then the
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
// the board's six frames (the sheet grows out of the card: it is read once it is open)
const steps = async (page) => { await page.waitForSelector('[data-board=open] [data-frame]'); return page.locator('[data-board=open] [data-frame]').evaluateAll((els) => els.map((el) => el.dataset.status)) }
const card = (page) => page.locator('[data-getting-started=sidebar] [data-tour="getting-started"]')
const start = (page) => page.getByRole('button', { name: 'Start', exact: true })
// the collapsed card: its count (the ring's number) and its "Next:" line
const cardSays = async (page) => `${await card(page).getAttribute('data-count')} · ${(await card(page).locator('[data-next-line]').last().innerText()).trim()}`

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
    assert.equal(await cardSays(page), '0 of 6 · Next: Your brand')
    await page.getByRole('button', { name: 'Start the guide' }).click()

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

    // ---- the board: the first step in the hero, a trail of six
    await page.waitForSelector('[data-board=open]')
    assert.equal(await page.locator('[data-walkthrough]').count(), 0)
    assert.deepEqual(await steps(page), ['current', 'later', 'later', 'later', 'later', 'later'])
    assert.equal(await start(page).count(), 1)
    assert.equal(await page.locator('button[data-frame=prompts]').count(), 0) // later steps can't be clicked
    assert.equal(await page.locator('[data-hero-title]').last().innerText(), 'Confirm your brand and competitors')
    assert.equal(await page.locator('[data-opens]').innerText(), 'Brand Setup')
    assert.equal(await page.locator('[data-preview=brand]').count(), 1)

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
    assert.equal(await card(page).getAttribute('data-count'), '0 of 6') // the pointers alone don't tick it
    await page.locator('[data-tour="setup-save"] button').click()
    // at the same moment: the card's count and its Next line, and the list opens on the tick
    assert.equal(await card(page).getAttribute('data-count'), '1 of 6')
    await page.waitForFunction(() => [...document.querySelectorAll('[data-getting-started=sidebar] [data-next-line]')].at(-1)?.textContent === 'Next: Your prompts')
    assert.deepEqual(await steps(page), ['done', 'current', 'later', 'later', 'later', 'later'])
    assert.equal(await page.locator('[data-tour="setup-save"]').count(), 0)
    // the finished step's frame says what it produced; the hero has moved on to the next step
    assert.match(await page.locator('[data-frame=brand] [data-result]').innerText(), /^\d+ competitors?$/)
    await page.waitForFunction(() => [...document.querySelectorAll('[data-hero-title]')].at(-1)?.textContent === 'Review the prompts we track')
    assert.equal(await page.locator('[data-opens]').innerText(), 'Prompt Hub')
    assert.equal(await page.locator('[data-board=open] .wt-segs-top .wt-seg[data-state=done]').count(), 1)
    // a done frame shows its step again, with Replay; the current frame brings the hero back
    await page.locator('button[data-frame=brand]').click()
    await page.locator('[data-board=open]').getByRole('button', { name: 'Replay', exact: true }).waitFor()
    await page.locator('button[data-frame=prompts]').click()
    await start(page).waitFor()

    // step 2: Prompt Hub's pointers; skipping them doesn't tick it, finishing them does
    await start(page).click()
    await pointer(page, '1 of 3')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[data-walkthrough]'))
    assert.equal(await card(page).getAttribute('data-count'), '1 of 6')
    // Start again: the run resumes on the page it stopped on
    await card(page).click()
    await start(page).click()
    for (let i = 1; i <= 3; i++) { assert.equal((await pointer(page, `${i} of 3`)).over, false); await page.locator('[data-next]').click() }
    assert.deepEqual(await steps(page), ['done', 'done', 'current', 'later', 'later', 'later'])

    // step 3: opening Visibility Overview ticks it (shown when its pointers close)
    await start(page).click()
    await pointer(page, '1 of 4')
    assert.equal(new URL(page.url()).pathname, '/overview')
    await page.keyboard.press('Escape')
    assert.deepEqual(await steps(page), ['done', 'done', 'done', 'current', 'later', 'later'])
    assert.equal(await card(page).getAttribute('data-count'), '3 of 6')

    // steps 4 to 6: their flows. n pointers; `dos` are "do this" (the lit element is clicked, there is no Next)
    const litClick = async () => { const h = (await page.evaluate(() => document.querySelector('[data-walkthrough] [data-hole]').dataset.hole)).split(' ').map(Number); await page.mouse.click(h[0] + h[2] / 2, h[1] + h[3] / 2) }
    const flow = async (name, n, dos, after = {}, from = 1, to = n) => {
      for (let i = from; i <= to; i++) {
        await page.waitForFunction((want) => { const d = document.querySelector('[data-walkthrough] [role=dialog]'); return d?.querySelector('[data-count]')?.dataset.count === want && getComputedStyle(d).opacity === '1' && !document.querySelector('[data-walkthrough][data-waiting]') }, `${i} of ${n}`, { timeout: 30000 })
        await page.waitForTimeout(500)
        const g = await page.evaluate(() => {
          const c = document.querySelector('[data-walkthrough] [role=dialog]').getBoundingClientRect()
          const h = document.querySelector('[data-walkthrough] [data-hole]')?.dataset.hole?.split(' ').map(Number)
          return { dialogs: document.querySelectorAll('[data-walkthrough] [role=dialog]').length, hole: Boolean(h), over: Boolean(h) && h[0] < c.right && c.left < h[0] + h[2] && h[1] < c.bottom && c.top < h[1] + h[3], onScreen: !h || (h[1] >= 0 && h[1] < innerHeight - 20), next: Boolean(document.querySelector('[data-next]')), hint: document.querySelector('[data-do-hint]')?.textContent ?? null }
        })
        assert.equal(g.dialogs, 1, `${name} ${i}: one pointer on screen`)
        assert.equal(g.over, false, `${name} ${i}: the card is not over the lit element`)
        assert.ok(g.onScreen, `${name} ${i}: the lit element is on screen`)
        assert.equal(g.hole, !(name === 'content' && i === n), `${name} ${i}: ${name === 'content' && i === n ? 'the closing card has no lit element' : 'an element is lit'}`)
        if (dos.includes(i)) { assert.deepEqual([g.next, g.hint], [false, 'Click it to continue'], `${name} ${i} is a "do this" pointer`); await litClick() } else await page.locator('[data-next]').click()
        if (after[i]) await after[i]()
      }
      if (to === n) await page.waitForFunction(() => !document.querySelector('[data-walkthrough]'))
    }
    const count = (want) => page.waitForFunction((w) => document.querySelector('[data-getting-started=sidebar] [data-tour="getting-started"]')?.dataset.count === `${w} of 6`, want)
    // 4: Sentiment's four, then Fact Check's three; it ticks at the end and the board opens again
    await start(page).click()
    await flow('tone', 7, [])
    assert.equal(new URL(page.url()).pathname, '/website-facts')
    await count(4); await page.waitForSelector('[data-board=open]')
    // 5, left midway (Esc on the prompt's page): not done, and Start resumes on that page
    await start(page).click()
    await flow('content', 11, [3, 5, 8], {}, 1, 3)
    await page.waitForFunction(() => document.querySelector('[data-walkthrough] [data-count]')?.dataset.count === '4 of 11' && !document.querySelector('[data-walkthrough][data-waiting]'))
    assert.match(new URL(page.url()).pathname, /^\/opportunities\/content\/\d+$/)
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[data-walkthrough]'))
    assert.equal(await card(page).getAttribute('data-count'), '4 of 6')
    await page.locator('a[href="/overview"]').first().click()
    await card(page).click()
    await start(page).click()
    // 4 to 11: the click on the first button opens the one-time Brand Guidelines screen, where the pointers wait
    await flow('content', 11, [3, 5, 8], {
      5: async () => { await page.getByRole('button', { name: 'Skip for now' }).click() },
      9: async () => assert.equal(await card(page).getAttribute('data-count'), '4 of 6', 'the tick waits for the pointers to close'),
    }, 4)
    await count(5); await page.waitForSelector('[data-board=open]')
    // Replay on a done step: the same flow from its first pointer; going to another page ends it, and nothing ticks
    await page.locator('[data-board=open] button[data-frame=content]').click()
    await page.locator('[data-board=open]').getByRole('button', { name: 'Replay', exact: true }).click()
    await flow('content', 11, [3, 5, 8], {}, 1, 1)
    await page.evaluate(() => { history.pushState(null, '', '/tracker'); window.dispatchEvent(new PopStateEvent('popstate')) })
    await page.waitForFunction(() => !document.querySelector('[data-walkthrough]'))
    assert.equal(await card(page).getAttribute('data-count'), '5 of 6')
    // 6: Sentiment's Opportunities button, the list, and Reach out, whose link stays on the page
    await card(page).click()
    await start(page).click()
    await flow('outreach', 4, [1, 4], { 4: async () => assert.match(await page.locator('[data-wt-note]').innerText(), /^Reach out opened/) })
    assert.equal(page.context().pages().length, 1)
    await count(6)
    // all done: the hero is the summary; Done sends the sidebar card away
    assert.deepEqual(await steps(page), Array(6).fill('done'))
    await page.waitForFunction(() => [...document.querySelectorAll('[data-hero-title]')].at(-1)?.textContent === 'You’re set up')
    assert.match(await page.locator('[data-board=open]').innerText(), /Kraffic keeps checking AI for you\. Come back each week to see what changed\./)
    assert.equal(await page.locator('[data-summary] > div').count(), 6)
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.waitForFunction(() => !document.querySelector('[data-getting-started]') && !document.querySelector('[data-board]'), null, { timeout: 12000 })

    // a first scan running: the four steps that need results wait
    await page.goto(at('/tracking?walkthrough=scanning'), { waitUntil: 'networkidle' })
    assert.equal(await cardSays(page), '2 of 6 · Waiting for your first results')
    await card(page).click()
    assert.deepEqual(await steps(page), ['done', 'done', 'waiting', 'waiting', 'waiting', 'waiting'])
    assert.equal(await start(page).count(), 0)
    assert.equal(await page.locator('[data-waiting]').innerText(), 'Waiting for your first results')

    // Esc closes the board; ?walkthrough=reset clears it all
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[data-board]'))
    await page.goto(at('/overview?walkthrough=reset'), { waitUntil: 'networkidle' })
    assert.equal(await page.locator('[data-getting-started], [data-walkthrough]').count(), 0)
    assert.deepEqual(errors, [])
    await page.close()

    // reduced motion: the hole is at its new place at once
    const still = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    const quiet = await still.newPage()
    await quiet.goto(at('/overview?walkthrough=new'), { waitUntil: 'networkidle' })
    await quiet.getByRole('button', { name: 'Start the guide' }).click()
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
    await small.getByRole('button', { name: 'Start the guide' }).click()
    for (let i = 1; i <= 5; i++) {
      const g = await pointer(small, `${i} of 5`)
      assert.equal(g.width, 390, `phone pointer ${i}: a full-width sheet`)
      assert.equal(g.side, 'sheet')
      assert.equal(g.over, false, `phone pointer ${i}: the sheet is not over the lit area`)
      await small.locator('[data-next]').click()
    }
    // the board opens full screen; Start closes the menu and starts the page's pointers
    await small.waitForSelector('[data-board=open]')
    assert.equal(await small.locator('[data-board=open] [role=dialog]').evaluate((el) => Math.round(el.getBoundingClientRect().width)), 390)
    await start(small).click()
    assert.equal((await pointer(small, '1 of 4')).width, 390)
    assert.equal(new URL(small.url()).pathname, '/brands')
    await phone.close()
  } finally {
    await browser?.close()
    await server.close()
  }
})
