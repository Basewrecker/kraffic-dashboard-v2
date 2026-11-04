// Browser test: an engine whose latest scan didn't answer has no score (null), shown as "—", never 0.
// /overview?noresult=gemini&engine=gemini: Gemini's latest scan returned no result (data/brandViews.js noResultEngines)
// and the engine filter is on Gemini. The Visibility score ring, the history's Current score, the "Viewing as" menu's
// score for the brand and the Sync history's latest row must read "—", and the ⓘ says why. Also: the prompt tables
// show one line instead of their lists, the Growth view leaves the period empty, and Gemini's failed Sep 7 scan (sample
// data) reads "—" in Sync history.
// Runs a real browser (playwright-core + the Chromium in ~/Library/Caches/ms-playwright) against Vite's dev server.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { chromePath } from './chromePath.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const ZERO = /^0\s*%?$/

test('a null engine score renders as "—" with its ⓘ, never as 0', async () => {
  const server = await createServer({ root, logLevel: 'silent', server: { port: 0, strictPort: false } })
  await server.listen()
  const { port } = server.httpServer.address()
  let browser
  try {
    browser = await chromium.launch({ executablePath: chromePath() })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(`http://localhost:${port}/overview?noresult=gemini&engine=gemini`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400) // count-ups

    const shown = await page.evaluate(() => {
      const text = (el) => el?.textContent.trim() ?? null
      const leaf = (t) => [...document.querySelectorAll('main *')].find((el) => el.childNodes[0]?.nodeValue?.trim() === t)
      // the KPI card: up from its label to the first box holding the ring
      let card = leaf('Visibility score')
      while (card && !card.querySelector('svg text')) card = card.parentElement
      // Visibility history's "Current" (the summary strip; in the DOM with Compare on too)
      const current = leaf('Current')?.nextElementSibling
      // Sync history's latest row: its score cell
      const latest = [...document.querySelectorAll('main li')].find((li) => li.querySelector('button span')?.textContent.includes('Latest'))
      // Gemini's failed Sep 7 scan (sample data): its row reads "—" too
      const sep7 = [...document.querySelectorAll('main li')].find((li) => li.querySelector('button span')?.textContent.trim().startsWith('Sep 7'))
      return {
        ring: text(card?.querySelector('svg text')),
        current: text(current),
        syncRow: text(latest?.querySelector('button > span:nth-child(3) > span:first-child')),
        syncSep7: text(sep7?.querySelector('button > span:nth-child(3) > span:first-child')),
      }
    })

    // the brand menu ("Viewing as"): the score beside the brand being viewed
    await page.locator('main button[aria-label^="Viewing as"]').click()
    const option = page.getByRole('option', { name: /Dermasuri/ })
    await option.waitFor({ state: 'visible' })
    shown.brandMenu = (await option.locator('span').last().textContent()).trim()
    await page.keyboard.press('Escape')

    for (const [where, v] of Object.entries(shown)) {
      assert.ok(v != null, `${where}: the score element is missing`)
      assert.ok(!ZERO.test(v), `${where} renders a null score as "${v}" (all: ${JSON.stringify(shown)})`)
      assert.equal(v, '—', `${where} shows "—" for no result`)
    }

    // the ⓘ beside the KPI's "—" says why
    const info = page.locator('main button[aria-label^="No result from"]').first()
    await info.hover()
    const tip = page.getByRole('tooltip').filter({ hasText: 'No result from' })
    await tip.waitFor({ state: 'visible' })
    assert.equal((await tip.textContent()).trim(), 'No result from Gemini in the latest scan')
    await page.mouse.move(0, 0)

    // the Sep 7 row's ⓘ names that scan, and neither it nor the row after has a change line
    const sep7 = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('main li')]
      const at = (d) => rows.find((li) => li.querySelector('button span')?.textContent.trim().startsWith(d))
      return {
        label: at('Sep 7')?.querySelector('[role=img][aria-label^="No result from"]')?.getAttribute('aria-label') ?? null,
        text: at('Sep 7')?.querySelector('button')?.textContent ?? '',
        after: at('Sep 16')?.querySelector('button > span:nth-child(3)')?.textContent ?? '',
      }
    })
    assert.equal(sep7.label, 'No result from Gemini in the Sep 7 scan')
    assert.ok(!/58%|\b0%/.test(sep7.text), `the Sep 7 row reads "${sep7.text}"`)
    assert.ok(!/pts?|No change/.test(sep7.after), `Sep 16 has a change line against the failed scan: "${sep7.after}"`)

    // the prompt tables: one muted line + ⓘ instead of the list, and no count badge (never 0)
    for (const id of ['visible-prompts', 'missed-prompts', 'prompt-mix']) {
      const t = await page.evaluate((id) => {
        const card = document.getElementById(id)
        return {
          line: card?.querySelector('[data-no-result]')?.textContent.trim() ?? null,
          info: !!card?.querySelector('[data-no-result] button[aria-label="No result from Gemini in the latest scan"]'),
          rows: card ? card.querySelectorAll('tbody tr').length : -1,
          badge: card?.querySelector('h2')?.nextElementSibling?.textContent.trim() ?? null,
          zeros: /Showing 0|of 0\b/.test(card?.textContent ?? ''),
          text: card?.textContent ?? '',
        }
      }, id)
      assert.equal(t.line, 'No Gemini result in the latest scan', `${id}: the no-result line`)
      assert.ok(t.info, `${id}: the ⓘ`)
      assert.equal(t.rows, 1, `${id}: only the line, no prompt rows`)
      assert.equal(t.badge, null, `${id}: no count badge (was "${t.badge}")`)
      assert.ok(!t.zeros, `${id}: no "Showing 0–0 of 0" footer`)
      assert.ok(!/new prompts? since/.test(t.text), `${id}: no "won n new prompts" notice`)
    }

    // Growth view: the period with no result is an empty slot whose tooltip reads "—", never a 0 bar
    await page.goto(`http://localhost:${port}/overview?noresult=gemini&engine=gemini&chart=growth&compare=off`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    const hist = page.locator('#history')
    const tick = hist.locator('.recharts-cartesian-axis-tick-label', { hasText: 'Oct 5' })
    await tick.waitFor({ state: 'visible' })
    const tb = await tick.boundingBox()
    await page.mouse.move(tb.x + tb.width / 2, tb.y - 90) // inside the plot, above the date
    const gtip = hist.locator('.recharts-tooltip-wrapper')
    await page.waitForTimeout(250)
    const gtext = (await gtip.textContent()).trim()
    assert.match(gtext, /^Oct 5 · —$/, `the Oct 5 growth tooltip reads "${gtext}"`)
  } finally {
    await browser?.close()
    await server.close()
  }
})

// Google is two engines (AI Overview, AI Mode): AI Mode with no result in the latest scan uses the same no-result state
test('Google AI Mode with no result: the same no-result state, never 0', async () => {
  const server = await createServer({ root, logLevel: 'silent', server: { port: 0, strictPort: false } })
  await server.listen()
  const { port } = server.httpServer.address()
  let browser
  try {
    browser = await chromium.launch({ executablePath: chromePath() })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(`http://localhost:${port}/overview?noresult=aimode&engine=aimode`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const t = await page.evaluate(() => ({
      lines: ['visible-prompts', 'missed-prompts', 'prompt-mix'].map((id) => document.getElementById(id)?.querySelector('[data-no-result]')?.textContent.trim() ?? null),
      main: document.querySelector('main').textContent,
    }))
    for (const l of t.lines) assert.equal(l, 'No AI Mode result in the latest scan')
    assert.match(t.main, /AI Mode didn’t run this week/, 'Citations and Mentions names AI Mode as not run')
    // the engine menu: AI Mode by its full name, with no prompt count (never "0 prompts")
    await page.locator('main button[aria-label^="Engine"]').click()
    const opt = page.getByRole('option', { name: /Google AI Mode/ })
    await opt.waitFor()
    const text = await opt.innerText()
    assert.ok(!/\b0 prompts/.test(text), `the menu shows "${text}"`)
    assert.equal(await page.getByRole('option', { name: /Google AI Overview/ }).count(), 1, 'AI Overview is listed separately')
  } finally {
    await browser?.close()
    await server.close()
  }
})
