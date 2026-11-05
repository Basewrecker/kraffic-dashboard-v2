// Runs the browser tests one file at a time (npm test, after the unit tests). Each file starts its own Vite dev server
// and Chrome; six of them at once on a loaded machine timed out on the first page load (2026-11-04), so they take turns.
// Every file still runs; the first failure fails npm test.
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('.', import.meta.url))
const files = readdirSync(dir).filter((f) => f.endsWith('.browser.test.mjs')).sort()
let failed = 0
for (const f of files) {
  const r = spawnSync(process.execPath, ['--test', `${dir}${f}`], { stdio: 'inherit' })
  if (r.status !== 0) failed++
}
if (failed) { console.error(`${failed} of ${files.length} browser test files failed`); process.exit(1) }
console.log(`browser tests: ${files.length} files passed`)
