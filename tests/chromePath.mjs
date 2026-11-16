// The Chrome the browser tests drive: CHROME_PATH if set, else the newest Chrome for Testing in Playwright's cache (macOS).
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const cache = join(homedir(), 'Library/Caches/ms-playwright')
  const dirs = existsSync(cache) ? readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1])) : []
  for (const d of dirs) {
    for (const arch of ['chrome-mac-arm64', 'chrome-mac']) {
      const p = join(cache, d, arch, 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
      if (existsSync(p)) return p
    }
  }
  throw new Error('No Chrome found: set CHROME_PATH, or install one with `npx playwright install chromium`.')
}
